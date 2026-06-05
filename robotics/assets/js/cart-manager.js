// Cart Manager - Centralized cart operations
window.cartManager = {
  API_BASE_URL: "https://paypal.variants.ecomsandbox.softpages.in",

  // Get cart from localStorage
  getCart() {
    const cartData = localStorage.getItem("cart")
    try {
      return cartData ? JSON.parse(cartData) : []
    } catch (e) {
      console.error("[v0] Error parsing cart:", e)
      return []
    }
  },

  // Save cart to localStorage
  saveCart(cart) {
    localStorage.setItem("cart", JSON.stringify(cart))
    this.updateCartBadge()
  },

  // Add to cart
  addToCart(productId, quantity = 1, productData = {}) {
    try {
      const cart = this.getCart()

      // Check if product already exists
      const existingItem = cart.find((item) => item.productId === productId)

      if (existingItem) {
        existingItem.quantity += quantity
        console.log("[v0] Updated quantity for product:", productId)
      } else {
        cart.push({
          productId,
          quantity,
          productName: productData.name || "Product",
          productPrice: Number.parseFloat(productData.price) || 0,
          productImage: productData.image || "assets/img/product/default.png",
          variantData: productData.variant || null,
          addedAt: new Date().toISOString(),
        })
        console.log("[v0] Added new product to cart:", productId)
      }

      this.saveCart(cart)
      return { success: true, message: "Product added to cart!" }
    } catch (error) {
      console.error("[v0] Error adding to cart:", error)
      return { success: false, message: "Error adding to cart" }
    }
  },

  // Remove from cart
  removeFromCart(productId) {
    try {
      let cart = this.getCart()
      cart = cart.filter((item) => item.productId !== productId)
      this.saveCart(cart)
      return { success: true, message: "Product removed from cart" }
    } catch (error) {
      console.error("[v0] Error removing from cart:", error)
      return { success: false, message: "Error removing from cart" }
    }
  },

  // Update quantity
  updateQuantity(productId, quantity) {
    try {
      const cart = this.getCart()
      const item = cart.find((item) => item.productId === productId)

      if (item) {
        item.quantity = Math.max(1, Number.parseInt(quantity))
        this.saveCart(cart)
        return { success: true, message: "Quantity updated" }
      }
      return { success: false, message: "Product not found" }
    } catch (error) {
      console.error("[v0] Error updating quantity:", error)
      return { success: false, message: "Error updating quantity" }
    }
  },

  // Clear cart
  clearCart() {
    try {
      localStorage.removeItem("cart")
      this.updateCartBadge()
      return { success: true, message: "Cart cleared" }
    } catch (error) {
      console.error("[v0] Error clearing cart:", error)
      return { success: false, message: "Error clearing cart" }
    }
  },

  // Get cart count
  getCartCount() {
    return this.getCart().length
  },

  // Update cart badge
  updateCartBadge() {
    const cart = this.getCart()
    const badges = document.querySelectorAll(".cart-badge")
    const count = cart.length

    badges.forEach((badge) => {
      if (count > 0) {
        badge.textContent = count
        badge.style.display = "flex"
      } else {
        badge.style.display = "none"
      }
    })
  },
}

// Initialize cart badge on page load
document.addEventListener("DOMContentLoaded", () => {
  if (window.cartManager) {
    window.cartManager.updateCartBadge()
  }
})
