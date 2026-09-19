// Sends email over SMTP. Configure SMTP_HOST and friends in server/.env; see DEPLOYMENT.md.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
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

// The sidebar's ring logo in white, for the blue banner and footer, drawn at 3x so it stays sharp on high-density screens
const LOGO_PATH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../email-images/logo-white.png');
const LOGO_CID = 'thesistrack-logo';

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

  // The logo travels inside the message, so it shows even where remote images are blocked
  const attachments = html?.includes(`cid:${LOGO_CID}`) ? [{ filename: 'thesistrack.png', path: LOGO_PATH, cid: LOGO_CID }] : [];
  await mailer.sendMail({ from: config.mail.from, to, subject, text, html, attachments });
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

// The web app's colors and font (client/src/styles/index.css). Mail clients ignore <style> blocks
// unevenly, so every rule is written inline and the layout is built from tables.
const COLOR = {
  page: '#f3f6fc',
  card: '#ffffff',
  border: '#e3e8f3',
  text: '#0f1629',
  body: '#455069',
  muted: '#5f687d',
  primary: '#2451d6',
  primarySoft: '#eaf0ff',
  primaryText: '#1a3a9c',
};
const FONT = "'Plus Jakarta Sans', 'Inter', -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

function paragraph(html, { color = COLOR.body, size = 15 } = {}) {
  return `<p style="margin:0 0 16px;font-family:${FONT};font-size:${size}px;line-height:1.6;color:${color}">${html}</p>`;
}

// A pill button like the web app's, made of a table cell so Outlook draws it too
function button({ label, url }) {
  return `
    <table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0" style="margin:8px auto 28px">
      <tr>
        <td bgcolor="${COLOR.primary}" style="border-radius:999px">
          <a href="${escapeHtml(url)}" target="_blank" style="display:inline-block;padding:13px 32px;border-radius:999px;font-family:${FONT};font-size:15px;font-weight:600;line-height:1.2;color:#ffffff;text-decoration:none">${escapeHtml(label)}</a>
        </td>
      </tr>
    </table>`;
}

// Names the thing the email is about, as a rounded chip
function chip(label) {
  return `
    <table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0" style="margin:4px auto 24px">
      <tr>
        <td align="center" style="padding:10px 18px;border:1px solid ${COLOR.border};border-radius:10px;background:${COLOR.primarySoft};font-family:${FONT};font-size:15px;font-weight:600;line-height:1.4;color:${COLOR.primaryText}">${escapeHtml(label)}</td>
      </tr>
    </table>`;
}

// For when the button doesn't work: the same link, written out
function linkFallback(url) {
  return paragraph(
    `If the button doesn't work, copy this link into your browser:<br><a href="${escapeHtml(url)}" target="_blank" style="color:${COLOR.primary};word-break:break-all">${escapeHtml(url)}</a>`,
    { color: COLOR.muted, size: 13 },
  );
}

// Logo and wordmark side by side, in white for the blue bands
function brand({ logoSize, fontSize, color = '#ffffff' }) {
  return `
    <table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td style="padding-right:10px"><img src="cid:${LOGO_CID}" width="${logoSize}" height="${logoSize}" alt="" style="display:block;border:0;outline:none;width:${logoSize}px;height:${logoSize}px"></td>
        <td style="font-family:${FONT};font-size:${fontSize}px;font-weight:600;letter-spacing:-0.03em;color:${color}">ThesisTrack</td>
      </tr>
    </table>`;
}

// The web app's sign-in panel: deep blue with a lighter glow in one corner. Clients that drop
// gradients fall back to the solid bgcolor.
const BANNER_BG = `background-color:#1a3aa8;background-image:radial-gradient(120% 90% at 90% 100%, rgba(96,140,255,0.45) 0%, transparent 55%),linear-gradient(160deg,#0b1a55 0%,#1a3aa8 55%,#0a1648 100%)`;

