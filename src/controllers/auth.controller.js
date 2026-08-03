const crypto = require('crypto');
const userModel = require('../models/user.model');
const otpModel = require('../models/otp.model');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { sendEmail } = require('../utils/sendEmail');

const OTP_TTL_MINUTES = 10;          // how long an unverified OTP is valid
const OTP_GRACE_MINUTES = 15;        // window to finish registration/reset after verifying
const RESEND_COOLDOWN_SECONDS = 60;  // minimum gap between OTP requests for the same email

function generateOtp() {
    // 6-digit numeric code, 100000–999999
    return crypto.randomInt(100000, 1000000).toString();
}

// ── Step 1: send a one-time code to the email (registration) ───────────────
async function sendOtp(req, res) {
    const email = String(req.body.email || '').trim().toLowerCase();

    if (!email) {
        return res.status(400).json({ message: 'Email is required' });
    }

    const existingUser = await userModel.findOne({ email });
    if (existingUser) {
        return res.status(409).json({ message: 'This email is already registered. Please log in instead.' });
    }

    // throttle: block rapid repeat requests for the same email (register purpose only)
    const recent = await otpModel.findOne({ email, purpose: 'register' }).sort({ createdAt: -1 });
    if (recent) {
        const secondsSinceLast = (Date.now() - recent.createdAt.getTime()) / 1000;
        if (secondsSinceLast < RESEND_COOLDOWN_SECONDS) {
            const wait = Math.ceil(RESEND_COOLDOWN_SECONDS - secondsSinceLast);
            return res.status(429).json({ message: `Please wait ${wait}s before requesting another OTP.` });
        }
    }

    // clear out any previous (unverified) register-codes for this email before issuing a new one
    await otpModel.deleteMany({ email, purpose: 'register', verified: false });

    const otp = generateOtp();
    const hashedOtp = await bcrypt.hash(otp, 10);

    await otpModel.create({
        email,
        otp: hashedOtp,
        purpose: 'register',
        expiresAt: new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000)
    });

    try {
        await sendEmail({
            to: email,
            subject: 'Your HireSync verification code',
            html: `
                <p>Hi,</p>
                <p>Your HireSync verification code is:</p>
                <h2 style="letter-spacing:4px;">${otp}</h2>
                <p>This code expires in ${OTP_TTL_MINUTES} minutes. If you didn't request this, you can ignore this email.</p>
            `
        });
    } catch (err) {
        // email failed to send — don't leave a dangling OTP record the user
        // can never verify, and surface a real message instead of a bare 500
        await otpModel.deleteMany({ email, purpose: 'register', verified: false });
        console.error('sendOtp email failed:', err.message);
        return res.status(502).json({ message: 'Could not send the verification email right now. Please try again in a moment.' });
    }

    res.status(200).json({ message: 'OTP sent to your email' });
}

// ── Step 2: verify the code (registration) ──────────────────────────────────
async function verifyOtp(req, res) {
    const email = String(req.body.email || '').trim().toLowerCase();
    const { otp } = req.body;

    if (!email || !otp) {
        return res.status(400).json({ message: 'Email and OTP are required' });
    }

    const record = await otpModel.findOne({ email, purpose: 'register', verified: false }).sort({ createdAt: -1 });
    if (!record) {
        return res.status(400).json({ message: 'No pending OTP found for this email. Please request a new one.' });
    }

    if (record.expiresAt.getTime() < Date.now()) {
        return res.status(400).json({ message: 'OTP has expired. Please request a new one.' });
    }

    const isMatch = await bcrypt.compare(String(otp), record.otp);
    if (!isMatch) {
        return res.status(400).json({ message: 'Incorrect OTP. Please try again.' });
    }

    // mark verified and extend the window so the user has time to fill the rest of the form
    record.verified = true;
    record.expiresAt = new Date(Date.now() + OTP_GRACE_MINUTES * 60 * 1000);
    await record.save();

    res.status(200).json({ message: 'Email verified successfully' });
}

// ── Registration — requires a verified register-OTP for this email ─────────
async function registerUser(req, res) {
    const { name, email: rawEmail, password, role = 'candidate' } = req.body;
    const email = String(rawEmail || '').trim().toLowerCase();

    const verifiedOtp = await otpModel.findOne({
        email,
        purpose: 'register',
        verified: true,
        expiresAt: { $gt: new Date() }
    });

    if (!verifiedOtp) {
        return res.status(400).json({ message: 'Please verify your email with the OTP sent to it before registering.' });
    }

    const isUserAlreadyExist = await userModel.findOne({ email });
    if (isUserAlreadyExist) {
        return res.status(409).json({ message: 'Email already exists' });
    }

    const hash = await bcrypt.hash(password, 10);
    const user = await userModel.create({
        name,
        email,
        password: hash,
        role
    });

    // cleanup — this email is now a real account, the OTP record has served its purpose
    await otpModel.deleteMany({ email, purpose: 'register' });

    const token = jwt.sign({
        id: user._id,
        role: user.role,
        college: user.college || null,
    }, process.env.JWT_SECRET);

    res.cookie('token', token, {
        httpOnly: true,
        secure: true,
        sameSite: 'none'
    });
    res.status(201).json({
        message: 'User registered successfully',
        user: {
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role
        }
    });
}

