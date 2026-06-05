// routes/productRoutes.js
const express    = require('express');
const router     = express.Router();
const multer     = require('multer');
const Product    = require('../models/Product');
const { auth , adminAuth} = require('../middleware/auth');
const { uploadImageToCloudinary } = require('../config/cloudinary');

// ─────────────────────────────────────────
//  MULTER — memory storage only (no disk)
// ─────────────────────────────────────────
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB per file
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// ─────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────
function generateSlug(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    + '-' + Date.now();
}

function generateSKU(name, category) {
  const namePart     = name.substring(0, 3).toUpperCase();
  const categoryPart = (category || 'GEN').substring(0, 3).toUpperCase();
  const randomPart   = Math.floor(1000 + Math.random() * 9000);
  return `${categoryPart}-${namePart}-${randomPart}`;
}

// Upload multiple image buffers to Cloudinary in parallel
async function uploadImagesToCloudinary(files, folder = 'amrobotics/products') {
  const uploadPromises = files.map(file =>
    uploadImageToCloudinary(file.buffer, {
      folder,
      resource_type: 'image',
      transformation: [{ quality: 'auto', fetch_format: 'auto' }]
    })
  );
  const results = await Promise.all(uploadPromises);
  return results.map(r => r.secure_url); // return only the URLs
}

