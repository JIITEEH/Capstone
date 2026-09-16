import { Router } from 'express';
import { createTerm, deleteTerm, listTerms, updateTerm } from '../request-handlers/termController.js';

const router = Router();

// Mounted behind requireRole('admin'). Students and advisers see their own deadlines on the thesis instead.
router.get('/', listTerms);
router.post('/', createTerm);
router.put('/:id', updateTerm);
router.delete('/:id', deleteTerm);

export default router;
