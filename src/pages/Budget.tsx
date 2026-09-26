import { useState } from 'react';
import { useData, useMutate, useActiveTour } from '../store';
import { useTourDays } from '../lib/hooks';
import type { Expense, Settlement } from '../types';
import { computeSettlement } from '../lib/settlement';
import { formatDate, formatMoney, todayIso, uid } from '../lib/format';
import { Badge, Empty, Field, Modal, PageHeader, Stat } from '../components/ui';

type Tab = 'budget' | 'expenses' | 'daysheets' | 'settlements';

export default function Budget() {
  const [tab, setTab] = useState<Tab>('budget');
  const tabs: [Tab, string][] = [
    ['budget', 'Tour budget'],
    ['expenses', 'Expenses'],
    ['daysheets', 'Day sheets'],
    ['settlements', 'Settlements'],
  ];
  return (
    <div className="page">
      <PageHeader
        title="Budget & Accounting"
        subtitle="Tour budget, expenses, daily financials and show settlements."
        actions={
          <div className="tabs">
            {tabs.map(([k, l]) => (
              <button key={k} className={tab === k ? 'tab active' : 'tab'} onClick={() => setTab(k)}>
                {l}
              </button>
            ))}
          </div>
        }
      />
      {tab === 'budget' && <TourBudget />}
      {tab === 'expenses' && <Expenses />}
      {tab === 'daysheets' && <DaySheets />}
      {tab === 'settlements' && <Settlements />}
    </div>
  );
}

function useTourMoney() {
  const data = useData();
  const tour = useActiveTour();
  const expenses = data.expenses.filter((e) => e.tourId === tour.id);
  const dayIds = new Set(data.days.filter((d) => d.tourId === tour.id).map((d) => d.id));
  const settlements = data.settlements.filter((s) => dayIds.has(s.dayId));
  const money = (n: number) => formatMoney(n, tour.currency);
  return { tour, expenses, settlements, money };
}

