import { Router } from 'express';
import {
  createSchedule,
  deleteSchedule,
  listSchedules,
  updateSchedule,
} from '../controllers/scheduleController.js';
import { requireRole } from '../middleware/auth.js';

const router = Router();

// Lists are scoped by role in the controller; students have read-only access
router.get('/', listSchedules);
router.post('/', requireRole('adviser', 'admin'), createSchedule);
router.patch('/:id', requireRole('adviser', 'admin'), updateSchedule);
router.delete('/:id', requireRole('admin'), deleteSchedule);

export default router;
