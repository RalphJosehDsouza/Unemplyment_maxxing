import { useState } from "react";
import { Eye, EyeOff, Truck, Shield, BarChart2, ArrowRight, AlertCircle, ShieldCheck } from "lucide-react";
import { useNavigate } from 'react-router';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { authApi } from '../../lib/services/auth';
import { ApiError } from '../../lib/api';
import DayNightToggle from '../../components/buttons/dayNightToggle';
import CompleteOrderButton from '../../components/buttons/completeOrderButton';

const roles = [
  { id: "fleet_manager", label: "Fleet Manager", icon: Truck, description: "Fleet assets, maintenance & lifecycle" },
  { id: "safety_officer", label: "Safety Officer", icon: Shield, description: "Compliance, licenses & safety scores" },
  { id: "financial_analyst", label: "Financial Analyst", icon: BarChart2, description: "Expenses, fuel costs & fleet ROI" },
  { id: "admin", label: "Admin", icon: ShieldCheck, description: "Full access across all modules" },
];

const demoCredentials = [
  { role: "Fleet Manager", email: "fleetmanager@transitops.com" },
  { role: "Safety Officer", email: "safetyofficer@transitops.com" },
  { role: "Financial Analyst", email: "financialanalyst@transitops.com" },
  { role: "Admin", email: "admin@transitops.com" },
];

/* Dot-grid SVG for the left panel background — uses --foreground so it flips with the theme */
function DotGrid() {
  const dots = [];
  for (let row = 0; row < 18; row++) {
    for (let col = 0; col < 24; col++) {
      dots.push(
        <circle key={`${row}-${col}`} cx={col * 28 + 14} cy={row * 28 + 14} r="1" fill="var(--foreground)" opacity="0.05" />
      );
    }
  }
  return (
    <svg className="absolute inset-0 w-full h-full" aria-hidden="true">
      {dots}
    </svg>
  );
}

const mono = "'JetBrains Mono', monospace";
const display = "'Barlow Condensed', sans-serif";

