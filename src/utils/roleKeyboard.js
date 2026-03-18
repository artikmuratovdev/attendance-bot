const { isSuperAdmin, isTeacher } = require('./helpers');
const {
  adminMainKeyboard,
  teacherMainKeyboard,
  teacherActiveSessionKeyboard,
  studentMainKeyboard,
} = require('./keyboards');
const Session = require('../models/Session');

/**
 * Foydalanuvchi roliga qarab asosiy keyboard qaytaradi
 */
const getMainKeyboard = async (telegramId) => {
  if (isSuperAdmin(telegramId)) return adminMainKeyboard;
  if (await isTeacher(telegramId)) return teacherMainKeyboard;
  return studentMainKeyboard;
};

/**
 * O'qituvchi uchun: faol sessiya bormi? Unga qarab keyboard
 */
const getTeacherKeyboard = async (telegramId) => {
  const hasActive = await Session.exists({ teacherId: telegramId, isActive: true });
  return hasActive ? teacherActiveSessionKeyboard : teacherMainKeyboard;
};

/**
 * Rol + sessiya holatiga qarab eng to'g'ri keyboard
 */
const getSmartKeyboard = async (telegramId) => {
  if (isSuperAdmin(telegramId)) return adminMainKeyboard;
  if (await isTeacher(telegramId)) return getTeacherKeyboard(telegramId);
  return studentMainKeyboard;
};

module.exports = { getMainKeyboard, getTeacherKeyboard, getSmartKeyboard };