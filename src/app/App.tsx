import { useState } from "react";
import { Eye, EyeOff, Truck, Shield, BarChart2, ArrowRight, AlertCircle, MapPin } from "lucide-react";

const roles = [
  {
    id: "fleet_manager",
    label: "Fleet Manager",
    icon: Truck,
    description: "Fleet assets, maintenance & lifecycle",
  },
  {
    id: "dispatcher",
    label: "Dispatcher",
    icon: ArrowRight,
    description: "Trip creation, vehicle & driver assign",
  },
  {
    id: "safety_officer",
    label: "Safety Officer",
    icon: Shield,
    description: "Compliance, licenses & safety scores",
  },
  {
    id: "financial_analyst",
    label: "Financial Analyst",
    icon: BarChart2,
    description: "Expenses, fuel costs & fleet ROI",
  },
];

const demoCredentials = [
  { role: "Fleet Manager", email: "fleet@transitops.io" },
  { role: "Dispatcher", email: "dispatch@transitops.io" },
  { role: "Safety Officer", email: "safety@transitops.io" },
  { role: "Financial Analyst", email: "finance@transitops.io" },
];

/* Simple dot-grid SVG for the left panel background */
function DotGrid() {
  const dots = [];
  for (let row = 0; row < 18; row++) {
    for (let col = 0; col < 24; col++) {
      dots.push(
        <circle
          key={`${row}-${col}`}
          cx={col * 28 + 14}
          cy={row * 28 + 14}
          r="1"
          fill="#ffffff"
          opacity="0.06"
        />
      );
    }
  }
  return (
    <svg className="absolute inset-0 w-full h-full" aria-hidden="true">
      {dots}
    </svg>
  );
}

