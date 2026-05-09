/**
 * Password Manager — offline web app (no server, no fetch).
 * Open index.html in your browser; data is stored in localStorage.
 *
 * Git branch: feature/harder-to-steal-derived-key (safer teaching build).
 * Site passwords are encrypted with a key derived (PBKDF2 + salt) from the master
 * password after login. Only the salt is stored in localStorage — no hardcoded XOR
 * key in this file. Compare with branch main for the intentionally weak XOR demo.
 * Same UI and features as main; only encryption key handling differs.
 */

// --- Keys for localStorage (change only if you want a fresh empty app) ---
const LS_USERS = "pm_web_users_v1";
const LS_ACCOUNTS = "pm_web_accounts_map_v1";
const LS_SESSION = "pm_web_session_v1";
const LS_THEME = "pm_web_theme_v1";
const KDF_ITERATIONS = 210000;
const KDF_HASH = "SHA-256";
const ENCRYPTED_PREFIX_V2 = "v2:";

// --- Page elements ---
const authSection = document.getElementById("authSection");
const appSection = document.getElementById("appSection");
const loginBlock = document.getElementById("loginBlock");
const signupBlock = document.getElementById("signupBlock");
const authMessage = document.getElementById("authMessage");
const sessionUserEl = document.getElementById("sessionUser");
const loginForm = document.getElementById("loginForm");
const signupForm = document.getElementById("signupForm");
const loginPass = document.getElementById("loginPass");
const signupPass = document.getElementById("signupPass");
const signupPass2 = document.getElementById("signupPass2");
const toggleLoginPass = document.getElementById("toggleLoginPass");
const toggleSignupPass = document.getElementById("toggleSignupPass");
const toggleSignupPass2 = document.getElementById("toggleSignupPass2");
const goSignup = document.getElementById("goSignup");
const goLogin = document.getElementById("goLogin");
const logoutBtn = document.getElementById("logoutBtn");
const themeToggleBtn = document.getElementById("themeToggleBtn");
const toggleChangeMasterBtn = document.getElementById("toggleChangeMasterBtn");
const changeMasterForm = document.getElementById("changeMasterForm");
const currentMasterPass = document.getElementById("currentMasterPass");
const newMasterPass = document.getElementById("newMasterPass");
const confirmMasterPass = document.getElementById("confirmMasterPass");
const toggleCurrentMasterPass = document.getElementById("toggleCurrentMasterPass");
const toggleNewMasterPass = document.getElementById("toggleNewMasterPass");
const toggleConfirmMasterPass = document.getElementById("toggleConfirmMasterPass");
const changeMasterMessage = document.getElementById("changeMasterMessage");
const addAccountForm = document.getElementById("addAccountForm");
const simulateLoginForm = document.getElementById("simulateLoginForm");
const simulateSiteSelect = document.getElementById("simulateSiteSelect");
const simulateUser = document.getElementById("simulateUser");
const simulatePass = document.getElementById("simulatePass");
const toggleSimulatePass = document.getElementById("toggleSimulatePass");
const simulateMessage = document.getElementById("simulateMessage");
const refreshBtn = document.getElementById("refreshBtn");
const exportCsvBtn = document.getElementById("exportCsvBtn");
const statusText = document.getElementById("statusText");
const noResultsText = document.getElementById("noResultsText");
const accountsList = document.getElementById("accountsList");
const accountSearchInput = document.getElementById("accountSearchInput");
const addSiteName = document.getElementById("addSiteName");
const addWebsiteUrl = document.getElementById("addWebsiteUrl");
const addAccountUser = document.getElementById("addAccountUser");
const addAccountPass = document.getElementById("addAccountPass");
const toggleAddPass = document.getElementById("toggleAddPass");
const btnGeneratePass = document.getElementById("btnGeneratePass");
const btnFillGenerated = document.getElementById("btnFillGenerated");
const generatedPassPreview = document.getElementById("generatedPassPreview");
const editAccountModal = document.getElementById("editAccountModal");
const editAccountForm = document.getElementById("editAccountForm");
const editSiteName = document.getElementById("editSiteName");
const editWebsiteUrl = document.getElementById("editWebsiteUrl");
const editAccountUser = document.getElementById("editAccountUser");
const editAccountPass = document.getElementById("editAccountPass");
const toggleEditPass = document.getElementById("toggleEditPass");
const btnEditGeneratePass = document.getElementById("btnEditGeneratePass");
const editGeneratedPreview = document.getElementById("editGeneratedPreview");
const btnEditCancel = document.getElementById("btnEditCancel");
const btnEditModalClose = document.getElementById("btnEditModalClose");

// Stores the currently logged-in username in memory while the page is open.
let currentUsername = null;
// Derived site-password encryption key (PBKDF2 output) — exists only in RAM for this tab
// session after a successful login. It is NOT written to localStorage and NOT embedded
// in script.js, so a thief who only copies your repo or localStorage still lacks the
// secret that actually decrypts saved site passwords (they need your master password too).
let activeEncryptionKeyBytes = null;
// Stores the last generated strong password so user can reuse it quickly.
let lastGeneratedPassword = "";
// Which account id is open in the edit modal (null when modal is closed).
let editingAccountId = null;

// Known website icons for common services. Falls back to globe when unknown.
const KNOWN_SITE_ICONS = {
  google: "G",
  facebook: "f",
  amazon: "a",
  github: "{}",
  youtube: "▶",
  netflix: "N",
};

// --- Small UI helpers ---
// Generic message helper used by all feedback areas (auth, status, simulate, settings).
// It also adds a success/error CSS class so UI colors are consistent.
function setMessageState(element, text, isError) {
  element.textContent = text || "";
  element.classList.remove("success", "error");
  if (!text) {
    return;
  }
  element.classList.add(isError ? "error" : "success");
}

function setAuthMessage(text, isError) {
  setMessageState(authMessage, text, isError);
}

function setStatus(message, isError) {
  setMessageState(statusText, message, isError);
}

function setSimulateMessage(message, isError) {
  setMessageState(simulateMessage, message, isError);
}

function setChangeMasterMessage(message, isError) {
  setMessageState(changeMasterMessage, message, isError);
}

// --- Theme helpers (light/dark) ---
function getSavedTheme() {
  const savedTheme = localStorage.getItem(LS_THEME);
  return savedTheme === "dark" ? "dark" : "light";
}

function applyTheme(theme) {
  const isDark = theme === "dark";
  document.body.classList.toggle("theme-dark", isDark);
  if (themeToggleBtn) {
    themeToggleBtn.textContent = isDark ? "Light Mode" : "Dark Mode";
    themeToggleBtn.setAttribute("aria-pressed", isDark ? "true" : "false");
  }
}

function saveTheme(theme) {
  localStorage.setItem(LS_THEME, theme === "dark" ? "dark" : "light");
}

function toggleTheme() {
  const nextTheme = document.body.classList.contains("theme-dark") ? "light" : "dark";
  saveTheme(nextTheme);
  applyTheme(nextTheme);
}

