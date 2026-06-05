

const express = require("express");
const router = express.Router();

const Cart = require("../models/Cart");
const { auth } = require('../middleware/auth');
const BuyNow = require('../models/BuyNow')
const Product = require("../models/Product");
const Voucher = require("../models/Voucher");

router.post("/checkout-from-cart", auth, async (req, res) => {
  try {
    const userId = req.user.id;
    console.log("BODY RECEIVED");
console.log(req.body);

    const {
      items: bodyItems    = null,
      voucherId           = null,
      voucherName         = null,
      discountAmount      = 0
    } = req.body;

    // ===============================
    // Save to BuyNow model
    // ===============================
    const buyNowData = {
      userId,
      items: bodyItems && bodyItems.length > 0
        ? bodyItems.map(item => ({
            productId: item.productId,
            quantity:  item.quantity
          }))
        : null,  // will be filled below from existing BuyNow
      appliedVoucher: { voucherId, voucherName, discountAmount }
    };
    console.log(buyNowData)

    // If no bodyItems, read existing BuyNow items
    if (!buyNowData.items) {
      const existing = await BuyNow.findOne({ userId });
      if (!existing || existing.items.length === 0) {
        return res.status(400).json({
          success: false,
          message: "No checkout data found"
        });
      }
      buyNowData.items = existing.items.map(item => ({
        productId: item.productId,
        quantity:  item.quantity
      }));
    }

    // Save/update BuyNow
    await BuyNow.findOneAndUpdate(
      { userId },
      buyNowData,
      { new: true, upsert: true, runValidators: true }
    );

    // ===============================
    // Now read back and enrich
    // (same as cart GET route)
    // ===============================
    const buyNow = await BuyNow.findOne({ userId });

    const productIds = buyNow.items.map(item => item.productId);

    const products = await Product.find({
      _id: { $in: productIds }
    });

    const productMap = {};
    products.forEach(p => {
      productMap[p._id.toString()] = p;
    });

    // ===============================
    // Build cartItems + subtotal
    // ===============================
    let subtotal = 0;

    const cartItems = buyNow.items.map(item => {
      const product = productMap[item.productId.toString()];
      if (!product) return null;

      const discountAmount  = product.originalPrice - product.sellingPrice;
      const discountPercent = product.originalPrice > 0
        ? Math.round((discountAmount / product.originalPrice) * 100)
        : 0;

      const lineTotal = product.sellingPrice * item.quantity;
      subtotal += lineTotal;

      return {
        productId:     product._id,
        quantity:      item.quantity,
        name:          product.name,
        image:         product.images && product.images.length ? product.images[0] : "",
        stock:         product.stock,
        country:       product.country,
        sellingPrice:  product.sellingPrice,
        originalPrice: product.originalPrice,
        discountAmount,
        discountPercent,
        lineTotal
      };
    }).filter(Boolean);

    // ===============================
    // Resolve Applied Voucher
    // ===============================
    let appliedVoucher = null;

    if (voucherId) {
      const now     = new Date();
      const voucher = await Voucher.findOne({
        _id:       voucherId,
        isActive:  true,
        deletedAt: null,
        startDate: { $lte: now },
        endDate:   { $gte: now }
      });

      if (voucher) {
        let calculatedDiscount = 0;

        if (voucher.discountType === "flat") {
          calculatedDiscount = voucher.discount;
        } else if (voucher.discountType === "percent") {
          calculatedDiscount = Math.round((subtotal * voucher.discount) / 100);
          if (voucher.maxDiscountAmount) {
            calculatedDiscount = Math.min(calculatedDiscount, voucher.maxDiscountAmount);
          }
        }

        calculatedDiscount = Math.min(calculatedDiscount, subtotal);

        appliedVoucher = {
          voucherId:         voucher._id,
          code:              voucher.code,
          title:             voucher.title,
          discountType:      voucher.discountType,
          discount:          voucher.discount,
          maxDiscountAmount: voucher.maxDiscountAmount,
          discountAmount:    calculatedDiscount
        };

        // Update BuyNow with recalculated discount
        await BuyNow.findOneAndUpdate(
          { userId },
          { "appliedVoucher.discountAmount": calculatedDiscount },
          { new: true }
        );
      }
    }

    // ===============================
    // Available Vouchers
    // ===============================
    const now      = new Date();
    const vouchers = await Voucher.find({
      isActive:  true,
      deletedAt: null,
      startDate: { $lte: now },
      endDate:   { $gte: now }
    });

    const availableVouchers = [];

    for (const voucher of vouchers) {
      let applicable = false;

      for (const item of cartItems) {
        const product = productMap[item.productId.toString()];
        if (!product) continue;

        if (voucher.country && product.country && voucher.country !== product.country) continue;

        if (voucher.appliesTo === "all") {
          applicable = true;
        } else if (voucher.appliesTo === "product") {
          const matched = voucher.applicableProductIds.some(
            id => id.toString() === product._id.toString()
          );
          if (matched) applicable = true;
        } else if (voucher.appliesTo === "category") {
          const matched = voucher.applicableCategories.some(
            cat => cat.trim().toLowerCase() === product.category.trim().toLowerCase()
          );
          if (matched) applicable = true;
        }

        if (applicable) break;
      }

      if (!applicable) continue;
      if (subtotal < voucher.minOrderValue) continue;

      availableVouchers.push({
        _id:               voucher._id,
        code:              voucher.code,
        title:             voucher.title,
        description:       voucher.description,
        discountType:      voucher.discountType,
        discount:          voucher.discount,
        maxDiscountAmount: voucher.maxDiscountAmount,
        minOrderValue:     voucher.minOrderValue,
        country:           voucher.country,
        appliesTo:         voucher.appliesTo,
        eligibility:       voucher.eligibility
      });
    }

    // ===============================
    // Response
    // ===============================
    return res.status(200).json({
      success:           true,
      message:           "Checkout data prepared successfully",
      cartItems,
      subtotal,
      totalItems:        cartItems.length,
      appliedVoucher,
      availableVouchers
    });

  } catch (error) {
    console.error("Checkout From Cart Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error"
    });
  }
});


