const { redis } = require('../config/redis');

const TEACHER_TTL  = 300;
const SESSION_TTL  = 3600;
const ATTENDEE_TTL = 3600;

// ─── Teacher cache ────────────────────────────────────────────────────────────

const getCachedTeacher = async (telegramId) => {
  const val = await redis.get(`teacher:${telegramId}`);
  if (val === null) return null;
  return val === '1';
};

const setCachedTeacher = async (telegramId, isTeacher) => {
  await redis.setEx(`teacher:${telegramId}`, TEACHER_TTL, isTeacher ? '1' : '0');
};

const invalidateTeacherCache = async (telegramId) => {
  await redis.del(`teacher:${telegramId}`);
};

// ─── Active session by code ───────────────────────────────────────────────────

/**
 * Joriy kod → sessionId
 * Key: code:{code}  →  sessionId
 * Key: session_code:{sessionId}  →  currentCode  (eski kodni o'chirish uchun)
 */
const getSessionIdByCode = async (code) => {
  return await redis.get(`code:${code}`);
};

const setSessionCode = async (sessionId, newCode, ttl = SESSION_TTL) => {
  const sid = sessionId.toString();

  // Eski kodni o'chirish
  const oldCode = await redis.get(`session_code:${sid}`);
  if (oldCode && oldCode !== newCode) {
    await redis.del(`code:${oldCode}`);
  }

  // Yangi kodni yozish
  await redis.setEx(`code:${newCode}`, ttl, sid);
  await redis.setEx(`session_code:${sid}`, ttl, newCode);
};

const deleteSessionCode = async (sessionId) => {
  const sid = sessionId.toString();
  const code = await redis.get(`session_code:${sid}`);
  if (code) await redis.del(`code:${code}`);
  await redis.del(`session_code:${sid}`);
};

// ─── Attendee check ───────────────────────────────────────────────────────────

const hasAttended = async (sessionId, telegramId) => {
  const val = await redis.get(`attended:${sessionId}:${telegramId}`);
  return val === '1';
};

const markAttended = async (sessionId, telegramId) => {
  await redis.setEx(`attended:${sessionId}:${telegramId}`, ATTENDEE_TTL, '1');
};

// ─── Active session by teacherId ──────────────────────────────────────────────

const getActiveSessionId = async (teacherId) => {
  return await redis.get(`active_session:${teacherId}`);
};

const setActiveSession = async (teacherId, sessionId) => {
  await redis.setEx(`active_session:${teacherId}`, SESSION_TTL, sessionId.toString());
};

const deleteActiveSession = async (teacherId) => {
  await redis.del(`active_session:${teacherId}`);
};

module.exports = {
  getCachedTeacher,
  setCachedTeacher,
  invalidateTeacherCache,
  getSessionIdByCode,
  setSessionCode,
  deleteSessionCode,
  hasAttended,
  markAttended,
  getActiveSessionId,
  setActiveSession,
  deleteActiveSession,
};