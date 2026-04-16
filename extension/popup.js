/**
 * popup.js
 * Small popup for quick checks:
 * - Open web dashboard page
 * - Test if backend is reachable
 */

const BACKEND_URL = "http://localhost:3000";
const DASHBOARD_URL = "http://localhost:3000";

const statusText = document.getElementById("statusText");
const openDashboardBtn = document.getElementById("openDashboardBtn");
const testApiBtn = document.getElementById("testApiBtn");

function setStatus(message, isError) {
  statusText.textContent = message;
  statusText.style.color = isError ? "#b91c1c" : "#166534";
}

openDashboardBtn.addEventListener("click", function () {
  chrome.tabs.create({ url: DASHBOARD_URL });
});

testApiBtn.addEventListener("click", async function () {
  setStatus("Checking backend...", false);
  try {
    const response = await fetch(BACKEND_URL + "/accounts");
    if (!response.ok) {
      throw new Error("Backend responded with an error.");
    }
    const list = await response.json();
    setStatus("Connected. Accounts found: " + list.length, false);
  } catch (error) {
    setStatus("Cannot reach backend on " + BACKEND_URL, true);
  }
});
