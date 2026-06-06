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




/* =====================================================
   emailTemplates.js  –  AM Robotics Order Emails
   Reads currency from order.payment.currency
   ===================================================== */

/* ── Currency formatter ───────────────────────────── */
function formatCurrency(amount, currency = "INR") {
  const symbolMap = {
    INR: "₹",
    USD: "$",
    AUD: "A$",
    GBP: "£",
    EUR: "€",
  };

  const localeMap = {
    INR: "en-IN",
    USD: "en-US",
    AUD: "en-AU",
    GBP: "en-GB",
    EUR: "de-DE",
  };

  const symbol = symbolMap[currency] || currency + " ";
  const locale = localeMap[currency] || "en-IN";

  return symbol + Number(amount || 0).toLocaleString(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/* ═══════════════════════════════════════════════════
   sendOrderConfirmationEmail
   Called right after order is created successfully
   ═══════════════════════════════════════════════════ */
const sendOrderConfirmationEmail = async (userEmail, adminEmail, order) => {

  const currency  = order.payment?.currency || "INR";
  const fmt       = (n) => formatCurrency(n, currency);

  const pricing  = order.pricing          || {};
  const payment  = order.payment          || {};
  const addr     = order.shippingAddress  || {};
  const voucher  = order.appliedVoucher   || {};

  const orderId   = order._id.toString().slice(-8).toUpperCase();
  const orderDate = new Date(order.createdAt).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

  /* ── Items rows ─────────────────────────────────── */
  const itemsList = (order.items || []).map(item => {
    const imageHtml = item.image
      ? `<img src="${item.image}" alt="${item.name}"
             style="width:64px;height:64px;object-fit:cover;border-radius:10px;
                    border:1px solid #e5e7eb;display:block;" />`
      : `<div style="width:64px;height:64px;background:#f3f4f6;border-radius:10px;
                    border:1px solid #e5e7eb;display:flex;align-items:center;
                    justify-content:center;font-size:22px;color:#9ca3af;">&#128230;</div>`;

    return `
    <tr>
      <td style="padding:14px 12px;border-bottom:1px solid #f0f1f5;vertical-align:middle;">
        <table cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="padding-right:14px;vertical-align:middle;">${imageHtml}</td>
            <td style="vertical-align:middle;">
              <div style="font-size:14px;font-weight:700;color:#1a1d2e;margin-bottom:4px;">
                ${item.name}
              </div>
              ${item.brand
                ? `<div style="font-size:12px;color:#6b7280;">Brand: ${item.brand}</div>`
                : ""}
              ${item.sku
                ? `<div style="font-size:11px;color:#aaa;font-family:monospace;margin-top:2px;">
                     SKU: ${item.sku}
                   </div>`
                : ""}
              ${item.discountPercent > 0
                ? `<div style="display:inline-block;margin-top:5px;background:#ecfdf5;color:#059669;
                               font-size:11px;font-weight:700;padding:2px 8px;border-radius:20px;">
                     ${item.discountPercent}% OFF
                   </div>`
                : ""}
            </td>
          </tr>
        </table>
      </td>
      <td style="padding:14px 12px;text-align:right;border-bottom:1px solid #f0f1f5;
                 vertical-align:middle;white-space:nowrap;">
        <div style="font-size:14px;font-weight:700;color:#059669;">${fmt(item.sellingPrice)}</div>
        ${item.originalPrice > item.sellingPrice
          ? `<div style="font-size:11px;color:#aaa;text-decoration:line-through;margin-top:2px;">
               ${fmt(item.originalPrice)}
             </div>`
          : ""}
      </td>
      <td style="padding:14px 12px;text-align:center;border-bottom:1px solid #f0f1f5;
                 vertical-align:middle;">
        <span style="background:#f3f4f6;color:#374151;border-radius:8px;
                     padding:4px 12px;font-weight:700;font-size:13px;">
          x${item.quantity}
        </span>
      </td>
      <td style="padding:14px 12px;text-align:right;border-bottom:1px solid #f0f1f5;
                 vertical-align:middle;white-space:nowrap;">
        <strong style="font-size:15px;color:#1a1d2e;">${fmt(item.lineTotal)}</strong>
      </td>
    </tr>`;
  }).join("");

  /* ── Pricing rows ───────────────────────────────── */
  const pricingRows = [
    {
      label: "Subtotal",
      value: fmt(pricing.subtotal),
      color: "#374151",
    },
    pricing.mrpSavings > 0
      ? { label: "MRP Savings", value: `-${fmt(pricing.mrpSavings)}`, color: "#059669" }
      : null,
    voucher.code && voucher.discountAmount > 0
      ? { label: `Voucher (${voucher.code})`, value: `-${fmt(voucher.discountAmount)}`, color: "#059669" }
      : null,
    pricing.deliveryCharge > 0
      ? { label: "Delivery Charge", value: fmt(pricing.deliveryCharge), color: "#374151" }
      : { label: "Delivery",        value: "Free",                       color: "#059669" },
    pricing.gstAmount > 0
      ? { label: "GST / Tax", value: fmt(pricing.gstAmount), color: "#374151" }
      : null,
  ]
  .filter(Boolean)
  .map(row => `
    <tr>
      <td colspan="3" style="padding:6px 12px;text-align:right;color:#6b7280;font-size:13px;">
        ${row.label}
      </td>
      <td style="padding:6px 12px;text-align:right;color:${row.color};
                 font-size:13px;font-weight:500;white-space:nowrap;">
        ${row.value}
      </td>
    </tr>`)
  .join("");

  /* ── Shipping address block ─────────────────────── */
  const shippingBlock = addr.address1 ? `
    <div style="background:#f9fafb;border-radius:12px;padding:18px 20px;
                margin-top:20px;border:1px solid #e5e7eb;">
      <div style="font-size:12px;font-weight:700;color:#9ca3af;text-transform:uppercase;
                  letter-spacing:1px;margin-bottom:10px;">
        Shipping Address
      </div>
      <div style="font-size:13px;color:#374151;line-height:1.9;">
        <strong style="color:#1a1d2e;font-size:14px;">
          ${addr.firstName || ""} ${addr.lastName || ""}
        </strong><br/>
        ${addr.phone ? `${addr.phone}<br/>` : ""}
        ${addr.address1}${addr.address2 ? ", " + addr.address2 : ""}<br/>
        ${addr.city}${addr.state ? ", " + addr.state : ""} &mdash; ${addr.postalCode || ""}<br/>
        ${addr.country || "India"}
      </div>
    </div>` : "";

  /* ── Payment block ──────────────────────────────── */
  const paymentStatusLabel = payment.status === "paid"
    ? "Payment Successful"
    : payment.status === "pending"
    ? "Payment Pending"
    : payment.status;

  const paymentBlock = `
    <div style="background:#f0fdf4;border-radius:12px;padding:14px 18px;
                margin-top:16px;border:1px solid #bbf7d0;">
      <div style="font-size:13px;color:#059669;font-weight:600;">
        ${paymentStatusLabel}
        &nbsp;&middot;&nbsp;
        Method: ${(payment.method || "").toUpperCase()}
        ${payment.paypalOrderId
          ? `&nbsp;&middot;&nbsp; Ref: <code style="font-size:11px;font-family:monospace;
                                                    color:#065f46;">${payment.paypalOrderId}</code>`
          : ""}
      </div>
    </div>`;

  /* ── Full email ─────────────────────────────────── */
  const mailOptions = {
    from:    `"${process.env.COMPANY_NAME}" <${process.env.EMAIL_USER}>`,
    to:      userEmail,
    bcc:     adminEmail,
    subject: `Order Confirmed #${orderId} — ${process.env.COMPANY_NAME}`,
    html: `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Order Confirmed</title>
    </head>
    <body style="margin:0;padding:0;background:#f3f4f8;font-family:'Segoe UI',Arial,sans-serif;">

      <div style="max-width:620px;margin:32px auto;background:#f3f4f8;padding:0 0 32px;">

        <!-- ── HEADER ── -->
        <div style="background:#0b1a0f;border-radius:16px 16px 0 0;
                    padding:32px 28px;text-align:center;">
          ${process.env.COMPANY_LOGO
            ? `<img src="${process.env.COMPANY_LOGO}" alt="${process.env.COMPANY_NAME}"
                   style="height:50px;margin-bottom:16px;display:block;margin-left:auto;margin-right:auto;" />`
            : `<div style="font-size:20px;font-weight:800;color:#fff;letter-spacing:1px;
                           margin-bottom:12px;">${process.env.COMPANY_NAME}</div>`}
          <div style="font-size:26px;font-weight:800;color:#ffffff;margin-bottom:6px;">
            Order Confirmed
          </div>
          <div style="font-size:14px;color:#86efac;">
            Thank you for shopping with ${process.env.COMPANY_NAME}
          </div>
        </div>

        <!-- ── ORDER META ── -->
        <div style="background:#ffffff;padding:20px 28px;
                    border-left:1px solid #e5e7eb;border-right:1px solid #e5e7eb;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding:0 16px 0 0;">
                <div style="font-size:11px;color:#9ca3af;text-transform:uppercase;
                            letter-spacing:.8px;margin-bottom:4px;">Order ID</div>
                <div style="font-size:16px;font-weight:800;color:#1a1d2e;
                            font-family:monospace;">#${orderId}</div>
              </td>
              <td style="padding:0 16px;">
                <div style="font-size:11px;color:#9ca3af;text-transform:uppercase;
                            letter-spacing:.8px;margin-bottom:4px;">Date</div>
                <div style="font-size:13px;font-weight:600;color:#374151;">${orderDate}</div>
              </td>
              <td style="padding:0 0 0 16px;text-align:right;">
                <div style="font-size:11px;color:#9ca3af;text-transform:uppercase;
                            letter-spacing:.8px;margin-bottom:6px;">Status</div>
                <span style="background:#ecfdf5;color:#059669;border-radius:20px;
                             padding:5px 14px;font-size:12px;font-weight:700;
                             text-transform:capitalize;">
                  ${(order.status || "confirmed").replace(/_/g, " ")}
                </span>
              </td>
            </tr>
          </table>
        </div>

        <!-- ── ITEMS TABLE ── -->
        <div style="background:#ffffff;padding:0 28px 4px;
                    border-left:1px solid #e5e7eb;border-right:1px solid #e5e7eb;">
          <div style="font-size:12px;font-weight:700;color:#9ca3af;text-transform:uppercase;
                      letter-spacing:1px;padding:18px 0 12px;">
            Order Items
          </div>
          <table width="100%" cellpadding="0" cellspacing="0"
                 style="border-collapse:collapse;border:1px solid #f0f1f5;border-radius:10px;overflow:hidden;">
            <thead>
              <tr style="background:#f9fafb;">
                <th align="left"   style="padding:10px 12px;font-size:11px;color:#9ca3af;
                                          font-weight:600;text-transform:uppercase;letter-spacing:.7px;">
                  Item
                </th>
                <th align="right"  style="padding:10px 12px;font-size:11px;color:#9ca3af;
                                          font-weight:600;text-transform:uppercase;letter-spacing:.7px;">
                  Price
                </th>
                <th align="center" style="padding:10px 12px;font-size:11px;color:#9ca3af;
                                          font-weight:600;text-transform:uppercase;letter-spacing:.7px;">
                  Qty
                </th>
                <th align="right"  style="padding:10px 12px;font-size:11px;color:#9ca3af;
                                          font-weight:600;text-transform:uppercase;letter-spacing:.7px;">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              ${itemsList}
              ${pricingRows}
              <tr style="background:#0b1a0f;">
                <td colspan="3"
                    style="padding:16px 12px;text-align:right;color:#86efac;
                           font-size:13px;font-weight:600;">
                  Total Paid
                </td>
                <td style="padding:16px 12px;text-align:right;color:#ffffff;
                           font-size:20px;font-weight:800;white-space:nowrap;">
                  ${fmt(pricing.total)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- ── PAYMENT + ADDRESS ── -->
        <div style="background:#ffffff;padding:4px 28px 28px;
                    border:1px solid #e5e7eb;border-top:none;
                    border-radius:0 0 16px 16px;">
          ${paymentBlock}
          ${shippingBlock}
        </div>

        <!-- ── FOOTER ── -->
        <div style="text-align:center;padding:24px 20px 0;color:#9ca3af;font-size:12px;">
          <div style="margin-bottom:6px;">
            Questions? Contact us at
            <a href="mailto:${process.env.EMAIL_USER}"
               style="color:#059669;text-decoration:none;">
              ${process.env.EMAIL_USER}
            </a>
          </div>
          <div>&copy; ${new Date().getFullYear()} ${process.env.COMPANY_NAME}. All rights reserved.</div>
        </div>

      </div>
    </body>
    </html>`
  };

  try {
    return await sendEmailViaAPI(mailOptions);
  } catch (error) {
    console.error("[sendOrderConfirmationEmail] failed:", error.message);
    throw new Error("Failed to send order confirmation email");
  }
};

const sendOrderStatusEmail = async (userEmail, order, status) => {

  // statuses that don't need an email
  const excludedStatuses = [
    "out_for_delivery",
    "return_requested",
    "returned",
    "refund_initiated",
  ];

  if (excludedStatuses.includes(status)) {
    console.log(`[email] Skipping email for status: ${status}`);
    return;
  }

  const currency = order.payment?.currency || "INR";
  const fmt      = (n) => formatCurrency(n, currency);
  const pricing  = order.pricing || {};
  const payment  = order.payment || {};
  const orderId  = order._id.toString().slice(-8).toUpperCase();

  /* ── Status config ──────────────────────────────── */
  const statusConfig = {

    confirmed: {
      subject:    `Order Confirmed #${orderId} — ${process.env.COMPANY_NAME}`,
      heading:    "Order Confirmed",
      subheading: "We have received your order and are preparing it.",
      accentColor:"#059669",
      badgeBg:    "#ecfdf5",
      badgeColor: "#059669",
      badgeText:  "Confirmed",
      extraBlock: "",
    },

    processing: {
      subject:    `Your Order is Being Processed #${orderId}`,
      heading:    "Order is Being Processed",
      subheading: "Our team is carefully picking and packing your items.",
      accentColor:"#0284c7",
      badgeBg:    "#f0f9ff",
      badgeColor: "#0284c7",
      badgeText:  "Processing",
      extraBlock: "",
    },

    shipped: {
      subject:    `Your Order Has Been Shipped #${orderId}`,
      heading:    "Order Shipped",
      subheading: "Your order is on its way. Track it using the details below.",
      accentColor:"#7c3aed",
      badgeBg:    "#f5f3ff",
      badgeColor: "#7c3aed",
      badgeText:  "Shipped",
      extraBlock: order.delivery?.trackingId ? `
        <div style="background:#f5f3ff;border:1px solid #ddd6fe;border-radius:12px;
                    padding:18px 20px;margin-top:20px;">
          <div style="font-size:12px;font-weight:700;color:#7c3aed;text-transform:uppercase;
                      letter-spacing:1px;margin-bottom:12px;">
            Shipping Details
          </div>
          <table width="100%" cellpadding="0" cellspacing="0"
                 style="font-size:13px;color:#374151;">
            ${order.delivery.partnerName
              ? `<tr>
                   <td style="padding:5px 0;color:#6b7280;">Courier Partner</td>
                   <td style="text-align:right;font-weight:700;">${order.delivery.partnerName}</td>
                 </tr>`
              : ""}
            <tr>
              <td style="padding:5px 0;color:#6b7280;">Tracking ID</td>
              <td style="text-align:right;font-weight:700;font-family:monospace;">
                ${order.delivery.trackingId}
              </td>
            </tr>
            ${order.delivery.estimatedDelivery
              ? `<tr>
                   <td style="padding:5px 0;color:#6b7280;">Estimated Delivery</td>
                   <td style="text-align:right;font-weight:700;">
                     ${new Date(order.delivery.estimatedDelivery).toLocaleDateString("en-IN", {
                       day: "numeric", month: "short", year: "numeric"
                     })}
                   </td>
                 </tr>`
              : ""}
          </table>
        </div>` : "",
    },

    delivered: {
      subject:    `Order Delivered #${orderId} — Thank You!`,
      heading:    "Order Delivered",
      subheading: "Your order has been delivered. We hope you love your products!",
      accentColor:"#0d9488",
      badgeBg:    "#f0fdfa",
      badgeColor: "#0d9488",
      badgeText:  "Delivered",
      extraBlock: "",
    },

    cancelled: {
      subject:    `Order Cancelled #${orderId}`,
      heading:    "Order Cancelled",
      subheading: "Your order has been cancelled. We're sorry for the inconvenience.",
      accentColor:"#dc2626",
      badgeBg:    "#fef2f2",
      badgeColor: "#dc2626",
      badgeText:  "Cancelled",
      extraBlock: order.cancellation?.notes ? `
        <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:12px;
                    padding:14px 18px;margin-top:18px;">
          <div style="font-size:12px;font-weight:700;color:#dc2626;text-transform:uppercase;
                      letter-spacing:1px;margin-bottom:6px;">
            Cancellation Reason
          </div>
          <div style="font-size:13px;color:#374151;">${order.cancellation.notes}</div>
        </div>` : "",
    },

    refund_completed: {
      subject:    `Refund Processed #${orderId}`,
      heading:    "Refund Completed",
      subheading: "Your refund has been processed. It may take 3–7 business days to reflect.",
      accentColor:"#d97706",
      badgeBg:    "#fffbeb",
      badgeColor: "#d97706",
      badgeText:  "Refunded",
      extraBlock: order.refund?.refundAmount > 0 ? `
        <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:12px;
                    padding:14px 18px;margin-top:18px;">
          <div style="font-size:13px;color:#374151;">
            <strong>Refund Amount:</strong>
            <span style="color:#d97706;font-size:15px;font-weight:700;">
              ${fmt(order.refund.refundAmount)}
            </span>
            ${order.refund.referenceId
              ? `<br/><span style="font-size:12px;color:#9ca3af;font-family:monospace;">
                   Ref: ${order.refund.referenceId}
                 </span>`
              : ""}
          </div>
        </div>` : "",
    },

  };

  const cfg = statusConfig[status] || {
    subject:    `Order Update #${orderId} — ${process.env.COMPANY_NAME}`,
    heading:    "Order Update",
    subheading: `Your order status has been updated to: ${status.replace(/_/g, " ")}`,
    accentColor:"#374151",
    badgeBg:    "#f3f4f6",
    badgeColor: "#374151",
    badgeText:  status.replace(/_/g, " "),
    extraBlock: "",
  };

  /* ── Items rows ─────────────────────────────────── */
  const itemsList = (order.items || []).map(item => `
    <tr>
      <td style="padding:12px;border-bottom:1px solid #f0f1f5;vertical-align:middle;">
        <div style="font-size:14px;font-weight:600;color:#1a1d2e;margin-bottom:3px;">
          ${item.name}
        </div>
        <div style="font-size:12px;color:#9ca3af;">
          ${item.sku ? `SKU: ${item.sku}` : ""}
          ${item.sku && item.brand ? " &nbsp;&middot;&nbsp; " : ""}
          ${item.brand ? `Brand: ${item.brand}` : ""}
        </div>
      </td>
      <td style="padding:12px;text-align:right;border-bottom:1px solid #f0f1f5;
                 vertical-align:middle;white-space:nowrap;">
        <span style="font-size:14px;font-weight:600;color:#059669;">
          ${fmt(item.sellingPrice)}
        </span>
      </td>
      <td style="padding:12px;text-align:center;border-bottom:1px solid #f0f1f5;
                 vertical-align:middle;">
        <span style="background:#f3f4f6;color:#374151;border-radius:8px;
                     padding:4px 10px;font-size:13px;font-weight:700;">
          x${item.quantity}
        </span>
      </td>
      <td style="padding:12px;text-align:right;border-bottom:1px solid #f0f1f5;
                 vertical-align:middle;white-space:nowrap;">
        <strong style="font-size:14px;color:#1a1d2e;">${fmt(item.lineTotal)}</strong>
      </td>
    </tr>`).join("");

  /* ── Pricing summary ────────────────────────────── */
  const pricingSummary = `
    <div style="margin-top:16px;padding-top:14px;border-top:1px solid #e5e7eb;">
      <table width="100%" cellpadding="0" cellspacing="0"
             style="font-size:13px;color:#374151;">
        <tr>
          <td style="padding:5px 0;color:#6b7280;">Subtotal</td>
          <td style="text-align:right;font-weight:500;">${fmt(pricing.subtotal)}</td>
        </tr>
        ${pricing.voucherDiscount > 0
          ? `<tr>
               <td style="padding:5px 0;color:#059669;">Voucher Discount</td>
               <td style="text-align:right;color:#059669;font-weight:500;">
                 -${fmt(pricing.voucherDiscount)}
               </td>
             </tr>`
          : ""}
        <tr>
          <td style="padding:5px 0;color:#6b7280;">Delivery</td>
          <td style="text-align:right;font-weight:500;">
            ${pricing.deliveryCharge > 0
              ? fmt(pricing.deliveryCharge)
              : `<span style="color:#059669;">Free</span>`}
          </td>
        </tr>
        ${pricing.gstAmount > 0
          ? `<tr>
               <td style="padding:5px 0;color:#6b7280;">GST / Tax</td>
               <td style="text-align:right;font-weight:500;">${fmt(pricing.gstAmount)}</td>
             </tr>`
          : ""}
        <tr style="border-top:2px solid #e5e7eb;">
          <td style="padding:10px 0 0;font-weight:700;font-size:15px;color:#1a1d2e;">
            Total
          </td>
          <td style="padding:10px 0 0;text-align:right;font-weight:800;
                     font-size:17px;color:#059669;">
            ${fmt(pricing.total)}
          </td>
        </tr>
      </table>
    </div>`;

  /* ── Payment info row ───────────────────────────── */
  const paymentRow = `
    <div style="margin-top:14px;padding:12px 16px;background:#f9fafb;
                border-radius:10px;border:1px solid #e5e7eb;">
      <div style="font-size:12px;color:#6b7280;">
        Payment &nbsp;&middot;&nbsp;
        <strong style="color:#374151;">${(payment.method || "").toUpperCase()}</strong>
        &nbsp;&middot;&nbsp;
        <span style="color:${payment.status === "paid" ? "#059669" : "#d97706"};font-weight:600;">
          ${payment.status === "paid" ? "Paid" : "Pending"}
        </span>
        ${payment.paypalOrderId
          ? `&nbsp;&middot;&nbsp; <code style="font-family:monospace;font-size:11px;
                                               color:#9ca3af;">${payment.paypalOrderId}</code>`
          : ""}
      </div>
    </div>`;

  /* ── Full email ─────────────────────────────────── */
  const mailOptions = {
    from:    `"${process.env.COMPANY_NAME}" <${process.env.EMAIL_USER}>`,
    to:      userEmail,
    subject: cfg.subject,
    html: `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${cfg.heading}</title>
    </head>
    <body style="margin:0;padding:0;background:#f3f4f8;font-family:'Segoe UI',Arial,sans-serif;">

      <div style="max-width:600px;margin:32px auto;background:#f3f4f8;padding:0 0 32px;">

        <!-- ── HEADER ── -->
        <div style="background:${cfg.accentColor};border-radius:16px 16px 0 0;
                    padding:32px 28px;text-align:center;">
          ${process.env.COMPANY_LOGO
            ? `<img src="${process.env.COMPANY_LOGO}" alt="${process.env.COMPANY_NAME}"
                   style="height:44px;margin-bottom:14px;display:block;
                          margin-left:auto;margin-right:auto;" />`
            : `<div style="font-size:16px;font-weight:800;color:rgba(255,255,255,.75);
                           letter-spacing:1px;margin-bottom:10px;">
                 ${process.env.COMPANY_NAME}
               </div>`}
          <div style="font-size:26px;font-weight:800;color:#ffffff;margin-bottom:8px;">
            ${cfg.heading}
          </div>
          <div style="font-size:14px;color:rgba(255,255,255,.8);">
            ${cfg.subheading}
          </div>
        </div>

        <!-- ── ORDER META ── -->
        <div style="background:#ffffff;padding:18px 28px;
                    border-left:1px solid #e5e7eb;border-right:1px solid #e5e7eb;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td>
                <div style="font-size:11px;color:#9ca3af;text-transform:uppercase;
                            letter-spacing:.8px;margin-bottom:4px;">Order ID</div>
                <div style="font-size:16px;font-weight:800;color:#1a1d2e;
                            font-family:monospace;">#${orderId}</div>
              </td>
              <td style="text-align:right;">
                <span style="background:${cfg.badgeBg};color:${cfg.badgeColor};
                             border-radius:20px;padding:6px 16px;
                             font-size:12px;font-weight:700;text-transform:capitalize;">
                  ${cfg.badgeText}
                </span>
              </td>
            </tr>
          </table>
          ${cfg.extraBlock}
        </div>

        <!-- ── ITEMS ── -->
        <div style="background:#ffffff;padding:0 28px 4px;
                    border-left:1px solid #e5e7eb;border-right:1px solid #e5e7eb;">
          <div style="font-size:12px;font-weight:700;color:#9ca3af;text-transform:uppercase;
                      letter-spacing:1px;padding:16px 0 10px;">
            Order Items
          </div>
          <table width="100%" cellpadding="0" cellspacing="0"
                 style="border-collapse:collapse;border:1px solid #f0f1f5;
                        border-radius:10px;overflow:hidden;">
            <thead>
              <tr style="background:#f9fafb;">
                <th align="left"   style="padding:9px 12px;font-size:11px;color:#9ca3af;
                                          font-weight:600;text-transform:uppercase;">Item</th>
                <th align="right"  style="padding:9px 12px;font-size:11px;color:#9ca3af;
                                          font-weight:600;text-transform:uppercase;">Price</th>
                <th align="center" style="padding:9px 12px;font-size:11px;color:#9ca3af;
                                          font-weight:600;text-transform:uppercase;">Qty</th>
                <th align="right"  style="padding:9px 12px;font-size:11px;color:#9ca3af;
                                          font-weight:600;text-transform:uppercase;">Total</th>
              </tr>
            </thead>
            <tbody>${itemsList}</tbody>
          </table>
          ${pricingSummary}
        </div>

        <!-- ── PAYMENT ── -->
        <div style="background:#ffffff;padding:4px 28px 28px;border:1px solid #e5e7eb;
                    border-top:none;border-radius:0 0 16px 16px;">
          ${paymentRow}
        </div>

        <!-- ── FOOTER ── -->
        <div style="text-align:center;padding:24px 20px 0;color:#9ca3af;font-size:12px;">
          <div style="margin-bottom:4px;">
            Need help? Contact us at
            <a href="mailto:${process.env.EMAIL_USER}"
               style="color:#059669;text-decoration:none;">
              ${process.env.EMAIL_USER}
            </a>
          </div>
          <div>&copy; ${new Date().getFullYear()} ${process.env.COMPANY_NAME}. All rights reserved.</div>
        </div>

      </div>
    </body>
    </html>`
  };

  try {
    return await sendEmailViaAPI(mailOptions);
  } catch (error) {
    console.error("[sendOrderStatusEmail] failed:", error.message);
    throw new Error("Failed to send order status email");
  }
};




// const sendOrderStatusEmail = async (userEmail, order, status) => {

//   // ❌ Skip unwanted email statuses
//   const excludedStatuses = [
//     "out_for_delivery",
//     "return_request",
//     "returned",
//     "return_initiated",
//   ];

//   if (excludedStatuses.includes(status)) {
//     console.log(`Skipping email for status: ${status}`);
//     return;
//   }

//   // ---------------- STATUS CONFIG ----------------
//   const statusConfig = {
//     shipped: {
//       subject: `Your Order Has Been Shipped! 🚚 - #${order._id.toString().slice(-6)}`,
//       heading: "Your Order is On Its Way!",
//       subtext: "Great news! Your order has been shipped and is heading to you.",
//       color: "#7c3aed",
//       emoji: "🚚",
//       extraHtml: order.deliveryPartner
//         ? `
//         <div style="background:#f5f3ff; border:1px solid #ddd6fe; border-radius:8px; padding:16px; margin-top:16px;">
//           <h3 style="margin:0 0 12px; color:#6d28d9;">Shipping Details</h3>
//           <table style="width:100%;">
//             <tr>
//               <td>Courier Partner</td>
//               <td style="text-align:right;font-weight:bold;">${order.deliveryPartner.name}</td>
//             </tr>
//             <tr>
//               <td>Tracking ID</td>
//               <td style="text-align:right;font-weight:bold;font-family:monospace;">
//                 ${order.deliveryPartner.trackingId}
//               </td>
//             </tr>
//           </table>
//         </div>`
//         : "",
//     },

