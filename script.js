// @ts-check

const STORAGE_KEY = "snuz.ng:age_verified_v1";
const SESSION_KEY = "snuz.ng:age_verified_session_v1";
const COOKIE_KEY = "snuz_age_verified";
const WINDOW_NAME_TOKEN = "snuz_age_verified:true";

/**
 * Shared DOM references for the page shell.
 * @returns {{
 *   overlay: HTMLElement | null,
 *   modal: HTMLElement | null,
 *   yes: HTMLButtonElement | null,
 *   no: HTMLButtonElement | null,
 *   remember: HTMLInputElement | null,
 *   backToTop: HTMLButtonElement | null,
 *   year: HTMLElement | null,
 * }}
 */
function getEls() {
  return {
    overlay: document.getElementById("ageGateOverlay"),
    modal: /** @type {HTMLElement | null} */ (document.querySelector(".agegate-modal")),
    yes: /** @type {HTMLButtonElement | null} */ (document.getElementById("ageGateYes")),
    no: /** @type {HTMLButtonElement | null} */ (document.getElementById("ageGateNo")),
    remember: /** @type {HTMLInputElement | null} */ (document.getElementById("ageGateRemember")),
    backToTop: /** @type {HTMLButtonElement | null} */ (document.getElementById("backToTop")),
    year: document.getElementById("year"),
  };
}

function readCookie(name) {
  const parts = String(document.cookie || "").split(";");
  for (const part of parts) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return rest.join("=") || "";
  }
  return "";
}

/**
 * @param {string} name
 * @param {string} value
 * @param {{ maxAgeSeconds?: number }=} options
 */
