const express = require('express');
const jobController = require('../controllers/job.controller');
const router = express.Router();
const authMiddleware = require('../middlewares/auth.middleware');

// public (any logged in user)
router.get('/', authMiddleware.authUser, jobController.getAllJobs);
router.get('/:id', authMiddleware.authUser, jobController.getJobById);

// recruiter only
router.post('/', authMiddleware.authRecruiter, jobController.createJob);
router.put('/:id', authMiddleware.authRecruiter, jobController.updateJob);
router.delete('/:id', authMiddleware.authRecruiter, jobController.deleteJob);
router.get('/recruiter/my-jobs', authMiddleware.authRecruiter, jobController.getMyJobs);

// candidate profile routes will go here later

module.exports = router;
