// SQLite stores UTC timestamps as "YYYY-MM-DD HH:MM:SS"
export function parseDate(value) {
  if (!value) return null;
  return new Date(value.includes('T') ? value : `${value.replace(' ', 'T')}Z`);
}

export function formatDate(value) {
  const date = parseDate(value);
  return date ? date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
}

// A calendar day stored as YYYY-MM-DD, such as a due date. Read as a local date, so it never
// shifts to the day before in time zones behind UTC.
export function formatDay(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? '')) return '—';
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

// How far off a due date is, from the whole days left that the API counts
export function dueLabel(daysLeft) {
  if (daysLeft < 0) return `Overdue by ${plural(-daysLeft, 'day')}`;
  if (daysLeft === 0) return 'Due today';
  if (daysLeft === 1) return 'Due tomorrow';
  return `Due in ${daysLeft} days`;
}

// Badge tone for a due date: red once overdue, amber within a week
export function dueTone(daysLeft) {
  if (daysLeft < 0) return 'danger';
  if (daysLeft <= 7) return 'warning';
  return 'neutral';
}

export function formatDateTime(value) {
  const date = parseDate(value);
  return date
    ? date.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
    : '—';
}

export function timeAgo(value) {
  const date = parseDate(value);
  if (!date) return '';
  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(value);
}

export function formatTime(value) {
  const date = parseDate(value);
  return date ? date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : '';
}

export function dayParts(value) {
  const date = parseDate(value);
  return {
    month: date.toLocaleDateString(undefined, { month: 'short' }),
    day: date.getDate(),
    weekday: date.toLocaleDateString(undefined, { weekday: 'short' }),
  };
}

// "Today", "Tomorrow", "In 5 days" for upcoming events
export function timeUntil(value) {
  const date = parseDate(value);
  if (!date) return '';
  const minutes = Math.round((date.getTime() - Date.now()) / 60000);
  if (minutes <= 0) return 'Happening now';
  if (minutes < 60) return `In ${minutes} min`;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  const days = Math.round((target.getTime() - today.getTime()) / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  return `In ${days} days`;
}

// Value for <input type="datetime-local"> in the viewer's timezone
export function toLocalInputValue(value) {
  const date = parseDate(value);
  if (!date) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function formatDuration(minutes) {
  if (minutes < 60) return `${minutes} min`;
  const hours = minutes / 60;
  return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
}

export function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export function todayLabel() {
  return new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}

export function formatBytes(bytes) {
  if (!bytes) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit++;
  }
  return `${size.toFixed(unit ? 1 : 0)} ${units[unit]}`;
}

export function plural(count, word) {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

export function initials(name = '') {
  return name
    .split(/\s+/)
    .filter((word) => word && !/^(dr|mr|ms|mrs|prof)\.?$/i.test(word))
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('');
}

export function approvedStageKeys(thesis) {
  return thesis?.approved_stage_keys ? thesis.approved_stage_keys.split(',') : [];
}
