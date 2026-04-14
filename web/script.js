/**
 * Password Manager — HTML/CSS/JS only.
 * Master account: sign up once (localStorage), then log in. Vault uses XOR + localStorage.
 */

// XOR key for website passwords (not the master password — stored as plain text for this demo)
const ENCRYPTION_KEY = "K";

// localStorage: saved website accounts [{ site, username, encryptedPassword }, ...]
const STORAGE_KEY = "passwordManagerAccounts";
// localStorage: one master user { username, password } — homework demo only (real apps use hashing)
const MASTER_STORAGE_KEY = "passwordManagerMaster";
// sessionStorage: remember this tab signed in after master login
const SESSION_KEY = "passwordManagerSession";

// --- Page elements ---
const authView = document.getElementById("authView");
const dashboardView = document.getElementById("dashboardView");

const tabSignup = document.getElementById("tabSignup");
const tabLogin = document.getElementById("tabLogin");
const signupPanel = document.getElementById("signupPanel");
const loginPanel = document.getElementById("loginPanel");
const signupForm = document.getElementById("signupForm");
const signupUser = document.getElementById("signupUser");
const signupPass = document.getElementById("signupPass");
const signupError = document.getElementById("signupError");
const signupOk = document.getElementById("signupOk");
const linkToLogin = document.getElementById("linkToLogin");
const linkToSignup = document.getElementById("linkToSignup");

const loginForm = document.getElementById("loginForm");
const loginSuccess = document.getElementById("loginSuccess");
const loginError = document.getElementById("loginError");
const logoutBtn = document.getElementById("logoutBtn");

const addForm = document.getElementById("addForm");
const accSite = document.getElementById("accSite");
const accUser = document.getElementById("accUser");
const accPass = document.getElementById("accPass");
const genPassBtn = document.getElementById("genPassBtn");
const addMsg = document.getElementById("addMsg");

const accountsList = document.getElementById("accountsList");
const accountsEmpty = document.getElementById("accountsEmpty");

/**
 * Strong password rules (updated for better security):
 * - At least 8 characters (longer is allowed — more characters usually means harder to crack).
 * - At least one uppercase, one lowercase, one digit, and one symbol.
 */
function isStrongPassword(password) {
  // Reject too-short passwords (fewer than 8 characters).
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

/**
 * Builds a random strong password.
 * Length is random from 8 to 12 — still always passes isStrongPassword().
 */
function generateStrongPassword() {
  const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lower = "abcdefghijklmnopqrstuvwxyz";
  const digits = "0123456789";
  const symbols = "!@#$%&*";
  const all = upper + lower + digits + symbols;

  // Pick total length: 8, 9, 10, 11, or 12 (more length = more possible combinations).
  const targetLength = 8 + Math.floor(Math.random() * 5);

  const chars = [];
  // Guarantee one of each required type first.
  chars.push(upper[Math.floor(Math.random() * upper.length)]);
  chars.push(lower[Math.floor(Math.random() * lower.length)]);
  chars.push(digits[Math.floor(Math.random() * digits.length)]);
  chars.push(symbols[Math.floor(Math.random() * symbols.length)]);

  // Fill the rest up to targetLength with random allowed characters.
  while (chars.length < targetLength) {
    chars.push(all[Math.floor(Math.random() * all.length)]);
  }

  // Shuffle so required characters are not always at the start.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = chars[i];
    chars[i] = chars[j];
    chars[j] = t;
  }

  return chars.join("");
}

function encrypt(password, key) {
  if (password == null) {
    return "";
  }
  const k = key.charCodeAt(0);
  let out = "";
  for (let i = 0; i < password.length; i++) {
    out += String.fromCharCode(password.charCodeAt(i) ^ k);
  }
  return out;
}

function decrypt(encryptedText, key) {
  return encrypt(encryptedText, key);
}

