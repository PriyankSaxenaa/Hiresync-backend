const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const xlsx = require('xlsx');

const userModel = require('../models/user.model');
const collegeModel = require('../models/college.model');

const { sendBatchEmails } = require('../utils/sendEmail');

// ── Helpers ─────────────────────────────────────────────────────────────────────

// Resolve the college owned by the requesting TPO. Returns the college doc or
// sends a 4xx and returns null (caller should bail when null).
async function resolveCollege(req, res) {
    const college = await collegeModel.findOne({ tpo: req.user.id });
    if (!college) {
        res.status(404).json({ message: 'No college registered for this TPO. Register a college first.' });
        return null;
    }
    return college;
}

// normalise a comma-separated skills cell into a clean lowercase array
function parseSkills(value) {
    if (!value) return [];
    return String(value)
        .split(',')
        .map(s => s.trim().toLowerCase())
        .filter(Boolean);
}

// pick a column value regardless of header casing / spacing variations
function pick(row, ...keys) {
    for (const k of keys) {
        if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== '') {
            return String(row[k]).trim();
        }
    }
    return '';
}

// ── Student Import ────────────────────────────────────────────────────────────

async function importStudents(req, res) {
    const college = await resolveCollege(req, res);
    if (!college) return;

    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded. Upload an Excel/CSV sheet.' });
    }

    // parse the sheet → array of row objects keyed by header
    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(sheet, { defval: '' });

    if (!rows.length) {
        return res.status(400).json({ message: 'The sheet is empty or has no data rows.' });
    }

    const summary = { totalRows: rows.length, created: 0, linked: 0, skipped: 0, errors: [] };
    const credentialEmails = []; // queued, sent in batches at the end
    const seenRolls = new Set(); // dedupe within the sheet itself

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const name = pick(row, 'name', 'Name', 'NAME');
        const email = pick(row, 'email', 'Email', 'EMAIL').toLowerCase();
        const rollNo = pick(row, 'roll_no', 'rollNo', 'Roll No', 'roll no', 'RollNo');
        const branch = pick(row, 'branch', 'Branch', 'BRANCH');
        const cgpaRaw = pick(row, 'cgpa', 'CGPA', 'Cgpa');
        const skills = parseSkills(pick(row, 'skills', 'Skills', 'SKILLS'));

        // basic row validation
        if (!name || !email || !rollNo) {
            summary.skipped += 1;
            summary.errors.push({ row: i + 2, reason: 'Missing name, email or roll_no' });
            continue;
        }

        // roll_no is unique per college — guard against duplicates within the sheet
        if (seenRolls.has(rollNo)) {
            summary.skipped += 1;
            summary.errors.push({ row: i + 2, rollNo, reason: 'Duplicate roll_no in sheet' });
            continue;
        }
        seenRolls.add(rollNo);

        const cgpa = cgpaRaw !== '' && !isNaN(Number(cgpaRaw)) ? Number(cgpaRaw) : null;

        try {
            const existing = await userModel.findOne({ email });

            if (existing) {
                // DUPLICATE EMAIL → link to this college, don't recreate, don't email.
                // Merge sheet skills into whatever they already have.
                existing.college = college._id;
                existing.rollNo = rollNo;
                existing.branch = branch;
                existing.cgpa = cgpa;
                existing.isImported = true;
                if (existing.role === 'candidate') {
                    const merged = new Set([...(existing.skills || []), ...skills]);
                    existing.skills = [...merged];
                }
                await existing.save();
                summary.linked += 1;
            } else {
                // NEW → create account with a temp password, queue a credentials email
                const tempPassword = crypto.randomBytes(5).toString('hex'); // 10-char temp pwd
                const hash = await bcrypt.hash(tempPassword, 10);

                await userModel.create({
                    name,
                    email,
                    password: hash,
                    role: 'candidate',
                    college: college._id,
                    rollNo,
                    branch,
                    cgpa,
                    skills,
                    isImported: true
                });

                credentialEmails.push({
                    to: email,
                    subject: `Your ${college.name} placement portal account`,
                    html: `
                        <p>Hi ${name},</p>
                        <p>An account has been created for you on the placement portal by your college (<strong>${college.name}</strong>).</p>
                        <p><strong>Login email:</strong> ${email}<br/>
                        <strong>Temporary password:</strong> ${tempPassword}</p>
                        <p>Please log in and update your password and profile (resume + skills) as soon as possible.</p>
                    `
                });
                summary.created += 1;
            }
        } catch (err) {
            summary.skipped += 1;
            summary.errors.push({ row: i + 2, email, reason: err.message });
        }
    }

    // batch-send credential emails in chunks of 50 (non-blocking failures)
    let emailResult = { total: 0, sent: 0, failed: 0 };
    if (credentialEmails.length) {
        emailResult = await sendBatchEmails(credentialEmails, 50);
    }

    res.status(200).json({
        message: 'Import complete',
        summary,
        emails: emailResult
    });
}

async function getStudents(req, res) {
    const college = await resolveCollege(req, res);
    if (!college) return;

    const students = await userModel
        .find({ role: 'candidate', college: college._id })
        .select('-password')
        .sort({ rollNo: 1 });

    res.status(200).json({
        message: 'Students fetched successfully',
        total: students.length,
        students
    });
}

async function getStudentById(req, res) {
    const college = await resolveCollege(req, res);
    if (!college) return;

    const student = await userModel
        .findOne({ _id: req.params.id, college: college._id, role: 'candidate' })
        .select('-password');

    if (!student) {
        return res.status(404).json({ message: 'Student not found in your college' });
    }

    res.status(200).json({ message: 'Student fetched successfully', student });
}

module.exports = {
    importStudents,
    getStudents,
    getStudentById
};
