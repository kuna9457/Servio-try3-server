import mongoose from 'mongoose';

const professionalSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  phone: {
    type: String,
    required: true,
    trim: true
  },
  serviceCategories: [{
    type: String,
    required: true
  }],
  description: {
    type: String,
    required: true
  },
  location: {
    type: String,
    required: true
  },
  availability: {
    type: String,
    required: true
  },
  perPersonRate: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const Professional = mongoose.model('Professional', professionalSchema);

export default Professional; 