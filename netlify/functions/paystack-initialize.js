const PAYSTACK_BASE = "https://api.paystack.co";

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "content-type",
    },
    body: JSON.stringify(body),
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return json(204, {});
  if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed" });

  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) return json(500, { error: "PAYSTACK_SECRET_KEY is not set" });

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return json(400, { error: "Invalid JSON body" });
  }

  const email = String(payload.email || "").trim();
  const amountNgn = Number(payload.amount);
  const callback_url = String(payload.callback_url || "").trim();
  const metadata = payload.metadata && typeof payload.metadata === "object" ? payload.metadata : {};

  if (!email) return json(400, { error: "email is required" });
  if (!Number.isFinite(amountNgn) || amountNgn <= 0) return json(400, { error: "amount must be > 0" });
  if (!callback_url) return json(400, { error: "callback_url is required" });

  const initBody = {
    email,
    amount: Math.round(amountNgn * 100), // kobo
    currency: "NGN",
    callback_url,
    channels: ["card"],
    metadata,
  };

  const resp = await fetch(`${PAYSTACK_BASE}/transaction/initialize`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(initBody),
  });

  const data = await resp.json().catch(() => null);
  if (!resp.ok || !data || data.status !== true) {
    return json(resp.status || 500, { error: "Paystack initialize failed", details: data });
  }

  return json(200, {
    authorization_url: data.data.authorization_url,
    access_code: data.data.access_code,
    reference: data.data.reference,
  });
};


