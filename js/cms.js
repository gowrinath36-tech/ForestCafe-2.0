/*!
 * Forest Cafe — lightweight CMS
 *
 * How it works
 *  - Public site : loads  data/content.json  (if present) and applies ONLY the fields
 *                  that differ from the defaults below. Visitors never see drafts.
 *  - Dashboard   : edits are saved as a DRAFT in this browser (localStorage).
 *                  "Preview" shows the draft on the real site (index.html?preview=1).
 *                  "Download content.json" -> upload it to  data/content.json  on the host
 *                  to make the changes LIVE for everyone.
 *  - Later       : to remove the manual upload step, replace loadRemote()/ the download step
 *                  with a database call (Firebase / Supabase). The rest stays the same.
 */
(function () {
  'use strict';

  var DRAFT_KEY = 'forest-cafe-cms-draft-v2';
  var REMOTE_URL = 'data/content.json';

  // ---------- Defaults (what the HTML already contains) ----------
  var TEXT_DEFAULTS = {
    heroTitle: 'Coffee, farm and a place to stay',
    heroText: 'We grow it on the slope behind the kitchen, roast it here, and pour it while the mist is still coming off the hills.',
    aboutTitle: 'Forest Cafe',
    aboutText: 'We started in 2021 with four tables, an artisan roaster, and a slope full of coffee plants. Today, the same slope feeds our cafe kitchen, the farm counter, and the cozy cottages tucked behind the trees. Nothing travels far here\u2014everything is harvested fresh from the soil and served warm with love.',
    phoneText: '+91 94440 60619',
    phoneLink: 'tel:+919444060619',
    emailText: 'forestcafe.khilla@gmail.com',
    emailLink: 'mailto:forestcafe.khilla@gmail.com',
    instaLink: 'https://www.instagram.com/forestcafe.khills?utm_source=ig_web_button_share_sheet&stkn=ZDNlZDc0MzIxNw==',
    waLink: 'https://wa.me/919444060619?text=Hi%20Forest%20Cafe%2C%20I%20want%20to%20know%20more%20about%20your%20stay%20and%20cafe.',
    facebookLink: 'https://www.facebook.com/gc.anandhan',
    youtubeLink: 'https://www.youtube.com/@littlefarmer7566'
  };

  // Which text fields must be a particular kind of link
  var LINK_RULES = {
    phoneLink: /^tel:\+?[0-9\-\s]+$/i,
    emailLink: /^mailto:[^\s@]+@[^\s@]+\.[^\s@]+/i,
    instaLink: /^https:\/\//i,
    waLink: /^https:\/\//i,
    facebookLink: /^https:\/\//i,
    youtubeLink: /^https:\/\//i
  };

  // Farm-shop product cards (ids match data-id in index.html)
  var PRODUCTS = [
    { id: 'prod-1', name: 'Pure Coffee' },
    { id: 'prod-2', name: '70/30 Coffee Blend' },
    { id: 'prod-4', name: 'Tea Dust' },
    { id: 'prod-5', name: 'Honey' },
    { id: 'prod-6', name: 'Curry Leaf Powder' },
    { id: 'prod-7', name: 'Idli Podi' },
    { id: 'prod-8', name: 'Maa Inji Thokku' },
    { id: 'prod-9', name: 'Dal Powder' },
    { id: 'prod-10', name: 'Perandai Thokku' },
    { id: 'prod-11', name: 'Turmeric Powder' },
    { id: 'prod-12', name: 'Farm Fresh Avocado' }
  ];

  // Menu items (ids match data-item on each <li> in index.html)
  var MENU = [
    {
      "id": "hot",
      "label": "Hot",
      "items": [
        {
          "id": "hot-tea",
          "name": "Tea",
          "price": "₹20"
        },
        {
          "id": "hot-filter-coffee",
          "name": "Filter coffee",
          "price": "₹30"
        },
        {
          "id": "hot-cappuccino",
          "name": "Cappuccino",
          "price": "₹80"
        },
        {
          "id": "hot-dalgona-coffee",
          "name": "Dalgona coffee",
          "price": "₹90"
        },
        {
          "id": "hot-milk",
          "name": "Milk",
          "price": "₹25"
        },
        {
          "id": "hot-sukku-coffee",
          "name": "Sukku coffee",
          "price": "₹35"
        },
        {
          "id": "hot-boost",
          "name": "Boost",
          "price": "₹35"
        },
        {
          "id": "hot-horlicks",
          "name": "Horlicks",
          "price": "₹35"
        },
        {
          "id": "hot-lemon-tea",
          "name": "Lemon tea",
          "price": "₹25"
        },
        {
          "id": "hot-green-tea",
          "name": "Green tea",
          "price": "₹30"
        },
        {
          "id": "hot-black-tea",
          "name": "Black tea",
          "price": "₹20"
        }
      ]
    },
    {
      "id": "cool",
      "label": "Cool",
      "items": [
        {
          "id": "cool-cold-coffee",
          "name": "Cold coffee",
          "price": "₹90"
        },
        {
          "id": "cool-rose-milk",
          "name": "Rose milk",
          "price": "₹60"
        },
        {
          "id": "cool-badam-milk",
          "name": "Badam milk",
          "price": "₹70"
        },
        {
          "id": "cool-lime-juice",
          "name": "Lime juice",
          "price": "₹40"
        },
        {
          "id": "cool-lime-soda",
          "name": "Lime soda",
          "price": "₹50"
        },
        {
          "id": "cool-fresh-juice",
          "name": "Fresh juice",
          "price": "₹70"
        }
      ]
    },
    {
      "id": "brunch",
      "label": "Brunch",
      "items": [
        {
          "id": "brunch-chicken-roll",
          "name": "Chicken roll",
          "price": "₹120"
        },
        {
          "id": "brunch-paneer-roll",
          "name": "Paneer roll",
          "price": "₹110"
        },
        {
          "id": "brunch-bread-omelette",
          "name": "Bread omelette",
          "price": "₹70"
        },
        {
          "id": "brunch-veg-balls",
          "name": "Veg balls",
          "price": "₹80"
        },
        {
          "id": "brunch-sandwich",
          "name": "Sandwich",
          "price": "₹90"
        }
      ]
    },
    {
      "id": "cakes",
      "label": "Cake & cookies",
      "items": [
        {
          "id": "cakes-cup-cake",
          "name": "Cup cake",
          "price": "₹40"
        },
        {
          "id": "cakes-chocolate-cake",
          "name": "Chocolate cake",
          "price": "₹60"
        },
        {
          "id": "cakes-fruit-cake",
          "name": "Fruit cake",
          "price": "₹55"
        },
        {
          "id": "cakes-banana-cake",
          "name": "Banana cake",
          "price": "₹50"
        },
        {
          "id": "cakes-brownie",
          "name": "Brownie",
          "price": "₹70"
        }
      ]
    },
    {
      "id": "snacks",
      "label": "Sweets & snacks",
      "items": [
        {
          "id": "snacks-rasmalai",
          "name": "Rasmalai",
          "price": "₹60"
        },
        {
          "id": "snacks-banana-chips",
          "name": "Banana chips",
          "price": "₹40"
        },
        {
          "id": "snacks-butter-muruku",
          "name": "Butter muruku",
          "price": "₹40"
        },
        {
          "id": "snacks-thattai",
          "name": "Thattai",
          "price": "₹35"
        },
        {
          "id": "snacks-idli-powder",
          "name": "Idli powder",
          "price": "₹120"
        },
        {
          "id": "snacks-dhal-powder",
          "name": "Dhal powder",
          "price": "₹120"
        }
      ]
    },
    {
      "id": "fresh",
      "label": "Farm fresh",
      "items": [
        {
          "id": "fresh-honey-700-g",
          "name": "Honey (700 g)",
          "price": "₹420"
        },
        {
          "id": "fresh-ghee-250-ml",
          "name": "Ghee (250 ml)",
          "price": "₹380"
        },
        {
          "id": "fresh-coffee-powder-250-g",
          "name": "Coffee powder (250 g)",
          "price": "₹320"
        },
        {
          "id": "fresh-tea-powder-250-g",
          "name": "Tea powder (250 g)",
          "price": "₹180"
        },
        {
          "id": "fresh-seasonal-fruit-and-veg",
          "name": "Seasonal fruit & veg",
          "price": "Market rate"
        }
      ]
    }
  ];

  // ---------- Helpers ----------
  function formatPrice(v) {
    v = String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, '').trim().slice(0, 20);
    if (!v) return '';
    return /^\d+(\.\d{1,2})?$/.test(v) ? '\u20b9' + v : v;   // "25" -> "₹25", "Market rate" stays
  }

  var DEFAULT_PRICE = {};
  var MENU_IDS = {};
  MENU.forEach(function (cat) {
    cat.items.forEach(function (it) { DEFAULT_PRICE[it.id] = it.price; MENU_IDS[it.id] = true; });
  });
  var PRODUCT_IDS = {};
  PRODUCTS.forEach(function (p) { PRODUCT_IDS[p.id] = true; });

  function emptyContent() { return { version: 2, text: {}, prices: {}, unavailable: {} }; }

  // Accept only known keys / safe values (protects the site from a broken or edited JSON file)
  function clean(raw) {
    var out = emptyContent();
    if (!raw || typeof raw !== 'object') return out;
    var t = raw.text || {};
    Object.keys(TEXT_DEFAULTS).forEach(function (k) {
      if (typeof t[k] !== 'string') return;
      var v = t[k].trim().slice(0, 2000);
      if (!v) return;
      if (LINK_RULES[k] && !LINK_RULES[k].test(v)) return;
      out.text[k] = v;
    });
    var pr = raw.prices || {};
    Object.keys(pr).forEach(function (id) {
      if (!MENU_IDS[id]) return;
      var v = formatPrice(pr[id]);
      if (v) out.prices[id] = v;
    });
    var un = raw.unavailable || {};
    Object.keys(un).forEach(function (id) {
      if (PRODUCT_IDS[id] && un[id] === true) out.unavailable[id] = true;
    });
    if (typeof raw.updatedAt === 'string') out.updatedAt = raw.updatedAt.slice(0, 40);
    return out;
  }

  function isEmpty(c) {
    return !Object.keys(c.text).length && !Object.keys(c.prices).length && !Object.keys(c.unavailable).length;
  }

  // ---------- Storage ----------
  function loadDraft() {
    try {
      var raw = localStorage.getItem(DRAFT_KEY);
      return raw ? clean(JSON.parse(raw)) : null;
    } catch (e) { return null; }
  }
  function saveDraft(c) {
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(c)); return true; } catch (e) { return false; }
  }
  function clearDraft() {
    try { localStorage.removeItem(DRAFT_KEY); } catch (e) {}
  }

  // The "live" content. Swap this function for a Firebase/Supabase read when a database is added.
  function loadRemote() {
    if (typeof fetch !== 'function') return Promise.resolve({ found: false, content: emptyContent() });
    return fetch(REMOTE_URL, { cache: 'no-cache' })
      .then(function (res) { if (!res.ok) throw new Error('not found'); return res.json(); })
      .then(function (json) { return { found: true, content: clean(json) }; })
      .catch(function () { return { found: false, content: emptyContent() }; });
  }

  // ---------- Apply to the public site ----------
  function eff(content, key) {
    return Object.prototype.hasOwnProperty.call(content.text, key) ? content.text[key] : TEXT_DEFAULTS[key];
  }
  function has(content, key) { return Object.prototype.hasOwnProperty.call(content.text, key); }

  function setText(selector, value) {
    document.querySelectorAll(selector).forEach(function (n) { n.textContent = value; });
  }
  function setHref(selector, value) {
    document.querySelectorAll(selector).forEach(function (n) { n.setAttribute('href', value); });
  }

  function reorderProductCards() {
    var grid = document.getElementById('productsGrid');
    if (!grid) return;
    var cards = Array.prototype.slice.call(grid.querySelectorAll('.product-card[data-id]'));
    var avail = cards.filter(function (c) { return !c.classList.contains('is-unavailable'); });
    var gone = cards.filter(function (c) { return c.classList.contains('is-unavailable'); });
    avail.concat(gone).forEach(function (c) { grid.appendChild(c); });
  }

  function applyToSite(content) {
    ['heroTitle', 'heroText', 'aboutTitle', 'aboutText'].forEach(function (k) {
      if (has(content, k)) setText('[data-cms="' + k + '"]', content.text[k]);
    });

    if (has(content, 'phoneText') || has(content, 'phoneLink')) {
      document.querySelectorAll('[data-cms="phoneLink"]').forEach(function (n) {
        n.setAttribute('href', eff(content, 'phoneLink'));
        n.textContent = eff(content, 'phoneText');
      });
    }
    if (has(content, 'phoneLink')) setHref('[data-cms-href="phoneLink"]', content.text.phoneLink);

    if (has(content, 'emailText') || has(content, 'emailLink')) {
      document.querySelectorAll('[data-cms="emailLink"]').forEach(function (n) {
        n.setAttribute('href', eff(content, 'emailLink'));
        n.textContent = eff(content, 'emailText');
      });
    }
    if (has(content, 'instaLink')) setHref('[data-cms="instaLink"]', content.text.instaLink);
    if (has(content, 'waLink')) setHref('[data-cms="waLink"]', content.text.waLink);
    if (has(content, 'facebookLink')) setHref('[data-cms="facebookLink"]', content.text.facebookLink);
    if (has(content, 'youtubeLink')) setHref('[data-cms="youtubeLink"]', content.text.youtubeLink);

    // Menu prices
    Object.keys(content.prices).forEach(function (id) {
      var li = document.querySelector('#menu li[data-item="' + id + '"] .menu-price');
      if (li) li.textContent = formatPrice(content.prices[id]);
    });

    // Product availability
    document.querySelectorAll('.product-card[data-id]').forEach(function (card) {
      var off = !!content.unavailable[card.getAttribute('data-id')];
      card.classList.toggle('is-unavailable', off);
      var badge = card.querySelector('.product-badge--unavailable');
      if (off && !badge) {
        badge = document.createElement('span');
        badge.className = 'product-badge product-badge--unavailable';
        badge.textContent = 'Currently unavailable';
        card.insertBefore(badge, card.firstChild);
      } else if (!off && badge) {
        badge.remove();
      }
    });
    reorderProductCards();
  }

  function showPreviewBadge() {
    var b = document.createElement('div');
    b.textContent = 'Preview \u2014 draft changes (not live yet)';
    b.setAttribute('role', 'status');
    b.style.cssText = 'position:fixed;left:12px;bottom:12px;z-index:99999;background:#253c20;color:#fff;' +
      'padding:8px 14px;border-radius:999px;font:600 13px/1.2 system-ui,sans-serif;pointer-events:none;' +
      'box-shadow:0 6px 18px rgba(0,0,0,.25)';
    document.body.appendChild(b);
  }

  function initSite() {
    var preview = /(?:^|[?&])preview=1(?:&|$)/.test(location.search);
    loadRemote().then(function (r) {
      var content = r.content;
      if (preview) {
        var draft = loadDraft();
        if (draft) content = draft;
        showPreviewBadge();
      }
      applyToSite(content);
    });
  }

  // ---------- Dashboard ----------
  function $(id) { return document.getElementById(id); }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function buildMenuEditor() {
    var host = $('menuPriceEditor');
    if (!host) return;
    host.textContent = '';
    MENU.forEach(function (cat, idx) {
      var d = el('details', 'menu-cat');
      if (idx === 0) d.open = true;
      d.appendChild(el('summary', null, cat.label + ' (' + cat.items.length + ')'));
      cat.items.forEach(function (it) {
        var row = el('div', 'price-row');
        row.setAttribute('data-row', it.id);
        var lab = el('label', null, it.name);
        lab.setAttribute('for', 'price-' + it.id);
        var cur = el('span', 'price-default', 'now ' + it.price);
        var inp = document.createElement('input');
        inp.type = 'text';
        inp.id = 'price-' + it.id;
        inp.name = 'price:' + it.id;
        inp.maxLength = 20;
        inp.placeholder = it.price;
        inp.autocomplete = 'off';
        inp.setAttribute('inputmode', 'decimal');
        inp.addEventListener('input', function () { row.classList.toggle('is-changed', isPriceChanged(it.id, inp.value)); });
        row.appendChild(lab); row.appendChild(cur); row.appendChild(inp);
        d.appendChild(row);
      });
      host.appendChild(d);
    });
  }

  function isPriceChanged(id, value) {
    var v = formatPrice(value);
    return !!v && v !== DEFAULT_PRICE[id];
  }

  function buildProductEditor() {
    var host = $('productAvailabilityList');
    if (!host) return;
    host.textContent = '';
    PRODUCTS.forEach(function (p) {
      var row = el('div', 'product-toggle-row');
      var lab = el('label', null, p.name);
      lab.setAttribute('for', p.id);
      var cb = document.createElement('input');
      cb.type = 'checkbox'; cb.id = p.id; cb.name = p.id;
      row.appendChild(lab); row.appendChild(cb);
      host.appendChild(row);
    });
  }

  function fillForm(form, content) {
    Object.keys(TEXT_DEFAULTS).forEach(function (k) {
      var f = form.querySelector('[name="' + k + '"]');
      if (f) f.value = eff(content, k);
    });
    MENU.forEach(function (cat) {
      cat.items.forEach(function (it) {
        var inp = form.querySelector('[name="price:' + it.id + '"]');
        if (!inp) return;
        inp.value = content.prices[it.id] || '';
        var row = inp.closest('.price-row');
        if (row) row.classList.toggle('is-changed', isPriceChanged(it.id, inp.value));
      });
    });
    PRODUCTS.forEach(function (p) {
      var cb = form.querySelector('[name="' + p.id + '"]');
      if (cb) cb.checked = !!content.unavailable[p.id];
    });
  }

  // returns { content, errors }
  function readForm(form) {
    var c = emptyContent(), errors = [];
    Object.keys(TEXT_DEFAULTS).forEach(function (k) {
      var f = form.querySelector('[name="' + k + '"]');
      if (!f) return;
      var v = f.value.trim();
      if (!v || v === TEXT_DEFAULTS[k]) return;
      if (LINK_RULES[k] && !LINK_RULES[k].test(v)) {
        var lbl = form.querySelector('label[for="' + k + '"]');
        errors.push((lbl ? lbl.textContent : k) + ' is not a valid link');
        return;
      }
      c.text[k] = v.slice(0, 2000);
    });
    MENU.forEach(function (cat) {
      cat.items.forEach(function (it) {
        var inp = form.querySelector('[name="price:' + it.id + '"]');
        if (inp && isPriceChanged(it.id, inp.value)) c.prices[it.id] = formatPrice(inp.value);
      });
    });
    PRODUCTS.forEach(function (p) {
      var cb = form.querySelector('[name="' + p.id + '"]');
      if (cb && cb.checked) c.unavailable[p.id] = true;
    });
    return { content: c, errors: errors };
  }

  function initDashboard() {
    var form = $('cmsForm');
    if (!form) return;
    var statusEl = $('formStatus');
    var liveChip = $('liveState');
    var draftChip = $('draftState');
    var remoteState = { found: false, content: emptyContent() };

    function say(msg, bad) {
      statusEl.textContent = msg;
      statusEl.classList.toggle('is-error', !!bad);
    }
    function refreshChips() {
      var d = loadDraft();
      liveChip.textContent = remoteState.found
        ? 'Live file: data/content.json found' + (remoteState.content.updatedAt ? ' (updated ' + new Date(remoteState.content.updatedAt).toLocaleString() + ')' : '')
        : 'Live file: none yet \u2014 the site shows its built-in values';
      liveChip.classList.toggle('ok', remoteState.found);
      draftChip.textContent = d ? 'Draft: saved on this device (not live)' : 'Draft: none';
      draftChip.classList.toggle('ok', !!d);
    }
    function commit() {
      var r = readForm(form);
      if (r.errors.length) { say(r.errors.join('. ') + '.', true); return null; }
      r.content.updatedAt = new Date().toISOString();
      if (!saveDraft(r.content)) { say('Could not save the draft in this browser (storage blocked).', true); return null; }
      refreshChips();
      return r.content;
    }

    buildMenuEditor();
    buildProductEditor();

    loadRemote().then(function (r) {
      remoteState = r;
      fillForm(form, loadDraft() || r.content);
      refreshChips();
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (commit()) say('Draft saved. Click "Preview" to check it, then "Download content.json" to publish.');
    });

    $('downloadBtn').addEventListener('click', function () {
      var c = commit();
      if (!c) return;
      var blob = new Blob([JSON.stringify(c, null, 2)], { type: 'application/json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'content.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
      say('content.json downloaded. Upload it to the "data" folder of the website (replace the old one) to make it live.');
    });

    $('importFile').addEventListener('change', function (e) {
      var file = e.target.files && e.target.files[0];
      if (!file) return;
      var rd = new FileReader();
      rd.onload = function () {
        try {
          fillForm(form, clean(JSON.parse(String(rd.result))));
          say('File loaded into the form. Review it and click "Save draft".');
        } catch (err) { say('That file is not a valid content.json.', true); }
        e.target.value = '';
      };
      rd.readAsText(file);
    });

    $('discardBtn').addEventListener('click', function () {
      clearDraft();
      fillForm(form, remoteState.content);
      refreshChips();
      say('Draft discarded. The form now shows the live version.');
    });

    $('resetBtn').addEventListener('click', function () {
      fillForm(form, emptyContent());
      say('Form set to the original built-in values. Click "Save draft" to keep this.');
    });
  }

  // ---------- Boot ----------
  var page = document.body && document.body.dataset.page;
  if (page === 'site') initSite();
  if (page === 'cms') initDashboard();
})();