// Every email shares this frame: a blue banner with the logo, a centered title, the body, and a
// blue footer that says why the email was sent. `preheader` is the preview line inboxes show
// after the subject.
function layout({ preheader, title, body, reason }) {
  const year = new Date().getFullYear();
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>${escapeHtml(title)}</title>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:${COLOR.page}">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${escapeHtml(preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${COLOR.page}" style="background:${COLOR.page}">
    <tr>
      <td align="center" style="padding:40px 16px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;border-collapse:separate">
          <tr>
            <td align="center" bgcolor="#1a3aa8" style="padding:36px 32px;border-radius:22px 22px 0 0;${BANNER_BG}">
              ${brand({ logoSize: 36, fontSize: 24 })}
            </td>
          </tr>
          <tr>
            <td bgcolor="${COLOR.card}" style="padding:40px 40px 16px;background:${COLOR.card};border-left:1px solid ${COLOR.border};border-right:1px solid ${COLOR.border}">
              <h1 style="margin:0 0 24px;font-family:${FONT};font-size:26px;font-weight:600;line-height:1.3;letter-spacing:-0.02em;text-align:center;color:${COLOR.text}">${escapeHtml(title)}</h1>
              ${body}
            </td>
          </tr>
          <tr>
            <td align="center" bgcolor="#0f2a7a" style="padding:28px 32px;border-radius:0 0 22px 22px;background:#0f2a7a">
              ${brand({ logoSize: 22, fontSize: 16 })}
              <p style="margin:12px 0 0;font-family:${FONT};font-size:12px;line-height:1.6;text-align:center;color:#c3d1fb">
                Thesis Management System<br>
                ${escapeHtml(reason)}<br>
                © ${year} ThesisTrack
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
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

  const html = layout({
    preheader: `Confirm your email to start or join a thesis group. The link expires in ${hours} hours.`,
    title: 'Confirm your email address',
    reason: `You received this email because a ThesisTrack account was created with ${to}.`,
    body: [
      paragraph(`Hi ${escapeHtml(name)},`, { color: COLOR.text }),
      paragraph("Welcome to ThesisTrack. Confirm this is your email address, and you'll be able to start or join a thesis group."),
      button({ label: 'Verify my email', url: verifyUrl }),
      paragraph(`The link works once and expires in ${hours} hours. Until you confirm, you can sign in but can't start or join a thesis group.`),
      linkFallback(verifyUrl),
      paragraph("If you didn't create this account, ignore this email.", { color: COLOR.muted, size: 13 }),
    ].join(''),
  });

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

  const html = layout({
    preheader: 'Choose a new password for your ThesisTrack account. The link expires in 1 hour.',
    title: 'Reset your password',
    reason: `You received this email because a password reset was requested for ${to}.`,
    body: [
      paragraph(`Hi ${escapeHtml(name)},`, { color: COLOR.text }),
      paragraph('Someone asked to reset the password for your ThesisTrack account:'),
      chip(to),
      button({ label: 'Choose a new password', url: resetUrl }),
      paragraph('The link works once and expires in 1 hour.'),
      linkFallback(resetUrl),
      paragraph("If you didn't ask for this, ignore this email. Your password won't change.", { color: COLOR.muted, size: 13 }),
    ].join(''),
  });

  return { to, subject: 'Reset your ThesisTrack password', text, html };
}

// `headline` and `detail` are the same words as the in-app notification, so both say one thing
export function deadlineReminderEmail({ to, name, headline, detail, thesisTitle, thesisUrl }) {
  const text = [
    `Hi ${name},`,
    '',
    `${headline}.`,
    '',
    detail,
    `Thesis: ${thesisTitle}`,
    '',
    `Open your thesis: ${thesisUrl}`,
  ].join('\n');

  const html = layout({
    preheader: detail,
    title: headline,
    reason: 'You received this email because you are a member of this thesis group on ThesisTrack.',
    body: [
      paragraph(`Hi ${escapeHtml(name)},`, { color: COLOR.text }),
      paragraph(escapeHtml(detail)),
      chip(thesisTitle),
      button({ label: 'Open your thesis', url: thesisUrl }),
    ].join(''),
  });

  return { to, subject: `ThesisTrack: ${headline}`, text, html };
}

export function testEmail({ to, name }) {
  const sentVia = `Sent as ${config.mail.from}${config.mail.host ? ` through ${config.mail.host}` : ''}.`;
  const text = [
    `Hi ${name},`,
    '',
    'This is a test email from ThesisTrack. Email is working: password reset and verification links will reach your users.',
    '',
    sentVia,
  ].join('\n');

  const html = layout({
    preheader: 'Email is working: password reset and verification links will reach your users.',
    title: 'Email is working',
    reason: 'You received this email because you sent a test from the ThesisTrack admin dashboard.',
    body: [
      paragraph(`Hi ${escapeHtml(name)},`, { color: COLOR.text }),
      paragraph('This is a test email from ThesisTrack. Password reset and verification links will reach your users.'),
      paragraph(escapeHtml(sentVia), { color: COLOR.muted, size: 13 }),
    ].join(''),
  });

  return { to, subject: 'ThesisTrack test email', text, html };
}
