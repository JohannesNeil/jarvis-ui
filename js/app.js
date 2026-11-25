import {
  DEFAULT_WORKER_URL,
  STORAGE_KEYS,
  state,
  uid,
  hasValidSession,
  deriveVaultKeyB64,
  loadLocalData
} from "./state.js";
import { extractFilePayload } from "./files.js";
import {
  $,
  copyToClipboard,
  applyTheme,
  openLeftSidebar,
  closeLeftSidebar,
  openRightSidebar,
  closeRightSidebar,
  openCommandHubTab,
  closeSelectTextModal,
  closeConfirmToolModal,
  openServerModal,
  closeServerModal
} from "./ui.js";
import {
  registerSyncCallbacks,
  pullCloudWorkspace,
  scheduleCloudSync,
  pushCloudWorkspace
} from "./sync.js";
import {
  updateCounts,
  renderSchedule,
  renderTodos,
  renderNotes,
  renderVault
} from "./workspace.js";
import {
  setChatUnauthorizedHandler,
  getActiveConversation,
  createNewConversation,
  renderConversationList,
  renderActiveChat,
  autoResizeInput,
  updateSendButtonState,
  setPendingAttachment,
  sendMessage,
  executeConfirmedTool
} from "./chat.js";

function renderAllViews() {
  renderConversationList();
  renderActiveChat();
  renderSchedule();
  renderTodos();
  renderNotes();
  renderVault();
  updateCounts();
}

function signOutWithReason(reason = "") {
  state.sessionToken = "";
  state.sessionExpiresAt = 0;
  state.vaultKeyB64 = "";
  localStorage.removeItem(STORAGE_KEYS.sessionToken);
  localStorage.removeItem(STORAGE_KEYS.sessionExpiresAt);
  localStorage.removeItem(STORAGE_KEYS.vaultKeyB64);
  $("app-screen").classList.add("hidden");
  $("login-screen").classList.remove("hidden");
  $("passcode-input").value = "";
  $("login-error").textContent = reason;
}

function enterWorkspace() {
  $("login-screen").classList.add("hidden");
  $("app-screen").classList.remove("hidden");
  if (window.innerWidth > 1024) {
    $("left-sidebar").classList.remove("collapsed");
  }
  renderAllViews();
}

