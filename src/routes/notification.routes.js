const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notification.controller');
const { asyncHandler } = require('../middlewares/errorHandler');
const authMiddleware = require('../middlewares/auth.middleware');

// any logged-in user has a notification inbox
router.get('/', authMiddleware.authUser, asyncHandler(notificationController.getNotifications));
router.put('/read', authMiddleware.authUser, asyncHandler(notificationController.markRead));

module.exports = router;
