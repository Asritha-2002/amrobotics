const express = require("express");
const router = express.Router();

const User = require("../models/User");
const jwt = require("jsonwebtoken");
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const {validate}=require('../middleware/validate')
const {userSchemas} =require('../validation/schemas')
const {sendVerificationEmail}=require('../config/email')
const { auth } = require('../middleware/auth');
const Cart = require("../models/Cart");
//register
router.post(
  '/user/register',
  validate(userSchemas.register),
  async (req, res) => {
    try {
      const { email, name, password } = req.body;

      // 1. check existing user
      const existingUser = await User.findOne({ email });

      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: 'User already exists. Please login instead.'
        });
      }

      // 2. verification token
      const verificationToken = crypto.randomBytes(32).toString('hex');

      // 3. create user safely
      const user = new User({
        name,
        email,
        password,
        verificationToken,
        isVerified: false,
        isAdmin: false
      });

      await user.save();

      // 4. send email (non-blocking)
      let emailStatus = "sent";

      try {
        await sendVerificationEmail(user.email, verificationToken);
      } catch (err) {
        console.error("Email sending failed:", err.message);
        emailStatus = "failed";
      }

      // 5. NO JWT TOKEN (IMPORTANT)

      return res.status(201).json({
        success: true,
        message:
          emailStatus === "sent"
            ? "Registration successful. Please verify your email."
            : "Registered but email failed. Please resend verification email.",
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          isVerified: user.isVerified
        }
      });

    } catch (error) {
      console.error(error);
      return res.status(500).json({
        success: false,
        message: 'Something went wrong',
        error: error.message
      });
    }
  }
);

//login
router.post("/login", async (req, res) => {
  try {
    const { email, password, guestCart } = req.body;
    // guestCart = [ { productId, quantity }, ... ] sent from frontend
    // it is optional — plain login still works if not provided

    // ==============================
    // Validation
    // ==============================
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    // ==============================
    // Find User
    // ==============================
    const user = await User.findOne({
      email: email.toLowerCase(),
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // ==============================
    // Check Account Status
    // ==============================
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: "Your account has been disabled",
      });
    }

    if (!user.isVerified) {
      return res.status(403).json({
        success: false,
        message: "Please verify your email before logging in.",
      });
    }

    // ==============================
    // Compare Password
    // ==============================
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // ==============================
    // Merge Guest Cart (if provided)
    // ==============================
    if (Array.isArray(guestCart) && guestCart.length > 0) {
      try {
        // Find or create the user's cart
        let cart = await Cart.findOne({ userId: user._id });

        if (!cart) {
          cart = new Cart({ userId: user._id, items: [] });
        }

        for (const guestItem of guestCart) {
          if (!guestItem.productId || !guestItem.quantity) continue;

          const existingIndex = cart.items.findIndex(
            (i) => i.productId.toString() === guestItem.productId.toString()
          );

          if (existingIndex !== -1) {
            // Product already in cart — add guest quantity on top
            cart.items[existingIndex].quantity += Number(guestItem.quantity);
          } else {
            // New product — push it in
            cart.items.push({
              productId: guestItem.productId,
              quantity:  Number(guestItem.quantity),
            });
          }
        }

        await cart.save();
      } catch (cartErr) {
        // Cart merge failure should NOT block login
        console.error("Guest cart merge error:", cartErr);
      }
    }

    // ==============================
    // Generate JWT
    // ==============================
    const token = jwt.sign(
      {
        id:      user._id,
        isAdmin: user.isAdmin,
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    // ==============================
    // Success Response
    // ==============================
    return res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user: {
        _id:          user._id,
        name:         user.name,
        email:        user.email,
        phone:        user.phone,
        isAdmin:      user.isAdmin,
        profileImage: user.profileImage,
      },
    });

  } catch (error) {
    console.error("Login Error:", error);

    return res.status(500).json({
      success: false,
      message: "Login failed",
      error:   error.message,
    });
  }
});

