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
   BATCH 5 - [12] 3D AUTONOMOUS PARTICLE ENTITY HUD CORE
   True 3D depth-sorted cloud with shape morphing, voice sync API, drag rotation
   ============================================================================= */
let currentHudState = "idle"; // 'idle' | 'thinking' | 'responding'
let hudAnimFrameId = null;
let isHudAnimRunning = false;

const HUD_DIAM = 200;
const HUD_R = HUD_DIAM / 2; // logical center = 100
const HUD_SPHERE_R = 82; // max 3D radius

// ---- Voice / Audio Sync state ----
let _hudVoiceLevel = 0;      // 0.0–1.0, set by setHudVoiceLevel or speech envelope
let _hudAudioAnalyser = null; // Web Audio AnalyserNode (optional, future TTS)
let _hudAnalyserBuf = null;

// ---- Drag / Swipe Rotation state ----
let _rotX = 0.28; // radians tilt (around X-axis)
let _rotY = 0;    // radians spin (around Y-axis)
let _velX = 0;    // inertia velocity
let _velY = 0.004; // gentle baseline drift
let _dragActive = false;
let _dragLastX = 0;
let _dragLastY = 0;
let _dragDeltaX = 0;
let _dragDeltaY = 0;

// ---- Shape morph state ----
const SHAPE_DURATION_MS = 7000; // time per shape
const SHAPES = ["fibonacci", "torus", "helix", "wave", "crystal"];
let _shapeIdx = 0;
let _shapeMorphT = 0; // 0→1 blend between _shapeIdx and next
let _shapeLastMs = 0;

// ---- Breathing / organic drift ----
let _breathPhase = 0;

// ---- Speech cadence envelope (used when responding with no AudioAnalyser) ----
let _syllablePhase = 0;
let _syllableEnv = 0;
const SYLLABLE_PATTERN = [0.9, 0.5, 1.0, 0.3, 0.8, 0.2, 0.95, 0.4, 0.7, 0.15];
let _syllableIdx = 0;
let _syllableStep = 0;

/* ---- Shape target generators (return normalized unit vectors * sphere radius) ---- */
function shapeFibSphere(i, n) {
  const golden = Math.PI * (3 - Math.sqrt(5));
  const y = 1 - (i / (n - 1)) * 2;
  const r = Math.sqrt(Math.max(0, 1 - y * y));
  const theta = golden * i;
  return { tx: Math.cos(theta) * r, ty: y, tz: Math.sin(theta) * r };
}

function shapeTorus(i, n) {
  const ang = (i / n) * Math.PI * 2;
  const tubeAng = (i * 7.3) % (Math.PI * 2);
  const bigR = 0.65, smallR = 0.28;
  return {
    tx: (bigR + smallR * Math.cos(tubeAng)) * Math.cos(ang),
    ty: smallR * Math.sin(tubeAng),
    tz: (bigR + smallR * Math.cos(tubeAng)) * Math.sin(ang)
  };
}

function shapeHelix(i, n) {
  const t = (i / n) * Math.PI * 6;
  const strand = i % 2 === 0 ? 0 : Math.PI;
  const helR = 0.5;
  return {
    tx: helR * Math.cos(t + strand),
    ty: (i / n) * 2 - 1,
    tz: helR * Math.sin(t + strand)
  };
}

function shapeWave(i, n) {
  const col = i % 16, row = Math.floor(i / 16);
  const u = (col / 15) * 2 - 1;
  const v = (row / (Math.floor(n / 16) - 1)) * 2 - 1;
  const amp = 0.35;
  return {
    tx: u * 0.9,
    ty: amp * Math.sin(u * Math.PI * 2.4 + v * Math.PI),
    tz: v * 0.9
  };
}

function shapeCrystal(i, n) {
  // 8-point octahedron + lattice scatter
  const octFaces = [
    [1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1],
    [0.707,0.707,0],[0.707,-0.707,0],[-0.707,0.707,0],[-0.707,-0.707,0],
    [0.707,0,0.707],[0.707,0,-0.707],[-0.707,0,0.707],[-0.707,0,-0.707],
    [0,0.707,0.707],[0,0.707,-0.707],[0,-0.707,0.707],[0,-0.707,-0.707]
  ];
  const face = octFaces[i % octFaces.length];
  const jitter = 0.18;
  const seed = (i * 1.618) % 1;
  return {
    tx: face[0] * 0.82 + (seed - 0.5) * jitter,
    ty: face[1] * 0.82 + ((i * 0.317) % 1 - 0.5) * jitter,
    tz: face[2] * 0.82 + ((i * 0.513) % 1 - 0.5) * jitter
  };
}

