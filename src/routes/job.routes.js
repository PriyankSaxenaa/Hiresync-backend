const express = require('express');
const jobController = require('../controllers/job.controller');
const candidateController = require('../controllers/candidate.controller');
const router = express.Router();
const authMiddleware = require('../middlewares/auth.middleware');

// Candidate-only
router.get('/profile', authMiddleware.authCandidate, candidateController.getProfile);
router.put('/profile', authMiddleware.authCandidate, candidateController.updateProfile);

// Public (any logged-in user)
router.get('/', authMiddleware.authUser, jobController.getAllJobs);
router.get('/:id', authMiddleware.authUser, jobController.getJobById);

// Recruiter-only
router.post('/', authMiddleware.authRecruiter, jobController.createJob);
router.put('/:id', authMiddleware.authRecruiter, jobController.updateJob);
router.delete('/:id', authMiddleware.authRecruiter, jobController.deleteJob);
router.get('/recruiter/my-jobs', authMiddleware.authRecruiter, jobController.getMyJobs);

module.exports = router;
