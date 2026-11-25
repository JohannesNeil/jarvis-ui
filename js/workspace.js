import { state } from "./state.js";
import { escapeHtml } from "./markdown.js";
import { $, copyToClipboard } from "./ui.js";
import { scheduleCloudSync } from "./sync.js";

export function updateCounts() {
  const sOpen = state.schedule.filter((s) => !s.done).length;
  const tOpen = state.todos.filter((t) => !t.done).length;
  const n = state.notes.length;
  const v = state.vault.length;
  $("nav-sched-count").textContent = sOpen;
  $("nav-todo-count").textContent = tOpen;
  $("nav-notes-count").textContent = n;
  $("nav-vault-count").textContent = v;
  $("hub-total-count").textContent = sOpen + tOpen + n + v;
}

export function renderSchedule() {
  const list = $("sched-list");
  list.innerHTML = "";
  if (!state.schedule.length) {
    list.innerHTML = `<div class="empty-hint">No classes or deadlines added yet.</div>`;
    return;
  }
  state.schedule.forEach((item) => {
    const badgeLabel = item.category || item.tag || "Class";
    const timeLabel = item.date ? `${item.date} • ${item.time}` : item.time;
    const isDone = Boolean(item.done);
    const card = document.createElement("div");
    card.className = "hub-card";
    card.innerHTML =
      `<div class="hub-card-top">` +
        `<div class="todo-row" style="flex: 1; min-width: 0;">` +
          `<input class="todo-check" type="checkbox" ${isDone ? "checked" : ""} />` +
          `<span class="hub-card-title todo-text ${isDone ? "done" : ""}">${escapeHtml(item.title)}</span>` +
        `</div>` +
        `<span class="badge ${badgeLabel === "Exam" ? "danger" : badgeLabel === "Deadline" ? "amber" : ""}">${escapeHtml(badgeLabel)}</span>` +
      `</div>` +
      `<div class="kv-row"><span>${escapeHtml(timeLabel)}</span><button class="mini-del" type="button">&times;</button></div>`;
    card.querySelector(".todo-check").addEventListener("change", (e) => {
      item.done = e.target.checked;
      scheduleCloudSync();
      renderSchedule();
    });
    card.querySelector(".mini-del").addEventListener("click", () => {
      state.schedule = state.schedule.filter((x) => x.id !== item.id);
      scheduleCloudSync();
      renderSchedule();
    });
    list.appendChild(card);
  });
}

export function renderTodos() {
  const list = $("todo-list");
  list.innerHTML = "";
  const total = state.todos.length;
  const done = state.todos.filter((t) => t.done).length;
  $("todo-progress-label").textContent = `${done}/${total}`;
  $("todo-progress-fill").style.width = total ? `${Math.round((done / total) * 100)}%` : "0%";

  if (!total) {
    list.innerHTML = `<div class="empty-hint">No action items yet.</div>`;
    return;
  }

  state.todos.forEach((item) => {
    const prio = (item.priority || "medium").toLowerCase();
    const card = document.createElement("div");
    card.className = "hub-card";
    card.innerHTML =
      `<div class="todo-row">` +
        `<input class="todo-check" type="checkbox" ${item.done ? "checked" : ""} />` +
        `<span class="todo-text ${item.done ? "done" : ""}">${escapeHtml(item.text)}</span>` +
        `<span class="badge ${prio === "high" ? "amber" : ""}">${escapeHtml(prio)}</span>` +
        `<button class="mini-del" type="button">&times;</button>` +
      `</div>`;
    card.querySelector(".todo-check").addEventListener("change", (e) => {
      item.done = e.target.checked;
      scheduleCloudSync();
      renderTodos();
    });
    card.querySelector(".mini-del").addEventListener("click", () => {
      state.todos = state.todos.filter((x) => x.id !== item.id);
      scheduleCloudSync();
      renderTodos();
    });
    list.appendChild(card);
  });
}

export function renderNotes() {
  const list = $("notes-list");
  list.innerHTML = "";
  if (!state.notes.length) {
    list.innerHTML = `<div class="empty-hint">Save AI replies or jot down study notes here.</div>`;
    return;
  }
  state.notes.forEach((note) => {
    const noteText = note.content || note.body || "";
    const card = document.createElement("div");
    card.className = "hub-card";
    card.innerHTML =
      `<div class="hub-card-top"><div class="hub-card-title">${escapeHtml(note.title)}</div></div>` +
      `<div class="hub-card-sub">${escapeHtml(noteText)}</div>` +
      `<div class="mini-actions">` +
        `<button class="mini-btn copy-note-btn" type="button">Copy</button>` +
        `<button class="mini-del" type="button">&times;</button>` +
      `</div>`;
    card.querySelector(".copy-note-btn").addEventListener("click", (e) => {
      copyToClipboard(`${note.title}\n\n${noteText}`, e.target, "Copy");
    });
    card.querySelector(".mini-del").addEventListener("click", () => {
      state.notes = state.notes.filter((x) => x.id !== note.id);
      scheduleCloudSync();
      renderNotes();
    });
    list.appendChild(card);
  });
}

export function renderVault() {
  const list = $("vault-list");
  list.innerHTML = "";
  if (!state.vault.length) {
    list.innerHTML = `<div class="empty-hint">Upload engineering PDFs, PPTX decks, or source files so J.A.R.V.I.S. can reference them in answers.</div>`;
    return;
  }
  state.vault.forEach((doc) => {
    const card = document.createElement("div");
    card.className = "hub-card";
    card.innerHTML =
      `<div class="hub-card-top">` +
        `<div class="hub-card-title">${escapeHtml(doc.name)}</div>` +
        `<span class="badge">Indexed</span>` +
      `</div>` +
      `<div class="kv-row"><span>${doc.content.length.toLocaleString()} chars</span><button class="mini-del" type="button">&times;</button></div>`;
    card.querySelector(".mini-del").addEventListener("click", () => {
      state.vault = state.vault.filter((x) => x.id !== doc.id);
      scheduleCloudSync();
      renderVault();
    });
    list.appendChild(card);
  });
}
