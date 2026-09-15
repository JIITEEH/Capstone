// Resets the database and uploads, then loads demo data.
// Run with: npm run db:seed
import fs from 'node:fs';
import path from 'node:path';
import config from '../config/index.js';
import { DEMO_PASSWORD } from '../constants.js';

for (const suffix of ['', '-wal', '-shm', '-journal']) {
  fs.rmSync(config.databasePath + suffix, { force: true });
}
fs.rmSync(config.uploadDir, { recursive: true, force: true });
fs.mkdirSync(config.uploadDir, { recursive: true });

// Import after deleting so the connection opens a fresh file
const { default: db } = await import('./index.js');
const { hashPassword } = await import('../utils/password.js');
const Thesis = await import('../models/thesisModel.js');

const passwordHash = hashPassword(DEMO_PASSWORD);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const insertUser = db.prepare(
  "INSERT INTO users (name, email, password_hash, role, program, created_at) VALUES (?, ?, ?, ?, ?, datetime('now', ?))",
);
function user(name, email, role, program, ago) {
  return Number(insertUser.run(name, email, passwordHash, role, program, ago).lastInsertRowid);
}

const insertThesis = db.prepare(
  "INSERT INTO theses (student_id, adviser_id, title, abstract, keywords, created_at) VALUES (?, ?, ?, ?, ?, datetime('now', ?))",
);
function thesis(studentId, adviserId, title, abstract, keywords, ago) {
  return Number(insertThesis.run(studentId, adviserId, title, abstract, keywords, ago).lastInsertRowid);
}

