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

// ─────────────────────────────────────────────
// LEVELS CONFIG
// ─────────────────────────────────────────────
const LEVELS = [
  { level: 1, target: 300,  moves: 25, candyTypes: 4, blockers: 0,  label: "Sugar Rush",    stars: [150, 250, 300] },
  { level: 2, target: 500,  moves: 22, candyTypes: 5, blockers: 2,  label: "Candy Storm",   stars: [250, 400, 500] },
  { level: 3, target: 800,  moves: 20, candyTypes: 5, blockers: 4,  label: "Sweet Chaos",   stars: [400, 650, 800] },
  { level: 4, target: 1100, moves: 18, candyTypes: 6, blockers: 5,  label: "Jelly Jungle",  stars: [550, 900, 1100] },
  { level: 5, target: 1500, moves: 17, candyTypes: 6, blockers: 6,  label: "Lollipop Lane", stars: [750, 1200, 1500] },
  { level: 6, target: 2000, moves: 16, candyTypes: 7, blockers: 7,  label: "Choco Madness", stars: [1000, 1600, 2000] },
  { level: 7, target: 2700, moves: 15, candyTypes: 7, blockers: 8,  label: "Berry Blitz",   stars: [1350, 2200, 2700] },
  { level: 8, target: 3500, moves: 14, candyTypes: 8, blockers: 8,  label: "Cupcake Craze", stars: [1750, 2800, 3500] },
  { level: 9, target: 4500, moves: 13, candyTypes: 8, blockers: 9,  label: "Donut Doom",    stars: [2250, 3600, 4500] },
  { level:10, target: 6000, moves: 12, candyTypes: 8, blockers:10,  label: "Ultimate Rush",  stars: [3000, 5000, 6000] },
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
    const d = localStorage.getItem("rushcandy_v2");
    return d ? JSON.parse(d) : null;
  } catch { return null; }
}
function saveData(d) {
  try { localStorage.setItem("rushcandy_v2", JSON.stringify(d)); } catch {}
}

// ─────────────────────────────────────────────
// CANDY CELL COMPONENT
// ─────────────────────────────────────────────
const CandyCell = memo(function CandyCell({ cell, index, isSelected, isHinted, onClick, onDragStart, onDragEnd, onDragOver, onDrop, onTouchStart, onTouchEnd }) {
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
      onClick={() => onClick(index)}
      draggable={!cell.blocked}
      onDragStart={e => onDragStart(e, index)}
      onDragEnd={onDragEnd}
      onDragOver={e => { e.preventDefault(); onDragOver(index); }}
      onDrop={e => { e.preventDefault(); onDrop(index); }}
      onTouchStart={e => onTouchStart(e, index)}
      onTouchEnd={e => onTouchEnd(e, index)}
      style={{
        aspectRatio: "1",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 10,
        cursor: cell.blocked ? "not-allowed" : "pointer",
        position: "relative",
        background: cell.blocked
          ? "rgba(80,50,20,0.4)"
          : isSelected
          ? `rgba(${hexToRgb(color)},0.35)`
          : isHinted
          ? "rgba(255,215,0,0.2)"
          : "rgba(255,255,255,0.06)",
        border: isSelected
          ? `2px solid ${color}`
          : isHinted
          ? "2px solid #ffd700"
          : "1.5px solid rgba(255,255,255,0.08)",
        boxShadow: isSelected
          ? `0 0 12px ${glow}, 0 0 0 2px ${color}`
          : isHinted
          ? "0 0 12px #ffd700"
          : cell.special
          ? `0 0 8px ${glow}88`
          : "none",
        transform: isSelected ? "scale(1.12)" : "scale(1)",
        transition: "all 0.15s ease",
        userSelect: "none",
        WebkitUserSelect: "none",
      }}
    >
      <span style={{
        fontSize: "clamp(16px, 4.5vw, 32px)",
        lineHeight: 1,
        filter: `drop-shadow(0 0 ${cell.special ? "8px" : "3px"} ${glow}${cell.special ? "cc" : "66"})`,
        pointerEvents: "none",
        animation: cell.special ? "specialPulse 1.5s ease-in-out infinite" : "none",
      }}>
        {cell.emoji || cell.candy}
      </span>
      {specialBadge && (
        <div style={{
          position: "absolute", top: -5, right: -5,
          background: "#ffd700", color: "#000",
          borderRadius: "50%", width: 16, height: 16,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 9, fontWeight: 900, pointerEvents: "none",
          boxShadow: "0 0 6px #ffd700",
        }}>
          {specialBadge}
        </div>
      )}
    </div>
  );
});

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return `${r},${g},${b}`;
}

