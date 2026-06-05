const express = require("express");
const router = express.Router();

const Cart = require("../models/Cart");
const { auth } = require('../middleware/auth');
const Product = require("../models/Product");
const Voucher = require("../models/Voucher");

router.post("/add", auth, async (req, res) => {
  try {
    const userId = req.user.id;

    const { productId, quantity } = req.body;

    if (!productId || !quantity) {
      return res.status(400).json({
        success: false,
        message: "Product ID and quantity are required"
      });
    }

    let cart = await Cart.findOne({ userId });

    // Create cart if it doesn't exist
    if (!cart) {
      cart = new Cart({
        userId,
        items: [
          {
            productId,
            quantity
          }
        ]
      });

      await cart.save();

      return res.status(201).json({
        success: true,
        message: "Product added to cart",
        cart
      });
    }

    // Check if product already exists
    const existingItem = cart.items.find(
      item => item.productId.toString() === productId
    );

    if (existingItem) {
      existingItem.quantity = Number(quantity);
    } else {
      cart.items.push({
        productId,
        quantity
      });
    }

    await cart.save();

    return res.status(200).json({
      success: true,
      message: "Cart updated successfully",
      cart
    });

  } catch (error) {
    console.error("Cart Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error"
    });
  }
});

router.get("/cart", auth, async (req, res) => {
  try {

    // ===============================
    // Get User Cart
    // ===============================
    const cart = await Cart.findOne({
      userId: req.user.id
    });

    if (!cart || cart.items.length === 0) {
      return res.status(200).json({
        success: true,
        cartItems: [],
        subtotal: 0,
        totalItems: 0,
        appliedVoucher: null,
        availableVouchers: []
      });
    }

    // ===============================
    // Get Products
    // ===============================
    const productIds = cart.items.map(
      item => item.productId
    );

    const products = await Product.find({
      _id: { $in: productIds }
    });

    const productMap = {};

    products.forEach(product => {
      productMap[product._id.toString()] = product;
    });

    // ===============================
    // Build Cart Response
    // ===============================
    let subtotal = 0;

    const cartItems = cart.items
      .map(item => {

        const product =
          productMap[item.productId.toString()];

        if (!product) return null;

        const discountAmount =
          product.originalPrice -
          product.sellingPrice;

        const discountPercent =
          product.originalPrice > 0
            ? Math.round(
                (discountAmount /
                  product.originalPrice) *
                  100
              )
            : 0;

        const lineTotal =
          product.sellingPrice *
          item.quantity;

        subtotal += lineTotal;

        return {
          productId: product._id,
          quantity: item.quantity,

          name: product.name,
          image:
            product.images &&
            product.images.length
              ? product.images[0]
              : "",

          stock: product.stock,
          country: product.country,

          sellingPrice: product.sellingPrice,
          originalPrice: product.originalPrice,

          discountAmount,
          discountPercent,

          lineTotal
        };
      })
      .filter(Boolean);

    // ===============================
    // Resolve Applied Voucher
    // Re-validate from DB so expired
    // vouchers are auto-cleared
    // ===============================
    let appliedVoucher = null;

    if (cart.appliedVoucher && cart.appliedVoucher.voucherId) {

      const now = new Date();

      const voucher = await Voucher.findOne({
        _id:       cart.appliedVoucher.voucherId,
        isActive:  true,
        deletedAt: null,
        startDate: { $lte: now },
        endDate:   { $gte: now }
      });

      if (voucher) {

        // Recalculate discount amount in case
        // prices changed since it was applied
        let discountAmount = 0;

        if (voucher.discountType === "flat") {
          discountAmount = voucher.discount;
        } else if (voucher.discountType === "percent") {
          discountAmount = Math.round(
            (subtotal * voucher.discount) / 100
          );
          if (voucher.maxDiscountAmount) {
            discountAmount = Math.min(
              discountAmount,
              voucher.maxDiscountAmount
            );
          }
        }

        discountAmount = Math.min(discountAmount, subtotal);

        // Keep cart doc in sync with recalculated amount
        cart.appliedVoucher.discountAmount = discountAmount;
        await cart.save();

        appliedVoucher = {
          voucherId:        voucher._id,
          code:             voucher.code,
          title:            voucher.title,
          discountType:     voucher.discountType,
          discount:         voucher.discount,
          maxDiscountAmount: voucher.maxDiscountAmount,
          discountAmount
        };

      } else {
        // Voucher expired or deactivated — clear silently
        cart.appliedVoucher = {
          voucherId:      null,
          voucherName:    null,
          discountAmount: 0
        };
        await cart.save();
      }
    }

    // ===============================
    // Active Vouchers
    // ===============================
    const now = new Date();

    const vouchers = await Voucher.find({
      isActive: true,
      deletedAt: null,
      startDate: { $lte: now },
      endDate: { $gte: now }
    });

    const availableVouchers = [];

    for (const voucher of vouchers) {

      let applicable = false;

      for (const item of cartItems) {

        const product =
          productMap[item.productId.toString()];

        if (!product) continue;

        // ===========================
        // Country Match
        // ===========================
        if (
          voucher.country &&
          product.country &&
          voucher.country !== product.country
        ) {
          continue;
        }

        // ===========================
        // Applies To All Products
        // ===========================
        if (voucher.appliesTo === "all") {
          applicable = true;
        }

        // ===========================
        // Product Specific Voucher
        // ===========================
        else if (voucher.appliesTo === "product") {

          const matched =
            voucher.applicableProductIds.some(
              id => id.toString() === product._id.toString()
            );

          if (matched) applicable = true;
        }

        // ===========================
        // Category Voucher
        // ===========================
        else if (voucher.appliesTo === "category") {

          const matched =
            voucher.applicableCategories.some(
              category =>
                category.trim().toLowerCase() ===
                product.category.trim().toLowerCase()
            );

          if (matched) applicable = true;
        }

        if (applicable) break;
      }

      if (!applicable) continue;

      // ===========================
      // Minimum Order Check
      // ===========================
      if (subtotal < voucher.minOrderValue) continue;

      availableVouchers.push({
        _id:              voucher._id,
        code:             voucher.code,
        title:            voucher.title,
        description:      voucher.description,
        discountType:     voucher.discountType,
        discount:         voucher.discount,
        maxDiscountAmount: voucher.maxDiscountAmount,
        minOrderValue:    voucher.minOrderValue,
        country:          voucher.country,
        appliesTo:        voucher.appliesTo,
        eligibility:      voucher.eligibility
      });
    }

    // ===============================
    // Response
    // ===============================
    return res.status(200).json({
      success: true,
      cartItems,
      subtotal,
      totalItems: cartItems.length,
      appliedVoucher,        // null or voucher object
      availableVouchers
    });

  } catch (error) {
    console.error("Cart Fetch Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch cart details"
    });
  }
});

