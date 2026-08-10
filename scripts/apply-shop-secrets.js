/**
 * Copy env keys into shop-config.js at build/deploy time.
 * Used by GitHub Actions before publishing to GitHub Pages.
 * Locally, use gitignored shop-config.local.js instead.
 *
 * Env vars:
 *   GOOGLE_MAPS_API_KEY  (or SNUZ_GOOGLE_MAPS_API_KEY)
 *   PAYSTACK_PUBLIC_KEY  (or SNUZ_PAYSTACK_PUBLIC_KEY)
 *   SUPABASE_URL         (or SNUZ_SUPABASE_URL)
 *   SUPABASE_ANON_KEY    (or SNUZ_SUPABASE_ANON_KEY)
 *   ADMIN_PASSWORD       (or SNUZ_ADMIN_PASSWORD)
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
const supabaseUrl =
  process.env.SUPABASE_URL || process.env.SNUZ_SUPABASE_URL || "";
const supabaseAnonKey =
  process.env.SUPABASE_ANON_KEY || process.env.SNUZ_SUPABASE_ANON_KEY || "";
const adminPassword =
  process.env.ADMIN_PASSWORD || process.env.SNUZ_ADMIN_PASSWORD || "";

let src = fs.readFileSync(configPath, "utf8");
src = src.replace(
  /googleMapsApiKey:\s*["'][^"']*["']/,
  `googleMapsApiKey: ${JSON.stringify(maps)}`
);
src = src.replace(
  /paystackPublicKey:\s*["'][^"']*["']/,
  `paystackPublicKey: ${JSON.stringify(paystack)}`
);
src = src.replace(
  /supabaseUrl:\s*["'][^"']*["']/,
  `supabaseUrl: ${JSON.stringify(supabaseUrl)}`
);
src = src.replace(
  /supabaseAnonKey:\s*["'][^"']*["']/,
  `supabaseAnonKey: ${JSON.stringify(supabaseAnonKey)}`
);
src = src.replace(
  /adminPassword:\s*["'][^"']*["']/,
  `adminPassword: ${JSON.stringify(adminPassword)}`
);
fs.writeFileSync(configPath, src);

const applied = [maps && "maps", paystack && "paystack", supabaseUrl && "supabase", adminPassword && "admin"]
  .filter(Boolean)
  .join(", ");
if (applied) {
  console.log(`Applied shop secrets from environment into shop-config.js (${applied}).`);
} else {
  console.log("No shop secrets set; keys left empty.");
}
