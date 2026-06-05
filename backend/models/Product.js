// models/Product.js
const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({

  // ── BASIC INFO ──
  name: {
    type: String,
    required: true,
    trim: true
  },

  sku: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    uppercase: true
  },

  slug: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  country: {
  type: String,
  required: true,
  enum: ['INDIA', 'US'],
  trim: true,
  uppercase: true,
  default: 'INDIA'
},

  brand: {
    type: String,
    trim: true,
    default: ''
  },

  // ── CATEGORY ──
  category: {
    type: String,
    required: true,
    trim: true
  },

  categoryImage: {
    type: String,      // URL or file path
    default: ''
  },

  subCategory: {
    type: String,
    trim: true,
    default: ''
  },

  // ── TAGS ──
  tags: {
    type: [String],    // e.g. ['robotics', 'arduino', '3d-printing']
    default: []
  },

  // ── DESCRIPTIONS ──
  shortDescription: {
    type: String,
    trim: true,
    default: ''
  },

  fullDescription: {
    type: String,
    trim: true,
    default: ''
  },

  highlights: {
    type: [String],    // e.g. ['Wireless', '2 year warranty', 'Made in India']
    default: []
  },

  // ── STATUS ──
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  },

  // ── IMAGES (max 10) ──
  images: {
    type: [String],    // array of URLs or file paths
    default: [],
    validate: {
      validator: function (arr) {
        return arr.length <= 10;
      },
      message: 'Maximum 10 images allowed per product'
    }
  },

  // ── PRICING ──
  sellingPrice: {
    type: Number,
    required: true,
    min: 0
  },

  originalPrice: {
    type: Number,
    required: true,
    min: 0
  },

  // ── STOCK ──
  stock: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  }

}, { timestamps: true });

// ── VIRTUAL: discount percentage ──
productSchema.virtual('discountPercent').get(function () {
  if (this.originalPrice > 0 && this.sellingPrice < this.originalPrice) {
    return Math.round(((this.originalPrice - this.sellingPrice) / this.originalPrice) * 100);
  }
  return 0;
});

// ── VIRTUAL: in stock flag ──
productSchema.virtual('inStock').get(function () {
  return this.stock > 0;
});

// ── AUTO-GENERATE SLUG from name if not provided ──
productSchema.pre('save', function (next) {
  if (!this.slug && this.name) {
    this.slug = this.name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-');
  }
});

// ── INDEXES for fast lookup ──
productSchema.index({ category: 1 });
productSchema.index({ status: 1 });
productSchema.index({ tags: 1 });

module.exports = mongoose.model('Product', productSchema);