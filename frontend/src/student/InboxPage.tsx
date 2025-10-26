import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

type Message = {
  id: string;
  from: string;
  to?: string;
  subject: string;
  body: string;
  time: string;
  unread: boolean;
};

const SAMPLE_MESSAGES: Message[] = [
  {
    id: 'm1',
    from: 'Professor Ada',
    subject: 'Welcome to CS101',
    body: 'Please review the syllabus and join the first lecture on Monday at 10am. Office hours are Wednesdays.',
    time: '2 days ago',
    unread: true,
  },
  {
    id: 'm2',
    from: 'Course Admin',
    subject: 'Assignment 1 posted',
    body: 'Assignment 1 is available in the course portal. Due next Friday at 11:59pm. Make sure to read the rubric.',
    time: '4 days ago',
    unread: false,
  },
  {
    id: 'm3',
    from: 'Registrar',
    subject: 'Schedule updated',
    body: 'Your course timetable has a small change for Wednesday. Please check the updated schedule in your dashboard.',
    time: '1 week ago',
    unread: false,
  },
];

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

  // load from localStorage or seed
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        setMessages(JSON.parse(raw));
        return;
      }
    } catch (e) {
      // ignore parse errors
    }
    setMessages(SAMPLE_MESSAGES);
  }, []);

  // persist
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch (e) {
      // ignore
    }
  }, [messages]);

  const selected = useMemo(() => messages.find((m) => m.id === selectedId) ?? null, [messages, selectedId]);

  function openMessage(id: string) {
    setSelectedId(id);
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, unread: false } : m)));
  }

  function toggleRead(id: string) {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, unread: !m.unread } : m)));
  }

  function deleteMessage(id: string) {
    setMessages((prev) => prev.filter((m) => m.id !== id));
    if (selectedId === id) setSelectedId(null);
  }

  function sendMessage() {
    if (!composeSubject && !composeBody) return;
    const msg: Message = {
      id: `m_${Date.now()}`,
      from: 'You',
      to: composeTo || 'Instructor',
      subject: composeSubject || '(no subject)',
      body: composeBody,
      time: 'just now',
      unread: false,
    };
    setMessages((prev) => [msg, ...prev]);
    setIsComposeOpen(false);
    setComposeTo('');
    setComposeSubject('');
    setComposeBody('');
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

      <div className="bg-white shadow rounded-md overflow-hidden grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* list */}
        <aside className="md:col-span-1 border-r">
          <div className="p-3 border-b flex items-center justify-between">
            <strong>Messages</strong>
            <button
              title="Mark all read"
              onClick={() => setMessages((prev) => prev.map((m) => ({ ...m, unread: false })))}
              className="text-xs text-slate-500 hover:underline"
            >
              Mark all read
            </button>
          </div>
          <div className="h-[60vh] overflow-auto">
            {messages.length === 0 ? (
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
                      <div className="text-xs text-slate-500">{m.time}</div>
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
              <input value={composeTo} onChange={(e) => setComposeTo(e.target.value)} placeholder="To" className="w-full border px-2 py-1 rounded" />
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
