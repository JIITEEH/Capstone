import { Router } from 'express';
import {
  addComment,
  downloadFile,
  getSubmission,
  reviewSubmission,
} from '../request-handlers/submissionController.js';
import { requireRole } from '../request-filters/auth.js';

const router = Router();

// Access to the parent thesis is checked in the controller.
// Reviews and discussion are between the student and adviser; admins can read them.
router.get('/:id', getSubmission);
router.get('/:id/file', downloadFile);
router.post('/:id/comments', requireRole('student', 'adviser'), addComment);
router.patch('/:id/review', requireRole('adviser'), reviewSubmission);

export default router;
