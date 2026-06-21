const mongoose = require('mongoose');

const studentGroupSchema = new mongoose.Schema({
    college: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'College',
        required: true
    },
    name: {
        type: String,
        required: true,        // e.g. "CSE 2025 Batch"
    },
    // the rules used to auto-populate the group
    filters: {
        minCgpa: { type: Number, default: 0 },
        branches: { type: [String], default: [] },
        skills: { type: [String], default: [] }
    },
    // auto-populated when the group is created / its filters are updated
    students: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }]
}, { timestamps: true });

const studentGroupModel = mongoose.model('StudentGroup', studentGroupSchema);
module.exports = studentGroupModel;
