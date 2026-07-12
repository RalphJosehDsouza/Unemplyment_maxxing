import { NavLink, Outlet } from 'react-router';
import {
  LayoutDashboard,
  Truck,
  Users,
  Route as RouteIcon,
  Wrench,
  Fuel,
  BarChart2,
  Sparkles,
  LogOut,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { ROLE_LABELS } from '../../lib/constants';
import DayNightToggle from '../../components/buttons/dayNightToggle';

interface NavItem {
  to: string;
  label: string;
  icon: typeof Truck;
  roles: string[];
  soon?: boolean;
}

const ALL = ['ADMIN', 'FLEET_MANAGER', 'SAFETY_OFFICER', 'FINANCIAL_ANALYST'];

const NAV: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ALL },
  { to: '/analytics', label: 'Analytics', icon: BarChart2, roles: ALL },
  { to: '/vehicles', label: 'Vehicles', icon: Truck, roles: ['FLEET_MANAGER'] },
  { to: '/drivers', label: 'Drivers', icon: Users, roles: ['FLEET_MANAGER', 'SAFETY_OFFICER'] },
  { to: '/trips', label: 'Trips', icon: RouteIcon, roles: ALL },
  { to: '/dispatch', label: 'Dispatch Advisor', icon: Sparkles, roles: ['FLEET_MANAGER'] },
  { to: '/maintenance', label: 'Maintenance', icon: Wrench, roles: ['FLEET_MANAGER'] },
  { to: '/fuel', label: 'Fuel & Expenses', icon: Fuel, roles: ['FINANCIAL_ANALYST', 'FLEET_MANAGER'] },
  { to: '/reports', label: 'Reports', icon: BarChart2, roles: ['FINANCIAL_ANALYST', 'FLEET_MANAGER'] },
];

const mono: React.CSSProperties = { fontFamily: "'JetBrains Mono', monospace" };
const display: React.CSSProperties = { fontFamily: "'Barlow Condensed', sans-serif" };

export default function Layout() {
  const { user, logout } = useAuth();
  const { isNight, setTheme } = useTheme();
  const role = user?.role || '';
  const canSee = (item: NavItem) => role === 'ADMIN' || item.roles.includes(role);

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--background)', color: 'var(--foreground)', fontFamily: "'Inter', sans-serif" }}>
      {/* ── Sidebar ── */}
      <aside
        className="hidden md:flex flex-col w-60 shrink-0"
        style={{ background: 'var(--sidebar)', borderRight: '1px solid var(--sidebar-border)' }}
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-5 h-16" style={{ borderBottom: '1px solid var(--sidebar-border)' }}>
          <div className="w-7 h-7 flex items-center justify-center" style={{ background: 'var(--primary)' }}>
            <Truck size={14} color="var(--primary-foreground)" strokeWidth={2.5} />
          </div>
          <span style={{ ...display, fontSize: '1.05rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--foreground)' }}>
            TransitOps
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 flex flex-col gap-0.5 px-3">
          {NAV.filter(canSee).map((item) => {
            const Icon = item.icon;
            if (item.soon) {
              return (
                <div
                  key={item.to}
                  className="flex items-center gap-3 px-3 py-2.5"
                  style={{ color: 'var(--text-faint)', cursor: 'not-allowed' }}
                  title="Coming soon"
                >
                  <Icon size={16} />
                  <span style={{ fontSize: '0.82rem' }}>{item.label}</span>
                  <span style={{ ...mono, fontSize: '0.5rem', letterSpacing: '0.1em', marginLeft: 'auto', color: 'var(--text-faint)' }}>
                    SOON
                  </span>
                </div>
              );
            }
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className="flex items-center gap-3 px-3 py-2.5 transition-colors"
                style={({ isActive }) => ({
                  color: isActive ? 'var(--text-strong)' : 'var(--text-muted)',
                  background: isActive ? 'var(--secondary)' : 'transparent',
                  borderLeft: isActive ? '2px solid var(--text-strong)' : '2px solid transparent',
                })}
              >
                <Icon size={16} />
                <span style={{ fontSize: '0.82rem' }}>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* User */}
        <div className="px-3 py-4" style={{ borderTop: '1px solid var(--sidebar-border)' }}>
          <div className="px-2 mb-3">
            <div style={{ fontSize: '0.78rem', color: 'var(--foreground)', fontWeight: 600 }}>{user?.name || user?.email}</div>
            <div style={{ ...mono, fontSize: '0.6rem', letterSpacing: '0.1em', color: 'var(--muted-foreground)', textTransform: 'uppercase', marginTop: 2 }}>
              {ROLE_LABELS[role] || role}
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center gap-2 px-2 py-2 transition-colors"
            style={{ color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--destructive)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
          >
            <LogOut size={15} />
            <span style={{ fontSize: '0.8rem' }}>Sign out</span>
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="flex-1 min-w-0 overflow-x-hidden flex flex-col">
        {/* Topbar */}
        <header
          className="flex items-center justify-between px-6 md:px-10 h-16 shrink-0"
          style={{ borderBottom: '1px solid var(--border)', background: 'var(--background)' }}
        >
          <span style={{ ...mono, fontSize: '0.6rem', letterSpacing: '0.18em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Operations Console
          </span>
          <div className="flex items-center gap-3">
            <span style={{ ...mono, fontSize: '0.55rem', letterSpacing: '0.12em', color: 'var(--text-faint)', textTransform: 'uppercase' }} className="hidden sm:inline">
              {isNight ? 'Night' : 'Day'}
            </span>
            <DayNightToggle isNight={isNight} onChange={(night) => setTheme(night ? 'dark' : 'light')} scale={0.5} />
          </div>
        </header>

        <div className="flex-1">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
