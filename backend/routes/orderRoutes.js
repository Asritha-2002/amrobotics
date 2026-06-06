const express  = require("express");
const router   = express.Router();
const Order    = require("../models/Order");
const Product  = require("../models/Product");
const BuyNow   = require("../models/BuyNow");
const Voucher  = require("../models/Voucher");
const { auth, adminAuth } = require("../middleware/auth");
const Cart = require("../models/Cart");
const { sendOrderStatusEmail } = require("../config/email");
const User = require("../models/User");
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


router.get("/all-orders", auth, adminAuth, async (req, res) => {
  try {

    const orders = await Order.find({
      status: { $ne: "pending" }
    })
      .populate("userId", "name email profilePic mobilenum")
      .sort({ createdAt: -1 })
      .lean();

    const formattedOrders = orders.map(order => ({
      _id:            order._id,
      createdAt:      order.createdAt,
      updatedAt:      order.updatedAt,
      status:         order.status,

      // ── User ───────────────────────────────
      user: order.userId ? {
        _id:        order.userId._id,
        name:       order.userId.name,
        email:      order.userId.email,
        profilePic: order.userId.profilePic || "",
        mobilenum:  order.userId.mobilenum  || "",
      } : null,

      // ── Items ──────────────────────────────
      items: order.items || [],
      totalItems: (order.items || []).reduce(
        (acc, item) => acc + (item.quantity || 0), 0
      ),

      // ── Shipping Address ───────────────────
      shippingAddress: order.shippingAddress || {},

      // ── Pricing ────────────────────────────
      pricing: {
        subtotal:        order.pricing?.subtotal        || 0,
        mrpTotal:        order.pricing?.mrpTotal        || 0,
        mrpSavings:      order.pricing?.mrpSavings      || 0,
        voucherDiscount: order.pricing?.voucherDiscount || 0,
        deliveryCharge:  order.pricing?.deliveryCharge  || 0,
        gstAmount:       order.pricing?.gstAmount       || 0,
        total:           order.pricing?.total           || 0,
      },
      totalAmount: order.pricing?.total || 0,   // shorthand for table display

      // ── Applied Voucher ────────────────────
      appliedVoucher: {
        voucherId:      order.appliedVoucher?.voucherId      || null,
        code:           order.appliedVoucher?.code           || "",
        discountAmount: order.appliedVoucher?.discountAmount || 0,
      },

      // ── Payment ────────────────────────────
      payment: {
        method:          order.payment?.method          || "paypal",
        status:          order.payment?.status          || "pending",
        paypalOrderId:   order.payment?.paypalOrderId   || null,
        paypalCaptureId: order.payment?.paypalCaptureId || null,
        paypalPayerId:   order.payment?.paypalPayerId   || null,
        currency:        order.payment?.currency        || "INR",
        paidAmount:      order.payment?.paidAmount      || 0,
        paidAt:          order.payment?.paidAt          || null,
      },

      // ── Delivery & Tracking ────────────────
      delivery: {
        partnerName:       order.delivery?.partnerName       || "",
        trackingId:        order.delivery?.trackingId        || "",
        estimatedDelivery: order.delivery?.estimatedDelivery || null,
        currentLocation:   order.delivery?.currentLocation   || "",
        trackingUpdates:   order.delivery?.trackingUpdates   || [],
      },
      latestTracking: order.delivery?.trackingUpdates?.length
        ? order.delivery.trackingUpdates[order.delivery.trackingUpdates.length - 1]
        : null,

      // ── Cancellation ───────────────────────
      cancellation: {
        reason:      order.cancellation?.reason      || null,
        notes:       order.cancellation?.notes       || "",
        cancelledAt: order.cancellation?.cancelledAt || null,
        cancelledBy: order.cancellation?.cancelledBy || null,
      },

      // ── Refund ─────────────────────────────
      refund: {
        reason:        order.refund?.reason        || null,
        notes:         order.refund?.notes         || "",
        refundAmount:  order.refund?.refundAmount  || 0,
        referenceId:   order.refund?.referenceId   || "",
        processedAt:   order.refund?.processedAt   || null,
        processedBy:   order.refund?.processedBy   || null,
      },

      // ── Meta ───────────────────────────────
      meta: {
        source:     order.meta?.source     || "web",
        notes:      order.meta?.notes      || "",
        invoiceUrl: order.meta?.invoiceUrl || "",
      },
    }));

    return res.status(200).json({
      success: true,
      count:   formattedOrders.length,
      orders:  formattedOrders,
    });

  } catch (error) {
    console.error("Error fetching orders:", error);
    return res.status(500).json({
      success:  false,
      message:  error.message || "Failed to fetch orders",
    });
  }
});

