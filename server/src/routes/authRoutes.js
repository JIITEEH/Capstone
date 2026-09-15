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

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.get('/demo-accounts', listDemoAccounts); // returns 404 in production
router.get('/me', requireAuth, me);
router.patch('/me', requireAuth, updateMe);

export default router;