// Builds a small one-page PDF so seeded submissions have a file to download
function samplePdf(lines) {
  const ascii = (text) => text.replace(/[^\x20-\x7E]/g, '-').replace(/[\\()]/g, (c) => `\\${c}`);
  const content = lines
    .map(([size, text], i) => `BT /F1 ${size} Tf 72 ${720 - i * 28} Td (${ascii(text)}) Tj ET`)
    .join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = objects.map((obj, i) => {
    const offset = pdf.length;
    pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`;
    return offset;
  });
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('');
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(pdf, 'latin1');
}

const STAGE_LABELS = {
  proposal: 'Proposal',
  chapters_1_3: 'Chapters 1-3',
  chapters_4_5: 'Chapters 4-5',
  final: 'Final Manuscript',
};

const thesisInfo = db.prepare('SELECT t.title, u.name FROM theses t JOIN users u ON u.id = t.student_id WHERE t.id = ?');
const insertSubmission = db.prepare(
  `INSERT INTO submissions (thesis_id, stage, notes, file_name, stored_name, file_size, mime_type, submitted_at)
   VALUES (?, ?, ?, ?, ?, ?, 'application/pdf', datetime('now', ?))`,
);
const insertReview = db.prepare(
  "INSERT INTO reviews (submission_id, reviewer_id, decision, feedback, created_at) VALUES (?, ?, ?, ?, datetime('now', ?))",
);

let fileCount = 0;
// review: { by, decision, ago, feedback } or null while the submission is still pending
function submission(thesisId, stage, notes, submittedAgo, review = null) {
  const { title, name } = thesisInfo.get(thesisId);
  const pdf = samplePdf([
    [18, title],
    [13, `${STAGE_LABELS[stage]} - ${name}`],
    [11, 'Sample manuscript created by the demo seed script.'],
  ]);
  const storedName = `seed-submission-${++fileCount}.pdf`;
  fs.writeFileSync(path.join(config.uploadDir, storedName), pdf);
  const fileName = `${name.split(' ').at(-1)}_${STAGE_LABELS[stage].replace(/\s+/g, '_')}.pdf`;

  const id = Number(
    insertSubmission.run(thesisId, stage, notes, fileName, storedName, pdf.length, submittedAgo).lastInsertRowid,
  );
  if (review) insertReview.run(id, review.by, review.decision, review.feedback ?? '', review.ago);
  return id;
}

const insertComment = db.prepare(
  "INSERT INTO comments (submission_id, author_id, body, created_at) VALUES (?, ?, ?, datetime('now', ?))",
);
const insertActivity = db.prepare(
  "INSERT INTO activity (thesis_id, actor_id, action, created_at) VALUES (?, ?, ?, datetime('now', ?))",
);

const insertSchedule = db.prepare(
  `INSERT INTO schedules
     (thesis_id, type, title, starts_at, duration_minutes, mode, location, notes, status, created_by, created_at)
   VALUES (?, ?, ?, datetime('now', 'start of day', ?, ?), ?, ?, ?, ?, ?, ?, datetime('now', ?))`,
);
const insertPanelist = db.prepare('INSERT INTO schedule_panelists (schedule_id, adviser_id) VALUES (?, ?)');

// day/hour are SQLite modifiers such as '+3 days' and '+2 hours' (times are UTC)
function schedule({ thesisId, type, title, day, hour, minutes, mode, location, notes = '', status = 'scheduled', by, createdAgo, panel = [] }) {
  const id = Number(
    insertSchedule.run(thesisId, type, title, day, hour, minutes, mode, location, notes, status, by, createdAgo)
      .lastInsertRowid,
  );
  for (const adviserId of panel) insertPanelist.run(id, adviserId);
  return id;
}

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

db.exec('BEGIN');

const admin = user('System Administrator', 'jtcatimbang1019@gmail.com', 'admin', 'Graduate School Office', '-90 days');
const santos = user('Dr. Maria Santos', 'maria.santos@tms.edu', 'adviser', 'Department of Computer Science', '-80 days');
const ana = user('Ana Cruz', 'ana.cruz@tms.edu', 'student', 'BS Computer Science', '-50 days');

// Ana: two stages approved, third waiting for review, final defense coming up
const anaThesis = thesis(
  ana,
  santos,
  'A Machine Learning Approach to Early Detection of Rice Crop Diseases',
  'This study develops a convolutional neural network that classifies common rice leaf diseases from smartphone photos, helping farmers act before infections spread.',
  'machine learning, computer vision, agriculture',
  '-48 days',
);
insertActivity.run(anaThesis, ana, 'created the thesis', '-48 days');
insertActivity.run(anaThesis, admin, 'assigned Dr. Maria Santos as adviser', '-47 days');

submission(anaThesis, 'proposal', 'Initial proposal for review.', '-40 days', {
  by: santos,
  decision: 'approved',
  ago: '-36 days',
  feedback: 'Strong problem statement. Narrow the scope to three diseases for feasibility.',
});
insertActivity.run(anaThesis, ana, 'submitted Proposal', '-40 days');
insertActivity.run(anaThesis, santos, 'approved Proposal', '-36 days');

let s = submission(anaThesis, 'chapters_1_3', 'Includes the revised scope.', '-20 days', {
  by: santos,
  decision: 'approved',
  ago: '-15 days',
  feedback: 'The literature review is thorough. Approved.',
});
insertComment.run(s, ana, 'Thank you! I will start on the results chapters.', '-14 days');
insertActivity.run(anaThesis, ana, 'submitted Chapters 1–3', '-20 days');
insertActivity.run(anaThesis, santos, 'approved Chapters 1–3', '-15 days');

schedule({
  thesisId: anaThesis,
  type: 'consultation',
  title: 'Chapters 1–3 feedback session',
  day: '-16 days',
  hour: '+2 hours',
  minutes: 60,
  mode: 'in_person',
  location: 'CS Faculty Room 204',
  notes: 'Go over the literature review comments.',
  status: 'completed',
  by: santos,
  createdAgo: '-18 days',
});

submission(anaThesis, 'chapters_4_5', 'Results and discussion with model accuracy tables.', '-2 days');
insertActivity.run(anaThesis, ana, 'submitted Chapters 4–5', '-2 days');

schedule({
  thesisId: anaThesis,
  type: 'consultation',
  title: 'Results chapter consultation',
  day: '+3 days',
  hour: '+3 hours',
  minutes: 45,
  mode: 'online',
  location: 'https://meet.google.com/abc-defg-hij',
  notes: 'Walk through the model accuracy tables in Chapter 4.',
  by: santos,
  createdAgo: '-1 days',
});
insertActivity.run(anaThesis, santos, 'scheduled a consultation', '-1 days');

schedule({
  thesisId: anaThesis,
  type: 'final_defense',
  title: 'Final thesis defense',
  day: '+14 days',
  hour: '+1 hours',
  minutes: 120,
  mode: 'in_person',
  location: 'AVR 1, Main Building',
  notes: 'Bring five printed copies of the manuscript.',
  by: admin,
  createdAgo: '-1 days',
  panel: [santos],
});
insertActivity.run(anaThesis, admin, 'scheduled a final defense', '-1 days');

Thesis.recomputeStatus(anaThesis);

db.exec('COMMIT');

console.log('Database seeded. Every demo account uses the password:', DEMO_PASSWORD);
console.log('  Admin:   jtcatimbang1019@gmail.com');
console.log('  Adviser: maria.santos@tms.edu');
console.log('  Student: ana.cruz@tms.edu');
