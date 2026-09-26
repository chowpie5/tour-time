import { useRef, useState } from 'react';
import { useData, useMutate, useActiveTour } from '../store';
import { useTourDays } from '../lib/hooks';
import type { DocCategory, TourDocument } from '../types';
import { bridge } from '../lib/bridge';
import { formatBytes, formatDate, uid } from '../lib/format';
import { Empty, PageHeader } from '../components/ui';
import Report, { REPORT_SECTIONS, type ReportSection } from '../components/Report';

const DOC_CATEGORIES: DocCategory[] = ['contract', 'rider', 'stage plot', 'input list', 'insurance', 'visa/immigration', 'other'];
const BROWSER_MAX_BYTES = 4 * 1024 * 1024;

export default function Documents() {
  const [tab, setTab] = useState<'files' | 'reports'>('files');
  return (
    <div className="page">
      <PageHeader
        title="Documents & Reports"
        subtitle="Contracts, riders and files — plus printable day sheets and itineraries."
        actions={
          <div className="tabs">
            <button className={tab === 'files' ? 'tab active' : 'tab'} onClick={() => setTab('files')}>
              Files
            </button>
            <button className={tab === 'reports' ? 'tab active' : 'tab'} onClick={() => setTab('reports')}>
              Reports
            </button>
          </div>
        }
      />
      {tab === 'files' ? <Files /> : <Reports />}
    </div>
  );
}

function guessCategory(name: string): DocCategory {
  const n = name.toLowerCase();
  if (n.includes('contract') || n.includes('agreement')) return 'contract';
  if (n.includes('rider') || n.includes('hospitality')) return 'rider';
  if (n.includes('plot')) return 'stage plot';
  if (n.includes('input')) return 'input list';
  if (n.includes('insur') || n.includes('coi')) return 'insurance';
  if (n.includes('visa') || n.includes('passport')) return 'visa/immigration';
  return 'other';
}

