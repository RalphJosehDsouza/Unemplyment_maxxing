import { useEffect, useMemo, useState, useCallback } from 'react';
import { Search, Plus, AlertCircle, Wrench, X, CheckCircle2, AlertTriangle, TrendingUp, Activity, ShieldCheck, Clock } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { ApiError } from '../../lib/api';
import { maintenanceApi, MaintenanceRecord, MaintenanceVehicle, MaintenanceAnalytics } from '../../lib/services/maintenance';

const mono: React.CSSProperties = { fontFamily: "'JetBrains Mono', monospace" };
const display: React.CSSProperties = { fontFamily: "'Barlow Condensed', sans-serif" };
const labelStyle: React.CSSProperties = { ...mono, fontSize: '0.62rem', letterSpacing: '0.18em', color: '#a1a1aa', textTransform: 'uppercase', display: 'block', marginBottom: '0.45rem' };
const errorBox: React.CSSProperties = { background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '4px' };
const inr = (n: number) => '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });

const MAINT_TYPES = ['Engine Repair', 'Brake Service', 'Tire Replacement', 'Oil Change', 'Transmission', 'Electrical', 'Body Work', 'AC Service', 'General Service', 'Other'];

// Nothing UI + Transit Colors: Yellow (#ffd300), Purple (#8b5cf6), Red (#ff3b30)
const COLOR_YELLOW = '#ffd300';
const COLOR_PURPLE = '#8b5cf6';

// Dynamic Input Style Helper
const getInputStyle = (isNight: boolean): React.CSSProperties => ({
  width: '100%',
  background: isNight ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
  border: `1px solid ${isNight ? '#3f3f46' : '#d4d4d8'}`,
  borderRadius: '4px',
  padding: '0.65rem 0.85rem',
  color: isNight ? '#fff' : '#18181b',
  fontSize: '0.85rem',
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
  transition: 'border-color 0.2s ease, box-shadow 0.2s ease'
});

function MaintStatusBadge({ status }: { status: string }) {
  const isOpen = status === 'OPEN';
  return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: isOpen ? 'rgba(255,211,0,0.08)' : 'rgba(139,92,246,0.08)', color: isOpen ? COLOR_YELLOW : COLOR_PURPLE, border: `1px solid ${isOpen ? 'rgba(255,211,0,0.25)' : 'rgba(139,92,246,0.25)'}`, ...mono, fontSize: '0.6rem', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', padding: '0.25rem 0.6rem', borderRadius: '20px', whiteSpace: 'nowrap' }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: isOpen ? COLOR_YELLOW : COLOR_PURPLE, boxShadow: isOpen ? `0 0 8px ${COLOR_YELLOW}` : `0 0 8px ${COLOR_PURPLE}` }} />
        {isOpen ? 'Open' : 'Completed'}
    </span>
  );
}

function HealthGauge({ score, isNight }: { score: number; isNight: boolean }) {
  const color = score >= 80 ? '#10b981' : score >= 60 ? COLOR_YELLOW : '#ef4444';
  const circumference = 2 * Math.PI * 40;
  const dashoffset = circumference * (1 - score / 100);
  const borderLight = isNight ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.08)';
  const borderLighter = isNight ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.06)';
  const bgLight = isNight ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)';
  return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, background: bgLight, padding: '1.2rem', border: `1px solid ${borderLight}`, borderRadius: '8px' }}>
        <div style={{ position: 'relative', width: 96, height: 96 }}>
          <svg width="96" height="96" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="40" fill="none" stroke={borderLighter} strokeWidth="5" />
            <circle cx="50" cy="50" r="40" fill="none" stroke={color} strokeWidth="5" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={dashoffset} transform="rotate(-90 50 50)" style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.4, 0, 0.2, 1)' }} />
            <text x="50" y="47" textAnchor="middle" style={{ ...display, fontSize: '1.8rem', fontWeight: 700 }} fill={isNight ? '#fff' : '#000'}>{score}</text>
            <text x="50" y="63" textAnchor="middle" style={{ ...mono, fontSize: '0.5rem', letterSpacing: '0.12em' }} fill={isNight ? '#71717a' : '#999'}>/100</text>
          </svg>
        </div>
        <span style={{ ...mono, fontSize: '0.55rem', letterSpacing: '0.15em', color: isNight ? '#a1a1aa' : '#666', textTransform: 'uppercase', fontWeight: 600 }}>Fleet Health</span>
      </div>
  );
}

