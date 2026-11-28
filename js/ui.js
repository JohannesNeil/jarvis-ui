import { ASSISTANT_NAME, state, STORAGE_KEYS } from "./state.js";

export const $ = (id) => document.getElementById(id);

export function applyAssistantIdentity() {
  document.title = ASSISTANT_NAME;
  document.querySelectorAll("[data-assistant-name]").forEach((el) => {
    el.textContent = ASSISTANT_NAME;
  });
  document.querySelectorAll("[data-assistant-template]").forEach((el) => {
    el.textContent = el.dataset.assistantTemplate.replaceAll("{name}", ASSISTANT_NAME);
  });
  document.querySelectorAll("[data-assistant-placeholder]").forEach((el) => {
    el.placeholder = el.dataset.assistantPlaceholder.replaceAll("{name}", ASSISTANT_NAME);
  });
}

export async function copyToClipboard(text, btnEl, defaultLabel = "Copy") {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
  }
  if (btnEl) {
    const origHtml = btnEl.innerHTML;
    btnEl.textContent = "Copied";
    setTimeout(() => {
      btnEl.innerHTML = origHtml || defaultLabel;
    }, 1500);
  }
}

export function applyTheme(theme) {
  state.theme = theme === "light" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", state.theme);
  localStorage.setItem(STORAGE_KEYS.theme, state.theme);
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) {
    metaTheme.setAttribute("content", state.theme === "dark" ? "#111215" : "#ffffff");
  }
  const sunIcon = $("theme-icon-sun");
  const moonIcon = $("theme-icon-moon");
  if (sunIcon) sunIcon.classList.toggle("hidden", state.theme === "light");
  if (moonIcon) moonIcon.classList.toggle("hidden", state.theme === "dark");
}

export function syncBackdrop() {
  const isMobile = window.innerWidth <= 1024;
  const leftSidebar = $("left-sidebar");
  const rightSidebar = $("right-sidebar");
  const backdrop = $("drawer-backdrop");
  if (!leftSidebar || !rightSidebar || !backdrop) return;
  const leftOpen = !leftSidebar.classList.contains("collapsed");
  const rightOpen = !rightSidebar.classList.contains("collapsed");
  backdrop.classList.toggle("active", isMobile && (leftOpen || rightOpen));
}

export function openLeftSidebar() {
  if (window.innerWidth <= 1024 && $("right-sidebar")) $("right-sidebar").classList.add("collapsed");
  if ($("left-sidebar")) $("left-sidebar").classList.remove("collapsed");
  syncBackdrop();
}

export function closeLeftSidebar() {
  if ($("left-sidebar")) $("left-sidebar").classList.add("collapsed");
  syncBackdrop();
}

export function openRightSidebar() {
  if (window.innerWidth <= 1024 && $("left-sidebar")) $("left-sidebar").classList.add("collapsed");
  if ($("right-sidebar")) $("right-sidebar").classList.remove("collapsed");
  syncBackdrop();
}

export function closeRightSidebar() {
  if ($("right-sidebar")) $("right-sidebar").classList.add("collapsed");
  syncBackdrop();
}

export function openCommandHubTab(tabName) {
  document.querySelectorAll(".hub-tab").forEach((t) => {
    t.classList.toggle("active", t.dataset.tab === tabName);
  });
  ["schedule", "todo", "notes", "vault"].forEach((name) => {
    const panel = $("panel-" + name);
    if (panel) panel.classList.toggle("hidden", name !== tabName);
  });
  openRightSidebar();
}

window.openCommandHubTab = openCommandHubTab;

export function openSelectTextModal(rawText) {
  const body = $("select-sheet-body");
  const modal = $("select-modal");
  if (body) body.textContent = rawText;
  if (modal) modal.classList.remove("hidden");
}

export function closeSelectTextModal() {
  const modal = $("select-modal");
  const body = $("select-sheet-body");
  if (modal) modal.classList.add("hidden");
  if (body) body.textContent = "";
}

export function openConfirmToolModal(summary, pendingTool) {
  state.pendingToolAction = pendingTool;
  const sumEl = $("confirm-tool-summary");
  const modal = $("confirm-tool-modal");
  if (sumEl) sumEl.textContent = summary || "Confirm this workspace action?";
  if (modal) modal.classList.remove("hidden");
}

export function closeConfirmToolModal() {
  state.pendingToolAction = null;
  const modal = $("confirm-tool-modal");
  if (modal) modal.classList.add("hidden");
}

export function openServerModal() {
  const input = $("server-url-input");
  const modal = $("server-modal");
  if (input) input.value = state.apiUrl;
  if (modal) modal.classList.remove("hidden");
}

export function closeServerModal() {
  const modal = $("server-modal");
  if (modal) modal.classList.add("hidden");
}


/* =============================================================================
   BATCH 5 - [12] 3D HOLLOW POINT-CLOUD SPHERE HUD CORE
   Crisp hollow 3D shell · slow breathing · swipe/drag rotation · voice sync
   Mobile-reliable, zero clipping, no shadowBlur, no per-particle gradients
   ============================================================================= */

// ---- Core state ----
let currentHudState = "idle"; // 'idle' | 'thinking' | 'responding'
let hudAnimFrameId  = null;
let isHudAnimRunning = false;

// Canvas logical size — set at init from actual element, with fallback
let HUD_W = 210;
let HUD_H = 210;

// ---- Voice / Audio Sync ----
let _hudVoiceLevel   = 0;      // 0.0–1.0
let _hudAudioAnalyser = null;
let _hudAnalyserBuf   = null;

// ---- Speech cadence (no AudioAnalyser path) ----
let _syllableEnv = 0;
const SYLLABLE_PATTERN = [0.9, 0.5, 1.0, 0.3, 0.8, 0.2, 0.95, 0.4, 0.7, 0.15];
let _syllableIdx  = 0;
let _syllableStep = 0;

// ---- Rotation state ----
// Slow baseline: ~0.18 rad/s Y, ~0.07 rad/s X at 60fps → ~0.003 rad/frame Y
let _rotX = 0.32;   // initial tilt
let _rotY = 0.0;
let _velX = 0.0;
let _velY = 0.003;  // gentle baseline Y drift
let _dragActive = false;
let _dragLastX  = 0;
let _dragLastY  = 0;
let _dragDeltaX = 0;
let _dragDeltaY = 0;
let _lastPointerType = "";  // 'mouse' | 'touch' | 'pen'

// ---- Breathing / hollow shell radius ----
// Radius breathes between R_MAX (68 px) and R_MIN (44 px) over ~6s
const HUD_R_MAX = 68;  // outer shell radius at exhale
const HUD_R_MIN = 44;  // inner hollow radius at inhale — NEVER collapses to 0
const HUD_BREATH_PERIOD = 6000; // ms per full breath cycle
let _breathMs = 0; // accumulates real milliseconds

// ---- Shape morph ----
// 4 clean hollow 3D formations, morph every 9 s
const SHAPES = ["fibonacci", "torus", "helix", "wave"];
const SHAPE_DURATION_MS = 9000;
let _shapeIdx    = 0;
let _shapeMorphT = 0;
let _shapeLastMs = 0;

/* -------------------------------------------------------------------------- */
/* Shape generators — all return unit-sphere normalized coords (‖v‖ ≈ 1)     */
/* -------------------------------------------------------------------------- */

// Hollow Fibonacci sphere — evenly distributed surface points
function shapeFibSphere(i, n) {
  const golden = Math.PI * (3 - Math.sqrt(5));
  const y  = 1 - (i / (n - 1)) * 2;
  const r  = Math.sqrt(Math.max(0, 1 - y * y));
  const th = golden * i;
  return { tx: Math.cos(th) * r, ty: y, tz: Math.sin(th) * r };
}

// Hollow Tilted Torus — tube points on a large ring, tilted 25°
function shapeTorus(i, n) {
  const ang     = (i / n) * Math.PI * 2;
  const tubeAng = (i * 6.5) % (Math.PI * 2);
  const bigR = 0.62, smallR = 0.30;
  const tilt = Math.PI / 7; // 25.7° tilt
  const x0 = (bigR + smallR * Math.cos(tubeAng)) * Math.cos(ang);
  const y0 = smallR * Math.sin(tubeAng);
  const z0 = (bigR + smallR * Math.cos(tubeAng)) * Math.sin(ang);
  // Tilt around X-axis
  return {
    tx: x0,
    ty: y0 * Math.cos(tilt) - z0 * Math.sin(tilt),
    tz: y0 * Math.sin(tilt) + z0 * Math.cos(tilt)
  };
}

