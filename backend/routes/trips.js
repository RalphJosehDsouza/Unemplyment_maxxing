import express from 'express';
import { query } from '../db.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

const TRIP_STATUSES = ['DRAFT', 'DISPATCHED', 'COMPLETED', 'CANCELLED'];

// All trip routes require authentication.
router.use(authenticate);

// Roles that can manage trips. Reads are open to any authenticated user.
const canManage = authorize('FLEET_MANAGER');

// Normalises numeric strings from pg into numbers.
function serialize(t) {
  return {
    ...t,
    cargo_weight: Number(t.cargo_weight),
    planned_distance: Number(t.planned_distance),
    actual_distance: t.actual_distance != null ? Number(t.actual_distance) : null,
    start_odometer: t.start_odometer != null ? Number(t.start_odometer) : null,
    end_odometer: t.end_odometer != null ? Number(t.end_odometer) : null,
    fuel_used: t.fuel_used != null ? Number(t.fuel_used) : null,
    revenue: Number(t.revenue),
  };
}

// ── GET /api/trips — list with optional ?status, ?search filters ────────────
router.get('/', async (req, res) => {
  try {
    const { status, search } = req.query;
    const conditions = [];
    const params = [];

    if (status) {
      params.push(String(status).toUpperCase());
      conditions.push(`t.status = $${params.length}`);
    }
    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(t.source ILIKE $${params.length} OR t.destination ILIKE $${params.length})`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await query(
      `SELECT t.*,
              v.registration_number AS vehicle_registration,
              v.model               AS vehicle_model,
              v.max_load_capacity    AS vehicle_capacity,
              d.name                AS driver_name,
              d.contact_number      AS driver_contact,
              u.name                AS created_by_name
       FROM trips t
       LEFT JOIN vehicles v ON v.id = t.vehicle_id
       LEFT JOIN drivers  d ON d.id = t.driver_id
       LEFT JOIN users    u ON u.id = t.created_by
       ${where}
       ORDER BY t.created_at DESC`,
      params
    );
    res.json({ trips: rows.map(serialize) });
  } catch (error) {
    console.error('List trips error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ── GET /api/trips/available-vehicles — vehicles that can be assigned ────────
router.get('/available-vehicles', async (_req, res) => {
  try {
    const { rows } = await query(
      `SELECT id, registration_number, model, vehicle_type, max_load_capacity, current_odometer
       FROM vehicles
       WHERE status = 'AVAILABLE'
       ORDER BY registration_number`
    );
    res.json({
      vehicles: rows.map((v) => ({
        ...v,
        max_load_capacity: Number(v.max_load_capacity),
        current_odometer: Number(v.current_odometer),
      })),
    });
  } catch (error) {
    console.error('Available vehicles error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ── GET /api/trips/available-drivers — drivers that can be assigned ──────────
router.get('/available-drivers', async (_req, res) => {
  try {
    const { rows } = await query(
      `SELECT id, name, license_number, license_category, license_expiry, contact_number, safety_score
       FROM drivers
       WHERE status = 'AVAILABLE'
         AND license_expiry > CURRENT_DATE
       ORDER BY name`
    );
    res.json({ drivers: rows });
  } catch (error) {
    console.error('Available drivers error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ── GET /api/trips/:id ──────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT t.*,
              v.registration_number AS vehicle_registration,
              v.model               AS vehicle_model,
              v.max_load_capacity    AS vehicle_capacity,
              d.name                AS driver_name,
              d.contact_number      AS driver_contact,
              u.name                AS created_by_name
       FROM trips t
       LEFT JOIN vehicles v ON v.id = t.vehicle_id
       LEFT JOIN drivers  d ON d.id = t.driver_id
       LEFT JOIN users    u ON u.id = t.created_by
       WHERE t.id = $1`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ message: 'Trip not found' });
    res.json({ trip: serialize(rows[0]) });
  } catch (error) {
    console.error('Get trip error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ── POST /api/trips — create a DRAFT trip ───────────────────────────────────
router.post('/', canManage, async (req, res) => {
  const { source, destination, vehicle_id, driver_id, cargo_weight, planned_distance, revenue } = req.body;

  // Validate required fields
  if (!source?.trim() || !destination?.trim()) {
    return res.status(400).json({ message: 'Source and destination are required' });
  }
  const weight = Number(cargo_weight || 0);
  const distance = Number(planned_distance || 0);
  const rev = Number(revenue || 0);

  if (weight < 0) return res.status(400).json({ message: 'Cargo weight must be non-negative' });
  if (distance < 0) return res.status(400).json({ message: 'Planned distance must be non-negative' });

  // Validate vehicle capacity if both vehicle and weight provided
  if (vehicle_id && weight > 0) {
    const { rows: vRows } = await query('SELECT max_load_capacity, status FROM vehicles WHERE id = $1', [vehicle_id]);
    if (!vRows[0]) return res.status(400).json({ message: 'Vehicle not found' });
    if (vRows[0].status !== 'AVAILABLE') {
      return res.status(400).json({ message: 'Selected vehicle is not available' });
    }
    if (weight > Number(vRows[0].max_load_capacity)) {
      return res.status(400).json({
        message: `Cargo weight (${weight} kg) exceeds vehicle capacity (${Number(vRows[0].max_load_capacity)} kg)`,
      });
    }
  }

  // Validate driver availability
  if (driver_id) {
    const { rows: dRows } = await query('SELECT status, license_expiry FROM drivers WHERE id = $1', [driver_id]);
    if (!dRows[0]) return res.status(400).json({ message: 'Driver not found' });
    if (dRows[0].status !== 'AVAILABLE') {
      return res.status(400).json({ message: 'Selected driver is not available' });
    }
    if (new Date(dRows[0].license_expiry) <= new Date()) {
      return res.status(400).json({ message: 'Selected driver has an expired license' });
    }
  }

  try {
    const { rows } = await query(
      `INSERT INTO trips (source, destination, vehicle_id, driver_id, created_by, cargo_weight, planned_distance, revenue, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'DRAFT')
       RETURNING *`,
      [source.trim(), destination.trim(), vehicle_id || null, driver_id || null, req.user.userId, weight, distance, rev]
    );
    res.status(201).json({ trip: serialize(rows[0]) });
  } catch (error) {
    console.error('Create trip error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ── PATCH /api/trips/:id/dispatch — move DRAFT → DISPATCHED ─────────────────
router.patch('/:id/dispatch', canManage, async (req, res) => {
  try {
    const { rows: tripRows } = await query('SELECT * FROM trips WHERE id = $1', [req.params.id]);
    if (!tripRows[0]) return res.status(404).json({ message: 'Trip not found' });
    const trip = tripRows[0];

    if (trip.status !== 'DRAFT') {
      return res.status(400).json({ message: `Cannot dispatch a trip with status "${trip.status}"` });
    }
    if (!trip.vehicle_id) {
      return res.status(400).json({ message: 'A vehicle must be assigned before dispatch' });
    }
    if (!trip.driver_id) {
      return res.status(400).json({ message: 'A driver must be assigned before dispatch' });
    }

    // Re-validate vehicle & driver availability at dispatch time
    const { rows: vRows } = await query('SELECT status, max_load_capacity, current_odometer FROM vehicles WHERE id = $1', [trip.vehicle_id]);
    if (!vRows[0] || vRows[0].status !== 'AVAILABLE') {
      return res.status(400).json({ message: 'Assigned vehicle is no longer available' });
    }

    // Validate cargo weight at dispatch time
    const weight = Number(trip.cargo_weight);
    if (weight > Number(vRows[0].max_load_capacity)) {
      return res.status(400).json({
        message: `Cargo weight (${weight} kg) exceeds vehicle capacity (${Number(vRows[0].max_load_capacity)} kg) — dispatch blocked`,
      });
    }

    const { rows: dRows } = await query('SELECT status, license_expiry FROM drivers WHERE id = $1', [trip.driver_id]);
    if (!dRows[0] || dRows[0].status !== 'AVAILABLE') {
      return res.status(400).json({ message: 'Assigned driver is no longer available' });
    }
    if (new Date(dRows[0].license_expiry) <= new Date()) {
      return res.status(400).json({ message: 'Driver license has expired' });
    }

    // Atomic update: trip → DISPATCHED, vehicle → ON_TRIP, driver → ON_TRIP
    const startOdometer = Number(vRows[0].current_odometer);
    await query('BEGIN');
    try {
      await query(
        `UPDATE trips SET status = 'DISPATCHED', start_odometer = $2, updated_at = now() WHERE id = $1`,
        [trip.id, startOdometer]
      );
      await query(`UPDATE vehicles SET status = 'ON_TRIP', updated_at = now() WHERE id = $1`, [trip.vehicle_id]);
      await query(`UPDATE drivers  SET status = 'ON_TRIP', updated_at = now() WHERE id = $1`, [trip.driver_id]);
      await query('COMMIT');
    } catch (txErr) {
      await query('ROLLBACK');
      throw txErr;
    }

    // Return the updated trip with joins
    const { rows: updated } = await query(
      `SELECT t.*,
              v.registration_number AS vehicle_registration,
              v.model               AS vehicle_model,
              v.max_load_capacity    AS vehicle_capacity,
              d.name                AS driver_name,
              d.contact_number      AS driver_contact
       FROM trips t
       LEFT JOIN vehicles v ON v.id = t.vehicle_id
       LEFT JOIN drivers  d ON d.id = t.driver_id
       WHERE t.id = $1`,
      [trip.id]
    );
    res.json({ trip: serialize(updated[0]) });
  } catch (error) {
    console.error('Dispatch trip error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ── PATCH /api/trips/:id/complete — move DISPATCHED → COMPLETED ─────────────
router.patch('/:id/complete', canManage, async (req, res) => {
  const { actual_distance, end_odometer, fuel_used, revenue } = req.body;

  try {
    const { rows: tripRows } = await query('SELECT * FROM trips WHERE id = $1', [req.params.id]);
    if (!tripRows[0]) return res.status(404).json({ message: 'Trip not found' });
    const trip = tripRows[0];

    if (trip.status !== 'DISPATCHED') {
      return res.status(400).json({ message: `Cannot complete a trip with status "${trip.status}"` });
    }

    await query('BEGIN');
    try {
      // Update the trip
      await query(
        `UPDATE trips
         SET status = 'COMPLETED',
             actual_distance = COALESCE($2, actual_distance),
             end_odometer    = COALESCE($3, end_odometer),
             fuel_used       = COALESCE($4, fuel_used),
             revenue         = COALESCE($5, revenue),
             updated_at      = now()
         WHERE id = $1`,
        [
          trip.id,
          actual_distance != null ? Number(actual_distance) : null,
          end_odometer != null ? Number(end_odometer) : null,
          fuel_used != null ? Number(fuel_used) : null,
          revenue != null ? Number(revenue) : null,
        ]
      );

      // Update vehicle odometer if end_odometer is provided
      if (end_odometer != null && trip.vehicle_id) {
        await query(
          `UPDATE vehicles SET status = 'AVAILABLE', current_odometer = $2, updated_at = now() WHERE id = $1`,
          [trip.vehicle_id, Number(end_odometer)]
        );
      } else if (trip.vehicle_id) {
        await query(`UPDATE vehicles SET status = 'AVAILABLE', updated_at = now() WHERE id = $1`, [trip.vehicle_id]);
      }

      // Restore driver availability
      if (trip.driver_id) {
        await query(`UPDATE drivers SET status = 'AVAILABLE', updated_at = now() WHERE id = $1`, [trip.driver_id]);
      }

      await query('COMMIT');
    } catch (txErr) {
      await query('ROLLBACK');
      throw txErr;
    }

    const { rows: updated } = await query(
      `SELECT t.*,
              v.registration_number AS vehicle_registration,
              v.model               AS vehicle_model,
              v.max_load_capacity    AS vehicle_capacity,
              d.name                AS driver_name,
              d.contact_number      AS driver_contact
       FROM trips t
       LEFT JOIN vehicles v ON v.id = t.vehicle_id
       LEFT JOIN drivers  d ON d.id = t.driver_id
       WHERE t.id = $1`,
      [trip.id]
    );
    res.json({ trip: serialize(updated[0]) });
  } catch (error) {
    console.error('Complete trip error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ── PATCH /api/trips/:id/cancel — move DRAFT|DISPATCHED → CANCELLED ─────────
router.patch('/:id/cancel', canManage, async (req, res) => {
  try {
    const { rows: tripRows } = await query('SELECT * FROM trips WHERE id = $1', [req.params.id]);
    if (!tripRows[0]) return res.status(404).json({ message: 'Trip not found' });
    const trip = tripRows[0];

    if (!['DRAFT', 'DISPATCHED'].includes(trip.status)) {
      return res.status(400).json({ message: `Cannot cancel a trip with status "${trip.status}"` });
    }

    await query('BEGIN');
    try {
      await query(`UPDATE trips SET status = 'CANCELLED', updated_at = now() WHERE id = $1`, [trip.id]);

      // Restore vehicle/driver only if the trip was DISPATCHED (they were set to ON_TRIP)
      if (trip.status === 'DISPATCHED') {
        if (trip.vehicle_id) {
          await query(`UPDATE vehicles SET status = 'AVAILABLE', updated_at = now() WHERE id = $1`, [trip.vehicle_id]);
        }
        if (trip.driver_id) {
          await query(`UPDATE drivers SET status = 'AVAILABLE', updated_at = now() WHERE id = $1`, [trip.driver_id]);
        }
      }

      await query('COMMIT');
    } catch (txErr) {
      await query('ROLLBACK');
      throw txErr;
    }

    const { rows: updated } = await query(
      `SELECT t.*,
              v.registration_number AS vehicle_registration,
              v.model               AS vehicle_model,
              v.max_load_capacity    AS vehicle_capacity,
              d.name                AS driver_name,
              d.contact_number      AS driver_contact
       FROM trips t
       LEFT JOIN vehicles v ON v.id = t.vehicle_id
       LEFT JOIN drivers  d ON d.id = t.driver_id
       WHERE t.id = $1`,
      [trip.id]
    );
    res.json({ trip: serialize(updated[0]) });
  } catch (error) {
    console.error('Cancel trip error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
