/* ===================================================
   cart.js  –  AM Robotics Cart Page
   • Logged-in  → GET /api/cart/cart  (auth header)
   • Guest      → reads localStorage guestCart
                  → POST /api/cart/guest-cart
   =================================================== */

const CART_API           = `${CONFIG.API_BASE}/cart/cart`;
const GUEST_CART_API     = `${CONFIG.API_BASE}/cart/guest-cart`;
const APPLY_VOUCHER_API  = `${CONFIG.API_BASE}/cart/apply-voucher`;
const REMOVE_VOUCHER_API = `${CONFIG.API_BASE}/cart/remove-voucher`;

/* ── helpers ─────────────────────────────────────── */

function fmt(n) {
  const country =
    localStorage.getItem("selectedCountry") || "IN";

  const localeMap = {
    IN: "en-IN",
    US: "en-US",
  };

  const symbolMap = {
    IN: "₹",
    US: "$",
  };

  return (
    symbolMap[country] +
    Number(n).toLocaleString(
      localeMap[country]
    )
  );
}

function isLoggedIn() {
  return !!(localStorage.getItem("authToken") || localStorage.getItem("token"));
}

function getAuthHeaders() {
  const token = localStorage.getItem("authToken") || localStorage.getItem("token") || "";
  return token
    ? { "Content-Type": "application/json", Authorization: `Bearer ${token}` }
    : { "Content-Type": "application/json" };
}

/* ── guest cart localStorage helpers ────────────── */

function getGuestCart() {
  try { return JSON.parse(localStorage.getItem("guestCart") || "[]"); }
  catch { return []; }
}

function saveGuestCart(items) {
  localStorage.setItem("guestCart", JSON.stringify(items));
}

/* ── toast ───────────────────────────────────────── */

function showToast(message, type = "info") {
  if (typeof window.showToast === "function" && window.showToast !== showToast) {
    try { window.showToast(message, type); return; } catch (_) {}
  }
  const t = document.createElement("div");
  t.textContent = message;
  Object.assign(t.style, {
    position: "fixed", bottom: "24px", left: "50%", transform: "translateX(-50%)",
    background: type === "error" ? "#dc3545" : "#198754",
    color: "#fff", padding: "12px 24px", borderRadius: "8px",
    zIndex: 9999, fontSize: "14px", fontWeight: "600",
    boxShadow: "0 4px 20px rgba(0,0,0,.2)", opacity: "1", transition: "opacity .4s"
  });
  document.body.appendChild(t);
  setTimeout(() => { t.style.opacity = "0"; setTimeout(() => t.remove(), 400); }, 2500);
}

/* ── state ───────────────────────────────────────── */

let cartState = {
  items: [],
  subtotal: 0,
  vouchers: [],
  appliedVoucher: null,   // { voucherId, code, title, discountType, discount, discountAmount }
  isGuest: false
};

/* ── fetch cart ──────────────────────────────────── */

async function fetchCart() {
  if (isLoggedIn()) {
    try {
      const res = await fetch(CART_API, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return { ...data, isGuest: false };
    } catch (err) {
      console.error("[cart] fetchCart (auth) failed:", err);
      return null;
    }
  } else {
    const guestItems = getGuestCart();
    if (!guestItems.length) {
      return { success: true, cartItems: [], subtotal: 0, totalItems: 0,
               appliedVoucher: null, availableVouchers: [], isGuest: true };
    }
    try {
      const res = await fetch(GUEST_CART_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: guestItems })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return { ...data, isGuest: true };
    } catch (err) {
      console.error("[cart] fetchCart (guest) failed:", err);
      return null;
    }
  }
}

/* ── render main ─────────────────────────────────── */

async function renderCart() {
  const data = await fetchCart();

  if (!data || !data.success) { renderEmpty(); return; }

  cartState.items          = data.cartItems         || [];
  cartState.subtotal       = data.subtotal          || 0;
  cartState.vouchers       = data.availableVouchers || [];
  cartState.appliedVoucher = data.appliedVoucher    || null;
  cartState.isGuest        = !!data.isGuest;

  // header badge
  document.querySelectorAll(".cart-badge").forEach(el => {
    const count = data.totalItems || cartState.items.length;
    el.textContent = count;
    el.style.display = count > 0 ? "inline-flex" : "none";
  });

  if (cartState.items.length === 0) { renderEmpty(); return; }

  // restore layout if it was hidden by renderEmpty
  const cartHeader  = document.querySelector(".cart-header");
  const voucherCard = document.querySelector(".voucher-card");
  const cartRight   = document.querySelector(".cart-right");
  if (cartHeader)  cartHeader.style.display  = "";
  if (voucherCard) voucherCard.style.display = "";
  if (cartRight)   cartRight.style.display   = "";

  renderItems();
  renderSummary();
  renderVouchers();
}

