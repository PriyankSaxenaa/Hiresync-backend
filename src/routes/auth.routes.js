const express = require('express');
const authController = require('../controllers/auth.controller');
const { asyncHandler } = require('../middlewares/errorHandler');
const router = express.Router();

router.post('/register', asyncHandler(authController.registerUser));
router.post('/login', asyncHandler(authController.loginUser));
router.post('/logout', asyncHandler(authController.logoutUser));

module.exports = router;
