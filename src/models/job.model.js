const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
    },
    company: {
        type: String,
        required: true,
    },
    description: {
        type: String,
        required: true,
    },
    skillsRequired: {
        type: [String],
        default: []
    },
    location: {
        type: String,
        required: true,
    },
    salaryRange: {
        type: String,
        default: 'Not Disclosed'
    },
    // which recruiter posted this job
    recruiter: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    applicationDeadline: {
        type: Date,
        required: true,
    }
}, { timestamps: true });

// model is a JavaScript object created by Mongoose to interact with a collection.
const jobModel = mongoose.model('Job', jobSchema);
module.exports = jobModel;
