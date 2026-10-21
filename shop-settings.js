/**
 * Bank account and shipping amounts.
 * Saved from /admin.html. Checkout reads this, not numbers in the page.
 * SQL: scripts/shop-settings.sql
 */
(() => {
  const LOCAL_KEY = "snuz_shop_settings_v1";
  const ROW_ID = "shop";

  const MODES = ["on_delivery", "distance", "varies"];

  const shop = () => window.SNUZ_SHOP || {};

  const hasSupabase = () => {
    const url = String(shop().supabaseUrl || "").trim();
    const key = String(shop().supabaseAnonKey || "").trim();
    return Boolean(url && key);
  };

  const headers = (extra = {}) => {
    const key = String(shop().supabaseAnonKey || "").trim();
    return {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...extra,
    };
  };

  const restUrl = () => {
    const base = String(shop().supabaseUrl || "").replace(/\/+$/, "");
    return `${base}/rest/v1/shop_settings`;
  };

  const money = (value) => {
    const n = Math.round(Number(value));
    return Number.isFinite(n) && n > 0 ? n : 0;
  };

  const normalize = (row = {}) => {
    const mode = String(row.shippingMode || row.shipping_mode || "on_delivery");
    return {
      bank: String(row.bank || "").trim(),
      accountName: String(row.accountName || row.account_name || "").trim(),
      accountNumber: String(row.accountNumber || row.account_number || "").replace(/\s+/g, ""),
      shippingMode: MODES.includes(mode) ? mode : "on_delivery",
      shippingBaseNaira: money(row.shippingBaseNaira ?? row.shipping_base_naira),
      shippingPerKmNaira: money(row.shippingPerKmNaira ?? row.shipping_per_km_naira),
      shippingMinNaira: money(row.shippingMinNaira ?? row.shipping_min_naira),
      shippingMaxNaira: money(row.shippingMaxNaira ?? row.shipping_max_naira),
      shippingRoundToNaira: Math.max(1, money(row.shippingRoundToNaira ?? row.shipping_round_to_naira) || 1),
    };
  };

  const blank = () =>
    normalize({
      shippingMode: "on_delivery",
      shippingRoundToNaira: 1,
    });

  const apply = (settings) => {
    const next = normalize(settings);
    window.SNUZ_SHOP = window.SNUZ_SHOP || {};
    window.SNUZ_SHOP.bankTransfer = {
      bank: next.bank,
      accountName: next.accountName,
      accountNumber: next.accountNumber,
    };
    window.SNUZ_SHOP.shippingMode = next.shippingMode;
    window.SNUZ_SHOP.shippingBaseNaira = next.shippingBaseNaira;
    window.SNUZ_SHOP.shippingPerKmNaira = next.shippingPerKmNaira;
    window.SNUZ_SHOP.shippingMinNaira = next.shippingMinNaira;
    window.SNUZ_SHOP.shippingMaxNaira = next.shippingMaxNaira;
    window.SNUZ_SHOP.shippingRoundToNaira = next.shippingRoundToNaira;
    return next;
  };

  const readLocal = () => {
    try {
      const raw = localStorage.getItem(LOCAL_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch {
      return null;
    }
  };

  const writeLocal = (settings) => {
    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(settings));
    } catch {
      // ignore quota / private mode
    }
  };

  const explain = (text, fallback) => {
    const raw = String(text || "").trim();
    if (/shop_settings|PGRST205|does not exist|schema cache/i.test(raw)) {
      return "Run scripts/shop-settings.sql once in Supabase, then save again.";
    }
    if (!raw) return fallback;
    try {
      const parsed = JSON.parse(raw);
      if (parsed?.message) return String(parsed.message);
    } catch {
      // not JSON
    }
    return raw || fallback;
  };

  const toRow = (settings) => {
    const next = normalize(settings);
    return {
      id: ROW_ID,
      bank: next.bank,
      account_name: next.accountName,
      account_number: next.accountNumber,
      shipping_mode: next.shippingMode,
      shipping_base_naira: next.shippingBaseNaira,
      shipping_per_km_naira: next.shippingPerKmNaira,
      shipping_min_naira: next.shippingMinNaira,
      shipping_max_naira: next.shippingMaxNaira,
      shipping_round_to_naira: next.shippingRoundToNaira,
      updated_at: new Date().toISOString(),
    };
  };

  const load = async () => {
    if (!hasSupabase()) {
      const local = readLocal();
      const settings = apply(local || blank());
      return { settings, source: local ? "local" : "empty" };
    }
    try {
      const res = await fetch(`${restUrl()}?id=eq.${ROW_ID}&select=*`, { headers: headers() });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(explain(text, `Could not load shop settings (${res.status})`));
      }
      const rows = await res.json();
      const saved = rows?.[0] || null;
      const settings = apply(saved || blank());
      if (saved) writeLocal(settings);
      return { settings, source: saved ? "supabase" : "empty" };
    } catch (err) {
      return {
        settings: apply(blank()),
        source: "error",
        error: err?.message || String(err),
      };
    }
  };

  const save = async (input) => {
    const settings = normalize(input);
    if (settings.shippingMode === "distance") {
      if (settings.shippingMaxNaira <= 0) {
        throw new Error("Distance shipping needs a maximum fee.");
      }
      if (settings.shippingMinNaira > settings.shippingMaxNaira) {
        throw new Error("The minimum shipping fee cannot be higher than the maximum.");
      }
    }
    if (!settings.bank || !settings.accountName || !settings.accountNumber) {
      throw new Error("Bank, account name, and account number are all required.");
    }
    if (!hasSupabase()) {
      writeLocal(settings);
      apply(settings);
      return { settings, source: "local" };
    }

    const res = await fetch(`${restUrl()}?on_conflict=id`, {
      method: "POST",
      headers: headers({ Prefer: "resolution=merge-duplicates,return=representation" }),
      body: JSON.stringify(toRow(settings)),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(explain(text, `Could not save shop settings (${res.status})`));
    }
    writeLocal(settings);
    apply(settings);
    return { settings, source: "supabase" };
  };

  window.SnuzShopSettings = {
    load,
    save,
    apply,
    normalize,
    blank,
    hasSupabase,
  };

  const boot = () => {
    if (!document.querySelector("[data-checkout-form]")) return;
    load().then(() => {
      document.dispatchEvent(new CustomEvent("snuz:shop-settings"));
    });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
