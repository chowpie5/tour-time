import { useEffect, useRef, useState } from 'react';

export interface ChatMessage {
  id: string;
  user: string;
  text: string;
  channel: string;
  sentAt: string;
}

export type ChatStatus = 'connecting' | 'online' | 'offline';

/** WebSocket client for the tour chat server, with automatic reconnect. */
export function useChat(url: string, room: string, user: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [members, setMembers] = useState<string[]>([]);
  const [status, setStatus] = useState<ChatStatus>('connecting');
  const [typing, setTyping] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let closed = false;
    let retry = 0;
    let timer: ReturnType<typeof setTimeout>;
    let typingTimer: ReturnType<typeof setTimeout>;

    function connect() {
      setStatus('connecting');
      let ws: WebSocket;
      try {
        ws = new WebSocket(url);
      } catch {
        setStatus('offline');
        return;
      }
      wsRef.current = ws;
      ws.onopen = () => {
        retry = 0;
        setStatus('online');
        ws.send(JSON.stringify({ type: 'join', tourId: room, user }));
      };
      ws.onmessage = (e) => {
        const msg = JSON.parse(e.data);
        if (msg.type === 'history') setMessages(msg.messages);
        else if (msg.type === 'message') setMessages((m) => [...m, msg.message]);
        else if (msg.type === 'presence') setMembers(msg.members);
        else if (msg.type === 'typing') {
          setTyping(msg.user);
          clearTimeout(typingTimer);
          typingTimer = setTimeout(() => setTyping(null), 2500);
        }
      };
      ws.onclose = () => {
        if (closed) return;
        setStatus('offline');
        setMembers([]);
        timer = setTimeout(connect, Math.min(15000, 1000 * 2 ** retry++));
      };
    }
    connect();
    return () => {
      closed = true;
      clearTimeout(timer);
      clearTimeout(typingTimer);
      wsRef.current?.close();
    };
  }, [url, room, user]);

  const send = (text: string, channel: string) => {
    const ws = wsRef.current;
    if (ws?.readyState !== WebSocket.OPEN) return false;
    ws.send(JSON.stringify({ type: 'message', text, channel }));
    return true;
  };
  const notifyTyping = () => {
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'typing' }));
  };

  return { messages, members, status, typing, send, notifyTyping };
}
