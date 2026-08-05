/**
 * Copy env keys into shop-config.js at build/deploy time.
 * Used by GitHub Actions before publishing to GitHub Pages.
 * Locally, use gitignored shop-config.local.js instead.
 *
 * Env vars:
 *   GOOGLE_MAPS_API_KEY  (or SNUZ_GOOGLE_MAPS_API_KEY)
 *   PAYSTACK_PUBLIC_KEY  (or SNUZ_PAYSTACK_PUBLIC_KEY)
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const configPath = path.join(root, "shop-config.js");

const maps =
  process.env.GOOGLE_MAPS_API_KEY ||
  process.env.SNUZ_GOOGLE_MAPS_API_KEY ||
  "";
const paystack =
  process.env.PAYSTACK_PUBLIC_KEY ||
  process.env.SNUZ_PAYSTACK_PUBLIC_KEY ||
  "";

let src = fs.readFileSync(configPath, "utf8");
src = src.replace(
  /googleMapsApiKey:\s*["'][^"']*["']/,
  `googleMapsApiKey: ${JSON.stringify(maps)}`
);
src = src.replace(
  /paystackPublicKey:\s*["'][^"']*["']/,
  `paystackPublicKey: ${JSON.stringify(paystack)}`
);
fs.writeFileSync(configPath, src);

if (maps || paystack) {
  console.log("Applied shop secrets from environment into shop-config.js.");
} else {
  console.log(
    "No GOOGLE_MAPS_API_KEY / PAYSTACK_PUBLIC_KEY set; keys left empty."
  );
}
