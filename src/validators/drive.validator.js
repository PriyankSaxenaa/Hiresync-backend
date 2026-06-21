const { body } = require('express-validator');

const createDriveValidator = [
    body('company')
        .trim()
        .notEmpty().withMessage('Company name is required'),

    body('title')
        .trim()
        .notEmpty().withMessage('Drive title is required'),

    body('description')
        .optional()
        .trim(),

    body('jd')
        .optional()
        .trim(),

    body('targetGroup')
        .notEmpty().withMessage('Target group is required')
        .isMongoId().withMessage('targetGroup must be a valid group id'),

    body('deadline')
        .notEmpty().withMessage('Deadline is required')
        .isISO8601().withMessage('Deadline must be a valid date'),
];

const createGroupValidator = [
    body('name')
        .trim()
        .notEmpty().withMessage('Group name is required'),

    body('filters')
        .optional()
        .isObject().withMessage('filters must be an object'),
];

module.exports = { createDriveValidator, createGroupValidator };