export default function App() {
  const [selectedRole, setSelectedRole] = useState("fleet_manager");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  const activeRole = roles.find((r) => r.id === selectedRole)!;

  const handleSubmit = (e: React.FormEvent) => {
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
    setTimeout(() => {
      setIsLoading(false);
      setError("Invalid credentials. Use the demo credentials listed below.");
    }, 1400);
  };

  const inputStyle = (focused: boolean): React.CSSProperties => ({
    width: "100%",
    background: "#141414",
    border: focused ? "1px solid #ffffff" : "1px solid rgba(255,255,255,0.12)",
    borderRadius: 0,
    padding: "0.72rem 0.9rem",
    color: "#f0f0f0",
    fontSize: "0.875rem",
    outline: "none",
    transition: "border-color 0.12s",
    boxSizing: "border-box",
    fontFamily: "inherit",
  });

  return (
    <div
      className="min-h-screen w-full flex"
      style={{ fontFamily: "'Inter', sans-serif", background: "#0a0a0a" }}
    >
      {/* ── LEFT PANEL ── */}
      <div
        className="hidden lg:flex lg:w-[55%] flex-col relative overflow-hidden"
        style={{ background: "#0e0e0e", borderRight: "1px solid rgba(255,255,255,0.08)" }}
      >
        <DotGrid />

        {/* Vertical rule accent */}
        <div
          className="absolute left-0 top-0 bottom-0 w-[3px]"
          style={{ background: "#ffffff" }}
        />

        <div className="relative z-10 flex flex-col h-full px-14 py-12">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-auto">
            <div
              className="w-8 h-8 flex items-center justify-center"
              style={{ background: "#ffffff" }}
            >
              <Truck size={16} color="#0a0a0a" strokeWidth={2.5} />
            </div>
            <span
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                fontSize: "1.15rem",
                fontWeight: 700,
                letterSpacing: "0.14em",
                color: "#f0f0f0",
                textTransform: "uppercase",
              }}
            >
              TransitOps
            </span>
          </div>

          {/* Hero copy */}
          <div className="flex flex-col gap-5 my-auto">
            <div
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "0.62rem",
                letterSpacing: "0.2em",
                color: "#5a5a5a",
                textTransform: "uppercase",
              }}
            >
              Smart Transport Operations Platform
            </div>

            <h1
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                fontSize: "3.6rem",
                fontWeight: 700,
                lineHeight: 0.98,
                color: "#f0f0f0",
                letterSpacing: "-0.01em",
              }}
            >
              Every Route.
              <br />
              Every Driver.
              <br />
              <span style={{ color: "#ffffff", opacity: 0.35 }}>Under Control.</span>
            </h1>

            <p
              style={{
                color: "#5a5a5a",
                fontSize: "0.875rem",
                lineHeight: 1.7,
                maxWidth: "340px",
              }}
            >
              Centralize fleet dispatch, maintenance, compliance, and expense tracking in one operational command center.
            </p>

            {/* Stats */}
            <div
              className="flex gap-0 mt-4"
              style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}
            >
              {[
                { value: "4", label: "Access Roles" },
                { value: "8", label: "Core Modules" },
                { value: "Real-time", label: "Operations" },
              ].map((stat, i) => (
                <div
                  key={stat.label}
                  className="flex-1 pt-5"
                  style={{
                    borderRight: i < 2 ? "1px solid rgba(255,255,255,0.08)" : "none",
                    paddingRight: "1.5rem",
                    paddingLeft: i > 0 ? "1.5rem" : 0,
                  }}
                >
                  <div
                    style={{
                      fontFamily: "'Barlow Condensed', sans-serif",
                      fontSize: "1.7rem",
                      fontWeight: 700,
                      color: "#f0f0f0",
                      lineHeight: 1,
                    }}
                  >
                    {stat.value}
                  </div>
                  <div style={{ fontSize: "0.7rem", color: "#3a3a3a", marginTop: "0.25rem", letterSpacing: "0.04em" }}>
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom active routes ticker */}
          <div
            className="flex items-center gap-3 mt-auto pt-8"
            style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
          >
            <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            <span
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "0.65rem",
                color: "#3a3a3a",
                letterSpacing: "0.1em",
              }}
            >
              SYSTEM OPERATIONAL — 24 ACTIVE ROUTES — 7 DRIVERS ON DUTY
            </span>
          </div>
        </div>
      </div>

      {/* ── RIGHT PANEL ── */}
      <div
        className="flex-1 flex items-center justify-center px-8 py-12"
        style={{ background: "#0a0a0a" }}
      >
        <div className="w-full max-w-[400px]">

          {/* Mobile logo */}
          <div className="flex items-center gap-2.5 mb-10 lg:hidden">
            <div className="w-7 h-7 flex items-center justify-center" style={{ background: "#ffffff" }}>
              <Truck size={14} color="#0a0a0a" strokeWidth={2.5} />
            </div>
            <span
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                fontSize: "1rem",
                fontWeight: 700,
                letterSpacing: "0.14em",
                color: "#f0f0f0",
                textTransform: "uppercase",
              }}
            >
              TransitOps
            </span>
          </div>

          {/* Header */}
          <div className="mb-8">
            <h2
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                fontSize: "1.75rem",
                fontWeight: 700,
                color: "#f0f0f0",
                letterSpacing: "-0.01em",
                marginBottom: "0.3rem",
              }}
            >
              Sign In
            </h2>
            <p style={{ fontSize: "0.8rem", color: "#5a5a5a" }}>
              Select your role and enter your credentials to continue.
            </p>
          </div>

          {/* Role selector */}
          <div className="mb-6">
            <label
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "0.6rem",
                letterSpacing: "0.16em",
                color: "#5a5a5a",
                textTransform: "uppercase",
                display: "block",
                marginBottom: "0.5rem",
              }}
            >
              Access Role
            </label>
            <div className="grid grid-cols-2 gap-px" style={{ background: "rgba(255,255,255,0.08)" }}>
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
                      background: isActive ? "#1c1c1c" : "#111111",
                      border: "none",
                      cursor: "pointer",
                      outline: "none",
                      borderLeft: isActive ? "2px solid #ffffff" : "2px solid transparent",
                    }}
                    aria-pressed={isActive}
                  >
                    <Icon
                      size={13}
                      color={isActive ? "#ffffff" : "#3a3a3a"}
                      style={{ marginTop: "1px", flexShrink: 0 }}
                    />
                    <div>
                      <div
                        style={{
                          fontSize: "0.78rem",
                          fontWeight: 600,
                          color: isActive ? "#f0f0f0" : "#5a5a5a",
                          lineHeight: 1.2,
                          marginBottom: "0.15rem",
                        }}
                      >
                        {role.label}
                      </div>
                      <div style={{ fontSize: "0.62rem", color: "#3a3a3a", lineHeight: 1.4 }}>
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
              <label
                htmlFor="email"
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: "0.6rem",
                  letterSpacing: "0.16em",
                  color: "#5a5a5a",
                  textTransform: "uppercase",
                  display: "block",
                  marginBottom: "0.45rem",
                }}
              >
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
                placeholder="operator@transitops.io"
                style={inputStyle(emailFocused)}
              />
            </div>

            {/* Password */}
            <div className="mb-5">
              <div className="flex items-center justify-between mb-2">
                <label
                  htmlFor="password"
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: "0.6rem",
                    letterSpacing: "0.16em",
                    color: "#5a5a5a",
                    textTransform: "uppercase",
                  }}
                >
                  Password
                </label>
                <button
                  type="button"
                  style={{
                    fontSize: "0.72rem",
                    color: "#5a5a5a",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: 0,
                    fontWeight: 400,
                    textDecoration: "underline",
                    textUnderlineOffset: "2px",
                  }}
                >
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
                  style={{ background: "none", border: "none", cursor: "pointer", padding: "2px", color: "#5a5a5a" }}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div
                className="flex items-start gap-2.5 mb-4 p-3"
                style={{ background: "rgba(255,59,59,0.06)", border: "1px solid rgba(255,59,59,0.2)" }}
              >
                <AlertCircle size={13} color="#ff3b3b" style={{ marginTop: "1px", flexShrink: 0 }} />
                <p style={{ fontSize: "0.78rem", color: "#ff3b3b", lineHeight: 1.45 }}>{error}</p>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 transition-opacity duration-150"
              style={{
                background: "#ffffff",
                color: "#0a0a0a",
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
          <div
            className="mt-6"
            style={{ border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <div
              className="px-4 py-2.5"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", background: "#111111" }}
            >
              <span
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: "0.58rem",
                  letterSpacing: "0.16em",
                  color: "#3a3a3a",
                  textTransform: "uppercase",
                }}
              >
                Demo Credentials — password: transit2024
              </span>
            </div>
            <div className="divide-y" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
              {demoCredentials.map((demo) => (
                <div
                  key={demo.role}
                  className="flex items-center justify-between px-4 py-2.5"
                  style={{ background: "#0e0e0e" }}
                >
                  <span style={{ fontSize: "0.72rem", color: "#5a5a5a" }}>{demo.role}</span>
                  <span
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: "0.65rem",
                      color: "#888888",
                    }}
                  >
                    {demo.email}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <p
            style={{
              fontSize: "0.65rem",
              color: "#2a2a2a",
              textAlign: "center",
              marginTop: "1.5rem",
              letterSpacing: "0.04em",
            }}
          >
            TRANSITOPS © 2024
          </p>
        </div>
      </div>
    </div>
  );
}
