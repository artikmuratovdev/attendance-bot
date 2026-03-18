const { createClient } = require('redis');

const redis = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
});

redis.on('error', (err) => console.error('❌ Redis xatosi:', err));
redis.on('connect', () => console.log('✅ Redis ga ulandi'));

const connectRedis = async () => {
  await redis.connect();
};

module.exports = { redis, connectRedis };