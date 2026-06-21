const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

// We keep the io instance in module scope so controllers can grab it via getIO()
// without threading it through every function call.
let io = null;

// pull the JWT out of either the auth handshake or the cookie header
function extractToken(socket) {
    // 1) client passed it explicitly: io(url, { auth: { token } })
    if (socket.handshake.auth && socket.handshake.auth.token) {
        return socket.handshake.auth.token;
    }
    // 2) fall back to the http-only cookie set at login
    const rawCookie = socket.handshake.headers.cookie;
    if (rawCookie) {
        const match = rawCookie.split(';').map(c => c.trim()).find(c => c.startsWith('token='));
        if (match) return decodeURIComponent(match.split('=')[1]);
    }
    return null;
}

function initSocket(server) {
    io = new Server(server, {
        cors: {
            origin: process.env.CLIENT_URL || '*',
            credentials: true
        }
    });

    // authenticate every socket — same JWT the REST API uses
    io.use((socket, next) => {
        try {
            const token = extractToken(socket);
            if (!token) return next(new Error('Unauthorized'));
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            socket.user = decoded; // { id, role }
            next();
        } catch (err) {
            next(new Error('Unauthorized'));
        }
    });

    io.on('connection', (socket) => {
        const { id, role, college } = socket.user;

        // personal room — direct notifications (application status, confirmations)
        socket.join(`user:${id}`);

        // college room — drive announcements broadcast to a whole campus
        if (college) socket.join(`college:${college}`);

        // let a client explicitly join its college room after login if the
        // college wasn't in the token (e.g. linked after import)
        socket.on('join:college', (collegeId) => {
            if (collegeId) socket.join(`college:${collegeId}`);
        });

        console.log(`Socket connected: ${role} ${id}`);

        socket.on('disconnect', () => {
            // nothing to clean up — rooms drop automatically
        });
    });

    return io;
}

function getIO() {
    return io; // may be null if sockets weren't initialised (e.g. in tests)
}

// ── Emit helpers (safe to call even if io isn't up yet) ─────────────────────────
function emitToUser(userId, event, payload) {
    if (io && userId) io.to(`user:${userId}`).emit(event, payload);
}

function emitToCollege(collegeId, event, payload) {
    if (io && collegeId) io.to(`college:${collegeId}`).emit(event, payload);
}

module.exports = { initSocket, getIO, emitToUser, emitToCollege };
