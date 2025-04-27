import express from 'express';
import crypto from 'crypto';
import QRCode from 'qrcode';
import mongoose from 'mongoose';
import { Card, Wallet, RewardPoints, Payment } from '../models/Payment.js';
import Booking from '../models/Booking.js';
import { authenticateToken } from '../middleware/auth.js';
import { sendPaymentConfirmationEmails } from '../utils/email.js';

const router = express.Router();

// PhonePe configuration
const phonepeConfig = {
  merchantId: process.env.PHONEPE_MERCHANT_ID,
  saltKey: process.env.PHONEPE_SALT_KEY,
  saltIndex: process.env.PHONEPE_SALT_INDEX || 1,
  baseUrl: process.env.PHONEPE_BASE_URL || 'https://api-preprod.phonepe.com/apis/pg-sandbox'
};

// Generate checksum for PhonePe requests
const generateChecksum = (payload) => {
  const payloadString = JSON.stringify(payload);
  const base64Payload = Buffer.from(payloadString).toString('base64');
  const checksum = crypto
    .createHmac('sha256', phonepeConfig.saltKey)
    .update(base64Payload)
    .digest('hex');
  return `${checksum}###${phonepeConfig.saltIndex}`;
};

// Create QR code payment order
router.post('/create-qr-payment', authenticateToken, async (req, res) => {
  try {
    const { amount, currency = 'INR' } = req.body;
    const userIdString = req.user.id || req.user.userId; // Try both id and userId fields
    
    // Convert string ID to ObjectId
    const userId = new mongoose.Types.ObjectId(userIdString);

    // Validate amount
    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid amount'
      });
    }

    // Generate unique transaction ID
    const transactionId = `TXN_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    // Create payment record
    const payment = new Payment({
      userId,
      orderId: transactionId,
      amount,
      currency,
      paymentMethod: 'qr',
      status: 'pending'
    });

    await payment.save();

    // Generate UPI payment link and QR code
    const upiId = process.env.UPI_ID;
    const businessName = process.env.BUSINESS_NAME || 'ServiceHub';
    
    if (!upiId) {
      throw new Error('UPI ID not configured. Please set UPI_ID in environment variables.');
    }

    console.log('Generating QR code with UPI ID:', upiId);
    console.log('Business name:', businessName);
    console.log('Amount:', amount);
    console.log('Transaction ID:', transactionId);

    const upiLink = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(businessName)}&am=${amount}&cu=INR&tn=${transactionId}`;
    console.log('UPI Link:', upiLink);

    try {
      // Check if QRCode is properly imported
      if (!QRCode || typeof QRCode.toDataURL !== 'function') {
        console.error('QRCode library not properly imported or toDataURL method not available');
        throw new Error('QRCode library not properly imported');
      }

      const qrCode = await QRCode.toDataURL(upiLink);
      console.log('QR Code generated successfully');

      res.json({
        success: true,
        data: {
          transactionId,
          amount,
          currency,
          paymentMethod: 'qr',
          qrCode,
          upiLink
        }
      });
    } catch (qrError) {
      console.error('Error generating QR code:', qrError);
      throw new Error('Failed to generate QR code: ' + qrError.message);
    }
  } catch (error) {
    console.error('Error creating QR payment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create QR payment: ' + error.message
    });
  }
});

