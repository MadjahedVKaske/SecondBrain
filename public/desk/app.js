const API = "/api/desk";
const STATUS = {
  todo: "к выполнению",
  doing: "в работе",
  waiting_reply: "ждём ответа",
  on_test: "на тесте",
  paused: "отложено",
  done: "сделано"
};
const PSTATUS = {
  idea: "идея",
  backlog: "бэклог",
  doing: "в работе",
  waiting: "ждём",
  done: "готово"
};
let STATE = null;
let CAL = null;
let drawerBackStack = [];
let drawerTaskId = "";
let AREA_FILTER = localStorage.getItem("desk_area") || "все";
let CLIENT_FILTER = localStorage.getItem("desk_client") || "";
let PROJECT_FILTER = localStorage.getItem("desk_project") || "";
let SHOW_DONE = localStorage.getItem("desk_show_done") !== "0";
let DIGEST_MODE = localStorage.getItem("desk_digest_mode") || "morning";

const AREA_COLOR = {
  работа: "#3d8fd1",
  личное: "#6fbf73",
  проект: "#c07a4a",
  бюро: "#9b7ed9",
  инфра: "#9b7ed9"
};

function areaColor(a) {
  return AREA_COLOR[(a || "").trim()] || "#c9a227";
}

function areaKey(a) {
  return (a || "").trim() || "работа";
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

function pill(text, cls) {
  if (!text) return "";
  return `<span class="pill ${cls || ""}">${esc(text)}</span>`;
}

async function api(path, body, method) {
  const opt = { headers: {}, credentials: "same-origin" };
  if (method === "DELETE") {
    opt.method = "DELETE";
  } else if (body !== undefined) {
    opt.method = "POST";
    opt.headers["Content-Type"] = "application/json";
    opt.body = JSON.stringify(body);
  }
  if (opt.method === "POST" || opt.method === "DELETE") {
    const csrf = document.cookie.split("; ").find(x => x.startsWith("desk_csrf="))?.split("=")[1] || "";
    opt.headers["X-Desk-CSRF"] = decodeURIComponent(csrf);
  }
  const r = await fetch(`${API}/${path}`, opt);
  return r.json();
}

function toast(msg) {
  let el = document.getElementById("toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast";
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add("on");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove("on"), 3000);
}

function areaCssName(a) {
  return "area-" + areaKey(a);
}

function autogrow(el, opts) {
  if (!el) return;
  opts = opts || {};
  const cs = getComputedStyle(el);
  const line = parseFloat(cs.lineHeight) || 20;
  const minLines = opts.minLines ?? 1;
  const maxLines = opts.maxLines ?? null;
  const minH = opts.minPx ?? minLines * line;
  const maxH = opts.maxPx ?? (maxLines ? maxLines * line + 4 : null);
  el.style.height = "auto";
  let h = Math.max(minH, el.scrollHeight);
  if (maxH) h = Math.min(h, maxH);
  el.style.height = h + "px";
  el.style.overflowY = maxH && el.scrollHeight > maxH ? "auto" : "hidden";
}

function bindAutogrow(root) {
  (root || document).querySelectorAll("textarea.autogrow").forEach(ta => {
    const opts = ta.id === "d-notes"
      ? { minLines: 1, maxLines: 15 }
      : ta.classList.contains("cl-text")
        ? { minLines: 1, maxLines: 8 }
        : { minLines: 2, maxLines: 15 };
    const grow = () => autogrow(ta, opts);
    grow();
    ta.addEventListener("input", grow);
  });
}

function drawerPickTask(anchorEl, excludeId, onPick) {
  document.querySelectorAll(".drawer-pick").forEach(x => x.remove());
  const box = document.createElement("div");
  box.className = "drawer-pick";
  box.innerHTML = `
    <input type="text" class="drawer-pick-q" placeholder="поиск задачи" autocomplete="off"/>
    <div class="drawer-pick-list"></div>
    <button type="button" class="ghost drawer-pick-cancel">отмена</button>`;
  anchorEl.after(box);
  const q = box.querySelector(".drawer-pick-q");
  const list = box.querySelector(".drawer-pick-list");
  const render = () => {
    const items = taskSearchOptions(excludeId, q.value);
    list.innerHTML = items.length
      ? items.map(t =>
        `<button type="button" class="drawer-pick-item" data-id="${esc(t.id)}">${esc(t.title)}</button>`
      ).join("")
      : `<div class="empty">не найдено</div>`;
  };
  render();
  q.addEventListener("input", render);
  q.focus();
  list.addEventListener("click", (e) => {
    const btn = e.target.closest(".drawer-pick-item");
    if (!btn) return;
    const tid = btn.dataset.id;
    box.remove();
    onPick(tid);
  });
  box.querySelector(".drawer-pick-cancel").onclick = () => box.remove();
}

function subtasksOf(parentId) {
  return (STATE.tasks || []).filter(x => x.parent_task_id === parentId);
}

function checklistStats(lists) {
  let done = 0, total = 0;
  (lists || []).forEach(cl => {
    (cl.items || []).forEach(it => {
      total += 1;
      if (it.done) done += 1;
    });
  });
  return { done, total };
}

function linkCount(lk) {
  if (!lk) return 0;
  return (lk.blocks_out || []).length + (lk.blocked_by || []).length
    + (lk.spawned_from || []).length + (lk.spawned_to || []).length
    + (lk.next || []).length + (lk.prev || []).length + (lk.related || []).length;
}

function applyStateFromServer(data) {
  if (!data || !data.ok) return;
  if (data.tasks) STATE.tasks = data.tasks;
  if (data.comments) STATE.comments = data.comments;
  if (data.works) STATE.works = data.works;
  if (data.projects) STATE.projects = data.projects;
}

async function syncTaskFromServer(id) {
  const data = await api("state");
  if (!data.ok) return null;
  applyStateFromServer(data);
  return (STATE.tasks || []).find(x => x.id === id) || null;
}

function saveDrawerSections() {
  const open = new Set(["desc"]);
  document.querySelectorAll("#drawer details.section[data-sec]").forEach(d => {
    if (d.open) open.add(d.dataset.sec);
  });
  return open;
}

function restoreDrawerSections(open) {
  document.querySelectorAll("#drawer details.section[data-sec]").forEach(d => {
    d.open = open.has(d.dataset.sec);
  });
  const desc = document.querySelector('#drawer details.section[data-sec="desc"]');
  if (desc) desc.open = true;
}

async function refreshDrawer(id, openSecs) {
  const secs = openSecs || saveDrawerSections();
  await syncTaskFromServer(id);
  openTask(id, { sections: secs });
}

function page() {
  closeDrawer();
  const h = (location.hash || "#tasks").replace("#", "");
  document.querySelectorAll("nav.tabs a").forEach(a => a.classList.toggle("on", a.getAttribute("href") === "#" + h));
  document.querySelectorAll(".page").forEach(p => p.classList.toggle("on", p.id === "p-" + h));
  if (h === "calendar" && CAL) CAL.updateSize();
  if (h === "digest") renderDigest();
}

async function renderDigest(mode) {
  if (mode) DIGEST_MODE = mode;
  localStorage.setItem("desk_digest_mode", DIGEST_MODE);
  const text = document.getElementById("digest-text");
  const stats = document.getElementById("digest-stats");
  if (!text || !stats) return;
  text.textContent = "загрузка…";
  try {
    const data = await api(`digest?mode=${encodeURIComponent(DIGEST_MODE)}`);
    if (!data || !data.ok) throw new Error("digest");
    text.textContent = data.text || "пусто";
    const c = data.counts || {};
    const cards = DIGEST_MODE === "morning"
      ? [["просрочено", c.overdue], ["на сегодня", c.today], ["в календаре", c.events_today], ["зависло", c.stale]]
      : [["done обновлено", c.done_today], ["часов", c.hours_today], ["открытых задач", c.open], ["во входящих", c.inbox]];
    stats.innerHTML = cards.map(([label, value]) => `<div><b>${esc(value)}</b><span>${esc(label)}</span></div>`).join("");
    document.getElementById("digest-morning").classList.toggle("ghost", DIGEST_MODE !== "morning");
    document.getElementById("digest-evening").classList.toggle("ghost", DIGEST_MODE !== "evening");
  } catch (err) {
    text.textContent = "Дайджест не загрузился";
    stats.innerHTML = "";
  }
}

function fmtWhen(s) {
  if (!s) return "";
  const raw = String(s);
  const iso = /Z|[+-]\d{2}:\d{2}$/.test(raw) ? raw : raw.replace(" ", "T") + (raw.includes("T") || raw.includes(" ") ? "Z" : "");
  const d = new Date(iso);
  if (isNaN(d.getTime())) return raw.replace("T", " ").replace("Z", "");
  const parts = new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Europe/Moscow",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false
  }).formatToParts(d);
  const g = t => (parts.find(x => x.type === t) || {}).value || "";
  return `${g("year")}-${g("month")}-${g("day")} ${g("hour")}:${g("minute")}`;
}

function commentsFor(id) {
  return (STATE.comments || []).filter(c => c.task_id === id);
}

function worksFor(id) {
  return (STATE.works || []).filter(w => w.task_id === id);
}

function actualHoursForTask(id) {
  return worksFor(id).reduce((sum, work) => sum + Number(work.hours || 0), 0);
}

function estimateSuggestion(task) {
  const ownDirections = taskDirectionIds(task);
  const candidates = (STATE.tasks || []).filter(peer => peer.id !== task.id && actualHoursForTask(peer.id) > 0);
  const groups = [
    {
      basis: "по направлению",
      rows: candidates.filter(peer => ownDirections.some(id => taskDirectionIds(peer).includes(id)))
    },
    {
      basis: "по клиенту",
      rows: task.client_id ? candidates.filter(peer => peer.client_id === task.client_id) : []
    },
    {
      basis: "по категории",
      rows: candidates.filter(peer => areaKey(peer.area) === areaKey(task.area))
    },
    { basis: "по всем работам", rows: candidates }
  ];
  const group = groups.find(item => item.rows.length > 0);
  if (!group) return null;
  const values = group.rows.map(peer => actualHoursForTask(peer.id)).sort((a, b) => a - b);
  const middle = Math.floor(values.length / 2);
  const median = values.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2;
  return {
    hours: Math.max(0.5, Math.round(median * 2) / 2),
    count: values.length,
    basis: group.basis
  };
}

function clientTitle(id) {
  if (!id) return "";
  const c = (STATE.clients || []).find(x => x.id === id);
  return c ? c.title : "";
}

function taskClientName(t) {
  return clientTitle(t.client_id) || t.client || "";
}

function projectTitle(id) {
  if (!id) return "";
  const p = (STATE.projects || []).find(x => x.id === id);
  return p ? p.title : "";
}

// id направлений задачи: directions[] или legacy project_id
function taskDirectionIds(t) {
  if (Array.isArray(t.directions) && t.directions.length) return t.directions.map(String);
  const pid = t.project_id || "";
  return pid ? [pid] : [];
}

function taskHasDirection(t, dirId) {
  return taskDirectionIds(t).includes(String(dirId));
}

function dirName(title, client) {
  const t = (title || "").trim();
  const c = (client || "").trim();
  if (!t) return "";
  if (c && t.toLowerCase().startsWith(c.toLowerCase())) {
    return t.slice(c.length).replace(/^\s*[\/|·:–-]+\s*/, "").trim() || t;
  }
  return t;
}

function pathLabel(client, title) {
  const dir = dirName(title, client);
  if (client && dir) return client + " / " + dir;
  return client || dir || "";
}

function projectPath(p) {
  if (!p) return "";
  return pathLabel(clientTitle(p.client_id), p.title);
}

function prefillTaskForm() {
  const ntC = document.getElementById("nt-client");
  const ntP = document.getElementById("nt-proj");
  if (!ntC || !ntP) return;
  const p = PROJECT_FILTER ? (STATE.projects || []).find(x => x.id === PROJECT_FILTER) : null;
  if (p) {
    if (p.client_id) ntC.value = p.client_id;
    ntP.innerHTML = projectOptions(ntC.value, p.id, true);
    ntP.value = p.id;
    return;
  }
  if (CLIENT_FILTER) {
    ntC.value = CLIENT_FILTER;
    ntP.innerHTML = projectOptions(CLIENT_FILTER, "", true);
    ntP.value = "";
  }
}

