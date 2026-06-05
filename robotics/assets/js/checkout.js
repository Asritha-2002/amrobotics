
/* ===================================================
   checkout.js  –  AM Robotics Checkout Page
   Uses same cart API as cart.js
   Steps: 1 = Order Summary  2 = Address  3 = Payment
   =================================================== */

const CART_API = `${CONFIG.API_BASE}/checkout-from-cart`;
const BASE_API = CONFIG.API_BASE;

let checkoutState = {
  items:          [],
  subtotal:       0,
  appliedVoucher: null,   // from cart
  selectedDelivery: null,
  selectedPayment:  null
};

let currentStep  = 1;
const totalSteps = 3;

/* ── auth helpers ────────────────────────────────── */

function getToken() {
  return localStorage.getItem("authToken") || localStorage.getItem("token") || "";
}

function getAuthHeaders() {
  const token = getToken();
  return token
    ? { "Content-Type": "application/json", Authorization: `Bearer ${token}` }
    : { "Content-Type": "application/json" };
}

function isLoggedIn() { return !!getToken(); }

/* ── fmt ─────────────────────────────────────────── */

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

/* ── toast ───────────────────────────────────────── */

function showToast(message, type = "info") {
  const t = document.createElement("div");
  t.textContent = message;
  const bg = { error: "#dc3545", success: "#198754", info: "#0d6efd", warning: "#ffc107" };
  Object.assign(t.style, {
    position: "fixed", bottom: "24px", left: "50%", transform: "translateX(-50%)",
    background: bg[type] || bg.info,
    color: "#fff", padding: "12px 24px", borderRadius: "8px",
    zIndex: 9999, fontSize: "14px", fontWeight: "600",
    boxShadow: "0 4px 20px rgba(0,0,0,.2)", opacity: "1", transition: "opacity .4s"
  });
  document.body.appendChild(t);
  setTimeout(() => { t.style.opacity = "0"; setTimeout(() => t.remove(), 400); }, 3000);
}

/* ── loader ──────────────────────────────────────── */

function showLoader() {
  const el = document.getElementById("checkoutLoader");
  if (el) el.style.display = "flex";
}
function hideLoader() {
  const el = document.getElementById("checkoutLoader");
  if (el) el.style.display = "none";
}

/* ── init ────────────────────────────────────────── */

async function initCheckout() {
  if (!isLoggedIn()) {
    sessionStorage.setItem("redirectAfterLogin", "checkout.html");
    window.location.href = "login.html";
    return;
  }

  try {
    await loadCartData();
    await loadDeliveryOptions();
    await loadPaymentOptions();
    await loadSavedAddresses();
    renderSummaryStep();
    showStep(1);
  } catch (err) {
    console.error("[checkout] init failed:", err);
    showToast("Error loading checkout. Please refresh.", "error");
  }
}

/* ── load cart from same API as cart.js ──────────── */

async function loadCartData() {

  const token =
    localStorage.getItem("authToken") ||
    localStorage.getItem("token");

  const res = await fetch(
    `${CONFIG.API_BASE}/checkout-from-cart`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      }
    }
  );

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }

  const data = await res.json();

  if (
    !data.success ||
    !data.cartItems ||
    data.cartItems.length === 0
  ) {
    showToast("No checkout data found", "error");

    setTimeout(() => {
      window.location.href = "cart.html";
    }, 1500);

    throw new Error("No checkout data");
  }

  checkoutState.items = data.cartItems;
  checkoutState.subtotal = data.subtotal;
  checkoutState.appliedVoucher =
    data.appliedVoucher || null;

  //console.log("Checkout Data:", checkoutState);
  checkoutState.availableVouchers = data.availableVouchers || [];

  return data;
}


/* ── voucher accordion (same toggle as cart.html) ── */
function toggleCheckoutVouchers(btn) {
  const body     = document.getElementById("co-voucher-container");
  const expanded = btn.getAttribute("aria-expanded") === "true";
  body.style.display = expanded ? "none" : "block";
  btn.setAttribute("aria-expanded", !expanded);
  btn.querySelector(".voucher-chevron").style.transform = expanded ? "" : "rotate(180deg)";
}

