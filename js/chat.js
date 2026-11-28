import { ASSISTANT_NAME, state, getAuthHeaders, uid } from "./state.js";
import { escapeHtml, renderMarkdown, typesetMath } from "./markdown.js";
import {
  $,
  copyToClipboard,
  closeLeftSidebar,
  openSelectTextModal,
  openConfirmToolModal,
  closeConfirmToolModal,
  setHudState,
  setHudVoiceLevel
} from "./ui.js";
import { saveLocalSnapshot, scheduleCloudSync } from "./sync.js";
import { renderSchedule, renderTodos, renderNotes } from "./workspace.js";

let unauthorizedHandler = null;

export function setChatUnauthorizedHandler(fn) {
  unauthorizedHandler = fn;
}

export function getActiveConversation() {
  return state.conversations.find((c) => c.id === state.activeConvId) || null;
}

export function createNewConversation(initialTitle = "New chat") {
  const conv = {
    id: uid(),
    title: initialTitle,
    hasSmartTitle: false,
    updatedAt: Date.now(),
    messages: []
  };
  state.conversations.unshift(conv);
  state.activeConvId = conv.id;
  scheduleCloudSync();
  renderConversationList();
  renderActiveChat();
  return conv;
}

function isWakeOnlyPrompt(text) {
  const clean = String(text || "").trim();
  if (!clean || clean.length > 45) return false;
  return !/report|brief|schedule|task|todo|note|done|finish|complet|submit|mark|check|add|remov|delet|updat|overwrit|edit|calculat|solve|search|http|who am i|identify|diagram|erd|quiz|remember|time|date|day|today|status|update|next|pending|class|deadline|exam|project|plan|remind|memory|fact|know|help with|explain|write|code|debug|news|headline|latest|current|weather|forecast|image|picture|photo|illustration|drawing|sketch|paint|draw|skill/i.test(
    clean
  );
}

function startInlineConversationRename(conv, item, meta, titleEl) {
  if (item.dataset.editing === "true") return;
  item.dataset.editing = "true";

  const currentTitle = conv.title || "New chat";
  const input = document.createElement("input");
  input.type = "text";
  input.className = "conv-rename-input";
  input.value = currentTitle;
  input.maxLength = 80;
  input.setAttribute("aria-label", "Rename chat");

  let finished = false;
  const finishRename = (shouldSave) => {
    if (finished) return;
    finished = true;
    delete item.dataset.editing;
    if (shouldSave) {
      const nextTitle = input.value.trim();
      if (nextTitle && nextTitle !== conv.title) {
        conv.title = nextTitle;
        conv.hasSmartTitle = true;
        conv.updatedAt = Date.now();
        scheduleCloudSync();
      }
    }
    renderConversationList();
  };

  ["click", "dblclick", "pointerdown", "touchstart"].forEach((evtName) => {
    input.addEventListener(evtName, (e) => e.stopPropagation());
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      finishRename(true);
    } else if (e.key === "Escape") {
      e.preventDefault();
      finishRename(false);
    }
  });
  input.addEventListener("blur", () => finishRename(true));

  meta.replaceChild(input, titleEl);
  input.focus();
  input.select();
}

