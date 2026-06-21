const mongoose = require('mongoose');

const campusDriveSchema = new mongoose.Schema({
    college: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'College',
        required: true
    },
    company: {
        type: String,
        required: true,
    },
    title: {
        type: String,
        required: true,
    },
    description: {
        type: String,
        default: ''
    },
    jd: {
        type: String,        // full job description
        default: ''
    },
    targetGroup: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'StudentGroup',
        required: true
    },
    deadline: {
        type: Date,
        required: true,
    },
    // status is set by the TPO (upcoming / ongoing / closed). Auto-management
    // based on the deadline is added in a later phase.
    status: {
        type: String,
        enum: ['upcoming', 'ongoing', 'closed'],
        default: 'ongoing'
    }
}, { timestamps: true });

const campusDriveModel = mongoose.model('CampusDrive', campusDriveSchema);
module.exports = campusDriveModel;
