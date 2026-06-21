const notificationModel = require('../models/notification.model');

// list the logged-in user's notifications, newest first, with an unread count
async function getNotifications(req, res) {
    const notifications = await notificationModel
        .find({ user: req.user.id })
        .sort({ createdAt: -1 })
        .limit(100);

    const unread = notifications.filter(n => !n.read).length;

    res.status(200).json({
        message: 'Notifications fetched successfully',
        unread,
        notifications
    });
}

// mark notifications read. Pass { ids: [...] } to mark specific ones, or send no
// body to mark everything read.
async function markRead(req, res) {
    const { ids } = req.body || {};

    const filter = { user: req.user.id };
    if (Array.isArray(ids) && ids.length) {
        filter._id = { $in: ids };
    }

    const result = await notificationModel.updateMany(filter, { read: true });

    res.status(200).json({
        message: 'Notifications marked as read',
        modified: result.modifiedCount
    });
}

module.exports = { getNotifications, markRead };
