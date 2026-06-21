const userModel = require('../models/user.model');
const studentGroupModel = require('../models/studentGroup.model');
const campusDriveModel = require('../models/campusDrive.model');
const driveResponseModel = require('../models/driveResponse.model');

// a drive is open for responses while its status isn't manually closed AND
// the deadline hasn't passed yet
function isDriveOpen(drive) {
    if (!drive) return false;
    if (drive.status === 'closed') return false;
    if (drive.deadline && new Date(drive.deadline).getTime() < Date.now()) return false;
    return true;
}

// respond interested / not_interested — blocked once the deadline passes / closed
async function respondToDrive(req, res) {
    const { response } = req.body;
    if (!['interested', 'not_interested'].includes(response)) {
        return res.status(400).json({ message: 'Response must be "interested" or "not_interested"' });
    }

    const user = await userModel.findById(req.user.id).select('college name');
    if (!user || !user.college) {
        return res.status(403).json({ message: 'You are not linked to any college' });
    }

    const drive = await campusDriveModel.findOne({ _id: req.params.id, college: user.college });
    if (!drive) {
        return res.status(404).json({ message: 'Drive not found' });
    }

    // eligibility check — candidate must belong to the drive's target group
    const inGroup = await studentGroupModel.exists({ _id: drive.targetGroup, students: user._id });
    if (!inGroup) {
        return res.status(403).json({ message: 'You are not eligible for this drive' });
    }

    // deadline / status lock
    if (!isDriveOpen(drive)) {
        return res.status(403).json({ message: 'This drive is closed. Responses are locked.' });
    }

    // upsert — one response per candidate per drive, editable until the deadline
    const saved = await driveResponseModel.findOneAndUpdate(
        { drive: drive._id, candidate: user._id },
        { response, respondedAt: new Date() },
        { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    res.status(200).json({
        message: 'Response recorded successfully',
        response: saved.response
    });
}

module.exports = { respondToDrive };
