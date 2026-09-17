import { Router } from 'express';
import { downloadManuscript, getArchived, listArchive } from '../request-handlers/archiveController.js';

const router = Router();

// Every signed-in role can browse finished theses; only completed, archived ones are ever returned
router.get('/', listArchive);
router.get('/:id', getArchived);
router.get('/:id/manuscript', downloadManuscript);

export default router;
