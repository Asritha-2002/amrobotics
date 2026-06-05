let allProducts = []
let filteredProducts = []

// Fetch products from real API
async function fetchProductsFromAPI() {
  try {
    console.log("[v0] Fetching products from API...")
    const response = await fetch("https://paypal.variants.ecomsandbox.softpages.in/api/books")

    if (!response.ok) {
      console.error("[v0] API response not ok:", response.status)
      return []
    }

    const data = await response.json()
    console.log("[v0] Raw API response:", data)

    const products = Array.isArray(data.books) ? data.books : Array.isArray(data) ? data : []
    console.log("[v0] Parsed products:", products.length, "items")
    return products
  } catch (error) {
    console.error("[v0] Error fetching products:", error)
    return []
  }
}

// Fetch categories from API
async function fetchCategoriesFromAPI() {
  try {
    const response = await fetch("https://paypal.variants.ecomsandbox.softpages.in/api/books/categories")

    if (!response.ok) {
      console.error("[v0] Categories API response not ok:", response.status)
      return []
    }

    const data = await response.json()
    return Array.isArray(data.categories) ? data.categories : Array.isArray(data) ? data : []
  } catch (error) {
    console.error("[v0] Error fetching categories:", error)
    return []
  }
}

// Render product grid
async function renderProducts(productsToShow) {
  const container = document.querySelector(".row.gy-40")
  if (!container) {
    console.error("[v0] Product container not found")
    return
  }

  const products = productsToShow || allProducts

  if (!products || products.length === 0) {
    container.innerHTML = '<p class="text-center w-100">No products found</p>'
    return
  }

  container.innerHTML = products
    .map((product) => {
      const imageUrl = product.images && product.images[0] ? product.images[0].url : "assets/img/product/default.png"
      const price = Number.parseFloat(product.price) || 0

      return `
      <div class="col-sm-6">
        <div class="th-product product-grid">
          <div class="product-img">
            <img src="${imageUrl}" alt="${product.title}" onerror="this.src='assets/img/product/default.png'">
            <div class="actions">
              <a href="shop-details.html?id=${product._id}" class="icon-btn" title="View Details">
                <i class="far fa-eye"></i>
              </a>
              <a href="#" class="icon-btn add-to-cart-btn" data-product-id="${product._id}" data-product-name="${product.title}" data-product-price="${price}" title="Add to Cart">
                <i class="far fa-cart-plus"></i>
              </a>
            </div>
          </div>
          <div class="product-content">
            <h3 class="product-title">
              <a href="shop-details.html?id=${product._id}">${product.title}</a>
            </h3>
            <span class="price">$${price.toFixed(2)}</span>
          </div>
        </div>
      </div>
    `
    })
    .join("")

  attachAddToCartListeners()
}

// Render categories
async function renderCategories() {
  const container = document.querySelector(".widget_categories ul")
  if (!container) return

  const categories = await fetchCategoriesFromAPI()

  if (!categories || categories.length === 0) {
    container.innerHTML = "<li><p>No categories</p></li>"
    return
  }

  container.innerHTML = categories
    .map(
      (category) => `
    <li>
      <a href="#" onclick="filterByCategory('${category}', event)">
        <i class="fas fa-circle"></i>${category}
      </a>
    </li>
  `,
    )
    .join("")
}

// Filter by category
function filterByCategory(category, event) {
  event.preventDefault()
  console.log("[v0] Filtering by category:", category)
  filteredProducts = allProducts.filter((p) => p.category === category)
  renderProducts(filteredProducts)
}

// Search products
function searchProducts(query) {
  if (!query.trim()) {
    renderProducts(allProducts)
    return
  }

  const q = query.toLowerCase()
  filteredProducts = allProducts.filter(
    (p) => (p.title && p.title.toLowerCase().includes(q)) || (p.description && p.description.toLowerCase().includes(q)),
  )
  console.log("[v0] Search results:", filteredProducts.length)
  renderProducts(filteredProducts)
}

