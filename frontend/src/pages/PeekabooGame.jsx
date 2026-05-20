import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import NavBar from '../components/NavBar';
import api from '../api/axios';

const SF  = `-apple-system, 'SF Pro Display', system-ui, sans-serif`;
const SFT = `-apple-system, 'SF Pro Text', system-ui, sans-serif`;
const HEX   = 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)';
const GREEN = '#1a5c2e';
const SKY   = '#4FA3CE';
const PAIRS = 6;
const TIME  = 60;

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function initCards() {
  const nums = Array.from({ length: PAIRS }, (_, i) => i + 1);
  return shuffle([...nums, ...nums]).map((num, i) => ({
    id: i, num, flipped: false, matched: false,
  }));
}

function HexCard({ card, onClick }) {
  const revealed = card.flipped || card.matched;
  return (
    <div
      onClick={onClick}
      style={{
        width: 80, height: 80,
        clipPath: HEX,
        background: card.matched ? SKY : revealed ? '#f0fdf4' : GREEN,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: card.matched ? 'default' : 'pointer',
        transition: 'background 0.25s',
        userSelect: 'none', flexShrink: 0,
      }}
    >
      {revealed && (
        <span style={{
          fontSize: card.matched ? '20px' : '26px',
          fontWeight: 800,
          color: card.matched ? '#fff' : GREEN,
          fontFamily: SF, lineHeight: 1,
        }}>
          {card.matched ? '✓' : card.num}
        </span>
      )}
    </div>
  );
}

function TortoiseHead() {
  return (
    <svg width="48" height="52" viewBox="0 0 48 52" fill="none">
      <ellipse cx="24" cy="36" rx="14" ry="14" fill={GREEN} />
      <ellipse cx="24" cy="18" rx="11" ry="13" fill={GREEN} />
      <circle cx="19" cy="13" r="3" fill="#f0fdf4" />
      <circle cx="29" cy="13" r="3" fill="#f0fdf4" />
      <circle cx="19" cy="13" r="1.4" fill="#1d1d1f" />
      <circle cx="29" cy="13" r="1.4" fill="#1d1d1f" />
    </svg>
  );
}

function TortoiseTail() {
  return (
    <svg width="22" height="32" viewBox="0 0 22 32" fill="none">
      <ellipse cx="11" cy="10" rx="9" ry="10" fill={GREEN} />
      <path d="M7 16 Q11 32 15 16" fill={GREEN} />
    </svg>
  );
}

function TortoiseLeg({ rotate }) {
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" fill="none"
      style={{ transform: `rotate(${rotate}deg)`, display: 'block' }}>
      <ellipse cx="22" cy="20" rx="11" ry="16" fill={GREEN} />
      <ellipse cx="22" cy="34" rx="9" ry="6" fill={GREEN} />
    </svg>
  );
}

// 2-4-4-2 row config: [count, marginLeft]
const ROWS = [[2, 43], [4, 0], [4, 0], [2, 43]];