router.get("/checkout-from-cart", auth, async (req, res) => {
  try {

    const buyNow = await BuyNow.findOne({
      userId: req.user.id
    });

    if (!buyNow || buyNow.items.length === 0) {
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
    const productIds = buyNow.items.map(
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
    // Build Items + Subtotal
    // ===============================
    let subtotal = 0;

    const cartItems = buyNow.items
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
                  product.originalPrice) * 100
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
    // Applied Voucher
    // ===============================
    let appliedVoucher = null;

    if (
      buyNow.appliedVoucher &&
      buyNow.appliedVoucher.voucherId
    ) {

      const voucher = await Voucher.findById(
        buyNow.appliedVoucher.voucherId
      );

      if (voucher) {

        let calculatedDiscount = 0;

        if (voucher.discountType === "flat") {

          calculatedDiscount =
            voucher.discount;

        } else if (
          voucher.discountType === "percent"
        ) {

          calculatedDiscount =
            Math.round(
              (subtotal *
                voucher.discount) / 100
            );

          if (
            voucher.maxDiscountAmount
          ) {
            calculatedDiscount =
              Math.min(
                calculatedDiscount,
                voucher.maxDiscountAmount
              );
          }
        }

        calculatedDiscount =
          Math.min(
            calculatedDiscount,
            subtotal
          );

        appliedVoucher = {
          voucherId:
            voucher._id,

          code:
            voucher.code,

          title:
            voucher.title,

          discountType:
            voucher.discountType,

          discount:
            voucher.discount,

          maxDiscountAmount:
            voucher.maxDiscountAmount,

          discountAmount:
            calculatedDiscount
        };
      }
    }

    // ===============================
    // Available Vouchers
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
          productMap[
            item.productId.toString()
          ];

        if (!product) continue;

        if (
          voucher.country &&
          product.country &&
          voucher.country !==
            product.country
        ) {
          continue;
        }

        if (
          voucher.appliesTo === "all"
        ) {
          applicable = true;
        }

        else if (
          voucher.appliesTo === "product"
        ) {

          const matched =
            voucher.applicableProductIds.some(
              id =>
                id.toString() ===
                product._id.toString()
            );

          if (matched) {
            applicable = true;
          }
        }

        else if (
          voucher.appliesTo === "category"
        ) {

          const matched =
            voucher.applicableCategories.some(
              category =>
                category
                  .trim()
                  .toLowerCase() ===
                product.category
                  .trim()
                  .toLowerCase()
            );

          if (matched) {
            applicable = true;
          }
        }

        if (applicable) break;
      }

      if (!applicable) continue;

      if (
        subtotal <
        voucher.minOrderValue
      ) {
        continue;
      }

      availableVouchers.push({
        _id: voucher._id,
        code: voucher.code,
        title: voucher.title,
        description:
          voucher.description,

        discountType:
          voucher.discountType,

        discount:
          voucher.discount,

        maxDiscountAmount:
          voucher.maxDiscountAmount,

        minOrderValue:
          voucher.minOrderValue,

        country:
          voucher.country,

        appliesTo:
          voucher.appliesTo,

        eligibility:
          voucher.eligibility
      });
    }

    return res.status(200).json({
      success: true,
      cartItems,
      subtotal,
      totalItems: cartItems.length,
      appliedVoucher,
      availableVouchers
    });

  } catch (error) {

    console.error(
      "Checkout Fetch Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to fetch checkout details"
    });
  }
});


