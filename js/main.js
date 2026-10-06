/* ==========================================================================
   Forest Cafe — main.js
   ========================================================================== */
(function () {
  'use strict';

  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // images are already .webp / .jpg in /images — nothing to probe for
  function getPreferredImageSource(src) { return Promise.resolve(src); }

  /* ---------- scroll lock ---------- */
  // The page is locked ONLY while something is really open. (The old counter drifted:
  // next/prev inside the photo viewer locked again each time, close unlocked once,
  // so the page stayed stuck after closing.)
  var OVERLAYS = '.modal.is-open, .lightbox.is-open, .room-modal.is-open, .pm.is-open, .lg.is-open, .nav-links.is-open, #preloader:not(.is-done)';
  function overlayOpen() { return !!document.querySelector(OVERLAYS); }
  function syncScroll() { document.body.classList.toggle('no-scroll', overlayOpen()); }
  function lockScroll() { syncScroll(); }
  function unlockScroll() { syncScroll(); }
  window.fcSyncScroll = syncScroll;
  // self-heal: if the page is ever left locked with nothing open, unlock on the next touch / wheel / key
  ['wheel', 'touchstart', 'pointerdown', 'keydown'].forEach(function (ev) {
    window.addEventListener(ev, function () {
      if (document.body.classList.contains('no-scroll') && !overlayOpen()) document.body.classList.remove('no-scroll');
    }, { passive: true });
  });

  /* ======================================================================
     1. Preloader — always finishes, even if the video never loads
     ====================================================================== */
  (function preloader() {
    var pre = $('#preloader');
    var loadVid = $('#loadingVideo');
    var heroVid = $('#heroVideo');
    if (!pre) return;

    var finished = false;

    function finish() {
      if (finished) return;
      finished = true;
      pre.classList.add('is-done');
      unlockScroll();
      if (heroVid) {
        var p = heroVid.play();
        if (p && p.catch) p.catch(function () { /* autoplay blocked — poster frame stays */ });
      }
      setTimeout(function () { if (pre.parentNode) pre.parentNode.removeChild(pre); }, 900);
    }

    lockScroll();

    if (reduceMotion) { finish(); return; }

    if (loadVid) {
      loadVid.addEventListener('ended', finish);
      loadVid.addEventListener('error', function () { pre.classList.add('no-video'); });
      var play = loadVid.play();
      if (play && play.catch) play.catch(function () { pre.classList.add('no-video'); });
    } else {
      pre.classList.add('no-video');
    }

    // hard stop: nobody waits longer than 6 seconds for an intro
    setTimeout(finish, 6000);
    $('#skipIntro') && $('#skipIntro').addEventListener('click', finish);
    window.addEventListener('load', function () {
      setTimeout(function () { if (!finished && loadVid && !loadVid.duration) finish(); }, 1500);
    });
  }());

  /* ======================================================================
     2. Navbar: stuck state + scrollspy
     ====================================================================== */
  (function navbar() {
    var nav = $('#nav');

    function onScroll() {
      if (!nav) return;
      nav.classList.toggle('is-stuck', window.scrollY > 60);
    }

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });

    var links = $$('#navLinks a[href^="#"]');
    var targets = links.map(function (a) { return $(a.getAttribute('href')); }).filter(Boolean);

    if ('IntersectionObserver' in window && targets.length) {
      var spy = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          links.forEach(function (a) {
            a.classList.toggle('is-active', a.getAttribute('href') === '#' + en.target.id);
          });
        });
      }, { rootMargin: '-45% 0px -50% 0px' });

      targets.forEach(function (t) { spy.observe(t); });
    }
  }());

  /* ======================================================================
     3. Scroll progress + back to top
     ====================================================================== */
  (function scrollUi() {
    var bar = $('#progressBar');
    var top = $('#toTop');

    function update() {
      var h = document.documentElement.scrollHeight - window.innerHeight;
      var pct = h > 0 ? (window.scrollY / h) * 100 : 0;
      if (bar) bar.style.width = pct + '%';
      if (top) top.classList.toggle('is-on', window.scrollY > 700);
    }
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);

    if (top) {
      top.addEventListener('click', function () {
        window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
      });
    }
  }());

  /* ======================================================================
     4. Reveal on scroll
     ====================================================================== */
  (function reveals() {
    var items = $$('.reveal');
    if (!items.length) return;
    if (reduceMotion || !('IntersectionObserver' in window)) {
      items.forEach(function (el) { el.classList.add('is-in'); });
      return;
    }
    var io = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('is-in'); obs.unobserve(en.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -60px 0px' });
    items.forEach(function (el) { io.observe(el); });
  }());

  /* ======================================================================
     5. Customer reviews slider
     ====================================================================== */
  (function reviewsSlider() {
    var section = $('#customer-reviews');
    if (!section) return;

    var viewport = section.querySelector('.reviews-viewport');
    var track = section.querySelector('.reviews-track');
    var cards = Array.prototype.slice.call(section.querySelectorAll('.review-card'));
    var prev = section.querySelector('.reviews-control--prev');
    var next = section.querySelector('.reviews-control--next');
    var dotsWrap = section.querySelector('.reviews-dots');

    if (!viewport || !track || !cards.length) return;

    var state = {
      index: 0,
      touchStartX: 0,
      touchEndX: 0
    };
    var autoTimer = null;

    function getVisibleCards() {
      return window.innerWidth <= 700 ? 1 : window.innerWidth <= 900 ? 2 : 3;
    }

    function getGap() {
      var styles = window.getComputedStyle(track);
      return parseFloat(styles.gap || '0') || 0;
    }

    function getSlideWidth() {
      return cards[0].getBoundingClientRect().width + getGap();
    }

    function buildDots() {
      if (!dotsWrap) return;
      dotsWrap.innerHTML = '';
      var maxIndex = Math.max(cards.length - getVisibleCards(), 0);
      for (var i = 0; i <= maxIndex; i++) {
        var dot = document.createElement('button');
        dot.type = 'button';
        dot.className = 'reviews-dot' + (i === 0 ? ' is-active' : '');
        dot.setAttribute('aria-label', 'Go to review slide ' + (i + 1));
        dot.addEventListener('click', function () {
          state.index = Number(this.dataset.index);
          updateSlider();
        });
        dot.dataset.index = String(i);
        dotsWrap.appendChild(dot);
      }
    }

    function updateSlider() {
      var visibleCards = getVisibleCards();
      var maxIndex = Math.max(cards.length - visibleCards, 0);
      state.index = Math.min(Math.max(state.index, 0), maxIndex);

      track.style.setProperty('--review-columns', visibleCards);
      var move = state.index * getSlideWidth();
      track.style.transform = 'translateX(-' + move + 'px)';

      if (prev) prev.disabled = false;
      if (next) next.disabled = false;

      var dots = dotsWrap ? dotsWrap.querySelectorAll('.reviews-dot') : [];
      dots.forEach(function (dot, idx) {
        dot.classList.toggle('is-active', idx === state.index);
      });
    }

    function move(direction) {
      var visibleCards = getVisibleCards();
      var maxIndex = Math.max(cards.length - visibleCards, 0);
      if (maxIndex === 0) return;

      if (direction > 0 && state.index >= maxIndex) {
        state.index = 0;
      } else if (direction < 0 && state.index <= 0) {
        state.index = maxIndex;
      } else {
        state.index = Math.min(Math.max(state.index + direction, 0), maxIndex);
      }

      updateSlider();
    }

    function stopAuto() {
      if (autoTimer) {
        clearInterval(autoTimer);
        autoTimer = null;
      }
    }

    function startAuto() {
      if (reduceMotion) return;
      stopAuto();
      var visibleCards = getVisibleCards();
      var maxIndex = Math.max(cards.length - visibleCards, 0);
      if (maxIndex <= 0) return;
      autoTimer = setInterval(function () {
        state.index = state.index >= maxIndex ? 0 : state.index + 1;
        updateSlider();
      }, 5000);
    }

    if (prev) prev.addEventListener('click', function () { stopAuto(); move(-1); startAuto(); });
    if (next) next.addEventListener('click', function () { stopAuto(); move(1); startAuto(); });

    viewport.addEventListener('touchstart', function (event) {
      state.touchStartX = event.touches[0].clientX;
    }, { passive: true });

    viewport.addEventListener('touchend', function (event) {
      state.touchEndX = event.changedTouches[0].clientX;
      var delta = state.touchEndX - state.touchStartX;
      if (Math.abs(delta) > 50) {
        stopAuto();
        move(delta < 0 ? 1 : -1);
        startAuto();
      }
    }, { passive: true });

    window.addEventListener('resize', function () {
      buildDots();
      updateSlider();
      startAuto();
    });

    buildDots();
    updateSlider();
    startAuto();
  }());

  var galleryImages = [
    'images/cafe/cafe-01.jpg', 'images/cafe/cafe-05.jpg', 'images/cafe/cafe-06.jpg',
    'images/cafe/cafe-11.jpg', 'images/cafe/cafe-14.jpg', 'images/cafe/cafe-18.jpg',
    'images/cafe/cafe-19.jpg', 'images/cafe/cafe-20.jpg', 'images/cafe/cafe-22.jpg'
  ];

  (function stack() {
    var cards = $$('#cardsStack .photo-card');
    if (!cards.length) return;
    var positions = [0, 1, 2, 3, 4];
    var wrapper = $('.cards-wrapper');
    var autoTimer = null;

    function paint() {
      cards.forEach(function (card, i) {
        card.className = 'photo-card pos-' + positions[i];
      });
    }

    function next() {
      positions.push(positions.shift()); paint();
    }
    function prev() {
      positions.unshift(positions.pop()); paint();
    }

    function startAuto() {
      stopAuto();
      autoTimer = setInterval(next, 2800);
    }
    function stopAuto() {
      if (autoTimer) clearInterval(autoTimer);
    }

    $('#nextCard') && $('#nextCard').addEventListener('click', function () {
      next(); startAuto();
    });
    $('#prevCard') && $('#prevCard').addEventListener('click', function () {
      prev(); startAuto();
    });
    cards.forEach(function (card) {
      card.addEventListener('click', function () {
        openLightbox(parseInt(card.dataset.index, 10) || 0);
      });
    });

    if (wrapper) {
      wrapper.addEventListener('mouseenter', stopAuto);
      wrapper.addEventListener('mouseleave', startAuto);
    }

    startAuto();
  }());

  (function galleryToggle() {
    var def = $('#galleryDefault');
    var full = $('#galleryFull');
    if (!def || !full) return;

    $('#exploreCafeBtn') && $('#exploreCafeBtn').addEventListener('click', function () {
      def.classList.add('is-hidden');
      full.classList.add('is-open');
      full.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    });
    $('#closeGalleryBtn') && $('#closeGalleryBtn').addEventListener('click', function () {
      full.classList.remove('is-open');
      def.classList.remove('is-hidden');
      $('#cafe').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    });

    $$('#galleryGrid .grid-card').forEach(function (btn) {
      btn.addEventListener('click', function () {
        openLightbox(parseInt(btn.dataset.index, 10) || 0);
      });
    });
  }());

  var lb = $('#lightbox');
  var lbImg = $('#lbImage');
  var lbCounter = $('#lbCounter');
  var lbIndex = 0;

  function openLightbox(i) {
    if (!lb) return;
    lbIndex = (i + galleryImages.length) % galleryImages.length;
    var selected = galleryImages[lbIndex];
    getPreferredImageSource(selected).then(function (resolved) {
      lbImg.src = resolved;
    });
    lbImg.alt = 'Forest Cafe photo ' + (lbIndex + 1) + ' of ' + galleryImages.length;
    lbCounter.textContent = (lbIndex + 1) + ' / ' + galleryImages.length;
    lb.classList.add('is-open');
    lockScroll();
  }
  function closeLightbox() {
    if (!lb) return;
    lb.classList.remove('is-open');
    unlockScroll();
  }
  if (lb) {
    $('#lbClose').addEventListener('click', closeLightbox);
    $('#lbPrev').addEventListener('click', function () { openLightbox(lbIndex - 1); });
    $('#lbNext').addEventListener('click', function () { openLightbox(lbIndex + 1); });
    lb.addEventListener('click', function (e) { if (e.target === lb) closeLightbox(); });
  }

  /* ======================================================================
     6. Menu tabs + full menu modal
     ====================================================================== */
  (function menu() {
    var tabs = $$('.menu-tab');
    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        tabs.forEach(function (t) {
          var on = t === tab;
          t.classList.toggle('is-active', on);
          t.setAttribute('aria-selected', String(on));
        });
        $$('.menu-panel').forEach(function (p) {
          p.classList.toggle('is-active', p.id === 'panel-' + tab.dataset.menu);
        });
      });
    });

    var modal = $('#menuModal');
    if (!modal) return;
    function open() { modal.classList.add('is-open'); lockScroll(); }
    function close() { modal.classList.remove('is-open'); unlockScroll(); }
    $('#viewMenuBtn') && $('#viewMenuBtn').addEventListener('click', open);
    $('#closeMenuModal').addEventListener('click', close);
    modal.addEventListener('click', function (e) { if (e.target === modal) close(); });
  }());

  /* ======================================================================
     7. Room tabs + room modal
     ====================================================================== */
  (function rooms() {
    var tabs = $$('.room-tab');
    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        tabs.forEach(function (t) {
          var on = t === tab;
          t.classList.toggle('is-active', on);
          t.setAttribute('aria-selected', String(on));
        });
        $$('.room-grid').forEach(function (g) {
          g.classList.toggle('is-active', g.id === 'grid-' + tab.dataset.room);
        });
      });
    });

    var modal = $('#roomModal');
    if (!modal) return;

    function close() { modal.classList.remove('is-open'); unlockScroll(); }

    $$('.room-card').forEach(function (card) {
      card.addEventListener('click', function () {
        $('#roomModalImg').src = card.dataset.image;
        $('#roomModalImg').alt = card.dataset.title + ', ' + card.dataset.category;
        $('#roomModalTitle').textContent = card.dataset.title;
        $('#roomModalDesc').textContent = card.dataset.desc;
        modal.classList.add('is-open');
        lockScroll();
      });
    });

    $('#roomModalClose').addEventListener('click', close);
    modal.addEventListener('click', function (e) { if (e.target === modal) close(); });
  }());

  /* ======================================================================
     8. Newsletter
     ====================================================================== */
  (function newsletter() {
    var form = $('#newsletterForm');
    if (!form) return;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var input = $('#nlEmail');
      var msg = $('#newsletterMsg');
      var ok = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(input.value.trim());
      if (!ok) {
        msg.style.color = '#E6A07A';
        msg.textContent = 'That email does not look right.';
        return;
      }
      msg.style.color = '#9DC77F';
      msg.textContent = 'Done. First letter goes out on the 1st.';
      input.value = '';
    });
  }());

  /* ======================================================================
     9. Escape closes whatever is open
     ====================================================================== */
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      var open = $('.modal.is-open, .lightbox.is-open, .room-modal.is-open');
      if (!open) return;
      open.classList.remove('is-open');
      unlockScroll();
      return;
    }
    if ($('#lightbox') && $('#lightbox').classList.contains('is-open')) {
      if (e.key === 'ArrowLeft') openLightbox(lbIndex - 1);
      if (e.key === 'ArrowRight') openLightbox(lbIndex + 1);
    }
  });

  /* ---------- year ---------- */
  var y = $('#year');
  if (y) y.textContent = new Date().getFullYear();
}());

