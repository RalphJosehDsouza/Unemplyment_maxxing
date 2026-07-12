import { useEffect, useMemo, useState, useCallback } from 'react';
import { Plus, Search, Pencil, Trash2, X, AlertCircle, Truck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ApiError } from '../../lib/api';
import { vehiclesApi } from '../../lib/services/vehicles';
import { VEHICLE_STATUSES, STATUS_STYLES, Vehicle } from '../../lib/constants';
import { StatusBadge } from '../components/StatusBadge';

const mono: React.CSSProperties = { fontFamily: "'JetBrains Mono', monospace" };
const display: React.CSSProperties = { fontFamily: "'Barlow Condensed', sans-serif" };
const labelStyle: React.CSSProperties = {
  ...mono,
  fontSize: '0.58rem',
  letterSpacing: '0.16em',
  color: 'var(--muted-foreground)',
  textTransform: 'uppercase',
  display: 'block',
  marginBottom: '0.4rem',
};
const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--input-background)',
  border: '1px solid var(--border-strong)',
  padding: '0.6rem 0.75rem',
  color: 'var(--foreground)',
  fontSize: '0.82rem',
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
};

interface FormState {
  registration_number: string;
  model: string;
  vehicle_type: string;
  max_load_capacity: string;
  current_odometer: string;
  acquisition_cost: string;
  status: string;
}

const EMPTY_FORM: FormState = {
  registration_number: '',
  model: '',
  vehicle_type: '',
  max_load_capacity: '',
  current_odometer: '0',
  acquisition_cost: '0',
  status: 'AVAILABLE',
};

const inr = (n: number) => '₹' + n.toLocaleString('en-IN');

const errorBox: React.CSSProperties = {
  background: 'rgba(220,38,38,0.08)',
  border: '1px solid rgba(220,38,38,0.3)',
};

