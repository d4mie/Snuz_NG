(() => {
  const NIGERIA_STATES = [
    "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue",
    "Borno", "Cross River", "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu", "Gombe",
    "Imo", "Jigawa", "Kaduna", "Kano", "Katsina", "Kebbi", "Kogi", "Kwara",
    "Lagos", "Nasarawa", "Niger", "Ogun", "Ondo", "Osun", "Oyo", "Plateau",
    "Rivers", "Sokoto", "Taraba", "Yobe", "Zamfara",
  ];

  const US_STATES = [
    "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado",
    "Connecticut", "Delaware", "District of Columbia", "Florida", "Georgia",
    "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky",
    "Louisiana", "Maine", "Maryland", "Massachusetts", "Michigan", "Minnesota",
    "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire",
    "New Jersey", "New Mexico", "New York", "North Carolina", "North Dakota",
    "Ohio", "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island",
    "South Carolina", "South Dakota", "Tennessee", "Texas", "Utah", "Vermont",
    "Virginia", "Washington", "West Virginia", "Wisconsin", "Wyoming",
  ];

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const isBlank = (value) => !String(value ?? "").trim();

  const getStateOptions = (country) => {
    if (country === "Nigeria") return NIGERIA_STATES;
    if (country === "United States") return US_STATES;
    return [];
  };

  const fillStateSelect = (select, country, preferred) => {
    if (!select) return;
    const options = getStateOptions(country);
    if (!options.length) {
      select.innerHTML = `<option value="">State / Region</option>`;
      select.disabled = false;
      return;
    }
    select.innerHTML =
      `<option value="" disabled>Select state</option>` +
      options.map((st) => `<option value="${st}">${st}</option>`).join("");
    const next =
      preferred && options.includes(preferred)
        ? preferred
        : country === "Nigeria"
          ? "Lagos"
          : "";
    select.value = next;
  };

  const loadPaystackScript = () =>
    new Promise((resolve, reject) => {
      if (window.PaystackPop) {
        resolve();
        return;
      }

      // Prefer the static tag inside <form> (Paystack errors if loaded from <head>).
      const existing = document.querySelector("script[data-paystack-inline]");
      if (existing) {
        const wait = () => {
          if (window.PaystackPop) resolve();
          else window.setTimeout(wait, 30);
        };
        existing.addEventListener("load", () => resolve(), { once: true });
        existing.addEventListener(
          "error",
          () => reject(new Error("Paystack failed to load")),
          { once: true }
        );
        wait();
        return;
      }

      const form = document.querySelector("[data-checkout-form]");
      if (!form) {
        reject(new Error("Checkout form missing; cannot start Paystack."));
        return;
      }
      const script = document.createElement("script");
      script.src = "https://js.paystack.co/v1/inline.js";
      script.dataset.paystackInline = "1";
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Paystack failed to load"));
      form.appendChild(script);
    });

  const boot = () => {
    const form = $("[data-checkout-form]");
    if (!form || !window.SnuzCart) return;

    const emailInput = $("#checkout-email", form);
    const deliveryPickup = $("#delivery-pickup", form);
    const countrySelect = $("#checkout-country", form);
    const stateSelect = $("#checkout-state", form);
    const shippingBlock = $("[data-shipping-methods]", form);
    const billingSame = $("#billing-same", form);
    const billingFields = $("[data-billing-fields]", form);
    const billingCountry = $("#billing-country", form);
    const billingState = $("#billing-state", form);
    const payBtn = $("[data-pay-now]", form);
    const payError = $("[data-pay-error]", form);
    const summaryItems = $("[data-checkout-items]");
    const summarySubtotal = $("[data-checkout-subtotal]");
    const summaryShipping = $("[data-checkout-shipping]");
    const summaryTotal = $("[data-checkout-total]");
    const emptyNote = $("[data-checkout-empty]");
    const quoteFeeEl = $("[data-shipping-quote-fee]");
    const quoteDetailEl = $("[data-shipping-quote-detail]");
    const quoteStatusEl = $("[data-shipping-quote-status]");

    let isPaying = false;
    let shippingQuote = null;
    let quoteBusy = false;
    let quoteTimer = null;
    let quoteRequestId = 0;

    fillStateSelect(stateSelect, countrySelect?.value || "Nigeria", "Lagos");
    fillStateSelect(billingState, billingCountry?.value || "Nigeria", "Lagos");

    const getDeliveryMode = () => (deliveryPickup?.checked ? "pickup" : "ship");
    const shippingMode = () => window.SnuzCart.shop().shippingMode || "on_delivery";
    const usesDistance = () => shippingMode() === "distance";
    const paysDispatcherOnDelivery = () =>
      shippingMode() === "on_delivery" || shippingMode() === "varies";
    const billingSameAsShipping = () => !!billingSame?.checked;

    let selectedFormattedAddress = "";

    const destinationParts = () => ({
      address: $("#checkout-address", form)?.value.trim() || "",
      apartment: $("#checkout-apartment", form)?.value.trim() || "",
      city: $("#checkout-city", form)?.value.trim() || "",
      stateRegion: stateSelect?.value || "",
      postalCode: $("#checkout-postal", form)?.value.trim() || "",
      country: countrySelect?.value || "Nigeria",
      formattedAddress: selectedFormattedAddress,
    });

    const destinationReady = () => {
      const d = destinationParts();
      // A selected Google suggestion (full formatted address) is enough.
      if (!isBlank(d.formattedAddress) && d.formattedAddress.length > 8) return true;
      return !isBlank(d.address) && !isBlank(d.city) && !isBlank(d.stateRegion);
    };

    const shippingCost = () => {
      if (getDeliveryMode() !== "ship") return 0;
      if (usesDistance()) return Number(shippingQuote?.feeNaira) || 0;
      return 0;
    };

    const shippingReady = () => {
      if (getDeliveryMode() !== "ship") return true;
      if (!usesDistance()) return true;
      return Boolean(shippingQuote?.ok);
    };

    const renderQuoteUi = () => {
      const fmt = window.SnuzCart.formatNaira;
      if (getDeliveryMode() !== "ship") {
        if (quoteFeeEl) quoteFeeEl.textContent = fmt(0);
        if (quoteDetailEl) {
          quoteDetailEl.textContent = "Pickup selected — no delivery fee.";
        }
        if (quoteStatusEl) quoteStatusEl.textContent = "";
        return;
      }

      if (paysDispatcherOnDelivery()) {
        if (quoteFeeEl) quoteFeeEl.textContent = fmt(0);
        if (quoteDetailEl) {
          quoteDetailEl.textContent =
            "Your order total covers products only. Delivery fee is paid directly to the dispatcher when your order arrives.";
        }
        if (quoteStatusEl) quoteStatusEl.textContent = "";
        return;
      }

      if (!usesDistance()) {
        if (quoteFeeEl) quoteFeeEl.textContent = "Varies";
        if (quoteDetailEl) {
          quoteDetailEl.textContent =
            "Delivery depends on distance and details. We’ll confirm after your order.";
        }
        if (quoteStatusEl) quoteStatusEl.textContent = "";
        return;
      }

      if (quoteBusy) {
        if (quoteFeeEl) quoteFeeEl.textContent = "…";
        if (quoteStatusEl) quoteStatusEl.textContent = "Calculating shipping…";
        return;
      }

      if (!destinationReady()) {
        if (quoteFeeEl) quoteFeeEl.textContent = "—";
        if (quoteDetailEl) {
          quoteDetailEl.textContent =
            "Enter your delivery address above, then we’ll calculate the fee from the nearest store.";
        }
        if (quoteStatusEl) quoteStatusEl.textContent = "";
        return;
      }

      if (shippingQuote?.ok) {
        if (quoteFeeEl) quoteFeeEl.textContent = fmt(shippingQuote.feeNaira);
        if (quoteDetailEl) {
          const store = shippingQuote.distributor?.name || "nearest store";
          const km = shippingQuote.distanceKm;
          const eta = shippingQuote.durationText
            ? ` · about ${shippingQuote.durationText}`
            : "";
          quoteDetailEl.textContent = `From ${store} · ${km} km${eta}`;
        }
        if (quoteStatusEl) {
          quoteStatusEl.textContent = "Shipping fee added to your total.";
        }
        return;
      }

      if (quoteFeeEl) quoteFeeEl.textContent = "—";
      if (quoteDetailEl) {
        quoteDetailEl.textContent =
          shippingQuote?.error ||
          "Enter your delivery address above, then we’ll calculate the fee from the nearest store.";
      }
      if (quoteStatusEl) {
        quoteStatusEl.textContent = shippingQuote?.error
          ? "Shipping not ready yet."
          : "";
      }
    };

    const renderSummary = () => {
      const { items, subtotal } = window.SnuzCart.getState();
      const ship = shippingCost();
      const total = subtotal + ship;
      const fmt = window.SnuzCart.formatNaira;

      if (emptyNote) emptyNote.hidden = items.length > 0;
      if (summarySubtotal) summarySubtotal.textContent = fmt(subtotal);

      if (summaryShipping) {
        if (getDeliveryMode() === "pickup") {
          summaryShipping.textContent = fmt(0);
        } else if (paysDispatcherOnDelivery()) {
          summaryShipping.textContent = "Pay on delivery";
        } else if (usesDistance()) {
          summaryShipping.textContent = shippingQuote?.ok
            ? fmt(ship)
            : quoteBusy
              ? "…"
              : "—";
        } else {
          summaryShipping.textContent = "Varies";
        }
      }

      if (summaryTotal) summaryTotal.textContent = fmt(total);

      if (summaryItems) {
        summaryItems.innerHTML = items.length
          ? items
              .map(
                (item) => `
            <div class="checkout-summary__line">
              <img src="${item.image}" alt="" width="56" height="56" />
              <div>
                <p>${item.brand ? `${item.brand} · ${item.title}` : item.title}</p>
                <span>× ${item.quantity}</span>
              </div>
              <strong>${fmt(item.priceNaira * item.quantity)}</strong>
            </div>
          `
              )
              .join("")
          : `<p class="checkout-summary__empty">No items in cart.</p>`;
      }

      if (shippingBlock) {
        shippingBlock.hidden = getDeliveryMode() !== "ship";
      }
      if (billingFields) {
        billingFields.hidden = billingSameAsShipping();
      }

      renderQuoteUi();
      updatePayButton(total, items.length);
      return { items, subtotal, ship, total };
    };

    const missingFields = () => {
      const missing = [];
      const email = emailInput?.value.trim() || "";
      if (!email || !email.includes("@")) missing.push("Email");
      if (isBlank($("#checkout-first", form)?.value)) missing.push("First name");
      if (isBlank($("#checkout-last", form)?.value)) missing.push("Last name");
      if (isBlank($("#checkout-address", form)?.value)) missing.push("Address");
      if (isBlank($("#checkout-city", form)?.value)) missing.push("City");
      if (isBlank(stateSelect?.value)) missing.push("State");
      if (isBlank($("#checkout-phone", form)?.value)) missing.push("Phone");

      if (!billingSameAsShipping()) {
        if (isBlank($("#billing-first", form)?.value)) missing.push("Billing first name");
        if (isBlank($("#billing-last", form)?.value)) missing.push("Billing last name");
        if (isBlank($("#billing-address", form)?.value)) missing.push("Billing address");
        if (isBlank($("#billing-city", form)?.value)) missing.push("Billing city");
        if (isBlank(billingState?.value)) missing.push("Billing state");
        if (isBlank($("#billing-phone", form)?.value)) missing.push("Billing phone");
      }

      if (getDeliveryMode() === "ship" && usesDistance() && !shippingQuote?.ok) {
        missing.push("Shipping quote");
      }
      return missing;
    };

    const updatePayButton = (total, itemCount) => {
      if (!payBtn) return;
      const missing = missingFields();
      const canPay =
        itemCount > 0 &&
        !isPaying &&
        !quoteBusy &&
        total > 0 &&
        missing.length === 0 &&
        shippingReady();
      payBtn.disabled = !canPay;
      payBtn.textContent = isPaying ? "Redirecting…" : "Pay now";
      if (payError && !isPaying) {
        if (!itemCount) {
          payError.textContent = "Your cart is empty.";
        } else if (quoteBusy) {
          payError.textContent = "Wait for shipping to finish calculating.";
        } else if (missing.includes("Shipping quote")) {
          payError.textContent = "Enter a valid delivery address so we can calculate shipping.";
        } else if (missing.length) {
          payError.textContent = "Fill all required fields to continue.";
        } else {
          payError.textContent = "";
        }
      }
    };

    const scheduleShippingQuote = () => {
      if (!usesDistance() || getDeliveryMode() !== "ship") {
        shippingQuote = null;
        quoteBusy = false;
        renderSummary();
        return;
      }
      if (!destinationReady()) {
        shippingQuote = null;
        quoteBusy = false;
        renderSummary();
        return;
      }
      if (!window.SnuzShipping) {
        shippingQuote = {
          ok: false,
          error: "Shipping calculator failed to load. Refresh and try again.",
        };
        quoteBusy = false;
        renderSummary();
        return;
      }

      window.clearTimeout(quoteTimer);
      quoteTimer = window.setTimeout(async () => {
        const requestId = ++quoteRequestId;
        quoteBusy = true;
        renderSummary();
        try {
          const quote = await window.SnuzShipping.quoteShipping(destinationParts());
          if (requestId !== quoteRequestId) return;
          shippingQuote = quote;
        } catch (e) {
          if (requestId !== quoteRequestId) return;
          shippingQuote = {
            ok: false,
            feeNaira: 0,
            distanceKm: 0,
            durationText: "",
            distributor: null,
            error: e?.message || "Could not calculate shipping.",
          };
        } finally {
          if (requestId === quoteRequestId) {
            quoteBusy = false;
            renderSummary();
          }
        }
      }, 700);
    };

    const collectMetadata = (totals) => {
      const { items, subtotal, ship, total } = totals;
      return {
        cart: items.map((i) => ({
          slug: i.slug,
          title: i.title,
          price: i.price,
          priceNaira: i.priceNaira,
          quantity: i.quantity,
        })),
        shipping: {
          mode: getDeliveryMode(),
          method:
            getDeliveryMode() === "pickup"
              ? "pickup"
              : usesDistance()
                ? "distance"
                : "on_delivery",
          shippingCostNaira: ship,
          shippingDisplay:
            getDeliveryMode() === "pickup"
              ? 0
              : paysDispatcherOnDelivery()
                ? "Pay on delivery"
                : usesDistance()
                  ? ship
                  : "Varies",
          distanceKm: shippingQuote?.distanceKm || null,
          durationText: shippingQuote?.durationText || "",
          nearestDistributor: shippingQuote?.distributor
            ? {
                id: shippingQuote.distributor.id,
                name: shippingQuote.distributor.name,
                address: shippingQuote.distributor.address,
              }
            : null,
          note:
            getDeliveryMode() === "ship" && usesDistance()
              ? "Auto-calculated from closest distributor."
              : getDeliveryMode() === "ship"
                ? "Delivery fee paid directly to dispatcher on delivery."
                : "",
        },
        contact: {
          country: countrySelect?.value || "",
          firstName: $("#checkout-first", form)?.value.trim() || "",
          lastName: $("#checkout-last", form)?.value.trim() || "",
          company: $("#checkout-company", form)?.value.trim() || "",
          address: $("#checkout-address", form)?.value.trim() || "",
          apartment: $("#checkout-apartment", form)?.value.trim() || "",
          city: $("#checkout-city", form)?.value.trim() || "",
          stateRegion: stateSelect?.value || "",
          postalCode: $("#checkout-postal", form)?.value.trim() || "",
          phone: $("#checkout-phone", form)?.value.trim() || "",
        },
        billing: billingSameAsShipping()
          ? { sameAsShipping: true }
          : {
              sameAsShipping: false,
              country: billingCountry?.value || "",
              firstName: $("#billing-first", form)?.value.trim() || "",
              lastName: $("#billing-last", form)?.value.trim() || "",
              company: $("#billing-company", form)?.value.trim() || "",
              address: $("#billing-address", form)?.value.trim() || "",
              apartment: $("#billing-apartment", form)?.value.trim() || "",
              city: $("#billing-city", form)?.value.trim() || "",
              stateRegion: billingState?.value || "",
              postalCode: $("#billing-postal", form)?.value.trim() || "",
              phone: $("#billing-phone", form)?.value.trim() || "",
            },
        totals: {
          subtotalNaira: subtotal,
          shippingCostNaira: ship,
          totalNaira: total,
          currency: "NGN",
        },
      };
    };

    const payWithPopup = async (email, amountKobo, metadata) => {
      const key = window.SnuzCart.shop().paystackPublicKey || "";
      if (!key) {
        throw new Error(
          "Payment is almost ready. Add your Paystack public key in shop-config.js."
        );
      }
      await loadPaystackScript();
      if (!window.PaystackPop) {
        throw new Error("Paystack could not start. Check your connection and try again.");
      }

      return new Promise((resolve, reject) => {
        const handler = window.PaystackPop.setup({
          key,
          email,
          amount: amountKobo,
          currency: "NGN",
          metadata,
          callback: (response) => resolve(response),
          onClose: () => reject(new Error("Payment window closed.")),
        });
        handler.openIframe();
      });
    };

    const payWithApi = async (email, amountKobo, metadata) => {
      const base = (window.SnuzCart.shop().apiBase || "").replace(/\/+$/, "");
      const url = `${base}/api/paystack/initialize`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, amountKobo, metadata }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok || !json?.authorization_url) {
        throw new Error(json?.error || "Unable to start payment. Try again.");
      }
      window.location.href = json.authorization_url;
    };

    const onPayNow = async () => {
      if (payError) payError.textContent = "";
      const totals = renderSummary();
      const missing = missingFields();

      if (!totals.items.length) {
        if (payError) payError.textContent = "Your cart is empty.";
        return;
      }
      if (missing.length) {
        if (payError) {
          payError.textContent = `Please fill: ${missing.slice(0, 5).join(", ")}${
            missing.length > 5 ? "…" : ""
          }`;
        }
        return;
      }
      if (totals.total <= 0) {
        if (payError) payError.textContent = "Invalid total amount.";
        return;
      }

      const email = emailInput.value.trim();
      const amountKobo = Math.round(totals.total * 100);
      const metadata = collectMetadata(totals);
      const useApi = Boolean(window.SnuzCart.shop().apiBase);

      isPaying = true;
      updatePayButton(totals.total, totals.items.length);

      try {
        if (useApi) {
          await payWithApi(email, amountKobo, metadata);
          return;
        }
        const response = await payWithPopup(email, amountKobo, metadata);
        try {
          window.sessionStorage.setItem("snuz_last_order", JSON.stringify(metadata));
        } catch {
          // ignore
        }
        window.SnuzCart.clearCart();
        window.location.href = `./checkout-success.html?reference=${encodeURIComponent(
          response.reference || ""
        )}`;
      } catch (e) {
        if (payError) {
          payError.textContent = e?.message || "Payment failed to start. Try again.";
        }
      } finally {
        isPaying = false;
        renderSummary();
      }
    };

    const onAddressRelatedChange = () => {
      renderSummary();
      scheduleShippingQuote();
    };

    form.addEventListener("input", (e) => {
      const id = e.target?.id || "";
      if (
        id.startsWith("checkout-address") ||
        id === "checkout-apartment" ||
        id === "checkout-city" ||
        id === "checkout-state" ||
        id === "checkout-postal" ||
        id === "checkout-country"
      ) {
        onAddressRelatedChange();
        return;
      }
      renderSummary();
    });
    form.addEventListener("change", (e) => {
      const id = e.target?.id || "";
      const name = e.target?.name || "";
      if (
        id === "checkout-state" ||
        id === "checkout-country" ||
        name === "delivery"
      ) {
        onAddressRelatedChange();
        return;
      }
      renderSummary();
    });

    billingCountry?.addEventListener("change", () => {
      fillStateSelect(billingState, billingCountry.value, billingState.value);
      renderSummary();
    });

    $$("[name='delivery']", form).forEach((el) =>
      el.addEventListener("change", onAddressRelatedChange)
    );
    $$("[name='billing']", form).forEach((el) =>
      el.addEventListener("change", renderSummary)
    );

    payBtn?.addEventListener("click", (e) => {
      e.preventDefault();
      onPayNow();
    });

    const matchStateOption = (select, stateName) => {
      if (!select || !stateName) return false;
      const wanted = String(stateName).trim().toLowerCase();
      const options = Array.from(select.options || []);
      const exact = options.find((o) => o.value.toLowerCase() === wanted);
      if (exact) {
        select.value = exact.value;
        return true;
      }
      const partial = options.find(
        (o) =>
          o.value &&
          (o.value.toLowerCase().includes(wanted) || wanted.includes(o.value.toLowerCase()))
      );
      if (partial) {
        select.value = partial.value;
        return true;
      }
      return false;
    };

    let addressAutocomplete = null;
    const initAddressAutocomplete = async () => {
      const input = $("#checkout-address", form);
      const listEl = $("[data-address-suggestions]", form);
      if (!input || !window.SnuzShipping?.attachAddressAutocomplete) return;
      if (!(window.SnuzCart.shop().googleMapsApiKey || "").trim()) {
        if (quoteStatusEl) {
          quoteStatusEl.textContent =
            "Add your Google Maps API key in shop-config.js to enable address suggestions.";
        }
        return;
      }

      try {
        addressAutocomplete = await window.SnuzShipping.attachAddressAutocomplete(input, {
          listEl,
          getCountry: () => countrySelect?.value || "Nigeria",
          onInput: () => {
            selectedFormattedAddress = "";
            onAddressRelatedChange();
          },
          onPlace: (place) => {
            selectedFormattedAddress =
              place.formattedAddress || place.address || "";
            if (selectedFormattedAddress) input.value = selectedFormattedAddress;
            const cityInput = $("#checkout-city", form);
            const postalInput = $("#checkout-postal", form);
            if (cityInput && place.city) cityInput.value = place.city;
            if (postalInput && place.postalCode) postalInput.value = place.postalCode;
            if (place.state) matchStateOption(stateSelect, place.state);
            onAddressRelatedChange();
          },
          onError: (err) => {
            const msg = String(err?.message || err || "");
            if (quoteStatusEl) {
              if (/RefererNotAllowed|referer/i.test(msg)) {
                quoteStatusEl.textContent =
                  "Google blocked this site URL. Add http://localhost:5173/* to your key’s website restrictions.";
              } else {
                quoteStatusEl.textContent =
                  msg || "Address suggestions failed. You can still type manually.";
              }
            }
          },
        });
      } catch (e) {
        const msg = String(e?.message || e || "");
        if (quoteStatusEl) {
          if (/RefererNotAllowed|referer/i.test(msg)) {
            quoteStatusEl.textContent =
              "Google blocked this site URL. Add http://localhost:5173/* to your key’s website restrictions.";
          } else {
            quoteStatusEl.textContent =
              msg ||
              "Address suggestions unavailable. You can still type manually.";
          }
        }
      }
    };

    countrySelect?.addEventListener("change", () => {
      fillStateSelect(stateSelect, countrySelect.value, stateSelect.value);
      try {
        addressAutocomplete?.setRegionCodes?.(countrySelect.value);
      } catch {
        // ignore
      }
      onAddressRelatedChange();
    });

    window.SnuzCart.subscribe(renderSummary);
    renderSummary();
    scheduleShippingQuote();
    initAddressAutocomplete();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