function getPasswordStrengthInfo(password) {
  const value = String(password || "");
  const checks = {
    hasUppercase: /[A-Z]/.test(value),
    hasLowercase: /[a-z]/.test(value),
    hasNumber: /[0-9]/.test(value),
    hasSymbol: /[^A-Za-z0-9]/.test(value),
    hasLength: value.length >= 8,
  };
  const score = Object.values(checks).filter(Boolean).length;

  if (!value) {
    return { label: "", level: "none", checks: checks };
  }
  if (score === 5) {
    return { label: "Strong", level: "strong", checks: checks };
  }
  if (score >= 3) {
    return { label: "Medium", level: "medium", checks: checks };
  }
  return { label: "Weak", level: "weak", checks: checks };
}

function createPasswordStrengthMeter(input) {
  if (!input) {
    return;
  }

  const meter = document.createElement("p");
  meter.className = "password-strength";
  meter.setAttribute("aria-live", "polite");

  const updateMeter = function () {
    const info = getPasswordStrengthInfo(input.value);
    meter.textContent = info.label ? "Strength: " + info.label : "";
    meter.classList.remove("weak", "medium", "strong");
    if (info.level !== "none") {
      meter.classList.add(info.level);
    }
  };

  const targetContainer = input.closest(".password-field-row") || input.parentElement;
  targetContainer.insertAdjacentElement("afterend", meter);
  input.addEventListener("input", updateMeter);
  updateMeter();
}

function resetChangeMasterPasswordVisibility() {
  currentMasterPass.type = "password";
  newMasterPass.type = "password";
  confirmMasterPass.type = "password";
  toggleCurrentMasterPass.textContent = "Show";
  toggleCurrentMasterPass.setAttribute("aria-pressed", "false");
  toggleCurrentMasterPass.setAttribute("aria-label", "Show password");
  toggleNewMasterPass.textContent = "Show";
  toggleNewMasterPass.setAttribute("aria-pressed", "false");
  toggleNewMasterPass.setAttribute("aria-label", "Show password");
  toggleConfirmMasterPass.textContent = "Show";
  toggleConfirmMasterPass.setAttribute("aria-pressed", "false");
  toggleConfirmMasterPass.setAttribute("aria-label", "Show password");
}

