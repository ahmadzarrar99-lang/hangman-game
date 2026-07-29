import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Play, RotateCcw, Trophy, Skull, Zap, Target, Timer, Sparkles,
  Award, Flame, BarChart3, History, Lightbulb, Loader2, RefreshCw,
  Book, CheckCircle2, XCircle, Wifi, WifiOff, Gamepad2
} from 'lucide-react';

const ACCENT = {
  lilac: '#B8A9E8',
  amber: '#F5A623',
  teal:  '#4ECDC4',
  coral: '#FF6B6B',
  green: '#4ADE80',
  ink:   '#1A1A1A',
};

// Difficulty configuration — varying word lengths + guess limits
const DIFFICULTY = {
  easy:   { label: 'Easy',   length: 4,  maxWrong: 8, color: ACCENT.green, textColor: '#166534', icon: Sparkles },
  medium: { label: 'Medium', length: 6,  maxWrong: 7, color: ACCENT.teal,  textColor: '#115E59', icon: Target   },
  hard:   { label: 'Hard',   length: 8,  maxWrong: 6, color: ACCENT.amber, textColor: '#92400E', icon: Flame    },
  expert: { label: 'Expert', length: 10, maxWrong: 5, color: ACCENT.coral, textColor: '#DC2626', icon: Skull    },
};

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

// Curated offline fallback pool per difficulty (used if API fails)
const FALLBACK_WORDS = {
  easy:   ['tree','book','fish','rain','moon','star','game','wolf','fire','wind','sand','rock'],
  medium: ['planet','forest','castle','wizard','python','coffee','guitar','random','island','copper'],
  hard:   ['keyboard','mountain','elephant','universe','notebook','sunlight','triangle','magnetic'],
  expert: ['adventurous','photography','strawberry','microscope','journalists','pineapples','powerhouse'],
};

const SCORES_KEY = 'hangman:scores:v1';

function safe(v) { return String(v ?? '').trim(); }
function nowIso() { return new Date().toISOString(); }

