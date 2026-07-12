import { useEffect, useMemo, useState, useCallback } from 'react';
import {
  ResponsiveContainer, ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import {
  Plus, X, AlertCircle, AlertTriangle, Fuel as FuelIcon, TrendingUp, TrendingDown, Minus, Trash2, Gauge, Receipt, Layers,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ApiError } from '../../lib/api';
import { fuelApi, FuelLog, FuelAnalytics, Trend } from '../../lib/services/fuel';
import { expensesApi, Expense, EXPENSE_TYPES, EXPENSE_TYPE_COLORS } from '../../lib/services/expenses';
import { vehiclesApi } from '../../lib/services/vehicles';
import { Vehicle } from '../../lib/constants';

const mono: React.CSSProperties = { fontFamily: "'JetBrains Mono', monospace" };
const display: React.CSSProperties = { fontFamily: "'Barlow Condensed', sans-serif" };
const labelStyle: React.CSSProperties = {
  ...mono, fontSize: '0.58rem', letterSpacing: '0.16em', color: 'var(--muted-foreground)',
  textTransform: 'uppercase', display: 'block', marginBottom: '0.4rem',
};
const inputStyle: React.CSSProperties = {
  width: '100%', background: 'var(--input-background)', border: '1px solid var(--border-strong)',
  padding: '0.6rem 0.75rem', color: 'var(--foreground)', fontSize: '0.82rem', outline: 'none',
  boxSizing: 'border-box', fontFamily: 'inherit',
};
const errorBox: React.CSSProperties = { background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.3)' };

const ACTUAL = '#3b82f6';
const FORECAST = '#f59e0b';

const inr = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN');
const inrK = (n: number) => (n >= 1000 ? '₹' + (n / 1000).toFixed(n >= 10000 ? 0 : 1) + 'k' : '₹' + Math.round(n));
const today = () => new Date().toISOString().slice(0, 10);

function TrendArrow({ trend, pct }: { trend: Trend; pct?: number }) {
  const map = {
    improving: { icon: TrendingUp, color: '#10b981', label: 'Improving' },
    degrading: { icon: TrendingDown, color: '#ef4444', label: 'Degrading' },
    stable: { icon: Minus, color: 'var(--text-muted)', label: 'Stable' },
  } as const;
  const { icon: Icon, color, label } = map[trend];
  return (
    <span className="inline-flex items-center gap-1" style={{ color }} title={label}>
      <Icon size={13} />
      {pct !== undefined && trend !== 'stable' && (
        <span style={{ ...mono, fontSize: '0.62rem' }}>{pct > 0 ? '+' : ''}{pct}%</span>
      )}
    </span>
  );
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const a = payload.find((p: any) => p.dataKey === 'actual' && p.value != null);
  const f = payload.find((p: any) => p.dataKey === 'forecast' && p.value != null);
  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border-strong)', padding: '0.5rem 0.7rem' }}>
      <div style={{ ...mono, fontSize: '0.6rem', color: 'var(--muted-foreground)', letterSpacing: '0.1em', marginBottom: 4 }}>{label}</div>
      {a && <div style={{ fontSize: '0.75rem', color: ACTUAL }}>Actual {inr(a.value)}</div>}
      {f && <div style={{ fontSize: '0.75rem', color: FORECAST }}>Forecast {inr(f.value)}</div>}
    </div>
  );
}