/** Read master account from localStorage, or null if none / bad data */
function loadMaster() {
  try {
    const raw = localStorage.getItem(MASTER_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const obj = JSON.parse(raw);
    if (obj && typeof obj.username === "string" && typeof obj.password === "string") {
      return { username: obj.username, password: obj.password };
    }
    return null;
  } catch (e) {
    return null;
  }
}

/** Save the one allowed master account (username + password) */
function saveMaster(username, password) {
  localStorage.setItem(
    MASTER_STORAGE_KEY,
    JSON.stringify({ username: username, password: password })
  );
}

function buildDemoAccounts() {
  const rows = [
    ["Gmail", "user01", "Ab1!xyZa"],
    ["GitHub", "dev_student", "Bc2@mnOp"],
    ["Canvas", "stu123", "Cd3#pqRs"],
    ["Library", "borrower1", "De4$rsTu"],
    ["BankApp", "client_a", "Ef5%uvWx"],
    ["ShopSite", "buyer99", "Fg6&yzAb"],
    ["Forum", "poster_x", "Gh7*bcDe"],
    ["Cloud", "sync_user", "Hi8!fgHi"],
    ["News", "reader01", "Ij9@ijKl"],
    ["Games", "player42", "Jk0#mnop"],
  ];

  const list = [];
  for (let i = 0; i < rows.length; i++) {
    list.push({
      site: rows[i][0],
      username: rows[i][1],
      encryptedPassword: encrypt(rows[i][2], ENCRYPTION_KEY),
    });
  }
  return list;
}

function loadAccountsFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    let data = [];
    if (raw) {
      const parsed = JSON.parse(raw);
      data = Array.isArray(parsed) ? parsed : [];
    }
    if (data.length === 0) {
      data = buildDemoAccounts();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }
    return data;
  } catch (e) {
    const demos = buildDemoAccounts();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(demos));
    return demos;
  }
}

function saveAccountsToStorage(accounts) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
}

/**
 * Simulate logging in to one saved vault entry (by list index).
 * Not used by the current UI — kept for assignments, demos, or browser console tests.
 * Uses decrypt() to compare the stored password with passwordTry.
 *
 * @param {number|string} accountIndex which account in loadAccountsFromStorage() (0 = first)
 * @param {string} passwordTry password the user claims to have
 * @returns {string} "Signed in" or "Error! Wrong username or password!"
 */
function simulateLogin(accountIndex, passwordTry) {
  const idx =
    typeof accountIndex === "number" ? accountIndex : parseInt(accountIndex, 10);
  if (isNaN(idx) || passwordTry == null) {
    return "Error! Wrong username or password!";
  }

  const accounts = loadAccountsFromStorage();
  const account = accounts[idx];
  if (!account) {
    return "Error! Wrong username or password!";
  }

  const storedPlain = decrypt(account.encryptedPassword, ENCRYPTION_KEY);
  if (storedPlain === passwordTry) {
    return "Signed in";
  }
  return "Error! Wrong username or password!";
}

/** true = Sign up panel, false = Log in panel */
function showAuthPanel(signupActive) {
  if (signupActive) {
    tabSignup.classList.add("auth-tab--active");
    tabLogin.classList.remove("auth-tab--active");
    tabSignup.setAttribute("aria-selected", "true");
    tabLogin.setAttribute("aria-selected", "false");
    signupPanel.classList.remove("auth-panel--hidden");
    loginPanel.classList.add("auth-panel--hidden");
  } else {
    tabLogin.classList.add("auth-tab--active");
    tabSignup.classList.remove("auth-tab--active");
    tabLogin.setAttribute("aria-selected", "true");
    tabSignup.setAttribute("aria-selected", "false");
    loginPanel.classList.remove("auth-panel--hidden");
    signupPanel.classList.add("auth-panel--hidden");
  }
}

/** Show sign-up / log-in screens (not the vault) */
function showAuth(preferSignup) {
  sessionStorage.removeItem(SESSION_KEY);
  authView.classList.remove("view--hidden");
  dashboardView.classList.add("view--hidden");
  showAuthPanel(preferSignup);
}

