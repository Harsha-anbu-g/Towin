import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import NavBar from '../components/NavBar';
import api from '../api/axios';

const SF  = `-apple-system, 'SF Pro Display', system-ui, sans-serif`;
const SFT = `-apple-system, 'SF Pro Text', system-ui, sans-serif`;
const HEX   = 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)';
const GREEN = '#1a5c2e';
const SHELL = '#3D8B5A';
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

function hexPoints(cx, cy, s, inset = 3) {
  const r = s - inset;
  return Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i;
    return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
  }).join(' ');
}

// 3×4 grid — taller than wide, so the shell reads as a vertical oval
const POSITIONS = [
  [118, 96], [190, 96], [262, 96],
  [118, 158], [190, 158], [262, 158],
  [118, 220], [190, 220], [262, 220],
  [118, 282], [190, 282], [262, 282],
];

export default function PeekabooGame() {
  const navigate = useNavigate();
  const [cards, setCards]       = useState(initCards);
  const [selected, setSelected] = useState([]);
  const [locked, setLocked]     = useState(false);
  const [timeLeft, setTimeLeft] = useState(TIME);
  const [phase, setPhase]       = useState('playing');
  const checkedIn = useRef(false);

  // Check-in happens on the Streaks page before entering the game

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

  return (
    <div style={{ minHeight: '100svh', background: 'var(--surface-pearl)', fontFamily: SFT }}>
      <NavBar />

      <div style={{ maxWidth: '560px', margin: '0 auto', padding: '28px 24px 80px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '18px', gap: '16px' }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '38px', fontWeight: 400, color: GREEN, margin: 0, letterSpacing: '-0.02em', lineHeight: 1 }}>
              Peekaboo!
            </h1>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-3)', margin: '5px 0 0' }}>
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
              <span style={{ fontFamily: SF, fontSize: 'var(--text-base)', fontWeight: 600, color: timerColor, lineHeight: 1, transition: 'color 0.3s' }}>{timeLeft}</span>
              <span style={{ fontSize: '9px', color: 'var(--ink-4)' }}>SEC</span>
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '36px' }}>
          <div style={{ flex: 1, height: '8px', background: 'var(--border)', borderRadius: '9999px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: '100%', background: SKY, borderRadius: '9999px', transform: `scaleX(${matchedCount / PAIRS})`, transformOrigin: 'left center', transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)' }} />
          </div>
          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-3)', fontWeight: 600, flexShrink: 0 }}>{matchedCount}/{PAIRS}</span>
        </div>

        {/* Tortoise — single SVG */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <svg width="100%" height="auto" viewBox="0 -28 380 460" style={{ overflow: 'visible', maxWidth: '380px' }}>

            {/* Ground shadow */}
            <ellipse cx="190" cy="416" rx="110" ry="10" fill={GREEN} opacity="0.08" />

            {/* Legs — chunky capsules peeking out diagonally from under the shell */}
            <ellipse cx="70" cy="52" rx="24" ry="40" fill={GREEN} transform="rotate(-45 70 52)" />
            <ellipse cx="310" cy="52" rx="24" ry="40" fill={GREEN} transform="rotate(45 310 52)" />
            <ellipse cx="70" cy="326" rx="24" ry="40" fill={GREEN} transform="rotate(45 70 326)" />
            <ellipse cx="310" cy="326" rx="24" ry="40" fill={GREEN} transform="rotate(-45 310 326)" />

            {/* Tail */}
            <path d="M 172 348 Q 190 410 208 348 Z" fill={GREEN} />

            {/* Neck + head peeking over the shell */}
            <ellipse cx="190" cy="40" rx="18" ry="28" fill={GREEN} />
            <circle cx="190" cy="8" r="30" fill={GREEN} />
            <circle cx="178" cy="2" r="5.5" fill="#f0fdf4" />
            <circle cx="202" cy="2" r="5.5" fill="#f0fdf4" />
            <circle cx="178.5" cy="2.5" r="2.6" fill="#1d1d1f" />
            <circle cx="201.5" cy="2.5" r="2.6" fill="#1d1d1f" />

            {/* Shell — vertical oval: dark rim with a lighter plate the cells sit on */}
            <ellipse cx="190" cy="189" rx="152" ry="174" fill={GREEN} />
            <ellipse cx="190" cy="189" rx="138" ry="160" fill={SHELL} />
            <ellipse cx="152" cy="116" rx="52" ry="66" fill="#ffffff" opacity="0.04" />

            {/* Hex cells */}
            {cards.map((card, i) => {
              const [cx, cy] = POSITIONS[i];
              const revealed = card.flipped || card.matched;
              const fill = card.matched ? SKY : revealed ? '#f0fdf4' : GREEN;
              return (
                <g key={card.id} onClick={() => flip(i)}
                  style={{ cursor: card.matched ? 'default' : 'pointer' }}>
                  <polygon
                    points={hexPoints(cx, cy, 36, 3)}
                    fill={fill}
                    stroke={SHELL}
                    strokeWidth="2.5"
                    style={{ transition: 'fill 0.25s' }}
                  />
                  {revealed && (
                    <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central"
                      fill={card.matched ? '#fff' : GREEN}
                      fontSize={card.matched ? 16 : 20}
                      fontWeight="800"
                      fontFamily={SF}
                      style={{ userSelect: 'none', pointerEvents: 'none' }}>
                      {card.matched ? '✓' : card.num}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        {/* Skip */}
        <div style={{ textAlign: 'center', marginTop: '24px' }}>
          <button onClick={() => navigate('/dashboard')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 'var(--text-sm)', color: 'var(--ink-4)', fontFamily: SFT, textDecoration: 'underline', padding: '8px' }}>
            Skip to Dashboard
          </button>
        </div>
      </div>

      {/* Result overlay */}
      {phase !== 'playing' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
          <div style={{ background: '#fff', borderRadius: '18px', padding: '48px 40px', maxWidth: '340px', width: '90%', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <img src="/logo.png" alt="tortoise" style={{ width: 80, height: 80, objectFit: 'contain', marginBottom: '16px', filter: 'drop-shadow(0 4px 16px rgba(26,92,46,0.25))' }} />
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-xl)', fontWeight: 400, color: 'var(--ink)', margin: '0 0 10px', letterSpacing: '-0.02em' }}>
              {phase === 'won' ? 'You found them all!' : "Time's up!"}
            </h2>
            <p style={{ fontSize: '16px', color: 'var(--ink-3)', margin: '0 0 28px', lineHeight: 1.55, fontFamily: SFT }}>
              {phase === 'won'
                ? `All ${PAIRS} pairs matched. Your streak keeps going!`
                : `You got ${matchedCount} of ${PAIRS}. Streak still counts!`}
            </p>
            <button onClick={() => navigate('/dashboard')} style={{ width: '100%', background: GREEN, color: '#fff', border: 'none', borderRadius: '9999px', padding: '16px 0', fontSize: '17px', fontWeight: 600, fontFamily: SFT, cursor: 'pointer', boxShadow: '0 4px 16px rgba(26,92,46,0.3)' }}>
              Continue to Dashboard
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
