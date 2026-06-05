// routes/shopRoutes.js

const express = require("express");
const router = express.Router();
const Product = require("../models/Product");

// GET CATEGORIES BY COUNTRY
router.get("/categories/:country", async (req, res) => {
  try {
    const { country } = req.params;

    const categories = await Product.distinct("category", {
      country: country.toUpperCase(),
      status: "active"
    });

    res.status(200).json({
      success: true,
      categories
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch categories"
    });
  }
});


// GET PRODUCTS BY COUNTRY

router.get("/products/:country", async (req, res) => {
  try {
    const { country } = req.params;

    const products = await Product.find({
      country: country.toUpperCase(),
      status: "active"
    }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: products.length,
      products
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch products"
    });
  }
});

module.exports = router;