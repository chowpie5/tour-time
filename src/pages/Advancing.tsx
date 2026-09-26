import { useState } from 'react';
import { useData, useMutate } from '../store';
import { useTourDays } from '../lib/hooks';
import type { AdvanceField, AdvanceTemplate, AppData, Day, FieldType, ScheduleKey } from '../types';
import { SCHEDULE_KEYS } from '../types';
import { advanceProgress, syncScheduleFromAdvance } from '../lib/advance';
import { uid } from '../lib/format';
import DayList from '../components/DayList';
import { Badge, Empty, PageHeader } from '../components/ui';

/** Re-sync every day's schedule that uses the given template. */
function resyncTemplate(all: AppData, templateId: string) {
  const t = all.templates.find((x) => x.id === templateId);
  for (const d of all.days) if (d.advance?.templateId === templateId) syncScheduleFromAdvance(d, t);
}

export default function Advancing() {
  const [tab, setTab] = useState<'advances' | 'templates'>('advances');
  return (
    <div className="page split-page">
      <PageHeader
        title="Advancing"
        subtitle="Advance each show against a template. Times flow into the schedule and day sheets automatically."
        actions={
          <div className="tabs">
            <button className={tab === 'advances' ? 'tab active' : 'tab'} onClick={() => setTab('advances')}>
              Show advances
            </button>
            <button className={tab === 'templates' ? 'tab active' : 'tab'} onClick={() => setTab('templates')}>
              Templates
            </button>
          </div>
        }
      />
      {tab === 'advances' ? <Advances /> : <Templates />}
    </div>
  );
}

function Advances() {
  const data = useData();
  const shows = useTourDays().filter((d) => d.type === 'show');
  const [selectedId, setSelectedId] = useState(shows[0]?.id);
  const selected = shows.find((d) => d.id === selectedId) ?? shows[0];
  const tplFor = (d: Day) => data.templates.find((t) => t.id === d.advance?.templateId);

  if (!shows.length) return <Empty>No show days yet. Add show days on the Schedule page.</Empty>;
  return (
    <div className="split">
      <div className="split-list">
        <DayList
          days={shows}
          selectedId={selected?.id}
          onSelect={setSelectedId}
          extra={(d) => {
            const p = advanceProgress(d, tplFor(d));
            const pct = p.total ? Math.round((p.confirmed / p.total) * 100) : 0;
            return (
              <div className="progress" title={`${p.filled} filled · ${p.confirmed} confirmed of ${p.total}`}>
                <div className="progress-bar" style={{ width: `${pct}%` }} />
              </div>
            );
          }}
        />
      </div>
      <div className="split-detail">{selected && <AdvanceForm key={selected.id} day={selected} />}</div>
    </div>
  );
}

