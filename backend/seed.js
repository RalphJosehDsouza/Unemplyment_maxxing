import bcrypt from 'bcryptjs';
import { pool } from './db.js';

const demoUsers = [
  { name: 'Rahul Sharma',        email: 'fleetmanager@transitops.com',     password: 'password123', phone: '+91 9876543210', role: 'FLEET_MANAGER' },
  { name: 'Priya Nair',          email: 'safetyofficer@transitops.com',    password: 'password123', phone: '+91 9876543211', role: 'SAFETY_OFFICER' },
  { name: 'Arjun Mehta',         email: 'financialanalyst@transitops.com', password: 'password123', phone: '+91 9876543212', role: 'FINANCIAL_ANALYST' },
  { name: 'System Administrator', email: 'admin@transitops.com',           password: 'password123', phone: '+91 9876543213', role: 'ADMIN' },
];

const demoVehicles = [
  { registration_number: 'MH12-AB-1234', model: 'Tata Ace Gold',       vehicle_type: 'Mini Truck', max_load_capacity: 750,  current_odometer: 42150, acquisition_cost: 650000,  status: 'AVAILABLE' },
  { registration_number: 'MH14-CD-5678', model: 'Ashok Leyland Dost',  vehicle_type: 'Pickup',     max_load_capacity: 1250, current_odometer: 18900, acquisition_cost: 890000,  status: 'AVAILABLE' },
  { registration_number: 'MH01-EF-9012', model: 'Mahindra Bolero Maxx', vehicle_type: 'Pickup',     max_load_capacity: 1500, current_odometer: 63400, acquisition_cost: 780000,  status: 'ON_TRIP' },
  { registration_number: 'MH04-GH-3456', model: 'Eicher Pro 2049',     vehicle_type: 'Truck',      max_load_capacity: 5000, current_odometer: 112300, acquisition_cost: 1850000, status: 'IN_SHOP' },
  { registration_number: 'MH02-IJ-7890', model: 'Force Traveller',     vehicle_type: 'Van',        max_load_capacity: 500,  current_odometer: 95600, acquisition_cost: 1400000, status: 'RETIRED' },
];

