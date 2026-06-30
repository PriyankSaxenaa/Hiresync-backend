const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE || 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    }
});

async function sendEmail({ to, subject, html }) {
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to,
        subject,
        html
    };
    await transporter.sendMail(mailOptions);
}

// Send a batch of emails in chunks (default 50) so a big import (e.g. a whole
// batch of imported students getting credentials) doesn't open hundreds of SMTP
// connections at once or trip provider rate limits. One failed email never sinks
// the rest — we use allSettled and report a summary.
//
// messages = [{ to, subject, html }]
async function sendBatchEmails(messages = [], chunkSize = 50) {
    let sent = 0;
    let failed = 0;

    for (let i = 0; i < messages.length; i += chunkSize) {
        const chunk = messages.slice(i, i + chunkSize);
        const results = await Promise.allSettled(chunk.map(m => sendEmail(m)));
        results.forEach((r) => {
            if (r.status === 'fulfilled') sent += 1;
            else failed += 1;
        });
    }

    return { total: messages.length, sent, failed };
}

module.exports = { sendEmail, sendBatchEmails };
