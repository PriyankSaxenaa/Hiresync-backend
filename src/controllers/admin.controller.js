const userModel = require('../models/user.model');
const jobModel = require('../models/job.model');
const { emitToUser } = require('../config/socket');

async function getAllUsers(req, res) {
    const users = await userModel.find().select('-password');

    res.status(200).json({
        message: 'Users fetched successfully',
        users
    });
}

async function deleteUser(req, res) {
    const { id } = req.params;

    const user = await userModel.findByIdAndDelete(id);

    if (!user) {
        return res.status(404).json({ message: 'User not found' });
    }

    // real-time push — if this user has an active socket connection right
    // now, they get logged out instantly. If they're offline, the auth
    // middleware (see auth.middleware.js) catches it on their next request.
    emitToUser(id, 'account:deleted', {
        message: 'Your account has been deleted by an administrator.'
    });

    res.status(200).json({
        message: 'User deleted successfully'
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