const Session = require('../models/Session');
const { generateCode, formatTime } = require('./helpers');
const { setSessionCode, deleteSessionCode, setActiveSession } = require('./cache');

// Faol sessiyalar uchun interval map: sessionId -> intervalId
const activeIntervals = new Map();

/**
 * Sessiya uchun kod rotatsiyasini boshlash
 */
const startCodeRotation = (session, bot) => {
  const intervalSeconds = parseInt(process.env.CODE_INTERVAL_SECONDS) || 30;
  const codeLength = parseInt(process.env.CODE_LENGTH) || 6;

  // Oldingi interval bo'lsa to'xtatamiz
  stopCodeRotation(session._id.toString());

  const intervalId = setInterval(async () => {
    try {
      const currentSession = await Session.findById(session._id).lean();
      if (!currentSession || !currentSession.isActive) {
        stopCodeRotation(session._id.toString());
        return;
      }

      const newCode = generateCode(codeLength);

      // 1) DB ni yangilash
      await Session.findByIdAndUpdate(session._id, {
        currentCode: newCode,
        codeGeneratedAt: new Date(),
      });

      // 2) Redis: eski kod o'chadi, yangi yoziladi
      await setSessionCode(session._id, newCode);

      // 3) O'qituvchiga xabar
      const timeStr = formatTime(new Date());
      await bot.telegram.sendMessage(
        currentSession.teacherId,
        `🔄 <b>Kod yangilandi!</b>\n\n` +
        `📚 Fan: <b>${currentSession.subject}</b>\n` +
        `👥 Guruh: <b>${currentSession.group}</b>\n\n` +
        `🔑 Yangi kod:\n<code>${newCode}</code>\n\n` +
        `⏰ Vaqt: ${timeStr}\n` +
        `👥 Qatnashganlar: <b>${currentSession.attendees.length}</b> nafar\n\n` +
        `<i>Keyingi yangilanish ${intervalSeconds} soniyadan so'ng</i>`,
        { parse_mode: 'HTML' }
      );
    } catch (error) {
      console.error('Kod rotatsiya xatosi:', error.message);
    }
  }, intervalSeconds * 1000);

  activeIntervals.set(session._id.toString(), intervalId);
  console.log(`▶️ Kod rotatsiyasi boshlandi: session ${session._id}`);
};

/**
 * Sessiya uchun kod rotatsiyasini to'xtatish
 */
const stopCodeRotation = (sessionId) => {
  const intervalId = activeIntervals.get(sessionId);
  if (intervalId) {
    clearInterval(intervalId);
    activeIntervals.delete(sessionId);
    console.log(`⏹️ Kod rotatsiyasi to'xtatildi: session ${sessionId}`);
  }
};

/**
 * Server qayta ishga tushganda faol sessiyalarni tiklash
 */
const restoreActiveSessions = async (bot) => {
  try {
    const activeSessions = await Session.find({ isActive: true });
    for (const session of activeSessions) {
      await setSessionCode(session._id, session.currentCode);
      await setActiveSession(session.teacherId, session._id);
      startCodeRotation(session, bot);
    }
    if (activeSessions.length > 0) {
      console.log(`♻️ ${activeSessions.length} ta faol sessiya tiklandi`);
    }
  } catch (error) {
    console.error('Sessiyalarni tiklash xatosi:', error.message);
  }
};

module.exports = { startCodeRotation, stopCodeRotation, restoreActiveSessions };