async function loginUser(req, res) {
    const { email, password } = req.body;

    const user = await userModel.findOne({ email });

    if (!user) {
        return res.status(401).json({
            message: 'Invalid credentials'
        });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
        return res.status(401).json({
            message: 'Incorrect password, try again!'
        });
    }

    const token = jwt.sign({
        id: user._id,
        role: user.role,
        college: user.college || null,
    }, process.env.JWT_SECRET);

    res.cookie('token', token, {
        httpOnly: true,
        secure: true,
        sameSite: 'none'
    });

    res.status(200).json({
        message: 'User logged in successfully',
        user: {
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role
        }
    });
}

async function logoutUser(req, res) {
    res.clearCookie('token', {
        httpOnly: true,
        secure: true,
        sameSite: 'none'
    });
    res.status(200).json({
        message: 'User logged out successfully'
    });
}

// ── Forgot password — Step 1: send OTP to an EXISTING account's email ──────
async function sendForgotPasswordOtp(req, res) {
    const email = String(req.body.email || '').trim().toLowerCase();

    if (!email) {
        return res.status(400).json({ message: 'Email is required' });
    }

    // opposite check from register: here the account MUST already exist
    const existingUser = await userModel.findOne({ email });
    if (!existingUser) {
        return res.status(404).json({ message: 'No account found with this email' });
    }

    // throttle: block rapid repeat requests for the same email (forgot-password purpose only)
    const recent = await otpModel.findOne({ email, purpose: 'forgot-password' }).sort({ createdAt: -1 });
    if (recent) {
        const secondsSinceLast = (Date.now() - recent.createdAt.getTime()) / 1000;
        if (secondsSinceLast < RESEND_COOLDOWN_SECONDS) {
            const wait = Math.ceil(RESEND_COOLDOWN_SECONDS - secondsSinceLast);
            return res.status(429).json({ message: `Please wait ${wait}s before requesting another OTP.` });
        }
    }

    // clear out any previous (unverified) forgot-password codes for this email
    await otpModel.deleteMany({ email, purpose: 'forgot-password', verified: false });

    const otp = generateOtp();
    const hashedOtp = await bcrypt.hash(otp, 10);

    await otpModel.create({
        email,
        otp: hashedOtp,
        purpose: 'forgot-password',
        expiresAt: new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000)
    });

    try {
        await sendEmail({
            to: email,
            subject: 'Your HireSync password reset code',
            html: `
                <p>Hi ${existingUser.name},</p>
                <p>Your HireSync password reset code is:</p>
                <h2 style="letter-spacing:4px;">${otp}</h2>
                <p>This code expires in ${OTP_TTL_MINUTES} minutes. If you didn't request this, you can safely ignore this email — your password will not be changed.</p>
            `
        });
    } catch (err) {
        // email failed to send — don't leave a dangling OTP record the user
        // can never verify, and surface a real message instead of a bare 500
        await otpModel.deleteMany({ email, purpose: 'forgot-password', verified: false });
        console.error('sendForgotPasswordOtp email failed:', err.message);
        return res.status(502).json({ message: 'Could not send the reset email right now. Please try again in a moment.' });
    }

    res.status(200).json({ message: 'Password reset OTP sent to your email' });
}

// ── Forgot password — Step 2: verify the code ───────────────────────────────
async function verifyForgotPasswordOtp(req, res) {
    const email = String(req.body.email || '').trim().toLowerCase();
    const { otp } = req.body;

    if (!email || !otp) {
        return res.status(400).json({ message: 'Email and OTP are required' });
    }

    const record = await otpModel.findOne({ email, purpose: 'forgot-password', verified: false }).sort({ createdAt: -1 });
    if (!record) {
        return res.status(400).json({ message: 'No pending OTP found for this email. Please request a new one.' });
    }

    if (record.expiresAt.getTime() < Date.now()) {
        return res.status(400).json({ message: 'OTP has expired. Please request a new one.' });
    }

    const isMatch = await bcrypt.compare(String(otp), record.otp);
    if (!isMatch) {
        return res.status(400).json({ message: 'Incorrect OTP. Please try again.' });
    }

    // mark verified and extend the window so the user has time to submit the new password
    record.verified = true;
    record.expiresAt = new Date(Date.now() + OTP_GRACE_MINUTES * 60 * 1000);
    await record.save();

    res.status(200).json({ message: 'OTP verified. You can now set a new password.' });
}

// ── Forgot password — Step 3: set the new password ──────────────────────────
async function resetPassword(req, res) {
    const email = String(req.body.email || '').trim().toLowerCase();
    const { newPassword } = req.body;

    if (!email || !newPassword) {
        return res.status(400).json({ message: 'Email and new password are required' });
    }

    // requires a verified, still-valid forgot-password OTP — same gate pattern as registerUser
    const verifiedOtp = await otpModel.findOne({
        email,
        purpose: 'forgot-password',
        verified: true,
        expiresAt: { $gt: new Date() }
    });

    if (!verifiedOtp) {
        return res.status(400).json({ message: 'Please verify your email with the OTP before resetting your password.' });
    }

    const user = await userModel.findOne({ email });
    if (!user) {
        return res.status(404).json({ message: 'No account found with this email' });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    // this OTP has served its purpose — burn it so it can't be reused
    await otpModel.deleteMany({ email, purpose: 'forgot-password' });

    res.status(200).json({ message: 'Password reset successfully. Please log in with your new password.' });
}

module.exports = {
    registerUser,
    loginUser,
    logoutUser,
    sendOtp,
    verifyOtp,
    sendForgotPasswordOtp,
    verifyForgotPasswordOtp,
    resetPassword
};