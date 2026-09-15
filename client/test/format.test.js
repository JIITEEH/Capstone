import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  approvedStageKeys,
  formatBytes,
  formatDuration,
  initials,
  parseDate,
  plural,
  toLocalInputValue,
} from '../src/utils/format.js';

describe('parseDate', () => {
  it('reads SQLite timestamps as UTC', () => {
    assert.equal(parseDate('2026-09-15 08:30:00').toISOString(), '2026-09-15T08:30:00.000Z');
  });

  it('passes ISO strings through and returns null for empty values', () => {
    assert.equal(parseDate('2026-09-15T08:30:00Z').toISOString(), '2026-09-15T08:30:00.000Z');
    assert.equal(parseDate(''), null);
    assert.equal(parseDate(null), null);
  });
});

describe('toLocalInputValue', () => {
  it('formats a timestamp for a datetime-local input', () => {
    assert.match(toLocalInputValue('2026-09-15 08:30:00'), /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    assert.equal(toLocalInputValue(null), '');
  });
});

describe('plural', () => {
  it('adds an s except for exactly one', () => {
    assert.equal(plural(0, 'submission'), '0 submissions');
    assert.equal(plural(1, 'submission'), '1 submission');
    assert.equal(plural(3, 'submission'), '3 submissions');
  });
});

describe('initials', () => {
  it('uses the first two words and skips titles', () => {
    assert.equal(initials('Ana Cruz'), 'AC');
    assert.equal(initials('Dr. Maria Santos'), 'MS');
    assert.equal(initials('Prof Jose Reyes'), 'JR');
  });

  it("uses the leader's initials for a group label", () => {
    assert.equal(initials('Lara Leader, Ben Member'), 'LL');
  });

  it('handles empty names', () => {
    assert.equal(initials(''), '');
  });
});

describe('formatBytes', () => {
  it('picks a readable unit', () => {
    assert.equal(formatBytes(512), '512 B');
    assert.equal(formatBytes(2048), '2.0 KB');
    assert.equal(formatBytes(50 * 1024 * 1024), '50.0 MB');
    assert.equal(formatBytes(0), '—');
  });
});

describe('formatDuration', () => {
  it('shows minutes under an hour and hours after', () => {
    assert.equal(formatDuration(45), '45 min');
    assert.equal(formatDuration(60), '1 hour');
    assert.equal(formatDuration(90), '1.5 hours');
  });
});

describe('approvedStageKeys', () => {
  it('splits the comma-separated stage list', () => {
    assert.deepEqual(approvedStageKeys({ approved_stage_keys: 'proposal,chapters_1_3' }), ['proposal', 'chapters_1_3']);
    assert.deepEqual(approvedStageKeys({ approved_stage_keys: null }), []);
    assert.deepEqual(approvedStageKeys(null), []);
  });
});
