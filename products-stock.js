(() => {
  const LOCAL_KEY = "snuz_product_stock";
  const TABLE = "product_stock";

  const CATALOG = [
    { slug: "pablo", title: "Pablo Blue Mint", brand: "PABLO" },
    { slug: "zafari", title: "Zafari Cool Mint", brand: "ZAFARI" },
    { slug: "zyn", title: "Zyn Fresh Mint", brand: "ZYN" },
    { slug: "iceberg", title: "Iceberg Watermelon", brand: "ICEBERG" },
    { slug: "velo", title: "Velo Bright Spearmint", brand: "VELO" },
    { slug: "maggie", title: "Maggie Cherry Tonic", brand: "MAGGIE" },
  ];

  const defaultStockMap = () => {
    const map = {};
    CATALOG.forEach((p) => {
      map[p.slug] = p.slug === "zafari";
    });
    return map;
  };

  const shop = () => window.SNUZ_SHOP || {};

  const hasSupabase = () => {
    const url = String(shop().supabaseUrl || "").trim();
    const key = String(shop().supabaseAnonKey || "").trim();
    return Boolean(url && key);
  };

  const supabaseHeaders = () => {
    const key = String(shop().supabaseAnonKey || "").trim();
    return {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    };
  };

  const restUrl = (path = "") => {
    const base = String(shop().supabaseUrl || "").replace(/\/+$/, "");
    return `${base}/rest/v1/${TABLE}${path}`;
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

  const writeLocal = (map) => {
    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(map));
    } catch {
      // ignore quota / private mode
    }
  };

  const normalizeMap = (rowsOrMap) => {
    const map = defaultStockMap();
    if (!rowsOrMap) return map;
    if (Array.isArray(rowsOrMap)) {
      rowsOrMap.forEach((row) => {
        if (row && row.slug) map[row.slug] = row.available !== false;
      });
      return map;
    }
    Object.keys(rowsOrMap).forEach((slug) => {
      map[slug] = rowsOrMap[slug] !== false;
    });
    return map;
  };

  const fetchRemoteStock = async () => {
    const res = await fetch(`${restUrl()}?select=slug,title,available`, {
      headers: supabaseHeaders(),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(text || `Stock load failed (${res.status})`);
    }
    return res.json();
  };

  const saveRemoteStock = async (map) => {
    const rows = CATALOG.map((p) => ({
      slug: p.slug,
      title: p.title,
      available: map[p.slug] !== false,
      updated_at: new Date().toISOString(),
    }));
    const res = await fetch(`${restUrl()}?on_conflict=slug`, {
      method: "POST",
      headers: {
        ...supabaseHeaders(),
        Prefer: "resolution=merge-duplicates,return=representation",
      },
      body: JSON.stringify(rows),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(text || `Stock save failed (${res.status})`);
    }
    return res.json();
  };

  const loadStock = async () => {
    if (hasSupabase()) {
      try {
        const rows = await fetchRemoteStock();
        const map = normalizeMap(rows);
        writeLocal(map);
        return { map, source: "supabase" };
      } catch (err) {
        const local = readLocal();
        return {
          map: normalizeMap(local),
          source: "local-fallback",
          error: err?.message || String(err),
        };
      }
    }
    const local = readLocal();
    return {
      map: normalizeMap(local),
      source: local ? "local" : "default",
    };
  };

  const saveStock = async (map) => {
    const next = normalizeMap(map);
    writeLocal(next);
    if (hasSupabase()) {
      await saveRemoteStock(next);
      return { map: next, source: "supabase" };
    }
    return { map: next, source: "local" };
  };

  const soldOutLabel = () => {
    const dict = window.SNUZ_I18N?.dicts?.[window.SNUZ_I18N?.lang || "en"];
    return (dict && dict["products.sold_out"]) || "Sold out";
  };

  const addToCartLabel = () => {
    const dict = window.SNUZ_I18N?.dicts?.[window.SNUZ_I18N?.lang || "en"];
    return (dict && dict["products.add_to_cart"]) || "Add to cart";
  };

  const applyCardStock = (card, available) => {
    const media = card.querySelector(".featured__media") || card;
    let badge = card.querySelector(".product__soldout");
    const btn = card.querySelector(".product__btn");

    if (available) {
      card.classList.remove("is-sold-out");
      card.removeAttribute("data-sold-out");
      if (badge) badge.remove();
      if (btn) {
        btn.disabled = false;
        btn.removeAttribute("aria-disabled");
        btn.dataset.cartBound = "";
        btn.setAttribute("data-i18n", "products.add_to_cart");
        btn.textContent = addToCartLabel();
      }
      return;
    }

    card.classList.add("is-sold-out");
    card.setAttribute("data-sold-out", "true");
    if (!badge && media) {
      badge = document.createElement("div");
      badge.className = "product__soldout";
      badge.setAttribute("aria-label", "Sold out");
      badge.textContent = soldOutLabel();
      const brandBadge = media.querySelector(".product__badge");
      if (brandBadge && brandBadge.nextSibling) {
        brandBadge.after(badge);
      } else {
        media.insertBefore(badge, media.firstChild);
      }
    } else if (badge) {
      badge.textContent = soldOutLabel();
    }
    if (btn) {
      btn.disabled = true;
      btn.setAttribute("aria-disabled", "true");
      btn.dataset.cartBound = "";
      btn.setAttribute("data-i18n", "products.sold_out");
      btn.textContent = soldOutLabel();
    }
  };

  const applyToPage = (map) => {
    document.querySelectorAll(".product[data-category]").forEach((card) => {
      const slug = card.getAttribute("data-category");
      if (!slug) return;
      const available = map[slug] !== false;
      applyCardStock(card, available);
    });
    if (window.SnuzCart?.rewireProducts) {
      window.SnuzCart.rewireProducts();
    }
    document.dispatchEvent(
      new CustomEvent("snuz:stock-applied", { detail: { map } })
    );
  };

  const checkAdminPassword = (input) => {
    const expected = String(shop().adminPassword || "");
    const typed = String(input || "");
    if (!expected) {
      // Local/demo only: any non-empty password when none is configured.
      const host = location.hostname;
      const local = host === "localhost" || host === "127.0.0.1";
      return local && Boolean(typed.trim());
    }
    return typed === expected;
  };

  window.SnuzStock = {
    CATALOG,
    hasSupabase,
    loadStock,
    saveStock,
    applyToPage,
    defaultStockMap,
    checkAdminPassword,
  };

  const bootShop = async () => {
    if (!document.querySelector(".product[data-category]")) return;
    const { map } = await loadStock();
    applyToPage(map);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootShop);
  } else {
    bootShop();
  }
})();
