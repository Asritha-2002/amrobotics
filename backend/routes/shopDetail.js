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
module.exports = router;