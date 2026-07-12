import { useAuth } from '../../context/AuthContext';
import { LogOut, Truck } from 'lucide-react';

export default function Dashboard() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#f0f0f0] p-8" style={{ fontFamily: "'Inter', sans-serif" }}>
      <div className="max-w-4xl mx-auto">
        <header className="flex items-center justify-between pb-6 border-b border-[rgba(255,255,255,0.08)] mb-8">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 flex items-center justify-center bg-white">
              <Truck size={16} color="#0a0a0a" strokeWidth={2.5} />
            </div>
            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "1.2rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.14em" }}>
              TransitOps Dashboard
            </span>
          </div>
          <button 
            onClick={logout}
            className="flex items-center gap-2 text-[#a0a0a0] hover:text-white transition-colors"
          >
            <LogOut size={16} />
            <span style={{ fontSize: '0.875rem' }}>Logout</span>
          </button>
        </header>

        <main>
          <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "2.5rem", fontWeight: 700, marginBottom: "0.5rem" }}>
            Welcome, {user?.role}
          </h1>
          <p className="text-[#a0a0a0] mb-8">
            You are logged in as {user?.email}. Your role determines what you can see and do here.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Example Card */}
            <div className="bg-[#141414] border border-[rgba(255,255,255,0.08)] rounded-lg p-6">
              <h3 style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.7rem", letterSpacing: "0.14em", color: "#64748b", textTransform: "uppercase", marginBottom: "1rem" }}>
                Role Specific Action
              </h3>
              <p className="text-sm text-[#f0f0f0]">
                This is a protected area. If you can see this, you are successfully authenticated.
              </p>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
