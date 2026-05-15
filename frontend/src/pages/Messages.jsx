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
  const [otherUserId, setOtherUserId] = useState(null);
  const [trustLevel, setTrustLevel] = useState(null);
  const [showReport, setShowReport] = useState(false);
  const [reportForm, setReportForm] = useState({ reason: 'Inappropriate Behavior', description: '' });
  const [reporting, setReporting] = useState(false);
  const [reportMsg, setReportMsg] = useState('');
  const bottomRef = useRef(null);

  useEffect(() => {
    api.get('/connections').then(r => {
      const conn = r.data.find(c => c.id === connectionId);
      if (conn) {
        setOtherName(conn.otherUserName || 'User');
        setOtherUserId(conn.otherUserId);
        setTrustLevel(conn.currentTrustLevel);
      }
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

  async function submitReport(e) {
    e.preventDefault();
    if (!otherUserId) return;
    setReporting(true);
    setReportMsg('');
    try {
      await api.post('/reports', { reportedUserId: otherUserId, ...reportForm });
      setReportMsg('Report submitted. Thank you.');
      setReportForm({ reason: 'Inappropriate Behavior', description: '' });
    } catch (err) {
      setReportMsg(err?.response?.data?.message || 'Could not submit report.');
    } finally {
      setReporting(false);
    }
  }

  const fmtTime = (iso) => {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const TRUST_BANNERS = {
    PHONE_CALL: { icon: '📞', text: 'Ready for a phone call? Share your number when comfortable.' },
    VIDEO_CALL: { icon: '🎥', text: 'Time for a video call? Exchange details when ready.' },
    VERIFIED:   { icon: '✅', text: 'Both of you are verified. Trust is growing!' },
    FIRST_MEET: { icon: '🤝', text: 'Planning your first meet? Choose a public place and tell your emergency contacts.' },
    TRUSTED:    { icon: '⭐', text: 'Fully trusted connection. Enjoy your friendship!' },
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-gray-500 hover:text-gray-700 text-lg">←</button>
        <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-sm">💬</div>
        <p className="font-medium text-gray-800 flex-1">{otherName || 'Conversation'}</p>
        <button onClick={() => { setShowReport(r => !r); setReportMsg(''); }}
          className="text-xs text-red-400 hover:text-red-600 px-2 py-1 border border-red-200 rounded-lg">
          ⚑ Report
        </button>
      </header>

      {trustLevel && TRUST_BANNERS[trustLevel] && (
        <div className="bg-indigo-50 border-b border-indigo-100 px-4 py-2 flex items-center gap-2">
          <span>{TRUST_BANNERS[trustLevel].icon}</span>
          <p className="text-xs text-indigo-700">{TRUST_BANNERS[trustLevel].text}</p>
        </div>
      )}

      {showReport && (
        <div className="bg-red-50 border-b border-red-100 px-4 py-4">
          <p className="text-sm font-medium text-red-700 mb-3">Report {otherName}</p>
          <form onSubmit={submitReport} className="space-y-2">
            <select
              value={reportForm.reason}
              onChange={e => setReportForm(f => ({...f, reason: e.target.value}))}
              className="w-full border border-red-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-300">
              <option>Inappropriate Behavior</option>
              <option>Spam</option>
              <option>Safety Concern</option>
              <option>Other</option>
            </select>
            <textarea
              value={reportForm.description}
              onChange={e => setReportForm(f => ({...f, description: e.target.value}))}
              placeholder="Describe what happened (optional)..."
              rows={2}
              className="w-full border border-red-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-300" />
            {reportMsg && <p className={`text-xs ${reportMsg.includes('Thank') ? 'text-green-600' : 'text-red-500'}`}>{reportMsg}</p>}
            <div className="flex gap-2">
              <button type="submit" disabled={reporting}
                className="bg-red-600 text-white text-xs px-4 py-1.5 rounded-lg hover:bg-red-700 disabled:opacity-50">
                {reporting ? 'Submitting...' : 'Submit Report'}
              </button>
              <button type="button" onClick={() => setShowReport(false)}
                className="text-xs text-gray-500 px-3 py-1.5 border rounded-lg hover:bg-gray-50">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

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
