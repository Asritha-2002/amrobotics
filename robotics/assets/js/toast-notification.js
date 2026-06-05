;(() => {
  window.showToast = (message, type = "info", duration = 4000) => {
    // Create toast container if it doesn't exist
    let toastContainer = document.getElementById("toast-container")
    if (!toastContainer) {
      toastContainer = document.createElement("div")
      toastContainer.id = "toast-container"
      toastContainer.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 10000;
                max-width: 400px;
                pointer-events: none;
            `
      document.body.appendChild(toastContainer)
    }

    // Create toast element
    const toast = document.createElement("div")
    const bgColor = type === "success" ? "#d4edda" : type === "error" ? "#f8d7da" : "#d1ecf1"
    const textColor = type === "success" ? "#155724" : type === "error" ? "#721c24" : "#0c5460"
    const borderColor = type === "success" ? "#c3e6cb" : type === "error" ? "#f5c6cb" : "#bee5eb"
    const icon = type === "success" ? "✓" : type === "error" ? "✕" : "ℹ"

    toast.style.cssText = `
            background-color: ${bgColor};
            color: ${textColor};
            padding: 15px 20px;
            margin-bottom: 10px;
            border-radius: 8px;
            border-left: 4px solid ${textColor};
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
            animation: slideIn 0.3s ease;
            pointer-events: auto;
            display: flex;
            align-items: center;
            gap: 10px;
            font-size: 14px;
            font-weight: 500;
        `

    toast.innerHTML = `
            <span style="font-size: 18px; font-weight: bold;">${icon}</span>
            <span>${message}</span>
        `

    toastContainer.appendChild(toast)

    // Add animation keyframes if not already present
    if (!document.getElementById("toast-animation-styles")) {
      const styles = document.createElement("style")
      styles.id = "toast-animation-styles"
      styles.innerHTML = `
                @keyframes slideIn {
                    from {
                        transform: translateX(400px);
                        opacity: 0;
                    }
                    to {
                        transform: translateX(0);
                        opacity: 1;
                    }
                }
                @keyframes slideOut {
                    from {
                        transform: translateX(0);
                        opacity: 1;
                    }
                    to {
                        transform: translateX(400px);
                        opacity: 0;
                    }
                }
            `
      document.head.appendChild(styles)
    }

    // Remove toast after duration
    setTimeout(() => {
      toast.style.animation = "slideOut 0.3s ease"
      setTimeout(() => {
        toast.remove()
      }, 300)
    }, duration)
  }
})()
