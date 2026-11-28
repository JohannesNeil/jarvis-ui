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
   BATCH 4 - [18] 60FPS HTML5 CANVAS PARTICLE-TORUS HUD CORE
   Blooming radial spark ring lifecycle with dual-theme jewel/spectral gradients
   ============================================================================= */
let currentHudState = "idle"; // 'idle' | 'thinking' | 'responding'
let hudAnimFrameId = null;
let isHudAnimRunning = false;

const HUD_BASE_DIAMETER = 200;
const HUD_CENTER = HUD_BASE_DIAMETER / 2; // 100px
const HUD_MAX_RADIUS = 88;
const HUD_MIN_RADIUS = 6;
const HUD_TORUS_CENTER_RADIUS = 46;

class TorusParticle {
  constructor() {
    this.reset(true);
  }

  reset(isInitial = false) {
    this.angle = Math.random() * Math.PI * 2;
    // Stagger progress across life cycle [0, 1] so centerpiece is never blank
    this.progress = isInitial ? Math.random() : 0;
    this.speed = 0.005 + Math.random() * 0.006;
    this.angularVelocity = (0.004 + Math.random() * 0.006) * (Math.random() < 0.5 ? 1 : -1);
    this.ringVariance = (Math.random() - 0.5) * 18;
    this.size = 0.8 + Math.random() * 1.5;
    this.streakLength = 2.4 + Math.random() * 3.2;
    this.sparklePhase = Math.random() * Math.PI * 2;
    this.sparkleSpeed = 0.08 + Math.random() * 0.12;
  }

  update(stateConfig) {
    const { speedMult, swirlMult, coreJitter } = stateConfig;

    this.progress += this.speed * speedMult;
    if (this.progress >= 1.0) {
      this.reset(false);
    }

    // Angular orbital drift
    this.angle += this.angularVelocity * swirlMult;

    const p = this.progress;
    let r = 0;

    // 4-Phase Radial Bloom Lifecycle:
    // a) Ignition (0.0 - 0.18): spawns near center, accelerates outward radially
    if (p < 0.18) {
      const t = p / 0.18;
      const eased = t * t;
      r = HUD_MIN_RADIUS + (HUD_TORUS_CENTER_RADIUS * 0.65 - HUD_MIN_RADIUS) * eased;
    }
    // b) Torus Formation (0.18 - 0.65): hollow-centered ring with orbital drift
    else if (p < 0.65) {
      const t = (p - 0.18) / (0.65 - 0.18);
      const startR = HUD_TORUS_CENTER_RADIUS * 0.65;
      const targetR = HUD_TORUS_CENTER_RADIUS + this.ringVariance;
      const smooth = t * t * (3 - 2 * t);
      r = startR + (targetR - startR) * smooth;
    }
    // d) Ember Dissipation (0.65 - 1.0): outer tips decelerate, twinkle & fade smoothly
    else {
      const t = (p - 0.65) / (1.0 - 0.65);
      const startR = HUD_TORUS_CENTER_RADIUS + this.ringVariance;
      const endR = HUD_MAX_RADIUS + this.ringVariance * 0.4;
      const eased = Math.sin((t * Math.PI) / 2);
      r = startR + (endR - startR) * eased;
    }

    if (coreJitter > 0 && p < 0.28) {
      r += (Math.random() - 0.5) * coreJitter;
    }

    this.x = HUD_CENTER + Math.cos(this.angle) * r;
    this.y = HUD_CENTER + Math.sin(this.angle) * r;

    this.sparklePhase += this.sparkleSpeed;
  }
}

let hudParticles = [];

