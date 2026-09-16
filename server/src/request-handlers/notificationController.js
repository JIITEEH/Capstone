import * as Notification from '../database-queries/notificationModel.js';
import { HttpError } from '../helpers/httpError.js';
import { parseId } from '../helpers/validate.js';

export function listNotifications(req, res) {
  res.json({
    notifications: Notification.listForUser(req.user.id),
    unread: Notification.unreadCount(req.user.id),
  });
}

export function markNotificationRead(req, res) {
  const id = parseId(req.params.id, 'Notification not found');
  if (!Notification.markRead(req.user.id, id)) throw new HttpError(404, 'Notification not found');
  res.json({ unread: Notification.unreadCount(req.user.id) });
}

export function markAllNotificationsRead(req, res) {
  Notification.markAllRead(req.user.id);
  res.json({ unread: 0 });
}