router.get("/order-status-counts", auth, adminAuth, async (req, res) => {
  try {

    const [statusAgg, revenueAgg] = await Promise.all([

      // ── Status counts ──────────────────────────
      Order.aggregate([
        { $match: { status: { $ne: "pending" } } },
        { $group: { _id: "$status", count: { $sum: 1 } } }
      ]),

      // ── Total revenue (paid orders only) ───────
      Order.aggregate([
        {
          $match: {
            "payment.status": "paid",
            status: { $ne: "pending" }
          }
        },
        {
          $group: {
            _id:          null,
            totalRevenue: { $sum: "$pricing.total" },
            totalOrders:  { $sum: 1 },
          }
        }
      ])

    ]);

    // ── Default counts matching your schema enum ─
    const statusCounts = {
      confirmed:        0,
      processing:       0,
      shipped:          0,
      out_for_delivery: 0,
      delivered:        0,
      cancelled:        0,
      return_requested: 0,
      returned:         0,
      refund_initiated: 0,
      refund_completed: 0,
      totalOrders:      0,
    };

    statusAgg.forEach(item => {
      if (statusCounts.hasOwnProperty(item._id)) {
        statusCounts[item._id] = item.count;
      }
      statusCounts.totalOrders += item.count;
    });

    const totalRevenue = revenueAgg[0]?.totalRevenue || 0;
    const paidOrders   = revenueAgg[0]?.totalOrders  || 0;

    return res.status(200).json({
      success: true,
      counts: {
        ...statusCounts,
        totalRevenue,   // sum of pricing.total for all paid orders
        paidOrders,     // count of paid orders
      }
    });

  } catch (error) {
    console.error("Error fetching order status counts:", error);
    return res.status(500).json({
      success:  false,
      message:  error.message || "Failed to fetch order counts",
    });
  }
});

router.patch("/:orderId/status", auth, adminAuth, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status, shippingDetails, cancellationDetails, refundDetails } = req.body;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    order.status = status;

    // ── Shipped ───────────────────────────────────────────────────────────────
    if (status === "shipped") {
      if (!shippingDetails?.name || !shippingDetails?.trackingId) {
        return res.status(400).json({
          success: false,
          message: "Shipping partner name and tracking ID are required",
        });
      }

      order.delivery.partnerName       = shippingDetails.name;
      order.delivery.trackingId        = shippingDetails.trackingId;
      order.delivery.estimatedDelivery = shippingDetails.estimatedDelivery
        ? new Date(shippingDetails.estimatedDelivery)
        : null;

      order.delivery.trackingUpdates.push({
        status:      "shipped",
        location:    "Order Shipped",
        description: `Shipped via ${shippingDetails.name}. Tracking: ${shippingDetails.trackingId}`,
        timestamp:   new Date(),
      });
    }

    // ── Delivered ─────────────────────────────────────────────────────────────
    if (status === "delivered") {
      order.delivery.trackingUpdates.push({
        status:      "delivered",
        location:    "Delivered",
        description: "Order delivered successfully",
        timestamp:   new Date(),
      });
    }

    // ── Cancelled ─────────────────────────────────────────────────────────────
    if (status === "cancelled") {
  if (!cancellationDetails?.reason) {
    return res.status(400).json({
      success: false,
      message: "Cancellation reason is required",
    });
  }

  order.cancellation.reason = cancellationDetails.reason;
  order.cancellation.notes = cancellationDetails.notes || "";
  order.cancellation.cancelledAt = new Date();
  order.cancellation.cancelledBy = req.user.id;

  // ================================
  // 🔁 RESTORE PRODUCT STOCK
  // ================================
  for (const item of order.items) {
    await Product.findByIdAndUpdate(
      item.productId,
      {
        $inc: { stock: item.quantity },
      }
    );
  }

  if (order.appliedVoucher?.voucherId) {
    await Voucher.findByIdAndUpdate(
      order.appliedVoucher.voucherId,
      {
        $pull: {
          usageLog: {
            userId: order.userId,
            orderId: order._id,
          },
        },
      }
    );
  }

  // ================================
  // OPTIONAL: mark order payment as cancelled
  // ================================
  order.payment.status = "cancelled";
}

    // ── Refund Completed ──────────────────────────────────────────────────────
    if (status === "refund_completed") {
      if (!refundDetails?.refundAmount || !refundDetails?.refundMethod) {
        return res.status(400).json({
          success: false,
          message: "Refund amount and refund method are required",
        });
      }

      order.refund.reason        = refundDetails.reason       || "other";
      order.refund.notes         = refundDetails.notes        || "";
      order.refund.refundAmount  = Number(refundDetails.refundAmount);
      order.refund.referenceId   = refundDetails.referenceId  || "";
      order.refund.processedAt   = refundDetails.processedDate
        ? new Date(refundDetails.processedDate)
        : new Date();
      order.refund.processedBy   = req.user.id;

      order.payment.status = "refunded";
    }

    await order.save();

    // ── Send status email (skip: out_for_delivery, return_requested, returned, refund_initiated) ──
    const emailStatuses = [
      "confirmed",
      "processing",
      "shipped",
      "delivered",
      "cancelled",
      "refund_completed",
    ];

    if (emailStatuses.includes(status)) {
      try {
        const user = await User.findById(order.userId);
        if (user?.email) {
          await sendOrderStatusEmail(user.email, order, status);
        }
      } catch (emailErr) {
        console.error("Status email failed:", emailErr.message);
      }
    }

    return res.status(200).json({
      success: true,
      message: "Order status updated successfully",
      order,
    });

  } catch (error) {
    console.error("Order status update error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to update order status",
    });
  }
});
module.exports = router;