// =====================================================
//  POST /api/cart/guest-cart
//  No auth required.
//  Body: { items: [ { productId, quantity }, ... ] }
//  Returns same shape as GET /api/cart/cart
//  (cartItems, subtotal, totalItems, availableVouchers)
//  but availableVouchers is always [] for guests
// =====================================================

router.post("/guest-cart", async (req, res) => {
  try {
    const { items } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(200).json({
        success: true,
        cartItems: [],
        subtotal: 0,
        totalItems: 0,
        availableVouchers: [],
      });
    }

    // ── fetch products ────────────────────────────
    const productIds = items.map((i) => i.productId);

    const products = await Product.find({
      _id: { $in: productIds },
    });

    const productMap = {};
    products.forEach((p) => {
      productMap[p._id.toString()] = p;
    });

    // ── build cart items ──────────────────────────
    let subtotal = 0;

    const cartItems = items
      .map((item) => {
        const product = productMap[item.productId?.toString()];
        if (!product) return null; // product not found / deleted

        const quantity = Math.max(1, Number(item.quantity) || 1);

        // cap at available stock
        const safeQty = Math.min(quantity, product.stock ?? Infinity);

        const discountAmount =
          (product.originalPrice || 0) - (product.sellingPrice || 0);

        const discountPercent =
          product.originalPrice > 0
            ? Math.round((discountAmount / product.originalPrice) * 100)
            : 0;

        const lineTotal = product.sellingPrice * safeQty;
        subtotal += lineTotal;

        return {
          productId: product._id,
          quantity: safeQty,

          name: product.name,
          image:
            product.images && product.images.length
              ? product.images[0]
              : "",

          stock: product.stock,
          country: product.country,

          sellingPrice: product.sellingPrice,
          originalPrice: product.originalPrice,

          discountAmount,
          discountPercent,

          lineTotal,
        };
      })
      .filter(Boolean);

    return res.status(200).json({
      success: true,
      cartItems,
      subtotal,
      totalItems: cartItems.length,
      availableVouchers: [], // guests don't get vouchers
    });
  } catch (error) {
    console.error("Guest Cart Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch guest cart details",
    });
  }
});