// Double Helix Shell — two strands spiralling on a cylinder surface
function shapeHelix(i, n) {
  const t      = (i / n) * Math.PI * 5;
  const strand = (i % 2 === 0) ? 0 : Math.PI;
  const helR   = 0.55;
  const len    = (i / n) * 2 - 1; // -1 → 1 along Y
  // Push each point to unit sphere: normalize (helR * cos, len, helR * sin)
  const mag = Math.sqrt(helR * helR + len * len);
  const sc  = mag > 0 ? (1 / mag) : 1;
  return {
    tx: helR * Math.cos(t + strand) * sc,
    ty: len * sc,
    tz: helR * Math.sin(t + strand) * sc
  };
}

// Harmonic Wave Shell — sinusoidal lattice projected onto the sphere surface
function shapeWave(i, n) {
  const cols = 15;
  const col  = i % cols;
  const row  = Math.floor(i / cols);
  const rows = Math.ceil(n / cols);
  const u    = (col / (cols - 1)) * 2 - 1;  // -1 → 1
  const v    = (row / Math.max(rows - 1, 1)) * 2 - 1;
  const amp  = 0.28;
  const wy   = amp * Math.sin(u * Math.PI * 2.2 + v * Math.PI * 1.4);
  // Map (u, wy, v) onto unit sphere surface via normalization
  const mag  = Math.sqrt(u * u + wy * wy + v * v);
  const sc   = mag > 0.01 ? (1 / mag) : 1;
  return { tx: u * sc, ty: wy * sc, tz: v * sc };
}

function getShapeTarget(shapeKey, i, n) {
  switch (shapeKey) {
    case "torus": return shapeTorus(i, n);
    case "helix": return shapeHelix(i, n);
    case "wave":  return shapeWave(i, n);
    default:      return shapeFibSphere(i, n);
  }
}

/* -------------------------------------------------------------------------- */
/* Particle                                                                    */
/* -------------------------------------------------------------------------- */
class HudParticle {
  constructor(i, n) {
    this.i = i;
    this.n = n;
    // Start on hollow sphere at mid-radius
    const s = shapeFibSphere(i, n);
    const r0 = (HUD_R_MAX + HUD_R_MIN) * 0.5;
    this.x = s.tx * r0;
    this.y = s.ty * r0;
    this.z = s.tz * r0;
    // Spring velocities
    this.vx = 0; this.vy = 0; this.vz = 0;
    // Per-particle variety
    this.driftPhase = Math.random() * Math.PI * 2;
    this.driftAmp   = 0.6 + Math.random() * 0.9;   // subtle organic float
    this.driftFreq  = 0.00045 + Math.random() * 0.00035;
    // Size: 1.1px–2.3px range; depth-scaled at projection
    this.baseRadius  = 1.1 + Math.random() * 1.2;
    this.colorPhase  = Math.random();               // 0–1 palette position
    this.sparkPhase  = Math.random() * Math.PI * 2;
    this.sparkSpeed  = 0.025 + Math.random() * 0.03; // slower sparkle
    // Projected
    this.pz       = 0;
    this.screenX  = 0;
    this.screenY  = 0;
    this.screenAlpha = 1;
    this.screenR  = 1;
  }

  // Low-stiffness spring toward shell target; dt is real seconds clamped to 50ms
  applySpring(tx, ty, tz, stiffness, damping, dt) {
    this.vx += (tx - this.x) * stiffness * dt * 60;
    this.vy += (ty - this.y) * stiffness * dt * 60;
    this.vz += (tz - this.z) * stiffness * dt * 60;
    const damp = Math.pow(damping, dt * 60);
    this.vx *= damp; this.vy *= damp; this.vz *= damp;
    this.x += this.vx * dt * 60;
    this.y += this.vy * dt * 60;
    this.z += this.vz * dt * 60;
  }

  project(rotX, rotY, fov, cx, cy, timestamp) {
    const cosY = Math.cos(rotY), sinY = Math.sin(rotY);
    const cosX = Math.cos(rotX), sinX = Math.sin(rotX);
    // Organic micro-drift (very small — just a whisper of life)
    const drift = this.driftAmp * Math.sin(timestamp * this.driftFreq + this.driftPhase);
    let px = this.x + drift * 0.15;
    let py = this.y + drift * 0.20;
    let pz = this.z + drift * 0.10;
    // Y rotation
    const rx1 = px * cosY - pz * sinY;
    const rz1 = px * sinY + pz * cosY;
    // X rotation
    const ry2 = py * cosX - rz1 * sinX;
    const rz2 = py * sinX + rz1 * cosX;
    // Perspective projection
    this.pz = rz2;
    const perspScale = fov / (fov + rz2 + HUD_R_MAX);
    this.screenX = cx + rx1 * perspScale;
    this.screenY = cy + ry2 * perspScale;
    // Dot radius: 1.1–2.3px by depth
    const depthT = (rz2 + HUD_R_MAX) / (HUD_R_MAX * 2);  // 0=far, 1=near
    this.screenR = Math.max(0.5, this.baseRadius * (0.70 + 0.30 * depthT) * perspScale * 2.0);
    // Alpha: near = bright, far = dim (never zero — shell always visible)
    this.screenAlpha = 0.30 + 0.70 * depthT;
    this.sparkPhase += this.sparkSpeed;
  }
}

let hudParticles = [];

/* -------------------------------------------------------------------------- */
/* Dual-theme palette                                                          */
/* -------------------------------------------------------------------------- */
function getParticleColor(t, isLightMode) {
  const p = Math.max(0, Math.min(1, t));
  let r, g, b;
  if (isLightMode) {
    // Deep teal → cobalt → indigo → slate-violet
    if (p < 0.33) {
      const u = p / 0.33;
      r = Math.round(10  + 19  * u);
      g = Math.round(130 - 70  * u);
      b = Math.round(140 + 90  * u);
    } else if (p < 0.66) {
      const u = (p - 0.33) / 0.33;
      r = Math.round(29  + 71  * u);
      g = Math.round(60  - 32  * u);
      b = Math.round(230 - 50  * u);
    } else {
      const u = (p - 0.66) / 0.34;
      r = Math.round(100 + 30  * u);
      g = Math.round(28  + 10  * u);
      b = Math.round(180 - 40  * u);
    }
  } else {
    // Cyan/white → electric blue → soft violet
    if (p < 0.30) {
      const u = p / 0.30;
      r = Math.round(210 - 150 * u);
      g = Math.round(248 - 60  * u);
      b = 255;
    } else if (p < 0.65) {
      const u = (p - 0.30) / 0.35;
      r = Math.round(60  + 100 * u);
      g = Math.round(188 - 100 * u);
      b = Math.round(255 - 30  * u);
    } else {
      const u = (p - 0.65) / 0.35;
      r = Math.round(160 + 40  * u);
      g = Math.round(88  + 20  * u);
      b = Math.round(225 - 20  * u);
    }
  }
  return {
    r: Math.max(0, Math.min(255, r)),
    g: Math.max(0, Math.min(255, g)),
    b: Math.max(0, Math.min(255, b))
  };
}

/* -------------------------------------------------------------------------- */
/* Render                                                                      */
/* -------------------------------------------------------------------------- */
let _lastFrameTime = 0;

