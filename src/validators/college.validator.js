const { body } = require('express-validator');

const registerCollegeValidator = [
    body('name')
        .trim()
        .notEmpty().withMessage('College name is required')
        .isLength({ min: 2 }).withMessage('College name must be at least 2 characters'),

    body('address')
        .optional()
        .trim(),

    body('website')
        .optional({ values: 'falsy' })
        .trim()
        .isURL().withMessage('Website must be a valid URL'),
];

module.exports = { registerCollegeValidator };
