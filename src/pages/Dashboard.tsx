import { Link } from 'react-router-dom';
import { useData, useActiveTour } from '../store';
import { useTourDays } from '../lib/hooks';
import { advanceProgress } from '../lib/advance';
import { DAY_TYPE_LABEL, formatDate, formatMoney, formatTime, sortByTime, todayIso } from '../lib/format';
import { Badge, Empty, PageHeader, Stat } from '../components/ui';

export default function Dashboard() {
  const data = useData();
  const tour = useActiveTour();
  const days = useTourDays();
  const today = todayIso();
  const upcoming = days.filter((d) => d.date >= today);
  const next = upcoming[0];
  const shows = days.filter((d) => d.type === 'show');
  const spent = data.expenses.filter((e) => e.tourId === tour.id).reduce((s, e) => s + e.amount, 0);
  const planned = Object.values(tour.budget).reduce((s, n) => s + n, 0);
  const templates = new Map(data.templates.map((t) => [t.id, t]));
  const advancesOpen = shows.filter((d) => {
    const p = advanceProgress(d, templates.get(d.advance?.templateId ?? ''));
    return p.total === 0 || p.confirmed < p.total;
  });

  return (
    <div className="page">
      <PageHeader title={tour.name} subtitle={`${tour.artist} · ${days.length ? `${formatDate(days[0].date)} – ${formatDate(days[days.length - 1].date)}` : 'No dates yet'}`} />
      <div className="stats">
        <Stat label="Shows" value={shows.length} sub={`${days.filter((d) => d.type === 'travel').length} travel · ${days.filter((d) => d.type === 'off').length} off`} />
        <Stat label="Advances open" value={advancesOpen.length} sub={`of ${shows.length} show days`} />
        <Stat label="Spent" value={formatMoney(spent, tour.currency)} sub={planned ? `of ${formatMoney(planned, tour.currency)} budget` : 'No budget set'} />
        <Stat label="Contacts" value={data.contacts.length} sub={`${data.venues.length} venues`} />
      </div>

      <div className="grid-2">
        <section className="card">
          <div className="card-head">
            <h2>Next up</h2>
            <Link to="/schedule" className="link">
              Open schedule →
            </Link>
          </div>
          {next ? (
            <>
              <div className="row gap">
                <strong>{formatDate(next.date, { weekday: 'long', month: 'long', day: 'numeric' })}</strong>
                <Badge kind={next.type}>{DAY_TYPE_LABEL[next.type]}</Badge>
              </div>
              <p className="muted">
                {next.city}
                {next.venueId && ` · ${data.venues.find((v) => v.id === next.venueId)?.name ?? ''}`}
              </p>
              <table className="table compact">
                <tbody>
                  {sortByTime(next.schedule).map((s) => (
                    <tr key={s.id}>
                      <td className="time">{formatTime(s.time)}</td>
                      <td>{s.label}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : (
            <Empty>No upcoming dates.</Empty>
          )}
        </section>

        <section className="card">
          <div className="card-head">
            <h2>Upcoming dates</h2>
          </div>
          <table className="table compact">
            <tbody>
              {upcoming.slice(0, 10).map((d) => {
                const p = advanceProgress(d, templates.get(d.advance?.templateId ?? ''));
                return (
                  <tr key={d.id}>
                    <td>{formatDate(d.date)}</td>
                    <td>{d.city}</td>
                    <td>
                      <Badge kind={d.type}>{DAY_TYPE_LABEL[d.type]}</Badge>
                    </td>
                    <td className="muted small">{d.type === 'show' ? `Advance ${p.confirmed}/${p.total}` : ''}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {upcoming.length === 0 && <Empty>Nothing scheduled.</Empty>}
        </section>
      </div>
    </div>
  );
}
