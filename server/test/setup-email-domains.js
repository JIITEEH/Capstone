// For tests of a school that limits sign-up to its own email domains. Imported first, before
// anything reads config, because ES module imports run before the rest of a test file does.
import './setup.js';

process.env.ALLOWED_EMAIL_DOMAINS = 'tms.edu, @students.tms.edu';
