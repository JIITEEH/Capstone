import { Router } from 'express';
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../request-handlers/notificationController.js';

const router = Router();

// Every route reads or changes only the signed-in user's own notifications
router.get('/', listNotifications);
router.post('/read-all', markAllNotificationsRead);
router.post('/:id/read', markNotificationRead);

export default router;
