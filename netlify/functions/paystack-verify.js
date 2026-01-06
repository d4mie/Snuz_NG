const PAYSTACK_BASE = "https://api.paystack.co";

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
    },
    body: JSON.stringify(body),
  };
}

exports.handler = async (event) => {
  if (event.httpMethod !== "GET") return json(405, { error: "Method not allowed" });

  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) return json(500, { error: "PAYSTACK_SECRET_KEY is not set" });

  const ref = String(event.queryStringParameters?.reference || "").trim();
  if (!ref) return json(400, { error: "reference is required" });

  const resp = await fetch(`${PAYSTACK_BASE}/transaction/verify/${encodeURIComponent(ref)}`, {
    headers: { Authorization: `Bearer ${secret}` },
  });

  const data = await resp.json().catch(() => null);
  if (!resp.ok || !data) return json(resp.status || 500, { error: "Paystack verify failed", details: data });

  // Return the whole payload for now (frontend will only read a few fields)
  return json(200, data);
};


