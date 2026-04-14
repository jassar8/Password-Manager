/**
 * Password Manager — homework web app (HTML/CSS/JS only).
 * Master login, XOR encryption in localStorage, strong8-char passwords, demo data.
 */

// --- Master login (blocks dashboard until correct) ---
const MASTER_USERNAME = "admin";
const MASTER_PASSWORD = "Adm1!nXy";

// Fixed XOR key for encrypt/decrypt (assignment)
const ENCRYPTION_KEY = "K";

// localStorage key: array of { site, username, encryptedPassword }
const STORAGE_KEY = "passwordManagerAccounts";
// Remember this browser tab session after master login
const SESSION_KEY = "passwordManagerSession";

// --- Page elements ---
const loginView = document.getElementById("loginView");
const dashboardView = document.getElementById("dashboardView");
const loginForm = document.getElementById("loginForm");
const loginError = document.getElementById("loginError");
const logoutBtn = document.getElementById("logoutBtn");

const addForm = document.getElementById("addForm");
const accSite = document.getElementById("accSite");
const accUser = document.getElementById("accUser");
const accPass = document.getElementById("accPass");
const genPassBtn = document.getElementById("genPassBtn");
const addMsg = document.getElementById("addMsg");

const simForm = document.getElementById("simForm");
const simAccountSelect = document.getElementById("simAccountSelect");
const simPass = document.getElementById("simPass");
const simMsg = document.getElementById("simMsg");

const accountsList = document.getElementById("accountsList");
const accountsEmpty = document.getElementById("accountsEmpty");

/**
 * Strong password rules: length exactly 8, and upper + lower + number + symbol.
 */
function isStrongPassword(password) {
  if (password == null || password.length !== 8) {
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
 * Random password that always passes isStrongPassword (length 8).
 */
function generateStrongPassword() {
  const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lower = "abcdefghijklmnopqrstuvwxyz";
  const digits = "0123456789";
  const symbols = "!@#$%&*";
  const all = upper + lower + digits + symbols;

  const chars = [];
  chars.push(upper[Math.floor(Math.random() * upper.length)]);
  chars.push(lower[Math.floor(Math.random() * lower.length)]);
  chars.push(digits[Math.floor(Math.random() * digits.length)]);
  chars.push(symbols[Math.floor(Math.random() * symbols.length)]);

  for (let i = 4; i < 8; i++) {
    chars.push(all[Math.floor(Math.random() * all.length)]);
  }

  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = chars[i];
    chars[i] = chars[j];
    chars[j] = t;
  }

  return chars.join("");
}

/**
 * XOR each character with the key. Decrypt is the same operation.
 */
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

/**
 * 10 demo accounts for class demonstration (plain passwords are strong, then encrypted).
 */
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
    const site = rows[i][0];
    const username = rows[i][1];
    const plain = rows[i][2];
    list.push({
      site: site,
      username: username,
      encryptedPassword: encrypt(plain, ENCRYPTION_KEY),
    });
  }
  return list;
}

/**
 * Read accounts from localStorage. If missing or empty, save 10 demo accounts.
 */
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

/** Fill the simulate-login dropdown from the current list (by array index). */
function refreshSimAccountSelect(accounts) {
  while (simAccountSelect.options.length > 1) {
    simAccountSelect.remove(1);
  }
  for (let i = 0; i < accounts.length; i++) {
    const a = accounts[i];
    const opt = document.createElement("option");
    opt.value = String(i);
    opt.textContent = a.site + " — " + a.username;
    simAccountSelect.appendChild(opt);
  }
}

function showLogin() {
  sessionStorage.removeItem(SESSION_KEY);
  loginView.classList.remove("view--hidden");
  dashboardView.classList.add("view--hidden");
}

function showDashboard() {
  sessionStorage.setItem(SESSION_KEY, "ok");
  loginView.classList.add("view--hidden");
  dashboardView.classList.remove("view--hidden");
  renderAccounts();
}

/**
 * Show all accounts with decrypted passwords. Also refresh simulate-login choices.
 */
function renderAccounts() {
  const accounts = loadAccountsFromStorage();
  refreshSimAccountSelect(accounts);

  accountsList.innerHTML = "";

  if (accounts.length === 0) {
    accountsEmpty.hidden = false;
    accountsEmpty.textContent = "No accounts yet. Add one above.";
    return;
  }

  accountsEmpty.hidden = true;

  for (let i = 0; i < accounts.length; i++) {
    const a = accounts[i];
    const plain = decrypt(a.encryptedPassword, ENCRYPTION_KEY);

    const li = document.createElement("li");
    li.className = "account-item";

    const siteEl = document.createElement("div");
    siteEl.className = "account-item__site";
    siteEl.textContent = a.site;

    const userEl = document.createElement("div");
    userEl.className = "account-item__meta";
    userEl.textContent = "Username: " + a.username;

    const passEl = document.createElement("div");
    passEl.className = "account-item__pass";
    passEl.textContent = "Password (decrypted): " + plain;

    li.appendChild(siteEl);
    li.appendChild(userEl);
    li.appendChild(passEl);
    accountsList.appendChild(li);
  }
}

// --- App start: load storage whenever the page opens (demos if empty) ---
loadAccountsFromStorage();

if (sessionStorage.getItem(SESSION_KEY) === "ok") {
  showDashboard();
} else {
  showLogin();
}

loginForm.addEventListener("submit", function (e) {
  e.preventDefault();
  const u = document.getElementById("masterUser").value.trim();
  const p = document.getElementById("masterPass").value;

  if (u === MASTER_USERNAME && p === MASTER_PASSWORD) {
    loginError.hidden = true;
    loginError.textContent = "";
    showDashboard();
  } else {
    loginError.textContent = "Incorrect master username or password.";
    loginError.hidden = false;
  }
});

logoutBtn.addEventListener("click", function () {
  showLogin();
  document.getElementById("masterUser").value = "";
  document.getElementById("masterPass").value = "";
});

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
      "Only strong passwords are allowed: exactly 8 characters with upper, lower, number, and symbol.";
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

simForm.addEventListener("submit", function (e) {
  e.preventDefault();
  const idx = parseInt(simAccountSelect.value, 10);
  const passwordTry = simPass.value;

  if (simAccountSelect.value === "" || isNaN(idx)) {
    simMsg.textContent = "Error! Wrong username or password!";
    simMsg.className = "msg msg--error";
    return;
  }

  const accounts = loadAccountsFromStorage();
  const account = accounts[idx];
  if (!account) {
    simMsg.textContent = "Error! Wrong username or password!";
    simMsg.className = "msg msg--error";
    return;
  }

  const storedPlain = decrypt(account.encryptedPassword, ENCRYPTION_KEY);
  if (storedPlain === passwordTry) {
    simMsg.textContent = "Signed in";
    simMsg.className = "msg msg--ok";
  } else {
    simMsg.textContent = "Error! Wrong username or password!";
    simMsg.className = "msg msg--error";
  }
});