//     cancelled: {
//       subject: `Order Cancelled - #${order._id.toString().slice(-6)}`,
//       heading: "Order Cancelled",
//       subtext: "Your order has been cancelled.",
//       color: "#dc2626",
//       emoji: "❌",
//       extraHtml: "",
//     },

//     refund_completed: {
//       subject: `Refund Processed - #${order._id.toString().slice(-6)}`,
//       heading: "Refund Completed",
//       subtext: "Your refund has been processed successfully.",
//       color: "#d97706",
//       emoji: "💰",
//       extraHtml: "",
//     },

//     confirmed: {
//       subject: `Order Confirmed ✅ - #${order._id.toString().slice(-6)}`,
//       heading: "Order Confirmed!",
//       subtext: "We are preparing your order.",
//       color: "#059669",
//       emoji: "✅",
//       extraHtml: "",
//     },

//     delivered: {
//       subject: `Order Delivered 🎉 - #${order._id.toString().slice(-6)}`,
//       heading: "Order Delivered!",
//       subtext: "Hope you enjoy your products!",
//       color: "#0d9488",
//       emoji: "🎉",
//       extraHtml: "",
//     },
//   };

//   const cfg = statusConfig[status] || {
//     subject: `Order Update - #${order._id.toString().slice(-6)}`,
//     heading: "Order Update",
//     subtext: `Status changed to ${status}`,
//     color: "#374151",
//     emoji: "📦",
//     extraHtml: "",
//   };

