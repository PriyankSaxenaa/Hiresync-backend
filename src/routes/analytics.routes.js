const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analytics.controller');
const { asyncHandler } = require('../middlewares/errorHandler');
const authMiddleware = require('../middlewares/auth.middleware');

// recruiter hiring funnel
router.get('/dashboard', authMiddleware.authRecruiter, asyncHandler(analyticsController.recruiterDashboard));

module.exports = router;
