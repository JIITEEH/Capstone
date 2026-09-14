// Resets the database and uploads, then loads demo data.
// Run with: npm run db:seed
import fs from 'node:fs';
import config from '../config/index.js';

for (const suffix of ['', '-wal', '-shm', '-journal']) {
  fs.rmSync(config.databasePath + suffix, { force: true });
}
fs.rmSync(config.uploadDir, { recursive: true, force: true });

// Import after deleting so the connection opens a fresh file
const { default: db } = await import('./index.js');
const { hashPassword } = await import('../utils/password.js');
const Thesis = await import('../models/thesisModel.js');

const DEMO_PASSWORD = 'password123';
const passwordHash = hashPassword(DEMO_PASSWORD);

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

const insertSubmission = db.prepare(
  `INSERT INTO submissions (thesis_id, stage, notes, status, submitted_at, reviewed_at, reviewed_by)
   VALUES (?, ?, ?, ?, datetime('now', ?), CASE WHEN ? IS NULL THEN NULL ELSE datetime('now', ?) END, ?)`,
);
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

fs.mkdirSync(config.uploadDir, { recursive: true });
const thesisInfo = db.prepare('SELECT t.title, u.name FROM theses t JOIN users u ON u.id = t.student_id WHERE t.id = ?');
const attachFile = db.prepare(
  "UPDATE submissions SET file_name = ?, stored_name = ?, file_size = ?, mime_type = 'application/pdf' WHERE id = ?",
);

function submission(thesisId, stage, notes, status, submittedAgo, reviewedAgo = null, reviewerId = null) {
  const id = Number(
    insertSubmission.run(thesisId, stage, notes, status, submittedAgo, reviewedAgo, reviewedAgo, reviewerId)
      .lastInsertRowid,
  );

  const { title, name } = thesisInfo.get(thesisId);
  const pdf = samplePdf([
    [18, title],
    [13, `${STAGE_LABELS[stage]} - ${name}`],
    [11, 'Sample manuscript created by the demo seed script.'],
  ]);
  const storedName = `seed-submission-${id}.pdf`;
  fs.writeFileSync(`${config.uploadDir}/${storedName}`, pdf);
  const fileName = `${name.split(' ').at(-1)}_${STAGE_LABELS[stage].replace(/\s+/g, '_')}.pdf`;
  attachFile.run(fileName, storedName, pdf.length, id);
  return id;
}

const insertComment = db.prepare(
  "INSERT INTO comments (submission_id, author_id, body, created_at) VALUES (?, ?, ?, datetime('now', ?))",
);
const insertActivity = db.prepare(
  "INSERT INTO activity (thesis_id, actor_id, action, created_at) VALUES (?, ?, ?, datetime('now', ?))",
);

db.exec('BEGIN');

// Users
user('System Administrator', 'admin@tms.edu', 'admin', 'Graduate School Office', '-90 days');
const santos = user('Dr. Maria Santos', 'maria.santos@tms.edu', 'adviser', 'Department of Computer Science', '-80 days');
const reyes = user('Dr. Jose Reyes', 'jose.reyes@tms.edu', 'adviser', 'Department of Information Technology', '-80 days');
user('Dr. Liza Mendoza', 'liza.mendoza@tms.edu', 'adviser', 'Department of Computer Science', '-60 days');
const ana = user('Ana Cruz', 'ana.cruz@tms.edu', 'student', 'BS Computer Science', '-50 days');
const ben = user('Ben Lim', 'ben.lim@tms.edu', 'student', 'BS Information Technology', '-45 days');
const carla = user('Carla Diaz', 'carla.diaz@tms.edu', 'student', 'BS Information Technology', '-120 days');
const david = user('David Tan', 'david.tan@tms.edu', 'student', 'BS Computer Science', '-5 days');
user('Ella Garcia', 'ella.garcia@tms.edu', 'student', 'BS Computer Science', '-2 days');

