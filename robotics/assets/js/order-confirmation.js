// Load confirmation details from URL parameter
async function loadConfirmation() {
  console.log("[v0] Loading order confirmation...")

  const urlParams = new URLSearchParams(window.location.search)
  const orderId = urlParams.get("orderId")

  if (!orderId) {
    console.error("[v0] No order ID found in URL")
    window.location.href = "cart.html"
    return
  }

  try {
    showLoader()
    // Use the actual API service instead of static data
    const order = await api.getOrder(orderId)
    console.log("[v0] Order details:", order)

    if (!order) {
      throw new Error("Order not found")
    }

    // Display order info
    document.getElementById("orderId").textContent = order._id || order.id || orderId
    document.getElementById("orderDate").textContent = new Date(order.createdAt || Date.now()).toLocaleDateString()
    document.getElementById("orderStatus").textContent = order.status || "Confirmed"

    // Display delivery address
    console.log("[v0] Raw order for address debugging:", order)

    // helper to pick first non-empty key
    function pick(obj, keys) {
      if (!obj) return ""
      for (const k of keys) {
        const v = obj[k]
        if (v !== undefined && v !== null && String(v).trim() !== "") return v
      }
      return ""
    }

    // support multiple possible shapes returned by API
    const addrSource =
      (order.shipping && order.shipping.address) ||
      order.shipping ||
      order.shippingAddress ||
      order.address ||
      order.shipping_address ||
      {}

    const addressData = {
      street: pick(addrSource, ["street", "address", "addressLine1", "line1", "address1"]),
      apartment: pick(addrSource, ["apartment", "address2", "addressLine2", "line2"]),
      city: pick(addrSource, ["city", "town"]),
      state: pick(addrSource, ["state", "province", "region"]),
      zipCode: pick(addrSource, ["zipCode", "zipcode", "postalCode", "postal"]),
      country: pick(addrSource, ["country"]),
      contactNumber: pick(addrSource, ["contactNumber", "phone", "mobile", "contact", "phoneNumber"]),
    }

    const addressHtml = `
      ${addressData.street ? `<p>${addressData.street}</p>` : ""}
      ${addressData.apartment ? `<p>${addressData.apartment}</p>` : ""}
      ${(addressData.city || addressData.state || addressData.zipCode) ? `<p>${addressData.city || ""}${addressData.city && addressData.state ? ", " : ""}${addressData.state || ""} ${addressData.zipCode || ""}</p>` : ""}
      ${addressData.country ? `<p>${addressData.country}</p>` : ""}
      ${addressData.contactNumber ? `<p><strong>Phone:</strong> ${addressData.contactNumber}</p>` : ""}
    `
    const deliveryEl = document.getElementById("deliveryAddress")
    if (deliveryEl) deliveryEl.innerHTML = addressHtml

    // Display order items
    const itemsHtml = order.items
      ?.map(
        (item) => `
      <div class="item-row">
        <div><strong>${item.title || item.book?.title || "Item"}</strong></div>
        <div>Qty: ${item.quantity}</div>
        <div>$${(item.price * item.quantity).toFixed(2)}</div>
      </div>
    `
      )
      .join("") || ""
    document.getElementById("orderItems").innerHTML = itemsHtml

    // Display summary
    const charges = order.charges || {}
    document.getElementById("subtotal").textContent = "$" + (charges.subtotal || 0).toFixed(2)
    document.getElementById("tax").textContent = "$" + (charges.gst || charges.tax || 0).toFixed(2)
    document.getElementById("deliveryCharge").textContent = "$" + (charges.deliveryCharge || 0).toFixed(2)
    document.getElementById("paymentCharge").textContent = "$" + (charges.paymentCharge || 0).toFixed(2)

    const discount = charges.discount || order.appliedVoucher?.discount || 0
    if (discount > 0) {
      document.getElementById("discountRow").style.display = "flex"
      document.getElementById("discount").textContent = "-$" + discount.toFixed(2)
    }

    document.getElementById("total").textContent = "$" + (charges.totalAmount || 0).toFixed(2)

    hideLoader()
  } catch (error) {
    console.error("[v0] Error loading order confirmation:", error)
    hideLoader()
    showToast("Error loading order details. Redirecting to cart.", "error")
    setTimeout(() => {
      window.location.href = "cart.html"
    }, 2000)
  }
}

function showLoader() {
  const loader = document.getElementById("page-loader")
  if (loader) {
    loader.style.display = "flex"
  }
}

function hideLoader() {
  const loader = document.getElementById("page-loader")
  if (loader) {
    loader.style.display = "none"
  }
}

function showToast(message, type = "error") {
  console.log("[v0] Toast:", type, message)
  // You can implement a toast notification system here if needed
}

// Load on page load
document.addEventListener("DOMContentLoaded", loadConfirmation)
