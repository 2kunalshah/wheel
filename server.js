const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const PORT = Number(process.env.PORT || 8080);
const ROOT = __dirname;
const DATA_ROOT = process.env.DATA_ROOT || (process.env.RAILWAY_ENVIRONMENT ? "/app/data" : path.join(ROOT, "data"));
const LEADS_DIR = path.join(DATA_ROOT, "leads");
const CONFIGS_DIR = path.join(DATA_ROOT, "configs");

fs.mkdirSync(LEADS_DIR, { recursive: true });
fs.mkdirSync(CONFIGS_DIR, { recursive: true });

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".json": "application/json; charset=utf-8",
  ".ico": "image/x-icon",
};
const TEST_FRANCHISE_ID = "test-usa";
const TEST_FRANCHISE_NAME = "Test, USA";

function safeFranchiseId(value) {
  const id = String(value || "default")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return id || "default";
}

function leadsPath(franchiseId) {
  return path.join(LEADS_DIR, `${safeFranchiseId(franchiseId)}.json`);
}

function configPath(franchiseId) {
  return path.join(CONFIGS_DIR, `${safeFranchiseId(franchiseId)}.json`);
}

function readLeads(franchiseId) {
  const file = leadsPath(franchiseId);
  if (!fs.existsSync(file)) return [];
  try {
    const raw = fs.readFileSync(file, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

function writeLeads(franchiseId, leads) {
  const file = leadsPath(franchiseId);
  fs.writeFileSync(file, JSON.stringify(leads, null, 2));
}

function readConfig(franchiseId) {
  const file = configPath(franchiseId);
  if (!fs.existsSync(file)) return null;
  try {
    const raw = fs.readFileSync(file, "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch (e) {
    return null;
  }
}

function writeConfig(franchiseId, config) {
  const file = configPath(franchiseId);
  fs.writeFileSync(file, JSON.stringify(config, null, 2));
}

function deleteConfig(franchiseId) {
  const file = configPath(franchiseId);
  if (fs.existsSync(file)) fs.unlinkSync(file);
}

function deleteLeads(franchiseId) {
  const file = leadsPath(franchiseId);
  if (fs.existsSync(file)) fs.unlinkSync(file);
}

function listFranchiseIds() {
  const ids = new Set();
  [LEADS_DIR, CONFIGS_DIR].forEach((dir) => {
    fs.readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .forEach((entry) => ids.add(safeFranchiseId(entry.name.replace(/\.json$/i, ""))));
  });
  if (!ids.size) ids.add("default");
  return Array.from(ids).sort();
}

function toCsv(rows) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const escape = (value) => {
    const s = value == null ? "" : String(value);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(",")];
  rows.forEach((row) => lines.push(headers.map((h) => escape(row[h])).join(",")));
  return lines.join("\n");
}

function ensureTestFranchise() {
  const existing = readConfig(TEST_FRANCHISE_ID) || {};
  const next = {
    ...existing,
    eventName: existing.eventName || "Unit Test Event",
    eventBadge: existing.eventBadge || "Unit Test Booth",
    headline: existing.headline || "Run Unit Tests",
    subheadline: existing.subheadline || "Automated verification flow",
    franchise: {
      ...(existing.franchise || {}),
      locationName: TEST_FRANCHISE_NAME,
      city: (existing.franchise && existing.franchise.city) || "Test",
      state: (existing.franchise && existing.franchise.state) || "USA",
    },
  };
  writeConfig(TEST_FRANCHISE_ID, next);
}

function testCatalog() {
  return [
    { id: "config_round_trip", name: "Config Round Trip", description: "Config updates persist and reload for test franchise." },
    { id: "lead_persists_prize", name: "Lead Stores Prize", description: "Lead records retain prize and participant fields." },
    { id: "csv_contains_columns", name: "CSV Columns", description: "CSV export includes event, contact, and prize columns." },
    { id: "franchise_isolation", name: "Franchise Isolation", description: "Writes in test franchise do not affect another franchise." },
  ];
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function runTestsForFranchise(franchiseId) {
  const id = safeFranchiseId(franchiseId || TEST_FRANCHISE_ID);
  const startedAt = new Date().toISOString();
  const results = [];

  const originalConfig = readConfig(id);
  const originalLeads = readLeads(id);
  const isolationId = "isolation-probe";
  const originalIsolationLeads = readLeads(isolationId);

  const run = (testId, fn) => {
    const t0 = Date.now();
    try {
      fn();
      results.push({ id: testId, status: "passed", durationMs: Date.now() - t0 });
    } catch (error) {
      results.push({ id: testId, status: "failed", durationMs: Date.now() - t0, error: error.message });
    }
  };

  try {
    ensureTestFranchise();

    run("config_round_trip", () => {
      const current = readConfig(id) || {};
      const updated = { ...current, eventName: "Unit Test Event Alpha", franchise: { ...(current.franchise || {}), locationName: TEST_FRANCHISE_NAME } };
      writeConfig(id, updated);
      const reloaded = readConfig(id);
      assert(reloaded && reloaded.eventName === "Unit Test Event Alpha", "eventName did not persist for test franchise");
      assert(reloaded && reloaded.franchise && reloaded.franchise.locationName === TEST_FRANCHISE_NAME, "franchise name did not persist");
    });

    run("lead_persists_prize", () => {
      const lead = {
        id: `unit_${Date.now()}`,
        capturedAt: new Date().toISOString(),
        franchiseId: id,
        eventName: "Unit Test Event Alpha",
        name: "Unit Tester",
        phone: "5551112222",
        email: "unit@test.example",
        prizeId: "unit_prize",
        prizeName: "Unit Prize",
        wonPrizeName: "Unit Prize",
      };
      writeLeads(id, [lead]);
      const [saved] = readLeads(id);
      assert(saved && saved.name === "Unit Tester", "participant name not persisted");
      assert(saved && (saved.wonPrizeName || saved.prizeName) === "Unit Prize", "prize name not persisted");
    });

    run("csv_contains_columns", () => {
      const csv = toCsv(readLeads(id));
      assert(csv.includes("eventName"), "CSV missing eventName column");
      assert(csv.includes("email"), "CSV missing email column");
      assert(csv.includes("wonPrizeName") || csv.includes("prizeName"), "CSV missing prize column");
    });

    run("franchise_isolation", () => {
      writeLeads(isolationId, [{ id: "iso", name: "Iso User" }]);
      const testLeads = readLeads(id);
      const isolationLeads = readLeads(isolationId);
      assert(testLeads.length === 1, "test franchise lead count changed unexpectedly");
      assert(isolationLeads.length === 1, "isolation lead write failed");
      assert(testLeads[0].id !== isolationLeads[0].id, "franchise data leakage detected");
    });
  } finally {
    if (originalConfig) writeConfig(id, originalConfig);
    else deleteConfig(id);
    if (Array.isArray(originalLeads) && originalLeads.length) writeLeads(id, originalLeads);
    else deleteLeads(id);
    if (Array.isArray(originalIsolationLeads) && originalIsolationLeads.length) writeLeads(isolationId, originalIsolationLeads);
    else deleteLeads(isolationId);
  }

  const passed = results.filter((r) => r.status === "passed").length;
  return {
    franchiseId: id,
    startedAt,
    finishedAt: new Date().toISOString(),
    total: results.length,
    passed,
    failed: results.length - passed,
    results,
  };
}

function sendJson(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 2 * 1024 * 1024) {
        reject(new Error("Request body too large"));
      }
    });
    req.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch (e) {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

function serveStatic(req, res, pathname) {
  let relPath = pathname === "/" ? "/index.html" : pathname;
  if (relPath === "/admin") relPath = "/admin.html";
  if (relPath === "/player") relPath = "/index.html";
  relPath = decodeURIComponent(relPath);
  const safeRelPath = relPath.replace(/^\/+/, "");
  let filePath = path.join(ROOT, safeRelPath);

  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  if (!path.extname(filePath)) {
    const htmlCandidate = `${filePath}.html`;
    if (fs.existsSync(htmlCandidate)) {
      filePath = htmlCandidate;
    }
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const type = MIME_TYPES[ext] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": type });
    fs.createReadStream(filePath).pipe(res);
  });
}

async function handleApi(req, res, url) {
  if (url.pathname === "/api/tests" && req.method === "GET") {
    ensureTestFranchise();
    sendJson(res, 200, {
      franchiseId: TEST_FRANCHISE_ID,
      franchiseName: TEST_FRANCHISE_NAME,
      tests: testCatalog(),
    });
    return true;
  }

  if (url.pathname === "/api/tests/run" && req.method === "POST") {
    try {
      const payload = await readJsonBody(req);
      const franchiseId = safeFranchiseId((payload && payload.franchiseId) || TEST_FRANCHISE_ID);
      const report = runTestsForFranchise(franchiseId);
      sendJson(res, 200, report);
    } catch (e) {
      sendJson(res, 500, { error: e.message });
    }
    return true;
  }

  if (url.pathname === "/api/franchises" && req.method === "GET") {
    sendJson(res, 200, { franchises: listFranchiseIds() });
    return true;
  }

  if (url.pathname === "/api/franchises" && req.method === "POST") {
    try {
      const payload = await readJsonBody(req);
      const franchiseId = safeFranchiseId(payload.franchiseId);
      const existing = readConfig(franchiseId);
      if (existing) {
        sendJson(res, 409, { error: "Franchise already exists", franchiseId });
        return true;
      }
      writeConfig(franchiseId, payload.baseConfig && typeof payload.baseConfig === "object" ? payload.baseConfig : {});
      sendJson(res, 201, { ok: true, franchiseId });
      return true;
    } catch (e) {
      sendJson(res, 400, { error: e.message });
      return true;
    }
  }

  if (url.pathname === "/api/config" && req.method === "GET") {
    const franchiseId = safeFranchiseId(url.searchParams.get("franchise"));
    const config = readConfig(franchiseId);
    sendJson(res, 200, { franchiseId, config });
    return true;
  }

  if (url.pathname === "/api/config" && req.method === "PUT") {
    try {
      const payload = await readJsonBody(req);
      const franchiseId = safeFranchiseId(payload.franchiseId);
      if (!payload.config || typeof payload.config !== "object") {
        sendJson(res, 400, { error: "Missing config object" });
        return true;
      }
      writeConfig(franchiseId, payload.config);
      sendJson(res, 200, { ok: true, franchiseId });
      return true;
    } catch (e) {
      sendJson(res, 400, { error: e.message });
      return true;
    }
  }

  if (url.pathname === "/api/leads" && req.method === "GET") {
    const franchiseId = safeFranchiseId(url.searchParams.get("franchise"));
    const leads = readLeads(franchiseId);
    sendJson(res, 200, { franchiseId, count: leads.length, leads });
    return true;
  }

  if (url.pathname === "/api/leads" && req.method === "POST") {
    try {
      const payload = await readJsonBody(req);
      const franchiseId = safeFranchiseId(payload.franchiseId);
      const lead = payload.lead;
      if (!lead || typeof lead !== "object") {
        sendJson(res, 400, { error: "Missing lead object" });
        return true;
      }

      const leads = readLeads(franchiseId);
      leads.push(lead);
      writeLeads(franchiseId, leads);
      sendJson(res, 201, { ok: true, franchiseId, count: leads.length });
      return true;
    } catch (e) {
      sendJson(res, 400, { error: e.message });
      return true;
    }
  }

  if (url.pathname === "/api/leads" && req.method === "DELETE") {
    const franchiseId = safeFranchiseId(url.searchParams.get("franchise"));
    writeLeads(franchiseId, []);
    sendJson(res, 200, { ok: true, franchiseId, count: 0 });
    return true;
  }

  if (url.pathname === "/api/leads/download" && req.method === "GET") {
    const franchiseId = safeFranchiseId(url.searchParams.get("franchise"));
    const format = String(url.searchParams.get("format") || "csv").toLowerCase();
    const leads = readLeads(franchiseId);
    const date = new Date().toISOString().slice(0, 10);

    if (format === "json") {
      const filename = `trade-show-leads-${franchiseId}-${date}.json`;
      res.writeHead(200, {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename=\"${filename}\"`,
      });
      res.end(JSON.stringify(leads, null, 2));
      return true;
    }

    const csv = toCsv(leads);
    const filename = `trade-show-leads-${franchiseId}-${date}.csv`;
    res.writeHead(200, {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename=\"${filename}\"`,
    });
    res.end(csv);
    return true;
  }

  return false;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname.startsWith("/api/")) {
    const handled = await handleApi(req, res, url);
    if (!handled) {
      sendJson(res, 404, { error: "API endpoint not found" });
    }
    return;
  }

  serveStatic(req, res, url.pathname);
});

ensureTestFranchise();

server.listen(PORT, () => {
  console.log(`Spin wheel server running at http://localhost:${PORT}`);
  console.log(`Franchise lead files are stored in: ${LEADS_DIR}`);
  console.log(`Franchise config files are stored in: ${CONFIGS_DIR}`);
  console.log(`Unit test franchise ready: ${TEST_FRANCHISE_NAME} (${TEST_FRANCHISE_ID})`);
});