function getShapeTarget(shapeKey, i, n) {
  switch (shapeKey) {
    case "torus":   return shapeTorus(i, n);
    case "helix":   return shapeHelix(i, n);
    case "wave":    return shapeWave(i, n);
    case "crystal": return shapeCrystal(i, n);
    default:        return shapeFibSphere(i, n);
  }
}

/* ---- 3D Particle ---- */
class Particle3D {
  constructor(i, n) {
    this.i = i;
    this.n = n;
    // Start on fibonacci sphere
    const s = shapeFibSphere(i, n);
    this.x = s.tx * HUD_SPHERE_R;
    this.y = s.ty * HUD_SPHERE_R;
    this.z = s.tz * HUD_SPHERE_R;
    // Velocity (spring-damped, starts at rest)
    this.vx = 0; this.vy = 0; this.vz = 0;
    // Organic float offsets
    this.driftPhase = Math.random() * Math.PI * 2;
    this.driftAmp = 1.5 + Math.random() * 2.0;
    this.driftFreq = 0.0008 + Math.random() * 0.0006;
    // Visual
    this.baseSize = 1.0 + Math.random() * 1.4;
    this.colorPhase = Math.random(); // 0–1 position in palette
    this.sparkPhase = Math.random() * Math.PI * 2;
    this.sparkSpeed = 0.04 + Math.random() * 0.06;
    // Projected (set each frame)
    this.px = 0; this.py = 0; this.pz = 0;
    this.screenX = 0; this.screenY = 0;
    this.screenAlpha = 1; this.screenSize = 1;
  }

  applySpring(tx, ty, tz, stiffness, damping, dt, breathScale, voiceDisplace) {
    const bx = tx * breathScale + voiceDisplace * (tx);
    const by = ty * breathScale + voiceDisplace * (ty);
    const bz = tz * breathScale + voiceDisplace * (tz);
    this.vx += (bx - this.x) * stiffness * dt;
    this.vy += (by - this.y) * stiffness * dt;
    this.vz += (bz - this.z) * stiffness * dt;
    this.vx *= (1 - damping * dt);
    this.vy *= (1 - damping * dt);
    this.vz *= (1 - damping * dt);
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.z += this.vz * dt;
  }

  project(rotX, rotY, fov, cx, cy, timestamp) {
    // 3D rotation: Y-axis then X-axis
    const cosY = Math.cos(rotY), sinY = Math.sin(rotY);
    const cosX = Math.cos(rotX), sinX = Math.sin(rotX);

    // Organic drift
    const drift = this.driftAmp * Math.sin(timestamp * this.driftFreq + this.driftPhase);

    let px = this.x + drift * 0.3;
    let py = this.y + drift * 0.5;
    let pz = this.z + drift * 0.2;

    // Y rotation
    const rx1 = px * cosY - pz * sinY;
    const rz1 = px * sinY + pz * cosY;
    // X rotation
    const ry2 = py * cosX - rz1 * sinX;
    const rz2 = py * sinX + rz1 * cosX;

    this.pz = rz2;
    const scale = fov / (fov + rz2 + HUD_SPHERE_R);
    this.screenX = cx + rx1 * scale;
    this.screenY = cy + ry2 * scale;
    this.screenSize = this.baseSize * scale * 1.6;
    // Depth alpha: near = bright, far = dim
    this.screenAlpha = 0.35 + 0.65 * ((rz2 + HUD_SPHERE_R) / (HUD_SPHERE_R * 2));
    this.sparkPhase += this.sparkSpeed;
  }
}

let hudParticles = [];

