// Seeds realistic fuel logs for the Fuel Management demo.
// Standalone (does not touch the shared seed.js). Idempotent for the vehicles it targets.
import { pool } from '../db.js';

// Two refuels per month across five COMPLETE months (today ≈ 2026-07-12, so
// June is the last full month). Complete months keep the monthly-spend trend
// clean, so the forecast for Jul/Aug is meaningful rather than skewed by a
// half-finished current month.
const DATES = [
  '2026-02-08', '2026-02-24', '2026-03-08', '2026-03-24', '2026-04-08',
  '2026-04-24', '2026-05-09', '2026-05-25', '2026-06-09', '2026-06-25',
];

// Price per litre drifts up over the period (fuel inflation) → a rising forecast.
const priceAt = (i) => 94 + i * 1.4;

const profiles = [
  { key: 'stable',    baseOdo: 42000, liters: 45, eff: (i) => 13.8 + ((i % 3) - 1) * 0.2 }, // healthy, ~14 km/L
  { key: 'degrading', baseOdo: 19000, liters: 55, eff: (i) => 12.2 - i * 0.45 },            // 12.2 → ~8.6 km/L
  { key: 'spike',     baseOdo: 63000, liters: 60, eff: (i) => 9.5 + (i % 2 ? 0.2 : -0.2) }, // steady, last fill overpriced
];

async function seedFuel() {
  const client = await pool.connect();
  try {
    const { rows: vehicles } = await client.query(
      `SELECT id, registration_number FROM vehicles ORDER BY created_at ASC LIMIT 3`
    );
    if (vehicles.length < 1) {
      console.log('No vehicles found — seed vehicles first.');
      return;
    }

    await client.query('BEGIN');
    // Clean slate for demo data so re-runs never leave orphaned logs on
    // previously-seeded vehicles (the target set can shift between runs).
    await client.query(`DELETE FROM fuel_logs`);

    let inserted = 0;
    for (const [vi, v] of vehicles.entries()) {
      const p = profiles[vi % profiles.length];
      let odo = p.baseOdo;
      for (let i = 0; i < DATES.length; i++) {
        const liters = p.liters + (i % 2 ? 3 : -2);
        let price = priceAt(i);
        if (p.key === 'spike' && i === DATES.length - 1) price *= 1.45; // anomalous refuel
        if (i > 0) odo += Math.round(p.eff(i) * liters); // distance for this interval
        const cost = Math.round(liters * price);
        await client.query(
          `INSERT INTO fuel_logs (vehicle_id, liters, cost, odometer, filled_at)
           VALUES ($1, $2, $3, $4, $5::timestamp)`,
          [v.id, liters, cost, odo, DATES[i]]
        );
        inserted++;
      }
      console.log(`Fuel: ${v.registration_number} → ${DATES.length} fills (${p.key})`);
    }

    // ── Expenses + one maintenance record per vehicle (operational-cost composition) ──
    await client.query(`DELETE FROM expenses`);
    await client.query(`DELETE FROM maintenance_logs WHERE maintenance_type LIKE 'Seed:%'`);
    const tollDates = ['2026-03-10', '2026-04-15', '2026-05-20', '2026-06-12'];
    for (const [vi, v] of vehicles.entries()) {
      await client.query(
        `INSERT INTO expenses (vehicle_id, expense_type, amount, description, expense_date)
         VALUES ($1, 'INSURANCE', $2, 'Annual policy', $3::timestamp)`,
        [v.id, 11000 + vi * 1500, `2026-02-0${vi + 2}`]
      );
      for (let i = 0; i < tollDates.length; i++) {
        await client.query(
          `INSERT INTO expenses (vehicle_id, expense_type, amount, description, expense_date)
           VALUES ($1, 'TOLL', $2, 'Highway toll', $3::timestamp)`,
          [v.id, 220 + i * 30 + vi * 15, tollDates[i]]
        );
      }
      await client.query(
        `INSERT INTO expenses (vehicle_id, expense_type, amount, description, expense_date)
         VALUES ($1, 'PARKING', $2, 'Depot parking', '2026-05-05'::timestamp)`,
        [v.id, 130 + vi * 20]
      );
      await client.query(
        `INSERT INTO maintenance_logs (vehicle_id, maintenance_type, description, cost, started_at, completed_at, status)
         VALUES ($1, 'Seed: Scheduled Service', 'Oil + filter change', $2, '2026-04-01'::timestamp, '2026-04-02'::timestamp, 'COMPLETED')`,
        [v.id, 3000 + vi * 900]
      );
    }

    // ── Completed trips with revenue (for ROI / profitability reports) ──
    // Seed trips are marked by created_by IS NULL + revenue > 0 so re-runs are
    // idempotent and never touch trips created through the UI.
    const { rows: drivers } = await client.query(`SELECT id FROM drivers LIMIT 6`);
    await client.query(`DELETE FROM trips WHERE created_by IS NULL AND status = 'COMPLETED' AND revenue > 0`);
    let tripCount = 0;
    if (drivers.length) {
      const tripRoutes = [
        ['Mumbai', 'Pune', 148], ['Pune', 'Nashik', 210], ['Mumbai', 'Surat', 280],
        ['Nagpur', 'Pune', 710], ['Mumbai', 'Nashik', 167], ['Pune', 'Aurangabad', 235],
      ];
      // ~8 completed trips per vehicle over the period so revenue is realistic
      // against 5 months of fuel — yields a mix of profitable and loss-making vehicles.
      const TRIPS_PER_VEHICLE = 8;
      const rate = 48; // ₹ per km
      for (const [vi, v] of vehicles.entries()) {
        for (let j = 0; j < TRIPS_PER_VEHICLE; j++) {
          const [src, dst, dist] = tripRoutes[(vi * 3 + j) % tripRoutes.length];
          const driver = drivers[(vi + j) % drivers.length];
          await client.query(
            `INSERT INTO trips (vehicle_id, driver_id, source, destination, cargo_weight, planned_distance, actual_distance, revenue, status, actual_start, actual_end)
             VALUES ($1, $2, $3, $4, 300, $5, $5, $6, 'COMPLETED', '2026-06-05'::timestamp, '2026-06-06'::timestamp)`,
            [v.id, driver.id, src, dst, dist, Math.round(dist * rate)]
          );
          tripCount++;
        }
      }
    }

    await client.query('COMMIT');
    console.log(`Seeded ${inserted} fuel logs + expenses, maintenance & ${tripCount} revenue trips across ${vehicles.length} vehicles.`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Fuel seed failed:', error.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

seedFuel();
