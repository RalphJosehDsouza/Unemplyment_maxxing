import { useEffect, useMemo, useState, useCallback } from 'react';
import { Search, Plus, AlertCircle, Route as RouteIcon, Send, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ApiError } from '../../lib/api';
import { tripsApi } from '../../lib/services/trips';
import {
  TRIP_STATUSES, TRIP_STATUS_STYLES,
  Trip, TripStatus, AvailableVehicle, AvailableDriver,
} from '../../lib/constants';

const mono: React.CSSProperties = { fontFamily: "'JetBrains Mono', monospace" };
const display: React.CSSProperties = { fontFamily: "'Barlow Condensed', sans-serif" };
const labelStyle: React.CSSProperties = {
  ...mono, fontSize: '0.58rem', letterSpacing: '0.16em',
  color: 'var(--muted-foreground)', textTransform: 'uppercase',
  display: 'block', marginBottom: '0.4rem',
};
const inputStyle: React.CSSProperties = {
  width: '100%', background: 'var(--input-background)',
  border: '1px solid var(--border-strong)', padding: '0.6rem 0.75rem',
  color: 'var(--foreground)', fontSize: '0.82rem', outline: 'none',
  boxSizing: 'border-box', fontFamily: 'inherit',
};
const errorBox: React.CSSProperties = {
  background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.3)',
};

interface FormState {
  source: string; destination: string;
  vehicle_id: string; driver_id: string;
  cargo_weight: string; planned_distance: string;
}
const EMPTY: FormState = {
  source: '', destination: '', vehicle_id: '', driver_id: '',
  cargo_weight: '', planned_distance: '',
};

function TripStatusBadge({ status }: { status: string }) {
  const s = TRIP_STATUS_STYLES[status as TripStatus] || {
    bg: 'rgba(255,255,255,0.06)', fg: '#a0a0a0', border: 'rgba(255,255,255,0.12)', label: status,
  };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
      background: s.bg, color: s.fg, border: `1px solid ${s.border}`,
      ...mono, fontSize: '0.6rem', letterSpacing: '0.08em',
      textTransform: 'uppercase', padding: '0.22rem 0.5rem', whiteSpace: 'nowrap',
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: s.fg }} />
      {s.label}
    </span>
  );
}

