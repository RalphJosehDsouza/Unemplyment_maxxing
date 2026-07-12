import { useEffect, useMemo, useState, useCallback } from 'react';
import { Search, Plus, AlertCircle, Wrench, X, CheckCircle2, AlertTriangle, TrendingUp, Activity, ShieldCheck, Clock } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ApiError } from '../../lib/api';
import { maintenanceApi, MaintenanceRecord, MaintenanceVehicle, MaintenanceAnalytics } from '../../lib/services/maintenance';

const mono: React.CSSProperties = { fontFamily: "'JetBrains Mono', monospace" };
const display: React.CSSProperties = { fontFamily: "'Barlow Condensed', sans-serif" };
const labelStyle: React.CSSProperties = { ...mono, fontSize: '0.58rem', letterSpacing: '0.16em', color: 'var(--muted-foreground)', textTransform: 'uppercase', display: 'block', marginBottom: '0.4rem' };
const inputStyle: React.CSSProperties = { width: '100%', background: 'var(--input-background)', border: '1px solid var(--border-strong)', padding: '0.6rem 0.75rem', color: 'var(--foreground)', fontSize: '0.82rem', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' };
const errorBox: React.CSSProperties = { background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.3)' };
const inr = (n: number) => '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });

const MAINT_TYPES = ['Engine Repair', 'Brake Service', 'Tire Replacement', 'Oil Change', 'Transmission', 'Electrical', 'Body Work', 'AC Service', 'General Service', 'Other'];

function MaintStatusBadge({ status }: { status: string }) {
  const isOpen = status === 'OPEN';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', background: isOpen ? 'rgba(245,158,11,0.12)' : 'rgba(16,185,129,0.12)', color: isOpen ? '#f59e0b' : '#10b981', border: `1px solid ${isOpen ? 'rgba(245,158,11,0.25)' : 'rgba(16,185,129,0.25)'}`, ...mono, fontSize: '0.6rem', letterSpacing: '0.08em', textTransform: 'uppercase', padding: '0.22rem 0.5rem', whiteSpace: 'nowrap' }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: isOpen ? '#f59e0b' : '#10b981' }} />
      {isOpen ? 'Open' : 'Completed'}
    </span>
  );
}

function HealthGauge({ score }: { score: number }) {
  const color = score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#ef4444';
  const circumference = 2 * Math.PI * 42;
  const dashoffset = circumference * (1 - score / 100);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <svg width="100" height="100" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="42" fill="none" stroke="var(--border)" strokeWidth="6" />
        <circle cx="50" cy="50" r="42" fill="none" stroke={color} strokeWidth="6" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={dashoffset} transform="rotate(-90 50 50)" style={{ transition: 'stroke-dashoffset 1s ease' }} />
        <text x="50" y="46" textAnchor="middle" style={{ ...display, fontSize: '1.6rem', fontWeight: 700 }} fill={color}>{score}</text>
        <text x="50" y="62" textAnchor="middle" style={{ ...mono, fontSize: '0.45rem', letterSpacing: '0.1em' }} fill="var(--text-muted)">/ 100</text>
      </svg>
      <span style={{ ...mono, fontSize: '0.5rem', letterSpacing: '0.12em', color: 'var(--muted-foreground)', textTransform: 'uppercase' }}>Fleet Health</span>
    </div>
  );
}

function CostChart({ data }: { data: { month: string; cost: number; count: number }[] }) {
  if (!data.length) return <div style={{ ...mono, fontSize: '0.6rem', color: 'var(--text-faint)', padding: '2rem', textAlign: 'center' }}>No trend data yet</div>;
  const maxCost = Math.max(...data.map(d => d.cost), 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 100, padding: '0 4px' }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <span style={{ ...mono, fontSize: '0.45rem', color: 'var(--text-muted)' }}>{inr(d.cost)}</span>
          <div style={{ width: '100%', maxWidth: 36, background: 'linear-gradient(to top, rgba(59,130,246,0.7), rgba(59,130,246,0.3))', height: `${Math.max((d.cost / maxCost) * 70, 4)}px`, transition: 'height 0.6s ease' }} />
          <span style={{ ...mono, fontSize: '0.4rem', color: 'var(--text-faint)', whiteSpace: 'nowrap' }}>{d.month.split(' ')[0]}</span>
        </div>
      ))}
    </div>
  );
}

