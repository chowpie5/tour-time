import { useState } from 'react';
import { useData, useMutate, useActiveTour } from '../store';
import { useTourDays } from '../lib/hooks';
import type { AppData, Day, DayType, Hotel, TravelLeg } from '../types';
import { addDays, formatDate, sortByTime, todayIso, uid } from '../lib/format';
import { syncAdvanceFromSchedule, syncScheduleFromAdvance } from '../lib/advance';
import DayList from '../components/DayList';
import { Badge, Empty, Field, Modal, PageHeader } from '../components/ui';

const EMPTY_HOTEL: Hotel = { name: '', address: '', phone: '', checkIn: '', checkOut: '', confirmation: '' };

export default function Schedule() {
  const tour = useActiveTour();
  const days = useTourDays();
  const mutate = useMutate();
  const [selectedId, setSelectedId] = useState<string | undefined>(days[0]?.id);
  const [adding, setAdding] = useState(false);
  const selected = days.find((d) => d.id === selectedId) ?? days[0];

  return (
    <div className="page split-page">
      <PageHeader
        title="Tour Planning & Scheduling"
        subtitle="Day-by-day itinerary, travel, hotels and run of show."
        actions={
          <button className="btn primary" onClick={() => setAdding(true)}>
            + Add dates
          </button>
        }
      />
      <div className="split">
        <div className="split-list">{days.length ? <DayList days={days} selectedId={selected?.id} onSelect={setSelectedId} /> : <Empty>No dates yet.</Empty>}</div>
        <div className="split-detail">{selected ? <DayEditor key={selected.id} day={selected} onDeleted={() => setSelectedId(undefined)} /> : <Empty>Add dates to start building the itinerary.</Empty>}</div>
      </div>
      {adding && (
        <AddDatesModal
          lastDate={days[days.length - 1]?.date}
          onClose={() => setAdding(false)}
          onAdd={(start, count, type, city) => {
            const ids: string[] = [];
            mutate((d) => {
              for (let i = 0; i < count; i++) {
                const id = uid();
                ids.push(id);
                d.days.push({ id, tourId: tour.id, date: addDays(start, i), type, city, notes: '', schedule: [], travel: [] });
              }
            });
            setSelectedId(ids[0]);
            setAdding(false);
          }}
        />
      )}
    </div>
  );
}

function AddDatesModal({ lastDate, onClose, onAdd }: { lastDate?: string; onClose: () => void; onAdd: (start: string, count: number, type: DayType, city: string) => void }) {
  const [start, setStart] = useState(lastDate ? addDays(lastDate, 1) : todayIso());
  const [count, setCount] = useState(1);
  const [type, setType] = useState<DayType>('show');
  const [city, setCity] = useState('');
  return (
    <Modal title="Add dates" onClose={onClose} footer={<button className="btn primary" onClick={() => onAdd(start, Math.max(1, count), type, city)}>Add {count} day{count > 1 ? 's' : ''}</button>}>
      <div className="form-grid">
        <Field label="Start date">
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
        </Field>
        <Field label="Number of days">
          <input type="number" min={1} max={120} value={count} onChange={(e) => setCount(Number(e.target.value))} />
        </Field>
        <Field label="Day type">
          <select value={type} onChange={(e) => setType(e.target.value as DayType)}>
            <option value="show">Show day</option>
            <option value="travel">Travel day</option>
            <option value="off">Day off</option>
          </select>
        </Field>
        <Field label="City">
          <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. Chicago, IL" />
        </Field>
      </div>
    </Modal>
  );
}

