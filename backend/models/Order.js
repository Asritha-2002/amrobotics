const mongoose = require("mongoose");

// ─── Order Item Sub-Schema ────────────────────────────────────────────────────
const orderItemSchema = new mongoose.Schema(
  {
    productId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      "Product",
      required: true,
    },

    // Product snapshot at time of order (so it stays accurate if product changes)
    name:          { type: String, required: true },
    sku:           { type: String, default: "" },
    brand:         { type: String, default: "" },
    category:      { type: String, default: "" },
    country:       { type: String, default: "" },
    image:         { type: String, default: "" },   // first image from product

    quantity:      { type: Number, required: true, min: 1 },

    // Price snapshot
    sellingPrice:  { type: Number, required: true },
    originalPrice: { type: Number, required: true },
    discountPercent: { type: Number, default: 0 },

    // line total = sellingPrice × quantity
    lineTotal:     { type: Number, required: true },
  },
  { _id: false }
);

// ─── Tracking Update Sub-Schema ───────────────────────────────────────────────
const trackingUpdateSchema = new mongoose.Schema({
  status: {
    type: String,
    enum: [
      "order_placed",
      "processing",
      "packed",
      "shipped",
      "out_for_delivery",
      "delivered",
      "failed_delivery",
      "returned",
    ],
    required: true,
  },
  location:    { type: String, default: "" },
  description: { type: String, default: "" },
  timestamp:   { type: Date, default: Date.now },
});

