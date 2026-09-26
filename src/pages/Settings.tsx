import { useRef } from 'react';
import { useData, useMutate, useStore, useActiveTour } from '../store';
import { bridge } from '../lib/bridge';
import { EMPTY_DATA, sampleData } from '../lib/seed';
import type { AppData, Settings } from '../types';
import { Field, PageHeader } from '../components/ui';

export default function SettingsPage() {
  const data = useData();
  const mutate = useMutate();
  const replace = useStore((s) => s.replace);
  const tour = useActiveTour();
  const fileRef = useRef<HTMLInputElement>(null);
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => mutate((d) => void (d.settings[k] = v));
  const isDesktop = !!bridge();

  const exportData = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    a.download = `tour-time-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  };

  return (
    <div className="page">
      <PageHeader title="Settings" />
      <div className="stack narrow">
        <section className="card">
          <h2>You</h2>
          <div className="form-grid">
            <Field label="Display name (shown in chat)">
              <input value={data.settings.userName} onChange={(e) => set('userName', e.target.value)} />
            </Field>
          </div>
        </section>

        <section className="card">
          <h2>Current tour</h2>
          <div className="form-grid">
            <Field label="Tour name">
              <input value={tour.name} onChange={(e) => mutate((d) => void (d.tours.find((t) => t.id === tour.id)!.name = e.target.value))} />
            </Field>
            <Field label="Artist">
              <input value={tour.artist} onChange={(e) => mutate((d) => void (d.tours.find((t) => t.id === tour.id)!.artist = e.target.value))} />
            </Field>
            <Field label="Currency">
              <input value={tour.currency} maxLength={3} onChange={(e) => mutate((d) => void (d.tours.find((t) => t.id === tour.id)!.currency = e.target.value.toUpperCase()))} />
            </Field>
            <Field label="Chat room code (share with your team)">
              <input value={tour.chatRoom || tour.id} onChange={(e) => mutate((d) => void (d.tours.find((t) => t.id === tour.id)!.chatRoom = e.target.value.trim()))} />
            </Field>
          </div>
        </section>

        <section className="card">
          <h2>Chat server</h2>
          <p className="muted small">
            Everyone on the tour connects to the same chat server and room code. One laptop can host it (e.g. the TM's, on the bus Wi-Fi), or deploy <code>npm run chat-server</code> on a
            cloud host so the team can chat from anywhere.
          </p>
          <div className="form-grid">
            <Field label="Server URL">
              <input value={data.settings.chatServerUrl} onChange={(e) => set('chatServerUrl', e.target.value)} placeholder="ws://192.168.1.20:4455" />
            </Field>
            <Field label="Host port">
              <input type="number" value={data.settings.chatPort} onChange={(e) => set('chatPort', Number(e.target.value))} />
            </Field>
            <label className="row gap-sm full">
              <input type="checkbox" checked={data.settings.hostChat} disabled={!isDesktop} onChange={(e) => set('hostChat', e.target.checked)} />
              Host a chat server on this computer {!isDesktop && <span className="muted small">(desktop app only)</span>}
            </label>
          </div>
        </section>

        <section className="card">
          <h2>Data</h2>
          <p className="muted small">{isDesktop ? 'Data is saved automatically to your user data folder.' : 'Running in a browser — data is saved to this browser only.'}</p>
          <div className="row gap-sm">
            <button className="btn" onClick={exportData}>
              Export backup
            </button>
            <button className="btn" onClick={() => fileRef.current?.click()}>
              Import backup
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json"
              hidden
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                try {
                  const parsed = JSON.parse(await f.text()) as AppData;
                  if (!Array.isArray(parsed.tours)) throw new Error('Not a Tour Time backup');
                  replace({ ...EMPTY_DATA(), ...parsed });
                } catch (err) {
                  alert(`Import failed: ${(err as Error).message}`);
                }
              }}
            />
            <button className="btn ghost" onClick={() => confirm('Replace all data with the sample tour?') && replace(sampleData())}>
              Load sample tour
            </button>
            <button className="btn danger ghost" onClick={() => confirm('Erase ALL data? This cannot be undone.') && replace({ ...EMPTY_DATA(), settings: data.settings })}>
              Erase all
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
