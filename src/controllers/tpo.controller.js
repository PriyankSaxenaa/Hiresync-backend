const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const xlsx = require('xlsx');
const placementGroupModel = require('../models/placementGroup.model');
const { getAudienceStudentIds } = require('../utils/driveAudience');
const userModel = require('../models/user.model');
const collegeModel = require('../models/college.model');
const studentGroupModel = require('../models/studentGroup.model');
const campusDriveModel = require('../models/campusDrive.model');
const driveResponseModel = require('../models/driveResponse.model');
const notificationModel = require('../models/notification.model');

const { sendBatchEmails } = require('../utils/sendEmail');
const { emitToUser, emitToCollege } = require('../config/socket');
const { streamDriveReport } = require('../utils/generatePDF');
const { effectiveStatus } = require('../utils/driveStatus');
const { invalidators } = require('../utils/cacheKeys');

// ── Helpers ─────────────────────────────────────────────────────────────────────

// Resolve the college owned by the requesting TPO AND enforce that it's been
// verified by an admin. Every TPO action (students, groups, drives, analytics)
// routes through this one function, so this is the single choke point that
// blocks an unverified TPO from doing anything except registering/checking
// their college's status (that flow uses collegeController.getCollegeById
// directly, not this helper, so it's unaffected).
//
// Returns the college doc or sends a 4xx and returns null (caller should bail
// when null).
async function resolveCollege(req, res) {
    const college = await collegeModel.findOne({ tpo: req.user.id });
    if (!college) {
        res.status(404).json({ message: 'No college registered for this TPO. Register a college first.' });
        return null;
    }
    if (!college.isVerified) {
        res.status(403).json({ message: 'Your college must be verified by an admin before you can perform this action.' });
        return null;
    }
    return college;
}

// normalise a comma-separated skills cell into a clean lowercase array
function parseSkills(value) {
    if (!value) return [];
    return String(value)
        .split(',')
        .map(s => s.trim().toLowerCase())
        .filter(Boolean);
}

// pick a column value regardless of header casing / spacing variations
function pick(row, ...keys) {
    for (const k of keys) {
        if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== '') {
            return String(row[k]).trim();
        }
    }
    return '';
}

// build a Mongo query for students of a college matching a group's filters
function buildMatchQuery(collegeId, filters = {}) {
    const query = { role: 'candidate', college: collegeId };

    if (filters.minCgpa) {
        query.cgpa = { $gte: Number(filters.minCgpa) };
    }
    if (Array.isArray(filters.branches) && filters.branches.length) {
        // case-insensitive branch match
        query.branch = { $in: filters.branches.map(b => new RegExp(`^${b}$`, 'i')) };
    }
    if (Array.isArray(filters.skills) && filters.skills.length) {
        // student must have ALL listed skills (stored lowercased)
        query.skills = { $all: filters.skills.map(s => s.toLowerCase()) };
    }
    return query;
}

// ── Student Import ────────────────────────────────────────────────────────────

