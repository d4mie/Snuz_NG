/**
 * Optional Vercel serverless route (same flow as Laglivin).
 * Only used when shop-config.js sets apiBase (e.g. "/").
 * Requires env: PAYSTACK_SECRET_KEY, and optionally SITE_URL.
 */

function normalizeSiteUrl(raw) {
  const value = String(raw || "").trim();
  if (!value) return "";
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  if (value.includes("localhost") || value.includes("127.0.0.1")) {
    return `http://${value}`;
  }
  return `https://${value}`;
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Allow", "POST");
    return res.end("Method Not Allowed");
  }

  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) {
    return res.status(500).json({ ok: false, error: "Missing PAYSTACK_SECRET_KEY" });
  }

  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      return res.status(400).json({ ok: false, error: "Invalid JSON body" });
    }
  }

  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const amountKobo = Number(body?.amountKobo);
  const metadata = body?.metadata ?? {};

  if (!email || !email.includes("@")) {
    return res.status(400).json({ ok: false, error: "Email is required" });
  }
  if (!Number.isFinite(amountKobo) || amountKobo < 100) {
    return res.status(400).json({ ok: false, error: "amountKobo must be a number >= 100" });
  }

  const originRaw =
    process.env.SITE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    (req.headers["x-forwarded-proto"] && req.headers.host
      ? `${req.headers["x-forwarded-proto"]}://${req.headers.host}`
      : "") ||
    "";
  const origin = normalizeSiteUrl(originRaw) || "http://localhost:3000";
  const callback_url = `${origin.replace(/\/+$/, "")}/checkout-success.html`;

  if (
    secret.startsWith("sk_live") &&
    (callback_url.startsWith("http://") ||
      callback_url.includes("localhost") ||
      callback_url.includes("127.0.0.1"))
  ) {
    return res.status(400).json({
      ok: false,
      error:
        "LIVE Paystack key cannot use a localhost callback. Set SITE_URL to your https domain, or use a TEST key locally.",
    });
  }

  let paystackRes;
  try {
    paystackRes = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        amount: Math.round(amountKobo),
        currency: "NGN",
        callback_url,
        metadata,
      }),
    });
  } catch (e) {
    return res.status(502).json({
      ok: false,
      error: "Unable to reach Paystack. Check your internet connection or try again.",
      details: `${e?.message || e}`,
    });
  }

  const json = await paystackRes.json().catch(() => null);
  if (!paystackRes.ok || !json?.status) {
    return res.status(502).json({
      ok: false,
      error: json?.message || `Paystack initialize failed (HTTP ${paystackRes.status})`,
      details: json,
    });
  }

  return res.status(200).json({
    ok: true,
    authorization_url: json.data?.authorization_url,
    access_code: json.data?.access_code,
    reference: json.data?.reference,
  });
};
