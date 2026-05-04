/**
 * Password Manager — offline web app (no server, no fetch).
 * Open index.html in your browser; data is stored in localStorage.
 */

// --- Keys for localStorage (change only if you want a fresh empty app) ---
const XOR_KEY = "K";
const LS_USERS = "pm_web_users_v1";
const LS_ACCOUNTS = "pm_web_accounts_map_v1";
const LS_SESSION = "pm_web_session_v1";

// --- Page elements ---
const authPanel = document.getElementById("authPanel");
const appPanel = document.getElementById("appPanel");
const loginBlock = document.getElementById("loginBlock");
const signupBlock = document.getElementById("signupBlock");
const authMessage = document.getElementById("authMessage");
const sessionUserEl = document.getElementById("sessionUser");
const loginForm = document.getElementById("loginForm");
const signupForm = document.getElementById("signupForm");
const goSignup = document.getElementById("goSignup");
const goLogin = document.getElementById("goLogin");
const logoutBtn = document.getElementById("logoutBtn");
const addAccountForm = document.getElementById("addAccountForm");
const refreshBtn = document.getElementById("refreshBtn");
const statusText = document.getElementById("statusText");
const accountsList = document.getElementById("accountsList");
const addSiteName = document.getElementById("addSiteName");
const addWebsiteUrl = document.getElementById("addWebsiteUrl");
const addAccountUser = document.getElementById("addAccountUser");
const addAccountPass = document.getElementById("addAccountPass");
const toggleAddPass = document.getElementById("toggleAddPass");
const btnGeneratePass = document.getElementById("btnGeneratePass");
const btnFillGenerated = document.getElementById("btnFillGenerated");
const generatedPassPreview = document.getElementById("generatedPassPreview");

let currentUsername = null;
let lastGeneratedPassword = "";

// --- Small UI helpers ---
function setAuthMessage(text, isError) {
  authMessage.textContent = text || "";
  authMessage.style.color = isError ? "#b91c1c" : "#374151";
}

function setStatus(message, isError) {
  statusText.textContent = message;
  statusText.style.color = isError ? "#b91c1c" : "#374151";
}

// --- localStorage read/write (JSON) ---
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
// Stores a simple hash so the real master password is not saved in plain text.
function hashMasterPassword(username, password) {
  const key = String(username).trim().toLowerCase();
  const s = key + "\0" + password;
  var h = 5381;
  for (var i = 0; i < s.length; i++) {
    h = ((h << 5) + h) ^ s.charCodeAt(i);
    h |= 0;
  }
  return key + ":" + (h >>> 0).toString(16);
}

function getUsers() {
  const list = readJson(LS_USERS, []);
  return Array.isArray(list) ? list : [];
}

function saveUsers(users) {
  writeJson(LS_USERS, users);
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

// --- XOR demo encryption (same key encrypts and decrypts) ---
function xorEncrypt(text, key) {
  if (!text) {
    return "";
  }
  const keyCode = key.charCodeAt(0);
  var out = "";
  for (var i = 0; i < text.length; i++) {
    out += String.fromCharCode(text.charCodeAt(i) ^ keyCode);
  }
  return out;
}

function xorDecrypt(text, key) {
  return xorEncrypt(text, key);
}

// --- Strong password: 8+, lower, upper, digit, symbol ---
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
  var lower = "abcdefghijklmnopqrstuvwxyz";
  var upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  var numbers = "0123456789";
  var symbols = "!@#$%^&*()_+-=[]{}|;:,.<>?";
  var all = lower + upper + numbers + symbols;
  var targetLength = 14;
  var chars = [];
  chars.push(lower[Math.floor(Math.random() * lower.length)]);
  chars.push(upper[Math.floor(Math.random() * upper.length)]);
  chars.push(numbers[Math.floor(Math.random() * numbers.length)]);
  chars.push(symbols[Math.floor(Math.random() * symbols.length)]);
  while (chars.length < targetLength) {
    chars.push(all[Math.floor(Math.random() * all.length)]);
  }
  for (var i = chars.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var temp = chars[i];
    chars[i] = chars[j];
    chars[j] = temp;
  }
  return chars.join("");
}

// --- URLs: normalize host for duplicate detection; safe link for "open website" ---
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

