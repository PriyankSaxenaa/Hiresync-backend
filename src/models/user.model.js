const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true,
    },
    role: {
        type: String,
        enum: ['candidate', 'recruiter', 'admin', 'tpo'],
        default: 'candidate'
    },
    profilePhoto: {
        type: String,
        default: ''
    },

    // ── On-campus fields (set when a TPO imports the student via Excel) ────────────
    // null / empty for off-campus / self-registered candidates
    college: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'College',
        default: null
    },
    rollNo: {
        type: String,        // unique per college, comes from the sheet — locked
        default: ''
    },
    branch: {
        type: String,        // from the sheet — locked
        default: ''
    },
    cgpa: {
        type: Number,        // from the sheet — locked
        default: null
    },
    isImported: {
        type: Boolean,       // true if added through an Excel import
        default: false
    },
    profileComplete: {
        type: Boolean,       // flips true once resume + skills are present
        default: false
    },
    resumeUrl: {
        type: String,
        default: ''
    },
    skills: {
        type: [String],
        default: []
    },
    location: {
        type: String,
        default: ''
    },
    savedJobs: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Job'
    }]
}, { timestamps: true });

// model is a JavaScript object created by Mongoose to interact with a collection.
const userModel = mongoose.model('User', userSchema);
module.exports = userModel;
