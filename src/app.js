const express = require('express');
const cookieParser = require('cookie-parser');
const authRoutes = require('./routes/auth.routes');
const jobRoutes = require('./routes/job.routes');
const applicationRoutes = require('./routes/application.routes');
const adminRoutes = require('./routes/admin.routes');
const resumeRoutes = require('./routes/resume.routes');
const { errorHandler } = require('./middlewares/errorHandler');

const app = express();
app.use(express.json());
app.use(cookieParser());

app.use('/api/auth', authRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/resume', resumeRoutes);

// keep this at the bottom — express identifies error handlers by the 4 args
app.use(errorHandler);

module.exports = app;
