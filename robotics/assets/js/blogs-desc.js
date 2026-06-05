
async function fetchBlogDetails() {
  const params = new URLSearchParams(window.location.search);
  const slug = params.get("slug");

  if (!slug) {
    document.getElementById("blog-heading").textContent = "No blog selected.";
    return;
  }

  try {
    const response = await fetch(`https://paypal.variants.ecomsandbox.softpages.in/api/blogs/${slug}`);
    if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);

    const json = await response.json();
    const blog = json?.data?.blog || json?.data; // fallback if structure changes

    // 🖼️ Main Blog Info
    document.getElementById("blog-main-img").src = blog.images?.main || "assets/img/blog/default.jpg";
    document.getElementById("blog-heading").textContent = blog.heading;
    document.getElementById("blog-context").textContent = blog.context;
    document.getElementById("blog-metaDescription").textContent = blog.metaDescription;
    document.getElementById("blog-date").textContent = new Date(blog.publishedAt).toLocaleDateString("en-US", {
      day: "2-digit", month: "short", year: "numeric"
    });
    document.getElementById("blog-author").textContent = blog.author || "Admin";

    // 🖼️ Sub Images (if available)
    const subContainer = document.getElementById("blog-sub-images");
    subContainer.innerHTML = "";
    if (blog.images?.sub && Array.isArray(blog.images.sub)) {
      blog.images.sub.forEach(src => {
        subContainer.innerHTML += `
          <div class="col-md-6 mb-30">
            <div class="blog-radius-img"><img class="w-100" src="${src}" alt="Sub Image"></div>
          </div>`;
      });
    }

    // 🏷️ Tags Section
    const tagContainer = document.getElementById("tagcloud");
    tagContainer.innerHTML = blog.tags.map(tag => `<a href="blog.html">${tag}</a>`).join(" ");

  } catch (error) {
    console.error("Error loading blog:", error);
    document.getElementById("blog-heading").textContent = "Error loading blog details.";
  }
}

async function fetchRecentPosts() {
  const recentContainer = document.getElementById("recent-posts");

  try {
    const response = await fetch("https://paypal.variants.ecomsandbox.softpages.in/api/blogs");
    const json = await response.json();
    const blogs = json?.data?.blogs || [];

    recentContainer.innerHTML = blogs.slice(0, 3).map(blog => `
      <div class="recent-post">
        <div class="media-img">
          <a href="blog-details.html?slug=${blog.slug}">
            <img src="${blog.images?.main || 'assets/img/blog/default.jpg'}" alt="${blog.heading}">
          </a>
        </div>
        <div class="media-body">
          <div class="recent-post-meta">
            <a href="#"><i class="fas fa-calendar"></i>${new Date(blog.publishedAt).toLocaleDateString("en-US", {
              day: "2-digit", month: "short", year: "numeric"
            })}</a>
          </div>
          <h4 class="post-title">
            <a class="text-inherit" href="blog-details.html?slug=${blog.slug}">
              ${blog.heading}
            </a>
          </h4>
        </div>
      </div>
    `).join("");
  } catch (error) {
    console.error("Error loading recent posts:", error);
    recentContainer.innerHTML = "<p>Failed to load recent posts.</p>";
  }
}

// Run both when page loads
document.addEventListener("DOMContentLoaded", () => {
  fetchBlogDetails();
  fetchRecentPosts();
});
