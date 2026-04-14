/**
 * content.js — runs on every http(s) page.
 * Finds login forms, then offers to save: site name, website URL, username, encrypted password.
 */

const ENCRYPTION_KEY = "K";
const STORAGE_ACCOUNTS_KEY = "spm_accounts";

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
 * If the user types "amazon.com" or "//amazon.com", make it a full https URL before saving/opening.
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

function loadAccounts(callback) {
  chrome.storage.local.get([STORAGE_ACCOUNTS_KEY], function (result) {
    const list = result[STORAGE_ACCOUNTS_KEY];
    callback(Array.isArray(list) ? list : []);
  });
}

function saveAccount(entry, callback) {
  loadAccounts(function (accounts) {
    accounts.push(entry);
    chrome.storage.local.set({ [STORAGE_ACCOUNTS_KEY]: accounts }, callback);
  });
}

function escapeHtml(s) {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

function labelStyle() {
  return "display:block;font-size:12px;font-weight:600;margin:10px 0 4px;color:#333;";
}

function inputStyle() {
  return "width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid #ccc;border-radius:8px;font-size:14px;";
}

/**
 * Modal: user can edit site name + website URL before saving.
 */
function showSavePrompt(defaultSiteName, defaultUrl, username, password, onSave, onSkip) {
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
      "width:400px",
      "box-shadow:0 12px 40px rgba(0,0,0,0.25)",
    ].join(";")
  );

  const title = document.createElement("p");
  title.textContent = "Do you want to save this account?";
  title.setAttribute("style", "margin:0 0 12px;font-size:17px;font-weight:600;");

  const lblName = document.createElement("label");
  lblName.setAttribute("style", labelStyle());
  const lblNameText = document.createElement("span");
  lblNameText.textContent = "Site name";
  const siteNameInput = document.createElement("input");
  siteNameInput.type = "text";
  siteNameInput.setAttribute("style", inputStyle());
  siteNameInput.value = defaultSiteName;
  siteNameInput.placeholder = "e.g. Amazon";
  lblName.appendChild(lblNameText);
  lblName.appendChild(document.createElement("br"));
  lblName.appendChild(siteNameInput);

  const lblUrl = document.createElement("label");
  lblUrl.setAttribute("style", labelStyle());
  const lblUrlText = document.createElement("span");
  lblUrlText.textContent = "Website URL";
  const urlInput = document.createElement("input");
  urlInput.type = "text";
  urlInput.setAttribute("style", inputStyle());
  urlInput.value = defaultUrl;
  urlInput.placeholder = "https://www.amazon.com";
  lblUrl.appendChild(lblUrlText);
  lblUrl.appendChild(document.createElement("br"));
  lblUrl.appendChild(urlInput);

  const info = document.createElement("div");
  info.setAttribute("style", "font-size:13px;line-height:1.5;color:#333;margin:12px 0 16px;");
  info.innerHTML =
    "<strong>Username:</strong> " +
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
    let websiteUrl = ensureHttpsUrl(urlInput.value);
    if (!websiteUrl) {
      websiteUrl = ensureHttpsUrl(defaultUrl);
    }

    let siteName = (siteNameInput.value || "").trim();
    if (!siteName) {
      try {
        siteName = new URL(websiteUrl).hostname.replace(/^www\./, "");
      } catch (e) {
        siteName = "Saved site";
      }
    }

    const encrypted = encrypt(password, ENCRYPTION_KEY);
    const entry = {
      id: String(Date.now()),
      siteName: siteName,
      websiteUrl: websiteUrl,
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
  box.appendChild(lblName);
  box.appendChild(lblUrl);
  box.appendChild(info);
  box.appendChild(row);
  overlay.appendChild(box);
  document.documentElement.appendChild(overlay);
}

function attachToForm(form) {
  const passInput = form.querySelector('input[type="password"]');
  if (!passInput) {
    return;
  }

  const userInput = findUsernameInput(form, passInput);

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

      const pageUrl = location.href.split("#")[0];
      let defaultSiteName = "";
      try {
        defaultSiteName = document.title.trim() || new URL(pageUrl).hostname;
      } catch (e) {
        defaultSiteName = location.hostname || "Website";
      }

      const username = userInput ? (userInput.value || "").trim() : "";
      const password = passInput.value || "";

      showSavePrompt(
        defaultSiteName,
        pageUrl,
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

function scanForms() {
  document.querySelectorAll("form").forEach(function (form) {
    attachToForm(form);
  });
}

scanForms();

const observer = new MutationObserver(function () {
  scanForms();
});
observer.observe(document.documentElement, { childList: true, subtree: true });
