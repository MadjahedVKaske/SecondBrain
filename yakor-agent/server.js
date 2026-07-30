import express from "express";
import multer from "multer";
import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.YAKOR_DATA_DIR || path.join(__dirname, "data");
const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
const STORE_PATH = path.join(DATA_DIR, "store.json");
const PORT = Number(process.env.PORT || 3100);
const HOST = process.env.HOST || "127.0.0.1";
const ADMIN_TOKEN = process.env.YAKOR_AGENT_TOKEN || "yakor-dev-token";
const DEFAULT_REPO =
  process.env.YAKOR_DEFAULT_REPO_URL ||
  "https://github.com/MadjahedVKaske/YakorPushTest.git";
const DEFAULT_BRANCH = process.env.YAKOR_DEFAULT_BRANCH || "main";
const LONGPOLL_MS = Number(process.env.YAKOR_LONGPOLL_MS || 14000);

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

function emptyStore() {
  return { tasks: [], results: [], projects: [], files: [] };
}

function loadStore() {
  try {
    if (!fs.existsSync(STORE_PATH)) return emptyStore();
    const raw = JSON.parse(fs.readFileSync(STORE_PATH, "utf8"));
    return {
      tasks: Array.isArray(raw.tasks) ? raw.tasks : [],
      results: Array.isArray(raw.results) ? raw.results : [],
      projects: Array.isArray(raw.projects) ? raw.projects : [],
      files: Array.isArray(raw.files) ? raw.files : [],
    };
  } catch {
    return emptyStore();
  }
}

function saveStore(store) {
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), "utf8");
}

let store = loadStore();
const waiters = new Map(); // key: yakorId|projectId -> [resolve]

function waiterKey(yakorId, projectId) {
  return `${yakorId}||${projectId || "*"}`;
}

function notifyWaiters(yakorId, projectId) {
  const keys = [waiterKey(yakorId, projectId), waiterKey(yakorId, "*")];
  for (const key of keys) {
    const list = waiters.get(key) || [];
    while (list.length) {
      const resolve = list.shift();
      try {
        resolve();
      } catch {
        /* ignore */
      }
    }
  }
}

function takePendingTasks(yakorId, projectId, limit = 10) {
  const now = new Date().toISOString();
  const out = [];
  for (const task of store.tasks) {
    if (task.yakor_id !== yakorId) continue;
    if (task.status !== "pending") continue;
    if (projectId && task.project_id && task.project_id !== projectId) continue;
    task.status = "delivered";
    task.delivered_at = now;
    out.push({
      id: task.id,
      tool: task.tool,
      params: task.params ?? {},
    });
    if (out.length >= limit) break;
  }
  if (out.length) saveStore(store);
  return out;
}

function requireAdmin(req, res, next) {
  const header = req.headers.authorization || "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  const alt = String(req.headers["x-yakor-token"] || req.query.token || "");
  if (bearer === ADMIN_TOKEN || alt === ADMIN_TOKEN) {
    next();
    return;
  }
  res.status(401).json({ error: "unauthorized" });
}

const upload = multer({ dest: UPLOAD_DIR });
const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "10mb" }));

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "yakor-agent-mock",
    pending: store.tasks.filter((t) => t.status === "pending").length,
    results: store.results.length,
  });
});

// --- Admin: enqueue / inspect ---

app.post("/api/yakors/:yakorId/admin/enqueue", requireAdmin, (req, res) => {
  const yakorId = req.params.yakorId;
  const body = req.body || {};
  const items = Array.isArray(body.tasks)
    ? body.tasks
    : Array.isArray(body)
      ? body
      : [body];

  const created = [];
  const now = new Date().toISOString();
  for (const item of items) {
    if (!item || !item.tool) continue;
    const task = {
      id: String(item.id || randomUUID()),
      yakor_id: yakorId,
      project_id: item.project_id ? String(item.project_id) : "",
      tool: String(item.tool),
      params: item.params ?? {},
      status: "pending",
      created_at: now,
      delivered_at: null,
    };
    store.tasks.push(task);
    created.push(task);
  }
  saveStore(store);
  for (const t of created) notifyWaiters(yakorId, t.project_id || "*");
  res.status(201).json({ ok: true, created });
});

app.get("/api/yakors/:yakorId/admin/queue", requireAdmin, (req, res) => {
  const yakorId = req.params.yakorId;
  const status = req.query.status ? String(req.query.status) : "";
  let tasks = store.tasks.filter((t) => t.yakor_id === yakorId);
  if (status) tasks = tasks.filter((t) => t.status === status);
  res.json({
    payload: tasks.slice().reverse(),
    count: tasks.length,
  });
});

app.get("/api/yakors/:yakorId/admin/results", requireAdmin, (req, res) => {
  const yakorId = req.params.yakorId;
  const since = req.query.since ? String(req.query.since) : "";
  let results = store.results.filter((r) => r.yakor_id === yakorId);
  if (since) results = results.filter((r) => r.received_at >= since);
  res.json({
    payload: results.slice().reverse(),
    count: results.length,
  });
});

