import express from 'express';
import mongoose from 'mongoose';
import Booking from '../models/Booking.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Get user's bookings
router.get('/my-bookings', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { status } = req.query;

    // Build query
    const query = { userId };
    if (status && status !== 'all') {
      query.status = status;
    }

    // Find bookings
    const bookings = await Booking.find(query)
      .sort({ bookingDate: -1 })
      .populate('paymentId', 'status amount paymentMethod transactionId');

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

// Get booking by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Validate ID format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid booking ID format'
      });
    }

    // Find booking
    const booking = await Booking.findOne({ _id: id, userId })
      .populate('paymentId', 'status amount paymentMethod transactionId');

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
    console.error('Error fetching booking:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch booking'
    });
  }
});

// Cancel booking
router.post('/:id/cancel', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Validate ID format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid booking ID format'
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

    // Check if booking can be cancelled
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
      data: {
        message: 'Booking cancelled successfully',
        booking
      }
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
    console.log(scheduledDate, id, userId);
    
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
    console.log(booking);

    if (!booking) {
      return res.status(404).json({
        success: false,
        error: 'Booking not found'
      });
    } 
    console.log(booking.scheduledDate);

    // Check if booking can be rescheduled
    // if (booking.status !== 'pending' && booking.status !== 'confirmed') {
    //   return res.status(400).json({
    //     success: false,
    //     error: 'Only pending or confirmed bookings can be rescheduled'
    //   });
    // }

    // Check if new date is in the future
    if (newScheduledDate <= new Date()) {
      return res.status(400).json({
        success: false,
        error: 'New scheduled date must be in the future'
      });
    }
    
    // Update booking scheduled date
    booking.scheduledDate = newScheduledDate;
    console.log(booking.scheduledDate);
    await booking.save();
    console.log("success");
    console.log(booking);
    

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