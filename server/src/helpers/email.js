// Sends email over SMTP. Configure SMTP_HOST and friends in server/.env; see DEPLOYMENT.md.
import nodemailer from 'nodemailer';
import config from '../config/index.js';

let override = null;
let transport = null;

// Tests swap in a fake that records messages instead of sending them. Pass null to undo.
export function useTransport(fake) {
  override = fake;
}

export function isEmailConfigured() {
  return Boolean(config.mail.host);
}

function getTransport() {
  if (override) return override;
  if (!config.mail.host) return null;
  transport ??= nodemailer.createTransport({
    host: config.mail.host,
    port: config.mail.port,
    secure: config.mail.secure,
    auth: config.mail.user ? { user: config.mail.user, pass: config.mail.pass } : undefined,
  });
  return transport;
}

export async function sendEmail({ to, subject, text, html }) {
  const mailer = getTransport();

  if (!mailer) {
    if (config.env === 'development') {
      // So the flow can be tried locally without a mail server
      console.log(`\n[email not sent: SMTP_HOST is not set]\nTo: ${to}\nSubject: ${subject}\n\n${text}\n`);
    } else if (config.env === 'production') {
      console.error(`Could not email ${to}: SMTP_HOST is not set, so "${subject}" was not sent.`);
    }
    return { skipped: true };
  }

  await mailer.sendMail({ from: config.mail.from, to, subject, text, html });
  return { sent: true };
}

// Sends without making the request wait. A slow or broken mail server can't delay the page, and
// the response takes the same time whether or not the address has an account, so timing can't
// be used to find out who is registered.
export function sendInBackground(message) {
  sendEmail(message).catch((err) => {
    console.error(`Could not email ${message.to}: ${err.message}`);
  });
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
}

export function passwordResetEmail({ to, name, resetUrl }) {
  const text = [
    `Hi ${name},`,
    '',
    'Someone asked to reset the password for your ThesisTrack account. To choose a new password, open:',
    '',
    resetUrl,
    '',
    'The link works once and expires in 1 hour.',
    '',
    "If you didn't ask for this, ignore this email. Your password won't change.",
  ].join('\n');

  const html = `
    <p>Hi ${escapeHtml(name)},</p>
    <p>Someone asked to reset the password for your ThesisTrack account.</p>
    <p><a href="${escapeHtml(resetUrl)}">Choose a new password</a></p>
    <p>The link works once and expires in 1 hour.</p>
    <p style="color:#6a7389">If you didn't ask for this, ignore this email. Your password won't change.</p>
  `;

  return { to, subject: 'Reset your ThesisTrack password', text, html };
}
