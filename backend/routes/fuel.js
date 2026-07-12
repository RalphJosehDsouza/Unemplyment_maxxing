import express from 'express';
import { query } from '../db.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

// Fleet Managers and Financial Analysts record/manage fuel (ADMIN passes via authorize).
const canManage = authorize('FLEET_MANAGER', 'FINANCIAL_ANALYST');

const round = (n, d = 2) => {
  const f = 10 ** d;
  return Math.round((Number(n) + Number.EPSILON) * f) / f;
};
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);

function serializeLog(r) {
  return {
    ...r,
    liters: Number(r.liters),
    cost: Number(r.cost),
    odometer: r.odometer == null ? null : Number(r.odometer),
    price_per_liter: Number(r.liters) > 0 ? round(Number(r.cost) / Number(r.liters)) : null,
  };
}

// 'YYYY-MM' + k months
function addMonth(ym, k = 1) {
  const [y, m] = ym.split('-').map(Number);
  const total = y * 12 + (m - 1) + k;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${ny}-${String(nm).padStart(2, '0')}`;
}

// ── GET /api/fuel — list logs (optional ?vehicle_id) ────────────────────────
router.get('/', async (req, res) => {
  try {
    const { vehicle_id } = req.query;
    const params = [];
    let where = '';
    if (vehicle_id) {
      params.push(vehicle_id);
      where = `WHERE f.vehicle_id = $${params.length}`;
    }
    const { rows } = await query(
      `SELECT f.id, f.vehicle_id, f.trip_id, f.liters, f.cost, f.odometer,
              to_char(f.filled_at, 'YYYY-MM-DD') AS filled_at,
              v.registration_number, v.model, v.vehicle_type
       FROM fuel_logs f
       JOIN vehicles v ON v.id = f.vehicle_id
       ${where}
       ORDER BY f.filled_at DESC NULLS LAST, f.odometer DESC NULLS LAST`,
      params
    );
    res.json({ logs: rows.map(serializeLog) });
  } catch (error) {
    console.error('List fuel error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ── POST /api/fuel — add a fuel log ─────────────────────────────────────────
router.post('/', canManage, async (req, res) => {
  const { vehicle_id, liters, cost, odometer, filled_at } = req.body;
  const errors = [];

  if (!vehicle_id) errors.push('Vehicle is required');
  const L = Number(liters);
  if (!Number.isFinite(L) || L <= 0) errors.push('Fuel quantity (liters) must be greater than 0');
  const C = Number(cost);
  if (!Number.isFinite(C) || C < 0) errors.push('Cost must be a non-negative number');
  let O = null;
  if (odometer !== undefined && odometer !== null && odometer !== '') {
    O = Number(odometer);
    if (!Number.isFinite(O) || O < 0) errors.push('Odometer must be a non-negative number');
  }
  const date = filled_at && /^\d{4}-\d{2}-\d{2}$/.test(filled_at) ? filled_at : null;

  if (errors.length) return res.status(400).json({ message: errors[0], errors });

  try {
    const veh = await query('SELECT id, current_odometer FROM vehicles WHERE id = $1', [vehicle_id]);
    if (!veh.rows[0]) return res.status(404).json({ message: 'Vehicle not found' });

    const { rows } = await query(
      `INSERT INTO fuel_logs (vehicle_id, liters, cost, odometer, filled_at)
       VALUES ($1, $2, $3, $4, COALESCE($5::timestamp, now()))
       RETURNING id, vehicle_id, trip_id, liters, cost, odometer,
                 to_char(filled_at, 'YYYY-MM-DD') AS filled_at`,
      [vehicle_id, L, C, O, date]
    );

    // Keep the vehicle odometer moving forward if this fill reports a higher reading.
    if (O != null && Number(veh.rows[0].current_odometer) < O) {
      await query('UPDATE vehicles SET current_odometer = $1, updated_at = now() WHERE id = $2', [O, vehicle_id]);
    }

    res.status(201).json({ log: serializeLog(rows[0]) });
  } catch (error) {
    console.error('Create fuel error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ── DELETE /api/fuel/:id ────────────────────────────────────────────────────
router.delete('/:id', canManage, async (req, res) => {
  try {
    const { rowCount } = await query('DELETE FROM fuel_logs WHERE id = $1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ message: 'Fuel log not found' });
    res.json({ message: 'Fuel log deleted' });
  } catch (error) {
    console.error('Delete fuel error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ── GET /api/fuel/analytics — efficiency, forecast, anomalies, op-cost ───────
router.get('/analytics', async (req, res) => {
  try {
    const { rows: logs } = await query(
      `SELECT f.vehicle_id, f.liters::float8 AS liters, f.cost::float8 AS cost,
              f.odometer::float8 AS odometer, to_char(f.filled_at, 'YYYY-MM-DD') AS filled_at,
              v.registration_number, v.model, v.vehicle_type
       FROM fuel_logs f JOIN vehicles v ON v.id = f.vehicle_id
       ORDER BY f.vehicle_id, f.odometer ASC NULLS LAST, f.filled_at ASC`
    );
    const { rows: maint } = await query(
      `SELECT vehicle_id, COALESCE(SUM(cost), 0)::float8 AS cost FROM maintenance_logs GROUP BY vehicle_id`
    );
    const maintByVehicle = Object.fromEntries(maint.map((m) => [m.vehicle_id, m.cost]));

    // Expenses (tolls / parking / insurance / maintenance / other). Fuel-type
    // expenses are ignored here — fuel is authoritatively tracked in fuel_logs.
    const { rows: expRows } = await query(
      `SELECT vehicle_id, expense_type, COALESCE(SUM(amount), 0)::float8 AS amount
       FROM expenses GROUP BY vehicle_id, expense_type`
    );
    const OTHER_TYPES = new Set(['TOLL', 'PARKING', 'INSURANCE', 'OTHER']);
    const expByVehicle = {}; // vid -> { maintenance, other }
    const expByType = {};    // type -> fleet amount (excl. FUEL)
    for (const e of expRows) {
      const b = (expByVehicle[e.vehicle_id] ??= { maintenance: 0, other: 0 });
      if (e.expense_type === 'MAINTENANCE') b.maintenance += e.amount;
      else if (OTHER_TYPES.has(e.expense_type)) b.other += e.amount;
      if (e.expense_type !== 'FUEL') expByType[e.expense_type] = (expByType[e.expense_type] || 0) + e.amount;
    }

    // ── Per-vehicle stats ──
    const byVehicle = {};
    for (const l of logs) {
      (byVehicle[l.vehicle_id] ??= { info: l, logs: [] }).logs.push(l);
    }

    const vehicles = [];
    const alerts = [];
    let fleetDist = 0;
    let fleetFuelForEff = 0;
    let totalDistance = 0;

    for (const [vid, { info, logs: vlogs }] of Object.entries(byVehicle)) {
      const totalLiters = vlogs.reduce((s, l) => s + l.liters, 0);
      const totalCost = vlogs.reduce((s, l) => s + l.cost, 0);
      const avgPrice = totalLiters > 0 ? totalCost / totalLiters : 0;

      // Fill-to-fill efficiency intervals (need odometer on consecutive fills)
      const eff = [];
      for (let i = 1; i < vlogs.length; i++) {
        const dist = (vlogs[i].odometer ?? NaN) - (vlogs[i - 1].odometer ?? NaN);
        const fuel = vlogs[i].liters;
        if (Number.isFinite(dist) && dist > 0 && fuel > 0) {
          eff.push(dist / fuel);
          fleetDist += dist;
          fleetFuelForEff += fuel;
        }
      }
      const avgEff = eff.length ? mean(eff) : null;

      // Trend: newer-half vs older-half efficiency
      let trend = 'stable';
      let trendPct = 0;
      if (eff.length >= 4) {
        const half = Math.floor(eff.length / 2);
        const older = mean(eff.slice(0, half));
        const newer = mean(eff.slice(half));
        trendPct = older > 0 ? (newer - older) / older : 0;
        if (trendPct <= -0.08) trend = 'degrading';
        else if (trendPct >= 0.08) trend = 'improving';
      }

      // Price spike: latest fill price vs average
      const lastLog = vlogs[vlogs.length - 1];
      const lastPrice = lastLog.liters > 0 ? lastLog.cost / lastLog.liters : 0;
      const priceSpike = avgPrice > 0 && lastPrice > avgPrice * 1.25;

      const anomaly = trend === 'degrading' || priceSpike;
      const exp = expByVehicle[vid] || { maintenance: 0, other: 0 };
      const maintenanceCost = (maintByVehicle[vid] || 0) + exp.maintenance;
      const otherExpenses = exp.other;
      const operationalCost = totalCost + maintenanceCost + otherExpenses;

      // Distance covered over the logged period (odometer span) → cost per km.
      const odos = vlogs.map((l) => l.odometer).filter((o) => o != null && Number.isFinite(o));
      const distance = odos.length >= 2 ? Math.max(...odos) - Math.min(...odos) : 0;
      totalDistance += distance;
      const costPerKm = distance > 0 ? operationalCost / distance : null;

      if (trend === 'degrading') {
        alerts.push({
          vehicle_id: vid,
          registration: info.registration_number,
          severity: 'warning',
          message: `Fuel efficiency down ${Math.abs(round(trendPct * 100, 0))}% vs earlier — inspect vehicle.`,
        });
      }
      if (priceSpike) {
        alerts.push({
          vehicle_id: vid,
          registration: info.registration_number,
          severity: 'serious',
          message: `Last refuel priced ₹${round(lastPrice)}/L, ${round(((lastPrice - avgPrice) / avgPrice) * 100, 0)}% above its average — possible leak/theft.`,
        });
      }

      vehicles.push({
        vehicle_id: vid,
        registration_number: info.registration_number,
        model: info.model,
        vehicle_type: info.vehicle_type,
        fills: vlogs.length,
        total_liters: round(totalLiters, 1),
        fuel_cost: round(totalCost),
        maintenance_cost: round(maintenanceCost),
        other_expenses: round(otherExpenses),
        operational_cost: round(operationalCost),
        distance_km: round(distance, 0),
        cost_per_km: costPerKm == null ? null : round(costPerKm, 2),
        avg_price_per_liter: round(avgPrice),
        efficiency: avgEff == null ? null : round(avgEff, 2),
        trend,
        trend_pct: round(trendPct * 100, 1),
        anomaly,
      });
    }

    vehicles.sort((a, b) => b.operational_cost - a.operational_cost);

    // ── Fleet totals ──
    const totalLiters = logs.reduce((s, l) => s + l.liters, 0);
    const totalCost = logs.reduce((s, l) => s + l.cost, 0);

    const fleetMaint =
      maint.reduce((s, m) => s + m.cost, 0) +
      Object.values(expByVehicle).reduce((s, b) => s + b.maintenance, 0);
    const fleetOther = Object.values(expByVehicle).reduce((s, b) => s + b.other, 0);
    const fleetOperational = totalCost + fleetMaint + fleetOther;

    const fleet = {
      total_liters: round(totalLiters, 1),
      total_cost: round(totalCost),
      avg_price_per_liter: totalLiters > 0 ? round(totalCost / totalLiters) : 0,
      fleet_efficiency: fleetFuelForEff > 0 ? round(fleetDist / fleetFuelForEff, 2) : null,
      maintenance_cost: round(fleetMaint),
      other_expenses: round(fleetOther),
      operational_cost: round(fleetOperational),
      total_distance: round(totalDistance, 0),
      avg_cost_per_km: totalDistance > 0 ? round(fleetOperational / totalDistance, 2) : null,
      log_count: logs.length,
      vehicle_count: vehicles.length,
    };

    // Operational-cost composition (Fuel vs Maintenance vs Other)
    const cost_composition = [
      { label: 'Fuel', amount: round(totalCost) },
      { label: 'Maintenance', amount: round(fleetMaint) },
      { label: 'Other', amount: round(fleetOther) },
    ].map((c) => ({ ...c, pct: fleetOperational > 0 ? round((c.amount / fleetOperational) * 100, 1) : 0 }));

    // Expense breakdown by type (from the expenses table)
    const totalExp = Object.values(expByType).reduce((a, b) => a + b, 0);
    const expense_breakdown = Object.entries(expByType)
      .map(([type, amount]) => ({ type, amount: round(amount), pct: totalExp > 0 ? round((amount / totalExp) * 100, 1) : 0 }))
      .sort((a, b) => b.amount - a.amount);

    // ── Monthly spend + linear-regression forecast ──
    const byMonth = {};
    for (const l of logs) {
      if (!l.filled_at) continue;
      const m = l.filled_at.slice(0, 7);
      byMonth[m] = (byMonth[m] || 0) + l.cost;
    }
    const months = Object.keys(byMonth).sort();
    // Chart shape: each point carries explicit actual/forecast keys.
    const series = months.map((m) => ({ period: m, actual: round(byMonth[m]), forecast: null }));

    let forecast = null;
    if (series.length >= 2) {
      const n = series.length;
      const ys = series.map((s) => s.actual);
      const sx = (n * (n - 1)) / 2;
      const sy = ys.reduce((a, b) => a + b, 0);
      const sxy = ys.reduce((a, y, i) => a + i * y, 0);
      const sxx = ys.reduce((a, _y, i) => a + i * i, 0);
      const denom = n * sxx - sx * sx;
      const slope = denom !== 0 ? (n * sxy - sx * sy) / denom : 0;
      const intercept = (sy - slope * sx) / n;
      const predict = (i) => Math.max(0, slope * i + intercept);

      const avgCost = sy / n;
      const trendRatio = avgCost > 0 ? slope / avgCost : 0;
      const trend = trendRatio > 0.03 ? 'rising' : trendRatio < -0.03 ? 'falling' : 'stable';

      // Anchor the dashed forecast line to the last actual point, then extend 2 months.
      series[series.length - 1].forecast = series[series.length - 1].actual;
      for (const k of [1, 2]) {
        series.push({ period: addMonth(months[months.length - 1], k), actual: null, forecast: round(predict(n - 1 + k)) });
      }

      forecast = {
        next_period: series[series.length - 2].period,
        next_period_cost: series[series.length - 2].forecast,
        slope: round(slope),
        trend,
        method: 'linear-regression (least squares on monthly spend)',
      };
    }

    res.json({ fleet, vehicles, alerts, monthly: series, forecast, cost_composition, expense_breakdown });
  } catch (error) {
    console.error('Fuel analytics error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