function writeCookie(name, value, options = {}) {
  // Lax by default to avoid cross-site issues; secure only when https.
  const { maxAgeSeconds } = options;
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  const maxAge = typeof maxAgeSeconds === "number" ? `; Max-Age=${maxAgeSeconds}` : "";
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/${maxAge}; SameSite=Lax${secure}`;
}

function isRememberedVerified() {
  try {
    return localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function isSessionVerified() {
  try {
    return sessionStorage.getItem(SESSION_KEY) === "true";
  } catch {
    return false;
  }
}

function isCookieVerified() {
  try {
    return readCookie(COOKIE_KEY) === "true";
  } catch {
    return false;
  }
}

function isWindowNameVerified() {
  try {
    return String(window.name || "").includes(WINDOW_NAME_TOKEN);
  } catch {
    return false;
  }
}

function setWindowNameVerified() {
  try {
    const current = String(window.name || "");
    if (current.includes(WINDOW_NAME_TOKEN)) return;
    window.name = current ? `${current} ${WINDOW_NAME_TOKEN}` : WINDOW_NAME_TOKEN;
  } catch {
    // ignore
  }
}

function rememberVerified() {
  try {
    localStorage.setItem(STORAGE_KEY, "true");
  } catch {
    // ignore storage errors (private mode, blocked storage, etc.)
  }
}

function rememberSessionVerified() {
  try {
    sessionStorage.setItem(SESSION_KEY, "true");
  } catch {
    // ignore storage errors
  }
}

function showAgeGate() {
  const { overlay, modal, remember } = getEls();
  if (!overlay || !modal || !remember) return;

  overlay.hidden = false;
  document.body.classList.add("modal-open");
  remember.checked = true;

  // Focus for accessibility
  requestAnimationFrame(() => {
    modal.focus();
  });
}

function hideAgeGate() {
  const { overlay } = getEls();
  if (!overlay) return;
  overlay.hidden = true;
  document.body.classList.remove("modal-open");
}

function wireAgeGate() {
  const { yes, no, remember } = getEls();
  if (!yes || !no || !remember) return;

  yes.addEventListener("click", () => {
    // Always allow access for this browser session once user confirms.
    rememberSessionVerified();
    // Fallback that survives refresh even if storage/cookies are blocked.
    setWindowNameVerified();
    // Cookie fallback (session cookie by default).
    try {
      writeCookie(COOKIE_KEY, "true");
    } catch {
      // ignore
    }
    // Optionally persist across browser restarts if user opts in.
    if (remember.checked) {
      rememberVerified();
      try {
        // 1 year persistence
        writeCookie(COOKIE_KEY, "true", { maxAgeSeconds: 60 * 60 * 24 * 365 });
      } catch {
        // ignore
      }
    }
    // Allow access on any page after verification (including brand pages).
    hideAgeGate();
  });

  no.addEventListener("click", () => {
    window.location.href = "./underage.html";
  });

  // Optional: allow Esc to act like "No" (keeps the gate strict)
  document.addEventListener("keydown", (e) => {
    const { overlay } = getEls();
    if (!overlay || overlay.hidden) return;
    if (e.key === "Escape") window.location.href = "./underage.html";
  });
}

function wireBackToTop() {
  const { backToTop } = getEls();
  if (!backToTop) return;

  const onScroll = () => {
    const show = window.scrollY > 600;
    backToTop.hidden = !show;
  };

  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  backToTop.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}

function wireTabs() {
  const tabs = Array.from(document.querySelectorAll(".tabs .tab"));
  const grid = document.getElementById("productsGrid");
  const products = grid ? /** @type {HTMLElement[]} */ (Array.from(grid.querySelectorAll(".product"))) : [];
  if (!tabs.length || !products.length) return;

  const setActive = (tab) => {
    for (const t of tabs) {
      const active = t === tab;
      t.classList.toggle("is-active", active);
      t.setAttribute("aria-selected", active ? "true" : "false");
    }

    const key = tab.getAttribute("data-tab") || "all";
    for (const card of products) {
      const cat = card.getAttribute("data-category") || "";
      const show = key === "all" || cat === key;
      card.style.display = show ? "" : "none";
    }
  };

  for (const t of tabs) {
    t.addEventListener("click", () => setActive(t));
  }
}

function wireFaq() {
  const items = Array.from(document.querySelectorAll(".faq__item"));
  if (!items.length) return;

  for (const item of items) {
    const q = item.querySelector(".faq__q");
    const a = item.querySelector(".faq__a");
    if (!(q instanceof HTMLElement) || !(a instanceof HTMLElement)) continue;

    q.addEventListener("click", () => {
      const open = !item.classList.contains("is-open");
      item.classList.toggle("is-open", open);
      q.setAttribute("aria-expanded", open ? "true" : "false");
      a.hidden = !open;
    });
  }
}

function wireFooterYear() {
  const { year } = getEls();
  if (!year) return;
  year.textContent = String(new Date().getFullYear());
}

const PRODUCT_CATALOG = {
  pablo: [
    { name: "Pablo Blue Mint", image: "./assets/pablo-bluemint.jpg" },
    { name: "Pablo Bubblegum", image: "./assets/pablo-bubblegum.jpg" },
    { name: "Pablo Dark Cherry", image: "./assets/pablo-darkcherry.jpg" },
    { name: "Pablo Frosted Mint", image: "./assets/pablo-frostedmint.jpg" },
    { name: "Pablo Green Mint", image: "./assets/pablo-greenmint.jpg" },
    { name: "Pablo Liquorice", image: "./assets/pablo-liquorice.jpg" },
    { name: "Pablo Orange Exclusive", image: "./assets/pablo-orangeexclusive.jpg" },
    { name: "Pablo Passionfruit", image: "./assets/pablo-passionfruit.jpg" },
  ],
  zafari: [
    { name: "Zafari Cool Mint", image: "./assets/zafari-coolmint.jpg" },
    { name: "Zafari Grapefruit", image: "./assets/zafari-grapefruit.jpg" },
    { name: "Zafari Jalapeño Lime", image: "./assets/zafari-jalapenolime.jpg" },
    { name: "Zafari Mango", image: "./assets/zafari-mango.jpg" },
    { name: "Zafari Mint", image: "./assets/zafari-mint.jpg" },
    { name: "Zafari Passionfruit", image: "./assets/zafari-passionfruit.jpg" },
  ],
  zyn: [
    { name: "Zyn Cool Blueberry", image: "./assets/zyn-coolblueberry.jpg" },
    { name: "Zyn Cool Watermelon", image: "./assets/zyn-coolwatermelon.jpg" },
    { name: "Zyn Fresh Mint", image: "./assets/zyn-freshmint.jpg" },
  ],
  iceberg: [
    { name: "Iceberg Cherry", image: "./assets/iceberg-cherry.jpg" },
    { name: "Iceberg Cola", image: "./assets/iceberg-cola.jpg" },
    { name: "Iceberg Emerald", image: "./assets/iceberg-emerald.jpg" },
    { name: "Iceberg Kiwi Strawberry", image: "./assets/iceberg-kiwistrawberry.jpg" },
    { name: "Iceberg Mango Banana", image: "./assets/iceberg-mango-banana.jpg" },
    { name: "Iceberg Watermelon", image: "./assets/iceberg-watermelon.jpg" },
  ],
  velo: [
    { name: "Velo Bright Spearmint", image: "./assets/velo-brightspearmint.jpg" },
    { name: "Velo Crispy Peppermint", image: "./assets/velo-crispypeppermint.jpg" },
    { name: "Velo Strawberry Ice", image: "./assets/velo-strawberryice.jpg" },
  ],
  maggie: [{ name: "Maggie Cherry Tonic", image: "./assets/maggie-cherrytonic.jpg" }],
};

// --- Product strengths (replace "Varies") ---
const PRODUCT_STRENGTHS = {
  // ICEBERG
  "iceberg kiwi strawberry": "Medium 20mg",
  "iceberg cherry": "20mg",
  "iceberg cola": "Medium 20mg",
  "iceberg watermelon": "Medium 20mg",
  "iceberg mango banana": "Medium 20mg",
  "iceberg emerald": "Ultra 50mg",

  // MAGGIE
  "maggie cherry tonic": "60mg",

  // PABLO
  "pablo orange exclusive": "50mg",
  "pablo bubblegum": "50mg",
  "pablo blue mint": "50mg",
  "pablo green mint": "50mg",
  "pablo frosted mint": "50mg",
  "pablo dark cherry": "50mg",
  "pablo passion fruit": "50mg",
  "pablo passionfruit": "50mg",
  "pablo liquorice": "50mg",

  // KILLA (not currently in catalog, but reserved)
  "killa orange": "13.2mg",

  // ZYN
  "zyn cool blueberry": "Strong 11mg",
  "zyn cool watermelon": "Strong 11mg",
  "zyn fresh mint": "Strong 11mg",

  // VELO
  "velo bright spearmint": "Low 6mg",
  "velo strawberry ice": "Medium 10mg",
  "velo crispy peppermint": "Medium 10mg",
};

function normalizeProductKey(input) {
  return String(input || "")
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // strip diacritics (e.g. ñ)
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function strengthForProductName(name) {
  const key = normalizeProductKey(name);
  return PRODUCT_STRENGTHS[key] || "";
}

/**
 * @param {Document | Element} [root=document]
 */
function applyStrengthLabels(root = document) {
  const cards = Array.from(root.querySelectorAll(".product"));
  for (const card of cards) {
    const name = (card.querySelector(".product__name")?.textContent || "").trim();
    const strengthEl = card.querySelector(".product__strength");
    if (!(strengthEl instanceof HTMLElement)) continue;

    const label = strengthForProductName(name);
    if (label) {
      strengthEl.textContent = label;
      strengthEl.hidden = false;
    } else if (strengthEl.textContent.trim().toLowerCase() === "varies") {
      // No data provided: hide instead of guessing.
      strengthEl.textContent = "";
      strengthEl.hidden = true;
    }
  }
}

const CART_ITEMS_KEY = "snuz.ng:cart_items_v1";
const PRODUCT_QTY_MIN = 1;
const PRODUCT_QTY_MAX = 99;
const DEFAULT_UNIT_PRICE_NGN = 9500;
const DEFAULT_VAT_RATE = 0.075;
const DEFAULT_SHIPPING_NGN = 0;

function readCartItems() {
  try {
    const raw = localStorage.getItem(CART_ITEMS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((x) => x && typeof x === "object")
      .map((x) => ({
        id: String(x.id || ""),
        name: String(x.name || "Product"),
        image: String(x.image || ""),
        price: Number(x.price) || DEFAULT_UNIT_PRICE_NGN,
        qty: Number(x.qty) || 1,
      }))
      .filter((x) => x.id && x.qty > 0);
  } catch {
    return [];
  }
}

function writeCartItems(items) {
  try {
    localStorage.setItem(CART_ITEMS_KEY, JSON.stringify(items));
  } catch {
    // ignore
  }
}

function cartCountFromItems(items) {
  return items.reduce((sum, it) => sum + (Number(it.qty) || 0), 0);
}

function setCartBadges(count) {
  const badges = Array.from(document.querySelectorAll(".header-actions__cart .cart-badge"));
  for (const badge of badges) {
    if (!(badge instanceof HTMLElement)) continue;
    badge.textContent = String(count);
    badge.hidden = !(Number(count) > 0);
    badge.setAttribute("aria-label", `Items in cart: ${count}`);
  }
}

function syncCartCountFromItems(items) {
  const count = cartCountFromItems(items);
  setCartBadges(count);
}

// --- Account (My Account) modal ---
let accountLastActiveEl = null;

function ensureAccountModal() {
  if (document.getElementById("accountOverlay")) return;

  const overlay = document.createElement("div");
  overlay.id = "accountOverlay";
  overlay.className = "account-overlay";
  overlay.hidden = true;

  overlay.innerHTML = `
    <div
      class="account-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="accountTitle"
      aria-describedby="accountDesc"
      tabindex="-1"
    >
      <button class="account-close" type="button" aria-label="Close">×</button>
      <h2 class="account-title" id="accountTitle">Login</h2>
      <p class="sr-only" id="accountDesc">Login form</p>

      <form class="account-form" autocomplete="on" novalidate>
        <div class="field">
          <label class="account-label" for="accountUser">
            Username or email address <span class="account-label__req">*</span>
          </label>
          <input class="account-input" id="accountUser" name="username" autocomplete="username" required />
        </div>

        <div class="field">
          <label class="account-label" for="accountPass">
            Password <span class="account-label__req">*</span>
          </label>
          <input
            class="account-input"
            id="accountPass"
            name="password"
            type="password"
            autocomplete="current-password"
            required
          />
        </div>

        <!-- Visual-only placeholder to match the screenshot -->
        <div class="account-captcha" aria-label="Captcha placeholder">
          <div class="account-captcha__box" aria-hidden="true"></div>
          <div class="account-captcha__text">Verify you are human</div>
        </div>

        <div class="account-row">
          <label class="account-remember">
            <input type="checkbox" name="remember" />
            <span>Remember me</span>
          </label>
          <a class="account-link" href="#forgot">Forgot Password?</a>
        </div>

        <button class="account-submit" type="submit">LOGIN</button>

        <div class="account-register">
          <a class="account-link" href="#register">Register Now!</a>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(overlay);

  overlay.querySelector(".account-close")?.addEventListener("click", closeAccountModal);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeAccountModal();
  });

  overlay.querySelector("form")?.addEventListener("submit", (e) => {
    e.preventDefault();
  });
}

