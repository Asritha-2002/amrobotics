/* =====================================================
   dashboard-stats.js
   Add <script src="assets/js/dashboard-stats.js"></script>
   just before </body> in dashboard.html
   ===================================================== */

const DASHBOARD_API = `${CONFIG.API_BASE}/admin/dashboard-stats`;

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
    const chartEl = document.getElementById("rev-chart");
    if (chartEl && revenue.daily?.length) {
      const maxRev = Math.max(...revenue.daily.map(d => d.revenue), 1);
      chartEl.innerHTML = revenue.daily.map(d => {
        const pct     = Math.max(8, Math.round((d.revenue / maxRev) * 100));
        const tooltip = `${d.label}: ${fmtMoney(d.revenue)}`;
        return `
          <div class="mini-bar-wrap" title="${tooltip}">
            <div class="mini-bar"
                 style="height:${pct}%;background:${d.revenue > 0 ? 'var(--accent)' : '#e8ecff'};"
                 title="${tooltip}">
            </div>
            <span class="mini-bar-lbl">${d.label}</span>
          </div>`;
      }).join("");
    }

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
            <div class="act-dot" style="background:${a.color};font-size:16px;">${a.icon}</div>
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