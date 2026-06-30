const express = require('express');
const jobController = require('../controllers/job.controller');
const candidateController = require('../controllers/candidate.controller');
const recommendationController = require('../controllers/recommendation.controller');
const { createJobValidator } = require('../validators/job.validator');
const validate = require('../middlewares/validate');
const { asyncHandler } = require('../middlewares/errorHandler');
const router = express.Router();
const authMiddleware = require('../middlewares/auth.middleware');
const { cache } = require('../middlewares/cache.middleware');
const { cacheKeys } = require('../utils/cacheKeys');

// Candidate profile
router.get('/profile', authMiddleware.authCandidate, asyncHandler(candidateController.getProfile));
router.put('/profile', authMiddleware.authCandidate, asyncHandler(candidateController.updateProfile));

// Recommended jobs (candidate) — cached per user. MUST be declared before '/:id'
router.get(
    '/recommended',
    authMiddleware.authCandidate,
    cache((req) => cacheKeys.recommendedJobs(req.user.id), 120),
    asyncHandler(recommendationController.getRecommendedJobs)
);

// Public (any logged-in user) — cached
router.get(
    '/',
    authMiddleware.authUser,
    cache((req) => cacheKeys.jobsList(req.query), 60),
    asyncHandler(jobController.getAllJobs)
);
router.get(
    '/:id',
    authMiddleware.authUser,
    cache((req) => cacheKeys.jobById(req.params.id), 60),
    asyncHandler(jobController.getJobById)
);

// Recruiter
router.post('/', authMiddleware.authRecruiter, createJobValidator, validate, asyncHandler(jobController.createJob));
router.put('/:id', authMiddleware.authRecruiter, asyncHandler(jobController.updateJob));
router.delete('/:id', authMiddleware.authRecruiter, asyncHandler(jobController.deleteJob));
router.get('/recruiter/my-jobs', authMiddleware.authRecruiter, asyncHandler(jobController.getMyJobs));

module.exports = router;
