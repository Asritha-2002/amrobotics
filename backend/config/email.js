require("dotenv").config();


const EMAIL_API_ENDPOINT = process.env.EMAIL_API_ENDPOINT;


const sendEmailViaAPI = async (mailOptions) => {
  try {
    const response = await fetch(EMAIL_API_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ mailOptions }), 
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Email API error");
    }

    return result;

  } catch (error) {
    console.error("Email sending failed:", error.message);
    throw new Error("Failed to send email");
  }
};

const sendVerificationEmail = async (email, verificationToken) => {
  const verifyLink = `${process.env.BASE_URL}verifyEmail.html?token=${verificationToken}`;
  console.log(process.env.BASE_URL, verificationToken, process.env.COMPANY_NAME, process.env.EMAIL_USER );
  
  
  const mailOptions = {
    from: `"${process.env.COMPANY_NAME}" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Email Verification",
    html: `
    <img src="${process.env.COMPANY_LOGO}" alt="Logo" style="width: 200px; height: auto;"/>
      <h2>Verify your email address</h2>
      <p>Click the link below to verify your email:</p>
      <a href="${verifyLink}">Verify Email</a>
    `,
  };

  try {
    await sendEmailViaAPI(mailOptions);
  } catch (error) {
    console.error("Send verification email error:", error.message);
    throw new Error("Failed to send verification email");
  }
};

const sendPasswordResetEmail = async (email, resetToken) => {
  const mailOptions = {
    from: `"${process.env.COMPANY_NAME}" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Reset Your Password - ' + process.env.COMPANY_NAME,
    html: `
     <img src="${process.env.COMPANY_LOGO}" alt="Logo" style="width: 200px; height: auto;"/>
      <h1>Reset Your Password</h1>
      <p>Please click the link below to reset your password:</p>
      <a href="${process.env.BASE_URL}forgot-password-reset?token=${resetToken}">
        Reset Password
      </a>
      <p>This link will expire in 10 min.</p>
      <p>If you didn't request this, please ignore this email.</p>
    `
  };

  try {
    await sendEmailViaAPI(mailOptions);
  } catch (error) {
    console.error('Send password reset email error:', error);
    throw new Error('Failed to send password reset email');
  }
};