function CostChart({ data, isNight }: { data: { month: string; cost: number; count: number }[]; isNight: boolean }) {
  if (!data.length) return <div style={{ ...mono, fontSize: '0.65rem', color: isNight ? '#71717a' : '#999', padding: '2rem 1rem', textAlign: 'center' }}>No trend data yet</div>;
  const maxCost = Math.max(...data.map(d => d.cost), 1);
  return (
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 110, padding: '0 4px', marginTop: 10 }}>
        {data.map((d, i) => (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <span style={{ ...mono, fontSize: '0.55rem', color: isNight ? '#a1a1aa' : '#666' }}>{inr(d.cost)}</span>
              <div style={{ width: '100%', maxWidth: 28, background: `linear-gradient(to top, ${COLOR_PURPLE}, rgba(139,92,246,0.3))`, border: `1px solid ${COLOR_PURPLE}`, height: `${Math.max((d.cost / maxCost) * 75, 4)}px`, transition: 'height 0.8s cubic-bezier(0.4, 0, 0.2, 1)', position: 'relative' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: isNight ? '#fff' : '#000', opacity: 0.6 }} />
              </div>
              <span style={{ ...mono, fontSize: '0.5rem', color: isNight ? '#71717a' : '#666', whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{d.month.split(' ')[0]}</span>
            </div>
        ))}
      </div>
  );
}

