import { MAX_GROUP_SIZE } from '../constants.js';
import { transaction } from '../database/index.js';
import * as Activity from '../database-queries/activityModel.js';
import * as Invitation from '../database-queries/invitationModel.js';
import * as Notification from '../database-queries/notificationModel.js';
import * as Thesis from '../database-queries/thesisModel.js';
import { HttpError } from '../helpers/httpError.js';
import { parseId } from '../helpers/validate.js';

// Only the invited student can see or answer an invitation; anyone else gets the same 404
function loadOwnInvitation(user, rawId) {
  const invitation = Invitation.findById(parseId(rawId, 'Invitation not found'));
  if (!invitation || invitation.student_id !== user.id || invitation.status !== 'pending') {
    throw new HttpError(404, 'Invitation not found');
  }
  return invitation;
}

export function listMyInvitations(req, res) {
  res.json(Invitation.listPendingForStudent(req.user.id));
}

export function acceptInvitation(req, res) {
  const invitation = loadOwnInvitation(req.user, req.params.id);
  const thesis = Thesis.findById(invitation.thesis_id);

  if (thesis.status === 'completed') {
    throw new HttpError(400, 'This thesis is already completed, so it no longer takes new members');
  }
  // Told only to the invitee, so the leader never learns which students are already in a group
  if (Thesis.findByStudent(req.user.id)) {
    throw new HttpError(409, "You're already in a thesis group. Leave it before joining another.");
  }
  if (thesis.member_count >= MAX_GROUP_SIZE) {
    throw new HttpError(400, `This group already has ${MAX_GROUP_SIZE} students`);
  }

  transaction(() => {
    Thesis.addMember(thesis.id, req.user.id);
    Invitation.setStatus(invitation.id, 'accepted');
    Invitation.cancelOtherPending(req.user.id, invitation.id);
    Activity.log(thesis.id, req.user.id, 'joined the group');
    Notification.notify({
      recipients: Thesis.listMembers(thesis.id).map((member) => member.id),
      actorId: req.user.id,
      type: 'group.joined',
      title: `${req.user.name} joined your thesis group`,
      body: thesis.title,
      link: '/thesis',
    });
  });
  res.json({ thesisId: thesis.id });
}

export function declineInvitation(req, res) {
  const invitation = loadOwnInvitation(req.user, req.params.id);

  transaction(() => {
    Invitation.setStatus(invitation.id, 'declined');
    Activity.log(invitation.thesis_id, req.user.id, 'declined the invitation to join');
    Notification.notify({
      recipients: [invitation.invited_by],
      actorId: req.user.id,
      type: 'group.declined',
      title: `${req.user.name} declined your invitation`,
      body: invitation.thesis_title,
      link: '/thesis',
    });
  });
  res.status(204).end();
}