// ─────────────────────────────────────────────
// LOGIN SCREEN
// ─────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [phone, setPhone] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const sendOTP = () => {
    if (phone.length < 10) { setError("Enter a valid 10-digit number"); return; }
    setLoading(true);
    setTimeout(() => { setOtpSent(true); setLoading(false); setError(""); }, 1200);
  };

  const verifyOTP = () => {
    if (otp === STATIC_OTP) {
      onLogin(phone);
    } else {
      setError("Invalid OTP. Hint: use 1234");
    }
  };

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "radial-gradient(ellipse at 30% 20%, #3d0070 0%, transparent 55%), radial-gradient(ellipse at 75% 80%, #001a6e 0%, transparent 55%), #0d001f",
      padding: "20px", fontFamily: "'Nunito', 'Segoe UI', sans-serif",
    }}>
      {/* Floating candies bg */}
      <div style={{ position: "fixed", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 0 }}>
        {["🍬","🍭","🍫","🍩","🍪"].map((e, i) => (
          <div key={i} style={{
            position: "absolute",
            fontSize: 40,
            opacity: 0.12,
            left: `${15 + i * 18}%`,
            top: `${10 + (i % 3) * 30}%`,
            animation: `floatBg ${4 + i}s ease-in-out infinite alternate`,
            animationDelay: `${i * 0.7}s`,
          }}>{e}</div>
        ))}
      </div>

      <div style={{
        background: "rgba(255,255,255,0.06)",
        border: "1px solid rgba(255,255,255,0.15)",
        borderRadius: 28,
        padding: "48px 36px",
        width: "100%", maxWidth: 400,
        backdropFilter: "blur(20px)",
        textAlign: "center",
        position: "relative", zIndex: 1,
        boxShadow: "0 40px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05)",
      }}>
        <div style={{ fontSize: 64, marginBottom: 4, animation: "floatLogo 2.5s ease-in-out infinite alternate" }}>🍬</div>
        <h1 style={{ fontSize: 40, fontWeight: 900, color: "#fff", margin: "0 0 4px", letterSpacing: -1,
          textShadow: "0 0 40px #ff6eb4" }}>Rush Candy</h1>
        <p style={{ color: "rgba(255,255,255,0.45)", fontWeight: 700, letterSpacing: 2, fontSize: 12, margin: "0 0 32px" }}>MATCH · CRUSH · WIN</p>

        {!otpSent ? (
          <>
            <p style={{ color: "rgba(255,255,255,0.6)", marginBottom: 16, fontSize: 14 }}>Enter your mobile number to play</p>
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              <div style={{
                background: "rgba(255,255,255,0.08)", border: "1.5px solid rgba(255,255,255,0.15)",
                borderRadius: 12, padding: "14px 14px", color: "rgba(255,255,255,0.6)",
                fontWeight: 800, fontSize: 15, flexShrink: 0,
              }}>+91</div>
              <input
                type="tel" value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g,"").slice(0,10))}
                placeholder="Mobile Number"
                style={{
                  flex: 1, background: "rgba(255,255,255,0.08)", border: "1.5px solid rgba(255,255,255,0.15)",
                  borderRadius: 12, padding: "14px 16px", color: "#fff", fontSize: 16, fontWeight: 700,
                  outline: "none", fontFamily: "inherit",
                }}
              />
            </div>
            {error && <p style={{ color: "#ff6b6b", fontSize: 13, marginBottom: 12 }}>{error}</p>}
            <button onClick={sendOTP} disabled={loading} style={{
              width: "100%", padding: "16px", borderRadius: 99, border: "none",
              background: loading ? "rgba(255,110,180,0.4)" : "linear-gradient(135deg, #ff6eb4, #ff3cac)",
              color: "#fff", fontWeight: 900, fontSize: 17, cursor: loading ? "wait" : "pointer",
              fontFamily: "inherit", letterSpacing: 0.5,
              boxShadow: loading ? "none" : "0 4px 24px rgba(255,60,172,0.5)",
              transition: "all 0.2s",
            }}>
              {loading ? "Sending…" : "Send OTP"}
            </button>
          </>
        ) : (
          <>
            <p style={{ color: "rgba(255,255,255,0.6)", marginBottom: 8, fontSize: 14 }}>OTP sent to +91 {phone}</p>
            <p style={{ color: "#ffd700", marginBottom: 20, fontSize: 12, fontWeight: 700 }}>Demo OTP: 1234</p>
            <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 16 }}>
              {[0,1,2,3].map(i => (
                <input key={i} maxLength={1} value={otp[i]||""}
                  onChange={e => { const v = otp.split(""); v[i] = e.target.value.replace(/\D/g,""); setOtp(v.join("")); }}
                  style={{
                    width: 56, height: 64, textAlign: "center", fontSize: 28, fontWeight: 900,
                    background: "rgba(255,255,255,0.1)", border: otp[i] ? "2px solid #ff6eb4" : "1.5px solid rgba(255,255,255,0.2)",
                    borderRadius: 14, color: "#fff", outline: "none", fontFamily: "inherit",
                  }}
                />
              ))}
            </div>
            {error && <p style={{ color: "#ff6b6b", fontSize: 13, marginBottom: 12 }}>{error}</p>}
            <button onClick={verifyOTP} style={{
              width: "100%", padding: "16px", borderRadius: 99, border: "none",
              background: "linear-gradient(135deg, #ff6eb4, #ff3cac)",
              color: "#fff", fontWeight: 900, fontSize: 17, cursor: "pointer",
              fontFamily: "inherit", boxShadow: "0 4px 24px rgba(255,60,172,0.5)",
            }}>Verify & Play 🎮</button>
            <button onClick={() => { setOtpSent(false); setOtp(""); setError(""); }}
              style={{ marginTop: 12, background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: 13, fontFamily: "inherit" }}>
              ← Change number
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// PROFILE SCREEN
// ─────────────────────────────────────────────
function ProfileScreen({ profile, onPlay, onLogout }) {
  const unlockedCount = LEVELS.filter((_, i) => i < profile.maxLevel).length;
  const avatarEmojis = ["👑","🎯","⚡","🔥","💎","🌟","🏆","🎮"];
  const avatar = avatarEmojis[parseInt(profile.phone.slice(-1)) % 8];

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "radial-gradient(ellipse at 25% 25%, #3d0070 0%, transparent 55%), radial-gradient(ellipse at 80% 75%, #001a6e 0%, transparent 55%), #0d001f",
      padding: "20px", fontFamily: "'Nunito', 'Segoe UI', sans-serif",
    }}>
      <div style={{ width: "100%", maxWidth: 420 }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 72, marginBottom: 8, animation: "floatLogo 3s ease-in-out infinite alternate" }}>🍬</div>
          <h1 style={{ fontSize: 32, fontWeight: 900, color: "#fff", margin: 0, textShadow: "0 0 30px #ff6eb4" }}>Rush Candy</h1>
        </div>

        {/* Profile Card */}
        <div style={{
          background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.15)",
          borderRadius: 24, padding: 28, backdropFilter: "blur(20px)", marginBottom: 20,
          boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 24 }}>
            <div style={{
              width: 72, height: 72, borderRadius: "50%",
              background: "linear-gradient(135deg, #ff6eb4, #7b00ff)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 36, boxShadow: "0 0 24px rgba(255,110,180,0.5)",
              flexShrink: 0,
            }}>{avatar}</div>
            <div>
              <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, fontWeight: 800, letterSpacing: 2, marginBottom: 2 }}>PLAYER</div>
              <div style={{ color: "#fff", fontSize: 20, fontWeight: 900, marginBottom: 2 }}>+91 {profile.phone}</div>
              <div style={{ color: "#ffd700", fontSize: 13, fontWeight: 800 }}>Level {profile.maxLevel} Player</div>
            </div>
          </div>

          {/* Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            {[
              { label: "Best Score", value: profile.highScore.toLocaleString(), emoji: "🏆" },
              { label: "Levels Done", value: `${unlockedCount}/10`, emoji: "🗺️" },
              { label: "Max Level", value: profile.maxLevel, emoji: "⭐" },
            ].map(s => (
              <div key={s.label} style={{
                background: "rgba(255,255,255,0.06)", borderRadius: 14, padding: "14px 10px",
                textAlign: "center", border: "1px solid rgba(255,255,255,0.1)",
              }}>
                <div style={{ fontSize: 22, marginBottom: 4 }}>{s.emoji}</div>
                <div style={{ color: "#fff", fontWeight: 900, fontSize: 18 }}>{s.value}</div>
                <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 10, fontWeight: 700, letterSpacing: 1 }}>{s.label.toUpperCase()}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Buttons */}
        <button onClick={onPlay} style={{
          width: "100%", padding: "18px", borderRadius: 99, border: "none",
          background: "linear-gradient(135deg, #ff6eb4, #ff3cac)",
          color: "#fff", fontWeight: 900, fontSize: 20, cursor: "pointer",
          fontFamily: "inherit", marginBottom: 12,
          boxShadow: "0 6px 28px rgba(255,60,172,0.6)",
          transition: "all 0.2s",
        }}>🎮 Select Level</button>
        <button onClick={onLogout} style={{
          width: "100%", padding: "14px", borderRadius: 99, border: "1px solid rgba(255,255,255,0.15)",
          background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)",
          fontWeight: 800, fontSize: 15, cursor: "pointer", fontFamily: "inherit",
        }}>Logout</button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// LEVEL SELECT SCREEN
