require('dotenv').config();
const { Telegraf, Scenes, session } = require('telegraf');
const connectDB = require('./config/database');
const { connectRedis } = require('./config/redis');
const { isTeacher, isSuperAdmin } = require('./utils/helpers');
const { restoreActiveSessions } = require('./utils/codeRotation');
const { getSmartKeyboard } = require('./utils/roleKeyboard');

const {
  startSessionWizard,
  endSession,
  confirmEndSession,
  showAttendance,
  showCurrentCode,
  showSessions,
} = require('./handlers/teacherHandlers');

const {
  registerStudent,
  handleAttendanceCode,
  showMyAttendance,
} = require('./handlers/studentHandlers');

const {
  addTeacherWizard,
  removeTeacherWizard,
  listTeachers,
  showAdminHelp,
  allSessions,
  allSessionsPage
} = require('./handlers/adminHandlers');

const {
  teacherMainKeyboard,
  adminMainKeyboard,
  studentMainKeyboard,
} = require('./utils/keyboards');

// ─── Bot sozlash ──────────────────────────────────────────────────────────────

const bot = new Telegraf(process.env.BOT_TOKEN);

const stage = new Scenes.Stage([startSessionWizard, addTeacherWizard, removeTeacherWizard]);
bot.use(session());
bot.use(stage.middleware());

// ─── Middleware ───────────────────────────────────────────────────────────────

const superAdminOnly = async (ctx, next) => {
  if (!isSuperAdmin(ctx.from.id)) return ctx.reply('⛔️ Bu buyruq faqat Super Admin uchun.');
  return next();
};

const teacherOnly = async (ctx, next) => {
  if (!(await isTeacher(ctx.from.id))) return ctx.reply('⛔️ Bu buyruq faqat o\'qituvchilar uchun.');
  return next();
};

// ─── /start ──────────────────────────────────────────────────────────────────

bot.start(async (ctx) => {
  const userId = ctx.from.id;
  const firstName = ctx.from.first_name || 'Foydalanuvchi';
  const intervalSec = process.env.CODE_INTERVAL_SECONDS || 30;

  if (isSuperAdmin(userId)) {
    return ctx.reply(
      `👋 Xush kelibsiz, <b>${firstName}</b>!\n\n` +
      `🔐 <b>Super Admin paneli</b>\n` +
      `<i>Kod har ${intervalSec} soniyada yangilanadi</i>`,
      { parse_mode: 'HTML', ...adminMainKeyboard }
    );
  }

  if (await isTeacher(userId)) {
    return ctx.reply(
      `👋 Xush kelibsiz, <b>${firstName}</b>!\n\n` +
      `🎓 <b>O'qituvchi paneli</b>\n` +
      `<i>Kod har ${intervalSec} soniyada avtomatik yangilanadi</i>`,
      { parse_mode: 'HTML', ...teacherMainKeyboard }
    );
  }

  await registerStudent(ctx);
});

// ─── Buyruqlar ────────────────────────────────────────────────────────────────

bot.command('add_teacher',    superAdminOnly, (ctx) => ctx.scene.enter('add_teacher_wizard'));
bot.command('remove_teacher', superAdminOnly, (ctx) => ctx.scene.enter('remove_teacher_wizard'));
bot.command('teachers',       superAdminOnly, listTeachers);
bot.command('admin_help',     superAdminOnly, showAdminHelp);
bot.command('all_sessions',   superAdminOnly, allSessions);

bot.command('start_session', teacherOnly, (ctx) => ctx.scene.enter('start_session_wizard'));
bot.command('end_session',   teacherOnly, endSession);
bot.command('attendance',    teacherOnly, showAttendance);
bot.command('current_code',  teacherOnly, showCurrentCode);
bot.command('sessions',      teacherOnly, showSessions);

bot.command('my_attendance', showMyAttendance);

bot.command('cancel', async (ctx) => {
  const inScene = Boolean(ctx.scene?.current);
  if (inScene) {
    await ctx.scene.leave();
  }

  const kb = await getSmartKeyboard(ctx.from.id);
  return ctx.reply(inScene ? '↩️ Amal bekor qilindi.' : 'ℹ️ Bekor qilinadigan faol jarayon yo\'q.', kb);
});

