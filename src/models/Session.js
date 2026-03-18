const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  teacherId: {
    type: Number,
    required: true,
  },
  subject: {
    type: String,
    required: true,
  },
  group: {
    type: String,
    required: true,
  },
  date: {
    type: String, // "2024-01-15" formatida
    required: true,
  },
  currentCode: {
    type: String,
    required: true,
  },
  codeGeneratedAt: {
    type: Date,
    default: Date.now,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  endedAt: {
    type: Date,
    default: null,
  },
  // Qatnashgan talabalar
  attendees: [{
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student' },
    telegramId: Number,
    fullName: String,
    markedAt: { type: Date, default: Date.now },
    codeUsed: String,
  }],
});

module.exports = mongoose.model('Session', sessionSchema);
