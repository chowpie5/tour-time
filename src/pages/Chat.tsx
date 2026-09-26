import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useData, useActiveTour } from '../store';
import { useChat } from '../lib/useChat';
import { PageHeader } from '../components/ui';

const CHANNELS = ['general', 'production', 'travel', 'band', 'merch'];

export default function Chat() {
  const data = useData();
  const tour = useActiveTour();
  const { chatServerUrl, userName } = data.settings;
  const room = tour.chatRoom || tour.id;
  const { messages, members, status, typing, send, notifyTyping } = useChat(chatServerUrl, room, userName);
  const [channel, setChannel] = useState('general');
  const [draft, setDraft] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const visible = messages.filter((m) => (m.channel || 'general') === channel);
  const lastTyped = useRef(0);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [visible.length, channel]);

  const submit = () => {
    if (draft.trim() && send(draft, channel)) setDraft('');
  };

  return (
    <div className="page chat-page">
      <PageHeader
        title="Tour Chat"
        subtitle={
          <>
            Room <code>{room}</code> ·{' '}
            <span className={`status status-${status}`}>{status === 'online' ? 'Connected' : status === 'connecting' ? 'Connecting…' : 'Offline — retrying'}</span> · <Link to="/settings">Chat settings</Link>
          </>
        }
      />
      <div className="chat">
        <aside className="chat-side">
          <h4>Channels</h4>
          {CHANNELS.map((c) => {
            const count = messages.filter((m) => (m.channel || 'general') === c).length;
            return (
              <button key={c} className={c === channel ? 'chan active' : 'chan'} onClick={() => setChannel(c)}>
                # {c} {count > 0 && <span className="muted small">{count}</span>}
              </button>
            );
          })}
          <h4>Online ({members.length})</h4>
          <ul className="plain small">
            {[...new Set(members)].map((m) => (
              <li key={m}>
                <span className="dot" /> {m}
              </li>
            ))}
          </ul>
        </aside>
        <section className="chat-main">
          <div className="chat-messages" ref={listRef}>
            {visible.length === 0 && <div className="empty">No messages in #{channel} yet.</div>}
            {visible.map((m, i) => {
              const prev = visible[i - 1];
              const grouped = prev && prev.user === m.user && new Date(m.sentAt).getTime() - new Date(prev.sentAt).getTime() < 5 * 60 * 1000;
              const mine = m.user === userName;
              return (
                <div key={m.id} className={mine ? 'msg mine' : 'msg'}>
                  {!grouped && (
                    <div className="msg-head">
                      <strong>{m.user}</strong>
                      <span className="muted small">{new Date(m.sentAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
                    </div>
                  )}
                  <div className="msg-body">{m.text}</div>
                </div>
              );
            })}
          </div>
          <div className="typing muted small">{typing ? `${typing} is typing…` : ' '}</div>
          <form
            className="chat-input"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <textarea
              rows={2}
              value={draft}
              placeholder={status === 'online' ? `Message #${channel}` : 'Waiting for chat server…'}
              onChange={(e) => {
                setDraft(e.target.value);
                if (Date.now() - lastTyped.current > 1500) {
                  lastTyped.current = Date.now();
                  notifyTyping();
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
            />
            <button className="btn primary" type="submit" disabled={status !== 'online' || !draft.trim()}>
              Send
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