function openAccountModal() {
  ensureAccountModal();
  const overlay = document.getElementById("accountOverlay");
  if (!overlay) return;

  accountLastActiveEl = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  overlay.hidden = false;
  document.body.classList.add("modal-open");

  const user = overlay.querySelector("#accountUser");
  if (user instanceof HTMLElement) user.focus();
}

function closeAccountModal() {
  const overlay = document.getElementById("accountOverlay");
  if (!overlay) return;
  overlay.hidden = true;
  document.body.classList.remove("modal-open");

  if (accountLastActiveEl && typeof accountLastActiveEl.focus === "function") {
    accountLastActiveEl.focus();
  }
  accountLastActiveEl = null;
}

function slugifyId(input) {
  return String(input || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function parsePriceNgn(text) {
  const t = String(text || "");
  const digits = t.replace(/[^0-9.]/g, "");
  const n = parseFloat(digits);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_UNIT_PRICE_NGN;
}

function getQtyFromCard(card) {
  const raw = card?.getAttribute?.("data-qty");
  const n = parseInt(String(raw ?? "1"), 10);
  if (!Number.isFinite(n)) return 1;
  return Math.min(PRODUCT_QTY_MAX, Math.max(PRODUCT_QTY_MIN, n));
}

function setQtyOnCard(card, qty) {
  const next = Math.min(PRODUCT_QTY_MAX, Math.max(PRODUCT_QTY_MIN, qty));
  card.setAttribute("data-qty", String(next));
  const value = card.querySelector(".qty__value");
  if (value) value.textContent = String(next);
}

function ensureQuantityControls() {
  const cards = Array.from(document.querySelectorAll(".product"));
  for (const card of cards) {
    const btn = card.querySelector(".product__btn");
    if (!btn) continue;

    // Normalize CTA label
    if (btn.textContent) btn.textContent = "ADD TO CART";

    // If already present, just ensure qty is sane and continue.
    if (card.querySelector(".qty")) {
      setQtyOnCard(card, getQtyFromCard(card));
      continue;
    }

    // Default qty
    if (!card.hasAttribute("data-qty")) card.setAttribute("data-qty", "1");

    const qty = getQtyFromCard(card);
    const qtyEl = document.createElement("div");
    qtyEl.className = "qty";
    qtyEl.innerHTML = `
      <span class="qty__label">QUANTITY</span>
      <div class="qty__control" role="group" aria-label="Quantity">
        <button class="qty__btn qty__btn--minus" type="button" aria-label="Decrease quantity">–</button>
        <span class="qty__value" aria-live="polite">${qty}</span>
        <button class="qty__btn qty__btn--plus" type="button" aria-label="Increase quantity">+</button>
      </div>
    `;

    // Insert right above the add-to-cart button
    btn.insertAdjacentElement("beforebegin", qtyEl);
  }
}

function wireCart() {
  // Initial sync (based on items in storage)
  syncCartCountFromItems(readCartItems());

  // Quantity +/- and ADD TO CART (home + brand pages)
  document.addEventListener("click", (e) => {
    const target = e.target instanceof Element ? e.target : null;
    if (!target) return;

    const minus = target.closest(".qty__btn--minus");
    const plus = target.closest(".qty__btn--plus");
    if (minus || plus) {
      const card = target.closest(".product");
      if (!card) return;
      const current = getQtyFromCard(card);
      setQtyOnCard(card, current + (plus ? 1 : -1));
      return;
    }

    const btn = target.closest(".product__btn");
    if (!btn) return;

    const card = btn.closest(".product");
    const qty = card ? getQtyFromCard(card) : 1;

    // Create/merge line item
    const name = (card?.querySelector?.(".product__name")?.textContent || "Product").trim();
    const image = card?.querySelector?.("img")?.getAttribute?.("src") || "";
    const priceText = card?.querySelector?.(".product__price")?.textContent || "";
    const price = parsePriceNgn(priceText);
    const id = slugifyId(name) || slugifyId(image) || `item-${Date.now()}`;

    const items = readCartItems();
    const existing = items.find((x) => x.id === id);
    if (existing) {
      existing.qty = Math.min(PRODUCT_QTY_MAX, (Number(existing.qty) || 0) + qty);
    } else {
      items.push({ id, name, image, price, qty });
    }

    writeCartItems(items);
    syncCartCountFromItems(items);
  });
}

/**
 * Build AVIF/WebP fallbacks for a `.jpg`/`.jpeg` URL.
 * @param {string} src
 * @returns {{ avif: string, webp: string, fallback: string } | null}
 */
function modernImageSources(src) {
  const raw = String(src || "");
  const [pathPart, query = ""] = raw.split("?");
  const m = pathPart.match(/^(.*)\.(jpe?g)$/i);
  if (!m) return null;
  const suffix = query ? `?${query}` : "";
  return {
    avif: `${m[1]}.avif${suffix}`,
    webp: `${m[1]}.webp${suffix}`,
    fallback: raw,
  };
}

function formatNgn(amount) {
  const n = Number(amount) || 0;
  return `₦${Math.round(n).toLocaleString()}`;
}

function computeTotals(items) {
  const subtotal = items.reduce((sum, it) => sum + (Number(it.price) || 0) * (Number(it.qty) || 0), 0);
  const shipping = DEFAULT_SHIPPING_NGN;
  const vat = subtotal * DEFAULT_VAT_RATE;
  const total = subtotal + shipping + vat;
  return { subtotal, shipping, vat, total };
}

function renderCartPage() {
  const container = document.querySelector("[data-cart-items]");
  if (!container) return;

  const items = readCartItems();

  if (!items.length) {
    container.innerHTML = `
      <div class="cart-empty">
        <div class="cart-empty__title">Your cart is empty</div>
        <div class="cart-empty__text">Browse products and add items to your cart.</div>
        <a class="btn btn-solid" href="./index.html#products">Shop products</a>
      </div>
    `;
  } else {
    container.innerHTML = items
      .map((it) => {
        const line = (Number(it.price) || 0) * (Number(it.qty) || 0);
        const img = (() => {
          const srcs = modernImageSources(it.image);
          if (!srcs) {
            return `<img class="cart-row__img" src="${it.image}" alt="${it.name}" width="56" height="56" loading="lazy" decoding="async" />`;
          }
          return `
            <picture>
              <source srcset="${srcs.avif}" type="image/avif" />
              <source srcset="${srcs.webp}" type="image/webp" />
              <img class="cart-row__img" src="${srcs.fallback}" alt="${it.name}" width="56" height="56" loading="lazy" decoding="async" />
            </picture>
          `.trim();
        })();
        return `
          <div class="cart-row" data-cart-id="${it.id}">
            <div class="cart-row__product">
              <button class="cart-row__remove" type="button" aria-label="Remove item">×</button>
              ${img}
              <div class="cart-row__name">${it.name}</div>
            </div>
            <div class="cart-row__price">${formatNgn(it.price)}</div>
            <div class="cart-row__qty">
              <div class="cart-qty" role="group" aria-label="Quantity">
                <button class="cart-qty__btn cart-qty__btn--minus" type="button" aria-label="Decrease quantity">–</button>
                <span class="cart-qty__value">${it.qty}</span>
                <button class="cart-qty__btn cart-qty__btn--plus" type="button" aria-label="Increase quantity">+</button>
              </div>
            </div>
            <div class="cart-row__subtotal">${formatNgn(line)}</div>
          </div>
        `;
      })
      .join("");
  }

  const { subtotal, shipping, vat, total } = computeTotals(items);

  const elSubtotal = document.getElementById("cartSubtotal");
  const elShipping = document.getElementById("cartShipping");
  const elVat = document.getElementById("cartVat");
  const elTotal = document.getElementById("cartTotal");
  if (elSubtotal) elSubtotal.textContent = formatNgn(subtotal);
  if (elShipping) elShipping.textContent = formatNgn(shipping);
  if (elVat) elVat.textContent = formatNgn(vat);
  if (elTotal) elTotal.textContent = formatNgn(total);

  syncCartCountFromItems(items);
}

function wireCartPage() {
  const container = document.querySelector("[data-cart-items]");
  if (!container) return;

  const updateQty = (id, delta) => {
    const items = readCartItems();
    const it = items.find((x) => x.id === id);
    if (!it) return;
    const next = Math.min(PRODUCT_QTY_MAX, Math.max(PRODUCT_QTY_MIN, (Number(it.qty) || 0) + delta));
    it.qty = next;
    writeCartItems(items);
    renderCartPage();
  };

  const removeItem = (id) => {
    const items = readCartItems().filter((x) => x.id !== id);
    writeCartItems(items);
    renderCartPage();
  };

  container.addEventListener("click", (e) => {
    const target = e.target instanceof Element ? e.target : null;
    if (!target) return;
    const row = target.closest("[data-cart-id]");
    if (!row) return;
    const id = row.getAttribute("data-cart-id");
    if (!id) return;

    if (target.closest(".cart-row__remove")) {
      removeItem(id);
      return;
    }
    if (target.closest(".cart-qty__btn--minus")) {
      updateQty(id, -1);
      return;
    }
    if (target.closest(".cart-qty__btn--plus")) {
      updateQty(id, +1);
    }
  });
}

function renderCheckoutPage() {
  const container = document.querySelector("[data-checkout-order]");
  if (!container) return;

  const items = readCartItems();

  if (!items.length) {
    container.innerHTML = `
      <div class="order-empty">
        <div class="order-empty__title">Your cart is empty</div>
        <div class="order-empty__text">Add products before checking out.</div>
        <a class="btn btn-solid" href="./index.html#products">Shop products</a>
      </div>
    `;
  } else {
    container.innerHTML = items
      .map((it) => {
        const line = (Number(it.price) || 0) * (Number(it.qty) || 0);
        const img = (() => {
          const srcs = modernImageSources(it.image);
          if (!srcs) {
            return `<img class="order-item__img" src="${it.image}" alt="${it.name}" width="44" height="44" loading="lazy" decoding="async" />`;
          }
          return `
            <picture>
              <source srcset="${srcs.avif}" type="image/avif" />
              <source srcset="${srcs.webp}" type="image/webp" />
              <img class="order-item__img" src="${srcs.fallback}" alt="${it.name}" width="44" height="44" loading="lazy" decoding="async" />
            </picture>
          `.trim();
        })();
        return `
          <div class="order-item" data-cart-id="${it.id}">
            ${img}
            <div class="order-item__body">
              <div class="order-item__top">
                <div class="order-item__name">${it.name}</div>
                <button class="order-item__remove" type="button" aria-label="Remove item">×</button>
              </div>
              <div class="order-item__bottom">
                <div class="order-qty" role="group" aria-label="Quantity">
                  <button class="order-qty__btn order-qty__btn--minus" type="button" aria-label="Decrease quantity">–</button>
                  <span class="order-qty__value">${it.qty}</span>
                  <button class="order-qty__btn order-qty__btn--plus" type="button" aria-label="Increase quantity">+</button>
                </div>
                <div class="order-item__price">${formatNgn(line)} <span class="order-item__ex">(ex. VAT)</span></div>
              </div>
            </div>
          </div>
        `;
      })
      .join("");
  }

  const { subtotal, shipping, vat, total } = computeTotals(items);
  const elSubtotal = document.getElementById("checkoutSubtotal");
  const elShipping = document.getElementById("checkoutShipping");
  const elVat = document.getElementById("checkoutVat");
  const elTotal = document.getElementById("checkoutTotal");
  if (elSubtotal) elSubtotal.textContent = `${formatNgn(subtotal)} (ex. VAT)`;
  if (elShipping) elShipping.textContent = `${formatNgn(shipping)} (ex. VAT)`;
  if (elVat) elVat.textContent = formatNgn(vat);
  if (elTotal) elTotal.textContent = formatNgn(total);

  syncCartCountFromItems(items);
}

function wireCheckoutPage() {
  const container = document.querySelector("[data-checkout-order]");
  if (!container) return;

  const updateQty = (id, delta) => {
    const items = readCartItems();
    const it = items.find((x) => x.id === id);
    if (!it) return;
    const next = Math.min(PRODUCT_QTY_MAX, Math.max(PRODUCT_QTY_MIN, (Number(it.qty) || 0) + delta));
    it.qty = next;
    writeCartItems(items);
    renderCheckoutPage();
  };

  const removeItem = (id) => {
    const items = readCartItems().filter((x) => x.id !== id);
    writeCartItems(items);
    renderCheckoutPage();
  };

  container.addEventListener("click", (e) => {
    const target = e.target instanceof Element ? e.target : null;
    if (!target) return;
    const row = target.closest("[data-cart-id]");
    if (!row) return;
    const id = row.getAttribute("data-cart-id");
    if (!id) return;

    if (target.closest(".order-item__remove")) {
      removeItem(id);
      return;
    }
    if (target.closest(".order-qty__btn--minus")) {
      updateQty(id, -1);
      return;
    }
    if (target.closest(".order-qty__btn--plus")) {
      updateQty(id, +1);
    }
  });
}

function wirePlaceOrder() {
  const btn = document.getElementById("placeOrder");
  if (!(btn instanceof HTMLButtonElement)) return;

  btn.addEventListener("click", async () => {
    const form = document.getElementById("checkoutForm");
    const terms = document.getElementById("checkoutTerms");
    const error = document.getElementById("checkoutError");

    const selected = document.querySelector('input[name="pay"]:checked');
    const pay = selected instanceof HTMLInputElement ? selected.value : "card";
    if (pay !== "card") {
      if (error) {
        error.textContent = "Only debit/credit card payments via Paystack are supported right now.";
        error.hidden = false;
      }
      return;
    }

    if (form instanceof HTMLFormElement && !form.checkValidity()) {
      if (error) {
        error.textContent = "Please complete all required fields to place your order.";
        error.hidden = false;
      }
      form.reportValidity();
      return;
    }

    const accepted = terms instanceof HTMLInputElement ? terms.checked : false;
    if (!accepted) {
      if (error) {
        error.textContent = "Please accept the terms to place your order.";
        error.hidden = false;
      }
      if (terms) terms.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if (error) error.hidden = true;

    const items = readCartItems();
    if (!items.length) {
      if (error) {
        error.textContent = "Your cart is empty. Add products before checking out.";
        error.hidden = false;
      }
      return;
    }

    const billing = form instanceof HTMLFormElement ? Object.fromEntries(new FormData(form).entries()) : {};
    const email = String(billing.email || "").trim();
    if (!email) {
      if (error) {
        error.textContent = "Email address is required for payment.";
        error.hidden = false;
      }
      return;
    }

    const { total } = computeTotals(items);
    const callback_url = `${window.location.origin}/order-complete.html`;

    const original = btn.textContent || "Place order";
    btn.disabled = true;
    btn.textContent = "Redirecting to Paystack…";

    try {
      const resp = await fetch("/.netlify/functions/paystack-initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          amount: total,
          callback_url,
          metadata: {
            billing,
            items,
            totals: computeTotals(items),
            source: "snuz.ng",
          },
        }),
      });

      const data = await resp.json();
      if (!resp.ok || !data || !data.authorization_url) throw new Error(data?.error || "Payment initialization failed");
      window.location.href = data.authorization_url;
    } catch (e) {
      if (error) {
        error.textContent = "Payment could not be started. Please try again.";
        error.hidden = false;
      }
      btn.disabled = false;
      btn.textContent = original;
      console.error(e);
    }
  });
}

