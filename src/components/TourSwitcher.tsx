import { useState } from 'react';
import { useData, useMutate, useActiveTour } from '../store';
import { uid } from '../lib/format';
import { Field, Modal } from './ui';

export default function TourSwitcher() {
  const data = useData();
  const mutate = useMutate();
  const tour = useActiveTour();
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', artist: '', currency: 'USD' });

  function create() {
    if (!form.name.trim()) return;
    const id = uid();
    mutate((d) => {
      d.tours.push({ id, name: form.name.trim(), artist: form.artist.trim(), currency: form.currency || 'USD', budget: {} });
      d.activeTourId = id;
    });
    setCreating(false);
    setForm({ name: '', artist: '', currency: 'USD' });
  }

  return (
    <div className="tour-switcher">
      <label className="muted small" htmlFor="tour-select">
        Active tour
      </label>
      <select
        id="tour-select"
        value={tour?.id ?? ''}
        onChange={(e) => {
          if (e.target.value === '__new') setCreating(true);
          else mutate((d) => void (d.activeTourId = e.target.value));
        }}
      >
        {data.tours.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
        <option value="__new">+ New tour…</option>
      </select>
      {tour && <div className="muted small">{tour.artist}</div>}
      {creating && (
        <Modal
          title="New tour"
          onClose={() => setCreating(false)}
          footer={
            <button className="btn primary" onClick={create}>
              Create tour
            </button>
          }
        >
          <div className="form-grid">
            <Field label="Tour name" full>
              <input autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="Artist">
              <input value={form.artist} onChange={(e) => setForm({ ...form, artist: e.target.value })} />
            </Field>
            <Field label="Currency">
              <input value={form.currency} maxLength={3} onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })} />
            </Field>
          </div>
        </Modal>
      )}
    </div>
  );
}
