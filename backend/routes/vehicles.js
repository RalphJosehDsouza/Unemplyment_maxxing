import express from 'express';
import { query } from '../db.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

const VEHICLE_STATUSES = ['AVAILABLE', 'ON_TRIP', 'IN_SHOP', 'RETIRED'];

// All vehicle routes require authentication.
router.use(authenticate);

// Roles allowed to mutate the registry. Reads are open to any authenticated user.
const canManage = authorize('FLEET_MANAGER');

// Normalises a DB row's numeric strings (pg returns NUMERIC as strings) into numbers.
function serialize(v) {
  return {
    ...v,
    max_load_capacity: Number(v.max_load_capacity),
    current_odometer: Number(v.current_odometer),
    acquisition_cost: Number(v.acquisition_cost),
  };
}

function validateVehicle(body, { partial = false } = {}) {
  const errors = [];
  const out = {};

  const req = (key) => body[key] !== undefined && body[key] !== null && body[key] !== '';

  if (!partial || req('registration_number')) {
    const reg = String(body.registration_number || '').trim().toUpperCase();
    if (!reg) errors.push('Registration number is required');
    else out.registration_number = reg;
  }
  if (!partial || req('model')) {
    const model = String(body.model || '').trim();
    if (!model) errors.push('Model is required');
    else out.model = model;
  }
  if (!partial || req('vehicle_type')) {
    const type = String(body.vehicle_type || '').trim();
    if (!type) errors.push('Vehicle type is required');
    else out.vehicle_type = type;
  }
  if (!partial || req('max_load_capacity')) {
    const cap = Number(body.max_load_capacity);
    if (!Number.isFinite(cap) || cap < 0) errors.push('Max load capacity must be a non-negative number');
    else out.max_load_capacity = cap;
  }
  if (req('current_odometer')) {
    const odo = Number(body.current_odometer);
    if (!Number.isFinite(odo) || odo < 0) errors.push('Odometer must be a non-negative number');
    else out.current_odometer = odo;
  }
  if (req('acquisition_cost')) {
    const cost = Number(body.acquisition_cost);
    if (!Number.isFinite(cost) || cost < 0) errors.push('Acquisition cost must be a non-negative number');
    else out.acquisition_cost = cost;
  }
  if (req('status')) {
    const status = String(body.status).toUpperCase();
    if (!VEHICLE_STATUSES.includes(status)) errors.push(`Status must be one of ${VEHICLE_STATUSES.join(', ')}`);
    else out.status = status;
  }

  return { errors, out };
}

// GET /api/vehicles — list with optional ?status, ?type, ?search
router.get('/', async (req, res) => {
  try {
    const { status, type, search } = req.query;
    const conditions = [];
    const params = [];

    if (status) {
      params.push(String(status).toUpperCase());
      conditions.push(`status = $${params.length}`);
    }
    if (type) {
      params.push(String(type));
      conditions.push(`vehicle_type ILIKE $${params.length}`);
    }
    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(registration_number ILIKE $${params.length} OR model ILIKE $${params.length})`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await query(
      `SELECT * FROM vehicles ${where} ORDER BY created_at DESC`,
      params
    );
    res.json({ vehicles: rows.map(serialize) });
  } catch (error) {
    console.error('List vehicles error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/vehicles/:id
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await query('SELECT * FROM vehicles WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ message: 'Vehicle not found' });
    res.json({ vehicle: serialize(rows[0]) });
  } catch (error) {
    console.error('Get vehicle error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/vehicles
router.post('/', canManage, async (req, res) => {
  const { errors, out } = validateVehicle(req.body);
  if (errors.length) return res.status(400).json({ message: errors[0], errors });

  try {
    const { rows } = await query(
      `INSERT INTO vehicles (registration_number, model, vehicle_type, max_load_capacity, current_odometer, acquisition_cost, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        out.registration_number,
        out.model,
        out.vehicle_type,
        out.max_load_capacity,
        out.current_odometer ?? 0,
        out.acquisition_cost ?? 0,
        out.status ?? 'AVAILABLE',
      ]
    );
    res.status(201).json({ vehicle: serialize(rows[0]) });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ message: 'A vehicle with this registration number already exists' });
    }
    console.error('Create vehicle error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT /api/vehicles/:id
router.put('/:id', canManage, async (req, res) => {
  const { errors, out } = validateVehicle(req.body, { partial: true });
  if (errors.length) return res.status(400).json({ message: errors[0], errors });

  const keys = Object.keys(out);
  if (!keys.length) return res.status(400).json({ message: 'No valid fields to update' });

  const setClauses = keys.map((k, i) => `${k} = $${i + 1}`);
  const params = keys.map((k) => out[k]);
  params.push(req.params.id);

  try {
    const { rows } = await query(
      `UPDATE vehicles SET ${setClauses.join(', ')}, updated_at = now()
       WHERE id = $${params.length}
       RETURNING *`,
      params
    );
    if (!rows[0]) return res.status(404).json({ message: 'Vehicle not found' });
    res.json({ vehicle: serialize(rows[0]) });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ message: 'A vehicle with this registration number already exists' });
    }
    console.error('Update vehicle error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /api/vehicles/:id — blocked if the vehicle is on an active trip or has open maintenance.
router.delete('/:id', canManage, async (req, res) => {
  try {
    const { rows: existing } = await query('SELECT status FROM vehicles WHERE id = $1', [req.params.id]);
    if (!existing[0]) return res.status(404).json({ message: 'Vehicle not found' });

    if (existing[0].status === 'ON_TRIP') {
      return res.status(409).json({ message: 'Cannot delete a vehicle that is currently on a trip' });
    }

    const { rows: openMaint } = await query(
      `SELECT 1 FROM maintenance_logs WHERE vehicle_id = $1 AND status = 'OPEN' LIMIT 1`,
      [req.params.id]
    );
    if (openMaint.length) {
      return res.status(409).json({ message: 'Cannot delete a vehicle with an open maintenance record' });
    }

    await query('DELETE FROM vehicles WHERE id = $1', [req.params.id]);
    res.json({ message: 'Vehicle deleted' });
  } catch (error) {
    console.error('Delete vehicle error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