router.get("/user/verify/:token", async (req, res) => {
  try {
    const user = await User.findOne({
      verificationToken: req.params.token
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired verification link"
      });
    }

    if (user.isVerified) {
      return res.status(400).json({
        success: false,
        message: "Account already verified"
      });
    }

    user.isVerified = true;
    user.verificationToken = null;

    await user.save();

    res.status(200).json({
      success: true,
      message: "Email verified successfully"
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});


//get user profile
router.get('/profile',auth, async (req, res) => {
  const user = await User.findById(req.user.id);

  const addresses = user.addresses.map(addr => {
    const names = addr.name.split(' ');

    return {
      _id: addr._id,
      firstName: names[0] || '',
      lastName: names.slice(1).join(' ') || '',
      street: addr.addl1,
      city: addr.city,
      state: addr.state,
      zipCode: addr.pincode,
      country: addr.country,
      contactNumber: addr.mobilenum,
      label: addr.type,
      isDefault: addr.isDefault
    };
  });

  res.json({
    name: user.name,
    email: user.email,
    phone: user.phone,
    addresses
  });
});
//set profile
router.put('/profile', auth, async (req, res) => {
  console.log(req.body, req.user.id)
  const user = await User.findById(req.user.id);

  if (!user) {
    return res.status(404).json({
      message: 'User not found'
    });
  }

  user.name = req.body.name || user.name;
  user.email = req.body.email || user.email;
  user.phone = req.body.phone || user.phone;

  if (req.body.address) {

    let defaultAddress =
      user.addresses.find(a => a.isDefault);

    if (defaultAddress) {

      defaultAddress.name = user.name;
      defaultAddress.mobilenum = user.phone;

      defaultAddress.addl1 =
        req.body.address.addl1;

      defaultAddress.city =
        req.body.address.city;

      defaultAddress.state =
        req.body.address.state;

      defaultAddress.pincode =
        req.body.address.pincode;

      defaultAddress.country =
        req.body.address.country;

    } else {

      user.addresses.push({
        name: user.name,
        mobilenum: user.phone,
        addl1: req.body.address.addl1,
        city: req.body.address.city,
        state: req.body.address.state,
        pincode: req.body.address.pincode,
        country: req.body.address.country,
        type: 'Home',
        isDefault: true
      });

    }
  }

  await user.save();

  res.json({
    success: true,
    message: 'Profile updated successfully'
  });
});

//address
router.post('/addresses', auth, async (req, res) => {

  const user = await User.findById(req.user.id);

  const {
    firstName,
    lastName,
    street,
    city,
    state,
    zipCode,
    country,
    contactNumber,
    label,
    isDefault
  } = req.body;

  if (isDefault) {
    user.addresses.forEach(
      a => a.isDefault = false
    );
  }

  user.addresses.push({
    name: `${firstName} ${lastName}`.trim(),
    mobilenum: contactNumber,
    addl1: street,
    city,
    state,
    pincode: zipCode,
    country,
    type: label || 'Home',
    isDefault
  });

  await user.save();

  res.json({
    success: true,
    message: 'Address added successfully'
  });
});

//set address
router.put('/addresses/:id', auth, async (req, res) => {

  const user = await User.findById(req.user.id);

  const address =
    user.addresses.id(req.params.id);

  if (!address) {
    return res.status(404).json({
      message: 'Address not found'
    });
  }

  const {
    firstName,
    lastName,
    street,
    city,
    state,
    zipCode,
    country,
    contactNumber,
    label,
    isDefault
  } = req.body;

  if (isDefault) {
    user.addresses.forEach(
      a => a.isDefault = false
    );
  }

  address.name =
    `${firstName} ${lastName}`.trim();

  address.mobilenum =
    contactNumber;

  address.addl1 =
    street;

  address.city =
    city;

  address.state =
    state;

  address.pincode =
    zipCode;

  address.country =
    country;

  address.type =
    label;

  address.isDefault =
    isDefault;

  await user.save();

  res.json({
    success: true,
    message: 'Address updated'
  });
});

//delete address
router.delete('/addresses/:id', auth, async (req, res) => {

  const user = await User.findById(req.user.id);

  user.addresses.pull(req.params.id);

  await user.save();

  res.json({
    success: true,
    message: 'Address deleted'
  });
});

module.exports = router;