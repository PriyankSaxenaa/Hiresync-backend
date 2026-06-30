const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const { asyncHandler } = require('../middlewares/errorHandler');
const authMiddleware = require('../middlewares/auth.middleware');

// every admin route requires an admin
router.use(authMiddleware.authAdmin);

router.get('/users', asyncHandler(adminController.getAllUsers));
router.delete('/users/:id', asyncHandler(adminController.deleteUser));
router.get('/jobs', asyncHandler(adminController.getAllJobsAdmin));

module.exports = router;
