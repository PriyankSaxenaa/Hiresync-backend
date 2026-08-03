const mongoose = require('mongoose');

// Short-lived OTP records for email verification during registration
// AND for forgot-password. `purpose` keeps the two flows from colliding —
// e.g. a leftover unverified register-OTP can't accidentally be picked up
// by the forgot-password verify step, and vice versa.
// - `otp` is stored bcrypt-hashed, never in plain text.
// - `verified` flips true once the user enters the correct code.
// - `expiresAt` is pushed forward on successful verification, giving the
//   user a grace window to finish the rest of the flow (registration form /
//   password reset).
// - The TTL index below makes MongoDB auto-delete the document once
//   `expiresAt` passes — no cleanup cron job needed.
const otpSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        lowercase: true,
        trim: true
    },
    otp: {
        type: String,
        required: true
    },
    purpose: {
        type: String,
        enum: ['register', 'forgot-password'],
        default: 'register'
    },
    verified: {
        type: Boolean,
        default: false
    },
    expiresAt: {
        type: Date,
        required: true
    }
}, { timestamps: true });

otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const otpModel = mongoose.model('Otp', otpSchema);
module.exports = otpModel;