function showDashboard() {
  sessionStorage.setItem(SESSION_KEY, "ok");
  authView.classList.add("view--hidden");
  dashboardView.classList.remove("view--hidden");
  renderAccounts();
}

function renderAccounts() {
  const accounts = loadAccountsFromStorage();

  accountsList.innerHTML = "";

  if (accounts.length === 0) {
    accountsEmpty.hidden = false;
    accountsEmpty.textContent = "No accounts yet. Add one above.";
    return;
  }

  accountsEmpty.hidden = true;

  for (let i = 0; i < accounts.length; i++) {
    const a = accounts[i];
    // Password stays encrypted in memory until the user clicks the eye (see toggle handler below).
    // XOR keeps the same string length, so we can build a mask without decrypting.
    const maskLength = a.encryptedPassword.length;

    const li = document.createElement("li");
    li.className = "account-item";

    const siteEl = document.createElement("div");
    siteEl.className = "account-item__site";
    siteEl.textContent = a.site;

    const userEl = document.createElement("div");
    userEl.className = "account-item__meta";
    userEl.textContent = "Username: " + a.username;

    const passRow = document.createElement("div");
    passRow.className = "account-item__pass-row";

    const passLabel = document.createElement("span");
    passLabel.className = "account-item__pass-label";
    passLabel.textContent = "Password: ";

    const passText = document.createElement("span");
    passText.className = "account-item__pass-text";
    passText.textContent = "*".repeat(maskLength);

    const toggleBtn = document.createElement("button");
    toggleBtn.type = "button";
    toggleBtn.className = "account-item__toggle";
    toggleBtn.setAttribute("data-index", String(i));
    toggleBtn.setAttribute("aria-label", "Show password");
    toggleBtn.setAttribute("aria-pressed", "false");
    // Eye icon — click to reveal password using decrypt().
    toggleBtn.textContent = "\uD83D\uDC41\uFE0F";

    passRow.appendChild(passLabel);
    passRow.appendChild(passText);
    passRow.appendChild(toggleBtn);
    li.appendChild(siteEl);
    li.appendChild(userEl);
    li.appendChild(passRow);
    accountsList.appendChild(li);
  }
}

/**
 * Show / hide password toggle (event delegation on the list).
 * - One click: decrypt() the stored ciphertext and show the real password.
 * - Next click: hide again with stars (nothing new is saved to localStorage).
 */
accountsList.addEventListener("click", function (event) {
  const btn = event.target.closest(".account-item__toggle");
  if (!btn) {
    return;
  }

  const index = parseInt(btn.getAttribute("data-index"), 10);
  const all = loadAccountsFromStorage();
  const acc = all[index];
  if (!acc) {
    return;
  }

  const row = btn.closest(".account-item");
  const textSpan = row.querySelector(".account-item__pass-text");
  const mask = "*".repeat(acc.encryptedPassword.length);

  const isVisible = row.classList.contains("account-item--revealed");

  if (isVisible) {
    row.classList.remove("account-item--revealed");
    textSpan.textContent = mask;
    btn.textContent = "\uD83D\uDC41\uFE0F";
    btn.setAttribute("aria-label", "Show password");
    btn.setAttribute("aria-pressed", "false");
  } else {
    row.classList.add("account-item--revealed");
    textSpan.textContent = decrypt(acc.encryptedPassword, ENCRYPTION_KEY);
    btn.textContent = "\uD83D\uDE48";
    btn.setAttribute("aria-label", "Hide password");
    btn.setAttribute("aria-pressed", "true");
  }
});

function clearSignupMessages() {
  signupError.hidden = true;
  signupError.textContent = "";
  signupOk.hidden = true;
  signupOk.textContent = "";
}

function clearLoginError() {
  loginError.hidden = true;
  loginError.textContent = "";
  loginSuccess.hidden = true;
  loginSuccess.textContent = "";
}

