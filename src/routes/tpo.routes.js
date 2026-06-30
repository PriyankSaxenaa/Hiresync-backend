const express = require('express');
const router = express.Router();
const tpoController = require('../controllers/tpo.controller');
const { createDriveValidator, createGroupValidator } = require('../validators/drive.validator');
const validate = require('../middlewares/validate');
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

// ── Student groups ──────────────────────────────────────────────────────────────
router.post('/groups', createGroupValidator, validate, asyncHandler(tpoController.createGroup));
router.get('/groups', asyncHandler(tpoController.getGroups));
router.get('/groups/:id', asyncHandler(tpoController.getGroupById));
router.put('/groups/:id', asyncHandler(tpoController.updateGroup));

// ── Campus drives ───────────────────────────────────────────────────────────────
router.post('/drives', createDriveValidator, validate, asyncHandler(tpoController.createDrive));
router.get('/drives', asyncHandler(tpoController.getDrives));
router.get('/drives/:id', asyncHandler(tpoController.getDriveById));
router.put('/drives/:id', asyncHandler(tpoController.updateDrive));
router.put('/drives/:id/status', asyncHandler(tpoController.updateDriveStatus));
router.get('/drives/:id/report', asyncHandler(tpoController.downloadDriveReport));

// ── Analytics ───────────────────────────────────────────────────────────────────
router.get('/analytics', asyncHandler(tpoController.getTpoAnalytics));

module.exports = router;
