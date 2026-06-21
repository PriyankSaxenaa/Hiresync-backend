const jwt = require('jsonwebtoken');

// only candidates get through
async function authCandidate(req, res, next) {
    const token = req.cookies.token;

    if (!token) {
        return res.status(401).json({
            message: 'Unauthorized'
        });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.role !== 'candidate') {
            return res.status(403).json({ message: 'Only candidates can perform this action' });
        }
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
}

// only recruiters get through
async function authRecruiter(req, res, next) {
    const token = req.cookies.token;

    if (!token) {
        return res.status(401).json({
            message: 'Unauthorized'
        });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.role !== 'recruiter') {
            return res.status(403).json({ message: 'Only recruiters can perform this action' });
        }
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
}

// only admins get through
async function authAdmin(req, res, next) {
    const token = req.cookies.token;

    if (!token) {
        return res.status(401).json({
            message: 'Unauthorized'
        });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.role !== 'admin') {
            return res.status(403).json({ message: 'Only admins can perform this action' });
        }
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
}

// any logged in user can pass (candidate, recruiter, admin)
async function authUser(req, res, next) {
    const token = req.cookies.token;

    if (!token) {
        return res.status(401).json({
            message: 'Unauthorized Access'
        });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (!['candidate', 'recruiter', 'admin', 'tpo'].includes(decoded.role)) {
            return res.status(403).json({ message: 'Unauthorized Access' });
        }
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ message: 'Unauthorized Access' });
    }
}

// only TPOs get through (they manage their college's students & drives)
async function authTPO(req, res, next) {
    const token = req.cookies.token;

    if (!token) {
        return res.status(401).json({
            message: 'Unauthorized'
        });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.role !== 'tpo') {
            return res.status(403).json({ message: 'Only TPOs can perform this action' });
        }
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
}

module.exports = { authCandidate, authRecruiter, authAdmin, authUser, authTPO };
