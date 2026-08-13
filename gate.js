(() => {
  const PASSWORD = "SMOKELESS";
  const KEY_OK = "snuz_site_ok";
  const KEY_PASS = "snuz_gate_password";
  const KEY_UNDER = "snuz_gate_underage";
  const VIDEO_SRC = "./VIDEO-2026-02-25-19-18-47.mp4";

  const storeGet = (key) => {
    try {
      return sessionStorage.getItem(key);
    } catch (e) {
      return null;
    }
  };

  const storeSet = (key, value) => {
    try {
      sessionStorage.setItem(key, value);
    } catch (e) {
      // ignore
    }
  };

  const isOpen = () => storeGet(KEY_OK) === "1";

  const lockPage = () => {
    document.documentElement.classList.add("site-locked");
  };

  const pausePageVideos = () => {
    document.querySelectorAll("video").forEach((video) => {
      if (video.closest(".site-gate")) return;
      video.pause();
    });
  };

  const resumePageVideos = () => {
    document.querySelectorAll("video[data-bg-video]").forEach((video) => {
      const start = video.play();
      if (start && typeof start.catch === "function") start.catch(() => {});
    });
  };

  const unlockPage = () => {
    document.documentElement.classList.remove("site-locked");
    const gate = document.querySelector(".site-gate");
    if (gate) gate.remove();
    resumePageVideos();
  };

  if (isOpen()) {
    document.documentElement.classList.remove("site-locked");
    return;
  }

  lockPage();

  const mount = () => {
    if (document.querySelector(".site-gate")) return;

    const root = document.createElement("div");
    root.className = "site-gate";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-labelledby", "site-gate-title");
    root.innerHTML = `
      <div class="site-gate__media" aria-hidden="true">
        <video
          class="site-gate__video"
          src="${VIDEO_SRC}"
          muted
          playsinline
          webkit-playsinline
          loop
          autoplay
          preload="auto"
        ></video>
        <div class="site-gate__overlay"></div>
      </div>

      <div class="site-gate__frame">
        <div class="site-gate__brand">
          <picture class="brand__mark" aria-hidden="true">
            <source srcset="./assets/snuz-logo.avif" type="image/avif" />
            <source srcset="./assets/snuz-logo.webp" type="image/webp" />
            <img class="brand__logo" src="./assets/snuz-logo.jpg" alt="" width="40" height="40" />
          </picture>
          <span>snuz.ng</span>
        </div>

        <section class="site-gate__panel" data-gate-panel="password">
          <p class="site-gate__kicker">Private access</p>
          <h1 class="site-gate__title" id="site-gate-title">Enter to continue</h1>
          <p class="site-gate__lede">
            This site is locked. Type the access password to go in.
          </p>
          <form class="site-gate__form" data-gate-form>
            <label class="site-gate__field">
              <span>Password</span>
              <input
                type="password"
                name="password"
                autocomplete="current-password"
                required
                data-gate-input
              />
            </label>
            <button class="btn btn--primary btn--arrow btn--block" type="submit">Unlock</button>
            <p class="site-gate__status" data-gate-status role="status" hidden></p>
          </form>
          <p class="site-gate__note">For adults 18+ only.</p>
        </section>

        <section class="site-gate__popup" data-gate-panel="age" hidden>
          <div class="site-gate__card" role="document">
            <p class="site-gate__badge" aria-hidden="true">18+</p>
            <p class="site-gate__kicker">Caution</p>
            <h2 class="site-gate__title site-gate__title--card" id="site-gate-age-title">Adults only</h2>
            <p class="site-gate__lede">
              snuz.ng sells nicotine products. You must be 18 or older to enter.
              Nicotine is addictive and is not for children.
            </p>
            <div class="site-gate__actions">
              <button class="btn btn--primary btn--arrow" type="button" data-gate-age-yes>
                I am 18 or over
              </button>
              <button class="btn btn--ghost site-gate__ghost" type="button" data-gate-age-no>
                I am under 18
              </button>
            </div>
          </div>
        </section>

        <section class="site-gate__popup" data-gate-panel="blocked" hidden>
          <div class="site-gate__card" role="document">
            <p class="site-gate__kicker">Access declined</p>
            <h2 class="site-gate__title site-gate__title--card">You must be 18 or older</h2>
            <p class="site-gate__lede">
              snuz.ng is only for adults. Please leave this site if you are under 18.
            </p>
          </div>
        </section>
      </div>
    `;

    document.body.appendChild(root);
    pausePageVideos();

    const passwordPanel = root.querySelector('[data-gate-panel="password"]');
    const agePanel = root.querySelector('[data-gate-panel="age"]');
    const blockedPanel = root.querySelector('[data-gate-panel="blocked"]');
    const form = root.querySelector("[data-gate-form]");
    const input = root.querySelector("[data-gate-input]");
    const status = root.querySelector("[data-gate-status]");
    const video = root.querySelector(".site-gate__video");

    const showPanel = (name) => {
      passwordPanel.hidden = name !== "password";
      agePanel.hidden = name !== "age";
      blockedPanel.hidden = name !== "blocked";
      root.classList.toggle("is-popup", name !== "password");

      if (name === "age") {
        root.setAttribute("aria-labelledby", "site-gate-age-title");
        root.querySelector("[data-gate-age-yes]")?.focus();
      } else if (name === "blocked") {
        root.setAttribute("aria-labelledby", "site-gate-age-title");
      } else {
        root.setAttribute("aria-labelledby", "site-gate-title");
        input?.focus();
      }
    };

    const showStatus = (message) => {
      if (!status) return;
      status.hidden = !message;
      status.textContent = message || "";
    };

    const openSite = () => {
      storeSet(KEY_OK, "1");
      unlockPage();
    };

    form?.addEventListener("submit", (event) => {
      event.preventDefault();
      const typed = String(input?.value || "").trim();
      if (typed !== PASSWORD) {
        showStatus("That password is not correct.");
        input?.select();
        return;
      }
      storeSet(KEY_PASS, "1");
      showStatus("");
      showPanel("age");
    });

    root.querySelector("[data-gate-age-yes]")?.addEventListener("click", openSite);

    root.querySelector("[data-gate-age-no]")?.addEventListener("click", () => {
      storeSet(KEY_UNDER, "1");
      showPanel("blocked");
    });

    if (video) {
      const play = () => {
        const start = video.play();
        if (start && typeof start.catch === "function") start.catch(() => {});
      };
      video.addEventListener("canplay", play, { once: true });
      play();
    }

    if (storeGet(KEY_UNDER) === "1") {
      showPanel("blocked");
    } else if (storeGet(KEY_PASS) === "1") {
      showPanel("age");
    } else {
      showPanel("password");
    }
  };

  if (document.body) mount();
  else document.addEventListener("DOMContentLoaded", mount);
})();
