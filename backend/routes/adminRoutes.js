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

    // ── Date helpers ─────────────────────────────────
    const now        = new Date();
    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
    const todayEnd   = new Date(now); todayEnd.setHours(23, 59, 59, 999);

    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(now.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const prev7Start = new Date(sevenDaysAgo);
    prev7Start.setDate(prev7Start.getDate() - 7);
    const prev7End = new Date(sevenDaysAgo);
    prev7End.setMilliseconds(-1);

    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    const yesterdayEnd = new Date(todayEnd);
    yesterdayEnd.setDate(yesterdayEnd.getDate() - 1);

    const twelveMonthsAgo = new Date(now);
    twelveMonthsAgo.setMonth(now.getMonth() - 11);
    twelveMonthsAgo.setDate(1);
    twelveMonthsAgo.setHours(0, 0, 0, 0);

    // ── Country filter ───────────────────────────────
    // Frontend sends ?country=India or ?country=US
    const countryParam = req.query.country || null;

    // Applied to every Order query via shippingAddress.country
    const orderCountryMatch = countryParam
      ? { "shippingAddress.country": { $regex: `^${countryParam}$`, $options: "i" } }
      : {};

    // ── Revenue statuses (exclude cancelled / refunded) ──
    const REVENUE_STATUSES = [
      "processing", "confirmed", "shipped",
      "delivered",  "out_for_delivery"
    ];

    // ── Revenue aggregations ─────────────────────────
    const [revenueAgg, prevRevenueAgg, todayRevenueAgg] = await Promise.all([

      // Current 7-day revenue
      Order.aggregate([
        {
          $match: {
            ...orderCountryMatch,
            status:    { $in: REVENUE_STATUSES },
            createdAt: { $gte: sevenDaysAgo, $lte: now }
          }
        },
        { $group: { _id: null, total: { $sum: "$pricing.total" }, count: { $sum: 1 } } }
      ]),

      // Previous 7-day revenue (for trend %)
      Order.aggregate([
        {
          $match: {
            ...orderCountryMatch,
            status:    { $in: REVENUE_STATUSES },
            createdAt: { $gte: prev7Start, $lte: prev7End }
          }
        },
        { $group: { _id: null, total: { $sum: "$pricing.total" } } }
      ]),

      // Today's revenue
      Order.aggregate([
        {
          $match: {
            ...orderCountryMatch,
            status:    { $in: REVENUE_STATUSES },
            createdAt: { $gte: todayStart, $lte: todayEnd }
          }
        },
        { $group: { _id: null, total: { $sum: "$pricing.total" } } }
      ])
    ]);

    const currentRevenue  = revenueAgg[0]?.total     || 0;
    const previousRevenue = prevRevenueAgg[0]?.total  || 0;
    const todayRevenue    = todayRevenueAgg[0]?.total || 0;

    // Revenue trend %
    let revenueTrend    = 0;
    let revenueTrendDir = "flat";
    if (previousRevenue > 0) {
      revenueTrend    = Math.round(((currentRevenue - previousRevenue) / previousRevenue) * 100);
      revenueTrendDir = revenueTrend > 0 ? "up" : revenueTrend < 0 ? "down" : "flat";
    } else if (currentRevenue > 0) {
      revenueTrend    = 100;
      revenueTrendDir = "up";
    }

    // ── All-time revenue ─────────────────────────────
    const allTimeRevenueAgg = await Order.aggregate([
      {
        $match: {
          ...orderCountryMatch,
          status: { $in: REVENUE_STATUSES }
        }
      },
      { $group: { _id: null, total: { $sum: "$pricing.total" } } }
    ]);
    const allTimeRevenue = allTimeRevenueAgg[0]?.total || 0;

    // ── Daily revenue (last 7 days for chart) ────────
    const dailyRevenueAgg = await Order.aggregate([
      {
        $match: {
          ...orderCountryMatch,
          status:    { $in: REVENUE_STATUSES },
          createdAt: { $gte: sevenDaysAgo, $lte: now }
        }
      },
      {
        $group: {
          _id:     { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          revenue: { $sum: "$pricing.total" },
          orders:  { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const dailyRevenue = [];
    for (let i = 6; i >= 0; i--) {
      const d     = new Date(now);
      d.setDate(now.getDate() - i);
      const key   = d.toISOString().split("T")[0];
      const found = dailyRevenueAgg.find(r => r._id === key);
      dailyRevenue.push({
        date:    key,
        label:   d.toLocaleDateString("en-IN", { weekday: "short" }),
        revenue: found?.revenue || 0,
        orders:  found?.orders  || 0
      });
    }

    // ── Monthly revenue (last 12 months for chart) ───
    const monthlyRevenueAgg = await Order.aggregate([
      {
        $match: {
          ...orderCountryMatch,
          status:    { $in: REVENUE_STATUSES },
          createdAt: { $gte: twelveMonthsAgo, $lte: now }
        }
      },
      {
        $group: {
          _id:     { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
          revenue: { $sum: "$pricing.total" },
          orders:  { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const monthlyRevenue = [];
    for (let i = 11; i >= 0; i--) {
      const d   = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const found = monthlyRevenueAgg.find(r => r._id === key);
      monthlyRevenue.push({
        month:   key,
        label:   d.toLocaleDateString("en-IN", { month: "short", year: "2-digit" }),
        revenue: found?.revenue || 0,
        orders:  found?.orders  || 0
      });
    }

    // ── Order counts (all filtered by country) ───────
    const [
      totalOrders,
      pendingOrders,
      deliveredOrders,
      cancelledOrders,
      todayOrders,
      yesterdayOrders
    ] = await Promise.all([
      Order.countDocuments({ ...orderCountryMatch }),
      Order.countDocuments({ ...orderCountryMatch, status: { $in: ["processing", "confirmed", "payment_pending"] } }),
      Order.countDocuments({ ...orderCountryMatch, status: "delivered" }),
      Order.countDocuments({ ...orderCountryMatch, status: { $in: ["cancelled", "refund_completed"] } }),
      Order.countDocuments({ ...orderCountryMatch, createdAt: { $gte: todayStart,     $lte: todayEnd     } }),
      Order.countDocuments({ ...orderCountryMatch, createdAt: { $gte: yesterdayStart, $lte: yesterdayEnd } })
    ]);

    // Orders trend (today vs yesterday)
    let orderTrend    = 0;
    let orderTrendDir = "flat";
    if (yesterdayOrders > 0) {
      orderTrend    = Math.round(((todayOrders - yesterdayOrders) / yesterdayOrders) * 100);
      orderTrendDir = orderTrend > 0 ? "up" : orderTrend < 0 ? "down" : "flat";
    }

    // ── Products (filtered by country, case-insensitive) ──
    const productQuery = {
      status: "active",
      stock:  { $gt: 0 },
      ...(countryParam
        ? { country: { $regex: `^${countryParam}$`, $options: "i" } }
        : {})
    };

    // ── Customers (global — no country field on User) ──
    const [totalProducts, totalCustomers] = await Promise.all([
      Product.countDocuments(productQuery),
      User.countDocuments({ isAdmin: false })
    ]);

    // ── Recent orders (last 5, country-filtered) ─────
    const recentOrders = await Order.find({ ...orderCountryMatch })
      .sort({ createdAt: -1 })
      .limit(5)
      .select("_id userId items shippingAddress pricing status payment.method createdAt")
      .lean();

    const recentOrdersFormatted = recentOrders.map(o => ({
      _id:       o._id,
      shortId:   o._id.toString().slice(-6).toUpperCase(),
      customer:  `${o.shippingAddress?.firstName || ""} ${o.shippingAddress?.lastName || ""}`.trim() || "Unknown",
      email:     o.shippingAddress?.email   || "",
      product:   o.items?.[0]?.name         || "—",
      itemCount: o.items?.length            || 0,
      amount:    o.pricing?.total           || 0,
      status:    o.status,
      payment:   o.payment?.method          || "—",
      createdAt: o.createdAt
    }));

    // ── Activity feed (last 8 events, country-filtered) ──
    const recentActivity = await Order.find({ ...orderCountryMatch })
      .sort({ updatedAt: -1 })
      .limit(8)
      .select("_id status shippingAddress updatedAt pricing")
      .lean();

    const activityFeed = recentActivity.map(o => {
      const name    = `${o.shippingAddress?.firstName || ""} ${o.shippingAddress?.lastName || ""}`.trim() || "A customer";
      const shortId = o._id.toString().slice(-6).toUpperCase();

      const statusMsgMap = {
        delivered:        { msg: `${name} received order #${shortId}`,  icon: "✅", color: "#e8faf3" },
        cancelled:        { msg: `Order #${shortId} was cancelled`,      icon: "❌", color: "#fff0f0" },
        refund_completed: { msg: `Refund completed for #${shortId}`,     icon: "💸", color: "#fff4ec" },
        processing:       { msg: `New order #${shortId} by ${name}`,     icon: "🛒", color: "#ebf2ff" },
        confirmed:        { msg: `Order #${shortId} confirmed`,          icon: "📦", color: "#f2eeff" },
        shipped:          { msg: `Order #${shortId} shipped`,            icon: "🚚", color: "#f2eeff" },
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

    // ── Response ─────────────────────────────────────
    return res.status(200).json({
      success: true,

      revenue: {
        allTime:  allTimeRevenue,
        last7Days: currentRevenue,
        today:    todayRevenue,
        trend:    revenueTrend,
        trendDir: revenueTrendDir,
        daily:    dailyRevenue,
        monthly:  monthlyRevenue
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