/* Shop + payment settings for snuz.ng */
window.SNUZ_SHOP = {
  currency: "NGN",

  // Shipping:
  // - "on_delivery" = no shipping fee in checkout (paid to dispatcher)
  // - "distance"    = auto-calculate from closest distributor (needs Google key)
  // - "varies"      = show Varies, charge products only
  shippingMode: "on_delivery",

  // Used for address suggestions at checkout (optional).
  // Enable: Maps JavaScript API + Places API (New). Restrict to snuz.ng + localhost.
  // Leave empty in git. Local: shop-config.local.js. Live: GitHub Actions secrets.
  googleMapsApiKey: "",

  // Unused while shippingMode is "on_delivery".
  shippingBaseNaira: 1500,
  shippingPerKmNaira: 200,
  shippingMinNaira: 2000,
  shippingMaxNaira: 25000,
  shippingRoundToNaira: 100,

  // Paystack PUBLIC key (pk_test_... or pk_live_...). Leave empty in git.
  paystackPublicKey: "",

  // Optional server payment. Leave "" for Paystack Popup.
  apiBase: "",

  // Product admin (Supabase). Leave empty in git.
  // Local: shop-config.local.js. Live: GitHub Actions secrets.
  // SQL setup: scripts/products-supabase.sql
  // Without these, admin falls back to this browser only (localStorage).
  supabaseUrl: "",
  supabaseAnonKey: "",
  // Shared password for /admin.html (leave empty in git).
  adminPassword: "",

  // Active distributors / starting points (closest one wins).
  // Website Loc 1–4 = Smoke'N'Sip, Delizz, Trolley, Multiker.
  distributors: [
    {
      id: "smoke-n-sip-ikola",
      name: "Smoke'N'Sip",
      address: "24 Ikola Rd, Alimosho, Lagos, Nigeria",
      active: true,
    },
    {
      id: "primemart-ikola",
      name: "Primemart Superstores Ikola Branch",
      address: "23 Ikola Rd, Alimosho, Lagos, Nigeria",
      active: true,
    },
    {
      id: "primemart-isashi",
      name: "Primemart Superstores Isashi Branch",
      address: "Augusta college, Iyana Isashi Rd, Ojo, Lagos, Nigeria",
      active: true,
    },
    {
      id: "primemart-akesan",
      name: "Primemart Superstores Akesan Branch",
      address: "Vulcanizer Bustop, Lasu Igando Road, Adexson St, Akesan, Lagos, Nigeria",
      active: true,
    },
    {
      id: "primemart-sango",
      name: "Primemart Superstores Sango Branch",
      address:
        "Nipco fuel station, Singer B/stop, Lagos-Abeokuta Expy, Ota, 231119, Ogun State, Nigeria",
      active: true,
    },
    {
      id: "primemart-ifo",
      name: "Primemart Superstores Ifo Branch",
      address: "Abeokuta Expy, Ifo 112105, Ogun State, Nigeria",
      active: true,
    },
    {
      id: "king-of-shisha-kano",
      name: "King of Shisha",
      address:
        "1 Audu Bako Way, near Alsultan Super Market, opp. Dalal Restaurant, GRA, Kano 700282, Kano, Nigeria",
      active: true,
    },
    {
      id: "4u-wuse2",
      name: "4u Supermarket",
      address: "58 Adetokunbo Ademola Crescent, Wuse 2, Abuja, Nigeria",
      active: true,
    },
    {
      id: "delizz-aminu-kano",
      name: "Delizz Supermarket",
      address: "75 Aminu Kano Crescent, Wuse 2, Abuja 900288, Federal Capital Territory, Nigeria",
      active: true,
    },
    {
      id: "trolley-aminu-kano",
      name: "Trolley Supermarket",
      address: "Plot 1247 Aminu Kano Crescent, Wuse 2, Abuja, Nigeria",
      active: true,
    },
    {
      id: "multiker-victoria-island",
      name: "Multiker Supermarket",
      address: "7 Bishop Aboyade Cole St, Victoria Island, Lagos 106104, Lagos, Nigeria",
      active: true,
    },
  ],
};

// On localhost only: pull keys from gitignored shop-config.local.js
(function () {
  try {
    var host = String(location.hostname || "").toLowerCase();
    var local =
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "[::1]" ||
      host === "::1";
    if (!local) return;
    document.write('<script src="./shop-config.local.js"><\/script>');
  } catch (e) {
    // ignore
  }
})();