// ─── Main Order Schema ────────────────────────────────────────────────────────
const orderSchema = new mongoose.Schema(
  {
    // ── User ─────────────────────────────────────────────────────────────────
    userId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      "User",
      required: true,
    },

    // ── Items ─────────────────────────────────────────────────────────────────
    items: {
      type: [orderItemSchema],
      validate: {
        validator: (v) => v.length > 0,
        message:   "Order must have at least one item",
      },
    },

    // ── Shipping Address (snapshot from BuyNow at time of order) ──────────────
    shippingAddress: {
      firstName:  { type: String, default: "" },
      lastName:   { type: String, default: "" },
      email:      { type: String, default: "" },
      phone:      { type: String, default: "" },
      address1:   { type: String, default: "" },
      address2:   { type: String, default: "" },
      city:       { type: String, default: "" },
      state:      { type: String, default: "" },
      postalCode: { type: String, default: "" },
      country:    { type: String, default: "India" },
    },

    // ── Pricing Breakdown ─────────────────────────────────────────────────────
    pricing: {
      subtotal:        { type: Number, required: true },  // sum of sellingPrice × qty
      mrpTotal:        { type: Number, default: 0 },      // sum of originalPrice × qty
      mrpSavings:      { type: Number, default: 0 },      // mrpTotal - subtotal
      voucherDiscount: { type: Number, default: 0 },      // discount from voucher
      deliveryCharge:  { type: Number, default: 0 },      // from delivery API
      gstAmount:       { type: Number, default: 0 },      // GST applied
      total:           { type: Number, required: true },  // final amount paid
    },

    // ── Applied Voucher ───────────────────────────────────────────────────────
    appliedVoucher: {
      voucherId:      { type: mongoose.Schema.Types.ObjectId, ref: "Voucher", default: null },
      code:           { type: String, default: "" },
      discountAmount: { type: Number, default: 0 },
    },

    // ── Payment ───────────────────────────────────────────────────────────────
    payment: {
      method: {
        type: String,
        enum:    ["paypal", "cod", "bank_transfer"],
        default: "paypal",
      },
      status: {
        type: String,
        enum:    ["pending", "paid", "failed", "refunded","cancelled"],
        default: "pending",
      },

      // PayPal fields
      paypalOrderId:   { type: String, default: null },
      paypalCaptureId: { type: String, default: null },
      paypalPayerId:   { type: String, default: null },

      currency:    { type: String, default: "INR" },
      paidAmount:  { type: Number, default: 0 },
      paidAt:      { type: Date,   default: null },
    },

    // ── Order Status ──────────────────────────────────────────────────────────
    status: {
      type: String,
      enum: [
        "pending",           // placed, payment not confirmed yet
        "confirmed",         // payment confirmed
        "processing",        // being packed
        "shipped",           // dispatched
        "out_for_delivery",  // with delivery agent
        "delivered",         // delivered to customer
        "cancelled",         // cancelled
        "return_requested",  // customer raised return
        "returned",          // return completed
        "refund_initiated",  // refund started
        "refund_completed",  // refund done
      ],
      default: "pending",
    },

    // ── Delivery / Tracking ───────────────────────────────────────────────────
    delivery: {
      partnerName:       { type: String, default: "" },
      trackingId:        { type: String, default: "" },
      estimatedDelivery: { type: Date,   default: null },
      currentLocation:   { type: String, default: "" },
      trackingUpdates:   [trackingUpdateSchema],
    },

    // ── Cancellation ──────────────────────────────────────────────────────────
    cancellation: {
      reason: {
        type: String,
        enum: [
          "customer_request",
          "out_of_stock",
          "payment_issue",
          "shipping_issue",
          "other",
        ],
        default: null,
      },
      notes:       { type: String, default: "" },
      cancelledAt: { type: Date,   default: null },
      cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    },

    // ── Refund ────────────────────────────────────────────────────────────────
    refund: {
      reason: {
        type: String,
        enum: [
          "customer_request",
          "defective_product",
          "wrong_item",
          "not_as_described",
          "payment_failure",
          "other",
        ],
        default: null,
      },
      notes:        { type: String, default: "" },
      refundAmount: { type: Number, default: 0 },
      referenceId:  { type: String, default: "" },  // PayPal refund ID etc.
      processedAt:  { type: Date,   default: null },
      processedBy:  { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    },

    // ── Meta ──────────────────────────────────────────────────────────────────
    meta: {
      source:      { type: String, enum: ["web", "mobile"], default: "web" },
      notes:       { type: String, default: "" },
      invoiceUrl:  { type: String, default: "" },
    },
  },
  {
    timestamps: true,
    toJSON:  { virtuals: true },
    toObject:{ virtuals: true },
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────
orderSchema.index({ userId: 1, createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ "payment.status": 1 });
orderSchema.index({ "payment.paypalOrderId": 1 }, { sparse: true });
orderSchema.index({ "delivery.trackingId": 1 },   { sparse: true });

// ─── Virtuals ─────────────────────────────────────────────────────────────────
orderSchema.virtual("isPaid").get(function () {
  return this.payment.status === "paid";
});

orderSchema.virtual("isCancelled").get(function () {
  return this.status === "cancelled";
});

orderSchema.virtual("isDelivered").get(function () {
  return this.status === "delivered";
});

orderSchema.virtual("latestTracking").get(function () {
  const updates = this.delivery?.trackingUpdates;
  if (!updates?.length) return null;
  return updates[updates.length - 1];
});

// ─── Instance Methods ─────────────────────────────────────────────────────────
orderSchema.methods.canBeCancelled = function () {
  return ["pending", "confirmed", "processing"].includes(this.status);
};

orderSchema.methods.canBeRefunded = function () {
  return (
    ["delivered", "cancelled"].includes(this.status) &&
    this.payment.status === "paid"
  );
};

orderSchema.methods.markPaid = async function (paypalDetails) {
  this.payment.status        = "paid";
  this.payment.paypalOrderId   = paypalDetails.orderId   || null;
  this.payment.paypalCaptureId = paypalDetails.captureId || null;
  this.payment.paypalPayerId   = paypalDetails.payerId   || null;
  this.payment.paidAmount    = paypalDetails.amount      || 0;
  this.payment.paidAt        = new Date();
  this.status                = "confirmed";
  return this.save();
};

orderSchema.methods.addTrackingUpdate = async function (data) {
  if (!this.delivery) this.delivery = { trackingUpdates: [] };
  this.delivery.trackingUpdates.push({
    status:      data.status,
    location:    data.location    || "",
    description: data.description || "",
  });
  if (data.currentLocation) this.delivery.currentLocation = data.currentLocation;
  if (data.trackingId)      this.delivery.trackingId      = data.trackingId;
  return this.save();
};

module.exports = mongoose.model("Order", orderSchema);