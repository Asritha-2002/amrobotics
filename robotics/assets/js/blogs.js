async function fetchBlogs() {
  const blogContainer = document.querySelector("#blog-sec .row.gy-40");

  try {
    const response = await fetch("https://paypal.variants.ecomsandbox.softpages.in/api/blogs");
    if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);

    const json = await response.json();
    const blogs = json?.data?.blogs || [];

    if (blogs.length === 0) {
      blogContainer.innerHTML = `
        <div class="col-12 text-center">
          <p>No blogs available right now.</p>
        </div>`;
      return;
    }

    // FULL STATIC THEME FORMAT
    blogContainer.innerHTML = blogs
      .map(
        (blog) => `
        <div class="col-xl-4 fadeinup wow" data-cue="slideInUp">
          <div class="blog-card">

            <!-- Blog Image -->
            <div class="blog-img">
              <a href="blog-details.html?slug=${blog.slug}">
                <img 
                  src="${blog.images?.main || "assets/img/blog/default.jpg"}"
                  alt="blog image"
                >
              </a>
            </div>

            <!-- Content -->
            <div class="blog-content">

              <div class="blog-meta">
                <a href="#">
                  <i class="far fa-calendar"></i>
                  ${new Date(blog.publishedAt).toLocaleDateString("en-US", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </a>

                <a href="#">
                  <i class="far fa-user"></i>
                  by ${blog.author || "admin"}
                </a>
              </div>

              <h3 class="box-title">
                <a href="blog-details.html?slug=${blog.slug}">
                  ${blog.heading}
                </a>
              </h3>

              <a href="blog-details.html?slug=${blog.slug}" class="link-btn style4">
                Read More <i class="fas fa-long-arrow-right ms-2"></i>
              </a>

            </div>

          </div>
        </div>
      `
      )
      .join("");

  } catch (error) {
    console.error("Error loading blogs:", error);

    blogContainer.innerHTML = `
      <div class="col-12 text-center text-danger">
        <p>Failed to load blogs. Please try again later.</p>
      </div>`;
  }
}

async function fetchHomepageBlogs() {
  const wrapper = document.getElementById("homepage-blog-wrapper");
  if (!wrapper) return;

  try {
    const response = await fetch("https://paypal.variants.ecomsandbox.softpages.in/api/blogs");
    if (!response.ok) throw new Error("Failed to load blogs");

    const json = await response.json();
    let blogs = json?.data?.blogs || [];

    // Show only 3 recent blogs
    blogs = blogs.slice(0, 3);

    wrapper.innerHTML = blogs
      .map(
        (blog) => `
        <div class="swiper-slide">
          <div class="blog-card3">

            <div class="blog-img" data-mask-src="assets/img/shape/blog-card3-shape.png">
              <a href="blog-details.html?slug=${blog.slug}">
                <img src="${blog.images?.main || "assets/img/blog/default.jpg"}" alt="blog image">
              </a>
            </div>

            <div class="blog-content">

              <div class="blog-meta">
                <a href="#">
                  <i class="far fa-calendar"></i> 
                  ${new Date(blog.publishedAt).toLocaleDateString("en-US", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric"
                  })}
                </a>

                <a href="#">
                  <i class="far fa-user"></i> by ${blog.author || "admin"}
                </a>
              </div>

              <h3 class="box-title">
                <a href="blog-details.html?slug=${blog.slug}">
                  ${blog.heading}
                </a>
              </h3>

              <a href="blog-details.html?slug=${blog.slug}" class="th-btn style-gradient3">
                Read More <i class="fal fa-long-arrow-right ms-2"></i>
              </a>

            </div>
          </div>
        </div>
      `
      )
      .join("");

    // Reinitialize Swiper
    if (window.Swiper) {
      new Swiper("#blogSlider3", {
        breakpoints: {
          0: { slidesPerView: 1 },
          576: { slidesPerView: 1 },
          768: { slidesPerView: 1 },
          992: { slidesPerView: 2 },
          1200: { slidesPerView: 2 },
        },
        navigation: {
          nextEl: ".blog-slider3 .slider-next",
          prevEl: ".blog-slider3 .slider-prev",
        },
        spaceBetween: 30
      });
    }

  } catch (error) {
    console.error("Homepage blogs error:", error);
    wrapper.innerHTML = `
      <div class="swiper-slide">
        <div class="text-center text-danger">Failed to load blogs</div>
      </div>`;
  }
}

document.addEventListener("DOMContentLoaded", fetchHomepageBlogs);


document.addEventListener("DOMContentLoaded", fetchBlogs);
