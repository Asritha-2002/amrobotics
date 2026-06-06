/* =====================================================
   dashboard-stats.js
   Add <script src="assets/js/dashboard-stats.js"></script>
   just before </body> in dashboard.html
   ===================================================== */

// const DASHBOARD_API = `${CONFIG.API_BASE}/admin/dashboard-stats`;
const countryFromLocal     = localStorage.getItem("selectedCountry") || "IN";
const countryName = countryFromLocal === "IN" ? "India" : "US";

const DASHBOARD_API = `${CONFIG.API_BASE}/admin/dashboard-stats?country=${countryName}`;
function fmtMoney(n) {
  const country   = localStorage.getItem("selectedCountry") || "IN";
  const sym       = country === "US" ? "$" : "₹";
  const locale    = country === "US" ? "en-US" : "en-IN";
  return sym + Number(n).toLocaleString(locale);
}

function timeAgo(dateStr) {
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (diff < 60)   return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function statusPill(status) {
  const map = {
    delivered:        ["pill-success", "Delivered"],
    processing:       ["pill-info",    "Processing"],
    confirmed:        ["pill-info",    "Confirmed"],
    shipped:          ["pill-warning", "Shipped"],
    cancelled:        ["pill-danger",  "Cancelled"],
    refund_completed: ["pill-danger",  "Refunded"],
    payment_pending:  ["pill-warning", "Pending"],
    out_for_delivery: ["pill-info",    "Out for Delivery"],
  };
  const [cls, label] = map[status] || ["pill-info", status];
  return `<span class="status-pill ${cls}">${label}</span>`;
}

async function loadDashboardStats() {
  const token = localStorage.getItem("authToken");
  if (!token) return;

  try {
    const res  = await fetch(DASHBOARD_API, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const { revenue, orders, products, customers, recentOrders, activityFeed } = await res.json();

    // ── Stat cards ──────────────────────────────────
    document.getElementById("stat-revenue").textContent   = fmtMoney(revenue.allTime);
    document.getElementById("stat-orders").textContent    = orders.total.toLocaleString();
    document.getElementById("stat-products").textContent  = products.total.toLocaleString();
    document.getElementById("stat-customers").textContent = customers.total.toLocaleString();

    // Sidebar badges
    const prodCount = document.getElementById("products-count");
    const ordCount  = document.getElementById("orders-count");
    if (prodCount) prodCount.textContent = products.total;
    if (ordCount)  ordCount.textContent  = orders.pending;

    // Revenue trend badge
    const revTrendEl = document.getElementById("stat-rev-trend");
    if (revTrendEl) {
      const sign = revenue.trendDir === "up" ? "+" : revenue.trendDir === "down" ? "" : "";
      revTrendEl.textContent  = `${sign}${revenue.trend}%`;
      revTrendEl.className    = `stat-trend trend-${revenue.trendDir}`;
    }

    // Orders trend badge
    const ordTrendEl = document.getElementById("stat-ord-trend");
    if (ordTrendEl) {
      const sign = orders.trendDir === "up" ? "+" : "";
      ordTrendEl.textContent  = `${sign}${orders.trend}% today`;
      ordTrendEl.className    = `stat-trend trend-${orders.trendDir}`;
    }

    // ── Orders page stat cards ────────────────────────
    const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    setEl("ord-total",     orders.total);
    setEl("ord-pending",   orders.pending);
    setEl("ord-delivered", orders.delivered);
    setEl("ord-cancelled", orders.cancelled);

    // ── Revenue chart (last 7 days) ─────────────────
    // ── Revenue chart (toggle daily / monthly) ──────
let chartMode   = "monthly"; // default view
let chartData   = { daily: revenue.daily, monthly: revenue.monthly };

function renderRevenueChart(mode) {
  const chartEl = document.getElementById("rev-chart");
  if (!chartEl) return;

  const data   = mode === "monthly" ? chartData.monthly : chartData.daily;
  const maxRev = Math.max(...data.map(d => d.revenue), 1);

  if (data.every(d => d.revenue === 0)) {
    chartEl.innerHTML = `<div class="chart-empty">No revenue data available yet</div>`;
    return;
  }

  // Y-axis grid lines at 0%, 25%, 50%, 75%, 100%
  const gridLines = [25, 50, 75, 100].map(pct => {
    const val = (maxRev * pct) / 100;
    return `
      <div class="chart-gridline" style="bottom:${pct}%">
        <span class="chart-y-label">${fmtMoney(val)}</span>
      </div>`;
  }).join("");

  const bars = data.map(d => {
    const heightPct = d.revenue > 0
      ? Math.max(2, Math.round((d.revenue / maxRev) * 100))
      : 2;

    const barColor = d.revenue > 0
      ? `linear-gradient(180deg, var(--accent) 0%, #9b8ffa 100%)`
      : `#eef0f8`;

    const tooltipText = `${d.label}: ${fmtMoney(d.revenue)} · ${d.orders} order${d.orders !== 1 ? "s" : ""}`;

    return `
      <div class="mini-bar-wrap">
        <div class="chart-tooltip">${tooltipText}</div>
        <div class="mini-bar"
             style="height:${heightPct}%;background:${barColor};">
        </div>
        <span class="mini-bar-lbl">${d.label}</span>
      </div>`;
  }).join("");

  chartEl.className = "chart-container";
  chartEl.innerHTML = gridLines + bars;
}

// Inject toggle buttons into chart card header
const chartHeader = document.querySelector("#rev-chart")?.closest(".card")?.querySelector(".card-header");
if (chartHeader && !chartHeader.querySelector(".chart-toggle")) {
  const toggleWrap = document.createElement("div");
  toggleWrap.className = "chart-toggle";
  toggleWrap.style.cssText = "display:flex;gap:6px;";
  toggleWrap.innerHTML = `
    <button id="btn-monthly" onclick="switchChart('monthly')"
      style="font-size:11px;font-weight:600;padding:4px 12px;border-radius:6px;
             border:1px solid var(--accent);background:var(--accent);color:#fff;cursor:pointer;">
      Monthly
    </button>
    <button id="btn-weekly" onclick="switchChart('weekly')"
      style="font-size:11px;font-weight:600;padding:4px 12px;border-radius:6px;
             border:1px solid var(--border);background:#fff;color:#555;cursor:pointer;">
      7 Days
    </button>`;
  chartHeader.appendChild(toggleWrap);
}

window.switchChart = function(mode) {
  chartMode = mode;
  renderRevenueChart(mode);
  // update button styles
  const btnM = document.getElementById("btn-monthly");
  const btnW = document.getElementById("btn-weekly");
  if (btnM && btnW) {
    if (mode === "monthly") {
      btnM.style.cssText += "background:var(--accent);color:#fff;border-color:var(--accent);";
      btnW.style.cssText += "background:#fff;color:#555;border-color:var(--border);";
    } else {
      btnW.style.cssText += "background:var(--accent);color:#fff;border-color:var(--accent);";
      btnM.style.cssText += "background:#fff;color:#555;border-color:var(--border);";
    }
  }
};

renderRevenueChart(chartMode);

    // ── Activity feed ────────────────────────────────
    const actEl = document.getElementById("activity-list");
    if (actEl) {
      if (!activityFeed?.length) {
        actEl.innerHTML = `<div class="empty-state">
          <div class="empty-icon"><i data-lucide="activity"></i></div>
          <p>No recent activity yet.</p>
        </div>`;
      } else {
        actEl.innerHTML = activityFeed.map(a => `
          <div class="activity-row">
            <div class="act-dot" style="background:${a.color};font-size:16px;"><i data-lucide="badge-check"></i></div>
            <div>
              <strong>${a.message}</strong>
              <span>${a.amount > 0 ? fmtMoney(a.amount) + " · " : ""}${timeAgo(a.timestamp)}</span>
            </div>
          </div>`).join("");
      }
    }

    // ── Recent orders table ──────────────────────────
    const ordBody = document.getElementById("recent-orders-body");
    if (ordBody) {
      if (!recentOrders?.length) {
        ordBody.innerHTML = `<tr><td colspan="5">
          <div class="empty-state"><p>No orders yet.</p></div>
        </td></tr>`;
      } else {
        ordBody.innerHTML = recentOrders.map(o => `
          <tr>
            <td><span style="font-family:monospace;font-weight:600;">#${o.shortId}</span></td>
            <td>
              <div style="font-weight:600;font-size:13px;">${o.customer}</div>
              <div style="font-size:11px;color:#999;">${o.email}</div>
            </td>
            <td>
              <div style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                ${o.product}${o.itemCount > 1 ? ` <span style="color:#999;font-size:11px;">+${o.itemCount - 1} more</span>` : ""}
              </div>
            </td>
            <td style="font-weight:600;">${fmtMoney(o.amount)}</td>
            <td>${statusPill(o.status)}</td>
          </tr>`).join("");
      }
    }

    // ── Full orders table (orders page) ─────────────
    const fullOrdBody = document.getElementById("orders-body");
    if (fullOrdBody) {
      if (!recentOrders?.length) {
        fullOrdBody.innerHTML = `<tr><td colspan="7">
          <div class="empty-state"><p>No orders yet.</p></div>
        </td></tr>`;
      } else {
        fullOrdBody.innerHTML = recentOrders.map(o => `
          <tr>
            <td><span style="font-family:monospace;font-weight:600;">#${o.shortId}</span></td>
            <td>${o.customer}</td>
            <td style="color:#888;font-size:12px;">${new Date(o.createdAt).toLocaleDateString("en-IN")}</td>
            <td>${o.itemCount} item${o.itemCount !== 1 ? "s" : ""}</td>
            <td style="font-weight:600;">${fmtMoney(o.amount)}</td>
            <td>${statusPill(o.status)}</td>
            <td>
              <a href="admin-order-management.html?id=${o._id}" class="btn btn-outline btn-sm">View</a>
            </td>
          </tr>`).join("");
      }
    }

    // Re-run lucide icons in case new icons were injected
    if (typeof lucide !== "undefined") lucide.createIcons();

  } catch (err) {
    console.error("[dashboard] loadDashboardStats failed:", err);
  }
}

// Load on page ready
document.addEventListener("DOMContentLoaded", loadDashboardStats);