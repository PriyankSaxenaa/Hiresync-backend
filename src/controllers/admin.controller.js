const userModel = require('../models/user.model');
const jobModel = require('../models/job.model');
const applicationModel = require('../models/application.model');
const collegeModel = require('../models/college.model');
const studentGroupModel = require('../models/studentGroup.model');
const placementGroupModel = require('../models/placementGroup.model');
const campusDriveModel = require('../models/campusDrive.model');
const driveResponseModel = require('../models/driveResponse.model');
const notificationModel = require('../models/notification.model');
const { emitToUser } = require('../config/socket');
const { invalidate, invalidators } = require('../utils/cacheKeys');

async function getAllUsers(req, res) {
    const users = await userModel.find().select('-password');

    res.status(200).json({
        message: 'Users fetched successfully',
        users
    });
}

// Deleting a TPO removes everything that only exists because of them —
// their College, its CampusDrives, the DriveResponses to those drives,
// StudentGroups, PlacementGroups, and drive notifications sent to their
// students. It deliberately does NOT delete the student accounts: those are
// real people who existed before this TPO and keep their accounts after —
// they're just unlinked from the (now-deleted) college so nothing dangling
// is left pointing at a college/group that no longer exists.
async function cascadeDeleteTPO(tpoUser) {
    const college = await collegeModel.findOne({ tpo: tpoUser._id });
    if (!college) return null;

    const collegeId = college._id;

    const drives = await campusDriveModel.find({ college: collegeId }).select('_id');
    const driveIds = drives.map(d => d._id);

    const students = await userModel.find({ college: collegeId }).select('_id');
    const studentIds = students.map(s => s._id);

    const [
        driveResponsesResult,
        drivesResult,
        studentGroupsResult,
        placementGroupsResult,
        notificationsResult,
        studentsResult
    ] = await Promise.all([
        driveResponseModel.deleteMany({ drive: { $in: driveIds } }),
        campusDriveModel.deleteMany({ college: collegeId }),
        studentGroupModel.deleteMany({ college: collegeId }),
        placementGroupModel.deleteMany({ college: collegeId }),
        // drive notifications now point at a deleted drive — clean those up,
        // but only for this college's own students, leave everything else alone
        notificationModel.deleteMany({ user: { $in: studentIds }, type: 'drive' }),
        userModel.updateMany(
            { college: collegeId },
            {
                college: null,
                rollNo: '',
                branch: '',
                cgpa: null,
                isImported: false,
                placementGroup: null,
                placementGroupAssignedAt: null
            }
        )
    ]);

    // bust the cached feed for this college before the college itself is gone
    await invalidators.campusDrives(collegeId.toString());

    await collegeModel.findByIdAndDelete(collegeId);

    return {
        collegeDeleted: college.name,
        drivesDeleted: drivesResult.deletedCount,
        driveResponsesDeleted: driveResponsesResult.deletedCount,
        studentGroupsDeleted: studentGroupsResult.deletedCount,
        placementGroupsDeleted: placementGroupsResult.deletedCount,
        driveNotificationsDeleted: notificationsResult.deletedCount,
        studentsUnlinked: studentsResult.modifiedCount
    };
}

// Deleting a recruiter removes every job they posted, every application to
// those jobs (nobody else has any use for an application to a job that no
// longer exists), pulls those jobs out of any candidate's savedJobs list
// (a saved reference to a deleted job is just dead weight), and clears the
// recruiter's own notification inbox. Candidates who applied are untouched
// — their account and their OTHER applications are unaffected.
async function cascadeDeleteRecruiter(recruiterUser) {
    const jobs = await jobModel.find({ recruiter: recruiterUser._id }).select('_id');
    const jobIds = jobs.map(j => j._id);

    const [applicationsResult, savedJobsResult, notificationsResult, jobsResult] = await Promise.all([
        applicationModel.deleteMany({ job: { $in: jobIds } }),
        userModel.updateMany(
            { savedJobs: { $in: jobIds } },
            { $pull: { savedJobs: { $in: jobIds } } }
        ),
        notificationModel.deleteMany({ user: recruiterUser._id }),
        jobModel.deleteMany({ recruiter: recruiterUser._id })
    ]);

    // every deleted job's detail page + every jobs list/recommendation page
    // that might have it cached needs to go stale immediately
    await invalidate([
        ...jobIds.map(id => `jobs:item:${id}`),
        'jobs:list:*',
        'jobs:recommended:*'
    ]);

    return {
        jobsDeleted: jobsResult.deletedCount,
        applicationsDeleted: applicationsResult.deletedCount,
        savedJobsCleanedFrom: savedJobsResult.modifiedCount,
        notificationsDeleted: notificationsResult.deletedCount
    };
}

// Deleting a candidate removes their applications, their responses to
// campus drives, and their notification inbox. Nothing else references a
// candidate by id in a way that needs cleanup — savedJobs lives on their own
// user document (gone with them), and PlacementGroup membership is stored
// only on the User doc too, so it disappears automatically.
async function cascadeDeleteCandidate(candidateUser) {
    const [applicationsResult, driveResponsesResult, notificationsResult] = await Promise.all([
        applicationModel.deleteMany({ candidate: candidateUser._id }),
        driveResponseModel.deleteMany({ candidate: candidateUser._id }),
        notificationModel.deleteMany({ user: candidateUser._id })
    ]);

    await invalidate([`jobs:recommended:${candidateUser._id}`]);

    return {
        applicationsDeleted: applicationsResult.deletedCount,
        driveResponsesDeleted: driveResponsesResult.deletedCount,
        notificationsDeleted: notificationsResult.deletedCount
    };
}

async function deleteUser(req, res) {
    const { id } = req.params;

    const user = await userModel.findById(id);
    if (!user) {
        return res.status(404).json({ message: 'User not found' });
    }

    let cascade = null;
    if (user.role === 'tpo') {
        cascade = await cascadeDeleteTPO(user);
    } else if (user.role === 'recruiter') {
        cascade = await cascadeDeleteRecruiter(user);
    } else if (user.role === 'candidate') {
        cascade = await cascadeDeleteCandidate(user);
    }
    // admin accounts have nothing to cascade

    await userModel.findByIdAndDelete(id);

    // real-time push — if this user has an active socket connection right
    // now, they get logged out instantly. If they're offline, the auth
    // middleware (see auth.middleware.js) catches it on their next request.
    emitToUser(id, 'account:deleted', {
        message: 'Your account has been deleted by an administrator.'
    });

    res.status(200).json({
        message: 'User deleted successfully',
        cascade
    });
}

async function getAllJobsAdmin(req, res) {
    const jobs = await jobModel.find().populate('recruiter', 'name email');

    res.status(200).json({
        message: 'All jobs fetched successfully',
        jobs
    });
}

module.exports = { getAllUsers, deleteUser, getAllJobsAdmin };