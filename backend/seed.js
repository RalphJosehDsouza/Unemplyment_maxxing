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
    await client.query('TRUNCATE TABLE maintenance_logs CASCADE;');

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
    const demoDrivers = [
      { name: 'Alex Kumar',    license_number: 'MH-DL-2020-001', license_category: 'HMV', license_expiry: '2027-12-31', contact_number: '+91 9800000001', safety_score: 92 },
      { name: 'Suresh Patil',  license_number: 'MH-DL-2019-045', license_category: 'LMV', license_expiry: '2027-06-15', contact_number: '+91 9800000002', safety_score: 88 },
      { name: 'Rajesh Verma',  license_number: 'MH-DL-2021-112', license_category: 'HMV', license_expiry: '2028-03-20', contact_number: '+91 9800000003', safety_score: 95 },
      { name: 'Mohan Singh',   license_number: 'MH-DL-2018-078', license_category: 'LMV', license_expiry: '2026-09-10', contact_number: '+91 9800000004', safety_score: 80 },
    ];
    for (const d of demoDrivers) {
      await client.query(
        `INSERT INTO drivers (name, license_number, license_category, license_expiry, contact_number, safety_score)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (license_number) DO NOTHING`,
        [d.name, d.license_number, d.license_category, d.license_expiry, d.contact_number, d.safety_score]
      );
      console.log(`Seeded driver: ${d.name} (${d.license_number})`);
    }

    // Maintenance Logs
    const { rows: dbVehicles } = await client.query('SELECT id, registration_number FROM vehicles');
    const vehicleMap = {};
    dbVehicles.forEach(v => {
      vehicleMap[v.registration_number] = v.id;
    });

    const demoLogs = [
      {
        registration_number: 'MH04-GH-3456', // In Shop
        maintenance_type: 'Engine Repair',
        description: 'Engine cylinder misfire, replacing spark plugs and gasket',
        cost: 24500.00,
        status: 'OPEN',
        started_at: 'now() - INTERVAL \'3 days\'',
        completed_at: null
      },
      {
        registration_number: 'MH12-AB-1234',
        maintenance_type: 'Brake Service',
        description: 'Brake pad replacement and disc resurfacing',
        cost: 8500.00,
        status: 'COMPLETED',
        started_at: 'now() - INTERVAL \'15 days\'',
        completed_at: 'now() - INTERVAL \'14 days\''
      },
      {
        registration_number: 'MH14-CD-5678',
        maintenance_type: 'General Service',
        description: '20,000 km routine inspection and engine oil flush',
        cost: 4500.00,
        status: 'COMPLETED',
        started_at: 'now() - INTERVAL \'45 days\'',
        completed_at: 'now() - INTERVAL \'44 days\''
      },
      {
        registration_number: 'MH01-EF-9012',
        maintenance_type: 'Tire Replacement',
        description: 'Replaced front tyres due to uneven tread wear',
        cost: 12000.00,
        status: 'COMPLETED',
        started_at: 'now() - INTERVAL \'60 days\'',
        completed_at: 'now() - INTERVAL \'59 days\''
      },
      {
        registration_number: 'MH04-GH-3456',
        maintenance_type: 'Transmission',
        description: 'Gearbox oil leak repair and clutch plate adjustment',
        cost: 32000.00,
        status: 'COMPLETED',
        started_at: 'now() - INTERVAL \'90 days\'',
        completed_at: 'now() - INTERVAL \'87 days\''
      }
    ];

    for (const log of demoLogs) {
      const vehicleId = vehicleMap[log.registration_number];
      if (vehicleId) {
        await client.query(
          `INSERT INTO maintenance_logs (vehicle_id, maintenance_type, description, cost, status, started_at, completed_at)
           VALUES ($1, $2, $3, $4, $5, ${log.started_at}, ${log.completed_at ? log.completed_at : 'NULL'})`,
          [vehicleId, log.maintenance_type, log.description, log.cost, log.status]
        );
        console.log(`Seeded maintenance log for: ${log.registration_number}`);
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
