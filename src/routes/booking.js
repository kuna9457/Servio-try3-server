import express from 'express';
import mongoose from 'mongoose';
import { authenticateToken } from '../middleware/auth.js';
import Booking from '../models/Booking.js';
import Payment from '../models/Payment.js';

const router = express.Router();

// Create a new booking
router.post('/create', authenticateToken, async (req, res) => {
  try {
    const { services, scheduledDate, notes, paymentId } = req.body;
    const userId = req.user.id;

    // Validate required fields
    if (!services || !Array.isArray(services) || services.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Services are required'
      });
    }

    if (!scheduledDate) {
      return res.status(400).json({
        success: false,
        error: 'Scheduled date is required'
      });
    }

    if (!paymentId) {
      return res.status(400).json({
        success: false,
        error: 'Payment ID is required'
      });
    }

    // Calculate total amount
    const totalAmount = services.reduce((total, service) => {
      return total + (service.price * service.quantity);
    }, 0);

    // Create booking
    const booking = new Booking({
      userId: new mongoose.Types.ObjectId(userId),
      services,
      totalAmount,
      paymentId: new mongoose.Types.ObjectId(paymentId),
      scheduledDate: new Date(scheduledDate),
      notes
    });

    await booking.save();

    // Update payment status to link with booking
    await Payment.findByIdAndUpdate(paymentId, {
      $set: { bookingId: booking._id }
    });

    res.status(201).json({
      success: true,
      data: booking
    });
  } catch (error) {
    console.error('Error creating booking:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create booking'
    });
  }
});

// Get user's bookings
router.get('/my-bookings', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { status } = req.query;

    // Build query
    const query = { userId: new mongoose.Types.ObjectId(userId) };
    
    // Filter by status if provided
    if (status && ['pending', 'confirmed', 'completed', 'cancelled'].includes(status)) {
      query.status = status;
    }

    // Get bookings with payment details
    const bookings = await Booking.find(query)
      .populate('paymentId', 'status amount paymentMethod')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: bookings
    });
  } catch (error) {
    console.error('Error fetching bookings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch bookings'
    });
  }
});

// Get booking details
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const booking = await Booking.findOne({
      _id: new mongoose.Types.ObjectId(id),
      userId: new mongoose.Types.ObjectId(userId)
    }).populate('paymentId', 'status amount paymentMethod');

    if (!booking) {
      return res.status(404).json({
        success: false,
        error: 'Booking not found'
      });
    }

    res.json({
      success: true,
      data: booking
    });
  } catch (error) {
    console.error('Error fetching booking details:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch booking details'
    });
  }
});

// Cancel booking
router.post('/:id/cancel', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const booking = await Booking.findOne({
      _id: new mongoose.Types.ObjectId(id),
      userId: new mongoose.Types.ObjectId(userId)
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        error: 'Booking not found'
      });
    }

    // Only allow cancellation of pending or confirmed bookings
    if (booking.status !== 'pending' && booking.status !== 'confirmed') {
      return res.status(400).json({
        success: false,
        error: 'Only pending or confirmed bookings can be cancelled'
      });
    }

    // Update booking status
    booking.status = 'cancelled';
    await booking.save();

    res.json({
      success: true,
      data: booking
    });
  } catch (error) {
    console.error('Error cancelling booking:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cancel booking'
    });
  }
});

// Reschedule booking
router.post('/:id/reschedule', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { scheduledDate } = req.body;
    const userId = req.user.id;

    // Validate ID format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid booking ID format'
      });
    }

    // Validate scheduled date
    if (!scheduledDate) {
      return res.status(400).json({
        success: false,
        error: 'Scheduled date is required'
      });
    }

    const newScheduledDate = new Date(scheduledDate);
    if (isNaN(newScheduledDate.getTime())) {
      return res.status(400).json({
        success: false,
        error: 'Invalid date format'
      });
    }

    // Find booking
    const booking = await Booking.findOne({ _id: id, userId });

    if (!booking) {
      return res.status(404).json({
        success: false,
        error: 'Booking not found'
      });
    }

    // Check if booking can be rescheduled
    if (booking.status !== 'pending' && booking.status !== 'confirmed') {
      return res.status(400).json({
        success: false,
        error: 'Only pending or confirmed bookings can be rescheduled'
      });
    }

    // Check if new date is in the future
    if (newScheduledDate <= new Date()) {
      return res.status(400).json({
        success: false,
        error: 'New scheduled date must be in the future'
      });
    }

    // Update booking scheduled date
    booking.scheduledDate = newScheduledDate;
    await booking.save();

    res.json({
      success: true,
      data: booking
    });
  } catch (error) {
    console.error('Error rescheduling booking:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reschedule booking'
    });
  }
});

export default router; 