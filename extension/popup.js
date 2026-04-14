/**
 * popup.js — Chrome extension popup (chrome.storage.local only, never localStorage).
 *
 * FLOW:
 * 1) Popup opens → read spm_master + isLoggedIn from chrome.storage.local.
 * 2) No master → signup-section only.
 * 3) Master + isLoggedIn true → dashboard-section only (stays logged in between opens).
 * 4) Master + isLoggedIn false → login-section only.
 * 5) Successful login → set isLoggedIn true → dashboard-section.
 * 6) Logout → set isLoggedIn false → login-section.
 */

const ENCRYPTION_KEY = "K";
const STORAGE_ACCOUNTS_KEY = "spm_accounts";
const MASTER_STORAGE_KEY = "spm_master";

/** Remember that the user already unlocked the vault (survives popup close). */
const SESSION_LOGGED_IN_KEY = "isLoggedIn";

const bootLoading = document.getElementById("bootLoading");
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
const dashboardSessionNote = document.getElementById("dashboardSessionNote");
const accountList = document.getElementById("accountList");
const emptyState = document.getElementById("emptyState");

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
 * Show exactly ONE section: signup-section OR login-section OR dashboard-section.
 */
function showView(name) {
  viewSignup.hidden = name !== "signup";
  viewLogin.hidden = name !== "login";
  viewDashboard.hidden = name !== "dashboard";

  if (name === "signup") {
    headerHint.textContent = "Create your master account (first time)";
  } else if (name === "login") {
    headerHint.textContent = "Sign in to unlock your vault";
  } else if (name === "dashboard") {
    headerHint.textContent = "Your saved logins";
  }

  if (name !== "dashboard" && dashboardSessionNote) {
    dashboardSessionNote.hidden = true;
    dashboardSessionNote.textContent = "";
  }
}

/**
 * Short message on the dashboard: different text if user skipped login (remembered session)
 * vs just typed their password.
 */
function setDashboardSessionMessage(mode) {
  if (!dashboardSessionNote) {
    return;
  }
  if (mode === "remembered") {
    dashboardSessionNote.textContent =
      "Remembered session — you're still logged in. Log out on shared computers.";
  } else {
    dashboardSessionNote.textContent =
      "Welcome — your session will stay active until you log out.";
  }
  dashboardSessionNote.hidden = false;
}

function logStorageError(step) {
  if (chrome.runtime.lastError) {
    console.error("Password Manager storage [" + step + "]:", chrome.runtime.lastError.message);
  }
}

function loadMaster(callback) {
  chrome.storage.local.get([MASTER_STORAGE_KEY], function (result) {
    logStorageError("loadMaster");

    if (chrome.runtime.lastError) {
      callback(null);
      return;
    }

    const raw = result[MASTER_STORAGE_KEY];

    if (raw == null || typeof raw !== "object") {
      callback(null);
      return;
    }

    const u = raw.username;
    const p = raw.password;
    if (typeof u !== "string" || typeof p !== "string") {
      callback(null);
      return;
    }

    callback({ username: u, password: p });
  });
}

function saveMaster(username, password, callback) {
  const record = { username: username, password: password };

  chrome.storage.local.set({ [MASTER_STORAGE_KEY]: record }, function () {
    logStorageError("saveMaster");

    if (chrome.runtime.lastError) {
      callback(false);
      return;
    }

    callback(true);
  });
}

/**
 * Save whether the user has unlocked the popup vault (chrome.storage.local).
 */
function setLoggedIn(isLoggedIn, callback) {
  chrome.storage.local.set({ [SESSION_LOGGED_IN_KEY]: isLoggedIn }, function () {
    logStorageError("setLoggedIn");
    if (callback) {
      callback(!chrome.runtime.lastError);
    }
  });
}

/**
 * Same rule as content.js: URLs without http(s) get https:// so links always work.
 */
function ensureHttpsUrl(raw) {
  const t = (raw || "").trim();
  if (!t) {
    return "";
  }
  if (/^https?:\/\//i.test(t)) {
    return t;
  }
  return "https://" + t;
}

function shortUrl(url) {
  try {
    const u = new URL(ensureHttpsUrl(url));
    return u.hostname + u.pathname;
  } catch (e) {
    return url || "";
  }
}

/**
 * Open the saved website URL in a new browser tab.
 * Requires "tabs" in manifest.json so chrome.tabs.create works from the popup.
 */
function openWebsiteInNewTab(rawUrl) {
  const savedUrl = ensureHttpsUrl(rawUrl);
  if (!savedUrl) {
    return;
  }
  chrome.tabs.create({ url: savedUrl });
}

/** Read website URL from an entry (new field or old "url" for older saves). */
function getAccountWebsiteUrl(a) {
  if (a.websiteUrl && typeof a.websiteUrl === "string") {
    return a.websiteUrl;
  }
  if (a.url && typeof a.url === "string") {
    return a.url;
  }
  return "";
}

