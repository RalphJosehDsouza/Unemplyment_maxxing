import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { vehiclesApi } from '../../lib/services/vehicles';
import { ROLE_LABELS, STATUS_STYLES, VEHICLE_STATUSES, Vehicle } from '../../lib/constants';

// Mock data hooks for Trips and Drivers (since backend endpoints don't exist yet)
const useMockLiveStats = () => {
  const [stats, setStats] = useState({ activeTrips: 12, pendingTrips: 5, driversOnDuty: 18 });
  useEffect(() => {
    const interval = setInterval(() => {
      // Simulate live updates
      setStats(prev => ({
        activeTrips: Math.max(0, prev.activeTrips + (Math.random() > 0.5 ? 1 : -1)),
        pendingTrips: Math.max(0, prev.pendingTrips + (Math.random() > 0.5 ? 1 : -1)),
        driversOnDuty: Math.max(0, prev.driversOnDuty + (Math.random() > 0.8 ? 1 : 0))
      }));
    }, 5000);
    return () => clearInterval(interval);
  }, []);
  return stats;
};

const mono: React.CSSProperties = { fontFamily: "'JetBrains Mono', monospace" };
const display: React.CSSProperties = { fontFamily: "'Barlow Condensed', sans-serif" };

export default function Dashboard() {
  const { user } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  
  // Filters State
  const [filterType, setFilterType] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterRegion, setFilterRegion] = useState('ALL');

  const { activeTrips, pendingTrips, driversOnDuty } = useMockLiveStats();

  // Fetch live vehicles
  useEffect(() => {
    const fetchVehicles = () => {
      vehiclesApi.list().then(d => setVehicles(d.vehicles)).catch(() => {});
    };
    fetchVehicles();
    const interval = setInterval(fetchVehicles, 5000); // 5-second polling
    return () => clearInterval(interval);
  }, []);

  // Compute KPIs
  const counts: Record<string, number> = { AVAILABLE: 0, ON_TRIP: 0, IN_SHOP: 0, RETIRED: 0 };
  vehicles.forEach((v) => (counts[v.status] = (counts[v.status] || 0) + 1));
  const activeVehicles = (counts.AVAILABLE || 0) + (counts.ON_TRIP || 0);
  const utilization = activeVehicles > 0 ? Math.round(((counts.ON_TRIP || 0) / activeVehicles) * 100) : 0;

  // Compute derived options
  const uniqueTypes = Array.from(new Set(vehicles.map(v => v.vehicle_type))).filter(Boolean);
  const regions = ['North Region', 'South Region', 'East Region', 'West Region']; // Mocked regions

  // Apply Filters
  const filteredVehicles = vehicles.filter(v => {
    if (filterType !== 'ALL' && v.vehicle_type !== filterType) return false;
    if (filterStatus !== 'ALL' && v.status !== filterStatus) return false;
    // Note: Region is mocked, so we bypass region filtering for now, 
    // but the UI reflects the requirement.
    return true;
  });

  return (
    <div className="px-6 md:px-10 py-8 max-w-[1200px] mx-auto space-y-8">
      {/* Header */}
      <div>
        <div style={{ ...mono, fontSize: '0.6rem', letterSpacing: '0.2em', color: 'var(--muted-foreground)', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
          {ROLE_LABELS[user?.role || ''] || user?.role} · Operations Overview
        </div>
        <h1 style={{ ...display, fontSize: '2.2rem', fontWeight: 700, lineHeight: 1, textTransform: 'uppercase', color: 'var(--foreground)' }}>
          Welcome, {user?.name?.split(' ')[0] || 'Operator'}
        </h1>
        <p style={{ color: 'var(--muted-foreground)', fontSize: '0.85rem' }} className="mt-2">
          Live snapshot of your fleet. Data automatically refreshes every 5 seconds.
        </p>
      </div>

      {/* Fleet KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-px rounded-lg overflow-hidden" style={{ background: 'var(--border)', border: '1px solid var(--border)' }}>
        <Kpi label="Active Vehicles" value={activeVehicles} color="var(--foreground)" />
        <Kpi label="Available" value={counts.AVAILABLE || 0} color={STATUS_STYLES['AVAILABLE']?.fg} />
        <Kpi label="In Shop" value={counts.IN_SHOP || 0} color={STATUS_STYLES['IN_SHOP']?.fg} />
        <Kpi label="Utilization" value={`${utilization}%`} color="#3b82f6" />
        <Kpi label="Active Trips" value={activeTrips} color="#8b5cf6" />
        <Kpi label="Pending Trips" value={pendingTrips} color="#f59e0b" />
        <Kpi label="Drivers On Duty" value={driversOnDuty} color="#10b981" />
      </div>

      {/* Fleet Overview & Filters */}
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)' }} className="rounded-lg overflow-hidden">
        <div className="p-5 border-b flex flex-col md:flex-row md:items-end justify-between gap-4" style={{ borderColor: 'var(--border)' }}>
          <h2 style={{ ...display, fontSize: '1.5rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--foreground)' }}>
            Fleet Overview
          </h2>
          <div className="flex flex-wrap gap-4">
            <FilterSelect label="Status" value={filterStatus} onChange={setFilterStatus} options={['ALL', ...VEHICLE_STATUSES]} />
            <FilterSelect label="Type" value={filterType} onChange={setFilterType} options={['ALL', ...uniqueTypes]} />
            <FilterSelect label="Region" value={filterRegion} onChange={setFilterRegion} options={['ALL', ...regions]} />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead style={{ background: 'var(--surface)', color: 'var(--muted-foreground)', ...mono, fontSize: '0.7rem', textTransform: 'uppercase' }}>
              <tr>
                <th className="px-6 py-3 font-medium">Registration</th>
                <th className="px-6 py-3 font-medium">Type / Model</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium text-right">Odometer</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}>
              {filteredVehicles.length === 0 ? (
                <tr><td colSpan={4} className="px-6 py-12 text-center" style={{ color: 'var(--muted-foreground)' }}>No vehicles found matching criteria.</td></tr>
              ) : (
                filteredVehicles.map(v => (
                  <tr key={v.id} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4" style={{ ...mono }}>{v.registration_number}</td>
                    <td className="px-6 py-4">
                      <div className="font-medium">{v.vehicle_type}</div>
                      <div style={{ color: 'var(--muted-foreground)', fontSize: '0.75rem' }}>{v.model}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-1 text-xs font-semibold rounded-full" style={{ background: STATUS_STYLES[v.status]?.bg, color: STATUS_STYLES[v.status]?.fg, border: `1px solid ${STATUS_STYLES[v.status]?.border}` }}>
                        {STATUS_STYLES[v.status]?.label || v.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right" style={{ ...mono }}>{v.current_odometer.toLocaleString()} km</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}

function Kpi({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div className="p-5 flex flex-col justify-center" style={{ background: 'var(--card)' }}>
      <div style={{ ...display, fontSize: '2rem', fontWeight: 700, lineHeight: 1, color }}>{value}</div>
      <div style={{ ...mono, fontSize: '0.6rem', letterSpacing: '0.1em', color: 'var(--muted-foreground)', textTransform: 'uppercase', marginTop: '0.5rem' }}>
        {label}
      </div>
    </div>
  );
}

function FilterSelect({ label, value, onChange, options }: { label: string, value: string, onChange: (v: string) => void, options: string[] }) {
  return (
    <div className="flex flex-col gap-1.5 min-w-[140px]">
      <label style={{ ...mono, fontSize: '0.65rem', color: 'var(--muted-foreground)', textTransform: 'uppercase' }}>{label}</label>
      <select 
        value={value} 
        onChange={(e) => onChange(e.target.value)}
        className="px-3 py-2 text-sm rounded-md border outline-none transition-all cursor-pointer appearance-none"
        style={{ background: 'var(--background)', color: 'var(--foreground)', borderColor: 'var(--border)' }}
      >
        {options.map(opt => (
          <option key={opt} value={opt}>{opt === 'ALL' ? 'All' : opt}</option>
        ))}
      </select>
    </div>
  );
}