function renderHudFrame(timestamp) {
  const canvas = $("hud-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const n = hudParticles.length;
  if (n === 0) return;

  // Real delta-time, clamped to 50ms (20fps floor) to avoid jumps on tab-blur wakeup
  const dtMs = _lastFrameTime > 0 ? Math.min(timestamp - _lastFrameTime, 50) : 16.67;
  _lastFrameTime = timestamp;
  const dt = dtMs / 1000; // seconds

  const isLight = state.theme === "light";
  const cx = HUD_W * 0.5;
  const cy = HUD_H * 0.5;

  // ---- Audio analyser ----
  if (_hudAudioAnalyser && _hudAnalyserBuf) {
    _hudAudioAnalyser.getByteFrequencyData(_hudAnalyserBuf);
    let sum = 0;
    for (let i = 0; i < _hudAnalyserBuf.length; i++) sum += _hudAnalyserBuf[i];
    _hudVoiceLevel = Math.min(1, (sum / _hudAnalyserBuf.length) / 128);
  }

  // ---- Speech cadence envelope (no live analyser) ----
  _syllableStep++;
  if (currentHudState === "responding" && !_hudAudioAnalyser) {
    if (_syllableStep % 7 === 0) {
      _syllableIdx = (_syllableIdx + 1) % SYLLABLE_PATTERN.length;
    }
    _syllableEnv += (SYLLABLE_PATTERN[_syllableIdx] - _syllableEnv) * 0.08;
    _hudVoiceLevel = _syllableEnv * 0.55;
  } else if (currentHudState !== "responding") {
    _syllableEnv += (0 - _syllableEnv) * 0.05;
    if (!_hudAudioAnalyser) _hudVoiceLevel = _syllableEnv;
  }

  // ---- Breathing hollow shell radius (~6s cycle) ----
  _breathMs += dtMs;
  const breathCycle = (_breathMs % HUD_BREATH_PERIOD) / HUD_BREATH_PERIOD; // 0→1
  // Smooth sine: 0=exhale(R_MAX), 0.5=inhale(R_MIN)
  const breathT = 0.5 - 0.5 * Math.cos(breathCycle * Math.PI * 2);

  // 'thinking' tightens shell slightly inward; voice adds subtle ripple outward
  let shellR;
  if (currentHudState === "thinking") {
    // Tighter shell: oscillates between R_MIN+4 and R_MAX-10
    shellR = (HUD_R_MIN + 4) + ((HUD_R_MAX - 10) - (HUD_R_MIN + 4)) * (1 - breathT * 0.6);
  } else {
    shellR = HUD_R_MIN + (HUD_R_MAX - HUD_R_MIN) * (1 - breathT);
  }
  // Voice ripple: subtle outward push on shell (never blows out)
  shellR += _hudVoiceLevel * 7;
  // Hard clamp — shell NEVER collapses to or past hollow center
  shellR = Math.max(HUD_R_MIN, Math.min(HUD_R_MAX + 8, shellR));

  // ---- Shape morphing ----
  const shapeElapsed = timestamp - _shapeLastMs;
  _shapeMorphT = Math.min(1, shapeElapsed / SHAPE_DURATION_MS);
  if (_shapeMorphT >= 1) {
    _shapeIdx    = (_shapeIdx + 1) % SHAPES.length;
    _shapeLastMs = timestamp;
    _shapeMorphT = 0;
  }
  const morphSmooth = _shapeMorphT * _shapeMorphT * (3 - 2 * _shapeMorphT); // smoothstep
  const curShape  = SHAPES[_shapeIdx];
  const nextShape = SHAPES[(_shapeIdx + 1) % SHAPES.length];

  // ---- State-driven spring params ----
  let stiffness, damping;
  if (currentHudState === "thinking") {
    stiffness = 0.028; damping = 0.78;
  } else if (currentHudState === "responding") {
    stiffness = 0.018; damping = 0.82;
  } else {
    stiffness = 0.012; damping = 0.86;
  }

  // ---- Slow baseline rotation with delta-time ----
  if (!_dragActive) {
    const baseVY = 0.003; // ~0.18 rad/s at 60fps
    const baseVX = 0.0012;
    // Inertia decay after drag, then settle to baseline
    _velY += (baseVY - _velY) * 0.025;
    _velX += (0      - _velX) * 0.030;
    // Gentle X tilt correction
    _rotX += (_rotX < 0.32 ? 0.32 - _rotX : 0) * 0.004;
    _rotY += _velY;
    _rotX += _velX;
  }

  // Perspective FOV — fixed, comfortable depth
  const fov = 240;

  // ---- Update particles — spring toward hollow shell surface ----
  for (let i = 0; i < n; i++) {
    const p   = hudParticles[i];
    const cur = getShapeTarget(curShape,  i, n);
    const nxt = getShapeTarget(nextShape, i, n);
    // Blend shape targets (unit sphere coords) then scale to current shell radius
    const ux = cur.tx * (1 - morphSmooth) + nxt.tx * morphSmooth;
    const uy = cur.ty * (1 - morphSmooth) + nxt.ty * morphSmooth;
    const uz = cur.tz * (1 - morphSmooth) + nxt.tz * morphSmooth;
    // Normalize to stay exactly on the shell surface
    const umag = Math.sqrt(ux * ux + uy * uy + uz * uz);
    const us   = umag > 0.001 ? (shellR / umag) : shellR;
    p.applySpring(ux * us, uy * us, uz * us, stiffness, damping, dt);
    p.project(_rotX, _rotY, fov, cx, cy, timestamp);
  }

  // ---- Depth sort back-to-front ----
  hudParticles.sort((a, b) => a.pz - b.pz);

  // ---- Draw — crisp dots only, no shadowBlur, no per-particle radial gradients ----
  ctx.clearRect(0, 0, HUD_W, HUD_H);

  // Dark mode: 'lighter' blend gives natural additive glow at dot intersections
  // Light mode: 'source-over' keeps dots crisp and opaque on white background
  ctx.globalCompositeOperation = isLight ? "source-over" : "lighter";

  for (const p of hudParticles) {
    const sparkle = 0.78 + 0.22 * Math.sin(p.sparkPhase);
    const alpha   = p.screenAlpha * sparkle * (isLight ? 0.88 : 0.82);
    if (alpha < 0.04) continue;

    const { r, g, b } = getParticleColor(p.colorPhase, isLight);
    const sz = Math.max(0.5, p.screenR);

    // Dark mode: tiny halo ring (pure fill, no shadowBlur) for depth perception
    if (!isLight) {
      ctx.beginPath();
      ctx.arc(p.screenX, p.screenY, sz * 1.9, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${r},${g},${b},${(alpha * 0.14).toFixed(3)})`;
      ctx.fill();
    }

    // Core dot — sharp, crisp
    ctx.beginPath();
    ctx.arc(p.screenX, p.screenY, sz, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${r},${g},${b},${alpha.toFixed(3)})`;
    ctx.fill();
  }

  ctx.globalCompositeOperation = "source-over";
}

/* -------------------------------------------------------------------------- */
/* Animation loop                                                              */
/* -------------------------------------------------------------------------- */
function hudAnimLoop(timestamp) {
  const canvas  = $("hud-canvas");
  const welcome = $("welcome-view");
  if (
    !canvas || !welcome ||
    welcome.classList.contains("hidden") ||
    welcome.offsetParent === null ||
    document.hidden
  ) {
    stopHudAnimation();
    return;
  }
  renderHudFrame(timestamp);
  hudAnimFrameId = requestAnimationFrame(hudAnimLoop);
}

export function startHudAnimation() {
  if (isHudAnimRunning) return;
  const canvas  = $("hud-canvas");
  const welcome = $("welcome-view");
  if (!canvas || !welcome) return;
  if (welcome.classList.contains("hidden") || welcome.offsetParent === null || document.hidden) return;
  isHudAnimRunning = true;
  _lastFrameTime   = 0;
  _shapeLastMs     = performance.now();
  hudAnimFrameId   = requestAnimationFrame(hudAnimLoop);
}

export function stopHudAnimation() {
  if (hudAnimFrameId) {
    cancelAnimationFrame(hudAnimFrameId);
    hudAnimFrameId = null;
  }
  isHudAnimRunning = false;
}

/**
 * Voice sync API — set by TTS or streaming envelope.
 * @param {number} level  0.0–1.0 audio energy
 */
export function setHudVoiceLevel(level, _bands = null) {
  _hudVoiceLevel = Math.max(0, Math.min(1, level));
}

/**
 * Bind a Web Audio AnalyserNode for real-time audio-driven HUD displacement.
 * Pass null to detach.
 */
export function bindHudAudioAnalyser(analyserNode) {
  _hudAudioAnalyser = analyserNode || null;
  _hudAnalyserBuf   = analyserNode
    ? new Uint8Array(analyserNode.frequencyBinCount)
    : null;
}

/**
 * Updates HUD state and starts animation.
 * @param {'idle'|'thinking'|'responding'} newState
 */
export function setHudState(newState) {
  const core  = $("hud-core");
  const label = $("hud-state-text");
  if (!core) return;

  const validState = ["idle", "thinking", "responding"].includes(newState) ? newState : "idle";
  currentHudState  = validState;

  core.classList.remove("idle", "thinking", "responding");
  core.classList.add(validState);
  core.dataset.state = validState;

  if (label) {
    switch (validState) {
      case "thinking":   label.textContent = "COMPUTING...";    break;
      case "responding": label.textContent = "SYNTHESIZING..."; break;
      default:           label.textContent = "CORE ONLINE";     break;
    }
  }

  startHudAnimation();
}

export function getHudState() {
  return currentHudState;
}

/* -------------------------------------------------------------------------- */
/* Pointer / touch drag helpers — bound to #hud-core so they work on mobile  */
/* -------------------------------------------------------------------------- */
function hudDragStart(x, y) {
  _dragActive = true;
  _dragLastX  = x; _dragLastY  = y;
  _dragDeltaX = 0; _dragDeltaY = 0;
}
function hudDragMove(x, y) {
  if (!_dragActive) return;
  _dragDeltaX = x - _dragLastX;
  _dragDeltaY = y - _dragLastY;
  _rotY += _dragDeltaX * 0.010;
  _rotX += _dragDeltaY * 0.010;
  _dragLastX = x; _dragLastY = y;
}
function hudDragEnd() {
  if (!_dragActive) return;
  _dragActive = false;
  // Hand residual momentum into inertia velocities; they decay back to baseline
  _velY = _dragDeltaX * 0.010;
  _velX = _dragDeltaY * 0.010;
}

/* -------------------------------------------------------------------------- */
/* Canvas sizing helper — called at init and on ResizeObserver                */
/* -------------------------------------------------------------------------- */
function resizeHudCanvas(canvas, core) {
  // Use CSS size, fall back to 180 if element hasn't painted yet
  let w = core.offsetWidth  || 180;
  let h = core.offsetHeight || 180;
  if (w < 10) w = 180;
  if (h < 10) h = 180;
  HUD_W = w;
  HUD_H = h;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width  = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  canvas.style.width  = `${w}px`;
  canvas.style.height = `${h}px`;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.setTransform(1, 0, 0, 1, 0, 0); // reset before re-scaling
    ctx.scale(dpr, dpr);
  }
}

/* -------------------------------------------------------------------------- */
/* initHudCore                                                                 */
/* -------------------------------------------------------------------------- */
export function initHudCore() {
  const core = $("hud-core");
  if (!core) return;

  // Ensure canvas exists
  let canvas = $("hud-canvas");
  if (!canvas) {
    canvas = document.createElement("canvas");
    canvas.id        = "hud-canvas";
    canvas.className = "hud-canvas";
    core.prepend(canvas);
  }

  // Initial sizing (waits one rAF so CSS has applied dimensions)
  requestAnimationFrame(() => {
    resizeHudCanvas(canvas, core);

    // ResizeObserver — handles mobile viewport resize, orientation change, etc.
    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(() => {
        resizeHudCanvas(canvas, core);
        // Re-draw one frame immediately after resize so canvas isn't blank
        if (!isHudAnimRunning) renderHudFrame(performance.now());
      });
      ro.observe(core);
    }
  });

  // Allow pointer events on canvas for drag
  canvas.style.pointerEvents = "auto";

  // ---- Init particles (220 crisp points on the hollow shell) ----
  const N = 220;
  hudParticles = [];
  for (let i = 0; i < N; i++) {
    hudParticles.push(new HudParticle(i, N));
  }

  // ---- Pointer events on #hud-core (covers both canvas and label area) ----
  // Using setPointerCapture for reliable mobile tracking
  core.addEventListener("pointerdown", (e) => {
    if (e.button !== undefined && e.button > 0) return; // right/middle click ignore
    e.preventDefault();
    _lastPointerType = e.pointerType;
    core.setPointerCapture(e.pointerId);
    hudDragStart(e.clientX, e.clientY);
  });
  core.addEventListener("pointermove", (e) => {
    hudDragMove(e.clientX, e.clientY);
  });
  core.addEventListener("pointerup",     () => { hudDragEnd(); });
  core.addEventListener("pointercancel", () => { hudDragEnd(); });

  // Touch fallback (for browsers with partial Pointer Events support)
  core.addEventListener("touchstart", (e) => {
    if (e.touches.length !== 1) return;
    e.preventDefault();
    hudDragStart(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: false });
  core.addEventListener("touchmove", (e) => {
    if (e.touches.length !== 1) return;
    e.preventDefault();
    hudDragMove(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: false });
  core.addEventListener("touchend",    () => { hudDragEnd(); });
  core.addEventListener("touchcancel", () => { hudDragEnd(); });

  // Click cycles HUD state (only if not a drag)
  let _wasDrag = false;
  core.addEventListener("pointerdown", () => { _wasDrag = false; });
  core.addEventListener("pointermove", (e) => {
    if (e.buttons > 0) _wasDrag = true;
  });
  core.addEventListener("click", () => {
    if (_wasDrag) return;
    const states = ["idle", "thinking", "responding"];
    setHudState(states[(states.indexOf(currentHudState) + 1) % states.length]);
  });

  // Tab visibility
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      stopHudAnimation();
      _lastFrameTime = 0; // reset dt so no jump on return
    } else {
      startHudAnimation();
    }
  });

  // Welcome view observer (stops animation when chat view is active)
  const welcome = $("welcome-view");
  if (welcome) {
    const obs = new MutationObserver(() => {
      if (welcome.classList.contains("hidden") || welcome.offsetParent === null) {
        stopHudAnimation();
      } else {
        startHudAnimation();
      }
    });
    obs.observe(welcome, { attributes: true, attributeFilter: ["class", "style"] });
  }

  setHudState("idle");
  startHudAnimation();
}