export default function PeekabooGame() {
  const navigate = useNavigate();
  const [cards, setCards]       = useState(initCards);
  const [selected, setSelected] = useState([]);
  const [locked, setLocked]     = useState(false);
  const [timeLeft, setTimeLeft] = useState(TIME);
  const [phase, setPhase]       = useState('playing');
  const checkedIn = useRef(false);

  useEffect(() => {
    if (!checkedIn.current) {
      checkedIn.current = true;
      api.post('/streaks/checkin').catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (phase !== 'playing') return;
    if (timeLeft <= 0) { setPhase('lost'); return; }
    const t = setTimeout(() => setTimeLeft(n => n - 1), 1000);
    return () => clearTimeout(t);
  }, [timeLeft, phase]);

  useEffect(() => {
    if (phase === 'playing' && cards.every(c => c.matched)) setPhase('won');
  }, [cards, phase]);

  function flip(idx) {
    if (locked || phase !== 'playing') return;
    const card = cards[idx];
    if (card.flipped || card.matched || selected.length >= 2) return;
    const next = [...selected, idx];
    setCards(prev => prev.map((c, i) => i === idx ? { ...c, flipped: true } : c));
    setSelected(next);
    if (next.length === 2) {
      setLocked(true);
      const [a, b] = next;
      setTimeout(() => {
        setCards(prev => {
          const hit = prev[a].num === prev[b].num;
          return prev.map((c, i) =>
            i === a || i === b
              ? hit ? { ...c, matched: true, flipped: false } : { ...c, flipped: false }
              : c
          );
        });
        setSelected([]);
        setLocked(false);
      }, 1200);
    }
  }

  const matchedCount = cards.filter(c => c.matched).length / 2;
  const timerPct     = timeLeft / TIME;
  const timerColor   = timeLeft <= 15 ? '#dc2626' : timeLeft <= 30 ? '#F5B400' : GREEN;

  // Map cards to rows
  let offset = 0;
  const rowCards = ROWS.map(([count]) => {
    const slice = cards.slice(offset, offset + count);
    offset += count;
    return slice;
  });

  return (
    <div style={{ minHeight: '100svh', background: '#fafafc', fontFamily: SFT }}>
      <NavBar />

      <div style={{ maxWidth: '560px', margin: '0 auto', padding: '28px 24px 80px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '18px', gap: '16px' }}>
          <div>
            <h1 style={{ fontFamily: SF, fontSize: '38px', fontWeight: 800, color: GREEN, margin: 0, letterSpacing: '-0.8px', lineHeight: 1 }}>
              Peekaboo!
            </h1>
            <p style={{ fontSize: '14px', color: '#7a7a7a', margin: '5px 0 0' }}>
              Match all {PAIRS} pairs to win
            </p>
          </div>

          {/* Timer ring */}
          <div style={{ flexShrink: 0, position: 'relative', width: 68, height: 68 }}>
            <svg width="68" height="68" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="34" cy="34" r="28" fill="none" stroke="#e5e7eb" strokeWidth="6" />
              <circle cx="34" cy="34" r="28" fill="none" stroke={timerColor}
                strokeWidth="6"
                strokeDasharray={`${2 * Math.PI * 28}`}
                strokeDashoffset={`${2 * Math.PI * 28 * (1 - timerPct)}`}
                strokeLinecap="round"
                style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s' }}
              />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontFamily: SF, fontSize: '18px', fontWeight: 800, color: timerColor, lineHeight: 1, transition: 'color 0.3s' }}>{timeLeft}</span>
              <span style={{ fontSize: '9px', color: '#a0a0a5' }}>SEC</span>
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '36px' }}>
          <div style={{ flex: 1, height: '8px', background: '#e5e7eb', borderRadius: '9999px', overflow: 'hidden' }}>
            <div style={{ height: '100%', background: SKY, borderRadius: '9999px', width: `${(matchedCount / PAIRS) * 100}%`, transition: 'width 0.4s' }} />
          </div>
          <span style={{ fontSize: '14px', color: '#7a7a7a', fontWeight: 700, flexShrink: 0 }}>{matchedCount}/{PAIRS}</span>
        </div>

        {/* Tortoise body — centered */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <div style={{ position: 'relative', display: 'inline-block' }}>

            {/* Head */}
            <div style={{ position: 'absolute', top: '-56px', left: '50%', transform: 'translateX(-50%)', pointerEvents: 'none' }}>
              <TortoiseHead />
            </div>

            {/* Tail */}
            <div style={{ position: 'absolute', bottom: '-44px', left: '50%', transform: 'translateX(-50%)', pointerEvents: 'none' }}>
              <TortoiseTail />
            </div>

            {/* Front-left leg */}
            <div style={{ position: 'absolute', top: '6px', left: '-48px', pointerEvents: 'none' }}>
              <TortoiseLeg rotate={-35} />
            </div>

            {/* Front-right leg */}
            <div style={{ position: 'absolute', top: '6px', right: '-48px', pointerEvents: 'none' }}>
              <TortoiseLeg rotate={35} />
            </div>

            {/* Back-left leg */}
            <div style={{ position: 'absolute', bottom: '6px', left: '-48px', pointerEvents: 'none' }}>
              <TortoiseLeg rotate={35} />
            </div>

            {/* Back-right leg */}
            <div style={{ position: 'absolute', bottom: '6px', right: '-48px', pointerEvents: 'none' }}>
              <TortoiseLeg rotate={-35} />
            </div>

            {/* Shell grid (2-4-4-2 honeycomb) */}
            <div>
              {ROWS.map(([count, ml], rowIdx) => (
                <div key={rowIdx} style={{ display: 'flex', gap: '6px', marginLeft: `${ml}px`, marginTop: rowIdx === 0 ? '0' : '-18px' }}>
                  {rowCards[rowIdx].map((card, colIdx) => {
                    const globalIdx = ROWS.slice(0, rowIdx).reduce((s, [c]) => s + c, 0) + colIdx;
                    return <HexCard key={card.id} card={card} onClick={() => flip(globalIdx)} />;
                  })}
                </div>
              ))}
            </div>

          </div>
        </div>

        {/* Skip */}
        <div style={{ textAlign: 'center', marginTop: '80px' }}>
          <button onClick={() => navigate('/streaks')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', color: '#a0a0a5', fontFamily: SFT, textDecoration: 'underline', padding: '8px' }}>
            Skip game
          </button>
        </div>
      </div>

      {/* Result overlay */}
      {phase !== 'playing' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
          <div style={{ background: '#fff', borderRadius: '28px', padding: '48px 40px', maxWidth: '340px', width: '90%', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <img src="/logo.png" alt="tortoise" style={{ width: 80, height: 80, objectFit: 'contain', marginBottom: '16px', filter: 'drop-shadow(0 4px 16px rgba(26,92,46,0.25))' }} />
            <h2 style={{ fontFamily: SF, fontSize: '28px', fontWeight: 800, color: '#1d1d1f', margin: '0 0 10px', letterSpacing: '-0.4px' }}>
              {phase === 'won' ? 'You found them all!' : "Time's up!"}
            </h2>
            <p style={{ fontSize: '15px', color: '#7a7a7a', margin: '0 0 28px', lineHeight: 1.55, fontFamily: SFT }}>
              {phase === 'won'
                ? `All ${PAIRS} pairs matched. Your streak keeps going!`
                : `You got ${matchedCount} of ${PAIRS}. Streak still counts!`}
            </p>
            <button onClick={() => navigate('/streaks')} style={{ width: '100%', background: GREEN, color: '#fff', border: 'none', borderRadius: '9999px', padding: '16px 0', fontSize: '17px', fontWeight: 700, fontFamily: SFT, cursor: 'pointer', boxShadow: '0 4px 16px rgba(26,92,46,0.3)' }}>
              See my streak →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
