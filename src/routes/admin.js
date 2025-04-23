import express from 'express';
import mongoose from 'mongoose';
import { authenticateToken, isAdmin } from '../middleware/auth.js';
import Booking from '../models/Booking.js';
import Agent from '../models/Agent.js';
import { sendBookingConfirmationEmail } from '../utils/email.js';
import User from '../models/User.js';

const router = express.Router();

// Middleware to check if user is admin
router.use(authenticateToken, isAdmin);

// Get all pending bookings
router.get('/pending-bookings', async (req, res) => {
  try {
    const bookings = await Booking.find({ status: 'pending' })
      .populate('userId', 'name email phone')
      .populate('paymentId', 'status amount paymentMethod transactionId')
      .sort({ bookingDate: -1 })
      .lean();  // Convert to plain JavaScript objects

    // Process bookings to ensure valid data
    const processedBookings = bookings.map(booking => {
      // Ensure totalAmount is a number
      if (typeof booking.totalAmount !== 'number') {
        booking.totalAmount = 0;
      }

      // Check for missing user data
      if (!booking.userId) {
        console.warn(`Warning: Missing user data for booking ${booking._id}`);
      }

      return booking;
    });

    res.json({
      success: true,
      data: processedBookings
    });
  } catch (error) {
    console.error('Error fetching pending bookings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch pending bookings'
    });
  }
});

// Get all available agents
router.get('/available-agents', async (req, res) => {
  try {
    const { serviceId } = req.query;
    
    // Build query
    const query = { availability: true };
    if (serviceId) {
      query.services = serviceId;
    }
    
    const agents = await Agent.find(query)
      .select('name email phone services rating totalBookings completedBookings')
      .sort({ rating: -1, completedBookings: -1 })
      .lean();  // Convert to plain JavaScript objects

    // Process agents to ensure valid data
    const processedAgents = agents.map(agent => {
      // Ensure rating is a number
      if (typeof agent.rating !== 'number') {
        agent.rating = 0;
      }
      
      // Ensure booking counts are numbers
      if (typeof agent.totalBookings !== 'number') {
        agent.totalBookings = 0;
      }
      if (typeof agent.completedBookings !== 'number') {
        agent.completedBookings = 0;
      }

      return agent;
    });

    res.json({
      success: true,
      data: processedAgents
    });
  } catch (error) {
    console.error('Error fetching available agents:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch available agents'
    });
  }
});

// Confirm booking and assign agent
router.post('/confirm-booking/:bookingId', async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { agentId } = req.body;

    // Validate booking ID
    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid booking ID format'
      });
    }

    // Validate agent ID
    if (!mongoose.Types.ObjectId.isValid(agentId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid agent ID format'
      });
    }

    // Find booking
    const booking = await Booking.findById(bookingId)
      .populate('userId', 'name email phone');

    if (!booking) {
      return res.status(404).json({
        success: false,
        error: 'Booking not found'
      });
    }

    // Check if booking is pending
    if (booking.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: 'Only pending bookings can be confirmed'
      });
    }

    // Find agent
    const agent = await Agent.findById(agentId);

    if (!agent) {
      return res.status(404).json({
        success: false,
        error: 'Agent not found'
      });
    }

    // Check if agent is available
    if (!agent.availability) {
      return res.status(400).json({
        success: false,
        error: 'Agent is not available'
      });
    }

    // Update booking with agent information
    booking.status = 'confirmed';
    booking.agent = {
      id: agent._id,
      name: agent.name,
      phone: agent.phone,
      email: agent.email,
      assignedDate: new Date()
    };
    await booking.save();

    // Update agent stats
    agent.totalBookings += 1;
    await agent.save();

    // Send confirmation email to customer
    try {
      await sendBookingConfirmationEmail(
        booking.userId.email,
        booking.userId.name,
        booking._id,
        booking.services,
        booking.totalAmount,
        booking.scheduledDate,
        agent.name,
        agent.phone,
        agent.email
      );
    } catch (emailError) {
      console.error('Error sending confirmation email:', emailError);
      // Continue with the response even if email fails
    }

    res.json({
      success: true,
      data: {
        message: 'Booking confirmed and agent assigned successfully',
        booking
      }
    });
  } catch (error) {
    console.error('Error confirming booking:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to confirm booking'
    });
  }
});

// Get booking details
router.get('/booking/:bookingId', isAdmin, async (req, res) => {
  try {
    const { bookingId } = req.params;

    const booking = await Booking.findById(bookingId)
      .populate('userId', 'name email phone')
      .populate('agentId', 'name email phone rating')
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
    console.error('Error fetching booking details:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch booking details'
    });
  }
});

// Cancel booking
router.post('/booking/:bookingId/cancel', isAdmin, async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { reason } = req.body;

    const booking = await Booking.findById(bookingId)
      .populate('userId', 'name email phone')
      .populate('agentId', 'name email phone')
      .populate('paymentId', 'status amount paymentMethod transactionId');

    if (!booking) {
      return res.status(404).json({
        success: false,
        error: 'Booking not found'
      });
    }

    if (booking.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        error: 'Booking is already cancelled'
      });
    }

    if (booking.status === 'completed') {
      return res.status(400).json({
        success: false,
        error: 'Cannot cancel a completed booking'
      });
    }

    // Update booking status
    booking.status = 'cancelled';
    booking.cancellationReason = reason;
    booking.cancelledAt = new Date();
    await booking.save();

    // If there's an assigned agent, update their booking counts
    if (booking.agentId) {
      const agent = await User.findById(booking.agentId);
      if (agent) {
        agent.totalBookings = Math.max(0, (agent.totalBookings || 0) - 1);
        await agent.save();
      }
    }

    res.json({
      success: true,
      message: 'Booking cancelled successfully',
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

// Get all bookings with filters
router.get('/bookings', async (req, res) => {
  try {
    const { 
      status, 
      page = 1, 
      limit = 10,
      search,
      startDate,
      endDate
    } = req.query;

    // Build query
    const query = {};
    
    // Filter by status
    if (status && status !== 'all') {
      query.status = status;
    }

    // Filter by date range
    if (startDate && endDate) {
      query.bookingDate = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    // Search in user details
    if (search) {
      query.$or = [
        { 'userId.name': { $regex: search, $options: 'i' } },
        { 'userId.email': { $regex: search, $options: 'i' } },
        { 'userId.phone': { $regex: search, $options: 'i' } }
      ];
    }

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Get total count for pagination
    const total = await Booking.countDocuments(query);

    // Find bookings with populated data
    const bookings = await Booking.find(query)
      .populate('userId', 'name email phone')
      .populate('agentId', 'name email phone rating')
      .populate('paymentId', 'status amount paymentMethod transactionId')
      .sort({ bookingDate: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Process bookings to ensure valid data
    const processedBookings = bookings.map(booking => {
      // Ensure totalAmount is a number
      if (typeof booking.totalAmount !== 'number') {
        booking.totalAmount = 0;
      }

      // Check for missing user data
      if (!booking.userId) {
        console.warn(`Warning: Missing user data for booking ${booking._id}`);
      }

      return booking;
    });

    res.json({
      success: true,
      data: {
        bookings: processedBookings,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Error fetching bookings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch bookings'
    });
  }
});

export default router; 