const demoDrivers = [
  { name: 'Vikram Singh',      license_number: 'DL01-AB-0123456', license_category: 'HCV', license_expiry: '2026-12-31', contact_number: '+91 9001234567', safety_score: 95, status: 'AVAILABLE' },
  { name: 'Amit Patel',        license_number: 'GJ02-CD-0234567', license_category: 'HCV', license_expiry: '2025-06-30', contact_number: '+91 9001234568', safety_score: 88, status: 'ON_TRIP' },
  { name: 'Suresh Kumar',      license_number: 'KA03-EF-0345678', license_category: 'LCV', license_expiry: '2024-09-15', contact_number: '+91 9001234569', safety_score: 72, status: 'AVAILABLE' },
  { name: 'Rajesh Verma',      license_number: 'UP04-GH-0456789', license_category: 'HCV', license_expiry: '2023-12-31', contact_number: '+91 9001234570', safety_score: 85, status: 'OFF_DUTY' },
  { name: 'Manish Gupta',      license_number: 'DL05-IJ-0567890', license_category: 'HCV', license_expiry: '2024-03-20', contact_number: '+91 9001234571', safety_score: 92, status: 'SUSPENDED' },
];

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Users
    for (const u of demoUsers) {
      const hash = await bcrypt.hash(u.password, 10);
      await client.query(
        `INSERT INTO users (name, email, password_hash, phone, role)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (email) DO UPDATE
           SET name = EXCLUDED.name,
               password_hash = EXCLUDED.password_hash,
               phone = EXCLUDED.phone,
               role = EXCLUDED.role,
               updated_at = now()`,
        [u.name, u.email.toLowerCase(), hash, u.phone, u.role]
      );
      console.log(`Seeded user: ${u.email} (${u.role})`);
    }

    // Vehicles
    for (const v of demoVehicles) {
      await client.query(
        `INSERT INTO vehicles (registration_number, model, vehicle_type, max_load_capacity, current_odometer, acquisition_cost, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (registration_number) DO NOTHING`,
        [v.registration_number, v.model, v.vehicle_type, v.max_load_capacity, v.current_odometer, v.acquisition_cost, v.status]
      );
      console.log(`Seeded vehicle: ${v.registration_number} (${v.model})`);
    }

    // Drivers
    for (const d of demoDrivers) {
      await client.query(
        `INSERT INTO drivers (name, license_number, license_category, license_expiry, contact_number, safety_score, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (license_number) DO NOTHING`,
        [d.name, d.license_number, d.license_category, d.license_expiry, d.contact_number, d.safety_score, d.status]
      );
      console.log(`Seeded driver: ${d.name} (${d.status})`);
    }

    // Trips (completed and dispatched)
    const { rows: vehicles } = await client.query('SELECT id FROM vehicles LIMIT 3');
    const { rows: drivers } = await client.query('SELECT id FROM drivers LIMIT 3');
    const { rows: users } = await client.query('SELECT id FROM users WHERE role = \'FLEET_MANAGER\' LIMIT 1');

    if (vehicles.length > 0 && drivers.length > 0 && users.length > 0) {
      const tripData = [
        { vehicle_id: vehicles[0].id, driver_id: drivers[0].id, created_by: users[0].id, source: 'Mumbai', destination: 'Pune', cargo_weight: 500, planned_distance: 150, revenue: 5000, status: 'COMPLETED' },
        { vehicle_id: vehicles[1].id, driver_id: drivers[1].id, created_by: users[0].id, source: 'Bangalore', destination: 'Chennai', cargo_weight: 800, planned_distance: 350, revenue: 12000, status: 'COMPLETED' },
        { vehicle_id: vehicles[2].id, driver_id: drivers[2].id, created_by: users[0].id, source: 'Delhi', destination: 'Agra', cargo_weight: 300, planned_distance: 230, revenue: 4500, status: 'DISPATCHED' },
      ];

      for (const t of tripData) {
        await client.query(
          `INSERT INTO trips (vehicle_id, driver_id, created_by, source, destination, cargo_weight, planned_distance, revenue, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           ON CONFLICT DO NOTHING`,
          [t.vehicle_id, t.driver_id, t.created_by, t.source, t.destination, t.cargo_weight, t.planned_distance, t.revenue, t.status]
        );
        console.log(`Seeded trip: ${t.source} → ${t.destination}`);
      }

      // Maintenance logs
      const maintenanceData = [
        { vehicle_id: vehicles[0].id, description: 'Regular oil change', cost: 1500, status: 'COMPLETED' },
        { vehicle_id: vehicles[2].id, description: 'Brake pad replacement', cost: 3500, status: 'OPEN' },
      ];

      for (const m of maintenanceData) {
        await client.query(
          `INSERT INTO maintenance_logs (vehicle_id, description, cost, status)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT DO NOTHING`,
          [m.vehicle_id, m.description, m.cost, m.status]
        );
        console.log(`Seeded maintenance: ${m.description}`);
      }

      // Fuel logs
      const fuelData = [
        { vehicle_id: vehicles[0].id, liters: 50, cost: 5500 },
        { vehicle_id: vehicles[1].id, liters: 75, cost: 8250 },
        { vehicle_id: vehicles[2].id, liters: 40, cost: 4400 },
      ];

      for (const f of fuelData) {
        await client.query(
          `INSERT INTO fuel_logs (vehicle_id, liters, cost)
           VALUES ($1, $2, $3)
           ON CONFLICT DO NOTHING`,
          [f.vehicle_id, f.liters, f.cost]
        );
        console.log(`Seeded fuel log: ${f.liters}L for vehicle`);
      }

      // Expenses
      const expenseData = [
        { vehicle_id: vehicles[0].id, expense_type: 'TOLL', amount: 500 },
        { vehicle_id: vehicles[1].id, expense_type: 'INSURANCE', amount: 2500 },
        { vehicle_id: vehicles[2].id, expense_type: 'PARKING', amount: 200 },
      ];

      for (const e of expenseData) {
        await client.query(
          `INSERT INTO expenses (vehicle_id, expense_type, amount)
           VALUES ($1, $2, $3)
           ON CONFLICT DO NOTHING`,
          [e.vehicle_id, e.expense_type, e.amount]
        );
        console.log(`Seeded expense: ${e.expense_type}`);
      }
    }

    await client.query('COMMIT');
    console.log('Seeding completed successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error seeding DB:', error.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
