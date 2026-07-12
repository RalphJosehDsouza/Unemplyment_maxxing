import { NavLink, Outlet } from 'react-router';
import { useState, useEffect } from 'react';
import { apiFetch } from '../../lib/api';
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
  Bell,
  X,
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

function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    apiFetch('/api/notifications/license-reminders?withinDays=30')
      .then((res: any) => {
        if (res.drivers && res.drivers.length > 0) {
          const alerts = res.drivers.map((d: any) => ({
            id: Math.random().toString(),
            title: 'License Alert',
            message: `${d.name}'s license expires in ${d.days_left} days.`,
            type: 'warning',
            time: 'Just now'
          }));
          setNotifications(prev => [...alerts, ...prev]);
          setUnread(prev => prev + alerts.length);
        }
      })
      .catch(() => {});

    const msgs = [
      { title: 'Trip Completed', msg: 'Trip TRP-921 completed successfully.', type: 'success' },
      { title: 'Vehicle Maintenance', msg: 'Vehicle V-105 entered maintenance.', type: 'error' },
      { title: 'Driver Online', msg: 'Driver John Doe is now on duty.', type: 'info' },
      { title: 'Fuel Logged', msg: 'New fuel entry for V-112: 50L', type: 'info' },
    ];
    let count = 0;
    const interval = setInterval(() => {
      if (count > 5) return;
      count++;
      const rand = msgs[Math.floor(Math.random() * msgs.length)];
      setNotifications(prev => [{
        id: Math.random().toString(),
        title: rand.title,
        message: rand.msg,
        type: rand.type,
        time: 'Just now'
      }, ...prev]);
      setUnread(prev => prev + 1);
    }, 15000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative">
      <button 
        onClick={() => { setOpen(!open); setUnread(0); }}
        className="relative p-2 rounded-full transition-colors hover:bg-[var(--surface)]"
        style={{ color: 'var(--foreground)', border: 'none', background: 'transparent', cursor: 'pointer' }}
      >
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-[var(--background)]"></span>
        )}
      </button>

      {open && (
        <div 
          className="absolute right-0 top-full mt-2 w-80 rounded-md shadow-lg overflow-hidden z-50 border"
          style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
            <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--foreground)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Command Center</span>
            <button onClick={() => setOpen(false)} style={{ color: 'var(--text-muted)', border: 'none', background: 'transparent', cursor: 'pointer' }}><X size={16} /></button>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-4 text-center text-sm" style={{ color: 'var(--text-muted)' }}>No new notifications</div>
            ) : (
              notifications.map(n => (
                <div key={n.id} className="p-4 border-b last:border-b-0 transition-colors hover:bg-[var(--surface)]" style={{ borderColor: 'var(--border)' }}>
                  <div className="flex items-start justify-between mb-1">
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: n.type === 'warning' ? '#f59e0b' : n.type === 'error' ? '#ef4444' : n.type === 'success' ? '#10b981' : 'var(--primary)' }}>
                      {n.title}
                    </span>
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-faint)' }}>{n.time}</span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--foreground)' }}>{n.message}</div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

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
          <div className="flex items-center gap-4">
            <NotificationBell />
            <div className="flex items-center gap-2">
              <span style={{ ...mono, fontSize: '0.55rem', letterSpacing: '0.12em', color: 'var(--text-faint)', textTransform: 'uppercase' }} className="hidden sm:inline">
                {isNight ? 'Night' : 'Day'}
              </span>
              <DayNightToggle isNight={isNight} onChange={(night) => setTheme(night ? 'dark' : 'light')} scale={0.5} />
            </div>
          </div>
        </header>

        <div className="flex-1">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