export default function Vehicles() {
  const { user } = useAuth();
  const canManage = user?.role === 'FLEET_MANAGER' || user?.role === 'ADMIN';

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Vehicle | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const [deleting, setDeleting] = useState<Vehicle | null>(null);
  const [deleteError, setDeleteError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await vehiclesApi.list();
      setVehicles(data.vehicles);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to load vehicles');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return vehicles.filter((v) => {
      if (statusFilter && v.status !== statusFilter) return false;
      if (q && !v.registration_number.toLowerCase().includes(q) && !v.model.toLowerCase().includes(q) && !v.vehicle_type.toLowerCase().includes(q))
        return false;
      return true;
    });
  }, [vehicles, search, statusFilter]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { AVAILABLE: 0, ON_TRIP: 0, IN_SHOP: 0, RETIRED: 0 };
    vehicles.forEach((v) => (c[v.status] = (c[v.status] || 0) + 1));
    return c;
  }, [vehicles]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setModalOpen(true);
  }

  function openEdit(v: Vehicle) {
    setEditing(v);
    setForm({
      registration_number: v.registration_number,
      model: v.model,
      vehicle_type: v.vehicle_type,
      max_load_capacity: String(v.max_load_capacity),
      current_odometer: String(v.current_odometer),
      acquisition_cost: String(v.acquisition_cost),
      status: v.status,
    });
    setFormError('');
    setModalOpen(true);
  }

  async function submitForm(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');

    if (!form.registration_number.trim() || !form.model.trim() || !form.vehicle_type.trim()) {
      setFormError('Registration number, model and type are required.');
      return;
    }
    if (!form.max_load_capacity || Number(form.max_load_capacity) < 0) {
      setFormError('Max load capacity must be a non-negative number.');
      return;
    }

    const payload = {
      registration_number: form.registration_number.trim(),
      model: form.model.trim(),
      vehicle_type: form.vehicle_type.trim(),
      max_load_capacity: Number(form.max_load_capacity),
      current_odometer: Number(form.current_odometer || 0),
      acquisition_cost: Number(form.acquisition_cost || 0),
      status: form.status,
    };

    setSaving(true);
    try {
      if (editing) {
        await vehiclesApi.update(editing.id, payload);
      } else {
        await vehiclesApi.create(payload);
      }
      setModalOpen(false);
      await load();
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : 'Failed to save vehicle');
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setDeleteError('');
    try {
      await vehiclesApi.remove(deleting.id);
      setDeleting(null);
      await load();
    } catch (e) {
      setDeleteError(e instanceof ApiError ? e.message : 'Failed to delete vehicle');
    }
  }

  return (
    <div className="px-6 md:px-10 py-8 max-w-[1200px]">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
        <div>
          <div style={{ ...mono, fontSize: '0.6rem', letterSpacing: '0.2em', color: 'var(--muted-foreground)', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
            Fleet Registry
          </div>
          <h1 style={{ ...display, fontSize: '2.2rem', fontWeight: 700, lineHeight: 1, textTransform: 'uppercase', color: 'var(--foreground)' }}>Vehicles</h1>
        </div>
        {canManage && (
          <button
            onClick={openCreate}
            className="flex items-center gap-2"
            style={{ background: 'var(--primary)', color: 'var(--primary-foreground)', fontWeight: 700, fontSize: '0.8rem', padding: '0.6rem 1rem', border: 'none', cursor: 'pointer', letterSpacing: '0.03em' }}
          >
            <Plus size={15} strokeWidth={2.5} />
            Add Vehicle
          </button>
        )}
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-px mb-6" style={{ background: 'var(--border)', border: '1px solid var(--border)' }}>
        {VEHICLE_STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(statusFilter === s ? '' : s)}
            className="text-left p-4 transition-colors"
            style={{ background: statusFilter === s ? 'var(--secondary)' : 'var(--surface)', border: 'none', cursor: 'pointer' }}
          >
            <div style={{ ...display, fontSize: '1.9rem', fontWeight: 700, lineHeight: 1, color: STATUS_STYLES[s].fg }}>{counts[s] || 0}</div>
            <div style={{ ...mono, fontSize: '0.58rem', letterSpacing: '0.12em', color: 'var(--muted-foreground)', textTransform: 'uppercase', marginTop: '0.4rem' }}>
              {STATUS_STYLES[s].label}
            </div>
          </button>
        ))}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap mb-4">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={14} color="var(--muted-foreground)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by registration, model or type…"
            style={{ ...inputStyle, paddingLeft: '2.2rem' }}
          />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ ...inputStyle, width: 'auto', minWidth: 150, cursor: 'pointer' }}>
          <option value="">All statuses</option>
          {VEHICLE_STATUSES.map((s) => (
            <option key={s} value={s}>{STATUS_STYLES[s].label}</option>
          ))}
        </select>
        {(search || statusFilter) && (
          <button onClick={() => { setSearch(''); setStatusFilter(''); }} style={{ ...mono, fontSize: '0.65rem', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', letterSpacing: '0.08em' }}>
            CLEAR
          </button>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 mb-4 p-3" style={errorBox}>
          <AlertCircle size={14} color="var(--destructive)" />
          <span style={{ fontSize: '0.8rem', color: 'var(--destructive)' }}>{error}</span>
        </div>
      )}

      {/* Table (contained scroll — ~5 rows, header sticks) */}
      <div style={{ border: '1px solid var(--border)', background: 'var(--surface)', overflow: 'auto', maxHeight: 340 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['Registration', 'Model', 'Type', 'Capacity', 'Odometer', 'Cost', 'Status', ''].map((h, i) => (
                <th key={i} style={{ ...mono, fontSize: '0.56rem', letterSpacing: '0.14em', color: 'var(--muted-foreground)', textTransform: 'uppercase', textAlign: i >= 3 && i <= 5 ? 'right' : 'left', padding: '0.7rem 1rem', fontWeight: 400, whiteSpace: 'nowrap', position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 1 }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ padding: '3rem', textAlign: 'center', color: 'var(--muted-foreground)', fontSize: '0.82rem' }}>Loading fleet…</td></tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: '3.5rem', textAlign: 'center' }}>
                  <Truck size={28} color="var(--text-faint)" style={{ margin: '0 auto 0.75rem' }} />
                  <div style={{ color: 'var(--muted-foreground)', fontSize: '0.85rem' }}>
                    {vehicles.length === 0 ? 'No vehicles registered yet.' : 'No vehicles match your filters.'}
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map((v) => (
                <tr key={v.id} style={{ borderBottom: '1px solid var(--border-faint)' }}>
                  <td style={{ padding: '0.85rem 1rem', ...mono, fontSize: '0.75rem', color: 'var(--foreground)', whiteSpace: 'nowrap' }}>{v.registration_number}</td>
                  <td style={{ padding: '0.85rem 1rem', fontSize: '0.82rem', color: 'var(--foreground)' }}>{v.model}</td>
                  <td style={{ padding: '0.85rem 1rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{v.vehicle_type}</td>
                  <td style={{ padding: '0.85rem 1rem', ...mono, fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'right', whiteSpace: 'nowrap' }}>{v.max_load_capacity.toLocaleString()} kg</td>
                  <td style={{ padding: '0.85rem 1rem', ...mono, fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'right', whiteSpace: 'nowrap' }}>{v.current_odometer.toLocaleString()} km</td>
                  <td style={{ padding: '0.85rem 1rem', ...mono, fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'right', whiteSpace: 'nowrap' }}>{inr(v.acquisition_cost)}</td>
                  <td style={{ padding: '0.85rem 1rem' }}><StatusBadge status={v.status} /></td>
                  <td style={{ padding: '0.85rem 1rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {canManage && (
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => openEdit(v)} title="Edit" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => { setDeleting(v); setDeleteError(''); }} title="Delete" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div style={{ ...mono, fontSize: '0.62rem', color: 'var(--text-faint)', letterSpacing: '0.1em', marginTop: '0.75rem' }}>
        {filtered.length} OF {vehicles.length} VEHICLES
      </div>

      {/* ── Add/Edit Modal ── */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={() => !saving && setModalOpen(false)}>
          <div className="w-full max-w-[480px]" style={{ background: 'var(--card)', border: '1px solid var(--border-strong)' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
              <h2 style={{ ...display, fontSize: '1.3rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--foreground)' }}>{editing ? 'Edit Vehicle' : 'Register Vehicle'}</h2>
              <button onClick={() => !saving && setModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={18} /></button>
            </div>
            <form onSubmit={submitForm} className="px-5 py-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label style={labelStyle}>Registration Number</label>
                  <input value={form.registration_number} onChange={(e) => setForm({ ...form, registration_number: e.target.value })} placeholder="MH12-AB-1234" style={inputStyle} autoFocus />
                </div>
                <div className="col-span-2">
                  <label style={labelStyle}>Model / Name</label>
                  <input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} placeholder="Tata Ace Gold" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Type</label>
                  <input value={form.vehicle_type} onChange={(e) => setForm({ ...form, vehicle_type: e.target.value })} placeholder="Mini Truck" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Status</label>
                  <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} style={{ ...inputStyle, cursor: 'pointer' }}>
                    {VEHICLE_STATUSES.map((s) => (<option key={s} value={s}>{STATUS_STYLES[s].label}</option>))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Max Load (kg)</label>
                  <input type="number" min="0" step="any" value={form.max_load_capacity} onChange={(e) => setForm({ ...form, max_load_capacity: e.target.value })} placeholder="500" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Odometer (km)</label>
                  <input type="number" min="0" step="any" value={form.current_odometer} onChange={(e) => setForm({ ...form, current_odometer: e.target.value })} style={inputStyle} />
                </div>
                <div className="col-span-2">
                  <label style={labelStyle}>Acquisition Cost (₹)</label>
                  <input type="number" min="0" step="any" value={form.acquisition_cost} onChange={(e) => setForm({ ...form, acquisition_cost: e.target.value })} style={inputStyle} />
                </div>
              </div>

              {formError && (
                <div className="flex items-center gap-2 mt-4 p-2.5" style={errorBox}>
                  <AlertCircle size={13} color="var(--destructive)" />
                  <span style={{ fontSize: '0.76rem', color: 'var(--destructive)' }}>{formError}</span>
                </div>
              )}

              <div className="flex gap-3 mt-6">
                <button type="button" onClick={() => setModalOpen(false)} disabled={saving} style={{ flex: 1, background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border-strong)', padding: '0.6rem', cursor: 'pointer', fontSize: '0.8rem' }}>
                  Cancel
                </button>
                <button type="submit" disabled={saving} style={{ flex: 1, background: 'var(--primary)', color: 'var(--primary-foreground)', fontWeight: 700, border: 'none', padding: '0.6rem', cursor: saving ? 'not-allowed' : 'pointer', fontSize: '0.8rem', opacity: saving ? 0.6 : 1 }}>
                  {saving ? 'Saving…' : editing ? 'Save Changes' : 'Register'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete confirm ── */}
      {deleting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={() => setDeleting(null)}>
          <div className="w-full max-w-[400px]" style={{ background: 'var(--card)', border: '1px solid var(--border-strong)' }} onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-5">
              <h2 style={{ ...display, fontSize: '1.2rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.5rem', color: 'var(--foreground)' }}>Delete Vehicle</h2>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.55 }}>
                Remove <span style={{ ...mono, color: 'var(--foreground)' }}>{deleting.registration_number}</span> ({deleting.model})? This cannot be undone.
              </p>
              {deleteError && (
                <div className="flex items-center gap-2 mt-3 p-2.5" style={errorBox}>
                  <AlertCircle size={13} color="var(--destructive)" />
                  <span style={{ fontSize: '0.76rem', color: 'var(--destructive)' }}>{deleteError}</span>
                </div>
              )}
              <div className="flex gap-3 mt-5">
                <button onClick={() => setDeleting(null)} style={{ flex: 1, background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border-strong)', padding: '0.6rem', cursor: 'pointer', fontSize: '0.8rem' }}>Cancel</button>
                <button onClick={confirmDelete} style={{ flex: 1, background: 'var(--destructive)', color: 'var(--destructive-foreground)', fontWeight: 700, border: 'none', padding: '0.6rem', cursor: 'pointer', fontSize: '0.8rem' }}>Delete</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
