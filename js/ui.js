import { state, STORAGE_KEYS } from "./state.js";

export const $ = (id) => document.getElementById(id);

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
    btnEl.textContent = "Copied";
    setTimeout(() => {
      btnEl.textContent = defaultLabel;
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
  $("theme-icon-sun").classList.toggle("hidden", state.theme === "light");
  $("theme-icon-moon").classList.toggle("hidden", state.theme === "dark");
}

export function syncBackdrop() {
  const isMobile = window.innerWidth <= 1024;
  const leftOpen = !$("left-sidebar").classList.contains("collapsed");
  const rightOpen = !$("right-sidebar").classList.contains("collapsed");
  $("drawer-backdrop").classList.toggle("active", isMobile && (leftOpen || rightOpen));
}

export function openLeftSidebar() {
  if (window.innerWidth <= 1024) $("right-sidebar").classList.add("collapsed");
  $("left-sidebar").classList.remove("collapsed");
  syncBackdrop();
}

export function closeLeftSidebar() {
  $("left-sidebar").classList.add("collapsed");
  syncBackdrop();
}

export function openRightSidebar() {
  if (window.innerWidth <= 1024) $("left-sidebar").classList.add("collapsed");
  $("right-sidebar").classList.remove("collapsed");
  syncBackdrop();
}

export function closeRightSidebar() {
  $("right-sidebar").classList.add("collapsed");
  syncBackdrop();
}

export function openCommandHubTab(tabName) {
  document.querySelectorAll(".hub-tab").forEach((t) => {
    t.classList.toggle("active", t.dataset.tab === tabName);
  });
  ["schedule", "todo", "notes", "vault"].forEach((name) => {
    $("panel-" + name).classList.toggle("hidden", name !== tabName);
  });
  openRightSidebar();
}

window.openCommandHubTab = openCommandHubTab;

export function openSelectTextModal(rawText) {
  $("select-sheet-body").textContent = rawText;
  $("select-modal").classList.remove("hidden");
}

export function closeSelectTextModal() {
  $("select-modal").classList.add("hidden");
  $("select-sheet-body").textContent = "";
}

export function openConfirmToolModal(summary, pendingTool) {
  state.pendingToolAction = pendingTool;
  $("confirm-tool-summary").textContent = summary || "Confirm this workspace deletion?";
  $("confirm-tool-modal").classList.remove("hidden");
}

export function closeConfirmToolModal() {
  state.pendingToolAction = null;
  $("confirm-tool-modal").classList.add("hidden");
}

export function openServerModal() {
  $("server-url-input").value = state.apiUrl;
  $("server-modal").classList.remove("hidden");
}

export function closeServerModal() {
  $("server-modal").classList.add("hidden");
}
