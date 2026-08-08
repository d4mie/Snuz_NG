(() => {
  const prefersReduced =
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const menuBtn = document.querySelector("[data-menu-btn]");
  const mobileMenu = document.querySelector("[data-mobile-menu]");
  const header = document.querySelector("[data-header]");

  const setHeaderHeightVar = () => {
    if (!header) return;
    const total = header.getBoundingClientRect().height;
    const mobileHeight =
      mobileMenu && !mobileMenu.hidden ? mobileMenu.getBoundingClientRect().height : 0;
    const h = Math.max(0, Math.round(total - mobileHeight));
    document.documentElement.style.setProperty("--header-h", `${h}px`);
  };

  const setHeaderSolid = () => {
    if (!header) return;
    const nextSolid = window.scrollY > 8;
    const nextCompact = window.scrollY > 32;

    const prevSolid = header.classList.contains("is-solid");
    const prevCompact = header.classList.contains("is-compact");

    header.classList.toggle("is-solid", nextSolid);
    header.classList.toggle("is-compact", nextCompact);

    if (nextSolid !== prevSolid || nextCompact !== prevCompact) {
      setHeaderHeightVar();
      window.setTimeout(setHeaderHeightVar, 260);
    }
  };

  setHeaderHeightVar();
  setHeaderSolid();

  let resizeRaf = 0;
  window.addEventListener("resize", () => {
    window.cancelAnimationFrame(resizeRaf);
    resizeRaf = window.requestAnimationFrame(setHeaderHeightVar);
  });
  window.addEventListener("scroll", setHeaderSolid, { passive: true });

  const setMenuOpen = (open) => {
    if (!menuBtn || !mobileMenu) return;
    menuBtn.setAttribute("aria-expanded", open ? "true" : "false");
    if (open) {
      mobileMenu.hidden = false;
      header?.classList.add("is-menu-open");
    } else {
      mobileMenu.hidden = true;
      header?.classList.remove("is-menu-open");
    }
    setHeaderHeightVar();
  };

  menuBtn?.addEventListener("click", () => {
    const open = menuBtn.getAttribute("aria-expanded") !== "true";
    setMenuOpen(open);
  });

  mobileMenu?.addEventListener("click", (e) => {
    const a = e.target.closest("a");
    if (!a) return;
    setMenuOpen(false);
  });

  // Low-carbon playback for non-hero background clips: skip on Save-Data / slow
  // networks. The homepage hero loop is continuous and should still try on mobile.
  const connection =
    navigator.connection || navigator.mozConnection || navigator.webkitConnection || null;
  const saveData = !!connection?.saveData;
  const effectiveType = connection?.effectiveType || "";
  const slowNetwork = effectiveType === "slow-2g" || effectiveType === "2g";
  const allowBgVideo = !prefersReduced && !saveData && !slowNetwork;
  const allowContinuousVideo = !prefersReduced;

  const bgVideos = Array.from(document.querySelectorAll("video[data-bg-video]"));
  const isContinuousVideo = (video) => video.hasAttribute("data-bg-video-continuous");
  const continuousVideos = bgVideos.filter(isContinuousVideo);
  const viewportBgVideos = bgVideos.filter((video) => !isContinuousVideo(video));

  const prepareVideo = (video) => {
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.setAttribute("muted", "");
    video.setAttribute("playsinline", "");
    video.setAttribute("webkit-playsinline", "");
  };

  const loadVideoSources = (video) => {
    let changed = false;
    video.querySelectorAll("source").forEach((s) => {
      const src = s.getAttribute("src");
      const dataSrc = s.getAttribute("data-src");
      if (src || !dataSrc) return;
      s.setAttribute("src", dataSrc);
      changed = true;
    });
    if (changed) {
      try {
        video.load();
      } catch {
        // ignore
      }
    }
  };

  const pauseVideo = (video) => {
    try {
      video.pause();
    } catch {
      // ignore
    }
  };

  const playVideo = async (video) => {
    prepareVideo(video);
    try {
      await video.play();
      return true;
    } catch {
      return false;
    }
  };

  const isInViewport = (el) => {
    const r = el.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight || 0;
    const vw = window.innerWidth || document.documentElement.clientWidth || 0;
    return r.bottom > 0 && r.right > 0 && r.top < vh && r.left < vw;
  };

  const playContinuousVideo = (video) => {
    if (!allowContinuousVideo || document.hidden) {
      pauseVideo(video);
      return;
    }
    prepareVideo(video);
    loadVideoSources(video);
    playVideo(video);
  };

  const updateBgVideos = () => {
    continuousVideos.forEach(playContinuousVideo);
    viewportBgVideos.forEach((video) => {
      if (!allowBgVideo || document.hidden) {
        pauseVideo(video);
        return;
      }
      if (!isInViewport(video)) {
        pauseVideo(video);
        return;
      }
      prepareVideo(video);
      loadVideoSources(video);
      playVideo(video);
    });
  };

  if (bgVideos.length) {
    document.documentElement.dataset.lowCarbon = allowBgVideo ? "0" : "1";

    continuousVideos.forEach((video) => {
      prepareVideo(video);
      video.loop = true;
      video.addEventListener("ended", () => {
        video.currentTime = 0;
        playVideo(video);
      });
      // iOS often needs a second attempt after the source is ready.
      video.addEventListener(
        "loadeddata",
        () => {
          playContinuousVideo(video);
        },
        { once: true },
      );
      playContinuousVideo(video);
    });

    // Phones sometimes block the first autoplay; retry on first interaction.
    const resumeContinuousOnGesture = () => {
      continuousVideos.forEach(playContinuousVideo);
      window.removeEventListener("touchstart", resumeContinuousOnGesture);
      window.removeEventListener("click", resumeContinuousOnGesture);
    };
    window.addEventListener("touchstart", resumeContinuousOnGesture, { passive: true, once: true });
    window.addEventListener("click", resumeContinuousOnGesture, { once: true });

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        bgVideos.forEach(pauseVideo);
        return;
      }
      continuousVideos.forEach(playContinuousVideo);
      updateBgVideos();
    });

    if (!allowBgVideo) {
      viewportBgVideos.forEach(pauseVideo);
    } else if (viewportBgVideos.length && "IntersectionObserver" in window) {
      const obs = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            const video = entry.target;
            if (!allowBgVideo || document.hidden) {
              pauseVideo(video);
              return;
            }
            if (entry.isIntersecting && entry.intersectionRatio >= 0.12) {
              prepareVideo(video);
              loadVideoSources(video);
              playVideo(video);
            } else {
              pauseVideo(video);
            }
          });
        },
        { threshold: [0, 0.12] },
      );
      viewportBgVideos.forEach((v) => obs.observe(v));
    } else if (viewportBgVideos.length) {
      updateBgVideos();
      window.addEventListener("scroll", updateBgVideos, { passive: true });
    }
  }

  document.querySelectorAll(".locations__video").forEach((video) => {
    video.loop = true;
    video.addEventListener("ended", () => {
      video.currentTime = 0;
      playVideo(video);
    });
    if (allowBgVideo && !document.hidden) playVideo(video);
  });

  document.querySelector("[data-to-top]")?.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: prefersReduced ? "auto" : "smooth" });
  });

  document.querySelector('form[role="search"]')?.addEventListener("submit", (e) => {
    e.preventDefault();
    const q = new FormData(e.currentTarget).get("q");
    if (typeof q === "string" && q.trim()) {
      alert(`Search is a demo. You searched for: ${q.trim()}`);
    }
  });

  const escapeHtml = (str) =>
    String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");

  const slugify = (str) =>
    String(str)
      .toLowerCase()
      .replaceAll(/&[a-z]+;/g, "")
      .replaceAll(/[^a-z0-9]+/g, "-")
      .replaceAll(/(^-|-$)/g, "");

  const rewriteHref = (href) => {
    if (typeof href !== "string") return "";

    const trimmed = href.trim();
    if (!trimmed) return "";

    const routeMap = new Map([
      ["https://www.haleon.com", "./index.html"],
      ["https://www.haleon.com/", "./index.html"],
      ["https://www.haleon.com/index", "./index.html"],
      ["https://www.haleon.com/who-we-are", "./who-we-are.html"],
      ["https://www.haleon.com/who-we-are/", "./who-we-are.html"],
      ["https://www.haleon.com/who-we-are/strategy", "./strategy.html"],
      ["https://www.haleon.com/our-brands", "./our-brands.html"],
      ["https://www.haleon.com/our-brands/", "./our-brands.html"],
      ["https://www.haleon.com/our-impact", "./our-impact.html"],
      ["https://www.haleon.com/our-impact/", "./our-impact.html"],
      ["https://www.haleon.com/investors", "./investors.html"],
      ["https://www.haleon.com/investors/", "./investors.html"],
      ["https://www.haleon.com/news", "./news.html"],
      ["https://www.haleon.com/news/", "./news.html"],
      ["https://www.haleon.com/careers", "./careers.html"],
      ["https://www.haleon.com/careers/", "./careers.html"],
      ["https://www.haleon.com/contact", "./contact.html"],
      ["https://www.haleon.com/contact/", "./contact.html"],
    ]);

    // Preserve hash fragments for in-page navigation.
    const [base, hash = ""] = trimmed.split("#");
    const mapped = routeMap.get(base);
    if (!mapped) return trimmed;
    return hash ? `${mapped}#${hash}` : mapped;
  };

  const parseInline = (text) => {
    let s = escapeHtml(text);

    // Inline images: ![alt](src)
    s = s.replaceAll(/!\[([^\]]*)\]\(([^)]+)\)/g, (_m, alt, src) => {
      const safeAlt = String(alt).trim();
      const safeSrc = String(src).trim();
      return `<img class="md-inline-img" src="${safeSrc}" alt="${safeAlt}" loading="lazy" />`;
    });

    // Links: [text](href)
    s = s.replaceAll(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, label, href) => {
      const resolved = rewriteHref(String(href));
      const safeHref = resolved;
      const safeLabel = String(label).trim();

      const isExternal =
        /^https?:\/\//.test(resolved) && !resolved.startsWith(window.location.origin);
      const extra = isExternal ? ' target="_blank" rel="noopener noreferrer"' : "";

      return `<a href="${safeHref}"${extra}>${safeLabel}</a>`;
    });

    // Bold: **text**
    s = s.replaceAll(/\*\*([^*]+)\*\*/g, (_m, inner) => `<strong>${inner}</strong>`);

    // Inline code: `code`
    s = s.replaceAll(/`([^`]+)`/g, (_m, inner) => `<code>${inner}</code>`);

    return s;
  };

  const markdownToHtml = (markdown) => {
    const lines = String(markdown)
      .replaceAll("\r\n", "\n")
      .replaceAll("\\\n", "\n")
      .replaceAll("\\*", "*")
      .split("\n");

    const isNoise = (line) => {
      const t = line.trim();
      if (!t) return false;
      return (
        t.startsWith("Skip to main content") ||
        t === "UserWay" ||
        t.startsWith("Enable accessibility") ||
        t.startsWith("Open the accessibility menu") ||
        t === "Share" ||
        t.startsWith("FILTERS") ||
        t === "Load More" ||
        t.toLowerCase() === "close" ||
        t.toLowerCase() === "play video" ||
        t.toLowerCase().startsWith("empty heading")
      );
    };

    const cleaned = [];
    let sawHeading = false;
    for (const line of lines) {
      const t = line.trim();
      if (!sawHeading) {
        if (/^#{1,6}\s+/.test(t)) sawHeading = true;
        else continue;
      }
      if (!isNoise(line)) cleaned.push(line);
    }

    let html = "";
    let para = [];
    let inList = false;
    let inQuote = false;

    const flushPara = () => {
      const text = para.join(" ").trim();
      if (text) html += `<p>${parseInline(text)}</p>`;
      para = [];
    };
    const closeList = () => {
      if (inList) html += "</ul>";
      inList = false;
    };
    const closeQuote = () => {
      if (inQuote) html += "</blockquote>";
      inQuote = false;
    };

    for (const raw of cleaned) {
      const t = raw.trim();

      if (!t) {
        flushPara();
        closeList();
        closeQuote();
        continue;
      }

      if (/^(\* \* \*|---)$/.test(t)) {
        flushPara();
        closeList();
        closeQuote();
        html += '<hr class="md-hr" />';
        continue;
      }

      const img = t.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
      if (img) {
        flushPara();
        closeList();
        closeQuote();
        const alt = escapeHtml(img[1]);
        const src = escapeHtml(String(img[2]).trim());
        const isLogo =
          /logo|favicon/i.test(src) || /\/logos?\//i.test(src) || /\/our-brands\//i.test(src);
        const figureClass = isLogo ? "md-figure md-figure--logo" : "md-figure";
        html += `<figure class="${figureClass}"><img src="${src}" alt="${alt}" loading="lazy" /></figure>`;
        continue;
      }

      const heading = t.match(/^(#{1,6})\s+(.+)$/);
      if (heading) {
        flushPara();
        closeList();
        closeQuote();
        const level = heading[1].length;
        const mappedLevel = Math.min(6, level + 1); // shift down: # -> h2
        const text = heading[2].trim();
        const id = slugify(text) || undefined;
        const idAttr = id ? ` id="${escapeHtml(id)}"` : "";
        html += `<h${mappedLevel}${idAttr}>${parseInline(text)}</h${mappedLevel}>`;
        continue;
      }

      const quote = t.match(/^>\s?(.*)$/);
      if (quote) {
        flushPara();
        closeList();
        if (!inQuote) {
          html += '<blockquote class="md-quote">';
          inQuote = true;
        }
        const text = quote[1].trim();
        if (text) html += `<p>${parseInline(text)}</p>`;
        continue;
      }

      const li = t.match(/^- (.+)$/);
      if (li) {
        flushPara();
        closeQuote();
        if (!inList) {
          html += '<ul class="md-list">';
          inList = true;
        }
        html += `<li>${parseInline(li[1].trim())}</li>`;
        continue;
      }

      para.push(t);
    }

    flushPara();
    closeList();
    closeQuote();

    return html;
  };

  const renderMarkdownBlocks = (lang) => {
    document.querySelectorAll("[data-md-target]").forEach((target) => {
      const scope = target.parentElement;
      if (!scope) return;

      const templates = Array.from(scope.querySelectorAll("template[data-md]"));
      if (!templates.length) return;

      const picked =
        templates.find((tpl) => tpl.getAttribute("data-lang") === lang) ||
        templates.find((tpl) => !tpl.hasAttribute("data-lang") || tpl.getAttribute("data-lang") === "en") ||
        templates[0];

      const md = picked.content?.textContent ?? "";
      target.innerHTML = markdownToHtml(md);
    });
  };

  // Highlight active nav link based on the current page.
  const current = window.location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll(".nav__links a, .mobile-menu__links a").forEach((a) => {
    const href = a.getAttribute("href") || "";
    const normalized = href.replace("./", "");
    if (normalized === current) a.classList.add("is-active");
  });

  // Language + currency.
  const LANG_STORAGE_KEY = "snuz.ng:lang";

  const LANG_CONFIG = {
    en: { htmlLang: "en", locale: "en-NG", currency: "NGN", label: "English" },
    pt: { htmlLang: "pt", locale: "pt-BR", currency: "NGN", label: "Português" },
    es: { htmlLang: "es", locale: "es-ES", currency: "NGN", label: "Español" },
  };

  const I18N = {
    en: {
      "a11y.skip_to_content": "Skip to content",
      "nav.who_we_are": "Who we are",
      "nav.our_brands": "Our brands",
      "nav.articles": "Articles",
      "nav.investors": "Become a Distributor",
      "nav.careers": "Careers",
      "nav.news": "News",
      "nav.contact": "Contact",
      "nav.investor_centre": "Become a distributor",
      "home.distributor.lede":
        "Partner with snuz.ng to bring premium nicotine pouches to more adults across Nigeria. Reach out to start a distributor conversation with our team.",
      "page.articles.lede":
        "Lessons from Sweden’s smoke-free success — and what they mean for Nigeria.",
      "lang.choose": "Choose Your Language",
      "search.form": "Site search",
      "search.label": "Search",
      "search.placeholder": "Search",
      "search.button": "Search",
      "page.contact.title": "Get in touch",
      "page.contact.lede": "Contact details and support links for consumers, investors, careers and media.",
      "page.contact.general_enquiry": "General enquiry",
      "page.contact.investor_relations": "Investor relations",
      "page.careers.title": "For health. With humanity.",
      "page.careers.lede":
        "Work is more than a job — it’s a chance to shape better everyday health. Explore roles, culture and development opportunities.",
      "page.careers.search_jobs": "Search jobs",
      "page.investors.lede":
        "Insight into the investment case, financial performance, reports, events, and shareholder resources.",
      "page.news.title": "Stories and press releases",
      "page.news.lede":
        "Browse the latest updates and resources. This clone links out to the original pages for full listings.",
      "page.impact.kicker": "Our impact",
      "page.impact.title": "Responsible business",
      "page.impact.lede":
        "Through our actions and partnerships, we aim to make better everyday health more inclusive, sustainable, and accessible for all.",
      "page.impact.report_cta": "2024 Responsible Business Report (PDF)",
      "page.strategy.kicker": "Strategy",
      "page.strategy.lede":
        "Through our strategy, we aim to reach one billion more consumers by 2030 and deliver industry‑leading shareholder returns.",
      "page.brands.title": "Superior brands, trusted science",
      "page.brands.lede":
        "A portfolio of category‑leading brands across oral health, pain relief, VMS and more — trusted and used by more than one billion consumers.",
      "page.brands.available_title": "Available brands",
      "page.brands.available_lede":
        "Explore a selection of nicotine pouch brands and popular flavours. For adults 18+ only.",
      "page.about.kicker": "About us",
      "page.about.title": "Meet <strong>snuz.ng</strong>",
      "page.about.lede":
        "Dedicated to tobacco‑free nicotine pouches, fair premium practices, and public health through harm reduction.",
      "page.about.cta": "Read about us",
      "home.hero_title": 'YOUR SMOKELESS JOURNEY <strong>AWAITS</strong>',
      "home.blueprint_title": 'A BLUEPRINT<br />FOR <strong>NIGERIA</strong>',
      "home.blueprint_p1":
        'The risk of a man dying from a tobacco-related illness is less in Sweden than in any other country, although tobacco consumption is on a comparable level with that of other countries in Europe and around the world. Researchers refer to this paradox as “the Swedish Experience”.',
      "home.blueprint_p2":
        'Sweden has achieved a historic public health victory, officially becoming the world\'s first and only “smoke-free” country by driving adult smoking rates below 5%. This unparalleled success was not achieved through prohibition, but by the widespread adoption of safer, smoke-free alternatives like snus, the precursor to modern nicotine pouches. This proves that informed adult choice and access to better products can dramatically accelerate the decline of smoking. It is our foundational goal to replicate this Swedish model of harm reduction in Nigeria, offering millions of adults a path away from combustible cigarettes and toward a smoke-free future.',
      "home.blueprint_cta": "Read the article",
      "home.deliveries.eyebrow": "Trusted nationwide",
      "home.deliveries.label": "Successful Snus Deliveries",
      "home.locations_title": "Snus Shop Locator",
      "home.locations_lede": "Find a physical SNUZ store near you. Tap a pin to open directions.",
      "home.locations_video_label": "Physical SNUZ shop locations",
      "home.stats.markets": "Markets we operate in",
      "home.stats.innovations": "Product innovations in 2024",
      "home.stats.power_brands": "Power brands",
      "home.stats.revenue": "Revenue",
      "home.regulatory_news": "Regulatory news",
      "home.regulatory.latest": "Latest",
      "home.reg.view_all_news": "View all news",
      "home.events.title": "Events",
      "home.events.upcoming": "Upcoming",
      "home.events.add_to_calendar": "Add to calendar",
      "home.events.all_events": "All events",
      "home.documents.title": "Documents",
      "home.documents.cta": "Explore our Annual Report",
      "home.reg.title":
        "Regulatory Update: snuz.ng Receives NAFDAC Approval for Nicotine Pouch Distribution in Nigeria",
      "home.reg.p1":
        'snuz.ng is proud to announce that its nicotine pouch products are now available in Nigeria following full compliance with the regulatory requirements established by the <strong>National Agency for Food and Drug Administration and Control (NAFDAC)</strong>.',
      "home.reg.p2":
        "This milestone reflects snuz.ng’s commitment to operating with transparency, safety, and adherence to Nigerian regulatory standards. Through the completion of the required documentation and regulatory review processes, snuz.ng is authorised to distribute nicotine pouch products within the Nigerian market in accordance with applicable guidelines.",
      "home.reg.p3":
        'Nicotine pouches are a modern, smoke-free nicotine alternative designed for adult consumers. At snuz.ng, we are dedicated to providing high-quality products while ensuring that all sales and marketing practices comply with the <strong>National Tobacco Control Act (2015)</strong> and other relevant Nigerian regulations.',
      "home.reg.commitment": "snuz.ng remains committed to responsible business practices, including:",
      "home.reg.b1": "Supplying <strong>NAFDAC-compliant nicotine pouch products</strong>",
      "home.reg.b2": "Strictly enforcing <strong>18+ age restrictions</strong> for all purchases",
      "home.reg.b3":
        "Ensuring <strong>clear labelling, ingredient transparency, and regulatory compliance</strong>",
      "home.reg.b4": "Supporting <strong>responsible retail and distribution standards</strong>",
      "home.reg.p4":
        "As Nigeria’s nicotine product regulatory landscape continues to evolve, snuz.ng will continue to work closely with regulatory authorities to ensure full compliance and maintain the highest standards of product quality and consumer safety.",
      "home.reg.p5":
        "Through this regulatory approval, snuz.ng aims to contribute to a responsible and transparent marketplace for adult nicotine alternatives in Nigeria.",
      "home.news.view_all": "View all stories",
      "home.articles.view_all": "View all articles",
      "home.articles.tag": "Regulatory",
      "home.articles.snippet":
        "snuz.ng nicotine pouch products are now available in Nigeria following full compliance with NAFDAC requirements — a milestone for transparent, regulated adult nicotine alternatives in the market.",
      "home.news.tag_financial": "Financial",
      "home.news.read_more": "Read more",
      "home.careers.banner":
        "The future of everyday health is changing and we're the people changing it. Nowhere else will you find an opportunity quite like this.",
      "home.careers.cta": "Your future at snuz.ng",
      "home.pouch.title": "What goes into a pouch?",
      "home.pouch.cta": "Shop products",
      "home.pouch.lede":
        "A modern smoke-free pouch is built from a few simple parts: nicotine, water, flavouring, and plant fibres. It is made for adults who want a tobacco-free pouch used in a similar way to snus.",
      "home.pouch.ingredient_nicotine": "Nicotine",
      "home.pouch.ingredient_water": "Water",
      "home.pouch.ingredient_flavouring": "Flavouring",
      "home.pouch.ingredient_fibres": "Plant fibres",
      "home.pouch.use_title": "Simple use guide",
      "home.pouch.use_step_1": "Use one pouch per session.",
      "home.pouch.use_step_2": "Place it under your upper lip.",
      "home.pouch.use_step_3": "Keep it in place for about 5 minutes, or up to an hour if preferred.",
      "home.pouch.use_step_4": "Put the used pouch into the lid compartment before disposal.",
      "home.featured.title": "Featured products",
      "home.featured.view_all": "View all",
      "products.title": "All products",
      "products.tabs.all": "Show all",
      "products.varies": "Varies",
      "products.add_to_cart": "Add to cart",
    },
    pt: {
      "a11y.skip_to_content": "Saltar para o conteúdo",
      "nav.who_we_are": "Quem somos",
      "nav.our_brands": "As nossas marcas",
      "nav.articles": "Artigos",
      "nav.investors": "Torne-se um distribuidor",
      "nav.careers": "Carreiras",
      "nav.news": "Notícias",
      "nav.contact": "Contacto",
      "nav.investor_centre": "Torne-se um distribuidor",
      "home.distributor.lede":
        "Faça parceria com a snuz.ng para levar bolsas de nicotina premium a mais adultos na Nigéria. Entre em contacto para iniciar uma conversa de distribuição com a nossa equipa.",
      "page.articles.lede":
        "Lições do sucesso da Suécia sem fumo — e o que isso significa para a Nigéria.",
      "lang.choose": "Escolha o seu idioma",
      "search.form": "Pesquisa no site",
      "search.label": "Pesquisar",
      "search.placeholder": "Pesquisar",
      "search.button": "Pesquisar",
      "page.contact.title": "Entre em contacto",
      "page.contact.lede": "Detalhes de contacto e links de apoio para consumidores, investidores, carreiras e media.",
      "page.contact.general_enquiry": "Pedido geral",
      "page.contact.investor_relations": "Relações com investidores",
      "page.careers.title": "Pela saúde. Com humanidade.",
      "page.careers.lede":
        "O trabalho é mais do que um emprego — é uma oportunidade de moldar uma melhor saúde quotidiana. Explore funções, cultura e oportunidades de desenvolvimento.",
      "page.careers.search_jobs": "Procurar vagas",
      "page.investors.lede":
        "Visão geral da tese de investimento, desempenho financeiro, relatórios, eventos e recursos para acionistas.",
      "page.news.title": "Histórias e comunicados de imprensa",
      "page.news.lede":
        "Veja as últimas atualizações e recursos. Este clone direciona para as páginas originais para listagens completas.",
      "page.impact.kicker": "O nosso impacto",
      "page.impact.title": "Negócio responsável",
      "page.impact.lede":
        "Através das nossas ações e parcerias, procuramos tornar a saúde quotidiana melhor mais inclusiva, sustentável e acessível para todos.",
      "page.impact.report_cta": "Relatório de Negócio Responsável 2024 (PDF)",
      "page.strategy.kicker": "Estratégia",
      "page.strategy.lede":
        "Através da nossa estratégia, pretendemos alcançar mais mil milhões de consumidores até 2030 e oferecer retornos líderes do setor aos acionistas.",
      "page.brands.title": "Marcas superiores, ciência de confiança",
      "page.brands.lede":
        "Um portefólio de marcas líderes de categoria em saúde oral, alívio da dor, VMS e muito mais — confiadas e usadas por mais de mil milhões de consumidores.",
      "page.brands.available_title": "Marcas disponíveis",
      "page.brands.available_lede":
        "Explore uma seleção de marcas de bolsas de nicotina e sabores populares. Apenas para adultos 18+.",
      "page.about.kicker": "Sobre nós",
      "page.about.title": "Conheça a <strong>snuz.ng</strong>",
      "page.about.lede":
        "Dedicados a bolsas de nicotina sem tabaco, práticas premium justas e saúde pública através da redução de danos.",
      "page.about.cta": "Leia sobre nós",
      "home.hero_title": 'A EXPERIÊNCIA <strong>SUECA</strong>',
      "home.blueprint_title": 'UM GUIA<br />PARA A <strong>NIGÉRIA</strong>',
      "home.blueprint_p1":
        'O risco de um homem morrer de uma doença relacionada com o tabaco é menor na Suécia do que em qualquer outro país, embora o consumo de tabaco esteja num nível comparável ao de outros países na Europa e no mundo. Os investigadores referem-se a este paradoxo como “a Experiência Sueca”.',
      "home.blueprint_p2":
        'A Suécia alcançou uma vitória histórica de saúde pública, tornando-se oficialmente o primeiro e único país “sem fumo” do mundo ao reduzir as taxas de tabagismo adulto para menos de 5%. Este sucesso sem precedentes não foi alcançado através da proibição, mas pela adoção generalizada de alternativas mais seguras e sem fumo, como o snus, precursor das modernas bolsas de nicotina. Isto prova que a escolha informada de adultos e o acesso a melhores produtos podem acelerar drasticamente o declínio do tabagismo. O nosso objetivo fundamental é replicar este modelo sueco de redução de danos na Nigéria, oferecendo a milhões de adultos um caminho para abandonar os cigarros combustíveis e avançar para um futuro sem fumo.',
      "home.blueprint_cta": "Ler o artigo",
      "home.deliveries.eyebrow": "Confiança em todo o país",
      "home.deliveries.label": "Entregas Snus bem-sucedidas",
      "home.locations_title": "Snus Shop Locator",
      "home.locations_lede": "Encontre uma loja SNUZ perto de si. Toque num pin para abrir direções.",
      "home.locations_video_label": "Locais físicos para comprar SNUZ",
      "home.stats.markets": "Mercados em que operamos",
      "home.stats.innovations": "Inovações de produto em 2024",
      "home.stats.power_brands": "Marcas principais",
      "home.stats.revenue": "Receita",
      "home.regulatory_news": "Notícias regulatórias",
      "home.regulatory.latest": "Mais recente",
      "home.reg.view_all_news": "Ver todas as notícias",
      "home.events.title": "Eventos",
      "home.events.upcoming": "Próximos",
      "home.events.add_to_calendar": "Adicionar ao calendário",
      "home.events.all_events": "Todos os eventos",
      "home.documents.title": "Documentos",
      "home.documents.cta": "Explorar o nosso Relatório Anual",
      "home.reg.title":
        "Atualização Regulamentar: snuz.ng recebe aprovação da NAFDAC para a distribuição de bolsas de nicotina na Nigéria",
      "home.reg.p1":
        'A snuz.ng tem o orgulho de anunciar que os seus produtos de bolsas de nicotina já estão disponíveis na Nigéria, após o cumprimento integral dos requisitos regulamentares estabelecidos pela <strong>National Agency for Food and Drug Administration and Control (NAFDAC)</strong>.',
      "home.reg.p2":
        "Este marco reflete o compromisso da snuz.ng em operar com transparência, segurança e conformidade com as normas regulatórias nigerianas. Com a conclusão da documentação exigida e dos processos de revisão regulatória, a snuz.ng está autorizada a distribuir produtos de bolsas de nicotina no mercado nigeriano, de acordo com as diretrizes aplicáveis.",
      "home.reg.p3":
        'As bolsas de nicotina são uma alternativa moderna de nicotina sem fumo, concebida para consumidores adultos. Na snuz.ng, dedicamo-nos a fornecer produtos de elevada qualidade, garantindo que todas as práticas de venda e marketing cumprem a <strong>National Tobacco Control Act (2015)</strong> e outras regulamentações nigerianas relevantes.',
      "home.reg.commitment": "A snuz.ng mantém-se empenhada em práticas empresariais responsáveis, incluindo:",
      "home.reg.b1": "Fornecer <strong>produtos de bolsas de nicotina em conformidade com a NAFDAC</strong>",
      "home.reg.b2": "Aplicar rigorosamente <strong>restrições de idade 18+</strong> em todas as compras",
      "home.reg.b3":
        "Garantir <strong>rotulagem clara, transparência de ingredientes e conformidade regulamentar</strong>",
      "home.reg.b4": "Apoiar <strong>padrões responsáveis de retalho e distribuição</strong>",
      "home.reg.p4":
        "À medida que o panorama regulatório dos produtos de nicotina na Nigéria continua a evoluir, a snuz.ng continuará a trabalhar de perto com as autoridades reguladoras para garantir total conformidade e manter os mais elevados padrões de qualidade do produto e segurança do consumidor.",
      "home.reg.p5":
        "Com esta aprovação regulatória, a snuz.ng pretende contribuir para um mercado responsável e transparente de alternativas de nicotina para adultos na Nigéria.",
      "home.news.view_all": "Ver todas as histórias",
      "home.articles.view_all": "Ver todos os artigos",
      "home.articles.tag": "Regulamentar",
      "home.articles.snippet":
        "Os produtos de bolsas de nicotina da snuz.ng já estão disponíveis na Nigéria após o cumprimento integral dos requisitos da NAFDAC — um marco para alternativas de nicotina para adultos reguladas e transparentes no mercado.",
      "home.news.tag_financial": "Financeiro",
      "home.news.read_more": "Ler mais",
      "home.careers.banner":
        "O futuro da saúde quotidiana está a mudar e nós somos as pessoas que a estão a mudar. Em mais nenhum lugar encontrará uma oportunidade como esta.",
      "home.careers.cta": "O seu futuro na snuz.ng",
      "home.pouch.title": "O que existe numa bolsa?",
      "home.pouch.cta": "Comprar produtos",
      "home.pouch.lede":
        "Uma bolsa moderna sem fumo é feita de alguns elementos simples: nicotina, água, aromas e fibras vegetais. Foi criada para adultos que procuram uma bolsa sem tabaco usada de forma semelhante ao snus.",
      "home.pouch.ingredient_nicotine": "Nicotina",
      "home.pouch.ingredient_water": "Água",
      "home.pouch.ingredient_flavouring": "Aromas",
      "home.pouch.ingredient_fibres": "Fibras vegetais",
      "home.pouch.use_title": "Guia simples de uso",
      "home.pouch.use_step_1": "Use uma bolsa por vez.",
      "home.pouch.use_step_2": "Coloque-a por baixo do lábio superior.",
      "home.pouch.use_step_3": "Mantenha-a no lugar por cerca de 5 minutos, ou até uma hora se preferir.",
      "home.pouch.use_step_4": "Coloque a bolsa usada no compartimento da tampa antes de descartar.",
      "home.featured.title": "Produtos em destaque",
      "home.featured.view_all": "Ver tudo",
      "products.title": "Todos os produtos",
      "products.tabs.all": "Mostrar tudo",
      "products.varies": "Varia",
      "products.add_to_cart": "Adicionar ao carrinho",
    },
    es: {
      "a11y.skip_to_content": "Saltar al contenido",
      "nav.who_we_are": "Quiénes somos",
      "nav.our_brands": "Nuestras marcas",
      "nav.articles": "Artículos",
      "nav.investors": "Conviértete en distribuidor",
      "nav.careers": "Carreras",
      "nav.news": "Noticias",
      "nav.contact": "Contacto",
      "nav.investor_centre": "Conviértete en distribuidor",
      "home.distributor.lede":
        "Asóciate con snuz.ng para llevar bolsas de nicotina premium a más adultos en Nigeria. Contáctanos para iniciar una conversación de distribución con nuestro equipo.",
      "page.articles.lede":
        "Lecciones del éxito de Suecia libre de humo — y lo que significan para Nigeria.",
      "lang.choose": "Elige tu idioma",
      "search.form": "Búsqueda en el sitio",
      "search.label": "Buscar",
      "search.placeholder": "Buscar",
      "search.button": "Buscar",
      "page.contact.title": "Ponte en contacto",
      "page.contact.lede":
        "Datos de contacto y enlaces de apoyo para consumidores, inversores, carreras y prensa.",
      "page.contact.general_enquiry": "Consulta general",
      "page.contact.investor_relations": "Relaciones con inversores",
      "page.careers.title": "Por la salud. Con humanidad.",
      "page.careers.lede":
        "El trabajo es más que un empleo: es una oportunidad para dar forma a una mejor salud cotidiana. Explora roles, cultura y oportunidades de desarrollo.",
      "page.careers.search_jobs": "Buscar empleos",
      "page.investors.lede":
        "Información sobre el caso de inversión, el desempeño financiero, los informes, los eventos y los recursos para accionistas.",
      "page.news.title": "Historias y comunicados de prensa",
      "page.news.lede":
        "Explora las últimas actualizaciones y recursos. Este clon enlaza a las páginas originales para ver listados completos.",
      "page.impact.kicker": "Nuestro impacto",
      "page.impact.title": "Negocio responsable",
      "page.impact.lede":
        "A través de nuestras acciones y alianzas, buscamos que una mejor salud cotidiana sea más inclusiva, sostenible y accesible para todos.",
      "page.impact.report_cta": "Informe de Negocio Responsable 2024 (PDF)",
      "page.strategy.kicker": "Estrategia",
      "page.strategy.lede":
        "A través de nuestra estrategia, buscamos llegar a mil millones más de consumidores para 2030 y ofrecer retornos para los accionistas líderes en la industria.",
      "page.brands.title": "Marcas superiores, ciencia confiable",
      "page.brands.lede":
        "Un portafolio de marcas líderes en su categoría en salud oral, alivio del dolor, VMS y más — confiadas y utilizadas por más de mil millones de consumidores.",
      "page.brands.available_title": "Marcas disponibles",
      "page.brands.available_lede":
        "Explora una selección de marcas de bolsas de nicotina y sabores populares. Solo para adultos 18+.",
      "page.about.kicker": "Sobre nosotros",
      "page.about.title": "Conoce <strong>snuz.ng</strong>",
      "page.about.lede":
        "Dedicados a bolsas de nicotina sin tabaco, prácticas premium justas y salud pública mediante la reducción de daños.",
      "page.about.cta": "Lee sobre nosotros",
      "home.hero_title": 'LA EXPERIENCIA <strong>SUECA</strong>',
      "home.blueprint_title": 'UNA HOJA DE RUTA<br />PARA <strong>NIGERIA</strong>',
      "home.blueprint_p1":
        'El riesgo de que un hombre muera por una enfermedad relacionada con el tabaco es menor en Suecia que en cualquier otro país, aunque el consumo de tabaco está en un nivel comparable al de otros países de Europa y del mundo. Los investigadores se refieren a esta paradoja como “la Experiencia Sueca”.',
      "home.blueprint_p2":
        'Suecia ha logrado una victoria histórica de salud pública, convirtiéndose oficialmente en el primer y único país “libre de humo” del mundo al reducir la tasa de tabaquismo adulto por debajo del 5%. Este éxito sin precedentes no se alcanzó mediante la prohibición, sino gracias a la adopción generalizada de alternativas más seguras y sin humo como el snus, precursor de las modernas bolsas de nicotina. Esto demuestra que la elección informada de los adultos y el acceso a mejores productos pueden acelerar de forma drástica el descenso del tabaquismo. Nuestro objetivo fundamental es replicar este modelo sueco de reducción de daños en Nigeria, ofreciendo a millones de adultos una vía para alejarse de los cigarrillos combustibles y avanzar hacia un futuro sin humo.',
      "home.blueprint_cta": "Leer el artículo",
      "home.deliveries.eyebrow": "Confianza en todo el país",
      "home.deliveries.label": "Entregas Snus exitosas",
      "home.locations_title": "Snus Shop Locator",
      "home.locations_lede": "Encuentra una tienda SNUZ cerca de ti. Toca un pin para abrir direcciones.",
      "home.locations_video_label": "Ubicaciones físicas para comprar SNUZ",
      "home.stats.markets": "Mercados en los que operamos",
      "home.stats.innovations": "Innovaciones de producto en 2024",
      "home.stats.power_brands": "Marcas principales",
      "home.stats.revenue": "Ingresos",
      "home.regulatory_news": "Noticias regulatorias",
      "home.regulatory.latest": "Más reciente",
      "home.reg.view_all_news": "Ver todas las noticias",
      "home.events.title": "Eventos",
      "home.events.upcoming": "Próximos",
      "home.events.add_to_calendar": "Añadir al calendario",
      "home.events.all_events": "Todos los eventos",
      "home.documents.title": "Documentos",
      "home.documents.cta": "Explorar nuestro Informe Anual",
      "home.reg.title":
        "Actualización regulatoria: snuz.ng recibe la aprobación de NAFDAC para la distribución de bolsas de nicotina en Nigeria",
      "home.reg.p1":
        'snuz.ng se enorgullece de anunciar que sus productos de bolsas de nicotina ya están disponibles en Nigeria tras el cumplimiento total de los requisitos regulatorios establecidos por la <strong>National Agency for Food and Drug Administration and Control (NAFDAC)</strong>.',
      "home.reg.p2":
        "Este hito refleja el compromiso de snuz.ng de operar con transparencia, seguridad y cumplimiento de las normas regulatorias nigerianas. Tras completar la documentación requerida y los procesos de revisión regulatoria, snuz.ng está autorizada a distribuir productos de bolsas de nicotina en el mercado nigeriano de acuerdo con las directrices aplicables.",
      "home.reg.p3":
        'Las bolsas de nicotina son una alternativa moderna de nicotina sin humo diseñada para consumidores adultos. En snuz.ng, nos dedicamos a ofrecer productos de alta calidad, garantizando que todas las prácticas de venta y marketing cumplan con la <strong>National Tobacco Control Act (2015)</strong> y otras regulaciones nigerianas pertinentes.',
      "home.reg.commitment": "snuz.ng sigue comprometida con prácticas empresariales responsables, entre ellas:",
      "home.reg.b1": "Suministrar <strong>productos de bolsas de nicotina que cumplen con NAFDAC</strong>",
      "home.reg.b2": "Aplicar estrictamente <strong>restricciones de edad 18+</strong> en todas las compras",
      "home.reg.b3":
        "Garantizar <strong>etiquetado claro, transparencia de ingredientes y cumplimiento regulatorio</strong>",
      "home.reg.b4": "Respaldar <strong>estándares responsables de venta minorista y distribución</strong>",
      "home.reg.p4":
        "A medida que el panorama regulatorio de los productos de nicotina en Nigeria continúa evolucionando, snuz.ng seguirá trabajando estrechamente con las autoridades regulatorias para garantizar el cumplimiento total y mantener los más altos estándares de calidad del producto y seguridad del consumidor.",
      "home.reg.p5":
        "Con esta aprobación regulatoria, snuz.ng busca contribuir a un mercado responsable y transparente de alternativas de nicotina para adultos en Nigeria.",
      "home.news.view_all": "Ver todas las historias",
      "home.articles.view_all": "Ver todos los artículos",
      "home.articles.tag": "Regulatorio",
      "home.articles.snippet":
        "Los productos de bolsas de nicotina de snuz.ng ya están disponibles en Nigeria tras el cumplimiento total de los requisitos de NAFDAC — un hito para alternativas de nicotina para adultos reguladas y transparentes en el mercado.",
      "home.news.tag_financial": "Financiero",
      "home.news.read_more": "Leer más",
      "home.careers.banner":
        "El futuro de la salud cotidiana está cambiando y nosotros somos quienes lo están cambiando. En ningún otro lugar encontrarás una oportunidad como esta.",
      "home.careers.cta": "Tu futuro en snuz.ng",
      "home.pouch.title": "¿Qué contiene una bolsa?",
      "home.pouch.cta": "Comprar productos",
      "home.pouch.lede":
        "Una bolsa moderna sin humo se compone de pocos elementos: nicotina, agua, saborizantes y fibras vegetales. Está pensada para adultos que quieren una bolsa sin tabaco usada de forma similar al snus.",
      "home.pouch.ingredient_nicotine": "Nicotina",
      "home.pouch.ingredient_water": "Agua",
      "home.pouch.ingredient_flavouring": "Saborizantes",
      "home.pouch.ingredient_fibres": "Fibras vegetales",
      "home.pouch.use_title": "Guía simple de uso",
      "home.pouch.use_step_1": "Usa una bolsa por sesión.",
      "home.pouch.use_step_2": "Colócala debajo del labio superior.",
      "home.pouch.use_step_3": "Déjala en su lugar unos 5 minutos, o hasta una hora si lo prefieres.",
      "home.pouch.use_step_4": "Pon la bolsa usada en el compartimento de la tapa antes de desecharla.",
      "home.featured.title": "Productos destacados",
      "home.featured.view_all": "Ver todo",
      "products.title": "Todos los productos",
      "products.tabs.all": "Mostrar todo",
      "products.varies": "Varía",
      "products.add_to_cart": "Añadir al carrito",
    },
  };

  const getSavedLang = () => {
    try {
      const saved = window.localStorage.getItem(LANG_STORAGE_KEY);
      if (saved && Object.prototype.hasOwnProperty.call(LANG_CONFIG, saved)) return saved;
    } catch {
      // ignore
    }
    return "en";
  };

  const applyI18n = (lang) => {
    const dict = I18N[lang] || I18N.en;
    const t = (key) => dict[key] ?? I18N.en[key];

    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n") || "";
      const value = t(key);
      if (typeof value === "string") el.textContent = value;
    });

    document.querySelectorAll("[data-i18n-html]").forEach((el) => {
      const key = el.getAttribute("data-i18n-html") || "";
      const value = t(key);
      if (typeof value === "string") el.innerHTML = value;
    });

    document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
      const key = el.getAttribute("data-i18n-placeholder") || "";
      const value = t(key);
      if (typeof value === "string") el.setAttribute("placeholder", value);
    });

    document.querySelectorAll("[data-i18n-aria-label]").forEach((el) => {
      const key = el.getAttribute("data-i18n-aria-label") || "";
      const value = t(key);
      if (typeof value === "string") el.setAttribute("aria-label", value);
    });
  };

  // Demo FX rates (approximate, static).
  const FX_TO_USD = {
    USD: 1,
    GBP: 1.27,
    EUR: 1.09,
    BRL: 0.2,
    NGN: 1 / 1600,
  };

  const convertMoney = (amount, fromCurrency, toCurrency) => {
    const from = FX_TO_USD[fromCurrency];
    const to = FX_TO_USD[toCurrency];
    if (!from || !to) return amount;
    const usd = amount * from;
    return usd / to;
  };

  const formatMoney = (amount, currency, locale, display) => {
    const compact = display === "compact";
    const nf = new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      notation: compact ? "compact" : "standard",
      compactDisplay: "short",
      maximumFractionDigits: compact ? 1 : 0,
      minimumFractionDigits: 0,
    });
    return nf.format(amount);
  };

  const applyMoney = (lang) => {
    const cfg = LANG_CONFIG[lang] || LANG_CONFIG.en;
    const targetCurrency = cfg.currency;
    const locale = cfg.locale;

    document.querySelectorAll("[data-money]").forEach((el) => {
      const raw = el.getAttribute("data-money");
      const baseCurrency = el.getAttribute("data-money-currency") || "NGN";
      const display = el.getAttribute("data-money-display") || "standard";
      const amount = Number(raw);
      if (!Number.isFinite(amount)) return;

      const converted = convertMoney(amount, baseCurrency, targetCurrency);
      el.textContent = formatMoney(converted, targetCurrency, locale, display);
    });
  };

  const langRoot = document.querySelector("[data-lang]");
  const langBtn = langRoot?.querySelector("[data-lang-btn]");
  const langMenu = langRoot?.querySelector("[data-lang-menu]");
  const langCurrent = langRoot?.querySelector("[data-lang-current]");
  const langOptions = Array.from(langRoot?.querySelectorAll("[data-lang-option]") || []);

  const setLangMenuOpen = (open) => {
    if (!langBtn || !langMenu) return;
    langBtn.setAttribute("aria-expanded", open ? "true" : "false");
    langMenu.hidden = !open;
  };

  const setLangUi = (lang) => {
    const cfg = LANG_CONFIG[lang] || LANG_CONFIG.en;
    langOptions.forEach((opt) => {
      const key = opt.getAttribute("data-lang-option");
      opt.setAttribute("aria-selected", key === lang ? "true" : "false");
    });
    if (langCurrent) langCurrent.textContent = cfg.label;
  };

  const applyLanguage = (lang) => {
    const normalized = Object.prototype.hasOwnProperty.call(LANG_CONFIG, lang) ? lang : "en";
    const cfg = LANG_CONFIG[normalized];

    document.documentElement.lang = cfg.htmlLang;
    document.documentElement.dataset.lang = normalized;

    renderMarkdownBlocks(normalized);
    applyI18n(normalized);
    applyMoney(normalized);
    setLangUi(normalized);
  };

  // Init language dropdown.
  applyLanguage(getSavedLang());

  langBtn?.addEventListener("click", () => {
    const open = langBtn.getAttribute("aria-expanded") === "true";
    setLangMenuOpen(!open);
  });

  langMenu?.addEventListener("click", (e) => {
    const opt = e.target.closest("[data-lang-option]");
    if (!opt) return;
    const next = opt.getAttribute("data-lang-option") || "en";
    try {
      window.localStorage.setItem(LANG_STORAGE_KEY, next);
    } catch {
      // ignore
    }
    setLangMenuOpen(false);
    applyLanguage(next);
  });

  document.addEventListener("click", (e) => {
    if (!langMenu || !langBtn) return;
    if (langMenu.hidden) return;
    if (e.target.closest("[data-lang]")) return;
    setLangMenuOpen(false);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (!langMenu || langMenu.hidden) return;
    setLangMenuOpen(false);
  });

  // Product tabs.
  const tabs = Array.from(document.querySelectorAll("[data-tab]"));
  const products = Array.from(document.querySelectorAll("#productsGrid .product"));
  const setActiveTab = (key) => {
    tabs.forEach((btn) => {
      const match = btn.getAttribute("data-tab") === key;
      btn.classList.toggle("is-active", match);
      btn.setAttribute("aria-selected", match ? "true" : "false");
    });
    products.forEach((card) => {
      const cat = card.getAttribute("data-category") || "";
      card.hidden = key !== "all" && cat !== key;
    });
  };

  tabs.forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = btn.getAttribute("data-tab") || "all";
      setActiveTab(key);
    });
  });

  // Scroll-triggered delivery counter.
  const animateCounter = (el) => {
    const to = Number(el.getAttribute("data-to-value") || "0");
    const from = Number(el.getAttribute("data-from-value") || "0");
    const duration = Number(el.getAttribute("data-duration") || "3000");
    const delimiter = el.getAttribute("data-delimiter") || ",";
    const format = (n) =>
      Math.round(n)
        .toString()
        .replace(/\B(?=(\d{3})+(?!\d))/g, delimiter);

    if (prefersReduced || duration <= 0) {
      el.textContent = format(to);
      return;
    }

    const start = performance.now();
    const tick = (now) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = format(from + (to - from) * eased);
      if (progress < 1) window.requestAnimationFrame(tick);
    };
    window.requestAnimationFrame(tick);
  };

  const counters = Array.from(document.querySelectorAll("[data-counter]"));
  if (counters.length) {
    if ("IntersectionObserver" in window) {
      const counterObs = new IntersectionObserver(
        (entries, obs) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            animateCounter(entry.target);
            obs.unobserve(entry.target);
          });
        },
        { threshold: 0.45 }
      );
      counters.forEach((el) => counterObs.observe(el));
    } else {
      counters.forEach((el) => animateCounter(el));
    }
  }
})();
