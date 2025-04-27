import express from 'express';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import QRCode from 'qrcode';
dotenv.config();

const router = express.Router();

// Create a transporter using Gmail service
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

// Verify transporter configuration
transporter.verify((error, success) => {
  if (error) {
    console.error('SMTP Configuration Error:', error);
  } else {
    console.log('SMTP Server is ready to send emails');
  }
});

/**
 * @route POST /api/email/send
 * @desc Send emails to customer and company
 * @access Public
 */
router.post('/send', async (req, res) => {
  try {
    const { customerEmail, customerName, subject, message, orderDetails = {} } = req.body;
    console.log(customerEmail, customerName, subject, message, orderDetails);
    // Get company details from environment variables
    const companyDetails = {
      name: process.env.BUSINESS_NAME || 'Servio',
      email: process.env.BUSINESS_EMAIL,
      phone: process.env.BUSINESS_PHONE || 'Not Available',
      address: process.env.BUSINESS_ADDRESS || 'Not Available',
      website: process.env.BUSINESS_WEBSITE || 'Not Available',
      supportEmail: process.env.SUPPORT_EMAIL || process.env.BUSINESS_EMAIL
    };
    
    // Validate required fields
    if (!customerEmail) {
      return res.status(400).json({
        success: false,
        error: 'Customer email is required'
      });
    }
    
    if (!companyDetails.email) {
      return res.status(400).json({
        success: false,
        error: 'Company email is not configured in environment variables'
      });
    }

    // Generate QR code for payment if payment method is "Pay Later"
    let qrCodeHtml = '';
    if (orderDetails?.paymentMethod === 'Pay Later' && orderDetails?.orderId && orderDetails?.amount) {
      try {
        const paymentLink = `${process.env.FRONTEND_URL}/pending-verification?orderId=${orderDetails.orderId}&amount=${orderDetails.amount}`;
        const qrCodeDataUrl = await QRCode.toDataURL(paymentLink, {
          errorCorrectionLevel: 'H',
          margin: 1,
          width: 200,
          color: {
            dark: '#4F46E5',
            light: '#ffffff'
          }
        });
        
        qrCodeHtml = `
          <div style="text-align: center; margin: 20px 0; padding: 20px; background-color: #f8f9fa; border-radius: 8px;">
            <h3 style="color: #4F46E5; margin-bottom: 15px;">Payment QR Code</h3>
            <p style="color: #666; margin-bottom: 15px;">Scan this QR code to complete your payment after service completion</p>
            <img src="${qrCodeDataUrl}" alt="Payment QR Code" style="max-width: 200px; margin: 0 auto; display: block;">
            <p style="color: #666; margin-top: 15px;">Or click here to pay: <a href="${paymentLink}" style="color: #4F46E5; text-decoration: none; font-weight: bold;">Pay Now</a></p>
          </div>
        `;
      } catch (error) {
        console.error('Error generating QR code:', error);
      }
    }

    // Format date and time safely
    const formatDateTime = (dateString) => {
      if (!dateString) return 'Not specified';
      try {
        const date = new Date(dateString);
        return {
          date: date.toLocaleDateString(),
          time: date.toLocaleTimeString()
        };
      } catch (error) {
        return {
          date: 'Invalid date',
          time: 'Invalid time'
        };
      }
    };

    const dateTime = formatDateTime(orderDetails?.scheduledDate);

    // Email to customer
    const customerMailOptions = {
      from: `"${companyDetails.name}" <${process.env.EMAIL_USER}>`,
      to: customerEmail,
      subject: subject || 'Booking Confirmation - Tiffin Service',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #f8f9fa; padding: 20px; text-align: center; border-bottom: 3px solid #4f46e5;">
            <h1 style="color: #333; margin: 0;">${companyDetails.name}</h1>
          </div>

          <div style="padding: 20px;">
            <h2 style="color: #333;">Hello ${customerName || 'Valued Customer'},</h2>
            <p>Your booking has been confirmed. Here are the details:</p>
            
            <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <h3 style="color: #333; margin-top: 0;">Booking Details</h3>
              <p><strong>Booking ID:</strong> ${orderDetails?.orderId || 'N/A'}</p>
              <p><strong>Date:</strong> ${dateTime.date}</p>
              <p><strong>Time:</strong> ${dateTime.time}</p>
              <p><strong>Status:</strong> ${orderDetails?.status || 'Confirmed'}</p>
              
              <h4 style="color: #333; margin-top: 15px;">Services Booked:</h4>
              ${orderDetails?.services ? orderDetails.services.map(service => `
                <div style="margin-bottom: 10px;">
                  <p><strong>Service:</strong> ${service.name || 'N/A'}</p>
                  <p><strong>Quantity:</strong> ${service.quantity || 1}</p>
                  <p><strong>Price:</strong> ₹${service.price || 0}</p>
                </div>
              `).join('') : '<p>No services specified</p>'}
              
              <p style="margin-top: 15px;"><strong>Total Amount:</strong> ₹${orderDetails?.amount || 0}</p>
            </div>

            ${qrCodeHtml}

            <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <h3 style="color: #333; margin-top: 0;">Company Details</h3>
              <p style="margin: 5px 0;">${companyDetails.name}</p>
              <p style="margin: 5px 0;">${companyDetails.phone}</p>
              <p style="margin: 5px 0;">${companyDetails.address}</p>
              <p style="margin: 5px 0;">Website: ${companyDetails.website}</p>
              <p style="margin: 5px 0;">Support: ${companyDetails.supportEmail}</p>
            </div>

            <p style="margin-top: 20px;">Thank you for choosing our services!</p>
            
            <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666;">
              <p>If you have any questions, please contact our support team at ${companyDetails.supportEmail}</p>
            </div>
          </div>
        </div>
      `
    };

    // Email to company
    const companyMailOptions = {
      from: process.env.EMAIL_USER,
      to: companyDetails.email,
      subject: `New Booking - ${orderDetails?.orderId || 'Order ID: test'}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #333;">New Booking Notification</h1>
          <p>A new booking has been received. Here are the details:</p>

          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3 style="color: #333; margin-top: 0;">Customer Information</h3>
            <p style="margin: 5px 0;"><strong>Name:</strong> ${customerName || 'Not provided'}</p>
            <p style="margin: 5px 0;"><strong>Email:</strong> ${customerEmail}</p>
          </div>

          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3 style="color: #333; margin-top: 0;">Booking Details</h3>
            <p><strong>Booking ID:</strong> ${orderDetails?.orderId || 'N/A'}</p>
            <p><strong>Date:</strong> ${dateTime.date}</p>
            <p><strong>Time:</strong> ${dateTime.time}</p>
            <p><strong>Status:</strong> ${orderDetails?.status || 'Confirmed'}</p>
            
            <h4 style="color: #333; margin-top: 15px;">Services Booked:</h4>
            ${orderDetails?.services ? orderDetails.services.map(service => `
              <div style="margin-bottom: 10px;">
                <p><strong>Service:</strong> ${service.name || 'N/A'}</p>
                <p><strong>Quantity:</strong> ${service.quantity || 1}</p>
                <p><strong>Price:</strong> ₹${service.price || 0}</p>
              </div>
            `).join('') : '<p>No services specified</p>'}
            
            <p style="margin-top: 15px;"><strong>Total Amount:</strong> ₹${orderDetails?.amount || 0}</p>
          </div>

          ${qrCodeHtml}
        </div>
      `
    };

    // Send emails
    await transporter.sendMail(customerMailOptions);
    await transporter.sendMail(companyMailOptions);

    res.status(200).json({ 
      success: true,
      message: 'Emails sent successfully' 
    });
  } catch (error) {
    console.error('Email sending error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to send emails',
      details: error.message 
    });
  }
});

export default router; 