import { Router } from 'express';
import itemRoutes from './itemRoutes.js';

const router = Router();

router.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

router.use('/items', itemRoutes);

export default router;
