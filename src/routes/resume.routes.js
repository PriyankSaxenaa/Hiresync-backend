const express = require('express');
const router = express.Router();
const resumeController = require('../controllers/resume.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const upload = require('../config/multer');

// single file upload, field name is 'resume'
router.post('/upload', authMiddleware.authCandidate, upload.single('resume'), resumeController.uploadResume);

module.exports = router;