// Sort products
function sortProducts(sortBy) {
  let sorted = filteredProducts.length > 0 ? [...filteredProducts] : [...allProducts]

  switch (sortBy) {
    case "price":
      sorted.sort((a, b) => (a.price || 0) - (b.price || 0))
      break
    case "price-desc":
      sorted.sort((a, b) => (b.price || 0) - (a.price || 0))
      break
    case "date":
      sorted.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      break
    default:
      sorted = filteredProducts.length > 0 ? filteredProducts : allProducts
  }

  renderProducts(sorted)
}

// Attach add to cart listeners
function attachAddToCartListeners() {
  document.querySelectorAll(".add-to-cart-btn").forEach((btn) => {
    btn.removeEventListener("click", handleAddToCart)
    btn.addEventListener("click", handleAddToCart)
  })
}

function handleAddToCart(e) {
  e.preventDefault()
  const productId = this.dataset.productId
  const productName = this.dataset.productName
  const productPrice = this.dataset.productPrice

  console.log("[v0] Add to cart clicked:", { productId, productName, productPrice })

  if (window.CartSystem) {
    const result = window.CartSystem.addToCart(productId, productName, productPrice, 1)
    console.log("[v0] Add to cart result:", result)
  } else {
    console.error("[v0] CartSystem not available")
    alert("Cart system not initialized")
  }
}

function calculateAndSetMaxPrice() {
  if (allProducts && allProducts.length > 0) {
    const prices = allProducts.map((p) => Number.parseFloat(p.price) || 0).filter((price) => price > 0)

    if (prices.length > 0) {
      const maxPrice = Math.max(...prices)
      // Round up to nearest 10
      const roundedMaxPrice = Math.ceil(maxPrice / 10) * 10
      const priceToElement = document.querySelector(".price_label .to")
      if (priceToElement) {
        priceToElement.textContent = "$" + roundedMaxPrice
      }
      console.log("[v0] Max price calculated:", roundedMaxPrice)
      return roundedMaxPrice
    }
  }
  return 1000
}

function filterByPriceRange() {
  const priceFromText = document.querySelector(".price_label .from").textContent.replace("$", "")
  const priceToText = document.querySelector(".price_label .to").textContent.replace("$", "")

  const minPrice = Number.parseFloat(priceFromText) || 0
  const maxPrice = Number.parseFloat(priceToText) || 10000000

  console.log("[v0] Filtering by price range:", minPrice, "-", maxPrice)

  filteredProducts = allProducts.filter((p) => {
    const price = Number.parseFloat(p.price) || 0
    return price >= minPrice && price <= maxPrice
  })

  console.log("[v0] Products after price filter:", filteredProducts.length)
  renderProducts(filteredProducts)
}

// Initialize page
document.addEventListener("DOMContentLoaded", async () => {
  console.log("[v0] Shop page initializing...")

  if (typeof window.CartSystem === "undefined") {
    console.warn("[v0] CartSystem not yet available, waiting...")
    let retries = 0
    while (typeof window.CartSystem === "undefined" && retries < 10) {
      await new Promise((resolve) => setTimeout(resolve, 100))
      retries++
    }
    console.log("[v0] CartSystem available after", retries, "retries")
  }

  allProducts = await fetchProductsFromAPI()
  filteredProducts = allProducts

  calculateAndSetMaxPrice()

  await renderProducts(allProducts)
  await renderCategories()

  if (window.CartSystem) {
    window.CartSystem.updateCartBadge()
  }

  // Search functionality
  const searchInput = document.querySelector('input[placeholder="Search Products..."]')
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      searchProducts(e.target.value)
    })
  }

  // Sort functionality
  const sortSelect = document.querySelector(".orderby")
  if (sortSelect) {
    sortSelect.addEventListener("change", (e) => {
      sortProducts(e.target.value)
    })
  }

  const priceFilterBtn = document.getElementById("priceFilterBtn")
  if (priceFilterBtn) {
    priceFilterBtn.addEventListener("click", (e) => {
      e.preventDefault()
      filterByPriceRange()
    })
  }
})
