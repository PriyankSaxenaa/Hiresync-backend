const express = require('express');
const authController = require('../controllers/auth.controller');
const {
    registerValidator,
    loginValidator,
    sendOtpValidator,
    verifyOtpValidator,
    forgotPasswordSendOtpValidator,
    forgotPasswordVerifyOtpValidator,
    resetPasswordValidator
} = require('../validators/auth.validator');
const validate = require('../middlewares/validate');
const { asyncHandler } = require('../middlewares/errorHandler');
const router = express.Router();

router.post('/send-otp', sendOtpValidator, validate, asyncHandler(authController.sendOtp));
router.post('/verify-otp', verifyOtpValidator, validate, asyncHandler(authController.verifyOtp));

router.post('/register', registerValidator, validate, asyncHandler(authController.registerUser));
router.post('/login', loginValidator, validate, asyncHandler(authController.loginUser));
router.post('/logout', asyncHandler(authController.logoutUser));

// ── Forgot password (3-step, mirrors register's OTP flow) ──────────────────
router.post('/forgot-password/send-otp', forgotPasswordSendOtpValidator, validate, asyncHandler(authController.sendForgotPasswordOtp));
router.post('/forgot-password/verify-otp', forgotPasswordVerifyOtpValidator, validate, asyncHandler(authController.verifyForgotPasswordOtp));
router.post('/forgot-password/reset', resetPasswordValidator, validate, asyncHandler(authController.resetPassword));

module.exports = router;