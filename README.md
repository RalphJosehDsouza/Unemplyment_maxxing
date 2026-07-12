# TransitOps — Smart Transport Operations Platform

A MERN stack transport operations platform with RBAC, fleet management, trip dispatch, maintenance workflow, and financial analytics.

---

## Design System

### Color Palette

| Token | Hex | Usage |
|---|---|---|
| `--background` | `#0a0a0a` | Page background — near-black |
| `--foreground` | `#f0f0f0` | Body text — near-white |
| `--card` | `#141414` | Card / panel surfaces |
| `--card-foreground` | `#f0f0f0` | Text on cards |
| `--primary` | `#ffffff` | Primary CTA, active states, white |
| `--primary-foreground` | `#0a0a0a` | Text on primary buttons |
| `--secondary` | `#1c1c1c` | Secondary surfaces, sidebar items |
| `--secondary-foreground` | `#a0a0a0` | Secondary text |
| `--muted` | `#181818` | Input backgrounds, subdued surfaces |
| `--muted-foreground` | `#5a5a5a` | Labels, captions, placeholder text |
| `--accent` | `#ffffff` | Highlights — white |
| `--destructive` | `#ff3b3b` | Error states, cancelled trip indicators |
| `--border` | `rgba(255,255,255,0.10)` | Hairline borders — subtle on dark |
| `--ring` | `rgba(255,255,255,0.4)` | Focus ring |
| `--sidebar` | `#0a0a0a` | Sidebar background |

### Chart Colors (for analytics pages)

Monochrome scale — use opacity or grey steps to distinguish data series:

| Token | Hex | Semantic Use |
|---|---|---|
| `--chart-1` | `#ffffff` | Primary metric — full white |
| `--chart-2` | `#888888` | Secondary series |
| `--chart-3` | `#555555` | Tertiary series |
| `--chart-4` | `#333333` | Quaternary / background bar |
| `--chart-5` | `#ff3b3b` | Alert / critical — only non-grey color |

---

## Typography

```
Display / Headings:  Barlow Condensed — Bold 700, uppercase where structural
Body / UI:           Inter — Regular 400, Medium 500, SemiBold 600
Data / Labels:       JetBrains Mono — used for IDs, codes, metrics, table values
```

### Type Scale

| Level | Size | Font | Weight | Usage |
|---|---|---|---|---|
| Page title | 1.9rem | Barlow Condensed | 700 | Auth header, section titles |
| Hero display | 3.2rem | Barlow Condensed | 700 | Landing copy |
| Section label | 0.65rem | JetBrains Mono | 400 | Form field labels, uppercase |
| Body | 0.875rem | Inter | 400 | Form inputs, descriptions |
| Caption | 0.72rem | Inter | 400 | Hints, footer |
| Data value | 0.68rem | JetBrains Mono | 500 | IDs, license numbers, emails |

---

## Spacing & Radius

- **Border radius:** `0.5rem` (8px) — cards, inputs, buttons
- **Input padding:** `0.7rem 0.9rem`
- **Card padding:** `1.5rem` default, `1rem` compact
- **Section gaps:** `1.5rem` between form groups, `2rem` between sections

---

## Status Badge Colors

Use these consistently across all status indicators:

| Status | Background | Text | Border |
|---|---|---|---|
| Available | `rgba(16,185,129,0.12)` | `#10b981` | `rgba(16,185,129,0.25)` |
| On Trip | `rgba(59,130,246,0.12)` | `#3b82f6` | `rgba(59,130,246,0.25)` |
| In Shop | `rgba(245,158,11,0.12)` | `#f59e0b` | `rgba(245,158,11,0.25)` |
| Retired | `rgba(100,116,139,0.12)` | `#64748b` | `rgba(100,116,139,0.25)` |
| Suspended | `rgba(239,68,68,0.12)` | `#ef4444` | `rgba(239,68,68,0.25)` |
| Off Duty | `rgba(107,114,128,0.12)` | `#9ca3af` | `rgba(107,114,128,0.25)` |

---

## Component Patterns

### Inputs
```css
background: #111827;
border: 1.5px solid rgba(255,255,255,0.08);
border-radius: 0.5rem;
padding: 0.7rem 0.9rem;
color: #e8eaf0;
font-size: 0.875rem;

/* Focus state */
border-color: #f59e0b;
box-shadow: 0 0 0 3px rgba(245,158,11,0.1);
```

### Primary Button
```css
background: #f59e0b;
color: #0b0f1a;
font-weight: 700;
font-size: 0.875rem;
padding: 0.78rem 1.25rem;
border-radius: 0.5rem;
box-shadow: 0 0 20px rgba(245,158,11,0.25);
```

### Cards / Panels
```css
background: #111827;
border: 1px solid rgba(255,255,255,0.08);
border-radius: 0.5rem;
padding: 1.25rem 1.5rem;
```

### Section Labels (above inputs / KPIs)
```css
font-family: 'JetBrains Mono', monospace;
font-size: 0.65rem;
letter-spacing: 0.14em;
color: #64748b;
text-transform: uppercase;
```

---

## Pages Reference

| Route | Page | Roles |
|---|---|---|
| `/` | Authentication | All |
| `/dashboard` | KPI Overview | All (role-filtered) |
| `/vehicles` | Vehicle Registry | Fleet Manager |
| `/drivers` | Driver Management | Fleet Manager, Safety Officer |
| `/trips` | Trip Management | Dispatcher |
| `/maintenance` | Maintenance Log | Fleet Manager |
| `/fuel` | Fuel & Expense Tracking | Financial Analyst, Fleet Manager |
| `/reports` | Analytics & Reports | Financial Analyst |

---

## MERN Stack Structure

```
/client          — React frontend (Vite + Tailwind)
  /src
    /app          — Page components
    /components   — Shared UI (StatusBadge, DataTable, KPICard, etc.)
    /styles       — theme.css, fonts.css
    /hooks        — useAuth, useFetch, etc.
    /context      — AuthContext with RBAC

/server          — Express + Node.js backend
  /routes         — auth, vehicles, drivers, trips, maintenance, fuel
  /models         — Mongoose schemas
  /middleware     — authMiddleware, roleGuard
  /controllers    — Business logic per domain

/db              — MongoDB (Atlas or local)
```

### Environment Variables
```env
MONGO_URI=mongodb://...
JWT_SECRET=your_secret_key
JWT_EXPIRES_IN=7d
PORT=5000
CLIENT_URL=http://localhost:5173
```

---

## Authentication Flow (MERN)

1. **POST** `/api/auth/login` — email + password + role
2. Server validates credentials, checks role from User document
3. Returns signed JWT with `{ userId, role, name }`
4. Client stores JWT in `httpOnly` cookie or `localStorage`
5. All protected routes verify JWT via `authMiddleware`
6. `roleGuard(["fleet_manager", "dispatcher"])` restricts endpoint access

---

## Business Rules Summary

- Vehicle reg numbers must be unique
- Retired / In Shop vehicles excluded from dispatch
- Drivers with expired license or Suspended status cannot be assigned
- Cargo weight must not exceed vehicle max capacity
- Dispatching a trip sets vehicle + driver → `On Trip`
- Completing a trip sets vehicle + driver → `Available`
- Opening a maintenance record sets vehicle → `In Shop`
- Closing maintenance sets vehicle → `Available` (unless Retired)
