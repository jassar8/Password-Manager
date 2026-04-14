/**
 * content.js — runs on every http(s) page.
 * Finds forms that look like login forms and asks whether to save credentials on submit.
 */

// Same fixed XOR key as in your homework (not secure for real secrets).
const ENCRYPTION_KEY = "K";

// Storage key: one array of saved account objects.
const STORAGE_ACCOUNTS_KEY = "spm_accounts";

/** XOR encrypt/decrypt (symmetric). */
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

/**
 * Guess the username field: walk inputs in order; use the last non-password
 * field before the password (common login layout: user then pass).
 */
function findUsernameInput(form, passwordInput) {
  const inputs = Array.prototype.slice.call(form.querySelectorAll("input"));
  const passIdx = inputs.indexOf(passwordInput);
  if (passIdx <= 0) {
    return null;
  }
  for (let i = passIdx - 1; i >= 0; i--) {
    const el = inputs[i];
    const t = (el.type || "").toLowerCase();
    if (t === "password" || t === "hidden" || t === "submit" || t === "button" || t === "checkbox" || t === "radio") {
      continue;
    }
    return el;
  }
  return null;
}

/**
 * Load accounts from chrome.storage.local (extension-only storage).
 */
function loadAccounts(callback) {
  chrome.storage.local.get([STORAGE_ACCOUNTS_KEY], function (result) {
    const list = result[STORAGE_ACCOUNTS_KEY];
    callback(Array.isArray(list) ? list : []);
  });
}

/**
 * Append one account and save back to chrome.storage.local.
 */
function saveAccount(entry, callback) {
  loadAccounts(function (accounts) {
    accounts.push(entry);
    chrome.storage.local.set({ [STORAGE_ACCOUNTS_KEY]: accounts }, callback);
  });
}

/**
 * Inject a small modal into the page (not the extension popup — users see it on the site).
 */
function showSavePrompt(siteUrl, username, password, onSave, onSkip) {
  const existing = document.getElementById("spm-save-overlay");
  if (existing) {
    existing.remove();
  }

  const overlay = document.createElement("div");
  overlay.id = "spm-save-overlay";
  overlay.setAttribute(
    "style",
    [
      "position:fixed",
      "inset:0",
      "background:rgba(0,0,0,0.45)",
      "z-index:2147483646",
      "display:flex",
      "align-items:center",
      "justify-content:center",
      "font-family:system-ui,sans-serif",
    ].join(";")
  );

  const box = document.createElement("div");
  box.setAttribute(
    "style",
    [
      "background:#fff",
      "color:#111",
      "padding:20px 22px",
      "border-radius:12px",
      "max-width:92vw",
      "width:380px",
      "box-shadow:0 12px 40px rgba(0,0,0,0.25)",
    ].join(";")
  );

  const title = document.createElement("p");
  title.textContent = "Do you want to save this account?";
  title.setAttribute("style", "margin:0 0 12px;font-size:17px;font-weight:600;");

  const info = document.createElement("div");
  info.setAttribute("style", "font-size:13px;line-height:1.5;color:#333;margin-bottom:16px;");
  info.innerHTML =
    "<strong>Site:</strong> " +
    escapeHtml(siteUrl) +
    "<br><strong>Username:</strong> " +
    escapeHtml(username) +
    "<br><strong>Password:</strong> " +
    (password ? "••••••••" : "(empty)");

  const row = document.createElement("div");
  row.setAttribute("style", "display:flex;gap:10px;justify-content:flex-end;");

  const btnSkip = document.createElement("button");
  btnSkip.type = "button";
  btnSkip.textContent = "Not now";
  btnSkip.setAttribute(
    "style",
    "padding:8px 14px;border-radius:8px;border:1px solid #ccc;background:#f5f5f5;cursor:pointer;"
  );

  const btnSave = document.createElement("button");
  btnSave.type = "button";
  btnSave.textContent = "Save";
  btnSave.setAttribute(
    "style",
    "padding:8px 14px;border-radius:8px;border:none;background:#1a73e8;color:#fff;cursor:pointer;font-weight:600;"
  );

  btnSkip.addEventListener("click", function () {
    overlay.remove();
    onSkip();
  });

  btnSave.addEventListener("click", function () {
    const encrypted = encrypt(password, ENCRYPTION_KEY);
    const entry = {
      id: String(Date.now()),
      url: siteUrl,
      username: username,
      encryptedPassword: encrypted,
    };
    saveAccount(entry, function () {
      overlay.remove();
      onSave();
    });
  });

  row.appendChild(btnSkip);
  row.appendChild(btnSave);
  box.appendChild(title);
  box.appendChild(info);
  box.appendChild(row);
  overlay.appendChild(box);
  document.documentElement.appendChild(overlay);
}

function escapeHtml(s) {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

/**
 * Attach submit handler to one form that has a password field.
 */
function attachToForm(form) {
  const passInput = form.querySelector('input[type="password"]');
  if (!passInput) {
    return;
  }

  // Username is optional (some forms are password-only); we still offer to save.
  const userInput = findUsernameInput(form, passInput);

  // If we already hooked this form, skip.
  if (form.dataset.spmHooked === "1") {
    return;
  }
  form.dataset.spmHooked = "1";

  form.addEventListener(
    "submit",
    function (event) {
      if (form.dataset.spmSkipPrompt === "1") {
        form.dataset.spmSkipPrompt = "0";
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      const siteUrl = location.href.split("#")[0];
      const username = userInput ? (userInput.value || "").trim() : "";
      const password = passInput.value || "";

      showSavePrompt(
        siteUrl,
        username,
        password,
        function () {
          form.dataset.spmSkipPrompt = "1";
          form.submit();
        },
        function () {
          form.dataset.spmSkipPrompt = "1";
          form.submit();
        }
      );
    },
    true
  );
}

/**
 * Scan the document for login-like forms and hook them.
 */
function scanForms() {
  document.querySelectorAll("form").forEach(function (form) {
    attachToForm(form);
  });
}

// Initial scan
scanForms();

// Dynamic sites (SPA) may add forms later — watch for new nodes.
const observer = new MutationObserver(function () {
  scanForms();
});
observer.observe(document.documentElement, { childList: true, subtree: true });
