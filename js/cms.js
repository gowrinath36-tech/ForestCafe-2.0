/*!
 * Forest Cafe - lightweight CMS (v4: database + product prices + photo upload)
 *
 * How it works
 *  - Public site : reads the live content from the Firebase database (Firestore, public read),
 *                  falls back to data/content.json, then to the values already inside index.html.
 *                  The last good content is cached in the visitor's browser so the page does not flash.
 *  - Dashboard   : owner signs in (Firebase Auth, email + password), edits, saves a DRAFT in this browser,
 *                  previews it on the real site (index.html?preview=1) and clicks "Publish live".
 *  - Config      : all Firebase keys live in js/firebase-config.js (dummy values until you paste your own).
 *  - Photos      : owner uploads a photo in the dashboard, the browser resizes it and converts it to WebP,
 *                  and it is stored in Firestore (collection site_images, no paid plan / card needed).
 *                  The public site swaps the original picture for the uploaded one.
 *  - No SDK      : only plain fetch() calls to the Firebase REST APIs, so the public site stays light.
 */
(function () {
  'use strict';

  var DRAFT_KEY = 'forest-cafe-cms-draft-v3';
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
    youtubeLink: 'https://www.youtube.com/@littlefarmer7566',
    articlesLink: 'https://youtu.be/eIyFTAxdrBU?si=4svOQqrR1IsJ4Aq6',
    blogLink: 'https://share.google/BjJ4MvuVcu1KMHwNC'
  };

  // Which text fields must be a particular kind of link
  var LINK_RULES = {
    phoneLink: /^tel:\+?[0-9\-\s]+$/i,
    emailLink: /^mailto:[^\s@]+@[^\s@]+\.[^\s@]+/i,
    instaLink: /^https:\/\//i,
    waLink: /^https:\/\//i,
    facebookLink: /^https:\/\//i,
    youtubeLink: /^https:\/\//i,
    articlesLink: /^https:\/\//i,
    blogLink: /^https:\/\//i
  };

  // Farm-shop product cards (ids match data-id in index.html).
  // `sizes` must match the data-variants="400 g|700 g" of that card: each size gets its own price.
  var PRODUCTS = [
    { id: 'prod-1', name: 'Pure Coffee' },
    { id: 'prod-2', name: '70/30 Coffee Blend' },
    { id: 'prod-4', name: 'Tea Dust' },
    { id: 'prod-5', name: 'Honey', sizes: ['400 g', '700 g'] },
    { id: 'prod-6', name: 'Curry Leaf Powder' },
    { id: 'prod-7', name: 'Idli Podi' },
    { id: 'prod-8', name: 'Maa Inji Thokku' },
    { id: 'prod-9', name: 'Dal Powder' },
    { id: 'prod-10', name: 'Perandai Thokku' },
    { id: 'prod-11', name: 'Turmeric Powder' },
    { id: 'prod-12', name: 'Farm Fresh Avocado' }
  ];

  // Photos the owner can replace from the dashboard. `path` is the picture that ships inside the website folder.
  var PHOTOS = [
    { group: 'Cafe photos', path: 'images/cafe/1.webp',  label: 'Seating area (home slider)' },
    { group: 'Cafe photos', path: 'images/cafe/2.webp',  label: 'Coffee being poured (home slider)' },
    { group: 'Cafe photos', path: 'images/cafe/9.webp',  label: 'View from the deck (home slider)' },
    { group: 'Cafe photos', path: 'images/cafe/8.webp',  label: 'Interior corner (home slider)' },
    { group: 'Cafe photos', path: 'images/cafe/5.webp',  label: 'Surroundings (home slider)' },
    { group: 'Cafe photos', path: 'images/cafe/15.webp', label: 'Tables by the window (gallery)' },
    { group: 'Cafe photos', path: 'images/cafe/16.webp', label: 'Garden path (gallery)' },
    { group: 'Cafe photos', path: 'images/cafe/6.webp',  label: 'Evening at the cafe (gallery)' },
    { group: 'Cafe photos', path: 'images/cafe/12.webp', label: 'Hillside behind the cafe (gallery)' },
    { group: 'Tiny Cot photos', path: 'images/rooms/1.webp', label: 'Bedroom Retreat' },
    { group: 'Tiny Cot photos', path: 'images/rooms/2.webp', label: 'Central Hall' },
    { group: 'Tiny Cot photos', path: 'images/rooms/6.webp', label: 'Cozy Steps Lounge' },
    { group: 'Tiny Cot photos', path: 'images/rooms/3.webp', label: 'Forest Glade' },
    { group: 'Tiny Cot photos', path: 'images/rooms/4.webp', label: 'Front Terrace' },
    { group: 'Tiny Cot photos', path: 'images/rooms/5.webp', label: 'Garden Deck' },
    { group: 'Tiny Cot photos', path: 'images/rooms/item15.webp', label: 'Tiny Cot main picture' }
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
  function priceNum(s) {
    var m = /^\u20b9\s*(\d+(?:\.\d{1,2})?)$/.exec(String(s || '').trim());
    return m ? parseFloat(m[1]) : null;
  }
  function money(n) { return '\u20b9' + (n % 1 ? n.toFixed(2) : String(n)); }
  window.fcPriceNum = priceNum;
  window.fcMoney = money;

  var DEFAULT_PRICE = {};
  var MENU_IDS = {};
  MENU.forEach(function (cat) {
    cat.items.forEach(function (it) { DEFAULT_PRICE[it.id] = it.price; MENU_IDS[it.id] = true; });
  });

  // Farm-shop price keys: "prod-1" for one-size products, "prod-5|400 g" for sized ones
  function priceKey(pid, size) { return size ? pid + '|' + size : pid; }
  function productKeys(p) {
    return (p.sizes && p.sizes.length) ? p.sizes.map(function (s) { return priceKey(p.id, s); }) : [p.id];
  }
  var PRODUCT_IDS = {};
  var PRODUCT_PRICE_KEYS = {};
  PRODUCTS.forEach(function (p) {
    PRODUCT_IDS[p.id] = true;
    productKeys(p).forEach(function (k) { PRODUCT_PRICE_KEYS[k] = true; });
  });

  window.fcGetPrice = function (id, size) {
    var map = window.FC_PRODUCT_PRICES || {};
    return map[priceKey(id, size)] || '';
  };

  var PHOTO_IDS = {};
  PHOTOS.forEach(function (ph) { PHOTO_IDS[ph.path] = true; });

  function emptyContent() { return { version: 4, text: {}, prices: {}, productPrices: {}, images: {}, unavailable: {} }; }

  // Accept only known keys / safe values (protects the site from a broken or edited JSON)
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
    var pp = raw.productPrices || {};
    Object.keys(pp).forEach(function (k) {
      if (!PRODUCT_PRICE_KEYS[k]) return;
      var v = formatPrice(pp[k]);
      if (v) out.productPrices[k] = v;
    });
    var im = raw.images || {};
    Object.keys(im).forEach(function (path) {
      // value = id of a document in site_images ("draft-..." = a photo still waiting in the dashboard's browser)
      if (PHOTO_IDS[path] && typeof im[path] === 'string' && /^(?:draft-)?[a-z0-9]{6,40}$/.test(im[path])) out.images[path] = im[path];
    });
    var un = raw.unavailable || {};
    Object.keys(un).forEach(function (id) {
      if (PRODUCT_IDS[id] && un[id] === true) out.unavailable[id] = true;
    });
    if (typeof raw.updatedAt === 'string') out.updatedAt = raw.updatedAt.slice(0, 40);
    return out;
  }

  // ---------- Browser storage (draft + cache) ----------
  var CACHE_KEY = 'forest-cafe-content-cache-v1';
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
  function loadCache() {
    try {
      var raw = localStorage.getItem(CACHE_KEY);
      return raw ? clean(JSON.parse(raw)) : null;
    } catch (e) { return null; }
  }
  function saveCache(c) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(c)); } catch (e) {}
  }

  // ---------- Firebase (REST, no SDK) ----------
  // Keys come from js/firebase-config.js. While they are still the DUMMY values, the DB is skipped.
  var CFG = window.FOREST_FIREBASE || {};
  var DB_READY = !!(CFG.apiKey && CFG.projectId && !/DUMMY|YOUR_/i.test(String(CFG.apiKey) + String(CFG.projectId)));
  var KEY_QS = 'key=' + encodeURIComponent(CFG.apiKey || '');

  function docUrl() {
    return 'https://firestore.googleapis.com/v1/projects/' + encodeURIComponent(CFG.projectId) +
      '/databases/(default)/documents/' + (CFG.collection || 'site') + '/' + (CFG.docId || 'content');
  }

  function fetchT(url, opts, ms) {
    opts = opts || {};
    if (typeof AbortController === 'undefined') return fetch(url, opts);
    var ctl = new AbortController();
    var timer = setTimeout(function () { ctl.abort(); }, ms || 8000);
    opts.signal = ctl.signal;
    return fetch(url, opts).then(
      function (r) { clearTimeout(timer); return r; },
      function (e) { clearTimeout(timer); throw e; }
    );
  }

  function loadFromDb() {
    if (!DB_READY || typeof fetch !== 'function') return Promise.reject(new Error('db not configured'));
    return fetchT(docUrl() + '?' + KEY_QS, { cache: 'no-store' })
      .then(function (res) {
        if (res.status === 404) return null;          // nothing published yet
        if (!res.ok) throw new Error('db ' + res.status);
        return res.json();
      })
      .then(function (doc) {
        var f = (doc && doc.fields) || {};
        var raw = f.json && f.json.stringValue ? JSON.parse(f.json.stringValue) : null;
        return { found: !!raw, content: clean(raw), source: 'database' };
      });
  }

  function loadFromFile() {
    if (typeof fetch !== 'function') return Promise.resolve({ found: false, content: emptyContent() });
    return fetch(REMOTE_URL, { cache: 'no-cache' })
      .then(function (res) { if (!res.ok) throw new Error('not found'); return res.json(); })
      .then(function (json) { return { found: true, content: clean(json), source: 'file' }; })
      .catch(function () { return { found: false, content: emptyContent() }; });
  }

  // The "live" content: database first, then data/content.json, then nothing (built-in values stay)
  function loadRemote() {
    return loadFromDb()
      .catch(function () { return { found: false }; })
      .then(function (r) { return r && r.found ? r : loadFromFile(); });
  }

  // ----- owner sign-in + publish (dashboard only) -----
  var SESSION_KEY = 'forest-cafe-cms-session';
  var session = null;
  function readSession() {
    try {
      var s = JSON.parse(sessionStorage.getItem(SESSION_KEY));
      return s && s.refreshToken ? s : null;
    } catch (e) { return null; }
  }
  function storeSession(s) {
    session = s;
    try {
      if (s) sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
      else sessionStorage.removeItem(SESSION_KEY);
    } catch (e) {}
  }
  function friendlyAuthError(code) {
    code = String(code || '');
    if (/EMAIL_NOT_FOUND|INVALID_PASSWORD|INVALID_LOGIN_CREDENTIALS|INVALID_EMAIL/.test(code)) return 'Wrong email or password.';
    if (/TOO_MANY_ATTEMPTS/.test(code)) return 'Too many attempts. Please wait a few minutes and try again.';
    if (/USER_DISABLED/.test(code)) return 'This account is disabled.';
    return 'Could not sign in. Check your internet and try again.';
  }
  function jsonResult(res) { return res.json().catch(function () { return {}; }).then(function (j) { return { ok: res.ok, j: j }; }); }

  function signIn(email, password) {
    return fetchT('https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?' + KEY_QS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email, password: password, returnSecureToken: true })
    }, 12000).then(jsonResult).then(function (r) {
      if (!r.ok) throw new Error(friendlyAuthError(r.j && r.j.error && r.j.error.message));
      storeSession({
        idToken: r.j.idToken,
        refreshToken: r.j.refreshToken,
        expiresAt: Date.now() + (parseInt(r.j.expiresIn, 10) || 3600) * 1000 - 60000,
        email: r.j.email
      });
      return session;
    }, function () { throw new Error(friendlyAuthError('')); });
  }

  function getToken() {
    if (!session) session = readSession();
    if (!session) return Promise.reject(new Error('Please sign in again.'));
    if (session.idToken && Date.now() < session.expiresAt) return Promise.resolve(session.idToken);
    return fetchT('https://securetoken.googleapis.com/v1/token?' + KEY_QS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'grant_type=refresh_token&refresh_token=' + encodeURIComponent(session.refreshToken)
    }, 12000).then(jsonResult).then(function (r) {
      if (!r.ok) { storeSession(null); throw new Error('Session expired. Please sign in again.'); }
      storeSession({
        idToken: r.j.id_token,
        refreshToken: r.j.refresh_token,
        expiresAt: Date.now() + (parseInt(r.j.expires_in, 10) || 3600) * 1000 - 60000,
        email: session.email
      });
      return session.idToken;
    });
  }

  function signOut() { storeSession(null); }

  // Stores the whole content as ONE json string field (simple, and keeps the public read tiny)
  function publishToDb(content) {
    return getToken().then(function (token) {
      var body = { fields: {
        json: { stringValue: JSON.stringify(content) },
        updatedAt: { stringValue: content.updatedAt || new Date().toISOString() }
      } };
      return fetchT(docUrl() + '?updateMask.fieldPaths=json&updateMask.fieldPaths=updatedAt&' + KEY_QS, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify(body)
      }, 15000);
    }).then(function (res) {
      if (res.ok) return true;
      var st = res.status;
      throw new Error(st === 403 ? 'Not allowed to publish. Check the Firestore rules and the owner UID.'
        : st === 401 ? 'Session expired. Please sign in again.'
        : 'Database error (' + st + '). Please try again.');
    });
  }

  // ---------- Photos: storage, cache, upload ----------
  function imgDocUrl(id) {
    return 'https://firestore.googleapis.com/v1/projects/' + encodeURIComponent(CFG.projectId) +
      '/databases/(default)/documents/site_images/' + encodeURIComponent(id);
  }
  function isDraftId(id) { return /^draft-/.test(id || ''); }
  function newImageId() { return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

  function b64ToBlob(b64, type) {
    var bin = atob(b64), arr = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: type || 'image/webp' });
  }
  function blobToB64(blob) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () { resolve(String(r.result).split(',')[1] || ''); };
      r.onerror = function () { reject(r.error); };
      r.readAsDataURL(blob);
    });
  }

  // Draft photos live in IndexedDB (same browser only, so only the owner can preview them)
  var IDB_NAME = 'forest-cafe-cms', IDB_STORE = 'draft-photos';
  function idbOpen() {
    return new Promise(function (resolve, reject) {
      if (!window.indexedDB) { reject(new Error('IndexedDB is not available')); return; }
      var rq = indexedDB.open(IDB_NAME, 1);
      rq.onupgradeneeded = function () { rq.result.createObjectStore(IDB_STORE); };
      rq.onsuccess = function () { resolve(rq.result); };
      rq.onerror = function () { reject(rq.error); };
    });
  }
  function idbDo(mode, fn) {
    return idbOpen().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(IDB_STORE, mode), out = fn(tx.objectStore(IDB_STORE));
        tx.oncomplete = function () { db.close(); resolve(out && 'result' in out ? out.result : undefined); };
        tx.onerror = tx.onabort = function () { db.close(); reject(tx.error); };
      });
    });
  }
  function idbPut(key, blob) { return idbDo('readwrite', function (st) { st.put(blob, key); }); }
  function idbGet(key) { return idbDo('readonly', function (st) { return st.get(key); }); }
  function idbClear() { return idbDo('readwrite', function (st) { st.clear(); }).catch(function () {}); }

  var IMG_CACHE = 'forest-cafe-img-v1';
  var imgUrlPromises = {};

  function fetchImageBlob(id) {
    return fetchT(imgDocUrl(id) + '?' + KEY_QS, { cache: 'no-store' }, 25000)
      .then(function (res) { if (!res.ok) throw new Error('photo ' + res.status); return res.json(); })
      .then(function (doc) {
        var f = (doc && doc.fields) || {};
        if (!f.data || !f.data.stringValue) throw new Error('photo empty');
        return b64ToBlob(f.data.stringValue, f.type && f.type.stringValue);
      });
  }

  // id -> object URL. Published photos are kept in the browser Cache, so a repeat visit needs no database read.
  function getImageUrl(id) {
    if (imgUrlPromises[id]) return imgUrlPromises[id];
    var key = '/__fc_img/' + id, p;
    if (isDraftId(id)) {
      p = idbGet(id).then(function (b) { if (!b) throw new Error('draft photo missing'); return URL.createObjectURL(b); });
    } else {
      var viaNet = function () { return fetchImageBlob(id); };
      var blobP = window.caches
        ? caches.open(IMG_CACHE).then(function (c) {
            return c.match(key).then(function (hit) {
              if (hit) return hit.blob();
              return fetchImageBlob(id).then(function (blob) {
                try { c.put(key, new Response(blob, { headers: { 'Content-Type': blob.type } })); } catch (e) {}
                return blob;
              });
            });
          }).catch(viaNet)
        : viaNet();
      p = blobP.then(function (b) { return URL.createObjectURL(b); });
    }
    imgUrlPromises[id] = p;
    p.catch(function () { delete imgUrlPromises[id]; });
    return p;
  }

  function pruneImageCache(map) {
    if (!window.caches) return;
    var keep = {};
    Object.keys(map || {}).forEach(function (k) { keep['/__fc_img/' + map[k]] = true; });
    caches.open(IMG_CACHE).then(function (c) {
      return c.keys().then(function (reqs) {
        reqs.forEach(function (rq) { if (!keep[new URL(rq.url).pathname]) c.delete(rq); });
      });
    }).catch(function () {});
  }

  // Resize (max 1600 px) + convert to WebP in the browser, so every photo stays small and fast.
  var MAX_SIDE = 1600, TARGET_BYTES = 560 * 1024, HARD_BYTES = 700 * 1024;
  function loadBitmap(file) {
    var viaImg = function () {
      return new Promise(function (resolve, reject) {
        var u = URL.createObjectURL(file), im = new Image();
        im.onload = function () { URL.revokeObjectURL(u); resolve(im); };
        im.onerror = function () { URL.revokeObjectURL(u); reject(new Error('This file is not a readable image.')); };
        im.src = u;
      });
    };
    if (window.createImageBitmap) return createImageBitmap(file, { imageOrientation: 'from-image' }).catch(viaImg);
    return viaImg();
  }
  function canvasBlob(canvas, type, q) {
    return new Promise(function (resolve) { canvas.toBlob(function (b) { resolve(b); }, type, q); });
  }
  function processImage(file) {
    if (!file || !/^image\//.test(file.type)) return Promise.reject(new Error('Please choose a photo (JPG, PNG or WebP).'));
    if (file.size > 30 * 1024 * 1024) return Promise.reject(new Error('That photo is too big (max 30 MB).'));
    return loadBitmap(file).then(function (bmp) {
      var w = bmp.width || bmp.naturalWidth, h = bmp.height || bmp.naturalHeight;
      var scale = Math.min(1, MAX_SIDE / Math.max(w, h)), q = 0.82, tries = 0;
      function run() {
        var cw = Math.max(1, Math.round(w * scale)), ch = Math.max(1, Math.round(h * scale));
        var cv = document.createElement('canvas');
        cv.width = cw; cv.height = ch;
        cv.getContext('2d').drawImage(bmp, 0, 0, cw, ch);
        return canvasBlob(cv, 'image/webp', q).then(function (b) {
          if (!b || b.type !== 'image/webp') return canvasBlob(cv, 'image/jpeg', q);   // browser cannot write WebP (e.g. Safari)
          return b;
        }).then(function (b) {
          if (!b) throw new Error('Could not convert this photo.');
          if (b.size <= TARGET_BYTES || tries >= 8) {
            if (b.size > HARD_BYTES) throw new Error('This photo is too detailed to shrink. Please pick a smaller one.');
            return { blob: b, width: cw, height: ch };
          }
          tries++;
          if (q > 0.62) q -= 0.06; else scale *= 0.85;
          return run();
        });
      }
      return run();
    });
  }

  function publishImage(id, b64, type) {
    return getToken().then(function (token) {
      var body = { fields: { data: { stringValue: b64 }, type: { stringValue: type || 'image/webp' } } };
      return fetchT(imgDocUrl(id) + '?updateMask.fieldPaths=data&updateMask.fieldPaths=type&' + KEY_QS, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify(body)
      }, 60000);
    }).then(function (res) {
      if (res.ok) return true;
      throw new Error(res.status === 403
        ? 'Not allowed to upload photos. Publish the latest firestore.rules in the Firebase console first.'
        : 'Photo upload failed (' + res.status + '). Please try again.');
    });
  }
  function deleteImage(id) {
    return getToken().then(function (token) {
      return fetchT(imgDocUrl(id) + '?' + KEY_QS, { method: 'DELETE', headers: { 'Authorization': 'Bearer ' + token } }, 15000);
    }).catch(function () {});
  }

  // Uploads every photo that is still a draft, rewrites content.images with the new ids
  function publishPhotos(content, progress) {
    var slots = Object.keys(content.images).filter(function (k) { return isDraftId(content.images[k]); });
    var chain = Promise.resolve(), n = 0;
    slots.forEach(function (slot) {
      chain = chain.then(function () {
        n++;
        progress('Uploading photo ' + n + ' of ' + slots.length + '\u2026');
        return idbGet(content.images[slot]).then(function (blob) {
          if (!blob) throw new Error('A new photo is no longer in this browser. Please choose it again.');
          return blobToB64(blob).then(function (b64) {
            var id = newImageId();
            return publishImage(id, b64, blob.type).then(function () { content.images[slot] = id; saveDraft(content); });
          });
        });
      });
    });
    return chain;
  }

  // ---------- Apply to the public site ----------
  function eff(content, key) {
    return Object.prototype.hasOwnProperty.call(content.text, key) ? content.text[key] : TEXT_DEFAULTS[key];
  }
  function has(content, key) { return Object.prototype.hasOwnProperty.call(content.text, key); }

  // Remember what index.html originally had, so removing a change in the dashboard really reverts it
  var ORIG = (typeof WeakMap === 'function') ? new WeakMap() : null;
  function orig(n) {
    if (!ORIG) return { html: n.innerHTML, href: n.getAttribute('href') };
    var o = ORIG.get(n);
    if (!o) { o = { html: n.innerHTML, href: n.getAttribute('href') }; ORIG.set(n, o); }
    return o;
  }
  function each(selector, fn) { document.querySelectorAll(selector).forEach(fn); }
  function setText(selector, value) { each(selector, function (n) { orig(n); n.textContent = value; }); }
  function restoreText(selector) { each(selector, function (n) { if (ORIG && ORIG.has(n)) n.innerHTML = ORIG.get(n).html; }); }
  function setHref(selector, value) { each(selector, function (n) { orig(n); n.setAttribute('href', value); }); }
  function restoreHref(selector) {
    each(selector, function (n) {
      if (ORIG && ORIG.has(n) && ORIG.get(n).href != null) n.setAttribute('href', ORIG.get(n).href);
    });
  }

  // ---- uploaded photos ----
  var SLOT_URL = {};
  var imageMapNow = {};
  window.fcImg = function (path) { return SLOT_URL[path] || path; };

  function paintSlot(path) {
    var url = SLOT_URL[path] || path;
    each('img[data-fc-src]', function (n) {
      if (n.getAttribute('data-fc-src') === path && n.getAttribute('src') !== url) n.setAttribute('src', url);
    });
  }
  function applyImages(map) {
    imageMapNow = map || {};
    each('img[src]', function (n) {                       // remember which picture each <img> originally was
      var src = n.getAttribute('src');
      if (!n.hasAttribute('data-fc-src') && PHOTO_IDS[src]) n.setAttribute('data-fc-src', src);
    });
    PHOTOS.forEach(function (ph) {
      var id = imageMapNow[ph.path];
      if (!id) {
        if (SLOT_URL[ph.path]) { delete SLOT_URL[ph.path]; paintSlot(ph.path); }
        return;
      }
      getImageUrl(id).then(function (url) {
        if (imageMapNow[ph.path] !== id) return;           // a newer content arrived meanwhile
        SLOT_URL[ph.path] = url;
        paintSlot(ph.path);
      }, function () { /* keep the original picture */ });
    });
  }

  function reorderProductCards() {
    var grid = document.getElementById('productsGrid');
    if (!grid) return;
    var cards = Array.prototype.slice.call(grid.querySelectorAll('.product-card[data-id]'));
    var avail = cards.filter(function (c) { return !c.classList.contains('is-unavailable'); });
    var gone = cards.filter(function (c) { return c.classList.contains('is-unavailable'); });
    avail.concat(gone).forEach(function (c) { grid.appendChild(c); });
  }

  // Text shown on the product card: one price, or a range for sized products
  function cardPriceText(p, map) {
    var vals = [];
    productKeys(p).forEach(function (k) { if (map[k]) vals.push(map[k]); });
    if (!vals.length) return '';
    var nums = vals.map(priceNum).filter(function (n) { return n != null; });
    if (nums.length === vals.length) {
      var mn = Math.min.apply(null, nums), mx = Math.max.apply(null, nums);
      return mn === mx ? money(mn) : money(mn) + ' \u2013 ' + money(mx);
    }
    return vals[0];
  }

  function applyToSite(content) {
    ['heroTitle', 'heroText', 'aboutTitle', 'aboutText'].forEach(function (k) {
      var sel = '[data-cms="' + k + '"]';
      if (has(content, k)) setText(sel, content.text[k]); else restoreText(sel);
    });

    // phone (text + link on the same element)
    var phoneSel = '[data-cms="phoneLink"]';
    if (has(content, 'phoneText') || has(content, 'phoneLink')) {
      each(phoneSel, function (n) {
        orig(n);
        n.setAttribute('href', eff(content, 'phoneLink'));
        n.textContent = eff(content, 'phoneText');
      });
    } else { restoreText(phoneSel); restoreHref(phoneSel); }

    // email (text + link on the same element)
    var emailSel = '[data-cms="emailLink"]';
    if (has(content, 'emailText') || has(content, 'emailLink')) {
      each(emailSel, function (n) {
        orig(n);
        n.setAttribute('href', eff(content, 'emailLink'));
        n.textContent = eff(content, 'emailText');
      });
    } else { restoreText(emailSel); restoreHref(emailSel); }

    // plain links
    ['phoneLink', 'instaLink', 'waLink', 'facebookLink', 'youtubeLink', 'articlesLink', 'blogLink'].forEach(function (k) {
      var sel = '[data-cms-href="' + k + '"]' + (k === 'phoneLink' ? '' : ', [data-cms="' + k + '"]');
      if (has(content, k)) setHref(sel, content.text[k]); else restoreHref(sel);
    });

    // every other wa.me link on the page (stay booking, art classes, bottom bar) keeps its own message,
    // but follows the WhatsApp number set in the dashboard
    var m = has(content, 'waLink') ? /wa\.me\/(\d+)/.exec(content.text.waLink) : null;
    var waNum = m ? m[1] : '';
    window.fcWaNumber = waNum;
    each('a[href*="wa.me/"]', function (n) {
      if (n.matches('[data-cms="waLink"]')) return;
      var base = orig(n).href || '';
      n.setAttribute('href', waNum ? base.replace(/wa\.me\/\d+/, 'wa.me/' + waNum) : base);
    });

    // Menu prices
    MENU.forEach(function (cat) {
      cat.items.forEach(function (it) {
        var n = document.querySelector('#menu li[data-item="' + it.id + '"] .menu-price');
        if (!n) return;
        orig(n);
        if (content.prices[it.id]) n.textContent = formatPrice(content.prices[it.id]);
        else n.innerHTML = ORIG ? ORIG.get(n).html : n.innerHTML;
      });
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

    // Product prices (card + popup + WhatsApp message read from this)
    window.FC_PRODUCT_PRICES = content.productPrices || {};
    PRODUCTS.forEach(function (p) {
      var node = document.querySelector('.product-price[data-price-for="' + p.id + '"]');
      if (!node) return;
      var t = cardPriceText(p, window.FC_PRODUCT_PRICES);
      node.textContent = t;
      node.hidden = !t;
    });
    reorderProductCards();
    applyImages(content.images);
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
    if (preview) {
      var d = loadDraft();
      if (d) applyToSite(d);
      showPreviewBadge();
    } else {
      var cached = loadCache();           // instant: last known live content, no flash of old text
      if (cached) applyToSite(cached);
    }
    loadRemote().then(function (r) {
      if (preview) { applyToSite(loadDraft() || r.content); return; }
      if (r.found) { saveCache(r.content); applyToSite(r.content); pruneImageCache(r.content.images); }
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

  // One card per product: unavailable tick + price box (one per size for sized products)
  function buildProductEditor() {
    var host = $('productAvailabilityList');
    if (!host) return;
    host.textContent = '';
    PRODUCTS.forEach(function (p) {
      var card = el('div', 'product-edit');
      var head = el('div', 'product-edit-head');
      head.appendChild(el('strong', null, p.name));
      var off = el('label', 'product-off');
      var cb = document.createElement('input');
      cb.type = 'checkbox'; cb.id = p.id; cb.name = p.id;
      cb.addEventListener('change', function () { card.classList.toggle('is-off', cb.checked); });
      off.appendChild(cb);
      off.appendChild(document.createTextNode('Unavailable'));
      head.appendChild(off);
      card.appendChild(head);

      productKeys(p).forEach(function (key, i) {
        var row = el('div', 'product-price-row');
        var lab = el('label', null, (p.sizes && p.sizes.length) ? 'Price for ' + p.sizes[i] : 'Price');
        var inp = document.createElement('input');
        inp.type = 'text';
        inp.id = 'pprice-' + p.id + '-' + i;
        inp.maxLength = 20;
        inp.placeholder = 'e.g. 250';
        inp.autocomplete = 'off';
        inp.setAttribute('inputmode', 'decimal');
        inp.setAttribute('data-pkey', key);
        lab.setAttribute('for', inp.id);
        inp.addEventListener('input', function () { row.classList.toggle('is-set', !!formatPrice(inp.value)); });
        row.appendChild(lab); row.appendChild(inp);
        card.appendChild(row);
      });
      host.appendChild(card);
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
      if (cb) {
        cb.checked = !!content.unavailable[p.id];
        var card = cb.closest('.product-edit');
        if (card) card.classList.toggle('is-off', cb.checked);
      }
    });
    form.querySelectorAll('[data-pkey]').forEach(function (inp) {
      inp.value = (content.productPrices && content.productPrices[inp.getAttribute('data-pkey')]) || '';
      var row = inp.closest('.product-price-row');
      if (row) row.classList.toggle('is-set', !!inp.value);
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
    form.querySelectorAll('[data-pkey]').forEach(function (inp) {
      var v = formatPrice(inp.value);
      if (v) c.productPrices[inp.getAttribute('data-pkey')] = v;
    });
    return { content: c, errors: errors };
  }

  function initDashboard() {
    var form = $('cmsForm');
    if (!form) return;
    var statusEl = $('formStatus');
    var liveChip = $('liveState');
    var draftChip = $('draftState');
    var gate = $('loginBox');
    var app = $('dashMain');
    var signOutBtn = $('signOutBtn');
    var publishBtn = $('publishBtn');
    var demoNote = $('demoNote');
    var remoteState = { found: false, content: emptyContent() };

    // ----- photos -----
    var photoMap = {};     // path -> photo id ("draft-..." = chosen here, not published yet)
    var photoInfo = {};    // path -> "WebP 182 KB"
    var photoUi = {};      // path -> its DOM pieces

    function fmtKB(n) { return Math.max(1, Math.round(n / 1024)) + ' KB'; }

    function renderPhoto(path) {
      var ui = photoUi[path];
      if (!ui) return;
      var id = photoMap[path];
      ui.undo.hidden = !id;
      ui.card.classList.toggle('is-custom', !!id);
      if (!id) { ui.img.src = path; ui.state.textContent = 'Original photo'; return; }
      var draft = isDraftId(id);
      ui.state.textContent = draft
        ? 'New photo' + (photoInfo[path] ? ' \u2014 ' + photoInfo[path] : '') + ' \u2014 not live yet'
        : 'Your uploaded photo (live)';
      getImageUrl(id).then(function (url) {
        if (photoMap[path] === id) ui.img.src = url;
      }, function () {
        if (photoMap[path] !== id) return;
        if (draft) {                                    // the draft photo is gone from this browser
          delete photoMap[path];
          renderPhoto(path);
          say('A draft photo could not be found. Please choose it again.', true);
        } else {
          ui.state.textContent = 'Your uploaded photo (live) \u2014 preview could not load';
        }
      });
    }

    function setPhotos(map) {
      photoMap = {};
      Object.keys(map || {}).forEach(function (k) { photoMap[k] = map[k]; });
      PHOTOS.forEach(function (ph) { renderPhoto(ph.path); });
    }

    function buildPhotoEditor() {
      var host = $('photoEditor');
      if (!host) return;
      host.textContent = '';
      var groups = [];
      PHOTOS.forEach(function (ph) {
        var g = groups.filter(function (x) { return x.name === ph.group; })[0];
        if (!g) { g = { name: ph.group, items: [] }; groups.push(g); }
        g.items.push(ph);
      });
      groups.forEach(function (g, gi) {
        var d = el('details', 'menu-cat');
        d.open = gi === 0;
        d.appendChild(el('summary', null, g.name + ' (' + g.items.length + ')'));
        var grid = el('div', 'photo-grid');
        g.items.forEach(function (ph) {
          var card = el('div', 'photo-edit');
          var img = document.createElement('img');
          img.className = 'photo-thumb'; img.alt = ph.label; img.loading = 'lazy'; img.src = ph.path;
          var meta = el('div', 'photo-meta');
          meta.appendChild(el('strong', null, ph.label));
          var state = el('span', 'photo-state', 'Original photo');
          meta.appendChild(state);
          var row = el('div', 'photo-actions');
          var pick = el('label', 'secondary-link secondary file-btn', 'Change photo');
          var file = document.createElement('input');
          file.type = 'file'; file.accept = 'image/*';
          pick.appendChild(file);
          var undo = el('button', 'secondary', 'Use original');
          undo.type = 'button'; undo.hidden = true;
          row.appendChild(pick); row.appendChild(undo);
          card.appendChild(img); card.appendChild(meta); card.appendChild(row);
          grid.appendChild(card);
          photoUi[ph.path] = { card: card, img: img, state: state, undo: undo };

          file.addEventListener('change', function () {
            var f = file.files && file.files[0];
            file.value = '';
            if (!f) return;
            state.textContent = 'Converting to WebP\u2026';
            processImage(f).then(function (res) {
              var id = 'draft-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
              return idbPut(id, res.blob).then(function () {
                photoMap[ph.path] = id;
                photoInfo[ph.path] = (res.blob.type === 'image/webp' ? 'WebP ' : 'JPEG ') + fmtKB(res.blob.size);
                renderPhoto(ph.path);
                say('Photo ready (' + photoInfo[ph.path] + '). Click "Save draft", check it with "Preview draft", then "Publish live".');
              });
            }).catch(function (err) {
              say(err && err.message ? err.message : 'Could not use that photo.', true);
              renderPhoto(ph.path);
            });
          });
          undo.addEventListener('click', function () {
            delete photoMap[ph.path];
            renderPhoto(ph.path);
            say('Original photo restored for "' + ph.label + '". Click "Save draft" to keep this.');
          });
        });
        d.appendChild(grid);
        host.appendChild(d);
      });
    }

    function fillAll(content) {
      fillForm(form, content);
      setPhotos(content.images);
    }

    function say(msg, bad) {
      statusEl.textContent = msg;
      statusEl.classList.toggle('is-error', !!bad);
    }
    function showApp(on) {
      if (app) app.hidden = !on;
      if (gate) gate.hidden = on;
      if (signOutBtn) signOutBtn.hidden = !(on && DB_READY);
    }
    function refreshChips() {
      var d = loadDraft();
      if (!DB_READY) {
        liveChip.textContent = remoteState.found
          ? 'Live file: data/content.json found'
          : 'Live: none yet \u2014 the site shows its built-in values (database not connected)';
      } else {
        liveChip.textContent = remoteState.found
          ? 'Live: ' + (remoteState.source === 'file' ? 'data/content.json' : 'database') +
            (remoteState.content.updatedAt ? ' (updated ' + new Date(remoteState.content.updatedAt).toLocaleString() + ')' : '')
          : 'Live: nothing published yet \u2014 the site shows its built-in values';
      }
      liveChip.classList.toggle('ok', remoteState.found);
      draftChip.textContent = d ? 'Draft: saved on this device (not live)' : 'Draft: none';
      draftChip.classList.toggle('ok', !!d);
    }
    function commit() {
      var r = readForm(form);
      if (r.errors.length) { say(r.errors.join('. ') + '.', true); return null; }
      r.content.images = JSON.parse(JSON.stringify(photoMap));
      r.content.updatedAt = new Date().toISOString();
      if (!saveDraft(r.content)) { say('Could not save the draft in this browser (storage blocked).', true); return null; }
      refreshChips();
      return r.content;
    }

    buildMenuEditor();
    buildProductEditor();
    buildPhotoEditor();

    loadRemote().then(function (r) {
      remoteState = r;
      fillAll(loadDraft() || r.content);
      refreshChips();
    });

    // ----- login gate -----
    if (!DB_READY) {
      showApp(true);                                   // demo mode: no database yet, no login needed
      if (demoNote) demoNote.hidden = false;
      if (publishBtn) publishBtn.disabled = true;
    } else {
      showApp(false);
      if (readSession()) {
        getToken().then(function () { showApp(true); }, function () { showApp(false); });
      }
      var loginForm = $('loginForm');
      var loginStatus = $('loginStatus');
      var loginBtn = $('loginBtn');
      loginForm.addEventListener('submit', function (e) {
        e.preventDefault();
        var email = $('loginEmail').value.trim();
        var pass = $('loginPassword').value;
        if (!email || !pass) { loginStatus.textContent = 'Enter your email and password.'; loginStatus.classList.add('is-error'); return; }
        loginBtn.disabled = true;
        loginStatus.classList.remove('is-error');
        loginStatus.textContent = 'Signing in\u2026';
        signIn(email, pass).then(function () {
          $('loginPassword').value = '';
          loginStatus.textContent = '';
          showApp(true);
        }).catch(function (err) {
          loginStatus.textContent = err.message;
          loginStatus.classList.add('is-error');
        }).then(function () { loginBtn.disabled = false; });
      });
      if (signOutBtn) signOutBtn.addEventListener('click', function () { signOut(); showApp(false); });
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (commit()) say('Draft saved. Click "Preview draft" to check it, then "Publish live".');
    });

    if (publishBtn) publishBtn.addEventListener('click', function () {
      if (!DB_READY) { say('The database is not connected yet. Use "Download backup" for now.', true); return; }
      var c = commit();
      if (!c) return;
      if (!window.confirm('Publish these changes to the live website now?')) return;
      publishBtn.disabled = true;
      say('Publishing\u2026');
      var oldIds = {};
      var oldImgs = (remoteState.content && remoteState.content.images) || {};
      Object.keys(oldImgs).forEach(function (k) { oldIds[oldImgs[k]] = true; });

      publishPhotos(c, say).then(function () {
        say('Publishing\u2026');
        return publishToDb(c);
      }).then(function () {
        remoteState = { found: true, content: c, source: 'database' };
        clearDraft();
        idbClear();
        var keep = {};
        Object.keys(c.images).forEach(function (k) { keep[c.images[k]] = true; });
        Object.keys(oldIds).forEach(function (id) { if (!keep[id] && !isDraftId(id)) deleteImage(id); });   // old replaced photos
        setPhotos(c.images);
        refreshChips();
        say('Published! The live website now shows these changes. Refresh the website to check.');
      }).catch(function (err) {
        say(err.message || 'Could not publish. Please try again.', true);
        if (/sign in/i.test(err.message || '')) showApp(false);
      }).then(function () { publishBtn.disabled = false; });
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
      say('Backup downloaded as content.json. Keep it somewhere safe.');
    });

    $('importFile').addEventListener('change', function (e) {
      var file = e.target.files && e.target.files[0];
      if (!file) return;
      var rd = new FileReader();
      rd.onload = function () {
        try {
          fillAll(clean(JSON.parse(String(rd.result))));
          say('File loaded into the form. Review it and click "Save draft".');
        } catch (err) { say('That file is not a valid content.json.', true); }
        e.target.value = '';
      };
      rd.readAsText(file);
    });

    $('discardBtn').addEventListener('click', function () {
      clearDraft();
      idbClear();
      fillAll(remoteState.content);
      refreshChips();
      say('Draft discarded. The form now shows the live version.');
    });

    $('resetBtn').addEventListener('click', function () {
      fillAll(emptyContent());
      say('Form set to the original built-in values. Click "Save draft" to keep this.');
    });
  }

  // ---------- Boot ----------
  var page = document.body && document.body.dataset.page;
  if (page === 'site') initSite();
  if (page === 'cms') initDashboard();
})();
