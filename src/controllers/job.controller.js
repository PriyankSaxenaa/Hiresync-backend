const jobModel = require('../models/job.model');
const { invalidators } = require('../utils/cacheKeys');

// ── Recruiter ──────────────────────────────────────────────────────────────────

async function createJob(req, res) {
    const { title, company, description, skillsRequired, location, salaryRange, applicationDeadline } = req.body;

    const job = await jobModel.create({
        title,
        company,
        description,
        skillsRequired,
        location,
        salaryRange,
        applicationDeadline,
        recruiter: req.user.id
    });

    // a new job invalidates the cached job lists & recommendations
    await invalidators.jobs();

    res.status(201).json({
        message: 'Job created successfully',
        job: {
            id: job._id,
            title: job.title,
            company: job.company,
            location: job.location,
            recruiter: job.recruiter
        }
    });
}

async function updateJob(req, res) {
    const { id } = req.params;

    // make sure recruiter can only edit their own jobs
    const job = await jobModel.findOne({ _id: id, recruiter: req.user.id });

    if (!job) {
        return res.status(404).json({ message: 'Job not found or you are not authorized' });
    }

    const updatedJob = await jobModel.findByIdAndUpdate(id, req.body, { new: true });

    await invalidators.job(id);

    res.status(200).json({
        message: 'Job updated successfully',
        job: updatedJob
    });
}

async function deleteJob(req, res) {
    const { id } = req.params;

    const job = await jobModel.findOne({ _id: id, recruiter: req.user.id });

    if (!job) {
        return res.status(404).json({ message: 'Job not found or you are not authorized' });
    }

    await jobModel.findByIdAndDelete(id);

    await invalidators.job(id);

    res.status(200).json({
        message: 'Job deleted successfully'
    });
}

async function getMyJobs(req, res) {
    const jobs = await jobModel.find({ recruiter: req.user.id });

    res.status(200).json({
        message: 'Jobs fetched successfully',
        jobs
    });
}

// ── Public / Candidate ─────────────────────────────────────────────────────────

async function getAllJobs(req, res) {
    const { keyword, location, skills, page = 1, limit = 10 } = req.query;

    const filter = {};

    if (keyword) {
        filter.$or = [
            { title: { $regex: keyword, $options: 'i' } },
            { company: { $regex: keyword, $options: 'i' } }
        ];
    }

    if (location) {
        filter.location = { $regex: location, $options: 'i' };
    }

    if (skills) {
        filter.skillsRequired = { $in: [new RegExp(skills, 'i')] };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await jobModel.countDocuments(filter);

    const jobs = await jobModel
        .find(filter)
        .populate('recruiter', 'name email')
        .skip(skip)
        .limit(parseInt(limit));

    res.status(200).json({
        message: 'Jobs fetched successfully',
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        jobs
    });
}

async function getJobById(req, res) {
    const { id } = req.params;

    const job = await jobModel.findById(id).populate('recruiter', 'name email');

    if (!job) {
        return res.status(404).json({ message: 'Job not found' });
    }

    res.status(200).json({
        message: 'Job fetched successfully',
        job
    });
}

module.exports = { createJob, updateJob, deleteJob, getMyJobs, getAllJobs, getJobById };