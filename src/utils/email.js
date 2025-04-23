import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config();

// Debug environment variables
console.log('Email configuration check:');
console.log('EMAIL_USER:', process.env.EMAIL_USER || 'Not set');
console.log('EMAIL_PASSWORD:', process.env.EMAIL_PASSWORD ? 'Set' : 'Not set');
console.log('BUSINESS_EMAIL:', process.env.BUSINESS_EMAIL || 'Not set');

// Create a transporter using Gmail SMTP
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
    console.error('SMTP configuration error:', error);
  } else {
    console.log('SMTP server is ready to send emails');
  }
});

export const sendVerificationEmail = async (email, code) => {
  try {
    // Check if email configuration exists
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
      console.error('Email configuration missing. Please check your environment variables.');
      console.error('EMAIL_USER:', process.env.EMAIL_USER ? 'Set' : 'Not set');
      console.error('EMAIL_PASSWORD:', process.env.EMAIL_PASSWORD ? 'Set' : 'Not set');
      throw new Error('Email service not configured');
    }

    console.log('Attempting to send verification email to:', email);
    
    const mailOptions = {
      from: `"${process.env.BUSINESS_NAME || 'ServiceHub'}" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Password Change Verification Code',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Password Change Verification</h2>
          <p>You have requested to change your password. Please use the following verification code:</p>
          <div style="background-color: #f4f4f4; padding: 15px; text-align: center; margin: 20px 0; font-size: 24px; font-weight: bold; color: #333;">
            ${code}
          </div>
          <p>This code will expire in 15 minutes.</p>
          <p>If you didn't request this change, please ignore this email.</p>
        </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Email sending error:', error);
    if (error.code === 'ECONNREFUSED') {
      throw new Error('Could not connect to email server. Please check your email configuration.');
    } else if (error.code === 'EAUTH') {
      throw new Error('Email authentication failed. Please check your email credentials and make sure you are using an App Password for Gmail.');
    }
    throw new Error(`Failed to send verification email: ${error.message}`);
  }
};

export const sendPaymentConfirmationEmails = async (payment, user) => {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.error('Email configuration is missing');
    return;
  }

  const paymentDate = new Date(payment.createdAt).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  // Prepare email options for customer
  const customerEmailOptions = {
    from: process.env.SMTP_FROM,
    to: user.email || 'Not provided',
    subject: 'Payment Confirmation',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #4F46E5;">Payment Confirmation</h2>
        <p>Dear ${user.name},</p>
        <p>Thank you for your payment. Here are the details:</p>
        <div style="background-color: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Transaction ID:</strong> ${payment.transactionId || 'N/A'}</p>
          <p><strong>Amount:</strong> ₹${payment.amount.toFixed(2)}</p>
          <p><strong>Payment Method:</strong> ${payment.paymentMethod}</p>
          <p><strong>Date:</strong> ${paymentDate}</p>
        </div>
        <p>If you have any questions, please contact our support team.</p>
        <p>Best regards,<br>Your Service Team</p>
      </div>
    `
  };

  // Prepare email options for company
  const companyEmailOptions = {
    from: process.env.SMTP_FROM,
    to: process.env.COMPANY_EMAIL,
    subject: 'New Payment Received',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #4F46E5;">New Payment Received</h2>
        <p>A new payment has been received with the following details:</p>
        <div style="background-color: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Customer Name:</strong> ${user.name}</p>
          <p><strong>Customer Email:</strong> ${user.email || 'Not provided'}</p>
          <p><strong>Customer Phone:</strong> ${user.phone || 'Not provided'}</p>
          <p><strong>Transaction ID:</strong> ${payment.transactionId || 'N/A'}</p>
          <p><strong>Amount:</strong> ₹${payment.amount.toFixed(2)}</p>
          <p><strong>Payment Method:</strong> ${payment.paymentMethod}</p>
          <p><strong>Date:</strong> ${paymentDate}</p>
        </div>
      </div>
    `
  };

  try {
    // Send email to customer if email is provided
    if (user.email) {
      await transporter.sendMail(customerEmailOptions);
    }

    // Always send email to company
    await transporter.sendMail(companyEmailOptions);
  } catch (error) {
    console.error('Error sending payment confirmation emails:', error);
    throw error;
  }
};

export const sendBookingConfirmationEmail = async (booking, agent) => {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.error('Email configuration is missing');
    return;
  }

  const scheduledDate = new Date(booking.scheduledDate).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  // Prepare email options for customer
  const customerEmailOptions = {
    from: process.env.SMTP_FROM,
    to: booking.userId.email || 'Not provided',
    subject: 'Booking Confirmation',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #4F46E5;">Booking Confirmation</h2>
        <p>Dear ${booking.userId.name},</p>
        <p>Your booking has been confirmed. Here are the details:</p>
        <div style="background-color: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Booking ID:</strong> ${booking._id}</p>
          <p><strong>Services:</strong></p>
          <ul>
            ${booking.services.map(service => `
              <li>${service.name} - ₹${service.price.toFixed(2)} x ${service.quantity}</li>
            `).join('')}
          </ul>
          <p><strong>Total Amount:</strong> ₹${booking.totalAmount.toFixed(2)}</p>
          <p><strong>Scheduled Date:</strong> ${scheduledDate}</p>
          <p><strong>Assigned Agent:</strong></p>
          <ul>
            <li>Name: ${agent.name}</li>
            <li>Phone: ${agent.phone}</li>
            <li>Email: ${agent.email}</li>
          </ul>
        </div>
        <p>If you have any questions, please contact our support team.</p>
        <p>Best regards,<br>Your Service Team</p>
      </div>
    `
  };

  // Prepare email options for company
  const companyEmailOptions = {
    from: process.env.SMTP_FROM,
    to: process.env.COMPANY_EMAIL,
    subject: 'New Booking Confirmation',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #4F46E5;">New Booking Confirmation</h2>
        <p>A new booking has been confirmed with the following details:</p>
        <div style="background-color: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Booking ID:</strong> ${booking._id}</p>
          <p><strong>Customer Details:</strong></p>
          <ul>
            <li>Name: ${booking.userId.name}</li>
            <li>Email: ${booking.userId.email || 'Not provided'}</li>
            <li>Phone: ${booking.userId.phone || 'Not provided'}</li>
          </ul>
          <p><strong>Services:</strong></p>
          <ul>
            ${booking.services.map(service => `
              <li>${service.name} - ₹${service.price.toFixed(2)} x ${service.quantity}</li>
            `).join('')}
          </ul>
          <p><strong>Total Amount:</strong> ₹${booking.totalAmount.toFixed(2)}</p>
          <p><strong>Scheduled Date:</strong> ${scheduledDate}</p>
          <p><strong>Assigned Agent:</strong></p>
          <ul>
            <li>Name: ${agent.name}</li>
            <li>Phone: ${agent.phone}</li>
            <li>Email: ${agent.email}</li>
          </ul>
        </div>
      </div>
    `
  };

  // Prepare email options for agent
  const agentEmailOptions = {
    from: process.env.SMTP_FROM,
    to: agent.email,
    subject: 'New Booking Assignment',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #4F46E5;">New Booking Assignment</h2>
        <p>Dear ${agent.name},</p>
        <p>You have been assigned a new booking. Here are the details:</p>
        <div style="background-color: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Booking ID:</strong> ${booking._id}</p>
          <p><strong>Customer Details:</strong></p>
          <ul>
            <li>Name: ${booking.userId.name}</li>
            <li>Phone: ${booking.userId.phone || 'Not provided'}</li>
          </ul>
          <p><strong>Services:</strong></p>
          <ul>
            ${booking.services.map(service => `
              <li>${service.name} - ₹${service.price.toFixed(2)} x ${service.quantity}</li>
            `).join('')}
          </ul>
          <p><strong>Total Amount:</strong> ₹${booking.totalAmount.toFixed(2)}</p>
          <p><strong>Scheduled Date:</strong> ${scheduledDate}</p>
        </div>
        <p>Please contact the customer to confirm the appointment.</p>
        <p>Best regards,<br>Your Service Team</p>
      </div>
    `
  };

  try {
    // Send email to customer if email is provided
    if (booking.userId.email) {
      await transporter.sendMail(customerEmailOptions);
    }

    // Send email to company
    await transporter.sendMail(companyEmailOptions);

    // Send email to agent
    await transporter.sendMail(agentEmailOptions);
  } catch (error) {
    console.error('Error sending booking confirmation emails:', error);
    throw error;
  }
};

export const sendEmail = async (to, subject, text, html) => {
  try {
    if (!transporter) {
      throw new Error('Email configuration not properly initialized');
    }

    const mailOptions = {
      from: process.env.SMTP_USER,
      to,
      subject,
      text,
      html
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent:', info.messageId);
    return info;
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
}; 