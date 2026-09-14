import { Router } from 'express';
import {
  addComment,
  downloadFile,
  getSubmission,
  reviewSubmission,
} from '../controllers/submissionController.js';
import { requireRole } from '../middleware/auth.js';

const router = Router();

// Access to the parent thesis is checked in the controller
router.get('/:id', getSubmission);
router.get('/:id/file', downloadFile);
router.post('/:id/comments', addComment);
router.patch('/:id/review', requireRole('adviser', 'admin'), reviewSubmission);

export default router;
