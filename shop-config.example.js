/* Keys: copy this pattern to shop-config.local.js (gitignored), not into git.
   Live GitHub Actions secrets:
   GOOGLE_MAPS_API_KEY, PAYSTACK_PUBLIC_KEY,
   SUPABASE_URL, SUPABASE_ANON_KEY, ADMIN_PASSWORD.
   Stock table SQL: scripts/product-stock-supabase.sql */
window.SNUZ_SHOP = {
  currency: "NGN",

  // Shipping:
  // - "on_delivery" = no shipping fee in checkout (paid to dispatcher)
  // - "distance"    = auto-calculate from closest distributor (needs Google key)
  // - "varies"      = show Varies, charge products only
  shippingMode: "on_delivery",

  // Used for address suggestions at checkout (optional).
  googleMapsApiKey: "",

  // Unused while shippingMode is "on_delivery".
  shippingBaseNaira: 1500,
  shippingPerKmNaira: 200,
  shippingMinNaira: 2000,
  shippingMaxNaira: 25000,
  shippingRoundToNaira: 100,

  // Paystack PUBLIC key (pk_test_... or pk_live_...)
  paystackPublicKey: "",

  // Optional server payment. Leave "" for Paystack Popup.
  apiBase: "",

  // Product stock admin (Supabase). Leave empty in git.
  supabaseUrl: "",
  supabaseAnonKey: "",
  adminPassword: "",

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
