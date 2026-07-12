import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { pool } from './db.js';
import authRoutes from './routes/auth.js';
import vehicleRoutes from './routes/vehicles.js';
import driverRoutes from './routes/drivers.js';
import tripRoutes from './routes/trips.js';
import fuelRoutes from './routes/fuel.js';
import expenseRoutes from './routes/expenses.js';
import reportRoutes from './routes/reports.js';
import advisorRoutes from './routes/advisor.js';
import maintenanceRoutes from './routes/maintenance.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/drivers', driverRoutes);
app.use('/api/trips', tripRoutes);
app.use('/api/fuel', fuelRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/advisor', advisorRoutes);
app.use('/api/maintenance', maintenanceRoutes);

// Verify DB connectivity, then start the server.
pool
  .query('SELECT 1')
  .then(() => {
    console.log('Connected to NeonDB (PostgreSQL) successfully');
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error('Error connecting to database:', error.message);
    process.exit(1);
  });