app.post("/api/yakors/:yakorId/admin/reset", requireAdmin, (req, res) => {
  const yakorId = req.params.yakorId;
  const keepProjects = Boolean(req.body?.keep_projects);
  store.tasks = store.tasks.filter((t) => t.yakor_id !== yakorId);
  store.results = store.results.filter((r) => r.yakor_id !== yakorId);
  store.files = store.files.filter((f) => f.yakor_id !== yakorId);
  if (!keepProjects) {
    store.projects = store.projects.filter((p) => p.yakor_id !== yakorId);
  }
  saveStore(store);
  res.json({ ok: true });
});

// --- Yakor LongPoll ---

app.get("/api/yakors/:yakorId/tasks/", async (req, res) => {
  const yakorId = req.params.yakorId;
  const projectId = String(req.query.project_id || "");

  let payload = takePendingTasks(yakorId, projectId);
  if (payload.length === 0) {
    await new Promise((resolve) => {
      const key = waiterKey(yakorId, projectId || "*");
      const list = waiters.get(key) || [];
      list.push(resolve);
      waiters.set(key, list);
      setTimeout(resolve, LONGPOLL_MS);
    });
    payload = takePendingTasks(yakorId, projectId);
  }

  if (payload.length === 0) {
    res.status(204).end();
    return;
  }

  res.status(200).json({
    status: "OK",
    payload,
    pageInfo: { count: payload.length },
  });
});

// --- Yakor results ---

function acceptResults(req, res) {
  const yakorId = req.params.yakorId;
  const body = req.body;
  const items = Array.isArray(body) ? body : body?.results || body?.payload || [];
  if (!Array.isArray(items)) {
    res.status(400).json({ error: "expected JSON array of results" });
    return;
  }

  const now = new Date().toISOString();
  const saved = [];
  for (const item of items) {
    const record = {
      yakor_id: yakorId,
      db_id: String(req.query.db_id || item?.db_id || ""),
      task_id: String(item?.task_id || item?.id || ""),
      status: item?.status === "done" || item?.status === "error" ? item.status : "error",
      result: item?.result ?? null,
      error: item?.error ?? null,
      log: item?.log ?? null,
      raw: item,
      received_at: now,
    };
    store.results.push(record);

    const task = store.tasks.find(
      (t) => t.yakor_id === yakorId && t.id === record.task_id
    );
    if (task) {
      task.status = record.status === "done" ? "done" : "error";
      task.finished_at = now;
    }
    saved.push(record);
  }
  saveStore(store);
  res.status(200).json({ ok: true, accepted: saved.length });
}

app.post("/api/yakors/:yakorId/tasks/results", acceptResults);
app.post("/api/yakors/:yakorId/tasks/results/", acceptResults);

// --- Projects stub ---

app.post("/api/yakors/:yakorId/projects/", (req, res) => {
  const yakorId = req.params.yakorId;
  const name = String(req.body?.name || "unnamed");
  const description = String(req.body?.description || "");
  const dbId = String(req.body?.db_id || req.query.db_id || "");
  const project = {
    yakor_id: yakorId,
    project_id: randomUUID(),
    db_id: dbId,
    name,
    description,
    repo_url: DEFAULT_REPO,
    branch: DEFAULT_BRANCH,
    created_at: new Date().toISOString(),
  };
  store.projects.push(project);
  saveStore(store);
  res.status(201).json({
    project_id: project.project_id,
    repo_url: project.repo_url,
    branch: project.branch,
    name: project.name,
  });
});

app.get("/api/yakors/:yakorId/projects/", (req, res) => {
  const yakorId = req.params.yakorId;
  const dbId = req.query.db_id ? String(req.query.db_id) : "";
  let list = store.projects.filter((p) => p.yakor_id === yakorId);
  if (dbId) list = list.filter((p) => !p.db_id || p.db_id === dbId);
  res.json({
    status: "OK",
    payload: list.map((p) => ({
      project_id: p.project_id,
      name: p.name,
      description: p.description,
      repo_url: p.repo_url,
      branch: p.branch,
    })),
  });
});

// --- Files stub ---

app.post(
  "/api/yakors/:yakorId/files/",
  upload.single("file"),
  (req, res) => {
    const yakorId = req.params.yakorId;
    const meta = {
      yakor_id: yakorId,
      db_id: String(req.query.db_id || ""),
      project_id: String(req.query.project_id || req.body?.project_id || ""),
      originalname: req.file?.originalname || "",
      filename: req.file?.filename || "",
      size: req.file?.size || 0,
      path: req.file?.path || "",
      received_at: new Date().toISOString(),
    };
    store.files.push(meta);
    saveStore(store);
    res.status(200).json({ ok: true, file: meta });
  }
);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: String(err?.message || err) });
});

app.listen(PORT, HOST, () => {
  console.log(
    `[yakor-agent] http://${HOST}:${PORT} token=${ADMIN_TOKEN ? "set" : "missing"} data=${DATA_DIR}`
  );
});
