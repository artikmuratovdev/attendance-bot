const { Scenes, Markup } = require('telegraf');
const Teacher = require('../models/Teacher');
const { formatDate, formatTime } = require('../utils/helpers');
const { invalidateTeacherCache } = require('../utils/cache');
const { adminMainKeyboard } = require('../utils/keyboards');

const SESSIONS_PER_PAGE = 5;

// ─── /add_teacher ─────────────────────────────────────────────────────────────

const addTeacherWizard = new Scenes.WizardScene(
  'add_teacher_wizard',

  async (ctx) => {
    await ctx.reply(
      `➕ <b>Yangi o'qituvchi qo'shish</b>\n\n` +
      `O'qituvchining <b>Telegram ID</b> sini kiriting.\n\n` +
      `<i>O'qituvchi @userinfobot dan ID sini bilib olishi mumkin</i>`,
      { parse_mode: 'HTML', reply_markup: { remove_keyboard: true } }
    );
    return ctx.wizard.next();
  },

  async (ctx) => {
    const text = ctx.message?.text?.trim();
    if (!text || !/^\d+$/.test(text)) {
      await ctx.reply('❌ Faqat raqam kiriting. Masalan: <code>123456789</code>', { parse_mode: 'HTML' });
      return;
    }

    const telegramId = parseInt(text);
    const existing = await Teacher.findOne({ telegramId, isActive: true }).lean();
    if (existing) {
      await ctx.reply(
        `⚠️ Bu ID da o'qituvchi allaqachon mavjud!\n\n👤 <b>${existing.fullName}</b>\n🆔 <code>${telegramId}</code>`,
        { parse_mode: 'HTML', ...adminMainKeyboard }
      );
      return ctx.scene.leave();
    }

    ctx.wizard.state.telegramId = telegramId;
    await ctx.reply(
      `✅ ID: <code>${telegramId}</code>\n\nO'qituvchining <b>to'liq ismini</b> kiriting:`,
      { parse_mode: 'HTML' }
    );
    return ctx.wizard.next();
  },

  async (ctx) => {
    const fullName = ctx.message?.text?.trim();
    if (!fullName || fullName.length < 2) {
      await ctx.reply('❌ Iltimos, to\'liq ism kiriting (kamida 2 ta belgi).');
      return;
    }

    const { telegramId } = ctx.wizard.state;
    const addedBy = ctx.from.id;

    await Teacher.findOneAndUpdate(
      { telegramId },
      { telegramId, fullName, addedBy, isActive: true, removedAt: null, addedAt: new Date() },
      { upsert: true, new: true }
    );

    await invalidateTeacherCache(telegramId);

    await ctx.reply(
      `✅ <b>O'qituvchi qo'shildi!</b>\n\n👤 Ism: <b>${fullName}</b>\n🆔 ID: <code>${telegramId}</code>\n\n` +
      `<i>Endi u botda o'qituvchi sifatida kirishi mumkin</i>`,
      { parse_mode: 'HTML', ...adminMainKeyboard }
    );

    try {
      await ctx.telegram.sendMessage(
        telegramId,
        `🎓 <b>Xush kelibsiz!</b>\n\nSiz attendance bot tizimiga <b>o'qituvchi</b> sifatida qo'shildingiz.\n\nBoshlash uchun /start yuboring.`,
        { parse_mode: 'HTML' }
      );
    } catch (e) {
      await ctx.reply(
        `ℹ️ <i>Eslatma: O'qituvchi botni hali ishga tushirmagan. U /start yuborganida tizimga kiradi.</i>`,
        { parse_mode: 'HTML' }
      );
    }

    return ctx.scene.leave();
  }
);

// ─── /remove_teacher ──────────────────────────────────────────────────────────

