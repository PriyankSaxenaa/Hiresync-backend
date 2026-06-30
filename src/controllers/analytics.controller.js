const jobModel = require('../models/job.model');
const applicationModel = require('../models/application.model');

// Recruiter hiring funnel: jobs posted, applications received, and how they
// break down by status (pending / accepted / rejected).
async function recruiterDashboard(req, res) {
    // all jobs owned by this recruiter
    const jobs = await jobModel.find({ recruiter: req.user.id }).select('_id title');
    const jobIds = jobs.map(j => j._id);

    const applications = await applicationModel.find({ job: { $in: jobIds } }).select('status job');

    const byStatus = { pending: 0, accepted: 0, rejected: 0 };
    applications.forEach(a => {
        byStatus[a.status] = (byStatus[a.status] || 0) + 1;
    });

    // per-job application counts
    const perJob = jobs.map(j => ({
        jobId: j._id,
        title: j.title,
        applications: applications.filter(a => a.job.toString() === j._id.toString()).length
    }));

    const totalApplications = applications.length;

    res.status(200).json({
        message: 'Recruiter analytics fetched successfully',
        analytics: {
            jobsPosted: jobIds.length,
            totalApplications,
            funnel: {
                applied: totalApplications,
                pending: byStatus.pending,
                accepted: byStatus.accepted,
                rejected: byStatus.rejected
            },
            acceptanceRate: totalApplications
                ? Math.round((byStatus.accepted / totalApplications) * 100)
                : 0,
            perJob
        }
    });
}

module.exports = { recruiterDashboard };
