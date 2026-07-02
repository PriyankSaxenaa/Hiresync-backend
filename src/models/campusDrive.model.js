const mongoose = require('mongoose');

const campusDriveSchema = new mongoose.Schema({
    college: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'College',
        required: true
    },
    company: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    jd: { type: String, default: '' },

    // ── Targeting ────────────────────────────────────────────────────────────
    // 'studentGroup' (default) preserves the original filter-based StudentGroup
    // targeting so existing drives keep working unchanged.
    // 'placementGroup' targets one or more manually-managed PlacementGroups.
    // 'all' targets every candidate in the college.
    targetType: {
        type: String,
        enum: ['studentGroup', 'placementGroup', 'all'],
        default: 'studentGroup'
    },
    // only required/used when targetType === 'studentGroup'
    targetGroup: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'StudentGroup',
        required: function () { return this.targetType === 'studentGroup'; }
    },
    // only used when targetType === 'placementGroup'
    targetPlacementGroups: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'PlacementGroup'
    }],

    deadline: { type: Date, required: true },
    status: {
        type: String,
        enum: ['upcoming', 'ongoing', 'closed'],
        default: 'ongoing'
    }
}, { timestamps: true });

const campusDriveModel = mongoose.model('CampusDrive', campusDriveSchema);
module.exports = campusDriveModel;