export function renderConversationList() {
  const query = $("conv-search").value.trim().toLowerCase();
  const listEl = $("conversation-list");
  listEl.innerHTML = "";

  const filtered = state.conversations.filter((c) =>
    (c.title || "New chat").toLowerCase().includes(query)
  );

  if (!filtered.length) {
    listEl.innerHTML = `<div class="empty-hint">No chats yet</div>`;
    return;
  }

  filtered.forEach((conv) => {
    const item = document.createElement("div");
    item.className = "conv-item" + (conv.id === state.activeConvId ? " active" : "");

    const meta = document.createElement("div");
    meta.className = "conv-meta";
    const title = document.createElement("div");
    title.className = "conv-title";
    title.textContent = conv.title || "New chat";
    meta.appendChild(title);

    const actions = document.createElement("div");
    actions.className = "conv-actions";

    const renameBtn = document.createElement("button");
    renameBtn.className = "conv-rename-btn";
    renameBtn.type = "button";
    renameBtn.title = "Rename chat";
    renameBtn.setAttribute("aria-label", "Rename chat");
    renameBtn.innerHTML =
      `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">` +
        `<path d="M12 20h9"></path>` +
        `<path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z"></path>` +
      `</svg>`;
    renameBtn.addEventListener("pointerdown", (e) => e.stopPropagation());
    renameBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      startInlineConversationRename(conv, item, meta, title);
    });

    const delBtn = document.createElement("button");
    delBtn.className = "conv-del-btn";
    delBtn.type = "button";
    delBtn.title = "Delete chat";
    delBtn.setAttribute("aria-label", "Delete chat");
    delBtn.innerHTML = "&times;";
    delBtn.addEventListener("pointerdown", (e) => e.stopPropagation());
    delBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      state.conversations = state.conversations.filter((c) => c.id !== conv.id);
      if (state.activeConvId === conv.id) {
        state.activeConvId = state.conversations[0]?.id || "";
      }
      scheduleCloudSync();
      renderConversationList();
      renderActiveChat();
    });

    actions.appendChild(renameBtn);
    actions.appendChild(delBtn);

    meta.addEventListener("dblclick", (e) => {
      e.stopPropagation();
      startInlineConversationRename(conv, item, meta, title);
    });

    let longPressTimer = null;
    let longPressTriggered = false;
    let pressStartX = 0;
    let pressStartY = 0;

    const clearLongPress = () => {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
    };

    item.addEventListener("pointerdown", (e) => {
      if (item.dataset.editing === "true") return;
      if (e.button !== undefined && e.button !== 0) return;
      if (e.target.closest(".conv-actions")) return;
      longPressTriggered = false;
      pressStartX = e.clientX;
      pressStartY = e.clientY;
      clearLongPress();
      longPressTimer = setTimeout(() => {
        longPressTriggered = true;
        longPressTimer = null;
        startInlineConversationRename(conv, item, meta, title);
      }, 500);
    });

    item.addEventListener("pointermove", (e) => {
      if (!longPressTimer) return;
      if (Math.hypot(e.clientX - pressStartX, e.clientY - pressStartY) > 10) {
        clearLongPress();
      }
    });

    item.addEventListener("pointerup", clearLongPress);
    item.addEventListener("pointercancel", clearLongPress);
    item.addEventListener("pointerleave", clearLongPress);
    item.addEventListener("contextmenu", (e) => {
      if (longPressTriggered || e.pointerType === "touch") {
        e.preventDefault();
      }
    });

    item.addEventListener("click", () => {
      if (item.dataset.editing === "true") return;
      if (longPressTriggered) {
        longPressTriggered = false;
        return;
      }
      state.activeConvId = conv.id;
      saveLocalSnapshot();
      renderConversationList();
      renderActiveChat();
      if (window.innerWidth <= 1024) closeLeftSidebar();
    });

    item.appendChild(meta);
    item.appendChild(actions);
    listEl.appendChild(item);
  });
}

function buildCitationsElement(citations) {
  const valid = (Array.isArray(citations) ? citations : []).filter(
    (c) => c && typeof c.url === "string" && /^https?:\/\//i.test(c.url)
  );
  if (!valid.length) return null;

  const wrap = document.createElement("div");
  wrap.className = "citations-bar";
  wrap.style.cssText =
    "display:flex;flex-wrap:wrap;gap:6px;margin-top:10px;align-items:center;";

  valid.forEach((c) => {
    const link = document.createElement("a");
    link.className = "citation-pill";
    link.href = c.url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.style.cssText =
      "display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:999px;" +
      "font-size:12px;text-decoration:none;border:1px solid var(--border-color, rgba(255,255,255,0.14));" +
      "background:var(--surface-elevated, rgba(255,255,255,0.04));color:var(--accent, #60a5fa);";

    const label = c.source || c.title || "Verified Source";
    const timeSuffix = c.publishedAt ? ` • ${c.publishedAt}` : "";
    link.textContent = `${label}${timeSuffix}`;
    link.title = c.title ? `${c.title} (${c.url})` : c.url;
    wrap.appendChild(link);
  });

  return wrap;
}

