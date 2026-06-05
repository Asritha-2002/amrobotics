/* ===================================================
   checkout.js  –  AM Robotics Checkout Page
   Steps: 1 = Order Summary  2 = Address  3 = Payment
   =================================================== */

const CART_API = `${CONFIG.API_BASE}/checkout-from-cart`;
const BASE_API = CONFIG.API_BASE;

let checkoutState = {
  items:             [],
  subtotal:          0,
  appliedVoucher:    null,
  availableVouchers: [],
  selectedDelivery:  null,
  selectedPayment:   null,
  shippingAddress:   null,
  gstPercent: 0,
  deliveryChargeFromAPI: 0,
};

let currentStep    = 1;
const totalSteps   = 3;
let selectedAddressId = null;
let addressMode       = "form"; // "saved" | "form"

/* ── auth helpers ──────────────────────────────── */

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

/* ── fmt ───────────────────────────────────────── */

function fmt(n) {
  const country   = localStorage.getItem("selectedCountry") || "IN";
  const localeMap = { IN: "en-IN", US: "en-US" };
  const symbolMap = { IN: "₹",    US: "$"      };
  return (symbolMap[country] || "₹") + Number(n).toLocaleString(localeMap[country] || "en-IN");
}

/* ── toast ─────────────────────────────────────── */

function showToast(message, type = "info") {
  const t  = document.createElement("div");
  t.textContent = message;
  const bg = { error: "#dc3545", success: "#198754", info: "#0d6efd", warning: "#ffc107" };
  Object.assign(t.style, {
    position: "fixed", bottom: "24px", left: "50%", transform: "translateX(-50%)",
    background: bg[type] || bg.info, color: "#fff",
    padding: "12px 24px", borderRadius: "8px", zIndex: 9999,
    fontSize: "14px", fontWeight: "600",
    boxShadow: "0 4px 20px rgba(0,0,0,.2)", opacity: "1", transition: "opacity .4s"
  });
  document.body.appendChild(t);
  setTimeout(() => { t.style.opacity = "0"; setTimeout(() => t.remove(), 400); }, 3000);
}

/* ── loader ────────────────────────────────────── */

