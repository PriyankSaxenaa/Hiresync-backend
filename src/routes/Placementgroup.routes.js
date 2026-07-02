const express = require('express');
const router = express.Router();
const placementGroupController = require('../controllers/placementGroup.controller');
const {
    createPlacementGroupValidator,
    updatePlacementGroupValidator,
    groupIdParamValidator,
    assignStudentValidator,
    removeStudentValidator,
    moveStudentValidator,
    bulkAssignValidator,
    bulkRemoveValidator
} = require('../validators/placementGroup.validator');
const validate = require('../middlewares/validate');
const { asyncHandler } = require('../middlewares/errorHandler');
const authMiddleware = require('../middlewares/auth.middleware');

// Candidate: view own placement group — read-only, no TPO/college ownership
// involved, so this must be declared BEFORE the router-wide authTPO gate below.
router.get('/my-group', authMiddleware.authCandidate, asyncHandler(placementGroupController.getMyGroup));

// every other placement-group route requires a logged-in TPO
router.use(authMiddleware.authTPO);

// ── Group CRUD ────────────────────────────────────────────────────────────────
router.post('/', createPlacementGroupValidator, validate, asyncHandler(placementGroupController.createGroup));
router.get('/', asyncHandler(placementGroupController.getGroups));
router.get('/:id', groupIdParamValidator, validate, asyncHandler(placementGroupController.getGroupById));
router.put('/:id', groupIdParamValidator, updatePlacementGroupValidator, validate, asyncHandler(placementGroupController.updateGroup));
router.delete('/:id', groupIdParamValidator, validate, asyncHandler(placementGroupController.deleteGroup));

// ── Student assignment ──────────────────────────────────────────────────────
router.post('/:id/students', assignStudentValidator, validate, asyncHandler(placementGroupController.assignStudent));
router.delete('/:id/students/:studentId', removeStudentValidator, validate, asyncHandler(placementGroupController.removeStudent));
router.post('/:id/students/bulk', bulkAssignValidator, validate, asyncHandler(placementGroupController.bulkAssignStudents));
router.post('/students/bulk-remove', bulkRemoveValidator, validate, asyncHandler(placementGroupController.bulkRemoveStudents));
router.post('/move', moveStudentValidator, validate, asyncHandler(placementGroupController.moveStudent));

module.exports = router;