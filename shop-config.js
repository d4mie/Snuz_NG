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

  // Active distributors / starting points (closest one wins).
  // Website Loc 1 = Primemart Ikola; Loc 2 & 3 share the same Abuja address (listed once).
  distributors: [
    {
      id: "primemart-ikola",
      name: "Primemart Superstore Ikola Branch",
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
      address: "58 Adetokunbo Ademola Cres, Wuse 2, Abuja, Nigeria",
      active: true,
    },
    {
      id: "snuz-aminu-kano",
      name: "SNUZ Wuse 2 (Aminu Kano)",
      address: "75 Aminu Kano Cres, Wuse 2, Abuja 900288, Federal Capital Territory, Nigeria",
      active: true,
    },
    {
      id: "snuz-victoria-island",
      name: "SNUZ Victoria Island",
      address: "7 Bishop Aboyade Cole St, Victoria Island, Lagos 106104, Lagos, Nigeria",
      active: true,
    },
  ],
};
