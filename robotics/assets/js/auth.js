// Shared authentication utilities
const Auth = {
  getToken() {
    return localStorage.getItem("authToken")
  },

  getUser() {
    const user = localStorage.getItem("user")
    return user ? JSON.parse(user) : null
  },

  isAuthenticated() {
    return !!this.getToken()
  },

  logout(originalLogout) {
    // Clear cart from localStorage when logging out
    localStorage.removeItem("cart")
    if (window.CartSystem) {
      window.CartSystem.clearCart()
    }
    // Call original logout
    originalLogout.call(this)
  },

  setToken(token) {
    localStorage.setItem("authToken", token)
  },

  setUser(user) {
    localStorage.setItem("user", JSON.stringify(user))
  },
}

// Update navbar on all pages


// Call on page load
document.addEventListener("DOMContentLoaded", updateNavbar)
