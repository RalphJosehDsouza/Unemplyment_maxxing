import express from 'express';
import { query } from '../db.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// All analytics routes require authentication
router.use(authenticate);

// Fleet Analytics: Vehicle status breakdown
router.get('/fleet', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT 
        status, 
        COUNT(*) as count
       FROM vehicles
       GROUP BY status
       ORDER BY status ASC`
    );
    res.json({ fleetData: rows });
  } catch (error) {
    console.error('Fleet analytics error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Trip Analytics: Trip status breakdown
router.get('/trips', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT 
        status, 
        COUNT(*) as count
       FROM trips
       GROUP BY status
       ORDER BY status ASC`
    );
    res.json({ tripData: rows });
  } catch (error) {
    console.error('Trip analytics error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Financial Analytics: Revenue vs Expenses
router.get('/financial', async (req, res) => {
  try {
    const { rows: trips } = await query(
      `SELECT COALESCE(SUM(revenue), 0) as total_revenue 
       FROM trips 
       WHERE status = 'COMPLETED'`
    );
    
    const { rows: maintenance } = await query(
      `SELECT COALESCE(SUM(cost), 0) as total_maintenance 
       FROM maintenance_logs 
       WHERE status = 'COMPLETED'`
    );
    
    const { rows: fuel } = await query(
      `SELECT COALESCE(SUM(cost), 0) as total_fuel 
       FROM fuel_logs`
    );
    
    const { rows: expenses } = await query(
      `SELECT COALESCE(SUM(amount), 0) as total_expenses 
       FROM expenses`
    );

    const totalRevenue = parseFloat(trips[0]?.total_revenue || 0);
    const totalMaintenance = parseFloat(maintenance[0]?.total_maintenance || 0);
    const totalFuel = parseFloat(fuel[0]?.total_fuel || 0);
    const totalExpenses = parseFloat(expenses[0]?.total_expenses || 0);

    res.json({
      financialData: [
        { category: 'Revenue', amount: totalRevenue },
        { category: 'Maintenance', amount: totalMaintenance },
        { category: 'Fuel', amount: totalFuel },
        { category: 'Other Expenses', amount: totalExpenses }
      ]
    });
  } catch (error) {
    console.error('Financial analytics error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Driver Performance: Safety scores and status breakdown
router.get('/drivers', async (req, res) => {
  try {
    const { rows: drivers } = await query(
      `SELECT 
        status, 
        COUNT(*) as count
       FROM drivers
       GROUP BY status
       ORDER BY status ASC`
    );
    
    const { rows: safety } = await query(
      `SELECT 
        CASE 
          WHEN safety_score >= 90 THEN 'Excellent (90+)'
          WHEN safety_score >= 75 THEN 'Good (75-89)'
          WHEN safety_score >= 60 THEN 'Fair (60-74)'
          ELSE 'Poor (<60)'
        END as score_category,
        COUNT(*) as count
       FROM drivers
       GROUP BY score_category
       ORDER BY score_category DESC`
    );

    res.json({
      driverStatusData: drivers,
      driverSafetyData: safety
    });
  } catch (error) {
    console.error('Driver analytics error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Maintenance Analytics: Open vs Completed maintenance logs
router.get('/maintenance', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT 
        status, 
        COUNT(*) as count,
        COALESCE(SUM(cost), 0) as total_cost
       FROM maintenance_logs
       GROUP BY status
       ORDER BY status ASC`
    );
    
    res.json({
      maintenanceData: rows.map(row => ({
        ...row,
        total_cost: parseFloat(row.total_cost)
      }))
    });
  } catch (error) {
    console.error('Maintenance analytics error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Comprehensive Dashboard: All key metrics
router.get('/summary', async (req, res) => {
  try {
    const { rows: vehicleCount } = await query(`SELECT COUNT(*) as count FROM vehicles`);
    const { rows: driverCount } = await query(`SELECT COUNT(*) as count FROM drivers`);
    const { rows: tripCount } = await query(`SELECT COUNT(*) as count FROM trips WHERE status = 'COMPLETED'`);
    const { rows: avgSafety } = await query(`SELECT AVG(safety_score) as avg_score FROM drivers`);

    res.json({
      summary: {
        totalVehicles: parseInt(vehicleCount[0]?.count || 0),
        totalDrivers: parseInt(driverCount[0]?.count || 0),
        completedTrips: parseInt(tripCount[0]?.count || 0),
        avgSafetyScore: parseFloat(avgSafety[0]?.avg_score || 0).toFixed(1)
      }
    });
  } catch (error) {
    console.error('Summary analytics error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
