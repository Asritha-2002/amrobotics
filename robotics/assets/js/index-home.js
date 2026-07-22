/* =====================================================
   index-home.js  –  AM Robotics Homepage Products
   Calls GET /api/products?limit=10&status=active
   Shows 10 products + "View More" → shop.html
   ===================================================== */
function navigateToProfile() {
  const token = localStorage.getItem("authToken");
  if (!token) {
    window.location.href = "login.html";
    return;
  }
  try {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    window.location.href = user.isAdmin ? "dashboard.html" : "profile.html";
  } catch (_) {
    window.location.href = "profile.html";
  }
}
const AM_ProductLoader = {

  config: {
    containerId: "product-cards-grid",
    defaultImage: "assets/img/service/default.webp"
  },

  init() {
    document.addEventListener("DOMContentLoaded", () => this.loadProducts());
  },

  async loadProducts() {
    const container = document.getElementById(this.config.containerId);
    if (!container) return;

    // skeleton while loading
    container.innerHTML = Array(6).fill(`
      <div style="background:#f0f0f0;border-radius:18px;height:320px;
           animation:shimmer 1.5s infinite;background-size:200% 100%;
           background-image:linear-gradient(90deg,#f0f0f0 25%,#e0e0e0 50%,#f0f0f0 75%);">
      </div>`).join("");

    try {
      let  selectedCountry = localStorage.getItem('selectedCountry') === "IN" ? "INDIA" : "US";
      const res  = await fetch(`${CONFIG.API_BASE}/shop/products/${selectedCountry}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      // backend returns { success, products: [...], total, ... }
      const products = Array.isArray(data.products) ? data.products : [];

      if (!products.length) {
        container.innerHTML = `
          <div style="grid-column:1/-1;text-align:center;padding:60px 20px;color:#888;">
            <p style="font-size:16px;">No products available right now.</p>
          </div>`;
        return;
      }

      this.render(products);

    } catch (err) {
      console.error("[AM_ProductLoader] failed:", err);
      container.innerHTML = `
        <div style="grid-column:1/-1;text-align:center;padding:40px;color:#dc3545;">
          <p>Failed to load products. Please refresh.</p>
        </div>`;
    }
  },

  render(products) {
    const container = document.getElementById(this.config.containerId);
    if (!container) return;

    const country  = localStorage.getItem("selectedCountry") || "IN";
    const symbol   = country === "US" ? "$" : "₹";
    const locale   = country === "US" ? "en-US" : "en-IN";

    const fmt = n => symbol + Number(n).toLocaleString(locale);

    container.innerHTML = products.map(p => {
      const id           = p._id || p.id;
      const title        = p.name || "Unnamed Product";
      const selling      = Number(p.sellingPrice  || 0);
      const original     = Number(p.originalPrice || selling);
      const discount     = p.discountPercent || 0;
      const img          = (p.images && p.images[0]) ? p.images[0] : this.config.defaultImage;
      const inStock      = p.stock > 0;

      const discBadge = discount > 0
        ? `<span style="position:absolute;top:10px;left:10px;background:#dc3545;color:#fff;
                        font-size:11px;font-weight:700;padding:3px 9px;border-radius:20px;">
             -${discount}%
           </span>` : "";

      const outOfStock = !inStock
        ? `<span style="position:absolute;top:10px;right:10px;background:#6c757d;color:#fff;
                        font-size:11px;font-weight:600;padding:3px 9px;border-radius:20px;">
             Out of Stock
           </span>` : "";

      const originalPriceHtml = original > selling
        ? `<span class="old-price">${fmt(original)}</span>` : "";

      return `
      <div class="product-card-ref"
           onclick="location.href='product-details.html?id=${id}'"
           style="cursor:pointer;">

        <div class="product-image-wrap" style="position:relative;">
          ${discBadge}
          ${outOfStock}
          <span class="view-icon"
                title="Quick View"
                onclick="event.stopPropagation();location.href='product-details.html?id=${id}'">
            👁
          </span>
          <img src="${img}"
               alt="${title}"
               loading="lazy"
               onerror="this.src='${this.config.defaultImage}'">
        </div>

        <div class="product-info">
          <h4 class="product-title"
              title="${title}"
              style="display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;
                     overflow:hidden;min-height:42px;">
            ${title}
          </h4>

          <div class="price-row">
            ${originalPriceHtml}
            <span class="new-price">${fmt(selling)}</span>
          </div>

          <button class="add-cart-btn"
                  ${!inStock ? "disabled style='opacity:.5;cursor:not-allowed;'" : ""}
                  onclick="event.stopPropagation();AM_ProductLoader.addToCart('${id}','${title.replace(/'/g,"\\'")}',${selling})">
            ${inStock ? "Add to Cart" : "Out of Stock"}
          </button>
        </div>
      </div>`;
    }).join("");

    // wire up the Show More button
    const btn = document.querySelector(".show-more-btn");
    if (btn) {
      btn.textContent = "View More Products";
      btn.onclick = () => window.location.href = "shop.html";
    }
  },

  async addToCart(productId, title, price) {
    const token = localStorage.getItem("authToken") || localStorage.getItem("token");

    if (!token) {
      // guest mode — save to localStorage guestCart
      try {
        const gc = JSON.parse(localStorage.getItem("guestCart") || "[]");
        const existing = gc.find(i => i.productId === productId);
        if (existing) {
          existing.quantity += 1;
        } else {
          gc.push({ productId, quantity: 1 });
        }
        localStorage.setItem("guestCart", JSON.stringify(gc));
        this.showToast(`"${title}" added to cart!`, "success");
        this.updateCartBadge(gc.length);
      } catch (_) {
        this.showToast("Failed to add to cart", "error");
      }
      return;
    }

    // logged-in — call API
    try {
      const res  = await fetch(`${CONFIG.API_BASE}/cart/add`, {
        method:  "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization:  `Bearer ${token}`
        },
        body: JSON.stringify({ productId, quantity: 1 })
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Failed");
      this.showToast(`"${title}" added to cart!`, "success");

      // update badge
      if (window.CartSystem?.updateCartBadge) {
        window.CartSystem.updateCartBadge();
      }
    } catch (err) {
      console.error("[addToCart]", err);
      this.showToast("Failed to add to cart. Please try again.", "error");
    }
  },

  updateCartBadge(count) {
    document.querySelectorAll(".cart-badge").forEach(el => {
      el.textContent = count;
      el.style.display = count > 0 ? "inline-flex" : "none";
    });
  },

  showToast(message, type = "info") {
    const t = document.createElement("div");
    t.textContent = message;
    const bg = { success: "#198754", error: "#dc3545", info: "#0d6efd" };
    Object.assign(t.style, {
      position: "fixed", bottom: "24px", left: "50%",
      transform: "translateX(-50%)",
      background: bg[type] || bg.info,
      color: "#fff", padding: "12px 24px", borderRadius: "8px",
      zIndex: 9999, fontSize: "14px", fontWeight: "600",
      boxShadow: "0 4px 20px rgba(0,0,0,.2)",
      opacity: "1", transition: "opacity .4s"
    });
    document.body.appendChild(t);
    setTimeout(() => { t.style.opacity = "0"; setTimeout(() => t.remove(), 400); }, 2500);
  }
};



// add shimmer keyframe once
const shimmerStyle = document.createElement("style");
shimmerStyle.textContent = `@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`;
document.head.appendChild(shimmerStyle);

AM_ProductLoader.init();