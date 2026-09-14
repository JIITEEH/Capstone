import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import authRoutes from './authRoutes.js';
import dashboardRoutes from './dashboardRoutes.js';
import submissionRoutes from './submissionRoutes.js';
import thesisRoutes from './thesisRoutes.js';
import userRoutes from './userRoutes.js';

const router = Router();

router.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

router.use('/auth', authRoutes);
router.use('/dashboard', requireAuth, dashboardRoutes);
router.use('/theses', requireAuth, thesisRoutes);
router.use('/submissions', requireAuth, submissionRoutes);
router.use('/users', requireAuth, requireRole('admin'), userRoutes);

export default router;
