# TransitOps — Smart Transport Operations Platform

A transport operations platform with RBAC, fleet management, trip dispatch, maintenance workflow, and financial analytics.

**Stack:** React (Vite + Tailwind v4) · Express (Node) · PostgreSQL on NeonDB · JWT auth.

---

## Architecture

```
/frontend        — React app (Vite + Tailwind v4)
  /src
    /app
      /pages       — Login, Dashboard, Vehicles
      /components  — Layout (sidebar shell), StatusBadge, ui/*
    /components    — ProtectedRoute (RBAC guard)
    /context       — AuthContext (JWT + user state)
    /lib           — api.ts (auth fetch), constants.ts (enums/types)
    /styles        — theme.css, fonts.css, tailwind.css

/backend         — Express + Node.js API
  index.js         — app bootstrap + DB connectivity check
  db.js            — pg connection pool
  schema.sql       — full PostgreSQL schema (enums, tables, indexes)
  seed.js          — seeds demo users + sample vehicles
  /scripts
    migrate.js     — applies schema.sql to the database
  /routes          — auth, vehicles
  /middleware      — auth.js (authenticate + authorize/RBAC)
```

### Database (NeonDB / PostgreSQL)

Tables: `users`, `vehicles`, `drivers`, `trips`, `maintenance_logs`, `fuel_logs`, `expenses`.
UUID primary keys, PostgreSQL ENUMs for status fields, foreign keys, CHECK constraints, and indexes on hot columns. See [`backend/schema.sql`](backend/schema.sql).

ENUM types: `user_role`, `vehicle_status`, `driver_status`, `trip_status`, `maintenance_status`, `expense_type`.

---

## Getting Started

### 1. Environment

Create `backend/.env`:

```env
DATABASE_URL=postgresql://<user>:<password>@<host>/<db>?sslmode=require
JWT_SECRET=your_secret_key
PORT=5000
```

The frontend proxies `/api` → `http://localhost:5000` (see `frontend/vite.config.ts`).

### 2. Install

```bash
npm run install:all      # root + frontend + backend
```

### 3. Set up the database (one-time)

```bash
npm run migrate --prefix backend    # creates tables/enums/indexes
npm run seed                        # seeds demo users + sample vehicles
```

### 4. Run

```bash
npm run dev:all          # backend (:5000) + frontend (:5173)
# or individually:
npm run dev:backend
npm run dev:frontend
```

---

## Roles & Demo Credentials

Password for all demo accounts: **`password123`**

| Role | Email | Access |
|---|---|---|
| Fleet Manager | `fleetmanager@transitops.com` | Vehicles, maintenance, fleet lifecycle |
| Safety Officer | `safetyofficer@transitops.com` | Drivers, licenses, safety scores |
| Financial Analyst | `financialanalyst@transitops.com` | Fuel, expenses, reports |
| Admin | `admin@transitops.com` | Full access across all modules |

RBAC is enforced both on the client (`ProtectedRoute`) and the server (`authenticate` + `authorize` middleware). `ADMIN` passes every role guard.

---

## API Reference (current)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/auth/login` | — | Email + password → JWT |
| `GET` | `/api/auth/me` | JWT | Current user |
| `GET` | `/api/vehicles` | JWT | List (filters: `?status`, `?type`, `?search`) |
| `GET` | `/api/vehicles/:id` | JWT | Single vehicle |
| `POST` | `/api/vehicles` | Fleet Manager | Create |
| `PUT` | `/api/vehicles/:id` | Fleet Manager | Update |
| `DELETE` | `/api/vehicles/:id` | Fleet Manager | Delete (blocked if on trip / open maintenance) |

---

## Business Rules

- Vehicle registration numbers must be unique (enforced by DB constraint → `409`).
- Retired / In Shop vehicles are excluded from dispatch (upcoming Trip module).
- Drivers with expired license or Suspended status cannot be assigned (upcoming).
- Cargo weight must not exceed vehicle max capacity (upcoming).
- Dispatching a trip sets vehicle + driver → `On Trip`; completing/cancelling restores `Available` (upcoming).
- Opening a maintenance record sets vehicle → `In Shop`; closing restores `Available` unless Retired (upcoming).

Status transitions and cross-entity validations live in the backend service/route layer.

---

## Design System

### Color Palette

| Token | Hex | Usage |
|---|---|---|
| `--background` | `#0a0a0a` | Page background — near-black |
| `--foreground` | `#f0f0f0` | Body text — near-white |
| `--card` | `#141414` | Card / panel surfaces |
| `--primary` | `#ffffff` | Primary CTA, active states |
| `--secondary` | `#1c1c1c` | Secondary surfaces, sidebar items |
| `--muted` | `#181818` | Input backgrounds |
| `--muted-foreground` | `#5a5a5a` | Labels, captions |
| `--destructive` | `#ff3b3b` | Errors, cancelled/delete |
| `--border` | `rgba(255,255,255,0.10)` | Hairline borders |

### Typography

```
Display / Headings:  Barlow Condensed — Bold 700, uppercase where structural
Body / UI:           Inter — Regular 400, Medium 500, SemiBold 600
Data / Labels:       JetBrains Mono — IDs, codes, metrics, table values
```

### Status Badge Colors

| Status | Text |
|---|---|
| Available | `#10b981` |
| On Trip | `#3b82f6` |
| In Shop | `#f59e0b` |
| Retired | `#64748b` |
| Suspended | `#ef4444` |
| Off Duty | `#9ca3af` |

Radius is `0` throughout (square edges) — see `frontend/src/styles/theme.css`.