async function importStudents(req, res) {
    const college = await resolveCollege(req, res);
    if (!college) return;

    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded. Upload an Excel/CSV sheet.' });
    }

    // parse the sheet → array of row objects keyed by header
    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(sheet, { defval: '' });

    if (!rows.length) {
        return res.status(400).json({ message: 'The sheet is empty or has no data rows.' });
    }

    const summary = { totalRows: rows.length, created: 0, linked: 0, skipped: 0, errors: [] };
    const credentialEmails = []; // queued, sent in batches at the end
    const seenRolls = new Set(); // dedupe within the sheet itself

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const name = pick(row, 'name', 'Name', 'NAME');
        const email = pick(row, 'email', 'Email', 'EMAIL').toLowerCase();
        const rollNo = pick(row, 'roll_no', 'rollNo', 'Roll No', 'roll no', 'RollNo');
        const branch = pick(row, 'branch', 'Branch', 'BRANCH');
        const cgpaRaw = pick(row, 'cgpa', 'CGPA', 'Cgpa');
        const skills = parseSkills(pick(row, 'skills', 'Skills', 'SKILLS'));

        // basic row validation
        if (!name || !email || !rollNo) {
            summary.skipped += 1;
            summary.errors.push({ row: i + 2, reason: 'Missing name, email or roll_no' });
            continue;
        }

        // roll_no is unique per college — guard against duplicates within the sheet
        if (seenRolls.has(rollNo)) {
            summary.skipped += 1;
            summary.errors.push({ row: i + 2, rollNo, reason: 'Duplicate roll_no in sheet' });
            continue;
        }
        seenRolls.add(rollNo);

        const cgpa = cgpaRaw !== '' && !isNaN(Number(cgpaRaw)) ? Number(cgpaRaw) : null;

        try {
            const existing = await userModel.findOne({ email });

            if (existing) {
                // DUPLICATE EMAIL → link to this college, don't recreate, don't email.
                // Merge sheet skills into whatever they already have.
                existing.college = college._id;
                existing.rollNo = rollNo;
                existing.branch = branch;
                existing.cgpa = cgpa;
                existing.isImported = true;
                if (existing.role === 'candidate') {
                    const merged = new Set([...(existing.skills || []), ...skills]);
                    existing.skills = [...merged];
                }
                await existing.save();
                summary.linked += 1;
            } else {
                // NEW → create account with a temp password, queue a credentials email
                const tempPassword = crypto.randomBytes(5).toString('hex'); // 10-char temp pwd
                const hash = await bcrypt.hash(tempPassword, 10);

                await userModel.create({
                    name,
                    email,
                    password: hash,
                    role: 'candidate',
                    college: college._id,
                    rollNo,
                    branch,
                    cgpa,
                    skills,
                    isImported: true
                });

                credentialEmails.push({
                    to: email,
                    subject: `Your ${college.name} placement portal account`,
                    html: `
                        <p>Hi ${name},</p>
                        <p>An account has been created for you on the placement portal by your college (<strong>${college.name}</strong>).</p>
                        <p><strong>Login email:</strong> ${email}<br/>
                        <strong>Temporary password:</strong> ${tempPassword}</p>
                        <p>Please log in and update your password and profile (resume + skills) as soon as possible.</p>
                    `
                });
                summary.created += 1;
            }
        } catch (err) {
            summary.skipped += 1;
            summary.errors.push({ row: i + 2, email, reason: err.message });
        }
    }

    // batch-send credential emails in chunks of 50 (non-blocking failures)
    let emailResult = { total: 0, sent: 0, failed: 0 };
    if (credentialEmails.length) {
        emailResult = await sendBatchEmails(credentialEmails, 50);
    }

    res.status(200).json({
        message: 'Import complete',
        summary,
        emails: emailResult
    });
}

async function getStudents(req, res) {
    const college = await resolveCollege(req, res);
    if (!college) return;

    const students = await userModel
        .find({ role: 'candidate', college: college._id })
        .select('-password')
        .sort({ rollNo: 1 });

    res.status(200).json({
        message: 'Students fetched successfully',
        total: students.length,
        students
    });
}

async function getStudentById(req, res) {
    const college = await resolveCollege(req, res);
    if (!college) return;

    const student = await userModel
        .findOne({ _id: req.params.id, college: college._id, role: 'candidate' })
        .select('-password');

    if (!student) {
        return res.status(404).json({ message: 'Student not found in your college' });
    }

    res.status(200).json({ message: 'Student fetched successfully', student });
}

// ── Student Groups ──────────────────────────────────────────────────────────────

async function createGroup(req, res) {
    const college = await resolveCollege(req, res);
    if (!college) return;

    const { name, filters = {} } = req.body;

    // auto-populate: query matching students right now
    const query = buildMatchQuery(college._id, filters);
    const matched = await userModel.find(query).select('_id');

    const group = await studentGroupModel.create({
        college: college._id,
        name,
        filters: {
            minCgpa: filters.minCgpa || 0,
            branches: filters.branches || [],
            skills: (filters.skills || []).map(s => s.toLowerCase())
        },
        students: matched.map(s => s._id)
    });

    res.status(201).json({
        message: 'Group created and populated successfully',
        group: { id: group._id, name: group.name, studentCount: group.students.length, filters: group.filters }
    });
}

