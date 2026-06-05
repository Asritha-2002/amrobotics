/**
 * AM Robotics – Enhanced Shop Filter
 * - Category checkboxes with multi-select
 * - Search by product name & selling price
 * - Sort: All / Newest / Low→High / High→Low
 */

const API_BASE = `${CONFIG.API_BASE}/shop`;
const API_CART= CONFIG.API_BASE;

let selectedCountry = "IN";
let allProducts = [];          // master list fetched once
let activeCategories = new Set(); // checked category names
let searchQuery = "";
let sortOrder = "all";

/* ─────────────────────────────── country detect ── */
async function detectUserCountry() {
  try {
    const res  = await fetch("https://ipapi.co/json/");
    const data = await res.json();
    selectedCountry = data.country_code === "IN" ? "INDIA" : "US";
  } catch (_) {
    selectedCountry = "US";
  }
  await loadCategories();
  await loadProducts();
}
async function handleAddToCart(productId, qty = 1) {
  const token = localStorage.getItem("authToken");

  // Guest user
  if (!token) {
    let guestCart = JSON.parse(localStorage.getItem("guestCart")) || [];

    const existingIndex = guestCart.findIndex(
      item => item.productId === productId
    );

    if (existingIndex !== -1) {
      // Replace quantity
      guestCart[existingIndex].quantity = qty;
    } else {
      guestCart.push({
        productId,
        quantity: qty
      });
    }

    localStorage.setItem("guestCart", JSON.stringify(guestCart));

    alert("Added to cart");
    return;
  }

  // Logged-in user
  try {
    const response = await fetch(`${API_CART}/cart/add`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        productId,
        quantity: qty
      })
    });

    const data = await response.json();

    if (data.success) {
      alert("Added to cart");
    } else {
      alert(data.message);
    }
  } catch (error) {
    console.error(error);
    alert("Failed to add to cart");
  }
}
/* ─────────────────────────────── categories ─────── */
async function loadCategories() {
  try {
    const res  = await fetch(`${API_BASE}/categories/${selectedCountry}`);
    const data = await res.json();
    const container = document.getElementById("categories-list");

    if (!data.success || !data.categories.length) {
      container.innerHTML = "<li>No Categories Found</li>";
      return;
    }

    container.innerHTML = data.categories.map(cat => `
      <li style="margin-bottom:8px;list-style:none;padding:0;">
        <label style="
          display:flex;
          align-items:center;
          gap:10px;
          cursor:pointer;
          font-size:14px;
          color:#333;
          padding:8px 12px;
          border-radius:8px;
          border:1.5px solid #e5e7eb;
          background:#fff;
          transition:all 0.2s;
          user-select:none;
        "
        onmouseover="this.style.borderColor='#dc3545';this.style.background='#fff5f5'"
        onmouseout="if(!this.querySelector('input').checked){this.style.borderColor='#e5e7eb';this.style.background='#fff'}"
        >
          <span style="
            display:inline-flex;
            align-items:center;
            justify-content:center;
            width:18px;
            height:18px;
            min-width:18px;
            border:2px solid #dc3545;
            border-radius:4px;
            background:#fff;
            position:relative;
          " class="custom-checkbox-box" id="cb-box-${cat.replace(/\s+/g,'-')}">
            <svg class="check-icon" style="display:none;position:absolute;" width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2 6L5 9L10 3" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </span>
          <input
            type="checkbox"
            class="category-checkbox"
            value="${cat}"
            style="position:absolute;opacity:0;width:0;height:0;pointer-events:none;"
          >
          <span style="flex:1;">${cat}</span>
        </label>
      </li>
    `).join("");

    /* listen on all checkboxes */
    document.querySelectorAll(".category-checkbox").forEach(cb => {
      cb.addEventListener("change", onCategoryChange);
    });

  } catch (err) {
    console.error("loadCategories error:", err);
  }
}

function onCategoryChange(e) {
  const cat = e.target.value;
  const safeId = cat.replace(/\s+/g, '-');
  const box = document.getElementById(`cb-box-${safeId}`);
  const label = e.target.closest('label');

  if (e.target.checked) {
    activeCategories.add(cat);
    if (box) {
      box.style.background = '#dc3545';
      box.style.borderColor = '#dc3545';
      const icon = box.querySelector('.check-icon');
      if (icon) icon.style.display = 'block';
    }
    if (label) {
      label.style.borderColor = '#dc3545';
      label.style.background = '#fff5f5';
      label.style.fontWeight = '600';
    }
  } else {
    activeCategories.delete(cat);
    if (box) {
      box.style.background = '#fff';
      box.style.borderColor = '#dc3545';
      const icon = box.querySelector('.check-icon');
      if (icon) icon.style.display = 'none';
    }
    if (label) {
      label.style.borderColor = '#e5e7eb';
      label.style.background = '#fff';
      label.style.fontWeight = '400';
    }
  }
  renderFiltered();
}

/* ─────────────────────────────── products ──────── */
async function loadProducts() {
  try {
    const res  = await fetch(`${API_BASE}/products/${selectedCountry}`);
    const data = await res.json();
    const grid = document.getElementById("products-grid");

    if (!data.success || !data.products.length) {
      grid.innerHTML = `<div class="col-12"><h4>No Products Found</h4></div>`;
      return;
    }

    allProducts = data.products;
    renderFiltered();

  } catch (err) {
    console.error("loadProducts error:", err);
    document.getElementById("products-grid").innerHTML =
      `<div class="col-12"><h4>Failed to load products.</h4></div>`;
  }
}

