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

  const flavourFromTitle = (brand, title) => {
    const name = String(title || "").trim();
    const label = String(brand || "").trim();
    if (!name) return "Classic";
    if (!label) return name;
    const stripped = name.replace(new RegExp(`^${label}\\s+`, "i"), "").trim();
    return stripped || name;
  };

  const normalizeVariant = (row, fallback = {}) => {
    const flavour = String(row?.flavour || fallback.flavour || "").trim();
    const mg = Math.max(0, Math.round(Number(row?.mg ?? fallback.mg) || 0));
    const priceNaira = Math.max(
      0,
      Math.round(Number(row?.priceNaira ?? row?.price_naira ?? fallback.priceNaira) || 0)
    );
    return {
      flavour,
      mg,
      priceNaira,
      available: row?.available !== false,
      imageUrl: String(row?.imageUrl || row?.image_url || fallback.imageUrl || "").trim(),
    };
  };

  const variantImage = (product, variant) =>
    String(variant?.imageUrl || product?.imageUrl || "./assets/snuz-logo.jpg").trim();

  const parseVariantsField = (raw) => {
    if (Array.isArray(raw)) return raw;
    if (typeof raw === "string" && raw.trim()) {
      try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  };

  const normalizeVariants = (row) => {
    const fallback = {
      flavour: flavourFromTitle(row?.brand, row?.title),
      mg: 0,
      priceNaira: row?.priceNaira ?? row?.price_naira,
      available: true,
    };
    const list = parseVariantsField(row?.variants)
      .map((item) => normalizeVariant(item, fallback))
      .filter((item) => item.flavour);
    if (list.length) return list;
    return [normalizeVariant(fallback, fallback)];
  };

  const uniqueFlavours = (product) => {
    const names = [];
    (product?.variants || []).forEach((item) => {
      if (item.flavour && !names.includes(item.flavour)) names.push(item.flavour);
    });
    return names;
  };

  const mgsForFlavour = (product, flavour) =>
    (product?.variants || [])
      .filter((item) => item.flavour === flavour)
      .map((item) => Number(item.mg) || 0)
      .filter((mg, i, arr) => arr.indexOf(mg) === i)
      .sort((a, b) => a - b);

  const findVariant = (product, flavour, mg) => {
    const variants = product?.variants || [];
    const strength = Number(mg) || 0;
    return (
      variants.find((item) => item.flavour === flavour && Number(item.mg) === strength) ||
      variants.find((item) => item.flavour === flavour) ||
      variants[0] ||
      null
    );
  };

  const variantSlug = (brand, flavour, mg) => {
    const base = slugify(`${brand}-${flavour}`) || slugify(brand) || "product";
    const strength = Number(mg) || 0;
    return strength > 0 ? `${base}-${strength}` : base;
  };

  const sellableFrom = (product, variant) => {
    const flavour = variant?.flavour || "";
    const mg = Number(variant?.mg) || 0;
    const priceNaira = Math.max(0, Number(variant?.priceNaira ?? product?.priceNaira) || 0);
    const title = mg > 0 ? `${flavour} ${mg}mg` : flavour;
    return {
      slug: variantSlug(product?.brand, flavour, mg),
      brand: product?.brand || "",
      title,
      flavour,
      mg,
      priceNaira,
      price: formatNaira(priceNaira),
      image: variantImage(product, variant),
    };
  };

  const normalizeProduct = (row, index = 0) => {
    const slug =
      slugify(row?.slug) ||
      slugify(row?.brand) ||
      slugify(row?.title) ||
      `product-${index + 1}`;
    const brand = String(row?.brand || "").trim() || "BRAND";
    const title = String(row?.title || "").trim() || "Untitled product";
    const priceNaira = Math.max(0, Math.round(Number(row?.priceNaira ?? row?.price_naira) || 0));
    const available = row?.available !== false;
    const variants = normalizeVariants({ ...row, brand, title, priceNaira });
    const first = variants[0];
    return {
      slug,
      brand,
      title,
      priceNaira: first?.priceNaira ?? priceNaira,
      imageUrl: String(row?.imageUrl || row?.image_url || "").trim(),
      available,
      sortOrder: Number(row?.sortOrder ?? row?.sort_order ?? (index + 1) * 10) || (index + 1) * 10,
      variants,
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

  const SELECT_BASIC = "slug,brand,title,price_naira,image_url,available,sort_order";
  const SELECT_WITH_VARIANTS = `${SELECT_BASIC},variants`;
  let variantsColumnReady = true;

  const missingVariantsColumn = (text) =>
    /variants/i.test(String(text || "")) &&
    (/does not exist|PGRST204|schema cache|42703/i.test(String(text || "")));

  const toRemoteRow = (p, i, includeVariants) => {
    const row = {
      slug: p.slug,
      brand: p.brand,
      title: p.title,
      price_naira: p.priceNaira,
      image_url: p.imageUrl,
      available: p.available !== false,
      sort_order: p.sortOrder || (i + 1) * 10,
      updated_at: new Date().toISOString(),
    };
    if (includeVariants) row.variants = Array.isArray(p.variants) ? p.variants : [];
    return row;
  };

  const fetchRemoteProducts = async () => {
    const select = variantsColumnReady ? SELECT_WITH_VARIANTS : SELECT_BASIC;
    const res = await fetch(`${restUrl()}?select=${select}&order=sort_order.asc`, {
      headers: supabaseHeaders(),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      if (variantsColumnReady && missingVariantsColumn(text)) {
        variantsColumnReady = false;
        return fetchRemoteProducts();
      }
      throw new Error(parseSupabaseError(text, `Product load failed (${res.status})`));
    }
    return res.json();
  };

  const saveRemoteProducts = async (list) => {
    const unique = ensureUniqueSlugs(list);
    const postRows = async (includeVariants) => {
      const res = await fetch(`${restUrl()}?on_conflict=slug`, {
        method: "POST",
        headers: {
          ...supabaseHeaders(),
          Prefer: "resolution=merge-duplicates,return=representation",
        },
        body: JSON.stringify(unique.map((p, i) => toRemoteRow(p, i, includeVariants))),
      });
      const text = await res.text().catch(() => "");
      return { res, text };
    };

    let { res, text } = await postRows(variantsColumnReady);
    if (!res.ok && variantsColumnReady && missingVariantsColumn(text)) {
      variantsColumnReady = false;
      ({ res, text } = await postRows(false));
    }
    if (!res.ok) {
      throw new Error(parseSupabaseError(text, `Product save failed (${res.status})`));
    }
    try {
      return text ? JSON.parse(text) : [];
    } catch {
      return [];
    }
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

  const strengthLabel = (product) => {
    const mgs = [
      ...new Set((product.variants || []).map((item) => Number(item.mg) || 0).filter((n) => n > 0)),
    ];
    if (mgs.length === 1) return `${mgs[0]}mg`;
    return variesLabel();
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
      `<span class="product__strength">${escapeHtml(strengthLabel(product))}</span>` +
      `</div>` +
      `<button class="btn btn-small btn-solid product__btn" type="button" data-i18n="${sold ? "products.sold_out" : "products.add_to_cart"}"${sold ? ' disabled aria-disabled="true"' : ""}>` +
      `${escapeHtml(sold ? soldOutLabel() : addToCartLabel())}` +
      `</button>` +
      `</div>` +
      `</article>`
    );
  };

  const optionHtml = (value, label, selected) =>
    `<option value="${escapeHtml(String(value))}"${selected ? " selected" : ""}>${escapeHtml(label)}</option>`;

  const mgLabel = (mg) => (Number(mg) > 0 ? `${Number(mg)}mg` : "—");

  const shopCardHtml = (product, index) => {
    const altBadge = index % 2 === 1 ? " product__badge--alt" : "";
    const brand = escapeHtml(product.brand);
    const flavours = uniqueFlavours(product);
    const firstFlavour = flavours[0] || "";
    const mgs = mgsForFlavour(product, firstFlavour);
    const firstMg = mgs[0] ?? 0;
    const variant = findVariant(product, firstFlavour, firstMg);
    const img = escapeHtml(variantImage(product, variant));
    const sold = product.available === false || variant?.available === false;
    const price = formatNaira(variant?.priceNaira ?? product.priceNaira);
    const flavourChips = flavours
      .map(
        (name) =>
          `<button class="shop-card__chip${name === firstFlavour ? " is-on" : ""}" type="button" data-shop-flavour-opt="${escapeHtml(name)}"${product.available === false ? " disabled" : ""}>${escapeHtml(name)}</button>`
      )
      .join("");
    const mgChips = mgs
      .map(
        (mg) =>
          `<button class="shop-card__chip${mg === firstMg ? " is-on" : ""}" type="button" data-shop-mg-opt="${escapeHtml(String(mg))}"${product.available === false ? " disabled" : ""}>${escapeHtml(mgLabel(mg))}</button>`
      )
      .join("");
    return (
      `<article class="shop-card featured__card${sold ? " is-sold-out" : ""}" data-shop-card data-brand-slug="${escapeHtml(product.slug)}"${sold ? ' data-sold-out="true"' : ""}>` +
      `<div class="featured__media">` +
      `<div class="product__badge${altBadge}">${brand}</div>` +
      (sold
        ? `<div class="product__soldout" aria-label="Sold out">${escapeHtml(soldOutLabel())}</div>`
        : "") +
      `<img class="product__img" src="${img}" alt="${brand}" width="320" height="320" loading="lazy" decoding="async" />` +
      `</div>` +
      `<div class="featured__body">` +
      `<h3 class="product__name">${brand}</h3>` +
      `<div class="shop-card__picks">` +
      `<span class="shop-card__label">Flavour</span>` +
      `<div class="shop-card__chips" data-shop-flavour role="group" aria-label="Flavour">${flavourChips}</div>` +
      `</div>` +
      `<div class="shop-card__picks">` +
      `<span class="shop-card__label">Strength</span>` +
      `<div class="shop-card__chips" data-shop-mg role="group" aria-label="Strength">${mgChips}</div>` +
      `</div>` +
      `<div class="product__meta">` +
      `<span class="product__price" data-shop-price data-money="${variant?.priceNaira ?? product.priceNaira}" data-money-currency="NGN">${price}</span>` +
      `</div>` +
      `<button class="btn btn-small product__btn shop-card__buy" type="button" data-shop-add${sold ? " disabled aria-disabled=\"true\"" : ""}>` +
      `${escapeHtml(sold ? soldOutLabel() : addToCartLabel())}` +
      `</button>` +
      `</div>` +
      `</article>`
    );
  };

  const selectedChipValue = (root, attr) =>
    root?.querySelector(`.shop-card__chip.is-on[${attr}]`)?.getAttribute(attr) ||
    root?.querySelector(`[${attr}]`)?.getAttribute(attr) ||
    "";

  const selectedVariantFromCard = (card, product) => {
    const flavour =
      selectedChipValue(card, "data-shop-flavour-opt") || uniqueFlavours(product)[0] || "";
    const mg = Number(selectedChipValue(card, "data-shop-mg-opt") || 0);
    return findVariant(product, flavour, mg);
  };

  const renderMgChips = (card, product, flavour, keepMg) => {
    const wrap = card.querySelector("[data-shop-mg]");
    if (!wrap) return;
    const mgs = mgsForFlavour(product, flavour);
    const nextMg = mgs.includes(Number(keepMg)) ? Number(keepMg) : (mgs[0] ?? 0);
    const locked = product.available === false;
    wrap.innerHTML = mgs
      .map(
        (mg) =>
          `<button class="shop-card__chip${mg === nextMg ? " is-on" : ""}" type="button" data-shop-mg-opt="${escapeHtml(String(mg))}"${locked ? " disabled" : ""}>${escapeHtml(mgLabel(mg))}</button>`
      )
      .join("");
  };

  const syncShopCard = (card, product, nextFlavour) => {
    if (!card || !product) return;
    const priceEl = card.querySelector("[data-shop-price]");
    const imgEl = card.querySelector(".product__img");
    const btn = card.querySelector("[data-shop-add]");
    const badge = card.querySelector(".product__soldout");
    const flavour =
      nextFlavour ||
      selectedChipValue(card, "data-shop-flavour-opt") ||
      uniqueFlavours(product)[0] ||
      "";
    const currentMg = selectedChipValue(card, "data-shop-mg-opt");
    renderMgChips(card, product, flavour, currentMg);
    const variant = selectedVariantFromCard(card, product);
    const sold = product.available === false || variant?.available === false;
    const priceNaira = variant?.priceNaira ?? product.priceNaira;
    if (priceEl) {
      priceEl.textContent = formatNaira(priceNaira);
      priceEl.setAttribute("data-money", String(priceNaira));
    }
    if (imgEl) {
      imgEl.src = variantImage(product, variant);
      imgEl.alt = `${product.brand || ""} ${variant?.flavour || ""}`.trim();
    }
    card.classList.toggle("is-sold-out", sold);
    if (sold) card.setAttribute("data-sold-out", "true");
    else card.removeAttribute("data-sold-out");
    if (btn) {
      btn.disabled = sold;
      if (sold) btn.setAttribute("aria-disabled", "true");
      else btn.removeAttribute("aria-disabled");
      btn.textContent = sold ? soldOutLabel() : addToCartLabel();
    }
    if (sold && !badge) {
      const media = card.querySelector(".featured__media");
      if (media) {
        const el = document.createElement("div");
        el.className = "product__soldout";
        el.setAttribute("aria-label", "Sold out");
        el.textContent = soldOutLabel();
        media.appendChild(el);
      }
    } else if (!sold && badge) {
      badge.remove();
    }
  };

  const bindShopCards = (root, list) => {
    root.querySelectorAll("[data-shop-card]").forEach((card) => {
      const product = list.find((p) => p.slug === card.getAttribute("data-brand-slug"));
      if (!product) return;
      card.addEventListener("click", (event) => {
        const flavourBtn = event.target.closest("[data-shop-flavour-opt]");
        if (flavourBtn && !flavourBtn.disabled) {
          card.querySelectorAll("[data-shop-flavour-opt]").forEach((btn) => {
            btn.classList.toggle("is-on", btn === flavourBtn);
          });
          syncShopCard(card, product, flavourBtn.getAttribute("data-shop-flavour-opt"));
          return;
        }
        const mgBtn = event.target.closest("[data-shop-mg-opt]");
        if (mgBtn && !mgBtn.disabled) {
          card.querySelectorAll("[data-shop-mg-opt]").forEach((btn) => {
            btn.classList.toggle("is-on", btn === mgBtn);
          });
          syncShopCard(card, product);
        }
      });
      const btn = card.querySelector("[data-shop-add]");
      btn?.addEventListener("click", () => {
        const variant = selectedVariantFromCard(card, product);
        if (!variant || product.available === false || variant.available === false) return;
        const item = sellableFrom(product, variant);
        if (!item.title || !item.priceNaira) return;
        window.SnuzCart?.addItem(item, 1);
      });
    });
  };

  const renderFullShop = (list) => {
    const grid = document.querySelector("[data-shop-grid]");
    if (!grid) return;
    const products = normalizeList(list);
    grid.innerHTML = products.map((p, i) => shopCardHtml(p, i)).join("");
    bindShopCards(grid, products);
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
    renderFullShop,
    applyToPage,
    defaultStockMap: () => toStockMap(DEFAULT_PRODUCTS),
    defaultProducts: () => DEFAULT_PRODUCTS.map((p) => normalizeProduct(p)),
    normalizeProduct,
    normalizeList,
    normalizeVariant,
    uniqueFlavours,
    findVariant,
    sellableFrom,
    hasVariantsColumn: () => variantsColumnReady,
    slugify,
    formatNaira,
    checkAdminPassword,
  };

  const bootShop = async () => {
    const shopGrid = document.querySelector("[data-shop-grid]");
    const grid = document.querySelector("[data-products-grid], .featured__grid");
    if (
      !shopGrid &&
      !grid &&
      !document.querySelector(".product[data-category], .brand-card[data-category]")
    ) {
      return;
    }
    const { list, source } = await loadProducts();
    if (shopGrid) {
      renderFullShop(list);
      return;
    }
    if (grid && (source === "supabase" || source === "local" || source === "local-fallback")) {
      renderShopGrid(list);
    } else if (grid && source === "default") {
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
