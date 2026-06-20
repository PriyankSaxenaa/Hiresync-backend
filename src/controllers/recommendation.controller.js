const jobModel = require('../models/job.model');
const userModel = require('../models/user.model');
const { matchScore } = require('../utils/matchScore');

// ─── Candidate ────────────────────────────────────────────────────────────────

async function getRecommendedJobs(req, res) {
    const user = await userModel.findById(req.user.id).select('skills');

    if (!user) {
        return res.status(404).json({ message: 'User not found' });
    }

    if (!user.skills || user.skills.length === 0) {
        return res.status(400).json({
            message: 'No skills found on your profile. Upload your resume or update your profile to get job recommendations.'
        });
    }

    const jobs = await jobModel.find().populate('recruiter', 'name email');

    // score every job against the candidate's skills
    const scored = jobs.map(job => {
        const { score, matchedSkills, missingSkills } = matchScore(user.skills, job.skillsRequired);
        return { job, score, matchedSkills, missingSkills };
    });

    // only jobs with at least one matching skill are worth recommending, ranked high to low
    const recommended = scored
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score);

    res.status(200).json({
        message: 'Recommended jobs fetched successfully',
        candidateSkills: user.skills,
        total: recommended.length,
        recommendations: recommended.map(item => ({
            job: item.job,
            matchScore: item.score,
            matchedSkills: item.matchedSkills,
            missingSkills: item.missingSkills
        }))
    });
}

// ─── Recruiter ────────────────────────────────────────────────────────────────

async function getRecommendedCandidates(req, res) {
    const { jobId } = req.params;

    // make sure the recruiter owns this job, same check used everywhere else for job ownership
    const job = await jobModel.findOne({ _id: jobId, recruiter: req.user.id });

    if (!job) {
        return res.status(404).json({ message: 'Job not found or you are not authorized' });
    }

    if (!job.skillsRequired || job.skillsRequired.length === 0) {
        return res.status(400).json({ message: 'This job has no required skills set, so candidates cannot be matched' });
    }

    // only consider candidates who have at least one skill on their profile
    const candidates = await userModel
        .find({ role: 'candidate', skills: { $exists: true, $not: { $size: 0 } } })
        .select('name email skills location resumeUrl');

    // score every candidate against this job's required skills
    const scored = candidates.map(candidate => {
        const { score, matchedSkills, missingSkills } = matchScore(candidate.skills, job.skillsRequired);
        return { candidate, score, matchedSkills, missingSkills };
    });

    // only candidates with at least one matching skill are worth surfacing, ranked high to low
    const recommended = scored
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score);

    res.status(200).json({
        message: 'Recommended candidates fetched successfully',
        job: {
            id: job._id,
            title: job.title,
            skillsRequired: job.skillsRequired
        },
        total: recommended.length,
        recommendations: recommended.map(item => ({
            candidate: item.candidate,
            matchScore: item.score,
            matchedSkills: item.matchedSkills,
            missingSkills: item.missingSkills
        }))
    });
}

module.exports = { getRecommendedJobs, getRecommendedCandidates };