router.post("/apply-voucher", auth, async (req, res) => {
  try {
    const { voucherCode } = req.body;

    if (!voucherCode) {
      return res.status(400).json({
        success: false,
        message: "Voucher code is required"
      });
    }

    const buyNow = await BuyNow.findOne({
      userId: req.user.id
    });

    if (!buyNow || buyNow.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No checkout items found"
      });
    }

    const productIds = buyNow.items.map(
      item => item.productId
    );

    const products = await Product.find({
      _id: { $in: productIds }
    });

    const productMap = {};

    products.forEach(product => {
      productMap[product._id.toString()] = product;
    });

    let subtotal = 0;

    const checkoutItems = buyNow.items.map(item => {
      const product =
        productMap[item.productId.toString()];

      if (!product) return null;

      const lineTotal =
        product.sellingPrice * item.quantity;

      subtotal += lineTotal;

      return {
        product,
        quantity: item.quantity,
        lineTotal
      };
    }).filter(Boolean);

    const now = new Date();

    const voucher = await Voucher.findOne({
      code: voucherCode.trim().toUpperCase(),
      isActive: true,
      deletedAt: null,
      startDate: { $lte: now },
      endDate: { $gte: now }
    });

    if (!voucher) {
      return res.status(404).json({
        success: false,
        message: "Invalid or expired voucher"
      });
    }

    if (subtotal < voucher.minOrderValue) {
      return res.status(400).json({
        success: false,
        message: `Minimum order value of ₹${voucher.minOrderValue} required`
      });
    }

    let applicable = false;

    for (const item of checkoutItems) {

      const product = item.product;

      if (
        voucher.country &&
        product.country &&
        voucher.country !== product.country
      ) {
        continue;
      }

      if (voucher.appliesTo === "all") {
        applicable = true;
      }

      else if (
        voucher.appliesTo === "product"
      ) {
        applicable =
          voucher.applicableProductIds.some(
            id =>
              id.toString() ===
              product._id.toString()
          );
      }

      else if (
        voucher.appliesTo === "category"
      ) {
        applicable =
          voucher.applicableCategories.some(
            category =>
              category.trim().toLowerCase() ===
              product.category.trim().toLowerCase()
          );
      }

      if (applicable) break;
    }

    if (!applicable) {
      return res.status(400).json({
        success: false,
        message:
          "Voucher is not applicable for checkout items"
      });
    }

    let discountAmount = 0;

    if (voucher.discountType === "flat") {
      discountAmount = voucher.discount;
    }

    else if (
      voucher.discountType === "percent"
    ) {

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

    discountAmount = Math.min(
      discountAmount,
      subtotal
    );

    buyNow.appliedVoucher = {
      voucherId: voucher._id,
      voucherName: voucher.code,
      discountAmount
    };

    await buyNow.save();

    return res.status(200).json({
      success: true,
      message: "Voucher applied successfully",
      appliedVoucher: {
        voucherId: voucher._id,
        code: voucher.code,
        title: voucher.title,
        discountType: voucher.discountType,
        discount: voucher.discount,
        discountAmount
      },
      subtotal,
      finalTotal:
        subtotal - discountAmount
    });

  } catch (error) {

    console.error(
      "BuyNow Apply Voucher Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to apply voucher"
    });
  }
});

router.delete("/remove-voucher", auth, async (req, res) => {
  try {

    const buyNow = await BuyNow.findOne({
      userId: req.user.id
    });

    if (!buyNow) {
      return res.status(404).json({
        success: false,
        message: "Checkout session not found"
      });
    }

    buyNow.appliedVoucher = {
      voucherId: null,
      voucherName: null,
      discountAmount: 0
    };

    await buyNow.save();

    return res.status(200).json({
      success: true,
      message: "Voucher removed successfully"
    });

  } catch (error) {

    console.error(
      "BuyNow Remove Voucher Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to remove voucher"
    });
  }
});

module.exports = router;