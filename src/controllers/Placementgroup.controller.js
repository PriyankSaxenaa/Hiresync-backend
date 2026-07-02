const placementGroupModel = require('../models/placementGroup.model');
const userModel = require('../models/user.model');
const { invalidators } = require('../utils/cacheKeys');

// reuse the same "find the college owned by this TPO" helper already used
// throughout tpo.controller.js, instead of duplicating it here
const { resolveCollege } = require('./tpo.controller');

// escape user input before dropping it into a RegExp (case-insensitive name match)
function escapeRegex(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// moves/assigns a student into `group`, vacating whatever group they were in
// before. This is the one place that touches User.placementGroup, which is
// what makes "one group per student" trivial to guarantee. Also busts that
// student's cached campus-drive feed, since which drives are visible to them
// can change the moment their placement group changes.
async function reassignStudent(student, group, collegeId) {
    student.placementGroup = group._id;
    student.placementGroupAssignedAt = new Date();
    await student.save();
    await invalidators.studentCampusDrives(collegeId.toString(), student._id.toString());
}

// ── Group CRUD ────────────────────────────────────────────────────────────────

async function createGroup(req, res) {
    const college = await resolveCollege(req, res);
    if (!college) return;

    const { name, description = '' } = req.body;

    const existing = await placementGroupModel.findOne({
        college: college._id,
        name: new RegExp(`^${escapeRegex(name)}$`, 'i')
    });
    if (existing) {
        return res.status(409).json({ message: 'A placement group with this name already exists' });
    }

    const group = await placementGroupModel.create({
        college: college._id,
        name,
        description,
        createdBy: req.user.id
    });

    res.status(201).json({
        message: 'Placement group created successfully',
        group
    });
}

async function getGroups(req, res) {
    const college = await resolveCollege(req, res);
    if (!college) return;

    const groups = await placementGroupModel.find({ college: college._id }).sort({ name: 1 });

    // live member counts, computed from the User collection (single source of truth)
    const counts = await userModel.aggregate([
        { $match: { college: college._id, placementGroup: { $ne: null } } },
        { $group: { _id: '$placementGroup', count: { $sum: 1 } } }
    ]);
    const countByGroup = new Map(counts.map(c => [c._id.toString(), c.count]));

    res.status(200).json({
        message: 'Placement groups fetched successfully',
        total: groups.length,
        groups: groups.map(g => ({
            id: g._id,
            name: g.name,
            description: g.description,
            studentCount: countByGroup.get(g._id.toString()) || 0,
            createdAt: g.createdAt,
            updatedAt: g.updatedAt
        }))
    });
}

async function getGroupById(req, res) {
    const college = await resolveCollege(req, res);
    if (!college) return;

    const group = await placementGroupModel.findOne({ _id: req.params.id, college: college._id });
    if (!group) {
        return res.status(404).json({ message: 'Placement group not found in your college' });
    }

    const students = await userModel
        .find({ college: college._id, placementGroup: group._id })
        .select('name email rollNo branch cgpa skills placementGroupAssignedAt')
        .sort({ rollNo: 1 });

    res.status(200).json({
        message: 'Placement group fetched successfully',
        group: {
            id: group._id,
            name: group.name,
            description: group.description,
            createdAt: group.createdAt,
            updatedAt: group.updatedAt,
            studentCount: students.length,
            students
        }
    });
}

async function updateGroup(req, res) {
    const college = await resolveCollege(req, res);
    if (!college) return;

    const group = await placementGroupModel.findOne({ _id: req.params.id, college: college._id });
    if (!group) {
        return res.status(404).json({ message: 'Placement group not found in your college' });
    }

    const { name, description } = req.body;

    // renaming — guard against colliding with another group in the same college
    if (name && name.toLowerCase() !== group.name.toLowerCase()) {
        const duplicate = await placementGroupModel.findOne({
            college: college._id,
            _id: { $ne: group._id },
            name: new RegExp(`^${escapeRegex(name)}$`, 'i')
        });
        if (duplicate) {
            return res.status(409).json({ message: 'A placement group with this name already exists' });
        }
        group.name = name;
    }
    if (description !== undefined) group.description = description;

    await group.save();

    res.status(200).json({
        message: 'Placement group updated successfully',
        group
    });
}

async function deleteGroup(req, res) {
    const college = await resolveCollege(req, res);
    if (!college) return;

    const group = await placementGroupModel.findOne({ _id: req.params.id, college: college._id });
    if (!group) {
        return res.status(404).json({ message: 'Placement group not found in your college' });
    }

    // vacate every student in this group before deleting it — nobody should be
    // left pointing at a placement group that no longer exists
    const vacated = await userModel.find(
        { college: college._id, placementGroup: group._id }
    ).select('_id');

    await userModel.updateMany(
        { college: college._id, placementGroup: group._id },
        { placementGroup: null, placementGroupAssignedAt: null }
    );

    await placementGroupModel.findByIdAndDelete(group._id);

    // every vacated student's feed can change now that they have no group
    await Promise.all(
        vacated.map(s => invalidators.studentCampusDrives(college._id.toString(), s._id.toString()))
    );

    res.status(200).json({
        message: 'Placement group deleted successfully'
    });
}

// ── Student assignment ──────────────────────────────────────────────────────

async function assignStudent(req, res) {
    const college = await resolveCollege(req, res);
    if (!college) return;

    const group = await placementGroupModel.findOne({ _id: req.params.id, college: college._id });
    if (!group) {
        return res.status(404).json({ message: 'Placement group not found in your college' });
    }

    const { studentId } = req.body;
    const student = await userModel.findOne({ _id: studentId, college: college._id, role: 'candidate' });
    if (!student) {
        return res.status(404).json({ message: 'Student not found in your college' });
    }

    const previousGroupId = student.placementGroup;

    // already in this exact group — nothing to do
    if (previousGroupId && previousGroupId.toString() === group._id.toString()) {
        return res.status(409).json({ message: 'Student is already in this placement group' });
    }

    await reassignStudent(student, group, college._id);

    res.status(200).json({
        message: previousGroupId
            ? 'Student moved to the new placement group successfully'
            : 'Student assigned to placement group successfully',
        studentId: student._id,
        groupId: group._id,
        previousGroupId: previousGroupId || null
    });
}

async function removeStudent(req, res) {
    const college = await resolveCollege(req, res);
    if (!college) return;

    const group = await placementGroupModel.findOne({ _id: req.params.id, college: college._id });
    if (!group) {
        return res.status(404).json({ message: 'Placement group not found in your college' });
    }

    const student = await userModel.findOne({ _id: req.params.studentId, college: college._id, role: 'candidate' });
    if (!student) {
        return res.status(404).json({ message: 'Student not found in your college' });
    }

    if (!student.placementGroup || student.placementGroup.toString() !== group._id.toString()) {
        return res.status(409).json({ message: 'Student is not a member of this placement group' });
    }

    student.placementGroup = null;
    student.placementGroupAssignedAt = null;
    await student.save();
    await invalidators.studentCampusDrives(college._id.toString(), student._id.toString());

    res.status(200).json({
        message: 'Student removed from placement group successfully',
        studentId: student._id,
        groupId: group._id
    });
}

// explicit "move" — same underlying operation as assign, but requires the
// student to already be in a group, per the spec's separate Move Student API
async function moveStudent(req, res) {
    const college = await resolveCollege(req, res);
    if (!college) return;

    const { studentId, toGroupId } = req.body;

    const group = await placementGroupModel.findOne({ _id: toGroupId, college: college._id });
    if (!group) {
        return res.status(404).json({ message: 'Target placement group not found in your college' });
    }

    const student = await userModel.findOne({ _id: studentId, college: college._id, role: 'candidate' });
    if (!student) {
        return res.status(404).json({ message: 'Student not found in your college' });
    }

    if (!student.placementGroup) {
        return res.status(409).json({ message: 'Student is not currently in any placement group. Use assign instead.' });
    }
    if (student.placementGroup.toString() === group._id.toString()) {
        return res.status(409).json({ message: 'Student is already in this placement group' });
    }

    const previousGroupId = student.placementGroup;
    await reassignStudent(student, group, college._id);

    res.status(200).json({
        message: 'Student moved to the new placement group successfully',
        studentId: student._id,
        groupId: group._id,
        previousGroupId
    });
}

async function bulkAssignStudents(req, res) {
    const college = await resolveCollege(req, res);
    if (!college) return;

    const group = await placementGroupModel.findOne({ _id: req.params.id, college: college._id });
    if (!group) {
        return res.status(404).json({ message: 'Placement group not found in your college' });
    }

    const { studentIds } = req.body;
    const summary = { total: studentIds.length, assigned: 0, skipped: 0, errors: [] };

    for (const studentId of studentIds) {
        const student = await userModel.findOne({ _id: studentId, college: college._id, role: 'candidate' });
        if (!student) {
            summary.skipped += 1;
            summary.errors.push({ studentId, reason: 'Student not found in your college' });
            continue;
        }
        if (student.placementGroup && student.placementGroup.toString() === group._id.toString()) {
            summary.skipped += 1;
            summary.errors.push({ studentId, reason: 'Already in this group' });
            continue;
        }
        await reassignStudent(student, group, college._id);
        summary.assigned += 1;
    }

    res.status(200).json({
        message: 'Bulk assignment complete',
        groupId: group._id,
        summary
    });
}

async function bulkRemoveStudents(req, res) {
    const college = await resolveCollege(req, res);
    if (!college) return;

    const { studentIds } = req.body;
    const summary = { total: studentIds.length, removed: 0, skipped: 0, errors: [] };

    for (const studentId of studentIds) {
        const student = await userModel.findOne({ _id: studentId, college: college._id, role: 'candidate' });
        if (!student || !student.placementGroup) {
            summary.skipped += 1;
            summary.errors.push({ studentId, reason: 'Student not found or has no placement group' });
            continue;
        }
        student.placementGroup = null;
        student.placementGroupAssignedAt = null;
        await student.save();
        await invalidators.studentCampusDrives(college._id.toString(), student._id.toString());
        summary.removed += 1;
    }

    res.status(200).json({
        message: 'Bulk removal complete',
        summary
    });
}

// ── Candidate: view own placement group ─────────────────────────────────────
// Read-only. Any logged-in candidate can check their own group — no college
// resolution via resolveCollege (that's TPO-only), just their own user doc.
async function getMyGroup(req, res) {
    const user = await userModel.findById(req.user.id).select('placementGroup placementGroupAssignedAt');

    if (!user || !user.placementGroup) {
        return res.status(200).json({
            message: 'No placement group assigned yet',
            group: null
        });
    }

    const group = await placementGroupModel.findById(user.placementGroup).select('name description');

    // stale reference (e.g. group deleted without clearing the user) — treat as unassigned
    if (!group) {
        return res.status(200).json({
            message: 'No placement group assigned yet',
            group: null
        });
    }

    res.status(200).json({
        message: 'Placement group fetched successfully',
        group: {
            id: group._id,
            name: group.name,
            description: group.description,
            assignedAt: user.placementGroupAssignedAt
        }
    });
}

module.exports = {
    createGroup,
    getGroups,
    getGroupById,
    updateGroup,
    deleteGroup,
    assignStudent,
    removeStudent,
    moveStudent,
    bulkAssignStudents,
    bulkRemoveStudents,
    getMyGroup
};