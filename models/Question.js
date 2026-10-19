const mongoose = require('mongoose');
const { LEVELS } = require('../config/levels');

const questionSchema = new mongoose.Schema(
  {
    text: { type: String, required: true, trim: true, maxlength: 300 },
    options: {
      type: [String],
      validate: {
        validator: (v) => v.length === 4 && v.every((o) => o && o.trim()),
        message: 'A question needs exactly 4 non-empty options',
      },
    },
    correctIndex: { type: Number, required: true, min: 0, max: 3 },
    level: { type: Number, min: 1, max: LEVELS.length, default: 1, index: true },
    category: { type: String, trim: true, default: 'General Knowledge' },
    status: {
      type: String,
      enum: ['approved', 'pending', 'rejected'],
      default: 'approved',
      index: true,
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    timesAsked: { type: Number, default: 0 },
    timesCorrect: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Question', questionSchema);
