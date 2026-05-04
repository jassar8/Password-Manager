/**
 * popup.js
 * Open the dashboard, test the API, and open saved websites in a new tab.
 */

const BACKEND_URL = "http://localhost:3000";
const DASHBOARD_URL = "http://localhost:3000/";

const statusText = document.getElementById("statusText");
const openDashboardBtn = document.getElementById("openDashboardBtn");
const testApiBtn = document.getElementById("testApiBtn");
const quickSitesList = document.getElementById("quickSitesList");
const quickSitesHint = document.getElementById("quickSitesHint");

function setStatus(message, isError) {
  statusText.textContent = message;
  statusText.style.color = isError ? "#b91c1c" : "#166534";
}

/** Same idea as the dashboard: always open a real http(s) URL in the browser. */
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

function openUrlInNewTab(url) {
  const openable = safeUrl(url);
  if (!openable) {
    setStatus("This account has no valid website URL.", true);
    return;
  }
  chrome.tabs.create({ url: openable });
}

async function loadSavedSitesIntoPopup() {
  quickSitesList.innerHTML = "";
  quickSitesHint.textContent = "Loading from backend…";

  try {
    const response = await fetch(BACKEND_URL + "/accounts", { cache: "no-store" });
    const rawText = await response.text();
    let list = null;
    try {
      list = rawText ? JSON.parse(rawText) : null;
    } catch (e) {
      quickSitesHint.textContent =
        "Backend did not return JSON. Is the server running? Run: npm start";
      return;
    }

    if (!response.ok) {
      const msg = list && list.message ? list.message : "HTTP " + response.status;
      quickSitesHint.textContent = "Could not load accounts: " + msg;
      return;
    }

    if (!Array.isArray(list) || list.length === 0) {
      quickSitesHint.textContent =
        "No accounts yet. Log in on a site (with the extension enabled) to save one.";
      console.log("accounts loaded — popup: 0 account(s)");
      return;
    }

    quickSitesHint.textContent = "Click Open to visit the saved site in a new tab.";
    console.log("accounts loaded — popup: " + list.length + " account(s)");

    list.forEach(function (account) {
      const row = document.createElement("div");
      row.className = "site-row";

      const label = document.createElement("span");
      label.textContent = account.siteName || account.websiteUrl || "Saved site";
      label.title = account.websiteUrl || "";

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "open-site-btn";
      btn.textContent = "Open";
      btn.addEventListener("click", function () {
        openUrlInNewTab(account.websiteUrl);
      });

      row.appendChild(label);
      row.appendChild(btn);
      quickSitesList.appendChild(row);
    });
  } catch (error) {
    const msg = error && error.message ? error.message : String(error);
    quickSitesHint.textContent =
      "Cannot reach " + BACKEND_URL + ". Start backend (npm start). " + msg;
  }
}

openDashboardBtn.addEventListener("click", function () {
  chrome.tabs.create({ url: DASHBOARD_URL });
});

testApiBtn.addEventListener("click", async function () {
  setStatus("Checking backend...", false);
  try {
    const response = await fetch(BACKEND_URL + "/accounts", { cache: "no-store" });
    if (!response.ok) {
      throw new Error("Backend responded with HTTP " + response.status);
    }
    const list = await response.json();
    if (!Array.isArray(list)) {
      throw new Error("Unexpected response (not a JSON array).");
    }
    setStatus("Connected. Accounts found: " + list.length, false);
    console.log("accounts loaded — test button: " + list.length + " account(s)");
    loadSavedSitesIntoPopup();
  } catch (error) {
    const msg = error && error.message ? error.message : String(error);
    setStatus("Cannot reach backend on " + BACKEND_URL + ". " + msg, true);
  }
});

// When you open the popup, try to refresh the list automatically.
loadSavedSitesIntoPopup();
