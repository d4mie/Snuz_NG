(() => {
  const LOCAL_KEY = "snuz_products_v1";
  const TABLE = "products";
  const BUCKET = "product-images";

  const DEFAULT_PRODUCTS = [
    {
      slug: "pablo",
      brand: "PABLO",
      title: "Pablo Blue Mint",
      priceNaira: 9500,
      imageUrl: "./assets/pablo-bluemint.jpg",
      available: false,
      sortOrder: 10,
    },
    {
      slug: "zafari",
      brand: "ZAFARI",
      title: "Zafari Cool Mint",
      priceNaira: 9500,
      imageUrl: "./assets/zafari-coolmint.jpg",
      available: true,
      sortOrder: 20,
    },
    {
      slug: "zyn",
      brand: "ZYN",
      title: "Zyn Fresh Mint",
      priceNaira: 9500,
      imageUrl: "./assets/zyn-freshmint.jpg",
      available: false,
      sortOrder: 30,
    },
    {
      slug: "iceberg",
      brand: "ICEBERG",
      title: "Iceberg Watermelon",
      priceNaira: 9500,
      imageUrl: "./assets/iceberg-watermelon.jpg",
      available: false,
      sortOrder: 40,
    },
    {
      slug: "velo",
      brand: "VELO",
      title: "Velo Bright Spearmint",
      priceNaira: 9500,
      imageUrl: "./assets/velo-brightspearmint.jpg",
      available: false,
      sortOrder: 50,
    },
    {
      slug: "maggie",
      brand: "MAGGIE",
      title: "Maggie Cherry Tonic",
      priceNaira: 100,
      imageUrl: "./assets/maggie-cherrytonic.jpg",
      available: false,
      sortOrder: 60,
    },
  ];

  const shop = () => window.SNUZ_SHOP || {};

  const hasSupabase = () => {
    const url = String(shop().supabaseUrl || "").trim();
    const key = String(shop().supabaseAnonKey || "").trim();
    return Boolean(url && key);
  };

  const supabaseHeaders = (extra = {}) => {
    const key = String(shop().supabaseAnonKey || "").trim();
    return {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...extra,
    };
  };

  const restUrl = (path = "") => {
    const base = String(shop().supabaseUrl || "").replace(/\/+$/, "");
    return `${base}/rest/v1/${TABLE}${path}`;
  };

  const storageUrl = (path = "") => {
    const base = String(shop().supabaseUrl || "").replace(/\/+$/, "");
    return `${base}/storage/v1${path}`;
  };

  const publicImageUrl = (path) => {
    const base = String(shop().supabaseUrl || "").replace(/\/+$/, "");
    return `${base}/storage/v1/object/public/${BUCKET}/${path}`;
  };

  const slugify = (text) =>
    String(text || "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

  const formatNaira = (value) => {
    const amount = Number(value);
    if (Number.isNaN(amount)) return String(value);
    return `₦${amount.toLocaleString("en-NG", { minimumFractionDigits: 0 })}`;
  };

  const escapeHtml = (value) =>
    String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const normalizeProduct = (row, index = 0) => {
    const slug =
      slugify(row?.slug) ||
      slugify(row?.brand) ||
      slugify(row?.title) ||
      `product-${index + 1}`;
    return {
      slug,
      brand: String(row?.brand || "").trim() || "BRAND",
      title: String(row?.title || "").trim() || "Untitled product",
      priceNaira: Math.max(0, Math.round(Number(row?.priceNaira ?? row?.price_naira) || 0)),
      imageUrl: String(row?.imageUrl || row?.image_url || "").trim(),
      available: row?.available !== false,
      sortOrder: Number(row?.sortOrder ?? row?.sort_order ?? (index + 1) * 10) || (index + 1) * 10,
    };
  };

  const normalizeList = (rows) => {
    if (!Array.isArray(rows) || !rows.length) {
      return DEFAULT_PRODUCTS.map((p, i) => normalizeProduct(p, i));
    }
    return rows
      .map((row, i) => normalizeProduct(row, i))
      .sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title));
  };

  /** Keep slug stable when unique; append -2, -3… if the batch would collide. */
  const ensureUniqueSlugs = (list) => {
    const seen = new Set();
    return (Array.isArray(list) ? list : []).map((row, index) => {
      const product = normalizeProduct(row, index);
      let base =
        slugify(product.slug) ||
        slugify(`${product.brand}-${product.title}`) ||
        slugify(product.title) ||
        slugify(product.brand) ||
        `product-${index + 1}`;
      let slug = base;
      let n = 2;
      while (seen.has(slug)) {
        slug = `${base}-${n}`;
        n += 1;
      }
      seen.add(slug);
      return { ...product, slug };
    });
  };

  const parseSupabaseError = (text, fallback) => {
    const raw = String(text || "").trim();
    if (!raw) return fallback;
    try {
      const parsed = JSON.parse(raw);
      const code = parsed?.code;
      const message = String(parsed?.message || parsed?.error || "").trim();
      if (code === "21000" || /affect row a second time/i.test(message)) {
        return "Two products share the same id. Give each flavour a unique name (or remove the duplicate), then save again.";
      }
      if (message) return message;
    } catch {
      // not JSON
    }
    return raw || fallback;
  };

  const toStockMap = (list) => {
    const map = {};
    list.forEach((p) => {
      map[p.slug] = p.available !== false;
    });
    return map;
  };

  const readLocal = () => {
    try {
      const raw = localStorage.getItem(LOCAL_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  };

  const writeLocal = (list) => {
    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(list));
    } catch {
      // ignore quota / private mode
    }
  };

  const fetchRemoteProducts = async () => {
    const res = await fetch(
      `${restUrl()}?select=slug,brand,title,price_naira,image_url,available,sort_order&order=sort_order.asc`,
      { headers: supabaseHeaders() }
    );
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(text || `Product load failed (${res.status})`);
    }
    return res.json();
  };

  const saveRemoteProducts = async (list) => {
    const unique = ensureUniqueSlugs(list);
    const rows = unique.map((p, i) => ({
      slug: p.slug,
      brand: p.brand,
      title: p.title,
      price_naira: p.priceNaira,
      image_url: p.imageUrl,
      available: p.available !== false,
      sort_order: p.sortOrder || (i + 1) * 10,
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
      throw new Error(parseSupabaseError(text, `Product save failed (${res.status})`));
    }
    return res.json();
  };

  const deleteRemoteProduct = async (slug) => {
    const res = await fetch(`${restUrl()}?slug=eq.${encodeURIComponent(slug)}`, {
      method: "DELETE",
      headers: supabaseHeaders({ Prefer: "return=minimal" }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(text || `Product delete failed (${res.status})`);
    }
  };

  const loadProducts = async () => {
    if (hasSupabase()) {
      try {
        const rows = await fetchRemoteProducts();
        const list = normalizeList(rows);
        writeLocal(list);
        return { list, source: "supabase" };
      } catch (err) {
        const local = readLocal();
        return {
          list: normalizeList(local),
          source: "local-fallback",
          error: err?.message || String(err),
        };
      }
    }
    const local = readLocal();
    return {
      list: normalizeList(local),
      source: local ? "local" : "default",
    };
  };

  const saveProducts = async (list) => {
    const next = ensureUniqueSlugs(normalizeList(list));
    writeLocal(next);
    if (hasSupabase()) {
      const remote = await fetchRemoteProducts().catch(() => []);
      const remoteSlugs = new Set((remote || []).map((r) => r.slug));
      const nextSlugs = new Set(next.map((p) => p.slug));
      for (const slug of remoteSlugs) {
        if (!nextSlugs.has(slug)) {
          await deleteRemoteProduct(slug);
        }
      }
      await saveRemoteProducts(next);
      return { list: next, source: "supabase" };
    }
    return { list: next, source: "local" };
  };

  const uploadImage = async (file, slugHint) => {
    if (!hasSupabase()) {
      throw new Error("Add Supabase keys before uploading photos.");
    }
    if (!file || !file.type || !file.type.startsWith("image/")) {
      throw new Error("Choose a JPG, PNG, or WebP image.");
    }
    if (file.size > 5 * 1024 * 1024) {
      throw new Error("Image must be under 5 MB.");
    }
    const ext =
      (file.name && file.name.split(".").pop()?.toLowerCase()) ||
      (file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg");
    const safeSlug = slugify(slugHint) || "product";
    const path = `${safeSlug}/${Date.now()}.${ext}`;
    const key = String(shop().supabaseAnonKey || "").trim();
    const res = await fetch(storageUrl(`/object/${BUCKET}/${path}`), {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": file.type || "application/octet-stream",
        "x-upsert": "true",
      },
      body: file,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(text || `Upload failed (${res.status})`);
    }
    return publicImageUrl(path);
  };

  const soldOutLabel = () => {
    const dict = window.SNUZ_I18N?.dicts?.[window.SNUZ_I18N?.lang || "en"];
    return (dict && dict["products.sold_out"]) || "Sold out";
  };

  const addToCartLabel = () => {
    const dict = window.SNUZ_I18N?.dicts?.[window.SNUZ_I18N?.lang || "en"];
    return (dict && dict["products.add_to_cart"]) || "Add to cart";
  };

  const variesLabel = () => {
    const dict = window.SNUZ_I18N?.dicts?.[window.SNUZ_I18N?.lang || "en"];
    return (dict && dict["products.varies"]) || "Varies";
  };

  const applyCardStock = (card, available) => {
    const media =
      card.querySelector(".featured__media") ||
      card.querySelector(".brands-avail__media") ||
      card.querySelector(".card__media") ||
      card;
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

  const cardHtml = (product, index) => {
    const altBadge = index % 2 === 1 ? " product__badge--alt" : "";
    const img = escapeHtml(product.imageUrl || "./assets/snuz-logo.jpg");
    const brand = escapeHtml(product.brand);
    const title = escapeHtml(product.title);
    const price = formatNaira(product.priceNaira);
    const sold = product.available === false;
    return (
      `<article class="product featured__card${sold ? " is-sold-out" : ""}" data-category="${escapeHtml(product.slug)}"${sold ? ' data-sold-out="true"' : ""}>` +
      `<div class="featured__media">` +
      `<div class="product__badge${altBadge}">${brand}</div>` +
      (sold
        ? `<div class="product__soldout" aria-label="Sold out">${escapeHtml(soldOutLabel())}</div>`
        : "") +
      `<img class="product__img" src="${img}" alt="${title}" width="320" height="320" loading="lazy" decoding="async" />` +
      `</div>` +
      `<div class="featured__body">` +
      `<h3 class="product__name">${title}</h3>` +
      `<div class="product__meta">` +
      `<span class="product__price" data-money="${product.priceNaira}" data-money-currency="NGN">${price}</span>` +
      `<span class="product__strength" data-i18n="products.varies">${escapeHtml(variesLabel())}</span>` +
      `</div>` +
      `<button class="btn btn-small btn-solid product__btn" type="button" data-i18n="${sold ? "products.sold_out" : "products.add_to_cart"}"${sold ? ' disabled aria-disabled="true"' : ""}>` +
      `${escapeHtml(sold ? soldOutLabel() : addToCartLabel())}` +
      `</button>` +
      `</div>` +
      `</article>`
    );
  };

  const renderShopGrid = (list) => {
    const grid = document.querySelector("[data-products-grid], .featured__grid");
    if (!grid) return;
    const products = normalizeList(list);
    grid.innerHTML = products.map((p, i) => cardHtml(p, i)).join("");
    if (window.SnuzCart?.rewireProducts) {
      window.SnuzCart.rewireProducts();
    }
    document.dispatchEvent(
      new CustomEvent("snuz:products-rendered", { detail: { list: products } })
    );
  };

  const applyToPage = (mapOrList) => {
    const map = Array.isArray(mapOrList) ? toStockMap(mapOrList) : mapOrList || {};
    document
      .querySelectorAll(".product[data-category], .brand-card[data-category]")
      .forEach((card) => {
        const slug = card.getAttribute("data-category");
        if (!slug) return;
        applyCardStock(card, map[slug] !== false);
      });
    if (window.SnuzCart?.rewireProducts) {
      window.SnuzCart.rewireProducts();
    }
    document.dispatchEvent(
      new CustomEvent("snuz:stock-applied", { detail: { map } })
    );
  };

  const checkAdminPassword = (input) => {
    const expected = String(shop().adminPassword || "").trim();
    const typed = String(input || "").trim();
    if (!expected) {
      const host = String(location.hostname || "").toLowerCase();
      const local =
        host === "localhost" ||
        host === "127.0.0.1" ||
        host === "[::1]" ||
        host === "::1";
      return local && Boolean(typed);
    }
    return typed === expected;
  };

  // Back-compat aliases used by older admin / stock code
  const loadStock = async () => {
    const result = await loadProducts();
    return {
      map: toStockMap(result.list),
      source: result.source,
      error: result.error,
      list: result.list,
    };
  };

  const saveStock = async (map) => {
    const { list } = await loadProducts();
    const next = list.map((p) => ({
      ...p,
      available: map[p.slug] !== false,
    }));
    const saved = await saveProducts(next);
    return { map: toStockMap(saved.list), source: saved.source, list: saved.list };
  };

  window.SnuzStock = {
    CATALOG: DEFAULT_PRODUCTS.map((p) => ({
      slug: p.slug,
      title: p.title,
      brand: p.brand,
    })),
    hasSupabase,
    loadStock,
    saveStock,
    loadProducts,
    saveProducts,
    ensureUniqueSlugs,
    uploadImage,
    renderShopGrid,
    applyToPage,
    defaultStockMap: () => toStockMap(DEFAULT_PRODUCTS),
    defaultProducts: () => DEFAULT_PRODUCTS.map((p) => normalizeProduct(p)),
    normalizeProduct,
    normalizeList,
    slugify,
    formatNaira,
    checkAdminPassword,
  };

  const bootShop = async () => {
    const grid = document.querySelector("[data-products-grid], .featured__grid");
    if (!grid && !document.querySelector(".product[data-category], .brand-card[data-category]")) {
      return;
    }
    const { list, source } = await loadProducts();
    if (grid && (source === "supabase" || source === "local" || source === "local-fallback")) {
      renderShopGrid(list);
    } else if (grid && source === "default") {
      // Keep HTML cards, but sync sold-out state from defaults
      applyToPage(list);
    } else {
      applyToPage(list);
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootShop);
  } else {
    bootShop();
  }
})();
