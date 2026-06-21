const express = require('express');
const router = express.Router();
const campusController = require('../controllers/campus.controller');
const { asyncHandler } = require('../middlewares/errorHandler');
const authMiddleware = require('../middlewares/auth.middleware');

// all campus routes are for logged-in candidates
router.use(authMiddleware.authCandidate);

router.post('/drives/:id/respond', asyncHandler(campusController.respondToDrive));

module.exports = router;
