document.addEventListener("DOMContentLoaded", async () => {
  console.log("[v0] Loading blogs...")

  const container = document.getElementById("blog-container")
  if (!container) {
    console.warn("[v0] Blog container not found")
    return
  }

  try {
    // Show loading skeleton
    container.innerHTML = `
      <div class="swiper-slide"><div style="height: 300px; background: #f0f0f0; animation: pulse 1s infinite; border-radius: 8px;"></div></div>
      <div class="swiper-slide"><div style="height: 300px; background: #f0f0f0; animation: pulse 1s infinite; border-radius: 8px;"></div></div>
    `

    // Fetch blogs from API
    const response = await fetch("https://paypal.variants.ecomsandbox.softpages.in/api/blogs?limit=100", {
      method: "GET",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    })

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`)
    }

    const data = await response.json()
    console.log("[v0] Blogs API response:", data)

    let blogs = []
    if (Array.isArray(data)) {
      blogs = data
    } else if (data.blogs && Array.isArray(data.blogs)) {
      blogs = data.blogs
    } else if (data.data && Array.isArray(data.data)) {
      blogs = data.data
    } else {
      throw new Error("Invalid API response format")
    }

    if (!blogs || blogs.length === 0) {
      container.innerHTML = `
        <div class="swiper-slide">
          <div style="text-align: center; color: #999; padding: 40px;">No blogs available</div>
        </div>
      `
      return
    }

    // Render blog cards
    const blogHTML = blogs
      .slice(0, 100)
      .map((blog) => {
        const slug = blog.slug || blog.heading?.toLowerCase().replace(/\s+/g, "-") || `blog-${blog._id}`
        const imageUrl = blog.images?.main || blog.image || blog.thumbnail || "assets/img/blog/default.png"
        const title = blog.heading || blog.title || "Untitled"
        const excerpt = (blog.context || blog.description || blog.excerpt || "").substring(0, 100)
        const publishDate = new Date(blog.publishedAt || blog.createdAt || Date.now()).toLocaleDateString()
        const author = blog.author || "Admin"

        return `
          <div class="swiper-slide">
            <div class="blog-card3" onclick="window.location.href='blog-details.html?slug=${slug}'" style="cursor: pointer; height: 100%;">
              <div class="blog-thumb" style="height: 200px; overflow: hidden; margin-bottom: 15px; border-radius: 8px;">
                <img src="${imageUrl}" 
                     alt="${title}"
                     loading="lazy"
                     style="width: 100%; height: 100%; object-fit: cover; display: block; transition: transform 0.3s ease;"
                     onerror="this.src='assets/img/blog/default.png'">
              </div>
              <div class="blog-content" style="padding: 0 15px;">
                <h3 class="blog-title" style="font-size: 16px; margin: 0 0 10px 0; font-weight: 600; line-height: 1.4;">
                  ${title}
                </h3>
                <p class="blog-meta" style="font-size: 12px; color: #999; margin: 0 0 10px 0;">
                  ${publishDate} • ${author}
                </p>
                <p class="blog-excerpt" style="font-size: 13px; color: #666; margin: 0; line-height: 1.5;">
                  ${excerpt}...
                </p>
                <a href="blog-details.html?slug=${slug}" style="color: #dc3545; font-weight: 600; font-size: 12px; margin-top: 10px; display: inline-block; text-decoration: none;">
                  Read More →
                </a>
              </div>
            </div>
          </div>
        `
      })
      .join("")

    container.innerHTML = blogHTML
    console.log("[v0] Blogs rendered successfully, total:", blogs.length)

    setTimeout(() => {
      initializeBlogSlider(blogs.length)
    }, 300)
  } catch (error) {
    console.error("[v0] Error loading blogs:", error)
    container.innerHTML = `
      <div class="swiper-slide">
        <div style="text-align: center; color: #dc3545; padding: 40px;">
          <p>Failed to load blogs</p>
          <small style="color: #999;">${error.message}</small>
          <button onclick="location.reload()" style="margin-top: 15px; padding: 8px 16px; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer;">Retry</button>
        </div>
      </div>
    `
  }
})

function initializeBlogSlider(totalBlogs) {
  const blogSlider = document.querySelector("#blogSlider")

  if (!blogSlider) {
    console.warn("[v0] Blog slider element not found")
    return
  }

  const checkSwiperAndInit = () => {
    if (window.Swiper) {
      console.log("[v0] Initializing blog swiper with", totalBlogs, "blogs")

      // Calculate slides per view based on blog count
      const desktopSlides = Math.min(2, totalBlogs)
      const tabletSlides = Math.min(1, totalBlogs)
      const mobileSlides = Math.min(1, totalBlogs)

      const swiperOptions = {
        autoHeight: true,
        spaceBetween: 30,
        breakpoints: {
          0: { slidesPerView: mobileSlides },
          576: { slidesPerView: tabletSlides },
          768: { slidesPerView: tabletSlides },
          992: { slidesPerView: desktopSlides },
          1200: { slidesPerView: desktopSlides },
        },
      }

      if (blogSlider.swiper) {
        blogSlider.swiper.destroy()
      }

      new window.Swiper(blogSlider, swiperOptions)
      console.log(
        `[v0] Blog swiper initialized: mobile:${mobileSlides}, tablet:${tabletSlides}, desktop:${desktopSlides}`,
      )
    } else {
      setTimeout(checkSwiperAndInit, 100)
    }
  }

  checkSwiperAndInit()
}
