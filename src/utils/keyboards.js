const { Markup } = require('telegraf');

const teacherMainKeyboard = Markup.keyboard([
  ['🟢 Dars boshlash', '🔴 Darsni tugatish'],
  ['📊 Davomat', '🔑 Joriy kod'],
  ['📋 Sessiyalar tarixi'],
]).resize();

const teacherActiveSessionKeyboard = Markup.keyboard([
  ['🔴 Darsni tugatish', '🔑 Joriy kod'],
  ['📊 Davomat'],
]).resize();

const adminMainKeyboard = Markup.keyboard([
  ['➕ O\'qituvchi qo\'shish', '🗑 O\'qituvchini o\'chirish'],
  ['👩‍🏫 O\'qituvchilar ro\'yxati', '📋 Barcha sessiyalar'],
  ['🟢 Dars boshlash', '🔴 Darsni tugatish'],
  ['📊 Davomat', '🔑 Joriy kod'],
]).resize();

const studentMainKeyboard = Markup.keyboard([
  ['📊 Davomat tarixim'],
  ['❓ Yordam'],
]).resize();

const confirmKeyboard = Markup.keyboard([
  ['✅ Ha, tugatish', '❌ Bekor qilish'],
]).resize().oneTime();

const removeKeyboard = Markup.removeKeyboard();

module.exports = {
  teacherMainKeyboard,
  teacherActiveSessionKeyboard,
  adminMainKeyboard,
  studentMainKeyboard,
  confirmKeyboard,
  removeKeyboard,
};