function getParticleColor(progress, isLightMode) {
  const p = Math.max(0, Math.min(1, progress));
  let r = 0, g = 0, b = 0;

  if (isLightMode) {
    // Light Mode: High-contrast rich jewel tones for crisp rendering on #FAF9F6
    if (p < 0.25) {
      // Phase 1: Deep cyan-teal -> cobalt blue
      const t = p / 0.25;
      r = Math.round(14 * (1 - t) + 29 * t);
      g = Math.round(116 * (1 - t) + 78 * t);
      b = Math.round(144 * (1 - t) + 216 * t);
    } else if (p < 0.65) {
      // Phase 2: Cobalt blue -> royal violet -> rich plum
      const t = (p - 0.25) / 0.40;
      r = Math.round(29 * (1 - t) + 124 * t);
      g = Math.round(78 * (1 - t) + 28 * t);
      b = Math.round(216 * (1 - t) + 120 * t);
    } else {
      // Phase 3: Rich plum -> warm coral ruby
      const t = (p - 0.65) / 0.35;
      r = Math.round(124 * (1 - t) + 225 * t);
      g = Math.round(28 * (1 - t) + 29 * t);
      b = Math.round(120 * (1 - t) + 72 * t);
    }
  } else {
    // Dark Mode: Electric spectral gradient with bright luminescence
    if (p < 0.25) {
      // Phase 1: Bright cyan/white -> electric sky-blue
      const t = p / 0.25;
      r = Math.round(220 * (1 - t) + 56 * t);
      g = Math.round(250 * (1 - t) + 189 * t);
      b = Math.round(255 * (1 - t) + 248 * t);
    } else if (p < 0.65) {
      // Phase 2: Electric sky-blue -> violet-magenta
      const t = (p - 0.25) / 0.40;
      r = Math.round(56 * (1 - t) + 192 * t);
      g = Math.round(189 * (1 - t) + 72 * t);
      b = Math.round(248 * (1 - t) + 210 * t);
    } else {
      // Phase 3: Violet-magenta -> warm coral / red-orange
      const t = (p - 0.65) / 0.35;
      r = Math.round(192 * (1 - t) + 249 * t);
      g = Math.round(72 * (1 - t) + 115 * t);
      b = Math.round(210 * (1 - t) + 22 * t);
    }
  }

  return { r, g, b };
}

