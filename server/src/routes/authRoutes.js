import { Router } from 'express';
import {
  forgotPassword,
  listDemoAccounts,
  login,
  me,
  register,
  resetPassword,
  updateMe,
} from '../controllers/authController.js';
import { requireAuth } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';

const FIFTEEN_MINUTES = 15 * 60 * 1000;
const ONE_HOUR = 60 * 60 * 1000;

// Per network and email, so guessing one account's password is capped even if the
// attacker spreads attempts out, while classmates on the same network aren't blocked.
const accountKey = (req) => `${req.ip}|${String(req.body?.email ?? '').trim().toLowerCase()}`;

const limitLoginPerAccount = rateLimit({
  windowMs: FIFTEEN_MINUTES,
  max: 10,
  key: accountKey,
  message: 'Too many sign-in attempts.',
});
// A looser cap per network stops one client from trying many different accounts
const limitLoginPerNetwork = rateLimit({ windowMs: FIFTEEN_MINUTES, max: 50, message: 'Too many sign-in attempts.' });
const limitRegister = rateLimit({ windowMs: ONE_HOUR, max: 10, message: 'Too many sign-ups from this network.' });
const limitForgotPassword = rateLimit({ windowMs: ONE_HOUR, max: 10, message: 'Too many password reset requests.' });
const limitResetPassword = rateLimit({ windowMs: FIFTEEN_MINUTES, max: 10, message: 'Too many password reset attempts.' });

const router = Router();

router.post('/register', limitRegister, register);
router.post('/login', limitLoginPerNetwork, limitLoginPerAccount, login);
router.post('/forgot-password', limitForgotPassword, forgotPassword);
router.post('/reset-password', limitResetPassword, resetPassword);
router.get('/demo-accounts', listDemoAccounts); // returns 404 in production
router.get('/me', requireAuth, me);
router.patch('/me', requireAuth, updateMe);

export default router;
