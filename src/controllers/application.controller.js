const applicationModel = require('../models/application.model');
const jobModel = require('../models/job.model');
const userModel = require('../models/user.model');
// const { sendEmail } = require('../utils/sendEmail'); // adding email notifications tomorrow

// ─── Candidate ────────────────────────────────────────────────────────────────

async function applyToJob(req, res) {
    const { jobId } = req.params;

    const job = await jobModel.findById(jobId);
    if (!job) {
        return res.status(404).json({ message: 'Job not found' });
    }

    const alreadyApplied = await applicationModel.findOne({
        candidate: req.user.id,
        job: jobId
    });

    if (alreadyApplied) {
        return res.status(409).json({ message: 'You have already applied to this job' });
    }

    const application = await applicationModel.create({
        candidate: req.user.id,
        job: jobId
    });

    // TODO: send confirmation email to candidate
    // const candidate = await userModel.findById(req.user.id);
    // await sendEmail({ to: candidate.email, subject: `Application Submitted – ${job.title}`, html: `...` })

    res.status(201).json({
        message: 'Application submitted successfully',
        application: {
            id: application._id,
            job: application.job,
            status: application.status,
            appliedAt: application.appliedAt
        }
    });
}

async function withdrawApplication(req, res) {
    const { applicationId } = req.params;

    const application = await applicationModel.findOne({
        _id: applicationId,
        candidate: req.user.id
    });

    if (!application) {
        return res.status(404).json({ message: 'Application not found or you are not authorized' });
    }

    await applicationModel.findByIdAndDelete(applicationId);

    res.status(200).json({
        message: 'Application withdrawn successfully'
    });
}

async function getAppliedJobs(req, res) {
    const applications = await applicationModel
        .find({ candidate: req.user.id })
        .populate('job');

    res.status(200).json({
        message: 'Applied jobs fetched successfully',
        applications
    });
}

async function saveJob(req, res) {
    const { jobId } = req.params;

    const job = await jobModel.findById(jobId);
    if (!job) {
        return res.status(404).json({ message: 'Job not found' });
    }

    const user = await userModel.findById(req.user.id);

    if (user.savedJobs.includes(jobId)) {
        return res.status(409).json({ message: 'Job already saved' });
    }

    user.savedJobs.push(jobId);
    await user.save();

    res.status(200).json({
        message: 'Job saved successfully'
    });
}

async function getSavedJobs(req, res) {
    const user = await userModel.findById(req.user.id).populate('savedJobs');

    res.status(200).json({
        message: 'Saved jobs fetched successfully',
        savedJobs: user.savedJobs
    });
}

// ─── Recruiter ────────────────────────────────────────────────────────────────

async function getApplicantsForJob(req, res) {
    const { jobId } = req.params;

    const job = await jobModel.findOne({ _id: jobId, recruiter: req.user.id });

    if (!job) {
        return res.status(404).json({ message: 'Job not found or you are not authorized' });
    }

    const applications = await applicationModel
        .find({ job: jobId })
        .populate('candidate', 'name email skills location resumeUrl');

    res.status(200).json({
        message: 'Applicants fetched successfully',
        applications
    });
}

async function updateApplicationStatus(req, res) {
    const { applicationId } = req.params;
    const { status } = req.body;

    if (!['accepted', 'rejected'].includes(status)) {
        return res.status(400).json({ message: 'Invalid status. Use accepted or rejected' });
    }

    const application = await applicationModel.findById(applicationId).populate('job');

    if (!application) {
        return res.status(404).json({ message: 'Application not found' });
    }

    // make sure recruiter owns this job
    const job = await jobModel.findOne({ _id: application.job._id, recruiter: req.user.id });
    if (!job) {
        return res.status(403).json({ message: 'You are not authorized to update this application' });
    }

    application.status = status;
    await application.save();

    // TODO: notify candidate by email when status changes
    // const candidate = await userModel.findById(application.candidate);
    // await sendEmail({ to: candidate.email, subject, html }).catch(() => {});

    res.status(200).json({
        message: `Application ${status} successfully`,
        application
    });
}

module.exports = {
    applyToJob,
    withdrawApplication,
    getAppliedJobs,
    saveJob,
    getSavedJobs,
    getApplicantsForJob,
    updateApplicationStatus
};
