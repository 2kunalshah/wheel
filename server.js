const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const PORT = Number(process.env.PORT || 8080);
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "data", "leads");

fs.mkdirSync(DATA_DIR, { recursive: true });

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

function safeFranchiseId(value) {
  const id = String(value || "default")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return id || "default";
}

function leadsPath(franchiseId) {
  return path.join(DATA_DIR, `${safeFranchiseId(franchiseId)}.json`);
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
  relPath = decodeURIComponent(relPath);
  const filePath = path.join(ROOT, relPath);

  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
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

server.listen(PORT, () => {
  console.log(`Spin wheel server running at http://localhost:${PORT}`);
  console.log(`Franchise lead files are stored in: ${DATA_DIR}`);
});