//   // ---------------- CURRENCY ----------------
//   const currency = order.payment?.currency || "AUD";

//   const formatCurrency = (amount) =>
//     new Intl.NumberFormat("en-AU", {
//       style: "currency",
//       currency,
//     }).format(amount || 0);

//   // ---------------- ITEMS TABLE ----------------
//   const itemsList = (order.items || [])
//     .map(
//       (item) => `
//       <tr>
//         <td style="padding:10px;border-bottom:1px solid #eee;">
//           <strong>${item.name}</strong><br/>
//           <span style="font-size:12px;color:#6b7280;">
//             SKU: ${item.sku || "—"} | Qty: ${item.quantity}
//           </span>
//         </td>
//         <td style="text-align:right;padding:10px;border-bottom:1px solid #eee;">
//           ${formatCurrency(item.pricing?.pricePerUnit || item.sellingPrice)}
//         </td>
//         <td style="text-align:center;padding:10px;border-bottom:1px solid #eee;">
//           ${item.quantity}
//         </td>
//         <td style="text-align:right;padding:10px;border-bottom:1px solid #eee;">
//           ${formatCurrency(item.lineTotal || 0)}
//         </td>
//       </tr>
//     `
//     )
//     .join("");

//   // ---------------- PAYMENT BREAKDOWN ----------------
//   const pricing = order.pricing || {};