// ─────────────────────────────────────────
//  POST — CREATE PRODUCT
//  POST /api/products
//  multipart/form-data
//  fields: all product fields as text + images[] as files
// ─────────────────────────────────────────
router.post(
  '/',
  auth,
  adminAuth,
  upload.fields([
    { name: 'images',        maxCount: 10 },
    { name: 'categoryImage', maxCount: 1  }
  ]),
  async (req, res) => {
    try {
      const {
        name,
        sku,
        slug,
        brand,
        category,
        subCategory,
        shortDescription,
        fullDescription,
        status,
        sellingPrice,
        originalPrice,
        stock
      } = req.body;
      console.log("Original:", originalPrice);
console.log("Selling:", sellingPrice);
console.log("Converted:", Number(sellingPrice));

      // tags and highlights come as JSON strings or comma-separated from FormData
      const tags       = parseArrayField(req.body.tags);
      const highlights = parseArrayField(req.body.highlights);

      // ── Validate required ──
      if (!name || !category || sellingPrice === undefined || originalPrice === undefined || stock === undefined || stock === "") {
        return res.status(400).json({
          success: false,
          message: 'name, category, sellingPrice, originalPrice, stock are required'
        });
      }

      if (Number(sellingPrice) > Number(originalPrice)) {
        return res.status(400).json({
          success: false,
          message: 'Selling price cannot be greater than original price'
        });
      }

      // ── Auto-generate SKU and slug ──
      const finalSku  = sku  || generateSKU(name, category);
      const finalSlug = slug || generateSlug(name);

      // ── Check duplicates ──
      const [skuExists, slugExists] = await Promise.all([
        Product.findOne({ sku: finalSku.toUpperCase() }),
        Product.findOne({ slug: finalSlug })
      ]);

      if (skuExists) {
        return res.status(400).json({
          success: false,
          message: `SKU "${finalSku}" already exists`
        });
      }
      if (slugExists) {
        return res.status(400).json({
          success: false,
          message: `Slug "${finalSlug}" already exists`
        });
      }

      // ── Upload images to Cloudinary ──
      let imageUrls       = [];
      let categoryImageUrl = '';

      const productImageFiles  = req.files?.images        || [];
      const categoryImageFiles = req.files?.categoryImage || [];

      if (productImageFiles.length > 10) {
        return res.status(400).json({
          success: false,
          message: 'Maximum 10 product images allowed'
        });
      }

      // Upload both in parallel
      const [uploadedImages, uploadedCategoryImage] = await Promise.all([
        productImageFiles.length  > 0
          ? uploadImagesToCloudinary(productImageFiles, 'amrobotics/products')
          : Promise.resolve([]),
        categoryImageFiles.length > 0
          ? uploadImagesToCloudinary(categoryImageFiles, 'amrobotics/categories')
          : Promise.resolve([])
      ]);

      imageUrls        = uploadedImages;
      categoryImageUrl = uploadedCategoryImage[0] || '';

      // ── Save product ──
      const product = new Product({
        name,
        sku:              finalSku,
        slug:             finalSlug,
        brand:            brand            || '',
        category,
        categoryImage:    categoryImageUrl,
        subCategory:      subCategory      || '',
        tags,
        shortDescription: shortDescription || '',
        fullDescription:  fullDescription  || '',
        highlights,
        status:           status           || 'active',
        images:           imageUrls,
        sellingPrice:     Number(sellingPrice),
        originalPrice:    Number(originalPrice),
        stock:            Number(stock)    || 0
      });

      await product.save();

      res.status(201).json({
        success: true,
        message: 'Product created successfully',
        product
      });

    } catch (err) {
      console.error('[POST /products]', err);
      if (err.code === 11000) {
        const field = Object.keys(err.keyValue)[0];
        return res.status(400).json({
          success: false,
          message: `${field} "${err.keyValue[field]}" already exists`
        });
      }
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

// ─────────────────────────────────────────
//  GET ALL PRODUCTS
//  GET /api/products
//  Query: ?status=active&category=X&search=X&page=1&limit=10&sortBy=createdAt&order=desc
// ─────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const {
      status,
      category,
      subCategory,
      search,
      tags,
      page    = 1,
      limit   = 10,
      sortBy  = 'createdAt',
      order   = 'desc'
    } = req.query;

    const filter = {};

    if (status)      filter.status      = status;
    if (category)    filter.category    = { $regex: category,    $options: 'i' };
    if (subCategory) filter.subCategory = { $regex: subCategory, $options: 'i' };
    if (tags)        filter.tags        = { $in: tags.split(',').map(t => t.trim()) };

    if (search) {
      filter.$or = [
        { name:             { $regex: search, $options: 'i' } },
        { sku:              { $regex: search, $options: 'i' } },
        { brand:            { $regex: search, $options: 'i' } },
        { shortDescription: { $regex: search, $options: 'i' } },
        { tags:             { $in: [new RegExp(search, 'i')] } }
      ];
    }

    const pageNum  = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip     = (pageNum - 1) * limitNum;
    const sortOrder = order === 'asc' ? 1 : -1;

    const [products, total] = await Promise.all([
      Product.find(filter)
        .sort({ [sortBy]: sortOrder })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Product.countDocuments(filter)
    ]);

    // Attach computed virtuals manually since .lean() skips them
    const productsWithVirtuals = products.map(p => ({
      ...p,
      discountPercent: p.originalPrice > 0 && p.sellingPrice < p.originalPrice
        ? Math.round(((p.originalPrice - p.sellingPrice) / p.originalPrice) * 100)
        : 0,
      inStock: p.stock > 0
    }));

    res.json({
      success: true,
      total,
      page:       pageNum,
      totalPages: Math.ceil(total / limitNum),
      count:      products.length,
      products:   productsWithVirtuals
    });

  } catch (err) {
    console.error('[GET /products]', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────
//  GET SINGLE PRODUCT
//  GET /api/products/:id   (by _id or slug)
// ─────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Accept both MongoDB _id and slug
    const isObjectId = /^[a-f\d]{24}$/i.test(id);
    const query      = isObjectId ? { _id: id } : { slug: id };

    const product = await Product.findOne(query).lean();

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    res.json({
      success: true,
      product: {
        ...product,
        discountPercent: product.originalPrice > 0 && product.sellingPrice < product.originalPrice
          ? Math.round(((product.originalPrice - product.sellingPrice) / product.originalPrice) * 100)
          : 0,
        inStock: product.stock > 0
      }
    });

  } catch (err) {
    console.error('[GET /products/:id]', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────
//  PATCH — UPDATE PRODUCT
//  PATCH /api/products/:id
//  multipart/form-data
//  Send only the fields you want to update
//  To remove specific images: send removeImages[] with URLs to delete
//  New image files in images[] are uploaded and appended
// ─────────────────────────────────────────
router.patch(
  '/:id',
  auth,
  adminAuth,
  upload.fields([
    { name: 'images',        maxCount: 10 },
    { name: 'categoryImage', maxCount: 1  }
  ]),
  async (req, res) => {
    try {
      const product = await Product.findById(req.params.id);
      if (!product) {
        return res.status(404).json({ success: false, message: 'Product not found' });
      }

      const {
        name,
        brand,
        country,
        category,
        subCategory,
        shortDescription,
        fullDescription,
        status,
        sellingPrice,
        originalPrice,
        stock,
        removeImages  // array of image URLs to remove from existing
      } = req.body;
       console.log("Original:", originalPrice);
console.log("Selling:", sellingPrice);
console.log("Converted:", Number(sellingPrice));

      const tags       = req.body.tags       ? parseArrayField(req.body.tags)       : undefined;
      const highlights = req.body.highlights ? parseArrayField(req.body.highlights) : undefined;

      // ── Apply text field updates ──
      if (name             !== undefined) product.name             = name;
      if (brand            !== undefined) product.brand            = brand;
      if (country          !== undefined) product.country          = country;
      if (category         !== undefined) product.category         = category;
      if (subCategory      !== undefined) product.subCategory      = subCategory;
      if (shortDescription !== undefined) product.shortDescription = shortDescription;
      if (fullDescription  !== undefined) product.fullDescription  = fullDescription;
      if (status           !== undefined) product.status           = status;
      if (tags             !== undefined) product.tags             = tags;
      if (highlights       !== undefined) product.highlights       = highlights;

      if (sellingPrice !== undefined) product.sellingPrice = Number(sellingPrice);
      if (originalPrice !== undefined) product.originalPrice = Number(originalPrice);
      if (stock        !== undefined) product.stock         = Number(stock);

      if (product.sellingPrice > product.originalPrice) {
        return res.status(400).json({
          success: false,
          message: 'Selling price cannot be greater than original price'
        });
      }

      // ── Handle image removals ──
      if (removeImages) {
        const toRemove = parseArrayField(removeImages);
        product.images = product.images.filter(url => !toRemove.includes(url));
      }

      // ── Upload new product images and append ──
      const newImageFiles = req.files?.images || [];

      if (newImageFiles.length > 0) {
        const totalAfterAdd = product.images.length + newImageFiles.length;
        if (totalAfterAdd > 10) {
          return res.status(400).json({
            success: false,
            message: `Cannot add ${newImageFiles.length} images. Product already has ${product.images.length} images. Max is 10.`
          });
        }

        const newUrls = await uploadImagesToCloudinary(newImageFiles, 'amrobotics/products');
        product.images.push(...newUrls);
      }

      // ── Upload new category image ──
      const categoryImageFiles = req.files?.categoryImage || [];
      if (categoryImageFiles.length > 0) {
        const uploaded = await uploadImagesToCloudinary(categoryImageFiles, 'amrobotics/categories');
        product.categoryImage = uploaded[0];
      }

      await product.save();

      res.json({
        success: true,
        message: 'Product updated successfully',
        product
      });

    } catch (err) {
      console.error('[PATCH /products/:id]', err);
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

// ─────────────────────────────────────────
//  DELETE PRODUCT
//  DELETE /api/products/:id
// ─────────────────────────────────────────
router.delete('/:id', auth, async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    res.json({ success: true, message: 'Product deleted successfully' });
  } catch (err) {
    console.error('[DELETE /products/:id]', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────
//  HELPER — parse tags/highlights from FormData
//  FormData can send arrays as JSON string or repeated keys
// ─────────────────────────────────────────
function parseArrayField(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    // comma-separated fallback: "tag1,tag2,tag3"
    return value.split(',').map(v => v.trim()).filter(Boolean);
  }
}


router.get("/admin/products/categories", async (req, res) => {
  try {
    const products = await Product.find(
      {},
      {
        category: 1,
        country: 1,
        _id: 0,
      }
    );

    const uniqueCategoriesMap = new Map();

    products.forEach((product) => {
      const category = product.category?.trim();
      const country = product.country?.trim();

      if (category) {
        const lowerCaseKey = category.toLowerCase();

        const formattedCategory = category
          .toLowerCase()
          .replace(/\b\w/g, (char) => char.toUpperCase());

        if (!uniqueCategoriesMap.has(lowerCaseKey)) {
          uniqueCategoriesMap.set(lowerCaseKey, {
            name: formattedCategory,
            country: country || "",
          });
        }
      }
    });

    const cleanedCategories = Array.from(
      uniqueCategoriesMap.values()
    ).sort((a, b) => a.name.localeCompare(b.name));

    return res.status(200).json({
      success: true,
      message: "Categories fetched successfully",
      data: cleanedCategories,
    });
  } catch (error) {
    console.error("Error fetching categories:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch categories",
      details: error.message,
    });
  }
});

module.exports = router;