function loadScores() {
  try {
    const raw = localStorage.getItem(SCORES_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}
function saveScores(scores) {
  try { localStorage.setItem(SCORES_KEY, JSON.stringify(scores)); } catch { /* ignore quota errors */ }
}

// ─── Hangman SVG figure ──────────────────────────────────────────────────
function HangmanFigure({ wrong, maxWrong }) {
  const parts = 6;
  const drawn = Math.min(parts, Math.round((wrong / maxWrong) * parts));
  const stroke = wrong >= maxWrong ? ACCENT.coral : (wrong >= maxWrong - 1 ? ACCENT.amber : ACCENT.ink);

  return (
    <svg viewBox="0 0 200 220" className="w-full h-full">
      {/* Gallows */}
      <line x1="20" y1="200" x2="120" y2="200" stroke="#E0E0E0" strokeWidth="3" strokeLinecap="round" />
      <line x1="50" y1="200" x2="50" y2="20"  stroke="#E0E0E0" strokeWidth="3" strokeLinecap="round" />
      <line x1="50" y1="20"  x2="130" y2="20" stroke="#E0E0E0" strokeWidth="3" strokeLinecap="round" />
      <line x1="130" y1="20" x2="130" y2="40" stroke="#E0E0E0" strokeWidth="3" strokeLinecap="round" />
      {/* Head */}
      {drawn >= 1 && (
        <circle cx="130" cy="55" r="15" fill="none" stroke={stroke} strokeWidth="3"
          className="animate-[fadeIn_300ms_ease-out]" />
      )}
      {/* Body */}
      {drawn >= 2 && (
        <line x1="130" y1="70" x2="130" y2="130" stroke={stroke} strokeWidth="3" strokeLinecap="round"
          className="animate-[fadeIn_300ms_ease-out]" />
      )}
      {/* Left arm */}
      {drawn >= 3 && (
        <line x1="130" y1="85" x2="110" y2="110" stroke={stroke} strokeWidth="3" strokeLinecap="round"
          className="animate-[fadeIn_300ms_ease-out]" />
      )}
      {/* Right arm */}
      {drawn >= 4 && (
        <line x1="130" y1="85" x2="150" y2="110" stroke={stroke} strokeWidth="3" strokeLinecap="round"
          className="animate-[fadeIn_300ms_ease-out]" />
      )}
      {/* Left leg */}
      {drawn >= 5 && (
        <line x1="130" y1="130" x2="115" y2="160" stroke={stroke} strokeWidth="3" strokeLinecap="round"
          className="animate-[fadeIn_300ms_ease-out]" />
      )}
      {/* Right leg */}
      {drawn >= 6 && (
        <line x1="130" y1="130" x2="145" y2="160" stroke={stroke} strokeWidth="3" strokeLinecap="round"
          className="animate-[fadeIn_300ms_ease-out]" />
      )}
      {/* Face (only when dead) */}
      {wrong >= maxWrong && (
        <g className="animate-[fadeIn_300ms_ease-out]">
          <line x1="124" y1="51" x2="128" y2="55" stroke={ACCENT.coral} strokeWidth="2" strokeLinecap="round" />
          <line x1="128" y1="51" x2="124" y2="55" stroke={ACCENT.coral} strokeWidth="2" strokeLinecap="round" />
          <line x1="132" y1="51" x2="136" y2="55" stroke={ACCENT.coral} strokeWidth="2" strokeLinecap="round" />
          <line x1="136" y1="51" x2="132" y2="55" stroke={ACCENT.coral} strokeWidth="2" strokeLinecap="round" />
        </g>
      )}
    </svg>
  );
}

export default function App() {
  // ─── Game state ───────────────────────────────────────────────────────
  const [difficulty, setDifficulty] = useState('medium');
  const [word, setWord] = useState('');
  const [guessed, setGuessed] = useState(new Set());
  const [wrongCount, setWrongCount] = useState(0);
  const [gameState, setGameState] = useState('idle'); // idle | playing | won | lost
  const [loading, setLoading] = useState(false);
  const [apiOnline, setApiOnline] = useState(true);
  const [startedAt, setStartedAt] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [hintUsed, setHintUsed] = useState(false);
  const [activeTab, setActiveTab] = useState('play');
  const [scoreSaved, setScoreSaved] = useState(false);
  const [scores, setScores] = useState(() => loadScores());
  const timerRef = useRef(null);

  const cfg = DIFFICULTY[difficulty];
  const maxWrong = cfg.maxWrong;
  const wordLetters = useMemo(() => new Set(word.split('').filter(c => /[A-Z]/.test(c))), [word]);
  const revealed = useMemo(() => (
    word.split('').map(c => (!/[A-Z]/.test(c) ? c : (guessed.has(c) ? c : '_')))
  ), [word, guessed]);
  const allRevealed = useMemo(() => (
    word.length > 0 && [...wordLetters].every(c => guessed.has(c))
  ), [wordLetters, guessed, word]);

  // ─── Fetch a word from external public API ────────────────────────────
  const fetchWord = useCallback(async (len) => {
    const url = `https://random-word-api.herokuapp.com/word?number=1&length=${len}`;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const arr = await res.json();
      if (Array.isArray(arr) && arr.length > 0 && typeof arr[0] === 'string') {
        const w = arr[0].toUpperCase().replace(/[^A-Z]/g, '');
        if (w.length >= 3) return { word: w, source: 'api' };
      }
      throw new Error('Bad payload');
    } catch {
      const pool = FALLBACK_WORDS[difficulty] || FALLBACK_WORDS.medium;
      const pick = pool[Math.floor(Math.random() * pool.length)];
      return { word: pick.toUpperCase(), source: 'offline' };
    }
  }, [difficulty]);

  // ─── Start a new game ────────────────────────────────────────────────
  const startGame = useCallback(async (diff) => {
    const useDiff = diff || difficulty;
    const useCfg = DIFFICULTY[useDiff];
    setLoading(true);
    setScoreSaved(false);
    setHintUsed(false);
    setGuessed(new Set());
    setWrongCount(0);
    setElapsed(0);
    const { word: w, source } = await fetchWord(useCfg.length);
    setWord(w);
    setApiOnline(source === 'api');
    setStartedAt(Date.now());
    setGameState('playing');
    setLoading(false);
  }, [difficulty, fetchWord]);

  // ─── Timer ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (gameState !== 'playing') { if (timerRef.current) clearInterval(timerRef.current); return; }
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 500);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [gameState, startedAt]);

  // ─── Detect win / loss ───────────────────────────────────────────────
  useEffect(() => {
    if (gameState !== 'playing' || !word) return;
    if (allRevealed) setGameState('won');
    else if (wrongCount >= maxWrong) setGameState('lost');
  }, [allRevealed, wrongCount, maxWrong, gameState, word]);

  // ─── Persist score to localStorage ONCE when game ends ────────────────
  useEffect(() => {
    if ((gameState === 'won' || gameState === 'lost') && !scoreSaved && word) {
      const finalElapsed = startedAt ? Math.floor((Date.now() - startedAt) / 1000) : elapsed;
      const row = {
        id: Date.now(),
        word,
        difficulty,
        result: gameState,
        wrong_guesses: wrongCount,
        total_guesses: guessed.size,
        duration_sec: finalElapsed,
        played_at: nowIso(),
      };
      setScores(prev => {
        const next = [row, ...prev].slice(0, 500);
        saveScores(next);
        return next;
      });
      setScoreSaved(true);
    }
  }, [gameState, scoreSaved, word, guessed, wrongCount, difficulty, elapsed, startedAt]);

  // ─── Handle letter guess ─────────────────────────────────────────────
  const guessLetter = useCallback((letter) => {
    if (gameState !== 'playing') return;
    const L = letter.toUpperCase();
    if (!/^[A-Z]$/.test(L)) return;
    if (guessed.has(L)) return;
    setGuessed(prev => {
      const next = new Set(prev);
      next.add(L);
      return next;
    });
    if (!wordLetters.has(L)) setWrongCount(w => w + 1);
  }, [gameState, guessed, wordLetters]);

  // ─── Physical keyboard support ───────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (gameState !== 'playing') return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key;
      if (/^[a-zA-Z]$/.test(k)) guessLetter(k);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [gameState, guessLetter]);

  // ─── Hint: reveal one unguessed letter (costs one wrong slot) ─────────
  const useHint = useCallback(() => {
    if (gameState !== 'playing' || hintUsed) return;
    const unrevealed = [...wordLetters].filter(c => !guessed.has(c));
    if (unrevealed.length === 0) return;
    const pick = unrevealed[Math.floor(Math.random() * unrevealed.length)];
    setGuessed(prev => new Set(prev).add(pick));
    setWrongCount(w => Math.min(maxWrong, w + 1));
    setHintUsed(true);
  }, [gameState, hintUsed, wordLetters, guessed, maxWrong]);

  // ─── Derived stats ────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const played = scores.length;
    const wins = scores.filter(s => s.result === 'won').length;
    const losses = scores.filter(s => s.result === 'lost').length;
    const rate = played > 0 ? Math.round((wins / played) * 100) : 0;
    return { played, wins, losses, rate };
  }, [scores]);

  const scoreHistory = useMemo(() => scores.slice(0, 50), [scores]);

  const perDifficultyStats = useMemo(() => {
    const buckets = {};
    for (const d of Object.keys(DIFFICULTY)) buckets[d] = { played: 0, won: 0 };
    for (const s of scores) {
      const d = safe(s.difficulty);
      if (!buckets[d]) continue;
      buckets[d].played += 1;
      if (safe(s.result) === 'won') buckets[d].won += 1;
    }
    return buckets;
  }, [scores]);

  const remaining = Math.max(0, maxWrong - wrongCount);
  const progressPct = word ? Math.round(([...wordLetters].filter(c => guessed.has(c)).length / wordLetters.size) * 100) : 0;

  const tabs = [
    { id: 'play',    label: 'Play',    icon: Gamepad2 },
    { id: 'stats',   label: 'Stats',   icon: BarChart3 },
    { id: 'history', label: 'History', icon: History  },
  ];

  const clearHistory = () => {
    if (!window.confirm('Clear all game history? This cannot be undone.')) return;
    setScores([]);
    saveScores([]);
  };

  return (
    <div className="min-h-screen bg-[#FAFAF8]">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-[#F0F0F0]">
        <div className="max-w-7xl mx-auto px-8 py-5">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#1A1A1A] flex items-center justify-center">
                <Gamepad2 size={16} className="text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-[#1A1A1A] tracking-tight">Hangman</h1>
                <p className="text-[11px] text-[#9B9B9B] mt-0.5 flex items-center gap-1.5">
                  {apiOnline ? (
                    <><Wifi size={10} className="text-[#4ADE80]" /> Words from public API</>
                  ) : (
                    <><WifiOff size={10} className="text-[#F5A623]" /> Offline word pack</>
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4 text-[11px] text-[#9B9B9B]">
              <span className="flex items-center gap-1.5">
                <Trophy size={11} className="text-[#4ADE80]" />
                <strong className="text-[#1A1A1A]">{stats.wins}</strong> wins
              </span>
              <span className="flex items-center gap-1.5">
                <Skull size={11} className="text-[#FF6B6B]" />
                <strong className="text-[#1A1A1A]">{stats.losses}</strong> losses
              </span>
              <span className="flex items-center gap-1.5">
                <Target size={11} className="text-[#B8A9E8]" />
                <strong className="text-[#1A1A1A]">{stats.rate}%</strong> win-rate
              </span>
            </div>
          </div>
          {/* Tabs */}
          <div className="flex gap-1 mt-5 bg-[#F0F0F0]/60 rounded-full p-1 w-fit">
            {tabs.map(t => {
              const Icon = t.icon;
              const active = activeTab === t.id;
              return (
                <button key={t.id} onClick={() => setActiveTab(t.id)}
                  className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-full transition-all duration-200 ${active ? 'bg-white text-[#1A1A1A] shadow-sm' : 'text-[#6B6B6B] hover:text-[#1A1A1A]'}`}>
                  <Icon size={14} />{t.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-8 py-8">
        <div key={activeTab} className="animate-[fadeIn_300ms_ease-out]">

          {/* ═══════════ PLAY TAB ═══════════ */}
          {activeTab === 'play' && (
            <div className="space-y-6">
              {/* Difficulty selector */}
              <div className="bg-white rounded-2xl border border-[#F0F0F0] p-6">
                <h3 className="text-sm font-semibold text-[#1A1A1A] mb-4 flex items-center gap-2">
                  <Flame size={14} className="text-[#F5A623]" /> Choose difficulty
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {Object.entries(DIFFICULTY).map(([key, d]) => {
                    const Icon = d.icon;
                    const active = difficulty === key;
                    const disabled = gameState === 'playing' || loading;
                    return (
                      <button
                        key={key}
                        onClick={() => !disabled && setDifficulty(key)}
                        disabled={disabled}
                        className={`text-left p-4 rounded-2xl border transition-all duration-200 ${active ? 'border-transparent shadow-sm' : 'border-[#F0F0F0] hover:border-[#E0E0E0]'} ${disabled && !active ? 'opacity-50 cursor-not-allowed' : 'hover:-translate-y-0.5'}`}
                        style={active ? { backgroundColor: d.color + '15', borderColor: d.color + '55' } : { backgroundColor: 'white' }}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: d.color + '20' }}>
                            <Icon size={14} style={{ color: d.color }} />
                          </div>
                          {active && <CheckCircle2 size={14} style={{ color: d.color }} />}
                        </div>
                        <div className="text-sm font-semibold text-[#1A1A1A]">{d.label}</div>
                        <div className="text-[11px] text-[#6B6B6B] mt-0.5">
                          {d.length} letters · {d.maxWrong} misses
                        </div>
                        <div className="text-[10px] text-[#9B9B9B] mt-1">
                          {perDifficultyStats[key]?.won || 0}/{perDifficultyStats[key]?.played || 0} won
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Game board */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left: Hangman figure + status */}
                <div className="bg-white rounded-2xl border border-[#F0F0F0] p-6 lg:col-span-1">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-[#1A1A1A] flex items-center gap-2">
                      <Skull size={14} className="text-[#FF6B6B]" /> Status
                    </h3>
                    <span className="text-[10px] text-[#9B9B9B] font-medium uppercase tracking-wider">
                      {gameState}
                    </span>
                  </div>
                  <div className="h-56 flex items-center justify-center">
                    {loading ? (
                      <div className="flex flex-col items-center gap-3 text-[#9B9B9B]">
                        <Loader2 size={28} className="animate-spin text-[#B8A9E8]" />
                        <span className="text-xs">Fetching a word…</span>
                      </div>
                    ) : gameState === 'idle' ? (
                      <div className="flex flex-col items-center gap-2 text-[#9B9B9B]">
                        <Gamepad2 size={40} className="text-[#E0E0E0]" />
                        <span className="text-xs">Press Start to begin</span>
                      </div>
                    ) : (
                      <HangmanFigure wrong={wrongCount} maxWrong={maxWrong} />
                    )}
                  </div>
                  {/* Remaining meter */}
                  <div className="mt-4">
                    <div className="flex items-center justify-between text-[11px] mb-1.5">
                      <span className="text-[#6B6B6B]">Guesses remaining</span>
                      <span className="font-semibold" style={{ color: remaining <= 2 ? ACCENT.coral : remaining <= Math.ceil(maxWrong/2) ? ACCENT.amber : ACCENT.green }}>
                        {gameState === 'idle' ? '—' : `${remaining} / ${maxWrong}`}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-[#F0F0F0] overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: gameState === 'idle' ? '100%' : `${(remaining / maxWrong) * 100}%`,
                          backgroundColor: remaining <= 2 ? ACCENT.coral : remaining <= Math.ceil(maxWrong/2) ? ACCENT.amber : ACCENT.green
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Middle+Right: Word + Actions + Keyboard */}
                <div className="lg:col-span-2 space-y-6">
                  {/* Word display */}
                  <div className="bg-white rounded-2xl border border-[#F0F0F0] p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-semibold text-[#1A1A1A] flex items-center gap-2">
                        <Book size={14} className="text-[#B8A9E8]" /> The word
                      </h3>
                      <div className="flex items-center gap-3 text-[11px] text-[#9B9B9B]">
                        <span className="flex items-center gap-1">
                          <Timer size={11} className="text-[#4ECDC4]" />
                          {gameState === 'idle' ? '—' : `${elapsed}s`}
                        </span>
                        <span className="flex items-center gap-1">
                          <Target size={11} className="text-[#B8A9E8]" />
                          {gameState === 'idle' ? '—' : `${progressPct}%`}
                        </span>
                      </div>
                    </div>

                    {/* Letter slots */}
                    <div className="flex flex-wrap items-center justify-center gap-2 py-6 min-h-[80px]">
                      {gameState === 'idle' && !loading && (
                        <div className="text-[#9B9B9B] text-sm">Choose a difficulty and press Start</div>
                      )}
                      {word && revealed.map((c, i) => {
                        const isRevealed = c !== '_';
                        return (
                          <div key={i} className="flex flex-col items-center justify-end w-9 md:w-11">
                            <span className={`text-2xl md:text-3xl font-bold tabular-nums transition-all duration-200 ${
                              gameState === 'lost' && !guessed.has(c) && /[A-Z]/.test(c) ? 'text-[#FF6B6B]' : 'text-[#1A1A1A]'
                            }`}>
                              {gameState === 'lost' && !isRevealed ? word[i] : (isRevealed ? c : '\u00A0')}
                            </span>
                            <span className="block h-[3px] w-full rounded-full mt-1"
                              style={{
                                backgroundColor: isRevealed ? ACCENT.green : (gameState === 'lost' ? ACCENT.coral : '#E0E0E0')
                              }}
                            />
                          </div>
                        );
                      })}
                    </div>

                    {/* Result banner */}
                    {gameState === 'won' && (
                      <div className="rounded-2xl p-4 border flex items-center gap-3 animate-[fadeIn_300ms_ease-out]"
                        style={{ backgroundColor: ACCENT.green + '15', borderColor: ACCENT.green + '33' }}>
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: ACCENT.green + '25' }}>
                          <Trophy size={16} style={{ color: ACCENT.green }} />
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-semibold text-[#166534]">You won!</div>
                          <div className="text-[11px] text-[#6B6B6B] mt-0.5">
                            Solved in {elapsed}s · {guessed.size} guesses · {wrongCount} misses
                          </div>
                        </div>
                      </div>
                    )}
                    {gameState === 'lost' && (
                      <div className="rounded-2xl p-4 border flex items-center gap-3 animate-[fadeIn_300ms_ease-out]"
                        style={{ backgroundColor: ACCENT.coral + '15', borderColor: ACCENT.coral + '33' }}>
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: ACCENT.coral + '25' }}>
                          <Skull size={16} style={{ color: ACCENT.coral }} />
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-semibold text-[#DC2626]">Game over</div>
                          <div className="text-[11px] text-[#6B6B6B] mt-0.5">
                            The word was <strong className="text-[#1A1A1A]">{word}</strong>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Action bar */}
                  <div className="bg-white rounded-2xl border border-[#F0F0F0] p-5 flex flex-wrap items-center gap-3">
                    {gameState === 'playing' && (
                      <button
                        onClick={useHint}
                        disabled={hintUsed}
                        className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium transition-all duration-200 border ${
                          hintUsed
                            ? 'bg-[#F0F0F0] text-[#9B9B9B] border-transparent cursor-not-allowed'
                            : 'bg-white text-[#1A1A1A] border-[#F0F0F0] hover:border-[#B8A9E8] hover:-translate-y-0.5 hover:shadow-sm'
                        }`}
                        title="Reveals one letter but counts as a miss"
                      >
                        <Lightbulb size={14} className={hintUsed ? 'text-[#9B9B9B]' : 'text-[#F5A623]'} />
                        {hintUsed ? 'Hint used' : 'Use hint (−1 miss)'}
                      </button>
                    )}

                    {(gameState === 'won' || gameState === 'lost') && (
                      <button
                        onClick={() => startGame(difficulty)}
                        disabled={loading}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium bg-[#B8A9E8] text-[#1A1A1A] hover:bg-[#A89AD8] shadow-sm hover:shadow-md transition-all duration-200 disabled:opacity-50"
                      >
                        {loading ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
                        Play again
                      </button>
                    )}

                    {gameState === 'idle' && (
                      <button
                        onClick={() => startGame(difficulty)}
                        disabled={loading}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold bg-[#B8A9E8] text-[#1A1A1A] hover:bg-[#A89AD8] shadow-sm hover:shadow-md transition-all duration-200 disabled:opacity-50"
                      >
                        {loading ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                        Start game
                      </button>
                    )}

                    {gameState === 'playing' && (
                      <button
                        onClick={() => { setGameState('idle'); setWord(''); setGuessed(new Set()); setWrongCount(0); setElapsed(0); }}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium bg-white text-[#6B6B6B] border border-[#F0F0F0] hover:text-[#1A1A1A] hover:border-[#E0E0E0] transition-all duration-200"
                      >
                        <XCircle size={14} className="text-[#FF6B6B]" /> Give up
                      </button>
                    )}

                    <div className="ml-auto text-[11px] text-[#9B9B9B] flex items-center gap-2">
                      <span className="hidden sm:inline">💡 Tap keys or use your keyboard</span>
                    </div>
                  </div>

                  {/* On-screen keyboard */}
                  <div className="bg-white rounded-2xl border border-[#F0F0F0] p-5">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-[#1A1A1A] flex items-center gap-2">
                        <Zap size={14} className="text-[#F5A623]" /> Letters
                      </h3>
                      <span className="text-[11px] text-[#9B9B9B]">{guessed.size} tried</span>
                    </div>
                    <div className="grid grid-cols-7 sm:grid-cols-9 md:grid-cols-13 gap-1.5">
                      {ALPHABET.map(letter => {
                        const isGuessed = guessed.has(letter);
                        const isCorrect = isGuessed && wordLetters.has(letter);
                        const isWrong   = isGuessed && !wordLetters.has(letter);
                        const disabled  = gameState !== 'playing' || isGuessed;

                        let cls = 'bg-white border-[#F0F0F0] text-[#1A1A1A] hover:border-[#B8A9E8] hover:-translate-y-0.5 hover:shadow-sm';
                        let style = {};
                        if (isCorrect) { style = { backgroundColor: ACCENT.green + '20', borderColor: ACCENT.green + '55', color: '#166534' }; cls = ''; }
                        else if (isWrong) { style = { backgroundColor: ACCENT.coral + '15', borderColor: ACCENT.coral + '40', color: '#DC2626' }; cls = ''; }
                        else if (disabled) { cls = 'bg-[#FAFAF8] border-[#F0F0F0] text-[#9B9B9B] cursor-not-allowed'; }

                        return (
                          <button
                            key={letter}
                            onClick={() => guessLetter(letter)}
                            disabled={disabled}
                            style={style}
                            className={`aspect-square rounded-xl border text-sm font-bold transition-all duration-200 ${cls}`}
                          >
                            {letter}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═══════════ STATS TAB ═══════════ */}
          {activeTab === 'stats' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { l: 'Games played', v: stats.played, i: Gamepad2, c: ACCENT.lilac },
                  { l: 'Wins',          v: stats.wins,   i: Trophy,   c: ACCENT.green },
                  { l: 'Losses',        v: stats.losses, i: Skull,    c: ACCENT.coral },
                  { l: 'Win-rate',      v: stats.rate + '%', i: Target, c: ACCENT.amber },
                ].map((s, i) => {
                  const Icon = s.i;
                  return (
                    <div key={i} className="bg-white rounded-2xl border border-[#F0F0F0] p-5 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200">
                      <div className="flex items-center justify-between mb-3">
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: s.c + '15' }}>
                          <Icon size={14} style={{ color: s.c }} />
                        </div>
                        <span className="text-2xl font-bold text-[#1A1A1A]">{s.v}</span>
                      </div>
                      <p className="text-[11px] text-[#9B9B9B] font-medium">{s.l}</p>
                    </div>
                  );
                })}
              </div>

              <div className="bg-white rounded-2xl border border-[#F0F0F0] p-6">
                <h3 className="text-sm font-semibold text-[#1A1A1A] mb-4 flex items-center gap-2">
                  <BarChart3 size={14} className="text-[#4ECDC4]" /> By difficulty
                </h3>
                <div className="space-y-4">
                  {Object.entries(DIFFICULTY).map(([key, d]) => {
                    const b = perDifficultyStats[key] || { played: 0, won: 0 };
                    const winPct = b.played > 0 ? Math.round((b.won / b.played) * 100) : 0;
                    const Icon = d.icon;
                    return (
                      <div key={key}>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ backgroundColor: d.color + '20' }}>
                              <Icon size={11} style={{ color: d.color }} />
                            </div>
                            <span className="text-sm font-medium text-[#1A1A1A]">{d.label}</span>
                            <span className="text-[10px] text-[#9B9B9B]">{d.length} letters</span>
                          </div>
                          <div className="text-[11px] text-[#6B6B6B]">
                            <strong className="text-[#1A1A1A]">{b.won}</strong> / {b.played} · <span style={{ color: d.color }}>{winPct}%</span>
                          </div>
                        </div>
                        <div className="h-2 rounded-full bg-[#F0F0F0] overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-300"
                            style={{ width: `${winPct}%`, backgroundColor: d.color }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-[#F0F0F0] p-6">
                <h3 className="text-sm font-semibold text-[#1A1A1A] mb-4 flex items-center gap-2">
                  <Award size={14} className="text-[#B8A9E8]" /> Recent milestones
                </h3>
                {scoreHistory.length === 0 ? (
                  <div className="text-center py-8">
                    <Trophy size={28} className="mx-auto mb-3 text-[#E0E0E0]" />
                    <p className="text-sm text-[#9B9B9B]">Play your first game to see stats</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {[
                      { label: 'Fastest win',      row: scoreHistory.filter(s => safe(s.result) === 'won').sort((a,b) => Number(a.duration_sec||9e9) - Number(b.duration_sec||9e9))[0], fmt: r => `${r.duration_sec}s`, icon: Timer, c: ACCENT.teal },
                      { label: 'Fewest misses',    row: scoreHistory.filter(s => safe(s.result) === 'won').sort((a,b) => Number(a.wrong_guesses||9e9) - Number(b.wrong_guesses||9e9))[0], fmt: r => `${r.wrong_guesses} misses`, icon: Target, c: ACCENT.green },
                      { label: 'Longest word won', row: scoreHistory.filter(s => safe(s.result) === 'won').sort((a,b) => safe(b.word).length - safe(a.word).length)[0], fmt: r => `${safe(r.word).length} letters`, icon: Book, c: ACCENT.lilac },
                    ].map((m, i) => {
                      const Icon = m.icon;
                      return (
                        <div key={i} className="rounded-xl border border-[#F0F0F0] p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ backgroundColor: m.c + '15' }}>
                              <Icon size={11} style={{ color: m.c }} />
                            </div>
                            <span className="text-[11px] text-[#9B9B9B] font-medium uppercase tracking-wider">{m.label}</span>
                          </div>
                          {m.row ? (
                            <div>
                              <div className="text-lg font-bold text-[#1A1A1A]">{m.fmt(m.row)}</div>
                              <div className="text-[11px] text-[#6B6B6B] mt-0.5 truncate">
                                {safe(m.row.word)} · {safe(m.row.difficulty)}
                              </div>
                            </div>
                          ) : (
                            <div className="text-sm text-[#9B9B9B]">—</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ═══════════ HISTORY TAB ═══════════ */}
          {activeTab === 'history' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-[#1A1A1A]">Recent games</h3>
                  <p className="text-[11px] text-[#9B9B9B] mt-0.5">Your last {Math.min(scoreHistory.length, 50)} sessions</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setScores(loadScores())}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium bg-white text-[#6B6B6B] border border-[#F0F0F0] hover:text-[#1A1A1A] hover:border-[#E0E0E0] transition-all duration-200"
                  >
                    <RefreshCw size={11} /> Refresh
                  </button>
                  {scoreHistory.length > 0 && (
                    <button
                      onClick={clearHistory}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium bg-white text-[#DC2626] border border-[#F0F0F0] hover:border-[#FF6B6B]/40 transition-all duration-200"
                    >
                      <XCircle size={11} /> Clear
                    </button>
                  )}
                </div>
              </div>
              <div className="bg-white rounded-2xl border border-[#F0F0F0] overflow-hidden">
                {scoreHistory.length === 0 ? (
                  <div className="text-center py-16">
                    <History size={28} className="mx-auto mb-3 text-[#E0E0E0]" />
                    <p className="text-sm text-[#9B9B9B]">No games yet — start playing!</p>
                  </div>
                ) : (
                  <div className="divide-y divide-[#F0F0F0]">
                    {scoreHistory.map((row, i) => {
                      const won = safe(row.result) === 'won';
                      const d = DIFFICULTY[safe(row.difficulty)] || DIFFICULTY.medium;
                      const DIcon = d.icon;
                      return (
                        <div key={row.id || i} className="flex items-center gap-3 px-5 py-3.5 hover:bg-[#FAFAF8] transition-colors duration-150">
                          <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                            style={{ backgroundColor: (won ? ACCENT.green : ACCENT.coral) + '15' }}>
                            {won ? <Trophy size={13} style={{ color: ACCENT.green }} /> : <Skull size={13} style={{ color: ACCENT.coral }} />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-mono font-semibold text-[#1A1A1A] tracking-wider">
                                {safe(row.word).toUpperCase()}
                              </span>
                              <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wide border"
                                style={{ backgroundColor: d.color + '1A', color: d.textColor, borderColor: d.color + '33' }}>
                                {safe(row.difficulty)}
                              </span>
                            </div>
                            <div className="text-[11px] text-[#9B9B9B] mt-0.5 flex items-center gap-2 flex-wrap">
                              <DIcon size={10} style={{ color: d.color }} />
                              <span>{row.wrong_guesses} misses</span>
                              <span>·</span>
                              <span>{row.total_guesses} guesses</span>
                              <span>·</span>
                              <span>{row.duration_sec}s</span>
                              {row.played_at && (
                                <>
                                  <span>·</span>
                                  <span>{new Date(row.played_at).toLocaleString()}</span>
                                </>
                              )}
                            </div>
                          </div>
                          <span className="text-[10px] px-2.5 py-0.5 rounded-full font-semibold uppercase tracking-wide border"
                            style={won
                              ? { backgroundColor: ACCENT.green + '1A', color: '#166534', borderColor: ACCENT.green + '33' }
                              : { backgroundColor: ACCENT.coral + '1A', color: '#DC2626', borderColor: ACCENT.coral + '33' }}>
                            {won ? 'Won' : 'Lost'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}} />
    </div>
  );
}