function wireCheckoutValidation() {
  const btn = document.getElementById("placeOrder");
  const form = document.getElementById("checkoutForm");
  const terms = document.getElementById("checkoutTerms");
  const error = document.getElementById("checkoutError");
  const cardFields = document.getElementById("cardFields");

  if (!(btn instanceof HTMLButtonElement)) return;

  const selectedPay = () => {
    const selected = document.querySelector('input[name="pay"]:checked');
    return selected instanceof HTMLInputElement ? selected.value : "card";
  };

  const sync = () => {
    const pay = selectedPay();
    const needsCard = pay === "card";

    if (cardFields) cardFields.hidden = !needsCard;

    const formOk = form instanceof HTMLFormElement ? form.checkValidity() : true;
    const termsOk = terms instanceof HTMLInputElement ? terms.checked : false;

    // Only allow placing order when card payment is selected.
    btn.disabled = !(formOk && termsOk && needsCard);
    if (error) error.hidden = true;
  };

  // Initial + continuous sync
  sync();
  document.addEventListener("input", sync);
  document.addEventListener("change", sync);
}

async function wireOrderCompleteVerify() {
  const title = document.getElementById("orderTitle");
  const msg = document.getElementById("orderMessage");
  const refEl = document.getElementById("orderRef");
  if (!title || !msg) return;

  const path = String(window.location.pathname || "");
  if (!path.endsWith("/order-complete.html") && !path.endsWith("order-complete.html")) return;

  const params = new URLSearchParams(window.location.search || "");
  const reference = params.get("reference") || params.get("trxref") || "";
  if (!reference) {
    title.textContent = "Order complete";
    msg.textContent = "Thanks — your order has been placed.";
    return;
  }

  try {
    title.textContent = "Processing payment…";
    msg.textContent = "Verifying your Paystack payment. Please keep this page open.";
    if (refEl) {
      refEl.style.display = "";
      refEl.textContent = `Reference: ${reference}`;
    }

    const resp = await fetch(`/.netlify/functions/paystack-verify?reference=${encodeURIComponent(reference)}`);
    const data = await resp.json().catch(() => null);

    const ok = resp.ok && data && data.status === true && data.data && data.data.status === "success";
    if (!ok) throw new Error("Verification failed");

    // Payment verified: clear cart
    writeCartItems([]);
    syncCartCountFromItems([]);

    title.textContent = "Order complete";
    msg.textContent = "Payment confirmed. We’ve emailed your order details and will contact you shortly.";
  } catch (e) {
    title.textContent = "Payment not confirmed";
    msg.textContent = "We couldn’t verify your payment yet. If you were charged, please contact support with your reference.";
    console.error(e);
  }
}