/* --- Rooms accordion gallery (Interior / Exterior) --- */
(() => {
    const stage = document.getElementById("slatStage");
    const container = document.getElementById("roomsSlatGallery");
    const prevBtn = document.getElementById("slatPrevBtn");
    const nextBtn = document.getElementById("slatNextBtn");
    const currentEl = document.getElementById("slatCurrentIndex");
    const totalEl = document.getElementById("slatTotalCount");
    const progressBar = document.getElementById("slatProgressBar");
    const filterBtns = document.querySelectorAll(".rooms-pill-btn");

    if (!stage || !container) return;

    const allSlides = [
        { label: "Interior suite",   title: "Bedroom\nRetreat",   image: "images/rooms/1.webp", category: "interior" },
        { label: "Living space",     title: "Central\nHall",      image: "images/rooms/2.webp", category: "interior" },
        { label: "Lounge corner",    title: "Cozy Steps\nLounge", image: "images/rooms/6.webp", category: "interior" },
        { label: "Canopy retreat",   title: "Forest\nGlade",      image: "images/rooms/3.webp", category: "exterior" },
        { label: "Entrance deck",    title: "Front\nTerrace",     image: "images/rooms/4.webp", category: "exterior" },
        { label: "Outdoor ambience", title: "Garden\nDeck",       image: "images/rooms/5.webp", category: "exterior" }
    ];

    let category = "interior";
    let slides = allSlides.filter(s => s.category === category);
    let active = 0;
    let panels = [];

    function render() {
        stage.innerHTML = slides.map((s, i) => `
            <button type="button" class="rooms-panel" data-index="${i}" aria-label="Show ${s.label}" aria-pressed="false">
                <img class="rooms-panel__img" src="${s.image}" alt="${s.label}" draggable="false">
                <span class="rooms-panel__shade"></span>
                <span class="rooms-panel__side">${s.label}</span>
                <span class="rooms-panel__content">
                    <span class="rooms-panel__tag">${s.label}</span>
                    <span class="rooms-panel__title">${s.title.replace("\n", "<br>")}</span>
                </span>
            </button>`).join("");
        panels = Array.from(stage.querySelectorAll(".rooms-panel"));
        panels.forEach((p, i) => {
            p.addEventListener("click", () => setActive(i));
            p.addEventListener("mouseenter", () => setActive(i));
        });
        if (totalEl) totalEl.textContent = String(slides.length).padStart(2, "0");
        setActive(0);
    }

    function setActive(i) {
        active = (i + slides.length) % slides.length;
        panels.forEach((p, idx) => {
            const on = idx === active;
            p.classList.toggle("is-active", on);
            p.setAttribute("aria-pressed", on ? "true" : "false");
        });
        if (currentEl) currentEl.textContent = String(active + 1).padStart(2, "0");
        if (progressBar) progressBar.style.transform = `scaleX(${(active + 1) / slides.length})`;
    }

    filterBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            const cat = btn.getAttribute("data-category");
            if (cat === category) return;
            filterBtns.forEach(b => { b.classList.remove("is-active"); b.setAttribute("aria-selected", "false"); });
            btn.classList.add("is-active");
            btn.setAttribute("aria-selected", "true");
            category = cat;
            slides = allSlides.filter(s => s.category === category);
            render();
        });
    });

    if (prevBtn) prevBtn.addEventListener("click", () => setActive(active - 1));
    if (nextBtn) nextBtn.addEventListener("click", () => setActive(active + 1));
    container.addEventListener("keydown", e => {
        if (e.key === "ArrowLeft")  { e.preventDefault(); setActive(active - 1); }
        if (e.key === "ArrowRight") { e.preventDefault(); setActive(active + 1); }
    });

    allSlides.forEach(s => { const img = new Image(); img.src = s.image; });
    render();
})();

