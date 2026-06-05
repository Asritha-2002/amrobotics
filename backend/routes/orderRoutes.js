const express  = require("express");
const router   = express.Router();
const Order    = require("../models/Order");
const Product  = require("../models/Product");
const BuyNow   = require("../models/BuyNow");
const Voucher  = require("../models/Voucher");
const { auth } = require("../middleware/auth");
const Cart = require("../models/Cart");
// ── POST /api/orders/create ───────────────────────────────────────────────────
router.post("/orders/create", auth, async (req, res) => {
  try {
    const {
      shippingAddress,
      paymentMethod,
      shippingMethod,
      paypalOrderId,
      charges,
      appliedVoucher,
      items: requestItems,
    } = req.body;

    // ── 1. Get items ──────────────────────────────────────────────────────────
    let orderItems = [];

    if (requestItems && requestItems.length > 0) {

      const productIds = requestItems.map(i => i.productId);
      const products   = await Product.find({
        _id:    { $in: productIds },
        status: "active"
      }).select("name sku brand category country images sellingPrice originalPrice stock status");

      const productMap = {};
      products.forEach(p => { productMap[p._id.toString()] = p; });

      for (const item of requestItems) {
        const product = productMap[item.productId?.toString()];

        if (!product) {
          return res.status(400).json({
            success: false,
            message: `Product "${item.name || item.productId}" is no longer available.`
          });
        }

        if (product.stock < item.quantity) {
          return res.status(400).json({
            success: false,
            message: `"${product.name}" only has ${product.stock} units left. You requested ${item.quantity}.`
          });
        }

        const sellingPrice  = product.sellingPrice;
        const originalPrice = product.originalPrice;
        const discountPct   = originalPrice > sellingPrice
          ? Math.round(((originalPrice - sellingPrice) / originalPrice) * 100)
          : 0;

        orderItems.push({
          productId:       product._id,
          name:            product.name,
          sku:             product.sku         || "",
          brand:           product.brand       || "",
          category:        product.category    || "",
          country:         product.country     || "",
          image:           product.images?.[0] || "",
          quantity:        item.quantity,
          sellingPrice,
          originalPrice,
          discountPercent: discountPct,
          lineTotal:       sellingPrice * item.quantity,
        });
      }

    } else {

      const buyNow = await BuyNow.findOne({ userId: req.user.id })
        .populate({
          path:   "items.productId",
          select: "name sku brand category country images sellingPrice originalPrice stock status"
        });

      if (!buyNow || !buyNow.items || buyNow.items.length === 0) {
        return res.status(400).json({
          success: false,
          message: "No items found in checkout. Please go back to cart."
        });
      }

      for (const item of buyNow.items) {
        const product = item.productId;
        if (!product) continue;

        if (product.stock < item.quantity) {
          return res.status(400).json({
            success: false,
            message: `"${product.name}" only has ${product.stock} units left.`
          });
        }

        const sellingPrice  = product.sellingPrice;
        const originalPrice = product.originalPrice;
        const discountPct   = originalPrice > sellingPrice
          ? Math.round(((originalPrice - sellingPrice) / originalPrice) * 100)
          : 0;

        orderItems.push({
          productId:       product._id,
          name:            product.name,
          sku:             product.sku         || "",
          brand:           product.brand       || "",
          category:        product.category    || "",
          country:         product.country     || "",
          image:           product.images?.[0] || "",
          quantity:        item.quantity,
          sellingPrice,
          originalPrice,
          discountPercent: discountPct,
          lineTotal:       sellingPrice * item.quantity,
        });
      }
    }

    if (orderItems.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid items to order."
      });
    }

    // ── 2. Calculate pricing ──────────────────────────────────────────────────
    const subtotal        = orderItems.reduce((s, i) => s + i.lineTotal, 0);
    const mrpTotal        = orderItems.reduce((s, i) => s + (i.originalPrice * i.quantity), 0);
    const mrpSavings      = mrpTotal - subtotal;
    const voucherDiscount = appliedVoucher?.discountAmount || 0;
    const deliveryCharge  = charges?.deliveryCharge || 0;
    const gstAmount       = charges?.gstAmount       || 0;
    const total           = Math.max(0, subtotal - voucherDiscount + deliveryCharge + gstAmount);

    // ── 3. Build shipping address ─────────────────────────────────────────────
    const shipping = shippingAddress || {};
    const finalShippingAddress = {
      firstName:  shipping.firstName  || "",
      lastName:   shipping.lastName   || "",
      email:      shipping.email      || "",
      phone:      shipping.phone      || "",
      address1:   shipping.address1   || shipping.street    || "",
      address2:   shipping.address2   || shipping.apartment || "",
      city:       shipping.city       || "",
      state:      shipping.state      || "",
      postalCode: shipping.postalCode || shipping.zipCode   || "",
      country:    shipping.country    || "India",
    };

    // ── 4. Create order ───────────────────────────────────────────────────────
    const methodMap = {
      "paypal": "paypal", "PayPal": "paypal",
      "cod":    "cod",    "COD":    "cod",
      "bank_transfer": "bank_transfer",
    };

    const order = new Order({
      userId: req.user.id,
      items:  orderItems,
      shippingAddress: finalShippingAddress,
      pricing: {
        subtotal, mrpTotal, mrpSavings,
        voucherDiscount, deliveryCharge, gstAmount, total,
      },
      appliedVoucher: appliedVoucher?.voucherId
        ? {
            voucherId:      appliedVoucher.voucherId,
            code:           appliedVoucher.code           || "",
            discountAmount: appliedVoucher.discountAmount || 0,
          }
        : { voucherId: null, code: "", discountAmount: 0 },
      payment: {
        method:        methodMap[paymentMethod] || "paypal",
        status:        paypalOrderId ? "paid" : "pending",
        paypalOrderId: paypalOrderId || null,
        currency:      "INR",
        paidAmount:    paypalOrderId ? total : 0,
        paidAt:        paypalOrderId ? new Date() : null,
      },
      status: paypalOrderId ? "confirmed" : "pending",
      delivery: {
        trackingUpdates: [{
          status:      "order_placed",
          description: "Your order has been placed successfully.",
          timestamp:   new Date(),
        }]
      },
      meta: { source: "web" }
    });

    await order.save();

    // ── 5. Deduct stock ───────────────────────────────────────────────────────
    await Promise.all(
      orderItems.map(item =>
        Product.findByIdAndUpdate(item.productId, { $inc: { stock: -item.quantity } })
      )
    );

    // ── 6. Increment voucher usage ────────────────────────────────────────────
    if (appliedVoucher?.voucherId) {
      await Voucher.findByIdAndUpdate(
        appliedVoucher.voucherId,
        {
          $inc:  { usedCount: 1 },
          $push: {
            usageLog: {
              userId:         req.user.id,
              orderId:        order._id,
              discountAmount: appliedVoucher.discountAmount || 0,
              usedAt:         new Date(),
            }
          }
        }
      );
    }

    // ── 7. Remove Cart if all items match ordered products ────────────────────
const orderedProductIds = orderItems.map(i => i.productId.toString());

const userCart = await Cart.findOne({ userId: req.user.id });

if (userCart && userCart.items.length > 0) {

  const allMatch = userCart.items.every(
    cartItem => orderedProductIds.includes(cartItem.productId.toString())
  );

  if (allMatch) {
    // Every product in cart was ordered — delete entire cart document
    await Cart.findOneAndDelete({ userId: req.user.id });
  } else {
    // Only some products matched — pull only the ordered ones
    await Cart.findOneAndUpdate(
      { userId: req.user.id },
      {
        $pull: {
          items: {
            productId: { $in: orderItems.map(i => i.productId) }
          }
        }
      }
    );
  }
}

    // ── 8. Remove entire BuyNow record for this user ──────────────────────────
    await BuyNow.findOneAndDelete({ userId: req.user.id });

    // ── 9. Response ───────────────────────────────────────────────────────────
    return res.status(201).json({
      success: true,
      message: "Order placed successfully!",
      order: {
        _id:    order._id,
        status: order.status,
        total:  order.pricing.total,
        items:  order.items.length,
      }
    });

  } catch (err) {
    console.error("[POST /orders/create]", err);
    return res.status(500).json({
      success: false,
      message: err.message || "Something went wrong"
    });
  }
});

module.exports = router;