window.setHudState        = setHudState;
window.getHudState        = getHudState;
window.startHudAnimation  = startHudAnimation;
window.stopHudAnimation   = stopHudAnimation;
window.setHudVoiceLevel   = setHudVoiceLevel;
window.bindHudAudioAnalyser = bindHudAudioAnalyser;


/* =============================================================================
   BATCH 4 - [18] GLASSMORPHIC BRIEFING CARDS (SCHEDULE & WARMUP)
   Strictly text-chat driven, reactive to real workspace state
   ============================================================================= */

export function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

let currentWarmupIndex = 0;

export const BSIT_WARMUP_POOL = [
  {
    subject: "BSIT • Network Engineering & CIDR",
    badge: "BSIT Networking",
    badgeClass: "amber",
    question: "Given the IPv4 block 192.168.42.0/26, determine: (1) Subnet mask in dotted-decimal, (2) Total vs usable host capacity, (3) Network and broadcast IP addresses, and (4) First and last usable host IPs.",
    hint: "A /26 borrows 2 host bits from the 4th octet (mask 255.255.255.192), giving block increments of 64.",
    prompt: "Solve this network engineering problem: Given IP block 192.168.42.0/26, determine the subnet mask, usable host range, and broadcast address step-by-step.",
    actionLabel: "Derive with J.A.R.V.I.S."
  },
  {
    subject: "BSIT • Database Systems & SQL Optimization",
    badge: "Database Arch",
    badgeClass: "purple",
    question: "In PostgreSQL, a query `SELECT * FROM orders WHERE customer_id = 42 AND created_at >= '2026-01-01' ORDER BY created_at DESC LIMIT 10;` causes a slow sequential scan. Propose the optimal composite B-Tree index and explain the execution plan.",
    hint: "Multi-column index rule: equality condition column first (`customer_id`), followed by range/sort condition (`created_at DESC`).",
    prompt: "Optimize this SQL query: `SELECT * FROM orders WHERE customer_id = 42 AND created_at >= '2026-01-01' ORDER BY created_at DESC LIMIT 10;`. Explain composite index design (customer_id, created_at DESC) and execution plan differences.",
    actionLabel: "Optimize with J.A.R.V.I.S."
  },
  {
    subject: "Computer Science • Asynchronous Programming",
    badge: "Concurrency",
    badgeClass: "",
    question: "Design an async concurrency limiter (`p-limit`) in JavaScript or Python that accepts an array of asynchronous tasks and executes at most `K` concurrent promises at any given moment.",
    hint: "Use an internal counter or Semaphore pattern to track running workers, resolving next tasks as slots open.",
    prompt: "Implement a robust concurrency limiter in JavaScript/Python for async tasks with maximum concurrency K, complete with error handling and Promise.all completion.",
    actionLabel: "Implement with J.A.R.V.I.S."
  },
  {
    subject: "Applied Mathematics • Discrete Math & K-Maps",
    badge: "Logic Synthesis",
    badgeClass: "amber",
    question: "Simplify the 4-variable Boolean expression F(A,B,C,D) = Σm(0, 2, 5, 7, 8, 10, 13, 15) using a Karnaugh Map. Identify all prime implicants and write the minimal SOP form.",
    hint: "Corner grouping (m0, m2, m8, m10) eliminates variables A and C, yielding B'D'.",
    prompt: "Simplify the Boolean function F(A,B,C,D) = Σm(0, 2, 5, 7, 8, 10, 13, 15) using a 4x4 Karnaugh Map. Show step-by-step grouping and derive minimal SOP.",
    actionLabel: "Derive with J.A.R.V.I.S."
  },
  {
    subject: "BSIT • Web Security & Defense-in-Depth",
    badge: "Cybersecurity",
    badgeClass: "purple",
    question: "Explain the threat vector of Cross-Site Request Forgery (CSRF) vs Cross-Site Scripting (XSS), and demonstrate why `SameSite=Strict` cookies combined with Anti-CSRF tokens provide defense-in-depth.",
    hint: "XSS executes malicious scripts in victim's origin; CSRF tricks victim's browser into sending authenticated requests to target origin.",
    prompt: "Provide an in-depth security briefing comparing CSRF and XSS attacks. Include vulnerable HTTP transaction examples and defensive implementations (SameSite cookies, CSRF tokens, CSP headers).",
    actionLabel: "Analyze with J.A.R.V.I.S."
  },
  {
    subject: "Engineering Calculus • Differential Equations",
    badge: "Calculus",
    badgeClass: "",
    question: "Solve the second-order linear differential equation modeling an unforced RLC circuit: y''(t) + 6y'(t) + 25y(t) = 0 with initial conditions y(0) = 2 and y'(0) = 0.",
    hint: "Characteristic equation r² + 6r + 25 = 0 yields complex roots r = -3 ± 4i (underdamped harmonic oscillation).",
    prompt: "Solve the second-order differential equation y''(t) + 6y'(t) + 25y(t) = 0 with y(0) = 2, y'(0) = 0. Show characteristic polynomial roots, general solution, and plot description.",
    actionLabel: "Solve with J.A.R.V.I.S."
  }
];

