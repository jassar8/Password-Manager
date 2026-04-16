/**
 * content.js
 * Detect login forms, ask user to save on submit,
 * encrypt password with simple XOR, then POST to backend.
 */

const BACKEND_URL = "http://localhost:3000";
const XOR_KEY = "K";

function xorEncrypt(text, key) {
  if (!text) {
    return "";
  }
  const keyCode = key.charCodeAt(0);
  let encrypted = "";
  for (let i = 0; i < text.length; i++) {
    encrypted += String.fromCharCode(text.charCodeAt(i) ^ keyCode);
  }
  return encrypted;
}

function getSiteName() {
  if (document.title && document.title.trim()) {
    return document.title.trim();
  }
  return window.location.hostname;
}

/**
 * Normalize URL so duplicate checks are consistent.
 * Examples treated as the same:
 * - http://example.com
 * - https://example.com
 * - www.example.com
 * - example.com/login
 */
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
    // Fallback for unusual text that fails URL parsing.
    return raw
      .replace(/^https?:\/\//i, "")
      .replace(/^www\./i, "")
      .split(/[/?#]/)[0];
  }
}

/**
 * Homework-style strong password check:
 * - lowercase, uppercase, number, symbol
 * - at least 8 chars
 */
function isStrongPassword(password) {
  if (!password || password.length < 8) {
    return false;
  }
  let hasLower = false;
  let hasUpper = false;
  let hasNumber = false;
  let hasSymbol = false;

  for (let i = 0; i < password.length; i++) {
    const c = password[i];
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

/**
 * Create random strong password with shuffled characters.
 */
function generateStrongPassword() {
  const lower = "abcdefghijklmnopqrstuvwxyz";
  const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const numbers = "0123456789";
  const symbols = "!@#$%^&*()_+-=[]{}|;:,.<>?";
  const all = lower + upper + numbers + symbols;

  const targetLength = 14;
  const chars = [];

  // Guarantee required character types.
  chars.push(lower[Math.floor(Math.random() * lower.length)]);
  chars.push(upper[Math.floor(Math.random() * upper.length)]);
  chars.push(numbers[Math.floor(Math.random() * numbers.length)]);
  chars.push(symbols[Math.floor(Math.random() * symbols.length)]);

  // Fill the rest randomly.
  while (chars.length < targetLength) {
    chars.push(all[Math.floor(Math.random() * all.length)]);
  }

  // Shuffle so character types are not predictable.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = chars[i];
    chars[i] = chars[j];
    chars[j] = temp;
  }

  return chars.join("");
}

function looksLikeSignupForm(form) {
  const text = (
    (form.id || "") +
    " " +
    (form.className || "") +
    " " +
    (form.getAttribute("action") || "") +
    " " +
    (form.textContent || "")
  ).toLowerCase();

  const hasSignupWords = /(sign.?up|register|create account|new account|join)/i.test(text);
  const passwordInputs = form.querySelectorAll('input[type="password"]');

  // Two password fields usually means "password + confirm password".
  if (passwordInputs.length >= 2) {
    return true;
  }
  return hasSignupWords;
}

function insertPasswordSuggestionUi(form, passwordInput) {
  if (form.dataset.pmSuggestUiAdded === "1") {
    return;
  }
  form.dataset.pmSuggestUiAdded = "1";

  const passwordInputs = Array.from(form.querySelectorAll('input[type="password"]'));
  const helper = document.createElement("div");
  helper.style.marginTop = "8px";
  helper.style.padding = "8px";
  helper.style.border = "1px solid #d1d5db";
  helper.style.borderRadius = "8px";
  helper.style.background = "#f9fafb";
  helper.style.fontFamily = "Arial, sans-serif";

  const title = document.createElement("div");
  title.textContent = "Strong password helper";
  title.style.fontSize = "12px";
  title.style.fontWeight = "700";
  title.style.marginBottom = "6px";
  title.style.color = "#374151";

  const output = document.createElement("input");
  output.type = "text";
  output.readOnly = true;
  output.placeholder = "Click Generate Password";
  output.style.width = "100%";
  output.style.padding = "6px 8px";
  output.style.border = "1px solid #d1d5db";
  output.style.borderRadius = "6px";
  output.style.marginBottom = "6px";
  output.style.fontSize = "12px";

  const row = document.createElement("div");
  row.style.display = "flex";
  row.style.gap = "6px";
  row.style.flexWrap = "wrap";

  function makeBtn(label) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = label;
    btn.style.border = "1px solid #d1d5db";
    btn.style.borderRadius = "6px";
    btn.style.padding = "5px 8px";
    btn.style.fontSize = "12px";
    btn.style.cursor = "pointer";
    btn.style.background = "#ffffff";
    return btn;
  }

  const btnGenerate = makeBtn("Generate Password");
  const btnAgain = makeBtn("Generate Again");
  const btnUse = makeBtn("Use Password");
  const btnCopy = makeBtn("Copy");
  const note = document.createElement("div");
  note.style.fontSize = "11px";
  note.style.marginTop = "6px";
  note.style.color = "#6b7280";
  note.textContent = "Must include lowercase, uppercase, number, and symbol.";

  function placeInPasswordFields(pwd) {
    passwordInput.value = pwd;
    // If this is a signup form with confirm password, fill both for convenience.
    if (passwordInputs.length >= 2) {
      passwordInputs[1].value = pwd;
    }
  }

  function generateAndShow() {
    const pwd = generateStrongPassword();
    output.value = pwd;
    note.textContent = "Generated strong password. Click Use Password to fill.";
  }

  btnGenerate.addEventListener("click", generateAndShow);
  btnAgain.addEventListener("click", generateAndShow);
  btnUse.addEventListener("click", function () {
    if (!output.value) {
      generateAndShow();
    }
    placeInPasswordFields(output.value);
    note.textContent = "Password filled in the form.";
  });
  btnCopy.addEventListener("click", function () {
    if (!output.value) {
      generateAndShow();
    }
    navigator.clipboard.writeText(output.value).then(
      function () {
        note.textContent = "Copied to clipboard.";
      },
      function () {
        note.textContent = "Could not copy. You can copy manually.";
      }
    );
  });

  row.appendChild(btnGenerate);
  row.appendChild(btnAgain);
  row.appendChild(btnUse);
  row.appendChild(btnCopy);
  helper.appendChild(title);
  helper.appendChild(output);
  helper.appendChild(row);
  helper.appendChild(note);

  passwordInput.insertAdjacentElement("afterend", helper);

  // Suggest one strong password immediately for signup forms.
  generateAndShow();
}

function findUsernameInput(form, passwordInput) {
  const inputs = Array.from(form.querySelectorAll("input"));
  const pass = passwordInput;

  // 1) Try inputs that look like username/email fields.
  const probable = inputs.filter(function (el) {
    if (el === pass) return false;
    const type = (el.type || "").toLowerCase();
    return type === "text" || type === "email" || type === "tel" || type === "search";
  });

  const byAttr = probable.filter(function (el) {
    const n = (el.name || "") + " " + (el.id || "");
    return /(user|email|login)/i.test(n);
  });

  if (byAttr.length > 0) {
    return byAttr[0];
  }
  if (probable.length > 0) {
    return probable[0];
  }

  // 2) Fallback: closest field before the password input.
  const passwordIndex = inputs.indexOf(pass);
  for (let i = passwordIndex - 1; i >= 0; i--) {
    const input = inputs[i];
    const type = (input.type || "").toLowerCase();
    if (type !== "password" && type !== "hidden" && type !== "submit" && type !== "button") {
      return input;
    }
  }

  return null;
}

async function sendAccountToBackend(account) {
  const response = await fetch(BACKEND_URL + "/save-account", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(account),
    // Helps when the page navigates right after submit.
    keepalive: true,
  });

  if (!response.ok) {
    throw new Error("Could not save account to backend.");
  }
}

