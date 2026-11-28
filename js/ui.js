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
   BATCH 4 - [18] ANIMATED CONCENTRIC HUD CORE
   ============================================================================= */
let currentHudState = "idle"; // 'idle' | 'thinking' | 'responding'

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
}

export function getHudState() {
  return currentHudState;
}

export function initHudCore() {
  const core = $("hud-core");
  if (!core) return;

  // Clicking the HUD core cycles through states for instant inspection and tactile feedback
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

  setHudState("idle");
}

window.setHudState = setHudState;
window.getHudState = getHudState;


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
};

/**
 * Normalizes language name into Prism-compatible language slug.
 */
export function normalizeLanguageSlug(rawLang) {
  if (!rawLang) return "javascript";
  const clean = rawLang.trim().toLowerCase().replace(/^language-/, "").replace(/^lang-/, "");
  return LANGUAGE_ALIASES[clean] || clean;
}

/**
 * Enhances a pre/code block with language toolbar, copy button, and Prism highlight.
 */
export function highlightCodeBlock(preEl) {
  if (!preEl || preEl.dataset.prismEnhanced === "true") return;

  const codeEl = preEl.querySelector("code") || preEl;
  let rawLang = "";

  // Extract language from pre or code classes
  const classes = `${preEl.className} ${codeEl.className}`.split(/\s+/);
  for (const cls of classes) {
    if (cls.startsWith("language-") || cls.startsWith("lang-")) {
      rawLang = cls;
      break;
    }
  }

  const lang = normalizeLanguageSlug(rawLang);
  codeEl.className = `language-${lang}`;
  preEl.className = `language-${lang}`;

  // If already wrapped in .code-block-wrapper, just run Prism
  if (!preEl.parentElement || !preEl.parentElement.classList.contains("code-block-wrapper")) {
    const wrapper = document.createElement("div");
    wrapper.className = "code-block-wrapper";

    const header = document.createElement("div");
    header.className = "code-block-header";

    const langLabel = document.createElement("span");
    langLabel.className = "code-lang-label";
    langLabel.textContent = lang.toUpperCase();

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
  if (window.Prism && typeof window.Prism.highlightElement === "function") {
    try {
      window.Prism.highlightElement(codeEl);
    } catch {
      // Graceful fallback to raw code if grammar component is streaming
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
   BATCH 4 - [21] FULL-SCREEN MOBILE DIAGRAM INSPECTION FOR RENDER_DIAGRAM SVGS
   ============================================================================= */

let diagramScale = 1;
let diagramPanX = 0;
let diagramPanY = 0;
let isPanning = false;
let startPointerX = 0;
let startPointerY = 0;
let currentRawSvg = "";

// Multi-touch pinch tracking for mobile
let initialTouchDistance = 0;
let initialPinchScale = 1;

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
  const newScale = Math.min(Math.max(diagramScale + delta, 0.25), 6.0);
  diagramScale = Math.round(newScale * 100) / 100;
  updateDiagramTransform();
}

/**
 * Opens full-screen diagram inspection modal.
 */
export function openDiagramModal(svgElementOrHtml, title = "Diagram Inspector") {
  const modal = $("diagram-modal");
  const container = $("diagram-svg-container");
  const titleEl = $("diagram-title");
  if (!modal || !container) return;

  container.innerHTML = "";
  let svgMarkup = "";

  if (typeof svgElementOrHtml === "string") {
    container.innerHTML = svgElementOrHtml;
    svgMarkup = svgElementOrHtml;
  } else if (svgElementOrHtml instanceof SVGElement || svgElementOrHtml instanceof HTMLElement) {
    const clone = svgElementOrHtml.cloneNode(true);
    container.appendChild(clone);
    svgMarkup = clone.outerHTML || "";
  }

  currentRawSvg = svgMarkup;
  if (titleEl) titleEl.textContent = title;

  resetDiagramView();
  modal.classList.remove("hidden");
}

/**
 * Closes diagram modal.
 */
export function closeDiagramModal() {
  const modal = $("diagram-modal");
  if (modal) modal.classList.add("hidden");
  const container = $("diagram-svg-container");
  if (container) container.innerHTML = "";
  currentRawSvg = "";
  resetDiagramView();
}

/**
 * Binds all diagram lightbox controls, pan/zoom, mobile gestures, and auto-inspection hooks.
 */
export function initDiagramInspection() {
  const modal = $("diagram-modal");
  const viewer = $("diagram-viewer");
  const closeBtn = $("diagram-close-btn");
  const zoomInBtn = $("diagram-zoom-in-btn");
  const zoomOutBtn = $("diagram-zoom-out-btn");
  const resetBtn = $("diagram-reset-btn");
  const copyBtn = $("diagram-copy-btn");
  const messagesContainer = $("messages-container");

  if (!modal || !viewer) return;

  if (closeBtn) closeBtn.addEventListener("click", closeDiagramModal);
  if (zoomInBtn) zoomInBtn.addEventListener("click", () => zoomDiagram(0.25));
  if (zoomOutBtn) zoomOutBtn.addEventListener("click", () => zoomDiagram(-0.25));
  if (resetBtn) resetBtn.addEventListener("click", resetDiagramView);

  if (copyBtn) {
    copyBtn.addEventListener("click", () => {
      if (currentRawSvg) {
        copyToClipboard(currentRawSvg, copyBtn, "Copy SVG");
      }
    });
  }

  // Close on backdrop click (outside sheet)
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeDiagramModal();
  });

  // Keyboard navigation
  window.addEventListener("keydown", (e) => {
    if (modal.classList.contains("hidden")) return;
    if (e.key === "Escape") {
      closeDiagramModal();
    } else if (e.key === "+" || e.key === "=") {
      zoomDiagram(0.25);
    } else if (e.key === "-") {
      zoomDiagram(-0.25);
    } else if (e.key === "0") {
      resetDiagramView();
    }
  });

  // Wheel zoom inside viewer
  viewer.addEventListener("wheel", (e) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.15 : -0.15;
    zoomDiagram(delta);
  }, { passive: false });

  // Pointer Drag & Pan (Mouse + Single Touch)
  viewer.addEventListener("pointerdown", (e) => {
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
      const newScale = Math.min(Math.max(initialPinchScale * ratio, 0.25), 6.0);
      diagramScale = Math.round(newScale * 100) / 100;
      updateDiagramTransform();
    }
  }, { passive: true });

  viewer.addEventListener("touchend", () => {
    initialTouchDistance = 0;
  });

  // Attach tap-to-expand listeners on SVGs and render_diagram containers in chat
  function enhanceDiagrams(scope = document) {
    // Select any rendered SVG in messages that is larger than 60x60 (to exclude tiny inline icons)
    const svgs = scope.querySelectorAll(".render-diagram-container svg, .chat-diagram svg, #messages-container svg");
    svgs.forEach((svg) => {
      // Exclude small action icons
      const bbox = svg.getBoundingClientRect();
      if ((bbox.width > 0 && bbox.width < 50) || (bbox.height > 0 && bbox.height < 50)) return;

      const parent = svg.closest(".render-diagram-container, .chat-diagram-wrapper") || svg.parentElement;
      if (parent && !parent.querySelector(".diagram-tap-hint")) {
        parent.classList.add("render-diagram-container");
        const hint = document.createElement("div");
        hint.className = "diagram-tap-hint";
        hint.innerHTML = `
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="15 3 21 3 21 9"></polyline>
            <polyline points="9 21 3 21 3 15"></polyline>
            <line x1="21" y1="3" x2="14" y2="10"></line>
            <line x1="3" y1="21" x2="10" y2="14"></line>
          </svg>
          <span>Tap to inspect full screen</span>
        `;
        parent.appendChild(hint);
      }

      svg.style.cursor = "pointer";
      svg.addEventListener("click", (e) => {
        e.stopPropagation();
        openDiagramModal(svg, "Circuit & Engineering Diagram");
      });
    });
  }

  if (messagesContainer) {
    enhanceDiagrams(messagesContainer);

    const diagramObserver = new MutationObserver(() => {
      enhanceDiagrams(messagesContainer);
      // Also scan for inline text briefings
      const messages = messagesContainer.querySelectorAll(".assistant-message, .chat-message");
      messages.forEach((msg) => parseAndRenderInlineBriefings(msg));
    });

    diagramObserver.observe(messagesContainer, { childList: true, subtree: true });
  }
}

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
