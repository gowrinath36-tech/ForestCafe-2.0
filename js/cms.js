(function () {
  const STORAGE_KEY = 'forest-cafe-cms-v1';
  const PRODUCT_STORAGE_KEY = 'forest-cafe-product-availability-v1';
  const PRODUCT_LIST = [
    'prod-1', 'prod-2', 'prod-3', 'prod-4', 'prod-5',
    'prod-6', 'prod-7', 'prod-8', 'prod-9', 'prod-10',
    'prod-11', 'prod-12'
  ];

  const PRODUCT_NAMES = {
    'prod-1': 'Pure Coffee',
    'prod-2': '70/30 Coffee Blend',
    'prod-3': '80/20 Coffee Blend',
    'prod-4': 'Tea Dust',
    'prod-5': 'Honey',
    'prod-6': 'Curry Leaf Powder',
    'prod-7': 'Idli Podi',
    'prod-8': 'Maa Inji Thokku',
    'prod-9': 'Dal Powder',
    'prod-10': 'Perandai Thokku',
    'prod-11': 'Turmeric Powder',
    'prod-12': 'Farm Fresh Avocado'
  };

  const DEFAULTS = {
    heroTitle: 'Coffee, farm and a place to stay',
    heroText: 'We grow it on the slope behind the kitchen, roast it here, and pour it while the mist is still coming off the hills.',
    aboutTitle: 'Forest Cafe',
    aboutText: 'We started in 2019 with four tables, one roaster and a slope full of coffee plants. Today the same slope feeds the kitchen, the shop and the six rooms behind the cafe. Nothing travels far here — most of it walks down the hill in the morning.',
    phoneText: '+91 94440 60619',
    phoneLink: 'tel:+919444060619',
    emailText: 'forestcafe.khilla@gmail.com',
    emailLink: 'mailto:forestcafe.khilla@gmail.com',
    instaLink: 'https://www.instagram.com/forestcafe.khills?utm_source=ig_web_button_share_sheet&stkn=ZDNlZDc0MzIxNw==',
    waLink: 'https://wa.me/919444060619?text=Hi%20Forest%20Cafe%2C%20I%20want%20to%20know%20more%20about%20your%20stay%20and%20cafe.'
  };

  function getContent() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return { ...DEFAULTS, ...saved };
    } catch (error) {
      return { ...DEFAULTS };
    }
  }

  function saveContent(content) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(content));
  }

  function getProductAvailability() {
    try {
      const saved = JSON.parse(localStorage.getItem(PRODUCT_STORAGE_KEY) || '{}');
      const result = {};
      PRODUCT_LIST.forEach(function (id) {
        result[id] = !!saved[id];
      });
      return result;
    } catch (error) {
      const result = {};
      PRODUCT_LIST.forEach(function (id) {
        result[id] = false;
      });
      return result;
    }
  }

  function saveProductAvailability(availability) {
    localStorage.setItem(PRODUCT_STORAGE_KEY, JSON.stringify(availability));
  }

  function setTextValue(selector, value) {
    const nodes = document.querySelectorAll(selector);
    nodes.forEach((node) => {
      node.textContent = value || '';
    });
  }

  function setHrefValue(selector, value) {
    const nodes = document.querySelectorAll(selector);
    nodes.forEach((node) => {
      if (value) node.setAttribute('href', value);
    });
  }

  function reorderProductCardsByAvailability() {
    const grid = document.getElementById('productsGrid');
    if (!grid) return;

    const cards = Array.from(grid.querySelectorAll('.product-card[data-id]'));
    if (cards.length <= 1) return;

    const availableCards = [];
    const unavailableCards = [];

    cards.forEach(function (card) {
      if (card.classList.contains('is-unavailable')) {
        unavailableCards.push(card);
      } else {
        availableCards.push(card);
      }
    });

    const orderedCards = availableCards.concat(unavailableCards);
    orderedCards.forEach(function (card) {
      grid.appendChild(card);
    });
  }

  function applyProductAvailabilityToSite() {
    const availability = getProductAvailability();
    const productCards = document.querySelectorAll('.product-card[data-id]');

    productCards.forEach(function (card) {
      const id = card.getAttribute('data-id');
      const unavailable = !!availability[id];
      card.classList.toggle('is-unavailable', unavailable);

      let badge = card.querySelector('.product-badge--unavailable');
      if (unavailable) {
        if (!badge) {
          badge = document.createElement('span');
          badge.className = 'product-badge product-badge--unavailable';
          badge.textContent = 'Currently unavailable';
          card.insertBefore(badge, card.firstChild);
        }
      } else if (badge) {
        badge.remove();
      }
    });

    reorderProductCardsByAvailability();
  }

  function applyContentToSite() {
    const content = getContent();

    setTextValue('[data-cms="heroTitle"]', content.heroTitle);
    setTextValue('[data-cms="heroText"]', content.heroText);
    setTextValue('[data-cms="aboutTitle"]', content.aboutTitle);
    setTextValue('[data-cms="aboutText"]', content.aboutText);

    document.querySelectorAll('[data-cms="phoneLink"]').forEach((node) => {
      node.setAttribute('href', content.phoneLink);
      node.textContent = content.phoneText;
    });

    document.querySelectorAll('[data-cms="emailLink"]').forEach((node) => {
      node.setAttribute('href', content.emailLink);
      node.textContent = content.emailText;
    });

    setHrefValue('[data-cms="instaLink"]', content.instaLink);
    setHrefValue('[data-cms="waLink"]', content.waLink);
    applyProductAvailabilityToSite();
  }

  function setFormValues(form) {
    const content = getContent();
    Object.keys(DEFAULTS).forEach((key) => {
      const field = form.querySelector('[name="' + key + '"]');
      if (field) field.value = content[key] || '';
    });
  }

  function renderProductList() {
    const container = document.getElementById('productAvailabilityList');
    if (!container) return;

    const availability = getProductAvailability();
    container.innerHTML = '';

    PRODUCT_LIST.forEach(function (id) {
      const row = document.createElement('div');
      row.className = 'product-toggle-row';

      const label = document.createElement('label');
      label.setAttribute('for', id);
      label.textContent = PRODUCT_NAMES[id] || id;

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.id = id;
      checkbox.name = id;
      checkbox.checked = !!availability[id];

      row.appendChild(label);
      row.appendChild(checkbox);
      container.appendChild(row);
    });
  }

  function initDashboard() {
    const form = document.getElementById('cmsForm');
    if (!form) return;

    renderProductList();
    setFormValues(form);

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      const formData = new FormData(form);
      const nextContent = { ...DEFAULTS };

      for (const [key, value] of formData.entries()) {
        if (key.startsWith('prod-')) continue;
        nextContent[key] = String(value).trim();
      }

      saveContent(nextContent);

      const nextAvailability = {};
      PRODUCT_LIST.forEach(function (id) {
        const input = form.querySelector('[name="' + id + '"]');
        nextAvailability[id] = !!(input && input.checked);
      });
      saveProductAvailability(nextAvailability);
      applyContentToSite();

      const status = document.getElementById('formStatus');
      if (status) {
        status.textContent = 'Saved successfully';
      }
    });

    const resetButton = document.getElementById('resetBtn');
    resetButton && resetButton.addEventListener('click', function () {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(PRODUCT_STORAGE_KEY);
      renderProductList();
      setFormValues(form);
      applyContentToSite();
      const status = document.getElementById('formStatus');
      if (status) {
        status.textContent = 'Reset to default values';
      }
    });
  }

  if (document.body && document.body.dataset.page === 'site') {
    applyContentToSite();
  }

  if (document.body && document.body.dataset.page === 'cms') {
    initDashboard();
  }
})();
