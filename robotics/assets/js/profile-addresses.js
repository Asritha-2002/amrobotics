// const authManager = window.authManager
// const api = window.api

let currentAddresses = []

// Load addresses on page load
async function loadProfileAddresses() {
  try {
    const addresses = await api.getAddresses()
    currentAddresses = addresses || []
    renderAddressesTable()
  } catch (error) {
    console.error("[v0] Error loading addresses:", error)
    showMessage("Failed to load addresses", "error")
  }
}

function renderAddressesTable() {
  const container = document.getElementById("addresses-container")
  if (!container) return

  if (currentAddresses.length === 0) {
    container.innerHTML =
      '<p class="text-gray-500">No saved addresses. <a href="#" onclick="openAddAddressModal()">Add one</a></p>'
    return
  }

  const html = currentAddresses
    .map(
      (address) => `
    <div class="address-card p-4 border rounded-lg mb-3 bg-white">
      <div class="flex justify-between items-start mb-2">
        <div>
          <h4 class="font-semibold mb-1">${address.label || "Address"}</h4>
          <p class="text-sm text-gray-700">
            ${address.firstName || ""} ${address.lastName || ""}<br>
            ${address.street || address.address || ""}<br>
            ${address.city || ""}, ${address.state || ""} ${address.zipCode || address.zipcode || ""}<br>
            ${address.country || "India"}<br>
            ${address.contactNumber || address.phone || ""}
          </p>
          ${address.isDefault ? '<span class="text-xs bg-green-100 text-green-700 px-2 py-1 rounded mt-2 inline-block">Default Address</span>' : ""}
        </div>
        <div class="flex gap-2">
          <button onclick="editAddress('${address._id}')" class="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600">
            Edit
          </button>
          <button onclick="deleteAddress('${address._id}')" class="px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600">
            Delete
          </button>
        </div>
      </div>
    </div>
  `,
    )
    .join("")

  container.innerHTML = html
}

async function editAddress(addressId) {
  const address = currentAddresses.find((a) => a._id === addressId)
  if (!address) {
    showMessage("Address not found", "error")
    return
  }

  // Populate form with address data
  const form = document.getElementById("address-form") || createAddressForm()
  if (form.elements.firstName) form.elements.firstName.value = address.firstName || ""
  if (form.elements.lastName) form.elements.lastName.value = address.lastName || ""
  if (form.elements.email) form.elements.email.value = address.email || ""
  if (form.elements.phone) form.elements.phone.value = address.contactNumber || address.phone || ""
  if (form.elements.address) form.elements.address.value = address.street || address.address || ""
  if (form.elements.apartment) form.elements.apartment.value = address.apartment || ""
  if (form.elements.city) form.elements.city.value = address.city || ""
  if (form.elements.state) form.elements.state.value = address.state || ""
  if (form.elements.zipcode) form.elements.zipcode.value = address.zipCode || address.zipcode || ""
  if (form.elements.label) form.elements.label.value = address.label || ""

  // Show form (e.g., in a modal or by scrolling)
  form.dataset.addressId = addressId
  form.dataset.isEdit = "true"
  showAddressForm(form)
}

async function deleteAddress(addressId) {
  if (!confirm("Are you sure you want to delete this address?")) return

  try {
    showLoader()
    await api.deleteAddress(addressId)
    showMessage("Address deleted successfully", "success")
    currentAddresses = currentAddresses.filter((a) => a._id !== addressId)
    renderAddressesTable()
  } catch (error) {
    console.error("[v0] Error deleting address:", error)
    showMessage(error.message || "Failed to delete address", "error")
  } finally {
    hideLoader()
  }
}

