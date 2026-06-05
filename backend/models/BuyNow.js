const mongoose = require("mongoose");

// ── Single item ───────────────────────────────────────────────────────────────
const buyItemSchema = new mongoose.Schema(
  {
    productId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      "Product",
      required: true,
    },
    quantity: {
      type:     Number,
      required: true,
      min:      1,
    },
  },
  { _id: false }
);

// ── Shipping address sub-schema ───────────────────────────────────────────────
const shippingAddressSchema = new mongoose.Schema(
  {
    firstName:  { type: String, default: "", trim: true },
    lastName:   { type: String, default: "", trim: true },
    email:      { type: String, default: "", trim: true, lowercase: true },
    phone:      { type: String, default: "", trim: true },
    address1:   { type: String, default: "", trim: true },   // street address
    address2:   { type: String, default: "", trim: true },   // apartment/suite (optional)
    city:       { type: String, default: "", trim: true },
    state:      { type: String, default: "", trim: true },
    postalCode: { type: String, default: "", trim: true },
    country:    { type: String, default: "India", trim: true },
  },
  { _id: false }   // no separate _id for the embedded address
);

// ── Main BuyNow schema ────────────────────────────────────────────────────────
const buySchema = new mongoose.Schema(
  {
    userId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      "User",
      required: true,
      unique:   true,
    },

    items: [buyItemSchema],

    // ── Shipping address (filled at checkout step 2) ──────────────────────────
    shippingAddress: {
      type:    shippingAddressSchema,
      default: () => ({}),   // starts as empty object, filled when user enters address
    },

    // ── Applied voucher ───────────────────────────────────────────────────────
    appliedVoucher: {
      voucherId: {
        type:    mongoose.Schema.Types.ObjectId,
        ref:     "Voucher",
        default: null,
      },
      voucherName: {
        type:    String,
        default: null,
      },
      discountAmount: {
        type:    Number,
        default: 0,
      },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("BuyNow", buySchema);