const removeTeacherWizard = new Scenes.WizardScene(
  'remove_teacher_wizard',

  async (ctx) => {
    const teachers = await Teacher.find({ isActive: true }).lean();

    if (teachers.length === 0) {
      await ctx.reply('📭 Hozircha hech qanday o\'qituvchi yo\'q.', adminMainKeyboard);
      return ctx.scene.leave();
    }

    let message = `🗑 <b>O'chirish uchun ID kiriting:</b>\n\n`;
    teachers.forEach((t, i) => {
      message += `${i + 1}. <b>${t.fullName}</b>\n   🆔 <code>${t.telegramId}</code>\n\n`;
    });
    message += `<i>O'qituvchi Telegram ID sini yuboring:</i>`;

    await ctx.reply(message, { parse_mode: 'HTML', reply_markup: { remove_keyboard: true } });
    return ctx.wizard.next();
  },

  async (ctx) => {
    const text = ctx.message?.text?.trim();
    if (!text || !/^\d+$/.test(text)) {
      await ctx.reply('❌ Faqat raqam kiriting.');
      return;
    }

    const telegramId = parseInt(text);
    const teacher = await Teacher.findOne({ telegramId, isActive: true });

    if (!teacher) {
      await ctx.reply(
        `❌ <code>${telegramId}</code> ID li faol o'qituvchi topilmadi.`,
        { parse_mode: 'HTML', ...adminMainKeyboard }
      );
      return ctx.scene.leave();
    }

    teacher.isActive = false;
    teacher.removedAt = new Date();
    await teacher.save();

    await invalidateTeacherCache(telegramId);

    await ctx.reply(
      `✅ <b>O'chirildi!</b>\n\n👤 <b>${teacher.fullName}</b>\n🆔 <code>${telegramId}</code>\n\n` +
      `<i>Endi u o'qituvchi buyruqlarini ishlatib olmaydi</i>`,
      { parse_mode: 'HTML', ...adminMainKeyboard }
    );

    try {
      await ctx.telegram.sendMessage(telegramId, `ℹ️ Sizning o'qituvchi huquqingiz bekor qilindi.`);
    } catch (e) {}

    return ctx.scene.leave();
  }
);

// ─── /teachers ────────────────────────────────────────────────────────────────

const listTeachers = async (ctx) => {
  const teachers = await Teacher.find({ isActive: true }).sort({ addedAt: 1 }).lean();

  if (teachers.length === 0) {
    return ctx.reply('📭 Hozircha hech qanday o\'qituvchi yo\'q.', adminMainKeyboard);
  }

  let message = `👩‍🏫 <b>O'qituvchilar ro'yxati</b> (${teachers.length} nafar)\n\n`;
  teachers.forEach((t, i) => {
    const username = t.username ? ` @${t.username}` : '';
    message += `${i + 1}. <b>${t.fullName}</b>${username}\n`;
    message += `   🆔 <code>${t.telegramId}</code> | 📅 ${formatDate(t.addedAt)}\n\n`;
  });

  await ctx.reply(message, { parse_mode: 'HTML', ...adminMainKeyboard });
};

// ─── /admin_help ──────────────────────────────────────────────────────────────

const showAdminHelp = async (ctx) => {
  await ctx.reply(
    `🔐 <b>Super Admin paneli</b>\n\n` +
    `👩‍🏫 <b>O'qituvchilarni boshqarish:</b>\n` +
    `• /add_teacher — Yangi o'qituvchi qo'shish\n` +
    `• /remove_teacher — O'qituvchini o'chirish\n` +
    `• /teachers — Barcha o'qituvchilar ro'yxati\n\n` +
    `📊 <b>Statistika:</b>\n` +
    `• /all_sessions — Barcha sessiyalar\n\n` +
    `<i>Siz ham o'qituvchi sifatida /start_session kabi buyruqlarni ishlata olasiz</i>`,
    { parse_mode: 'HTML', ...adminMainKeyboard }
  );
};

// ─── /all_sessions — paginated ────────────────────────────────────────────────

const allSessions = async (ctx) => {
  await sendSessionsPage(ctx, 0);
};

