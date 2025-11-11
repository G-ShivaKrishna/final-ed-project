import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase'; // added supabase

// ...existing smaller types...
type Message = {
  id: string;
  sender_id?: string;
  recipient_id?: string;
  sender_email?: string;
  recipient_email?: string;
  from: string;
  to?: string;
  subject: string;
  body: string;
  time?: string;
  created_at?: string;
  unread?: boolean;
};

const STORAGE_KEY = 'inbox_messages_v1';

export default function InboxPage(): JSX.Element {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [composeTo, setComposeTo] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const composeRef = useRef<HTMLTextAreaElement | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // helper to normalize rows from supabase
  function normalizeRow(r: any): Message {
    const fromEmail = r.sender?.email ?? r.sender_email ?? '';
    const toEmail = r.recipient?.email ?? r.recipient_email ?? '';
    return {
      id: r.id,
      sender_id: r.sender_id ?? r.sender?.id,
      recipient_id: r.recipient_id ?? r.recipient?.id,
      sender_email: fromEmail,
      recipient_email: toEmail,
      from: fromEmail || (r.from || 'Unknown'),
      to: toEmail || (r.to || ''),
      subject: r.subject || '',
      body: r.body || '',
      created_at: r.created_at,
      time: r.created_at ? new Date(r.created_at).toLocaleString() : r.time || '',
      unread: !!r.read ? false : !!r.unread,
    };
  }

  // Primary loader: try Supabase, fallback to localStorage if table missing or network error
  async function loadMessages() {
    setLoading(true);
    setError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData?.session?.user?.id;
      const userEmail = sessionData?.session?.user?.email ?? '';

      if (!userId) {
        // fallback to localStorage seed
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          setMessages(JSON.parse(raw));
        } else {
          setMessages([]);
        }
        setLoading(false);
        return;
      }

      // fetch messages where the user is sender or recipient (do NOT embed related users here;
      // embedding fails when more than one FK relationship to users exists)
      const { data: msgRows, error: msgErr } = await supabase
        .from('messages')
        .select('id, sender_id, recipient_id, subject, body, created_at, read')
        .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
        .order('created_at', { ascending: false });

      if (msgErr) {
        console.warn('Supabase messages query failed, falling back to localStorage', msgErr);
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) setMessages(JSON.parse(raw));
        else setMessages([]);
        setLoading(false);
        return;
      }

      const rows = msgRows || [];
      // collect user ids referenced by these messages
      const uidSet = new Set<string>();
      rows.forEach((r: any) => {
        if (r.sender_id) uidSet.add(r.sender_id);
        if (r.recipient_id) uidSet.add(r.recipient_id);
      });

      // fetch user info for all referenced ids in a single query
      const usersMap: Record<string, any> = {};
      if (uidSet.size > 0) {
        const { data: users, error: usersErr } = await supabase
          .from('users')
          .select('id, username, email')
          .in('id', Array.from(uidSet));
        if (!usersErr && Array.isArray(users)) {
          users.forEach((u: any) => { usersMap[u.id] = u; });
        }
      }

      // attach user objects to each message row and normalize
      const mapped = rows.map((r: any) => {
        r.sender = usersMap[r.sender_id] ?? null;
        r.recipient = usersMap[r.recipient_id] ?? null;
        return normalizeRow(r);
      });
      setMessages(mapped);
    } catch (err: any) {
      console.error('loadMessages error', err);
      // fallback to local storage
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) setMessages(JSON.parse(raw));
        else setMessages([]);
      } catch (_e) {
        setMessages([]);
      }
    } finally {
      setLoading(false);
    }
  }

  // Polling to refresh messages (simple, reliable fallback for realtime)
  useEffect(() => {
    loadMessages();
    const interval = setInterval(loadMessages, 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // persist to localStorage as a fallback cache
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch (e) {
      // ignore
    }
  }, [messages]);

  const selected = useMemo(() => messages.find((m) => m.id === selectedId) ?? null, [messages, selectedId]);

  async function openMessage(id: string) {
    setSelectedId(id);
    // mark read in DB if present
    const msg = messages.find((m) => m.id === id);
    if (!msg) return;
    if (msg.unread) {
      try {
        const { error } = await supabase.from('messages').update({ read: true }).eq('id', id);
        if (!error) {
          setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, unread: false } : m)));
        }
      } catch (_e) {
        // ignore fail
        setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, unread: false } : m)));
      }
    }
  }

  async function toggleRead(id: string) {
    const msg = messages.find((m) => m.id === id);
    if (!msg) return;
    const newRead = !msg.unread;
    try {
      const { error } = await supabase.from('messages').update({ read: !newRead ? true : false }).eq('id', id);
      if (error) throw error;
      setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, unread: !newRead } : m)));
      // note: read field semantics vary; we try to keep unread boolean in local state
    } catch (err) {
      // fallback toggle locally
      setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, unread: !m.unread } : m)));
    }
  }

  async function deleteMessage(id: string) {
    try {
      const { error } = await supabase.from('messages').delete().eq('id', id);
      if (error) throw error;
      setMessages((prev) => prev.filter((m) => m.id !== id));
      if (selectedId === id) setSelectedId(null);
    } catch (err) {
      // fallback to local removal
      setMessages((prev) => prev.filter((m) => m.id !== id));
      if (selectedId === id) setSelectedId(null);
    }
  }

  async function sendMessage() {
    setError(null);
    if (!composeSubject && !composeBody) return;
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const senderId = sessionData?.session?.user?.id;
      const senderEmail = sessionData?.session?.user?.email ?? 'You';
      if (!senderId) throw new Error('Not authenticated');

      // lookup recipient by email
      let recipientId: string | null = null;
      let recipientEmail = composeTo.trim();
      if (recipientEmail) {
        const { data: uRows, error: ue } = await supabase.from('users').select('id, email').eq('email', recipientEmail);
        if (ue || !uRows || uRows.length === 0) {
          throw new Error('Recipient not found in system. Use a valid user email.');
        }
        recipientId = uRows[0].id;
        recipientEmail = uRows[0].email;
      } else {
        throw new Error('Please enter a recipient email.');
      }

      // insert message (don't attempt to embed related users in the insert result)
      const insert = {
        sender_id: senderId,
        recipient_id: recipientId,
        subject: composeSubject,
        body: composeBody,
        read: false,
      };

      const { data: insData, error: insErr } = await supabase.from('messages').insert(insert).select('id, created_at, sender_id, recipient_id, subject, body, read').single();
      if (insErr || !insData) throw insErr || new Error('Failed to insert message');

      // fetch sender/recipient user rows to attach
      const userIds = [insData.sender_id, insData.recipient_id].filter(Boolean);
      const { data: users, error: usersErr } = await supabase.from('users').select('id, username, email').in('id', userIds);
      const usersMap: Record<string, any> = {};
      if (!usersErr && Array.isArray(users)) users.forEach((u: any) => usersMap[u.id] = u);

      const dataRow = {
        ...insData,
        sender: usersMap[insData.sender_id] ?? null,
        recipient: usersMap[insData.recipient_id] ?? null,
      };
      const newMsg = normalizeRow(dataRow);

      // Prepend to local list
      setMessages((prev) => [newMsg, ...prev]);
      setIsComposeOpen(false);
      setComposeTo('');
      setComposeSubject('');
      setComposeBody('');
      setSelectedId(newMsg.id);
    } catch (err: any) {
      setError(err?.message || String(err));
    }
  }

  useEffect(() => {
    if (isComposeOpen) composeRef.current?.focus();
  }, [isComposeOpen]);

  const unreadCount = messages.filter((m) => m.unread).length;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <header className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 rounded-md bg-slate-100 hover:bg-slate-200">Back</button>
          <h1 className="text-2xl font-semibold">Inbox</h1>
          <span className="text-sm text-slate-500">{unreadCount} unread</span>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setIsComposeOpen(true)} className="px-3 py-2 bg-indigo-600 text-white rounded-md">Compose</button>
        </div>
      </header>

      {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded">{error}</div>}

      <div className="bg-white shadow rounded-md overflow-hidden grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* list */}
        <aside className="md:col-span-1 border-r">
          <div className="p-3 border-b flex items-center justify-between">
            <strong>Messages</strong>
            <button
              title="Mark all read"
              onClick={() => {
                // try to mark all read remotely
                (async () => {
                  try {
                    const ids = messages.filter((m) => m.unread).map((m) => m.id);
                    if (ids.length) {
                      await supabase.from('messages').update({ read: true }).in('id', ids);
                    }
                    setMessages((prev) => prev.map((m) => ({ ...m, unread: false })));
                  } catch {
                    setMessages((prev) => prev.map((m) => ({ ...m, unread: false })));
                  }
                })();
              }}
              className="text-xs text-slate-500 hover:underline"
            >
              Mark all read
            </button>
          </div>

          <div className="h-[60vh] overflow-auto">
            {loading ? (
              <div className="p-4 text-sm text-slate-500">Loading messages…</div>
            ) : messages.length === 0 ? (
              <div className="p-4 text-sm text-slate-500">No messages</div>
            ) : (
              messages.map((m) => (
                <div
                  key={m.id}
                  onClick={() => openMessage(m.id)}
                  className={`p-3 flex items-start gap-3 cursor-pointer hover:bg-slate-50 ${selectedId === m.id ? 'bg-slate-100' : ''}`}
                >
                  <div className="flex-shrink-0 w-3">
                    {m.unread ? <span className="inline-block w-3 h-3 bg-indigo-600 rounded-full" /> : <span className="inline-block w-3 h-3 bg-transparent" />}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-medium">{m.from}</div>
                      <div className="text-xs text-slate-500">{m.time ?? (m.created_at ? new Date(m.created_at).toLocaleString() : '')}</div>
                    </div>
                    <div className="text-sm text-slate-700 font-semibold truncate">{m.subject}</div>
                    <div className="text-xs text-slate-500 truncate">{m.body}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </aside>

        {/* detail */}
        <main className="md:col-span-2 p-4">
          {!selected ? (
            <div className="h-[60vh] flex items-center justify-center text-slate-400">Select a message to read</div>
          ) : (
            <article>
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-sm text-slate-500">From: {selected.from}</div>
                  <h2 className="text-xl font-semibold mt-1">{selected.subject}</h2>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => toggleRead(selected.id)} className="px-2 py-1 border rounded">{selected.unread ? 'Mark read' : 'Mark unread'}</button>
                  <button onClick={() => deleteMessage(selected.id)} className="px-2 py-1 border rounded text-red-600">Delete</button>
                </div>
              </div>

              <div className="mt-4 text-sm text-slate-700 whitespace-pre-line">{selected.body}</div>
            </article>
          )}
        </main>
      </div>

      {/* compose modal */}
      {isComposeOpen && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-md shadow max-w-2xl w-full p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-medium">Compose Message</h3>
              <button onClick={() => setIsComposeOpen(false)} className="text-slate-500">Close</button>
            </div>
            <div className="space-y-2">
              <input value={composeTo} onChange={(e) => setComposeTo(e.target.value)} placeholder="Recipient email" className="w-full border px-2 py-1 rounded" />
              <input value={composeSubject} onChange={(e) => setComposeSubject(e.target.value)} placeholder="Subject" className="w-full border px-2 py-1 rounded" />
              <textarea ref={composeRef} value={composeBody} onChange={(e) => setComposeBody(e.target.value)} placeholder="Write your message..." className="w-full border px-2 py-2 rounded h-40" />
            </div>
            <div className="mt-3 flex items-center justify-end gap-2">
              <button onClick={() => setIsComposeOpen(false)} className="px-3 py-1 border rounded">Cancel</button>
              <button onClick={sendMessage} className="px-3 py-1 bg-indigo-600 text-white rounded">Send</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