function AdvanceForm({ day }: { day: Day }) {
  const data = useData();
  const mutate = useMutate();
  const template = data.templates.find((t) => t.id === day.advance?.templateId);
  const venue = data.venues.find((v) => v.id === day.venueId);
  const p = advanceProgress(day, template);

  const update = (fn: (d: Day, all: AppData) => void) =>
    mutate((all) => {
      const d = all.days.find((x) => x.id === day.id);
      if (!d) return;
      if (!d.advance) d.advance = { templateId: all.templates[0]?.id ?? '', values: {}, confirmed: {} };
      fn(d, all);
      syncScheduleFromAdvance(d, all.templates.find((t) => t.id === d.advance!.templateId));
    });

  return (
    <div className="stack">
      <section className="card">
        <div className="card-head">
          <div>
            <h2>
              {day.city} {venue && <span className="muted">· {venue.name}</span>}
            </h2>
            <p className="muted small">
              {p.filled}/{p.total} answered · {p.confirmed}/{p.total} confirmed with venue
            </p>
          </div>
          <label className="row gap-sm">
            <span className="muted small">Template</span>
            <select value={day.advance?.templateId ?? ''} onChange={(e) => update((d) => void (d.advance!.templateId = e.target.value))}>
              {!day.advance && <option value="">— Choose —</option>}
              {data.templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>
      {!template && <Empty>Select a template to start advancing this show.</Empty>}
      {template?.sections.map((section) => (
        <section className="card" key={section.id}>
          <h3>{section.title}</h3>
          <div className="advance-fields">
            {section.fields.map((f) => {
              const value = day.advance?.values[f.id] ?? '';
              const confirmed = !!day.advance?.confirmed[f.id];
              const set = (v: string) => update((d) => void (d.advance!.values[f.id] = v));
              return (
                <div className={confirmed ? 'advance-field confirmed' : 'advance-field'} key={f.id}>
                  <label htmlFor={`${day.id}-${f.id}`}>
                    {f.label}
                    {f.scheduleKey && (
                      <span className="muted small" title="This field updates the day's schedule">
                        {' '}
                        ↔ schedule
                      </span>
                    )}
                  </label>
                  {f.type === 'longtext' ? (
                    <textarea id={`${day.id}-${f.id}`} rows={2} value={value} onChange={(e) => set(e.target.value)} />
                  ) : f.type === 'checkbox' ? (
                    <select id={`${day.id}-${f.id}`} value={value} onChange={(e) => set(e.target.value)}>
                      <option value="">—</option>
                      <option value="Yes">Yes</option>
                      <option value="No">No</option>
                    </select>
                  ) : (
                    <input id={`${day.id}-${f.id}`} type={f.type === 'time' ? 'time' : f.type === 'number' ? 'number' : 'text'} value={value} onChange={(e) => set(e.target.value)} />
                  )}
                  <label className="confirm-toggle" title="Confirmed with venue">
                    <input type="checkbox" checked={confirmed} onChange={(e) => update((d) => void (d.advance!.confirmed[f.id] = e.target.checked))} />
                    Confirmed
                  </label>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

function Templates() {
  const data = useData();
  const mutate = useMutate();
  const [selectedId, setSelectedId] = useState<string | undefined>(data.templates[0]?.id);
  const tpl = data.templates.find((t) => t.id === selectedId) ?? data.templates[0];
  const usage = (id: string) => data.days.filter((d) => d.advance?.templateId === id).length;

  const updateTpl = (fn: (t: AdvanceTemplate) => void) =>
    mutate((all) => {
      const t = all.templates.find((x) => x.id === tpl.id);
      if (!t) return;
      fn(t);
      resyncTemplate(all, t.id);
    });

  const newTemplate = (base?: AdvanceTemplate) => {
    const id = uid();
    mutate((all) => {
      all.templates.push(
        base
          ? { ...structuredClone(base), id, name: `${base.name} (copy)`, sections: base.sections.map((s) => ({ ...s, id: uid(), fields: s.fields.map((f) => ({ ...f, id: uid() })) })) }
          : { id, name: 'New template', sections: [{ id: uid(), title: 'General', fields: [] }] },
      );
    });
    setSelectedId(id);
  };

  return (
    <div className="split">
      <div className="split-list">
        <ul className="day-list">
          {data.templates.map((t) => (
            <li key={t.id}>
              <button className={t.id === tpl?.id ? 'day-item selected' : 'day-item'} onClick={() => setSelectedId(t.id)}>
                <strong>{t.name}</strong>
                <div className="muted small">
                  {t.sections.reduce((n, s) => n + s.fields.length, 0)} fields · used by {usage(t.id)} shows
                </div>
              </button>
            </li>
          ))}
        </ul>
        <button className="btn full-width" onClick={() => newTemplate()}>
          + New template
        </button>
      </div>
      <div className="split-detail">
        {tpl ? (
          <div className="stack">
            <section className="card">
              <div className="card-head">
                <input className="title-input" aria-label="Template name" value={tpl.name} onChange={(e) => updateTpl((t) => void (t.name = e.target.value))} />
                <div className="row gap-sm">
                  <button className="btn ghost" onClick={() => newTemplate(tpl)}>
                    Duplicate
                  </button>
                  <button
                    className="btn danger ghost"
                    disabled={data.templates.length === 1}
                    onClick={() => {
                      if (!confirm(`Delete "${tpl.name}"? Shows using it will keep their answers but lose the form.`)) return;
                      mutate((all) => void (all.templates = all.templates.filter((t) => t.id !== tpl.id)));
                      setSelectedId(undefined);
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
              <p className="muted small">Changes here update every show using this template immediately. Bind a time field to a schedule slot and it will populate the run of show and day sheets.</p>
            </section>
            {tpl.sections.map((section, si) => (
              <section className="card" key={section.id}>
                <div className="card-head">
                  <input className="section-input" aria-label="Section title" value={section.title} onChange={(e) => updateTpl((t) => void (t.sections[si].title = e.target.value))} />
                  <div className="row gap-sm">
                    <button className="btn small" onClick={() => updateTpl((t) => void t.sections[si].fields.push({ id: uid(), label: 'New field', type: 'text' }))}>
                      + Field
                    </button>
                    <button className="icon-btn" aria-label="Delete section" onClick={() => updateTpl((t) => void t.sections.splice(si, 1))}>
                      ×
                    </button>
                  </div>
                </div>
                <table className="table">
                  <tbody>
                    {section.fields.map((f, fi) => (
                      <FieldRow
                        key={f.id}
                        field={f}
                        onChange={(nf) => updateTpl((t) => void (t.sections[si].fields[fi] = nf))}
                        onRemove={() => updateTpl((t) => void t.sections[si].fields.splice(fi, 1))}
                        onMove={(dir) =>
                          updateTpl((t) => {
                            const arr = t.sections[si].fields;
                            const j = fi + dir;
                            if (j < 0 || j >= arr.length) return;
                            [arr[fi], arr[j]] = [arr[j], arr[fi]];
                          })
                        }
                      />
                    ))}
                  </tbody>
                </table>
                {section.fields.length === 0 && <Empty>No fields in this section.</Empty>}
              </section>
            ))}
            <button className="btn" onClick={() => updateTpl((t) => void t.sections.push({ id: uid(), title: 'New section', fields: [] }))}>
              + Add section
            </button>
          </div>
        ) : (
          <Empty>Select a template.</Empty>
        )}
      </div>
    </div>
  );
}

function FieldRow({ field, onChange, onRemove, onMove }: { field: AdvanceField; onChange: (f: AdvanceField) => void; onRemove: () => void; onMove: (dir: -1 | 1) => void }) {
  return (
    <tr>
      <td>
        <input aria-label="Field label" value={field.label} onChange={(e) => onChange({ ...field, label: e.target.value })} />
      </td>
      <td style={{ width: 130 }}>
        <select aria-label="Field type" value={field.type} onChange={(e) => onChange({ ...field, type: e.target.value as FieldType, scheduleKey: e.target.value === 'time' ? field.scheduleKey : undefined })}>
          <option value="text">Text</option>
          <option value="longtext">Long text</option>
          <option value="time">Time</option>
          <option value="number">Number</option>
          <option value="checkbox">Yes / No</option>
        </select>
      </td>
      <td style={{ width: 170 }}>
        {field.type === 'time' ? (
          <select aria-label="Schedule binding" value={field.scheduleKey ?? ''} onChange={(e) => onChange({ ...field, scheduleKey: (e.target.value || undefined) as ScheduleKey | undefined })}>
            <option value="">Not on schedule</option>
            {Object.entries(SCHEDULE_KEYS).map(([k, v]) => (
              <option key={k} value={k}>
                → {v}
              </option>
            ))}
          </select>
        ) : (
          field.scheduleKey && <Badge kind="linked">bound</Badge>
        )}
      </td>
      <td style={{ width: 96 }} className="row gap-sm">
        <button className="icon-btn" aria-label="Move up" onClick={() => onMove(-1)}>
          ↑
        </button>
        <button className="icon-btn" aria-label="Move down" onClick={() => onMove(1)}>
          ↓
        </button>
        <button className="icon-btn" aria-label="Remove field" onClick={onRemove}>
          ×
        </button>
      </td>
    </tr>
  );
}
