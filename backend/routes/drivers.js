import express from 'express';
import { query } from '../db.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

const DRIVER_STATUSES = ['AVAILABLE', 'ON_TRIP', 'OFF_DUTY', 'SUSPENDED'];

// Column list — casts DATE to a stable YYYY-MM-DD string, normalises the
// numeric safety_score to an int, and computes license_expired.
const COLS = `id, name, license_number, license_category,
  to_char(license_expiry, 'YYYY-MM-DD') AS license_expiry,
  contact_number, safety_score::int AS safety_score, status,
  (license_expiry < CURRENT_DATE) AS license_expired,
  created_at, updated_at`;

router.use(authenticate);

// Fleet Managers and Safety Officers manage drivers (ADMIN passes via authorize).
const canManage = authorize('FLEET_MANAGER', 'SAFETY_OFFICER');

function validateDriver(body, { partial = false } = {}) {
  const errors = [];
  const out = {};
  const has = (k) => body[k] !== undefined && body[k] !== null && body[k] !== '';

  if (!partial || has('name')) {
    const name = String(body.name || '').trim();
    if (!name) errors.push('Name is required');
    else out.name = name;
  }
  if (!partial || has('license_number')) {
    const lic = String(body.license_number || '').trim().toUpperCase();
    if (!lic) errors.push('License number is required');
    else out.license_number = lic;
  }
  if (!partial || has('license_expiry')) {
    const raw = String(body.license_expiry || '').trim();
    // Expect YYYY-MM-DD; validate it parses to a real date.
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw) || Number.isNaN(Date.parse(raw))) {
      errors.push('License expiry must be a valid date (YYYY-MM-DD)');
    } else {
      out.license_expiry = raw;
    }
  }
  // license_category is NOT NULL in the DB, so it is required on create.
  if (!partial || has('license_category')) {
    const cat = String(body.license_category || '').trim();
    if (!cat) errors.push('License category is required');
    else out.license_category = cat;
  }
  if (has('contact_number')) out.contact_number = String(body.contact_number).trim();
  if (has('safety_score')) {
    const s = Number(body.safety_score);
    if (!Number.isInteger(s) || s < 0 || s > 100) errors.push('Safety score must be an integer between 0 and 100');
    else out.safety_score = s;
  }
  if (has('status')) {
    const st = String(body.status).toUpperCase();
    if (!DRIVER_STATUSES.includes(st)) errors.push(`Status must be one of ${DRIVER_STATUSES.join(', ')}`);
    else out.status = st;
  }

  return { errors, out };
}

// GET /api/drivers — filters: ?status, ?search (name/license), ?expiring=true (<=30 days or already expired)
router.get('/', async (req, res) => {
  try {
    const { status, search, expiring } = req.query;
    const conditions = [];
    const params = [];

    if (status) {
      params.push(String(status).toUpperCase());
      conditions.push(`status = $${params.length}`);
    }
    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(name ILIKE $${params.length} OR license_number ILIKE $${params.length})`);
    }
    if (expiring === 'true') {
      conditions.push(`license_expiry <= CURRENT_DATE + INTERVAL '30 days'`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await query(`SELECT ${COLS} FROM drivers ${where} ORDER BY created_at DESC`, params);
    res.json({ drivers: rows });
  } catch (error) {
    console.error('List drivers error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/drivers/:id
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await query(`SELECT ${COLS} FROM drivers WHERE id = $1`, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ message: 'Driver not found' });
    res.json({ driver: rows[0] });
  } catch (error) {
    console.error('Get driver error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/drivers
router.post('/', canManage, async (req, res) => {
  const { errors, out } = validateDriver(req.body);
  if (errors.length) return res.status(400).json({ message: errors[0], errors });

  try {
    const { rows } = await query(
      `INSERT INTO drivers (name, license_number, license_category, license_expiry, contact_number, safety_score, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING ${COLS}`,
      [
        out.name,
        out.license_number,
        out.license_category,
        out.license_expiry,
        out.contact_number ?? null,
        out.safety_score ?? 100,
        out.status ?? 'AVAILABLE',
      ]
    );
    res.status(201).json({ driver: rows[0] });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ message: 'A driver with this license number already exists' });
    }
    console.error('Create driver error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT /api/drivers/:id
router.put('/:id', canManage, async (req, res) => {
  const { errors, out } = validateDriver(req.body, { partial: true });
  if (errors.length) return res.status(400).json({ message: errors[0], errors });

  const keys = Object.keys(out);
  if (!keys.length) return res.status(400).json({ message: 'No valid fields to update' });

  const setClauses = keys.map((k, i) => `${k} = $${i + 1}`);
  const params = keys.map((k) => out[k]);
  params.push(req.params.id);

  try {
    const { rows } = await query(
      `UPDATE drivers SET ${setClauses.join(', ')}, updated_at = now()
       WHERE id = $${params.length}
       RETURNING ${COLS}`,
      params
    );
    if (!rows[0]) return res.status(404).json({ message: 'Driver not found' });
    res.json({ driver: rows[0] });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ message: 'A driver with this license number already exists' });
    }
    console.error('Update driver error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /api/drivers/:id — blocked while the driver is on an active trip.
router.delete('/:id', canManage, async (req, res) => {
  try {
    const { rows } = await query('SELECT status FROM drivers WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ message: 'Driver not found' });
    if (rows[0].status === 'ON_TRIP') {
      return res.status(409).json({ message: 'Cannot delete a driver who is currently on a trip' });
    }
    await query('DELETE FROM drivers WHERE id = $1', [req.params.id]);
    res.json({ message: 'Driver deleted' });
  } catch (error) {
    console.error('Delete driver error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