/* ---- Palette ---- */
function getParticleColor(t, isLightMode) {
  const p = Math.max(0, Math.min(1, t));
  let r, g, b;
  if (isLightMode) {
    // Jewel tones: deep teal → cobalt → indigo → coral
    if (p < 0.33) {
      const u = p / 0.33;
      r = Math.round(10 + 19 * u); g = Math.round(130 - 70 * u); b = Math.round(140 + 90 * u);
    } else if (p < 0.66) {
      const u = (p - 0.33) / 0.33;
      r = Math.round(29 + 95 * u); g = Math.round(60 - 32 * u); b = Math.round(230 - 110 * u);
    } else {
      const u = (p - 0.66) / 0.34;
      r = Math.round(124 + 110 * u); g = Math.round(28 + 10 * u); b = Math.round(120 - 60 * u);
    }
  } else {
    // Cyber: bright cyan/white → electric blue → violet-magenta → coral
    if (p < 0.3) {
      const u = p / 0.3;
      r = Math.round(210 - 150 * u); g = Math.round(248 - 60 * u); b = 255;
    } else if (p < 0.65) {
      const u = (p - 0.3) / 0.35;
      r = Math.round(60 + 140 * u); g = Math.round(188 - 120 * u); b = Math.round(255 - 50 * u);
    } else {
      const u = (p - 0.65) / 0.35;
      r = Math.round(200 + 55 * u); g = Math.round(68 + 48 * u); b = Math.round(205 - 185 * u);
    }
  }
  return { r: Math.max(0,Math.min(255,r)), g: Math.max(0,Math.min(255,g)), b: Math.max(0,Math.min(255,b)) };
}

