import { Router } from 'express';
import {
  createUser,
  deleteUser,
  exportAdviserWorkload,
  listAdvisers,
  listUsers,
  updateUser,
} from '../request-handlers/userController.js';

const router = Router();

// Mounted behind requireRole('admin') in routes/index.js
router.get('/', listUsers);
router.get('/advisers', listAdvisers);
router.get('/advisers/export.csv', exportAdviserWorkload);
router.post('/', createUser);
router.patch('/:id', updateUser);
router.delete('/:id', deleteUser);

export default router;
