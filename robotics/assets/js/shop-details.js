/**
 * AM Robotics – Product Details JS
 */

const API_BASE = CONFIG.API_BASE;

function getIdFromUrl() {
  return new URLSearchParams(window.location.search).get("id") || null;
}
function sym(country) {
  return (country || "").toUpperCase() === "INDIA" ? "₹" : "$";
}

/* ─── image switcher ── */
function switchMainImage(src) {
  const main = document.getElementById("mainProductImage");
  if (!main) return;
  main.style.opacity = "0";
  setTimeout(() => { main.src = src; main.style.opacity = "1"; }, 180);
  document.querySelectorAll(".pd-thumb").forEach(t => {
    t.classList.toggle("active", t.dataset.src === src);
  });
}

/* ─── tag badges on image ── */
function renderTagBadgesOnImage(tags) {
  const old = document.getElementById("pdImageTagStrip");
  if (old) old.remove();
  if (!tags || !tags.length) return;

  const wrap = document.getElementById("pdImageWrap");
  if (!wrap) return;

  wrap.style.position = "relative";

  const strip = document.createElement("div");
  strip.id = "pdImageTagStrip";

  Object.assign(strip.style, {
    position:      "absolute",
    top:           "50px",
    left:          "12px",
    display:       "flex",
    flexDirection: "column",
    gap:           "5px",
    zIndex:        "4",
    pointerEvents: "none"
  });

  tags.slice(0, 5).forEach(tag => {
    const badge = document.createElement("span");
    badge.textContent = "#" + tag;
    Object.assign(badge.style, {
      display:        "inline-block",
      padding:        "4px 10px",
      background:     "rgba(40, 60, 235, 0.6)",
      color:          "#ffffff",
      fontSize:       "11px",
      fontWeight:     "600",
      borderRadius:   "20px",
      letterSpacing:  "0.3px",
      backdropFilter: "blur(6px)",
      border:         "1px solid rgba(255,255,255,0.18)",
      whiteSpace:     "nowrap",
      width:          "fit-content"
    });
    strip.appendChild(badge);
  });

  wrap.appendChild(strip);
}

