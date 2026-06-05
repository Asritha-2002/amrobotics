async function addToCart(productId, quantity = 1) {
  try {
    console.log("[v0] Adding to cart:", { productId, quantity })
    
    // Show loading state
    const button = document.querySelector(`[data-product-id="${productId}"]`)
    if (button) {
      button.disabled = true
      button.innerHTML = 'Adding...'
    }

    // Call API to add item
    const response = await api.addToCart(productId, quantity)
    console.log("[v0] Add to cart response:", response)

    // Update cart badge
    if (window.CartSystem) {
      await window.CartSystem.updateCartBadge()
    }

    // Show success message
    showToast("Product added to cart successfully", "success")

  } catch (error) {
    console.error("[v0] Error adding to cart:", error)
    showToast("Failed to add product to cart", "error")
  } finally {
    // Reset button state
    if (button) {
      button.disabled = false 
      button.innerHTML = 'Add to Cart'
    }
  }
}

// Modify the product slider HTML generation:
async function loadProducts() {
  try {
    const response = await api.getBooks() // Use existing API method
    const products = response.books || []

    const sliderWrapper = document.querySelector('#serviceSlider3 .swiper-wrapper')
    sliderWrapper.innerHTML = ""

    products.forEach(product => {
      const slide = document.createElement("div")
      slide.classList.add("swiper-slide")
      slide.innerHTML = `
        <div class="service-card3" data-mask-src="assets/img/shape/service-card3-shape.png">
          <div class="service-card-bg-shape">
            <img src="assets/img/shape/service-card3-thumb-shape2.png" alt="img">
          </div>
          <div class="box-thumb" data-mask-src="assets/img/shape/service-card3-thumb-shape.png">
            <img src="${product.images?.[0]?.url || 'assets/img/service/default.webp'}" alt="Icon">
          </div>
          <div class="box-content">
            <h3 class="box-title">
              <a href="shop-details.html?id=${product._id}">${product.title || 'No Title Available'}</a>
            </h3>
            <a href="shop-details.html?id=${product._id}">
              <h5 class="product-price"><strong>Price: ₹${product.price || 'N/A'}</strong></h5>
            </a>
            <p class="box-text">${product.description?.substring(0, 80) || ''}</p>
            <br>
            <div>
              <button 
                class="th-btn"
                onclick="handleAddToCart('${product._id}')"
                data-product-id="${product._id}"
              >
                Add to Cart
              </button>
            </div>
          </div>
        </div>
      `
      sliderWrapper.appendChild(slide)
    })

    // Reinitialize swiper
    if (typeof Swiper !== "undefined") {
      new Swiper("#serviceSlider3", JSON.parse(document.getElementById("serviceSlider3").dataset.sliderOptions))
    }

  } catch (error) {
    console.error("[v0] Error loading products:", error)
    showToast("Error loading products", "error")
  }
}

// Use existing cart functionality 
async function handleAddToCart(productId) {
  try {
    console.log("[v0] Adding to cart:", productId)
    
    // Show loading state
    const button = document.querySelector(`[data-product-id="${productId}"]`)
    if (button) {
      button.disabled = true
      button.innerHTML = 'Adding...'
    }

    // Use existing addToCart method from CartSystem or API
    if (window.CartSystem && typeof window.CartSystem.addToCart === "function") {
      await window.CartSystem.addToCart(productId, 1)
    } else {
      await api.addToCart(productId, 1)
    }

    // Update cart badge
    if (window.CartSystem) {
      await window.CartSystem.updateCartBadge()
    }

    showToast("Product added to cart successfully", "success")

  } catch (error) {
    console.error("[v0] Error adding to cart:", error)
    showToast("Failed to add product to cart", "error")
  } finally {
    // Reset button state
    const button = document.querySelector(`[data-product-id="${productId}"]`)
    if (button) {
      button.disabled = false
      button.innerHTML = 'Add to Cart'
    }
  }
}

// Load when DOM is ready
document.addEventListener("DOMContentLoaded", loadProducts)