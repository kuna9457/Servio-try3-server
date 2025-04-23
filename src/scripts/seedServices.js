import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Service } from '../models/Service';
import { User } from '../models/User';
import bcrypt from 'bcryptjs';

dotenv.config();

const serviceCategories = [
  'Cleaning',
  'Plumbing',
  'Electrical',
  'Carpentry',
  'Painting',
  'Landscaping',
  'Moving',
  'Handyman',
  'Appliance Repair',
  'HVAC',
];

const serviceDescriptions = [
  'Professional service with years of experience',
  'High-quality work at competitive prices',
  'Licensed and insured professionals',
  'Same-day service available',
  'Satisfaction guaranteed',
  'Expert technicians at your service',
  'Reliable and efficient service',
  '24/7 emergency service available',
  'Family-owned business with great reputation',
  'Modern equipment and techniques',
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
  'San Jose',
];

const providerNames = [
  'John Smith',
  'Sarah Johnson',
  'Michael Brown',
  'Emily Davis',
  'David Wilson',
  'Lisa Anderson',
  'Robert Taylor',
  'Jennifer Martinez',
  'William Lee',
  'Michelle White',
];

async function seedDatabase() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/servicehub');
    console.log('Connected to MongoDB');

    // Create provider users
    const providers = await Promise.all(
      providerNames.map(async (name) => {
        const email = `${name.toLowerCase().replace(' ', '.')}@example.com`;
        const hashedPassword = await bcrypt.hash('password123', 10);
        
        const user = await User.create({
          name,
          email,
          password: hashedPassword,
          role: 'provider',
          location: locations[Math.floor(Math.random() * locations.length)],
        });
        
        return user;
      })
    );

    // Create services
    const services = await Promise.all(
      Array.from({ length: 50 }, async () => {
        const provider = providers[Math.floor(Math.random() * providers.length)];
        const category = serviceCategories[Math.floor(Math.random() * serviceCategories.length)];
        const description = serviceDescriptions[Math.floor(Math.random() * serviceDescriptions.length)];
        const price = Math.floor(Math.random() * 500) + 50;
        const rating = (Math.random() * 2 + 3).toFixed(1); // Random rating between 3.0 and 5.0
        const reviews = Math.floor(Math.random() * 100);

        return Service.create({
          name: `${category} Service`,
          description,
          price,
          category,
          provider: provider._id,
          rating: parseFloat(rating),
          reviews,
          image: `https://source.unsplash.com/random/400x300/?${category.toLowerCase()}`,
        });
      })
    );

    console.log(`Created ${providers.length} providers and ${services.length} services`);
    process.exit(0);
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
}

seedDatabase(); 