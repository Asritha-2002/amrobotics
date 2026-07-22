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