import { Router } from 'express';
import {
  createUser,
  deleteUser,
  listAdvisers,
  listUsers,
  updateUser,
} from '../controllers/userController.js';

const router = Router();

// Mounted behind requireRole('admin') in routes/index.js
router.get('/', listUsers);
router.get('/advisers', listAdvisers);
router.post('/', createUser);
router.patch('/:id', updateUser);
router.delete('/:id', deleteUser);

export default router;