async function getGroups(req, res) {
    const college = await resolveCollege(req, res);
    if (!college) return;

    const groups = await studentGroupModel.find({ college: college._id });

    res.status(200).json({
        message: 'Groups fetched successfully',
        total: groups.length,
        groups: groups.map(g => ({
            id: g._id, name: g.name, filters: g.filters, studentCount: g.students.length
        }))
    });
}

async function getGroupById(req, res) {
    const college = await resolveCollege(req, res);
    if (!college) return;

    const group = await studentGroupModel
        .findOne({ _id: req.params.id, college: college._id })
        .populate('students', 'name email rollNo branch cgpa skills');

    if (!group) {
        return res.status(404).json({ message: 'Group not found in your college' });
    }

    res.status(200).json({ message: 'Group fetched successfully', group });
}

async function updateGroup(req, res) {
    const college = await resolveCollege(req, res);
    if (!college) return;

    const group = await studentGroupModel.findOne({ _id: req.params.id, college: college._id });
    if (!group) {
        return res.status(404).json({ message: 'Group not found in your college' });
    }

    const { name, filters } = req.body;
    if (name) group.name = name;

    // updating filters → re-run the query and re-populate the student list
    if (filters) {
        group.filters = {
            minCgpa: filters.minCgpa || 0,
            branches: filters.branches || [],
            skills: (filters.skills || []).map(s => s.toLowerCase())
        };
        const matched = await userModel.find(buildMatchQuery(college._id, group.filters)).select('_id');
        group.students = matched.map(s => s._id);
    }

    await group.save();

    res.status(200).json({
        message: 'Group updated and re-populated successfully',
        group: { id: group._id, name: group.name, filters: group.filters, studentCount: group.students.length }
    });
}

// ── Campus Drives ─────────────────────────────────────────────────────────────

async function createDrive(req, res) {
    const college = await resolveCollege(req, res);
    if (!college) return;
    // note: verification is already enforced inside resolveCollege above,
    // so no separate isVerified check is needed here anymore.

    const { company, title, description, jd, deadline } = req.body;
    const targetType = req.body.targetType || 'studentGroup';

    const driveData = { college: college._id, company, title, description, jd, deadline, targetType };

    if (targetType === 'studentGroup') {
        // the target group must belong to this college
        const group = await studentGroupModel.findOne({ _id: req.body.targetGroup, college: college._id });
        if (!group) {
            return res.status(404).json({ message: 'Target group not found in your college' });
        }
        driveData.targetGroup = group._id;
    } else if (targetType === 'placementGroup') {
        const ids = req.body.targetPlacementGroups || [];
        const groups = await placementGroupModel.find({ _id: { $in: ids }, college: college._id }).select('_id');
        if (groups.length !== ids.length) {
            return res.status(404).json({ message: 'One or more target placement groups were not found in your college' });
        }
        driveData.targetPlacementGroups = groups.map(g => g._id);
    }
    // targetType === 'all' needs no extra reference data

    const drive = await campusDriveModel.create(driveData);

    // resolve the actual audience for the chosen targeting mode and notify them
    const audienceIds = await getAudienceStudentIds(college._id, drive);

    const notifications = audienceIds.map(studentId => ({
        user: studentId,
        type: 'drive',
        message: `New campus drive: ${title} (${company}). Respond before the deadline.`,
        link: `/campus/drives/${drive._id}`
    }));
    if (notifications.length) {
        await notificationModel.insertMany(notifications);
        audienceIds.forEach(studentId => {
            emitToUser(studentId.toString(), 'drive:new', {
                driveId: drive._id, title, company, deadline: drive.deadline
            });
        });
    }
    // also broadcast to the whole college room
    emitToCollege(college._id.toString(), 'drive:new', {
        driveId: drive._id, title, company, deadline: drive.deadline
    });

    // fresh drive → bust the cached campus feed for this college
    await invalidators.campusDrives(college._id.toString());

    res.status(201).json({
        message: 'Drive posted and students notified',
        drive,
        notifiedStudents: audienceIds.length
    });
}

