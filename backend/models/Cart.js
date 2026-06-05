const mongoose = require("mongoose");

const cartItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 1
    }
  },
  { _id: false }
);

const cartSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true
    },

    items: [cartItemSchema],

    appliedVoucher: {
      voucherId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Voucher",
        default: null
      },

      voucherName: {
        type: String,
        default: null
      },

      discountAmount: {
        type: Number,
        default: 0
      }
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("Cart", cartSchema);