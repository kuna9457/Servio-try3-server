import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { OAuth2Client } from 'google-auth-library';
import { sendVerificationEmail } from '../utils/email.js';

const router = express.Router();
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role, location, phone } = req.body;
    console.log('=== Registration Details ===');
    console.log('Email:', email);
    console.log('Password:', password);

    // Validate required fields
    if (!name || !email || !password || !phone) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    // Check if user exists
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Hash password with bcrypt
    // console.log('=== Registration Password Hashing ===');
    // console.log('Password to hash:', password);
    // const salt = await bcrypt.genSalt(10);
    // console.log('Generated Salt:', salt);
    // const hashedPassword = await bcrypt.hash(password, salt);
    // console.log('Hashed Password:', hashedPassword);

    // Create user
    user = new User({
      name,
      email,
      password,
      role,
      location,
      phone,
    });

    await user.save();
    // console.log('User saved with hashed password');

    // Create token
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    res.status(201).json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        location: user.location,
        phone: user.phone,
      },
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Don't log passwords, only email for debugging
    console.log('Login attempt for email:', email);

    // Look up the user in the database
    const user = await User.findOne({ email });
    
    if (!user) {
      return res.status(401).json({ 
        success: false,
        message: 'Invalid credentials' 
      });
    }

    // Compare password using bcrypt
    // console.log('Comparing password:', password);
    // console.log('Stored password:', user.password);
    const isPasswordValid = await bcrypt.compare(password, user.password);
    
    if (!isPasswordValid) {
      console.log('Login failed: Invalid password for user:', email);
      return res.status(401).json({ 
        success: false,
        message: 'Invalid credentials' 
      });
    }

    // Handle admin user
    if (user.role === 'admin') {
      const token = jwt.sign(
        { 
          userId: user._id,
          role: 'admin',
          isSystemAdmin: true
        },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      return res.json({
        success: true,
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          phone: user.phone || 'N/A',
          location: user.location || 'ServiceHub HQ'
        }
      });
    }

    // Create token for regular user
    const token = jwt.sign(
      { 
        userId: user._id,
        role: user.role
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Send successful response
    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        location: user.location
      }
    });

  } catch (error) {
    console.error('Login error:', error.message);
    res.status(500).json({ 
      success: false,
      message: 'An error occurred during login' 
    });
  }
});

// Google authentication route
router.post('/google', async (req, res) => {
  try {
    const { credential } = req.body;

    if (!credential) {
      return res.status(400).json({ message: 'No credential provided' });
    }

    // Verify Google token
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload) {
      return res.status(400).json({ message: 'Invalid token' });
    }

    // Check if user exists
    let user = await User.findOne({ email: payload.email });
    if (!user) {
      // Create new user
      user = new User({
        name: payload.name,
        email: payload.email,
        password: await bcrypt.hash(Math.random().toString(36), 10), // Random password
        role: 'user', // Default role
        avatar: payload.picture,
      });
      await user.save();
    }

    // Create token
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Set CORS headers
    res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    res.json({
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
      },
      token,
    });
  } catch (error) {
    console.error('Google auth error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Forgot password
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email is required' 
      });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    // Generate verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    user.verificationCode = verificationCode;
    user.verificationCodeExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    await user.save();

    try {
      // Send verification email
      const emailResult = await sendVerificationEmail(user.email, verificationCode);
      console.log('Email sent successfully:', emailResult);
      
      res.status(200).json({ 
        success: true, 
        message: 'Verification code sent successfully' 
      });
    } catch (emailError) {
      console.error('Email sending error:', emailError);
      
      // Clear the verification code if email fails
      user.verificationCode = undefined;
      user.verificationCodeExpires = undefined;
      await user.save();
      
      if (emailError.message.includes('not configured')) {
        return res.status(503).json({ 
          success: false, 
          message: 'Email service is not configured. Please contact support.' 
        });
      } else if (emailError.message.includes('authentication failed')) {
        return res.status(503).json({ 
          success: false, 
          message: 'Email service authentication failed. Please contact support.' 
        });
      } else if (emailError.message.includes('connect to email server')) {
        return res.status(503).json({ 
          success: false, 
          message: 'Unable to connect to email server. Please try again later.' 
        });
      }
      
      return res.status(503).json({ 
        success: false, 
        message: 'Failed to send verification email. Please try again later.' 
      });
    }
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to process forgot password request',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Verify reset code
router.post('/verify-reset-code', async (req, res) => {
  try {
    const { email, code } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!user.verificationCode || !user.verificationCodeExpires) {
      return res.status(400).json({ message: 'No verification code found' });
    }

    if (user.verificationCodeExpires < new Date()) {
      return res.status(400).json({ message: 'Verification code has expired' });
    }

    if (user.verificationCode !== code) {
      return res.status(400).json({ message: 'Invalid verification code' });
    }

    res.status(200).json({ message: 'Code verified successfully' });
  } catch (error) {
    console.error('Code verification error:', error);
    res.status(500).json({ message: 'Failed to verify code' });
  }
});