// Ana: two stages approved, third waiting for review
const anaThesis = thesis(
  ana,
  santos,
  'A Machine Learning Approach to Early Detection of Rice Crop Diseases',
  'This study develops a convolutional neural network that classifies common rice leaf diseases from smartphone photos, helping farmers act before infections spread.',
  'machine learning, computer vision, agriculture',
  '-48 days',
);
insertActivity.run(anaThesis, ana, 'created the thesis', '-48 days');
insertActivity.run(anaThesis, 1, 'assigned Dr. Maria Santos as adviser', '-47 days');
let s = submission(anaThesis, 'proposal', 'Initial proposal for review.', 'approved', '-40 days', '-36 days', santos);
insertActivity.run(anaThesis, ana, 'submitted Proposal', '-40 days');
insertComment.run(s, santos, 'Strong problem statement. Narrow the scope to three diseases for feasibility.', '-36 days');
insertActivity.run(anaThesis, santos, 'approved Proposal', '-36 days');
s = submission(anaThesis, 'chapters_1_3', 'Includes the revised scope.', 'approved', '-20 days', '-15 days', santos);
insertActivity.run(anaThesis, ana, 'submitted Chapters 1–3', '-20 days');
insertComment.run(s, santos, 'The literature review is thorough. Approved.', '-15 days');
insertActivity.run(anaThesis, santos, 'approved Chapters 1–3', '-15 days');
submission(anaThesis, 'chapters_4_5', 'Results and discussion with model accuracy tables.', 'pending', '-2 days');
insertActivity.run(anaThesis, ana, 'submitted Chapters 4–5', '-2 days');

// Ben: proposal sent back for revisions
const benThesis = thesis(
  ben,
  santos,
  'Real-Time Campus Shuttle Tracking Mobile Application',
  'A mobile app that shows live shuttle locations and estimated arrival times using GPS devices installed on campus vehicles.',
  'mobile development, GPS, transportation',
  '-30 days',
);
insertActivity.run(benThesis, ben, 'created the thesis', '-30 days');
insertActivity.run(benThesis, 1, 'assigned Dr. Maria Santos as adviser', '-29 days');
s = submission(benThesis, 'proposal', 'First draft of the proposal.', 'revisions_requested', '-10 days', '-8 days', santos);
insertActivity.run(benThesis, ben, 'submitted Proposal', '-10 days');
insertComment.run(
  s,
  santos,
  'Please add a comparison with existing tracking apps and describe how you will get GPS data from the shuttles.',
  '-8 days',
);
insertActivity.run(benThesis, santos, 'requested revisions on Proposal', '-8 days');
insertComment.run(s, ben, 'Thank you, I will add a related systems section this week.', '-7 days');

// Carla: every stage approved
const carlaThesis = thesis(
  carla,
  reyes,
  'Blockchain-Based Academic Credential Verification System',
  'A permissioned blockchain that lets employers verify diplomas and transcripts issued by the university without contacting the registrar.',
  'blockchain, verification, security',
  '-115 days',
);
insertActivity.run(carlaThesis, carla, 'created the thesis', '-115 days');
[
  ['proposal', 'Proposal', '-100 days', '-95 days'],
  ['chapters_1_3', 'Chapters 1–3', '-80 days', '-74 days'],
  ['chapters_4_5', 'Chapters 4–5', '-50 days', '-44 days'],
  ['final', 'Final Manuscript', '-20 days', '-14 days'],
].forEach(([stage, label, submittedAgo, reviewedAgo]) => {
  submission(carlaThesis, stage, '', 'approved', submittedAgo, reviewedAgo, reyes);
  insertActivity.run(carlaThesis, carla, `submitted ${label}`, submittedAgo);
  insertActivity.run(carlaThesis, reyes, `approved ${label}`, reviewedAgo);
});

// David: proposal submitted, but no adviser yet
const davidThesis = thesis(
  david,
  null,
  'Sentiment Analysis of Filipino Social Media Posts on Public Transport',
  'This research applies transformer-based language models to classify sentiment in Tagalog and Taglish posts about commuting.',
  'natural language processing, sentiment analysis',
  '-4 days',
);
insertActivity.run(davidThesis, david, 'created the thesis', '-4 days');
submission(davidThesis, 'proposal', 'Looking forward to feedback.', 'pending', '-1 days');
insertActivity.run(davidThesis, david, 'submitted Proposal', '-1 days');

for (const id of [anaThesis, benThesis, carlaThesis, davidThesis]) Thesis.recomputeStatus(id);

db.exec('COMMIT');

console.log('Database seeded. Every demo account uses the password:', DEMO_PASSWORD);
console.log('  Admin:    admin@tms.edu');
console.log('  Advisers: maria.santos@tms.edu, jose.reyes@tms.edu, liza.mendoza@tms.edu');
console.log('  Students: ana.cruz@tms.edu, ben.lim@tms.edu, carla.diaz@tms.edu, david.tan@tms.edu, ella.garcia@tms.edu');