/* ---- Main render frame ---- */
function renderHudFrame(timestamp = 0) {
  const canvas = $("hud-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const isLightMode = state.theme === "light";
  const n = hudParticles.length;
  if (n === 0) return;

  // ---- Audio analyser sampling (future TTS) ----
  if (_hudAudioAnalyser && _hudAnalyserBuf) {
    _hudAudioAnalyser.getByteFrequencyData(_hudAnalyserBuf);
    let sum = 0;
    for (let i = 0; i < _hudAnalyserBuf.length; i++) sum += _hudAnalyserBuf[i];
    _hudVoiceLevel = Math.min(1, (sum / _hudAnalyserBuf.length) / 128);
  }

  // ---- Speech cadence envelope (responding without AudioAnalyser) ----
  _syllableStep++;
  if (currentHudState === "responding" && !_hudAudioAnalyser) {
    if (_syllableStep % 7 === 0) {
      _syllableIdx = (_syllableIdx + 1) % SYLLABLE_PATTERN.length;
    }
    const target = SYLLABLE_PATTERN[_syllableIdx];
    _syllableEnv += (target - _syllableEnv) * 0.08;
    _hudVoiceLevel = _syllableEnv * 0.6;
  } else if (currentHudState !== "responding") {
    _syllableEnv += (0 - _syllableEnv) * 0.05;
    if (!_hudAudioAnalyser) _hudVoiceLevel = _syllableEnv;
  }

  // ---- Shape morphing ----
  const dt = 1; // logical tick (normalized to 60fps)
  const shapeElapsed = timestamp - _shapeLastMs;
  _shapeMorphT = Math.min(1, shapeElapsed / SHAPE_DURATION_MS);
  if (_shapeMorphT >= 1) {
    _shapeIdx = (_shapeIdx + 1) % SHAPES.length;
    _shapeLastMs = timestamp;
    _shapeMorphT = 0;
  }
  const morphSmooth = _shapeMorphT * _shapeMorphT * (3 - 2 * _shapeMorphT); // smoothstep

  const curShape = SHAPES[_shapeIdx];
  const nextShape = SHAPES[(_shapeIdx + 1) % SHAPES.length];

  // ---- Breathing pulse ----
  _breathPhase += 0.0012;
  const breathScale = currentHudState === "thinking"
    ? 0.78 + 0.10 * Math.sin(_breathPhase * 2.2)
    : 0.90 + 0.10 * Math.sin(_breathPhase);

  // ---- State-driven spring params ----
  let stiffness, damping, fovDist;
  if (currentHudState === "thinking") {
    stiffness = 0.14; damping = 0.18; fovDist = 260;
  } else if (currentHudState === "responding") {
    stiffness = 0.09; damping = 0.12; fovDist = 230;
  } else {
    stiffness = 0.06; damping = 0.10; fovDist = 250;
  }

  // ---- Rotation inertia ----
  if (!_dragActive) {
    _rotY += _velY;
    _rotX += _velX;
    _velX *= 0.96;
    // Drift velY back toward baseline
    _velY += (0.004 - _velY) * 0.015;
    // Gentle X drift toward slight downward tilt
    _rotX += (0.28 - _rotX) * 0.005;
  }

  // ---- Update particles ----
  const voiceDisplace = _hudVoiceLevel * 14;
  for (let i = 0; i < n; i++) {
    const p = hudParticles[i];
    const cur = getShapeTarget(curShape, i, n);
    const nxt = getShapeTarget(nextShape, i, n);
    const tx = (cur.tx * (1 - morphSmooth) + nxt.tx * morphSmooth) * HUD_SPHERE_R;
    const ty = (cur.ty * (1 - morphSmooth) + nxt.ty * morphSmooth) * HUD_SPHERE_R;
    const tz = (cur.tz * (1 - morphSmooth) + nxt.tz * morphSmooth) * HUD_SPHERE_R;
    p.applySpring(tx, ty, tz, stiffness, damping, dt, breathScale, voiceDisplace);
    p.project(_rotX, _rotY, fovDist, HUD_R, HUD_R, timestamp);
  }

  // ---- Depth sort back-to-front ----
  hudParticles.sort((a, b) => b.pz - a.pz);

  // ---- Draw ----
  ctx.clearRect(0, 0, HUD_DIAM, HUD_DIAM);

  // Subtle central glow dot
  const glowR = 5 + _hudVoiceLevel * 6;
  const glowGrad = ctx.createRadialGradient(HUD_R, HUD_R, 0, HUD_R, HUD_R, glowR * 2.5);
  if (isLightMode) {
    glowGrad.addColorStop(0, `rgba(14, 116, 144, ${0.35 + _hudVoiceLevel * 0.3})`);
    glowGrad.addColorStop(1, "rgba(14, 116, 144, 0)");
  } else {
    glowGrad.addColorStop(0, `rgba(160, 240, 255, ${0.45 + _hudVoiceLevel * 0.4})`);
    glowGrad.addColorStop(1, "rgba(160, 240, 255, 0)");
  }
  ctx.beginPath();
  ctx.arc(HUD_R, HUD_R, glowR * 2.5, 0, Math.PI * 2);
  ctx.fillStyle = glowGrad;
  ctx.fill();

  // Particles — dots only, no lines between them
  ctx.globalCompositeOperation = isLightMode ? "source-over" : "lighter";
  for (const p of hudParticles) {
    const sparkle = 0.75 + 0.25 * Math.sin(p.sparkPhase);
    const alpha = p.screenAlpha * sparkle * (isLightMode ? 0.92 : 0.88);
    if (alpha < 0.04) continue;

    const { r, g, b } = getParticleColor(p.colorPhase, isLightMode);
    const sz = Math.max(0.5, p.screenSize);

    // Soft glow halo (larger, transparent)
    if (!isLightMode) {
      ctx.beginPath();
      ctx.arc(p.screenX, p.screenY, sz * 2.2, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${r},${g},${b},${alpha * 0.18})`;
      ctx.fill();
    }

    // Core dot
    ctx.beginPath();
    ctx.arc(p.screenX, p.screenY, sz, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
    ctx.fill();
  }

  ctx.globalCompositeOperation = "source-over";
}

function hudAnimLoop(timestamp) {
  const canvas = $("hud-canvas");
  const welcome = $("welcome-view");
  if (!canvas || !welcome || welcome.classList.contains("hidden") || welcome.offsetParent === null || document.hidden) {
    stopHudAnimation();
    return;
  }
  renderHudFrame(timestamp);
  hudAnimFrameId = requestAnimationFrame(hudAnimLoop);
}

export function startHudAnimation() {
  if (isHudAnimRunning) return;
  const canvas = $("hud-canvas");
  const welcome = $("welcome-view");
  if (!canvas || !welcome) return;
  if (welcome.classList.contains("hidden") || welcome.offsetParent === null || document.hidden) return;
  isHudAnimRunning = true;
  _shapeLastMs = performance.now();
  hudAnimFrameId = requestAnimationFrame(hudAnimLoop);
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
 * level: 0.0–1.0 audio energy; bands: optional Float32Array of freq bands.
 */
export function setHudVoiceLevel(level, bands = null) {
  _hudVoiceLevel = Math.max(0, Math.min(1, level));
}

/**
 * Bind a Web Audio AnalyserNode for real-time audio-driven HUD displacement.
 * Pass null to detach.
 */
export function bindHudAudioAnalyser(analyserNode) {
  _hudAudioAnalyser = analyserNode || null;
  _hudAnalyserBuf = analyserNode
    ? new Uint8Array(analyserNode.frequencyBinCount)
    : null;
}

/**
 * Updates the 3D Particle Entity HUD core state.
 * @param {'idle' | 'thinking' | 'responding'} newState
 */
export function setHudState(newState) {
  const core = $("hud-core");
  const label = $("hud-state-text");
  if (!core) return;

  const validState = ["idle", "thinking", "responding"].includes(newState) ? newState : "idle";
  currentHudState = validState;

  core.classList.remove("idle", "thinking", "responding");
  core.classList.add(validState);
  core.dataset.state = validState;

  if (label) {
    switch (validState) {
      case "thinking":    label.textContent = "COMPUTING...";    break;
      case "responding":  label.textContent = "SYNTHESIZING..."; break;
      default:            label.textContent = "CORE ONLINE";     break;
    }
  }

  startHudAnimation();
}

export function getHudState() {
  return currentHudState;
}

/* ---- Drag / Swipe rotation helpers ---- */
function hudDragStart(x, y) {
  _dragActive = true;
  _dragLastX = x; _dragLastY = y;
  _dragDeltaX = 0; _dragDeltaY = 0;
}
function hudDragMove(x, y) {
  if (!_dragActive) return;
  _dragDeltaX = x - _dragLastX;
  _dragDeltaY = y - _dragLastY;
  _rotY += _dragDeltaX * 0.012;
  _rotX += _dragDeltaY * 0.012;
  _dragLastX = x; _dragLastY = y;
}
function hudDragEnd() {
  if (!_dragActive) return;
  _dragActive = false;
  // Hand momentum to inertia velocities
  _velY = _dragDeltaX * 0.012;
  _velX = _dragDeltaY * 0.012;
}

export function initHudCore() {
  const core = $("hud-core");
  if (!core) return;

  let canvas = $("hud-canvas");
  if (!canvas) {
    canvas = document.createElement("canvas");
    canvas.id = "hud-canvas";
    canvas.className = "hud-canvas";
    core.prepend(canvas);
  }

  // High-DPI setup
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = HUD_DIAM * dpr;
  canvas.height = HUD_DIAM * dpr;
  canvas.style.width = `${HUD_DIAM}px`;
  canvas.style.height = `${HUD_DIAM}px`;
  const ctx = canvas.getContext("2d");
  if (ctx) ctx.scale(dpr, dpr);

  // Allow pointer events on canvas for drag
  canvas.style.pointerEvents = "auto";

  // ---- Init particles ----
  const N = 260;
  hudParticles = [];
  for (let i = 0; i < N; i++) {
    hudParticles.push(new Particle3D(i, N));
  }

  // ---- Drag / Swipe events (canvas) ----
  canvas.addEventListener("mousedown", (e) => { e.preventDefault(); hudDragStart(e.clientX, e.clientY); });
  window.addEventListener("mousemove", (e) => { hudDragMove(e.clientX, e.clientY); });
  window.addEventListener("mouseup", () => { hudDragEnd(); });

  canvas.addEventListener("touchstart", (e) => {
    if (e.touches.length !== 1) return;
    e.preventDefault();
    hudDragStart(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: false });
  canvas.addEventListener("touchmove", (e) => {
    if (e.touches.length !== 1) return;
    e.preventDefault();
    hudDragMove(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: false });
  canvas.addEventListener("touchend", () => { hudDragEnd(); });

  // Click cycles state (only if not a drag)
  let _clickDragMoved = false;
  canvas.addEventListener("mousedown", () => { _clickDragMoved = false; });
  canvas.addEventListener("mousemove", () => { _clickDragMoved = true; });
  canvas.addEventListener("click", () => {
    if (_clickDragMoved) return;
    const states = ["idle", "thinking", "responding"];
    setHudState(states[(states.indexOf(currentHudState) + 1) % states.length]);
  });

  // Send btn / prompt input → thinking state
  const sendBtn = $("send-btn");
  const promptInput = $("prompt-input");
  if (sendBtn) {
    sendBtn.addEventListener("click", () => {
      if (promptInput && promptInput.value.trim()) setHudState("thinking");
    });
  }
  if (promptInput) {
    promptInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey && promptInput.value.trim()) setHudState("thinking");
    });
  }

  // Tab visibility
  document.addEventListener("visibilitychange", () => {
    document.hidden ? stopHudAnimation() : startHudAnimation();
  });

  // Welcome view observer
  const welcome = $("welcome-view");
  if (welcome) {
    const obs = new MutationObserver(() => {
      (welcome.classList.contains("hidden") || welcome.offsetParent === null)
        ? stopHudAnimation()
        : startHudAnimation();
    });
    obs.observe(welcome, { attributes: true, attributeFilter: ["class", "style"] });
  }

  setHudState("idle");
  startHudAnimation();
}

window.setHudState = setHudState;
window.getHudState = getHudState;
window.startHudAnimation = startHudAnimation;
window.stopHudAnimation = stopHudAnimation;
window.setHudVoiceLevel = setHudVoiceLevel;
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
