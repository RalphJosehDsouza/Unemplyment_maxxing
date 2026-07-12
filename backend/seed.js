import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User.js';

dotenv.config();

const demoUsers = [
  { role: "Fleet Manager", email: "fleet@transitops.io", password: "transit2024" },
  { role: "Dispatcher", email: "dispatch@transitops.io", password: "transit2024" },
  { role: "Safety Officer", email: "safety@transitops.io", password: "transit2024" },
  { role: "Financial Analyst", email: "finance@transitops.io", password: "transit2024" },
];

async function seedDB() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB for seeding');

    // Clear existing users
    await User.deleteMany({});
    console.log('Cleared existing users');

    // Insert demo users
    for (const userData of demoUsers) {
      const user = new User(userData);
      await user.save();
      console.log(`Created user: ${userData.email} (${userData.role})`);
    }

    console.log('Seeding completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding DB:', error);
    process.exit(1);
  }
}

seedDB();
