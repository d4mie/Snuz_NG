/**
 * Optional Vercel serverless verify route (same idea as Laglivin).
 * Requires env: PAYSTACK_SECRET_KEY
 */

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.statusCode = 405;
    res.setHeader("Allow", "GET");
    return res.end("Method Not Allowed");
  }

  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) {
    return res.status(500).json({ ok: false, error: "Missing PAYSTACK_SECRET_KEY" });
  }

  const reference = String(req.query?.reference || "").trim();
  if (!reference) {
    return res.status(400).json({ ok: false, error: "reference is required" });
  }

  let paystackRes;
  try {
    paystackRes = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      {
        headers: { Authorization: `Bearer ${secret}` },
      }
    );
  } catch (e) {
    return res.status(502).json({
      ok: false,
      error: "Unable to reach Paystack to verify this payment.",
      details: `${e?.message || e}`,
    });
  }

  const json = await paystackRes.json().catch(() => null);
  if (!paystackRes.ok || !json?.status) {
    return res.status(502).json({
      ok: false,
      error: json?.message || `Paystack verify failed (HTTP ${paystackRes.status})`,
      details: json,
    });
  }

  return res.status(200).json({ ok: true, data: json.data });
};
