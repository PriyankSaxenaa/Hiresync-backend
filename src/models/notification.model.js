const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    // who this notification is for
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    type: {
        type: String,        // e.g. 'drive', 'application', 'shortlist'
        default: 'general'
    },
    message: {
        type: String,
        required: true,
    },
    // optional deep-link the frontend can route to (e.g. /campus/drives/:id)
    link: {
        type: String,
        default: ''
    },
    read: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

const notificationModel = mongoose.model('Notification', notificationSchema);
module.exports = notificationModel;