function buildAiMessageElement(msg) {
  const row = document.createElement("div");
  row.className = "msg-row ai";
  row.dataset.msgId = msg.id;

  const head = document.createElement("div");
  head.className = "ai-msg-head";
  head.innerHTML =
    `<div class="ai-avatar">` +
      `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4">` +
        `<polygon points="12 2 19 21 12 17 5 21 12 2"></polygon>` +
      `</svg>` +
    `</div>` +
    `<span>${escapeHtml(ASSISTANT_NAME)}</span>`;

  const content = document.createElement("div");
  content.className = "ai-content";

  if (msg.pending) {
    content.innerHTML = `<div class="thinking-wrap"><span></span><span></span><span></span></div>`;
    row.appendChild(head);
    row.appendChild(content);
    return row;
  }

  const { html, codeBlocks } = renderMarkdown(msg.text || "");
  content.innerHTML = html;
  typesetMath(content);

  content.querySelectorAll(".code-wrapper").forEach((wrap) => {
    const idx = Number(wrap.dataset.codeIdx);
    const btn = wrap.querySelector(".copy-code-btn");
    if (btn && codeBlocks[idx]) {
      btn.addEventListener("click", () => copyToClipboard(codeBlocks[idx].code, btn, "Copy"));
    }
  });

  row.appendChild(head);
  row.appendChild(content);

  const citationsEl = buildCitationsElement(msg.citations);
  if (citationsEl) {
    row.appendChild(citationsEl);
  }

  if (msg.generatedImage) {
    const media = document.createElement("div");
    media.className = "media-card media-inspectable";
    media.title = "Click to inspect full screen";
    media.innerHTML = `<img src="${msg.generatedImage}" alt="Generated visual" />`;
    row.appendChild(media);
  } else if (msg.generatedSvg) {
    const media = document.createElement("div");
    media.className = "media-card media-inspectable";
    media.title = "Click to inspect full screen";
    media.innerHTML = `${msg.generatedSvg}`;
    row.appendChild(media);
  }

  const toolbar = document.createElement("div");
  toolbar.className = "msg-toolbar";

  const copyBtn = document.createElement("button");
  copyBtn.className = "msg-action-btn";
  copyBtn.type = "button";
  copyBtn.textContent = "Copy";
  copyBtn.addEventListener("click", () => copyToClipboard(msg.text || "", copyBtn, "Copy"));

  const selectBtn = document.createElement("button");
  selectBtn.className = "msg-action-btn";
  selectBtn.type = "button";
  selectBtn.textContent = "Select text";
  selectBtn.addEventListener("click", () => openSelectTextModal(msg.text || ""));

  const noteBtn = document.createElement("button");
  noteBtn.className = "msg-action-btn";
  noteBtn.type = "button";
  noteBtn.textContent = "Save to Notes";
  noteBtn.addEventListener("click", () => {
    const snippetTitle =
      (msg.text || "").split("\n")[0].replace(/[#*`$]/g, "").trim().slice(0, 48) ||
      `${ASSISTANT_NAME} Note`;
    state.notes.unshift({
      id: uid(),
      title: snippetTitle,
      content: msg.text || "",
      tag: "Engineering",
      updatedAt: new Date().toLocaleDateString()
    });
    scheduleCloudSync();
    renderNotes();
    noteBtn.textContent = "Saved";
    setTimeout(() => {
      noteBtn.textContent = "Save to Notes";
    }, 1500);
  });

  toolbar.appendChild(copyBtn);
  toolbar.appendChild(selectBtn);
  toolbar.appendChild(noteBtn);
  row.appendChild(toolbar);
  return row;
}

export function renderActiveChat() {
  const conv = getActiveConversation();
  const welcome = $("welcome-view");
  const container = $("messages-container");

  if (!conv || !conv.messages.length) {
    welcome.classList.remove("hidden");
    container.classList.add("hidden");
    container.innerHTML = "";
    return;
  }

  welcome.classList.add("hidden");
  container.classList.remove("hidden");
  container.innerHTML = "";

  conv.messages.forEach((msg) => {
    if (msg.role === "user") {
      const row = document.createElement("div");
      row.className = "msg-row user";

      if (msg.attachment) {
        const tag = document.createElement("div");
        tag.className = "user-attachment-tag";
        if (msg.attachment.dataUrl && (msg.attachment.mimeType || "").startsWith("image/")) {
          const img = document.createElement("img");
          img.src = msg.attachment.dataUrl;
          img.alt = msg.attachment.name;
          tag.appendChild(img);
        } else {
          tag.textContent = `Attached: ${msg.attachment.name}`;
        }
        row.appendChild(tag);
      }

      if (msg.text) {
        const bubble = document.createElement("div");
        bubble.className = "user-bubble";
        bubble.textContent = msg.text;
        row.appendChild(bubble);
      }

      container.appendChild(row);
    } else {
      container.appendChild(buildAiMessageElement(msg));
    }
  });

  const scrollEl = $("chat-scroll");
  scrollEl.scrollTop = scrollEl.scrollHeight;
}

export function autoResizeInput() {
  const el = $("prompt-input");
  el.style.height = "auto";
  el.style.height = Math.min(el.scrollHeight, 132) + "px";
}

export function updateSendButtonState() {
  const hasText = $("prompt-input").value.trim().length > 0;
  const hasFile = Boolean(state.pendingAttachment);
  $("send-btn").disabled = state.isSending || (!hasText && !hasFile);
}

export function setPendingAttachment(att) {
  state.pendingAttachment = att;
  const preview = $("attachment-preview");
  const thumb = $("preview-thumb");
  if (!att) {
    preview.classList.add("hidden");
    thumb.classList.add("hidden");
    thumb.src = "";
    updateSendButtonState();
    return;
  }
  const sizeInfo = att.content
    ? ` (${att.content.length.toLocaleString()} chars)`
    : att.slidesText
    ? ` (${att.slideCount} slides)`
    : "";
  $("preview-name").textContent = att.name + sizeInfo;
  if (att.dataUrl) {
    thumb.src = att.dataUrl;
    thumb.classList.remove("hidden");
  } else {
    thumb.classList.add("hidden");
  }
  preview.classList.remove("hidden");
  updateSendButtonState();
}

function buildVaultContext(prompt) {
  if (!state.vault.length) return "";
  const terms = prompt.toLowerCase().split(/\W+/).filter((w) => w.length > 2);
  const scored = state.vault.map((doc) => {
    const hay = (doc.name + " " + doc.content).toLowerCase();
    let score = 0;
    terms.forEach((t) => {
      if (hay.includes(t)) score += 1;
    });
    return { doc, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored
    .slice(0, 3)
    .map((s) => `[Vault: ${s.doc.name}]\n${s.doc.content.slice(0, 16000)}`)
    .join("\n\n");
}

async function queryWorkerChat(payload, onToken = null) {
  const base = state.apiUrl.replace(/\/+$/, "");
  if (!base) {
    throw new Error("No Backend Server URL configured. Open the sidebar gear icon to set your API URL.");
  }

  const res = await fetch(`${base}/`, {
    method: "POST",
    headers: getAuthHeaders({
      "Content-Type": "application/json",
      Accept: "text/event-stream, application/json"
    }),
    body: JSON.stringify({ ...payload, stream: true })
  });

  if (res.status === 401) {
    throw new Error("UNAUTHORIZED");
  }

  const contentType = res.headers.get("content-type") || "";

  if (contentType.includes("text/event-stream") && res.body && typeof res.body.getReader === "function") {
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let finalResponse = null;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith(":")) continue;
          if (trimmed.startsWith("data:")) {
            const dataStr = trimmed.slice(5).trim();
            if (dataStr === "[DONE]") break;
            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.error) {
                throw new Error(parsed.error);
              }
              if (parsed.token && typeof onToken === "function") {
                onToken(parsed.token);
              }
              if (parsed.done && parsed.response) {
                finalResponse = parsed.response;
              }
            } catch (err) {
              if (err.message && err.message !== "Unexpected end of JSON input") {
                if (err.message.startsWith("All configured AI providers failed") || !err.message.includes("JSON")) {
                  throw err;
                }
              }
            }
          }
        }
      }

      if (buffer.trim().startsWith("data:")) {
        const dataStr = buffer.trim().slice(5).trim();
        if (dataStr !== "[DONE]") {
          try {
            const parsed = JSON.parse(dataStr);
            if (parsed.error) throw new Error(parsed.error);
            if (parsed.token && typeof onToken === "function") {
              onToken(parsed.token);
            }
            if (parsed.done && parsed.response) {
              finalResponse = parsed.response;
            }
          } catch {}
        }
      }
    } finally {
      try {
        reader.releaseLock();
      } catch {}
    }

    if (finalResponse) {
      return finalResponse;
    }
  }

  // Non-streaming fallback (or if server returned JSON)
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || data.reply || `HTTP ${res.status}`);
  }
  return data;
}