async function getDrives(req, res) {
    const college = await resolveCollege(req, res);
    if (!college) return;

    const drives = await campusDriveModel
        .find({ college: college._id })
        .populate('targetGroup', 'name')
        .populate('targetPlacementGroups', 'name')
        .sort({ createdAt: -1 });

    res.status(200).json({
        message: 'Drives fetched successfully',
        total: drives.length,
        drives: drives.map(d => ({
            id: d._id,
            company: d.company,
            title: d.title,
            targetType: d.targetType,
            targetGroup: d.targetType === 'studentGroup' ? d.targetGroup : null,
            targetPlacementGroups: d.targetType === 'placementGroup' ? d.targetPlacementGroups : [],
            deadline: d.deadline,
            status: effectiveStatus(d)
        }))
    });
}

async function getDriveById(req, res) {
    const college = await resolveCollege(req, res);
    if (!college) return;

    const drive = await campusDriveModel.findOne({ _id: req.params.id, college: college._id });
    if (!drive) {
        return res.status(404).json({ message: 'Drive not found in your college' });
    }

    // total targeted now comes from the resolved audience, so it's correct
    // regardless of targeting mode
    const audienceIds = await getAudienceStudentIds(college._id, drive);
    const responses = await driveResponseModel.find({ drive: drive._id });
    const interested = responses.filter(r => r.response === 'interested').length;
    const notInterested = responses.filter(r => r.response === 'not_interested').length;

    let target = { type: drive.targetType };
    if (drive.targetType === 'studentGroup') {
        const group = await studentGroupModel.findById(drive.targetGroup).select('name');
        target.group = group ? { id: group._id, name: group.name } : null;
    } else if (drive.targetType === 'placementGroup') {
        const groups = await placementGroupModel.find({ _id: { $in: drive.targetPlacementGroups } }).select('name');
        target.groups = groups.map(g => ({ id: g._id, name: g.name }));
    }

    res.status(200).json({
        message: 'Drive fetched successfully',
        drive: {
            id: drive._id,
            company: drive.company,
            title: drive.title,
            description: drive.description,
            jd: drive.jd,
            deadline: drive.deadline,
            status: effectiveStatus(drive),
            target
        },
        responseSummary: {
            totalTargeted: audienceIds.length,
            responded: responses.length,
            interested,
            notInterested,
            noResponse: Math.max(audienceIds.length - responses.length, 0)
        }
    });
}

async function updateDrive(req, res) {
    const college = await resolveCollege(req, res);
    if (!college) return;

    const drive = await campusDriveModel.findOne({ _id: req.params.id, college: college._id });
    if (!drive) {
        return res.status(404).json({ message: 'Drive not found in your college' });
    }

    const editable = ['company', 'title', 'description', 'jd', 'deadline'];
    editable.forEach(f => {
        if (req.body[f] !== undefined) drive[f] = req.body[f];
    });

    // any targeting field present → treat as a full re-target and re-validate
    // the whole combination (avoids ending up with e.g. targetType 'all' but
    // a stale targetPlacementGroups array left over from before)
    const retargeting = req.body.targetType !== undefined
        || req.body.targetGroup !== undefined
        || req.body.targetPlacementGroups !== undefined;

    if (retargeting) {
        const targetType = req.body.targetType || drive.targetType;

        if (targetType === 'studentGroup') {
            const groupId = req.body.targetGroup
                || (drive.targetType === 'studentGroup' ? drive.targetGroup : null);
            const group = await studentGroupModel.findOne({ _id: groupId, college: college._id });
            if (!group) {
                return res.status(404).json({ message: 'Target group not found in your college' });
            }
            drive.targetType = 'studentGroup';
            drive.targetGroup = group._id;
            drive.targetPlacementGroups = [];
        } else if (targetType === 'placementGroup') {
            const ids = req.body.targetPlacementGroups
                || (drive.targetType === 'placementGroup' ? drive.targetPlacementGroups : []);
            if (!Array.isArray(ids) || !ids.length) {
                return res.status(400).json({ message: 'targetPlacementGroups must be a non-empty array' });
            }
            const groups = await placementGroupModel.find({ _id: { $in: ids }, college: college._id }).select('_id');
            if (groups.length !== ids.length) {
                return res.status(404).json({ message: 'One or more target placement groups were not found in your college' });
            }
            drive.targetType = 'placementGroup';
            drive.targetPlacementGroups = groups.map(g => g._id);
            drive.targetGroup = undefined;
        } else if (targetType === 'all') {
            drive.targetType = 'all';
            drive.targetGroup = undefined;
            drive.targetPlacementGroups = [];
        } else {
            return res.status(400).json({ message: 'Invalid targetType. Use studentGroup, placementGroup or all.' });
        }
    }

    await drive.save();

    await invalidators.campusDrives(college._id.toString());

    res.status(200).json({ message: 'Drive updated successfully', drive });
}