/* ── render available vouchers in checkout ── */
function renderCheckoutVouchers() {
  const container = document.getElementById("co-voucher-container");
  if (!container) return;

  const vouchers = checkoutState.availableVouchers || [];

  if (!vouchers.length) {
    container.innerHTML = `<p style="color:#888;padding:12px 0;font-size:14px;">No vouchers available right now.</p>`;
    return;
  }

  container.innerHTML = vouchers.map(v => {
    const isApplied = checkoutState.appliedVoucher &&
      checkoutState.appliedVoucher.voucherId?.toString() === v._id?.toString();

    const discLabel = v.discountType === "flat"
      ? `Flat ₹${v.discount} off`
      : `${v.discount}% off${v.maxDiscountAmount ? ` (max ₹${v.maxDiscountAmount})` : ""}`;

    return `
      <div class="voucher-item ${isApplied ? "applied" : ""}">
        <div class="voucher-left">
          <span class="voucher-code">${v.code}</span>
          <span class="voucher-title">${v.title} – ${discLabel}</span>
          ${v.minOrderValue ? `<span class="voucher-min">Min order ₹${v.minOrderValue}</span>` : ""}
          ${v.description   ? `<span class="voucher-desc">${v.description}</span>`             : ""}
        </div>
        <button class="voucher-btn ${isApplied ? "remove-voucher" : ""}"
          onclick="${isApplied ? "removeCheckoutVoucher(event)" : `applyCheckoutVoucher('${v.code}', event)`}">
          ${isApplied ? "Remove" : "Apply"}
        </button>
      </div>`;
  }).join("");
}

/* ── apply voucher from checkout page ── */
async function applyCheckoutVoucher(voucherCode, event) {
  const btn = event?.target;
  if (btn) { btn.disabled = true; btn.textContent = "Applying…"; }

  try {
    const res  = await fetch(`${CONFIG.API_BASE}/apply-voucher`, {
      method:  "POST",
      headers: getAuthHeaders(),
      body:    JSON.stringify({ voucherCode })
    });
    const data = await res.json();

    if (!res.ok || !data.success) {
      showToast(data.message || "Failed to apply voucher", "error");
      if (btn) { btn.disabled = false; btn.textContent = "Apply"; }
      return;
    }

    checkoutState.appliedVoucher = data.appliedVoucher;
    showToast(`Voucher "${data.appliedVoucher.code}" applied!`, "success");
    renderCheckoutVouchers();
    updateTotalsDisplay();
  } catch (err) {
    showToast("Something went wrong. Please try again.", "error");
    if (btn) { btn.disabled = false; btn.textContent = "Apply"; }
  }
}

/* ── remove voucher from checkout page ── */
async function removeCheckoutVoucher(event) {
  const btn = event?.target;
  if (btn) { btn.disabled = true; btn.textContent = "Removing…"; }

  try {
    const res  = await fetch(`${CONFIG.API_BASE}/remove-voucher`, {
      method:  "DELETE",
      headers: getAuthHeaders()
    });
    const data = await res.json();

    if (!res.ok || !data.success) {
      showToast(data.message || "Failed to remove voucher", "error");
      if (btn) { btn.disabled = false; btn.textContent = "Remove"; }
      return;
    }

    checkoutState.appliedVoucher = null;
    showToast("Voucher removed", "success");
    renderCheckoutVouchers();
    updateTotalsDisplay();
  } catch (err) {
    showToast("Something went wrong.", "error");
    if (btn) { btn.disabled = false; btn.textContent = "Remove"; }
  }
}

/* ── render step 1 order summary ─────────────────── */

function renderSummaryStep() {
  const itemsEl   = document.getElementById("co-items");
  const sidebarEl = document.getElementById("co-items-sidebar");

  if (!itemsEl) return;

  const html = checkoutState.items.map(item => {
    const disc = item.discountPercent
      ? `<span class="discount-badge">-${item.discountPercent}%</span>` : "";
    const orig = item.originalPrice > item.sellingPrice
      ? `<span class="cart-original">${fmt(item.originalPrice)}</span>` : "";

    return `
    <div class="cart-product-card" style="margin-bottom:14px;">
      <img class="cart-product-img"
           src="${item.image || 'assets/img/product/default.png'}"
           alt="${item.name}"
           onerror="this.src='assets/img/product/default.png'"
           style="width:90px;height:90px;">
      <div class="cart-product-info">
        <div class="cart-product-name" style="font-size:15px;">${item.name}</div>
        <div class="country-tag">${item.country || ""}</div>
        <div class="price-row">
          <span class="cart-price" style="font-size:17px;">${fmt(item.sellingPrice)}</span>
          ${orig} ${disc}
        </div>
        <div style="margin-top:8px;font-size:13px;color:#666;">
          Qty: <strong>${item.quantity}</strong> &nbsp;|&nbsp;
          Subtotal: <strong>${fmt(item.lineTotal)}</strong>
        </div>
      </div>
    </div>`;
  }).join("");

  itemsEl.innerHTML   = html;
  if (sidebarEl) sidebarEl.innerHTML = html;

  updateTotalsDisplay();
  renderCheckoutVouchers();
}

