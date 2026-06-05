const API_URL = "https://paypal.variants.ecomsandbox.softpages.in/api"
const BASE_URL = "https://paypal.variants.ecomsandbox.softpages.in/"

class AuthManager {
  constructor() {
    this.authToken = localStorage.getItem("authToken")
    this.refreshToken = localStorage.getItem("refreshToken")
  }
  isAuthenticated() {
    return !!this.authToken
  }

  setTokens(authToken, refreshToken = null) {
    this.authToken = authToken
    if (refreshToken) {
      this.refreshToken = refreshToken
      localStorage.setItem("refreshToken", refreshToken)
    }
    localStorage.setItem("authToken", authToken)
  }

  clearTokens() {
    this.authToken = null
    this.refreshToken = null
    localStorage.removeItem("authToken")
    localStorage.removeItem("refreshToken")
  }

  getAuthHeaders() {
    return this.authToken ? { Authorization: `Bearer ${this.authToken}` } : {}
  }

  async refreshAuthToken() {
    if (!this.refreshToken) {
      throw new Error("No refresh token available")
    }

    try {
      const response = await fetch(`${API_URL}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: this.refreshToken }),
      })

      if (!response.ok) {
        throw new Error("Failed to refresh token")
      }

      const data = await response.json()
      this.setTokens(data.authToken, data.refreshToken)
      return data.authToken
    } catch (error) {
      this.clearTokens()
      throw error
    }
  }
}

const authManager = new AuthManager()

async function apiRequest(url, options = {}) {
  const config = {
    headers: {
      "Content-Type": "application/json",
      ...authManager.getAuthHeaders(),
      ...options.headers,
    },
    ...options,
  }

  try {
    let response = await fetch(url, config)

    if (response.status === 401 && authManager.refreshToken) {
      try {
        await authManager.refreshAuthToken()
        config.headers = {
          ...config.headers,
          ...authManager.getAuthHeaders(),
        }
        response = await fetch(url, config)
      } catch (refreshError) {
        console.error("Token refresh failed:", refreshError)
        throw new Error("Authentication required")
      }
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`)
    }

    return response
  } catch (error) {
    console.error("API Request failed:", error)
    throw error
  }
}

