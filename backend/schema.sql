-- TransitOps — PostgreSQL / NeonDB schema
-- Idempotent: safe to run multiple times.

-- ── Extensions ──────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- gen_random_uuid()

-- ── ENUM types ──────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('ADMIN', 'FLEET_MANAGER', 'SAFETY_OFFICER', 'FINANCIAL_ANALYST');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE vehicle_status AS ENUM ('AVAILABLE', 'ON_TRIP', 'IN_SHOP', 'RETIRED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE driver_status AS ENUM ('AVAILABLE', 'ON_TRIP', 'OFF_DUTY', 'SUSPENDED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE trip_status AS ENUM ('DRAFT', 'DISPATCHED', 'COMPLETED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE maintenance_status AS ENUM ('OPEN', 'COMPLETED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE expense_type AS ENUM ('FUEL', 'MAINTENANCE', 'TOLL', 'PARKING', 'INSURANCE', 'OTHER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── users ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  phone         TEXT,
  role          user_role NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── vehicles ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vehicles (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_number TEXT NOT NULL UNIQUE,
  model               TEXT NOT NULL,
  vehicle_type        TEXT NOT NULL,
  max_load_capacity   NUMERIC(12,2) NOT NULL CHECK (max_load_capacity >= 0),
  current_odometer    NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (current_odometer >= 0),
  acquisition_cost    NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (acquisition_cost >= 0),
  status              vehicle_status NOT NULL DEFAULT 'AVAILABLE',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── drivers ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS drivers (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL,
  license_number   TEXT NOT NULL UNIQUE,
  license_category TEXT,
  license_expiry   DATE NOT NULL,
  contact_number   TEXT,
  safety_score     INTEGER NOT NULL DEFAULT 100 CHECK (safety_score BETWEEN 0 AND 100),
  status           driver_status NOT NULL DEFAULT 'AVAILABLE',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── trips ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trips (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id       UUID REFERENCES vehicles(id) ON DELETE SET NULL,
  driver_id        UUID REFERENCES drivers(id) ON DELETE SET NULL,
  created_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  source           TEXT NOT NULL,
  destination      TEXT NOT NULL,
  cargo_weight     NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (cargo_weight >= 0),
  planned_distance NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (planned_distance >= 0),
  actual_distance  NUMERIC(12,2) CHECK (actual_distance >= 0),
  start_odometer   NUMERIC(12,2),
  end_odometer     NUMERIC(12,2),
  fuel_used        NUMERIC(12,2),
  revenue          NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (revenue >= 0),
  status           trip_status NOT NULL DEFAULT 'DRAFT',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── maintenance_logs ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS maintenance_logs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id   UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  description  TEXT NOT NULL,
  cost         NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (cost >= 0),
  status       maintenance_status NOT NULL DEFAULT 'OPEN',
  opened_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at    TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── fuel_logs ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fuel_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id  UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  trip_id     UUID REFERENCES trips(id) ON DELETE SET NULL,
  liters      NUMERIC(12,2) NOT NULL CHECK (liters >= 0),
  cost        NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (cost >= 0),
  logged_at   DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── expenses ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS expenses (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id   UUID REFERENCES vehicles(id) ON DELETE CASCADE,
  trip_id      UUID REFERENCES trips(id) ON DELETE SET NULL,
  expense_type expense_type NOT NULL,
  amount       NUMERIC(14,2) NOT NULL CHECK (amount >= 0),
  note         TEXT,
  incurred_at  DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Indexes ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_vehicles_status         ON vehicles(status);
CREATE INDEX IF NOT EXISTS idx_drivers_status          ON drivers(status);
CREATE INDEX IF NOT EXISTS idx_drivers_license_expiry  ON drivers(license_expiry);
CREATE INDEX IF NOT EXISTS idx_trips_status            ON trips(status);
CREATE INDEX IF NOT EXISTS idx_trips_vehicle           ON trips(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_trips_driver            ON trips(driver_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_vehicle     ON maintenance_logs(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_fuel_vehicle            ON fuel_logs(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_expenses_vehicle        ON expenses(vehicle_id);