export async function sendMessage(overrideText = null) {
  if (state.isSending) return;
  const inputEl = $("prompt-input");
  const text = (overrideText !== null ? overrideText : inputEl.value).trim();
  const attachment = state.pendingAttachment;

  if (!text && !attachment) return;

  const wakeOnly = !attachment && isWakeOnlyPrompt(text);
  const placeholderTitle = wakeOnly
    ? "New chat"
    : text.slice(0, 42) || attachment?.name || "New chat";

  let conv = getActiveConversation();
  if (!conv) {
    conv = createNewConversation(placeholderTitle);
  } else if (!conv.messages.length || conv.title === "New chat" || /^jarvis$/i.test((conv.title || "").trim())) {
    conv.title = placeholderTitle;
  }

  const needsTitle =
    !conv.hasSmartTitle ||
    !conv.title ||
    conv.title === "New chat" ||
    /^jarvis$/i.test(conv.title.trim());

  const geminiHistory = conv.messages
    .filter((m) => !m.pending && m.text)
    .slice(-14)
    .map((m) => ({
      role: m.role === "ai" ? "model" : "user",
      parts: [{ text: m.text }]
    }));

  conv.messages.push({
    id: uid(),
    role: "user",
    text,
    attachment: attachment
      ? { name: attachment.name, mimeType: attachment.mimeType || "", dataUrl: attachment.dataUrl || "" }
      : null
  });

  const pendingMsg = { id: uid(), role: "ai", text: "", pending: true };
  conv.messages.push(pendingMsg);
  conv.updatedAt = Date.now();

  if (overrideText === null) {
    inputEl.value = "";
    autoResizeInput();
  }
  setPendingAttachment(null);
  state.isSending = true;
  updateSendButtonState();
  saveLocalSnapshot();
  renderConversationList();
  renderActiveChat();

  const vaultContext = buildVaultContext(text);
  const workspaceSnapshot = {
    schedule: state.schedule,
    todos: state.todos,
    notes: state.notes.map((n) => ({ title: n.title, tag: n.tag || "Study" })),
    vaultCatalog: state.vault.map((v) => ({
      name: v.name,
      detail: `${v.content.length.toLocaleString()} chars`
    }))
  };

  const cleanAttachment = attachment
    ? {
        type: attachment.type,
        name: attachment.name,
        mimeType: attachment.mimeType,
        data: attachment.data,
        fileUri: attachment.fileUri,
        content: attachment.content,
        slideCount: attachment.slideCount,
        slidesText: attachment.slidesText,
        slideImages: attachment.slideImages
      }
    : null;

  setHudState("thinking");
  let streamStarted = false;
  let rafId = null;

  // ---- Voice envelope for HUD particle displacement during streaming ----
  // Each arriving token pulses the voice level up; it naturally decays in the
  // HUD render loop's syllable envelope when no new tokens arrive.
  let _voiceDecayTimer = null;
  const _HUD_TOKEN_PULSE = 0.72;   // voice level on token arrival (0–1)
  const _HUD_DECAY_MS   = 180;     // ms after last token before hard-reset to 0

  function _pulseHudVoice() {
    setHudVoiceLevel(_HUD_TOKEN_PULSE);
    if (_voiceDecayTimer) clearTimeout(_voiceDecayTimer);
    _voiceDecayTimer = setTimeout(() => {
      setHudVoiceLevel(0);
      _voiceDecayTimer = null;
    }, _HUD_DECAY_MS);
  }

  const flushTokenRender = () => {
    rafId = null;
    const container = $("messages-container");
    if (!container) return;
    const row = container.querySelector(`.msg-row.ai[data-msg-id="${pendingMsg.id}"]`);
    if (!row) return;
    const content = row.querySelector(".ai-content");
    if (!content) return;
    const { html } = renderMarkdown(pendingMsg.text);
    content.innerHTML = html;
    const scrollEl = $("chat-scroll");
    if (scrollEl) {
      scrollEl.scrollTop = scrollEl.scrollHeight;
    }
  };

  const handleStreamToken = (token) => {
    if (!streamStarted) {
      streamStarted = true;
      pendingMsg.pending = false;
      setHudState("responding");
    }
    pendingMsg.text += token;
    _pulseHudVoice();
    if (!rafId) {
      rafId = requestAnimationFrame(flushTokenRender);
    }
  };

  try {
    const data = await queryWorkerChat(
      {
        message: text,
        history: geminiHistory,
        attachment: cleanAttachment,
        vaultContext,
        workspaceSnapshot,
        needsTitle
      },
      handleStreamToken
    );

    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }

    pendingMsg.pending = false;
    pendingMsg.text = data.reply || pendingMsg.text || "I didn't receive a valid response, sir.";
    if (Array.isArray(data.citations) && data.citations.length) {
      pendingMsg.citations = data.citations;
    }
    if (data.generatedImage) pendingMsg.generatedImage = data.generatedImage;
    if (data.generatedSvg) pendingMsg.generatedSvg = data.generatedSvg;

    if (data.chatTitle && typeof data.chatTitle === "string") {
      conv.title = data.chatTitle.trim();
      conv.hasSmartTitle = true;
    }

    if (data.requiresConfirmation && data.pendingTool) {
      openConfirmToolModal(data.confirmationSummary, data.pendingTool);
    }

    if (data.updatedWorkspace) {
      if (Array.isArray(data.updatedWorkspace.schedule)) state.schedule = data.updatedWorkspace.schedule;
      if (Array.isArray(data.updatedWorkspace.todos)) state.todos = data.updatedWorkspace.todos;
      if (Array.isArray(data.updatedWorkspace.notes)) state.notes = data.updatedWorkspace.notes;
      if (Array.isArray(data.updatedWorkspace.skills)) state.skills = data.updatedWorkspace.skills;
      renderSchedule();
      renderTodos();
      renderNotes();
    }
  } catch (err) {
    if (err.message === "UNAUTHORIZED") {
      conv.messages = conv.messages.filter((m) => m.id !== pendingMsg.id);
      state.isSending = false;
      if (typeof unauthorizedHandler === "function") {
        unauthorizedHandler("Session expired. Please sign in with your passcode.");
      }
      return;
    }
    pendingMsg.pending = false;
    pendingMsg.text = `Connection notice: ${err.message}`;
  } finally {
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    if (_voiceDecayTimer) {
      clearTimeout(_voiceDecayTimer);
      _voiceDecayTimer = null;
    }
    setHudVoiceLevel(0);
    setHudState("idle");
    state.isSending = false;
    updateSendButtonState();
    scheduleCloudSync();
    renderConversationList();
    renderActiveChat();
  }
}

