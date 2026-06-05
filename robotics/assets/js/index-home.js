const AM_ProductLoader = {
    config: {
        containerId: "product-cards-grid",
        apiUrl: "https://paypal.variants.ecomsandbox.softpages.in/api/books",
        defaultImage: "assets/img/service/default.webp"
    },

    init() {
        this.loadProducts();
    },

    async loadProducts() {
        const container = document.getElementById(this.config.containerId);
        container.innerHTML = "<p>Loading products...</p>";

        try {
            const response = await fetch(this.config.apiUrl);
            const data = await response.json();
            const products = Array.isArray(data) ? data : data.books || [];

            if (!products.length) {
                container.innerHTML = "<p>No products available.</p>";
                return;
            }

            this.render(products);
            this.applyResponsiveLimit();
        } catch (err) {
            container.innerHTML = `<p>Error loading products.</p>`;
        }
    },

render(products) {
    const container = document.getElementById(this.config.containerId);
    container.innerHTML = "";

    // Show only 6 products on home
    const itemsToShow = products.slice(0, 6);

    itemsToShow.forEach((p, index) => {
        const id = p._id || p.id || index;
        const title = p.title || "Unnamed Product";
        const price = Number(p.price || 0);
        const oldPrice = Number(p.originalPrice || price * 1.2);
        const img =
            p.images?.[0]?.url ||
            p.images?.[0] ||
            this.config.defaultImage;

        const cardHTML = `
        <div class="product-card-ref"
             onclick="location.href='shop-details.html?id=${id}'">

            <div class="product-image-wrap">

                <span class="view-icon"
                    onclick="event.stopPropagation();
                    location.href='shop-details.html?id=${id}'">
                    👁
                </span>

                <img src="${img}" alt="${title}"
                     onerror="this.src='${this.config.defaultImage}'">
            </div>

            <div class="product-info">
                <h4 class="product-title">${title}</h4>

                <div class="price-row">
                    <span class="old-price">₹${oldPrice.toFixed(2)}</span>
                    <span class="new-price">₹${price.toFixed(2)}</span>
                </div>

                <button class="add-cart-btn"
                    onclick="event.stopPropagation();
                    AM_ProductLoader.addToCart('${id}','${title}',${price})">
                    Add to Cart
                </button>
            </div>
        </div>
        `;

        container.insertAdjacentHTML("beforeend", cardHTML);
    });
}



,

    applyResponsiveLimit() {
    const isMobile = window.innerWidth <= 576;
    const showMoreBtn = document.querySelector(".show-more-btn");

    // ✔ Desktop/tablet → only redirect
    if (!isMobile) {
        showMoreBtn.onclick = () => window.location.href = "shop.html";
        return;
    }

    // ✔ Mobile → show 6 products (nothing hidden)
    showMoreBtn.onclick = (e) => {
        e.preventDefault();
        window.location.href = "shop.html";
    };
}
,
    addToCart(id, title, price) {
        if (!localStorage.getItem("authToken")) {
            alert("Please login first");
            return location.href = "login.html";
        }

        if (!window.CartSystem) {
            alert("Cart system not loaded");
            return;
        }

        window.CartSystem.addToCart(id, title, price, 1).then(() => {
            alert(title + " added to cart!");
        });
    }
};



document.addEventListener("DOMContentLoaded", () => AM_ProductLoader.init());