(() => {
    const toggleBtn = document.getElementById("toggleProductsBtn");
    const grid = document.getElementById("productsGrid");

    if (!toggleBtn || !grid) return;

    toggleBtn.addEventListener("click", () => {
        const isExpanded = grid.classList.toggle("is-expanded");
        toggleBtn.classList.toggle("is-active", isExpanded);
        toggleBtn.setAttribute("aria-expanded", isExpanded);

        const btnText = toggleBtn.querySelector(".btn-text");
        if (btnText) {
            btnText.textContent = isExpanded ? "Show fewer products" : "View more products";
        }

        // If collapsing, scroll smoothly back up to the grid top
        if (!isExpanded) {
            grid.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
    });
})();


/* ==========================================================================
   OUR STORY — "Read full story" toggle
   ========================================================================== */
(() => {
    const btn = document.getElementById("storyToggle");
    const full = document.getElementById("storyFull");
    const block = document.getElementById("ourStory");
    if (!btn || !full) return;
    const label = btn.querySelector(".ad-story-toggle-text");
    const closedText = label ? label.textContent.trim() : "Read full story";

    btn.addEventListener("click", () => {
        const open = full.classList.toggle("is-open");
        btn.setAttribute("aria-expanded", String(open));
        full.setAttribute("aria-hidden", String(!open));
        if (label) label.textContent = open ? "Show less" : closedText;
        if (!open && block && block.getBoundingClientRect().top < 0) {
            block.scrollIntoView({ behavior: "smooth", block: "start" });
        }
    });
})();


/* ==========================================================================
   MOBILE — hamburger drawer, hero video (16:9 ↔ 9:16), swipe + tab helpers
   ========================================================================== */
(() => {
    const $ = (s, c) => (c || document).querySelector(s);
    const $$ = (s, c) => Array.from((c || document).querySelectorAll(s));

    /* ---------- 1. Drawer menu ---------- */
    const toggle = $("#navToggle");
    const links = $("#navLinks");
    const backdrop = $("#navBackdrop");
    const drawerMq = window.matchMedia("(max-width: 900px)");

    function setMenu(open) {
        if (!toggle || !links) return;
        links.classList.toggle("is-open", open);
        if (backdrop) backdrop.classList.toggle("is-open", open);
        toggle.setAttribute("aria-expanded", String(open));
        toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
        window.fcSyncScroll();
    }
    if (toggle && links) {
        toggle.addEventListener("click", () => setMenu(!links.classList.contains("is-open")));
        if (backdrop) backdrop.addEventListener("click", () => setMenu(false));
        links.addEventListener("click", e => { if (e.target.closest("a")) setMenu(false); });
        document.addEventListener("keydown", e => { if (e.key === "Escape") setMenu(false); });
        const onBp = () => { if (!drawerMq.matches) setMenu(false); };
        if (drawerMq.addEventListener) drawerMq.addEventListener("change", onBp); else drawerMq.addListener(onBp);
    }

    /* ---------- 2. Hero video: skeleton while loading + swap source at the phone breakpoint ---------- */
    const hero = $("#heroVideo");
    const heroSec = $(".hero");
    if (hero && heroSec) {
        const mq = window.matchMedia("(max-width: 767px)");
        const SRC = {
            mobile: '<source src="Hero-Mob.webm" type="video/webm">',
            desktop: '<source src="Hero.webm" type="video/webm">'
        };
        let fbTimer = null;
        const ready = () => {
            if (!heroSec.classList.contains("is-loading")) return;
            clearTimeout(fbTimer);
            heroSec.classList.remove("is-loading");
            heroSec.classList.add("is-ready");
        };
        // video could not load at all → show the still photo instead of an endless skeleton
        const fallback = () => {
            clearTimeout(fbTimer);
            heroSec.classList.remove("is-loading", "is-ready");
            heroSec.classList.add("is-fallback");
        };
        const armTimer = () => { clearTimeout(fbTimer); fbTimer = setTimeout(fallback, 12000); };
        const check = () => { if (hero.readyState >= 2) ready(); };
        ["loadeddata", "canplay", "playing"].forEach(ev => hero.addEventListener(ev, check));
        hero.addEventListener("error", fallback, true);
        armTimer(); check();

        const apply = () => {
            const want = mq.matches ? "mobile" : "desktop";
            const have = hero.getAttribute("data-active") === "mobile" ? "mobile" : "desktop";
            if (want === have) return;
            const wasPlaying = !hero.paused;
            heroSec.classList.remove("is-ready", "is-fallback");
            heroSec.classList.add("is-loading");
            hero.innerHTML = SRC[want];
            hero.setAttribute("data-active", want);
            hero.load();
            armTimer();
            const p = (wasPlaying || !document.getElementById("preloader")) ? hero.play() : null;
            if (p && p.catch) p.catch(() => {});
        };
        if (mq.addEventListener) mq.addEventListener("change", apply); else mq.addListener(apply);

        // some phones pause autoplay when the tab is hidden — resume on return
        document.addEventListener("visibilitychange", () => {
            if (!document.hidden && !document.getElementById("preloader") && hero.paused) {
                const p = hero.play(); if (p && p.catch) p.catch(() => {});
            }
        });
    }

    /* ---------- 3. Swipe helper (re-uses the existing arrow buttons) ---------- */
    function swipe(el, onLeft, onRight) {
        if (!el) return;
        let x0 = 0, y0 = 0;
        el.addEventListener("touchstart", e => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
        el.addEventListener("touchend", e => {
            const dx = e.changedTouches[0].clientX - x0;
            const dy = e.changedTouches[0].clientY - y0;
            if (Math.abs(dx) < 45 || Math.abs(dx) < Math.abs(dy) * 1.3) return;
            (dx < 0 ? onLeft : onRight)();
        }, { passive: true });
    }
    const click = id => () => { const b = document.getElementById(id); if (b) b.click(); };

    swipe($("#cardsStack"), click("nextCard"), click("prevCard"));          // cafe photo stack
    swipe($("#lightbox"), click("lbNext"), click("lbPrev"));                 // photo viewer
    swipe($("#roomsSlatGallery"), click("slatNextBtn"), click("slatPrevBtn")); // rooms gallery

})();


/* ==========================================================================
   POLICIES POPUP — Privacy / Terms / Refund (footer links, #privacy etc.)
   ========================================================================== */
(() => {
    const modal = document.getElementById("legalModal");
    if (!modal) return;
    const titles = { privacy: "Privacy Policy", terms: "Terms & Conditions", refund: "Refund Policy" };
    const tabs = Array.from(modal.querySelectorAll(".lg-tab"));
    const docs = Array.from(modal.querySelectorAll(".lg-doc"));
    const body = document.getElementById("lgBody");
    const title = document.getElementById("lgTitle");
    let lastFocus = null;

    function show(key) {
        if (!titles[key]) key = "privacy";
        tabs.forEach(t => { const on = t.dataset.tab === key; t.classList.toggle("is-on", on); t.setAttribute("aria-selected", String(on)); });
        docs.forEach(d => { d.hidden = d.id !== "lg-" + key; });
        title.textContent = titles[key];
        body.scrollTop = 0;
    }
    function open(key) {
        lastFocus = document.activeElement;
        show(key);
        modal.classList.add("is-open");
        modal.setAttribute("aria-hidden", "false");
        window.fcSyncScroll();
        const c = document.getElementById("lgClose"); if (c) setTimeout(() => c.focus({ preventScroll: true }), 40);
    }
    function close() {
        if (!modal.classList.contains("is-open")) return;
        modal.classList.remove("is-open");
        modal.setAttribute("aria-hidden", "true");
        window.fcSyncScroll();
        if (location.hash === "#privacy" || location.hash === "#terms" || location.hash === "#refund") {
            history.replaceState(null, "", location.pathname + location.search);
        }
        if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
    }

    document.addEventListener("click", e => {
        const a = e.target.closest("[data-legal]");
        if (a) { e.preventDefault(); open(a.dataset.legal); }
    });
    tabs.forEach(t => t.addEventListener("click", () => show(t.dataset.tab)));
    document.getElementById("lgClose").addEventListener("click", close);
    modal.addEventListener("click", e => { if (e.target === modal) close(); });
    document.addEventListener("keydown", e => { if (e.key === "Escape") close(); });

    // direct links like  yoursite.com/#privacy
    const fromHash = () => { const k = location.hash.slice(1); if (titles[k]) open(k); };
    window.addEventListener("hashchange", fromHash);
    if (titles[location.hash.slice(1)]) setTimeout(fromHash, 600);
})();


/* ==========================================================================
   FARM SHOP — product popup
   Every size has its OWN quantity (e.g. 1 × 400 g + 2 × 700 g in one order).
   The WhatsApp message carries the product, sizes, quantities, note, name and
   the product PHOTO link.
   ========================================================================== */
(() => {
    // 👉 Owner's WhatsApp number (country code + number, no + or spaces)
    const WA_NUMBER = "919444060619";

    const modal = document.getElementById("productModal");
    const grid = document.getElementById("productsGrid");
    if (!modal || !grid) return;

    const $ = id => document.getElementById(id);
    const img = $("pmImg"), title = $("pmTitle"), tag = $("pmTag"), desc = $("pmDesc");
    const linesBox = $("pmLines"), qtyLabel = $("pmQtyLabel");
    const buy = $("pmBuy"), buyText = $("pmBuyText");
    const nameIn = $("pmName"), noteIn = $("pmNote"), summary = $("pmSummary");
    let current = null, lastFocus = null;

    const clamp = n => Math.min(99, Math.max(0, parseInt(n, 10) || 0));

    // Absolute link to the product photo. WhatsApp turns it into a picture preview
    // once the site is online (a local file:// page has no public address).
    function photoUrl(src) {
        let base;
        if (/^https?:$/.test(location.protocol)) base = location.href;
        else {
            const c = document.querySelector('link[rel="canonical"]');
            base = c ? c.href : "https://forestcafe.in/";
        }
        try { return new URL(src, base).href; } catch (_) { return src; }
    }

    function chosen() { return current.lines.filter(l => l.qty > 0); }

    function refresh() {
        const sel = chosen();
        const total = sel.reduce((n, l) => n + l.qty, 0);
        const single = current.lines.length === 1;

        if (!total) {
            summary.textContent = "Pick at least 1 to order";
            buyText.textContent = "Select a quantity";
            buy.classList.add("is-disabled");
            buy.setAttribute("aria-disabled", "true");
            buy.href = "#";
            return;
        }
        buy.classList.remove("is-disabled");
        buy.removeAttribute("aria-disabled");

        summary.textContent = current.name + " — " + sel.map(l => (single ? "" : l.label + " ") + "× " + l.qty).join(", ").replace(/^\s+/, "");
        buyText.textContent = "Send order on WhatsApp";

        const out = [
            "Hello Forest Cafe! 🌿",
            "I would like to order from your Farm Shop:",
            "",
            "🛒 *" + current.name + "*"
        ];
        if (single) out.push("🔢 Quantity: " + sel[0].qty);
        else sel.forEach(l => out.push("📦 " + l.label + " × " + l.qty));
        out.push("", "🖼️ Product photo:", photoUrl(current.img));
        const nm = nameIn.value.trim(), nt = noteIn.value.trim();
        if (nt) out.push("", "📝 Note: " + nt);
        if (nm) out.push("", "👤 Name: " + nm);
        out.push("", "Kindly confirm the price, availability and how I can collect it or have it delivered. Thank you! 🙏");
        buy.href = "https://wa.me/" + WA_NUMBER + "?text=" + encodeURIComponent(out.join("\n"));
    }

    function buildLines() {
        linesBox.innerHTML = "";
        const multi = current.lines.length > 1;
        qtyLabel.textContent = multi ? "Choose size & quantity" : "How many do you need?";
        current.lines.forEach((l, idx) => {
            const row = document.createElement("div");
            row.className = "pm-line" + (multi ? " is-multi" : "");
            const name = document.createElement("span");
            name.className = "pm-line-name";
            name.textContent = multi ? l.label : "Quantity";
            const step = document.createElement("div");
            step.className = "pm-qty";
            const minus = document.createElement("button"); minus.type = "button"; minus.textContent = "−"; minus.setAttribute("aria-label", "Decrease " + l.label);
            const inp = document.createElement("input"); inp.type = "number"; inp.min = "0"; inp.max = "99"; inp.inputMode = "numeric"; inp.value = l.qty; inp.setAttribute("aria-label", l.label + " quantity");
            const plus = document.createElement("button"); plus.type = "button"; plus.textContent = "+"; plus.setAttribute("aria-label", "Increase " + l.label);
            const set = v => { l.qty = clamp(v); inp.value = l.qty; row.classList.toggle("is-on", l.qty > 0); refresh(); };
            minus.addEventListener("click", () => set(l.qty - 1));
            plus.addEventListener("click", () => set(l.qty + 1));
            inp.addEventListener("input", () => { l.qty = clamp(inp.value); row.classList.toggle("is-on", l.qty > 0); refresh(); });
            inp.addEventListener("change", () => set(inp.value));
            step.append(minus, inp, plus);
            row.append(name, step);
            row.classList.toggle("is-on", l.qty > 0);
            linesBox.appendChild(row);
        });
    }

    function open(card) {
        const name = card.querySelector(".product-title").textContent.trim();
        const sizes = (card.dataset.variants || "").split("|").map(s => s.trim()).filter(Boolean);
        const src = card.querySelector("img");
        current = {
            name: name,
            img: src.getAttribute("src"),
            lines: (sizes.length ? sizes : ["Quantity"]).map((s, i) => ({ label: s, qty: i === 0 ? 1 : 0 }))
        };
        img.src = src.getAttribute("src");
        img.alt = src.alt || name;
        title.textContent = name;
        tag.textContent = card.querySelector(".product-weight").textContent.trim();
        desc.textContent = card.querySelector(".product-desc").textContent.trim();
        buildLines();
        refresh();
        lastFocus = document.activeElement;
        modal.classList.add("is-open");
        modal.setAttribute("aria-hidden", "false");
        window.fcSyncScroll();
        const panel = modal.querySelector(".pm-panel"); if (panel) panel.scrollTop = 0;
        setTimeout(() => { const f = linesBox.querySelector("input"); if (f) f.focus({ preventScroll: true }); }, 50);
    }

    function close() {
        if (!modal.classList.contains("is-open")) return;
        modal.classList.remove("is-open");
        modal.setAttribute("aria-hidden", "true");
        window.fcSyncScroll();
        if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
    }

    grid.addEventListener("click", e => {
        const card = e.target.closest(".product-card");
        if (card && !card.classList.contains("is-unavailable")) open(card);
    });
    grid.addEventListener("keydown", e => {
        if ((e.key === "Enter" || e.key === " ") && e.target.classList.contains("product-card")) {
            e.preventDefault(); open(e.target);
        }
    });
    buy.addEventListener("click", e => { if (buy.classList.contains("is-disabled")) e.preventDefault(); });
    nameIn.addEventListener("input", () => current && refresh());
    noteIn.addEventListener("input", () => current && refresh());
    $("pmClose").addEventListener("click", close);
    modal.addEventListener("click", e => { if (e.target === modal) close(); });
    document.addEventListener("keydown", e => { if (e.key === "Escape") close(); });
})();

/* ==========================================================================
   REVIEWS — spotlight + bubbles with 2s shuffle & 15s interaction pause
   ========================================================================== */
(() => {
    const root = document.getElementById("rvHang");
    const ring = document.getElementById("rvbRing");
    const big = document.getElementById("rvbBig");
    if (!root || !ring || !big) return;
    const dots = Array.from(ring.querySelectorAll(".rvb-dot"));
    const n = dots.length;
    const cur = document.getElementById("rvbCur");
    const hint = root.querySelector(".rvb-hint");
    const card = root.querySelector(".rvb-card");
    let i = 0;
    let autoTimer = null;
    let pauseTimer = null;

    function select(k, dir) {
        i = (k + n) % n;
        const src = dots[i].querySelector("img");
        big.src = src.getAttribute("src");
        big.alt = src.alt;
        big.style.setProperty("--from", ((dir || 0) * 46) + "px");
        big.classList.remove("is-pop"); void big.offsetWidth; big.classList.add("is-pop");
        dots.forEach((d, j) => d.setAttribute("aria-current", j === i ? "true" : "false"));
        cur.textContent = String(i + 1).padStart(2, "0");
        if (hint) hint.classList.add("is-off");
    }

    function startAutoLoop() {
        stopAutoLoop();
        autoTimer = setInterval(() => {
            select(i + 1, 1);
        }, 2000);
    }

    function stopAutoLoop() {
        if (autoTimer) {
            clearInterval(autoTimer);
            autoTimer = null;
        }
    }

    function handleUserInteraction(nextIndex, dir) {
        stopAutoLoop();
        if (pauseTimer) clearTimeout(pauseTimer);
        
        select(nextIndex, dir);

        // Wait 15 seconds to allow reading before resuming the 2s loop
        pauseTimer = setTimeout(() => {
            startAutoLoop();
        }, 15000);
    }

    // Direct click on any circle bubble brings that review to center
    dots.forEach((d, j) => {
        d.addEventListener("click", () => handleUserInteraction(j, j > i ? 1 : -1));
    });

    document.getElementById("rvbPrev").addEventListener("click", () => handleUserInteraction(i - 1, -1));
    document.getElementById("rvbNext").addEventListener("click", () => handleUserInteraction(i + 1, 1));
    
    root.addEventListener("keydown", e => {
        if (e.key === "ArrowRight") { e.preventDefault(); handleUserInteraction(i + 1, 1); }
        if (e.key === "ArrowLeft") { e.preventDefault(); handleUserInteraction(i - 1, -1); }
    });

    // Touch/drag swipe on the big center card
    let sx = 0, sy = 0, down = false;
    card.addEventListener("pointerdown", e => { down = true; sx = e.clientX; sy = e.clientY; });
    card.addEventListener("pointerup", e => {
        if (!down) return; down = false;
        const dx = e.clientX - sx, dy = e.clientY - sy;
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.3) {
            handleUserInteraction(i + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1);
        }
    });
    card.addEventListener("pointercancel", () => { down = false; });

    // Bubbles appear and loop begins once scrolled into view
    const enter = () => {
        root.classList.add("is-in");
        startAutoLoop();
    };

    if (!("IntersectionObserver" in window)) {
        enter();
    } else {
        const io = new IntersectionObserver((es, o) => {
            es.forEach(en => {
                if (en.isIntersecting) {
                    enter();
                    o.disconnect();
                }
            });
        }, { threshold: 0.12 });
        io.observe(root);
    }

    select(0, 0);
})();

/* ==========================================================================
   IMAGE SKELETONS — a soft shimmer while a photo loads, then a gentle fade-in
   (instead of an empty hole / sudden pop). Transparent artwork is skipped.
   ========================================================================== */
(() => {
    const SKIP = ".rvb, .ad-minion-perch-layer, .brand, .rv-head, .little-farmer-logo, .ad-board-image, .sts-media";
    const imgs = Array.from(document.querySelectorAll("img")).filter(im =>
        !im.complete && im.getAttribute("src") && !im.closest(SKIP));
    imgs.forEach(im => {
        im.setAttribute("data-skel", "");
        const done = () => {
            im.removeAttribute("data-skel");
            im.classList.add("img-in");
            im.removeEventListener("load", done);
            im.removeEventListener("error", fail);
        };
        const fail = () => { im.removeAttribute("data-skel"); };
        im.addEventListener("load", done);
        im.addEventListener("error", fail);
    });
})();


/* ==========================================================================
   TINY COT + STORY — make sure their entrance (.reveal) always fires on scroll
   (from the friend's files)
   ========================================================================== */
(function storyScrollReveals() {
    var revealElements = document.querySelectorAll('.ad-block.reveal, .stay-hero-split.reveal');
    if (!revealElements.length || !('IntersectionObserver' in window)) return;

    var observer = new IntersectionObserver(function (entries, obs) {
        entries.forEach(function (entry) {
            if (entry.isIntersecting) {
                entry.target.classList.add('is-in');
                obs.unobserve(entry.target);
            }
        });
    }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });

    revealElements.forEach(function (el) { observer.observe(el); });
})();