// Reset password
router.post('/reset-password', async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;
    console.log('Reset password request received:', { email, code });

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!user.verificationCode || !user.verificationCodeExpires) {
      return res.status(400).json({ message: 'No verification code found' });
    }

    if (user.verificationCodeExpires < new Date()) {
      return res.status(400).json({ message: 'Verification code has expired' });
    }

    if (user.verificationCode !== code) {
      return res.status(400).json({ message: 'Invalid verification code' });
    }

    // Hash and update new password
    console.log('=== Password Reset Hashing ===');
    console.log('New Password:', newPassword);
    const salt = await bcrypt.genSalt(10);
    console.log('Generated Salt:', salt);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    console.log('Hashed Password:', hashedPassword);
    
    // Update password and clear verification code
    user.password = hashedPassword;
    user.verificationCode = undefined;
    user.verificationCodeExpires = undefined;
    
    await user.save();
    console.log('Password updated successfully for user:', email);

    // Create new token for immediate login
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    res.status(200).json({ 
      message: 'Password reset successfully',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        location: user.location,
      }
    });
  } catch (error) {
    console.error('Password reset error:', error);
    res.status(500).json({ message: 'Failed to reset password' });
  }
});

// Register professional
router.post('/register-professional', async (req, res) => {
  try {
    const { 
      name, 
      email, 
      password, 
      phone, 
      location, 
      serviceCategories, 
      experience, 
      description, 
      availability, 
      hourlyRate 
    } = req.body;
    
    console.log('=== Professional Registration Details ===');
    console.log('Email:', email);
    console.log('Service Categories:', serviceCategories);

    // Validate required fields
    if (!name || !email || !password || !phone || !location || !serviceCategories || !experience || !description || !availability || !hourlyRate) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    // Check if user exists
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Hash password with bcrypt
    console.log('=== Professional Registration Password Hashing ===');
    console.log('Password to hash:', password);
    const salt = await bcrypt.genSalt(10);
    console.log('Generated Salt:', salt);
    const hashedPassword = await bcrypt.hash(password, salt);
    console.log('Hashed Password:', hashedPassword);

    // Create user with provider role
    user = new User({
      name,
      email,
      password: hashedPassword,
      role: 'provider',
      phone,
      location,
      serviceCategories,
      experience,
      description,
      availability,
      hourlyRate,
      isVerified: false, // Professionals need verification
    });

    await user.save();
    console.log('Professional user saved with hashed password');

    // Create token
    const token = jwt.sign(
      { userId: user._id, role: 'provider' },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    res.status(201).json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        location: user.location,
        phone: user.phone,
        serviceCategories: user.serviceCategories,
        experience: user.experience,
        description: user.description,
        availability: user.availability,
        hourlyRate: user.hourlyRate,
        isVerified: user.isVerified,
      },
    });
  } catch (error) {
    console.error('Professional registration error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router; 