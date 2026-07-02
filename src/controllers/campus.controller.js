const userModel = require('../models/user.model');
const campusDriveModel = require('../models/campusDrive.model');
const driveResponseModel = require('../models/driveResponse.model');
const notificationModel = require('../models/notification.model');
const { isCandidateInAudience, buildAudienceFilter } = require('../utils/driveAudience');
const { effectiveStatus, isDriveOpen } = require('../utils/driveStatus');
const { emitToUser } = require('../config/socket');

// Shared lookup: a candidate's college + their single placement group.
// Students belong to at most one placement group (User.placementGroup is the
// single source of truth — see user.model.js), so this replaces the old
// query that pulled every filter-based StudentGroup a student happened to
// match. Returns null if the candidate isn't linked to a college.
async function getCandidateMembership(userId) {
    const user = await userModel.findById(userId).select('college name placementGroup');
    if (!user || !user.college) return null;
    return user;
}

async function getCampusDrives(req, res) {
    const user = await getCandidateMembership(req.user.id);
    if (!user) {
        return res.status(200).json({
            message: 'You are not linked to any college (off-campus account).',
            total: 0,
            drives: []
        });
    }

    const drives = await campusDriveModel
        .find({
            college: user.college,
            ...buildAudienceFilter(user.placementGroup)
        })
        .sort({ createdAt: -1 });

    // attach this candidate's own response (if any) to each drive
    const myResponses = await driveResponseModel.find({
        candidate: req.user.id,
        drive: { $in: drives.map(d => d._id) }
    });
    const myResponseByDrive = new Map(myResponses.map(r => [r.drive.toString(), r.response]));

    res.status(200).json({
        message: 'Campus drives fetched successfully',
        total: drives.length,
        drives: drives.map(d => ({
            id: d._id,
            company: d.company,
            title: d.title,
            description: d.description,
            deadline: d.deadline,
            status: effectiveStatus(d),
            myResponse: myResponseByDrive.get(d._id.toString()) || null
        }))
    });
}

async function getCampusDriveById(req, res) {
    const user = await getCandidateMembership(req.user.id);
    if (!user) {
        return res.status(403).json({ message: 'You are not linked to any college' });
    }

    const drive = await campusDriveModel.findOne({ _id: req.params.id, college: user.college });
    if (!drive) {
        return res.status(404).json({ message: 'Drive not found' });
    }

    const eligible = isCandidateInAudience(user, drive);
    if (!eligible) {
        return res.status(403).json({ message: 'You are not eligible for this drive' });
    }

    const myResponse = await driveResponseModel.findOne({ drive: drive._id, candidate: user._id });

    res.status(200).json({
        message: 'Drive fetched successfully',
        drive: {
            id: drive._id,
            company: drive.company,
            title: drive.title,
            description: drive.description,
            jd: drive.jd,
            deadline: drive.deadline,
            status: effectiveStatus(drive)
        },
        myResponse: myResponse ? myResponse.response : null
    });
}

async function respondToDrive(req, res) {
    const { response } = req.body;
    if (!['interested', 'not_interested'].includes(response)) {
        return res.status(400).json({ message: 'Response must be "interested" or "not_interested"' });
    }

    const user = await getCandidateMembership(req.user.id);
    if (!user) {
        return res.status(403).json({ message: 'You are not linked to any college' });
    }

    const drive = await campusDriveModel.findOne({ _id: req.params.id, college: user.college });
    if (!drive) {
        return res.status(404).json({ message: 'Drive not found' });
    }

    const eligible = isCandidateInAudience(user, drive);
    if (!eligible) {
        return res.status(403).json({ message: 'You are not eligible for this drive' });
    }

    // deadline / status lock — auto-managed: past the deadline always reads closed
    if (!isDriveOpen(drive)) {
        return res.status(403).json({ message: 'This drive is closed. Responses are locked.' });
    }

    // upsert — one response per candidate per drive, editable until the deadline
    const saved = await driveResponseModel.findOneAndUpdate(
        { drive: drive._id, candidate: user._id },
        { response, respondedAt: new Date() },
        { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    const message = `Your response (${response.replace('_', ' ')}) to ${drive.title} (${drive.company}) was recorded.`;
    await notificationModel.create({
        user: user._id,
        type: 'drive',
        message,
        link: `/campus/drives/${drive._id}`
    });
    emitToUser(user._id.toString(), 'drive:response:confirmed', {
        driveId: drive._id, response: saved.response
    });

    res.status(200).json({
        message: 'Response recorded successfully',
        response: saved.response
    });
}

// candidate updates resume + skills ONLY. name/email/rollNo/branch/cgpa are locked.
async function updateCampusProfile(req, res) {
    const { resumeUrl, skills } = req.body;

    const update = {};
    if (resumeUrl !== undefined) update.resumeUrl = resumeUrl;
    if (skills !== undefined) {
        if (!Array.isArray(skills)) {
            return res.status(400).json({ message: 'skills must be an array' });
        }
        update.skills = skills.map(s => String(s).trim().toLowerCase()).filter(Boolean);
    }

    const user = await userModel.findByIdAndUpdate(req.user.id, update, { new: true }).select('-password');
    if (!user) {
        return res.status(404).json({ message: 'User not found' });
    }

    // profile is complete once both a resume and at least one skill are present
    const complete = !!(user.resumeUrl && user.skills && user.skills.length > 0);
    if (complete !== user.profileComplete) {
        user.profileComplete = complete;
        await user.save();
    }

    res.status(200).json({
        message: 'Profile updated successfully',
        user
    });
}

module.exports = {
    getCampusDrives,
    getCampusDriveById,
    respondToDrive,
    updateCampusProfile
};