async function handleIncomingFile(file) {
  if (!file) return;
  try {
    $("preview-name").textContent = `Processing ${file.name}...`;
    $("attachment-preview").classList.remove("hidden");
    const payload = await extractFilePayload(file);
    setPendingAttachment(payload);
  } catch (err) {
    setPendingAttachment(null);
    if (err.message === "UNAUTHORIZED") {
      signOutWithReason("Session expired. Please sign in again.");
      return;
    }
    alert("Could not process file: " + (err.message || err));
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  registerSyncCallbacks({
    onRenderAll: renderAllViews,
    onCountsUpdated: updateCounts,
    onUnauthorized: signOutWithReason
  });
  setChatUnauthorizedHandler(signOutWithReason);

  loadLocalData();
  applyTheme(state.theme);

  if (hasValidSession()) {
    enterWorkspace();
    const syncResult = await pullCloudWorkspace();
    if (syncResult === "unauthorized") {
      signOutWithReason("Session expired. Please sign in with your passcode.");
    }
  } else {
    signOutWithReason("");
  }

  /* Login via /auth -> HMAC session token + PBKDF2 AES-GCM key */
  $("login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const passcode = $("passcode-input").value.trim();
    if (!passcode) return;
    $("login-error").textContent = "";
    $("login-btn").disabled = true;

    try {
      const base = state.apiUrl.replace(/\/+$/, "");
      const authRes = await fetch(`${base}/auth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode })
      });

      const authData = await authRes.json().catch(() => ({}));
      if (authRes.status === 429) {
        throw new Error(authData.error || "Too many failed attempts. Wait 60 seconds.");
      }
      if (!authRes.ok || !authData.token) {
        throw new Error(authData.error || "Access denied: wrong passcode.");
      }

      const derivedKey = await deriveVaultKeyB64(passcode);
      state.sessionToken = authData.token;
      state.sessionExpiresAt = authData.expiresAt || Date.now() + 24 * 60 * 60 * 1000;
      state.vaultKeyB64 = derivedKey;

      localStorage.setItem(STORAGE_KEYS.sessionToken, state.sessionToken);
      localStorage.setItem(STORAGE_KEYS.sessionExpiresAt, String(state.sessionExpiresAt));
      localStorage.setItem(STORAGE_KEYS.vaultKeyB64, state.vaultKeyB64);

      const syncResult = await pullCloudWorkspace();
      if (syncResult === "unauthorized") {
        throw new Error("Vault unlock failed. Please verify your passcode.");
      }

      enterWorkspace();
      await pushCloudWorkspace();
    } catch (err) {
      $("login-error").textContent = err.message || "Authentication failed";
    } finally {
      $("login-btn").disabled = false;
    }
  });

  $("logout-btn").addEventListener("click", () => signOutWithReason(""));
  $("sync-now-btn").addEventListener("click", () => pullCloudWorkspace());

  /* Destructive Tool Confirmation Modal */
  $("confirm-tool-cancel-btn").addEventListener("click", () => {
    closeConfirmToolModal();
    const conv = getActiveConversation();
    if (conv) {
      conv.messages.push({
        id: uid(),
        role: "ai",
        text: "Action cancelled, sir. No items were removed."
      });
      scheduleCloudSync();
      renderActiveChat();
    }
  });
  $("confirm-tool-approve-btn").addEventListener("click", executeConfirmedTool);

  /* Theme & Server Modals */
  $("theme-toggle-btn").addEventListener("click", () => {
    applyTheme(state.theme === "dark" ? "light" : "dark");
  });

  $("open-server-btn").addEventListener("click", openServerModal);
  $("open-server-from-login").addEventListener("click", openServerModal);
  $("server-close-btn").addEventListener("click", closeServerModal);
  $("server-save-btn").addEventListener("click", () => {
    const nextUrl = $("server-url-input").value.trim() || DEFAULT_WORKER_URL;
    state.apiUrl = nextUrl;
    localStorage.setItem(STORAGE_KEYS.apiUrl, state.apiUrl);
    closeServerModal();
  });

  /* Select Text Sheet */
  $("select-close-btn").addEventListener("click", closeSelectTextModal);
  $("select-modal").addEventListener("click", (e) => {
    if (e.target === $("select-modal")) closeSelectTextModal();
  });
  $("select-copy-all-btn").addEventListener("click", () => {
    copyToClipboard($("select-sheet-body").textContent, $("select-copy-all-btn"), "Copy all");
  });

  /* Sidebars & Left Nav */
  $("toggle-left-btn").addEventListener("click", () => {
    if ($("left-sidebar").classList.contains("collapsed")) openLeftSidebar();
    else closeLeftSidebar();
  });
  $("collapse-left-btn").addEventListener("click", closeLeftSidebar);
  $("toggle-right-btn").addEventListener("click", () => {
    if ($("right-sidebar").classList.contains("collapsed")) openRightSidebar();
    else closeRightSidebar();
  });
  $("close-right-btn").addEventListener("click", closeRightSidebar);
  $("drawer-backdrop").addEventListener("click", () => {
    closeLeftSidebar();
    closeRightSidebar();
  });

  document.querySelectorAll(".nav-link-btn[data-hub-tab]").forEach((btn) => {
    btn.addEventListener("click", () => openCommandHubTab(btn.dataset.hubTab));
  });

  /* Chats & Search */
  $("new-chat-btn").addEventListener("click", () => {
    createNewConversation();
    if (window.innerWidth <= 1024) closeLeftSidebar();
  });
  $("conv-search").addEventListener("input", renderConversationList);

  /* Welcome Chips */
  document.querySelectorAll(".prompt-chip").forEach((chip) => {
    chip.addEventListener("click", () => sendMessage(chip.dataset.prompt));
  });

  /* Composer */
  const promptInput = $("prompt-input");
  promptInput.addEventListener("input", () => {
    autoResizeInput();
    updateSendButtonState();
  });
  promptInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
  promptInput.addEventListener("paste", (e) => {
    const items = e.clipboardData?.items || [];
    for (const item of items) {
      if (item.kind === "file") {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          handleIncomingFile(file);
          return;
        }
      }
    }
  });

  $("send-btn").addEventListener("click", () => sendMessage());
  $("attach-btn").addEventListener("click", () => $("file-input").click());
  $("file-input").addEventListener("change", (e) => {
    if (e.target.files?.[0]) handleIncomingFile(e.target.files[0]);
    e.target.value = "";
  });
  $("remove-attach-btn").addEventListener("click", () => setPendingAttachment(null));

  /* Global Drag & Drop */
  let dragDepth = 0;
  window.addEventListener("dragenter", (e) => {
    e.preventDefault();
    dragDepth++;
    $("drop-overlay").classList.remove("hidden");
  });
  window.addEventListener("dragover", (e) => e.preventDefault());
  window.addEventListener("dragleave", () => {
    dragDepth = Math.max(0, dragDepth - 1);
    if (!dragDepth) $("drop-overlay").classList.add("hidden");
  });
  window.addEventListener("drop", (e) => {
    e.preventDefault();
    dragDepth = 0;
    $("drop-overlay").classList.add("hidden");
    if (e.dataTransfer?.files?.[0]) handleIncomingFile(e.dataTransfer.files[0]);
  });

  /* Workspace Inspector Tabs & Forms */
  document.querySelectorAll(".hub-tab").forEach((tab) => {
    tab.addEventListener("click", () => openCommandHubTab(tab.dataset.tab));
  });

  $("sched-form").addEventListener("submit", (e) => {
    e.preventDefault();
    state.schedule.unshift({
      id: uid(),
      title: $("sched-title").value.trim(),
      date: new Date().toISOString().slice(0, 10),
      time: $("sched-time").value.trim(),
      category: $("sched-tag").value
    });
    $("sched-title").value = "";
    $("sched-time").value = "";
    scheduleCloudSync();
    renderSchedule();
  });

  $("todo-form").addEventListener("submit", (e) => {
    e.preventDefault();
    state.todos.unshift({
      id: uid(),
      text: $("todo-text").value.trim(),
      priority: $("todo-priority").value,
      done: false
    });
    $("todo-text").value = "";
    scheduleCloudSync();
    renderTodos();
  });

  $("note-form").addEventListener("submit", (e) => {
    e.preventDefault();
    state.notes.unshift({
      id: uid(),
      title: $("note-title").value.trim(),
      content: $("note-body").value.trim(),
      tag: "Engineering",
      updatedAt: new Date().toLocaleDateString()
    });
    $("note-title").value = "";
    $("note-body").value = "";
    scheduleCloudSync();
    renderNotes();
  });

  $("vault-drop-zone").addEventListener("click", () => $("vault-file-input").click());
  $("vault-file-input").addEventListener("change", async (e) => {
    const files = Array.from(e.target.files || []);
    for (const f of files) {
      try {
        const parsed = await extractFilePayload(f);
        const textBody = parsed.content || parsed.slidesText || "";
        if (textBody) {
          state.vault.unshift({
            id: uid(),
            name: parsed.name,
            content: textBody
          });
        }
      } catch (err) {
        alert(`Failed to index ${f.name}: ${err.message}`);
      }
    }
    e.target.value = "";
    scheduleCloudSync();
    renderVault();
  });
});
