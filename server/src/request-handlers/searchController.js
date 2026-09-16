import * as Search from '../database-queries/searchModel.js';
import { queryString } from '../helpers/validate.js';

// Enough to pick from in the top-bar dropdown; the full lists live on their own pages
const PER_GROUP = 5;
const MIN_LENGTH = 2;
const MAX_LENGTH = 100;

export function search(req, res) {
  const term = queryString(req.query.q).slice(0, MAX_LENGTH);
  if (term.length < MIN_LENGTH) {
    res.json({ theses: [], people: [], submissions: [] });
    return;
  }
  res.json({
    theses: Search.theses(req.user, term, PER_GROUP),
    people: Search.people(req.user, term, PER_GROUP),
    submissions: Search.submissions(req.user, term, PER_GROUP),
  });
}
