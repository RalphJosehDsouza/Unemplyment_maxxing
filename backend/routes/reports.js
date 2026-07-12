import express from 'express';
import { query } from '../db.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);
// Reports are for financial/operational review — Financial Analyst & Fleet Manager (ADMIN passes).
router.use(authorize('FINANCIAL_ANALYST', 'FLEET_MANAGER'));

const round = (n, d = 2) => {
  const f = 10 ** d;
  return Math.round((Number(n) + Number.EPSILON) * f) / f;
};

// GET /api/reports/analytics — profitability, ROI, utilization, efficiency
router.get('/analytics', async (_req, res) => {
  try {
    const [{ rows: vehicles }, { rows: rev }, { rows: fuel }, { rows: maint }, { rows: exp }] = await Promise.all([
      query(`SELECT id, registration_number, model, vehicle_type, status,
                    acquisition_cost::float8 AS acquisition_cost, current_odometer::float8 AS current_odometer
             FROM vehicles`),
      query(`SELECT vehicle_id, COALESCE(SUM(revenue),0)::float8 AS revenue, COUNT(*)::int AS trips
             FROM trips WHERE status = 'COMPLETED' GROUP BY vehicle_id`),
      query(`SELECT vehicle_id, COALESCE(SUM(cost),0)::float8 AS cost, COALESCE(SUM(liters),0)::float8 AS liters,
                    MIN(odometer)::float8 AS min_odo, MAX(odometer)::float8 AS max_odo
             FROM fuel_logs GROUP BY vehicle_id`),
      query(`SELECT vehicle_id, COALESCE(SUM(cost),0)::float8 AS cost FROM maintenance_logs GROUP BY vehicle_id`),
      query(`SELECT vehicle_id, expense_type, COALESCE(SUM(amount),0)::float8 AS amount FROM expenses GROUP BY vehicle_id, expense_type`),
    ]);

    const revBy = Object.fromEntries(rev.map((r) => [r.vehicle_id, r]));
    const fuelBy = Object.fromEntries(fuel.map((f) => [f.vehicle_id, f]));
    const maintBy = Object.fromEntries(maint.map((m) => [m.vehicle_id, m.cost]));
    const OTHER = new Set(['TOLL', 'PARKING', 'INSURANCE', 'OTHER']);
    const expBy = {};
    for (const e of exp) {
      const b = (expBy[e.vehicle_id] ??= { maintenance: 0, other: 0 });
      if (e.expense_type === 'MAINTENANCE') b.maintenance += e.amount;
      else if (OTHER.has(e.expense_type)) b.other += e.amount;
    }

    let tRev = 0, tFuel = 0, tMaint = 0, tOther = 0, tAcq = 0, tDist = 0, tLiters = 0;
    const counts = { AVAILABLE: 0, ON_TRIP: 0, IN_SHOP: 0, RETIRED: 0 };

    const rows = vehicles.map((v) => {
      counts[v.status] = (counts[v.status] || 0) + 1;
      const revenue = revBy[v.id]?.revenue || 0;
      const trips = revBy[v.id]?.trips || 0;
      const f = fuelBy[v.id];
      const fuelCost = f?.cost || 0;
      const liters = f?.liters || 0;
      const distance = f && f.max_odo != null && f.min_odo != null ? f.max_odo - f.min_odo : 0;
      const efficiency = liters > 0 && distance > 0 ? distance / liters : null;
      const e = expBy[v.id] || { maintenance: 0, other: 0 };
      const maintenance = (maintBy[v.id] || 0) + e.maintenance;
      const other = e.other;
      const operatingCost = fuelCost + maintenance + other;
      const profit = revenue - operatingCost;
      // Spec ROI = (Revenue − (Maintenance + Fuel)) / Acquisition Cost
      const roi = v.acquisition_cost > 0 ? (revenue - (maintenance + fuelCost)) / v.acquisition_cost : null;

      tRev += revenue; tFuel += fuelCost; tMaint += maintenance; tOther += other;
      tAcq += v.acquisition_cost || 0; tDist += distance; tLiters += liters;

      return {
        vehicle_id: v.id,
        registration_number: v.registration_number,
        model: v.model,
        vehicle_type: v.vehicle_type,
        status: v.status,
        acquisition_cost: round(v.acquisition_cost),
        trips_completed: trips,
        revenue: round(revenue),
        fuel_cost: round(fuelCost),
        maintenance_cost: round(maintenance),
        other_expenses: round(other),
        operating_cost: round(operatingCost),
        profit: round(profit),
        roi_pct: roi == null ? null : round(roi * 100, 1),
        efficiency: efficiency == null ? null : round(efficiency, 2),
      };
    });

    rows.sort((a, b) => (b.roi_pct ?? -1e9) - (a.roi_pct ?? -1e9));

    const active = counts.AVAILABLE + counts.ON_TRIP;
    const fleet = {
      total_revenue: round(tRev),
      total_operating_cost: round(tFuel + tMaint + tOther),
      total_profit: round(tRev - (tFuel + tMaint + tOther)),
      fleet_roi_pct: tAcq > 0 ? round(((tRev - (tFuel + tMaint)) / tAcq) * 100, 1) : null,
      utilization_pct: active > 0 ? round((counts.ON_TRIP / active) * 100, 0) : 0,
      avg_efficiency: tLiters > 0 && tDist > 0 ? round(tDist / tLiters, 2) : null,
      total_acquisition: round(tAcq),
      counts,
      vehicle_count: vehicles.length,
    };

    res.json({ fleet, vehicles: rows });
  } catch (error) {
    console.error('Reports analytics error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
