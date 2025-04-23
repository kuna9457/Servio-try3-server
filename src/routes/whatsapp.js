import express from 'express';
import axios from 'axios';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// WhatsApp Business API configuration
const WHATSAPP_API_URL = process.env.WHATSAPP_API_URL;
const WHATSAPP_API_TOKEN = process.env.WHATSAPP_API_TOKEN;
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;

// Send WhatsApp message
router.post('/send', authenticateToken, async (req, res) => {
  console.log('WhatsApp send request received:', {
    body: req.body,
    headers: req.headers,
    user: req.user
  });

  try {
    const { to, message } = req.body;
    
    

    if (!to || !message) {
      console.log('Missing required fields:', { to, message });
      return res.status(400).json({
        success: false,
        error: 'Phone number and message are required'
      });
    }

    // Format phone number (remove any non-digit characters)
    const formattedPhone = to.replace(/\D/g, '');
    console.log('Formatted phone number:', formattedPhone);

    console.log('Sending WhatsApp message with config:', {
      apiUrl: WHATSAPP_API_URL,
      phoneNumberId: WHATSAPP_PHONE_NUMBER_ID,
      message: message
    });

    // Send message using WhatsApp Business API
    const response = await axios.post(
      `${WHATSAPP_API_URL}/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: 'whatsapp',
        to: formattedPhone,
        type: 'text',
        text: { body: message }
      },
      {
        headers: {
          'Authorization': `Bearer ${WHATSAPP_API_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('WhatsApp API response:', response.data);

    res.json({
      success: true,
      data: response.data
    });
  } catch (error) {
    console.error('Error sending WhatsApp message:', {
      error: error.message,
      response: error.response?.data,
      status: error.response?.status,
      stack: error.stack
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to send WhatsApp message',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

export default router; 