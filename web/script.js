/**
 * web/script.js
 * Loads accounts from backend and displays them.
 *
 * If someone could read your stored accounts (for example from the server,
 * browser localStorage, or extension storage), the password would still look
 * like nonsense letters and symbols — not your real password — because we only
 * save the encrypted form.
 *
 * This is simple demonstration encryption (XOR). Real systems use stronger
 * methods (like AES) and protect the key much more carefully than this demo.
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

/**
 * Decryption is the reverse of encryption: we turn scrambled data back into text.
 * The stored password is still not plain text until we decrypt it here. This
 * project uses XOR with the same secret key as encrypt. XOR with the same key
 * twice gives the original character, so decrypt is the same steps as encrypt.
 */
function xorDecrypt(text, key) {
  if (!text) {
    return "";
  }
  const keyCode = key.charCodeAt(0);
  let out = "";
  for (let i = 0; i < text.length; i++) {
    // XOR the stored character with the key again — that undoes encryption
    // and brings back the original password character.
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
    const response = await fetch(BACKEND_URL + "/accounts", { cache: "no-store" });
    const rawText = await response.text();
    let data = null;
    try {
      data = rawText ? JSON.parse(rawText) : null;
    } catch (parseErr) {
      setStatus(
        "Backend at " +
          BACKEND_URL +
          " returned non-JSON (HTTP " +
          response.status +
          "). Is the server running? First line of response: " +
          rawText.slice(0, 120),
        true
      );
      return;
    }

    if (!response.ok) {
      const serverMsg =
        data && typeof data.message === "string" ? data.message : "HTTP " + response.status;
      setStatus("Could not load accounts: " + serverMsg, true);
      return;
    }

    const accounts = data;
    if (!Array.isArray(accounts) || accounts.length === 0) {
      setStatus("No saved accounts yet. Save a login from the extension, then click Refresh.", false);
      console.log("accounts loaded — list is empty");
      return;
    }

    accounts.forEach(function (account) {
      accountsList.appendChild(buildAccountCard(account));
    });

    setStatus("Loaded " + accounts.length + " account(s).", false);
    console.log("accounts loaded — " + accounts.length + " account(s)");
  } catch (error) {
    const msg = error && error.message ? error.message : String(error);
    setStatus(
      "Could not reach backend at " +
        BACKEND_URL +
        ". Start the server (npm start), then refresh this page. Details: " +
        msg,
      true
    );
  }
}

refreshBtn.addEventListener("click", loadAccounts);

loadAccounts();
