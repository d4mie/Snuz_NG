(() => {
  let mapsLoadPromise = null;
  let lastQuoteKey = "";
  let lastQuote = null;
  let sessionToken = null;

  const shop = () => window.SNUZ_SHOP || {};

  const activeDistributors = () =>
    (shop().distributors || []).filter((d) => d && d.active !== false && d.address);

  const roundFee = (value, step) => {
    const s = Math.max(1, Number(step) || 1);
    return Math.round(Number(value) / s) * s;
  };

  const feeFromKm = (km) => {
    const cfg = shop();
    const base = Number(cfg.shippingBaseNaira) || 0;
    const perKm = Number(cfg.shippingPerKmNaira) || 0;
    const min = Number(cfg.shippingMinNaira) || 0;
    const max = Number(cfg.shippingMaxNaira);
    let fee = base + perKm * km;
    if (Number.isFinite(min)) fee = Math.max(min, fee);
    if (Number.isFinite(max)) fee = Math.min(max, fee);
    return roundFee(fee, cfg.shippingRoundToNaira || 100);
  };

  const countryToCode = (country) => {
    const map = {
      Nigeria: "ng",
      Ghana: "gh",
      "United States": "us",
      "United Kingdom": "gb",
    };
    return map[country] || "ng";
  };

  const loadGoogleMaps = async () => {
    const key = (shop().googleMapsApiKey || "").trim();
    if (!key) {
      throw new Error(
        "Add your Google Maps API key in shop-config.js to calculate shipping."
      );
    }

    if (!window.google?.maps?.importLibrary) {
      if (!mapsLoadPromise) {
        mapsLoadPromise = new Promise((resolve, reject) => {
          const existing = document.querySelector("script[data-snuz-google-maps]");
          if (existing) {
            const wait = () => {
              if (window.google?.maps?.importLibrary) resolve();
              else window.setTimeout(wait, 50);
            };
            wait();
            return;
          }

          // Inline bootstrap from Google (required for loading=async + importLibrary).
          ((g) => {
            var h, a, k, p = "The Google Maps JavaScript API", c = "google", l = "importLibrary", q = "__ib__", m = document, b = window;
            b[c] = b[c] || {};
            var d = b[c].maps || (b[c].maps = {});
            var r = new Set();
            var e = new URLSearchParams();
            var u = () =>
              h ||
              (h = new Promise(async (f, n) => {
                a = m.createElement("script");
                a.dataset.snuzGoogleMaps = "1";
                e.set("libraries", [...r] + "");
                for (k of Object.keys(g)) {
                  e.set(
                    k.replace(/[A-Z]/g, (t) => "_" + t[0].toLowerCase()),
                    g[k]
                  );
                }
                e.set("callback", c + ".maps." + q);
                a.src = "https://maps.googleapis.com/maps/api/js?" + e;
                d[q] = f;
                a.onerror = () => (h = n(Error(p + " could not load.")));
                a.nonce = m.querySelector("script[nonce]")?.nonce || "";
                m.head.append(a);
              }));
            d[l]
              ? console.warn(p + " only loads once. Ignoring:", l)
              : (d[l] = (f, ...n) => r.add(f) && u().then(() => d[l](f, ...n)));
          })({
            key,
            v: "weekly",
            loading: "async",
          });

          google.maps
            .importLibrary("maps")
            .then(() => resolve())
            .catch((err) => {
              mapsLoadPromise = null;
              reject(
                err ||
                  new Error(
                    "Google Maps failed to load. Check API key, billing, and website restrictions (include http://localhost:5173/*)."
                  )
              );
            });
        });
      }
      await mapsLoadPromise;
    } else {
      await google.maps.importLibrary("maps");
    }
  };

  const ensureSessionToken = async () => {
    const { AutocompleteSessionToken } = await google.maps.importLibrary("places");
    if (!sessionToken) {
      sessionToken = new AutocompleteSessionToken();
    }
    return sessionToken;
  };

  const buildBuyerAddress = (parts) => {
    const bits = [
      parts.address,
      parts.apartment,
      parts.city,
      parts.stateRegion,
      parts.postalCode,
      parts.country || "Nigeria",
    ]
      .map((v) => String(v || "").trim())
      .filter(Boolean);
    return bits.join(", ");
  };

  const quoteKeyFor = (buyerAddress) => {
    const ids = activeDistributors()
      .map((d) => d.id || d.address)
      .join("|");
    const cfg = shop();
    return [
      buyerAddress,
      ids,
      cfg.shippingBaseNaira,
      cfg.shippingPerKmNaira,
      cfg.shippingMinNaira,
      cfg.shippingMaxNaira,
      cfg.shippingRoundToNaira,
    ].join("::");
  };

  const getRouteMatrix = async (origins, destination) => {
    const [{ RouteMatrix }, { UnitSystem }] = await Promise.all([
      google.maps.importLibrary("routes"),
      google.maps.importLibrary("core"),
    ]);
    if (!RouteMatrix?.computeRouteMatrix) {
      throw new Error(
        "Route Matrix unavailable. Enable the Routes API on your Google Cloud project."
      );
    }

    try {
      // Returns { matrix: { rows: [{ items: [...] }] } }
      return await RouteMatrix.computeRouteMatrix({
        origins,
        destinations: [destination],
        travelMode: "DRIVING",
        units: UnitSystem?.METRIC,
        fields: ["distanceMeters", "durationMillis", "condition"],
      });
    } catch (err) {
      const msg = String(err?.message || err || "");
      if (/billing|Billing/i.test(msg)) {
        throw new Error(
          "Google Maps billing is not enabled. Turn on billing here: https://console.cloud.google.com/project/_/billing/enable"
        );
      }
      throw new Error(
        msg ||
          "Could not calculate distance. Enable Routes API, billing, and website restrictions."
      );
    }
  };

  const quoteShipping = async (destinationParts) => {
    const buyerAddress = buildBuyerAddress(destinationParts || {});
    if (!buyerAddress || buyerAddress.split(",").length < 2) {
      return {
        ok: false,
        feeNaira: 0,
        distanceKm: 0,
        durationText: "",
        distributor: null,
        buyerAddress,
        error: "Enter a full delivery address to calculate shipping.",
      };
    }

    const key = quoteKeyFor(buyerAddress);
    if (lastQuote && lastQuoteKey === key) return lastQuote;

    const distributors = activeDistributors();
    if (!distributors.length) {
      return {
        ok: false,
        feeNaira: 0,
        distanceKm: 0,
        durationText: "",
        distributor: null,
        buyerAddress,
        error: "No active distributors configured.",
      };
    }

    await loadGoogleMaps();

    const unique = [];
    const seen = new Set();
    distributors.forEach((d) => {
      const addr = d.address.trim().toLowerCase();
      if (seen.has(addr)) return;
      seen.add(addr);
      unique.push(d);
    });

    // Prefer the full formatted address alone — cleaner for Google geocoding.
    const destination =
      (destinationParts?.formattedAddress || "").trim() || buyerAddress;

    const response = await getRouteMatrix(
      unique.map((d) => d.address),
      destination
    );

    const rows = response?.matrix?.rows || response?.rows || [];
    let best = null;
    rows.forEach((row, index) => {
      const item = row?.items?.[0] || row?.elements?.[0];
      if (!item) return;
      // Prefer successful routes; skip blocked/failed conditions when present.
      const condition = String(item.condition || "").toUpperCase();
      if (condition && condition !== "ROUTE_EXISTS" && condition !== "OK") return;

      const meters = Number(item.distanceMeters ?? item.distance?.value);
      if (!Number.isFinite(meters) || meters < 0) return;

      const durationMs = Number(
        item.durationMillis ??
          (item.duration?.value != null ? item.duration.value * 1000 : NaN)
      );
      const durationText = Number.isFinite(durationMs)
        ? formatDuration(durationMs)
        : item.duration?.text || "";

      if (!best || meters < best.meters) {
        best = {
          meters,
          km: meters / 1000,
          durationText,
          distributor: unique[index],
        };
      }
    });

    if (!best) {
      const result = {
        ok: false,
        feeNaira: 0,
        distanceKm: 0,
        durationText: "",
        distributor: null,
        buyerAddress: destination,
        error:
          "We couldn’t find a route to that address. Pick a suggestion from the list, or try a nearby landmark.",
      };
      lastQuoteKey = key;
      lastQuote = result;
      return result;
    }

    const result = {
      ok: true,
      feeNaira: feeFromKm(best.km),
      distanceKm: Math.round(best.km * 10) / 10,
      durationText: best.durationText,
      distributor: best.distributor,
      buyerAddress,
    };
    lastQuoteKey = key;
    lastQuote = result;
    return result;
  };

  const formatDuration = (ms) => {
    const totalMin = Math.max(1, Math.round(Number(ms) / 60000));
    if (totalMin < 60) return `${totalMin} min`;
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return m ? `${h} hr ${m} min` : `${h} hr`;
  };

  const clearQuoteCache = () => {
    lastQuoteKey = "";
    lastQuote = null;
  };

  const componentValue = (components, type, useShort = false) => {
    const hit = (components || []).find((c) => (c.types || []).includes(type));
    if (!hit) return "";
    if (useShort) {
      return hit.shortText || hit.short_name || hit.longText || hit.long_name || "";
    }
    return hit.longText || hit.long_name || hit.shortText || hit.short_name || "";
  };

  const parsePlaceParts = (place) => {
    const components = place?.addressComponents || place?.address_components || [];
    const streetNumber = componentValue(components, "street_number");
    const route = componentValue(components, "route");
    const premise = componentValue(components, "premise");
    const neighborhood = componentValue(components, "neighborhood");
    const sublocality =
      componentValue(components, "sublocality_level_1") ||
      componentValue(components, "sublocality");
    const line1 =
      [streetNumber, route].filter(Boolean).join(" ") ||
      premise ||
      neighborhood ||
      sublocality ||
      place?.displayName ||
      place?.name ||
      place?.formattedAddress ||
      place?.formatted_address ||
      "";

    const city =
      componentValue(components, "locality") ||
      componentValue(components, "postal_town") ||
      sublocality ||
      neighborhood;
    const state = componentValue(components, "administrative_area_level_1");
    const postal = componentValue(components, "postal_code");

    return {
      address: line1,
      city,
      state,
      postalCode: postal,
      formattedAddress:
        place?.formattedAddress || place?.formatted_address || line1,
      place,
    };
  };

  /**
   * Normal text input + custom suggestion list (Places Autocomplete Data API).
   */
  const attachAddressAutocomplete = async (input, options = {}) => {
    if (!input) return null;
    const listEl = options.listEl;
    await loadGoogleMaps();
    const { AutocompleteSuggestion } = await google.maps.importLibrary("places");

    if (!AutocompleteSuggestion?.fetchAutocompleteSuggestions) {
      throw new Error(
        "Places suggestions unavailable. Enable Places API (New) for this key."
      );
    }

    let timer = null;
    let requestId = 0;
    let currentCountry = countryToCode(options.getCountry?.() || "Nigeria");

    const hideList = () => {
      if (!listEl) return;
      listEl.hidden = true;
      listEl.innerHTML = "";
    };

    const showSuggestions = (suggestions) => {
      if (!listEl) return;
      if (!suggestions.length) {
        hideList();
        return;
      }
      listEl.innerHTML = "";
      suggestions.forEach((s, index) => {
        const prediction = s.placePrediction;
        const main =
          prediction?.mainText?.text ||
          prediction?.text?.text ||
          "Suggestion";
        const secondary = prediction?.secondaryText?.text || "";
        const li = document.createElement("li");
        li.setAttribute("role", "option");
        li.setAttribute("data-suggestion-index", String(index));
        const strong = document.createElement("strong");
        strong.textContent = main;
        li.appendChild(strong);
        if (secondary) {
          const span = document.createElement("span");
          span.textContent = secondary;
          li.appendChild(span);
        }
        li.addEventListener("mousedown", async (e) => {
          e.preventDefault();
          if (!prediction?.toPlace) return;
          try {
            const place = prediction.toPlace();
            await place.fetchFields({
              fields: ["addressComponents", "formattedAddress", "displayName"],
            });
            sessionToken = null; // end session after selection
            const parts = parsePlaceParts(place);
            input.value = parts.formattedAddress || parts.address || input.value;
            hideList();
            if (typeof options.onPlace === "function") options.onPlace(parts);
          } catch (err) {
            if (typeof options.onError === "function") options.onError(err);
          }
        });
        listEl.appendChild(li);
      });
      listEl.hidden = false;
    };

    const fetchSuggestions = async (value) => {
      const q = String(value || "").trim();
      if (q.length < 3) {
        hideList();
        return;
      }
      const id = ++requestId;
      try {
        const token = await ensureSessionToken();
        const request = {
          input: q,
          sessionToken: token,
          includedRegionCodes: [currentCountry],
        };
        const { suggestions } =
          await AutocompleteSuggestion.fetchAutocompleteSuggestions(request);
        if (id !== requestId) return;
        showSuggestions(suggestions || []);
      } catch (err) {
        hideList();
        if (typeof options.onError === "function") options.onError(err);
      }
    };

    input.addEventListener("input", () => {
      if (typeof options.onInput === "function") options.onInput(input.value);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => fetchSuggestions(input.value), 250);
    });

    input.addEventListener("blur", () => {
      window.setTimeout(hideList, 150);
    });

    input.addEventListener("focus", () => {
      if (input.value.trim().length >= 3) fetchSuggestions(input.value);
    });

    return {
      setRegionCodes(country) {
        currentCountry = countryToCode(country);
        sessionToken = null;
      },
      hideList,
    };
  };

  window.SnuzShipping = {
    quoteShipping,
    feeFromKm,
    buildBuyerAddress,
    clearQuoteCache,
    activeDistributors,
    loadGoogleMaps,
    attachAddressAutocomplete,
    countryToCode,
  };
})();
