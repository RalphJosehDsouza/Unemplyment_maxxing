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