router.delete("/remove", auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { productId } = req.body;

    if (!productId) {
      return res.status(400).json({
        success: false,
        message: "Product ID is required",
      });
    }

    const cart = await Cart.findOne({ userId });

    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Cart not found",
      });
    }

    const initialItemCount = cart.items.length;

    // Remove the product
    cart.items = cart.items.filter(
      (item) => item.productId.toString() !== productId.toString()
    );

    if (cart.items.length === initialItemCount) {
      return res.status(404).json({
        success: false,
        message: "Product not found in cart",
      });
    }

    // Reset applied offers
    cart.appliedVoucher = null;
    cart.appliedBanner = null;

    // Recalculate totals if method exists
    if (typeof cart.recalculatePricing === "function") {
      cart.recalculatePricing();
    }

    await cart.save();

    return res.status(200).json({
      success: true,
      message: "Product removed from cart successfully",
      data: cart,
    });

  } catch (error) {
    console.error("Delete Cart Item Error:", error);

    return res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
});


router.put("/update", auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { productId, quantity } = req.body;

    if (!productId || quantity === undefined) {
      return res.status(400).json({
        success: false,
        message: "Product ID and quantity are required",
      });
    }

    if (quantity < 1) {
      return res.status(400).json({
        success: false,
        message: "Quantity must be at least 1",
      });
    }

    const cart = await Cart.findOne({ userId });

    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Cart not found",
      });
    }

    const item = cart.items.find(
      (item) => item.productId.toString() === productId.toString()
    );

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Product not found in cart",
      });
    }

    // Update quantity
    item.quantity = Number(quantity);

    // Reset offers because totals may change
    cart.appliedVoucher = null;
    cart.appliedBanner = null;

    // Recalculate totals
    if (typeof cart.recalculatePricing === "function") {
      cart.recalculatePricing();
    }

    await cart.save();

    return res.status(200).json({
      success: true,
      message: "Quantity updated successfully",
      data: cart,
    });

  } catch (error) {
    console.error("Update Quantity Error:", error);

    return res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
});


