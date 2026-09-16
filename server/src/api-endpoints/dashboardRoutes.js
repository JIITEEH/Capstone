import { Router } from 'express';
import { getDashboard } from '../request-handlers/dashboardController.js';

const router = Router();

router.get('/', getDashboard);

export default router;
