// wrap any async controller with this so unhandled errors
// dont just crash the request silently
function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

// express knows this is an error handler because it has 4 args
// always keep it at the bottom of app.js
function errorHandler(err, req, res, next) {
    console.error(err.stack);

    // multer file errors (wrong type, too big etc)
    if (err.name === 'MulterError' || err.message === 'Only PDF files are allowed') {
        return res.status(400).json({ message: err.message });
    }

    // mongoose validation errors
    if (err.name === 'ValidationError') {
        const messages = Object.values(err.errors).map(e => e.message);
        return res.status(400).json({ message: messages.join(', ') });
    }

    // mongoose duplicate key (e.g. email already exists)
    if (err.code === 11000) {
        const field = Object.keys(err.keyValue)[0];
        return res.status(409).json({ message: `${field} already exists` });
    }

    // jwt errors
    if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({ message: 'Invalid token' });
    }

    // fallback
    res.status(err.status || 500).json({
        message: err.message || 'Internal server error'
    });
}

module.exports = { asyncHandler, errorHandler };
