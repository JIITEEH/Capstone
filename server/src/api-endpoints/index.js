import { Router } from 'express';
import { requireAuth, requireRole } from '../request-filters/auth.js';
import auditRoutes from './auditRoutes.js';
import authRoutes from './authRoutes.js';
import dashboardRoutes from './dashboardRoutes.js';
import defenseRoutes from './defenseRoutes.js';
import notificationRoutes from './notificationRoutes.js';
import scheduleRoutes from './scheduleRoutes.js';
import searchRoutes from './searchRoutes.js';
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
router.use('/schedules', requireAuth, scheduleRoutes);
router.use('/defenses', requireAuth, defenseRoutes);
router.use('/search', requireAuth, searchRoutes);
router.use('/notifications', requireAuth, notificationRoutes);
router.use('/users', requireAuth, requireRole('admin'), userRoutes);
router.use('/audit', requireAuth, requireRole('admin'), auditRoutes);

export default router;