// --- localStorage read/write (JSON) ---
// Read and parse JSON from localStorage safely.
// If key does not exist OR parsing fails, return fallback value.
function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      return fallback;
    }
    return JSON.parse(raw);
  } catch (e) {
    return fallback;
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

// --- Users (sign up / log in) ---
// Convert master password to a deterministic hash string.
// IMPORTANT:
// - This is a simple demo hash (DJB2-style with XOR), not a modern secure password hash.
// - We include normalized username in the hash input, so same password on different users
//   produces a different final hash.
function hashMasterPassword(username, password) {
  // 1) Normalize username so "Ali" and "ali" behave the same.
  const key = String(username).trim().toLowerCase();
  // 2) Build one input string that includes username + separator + password.
  //    '\0' helps avoid accidental collisions like ("ab","c") vs ("a","bc").
  const s = key + "\0" + password;
  // 3) Start with seed number used by DJB2 family hashes.
  var h = 5381;
  // 4) For each character, update hash using bit operations.
  for (var i = 0; i < s.length; i++) {
    h = ((h << 5) + h) ^ s.charCodeAt(i);
    // Force 32-bit signed integer range.
    h |= 0;
  }
  // 5) Convert to unsigned hex and prefix with username key.
  return key + ":" + (h >>> 0).toString(16);
}

function getUsers() {
  const list = readJson(LS_USERS, []);
  return Array.isArray(list) ? list : [];
}

function saveUsers(users) {
  writeJson(LS_USERS, users);
}

function findUserIndexByUsername(users, username) {
  const normalized = String(username || "").trim().toLowerCase();
  return users.findIndex(function (u) {
    return (u.username || "").toLowerCase() === normalized;
  });
}

// --- Session (remember who is logged in after refresh) ---
function getSession() {
  const u = readJson(LS_SESSION, null);
  return u && typeof u.username === "string" ? u.username.trim() : null;
}

function setSession(username) {
  if (!username) {
    localStorage.removeItem(LS_SESSION);
    return;
  }
  writeJson(LS_SESSION, { username: username });
}

// --- Saved site accounts (per user, keyed by lowercase username) ---
function getAccountsMap() {
  const map = readJson(LS_ACCOUNTS, {});
  return map && typeof map === "object" ? map : {};
}

function saveAccountsMap(map) {
  writeJson(LS_ACCOUNTS, map);
}

function getAccountsForUser(username) {
  const map = getAccountsMap();
  const key = String(username).trim().toLowerCase();
  const list = map[key];
  return Array.isArray(list) ? list.slice() : [];
}

function setAccountsForUser(username, accounts) {
  const map = getAccountsMap();
  const key = String(username).trim().toLowerCase();
  map[key] = accounts;
  saveAccountsMap(map);
}

// --- Key derivation + encryption helpers (harder-to-steal than a hardcoded XOR key) ---
// Why this is harder for an attacker to "steal the key":
// - There is no single secret byte string in source code that unlocks every vault. The
//   encryption key is computed from (master password + per-user salt) at login time.
// - Only the salt (and a separate login hash) persist in localStorage — not the key.
//   Guessing the key from storage alone is not enough; offline guessing targets the
//   master password through slow PBKDF2 (many iterations, SHA-256).
// - Even with this file and a localStorage dump, ciphertext stays opaque without the
//   correct master password to re-derive the same key (contrast: branch main's XOR_KEY).
// Site passwords are still XOR'd with the derived bytes here (teaching XOR); production
// apps would use AES-GCM or similar. Log out to clear the in-memory key.
function bytesToBase64(bytes) {
  var binary = "";
  for (var i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBytes(base64Text) {
  const binary = atob(base64Text);
  const out = new Uint8Array(binary.length);
  for (var i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

function generateRandomSaltBase64() {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  return bytesToBase64(salt);
}

async function deriveEncryptionKeyBytes(masterPassword, saltBase64) {
  const encoder = new TextEncoder();
  const saltBytes = base64ToBytes(saltBase64);
  const passwordKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(masterPassword),
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: KDF_HASH,
      salt: saltBytes,
      iterations: KDF_ITERATIONS,
    },
    passwordKey,
    256
  );
  return new Uint8Array(bits);
}

function xorBytes(inputBytes, keyBytes) {
  const out = new Uint8Array(inputBytes.length);
  for (var i = 0; i < inputBytes.length; i++) {
    out[i] = inputBytes[i] ^ keyBytes[i % keyBytes.length];
  }
  return out;
}

function encryptPassword(plainText) {
  if (!plainText) {
    return "";
  }
  if (!activeEncryptionKeyBytes || !activeEncryptionKeyBytes.length) {
    throw new Error("Encryption key is not active in memory.");
  }
  const plainBytes = new TextEncoder().encode(plainText);
  const encryptedBytes = xorBytes(plainBytes, activeEncryptionKeyBytes);
  return ENCRYPTED_PREFIX_V2 + bytesToBase64(encryptedBytes);
}

function decryptPassword(storedValue) {
  const encryptedText = storedValue || "";
  if (!encryptedText) {
    return "";
  }
  if (encryptedText.indexOf(ENCRYPTED_PREFIX_V2) === 0) {
    if (!activeEncryptionKeyBytes || !activeEncryptionKeyBytes.length) {
      throw new Error("Decryption key is not active in memory.");
    }
    const payload = encryptedText.slice(ENCRYPTED_PREFIX_V2.length);
    const encryptedBytes = base64ToBytes(payload);
    const plainBytes = xorBytes(encryptedBytes, activeEncryptionKeyBytes);
    return new TextDecoder().decode(plainBytes);
  }
  return "";
}

// --- Strong password: 8+, lower, upper, digit, symbol ---
// Returns true only if password matches all required strength rules.
function isStrongPassword(password) {
  if (!password || password.length < 8) {
    return false;
  }
  var hasLower = false;
  var hasUpper = false;
  var hasNumber = false;
  var hasSymbol = false;
  for (var i = 0; i < password.length; i++) {
    var c = password[i];
    if (c >= "a" && c <= "z") {
      hasLower = true;
    } else if (c >= "A" && c <= "Z") {
      hasUpper = true;
    } else if (c >= "0" && c <= "9") {
      hasNumber = true;
    } else {
      hasSymbol = true;
    }
  }
  return hasLower && hasUpper && hasNumber && hasSymbol;
}

function generateStrongPassword() {
  // Build from character groups so we can guarantee rule coverage.
  var lower = "abcdefghijklmnopqrstuvwxyz";
  var upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  var numbers = "0123456789";
  var symbols = "!@#$%^&*()_+-=[]{}|;:,.<>?";
  var all = lower + upper + numbers + symbols;
  var targetLength = 14;
  var chars = [];
  // Guarantee at least one character from each required group.
  chars.push(lower[Math.floor(Math.random() * lower.length)]);
  chars.push(upper[Math.floor(Math.random() * upper.length)]);
  chars.push(numbers[Math.floor(Math.random() * numbers.length)]);
  chars.push(symbols[Math.floor(Math.random() * symbols.length)]);
  while (chars.length < targetLength) {
    chars.push(all[Math.floor(Math.random() * all.length)]);
  }
  // Shuffle so guaranteed characters are not always in first positions.
  for (var i = chars.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var temp = chars[i];
    chars[i] = chars[j];
    chars[j] = temp;
  }
  return chars.join("");
}

function getDemoAccountTemplates() {
  return [
    { siteName: "Google", websiteUrl: "https://www.google.com", username: "user01" },
    { siteName: "Facebook", websiteUrl: "https://www.facebook.com", username: "jassar123" },
    { siteName: "Amazon", websiteUrl: "https://www.amazon.com", username: "demoUser" },
    { siteName: "Instagram", websiteUrl: "https://www.instagram.com", username: "insta_user" },
    { siteName: "Twitter (X)", websiteUrl: "https://www.twitter.com", username: "x_user_99" },
    { siteName: "YouTube", websiteUrl: "https://www.youtube.com", username: "watcher01" },
    { siteName: "Netflix", websiteUrl: "https://www.netflix.com", username: "streamfan" },
    { siteName: "LinkedIn", websiteUrl: "https://www.linkedin.com", username: "career.pro" },
    { siteName: "GitHub", websiteUrl: "https://www.github.com", username: "codepilot" },
    { siteName: "Microsoft", websiteUrl: "https://www.microsoft.com", username: "ms_user10" },
  ];
}

function createDemoAccount(template, idx) {
  const plainPassword = generateStrongPassword();
  return {
    id: "demo-" + Date.now().toString() + "-" + (idx + 1),
    siteName: template.siteName,
    websiteUrl: template.websiteUrl,
    username: template.username,
    // Save encrypted password (not plain text) in localStorage record.
    encryptedPassword: encryptPassword(plainPassword),
    normalizedWebsite: normalizeUrl(template.websiteUrl),
  };
}

// Keep demo data helpful for first use: if user has fewer than 10 accounts,
// add only missing demo entries and never overwrite existing user accounts.
function ensureMinimumDemoAccounts(username) {
  const accounts = getAccountsForUser(username);
  if (accounts.length >= 10) {
    return 0;
  }

  const existingSites = {};
  accounts.forEach(function (a) {
    const key = a.normalizedWebsite || normalizeUrl(a.websiteUrl);
    if (key) {
      existingSites[key] = true;
    }
  });

  let needed = 10 - accounts.length;
  let added = 0;
  const templates = getDemoAccountTemplates();

  for (var i = 0; i < templates.length && needed > 0; i++) {
    const template = templates[i];
    const normalized = normalizeUrl(template.websiteUrl);
    if (normalized && existingSites[normalized]) {
      continue;
    }
    accounts.push(createDemoAccount(template, i));
    if (normalized) {
      existingSites[normalized] = true;
    }
    needed -= 1;
    added += 1;
  }

  if (added > 0) {
    setAccountsForUser(username, accounts);
  }
  return added;
}

// --- URLs: normalize host for duplicate detection; safe link for "open website" ---
function normalizeUrl(rawUrl) {
  const raw = (rawUrl || "").trim().toLowerCase();
  if (!raw) {
    return "";
  }
  try {
    // Try URL parser first for reliable hostname extraction.
    const withScheme = /^https?:\/\//i.test(raw) ? raw : "https://" + raw;
    const parsed = new URL(withScheme);
    return parsed.hostname.replace(/^www\./, "");
  } catch (e) {
    // Fallback for invalid URL strings: best-effort cleanup.
    return raw
      .replace(/^https?:\/\//i, "")
      .replace(/^www\./i, "")
      .split(/[/?#]/)[0];
  }
}

function safeUrl(raw) {
  const url = (raw || "").trim();
  if (!url) {
    return "";
  }
  if (/^https?:\/\//i.test(url)) {
    return url;
  }
  return "https://" + url;
}

function copyTextToClipboard(text) {
  if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
    return navigator.clipboard.writeText(text);
  }
  return Promise.reject(new Error("Clipboard API not available"));
}

function escapeCsvValue(value) {
  const raw = value == null ? "" : String(value);
  return '"' + raw.replace(/"/g, '""') + '"';
}

function downloadAccountsCsv() {
  if (!currentUsername) {
    return;
  }
  const accounts = getAccountsForUser(currentUsername);
  const header = ["site", "url", "username", "encryptedPassword"];
  const rows = accounts.map(function (account) {
    // Export encrypted password only. Plain passwords are never written to file.
    // This demonstrates safer handling: exported data is not useful without the decryption key.
    return [
      account.siteName || "",
      account.websiteUrl || "",
      account.username || "",
      account.encryptedPassword || "",
    ];
  });
  const csvLines = [header]
    .concat(rows)
    .map(function (line) {
      return line.map(escapeCsvValue).join(",");
    });

  // Add UTF-8 BOM so Excel opens the CSV cleanly.
  const csvContent = "\ufeff" + csvLines.join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "accounts.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  setStatus("Exported " + accounts.length + " account(s) to accounts.csv", false);
}

function getWebsiteIcon(siteName, normalizedWebsite) {
  const source = ((siteName || "") + " " + (normalizedWebsite || "")).toLowerCase();
  const iconKey = Object.keys(KNOWN_SITE_ICONS).find(function (key) {
    return source.indexOf(key) >= 0;
  });
  return iconKey ? KNOWN_SITE_ICONS[iconKey] : "🌐";
}

// Shown in account cards while the site password is hidden (each card toggles on its own).
const ACCOUNT_PASSWORD_MASK = "••••••••";

// --- Build one row in the saved accounts list ---
// Real autofill on external websites needs a browser extension.
// This web app uses safe redirection + copy buttons as autofill simulation.
function buildAccountCard(account) {
  const li = document.createElement("li");
  li.className = "account-card";
  if (account.id) {
    li.dataset.accountId = account.id;
  }
  const siteName = account.siteName || "Unknown site";
  const websiteUrl = safeUrl(account.websiteUrl);
  const normalizedWebsite = account.normalizedWebsite || normalizeUrl(account.websiteUrl);
  const username =
    account.username != null && account.username !== "" ? account.username : "-";
  const encryptedPassword = account.encryptedPassword || "";

  // Lazy decrypt: avoids throwing during render if the derived key is not in memory yet,
  // and lets the eye button decrypt only when needed. Each card keeps its own cache.
  var plainResolved = false;
  var cachedPlainPassword = "";
  function resolvePlainPasswordForCard() {
    if (plainResolved) {
      return { ok: true, plain: cachedPlainPassword };
    }
    try {
      cachedPlainPassword = decryptPassword(encryptedPassword);
      plainResolved = true;
      return { ok: true, plain: cachedPlainPassword };
    } catch (err) {
      return { ok: false, plain: "" };
    }
  }

  const cardHeader = document.createElement("div");
  cardHeader.className = "account-header";
  const icon = document.createElement("span");
  icon.className = "site-icon";
  icon.textContent = getWebsiteIcon(siteName, normalizedWebsite);
  const title = document.createElement("div");
  title.className = "site-name";
  title.textContent = siteName;
  cardHeader.appendChild(icon);
  cardHeader.appendChild(title);

  const urlLine = document.createElement("div");
  urlLine.className = "meta-line";
  if (websiteUrl) {
    const label = document.createElement("span");
    label.className = "meta-label";
    label.textContent = "URL: ";
    const link = document.createElement("a");
    link.className = "url-link";
    link.href = websiteUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = websiteUrl;
    urlLine.appendChild(label);
    urlLine.appendChild(link);
  } else {
    const span = document.createElement("span");
    span.className = "meta-label";
    span.textContent = "URL: ";
    urlLine.appendChild(span);
    urlLine.appendChild(document.createTextNode("-"));
  }

  const userLine = document.createElement("div");
  userLine.className = "meta-line";
  const userLabel = document.createElement("span");
  userLabel.className = "meta-label";
  userLabel.textContent = "Username:";
  const userValue = document.createElement("span");
  userValue.textContent = " " + username;
  userLine.appendChild(userLabel);
  userLine.appendChild(userValue);

  const passLine = document.createElement("div");
  passLine.className = "meta-line password-row";
  const passLabel = document.createElement("span");
  passLabel.className = "meta-label";
  passLabel.textContent = "Password: ";
  const passValue = document.createElement("span");
  passValue.className = "password-text";
  passValue.textContent = ACCOUNT_PASSWORD_MASK;
  const eyeBtn = document.createElement("button");
  eyeBtn.type = "button";
  eyeBtn.className = "eye-btn";
  eyeBtn.textContent = "👁";
  eyeBtn.setAttribute("aria-label", "Show password");
  eyeBtn.setAttribute("aria-pressed", "false");

  // Per-card toggle only: this closure is not shared with other cards.
  var passwordRevealed = false;
  eyeBtn.addEventListener("click", function () {
    if (!passwordRevealed) {
      var reveal = resolvePlainPasswordForCard();
      if (!reveal.ok) {
        setStatus("Please log in again to decrypt passwords.", true);
        return;
      }
      passValue.textContent = reveal.plain ? reveal.plain : "(no password stored)";
      passwordRevealed = true;
      eyeBtn.textContent = "🙈";
      eyeBtn.setAttribute("aria-label", "Hide password");
      eyeBtn.setAttribute("aria-pressed", "true");
    } else {
      passValue.textContent = ACCOUNT_PASSWORD_MASK;
      passwordRevealed = false;
      eyeBtn.textContent = "👁";
      eyeBtn.setAttribute("aria-label", "Show password");
      eyeBtn.setAttribute("aria-pressed", "false");
    }
  });

  passLine.appendChild(passLabel);
  passLine.appendChild(passValue);
  passLine.appendChild(eyeBtn);

  const actionsRow = document.createElement("div");
  actionsRow.className = "card-actions";

  const openSiteBtn = document.createElement("button");
  openSiteBtn.type = "button";
  openSiteBtn.className = "card-action-btn btn-open";
  openSiteBtn.textContent = "Open Site";
  openSiteBtn.setAttribute("aria-label", "Open saved website");
  openSiteBtn.addEventListener("click", function () {
    if (!websiteUrl) {
      setStatus("No website URL saved for this account.", true);
      return;
    }
    window.open(websiteUrl, "_blank", "noopener,noreferrer");
  });

  const copyUserBtn = document.createElement("button");
  copyUserBtn.type = "button";
  copyUserBtn.className = "card-action-btn btn-copy";
  copyUserBtn.textContent = "Copy Username";
  copyUserBtn.setAttribute("aria-label", "Copy username");
  copyUserBtn.addEventListener("click", function () {
    if (!account.username) {
      setStatus("No username saved for this account.", true);
      return;
    }
    copyTextToClipboard(account.username)
      .then(function () {
        setStatus("Username copied", false);
      })
      .catch(function () {
        setStatus("Could not copy username. Browser blocked clipboard access.", true);
      });
  });

  const copyPassBtn = document.createElement("button");
  copyPassBtn.type = "button";
  copyPassBtn.className = "card-action-btn btn-copy";
  copyPassBtn.textContent = "Copy Password";
  copyPassBtn.setAttribute("aria-label", "Copy password");
  copyPassBtn.addEventListener("click", function () {
    var copyResult = resolvePlainPasswordForCard();
    if (!copyResult.ok) {
      setStatus("Please log in again to decrypt passwords.", true);
      return;
    }
    copyTextToClipboard(copyResult.plain || "")
      .then(function () {
        setStatus("Password copied", false);
      })
      .catch(function () {
        setStatus("Could not copy password. Browser blocked clipboard access.", true);
      });
  });

  const editBtn = document.createElement("button");
  editBtn.type = "button";
  editBtn.className = "card-action-btn btn-edit";
  editBtn.textContent = "Edit";
  editBtn.setAttribute("aria-label", "Edit account");
  editBtn.addEventListener("click", function () {
    editAccount(account.id);
  });

  const deleteBtn = document.createElement("button");
  deleteBtn.type = "button";
  deleteBtn.className = "card-action-btn btn-delete";
  deleteBtn.textContent = "Delete";
  deleteBtn.setAttribute("aria-label", "Delete account");
  deleteBtn.addEventListener("click", function () {
    deleteAccount(account.id);
  });

  actionsRow.appendChild(openSiteBtn);
  actionsRow.appendChild(copyUserBtn);
  actionsRow.appendChild(copyPassBtn);
  actionsRow.appendChild(editBtn);
  actionsRow.appendChild(deleteBtn);

  li.appendChild(cardHeader);
  li.appendChild(urlLine);
  li.appendChild(userLine);
  li.appendChild(passLine);
  li.appendChild(actionsRow);
  return li;
}

function accountMatchesSearch(account, query) {
  if (!query) {
    return true;
  }
  const haystack = [
    account.siteName || "",
    account.username || "",
    account.websiteUrl || "",
    account.normalizedWebsite || normalizeUrl(account.websiteUrl),
  ]
    .join(" ")
    .toLowerCase();
  return haystack.indexOf(query) >= 0;
}

// --- Delete one account and refresh list ---
function deleteAccount(accountId) {
  if (!currentUsername) {
    return;
  }
  const ok = window.confirm("Are you sure you want to delete this account?");
  if (!ok) {
    return;
  }
  const accounts = getAccountsForUser(currentUsername);
  const nextAccounts = accounts.filter(function (a) {
    return a.id !== accountId;
  });
  setAccountsForUser(currentUsername, nextAccounts);
  setStatus("Account deleted.", false);
  loadAccounts();
}

// --- Edit account modal (all fields; replaces old window.prompt flow) ---
function closeEditAccountModal() {
  if (!editAccountModal) {
    return;
  }
  editingAccountId = null;
  editAccountModal.classList.add("hidden");
  editAccountModal.setAttribute("aria-hidden", "true");
  if (editAccountForm) {
    editAccountForm.reset();
  }
  if (editAccountPass) {
    editAccountPass.type = "password";
  }
  if (toggleEditPass) {
    toggleEditPass.textContent = "Show";
    toggleEditPass.setAttribute("aria-pressed", "false");
    toggleEditPass.setAttribute("aria-label", "Show password");
  }
  if (editGeneratedPreview) {
    editGeneratedPreview.hidden = true;
    editGeneratedPreview.textContent = "";
  }
}

function editAccount(accountId) {
  if (!currentUsername || !editAccountModal) {
    return;
  }
  const accounts = getAccountsForUser(currentUsername);
  const index = accounts.findIndex(function (a) {
    return a.id === accountId;
  });
  if (index < 0) {
    setStatus("Could not find that account.", true);
    return;
  }

  const account = accounts[index];
  var currentPassword = "";
  try {
    currentPassword = decryptPassword(account.encryptedPassword || "");
  } catch (err) {
    setStatus("Please log in again to edit passwords.", true);
    return;
  }

  editingAccountId = accountId;
  editSiteName.value = account.siteName || "";
  editWebsiteUrl.value = account.websiteUrl || "";
  editAccountUser.value = account.username || "";
  editAccountPass.value = currentPassword;
  editAccountPass.type = "password";
  toggleEditPass.textContent = "Show";
  toggleEditPass.setAttribute("aria-pressed", "false");
  toggleEditPass.setAttribute("aria-label", "Show password");
  editGeneratedPreview.hidden = true;
  editGeneratedPreview.textContent = "";

  editAccountModal.classList.remove("hidden");
  editAccountModal.setAttribute("aria-hidden", "false");
  editSiteName.focus();
}

function refreshSimulateSiteOptions(accounts) {
  simulateSiteSelect.innerHTML = "";
  if (!accounts || accounts.length === 0) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "No saved sites";
    simulateSiteSelect.appendChild(option);
    return;
  }
  accounts.forEach(function (account) {
    const option = document.createElement("option");
    option.value = account.id;
    option.textContent = account.siteName || account.websiteUrl || "Saved site";
    simulateSiteSelect.appendChild(option);
  });
}

function loadAccounts() {
  if (!currentUsername) {
    return;
  }
  accountsList.innerHTML = "";
  // Always read fresh account data from localStorage before rendering.
  const accounts = getAccountsForUser(currentUsername);
  refreshSimulateSiteOptions(accounts);
  if (accounts.length === 0) {
    noResultsText.classList.add("hidden");
    setStatus("No saved accounts yet. Add one above.", false);
    return;
  }
  const searchQuery = (accountSearchInput.value || "").trim().toLowerCase();
  const filteredAccounts = accounts.filter(function (account) {
    return accountMatchesSearch(account, searchQuery);
  });
  if (filteredAccounts.length === 0) {
    noResultsText.classList.remove("hidden");
    setStatus("Showing 0 of " + accounts.length + " account(s).", false);
    return;
  }
  noResultsText.classList.add("hidden");
  filteredAccounts.forEach(function (account) {
    accountsList.appendChild(buildAccountCard(account));
  });
  setStatus(
    "Showing " + filteredAccounts.length + " of " + accounts.length + " account(s) from localStorage.",
    false
  );
}

// --- Switch between login screen and main app ---
function showAuth() {
  // Auth-page mode: show only Login/Sign Up blocks and hide full dashboard/app panel.
  closeEditAccountModal();
  currentUsername = null;
  activeEncryptionKeyBytes = null;
  appSection.classList.add("hidden");
  authSection.classList.remove("hidden");
  loginBlock.hidden = false;
  signupBlock.hidden = true;
  loginPass.type = "password";
  signupPass.type = "password";
  signupPass2.type = "password";
  toggleLoginPass.textContent = "Show";
  toggleLoginPass.setAttribute("aria-pressed", "false");
  toggleSignupPass.textContent = "Show";
  toggleSignupPass.setAttribute("aria-pressed", "false");
  toggleSignupPass2.textContent = "Show";
  toggleSignupPass2.setAttribute("aria-pressed", "false");
  setAuthMessage("", false);
  setStatus("", false);
  setSimulateMessage("", false);
  setChangeMasterMessage("", false);
  if (accountSearchInput) {
    accountSearchInput.value = "";
  }
  noResultsText.classList.add("hidden");
  changeMasterForm.reset();
  changeMasterForm.hidden = true;
  resetChangeMasterPasswordVisibility();
}

function showApp(username) {
  // App-page mode: hide auth panel and show dashboard sections only after sign-in.
  currentUsername = username;
  setSession(username);
  authSection.classList.add("hidden");
  appSection.classList.remove("hidden");
  sessionUserEl.textContent = username;
  accountSearchInput.value = "";
  noResultsText.classList.add("hidden");
  addAccountForm.reset();
  generatedPassPreview.hidden = true;
  lastGeneratedPassword = "";
  addAccountPass.type = "password";
  toggleAddPass.textContent = "Show";
  toggleAddPass.setAttribute("aria-pressed", "false");
  simulateLoginForm.reset();
  simulatePass.type = "password";
  toggleSimulatePass.textContent = "Show";
  toggleSimulatePass.setAttribute("aria-pressed", "false");
  setSimulateMessage("", false);
  setChangeMasterMessage("", false);
  changeMasterForm.reset();
  changeMasterForm.hidden = true;
  resetChangeMasterPasswordVisibility();
  const addedDemoCount = ensureMinimumDemoAccounts(username);
  if (addedDemoCount > 0) {
    setStatus("Added " + addedDemoCount + " demo account(s) to reach 10 total.", false);
  }
  loadAccounts();
}

async function activateEncryptionKeyForUser(username, masterPassword) {
  const users = getUsers();
  const userIndex = findUserIndexByUsername(users, username);
  if (userIndex < 0) {
    throw new Error("Could not find user while preparing encryption key.");
  }
  if (!users[userIndex].kdfSalt) {
    users[userIndex].kdfSalt = generateRandomSaltBase64();
    saveUsers(users);
  }
  activeEncryptionKeyBytes = await deriveEncryptionKeyBytes(masterPassword, users[userIndex].kdfSalt);
}

function updateMasterPasswordForCurrentUser(currentPass, nextPass) {
  if (!currentUsername) {
    return { ok: false, message: "No user is signed in." };
  }

  const users = getUsers();
  const userIndex = findUserIndexByUsername(users, currentUsername);
  if (userIndex < 0) {
    return { ok: false, message: "Could not find your user record." };
  }

  // Verify current password:
  // user input -> hashMasterPassword -> must match saved hash in localStorage.
  const expectedHash = users[userIndex].passwordHash;
  const currentHash = hashMasterPassword(users[userIndex].username, currentPass);
  if (currentHash !== expectedHash) {
    return { ok: false, message: "Current master password is incorrect." };
  }

  // Validate new password strength before saving.
  if (!isStrongPassword(nextPass)) {
    return {
      ok: false,
      message:
        "New master password must be 8+ characters with lowercase, uppercase, number, and symbol.",
    };
  }

  // Save only new master hash.
  // Account records are in a separate key (LS_ACCOUNTS), so they are not deleted here.
  users[userIndex].passwordHash = hashMasterPassword(users[userIndex].username, nextPass);
  saveUsers(users);
  return { ok: true, message: "Master password updated successfully" };
}

function tryResumeSession() {
  // On page load, re-open app if session username still exists in users list.
  const sessionUser = getSession();
  if (!sessionUser) {
    showAuth();
    return;
  }
  const users = getUsers();
  const exists = users.some(function (u) {
    return u.username.toLowerCase() === sessionUser.toLowerCase();
  });
  if (exists) {
    showAuth();
    const loginUserInput = document.getElementById("loginUser");
    loginUserInput.value = sessionUser;
    setAuthMessage(
      "Session restored for " +
        sessionUser +
        ". Enter your master password to unlock decrypted passwords.",
      false
    );
  } else {
    setSession(null);
    showAuth();
  }
}

// --- Event wiring ---
// Toggle between login and signup blocks.
goSignup.addEventListener("click", function () {
  loginBlock.hidden = true;
  signupBlock.hidden = false;
  signupPass.type = "password";
  signupPass2.type = "password";
  toggleSignupPass.textContent = "Show";
  toggleSignupPass.setAttribute("aria-pressed", "false");
  toggleSignupPass2.textContent = "Show";
  toggleSignupPass2.setAttribute("aria-pressed", "false");
  setAuthMessage("", false);
});

goLogin.addEventListener("click", function () {
  signupBlock.hidden = true;
  loginBlock.hidden = false;
  loginPass.type = "password";
  toggleLoginPass.textContent = "Show";
  toggleLoginPass.setAttribute("aria-pressed", "false");
  setAuthMessage("", false);
});

// Simple password toggle:
// if input is hidden ("password"), show as text; click again to hide.
toggleLoginPass.addEventListener("click", function () {
  const show = loginPass.type === "password";
  loginPass.type = show ? "text" : "password";
  toggleLoginPass.textContent = show ? "Hide" : "Show";
  toggleLoginPass.setAttribute("aria-label", show ? "Hide password" : "Show password");
  toggleLoginPass.setAttribute("aria-pressed", show ? "true" : "false");
});

// Same toggle logic for Sign Up master password.
toggleSignupPass.addEventListener("click", function () {
  const show = signupPass.type === "password";
  signupPass.type = show ? "text" : "password";
  toggleSignupPass.textContent = show ? "Hide" : "Show";
  toggleSignupPass.setAttribute("aria-label", show ? "Hide password" : "Show password");
  toggleSignupPass.setAttribute("aria-pressed", show ? "true" : "false");
});

// Same toggle logic for Sign Up confirm password.
toggleSignupPass2.addEventListener("click", function () {
  const show = signupPass2.type === "password";
  signupPass2.type = show ? "text" : "password";
  toggleSignupPass2.textContent = show ? "Hide" : "Show";
  toggleSignupPass2.setAttribute("aria-label", show ? "Hide password" : "Show password");
  toggleSignupPass2.setAttribute("aria-pressed", show ? "true" : "false");
});

// Show/hide buttons for Change Master Password inputs.
toggleCurrentMasterPass.addEventListener("click", function () {
  const show = currentMasterPass.type === "password";
  currentMasterPass.type = show ? "text" : "password";
  toggleCurrentMasterPass.textContent = show ? "Hide" : "Show";
  toggleCurrentMasterPass.setAttribute("aria-label", show ? "Hide password" : "Show password");
  toggleCurrentMasterPass.setAttribute("aria-pressed", show ? "true" : "false");
});

toggleNewMasterPass.addEventListener("click", function () {
  const show = newMasterPass.type === "password";
  newMasterPass.type = show ? "text" : "password";
  toggleNewMasterPass.textContent = show ? "Hide" : "Show";
  toggleNewMasterPass.setAttribute("aria-label", show ? "Hide password" : "Show password");
  toggleNewMasterPass.setAttribute("aria-pressed", show ? "true" : "false");
});

toggleConfirmMasterPass.addEventListener("click", function () {
  const show = confirmMasterPass.type === "password";
  confirmMasterPass.type = show ? "text" : "password";
  toggleConfirmMasterPass.textContent = show ? "Hide" : "Show";
  toggleConfirmMasterPass.setAttribute("aria-label", show ? "Hide password" : "Show password");
  toggleConfirmMasterPass.setAttribute("aria-pressed", show ? "true" : "false");
});

toggleChangeMasterBtn.addEventListener("click", function () {
  const shouldShow = changeMasterForm.hidden;
  changeMasterForm.hidden = !shouldShow;
  if (shouldShow) {
    setChangeMasterMessage("", false);
    currentMasterPass.focus();
  } else {
    changeMasterForm.reset();
    resetChangeMasterPasswordVisibility();
    setChangeMasterMessage("", false);
  }
});

changeMasterForm.addEventListener("submit", async function (e) {
  e.preventDefault();
  if (!currentUsername) {
    return;
  }

  const currentPass = currentMasterPass.value;
  const nextPass = newMasterPass.value;
  const confirmPass = confirmMasterPass.value;

  if (!currentPass || !nextPass || !confirmPass) {
    setChangeMasterMessage("Fill in all password fields.", true);
    return;
  }
  if (nextPass !== confirmPass) {
    setChangeMasterMessage("Confirm new password must match new password.", true);
    return;
  }

  // Beginner-friendly update flow:
  // 1) Check current password by hash comparison
  // 2) Validate new password strength
  // 3) Save new hash to users storage
  const result = updateMasterPasswordForCurrentUser(currentPass, nextPass);
  setChangeMasterMessage(result.message, !result.ok);
  if (!result.ok) {
    return;
  }

  try {
    await activateEncryptionKeyForUser(currentUsername, nextPass);
  } catch (error) {
    setChangeMasterMessage(
      "Master password changed, but key unlock failed. Please log out and log in again.",
      true
    );
    return;
  }

  // Keep session active and do not touch saved accounts.
  setSession(currentUsername);
  changeMasterForm.reset();
  changeMasterForm.hidden = true;
  resetChangeMasterPasswordVisibility();
});

loginForm.addEventListener("submit", async function (e) {
  e.preventDefault();
  const username = document.getElementById("loginUser").value.trim();
  const password = loginPass.value;
  if (!username) {
    setAuthMessage("Enter a username.", true);
    return;
  }
  if (!password) {
    setAuthMessage("Enter your master password.", true);
    return;
  }
  // Log in check: hash entered password and compare with saved hash.
  const hash = hashMasterPassword(username, password);
  const users = getUsers();
  const found = users.find(function (u) {
    return u.username.toLowerCase() === username.toLowerCase() && u.passwordHash === hash;
  });
  if (!found) {
    setAuthMessage("Wrong username or password.", true);
    return;
  }
  try {
    await activateEncryptionKeyForUser(found.username, password);
  } catch (error) {
    setAuthMessage("Could not derive encryption key in this browser.", true);
    return;
  }
  showApp(found.username);
});

signupForm.addEventListener("submit", async function (e) {
  e.preventDefault();
  const username = document.getElementById("signupUser").value.trim();
  const pass = signupPass.value;
  const pass2 = signupPass2.value;
  if (!username) {
    setAuthMessage("Choose a username.", true);
    return;
  }
  if (!pass || !pass2) {
    setAuthMessage("Fill in both password fields.", true);
    return;
  }
  if (pass !== pass2) {
    setAuthMessage("Passwords do not match.", true);
    return;
  }
  if (!isStrongPassword(pass)) {
    setAuthMessage(
      "Master password must be 8+ characters with lowercase, uppercase, number, and symbol.",
      true
    );
    return;
  }
  const users = getUsers();
  const taken = users.some(function (u) {
    return u.username.toLowerCase() === username.toLowerCase();
  });
  if (taken) {
    setAuthMessage("That username is already taken.", true);
    return;
  }
  const newUser = {
    username: username,
    // Store password hash only (never raw master password).
    passwordHash: hashMasterPassword(username, pass),
    // Store only random salt; derived key is created after login and kept in memory.
    kdfSalt: generateRandomSaltBase64(),
  };
  const nextUsers = users.concat([newUser]);
  try {
    saveUsers(nextUsers);
    const map = getAccountsMap();
    map[username.toLowerCase()] = [];
    saveAccountsMap(map);
  } catch (err) {
    setAuthMessage("Could not save to browser storage (localStorage). Check browser privacy settings.", true);
    return;
  }
  try {
    await activateEncryptionKeyForUser(username, pass);
  } catch (error) {
    setAuthMessage("Account created, but key setup failed. Try logging in again.", true);
    return;
  }
  showApp(username);
});

logoutBtn.addEventListener("click", function () {
  setSession(null);
  loginForm.reset();
  signupForm.reset();
  showAuth();
});

refreshBtn.addEventListener("click", function () {
  loadAccounts();
});

exportCsvBtn.addEventListener("click", function () {
  downloadAccountsCsv();
});

// Live search instantly filters cards by site name, username, or URL.
accountSearchInput.addEventListener("input", function () {
  loadAccounts();
});

themeToggleBtn.addEventListener("click", function () {
  toggleTheme();
});

simulateLoginForm.addEventListener("submit", function (e) {
  e.preventDefault();
  if (!currentUsername) {
    return;
  }

  const selectedId = simulateSiteSelect.value;
  const enteredUsername = simulateUser.value.trim();
  const enteredPassword = simulatePass.value;
  const accounts = getAccountsForUser(currentUsername);
  const selectedAccount = accounts.find(function (a) {
    return a.id === selectedId;
  });

  if (!selectedAccount) {
    setSimulateMessage("Error! Wrong username or password!", true);
    return;
  }

  const savedUsername = (selectedAccount.username || "").trim();
  // Simulate login compares typed password to decrypted stored site password.
  const savedPassword = decryptPassword(selectedAccount.encryptedPassword || "");
  const isMatch = enteredUsername === savedUsername && enteredPassword === savedPassword;

  if (isMatch) {
    setSimulateMessage("Signed in", false);
  } else {
    setSimulateMessage("Error! Wrong username or password!", true);
  }
});

// Show/hide password in Simulate Login form.
toggleSimulatePass.addEventListener("click", function () {
  const show = simulatePass.type === "password";
  simulatePass.type = show ? "text" : "password";
  toggleSimulatePass.textContent = show ? "Hide" : "Show";
  toggleSimulatePass.setAttribute("aria-pressed", show ? "true" : "false");
});

toggleAddPass.addEventListener("click", function () {
  const show = addAccountPass.type === "password";
  addAccountPass.type = show ? "text" : "password";
  toggleAddPass.textContent = show ? "Hide" : "Show";
  toggleAddPass.setAttribute("aria-pressed", show ? "true" : "false");
});

btnGeneratePass.addEventListener("click", function () {
  lastGeneratedPassword = generateStrongPassword();
  generatedPassPreview.textContent = "Generated: " + lastGeneratedPassword;
  generatedPassPreview.hidden = false;
});

btnFillGenerated.addEventListener("click", function () {
  if (!lastGeneratedPassword) {
    lastGeneratedPassword = generateStrongPassword();
    generatedPassPreview.textContent = "Generated: " + lastGeneratedPassword;
    generatedPassPreview.hidden = false;
  }
  addAccountPass.value = lastGeneratedPassword;
  addAccountPass.type = "text";
  toggleAddPass.textContent = "Hide";
  toggleAddPass.setAttribute("aria-pressed", "true");
  addAccountPass.dispatchEvent(new Event("input"));
});

// --- Edit modal: show/hide password while editing ---
toggleEditPass.addEventListener("click", function () {
  const show = editAccountPass.type === "password";
  editAccountPass.type = show ? "text" : "password";
  toggleEditPass.textContent = show ? "Hide" : "Show";
  toggleEditPass.setAttribute("aria-label", show ? "Hide password" : "Show password");
  toggleEditPass.setAttribute("aria-pressed", show ? "true" : "false");
});

// Fill edit password field with a new strong password (same rules as Add account).
btnEditGeneratePass.addEventListener("click", function () {
  const generated = generateStrongPassword();
  editAccountPass.value = generated;
  editGeneratedPreview.textContent = "Generated: " + generated;
  editGeneratedPreview.hidden = false;
  editAccountPass.type = "text";
  toggleEditPass.textContent = "Hide";
  toggleEditPass.setAttribute("aria-pressed", "true");
  toggleEditPass.setAttribute("aria-label", "Hide password");
  editAccountPass.dispatchEvent(new Event("input"));
});

btnEditCancel.addEventListener("click", function () {
  closeEditAccountModal();
});

btnEditModalClose.addEventListener("click", function () {
  closeEditAccountModal();
});

// Click dimmed area outside the card closes the modal (dialog stays open if you click inside).
if (editAccountModal) {
  editAccountModal.addEventListener("click", function (e) {
    if (e.target === editAccountModal) {
      closeEditAccountModal();
    }
  });
}

editAccountForm.addEventListener("submit", function (e) {
  e.preventDefault();
  if (!currentUsername || !editingAccountId) {
    return;
  }

  const accounts = getAccountsForUser(currentUsername);
  let index = accounts.findIndex(function (a) {
    return a.id === editingAccountId;
  });
  if (index < 0) {
    closeEditAccountModal();
    return;
  }

  const account = accounts[index];
  const nextSiteName = editSiteName.value.trim();
  const nextWebsiteUrl = editWebsiteUrl.value.trim();
  const nextUsername = editAccountUser.value.trim();
  const nextPassword = editAccountPass.value;

  if (!nextSiteName) {
    setStatus("Site name is required.", true);
    return;
  }
  if (!nextUsername) {
    setStatus("Username on site is required.", true);
    return;
  }
  if (!isStrongPassword(nextPassword)) {
    setStatus(
      "Site password must be strong: 8+ chars with lowercase, uppercase, number, and symbol.",
      true
    );
    return;
  }

  const nextNormalizedWebsite = normalizeUrl(nextWebsiteUrl);
  if (nextWebsiteUrl && !nextNormalizedWebsite) {
    setStatus("That website URL does not look valid.", true);
    return;
  }

  var nextEncrypted;
  try {
    nextEncrypted = encryptPassword(nextPassword);
  } catch (err) {
    setStatus("Please log in again to edit passwords.", true);
    return;
  }

  const updatedAccount = {
    id: account.id,
    siteName: nextSiteName,
    websiteUrl: nextWebsiteUrl,
    username: nextUsername,
    encryptedPassword: nextEncrypted,
    normalizedWebsite: nextNormalizedWebsite,
  };

  // Same duplicate-website rule as Add / old edit: remove other card with same normalized host, then save.
  var replacedDuplicate = false;
  if (nextNormalizedWebsite) {
    const duplicateIndex = accounts.findIndex(function (a) {
      if (a.id === account.id) {
        return false;
      }
      const existingNorm = a.normalizedWebsite || normalizeUrl(a.websiteUrl);
      return existingNorm === nextNormalizedWebsite;
    });
    if (duplicateIndex >= 0) {
      accounts.splice(duplicateIndex, 1);
      if (duplicateIndex < index) {
        index -= 1;
      }
      replacedDuplicate = true;
    }
  }

  accounts[index] = updatedAccount;
  setAccountsForUser(currentUsername, accounts);
  closeEditAccountModal();
  if (replacedDuplicate) {
    setStatus("Replaced existing account for that website (duplicate rule).", false);
  } else {
    setStatus("Account updated.", false);
  }
  loadAccounts();
});

addAccountForm.addEventListener("submit", function (e) {
  e.preventDefault();
  if (!currentUsername) {
    return;
  }
  const siteName = addSiteName.value.trim();
  const websiteUrl = addWebsiteUrl.value.trim();
  const username = addAccountUser.value.trim();
  const password = addAccountPass.value;

  if (!siteName) {
    setStatus("Site name is required.", true);
    return;
  }
  if (!username) {
    setStatus("Username on site is required.", true);
    return;
  }
  if (!isStrongPassword(password)) {
    setStatus(
      "Site password must be strong: 8+ chars with lowercase, uppercase, number, and symbol.",
      true
    );
    return;
  }

  const normalizedWebsite = normalizeUrl(websiteUrl);
  if (websiteUrl && !normalizedWebsite) {
    setStatus("That website URL does not look valid.", true);
    return;
  }

  const newAccount = {
    id: Date.now().toString(),
    siteName: siteName,
    websiteUrl: websiteUrl,
    username: username,
    // Encrypt site password before writing to storage.
    encryptedPassword: encryptPassword(password),
    normalizedWebsite: normalizedWebsite,
  };

  const accounts = getAccountsForUser(currentUsername);
  const existingIndex = normalizedWebsite
    ? accounts.findIndex(function (a) {
        const existingNorm = a.normalizedWebsite || normalizeUrl(a.websiteUrl);
        return existingNorm === normalizedWebsite;
      })
    : -1;

  if (normalizedWebsite && existingIndex >= 0) {
    accounts[existingIndex] = newAccount;
    setStatus("Replaced existing account for that website (duplicate rule).", false);
  } else {
    accounts.push(newAccount);
    setStatus("Account saved.", false);
  }

  setAccountsForUser(currentUsername, accounts);
  addAccountForm.reset();
  lastGeneratedPassword = "";
  generatedPassPreview.hidden = true;
  addAccountPass.type = "password";
  toggleAddPass.textContent = "Show";
  toggleAddPass.setAttribute("aria-pressed", "false");
  loadAccounts();
});

// App entry point: try restoring previous session, otherwise show auth page.
createPasswordStrengthMeter(signupPass);
createPasswordStrengthMeter(addAccountPass);
createPasswordStrengthMeter(editAccountPass);
createPasswordStrengthMeter(newMasterPass);
applyTheme(getSavedTheme());
tryResumeSession();
