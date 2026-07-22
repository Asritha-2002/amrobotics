/* =====================================================
   country-toggle.js
   Detects country by geolocation on first visit,
   stores in localStorage, and lets user override.
   ===================================================== */

const COUNTRY_KEY = "selectedCountry";

/* ── Apply the stored/detected country to the UI ── */
function applyCountryUI(country) {
  const isUS  = country === "US";
  const desktopBtn  = document.getElementById("country-toggle-btn");
  const mobileBtn   = document.getElementById("country-toggle-btn-mobile");
  const flagEl      = document.getElementById("toggle-flag");
  const labelEl     = document.getElementById("toggle-label");
  const mobileFlagEl  = document.getElementById("mobile-flag");
  const mobileLabelEl = document.getElementById("mobile-label");

  if (desktopBtn) {
    desktopBtn.classList.toggle("us-active", isUS);
  }

  if (flagEl)  flagEl.textContent  = isUS ? "🇺🇸" : "🇮🇳";
  if (labelEl) labelEl.textContent = isUS ? "US"  : "IN";

  if (mobileFlagEl)  mobileFlagEl.textContent  = isUS ? "🇺🇸" : "🇮🇳";
  if (mobileLabelEl) mobileLabelEl.textContent = isUS ? "US"  : "IN";
}

/* ── Toggle between IN and US manually ── */
function toggleCountry() {
  const current = localStorage.getItem(COUNTRY_KEY) || "IN";
  const next    = current === "IN" ? "US" : "IN";

  localStorage.setItem(COUNTRY_KEY, next);
  applyCountryUI(next);

  window.location.reload();
}

/* ── Detect country by IP geolocation on first visit ── */
async function detectAndSetCountry() {
  // if already set by user → don't override, just apply UI
  const stored = localStorage.getItem(COUNTRY_KEY);
  if (stored) {
    applyCountryUI(stored);
    return;
  }

  // first visit → detect by IP
  try {
    const res  = await fetch("https://ipapi.co/json/");
    const data = await res.json();

    // ipapi returns country_code like "IN", "US", "GB" etc.
    const countryCode = data.country_code || "IN";

    // map to your supported countries
    const supported = ["IN", "US"];
    const matched   = supported.includes(countryCode) ? countryCode : "IN";

    localStorage.setItem(COUNTRY_KEY, matched);
    applyCountryUI(matched);

    console.log(`[country] Auto-detected: ${countryCode} → set to ${matched}`);
  } catch (err) {
    // geolocation failed → default to India
    console.warn("[country] Geolocation failed, defaulting to IN:", err.message);
    localStorage.setItem(COUNTRY_KEY, "IN");
    applyCountryUI("IN");
  }
}

/* ── Run on page load ── */
document.addEventListener("DOMContentLoaded", detectAndSetCountry);