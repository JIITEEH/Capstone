import { Router } from 'express';
import {
  addMember,
  assignAdviser,
  cancelInvitation,
  createSubmission,
  createThesis,
  deleteThesis,
  exportTheses,
  getThesis,
  inviteMember,
  listTheses,
  removeMember,
  updateStatus,
  updateThesis,
} from '../request-handlers/thesisController.js';
import { requireRole } from '../request-filters/auth.js';
import { uploadManuscript, verifyUploadContents } from '../request-filters/upload.js';

const router = Router();

// Role scoping for reads and edits happens in the controller via services/access.js
router.get('/', listTheses);
router.post('/', requireRole('student'), createThesis);
// Before /:id, or "export.csv" would be read as a thesis id
router.get('/export.csv', requireRole('admin'), exportTheses);
router.get('/:id', getThesis);
// Thesis content belongs to the student; admins manage assignment, status, and deletion
router.patch('/:id', requireRole('student'), updateThesis);
router.delete('/:id', requireRole('admin'), deleteThesis);
router.patch('/:id/adviser', requireRole('admin'), assignAdviser);
router.patch('/:id/status', requireRole('admin'), updateStatus);
router.post('/:id/submissions', requireRole('student'), uploadManuscript, verifyUploadContents, createSubmission);
// Leaders invite classmates, who accept or decline; admins add directly to fix a group.
// Any member can remove themselves to leave.
router.post('/:id/invitations', requireRole('student'), inviteMember);
router.delete('/:id/invitations/:invitationId', requireRole('student', 'admin'), cancelInvitation);
router.post('/:id/members', requireRole('admin'), addMember);
router.delete('/:id/members/:studentId', requireRole('student', 'admin'), removeMember);

export default router;
