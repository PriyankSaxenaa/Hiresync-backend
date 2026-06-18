const express = require('express');
const applicationController = require('../controllers/application.controller');
const { asyncHandler } = require('../middlewares/errorHandler');
const router = express.Router();
const authMiddleware = require('../middlewares/auth.middleware');

// Candidate
router.post('/apply/:jobId', authMiddleware.authCandidate, asyncHandler(applicationController.applyToJob));
router.delete('/withdraw/:applicationId', authMiddleware.authCandidate, asyncHandler(applicationController.withdrawApplication));
router.get('/my-applications', authMiddleware.authCandidate, asyncHandler(applicationController.getAppliedJobs));
router.post('/save/:jobId', authMiddleware.authCandidate, asyncHandler(applicationController.saveJob));
router.get('/saved-jobs', authMiddleware.authCandidate, asyncHandler(applicationController.getSavedJobs));

// Recruiter
router.get('/job/:jobId/applicants', authMiddleware.authRecruiter, asyncHandler(applicationController.getApplicantsForJob));
router.put('/:applicationId/status', authMiddleware.authRecruiter, asyncHandler(applicationController.updateApplicationStatus));

module.exports = router;
