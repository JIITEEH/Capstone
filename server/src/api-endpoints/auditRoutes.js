import { Router } from 'express';
import { listAudit } from '../request-handlers/auditController.js';

const router = Router();

// Mounted behind requireRole('admin') in api-endpoints/index.js. Read-only on purpose: there is no
// route to change or remove an entry.
router.get('/', listAudit);

export default router;
