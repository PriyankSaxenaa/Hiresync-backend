const SibApiV3Sdk = require('sib-api-v3-sdk');

const defaultClient = SibApiV3Sdk.ApiClient.instance;
defaultClient.authentications['api-key'].apiKey = process.env.BREVO_API_KEY;

const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();

// Same signature as before — every existing caller (sendOtp, application
// controller, sendBatchEmails, tpo import) needs zero changes.
async function sendEmail({ to, subject, html }) {
    const email = new SibApiV3Sdk.SendSmtpEmail();
    email.sender = { email: process.env.EMAIL_FROM, name: 'HireSync' };
    email.to = [{ email: to }];
    email.subject = subject;
    email.htmlContent = html;

    try {
        await apiInstance.sendTransacEmail(email);
    } catch (err) {
        throw new Error(err.response?.body?.message || err.message || 'Failed to send email');
    }
}

// Unchanged — chunked batch sending, one failed email never sinks the rest.
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