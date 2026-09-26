import { useData, useActiveTour } from '../store';
import type { Day } from '../types';
import { DAY_TYPE_LABEL, formatDate, formatTime, sortByTime } from '../lib/format';

export const REPORT_SECTIONS = [
  { key: 'schedule', label: 'Run of show' },
  { key: 'travel', label: 'Travel' },
  { key: 'hotel', label: 'Hotel' },
  { key: 'venue', label: 'Venue & contacts' },
  { key: 'advance', label: 'Advance details' },
  { key: 'crew', label: 'Crew & band contacts' },
  { key: 'notes', label: 'Day notes' },
] as const;
export type ReportSection = (typeof REPORT_SECTIONS)[number]['key'];

/** Printable report. Everything shown is read live from the tour data, so advances flow in automatically. */
export default function Report({ kind, day, days, sections, title, note }: { kind: 'daysheet' | 'itinerary'; day?: Day; days: Day[]; sections: ReportSection[]; title: string; note: string }) {
  const tour = useActiveTour();
  const on = (k: ReportSection) => sections.includes(k);
  return (
    <article className="report">
      <header className="report-head">
        <div>
          <div className="report-kicker">
            {tour.artist} · {tour.name}
          </div>
          <h1>{title || (kind === 'daysheet' ? 'Day Sheet' : 'Tour Itinerary')}</h1>
        </div>
        {kind === 'daysheet' && day && (
          <div className="report-date">
            <strong>{formatDate(day.date, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</strong>
            <div>
              {DAY_TYPE_LABEL[day.type]} · {day.city}
            </div>
          </div>
        )}
      </header>
      {note && <div className="report-note">{note}</div>}
      {kind === 'daysheet' && day ? (
        <DayBlock day={day} on={on} />
      ) : (
        days.map((d) => (
          <div key={d.id} className="report-day">
            <h2>
              {formatDate(d.date, { weekday: 'long', month: 'short', day: 'numeric' })} — {d.city} <span className="report-type">({DAY_TYPE_LABEL[d.type]})</span>
            </h2>
            <DayBlock day={d} on={on} compact />
          </div>
        ))
      )}
      {on('crew') && <CrewBlock />}
      <footer className="report-foot">Generated {new Date().toLocaleString()} · Tour Time</footer>
    </article>
  );
}

function DayBlock({ day, on, compact }: { day: Day; on: (k: ReportSection) => boolean; compact?: boolean }) {
  const data = useData();
  const venue = data.venues.find((v) => v.id === day.venueId);
  const promoter = data.contacts.find((c) => c.id === day.promoterId);
  const venueContacts = data.contacts.filter((c) => venue && c.venueId === venue.id);
  const template = data.templates.find((t) => t.id === day.advance?.templateId);
  const docs = data.documents.filter((d) => d.dayId === day.id);

  return (
    <div className={compact ? 'report-grid compact' : 'report-grid'}>
      {on('schedule') && day.schedule.length > 0 && (
        <section>
          <h3>Schedule</h3>
          <table>
            <tbody>
              {sortByTime(day.schedule).map((s) => (
                <tr key={s.id}>
                  <td className="time">{formatTime(s.time)}</td>
                  <td>{s.label}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
      {on('travel') && day.travel.length > 0 && (
        <section>
          <h3>Travel</h3>
          {day.travel.map((t) => (
            <p key={t.id}>
              <strong className="capitalize">{t.mode}</strong> {t.carrier} {t.number}: {t.from} → {t.to}
              <br />
              Depart {formatTime(t.depart)} · Arrive {formatTime(t.arrive)}
              {t.confirmation && ` · Conf. ${t.confirmation}`}
              {t.notes && (
                <>
                  <br />
                  <em>{t.notes}</em>
                </>
              )}
            </p>
          ))}
        </section>
      )}
      {on('hotel') && day.hotel && (
        <section>
          <h3>Hotel</h3>
          <p>
            <strong>{day.hotel.name}</strong>
            {day.hotel.address && (
              <>
                <br />
                {day.hotel.address}
              </>
            )}
            {day.hotel.phone && (
              <>
                <br />
                {day.hotel.phone}
              </>
            )}
            <br />
            In {formatTime(day.hotel.checkIn)} · Out {formatTime(day.hotel.checkOut)}
            {day.hotel.confirmation && ` · Conf. ${day.hotel.confirmation}`}
          </p>
        </section>
      )}
      {on('venue') && (venue || promoter) && (
        <section>
          <h3>Venue</h3>
          {venue && (
            <p>
              <strong>{venue.name}</strong>
              <br />
              {venue.address}, {venue.city}
              <br />
              Capacity {venue.capacity.toLocaleString()}
            </p>
          )}
          {[...venueContacts, ...(promoter ? [promoter] : [])].map((c) => (
            <p key={c.id} className="small">
              <strong>{c.name}</strong> ({c.role}) · {c.phone} · {c.email}
            </p>
          ))}
        </section>
      )}
      {on('advance') && template && day.advance && (
        <section className="span-2">
          <h3>Advance</h3>
          <div className="advance-print">
            {template.sections.map((sec) => {
              const rows = sec.fields.filter((f) => day.advance!.values[f.id]);
              if (!rows.length) return null;
              return (
                <div key={sec.id}>
                  <h4>{sec.title}</h4>
                  <dl>
                    {rows.map((f) => (
                      <div key={f.id}>
                        <dt>{f.label}</dt>
                        <dd>
                          {f.type === 'time' ? formatTime(day.advance!.values[f.id]) : day.advance!.values[f.id]}
                          {day.advance!.confirmed[f.id] ? ' ✓' : ''}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              );
            })}
          </div>
        </section>
      )}
      {on('notes') && (day.notes || docs.length > 0) && (
        <section className="span-2">
          <h3>Notes</h3>
          {day.notes && <p>{day.notes}</p>}
          {docs.length > 0 && <p className="small">Attached documents: {docs.map((d) => d.name).join(', ')}</p>}
        </section>
      )}
    </div>
  );
}

function CrewBlock() {
  const data = useData();
  const people = data.contacts.filter((c) => ['crew', 'band', 'production'].includes(c.category));
  if (!people.length) return null;
  return (
    <section className="report-crew">
      <h3>Crew & band</h3>
      <table>
        <tbody>
          {people.map((c) => (
            <tr key={c.id}>
              <td>
                <strong>{c.name}</strong>
              </td>
              <td>{c.role}</td>
              <td>{c.phone}</td>
              <td>{c.email}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
