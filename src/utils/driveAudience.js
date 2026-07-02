const studentGroupModel = require('../models/studentGroup.model');
const userModel = require('../models/user.model');

// Single source of truth for "who does this drive target" — used by drive
// creation/editing (notifications), the candidate feed, eligibility checks,
// and the TPO report. Keeping it in one place means every consumer agrees
// on what 'studentGroup' / 'placementGroup' / 'all' actually means.
//
// NOTE: 'studentGroup' targeting is legacy. TPOs can still create/manage
// StudentGroup-targeted drives, and getAudienceStudentIds below still
// resolves them correctly for TPO-side notifications/reports — but the
// student-facing feed and eligibility checks (isCandidateInAudience,
// buildAudienceFilter) only recognise 'placementGroup' and 'all'. Students
// now belong to at most one PlacementGroup, so there's no need to resolve a
// student's StudentGroup memberships on that side any more.

// Returns an array of student user _ids in the drive's target audience.
async function getAudienceStudentIds(collegeId, drive) {
    if (drive.targetType === 'all') {
        const students = await userModel
            .find({ college: collegeId, role: 'candidate' })
            .select('_id');
        return students.map(s => s._id);
    }

    if (drive.targetType === 'placementGroup') {
        const students = await userModel
            .find({
                college: collegeId,
                role: 'candidate',
                placementGroup: { $in: drive.targetPlacementGroups || [] }
            })
            .select('_id');
        return students.map(s => s._id);
    }

    // default / backward-compatible: 'studentGroup'
    const group = await studentGroupModel.findById(drive.targetGroup).select('students');
    return group ? group.students : [];
}

// Is this specific candidate inside the drive's target audience?
// `candidate` needs at least { placementGroup } populated.
// Only 'all' and 'placementGroup' are recognised here — see note above.
function isCandidateInAudience(candidate, drive) {
    if (drive.targetType === 'all') return true;

    if (drive.targetType === 'placementGroup') {
        if (!candidate.placementGroup) return false;
        return (drive.targetPlacementGroups || [])
            .some(id => id.toString() === candidate.placementGroup.toString());
    }

    // legacy 'studentGroup' drives are no longer surfaced to students directly
    return false;
}

// Mongo filter fragment for "drives visible to this candidate", used by the
// campus feed. placementGroupId = candidate's current placement group (or
// null/undefined for a student with no group assigned yet).
function buildAudienceFilter(placementGroupId = null) {
    const or = [{ targetType: 'all' }];

    if (placementGroupId) {
        or.push({ targetType: 'placementGroup', targetPlacementGroups: placementGroupId });
    }

    return { $or: or };
}

module.exports = { getAudienceStudentIds, isCandidateInAudience, buildAudienceFilter };