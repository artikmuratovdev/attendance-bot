const { Scenes } = require('telegraf');
const Session = require('../models/Session');
const {
  generateCode,
  getTodayString,
  formatTime,
  formatDate,
  isSuperAdmin,
} = require('../utils/helpers');
const { startCodeRotation, stopCodeRotation } = require('../utils/codeRotation');
const {
  setSessionCode,
  deleteSessionCode,
  setActiveSession,
  deleteActiveSession,
} = require('../utils/cache');
const {
  teacherMainKeyboard,
  teacherActiveSessionKeyboard,
  adminMainKeyboard,
  confirmKeyboard,
} = require('../utils/keyboards');
const { getSmartKeyboard } = require('../utils/roleKeyboard');

// ─── /start_session ───────────────────────────────────────────────────────────

const startSessionWizard = new Scenes.WizardScene(
  'start_session_wizard',

  async (ctx) => {
    await ctx.reply(
      '📚 <b>Yangi dars sessiyasi</b>\n\nFan nomini kiriting:\n<i>(masalan: Matematika, Fizika, Ingliz tili)</i>\n\nBekor qilish: /cancel yoki ❌ Bekor qilish',
      { parse_mode: 'HTML', reply_markup: { remove_keyboard: true } }
    );
    return ctx.wizard.next();
  },

  async (ctx) => {
    const text = ctx.message?.text?.trim();

    if (text === '/cancel' || text === '❌ Bekor qilish') {
      const kb = await getSmartKeyboard(ctx.from.id);
      await ctx.reply('↩️ Amal bekor qilindi.', kb);
      return ctx.scene.leave();
    }

    if (!text) {
      await ctx.reply('❌ Iltimos, fan nomini matn ko\'rinishida yuboring.');
      return;
    }
    ctx.wizard.state.subject = text;
    await ctx.reply(
      `✅ Fan: <b>${ctx.wizard.state.subject}</b>\n\nGuruh nomini kiriting:\n<i>(masalan: CS-101, 3-B, 21-guruh)</i>\n\nBekor qilish: /cancel yoki ❌ Bekor qilish`,
      { parse_mode: 'HTML' }
    );
    return ctx.wizard.next();
  },

  async (ctx) => {
    const text = ctx.message?.text?.trim();

    if (text === '/cancel' || text === '❌ Bekor qilish') {
      const kb = await getSmartKeyboard(ctx.from.id);
      await ctx.reply('↩️ Amal bekor qilindi.', kb);
      return ctx.scene.leave();
    }

    if (!text) {
      await ctx.reply('❌ Iltimos, guruh nomini matn ko\'rinishida yuboring.');
      return;
    }

    const group = text;
    const subject = ctx.wizard.state.subject;
    const teacherId = ctx.from.id;
    const today = getTodayString();
    const codeLength = parseInt(process.env.CODE_LENGTH) || 6;
    const intervalSeconds = parseInt(process.env.CODE_INTERVAL_SECONDS) || 30;

    const existingSession = await Session.findOne({ teacherId, isActive: true }).lean();
    if (existingSession) {
      await ctx.reply(
        `⚠️ Sizda hali faol sessiya bor!\n\n📚 <b>${existingSession.subject}</b> - ${existingSession.group}\n\nAvval uni yakunlang:`,
        { parse_mode: 'HTML', ...teacherActiveSessionKeyboard }
      );
      return ctx.scene.leave();
    }

    const initialCode = generateCode(codeLength);
    const session = await Session.create({
      teacherId,
      subject,
      group,
      date: today,
      currentCode: initialCode,
      codeGeneratedAt: new Date(),
    });

    await setSessionCode(session._id, initialCode);
    await setActiveSession(teacherId, session._id);
    startCodeRotation(session, ctx);

    await ctx.reply(
      `🟢 <b>Dars sessiyasi boshlandi!</b>\n\n` +
      `📚 Fan: <b>${subject}</b>\n` +
      `👥 Guruh: <b>${group}</b>\n` +
      `📅 Sana: ${formatDate(new Date())}\n\n` +
      `🔑 Birinchi kod:\n<code>${initialCode}</code>\n\n` +
      `⏱ Kod har <b>${intervalSeconds} soniyada</b> yangilanadi\n\n` +
      `📢 Talabalar botga kod yubora boshlashlari mumkin!`,
      { parse_mode: 'HTML', ...teacherActiveSessionKeyboard }
    );

    return ctx.scene.leave();
  }
);

// ─── /end_session ─────────────────────────────────────────────────────────────

const endSession = async (ctx) => {
  const teacherId = ctx.from.id;

  const session = await Session.findOne({ teacherId, isActive: true }).lean();
  if (!session) {
    // Faol sessiya yo'q — rolga qarab keyboard
    const kb = await getSmartKeyboard(teacherId);
    return ctx.reply('❌ Sizda faol sessiya yo\'q.', kb);
  }

  await ctx.reply(
    `⚠️ <b>Sessiyani yakunlashni tasdiqlaysizmi?</b>\n\n` +
    `📚 Fan: <b>${session.subject}</b>\n` +
    `👥 Guruh: <b>${session.group}</b>\n` +
    `✅ Qatnashganlar: <b>${session.attendees.length}</b> nafar`,
    { parse_mode: 'HTML', ...confirmKeyboard }
  );
};

