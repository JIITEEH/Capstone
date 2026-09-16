import * as Audit from '../database-queries/auditModel.js';

const TARGET_TYPES = ['user', 'thesis'];

export function listAudit(req, res) {
  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
  const before = Number(req.query.before) > 0 ? Number(req.query.before) : undefined;
  const targetType = TARGET_TYPES.includes(req.query.target) ? req.query.target : undefined;
  res.json(Audit.list({ limit, before, targetType }));
}
