/**
 * server.js
 * Self-contained Node backend for the password manager demo.
 *
 * Why this is not "real Express":
 * - Your environment does not have `npm`/`express` available right now.
 * - This file keeps the same API contract (same routes + CORS + JSON),
 *   so your frontend + extension can connect on port 3000.
 */

const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const PORT = 3000;
const WEB_DIR = path.join(__dirname, "..", "web");

// In-memory storage for demo purposes.
const accounts = [];

/**
 * Normalize URL so duplicate checks are consistent.
 * We compare by hostname only (lowercase, no www, no path).
 */
function normalizeUrl(rawUrl) {
  const raw = (rawUrl || "").trim().toLowerCase();
  if (!raw) {
    return "";
  }

  try {
    const withScheme = /^https?:\/\//i.test(raw) ? raw : "https://" + raw;
    const parsed = new URL(withScheme);
    return parsed.hostname.replace(/^www\./, "");
  } catch (e) {
    return raw
      .replace(/^https?:\/\//i, "")
      .replace(/^www\./i, "")
      .split(/[/?#]/)[0];
  }
}

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function sendJson(res, statusCode, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
  });
  res.end(body);
}

function contentTypeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".html") return "text/html; charset=utf-8";
  if (ext === ".css") return "text/css; charset=utf-8";
  if (ext === ".js") return "text/javascript; charset=utf-8";
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".svg") return "image/svg+xml";
  return "application/octet-stream";
}

function readJsonBody(req, maxBytes) {
  return new Promise(function (resolve, reject) {
    let raw = "";
    let total = 0;

    req.on("data", function (chunk) {
      total += chunk.length;
      if (total > maxBytes) {
        reject(new Error("Request body too large"));
        req.destroy();
        return;
      }
      raw += chunk;
    });

    req.on("end", function () {
      if (!raw) {
        resolve(null);
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (e) {
        reject(new Error("Invalid JSON"));
      }
    });

    req.on("error", reject);
  });
}

const server = http.createServer(async function (req, res) {
  setCors(res);

  // Handle CORS preflight.
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const fullUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = fullUrl.pathname;

  // Health check for debugging.
  if (req.method === "GET" && pathname === "/health") {
    sendJson(res, 200, { ok: true, port: PORT });
    return;
  }

  // Routes required by your frontend.
  if (req.method === "GET" && pathname === "/accounts") {
    sendJson(res, 200, accounts);
    return;
  }

  if (req.method === "POST" && pathname === "/save-account") {
    try {
      const body = await readJsonBody(req, 1_000_000);
      const { siteName, websiteUrl, username, encryptedPassword } = body || {};

      // Allow empty username (some sites don't expose it clearly),
      // but require the other fields.
      if (!siteName || !websiteUrl || username == null || !encryptedPassword) {
        sendJson(res, 400, {
          message:
            "Missing required fields: siteName, websiteUrl, username, encryptedPassword",
        });
        return;
      }

      const normalizedWebsite = normalizeUrl(websiteUrl);
      if (!normalizedWebsite) {
        sendJson(res, 400, { message: "Invalid websiteUrl." });
        return;
      }

      const newAccount = {
        id: Date.now().toString(),
        siteName,
        websiteUrl,
        username,
        encryptedPassword,
        normalizedWebsite,
      };

      // Duplicate logic: keep only one account per normalized website.
      const existingIndex = accounts.findIndex(function (a) {
        // Works for old records (without normalizedWebsite) and new records.
        const existingNormalized = a.normalizedWebsite || normalizeUrl(a.websiteUrl);
        return existingNormalized === normalizedWebsite;
      });

      if (existingIndex >= 0) {
        // Replace old account with new one for same site.
        accounts[existingIndex] = newAccount;
        sendJson(res, 200, {
          message: "Duplicate site found. Old account replaced.",
          account: newAccount,
        });
      } else {
        accounts.push(newAccount);
        sendJson(res, 201, { message: "Account saved.", account: newAccount });
      }
    } catch (e) {
      sendJson(res, 400, { message: e && e.message ? e.message : "Bad request." });
    }
    return;
  }

  // Serve the dashboard from / (and its static assets).
  if (req.method === "GET") {
    // Default to index.html
    const filePath =
      pathname === "/"
        ? path.join(WEB_DIR, "index.html")
        : path.join(WEB_DIR, pathname);

    // Basic protection: prevent path traversal.
    if (!filePath.startsWith(WEB_DIR)) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }

    fs.readFile(filePath, function (err, data) {
      if (err) {
        // If a specific file doesn't exist, fall back to index.html (helps during dev).
        if (pathname !== "/") {
          const fallback = path.join(WEB_DIR, "index.html");
          fs.readFile(fallback, function (err2, data2) {
            if (err2) {
              res.writeHead(404);
              res.end("Not found");
              return;
            }
            res.writeHead(200, { "Content-Type": contentTypeFor(fallback) });
            res.end(data2);
            return;
          });
        } else {
          res.writeHead(404);
          res.end("Not found");
        }
        return;
      }

      res.writeHead(200, { "Content-Type": contentTypeFor(filePath) });
      res.end(data);
    });

    return;
  }

  res.writeHead(404);
  res.end("Not found");
});

server.listen(PORT, function () {
  console.log("Backend running on http://localhost:" + PORT);
});
