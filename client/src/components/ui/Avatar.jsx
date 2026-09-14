import { initials } from '../../utils/format.js';

const COLORS = ['#4f46e5', '#0e7490', '#b45309', '#be185d', '#15803d', '#7c3aed', '#1d4ed8', '#c2410c'];

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
