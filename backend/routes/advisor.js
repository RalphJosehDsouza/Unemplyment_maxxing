import express from 'express';
import { query } from '../db.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);
// Dispatch decisions belong to whoever creates trips → Fleet Manager (ADMIN passes).
router.use(authorize('FLEET_MANAGER'));

const round = (n, d = 2) => {
  const f = 10 ** d;
  return Math.round((Number(n) + Number.EPSILON) * f) / f;
};

// GET /api/advisor/recommend?cargo=450
// Ranks AVAILABLE, capacity-fitting vehicles and AVAILABLE, valid-license drivers,
// each with an explainable score, and returns the single best pairing.
router.get('/recommend', async (req, res) => {
  const cargo = Number(req.query.cargo);
  if (!Number.isFinite(cargo) || cargo <= 0) {
    return res.status(400).json({ message: 'Provide a cargo weight greater than 0' });
  }

  try {
    // Eligible vehicles: available + enough capacity (Retired / In Shop / On Trip excluded).
    const { rows: vehicles } = await query(
      `SELECT id, registration_number, model, vehicle_type,
              max_load_capacity::float8 AS capacity, current_odometer::float8 AS odometer
       FROM vehicles
       WHERE status = 'AVAILABLE' AND max_load_capacity >= $1`,
      [cargo]
    );
    const totalAvailable = (await query(`SELECT COUNT(*)::int AS c FROM vehicles WHERE status = 'AVAILABLE'`)).rows[0].c;

    // Fuel cost-per-km for those vehicles (fuel spend ÷ odometer span).
    const { rows: fuel } = await query(
      `SELECT vehicle_id, COALESCE(SUM(cost),0)::float8 AS cost,
              MIN(odometer)::float8 AS min_odo, MAX(odometer)::float8 AS max_odo
       FROM fuel_logs GROUP BY vehicle_id`
    );
    const fuelBy = Object.fromEntries(fuel.map((f) => [f.vehicle_id, f]));

    const vraw = vehicles.map((v) => {
      const f = fuelBy[v.id];
      const distance = f && f.max_odo != null && f.min_odo != null ? f.max_odo - f.min_odo : 0;
      const costPerKm = f && distance > 0 ? f.cost / distance : null;
      const utilization = v.capacity > 0 ? cargo / v.capacity : 0; // tighter fit = less wasted capacity
      return { ...v, cost_per_km: costPerKm, utilization };
    });

    // Normalise cost-per-km → lower is better (null = neutral 0.5).
    const costs = vraw.map((v) => v.cost_per_km).filter((c) => c != null);
    const minC = Math.min(...costs), maxC = Math.max(...costs);
    const costScore = (c) => {
      if (c == null || !costs.length || maxC === minC) return 0.5;
      return 1 - (c - minC) / (maxC - minC);
    };

    const recVehicles = vraw
      .map((v) => {
        const score = round((0.5 * Math.min(v.utilization, 1) + 0.5 * costScore(v.cost_per_km)) * 100, 0);
        const reasons = [
          `Fits load: ${cargo}kg ≤ ${round(v.capacity, 0)}kg (${round(v.utilization * 100, 0)}% used)`,
          v.cost_per_km != null ? `₹${round(v.cost_per_km)}/km fuel cost` : 'No fuel history yet',
          'Available now',
        ];
        return {
          id: v.id, registration_number: v.registration_number, model: v.model, vehicle_type: v.vehicle_type,
          capacity: round(v.capacity, 0), capacity_utilization: round(v.utilization * 100, 0),
          cost_per_km: v.cost_per_km == null ? null : round(v.cost_per_km), score, reasons,
        };
      })
      .sort((a, b) => b.score - a.score);

    // Eligible drivers: available + license not expired.
    const { rows: drivers } = await query(
      `SELECT id, name, license_number, license_category, safety_score::int AS safety_score,
              to_char(license_expiry, 'YYYY-MM-DD') AS license_expiry,
              (license_expiry - CURRENT_DATE)::int AS days_to_expiry
       FROM drivers
       WHERE status = 'AVAILABLE' AND license_expiry >= CURRENT_DATE
       ORDER BY safety_score DESC`
    );
    const totalDriversAvailable = (await query(`SELECT COUNT(*)::int AS c FROM drivers WHERE status = 'AVAILABLE'`)).rows[0].c;

    const recDrivers = drivers.map((d) => {
      const reasons = [
        `Safety score ${d.safety_score}/100`,
        d.days_to_expiry <= 30 ? `License expires in ${d.days_to_expiry}d — renew soon` : `License valid (${d.license_category || 'n/a'})`,
        'Available now',
      ];
      return { ...d, score: d.safety_score, reasons };
    });

    res.json({
      cargo,
      recommendation:
        recVehicles.length && recDrivers.length
          ? { vehicle: recVehicles[0], driver: recDrivers[0] }
          : null,
      vehicles: recVehicles,
      drivers: recDrivers,
      excluded: {
        available_vehicles_too_small: Math.max(0, totalAvailable - recVehicles.length),
        available_drivers_expired: Math.max(0, totalDriversAvailable - recDrivers.length),
      },
    });
  } catch (error) {
    console.error('Advisor error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
