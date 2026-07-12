import express from 'express';
import { query } from '../db.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);
const canManage = authorize('FLEET_MANAGER');

function serialize(m) {
  return { ...m, cost: Number(m.cost) };
}

// ── GET /api/maintenance — list with optional ?status, ?vehicle_id, ?search ──
router.get('/', async (req, res) => {
  try {
    const { status, vehicle_id, search } = req.query;
    const conditions = [];
    const params = [];

    if (status) {
      params.push(String(status).toUpperCase());
      conditions.push(`m.status = $${params.length}`);
    }
    if (vehicle_id) {
      params.push(vehicle_id);
      conditions.push(`m.vehicle_id = $${params.length}`);
    }
    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(m.description ILIKE $${params.length} OR m.maintenance_type ILIKE $${params.length} OR v.registration_number ILIKE $${params.length})`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await query(
      `SELECT m.*, v.registration_number, v.model AS vehicle_model,
              v.vehicle_type, v.status AS vehicle_status
       FROM maintenance_logs m
       LEFT JOIN vehicles v ON v.id = m.vehicle_id
       ${where}
       ORDER BY m.started_at DESC`,
      params
    );
    res.json({ records: rows.map(serialize) });
  } catch (error) {
    console.error('List maintenance error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ── GET /api/maintenance/analytics — aggregated stats ────────────────────────
router.get('/analytics', async (_req, res) => {
  try {
    // Basic counts
    const { rows: [counts] } = await query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'OPEN')::int AS open_count,
        COUNT(*) FILTER (WHERE status = 'COMPLETED')::int AS completed_count,
        COALESCE(SUM(cost), 0) AS total_cost,
        COALESCE(SUM(cost) FILTER (WHERE status = 'OPEN'), 0) AS open_cost,
        COALESCE(AVG(cost) FILTER (WHERE status = 'COMPLETED'), 0) AS avg_completed_cost,
        COALESCE(AVG(EXTRACT(EPOCH FROM (completed_at - started_at)) / 86400), 0) AS avg_downtime_days
      FROM maintenance_logs
      WHERE status = 'COMPLETED' AND completed_at IS NOT NULL AND started_at IS NOT NULL
    `);

    // Fetch total count (in case query above returned null for counts if no completed rows exist)
    const { rows: [allCounts] } = await query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'OPEN')::int AS open_count,
        COUNT(*) FILTER (WHERE status = 'COMPLETED')::int AS completed_count,
        COALESCE(SUM(cost), 0) AS total_cost,
        COALESCE(SUM(cost) FILTER (WHERE status = 'OPEN'), 0) AS open_cost
      FROM maintenance_logs
    `);

    const openCount = allCounts ? allCounts.open_count : 0;
    const totalCount = allCounts ? allCounts.total : 0;
    const completedCount = allCounts ? allCounts.completed_count : 0;
    const totalCostVal = allCounts ? Number(allCounts.total_cost) : 0;
    const openCostVal = allCounts ? Number(allCounts.open_cost) : 0;

    const avgCost = counts ? Number(counts.avg_completed_cost) : 0;
    const avgDowntime = counts ? Number(counts.avg_downtime_days) : 0;

    // Monthly cost trend (last 6 months)
    const { rows: costTrend } = await query(`
      SELECT to_char(date_trunc('month', started_at), 'Mon YYYY') AS month,
             COALESCE(SUM(cost), 0) AS total_cost,
             COUNT(*)::int AS count
      FROM maintenance_logs
      WHERE started_at >= NOW() - INTERVAL '6 months'
      GROUP BY date_trunc('month', started_at)
      ORDER BY date_trunc('month', started_at)
    `);

    // Top 5 vehicles by maintenance count
    const { rows: frequentVehicles } = await query(`
      SELECT v.registration_number, v.model, COUNT(*)::int AS maintenance_count,
             COALESCE(SUM(m.cost), 0) AS total_cost
      FROM maintenance_logs m
      JOIN vehicles v ON v.id = m.vehicle_id
      GROUP BY v.id, v.registration_number, v.model
      ORDER BY COUNT(*) DESC
      LIMIT 5
    `);

    // Status distribution of vehicles
    const { rows: fleetHealth } = await query(`
      SELECT status, COUNT(*)::int AS count FROM vehicles GROUP BY status
    `);

    // Generate insights
    const insights = [];
    if (openCount > 0) {
      insights.push({
        type: 'warning',
        title: `${openCount} Open Maintenance Record${openCount > 1 ? 's' : ''}`,
        text: `There ${openCount === 1 ? 'is' : 'are'} ${openCount} vehicle${openCount > 1 ? 's' : ''} currently in the shop. Review priority to minimize fleet downtime.`,
      });
    }

    if (avgDowntime > 5) {
      insights.push({
        type: 'alert',
        title: 'High Average Downtime',
        text: `Average maintenance takes ${avgDowntime.toFixed(1)} days. Consider parallel servicing or pre-stocking commonly needed parts.`,
      });
    } else if (avgDowntime > 0) {
      insights.push({
        type: 'success',
        title: 'Efficient Turnaround',
        text: `Average maintenance completes in ${avgDowntime.toFixed(1)} days — well within optimal range.`,
      });
    }

    if (frequentVehicles.length > 0 && frequentVehicles[0].maintenance_count >= 3) {
      const top = frequentVehicles[0];
      insights.push({
        type: 'alert',
        title: `Frequent Repairs: ${top.registration_number}`,
        text: `${top.model} has had ${top.maintenance_count} maintenance events costing ₹${Number(top.total_cost).toLocaleString('en-IN')}. Consider retirement evaluation.`,
      });
    }

    if (avgCost > 50000) {
      insights.push({
        type: 'warning',
        title: 'High Average Maintenance Cost',
        text: `Average completed maintenance costs ₹${avgCost.toLocaleString('en-IN', { maximumFractionDigits: 0 })}. Negotiate bulk service contracts to reduce expenses.`,
      });
    }

    if (costTrend.length >= 2) {
      const last = Number(costTrend[costTrend.length - 1].total_cost);
      const prev = Number(costTrend[costTrend.length - 2].total_cost);
      if (prev > 0 && last > prev * 1.3) {
        insights.push({
          type: 'warning',
          title: 'Rising Maintenance Costs',
          text: `Costs increased ${Math.round(((last - prev) / prev) * 100)}% compared to the previous month. Investigate root causes.`,
        });
      }
    }

    if (insights.length === 0) {
      insights.push({
        type: 'success',
        title: 'Fleet Health Looks Good',
        text: 'No critical maintenance patterns detected. Continue regular preventive maintenance schedules.',
      });
    }

    // Fleet health score (0-100)
    const totalVehicles = fleetHealth.reduce((s, r) => s + r.count, 0) || 1;
    const inShop = fleetHealth.find(r => r.status === 'IN_SHOP')?.count || 0;
    const retired = fleetHealth.find(r => r.status === 'RETIRED')?.count || 0;
    const activeFleet = totalVehicles - retired;
    const healthScore = activeFleet > 0 ? Math.round(((activeFleet - inShop) / activeFleet) * 100) : 100;

    res.json({
      counts: {
        total: totalCount,
        open: openCount,
        completed: completedCount,
        totalCost: totalCostVal,
        openCost: openCostVal,
        avgCompletedCost: avgCost,
        avgDowntimeDays: avgDowntime,
      },
      costTrend: costTrend.map(r => ({ month: r.month, cost: Number(r.total_cost), count: r.count })),
      frequentVehicles: frequentVehicles.map(r => ({ ...r, total_cost: Number(r.total_cost) })),
      fleetHealth,
      healthScore,
      insights,
    });
  } catch (error) {
    console.error('Maintenance analytics error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ── GET /api/maintenance/vehicles — vehicles eligible for maintenance ────────
router.get('/vehicles', async (_req, res) => {
  try {
    const { rows } = await query(
      `SELECT id, registration_number, model, vehicle_type, status
       FROM vehicles WHERE status != 'RETIRED'
       ORDER BY registration_number`
    );
    res.json({ vehicles: rows });
  } catch (error) {
    console.error('Maintenance vehicles error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ── GET /api/maintenance/:id ─────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT m.*, v.registration_number, v.model AS vehicle_model
       FROM maintenance_logs m
       LEFT JOIN vehicles v ON v.id = m.vehicle_id
       WHERE m.id = $1`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ message: 'Record not found' });
    res.json({ record: serialize(rows[0]) });
  } catch (error) {
    console.error('Get maintenance error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ── POST /api/maintenance — create record, set vehicle → IN_SHOP ────────────
router.post('/', canManage, async (req, res) => {
  const { vehicle_id, maintenance_type, description, cost } = req.body;

  if (!vehicle_id) return res.status(400).json({ message: 'Vehicle is required' });
  if (!maintenance_type?.trim()) return res.status(400).json({ message: 'Maintenance type is required' });
  if (!description?.trim()) return res.status(400).json({ message: 'Description is required' });
  const numCost = Number(cost || 0);
  if (numCost < 0) return res.status(400).json({ message: 'Cost must be non-negative' });

  try {
    // Verify vehicle exists and is not retired
    const { rows: vRows } = await query('SELECT status FROM vehicles WHERE id = $1', [vehicle_id]);
    if (!vRows[0]) return res.status(400).json({ message: 'Vehicle not found' });
    if (vRows[0].status === 'RETIRED') return res.status(400).json({ message: 'Cannot create maintenance for a retired vehicle' });
    if (vRows[0].status === 'ON_TRIP') return res.status(400).json({ message: 'Vehicle is currently on a trip — cannot create maintenance' });

    await query('BEGIN');
    try {
      const { rows } = await query(
        `INSERT INTO maintenance_logs (vehicle_id, maintenance_type, description, cost, status, started_at)
         VALUES ($1, $2, $3, $4, 'OPEN', now()) RETURNING *`,
        [vehicle_id, maintenance_type.trim(), description.trim(), numCost]
      );
      // Set vehicle → IN_SHOP
      await query(`UPDATE vehicles SET status = 'IN_SHOP', updated_at = now() WHERE id = $1`, [vehicle_id]);
      await query('COMMIT');

      // Re-fetch with join
      const { rows: full } = await query(
        `SELECT m.*, v.registration_number, v.model AS vehicle_model
         FROM maintenance_logs m LEFT JOIN vehicles v ON v.id = m.vehicle_id
         WHERE m.id = $1`,
        [rows[0].id]
      );
      res.status(201).json({ record: serialize(full[0]) });
    } catch (txErr) {
      await query('ROLLBACK');
      throw txErr;
    }
  } catch (error) {
    console.error('Create maintenance error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ── PATCH /api/maintenance/:id/close — OPEN → COMPLETED, vehicle → AVAILABLE ─
router.patch('/:id/close', canManage, async (req, res) => {
  const { cost } = req.body; // allow updating final cost on close

  try {
    const { rows: mRows } = await query('SELECT * FROM maintenance_logs WHERE id = $1', [req.params.id]);
    if (!mRows[0]) return res.status(404).json({ message: 'Record not found' });
    if (mRows[0].status !== 'OPEN') return res.status(400).json({ message: 'Record is already closed' });

    await query('BEGIN');
    try {
      const finalCost = cost != null ? Number(cost) : undefined;
      await query(
        `UPDATE maintenance_logs
         SET status = 'COMPLETED', completed_at = now()
             ${finalCost !== undefined ? ', cost = ' + finalCost : ''}
         WHERE id = $1`,
        [req.params.id]
      );

      // Restore vehicle to AVAILABLE only if not RETIRED
      const { rows: vRows } = await query('SELECT status FROM vehicles WHERE id = $1', [mRows[0].vehicle_id]);
      if (vRows[0] && vRows[0].status !== 'RETIRED') {
        // Check if there are other OPEN maintenance records for this vehicle
        const { rows: otherOpen } = await query(
          `SELECT 1 FROM maintenance_logs WHERE vehicle_id = $1 AND status = 'OPEN' AND id != $2 LIMIT 1`,
          [mRows[0].vehicle_id, req.params.id]
        );
        if (otherOpen.length === 0) {
          await query(`UPDATE vehicles SET status = 'AVAILABLE', updated_at = now() WHERE id = $1`, [mRows[0].vehicle_id]);
        }
      }
      await query('COMMIT');
    } catch (txErr) {
      await query('ROLLBACK');
      throw txErr;
    }

    const { rows: full } = await query(
      `SELECT m.*, v.registration_number, v.model AS vehicle_model
       FROM maintenance_logs m LEFT JOIN vehicles v ON v.id = m.vehicle_id
       WHERE m.id = $1`,
      [req.params.id]
    );
    res.json({ record: serialize(full[0]) });
  } catch (error) {
    console.error('Close maintenance error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