// Create payment order
router.post('/create-order', authenticateToken, async (req, res) => {
  try {
    const { amount, currency = 'INR', paymentMethod, dueDate } = req.body;
    const userIdString = req.user.id || req.user.userId;
    const userId = new mongoose.Types.ObjectId(userIdString);

    // Validate amount
    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid amount'
      });
    }

    // Validate due date for pay later
    // if (paymentMethod === 'pay_later') {
    //   if (!dueDate) {
    //     return res.status(400).json({
    //       success: false,
    //       error: 'Due date is required for pay later'
    //     });
    //   }
    //   const selectedDate = new Date(dueDate);
    //   const today = new Date();
    //   if (selectedDate <= today) {
    //     return res.status(400).json({
    //       success: false,
    //       error: 'Due date must be in the future'
    //     });
    //   }
    // }

    // Generate unique transaction ID
    const transactionId = `TXN_${Date.now()}`;

    // Create payment record
    const paymentData = {
      userId,
      orderId: transactionId,
      amount,
      currency,
      paymentMethod,
      status: 'pending',
      upiId: process.env.UPI_ID
    };

    // Add due date if it's a pay later payment
    // if (paymentMethod === 'pay_later') {
    //   paymentData.dueDate = new Date(dueDate);
    // }

    const payment = new Payment(paymentData);
    await payment.save();

    // Generate UPI payment link and QR code
    let upiLink = null;
    let qrCode = null;
    
    // Generate QR for both UPI and pay later options
    if (paymentMethod === 'upi' || paymentMethod === 'pay_later') {
      const businessName = process.env.BUSINESS_NAME || 'Servio';
      upiLink = `upi://pay?pa=${process.env.UPI_ID}&pn=${encodeURIComponent(businessName)}&am=${amount}&cu=INR&tn=${transactionId}`;
      qrCode = await QRCode.toDataURL(upiLink);
    }

    // Get user details for email
    let customerEmail = '';
    let customerName = 'Valued Customer';
    
    try {
      if (req.app.locals && req.app.locals.db) {
        const user = await req.app.locals.db.collection('users').findOne({ _id: userId });
        if (user) {
          customerEmail = user.email || '';
          customerName = user.name || 'Valued Customer';
        }
      }
    } catch (error) {
      console.error('Error fetching user details:', error);
    }

    // Prepare response data
    const responseData = {
      transactionId,
      amount,
      currency,
      paymentMethod,
      qrCode,
      upiLink
    };

    // Add due date for pay later
    // if (paymentMethod === 'pay_later') {
    //   responseData.dueDate = dueDate;
    // }

    // Remove the email sending from here since it will be handled in verify-payment
    // if (paymentMethod === 'pay_later' && customerEmail) {
    //   await sendPaymentConfirmationEmails(
    //     responseData,
    //     customerEmail,
    //     customerName
    //   );
    // }

    res.json({
      success: true,
      data: responseData
    });
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create order: ' + error.message
    });
  }
});

// PhonePe callback
// router.post('/phonepe-callback', async (req, res) => {
//   try {
//     const { response } = req.body;
//     const decodedResponse = JSON.parse(Buffer.from(response, 'base64').toString());
//     const { merchantTransactionId, state, code } = decodedResponse;

//     // Find payment record
//     const payment = await Payment.findOne({ orderId: merchantTransactionId });
//     if (!payment) {
//       return res.status(404).json({
//         success: false,
//         error: 'Payment not found'
//       });
//     }

//     // Update payment status
//     payment.status = state === 'COMPLETED' ? 'completed' : 'failed';
//     payment.paymentDetails = decodedResponse;

//     await payment.save();

//     // If payment successful, add reward points
//     if (payment.status === 'completed') {
//       const points = Math.floor(payment.amount / 100);
//       if (points > 0) {
//         await RewardPoints.findOneAndUpdate(
//           { userId: payment.userId },
//           {
//             $inc: { points },
//             $push: {
//               transactions: {
//                 type: 'earn',
//                 points,
//                 description: `Earned for payment of ₹${payment.amount}`
//               }
//             }
//           },
//           { upsert: true }
//         );
//       }
//     }

//     res.json({ success: true });
//   } catch (error) {
//     console.error('Error processing callback:', error);
//     res.status(500).json({
//       success: false,
//       error: 'Failed to process callback'
//     });
//   }
// });