//   const pricingBreakdown = `
//     <div style="margin-top:20px;padding-top:16px;border-top:2px dashed #e5e7eb;">

//       <h3 style="font-size:16px;margin-bottom:10px;">Payment Summary</h3>

//       <table style="width:100%;font-size:14px;color:#374151;">

//         <tr>
//           <td>Subtotal</td>
//           <td style="text-align:right;">${formatCurrency(pricing.subtotal)}</td>
//         </tr>

//         ${
//           pricing.voucherDiscount > 0
//             ? `
//         <tr>
//           <td style="color:#dc2626;">Voucher Discount</td>
//           <td style="text-align:right;color:#dc2626;">
//             -${formatCurrency(pricing.voucherDiscount)}
//           </td>
//         </tr>`
//             : ""
//         }

//         <tr>
//           <td>Delivery Charge</td>
//           <td style="text-align:right;">
//             ${
//               pricing.deliveryCharge > 0
//                 ? formatCurrency(pricing.deliveryCharge)
//                 : "<span style='color:#16a34a;'>Free</span>"
//             }
//           </td>
//         </tr>

//         <tr>
//           <td style="border-top:1px solid #e5e7eb;padding-top:8px;font-weight:bold;">
//             Total Paid
//           </td>
//           <td style="text-align:right;border-top:1px solid #e5e7eb;padding-top:8px;font-weight:bold;color:#059669;font-size:16px;">
//             ${formatCurrency(pricing.total)}
//           </td>
//         </tr>