export default function Login() {
  const { login } = useAuth();
  const { isNight, setTheme } = useTheme();
  const navigate = useNavigate();
  const [selectedRole, setSelectedRole] = useState("fleet_manager");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  const activeRole = roles.find((r) => r.id === selectedRole)!;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email || !password) {
      setError("Email and password are required.");
      return;
    }
    if (!email.includes("@")) {
      setError("Enter a valid email address.");
      return;
    }
    setIsLoading(true);

    try {
      const data = await authApi.login(email, password);
      login(data.token, data.user);
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Invalid credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const inputStyle = (focused: boolean): React.CSSProperties => ({
    width: "100%",
    background: "var(--input-background)",
    border: focused ? "1px solid var(--foreground)" : "1px solid var(--border-strong)",
    borderRadius: 0,
    padding: "0.72rem 0.9rem",
    color: "var(--foreground)",
    fontSize: "0.875rem",
    outline: "none",
    transition: "border-color 0.12s",
    boxSizing: "border-box",
    fontFamily: "inherit",
  });

  return (
    <div className="min-h-screen w-full flex" style={{ fontFamily: "'Inter', sans-serif", background: "var(--background)" }}>
      {/* ── LEFT PANEL ── */}
      <div
        className="hidden lg:flex lg:w-[55%] flex-col relative overflow-hidden"
        style={{ background: "var(--surface)", borderRight: "1px solid var(--border)" }}
      >
        <DotGrid />

        {/* Vertical rule accent */}
        <div className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: "var(--foreground)" }} />

        <div className="relative z-10 flex flex-col h-full px-14 py-12">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-auto">
            <div className="w-8 h-8 flex items-center justify-center" style={{ background: "var(--primary)" }}>
              <Truck size={16} color="var(--primary-foreground)" strokeWidth={2.5} />
            </div>
            <span style={{ fontFamily: display, fontSize: "1.15rem", fontWeight: 700, letterSpacing: "0.14em", color: "var(--foreground)", textTransform: "uppercase" }}>
              TransitOps
            </span>
          </div>

          {/* Hero copy */}
          <div className="flex flex-col gap-5 my-auto">
            <div style={{ fontFamily: mono, fontSize: "0.62rem", letterSpacing: "0.2em", color: "var(--muted-foreground)", textTransform: "uppercase" }}>
              Smart Transport Operations Platform
            </div>

            <h1 style={{ fontFamily: display, fontSize: "3.6rem", fontWeight: 700, lineHeight: 0.98, color: "var(--foreground)", letterSpacing: "-0.01em" }}>
              Every Route.
              <br />
              Every Driver.
              <br />
              <span style={{ color: "var(--foreground)", opacity: 0.35 }}>Under Control.</span>
            </h1>

            <p style={{ color: "var(--text-muted)", fontSize: "0.875rem", lineHeight: 1.7, maxWidth: "340px" }}>
              Centralize fleet dispatch, maintenance, compliance, and expense tracking in one operational command center.
            </p>

            {/* Live demo button */}
            <div className="mt-2">
              <CompleteOrderButton
                mode={isNight ? "night" : "day"}
                highDefinition
                truckColor="#3b82f6"
                label="Click here!"
                successLabel="Delivered"
              />
            </div>

            {/* Stats */}
            <div className="flex gap-0 mt-4" style={{ borderTop: "1px solid var(--border)" }}>
              {[
                { value: "4", label: "Access Roles" },
                { value: "8", label: "Core Modules" },
                { value: "Real-time", label: "Operations" },
              ].map((stat, i) => (
                <div
                  key={stat.label}
                  className="flex-1 pt-5"
                  style={{ borderRight: i < 2 ? "1px solid var(--border)" : "none", paddingRight: "1.5rem", paddingLeft: i > 0 ? "1.5rem" : 0 }}
                >
                  <div style={{ fontFamily: display, fontSize: "1.7rem", fontWeight: 700, color: "var(--foreground)", lineHeight: 1 }}>
                    {stat.value}
                  </div>
                  <div style={{ fontSize: "0.7rem", color: "var(--text-faint)", marginTop: "0.25rem", letterSpacing: "0.04em" }}>
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom active routes ticker */}
          <div className="flex items-center gap-3 mt-auto pt-8" style={{ borderTop: "1px solid var(--border-faint)" }}>
            <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "var(--foreground)" }} />
            <span style={{ fontFamily: mono, fontSize: "0.65rem", color: "var(--text-faint)", letterSpacing: "0.1em" }}>
              SYSTEM OPERATIONAL — 24 ACTIVE ROUTES — 7 DRIVERS ON DUTY
            </span>
          </div>
        </div>
      </div>

      {/* ── RIGHT PANEL ── */}
      <div className="flex-1 flex items-center justify-center px-8 py-12 relative" style={{ background: "var(--background)" }}>
        {/* Theme toggle */}
        <div className="absolute top-6 right-6 z-10">
          <DayNightToggle isNight={isNight} onChange={(night) => setTheme(night ? 'dark' : 'light')} scale={0.5} />
        </div>

        <div className="w-full max-w-[400px]">
          {/* Mobile logo */}
          <div className="flex items-center gap-2.5 mb-10 lg:hidden">
            <div className="w-7 h-7 flex items-center justify-center" style={{ background: "var(--primary)" }}>
              <Truck size={14} color="var(--primary-foreground)" strokeWidth={2.5} />
            </div>
            <span style={{ fontFamily: display, fontSize: "1rem", fontWeight: 700, letterSpacing: "0.14em", color: "var(--foreground)", textTransform: "uppercase" }}>
              TransitOps
            </span>
          </div>

          {/* Header */}
          <div className="mb-8">
            <h2 style={{ fontFamily: display, fontSize: "1.75rem", fontWeight: 700, color: "var(--foreground)", letterSpacing: "-0.01em", marginBottom: "0.3rem" }}>
              Sign In
            </h2>
            <p style={{ fontSize: "0.8rem", color: "var(--muted-foreground)" }}>
              Select your role and enter your credentials to continue.
            </p>
          </div>

          {/* Role selector */}
          <div className="mb-6">
            <label style={{ fontFamily: mono, fontSize: "0.6rem", letterSpacing: "0.16em", color: "var(--muted-foreground)", textTransform: "uppercase", display: "block", marginBottom: "0.5rem" }}>
              Access Role
            </label>
            <div className="grid grid-cols-2 gap-px" style={{ background: "var(--border)" }}>
              {roles.map((role) => {
                const Icon = role.icon;
                const isActive = selectedRole === role.id;
                return (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => { setSelectedRole(role.id); setError(""); }}
                    className="flex items-start gap-2.5 p-3 text-left transition-colors duration-100"
                    style={{
                      background: isActive ? "var(--secondary)" : "var(--surface)",
                      border: "none",
                      cursor: "pointer",
                      outline: "none",
                      borderLeft: isActive ? "2px solid var(--foreground)" : "2px solid transparent",
                    }}
                    aria-pressed={isActive}
                  >
                    <Icon size={13} color={isActive ? "var(--foreground)" : "var(--text-faint)"} style={{ marginTop: "1px", flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: "0.78rem", fontWeight: 600, color: isActive ? "var(--foreground)" : "var(--muted-foreground)", lineHeight: 1.2, marginBottom: "0.15rem" }}>
                        {role.label}
                      </div>
                      <div style={{ fontSize: "0.62rem", color: "var(--text-faint)", lineHeight: 1.4 }}>
                        {role.description}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} noValidate>
            {/* Email */}
            <div className="mb-4">
              <label htmlFor="email" style={{ fontFamily: mono, fontSize: "0.6rem", letterSpacing: "0.16em", color: "var(--muted-foreground)", textTransform: "uppercase", display: "block", marginBottom: "0.45rem" }}>
                Email Address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(""); }}
                onFocus={() => setEmailFocused(true)}
                onBlur={() => setEmailFocused(false)}
                placeholder="operator@transitops.com"
                style={inputStyle(emailFocused)}
              />
            </div>

            {/* Password */}
            <div className="mb-5">
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="password" style={{ fontFamily: mono, fontSize: "0.6rem", letterSpacing: "0.16em", color: "var(--muted-foreground)", textTransform: "uppercase" }}>
                  Password
                </label>
                <button type="button" style={{ fontSize: "0.72rem", color: "var(--muted-foreground)", background: "none", border: "none", cursor: "pointer", padding: 0, fontWeight: 400, textDecoration: "underline", textUnderlineOffset: "2px" }}>
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(""); }}
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => setPasswordFocused(false)}
                  placeholder="••••••••"
                  style={{ ...inputStyle(passwordFocused), paddingRight: "2.75rem" }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ background: "none", border: "none", cursor: "pointer", padding: "2px", color: "var(--text-muted)" }}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2.5 mb-4 p-3" style={{ background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.3)" }}>
                <AlertCircle size={13} color="var(--destructive)" style={{ marginTop: "1px", flexShrink: 0 }} />
                <p style={{ fontSize: "0.78rem", color: "var(--destructive)", lineHeight: 1.45 }}>{error}</p>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 transition-opacity duration-150"
              style={{
                background: "var(--primary)",
                color: "var(--primary-foreground)",
                fontWeight: 700,
                fontSize: "0.85rem",
                padding: "0.78rem",
                border: "none",
                cursor: isLoading ? "not-allowed" : "pointer",
                letterSpacing: "0.04em",
                opacity: isLoading ? 0.6 : 1,
                borderRadius: 0,
                fontFamily: "inherit",
              }}
            >
              {isLoading ? (
                <span>Authenticating…</span>
              ) : (
                <>
                  <span>Sign In as {activeRole.label}</span>
                  <ArrowRight size={14} />
                </>
              )}
            </button>
          </form>

          {/* Demo credentials */}
          <div className="mt-6" style={{ border: "1px solid var(--border)" }}>
            <div className="px-4 py-2.5" style={{ borderBottom: "1px solid var(--border-faint)", background: "var(--surface)" }}>
              <span style={{ fontFamily: mono, fontSize: "0.58rem", letterSpacing: "0.16em", color: "var(--text-faint)", textTransform: "uppercase" }}>
                Demo Credentials — password: password123
              </span>
            </div>
            <div>
              {demoCredentials.map((demo, i) => (
                <div
                  key={demo.role}
                  className="flex items-center justify-between px-4 py-2.5"
                  style={{ background: "var(--surface)", borderTop: i > 0 ? "1px solid var(--border-faint)" : "none" }}
                >
                  <span style={{ fontSize: "0.72rem", color: "var(--muted-foreground)" }}>{demo.role}</span>
                  <span style={{ fontFamily: mono, fontSize: "0.65rem", color: "var(--text-muted)" }}>{demo.email}</span>
                </div>
              ))}
            </div>
          </div>

          <p style={{ fontSize: "0.65rem", color: "var(--text-faint)", textAlign: "center", marginTop: "1.5rem", letterSpacing: "0.04em" }}>
            TRANSITOPS © 2024
          </p>
        </div>
      </div>
    </div>
  );
}
