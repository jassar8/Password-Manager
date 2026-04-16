/**
 * web/script.js
 * Loads accounts from backend and displays them.
 */

const BACKEND_URL = "http://localhost:3000";
const XOR_KEY = "K";

const refreshBtn = document.getElementById("refreshBtn");
const statusText = document.getElementById("statusText");
const accountsList = document.getElementById("accountsList");

function setStatus(message, isError) {
  statusText.textContent = message;
  statusText.style.color = isError ? "#b91c1c" : "#374151";
}

function xorDecrypt(text, key) {
  if (!text) {
    return "";
  }
  const keyCode = key.charCodeAt(0);
  let out = "";
  for (let i = 0; i < text.length; i++) {
    out += String.fromCharCode(text.charCodeAt(i) ^ keyCode);
  }
  return out;
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

function buildAccountCard(account) {
  const li = document.createElement("li");
  li.className = "account-card";
  const siteName = account.siteName || "Unknown site";
  const websiteUrl = safeUrl(account.websiteUrl);
  const username = account.username || "-";
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
    urlLine.innerHTML = '<span class="meta-label">URL:</span> -';
  }

  const userLine = document.createElement("div");
  userLine.className = "meta-line";
  userLine.innerHTML = `<span class="meta-label">Username:</span> ${username}`;

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

  let isVisible = false;
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

async function loadAccounts() {
  setStatus("Loading accounts...", false);
  accountsList.innerHTML = "";

  try {
    const response = await fetch(BACKEND_URL + "/accounts");
    if (!response.ok) {
      throw new Error("Failed to load accounts.");
    }

    const accounts = await response.json();
    if (!Array.isArray(accounts) || accounts.length === 0) {
      setStatus("No saved accounts yet.", false);
      return;
    }

    accounts.forEach(function (account) {
      accountsList.appendChild(buildAccountCard(account));
    });

    setStatus("Loaded " + accounts.length + " account(s).", false);
  } catch (error) {
    const msg = error && error.message ? error.message : String(error);
    setStatus("Could not connect to backend at " + BACKEND_URL + ". " + msg, true);
  }
}

refreshBtn.addEventListener("click", loadAccounts);

loadAccounts();