const allSessionsPage = async (ctx) => {
  const page = parseInt(ctx.callbackQuery.data.split(':')[1]);
  await ctx.answerCbQuery();
  await sendSessionsPage(ctx, page, true);
};

const sendSessionsPage = async (ctx, page, edit = false) => {
  const Session = require('../models/Session');

  const totalCount = await Session.countDocuments({});

  if (totalCount === 0) {
    const text = '📭 Hali hech qanday sessiya yo\'q.';
    return edit
      ? ctx.editMessageText(text)
      : ctx.reply(text, adminMainKeyboard);
  }

  const totalPages = Math.ceil(totalCount / SESSIONS_PER_PAGE);
  const safePage = Math.max(0, Math.min(page, totalPages - 1));
  const skip = safePage * SESSIONS_PER_PAGE;

  const sessions = await Session.find({})
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(SESSIONS_PER_PAGE)
    .lean();

  // O'qituvchilarni bir so'rovda olish
  const teacherIds = [...new Set(sessions.map((s) => s.teacherId))];
  const teachers = await Teacher.find(
    { telegramId: { $in: teacherIds } },
    { telegramId: 1, fullName: 1 }
  ).lean();
  const teacherMap = Object.fromEntries(teachers.map((t) => [t.telegramId, t.fullName]));

  // Xabar matni
  let message = `📋 <b>Barcha sessiyalar</b>\n`;
  message += `📄 Sahifa: <b>${safePage + 1} / ${totalPages}</b> | Jami: <b>${totalCount}</b> ta\n`;
  message += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  for (const s of sessions) {
    const status = s.isActive ? '🟢 Faol' : '🔴 Yakunlangan';
    const teacherName = teacherMap[s.teacherId] || `ID:${s.teacherId}`;

    message += `${status}\n`;
    message += `📚 <b>${s.subject}</b> | 👥 ${s.group}\n`;
    message += `👨‍🏫 <b>${teacherName}</b> | 📅 ${formatDate(s.createdAt)}\n`;

    if (s.attendees.length === 0) {
      message += `👤 <i>Hech kim qatnashmagan</i>\n`;
    } else {
      message += `✅ <b>${s.attendees.length} nafar qatnashdi:</b>\n`;
      s.attendees.forEach((a, i) => {
        message += `   ${i + 1}. ${a.fullName} — ${formatTime(a.markedAt)}\n`;
      });
    }

    message += `━━━━━━━━━━━━━━━━━━━━━━\n`;
  }

  // Inline pagination tugmalari
  const navRow = [];

  if (safePage > 0) {
    navRow.push(Markup.button.callback('⬅️', `sessions_page:${safePage - 1}`));
  }

  navRow.push(
    Markup.button.callback(`📄 ${safePage + 1} / ${totalPages}`, 'sessions_noop')
  );

  if (safePage < totalPages - 1) {
    navRow.push(Markup.button.callback('➡️', `sessions_page:${safePage + 1}`));
  }

  const jumpRow = [];
  if (totalPages > 2) {
    if (safePage !== 0) {
      jumpRow.push(Markup.button.callback('⏮ Birinchi', 'sessions_page:0'));
    }
    if (safePage !== totalPages - 1) {
      jumpRow.push(Markup.button.callback('Oxirgi ⏭', `sessions_page:${totalPages - 1}`));
    }
  }

  const inlineButtons = jumpRow.length > 0
    ? Markup.inlineKeyboard([navRow, jumpRow])
    : Markup.inlineKeyboard([navRow]);

  if (edit) {
    await ctx.editMessageText(message, {
      parse_mode: 'HTML',
      ...inlineButtons,
    });
  } else {
    await ctx.reply(message, {
      parse_mode: 'HTML',
      ...inlineButtons,
    });
  }
};

module.exports = {
  addTeacherWizard,
  removeTeacherWizard,
  listTeachers,
  showAdminHelp,
  allSessions,
  allSessionsPage,   // ← yangi
};