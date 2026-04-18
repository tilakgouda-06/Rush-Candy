import { useState, useEffect, useCallback, useRef, memo } from "react";

// ─────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────
const COLS = 8;
const ROWS = 8;
const SIZE = COLS * ROWS;

const CANDY_TYPES = [
  { emoji: "🍬", color: "#ff6eb4", glow: "#ff3cac", name: "Pink Candy" },
  { emoji: "🍭", color: "#b44fff", glow: "#7b00ff", name: "Lollipop" },
  { emoji: "🍫", color: "#c0783a", glow: "#ff9a3c", name: "Chocolate" },
  { emoji: "🍩", color: "#ff9f43", glow: "#ff6b00", name: "Donut" },
  { emoji: "🍪", color: "#e8c07d", glow: "#d4a017", name: "Cookie" },
  { emoji: "🍒", color: "#e84040", glow: "#c0000e", name: "Cherry" },
  { emoji: "🍓", color: "#ff4f6d", glow: "#d6003b", name: "Strawberry" },
  { emoji: "🧁", color: "#c490e4", glow: "#8f00d4", name: "Cupcake" },
];

const SPECIAL = { STRIPED_H: "H", STRIPED_V: "V", BOMB: "B", COLOR_BOMB: "C" };
const STATIC_OTP = "1234";
const MAX_ITER = 80;
const COMBO_LABELS = ["", "", "Nice! 🔥", "Great! ⚡", "Awesome!! 💥", "LEGENDARY!!! 🌟"];

// ─────────────────────────────────────────────
// LEVELS CONFIG
// ─────────────────────────────────────────────
const LEVELS = [
  { level: 1, target: 300,  moves: 25, candyTypes: 4, blockers: 0,  label: "Sugar Rush",    stars: [150, 250, 300],   color: "#ff6eb4" },
  { level: 2, target: 500,  moves: 22, candyTypes: 5, blockers: 2,  label: "Candy Storm",   stars: [250, 400, 500],   color: "#b44fff" },
  { level: 3, target: 800,  moves: 20, candyTypes: 5, blockers: 4,  label: "Sweet Chaos",   stars: [400, 650, 800],   color: "#ff9f43" },
  { level: 4, target: 1100, moves: 18, candyTypes: 6, blockers: 5,  label: "Jelly Jungle",  stars: [550, 900, 1100],  color: "#00d4ff" },
  { level: 5, target: 1500, moves: 17, candyTypes: 6, blockers: 6,  label: "Lollipop Lane", stars: [750, 1200, 1500], color: "#ff6eb4" },
  { level: 6, target: 2000, moves: 16, candyTypes: 7, blockers: 7,  label: "Choco Madness", stars: [1000,1600,2000],  color: "#c0783a" },
  { level: 7, target: 2700, moves: 15, candyTypes: 7, blockers: 8,  label: "Berry Blitz",   stars: [1350,2200,2700],  color: "#e84040" },
  { level: 8, target: 3500, moves: 14, candyTypes: 8, blockers: 8,  label: "Cupcake Craze", stars: [1750,2800,3500],  color: "#c490e4" },
  { level: 9, target: 4500, moves: 13, candyTypes: 8, blockers: 9,  label: "Donut Doom",    stars: [2250,3600,4500],  color: "#ff9f43" },
  { level:10, target: 6000, moves: 12, candyTypes: 8, blockers:10,  label: "Ultimate Rush",  stars: [3000,5000,6000],  color: "#ffd700" },
];

// ─────────────────────────────────────────────
// GAME LOGIC
// ─────────────────────────────────────────────
function idx(r, c) { return r * COLS + c; }
function rowOf(i) { return Math.floor(i / COLS); }
function colOf(i) { return i % COLS; }
function isAdjacent(a, b) {
  return (Math.abs(rowOf(a) - rowOf(b)) + Math.abs(colOf(a) - colOf(b))) === 1;
}
function randCandy(n) { return CANDY_TYPES[Math.floor(Math.random() * n)].emoji; }
function makeCell(candy, special = null, blocked = false) {
  return { candy, special, blocked, id: Math.random().toString(36).slice(2, 8) };
}
function hexToRgb(hex) {
  return `${parseInt(hex.slice(1,3),16)},${parseInt(hex.slice(3,5),16)},${parseInt(hex.slice(5,7),16)}`;
}

function findMatches(board) {
  const matched = new Set();
  const groups = [];
  for (let r = 0; r < ROWS; r++) {
    let c = 0;
    while (c < COLS) {
      const cell = board[idx(r, c)];
      if (!cell || cell.blocked) { c++; continue; }
      let len = 1;
      while (c + len < COLS) {
        const nx = board[idx(r, c + len)];
        if (nx && !nx.blocked && nx.candy === cell.candy) len++;
        else break;
      }
      if (len >= 3) {
        const g = Array.from({length: len}, (_, k) => idx(r, c + k));
        g.forEach(i => matched.add(i));
        groups.push({ indices: g, dir: "H", len });
      }
      c += len;
    }
  }
  for (let c = 0; c < COLS; c++) {
    let r = 0;
    while (r < ROWS) {
      const cell = board[idx(r, c)];
      if (!cell || cell.blocked) { r++; continue; }
      let len = 1;
      while (r + len < ROWS) {
        const nx = board[idx(r + len, c)];
        if (nx && !nx.blocked && nx.candy === cell.candy) len++;
        else break;
      }
      if (len >= 3) {
        const g = Array.from({length: len}, (_, k) => idx(r + k, c));
        g.forEach(i => matched.add(i));
        groups.push({ indices: g, dir: "V", len });
      }
      r += len;
    }
  }
  return { matched, groups };
}

function explodeSpecial(board, i) {
  const toRm = new Set();
  const cell = board[i];
  if (!cell) return toRm;
  if (cell.special === SPECIAL.STRIPED_H) {
    const r = rowOf(i); for (let c = 0; c < COLS; c++) toRm.add(idx(r, c));
  } else if (cell.special === SPECIAL.STRIPED_V) {
    const c = colOf(i); for (let r = 0; r < ROWS; r++) toRm.add(idx(r, c));
  } else if (cell.special === SPECIAL.BOMB) {
    const r = rowOf(i), c = colOf(i);
    for (let dr = -2; dr <= 2; dr++)
      for (let dc = -2; dc <= 2; dc++) {
        const nr = r + dr, nc = c + dc;
        if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) toRm.add(idx(nr, nc));
      }
  } else if (cell.special === SPECIAL.COLOR_BOMB) {
    const target = board.find((c, j) => j !== i && c && !c.blocked)?.candy;
    if (target) board.forEach((c, j) => { if (c && c.candy === target) toRm.add(j); });
  }
  return toRm;
}

function applyGravity(board) {
  const next = [...board];
  for (let c = 0; c < COLS; c++) {
    let w = ROWS - 1;
    for (let r = ROWS - 1; r >= 0; r--) {
      const cell = next[idx(r, c)];
      if (cell !== null) { next[idx(w, c)] = cell; if (w !== r) next[idx(r, c)] = null; w--; }
    }
    for (let r = w; r >= 0; r--) next[idx(r, c)] = null;
  }
  return next;
}

function refill(board, n) {
  return board.map(cell => cell === null ? makeCell(randCandy(n)) : cell);
}

