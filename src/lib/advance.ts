import type { AdvanceTemplate, Day, ScheduleKey } from '../types';
import { SCHEDULE_KEYS } from '../types';
import { uid } from './format';

export const templateFields = (t?: AdvanceTemplate) => (t ? t.sections.flatMap((s) => s.fields) : []);

/**
 * Keeps a day's schedule in sync with its advance: every template field bound
 * to a schedule slot (load-in, doors, curfew…) creates/updates/removes the
 * matching schedule item. Mutates `day`.
 */
export function syncScheduleFromAdvance(day: Day, template?: AdvanceTemplate) {
  if (!day.advance || !template) return;
  const bound = new Map<ScheduleKey, string>();
  for (const f of templateFields(template)) {
    if (f.scheduleKey) bound.set(f.scheduleKey, day.advance.values[f.id] ?? '');
  }
  // Drop items whose binding no longer exists in the template or whose value was cleared.
  day.schedule = day.schedule.filter((item) => !item.key || (bound.has(item.key) && bound.get(item.key)));
  for (const [key, time] of bound) {
    if (!time) continue;
    const existing = day.schedule.find((i) => i.key === key);
    if (existing) existing.time = time;
    else day.schedule.push({ id: uid(), time, label: SCHEDULE_KEYS[key], key });
  }
}

/** Reverse direction: editing a bound schedule item's time writes back into the advance. */
export function syncAdvanceFromSchedule(day: Day, template: AdvanceTemplate | undefined, key: ScheduleKey, time: string) {
  if (!day.advance || !template) return;
  for (const f of templateFields(template)) {
    if (f.scheduleKey === key) day.advance.values[f.id] = time;
  }
}

export function advanceProgress(day: Day, template?: AdvanceTemplate) {
  const fields = templateFields(template);
  if (!day.advance || fields.length === 0) return { filled: 0, confirmed: 0, total: fields.length };
  const filled = fields.filter((f) => (day.advance!.values[f.id] ?? '') !== '').length;
  const confirmed = fields.filter((f) => day.advance!.confirmed[f.id]).length;
  return { filled, confirmed, total: fields.length };
}
