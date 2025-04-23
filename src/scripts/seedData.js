import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import User from '../models/User.js';
import Service from '../models/Service.js';
import Booking from '../models/Booking.js';

dotenv.config();

const serviceCategories = [
  'Cleaning',
  'Plumbing',
  'Electrical',
  'Carpentry',
  'Painting',
  'Landscaping',
  'Moving',
  'Appliance Repair',
  'HVAC',
  'Pest Control'
];

const locations = [
  'New York',
  'Los Angeles',
  'Chicago',
  'Houston',
  'Phoenix',
  'Philadelphia',
  'San Antonio',
  'San Diego',
  'Dallas',
  'San Jose'
];

const serviceImages = {
  'Cleaning': 'https://images.unsplash.com/photo-1581578731548-c64695cc6952',
  'Plumbing': 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e',
  'Electrical': 'https://images.unsplash.com/photo-1621905252507-b35492cc74b4',
  'Carpentry': 'https://images.unsplash.com/photo-1588854337115-1c67d9247e4d',
  'Painting': 'https://images.unsplash.com/photo-1589939705384-5185137a7f0f',
  'Landscaping': 'https://images.unsplash.com/photo-1558904541-efa84396f71c',
  'Moving': 'https://images.unsplash.com/photo-1603796846097-bee99e4a601f',
  'Appliance Repair': 'https://images.unsplash.com/photo-1581092921461-7d09c7e8e824',
  'HVAC': 'https://images.unsplash.com/photo-1621905252507-b35492cc74b4',
  'Pest Control': 'https://images.unsplash.com/photo-1632496099720-84f5b1bf2edb'
};

const generateRandomPrice = () => Math.floor(Math.random() * (300 - 50 + 1)) + 50;
const generateRandomRating = () => (Math.random() * (5 - 3.5) + 3.5).toFixed(1);
const generateRandomReviews = () => Math.floor(Math.random() * (200 - 10 + 1)) + 10;
const generateRandomPopularity = () => Math.floor(Math.random() * 100);

async function seedDatabase() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Clear existing data
    await User.deleteMany({});
    await Service.deleteMany({});
    await Booking.deleteMany({});

    // Create admin user
    const adminPassword = await bcrypt.hash('admin123', 10);
    const admin = await User.create({
      name: 'Admin User',
      email: 'admin@servicehub.com',
      password: adminPassword,
      role: 'admin',
      location: 'New York'
    });

    // Create provider users
    const providers = [];
    for (let i = 1; i <= 10; i++) {
      const password = await bcrypt.hash('provider123', 10);
      const provider = await User.create({
        name: `Provider ${i}`,
        email: `provider${i}@servicehub.com`,
        password: password,
        role: 'provider',
        location: locations[Math.floor(Math.random() * locations.length)]
      });
      providers.push(provider);
    }

    // Create regular users
    const users = [];
    for (let i = 1; i <= 10; i++) {
      const password = await bcrypt.hash('user123', 10);
      const user = await User.create({
        name: `User ${i}`,
        email: `user${i}@servicehub.com`,
        password: password,
        role: 'user',
        location: locations[Math.floor(Math.random() * locations.length)]
      });
      users.push(user);
    }

    // Create services
    const services = [];
    for (let i = 0; i < 50; i++) {
      const category = serviceCategories[Math.floor(Math.random() * serviceCategories.length)];
      const service = await Service.create({
        title: `${category} Service ${i + 1}`,
        description: `Professional ${category.toLowerCase()} service with experienced staff.`,
        category: category,
        price: generateRandomPrice(),
        image: serviceImages[category],
        provider: providers[Math.floor(Math.random() * providers.length)]._id,
        rating: generateRandomRating(),
        reviews: generateRandomReviews(),
        location: locations[Math.floor(Math.random() * locations.length)],
        popularity: generateRandomPopularity(),
        availability: Math.random() > 0.1 // 90% chance of being available
      });
      services.push(service);
    }

    // Create bookings
    const bookingStatuses = ['pending', 'confirmed', 'completed', 'cancelled'];
    for (let i = 0; i < 100; i++) {
      const service = services[Math.floor(Math.random() * services.length)];
      const user = users[Math.floor(Math.random() * users.length)];
      const status = bookingStatuses[Math.floor(Math.random() * bookingStatuses.length)];
      const quantity = Math.floor(Math.random() * 3) + 1;

      await Booking.create({
        user: user._id,
        service: service._id,
        date: new Date(Date.now() + Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000),
        status: status,
        quantity: quantity,
        totalPrice: service.price * quantity
      });
    }

    console.log('Database seeded successfully!');
    console.log('Sample login credentials:');
    console.log('Admin - email: admin@servicehub.com, password: admin123');
    console.log('Provider - email: provider1@servicehub.com, password: provider123');
    console.log('User - email: user1@servicehub.com, password: user123');

  } catch (error) {
    console.error('Error seeding database:', error);
  } finally {
    await mongoose.connection.close();
  }
}

seedDatabase(); 