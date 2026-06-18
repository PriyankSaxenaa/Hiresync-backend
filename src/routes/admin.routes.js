const express = require('express');
const jobController = require('../controllers/job.controller');
const candidateController = require('../controllers/candidate.controller');
const { asyncHandler } = require('../middlewares/errorHandler');
const router = express.Router();
const authMiddleware = require('../middlewares/auth.middleware');

// Candidate profile
router.get('/profile', authMiddleware.authCandidate, asyncHandler(candidateController.getProfile));
router.put('/profile', authMiddleware.authCandidate, asyncHandler(candidateController.updateProfile));

// Public (any logged-in user)
router.get('/', authMiddleware.authUser, asyncHandler(jobController.getAllJobs));
router.get('/:id', authMiddleware.authUser, asyncHandler(jobController.getJobById));

// Recruiter
router.post('/', authMiddleware.authRecruiter, asyncHandler(jobController.createJob));
router.put('/:id', authMiddleware.authRecruiter, asyncHandler(jobController.updateJob));
router.delete('/:id', authMiddleware.authRecruiter, asyncHandler(jobController.deleteJob));
router.get('/recruiter/my-jobs', authMiddleware.authRecruiter, asyncHandler(jobController.getMyJobs));

module.exports = router;