async function findDuplicateAccountOnBackend(websiteUrl) {
  try {
    const response = await fetch(BACKEND_URL + "/accounts", {
      method: "GET",
      cache: "no-store",
    });
    if (!response.ok) {
      return null;
    }

    const accounts = await response.json();
    if (!Array.isArray(accounts)) {
      return null;
    }

    const target = normalizeUrl(websiteUrl);
    for (let i = 0; i < accounts.length; i++) {
      const existing = accounts[i];
      if (normalizeUrl(existing.websiteUrl) === target) {
        return existing;
      }
    }
  } catch (e) {
    // If this check fails, backend will still perform duplicate replacement.
  }

  return null;
}

function handleForm(form) {
  if (form.dataset.pmConnected === "true") {
    return;
  }
  form.dataset.pmConnected = "true";

  const passwordInput = form.querySelector('input[type="password"]');
  if (!passwordInput) {
    return;
  }

  if (looksLikeSignupForm(form)) {
    insertPasswordSuggestionUi(form, passwordInput);
  }

  const usernameInput = findUsernameInput(form, passwordInput);

  form.addEventListener(
    "submit",
    async function (event) {
      // Prevent infinite loops when we re-submit the form.
      if (form.dataset.pmBypassSubmit === "1") {
        form.dataset.pmBypassSubmit = "0";
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      const username = usernameInput ? usernameInput.value.trim() : "";
      const password = passwordInput.value || "";

      // If form doesn't look like a login, just continue.
      if (!password) {
        form.dataset.pmBypassSubmit = "1";
        form.submit();
        return;
      }

      const websiteUrl = window.location.href.split("#")[0];
      const duplicateAccount = await findDuplicateAccountOnBackend(websiteUrl);
      const confirmText = duplicateAccount
        ? "This website already has a saved account. Save now and replace the old one?"
        : "Save this login to your Password Manager?";

      const shouldSave = window.confirm(confirmText);

      if (shouldSave) {
        // If user entered their own password, validate strong rule before saving.
        if (!isStrongPassword(password)) {
          window.alert(
            "Password was not saved because it is not strong enough. " +
              "Use lowercase, uppercase, number, and symbol."
          );
          form.dataset.pmBypassSubmit = "1";
          form.submit();
          return;
        }

        const account = {
          siteName: getSiteName(),
          websiteUrl: websiteUrl,
          username: username,
          encryptedPassword: xorEncrypt(password, XOR_KEY),
        };

        try {
          await sendAccountToBackend(account);
        } catch (error) {
          // Keep it simple: still submit the form even if the backend save fails.
          console.error("Password Manager:", error.message);
        }
      }

      // Continue original site login.
      form.dataset.pmBypassSubmit = "1";
      form.submit();
    },
    true
  );
}

function scanPageForForms() {
  const forms = document.querySelectorAll("form");
  forms.forEach(handleForm);
}

scanPageForForms();

const observer = new MutationObserver(function () {
  scanPageForForms();
});
observer.observe(document.documentElement, { childList: true, subtree: true });
