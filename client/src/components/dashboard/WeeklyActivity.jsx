import { parseDate, plural } from '../../utils/format.js';

const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
// Striped placeholder bars for days without activity get varied, purely decorative heights
const PLACEHOLDER_HEIGHTS = [82, 70, 90, 66, 96, 62, 86];

// Buckets activity timestamps into the current Sunday–Saturday week in the viewer's timezone
function buildWeek(timestamps) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(today);
  start.setDate(today.getDate() - today.getDay());

  const days = DAY_LETTERS.map((letter, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return { letter, date, count: 0, isToday: index === today.getDay(), isFuture: date > today };
  });

  for (const value of timestamps) {
    const day = parseDate(value);
    day.setHours(0, 0, 0, 0);
    const index = Math.round((day.getTime() - start.getTime()) / 86400000);
    if (index >= 0 && index < days.length) days[index].count += 1;
  }
  return days;
}

export default function WeeklyActivity({ timestamps, title = 'Weekly Activity' }) {
  const days = buildWeek(timestamps);
  const max = Math.max(1, ...days.map((day) => day.count));
  const total = days.reduce((sum, day) => sum + day.count, 0);

  return (
    <section className="dash-card analytics">
      <div className="dash-card-head">
        <h3>{title}</h3>
        <span className="dash-card-meta">{plural(total, 'update')} this week</span>
      </div>
      <div className="week-chart">
        {days.map((day, index) => {
          const weekday = day.date.toLocaleDateString(undefined, { weekday: 'long' });
          const empty = day.count === 0;
          const tone = empty ? 'empty' : day.isToday ? 'today' : day.count === max ? 'peak' : 'filled';
          const height = empty ? PLACEHOLDER_HEIGHTS[index] : 38 + (day.count / max) * 62;
          const label = day.isFuture ? `${weekday}: upcoming` : `${weekday}: ${plural(day.count, 'update')}`;

          return (
            <div key={index} className={`week-col${day.isToday ? ' is-today' : ''}`}>
              <div className="week-slot">
                <div
                  className={`week-bar week-${tone}`}
                  style={{ '--h': `${height}%`, '--i': index }}
                  title={label}
                  role="img"
                  aria-label={label}
                >
                  {day.isToday && !empty && <span className="week-pill">{plural(day.count, 'update')}</span>}
                </div>
              </div>
              <span className="week-day" aria-hidden="true">
                {day.letter}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
