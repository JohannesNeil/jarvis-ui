import { state, getAuthHeaders, persistLocal } from "./state.js";
import { $ } from "./ui.js";

let syncTimer = null;
let callbacks = {
  onRenderAll: null,
  onCountsUpdated: null,
  onUnauthorized: null
};

export function registerSyncCallbacks(nextCallbacks) {
  callbacks = { ...callbacks, ...nextCallbacks };
}

export function saveLocalSnapshot() {
  persistLocal(callbacks.onCountsUpdated);
}

export function setSyncStatus(status) {
  const dot = $("sync-dot");
  if (!dot) return;
  dot.className = "sync-dot" + (status === "syncing" ? " syncing" : status === "offline" ? " offline" : "");
}

export async function pullCloudWorkspace() {
  if (!state.sessionToken || !state.vaultKeyB64 || state.sessionExpiresAt <= Date.now()) {
    return "unauthorized";
  }
  const base = state.apiUrl.replace(/\/+$/, "");
  setSyncStatus("syncing");
  try {
    const res = await fetch(`${base}/workspace`, {
      method: "GET",
      headers: getAuthHeaders()
    });
    if (res.status === 401 || res.status === 423) {
      setSyncStatus("offline");
      return "unauthorized";
    }
    if (!res.ok) {
      setSyncStatus("offline");
      return false;
    }
    const data = await res.json();
    if (Array.isArray(data.schedule)) state.schedule = data.schedule;
    if (Array.isArray(data.todos)) state.todos = data.todos;
    if (Array.isArray(data.notes)) state.notes = data.notes;
    if (Array.isArray(data.conversations) && data.conversations.length) {
      state.conversations = data.conversations;
      if (!state.conversations.some((c) => c.id === state.activeConvId)) {
        state.activeConvId = state.conversations[0].id;
      }
    }
    saveLocalSnapshot();
    if (typeof callbacks.onRenderAll === "function") callbacks.onRenderAll();
    setSyncStatus("online");
    return true;
  } catch {
    setSyncStatus("offline");
    return false;
  }
}

export function scheduleCloudSync() {
  saveLocalSnapshot();
  if (!state.sessionToken || !state.vaultKeyB64 || state.sessionExpiresAt <= Date.now()) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(pushCloudWorkspace, 800);
}

export async function pushCloudWorkspace() {
  if (!state.sessionToken || !state.vaultKeyB64 || state.sessionExpiresAt <= Date.now()) return;
  const base = state.apiUrl.replace(/\/+$/, "");
  setSyncStatus("syncing");
  try {
    const compactConversations = state.conversations.slice(0, 30).map((c) => ({
      id: c.id,
      title: c.title,
      updatedAt: c.updatedAt,
      messages: (c.messages || [])
        .filter((m) => !m.pending)
        .slice(-30)
        .map((m) => ({
          id: m.id,
          role: m.role,
          text: m.text || "",
          attachment: m.attachment ? { name: m.attachment.name, type: m.attachment.type } : null
        }))
    }));

    const payload = {
      schedule: state.schedule,
      todos: state.todos,
      notes: state.notes,
      conversations: compactConversations,
      vaultCatalog: state.vault.map((v) => ({
        id: v.id,
        name: v.name,
        detail: `${v.content.length.toLocaleString()} chars`
      }))
    };

    const res = await fetch(`${base}/workspace`, {
      method: "POST",
      headers: getAuthHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload)
    });
    if (res.status === 401 && typeof callbacks.onUnauthorized === "function") {
      callbacks.onUnauthorized("Session expired. Please sign in again.");
      return;
    }
    setSyncStatus(res.ok ? "online" : "offline");
  } catch {
    setSyncStatus("offline");
  }
}