/**
 * Builds candidate warmups combining pending tasks, vault topics, and BSIT pool.
 */
function getDynamicWarmupList() {
  const list = [];

  // 1. Pending high-priority or general tasks from workspace state
  const pendingTasks = (state.todos || []).filter((t) => !t.done);
  if (pendingTasks.length > 0) {
    const topTask = pendingTasks[0];
    const prioLabel = topTask.priority ? topTask.priority.toUpperCase() : "ACTIVE";
    list.push({
      subject: `Pending Action Item • ${prioLabel} PRIORITY`,
      badge: "Task Objective",
      badgeClass: topTask.priority === "high" ? "amber" : "",
      question: `Workspace Task: "${topTask.text}". Ready to execute? Let J.A.R.V.I.S. assist with system architecture, code scaffolding, or derivation.`,
      hint: `Tackling pending task 1 of ${pendingTasks.length}. Completing primary objectives first compounds daily velocity.`,
      prompt: `Help me complete this pending workspace task: "${topTask.text}". Provide a comprehensive technical solution, architecture breakdown, and full implementation code.`,
      actionLabel: "Execute with J.A.R.V.I.S."
    });
  }

  // 2. Study Vault indexed resources
  const vaultItems = state.vault || [];
  if (vaultItems.length > 0) {
    const topDoc = vaultItems[0];
    list.push({
      subject: `Study Vault Deep-Dive • ${topDoc.name}`,
      badge: "Vault Checkpoint",
      badgeClass: "purple",
      question: `Technical review from your indexed vault material "${topDoc.name}". Test your conceptual understanding of core algorithms, architectural patterns, and formulas.`,
      hint: `Indexed document (${topDoc.content.length.toLocaleString()} characters). Active recall cements technical proficiency.`,
      prompt: `Quiz me on key principles, formulas, and technical details from my Study Vault document "${topDoc.name}". Provide 3 progressive technical questions with solutions.`,
      actionLabel: "Quiz from Vault"
    });
  }

  // 3. Append practical BSIT / programming / math rotation pool
  list.push(...BSIT_WARMUP_POOL);

  return list;
}

/**
 * Creates a translucent glassmorphic card element with backdrop blur and sleek borders.
 */