/* ── render items ────────────────────────────────── */

function renderItems() {
  const wrap    = document.getElementById("cartProducts");
  const countEl = document.getElementById("cartItemCount");
  if (!wrap) return;

  if (countEl) countEl.textContent =
    `(${cartState.items.length} item${cartState.items.length !== 1 ? "s" : ""})`;

  wrap.innerHTML = cartState.items.map(item => {
    const discount      = item.discountPercent
      ? `<span class="discount-badge">-${item.discountPercent}%</span>` : "";
    const originalPrice = item.originalPrice > item.sellingPrice
      ? `<span class="cart-original">${fmt(item.originalPrice)}</span>` : "";

    return `
    <div class="cart-product-card" data-id="${item.productId}">
      <img class="cart-product-img"
           src="${item.image || 'assets/img/product/default.png'}"
           alt="${item.name}"
           onerror="this.src='assets/img/product/default.png'">
      <div class="cart-product-info">
        <div class="cart-product-name">${item.name}</div>
        <div class="country-tag">${item.country || ""}</div>
        <div class="price-row">
          <span class="cart-price">${fmt(item.sellingPrice)}</span>
          ${originalPrice}
          ${discount}
        </div>
        <div class="qty-box">
          <button class="qty-btn" onclick="changeQty('${item.productId}', -1)" aria-label="Decrease">
            <i class="far fa-minus"></i>
          </button>
          <span class="qty-value" id="qty-${item.productId}">${item.quantity}</span>
          <button class="qty-btn" onclick="changeQty('${item.productId}', 1)" aria-label="Increase"
            ${item.quantity >= item.stock ? "disabled title='Max stock reached'" : ""}>
            <i class="far fa-plus"></i>
          </button>
          <span class="line-subtotal">Subtotal: <strong>${fmt(item.lineTotal)}</strong></span>
        </div>
      </div>
      <button class="remove-btn" onclick="removeItem('${item.productId}')" title="Remove item">
        <i class="far fa-trash-alt"></i>
      </button>
    </div>`;
  }).join("");
}

/* ── render summary ──────────────────────────────── */

function renderSummary() {
  const subtotalEl       = document.getElementById("subtotalAmount");
  const savingEl         = document.getElementById("savingAmount");
  const voucherRowEl     = document.getElementById("voucherDiscountRow");
  const voucherLabelEl   = document.getElementById("voucherDiscountLabel");
  const voucherAmountEl  = document.getElementById("voucherDiscountAmount");
  const totalEl          = document.getElementById("totalAmount");
  if (!subtotalEl) return;

  // MRP savings (original vs selling)
  const totalOriginal = cartState.items.reduce((s, i) => s + (i.originalPrice * i.quantity), 0);
  const mrpSaving     = totalOriginal - cartState.subtotal;

  // voucher discount
  const v               = cartState.appliedVoucher;
  const voucherDiscount = v ? (v.discountAmount || 0) : 0;
  const finalTotal      = Math.max(0, cartState.subtotal - voucherDiscount);

  subtotalEl.textContent = fmt(cartState.subtotal);
  savingEl.textContent   = mrpSaving > 0 ? `-${fmt(mrpSaving)}` : fmt(0);
  totalEl.textContent    = fmt(finalTotal);

  // show/hide voucher discount row
  if (voucherRowEl) {
    if (v && voucherDiscount > 0) {
      voucherRowEl.style.display     = "";
      if (voucherLabelEl)  voucherLabelEl.textContent  = `Voucher (${v.code})`;
      if (voucherAmountEl) voucherAmountEl.textContent = `-${fmt(voucherDiscount)}`;
    } else {
      voucherRowEl.style.display = "none";
    }
  }
}

/* ── render vouchers ─────────────────────────────── */

