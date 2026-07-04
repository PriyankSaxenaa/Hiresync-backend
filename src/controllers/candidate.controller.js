const userModel = require('../models/user.model');

async function updateProfile(req, res) {
    const { name, skills, location, resumeUrl, profilePhoto } = req.body;

    const updatedUser = await userModel.findByIdAndUpdate(
        req.user.id,
        { name, skills, location, resumeUrl, profilePhoto },
        { new: true, runValidators: true }
    ).select('-password');

    if (!updatedUser) {
        return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json({
        message: 'Profile updated successfully',
        user: updatedUser
    });
}

async function getProfile(req, res) {
    // populate college so on-campus candidates can see their campus name,
    // address, website and verification status without a separate call
    const user = await userModel
        .findById(req.user.id)
        .select('-password')
        .populate('college', 'name address website isVerified');

    if (!user) {
        return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json({
        message: 'Profile fetched successfully',
        user
    });
}

module.exports = { updateProfile, getProfile };