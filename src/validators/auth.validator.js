const { body } = require('express-validator');

const registerValidator = [
    body('name')
        .trim()
        .notEmpty().withMessage('Name is required')
        .isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),

    body('email')
        .trim()
        .notEmpty().withMessage('Email is required')
        .isEmail().withMessage('Enter a valid email'),

    body('password')
        .notEmpty().withMessage('Password is required')
        .isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),

    body('role')
        .optional()
        .isIn(['candidate', 'recruiter', 'tpo']).withMessage('Role must be candidate, recruiter or tpo'),
];

const loginValidator = [
    body('email')
        .trim()
        .notEmpty().withMessage('Email is required')
        .isEmail().withMessage('Enter a valid email'),

    body('password')
        .notEmpty().withMessage('Password is required'),
];

const sendOtpValidator = [
    body('email')
        .trim()
        .notEmpty().withMessage('Email is required')
        .isEmail().withMessage('Enter a valid email'),
];

const verifyOtpValidator = [
    body('email')
        .trim()
        .notEmpty().withMessage('Email is required')
        .isEmail().withMessage('Enter a valid email'),

    body('otp')
        .trim()
        .notEmpty().withMessage('OTP is required')
        .isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits')
        .isNumeric().withMessage('OTP must contain only numbers'),
];

module.exports = { registerValidator, loginValidator, sendOtpValidator, verifyOtpValidator };