function renderHudFrame(timestamp = 0) {
  const canvas = $("hud-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const isLightMode = state.theme === "light";

  // Clear canvas (100% transparent background)
  ctx.clearRect(0, 0, HUD_BASE_DIAMETER, HUD_BASE_DIAMETER);

  // State parameter modulation
  let speedMult = 1.0;
  let swirlMult = 1.0;
  let streakMult = 1.0;
  let coreJitter = 0;
  let targetParticleCount = 180;
  let harmonicPulse = 0;

  if (currentHudState === "thinking") {
    speedMult = 1.7;
    swirlMult = 2.7;
    streakMult = 1.3;
    coreJitter = 2.8;
    targetParticleCount = 250;
    harmonicPulse = Math.sin(timestamp * 0.009) * 3.5;
  } else if (currentHudState === "responding") {
    speedMult = 1.35;
    swirlMult = 1.5;
    streakMult = 1.6;
    coreJitter = 1.0;
    targetParticleCount = 210;
    harmonicPulse = Math.sin(timestamp * 0.005) * 5.5; // Outward harmonic burst
  } else {
    // idle
    speedMult = 1.0;
    swirlMult = 1.0;
    streakMult = 1.0;
    coreJitter = 0;
    targetParticleCount = 180;
    harmonicPulse = Math.sin(timestamp * 0.0025) * 2.0;
  }

  const stateConfig = { speedMult, swirlMult, streakMult, coreJitter, harmonicPulse };

  // Adjust particle count smoothly
  while (hudParticles.length < targetParticleCount) {
    hudParticles.push(new TorusParticle());
  }
  if (hudParticles.length > targetParticleCount) {
    hudParticles.length = targetParticleCount;
  }

  // Blend mode: Dark mode uses additive lighter for glowing aura; Light mode uses source-over for crisp jewel ink
  ctx.globalCompositeOperation = isLightMode ? "source-over" : "lighter";

  // Draw subtle center guide rings
  const guideAlpha = isLightMode ? 0.08 : 0.14;
  ctx.beginPath();
  ctx.arc(HUD_CENTER, HUD_CENTER, HUD_TORUS_CENTER_RADIUS + harmonicPulse * 0.5, 0, Math.PI * 2);
  ctx.strokeStyle = isLightMode ? `rgba(24, 24, 27, ${guideAlpha * 0.6})` : `rgba(255, 255, 255, ${guideAlpha})`;
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(HUD_CENTER, HUD_CENTER, 8, 0, Math.PI * 2);
  ctx.fillStyle = isLightMode ? "rgba(14, 116, 144, 0.4)" : "rgba(220, 250, 255, 0.5)";
  ctx.fill();

  // Update & Render each particle in the blooming torus
  for (const p of hudParticles) {
    p.update(stateConfig);

    const prog = p.progress;
    let alpha = 1.0;

    // Phase opacity curve:
    // Ignition fade-in
    if (prog < 0.12) {
      alpha = prog / 0.12;
    }
    // Torus dwell
    else if (prog <= 0.65) {
      alpha = 0.85 + 0.15 * Math.sin(p.sparklePhase);
    }
    // Ember dissipation fade-out
    else {
      const fadeT = (prog - 0.65) / 0.35;
      alpha = Math.max(0, (1 - fadeT) * (0.8 + 0.2 * Math.sin(p.sparklePhase * 2)));
    }

    if (alpha <= 0.01) continue;

    const { r, g, b } = getParticleColor(prog, isLightMode);

    // Radial streak dash calculation
    const dx = p.x - HUD_CENTER;
    const dy = p.y - HUD_CENTER;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const nx = dx / dist;
    const ny = dy / dist;

    const streakLen = p.streakLength * (0.6 + prog * 0.8) * streakMult;
    const tailX = p.x - nx * streakLen;
    const tailY = p.y - ny * streakLen;

    // Draw streak
    ctx.beginPath();
    ctx.moveTo(tailX, tailY);
    ctx.lineTo(p.x, p.y);
    ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha * (isLightMode ? 0.9 : 0.8)})`;
    ctx.lineWidth = p.size;
    ctx.lineCap = "round";
    ctx.stroke();

    // Spark head dot
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * 0.7, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
    ctx.fill();
  }

  // Reset composite operation
  ctx.globalCompositeOperation = "source-over";
}

function hudAnimLoop(timestamp) {
  const canvas = $("hud-canvas");
  const welcome = $("welcome-view");

  // Pause automatically if welcome view is hidden or tab is in background
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
  if (welcome.classList.contains("hidden") || welcome.offsetParent === null || document.hidden) {
    return;
  }
  isHudAnimRunning = true;
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
 * Updates the concentric HUD core state with pulse animations and status tag.
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
      case "thinking":
        label.textContent = "COMPUTING...";
        break;
      case "responding":
        label.textContent = "SYNTHESIZING...";
        break;
      case "idle":
      default:
        label.textContent = "CORE ONLINE";
        break;
    }
  }

  // Wake loop if paused
  startHudAnimation();
}

export function getHudState() {
  return currentHudState;
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

  // Setup High-DPI buffer
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = HUD_BASE_DIAMETER * dpr;
  canvas.height = HUD_BASE_DIAMETER * dpr;
  canvas.style.width = `${HUD_BASE_DIAMETER}px`;
  canvas.style.height = `${HUD_BASE_DIAMETER}px`;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.scale(dpr, dpr);
  }

  // Initialize particles with staggered progress
  hudParticles = [];
  for (let i = 0; i < 180; i++) {
    hudParticles.push(new TorusParticle());
  }

  // Clicking the HUD core cycles through states for instant tactile feedback
  core.addEventListener("click", () => {
    const states = ["idle", "thinking", "responding"];
    const nextIdx = (states.indexOf(currentHudState) + 1) % states.length;
    setHudState(states[nextIdx]);
  });

  // Observe send button & prompt input to trigger thinking/responding pulse
  const sendBtn = $("send-btn");
  const promptInput = $("prompt-input");

  if (sendBtn) {
    sendBtn.addEventListener("click", () => {
      if (promptInput && promptInput.value.trim()) {
        setHudState("thinking");
      }
    });
  }

  if (promptInput) {
    promptInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey && promptInput.value.trim()) {
        setHudState("thinking");
      }
    });
  }

  // Handle tab visibility change to save CPU/battery
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      stopHudAnimation();
    } else {
      startHudAnimation();
    }
  });

  // Observe welcome-view visibility to pause loop when chatting
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

window.setHudState = setHudState;
window.getHudState = getHudState;
window.startHudAnimation = startHudAnimation;
window.stopHudAnimation = stopHudAnimation;


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

window.openDiagramModal = openDiagramModal;
window.closeDiagramModal = closeDiagramModal;
window.initDiagramInspection = initDiagramInspection;


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