/* ==========================================================================
   SOIL TO SIP — video plays only while it is on screen; title board drops in;
   the board image is found whatever extension it was saved with.
   ========================================================================== */
(() => {
    const v = document.getElementById("stsVideo");
    const board = document.getElementById("stsBoard");
    if (!v) return;
    const media = v.closest(".sts-media");
    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // title board: try png → webp → jpg → jpeg until one exists
    if (board) {
        const exts = (board.dataset.exts || "png").split(",");
        const base = board.getAttribute("src").replace(/\.[a-z]+$/i, "");
        let k = 0;
        board.addEventListener("load", () => { board.style.opacity = ""; });
        board.addEventListener("error", () => { k++; if (k < exts.length) board.src = base + "." + exts[k]; });
    }

    const ready = () => media.classList.remove("is-loading");
    v.addEventListener("loadeddata", ready);
    v.addEventListener("playing", ready);
    v.addEventListener("error", ready, true);   // no video file → just show the dark backdrop + board
    if (v.readyState >= 2) ready();

    if (!("IntersectionObserver" in window)) { media.classList.add("is-in"); if (!reduce) v.play().catch(() => {}); return; }

    // start downloading a little before it scrolls in
    new IntersectionObserver((es, o) => {
        es.forEach(en => { if (en.isIntersecting) { v.preload = "auto"; o.disconnect(); } });
    }, { rootMargin: "700px 0px" }).observe(media);

    // play only while visible
    new IntersectionObserver(es => {
        es.forEach(en => {
            if (en.isIntersecting) {
                media.classList.add("is-in");
                if (!reduce) { const p = v.play(); if (p && p.catch) p.catch(() => {}); }
            } else if (!v.paused) v.pause();
        });
    }, { threshold: 0.25 }).observe(media);
})();

