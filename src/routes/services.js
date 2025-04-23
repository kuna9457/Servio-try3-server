import express from 'express';
import Service from '../models/Service.js';
import Booking from '../models/Booking.js';
import User from '../models/User.js';
import bcrypt from 'bcryptjs';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Sample data constants
const serviceCategories = [
  'Cleaning', 'Plumbing', 'Electrical', 'Carpentry', 'Painting',
  'Landscaping', 'Moving', 'Appliance Repair', 'HVAC', 'Pest Control'
];

const locations = [
  'New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix',
  'Philadelphia', 'San Antonio', 'San Diego', 'Dallas', 'San Jose'
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

// Helper functions
const generateRandomPrice = () => Math.floor(Math.random() * (300 - 50 + 1)) + 50;
const generateRandomRating = () => (Math.random() * (5 - 3.5) + 3.5).toFixed(1);
const generateRandomReviews = () => Math.floor(Math.random() * (200 - 10 + 1)) + 10;
const generateRandomPopularity = () => Math.floor(Math.random() * 100);

// Route to generate sample data
router.post('/generate-sample-data', async (req, res) => {
  try {
    // Create a provider user
    const password = await bcrypt.hash('provider123', 10);
    const provider = await User.create({
      name: 'Sample Provider',
      email: 'sample.provider@servicehub.com',
      password: password,
      role: 'provider',
      location: 'New York'
    });

    // Create 10 sample services
    const sampleServices = [];
    for (let i = 0; i < 10; i++) {
      const category = serviceCategories[Math.floor(Math.random() * serviceCategories.length)];
      const service = await Service.create({
        title: `${category} Service ${i + 1}`,
        description: `Professional ${category.toLowerCase()} service with experienced staff.`,
        category: category,
        price: generateRandomPrice(),
        image: serviceImages[category],
        provider: provider._id,
        rating: generateRandomRating(),
        reviews: generateRandomReviews(),
        location: locations[Math.floor(Math.random() * locations.length)],
        popularity: generateRandomPopularity(),
        availability: Math.random() > 0.1
      });
      sampleServices.push(service);
    }

    res.status(201).json({
      message: 'Sample data generated successfully',
      provider: provider,
      services: sampleServices
    });
  } catch (error) {
    console.error('Error generating sample data:', error);
    res.status(500).json({ message: 'Error generating sample data' });
  }
});

// Get all services
router.get('/', async (req, res) => {
  try {
    const services = await Service.find().populate('provider', 'name avatar location');
    res.json(services);
  } catch (error) {
    console.error('Error fetching services:', error);
    res.status(500).json({ message: 'Error fetching services' });
  }
});

// Get service by ID
router.get('/:id', async (req, res) => {
  try {
    const service = await Service.findById(req.params.id).populate('provider', 'name avatar location');
    if (!service) {
      return res.status(404).json({ message: 'Service not found' });
    }
    res.json(service);
  } catch (error) {
    console.error('Error fetching service:', error);
    res.status(500).json({ message: 'Error fetching service' });
  }
});

// Create service
router.post('/', async (req, res) => {
  try {
    const service = new Service(req.body);
    await service.save();
    res.status(201).json(service);
  } catch (error) {
    console.error('Error creating service:', error);
    res.status(500).json({ message: 'Error creating service' });
  }
});

// Update service
router.put('/:id', async (req, res) => {
  try {
    const service = await Service.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    if (!service) {
      return res.status(404).json({ message: 'Service not found' });
    }
    res.json(service);
  } catch (error) {
    console.error('Error updating service:', error);
    res.status(500).json({ message: 'Error updating service' });
  }
});

// Delete service
router.delete('/:id', async (req, res) => {
  try {
    const service = await Service.findByIdAndDelete(req.params.id);
    if (!service) {
      return res.status(404).json({ message: 'Service not found' });
    }
    res.json({ message: 'Service deleted successfully' });
  } catch (error) {
    console.error('Error deleting service:', error);
    res.status(500).json({ message: 'Error deleting service' });
  }
});

// Create service (protected route)
router.post('/', authenticateToken, async (req, res) => {
  try {
    const service = new Service({
      ...req.body,
      provider: req.user.userId,
    });

    await service.save();
    res.status(201).json(service);
  } catch (error) {
    console.error('Error creating service:', error);
    res.status(500).json({ message: 'Error creating service' });
  }
});

// Book a service
router.post('/:id/book', authenticateToken, async (req, res) => {
  try {
    const service = await Service.findById(req.params.id);
    if (!service) {
      return res.status(404).json({ message: 'Service not found' });
    }

    const booking = new Booking({
      user: req.user.userId,
      service: service._id,
      provider: service.provider,
      scheduledDate: req.body.scheduledDate,
      totalAmount: service.price,
      address: req.body.address,
      notes: req.body.notes,
    });

    await booking.save();

    // TODO: Send notifications to user and provider
    // This would be implemented using a notification service

    res.status(201).json(booking);
  } catch (error) {
    console.error('Error booking service:', error);
    res.status(500).json({ message: 'Error booking service' });
  }
});

// Get user's bookings
router.get('/bookings/user', authenticateToken, async (req, res) => {
  try {
    const bookings = await Booking.find({ user: req.user.userId })
      .populate('service')
      .populate('provider', 'name email');

    res.json(bookings);
  } catch (error) {
    console.error('Error fetching user bookings:', error);
    res.status(500).json({ message: 'Error fetching bookings' });
  }
});

// Get provider's bookings
router.get('/bookings/provider', authenticateToken, async (req, res) => {
  try {
    const bookings = await Booking.find({ provider: req.user.userId })
      .populate('service')
      .populate('user', 'name email');

    res.json(bookings);
  } catch (error) {
    console.error('Error fetching provider bookings:', error);
    res.status(500).json({ message: 'Error fetching bookings' });
  }
});

export default router; 