/* ── totals display ──────────────────────────────── */

function updateTotalsDisplay() {
  const v               = checkoutState.appliedVoucher;
  const voucherDiscount = v ? (v.discountAmount || 0) : 0;
  const delivery        = checkoutState.selectedDelivery?.value || 0;
  const payment         = checkoutState.selectedPayment?.value  || 0;
  const finalTotal      = Math.max(0, checkoutState.subtotal - voucherDiscount + delivery + payment);

  const totalOriginal   = checkoutState.items.reduce((s, i) => s + (i.originalPrice * i.quantity), 0);
  const mrpSaving       = totalOriginal - checkoutState.subtotal;

  // main step 1 + sidebar (same IDs suffixed -sidebar)
  ["", "-sidebar"].forEach(sfx => {
    set(`co-subtotal${sfx}`,  fmt(checkoutState.subtotal));
    set(`co-saving${sfx}`,    mrpSaving > 0 ? `-${fmt(mrpSaving)}` : fmt(0));
    set(`co-delivery${sfx}`,  delivery > 0  ? fmt(delivery) : "Free");
    set(`co-total${sfx}`,     fmt(finalTotal));

    const vRow = document.getElementById(`co-voucher-row${sfx}`);
    if (vRow) {
      vRow.style.display = v && voucherDiscount > 0 ? "" : "none";
      set(`co-voucher-label${sfx}`,  v ? `Voucher (${v.code})` : "Voucher");
      set(`co-voucher-amount${sfx}`, v ? `-${fmt(voucherDiscount)}` : "");
    }
  });
}

