/* ===================================================
   invoice.js  –  AM Robotics Invoice PDF Generator
   Uses jsPDF + jsPDF-AutoTable
   Call: downloadInvoicePDF(order)  ← pass full order object
   =================================================== */

async function downloadInvoicePDF(orderOrId) {
  // ── resolve order object ────────────────────────────
  let order = orderOrId;

  // if a string ID was passed, find it from DOM or fetch
  if (typeof orderOrId === "string") {
    const token = localStorage.getItem("authToken");
    try {
      const res  = await fetch(`${API_BASE}/my-orders`, {
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
      });
      const data = await res.json();
      order = (data.orders || []).find(o => o._id === orderOrId);
    } catch (e) {
      console.error("Invoice: failed to fetch order", e);
    }
  }

  if (!order) {
    if (typeof window.showToast === "function") window.showToast("Order not found", "error");
    return;
  }

  // ── check jsPDF loaded ──────────────────────────────
  if (!window.jspdf?.jsPDF) {
    if (typeof window.showToast === "function") window.showToast("PDF library not loaded. Please refresh.", "error");
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF("p", "mm", "a4");
  const W   = 210; // A4 width mm

  // ── helpers ─────────────────────────────────────────
  const fmt    = n  => "Rs. " + Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 });
  const fmtNum = n  => Number(n || 0).toFixed(2);
  const fmtDate = d => d ? new Date(d).toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" }) : "—";
  const shortId = String(order._id).slice(-10).toUpperCase();

  // ── data ────────────────────────────────────────────
  const addr    = order.shippingAddress || {};
  const pay     = order.payment         || {};
  const pricing = order.pricing         || {};
  const voucher = order.appliedVoucher  || {};
  const items   = order.items           || [];

  // ── draw invoice ────────────────────────────────────
  const logo = new Image();
  logo.crossOrigin = "anonymous";
  logo.src = "assets/img/logo_resized.png";

  logo.onerror = () => buildPDF(null);
  logo.onload  = () => buildPDF(logo);

  function buildPDF(logoImg) {

    // ── colors ──
    const DARK   = [15, 52, 96];    // #0f3460
    const BLACK  = [26, 26, 46];    // #1a1a2e
    const GREEN  = [26, 107, 60];   // savings green
    const GRAY   = [100, 100, 110];
    const LGRAY  = [245, 245, 248];

    let y = 0;

    // ══════════════════════════════════════
    // HEADER BAND
    // ══════════════════════════════════════
    doc.setFillColor(...DARK);
    doc.rect(0, 0, W, 36, "F");

    // Logo
    if (logoImg) {
      doc.addImage(logoImg, "PNG", 12, 6, 36, 16);
    } else {
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("AM ROBOTICS", 12, 20);
    }

    // INVOICE title
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text("INVOICE", W - 14, 16, { align: "right" });

    // invoice number + date
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`#${shortId}`, W - 14, 23, { align: "right" });
    doc.text(fmtDate(order.createdAt), W - 14, 29, { align: "right" });

    y = 46;

    // ══════════════════════════════════════
    // BILL TO  +  PAYMENT INFO (two columns)
    // ══════════════════════════════════════

    // ── BILL TO ──
    doc.setTextColor(...GRAY);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text("BILL TO", 14, y);

    y += 5;
    doc.setTextColor(...BLACK);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(`${addr.firstName || ""} ${addr.lastName || ""}`.trim() || "Customer", 14, y);

    y += 5;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...GRAY);

    const addrLines = [
      addr.address1,
      addr.address2,
      [addr.city, addr.state].filter(Boolean).join(", "),
      [addr.country, addr.postalCode].filter(Boolean).join(" — "),
      addr.phone ? `Mobile: ${addr.phone}` : "",
      addr.email ? addr.email : "",
    ].filter(Boolean);

    addrLines.forEach(line => {
      doc.text(line, 14, y);
      y += 5;
    });

    // ── PAYMENT BOX (right column) ──
    const boxX = 110, boxY = 46, boxW = 86, boxH = 38;
    doc.setFillColor(...LGRAY);
    doc.roundedRect(boxX, boxY, boxW, boxH, 3, 3, "F");

    doc.setTextColor(...GRAY);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text("PAYMENT INFO", boxX + 6, boxY + 7);

    const payRows = [
      ["Method",   String(pay.method  || "—").toUpperCase()],
      ["Status",   String(pay.status  || "—").toUpperCase()],
      ["Currency", pay.currency || "INR"],
      ["Paid On",  fmtDate(pay.paidAt)],
    ];

    let py = boxY + 13;
    payRows.forEach(([label, val]) => {
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...GRAY);
      doc.setFontSize(8);
      doc.text(label, boxX + 6, py);

      doc.setFont("helvetica", "bold");
      doc.setTextColor(...BLACK);
      doc.text(val, boxX + boxW - 6, py, { align: "right" });
      py += 6;
    });

    // ── divider ──
    y = Math.max(y, boxY + boxH) + 6;
    doc.setDrawColor(220, 220, 225);
    doc.setLineWidth(0.4);
    doc.line(14, y, W - 14, y);
    y += 8;

    // ══════════════════════════════════════
    // ITEMS TABLE
    // ══════════════════════════════════════
    const tableBody = items.map(item => [
      item.name || "Product",
      item.sku  || "—",
      String(item.quantity),
      fmt(item.sellingPrice),
      item.discountPercent > 0 ? `${item.discountPercent}%` : "—",
      fmt(item.lineTotal),
    ]);

    doc.autoTable({
      startY: y,
      head: [["Product", "SKU", "Qty", "MRP", "Disc.", "Total"]],
      body: tableBody,
      theme: "grid",
      styles:      { fontSize: 9, cellPadding: 4 },
      headStyles:  { fillColor: DARK, textColor: 255, fontStyle: "bold", fontSize: 9 },
      columnStyles: {
        0: { halign: "left",   cellWidth: 60 },
        1: { halign: "center", cellWidth: 28 },
        2: { halign: "center", cellWidth: 14 },
        3: { halign: "right",  cellWidth: 28 },
        4: { halign: "center", cellWidth: 16 },
        5: { halign: "right",  cellWidth: 28 },
      },
      alternateRowStyles: { fillColor: [250, 250, 252] },
      margin: { left: 14, right: 14 },
    });

    y = doc.lastAutoTable.finalY + 8;

    // ══════════════════════════════════════
    // PRICING SUMMARY (right-aligned box)
    // ══════════════════════════════════════
    const sumX = 120, sumW = 76;

    const summaryRows = [
      { label: "MRP Total",       val: fmt(pricing.mrpTotal),       color: BLACK,  bold: false },
      { label: "MRP Savings",     val: `-${fmt(pricing.mrpSavings)}`, color: GREEN, bold: false },
    ];

    if (voucher.code && Number(voucher.discountAmount) > 0) {
      summaryRows.push({
        label: `Voucher (${voucher.code})`,
        val:   `-${fmt(voucher.discountAmount)}`,
        color: GREEN, bold: false
      });
    }

    summaryRows.push(
      { label: "Subtotal",        val: fmt(pricing.subtotal),       color: BLACK,  bold: false },
      { label: "Delivery",        val: pricing.deliveryCharge > 0 ? fmt(pricing.deliveryCharge) : "Free", color: BLACK, bold: false },
    );

    if (pricing.gstAmount > 0) {
      summaryRows.push({ label: "GST", val: fmt(pricing.gstAmount), color: BLACK, bold: false });
    }

    // draw summary rows
    summaryRows.forEach(row => {
      doc.setFontSize(9);
      doc.setFont("helvetica", row.bold ? "bold" : "normal");
      doc.setTextColor(...GRAY);
      doc.text(row.label, sumX, y);
      doc.setTextColor(...row.color);
      doc.text(row.val, sumX + sumW, y, { align: "right" });
      doc.setDrawColor(230, 230, 235);
      doc.setLineWidth(0.2);
      doc.line(sumX, y + 2, sumX + sumW, y + 2);
      y += 7;
    });

    // TOTAL PAID band
    y += 2;
    doc.setFillColor(...DARK);
    doc.roundedRect(sumX - 2, y - 5, sumW + 4, 12, 2, 2, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Total Paid", sumX + 2, y + 3);
    doc.text(fmt(pricing.total), sumX + sumW, y + 3, { align: "right" });

    y += 20;

    // ══════════════════════════════════════
    // ORDER STATUS + PayPal ID
    // ══════════════════════════════════════
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...GRAY);
    doc.text(`Order Status : ${String(order.status || "").replace(/_/g, " ").toUpperCase()}`, 14, y);
    if (pay.paypalOrderId) {
      doc.text(`PayPal Order ID : ${pay.paypalOrderId}`, 14, y + 5);
      y += 5;
    }

    y += 10;

    // ══════════════════════════════════════
    // FOOTER
    // ══════════════════════════════════════
    const footerY = 285;
    doc.setDrawColor(220, 220, 225);
    doc.setLineWidth(0.4);
    doc.line(14, footerY - 6, W - 14, footerY - 6);

    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...GRAY);
    doc.text("Thank you for shopping with AM Robotics 🤖", W / 2, footerY, { align: "center" });
    doc.text("For queries, contact us at support@amrobotics.in | +91 9550906016", W / 2, footerY + 5, { align: "center" });
    doc.text("This is a computer-generated invoice and does not require a signature.", W / 2, footerY + 10, { align: "center" });

    // ── save ──
    doc.save(`AM_Robotics_Invoice_${shortId}.pdf`);

    if (typeof window.showToast === "function") {
      window.showToast("Invoice downloaded!", "success");
    }
  }
}