const sendContactEmail = async ({ name, email, description }) => {
  const mailOptions = {
    from: `"${process.env.COMPANY_NAME}" <${process.env.EMAIL_USER}>`,
    to: process.env.CONTACT_RECEIVER_EMAIL, 
    subject: `New Contact Form Message from ${name}`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6;">
        <img src="${process.env.COMPANY_LOGO}" alt="Logo" style="width: 200px; height: auto;" />
        <h2>New Contact Form Submission</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Message:</strong></p>
        <div style="padding: 12px; background: #f7f7f7; border-radius: 8px; white-space: pre-line;">
          ${description}
        </div>
      </div>
    `,
  };

  try {
    await sendEmailViaAPI(mailOptions);
  } catch (error) {
    console.error("Send contact email error:", error.message);
    throw new Error("Failed to send contact email");
  }
};
const sendOrderConfirmationEmail = async (userEmail, adminEmail, order) => {
  const itemsList = order.items.map(item => {
  

    return `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #eee;">
    
        <div>
          <strong>${item.name}</strong><br/>
          Qty: ${item.quantity}
        </div>
      </td>
      <td style="text-align:right;">$${(item.price?.sellingPrice || 0).toFixed(2)}</td>
      <td style="text-align:center;">${item.quantity}</td>
      <td style="text-align:right;">$${((item.price?.sellingPrice || 0) * item.quantity).toFixed(2)}</td>
    </tr>`;
  }).join('');

  const mailOptions = {
    from: `"${process.env.COMPANY_NAME}" <${process.env.EMAIL_USER}>`,
    to: userEmail,
    bcc: adminEmail,
    subject: `Order Confirmation - #${order._id.toString().slice(-6)}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width:600px; margin:auto; padding:20px; background:#f9fafb;">
        <div style="text-align:center;">
           ${process.env.COMPANY_LOGO ? `<img src="${process.env.COMPANY_LOGO}" style="width:150px;" />` : ''}
           <h1>Order Confirmation</h1>
           <p>Thank you for your purchase from ${process.env.COMPANY_NAME}!</p>
        </div>
        <div style="background:white; padding:20px; border-radius:8px;">
          <p><strong>Order ID:</strong> #${order._id.toString().slice(-6)}</p>
          <p><strong>Date:</strong> ${new Date(order.createdAt).toLocaleString()}</p>
          <table style="width:100%; border-collapse:collapse;">
            <thead><tr style="background:#f3f4f6;">
              <th align="left">Item</th><th align="right">Price</th><th align="center">Qty</th><th align="right">Total</th>
            </tr></thead>
            <tbody>${itemsList}</tbody>
          </table>
          <hr/>
          <h3>Total Paid: $${(order.pricing?.total || 0).toFixed(2)}</h3>
        </div>
      </div>
    `
  };

  try {
    return await sendEmailViaAPI(mailOptions);
  } catch (error) {
    console.error("Send order confirmation email error:", error.message);
    throw new Error("Failed to send order confirmation email");
  }
};


const sendOrderStatusEmail = async (userEmail, order, status) => {

  const statusConfig = {
    shipped: {
      subject:  `Your Order Has Been Shipped! 🚚 - #${order._id.toString().slice(-6)}`,
      heading:  "Your Order is On Its Way!",
      subtext:  "Great news! Your order has been shipped and is heading to you.",
      color:    "#7c3aed",
      emoji:    "🚚",
      extraHtml: order.deliveryPartner ? `
        <div style="background:#f5f3ff; border:1px solid #ddd6fe; border-radius:8px; padding:16px; margin-top:16px;">
          <h3 style="margin:0 0 12px; color:#6d28d9;">Shipping Details</h3>
          <table style="width:100%;">
            <tr>
              <td style="color:#6b7280; padding:4px 0;">Courier Partner</td>
              <td style="font-weight:bold; text-align:right;">${order.deliveryPartner.name}</td>
            </tr>
            <tr>
              <td style="color:#6b7280; padding:4px 0;">Tracking ID</td>
              <td style="font-weight:bold; text-align:right; font-family:monospace;">${order.deliveryPartner.trackingId}</td>
            </tr>
            ${order.deliveryPartner.estimatedDelivery ? `
            <tr>
              <td style="color:#6b7280; padding:4px 0;">Estimated Delivery</td>
              <td style="font-weight:bold; text-align:right;">${new Date(order.deliveryPartner.estimatedDelivery).toLocaleDateString("en-AU", { weekday:"long", year:"numeric", month:"long", day:"numeric" })}</td>
            </tr>` : ""}
          </table>
        </div>` : "",
    },

    cancelled: {
      subject:  `Order Cancelled - #${order._id.toString().slice(-6)}`,
      heading:  "Your Order Has Been Cancelled",
      subtext:  "We're sorry to inform you that your order has been cancelled.",
      color:    "#dc2626",
      emoji:    "❌",
      extraHtml: order.cancellationDetails ? `
        <div style="background:#fef2f2; border:1px solid #fecaca; border-radius:8px; padding:16px; margin-top:16px;">
          <h3 style="margin:0 0 12px; color:#dc2626;">Cancellation Details</h3>
          <table style="width:100%;">
            <tr>
              <td style="color:#6b7280; padding:4px 0;">Reason</td>
              <td style="font-weight:bold; text-align:right; text-transform:capitalize;">${(order.cancellationDetails.reason || "").replaceAll("-", " ")}</td>
            </tr>
            ${order.cancellationDetails.notes ? `
            <tr>
              <td style="color:#6b7280; padding:4px 0;">Notes</td>
              <td style="font-weight:bold; text-align:right;">${order.cancellationDetails.notes}</td>
            </tr>` : ""}
            <tr>
              <td style="color:#6b7280; padding:4px 0;">Refund Method</td>
              <td style="font-weight:bold; text-align:right; text-transform:capitalize;">${(order.cancellationDetails.refundMethod || "no_refund").replaceAll("_", " ")}</td>
            </tr>
          </table>
        </div>` : "",
    },

    refund_completed: {
      subject:  `Refund Processed - #${order._id.toString().slice(-6)}`,
      heading:  "Your Refund Has Been Processed",
      subtext:  "Good news! Your refund has been successfully processed.",
      color:    "#d97706",
      emoji:    "💰",
      extraHtml: order.refundDetails ? `
        <div style="background:#fffbeb; border:1px solid #fde68a; border-radius:8px; padding:16px; margin-top:16px;">
          <h3 style="margin:0 0 12px; color:#d97706;">Refund Details</h3>
          <table style="width:100%;">
            <tr>
              <td style="color:#6b7280; padding:4px 0;">Refund Amount</td>
              <td style="font-weight:bold; text-align:right; color:#059669; font-size:18px;">$${(order.refundDetails.refundAmount || 0).toFixed(2)}</td>
            </tr>
            <tr>
              <td style="color:#6b7280; padding:4px 0;">Refund Method</td>
              <td style="font-weight:bold; text-align:right; text-transform:capitalize;">${(order.refundDetails.refundMethod || "").replaceAll("_", " ")}</td>
            </tr>
            ${order.refundDetails.referenceId ? `
            <tr>
              <td style="color:#6b7280; padding:4px 0;">Reference ID</td>
              <td style="font-weight:bold; text-align:right; font-family:monospace;">${order.refundDetails.referenceId}</td>
            </tr>` : ""}
            ${order.refundDetails.reason ? `
            <tr>
              <td style="color:#6b7280; padding:4px 0;">Reason</td>
              <td style="font-weight:bold; text-align:right; text-transform:capitalize;">${(order.refundDetails.reason || "").replaceAll("-", " ")}</td>
            </tr>` : ""}
            <tr>
              <td style="color:#6b7280; padding:4px 0;">Processed At</td>
              <td style="font-weight:bold; text-align:right;">${new Date(order.refundDetails.processedAt || Date.now()).toLocaleString()}</td>
            </tr>
          </table>
        </div>` : "",
    },

    confirmed: {
      subject:  `Order Confirmed ✅ - #${order._id.toString().slice(-6)}`,
      heading:  "Order Confirmed!",
      subtext:  "Your order has been confirmed and is being prepared.",
      color:    "#059669",
      emoji:    "✅",
      extraHtml: "",
    },

    delivered: {
      subject:  `Order Delivered 🎉 - #${order._id.toString().slice(-6)}`,
      heading:  "Your Order Has Been Delivered!",
      subtext:  "We hope you love your N-Organics products!",
      color:    "#0d9488",
      emoji:    "🎉",
      extraHtml: "",
    },
  };

  const cfg = statusConfig[status] || {
    subject:  `Order Update - #${order._id.toString().slice(-6)}`,
    heading:  "Order Status Updated",
    subtext:  `Your order status has been updated to: ${status}`,
    color:    "#457358",
    emoji:    "📦",
    extraHtml: "",
  };

  const itemsList = (order.items || []).map(item => `
    <tr>
      <td style="padding:12px; border-bottom:1px solid #eee;">
        <strong>${item.name}</strong><br/>
        <span style="color:#6b7280; font-size:12px;">SKU: ${item.variantSku || "—"} | Qty: ${item.quantity}</span>
      </td>
      <td style="text-align:right; padding:12px; border-bottom:1px solid #eee;">$${(item.price?.sellingPrice || 0).toFixed(2)}</td>
      <td style="text-align:center; padding:12px; border-bottom:1px solid #eee;">${item.quantity}</td>
      <td style="text-align:right; padding:12px; border-bottom:1px solid #eee;">$${((item.price?.sellingPrice || 0) * item.quantity).toFixed(2)}</td>
    </tr>
  `).join("");

  const mailOptions = {
    from:    `"${process.env.COMPANY_NAME}" <${process.env.EMAIL_USER}>`,
    to:      userEmail,
    subject: cfg.subject,
    html: `
      <div style="font-family:Arial,sans-serif; max-width:600px; margin:auto; padding:20px; background:#f9fafb;">

        <!-- Header -->
        <div style="text-align:center; margin-bottom:24px;">
          ${process.env.COMPANY_LOGO ? `<img src="${process.env.COMPANY_LOGO}" style="width:150px; margin-bottom:12px;" />` : ""}
          <div style="font-size:48px;">${cfg.emoji}</div>
          <h1 style="color:${cfg.color}; margin:8px 0;">${cfg.heading}</h1>
          <p style="color:#6b7280;">${cfg.subtext}</p>
        </div>

        <!-- Order Info -->
        <div style="background:white; padding:20px; border-radius:8px; margin-bottom:16px; border:1px solid #e5e7eb;">
          <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
            <span style="color:#6b7280;">Order ID</span>
            <strong style="font-family:monospace;">#${order._id.toString().slice(-6).toUpperCase()}</strong>
          </div>
          <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
            <span style="color:#6b7280;">Order Date</span>
            <strong>${new Date(order.createdAt).toLocaleDateString("en-AU", { year:"numeric", month:"long", day:"numeric" })}</strong>
          </div>
          <div style="display:flex; justify-content:space-between;">
            <span style="color:#6b7280;">Status</span>
            <strong style="color:${cfg.color}; text-transform:capitalize;">${status.replaceAll("_", " ")}</strong>
          </div>
        </div>

        <!-- Status-specific extra content -->
        ${cfg.extraHtml}

        <!-- Items -->
        <div style="background:white; padding:20px; border-radius:8px; margin-top:16px; border:1px solid #e5e7eb;">
          <h3 style="margin:0 0 12px;">Order Items</h3>
          <table style="width:100%; border-collapse:collapse;">
            <thead>
              <tr style="background:#f3f4f6;">
                <th align="left" style="padding:8px;">Item</th>
                <th align="right" style="padding:8px;">Price</th>
                <th align="center" style="padding:8px;">Qty</th>
                <th align="right" style="padding:8px;">Total</th>
              </tr>
            </thead>
            <tbody>${itemsList}</tbody>
          </table>
          <hr style="margin:12px 0; border:none; border-top:1px solid #e5e7eb;" />
          <div style="display:flex; justify-content:space-between;">
            <strong>Order Total</strong>
            <strong style="color:#059669; font-size:18px;">$${(order.pricing?.total || 0).toFixed(2)} AUD</strong>
          </div>
        </div>

        <!-- Shipping Address -->
        ${order.shippingAddress ? `
        <div style="background:white; padding:20px; border-radius:8px; margin-top:16px; border:1px solid #e5e7eb;">
          <h3 style="margin:0 0 12px;">Delivering To</h3>
          <p style="margin:0; color:#374151;">
            <strong>${order.shippingAddress.fullName}</strong><br/>
            ${order.shippingAddress.addl1}<br/>
            ${order.shippingAddress.city}, ${order.shippingAddress.state} - ${order.shippingAddress.pincode}<br/>
            ${order.shippingAddress.country}
          </p>
        </div>` : ""}

        <!-- Footer -->
        <div style="text-align:center; margin-top:24px; color:#9ca3af; font-size:12px;">
          <p>Questions? Reply to this email or contact our support team.</p>
          <p>© ${new Date().getFullYear()} ${process.env.COMPANY_NAME}. All rights reserved.</p>
        </div>

      </div>
    `,
  };

  try {
    return await sendEmailViaAPI(mailOptions);
  } catch (error) {
    console.error("Send order status email error:", error.message);
    throw new Error("Failed to send order status email");
  }
};


module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendContactEmail,
  sendOrderConfirmationEmail, 
  sendOrderStatusEmail
};
