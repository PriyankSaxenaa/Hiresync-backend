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
        enum: ['candidate', 'recruiter', 'admin'],
        default: 'candidate'
    },
    profilePhoto: {
        type: String,
        default: ''
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