function Files() {
  const data = useData();
  const mutate = useMutate();
  const tour = useActiveTour();
  const days = useTourDays();
  const [category, setCategory] = useState<DocCategory | ''>('');
  const inputRef = useRef<HTMLInputElement>(null);
  const docs = data.documents.filter((d) => d.tourId === tour.id && (!category || d.category === category)).sort((a, b) => b.addedAt.localeCompare(a.addedAt));

  const add = (items: Omit<TourDocument, 'id' | 'tourId' | 'addedAt' | 'category'>[]) =>
    mutate((d) => {
      for (const it of items) d.documents.push({ id: uid(), tourId: tour.id, addedAt: new Date().toISOString(), category: guessCategory(it.name), ...it });
    });

  async function upload() {
    const b = bridge();
    if (b) {
      const files = await b.importDocuments();
      add(files.map((f) => ({ name: f.originalName, storedName: f.storedName, size: f.size })));
    } else inputRef.current?.click();
  }

  async function onBrowserFiles(files: FileList | null) {
    if (!files) return;
    const items = [];
    for (const f of Array.from(files)) {
      if (f.size > BROWSER_MAX_BYTES) {
        alert(`${f.name} is too large for browser storage. Use the desktop app for large files.`);
        continue;
      }
      const dataUrl = await new Promise<string>((res) => {
        const r = new FileReader();
        r.onload = () => res(r.result as string);
        r.readAsDataURL(f);
      });
      items.push({ name: f.name, size: f.size, dataUrl });
    }
    add(items);
  }

  function open(doc: TourDocument) {
    if (doc.storedName) bridge()?.openDocument(doc.storedName);
    else if (doc.dataUrl) {
      const a = document.createElement('a');
      a.href = doc.dataUrl;
      a.download = doc.name;
      a.click();
    }
  }

  const update = (id: string, patch: Partial<TourDocument>) =>
    mutate((d) => {
      const doc = d.documents.find((x) => x.id === id);
      if (doc) Object.assign(doc, patch);
    });

  return (
    <section className="card">
      <div className="toolbar">
        <select value={category} onChange={(e) => setCategory(e.target.value as DocCategory | '')} aria-label="Category filter">
          <option value="">All documents</option>
          {DOC_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <div className="spacer" />
        <input ref={inputRef} type="file" multiple hidden onChange={(e) => onBrowserFiles(e.target.files)} data-testid="file-input" />
        <button className="btn primary" onClick={upload}>
          + Upload files
        </button>
      </div>
      {docs.length === 0 ? (
        <Empty>No documents yet. Upload contracts, riders, stage plots and more.</Empty>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Category</th>
              <th>Linked day</th>
              <th>Size</th>
              <th>Added</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {docs.map((doc) => (
              <tr key={doc.id}>
                <td>
                  <button className="link-btn" onClick={() => open(doc)}>
                    {doc.name}
                  </button>
                </td>
                <td>
                  <select aria-label="Document category" value={doc.category} onChange={(e) => update(doc.id, { category: e.target.value as DocCategory })}>
                    {DOC_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <select aria-label="Linked day" value={doc.dayId ?? ''} onChange={(e) => update(doc.id, { dayId: e.target.value || undefined })}>
                    <option value="">Whole tour</option>
                    {days.map((d) => (
                      <option key={d.id} value={d.id}>
                        {formatDate(d.date)} — {d.city}
                      </option>
                    ))}
                  </select>
                </td>
                <td>{formatBytes(doc.size)}</td>
                <td>{new Date(doc.addedAt).toLocaleDateString()}</td>
                <td className="row gap-sm">
                  {doc.storedName && (
                    <button className="btn ghost small" onClick={() => bridge()?.revealDocument(doc.storedName!)}>
                      Show in folder
                    </button>
                  )}
                  <button
                    className="icon-btn"
                    aria-label={`Delete ${doc.name}`}
                    onClick={() => {
                      if (!confirm(`Delete ${doc.name}?`)) return;
                      if (doc.storedName) bridge()?.deleteDocument(doc.storedName);
                      mutate((d) => void (d.documents = d.documents.filter((x) => x.id !== doc.id)));
                    }}
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function Reports() {
  const days = useTourDays();
  const tour = useActiveTour();
  const [kind, setKind] = useState<'daysheet' | 'itinerary'>('daysheet');
  const [dayId, setDayId] = useState(days[0]?.id ?? '');
  const [sections, setSections] = useState<ReportSection[]>(REPORT_SECTIONS.map((s) => s.key));
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const day = days.find((d) => d.id === dayId) ?? days[0];

  const toggle = (k: ReportSection) => setSections((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]));

  async function savePdf() {
    const name = kind === 'daysheet' && day ? `${tour.name} - Day sheet ${day.date}.pdf` : `${tour.name} - Itinerary.pdf`;
    const b = bridge();
    if (b) await b.saveReportPdf(name);
    else window.print();
  }

  return (
    <div className="split report-layout">
      <div className="split-list no-print">
        <section className="card stack">
          <label className="field">
            <span>Report type</span>
            <select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
              <option value="daysheet">Daily day sheet</option>
              <option value="itinerary">Full tour itinerary</option>
            </select>
          </label>
          {kind === 'daysheet' && (
            <label className="field">
              <span>Day</span>
              <select value={day?.id} onChange={(e) => setDayId(e.target.value)}>
                {days.map((d) => (
                  <option key={d.id} value={d.id}>
                    {formatDate(d.date)} — {d.city}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="field">
            <span>Custom title</span>
            <input value={title} placeholder={kind === 'daysheet' ? 'Day Sheet' : 'Tour Itinerary'} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <fieldset className="checks">
            <legend>Include sections</legend>
            {REPORT_SECTIONS.map((s) => (
              <label key={s.key}>
                <input type="checkbox" checked={sections.includes(s.key)} onChange={() => toggle(s.key)} /> {s.label}
              </label>
            ))}
          </fieldset>
          <label className="field">
            <span>Note for the team</span>
            <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Quiet bus after 2am" />
          </label>
          <div className="row gap-sm">
            <button className="btn primary" onClick={() => (bridge() ? bridge()!.printReport() : window.print())}>
              Print
            </button>
            <button className="btn" onClick={savePdf}>
              Save PDF
            </button>
          </div>
        </section>
      </div>
      <div className="split-detail">
        {days.length === 0 ? (
          <Empty>Add dates to generate reports.</Empty>
        ) : (
          <div className="report-preview">
            <Report kind={kind} day={day} days={days} sections={sections} title={title} note={note} />
          </div>
        )}
      </div>
    </div>
  );
}
