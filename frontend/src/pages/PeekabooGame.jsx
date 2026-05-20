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

function hexPoints(cx, cy, s, inset = 3) {
  const r = s - inset;
  return Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i;
    return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
  }).join(' ');
}

const POSITIONS = [
  [152, 90], [228, 90],
  [76, 156], [152, 156], [228, 156], [304, 156],
  [76, 222], [152, 222], [228, 222], [304, 222],
  [152, 288], [228, 288],
];

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

        {/* Tortoise — single SVG */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <svg width="380" height="400" viewBox="0 0 380 400" style={{ overflow: 'visible' }}>

            {/* Shell base glow */}
            <ellipse cx="190" cy="189" rx="140" ry="115" fill={GREEN} opacity="0.08" />

            {/* Head */}
            <ellipse cx="190" cy="52" rx="20" ry="22" fill={GREEN} />
            <ellipse cx="190" cy="72" rx="13" ry="14" fill={GREEN} />
            <circle cx="183" cy="44" r="4" fill="#f0fdf4" />
            <circle cx="197" cy="44" r="4" fill="#f0fdf4" />
            <circle cx="183" cy="44" r="2" fill="#1d1d1f" />
            <circle cx="197" cy="44" r="2" fill="#1d1d1f" />

            {/* Tail */}
            <ellipse cx="190" cy="315" rx="10" ry="14" fill={GREEN} />
            <path d="M186 325 Q190 345 194 325" fill={GREEN} />

            {/* Front-left leg */}
            <ellipse cx="52" cy="148" rx="14" ry="22"
              fill={GREEN} transform="rotate(-30 52 148)" />

            {/* Front-right leg */}
            <ellipse cx="328" cy="148" rx="14" ry="22"
              fill={GREEN} transform="rotate(30 328 148)" />

            {/* Back-left leg */}
            <ellipse cx="52" cy="230" rx="14" ry="22"
              fill={GREEN} transform="rotate(30 52 230)" />

            {/* Back-right leg */}
            <ellipse cx="328" cy="230" rx="14" ry="22"
              fill={GREEN} transform="rotate(-30 328 230)" />

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
                    stroke="#fafafc"
                    strokeWidth="2"
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
