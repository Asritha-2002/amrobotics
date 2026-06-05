const API_BASE = "https://paypal.variants.ecomsandbox.softpages.in/api"

async function loadOrderSummary() {
  console.log("[v0] Loading order summary...")

  const cart = JSON.parse(localStorage.getItem("cart") || "[]")
  console.log("[v0] Cart items from localStorage:", cart)

  if (!Array.isArray(cart) || cart.length === 0) {
    console.log("[v0] Cart is empty, redirecting to cart.html")
    window.location.href = "cart.html"
    return
  }

  // Generate Order ID
  const orderId = "ORD-" + Date.now()
  document.getElementById("orderId").textContent = orderId
  localStorage.setItem("currentOrderId", orderId)

  // Display items
  const itemsList = document.getElementById("itemsList")
  itemsList.innerHTML = ""

  let subtotal = 0
  cart.forEach((item) => {
    const itemTotal = (item.productPrice || 0) * (item.quantity || 1)
    subtotal += itemTotal

    const row = document.createElement("div")
    row.className = "item-row"
    row.innerHTML = `
      <div class="item-image">
        <img src="assets/img/product/default.png" alt="${item.productName}">
      </div>
      <div class="item-details">
        <strong>${item.productName}</strong>
        <p>Quantity: ${item.quantity}</p>
      </div>
      <div>$${(item.productPrice || 0).toFixed(2)}</div>
      <div>${item.quantity}</div>
      <div><strong>$${itemTotal.toFixed(2)}</strong></div>
    `
    itemsList.appendChild(row)
  })

  // Fetch tax from API
  const charges = await fetchCharges()
  const taxCharge = charges.find((c) => c.category === "FINALCHARGES" && c.name === "Tax")
  const tax = taxCharge ? Number.parseFloat(taxCharge.value) : 0

  document.getElementById("subtotal").textContent = "$" + subtotal.toFixed(2)
  document.getElementById("tax").textContent = "$" + tax.toFixed(2)
  document.getElementById("deliveryCharge").textContent = "$0.00"
  document.getElementById("paymentCharge").textContent = "$0.00"

  const total = subtotal + tax
  document.getElementById("total").textContent = "$" + total.toFixed(2)

  // Store summary for checkout
  localStorage.setItem(
    "orderSummary",
    JSON.stringify({
      orderId,
      subtotal,
      tax,
      deliveryCharge: 0,
      paymentCharge: 0,
      discount: 0,
      total,
      items: cart,
    }),
  )

  console.log("[v0] Order summary loaded successfully")
}

async function fetchCharges() {
  try {
    console.log("[v0] Fetching charges from API...")
    const response = await fetch(API_BASE + "/shop-details/cat/FINALCHARGES")
    const data = await response.json()
    console.log("[v0] Charges fetched:", data)
    return data.details || []
  } catch (error) {
    console.error("[v0] Error fetching charges:", error)
    return []
  }
}

function proceedToCheckout() {
  window.location.href = "checkout.html"
}

document.addEventListener("DOMContentLoaded", loadOrderSummary)
