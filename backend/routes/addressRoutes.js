const express         = require("express");
const router          = express.Router();
const CheckoutAddress = require("../models/CheckoutAddress");
const BuyNow          = require("../models/BuyNow");
const Cart            = require("../models/Cart"); // your cart model
const { auth }        = require("../middleware/auth");

// ── GET all saved checkout addresses for logged-in user ───────────────────────
router.get("/user/checkout-addresses", auth, async (req, res) => {
  try {
    const doc = await CheckoutAddress.findOne({ userId: req.user.id });
    res.json({
      success:   true,
      addresses: doc ? doc.addresses : []
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST add a new checkout address ──────────────────────────────────────────
router.post("/user/checkout-addresses", auth, async (req, res) => {
  try {
    const doc = await CheckoutAddress.getOrCreate(req.user.id);
    await doc.addAddress(req.body);
    res.status(201).json({ success: true, addresses: doc.addresses });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// ── PUT update an existing address ───────────────────────────────────────────
router.put("/user/checkout-addresses/:addressId", auth, async (req, res) => {
  try {
    const doc = await CheckoutAddress.findOne({ userId: req.user._id });
    if (!doc) return res.status(404).json({ success: false, message: "No addresses found" });
    await doc.updateAddress(req.params.addressId, req.body);
    res.json({ success: true, addresses: doc.addresses });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// ── DELETE remove an address ──────────────────────────────────────────────────
router.delete("/user/checkout-addresses/:addressId", auth, async (req, res) => {
  try {
    const doc = await CheckoutAddress.findOne({ userId: req.user._id });
    if (!doc) return res.status(404).json({ success: false, message: "No addresses found" });
    await doc.removeAddress(req.params.addressId);
    res.json({ success: true, addresses: doc.addresses });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// ── POST select an address → save into BuyNow + Cart shippingAddress ─────────
// Called when user checks a saved address checkbox and clicks Next
router.post("/user/select-address", auth, async (req, res) => {
  try {
    const { addressId } = req.body;

    // find the address from CheckoutAddress
    const doc = await CheckoutAddress.findOne({ userId: req.user.id });
    if (!doc) return res.status(404).json({ success: false, message: "No addresses found" });

    const addr = doc.addresses.id(addressId);
    if (!addr) return res.status(404).json({ success: false, message: "Address not found" });

    // map to shippingAddress shape
    const shippingAddress = {
      firstName:  addr.firstName,
      lastName:   addr.lastName,
      email:      addr.email,
      phone:      addr.phone,
      address1:   addr.address1,
      address2:   addr.address2 || "",
      city:       addr.city,
      state:      addr.state,
      postalCode: addr.postalCode,
      country:    addr.country,
    };

    // save into BuyNow model
    await BuyNow.findOneAndUpdate(
      { userId: req.user.id },
      { $set: { shippingAddress } },
      { upsert: true, new: true }
    );

    res.json({
      success: true,
      message: "Address selected",
      shippingAddress
    });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST save new address + optionally store in CheckoutAddress model ─────────
// Called when user fills the form manually
// If saveForFuture = true → also adds to CheckoutAddress
router.post("/user/save-shipping-address", auth, async (req, res) => {
  try {
    const { saveForFuture, ...addressData } = req.body;

    const shippingAddress = {
      firstName:  addressData.firstName,
      lastName:   addressData.lastName,
      email:      addressData.email,
      phone:      addressData.phone,
      address1:   addressData.address1 || addressData.street || "",
      address2:   addressData.address2 || addressData.apartment || "",
      city:       addressData.city,
      state:      addressData.state,
      postalCode: addressData.postalCode || addressData.zipCode || "",
      country:    addressData.country,
    };

    // always save into BuyNow
    await BuyNow.findOneAndUpdate(
      { userId: req.user.id },
      { $set: { shippingAddress } },
      { upsert: true, new: true }
    );

    // if checkbox ticked → also save to CheckoutAddress for future use
    if (saveForFuture) {
      const doc = await CheckoutAddress.getOrCreate(req.user.id);
      await doc.addAddress({
        ...shippingAddress,
        label: "Shipping Address"
      });
    }

    res.json({
      success: true,
      message: saveForFuture
        ? "Address saved and stored for future use"
        : "Address saved",
      shippingAddress
    });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;