function TourBudget() {
  const mutate = useMutate();
  const { tour, expenses, settlements, money } = useTourMoney();
  const [newCat, setNewCat] = useState('');
  const categories = [...new Set([...Object.keys(tour.budget), ...expenses.map((e) => e.category)])];
  const actual = (cat: string) => expenses.filter((e) => e.category === cat).reduce((s, e) => s + e.amount, 0);
  const planned = Object.values(tour.budget).reduce((s, n) => s + n, 0);
  const spent = expenses.reduce((s, e) => s + e.amount, 0);
  const income = settlements.reduce((s, x) => s + computeSettlement(x).total, 0);

  return (
    <div className="stack">
      <div className="stats">
        <Stat label="Budgeted" value={money(planned)} />
        <Stat label="Spent" value={money(spent)} sub={planned ? `${Math.round((spent / planned) * 100)}% of budget` : undefined} />
        <Stat label="Settled income" value={money(income)} sub={`${settlements.filter((s) => s.settled).length} shows settled`} />
        <Stat label="Net position" value={<span className={income - spent < 0 ? 'neg' : 'pos'}>{money(income - spent)}</span>} />
      </div>
      <section className="card">
        <div className="card-head">
          <h2>Budget by category</h2>
          <div className="row gap-sm">
            <input placeholder="New category" value={newCat} onChange={(e) => setNewCat(e.target.value)} />
            <button
              className="btn"
              onClick={() => {
                const c = newCat.trim();
                if (!c) return;
                mutate((d) => void (d.tours.find((t) => t.id === tour.id)!.budget[c] = 0));
                setNewCat('');
              }}
            >
              Add
            </button>
          </div>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Category</th>
              <th className="num">Budgeted</th>
              <th className="num">Actual</th>
              <th className="num">Remaining</th>
              <th style={{ width: '30%' }}>Used</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((cat) => {
              const p = tour.budget[cat] ?? 0;
              const a = actual(cat);
              const pct = p ? Math.min(100, (a / p) * 100) : a ? 100 : 0;
              return (
                <tr key={cat}>
                  <td>{cat.replace(/_/g, ' ')}</td>
                  <td className="num">
                    <input
                      className="num-input"
                      type="number"
                      aria-label={`${cat} budget`}
                      value={p}
                      onChange={(e) => mutate((d) => void (d.tours.find((t) => t.id === tour.id)!.budget[cat] = Number(e.target.value)))}
                    />
                  </td>
                  <td className="num">{money(a)}</td>
                  <td className={p - a < 0 ? 'num neg' : 'num'}>{money(p - a)}</td>
                  <td>
                    <div className="progress">
                      <div className={a > p ? 'progress-bar over' : 'progress-bar'} style={{ width: `${pct}%` }} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Expenses() {
  const data = useData();
  const mutate = useMutate();
  const days = useTourDays();
  const { tour, expenses, money } = useTourMoney();
  const [editing, setEditing] = useState<Expense | null>(null);
  const [filter, setFilter] = useState('');
  const list = expenses.filter((e) => !filter || e.category === filter).sort((a, b) => b.date.localeCompare(a.date));
  const categories = [...new Set([...Object.keys(tour.budget), ...expenses.map((e) => e.category)])];

  return (
    <section className="card">
      <div className="toolbar">
        <select value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Category filter">
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <span className="muted">Total: {money(list.reduce((s, e) => s + e.amount, 0))}</span>
        <div className="spacer" />
        <button className="btn primary" onClick={() => setEditing({ id: uid(), tourId: tour.id, date: todayIso(), category: categories[0] ?? 'Misc', description: '', amount: 0, paidBy: '', method: 'Card' })}>
          + Add expense
        </button>
      </div>
      {list.length === 0 ? (
        <Empty>No expenses recorded.</Empty>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Category</th>
              <th>Description</th>
              <th>Paid by</th>
              <th>Method</th>
              <th className="num">Amount</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {list.map((e) => (
              <tr key={e.id}>
                <td>{formatDate(e.date)}</td>
                <td>{e.category.replace(/_/g, ' ')}</td>
                <td>{e.description}</td>
                <td>{e.paidBy}</td>
                <td>{e.method}</td>
                <td className="num">{money(e.amount)}</td>
                <td className="row gap-sm">
                  <button className="btn ghost small" onClick={() => setEditing(e)}>
                    Edit
                  </button>
                  <button className="icon-btn" aria-label="Delete expense" onClick={() => mutate((d) => void (d.expenses = d.expenses.filter((x) => x.id !== e.id)))}>
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {editing && (
        <Modal
          title="Expense"
          onClose={() => setEditing(null)}
          footer={
            <button
              className="btn primary"
              onClick={() => {
                mutate((d) => {
                  const i = d.expenses.findIndex((x) => x.id === editing.id);
                  if (i >= 0) d.expenses[i] = editing;
                  else d.expenses.push(editing);
                });
                setEditing(null);
              }}
            >
              Save
            </button>
          }
        >
          <div className="form-grid">
            <Field label="Tour day">
              <select
                value={editing.dayId ?? ''}
                onChange={(e) => {
                  const day = data.days.find((d) => d.id === e.target.value);
                  setEditing({ ...editing, dayId: day?.id, date: day?.date ?? editing.date });
                }}
              >
                <option value="">Tour-level (no day)</option>
                {days.map((d) => (
                  <option key={d.id} value={d.id}>
                    {formatDate(d.date)} — {d.city}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Date">
              <input type="date" value={editing.date} onChange={(e) => setEditing({ ...editing, date: e.target.value })} />
            </Field>
            <Field label="Category">
              <input list="expense-cats" value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value })} />
              <datalist id="expense-cats">
                {categories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </Field>
            <Field label="Amount">
              <input type="number" step="0.01" value={editing.amount} onChange={(e) => setEditing({ ...editing, amount: Number(e.target.value) })} />
            </Field>
            <Field label="Description" full>
              <input value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
            </Field>
            <Field label="Paid by">
              <input value={editing.paidBy} onChange={(e) => setEditing({ ...editing, paidBy: e.target.value })} />
            </Field>
            <Field label="Method">
              <select value={editing.method} onChange={(e) => setEditing({ ...editing, method: e.target.value })}>
                {['Card', 'Cash', 'Wire', 'Check', 'Venue buyout', 'Other'].map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </Field>
          </div>
        </Modal>
      )}
    </section>
  );
}

function DaySheets() {
  const days = useTourDays();
  const { expenses, settlements, money } = useTourMoney();
  let running = 0;
  return (
    <section className="card">
      <p className="muted small">Daily financial summary: settlement income versus that day's expenses, with a running tour total.</p>
      <table className="table">
        <thead>
          <tr>
            <th>Date</th>
            <th>City</th>
            <th>Type</th>
            <th className="num">Show income</th>
            <th className="num">Merch net</th>
            <th className="num">Expenses</th>
            <th className="num">Day net</th>
            <th className="num">Running</th>
          </tr>
        </thead>
        <tbody>
          {days.map((d) => {
            const s = settlements.find((x) => x.dayId === d.id);
            const c = s ? computeSettlement(s) : null;
            const spent = expenses.filter((e) => e.dayId === d.id).reduce((sum, e) => sum + e.amount, 0);
            const net = (c?.total ?? 0) - spent;
            running += net;
            return (
              <tr key={d.id}>
                <td>{formatDate(d.date)}</td>
                <td>{d.city}</td>
                <td>
                  <Badge kind={d.type}>{d.type}</Badge>
                </td>
                <td className="num">{c ? money(c.payout) : '—'}</td>
                <td className="num">{c ? money(c.merchNet) : '—'}</td>
                <td className="num">{money(spent)}</td>
                <td className={net < 0 ? 'num neg' : 'num'}>{money(net)}</td>
                <td className={running < 0 ? 'num neg' : 'num'}>{money(running)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="muted small">Tour-level expenses not tied to a day: {money(expenses.filter((e) => !e.dayId).reduce((s, e) => s + e.amount, 0))}</p>
    </section>
  );
}

function newSettlement(dayId: string, capacity = 0): Settlement {
  return { id: uid(), dayId, dealType: 'versus', guarantee: 0, percentage: 85, ticketPrice: 0, ticketsSold: capacity, comps: 0, taxesAndFees: 0, showExpenses: 0, merchGross: 0, merchVenueCut: 20, deductions: 0, notes: '', settled: false };
}

function Settlements() {
  const data = useData();
  const mutate = useMutate();
  const shows = useTourDays().filter((d) => d.type === 'show');
  const { money } = useTourMoney();
  const [dayId, setDayId] = useState(shows[0]?.id);
  const day = shows.find((d) => d.id === dayId);
  const s = data.settlements.find((x) => x.dayId === dayId);

  if (!shows.length) return <Empty>No show days to settle.</Empty>;
  const set = <K extends keyof Settlement>(key: K, value: Settlement[K]) =>
    mutate((d) => {
      const x = d.settlements.find((y) => y.dayId === dayId);
      if (x) x[key] = value;
    });
  const num = (key: keyof Settlement, label: string, step = '1') => (
    <Field label={label}>
      <input type="number" step={step} value={s![key] as number} onChange={(e) => set(key, Number(e.target.value) as never)} />
    </Field>
  );
  const c = s ? computeSettlement(s) : null;
  const venue = data.venues.find((v) => v.id === day?.venueId);

  return (
    <div className="split">
      <div className="split-list">
        <ul className="day-list">
          {shows.map((d) => {
            const st = data.settlements.find((x) => x.dayId === d.id);
            return (
              <li key={d.id}>
                <button className={d.id === dayId ? 'day-item selected' : 'day-item'} onClick={() => setDayId(d.id)}>
                  <div className="day-item-top">
                    <strong>{formatDate(d.date)}</strong>
                    {st ? <Badge kind={st.settled ? 'show' : 'travel'}>{st.settled ? 'Settled' : 'Draft'}</Badge> : <Badge kind="off">None</Badge>}
                  </div>
                  <div className="muted small">{d.city}</div>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="split-detail">
        {!s ? (
          <Empty>
            <p>No settlement for this show yet.</p>
            <button className="btn primary" onClick={() => mutate((d) => void d.settlements.push(newSettlement(dayId!, venue?.capacity)))}>
              Start settlement
            </button>
          </Empty>
        ) : (
          <div className="stack">
            <section className="card">
              <div className="card-head">
                <h2>
                  {day?.city} {venue && <span className="muted">· {venue.name}</span>}
                </h2>
                <label className="row gap-sm">
                  <input type="checkbox" checked={s.settled} onChange={(e) => set('settled', e.target.checked)} /> Settled & signed
                </label>
              </div>
              <div className="form-grid three">
                <Field label="Deal type">
                  <select value={s.dealType} onChange={(e) => set('dealType', e.target.value as Settlement['dealType'])}>
                    <option value="guarantee">Flat guarantee</option>
                    <option value="versus">Guarantee vs. % of net</option>
                    <option value="door">Door deal (% of net)</option>
                  </select>
                </Field>
                {num('guarantee', 'Guarantee')}
                {num('percentage', 'Artist % (after expenses)')}
                {num('ticketPrice', 'Avg. ticket price', '0.01')}
                {num('ticketsSold', 'Paid tickets')}
                {num('comps', 'Comps')}
                {num('taxesAndFees', 'Taxes & fees')}
                {num('showExpenses', 'Show expenses (venue)')}
                {num('deductions', 'Other deductions / advances')}
                {num('merchGross', 'Merch gross', '0.01')}
                {num('merchVenueCut', 'Merch venue cut %')}
                <Field label="Notes" full>
                  <textarea rows={2} value={s.notes} onChange={(e) => set('notes', e.target.value)} />
                </Field>
              </div>
            </section>
            {c && (
              <section className="card">
                <h3>Settlement summary</h3>
                <table className="table compact">
                  <tbody>
                    <tr>
                      <td>Gross box office</td>
                      <td className="num">{money(c.gross)}</td>
                    </tr>
                    <tr>
                      <td>Net after taxes & fees</td>
                      <td className="num">{money(c.net)}</td>
                    </tr>
                    <tr>
                      <td>Split point (net − show expenses)</td>
                      <td className="num">{money(c.splitPoint)}</td>
                    </tr>
                    <tr>
                      <td>Percentage deal ({s.percentage}%)</td>
                      <td className="num">{money(c.percentageDeal)}</td>
                    </tr>
                    <tr>
                      <td>Artist show payment</td>
                      <td className="num">{money(c.artistShow)}</td>
                    </tr>
                    <tr>
                      <td>Less deductions</td>
                      <td className="num">−{money(s.deductions)}</td>
                    </tr>
                    <tr className="total">
                      <td>Show payout</td>
                      <td className="num">{money(c.payout)}</td>
                    </tr>
                    <tr>
                      <td>Merch net</td>
                      <td className="num">{money(c.merchNet)}</td>
                    </tr>
                    <tr className="total">
                      <td>Total night</td>
                      <td className="num">{money(c.total)}</td>
                    </tr>
                  </tbody>
                </table>
                {venue && s.ticketsSold + s.comps > 0 && (
                  <p className="muted small">
                    Attendance {(s.ticketsSold + s.comps).toLocaleString()} / {venue.capacity.toLocaleString()} ({Math.round(((s.ticketsSold + s.comps) / venue.capacity) * 100)}%)
                  </p>
                )}
                <button className="btn danger ghost" onClick={() => confirm('Delete this settlement?') && mutate((d) => void (d.settlements = d.settlements.filter((x) => x.id !== s.id)))}>
                  Delete settlement
                </button>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
