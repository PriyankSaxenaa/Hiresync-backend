const applicationModel = require('../models/application.model');
const jobModel = require('../models/job.model');
const userModel = require('../models/user.model');
const notificationModel = require('../models/notification.model');
const { sendEmail } = require('../utils/sendEmail');
const { emitToUser } = require('../config/socket');

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

    // Email notification to candidate
    const candidate = await userModel.findById(req.user.id);
    await sendEmail({
        to: candidate.email,
        subject: `Application Submitted – ${job.title} at ${job.company}`,
        html: `<p>Hi ${candidate.name},</p><p>Your application for <strong>${job.title}</strong> at <strong>${job.company}</strong> has been submitted successfully.</p>`
    }).catch(() => {}); // silent fail — don't block the response

    // Realtime + stored notification to the recruiter who owns the job
    await notificationModel.create({
        user: job.recruiter,
        type: 'application',
        message: `${candidate.name} applied to your job: ${job.title}`,
        link: `/applications/job/${job._id}/applicants`
    });
    emitToUser(job.recruiter.toString(), 'application:new', {
        jobId: job._id, jobTitle: job.title, candidate: candidate.name
    });

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

    // Make sure recruiter owns this job
    const job = await jobModel.findOne({ _id: application.job._id, recruiter: req.user.id });
    if (!job) {
        return res.status(403).json({ message: 'You are not authorized to update this application' });
    }

    application.status = status;
    await application.save();

    // Email notification to candidate
    const candidate = await userModel.findById(application.candidate);
    const subject = status === 'accepted'
        ? `Congratulations! Your application for ${job.title} was Accepted`
        : `Update on your application for ${job.title}`;

    const html = status === 'accepted'
        ? `<p>Hi ${candidate.name},</p><p>We are pleased to inform you that your application for <strong>${job.title}</strong> at <strong>${job.company}</strong> has been <strong>accepted</strong>.</p>`
        : `<p>Hi ${candidate.name},</p><p>Thank you for applying for <strong>${job.title}</strong> at <strong>${job.company}</strong>. After careful review, we regret to inform you that your application has not been selected at this time.</p>`;

    await sendEmail({ to: candidate.email, subject, html }).catch(() => {});

    // Realtime + stored notification to the candidate
    await notificationModel.create({
        user: candidate._id,
        type: 'application',
        message: `Your application for ${job.title} at ${job.company} was ${status}.`,
        link: `/applications/my-applications`
    });
    emitToUser(candidate._id.toString(), 'application:status', {
        jobTitle: job.title, company: job.company, status
    });

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
