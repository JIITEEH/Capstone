// Reminds thesis groups about their next deadline: 3 days before it is due, and once it is overdue.
// Each reminder is a notification on the bell and an email with the same words, and is recorded so
// it is never sent twice, however often this runs.
//
// Run once a day with: npm run reminders
// See DEPLOYMENT.md section 9 for the cron line that runs it beside the nightly backup.
import { pathToFileURL } from 'node:url';
import config from '../config/index.js';
import { STAGES } from '../constants.js';
import { transaction } from './index.js';
import * as Reminder from '../database-queries/reminderModel.js';
import * as Notification from '../database-queries/notificationModel.js';
import * as Thesis from '../database-queries/thesisModel.js';
import * as User from '../database-queries/userModel.js';
import { deadlineReminderEmail, explainEmailError, sendEmail } from '../helpers/email.js';

// 2026-10-31 → "Oct 31, 2026", read as a calendar day so the time zone can't shift it
function formatDay(day) {
  const [year, month, date] = day.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, date)).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function reminderWords({ stage, due_on: dueOn, days_left: daysLeft }) {
  const label = STAGES[stage];
  if (daysLeft < 0) {
    return {
      headline: `${label} is overdue`,
      detail: `It was due on ${formatDay(dueOn)} and nothing has been submitted for it yet.`,
    };
  }
  const when = daysLeft === 0 ? 'today' : daysLeft === 1 ? 'tomorrow' : `in ${daysLeft} days`;
  return {
    headline: `${label} is due ${when}`,
    detail: `Submit it by the end of ${formatDay(dueOn)}.`,
  };
}

// Sends every reminder owed today. Returns what happened, for the command line and the tests.
// `today` (YYYY-MM-DD) and `send` are injectable for tests.
export async function sendDeadlineReminders({ today = null, send = sendEmail } = {}) {
  const summary = { reminders: 0, notified: 0, emailed: 0, emailFailures: [] };

  for (const due of Reminder.owed(today)) {
    const words = reminderWords(due);
    const members = Thesis.listMembers(due.thesis_id);

    // The record and the notifications land together, so a reminder is never recorded without being shown
    const claimed = transaction(() => {
      if (!Reminder.record({ thesisId: due.thesis_id, stage: due.stage, dueOn: due.due_on, kind: due.kind })) return false;
      summary.notified += Notification.notify({
        recipients: members.map((member) => member.id),
        type: `deadline.${due.kind}`,
        title: words.headline,
        // The date, not just "in 3 days", so the notification still reads true when opened later
        body: words.detail,
        link: '/thesis',
      });
      return true;
    });
    if (!claimed) continue;
    summary.reminders += 1;

    // Email after the commit: a slow or broken mail server can't undo the notification, and a failed
    // email isn't retried, because the group has already been told on the bell
    for (const member of members) {
      if (!User.findById(member.id)?.is_active) continue;
      try {
        const result = await send(
          deadlineReminderEmail({
            to: member.email,
            name: member.name,
            ...words,
            thesisTitle: due.title,
            thesisUrl: `${config.clientOrigin}/thesis`,
          }),
        );
        if (!result?.skipped) summary.emailed += 1;
      } catch (err) {
        summary.emailFailures.push({ to: member.email, error: explainEmailError(err) });
      }
    }
  }

  return summary;
}

// ---------------------------------------------------------------------------
// Command line
// ---------------------------------------------------------------------------
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const summary = await sendDeadlineReminders();
  const stamp = new Date().toISOString();
  if (summary.reminders === 0) {
    console.log(`${stamp} No deadline reminders due.`);
  } else {
    console.log(
      `${stamp} Sent ${summary.reminders} deadline reminder(s): ${summary.notified} notification(s), ${summary.emailed} email(s).`,
    );
  }
  for (const failure of summary.emailFailures) {
    console.warn(`  Could not email ${failure.to}: ${failure.error}`);
  }
}