export async function executeConfirmedTool() {
  const pendingTool = state.pendingToolAction;
  closeConfirmToolModal();
  if (!pendingTool) return;

  const conv = getActiveConversation();
  const base = state.apiUrl.replace(/\/+$/, "");
  try {
    const res = await fetch(`${base}/confirm-tool`, {
      method: "POST",
      headers: getAuthHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ pendingTool })
    });
    if (res.status === 401) {
      if (typeof unauthorizedHandler === "function") {
        unauthorizedHandler("Session expired. Please sign in again.");
      }
      return;
    }
    const data = await res.json();
    if (data.updatedWorkspace) {
      if (Array.isArray(data.updatedWorkspace.schedule)) state.schedule = data.updatedWorkspace.schedule;
      if (Array.isArray(data.updatedWorkspace.todos)) state.todos = data.updatedWorkspace.todos;
      if (Array.isArray(data.updatedWorkspace.notes)) state.notes = data.updatedWorkspace.notes;
      if (Array.isArray(data.updatedWorkspace.skills)) state.skills = data.updatedWorkspace.skills;
      saveLocalSnapshot();
      renderSchedule();
      renderTodos();
      renderNotes();
    }
    if (conv) {
      conv.messages.push({
        id: uid(),
        role: "ai",
        text: data.reply || "Confirmed and completed, sir."
      });
      scheduleCloudSync();
      renderActiveChat();
    }
  } catch (err) {
    if (conv) {
      conv.messages.push({
        id: uid(),
        role: "ai",
        text: `Confirmation error: ${err.message}`
      });
      renderActiveChat();
    }
  }
}
