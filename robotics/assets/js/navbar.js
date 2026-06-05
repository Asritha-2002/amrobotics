document.addEventListener("DOMContentLoaded", () => {
  updateNavbarAuth()
  if (window.cartManager) {
    window.cartManager.updateCartBadge()
  }
  initializeMobileMenu()
})

function updateNavbarAuth() {
  const authToken = localStorage.getItem("authToken")
  const userData = localStorage.getItem("userData")

  if (authToken) {
    if (userData) {
      try {
        const user = JSON.parse(userData)
        console.log("[v0] User authenticated:", user.email || user.name || "User")
      } catch (e) {
        console.log("[v0] User authenticated with token (userData parse failed)")
      }
    } else {
      console.log("[v0] User has auth token but no user data")
    }
  } else {
    console.log("[v0] User not authenticated")
  }
}

function initializeMobileMenu() {
  const menuToggleButtons = document.querySelectorAll(".th-menu-toggle")
  const menuWrapper = document.querySelector(".th-menu-wrapper")
  const mobileMenuItems = document.querySelectorAll(".th-mobile-menu a")

  if (!menuWrapper || menuToggleButtons.length === 0) {
    console.warn("[v0] Mobile menu elements not found")
    return
  }

  // Toggle menu open/close
  menuToggleButtons.forEach((button) => {
    button.addEventListener("click", (e) => {
      e.preventDefault()
      e.stopPropagation()
      menuWrapper.classList.toggle("active")
      document.body.style.overflow = menuWrapper.classList.contains("active") ? "hidden" : ""
      console.log("[v0] Menu toggled, active:", menuWrapper.classList.contains("active"))
    })
  })

  // Close menu when clicking outside
  document.addEventListener("click", (e) => {
    if (menuWrapper && !menuWrapper.contains(e.target)) {
      const isMenuToggle = Array.from(menuToggleButtons).some((btn) => btn.contains(e.target))
      if (!isMenuToggle) {
        menuWrapper.classList.remove("active")
        document.body.style.overflow = ""
      }
    }
  })

  // Close menu when clicking a regular menu item
  mobileMenuItems.forEach((link) => {
    link.addEventListener("click", (e) => {
      if (!link.parentElement.classList.contains("menu-item-has-children")) {
        menuWrapper.classList.remove("active")
        document.body.style.overflow = ""
      }
    })
  })

  // Handle submenu expansion
  const submenuToggles = document.querySelectorAll(".th-mobile-menu .menu-item-has-children > a")
  submenuToggles.forEach((toggle) => {
    toggle.addEventListener("click", (e) => {
      e.preventDefault()
      e.stopPropagation()
      const parent = toggle.closest(".menu-item-has-children")
      const submenu = parent.querySelector(".sub-menu")

      if (submenu) {
        parent.classList.toggle("active")
        console.log("[v0] Submenu toggled for:", toggle.textContent)
      }
    })
  })

  console.log("[v0] Mobile menu initialized successfully")
}

// Listen for storage changes to update cart badge in real-time
window.addEventListener("storage", () => {
  if (window.cartManager) {
    window.cartManager.updateCartBadge()
  }
})