/* ─────────────────────────────── filter + sort ─── */
function renderFiltered() {
  const currencySymbol = selectedCountry === "INDIA" ? "₹" : "$";
  const grid = document.getElementById("products-grid");

  let filtered = [...allProducts];

  /* 1. category filter */
  if (activeCategories.size > 0) {
    filtered = filtered.filter(p =>
      activeCategories.has(p.category)
    );
  }

  /* 2. search filter – name OR selling price */
  if (searchQuery.trim() !== "") {
    const q = searchQuery.trim().toLowerCase();
    filtered = filtered.filter(p => {
      const nameMatch  = p.name.toLowerCase().includes(q);
      const priceMatch = String(p.sellingPrice).includes(q);
      return nameMatch || priceMatch;
    });
  }

  /* 3. sort */
  if (sortOrder === "price-asc") {
    filtered.sort((a, b) => a.sellingPrice - b.sellingPrice);
  } else if (sortOrder === "price-desc") {
    filtered.sort((a, b) => b.sellingPrice - a.sellingPrice);
  } else if (sortOrder === "newest") {
    /* assumes products have a createdAt field; falls back to reverse index */
    filtered.sort((a, b) => {
      if (a.createdAt && b.createdAt) {
        return new Date(b.createdAt) - new Date(a.createdAt);
      }
      return allProducts.indexOf(b) - allProducts.indexOf(a);
    });
  }
  /* "all" → original API order */

  if (!filtered.length) {
    grid.innerHTML = `
      <div class="col-12" style="text-align:center;padding:40px 0;">
        <i class="far fa-search" style="font-size:40px;color:#ccc;"></i>
        <h4 style="margin-top:12px;color:#888;">No products match your filters.</h4>
        <button onclick="clearFilters()" style="margin-top:10px;background:#dc3545;color:#fff;border:none;padding:8px 20px;border-radius:6px;cursor:pointer;">
          Clear Filters
        </button>
      </div>`;
    return;
  }

  grid.innerHTML = filtered.map(product => {
    const image = product.images?.length
      ? product.images[0]
      : "assets/img/no-image.png";

    return `
      <div class="col-md-6 col-xl-4">
        <div class="product-card">
          <div class="product-image">
            ${product.stock <= 0
              ? `<span class="stock-badge">Out Of Stock</span>`
              : ""}
            <img src="${image}" alt="${product.name}" loading="lazy">
          </div>
          <div class="product-body">
            <h5 class="product-name">${product.name}</h5>
            <div class="product-price">
              <span class="sell">${currencySymbol}${product.sellingPrice}</span>
              ${product.originalPrice > product.sellingPrice
                ? `<span class="mrp">${currencySymbol}${product.originalPrice}</span>`
                : ""}
            </div>
            <div style="display:flex;gap:8px;">
              <button
                class="add-cart-btn"
                ${product.stock <= 0 ? "disabled" : ""}
                onclick="handleAddToCart('${product._id}',1)"
                style="flex:1;"
              >
                ${product.stock <= 0 ? "Out Of Stock" : "Add To Cart"}
              </button>
              <a
                href="product-details.html?id=${product._id}"
                style="flex:1;display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:10px;border-radius:8px;border:2px solid #dc3545;background:#fff;color:#dc3545;font-weight:600;font-size:13px;text-decoration:none;transition:all 0.2s;"
                onmouseover="this.style.background='#dc3545';this.style.color='#fff'"
                onmouseout="this.style.background='#fff';this.style.color='#dc3545'"
              >
                <i class="far fa-eye"></i> View
              </a>
            </div>
          </div>
        </div>
      </div>`;
  }).join("");
}

/* ─────────────────────────────── clear all ─────── */
function clearFilters() {
  document.querySelectorAll(".category-checkbox").forEach(cb => {
    cb.checked = false;
    const safeId = cb.value.replace(/\s+/g, '-');
    const box = document.getElementById(`cb-box-${safeId}`);
    const label = cb.closest('label');
    if (box) {
      box.style.background = '#fff';
      box.style.borderColor = '#dc3545';
      const icon = box.querySelector('.check-icon');
      if (icon) icon.style.display = 'none';
    }
    if (label) {
      label.style.borderColor = '#e5e7eb';
      label.style.background = '#fff';
      label.style.fontWeight = '400';
    }
  });
  activeCategories.clear();

  /* clear search */
  const searchInput = document.getElementById("shop-search-input");
  if (searchInput) searchInput.value = "";
  searchQuery = "";

  /* reset sort */
  const sortSelect = document.getElementById("shop-sort-select");
  if (sortSelect) sortSelect.value = "all";
  sortOrder = "all";

  renderFiltered();
}

/* ─────────────────────────────── search bar ────── */
document.addEventListener("DOMContentLoaded", () => {

  /* ── search input ── */
  const searchInput = document.getElementById("shop-search-input");
  if (searchInput) {
    searchInput.addEventListener("input", e => {
      searchQuery = e.target.value;
      renderFiltered();
    });

    /* prevent form submit reload */
    searchInput.closest("form")?.addEventListener("submit", e => e.preventDefault());
  }

  /* ── sort dropdown ── */
  const sortSelect = document.getElementById("shop-sort-select");
  if (sortSelect) {
    sortSelect.addEventListener("change", e => {
      sortOrder = e.target.value;
      renderFiltered();
    });
  }

  detectUserCountry();
});

/* ─────────────────────────────── cart stub ─────── */
