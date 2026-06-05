const ShopDetail = require('../models/ShopDetail');
const express = require("express");
const mongoose = require('mongoose');
const router = express.Router();
const { auth , adminAuth} = require('../middleware/auth');
// GET all
router.get('/admin/shop-details', auth, async (req, res) => {
    try {
        const details = await ShopDetail.find().sort({ category: 1 });
        res.json({ details });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// POST add
router.post('/admin/shop-details', auth, adminAuth, async (req, res) => {
    try {
        const detail = new ShopDetail(req.body);
        await detail.save();
        res.json({ success: true, detail });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// PUT update
router.put('/admin/shop-details/:id', auth, async (req, res) => {
    try {
        const detail = await ShopDetail.findByIdAndUpdate(req.params.id, req.body, {
  returnDocument: "after"
});
        res.json({ success: true, detail });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// DELETE
router.delete('/admin/shop-details/:id', auth, async (req, res) => {
    try {
        await ShopDetail.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});


// =====================================================
//  GET /api/store-config/final-charges
//  No auth required (public config)
//  Returns the most recently updated FINALCHARGES
//  entry — used on checkout to show tax / extra fees
// =====================================================

router.get("/final-charges", async (req, res) => {
  try {

    // Get all FINALCHARGES entries sorted newest first
    const charges = await ShopDetail.find({
      category: "FINALCHARGES"
    }).sort({ updatedAt: -1 });

    if (!charges || charges.length === 0) {
      return res.status(200).json({
        success: true,
        charge: null,
        message: "No final charges configured"
      });
    }

    // Most recent entry
    const latest = charges[0];

    // Parse value — could be "Free", a number string, or a percentage string
    let numericValue = 0;
    let isFree       = false;

    if (
      latest.value === null ||
      latest.value === undefined ||
      String(latest.value).trim().toLowerCase() === "free" ||
      String(latest.value).trim() === "0"
    ) {
      isFree       = true;
      numericValue = 0;
    } else {
      numericValue = parseFloat(String(latest.value).replace(/[^0-9.]/g, "")) || 0;
    }

    return res.status(200).json({
      success: true,
      charge: {
        _id:          latest._id,
        name:         latest.name,
        rawValue:     latest.value,
        numericValue,
        isFree,
        label:        isFree ? "Free" : `₹${numericValue}`,
        category:     latest.category,
        updatedAt:    latest.updatedAt
      },
      // also return all entries in case frontend needs them
      all: charges.map(c => ({
        _id:      c._id,
        name:     c.name,
        value:    c.value,
        category: c.category
      }))
    });

  } catch (error) {
    console.error("Final Charges Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch final charges"
    });
  }
});



router.get("/delivery-charges", async (req, res) => {
  try {
    // Get country from query param — e.g. /delivery-charges?country=US
    const country = (req.query.country || "India").trim();

    // Find all DELIVERY entries for that country, newest first
    const charges = await ShopDetail.find({
      category: "DELIVERY",
      name: country
    }).sort({ updatedAt: -1 });

    if (!charges || charges.length === 0) {
      return res.status(200).json({
        success: true,
        charge: null,
        message: `No delivery charges configured for ${country}`
      });
    }

    // Most recent entry for that country
    const latest = charges[0];

    let numericValue = 0;
    let isFree       = false;

    if (
      latest.value === null ||
      latest.value === undefined ||
      String(latest.value).trim().toLowerCase() === "free" ||
      String(latest.value).trim() === "0"
    ) {
      isFree       = true;
      numericValue = 0;
    } else {
      numericValue = parseFloat(String(latest.value).replace(/[^0-9.]/g, "")) || 0;
    }

    return res.status(200).json({
      success: true,
      charge: {
        _id:          latest._id,
        name:         latest.name,
        rawValue:     latest.value,
        numericValue,
        isFree,
        label:        isFree ? "Free" : `${numericValue}`,
        category:     latest.category,
        updatedAt:    latest.updatedAt
      }
    });

  } catch (error) {
    console.error("Delivery Charges Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch delivery charges"
    });
  }
});
module.exports = router;