export function createGlassBriefingCard({ title, subtitle, iconHtml, badgeText, badgeClass = "", contentHtml = "", actionsHtml = "" }) {
  const card = document.createElement("div");
  card.className = "glassmorphic-card chat-inline-briefing";

  card.innerHTML = `
    <div class="briefing-card-head">
      <div class="briefing-title-group">
        <div class="briefing-icon-badge ${badgeClass}">
          ${iconHtml || `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="4" width="18" height="18" rx="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>`}
        </div>
        <div>
          <h3 class="briefing-title">${escapeHtml(title || "Mission Briefing")}</h3>
          ${subtitle ? `<p class="briefing-subtitle">${escapeHtml(subtitle)}</p>` : ""}
        </div>
      </div>
      ${badgeText ? `<span class="briefing-meta-pill">${escapeHtml(badgeText)}</span>` : ""}
    </div>
    <div class="briefing-card-body">
      ${contentHtml}
    </div>
    ${actionsHtml ? `<div class="briefing-card-actions" style="margin-top: 12px; display: flex; justify-content: flex-end; gap: 8px;">${actionsHtml}</div>` : ""}
  `;

  return card;
}

/**
 * Creates a Schedule Briefing Card from real pending schedule items in workspace state.
 * Matches live Schedule count and displays clean empty state when no items exist.
 */
export function createScheduleBriefingCard(customItems = null) {
  // Use real pending schedule items from workspace state (matching live Schedule count)
  const pendingItems = customItems !== null
    ? customItems
    : (state.schedule || []).filter((s) => !s.done);

  const count = pendingItems.length;
  const badgeText = `${count} ${count === 1 ? "Pending" : "Pending"}`;

  let contentHtml = "";
  let actionsHtml = "";

  if (count === 0) {
    contentHtml = `
      <div class="briefing-empty-state">
        <div class="briefing-empty-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </div>
        <div class="briefing-empty-title">Schedule clear, sir.</div>
        <div class="briefing-empty-sub">No pending classes, exams, or assignment deadlines today.</div>
      </div>
    `;
    actionsHtml = `
      <button class="briefing-action-btn" type="button" onclick="window.openCommandHubTab('schedule')">
        + Add to Schedule
      </button>
    `;
  } else {
    contentHtml = `
      <div class="briefing-schedule-list">
        ${pendingItems.map((item) => {
          const tagClass = (item.category || item.tag || "class").toLowerCase();
          return `
            <div class="briefing-schedule-row">
              <div class="briefing-item-main">
                <span class="briefing-time-tag">${escapeHtml(item.time || "TBD")}</span>
                <span class="briefing-item-label">${escapeHtml(item.title || "Untitled Event")}</span>
              </div>
              <span class="briefing-category-badge ${tagClass}">${escapeHtml(item.category || item.tag || "Class")}</span>
            </div>
          `;
        }).join("")}
      </div>
    `;
    actionsHtml = `
      <button class="briefing-action-btn" type="button" onclick="window.openCommandHubTab('schedule')">
        Open Schedule Inspector &rarr;
      </button>
    `;
  }

  return createGlassBriefingCard({
    title: "Daily Academic Schedule",
    subtitle: "Active lectures, deadlines & examination checkpoints",
    badgeText,
    contentHtml,
    actionsHtml,
  });
}

/**
 * Creates an Engineering / BSIT Warmup Briefing Card.
 * Dynamically pulls from pending Tasks / Study Vault topics or rotates practical BSIT/programming/math warmups.
 */
export function createWarmupBriefingCard(customWarmup = null) {
  const dynamicList = getDynamicWarmupList();
  const safeIdx = Math.abs(currentWarmupIndex) % dynamicList.length;
  const warmup = customWarmup || dynamicList[safeIdx];

  const contentHtml = `
    <div class="briefing-warmup-container">
      <div style="font-size: 0.78rem; font-weight: 600; color: #fbbf24; text-transform: uppercase; letter-spacing: 0.06em;">
        ${escapeHtml(warmup.subject)}
      </div>
      <div class="briefing-warmup-problem">
        ${escapeHtml(warmup.question)}
      </div>
      ${warmup.hint ? `<div style="font-size: 0.76rem; color: var(--text-secondary); font-style: italic;">Hint: ${escapeHtml(warmup.hint)}</div>` : ""}
    </div>
  `;

  const actionsHtml = `
    <button class="briefing-action-btn" type="button" id="rotate-warmup-btn" style="background: rgba(255, 255, 255, 0.05); color: var(--text-secondary); border-color: rgba(255, 255, 255, 0.1);">
      Rotate Warmup &#x21bb;
    </button>
    <button class="briefing-action-btn" type="button" data-warmup-prompt="${escapeHtml(warmup.prompt)}">
      ${escapeHtml(warmup.actionLabel || "Derive with J.A.R.V.I.S.")}
    </button>
  `;

  const card = createGlassBriefingCard({
    title: "Morning Engineering Warmup",
    subtitle: "Calculus, BSIT systems & technical challenge",
    iconHtml: `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
      </svg>
    `,
    badgeClass: warmup.badgeClass || "amber",
    badgeText: warmup.badge || "Warmup Core",
    contentHtml,
    actionsHtml,
  });

  // Attach button prompt handler
  const promptBtn = card.querySelector("[data-warmup-prompt]");
  if (promptBtn) {
    promptBtn.addEventListener("click", () => {
      const promptInput = $("prompt-input");
      if (promptInput) {
        promptInput.value = promptBtn.dataset.warmupPrompt;
        promptInput.focus();
        promptInput.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });
  }

  // Attach rotate warmup button handler
  const rotateBtn = card.querySelector("#rotate-warmup-btn");
  if (rotateBtn) {
    rotateBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      rotateWarmupBriefing();
    });
  }

  return card;
}

/**
 * Rotates to the next engineering / BSIT warmup challenge and refreshes slot.
 */
export function rotateWarmupBriefing() {
  currentWarmupIndex++;
  updateWelcomeBriefing();
}

/**
 * Reactively updates the welcome briefing slot with real workspace schedule & dynamic warmup.
 */
export function updateWelcomeBriefing() {
  const slot = $("welcome-briefing-slot");
  if (!slot) return;

  slot.innerHTML = "";
  const scheduleCard = createScheduleBriefingCard();
  const warmupCard = createWarmupBriefingCard();

  slot.appendChild(scheduleCard);
  slot.appendChild(warmupCard);
}

/**
 * Initializes glassmorphic briefing slot in welcome view.
 */
export function initWelcomeBriefing() {
  updateWelcomeBriefing();
}

/**
 * Strictly text-chat driven inline briefing card parser.
 * Scans a chat message element for briefing tags or patterns and mounts glassmorphic cards.
 */
export function parseAndRenderInlineBriefings(messageEl) {
  if (!messageEl) return;

  const text = messageEl.innerText || "";

  // Check for explicit markers or keywords in text-chat
  const hasScheduleBriefing = text.includes("[SCHEDULE_BRIEFING]") ||
    (text.includes("### Schedule Briefing") && text.includes("Class"));
  const hasWarmupBriefing = text.includes("[WARMUP_BRIEFING]") ||
    (text.includes("### Engineering Warmup") || text.includes("### Morning Warmup"));

  if (hasScheduleBriefing && !messageEl.querySelector(".glassmorphic-card.schedule-card")) {
    const card = createScheduleBriefingCard();
    card.classList.add("schedule-card");
    messageEl.appendChild(card);
  }

  if (hasWarmupBriefing && !messageEl.querySelector(".glassmorphic-card.warmup-card")) {
    const card = createWarmupBriefingCard();
    card.classList.add("warmup-card");
    messageEl.appendChild(card);
  }
}

window.createGlassBriefingCard = createGlassBriefingCard;
window.createScheduleBriefingCard = createScheduleBriefingCard;
window.createWarmupBriefingCard = createWarmupBriefingCard;
window.updateWelcomeBriefing = updateWelcomeBriefing;
window.rotateWarmupBriefing = rotateWarmupBriefing;
window.parseAndRenderInlineBriefings = parseAndRenderInlineBriefings;


/* =============================================================================
   BATCH 4 - [21] PRISM SYNTAX HIGHLIGHTING (C#, Java, Python, SQL, HTML/CSS/JS, C/C++/Verilog)
   ============================================================================= */

const LANGUAGE_ALIASES = {
  "c#": "csharp",
  "cs": "csharp",
  "csharp": "csharp",
  "java": "java",
  "py": "python",
  "python": "python",
  "sql": "sql",
  "html": "markup",
  "xml": "markup",
  "svg": "markup",
  "markup": "markup",
  "css": "css",
  "js": "javascript",
  "javascript": "javascript",
  "ts": "typescript",
  "typescript": "typescript",
  "c": "c",
  "cpp": "cpp",
  "c++": "cpp",
  "cc": "cpp",
  "cxx": "cpp",
  "h": "c",
  "hpp": "cpp",
  "v": "verilog",
  "sv": "verilog",
  "verilog": "verilog",
  "systemverilog": "verilog",
  "json": "json",
  "bash": "bash",
  "sh": "bash",
  "yaml": "yaml",
  "yml": "yaml",
  "latex": "latex",
  "tex": "latex"
};

const LANGUAGE_LABELS = {
  csharp: "CSHARP",
  java: "JAVA",
  python: "PYTHON",
  sql: "SQL",
  markup: "HTML",
  css: "CSS",
  javascript: "JAVASCRIPT",
  typescript: "TYPESCRIPT",
  c: "C",
  cpp: "C++",
  verilog: "VERILOG",
  json: "JSON",
  bash: "BASH",
  yaml: "YAML",
  latex: "LATEX"
};

/**
 * Normalizes language name into Prism-compatible language slug.
 */
export function normalizeLanguageSlug(rawLang) {
  if (!rawLang) return "text";
  const clean = rawLang.trim().toLowerCase().replace(/^language-/, "").replace(/^lang-/, "");
  return LANGUAGE_ALIASES[clean] || clean;
}

export function getLanguageDisplayName(slug) {
  const norm = normalizeLanguageSlug(slug);
  return LANGUAGE_LABELS[norm] || (norm && norm !== "text" ? norm.toUpperCase() : "CODE");
}

/**
 * Enhances a pre/code block with language toolbar, copy button, and Prism highlight.
 * Detects if pre already has a Markdown header/copy bar and highlights in-place without duplicate bars.
 */
export function highlightCodeBlock(preEl) {
  if (!preEl || preEl.dataset.prismEnhanced === "true") return;

  const codeEl = preEl.querySelector("code") || preEl;
  let rawLang = "";

  // 1. Extract language from pre or code classes
  const classes = `${preEl.className} ${codeEl.className}`.split(/\s+/);
  for (const cls of classes) {
    if (cls.startsWith("language-") || cls.startsWith("lang-")) {
      rawLang = cls;
      break;
    }
  }

  // 2. Check if a parent/sibling Markdown header already exists
  const existingWrapper = preEl.closest(".code-wrapper, .code-block-wrapper");
  const existingHeader =
    existingWrapper?.querySelector(".code-header, .code-block-header") ||
    (preEl.previousElementSibling?.classList.contains("code-header") ? preEl.previousElementSibling : null);

  if (!rawLang && existingHeader) {
    const spanText = existingHeader.querySelector("span")?.textContent?.trim();
    if (spanText && spanText.toLowerCase() !== "code") {
      rawLang = spanText;
    }
  }

  const lang = normalizeLanguageSlug(rawLang);
  const displayLabel = getLanguageDisplayName(lang);

  if (lang !== "text") {
    codeEl.className = `language-${lang}`;
    preEl.className = `language-${lang}`;
  }

  if (existingHeader) {
    // Markdown header already present: update display label and wire copy button in-place
    const labelSpan = existingHeader.querySelector("span") || existingHeader.querySelector(".code-lang-label");
    if (labelSpan && displayLabel && displayLabel !== "CODE") {
      labelSpan.textContent = displayLabel;
    }
    const copyBtn = existingHeader.querySelector(".copy-code-btn, .code-copy-btn");
    if (copyBtn && !copyBtn.dataset.prismWired) {
      copyBtn.dataset.prismWired = "true";
      copyBtn.addEventListener("click", () => {
        copyToClipboard(codeEl.innerText, copyBtn, "Copy");
      });
    }
  } else if (!existingWrapper) {
    // Standalone <pre> without any wrapper or header: inject a single wrapper
    const wrapper = document.createElement("div");
    wrapper.className = "code-block-wrapper";

    const header = document.createElement("div");
    header.className = "code-block-header";

    const langLabel = document.createElement("span");
    langLabel.className = "code-lang-label";
    langLabel.textContent = displayLabel;

    const copyBtn = document.createElement("button");
    copyBtn.className = "code-copy-btn";
    copyBtn.type = "button";
    copyBtn.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
      </svg>
      <span>Copy</span>
    `;

    copyBtn.addEventListener("click", () => {
      copyToClipboard(codeEl.innerText, copyBtn.querySelector("span") || copyBtn, "Copy");
    });

    header.appendChild(langLabel);
    header.appendChild(copyBtn);

    preEl.parentNode.insertBefore(wrapper, preEl);
    wrapper.appendChild(header);
    wrapper.appendChild(preEl);
  }

  preEl.dataset.prismEnhanced = "true";

  // Invoke Prism highlighter if available
  if (window.Prism && typeof window.Prism.highlightElement === "function" && lang !== "text") {
    try {
      window.Prism.highlightElement(codeEl);
    } catch {
      // Graceful fallback to raw code
    }
  }
}

/**
 * Highlights all code blocks within a container element.
 */
export function highlightAllCode(container = document) {
  const codePres = container.querySelectorAll("pre");
  codePres.forEach((pre) => highlightCodeBlock(pre));
}

/**
 * Sets up Prism syntax highlighting observer for incoming messages.
 */
export function initSyntaxHighlighting() {
  const messagesContainer = $("messages-container");
  if (!messagesContainer) return;

  highlightAllCode(messagesContainer);

  const observer = new MutationObserver((mutations) => {
    let shouldScan = false;
    for (const m of mutations) {
      if (m.addedNodes.length > 0) {
        shouldScan = true;
        break;
      }
    }
    if (shouldScan) {
      highlightAllCode(messagesContainer);
    }
  });

  observer.observe(messagesContainer, { childList: true, subtree: true });
}

window.highlightAllCode = highlightAllCode;
window.initSyntaxHighlighting = initSyntaxHighlighting;


/* =============================================================================
   BATCH 4 - [21] CLEAN FULL-SCREEN MEDIA VIEWER WITH ANNOTATION & SKETCH TOOLS
   Supports both <img> and cloned <svg> with zoom, pan, sketch, text, swatches, undo/redo
   ============================================================================= */

let diagramScale = 1;
let diagramPanX = 0;
let diagramPanY = 0;
let isPanning = false;
let startPointerX = 0;
let startPointerY = 0;

let currentMediaType = "svg"; // 'svg' | 'image'
let currentRawData = "";
let currentMediaFilename = "jarvis-media";

// Annotation State
let annotMode = "pan"; // 'pan' | 'pen' | 'text'
let annotColor = "#ef4444";
let isDrawing = false;
let lastDrawX = 0;
let lastDrawY = 0;
const undoStack = [];
const redoStack = [];

