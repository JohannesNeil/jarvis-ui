/**
 * BATCH 6A — Vault API client helpers (Study Vault separate-file persistence)
 * Standalone module with no circular imports.
 */
import { state, getAuthHeaders } from "./state.js";
import { escapeHtml } from "./markdown.js";

function getApiBase() {
  return (state.apiUrl || "").replace(/\/+$/, "");
}

/**
 * List all vault documents (index only).
 */
export async function vaultList() {
  const res = await fetch(`${getApiBase()}/vault`, {
    headers: getAuthHeaders()
  });
  if (!res.ok) throw new Error(`Vault list failed: ${res.status}`);
  return res.json();
}

/**
 * Upsert (create or update) a vault document.
 * @param {string} docId   - Unique doc ID
 * @param {string} name    - Display name
 * @param {string} content - Full text content
 */
export async function vaultUpsert(docId, name, content) {
  const res = await fetch(`${getApiBase()}/vault`, {
    method: "POST",
    headers: getAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ docId, name, content })
  });
  if (!res.ok) throw new Error(`Vault upsert failed: ${res.status}`);
  return res.json();
}

/**
 * Delete a vault document by ID.
 */
export async function vaultDelete(docId) {
  const res = await fetch(`${getApiBase()}/vault?id=${encodeURIComponent(docId)}`, {
    method: "DELETE",
    headers: getAuthHeaders()
  });
  if (!res.ok) throw new Error(`Vault delete failed: ${res.status}`);
  return res.json();
}

/**
 * Semantic search across vault documents.
 * Returns { results: [{docId, title, chunkIndex, snippet, score}] }
 */
export async function vaultSearch(query, topK = 5) {
  const res = await fetch(`${getApiBase()}/vault/search`, {
    method: "POST",
    headers: getAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ query, topK })
  });
  if (!res.ok) throw new Error(`Vault search failed: ${res.status}`);
  return res.json();
}

/**
 * Formats vault search results as citation HTML snippets.
 */
export function renderVaultCitations(results) {
  if (!results || !results.length) return "";
  const items = results
    .map((r) =>
      `<div class="vault-citation-row">` +
        `<span class="vault-citation-doc">${escapeHtml(r.title)}</span>` +
        `<span class="vault-citation-snippet">${escapeHtml(r.snippet)}</span>` +
        (r.score ? `<span class="vault-citation-score">Score: ${r.score}</span>` : "") +
      `</div>`
    )
    .join("");
  return `<div class="vault-citations-panel"><div class="vault-citations-label">📚 Vault References</div>${items}</div>`;
}