function resolveBoard(boardIn, candyTypes) {
  let board = [...boardIn];
  let totalScore = 0;
  let combo = 0;
  let iter = 0;
  while (iter++ < MAX_ITER) {
    const { matched, groups } = findMatches(board);
    if (matched.size === 0) break;
    combo++;
    const mult = Math.min(combo, 5);
    const specialMap = new Map();
    for (const g of groups) {
      if (g.len === 5) specialMap.set(g.indices[2], SPECIAL.COLOR_BOMB);
      else if (g.len === 4) specialMap.set(g.indices[2], g.dir === "H" ? SPECIAL.STRIPED_H : SPECIAL.STRIPED_V);
      else if (g.len === 3 && groups.filter(x => x.indices.some(i => g.indices.includes(i))).length > 1)
        specialMap.set(g.indices[1], SPECIAL.BOMB);
    }
    const allRm = new Set(matched);
    for (const i of matched) {
      if (board[i]?.special) { const ex = explodeSpecial(board, i); ex.forEach(j => allRm.add(j)); }
    }
    let gain = 0;
    allRm.forEach(i => { if (board[i] && !board[i].blocked) gain += 10; });
    totalScore += gain * mult;
    const next = board.map((cell, i) => {
      if (allRm.has(i) && cell && !cell.blocked) {
        return specialMap.has(i) ? makeCell(cell.candy, specialMap.get(i)) : null;
      }
      return cell;
    });
    board = refill(applyGravity(next), candyTypes);
  }
  return { board, score: totalScore, combo: combo - 1 };
}

function hasValidMoves(board) {
  for (let i = 0; i < SIZE; i++) {
    for (const j of [i + 1, i + COLS]) {
      if (j >= SIZE || !isAdjacent(i, j)) continue;
      const s = [...board]; [s[i], s[j]] = [s[j], s[i]];
      if (findMatches(s).matched.size > 0) return true;
    }
  }
  return false;
}

function buildBoard(candyTypes, blockers) {
  let board, iter = 0;
  do {
    board = Array.from({ length: SIZE }, (_, i) =>
      i < blockers ? makeCell("🔒", null, true) : makeCell(randCandy(candyTypes))
    );
    board = resolveBoard(board, candyTypes).board;
    iter++;
  } while (!hasValidMoves(board) && iter < 20);
  return board;
}

// ─────────────────────────────────────────────
// STORAGE
// ─────────────────────────────────────────────
function loadData() {
  try {
    const d = localStorage.getItem("rushcandy_v3");
    return d ? JSON.parse(d) : null;
  } catch { return null; }
}
function saveData(d) {
  try { localStorage.setItem("rushcandy_v3", JSON.stringify(d)); } catch {}
}

