const mongoose = require('mongoose');

const collegeSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    address: {
        type: String,
        default: ''
    },
    website: {
        type: String,
        default: ''
    },
    // admin flips this on after verifying the college is legit
    isVerified: {
        type: Boolean,
        default: false
    },
    // the TPO who registered / owns this college
    tpo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
}, { timestamps: true });

const collegeModel = mongoose.model('College', collegeSchema);
module.exports = collegeModel;