function set(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

/* ── delivery options ────────────────────────────── */

async function loadDeliveryOptions() {
  try {
    const res  = await fetch(`${BASE_API}/store-config/DELIVERY`, { headers: getAuthHeaders() });
    const data = await res.json();
    const opts = Array.isArray(data) ? data : (data.data || []);
    renderDeliveryOptions(opts);
  } catch (err) {
    console.error("[checkout] delivery options failed:", err);
    document.getElementById("delivery-options").innerHTML =
      `<p style="color:#888">No delivery options available</p>`;
  }
}

function renderDeliveryOptions(options) {
  const el = document.getElementById("delivery-options");
  if (!el) return;

  if (!options.length) {
    el.innerHTML = `<p style="color:#888">No delivery options available</p>`;
    return;
  }

  el.innerHTML = options.map(opt => `
    <div class="co-option-item" onclick="selectDelivery('${opt._id}','${opt.name}',${parseFloat(opt.value)||0},this)">
      <div class="co-option-radio" id="dr-${opt._id}"></div>
      <div class="co-option-info">
        <span class="co-option-name">${opt.name}</span>
        <span class="co-option-desc">${opt.description || ""}</span>
      </div>
      <span class="co-option-price">${parseFloat(opt.value) > 0 ? fmt(parseFloat(opt.value)) : "Free"}</span>
    </div>`).join("");
}

function selectDelivery(id, name, value, el) {
  document.querySelectorAll("#delivery-options .co-option-item").forEach(i => i.classList.remove("selected"));
  document.querySelectorAll("#delivery-options .co-option-radio").forEach(i => i.classList.remove("checked"));
  el.classList.add("selected");
  document.getElementById(`dr-${id}`)?.classList.add("checked");
  checkoutState.selectedDelivery = { id, name, value };
  updateTotalsDisplay();
}

/* ── payment options ─────────────────────────────── */

async function loadPaymentOptions() {
  try {
    const res  = await fetch(`${BASE_API}/store-config/PAYMENTTYPE`, { headers: getAuthHeaders() });
    const data = await res.json();
    const opts = Array.isArray(data) ? data : (data.data || []);
    renderPaymentOptions(opts);
  } catch (err) {
    console.error("[checkout] payment options failed:", err);
    document.getElementById("payment-options").innerHTML =
      `<p style="color:#888">No payment options available</p>`;
  }
}

function renderPaymentOptions(options) {
  const el = document.getElementById("payment-options");
  if (!el) return;

  if (!options.length) {
    el.innerHTML = `<p style="color:#888">No payment options available</p>`;
    return;
  }

  el.innerHTML = options.map(opt => `
    <div class="co-option-item" onclick="selectPayment('${opt._id}','${opt.name}',${parseFloat(opt.value)||0},this)">
      <div class="co-option-radio" id="py-${opt._id}"></div>
      <div class="co-option-info">
        <span class="co-option-name">${opt.name}</span>
        <span class="co-option-desc">${opt.description || ""}</span>
      </div>
      <span class="co-option-price">${parseFloat(opt.value) > 0 ? `+${fmt(parseFloat(opt.value))}` : "Free"}</span>
    </div>`).join("");
}

function selectPayment(id, name, value, el) {
  document.querySelectorAll("#payment-options .co-option-item").forEach(i => i.classList.remove("selected"));
  document.querySelectorAll("#payment-options .co-option-radio").forEach(i => i.classList.remove("checked"));
  el.classList.add("selected");
  document.getElementById(`py-${id}`)?.classList.add("checked");
  checkoutState.selectedPayment = { id, name, value };
  updateTotalsDisplay();
}

/* ── saved addresses ─────────────────────────────── */

async function loadSavedAddresses() {
  try {
    const res  = await fetch(`${BASE_API}/user/addresses`, { headers: getAuthHeaders() });
    if (!res.ok) return;
    const data = await res.json();
    const addresses = Array.isArray(data) ? data : (data.addresses || data.data || []);
    const select = document.getElementById("saved-addresses");
    const wrap   = document.getElementById("saved-address-container");

    if (!addresses.length || !select) { if (wrap) wrap.style.display = "none"; return; }

    if (wrap) wrap.style.display = "block";
    select.innerHTML = `<option value="">-- Choose a saved address --</option>`;
    addresses.forEach(addr => {
      const opt  = document.createElement("option");
      opt.value  = JSON.stringify(addr);
      opt.textContent = `${addr.label || "Address"}: ${addr.street || ""}, ${addr.city || ""}`;
      if (addr.isDefault) { opt.selected = true; fillAddressForm(addr); }
      select.appendChild(opt);
    });
  } catch (err) {
    console.error("[checkout] load addresses failed:", err);
  }
}

function handleAddressSelect(sel) {
  if (!sel.value) return;
  try { fillAddressForm(JSON.parse(sel.value)); } catch (_) {}
}

function fillAddressForm(addr) {
  const map = {
    firstName: addr.firstName || addr.first_name || "",
    lastName:  addr.lastName  || addr.last_name  || "",
    email:     addr.email     || "",
    address:   addr.street    || addr.address    || "",
    apartment: addr.apartment || "",
    city:      addr.city      || "",
    state:     addr.state     || "",
    zipcode:   addr.zipCode   || addr.zipcode    || "",
    country:   addr.country   || "India",
    phone:     addr.contactNumber || addr.phone  || "",
  };
  const form = document.getElementById("checkoutForm");
  if (!form) return;
  Object.entries(map).forEach(([k, v]) => {
    const inp = form.elements[k];
    if (inp && v) { inp.value = v; }
  });
  showToast("Address filled", "success");
}

/* ── step navigation ─────────────────────────────── */

function showStep(n) {
  currentStep = n;

  document.querySelectorAll(".co-step-section").forEach(s => s.classList.remove("active"));
  const sec = document.getElementById(`co-step${n}`);
  if (sec) sec.classList.add("active");

  document.querySelectorAll(".step").forEach((s, i) => {
    s.classList.toggle("active", i + 1 <= n);
  });

  const prevBtn = document.getElementById("prevBtn");
  const nextBtn = document.getElementById("nextBtn");

  if (prevBtn) prevBtn.style.display = n === 1 ? "none" : "inline-flex";
  if (nextBtn) {
    nextBtn.textContent = n === totalSteps ? "Place Order" : "Next →";
    nextBtn.style.background = n === totalSteps
      ? "linear-gradient(135deg,#198754,#20c997)"
      : "linear-gradient(135deg,#dc3545,#c82333)";
  }

  updateTotalsDisplay();
  document.querySelector(".checkout-container")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function prevStep() {
  if (currentStep > 1) showStep(currentStep - 1);
}

function nextStep() {
  if (currentStep === 1) {
    showStep(2);
  } else if (currentStep === 2) {
    if (!validateAddress()) return;
    showStep(3);
  } else if (currentStep === 3) {
    placeOrder();
  }
}

/* ── address validation ──────────────────────────── */

function validateAddress() {
  const form   = document.getElementById("checkoutForm");
  const fields = ["firstName","lastName","email","phone","address","city","state","zipcode","country"];
  for (const f of fields) {
    const inp = form?.elements[f];
    if (!inp || !inp.value.trim()) {
      showToast(`Please fill in ${f.replace(/([A-Z])/g," $1").toLowerCase()}`, "error");
      inp?.focus(); return false;
    }
  }
  const email = form.elements.email?.value;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showToast("Please enter a valid email", "error"); return false;
  }
  const phone = form.elements.phone?.value?.replace(/\D/g,"");
  if (!phone || phone.length < 10) {
    showToast("Please enter a valid 10-digit phone number", "error"); return false;
  }
  return true;
}

/* ── place order ─────────────────────────────────── */

async function placeOrder() {
  if (!checkoutState.selectedDelivery) {
    showToast("Please select a delivery method", "error"); return;
  }
  if (!checkoutState.selectedPayment) {
    showToast("Please select a payment method", "error"); return;
  }

  const form    = document.getElementById("checkoutForm");
  const address = {
    firstName:     form.elements.firstName?.value || "",
    lastName:      form.elements.lastName?.value  || "",
    email:         form.elements.email?.value     || "",
    street:        form.elements.address?.value   || "",
    apartment:     form.elements.apartment?.value || "",
    city:          form.elements.city?.value      || "",
    state:         form.elements.state?.value     || "",
    zipCode:       form.elements.zipcode?.value   || "",
    country:       form.elements.country?.value   || "India",
    contactNumber: form.elements.phone?.value     || "",
  };

  // save address if checked
  const saveCheck = document.getElementById("save-address");
  if (saveCheck?.checked) {
    try {
      await fetch(`${BASE_API}/user/addresses`, {
        method: "POST", headers: getAuthHeaders(),
        body: JSON.stringify({ label: "Shipping Address", ...address })
      });
    } catch (_) {}
  }

  const v             = checkoutState.appliedVoucher;
  const voucherDiscount = v ? (v.discountAmount || 0) : 0;
  const delivery      = checkoutState.selectedDelivery.value || 0;
  const payment       = checkoutState.selectedPayment.value  || 0;
  const finalTotal    = Math.max(0, checkoutState.subtotal - voucherDiscount + delivery + payment);

  const orderData = {
    shippingAddress: address,
    paymentMethod:   checkoutState.selectedPayment.name,
    shippingMethod:  checkoutState.selectedDelivery.name,
    charges: {
      subtotal:       checkoutState.subtotal,
      deliveryCharge: delivery,
      paymentCharge:  payment,
      totalAmount:    finalTotal,
    },
    ...(v && {
      appliedVoucher: {
        voucherId:      v.voucherId,
        code:           v.code,
        discountAmount: voucherDiscount,
      }
    })
  };

  showLoader();

  try {
    const res  = await fetch(`${BASE_API}/orders/create`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(orderData)
    });
    const data = await res.json();
    hideLoader();

    if (!res.ok || !data.success) {
      showToast(data.message || "Failed to place order", "error"); return;
    }

    showToast("Order placed! Redirecting…", "success");
    const orderId = data.order?._id || data._id || data.orderId;
    setTimeout(() => {
      window.location.href = orderId
        ? `order-confirmation.html?orderId=${orderId}`
        : "index.html";
    }, 1500);
  } catch (err) {
    hideLoader();
    console.error("[checkout] placeOrder failed:", err);
    showToast("Something went wrong. Please try again.", "error");
  }
}

/* ── init on DOM ready ───────────────────────────── */
document.addEventListener("DOMContentLoaded", initCheckout);