// Preload vault demo data when the app loads (separate from master account)
loadAccountsFromStorage();

const master = loadMaster();
const sessionOk = sessionStorage.getItem(SESSION_KEY) === "ok";

if (sessionOk && master) {
  showDashboard();
} else {
  showAuth(!master);
}

tabSignup.addEventListener("click", function () {
  clearSignupMessages();
  clearLoginError();
  showAuthPanel(true);
});

tabLogin.addEventListener("click", function () {
  clearSignupMessages();
  clearLoginError();
  showAuthPanel(false);
});

linkToLogin.addEventListener("click", function () {
  clearSignupMessages();
  clearLoginError();
  showAuthPanel(false);
});

linkToSignup.addEventListener("click", function () {
  clearLoginError();
  clearSignupMessages();
  showAuthPanel(true);
});

signupForm.addEventListener("submit", function (e) {
  e.preventDefault();
  clearSignupMessages();

  if (loadMaster() !== null) {
    showAuthPanel(false);
    loginSuccess.hidden = true;
    loginError.textContent =
      "A master account already exists. Please log in with your saved credentials.";
    loginError.hidden = false;
    return;
  }

  const u = signupUser.value.trim();
  const p = signupPass.value;

  if (u.length === 0) {
    signupError.textContent = "Please enter a username.";
    signupError.hidden = false;
    return;
  }

  if (!isStrongPassword(p)) {
    signupError.textContent =
      "Master password must be at least 8 characters with uppercase, lowercase, number, and symbol.";
    signupError.hidden = false;
    return;
  }

  saveMaster(u, p);
  signupUser.value = "";
  signupPass.value = "";
  signupOk.hidden = true;
  showAuthPanel(false);
  loginError.hidden = true;
  loginError.textContent = "";
  loginSuccess.textContent = "Master account created. Enter your username and password to sign in.";
  loginSuccess.hidden = false;
});

loginForm.addEventListener("submit", function (e) {
  e.preventDefault();
  clearLoginError();

  const saved = loadMaster();
  if (saved === null) {
    loginError.textContent = "No master account yet. Please sign up first.";
    loginError.hidden = false;
    showAuthPanel(true);
    return;
  }

  const u = document.getElementById("masterUser").value.trim();
  const p = document.getElementById("masterPass").value;

  if (u === saved.username && p === saved.password) {
    loginSuccess.hidden = true;
    showDashboard();
  } else {
    loginSuccess.hidden = true;
    loginError.textContent = "Incorrect master username or password.";
    loginError.hidden = false;
  }
});

/** Leave the vault and show the master login / sign-up screens again. */
function performLogout() {
  document.getElementById("masterUser").value = "";
  document.getElementById("masterPass").value = "";
  clearLoginError();
  clearSignupMessages();
  showAuth(false);
}

logoutBtn.addEventListener("click", performLogout);
document.getElementById("dashboardLogoutBtn").addEventListener("click", performLogout);

genPassBtn.addEventListener("click", function () {
  accPass.value = generateStrongPassword();
  addMsg.textContent = "Generated a new strong password.";
  addMsg.className = "msg msg--ok";
});

addForm.addEventListener("submit", function (e) {
  e.preventDefault();
  const site = accSite.value.trim();
  const username = accUser.value.trim();
  const password = accPass.value;

  if (!isStrongPassword(password)) {
    addMsg.textContent =
      "Only strong passwords are allowed: at least 8 characters with upper, lower, number, and symbol.";
    addMsg.className = "msg msg--error";
    return;
  }

  const accounts = loadAccountsFromStorage();
  accounts.push({
    site: site,
    username: username,
    encryptedPassword: encrypt(password, ENCRYPTION_KEY),
  });
  saveAccountsToStorage(accounts);

  addMsg.textContent = "Saved. Password is stored encrypted in localStorage.";
  addMsg.className = "msg msg--ok";
  accSite.value = "";
  accUser.value = "";
  accPass.value = "";
  renderAccounts();
});
