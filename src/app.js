const express = require('express');
const cookieParser = require('cookie-parser');
const authRoutes = require('./routes/auth.routes');
const jobRoutes = require('./routes/job.routes');

const app = express();

app.use(express.json());
app.use(cookieParser());

app.use('/api/auth', authRoutes);
app.use('/api/jobs', jobRoutes);

// more routes coming later
// app.use('/api/applications', applicationRoutes);

module.exports = app;
