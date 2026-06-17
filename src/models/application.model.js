// Mongoose helps Node.js communicate with MongoDB easily.
const mongoose = require('mongoose');

const applicationSchema = new mongoose.Schema({
    candidate: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    job: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Job',
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'accepted', 'rejected'],
        default: 'pending'
    },
    appliedAt: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

// model is a JavaScript object created by Mongoose to interact with a collection.
const applicationModel = mongoose.model('Application', applicationSchema);
module.exports = applicationModel;