function renderProductCard({ name, image }) {
  const safeName = String(name || "Product");
  const safeImage = String(image || "");
  const strength = strengthForProductName(safeName);
  const srcs = modernImageSources(safeImage);
  const img = srcs
    ? `
        <picture>
          <source srcset="${srcs.avif}" type="image/avif" />
          <source srcset="${srcs.webp}" type="image/webp" />
          <img class="product__img" src="${srcs.fallback}" alt="${safeName} nicotine pouch" width="220" height="220" loading="lazy" decoding="async" />
        </picture>
      `.trim()
    : `<img class="product__img" src="${safeImage}" alt="${safeName} nicotine pouch" width="220" height="220" loading="lazy" decoding="async" />`;
  return `
    <article class="card product">
      ${img}
      <h3 class="product__name">${safeName}</h3>
      <div class="product__meta">
        <span class="product__price">₦9,500</span>
        <span class="product__strength"${strength ? "" : " hidden"}>${strength}</span>
      </div>
      <button class="btn btn-small btn-solid product__btn" type="button">Add to cart</button>
    </article>
  `;
}

function wireBrandPage() {
  const grid = document.querySelector("[data-brand-page]");
  if (!grid) return;

  // If the page already includes server-rendered cards, don't overwrite.
  if (String(grid.innerHTML || "").trim().length > 0) return;

  const brand = grid.getAttribute("data-brand-page");
  if (!brand) return;

  const products = PRODUCT_CATALOG[brand] || [];
  grid.innerHTML = products.map(renderProductCard).join("");
  applyStrengthLabels(grid);
}