//       </table>
//     </div>
//   `;

//   // ---------------- EMAIL ----------------
//   const mailOptions = {
//     from: `"${process.env.COMPANY_NAME}" <${process.env.EMAIL_USER}>`,
//     to: userEmail,
//     subject: cfg.subject,
//     html: `
//       <div style="font-family:Arial;background:#f9fafb;padding:20px;max-width:600px;margin:auto;">

//         <!-- HEADER -->
//         <div style="text-align:center;">
//           <div style="font-size:40px;">${cfg.emoji}</div>
//           <h2 style="color:${cfg.color};margin:10px 0;">${cfg.heading}</h2>
//           <p style="color:#6b7280;">${cfg.subtext}</p>
//         </div>

//         <!-- STATUS EXTRA -->
//         ${cfg.extraHtml}

//         <!-- ITEMS -->
//         <div style="background:#fff;padding:16px;border-radius:8px;margin-top:16px;">
//           <h3>Order Items</h3>

//           <table style="width:100%;border-collapse:collapse;">
//             <thead>
//               <tr style="background:#f3f4f6;">
//                 <th align="left">Item</th>
//                 <th align="right">Price</th>
//                 <th align="center">Qty</th>
//                 <th align="right">Total</th>
//               </tr>
//             </thead>
//             <tbody>
//               ${itemsList}
//             </tbody>
//           </table>

//           ${pricingBreakdown}

//         </div>

//         <!-- FOOTER -->
//         <div style="text-align:center;font-size:12px;color:#9ca3af;margin-top:20px;">
//           © ${new Date().getFullYear()} ${process.env.COMPANY_NAME}
//         </div>

//       </div>
//     `,
//   };

//   try {
//     return await sendEmailViaAPI(mailOptions);
//   } catch (error) {
//     console.error("Email send error:", error.message);
//     throw new Error("Failed to send order email");
//   }
// };


module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendContactEmail,
  sendOrderConfirmationEmail, 
  sendOrderStatusEmail
};