function openProject(id) {
  PROJECT_FILTER = id || "";
  if (PROJECT_FILTER) {
    const p = (STATE.projects || []).find(x => x.id === PROJECT_FILTER);
    if (p && p.client_id) CLIENT_FILTER = p.client_id;
  }
  if (location.hash !== "#tasks") location.hash = "#tasks";
  saveDeskFilters();
  renderFilters();
  renderProjectBanner();
  renderTasks();
  prefillTaskForm();
}

function projectsForClient(clientId) {
  const list = STATE.projects || [];
  if (!clientId) {
    return list.filter(p => !p.client_id || p.client_id === "cli-buro");
  }
  return list.filter(p => (p.client_id || "") === clientId);
}

function clientOptions(cur, allowNew) {
  const opts = [`<option value="">клиент</option>`]
    .concat((STATE.clients || []).map(c =>
      `<option value="${esc(c.id)}" ${c.id === cur ? "selected" : ""}>${esc(c.title)}</option>`
    ));
  if (allowNew) opts.push(`<option value="__new__">+ новый клиент</option>`);
  return opts.join("");
}

function liveProjects(list) {
  return (list || STATE.projects || []).filter(p => (p.status || "") !== "done");
}

function projectOptions(clientId, cur, allowNew) {
  const opts = [`<option value="">направление</option>`]
    .concat(liveProjects(projectsForClient(clientId)).map(p =>
      `<option value="${esc(p.id)}" ${p.id === cur ? "selected" : ""}>${esc(dirName(p.title, clientTitle(p.client_id)) || p.title)}</option>`
    ));
  if (allowNew) opts.push(`<option value="__new__">+ новое направление</option>`);
  return opts.join("");
}

async function maybeNewClient(sel, projSel) {
  if (!sel || sel.value !== "__new__") return;
  const name = prompt("Клиент:");
  sel.value = "";
  if (!name || !name.trim()) return;
  const out = await api("clients", { title: name.trim(), source: "desk" });
  if (!out || !out.ok || !out.client) return;
  STATE.clients = STATE.clients || [];
  STATE.clients.push(out.client);
  fillLinkedSelects();
  sel.innerHTML = clientOptions(out.client.id, true);
  sel.value = out.client.id;
  if (projSel) projSel.innerHTML = projectOptions(sel.value, "", true);
}

async function maybeNewProject(sel, clientSel) {
  if (!sel || sel.value !== "__new__") return;
  const name = prompt("Проект:");
  sel.value = "";
  if (!name || !name.trim()) return;
  let cid = clientSel && clientSel.value !== "__new__" ? clientSel.value : "";
  const out = await api("projects", {
    title: name.trim(),
    status: "doing",
    area: cid && cid !== "cli-buro" ? "работа" : "бюро",
    client_id: cid || "cli-buro",
    notes: ""
  });
  if (!out || !out.ok || !out.project) return;
  STATE.projects = STATE.projects || [];
  STATE.projects.push(out.project);
  fillLinkedSelects();
  if (clientSel && out.project.client_id) clientSel.value = out.project.client_id;
  sel.innerHTML = projectOptions(clientSel ? clientSel.value : "", out.project.id, true);
  sel.value = out.project.id;
}

function bindClientProject(clientSel, projSel) {
  if (!clientSel || !projSel) return;
  clientSel.addEventListener("change", async () => {
    await maybeNewClient(clientSel, projSel);
    const keep = projSel.value;
    projSel.innerHTML = projectOptions(clientSel.value, keep, true);
    if (![...projSel.options].some(o => o.value === keep)) projSel.value = "";
  });
  projSel.addEventListener("change", async () => {
    await maybeNewProject(projSel, clientSel);
    const p = (STATE.projects || []).find(x => x.id === projSel.value);
    if (p && p.client_id && !clientSel.value) {
      clientSel.value = p.client_id;
    }
  });
}

function fillLinkedSelects() {
  const ntC = document.getElementById("nt-client");
  const ntP = document.getElementById("nt-proj");
  const npC = document.getElementById("np-client");
  const niC = document.getElementById("ni-client");
  if (ntC) {
    const cur = ntC.value;
    ntC.innerHTML = clientOptions(cur, true);
  }
  if (ntP) {
    const cur = ntP.value;
    ntP.innerHTML = projectOptions(ntC ? ntC.value : "", cur, true);
  }
  if (npC) {
    const cur = npC.value;
    npC.innerHTML = clientOptions(cur, true);
  }
  if (niC) {
    const cur = niC.value;
    niC.innerHTML = clientOptions(cur, true);
  }
}

function taskById(id) {
  return (STATE.tasks || []).find(x => x.id === id) || null;
}

function blockerOf(t) {
  return t && t.blocked_by ? taskById(t.blocked_by) : null;
}

function isBlocked(t) {
  const b = blockerOf(t);
  return !!(b && b.status !== "done");
}

function blockOptions(curId, selected) {
  const open = (STATE.tasks || []).filter(x => x.id !== curId && x.status !== "done");
  const opts = [`<option value="">не ждёт задачу</option>`];
  open.forEach(x => {
    opts.push(`<option value="${esc(x.id)}" ${x.id === selected ? "selected" : ""}>${esc(x.title)}</option>`);
  });
  if (selected && !open.some(x => x.id === selected)) {
    const t = taskById(selected);
    if (t) opts.push(`<option value="${esc(t.id)}" selected>${esc(t.title)} (готово)</option>`);
  }
  return opts.join("");
}

const RU_MON_SHORT = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];

function taskDueShort(due) {
  const d = (due || "").slice(0, 10);
  if (!d) return "";
  const parts = d.split("-").map(Number);
  const day = parts[2];
  const mon = parts[1];
  if (!day || !mon) return "";
  return `${day} ${RU_MON_SHORT[mon - 1] || ""}`;
}

function taskSubtaskStats(parentId) {
  const kids = (STATE.tasks || []).filter(x => x.parent_task_id === parentId);
  if (!kids.length) return null;
  const done = kids.filter(x => x.status === "done").length;
  return { done, total: kids.length };
}

function taskHtml(t, today) {
  const done = t.status === "done";
  const area = areaKey(t.area);
  const client = taskClientName(t);
  const proj = projectTitle(taskDirectionIds(t)[0] || "");
  const path = pathLabel(client, proj);
  const dueLine = taskDueShort(t.due);
  const subs = taskSubtaskStats(t.id);
  const cl = checklistStats(t.checklists);
  const lkN = linkCount(t.links);
  const pathLine = path ? `<div class="task-path">${esc(path)}</div>` : "";
  const meta = [];
  if (dueLine) meta.push(`<span class="task-due">${esc(dueLine)}</span>`);
  if (subs) meta.push(`<span class="task-meta-chip" title="подзадачи">↳ ${subs.done}/${subs.total}</span>`);
  if (cl.total) meta.push(`<span class="task-meta-chip" title="чек-лист">☑ ${cl.done}/${cl.total}</span>`);
  if (lkN) meta.push(`<span class="task-meta-chip" title="связи">🔗 ${lkN}</span>`);
  const metaHtml = meta.length ? `<div class="task-meta">${meta.join("")}</div>` : "";
  return `<div class="task ${done ? "done" : ""} area-${esc(area)}" data-id="${esc(t.id)}">
    <input type="checkbox" ${done ? "checked" : ""} onclick="event.stopPropagation()"/>
    <div class="task-body">
      <div class="task-row-title">
        <div class="title">${esc(t.title)}</div>
      </div>
      ${pathLine}${metaHtml}
    </div>
  </div>`;
}

function areas() {
  const set = new Set(["работа", "личное", "проект"]);
  (STATE.tasks || []).forEach(t => {
    const a = (t.area || "").trim();
    if (a) set.add(a);
  });
  return ["все", ...Array.from(set)];
}

function saveDeskFilters() {
  localStorage.setItem("desk_area", AREA_FILTER);
  localStorage.setItem("desk_client", CLIENT_FILTER);
  localStorage.setItem("desk_project", PROJECT_FILTER);
  localStorage.setItem("desk_show_done", SHOW_DONE ? "1" : "0");
}

function restoreDeskFilters() {
  if (!STATE) return;
  const cid = localStorage.getItem("desk_client") || "";
  const pid = localStorage.getItem("desk_project") || "";
  CLIENT_FILTER = (STATE.clients || []).some(c => c.id === cid) ? cid : "";
  PROJECT_FILTER = (STATE.projects || []).some(p => p.id === pid) ? pid : "";
  if (PROJECT_FILTER) {
    const p = (STATE.projects || []).find(x => x.id === PROJECT_FILTER);
    if (p && p.client_id && (!CLIENT_FILTER || CLIENT_FILTER === p.client_id)) {
      CLIENT_FILTER = p.client_id;
    }
  }
  SHOW_DONE = localStorage.getItem("desk_show_done") !== "0";
}

function taskMatchesClient(t, clientId) {
  if (!clientId) return true;
  if ((t.client_id || "") === clientId) return true;
  return taskDirectionIds(t).some(pid => {
    const p = (STATE.projects || []).find(x => x.id === pid);
    return p && (p.client_id || "") === clientId;
  });
}

function applyTaskFilters(list) {
  let out = byArea(list);
  if (CLIENT_FILTER) out = out.filter(t => taskMatchesClient(t, CLIENT_FILTER));
  if (PROJECT_FILTER) out = out.filter(t => taskHasDirection(t, PROJECT_FILTER));
  return out;
}

function filtersActive() {
  return AREA_FILTER !== "все" || !!CLIENT_FILTER || !!PROJECT_FILTER;
}

function taskFilterCounts() {
  const all = STATE.tasks || [];
  const open = applyTaskFilters(all.filter(t => t.status !== "done"));
  const done = applyTaskFilters(all.filter(t => t.status === "done"));
  return { open: open.length, done: done.length };
}

function projectsForFilter() {
  return CLIENT_FILTER
    ? liveProjects(projectsForClient(CLIENT_FILTER))
    : liveProjects();
}

function byArea(list) {
  if (AREA_FILTER === "все") return list;
  return list.filter(t => (t.area || "").trim() === AREA_FILTER);
}

function clearAllFilters() {
  AREA_FILTER = "все";
  CLIENT_FILTER = "";
  PROJECT_FILTER = "";
  saveDeskFilters();
  renderClientContext();
  renderClientMode();
  renderFilters();
  renderProjectBanner();
  renderTasks();
  renderProjects();
  try { renderCal(); } catch (err) { console.warn("cal", err); }
}

function clearProjectFilter() {
  PROJECT_FILTER = "";
  saveDeskFilters();
  renderFilters();
  renderProjectBanner();
  renderTasks();
}

function openClient(id) {
  setClientContext(id, "tasks");
}

function setClientContext(id, targetPage) {
  CLIENT_FILTER = id || "";
  if (CLIENT_FILTER && PROJECT_FILTER) {
    const p = (STATE.projects || []).find(x => x.id === PROJECT_FILTER);
    if (p && p.client_id && p.client_id !== CLIENT_FILTER) PROJECT_FILTER = "";
  }
  saveDeskFilters();
  renderClientContext();
  renderClientMode();
  renderFilters();
  renderProjectBanner();
  renderTasks();
  renderProjects();
  try { renderCal(); } catch (err) { console.warn("cal", err); }
  prefillTaskForm();
  if (targetPage && location.hash !== "#" + targetPage) location.hash = "#" + targetPage;
}

function renderClientContext() {
  const el = document.getElementById("client-context");
  if (!el) return;
  if (!CLIENT_FILTER) {
    el.hidden = true;
    el.innerHTML = "";
    return;
  }
  el.hidden = false;
  el.innerHTML = `<span>Режим клиента: <b>${esc(clientTitle(CLIENT_FILTER) || "клиент")}</b></span>
    <button type="button" class="ghost" id="client-context-clear">Общий режим</button>`;
  document.getElementById("client-context-clear").onclick = () => setClientContext("", location.hash.replace("#", "") || "tasks");
}