// Multi-touch pinch tracking for mobile
let initialTouchDistance = 0;
let initialPinchScale = 1;

function getActiveColorValue() {
  if (annotColor === "contrast") {
    return state.theme === "light" ? "#18181b" : "#f4f4f5";
  }
  return annotColor;
}

function updateDiagramTransform() {
  const content = $("diagram-svg-container");
  const zoomLabel = $("diagram-zoom-level");
  if (!content) return;

  content.style.transform = `translate(${diagramPanX}px, ${diagramPanY}px) scale(${diagramScale})`;
  if (zoomLabel) {
    zoomLabel.textContent = `${Math.round(diagramScale * 100)}%`;
  }
}

export function resetDiagramView() {
  diagramScale = 1;
  diagramPanX = 0;
  diagramPanY = 0;
  updateDiagramTransform();
}

export function zoomDiagram(delta) {
  const newScale = Math.min(Math.max(diagramScale + delta, 0.2), 6.0);
  diagramScale = Math.round(newScale * 100) / 100;
  updateDiagramTransform();
}

function saveAnnotSnapshot() {
  const canvas = $("diagram-annot-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx || canvas.width === 0 || canvas.height === 0) return;
  try {
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    undoStack.push(data);
    if (undoStack.length > 30) undoStack.shift();
    redoStack.length = 0; // Clear redo on new action
  } catch {
    // Ignore canvas security errors on cross-origin
  }
}

export function undoAnnotation() {
  const canvas = $("diagram-annot-canvas");
  if (!canvas || undoStack.length <= 1) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const current = undoStack.pop();
  redoStack.push(current);
  const prev = undoStack[undoStack.length - 1];
  if (prev) {
    ctx.putImageData(prev, 0, 0);
  }
}

export function redoAnnotation() {
  const canvas = $("diagram-annot-canvas");
  if (!canvas || redoStack.length === 0) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const next = redoStack.pop();
  undoStack.push(next);
  ctx.putImageData(next, 0, 0);
}

export function clearAnnotations() {
  const canvas = $("diagram-annot-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  saveAnnotSnapshot();
}

function syncCanvasSize() {
  const canvas = $("diagram-annot-canvas");
  const mediaLayer = $("diagram-media-layer");
  if (!canvas || !mediaLayer) return;

  const rect = mediaLayer.getBoundingClientRect();
  const w = Math.max(Math.round(rect.width), 320);
  const h = Math.max(Math.round(rect.height), 240);

  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    undoStack.length = 0;
    redoStack.length = 0;
    saveAnnotSnapshot();
  }
}

export function setAnnotMode(mode) {
  annotMode = mode;
  const viewer = $("diagram-viewer");
  if (viewer) {
    viewer.classList.toggle("drawing-mode", mode === "pen" || mode === "text");
  }

  document.querySelectorAll(".annot-btn[id^='annot-mode-']").forEach((btn) => {
    btn.classList.toggle("active", btn.id === `annot-mode-${mode}`);
  });
}

/**
 * Opens full-screen media & diagram inspection modal.
 * Supports both <img> and cloned <svg> elements visibly centered without collapsing.
 */
export function openDiagramModal(mediaElementOrHtml, title = "Media Inspector") {
  const modal = $("diagram-modal");
  const mediaLayer = $("diagram-media-layer");
  const titleEl = $("diagram-title");
  if (!modal || !mediaLayer) return;

  mediaLayer.innerHTML = "";
  currentRawData = "";

  if (typeof mediaElementOrHtml === "string") {
    const raw = mediaElementOrHtml.trim();
    if (raw.startsWith("<svg") || raw.includes("<svg")) {
      currentMediaType = "svg";
      currentMediaFilename = "jarvis-diagram.svg";
      currentRawData = raw;
      mediaLayer.innerHTML = raw;
      const svgEl = mediaLayer.querySelector("svg");
      if (svgEl) {
        if (!svgEl.getAttribute("viewBox")) {
          const w = svgEl.getAttribute("width") || "800";
          const h = svgEl.getAttribute("height") || "600";
          svgEl.setAttribute("viewBox", `0 0 ${parseInt(w, 10) || 800} ${parseInt(h, 10) || 600}`);
        }
        svgEl.setAttribute("preserveAspectRatio", "xMidYMid meet");
      }
    } else {
      currentMediaType = "image";
      currentMediaFilename = "jarvis-visual.png";
      currentRawData = raw;
      const img = document.createElement("img");
      img.src = raw;
      img.alt = title;
      mediaLayer.appendChild(img);
    }
  } else if (mediaElementOrHtml instanceof SVGElement) {
    currentMediaType = "svg";
    currentMediaFilename = "jarvis-diagram.svg";
    const clone = mediaElementOrHtml.cloneNode(true);
    if (!clone.getAttribute("viewBox")) {
      const rect = mediaElementOrHtml.getBoundingClientRect();
      clone.setAttribute("viewBox", `0 0 ${Math.max(rect.width, 300)} ${Math.max(rect.height, 200)}`);
    }
    clone.setAttribute("preserveAspectRatio", "xMidYMid meet");
    mediaLayer.appendChild(clone);
    currentRawData = clone.outerHTML || "";
  } else if (mediaElementOrHtml instanceof HTMLImageElement) {
    currentMediaType = "image";
    currentMediaFilename = "jarvis-visual.png";
    const clone = mediaElementOrHtml.cloneNode(true);
    mediaLayer.appendChild(clone);
    currentRawData = clone.src || "";
  } else if (mediaElementOrHtml instanceof HTMLElement) {
    const innerSvg = mediaElementOrHtml.querySelector("svg");
    const innerImg = mediaElementOrHtml.querySelector("img");
    if (innerSvg) {
      return openDiagramModal(innerSvg, title);
    } else if (innerImg) {
      return openDiagramModal(innerImg, title);
    }
  }

  if (titleEl) {
    titleEl.textContent = title || (currentMediaType === "svg" ? "Diagram Inspector" : "Visual Inspector");
  }

  resetDiagramView();
  setAnnotMode("pan");
  modal.classList.remove("hidden");

  // Ensure canvas dimensions match media surface
  requestAnimationFrame(() => {
    syncCanvasSize();
  });
}

/**
 * Closes media modal.
 */
export function closeDiagramModal() {
  const modal = $("diagram-modal");
  if (modal) modal.classList.add("hidden");
  const mediaLayer = $("diagram-media-layer");
  if (mediaLayer) mediaLayer.innerHTML = "";
  currentRawData = "";
  resetDiagramView();
}

/**
 * Downloads the current media (or composited annotations).
 */
export function downloadCurrentMedia() {
  const canvas = $("diagram-annot-canvas");
  const hasAnnotations = undoStack.length > 1;

  if (hasAnnotations && canvas) {
    // Composite media + annotations onto download canvas
    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = canvas.width;
    exportCanvas.height = canvas.height;
    const ctx = exportCanvas.getContext("2d");

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      ctx.drawImage(img, 0, 0, exportCanvas.width, exportCanvas.height);
      ctx.drawImage(canvas, 0, 0);
      const link = document.createElement("a");
      link.download = `jarvis-annotated-${Date.now()}.png`;
      link.href = exportCanvas.toDataURL("image/png");
      link.click();
    };

    if (currentMediaType === "svg") {
      img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(currentRawData);
    } else {
      img.src = currentRawData;
    }
    return;
  }

  // Direct download
  const link = document.createElement("a");
  if (currentMediaType === "svg") {
    link.href = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(currentRawData);
    link.download = "jarvis-diagram.svg";
  } else {
    link.href = currentRawData;
    link.download = currentMediaFilename;
  }
  link.click();
}

/**
 * Copies the active media to clipboard.
 */
export async function copyCurrentMedia(btnEl) {
  if (currentMediaType === "svg" && currentRawData) {
    copyToClipboard(currentRawData, btnEl, "Copy SVG");
  } else if (currentMediaType === "image" && currentRawData) {
    try {
      const res = await fetch(currentRawData);
      const blob = await res.blob();
      await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
      if (btnEl) {
        btnEl.textContent = "Copied";
        setTimeout(() => { btnEl.textContent = "Copy"; }, 1500);
      }
    } catch {
      copyToClipboard(currentRawData, btnEl, "Copy URL");
    }
  }
}

/**
 * Binds all diagram lightbox controls, pan/zoom, mobile gestures, and auto-inspection hooks.
 */
