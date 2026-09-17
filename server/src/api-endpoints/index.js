import { Router } from 'express';
import { requireAuth, requireRole } from '../request-filters/auth.js';
import archiveRoutes from './archiveRoutes.js';
import auditRoutes from './auditRoutes.js';
import authRoutes from './authRoutes.js';
import dashboardRoutes from './dashboardRoutes.js';
import emailRoutes from './emailRoutes.js';
import invitationRoutes from './invitationRoutes.js';
import defenseRoutes from './defenseRoutes.js';
import notificationRoutes from './notificationRoutes.js';
import scheduleRoutes from './scheduleRoutes.js';
import searchRoutes from './searchRoutes.js';
import termRoutes from './termRoutes.js';
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
router.use('/archive', requireAuth, archiveRoutes);
router.use('/notifications', requireAuth, notificationRoutes);
router.use('/invitations', requireAuth, requireRole('student'), invitationRoutes);
router.use('/users', requireAuth, requireRole('admin'), userRoutes);
router.use('/audit', requireAuth, requireRole('admin'), auditRoutes);
router.use('/terms', requireAuth, requireRole('admin'), termRoutes);
router.use('/email', requireAuth, requireRole('admin'), emailRoutes);

export default router;