// ─────────────────────────────────────────────
// FLOATING PARTICLES BACKGROUND
// ─────────────────────────────────────────────
function FloatingCandies({ count = 8 }) {
  const candies = ["🍬","🍭","🍫","🍩","🍪","🍒","🍓","🧁","🍬","🍭"];
  return (
    <div style={{ position: "fixed", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 0 }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{
          position: "absolute",
          fontSize: 24 + (i % 4) * 10,
          opacity: 0.06 + (i % 3) * 0.02,
          left: `${(i * 11 + 5) % 94}%`,
          top: `${(i * 16 + 7) % 88}%`,
          animation: `floatBg ${5 + (i % 5)}s ease-in-out infinite alternate`,
          animationDelay: `${(i * 0.55) % 3}s`,
        }}>{candies[i % candies.length]}</div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
// LOGIN SCREEN
// ─────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [phone, setPhone] = useState("");
  const [focused, setFocused] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => { const t = setTimeout(() => setVisible(true), 60); return () => clearTimeout(t); }, []);

  const handleContinue = () => {
    if (phone.length < 10) { setError("Please enter a valid 10-digit number"); return; }
    setLoading(true);
    setError("");
    setTimeout(() => {
      setLoading(false);
      onLogin(phone);
    }, 1200);
  };

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "radial-gradient(ellipse at 30% 20%, #3d0070 0%, transparent 55%), radial-gradient(ellipse at 75% 80%, #001a6e 0%, transparent 55%), #0d001f",
      padding: "20px", fontFamily: "'Nunito', 'Segoe UI', sans-serif",
    }}>
      <FloatingCandies count={10} />
      <div style={{
        background: "rgba(255,255,255,0.06)",
        border: "1px solid rgba(255,255,255,0.13)",
        borderRadius: 28, padding: "48px 36px",
        width: "100%", maxWidth: 400,
        backdropFilter: "blur(24px)", textAlign: "center",
        position: "relative", zIndex: 1,
        boxShadow: "0 40px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)",
        transform: visible ? "translateY(0)" : "translateY(28px)",
        opacity: visible ? 1 : 0,
        transition: "all 0.5s cubic-bezier(0.34,1.56,0.64,1)",
      }}>
        <div style={{ fontSize: 68, animation: "floatLogo 2.5s ease-in-out infinite alternate", display: "inline-block", marginBottom: 6 }}>🍬</div>
        <h1 style={{
          fontSize: 42, fontWeight: 900, margin: "0 0 4px", letterSpacing: -1.5,
          background: "linear-gradient(135deg, #fff 30%, #ff6eb4)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
        }}>Rush Candy</h1>
        <p style={{ color: "rgba(255,255,255,0.38)", fontWeight: 800, letterSpacing: 3, fontSize: 11, margin: "0 0 36px", textTransform: "uppercase" }}>
          Match · Crush · Win
        </p>

        <p style={{ color: "rgba(255,255,255,0.55)", marginBottom: 18, fontSize: 14, fontWeight: 600 }}>
          Enter your mobile number to play
        </p>

        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <div style={{
            background: "rgba(255,255,255,0.08)", border: "1.5px solid rgba(255,255,255,0.14)",
            borderRadius: 14, padding: "14px", color: "rgba(255,255,255,0.7)",
            fontWeight: 900, fontSize: 14, flexShrink: 0, display: "flex", alignItems: "center", gap: 6,
          }}>🇮🇳 +91</div>
          <input
            type="tel" value={phone}
            onChange={e => { setPhone(e.target.value.replace(/\D/g,"").slice(0,10)); setError(""); }}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={e => e.key === "Enter" && handleContinue()}
            placeholder="Mobile Number"
            style={{
              flex: 1, background: "rgba(255,255,255,0.08)",
              border: focused ? "2px solid #ff6eb4" : "1.5px solid rgba(255,255,255,0.14)",
              borderRadius: 14, padding: "14px 16px", color: "#fff", fontSize: 16, fontWeight: 700,
              outline: "none", fontFamily: "inherit",
              boxShadow: focused ? "0 0 16px rgba(255,110,180,0.3)" : "none",
              transition: "all 0.2s",
            }}
          />
        </div>

        {/* Progress indicator */}
        <div style={{ height: 3, background: "rgba(255,255,255,0.08)", borderRadius: 99, marginBottom: 18, overflow: "hidden" }}>
          <div style={{
            height: "100%", width: `${(phone.length / 10) * 100}%`,
            background: phone.length === 10 ? "linear-gradient(90deg,#00ff88,#00d4ff)" : "linear-gradient(90deg,#ff6eb4,#b44fff)",
            borderRadius: 99, transition: "width 0.2s ease, background 0.3s ease",
          }} />
        </div>

        {error && (
          <div style={{
            color: "#ff6b6b", fontSize: 13, marginBottom: 14,
            background: "rgba(255,107,107,0.1)", borderRadius: 10, padding: "8px 14px",
            border: "1px solid rgba(255,107,107,0.2)", animation: "shake 0.4s ease",
          }}>{error}</div>
        )}

        <button onClick={handleContinue} disabled={loading} style={{
          width: "100%", padding: "17px", borderRadius: 99, border: "none",
          background: loading ? "rgba(180,79,255,0.35)" : "linear-gradient(135deg, #ff6eb4, #b44fff)",
          color: "#fff", fontWeight: 900, fontSize: 17, cursor: loading ? "wait" : "pointer",
          fontFamily: "inherit",
          boxShadow: loading ? "none" : "0 6px 28px rgba(180,79,255,0.5), inset 0 1px 0 rgba(255,255,255,0.2)",
          transition: "all 0.25s",
        }}>
          {loading
            ? <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <span style={{ animation: "spin 0.8s linear infinite", display: "inline-block" }}>⏳</span>
                Sending OTP…
              </span>
            : "Continue →"}
        </button>
        <p style={{ color: "rgba(255,255,255,0.22)", fontSize: 12, marginTop: 20, lineHeight: 1.5 }}>
          By continuing you agree to our Terms of Service
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// OTP SCREEN
// ─────────────────────────────────────────────
function OTPScreen({ phone, onVerify, onBack }) {
  const [otp, setOtp] = useState(["", "", "", ""]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);
  const [resendTimer, setResendTimer] = useState(30);
  const [visible, setVisible] = useState(false);
  const refs = [useRef(), useRef(), useRef(), useRef()];

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 60);
    const f = setTimeout(() => refs[0].current?.focus(), 220);
    return () => { clearTimeout(t); clearTimeout(f); };
  }, []);

  useEffect(() => {
    if (resendTimer <= 0) return;
    const t = setTimeout(() => setResendTimer(v => v - 1), 1000);
    return () => clearTimeout(t);
  }, [resendTimer]);

  const handleChange = (i, val) => {
    const v = val.replace(/\D/g, "").slice(-1);
    const next = [...otp]; next[i] = v;
    setOtp(next); setError("");
    if (v && i < 3) setTimeout(() => refs[i + 1].current?.focus(), 30);
    if (next.every(d => d) && i === 3) setTimeout(() => verifyOtp(next), 80);
  };

  const handleKeyDown = (i, e) => {
    if (e.key === "Backspace") {
      if (!otp[i] && i > 0) { refs[i - 1].current?.focus(); }
      else { const next = [...otp]; next[i] = ""; setOtp(next); }
    }
    if (e.key === "ArrowLeft" && i > 0) refs[i - 1].current?.focus();
    if (e.key === "ArrowRight" && i < 3) refs[i + 1].current?.focus();
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 4);
    if (pasted.length === 4) {
      const next = pasted.split("");
      setOtp(next);
      refs[3].current?.focus();
      setTimeout(() => verifyOtp(next), 80);
    }
  };

  const verifyOtp = (digits = otp) => {
    if (digits.join("").length < 4) { setError("Enter all 4 digits"); return; }
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      if (digits.join("") === STATIC_OTP) {
        onVerify();
      } else {
        setShake(true);
        setError("Wrong OTP. Hint: 1234 😉");
        setOtp(["", "", "", ""]);
        setTimeout(() => { setShake(false); refs[0].current?.focus(); }, 600);
      }
    }, 800);
  };

  const filled = otp.filter(Boolean).length;

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "radial-gradient(ellipse at 60% 15%, #00316e 0%, transparent 55%), radial-gradient(ellipse at 25% 85%, #3d0070 0%, transparent 55%), #0d001f",
      padding: "20px", fontFamily: "'Nunito', 'Segoe UI', sans-serif",
    }}>
      <FloatingCandies count={8} />
      <div style={{
        background: "rgba(255,255,255,0.06)",
        border: "1px solid rgba(255,255,255,0.13)",
        borderRadius: 28, padding: "48px 36px",
        width: "100%", maxWidth: 400,
        backdropFilter: "blur(24px)", textAlign: "center",
        position: "relative", zIndex: 1,
        boxShadow: "0 40px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)",
        transform: visible ? "translateY(0)" : "translateY(28px)",
        opacity: visible ? 1 : 0,
        transition: "all 0.5s cubic-bezier(0.34,1.56,0.64,1)",
      }}>
        <div style={{ fontSize: 56, marginBottom: 10, animation: "floatLogo 2.5s ease-in-out infinite alternate", display: "inline-block" }}>🔐</div>
        <h2 style={{ fontSize: 30, fontWeight: 900, color: "#fff", margin: "0 0 8px" }}>Verify OTP</h2>
        <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 14, margin: "0 0 10px" }}>
          Code sent to <span style={{ color: "#ff6eb4", fontWeight: 900 }}>+91 {phone}</span>
        </p>
        <div style={{
          display: "inline-block", background: "rgba(255,215,0,0.12)",
          border: "1px solid rgba(255,215,0,0.3)", borderRadius: 10,
          padding: "5px 14px", marginBottom: 28, fontSize: 12, fontWeight: 800, color: "#ffd700",
        }}>
          🎯 Demo OTP: 1234
        </div>

        {/* OTP boxes */}
        <div style={{
          display: "flex", gap: 12, justifyContent: "center", marginBottom: 20,
          animation: shake ? "shake 0.4s ease" : "none",
        }}>
          {[0,1,2,3].map(i => (
            <input
              key={i} ref={refs[i]}
              maxLength={1} value={otp[i]}
              onChange={e => handleChange(i, e.target.value)}
              onKeyDown={e => handleKeyDown(i, e)}
              onPaste={handlePaste}
              style={{
                width: 62, height: 72, textAlign: "center", fontSize: 30, fontWeight: 900,
                background: otp[i] ? "rgba(180,79,255,0.22)" : "rgba(255,255,255,0.07)",
                border: otp[i] ? "2px solid #b44fff" : "1.5px solid rgba(255,255,255,0.18)",
                borderRadius: 18, color: "#fff", outline: "none", fontFamily: "inherit",
                boxShadow: otp[i] ? "0 0 20px rgba(180,79,255,0.45)" : "none",
                transition: "all 0.2s", caretColor: "transparent",
              }}
            />
          ))}
        </div>

        {/* Dot progress */}
        <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 16 }}>
          {[0,1,2,3].map(i => (
            <div key={i} style={{
              width: 8, height: 8, borderRadius: "50%",
              background: i < filled ? "#b44fff" : "rgba(255,255,255,0.15)",
              boxShadow: i < filled ? "0 0 8px #b44fff" : "none",
              transition: "all 0.2s",
            }} />
          ))}
        </div>

        {error && (
          <div style={{
            color: "#ff6b6b", fontSize: 13, marginBottom: 16,
            background: "rgba(255,107,107,0.1)", borderRadius: 10, padding: "8px 14px",
            border: "1px solid rgba(255,107,107,0.2)",
          }}>{error}</div>
        )}

        <button
          onClick={() => verifyOtp()}
          disabled={loading || filled < 4}
          style={{
            width: "100%", padding: "17px", borderRadius: 99, border: "none",
            background: filled < 4 ? "rgba(180,79,255,0.2)" : "linear-gradient(135deg, #b44fff, #ff6eb4)",
            color: filled < 4 ? "rgba(255,255,255,0.35)" : "#fff",
            fontWeight: 900, fontSize: 17, cursor: filled < 4 ? "not-allowed" : "pointer",
            fontFamily: "inherit",
            boxShadow: filled === 4 ? "0 6px 28px rgba(180,79,255,0.5)" : "none",
            transition: "all 0.25s", marginBottom: 16,
          }}
        >
          {loading ? "Verifying…" : "Verify & Play 🎮"}
        </button>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <button onClick={onBack} style={{
            background: "none", border: "none", color: "rgba(255,255,255,0.4)",
            cursor: "pointer", fontSize: 13, fontFamily: "inherit", fontWeight: 700,
          }}>← Change number</button>
          {resendTimer > 0 ? (
            <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 13, fontWeight: 700 }}>
              Resend in {resendTimer}s
            </span>
          ) : (
            <button onClick={() => setResendTimer(30)} style={{
              background: "none", border: "none", color: "#ff6eb4",
              cursor: "pointer", fontSize: 13, fontFamily: "inherit", fontWeight: 800,
            }}>Resend OTP</button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// PROFILE / DASHBOARD SCREEN
// ─────────────────────────────────────────────
function ProfileScreen({ profile, onPlay, onLogout }) {
  const unlockedCount = LEVELS.filter((_, i) => i < profile.maxLevel).length;
  const avatarEmojis = ["👑","🎯","⚡","🔥","💎","🌟","🏆","🎮"];
  const avatar = avatarEmojis[parseInt(profile.phone.slice(-1)) % 8];
  const [visible, setVisible] = useState(false);
  const totalStars = Object.values(profile.levelStars || {}).reduce((a, b) => a + b, 0);

  useEffect(() => { const t = setTimeout(() => setVisible(true), 60); return () => clearTimeout(t); }, []);

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "radial-gradient(ellipse at 25% 25%, #3d0070 0%, transparent 55%), radial-gradient(ellipse at 80% 75%, #001a6e 0%, transparent 55%), #0d001f",
      padding: "20px", fontFamily: "'Nunito', 'Segoe UI', sans-serif",
    }}>
      <FloatingCandies count={9} />
      <div style={{
        width: "100%", maxWidth: 420, position: "relative", zIndex: 1,
        transform: visible ? "translateY(0)" : "translateY(28px)",
        opacity: visible ? 1 : 0,
        transition: "all 0.5s cubic-bezier(0.34,1.56,0.64,1)",
      }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 70, marginBottom: 8, animation: "floatLogo 3s ease-in-out infinite alternate", display: "inline-block" }}>🍬</div>
          <h1 style={{
            fontSize: 34, fontWeight: 900, margin: "0 0 4px",
            background: "linear-gradient(135deg, #fff 30%, #ff6eb4)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          }}>Rush Candy</h1>
          <p style={{ color: "rgba(255,255,255,0.32)", fontSize: 10, fontWeight: 800, letterSpacing: 3, margin: 0, textTransform: "uppercase" }}>
            Player Dashboard
          </p>
        </div>

        <div style={{
          background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 24, padding: 26, backdropFilter: "blur(20px)", marginBottom: 14,
          boxShadow: "0 20px 60px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.08)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 22 }}>
            <div style={{
              width: 74, height: 74, borderRadius: "50%",
              background: "linear-gradient(135deg, #ff6eb4, #7b00ff)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 36, flexShrink: 0,
              boxShadow: "0 0 0 3px rgba(255,255,255,0.1), 0 0 28px rgba(255,110,180,0.5)",
            }}>{avatar}</div>
            <div style={{ flex: 1 }}>
              <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 10, fontWeight: 800, letterSpacing: 2, marginBottom: 3, textTransform: "uppercase" }}>Player</div>
              <div style={{ color: "#fff", fontSize: 18, fontWeight: 900, marginBottom: 5 }}>
                +91 {profile.phone.slice(0,5)} {profile.phone.slice(5)}
              </div>
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                background: "rgba(255,215,0,0.12)", border: "1px solid rgba(255,215,0,0.25)",
                borderRadius: 99, padding: "3px 10px",
              }}>
                <span style={{ fontSize: 12 }}>⭐</span>
                <span style={{ color: "#ffd700", fontSize: 13, fontWeight: 900 }}>Level {profile.maxLevel} Player</span>
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            {[
              { label: "Best Score", value: (profile.highScore || 0).toLocaleString(), emoji: "🏆", color: "#ffd700" },
              { label: "Levels Done", value: `${unlockedCount}/10`, emoji: "🗺️", color: "#00d4ff" },
              { label: "Total Stars", value: `${totalStars} ⭐`, emoji: "✨", color: "#ff6eb4" },
            ].map(s => (
              <div key={s.label} style={{
                background: "rgba(255,255,255,0.05)", borderRadius: 16, padding: "15px 8px",
                textAlign: "center", border: "1px solid rgba(255,255,255,0.07)",
              }}>
                <div style={{ fontSize: 22, marginBottom: 5 }}>{s.emoji}</div>
                <div style={{ color: s.color, fontWeight: 900, fontSize: 15, marginBottom: 2 }}>{s.value}</div>
                <div style={{ color: "rgba(255,255,255,0.32)", fontSize: 9, fontWeight: 800, letterSpacing: 0.8, textTransform: "uppercase" }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        <button onClick={onPlay} style={{
          width: "100%", padding: "19px", borderRadius: 99, border: "none",
          background: "linear-gradient(135deg, #ff6eb4, #b44fff)",
          color: "#fff", fontWeight: 900, fontSize: 20, cursor: "pointer",
          fontFamily: "inherit", marginBottom: 12,
          boxShadow: "0 8px 32px rgba(180,79,255,0.5), inset 0 1px 0 rgba(255,255,255,0.2)",
          transition: "all 0.2s",
        }}>🎮 Start Playing</button>
        <button onClick={onLogout} style={{
          width: "100%", padding: "14px", borderRadius: 99,
          border: "1px solid rgba(255,255,255,0.12)",
          background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.45)",
          fontWeight: 800, fontSize: 15, cursor: "pointer", fontFamily: "inherit", transition: "all 0.2s",
        }}>Logout</button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// LEVEL SELECT SCREEN
// ─────────────────────────────────────────────
function LevelSelect({ profile, onSelect, onBack }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => { const t = setTimeout(() => setVisible(true), 60); return () => clearTimeout(t); }, []);
  const completedCount = LEVELS.filter(lv => lv.level < profile.maxLevel).length;

  return (
    <div style={{
      minHeight: "100vh",
      background: "radial-gradient(ellipse at 20% 10%, #3d0070 0%, transparent 55%), radial-gradient(ellipse at 85% 90%, #001a6e 0%, transparent 55%), #0d001f",
      padding: "16px 14px 30px", fontFamily: "'Nunito', 'Segoe UI', sans-serif",
    }}>
      <FloatingCandies count={6} />
      <div style={{
        maxWidth: 500, margin: "0 auto", position: "relative", zIndex: 1,
        transform: visible ? "translateY(0)" : "translateY(18px)",
        opacity: visible ? 1 : 0, transition: "all 0.4s ease",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 22, paddingTop: 6 }}>
          <button onClick={onBack} style={{
            background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.13)",
            borderRadius: 50, width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", fontSize: 20, cursor: "pointer", flexShrink: 0, transition: "all 0.2s",
          }}>←</button>
          <div>
            <h2 style={{ color: "#fff", fontSize: 26, fontWeight: 900, margin: "0 0 2px" }}>Choose Level</h2>
            <p style={{ color: "rgba(255,255,255,0.38)", fontSize: 13, margin: 0, fontWeight: 700 }}>
              {completedCount} of 10 completed
            </p>
          </div>
          <div style={{
            marginLeft: "auto", display: "flex", alignItems: "center", gap: 5,
            background: "rgba(255,215,0,0.1)", border: "1px solid rgba(255,215,0,0.22)",
            borderRadius: 99, padding: "6px 14px", flexShrink: 0,
          }}>
            <span>⭐</span>
            <span style={{ color: "#ffd700", fontWeight: 900, fontSize: 15 }}>
              {Object.values(profile.levelStars || {}).reduce((a, b) => a + b, 0)}
            </span>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 11 }}>
          {LEVELS.map((lv, i) => {
            const locked = lv.level > profile.maxLevel;
            const completed = lv.level < profile.maxLevel;
            const current = lv.level === profile.maxLevel;
            const stars = profile.levelStars?.[lv.level] || 0;

            return (
              <div key={lv.level}
                onClick={() => !locked && onSelect(lv.level)}
                style={{
                  background: locked
                    ? "rgba(255,255,255,0.03)"
                    : current
                    ? `linear-gradient(135deg, rgba(${hexToRgb(lv.color)},0.2), rgba(${hexToRgb(lv.color)},0.06))`
                    : "rgba(255,255,255,0.06)",
                  border: current
                    ? `2px solid ${lv.color}99`
                    : completed
                    ? "1px solid rgba(0,255,136,0.18)"
                    : "1px solid rgba(255,255,255,0.07)",
                  borderRadius: 20, padding: 17,
                  cursor: locked ? "not-allowed" : "pointer",
                  opacity: locked ? 0.42 : 1,
                  transition: "all 0.2s",
                  position: "relative", overflow: "hidden",
                  backdropFilter: "blur(10px)",
                  boxShadow: current ? `0 0 22px ${lv.color}28` : "none",
                }}>

                {current && (
                  <div style={{
                    position: "absolute", top: 8, right: 8,
                    background: lv.color, borderRadius: 99, padding: "2px 9px",
                    fontSize: 10, fontWeight: 900, color: "#000",
                    boxShadow: `0 0 10px ${lv.color}`,
                  }}>▶ PLAY</div>
                )}
                {completed && !current && (
                  <div style={{
                    position: "absolute", top: 8, right: 8,
                    background: "rgba(0,255,136,0.15)", borderRadius: 99, padding: "2px 8px",
                    fontSize: 9, fontWeight: 900, color: "#00ff88",
                  }}>✓</div>
                )}

                <div style={{
                  width: 38, height: 38, borderRadius: 10,
                  background: locked ? "rgba(255,255,255,0.05)" : `rgba(${hexToRgb(lv.color)},0.18)`,
                  border: `1px solid ${locked ? "rgba(255,255,255,0.07)" : lv.color + "44"}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 16, fontWeight: 900, color: locked ? "rgba(255,255,255,0.25)" : lv.color,
                  marginBottom: 9,
                }}>
                  {locked ? "🔒" : lv.level}
                </div>

                <div style={{ color: "#fff", fontWeight: 900, fontSize: 15, marginBottom: 2 }}>Level {lv.level}</div>
                <div style={{ color: "rgba(255,255,255,0.42)", fontSize: 12, fontWeight: 700, marginBottom: 8 }}>{lv.label}</div>

                {!locked && (
                  <>
                    <div style={{ display: "flex", gap: 2, marginBottom: 5 }}>
                      {[1,2,3].map(s => (
                        <span key={s} style={{
                          fontSize: 13, opacity: s <= stars ? 1 : 0.18,
                          filter: s <= stars ? "drop-shadow(0 0 4px #ffd700)" : "none",
                        }}>⭐</span>
                      ))}
                    </div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.28)", fontWeight: 700 }}>
                      🎯 {lv.target.toLocaleString()} · {lv.moves} moves
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// CANDY CELL COMPONENT
// ─────────────────────────────────────────────
const CandyCell = memo(function CandyCell({ cell, index, isSelected, isHinted, isExploding, onClick, onDragStart, onDragEnd, onDragOver, onDrop, onTouchStart, onTouchMove, onTouchEnd }) {
  if (!cell) return <div style={{ aspectRatio: "1" }} />;
  const ct = CANDY_TYPES.find(c => c.emoji === cell.candy);
  const glow = ct?.glow || "#fff";
  const color = ct?.color || "#fff";
  const specialBadge = cell.special === SPECIAL.STRIPED_H ? "↔"
    : cell.special === SPECIAL.STRIPED_V ? "↕"
    : cell.special === SPECIAL.BOMB ? "💥"
    : cell.special === SPECIAL.COLOR_BOMB ? "🌈" : null;

  return (
    <div
      data-cell-idx={index}
      onClick={() => onClick(index)}
      draggable={!cell.blocked}
      onDragStart={e => onDragStart(e, index)}
      onDragEnd={onDragEnd}
      onDragOver={e => { e.preventDefault(); onDragOver(index); }}
      onDrop={e => { e.preventDefault(); onDrop(index); }}
      onTouchStart={e => onTouchStart(e, index)}
      onTouchMove={e => onTouchMove(e, index)}
      onTouchEnd={e => onTouchEnd(e, index)}
      style={{
        aspectRatio: "1",
        display: "flex", alignItems: "center", justifyContent: "center",
        borderRadius: 10, cursor: cell.blocked ? "not-allowed" : "pointer",
        position: "relative",
        background: cell.blocked
          ? "rgba(80,50,20,0.4)"
          : isSelected
          ? `rgba(${hexToRgb(color)},0.38)`
          : isHinted
          ? "rgba(255,215,0,0.22)"
          : "rgba(255,255,255,0.07)",
        border: isSelected
          ? `2px solid ${color}`
          : isHinted
          ? "2px solid #ffd700"
          : cell.special
          ? `1.5px solid ${glow}55`
          : "1.5px solid rgba(255,255,255,0.09)",
        boxShadow: isSelected
          ? `0 0 16px ${glow}, 0 0 0 2px ${color}`
          : isHinted
          ? "0 0 14px #ffd700"
          : cell.special
          ? `0 0 10px ${glow}88`
          : "none",
        transform: isSelected ? "scale(1.15)" : isExploding ? "scale(0) rotate(10deg)" : "scale(1)",
        opacity: isExploding ? 0 : 1,
        transition: isExploding ? "all 0.18s ease" : "transform 0.15s ease, box-shadow 0.15s ease",
        userSelect: "none", WebkitUserSelect: "none", WebkitTapHighlightColor: "transparent",
        touchAction: "none",
      }}
    >
      <span style={{
        fontSize: "clamp(15px, 4vw, 29px)", lineHeight: 1,
        filter: `drop-shadow(0 0 ${cell.special ? "8px" : "3px"} ${glow}${cell.special ? "cc" : "55"})`,
        pointerEvents: "none",
        animation: cell.special ? "specialPulse 1.5s ease-in-out infinite" : "none",
        display: "block",
      }}>
        {cell.emoji || cell.candy}
      </span>
      {specialBadge && (
        <div style={{
          position: "absolute", top: -5, right: -5,
          background: "#ffd700", color: "#000", borderRadius: "50%",
          width: 15, height: 15, display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 8, fontWeight: 900, pointerEvents: "none", zIndex: 2,
          boxShadow: "0 0 6px #ffd700",
        }}>{specialBadge}</div>
      )}
    </div>
  );
});

// ─────────────────────────────────────────────
// GAME SCREEN
// ─────────────────────────────────────────────
function GameScreen({ levelNum, profile, onWin, onLose, onBack }) {
  const lv = LEVELS[levelNum - 1];
  const [board, setBoard] = useState(() => buildBoard(lv.candyTypes, lv.blockers));
  const [score, setScore] = useState(0);
  const [moves, setMoves] = useState(lv.moves);
  const [selected, setSelected] = useState(null);
  const [hinted, setHinted] = useState([]);
  const [animating, setAnimating] = useState(false);
  const [combo, setCombo] = useState(0);
  const [comboLabel, setComboLabel] = useState("");
  const [floatingScores, setFloatingScores] = useState([]);
  const [explodingCells, setExplodingCells] = useState(new Set());
  const [dragFrom, setDragFrom] = useState(null);
  const [touchStartIdx, setTouchStartIdx] = useState(null);
  const [screenShake, setScreenShake] = useState(false);
  const hintTimer = useRef(null);
  const floatId = useRef(0);
  const boardRef = useRef(null);

  const addFloat = useCallback((pts, cellIdx) => {
    const id = floatId.current++;
    setFloatingScores(prev => [...prev, { id, pts, idx: cellIdx }]);
    setTimeout(() => setFloatingScores(prev => prev.filter(f => f.id !== id)), 950);
  }, []);

  const doSwap = useCallback((a, b) => {
    if (animating || !isAdjacent(a, b)) return;
    const swapped = [...board];
    [swapped[a], swapped[b]] = [swapped[b], swapped[a]];
    const { matched } = findMatches(swapped);
    if (matched.size === 0) return;

    setAnimating(true);
    setSelected(null);
    setHinted([]);
    setExplodingCells(matched);
    setTimeout(() => setExplodingCells(new Set()), 180);

    const { board: resolved, score: gained, combo: c } = resolveBoard(swapped, lv.candyTypes);
    const newScore = score + gained;
    const newMoves = moves - 1;
    setBoard(resolved);
    setScore(newScore);
    setMoves(newMoves);
    setCombo(c);

    if (c >= 2) {
      setComboLabel(COMBO_LABELS[Math.min(c, COMBO_LABELS.length - 1)]);
      setTimeout(() => setComboLabel(""), 1300);
      if (c >= 3) { setScreenShake(true); setTimeout(() => setScreenShake(false), 400); }
    }
    if (gained > 0) addFloat(gained, Math.max(a, b));

    setTimeout(() => {
      setAnimating(false);
      if (newScore >= lv.target) { onWin(newScore, lv); return; }
      if (newMoves <= 0) { onLose(newScore, lv); return; }
      if (!hasValidMoves(resolved)) setBoard(buildBoard(lv.candyTypes, lv.blockers));
    }, 350);
  }, [board, animating, score, moves, lv, onWin, onLose, addFloat]);

  const handleClick = useCallback((i) => {
    if (animating || board[i]?.blocked) return;
    if (selected === null) { setSelected(i); return; }
    if (selected === i) { setSelected(null); return; }
    doSwap(selected, i);
    setSelected(null);
  }, [selected, animating, board, doSwap]);

  const handleDragStart = useCallback((e, i) => { e.dataTransfer.effectAllowed = "move"; setDragFrom(i); }, []);
  const handleDragEnd = useCallback(() => setDragFrom(null), []);
  const handleDragOver = useCallback((i) => { if (dragFrom !== null && isAdjacent(dragFrom, i)) setSelected(i); }, [dragFrom]);
  const handleDrop = useCallback((i) => {
    if (dragFrom !== null) { doSwap(dragFrom, i); setDragFrom(null); setSelected(null); }
  }, [dragFrom, doSwap]);

  const handleTouchStart = useCallback((e, i) => {
    e.preventDefault();
    setTouchStartIdx(i);
    setSelected(i);
  }, []);

  const handleTouchMove = useCallback((e) => { e.preventDefault(); }, []);

  const handleTouchEnd = useCallback((e, i) => {
    e.preventDefault();
    if (touchStartIdx !== null) {
      const touch = e.changedTouches[0];
      const el = document.elementFromPoint(touch.clientX, touch.clientY);
      const targetEl = el?.closest("[data-cell-idx]");
      const targetIdx = targetEl ? parseInt(targetEl.getAttribute("data-cell-idx")) : i;
      if (touchStartIdx !== targetIdx && isAdjacent(touchStartIdx, targetIdx)) {
        doSwap(touchStartIdx, targetIdx);
      }
    }
    setTouchStartIdx(null);
    setSelected(null);
  }, [touchStartIdx, doSwap]);

  useEffect(() => {
    if (animating) return;
    if (hintTimer.current) clearTimeout(hintTimer.current);
    hintTimer.current = setTimeout(() => {
      for (let i = 0; i < SIZE; i++) {
        for (const j of [i + 1, i + COLS]) {
          if (j >= SIZE || !isAdjacent(i, j)) continue;
          const s = [...board]; [s[i], s[j]] = [s[j], s[i]];
          if (findMatches(s).matched.size > 0) { setHinted([i, j]); return; }
        }
      }
    }, 5000);
    return () => clearTimeout(hintTimer.current);
  }, [board, animating]);

  const pct = Math.min((score / lv.target) * 100, 100);
  const movesWarn = moves <= 5;

  return (
    <div style={{
      minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center",
      background: "radial-gradient(ellipse at 20% 15%, #3d0070 0%, transparent 55%), radial-gradient(ellipse at 80% 85%, #001a6e 0%, transparent 55%), #0d001f",
      padding: "10px 10px 20px", fontFamily: "'Nunito', 'Segoe UI', sans-serif",
      animation: screenShake ? "screenShake 0.4s ease" : "none",
    }}>
      {/* Top bar */}
      <div style={{ width: "100%", maxWidth: 500, display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <button onClick={onBack} style={{
          background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 50, width: 42, height: 42, display: "flex", alignItems: "center", justifyContent: "center",
          color: "#fff", fontSize: 18, cursor: "pointer", flexShrink: 0, transition: "all 0.2s",
        }}>←</button>
        <div style={{ flex: 1, textAlign: "center" }}>
          <div style={{ color: "rgba(255,255,255,0.32)", fontSize: 10, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase" }}>Level {levelNum}</div>
          <div style={{ color: "#fff", fontSize: 17, fontWeight: 900 }}>{lv.label}</div>
        </div>
        <div style={{
          background: movesWarn ? "rgba(255,77,77,0.2)" : "rgba(255,255,255,0.08)",
          border: movesWarn ? "1px solid rgba(255,77,77,0.4)" : "1px solid rgba(255,255,255,0.12)",
          borderRadius: 99, padding: "7px 14px", fontSize: 14, fontWeight: 900,
          color: movesWarn ? "#ff4d4d" : "rgba(255,255,255,0.7)",
          animation: movesWarn ? "pulse 0.6s infinite alternate" : "none",
          transition: "all 0.3s",
        }}>{moves} 🔄</div>
      </div>

      {/* Stats Panel */}
      <div style={{
        width: "100%", maxWidth: 500,
        background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 20, padding: "14px 18px", backdropFilter: "blur(12px)", marginBottom: 10,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 10 }}>
          <StatBlock label="SCORE" value={score.toLocaleString()} big accent="#ffd700" />
          <StatBlock label="TARGET" value={lv.target.toLocaleString()} accent="#00d4ff" />
          <StatBlock label="MOVES" value={moves} warn={movesWarn} />
        </div>
        <div style={{ height: 10, background: "rgba(255,255,255,0.09)", borderRadius: 99, overflow: "hidden", marginBottom: 5 }}>
          <div style={{
            height: "100%", width: `${pct}%`,
            background: pct >= 100 ? "linear-gradient(90deg,#00ff88,#00d4ff)" : "linear-gradient(90deg,#ff6eb4,#b44fff,#ffd700)",
            borderRadius: 99, transition: "width 0.5s ease",
            boxShadow: pct >= 100 ? "0 0 10px #00ff88" : "0 0 8px rgba(180,79,255,0.4)",
          }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "rgba(255,255,255,0.28)", fontWeight: 700 }}>
          <span>{Math.round(pct)}% complete</span>
          <span>{lv.target - score > 0 ? `${(lv.target - score).toLocaleString()} to go` : "🎉 Target reached!"}</span>
        </div>
      </div>

      {/* Combo popup */}
      {comboLabel && (
        <div style={{
          position: "fixed", top: "42%", left: "50%",
          fontSize: 34, fontWeight: 900, color: "#ffd700",
          textShadow: "0 0 30px #ffd700, 0 0 60px #ff6eb4",
          animation: "comboPop 0.35s ease, fadeOut 0.4s 0.85s ease forwards",
          zIndex: 100, pointerEvents: "none", whiteSpace: "nowrap",
          letterSpacing: -0.5,
        }}>{comboLabel}</div>
      )}

      {/* Board */}
      <div ref={boardRef} style={{
        width: "100%", maxWidth: 500,
        background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 20, padding: 8, backdropFilter: "blur(8px)",
        display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: 3,
        opacity: animating ? 0.88 : 1, transition: "opacity 0.15s", position: "relative",
      }}>
        {board.map((cell, i) => (
          <CandyCell
            key={cell?.id || i}
            cell={cell}
            index={i}
            isSelected={selected === i || dragFrom === i}
            isHinted={hinted.includes(i)}
            isExploding={explodingCells.has(i)}
            onClick={handleClick}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          />
        ))}
        {floatingScores.map(f => {
          const r = rowOf(f.idx), c = colOf(f.idx);
          return (
            <div key={f.id} style={{
              position: "absolute",
              top: `${(r / ROWS) * 100}%`, left: `${(c / COLS) * 100}%`,
              color: "#ffd700", fontWeight: 900, fontSize: 16,
              pointerEvents: "none", zIndex: 10,
              animation: "floatScore 0.95s ease forwards",
              textShadow: "0 0 10px #ffd700", whiteSpace: "nowrap",
            }}>+{f.pts}</div>
          );
        })}
      </div>

      <div style={{ marginTop: 10, color: "rgba(255,255,255,0.22)", fontSize: 12, fontWeight: 700, textAlign: "center" }}>
        Tap or drag to swap · Match 3+ to score
      </div>
    </div>
  );
}

function StatBlock({ label, value, big, accent, warn }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.5, color: "rgba(255,255,255,0.38)", textTransform: "uppercase" }}>{label}</div>
      <div style={{
        fontSize: big ? 28 : 20, fontWeight: 900, color: warn ? "#ff4d4d" : accent || "#fff",
        lineHeight: 1,
        animation: warn ? "pulse 0.6s infinite alternate" : "none",
        textShadow: warn ? "0 0 12px #ff4d4d" : accent ? `0 0 10px ${accent}55` : "none",
      }}>{value}</div>
    </div>
  );
}

// ─────────────────────────────────────────────
// WIN / LOSE MODAL
// ─────────────────────────────────────────────
function ResultModal({ type, score, lv, profile, onNext, onRetry, onLevels }) {
  const isWin = type === "win";
  const stars = isWin ? lv.stars.filter(s => score >= s).length : 0;
  const [visible, setVisible] = useState(false);
  useEffect(() => { const t = setTimeout(() => setVisible(true), 40); return () => clearTimeout(t); }, []);

  return (
    <div style={{
      position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
      background: "rgba(5,0,20,0.86)", backdropFilter: "blur(16px)", zIndex: 200, padding: 20,
    }}>
      {isWin && Array.from({length: 26}).map((_, i) => (
        <div key={i} style={{
          position: "absolute",
          left: `${(i * 3.9) % 100}%`, top: "-22px",
          fontSize: 18,
          animation: `confettiFall ${1.3 + (i % 5) * 0.28}s linear forwards`,
          animationDelay: `${(i * 0.06) % 0.9}s`,
          pointerEvents: "none",
        }}>
          {["🍬","🍭","⭐","🎉","✨","🏆","💫","🎊","🍩","🍪"][i % 10]}
        </div>
      ))}

      <div style={{
        background: "rgba(255,255,255,0.07)",
        border: `2px solid ${isWin ? "rgba(255,215,0,0.35)" : "rgba(255,80,80,0.22)"}`,
        borderRadius: 28, padding: "44px 34px", textAlign: "center",
        display: "flex", flexDirection: "column", alignItems: "center", gap: 14,
        minWidth: 300, maxWidth: 400, width: "100%",
        backdropFilter: "blur(22px)",
        animation: "modalIn 0.4s cubic-bezier(0.34,1.56,0.64,1)",
        boxShadow: isWin ? "0 0 80px rgba(255,215,0,0.14), inset 0 1px 0 rgba(255,255,255,0.1)" : "0 0 60px rgba(255,60,60,0.12)",
        fontFamily: "'Nunito','Segoe UI',sans-serif",
        transform: visible ? "scale(1)" : "scale(0.88)",
        opacity: visible ? 1 : 0,
        transition: "all 0.4s cubic-bezier(0.34,1.56,0.64,1)",
      }}>
        <div style={{ fontSize: 70, animation: "floatLogo 2s ease-in-out infinite alternate" }}>
          {isWin ? "🏆" : "💔"}
        </div>
        <h2 style={{
          fontSize: 32, fontWeight: 900, margin: 0,
          color: isWin ? "#ffd700" : "#ff6b6b",
          textShadow: isWin ? "0 0 28px #ffd700" : "0 0 20px #ff6b6b",
        }}>
          {isWin ? "Level Complete!" : "Game Over!"}
        </h2>

        {isWin && (
          <div style={{ fontSize: 42, letterSpacing: 6 }}>
            {[1,2,3].map(s => (
              <span key={s} style={{
                opacity: s <= stars ? 1 : 0.18,
                filter: s <= stars ? "drop-shadow(0 0 8px #ffd700)" : "none",
              }}>⭐</span>
            ))}
          </div>
        )}

        <div style={{
          background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 16, padding: "14px 28px", width: "100%",
        }}>
          <div style={{ color: "rgba(255,255,255,0.38)", fontSize: 10, fontWeight: 800, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 5 }}>
            {isWin ? "Final Score" : "Your Score"}
          </div>
          <div style={{ fontSize: 38, fontWeight: 900, color: "#ffd700", lineHeight: 1 }}>
            {score.toLocaleString()}
          </div>
          {!isWin && (
            <div style={{ color: "rgba(255,255,255,0.32)", fontSize: 13, fontWeight: 700, marginTop: 5 }}>
              Target: {lv.target.toLocaleString()}
            </div>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%", marginTop: 4 }}>
          {isWin && lv.level < 10 && (
            <button onClick={onNext} style={{
              padding: "17px", borderRadius: 99, border: "none",
              background: "linear-gradient(135deg, #ff6eb4, #b44fff)",
              color: "#fff", fontWeight: 900, fontSize: 18, cursor: "pointer",
              fontFamily: "inherit", boxShadow: "0 6px 28px rgba(180,79,255,0.5)",
              transition: "all 0.2s",
            }}>Next Level →</button>
          )}
          {isWin && lv.level >= 10 && (
            <button onClick={onRetry} style={{
              padding: "17px", borderRadius: 99, border: "none",
              background: "linear-gradient(135deg, #ffd700, #ff9f43)",
              color: "#000", fontWeight: 900, fontSize: 18, cursor: "pointer",
              fontFamily: "inherit", boxShadow: "0 6px 28px rgba(255,215,0,0.4)",
            }}>🎊 Play Again</button>
          )}
          <button onClick={onRetry} style={{
            padding: "15px", borderRadius: 99,
            border: "1.5px solid rgba(255,255,255,0.18)",
            background: "rgba(255,255,255,0.07)",
            color: "#fff", fontWeight: 900, fontSize: 16, cursor: "pointer",
            fontFamily: "inherit", transition: "all 0.2s",
          }}>🔄 Retry Level</button>
          <button onClick={onLevels} style={{
            padding: "12px", borderRadius: 99, border: "none",
            background: "transparent",
            color: "rgba(255,255,255,0.38)", fontWeight: 700, fontSize: 14, cursor: "pointer",
            fontFamily: "inherit",
          }}>← Back to Levels</button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// GLOBAL STYLES
// ─────────────────────────────────────────────
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap');
  *, *::before, *::after { box-sizing: border-box; }
  body, html { margin: 0; padding: 0; background: #0d001f; overscroll-behavior: none; }
  input { font-family: 'Nunito', sans-serif; }
  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.18); border-radius: 99px; }

  @keyframes floatLogo {
    from { transform: translateY(0) rotate(-3deg); }
    to   { transform: translateY(-12px) rotate(3deg); }
  }
  @keyframes floatBg {
    from { transform: translateY(0) scale(1) rotate(0deg); }
    to   { transform: translateY(-26px) scale(1.08) rotate(8deg); }
  }
  @keyframes comboPop {
    0%   { transform: translate(-50%,-50%) scale(0.3) rotate(-10deg); opacity: 0; }
    60%  { transform: translate(-50%,-50%) scale(1.2) rotate(2deg); opacity: 1; }
    100% { transform: translate(-50%,-50%) scale(1) rotate(0deg); opacity: 1; }
  }
  @keyframes fadeOut {
    to { opacity: 0; transform: translate(-50%,-50%) translateY(-22px) scale(0.88); }
  }
  @keyframes pulse {
    from { opacity: 1; transform: scale(1); }
    to   { opacity: 0.55; transform: scale(1.08); }
  }
  @keyframes modalIn {
    from { transform: scale(0.84) translateY(28px); opacity: 0; }
    to   { transform: scale(1) translateY(0); opacity: 1; }
  }
  @keyframes floatScore {
    0%   { transform: translateY(0); opacity: 1; }
    100% { transform: translateY(-56px); opacity: 0; }
  }
  @keyframes specialPulse {
    0%   { filter: drop-shadow(0 0 4px currentColor); }
    50%  { filter: drop-shadow(0 0 14px currentColor); }
    100% { filter: drop-shadow(0 0 4px currentColor); }
  }
  @keyframes confettiFall {
    0%   { transform: translateY(0) rotate(0deg) scale(1); opacity: 1; }
    100% { transform: translateY(110vh) rotate(720deg) scale(0.5); opacity: 0; }
  }
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    20%      { transform: translateX(-8px) rotate(-1deg); }
    40%      { transform: translateX(8px) rotate(1deg); }
    60%      { transform: translateX(-5px); }
    80%      { transform: translateX(5px); }
  }
  @keyframes screenShake {
    0%, 100% { transform: translate(0,0); }
    20%      { transform: translate(-5px, 2px); }
    40%      { transform: translate(5px, -3px); }
    60%      { transform: translate(-3px, 2px); }
    80%      { transform: translate(3px, -1px); }
  }
  @keyframes spin {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
  }

  button { transition: opacity 0.15s, transform 0.15s; }
  button:hover { opacity: 0.88; }
  button:active { transform: scale(0.96) !important; }
`;

// ─────────────────────────────────────────────
// ROOT APP
// ─────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState("boot");
  const [profile, setProfile] = useState(null);
  const [pendingPhone, setPendingPhone] = useState(null);
  const [selectedLevel, setSelectedLevel] = useState(null);
  const [result, setResult] = useState(null);

  useEffect(() => {
    const saved = loadData();
    if (saved?.phone) {
      setProfile(saved);
      setScreen("profile");
    } else {
      setScreen("login");
    }
  }, []);

  const handleLoginRequest = (phone) => {
    setPendingPhone(phone);
    setScreen("otp");
  };

  const handleOTPVerified = () => {
    const p = { phone: pendingPhone, maxLevel: 1, highScore: 0, levelStars: {} };
    setProfile(p);
    saveData(p);
    setScreen("profile");
  };

  const handleLogout = () => {
    localStorage.removeItem("rushcandy_v3");
    setProfile(null);
    setPendingPhone(null);
    setScreen("login");
  };

  const handleLevelSelect = (lvNum) => {
    setSelectedLevel(lvNum);
    setResult(null);
    setScreen("game");
  };

  const handleWin = (score, lv) => {
    const stars = lv.stars.filter(s => score >= s).length;
    const updated = {
      ...profile,
      highScore: Math.max(profile.highScore || 0, score),
      maxLevel: Math.max(profile.maxLevel, lv.level + 1 > 10 ? 10 : lv.level + 1),
      levelStars: {
        ...profile.levelStars,
        [lv.level]: Math.max(profile.levelStars?.[lv.level] || 0, stars),
      },
    };
    setProfile(updated);
    saveData(updated);
    setResult({ type: "win", score, lv });
  };

  const handleLose = (score, lv) => {
    if (score > (profile.highScore || 0)) {
      const updated = { ...profile, highScore: score };
      setProfile(updated);
      saveData(updated);
    }
    setResult({ type: "lose", score, lv });
  };

  const handleNextLevel = () => {
    if (result?.lv?.level < 10) handleLevelSelect(result.lv.level + 1);
  };

  if (screen === "boot") {
    return (
      <div style={{
        minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        background: "#0d001f", flexDirection: "column", gap: 16,
        fontFamily: "'Nunito', sans-serif",
      }}>
        <div style={{ fontSize: 72, animation: "floatLogo 2s ease-in-out infinite alternate" }}>🍬</div>
        <div style={{ color: "rgba(255,255,255,0.32)", fontSize: 14, fontWeight: 700, letterSpacing: 2 }}>Loading…</div>
        <style>{STYLES}</style>
      </div>
    );
  }

  return (
    <>
      <style>{STYLES}</style>

      {screen === "login" && <LoginScreen onLogin={handleLoginRequest} />}

      {screen === "otp" && pendingPhone && (
        <OTPScreen
          phone={pendingPhone}
          onVerify={handleOTPVerified}
          onBack={() => setScreen("login")}
        />
      )}

      {screen === "profile" && profile && (
        <ProfileScreen profile={profile} onPlay={() => setScreen("levels")} onLogout={handleLogout} />
      )}

      {screen === "levels" && profile && (
        <LevelSelect profile={profile} onSelect={handleLevelSelect} onBack={() => setScreen("profile")} />
      )}

      {screen === "game" && selectedLevel && (
        <>
          <GameScreen
            key={`${selectedLevel}-${Date.now()}`}
            levelNum={selectedLevel}
            profile={profile}
            onWin={handleWin}
            onLose={handleLose}
            onBack={() => setScreen("levels")}
          />
          {result && (
            <ResultModal
              type={result.type}
              score={result.score}
              lv={result.lv}
              profile={profile}
              onNext={handleNextLevel}
              onRetry={() => handleLevelSelect(selectedLevel)}
              onLevels={() => setScreen("levels")}
            />
          )}
        </>
      )}
    </>
  );
}