function DayEditor({ day, onDeleted }: { day: Day; onDeleted: () => void }) {
  const data = useData();
  const mutate = useMutate();
  const template = data.templates.find((t) => t.id === day.advance?.templateId);
  const promoters = data.contacts.filter((c) => c.category === 'promoter');

  const update = (fn: (d: Day, all: AppData) => void) =>
    mutate((all) => {
      const d = all.days.find((x) => x.id === day.id);
      if (d) fn(d, all);
    });

  const setType = (type: DayType) =>
    update((d, all) => {
      d.type = type;
      if (type === 'show' && !d.advance && all.templates[0]) {
        d.advance = { templateId: all.templates[0].id, values: {}, confirmed: {} };
      }
    });

  return (
    <div className="stack">
      <section className="card">
        <div className="card-head">
          <h2>{formatDate(day.date, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</h2>
          <button
            className="btn danger ghost"
            onClick={() => {
              if (!confirm('Delete this day and its schedule?')) return;
              mutate((all) => {
                all.days = all.days.filter((x) => x.id !== day.id);
                all.settlements = all.settlements.filter((s) => s.dayId !== day.id);
              });
              onDeleted();
            }}
          >
            Delete day
          </button>
        </div>
        <div className="form-grid">
          <Field label="Date">
            <input type="date" value={day.date} onChange={(e) => update((d) => void (d.date = e.target.value))} />
          </Field>
          <Field label="Day type">
            <select value={day.type} onChange={(e) => setType(e.target.value as DayType)}>
              <option value="show">Show day</option>
              <option value="travel">Travel day</option>
              <option value="off">Day off</option>
            </select>
          </Field>
          <Field label="City / route">
            <input value={day.city} onChange={(e) => update((d) => void (d.city = e.target.value))} />
          </Field>
          {day.type === 'show' && (
            <>
              <Field label="Venue">
                <select value={day.venueId ?? ''} onChange={(e) => update((d) => void (d.venueId = e.target.value || undefined))}>
                  <option value="">— Select venue —</option>
                  {data.venues.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} ({v.city})
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Promoter">
                <select value={day.promoterId ?? ''} onChange={(e) => update((d) => void (d.promoterId = e.target.value || undefined))}>
                  <option value="">— Select promoter —</option>
                  {promoters.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.company})
                    </option>
                  ))}
                </select>
              </Field>
            </>
          )}
          <Field label="Notes" full>
            <textarea rows={2} value={day.notes} onChange={(e) => update((d) => void (d.notes = e.target.value))} />
          </Field>
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Run of show</h2>
          <button className="btn" onClick={() => update((d) => void d.schedule.push({ id: uid(), time: '', label: '' }))}>
            + Add item
          </button>
        </div>
        {day.schedule.length === 0 && <Empty>No schedule items. Times filled in on the Advancing page appear here automatically.</Empty>}
        <table className="table">
          <tbody>
            {sortByTime(day.schedule).map((item) => (
              <tr key={item.id}>
                <td style={{ width: 130 }}>
                  <input
                    type="time"
                    value={item.time}
                    aria-label="Time"
                    onChange={(e) =>
                      update((d, all) => {
                        const it = d.schedule.find((s) => s.id === item.id)!;
                        it.time = e.target.value;
                        if (it.key) {
                          syncAdvanceFromSchedule(d, template, it.key, e.target.value);
                          syncScheduleFromAdvance(d, all.templates.find((t) => t.id === d.advance?.templateId));
                        }
                      })
                    }
                  />
                </td>
                <td>
                  <input value={item.label} aria-label="Label" placeholder="What's happening" onChange={(e) => update((d) => void (d.schedule.find((s) => s.id === item.id)!.label = e.target.value))} />
                </td>
                <td style={{ width: 120 }}>{item.key && <Badge kind="linked">From advance</Badge>}</td>
                <td style={{ width: 40 }}>
                  <button
                    className="icon-btn"
                    aria-label="Remove item"
                    onClick={() =>
                      update((d) => {
                        d.schedule = d.schedule.filter((s) => s.id !== item.id);
                        if (item.key) syncAdvanceFromSchedule(d, template, item.key, '');
                      })
                    }
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <TravelSection day={day} update={update} />

      <section className="card">
        <div className="card-head">
          <h2>Hotel</h2>
          {day.hotel ? (
            <button className="btn ghost" onClick={() => update((d) => void delete d.hotel)}>
              Remove
            </button>
          ) : (
            <button className="btn" onClick={() => update((d) => void (d.hotel = { ...EMPTY_HOTEL }))}>
              + Add hotel
            </button>
          )}
        </div>
        {day.hotel ? (
          <div className="form-grid">
            {(
              [
                ['name', 'Hotel', 'text'],
                ['address', 'Address', 'text'],
                ['phone', 'Phone', 'text'],
                ['confirmation', 'Confirmation #', 'text'],
                ['checkIn', 'Check-in', 'time'],
                ['checkOut', 'Check-out', 'time'],
              ] as const
            ).map(([key, label, type]) => (
              <Field key={key} label={label}>
                <input type={type} value={day.hotel![key]} onChange={(e) => update((d) => void (d.hotel![key] = e.target.value))} />
              </Field>
            ))}
          </div>
        ) : (
          <Empty>No hotel for this day.</Empty>
        )}
      </section>
    </div>
  );
}

function TravelSection({ day, update }: { day: Day; update: (fn: (d: Day) => void) => void }) {
  const [editing, setEditing] = useState<TravelLeg | null>(null);
  const save = (leg: TravelLeg) => {
    update((d) => {
      const i = d.travel.findIndex((t) => t.id === leg.id);
      if (i >= 0) d.travel[i] = leg;
      else d.travel.push(leg);
    });
    setEditing(null);
  };
  return (
    <section className="card">
      <div className="card-head">
        <h2>Travel</h2>
        <button className="btn" onClick={() => setEditing({ id: uid(), mode: 'bus', carrier: '', number: '', from: '', to: '', depart: '', arrive: '', confirmation: '', notes: '' })}>
          + Add travel
        </button>
      </div>
      {day.travel.length === 0 ? (
        <Empty>No travel arrangements.</Empty>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Mode</th>
              <th>Carrier / #</th>
              <th>Route</th>
              <th>Depart</th>
              <th>Arrive</th>
              <th>Conf.</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {day.travel.map((t) => (
              <tr key={t.id}>
                <td className="capitalize">{t.mode}</td>
                <td>
                  {t.carrier} {t.number}
                </td>
                <td>
                  {t.from} → {t.to}
                </td>
                <td>{t.depart}</td>
                <td>{t.arrive}</td>
                <td>{t.confirmation}</td>
                <td className="row gap-sm">
                  <button className="btn ghost small" onClick={() => setEditing(t)}>
                    Edit
                  </button>
                  <button className="icon-btn" aria-label="Remove travel" onClick={() => update((d) => void (d.travel = d.travel.filter((x) => x.id !== t.id)))}>
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {editing && <TravelModal leg={editing} onClose={() => setEditing(null)} onSave={save} />}
    </section>
  );
}

function TravelModal({ leg, onClose, onSave }: { leg: TravelLeg; onClose: () => void; onSave: (l: TravelLeg) => void }) {
  const [f, setF] = useState(leg);
  const text = (key: keyof TravelLeg, label: string, type = 'text') => (
    <Field label={label}>
      <input type={type} value={f[key]} onChange={(e) => setF({ ...f, [key]: e.target.value })} />
    </Field>
  );
  return (
    <Modal title="Travel leg" onClose={onClose} footer={<button className="btn primary" onClick={() => onSave(f)}>Save</button>}>
      <div className="form-grid">
        <Field label="Mode">
          <select value={f.mode} onChange={(e) => setF({ ...f, mode: e.target.value as TravelLeg['mode'] })}>
            {['bus', 'flight', 'train', 'van', 'car', 'other'].map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </Field>
        {text('carrier', 'Carrier')}
        {text('number', 'Flight / vehicle #')}
        {text('confirmation', 'Confirmation #')}
        {text('from', 'From')}
        {text('to', 'To')}
        {text('depart', 'Depart', 'time')}
        {text('arrive', 'Arrive', 'time')}
        <Field label="Notes" full>
          <textarea rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
        </Field>
      </div>
    </Modal>
  );
}
