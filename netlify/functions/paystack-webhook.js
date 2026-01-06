const crypto = require("crypto");

function text(statusCode, body) {
  return {
    statusCode,
    headers: { "content-type": "text/plain; charset=utf-8" },
    body: String(body || ""),
  };
}

async function sendSendgridEmail({ apiKey, from, to, subject, html, textContent }) {
  const payload = {
    personalizations: [{ to: [{ email: to }] }],
    from: { email: from },
    subject,
    content: [
      { type: "text/plain", value: textContent || "" },
      { type: "text/html", value: html || "" },
    ],
  };

  const resp = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!resp.ok) {
    const t = await resp.text().catch(() => "");
    throw new Error(`SendGrid failed: ${resp.status} ${t}`);
  }
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return text(405, "Method not allowed");

  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) return text(500, "PAYSTACK_SECRET_KEY is not set");

  const signature = event.headers["x-paystack-signature"] || event.headers["X-Paystack-Signature"];
  const raw = event.body || "";
  const hash = crypto.createHmac("sha512", secret).update(raw).digest("hex");

  if (!signature || signature !== hash) return text(401, "Invalid signature");

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    return text(400, "Invalid JSON");
  }

  // Only handle paid events
  if (payload?.event !== "charge.success") return text(200, "ignored");

  const data = payload.data || {};
  const reference = String(data.reference || "");
  const customerEmail = String(data.customer?.email || "");
  const amount = (Number(data.amount) || 0) / 100;

  const meta = data.metadata || {};
  const billing = meta.billing || {};
  const items = Array.isArray(meta.items) ? meta.items : [];

  const adminTo = process.env.ORDER_NOTIFY_TO;
  const from = process.env.ORDER_NOTIFY_FROM;
  const sendgrid = process.env.SENDGRID_API_KEY;

  const subject = `New paid order ${reference}`;
  const lines = items
    .map((it) => {
      const n = String(it.name || "Item");
      const q = Number(it.qty) || 1;
      const p = Number(it.price) || 0;
      return `- ${n} x${q} (₦${p})`;
    })
    .join("\n");

  const textContent = `Payment received.\nReference: ${reference}\nAmount: ₦${amount}\n\nCustomer: ${customerEmail}\n\nItems:\n${lines}\n\nBilling:\n${JSON.stringify(
    billing,
    null,
    2
  )}`;

  const html = `
    <h2>Payment received</h2>
    <p><strong>Reference:</strong> ${reference}</p>
    <p><strong>Amount:</strong> ₦${amount}</p>
    <p><strong>Customer:</strong> ${customerEmail}</p>
    <h3>Items</h3>
    <ul>
      ${items
        .map((it) => `<li>${String(it.name || "Item")} × ${Number(it.qty) || 1}</li>`)
        .join("")}
    </ul>
    <h3>Billing</h3>
    <pre style="white-space:pre-wrap">${escapeHtml(JSON.stringify(billing, null, 2))}</pre>
  `;

  // Attempt email send (optional)
  if (sendgrid && from && adminTo) {
    try {
      await sendSendgridEmail({ apiKey: sendgrid, from, to: adminTo, subject, html, textContent });
      // Also notify customer (optional)
      if (customerEmail) {
        await sendSendgridEmail({
          apiKey: sendgrid,
          from,
          to: customerEmail,
          subject: `Order received — ${reference}`,
          html: `<p>Thanks! We received your payment.</p><p><strong>Reference:</strong> ${reference}</p>`,
          textContent: `Thanks! We received your payment.\nReference: ${reference}`,
        });
      }
    } catch (e) {
      // Still return 200 to stop webhook retries; check function logs for errors.
      console.error(e);
    }
  } else {
    console.log("Webhook received but email is not configured. Set SENDGRID_API_KEY, ORDER_NOTIFY_FROM, ORDER_NOTIFY_TO.");
  }

  return text(200, "ok");
};

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}


