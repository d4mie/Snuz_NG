const STORAGE_KEY = "snuz.ng:age_verified_v1";
const SESSION_KEY = "snuz.ng:age_verified_session_v1";
const COOKIE_KEY = "snuz_age_verified";
const WINDOW_NAME_TOKEN = "snuz_age_verified:true";

function getEls() {
  return {
    overlay: document.getElementById("ageGateOverlay"),
    modal: document.querySelector(".agegate-modal"),
    yes: document.getElementById("ageGateYes"),
    no: document.getElementById("ageGateNo"),
    remember: document.getElementById("ageGateRemember"),
    backToTop: document.getElementById("backToTop"),
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

function writeCookie(name, value, { maxAgeSeconds } = {}) {
  // Lax by default to avoid cross-site issues; secure only when https.
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
    // If user isn't on the homepage, route them there after verification.
    const path = window.location.pathname || "";
    const onHome = path.endsWith("/") || path.endsWith("/index.html") || path === "index.html";
    if (onHome) {
      hideAgeGate();
    } else {
      window.location.href = "./index.html";
    }
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
  const products = grid ? Array.from(grid.querySelectorAll(".product")) : [];
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
    if (!q || !a) continue;

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

document.addEventListener("DOMContentLoaded", () => {
  wireAgeGate();
  if (!isRememberedVerified() && !isSessionVerified() && !isCookieVerified() && !isWindowNameVerified()) {
    showAgeGate();
  }

  wireBackToTop();
  wireTabs();
  wireFaq();
  wireFooterYear();
});


