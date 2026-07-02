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

    body('targetType')
        .optional()
        .isIn(['studentGroup', 'placementGroup', 'all'])
        .withMessage('targetType must be studentGroup, placementGroup or all'),

    // required only when targeting a StudentGroup (the default mode)
    body('targetGroup')
        .if((value, { req }) => (req.body.targetType || 'studentGroup') === 'studentGroup')
        .notEmpty().withMessage('targetGroup is required when targetType is studentGroup')
        .isMongoId().withMessage('targetGroup must be a valid group id'),

    // required only when targeting PlacementGroups
    body('targetPlacementGroups')
        .if((value, { req }) => req.body.targetType === 'placementGroup')
        .isArray({ min: 1 }).withMessage('targetPlacementGroups must be a non-empty array when targetType is placementGroup'),
    body('targetPlacementGroups.*')
        .if((value, { req }) => req.body.targetType === 'placementGroup')
        .isMongoId().withMessage('Each targetPlacementGroups entry must be a valid group id'),

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