const api = {
  authenticate: async (credentials) => {
    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: credentials.email || "admin@paypalecom.com",
          password: credentials.password || "Temp@123",
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || "Authentication failed")
      }

      const data = await response.json()
      authManager.setTokens(data.authToken, data.refreshToken)

      return data
    } catch (error) {
      console.error("Authentication error:", error)
      throw error
    }
  },

  register: async (userData) => {
    const response = await apiRequest(`${API_URL}/users/register`, {
      method: "POST",
      body: JSON.stringify(userData),
    })
    return response.json()
  },

  signup: async (userData) => {
    try {
      const response = await fetch(`${API_URL}/users/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(userData),
      })

      if (response.status === 400) {
        const error = await response.json()
        if (error.message && error.message.includes("duplicate key error collection")) {
          return
        }
        return
      }

      if (response.status === 200 || response.status === 201) {
        return response.json()
      }

      if (response.status === 500) {
        return
      }
    } catch (error) {
      console.error("Signup error:", error)
    }
  },

  login: async (credentials) => {
    try {
      const response = await fetch(`${API_URL}/users/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials),
      })

      if (response.status === 400) {
        const error = await response.json()
        if (error.message === "Please verify your email first") {
          return
        }
        return
      }

      if (response.status === 200) {
        const data = await response.json()
        authManager.setTokens(data.authToken, data.refreshToken)
        return data
      }

      return response.json()
    } catch (error) {
      console.error("Login error:", error)
    }
  },

  logout: async () => {
    try {
      if (authManager.authToken) {
        await apiRequest(`${API_URL}/auth/logout`, {
          method: "POST",
        })
      }
    } catch (error) {
      console.error("Logout error:", error)
    } finally {
      authManager.clearTokens()
    }
  },

  getProducts: async (filters = {}) => {
    try {
      const queryParams = new URLSearchParams()
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, value)
        }
      })

      const response = await apiRequest(`${API_URL}/products?${queryParams}`)
      return await response.json()
    } catch (error) {
      console.error("Error fetching products:", error)
      return []
    }
  },

  getProductDetails: async (id) => {
    const response = await apiRequest(`${API_URL}/products/${id}`)
    return response.json()
  },

  getBooks: async (params = {}) => {
    try {
      console.log("[v0] Making API call to getBooks with params:", params)
      const query = new URLSearchParams(params).toString()
      const url = `${API_URL}/books?${query}`
      console.log("[v0] API URL:", url)

      const response = await apiRequest(url)
      console.log("[v0] API response status:", response.status)

      const data = await response.json()
      console.log("[v0] API response data:", data)

      return Array.isArray(data) ? data : data.books || []
    } catch (error) {
      console.error("[v0] Error fetching books:", error)
      return []
    }
  },

  getBookDetails: async (id) => {
    const response = await apiRequest(`${API_URL}/books/${id}`)
    return response.json()
  },

  getCategoryImage: async (cat) => {
    const response = await apiRequest(`${API_URL}/books/category-image/${cat}`)
    return response.json()
  },

  getMostViewed: async (limit = 4) => {
    const response = await apiRequest(`${API_URL}/books/most-viewed?limit=${limit}`)
    return response.json()
  },

  getBestsellers: async (limit = 4) => {
    const response = await apiRequest(`${API_URL}/books/bestsellers?limit=${limit}`)
    return response.json()
  },

  getCart: async () => {
    const response = await apiRequest(`${API_URL}/users/cart`)
    return response.json()
  },
  addToCart: async (productId, quantity = 1) => {
    try {
      const response = await apiRequest(`${API_URL}/users/cart`, {
        method: "POST",
        body: JSON.stringify({ bookId: productId, quantity }),
      })
      return response.json()
    } catch (error) {
      console.error("[v0] Error adding to cart:", error)
      throw error
    }
  },

  updateCartItem: async (itemId, quantity) => {
    // Fix: send numeric quantity directly
    try {
      const response = await apiRequest(`${API_URL}/users/cart/${itemId}`, {
        method: "PATCH",
        body: JSON.stringify({ quantity }), // was quantity.quantity
      })
      return response.json()
    } catch (error) {
      console.error("[v0] Error updating cart item:", error)
      throw error
    }
  },

  async removeFromCart(itemId) {
    const response = await apiRequest(`${API_URL}/users/cart/${itemId}`, {
      method: "DELETE",
    })
    location.reload(true)

    return response.json()
  },

  createOrder: async (orderData) => {
    const response = await apiRequest(`${API_URL}/orders/create-cod-order`, {
      method: "POST",
      body: JSON.stringify(orderData),
    })
    return response
  },

  getOrders: async () => {
    const response = await apiRequest(`${API_URL}/orders`)
    return response.json()
  },

  async getOrder(orderId) {
    const response = await apiRequest(`${API_URL}/orders/${orderId}`)
    return response.json()
  },

  async calculateOrderTotals(data) {
    try {
      const response = await apiRequest(`${API_URL}/orders/calculate`, {
        method: "POST",
        body: JSON.stringify(data),
      })
      return response.json()
    } catch (error) {
      console.error("Error calculating order totals:", error)
      throw error
    }
  },

  async validateVoucher(code, cartData) {
    try {
      if (!code || !cartData) {
        throw new Error("Invalid voucher data")
      }

      const response = await apiRequest(`${API_URL}/vouchers/${code}/validate`, {
        method: "POST",
        body: JSON.stringify({
          items: cartData.items?.map((item) => ({
            book: item.book._id,
            quantity: item.quantity,
          })),
          subtotal: cartData.subtotal,
        }),
      })

      return response.json()
    } catch (error) {
      console.error("Error validating voucher:", error)
      throw error
    }
  },

  async getAvailableVouchers() {
    try {
      const response = await apiRequest(`${API_URL}/vouchers/available`)
      return response.json()
    } catch (error) {
      console.error("Error fetching vouchers:", error)
      return []
    }
  },

  getProfile: async () => {
    if (!authManager.authToken) {
      console.log("No token found, redirecting to login")
      return
    }
    const response = await apiRequest(`${API_URL}/users/profile`)
    return response.json()
  },

  updateProfile: async (userData) => {
    const response = await apiRequest(`${API_URL}/users/profile`, {
      method: "PATCH",
      body: JSON.stringify(userData),
    })
    return response.json()
  },

  updatePassword: async (passwords) => {
    const response = await apiRequest(`${API_URL}/users/password`, {
      method: "POST",
      body: JSON.stringify(passwords),
    })
    return response.json()
  },

  forgotPassword: async (email) => {
    const response = await fetch(`${API_URL}/auth/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || "Failed to send reset link")
    }

    return response.json()
  },

  resetPassword: async (authToken, password) => {
    const response = await fetch(`${API_URL}/auth/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ authToken, password }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || "Failed to reset password")
    }

    return response.json()
  },

  async updateEmailPreferences(preferences) {
    try {
      const response = await apiRequest(`${API_URL}/users/preferences`, {
        method: "PATCH",
        body: JSON.stringify(preferences),
      })
      return response.json()
    } catch (error) {
      console.error("Error updating preferences:", error)
      throw error
    }
  },

  getAddresses: async () => {
    try {
      const response = await apiRequest(`${API_URL}/users/addresses`)
      return response.json()
    } catch (error) {
      console.error("Error fetching addresses:", error)
      return []
    }
  },

  addAddress: async (addressData) => {
    try {
      const response = await apiRequest(`${API_URL}/users/addresses`, {
        method: "POST",
        body: JSON.stringify(addressData),
      })
      return response.json()
    } catch (error) {
      console.error("Error adding address:", error)
    }
  },

  updateAddress: async (addressId, addressData) => {
    try {
      const response = await apiRequest(`${API_URL}/users/addresses/${addressId}`, {
        method: "PATCH",
        body: JSON.stringify(addressData),
      })
      return response.json()
    } catch (error) {
      console.error("Error updating address:", error)
    }
  },

  setDefaultAddress: async (addressId) => {
    try {
      const response = await apiRequest(`${API_URL}/users/addresses/${addressId}/default`, {
        method: "POST",
      })
      return response.json()
    } catch (error) {
      console.error("Error setting default address:", error)
    }
  },

  getFavorites: async () => {
    const response = await apiRequest(`${API_URL}/users/favorites`)
    return response.json()
  },

  toggleFavorite: async (bookId) => {
    const response = await apiRequest(`${API_URL}/users/favorites/${bookId}`, {
      method: "POST",
    })
    return response.json()
  },

  getMarketingAssets: async (type) => {
    try {
      const url = `${API_URL}/marketing${type ? "/active/" + type : ""}`
      const response = await apiRequest(url)
      const data = await response.json()
      return Array.isArray(data) ? data : [data]
    } catch (error) {
      console.error("Error fetching marketing assets:", error)
      return []
    }
  },

  getCategories: async () => {
    try {
      const response = await apiRequest(`${API_URL}/books/categories`)
      const data = await response.json()
      return data
    } catch (error) {
      console.error("Error:", error)
      throw error
    }
  },

  getCategoryBooks: async (categoryId) => {
    const response = await apiRequest(`${API_URL}/books/categories/${categoryId}/books`)
    return response.json()
  },

  getBookById: async (id) => {
    const response = await apiRequest(`${API_URL}/books/${id}`)
    return response.json()
  },

  async getRelatedProducts(category, currentProductId) {
    try {
      console.log("Fetching related products for category:", category, currentProductId)
      console.log("API URL:", `${API_URL}/books?category=${category}&exclude=${currentProductId}&limit=4`)
      const response = await apiRequest(`${API_URL}/books?category=${category}&exclude=${currentProductId}&limit=4`)
      return await response.json()
    } catch (error) {
      console.error("Error fetching related products:", error)
      return []
    }
  },

  async getProductVouchers(productId) {
    try {
      const response = await apiRequest(`${API_URL}/vouchers/product/${productId}`)
      return await response.json()
    } catch (error) {
      console.error("Error fetching vouchers:", error)
      return []
    }
  },

  async getCharges() {
    try {
      const response = await apiRequest(`${API_URL}/charges`)
      return response.json()
    } catch (error) {
      console.error("Error fetching charges:", error)
      throw error
    }
  },

  async getStoreConfig(category = null) {
    try {
      const url = category ? `${API_URL}/shop-details/cat/${category}` : `${API_URL}/store-config`

      const response = await apiRequest(url)
      const data = await response.json()
      return data.details || data
    } catch (error) {
      console.error("Error fetching store config:", error)
      throw error
    }
  },

  async getAdminOrders(status = "") {
    const response = await apiRequest(`${API_URL}/admin/orders${status ? `?status=${status}` : ""}`)
    return response.json()
  },

  async updateOrderStatus(orderId, status) {
    const response = await apiRequest(`${API_URL}/admin/orders/${orderId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    })
    return response.json()
  },

  async verifyEmail(authToken) {
    const response = await fetch(`${API_URL}/users/auth/verify-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ authToken }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || "Failed to verify email")
    }

    return response.json()
  },

  async getDeliveryOptions() {
    try {
      const response = await apiRequest(`${API_URL}/shop-details/cat/DELIVERY`)
      const data = await response.json()

      if (Array.isArray(data)) return data
      if (data.details && Array.isArray(data.details)) return data.details
      if (data.data && Array.isArray(data.data)) return data.data

      return []
    } catch (error) {
      console.error("[v0] Error fetching delivery options:", error)
      return [
        { id: "standard", name: "Standard Delivery", description: "5-7 business days", charges: 50 },
        { id: "express", name: "Express Delivery", description: "2-3 business days", charges: 100 },
      ]
    }
  },

  async getPaymentOptions() {
    try {
      const response = await apiRequest(`${API_URL}/shop-details/cat/PAYMENTTYPE`)
      const data = await response.json()

      if (Array.isArray(data)) return data
      if (data.details && Array.isArray(data.details)) return data.details
      if (data.data && Array.isArray(data.data)) return data.data

      return []
    } catch (error) {
      console.error("[v0] Error fetching payment options:", error)
      return [
        { id: "cod", name: "COD", description: "Cash on Delivery", charges: 0 },
        { id: "paypal", name: "PayPal", description: "Pay securely with PayPal", charges: 10 },
      ]
    }
  },

  async getFinalCharges() {
    try {
      const response = await apiRequest(`${API_URL}/shop-details/cat/FINALCHARGES`)
      const data = await response.json()
      if (Array.isArray(data)) return data
      if (data.details && Array.isArray(data.details)) return data.details
      if (data.data && Array.isArray(data.data)) return data.data
      return []
    } catch (error) {
      console.error("[v0] Error fetching final charges:", error)
      return []
    }
  },

  async deleteAddress(addressId) {
    try {
      const response = await apiRequest(`${API_URL}/users/addresses/${addressId}`, {
        method: "DELETE",
      })
      return response.json()
    } catch (error) {
      console.error("Error deleting address:", error)
      throw error
    }
  },

  async getProductVariants(productId) {
    try {
      const response = await apiRequest(`${API_URL}/books/${productId}/variants`)
      const data = await response.json()
      return Array.isArray(data) ? data : data.variants || []
    } catch (error) {
      console.error("[v0] Error fetching variants:", error)
      return []
    }
  },
}

document.addEventListener("DOMContentLoaded", async () => {
  console.log("[v0] Testing API connection...")

  try {
    const response = await fetch(`${API_URL}/health`)
    const data = await response.json()
    console.log("[v0] API connection test successful:", data)
  } catch (error) {
    console.error("[v0] API connection test failed:", error)
  }

  if (!authManager.authToken) {
    try {
      await api.authenticate({
        email: "admin@paypalecom.com",
        password: "Temp@123",
      })
      console.log("Auto-authenticated with PayPal sandbox")
    } catch (error) {
      console.error("Auto-authentication failed:", error)
    }
  }
})
