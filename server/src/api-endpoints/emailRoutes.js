import { Router } from 'express';
import { getEmailStatus, sendTestEmail } from '../request-handlers/emailController.js';
import { rateLimit } from '../request-filters/rateLimit.js';

// Each test logs in to the mail server, and Gmail locks out accounts that sign in too often
const limitTestEmail = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  key: (req) => `test-email|${req.user.id}`,
  message: 'Too many test emails.',
});

const router = Router();

// Mounted behind requireRole('admin') in api-endpoints/index.js
router.get('/', getEmailStatus);
router.post('/test', limitTestEmail, sendTestEmail);

export default router;
