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
      <td style="text-align:right;">$${(item.sellingPrice || 0).toFixed(2)}</td>
      <td style="text-align:center;">${item.quantity}</td>
      <td style="text-align:right;">$${((item.lineTotal || 0)).toFixed(2)}</td>
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

  // ❌ Skip unwanted email statuses
  const excludedStatuses = [
    "out_for_delivery",
    "return_request",
    "returned",
    "return_initiated",
  ];

  if (excludedStatuses.includes(status)) {
    console.log(`Skipping email for status: ${status}`);
    return;
  }

  // ---------------- STATUS CONFIG ----------------
  const statusConfig = {
    shipped: {
      subject: `Your Order Has Been Shipped! 🚚 - #${order._id.toString().slice(-6)}`,
      heading: "Your Order is On Its Way!",
      subtext: "Great news! Your order has been shipped and is heading to you.",
      color: "#7c3aed",
      emoji: "🚚",
      extraHtml: order.deliveryPartner
        ? `
        <div style="background:#f5f3ff; border:1px solid #ddd6fe; border-radius:8px; padding:16px; margin-top:16px;">
          <h3 style="margin:0 0 12px; color:#6d28d9;">Shipping Details</h3>
          <table style="width:100%;">
            <tr>
              <td>Courier Partner</td>
              <td style="text-align:right;font-weight:bold;">${order.deliveryPartner.name}</td>
            </tr>
            <tr>
              <td>Tracking ID</td>
              <td style="text-align:right;font-weight:bold;font-family:monospace;">
                ${order.deliveryPartner.trackingId}
              </td>
            </tr>
          </table>
        </div>`
        : "",
    },

    cancelled: {
      subject: `Order Cancelled - #${order._id.toString().slice(-6)}`,
      heading: "Order Cancelled",
      subtext: "Your order has been cancelled.",
      color: "#dc2626",
      emoji: "❌",
      extraHtml: "",
    },

    refund_completed: {
      subject: `Refund Processed - #${order._id.toString().slice(-6)}`,
      heading: "Refund Completed",
      subtext: "Your refund has been processed successfully.",
      color: "#d97706",
      emoji: "💰",
      extraHtml: "",
    },

    confirmed: {
      subject: `Order Confirmed ✅ - #${order._id.toString().slice(-6)}`,
      heading: "Order Confirmed!",
      subtext: "We are preparing your order.",
      color: "#059669",
      emoji: "✅",
      extraHtml: "",
    },

    delivered: {
      subject: `Order Delivered 🎉 - #${order._id.toString().slice(-6)}`,
      heading: "Order Delivered!",
      subtext: "Hope you enjoy your products!",
      color: "#0d9488",
      emoji: "🎉",
      extraHtml: "",
    },
  };

  const cfg = statusConfig[status] || {
    subject: `Order Update - #${order._id.toString().slice(-6)}`,
    heading: "Order Update",
    subtext: `Status changed to ${status}`,
    color: "#374151",
    emoji: "📦",
    extraHtml: "",
  };

  // ---------------- CURRENCY ----------------
  const currency = order.payment?.currency || "AUD";

  const formatCurrency = (amount) =>
    new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency,
    }).format(amount || 0);

  // ---------------- ITEMS TABLE ----------------
  const itemsList = (order.items || [])
    .map(
      (item) => `
      <tr>
        <td style="padding:10px;border-bottom:1px solid #eee;">
          <strong>${item.name}</strong><br/>
          <span style="font-size:12px;color:#6b7280;">
            SKU: ${item.sku || "—"} | Qty: ${item.quantity}
          </span>
        </td>
        <td style="text-align:right;padding:10px;border-bottom:1px solid #eee;">
          ${formatCurrency(item.pricing?.pricePerUnit || item.sellingPrice)}
        </td>
        <td style="text-align:center;padding:10px;border-bottom:1px solid #eee;">
          ${item.quantity}
        </td>
        <td style="text-align:right;padding:10px;border-bottom:1px solid #eee;">
          ${formatCurrency(item.lineTotal || 0)}
        </td>
      </tr>
    `
    )
    .join("");

  // ---------------- PAYMENT BREAKDOWN ----------------
  const pricing = order.pricing || {};

  const pricingBreakdown = `
    <div style="margin-top:20px;padding-top:16px;border-top:2px dashed #e5e7eb;">

      <h3 style="font-size:16px;margin-bottom:10px;">Payment Summary</h3>

      <table style="width:100%;font-size:14px;color:#374151;">

        <tr>
          <td>Subtotal</td>
          <td style="text-align:right;">${formatCurrency(pricing.subtotal)}</td>
        </tr>

        ${
          pricing.voucherDiscount > 0
            ? `
        <tr>
          <td style="color:#dc2626;">Voucher Discount</td>
          <td style="text-align:right;color:#dc2626;">
            -${formatCurrency(pricing.voucherDiscount)}
          </td>
        </tr>`
            : ""
        }

        <tr>
          <td>Delivery Charge</td>
          <td style="text-align:right;">
            ${
              pricing.deliveryCharge > 0
                ? formatCurrency(pricing.deliveryCharge)
                : "<span style='color:#16a34a;'>Free</span>"
            }
          </td>
        </tr>

        <tr>
          <td style="border-top:1px solid #e5e7eb;padding-top:8px;font-weight:bold;">
            Total Paid
          </td>
          <td style="text-align:right;border-top:1px solid #e5e7eb;padding-top:8px;font-weight:bold;color:#059669;font-size:16px;">
            ${formatCurrency(pricing.total)}
          </td>
        </tr>

      </table>
    </div>
  `;

  // ---------------- EMAIL ----------------
  const mailOptions = {
    from: `"${process.env.COMPANY_NAME}" <${process.env.EMAIL_USER}>`,
    to: userEmail,
    subject: cfg.subject,
    html: `
      <div style="font-family:Arial;background:#f9fafb;padding:20px;max-width:600px;margin:auto;">

        <!-- HEADER -->
        <div style="text-align:center;">
          <div style="font-size:40px;">${cfg.emoji}</div>
          <h2 style="color:${cfg.color};margin:10px 0;">${cfg.heading}</h2>
          <p style="color:#6b7280;">${cfg.subtext}</p>
        </div>

        <!-- STATUS EXTRA -->
        ${cfg.extraHtml}

        <!-- ITEMS -->
        <div style="background:#fff;padding:16px;border-radius:8px;margin-top:16px;">
          <h3>Order Items</h3>

          <table style="width:100%;border-collapse:collapse;">
            <thead>
              <tr style="background:#f3f4f6;">
                <th align="left">Item</th>
                <th align="right">Price</th>
                <th align="center">Qty</th>
                <th align="right">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsList}
            </tbody>
          </table>

          ${pricingBreakdown}

        </div>

        <!-- FOOTER -->
        <div style="text-align:center;font-size:12px;color:#9ca3af;margin-top:20px;">
          © ${new Date().getFullYear()} ${process.env.COMPANY_NAME}
        </div>

      </div>
    `,
  };

  try {
    return await sendEmailViaAPI(mailOptions);
  } catch (error) {
    console.error("Email send error:", error.message);
    throw new Error("Failed to send order email");
  }
};


module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendContactEmail,
  sendOrderConfirmationEmail, 
  sendOrderStatusEmail
};