function LifecycleStepper({ current }: { current: TripStatus }) {
  const steps: { key: TripStatus; label: string; icon: typeof Clock }[] = [
    { key: 'DRAFT', label: 'Draft', icon: Clock },
    { key: 'DISPATCHED', label: 'Dispatched', icon: Send },
    { key: 'COMPLETED', label: 'Completed', icon: CheckCircle2 },
    { key: 'CANCELLED', label: 'Cancelled', icon: XCircle },
  ];
  const idx = steps.findIndex((s) => s.key === current);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
      {steps.map((step, i) => {
        const Icon = step.icon;
        const active = i === idx;
        const passed = i < idx && current !== 'CANCELLED';
        const fg = active
          ? TRIP_STATUS_STYLES[step.key].fg
          : passed ? '#10b981' : 'var(--text-faint)';
        return (
          <div key={step.key} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            {i > 0 && <div style={{ width: 20, height: 1, background: fg, opacity: 0.4 }} />}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <Icon size={14} color={fg} />
              <span style={{ ...mono, fontSize: '0.5rem', color: fg, letterSpacing: '0.06em' }}>{step.label}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function Trips() {
  const { user } = useAuth();
  const canManage = user?.role === 'FLEET_MANAGER' || user?.role === 'ADMIN';

  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [vehicles, setVehicles] = useState<AvailableVehicle[]>([]);
  const [drivers, setDrivers] = useState<AvailableDriver[]>([]);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [actionError, setActionError] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const data = await tripsApi.list();
      setTrips(data.trips);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to load trips');
    } finally { setLoading(false); }
  }, []);

  const loadOptions = useCallback(async () => {
    try {
      const [v, d] = await Promise.all([tripsApi.availableVehicles(), tripsApi.availableDrivers()]);
      setVehicles(v.vehicles); setDrivers(d.drivers);
    } catch { /* silently fail */ }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (showCreate) loadOptions(); }, [showCreate, loadOptions]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return trips.filter((t) => {
      if (statusFilter && t.status !== statusFilter) return false;
      if (q && !t.source.toLowerCase().includes(q) && !t.destination.toLowerCase().includes(q)
        && !(t.vehicle_registration || '').toLowerCase().includes(q)
        && !(t.driver_name || '').toLowerCase().includes(q)) return false;
      return true;
    });
  }, [trips, search, statusFilter]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { DRAFT: 0, DISPATCHED: 0, COMPLETED: 0, CANCELLED: 0 };
    trips.forEach((t) => (c[t.status] = (c[t.status] || 0) + 1));
    return c;
  }, [trips]);

  const selectedVehicle = vehicles.find((v) => v.id === form.vehicle_id);
  const capacityExceeded = selectedVehicle && Number(form.cargo_weight) > selectedVehicle.max_load_capacity;

  async function submitTrip(e: React.FormEvent) {
    e.preventDefault(); setFormError('');
    if (!form.source.trim() || !form.destination.trim()) { setFormError('Source and destination are required.'); return; }
    if (capacityExceeded) { setFormError('Cargo weight exceeds vehicle capacity — dispatch will be blocked.'); return; }
    setSaving(true);
    try {
      await tripsApi.create({
        source: form.source.trim(), destination: form.destination.trim(),
        vehicle_id: form.vehicle_id || undefined, driver_id: form.driver_id || undefined,
        cargo_weight: Number(form.cargo_weight || 0), planned_distance: Number(form.planned_distance || 0),
      });
      setForm(EMPTY); setShowCreate(false); await load();
    } catch (e) { setFormError(e instanceof ApiError ? e.message : 'Failed to create trip'); }
    finally { setSaving(false); }
  }

  async function doAction(id: string, action: 'dispatch' | 'complete' | 'cancel') {
    setActionError('');
    try {
      if (action === 'dispatch') await tripsApi.dispatch(id);
      else if (action === 'complete') await tripsApi.complete(id);
      else await tripsApi.cancel(id);
      await load(); await loadOptions();
    } catch (e) { setActionError(e instanceof ApiError ? e.message : `Failed to ${action} trip`); }
  }

  const timeAgo = (d: string) => {
    const mins = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins} min`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} hr`;
    return `${Math.floor(hrs / 24)} d`;
  };

  return (
    <div className="px-6 md:px-10 py-8" style={{ maxWidth: 1400 }}>
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
        <div>
          <div style={{ ...mono, fontSize: '0.6rem', letterSpacing: '0.2em', color: 'var(--muted-foreground)', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
            Trip Dispatcher
          </div>
          <h1 style={{ ...display, fontSize: '2.2rem', fontWeight: 700, lineHeight: 1, textTransform: 'uppercase', color: 'var(--foreground)' }}>Trips</h1>
        </div>
        {canManage && (
          <button onClick={() => { setShowCreate(!showCreate); setFormError(''); }}
            className="flex items-center gap-2"
            style={{ background: 'var(--primary)', color: 'var(--primary-foreground)', fontWeight: 700, fontSize: '0.8rem', padding: '0.6rem 1rem', border: 'none', cursor: 'pointer', letterSpacing: '0.03em' }}>
            <Plus size={15} strokeWidth={2.5} />
            New Trip
          </button>
        )}
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-px mb-6" style={{ background: 'var(--border)', border: '1px solid var(--border)' }}>
        {TRIP_STATUSES.map((s) => (
          <button key={s} onClick={() => setStatusFilter(statusFilter === s ? '' : s)}
            className="text-left p-4 transition-colors"
            style={{ background: statusFilter === s ? 'var(--secondary)' : 'var(--surface)', border: 'none', cursor: 'pointer' }}>
            <div style={{ ...display, fontSize: '1.9rem', fontWeight: 700, lineHeight: 1, color: TRIP_STATUS_STYLES[s].fg }}>{counts[s] || 0}</div>
            <div style={{ ...mono, fontSize: '0.58rem', letterSpacing: '0.12em', color: 'var(--muted-foreground)', textTransform: 'uppercase', marginTop: '0.4rem' }}>
              {TRIP_STATUS_STYLES[s].label}
            </div>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="flex items-center gap-3 flex-wrap mb-5">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={14} color="var(--muted-foreground)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search source, destination, vehicle, driver…"
            style={{ ...inputStyle, paddingLeft: '2.2rem' }} />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          style={{ ...inputStyle, width: 'auto', minWidth: 150, cursor: 'pointer' }}>
          <option value="">All statuses</option>
          {TRIP_STATUSES.map((s) => <option key={s} value={s}>{TRIP_STATUS_STYLES[s].label}</option>)}
        </select>
        {(search || statusFilter) && (
          <button onClick={() => { setSearch(''); setStatusFilter(''); }}
            style={{ ...mono, fontSize: '0.65rem', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', letterSpacing: '0.08em' }}>CLEAR</button>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 mb-4 p-3" style={errorBox}>
          <AlertCircle size={14} color="var(--destructive)" />
          <span style={{ fontSize: '0.8rem', color: 'var(--destructive)' }}>{error}</span>
        </div>
      )}
      {actionError && (
        <div className="flex items-center gap-2 mb-4 p-3" style={errorBox}>
          <AlertCircle size={14} color="var(--destructive)" />
          <span style={{ fontSize: '0.8rem', color: 'var(--destructive)' }}>{actionError}</span>
        </div>
      )}

      {/* Main grid: Create form + Live board */}
      <div style={{ display: 'grid', gridTemplateColumns: showCreate && canManage ? '380px 1fr' : '1fr', gap: '1.25rem', alignItems: 'start' }}>

        {/* ── Create Trip Panel ── */}
        {showCreate && canManage && (
          <div style={{ background: 'var(--card)', border: '1px solid var(--border-strong)', position: 'sticky', top: 80 }}>
            <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
              <div style={{ ...mono, fontSize: '0.55rem', letterSpacing: '0.16em', color: 'var(--muted-foreground)', textTransform: 'uppercase', marginBottom: 4 }}>Trip Lifecycle</div>
              <LifecycleStepper current="DRAFT" />
            </div>
            <form onSubmit={submitTrip} className="px-5 py-5" style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div style={{ ...display, fontSize: '1.1rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--foreground)', marginBottom: -4 }}>Create Trip</div>

              <div>
                <label style={labelStyle}>Source</label>
                <input value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} placeholder="e.g. Gandhinagar Depot" style={inputStyle} autoFocus />
              </div>
              <div>
                <label style={labelStyle}>Destination</label>
                <input value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} placeholder="e.g. Ahmedabad Hub" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Vehicle (Available Only)</label>
                <select value={form.vehicle_id} onChange={(e) => setForm({ ...form, vehicle_id: e.target.value })} style={{ ...inputStyle, cursor: 'pointer' }}>
                  <option value="">— Select vehicle —</option>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>{v.registration_number} — {v.model} ({v.max_load_capacity} kg capacity)</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Driver (Available Only)</label>
                <select value={form.driver_id} onChange={(e) => setForm({ ...form, driver_id: e.target.value })} style={{ ...inputStyle, cursor: 'pointer' }}>
                  <option value="">— Select driver —</option>
                  {drivers.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Cargo Weight (kg)</label>
                <input type="number" min="0" step="any" value={form.cargo_weight} onChange={(e) => setForm({ ...form, cargo_weight: e.target.value })} placeholder="200" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Planned Distance (km)</label>
                <input type="number" min="0" step="any" value={form.planned_distance} onChange={(e) => setForm({ ...form, planned_distance: e.target.value })} placeholder="58" style={inputStyle} />
              </div>

              {/* Capacity warning */}
              {selectedVehicle && form.cargo_weight && (
                <div style={{
                  padding: '0.6rem 0.75rem',
                  border: `1px solid ${capacityExceeded ? 'rgba(239,68,68,0.4)' : 'rgba(16,185,129,0.3)'}`,
                  background: capacityExceeded ? 'rgba(239,68,68,0.06)' : 'rgba(16,185,129,0.06)',
                }}>
                  <div style={{ ...mono, fontSize: '0.6rem', color: capacityExceeded ? '#ef4444' : '#10b981', letterSpacing: '0.06em' }}>
                    Vehicle Capacity: {selectedVehicle.max_load_capacity} kg
                  </div>
                  <div style={{ ...mono, fontSize: '0.6rem', color: capacityExceeded ? '#ef4444' : '#10b981', letterSpacing: '0.06em' }}>
                    Cargo Weight: {form.cargo_weight} kg
                  </div>
                  {capacityExceeded && (
                    <div style={{ ...mono, fontSize: '0.6rem', color: '#ef4444', fontWeight: 700, marginTop: 2, letterSpacing: '0.06em' }}>
                      ✕ Capacity exceeded by {Number(form.cargo_weight) - selectedVehicle.max_load_capacity} kg — dispatch blocked
                    </div>
                  )}
                </div>
              )}

              {formError && (
                <div className="flex items-center gap-2 p-2.5" style={errorBox}>
                  <AlertCircle size={13} color="var(--destructive)" />
                  <span style={{ fontSize: '0.76rem', color: 'var(--destructive)' }}>{formError}</span>
                </div>
              )}

              <div className="flex gap-3" style={{ marginTop: 4 }}>
                <button type="submit" disabled={saving}
                  style={{ flex: 1, background: 'var(--primary)', color: 'var(--primary-foreground)', fontWeight: 700, border: 'none', padding: '0.6rem', cursor: saving ? 'not-allowed' : 'pointer', fontSize: '0.8rem', opacity: saving ? 0.6 : 1 }}>
                  {saving ? 'Creating…' : 'Create (Draft)'}
                </button>
                <button type="button" onClick={() => setShowCreate(false)}
                  style={{ flex: 1, background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border-strong)', padding: '0.6rem', cursor: 'pointer', fontSize: '0.8rem' }}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ── Live Board ── */}
        <div>
          <div style={{ ...mono, fontSize: '0.55rem', letterSpacing: '0.16em', color: 'var(--muted-foreground)', textTransform: 'uppercase', marginBottom: '0.6rem' }}>
            Live Board · {filtered.length} of {trips.length} trips
          </div>

          {loading ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--muted-foreground)', fontSize: '0.82rem' }}>Loading trips…</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: '3.5rem', textAlign: 'center', background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <RouteIcon size={28} color="var(--text-faint)" style={{ margin: '0 auto 0.75rem' }} />
              <div style={{ color: 'var(--muted-foreground)', fontSize: '0.85rem' }}>
                {trips.length === 0 ? 'No trips created yet.' : 'No trips match your filters.'}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {filtered.map((t) => (
                <div key={t.id} style={{ background: 'var(--card)', border: '1px solid var(--border)', padding: '1rem 1.25rem' }}>
                  {/* Top row */}
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span style={{ ...mono, fontSize: '0.68rem', color: 'var(--text-muted)', letterSpacing: '0.06em' }}>
                          {t.id.slice(0, 8).toUpperCase()}
                        </span>
                        <TripStatusBadge status={t.status} />
                      </div>
                      <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--foreground)', marginTop: 4 }}>
                        {t.source} → {t.destination}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ ...mono, fontSize: '0.65rem', color: 'var(--text-muted)', letterSpacing: '0.06em' }}>
                        {t.vehicle_registration || 'Unassigned'}{t.driver_name ? ` / ${t.driver_name}` : ''}
                      </div>
                      <div style={{ ...mono, fontSize: '0.55rem', color: 'var(--text-faint)', letterSpacing: '0.06em', marginTop: 2 }}>
                        {timeAgo(t.created_at)}
                      </div>
                    </div>
                  </div>

                  {/* Detail row */}
                  <div className="flex items-center gap-4 flex-wrap" style={{ marginTop: 8 }}>
                    {t.cargo_weight > 0 && (
                      <span style={{ ...mono, fontSize: '0.6rem', color: 'var(--text-muted)' }}>{t.cargo_weight} kg</span>
                    )}
                    {t.planned_distance > 0 && (
                      <span style={{ ...mono, fontSize: '0.6rem', color: 'var(--text-muted)' }}>{t.planned_distance} km</span>
                    )}
                    {!t.driver_name && t.status === 'DRAFT' && (
                      <span style={{ ...mono, fontSize: '0.58rem', color: 'var(--text-faint)', fontStyle: 'italic' }}>Awaiting driver</span>
                    )}
                  </div>

                  {/* Actions */}
                  {canManage && (
                    <div className="flex items-center gap-2 flex-wrap" style={{ marginTop: 10 }}>
                      {t.status === 'DRAFT' && (
                        <>
                          <button onClick={() => doAction(t.id, 'dispatch')}
                            style={{ ...mono, fontSize: '0.62rem', letterSpacing: '0.08em', padding: '0.35rem 0.7rem', background: 'rgba(59,130,246,0.1)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.3)', cursor: 'pointer' }}>
                            DISPATCH
                          </button>
                          <button onClick={() => doAction(t.id, 'cancel')}
                            style={{ ...mono, fontSize: '0.62rem', letterSpacing: '0.08em', padding: '0.35rem 0.7rem', background: 'rgba(239,68,68,0.06)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)', cursor: 'pointer' }}>
                            CANCEL
                          </button>
                        </>
                      )}
                      {t.status === 'DISPATCHED' && (
                        <>
                          <button onClick={() => doAction(t.id, 'complete')}
                            style={{ ...mono, fontSize: '0.62rem', letterSpacing: '0.08em', padding: '0.35rem 0.7rem', background: 'rgba(16,185,129,0.1)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)', cursor: 'pointer' }}>
                            COMPLETE
                          </button>
                          <button onClick={() => doAction(t.id, 'cancel')}
                            style={{ ...mono, fontSize: '0.62rem', letterSpacing: '0.08em', padding: '0.35rem 0.7rem', background: 'rgba(239,68,68,0.06)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)', cursor: 'pointer' }}>
                            CANCEL
                          </button>
                        </>
                      )}
                      {t.status === 'COMPLETED' && (
                        <span style={{ ...mono, fontSize: '0.55rem', color: 'var(--text-faint)', letterSpacing: '0.08em' }}>
                          On Complete: odometer → fuel log → expenses → Vehicle &amp; Driver Available
                        </span>
                      )}
                      {t.status === 'CANCELLED' && t.vehicle_model && (
                        <span style={{ ...mono, fontSize: '0.55rem', color: 'var(--text-faint)', letterSpacing: '0.08em' }}>
                          Vehicle went to shop
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
