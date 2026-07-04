const { body, param } = require('express-validator');

const createPlacementGroupValidator = [
    body('name')
        .trim()
        .notEmpty().withMessage('Group name is required')
        .isLength({ min: 2 }).withMessage('Group name must be at least 2 characters'),

    body('description')
        .optional()
        .trim(),
];

const updatePlacementGroupValidator = [
    body('name')
        .optional()
        .trim()
        .isLength({ min: 2 }).withMessage('Group name must be at least 2 characters'),

    body('description')
        .optional()
        .trim(),
];

const groupIdParamValidator = [
    param('id').isMongoId().withMessage('Invalid group id'),
];

const assignStudentValidator = [
    param('id').isMongoId().withMessage('Invalid group id'),

    body('studentId')
        .notEmpty().withMessage('studentId is required')
        .isMongoId().withMessage('Invalid student id'),
];

const removeStudentValidator = [
    param('id').isMongoId().withMessage('Invalid group id'),
    param('studentId').isMongoId().withMessage('Invalid student id'),
];

const moveStudentValidator = [
    body('studentId')
        .notEmpty().withMessage('studentId is required')
        .isMongoId().withMessage('Invalid student id'),

    body('toGroupId')
        .notEmpty().withMessage('toGroupId is required')
        .isMongoId().withMessage('Invalid target group id'),
];

const bulkAssignValidator = [
    param('id').isMongoId().withMessage('Invalid group id'),

    body('studentIds')
        .isArray({ min: 1 }).withMessage('studentIds must be a non-empty array'),

    body('studentIds.*')
        .isMongoId().withMessage('Each studentId must be a valid id'),
];

const bulkRemoveValidator = [
    body('studentIds')
        .isArray({ min: 1 }).withMessage('studentIds must be a non-empty array'),

    body('studentIds.*')
        .isMongoId().withMessage('Each studentId must be a valid id'),
];

module.exports = {
    createPlacementGroupValidator,
    updatePlacementGroupValidator,
    groupIdParamValidator,
    assignStudentValidator,
    removeStudentValidator,
    moveStudentValidator,
    bulkAssignValidator,
    bulkRemoveValidator
};