/* ==========================================================================
   CINEMA WORKS — Magnetic Deck (Cursor Speed Scatter + Spring Integration)
   ========================================================================== */
(() => {
    const toggleBtn = document.getElementById("cinemaToggle");
    const drawer = document.getElementById("cinemaStackWrap");
    const field = document.getElementById("mdField");
    const hub = document.getElementById("mdHub");
    if (!toggleBtn || !drawer || !field || !hub) return;

    const cardsEl = Array.from(hub.querySelectorAll(".md-card"));
    const count = cardsEl.length;

    // Accordion Toggle
    let isDrawerActive = false;
    toggleBtn.addEventListener("click", () => {
        isDrawerActive = drawer.classList.toggle("is-open");
        toggleBtn.setAttribute("aria-expanded", String(isDrawerActive));
        drawer.setAttribute("aria-hidden", String(!isDrawerActive));
        if (isDrawerActive) {
            measure();
            syncRest();
            field.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
    });

    // Physics Constants
    const PROXIMITY = 520;
    const PUSH = 4.2;
    const MAX_FORCE = 260;
    const TILT = 0.09;
    const NEIGHBOR = 0.22;
    const STIFFNESS = 0.052;
    const FRICTION = 0.86;
    const SPAN = 1080;

    // Automatically distribute rest positions evenly regardless of 4, 6, or more cards
    const spanWidth = Math.min(880, (count - 1) * 165);
    const startX = -spanWidth / 2;
    const stepX = count > 1 ? spanWidth / (count - 1) : 0;

    const POSE = {
        x: cardsEl.map((_, i) => startX + i * stepX),
        y: cardsEl.map((_, i) => (i % 2 === 0 ? 18 : -14)),
        rot: cardsEl.map((_, i) => {
            const progress = count > 1 ? (i / (count - 1)) * 2 - 1 : 0;
            return progress * 9 + (i % 2 === 0 ? -2 : 3);
        })
    };

    let fit = 1;
    function measure() {
        const fieldWidth = field.offsetWidth || window.innerWidth;
        fit = Math.min(1, fieldWidth / SPAN, 480 / 460);
        fit = Math.max(0.42, fit);
    }

    const deck = POSE.x.map((_, i) => ({
        restX: 0,
        restY: 0,
        restR: POSE.rot[i],
        x: 0,
        y: 0,
        r: POSE.rot[i],
        vx: 0,
        vy: 0,
        vr: 0,
        el: cardsEl[i]
    }));

    function syncRest() {
        deck.forEach((c, i) => {
            c.restX = POSE.x[i] * fit;
            c.restY = POSE.y[i] * fit;
        });
    }

    measure();
    syncRest();
    deck.forEach(c => {
        c.x = c.restX;
        c.y = c.restY;
    });

    const cursor = {
        x: -9999,
        y: -9999,
        lastX: -9999,
        lastY: -9999,
        vx: 0,
        vy: 0,
        primed: false
    };

    function onPointerMove(clientX, clientY) {
        if (!cursor.primed) {
            cursor.lastX = clientX;
            cursor.lastY = clientY;
            cursor.primed = true;
        }
        cursor.x = clientX;
        cursor.y = clientY;
    }

    field.addEventListener("pointermove", e => onPointerMove(e.clientX, e.clientY));
    field.addEventListener("pointerleave", () => {
        cursor.lastX = cursor.x;
        cursor.lastY = cursor.y;
        cursor.vx = 0;
        cursor.vy = 0;
    });

    // Touch support for phones
    field.addEventListener("touchmove", e => {
        if (e.touches.length > 0) {
            const t = e.touches[0];
            onPointerMove(t.clientX, t.clientY);
        }
    }, { passive: true });

    function getPushForce(c) {
        const speed = Math.hypot(cursor.vx, cursor.vy);
        if (speed < 0.5) return { fx: 0, fy: 0 };
        const r = hub.getBoundingClientRect();
        const cx = r.left + c.restX;
        const cy = r.top + c.restY;
        const dist = Math.hypot(cursor.x - cx, cursor.y - cy);
        const reach = PROXIMITY * fit;
        if (dist > reach) return { fx: 0, fy: 0 };
        const weight = Math.pow(1 - dist / reach, 3);
        const clampF = v => Math.min(180, Math.max(-180, v));
        return {
            fx: clampF(cursor.vx * PUSH * weight),
            fy: clampF(cursor.vy * PUSH * weight)
        };
    }

    function calculateForces() {
        const directForces = deck.map(getPushForce);
        return deck.map((_, i) => {
            let fx = directForces[i].fx;
            let fy = directForces[i].fy;
            directForces.forEach((f, j) => {
                if (j === i) return;
                const falloff = Math.pow(NEIGHBOR, Math.abs(j - i));
                fx += f.fx * falloff;
                fy += f.fy * falloff * 0.6;
            });
            return { fx, fy };
        });
    }

    // Virtual preview wander when user is idle
    let vt = 0;
    let idleFrames = 0;

    function tick() {
        if (isDrawerActive) {
            const dx = cursor.x - cursor.lastX;
            const dy = cursor.y - cursor.lastY;
            cursor.vx = cursor.vx * 0.6 + dx * 0.4;
            cursor.vy = cursor.vy * 0.6 + dy * 0.4;
            cursor.lastX = cursor.x;
            cursor.lastY = cursor.y;

            if (Math.hypot(dx, dy) < 0.1) idleFrames++; else idleFrames = 0;

            // Gentle virtual wave if idle for 2 seconds
            if (idleFrames > 120) {
                const r = field.getBoundingClientRect();
                vt += 0.016;
                const px = r.left + r.width * (0.5 + 0.38 * Math.sin(vt) * Math.cos(vt * 0.5));
                const py = r.top + r.height * (0.5 + 0.16 * Math.sin(vt * 1.6));
                onPointerMove(px, py);
            }

            const forces = calculateForces();
            for (let i = 0; i < count; i++) {
                const c = deck[i];
                const { fx, fy } = forces[i];
                c.vx = (c.vx + (c.restX + fx - c.x) * STIFFNESS) * FRICTION;
                c.vy = (c.vy + (c.restY + fy - c.y) * STIFFNESS) * FRICTION;
                c.vr = (c.vr + (c.restR + fx * TILT - c.r) * STIFFNESS) * FRICTION;
                c.x += c.vx;
                c.y += c.vy;
                c.r += c.vr;

                if (c.el) {
                    c.el.style.transform = `translate(-50%,-50%) translate(${c.x.toFixed(1)}px,${c.y.toFixed(1)}px) rotate(${c.r.toFixed(2)}deg) scale(${fit.toFixed(3)})`;
                    c.el.style.zIndex = i;
                }
            }
        }
        requestAnimationFrame(tick);
    }

    window.addEventListener("resize", () => {
        measure();
        syncRest();
    });

    requestAnimationFrame(tick);
})();
