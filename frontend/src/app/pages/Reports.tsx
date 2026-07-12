import { useEffect, useState, useCallback } from 'react';
import { Download, AlertCircle, TrendingUp, BarChart2 } from 'lucide-react';
import { ApiError } from '../../lib/api';
import { reportsApi, ReportsAnalytics, VehicleReport } from '../../lib/services/reports';
import { StatusBadge } from '../components/StatusBadge';

const mono: React.CSSProperties = { fontFamily: "'JetBrains Mono', monospace" };
const display: React.CSSProperties = { fontFamily: "'Barlow Condensed', sans-serif" };

const inr = (n: number) => (n < 0 ? '-₹' : '₹') + Math.abs(Math.round(n)).toLocaleString('en-IN');
const signColor = (n: number) => (n > 0 ? '#10b981' : n < 0 ? '#ef4444' : 'var(--text-muted)');

function exportCSV(vehicles: VehicleReport[]) {
  const headers = ['Registration', 'Model', 'Type', 'Status', 'Trips', 'Revenue', 'Fuel', 'Maintenance', 'Other', 'Operating Cost', 'Profit', 'ROI %', 'Efficiency (km/L)', 'Acquisition Cost'];
  const rows = vehicles.map((v) => [
    v.registration_number, v.model, v.vehicle_type, v.status, v.trips_completed,
    v.revenue, v.fuel_cost, v.maintenance_cost, v.other_expenses, v.operating_cost,
    v.profit, v.roi_pct ?? '', v.efficiency ?? '', v.acquisition_cost,
  ]);
  const esc = (c: unknown) => {
    const s = String(c);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const csv = [headers, ...rows].map((r) => r.map(esc).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'transitops-fleet-report.csv';
  a.click();
  URL.revokeObjectURL(url);
}

export default function Reports() {
  const [data, setData] = useState<ReportsAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await reportsApi.analytics());
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to load reports');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const fleet = data?.fleet;

  return (
    <div className="px-6 md:px-10 py-8 max-w-[1200px]">
      <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
        <div>
          <div style={{ ...mono, fontSize: '0.6rem', letterSpacing: '0.2em', color: 'var(--muted-foreground)', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
            Profitability &amp; ROI
          </div>
          <h1 style={{ ...display, fontSize: '2.2rem', fontWeight: 700, lineHeight: 1, textTransform: 'uppercase', color: 'var(--foreground)' }}>
            Reports &amp; Analytics
          </h1>
        </div>
        <button
          onClick={() => data && exportCSV(data.vehicles)}
          disabled={!data}
          className="flex items-center gap-2"
          style={{ background: 'var(--primary)', color: 'var(--primary-foreground)', fontWeight: 700, fontSize: '0.8rem', padding: '0.6rem 1rem', border: 'none', cursor: data ? 'pointer' : 'not-allowed', opacity: data ? 1 : 0.5, letterSpacing: '0.03em' }}
        >
          <Download size={15} strokeWidth={2.5} /> Export CSV
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 mb-4 p-3" style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.3)' }}>
          <AlertCircle size={14} color="var(--destructive)" />
          <span style={{ fontSize: '0.8rem', color: 'var(--destructive)' }}>{error}</span>
        </div>
      )}

      {loading ? (
        <div style={{ color: 'var(--muted-foreground)', fontSize: '0.85rem', padding: '2rem 0' }}>Crunching the numbers…</div>
      ) : fleet && data ? (
        <>
          {/* Fleet KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-px mb-8" style={{ background: 'var(--border)', border: '1px solid var(--border)' }}>
            <Kpi label="Total Revenue" value={inr(fleet.total_revenue)} />
            <Kpi label="Operating Cost" value={inr(fleet.total_operating_cost)} />
            <Kpi label="Net Profit" value={inr(fleet.total_profit)} color={signColor(fleet.total_profit)} />
            <Kpi label="Fleet ROI" value={fleet.fleet_roi_pct != null ? fleet.fleet_roi_pct + '%' : '—'} color={fleet.fleet_roi_pct != null ? signColor(fleet.fleet_roi_pct) : undefined} />
            <Kpi label="Utilization" value={fleet.utilization_pct + '%'} color="#3b82f6" />
            <Kpi label="Avg Efficiency" value={fleet.avg_efficiency != null ? fleet.avg_efficiency + ' km/L' : '—'} color="#10b981" />
          </div>

          {/* Per-vehicle P&L / ROI */}
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp size={14} color="var(--text-muted)" />
            <span style={{ ...mono, fontSize: '0.62rem', letterSpacing: '0.16em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Vehicle Profit &amp; ROI · ranked
            </span>
          </div>
          <div style={{ border: '1px solid var(--border)', background: 'var(--surface)', overflow: 'auto', maxHeight: 360 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Vehicle', 'Status', 'Trips', 'Revenue', 'Operating', 'Profit', 'ROI', 'km/L'].map((h, i) => (
                    <th key={i} style={{ ...mono, fontSize: '0.56rem', letterSpacing: '0.12em', color: 'var(--muted-foreground)', textTransform: 'uppercase', textAlign: i >= 2 ? 'right' : 'left', padding: '0.7rem 1rem', fontWeight: 400, whiteSpace: 'nowrap', position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 1 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.vehicles.map((v) => (
                  <tr key={v.vehicle_id} style={{ borderBottom: '1px solid var(--border-faint)' }}>
                    <td style={{ padding: '0.8rem 1rem', whiteSpace: 'nowrap' }}>
                      <span style={{ ...mono, fontSize: '0.75rem', color: 'var(--foreground)' }}>{v.registration_number}</span>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{v.model}</div>
                    </td>
                    <td style={{ padding: '0.8rem 1rem' }}><StatusBadge status={v.status} /></td>
                    <td style={{ padding: '0.8rem 1rem', ...mono, fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'right' }}>{v.trips_completed}</td>
                    <td style={{ padding: '0.8rem 1rem', ...mono, fontSize: '0.72rem', color: 'var(--foreground)', textAlign: 'right', whiteSpace: 'nowrap' }}>{inr(v.revenue)}</td>
                    <td style={{ padding: '0.8rem 1rem', ...mono, fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'right', whiteSpace: 'nowrap' }}>{inr(v.operating_cost)}</td>
                    <td style={{ padding: '0.8rem 1rem', ...mono, fontSize: '0.75rem', fontWeight: 600, color: signColor(v.profit), textAlign: 'right', whiteSpace: 'nowrap' }}>{inr(v.profit)}</td>
                    <td style={{ padding: '0.8rem 1rem', ...mono, fontSize: '0.72rem', color: v.roi_pct != null ? signColor(v.roi_pct) : 'var(--text-muted)', textAlign: 'right', whiteSpace: 'nowrap' }}>{v.roi_pct != null ? v.roi_pct + '%' : '—'}</td>
                    <td style={{ padding: '0.8rem 1rem', ...mono, fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'right' }}>{v.efficiency != null ? v.efficiency : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ ...mono, fontSize: '0.58rem', color: 'var(--text-faint)', letterSpacing: '0.06em', marginTop: '0.75rem' }}>
            ROI = (Revenue − (Fuel + Maintenance)) ÷ Acquisition Cost · Operating Cost = Fuel + Maintenance + Expenses
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center py-16" style={{ color: 'var(--muted-foreground)' }}>
          <BarChart2 size={28} color="var(--text-faint)" style={{ marginBottom: '0.75rem' }} />
          <span style={{ fontSize: '0.85rem' }}>No data to report yet.</span>
        </div>
      )}
    </div>
  );
}

function Kpi({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="p-4" style={{ background: 'var(--surface)' }}>
      <div style={{ ...display, fontSize: '1.6rem', fontWeight: 700, lineHeight: 1.05, color: color || 'var(--foreground)' }}>{value}</div>
      <div style={{ ...mono, fontSize: '0.55rem', letterSpacing: '0.1em', color: 'var(--muted-foreground)', textTransform: 'uppercase', marginTop: '0.4rem' }}>{label}</div>
    </div>
  );
}
