/**
 * popup.js — extension toolbar popup.
 *
 * Flow:
 * 1. Read chrome.storage.local for a master record (spm_master).
 * 2. No master → Sign Up view (first time only).
 * 3. Master exists → Login view (every time you open the popup until you unlock).
 * 4. Correct master password → Dashboard (list saved site logins from spm_accounts).
 */

// XOR key for saved *website* passwords (same as content.js).
const ENCRYPTION_KEY = "K";

// Saved site logins (from content script): [{ id, url, username, encryptedPassword }, ...]
const STORAGE_ACCOUNTS_KEY = "spm_accounts";

// One master user for the popup: { username, password } — demo only (real apps hash passwords).
const MASTER_STORAGE_KEY = "spm_master";

// --- DOM ---
const viewSignup = document.getElementById("viewSignup");
const viewLogin = document.getElementById("viewLogin");
const viewDashboard = document.getElementById("viewDashboard");
const headerHint = document.getElementById("headerHint");

const signupForm = document.getElementById("signupForm");
const signupUser = document.getElementById("signupUser");
const signupPass = document.getElementById("signupPass");
const signupError = document.getElementById("signupError");

const loginForm = document.getElementById("loginForm");
const loginUser = document.getElementById("loginUser");
const loginPass = document.getElementById("loginPass");
const loginError = document.getElementById("loginError");

const logoutBtn = document.getElementById("logoutBtn");
const dashboardLogoutBtn = document.getElementById("dashboardLogoutBtn");
const accountList = document.getElementById("accountList");
const emptyState = document.getElementById("emptyState");

/** Same rules as the web app: min length 8 + upper, lower, digit, symbol. */
function isStrongPassword(password) {
  if (password == null || password.length < 8) {
    return false;
  }
  let hasUpper = false;
  let hasLower = false;
  let hasDigit = false;
  let hasSymbol = false;

  for (let i = 0; i < password.length; i++) {
    const c = password[i];
    if (c >= "A" && c <= "Z") {
      hasUpper = true;
    } else if (c >= "a" && c <= "z") {
      hasLower = true;
    } else if (c >= "0" && c <= "9") {
      hasDigit = true;
    } else {
      hasSymbol = true;
    }
  }

  return hasUpper && hasLower && hasDigit && hasSymbol;
}

function encrypt(plain, key) {
  if (plain == null || plain === "") {
    return "";
  }
  const k = key.charCodeAt(0);
  let out = "";
  for (let i = 0; i < plain.length; i++) {
    out += String.fromCharCode(plain.charCodeAt(i) ^ k);
  }
  return out;
}

function decrypt(cipher, key) {
  return encrypt(cipher, key);
}

/**
 * Show exactly one of: signup, login, dashboard.
 */
function showView(name) {
  viewSignup.hidden = name !== "signup";
  viewLogin.hidden = name !== "login";
  viewDashboard.hidden = name !== "dashboard";

  if (name === "signup") {
    headerHint.textContent = "Create your master account (first time)";
  } else if (name === "login") {
    headerHint.textContent = "Sign in to unlock your vault";
  } else {
    headerHint.textContent = "Your saved logins";
  }
}

/** Load master from chrome.storage.local — null if missing or invalid JSON. */
function loadMaster(callback) {
  chrome.storage.local.get([MASTER_STORAGE_KEY], function (result) {
    const raw = result[MASTER_STORAGE_KEY];
    if (!raw || typeof raw.username !== "string" || typeof raw.password !== "string") {
      callback(null);
      return;
    }
    callback({ username: raw.username, password: raw.password });
  });
}

function saveMaster(username, password, callback) {
  chrome.storage.local.set(
    { [MASTER_STORAGE_KEY]: { username: username, password: password } },
    callback
  );
}

function shortUrl(url) {
  try {
    const u = new URL(url);
    return u.hostname + u.pathname;
  } catch (e) {
    return url;
  }
}