export function initDiagramInspection() {
  const modal = $("diagram-modal");
  const viewer = $("diagram-viewer");
  const canvas = $("diagram-annot-canvas");
  const closeBtn = $("diagram-close-btn");
  const zoomInBtn = $("diagram-zoom-in-btn");
  const zoomOutBtn = $("diagram-zoom-out-btn");
  const resetBtn = $("diagram-reset-btn");
  const downloadBtn = $("diagram-download-btn");
  const copyBtn = $("diagram-copy-btn");
  const messagesContainer = $("messages-container");

  if (!modal || !viewer) return;

  if (closeBtn) closeBtn.addEventListener("click", closeDiagramModal);
  if (zoomInBtn) zoomInBtn.addEventListener("click", () => zoomDiagram(0.2));
  if (zoomOutBtn) zoomOutBtn.addEventListener("click", () => zoomDiagram(-0.2));
  if (resetBtn) resetBtn.addEventListener("click", resetDiagramView);
  if (downloadBtn) downloadBtn.addEventListener("click", downloadCurrentMedia);
  if (copyBtn) copyBtn.addEventListener("click", () => copyCurrentMedia(copyBtn));

  // Annotation Mode Switchers
  const panBtn = $("annot-mode-pan");
  const penBtn = $("annot-mode-pen");
  const textBtn = $("annot-mode-text");
  const undoBtn = $("annot-undo-btn");
  const redoBtn = $("annot-redo-btn");
  const clearBtn = $("annot-clear-btn");

  if (panBtn) panBtn.addEventListener("click", () => setAnnotMode("pan"));
  if (penBtn) penBtn.addEventListener("click", () => setAnnotMode("pen"));
  if (textBtn) textBtn.addEventListener("click", () => setAnnotMode("text"));
  if (undoBtn) undoBtn.addEventListener("click", undoAnnotation);
  if (redoBtn) redoBtn.addEventListener("click", redoAnnotation);
  if (clearBtn) clearBtn.addEventListener("click", clearAnnotations);

  // Color Swatches
  document.querySelectorAll(".annot-swatch").forEach((swatch) => {
    swatch.addEventListener("click", () => {
      document.querySelectorAll(".annot-swatch").forEach((s) => s.classList.remove("active"));
      swatch.classList.add("active");
      annotColor = swatch.dataset.color || "#ef4444";
      if (annotMode === "pan") setAnnotMode("pen");
    });
  });

  // Canvas Drawing & Annotation Events
  if (canvas) {
    const getCanvasPos = (e) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY
      };
    };

    canvas.addEventListener("pointerdown", (e) => {
      if (annotMode === "pan") return;
      const pos = getCanvasPos(e);

      if (annotMode === "pen") {
        isDrawing = true;
        lastDrawX = pos.x;
        lastDrawY = pos.y;
        const ctx = canvas.getContext("2d");
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 1.5, 0, Math.PI * 2);
        ctx.fillStyle = getActiveColorValue();
        ctx.fill();
      } else if (annotMode === "text") {
        const text = prompt("Annotation text:");
        if (text && text.trim()) {
          const ctx = canvas.getContext("2d");
          ctx.font = "bold 15px 'Inter', sans-serif";
          ctx.fillStyle = getActiveColorValue();
          ctx.shadowColor = "rgba(0,0,0,0.5)";
          ctx.shadowBlur = 4;
          ctx.fillText(text.trim(), pos.x, pos.y);
          ctx.shadowBlur = 0;
          saveAnnotSnapshot();
        }
      }
    });

    canvas.addEventListener("pointermove", (e) => {
      if (!isDrawing || annotMode !== "pen") return;
      const pos = getCanvasPos(e);
      const ctx = canvas.getContext("2d");
      ctx.beginPath();
      ctx.moveTo(lastDrawX, lastDrawY);
      ctx.lineTo(pos.x, pos.y);
      ctx.strokeStyle = getActiveColorValue();
      ctx.lineWidth = 2.8;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.stroke();
      lastDrawX = pos.x;
      lastDrawY = pos.y;
    });

    const stopDrawing = () => {
      if (isDrawing) {
        isDrawing = false;
        saveAnnotSnapshot();
      }
    };

    canvas.addEventListener("pointerup", stopDrawing);
    canvas.addEventListener("pointercancel", stopDrawing);
  }

  // Close on backdrop click (outside sheet)
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeDiagramModal();
  });

  // Keyboard navigation & tools
  window.addEventListener("keydown", (e) => {
    if (modal.classList.contains("hidden")) return;
    if (e.key === "Escape") {
      closeDiagramModal();
    } else if (e.key === "+" || e.key === "=") {
      zoomDiagram(0.2);
    } else if (e.key === "-") {
      zoomDiagram(-0.2);
    } else if (e.key === "0") {
      resetDiagramView();
    } else if ((e.key === "z" || e.key === "Z") && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      if (e.shiftKey) redoAnnotation();
      else undoAnnotation();
    } else if ((e.key === "y" || e.key === "Y") && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      redoAnnotation();
    } else if (e.key.toLowerCase() === "v") {
      setAnnotMode("pan");
    } else if (e.key.toLowerCase() === "p") {
      setAnnotMode("pen");
    } else if (e.key.toLowerCase() === "t") {
      setAnnotMode("text");
    }
  });

  // Wheel zoom inside viewer
  viewer.addEventListener("wheel", (e) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.15 : -0.15;
    zoomDiagram(delta);
  }, { passive: false });

  // Pointer Drag & Pan (when in Pan mode or holding middle-button)
  viewer.addEventListener("pointerdown", (e) => {
    if (annotMode !== "pan" && e.button !== 1 && !e.spaceKey) return;
    if (e.pointerType === "touch" && !e.isPrimary) return;
    isPanning = true;
    startPointerX = e.clientX - diagramPanX;
    startPointerY = e.clientY - diagramPanY;
    viewer.setPointerCapture(e.pointerId);
  });

  viewer.addEventListener("pointermove", (e) => {
    if (!isPanning) return;
    diagramPanX = e.clientX - startPointerX;
    diagramPanY = e.clientY - startPointerY;
    updateDiagramTransform();
  });

  const stopPan = (e) => {
    if (isPanning) {
      isPanning = false;
      try {
        viewer.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    }
  };

  viewer.addEventListener("pointerup", stopPan);
  viewer.addEventListener("pointercancel", stopPan);

  // Mobile Pinch-to-Zoom Touch Gestures
  viewer.addEventListener("touchstart", (e) => {
    if (e.touches.length === 2) {
      isPanning = false;
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      initialTouchDistance = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      initialPinchScale = diagramScale;
    }
  }, { passive: true });

  viewer.addEventListener("touchmove", (e) => {
    if (e.touches.length === 2 && initialTouchDistance > 0) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const currentDist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      const ratio = currentDist / initialTouchDistance;
      const newScale = Math.min(Math.max(initialPinchScale * ratio, 0.2), 6.0);
      diagramScale = Math.round(newScale * 100) / 100;
      updateDiagramTransform();
    }
  }, { passive: true });

  viewer.addEventListener("touchend", () => {
    initialTouchDistance = 0;
  });

  // Delegated click on any inline media (images, diagrams, SVGs)
  if (messagesContainer) {
    messagesContainer.addEventListener("click", (e) => {
      // Find media element clicked
      const mediaCard = e.target.closest(".media-card, .render-diagram-container, .chat-diagram-wrapper");
      if (mediaCard) {
        const svg = mediaCard.querySelector("svg");
        const img = mediaCard.querySelector("img");
        if (svg) {
          openDiagramModal(svg, "Diagram Inspector");
          return;
        }
        if (img) {
          openDiagramModal(img, "Visual Inspector");
          return;
        }
      }

      // Check if raw svg or img clicked inside a chat row
      if (e.target.tagName === "IMG" && !e.target.closest(".profile-avatar, .ai-avatar, .preview-thumb")) {
        openDiagramModal(e.target, "Visual Inspector");
      } else if (e.target.tagName === "svg" || e.target.closest("svg")) {
        const svg = e.target.tagName === "svg" ? e.target : e.target.closest("svg");
        const rect = svg.getBoundingClientRect();
        if (rect.width > 50 && rect.height > 50 && !svg.closest("button, .ai-avatar, .sidebar-brand")) {
          openDiagramModal(svg, "Diagram Inspector");
        }
      }
    });

    const observer = new MutationObserver(() => {
      const messages = messagesContainer.querySelectorAll(".assistant-message, .chat-message");
      messages.forEach((msg) => parseAndRenderInlineBriefings(msg));
    });
    observer.observe(messagesContainer, { childList: true, subtree: true });
  }
}

window.openDiagramModal = openDiagramModal;
window.closeDiagramModal = closeDiagramModal;
window.initDiagramInspection = initDiagramInspection;
window.undoAnnotation = undoAnnotation;
window.redoAnnotation = redoAnnotation;
window.clearAnnotations = clearAnnotations;
window.setAnnotMode = setAnnotMode;
window.downloadCurrentMedia = downloadCurrentMedia;


/* =============================================================================
   AUTO-INITIALIZE ALL BATCH 4 FEATURES ON LOAD
   ============================================================================= */
function initBatch4() {
  initHudCore();
  initWelcomeBriefing();
  initSyntaxHighlighting();
  initDiagramInspection();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initBatch4);
} else {
  initBatch4();
}