// Verify payment
router.post('/verify-payment', authenticateToken, async (req, res) => {
  try {
    const { transactionId } = req.body;
    const userIdString = req.user.id || req.user.userId; // Try both id and userId fields
    
    // Convert string ID to ObjectId
    const userId = new mongoose.Types.ObjectId(userIdString);

    // Find the payment record
    const payment = await Payment.findOne({ orderId: transactionId, userId });
    if (!payment) {
      return res.status(404).json({
        success: false,
        error: 'Payment not found'
      });
    }

    // Update payment status and details
    payment.status = 'completed';
    payment.paymentDetails = {
      verifiedAt: new Date(),
      verificationMethod: 'manual'
    };

    await payment.save();

    // Get user details for email
    let customerEmail = '';
    let customerName = 'Valued Customer';
    
    try {
      if (req.app.locals && req.app.locals.db) {
        const user = await req.app.locals.db.collection('users').findOne({ _id: userId });
        if (user) {
          customerEmail = user.email || '';
          customerName = user.name || 'Valued Customer';
        }
      } else {
        console.warn('MongoDB connection not available in app.locals');
      }
    } catch (error) {
      console.error('Error fetching user details:', error);
      // Continue with default values
    }

    // Add reward points (1 point per ₹100)
    const points = Math.floor(payment.amount / 100);
    if (points > 0) {
      await RewardPoints.findOneAndUpdate(
        { userId },
        {
          $inc: { points },
          $push: {
            transactions: {
              type: 'earn',
              points,
              description: `Earned for payment of ₹${payment.amount}`
            }
          }
        },
        { upsert: true }
      );
    }

    // Create a booking for the payment
    try {
      // Get cart items from the request
      const cartItems = req.body.cartItems || [];
      
      if (cartItems.length > 0) {
        // Format services for booking
        const services = cartItems.map(item => {
          // Handle both string IDs and ObjectIds
          const serviceId = item.service._id || item.id;
          
          return {
            serviceId: serviceId, // Store the original ID as is
            name: item.service.name || item.service.provider?.name || 'Unknown Service',
            price: item.service.price || 0,
            quantity: item.quantity || 1
          };
        });
        
        // Create booking
        const booking = new Booking({
          userId: new mongoose.Types.ObjectId(userId),
          services,
          totalAmount: payment.amount,
          paymentId: payment._id,
          scheduledDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Default to 7 days from now
          notes: 'Booking created after payment verification',
          status: 'pending',
          bookingDate: new Date()
        });
        
        await booking.save();
        
        // Update payment with booking reference
        payment.bookingId = booking._id;
        await payment.save();

        // Get user details for email
        let customerEmail = '';
        let customerName = 'Valued Customer';
        
        try {
          if (req.app.locals && req.app.locals.db) {
            const user = await req.app.locals.db.collection('users').findOne({ _id: userId });
            if (user) {
              customerEmail = user.email || '';
              customerName = user.name || 'Valued Customer';
            }
          }
        } catch (error) {
          console.error('Error fetching user details:', error);
        }

        // Send booking confirmation email
        const emailResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/email/send`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            customerEmail,
            customerName,
            subject: `New Booking-${booking._id.toString()}`,
            orderDetails: {
              orderId: booking._id.toString(),
              scheduledDate: booking.scheduledDate,
              status: booking.status,
              services: booking.services,
              amount: booking.totalAmount,
              paymentMethod: payment.paymentMethod
            }
          })
        });

        if (!emailResponse.ok) {
          console.error('Failed to send booking confirmation email:', await emailResponse.text());
        }

        console.log('Booking created successfully:', {
          bookingId: booking._id,
          services: booking.services,
          totalAmount: booking.totalAmount
        });
      }
    } catch (bookingError) {
      console.error('Error creating booking:', bookingError);
      // Continue with the response even if booking creation fails
      // Log the error for debugging
      console.error('Booking creation error details:', {
        error: bookingError.message,
        stack: bookingError.stack,
        cartItems: req.body.cartItems,
        userId: userId
      });
    }

    res.json({
      success: true,
      data: {
        status: 'completed',
        message: 'Payment verified successfully',
        pointsEarned: points
      }
    });
  } catch (error) {
    console.error('Error verifying payment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify payment'
    });
  }
});

// Save card
router.post('/save-card', authenticateToken, async (req, res) => {
  try {
    const { cardNumber, cardHolderName, expiryMonth, expiryYear, isDefault } = req.body;
    const userId = req.user.id;

    // Validate card details
    if (!cardNumber || !cardHolderName || !expiryMonth || !expiryYear) {
      return res.status(400).json({
        success: false,
        error: 'Missing card details'
      });
    }

    // If setting as default, unset other default cards
    if (isDefault) {
      await Card.updateMany(
        { userId, isDefault: true },
        { isDefault: false }
      );
    }

    const card = new Card({
      userId,
      cardNumber,
      cardHolderName,
      expiryMonth,
      expiryYear,
      isDefault
    });

    await card.save();

    res.json({
      success: true,
      data: {
        message: 'Card saved successfully',
        cardId: card._id
      }
    });
  } catch (error) {
    console.error('Error saving card:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save card'
    });
  }
});

// Get saved cards
router.get('/cards', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const cards = await Card.find({ userId })
      .select('-cardNumber')
      .sort({ isDefault: -1, createdAt: -1 });

    res.json({
      success: true,
      data: cards
    });
  } catch (error) {
    console.error('Error fetching cards:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch cards'
    });
  }
});

// Get wallet balance
router.get('/wallet', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const wallet = await Wallet.findOne({ userId });

    res.json({
      success: true,
      data: {
        balance: wallet?.balance || 0,
        transactions: wallet?.transactions || []
      }
    });
  } catch (error) {
    console.error('Error fetching wallet:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch wallet'
    });
  }
});

// Get reward points
router.get('/reward-points', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const rewardPoints = await RewardPoints.findOne({ userId });

    res.json({
      success: true,
      data: {
        points: rewardPoints?.points || 0,
        transactions: rewardPoints?.transactions || []
      }
    });
  } catch (error) {
    console.error('Error fetching reward points:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch reward points'
    });
  }
});

export default router; 