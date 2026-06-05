const express = require("express");
const router = express.Router();

const User = require("../models/User");
const jwt = require("jsonwebtoken");
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const {validate}=require('../middleware/validate')
const {userSchemas} =require('../validation/schemas')
const { auth , adminAuth} = require('../middleware/auth');


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
module.exports = router;