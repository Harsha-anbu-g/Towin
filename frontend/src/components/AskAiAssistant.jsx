import { useState, useRef, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, X } from 'lucide-react';
import api from '../api/axios';

// The tortoise mascot image (served from /public).
const TORTOISE_IMG = '/ai-tortoise.png';

// Bind motion elements to names so lint counts them as used (this flat config
// doesn't treat <motion.div> member-expressions as a reference).
const MotionDiv = motion.div;
const MotionSpan = motion.span;

const SFD = `-apple-system, 'SF Pro Display', system-ui, sans-serif`;
const SF = `-apple-system, 'SF Pro Text', system-ui, sans-serif`;

const GREETING = {
  role: 'assistant',
  intro: true,
  content:
    "Hello! I'm the ToWin tortoise. Ask me anything about how ToWin works — or, " +
    "if you're logged in, about your own account like your trust score or streak.",
};

const SUGGESTIONS = [
  'How does the Trust Journey work?',
  'How do I post a request for help?',
  'What is my trust score?',
];

export default function AskAiAssistant() {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([GREETING]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  // Keep the newest message in view whenever the list or typing state changes.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  // Focus the input when the panel opens; close on Escape.
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => inputRef.current?.focus(), 250);
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => { clearTimeout(t); window.removeEventListener('keydown', onKey); };
  }, [open]);

  const send = useCallback(async (text) => {
    const question = (text ?? input).trim();
    if (!question || loading) return;

    const nextMessages = [...messages, { role: 'user', content: question }];
    setMessages(nextMessages);
    setInput('');
    setLoading(true);

    // History = the real exchange so far (drop the canned greeting). The server
    // caps it further and attaches the JWT via the axios interceptor, so a
    // logged-in user is recognised automatically for personal questions.
    const history = nextMessages
      .filter((m) => !m.intro)
      .map(({ role, content }) => ({ role, content }));

    try {
      const { data } = await api.post('/assistant/chat', { message: question, history });
      setMessages((prev) => [...prev, { role: 'assistant', content: data.reply }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content:
            "Sorry, I couldn't answer just now. Please try again in a moment, or use " +
            'the Feedback button and the ToWin team will help.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages]);

  // Hide where it would cover a primary action: the live chat composer and the
  // feedback form itself.
  if (pathname.startsWith('/messages/') || pathname === '/feedback') return null;

  const onlyGreeting = messages.length === 1;

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Ask AI — the ToWin helper"
          className="ask-ai-fab"
          style={{
            position: 'fixed', zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '9px',
            background: 'var(--blue)', color: '#fff', border: 'none',
            borderRadius: '9999px', padding: '12px 20px',
            fontSize: 'var(--text-md, 16px)', fontWeight: 600, fontFamily: SF, cursor: 'pointer',
            boxShadow: '0 4px 20px rgba(79,163,206,0.45)',
            transition: 'transform 0.15s, box-shadow 0.15s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.04)';
            e.currentTarget.style.boxShadow = '0 6px 24px rgba(79,163,206,0.6)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.boxShadow = '0 4px 20px rgba(79,163,206,0.45)';
          }}
        >
          <span style={{
            width: '30px', height: '30px', flexShrink: 0, borderRadius: '50%',
            background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <img src={TORTOISE_IMG} alt="" style={{ width: '24px', height: '24px', objectFit: 'contain' }} />
          </span>
          <span className="ask-ai-fab-label">Ask AI</span>
        </button>
      )}

      {/* Chat panel */}
      <AnimatePresence>
        {open && (
          <MotionDiv
            role="dialog"
            aria-label="Ask AI chat"
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="ask-ai-panel"
            style={{
              position: 'fixed', zIndex: 1001,
              display: 'flex', flexDirection: 'column',
              background: 'var(--canvas)', borderRadius: '20px',
              border: '1px solid var(--blue-soft)',
              boxShadow: '0 18px 50px rgba(46,125,166,0.28)',
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '12px',
              padding: '14px 16px', borderBottom: '1px solid var(--border-soft)',
              background: 'var(--blue-wash)',
            }}>
              <span style={{
                width: '40px', height: '40px', flexShrink: 0, borderRadius: '50%',
                background: '#fff', border: '1px solid var(--blue-soft)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
              }}>
                <img src={TORTOISE_IMG} alt="" style={{ width: '34px', height: '34px', objectFit: 'contain' }} />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontFamily: SFD, fontWeight: 700, fontSize: '16px', color: 'var(--ink)' }}>
                  Ask AI
                </p>
                <p style={{ margin: 0, fontFamily: SF, fontSize: 'var(--text-xs, 13px)', color: 'var(--ink-slate)' }}>
                  Your ToWin helper
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close chat"
                style={{
                  background: 'none', border: 'none', cursor: 'pointer', padding: '6px',
                  borderRadius: '50%', color: 'var(--ink-slate)', display: 'flex',
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Messages */}
            <div ref={scrollRef} style={{
              flex: 1, minHeight: 0, overflowY: 'auto', padding: '16px',
              display: 'flex', flexDirection: 'column', gap: '10px',
            }}>
              {messages.map((m, i) => (
                <Bubble key={i} role={m.role} content={m.content} />
              ))}

              {loading && <TypingDots />}

              {onlyGreeting && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      style={{
                        textAlign: 'left', background: '#fff', cursor: 'pointer',
                        border: '1px solid var(--blue-soft)', borderRadius: '12px',
                        padding: '10px 14px', fontFamily: SF, fontSize: 'var(--text-sm, 15px)',
                        color: 'var(--blue-deep)', lineHeight: 1.4,
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Composer */}
            <form
              onSubmit={(e) => { e.preventDefault(); send(); }}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '12px', borderTop: '1px solid var(--border-soft)', background: '#fff',
              }}
            >
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type your question…"
                aria-label="Type your question"
                maxLength={1000}
                style={{
                  flex: 1, minWidth: 0, border: '1px solid var(--blue-soft)',
                  borderRadius: '9999px', padding: '11px 16px',
                  fontFamily: SF, fontSize: '16px', color: 'var(--ink)', outline: 'none',
                }}
              />
              <button
                type="submit"
                aria-label="Send"
                disabled={!input.trim() || loading}
                style={{
                  flexShrink: 0, width: '44px', height: '44px', borderRadius: '50%',
                  border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: input.trim() && !loading ? 'var(--blue)' : 'var(--blue-mid)',
                  color: '#fff', cursor: input.trim() && !loading ? 'pointer' : 'default',
                  transition: 'background 0.15s',
                }}
              >
                <Send size={19} />
              </button>
            </form>
          </MotionDiv>
        )}
      </AnimatePresence>
    </>
  );
}

function Bubble({ role, content }) {
  const isUser = role === 'user';
  return (
    <div style={{
      alignSelf: isUser ? 'flex-end' : 'flex-start',
      maxWidth: '85%',
      background: isUser ? 'var(--blue)' : 'var(--blue-wash)',
      color: isUser ? '#fff' : 'var(--ink)',
      border: isUser ? 'none' : '1px solid var(--blue-soft)',
      borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
      padding: '10px 14px',
      fontFamily: SF, fontSize: 'var(--text-md, 16px)', lineHeight: 1.5,
      whiteSpace: 'pre-wrap', wordBreak: 'break-word',
    }}>
      {isUser ? content : <RichText text={content} />}
    </div>
  );
}

// Renders the assistant's reply as tidy plain text: turns **bold** into real
// bold, dash/asterisk lines into bullets, and strips any stray markdown
// asterisks so users never see raw "**" characters.
function RichText({ text }) {
  const lines = String(text ?? '').split('\n');
  return lines.map((line, i) => {
    if (line.trim() === '') return <div key={i} style={{ height: '6px' }} />;
    const isBullet = /^\s*[-*•]\s+/.test(line);
    if (isBullet) {
      const body = line.replace(/^\s*[-*•]\s+/, '');
      return (
        <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
          <span style={{ color: 'var(--blue-deep)', flexShrink: 0 }}>•</span>
          <span>{renderInline(body)}</span>
        </div>
      );
    }
    return <div key={i}>{renderInline(line)}</div>;
  });
}

function renderInline(str) {
  // Split on **bold** spans; strip any leftover single asterisks elsewhere.
  return str.split(/(\*\*[^*]+\*\*)/g).map((part, i) => {
    const bold = /^\*\*([^*]+)\*\*$/.exec(part);
    if (bold) return <strong key={i}>{bold[1]}</strong>;
    return <span key={i}>{part.replace(/\*+/g, '')}</span>;
  });
}

function TypingDots() {
  return (
    <div style={{
      alignSelf: 'flex-start', background: 'var(--blue-wash)', border: '1px solid var(--blue-soft)',
      borderRadius: '16px 16px 16px 4px', padding: '12px 16px', display: 'flex', gap: '5px',
    }} aria-label="Typing">
      {[0, 1, 2].map((i) => (
        <MotionSpan
          key={i}
          style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--blue-mid)' }}
          animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }}
          transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }}
        />
      ))}
    </div>
  );
}