function wireBrandDropdown() {
  const links = Array.from(document.querySelectorAll("[data-brand]"));
  if (!links.length) return;

  for (const link of links) {
    if (!(link instanceof HTMLAnchorElement)) continue;
    link.addEventListener("click", (e) => {
      // Let users open in new tab/window normally.
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      const brand = link.getAttribute("data-brand");
      if (!brand) return;
      e.preventDefault();

      const products = document.getElementById("products");
      if (products) {
        products.scrollIntoView({ behavior: "smooth", block: "start" });
      } else {
        window.location.hash = "#products";
      }

      const tab = document.querySelector(`.tabs .tab[data-tab="${brand}"]`);
      if (tab && tab instanceof HTMLElement) {
        // Delay slightly so the scroll feels natural before filter changes.
        setTimeout(() => tab.click(), 50);
      }
    });
  }
}

function wireAccountModal() {
  document.addEventListener("click", (e) => {
    const target = e.target instanceof Element ? e.target : null;
    const accountLink = target?.closest?.('a.header-actions__item[href="#account"]');
    if (!accountLink) return;
    e.preventDefault();
    openAccountModal();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    const overlay = document.getElementById("accountOverlay");
    if (overlay && !overlay.hidden) closeAccountModal();
  });
}

document.addEventListener("DOMContentLoaded", () => {
  wireAgeGate();
  if (!isRememberedVerified() && !isSessionVerified() && !isCookieVerified() && !isWindowNameVerified()) {
    showAgeGate();
  }

  ensureQuantityControls();
  applyStrengthLabels();
  wireCart();
  wireAccountModal();
  renderCartPage();
  wireCartPage();
  renderCheckoutPage();
  wireCheckoutPage();
  wirePlaceOrder();
  wireCheckoutValidation();
  wireOrderCompleteVerify();
  wireBackToTop();
  wireTabs();
  wireBrandDropdown();
  wireBrandPage();
  wireFaq();
  wireFooterYear();
});