// ─────────────────────────────────────────────
function LevelSelect({ profile, onSelect, onBack }) {
  return (
    <div style={{
      minHeight: "100vh",
      background: "radial-gradient(ellipse at 20% 10%, #3d0070 0%, transparent 55%), radial-gradient(ellipse at 85% 90%, #001a6e 0%, transparent 55%), #0d001f",
      padding: "20px", fontFamily: "'Nunito', 'Segoe UI', sans-serif",
    }}>
      <div style={{ maxWidth: 500, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 28, paddingTop: 12 }}>
          <button onClick={onBack} style={{
            background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)",
            borderRadius: 50, width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", fontSize: 20, cursor: "pointer",
          }}>←</button>
          <div>
            <h2 style={{ color: "#fff", fontSize: 26, fontWeight: 900, margin: 0 }}>Choose Level</h2>
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, margin: 0, fontWeight: 700 }}>
              {profile.maxLevel - 1} levels completed
            </p>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
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
                    ? "linear-gradient(135deg, rgba(255,110,180,0.2), rgba(123,0,255,0.2))"
                    : "rgba(255,255,255,0.07)",
                  border: current
                    ? "2px solid rgba(255,110,180,0.6)"
                    : "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 20, padding: 20,
                  cursor: locked ? "not-allowed" : "pointer",
                  opacity: locked ? 0.5 : 1,
                  transition: "all 0.2s",
                  position: "relative", overflow: "hidden",
                  backdropFilter: "blur(10px)",
                }}>
                {current && (
                  <div style={{
                    position: "absolute", top: 8, right: 8,
                    background: "#ff6eb4", borderRadius: 99, padding: "2px 8px",
                    fontSize: 10, fontWeight: 900, color: "#fff",
                  }}>PLAY</div>
                )}
                <div style={{ fontSize: 32, marginBottom: 8 }}>
                  {locked ? "🔒" : completed ? "✅" : "🎯"}
                </div>
                <div style={{ color: "#fff", fontWeight: 900, fontSize: 18, marginBottom: 2 }}>
                  Level {lv.level}
                </div>
                <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, fontWeight: 700, marginBottom: 10 }}>
                  {lv.label}
                </div>
                {!locked && (
                  <div>
                    <div style={{ display: "flex", gap: 2, marginBottom: 6 }}>
                      {[1,2,3].map(s => (
                        <span key={s} style={{ fontSize: 14, opacity: s <= stars ? 1 : 0.25 }}>⭐</span>
                      ))}
                    </div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", fontWeight: 700 }}>
                      🎯 {lv.target.toLocaleString()} pts · {lv.moves} moves
                    </div>
                  </div>
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
  const [floatingScores, setFloatingScores] = useState([]);
  const [dragFrom, setDragFrom] = useState(null);
  const [touchStart, setTouchStart] = useState(null);
  const hintTimer = useRef(null);
  const floatId = useRef(0);

  const addFloatingScore = useCallback((pts, idx) => {
    const id = floatId.current++;
    setFloatingScores(prev => [...prev, { id, pts, idx }]);
    setTimeout(() => setFloatingScores(prev => prev.filter(f => f.id !== id)), 900);
  }, []);

  const doSwap = useCallback((a, b) => {
    if (animating || !isAdjacent(a, b)) return;
    const swapped = [...board];
    [swapped[a], swapped[b]] = [swapped[b], swapped[a]];
    const { matched } = findMatches(swapped);
    if (matched.size === 0) {
      // Invalid swap – wiggle feedback but don't consume move
      return;
    }
    setAnimating(true);
    setSelected(null);
    setHinted([]);
    const { board: resolved, score: gained, combo: c } = resolveBoard(swapped, lv.candyTypes);
    const newScore = score + gained;
    const newMoves = moves - 1;
    setBoard(resolved);
    setScore(newScore);
    setMoves(newMoves);
    setCombo(c);
    if (gained > 0) addFloatingScore(gained, Math.max(a, b));
    setTimeout(() => {
      setAnimating(false);
      if (newScore >= lv.target) { onWin(newScore, lv); return; }
      if (newMoves <= 0) { onLose(newScore, lv); return; }
      if (!hasValidMoves(resolved)) {
        // Shuffle board
        setBoard(buildBoard(lv.candyTypes, lv.blockers));
      }
    }, 350);
  }, [board, animating, score, moves, lv, onWin, onLose, addFloatingScore]);

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
    setTouchStart(i);
    setSelected(i);
  }, []);

  const handleTouchEnd = useCallback((e, i) => {
    e.preventDefault();
    if (touchStart !== null && touchStart !== i) {
      doSwap(touchStart, i);
      setTouchStart(null);
      setSelected(null);
    }
  }, [touchStart, doSwap]);

  // Hint system
  useEffect(() => {
    if (animating) return;
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
      padding: "12px 12px 20px",
      fontFamily: "'Nunito', 'Segoe UI', sans-serif",
    }}>
      {/* Top bar */}
      <div style={{
        width: "100%", maxWidth: 480, display: "flex", alignItems: "center", gap: 10,
        marginBottom: 12,
      }}>
        <button onClick={onBack} style={{
          background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)",
          borderRadius: 50, width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center",
          color: "#fff", fontSize: 18, cursor: "pointer", flexShrink: 0,
        }}>←</button>
        <div style={{ flex: 1, textAlign: "center" }}>
          <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 10, fontWeight: 800, letterSpacing: 2 }}>LEVEL {levelNum}</div>
          <div style={{ color: "#fff", fontSize: 16, fontWeight: 900 }}>{lv.label}</div>
        </div>
      </div>

      {/* Stats Panel */}
      <div style={{
        width: "100%", maxWidth: 480,
        background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: 20, padding: "14px 18px", backdropFilter: "blur(12px)",
        marginBottom: 10,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 10 }}>
          <StatBlock label="SCORE" value={score.toLocaleString()} big accent="#ffd700" />
          <StatBlock label="TARGET" value={lv.target.toLocaleString()} />
          <StatBlock label="MOVES" value={moves} warn={movesWarn} />
        </div>

        {/* Progress bar */}
        <div style={{ height: 8, background: "rgba(255,255,255,0.1)", borderRadius: 99, overflow: "hidden", marginBottom: 6 }}>
          <div style={{
            height: "100%", width: `${pct}%`,
            background: pct >= 100 ? "#00ff88" : "linear-gradient(90deg, #ff6eb4, #ffd700)",
            borderRadius: 99, transition: "width 0.4s ease",
          }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "rgba(255,255,255,0.35)", fontWeight: 700 }}>
          <span>{Math.round(pct)}% complete</span>
          <span>{lv.target - score > 0 ? `${(lv.target - score).toLocaleString()} to go` : "🎉 Target reached!"}</span>
        </div>

        {combo > 1 && (
          <div style={{
            textAlign: "center", marginTop: 8, fontSize: 15, fontWeight: 900,
            color: "#ffd700", animation: "comboPop 0.35s ease",
          }}>
            🔥 COMBO x{combo}! +{combo * 10} bonus
          </div>
        )}
      </div>

      {/* Board */}
      <div style={{
        width: "100%", maxWidth: 480,
        background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 20, padding: 10, backdropFilter: "blur(8px)",
        display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: 4,
        opacity: animating ? 0.85 : 1, transition: "opacity 0.15s",
        position: "relative",
      }}>
        {board.map((cell, i) => (
          <CandyCell
            key={cell?.id || i}
            cell={cell}
            index={i}
            isSelected={selected === i || dragFrom === i}
            isHinted={hinted.includes(i)}
            onClick={handleClick}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          />
        ))}

        {/* Floating score popups */}
        {floatingScores.map(f => {
          const r = rowOf(f.idx), c = colOf(f.idx);
          return (
            <div key={f.id} style={{
              position: "absolute",
              top: `${(r / ROWS) * 100}%`,
              left: `${(c / COLS) * 100}%`,
              color: "#ffd700", fontWeight: 900, fontSize: 18,
              pointerEvents: "none", zIndex: 10,
              animation: "floatScore 0.9s ease forwards",
              textShadow: "0 0 10px #ffd700",
            }}>+{f.pts}</div>
          );
        })}
      </div>

      <div style={{ marginTop: 12, color: "rgba(255,255,255,0.3)", fontSize: 12, fontWeight: 700, textAlign: "center" }}>
        Tap or drag to swap candies · Match 3+ to score
      </div>
    </div>
  );
}

