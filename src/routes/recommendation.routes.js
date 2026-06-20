const express = require('express');
const router = express.Router();
const recommendationController = require('../controllers/recommendation.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const { asyncHandler } = require('../middlewares/errorHandler');

// Candidate
router.get('/jobs', authMiddleware.authCandidate, asyncHandler(recommendationController.getRecommendedJobs));

// Recruiter
router.get('/candidates/:jobId', authMiddleware.authRecruiter, asyncHandler(recommendationController.getRecommendedCandidates));

module.exports = router;
