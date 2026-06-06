const express = require("express");
const router = express.Router();

const User = require("../models/User");
const jwt = require("jsonwebtoken");
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const {validate}=require('../middleware/validate')
const {userSchemas} =require('../validation/schemas')
const { auth , adminAuth} = require('../middleware/auth');
const Order    = require("../models/Order");
const Product  = require("../models/Product");

// GET /api/admin/customers — returns all users (admin only)


router.get('/admin/customers', auth,adminAuth, async (req, res) => {
  try {
    // Optional: add admin check
    // if (!req.user.isAdmin) return res.status(403).json({ message: 'Forbidden' });

    const users = await User.find({isAdmin:false}, 
    
        {
      password: 0,          // never send password
      verificationToken: 0,
      resetPasswordToken: 0,
      resetPasswordExpires: 0
    }).sort({ createdAt: -1 });

    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// =====================================================
//  GET /api/admin/dashboard-stats
//  Auth: admin only
//  Returns all numbers needed by the dashboard:
//  - Revenue (total, today, last 7 days chart)
//  - Orders  (total, pending, delivered, cancelled)
//  - Products count
//  - Customers count
//  - Recent orders (last 5)
//  - Recent activity feed
// =====================================================

router.get("/admin/dashboard-stats", auth, adminAuth, async (req, res) => {
  try {

    // ── Date helpers ────────────────────────────────
    const now       = new Date();
    const todayStart = new Date(now); todayStart.setHours(0,0,0,0);
    const todayEnd   = new Date(now); todayEnd.setHours(23,59,59,999);

    // Last 7 days window (start of day 6 days ago → now)
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(now.getDate() - 6);
    sevenDaysAgo.setHours(0,0,0,0);

    // Last 30 days (for trend comparison)
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(now.getDate() - 30);

    // Previous 7-day window (for % trend)
    const prev7Start = new Date(sevenDaysAgo);
    prev7Start.setDate(prev7Start.getDate() - 7);
    const prev7End   = new Date(sevenDaysAgo);
    prev7End.setMilliseconds(-1);

    // ── Revenue stats ────────────────────────────────
    // Only count orders that are NOT cancelled / refunded
    const REVENUE_STATUSES = [
      "processing", "confirmed", "shipped",
      "delivered", "out_for_delivery"
    ];

    const [
      revenueAgg,
      prevRevenueAgg,
      todayRevenueAgg
    ] = await Promise.all([

      // Current 7-day revenue
      Order.aggregate([
        {
          $match: {
            status:     { $in: REVENUE_STATUSES },
            createdAt:  { $gte: sevenDaysAgo, $lte: now }
          }
        },
        {
          $group: {
            _id:     null,
            total:   { $sum: "$pricing.total" },
            count:   { $sum: 1 }
          }
        }
      ]),

      // Previous 7-day revenue (for trend %)
      Order.aggregate([
        {
          $match: {
            status:    { $in: REVENUE_STATUSES },
            createdAt: { $gte: prev7Start, $lte: prev7End }
          }
        },
        {
          $group: { _id: null, total: { $sum: "$pricing.total" } }
        }
      ]),

      // Today's revenue
      Order.aggregate([
        {
          $match: {
            status:    { $in: REVENUE_STATUSES },
            createdAt: { $gte: todayStart, $lte: todayEnd }
          }
        },
        {
          $group: { _id: null, total: { $sum: "$pricing.total" } }
        }
      ])
    ]);

    const currentRevenue  = revenueAgg[0]?.total    || 0;
    const previousRevenue = prevRevenueAgg[0]?.total || 0;
    const todayRevenue    = todayRevenueAgg[0]?.total || 0;

    // Revenue trend percentage
    let revenueTrend = 0;
    let revenueTrendDir = "flat";
    if (previousRevenue > 0) {
      revenueTrend = Math.round(((currentRevenue - previousRevenue) / previousRevenue) * 100);
      revenueTrendDir = revenueTrend > 0 ? "up" : revenueTrend < 0 ? "down" : "flat";
    } else if (currentRevenue > 0) {
      revenueTrend = 100;
      revenueTrendDir = "up";
    }

    // ── Revenue per day (last 7 days for chart) ──────
    const dailyRevenueAgg = await Order.aggregate([
      {
        $match: {
          status:    { $in: REVENUE_STATUSES },
          createdAt: { $gte: sevenDaysAgo, $lte: now }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
          },
          revenue: { $sum: "$pricing.total" },
          orders:  { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Build full 7-day array (fill missing days with 0)
    const dailyRevenue = [];
    for (let i = 6; i >= 0; i--) {
      const d    = new Date(now);
      d.setDate(now.getDate() - i);
      const key  = d.toISOString().split("T")[0];
      const day  = dailyRevenueAgg.find(r => r._id === key);
      const label = d.toLocaleDateString("en-IN", { weekday: "short" });
      dailyRevenue.push({
        date:    key,
        label,
        revenue: day?.revenue || 0,
        orders:  day?.orders  || 0
      });
    }

    // ── Order counts ─────────────────────────────────
    const [
      totalOrders,
      pendingOrders,
      deliveredOrders,
      cancelledOrders,
      todayOrders
    ] = await Promise.all([
      Order.countDocuments({}),
      Order.countDocuments({ status: { $in: ["processing", "confirmed", "payment_pending"] } }),
      Order.countDocuments({ status: "delivered" }),
      Order.countDocuments({ status: { $in: ["cancelled", "refund_completed"] } }),
      Order.countDocuments({ createdAt: { $gte: todayStart, $lte: todayEnd } })
    ]);

    // Orders trend (today vs yesterday)
    const yesterdayStart = new Date(todayStart); yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    const yesterdayEnd   = new Date(todayEnd);   yesterdayEnd.setDate(yesterdayEnd.getDate() - 1);
    const yesterdayOrders = await Order.countDocuments({
      createdAt: { $gte: yesterdayStart, $lte: yesterdayEnd }
    });

    let orderTrend = 0;
    let orderTrendDir = "flat";
    if (yesterdayOrders > 0) {
      orderTrend    = Math.round(((todayOrders - yesterdayOrders) / yesterdayOrders) * 100);
      orderTrendDir = orderTrend > 0 ? "up" : orderTrend < 0 ? "down" : "flat";
    }

    // ── Products & Customers ─────────────────────────
    // ── Products & Customers ─────────────────────────
const countryFilter = req.query.country; // "India" or "US"

const productQuery = {
  status: "active",
  stock:  { $gt: 0 },
  ...(countryFilter ? { country: countryFilter } : {})
};

const [totalProducts, totalCustomers] = await Promise.all([
  Product.countDocuments(productQuery),
  User.countDocuments({ isAdmin: false })
]);

    // ── Recent Orders (last 5) ────────────────────────
    const recentOrders = await Order.find({})
      .sort({ createdAt: -1 })
      .limit(5)
      .select(
        "_id userId items shippingAddress pricing.total status payment.method createdAt"
      )
      .lean();

    const recentOrdersFormatted = recentOrders.map(o => ({
      _id:       o._id,
      shortId:   o._id.toString().slice(-6).toUpperCase(),
      customer:  `${o.shippingAddress?.firstName || ""} ${o.shippingAddress?.lastName || ""}`.trim() || "Unknown",
      email:     o.shippingAddress?.email || "",
      product:   o.items?.[0]?.name || "—",
      itemCount: o.items?.length || 0,
      amount:    o.pricing?.total || 0,
      status:    o.status,
      payment:   o.payment?.method || "—",
      createdAt: o.createdAt
    }));

    // ── Recent Activity feed (last 8 events) ─────────
    const recentActivity = await Order.find({})
      .sort({ updatedAt: -1 })
      .limit(8)
      .select("_id status shippingAddress updatedAt pricing.total")
      .lean();

    const activityFeed = recentActivity.map(o => {
      const name    = `${o.shippingAddress?.firstName || ""} ${o.shippingAddress?.lastName || ""}`.trim() || "A customer";
      const shortId = o._id.toString().slice(-6).toUpperCase();

      const statusMsgMap = {
        delivered:        { msg: `${name} received order #${shortId}`,   icon: "✅", color: "#e8faf3" },
        cancelled:        { msg: `Order #${shortId} was cancelled`,       icon: "❌", color: "#fff0f0" },
        refund_completed: { msg: `Refund completed for #${shortId}`,      icon: "💸", color: "#fff4ec" },
        processing:       { msg: `New order #${shortId} by ${name}`,      icon: "🛒", color: "#ebf2ff" },
        confirmed:        { msg: `Order #${shortId} confirmed`,           icon: "📦", color: "#f2eeff" },
        shipped:          { msg: `Order #${shortId} shipped`,             icon: "🚚", color: "#f2eeff" },
      };

      const info = statusMsgMap[o.status] || {
        msg:   `Order #${shortId} updated`,
        icon:  "📋",
        color: "#f3f4f8"
      };

      return {
        message:   info.msg,
        icon:      info.icon,
        color:     info.color,
        amount:    o.pricing?.total || 0,
        timestamp: o.updatedAt
      };
    });

    // ── Total Revenue (all time, non-cancelled) ───────
    const allTimeRevenueAgg = await Order.aggregate([
      { $match: { status: { $in: REVENUE_STATUSES } } },
      { $group: { _id: null, total: { $sum: "$pricing.total" } } }
    ]);
    const allTimeRevenue = allTimeRevenueAgg[0]?.total || 0;


    // ── Monthly revenue (last 12 months for chart) ────
const twelveMonthsAgo = new Date(now);
twelveMonthsAgo.setMonth(now.getMonth() - 11);
twelveMonthsAgo.setDate(1);
twelveMonthsAgo.setHours(0, 0, 0, 0);

const monthlyRevenueAgg = await Order.aggregate([
  {
    $match: {
      status:    { $in: REVENUE_STATUSES },
      createdAt: { $gte: twelveMonthsAgo, $lte: now }
    }
  },
  {
    $group: {
      _id: {
        $dateToString: { format: "%Y-%m", date: "$createdAt" }
      },
      revenue: { $sum: "$pricing.total" },
      orders:  { $sum: 1 }
    }
  },
  { $sort: { _id: 1 } }
]);

// Fill missing months with 0
const monthlyRevenue = [];
for (let i = 11; i >= 0; i--) {
  const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
  const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const found = monthlyRevenueAgg.find(r => r._id === key);
  monthlyRevenue.push({
    month:   key,
    label:   d.toLocaleDateString("en-IN", { month: "short", year: "2-digit" }),
    revenue: found?.revenue || 0,
    orders:  found?.orders  || 0
  });
}

    // ── Send response ─────────────────────────────────
    return res.status(200).json({
      success: true,

      revenue: {
        allTime:     allTimeRevenue,
        last7Days:   currentRevenue,
        today:       todayRevenue,
        trend:       revenueTrend,       // e.g. 25 means +25%
        trendDir:    revenueTrendDir,    // "up" | "down" | "flat"
        daily:       dailyRevenue   ,     // array of 7 days for chart
        monthly:        monthlyRevenue 
      },

      orders: {
        total:     totalOrders,
        pending:   pendingOrders,
        delivered: deliveredOrders,
        cancelled: cancelledOrders,
        today:     todayOrders,
        trend:     orderTrend,
        trendDir:  orderTrendDir
      },

      products:  { total: totalProducts },
      customers: { total: totalCustomers },

      recentOrders: recentOrdersFormatted,
      activityFeed
    });

  } catch (error) {
    console.error("Dashboard Stats Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch dashboard statistics"
    });
  }
});
module.exports = router;