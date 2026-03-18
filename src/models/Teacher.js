const mongoose = require('mongoose');

const teacherSchema = new mongoose.Schema({
  telegramId: {
    type: Number,
    required: true,
    unique: true,
  },
  firstName: {
    type: String,
    default: '',
  },
  lastName: {
    type: String,
    default: '',
  },
  username: {
    type: String,
    default: '',
  },
  fullName: {
    type: String,
    required: true,
  },
  addedBy: {
    type: Number, // Super Admin yoki boshqa o'qituvchining telegramId si
    required: true,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  addedAt: {
    type: Date,
    default: Date.now,
  },
  removedAt: {
    type: Date,
    default: null,
  },
});

module.exports = mongoose.model('Teacher', teacherSchema);
