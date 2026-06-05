
const express = require("express");
const mongoose = require('mongoose');
const router = express.Router();

const shopDetailSchema = new mongoose.Schema({
    name:     { type: String, required: true },
    value:    { type: String, required: true },
    category: { type: String, required: true, enum: ['FINALCHARGES','DELIVERY','PAYMENTTYPE'] }
}, { timestamps: true });
module.exports = mongoose.model('ShopDetail', shopDetailSchema);