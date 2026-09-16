import { Router } from 'express';
import {
  forgotPassword,
  listDemoAccounts,
  login,
  me,
  register,
  resendVerification,
  resetPassword,
  updateMe,
  verifyEmail,
} from '../request-handlers/authController.js';
import { requireAuth } from '../request-filters/auth.js';
import { rateLimit } from '../request-filters/rateLimit.js';

const FIFTEEN_MINUTES = 15 * 60 * 1000;
const ONE_HOUR = 60 * 60 * 1000;

// Per network and email, so one account can't be targeted endlessly, while classmates
// sharing a school network each get their own allowance.
const accountKey = (req) => `${req.ip}|${String(req.body?.email ?? '').trim().toLowerCase()}`;

// Only wrong passwords count toward sign-in limits, so a full computer lab can sign in normally
const limitLoginPerAccount = rateLimit({
  windowMs: FIFTEEN_MINUTES,
  max: 10,
  key: accountKey,
  onlyFailures: true,
  message: 'Too many sign-in attempts.',
});
// A looser cap per network stops one client from trying many different accounts
const limitLoginPerNetwork = rateLimit({
  windowMs: FIFTEEN_MINUTES,
  max: 50,
  onlyFailures: true,
  message: 'Too many sign-in attempts.',
});
// High enough for a whole class registering from one lab in the same hour
const limitRegister = rateLimit({ windowMs: ONE_HOUR, max: 30, message: 'Too many sign-ups from this network.' });
const limitForgotPerAccount = rateLimit({
  windowMs: ONE_HOUR,
  max: 5,
  key: accountKey,
  message: 'Too many password reset requests for this email.',
});
const limitForgotPerNetwork = rateLimit({ windowMs: ONE_HOUR, max: 30, message: 'Too many password reset requests.' });
const limitResetPassword = rateLimit({ windowMs: FIFTEEN_MINUTES, max: 10, message: 'Too many password reset attempts.' });
const limitVerifyEmail = rateLimit({ windowMs: FIFTEEN_MINUTES, max: 20, message: 'Too many verification attempts.' });
// Per account, so one student can't flood their own inbox or anyone else's
const limitResendVerification = rateLimit({
  windowMs: ONE_HOUR,
  max: 5,
  key: (req) => `resend|${req.user.id}`,
  message: 'Too many verification emails requested.',
});

const router = Router();

router.post('/register', limitRegister, register);
router.post('/login', limitLoginPerNetwork, limitLoginPerAccount, login);
router.post('/forgot-password', limitForgotPerNetwork, limitForgotPerAccount, forgotPassword);
router.post('/reset-password', limitResetPassword, resetPassword);
router.post('/verify-email', limitVerifyEmail, verifyEmail);
router.post('/resend-verification', requireAuth, limitResendVerification, resendVerification);
router.get('/demo-accounts', listDemoAccounts); // returns 404 in production
router.get('/me', requireAuth, me);
router.patch('/me', requireAuth, updateMe);

export default router;
