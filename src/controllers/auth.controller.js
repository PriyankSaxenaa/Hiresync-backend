const crypto = require('crypto');
const userModel = require('../models/user.model');
const otpModel = require('../models/otp.model');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { sendEmail } = require('../utils/sendEmail');

const OTP_TTL_MINUTES = 10;          // how long an unverified OTP is valid
const OTP_GRACE_MINUTES = 15;        // window to finish registration after verifying
const RESEND_COOLDOWN_SECONDS = 60;  // minimum gap between OTP requests for the same email

function generateOtp() {
    // 6-digit numeric code, 100000–999999
    return crypto.randomInt(100000, 1000000).toString();
}

// ── Step 1: send a one-time code to the email ──────────────────────────────
async function sendOtp(req, res) {
    const email = String(req.body.email || '').trim().toLowerCase();

    if (!email) {
        return res.status(400).json({ message: 'Email is required' });
    }

    const existingUser = await userModel.findOne({ email });
    if (existingUser) {
        return res.status(409).json({ message: 'This email is already registered. Please log in instead.' });
    }

    // throttle: block rapid repeat requests for the same email
    const recent = await otpModel.findOne({ email }).sort({ createdAt: -1 });
    if (recent) {
        const secondsSinceLast = (Date.now() - recent.createdAt.getTime()) / 1000;
        if (secondsSinceLast < RESEND_COOLDOWN_SECONDS) {
            const wait = Math.ceil(RESEND_COOLDOWN_SECONDS - secondsSinceLast);
            return res.status(429).json({ message: `Please wait ${wait}s before requesting another OTP.` });
        }
    }

    // clear out any previous (unverified) codes for this email before issuing a new one
    await otpModel.deleteMany({ email, verified: false });

    const otp = generateOtp();
    const hashedOtp = await bcrypt.hash(otp, 10);

    await otpModel.create({
        email,
        otp: hashedOtp,
        expiresAt: new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000)
    });

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

    res.status(200).json({ message: 'OTP sent to your email' });
}

// ── Step 2: verify the code ─────────────────────────────────────────────────
async function verifyOtp(req, res) {
    const email = String(req.body.email || '').trim().toLowerCase();
    const { otp } = req.body;

    if (!email || !otp) {
        return res.status(400).json({ message: 'Email and OTP are required' });
    }

    const record = await otpModel.findOne({ email, verified: false }).sort({ createdAt: -1 });
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

// ── Registration — now requires a verified OTP for this email ──────────────
async function registerUser(req, res) {
    const { name, email: rawEmail, password, role = 'candidate' } = req.body;
    const email = String(rawEmail || '').trim().toLowerCase();

    const verifiedOtp = await otpModel.findOne({
        email,
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
    await otpModel.deleteMany({ email });

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

module.exports = { registerUser, loginUser, logoutUser, sendOtp, verifyOtp };