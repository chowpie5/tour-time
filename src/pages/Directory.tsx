import { useMemo, useState } from 'react';
import { useData, useMutate } from '../store';
import type { Contact, ContactCategory, Venue } from '../types';
import { formatDate, uid } from '../lib/format';
import { Badge, Empty, Field, Modal, PageHeader } from '../components/ui';

const CATEGORIES: ContactCategory[] = ['venue', 'promoter', 'crew', 'production', 'band', 'vendor', 'other'];

function downloadCsv(name: string, rows: string[][]) {
  const csv = rows.map((r) => r.map((c) => `"${(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

export default function Directory() {
  const [tab, setTab] = useState<'people' | 'venues'>('people');
  return (
    <div className="page">
      <PageHeader
        title="Directory & Contacts"
        subtitle="Venues, promoters, crew and production staff in one place."
        actions={
          <div className="tabs">
            <button className={tab === 'people' ? 'tab active' : 'tab'} onClick={() => setTab('people')}>
              People
            </button>
            <button className={tab === 'venues' ? 'tab active' : 'tab'} onClick={() => setTab('venues')}>
              Venues
            </button>
          </div>
        }
      />
      {tab === 'people' ? <People /> : <Venues />}
    </div>
  );
}

function People() {
  const data = useData();
  const mutate = useMutate();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<ContactCategory | 'all'>('all');
  const [editing, setEditing] = useState<Contact | null>(null);

  const list = useMemo(() => {
    const q = query.toLowerCase();
    return data.contacts
      .filter((c) => category === 'all' || c.category === category)
      .filter((c) => !q || [c.name, c.role, c.company, c.email, c.phone].some((v) => v.toLowerCase().includes(q)))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [data.contacts, query, category]);

  return (
    <section className="card">
      <div className="toolbar">
        <input type="search" placeholder="Search name, role, company, email…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <select value={category} onChange={(e) => setCategory(e.target.value as ContactCategory | 'all')} aria-label="Category filter">
          <option value="all">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c} className="capitalize">
              {c}
            </option>
          ))}
        </select>
        <div className="spacer" />
        <button className="btn ghost" onClick={() => downloadCsv('contacts.csv', [['Name', 'Role', 'Category', 'Company', 'Email', 'Phone', 'Notes'], ...list.map((c) => [c.name, c.role, c.category, c.company, c.email, c.phone, c.notes])])}>
          Export CSV
        </button>
        <button className="btn primary" onClick={() => setEditing({ id: uid(), name: '', role: '', category: 'crew', company: '', email: '', phone: '', notes: '' })}>
          + Add contact
        </button>
      </div>
      {list.length === 0 ? (
        <Empty>No contacts match.</Empty>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Role</th>
              <th>Category</th>
              <th>Company / venue</th>
              <th>Email</th>
              <th>Phone</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {list.map((c) => (
              <tr key={c.id}>
                <td>
                  <strong>{c.name}</strong>
                </td>
                <td>{c.role}</td>
                <td>
                  <Badge kind={c.category}>{c.category}</Badge>
                </td>
                <td>{c.venueId ? data.venues.find((v) => v.id === c.venueId)?.name : c.company}</td>
                <td>{c.email && <a href={`mailto:${c.email}`}>{c.email}</a>}</td>
                <td>{c.phone && <a href={`tel:${c.phone}`}>{c.phone}</a>}</td>
                <td className="row gap-sm">
                  <button className="btn ghost small" onClick={() => setEditing(c)}>
                    Edit
                  </button>
                  <button
                    className="icon-btn"
                    aria-label={`Delete ${c.name}`}
                    onClick={() => confirm(`Delete ${c.name}?`) && mutate((d) => void (d.contacts = d.contacts.filter((x) => x.id !== c.id)))}
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {editing && (
        <ContactModal
          contact={editing}
          venues={data.venues}
          onClose={() => setEditing(null)}
          onSave={(c) => {
            mutate((d) => {
              const i = d.contacts.findIndex((x) => x.id === c.id);
              if (i >= 0) d.contacts[i] = c;
              else d.contacts.push(c);
            });
            setEditing(null);
          }}
        />
      )}
    </section>
  );
}

function ContactModal({ contact, venues, onClose, onSave }: { contact: Contact; venues: Venue[]; onClose: () => void; onSave: (c: Contact) => void }) {
  const [f, setF] = useState(contact);
  const text = (key: 'name' | 'role' | 'company' | 'email' | 'phone', label: string, type = 'text') => (
    <Field label={label}>
      <input type={type} value={f[key]} onChange={(e) => setF({ ...f, [key]: e.target.value })} />
    </Field>
  );
  return (
    <Modal title={contact.name ? `Edit ${contact.name}` : 'New contact'} onClose={onClose} footer={<button className="btn primary" disabled={!f.name.trim()} onClick={() => onSave(f)}>Save</button>}>
      <div className="form-grid">
        {text('name', 'Name')}
        {text('role', 'Role / title')}
        <Field label="Category">
          <select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value as ContactCategory })}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>
        {text('company', 'Company')}
        {text('email', 'Email', 'email')}
        {text('phone', 'Phone', 'tel')}
        <Field label="Linked venue">
          <select value={f.venueId ?? ''} onChange={(e) => setF({ ...f, venueId: e.target.value || undefined })}>
            <option value="">None</option>
            {venues.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Notes" full>
          <textarea rows={3} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
        </Field>
      </div>
    </Modal>
  );
}

function Venues() {
  const data = useData();
  const mutate = useMutate();
  const [editing, setEditing] = useState<Venue | null>(null);
  const venues = [...data.venues].sort((a, b) => a.name.localeCompare(b.name));
  return (
    <>
      <div className="toolbar">
        <div className="spacer" />
        <button className="btn primary" onClick={() => setEditing({ id: uid(), name: '', address: '', city: '', capacity: 0, notes: '' })}>
          + Add venue
        </button>
      </div>
      {venues.length === 0 && <Empty>No venues yet.</Empty>}
      <div className="card-grid">
        {venues.map((v) => {
          const people = data.contacts.filter((c) => c.venueId === v.id);
          const dates = data.days.filter((d) => d.venueId === v.id);
          return (
            <section className="card" key={v.id}>
              <div className="card-head">
                <h3>{v.name}</h3>
                <div className="row gap-sm">
                  <button className="btn ghost small" onClick={() => setEditing(v)}>
                    Edit
                  </button>
                  <button className="icon-btn" aria-label={`Delete ${v.name}`} onClick={() => confirm(`Delete ${v.name}?`) && mutate((d) => void (d.venues = d.venues.filter((x) => x.id !== v.id)))}>
                    ×
                  </button>
                </div>
              </div>
              <p className="muted small">
                {v.address}, {v.city} · Cap. {v.capacity.toLocaleString()}
              </p>
              {v.notes && <p className="small">{v.notes}</p>}
              <h4>Contacts</h4>
              {people.length ? (
                <ul className="plain small">
                  {people.map((c) => (
                    <li key={c.id}>
                      {c.name} — {c.role} · {c.phone}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted small">None linked.</p>
              )}
              {dates.length > 0 && <p className="muted small">Dates: {dates.map((d) => formatDate(d.date)).join(', ')}</p>}
            </section>
          );
        })}
      </div>
      {editing && (
        <VenueModal
          venue={editing}
          onClose={() => setEditing(null)}
          onSave={(v) => {
            mutate((d) => {
              const i = d.venues.findIndex((x) => x.id === v.id);
              if (i >= 0) d.venues[i] = v;
              else d.venues.push(v);
            });
            setEditing(null);
          }}
        />
      )}
    </>
  );
}

function VenueModal({ venue, onClose, onSave }: { venue: Venue; onClose: () => void; onSave: (v: Venue) => void }) {
  const [f, setF] = useState(venue);
  return (
    <Modal title={venue.name ? `Edit ${venue.name}` : 'New venue'} onClose={onClose} footer={<button className="btn primary" disabled={!f.name.trim()} onClick={() => onSave(f)}>Save</button>}>
      <div className="form-grid">
        <Field label="Name">
          <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </Field>
        <Field label="City">
          <input value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} />
        </Field>
        <Field label="Address">
          <input value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} />
        </Field>
        <Field label="Capacity">
          <input type="number" value={f.capacity} onChange={(e) => setF({ ...f, capacity: Number(e.target.value) })} />
        </Field>
        <Field label="Notes" full>
          <textarea rows={3} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
        </Field>
      </div>
    </Modal>
  );
}
