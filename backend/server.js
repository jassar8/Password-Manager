/**
 * backend/server.js
 * Express server for the password manager demo.
 *
 * - Listens on http://localhost:3000
 * - GET  /accounts      — returns saved accounts (JSON array)
 * - POST /save-account  — saves or replaces an account (JSON body)
 * - Serves the web dashboard from the /web folder
 */

const express = require("express");
const cors = require("cors");
const path = require("path");
const { URL } = require("url");

const PORT = 3000;
const WEB_DIR = path.join(__dirname, "..", "web");

// In-memory storage for demo purposes (data resets when the server stops).
const accounts = [];

const app = express();

// Allow the web dashboard and Chrome extension to call this API from other origins.
app.use(cors());

// Parse JSON request bodies (same idea as express.json() — required for POST /save-account).
app.use(express.json({ limit: "1mb" }));

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

// Health check for debugging.
app.get("/health", function (req, res) {
  res.json({ ok: true, port: PORT });
});

app.get("/accounts", function (req, res) {
  console.log("accounts loaded — sending " + accounts.length + " account(s) to client");
  res.json(accounts);
});

app.post("/save-account", function (req, res) {
  const body = req.body || {};
  const { siteName, websiteUrl, username, encryptedPassword } = body;

  // Allow empty username (some sites don't expose it clearly),
  // but require the other fields.
  if (!siteName || !websiteUrl || username == null || !encryptedPassword) {
    return res.status(400).json({
      message:
        "Missing required fields: siteName, websiteUrl, username, encryptedPassword",
    });
  }

  const normalizedWebsite = normalizeUrl(websiteUrl);
  if (!normalizedWebsite) {
    return res.status(400).json({ message: "Invalid websiteUrl." });
  }

  const newAccount = {
    id: Date.now().toString(),
    siteName,
    websiteUrl,
    username,
    encryptedPassword,
    normalizedWebsite,
  };

  const existingIndex = accounts.findIndex(function (a) {
    const existingNormalized = a.normalizedWebsite || normalizeUrl(a.websiteUrl);
    return existingNormalized === normalizedWebsite;
  });

  if (existingIndex >= 0) {
    accounts[existingIndex] = newAccount;
    console.log("account saved — replaced duplicate for " + siteName);
    return res.status(200).json({
      message: "Duplicate site found. Old account replaced.",
      account: newAccount,
    });
  }

  accounts.push(newAccount);
  console.log("account saved — " + siteName + " (" + normalizedWebsite + ")");
  return res.status(201).json({ message: "Account saved.", account: newAccount });
});

// Serve the dashboard (index.html, script.js, style.css, …).
app.use(express.static(WEB_DIR));

// Helpful error when POST body is not valid JSON (express.json() failed to parse).
app.use(function (err, req, res, next) {
  if (err instanceof SyntaxError) {
    return res.status(400).json({ message: "Invalid JSON in request body." });
  }
  console.error(err);
  return res.status(500).json({ message: "Server error." });
});

app.listen(PORT, function () {
  console.log("backend started — http://localhost:" + PORT);
  console.log("Open the dashboard at http://localhost:" + PORT + "/");
});
