window.CartSystem = {
  // Get cart from API (requires auth)
  async getCart() {
    try {
      const token = localStorage.getItem("authToken")
      const user = localStorage.getItem("user")

      if (!token || !user) {
        console.log("[v0] No auth token, returning empty cart")
        return []
      }

      const response = await fetch(`https://paypal.variants.ecomsandbox.softpages.in/api/users/cart`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        const cart = data?.items || (Array.isArray(data) ? data : [])
        console.log("[v0] Cart loaded from API:", cart)
        return cart
      }
      return []
    } catch (error) {
      console.error("[v0] Error fetching cart from API:", error)
      return []
    }
  },

  // Add to cart via API (fixed)
  async addToCart(productId, productName, productPrice, quantity = 1, variantId = null) {
    try {
      const token = localStorage.getItem("authToken")
      const user = localStorage.getItem("user")

      if (!token || !user) {
        this.showToast("Please login to add items to cart", "error")
        return { success: false, message: "Not authenticated" }
      }

      console.log("[v0] Adding to cart:", { productId, quantity })

      const response = await fetch(`https://paypal.variants.ecomsandbox.softpages.in/api/users/cart`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          bookId: productId,
          quantity,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        this.showToast(`${productName} added to cart!`)
        await this.updateCartBadge()
        console.log("[v0] Added to cart:", data)
        return { success: true, message: "Added to cart" }
      } else {
        console.error("[v0] API error:", data)
        this.showToast(data.message || "Failed to add to cart", "error")
        return { success: false, message: data.message || "Failed" }
      }
    } catch (error) {
      console.error("[v0] Error adding to cart:", error)
      this.showToast("Error adding to cart", "error")
      return { success: false, message: "Error" }
    }
  },

  // Remove from cart via API
  async removeFromCart(itemId) {
    try {
      const token = localStorage.getItem("authToken")
      const user = localStorage.getItem("user")

      if (!token || !user) return { success: false }

      const response = await fetch(`https://paypal.variants.ecomsandbox.softpages.in/api/users/cart/${itemId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (response.ok) {
        console.log("[v0] Removed from cart:", itemId)
        await this.updateCartBadge()
        return { success: true }
      }
      return { success: false }
    } catch (error) {
      console.error("[v0] Error removing from cart:", error)
      return { success: false }
    }
  },

  // Update quantity via API
  async updateQuantity(itemId, quantity) {
    try {
      const token = localStorage.getItem("authToken")
      const user = localStorage.getItem("user")

      if (!token || !user) return { success: false }

      const response = await fetch(`https://paypal.variants.ecomsandbox.softpages.in/api/users/cart/${itemId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ quantity }),
      })

      if (response.ok) {
        console.log("[v0] Updated quantity for item:", itemId)
        await this.updateCartBadge()
        return { success: true }
      }
      return { success: false }
    } catch (error) {
      console.error("[v0] Error updating quantity:", error)
      return { success: false }
    }
  },

  // Clear cart via API
  async clearCart() {
    try {
      const token = localStorage.getItem("authToken")
      const user = localStorage.getItem("user")

      if (!token || !user) return { success: false }

      const cart = await this.getCart()

      for (const item of cart) {
        await this.removeFromCart(item.id || item._id)
      }

      console.log("[v0] Cart cleared")
      return { success: true }
    } catch (error) {
      console.error("[v0] Error clearing cart:", error)
      return { success: false }
    }
  },

  async getCartCount() {
    try {
      const cart = await this.getCart()
      const count = Array.isArray(cart)
        ? cart.reduce((sum, item) => {
            const qty = item.quantity || item.qty || 1
            return sum + (typeof qty === "number" ? qty : Number.parseInt(qty) || 1)
          }, 0)
        : 0
      console.log("[v0] Cart count calculated:", count)
      return count
    } catch (error) {
      console.error("[v0] Error getting cart count:", error)
      return 0
    }
  },

  async updateCartBadge() {
    try {
      const count = await this.getCartCount()
      const badges = document.querySelectorAll(".cart-badge, [class*='badge']")

      badges.forEach((badge) => {
        if (badge.classList.contains("cart-badge") || badge.getAttribute("data-badge-type") === "cart") {
          if (count > 0) {
            badge.textContent = count > 99 ? "99+" : count.toString()
            badge.style.display = "flex"
          } else {
            badge.style.display = "none"
          }
        }
      })

      // Also update span badges in header
      const cartBadges = document.querySelectorAll("a[href='cart.html'] .badge, a[href*='cart'] .badge")
      cartBadges.forEach((badge) => {
        if (count > 0) {
          badge.textContent = count > 99 ? "99+" : count.toString()
          badge.style.display = "flex"
        } else {
          badge.style.display = "none"
        }
      })

      console.log("[v0] Cart badge updated to:", count)
    } catch (e) {
      console.error("[v0] Error updating cart badge:", e)
    }
  },

  showToast(message, type = "success") {
    const toast = document.createElement("div")
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${type === "success" ? "#4CAF50" : "#f44336"};
      color: white;
      padding: 15px 25px;
      border-radius: 5px;
      z-index: 9999;
      font-weight: 500;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    `
    toast.textContent = message
    document.body.appendChild(toast)

    setTimeout(() => {
      toast.style.transition = "opacity 0.3s ease"
      toast.style.opacity = "0"
      setTimeout(() => toast.remove(), 300)
    }, 3000)
  },
}

document.addEventListener("DOMContentLoaded", async () => {
  if (window.CartSystem) {
    await window.CartSystem.updateCartBadge()
    console.log("[v0] CartSystem initialized on page load")
  }
})
