import type { Day } from '../types';
import { DAY_TYPE_LABEL, formatDate } from '../lib/format';
import { Badge } from './ui';

/** Left-hand list of tour days used by several pages. */
export default function DayList({ days, selectedId, onSelect, extra }: { days: Day[]; selectedId?: string; onSelect: (id: string) => void; extra?: (d: Day) => React.ReactNode }) {
  return (
    <ul className="day-list">
      {days.map((d) => (
        <li key={d.id}>
          <button className={d.id === selectedId ? 'day-item selected' : 'day-item'} onClick={() => onSelect(d.id)}>
            <div className="day-item-top">
              <strong>{formatDate(d.date)}</strong>
              <Badge kind={d.type}>{DAY_TYPE_LABEL[d.type]}</Badge>
            </div>
            <div className="muted small">{d.city || '—'}</div>
            {extra?.(d)}
          </button>
        </li>
      ))}
    </ul>
  );
}
