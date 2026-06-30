const express = require('express');
const cookieParser = require('cookie-parser');
const authRoutes = require('./routes/auth.routes');
const jobRoutes = require('./routes/job.routes');
const applicationRoutes = require('./routes/application.routes');
const adminRoutes = require('./routes/admin.routes');
const resumeRoutes = require('./routes/resume.routes');
const recommendationRoutes = require('./routes/recommendation.routes');
const collegeRoutes = require('./routes/college.routes');
const tpoRoutes = require('./routes/tpo.routes');
const campusRoutes = require('./routes/campus.routes');
const notificationRoutes = require('./routes/notification.routes');
const analyticsRoutes = require('./routes/analytics.routes');
const { errorHandler } = require('./middlewares/errorHandler');

const app = express();
app.use(express.json());
app.use(cookieParser());

// simple health check
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// ── Off-campus (existing) ───────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/resume', resumeRoutes);
app.use('/api/recommendations', recommendationRoutes);

// ── On-campus + platform ────────────────────────────────────────────────────────
app.use('/api/college', collegeRoutes);
app.use('/api/tpo', tpoRoutes);
app.use('/api/campus', campusRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/analytics', analyticsRoutes);

// keep this at the bottom — express identifies error handlers by the 4 args
app.use(errorHandler);

module.exports = app;