function renderClientMode() {
  const box = document.getElementById("client-mode");
  const select = document.getElementById("client-mode-select");
  if (!box || !select || !STATE) return;
  const current = CLIENT_FILTER;
  select.innerHTML = `<option value="">выберите клиента</option>` + (STATE.clients || []).map(c =>
    `<option value="${esc(c.id)}" ${c.id === current ? "selected" : ""}>${esc(c.title)}</option>`
  ).join("");
  document.querySelectorAll(".client-mode-actions button").forEach(btn => { btn.disabled = !current; });
  if (!current) {
    box.innerHTML = `<div class="empty">Выбери клиента — здесь будут его задачи, календарь и проекты.</div>`;
    return;
  }

  const tasks = (STATE.tasks || []).filter(t => t.status !== "done" && taskMatchesClient(t, current));
  const done = (STATE.tasks || []).filter(t => t.status === "done" && taskMatchesClient(t, current));
  const projects = (STATE.projects || []).filter(p => (p.client_id || "") === current && p.status !== "done");
  const scheduled = tasks.filter(t => t.due).sort((a, b) => String(a.due).localeCompare(String(b.due)));
  const taskRows = tasks.slice(0, 30).map(t => `<button type="button" class="client-item client-task" data-id="${esc(t.id)}">${esc(t.title)}<small>${esc([STATUS[t.status] || t.status, t.due || ""].filter(Boolean).join(" · "))}</small></button>`).join("");
  const calRows = scheduled.slice(0, 30).map(t => `<button type="button" class="client-item client-task" data-id="${esc(t.id)}">${esc(t.due)} · ${esc(t.title)}<small>${esc(STATUS[t.status] || t.status)}</small></button>`).join("");
  const projectRows = projects.map(p => `<button type="button" class="client-item client-project" data-id="${esc(p.id)}">${esc(p.title)}<small>${esc(PSTATUS[p.status] || p.status)}</small></button>`).join("");
  box.innerHTML = `
    <div class="client-stats">
      <div class="client-stat"><b>${tasks.length}</b><span class="sub">открытых задач</span></div>
      <div class="client-stat"><b>${scheduled.length}</b><span class="sub">с датой</span></div>
      <div class="client-stat"><b>${projects.length}</b><span class="sub">проектов</span></div>
      <div class="client-stat"><b>${done.length}</b><span class="sub">выполнено</span></div>
    </div>
    <div class="client-mode-grid">
      <section class="col"><h2>Задачи</h2>${taskRows || '<div class="empty">открытых задач нет</div>'}</section>
      <section class="col"><h2>Календарь задач</h2>${calRows || '<div class="empty">задач с датой нет</div>'}</section>
      <section class="col"><h2>Проекты</h2>${projectRows || '<div class="empty">открытых проектов нет</div>'}</section>
    </div>`;
  box.querySelectorAll(".client-task").forEach(el => { el.onclick = () => openTask(el.dataset.id, { clearStack: true }); });
  box.querySelectorAll(".client-project").forEach(el => { el.onclick = () => openProjectDetail(el.dataset.id); });
}

function renderProjectBanner() {
  const el = document.getElementById("project-banner");
  if (!el) return;
  if (!PROJECT_FILTER && !CLIENT_FILTER) {
    el.hidden = true;
    el.innerHTML = "";
    return;
  }
  let title = "";
  let n = 0;
  if (PROJECT_FILTER) {
    const p = (STATE.projects || []).find(x => x.id === PROJECT_FILTER);
    title = projectPath(p) || projectTitle(PROJECT_FILTER) || "направление";
    n = applyTaskFilters((STATE.tasks || []).filter(t => t.status !== "done")).length;
    const notes = (p && p.notes) || "";
    el.hidden = false;
    el.innerHTML = `<div>
      <h2>${esc(title)}</h2>
      <div class="sub">${esc(n ? n + " открытых" : "нет открытых")}</div>
      ${notes ? `<p>${esc(notes)}</p>` : ""}
    </div>
    <div class="row">
      <button type="button" class="ghost" id="pb-card">карточка</button>
      <button type="button" class="ghost" id="pb-clear">сброс фильтра</button>
    </div>`;
    const btn = document.getElementById("pb-clear");
    if (btn) btn.onclick = clearAllFilters;
    const card = document.getElementById("pb-card");
    if (card) card.onclick = () => openProjectDetail(PROJECT_FILTER);
    return;
  }
  title = clientTitle(CLIENT_FILTER) || "клиент";
  n = applyTaskFilters((STATE.tasks || []).filter(t => t.status !== "done")).length;
  el.hidden = false;
  el.innerHTML = `<div>
    <h2>${esc(title)}</h2>
    <div class="sub">${esc(n ? n + " открытых" : "нет открытых")} · все направления</div>
  </div>
  <div class="row">
    <button type="button" class="ghost" id="pb-clear">сброс фильтра</button>
  </div>`;
  const btn = document.getElementById("pb-clear");
  if (btn) btn.onclick = clearAllFilters;
}

function renderFilters() {
  const el = document.getElementById("area-filters");
  if (!el) return;
  const counts = taskFilterCounts();
  const chips = areas().map(a =>
    `<a href="#" data-a="${esc(a)}" class="chip-${esc(a)} ${a === AREA_FILTER ? "on" : ""}">${esc(a)}</a>`
  );
  const clientOpts = [`<option value="">все клиенты</option>`]
    .concat((STATE.clients || []).map(c =>
      `<option value="${esc(c.id)}" ${c.id === CLIENT_FILTER ? "selected" : ""}>${esc(c.title)}</option>`
    )).join("");
  const ctx = `<select id="ctx-client" title="клиент">${clientOpts}</select>
    <select id="ctx-proj" title="направление">
    <option value="">все направления</option>
    ${projectsForFilter().map(p => {
      const label = projectPath(p);
      return `<option value="${esc(p.id)}" ${p.id === PROJECT_FILTER ? "selected" : ""}>${esc(label)}</option>`;
    }).join("")}
  </select>`;
  const reset = filtersActive()
    ? `<button type="button" class="ghost filt-reset" id="filt-reset">сброс</button>`
    : "";
  const doneBtn = `<button type="button" class="ghost filt-done ${SHOW_DONE ? "on" : ""}" id="filt-done" title="показать блок сделанных">сделано</button>`;
  const count = `<span class="filt-count" title="открытые${SHOW_DONE ? " + сделанные" : ""}">${counts.open}${SHOW_DONE && counts.done ? "+" + counts.done : ""}</span>`;
  el.innerHTML = chips.join("") + `<span class="filt-sep"></span>` + ctx + doneBtn + reset + count;
  el.querySelectorAll("a").forEach(a => {
    a.addEventListener("click", (e) => {
      e.preventDefault();
      AREA_FILTER = a.dataset.a;
      saveDeskFilters();
      const sel = document.getElementById("nt-area");
      if (sel && AREA_FILTER !== "все") sel.value = AREA_FILTER;
      renderFilters();
      renderProjectBanner();
      renderTasks();
    });
  });
  const clientEl = document.getElementById("ctx-client");
  if (clientEl) {
    clientEl.addEventListener("change", () => {
      if (clientEl.value) openClient(clientEl.value);
      else {
        setClientContext("", "tasks");
      }
    });
  }
  const ctxEl = document.getElementById("ctx-proj");
  if (ctxEl) {
    ctxEl.addEventListener("change", () => {
      if (ctxEl.value) openProject(ctxEl.value);
      else clearProjectFilter();
    });
  }
  const resetEl = document.getElementById("filt-reset");
  if (resetEl) resetEl.addEventListener("click", clearAllFilters);
  const doneEl = document.getElementById("filt-done");
  if (doneEl) {
    doneEl.addEventListener("click", () => {
      SHOW_DONE = !SHOW_DONE;
      saveDeskFilters();
      renderFilters();
      renderTasks();
    });
  }
}

function groupTasksByDirection(list) {
  const groups = new Map();
  list.forEach(t => {
    const dirs = PROJECT_FILTER ? [PROJECT_FILTER] : taskDirectionIds(t);
    if (!dirs.length) {
      const k = "";
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(t);
      return;
    }
    dirs.forEach(dirId => {
      const k = dirId;
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(t);
    });
  });
  const keys = [...groups.keys()].sort((a, b) => {
    if (!a) return 1;
    if (!b) return -1;
    return projectTitle(a).localeCompare(projectTitle(b), "ru");
  });
  return { keys, groups };
}

function renderTaskGroupsHtml(keys, groups, today) {
  if (!keys.length) return "";
  return keys.map(k => {
    const list = groups.get(k);
    const p = k ? (STATE.projects || []).find(x => x.id === k) : null;
    const title = k ? (projectPath(p) || projectTitle(k) || "направление") : "Без направления";
    const n = list.length;
    const filterBtn = k
      ? `<button type="button" class="ghost group-filter" data-pid="${esc(k)}">фильтр</button>`
      : "";
    return `<details class="group">
      <summary class="group-head">
        <span class="group-title">${esc(title)} (${n})</span>${filterBtn}
      </summary>
      <div class="group-list">${list.map(t => taskHtml(t, today)).join("")}</div>
    </details>`;
  }).join("");
}

function toggleTaskFromList(id) {
  const drawer = document.getElementById("drawer");
  if (drawerTaskId === id && drawer && !drawer.hidden) {
    closeDrawer();
    return;
  }
  openTask(id, { clearStack: true });
}

function wireTaskBoard(board) {
  board.querySelectorAll(".group-filter").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      openProject(btn.dataset.pid || "");
    });
  });
  board.querySelectorAll(".task").forEach(el => {
    el.addEventListener("click", () => toggleTaskFromList(el.dataset.id));
    el.querySelector("input").addEventListener("click", async (e) => {
      e.stopPropagation();
      await api(`tasks/${el.dataset.id}/status`, { status: e.target.checked ? "done" : "todo" });
      await load();
    });
  });
}

function renderTasks() {
  const today = STATE.today;
  const board = document.getElementById("task-board");
  if (!board) return;
  let open = applyTaskFilters((STATE.tasks || []).filter(t => t.status !== "done"));
  let done = SHOW_DONE
    ? applyTaskFilters((STATE.tasks || []).filter(t => t.status === "done"))
    : [];
  const openG = groupTasksByDirection(open);
  const doneG = groupTasksByDirection(done);
  const openHtml = renderTaskGroupsHtml(openG.keys, openG.groups, today);
  const doneHtml = doneG.keys.length
    ? `<details class="group group-done">
        <summary class="group-head"><span class="group-title">Сделано (${done.length})</span></summary>
        <div class="done-board">${renderTaskGroupsHtml(doneG.keys, doneG.groups, today)}</div>
      </details>`
    : "";
  board.innerHTML = (openHtml || `<div class="empty">Нет открытых</div>`) + doneHtml;
  wireTaskBoard(board);
}

function statusSelect(cur) {
  return Object.keys(STATUS).map(s => `<option value="${s}" ${s === cur ? "selected" : ""}>${STATUS[s]}</option>`).join("");
}

function closeDrawer() {
  drawerBackStack = [];
  drawerTaskId = "";
  const el = document.getElementById("drawer");
  if (el) el.hidden = true;
  document.body.classList.remove("drawer-on");
}

function showDrawer() {
  const el = document.getElementById("drawer");
  if (el) el.hidden = false;
  document.body.classList.add("drawer-on");
}

function fld(label, html) {
  return `<label class="fld"><span>${label}</span>${html}</label>`;
}

function toLocalInput(v, allDay) {
  const s = String(v || "");
  if (!s) return "";
  if (allDay) return s.slice(0, 10);
  if (s.length >= 16) return s.slice(0, 16);
  if (s.length === 10) return s + "T09:00";
  return s;
}

function inclusiveEnd(start, end, allDay) {
  if (!end) return "";
  if (!allDay) return toLocalInput(end, false);
  const s = String(start).slice(0, 10);
  const e = String(end).slice(0, 10);
  if (!e || e <= s) return s;
  const d = new Date(e + "T12:00:00");
  d.setDate(d.getDate() - 1);
  return ymd(d);
}

