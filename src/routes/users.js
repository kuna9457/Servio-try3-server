import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { authenticateToken } from '../middleware/auth.js';
import { sendVerificationEmail } from '../utils/email.js';

const router = express.Router();

// Update user profile
router.put('/profile', authenticateToken, async (req, res) => {
  console.log('Profile update request received:', req.body);
  console.log('User from token:', req.user);
  
  try {
    const { name, phone } = req.body;
    const userId = req.user.userId;

    console.log('Looking for user with ID:', userId);
    const user = await User.findById(userId);
    
    if (!user) {
      console.log('User not found with ID:', userId);
      return res.status(404).json({ message: 'User not found' });
    }

    console.log('Found user:', user);
    // Update only allowed fields
    user.name = name;
    user.phone = phone;

    await user.save();
    console.log('User updated successfully');
    res.status(200).json({ message: 'Profile updated successfully', user });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ message: 'Failed to update profile' });
  }
});

// Initiate password change process
router.post('/initiate-password-change', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    console.log('Looking for user with ID:', userId);
    
    const user = await User.findById(userId);
    if (!user) {
      console.log('User not found with ID:', userId);
      return res.status(404).json({ message: 'User not found' });
    }

    console.log('Found user:', user);
    // Generate verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    user.verificationCode = verificationCode;
    user.verificationCodeExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    await user.save();

    try {
      // Send verification email
      await sendVerificationEmail(user.email, verificationCode);
      res.status(200).json({ message: 'Verification code sent successfully' });
    } catch (emailError) {
      console.error('Email sending error:', emailError);
      // Clear the verification code if email fails
      user.verificationCode = undefined;
      user.verificationCodeExpires = undefined;
      await user.save();
      
      if (emailError.message.includes('not configured')) {
        return res.status(503).json({ 
          message: 'Email service is not configured. Please contact support.' 
        });
      } else if (emailError.message.includes('authentication failed')) {
        return res.status(503).json({ 
          message: 'Email service authentication failed. Please contact support.' 
        });
      } else if (emailError.message.includes('connect to email server')) {
        return res.status(503).json({ 
          message: 'Unable to connect to email server. Please try again later.' 
        });
      }
      return res.status(503).json({ 
        message: 'Failed to send verification email. Please try again later.' 
      });
    }
  } catch (error) {
    console.error('Password change initiation error:', error);
    res.status(500).json({ message: 'Failed to initiate password change' });
  }
});

// Verify code for password change
router.post('/verify-code', authenticateToken, async (req, res) => {
  try {
    const { code } = req.body;
    const userId = req.user.id;

    const user = await User.findById(userId);
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

    // Clear verification code after successful verification
    user.verificationCode = undefined;
    user.verificationCodeExpires = undefined;
    await user.save();

    res.status(200).json({ message: 'Code verified successfully' });
  } catch (error) {
    console.error('Code verification error:', error);
    res.status(500).json({ message: 'Failed to verify code' });
  }
});

// Change password
router.post('/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, user.password);
    if (!isValidPassword) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    // Hash and update new password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    res.status(200).json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Password change error:', error);
    res.status(500).json({ message: 'Failed to change password' });
  }
});

export default router; 