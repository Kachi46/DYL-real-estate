const nodemailer = require("nodemailer");

// A single shared transport for the whole backend. Previously auth.js
// built its own private copy of this exact same setup just for password
// reset/verification emails - as soon as a second feature (listing
// status / new-lead notifications) needed to send mail too, that
// duplication would only get worse, so it's centralized here instead.
const mailer = process.env.SMTP_HOST
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === "true",
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
        : undefined,
    })
  : null;

// Best-effort by design: every caller already wraps this in its own
// try/catch (or awaits it fire-and-forget) because a notification email
// failing to send should never fail the request that triggered it - the
// underlying action (registration, a submitted inquiry, an admin
// decision) already succeeded and is real regardless of whether the
// email arrives.
async function sendMail({ to, subject, text, html }) {
  if (!mailer) {
    console.log(`[mail] to ${to} — ${subject}\n${text}`);
    return;
  }

  await mailer.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject,
    text,
    html,
  });
}

module.exports = { sendMail };
