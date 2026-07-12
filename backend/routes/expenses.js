import express from 'express';
import { query } from '../db.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

const EXPENSE_TYPES = ['FUEL', 'MAINTENANCE', 'TOLL', 'PARKING', 'INSURANCE', 'OTHER'];

router.use(authenticate);
const canManage = authorize('FLEET_MANAGER', 'FINANCIAL_ANALYST');

const serialize = (r) => ({ ...r, amount: Number(r.amount) });

// GET /api/expenses — list (optional ?vehicle_id, ?type)
router.get('/', async (req, res) => {
  try {
    const { vehicle_id, type } = req.query;
    const params = [];
    const cond = [];
    if (vehicle_id) {
      params.push(vehicle_id);
      cond.push(`e.vehicle_id = $${params.length}`);
    }
    if (type) {
      params.push(String(type).toUpperCase());
      cond.push(`e.expense_type = $${params.length}`);
    }
    const where = cond.length ? `WHERE ${cond.join(' AND ')}` : '';
    const { rows } = await query(
      `SELECT e.id, e.vehicle_id, e.trip_id, e.expense_type, e.amount, e.description,
              to_char(e.expense_date, 'YYYY-MM-DD') AS expense_date,
              v.registration_number, v.model
       FROM expenses e JOIN vehicles v ON v.id = e.vehicle_id
       ${where}
       ORDER BY e.expense_date DESC NULLS LAST`,
      params
    );
    res.json({ expenses: rows.map(serialize) });
  } catch (error) {
    console.error('List expenses error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/expenses
router.post('/', canManage, async (req, res) => {
  const { vehicle_id, expense_type, amount, description, expense_date } = req.body;
  const errors = [];

  if (!vehicle_id) errors.push('Vehicle is required');
  const type = String(expense_type || '').toUpperCase();
  if (!EXPENSE_TYPES.includes(type)) errors.push(`Expense type must be one of ${EXPENSE_TYPES.join(', ')}`);
  const amt = Number(amount);
  if (!Number.isFinite(amt) || amt < 0) errors.push('Amount must be a non-negative number');
  const date = expense_date && /^\d{4}-\d{2}-\d{2}$/.test(expense_date) ? expense_date : null;

  if (errors.length) return res.status(400).json({ message: errors[0], errors });

  try {
    const veh = await query('SELECT id FROM vehicles WHERE id = $1', [vehicle_id]);
    if (!veh.rows[0]) return res.status(404).json({ message: 'Vehicle not found' });

    const { rows } = await query(
      `INSERT INTO expenses (vehicle_id, expense_type, amount, description, expense_date)
       VALUES ($1, $2, $3, $4, COALESCE($5::timestamp, now()))
       RETURNING id, vehicle_id, trip_id, expense_type, amount, description,
                 to_char(expense_date, 'YYYY-MM-DD') AS expense_date`,
      [vehicle_id, type, amt, description?.trim() || null, date]
    );
    res.status(201).json({ expense: serialize(rows[0]) });
  } catch (error) {
    console.error('Create expense error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /api/expenses/:id
router.delete('/:id', canManage, async (req, res) => {
  try {
    const { rowCount } = await query('DELETE FROM expenses WHERE id = $1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ message: 'Expense not found' });
    res.json({ message: 'Expense deleted' });
  } catch (error) {
    console.error('Delete expense error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