function renderVouchers() {
  const container = document.getElementById("voucherContainer");
  if (!container) return;

  if (!cartState.vouchers.length) {
    container.innerHTML = `<p class="no-voucher">No vouchers available right now.</p>`;
    return;
  }

  container.innerHTML = cartState.vouchers.map(v => {
    const isApplied = cartState.appliedVoucher &&
                      cartState.appliedVoucher.voucherId?.toString() === v._id?.toString();

    const discLabel = v.discountType === "flat"
      ? `Flat ${fmt(v.discount)} off`
      : `${v.discount}% off${v.maxDiscountAmount ? ` (max ${fmt(v.maxDiscountAmount)})` : ""}`;

    return `
    <div class="voucher-item ${isApplied ? "applied" : ""}">
      <div class="voucher-left">
        <span class="voucher-code">${v.code}</span>
        <span class="voucher-title">${v.title} – ${discLabel}</span>
        ${v.minOrderValue ? `<span class="voucher-min">Min order ${fmt(v.minOrderValue)}</span>` : ""}
        ${v.description   ? `<span class="voucher-desc">${v.description}</span>`                 : ""}
      </div>
      <button class="voucher-btn ${isApplied ? "remove-voucher" : ""}"
              onclick="${isApplied ? `removeVoucher()` : `applyVoucher('${v.code}')`}">
        ${isApplied ? "Remove" : "Apply"}
      </button>
    </div>`;
  }).join("");
}

/* ── render empty ────────────────────────────────── */

function renderEmpty() {
  const wrap        = document.getElementById("cartProducts");
  const countEl     = document.getElementById("cartItemCount");
  const cartHeader  = document.querySelector(".cart-header");
  const voucherCard = document.querySelector(".voucher-card");
  const cartRight   = document.querySelector(".cart-right");

  if (countEl)     countEl.textContent        = "(0 items)";
  if (cartHeader)  cartHeader.style.display   = "none";
  if (voucherCard) voucherCard.style.display  = "none";
  if (cartRight)   cartRight.style.display    = "none";

  if (wrap) wrap.innerHTML = `
    <div class="empty-cart">
      <i class="far fa-shopping-cart"></i>
      <h3>Your cart is empty</h3>
      <p>Looks like you haven't added anything yet.</p>
      <a href="shop.html" class="th-btn">Continue Shopping</a>
    </div>`;
}

/* ── apply voucher (calls API for logged-in) ─────── */

async function applyVoucher(voucherCode) {
  if (!isLoggedIn()) {
    showToast("Please login to apply vouchers", "error");
    return;
  }

  const btn = event && event.target;
  if (btn) { btn.disabled = true; btn.textContent = "Applying…"; }

  try {
    const res = await fetch(APPLY_VOUCHER_API, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ voucherCode })
    });
    const data = await res.json();

    if (!res.ok || !data.success) {
      showToast(data.message || "Failed to apply voucher", "error");
      if (btn) { btn.disabled = false; btn.textContent = "Apply"; }
      return;
    }

    // update local state with what the server returned
    cartState.appliedVoucher = data.appliedVoucher;
    showToast(`Voucher "${data.appliedVoucher.code}" applied!`, "success");
    renderSummary();
    renderVouchers();
  } catch (err) {
    console.error("[cart] applyVoucher failed:", err);
    showToast("Something went wrong. Please try again.", "error");
    if (btn) { btn.disabled = false; btn.textContent = "Apply"; }
  }
}

/* ── remove voucher (calls API for logged-in) ────── */

async function removeVoucher() {
  if (!isLoggedIn()) {
    cartState.appliedVoucher = null;
    renderSummary();
    renderVouchers();
    return;
  }

  const btn = event && event.target;
  if (btn) { btn.disabled = true; btn.textContent = "Removing…"; }

  try {
    const res = await fetch(REMOVE_VOUCHER_API, {
      method: "DELETE",
      headers: getAuthHeaders()
    });
    const data = await res.json();

    if (!res.ok || !data.success) {
      showToast(data.message || "Failed to remove voucher", "error");
      if (btn) { btn.disabled = false; btn.textContent = "Remove"; }
      return;
    }

    cartState.appliedVoucher = null;
    showToast("Voucher removed", "success");
    renderSummary();
    renderVouchers();
  } catch (err) {
    console.error("[cart] removeVoucher failed:", err);
    showToast("Something went wrong. Please try again.", "error");
    if (btn) { btn.disabled = false; btn.textContent = "Remove"; }
  }
}

/* ── quantity change ─────────────────────────────── */

