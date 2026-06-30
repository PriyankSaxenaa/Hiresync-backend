const Redis = require('ioredis');

// Redis is OPTIONAL here. The app must keep working even if Redis is down —
// caching just turns into a no-op (every request becomes a cache miss).
//
// lazyConnect: true   → no socket is opened on require(), so importing this file
//                       never blocks or throws (keeps smoke-testing safe).
// We connect explicitly from server.js at boot.

const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

const redis = new Redis(redisUrl, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,   // fail fast instead of buffering when down
    retryStrategy(times) {
        // back off, but give up after a handful of tries so we don't spam logs
        if (times > 5) return null;
        return Math.min(times * 200, 2000);
    }
});

let ready = false;

redis.on('ready', () => {
    ready = true;
    console.log('Redis connected — caching enabled');
});

redis.on('end', () => { ready = false; });

redis.on('error', (err) => {
    // only log the first time it goes down, then stay quiet
    if (ready) console.error('Redis error:', err.message);
    ready = false;
});

// call once at startup; never throws — a missing Redis must not crash the API
async function connectRedis() {
    try {
        await redis.connect();
    } catch (err) {
        console.warn(`Redis unavailable (${err.message}) — running without cache`);
    }
}

function isRedisReady() {
    return ready && redis.status === 'ready';
}

module.exports = { redis, connectRedis, isRedisReady };