/** Friendly title for the card (new siteName or shortened URL). */
function getAccountSiteName(a) {
  if (a.siteName && String(a.siteName).trim()) {
    return String(a.siteName).trim();
  }
  const u = getAccountWebsiteUrl(a);
  return u ? shortUrl(u) : "Saved account";
}

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
    const displayUrl = getAccountWebsiteUrl(a);
    site.textContent = getAccountSiteName(a);
    site.title = displayUrl ? ensureHttpsUrl(displayUrl) : "";

    if (displayUrl) {
      const urlLine = document.createElement("div");
      urlLine.className = "account-url-line";
      urlLine.textContent = shortUrl(displayUrl);
      li.appendChild(site);
      li.appendChild(urlLine);
    } else {
      li.appendChild(site);
    }

    const user = document.createElement("div");
    user.className = "account-user";
    user.textContent = "Username: " + (a.username || "(none)");

    const openRow = document.createElement("div");
    openRow.className = "account-open-row";
    const openBtn = document.createElement("button");
    openBtn.type = "button";
    openBtn.className = "btn-open-site";
    openBtn.textContent = "Open website";
    const urlToOpen = getAccountWebsiteUrl(a);
    openBtn.disabled = !urlToOpen;
    openBtn.addEventListener("click", function () {
      openWebsiteInNewTab(urlToOpen);
    });

    openRow.appendChild(openBtn);

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

    li.appendChild(user);
    li.appendChild(openRow);
    li.appendChild(passRow);
    accountList.appendChild(li);
  }
}

function refreshDashboard() {
  chrome.storage.local.get([STORAGE_ACCOUNTS_KEY], function (result) {
    logStorageError("refreshDashboard");
    const list = result[STORAGE_ACCOUNTS_KEY];
    renderAccountList(Array.isArray(list) ? list : []);
  });
}

/**
 * Popup opened: read master + isLoggedIn together from chrome.storage.local.
 */
function boot() {
  bootLoading.hidden = false;

  chrome.storage.local.get([MASTER_STORAGE_KEY, SESSION_LOGGED_IN_KEY], function (result) {
    logStorageError("boot");
    bootLoading.hidden = true;

    if (chrome.runtime.lastError) {
      signupError.textContent = "Could not read storage.";
      signupError.hidden = false;
      showView("signup");
      return;
    }

    const raw = result[MASTER_STORAGE_KEY];
    let master = null;
    if (raw != null && typeof raw === "object") {
      const u = raw.username;
      const p = raw.password;
      if (typeof u === "string" && typeof p === "string") {
        master = { username: u, password: p };
      }
    }

    const isLoggedIn = result[SESSION_LOGGED_IN_KEY] === true;

    if (!master) {
      if (isLoggedIn) {
        setLoggedIn(false, null);
      }
      signupError.hidden = true;
      signupError.textContent = "";
      showView("signup");
      return;
    }

    if (isLoggedIn) {
      setDashboardSessionMessage("remembered");
      showView("dashboard");
      refreshDashboard();
      return;
    }

    loginError.hidden = true;
    loginError.textContent = "";
    loginUser.value = "";
    loginPass.value = "";
    showView("login");
  });
}

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

  saveMaster(u, p, function (ok) {
    if (!ok) {
      signupError.textContent = "Could not save account. Check extension storage permission.";
      signupError.hidden = false;
      return;
    }

    setLoggedIn(false, function () {
      signupUser.value = "";
      signupPass.value = "";

      loginError.hidden = true;
      loginError.textContent = "";
      loginUser.value = u;
      loginPass.value = "";

      showView("login");
      loginUser.focus();
    });
  });
});

loginForm.addEventListener("submit", function (e) {
  e.preventDefault();
  loginError.hidden = true;
  loginError.textContent = "";

  const u = loginUser.value.trim();
  const p = loginPass.value;

  loadMaster(function (master) {
    if (!master) {
      showView("signup");
      signupError.textContent = "No master account found. Create one below.";
      signupError.hidden = false;
      return;
    }

    if (u === master.username && p === master.password) {
      setLoggedIn(true, function () {
        setDashboardSessionMessage("fresh");
        showView("dashboard");
        refreshDashboard();
      });
    } else {
      loginError.textContent = "Incorrect username or password.";
      loginError.hidden = false;
    }
  });
});

function performPopupLogout() {
  setLoggedIn(false, function () {
    loginUser.value = "";
    loginPass.value = "";
    loginError.hidden = true;
    loginError.textContent = "";
    showView("login");
  });
}

logoutBtn.addEventListener("click", performPopupLogout);
dashboardLogoutBtn.addEventListener("click", performPopupLogout);

boot();