function showLoader() {
  const el = document.getElementById("checkoutLoader");
  if (el) el.style.display = "flex";
}
function hideLoader() {
  const el = document.getElementById("checkoutLoader");
  if (el) el.style.display = "none";
}
function loadPayPalSDK() {
  return new Promise((resolve, reject) => {
    // if already loaded, resolve immediately
    if (typeof paypal !== "undefined") { resolve(); return; }

    const country = localStorage.getItem("selectedCountry") || "IN";
    const isSandbox = true; // flip to false when going live
    const currency = isSandbox ? "USD" : (country === "IN" ? "INR" : "USD");

    // SANDBOX client ID — replace the live key below when going live
    const sandboxClientId = "BAAbgiwgDG2SfehbaLCmJ8BCXyLzYVGDS-OfQzx2Wn-lIHN21wKvV5M3wqtAALOuDWIBzpj1b1jlxZVLA8";
    const liveClientId    = "YOUR_LIVE_CLIENT_ID_HERE";

    // switch this to liveClientId when going live
    const clientId = sandboxClientId;

    const script = document.createElement("script");
    script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&currency=${currency}&intent=capture`;
    script.onload  = () => resolve();
    script.onerror = () => reject(new Error("PayPal SDK failed to load"));
    document.body.appendChild(script);
  });
}
async function fetchFinalCharges() {
  try {
    const res = await fetch(`${CONFIG.API_BASE}/final-charges`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.success && data.charge && !data.charge.isFree) {
      checkoutState.gstPercent = data.charge.numericValue || 0;
    } else {
      checkoutState.gstPercent = 0;
    }
  } catch (err) {
    console.warn("[checkout] fetchFinalCharges failed:", err);
    checkoutState.gstPercent = 0;
  }
}
async function fetchDeliveryCharges() {
  try {
    const country = localStorage.getItem("selectedCountry") || "IN";
    const countryNameMap = { IN: "India", US: "US" };
    const countryName = countryNameMap[country] || "India";

    const res = await fetch(`${CONFIG.API_BASE}/delivery-charges?country=${countryName}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    if (data.success && data.charge && !data.charge.isFree) {
      checkoutState.deliveryChargeFromAPI = data.charge.numericValue || 0;
    } else {
      checkoutState.deliveryChargeFromAPI = 0;
    }
  } catch (err) {
    console.warn("[checkout] fetchDeliveryCharges failed:", err);
    checkoutState.deliveryChargeFromAPI = 0;
  }
}
/* ── init ──────────────────────────────────────── */

async function initCheckout() {
  if (!isLoggedIn()) {
    sessionStorage.setItem("redirectAfterLogin", "checkout.html");
    window.location.href = "login.html";
    return;
  }
  try {
    await loadCartData();
    await loadSavedAddresses();
    await fetchFinalCharges();
    await fetchDeliveryCharges();
    renderSummaryStep();
    showStep(1);
  } catch (err) {
    console.error("[checkout] init failed:", err);
    showToast("Error loading checkout. Please refresh.", "error");
  }
}

/* ── load BuyNow data ──────────────────────────── */

async function loadCartData() {
  const token = localStorage.getItem("authToken") || localStorage.getItem("token");

  const res = await fetch(`${CONFIG.API_BASE}/checkout-from-cart`, {
    method:  "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization:  `Bearer ${token}`
    }
    // no body — GET requests don't have a body
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();

  if (!data.cartItems || data.cartItems.length === 0) {
    showToast("No checkout data found", "error");
    setTimeout(() => window.location.href = "cart.html", 1500);
    throw new Error("No checkout data");
  }
  if(!data.success){
    showToast("Order success navigating to shop page", "success");
    setTimeout(() => window.location.href = "shop.html", 1500);
  }

  checkoutState.items             = data.cartItems;
  checkoutState.subtotal          = data.subtotal;
  checkoutState.appliedVoucher    = data.appliedVoucher    || null;
  checkoutState.availableVouchers = data.availableVouchers || [];
}

/* ── voucher accordion ─────────────────────────── */

function toggleCheckoutVouchers(btn) {
  const body     = document.getElementById("co-voucher-container");
  const expanded = btn.getAttribute("aria-expanded") === "true";
  body.style.display = expanded ? "none" : "block";
  btn.setAttribute("aria-expanded", !expanded);
  btn.querySelector(".voucher-chevron").style.transform = expanded ? "" : "rotate(180deg)";
}

/* ── render vouchers ───────────────────────────── */

function renderCheckoutVouchers() {
  const container = document.getElementById("co-voucher-container");
  if (!container) return;

  const vouchers = checkoutState.availableVouchers || [];
  if (!vouchers.length) {
    container.innerHTML = `<p style="color:#888;padding:12px 0;font-size:14px;">No vouchers available right now.</p>`;
    return;
  }

  container.innerHTML = vouchers.map(v => {
    const isApplied  = checkoutState.appliedVoucher &&
      checkoutState.appliedVoucher.voucherId?.toString() === v._id?.toString();
    const discLabel  = v.discountType === "flat"
      ? `Flat ₹${v.discount} off`
      : `${v.discount}% off${v.maxDiscountAmount ? ` (max ₹${v.maxDiscountAmount})` : ""}`;

    return `
      <div class="voucher-item ${isApplied ? "applied" : ""}">
        <div class="voucher-left">
          <span class="voucher-code">${v.code}</span>
          <span class="voucher-title">${v.title} – ${discLabel}</span>
          ${v.minOrderValue ? `<span class="voucher-min">Min order ₹${v.minOrderValue}</span>` : ""}
          ${v.description   ? `<span class="voucher-desc">${v.description}</span>` : ""}
        </div>
        <button class="voucher-btn ${isApplied ? "remove-voucher" : ""}"
          onclick="${isApplied ? "removeCheckoutVoucher(event)" : `applyCheckoutVoucher('${v.code}', event)`}">
          ${isApplied ? "Remove" : "Apply"}
        </button>
      </div>`;
  }).join("");
}

/* ── apply voucher ─────────────────────────────── */

async function applyCheckoutVoucher(voucherCode, event) {
  const btn = event?.target;
  if (btn) { btn.disabled = true; btn.textContent = "Applying…"; }
  try {
    const res  = await fetch(`${CONFIG.API_BASE}/apply-voucher`, {
      method: "POST", headers: getAuthHeaders(),
      body:   JSON.stringify({ voucherCode })
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

/* ── remove voucher ────────────────────────────── */

async function removeCheckoutVoucher(event) {
  const btn = event?.target;
  if (btn) { btn.disabled = true; btn.textContent = "Removing…"; }
  try {
    const res  = await fetch(`${CONFIG.API_BASE}/remove-voucher`, {
      method: "DELETE", headers: getAuthHeaders()
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

/* ── render step 1 ─────────────────────────────── */

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

  itemsEl.innerHTML = html;
  if (sidebarEl) sidebarEl.innerHTML = html;

  updateTotalsDisplay();
  renderCheckoutVouchers();
}

/* ── totals display ────────────────────────────── */

function updateTotalsDisplay() {
  const v               = checkoutState.appliedVoucher;
  const voucherDiscount = v ? (v.discountAmount || 0) : 0;
  const delivery = checkoutState.selectedDelivery != null
    ? checkoutState.selectedDelivery.value
    : checkoutState.deliveryChargeFromAPI;
  const payment         = checkoutState.selectedPayment?.value  || 0;
  const gstAmount  = Math.round(checkoutState.subtotal * (checkoutState.gstPercent / 100));
  const finalTotal = Math.max(0, checkoutState.subtotal - voucherDiscount + delivery + payment + gstAmount);
  const totalOriginal   = checkoutState.items.reduce((s, i) => s + (i.originalPrice * i.quantity), 0);
  const mrpSaving       = totalOriginal - checkoutState.subtotal;

  ["", "-sidebar", "-recap"].forEach(sfx => {
    set(`co-subtotal${sfx}`, fmt(checkoutState.subtotal));
    set(`co-saving${sfx}`,   mrpSaving > 0 ? `-${fmt(mrpSaving)}` : fmt(0));
    set(`co-delivery${sfx}`, delivery > 0  ? fmt(delivery) : "Free");
    set(`co-total${sfx}`,    fmt(finalTotal));
    const gstRowEl = document.getElementById(`co-gst-row${sfx}`);
    if (gstRowEl) {
      gstRowEl.style.display = gstAmount > 0 ? "" : "none";
      set(`co-gst-amount${sfx}`, `${fmt(gstAmount)} (${checkoutState.gstPercent}%)`);
    }

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

/* ── delivery options ──────────────────────────── */

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
    el.innerHTML = `<p style="color:#888">No delivery options available</p>`; return;
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

/* ── payment options ───────────────────────────── */

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
    el.innerHTML = `<p style="color:#888">No payment options available</p>`; return;
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

/* ── load saved addresses ──────────────────────── */

async function loadSavedAddresses() {
  try {
    const res = await fetch(`${BASE_API}/user/checkout-addresses`, {
      headers: getAuthHeaders()
    });
    if (!res.ok) { showAddressForm(); return; }

    const data      = await res.json();
    const addresses = data.addresses || [];

    if (addresses.length > 0) {
      renderSavedAddressCards(addresses);
      showSavedAddresses();
    } else {
      showAddressForm();
    }
  } catch (err) {
    console.error("[checkout] load addresses failed:", err);
    showAddressForm();
  }
}

/* ── render saved address cards ────────────────── */

function renderSavedAddressCards(addresses) {
  const wrap = document.getElementById("address-cards-wrap");
  if (!wrap) return;

  wrap.innerHTML = addresses.map(addr => `
    <div class="saved-addr-card" id="addr-card-${addr._id}"
         onclick="selectSavedAddress('${addr._id}', this)">
      <div class="addr-radio" id="addr-radio-${addr._id}"></div>
      <div class="addr-info">
        <span class="addr-label">${addr.label || "Address"}</span>
        <div class="addr-name">${addr.firstName} ${addr.lastName}</div>
        <div class="addr-line">
          ${addr.address1}${addr.address2 ? ", " + addr.address2 : ""}<br>
          ${addr.city}, ${addr.state} – ${addr.postalCode}<br>
          ${addr.country} &nbsp;|&nbsp; 📞 ${addr.phone}
        </div>
      </div>
      <button class="addr-edit-btn"
        onclick="event.stopPropagation(); editSavedAddress(
          '${addr._id}',
          ${JSON.stringify(addr).replace(/"/g, '&quot;')}
        )">✏️ Edit</button>
    </div>`).join("");
}

/* ── select saved address ──────────────────────── */

function selectSavedAddress(id, cardEl) {
  document.querySelectorAll(".saved-addr-card").forEach(c => c.classList.remove("selected"));
  document.querySelectorAll(".addr-radio").forEach(r => r.classList.remove("checked"));
  cardEl.classList.add("selected");
  document.getElementById(`addr-radio-${id}`)?.classList.add("checked");
  selectedAddressId = id;
}

/* ── edit saved address ────────────────────────── */

function editSavedAddress(id, addr) {
  showAddressForm();
  const form = document.getElementById("checkoutForm");
  if (!form) return;

  form.elements.firstName.value  = addr.firstName  || "";
  form.elements.lastName.value   = addr.lastName   || "";
  form.elements.email.value      = addr.email      || "";
  form.elements.phone.value      = addr.phone      || "";
  form.elements.address1.value   = addr.address1   || "";
  form.elements.address2.value   = addr.address2   || "";
  form.elements.city.value       = addr.city       || "";
  form.elements.state.value      = addr.state      || "";
  form.elements.postalCode.value = addr.postalCode || "";
  form.elements.country.value    = addr.country    || "India";

  document.getElementById("editing-address-id").value   = id;
  document.getElementById("form-mode-title").textContent = "Edit Address";
}

/* ── show/hide address UI ──────────────────────── */

function showSavedAddresses() {
  addressMode = "saved";
  document.getElementById("saved-addresses-list").style.display = "block";
  document.getElementById("address-form-wrap").style.display    = "none";
}

function showAddressForm() {
  addressMode = "form";
  document.getElementById("saved-addresses-list").style.display = "none";
  document.getElementById("address-form-wrap").style.display    = "block";

  const cards   = document.querySelectorAll(".saved-addr-card");
  const backBtn = document.getElementById("back-to-saved-btn");
  if (backBtn) backBtn.style.display = cards.length > 0 ? "inline-block" : "none";

  const editId = document.getElementById("editing-address-id");
  if (editId && !editId.value) {
    document.getElementById("form-mode-title").textContent = "Enter Shipping Address";
    document.getElementById("checkoutForm")?.reset();
    const country = document.getElementById("country");
    if (country) country.value = "India";
  }
}

/* ── validate address form ─────────────────────── */

function validateAddress() {
  const form   = document.getElementById("checkoutForm");
  // ← correct field names matching the HTML
  const fields = ["firstName","lastName","email","phone","address1","city","state","postalCode","country"];
  for (const f of fields) {
    const inp = form?.elements[f];
    if (!inp || !inp.value.trim()) {
      showToast(`Please fill in ${f.replace(/([A-Z])/g," $1").toLowerCase()}`, "error");
      inp?.focus(); return false;
    }
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.elements.email.value)) {
    showToast("Please enter a valid email", "error"); return false;
  }
  const phone = form.elements.phone.value.replace(/\D/g,"");
  if (!phone || phone.length < 10) {
    showToast("Please enter a valid 10-digit phone number", "error"); return false;
  }
  return true;
}

/* ── step navigation ───────────────────────────── */

function showStep(n) {
  currentStep = n;
  document.querySelectorAll(".co-step-section").forEach(s => s.classList.remove("active"));
  document.getElementById(`co-step${n}`)?.classList.add("active");

  document.querySelectorAll(".step").forEach((s, i) => {
    s.classList.toggle("active", i + 1 <= n);
  });

  const prevBtn = document.getElementById("prevBtn");
  const nextBtn = document.getElementById("nextBtn");
  if (prevBtn) prevBtn.style.display = n === 1 ? "none" : "inline-flex";
  if (nextBtn) {
    nextBtn.style.display = n === totalSteps ? "none" : "inline-flex";
    if (n !== totalSteps) {
      nextBtn.textContent   = "Next →";
      nextBtn.style.background = "linear-gradient(135deg,#dc3545,#c82333)";
    }
  }

  updateTotalsDisplay();
  if (n === 3) renderPayPalButton();
  document.querySelector(".checkout-container")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function prevStep() {
  if (currentStep > 1) showStep(currentStep - 1);
}

/* ── next step ─────────────────────────────────── */

function nextStep() {
  if (currentStep === 1) {
    showStep(2);

  } else if (currentStep === 2) {
    if (addressMode === "saved") {
      if (!selectedAddressId) {
        showToast("Please select an address or add a new one", "error"); return;
      }
      saveSelectedAddress();
    } else {
      if (!validateAddress()) return;
      saveFormAddress();
    }

  } else if (currentStep === 3) {
  //payment is handled by PayPal button — nothing to do here
  }
}

/* ── save selected address ─────────────────────── */

async function saveSelectedAddress() {
  try {
    const res  = await fetch(`${BASE_API}/user/select-address`, {
      method: "POST", headers: getAuthHeaders(),
      body:   JSON.stringify({ addressId: selectedAddressId })
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      showToast(data.message || "Failed to select address", "error"); return;
    }
    checkoutState.shippingAddress = data.shippingAddress;
    showStep(3);
  } catch (err) {
    showToast("Something went wrong", "error");
  }
}

/* ── save form address ─────────────────────────── */

async function saveFormAddress() {
  const form          = document.getElementById("checkoutForm");
  const saveForFuture = document.getElementById("save-address")?.checked;
  const editingId     = document.getElementById("editing-address-id")?.value;

  const addressData = {
    firstName:    form.elements.firstName.value.trim(),
    lastName:     form.elements.lastName.value.trim(),
    email:        form.elements.email.value.trim(),
    phone:        form.elements.phone.value.trim(),
    address1:     form.elements.address1.value.trim(),
    address2:     form.elements.address2.value.trim(),
    city:         form.elements.city.value.trim(),
    state:        form.elements.state.value.trim(),
    postalCode:   form.elements.postalCode.value.trim(),
    country:      form.elements.country.value.trim(),
    saveForFuture,
  };

  try {
    if (editingId) {
      // update existing saved address
      const res  = await fetch(`${BASE_API}/user/checkout-addresses/${editingId}`, {
        method: "PUT", headers: getAuthHeaders(),
        body:   JSON.stringify(addressData)
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.message || "Failed to update address", "error"); return; }
      showToast("Address updated!", "success");
      // also save to BuyNow
      await fetch(`${BASE_API}/user/save-shipping-address`, {
        method: "POST", headers: getAuthHeaders(),
        body:   JSON.stringify(addressData)
      });
    } else {
      // new address
      const res  = await fetch(`${BASE_API}/user/save-shipping-address`, {
        method: "POST", headers: getAuthHeaders(),
        body:   JSON.stringify(addressData)
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        showToast(data.message || "Failed to save address", "error"); return;
      }
    }

    checkoutState.shippingAddress = addressData;
    showStep(3);
  } catch (err) {
    showToast("Something went wrong", "error");
  }
}

/* ── place order ───────────────────────────────── */

async function placeOrder(paypalOrderId) {
  if (!checkoutState.shippingAddress) {
    showToast("Shipping address missing. Please go back to step 2.", "error");
    return;
  }

  if (!checkoutState.items || checkoutState.items.length === 0) {
    showToast("No items found. Please go back to cart.", "error");
    return;
  }

  const v               = checkoutState.appliedVoucher;
  const voucherDiscount = v ? (v.discountAmount || 0) : 0;
  const delivery        = checkoutState.deliveryChargeFromAPI || 0;
  const gstAmount       = Math.round(checkoutState.subtotal * (checkoutState.gstPercent / 100));
  const finalTotal      = Math.max(0, checkoutState.subtotal - voucherDiscount + delivery + gstAmount);

  const orderData = {
    shippingAddress: checkoutState.shippingAddress,
    paymentMethod:   "PayPal",
    shippingMethod:  "Standard Delivery",
    paypalOrderId:   paypalOrderId,

    // ── pass items directly from checkoutState ──
    items: checkoutState.items.map(item => ({
      productId:      item.productId,
      name:           item.name,
      sku:            item.sku           || "",
      brand:          item.brand         || "",
      category:       item.category      || "",
      country:        item.country       || "",
      image:          item.image         || "",
      quantity:       item.quantity,
      sellingPrice:   item.sellingPrice,
      originalPrice:  item.originalPrice,
      discountPercent: item.discountPercent || 0,
      lineTotal:      item.lineTotal,
    })),

    charges: {
      subtotal:       checkoutState.subtotal,
      deliveryCharge: delivery,
      gstAmount:      gstAmount,
      paymentCharge:  0,
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
      method:  "POST",
      headers: getAuthHeaders(),
      body:    JSON.stringify(orderData)
    });
    const data = await res.json();
    hideLoader();

    if (!res.ok || !data.success) {
      showToast(data.message || "Failed to place order", "error");
      return;
    }

    document.getElementById("paypal-button-container").style.display = "none";
    const successMsg = document.getElementById("payment-success-msg");
    if (successMsg) successMsg.style.display = "block";
    const orderIdEl = document.getElementById("order-id-display");
    if (orderIdEl) orderIdEl.textContent = `Order ID: ${data.order._id}`;

    showToast("Order placed successfully! 🎉", "success");

  } catch (err) {
    hideLoader();
    console.error("[checkout] placeOrder failed:", err);
    showToast("Something went wrong. Please try again.", "error");
  }
}
async function renderPayPalButton() {
  const container = document.getElementById("paypal-button-container");
  if (!container) return;

  try {
    await loadPayPalSDK();
  } catch (err) {
    console.error("[paypal] SDK load failed:", err);
    showToast("Payment gateway failed to load. Please refresh.", "error");
    return;
  }

  // clear any previously rendered button
  container.innerHTML = "";

  const v               = checkoutState.appliedVoucher;
  const voucherDiscount = v ? (v.discountAmount || 0) : 0;
  const delivery        = checkoutState.deliveryChargeFromAPI || 0;
  const gstAmount       = Math.round(checkoutState.subtotal * (checkoutState.gstPercent / 100));
  const finalTotal      = Math.max(0, checkoutState.subtotal - voucherDiscount + delivery + gstAmount);
  const amount          = finalTotal.toFixed(2);

  paypal.Buttons({
    style: {
      layout: "vertical",
      color:  "blue",
      shape:  "rect",
      label:  "pay"
    },

    createOrder: function(data, actions) {
      return actions.order.create({
        purchase_units: [{
          amount: { value: amount },
          description: "AM Robotics Order"
        }]
      });
    },

    onApprove: function(data, actions) {
      showLoader();
      return actions.order.capture().then(function(details) {
        hideLoader();
        showToast(`Payment successful! Thank you, ${details.payer.name.given_name}.`, "success");
        placeOrder(details.id);
      });
    },

    onError: function(err) {
      hideLoader();
      console.error("[paypal] error:", err);
      showToast("Payment failed. Please try again.", "error");
    },

    onCancel: function() {
      showToast("Payment cancelled.", "info");
    }

  }).render("#paypal-button-container");
}

/* ── init on DOM ready ─────────────────────────── */
document.addEventListener("DOMContentLoaded", initCheckout);