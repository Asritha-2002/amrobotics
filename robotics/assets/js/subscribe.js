/**
 * 🚀 AM Robotics Newsletter Subscription Script
 * EmailJS Integration (template_id: subscribe_id)
 * Author: AM Robotics
 */

(function () {
  // ✅ Initialize EmailJS
  emailjs.init("wnc0CaYrKlWKSS39G"); // Your Public Key
  console.log("[AMR] EmailJS initialized successfully");
})();

document.addEventListener("DOMContentLoaded", () => {
  const form = document.querySelector(".newsletter-form");
  if (!form) {
    console.error("[AMR] Newsletter form not found in DOM");
    return;
  }

  const emailInput = form.querySelector("input[type='email']");
  const submitBtn = form.querySelector("button");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = emailInput.value.trim();

    // ✅ FIXED: Proper email validation regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!email || !emailRegex.test(email)) {
      showToast("Please enter a valid email address.", "error");
      return;
    }

    const originalText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Subscribing...';

    try {
      // 💌 Send email using your EmailJS template
      await emailjs.send("service_apvc4bd", "subscribe_id", {
        user_email: email,
      });

      showToast("Thank you for subscribing! 🎉", "success");
      form.reset();
    } catch (error) {
      console.error("[AMR] EmailJS error:", error);
      showToast("Subscription failed. Please try again later.", "error");
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalText;
    }
  });

  /**
   * 🌈 Toast Notification System - AM Robotics Style
   */
  function showToast(message, type = "info") {
    let container = document.getElementById("toastContainer");

    if (!container) {
      container = document.createElement("div");
      container.id = "toastContainer";
      container.style.position = "fixed";
      container.style.top = "25px";
      container.style.right = "25px";
      container.style.zIndex = "9999";
      container.style.display = "flex";
      container.style.flexDirection = "column";
      container.style.alignItems = "flex-end";
      document.body.appendChild(container);
    }

    const toast = document.createElement("div");
    toast.className = "amr-toast";
    toast.textContent = message;

    // Styling
    toast.style.cssText = `
      background: linear-gradient(135deg, #7b3efc, #ff4b2b);
      color: white;
      padding: 14px 22px;
      border-radius: 12px;
      margin-top: 10px;
      font-size: 15px;
      box-shadow: 0 5px 20px rgba(0,0,0,0.2);
      opacity: 0;
      transform: translateY(-20px);
      transition: all 0.4s ease;
      display: flex;
      align-items: center;
      gap: 8px;
      font-family: 'DM Sans', sans-serif;
    `;

    const icon = document.createElement("i");
    icon.className =
      type === "success"
        ? "fas fa-check-circle"
        : type === "error"
        ? "fas fa-times-circle"
        : "fas fa-info-circle";
    icon.style.fontSize = "18px";
    icon.style.marginRight = "8px";

    toast.prepend(icon);
    container.appendChild(toast);

    // Animate in
    requestAnimationFrame(() => {
      toast.style.opacity = "1";
      toast.style.transform = "translateY(0)";
    });

    // Auto-remove after 3.5s
    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(-20px)";
      setTimeout(() => toast.remove(), 400);
    }, 3500);
  }
});
