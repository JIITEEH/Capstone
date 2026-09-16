// Builds CSV that opens cleanly in Excel, Google Sheets, and Numbers, and can't be used to attack
// whoever opens it.

// A spreadsheet treats a cell starting with one of these as a formula and runs it. A student could
// title a thesis =HYPERLINK("http://evil.example", "Click") and have it execute on an admin's
// machine when the export is opened. Prefixing a quote makes the cell plain text.
const FORMULA_START = /^[=+\-@\t\r]/;

function cell(value) {
  if (value === null || value === undefined) return '';
  let text = String(value);
  if (typeof value === 'string' && FORMULA_START.test(text)) text = `'${text}`;
  // Quote anything holding a delimiter, a quote, or a line break; double any quotes inside
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

// columns: [{ header, value: (row) => any }]
export function toCsv(columns, rows) {
  const lines = [columns.map((c) => cell(c.header)).join(',')];
  for (const row of rows) {
    lines.push(columns.map((c) => cell(c.value(row))).join(','));
  }
  // The byte-order mark tells Excel the file is UTF-8, so "Chapters 1–3" and accented names survive
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}

export function sendCsv(res, filenameBase, csv) {
  const date = new Date().toISOString().slice(0, 10);
  res.set('Content-Type', 'text/csv; charset=utf-8');
  res.set('Content-Disposition', `attachment; filename="${filenameBase}-${date}.csv"`);
  res.send(csv);
}
