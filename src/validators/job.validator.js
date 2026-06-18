const { body } = require('express-validator');

const createJobValidator = [
    body('title')
        .trim()
        .notEmpty().withMessage('Job title is required'),

    body('company')
        .trim()
        .notEmpty().withMessage('Company name is required'),

    body('description')
        .trim()
        .notEmpty().withMessage('Job description is required')
        .isLength({ min: 20 }).withMessage('Description must be at least 20 characters'),

    body('location')
        .trim()
        .notEmpty().withMessage('Location is required'),

    body('skillsRequired')
        .isArray({ min: 1 }).withMessage('At least one skill is required'),

    body('applicationDeadline')
        .notEmpty().withMessage('Application deadline is required')
        .isISO8601().withMessage('Deadline must be a valid date'),
];

module.exports = { createJobValidator };