const confirmEndSession = async (ctx) => {
  const teacherId = ctx.from.id;

  const session = await Session.findOne({ teacherId, isActive: true });
  if (!session) {
    const kb = await getSmartKeyboard(teacherId);
    return ctx.reply('❌ Faol sessiya topilmadi.', kb);
  }

  stopCodeRotation(session._id.toString());
  await deleteSessionCode(session._id.toString());
  await deleteActiveSession(teacherId);

  session.isActive = false;
  session.endedAt = new Date();
  await session.save();

  // ✅ Rol bo'yicha to'g'ri keyboard: superadmin → admin kb, teacher → teacher kb
  const kb = isSuperAdmin(teacherId) ? adminMainKeyboard : teacherMainKeyboard;

  await ctx.reply(
    `🔴 <b>Sessiya yakunlandi!</b>\n\n` +
    `📚 Fan: <b>${session.subject}</b>\n` +
    `👥 Guruh: <b>${session.group}</b>\n` +
    `📅 Sana: ${formatDate(session.createdAt)}\n\n` +
    `✅ Qatnashganlar: <b>${session.attendees.length}</b> nafar`,
    { parse_mode: 'HTML', ...kb }
  );
};

// ─── /attendance ──────────────────────────────────────────────────────────────

const showAttendance = async (ctx) => {
  const teacherId = ctx.from.id;

  let session = await Session.findOne({ teacherId, isActive: true });
  if (!session) {
    session = await Session.findOne({ teacherId }).sort({ createdAt: -1 });
  }

  if (!session) {
    const kb = await getSmartKeyboard(teacherId);
    return ctx.reply('📭 Hali hech qanday sessiya yo\'q.', kb);
  }

  // Faol sessiya bor → teacherActive, yo'q → rolga qarab
  let kb;
  if (session.isActive) {
    kb = teacherActiveSessionKeyboard;
  } else {
    kb = isSuperAdmin(teacherId) ? adminMainKeyboard : teacherMainKeyboard;
  }

  const status = session.isActive ? '🟢 Faol' : '🔴 Yakunlangan';
  const attendees = session.attendees;

  let message =
    `📊 <b>Davomat hisoboti</b>\n\n` +
    `${status}\n` +
    `📚 Fan: <b>${session.subject}</b>\n` +
    `👥 Guruh: <b>${session.group}</b>\n` +
    `📅 Sana: ${formatDate(session.createdAt)}\n\n` +
    `✅ Qatnashganlar: <b>${attendees.length}</b> nafar\n\n`;

  if (attendees.length === 0) {
    message += '<i>(Hali hech kim qatnashmagan)</i>';
  } else {
    message += `<b>Ro'yxat:</b>\n`;
    attendees.forEach((a, i) => {
      message += `${i + 1}. ${a.fullName} — ${formatTime(a.markedAt)}\n`;
    });
  }

  await ctx.reply(message, { parse_mode: 'HTML', ...kb });
};

// ─── /current_code ────────────────────────────────────────────────────────────

const showCurrentCode = async (ctx) => {
  const teacherId = ctx.from.id;
  const session = await Session.findOne({ teacherId, isActive: true }).lean();

  if (!session) {
    const kb = isSuperAdmin(teacherId) ? adminMainKeyboard : teacherMainKeyboard;
    return ctx.reply('❌ Faol sessiya yo\'q.', kb);
  }

  const intervalSeconds = parseInt(process.env.CODE_INTERVAL_SECONDS) || 30;
  const ageSeconds = Math.floor(
    (Date.now() - new Date(session.codeGeneratedAt).getTime()) / 1000
  );
  const remaining = Math.max(0, intervalSeconds - ageSeconds);

  await ctx.reply(
    `🔑 <b>Joriy kod:</b>\n<code>${session.currentCode}</code>\n\n` +
    `⏳ Yangilanishga: <b>${remaining}</b> soniya\n` +
    `👥 Qatnashganlar: <b>${session.attendees.length}</b> nafar`,
    { parse_mode: 'HTML', ...teacherActiveSessionKeyboard }
  );
};

// ─── /sessions ────────────────────────────────────────────────────────────────

const showSessions = async (ctx) => {
  const teacherId = ctx.from.id;
  const sessions = await Session.find({ teacherId })
    .sort({ createdAt: -1 })
    .limit(10)
    .lean();

  const kb = isSuperAdmin(teacherId) ? adminMainKeyboard : teacherMainKeyboard;

  if (sessions.length === 0) {
    return ctx.reply('📭 Hali hech qanday sessiya yo\'q.', kb);
  }

  let message = `📋 <b>Oxirgi ${sessions.length} ta sessiya:</b>\n\n`;
  sessions.forEach((s) => {
    const status = s.isActive ? '🟢' : '🔴';
    message += `${status} <b>${s.subject}</b> | ${s.group}\n`;
    message += `   📅 ${formatDate(s.createdAt)} — ${s.attendees.length} nafar\n\n`;
  });

  await ctx.reply(message, { parse_mode: 'HTML', ...kb });
};

module.exports = {
  startSessionWizard,
  endSession,
  confirmEndSession,
  showAttendance,
  showCurrentCode,
  showSessions,
};