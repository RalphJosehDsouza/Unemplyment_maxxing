import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const router = express.Router();

router.post('/login', async (req, res) => {
  const { email, password, role } = req.body;

  try {
    // 1. Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // 2. Check if password is correct
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // 3. Check if role matches (if role is provided in request)
    // The frontend sends the role from the UI to verify it matches the user
    // In a real app, this might be handled differently, but we'll enforce it here based on the demo requirements.
    if (role && user.role !== role) {
      // In the App.tsx, the role string doesn't match the DB exactly (e.g., 'fleet_manager' vs 'Fleet Manager')
      // Let's normalize for comparison, or just trust the DB role. 
      // Actually, let's just return the user's role from DB and let frontend handle it, 
      // or map frontend id to backend role name.
      const normalizedReqRole = role.replace('_', ' ').toLowerCase();
      const normalizedDbRole = user.role.toLowerCase();
      if (normalizedReqRole !== normalizedDbRole) {
         return res.status(403).json({ message: 'Unauthorized role for this user' });
      }
    }

    // 4. Create and sign JWT
    const payload = {
      userId: user._id,
      role: user.role,
      email: user.email
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET || 'fallback_secret', {
      expiresIn: '7d'
    });

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
