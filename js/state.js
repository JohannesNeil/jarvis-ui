export const DEFAULT_WORKER_URL = "https://jarvis-brain.hydroflouride4.workers.dev";
export const MAX_FILE_CHARS = 180000;

export const STORAGE_KEYS = {
  apiUrl: "jarvis_api_url",
  sessionToken: "jarvis_session_token_v1",
  sessionExpiresAt: "jarvis_session_exp_v1",
  vaultKeyB64: "jarvis_vault_key_v1",
  theme: "jarvis_theme",
  conversations: "jarvis_conversations_v3",
  activeConvId: "jarvis_active_conv_v3",
  schedule: "jarvis_schedule_v3",
  todos: "jarvis_todos_v3",
  notes: "jarvis_notes_v3",
  vault: "jarvis_vault_v3"
};

// Purge any legacy plaintext passcode stored in localStorage
localStorage.removeItem("jarvis_passcode");
localStorage.removeItem("jarvis_auth_token");

function resolveInitialApiUrl() {
  const saved = (localStorage.getItem(STORAGE_KEYS.apiUrl) || "").trim();
  if (!saved || saved.includes("dash.cloudflare.com")) {
    localStorage.setItem(STORAGE_KEYS.apiUrl, DEFAULT_WORKER_URL);
    return DEFAULT_WORKER_URL;
  }
  return saved;
}

export const state = {
  apiUrl: resolveInitialApiUrl(),
  sessionToken: localStorage.getItem(STORAGE_KEYS.sessionToken) || "",
  sessionExpiresAt: Number(localStorage.getItem(STORAGE_KEYS.sessionExpiresAt) || 0),
  vaultKeyB64: localStorage.getItem(STORAGE_KEYS.vaultKeyB64) || "",
  theme: localStorage.getItem(STORAGE_KEYS.theme) || "dark",
  conversations: [],
  activeConvId: localStorage.getItem(STORAGE_KEYS.activeConvId) || "",
  schedule: [],
  todos: [],
  notes: [],
  vault: [],
  pendingAttachment: null,
  pendingToolAction: null,
  isSending: false
};

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function hasValidSession() {
  return Boolean(
    state.sessionToken &&
    state.vaultKeyB64 &&
    state.sessionExpiresAt > Date.now()
  );
}

export function getAuthHeaders(extra = {}) {
  const headers = { ...extra };
  if (state.sessionToken) {
    headers["Authorization"] = `Bearer ${state.sessionToken}`;
  }
  if (state.vaultKeyB64) {
    headers["X-Vault-Key"] = state.vaultKeyB64;
  }
  return headers;
}

// Derive deterministic 256-bit AES-GCM key locally from passcode (never sent as passcode)
export async function deriveVaultKeyB64(passcode) {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(passcode),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: enc.encode("jarvis-zero-knowledge-vault-v1::JohannesNeil"),
      iterations: 150000,
      hash: "SHA-256"
    },
    baseKey,
    256
  );
  const bytes = new Uint8Array(bits);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) {
    bin += String.fromCharCode(bytes[i]);
  }
  return btoa(bin);
}

export function loadLocalData() {
  try {
    state.conversations = JSON.parse(localStorage.getItem(STORAGE_KEYS.conversations) || "[]");
    state.schedule = JSON.parse(localStorage.getItem(STORAGE_KEYS.schedule) || "[]");
    state.todos = JSON.parse(localStorage.getItem(STORAGE_KEYS.todos) || "[]");
    state.notes = JSON.parse(localStorage.getItem(STORAGE_KEYS.notes) || "[]");
    state.vault = JSON.parse(localStorage.getItem(STORAGE_KEYS.vault) || "[]");
  } catch {
    state.conversations = [];
    state.schedule = [];
    state.todos = [];
    state.notes = [];
    state.vault = [];
  }
}

export function persistLocal(onCountsUpdated) {
  localStorage.setItem(STORAGE_KEYS.conversations, JSON.stringify(state.conversations));
  localStorage.setItem(STORAGE_KEYS.activeConvId, state.activeConvId);
  localStorage.setItem(STORAGE_KEYS.schedule, JSON.stringify(state.schedule));
  localStorage.setItem(STORAGE_KEYS.todos, JSON.stringify(state.todos));
  localStorage.setItem(STORAGE_KEYS.notes, JSON.stringify(state.notes));
  localStorage.setItem(STORAGE_KEYS.vault, JSON.stringify(state.vault));
  if (typeof onCountsUpdated === "function") onCountsUpdated();
}
