import express from 'express';
import Professional from '../models/Professional.js';
import { sendEmail } from '../utils/email.js';

const router = express.Router();

// Register a new professional
router.post('/register', async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      serviceCategories,
      description,
      location,
      availability,
      perPersonRate
    } = req.body;

    // Validate required fields
    if (!name || !email || !phone || !serviceCategories || !description || !location || !availability || !perPersonRate) {
      return res.status(400).json({ 
        message: 'All fields are required',
        missingFields: {
          name: !name,
          email: !email,
          phone: !phone,
          serviceCategories: !serviceCategories,
          description: !description,
          location: !location,
          availability: !availability,
          perPersonRate: !perPersonRate
        }
      });
    }

    // Check if professional already exists
    const existingProfessional = await Professional.findOne({ email });
    if (existingProfessional) {
      return res.status(400).json({ message: 'Professional already exists' });
    }

    // Create new professional
    const professional = new Professional({
      name,
      email,
      phone,
      serviceCategories,
      description,
      location,
      availability,
      perPersonRate
    });

    await professional.save();

    // Send confirmation email to professional
    const professionalEmailContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #003B95;">Welcome to Servio!</h1>
        <p>Dear ${name},</p>
        <p>Thank you for registering as a professional on our platform. Your application is under review.</p>
        <p>We will notify you once your account is approved.</p>
        <p>Best regards,<br>The Servio Team</p>
      </div>
    `;

    await sendEmail(email, 'Registration Confirmation - Servio', professionalEmailContent);

    // Send notification email to company
    const companyEmailContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #003B95;">New Professional Registration</h1>
        <p>A new professional has registered on Servio:</p>
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Name:</strong> ${name}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Phone:</strong> ${phone}</p>
          <p><strong>Services:</strong> ${serviceCategories.join(', ')}</p>
          <p><strong>Location:</strong> ${location}</p>
          <p><strong>Per Person Rate:</strong> ₹${perPersonRate}</p>
          <p><strong>Availability:</strong> ${availability}</p>
          <p><strong>Description:</strong> ${description}</p>
        </div>
        <p>Please review their application in the admin dashboard.</p>
      </div>
    `;

    await sendEmail(process.env.BUSINESS_EMAIL, 'New Professional Registration - Servio', companyEmailContent);

    res.status(201).json({
      success: true,
      message: 'Professional registered successfully',
      professional: {
        id: professional._id,
        name: professional.name,
        email: professional.email
      }
    });
  } catch (error) {
    console.error('Professional registration error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'An error occurred while processing your request'
    });
  }
});

// Get all professionals (admin route)
router.get('/', async (req, res) => {
  try {
    const professionals = await Professional.find();
    res.json({
      success: true,
      data: professionals
    });
  } catch (error) {
    console.error('Error fetching professionals:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'An error occurred while fetching professionals'
    });
  }
});

// Update professional status (admin route)
router.put('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    
    if (!['pending', 'approved', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status value'
      });
    }

    const professional = await Professional.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );

    if (!professional) {
      return res.status(404).json({
        success: false,
        message: 'Professional not found'
      });
    }

    // Send status update email to professional
    const emailContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #003B95;">Application Status Update</h1>
        <p>Dear ${professional.name},</p>
        <p>Your application status has been updated to: <strong>${status}</strong></p>
        ${status === 'approved' ? '<p>You can now log in to your account and start offering your services.</p>' : ''}
        <p>Best regards,<br>The Servio Team</p>
      </div>
    `;

    await sendEmail(professional.email, 'Application Status Update - Servio', emailContent);

    res.json({
      success: true,
      data: professional
    });
  } catch (error) {
    console.error('Error updating professional status:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'An error occurred while updating the status'
    });
  }
});

export default router; 