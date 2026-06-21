const express = require('express');
const router = express.Router();
const tpoController = require('../controllers/tpo.controller');
const { asyncHandler } = require('../middlewares/errorHandler');
const authMiddleware = require('../middlewares/auth.middleware');
const upload = require('../config/multer');

// every TPO route requires a logged-in TPO
router.use(authMiddleware.authTPO);

// ── Student import ──────────────────────────────────────────────────────────────
// field name is 'file' — upload.excel accepts .xlsx/.xls/.csv
router.post('/import', upload.excel.single('file'), asyncHandler(tpoController.importStudents));
router.get('/students', asyncHandler(tpoController.getStudents));
router.get('/students/:id', asyncHandler(tpoController.getStudentById));

module.exports = router;