function openCalCreate(info) {
  drawerTaskId = "";
  const allDay = !!info.allDay;
  const start0 = toLocalInput(info.start, allDay);
  const end0 = inclusiveEnd(info.start, info.end, allDay);
  const area0 = (document.getElementById("cal-area") || {}).value || "работа";
  document.getElementById("drawer").innerHTML = `
    <div class="drawer-body">
      <div class="drawer-title-row">
        <h3>Новая запись</h3>
        <button type="button" class="ghost d-close" title="Скрыть" aria-label="Закрыть">×</button>
      </div>
      <div class="form">
        <label class="sub">что это</label>
        <select id="cc-kind">
          <option value="task" selected>задача</option>
          <option value="event">событие</option>
        </select>
        <input id="cc-title" type="text" placeholder="название" />
        <label class="row"><input id="cc-allday" type="checkbox" ${allDay ? "checked" : ""}/> весь день</label>
        <label class="sub">начало</label>
        <input id="cc-start" type="${allDay ? "date" : "datetime-local"}" value="${esc(start0)}"/>
        <label class="sub">конец</label>
        <input id="cc-end" type="${allDay ? "date" : "datetime-local"}" value="${esc(end0)}"/>
        <div id="cc-task-fields">
          <label class="sub">статус</label>
          <select id="cc-status">${statusSelect("todo")}</select>
          <label class="sub">категория</label>
          <select id="cc-area">
            ${["работа","личное","проект"].map(a => `<option ${a === area0 ? "selected" : ""}>${a}</option>`).join("")}
          </select>
          <label class="sub">клиент</label>
          <select id="cc-client">${clientOptions("", true)}</select>
          <label class="sub">проект</label>
          <select id="cc-proj">${projectOptions("", "", true)}</select>
        </div>
        <div id="cc-event-fields" hidden>
          <label class="sub">категория</label>
          <select id="cc-ev-area">
            ${["работа","личное","проект"].map(a => `<option ${a === area0 ? "selected" : ""}>${a}</option>`).join("")}
          </select>
        </div>
        <div class="row">
          <button type="button" id="cc-save">Добавить</button>
        </div>
      </div>
    </div>`;
  showDrawer();
  document.querySelectorAll("#drawer .d-close").forEach(btn => { btn.onclick = closeDrawer; });
  bindClientProject(document.getElementById("cc-client"), document.getElementById("cc-proj"));
  const kindEl = document.getElementById("cc-kind");
  const syncKind = () => {
    const task = kindEl.value === "task";
    document.getElementById("cc-task-fields").hidden = !task;
    document.getElementById("cc-event-fields").hidden = task;
  };
  kindEl.addEventListener("change", syncKind);
  document.getElementById("cc-allday").addEventListener("change", () => {
    const on = document.getElementById("cc-allday").checked;
    ["cc-start", "cc-end"].forEach(id => {
      const el = document.getElementById(id);
      const v = el.value;
      el.type = on ? "date" : "datetime-local";
      el.value = toLocalInput(v, on);
    });
  });
  document.getElementById("cc-title").focus();
  document.getElementById("cc-save").onclick = async () => {
    const title = document.getElementById("cc-title").value.trim();
    if (!title) {
      document.getElementById("cc-title").focus();
      return;
    }
    const allday = document.getElementById("cc-allday").checked;
    let start = document.getElementById("cc-start").value;
    let end = document.getElementById("cc-end").value;
    if (allday) {
      start = start.slice(0, 10);
      end = (end || start).slice(0, 10);
    }
    if (kindEl.value === "event") {
      await api("events", {
        title,
        start,
        end: end || start,
        allDay: allday,
        calendar: document.getElementById("cc-ev-area").value || area0
      });
    } else {
      const cid = document.getElementById("cc-client").value;
      const pid = document.getElementById("cc-proj").value;
      await api("tasks", {
        title,
        due: start,
        due_end: end && end !== start ? end : "",
        all_day: allday,
        status: document.getElementById("cc-status").value,
        area: document.getElementById("cc-area").value || area0,
        client_id: cid === "__new__" ? "" : cid,
        project_id: pid === "__new__" ? "" : pid
      });
    }
    closeDrawer();
    await load();
  };
}

function renderDirectionChips(t) {
  const dirs = taskDirectionIds(t);
  if (!dirs.length) return `<span class="muted">нет направлений</span>`;
  return dirs.map(did => {
    const p = (STATE.projects || []).find(x => x.id === did);
    const label = p ? (dirName(p.title, clientTitle(p.client_id)) || p.title) : did;
    return `<button type="button" class="dir-chip" data-dir="${esc(did)}" title="убрать">${esc(label)} ×</button>`;
  }).join("");
}

function renderSubtaskCards(parentId) {
  const kids = subtasksOf(parentId);
  if (!kids.length) return "";
  return kids.map(st => {
    const done = st.status === "done";
    return `<div class="sub-card" data-id="${esc(st.id)}">
      <input type="checkbox" class="sub-chk" ${done ? "checked" : ""}/>
      <span class="sub-title ${done ? "done" : ""}">${esc(st.title)}</span>
      <button type="button" class="ghost sub-unlink" title="отвязать">×</button>
    </div>`;
  }).join("");
}

function renderChecklistsBlock(lists) {
  if (!lists || !lists.length) return "";
  return lists.map(cl => {
    const items = (cl.items || []).map(it => `
      <div class="cl-item" data-id="${esc(it.id)}">
        <input type="checkbox" class="cl-chk" ${it.done ? "checked" : ""}/>
        <textarea class="cl-text autogrow ${it.done ? "done" : ""}" rows="1">${esc(it.text)}</textarea>
        <button type="button" class="ghost cl-del" title="удалить">×</button>
      </div>`).join("");
    return `<div class="cl-block" data-id="${esc(cl.id)}">
      <div class="cl-head row">
        <input type="text" class="cl-title" value="${esc(cl.title || "Список")}"/>
        <button type="button" class="ghost cl-rm" title="удалить список">×</button>
      </div>
      <div class="cl-items">${items}</div>
      <input type="text" class="cl-add-input" placeholder="новый пункт, Enter" autocomplete="off"/>
    </div>`;
  }).join("");
}

function renderLinkSubsections(t) {
  const lk = t.links || {};
  const parts = [];
  const addSec = (title, rows, taskKey) => {
    if (!rows || !rows.length) return;
    const list = rows.map(r => {
      const tid = r[taskKey] || r.task_id || r.to || r.from || "";
      const lid = r.id || "";
      return `<div class="link-item" data-link-id="${esc(lid)}">
        <button type="button" class="link-row" data-id="${esc(tid)}">${esc(r.title || taskById(tid)?.title || tid)}</button>
        <button type="button" class="ghost link-del" title="убрать связь">×</button>
      </div>`;
    }).join("");
    parts.push(`<div class="link-sec"><div class="link-sec-title">${esc(title)}</div>${list}</div>`);
  };
  addSec("Ждёт вот эти задачи", lk.blocked_by, "from");
  addSec("Блокирует вот эти", lk.blocks_out, "to");
  addSec("Родилась из", lk.spawned_from, "from");
  addSec("Породила", lk.spawned_to, "to");
  addSec("После идут", lk.next, "to");
  addSec("Идёт после", lk.prev, "from");
  addSec("Связано", lk.related, "task_id");
  return parts.join("");
}

function taskSearchOptions(curId, q) {
  const qq = (q || "").trim().toLowerCase();
  return (STATE.tasks || []).filter(x => {
    if (x.id === curId) return false;
    if (!qq) return true;
    return String(x.title || "").toLowerCase().includes(qq);
  }).slice(0, 40);
}

