const { redis, isRedisReady } = require('../config/redis');

// cache(keyBuilder, ttlSeconds)
//
// Transparent read-through cache for GET routes:
//   - HIT  → respond immediately from Redis
//   - MISS → let the controller run, then store whatever it res.json()s
//
// keyBuilder(req) returns the cache key (uses utils/cacheKeys builders).
// Degrades to a plain pass-through whenever Redis isn't ready, so the API
// works identically with or without Redis running.
function cache(keyBuilder, ttlSeconds = 60) {
    return async function cacheMiddleware(req, res, next) {
        if (!isRedisReady()) return next();

        let key;
        try {
            key = keyBuilder(req);
        } catch (_) {
            return next(); // bad key builder — don't break the request
        }

        try {
            const cached = await redis.get(key);
            if (cached) {
                res.set('X-Cache', 'HIT');
                return res.status(200).json(JSON.parse(cached));
            }
        } catch (_) {
            return next(); // redis blip — fall through to the controller
        }

        // MISS — wrap res.json so the controller's payload gets stored on the way out
        res.set('X-Cache', 'MISS');
        const originalJson = res.json.bind(res);
        res.json = (body) => {
            // only cache successful responses
            if (res.statusCode >= 200 && res.statusCode < 300) {
                redis.set(key, JSON.stringify(body), 'EX', ttlSeconds).catch(() => {});
            }
            return originalJson(body);
        };

        next();
    };
}

module.exports = { cache };
