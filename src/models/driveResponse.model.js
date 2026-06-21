const mongoose = require('mongoose');

const driveResponseSchema = new mongoose.Schema({
    drive: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'CampusDrive',
        required: true
    },
    candidate: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    response: {
        type: String,
        enum: ['interested', 'not_interested'],
        required: true
    },
    respondedAt: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

// one response per candidate per drive — lets us upsert cleanly
driveResponseSchema.index({ drive: 1, candidate: 1 }, { unique: true });

const driveResponseModel = mongoose.model('DriveResponse', driveResponseSchema);
module.exports = driveResponseModel;
