import { DEFENSE_CRITERIA, DEFENSE_VERDICTS, SCHEDULE_TYPES } from '../constants.js';
import { transaction } from '../database/index.js';
import * as Activity from '../database-queries/activityModel.js';
import * as Audit from '../database-queries/auditModel.js';
import * as Defense from '../database-queries/defenseModel.js';
import * as Notification from '../database-queries/notificationModel.js';
import * as Schedule from '../database-queries/scheduleModel.js';
import { canViewSchedule, withSchedulePermissions } from '../permission-rules/access.js';
import { HttpError } from '../helpers/httpError.js';
import { oneOf, optionalText, parseId, requireText, toSqlDateTime } from '../helpers/validate.js';

const CRITERIA = Object.keys(DEFENSE_CRITERIA);

// A consultation is not a defense, and someone who can't see the event gets the same 404
function loadDefense(user, rawId) {
  const schedule = Schedule.findById(parseId(rawId, 'Defense not found'));
  if (!schedule || schedule.type === 'consultation' || !canViewSchedule(user, schedule)) {
    throw new HttpError(404, 'Defense not found');
  }
  return schedule;
}

const hasStarted = (schedule) => schedule.starts_at <= toSqlDateTime(new Date());
const isPanelist = (user, schedule) => schedule.panelists.some((panelist) => panelist.id === user.id);

export function getDefense(req, res) {
  const { user } = req;
  const schedule = loadDefense(user, req.params.id);
  const started = hasStarted(schedule);
  const verdict = Defense.findVerdict(schedule.id);
  const all = Defense.listEvaluations(schedule.id);
  const panelist = isPanelist(user, schedule);
  const admin = user.role === 'admin';
  const open = schedule.status !== 'cancelled' && !verdict;

  // Panelists score independently, so nobody sees another panelist's scores before the verdict.
  // Students and the adviser see the outcome once it is decided. Admins see everything.
  const seesScores = admin || Boolean(verdict);

  res.json({
    defense: withSchedulePermissions(user, schedule),
    criteria: DEFENSE_CRITERIA,
    verdicts: DEFENSE_VERDICTS,
    started,
    isPanelist: panelist,
    myEvaluation: panelist ? (all.find((e) => e.panelist_id === user.id) ?? null) : null,
    evaluations: seesScores ? all : [],
    summary: seesScores ? Defense.summarize(all) : null,
    panelSize: schedule.panelists.length,
    submittedCount: admin || panelist ? all.length : null,
    verdict,
    canEvaluate: panelist && started && open,
    canRecordVerdict: admin && started && open && all.length > 0,
  });
}

export function saveEvaluation(req, res) {
  const { user } = req;
  const schedule = loadDefense(user, req.params.id);
  if (!isPanelist(user, schedule)) throw new HttpError(403, 'Only panelists on this defense can score it');
  if (schedule.status === 'cancelled') throw new HttpError(400, 'This defense was cancelled');
  if (!hasStarted(schedule)) throw new HttpError(400, 'Scores can be entered once the defense has started');
  if (Defense.findVerdict(schedule.id)) {
    throw new HttpError(400, 'The verdict has been recorded, so scores can no longer change');
  }

  const body = req.body ?? {};
  const scores = {};
  for (const key of CRITERIA) {
    const value = Number(body.scores?.[key]);
    if (!Number.isInteger(value) || value < 1 || value > 5) {
      throw new HttpError(400, `Give "${DEFENSE_CRITERIA[key]}" a score from 1 to 5`);
    }
    scores[key] = value;
  }
  const remarks = optionalText(body.remarks, 'Remarks', { max: 3000 });

  Defense.saveEvaluation({ scheduleId: schedule.id, panelist: user, scores, remarks });
  res.json(Defense.listEvaluations(schedule.id).find((e) => e.panelist_id === user.id));
}

export function recordVerdict(req, res) {
  const { user } = req;
  const schedule = loadDefense(user, req.params.id);
  if (schedule.status === 'cancelled') throw new HttpError(400, 'This defense was cancelled');
  if (!hasStarted(schedule)) throw new HttpError(400, 'A verdict can be recorded once the defense has started');
  if (Defense.findVerdict(schedule.id)) throw new HttpError(409, 'A verdict has already been recorded for this defense');
  if (!Defense.listEvaluations(schedule.id).length) {
    throw new HttpError(400, 'Wait until at least one panelist has submitted scores');
  }

  const body = req.body ?? {};
  const verdict = oneOf(body.verdict, Object.keys(DEFENSE_VERDICTS), 'verdict');
  // A verdict short of a clean pass has to say why, since the group acts on it
  const notes =
    verdict === 'passed'
      ? optionalText(body.notes, 'Notes', { max: 3000 })
      : requireText(body.notes, 'An explanation of the verdict', { max: 3000 });

  const label = DEFENSE_VERDICTS[verdict];
  const type = SCHEDULE_TYPES[schedule.type];

  transaction(() => {
    Defense.recordVerdict({ scheduleId: schedule.id, verdict, notes, recordedBy: user });
    Schedule.update(schedule.id, { status: 'completed' });
    Activity.log(schedule.thesis_id, user.id, `recorded the ${type.toLowerCase()} verdict: ${label}`);
    Audit.record({
      actor: user,
      action: 'thesis.defense_verdict',
      targetType: 'thesis',
      targetId: schedule.thesis_id,
      targetLabel: schedule.thesis_title,
      details: `${type}: ${label}`,
    });
    Notification.notify({
      recipients: [
        ...Notification.thesisParticipants(schedule.thesis_id),
        ...schedule.panelists.map((panelist) => panelist.id),
      ],
      actorId: user.id,
      type: 'defense.verdict',
      title: `${type}: ${label}`,
      body: schedule.thesis_title,
      link: `/defenses/${schedule.id}`,
    });
  });

  res.status(201).json(Defense.findVerdict(schedule.id));
}