bot.command('help', async (ctx) => {
  const userId = ctx.from.id;
  const intervalSec = process.env.CODE_INTERVAL_SECONDS || 30;

  if (isSuperAdmin(userId)) {
    return ctx.reply(
      `📖 <b>Admin uchun yordam</b>\n\n` +
      `Tugmalardan yoki quyidagi buyruqlardan foydalaning:\n` +
      `/add_teacher, /remove_teacher, /teachers, /all_sessions`,
      { parse_mode: 'HTML', ...adminMainKeyboard }
    );
  }

  if (await isTeacher(userId)) {
    return ctx.reply(
      `📖 <b>O'qituvchi uchun yordam</b>\n\n` +
      `1️⃣ 🟢 Dars boshlash — yangi sessiya\n` +
      `2️⃣ Talabalar kodni botga yuborishadi\n` +
      `3️⃣ 📊 Davomat — kim kelganini ko'rish\n` +
      `4️⃣ 🔴 Darsni tugatish — sessiya yopish\n\n` +
      `🔄 Kod har <b>${intervalSec} soniyada</b> yangilanadi`,
      { parse_mode: 'HTML', ...teacherMainKeyboard }
    );
  }

  return ctx.reply(
    `📖 <b>Talaba uchun yordam</b>\n\n` +
    `1️⃣ O'qituvchi ekranda kod ko'rsatadi\n` +
    `2️⃣ Shu kodni bu botga yuboring\n` +
    `3️⃣ Davomat avtomatik belgilanadi! ✅`,
    { parse_mode: 'HTML', ...studentMainKeyboard }
  );
});

// ─── Reply keyboard tugmalari ─────────────────────────────────────────────────

// O'qituvchi tugmalari (superadmin ham ishlatadi)
bot.hears('🟢 Dars boshlash',     teacherOnly, (ctx) => ctx.scene.enter('start_session_wizard'));
bot.hears('🔴 Darsni tugatish',   teacherOnly, endSession);
bot.hears('📊 Davomat',           teacherOnly, showAttendance);
bot.hears('🔑 Joriy kod',         teacherOnly, showCurrentCode);
bot.hears('📋 Sessiyalar tarixi', teacherOnly, showSessions);

// Admin tugmalari
bot.hears('➕ O\'qituvchi qo\'shish',     superAdminOnly, (ctx) => ctx.scene.enter('add_teacher_wizard'));
bot.hears('🗑 O\'qituvchini o\'chirish',  superAdminOnly, (ctx) => ctx.scene.enter('remove_teacher_wizard'));
bot.hears('👩‍🏫 O\'qituvchilar ro\'yxati', superAdminOnly, listTeachers);
bot.hears('📋 Barcha sessiyalar',        superAdminOnly, allSessions);

// Talaba tugmalari
bot.hears('📊 Davomat tarixim', showMyAttendance);
bot.hears('❓ Yordam', async (ctx) => {
  await ctx.reply(
    `📖 <b>Talaba uchun yordam</b>\n\n` +
    `1️⃣ O'qituvchi ekranda kod ko'rsatadi\n` +
    `2️⃣ Shu kodni bu botga yuboring\n` +
    `3️⃣ Davomat avtomatik belgilanadi! ✅`,
    { parse_mode: 'HTML', ...studentMainKeyboard }
  );
});

// Sessiyani yakunlash — tasdiqlash tugmalari
bot.hears('✅ Ha, tugatish', teacherOnly, confirmEndSession);
bot.hears('❌ Bekor qilish', async (ctx) => {
  if (ctx.scene?.current) {
    await ctx.scene.leave();
  }

  // Rol bo'yicha to'g'ri keyboard qaytarish
  const kb = await getSmartKeyboard(ctx.from.id);
  await ctx.reply('↩️ Bekor qilindi.', kb);
});

// ─── Matn xabarlar (davomat kodi) ─────────────────────────────────────────────

bot.on('text', async (ctx) => {
  const text = ctx.message.text;
  if (text.startsWith('/')) return;

  if (isSuperAdmin(ctx.from.id) || await isTeacher(ctx.from.id)) return;

  await handleAttendanceCode(ctx);
});

bot.action(/^sessions_page:\d+$/, superAdminOnly, allSessionsPage);
bot.action('sessions_noop', (ctx) => ctx.answerCbQuery());

// ─── Xatolarni ushlash ────────────────────────────────────────────────────────

bot.catch((err, ctx) => {
  console.error(`❌ Bot xatosi [${ctx.updateType}]:`, err);
  ctx.reply('⚠️ Xato yuz berdi. Iltimos, qayta urinib ko\'ring.');
});

// ─── Ishga tushirish ──────────────────────────────────────────────────────────

const start = async () => {
  try {
    await connectDB();
    await connectRedis();
    await restoreActiveSessions(bot);
    await bot.launch();
    console.log('🤖 Attendance Bot ishga tushdi!');
    console.log(`⏱  Kod intervali: ${process.env.CODE_INTERVAL_SECONDS || 30} soniya`);
    console.log(`🔐 Super Adminlar: ${process.env.SUPER_ADMIN_IDS || '(belgilanmagan)'}`);
  } catch (error) {
    console.error('❌ Bot ishga tushmadi:', error);
    process.exit(1);
  }
};

start();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));