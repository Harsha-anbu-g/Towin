import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/axios';

export default function Messages() {
  const { connectionId } = useParams();
  const navigate = useNavigate();
  const myUserId = localStorage.getItem('userId');

  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [otherName, setOtherName] = useState('');
  const bottomRef = useRef(null);

  useEffect(() => {
    api.get('/connections').then(r => {
      const conn = r.data.find(c => c.id === connectionId);
      if (conn) setOtherName(conn.otherUserName || 'User');
    }).catch(() => {});

    loadMessages();
    const interval = setInterval(loadMessages, 5000);
    return () => clearInterval(interval);
  }, [connectionId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function loadMessages() {
    try {
      const res = await api.get(`/messages/${connectionId}?sort=createdAt,asc&size=50`);
      setMessages(res.data.content ?? []);
      await api.post(`/messages/${connectionId}/seen`).catch(() => {});
    } catch {}
  }

  async function send(e) {
    e.preventDefault();
    if (!text.trim()) return;
    setSending(true);
    try {
      const res = await api.post(`/messages/${connectionId}/send`, { content: text.trim() });
      setMessages(prev => [...prev, res.data]);
      setText('');
    } catch (err) {
      alert(err?.response?.data?.message || 'Could not send message.');
    } finally {
      setSending(false);
    }
  }

  const fmtTime = (iso) => {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-gray-500 hover:text-gray-700 text-lg">←</button>
        <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-sm">💬</div>
        <p className="font-medium text-gray-800">{otherName || 'Conversation'}</p>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
        {messages.length === 0 && (
          <p className="text-center text-gray-400 text-sm mt-8">No messages yet. Say hello!</p>
        )}
        {messages.map(m => {
          const isMe = m.senderId === myUserId;
          return (
            <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-2xl text-sm ${
                isMe ? 'bg-indigo-600 text-white rounded-br-sm' : 'bg-white text-gray-800 shadow-sm rounded-bl-sm'
              }`}>
                <p>{m.content}</p>
                <p className={`text-xs mt-0.5 ${isMe ? 'text-indigo-200' : 'text-gray-400'}`}>
                  {fmtTime(m.createdAt)}
                  {isMe && m.seenAt && ' · Seen'}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={send} className="bg-white border-t px-4 py-3 flex gap-2">
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 border rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
        />
        <button
          type="submit"
          disabled={sending || !text.trim()}
          className="bg-indigo-600 text-white px-4 py-2 rounded-full text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
          Send
        </button>
      </form>
    </div>
  );
}
