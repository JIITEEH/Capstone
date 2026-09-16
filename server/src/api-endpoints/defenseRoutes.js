import { Router } from 'express';
import { getDefense, recordVerdict, saveEvaluation } from '../request-handlers/defenseController.js';
import { requireRole } from '../request-filters/auth.js';

const router = Router();

// Anyone who can see the event can open it; the controller decides what they see
router.get('/:id', getDefense);
// Panelists are advisers; the controller checks they sit on this particular panel
router.put('/:id/evaluation', requireRole('adviser'), saveEvaluation);
router.post('/:id/verdict', requireRole('admin'), recordVerdict);

export default router;
