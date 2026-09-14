import { Router } from 'express';
import {
  assignAdviser,
  createSubmission,
  createThesis,
  deleteThesis,
  getThesis,
  listTheses,
  updateStatus,
  updateThesis,
} from '../controllers/thesisController.js';
import { requireRole } from '../middleware/auth.js';
import { uploadManuscript } from '../middleware/upload.js';

const router = Router();

// Role scoping for reads and edits happens in the controller via services/access.js
router.get('/', listTheses);
router.post('/', requireRole('student'), createThesis);
router.get('/:id', getThesis);
router.patch('/:id', requireRole('student', 'admin'), updateThesis);
router.delete('/:id', requireRole('admin'), deleteThesis);
router.patch('/:id/adviser', requireRole('admin'), assignAdviser);
router.patch('/:id/status', requireRole('admin'), updateStatus);
router.post('/:id/submissions', requireRole('student'), uploadManuscript, createSubmission);

export default router;
