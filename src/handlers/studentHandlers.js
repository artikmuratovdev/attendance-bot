const Student = require('../models/Student');
const Session = require('../models/Session');
const { formatTime, formatDate } = require('../utils/helpers');
const { getSessionIdByCode, hasAttended, markAttended } = require('../utils/cache');
const { studentMainKeyboard } = require('../utils/keyboards');

const registerStudent = async (ctx) => {
  const telegramId = ctx.from.id;
  const firstName = ctx.from.first_name || '';
  const lastName = ctx.from.last_name || '';
  const username = ctx.from.username || '';
  const fullName = `${firstName} ${lastName}`.trim();

  const existing = await Student.findOneAndUpdate(
    { telegramId },
    { $setOnInsert: { telegramId, firstName, lastName, username, fullName, registeredAt: new Date() } },
    { upsert: true, new: false }
  );

  if (existing !== null) {
    return ctx.reply(
      `✅ Siz allaqachon ro'yxatdan o'tgansiz!\n\n👤 Ism: <b>${existing.fullName}</b>\n\nDavomat belgilash uchun faol sessiya kodini yuboring.`,
      { parse_mode: 'HTML', ...studentMainKeyboard }
    );
  }

  await ctx.reply(
    `🎉 <b>Xush kelibsiz, ${firstName}!</b>\n\n` +
    `✅ Ro'yxatdan muvaffaqiyatli o'tdingiz.\n\n` +
    `📌 <b>Qanday foydalanish:</b>\n` +
    `O'qituvchi ekranda ko'rsatgan kodni shu botga yuboring — davomat avtomatik belgilanadi!\n\n` +
    `<i>Masalan: <code>A7K9BQ</code> ni yuboring</i>`,
    { parse_mode: 'HTML', ...studentMainKeyboard }
  );
};

const handleAttendanceCode = async (ctx) => {
  const text = ctx.message.text.trim().toUpperCase();
  const telegramId = ctx.from.id;

  if (!/^[A-Z0-9]{4,10}$/.test(text)) return;

  const student = await Student.findOne({ telegramId }, { fullName: 1, _id: 1 }).lean();
  if (!student) {
    return ctx.reply(
      `⚠️ Siz ro'yxatdan o'tmagansiz!\n\nAvval /start buyrug'ini yuboring.`,
      { parse_mode: 'HTML' }
    );
  }

  // Redis dan kod tekshirish
  const sessionId = await getSessionIdByCode(text);
  if (!sessionId) {
    return ctx.reply(
      `❌ <b>Noto'g'ri kod!</b>\n\nKod: <code>${text}</code>\n\n` +
      `Mumkin bo'lgan sabablar:\n• Kod eskirgan (30 soniya o'tgan)\n• Yozishda xato\n\n` +
      `<i>O'qituvchi ekranidan yangi kodni ko'ring</i>`,
      { parse_mode: 'HTML', ...studentMainKeyboard }
    );
  }

  // Redis dan qatnashganmi tekshirish
  const alreadyMarked = await hasAttended(sessionId, telegramId);
  if (alreadyMarked) {
    const session = await Session.findById(sessionId, { subject: 1, group: 1 }).lean();
    return ctx.reply(
      `ℹ️ Siz bu darsda allaqachon qatnashgansiz!\n\n📚 Fan: <b>${session?.subject}</b>\n👥 Guruh: <b>${session?.group}</b>`,
      { parse_mode: 'HTML', ...studentMainKeyboard }
    );
  }

  // DB ga yozish
  const session = await Session.findByIdAndUpdate(
    sessionId,
    {
      $push: {
        attendees: {
          studentId: student._id,
          telegramId,
          fullName: student.fullName,
          markedAt: new Date(),
          codeUsed: text,
        },
      },
    },
    { new: true, projection: { subject: 1, group: 1, teacherId: 1, attendees: 1 } }
  );

  if (!session) {
    return ctx.reply('❌ Sessiya topilmadi.', studentMainKeyboard);
  }

  // Redis ga belgilash
  await markAttended(sessionId, telegramId);

  await ctx.reply(
    `✅ <b>Davomat belgilandi!</b>\n\n` +
    `👤 ${student.fullName}\n` +
    `📚 Fan: <b>${session.subject}</b>\n` +
    `👥 Guruh: <b>${session.group}</b>\n` +
    `📅 Sana: ${formatDate(new Date())}\n` +
    `⏰ Vaqt: ${formatTime(new Date())}`,
    { parse_mode: 'HTML', ...studentMainKeyboard }
  );

  try {
    await ctx.telegram.sendMessage(
      session.teacherId,
      `🔔 <b>${student.fullName}</b> davomatga belgilandi!\n👥 Jami: ${session.attendees.length} nafar`,
      { parse_mode: 'HTML' }
    );
  } catch (e) {}
};

const showMyAttendance = async (ctx) => {
  const telegramId = ctx.from.id;

  const student = await Student.findOne({ telegramId }).lean();
  if (!student) {
    return ctx.reply('⚠️ Avval /start buyrug\'ini yuboring.');
  }

  const sessions = await Session.find({ 'attendees.telegramId': telegramId })
    .sort({ createdAt: -1 })
    .limit(20)
    .lean();

  if (sessions.length === 0) {
    return ctx.reply(
      `📭 <b>${student.fullName}</b>\n\nHali hech qanday darsda qatnashmadingiz.`,
      { parse_mode: 'HTML', ...studentMainKeyboard }
    );
  }

  let message = `📊 <b>${student.fullName} — Davomat tarixi</b>\n\nJami: <b>${sessions.length}</b> ta dars\n\n`;
  sessions.forEach((s, i) => {
    const myAttendance = s.attendees.find((a) => a.telegramId === telegramId);
    const time = myAttendance ? formatTime(myAttendance.markedAt) : '—';
    message += `${i + 1}. <b>${s.subject}</b> | ${s.group}\n`;
    message += `   📅 ${formatDate(s.createdAt)} ⏰ ${time}\n\n`;
  });

  await ctx.reply(message, { parse_mode: 'HTML', ...studentMainKeyboard });
};

module.exports = { registerStudent, handleAttendanceCode, showMyAttendance };