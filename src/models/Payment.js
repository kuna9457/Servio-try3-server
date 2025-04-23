import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const cardSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  cardNumber: {
    type: String,
    required: true,
    select: false
  },
  cardHolderName: {
    type: String,
    required: true
  },
  expiryMonth: {
    type: String,
    required: true
  },
  expiryYear: {
    type: String,
    required: true
  },
  isDefault: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Encrypt card number before saving
cardSchema.pre('save', async function(next) {
  if (!this.isModified('cardNumber')) return next();
  this.cardNumber = await bcrypt.hash(this.cardNumber, 10);
  next();
});

const walletSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  balance: {
    type: Number,
    default: 0
  },
  transactions: [{
    type: {
      type: String,
      enum: ['credit', 'debit'],
      required: true
    },
    amount: {
      type: Number,
      required: true
    },
    description: String,
    createdAt: {
      type: Date,
      default: Date.now
    }
  }]
});

const rewardPointsSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  points: {
    type: Number,
    default: 0
  },
  transactions: [{
    type: {
      type: String,
      enum: ['earn', 'redeem'],
      required: true
    },
    points: {
      type: Number,
      required: true
    },
    description: String,
    createdAt: {
      type: Date,
      default: Date.now
    }
  }]
});

const paymentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  orderId: {
    type: String,
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'INR'
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'refunded'],
    default: 'pending'
  },
  paymentMethod: {
    type: String,
    enum: ['card', 'upi', 'qr', 'wallet', 'pay_later'],
    required: true
  },
  dueDate: {
    type: Date
  },
  upiId: {
    type: String
  },
  paymentProof: {
    type: String
  },
  paymentDetails: {
    type: mongoose.Schema.Types.Mixed
  },
  refunds: [{
    amount: Number,
    reason: String,
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed']
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  metadata: {
    type: mongoose.Schema.Types.Mixed
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

export const Card = mongoose.model('Card', cardSchema);
export const Wallet = mongoose.model('Wallet', walletSchema);
export const RewardPoints = mongoose.model('RewardPoints', rewardPointsSchema);
export const Payment = mongoose.model('Payment', paymentSchema); 