async function changeQty(productId, delta) {
  const item = cartState.items.find(
    i => i.productId === productId || i.productId?.toString() === productId
  );
  if (!item) return;

  const newQty = item.quantity + delta;
  if (newQty < 1) { removeItem(productId); return; }
  if (newQty > item.stock) { showToast("Maximum stock reached", "error"); return; }

  // optimistic update
  item.quantity  = newQty;
  item.lineTotal = item.sellingPrice * newQty;
  cartState.subtotal = cartState.items.reduce((s, i) => s + i.lineTotal, 0);
  const qtyEl = document.getElementById(`qty-${productId}`);
  if (qtyEl) qtyEl.textContent = newQty;
  renderSummary();

  if (cartState.isGuest) {
    const gc = getGuestCart().map(i =>
      i.productId === productId ? { ...i, quantity: newQty } : i
    );
    saveGuestCart(gc);
    showToast("Cart updated", "success");
  } else {
    try {
      const res = await fetch(`${CONFIG.API_BASE}/cart/update`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify({ productId, quantity: newQty })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      showToast("Cart updated", "success");
    } catch (err) {
      console.error("[cart] updateQty failed:", err);
      showToast("Failed to update quantity", "error");
      await renderCart();
    }
  }
}

/* ── remove item ─────────────────────────────────── */

async function removeItem(productId) {
  const card = document.querySelector(`.cart-product-card[data-id="${productId}"]`);
  if (card) {
    card.style.transition = "opacity .3s, transform .3s";
    card.style.opacity    = "0";
    card.style.transform  = "translateX(30px)";
    await new Promise(r => setTimeout(r, 300));
  }

  if (cartState.isGuest) {
    const gc = getGuestCart().filter(i => i.productId !== productId);
    saveGuestCart(gc);
    showToast("Item removed", "success");
  } else {
    try {
      const res = await fetch(`${CONFIG.API_BASE}/cart/remove`, {
        method: "DELETE",
        headers: getAuthHeaders(),
        body: JSON.stringify({ productId })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      showToast("Item removed", "success");
    } catch (err) {
      console.error("[cart] removeItem failed:", err);
      showToast("Failed to remove item", "error");
    }
  }

  await renderCart();
}

/* ── checkout ────────────────────────────────────── */

async function proceedToCheckout() {
  if (!isLoggedIn()) {
    showToast("Please login to proceed to checkout", "error");
    sessionStorage.setItem("redirectAfterLogin", "cart.html");
    setTimeout(() => window.location.href = "login.html", 1200);
    return;
  }

  if (!cartState.items.length) {
    showToast("Your cart is empty", "error");
    return;
  }
  
//console.log(cartState.appliedVoucher?.voucherId , cartState.appliedVoucher?.code,cartState.appliedVoucher?.discountAmount)
  try {
    const token = localStorage.getItem("authToken") || localStorage.getItem("token");

    const response = await fetch(`${CONFIG.API_BASE}/checkout-from-cart`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        items: cartState.items.map(i => ({   // ← ADD THIS
          productId: i.productId,
          quantity:  i.quantity
        })),
        voucherId:      cartState.appliedVoucher?.voucherId      || null,
        voucherName:    cartState.appliedVoucher?.code    || null,
        discountAmount: cartState.appliedVoucher?.discountAmount || 0
      })
    });

    const data = await response.json();

    if (!response.ok) {
      showToast(data.message || "Failed to proceed checkout", "error");
      return;
    }

    showToast("Redirecting to checkout...", "success");
    window.location.href = "checkout.html";

  } catch (error) {
    console.error("Checkout Error:", error);
    showToast("Something went wrong", "error");
  }
}

/* ── voucher accordion ───────────────────────────── */

function toggleVouchers(btn) {
  const body     = document.getElementById("voucherContainer");
  const expanded = btn.getAttribute("aria-expanded") === "true";
  body.style.display = expanded ? "none" : "block";
  btn.setAttribute("aria-expanded", !expanded);
  btn.querySelector(".voucher-chevron").style.transform = expanded ? "" : "rotate(180deg)";
}

/* ── init ────────────────────────────────────────── */

document.addEventListener("DOMContentLoaded", async () => {
  if (!document.getElementById("cartProducts")) return;

  let retries = 0;
  while (typeof window.CartSystem === "undefined" && retries < 8) {
    await new Promise(r => setTimeout(r, 150));
    retries++;
  }

  await renderCart();
});