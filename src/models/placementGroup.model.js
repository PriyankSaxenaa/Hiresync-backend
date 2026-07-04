const mongoose = require('mongoose');

// Manually-managed TPO placement groups (distinct from the existing filter-based
// StudentGroup model). A student belongs to at most ONE placement group at a
// time — that constraint lives on User.placementGroup (see user.model.js), so
// this schema intentionally does NOT keep an embedded students array. Keeping a
// single source of truth avoids the two ever drifting out of sync.
const placementGroupSchema = new mongoose.Schema({
    college: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'College',
        required: true
    },
    name: {
        type: String,
        required: true,
    },
    description: {
        type: String,
        default: ''
    },
    // the TPO who created this group
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
}, { timestamps: true });

// group names must be unique within a college. This is a DB-level safety net —
// the controller does an explicit case-insensitive check first so it can return
// a clean 409 message instead of a raw duplicate-key error.
placementGroupSchema.index({ college: 1, name: 1 }, { unique: true });

const placementGroupModel = mongoose.model('PlacementGroup', placementGroupSchema);
module.exports = placementGroupModel;