export default function Maintenance() {
  const { user } = useAuth();
  const canManage = user?.role === 'FLEET_MANAGER' || user?.role === 'ADMIN';

  const [records, setRecords] = useState<MaintenanceRecord[]>([]);
  const [analytics, setAnalytics] = useState<MaintenanceAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [vehicles, setVehicles] = useState<MaintenanceVehicle[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ vehicle_id: '', type: 'General Service', description: '', cost: '' });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [recs, stats] = await Promise.all([maintenanceApi.list(), maintenanceApi.analytics()]);
      setRecords(recs.records); setAnalytics(stats);
    } catch (e) { setError(e instanceof ApiError ? e.message : 'Failed to load'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (modalOpen) maintenanceApi.vehicles().then(d => setVehicles(d.vehicles)).catch(() => {}); }, [modalOpen]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return records.filter(m => {
      if (statusFilter && m.status !== statusFilter) return false;
      if (q && !m.description.toLowerCase().includes(q) && !m.maintenance_type.toLowerCase().includes(q) && !(m.registration_number || '').toLowerCase().includes(q)) return false;
      return true;
    });
  }, [records, search, statusFilter]);

  async function submitRecord(e: React.FormEvent) {
    e.preventDefault(); setFormError('');
    if (!form.vehicle_id) { setFormError('Vehicle is required.'); return; }
    if (!form.description.trim()) { setFormError('Description is required.'); return; }
    setSaving(true);
    try {
      await maintenanceApi.create({
        vehicle_id: form.vehicle_id,
        maintenance_type: form.type,
        description: form.description.trim(),
        cost: Number(form.cost || 0)
      });
      setModalOpen(false); setForm({ vehicle_id: '', type: 'General Service', description: '', cost: '' }); await load();
    } catch (e) { setFormError(e instanceof ApiError ? e.message : 'Failed to create'); }
    finally { setSaving(false); }
  }

  async function closeRecord(id: string) {
    setActionError('');
    try { await maintenanceApi.close(id); await load(); }
    catch (e) { setActionError(e instanceof ApiError ? e.message : 'Failed to close record'); }
  }

  const daysBetween = (a: string, b: string | null) => {
    const end = b ? new Date(b) : new Date();
    return Math.max(1, Math.round((end.getTime() - new Date(a).getTime()) / 86400000));
  };

  const c = analytics?.counts;

  return (
    <div className="px-6 md:px-10 py-8" style={{ maxWidth: 1400 }}>
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
        <div>
          <div style={{ ...mono, fontSize: '0.6rem', letterSpacing: '0.2em', color: 'var(--muted-foreground)', textTransform: 'uppercase', marginBottom: '0.4rem' }}>Fleet Maintenance</div>
          <h1 style={{ ...display, fontSize: '2.2rem', fontWeight: 700, lineHeight: 1, textTransform: 'uppercase', color: 'var(--foreground)' }}>Maintenance</h1>
        </div>
        {canManage && (
          <button onClick={() => { setModalOpen(true); setFormError(''); }} className="flex items-center gap-2" style={{ background: 'var(--primary)', color: 'var(--primary-foreground)', fontWeight: 700, fontSize: '0.8rem', padding: '0.6rem 1rem', border: 'none', cursor: 'pointer', letterSpacing: '0.03em' }}>
            <Plus size={15} strokeWidth={2.5} /> New Record
          </button>
        )}
      </div>

      {/* Analytics Dashboard */}
      {analytics && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1px', background: 'var(--border)', border: '1px solid var(--border)', marginBottom: '1.5rem' }}>
          {/* Health Gauge + KPIs */}
          <div style={{ background: 'var(--surface)', padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
            <HealthGauge score={analytics.healthScore} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
              <Kpi icon={<Wrench size={13} />} label="Total Records" value={c!.total} color="var(--foreground)" />
              <Kpi icon={<AlertTriangle size={13} />} label="Open" value={c!.open} color="#f59e0b" />
              <Kpi icon={<CheckCircle2 size={13} />} label="Completed" value={c!.completed} color="#10b981" />
            </div>
          </div>

          {/* Cost KPIs */}
          <div style={{ background: 'var(--surface)', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ ...mono, fontSize: '0.5rem', letterSpacing: '0.14em', color: 'var(--muted-foreground)', textTransform: 'uppercase' }}>Cost Overview</div>
            <div style={{ ...display, fontSize: '1.8rem', fontWeight: 700, color: 'var(--foreground)', lineHeight: 1 }}>{inr(c!.totalCost)}</div>
            <div style={{ ...mono, fontSize: '0.55rem', color: 'var(--text-muted)' }}>Total maintenance spend</div>
            <div style={{ display: 'flex', gap: '1rem', marginTop: 4 }}>
              <div><div style={{ ...display, fontSize: '1.1rem', fontWeight: 700, color: '#f59e0b' }}>{inr(c!.openCost)}</div><div style={{ ...mono, fontSize: '0.45rem', color: 'var(--text-faint)' }}>OPEN COST</div></div>
              <div><div style={{ ...display, fontSize: '1.1rem', fontWeight: 700, color: '#3b82f6' }}>{inr(c!.avgCompletedCost)}</div><div style={{ ...mono, fontSize: '0.45rem', color: 'var(--text-faint)' }}>AVG COST</div></div>
              <div><div style={{ ...display, fontSize: '1.1rem', fontWeight: 700, color: '#8b5cf6' }}>{c!.avgDowntimeDays.toFixed(1)}d</div><div style={{ ...mono, fontSize: '0.45rem', color: 'var(--text-faint)' }}>AVG DOWNTIME</div></div>
            </div>
          </div>

          {/* Cost Trend Chart */}
          <div style={{ background: 'var(--surface)', padding: '1.25rem' }}>
            <div style={{ ...mono, fontSize: '0.5rem', letterSpacing: '0.14em', color: 'var(--muted-foreground)', textTransform: 'uppercase', marginBottom: 8 }}>
              <TrendingUp size={11} style={{ display: 'inline', marginRight: 4 }} /> Monthly Cost Trend
            </div>
            <CostChart data={analytics.costTrend} />
          </div>
        </div>
      )}

      {/* AI Insights */}
      {analytics && analytics.insights.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.6rem', marginBottom: '1.5rem' }}>
          {analytics.insights.map((ins, i) => (
            <div key={i} style={{ background: 'var(--card)', border: `1px solid ${ins.type === 'alert' ? 'rgba(239,68,68,0.2)' : ins.type === 'warning' ? 'rgba(245,158,11,0.2)' : 'rgba(16,185,129,0.2)'}`, padding: '0.85rem 1rem' }}>
              <div className="flex items-center gap-2" style={{ marginBottom: 4 }}>
                {ins.type === 'alert' ? <AlertCircle size={13} color="#ef4444" /> : ins.type === 'warning' ? <AlertTriangle size={13} color="#f59e0b" /> : <ShieldCheck size={13} color="#10b981" />}
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--foreground)' }}>{ins.title}</span>
              </div>
              <p style={{ ...mono, fontSize: '0.58rem', color: 'var(--text-muted)', lineHeight: 1.6, margin: 0 }}>{ins.text}</p>
            </div>
          ))}
        </div>
      )}

      {/* Frequent Vehicles */}
      {analytics && analytics.frequentVehicles.length > 0 && (
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', padding: '1rem 1.25rem', marginBottom: '1.5rem' }}>
          <div style={{ ...mono, fontSize: '0.5rem', letterSpacing: '0.14em', color: 'var(--muted-foreground)', textTransform: 'uppercase', marginBottom: 8 }}>
            <Activity size={11} style={{ display: 'inline', marginRight: 4 }} /> Frequently Repaired Vehicles
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            {analytics.frequentVehicles.map((v, i) => (
              <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border-faint)', padding: '0.6rem 0.85rem', minWidth: 140 }}>
                <div style={{ ...mono, fontSize: '0.68rem', color: 'var(--foreground)', fontWeight: 600 }}>{v.registration_number}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{v.model}</div>
                <div className="flex items-center gap-3" style={{ marginTop: 4 }}>
                  <span style={{ ...mono, fontSize: '0.55rem', color: '#f59e0b' }}>{v.maintenance_count}× repairs</span>
                  <span style={{ ...mono, fontSize: '0.55rem', color: 'var(--text-faint)' }}>{inr(v.total_cost)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search & Filter */}
      <div className="flex items-center gap-3 flex-wrap mb-4">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={14} color="var(--muted-foreground)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search vehicle or description…" style={{ ...inputStyle, paddingLeft: '2.2rem' }} />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ ...inputStyle, width: 'auto', minWidth: 150, cursor: 'pointer' }}>
          <option value="">All statuses</option>
          <option value="OPEN">Open</option>
          <option value="COMPLETED">Completed</option>
        </select>
        {(search || statusFilter) && <button onClick={() => { setSearch(''); setStatusFilter(''); }} style={{ ...mono, fontSize: '0.65rem', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>CLEAR</button>}
      </div>

      {error && <div className="flex items-center gap-2 mb-4 p-3" style={errorBox}><AlertCircle size={14} color="var(--destructive)" /><span style={{ fontSize: '0.8rem', color: 'var(--destructive)' }}>{error}</span></div>}
      {actionError && <div className="flex items-center gap-2 mb-4 p-3" style={errorBox}><AlertCircle size={14} color="var(--destructive)" /><span style={{ fontSize: '0.8rem', color: 'var(--destructive)' }}>{actionError}</span></div>}

      {/* Records List */}
      <div style={{ ...mono, fontSize: '0.55rem', letterSpacing: '0.16em', color: 'var(--muted-foreground)', textTransform: 'uppercase', marginBottom: '0.6rem' }}>
        Maintenance History · {filtered.length} of {records.length} records
      </div>

      {loading ? (
        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--muted-foreground)', fontSize: '0.82rem' }}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: '3.5rem', textAlign: 'center', background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <Wrench size={28} color="var(--text-faint)" style={{ margin: '0 auto 0.75rem' }} />
          <div style={{ color: 'var(--muted-foreground)', fontSize: '0.85rem' }}>{records.length === 0 ? 'No maintenance records yet.' : 'No records match your filters.'}</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {filtered.map(m => (
            <div key={m.id} style={{ background: 'var(--card)', border: '1px solid var(--border)', padding: '1rem 1.25rem' }}>
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span style={{ ...mono, fontSize: '0.68rem', color: 'var(--text-muted)' }}>{m.registration_number}</span>
                    <MaintStatusBadge status={m.status} />
                    <span style={{ ...mono, fontSize: '0.55rem', padding: '0.15rem 0.4rem', background: 'rgba(139,92,246,0.1)', color: '#8b5cf6', border: '1px solid rgba(139,92,246,0.2)' }}>{m.maintenance_type}</span>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--foreground)', marginTop: 4 }}>{m.vehicle_model} — {m.description}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ ...display, fontSize: '1.2rem', fontWeight: 700, color: 'var(--foreground)' }}>{inr(m.cost)}</div>
                  <div style={{ ...mono, fontSize: '0.5rem', color: 'var(--text-faint)' }}>
                    <Clock size={9} style={{ display: 'inline', marginRight: 2 }} />
                    {daysBetween(m.started_at, m.completed_at)} day{daysBetween(m.started_at, m.completed_at) !== 1 ? 's' : ''} {m.status === 'OPEN' ? '(ongoing)' : ''}
                  </div>
                </div>
              </div>
              {/* Timeline */}
              <div className="flex items-center gap-2" style={{ marginTop: 8 }}>
                <span style={{ ...mono, fontSize: '0.5rem', color: '#10b981' }}>● Opened {new Date(m.started_at).toLocaleDateString()}</span>
                <div style={{ flex: 1, height: 1, background: m.status === 'COMPLETED' ? '#10b981' : 'var(--border)', opacity: 0.4 }} />
                {m.status === 'COMPLETED' && m.completed_at ? (
                  <span style={{ ...mono, fontSize: '0.5rem', color: '#3b82f6' }}>● Closed {new Date(m.completed_at).toLocaleDateString()}</span>
                ) : (
                  <span style={{ ...mono, fontSize: '0.5rem', color: '#f59e0b' }}>○ In Progress</span>
                )}
              </div>
              {/* Actions */}
              {canManage && m.status === 'OPEN' && (
                <div style={{ marginTop: 8 }}>
                  <button onClick={() => closeRecord(m.id)} style={{ ...mono, fontSize: '0.62rem', letterSpacing: '0.08em', padding: '0.35rem 0.7rem', background: 'rgba(16,185,129,0.1)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)', cursor: 'pointer' }}>
                    CLOSE MAINTENANCE
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={() => !saving && setModalOpen(false)}>
          <div className="w-full max-w-[480px]" style={{ background: 'var(--card)', border: '1px solid var(--border-strong)' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
              <h2 style={{ ...display, fontSize: '1.3rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--foreground)' }}>New Maintenance</h2>
              <button onClick={() => !saving && setModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={18} /></button>
            </div>
            <form onSubmit={submitRecord} className="px-5 py-5">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <div>
                  <label style={labelStyle}>Vehicle</label>
                  <select value={form.vehicle_id} onChange={e => setForm({ ...form, vehicle_id: e.target.value })} style={{ ...inputStyle, cursor: 'pointer' }}>
                    <option value="">— Select vehicle —</option>
                    {vehicles.map(v => <option key={v.id} value={v.id}>{v.registration_number} — {v.model} ({v.status})</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Maintenance Type</label>
                  <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} style={{ ...inputStyle, cursor: 'pointer' }}>
                    {MAINT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Description</label>
                  <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Describe the maintenance work…" rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
                </div>
                <div>
                  <label style={labelStyle}>Estimated Cost (₹)</label>
                  <input type="number" min="0" step="any" value={form.cost} onChange={e => setForm({ ...form, cost: e.target.value })} placeholder="15000" style={inputStyle} />
                </div>
              </div>
              {formError && <div className="flex items-center gap-2 mt-4 p-2.5" style={errorBox}><AlertCircle size={13} color="var(--destructive)" /><span style={{ fontSize: '0.76rem', color: 'var(--destructive)' }}>{formError}</span></div>}
              <div className="flex gap-3 mt-6">
                <button type="button" onClick={() => setModalOpen(false)} disabled={saving} style={{ flex: 1, background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border-strong)', padding: '0.6rem', cursor: 'pointer', fontSize: '0.8rem' }}>Cancel</button>
                <button type="submit" disabled={saving} style={{ flex: 1, background: 'var(--primary)', color: 'var(--primary-foreground)', fontWeight: 700, border: 'none', padding: '0.6rem', cursor: saving ? 'not-allowed' : 'pointer', fontSize: '0.8rem', opacity: saving ? 0.6 : 1 }}>{saving ? 'Creating…' : 'Create Record'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function Kpi({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number | string; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <div style={{ color }}>{icon}</div>
      <div>
        <div style={{ ...display, fontSize: '1.1rem', fontWeight: 700, lineHeight: 1, color }}>{value}</div>
        <div style={{ ...mono, fontSize: '0.42rem', letterSpacing: '0.1em', color: 'var(--muted-foreground)', textTransform: 'uppercase' }}>{label}</div>
      </div>
    </div>
  );
}