function StatBlock({ label, value, big, accent, warn }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.5, color: "rgba(255,255,255,0.45)" }}>{label}</div>
      <div style={{
        fontSize: big ? 30 : 22, fontWeight: 900, color: warn ? "#ff4d4d" : accent || "#fff",
        lineHeight: 1, animation: warn ? "pulse 0.6s infinite alternate" : "none",
      }}>{value}</div>
    </div>
  );
}

// ─────────────────────────────────────────────
// WIN / LOSE MODAL
// ─────────────────────────────────────────────
function ResultModal({ type, score, lv, profile, onNext, onRetry, onLevels }) {
  const isWin = type === "win";
  const stars = isWin
    ? lv.stars.filter(s => score >= s).length
    : 0;

  return (
    <div style={{
      position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
      background: "rgba(5,0,20,0.82)", backdropFilter: "blur(12px)", zIndex: 200, padding: 20,
    }}>
      {/* Confetti for win */}
      {isWin && Array.from({length:20}).map((_,i) => (
        <div key={i} style={{
          position: "absolute",
          left: `${Math.random()*100}%`,
          top: "-20px",
          fontSize: 20,
          animation: `confettiFall ${1.5 + Math.random()}s linear forwards`,
          animationDelay: `${Math.random()*0.8}s`,
          pointerEvents: "none",
        }}>
          {["🍬","🍭","⭐","🎉","✨"][i%5]}
        </div>
      ))}

      <div style={{
        background: "rgba(255,255,255,0.07)", border: `2px solid ${isWin ? "rgba(255,215,0,0.4)" : "rgba(255,80,80,0.3)"}`,
        borderRadius: 28, padding: "44px 36px", textAlign: "center",
        display: "flex", flexDirection: "column", alignItems: "center", gap: 16,
        minWidth: 300, maxWidth: 400, width: "100%",
        backdropFilter: "blur(20px)", animation: "modalIn 0.35s ease",
        boxShadow: isWin ? "0 0 60px rgba(255,215,0,0.2)" : "0 0 60px rgba(255,60,60,0.2)",
        fontFamily: "'Nunito', 'Segoe UI', sans-serif",
      }}>
        <div style={{ fontSize: 64 }}>{isWin ? "🏆" : "💔"}</div>
        <h2 style={{ fontSize: 32, fontWeight: 900, color: isWin ? "#ffd700" : "#ff6b6b", margin: 0 }}>
          {isWin ? "Level Complete!" : "Game Over!"}
        </h2>

        {isWin && (
          <div style={{ fontSize: 40, letterSpacing: 4 }}>
            {[1,2,3].map(s => <span key={s} style={{ opacity: s <= stars ? 1 : 0.2 }}>⭐</span>)}
          </div>
        )}

        <div style={{ fontSize: 36, fontWeight: 900, color: "#ffd700" }}>
          {score.toLocaleString()}
        </div>
        <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 14, fontWeight: 700 }}>
          {isWin ? `Target: ${lv.target.toLocaleString()}` : `Score: ${score.toLocaleString()} / ${lv.target.toLocaleString()}`}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%" }}>
          {isWin && lv.level < 10 && (
            <button onClick={onNext} style={{
              padding: "16px", borderRadius: 99, border: "none",
              background: "linear-gradient(135deg, #ff6eb4, #ff3cac)",
              color: "#fff", fontWeight: 900, fontSize: 18, cursor: "pointer",
              fontFamily: "inherit", boxShadow: "0 4px 24px rgba(255,60,172,0.5)",
            }}>Next Level →</button>
          )}
          <button onClick={onRetry} style={{
            padding: "14px", borderRadius: 99,
            border: "1.5px solid rgba(255,255,255,0.2)",
            background: "rgba(255,255,255,0.08)",
            color: "#fff", fontWeight: 900, fontSize: 16, cursor: "pointer",
            fontFamily: "inherit",
          }}>🔄 Retry</button>
          <button onClick={onLevels} style={{
            padding: "14px", borderRadius: 99, border: "none",
            background: "transparent",
            color: "rgba(255,255,255,0.5)", fontWeight: 700, fontSize: 14, cursor: "pointer",
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
  @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;700;800;900&display=swap');
  *, *::before, *::after { box-sizing: border-box; }
  body, html { margin: 0; padding: 0; background: #0d001f; }
  input { font-family: 'Nunito', sans-serif; }
  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 99px; }

  @keyframes floatLogo {
    from { transform: translateY(0) rotate(-4deg); }
    to   { transform: translateY(-14px) rotate(4deg); }
  }
  @keyframes floatBg {
    from { transform: translateY(0) scale(1); }
    to   { transform: translateY(-30px) scale(1.1); }
  }
  @keyframes comboPop {
    from { transform: scale(0.4); opacity: 0; }
    to   { transform: scale(1); opacity: 1; }
  }
  @keyframes pulse {
    from { opacity: 1; }
    to   { opacity: 0.3; }
  }
  @keyframes modalIn {
    from { transform: scale(0.88) translateY(24px); opacity: 0; }
    to   { transform: scale(1) translateY(0); opacity: 1; }
  }
  @keyframes floatScore {
    0%   { transform: translateY(0); opacity: 1; }
    100% { transform: translateY(-50px); opacity: 0; }
  }
  @keyframes specialPulse {
    0%   { filter: drop-shadow(0 0 4px currentColor); }
    50%  { filter: drop-shadow(0 0 12px currentColor); }
    100% { filter: drop-shadow(0 0 4px currentColor); }
  }
  @keyframes confettiFall {
    0%   { transform: translateY(0) rotate(0deg); opacity: 1; }
    100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
  }
`;

// ─────────────────────────────────────────────
// ROOT APP
// ─────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState("boot");
  const [profile, setProfile] = useState(null);
  const [selectedLevel, setSelectedLevel] = useState(null);
  const [result, setResult] = useState(null); // { type, score, lv }

  // Boot – load from storage
  useEffect(() => {
    const saved = loadData();
    if (saved?.phone) {
      setProfile(saved);
      setScreen("profile");
    } else {
      setScreen("login");
    }
  }, []);

  const handleLogin = (phone) => {
    const p = {
      phone,
      maxLevel: 1,
      highScore: 0,
      levelStars: {},
    };
    setProfile(p);
    saveData(p);
    setScreen("profile");
  };

  const handleLogout = () => {
    localStorage.removeItem("rushcandy_v2");
    setProfile(null);
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
      highScore: Math.max(profile.highScore, score),
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
    if (result?.lv?.level < 10) {
      handleLevelSelect(result.lv.level + 1);
    }
  };

  const handleRetry = () => {
    handleLevelSelect(selectedLevel);
  };

  if (screen === "boot") {
    return (
      <div style={{
        minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        background: "#0d001f", flexDirection: "column", gap: 16,
        fontFamily: "'Nunito', sans-serif",
      }}>
        <div style={{ fontSize: 72, animation: "floatLogo 2s ease-in-out infinite alternate" }}>🍬</div>
        <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 16, fontWeight: 700 }}>Loading…</div>
        <style>{STYLES}</style>
      </div>
    );
  }

  return (
    <>
      <style>{STYLES}</style>

      {screen === "login" && <LoginScreen onLogin={handleLogin} />}

      {screen === "profile" && profile && (
        <ProfileScreen
          profile={profile}
          onPlay={() => setScreen("levels")}
          onLogout={handleLogout}
        />
      )}

      {screen === "levels" && profile && (
        <LevelSelect
          profile={profile}
          onSelect={handleLevelSelect}
          onBack={() => setScreen("profile")}
        />
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
              onRetry={handleRetry}
              onLevels={() => setScreen("levels")}
            />
          )}
        </>
      )}
    </>
  );
}