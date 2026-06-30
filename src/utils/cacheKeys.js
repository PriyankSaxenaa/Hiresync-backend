const { redis, isRedisReady } = require('../config/redis');

// Centralised cache-key builders so the read side (middleware) and the write
// side (controllers invalidating stale data) always agree on the key shape.

const cacheKeys = {
    // list endpoint depends on query params (filters/pagination)
    jobsList: (query = {}) => {
        const { keyword = '', location = '', skills = '', page = 1, limit = 10 } = query;
        return `jobs:list:${keyword}|${location}|${skills}|${page}|${limit}`;
    },
    jobById: (id) => `jobs:item:${id}`,
    recommendedJobs: (userId) => `jobs:recommended:${userId}`,
    // feed is filtered per student (group membership), namespaced under college
    // so a new drive can invalidate every student's feed for that college at once
    campusDrives: (collegeId, userId) => `campus:drives:${collegeId}:${userId}`,
};

// delete every key matching the given glob patterns — used on writes.
// SCAN (not KEYS) so we never block Redis on a big keyspace.
async function invalidate(patterns = []) {
    if (!isRedisReady()) return;
    const list = Array.isArray(patterns) ? patterns : [patterns];

    for (const pattern of list) {
        let cursor = '0';
        do {
            // eslint-disable-next-line no-await-in-loop
            const [next, found] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
            cursor = next;
            if (found.length) {
                // eslint-disable-next-line no-await-in-loop
                await redis.del(...found);
            }
        } while (cursor !== '0');
    }
}

// convenience invalidators tied to specific write events
const invalidators = {
    jobs: () => invalidate(['jobs:list:*', 'jobs:recommended:*']),
    job: (id) => invalidate([`jobs:item:${id}`, 'jobs:list:*', 'jobs:recommended:*']),
    campusDrives: (collegeId) => invalidate([`campus:drives:${collegeId}:*`]),
};

module.exports = { cacheKeys, invalidate, invalidators };
