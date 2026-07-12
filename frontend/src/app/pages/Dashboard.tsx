import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { vehiclesApi } from '../../lib/services/vehicles';
import { ROLE_LABELS, STATUS_STYLES, VEHICLE_STATUSES, Vehicle } from '../../lib/constants';
import CompleteOrderButton from '../../components/buttons/completeOrderButton';

const mono: React.CSSProperties = { fontFamily: "'JetBrains Mono', monospace" };
const display: React.CSSProperties = { fontFamily: "'Barlow Condensed', sans-serif" };

export default function Dashboard() {
  const { user } = useAuth();
  const { isNight } = useTheme();
  const navigate = useNavigate();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);

  useEffect(() => {
    vehiclesApi
      .list()
      .then((d) => setVehicles(d.vehicles))
      .catch(() => setVehicles([]));
  }, []);

  const counts: Record<string, number> = { AVAILABLE: 0, ON_TRIP: 0, IN_SHOP: 0, RETIRED: 0 };
  vehicles.forEach((v) => (counts[v.status] = (counts[v.status] || 0) + 1));
  const total = vehicles.length;
  const active = counts.AVAILABLE + counts.ON_TRIP;
  const utilization = active > 0 ? Math.round((counts.ON_TRIP / active) * 100) : 0;

  const canManageFleet = user?.role === 'FLEET_MANAGER' || user?.role === 'ADMIN';

  return (
    <div className="px-6 md:px-10 py-8 max-w-[1200px]">
      <div style={{ ...mono, fontSize: '0.6rem', letterSpacing: '0.2em', color: 'var(--muted-foreground)', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
        {ROLE_LABELS[user?.role || ''] || user?.role} · Operations Overview
      </div>
      <h1 style={{ ...display, fontSize: '2.2rem', fontWeight: 700, lineHeight: 1, textTransform: 'uppercase', marginBottom: '0.4rem', color: 'var(--foreground)' }}>
        Welcome, {user?.name?.split(' ')[0] || 'Operator'}
      </h1>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '2rem' }}>
        Live snapshot of your fleet. More modules (trips, maintenance, fuel &amp; reports) are on the way.
      </p>

      {/* Fleet KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-px mb-8" style={{ background: 'var(--border)', border: '1px solid var(--border)' }}>
        <Kpi label="Total Fleet" value={total} color="var(--foreground)" />
        {VEHICLE_STATUSES.map((s) => (
          <Kpi key={s} label={STATUS_STYLES[s].label} value={counts[s] || 0} color={STATUS_STYLES[s].fg} />
        ))}
        <Kpi label="Utilization" value={`${utilization}%`} color="#3b82f6" />
      </div>

      {canManageFleet && (
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', padding: '1.75rem' }}>
          <div style={{ ...mono, fontSize: '0.58rem', letterSpacing: '0.16em', color: 'var(--muted-foreground)', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
            Quick Action
          </div>
          <div style={{ ...display, fontSize: '1.4rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--foreground)', marginBottom: '1.1rem' }}>
            Vehicle Registry
          </div>
          <CompleteOrderButton
            mode={isNight ? 'night' : 'day'}
            highDefinition
            truckColor="#3b82f6"
            label="Open Vehicle Registry"
            successLabel="Registry Ready"
            onComplete={() => navigate('/vehicles')}
          />
        </div>
      )}
    </div>
  );
}

function Kpi({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div className="p-4" style={{ background: 'var(--surface)' }}>
      <div style={{ ...display, fontSize: '1.9rem', fontWeight: 700, lineHeight: 1, color }}>{value}</div>
      <div style={{ ...mono, fontSize: '0.55rem', letterSpacing: '0.12em', color: 'var(--muted-foreground)', textTransform: 'uppercase', marginTop: '0.4rem' }}>
        {label}
      </div>
    </div>
  );
}
