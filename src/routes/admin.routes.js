const express = require('express');
const adminController = require('../controllers/admin.controller');
const router = express.Router();
const authMiddleware = require('../middlewares/auth.middleware');

router.get('/users', authMiddleware.authAdmin, adminController.getAllUsers);
router.delete('/users/:id', authMiddleware.authAdmin, adminController.deleteUser);
router.get('/jobs', authMiddleware.authAdmin, adminController.getAllJobsAdmin);

module.exports = router;