// --- Build one row in the saved accounts list ---
function buildAccountCard(account) {
  const li = document.createElement("li");
  li.className = "account-card";
  const siteName = account.siteName || "Unknown site";
  const websiteUrl = safeUrl(account.websiteUrl);
  const username =
    account.username != null && account.username !== "" ? account.username : "-";
  const encryptedPassword = account.encryptedPassword || "";
  const decryptedPassword = xorDecrypt(encryptedPassword, XOR_KEY);

  const title = document.createElement("div");
  title.className = "site-name";
  title.textContent = siteName;

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
  passValue.textContent = "••••••••";
  const eyeBtn = document.createElement("button");
  eyeBtn.type = "button";
  eyeBtn.className = "eye-btn";
  eyeBtn.textContent = "👁";
  eyeBtn.setAttribute("aria-label", "Show password");

  var isVisible = false;
  eyeBtn.addEventListener("click", function () {
    isVisible = !isVisible;
    passValue.textContent = isVisible ? decryptedPassword : "••••••••";
    eyeBtn.textContent = isVisible ? "🙈" : "👁";
    eyeBtn.setAttribute("aria-label", isVisible ? "Hide password" : "Show password");
  });

  passLine.appendChild(passLabel);
  passLine.appendChild(passValue);
  passLine.appendChild(eyeBtn);
  li.appendChild(title);
  li.appendChild(urlLine);
  li.appendChild(userLine);
  li.appendChild(passLine);
  return li;
}

function loadAccounts() {
  if (!currentUsername) {
    return;
  }
  accountsList.innerHTML = "";
  const accounts = getAccountsForUser(currentUsername);
  if (accounts.length === 0) {
    setStatus("No saved accounts yet. Add one above.", false);
    return;
  }
  accounts.forEach(function (account) {
    accountsList.appendChild(buildAccountCard(account));
  });
  setStatus("Showing " + accounts.length + " account(s) from localStorage.", false);
}

// --- Switch between login screen and main app ---
function showAuth() {
  currentUsername = null;
  appPanel.hidden = true;
  authPanel.hidden = false;
  loginBlock.hidden = false;
  signupBlock.hidden = true;
  setAuthMessage("", false);
  setStatus("", false);
}

function showApp(username) {
  currentUsername = username;
  setSession(username);
  authPanel.hidden = true;
  appPanel.hidden = false;
  sessionUserEl.textContent = username;
  addAccountForm.reset();
  generatedPassPreview.hidden = true;
  lastGeneratedPassword = "";
  addAccountPass.type = "password";
  toggleAddPass.textContent = "Show";
  toggleAddPass.setAttribute("aria-pressed", "false");
  loadAccounts();
}

function tryResumeSession() {
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
    showApp(sessionUser);
  } else {
    setSession(null);
    showAuth();
  }
}

// --- Event wiring ---
goSignup.addEventListener("click", function () {
  loginBlock.hidden = true;
  signupBlock.hidden = false;
  setAuthMessage("", false);
});

goLogin.addEventListener("click", function () {
  signupBlock.hidden = true;
  loginBlock.hidden = false;
  setAuthMessage("", false);
});

loginForm.addEventListener("submit", function (e) {
  e.preventDefault();
  const username = document.getElementById("loginUser").value.trim();
  const password = document.getElementById("loginPass").value;
  if (!username) {
    setAuthMessage("Enter a username.", true);
    return;
  }
  if (!password) {
    setAuthMessage("Enter your master password.", true);
    return;
  }
  const hash = hashMasterPassword(username, password);
  const users = getUsers();
  const found = users.find(function (u) {
    return u.username.toLowerCase() === username.toLowerCase() && u.passwordHash === hash;
  });
  if (!found) {
    setAuthMessage("Wrong username or password.", true);
    return;
  }
  showApp(found.username);
});

signupForm.addEventListener("submit", function (e) {
  e.preventDefault();
  const username = document.getElementById("signupUser").value.trim();
  const pass = document.getElementById("signupPass").value;
  const pass2 = document.getElementById("signupPass2").value;
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
    passwordHash: hashMasterPassword(username, pass),
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

  if (!siteName || !websiteUrl) {
    setStatus("Site name and website URL are required.", true);
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
  if (!normalizedWebsite) {
    setStatus("That website URL does not look valid.", true);
    return;
  }

  const newAccount = {
    id: Date.now().toString(),
    siteName: siteName,
    websiteUrl: websiteUrl,
    username: username,
    encryptedPassword: xorEncrypt(password, XOR_KEY),
    normalizedWebsite: normalizedWebsite,
  };

  const accounts = getAccountsForUser(currentUsername);
  const existingIndex = accounts.findIndex(function (a) {
    const existingNorm = a.normalizedWebsite || normalizeUrl(a.websiteUrl);
    return existingNorm === normalizedWebsite;
  });

  if (existingIndex >= 0) {
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

tryResumeSession();
