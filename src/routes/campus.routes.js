const express = require('express');
const router = express.Router();
const campusController = require('../controllers/campus.controller');
const { asyncHandler } = require('../middlewares/errorHandler');
const authMiddleware = require('../middlewares/auth.middleware');
const { cache } = require('../middlewares/cache.middleware');
const { cacheKeys } = require('../utils/cacheKeys');

// all campus routes are for logged-in candidates
router.use(authMiddleware.authCandidate);

// feed of this candidate's eligible drives — cached per college+user (60s)
router.get(
    '/drives',
    cache((req) => cacheKeys.campusDrives(req.user.college, req.user.id), 60),
    asyncHandler(campusController.getCampusDrives)
);

router.get('/drives/:id', asyncHandler(campusController.getCampusDriveById));
router.post('/drives/:id/respond', asyncHandler(campusController.respondToDrive));

// update resume + skills only (other fields are locked)
router.put('/profile', asyncHandler(campusController.updateCampusProfile));

module.exports = router;
