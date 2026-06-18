const express = require('express');
const applicationController = require('../controllers/application.controller');
const router = express.Router();
const authMiddleware = require('../middlewares/auth.middleware');

// Candidate
router.post('/apply/:jobId', authMiddleware.authCandidate, applicationController.applyToJob);
router.delete('/withdraw/:applicationId', authMiddleware.authCandidate, applicationController.withdrawApplication);
router.get('/my-applications', authMiddleware.authCandidate, applicationController.getAppliedJobs);
router.post('/save/:jobId', authMiddleware.authCandidate, applicationController.saveJob);
router.get('/saved-jobs', authMiddleware.authCandidate, applicationController.getSavedJobs);

// Recruiter
router.get('/job/:jobId/applicants', authMiddleware.authRecruiter, applicationController.getApplicantsForJob);
router.put('/:applicationId/status', authMiddleware.authRecruiter, applicationController.updateApplicationStatus);

module.exports = router;
