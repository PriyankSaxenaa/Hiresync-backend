const express = require('express');
const router = express.Router();
const collegeController = require('../controllers/college.controller');
const { registerCollegeValidator } = require('../validators/college.validator');
const validate = require('../middlewares/validate');
const { asyncHandler } = require('../middlewares/errorHandler');
const authMiddleware = require('../middlewares/auth.middleware');

// TPO registers their college (starts unverified)
router.post('/register', authMiddleware.authTPO, registerCollegeValidator, validate, asyncHandler(collegeController.registerCollege));

// Admin
router.get('/', authMiddleware.authAdmin, asyncHandler(collegeController.getAllColleges));
router.put('/:id/verify', authMiddleware.authAdmin, asyncHandler(collegeController.verifyCollege));

// Any logged-in user can view a college's details
router.get('/:id', authMiddleware.authUser, asyncHandler(collegeController.getCollegeById));

module.exports = router;
