import { checkEmailConnection, emailSettings, explainEmailError, sendEmail, testEmail } from '../helpers/email.js';
import { HttpError } from '../helpers/httpError.js';

// Settings only; it doesn't contact the mail server, so the page can load it freely
export function getEmailStatus(req, res) {
  res.json(emailSettings());
}

// Logs in to the mail server and sends a real message to the admin's own address. Waits for the
// answer, unlike reset emails, so the admin sees exactly what went wrong. Failures are 400s, since
// the error handler hides the message of anything 500 or above.
export async function sendTestEmail(req, res) {
  if (!emailSettings().configured) {
    throw new HttpError(400, 'Email is not set up: SMTP_HOST is empty in server/.env. See DEPLOYMENT.md, section 4.');
  }

  const connection = await checkEmailConnection();
  if (!connection.ok) throw new HttpError(400, `Could not sign in to the mail server. ${connection.error}`);

  try {
    await sendEmail(testEmail({ to: req.user.email, name: req.user.name }));
  } catch (err) {
    throw new HttpError(400, `The mail server did not accept the test email. ${explainEmailError(err)}`);
  }
  res.json({ message: `Test email sent to ${req.user.email}. If it isn't in the inbox within a few minutes, check spam.` });
}
