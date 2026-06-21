const collegeModel = require('../models/college.model');
const userModel = require('../models/user.model');

// ── TPO ─────────────────────────────────────────────────────────────────────────

// A logged-in TPO registers the college they belong to. One college per TPO.
// Starts unverified — an admin must verify it before drives go live.
async function registerCollege(req, res) {
    const { name, address, website } = req.body;

    // a TPO can only own one college
    const existing = await collegeModel.findOne({ tpo: req.user.id });
    if (existing) {
        return res.status(409).json({ message: 'You have already registered a college' });
    }

    const college = await collegeModel.create({
        name,
        address,
        website,
        tpo: req.user.id
    });

    // link the TPO's own user record to the college
    await userModel.findByIdAndUpdate(req.user.id, { college: college._id });

    res.status(201).json({
        message: 'College registered successfully. Awaiting admin verification.',
        college
    });
}

// ── Admin ─────────────────────────────────────────────────────────────────────

async function getAllColleges(req, res) {
    const colleges = await collegeModel.find().populate('tpo', 'name email');

    res.status(200).json({
        message: 'Colleges fetched successfully',
        total: colleges.length,
        colleges
    });
}

async function verifyCollege(req, res) {
    const { id } = req.params;

    const college = await collegeModel.findByIdAndUpdate(
        id,
        { isVerified: true },
        { new: true }
    );

    if (!college) {
        return res.status(404).json({ message: 'College not found' });
    }

    res.status(200).json({
        message: 'College verified successfully',
        college
    });
}

// ── Any logged-in user ──────────────────────────────────────────────────────────

async function getCollegeById(req, res) {
    const { id } = req.params;

    const college = await collegeModel.findById(id).populate('tpo', 'name email');

    if (!college) {
        return res.status(404).json({ message: 'College not found' });
    }

    res.status(200).json({
        message: 'College fetched successfully',
        college
    });
}

module.exports = { registerCollege, getAllColleges, verifyCollege, getCollegeById };