function openTask(id, opts) {
  opts = opts || {};
  if (opts.clearStack) drawerBackStack = [];
  if (opts.back) drawerBackStack.push(opts.back);
  const t = (STATE.tasks || []).find(x => x.id === id);
  if (!t) return;
  const area = areaKey(t.area);
  const parentId = t.parent_task_id || "";
  const parent = parentId ? taskById(parentId) : null;
  const subs = subtasksOf(id);
  const subDone = subs.filter(x => x.status === "done").length;
  const clStats = checklistStats(t.checklists);
  const lkN = linkCount(t.links);
  const comm = commentsFor(id);
  const works = worksFor(id);
  const hours = works.reduce((s, w) => s + Number(w.hours || 0), 0);
  const estimate = t.estimate_hours == null ? "" : Number(t.estimate_hours);
  const suggestion = estimateSuggestion(t);
  const workRows = works.map(w => `
    <div class="works-row" data-id="${esc(w.id)}">
      <span>${esc(w.date)} · ${esc(w.hours)} ч${w.note ? " · " + esc(w.note) : ""}</span>
      <button class="ghost wdel" type="button">×</button>
    </div>`).join("") || `<div class="empty">работ нет</div>`;
  const commHtml = comm.map(c =>
    `<div class="comment">${esc(c.text)}<time>${esc(fmtWhen(c.created_at))}</time></div>`
  ).join("") || `<div class="empty">Комментов нет</div>`;
  const subPct = subs.length ? Math.round(100 * subDone / subs.length) : 0;
  const backId = drawerBackStack.length ? drawerBackStack[drawerBackStack.length - 1] : "";
  const backTask = backId ? taskById(backId) : null;

  document.getElementById("drawer").innerHTML = `
    <div class="drawer-body task-drawer">
      ${backId ? `<button type="button" class="ghost td-back d-back" title="${esc(backTask ? backTask.title : "назад")}">← ${esc(backTask ? (backTask.title.length > 36 ? backTask.title.slice(0, 36) + "…" : backTask.title) : "назад")}</button>` : ""}
      <div class="td-header">
        <div class="td-title-row">
          <input id="d-title" class="td-title" type="text" value="${esc(t.title)}"/>
          <button type="button" class="ghost d-close" title="Скрыть" aria-label="Закрыть">×</button>
        </div>
        <select id="d-area" class="td-area-pill ${areaCssName(area)}">
          ${["работа", "личное", "проект"].map(a =>
            `<option value="${a}" ${area === a ? "selected" : ""}>${a}</option>`).join("")}
        </select>
        <div class="td-meta row">
          ${fld("", `<select id="d-status">${statusSelect(t.status)}</select>`)}
          ${fld("", `<input id="d-due" type="date" value="${esc((t.due || "").slice(0, 10))}"/>`)}
          ${fld("", `<select id="d-client">${clientOptions(t.client_id || "", true)}</select>`)}
        </div>
        ${parent ? `<button type="button" class="td-parent" data-id="${esc(parentId)}">↑ Родитель: ${esc(parent.title)}</button>` : ""}
        <div class="td-actions row">
          <button type="button" id="d-done" class="ghost">${t.status === "done" ? "Вернуть" : "Готово"}</button>
          <button type="button" id="d-pause" class="ghost">Отложить</button>
          <button type="button" class="ghost" id="d-del">Удалить</button>
        </div>
      </div>

      <div class="td-directions">
        <div class="sec-label">Направления</div>
        <div class="dir-chips" id="d-dirs">${renderDirectionChips(t)}</div>
        <button type="button" class="ghost" id="d-dir-add">+ направление</button>
      </div>

      <details class="section" data-sec="desc" open>
        <summary>Описание</summary>
        <textarea id="d-notes" class="autogrow notes-field" placeholder="описание задачи">${esc(t.notes || "")}</textarea>
      </details>

      <details class="section" data-sec="subtasks">
        <summary>
          <span class="sec-label">Подзадачи <span class="sec-count">${subDone}/${subs.length}</span></span>
          <span class="sec-bar"><i style="width:${subPct}%"></i></span>
          <button type="button" class="sec-add" id="d-sub-add" title="добавить подзадачу" aria-label="добавить подзадачу">+</button>
        </summary>
        <div id="d-sub-list" class="sec-list">${renderSubtaskCards(id)}</div>
        <div id="d-sub-panel" class="sec-add-panel" hidden>
          <input type="text" class="sub-add-input" id="d-sub-new-input" placeholder="новая подзадача, Enter" autocomplete="off"/>
          <div class="sec-add-or">или привязать</div>
          <input type="text" id="d-sub-link-q" placeholder="поиск задачи" autocomplete="off"/>
          <div id="d-sub-pick-list" class="drawer-pick-list"></div>
        </div>
      </details>

      <details class="section" data-sec="checklists">
        <summary>
          <span class="sec-label">Чек-листы <span class="sec-count">${clStats.done}/${clStats.total}</span></span>
          <button type="button" class="sec-add" id="d-cl-add" title="создать чек-лист" aria-label="создать чек-лист">+</button>
        </summary>
        <div id="d-cl-wrap" class="sec-list">${renderChecklistsBlock(t.checklists)}</div>
        <div id="d-cl-panel" class="sec-add-panel" hidden>
          <input type="text" id="d-cl-new-input" placeholder="название списка, Enter" autocomplete="off"/>
        </div>
      </details>

      <details class="section" data-sec="links">
        <summary>
          <span class="sec-label">Связи <span class="sec-count">${lkN}</span></span>
          <button type="button" class="sec-add" id="d-link-add" title="добавить связь" aria-label="добавить связь">+</button>
        </summary>
        <div id="d-links" class="sec-list">${renderLinkSubsections(t)}</div>
        <div id="d-link-panel" class="sec-add-panel" hidden>
          <div class="link-add-row">
            <select id="d-link-type">
              <option value="related">связано</option>
              <option value="blocks">блокирует (ждёт)</option>
              <option value="spawned_from">родилась из</option>
              <option value="next">после идёт</option>
            </select>
            <input type="text" id="d-link-q" placeholder="поиск задачи" autocomplete="off"/>
          </div>
          <div id="d-link-pick-list" class="drawer-pick-list"></div>
        </div>
      </details>

      <details class="section" data-sec="works">
        <summary>Работы · ${hours} ч${estimate !== "" ? ` / оценка ${estimate} ч` : ""}</summary>
        <div class="estimate-row">
          <label class="fld"><span>оценка, часы</span><input id="d-estimate" type="number" min="0" step="0.5" value="${esc(estimate)}" placeholder="например, 6"/></label>
          <button type="button" id="d-est-save">Сохранить оценку</button>
          ${suggestion ? `<button type="button" class="ghost" id="d-est-suggest" data-hours="${esc(suggestion.hours)}">Предложение ${esc(suggestion.hours)} ч</button><span class="sub">${esc(suggestion.basis)}, задач: ${suggestion.count}</span>` : `<span class="sub">Предложение появится после учёта работ по другим задачам.</span>`}
        </div>
        <div class="works">${workRows}</div>
        <div class="row">
          <input id="d-wh" type="number" step="0.5" min="0.5" placeholder="часы" style="width:88px"/>
          <input id="d-wd" type="date" value="${esc(STATE.today || "")}" style="width:140px"/>
          <input id="d-wn" placeholder="что делал" style="flex:1"/>
          <button id="d-wadd">+</button>
        </div>
      </details>

      <details class="section" data-sec="comments">
        <summary>Комменты · ${comm.length}</summary>
        <div class="comments">${commHtml}</div>
        <div class="row">
          <input id="d-cmt" placeholder="коммент" style="flex:1"/>
          <button id="d-cadd">+</button>
        </div>
      </details>
    </div>`;

  showDrawer();
  drawerTaskId = id;
  bindAutogrow(document.getElementById("drawer"));
  if (opts.sections) restoreDrawerSections(opts.sections);

  document.querySelectorAll("#drawer .d-close").forEach(btn => { btn.onclick = closeDrawer; });
  const backBtn = document.querySelector("#drawer .d-back");
  if (backBtn) {
    backBtn.onclick = () => {
      const prevId = drawerBackStack.pop();
      if (prevId) openTask(prevId, { sections: saveDrawerSections() });
    };
  }

  const areaSel = document.getElementById("d-area");
  if (areaSel) {
    areaSel.addEventListener("change", () => {
      areaSel.className = "td-area-pill " + areaCssName(areaSel.value);
    });
  }

  if (parent) {
    document.querySelector(".td-parent").onclick = (e) => {
      e.preventDefault();
      openTask(parentId, { sections: saveDrawerSections(), back: id });
    };
  }

  bindClientProject(document.getElementById("d-client"), null);

  async function patchHeader(fields) {
    const prev = {};
    Object.keys(fields).forEach(k => { prev[k] = t[k]; t[k] = fields[k]; });
    const out = await api(`tasks/${id}`, fields);
    if (!out || !out.ok) {
      Object.assign(t, prev);
      toast("Ошибка сохранения");
      return false;
    }
    return true;
  }

  document.getElementById("d-title").addEventListener("blur", async (e) => {
    const title = e.target.value.trim() || t.title;
    if (title === t.title) return;
    await patchHeader({ title });
  });

  document.getElementById("d-status").addEventListener("change", async (e) => {
    await patchHeader({ status: e.target.value });
  });

  document.getElementById("d-due").addEventListener("change", async (e) => {
    let due = e.target.value;
    if (!taskIsAllDay(t) && String(t.due || "").includes("T") && due.length === 10) {
      due = due + "T" + String(t.due).split("T")[1];
    }
    await patchHeader({ due });
  });

  document.getElementById("d-area").addEventListener("change", async (e) => {
    await patchHeader({ area: e.target.value });
  });

  document.getElementById("d-client").addEventListener("change", async (e) => {
    await maybeNewClient(e.target, null);
    const cid = e.target.value;
    await patchHeader({ client_id: cid === "__new__" ? "" : cid });
  });

  document.getElementById("d-done").onclick = async () => {
    const next = t.status === "done" ? "todo" : "done";
    const out = await api(`tasks/${id}/status`, { status: next });
    if (!out || !out.ok) { toast("Ошибка"); return; }
    t.status = next;
    document.getElementById("d-done").textContent = next === "done" ? "Вернуть" : "Готово";
  };

  document.getElementById("d-pause").onclick = async () => {
    const out = await api(`tasks/${id}/status`, { status: "paused" });
    if (!out || !out.ok) { toast("Ошибка"); return; }
    t.status = "paused";
    document.getElementById("d-status").value = "paused";
  };

  document.getElementById("d-del").onclick = async () => {
    if (!confirm("Удалить задачу?")) return;
    await api(`tasks/${id}/delete`, {});
    closeDrawer();
    await load();
  };

  async function saveNotes() {
    const text = document.getElementById("d-notes").value;
    if (text === (t.notes || "")) return;
    const prev = t.notes;
    t.notes = text;
    const out = await api(`tasks/${id}`, { notes: text });
    if (!out || !out.ok) {
      t.notes = prev;
      toast("Ошибка сохранения");
    }
  }
  document.getElementById("d-notes").addEventListener("blur", saveNotes);

  async function createSubtask(title) {
    const trimmed = (title || "").trim();
    if (!trimmed) return;
    const out = await api("tasks", { title: trimmed, parent_task_id: id, client_id: t.client_id || "" });
    if (!out || !out.ok) { toast("Ошибка"); return; }
    if (out.task && !(STATE.tasks || []).some(x => x.id === out.task.id)) {
      STATE.tasks.push(out.task);
    }
    await syncTaskFromServer(id);
    await refreshDrawer(id, saveDrawerSections());
  }

  const subNewInput = document.getElementById("d-sub-new-input");
  if (subNewInput) {
    subNewInput.addEventListener("keydown", async (e) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      const title = subNewInput.value;
      subNewInput.disabled = true;
      await createSubtask(title);
      subNewInput.disabled = false;
      subNewInput.value = "";
      closeSubPanel();
    });
  }

  function renderSubPickList(q) {
    const list = document.getElementById("d-sub-pick-list");
    if (!list) return;
    const items = taskSearchOptions(id, q);
    list.innerHTML = items.length
      ? items.map(x =>
        `<button type="button" class="drawer-pick-item" data-id="${esc(x.id)}">${esc(x.title)}</button>`
      ).join("")
      : `<div class="empty">не найдено</div>`;
  }

  function closeSubPanel() {
    const panel = document.getElementById("d-sub-panel");
    if (!panel) return;
    panel.hidden = true;
    const ni = document.getElementById("d-sub-new-input");
    const q = document.getElementById("d-sub-link-q");
    if (ni) ni.value = "";
    if (q) q.value = "";
    const list = document.getElementById("d-sub-pick-list");
    if (list) list.innerHTML = "";
  }

  const subAddBtn = document.getElementById("d-sub-add");
  if (subAddBtn) {
    subAddBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const sec = e.target.closest('details[data-sec="subtasks"]');
      if (sec) sec.open = true;
      const panel = document.getElementById("d-sub-panel");
      if (!panel) return;
      if (!panel.hidden) {
        closeSubPanel();
        return;
      }
      panel.hidden = false;
      renderSubPickList("");
      const linkQ = document.getElementById("d-sub-link-q");
      if (linkQ) linkQ.oninput = () => renderSubPickList(linkQ.value);
      if (subNewInput) subNewInput.focus();
    };
  }

  const subPickList = document.getElementById("d-sub-pick-list");
  if (subPickList) {
    subPickList.addEventListener("click", async (e) => {
      const btn = e.target.closest(".drawer-pick-item");
      if (!btn) return;
      const childId = btn.dataset.id;
      const out = await api(`tasks/${id}/subtask/link`, { child_id: childId });
      closeSubPanel();
      if (!out || !out.ok) {
        if (out && out.error === "already_has_parent") toast("Задача уже подзадача. Сначала отвяжите от текущего родителя");
        else if (out && out.error === "parent_cycle") toast("Цикл в иерархии подзадач");
        else toast("Ошибка");
        return;
      }
      await refreshDrawer(id, saveDrawerSections());
    });
  }

  document.getElementById("d-dirs").addEventListener("click", async (e) => {
    const btn = e.target.closest(".dir-chip");
    if (!btn) return;
    const dirId = btn.dataset.dir;
    const prev = [...taskDirectionIds(t)];
    t.directions = prev.filter(x => x !== dirId);
    btn.remove();
    const out = await api(`tasks/${id}/directions/remove`, { direction_id: dirId });
    if (!out || !out.ok) {
      t.directions = prev;
      await refreshDrawer(id);
      toast("Ошибка");
      return;
    }
    renderTasks();
  });

  document.getElementById("d-dir-add").onclick = () => {
    const cur = taskDirectionIds(t);
    const avail = liveProjects(projectsForClient(t.client_id || ""))
      .filter(p => !cur.includes(p.id));
    if (!avail.length) { toast("Нет направлений"); return; }
    const optsHtml = avail.map(p =>
      `<option value="${esc(p.id)}">${esc(dirName(p.title, clientTitle(p.client_id)) || p.title)}</option>`
    ).join("");
    const sel = document.createElement("select");
    sel.innerHTML = `<option value="">выбери</option>${optsHtml}`;
    const wrap = document.createElement("div");
    wrap.className = "row";
    wrap.appendChild(sel);
    const ok = document.createElement("button");
    ok.textContent = "OK";
    wrap.appendChild(ok);
    const box = document.getElementById("d-dirs");
    box.after(wrap);
    ok.onclick = async () => {
      const dirId = sel.value;
      if (!dirId) { wrap.remove(); return; }
      const prev = [...taskDirectionIds(t)];
      if (!t.directions) t.directions = [];
      t.directions.push(dirId);
      const out = await api(`tasks/${id}/directions/add`, { direction_id: dirId });
      wrap.remove();
      if (!out || !out.ok) {
        t.directions = prev;
        toast("Ошибка");
        return;
      }
      document.getElementById("d-dirs").innerHTML = renderDirectionChips(t);
      renderTasks();
    };
  };

  function bindSubtasks() {
    document.querySelectorAll("#d-sub-list .sub-card").forEach(card => {
      const sid = card.dataset.id;
      card.querySelector(".sub-chk").onchange = async (e) => {
        const st = taskById(sid);
        if (!st) return;
        const prev = st.status;
        const next = e.target.checked ? "done" : "todo";
        st.status = next;
        card.querySelector(".sub-title").classList.toggle("done", next === "done");
        const out = await api(`tasks/${sid}/status`, { status: next });
        if (!out || !out.ok) {
          st.status = prev;
          e.target.checked = prev === "done";
          card.querySelector(".sub-title").classList.toggle("done", prev === "done");
          toast("Ошибка");
          return;
        }
        await refreshDrawer(id, saveDrawerSections());
      };
      card.querySelector(".sub-unlink").onclick = async (e) => {
        e.stopPropagation();
        const out = await api(`tasks/${id}/subtask/unlink`, { child_id: sid });
        if (!out || !out.ok) { toast("Ошибка"); return; }
        const st = taskById(sid);
        if (st) st.parent_task_id = "";
        card.remove();
        await syncTaskFromServer(id);
        const subs = subtasksOf(id);
        if (!subs.length) {
          document.getElementById("d-sub-list").innerHTML = "";
        }
        const subDone = subs.filter(x => x.status === "done").length;
        const sec = document.querySelector('#drawer details[data-sec="subtasks"] .sec-count');
        const bar = document.querySelector('#drawer details[data-sec="subtasks"] .sec-bar i');
        if (sec) sec.textContent = `${subDone}/${subs.length}`;
        if (bar) bar.style.width = subs.length ? `${Math.round(100 * subDone / subs.length)}%` : "0%";
      };
      card.querySelector(".sub-title").onclick = () => openTask(sid, { sections: saveDrawerSections(), back: id });
    });
  }
  bindSubtasks();

  function bindClItem(row, listId) {
    const itemId = row.dataset.id;
    const ta = row.querySelector(".cl-text");
    const chk = row.querySelector(".cl-chk");
    chk.onchange = async () => {
      const done = chk.checked;
      ta.classList.toggle("done", done);
      const out = await api(`items/${itemId}`, { done });
      if (!out || !out.ok) {
        chk.checked = !done;
        ta.classList.toggle("done", !done);
        toast("Ошибка");
        return;
      }
      await syncTaskFromServer(id);
      const st = checklistStats(taskById(id).checklists);
      const sec = document.querySelector('#drawer details[data-sec="checklists"] .sec-count');
      if (sec) sec.textContent = `${st.done}/${st.total}`;
    };
    ta.addEventListener("blur", async () => {
      const text = ta.value;
      const out = await api(`items/${itemId}`, { text });
      if (!out || !out.ok) toast("Ошибка");
    });
    row.querySelector(".cl-del").onclick = async () => {
      const out = await api(`items/${itemId}`, undefined, "DELETE");
      if (!out || !out.ok) { toast("Ошибка"); return; }
      row.remove();
      await syncTaskFromServer(id);
      const st = checklistStats(taskById(id).checklists);
      const sec = document.querySelector('#drawer details[data-sec="checklists"] .sec-count');
      if (sec) sec.textContent = `${st.done}/${st.total}`;
    };
    bindAutogrow(row);
  }

  function appendClItemRow(block, listId, itemId, text) {
    const itemsEl = block.querySelector(".cl-items");
    const row = document.createElement("div");
    row.className = "cl-item";
    row.dataset.id = itemId;
    row.innerHTML = `
      <input type="checkbox" class="cl-chk"/>
      <textarea class="cl-text autogrow" rows="1">${esc(text)}</textarea>
      <button type="button" class="ghost cl-del" title="удалить">×</button>`;
    itemsEl.appendChild(row);
    bindClItem(row, listId);
    const ta = row.querySelector(".cl-text");
    if (text) ta.focus();
    return row;
  }

  function bindChecklists() {
    document.querySelectorAll("#d-cl-wrap .cl-block").forEach(block => {
      const listId = block.dataset.id;
      const titleInput = block.querySelector(".cl-title");
      const addInput = block.querySelector(".cl-add-input");
      titleInput.addEventListener("blur", async (e) => {
        const title = e.target.value.trim() || "Список";
        const out = await api(`checklists/${listId}`, { title });
        if (!out || !out.ok) toast("Ошибка");
      });
      titleInput.addEventListener("keydown", (e) => {
        if (e.key !== "Enter") return;
        e.preventDefault();
        titleInput.blur();
        addInput.focus();
      });
      block.querySelector(".cl-rm").onclick = async () => {
        if (!confirm("Удалить список?")) return;
        const out = await api(`checklists/${listId}`, undefined, "DELETE");
        if (!out || !out.ok) { toast("Ошибка"); return; }
        await refreshDrawer(id, saveDrawerSections());
      };
      addInput.addEventListener("keydown", async (e) => {
        if (e.key !== "Enter") return;
        e.preventDefault();
        const text = addInput.value.trim();
        if (!text) return;
        addInput.disabled = true;
        const out = await api(`checklists/${listId}/items`, { text });
        addInput.disabled = false;
        if (!out || !out.ok) { toast("Ошибка"); return; }
        addInput.value = "";
        appendClItemRow(block, listId, out.id, text);
        await syncTaskFromServer(id);
        const st = checklistStats(taskById(id).checklists);
        const sec = document.querySelector('#drawer details[data-sec="checklists"] .sec-count');
        if (sec) sec.textContent = `${st.done}/${st.total}`;
        addInput.focus();
      });
      block.querySelectorAll(".cl-item").forEach(row => bindClItem(row, listId));
    });
  }
  bindChecklists();

  function closeClPanel() {
    const panel = document.getElementById("d-cl-panel");
    if (!panel) return;
    panel.hidden = true;
    const inp = document.getElementById("d-cl-new-input");
    if (inp) inp.value = "";
  }

  const clAddBtn = document.getElementById("d-cl-add");
  const clNewInput = document.getElementById("d-cl-new-input");
  if (clAddBtn) {
    clAddBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const sec = e.target.closest('details[data-sec="checklists"]');
      if (sec) sec.open = true;
      const panel = document.getElementById("d-cl-panel");
      if (!panel) return;
      if (!panel.hidden) {
        closeClPanel();
        return;
      }
      panel.hidden = false;
      if (clNewInput) clNewInput.focus();
    };
  }
  if (clNewInput) {
    clNewInput.addEventListener("keydown", async (e) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      const title = clNewInput.value.trim() || "Список";
      clNewInput.disabled = true;
      const out = await api(`tasks/${id}/checklists`, { title });
      clNewInput.disabled = false;
      closeClPanel();
      if (!out || !out.ok) { toast("Ошибка"); return; }
      await refreshDrawer(id, saveDrawerSections());
    });
  }

  document.getElementById("d-links").addEventListener("click", async (e) => {
    const del = e.target.closest(".link-del");
    if (del) {
      e.stopPropagation();
      const item = del.closest(".link-item");
      const linkId = item && item.dataset.linkId;
      if (!linkId) return;
      const out = await api(`links/${linkId}`, undefined, "DELETE");
      if (!out || !out.ok) { toast("Ошибка"); return; }
      const secEl = item.closest(".link-sec");
      item.remove();
      if (secEl && !secEl.querySelector(".link-item")) secEl.remove();
      await syncTaskFromServer(id);
      const lkN = linkCount(taskById(id).links);
      const sec = document.querySelector('#drawer details[data-sec="links"] .sec-count');
      if (sec) sec.textContent = String(lkN);
      const wrap = document.getElementById("d-links");
      if (wrap && !wrap.querySelector(".link-item")) wrap.innerHTML = "";
      return;
    }
    const btn = e.target.closest(".link-row");
    if (!btn) return;
    openTask(btn.dataset.id, { sections: saveDrawerSections(), back: id });
  });

  function renderLinkPickList(q) {
    const list = document.getElementById("d-link-pick-list");
    if (!list) return;
    const items = taskSearchOptions(id, q);
    list.innerHTML = items.length
      ? items.map(x =>
        `<button type="button" class="drawer-pick-item" data-id="${esc(x.id)}">${esc(x.title)}</button>`
      ).join("")
      : `<div class="empty">не найдено</div>`;
  }

  function closeLinkPanel() {
    const panel = document.getElementById("d-link-panel");
    if (!panel) return;
    panel.hidden = true;
    const q = document.getElementById("d-link-q");
    if (q) q.value = "";
    const list = document.getElementById("d-link-pick-list");
    if (list) list.innerHTML = "";
  }

  document.getElementById("d-link-add").onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const sec = e.target.closest('details[data-sec="links"]');
    if (sec) sec.open = true;
    const panel = document.getElementById("d-link-panel");
    if (!panel) return;
    if (!panel.hidden) {
      closeLinkPanel();
      return;
    }
    panel.hidden = false;
    const q = document.getElementById("d-link-q");
    renderLinkPickList("");
    if (q) {
      q.oninput = () => renderLinkPickList(q.value);
      q.focus();
    }
  };

  const linkPickList = document.getElementById("d-link-pick-list");
  if (linkPickList) {
    linkPickList.addEventListener("click", async (e) => {
      const btn = e.target.closest(".drawer-pick-item");
      if (!btn) return;
      const otherId = btn.dataset.id;
      const type = document.getElementById("d-link-type").value;
      let body;
      if (type === "blocks") body = { from_task: id, to_task: otherId, type: "blocks" };
      else if (type === "spawned_from") body = { from_task: otherId, to_task: id, type: "spawned_from" };
      else if (type === "next") body = { from_task: id, to_task: otherId, type: "next" };
      else body = { from_task: id, to_task: otherId, type: "related" };
      const out = await api("links", body);
      closeLinkPanel();
      if (!out || !out.ok) {
        if (out && out.error === "cycle") {
          const b = taskById(otherId);
          toast(`Цикл: задача ${b ? b.title : otherId} уже ждёт задачу ${t.title}`);
        } else toast("Ошибка");
        return;
      }
      await refreshDrawer(id, saveDrawerSections());
    });
  }

  document.getElementById("d-cadd").onclick = async () => {
    const text = document.getElementById("d-cmt").value.trim();
    if (!text) return;
    const out = await api(`tasks/${id}/comments`, { text });
    if (!out || !out.ok) { toast("Ошибка"); return; }
    await refreshDrawer(id, saveDrawerSections());
  };

  document.getElementById("d-est-save").onclick = async () => {
    const raw = document.getElementById("d-estimate").value;
    const out = await api(`tasks/${id}`, { estimate_hours: raw === "" ? "" : Number(raw) });
    if (!out || !out.ok) { toast("Оценка не сохранилась"); return; }
    await refreshDrawer(id, saveDrawerSections());
  };
  const suggestButton = document.getElementById("d-est-suggest");
  if (suggestButton) {
    suggestButton.onclick = () => {
      document.getElementById("d-estimate").value = suggestButton.dataset.hours || "";
    };
  }

  document.getElementById("d-wadd").onclick = async () => {
    const hoursVal = Number(document.getElementById("d-wh").value);
    if (!hoursVal) return;
    const out = await api("works", {
      task_id: id,
      hours: hoursVal,
      date: document.getElementById("d-wd").value || STATE.today,
      note: document.getElementById("d-wn").value.trim()
    });
    if (!out || !out.ok) { toast("Ошибка"); return; }
    await refreshDrawer(id, saveDrawerSections());
  };

  document.querySelectorAll(".works-row .wdel").forEach(btn => {
    btn.addEventListener("click", async () => {
      const wid = btn.closest(".works-row").dataset.id;
      if (!wid) return;
      const out = await api(`works/${wid}/delete`, {});
      if (!out || !out.ok) { toast("Ошибка"); return; }
      await refreshDrawer(id, saveDrawerSections());
    });
  });
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function fcLocal(dt) {
  if (!dt) return "";
  if (typeof dt === "string") {
    return dt.length === 16 ? dt + ":00" : dt;
  }
  return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}T${pad2(dt.getHours())}:${pad2(dt.getMinutes())}:${pad2(dt.getSeconds())}`;
}

function eventTimes(e) {
  const start = e.startStr || fcLocal(e.start);
  let end = e.endStr || fcLocal(e.end);
  if (!end && e.start && !e.allDay) {
    end = fcLocal(new Date(e.start.getTime() + 60 * 60 * 1000));
  }
  return { start, end, allDay: !!e.allDay };
}

function eventRawId(e) {
  const raw = e.extendedProps && e.extendedProps.rawId;
  if (raw) return raw;
  return String(e.id || "").replace(/^ev-/, "");
}

function taskIsAllDay(t) {
  if (t.all_day === false || t.all_day === 0 || t.all_day === "0") return false;
  return !String(t.due || "").includes("T");
}

function taskToCal(t) {
  const allDay = taskIsAllDay(t);
  if (allDay) {
    return {
      start: String(t.due).slice(0, 10),
      end: t.due_end ? String(t.due_end).slice(0, 10) : undefined,
      allDay: true
    };
  }
  return {
    start: t.due,
    end: t.due_end || undefined,
    allDay: false
  };
}

function saveTaskTimes(e) {
  const t = eventTimes(e);
  if (t.allDay) {
    return {
      due: String(t.start).slice(0, 10),
      due_end: t.end ? String(t.end).slice(0, 10) : "",
      all_day: true
    };
  }
  return { due: t.start, due_end: t.end || "", all_day: false };
}

function calEvents() {
  const fromEvents = (CLIENT_FILTER ? [] : (STATE.events || [])).map(e => {
    const area = areaKey(e.calendar);
    const start = e.start;
    const end = e.end || undefined;
    return {
      id: "ev-" + e.id,
      title: e.title,
      start,
      end,
      allDay: !!e.allDay,
      backgroundColor: areaColor(area),
      borderColor: areaColor(area),
      classNames: ["area-" + area],
      durationEditable: true,
      startEditable: true,
      extendedProps: { kind: "event", rawId: e.id, area }
    };
  });
  const fromTasks = (STATE.tasks || []).filter(t => t.status !== "done" && t.due && taskMatchesClient(t, CLIENT_FILTER)).map(t => {
    const area = areaKey(t.area);
    const times = taskToCal(t);
    return {
      id: "task-" + t.id,
      title: t.title,
      start: times.start,
      end: times.end,
      allDay: times.allDay,
      backgroundColor: areaColor(area),
      borderColor: areaColor(area),
      classNames: ["area-" + area],
      durationEditable: true,
      startEditable: true,
      extendedProps: { kind: "task", rawId: t.id, area }
    };
  });
  return fromEvents.concat(fromTasks);
}

function renderCal() {
  const el = document.getElementById("fc");
  const events = calEvents();
  if (CAL) {
    CAL.removeAllEvents();
    events.forEach(e => {
      try { CAL.addEvent(e); } catch (err) { console.warn("cal add", err, e); }
    });
    return;
  }
  if (typeof FullCalendar === "undefined") return;
  CAL = new FullCalendar.Calendar(el, {
    locale: "ru",
    firstDay: 1,
    initialView: window.innerWidth < 800 ? "listWeek" : "timeGridWeek",
    headerToolbar: { left: "prev,next today", center: "title", right: "dayGridMonth,timeGridWeek,listWeek" },
    height: "auto",
    contentHeight: 680,
    slotMinTime: "07:00:00",
    slotMaxTime: "22:00:00",
    slotDuration: "00:30:00",
    snapDuration: "00:15:00",
    defaultTimedEventDuration: "01:00:00",
    forceEventDuration: true,
    eventDurationEditable: true,
    eventResizableFromStart: true,
    selectable: true,
    selectMirror: true,
    selectMinDistance: 0,
    editable: true,
    events,
    select: (info) => {
      CAL.unselect();
      openCalCreate({ start: info.startStr, end: info.endStr, allDay: !!info.allDay });
    },
    eventDrop: async (info) => {
      const e = info.event;
      const kind = (e.extendedProps || {}).kind;
      try {
        if (kind === "task") {
          const out = await api(`tasks/${eventRawId(e)}`, saveTaskTimes(e));
          if (!out || !out.ok) throw new Error("save");
          return;
        }
        const t = eventTimes(e);
        const out = await api(`events/${eventRawId(e)}`, t);
        if (!out || !out.ok) throw new Error("save");
      } catch (err) {
        info.revert();
      }
    },
    eventResize: async (info) => {
      const e = info.event;
      const kind = (e.extendedProps || {}).kind;
      try {
        if (kind === "task") {
          const out = await api(`tasks/${eventRawId(e)}`, saveTaskTimes(e));
          if (!out || !out.ok) throw new Error("save");
          return;
        }
        const t = eventTimes(e);
        if (!t.end) throw new Error("no end");
        const out = await api(`events/${eventRawId(e)}`, t);
        if (!out || !out.ok) throw new Error("save");
      } catch (err) {
        info.revert();
      }
    },
    eventClick: async (info) => {
      const kind = (info.event.extendedProps || {}).kind;
      if (kind === "task") {
        openTask(eventRawId(info.event), { clearStack: true });
        return;
      }
      if (!confirm(`Удалить «${info.event.title}»?`)) return;
      await api(`events/${eventRawId(info.event)}/delete`, {});
      await load();
    }
  });
  CAL.render();
}

function renderIdeas() {
  const box = document.getElementById("ideas");
  if (!box) return;
  const ideas = (STATE.projects || []).filter(p => (p.status || "idea") === "idea");
  box.innerHTML = ideas.length ? ideas.map(p => `
    <article class="idea-card" data-id="${esc(p.id)}">
      <h3>${esc(projectPath(p) || p.title)}</h3>
      <p>${esc(p.notes || (p.client_id ? clientTitle(p.client_id) : "без клиента"))}</p>
      <div class="idea-actions">
        <button type="button" class="idea-open ghost">Открыть</button>
        <button type="button" class="idea-promote">В бэклог</button>
        <button type="button" class="idea-delete danger">Удалить</button>
      </div>
    </article>`).join("") : `<div class="empty">идей пока нет</div>`;

  box.querySelectorAll(".idea-card").forEach(card => {
    const id = card.dataset.id;
    card.querySelector(".idea-open").onclick = () => openProjectDetail(id);
    card.querySelector(".idea-promote").onclick = async () => {
      await api(`projects/${id}`, { status: "backlog" });
      await load();
      toast("Идея перенесена в бэклог");
    };
    card.querySelector(".idea-delete").onclick = async () => {
      const idea = (STATE.projects || []).find(p => p.id === id);
      if (!idea || !confirm(`Удалить идею «${idea.title}»?`)) return;
      await api(`projects/${id}/delete`, {});
      await load();
    };
  });
}

function renderProjects() {
  const cols = Object.keys(PSTATUS).filter(st => st !== "idea");
  const box = document.getElementById("kanban");
  box.innerHTML = cols.map(st => {
    const cards = (STATE.projects || []).filter(p => (p.status || "idea") === st && (!CLIENT_FILTER || (p.client_id || "") === CLIENT_FILTER)).map(p => {
      const n = (STATE.tasks || []).filter(t => taskHasDirection(t, p.id) && t.status !== "done").length;
      return `<div class="kcard" data-id="${esc(p.id)}" role="button" tabindex="0">
        <span class="drag" title="перетащить">⋮⋮</span>
        <b>${esc(projectPath(p) || p.title)}</b>
        <small>${esc([p.area].filter(Boolean).join(" · "))}${n ? " · задач " + n : ""}</small>
        <em class="go-tasks">задачи →</em>
      </div>`;
    }).join("");
    return `<section class="col" data-status="${st}"><h2>${PSTATUS[st]}</h2><div class="list">${cards || '<div class="empty">пусто</div>'}</div></section>`;
  }).join("");
  box.querySelectorAll(".list").forEach(list => {
    if (typeof Sortable === "undefined") return;
    new Sortable(list, {
      group: "projects",
      animation: 150,
      handle: ".drag",
      filter: ".empty",
      delayOnTouchOnly: true,
      delay: 120,
      onAdd: async (evt) => {
        const id = evt.item.dataset.id;
        const status = evt.to.closest(".col").dataset.status;
        if (id) {
          await api(`projects/${id}`, { status });
          await load();
        }
      }
    });
  });
  box.querySelectorAll(".kcard").forEach(card => {
    card.addEventListener("click", (e) => {
      if (e.target.closest(".drag")) return;
      if (e.target.closest(".go-tasks")) {
        e.preventDefault();
        openProject(card.dataset.id);
        return;
      }
      if (e.detail > 1) return;
      openProjectDetail(card.dataset.id);
    });
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openProjectDetail(card.dataset.id);
      }
    });
  });
}

function openProjectDetail(id) {
  drawerTaskId = "";
  const p = (STATE.projects || []).find(x => x.id === id);
  if (!p) return;
  const tasks = (STATE.tasks || []).filter(t => taskHasDirection(t, id) && t.status !== "done");
  const taskList = tasks.map(t => `<div class="task-mini" data-id="${esc(t.id)}">${esc(t.title)}</div>`).join("")
    || `<div class="empty">открытых задач нет</div>`;
  document.getElementById("drawer").innerHTML = `
    <div class="drawer-body">
      <div class="drawer-title-row">
        <h3>${esc(projectPath(p) || p.title)}</h3>
        <button type="button" class="ghost d-close" title="Скрыть" aria-label="Закрыть">×</button>
      </div>
      ${fld("название", `<input id="pd-title" type="text" value="${esc(p.title)}"/>`)}
      <div class="pair">
        ${fld("клиент", `<select id="pd-client">${clientOptions(p.client_id || "", true)}</select>`)}
        ${fld("статус", `<select id="pd-status">${Object.keys(PSTATUS).map(s => `<option value="${s}" ${p.status === s ? "selected" : ""}>${PSTATUS[s]}</option>`).join("")}</select>`)}
      </div>
      <textarea id="pd-notes" placeholder="ресурсы, ссылки, звонки, письма">${esc(p.notes || "")}</textarea>
      <div class="row">
        <button type="button" id="pd-save">Сохранить</button>
        <button type="button" class="ghost" id="pd-tasks">задачи направления</button>
        <button type="button" class="ghost" id="pd-arch">${p.status === "done" ? "вернуть" : "в архив"}</button>
      </div>
      <h2>открытые задачи <span>${tasks.length}</span></h2>
      <div id="pd-list">${taskList}</div>
    </div>`;
  showDrawer();
  document.querySelectorAll("#drawer .d-close").forEach(btn => { btn.onclick = closeDrawer; });
  document.getElementById("pd-save").onclick = async () => {
    const cid = document.getElementById("pd-client").value;
    await api(`projects/${id}`, {
      title: document.getElementById("pd-title").value.trim() || p.title,
      client_id: cid === "__new__" ? "" : cid,
      status: document.getElementById("pd-status").value,
      notes: document.getElementById("pd-notes").value
    });
    closeDrawer();
    await load();
  };
  document.getElementById("pd-tasks").onclick = () => {
    closeDrawer();
    openProject(id);
  };
  document.getElementById("pd-arch").onclick = async () => {
    await api(`projects/${id}`, { status: p.status === "done" ? "doing" : "done" });
    closeDrawer();
    await load();
  };
  document.querySelectorAll("#pd-list .task-mini").forEach(el => {
    el.addEventListener("click", () => toggleTaskFromList(el.dataset.id));
  });
}

function horizonOptions() {
  const t = STATE && STATE.today ? STATE.today : "2026-08-15";
  const y = Number(t.slice(0, 4));
  const m = Number(t.slice(5, 7));
  const q = Math.ceil(m / 3);
  const months = ["янв","фев","мар","апр","май","июн","июл","авг","сен","окт","ноя","дек"];
  return [
    [`${y}-${String(m).padStart(2, "0")}`, months[m - 1] + " " + y],
    [`${y}-Q${q}`, "Q" + q + " " + y],
    [String(y), "год " + y]
  ];
}

function fillGoalHorizon() {
  const el = document.getElementById("ng-horizon");
  if (!el || el.options.length) return;
  el.innerHTML = horizonOptions().map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join("");
}

function goalPct(g) {
  const krs = g.krs || [];
  if (!krs.length) return Math.max(0, Math.min(100, Number(g.progress || 0)));
  const parts = krs.map(k => {
    const tgt = Number(k.target || 0);
    if (!tgt) return 0;
    return Math.min(100, 100 * Number(k.current || 0) / tgt);
  });
  return Math.round(parts.reduce((a, b) => a + b, 0) / parts.length);
}

function tone(pct) {
  if (pct >= 70) return "ok";
  if (pct >= 40) return "mid";
  return "bad";
}

function krLine(g) {
  const krs = g.krs || [];
  if (!krs.length) return `<div class="empty">добавь ключевой результат</div>`;
  return krs.map((k, i) => {
    const cur = Number(k.current || 0);
    const tgt = Number(k.target || 1) || 1;
    const p = Math.min(100, Math.round(100 * cur / tgt));
    return `<div class="kr" data-i="${i}">
      <span>${esc(k.title)}</span>
      <div class="bar tone-${tone(p)}"><i style="width:${p}%"></i></div>
      <input type="number" class="kr-cur" value="${cur}" min="0" step="1"/>
      <span class="sub">/ ${tgt}</span>
    </div>`;
  }).join("");
}

function renderGoals() {
  fillGoalHorizon();
  const el = document.getElementById("goals");
  const list = STATE.goals || [];
  el.innerHTML = list.map(g => {
    const pct = goalPct(g);
    return `<article class="card goal-card" data-id="${esc(g.id)}">
      <div class="row" style="justify-content:space-between;align-items:baseline">
        <h3>${esc(g.title)}</h3>
        <span class="pill ${tone(pct)}">${pct}%</span>
      </div>
      <div class="sub">${esc(g.horizon || "")}</div>
      <div class="bar tone-${tone(pct)}"><i style="width:${pct}%"></i></div>
      ${krLine(g)}
      <div class="row" style="margin-top:8px">
        <input class="kr-title" placeholder="ключевой результат" style="flex:1"/>
        <input class="kr-tgt" type="number" min="1" value="1" style="width:72px"/>
        <button type="button" class="ghost kr-add">+ KR</button>
        <button type="button" class="ghost del">удалить</button>
      </div>
    </article>`;
  }).join("") || `<div class="empty">Целей нет - добавь выше</div>`;
  el.querySelectorAll("article").forEach(card => {
    const id = card.dataset.id;
    const g = (STATE.goals || []).find(x => x.id === id);
    card.querySelectorAll(".kr-cur").forEach(inp => {
      inp.addEventListener("change", async () => {
        const i = Number(inp.closest(".kr").dataset.i);
        const krs = (g.krs || []).map((k, n) => n === i ? { ...k, current: Number(inp.value) } : k);
        await api(`goals/${id}`, { krs, progress: goalPct({ krs }) });
        await load();
      });
    });
    card.querySelector(".kr-add").addEventListener("click", async () => {
      const title = card.querySelector(".kr-title").value.trim();
      if (!title) return;
      const target = Number(card.querySelector(".kr-tgt").value) || 1;
      const krs = (g.krs || []).concat([{ title, current: 0, target }]);
      await api(`goals/${id}`, { krs, progress: goalPct({ krs }) });
      await load();
    });
    card.querySelector(".del").addEventListener("click", async () => {
      if (!confirm("Удалить цель?")) return;
      await api(`goals/${id}/delete`, {});
      await load();
    });
  });
}

function heatHtml(checks) {
  const today = STATE.today;
  const end = new Date(today + "T12:00:00");
  const start = new Date(end);
  start.setDate(start.getDate() - 12 * 7);
  while (start.getDay() !== 1) start.setDate(start.getDate() - 1);
  let html = "";
  const cur = new Date(start);
  const days = Math.round((end - start) / 86400000) + 1;
  for (let i = 0; i < days; i++) {
    const key = ymd(cur);
    const on = checks && checks[key] ? "on" : "";
    const isT = key === today ? "today" : "";
    html += `<i class="${on} ${isT}" data-d="${key}" title="${key}"></i>`;
    cur.setDate(cur.getDate() + 1);
  }
  return html;
}

function weekKeys(today) {
  const d = new Date(today + "T12:00:00");
  const mon = new Date(d);
  mon.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const x = new Date(mon);
    x.setDate(mon.getDate() + i);
    return ymd(x);
  });
}

function habitBestStreak(checks) {
  const keys = Object.keys(checks || {}).filter(k => checks[k]).sort();
  let best = 0, cur = 0, prev = "";
  keys.forEach(k => {
    if (prev) {
      const a = new Date(prev + "T12:00:00");
      const b = new Date(k + "T12:00:00");
      cur = ((b - a) / 86400000) === 1 ? cur + 1 : 1;
    } else cur = 1;
    best = Math.max(best, cur);
    prev = k;
  });
  return best;
}

function habitBoardStats(habits, today) {
  const n = habits.length;
  let done = 0, best = 0;
  const byDay = {};
  habits.forEach(h => {
    const c = h.checks || {};
    best = Math.max(best, habitBestStreak(c));
    Object.keys(c).forEach(k => {
      if (!c[k]) return;
      done += 1;
      byDay[k] = (byDay[k] || 0) + 1;
    });
  });
  let perfect = 0;
  if (n) Object.keys(byDay).forEach(k => { if (byDay[k] >= n) perfect += 1; });
  const days = Object.keys(byDay).length || 1;
  return { best, done, perfect, avg: (done / days).toFixed(1) };
}

function renderHabits() {
  const el = document.getElementById("habits");
  const statsEl = document.getElementById("habit-stats");
  const habits = STATE.habits || [];
  const names = ["пн", "вт", "ср", "чт", "пт", "сб", "вс"];
  const week = weekKeys(STATE.today);
  if (statsEl) {
    const s = habitBoardStats(habits, STATE.today);
    statsEl.innerHTML = habits.length ? `
      <div><b>${s.best}</b><span>лучшая серия</span></div>
      <div><b>${s.perfect}</b><span>идеальных дней</span></div>
      <div><b>${s.done}</b><span>отметок всего</span></div>
      <div><b>${s.avg}</b><span>среднее за день</span></div>` : "";
  }
  el.innerHTML = habits.map(h => {
    const checks = h.checks || {};
    const on = !!checks[STATE.today];
    const streak = habitStreak(checks);
    const best = habitBestStreak(checks);
    const month = (STATE.today || "").slice(0, 7);
    const monthN = Object.keys(checks).filter(k => k.startsWith(month) && checks[k]).length;
    const weekN = week.filter(k => checks[k]).length;
    const cells = week.map((k, i) =>
      `<button type="button" class="wd ${checks[k] ? "on" : ""} ${k === STATE.today ? "today" : ""}" data-d="${k}">${names[i]}</button>`
    ).join("");
    return `<div class="habit card" data-id="${esc(h.id)}">
      <div class="row" style="justify-content:space-between">
        <label class="row"><input type="checkbox" ${on ? "checked" : ""}/> <b>${esc(h.title)}</b></label>
        <span class="sub">серия ${streak} · рекорд ${best} · неделя ${weekN}/7 · месяц ${monthN}</span>
      </div>
      <div class="week">${cells}</div>
      <details class="more"><summary>12 недель</summary>
        <div class="heat-wrap">
          <div class="heat-days"><span>пн</span><span>вт</span><span>ср</span><span>чт</span><span>пт</span><span>сб</span><span>вс</span></div>
          <div class="heat">${heatHtml(checks)}</div>
        </div>
      </details>
    </div>`;
  }).join("") || `<div class="empty">Привычек нет</div>`;
  el.querySelectorAll(".habit").forEach(box => {
    const id = box.dataset.id;
    box.querySelector("input").addEventListener("change", async (e) => {
      await api(`habits/${id}/check`, { date: STATE.today, on: e.target.checked });
      await load();
    });
    box.querySelectorAll(".wd").forEach(btn => {
      btn.addEventListener("click", async () => {
        const d = btn.dataset.d;
        const h = (STATE.habits || []).find(x => x.id === id);
        const on = !(h.checks && h.checks[d]);
        await api(`habits/${id}/check`, { date: d, on });
        await load();
      });
    });
    box.querySelectorAll(".heat i").forEach(cell => {
      cell.addEventListener("click", async () => {
        const d = cell.dataset.d;
        const h = (STATE.habits || []).find(x => x.id === id);
        const on = !(h.checks && h.checks[d]);
        await api(`habits/${id}/check`, { date: d, on });
        await load();
      });
    });
  });
}

function ymd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function habitStreak(checks) {
  let n = 0;
  const d = new Date(STATE.today + "T12:00:00");
  for (;;) {
    const key = ymd(d);
    if (!checks[key]) break;
    n += 1;
    d.setDate(d.getDate() - 1);
    if (n > 400) break;
  }
  return n;
}

async function load() {
  const data = await api("state");
  if (!data.ok) {
    document.getElementById("stamp").textContent = "нет доступа";
    return;
  }
  STATE = data;
  document.getElementById("stamp").textContent = data.today + " · бюро";
  document.getElementById("storage").textContent = data.storage === "mysql" ? "MySQL" : "файл";
  restoreDeskFilters();
  const areaEl = document.getElementById("nt-area");
  if (areaEl && AREA_FILTER !== "все") areaEl.value = AREA_FILTER;
  fillLinkedSelects();
  renderClientContext();
  renderClientMode();
  renderFilters();
  renderProjectBanner();
  renderTasks();
  if (PROJECT_FILTER || CLIENT_FILTER) prefillTaskForm();
  try { renderCal(); } catch (err) { console.warn("cal", err); }
  renderIdeas();
  renderProjects();
  renderCatalogs();
  renderGoals();
  renderHabits();
}

function renderCatalogs() {
  const el = document.getElementById("catalogs");
  if (!el) return;
  const projects = STATE.projects || [];
  const rows = (STATE.clients || []).map(c => {
    const dirs = projects.filter(p => (p.client_id || "") === c.id);
    if (!dirs.length) return "";
    const open = dirs.filter(p => p.status !== "done");
    const arch = dirs.filter(p => p.status === "done");
    const names = open.map(p => `<button type="button" class="ghost cat-dir" data-id="${esc(p.id)}">${esc(dirName(p.title, c.title) || p.title)}</button>`).join("");
    const old = arch.length ? `<span class="sub">архив: ${arch.map(p => dirName(p.title, c.title) || p.title).join(", ")}</span>` : "";
    return `<div class="cat-line"><b>${esc(c.title)}</b> ${names || "<span class=\"sub\">нет открытых</span>"} ${old}</div>`;
  }).filter(Boolean);
  el.innerHTML = rows.join("") || `<div class="empty">направлений нет</div>`;
  el.querySelectorAll(".cat-dir").forEach(btn => {
    btn.addEventListener("click", () => openProjectDetail(btn.dataset.id));
  });
}

document.getElementById("add-task").addEventListener("submit", async (e) => {
  e.preventDefault();
  const err = document.getElementById("task-err");
  if (err) err.textContent = "";
  const title = document.getElementById("nt-title").value.trim();
  if (!title) return;
  const area = document.getElementById("nt-area").value || "работа";
  const due = document.getElementById("nt-due").value || "";
  const keepClient = document.getElementById("nt-client").value;
  const keepProj = document.getElementById("nt-proj").value;
  try {
    const out = await api("tasks", {
      title,
      due,
      status: document.getElementById("nt-status").value,
      area,
      client_id: keepClient === "__new__" ? "" : keepClient,
      project_id: keepProj === "__new__" ? "" : keepProj,
      all_day: true
    });
    if (!out || !out.ok) {
      if (err) err.textContent = "не сохранилось" + (out && out.error ? ": " + out.error : "");
      return;
    }
    e.target.reset();
    document.getElementById("nt-status").value = "todo";
    document.getElementById("nt-area").value = area;
    fillLinkedSelects();
    if (PROJECT_FILTER) prefillTaskForm();
    else {
      if (keepClient && keepClient !== "__new__") document.getElementById("nt-client").value = keepClient;
      if (keepProj && keepProj !== "__new__") document.getElementById("nt-proj").value = keepProj;
    }
    await load();
  } catch (ex) {
    if (err) err.textContent = "сбой: задача могла не сохраниться, обнови страницу";
  }
});

document.getElementById("add-proj").addEventListener("submit", async (e) => {
  e.preventDefault();
  const title = document.getElementById("np-title").value.trim();
  if (!title) return;
  const raw = document.getElementById("np-client").value;
  const cid = raw === "__new__" ? "" : raw;
  await api("projects", {
    title,
    status: document.getElementById("np-status").value,
    notes: "",
    area: !cid || cid === "cli-buro" ? "бюро" : "работа",
    client_id: cid
  });
  e.target.reset();
  await load();
});

document.getElementById("add-idea").addEventListener("submit", async (e) => {
  e.preventDefault();
  const title = document.getElementById("ni-title").value.trim();
  if (!title) return;
  const raw = document.getElementById("ni-client").value;
  const cid = raw === "__new__" ? "" : raw;
  const out = await api("projects", {
    title,
    status: "idea",
    notes: "",
    area: !cid || cid === "cli-buro" ? "бюро" : "работа",
    client_id: cid
  });
  if (!out || !out.ok) {
    toast("Идея не сохранилась");
    return;
  }
  e.target.reset();
  await load();
});

document.getElementById("add-goal").addEventListener("submit", async (e) => {
  e.preventDefault();
  const title = document.getElementById("ng-title").value.trim();
  if (!title) return;
  await api("goals", { title, horizon: document.getElementById("ng-horizon").value, progress: 0, krs: [] });
  e.target.reset();
  await load();
});

document.getElementById("add-habit").addEventListener("submit", async (e) => {
  e.preventDefault();
  const title = document.getElementById("nh-title").value.trim();
  if (!title) return;
  await api("habits", { title, checks: {} });
  e.target.reset();
  await load();
});

window.addEventListener("hashchange", page);
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeDrawer();
});
page();
bindClientProject(document.getElementById("nt-client"), document.getElementById("nt-proj"));
const npClient = document.getElementById("np-client");
if (npClient) {
  npClient.addEventListener("change", () => maybeNewClient(npClient, null));
}
const niClient = document.getElementById("ni-client");
if (niClient) {
  niClient.addEventListener("change", () => maybeNewClient(niClient, null));
}
const clientModeSelect = document.getElementById("client-mode-select");
if (clientModeSelect) {
  clientModeSelect.addEventListener("change", () => setClientContext(clientModeSelect.value, "client"));
}
const clientModePages = {
  "client-open-tasks": "tasks",
  "client-open-calendar": "calendar",
  "client-open-projects": "projects"
};
const digestMorning = document.getElementById("digest-morning");
const digestEvening = document.getElementById("digest-evening");
const digestRefresh = document.getElementById("digest-refresh");
if (digestMorning) digestMorning.addEventListener("click", () => renderDigest("morning"));
if (digestEvening) digestEvening.addEventListener("click", () => renderDigest("evening"));
if (digestRefresh) digestRefresh.addEventListener("click", () => renderDigest());
Object.entries(clientModePages).forEach(([id, target]) => {
  const button = document.getElementById(id);
  if (button) button.addEventListener("click", () => setClientContext(CLIENT_FILTER, target));
});
load();