/** Build the list of saved site accounts (only call after user unlocked dashboard). */
function renderAccountList(accounts) {
  accountList.innerHTML = "";

  if (!accounts.length) {
    emptyState.hidden = false;
    return;
  }

  emptyState.hidden = true;

  for (let i = 0; i < accounts.length; i++) {
    const a = accounts[i];
    const plain = decrypt(a.encryptedPassword, ENCRYPTION_KEY);

    const li = document.createElement("li");
    li.className = "account-card";

    const site = document.createElement("div");
    site.className = "account-site";
    site.textContent = shortUrl(a.url);
    site.title = a.url;

    const user = document.createElement("div");
    user.className = "account-user";
    user.textContent = a.username || "(no username)";

    const passRow = document.createElement("div");
    passRow.className = "account-pass-row";

    const passSpan = document.createElement("span");
    passSpan.className = "account-pass";
    passSpan.textContent = "••••••••";

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "reveal-btn";
    btn.textContent = "Show";
    let visible = false;

    btn.addEventListener("click", function () {
      visible = !visible;
      passSpan.textContent = visible ? plain : "••••••••";
      btn.textContent = visible ? "Hide" : "Show";
    });

    passRow.appendChild(passSpan);
    passRow.appendChild(btn);

    li.appendChild(site);
    li.appendChild(user);
    li.appendChild(passRow);
    accountList.appendChild(li);
  }
}

/** Load site accounts from storage and paint the dashboard list. */
function refreshDashboard() {
  chrome.storage.local.get([STORAGE_ACCOUNTS_KEY], function (result) {
    const list = result[STORAGE_ACCOUNTS_KEY];
    renderAccountList(Array.isArray(list) ? list : []);
  });
}

/**
 * When the popup opens: decide Sign up vs Login.
 * Sign up only if no master exists; otherwise always start on Login.
 */
function boot() {
  loadMaster(function (master) {
    if (!master) {
      showView("signup");
      signupError.hidden = true;
      signupError.textContent = "";
    } else {
      showView("login");
      loginError.hidden = true;
      loginError.textContent = "";
      loginUser.value = "";
      loginPass.value = "";
    }
  });
}

// --- Sign up: one-time master record in chrome.storage.local ---
signupForm.addEventListener("submit", function (e) {
  e.preventDefault();
  signupError.hidden = true;
  signupError.textContent = "";

  const u = signupUser.value.trim();
  const p = signupPass.value;

  if (!u) {
    signupError.textContent = "Please enter a username.";
    signupError.hidden = false;
    return;
  }

  if (!isStrongPassword(p)) {
    signupError.textContent =
      "Password must be at least 8 characters with uppercase, lowercase, number, and symbol.";
    signupError.hidden = false;
    return;
  }

  saveMaster(u, p, function () {
    signupUser.value = "";
    signupPass.value = "";
    // After first setup, next screen is always Login (not straight to dashboard).
    showView("login");
    loginError.hidden = true;
    loginError.textContent = "";
    loginUser.value = u;
    loginPass.value = "";
    loginUser.focus();
  });
});

// --- Login: must match stored master ---
loginForm.addEventListener("submit", function (e) {
  e.preventDefault();
  loginError.hidden = true;
  loginError.textContent = "";

  const u = loginUser.value.trim();
  const p = loginPass.value;

  loadMaster(function (master) {
    if (!master) {
      showView("signup");
      return;
    }

    if (u === master.username && p === master.password) {
      showView("dashboard");
      refreshDashboard();
    } else {
      loginError.textContent = "Incorrect username or password.";
      loginError.hidden = false;
    }
  });
});

// --- Log out: back to login (master stays in storage). Top bar and footer buttons do the same. ---
function performPopupLogout() {
  loginUser.value = "";
  loginPass.value = "";
  loginError.hidden = true;
  showView("login");
}

logoutBtn.addEventListener("click", performPopupLogout);
dashboardLogoutBtn.addEventListener("click", performPopupLogout);

boot();
