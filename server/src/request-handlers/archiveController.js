import fs from 'node:fs';
import * as Archive from '../database-queries/archiveModel.js';
import { storedFilePath } from '../helpers/files.js';
import { HttpError } from '../helpers/httpError.js';
import { pageOf, requestedPage } from '../helpers/paging.js';
import { parseId, queryString } from '../helpers/validate.js';

export function listArchive(req, res) {
  const year = Number(req.query.year);
  const filters = {
    search: queryString(req.query.search),
    year: Number.isInteger(year) && year > 1900 ? year : undefined,
  };
  res.json({
    ...pageOf(requestedPage(req.query) ?? 1, {
      count: () => Archive.count(filters),
      fetch: (range) => Archive.list(filters, range),
    }),
    years: Archive.years(),
  });
}

// Anything not in the archive, including theses still in progress, is simply not found
function loadArchived(rawId) {
  const thesis = Archive.findById(parseId(rawId, 'Thesis not found'));
  if (!thesis) throw new HttpError(404, 'Thesis not found');
  return thesis;
}

export function getArchived(req, res) {
  res.json(loadArchived(req.params.id));
}

export function downloadManuscript(req, res) {
  const thesis = loadArchived(req.params.id);
  const file = thesis.manuscript_id && Archive.manuscriptFile(thesis.manuscript_id);
  if (!file?.stored_name) throw new HttpError(404, 'This thesis has no final manuscript on file');

  const filePath = storedFilePath(file.stored_name);
  if (!fs.existsSync(filePath)) throw new HttpError(404, 'The file could not be found');
  res.download(filePath, file.file_name);
}
