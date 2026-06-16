const express = require('express');
const cookieParser = require('cookie-parser');
const authRoutes = require('./routes/auth.routes');

const app = express();

app.use(express.json());
app.use(cookieParser());    //help to read cookies

app.use('/api/auth', authRoutes);

// more routes coming later
// app.use('/api/jobs', jobRoutes);

module.exports = app;
