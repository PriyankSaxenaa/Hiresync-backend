const cloudinary = require('../config/cloudinary');
const userModel = require('../models/user.model');
const { extractSkills } = require('../utils/skillExtractor');
const { PDFParse, VerbosityLevel } = require('pdf-parse');

async function uploadResume(req, res) {
    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
    }

    // buffer seedha cloudinary ko bhejo
    const uploadResult = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            { folder: 'resumes', resource_type: 'raw' },
            (error, result) => {
                if (error) reject(error);
                else resolve(result);
            }
        );
        stream.end(req.file.buffer);
    });

    const resumeUrl = uploadResult.secure_url;

    // verbosity dena zaroori hai, warna constructor crash karta hai
    const parser = new PDFParse({
        verbosity: VerbosityLevel.ERRORS,
        data: req.file.buffer
    });
    const pdfData = await parser.getText();
    const extractedText = pdfData.text;

    const skills = extractSkills(extractedText);

    const user = await userModel.findByIdAndUpdate(
        req.user.id,
        {
            resumeUrl,
            $addToSet: { skills: { $each: skills } }
        },
        { new: true }
    ).select('-password');

    res.status(200).json({
        message: 'Resume uploaded and parsed successfully',
        resumeUrl,
        extractedSkills: skills,
        allSkills: user.skills
    });
}

module.exports = { uploadResume };