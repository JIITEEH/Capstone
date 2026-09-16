import { Router } from 'express';
import { acceptInvitation, declineInvitation, listMyInvitations } from '../request-handlers/invitationController.js';

const router = Router();

// Mounted behind requireRole('student'). Each route touches only the signed-in student's own invitations.
router.get('/', listMyInvitations);
router.post('/:id/accept', acceptInvitation);
router.post('/:id/decline', declineInvitation);

export default router;
