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
  return Boolean(override || config.mail.host);
}

// Safe to show an admin: where mail goes and who it's from, never the login
export function emailSettings() {
  return {
    configured: isEmailConfigured(),
    host: config.mail.host || null,
    port: config.mail.host ? config.mail.port : null,
    from: config.mail.from,
  };
}

const SECONDS = 1000;

function getTransport() {
  if (override) return override;
  if (!config.mail.host) return null;
  transport ??= nodemailer.createTransport({
    host: config.mail.host,
    port: config.mail.port,
    secure: config.mail.secure,
    auth: config.mail.user ? { user: config.mail.user, pass: config.mail.pass } : undefined,
    // Give up on an unreachable server instead of leaving a send or check waiting for minutes
    connectionTimeout: 10 * SECONDS,
    greetingTimeout: 10 * SECONDS,
    socketTimeout: 20 * SECONDS,
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

// Turns a mail server error into what to change. Nodemailer sets err.code; the raw message is kept
// at the end, since it often names the exact problem.
export function explainEmailError(err) {
  const { host, port } = config.mail;
  const hints = {
    EAUTH: 'The mail server rejected SMTP_USER and SMTP_PASS. With Gmail, SMTP_PASS must be an app password, not the account password.',
    EDNS: `SMTP_HOST "${host}" could not be found. Check the spelling.`,
    ECONNECTION: `Could not connect to ${host} on port ${port}. Check SMTP_HOST and SMTP_PORT, and that this network allows outgoing mail.`,
    ETIMEDOUT: `${host} did not answer on port ${port}. Check SMTP_PORT (465 or 587), and that this network allows outgoing mail.`,
    ESOCKET: `The secure connection to ${host} failed. Use port 465, or port 587 with SMTP_SECURE=false.`,
    ETLS: `The secure connection to ${host} failed. Use port 465, or port 587 with SMTP_SECURE=false.`,
    EENVELOPE: 'The mail server refused the sender or recipient address. Check that MAIL_FROM is an address SMTP_USER is allowed to send from.',
    EMESSAGE: 'The mail server refused the message. Check that MAIL_FROM is an address SMTP_USER is allowed to send from.',
  };
  const hint = hints[err.code];
  return hint ? `${hint} (${err.message})` : err.message;
}

// Logs in to the mail server without sending anything. Returns { ok } or { ok: false, error }.
export async function checkEmailConnection() {
  const mailer = getTransport();
  if (!mailer) return { ok: false, error: 'SMTP_HOST is not set.' };
  if (typeof mailer.verify !== 'function') return { ok: true };
  try {
    await mailer.verify();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: explainEmailError(err) };
  }
}

// Sends without making the request wait. A slow or broken mail server can't delay the page, and
// the response takes the same time whether or not the address has an account, so timing can't
// be used to find out who is registered.
export function sendInBackground(message) {
  sendEmail(message).catch((err) => {
    console.error(`Could not email ${message.to}: ${explainEmailError(err)}`);
  });
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
}

export function verifyEmailEmail({ to, name, verifyUrl, hours }) {
  const text = [
    `Hi ${name},`,
    '',
    'Welcome to ThesisTrack. Confirm this is your email address by opening:',
    '',
    verifyUrl,
    '',
    `The link works once and expires in ${hours} hours. Until you confirm, you can sign in but can't start or join a thesis group.`,
    '',
    "If you didn't create this account, ignore this email.",
  ].join('\n');

  const html = `
    <p>Hi ${escapeHtml(name)},</p>
    <p>Welcome to ThesisTrack. Confirm this is your email address:</p>
    <p><a href="${escapeHtml(verifyUrl)}">Verify my email</a></p>
    <p>The link works once and expires in ${hours} hours. Until you confirm, you can sign in but can't start or join a thesis group.</p>
    <p style="color:#6a7389">If you didn't create this account, ignore this email.</p>
  `;

  return { to, subject: 'Verify your ThesisTrack email address', text, html };
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

export function testEmail({ to, name }) {
  const text = [
    `Hi ${name},`,
    '',
    'This is a test email from ThesisTrack. Email is working: password reset and verification links will reach your users.',
    '',
    `Sent as ${config.mail.from}${config.mail.host ? ` through ${config.mail.host}` : ''}.`,
  ].join('\n');

  const html = `
    <p>Hi ${escapeHtml(name)},</p>
    <p>This is a test email from ThesisTrack. Email is working: password reset and verification links will reach your users.</p>
    <p style="color:#6a7389">Sent as ${escapeHtml(config.mail.from)}${config.mail.host ? ` through ${escapeHtml(config.mail.host)}` : ''}.</p>
  `;

  return { to, subject: 'ThesisTrack test email', text, html };
}
