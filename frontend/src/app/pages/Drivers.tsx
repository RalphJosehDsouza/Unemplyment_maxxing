import { useEffect, useMemo, useState, useCallback } from 'react';
import { Plus, Search, Pencil, Trash2, X, AlertCircle, Users, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ApiError } from '../../lib/api';
import { driversApi, DRIVER_STATUSES, Driver } from '../../lib/services/drivers';
import { STATUS_STYLES } from '../../lib/constants';
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
const errorBox: React.CSSProperties = { background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.3)' };

interface FormState {
  name: string;
  license_number: string;
  license_category: string;
  license_expiry: string;
  contact_number: string;
  safety_score: string;
  status: string;
}

const EMPTY_FORM: FormState = {
  name: '',
  license_number: '',
  license_category: '',
  license_expiry: '',
  contact_number: '',
  safety_score: '100',
  status: 'AVAILABLE',
};

function scoreColor(s: number) {
  if (s >= 85) return '#10b981';
  if (s >= 70) return '#f59e0b';
  return '#ef4444';
}

export default function Drivers() {
  const { user } = useAuth();
  const canManage = ['FLEET_MANAGER', 'SAFETY_OFFICER', 'ADMIN'].includes(user?.role || '');

  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [expiringOnly, setExpiringOnly] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Driver | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const [deleting, setDeleting] = useState<Driver | null>(null);
  const [deleteError, setDeleteError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await driversApi.list();
      setDrivers(data.drivers);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to load drivers');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return drivers.filter((d) => {
      if (statusFilter && d.status !== statusFilter) return false;
      if (expiringOnly && !d.license_expired) return false;
      if (q && !d.name.toLowerCase().includes(q) && !d.license_number.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [drivers, search, statusFilter, expiringOnly]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { AVAILABLE: 0, ON_TRIP: 0, OFF_DUTY: 0, SUSPENDED: 0 };
    drivers.forEach((d) => (c[d.status] = (c[d.status] || 0) + 1));
    return c;
  }, [drivers]);

  const expiredCount = useMemo(() => drivers.filter((d) => d.license_expired).length, [drivers]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setModalOpen(true);
  }

  function openEdit(d: Driver) {
    setEditing(d);
    setForm({
      name: d.name,
      license_number: d.license_number,
      license_category: d.license_category || '',
      license_expiry: d.license_expiry,
      contact_number: d.contact_number || '',
      safety_score: String(d.safety_score),
      status: d.status,
    });
    setFormError('');
    setModalOpen(true);
  }

  async function submitForm(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');

    if (!form.name.trim() || !form.license_number.trim()) {
      setFormError('Name and license number are required.');
      return;
    }
    if (!form.license_category.trim()) {
      setFormError('License category is required.');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.license_expiry)) {
      setFormError('License expiry date is required.');
      return;
    }
    const score = Number(form.safety_score);
    if (!Number.isInteger(score) || score < 0 || score > 100) {
      setFormError('Safety score must be a whole number between 0 and 100.');
      return;
    }

    const payload = {
      name: form.name.trim(),
      license_number: form.license_number.trim(),
      license_category: form.license_category.trim(),
      license_expiry: form.license_expiry,
      contact_number: form.contact_number.trim() || undefined,
      safety_score: score,
      status: form.status,
    };

    setSaving(true);
    try {
      if (editing) {
        await driversApi.update(editing.id, payload);
      } else {
        await driversApi.create(payload);
      }
      setModalOpen(false);
      await load();
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : 'Failed to save driver');
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setDeleteError('');
    try {
      await driversApi.remove(deleting.id);
      setDeleting(null);
      await load();
    } catch (e) {
      setDeleteError(e instanceof ApiError ? e.message : 'Failed to delete driver');
    }
  }

  return (
    <div className="px-6 md:px-10 py-8 max-w-[1200px]">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
        <div>
          <div style={{ ...mono, fontSize: '0.6rem', letterSpacing: '0.2em', color: 'var(--muted-foreground)', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
            Compliance & Roster
          </div>
          <h1 style={{ ...display, fontSize: '2.2rem', fontWeight: 700, lineHeight: 1, textTransform: 'uppercase', color: 'var(--foreground)' }}>Drivers</h1>
        </div>
        {canManage && (
          <button
            onClick={openCreate}
            className="flex items-center gap-2"
            style={{ background: 'var(--primary)', color: 'var(--primary-foreground)', fontWeight: 700, fontSize: '0.8rem', padding: '0.6rem 1rem', border: 'none', cursor: 'pointer', letterSpacing: '0.03em' }}
          >
            <Plus size={15} strokeWidth={2.5} />
            Add Driver
          </button>
        )}
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-px mb-3" style={{ background: 'var(--border)', border: '1px solid var(--border)' }}>
        {DRIVER_STATUSES.map((s) => (
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

      {/* Expired-license alert / filter */}
      {expiredCount > 0 && (
        <button
          onClick={() => setExpiringOnly((v) => !v)}
          className="flex items-center gap-2 w-full mb-6 p-3 transition-colors"
          style={{ background: expiringOnly ? 'rgba(239,68,68,0.14)' : 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', cursor: 'pointer', textAlign: 'left' }}
        >
          <AlertTriangle size={15} color="#ef4444" />
          <span style={{ fontSize: '0.8rem', color: '#ef4444' }}>
            {expiredCount} driver{expiredCount > 1 ? 's have' : ' has'} an expired license — cannot be dispatched.
          </span>
          <span style={{ ...mono, fontSize: '0.6rem', letterSpacing: '0.1em', color: '#ef4444', marginLeft: 'auto' }}>
            {expiringOnly ? 'SHOW ALL' : 'REVIEW'}
          </span>
        </button>
      )}

      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap mb-4">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={14} color="var(--muted-foreground)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or license number…" style={{ ...inputStyle, paddingLeft: '2.2rem' }} />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ ...inputStyle, width: 'auto', minWidth: 150, cursor: 'pointer' }}>
          <option value="">All statuses</option>
          {DRIVER_STATUSES.map((s) => (<option key={s} value={s}>{STATUS_STYLES[s].label}</option>))}
        </select>
        {(search || statusFilter || expiringOnly) && (
          <button onClick={() => { setSearch(''); setStatusFilter(''); setExpiringOnly(false); }} style={{ ...mono, fontSize: '0.65rem', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', letterSpacing: '0.08em' }}>
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
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 820 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['Driver', 'License No.', 'Category', 'Expiry', 'Safety', 'Contact', 'Status', ''].map((h, i) => (
                <th key={i} style={{ ...mono, fontSize: '0.56rem', letterSpacing: '0.14em', color: 'var(--muted-foreground)', textTransform: 'uppercase', textAlign: 'left', padding: '0.7rem 1rem', fontWeight: 400, whiteSpace: 'nowrap', position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 1 }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ padding: '3rem', textAlign: 'center', color: 'var(--muted-foreground)', fontSize: '0.82rem' }}>Loading roster…</td></tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: '3.5rem', textAlign: 'center' }}>
                  <Users size={28} color="var(--text-faint)" style={{ margin: '0 auto 0.75rem' }} />
                  <div style={{ color: 'var(--muted-foreground)', fontSize: '0.85rem' }}>
                    {drivers.length === 0 ? 'No drivers registered yet.' : 'No drivers match your filters.'}
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map((d) => (
                <tr key={d.id} style={{ borderBottom: '1px solid var(--border-faint)' }}>
                  <td style={{ padding: '0.85rem 1rem', fontSize: '0.82rem', color: 'var(--foreground)', whiteSpace: 'nowrap' }}>{d.name}</td>
                  <td style={{ padding: '0.85rem 1rem', ...mono, fontSize: '0.72rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{d.license_number}</td>
                  <td style={{ padding: '0.85rem 1rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{d.license_category || '—'}</td>
                  <td style={{ padding: '0.85rem 1rem', ...mono, fontSize: '0.72rem', whiteSpace: 'nowrap' }}>
                    <span style={{ color: d.license_expired ? '#ef4444' : 'var(--text-muted)' }}>{d.license_expiry}</span>
                    {d.license_expired && (
                      <span style={{ ...mono, fontSize: '0.55rem', letterSpacing: '0.08em', color: '#ef4444', marginLeft: 6, border: '1px solid rgba(239,68,68,0.4)', padding: '1px 4px' }}>EXPIRED</span>
                    )}
                  </td>
                  <td style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>
                    <div className="flex items-center gap-2">
                      <div style={{ width: 44, height: 5, background: 'var(--border)', position: 'relative' }}>
                        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${d.safety_score}%`, background: scoreColor(d.safety_score) }} />
                      </div>
                      <span style={{ ...mono, fontSize: '0.7rem', color: 'var(--text-muted)' }}>{d.safety_score}</span>
                    </div>
                  </td>
                  <td style={{ padding: '0.85rem 1rem', ...mono, fontSize: '0.7rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{d.contact_number || '—'}</td>
                  <td style={{ padding: '0.85rem 1rem' }}><StatusBadge status={d.status} /></td>
                  <td style={{ padding: '0.85rem 1rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {canManage && (
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => openEdit(d)} title="Edit" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => { setDeleting(d); setDeleteError(''); }} title="Delete" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
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
        {filtered.length} OF {drivers.length} DRIVERS
      </div>

      {/* ── Add/Edit Modal ── */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={() => !saving && setModalOpen(false)}>
          <div className="w-full max-w-[480px]" style={{ background: 'var(--card)', border: '1px solid var(--border-strong)' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
              <h2 style={{ ...display, fontSize: '1.3rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--foreground)' }}>{editing ? 'Edit Driver' : 'Register Driver'}</h2>
              <button onClick={() => !saving && setModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={18} /></button>
            </div>
            <form onSubmit={submitForm} className="px-5 py-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label style={labelStyle}>Full Name</label>
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Alex Fernandes" style={inputStyle} autoFocus />
                </div>
                <div>
                  <label style={labelStyle}>License Number</label>
                  <input value={form.license_number} onChange={(e) => setForm({ ...form, license_number: e.target.value })} placeholder="MH-DL-2019-0012" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>License Category</label>
                  <input value={form.license_category} onChange={(e) => setForm({ ...form, license_category: e.target.value })} placeholder="LMV / HMV" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>License Expiry</label>
                  <input type="date" value={form.license_expiry} onChange={(e) => setForm({ ...form, license_expiry: e.target.value })} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Status</label>
                  <select disabled={form.status === 'ON_TRIP'} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} style={{ ...inputStyle, cursor: form.status === 'ON_TRIP' ? 'not-allowed' : 'pointer', opacity: form.status === 'ON_TRIP' ? 0.7 : 1 }}>
                    {DRIVER_STATUSES.map((s) => (
                      <option key={s} value={s} disabled={s === 'ON_TRIP'}>
                        {STATUS_STYLES[s].label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Safety Score (0–100)</label>
                  <input type="number" min="0" max="100" step="1" value={form.safety_score} onChange={(e) => setForm({ ...form, safety_score: e.target.value })} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Contact Number</label>
                  <input value={form.contact_number} onChange={(e) => setForm({ ...form, contact_number: e.target.value })} placeholder="+91 98200 11223" style={inputStyle} />
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
              <h2 style={{ ...display, fontSize: '1.2rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.5rem', color: 'var(--foreground)' }}>Delete Driver</h2>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.55 }}>
                Remove <span style={{ color: 'var(--foreground)' }}>{deleting.name}</span> (<span style={{ ...mono }}>{deleting.license_number}</span>)? This cannot be undone.
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