router.post("/apply-voucher", auth, async (req, res) => {
  try {
    const { voucherCode } = req.body;

    if (!voucherCode) {
      return res.status(400).json({ success: false, message: "Voucher code is required" });
    }

    // ── fetch cart ────────────────────────────────
    const cart = await Cart.findOne({ userId: req.user.id });
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ success: false, message: "Your cart is empty" });
    }

    // ── fetch products to get subtotal ────────────
    const productIds = cart.items.map((i) => i.productId);
    const products   = await Product.find({ _id: { $in: productIds } });
    const productMap = {};
    products.forEach((p) => { productMap[p._id.toString()] = p; });

    let subtotal = 0;
    const cartItems = cart.items
      .map((item) => {
        const product = productMap[item.productId.toString()];
        if (!product) return null;
        const lineTotal = product.sellingPrice * item.quantity;
        subtotal += lineTotal;
        return { productId: product._id, product, quantity: item.quantity, lineTotal };
      })
      .filter(Boolean);

    // ── find & validate voucher ───────────────────
    const now     = new Date();
    const voucher = await Voucher.findOne({
      code:      voucherCode.trim().toUpperCase(),
      isActive:  true,
      deletedAt: null,
      startDate: { $lte: now },
      endDate:   { $gte: now },
    });

    if (!voucher) {
      return res.status(404).json({ success: false, message: "Invalid or expired voucher code" });
    }

    // ── minimum order check ───────────────────────
    if (subtotal < voucher.minOrderValue) {
      return res.status(400).json({
        success: false,
        message: `Minimum order value of ₹${voucher.minOrderValue} required for this voucher`,
      });
    }

    // ── applicability check ───────────────────────
    let applicable = false;
    for (const { product } of cartItems) {
      // country match
      if (voucher.country && product.country && voucher.country !== product.country) continue;

      if (voucher.appliesTo === "all") {
        applicable = true;
      } else if (voucher.appliesTo === "product") {
        applicable = voucher.applicableProductIds.some(
          (id) => id.toString() === product._id.toString()
        );
      } else if (voucher.appliesTo === "category") {
        applicable = voucher.applicableCategories.some(
          (c) => c.trim().toLowerCase() === product.category.trim().toLowerCase()
        );
      }
      if (applicable) break;
    }

    if (!applicable) {
      return res.status(400).json({
        success: false,
        message: "This voucher is not applicable for items in your cart",
      });
    }

    // ── calculate discount amount ─────────────────
    let discountAmount = 0;
    if (voucher.discountType === "flat") {
      discountAmount = voucher.discount;
    } else if (voucher.discountType === "percent") {
      discountAmount = Math.round((subtotal * voucher.discount) / 100);
      if (voucher.maxDiscountAmount) {
        discountAmount = Math.min(discountAmount, voucher.maxDiscountAmount);
      }
    }
    discountAmount = Math.min(discountAmount, subtotal); // can't exceed subtotal

    // ── save voucher to cart ──────────────────────
    cart.appliedVoucher = {
      voucherId:      voucher._id,
      voucherName:    voucher.code,
      discountAmount,
    };
    await cart.save();

    return res.status(200).json({
      success: true,
      message: `Voucher "${voucher.code}" applied successfully!`,
      appliedVoucher: {
        voucherId:      voucher._id,
        code:           voucher.code,
        title:          voucher.title,
        discountType:   voucher.discountType,
        discount:       voucher.discount,
        discountAmount,
      },
      subtotal,
      finalTotal: subtotal - discountAmount,
    });
  } catch (error) {
    console.error("Apply Voucher Error:", error);
    return res.status(500).json({ success: false, message: "Failed to apply voucher" });
  }
});


// =====================================================
//  DELETE /api/cart/remove-voucher
//  Clears appliedVoucher from cart
// =====================================================

router.delete("/remove-voucher", auth, async (req, res) => {
  try {
    const cart = await Cart.findOne({ userId: req.user.id });
    if (!cart) {
      return res.status(404).json({ success: false, message: "Cart not found" });
    }

    cart.appliedVoucher = {
      voucherId:      null,
      voucherName:    null,
      discountAmount: 0,
    };
    await cart.save();

    return res.status(200).json({
      success: true,
      message: "Voucher removed successfully",
    });
  } catch (error) {
    console.error("Remove Voucher Error:", error);
    return res.status(500).json({ success: false, message: "Failed to remove voucher" });
  }
});
module.exports = router;