export default function Fuel() {
  const { user } = useAuth();
  const canManage = ['FLEET_MANAGER', 'FINANCIAL_ANALYST', 'ADMIN'].includes(user?.role || '');

  const [analytics, setAnalytics] = useState<FuelAnalytics | null>(null);
  const [logs, setLogs] = useState<FuelLog[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ vehicle_id: '', liters: '', cost: '', odometer: '', filled_at: today() });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const [expModalOpen, setExpModalOpen] = useState(false);
  const [expForm, setExpForm] = useState({ vehicle_id: '', expense_type: 'TOLL', amount: '', description: '', expense_date: today() });
  const [expError, setExpError] = useState('');
  const [expSaving, setExpSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [a, l, x, v] = await Promise.all([fuelApi.analytics(), fuelApi.list(), expensesApi.list(), vehiclesApi.list()]);
      setAnalytics(a);
      setLogs(l.logs);
      setExpenses(x.expenses);
      setVehicles(v.vehicles);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to load fuel data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const vehicleName = useMemo(() => {
    const m: Record<string, string> = {};
    vehicles.forEach((v) => (m[v.id] = v.registration_number));
    return m;
  }, [vehicles]);

  function openCreate() {
    setForm({ vehicle_id: vehicles[0]?.id || '', liters: '', cost: '', odometer: '', filled_at: today() });
    setFormError('');
    setModalOpen(true);
  }

  async function submitForm(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');
    if (!form.vehicle_id) return setFormError('Select a vehicle.');
    if (!form.liters || Number(form.liters) <= 0) return setFormError('Fuel quantity must be greater than 0.');
    if (form.cost === '' || Number(form.cost) < 0) return setFormError('Enter a valid cost.');

    setSaving(true);
    try {
      await fuelApi.create({
        vehicle_id: form.vehicle_id,
        liters: Number(form.liters),
        cost: Number(form.cost),
        odometer: form.odometer ? Number(form.odometer) : undefined,
        filled_at: form.filled_at || undefined,
      });
      setModalOpen(false);
      await load();
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : 'Failed to save fuel log');
    } finally {
      setSaving(false);
    }
  }

  async function removeLog(id: string) {
    try { await fuelApi.remove(id); await load(); } catch { /* ignore */ }
  }

  function openExpCreate() {
    setExpForm({ vehicle_id: vehicles[0]?.id || '', expense_type: 'TOLL', amount: '', description: '', expense_date: today() });
    setExpError('');
    setExpModalOpen(true);
  }

  async function submitExpense(e: React.FormEvent) {
    e.preventDefault();
    setExpError('');
    if (!expForm.vehicle_id) return setExpError('Select a vehicle.');
    if (expForm.amount === '' || Number(expForm.amount) < 0) return setExpError('Enter a valid amount.');
    setExpSaving(true);
    try {
      await expensesApi.create({
        vehicle_id: expForm.vehicle_id,
        expense_type: expForm.expense_type,
        amount: Number(expForm.amount),
        description: expForm.description.trim() || undefined,
        expense_date: expForm.expense_date || undefined,
      });
      setExpModalOpen(false);
      await load();
    } catch (err) {
      setExpError(err instanceof ApiError ? err.message : 'Failed to save expense');
    } finally {
      setExpSaving(false);
    }
  }

  async function removeExpense(id: string) {
    try { await expensesApi.remove(id); await load(); } catch { /* ignore */ }
  }

  const fleet = analytics?.fleet;
  const forecast = analytics?.forecast;

  return (
    <div className="px-6 md:px-10 py-8 max-w-[1200px]">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
        <div>
          <div style={{ ...mono, fontSize: '0.6rem', letterSpacing: '0.2em', color: 'var(--muted-foreground)', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
            Fuel Intelligence
          </div>
          <h1 style={{ ...display, fontSize: '2.2rem', fontWeight: 700, lineHeight: 1, textTransform: 'uppercase', color: 'var(--foreground)' }}>
            Fuel &amp; Expenses
          </h1>
        </div>
        {canManage && (
          <div className="flex items-center gap-2">
            <button onClick={openExpCreate} className="flex items-center gap-2"
              style={{ background: 'transparent', color: 'var(--foreground)', fontWeight: 600, fontSize: '0.8rem', padding: '0.6rem 1rem', border: '1px solid var(--border-strong)', cursor: 'pointer', letterSpacing: '0.03em' }}>
              <Receipt size={15} /> Add Expense
            </button>
            <button onClick={openCreate} className="flex items-center gap-2"
              style={{ background: 'var(--primary)', color: 'var(--primary-foreground)', fontWeight: 700, fontSize: '0.8rem', padding: '0.6rem 1rem', border: 'none', cursor: 'pointer', letterSpacing: '0.03em' }}>
              <Plus size={15} strokeWidth={2.5} /> Add Fuel Log
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 mb-4 p-3" style={errorBox}>
          <AlertCircle size={14} color="var(--destructive)" />
          <span style={{ fontSize: '0.8rem', color: 'var(--destructive)' }}>{error}</span>
        </div>
      )}

      {loading ? (
        <div style={{ color: 'var(--muted-foreground)', fontSize: '0.85rem', padding: '2rem 0' }}>Loading fuel intelligence…</div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-px mb-6" style={{ background: 'var(--border)', border: '1px solid var(--border)' }}>
            <Kpi label="Total Fuel Spend" value={fleet ? inr(fleet.total_cost) : '—'} />
            <Kpi label="Total Litres" value={fleet ? fleet.total_liters.toLocaleString('en-IN') + ' L' : '—'} />
            <Kpi label="Avg Price / L" value={fleet ? inr(fleet.avg_price_per_liter) : '—'} />
            <Kpi label="Fleet Efficiency" value={fleet?.fleet_efficiency != null ? fleet.fleet_efficiency + ' km/L' : '—'} color="#10b981" />
            <Kpi
              label={`Forecast · ${forecast?.next_period || 'next'}`}
              value={forecast ? inr(forecast.next_period_cost) : '—'}
              color={FORECAST}
              accent
              sub={forecast ? `${forecast.trend === 'rising' ? '▲' : forecast.trend === 'falling' ? '▼' : '►'} ${forecast.trend}` : undefined}
            />
          </div>

          {/* Forecast chart */}
          <div className="mb-6" style={{ background: 'var(--card)', border: '1px solid var(--border)', padding: '1.25rem 1.25rem 0.5rem' }}>
            <div className="flex items-center justify-between flex-wrap gap-2 mb-1 px-1">
              <div style={{ ...display, fontSize: '1.15rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--foreground)' }}>
                Monthly Fuel Spend &amp; Forecast
              </div>
              <div className="flex items-center gap-4" style={{ ...mono, fontSize: '0.6rem', letterSpacing: '0.08em', color: 'var(--muted-foreground)' }}>
                <span className="flex items-center gap-1.5"><span style={{ width: 14, height: 2, background: ACTUAL, display: 'inline-block' }} /> ACTUAL</span>
                <span className="flex items-center gap-1.5"><span style={{ width: 14, height: 0, borderTop: `2px dashed ${FORECAST}`, display: 'inline-block' }} /> FORECAST</span>
              </div>
            </div>
            <div style={{ ...mono, fontSize: '0.55rem', color: 'var(--text-faint)', letterSpacing: '0.06em', padding: '0 0.25rem 0.5rem' }}>
              {forecast ? `Projected via ${forecast.method}` : 'Add fuel logs across at least two months to project spend.'}
            </div>
            <div style={{ width: '100%', height: 280 }}>
              <ResponsiveContainer>
                <ComposedChart data={analytics?.monthly || []} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
                  <CartesianGrid stroke="rgba(128,128,128,0.15)" vertical={false} />
                  <XAxis dataKey="period" tick={{ fill: '#8a8a8a', fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }} axisLine={{ stroke: 'rgba(128,128,128,0.25)' }} tickLine={false} />
                  <YAxis tickFormatter={inrK} tick={{ fill: '#8a8a8a', fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }} axisLine={false} tickLine={false} width={48} />
                  <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'rgba(128,128,128,0.3)' }} />
                  <Line type="monotone" dataKey="actual" stroke={ACTUAL} strokeWidth={2.5} dot={{ r: 3, fill: ACTUAL }} activeDot={{ r: 5 }} connectNulls={false} />
                  <Line type="monotone" dataKey="forecast" stroke={FORECAST} strokeWidth={2.5} strokeDasharray="6 5" dot={{ r: 3, fill: FORECAST }} connectNulls={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Operational cost composition */}
          {fleet && (
            <div className="grid md:grid-cols-3 gap-px mb-6" style={{ background: 'var(--border)', border: '1px solid var(--border)' }}>
              <div className="p-5" style={{ background: 'var(--card)' }}>
                <div style={{ ...mono, fontSize: '0.55rem', letterSpacing: '0.14em', color: 'var(--muted-foreground)', textTransform: 'uppercase' }}>Total Operational Cost</div>
                <div style={{ ...display, fontSize: '2rem', fontWeight: 700, color: 'var(--foreground)', lineHeight: 1.1, marginTop: 6 }}>{inr(fleet.operational_cost)}</div>
                <div style={{ ...mono, fontSize: '0.62rem', color: 'var(--text-muted)', marginTop: 8 }}>
                  {fleet.avg_cost_per_km != null ? `₹${fleet.avg_cost_per_km} / km · ${fleet.total_distance.toLocaleString('en-IN')} km driven` : 'add odometer readings for ₹/km'}
                </div>
              </div>
              <div className="p-5 md:col-span-2" style={{ background: 'var(--card)' }}>
                <div style={{ ...mono, fontSize: '0.55rem', letterSpacing: '0.14em', color: 'var(--muted-foreground)', textTransform: 'uppercase', marginBottom: 12 }}>
                  Cost Composition · Fuel + Maintenance + Expenses
                </div>
                <CompositionBar slices={analytics!.cost_composition} />
              </div>
            </div>
          )}

          {/* Alerts */}
          {analytics && analytics.alerts.length > 0 && (
            <div className="mb-6 flex flex-col gap-2">
              {analytics.alerts.map((al, i) => {
                const serious = al.severity === 'serious';
                const c = serious ? '#ef4444' : '#f59e0b';
                return (
                  <div key={i} className="flex items-start gap-2.5 p-3" style={{ background: serious ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.08)', border: `1px solid ${c}44` }}>
                    <AlertTriangle size={15} color={c} style={{ marginTop: 1, flexShrink: 0 }} />
                    <div>
                      <span style={{ ...mono, fontSize: '0.68rem', color: c, letterSpacing: '0.05em' }}>{al.registration}</span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--foreground)', marginLeft: 8 }}>{al.message}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Per-vehicle efficiency & operational cost */}
          <SectionTitle icon={Gauge}>Per-Vehicle Efficiency &amp; Operational Cost</SectionTitle>
          <div className="mb-8" style={{ border: '1px solid var(--border)', background: 'var(--surface)', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Vehicle', 'Efficiency', 'Trend', 'Fuel', 'Maintenance', 'Other', 'Operational', '₹/km'].map((h, i) => (
                    <th key={i} style={{ ...mono, fontSize: '0.56rem', letterSpacing: '0.12em', color: 'var(--muted-foreground)', textTransform: 'uppercase', textAlign: i >= 3 ? 'right' : 'left', padding: '0.7rem 1rem', fontWeight: 400, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {analytics && analytics.vehicles.length ? analytics.vehicles.map((v) => (
                  <tr key={v.vehicle_id} style={{ borderBottom: '1px solid var(--border-faint)' }}>
                    <td style={{ padding: '0.8rem 1rem', whiteSpace: 'nowrap' }}>
                      <span style={{ ...mono, fontSize: '0.75rem', color: 'var(--foreground)' }}>{v.registration_number}</span>
                      {v.anomaly && <span style={{ ...mono, fontSize: '0.52rem', color: '#ef4444', border: '1px solid rgba(239,68,68,0.4)', padding: '1px 4px', marginLeft: 6, letterSpacing: '0.05em' }}>ANOMALY</span>}
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{v.model}</div>
                    </td>
                    <td style={{ padding: '0.8rem 1rem', ...mono, fontSize: '0.75rem', color: 'var(--foreground)', whiteSpace: 'nowrap' }}>{v.efficiency != null ? v.efficiency + ' km/L' : '—'}</td>
                    <td style={{ padding: '0.8rem 1rem' }}><TrendArrow trend={v.trend} pct={v.trend_pct} /></td>
                    <td style={{ padding: '0.8rem 1rem', ...mono, fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'right', whiteSpace: 'nowrap' }}>{inr(v.fuel_cost)}</td>
                    <td style={{ padding: '0.8rem 1rem', ...mono, fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'right', whiteSpace: 'nowrap' }}>{inr(v.maintenance_cost)}</td>
                    <td style={{ padding: '0.8rem 1rem', ...mono, fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'right', whiteSpace: 'nowrap' }}>{inr(v.other_expenses)}</td>
                    <td style={{ padding: '0.8rem 1rem', ...mono, fontSize: '0.75rem', color: 'var(--foreground)', textAlign: 'right', fontWeight: 600, whiteSpace: 'nowrap' }}>{inr(v.operational_cost)}</td>
                    <td style={{ padding: '0.8rem 1rem', ...mono, fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'right', whiteSpace: 'nowrap' }}>{v.cost_per_km != null ? '₹' + v.cost_per_km : '—'}</td>
                  </tr>
                )) : (
                  <tr><td colSpan={8} style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--muted-foreground)', fontSize: '0.82rem' }}>No fuel data yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Fuel history */}
          <SectionTitle icon={FuelIcon}>Fuel History</SectionTitle>
          <div style={{ border: '1px solid var(--border)', background: 'var(--surface)', overflow: 'auto', maxHeight: 340 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Date', 'Vehicle', 'Litres', '₹/L', 'Cost', 'Odometer', ''].map((h, i) => (
                    <th key={i} style={{ ...mono, fontSize: '0.56rem', letterSpacing: '0.12em', color: 'var(--muted-foreground)', textTransform: 'uppercase', textAlign: i >= 2 && i <= 5 ? 'right' : 'left', padding: '0.7rem 1rem', fontWeight: 400, whiteSpace: 'nowrap', position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 1 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.length ? logs.map((l) => (
                  <tr key={l.id} style={{ borderBottom: '1px solid var(--border-faint)' }}>
                    <td style={{ padding: '0.7rem 1rem', ...mono, fontSize: '0.72rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{l.filled_at}</td>
                    <td style={{ padding: '0.7rem 1rem', ...mono, fontSize: '0.72rem', color: 'var(--foreground)', whiteSpace: 'nowrap' }}>{l.registration_number}</td>
                    <td style={{ padding: '0.7rem 1rem', ...mono, fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'right' }}>{l.liters} L</td>
                    <td style={{ padding: '0.7rem 1rem', ...mono, fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'right' }}>{l.price_per_liter != null ? inr(l.price_per_liter) : '—'}</td>
                    <td style={{ padding: '0.7rem 1rem', ...mono, fontSize: '0.72rem', color: 'var(--foreground)', textAlign: 'right', whiteSpace: 'nowrap' }}>{inr(l.cost)}</td>
                    <td style={{ padding: '0.7rem 1rem', ...mono, fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'right', whiteSpace: 'nowrap' }}>{l.odometer != null ? l.odometer.toLocaleString('en-IN') + ' km' : '—'}</td>
                    <td style={{ padding: '0.7rem 1rem', textAlign: 'right' }}>
                      {canManage && (
                        <button onClick={() => removeLog(l.id)} title="Delete" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}><Trash2 size={13} /></button>
                      )}
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan={7} style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--muted-foreground)', fontSize: '0.82rem' }}>No fuel logs recorded yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Expense breakdown by type (calculated) */}
          <div className="mt-8">
            <SectionTitle icon={Layers}>Expense Breakdown by Type</SectionTitle>
          </div>
          <div className="mb-8 p-5" style={{ border: '1px solid var(--border)', background: 'var(--card)' }}>
            {analytics && analytics.expense_breakdown.length ? (
              <div className="flex flex-col gap-3">
                {analytics.expense_breakdown.map((e) => (
                  <div key={e.type} className="flex items-center gap-3">
                    <span style={{ width: 92, ...mono, fontSize: '0.6rem', letterSpacing: '0.08em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{e.type}</span>
                    <div style={{ flex: 1, height: 10, background: 'var(--border)' }}>
                      <div style={{ width: `${e.pct}%`, height: '100%', background: EXPENSE_TYPE_COLORS[e.type] || '#64748b' }} />
                    </div>
                    <span style={{ width: 130, textAlign: 'right', ...mono, fontSize: '0.7rem', color: 'var(--foreground)' }}>{inr(e.amount)} · {e.pct}%</span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ color: 'var(--muted-foreground)', fontSize: '0.82rem' }}>No expenses recorded yet — add tolls, parking, insurance and more.</div>
            )}
          </div>

          {/* Expense history */}
          <SectionTitle icon={Receipt}>Expense History</SectionTitle>
          <div style={{ border: '1px solid var(--border)', background: 'var(--surface)', overflow: 'auto', maxHeight: 340 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 680 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Date', 'Vehicle', 'Type', 'Description', 'Amount', ''].map((h, i) => (
                    <th key={i} style={{ ...mono, fontSize: '0.56rem', letterSpacing: '0.12em', color: 'var(--muted-foreground)', textTransform: 'uppercase', textAlign: i === 4 ? 'right' : 'left', padding: '0.7rem 1rem', fontWeight: 400, whiteSpace: 'nowrap', position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 1 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {expenses.length ? expenses.map((x) => (
                  <tr key={x.id} style={{ borderBottom: '1px solid var(--border-faint)' }}>
                    <td style={{ padding: '0.7rem 1rem', ...mono, fontSize: '0.72rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{x.expense_date}</td>
                    <td style={{ padding: '0.7rem 1rem', ...mono, fontSize: '0.72rem', color: 'var(--foreground)', whiteSpace: 'nowrap' }}>{x.registration_number}</td>
                    <td style={{ padding: '0.7rem 1rem' }}>
                      <span style={{ ...mono, fontSize: '0.56rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: EXPENSE_TYPE_COLORS[x.expense_type] || '#64748b', border: `1px solid ${(EXPENSE_TYPE_COLORS[x.expense_type] || '#64748b')}55`, padding: '2px 6px' }}>{x.expense_type}</span>
                    </td>
                    <td style={{ padding: '0.7rem 1rem', fontSize: '0.76rem', color: 'var(--text-muted)' }}>{x.description || '—'}</td>
                    <td style={{ padding: '0.7rem 1rem', ...mono, fontSize: '0.72rem', color: 'var(--foreground)', textAlign: 'right', whiteSpace: 'nowrap' }}>{inr(x.amount)}</td>
                    <td style={{ padding: '0.7rem 1rem', textAlign: 'right' }}>
                      {canManage && <button onClick={() => removeExpense(x.id)} title="Delete" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}><Trash2 size={13} /></button>}
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan={6} style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--muted-foreground)', fontSize: '0.82rem' }}>No expenses recorded yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Add Fuel Log modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={() => !saving && setModalOpen(false)}>
          <div className="w-full max-w-[460px]" style={{ background: 'var(--card)', border: '1px solid var(--border-strong)' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
              <h2 style={{ ...display, fontSize: '1.3rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--foreground)' }}>Add Fuel Log</h2>
              <button onClick={() => !saving && setModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={18} /></button>
            </div>
            <form onSubmit={submitForm} className="px-5 py-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label style={labelStyle}>Vehicle</label>
                  <select value={form.vehicle_id} onChange={(e) => setForm({ ...form, vehicle_id: e.target.value })} style={{ ...inputStyle, cursor: 'pointer' }}>
                    <option value="">Select a vehicle…</option>
                    {vehicles.map((v) => (<option key={v.id} value={v.id}>{v.registration_number} — {v.model}</option>))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Fuel Quantity (L)</label>
                  <input type="number" min="0" step="any" value={form.liters} onChange={(e) => setForm({ ...form, liters: e.target.value })} placeholder="45" style={inputStyle} autoFocus />
                </div>
                <div>
                  <label style={labelStyle}>Cost (₹)</label>
                  <input type="number" min="0" step="any" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} placeholder="4500" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Odometer (km)</label>
                  <input type="number" min="0" step="any" value={form.odometer} onChange={(e) => setForm({ ...form, odometer: e.target.value })} placeholder="optional" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Date</label>
                  <input type="date" value={form.filled_at} onChange={(e) => setForm({ ...form, filled_at: e.target.value })} style={inputStyle} />
                </div>
              </div>
              <div style={{ ...mono, fontSize: '0.55rem', color: 'var(--text-faint)', letterSpacing: '0.05em', marginTop: 10 }}>
                Odometer readings power the km/L efficiency &amp; anomaly detection.
              </div>
              {formError && (
                <div className="flex items-center gap-2 mt-4 p-2.5" style={errorBox}>
                  <AlertCircle size={13} color="var(--destructive)" />
                  <span style={{ fontSize: '0.76rem', color: 'var(--destructive)' }}>{formError}</span>
                </div>
              )}
              <div className="flex gap-3 mt-6">
                <button type="button" onClick={() => setModalOpen(false)} disabled={saving} style={{ flex: 1, background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border-strong)', padding: '0.6rem', cursor: 'pointer', fontSize: '0.8rem' }}>Cancel</button>
                <button type="submit" disabled={saving} style={{ flex: 1, background: 'var(--primary)', color: 'var(--primary-foreground)', fontWeight: 700, border: 'none', padding: '0.6rem', cursor: saving ? 'not-allowed' : 'pointer', fontSize: '0.8rem', opacity: saving ? 0.6 : 1 }}>{saving ? 'Saving…' : 'Add Log'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Expense modal */}
      {expModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={() => !expSaving && setExpModalOpen(false)}>
          <div className="w-full max-w-[460px]" style={{ background: 'var(--card)', border: '1px solid var(--border-strong)' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
              <h2 style={{ ...display, fontSize: '1.3rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--foreground)' }}>Add Expense</h2>
              <button onClick={() => !expSaving && setExpModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={18} /></button>
            </div>
            <form onSubmit={submitExpense} className="px-5 py-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label style={labelStyle}>Vehicle</label>
                  <select value={expForm.vehicle_id} onChange={(e) => setExpForm({ ...expForm, vehicle_id: e.target.value })} style={{ ...inputStyle, cursor: 'pointer' }}>
                    <option value="">Select a vehicle…</option>
                    {vehicles.map((v) => (<option key={v.id} value={v.id}>{v.registration_number} — {v.model}</option>))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Expense Type</label>
                  <select value={expForm.expense_type} onChange={(e) => setExpForm({ ...expForm, expense_type: e.target.value })} style={{ ...inputStyle, cursor: 'pointer' }}>
                    {EXPENSE_TYPES.map((t) => (<option key={t} value={t}>{t.charAt(0) + t.slice(1).toLowerCase()}</option>))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Amount (₹)</label>
                  <input type="number" min="0" step="any" value={expForm.amount} onChange={(e) => setExpForm({ ...expForm, amount: e.target.value })} placeholder="250" style={inputStyle} autoFocus />
                </div>
                <div className="col-span-2">
                  <label style={labelStyle}>Description</label>
                  <input value={expForm.description} onChange={(e) => setExpForm({ ...expForm, description: e.target.value })} placeholder="optional" style={inputStyle} />
                </div>
                <div className="col-span-2">
                  <label style={labelStyle}>Date</label>
                  <input type="date" value={expForm.expense_date} onChange={(e) => setExpForm({ ...expForm, expense_date: e.target.value })} style={inputStyle} />
                </div>
              </div>
              {expError && (
                <div className="flex items-center gap-2 mt-4 p-2.5" style={errorBox}>
                  <AlertCircle size={13} color="var(--destructive)" />
                  <span style={{ fontSize: '0.76rem', color: 'var(--destructive)' }}>{expError}</span>
                </div>
              )}
              <div className="flex gap-3 mt-6">
                <button type="button" onClick={() => setExpModalOpen(false)} disabled={expSaving} style={{ flex: 1, background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border-strong)', padding: '0.6rem', cursor: 'pointer', fontSize: '0.8rem' }}>Cancel</button>
                <button type="submit" disabled={expSaving} style={{ flex: 1, background: 'var(--primary)', color: 'var(--primary-foreground)', fontWeight: 700, border: 'none', padding: '0.6rem', cursor: expSaving ? 'not-allowed' : 'pointer', fontSize: '0.8rem', opacity: expSaving ? 0.6 : 1 }}>{expSaving ? 'Saving…' : 'Add Expense'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function CompositionBar({ slices }: { slices: { label: string; amount: number; pct: number }[] }) {
  const COMP: Record<string, string> = { Fuel: '#3b82f6', Maintenance: '#f59e0b', Other: '#64748b' };
  const total = slices.reduce((s, c) => s + c.amount, 0) || 1;
  return (
    <div>
      <div style={{ display: 'flex', height: 16, width: '100%', gap: 2 }}>
        {slices.filter((c) => c.amount > 0).map((c) => (
          <div key={c.label} title={`${c.label} ${c.pct}%`} style={{ width: `${(c.amount / total) * 100}%`, background: COMP[c.label] || '#64748b' }} />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-2 mt-3">
        {slices.map((c) => (
          <div key={c.label} className="flex items-center gap-2">
            <span style={{ width: 9, height: 9, background: COMP[c.label] || '#64748b', display: 'inline-block' }} />
            <span style={{ fontSize: '0.75rem', color: 'var(--foreground)' }}>{c.label}</span>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.7rem', color: 'var(--text-muted)' }}>₹{Math.round(c.amount).toLocaleString('en-IN')} · {c.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Kpi({ label, value, color, accent, sub }: { label: string; value: string; color?: string; accent?: boolean; sub?: string }) {
  return (
    <div className="p-4" style={{ background: accent ? 'rgba(245,158,11,0.06)' : 'var(--surface)', borderLeft: accent ? `2px solid ${FORECAST}` : undefined }}>
      <div style={{ ...display, fontSize: '1.6rem', fontWeight: 700, lineHeight: 1.05, color: color || 'var(--foreground)' }}>{value}</div>
      <div style={{ ...mono, fontSize: '0.55rem', letterSpacing: '0.1em', color: 'var(--muted-foreground)', textTransform: 'uppercase', marginTop: '0.4rem' }}>{label}</div>
      {sub && <div style={{ ...mono, fontSize: '0.55rem', letterSpacing: '0.05em', color: FORECAST, textTransform: 'uppercase', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function SectionTitle({ icon: Icon, children }: { icon: typeof Gauge; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon size={14} color="var(--text-muted)" />
      <span style={{ ...mono, fontSize: '0.62rem', letterSpacing: '0.16em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{children}</span>
    </div>
  );
}