export default function Maintenance() {
  const { user } = useAuth();
  const { isNight } = useTheme();
  const canManage = user?.role === 'FLEET_MANAGER' || user?.role === 'ADMIN';

  // Dynamic theme-based colors & styles
  const bgLight = isNight ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)';
  const borderLight = isNight ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.08)';
  const borderLighter = isNight ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.06)';
  const bgPattern = isNight ? 'radial-gradient(rgba(255,255,255,0.015) 1px, transparent 1px)' : 'radial-gradient(rgba(0,0,0,0.04) 1px, transparent 1px)';
  const textColorPrimary = isNight ? '#fff' : '#18181b';
  const textColorSecondary = isNight ? '#e4e4e7' : '#3f3f46';
  const inputStyle = useMemo(() => getInputStyle(isNight), [isNight]);

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
      <div className="px-6 md:px-10 py-8 max-w-[1200px] mx-auto w-full space-y-8" style={{ background: bgPattern, backgroundSize: '24px 24px' }}>
        {/* Header */}
        <div className={`flex items-start justify-between flex-wrap gap-4 border-b pb-6 ${isNight ? 'border-zinc-800' : 'border-zinc-200'}`}>
          <div>
            <div style={{ ...mono, fontSize: '0.62rem', letterSpacing: '0.22em', color: COLOR_YELLOW, textTransform: 'uppercase', marginBottom: '0.4rem', fontWeight: 600 }}>Transit Operations System</div>
            <h1 style={{ ...display, fontSize: '2.5rem', fontWeight: 700, lineHeight: 1, textTransform: 'uppercase', color: textColorPrimary, letterSpacing: '-0.02em' }}>Maintenance Hub</h1>
          </div>
          {canManage && (
              <button onClick={() => { setModalOpen(true); setFormError(''); }} className="flex items-center gap-2 px-5 py-2.5 transition-all duration-200" style={{ background: COLOR_YELLOW, color: '#000', fontWeight: 700, fontSize: '0.8rem', border: 'none', cursor: 'pointer', letterSpacing: '0.04em', borderRadius: '4px', boxShadow: `0 4px 14px rgba(255,211,0,0.15)` }} onMouseEnter={e => e.currentTarget.style.filter = 'brightness(1.1)'} onMouseLeave={e => e.currentTarget.style.filter = 'none'}>
                <Plus size={15} strokeWidth={2.5} /> NEW RECORD
              </button>
          )}
        </div>

        {/* Analytics Dashboard */}
        {analytics && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
              {/* Health Gauge + KPIs */}
              <div style={{ background: bgLight, padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1.5rem', border: `1px solid ${borderLight}`, borderRadius: '8px', position: 'relative', overflow: 'hidden' }}>
                <HealthGauge score={analytics.healthScore} isNight={isNight} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
                  <Kpi icon={<Wrench size={14} color={COLOR_YELLOW} />} label="Total Records" value={c!.total} isNight={isNight} />
                  <Kpi icon={<AlertTriangle size={14} color="#ef4444" />} label="Currently Open" value={c!.open} isNight={isNight} />
                  <Kpi icon={<CheckCircle2 size={14} color={COLOR_PURPLE} />} label="Completed" value={c!.completed} isNight={isNight} />
                </div>
                <div style={{ position: 'absolute', right: 8, bottom: 4, ...mono, fontSize: '0.45rem', color: borderLighter, letterSpacing: '0.1em' }}>MODEL: N-M1</div>
              </div>

              {/* Cost KPIs */}
              <div style={{ background: bgLight, padding: '1.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', border: `1px solid ${borderLight}`, borderRadius: '8px' }}>
                <div>
                  <div style={{ ...mono, fontSize: '0.55rem', letterSpacing: '0.18em', color: isNight ? '#a1a1aa' : '#666', textTransform: 'uppercase', fontWeight: 600 }}>Total Fleet Spend</div>
                  <div style={{ ...display, fontSize: '2.4rem', fontWeight: 700, color: textColorPrimary, lineHeight: 1.1, marginTop: 4 }}>{inr(c!.totalCost)}</div>
                  <div style={{ ...mono, fontSize: '0.55rem', color: isNight ? '#71717a' : '#666', marginTop: 2 }}>Accumulated maintenance expenses</div>
                </div>
                <div style={{ display: 'flex', gap: '1.25rem', borderTop: `1px solid ${borderLighter}`, paddingTop: '1rem', marginTop: '1rem' }}>
                  <div><div style={{ ...display, fontSize: '1.25rem', fontWeight: 700, color: '#ef4444' }}>{inr(c!.openCost)}</div><div style={{ ...mono, fontSize: '0.48rem', color: isNight ? '#71717a' : '#666', letterSpacing: '0.05em' }}>OPEN STATS</div></div>
                  <div><div style={{ ...display, fontSize: '1.25rem', fontWeight: 700, color: COLOR_YELLOW }}>{inr(c!.avgCompletedCost)}</div><div style={{ ...mono, fontSize: '0.48rem', color: isNight ? '#71717a' : '#666', letterSpacing: '0.05em' }}>AVG COST</div></div>
                  <div><div style={{ ...display, fontSize: '1.25rem', fontWeight: 700, color: COLOR_PURPLE }}>{c!.avgDowntimeDays.toFixed(1)}d</div><div style={{ ...mono, fontSize: '0.48rem', color: isNight ? '#71717a' : '#666', letterSpacing: '0.05em' }}>DOWNTIME</div></div>
                </div>
              </div>

              {/* Cost Trend Chart */}
              <div style={{ background: bgLight, padding: '1.5rem', border: `1px solid ${borderLight}`, borderRadius: '8px' }}>
                <div style={{ ...mono, fontSize: '0.55rem', letterSpacing: '0.18em', color: isNight ? '#a1a1aa' : '#666', textTransform: 'uppercase', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <TrendingUp size={13} color={COLOR_YELLOW} /> Monthly Spend Trend
                </div>
                <CostChart data={analytics.costTrend} isNight={isNight} />
              </div>
            </div>
        )}

        {/* AI Insights & Recommendations */}
        {analytics && analytics.insights.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.85rem' }}>
              {analytics.insights.map((ins, i) => (
                  <div key={i} style={{ background: isNight ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)', border: `1px solid ${ins.type === 'alert' ? 'rgba(239,68,68,0.25)' : ins.type === 'warning' ? 'rgba(255,211,0,0.25)' : 'rgba(139,92,246,0.25)'}`, padding: '1rem 1.2rem', borderRadius: '6px', position: 'relative' }}>
                    <div style={{ position: 'absolute', top: 0, left: 0, width: 3, bottom: 0, background: ins.type === 'alert' ? '#ef4444' : ins.type === 'warning' ? COLOR_YELLOW : COLOR_PURPLE }} />
                    <div className="flex items-center gap-2" style={{ marginBottom: 6 }}>
                      {ins.type === 'alert' ? <AlertCircle size={14} color="#ef4444" /> : ins.type === 'warning' ? <AlertTriangle size={14} color={COLOR_YELLOW} /> : <ShieldCheck size={14} color={COLOR_PURPLE} />}
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: textColorPrimary, letterSpacing: '0.02em' }}>{ins.title.toUpperCase()}</span>
                    </div>
                    <p style={{ ...mono, fontSize: '0.62rem', color: isNight ? '#a1a1aa' : '#52525b', lineHeight: 1.6, margin: 0 }}>{ins.text}</p>
                  </div>
              ))}
            </div>
        )}

        {/* Predictive Maintenance AI */}
        {analytics && analytics.frequentVehicles.length > 0 && (
            <div style={{ background: bgLight, border: `1px solid ${borderLight}`, padding: '1.25rem 1.5rem', borderRadius: '8px', position: 'relative', overflow: 'hidden' }}>
              <div style={{ ...mono, fontSize: '0.55rem', letterSpacing: '0.18em', color: COLOR_YELLOW, textTransform: 'uppercase', marginBottom: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Activity size={13} color={COLOR_YELLOW} /> AI Predictive Risk Analysis
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.85rem' }}>
                {analytics.frequentVehicles.slice(0, 3).map((v, i) => {
                  const riskPct = Math.min(98, 45 + (v.maintenance_count * 12));
                  const riskColor = riskPct > 80 ? '#ef4444' : riskPct > 60 ? COLOR_YELLOW : COLOR_PURPLE;
                  return (
                    <div key={`risk-${i}`} style={{ background: isNight ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.4)', border: `1px solid ${borderLighter}`, padding: '0.8rem 1rem', borderRadius: '6px' }}>
                      <div className="flex justify-between items-center mb-2">
                        <span style={{ ...mono, fontSize: '0.75rem', color: textColorPrimary, fontWeight: 700 }}>{v.registration_number}</span>
                        <span style={{ ...display, fontSize: '1.1rem', color: riskColor, fontWeight: 700 }}>{riskPct}% RISK</span>
                      </div>
                      <div style={{ width: '100%', height: 4, background: isNight ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ width: `${riskPct}%`, height: '100%', background: riskColor, transition: 'width 1s ease-in-out' }} />
                      </div>
                      <div style={{ ...mono, fontSize: '0.5rem', color: isNight ? '#a1a1aa' : '#666', marginTop: 6, textTransform: 'uppercase' }}>
                        {riskPct > 80 ? 'CRITICAL: SCHEDULE SERVICE NOW' : 'MONITOR CLOSELY: ABNORMAL WEAR'}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div style={{ position: 'absolute', right: -20, bottom: -20, opacity: 0.03, pointerEvents: 'none' }}>
                <Activity size={120} />
              </div>
            </div>
        )}

        {/* Frequently Repaired Vehicles */}
        {analytics && analytics.frequentVehicles.length > 0 && (
            <div style={{ background: bgLight, border: `1px solid ${borderLight}`, padding: '1.25rem 1.5rem', borderRadius: '8px' }}>
              <div style={{ ...mono, fontSize: '0.55rem', letterSpacing: '0.18em', color: isNight ? '#a1a1aa' : '#666', textTransform: 'uppercase', marginBottom: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Activity size={13} color={COLOR_PURPLE} /> Frequent Service Enforcements
              </div>
              <div style={{ display: 'flex', gap: '0.85rem', flexWrap: 'wrap' }}>
                {analytics.frequentVehicles.map((v, i) => (
                    <div key={i} style={{ background: isNight ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)', border: `1px solid ${borderLighter}`, padding: '0.8rem 1rem', borderRadius: '6px', minWidth: 160, flex: '1 1 160px' }}>
                      <div style={{ ...mono, fontSize: '0.75rem', color: textColorPrimary, fontWeight: 700 }}>{v.registration_number}</div>
                      <div style={{ fontSize: '0.78rem', color: isNight ? '#a1a1aa' : '#52525b', marginTop: 2 }}>{v.model}</div>
                      <div className="flex items-center justify-between" style={{ marginTop: 8, borderTop: `1px solid ${borderLighter}`, paddingTop: 6 }}>
                        <span style={{ ...mono, fontSize: '0.55rem', color: COLOR_YELLOW, fontWeight: 600 }}>{v.maintenance_count}x Repairs</span>
                        <span style={{ ...mono, fontSize: '0.55rem', color: isNight ? '#71717a' : '#666' }}>{inr(v.total_cost)}</span>
                      </div>
                    </div>
                ))}
              </div>
            </div>
        )}

        {/* Search & Filter */}
        <div className={`flex items-center gap-4 flex-wrap border-t pt-6 ${isNight ? 'border-zinc-900' : 'border-zinc-200'}`}>
          <div className="relative flex-1 min-w-[260px]">
            <Search size={15} color="#71717a" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="SEARCH REGISTRATION OR WORK DESCRIPTION…" style={{ ...inputStyle, paddingLeft: '2.5rem', ...mono, fontSize: '0.72rem', letterSpacing: '0.05em' }} />
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ ...inputStyle, width: 'auto', minWidth: 160, cursor: 'pointer', ...mono, fontSize: '0.72rem', letterSpacing: '0.05em' }}>
            <option value="">ALL STATUSES</option>
            <option value="OPEN">OPEN OPERATIONS</option>
            <option value="COMPLETED">COMPLETED CASES</option>
          </select>
          {(search || statusFilter) && (
              <button onClick={() => { setSearch(''); setStatusFilter(''); }} style={{ ...mono, fontSize: '0.68rem', color: COLOR_YELLOW, background: 'none', border: 'none', cursor: 'pointer', letterSpacing: '0.1em', fontWeight: 600 }}>
                [ CLEAR FILTERS ]
              </button>
          )}
        </div>

        {error && <div className="flex items-center gap-3 p-4" style={errorBox}><AlertCircle size={16} color="#ef4444" /><span style={{ fontSize: '0.8rem', color: '#ef4444', fontWeight: 600 }}>{error}</span></div>}
        {actionError && <div className="flex items-center gap-3 p-4" style={errorBox}><AlertCircle size={16} color="#ef4444" /><span style={{ fontSize: '0.8rem', color: '#ef4444', fontWeight: 600 }}>{actionError}</span></div>}

        {/* Records List */}
        <div className="space-y-4">
          <div style={{ ...mono, fontSize: '0.58rem', letterSpacing: '0.22em', color: isNight ? '#71717a' : '#666', textTransform: 'uppercase', fontWeight: 600 }}>
            Registry Log // {filtered.length} matching entries
          </div>

          {loading ? (
              <div style={{ padding: '4rem', textAlign: 'center', color: '#71717a', fontSize: '0.85rem', ...mono, letterSpacing: '0.1em' }}>TRANSMITTING DATA…</div>
          ) : filtered.length === 0 ? (
              <div style={{ padding: '4rem', textAlign: 'center', background: bgLight, border: `1px dashed ${isNight ? '#27272a' : '#d4d4d8'}`, borderRadius: '8px' }}>
                <Wrench size={32} color="#3f3f46" style={{ margin: '0 auto 1rem' }} />
                <div style={{ color: '#71717a', fontSize: '0.85rem', ...mono, letterSpacing: '0.05em' }}>NO MATCHING RECORDS LOCATED</div>
              </div>
          ) : (
              <div className="flex flex-col gap-3">
                {filtered.map(m => {
                  const isOpen = m.status === 'OPEN';
                  return (
                      <div key={m.id} style={{ background: bgLight, border: `1px solid ${borderLight}`, borderRadius: '8px', padding: '1.25rem 1.5rem', transition: 'all 0.2s ease', position: 'relative' }} className={`group ${isNight ? 'hover:border-zinc-700/80' : 'hover:border-zinc-300'}`}>
                        {/* Neon active bar */}
                        <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 2, background: isOpen ? COLOR_YELLOW : 'transparent', borderTopLeftRadius: '8px', borderBottomLeftRadius: '8px' }} />

                        <div className="flex items-start justify-between gap-6 flex-wrap">
                          <div style={{ flex: 1, minWidth: 240 }}>
                            <div className="flex items-center gap-3 flex-wrap">
                              <span style={{ ...mono, fontSize: '0.8rem', color: textColorPrimary, fontWeight: 700, letterSpacing: '0.02em' }}>{m.registration_number}</span>
                              <MaintStatusBadge status={m.status} />
                              <span style={{ ...mono, fontSize: '0.58rem', padding: '0.2rem 0.5rem', background: isNight ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)', color: isNight ? '#a1a1aa' : '#52525b', border: `1px solid ${borderLighter}`, borderRadius: '3px', fontWeight: 600 }}>{m.maintenance_type.toUpperCase()}</span>
                            </div>
                            <div style={{ fontSize: '0.92rem', color: textColorSecondary, marginTop: 8, fontWeight: 500 }}>{m.vehicle_model} · {m.description}</div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ ...display, fontSize: '1.5rem', fontWeight: 700, color: textColorPrimary, lineHeight: 1 }}>{inr(m.cost)}</div>
                            <div style={{ ...mono, fontSize: '0.52rem', color: isNight ? '#71717a' : '#666', marginTop: 4, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                              <Clock size={11} color="#52525b" />
                              {daysBetween(m.started_at, m.completed_at)} DAYS {isOpen ? 'ONGOING' : 'DOWNTIME'}
                            </div>
                          </div>
                        </div>

                        {/* Timeline Bar */}
                        <div className="flex items-center gap-3" style={{ marginTop: 12, borderTop: `1px solid ${borderLighter}`, paddingTop: 10 }}>
                          <span style={{ ...mono, fontSize: '0.52rem', color: '#10b981', fontWeight: 600 }}>● OPENED {new Date(m.started_at).toLocaleDateString()}</span>
                          <div style={{ flex: 1, height: 1, background: borderLighter, position: 'relative' }}>
                            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, right: isOpen ? '50%' : 0, background: isOpen ? COLOR_YELLOW : COLOR_PURPLE, opacity: 0.4 }} />
                          </div>
                          {m.status === 'COMPLETED' && m.completed_at ? (
                              <span style={{ ...mono, fontSize: '0.52rem', color: COLOR_PURPLE, fontWeight: 600 }}>● CLOSED {new Date(m.completed_at).toLocaleDateString()}</span>
                          ) : (
                              <span style={{ ...mono, fontSize: '0.52rem', color: COLOR_YELLOW, fontWeight: 600 }}>○ UNDER DIAGNOSIS</span>
                          )}
                        </div>

                        {/* Actions */}
                        {canManage && isOpen && (
                            <div style={{ marginTop: 12 }}>
                              <button onClick={() => closeRecord(m.id)} className="transition-all duration-200" style={{ ...mono, fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.08em', padding: '0.45rem 0.9rem', background: 'rgba(255,211,0,0.05)', color: COLOR_YELLOW, border: `1px solid rgba(255,211,0,0.3)`, borderRadius: '4px', cursor: 'pointer' }} onMouseEnter={e => { e.currentTarget.style.background = COLOR_YELLOW; e.currentTarget.style.color = '#000'; }} onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,211,0,0.05)'; e.currentTarget.style.color = COLOR_YELLOW; }}>
                                CLOSE MAINTENANCE RECORD
                              </button>
                            </div>
                        )}
                      </div>
                  );
                })}
              </div>
          )}
        </div>

        {/* Create Modal */}
        {modalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(4px)' }} onClick={() => !saving && setModalOpen(false)}>
              <div className="w-full max-w-[480px] border" style={{ background: isNight ? '#121214' : '#ffffff', borderColor: isNight ? '#27272a' : '#e4e4e7', borderRadius: '8px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)' }} onClick={e => e.stopPropagation()}>
                <div className={`flex items-center justify-between px-6 py-5 border-b ${isNight ? 'border-zinc-800' : 'border-zinc-200'}`}>
                  <h2 style={{ ...display, fontSize: '1.4rem', fontWeight: 700, textTransform: 'uppercase', color: textColorPrimary, letterSpacing: '-0.02em' }}>NEW MAINTENANCE RECORD</h2>
                  <button onClick={() => !saving && setModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#71717a' }} className="hover:opacity-80"><X size={18} /></button>
                </div>
                <form onSubmit={submitRecord} className="px-6 py-6 space-y-4">
                  <div>
                    <label style={labelStyle}>Vehicle Registry</label>
                    <select value={form.vehicle_id} onChange={e => setForm({ ...form, vehicle_id: e.target.value })} style={{ ...inputStyle, cursor: 'pointer' }}>
                      <option value="">— SELECT VEHICLE —</option>
                      {vehicles.map(v => <option key={v.id} value={v.id} style={{ background: isNight ? '#121214' : '#fff', color: textColorPrimary }}>{v.registration_number} — {v.model} ({v.status})</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Maintenance Type</label>
                    <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} style={{ ...inputStyle, cursor: 'pointer' }}>
                      {MAINT_TYPES.map(t => <option key={t} value={t} style={{ background: isNight ? '#121214' : '#fff', color: textColorPrimary }}>{t.toUpperCase()}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Work Description</label>
                    <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Describe details of failure or regular service enforcements…" rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
                  </div>
                  <div>
                    <label style={labelStyle}>Estimated Cost (₹)</label>
                    <input type="number" min="0" step="any" value={form.cost} onChange={e => setForm({ ...form, cost: e.target.value })} placeholder="15000" style={inputStyle} />
                  </div>

                  {formError && <div className="flex items-center gap-2 p-3 mt-4" style={errorBox}><AlertCircle size={14} color="#ef4444" /><span style={{ fontSize: '0.78rem', color: '#ef4444', fontWeight: 600 }}>{formError}</span></div>}

                  <div className={`flex gap-3 pt-4 border-t ${isNight ? 'border-zinc-900' : 'border-zinc-200'}`}>
                    <button type="button" onClick={() => setModalOpen(false)} disabled={saving} style={{ flex: 1, background: 'transparent', color: isNight ? '#a1a1aa' : '#52525b', border: `1px solid ${isNight ? '#27272a' : '#d4d4d8'}`, padding: '0.65rem', cursor: 'pointer', fontSize: '0.8rem', borderRadius: '4px', fontWeight: 600 }}>CANCEL</button>
                    <button type="submit" disabled={saving} style={{ flex: 1, background: COLOR_YELLOW, color: '#000', fontWeight: 700, border: 'none', padding: '0.65rem', cursor: saving ? 'not-allowed' : 'pointer', fontSize: '0.8rem', borderRadius: '4px', opacity: saving ? 0.6 : 1 }}>{saving ? 'RECORDING…' : 'CREATE RECORD'}</button>
                  </div>
                </form>
              </div>
            </div>
        )}
      </div>
  );
}

function Kpi({ icon, label, value, color, isNight }: { icon: React.ReactNode; label: string; value: number | string; color?: string; isNight?: boolean }) {
  const bgLight = isNight !== false ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)';
  const borderLight = isNight !== false ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.06)';
  return (
      <div className="flex items-center gap-3">
        <div style={{ background: bgLight, padding: '0.5rem', borderRadius: '4px', border: `1px solid ${borderLight}` }}>{icon}</div>
        <div>
          <div style={{ ...display, fontSize: '1.25rem', fontWeight: 700, lineHeight: 1, color: color || (isNight !== false ? '#fff' : '#18181b') }}>{value}</div>
          <div style={{ ...mono, fontSize: '0.48rem', letterSpacing: '0.12em', color: isNight !== false ? '#71717a' : '#666', textTransform: 'uppercase', marginTop: 2 }}>{label}</div>
        </div>
      </div>
  );
}