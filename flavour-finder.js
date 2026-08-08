(() => {
  const root = document.querySelector("[data-flavour-finder]");
  if (!root) return;

  const ans = {};
  const FLAVOURS = {
    mint15: {
      name: "Mint",
      mg: 15,
      timing: "60 – 120 seconds",
      why: {
        work: "Clean and discreet in any setting — easy to keep low-key.",
        "social-out": "Crisp and refreshing between conversations.",
        travel: "A classic choice for long journeys — keeps you alert and fresh.",
        home: "Smooth and familiar for unwinding at the end of the day.",
      },
    },
    passion15: {
      name: "Passionfruit",
      mg: 15,
      timing: "60 – 120 seconds",
      why: {
        work: "Subtle tropical warmth that pairs well with quiet focus.",
        "social-out": "Vibrant and lively — a good conversation starter.",
        travel: "Sweet and aromatic — makes any journey feel lighter.",
        home: "A relaxing tropical escape without going anywhere.",
      },
    },
    mango15: {
      name: "Mango",
      mg: 15,
      timing: "60 – 120 seconds",
      why: {
        work: "Naturally sweet and smooth — easy on the senses during a long day.",
        "social-out": "Crowd favourite. Approachable, fun, and tropical.",
        travel: "Bright and uplifting for long commutes.",
        home: "Sweet, easy, and satisfying — a popular first pick.",
      },
    },
    coolmint30: {
      name: "Cool Mint",
      mg: 30,
      timing: "30 – 60 seconds",
      why: {
        work: "Fast-acting and focusing — feel it quickly, then settle in.",
        "social-out": "Powerful freshness that cuts through any environment.",
        travel: "Hits fast and lasts — useful when you need it sooner.",
        home: "Intense cool that clears the head after a long day.",
      },
    },
    applegum30: {
      name: "Applegum",
      mg: 30,
      timing: "30 – 60 seconds",
      why: {
        work: "A unique sweet-fresh profile that stays interesting without distraction.",
        "social-out": "Unexpected and memorable.",
        travel: "Fun and different wherever you are.",
        home: "Something new to discover at your own pace.",
      },
    },
  };

  const quizArea = root.querySelector("[data-ff-quiz]");
  const resultArea = root.querySelector("[data-ff-result]");
  const quizHeader = root.querySelector("[data-ff-header]");
  const progFill = root.querySelector("[data-ff-progress]");
  const stepLabel = root.querySelector("[data-ff-step]");
  const pctLabel = root.querySelector("[data-ff-pct]");
  const resTitle = root.querySelector("[data-ff-res-title]");
  const resSub = root.querySelector("[data-ff-res-sub]");
  const tipText = root.querySelector("[data-ff-tip]");
  const recCards = root.querySelector("[data-ff-recs]");

  const resolve = () => {
    const q1 = ans.q1 || "curious";
    const q2 = ans.q2 || "mint";
    const q3 = ans.q3 || "smooth";
    const q4 = ans.q4 || "home";
    const q5 = ans.q5 || "low";
    const isHigh = q5 === "high" || q1 === "smoker";
    const bold = q3 === "bold";
    const mg = isHigh || bold ? 30 : 15;

    let primaryKey;
    let secondaryKey;
    if (q2 === "mint") {
      primaryKey = mg === 30 ? "coolmint30" : "mint15";
      secondaryKey = mg === 30 ? "mint15" : "coolmint30";
    } else {
      primaryKey = mg === 30 ? "applegum30" : "mango15";
      secondaryKey = mg === 30 ? "mango15" : "passion15";
    }

    const primary = FLAVOURS[primaryKey];
    const secondary = FLAVOURS[secondaryKey];
    const title =
      mg === 30 ? "You're ready for the strong range" : "The 15mg range is your starting point";
    const sub =
      mg === 30
        ? "Based on your answers, 30mg is the better strength. You'll usually feel it in 30 – 60 seconds."
        : "Smooth, steady, and approachable. You'll usually feel the effect within 60 – 120 seconds.";
    const tip =
      mg === 30
        ? "Place one pouch under your upper lip. At 30mg you may feel nicotine within 30 – 60 seconds — a light tingle is normal. Keep it in for 20 – 30 minutes. Drink water. Start with one pouch and wait before considering a second."
        : "Place one pouch under your upper lip and leave it there. At 15mg the release is gradual — give it 60 – 120 seconds. Keep it in for up to 30 minutes. Use one pouch at a time, and drink water.";

    return { primary, secondary, q4, title, sub, tip };
  };

  const scrollToFinder = () => {
    root.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const showPanel = (n) => {
    root.querySelectorAll("[data-ff-panel]").forEach((p) => p.classList.remove("is-on"));
    const panel = root.querySelector(`[data-ff-panel="${n}"]`);
    if (panel) panel.classList.add("is-on");
    const pct = Math.round(((n - 1) / 5) * 100);
    if (progFill) progFill.style.width = `${pct}%`;
    if (stepLabel) stepLabel.textContent = `Question ${n} of 5`;
    if (pctLabel) pctLabel.textContent = `${pct}%`;
  };

  const showResult = () => {
    const { primary, secondary, q4, title, sub, tip } = resolve();
    if (progFill) progFill.style.width = "100%";
    if (stepLabel) stepLabel.textContent = "Complete";
    if (pctLabel) pctLabel.textContent = "100%";
    if (resTitle) resTitle.textContent = title;
    if (resSub) resSub.textContent = sub;
    if (tipText) tipText.textContent = tip;

    if (recCards) {
      recCards.innerHTML = "";
      [
        [primary, "Top pick", true],
        [secondary, "Also try", false],
      ].forEach(([f, badge, isPrimary]) => {
        const why = f.why[q4] || f.why.home;
        const card = document.createElement("div");
        card.className = `ff-rec${isPrimary ? " is-primary" : ""}`;
        card.innerHTML =
          `<span class="ff-badge${isPrimary ? " is-primary" : ""}">${badge}</span>` +
          `<div class="ff-rec__name">${f.name}</div>` +
          `<div class="ff-rec__strength">${f.mg}mg · feel in ${f.timing}</div>` +
          `<div class="ff-rec__why">${why}</div>`;
        recCards.appendChild(card);
      });
    }

    if (quizHeader) quizHeader.hidden = true;
    if (quizArea) quizArea.hidden = true;
    if (resultArea) resultArea.hidden = false;
    scrollToFinder();
  };

  const restart = () => {
    Object.keys(ans).forEach((k) => delete ans[k]);
    root.querySelectorAll(".ff-opt").forEach((o) => o.classList.remove("is-selected"));
    root.querySelectorAll("[data-ff-next]").forEach((b) => {
      b.disabled = true;
    });
    if (resultArea) resultArea.hidden = true;
    if (quizHeader) quizHeader.hidden = false;
    if (quizArea) quizArea.hidden = false;
    showPanel(1);
    scrollToFinder();
  };

  root.addEventListener("click", (e) => {
    const opt = e.target.closest("[data-ff-pick]");
    if (opt && root.contains(opt)) {
      const qid = opt.getAttribute("data-ff-q");
      const val = opt.getAttribute("data-ff-pick");
      if (!qid || !val) return;
      root.querySelectorAll(`[data-ff-q="${qid}"]`).forEach((o) => o.classList.remove("is-selected"));
      opt.classList.add("is-selected");
      ans[qid] = val;
      const next = root.querySelector(`[data-ff-next="${qid.replace("q", "")}"]`);
      if (next) next.disabled = false;
      return;
    }

    const finishBtn = e.target.closest("[data-ff-finish]");
    if (finishBtn && root.contains(finishBtn) && !finishBtn.disabled) {
      showResult();
      return;
    }

    const gotoBtn = e.target.closest("[data-ff-goto]");
    if (gotoBtn && root.contains(gotoBtn) && !gotoBtn.disabled) {
      const n = Number(gotoBtn.getAttribute("data-ff-goto") || "1");
      showPanel(n);
      return;
    }

    if (e.target.closest("[data-ff-restart]")) {
      restart();
    }
  });
})();