async function saveAddress(formData) {
  try {
    showLoader()

    const addressData = {
      firstName: formData.firstName || "",
      lastName: formData.lastName || "",
      email: formData.email || "",
      street: formData.address || "",
      apartment: formData.apartment || "",
      city: formData.city || "",
      state: formData.state || "",
      zipCode: formData.zipcode || "",
      country: formData.country || "India",
      contactNumber: formData.phone || "",
      label: formData.label || "My Address",
    }

    const isEdit = document.getElementById("address-form")?.dataset.isEdit === "true"
    const addressId = document.getElementById("address-form")?.dataset.addressId

    if (isEdit && addressId) {
      await api.updateAddress(addressId, addressData)
      showMessage("Address updated successfully", "success")
    } else {
      await api.addAddress(addressData)
      showMessage("Address added successfully", "success")
    }

    // Reload addresses
    await loadProfileAddresses()
    hideAddressForm()
  } catch (error) {
    console.error("[v0] Error saving address:", error)
    showMessage(error.message || "Failed to save address", "error")
  } finally {
    hideLoader()
  }
}

function showAddressForm(form) {
  // Make form visible - adjust based on your HTML structure
  form.style.display = "block"
  form.scrollIntoView({ behavior: "smooth", block: "start" })
}

function hideAddressForm() {
  const form = document.getElementById("address-form")
  if (form) {
    form.style.display = "none"
    form.reset()
    form.dataset.isEdit = "false"
    delete form.dataset.addressId
  }
}

function createAddressForm() {
  // Create form if it doesn't exist
  const form = document.createElement("form")
  form.id = "address-form"
  form.innerHTML = `
    <div class="p-4 border rounded-lg bg-white mb-4">
      <h3 class="font-semibold mb-4">Add/Edit Address</h3>
      <input type="text" name="firstName" placeholder="First Name" required class="w-full p-2 border rounded mb-2">
      <input type="text" name="lastName" placeholder="Last Name" required class="w-full p-2 border rounded mb-2">
      <input type="email" name="email" placeholder="Email" required class="w-full p-2 border rounded mb-2">
      <input type="tel" name="phone" placeholder="Phone" required class="w-full p-2 border rounded mb-2">
      <input type="text" name="address" placeholder="Street Address" required class="w-full p-2 border rounded mb-2">
      <input type="text" name="apartment" placeholder="Apartment/Suite (optional)" class="w-full p-2 border rounded mb-2">
      <input type="text" name="city" placeholder="City" required class="w-full p-2 border rounded mb-2">
      <input type="text" name="state" placeholder="State/Province" required class="w-full p-2 border rounded mb-2">
      <input type="text" name="zipcode" placeholder="ZIP Code" required class="w-full p-2 border rounded mb-2">
      <input type="text" name="label" placeholder="Label (e.g., Home, Work)" class="w-full p-2 border rounded mb-4">
      <div class="flex gap-2">
        <button type="submit" class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">Save</button>
        <button type="button" onclick="hideAddressForm()" class="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600">Cancel</button>
      </div>
    </div>
  `

  form.addEventListener("submit", (e) => {
    e.preventDefault()
    const formData = new FormData(form)
    const data = Object.fromEntries(formData)
    saveAddress(data)
  })

  const container = document.getElementById("address-form-container")
  if (container) {
    container.innerHTML = ""
    container.appendChild(form)
  }

  return form
}

function showLoader() {
  const loader = document.getElementById("page-loader")
  if (loader) loader.style.display = "flex"
}

function hideLoader() {
  const loader = document.getElementById("page-loader")
  if (loader) loader.style.display = "none"
}

function showMessage(message, type = "info") {
  const container = document.getElementById("profile-messages")
  if (!container) {
    alert(message)
    return
  }

  const colors = {
    error: "bg-red-100 text-red-700",
    success: "bg-green-100 text-green-700",
    info: "bg-blue-100 text-blue-700",
  }

  const messageDiv = document.createElement("div")
  messageDiv.className = `p-4 rounded mb-4 ${colors[type] || colors.info}`
  messageDiv.textContent = message
  container.innerHTML = ""
  container.appendChild(messageDiv)

  setTimeout(() => {
    messageDiv.remove()
  }, 4000)
}

// Initialize on page load
document.addEventListener("DOMContentLoaded", () => {
  loadProfileAddresses()
  createAddressForm()
})
