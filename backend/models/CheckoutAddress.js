const mongoose = require("mongoose");

// ── Single Address Sub-Schema ─────────────────────────────────────────────────
const addressSchema = new mongoose.Schema(
  {
    firstName:  { type: String, required: true,  trim: true },
    lastName:   { type: String, required: true,  trim: true },
    email:      { type: String, required: true,  trim: true, lowercase: true },
    phone:      { type: String, required: true,  trim: true },
    address1:   { type: String, required: true,  trim: true },   // Street address
    address2:   { type: String, default: "",     trim: true },   // Apartment, suite (optional)
    city:       { type: String, required: true,  trim: true },
    state:      { type: String, required: true,  trim: true },
    postalCode: { type: String, required: true,  trim: true },
    country:    { type: String, required: true,  trim: true, default: "India" },
    isDefault:  { type: Boolean, default: false },               // mark one as default
    label:      { type: String, default: "Home", trim: true },   // Home / Office / Other
  },
  { timestamps: true }
);

// ── Checkout Address Schema ───────────────────────────────────────────────────
const checkoutAddressSchema = new mongoose.Schema(
  {
    userId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      "User",
      required: true,
      unique:   true,   // one document per user, addresses stored as array inside
      index:    true,
    },

    addresses: {
      type:    [addressSchema],
      default: [],
    },
  },
  { timestamps: true }
);

// ── Instance Method: Add a new address ───────────────────────────────────────
// If isDefault = true, unset all others first
checkoutAddressSchema.methods.addAddress = async function (newAddr) {

  // if new address is marked default → unset all existing defaults
  if (newAddr.isDefault) {
    this.addresses.forEach(a => (a.isDefault = false));
  }

  // if this is the very first address → make it default automatically
  if (this.addresses.length === 0) {
    newAddr.isDefault = true;
  }

  this.addresses.push(newAddr);
  await this.save();
  return this;
};

// ── Instance Method: Update an existing address by its _id ───────────────────
checkoutAddressSchema.methods.updateAddress = async function (addressId, updates) {

  const addr = this.addresses.id(addressId);
  if (!addr) throw new Error("Address not found");

  // if setting this one as default → unset others
  if (updates.isDefault) {
    this.addresses.forEach(a => (a.isDefault = false));
  }

  Object.assign(addr, updates);
  await this.save();
  return this;
};

// ── Instance Method: Remove an address by its _id ────────────────────────────
checkoutAddressSchema.methods.removeAddress = async function (addressId) {

  const before      = this.addresses.length;
  this.addresses    = this.addresses.filter(
    a => a._id.toString() !== addressId.toString()
  );

  if (this.addresses.length === before) {
    throw new Error("Address not found");
  }

  // if deleted address was default → make first remaining address default
  if (this.addresses.length > 0 && !this.addresses.some(a => a.isDefault)) {
    this.addresses[0].isDefault = true;
  }

  await this.save();
  return this;
};

// ── Instance Method: Set a specific address as default ───────────────────────
checkoutAddressSchema.methods.setDefault = async function (addressId) {

  const found = this.addresses.id(addressId);
  if (!found) throw new Error("Address not found");

  this.addresses.forEach(a => (a.isDefault = false));
  found.isDefault = true;

  await this.save();
  return this;
};

// ── Static Method: Get or create the address document for a user ─────────────
checkoutAddressSchema.statics.getOrCreate = async function (userId) {
  let doc = await this.findOne({ userId });
  if (!doc) {
    doc = await this.create({ userId, addresses: [] });
  }
  return doc;
};

const CheckoutAddress = mongoose.model("CheckoutAddress", checkoutAddressSchema);
module.exports = CheckoutAddress;