/* ─── render ── */
function renderProduct(p) {
  const cs       = sym(p.country);
  const maxStock = p.stock ?? 0;

  document.getElementById("pdSkeleton").style.display = "none";
  document.getElementById("pdContent").style.display  = "block";

  document.title = p.name + " – AM Robotics";
  const bcTitle   = document.getElementById("pdBreadcrumbTitle");
  const bcProduct = document.getElementById("pdBreadcrumbProduct");
  if (bcTitle)   bcTitle.textContent   = p.name;
  if (bcProduct) bcProduct.textContent = p.name;

  const mainImg = document.getElementById("mainProductImage");
  if (mainImg && p.images && p.images.length) {
    mainImg.src = p.images[0];
    mainImg.alt = p.name;
  }

  /* stock badge */
  const badge = document.getElementById("pdStockBadge");
  if (badge) {
    badge.textContent = p.inStock ? maxStock + " In Stock" : "Out of Stock";
    badge.className   = "pd-stock-badge " + (p.inStock ? "in" : "out");
  }

  /* tags on image */
  renderTagBadgesOnImage(p.tags);

  /* thumbnails */
  const thumbsWrap = document.getElementById("pdThumbs");
  if (thumbsWrap) {
    if (p.images && p.images.length > 1) {
      thumbsWrap.innerHTML = p.images.map(function(src, i) {
        return '<img src="' + src + '" data-src="' + src + '" class="pd-thumb' + (i === 0 ? ' active' : '') + '" onclick="switchMainImage(\'' + src + '\')" alt="Image ' + (i+1) + '">';
      }).join("");
      thumbsWrap.style.display = "flex";
    } else {
      thumbsWrap.style.display = "none";
    }
  }

  const brandEl    = document.getElementById("pdBrand");
  const brandLabel = document.getElementById("pdBrandLabel");
  if (brandEl)    brandEl.textContent    = (p.brand || "AM Robotics").toUpperCase();
  if (brandLabel) brandLabel.textContent = "Brand: " + (p.brand || "AM Robotics");

  const titleEl = document.getElementById("pdTitle");
  if (titleEl) titleEl.textContent = p.name;

  const sellEl = document.getElementById("pdSellPrice");
  const origEl = document.getElementById("pdOriginalPrice");
  const discEl = document.getElementById("pdDiscount");
  if (sellEl) sellEl.textContent = cs + p.sellingPrice.toLocaleString();
  if (origEl) {
    if (p.originalPrice > p.sellingPrice) {
      origEl.textContent   = cs + p.originalPrice.toLocaleString();
      origEl.style.display = "inline";
    } else {
      origEl.style.display = "none";
    }
  }
  if (discEl) {
    if (p.discountPercent > 0) {
      discEl.textContent   = p.discountPercent + "% OFF";
      discEl.style.display = "inline-flex";
    } else {
      discEl.style.display = "none";
    }
  }

  /* availability with stock count */
  const availEl = document.getElementById("pdAvail");
  if (availEl) {
    availEl.className = "pd-avail " + (p.inStock ? "in" : "out");
    availEl.innerHTML = p.inStock
      ? '<i class="fas fa-check-circle"></i> In Stock &nbsp;<strong style="font-size:12px;opacity:.8;">(' + maxStock + ' available)</strong>'
      : '<i class="fas fa-times-circle"></i> Out of Stock';
  }

  const shortEl  = document.getElementById("pdShortDesc");
  const fullEl   = document.getElementById("pdFullDesc");
  const shortTxt = p.shortDescription || "";
  const fullTxt  = p.fullDescription  || p.shortDescription || "No description available.";
  if (shortEl) {
    shortEl.textContent   = shortTxt;
    shortEl.style.display = shortTxt ? "block" : "none";
  }
  if (fullEl) fullEl.textContent = fullTxt;

  const hlSection = document.getElementById("pdHighlights");
  const hlList    = document.getElementById("pdHighlightsList");
  if (hlSection && hlList) {
    if (p.highlights && p.highlights.length) {
      hlList.innerHTML        = p.highlights.map(function(h){ return "<li>" + h + "</li>"; }).join("");
      hlSection.style.display = "block";
    } else {
      hlSection.style.display = "none";
    }
  }

  const skuEl = document.getElementById("pdSku");
  const catEl = document.getElementById("pdCategory");
  if (skuEl) skuEl.textContent = p.sku || "—";
  if (catEl) { catEl.textContent = p.category; catEl.href = "shop.html"; }

  const tagsPill = document.getElementById("pdTagsPill");
  if (tagsPill) tagsPill.style.display = "none";

  /* qty + cart + buy now */
  const qtyInput = document.getElementById("pdQtyInput");
  const plusBtn  = document.getElementById("pdQtyPlus");
  const minusBtn = document.getElementById("pdQtyMinus");
  const qtyBox   = document.getElementById("pdQtyBox");
  const cartBtn  = document.getElementById("pdCartBtn");
  const buyBtn   = document.getElementById("pdBuyBtn");

  if (!p.inStock) {
    if (qtyBox)  qtyBox.style.display  = "none";
    if (cartBtn) {
      cartBtn.innerHTML = '<i class="fas fa-times-circle"></i> Out of Stock';
      cartBtn.disabled  = true;
    }
    if (buyBtn) buyBtn.style.display = "none";

  } else {
    if (qtyInput) {
      qtyInput.value = "1";
      qtyInput.max   = maxStock;
    }

    if (plusBtn) {
      plusBtn.onclick = function() {
        var cur = parseInt(qtyInput.value) || 1;
        if (cur < maxStock) {
          qtyInput.value = cur + 1;
        } else {
          pulseQty(qtyInput);
        }
      };
    }

    if (minusBtn) {
      minusBtn.onclick = function() {
        var cur = parseInt(qtyInput.value) || 1;
        if (cur > 1) qtyInput.value = cur - 1;
      };
    }

    if (qtyInput) {
      qtyInput.addEventListener("change", function() {
        var val = parseInt(qtyInput.value) || 1;
        if (val > maxStock) { val = maxStock; pulseQty(qtyInput); }
        if (val < 1)          val = 1;
        qtyInput.value = val;
      });
    }

    if (cartBtn) {
      cartBtn.innerHTML = '<i class="fas fa-cart-plus"></i> Add to Cart';
      cartBtn.disabled  = false;
      cartBtn.onclick   = function() { addToCart(p._id, p.name, parseInt(qtyInput ? qtyInput.value : 1) || 1); };
    }

    if (buyBtn) {
      buyBtn.style.display = "";
      buyBtn.innerHTML     = '<i class="fas fa-bolt"></i> Buy Now';
      buyBtn.disabled      = false;
      buyBtn.onclick       = function() { buyNow(p._id, p.name, parseInt(qtyInput ? qtyInput.value : 1) || 1); };
    }
  }

  loadRelated(p.category, p._id, p.country, cs);
}

function pulseQty(input) {
  if (!input) return;
  input.style.transition = "background .15s";
  input.style.background = "#fee2e2";
  input.style.color      = "#dc3545";
  setTimeout(function() {
    input.style.background = "#fff";
    input.style.color      = "#111";
  }, 400);
}

