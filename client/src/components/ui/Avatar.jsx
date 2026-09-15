import { initials } from '../../utils/format.js';

const COLORS = ['#2451d6', '#0f2a7a', '#3b6ff0', '#1a3a9c', '#4f63d8', '#1e4fb8', '#2c3e8f', '#5578e8'];

function colorFor(name = '') {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return COLORS[hash % COLORS.length];
}

export default function Avatar({ name, size = 'md' }) {
  return (
    <span className={`avatar avatar-${size}`} style={{ background: colorFor(name) }} aria-hidden="true">
      {initials(name) || '?'}
    </span>
  );
}
