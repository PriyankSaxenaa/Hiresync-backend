const studentGroupModel = require('../models/studentGroup.model');
const userModel = require('../models/user.model');

// Single source of truth for "who does this drive target" — used by drive
// creation/editing (notifications), the candidate feed, eligibility checks,
// and the TPO report. Keeping it in one place means every consumer agrees
// on what 'studentGroup' / 'placementGroup' / 'all' actually means.

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
// `candidate` needs at least { _id, placementGroup } populated.
async function isCandidateInAudience(candidate, drive) {
    if (drive.targetType === 'all') return true;

    if (drive.targetType === 'placementGroup') {
        if (!candidate.placementGroup) return false;
        return (drive.targetPlacementGroups || [])
            .some(id => id.toString() === candidate.placementGroup.toString());
    }

    // 'studentGroup'
    return studentGroupModel.exists({ _id: drive.targetGroup, students: candidate._id });
}

// Mongo filter fragment for "drives visible to this candidate", used by the
// campus feed. groupIds = StudentGroup ids the candidate belongs to,
// placementGroupId = candidate's current placement group (or null/undefined).
function buildAudienceFilter(groupIds = [], placementGroupId = null) {
    const or = [{ targetType: 'all' }];

    if (groupIds.length) {
        or.push({ targetType: 'studentGroup', targetGroup: { $in: groupIds } });
    }
    if (placementGroupId) {
        or.push({ targetType: 'placementGroup', targetPlacementGroups: placementGroupId });
    }

    return { $or: or };
}

module.exports = { getAudienceStudentIds, isCandidateInAudience, buildAudienceFilter };