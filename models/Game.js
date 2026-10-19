const mongoose = require('mongoose');

const gameSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    status: { type: String, enum: ['active', 'won', 'lost', 'quit'], default: 'active' },
    level: { type: Number, default: 1 }, // number of the question currently on screen
    question: { type: mongoose.Schema.Types.ObjectId, ref: 'Question' },
    usedQuestions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Question' }],
    hidden: { type: [Number], default: [] }, // options removed by 50:50
    lifelines: {
      fifty: { type: Boolean, default: false },
      poll: { type: Boolean, default: false },
      phone: { type: Boolean, default: false },
      flip: { type: Boolean, default: false },
    },
    hints: {
      poll: { type: [Number], default: undefined },
      phone: { answer: Number, confidence: Number },
    },
    winnings: { type: Number, default: 0, index: true },
    endedAt: Date,
  },
  { timestamps: true }
);

module.exports = mongoose.model('Game', gameSchema);
