const generateCode = (length = 6) => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
};

const getTodayString = () => {
  return new Date().toISOString().split('T')[0];
};

const formatTime = (date) => {
  return new Date(date).toLocaleTimeString('uz-UZ', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: 'Asia/Tashkent',
  });
};

const formatDate = (date) => {
  return new Date(date).toLocaleDateString('uz-UZ', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'Asia/Tashkent',
  });
};

const isSuperAdmin = (telegramId) => {
  const adminIds = process.env.SUPER_ADMIN_IDS
    ? process.env.SUPER_ADMIN_IDS.split(',').map((id) => parseInt(id.trim()))
    : [];
  return adminIds.includes(telegramId);
};

const isTeacher = async (telegramId) => {
  if (isSuperAdmin(telegramId)) return true;

  const { getCachedTeacher, setCachedTeacher } = require('./cache');
  const cached = await getCachedTeacher(telegramId);
  if (cached !== null) return cached;

  const Teacher = require('../models/Teacher');
  const teacher = await Teacher.findOne(
    { telegramId, isActive: true },
    { _id: 1 }
  ).lean();

  const result = !!teacher;
  await setCachedTeacher(telegramId, result);
  return result;
};

const getCodeAge = (codeGeneratedAt) => {
  return Math.floor((Date.now() - new Date(codeGeneratedAt).getTime()) / 1000);
};

const calcPercentage = (count, total) => {
  if (total === 0) return 0;
  return Math.round((count / total) * 100);
};

module.exports = {
  generateCode,
  getTodayString,
  formatTime,
  formatDate,
  isTeacher,
  isSuperAdmin,
  getCodeAge,
  calcPercentage,
};