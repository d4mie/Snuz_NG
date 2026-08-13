(() => {
  const STORAGE_KEY = "snuz_cart_v1";
  const shop = () => window.SNUZ_SHOP || {};

  const formatNaira = (value) => {
    const amount = Number(value);
    if (Number.isNaN(amount)) return String(value);
    return `₦${amount.toLocaleString("en-NG", { minimumFractionDigits: 0 })}`;
  };

  const slugify = (text) =>
    String(text || "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

  const readCart = () => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  let items = readCart();
  let isOpen = false;
  const listeners = new Set();

  const persist = () => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // ignore
    }
  };

  const notify = () => {
    listeners.forEach((fn) => {
      try {
        fn(getState());
      } catch {
        // ignore
      }
    });
  };

  const getState = () => {
    const totalCount = items.reduce((sum, item) => sum + item.quantity, 0);
    const subtotal = items.reduce(
      (sum, item) => sum + Number(item.priceNaira || 0) * item.quantity,
      0
    );
    return { items: items.slice(), totalCount, subtotal, isOpen };
  };

  const setItems = (next) => {
    items = next.filter((item) => item.quantity > 0);
    persist();
    notify();
  };

  const addItem = (product, quantity = 1) => {
    const qty = Math.max(1, Number(quantity) || 1);
    const existing = items.find((item) => item.slug === product.slug);
    if (existing) {
      setItems(
        items.map((item) =>
          item.slug === product.slug
            ? { ...item, quantity: item.quantity + qty }
            : item
        )
      );
    } else {
      setItems([...items, { ...product, quantity: qty }]);
    }
    openCart();
  };

  const updateQuantity = (slug, delta) => {
    setItems(
      items.map((item) =>
        item.slug === slug
          ? { ...item, quantity: Math.max(0, item.quantity + delta) }
          : item
      )
    );
  };

  const setQuantity = (slug, quantity) => {
    const qty = Math.max(0, Number(quantity) || 0);
    setItems(
      items.map((item) =>
        item.slug === slug ? { ...item, quantity: qty } : item
      )
    );
  };

  const clearCart = () => setItems([]);

  const openCart = () => {
    isOpen = true;
    notify();
  };

  const closeCart = () => {
    isOpen = false;
    notify();
  };

  const subscribe = (fn) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
  };

  const productFromCard = (card) => {
    const nameEl = card.querySelector(".product__name");
    const priceEl = card.querySelector(".product__price");
    const imgEl = card.querySelector(".product__img");
    const title = (nameEl?.textContent || "").trim();
    const priceNaira = Number(priceEl?.getAttribute("data-money") || 0);
    const image = imgEl?.getAttribute("src") || "";
    const badge = (card.querySelector(".product__badge")?.textContent || "").trim();
    const slug =
      (card.getAttribute("data-category") || "").trim() ||
      slugify(title) ||
      slugify(badge) ||
      `product-${Date.now()}`;
    return {
      slug,
      title,
      brand: badge,
      priceNaira,
      price: formatNaira(priceNaira),
      image,
    };
  };

  const ensureDrawer = () => {
    if (document.querySelector("[data-cart-drawer]")) return;
    const root = document.createElement("div");
    root.setAttribute("data-cart-drawer", "");
    root.hidden = true;
    root.innerHTML = `
      <div class="cart-drawer" role="dialog" aria-modal="true" aria-label="Shopping cart">
        <button class="cart-drawer__backdrop" type="button" data-cart-close aria-label="Close cart"></button>
        <aside class="cart-drawer__panel">
          <div class="cart-drawer__head">
            <a class="cart-drawer__full" href="./cart.html">View full cart</a>
            <button class="cart-drawer__close" type="button" data-cart-close aria-label="Close cart">×</button>
          </div>
          <div class="cart-drawer__body" data-cart-drawer-body></div>
          <div class="cart-drawer__foot">
            <div class="cart-drawer__subtotal">
              <span>Subtotal</span>
              <strong data-cart-drawer-subtotal>₦0</strong>
            </div>
            <a class="btn btn--primary btn--block" href="./checkout.html" data-cart-checkout>Checkout</a>
          </div>
        </aside>
      </div>
    `;
    document.body.appendChild(root);

    root.addEventListener("click", (e) => {
      if (e.target.closest("[data-cart-close]")) {
        closeCart();
        return;
      }
      const minus = e.target.closest("[data-cart-minus]");
      if (minus) {
        updateQuantity(minus.getAttribute("data-cart-minus"), -1);
        return;
      }
      const plus = e.target.closest("[data-cart-plus]");
      if (plus) {
        updateQuantity(plus.getAttribute("data-cart-plus"), 1);
        return;
      }
      const remove = e.target.closest("[data-cart-remove]");
      if (remove) {
        setQuantity(remove.getAttribute("data-cart-remove"), 0);
      }
    });
  };

  const ensureNavCart = () => {
    const mountPoints = document.querySelectorAll(".nav__cta");
    mountPoints.forEach((cta) => {
      if (cta.querySelector("[data-cart-open]")) return;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "cart-nav-btn";
      btn.setAttribute("data-cart-open", "");
      btn.setAttribute("aria-label", "Open cart");
      btn.innerHTML = `
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" width="20" height="20">
          <path fill="currentColor" d="M7 18c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2Zm10 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2ZM7.2 6l.4 2h11.5c.9 0 1.6.8 1.4 1.6l-1.3 5.2A1.7 1.7 0 0 1 16.6 16H8.4a1.7 1.7 0 0 1-1.6-1.2L4.2 4H2V2h3.1c.8 0 1.4.5 1.6 1.2L7.2 6Z"/>
        </svg>
        <span class="cart-nav-btn__count" data-cart-count hidden>0</span>
      `;
      cta.prepend(btn);
    });

    const mobileMeta = document.querySelector(".mobile-menu__meta");
    if (mobileMeta && !mobileMeta.querySelector("[data-cart-open]")) {
      const link = document.createElement("a");
      link.href = "./cart.html";
      link.className = "btn btn--ghost btn--block";
      link.innerHTML = `Cart <span data-cart-count-mobile></span>`;
      mobileMeta.prepend(link);
    }

    document.addEventListener("click", (e) => {
      if (e.target.closest("[data-cart-open]")) {
        e.preventDefault();
        openCart();
      }
    });
  };

  const renderDrawer = (state) => {
    const root = document.querySelector("[data-cart-drawer]");
    if (!root) return;
    root.hidden = !state.isOpen;
    document.body.classList.toggle("cart-open", state.isOpen);

    const body = root.querySelector("[data-cart-drawer-body]");
    const subtotalEl = root.querySelector("[data-cart-drawer-subtotal]");
    const checkoutBtn = root.querySelector("[data-cart-checkout]");
    if (subtotalEl) subtotalEl.textContent = formatNaira(state.subtotal);

    if (checkoutBtn) {
      const empty = state.items.length === 0;
      checkoutBtn.classList.toggle("is-disabled", empty);
      if (empty) checkoutBtn.setAttribute("aria-disabled", "true");
      else checkoutBtn.removeAttribute("aria-disabled");
      checkoutBtn.onclick = (e) => {
        if (window.SnuzCart.getState().items.length === 0) e.preventDefault();
        else closeCart();
      };
    }

    if (!body) return;
    if (!state.items.length) {
      body.innerHTML = `
        <div class="cart-empty">
          <p>Your cart is empty.</p>
          <a class="link" href="./index.html#products">Return to shop</a>
        </div>
      `;
      return;
    }

    body.innerHTML = state.items
      .map(
        (item) => `
      <article class="cart-line">
        <img class="cart-line__img" src="${item.image}" alt="${item.title}" width="96" height="96" loading="lazy" />
        <div class="cart-line__meta">
          <div class="cart-line__top">
            <div>
              <p class="cart-line__title">${item.title}</p>
              <p class="cart-line__price">${item.price}</p>
            </div>
            <button class="cart-line__remove" type="button" data-cart-remove="${item.slug}">Remove</button>
          </div>
          <div class="cart-qty" role="group" aria-label="Quantity">
            <button type="button" data-cart-minus="${item.slug}" aria-label="Decrease quantity">–</button>
            <span>${item.quantity}</span>
            <button type="button" class="is-plus" data-cart-plus="${item.slug}" aria-label="Increase quantity">+</button>
          </div>
        </div>
      </article>
    `
      )
      .join("");
  };

  const renderCounts = (state) => {
    document.querySelectorAll("[data-cart-count]").forEach((el) => {
      el.textContent = String(state.totalCount);
      el.hidden = state.totalCount < 1;
    });
    document.querySelectorAll("[data-cart-count-mobile]").forEach((el) => {
      el.textContent = state.totalCount ? `(${state.totalCount})` : "";
    });
  };

  const renderCartPage = (state) => {
    const page = document.querySelector("[data-cart-page]");
    if (!page) return;

    const list = page.querySelector("[data-cart-page-list]");
    const empty = page.querySelector("[data-cart-page-empty]");
    const summary = page.querySelector("[data-cart-page-summary]");
    const subtotalEl = page.querySelector("[data-cart-page-subtotal]");

    if (!state.items.length) {
      if (empty) empty.hidden = false;
      if (list) list.hidden = true;
      if (summary) summary.hidden = true;
      return;
    }

    if (empty) empty.hidden = true;
    if (list) list.hidden = false;
    if (summary) summary.hidden = false;
    if (subtotalEl) subtotalEl.textContent = formatNaira(state.subtotal);

    if (!list) return;
    list.innerHTML = state.items
      .map(
        (item) => `
      <article class="cart-line cart-line--page">
        <img class="cart-line__img" src="${item.image}" alt="${item.title}" width="112" height="112" loading="lazy" />
        <div class="cart-line__meta">
          <div class="cart-line__top">
            <div>
              <p class="cart-line__title">${item.title}</p>
              <p class="cart-line__price">${item.price}</p>
            </div>
            <button class="cart-line__remove" type="button" data-cart-remove="${item.slug}">Remove</button>
          </div>
          <div class="cart-line__bottom">
            <div class="cart-qty" role="group" aria-label="Quantity">
              <button type="button" data-cart-minus="${item.slug}" aria-label="Decrease quantity">–</button>
              <span>${item.quantity}</span>
              <button type="button" class="is-plus" data-cart-plus="${item.slug}" aria-label="Increase quantity">+</button>
            </div>
            <strong>${formatNaira(item.priceNaira * item.quantity)}</strong>
          </div>
        </div>
      </article>
    `
      )
      .join("");
  };

  const isSoldOutCard = (card) =>
    card.classList.contains("is-sold-out") || card.getAttribute("data-sold-out") === "true";

  const wireProducts = () => {
    document.querySelectorAll(".product").forEach((card) => {
      const btn = card.querySelector(".product__btn");
      if (!btn) return;
      if (isSoldOutCard(card)) {
        btn.disabled = true;
        btn.setAttribute("aria-disabled", "true");
        btn.dataset.cartBound = "";
        return;
      }
      if (btn.dataset.cartBound === "1") return;
      btn.disabled = false;
      btn.removeAttribute("aria-disabled");
      btn.dataset.cartBound = "1";
      btn.addEventListener("click", () => {
        if (isSoldOutCard(card)) return;
        const product = productFromCard(card);
        if (!product.title || !product.priceNaira) return;
        addItem(product, 1);
      });
    });
  };

  const rewireProducts = () => {
    document.querySelectorAll(".product .product__btn").forEach((btn) => {
      btn.dataset.cartBound = "";
    });
    wireProducts();
  };

  const wireCartPage = () => {
    const page = document.querySelector("[data-cart-page]");
    if (!page || page.dataset.bound === "1") return;
    page.dataset.bound = "1";
    page.addEventListener("click", (e) => {
      const minus = e.target.closest("[data-cart-minus]");
      if (minus) {
        updateQuantity(minus.getAttribute("data-cart-minus"), -1);
        return;
      }
      const plus = e.target.closest("[data-cart-plus]");
      if (plus) {
        updateQuantity(plus.getAttribute("data-cart-plus"), 1);
        return;
      }
      const remove = e.target.closest("[data-cart-remove]");
      if (remove) {
        setQuantity(remove.getAttribute("data-cart-remove"), 0);
      }
    });
  };

  const onKeydown = (e) => {
    if (e.key === "Escape" && isOpen) closeCart();
  };

  window.SnuzCart = {
    getState,
    addItem,
    updateQuantity,
    setQuantity,
    clearCart,
    openCart,
    closeCart,
    subscribe,
    formatNaira,
    shop,
    rewireProducts,
  };

  const boot = () => {
    ensureDrawer();
    ensureNavCart();
    wireProducts();
    wireCartPage();
    document.addEventListener("keydown", onKeydown);

    subscribe((state) => {
      renderDrawer(state);
      renderCounts(state);
      renderCartPage(state);
    });
    notify();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
