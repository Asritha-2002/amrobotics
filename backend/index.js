require("dotenv").config();

const express = require("express");
const cors = require("cors");

const connectDB = require("./config/db");

const app = express();
const userRoutes = require("./routes/userRoutes");
const emailRoutes=require('./routes/emailRoutes.js')
const adminRoutes=require('./routes/adminRoutes.js')
const shopDetail=require('./routes/shopDetail.js')
const productRoutes = require('./routes/productRoutes');
const voucherRoutes=require('./routes/voucherRoutes.js')
const shopRoutes=require('./routes/shopRoutes.js')
const cartRoutes = require("./routes/cartRoutes");
const buyNowRoutes = require("./routes/buyNowRoutes");
const addressRoutes = require("./routes/addressRoutes");
const orderRoutes=require('./routes/orderRoutes.js')

app.use(cors());
app.use(express.json());


//Routes

app.get("/", (req, res) => {
  res.send("API Running");
});
app.use('/api/email',emailRoutes)
app.use("/api", userRoutes);
app.use("/api",adminRoutes)
app.use('/api',shopDetail)
app.use('/api/products', productRoutes);
app.use('/api',voucherRoutes)
app.use('/api/shop',shopRoutes)
app.use("/api/cart", cartRoutes);
app.use("/api",buyNowRoutes)
app.use("/api", addressRoutes);
app.use("/api", orderRoutes);


const PORT = process.env.PORT || 5000;

connectDB();

if (process.env.NODE_ENV !== "production") {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = app;