async function updateDriveStatus(req, res) {
    const college = await resolveCollege(req, res);
    if (!college) return;

    const { status } = req.body;
    if (!['upcoming', 'ongoing', 'closed'].includes(status)) {
        return res.status(400).json({ message: 'Invalid status. Use upcoming, ongoing or closed.' });
    }

    const drive = await campusDriveModel.findOneAndUpdate(
        { _id: req.params.id, college: college._id },
        { status },
        { new: true }
    );
    if (!drive) {
        return res.status(404).json({ message: 'Drive not found in your college' });
    }

    await invalidators.campusDrives(college._id.toString());

    res.status(200).json({ message: `Drive status set to ${status}`, drive });
}

// PDF: name, roll_no, branch, cgpa, skills, response (for every targeted student)
async function downloadDriveReport(req, res) {
    const college = await resolveCollege(req, res);
    if (!college) return;

    const drive = await campusDriveModel.findOne({ _id: req.params.id, college: college._id });
    if (!drive) {
        return res.status(404).json({ message: 'Drive not found in your college' });
    }

    const audienceIds = await getAudienceStudentIds(college._id, drive);
    const students = await userModel
        .find({ _id: { $in: audienceIds } })
        .select('name rollNo branch cgpa skills');

    const responses = await driveResponseModel.find({ drive: drive._id });
    const responseByUser = new Map(responses.map(r => [r.candidate.toString(), r.response]));

    const rows = students.map(s => ({
        name: s.name,
        rollNo: s.rollNo,
        branch: s.branch,
        cgpa: s.cgpa,
        skills: s.skills,
        response: responseByUser.get(s._id.toString()) || 'no_response'
    }));

    streamDriveReport(res, { drive, rows });
}

// ── TPO Analytics ─────────────────────────────────────────────────────────────

async function getTpoAnalytics(req, res) {
    const college = await resolveCollege(req, res);
    if (!college) return;

    const drives = await campusDriveModel.find({ college: college._id }).select('_id');
    const driveIds = drives.map(d => d._id);

    const responses = await driveResponseModel
        .find({ drive: { $in: driveIds } })
        .populate('candidate', 'branch skills');

    const totalResponses = responses.length;
    const interested = responses.filter(r => r.response === 'interested').length;

    // branch-wise interested breakdown
    const branchBreakdown = {};
    // top skills among interested candidates
    const skillCounts = {};

    responses.forEach(r => {
        if (r.response !== 'interested' || !r.candidate) return;
        const branch = r.candidate.branch || 'Unknown';
        branchBreakdown[branch] = (branchBreakdown[branch] || 0) + 1;
        (r.candidate.skills || []).forEach(skill => {
            skillCounts[skill] = (skillCounts[skill] || 0) + 1;
        });
    });

    const topSkills = Object.entries(skillCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([skill, count]) => ({ skill, count }));

    res.status(200).json({
        message: 'TPO analytics fetched successfully',
        analytics: {
            drivesPosted: driveIds.length,
            totalResponses,
            interested,
            notInterested: totalResponses - interested,
            interestedPercentage: totalResponses ? Math.round((interested / totalResponses) * 100) : 0,
            branchBreakdown,
            topSkills
        }
    });
}

module.exports = {
    resolveCollege,
    importStudents,
    getStudents,
    getStudentById,
    createGroup,
    getGroups,
    getGroupById,
    updateGroup,
    createDrive,
    getDrives,
    getDriveById,
    updateDrive,
    updateDriveStatus,
    downloadDriveReport,
    getTpoAnalytics
};