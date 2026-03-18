const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
  telegramId: {
    type: Number,
    required: true,
    unique: true,
  },
  firstName: {
    type: String,
    required: true,
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
  studentId: {
    type: String,
    default: '', // Talaba ID raqami (ixtiyoriy)
  },
  registeredAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Student', studentSchema);