async function loadRelated(category, currentId, country, cs) {
  try {
    var res  = await fetch(API_BASE + "/shop/products/" + country + "?category=" + encodeURIComponent(category));
    var data = await res.json();
    if (!data.success) return;

    var related = data.products.filter(function(p){ return p._id !== currentId; }).slice(0, 6);
    if (!related.length) return;

    var section = document.getElementById("pdRelatedSection");
    var wrapper = document.getElementById("pdRelatedWrapper");
    if (!section || !wrapper) return;

    wrapper.innerHTML = related.map(function(p) {
      var img = (p.images && p.images[0]) || "assets/img/no-image.png";
      return '<div class="swiper-slide"><div class="pd-related-card"><div class="img-wrap"><img src="' + img + '" alt="' + p.name + '"></div><div class="card-body"><p class="card-name">' + p.name + '</p><p class="card-price">' + cs + p.sellingPrice.toLocaleString() + (p.originalPrice > p.sellingPrice ? '<del>' + cs + p.originalPrice.toLocaleString() + '</del>' : '') + '</p><div class="card-actions"><a href="product-details.html?id=' + p._id + '" class="btn-view"><i class="far fa-eye me-1"></i>View</a><button class="btn-cart" onclick="addToCart(\'' + p._id + '\',\'' + p.name + '\',1)"><i class="fas fa-cart-plus me-1"></i>Cart</button></div></div></div></div>';
    }).join("");

    section.style.display = "block";

    if (window.Swiper) {
      new Swiper("#productSlider1", {
        breakpoints: { 0:{slidesPerView:1}, 576:{slidesPerView:2}, 992:{slidesPerView:3} },
        navigation: {
          prevEl: "[data-slider-prev='#productSlider1']",
          nextEl: "[data-slider-next='#productSlider1']"
        }
      });
    }
  } catch(e) {
    console.warn("Related products error:", e);
  }
}

async function addToCart(productId, productName, qty) {

  const token = localStorage.getItem("authToken");

  // Guest User
  if (!token) {
    addGuestCart(productId, qty);

    alert(productName + " added to cart");
    return;
  }

  // Logged In User
  try {

    const response = await fetch(
      API_BASE + "/cart/add",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          productId,
          quantity: qty
        })
      }
    );

    const data = await response.json();

    if (data.success) {
      alert("Added to cart");
    } else {
      alert(data.message);
    }

  } catch (error) {
    console.error(error);
    alert("Failed to add cart item");
  }
}

function addGuestCart(productId, qty) {

  let cart = JSON.parse(
    localStorage.getItem("guestCart")
  ) || [];

  const existingItem = cart.find(
    item => item.productId === productId
  );

  if (existingItem) {

    existingItem.quantity = qty;

  } else {

    cart.push({
      productId,
      quantity: qty
    });

  }

  localStorage.setItem(
    "guestCart",
    JSON.stringify(cart)
  );

  console.log("Guest Cart:", cart);
}
async function buyNow(productId, productName, qty) {
  const token = localStorage.getItem("authToken") || localStorage.getItem("token");

  if (!token) {
    alert("Please login to continue");
    sessionStorage.setItem("redirectAfterLogin", window.location.href);
    window.location.href = "login.html";
    return;
  }

  try {
    const response = await fetch(`${CONFIG.API_BASE}/checkout-from-cart`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        items: [{ productId, quantity: qty }],  // single product as array
        voucherId:      null,
        voucherName:    null,
        discountAmount: 0
      })
    });

    const data = await response.json();

    if (!response.ok) {
      alert(data.message || "Failed to proceed");
      return;
    }

    window.location.href = "checkout.html";

  } catch (error) {
    console.error("Buy Now Error:", error);
    alert("Something went wrong");
  }
}

function showError(msg) {
  document.getElementById("pdSkeleton").style.display = "none";
  document.getElementById("pdContent").style.display  = "none";
  var errEl = document.getElementById("pdError");
  var msgEl = document.getElementById("pdErrorMsg");
  if (errEl) errEl.style.display = "block";
  if (msgEl) msgEl.textContent   = msg;
}

document.addEventListener("DOMContentLoaded", async function() {
  var id = getIdFromUrl();
  if (!id) { showError("No product ID found in URL."); return; }

  try {
    var res  = await fetch(API_BASE + "/products/" + id);
    if (!res.ok) { showError("Product not found (HTTP " + res.status + ")."); return; }

    var data = await res.json();
    if (!data.success || !data.product) {
      showError(data.message || "Product not found.");
      return;
    }
    renderProduct(data.product);

  } catch (err) {
    console.error("[shop-details]", err);
    showError("Could not connect to server. Is your backend running on port 5000?");
  }
});