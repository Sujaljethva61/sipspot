const menuToggle = document.querySelector('.menu-toggle');
const navLinks = document.querySelector('.nav-links');

let sipspotDeferredInstallPrompt = null;

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  sipspotDeferredInstallPrompt = event;
  updateInstallButton();
});

window.addEventListener('appinstalled', () => {
  sipspotDeferredInstallPrompt = null;
  updateInstallButton();
});

function isPwaInstalled() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function updateInstallButton() {
  const installBtn = document.getElementById('install-btn');
  if (!installBtn) return;

  const appIconSvg = `
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" role="img" aria-hidden="true">
      <path d="M6.5 10.5C8.3 7.1 11 5 14 5c0 0 .8 2.2 2.2 4.6 1.4 2.4 2.3 5.3 2.3 7.5 0 1.5-1.2 2.7-2.7 2.7-2.1 0-4.8-1.6-7.8-4.6C5.5 14.3 5 12.2 5 10.5c0-1.2.3-2.4.9-3.4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
      <path d="M12 7v6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
      <path d="M9.5 11.5L12 14l2.5-2.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  `;

  if (isPwaInstalled()) {
    installBtn.innerHTML = `
      <span class="install-icon">✓</span>
      <span class="install-copy">
        <span class="install-title">SIPSPOT is installed</span>
      </span>
      <span class="install-hint">→</span>
    `;
    installBtn.disabled = true;
    installBtn.classList.add('installed');
    return;
  }

  installBtn.innerHTML = `
    <span class="install-icon">${appIconSvg}</span>
    <span class="install-copy">
      <span class="install-title">Download SIPSPOT</span>
      <span class="install-subtitle">INSTALL SIPSPOT</span>
    </span>
    <span class="install-hint">→</span>
  `;
  installBtn.disabled = false;
  installBtn.classList.remove('installed');
}

function getPwaInstructions() {
  const userAgent = navigator.userAgent || '';
  if (/android/i.test(userAgent)) {
    return [
      { label: 'ANDROID:', text: 'Use Chrome → ⋮ menu → Add to Home screen / Install app.' }
    ];
  }
  if (/iphone|ipad|ipod/i.test(userAgent) || (/Macintosh/i.test(userAgent) && 'ontouchend' in document)) {
    return [
      { label: 'IOS:', text: 'Open Safari → Share → Add to Home Screen.' }
    ];
  }
  return [
    { label: 'DESKTOP:', text: 'Use Chrome/Edge install button from the address bar or browser menu.' }
  ];
}

function renderPwaInstructions() {
  const container = document.getElementById('pwa-install-instructions');
  if (!container) return;
  const items = getPwaInstructions();
  container.innerHTML = items.map((item) => `
    <div class="pwa-instruction-step">
      <strong>${item.label}</strong>
      <span>${item.text}</span>
    </div>
  `).join('');
}

function showPwaInstallModal() {
  const modal = document.getElementById('pwa-install-modal');
  if (!modal) return;
  renderPwaInstructions();
  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function hidePwaInstallModal() {
  const modal = document.getElementById('pwa-install-modal');
  if (!modal) return;
  modal.classList.add('hidden');
  document.body.style.overflow = '';
}

function promptPwaInstall() {
  if (!sipspotDeferredInstallPrompt) {
    showPwaInstallModal();
    return;
  }
  const installBtn = document.getElementById('install-btn');
  if (installBtn) {
    installBtn.innerHTML = '<span class="install-title">Installing SIPSPOT...</span>';
    installBtn.disabled = true;
  }
  sipspotDeferredInstallPrompt.prompt();
  sipspotDeferredInstallPrompt.userChoice.then((choiceResult) => {
    if (choiceResult.outcome === 'accepted') {
      updateInstallButton();
    } else {
      sipspotDeferredInstallPrompt = null;
      updateInstallButton();
      showPwaInstallModal();
    }
  }).catch(() => {
    sipspotDeferredInstallPrompt = null;
    updateInstallButton();
    showPwaInstallModal();
  });
}

function initPwaInstall() {
  if (window._sipspotPwaInit) return;
  window._sipspotPwaInit = true;

  const installBtn = document.getElementById('install-btn');
  const closeBtn = document.querySelector('.pwa-close');
  const cancelBtn = document.querySelector('.pwa-install-cancel');
  const actionBtn = document.querySelector('.pwa-install-action');

  if (installBtn) {
    installBtn.addEventListener('click', () => {
      if (isPwaInstalled()) {
        updateInstallButton();
        return;
      }
      promptPwaInstall();
    });
  }

  if (closeBtn) closeBtn.addEventListener('click', hidePwaInstallModal);
  if (cancelBtn) cancelBtn.addEventListener('click', hidePwaInstallModal);
  if (actionBtn) actionBtn.addEventListener('click', () => {
    if (sipspotDeferredInstallPrompt) {
      promptPwaInstall();
    } else {
      hidePwaInstallModal();
    }
  });

  updateInstallButton();
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('sw.js').then((registration) => {
    // Ask the browser to check for updates immediately
    try { registration.update(); } catch (e) {}

    // When a new service worker is found
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (!newWorker) return;
      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed') {
          // If there's an active controller, this is an update — instruct the SW to skip waiting
          if (navigator.serviceWorker.controller) {
            try { newWorker.postMessage({ type: 'SKIP_WAITING' }); } catch (e) {}
          }
        }
      });
    });

    // When the controlling service worker changes, reload to use the new content
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      try {
        // avoid reload loops — only reload if the page is controlled
        if (!window._swReloading) {
          window._swReloading = true;
          window.location.reload();
        }
      } catch (e) { console.warn(e); }
    });

    // Periodically check for updates (lightweight): every 6 hours
    setInterval(() => {
      try { registration.update(); } catch (e) {}
    }, 1000 * 60 * 60 * 6);

    // Also check for updates when the page becomes visible
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        try { registration.update(); } catch (e) {}
      }
    });
  }).catch((error) => {
    console.warn('SW registration failed:', error);
  });
}

menuToggle?.addEventListener('click', () => {
  navLinks?.classList.toggle('open');
});

window.addEventListener('scroll', () => {
  const header = document.querySelector('.site-header');
  if (!header) return;
  header.classList.toggle('scrolled', window.scrollY > 20);
});

function isLoggedIn() {
  return localStorage.getItem('sipspot_logged_in') === 'true';
}

function shouldShowIntro() {
  // Intro should appear on every page load/refresh — do not rely on storage flags
  return true;
}

function markIntroSeen() {
  // no-op: we intentionally do not persist intro seen state
}

function goBack() {
  const fallback = './index.html';
  const sameSiteReferrer = document.referrer && document.referrer.startsWith(location.origin);
  if (window.history.length > 1 && sameSiteReferrer) {
    window.history.back();
  } else {
    window.location.href = fallback;
  }
}

function ensureExploreAccess(event) {
  if (isLoggedIn()) {
    return true;
  }

  event.preventDefault();
  window.location.href = 'login.html?next=explore.html';
  return false;
}

function onAuthSuccess() {
  localStorage.setItem('sipspot_logged_in', 'true');
  const params = new URLSearchParams(window.location.search);
  const next = params.get('next') || 'explore.html';
  window.location.href = next;
}

function ensurePageAccess() {
  if (window.location.pathname.endsWith('explore.html') && !isLoggedIn()) {
    window.location.href = 'login.html?next=explore.html';
  }
}

window.addEventListener('DOMContentLoaded', () => {
  // load any previously saved custom cafes before rendering pages
  try { if (typeof loadCustomCafes === 'function') loadCustomCafes(); } catch (e) {}
  ensurePageAccess();
  initButtonSteamEffect();
  registerServiceWorker();
  initPwaInstall();
  if (window.location.pathname.endsWith('explore.html')) {
    initExplorePage();
  } else if (window.location.pathname.endsWith('index.html') || window.location.pathname === '/') {
    initHomePage();
  }
  // Initialize auth character on auth pages
  if (window.location.pathname.endsWith('login.html') || window.location.pathname.endsWith('signup.html')) {
    initAuthCharacter();
  }
  // init cinematic theme (non-blocking)
  try { initCinematicTheme(); } catch (e) { console.warn(e); }
});

// Auth character: pupil tracking, idle blink, shy on password focus
function initAuthCharacter() {
  const wrap = document.querySelector('.character-wrap');
  if (!wrap) return;

  const svg = wrap.querySelector('.character');
  if (!svg) return;

  const leftEyeGroup = svg.querySelector('.left-eye');
  const rightEyeGroup = svg.querySelector('.right-eye');
  const leftPupil = svg.querySelector('.left-eye .pupil');
  const rightPupil = svg.querySelector('.right-eye .pupil');
  if (!leftEyeGroup || !rightEyeGroup || !leftPupil || !rightPupil) return;

  const isTouch = 'ontouchstart' in window || window.innerWidth < 720;

  // per-eye targets and current positions for smooth lerp
  const target = { x: 0, y: 0 };
  const current = { x: 0, y: 0 };

  // limits for pupil movement inside the eye
  const MAX_X = 7; // horizontal px
  const MAX_Y = 6; // vertical px

  // compute eye center in viewport coordinates
  function getEyeCenter(el) {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  // update target based on cursor
  function handleMouseMove(e) {
    const mx = e.clientX;
    const my = e.clientY;
    const left = getEyeCenter(leftEyeGroup);
    const right = getEyeCenter(rightEyeGroup);
    // use midpoint between eyes as reference so both eyes look together
    const cx = (left.x + right.x) / 2;
    const cy = (left.y + right.y) / 2;
    const dx = mx - cx;
    const dy = my - cy;
    const dist = Math.hypot(dx, dy) || 1;
    // normalized direction
    const ux = dx / dist;
    const uy = dy / dist;
    // scale by distance but clamp so small movement near center
    const maxDist = 160;
    const d = Math.min(dist, maxDist) / maxDist;
    target.x = ux * d * MAX_X;
    target.y = uy * d * MAX_Y;
  }

  if (!isTouch) {
    document.addEventListener('mousemove', handleMouseMove);
  }

  // lerp animation loop
  function lerp(a, b, t) { return a + (b - a) * t; }
  let raf = null;
  function animate() {
    current.x = lerp(current.x, target.x, 0.16);
    current.y = lerp(current.y, target.y, 0.16);
    // apply transform via style for SVG elements
    const tx = `translate(${current.x}px, ${current.y}px)`;
    leftPupil.style.transform = tx;
    rightPupil.style.transform = tx;
    raf = requestAnimationFrame(animate);
  }
  animate();

  // idle blinking
  const blinkInterval = 4200;
  let blinkTimer = setInterval(() => {
    svg.classList.add('blink');
    setTimeout(() => svg.classList.remove('blink'), 160 + Math.random() * 200);
  }, blinkInterval + Math.random() * 1800);

  // proximity reaction (subtle smile + blink)
  let lastNear = false;
  function proximityCheck() {
    if (isTouch) return;
    const rect = wrap.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    // use current mouse pos from last event or center
    const mx = (window._lastMouseX || window.innerWidth / 2);
    const my = (window._lastMouseY || window.innerHeight / 2);
    const d = Math.hypot(mx - centerX, my - centerY);
    const near = d < Math.max(120, rect.width * 0.6);
    if (near && !lastNear) {
      svg.classList.add('smile');
      svg.classList.add('blink');
      setTimeout(() => svg.classList.remove('blink'), 160);
      setTimeout(() => svg.classList.remove('smile'), 800);
    }
    lastNear = near;
    requestAnimationFrame(proximityCheck);
  }
  if (!isTouch) proximityCheck();

  // password shy behavior
  const passwordInputs = document.querySelectorAll('input[type="password"]');
  passwordInputs.forEach((el) => {
    el.addEventListener('focus', () => {
      svg.classList.add('shy');
      // hide pupils slightly by moving them down/away
      target.x = 0; target.y = 10;
      // show hands
      svg.querySelectorAll('.hand').forEach(h => h.style.opacity = '1');
    });
    el.addEventListener('blur', () => {
      svg.classList.remove('shy');
      svg.querySelectorAll('.hand').forEach(h => h.style.opacity = '0');
    });
  });

  // keep last mouse for proximity checks
  document.addEventListener('mousemove', (e) => { window._lastMouseX = e.clientX; window._lastMouseY = e.clientY; });

  // cleanup
  window.addEventListener('unload', () => {
    cancelAnimationFrame(raf);
    clearInterval(blinkTimer);
    if (!isTouch) document.removeEventListener('mousemove', handleMouseMove);
  });
  // initialize side characters behavior
  if (typeof initSideCharacters === 'function') initSideCharacters();
}

// Side characters: subtle eye-follow, idle bob, and blink (non-intrusive)
function initSideCharacters() {
  const wrap = document.querySelector('.character-wrap');
  if (!wrap) return;

  const leftSvg = wrap.querySelector('.small-left');
  const rightSvg = wrap.querySelector('.small-right');
  const isTouch = 'ontouchstart' in window || window.innerWidth < 720;

  function setupSmall(svg, opts = {}) {
    if (!svg) return null;
    const leftEye = svg.querySelector('.left-eye-small');
    const rightEye = svg.querySelector('.right-eye-small');
    const pupilL = leftEye?.querySelector('.pupil-small');
    const pupilR = rightEye?.querySelector('.pupil-small');
    if (!pupilL || !pupilR) return null;

    const target = { x: 0, y: 0 };
    const current = { x: 0, y: 0 };
    const MAX_X = opts.maxX || 3;
    const MAX_Y = opts.maxY || 2.5;
    const speed = opts.speed || 0.08;

    function getCenter(el) {
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }

    function onMove(e) {
      const mx = e.clientX; const my = e.clientY;
      const left = getCenter(leftEye);
      const right = getCenter(rightEye);
      const cx = (left.x + right.x) / 2; const cy = (left.y + right.y) / 2;
      const dx = mx - cx; const dy = my - cy; const dist = Math.hypot(dx, dy) || 1;
      const ux = dx / dist; const uy = dy / dist;
      const maxDist = 200;
      const d = Math.min(dist, maxDist) / maxDist;
      target.x = ux * d * MAX_X; target.y = uy * d * MAX_Y;
    }

    if (!isTouch) document.addEventListener('mousemove', onMove);

    function lerp(a,b,t){ return a + (b-a)*t }
    let raf = null;
    function anim(){
      current.x = lerp(current.x, target.x, speed);
      current.y = lerp(current.y, target.y, speed);
      const tx = `translate(${current.x}px, ${current.y}px)`;
      pupilL.style.transform = tx; pupilR.style.transform = tx;
      raf = requestAnimationFrame(anim);
    }
    anim();

    // blink
    const blinkT = 3800 + Math.random()*2400;
    const bTimer = setInterval(()=>{
      svg.classList.add('blink');
      setTimeout(()=>svg.classList.remove('blink'),120 + Math.random()*180);
    }, blinkT);

    return () => {
      cancelAnimationFrame(raf); clearInterval(bTimer); if (!isTouch) document.removeEventListener('mousemove', onMove);
    };
  }

  const leftClean = setupSmall(leftSvg, { maxX:3.5, maxY:2.8, speed:0.06 });
  const rightClean = setupSmall(rightSvg, { maxX:3, maxY:2.2, speed:0.09 });

  // cleanup when leaving
  window.addEventListener('unload', ()=>{ leftClean && leftClean(); rightClean && rightClean(); });
}

function initHomePage() {
  // Always start the intro sequence on page load/refresh
  startIntroSequence();
  wireHomepageSearch();
  initHomeRecommendations();
  initHeroCupInteraction();
}

function initHomeRecommendations() {
  const container = document.getElementById('featured-rotator');
  if (!container) return;

  const nameEl = document.getElementById('featured-name');
  const vibeEl = document.getElementById('featured-vibe');
  const addrEl = document.getElementById('featured-address');
  const exploreEl = document.getElementById('featured-explore');
  const media = document.getElementById('featured-media');
  const tagEl = document.getElementById('featured-tag');
  const card = document.getElementById('featured-card');
  const nextBtn = document.getElementById('featured-next');

  if (!nameEl || !vibeEl || !addrEl || !exploreEl || !media || !card) return;

  let order = cafeLocations.map((_, i) => i);
  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }
  shuffle(order);
  let pointer = 0;
  const INTERVAL = 6000; // 6s
  let timer = null;

  function showIndex(idx) {
    const cafe = cafeLocations[idx];
    if (!cafe) return;
    // animate out
    card.classList.add('hidden');
    setTimeout(() => {
      nameEl.textContent = cafe.name;
      vibeEl.textContent = cafe.vibe || 'Curated coffeehouse with premium atmosphere and calm energy.';
      addrEl.textContent = cafe.address || '';
      exploreEl.href = cafe.exploreUrl || cafe.mapUrl || '#';
      media.style.backgroundImage = `url('${cafe.imageUrl || ''}')`;
      tagEl.textContent = 'Recommended';
      // animate in
      card.classList.remove('hidden');
    }, 260);
  }

  function nextRecommendation(manual = false) {
    if (pointer >= order.length) {
      // reshuffle ensuring first item isn't same as last shown
      const last = order[order.length - 1];
      order = cafeLocations.map((_, i) => i);
      shuffle(order);
      if (order[0] === last && order.length > 1) {
        // swap first two
        [order[0], order[1]] = [order[1], order[0]];
      }
      pointer = 0;
    }
    const idx = order[pointer++];
    showIndex(idx);
    if (manual) resetTimer();
  }

  function resetTimer() {
    if (timer) clearInterval(timer);
    timer = setInterval(() => nextRecommendation(false), INTERVAL);
  }

  nextBtn?.addEventListener('click', () => nextRecommendation(true));

  // start
  showIndex(order[pointer++]);
  resetTimer();
}

function initHeroCupInteraction() {
  const cup = document.querySelector('.hero-cup-illustration');
  if (!cup) return;
  const eyes = cup.querySelectorAll('.cup-eye');
  const smile = cup.querySelector('.cup-smile');
  const steam = cup.querySelector('.cup-steam');
  let hoverState = false;

  function setCupExpression(active) {
    if (active) {
      cup.classList.add('cup-active');
      cup.classList.remove('cup-relaxed');
    } else {
      cup.classList.remove('cup-active');
      cup.classList.add('cup-relaxed');
    }
  }

  function updateEyes(x, y) {
    eyes.forEach((eye) => {
      const rect = eye.getBoundingClientRect();
      const dx = x - (rect.left + rect.width / 2);
      const dy = y - (rect.top + rect.height / 2);
      const angle = Math.atan2(dy, dx);
      const radius = 3;
      const ex = Math.cos(angle) * radius;
      const ey = Math.sin(angle) * radius;
      eye.style.transform = `translate(${ex}px, ${ey}px)`;
    });
  }

  function onPointerMove(event) {
    const rect = cup.getBoundingClientRect();
    const distance = Math.hypot(event.clientX - (rect.left + rect.width / 2), event.clientY - (rect.top + rect.height / 2));
    if (distance < 180) {
      setCupExpression(true);
      updateEyes(event.clientX, event.clientY);
    } else {
      setCupExpression(false);
      eyes.forEach((eye) => { eye.style.transform = 'translate(0, 0)'; });
    }
  }

  function onMouseEnter() {
    hoverState = true;
    cup.classList.add('cup-hovered');
    setCupExpression(true);
  }

  function onMouseLeave() {
    hoverState = false;
    cup.classList.remove('cup-hovered');
    setCupExpression(false);
    eyes.forEach((eye) => { eye.style.transform = 'translate(0, 0)'; });
  }

  cup.addEventListener('pointerenter', onMouseEnter);
  cup.addEventListener('pointerleave', onMouseLeave);
  window.addEventListener('pointermove', onPointerMove);
  setCupExpression(false);
}

function initExplorePage() {
  wireExploreSearch();
  renderCafeGallery(getSearchQuery());
  // initialize add-cafe form and ensure datalist is up to date
  updateCafeDatalist();
  initAddCafeForm();
}

function initButtonSteamEffect() {
  document.addEventListener('pointerdown', (event) => {
    const button = event.target.closest('a.button, button, input[type="button"], input[type="submit"]');
    if (!button || !(button instanceof HTMLElement)) return;

    const wrapper = button.closest('.button-fog-wrapper') || wrapButtonWithFog(button);
    if (wrapper) createButtonFog(wrapper, button);
  });
}

function wrapButtonWithFog(button) {
  const wrapper = document.createElement('span');
  wrapper.className = 'button-fog-wrapper';
  wrapper.style.display = 'inline-flex';
  wrapper.style.position = 'relative';
  wrapper.style.overflow = 'visible';
  wrapper.style.verticalAlign = 'middle';
  wrapper.style.lineHeight = '0';

  const parent = button.parentNode;
  if (!parent) return null;
  parent.replaceChild(wrapper, button);
  wrapper.appendChild(button);
  return wrapper;
}

function createButtonFog(wrapper, button) {
  if (!wrapper || !(wrapper instanceof HTMLElement)) return;

  const fog = document.createElement('div');
  fog.className = 'button-fog';
  fog.setAttribute('aria-hidden', 'true');

  for (let i = 0; i < 4; i += 1) {
    const steam = document.createElement('span');
    steam.setAttribute('aria-hidden', 'true');
    steam.style.left = `${10 + i * 22}%`;
    steam.style.animationDelay = `${i * 0.08}s`;
    fog.appendChild(steam);
  }

  wrapper.insertBefore(fog, button);
  fog.addEventListener('animationend', () => fog.remove(), { once: true });
  setTimeout(() => { if (fog.parentElement) fog.remove(); }, 1400);
}

function getSearchQuery() {
  const params = new URLSearchParams(window.location.search);
  return params.get('search')?.trim() || '';
}

function wireHomepageSearch() {
  const searchInput = document.getElementById('hero-search-input');
  const searchButton = document.getElementById('hero-search-button');
  if (!searchInput || !searchButton) return;

  const navigateWithQuery = () => {
    const query = searchInput.value.trim();
    const searchPath = query ? `explore.html?search=${encodeURIComponent(query)}` : 'explore.html';
    window.location.href = searchPath;
  };

  searchInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      navigateWithQuery();
    }
  });

  searchButton.addEventListener('click', () => {
    navigateWithQuery();
  });
}

function wireExploreSearch() {
  const searchInput = document.getElementById('explore-search-input');
  if (!searchInput) return;

  const initialQuery = getSearchQuery();
  searchInput.value = initialQuery;

  const updateResults = () => renderCafeGallery(searchInput.value);

  searchInput.addEventListener('input', updateResults);
  searchInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      updateResults();
    }
  });
}

function startIntroSequence() {
  const intro = document.getElementById('intro-screen');
  if (!intro) return;

  document.body.classList.add('intro-active');
  intro.classList.remove('intro-hidden');
  intro.classList.remove('intro-ready');

  window.requestAnimationFrame(() => {
    setTimeout(() => {
      intro.classList.add('intro-ready');
    }, 80);
  });

  const hideOverlay = () => {
    // do not persist intro seen state — intro should reappear on next page load/refresh
    intro.classList.add('intro-hidden');
    document.body.classList.remove('intro-active');
    setTimeout(() => {
      if (intro.parentElement) intro.parentElement.removeChild(intro);
    }, 900);
  };

  setTimeout(hideOverlay, 8200);
}

// The explore listing uses the cafe name, vibe, and directions URL only.
const cafeLocations = [
  {
    name: 'Pepito',
    address: 'Ahmedabad, Gujarat, India',
    imageUrl: 'https://images.unsplash.com/photo-1511920170033-f8396924c348?auto=format&fit=crop&w=1200&q=80',
    exploreUrl: 'https://www.google.com/maps/search/?api=1&query=Pepito+Ahmedabad',
    mapUrl: 'https://www.google.com/maps/search/?api=1&query=Pepito+Ahmedabad',
  },
  {
    name: 'Z27 Coffee Bar',
    address: 'Ahmedabad, Gujarat, India',
    imageUrl: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=1200&q=80',
    exploreUrl: 'https://www.google.com/maps/search/?api=1&query=Z27+Coffee+Bar+Ahmedabad',
    mapUrl: 'https://www.google.com/maps/search/?api=1&query=Z27+Coffee+Bar+Ahmedabad',
  },
  {
    name: 'Sly Granny',
    address: 'Ahmedabad, Gujarat, India',
    imageUrl: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=1200&q=80',
    exploreUrl: 'https://www.google.com/maps/search/?api=1&query=Sly+Granny+Ahmedabad',
    mapUrl: 'https://www.google.com/maps/search/?api=1&query=Sly+Granny+Ahmedabad',
  },
  {
    name: 'Ares Cafe',
    address: 'Ahmedabad, Gujarat, India',
    imageUrl: 'https://images.unsplash.com/photo-1511920170033-f8396924c348?auto=format&fit=crop&w=1200&q=80',
    exploreUrl: 'https://www.google.com/maps/search/?api=1&query=Ares+Cafe+Ahmedabad',
    mapUrl: 'https://www.google.com/maps/search/?api=1&query=Ares+Cafe+Ahmedabad',
  },
  {
    name: 'Caffix - The Tech Cafe',
    address: 'Ahmedabad, Gujarat, India',
    imageUrl: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=1200&q=80',
    exploreUrl: 'https://www.google.com/maps/search/?api=1&query=Caffix+The+Tech+Cafe+Ahmedabad',
    mapUrl: 'https://www.google.com/maps/search/?api=1&query=Caffix+The+Tech+Cafe+Ahmedabad',
  },
  {
    name: 'Bubblepop Café SBR',
    address: 'Sindhu Bhavan Road, Ahmedabad, Gujarat, India',
    imageUrl: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=1200&q=80',
    exploreUrl: 'https://www.google.com/maps/search/?api=1&query=Bubblepop+Cafe+SBR+Ahmedabad',
    mapUrl: 'https://www.google.com/maps/search/?api=1&query=Bubblepop+Cafe+SBR+Ahmedabad',
  },
  {
    name: 'Taan Jhaam, Sindhu Bhavan Road',
    address: 'Sindhu Bhavan Road, Ahmedabad, Gujarat, India',
    imageUrl: 'https://images.unsplash.com/photo-1511920170033-f8396924c348?auto=format&fit=crop&w=1200&q=80',
    exploreUrl: 'https://www.google.com/maps/search/?api=1&query=Taan+Jhaam+Sindhu+Bhavan+Road+Ahmedabad',
    mapUrl: 'https://www.google.com/maps/search/?api=1&query=Taan+Jhaam+Sindhu+Bhavan+Road+Ahmedabad',
  },
  {
    name: 'Gwalbhog SBR',
    address: 'Sindhu Bhavan Road, Ahmedabad, Gujarat, India',
    imageUrl: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=1200&q=80',
    exploreUrl: 'https://www.google.com/maps/search/?api=1&query=Gwalbhog+SBR+Ahmedabad',
    mapUrl: 'https://www.google.com/maps/search/?api=1&query=Gwalbhog+SBR+Ahmedabad',
  },
  {
    name: '@Mango',
    address: 'Bodakdev, Ahmedabad, Gujarat, India',
    imageUrl: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=1200&q=80',
    exploreUrl: 'https://www.google.com/maps/search/?api=1&query=%40Mango+Ahmedabad',
    mapUrl: 'https://www.google.com/maps/search/?api=1&query=%40Mango+Ahmedabad',
  },
  {
    name: 'Mi Casa Cafe and Resto',
    address: 'Bodakdev, Ahmedabad, Gujarat, India',
    imageUrl: 'https://images.unsplash.com/photo-1511920170033-f8396924c348?auto=format&fit=crop&w=1200&q=80',
    exploreUrl: 'https://www.google.com/maps/search/?api=1&query=Mi+Casa+Cafe+and+Resto+Ahmedabad',
    mapUrl: 'https://www.google.com/maps/search/?api=1&query=Mi+Casa+Cafe+and+Resto+Ahmedabad',
  },
  {
    name: 'Kaffa Coffee Roaster SBR',
    address: 'Sindhu Bhavan Road, Ahmedabad, Gujarat, India',
    imageUrl: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=1200&q=80',
    exploreUrl: 'https://www.google.com/maps/search/?api=1&query=Kaffa+Coffee+Roaster+SBR+Ahmedabad',
    mapUrl: 'https://www.google.com/maps/search/?api=1&query=Kaffa+Coffee+Roaster+SBR+Ahmedabad',
  },
  {
    name: 'Banjara - Gourmet Dining',
    address: 'Bodakdev, Ahmedabad, Gujarat, India',
    imageUrl: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=1200&q=80',
    exploreUrl: 'https://www.google.com/maps/search/?api=1&query=Banjara+Gourmet+Dining+Ahmedabad',
    mapUrl: 'https://www.google.com/maps/search/?api=1&query=Banjara+Gourmet+Dining+Ahmedabad',
  },
  {
    name: 'The Theory of Nine | Cafe in Ahmedabad',
    address: 'Bodakdev, Ahmedabad, Gujarat, India',
    imageUrl: 'https://images.unsplash.com/photo-1511920170033-f8396924c348?auto=format&fit=crop&w=1200&q=80',
    exploreUrl: 'https://www.google.com/maps/search/?api=1&query=The+Theory+of+Nine+Cafe+Ahmedabad',
    mapUrl: 'https://www.google.com/maps/search/?api=1&query=The+Theory+of+Nine+Cafe+Ahmedabad',
  },
  {
    name: 'TRITON',
    address: 'Bodakdev, Ahmedabad, Gujarat, India',
    imageUrl: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=1200&q=80',
    exploreUrl: 'https://www.google.com/maps/search/?api=1&query=TRITON+Ahmedabad',
    mapUrl: 'https://www.google.com/maps/search/?api=1&query=TRITON+Ahmedabad',
  },
  {
    name: 'K\'s Charcoal Ahmedabad',
    address: 'Ahmedabad, Gujarat, India',
    imageUrl: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=1200&q=80',
    exploreUrl: 'https://www.google.com/maps/search/?api=1&query=K%27s+Charcoal+Ahmedabad',
    mapUrl: 'https://www.google.com/maps/search/?api=1&query=K%27s+Charcoal+Ahmedabad',
  },
  {
    name: 'K\'s Verandah Ahmedabad',
    address: 'Ahmedabad, Gujarat, India',
    imageUrl: 'https://images.unsplash.com/photo-1511920170033-f8396924c348?auto=format&fit=crop&w=1200&q=80',
    exploreUrl: 'https://www.google.com/maps/search/?api=1&query=K%27s+Verandah+Ahmedabad',
    mapUrl: 'https://www.google.com/maps/search/?api=1&query=K%27s+Verandah+Ahmedabad',
  },
  {
    name: 'Table Tales - Sindhu Bhavan Road',
    address: 'Sindhu Bhavan Road, Ahmedabad, Gujarat, India',
    imageUrl: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=1200&q=80',
    exploreUrl: 'https://www.google.com/maps/search/?api=1&query=Table+Tales+Sindhu+Bhavan+Road+Ahmedabad',
    mapUrl: 'https://www.google.com/maps/search/?api=1&query=Table+Tales+Sindhu+Bhavan+Road+Ahmedabad',
  },
  {
    name: 'Kliya Cafe',
    address: 'Bodakdev, Ahmedabad, Gujarat, India',
    imageUrl: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=1200&q=80',
    exploreUrl: 'https://www.google.com/maps/search/?api=1&query=Kliya+Cafe+Ahmedabad',
    mapUrl: 'https://www.google.com/maps/search/?api=1&query=Kliya+Cafe+Ahmedabad',
  },
  {
    name: 'Lithosphere',
    address: 'Bodakdev, Ahmedabad, Gujarat, India',
    imageUrl: 'https://images.unsplash.com/photo-1511920170033-f8396924c348?auto=format&fit=crop&w=1200&q=80',
    exploreUrl: 'https://www.google.com/maps/search/?api=1&query=Lithosphere+Ahmedabad',
    mapUrl: 'https://www.google.com/maps/search/?api=1&query=Lithosphere+Ahmedabad',
  },
  {
    name: 'Pep House',
    address: 'Bodakdev, Ahmedabad, Gujarat, India',
    imageUrl: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=1200&q=80',
    exploreUrl: 'https://www.google.com/maps/search/?api=1&query=Pep+House+Ahmedabad',
    mapUrl: 'https://www.google.com/maps/search/?api=1&query=Pep+House+Ahmedabad',
  },
  {
    name: 'Xia Rooftop Bistro',
    address: 'Bodakdev, Ahmedabad, Gujarat, India',
    imageUrl: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=1200&q=80',
    exploreUrl: 'https://www.google.com/maps/search/?api=1&query=Xia+Rooftop+Bistro+Ahmedabad',
    mapUrl: 'https://www.google.com/maps/search/?api=1&query=Xia+Rooftop+Bistro+Ahmedabad',
  },
  {
    name: 'ZOZI CAFE',
    address: 'Bodakdev, Ahmedabad, Gujarat, India',
    imageUrl: 'https://images.unsplash.com/photo-1511920170033-f8396924c348?auto=format&fit=crop&w=1200&q=80',
    exploreUrl: 'https://www.google.com/maps/search/?api=1&query=ZOZI+Cafe+Ahmedabad',
    mapUrl: 'https://www.google.com/maps/search/?api=1&query=ZOZI+Cafe+Ahmedabad',
  },
  {
    name: 'Amala',
    address: 'Bodakdev, Ahmedabad, Gujarat, India',
    imageUrl: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=1200&q=80',
    exploreUrl: 'https://www.google.com/maps/search/?api=1&query=Amala+Ahmedabad+Bodakdev',
    mapUrl: 'https://www.google.com/maps/search/?api=1&query=Amala+Ahmedabad+Bodakdev',
  },
  {
    name: 'Under The Neem Trees',
    address: 'Bodakdev, Ahmedabad, Gujarat, India',
    imageUrl: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=1200&q=80',
    exploreUrl: 'https://www.google.com/maps/search/?api=1&query=Under+The+Neem+Trees+Ahmedabad',
    mapUrl: 'https://www.google.com/maps/search/?api=1&query=Under+The+Neem+Trees+Ahmedabad',
  },
  {
    name: 'Gordhan Thal',
    address: 'Bodakdev, Ahmedabad, Gujarat, India',
    imageUrl: 'https://images.unsplash.com/photo-1511920170033-f8396924c348?auto=format&fit=crop&w=1200&q=80',
    exploreUrl: 'https://www.google.com/maps/search/?api=1&query=Gordhan+Thal+Ahmedabad',
    mapUrl: 'https://www.google.com/maps/search/?api=1&query=Gordhan+Thal+Ahmedabad',
  },
  {
    name: 'Mocha Bodakdev',
    address: 'Bodakdev, Ahmedabad, Gujarat, India',
    imageUrl: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=1200&q=80',
    exploreUrl: 'https://www.google.com/maps/search/?api=1&query=Mocha+Bodakdev+Ahmedabad',
    mapUrl: 'https://www.google.com/maps/search/?api=1&query=Mocha+Bodakdev+Ahmedabad',
  },
  {
    name: 'Cafe Affogato',
    address: 'Ahmedabad, Gujarat, India',
    imageUrl: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=1200&q=80',
    exploreUrl: 'https://www.google.com/maps/search/?api=1&query=Cafe+Affogato+Ahmedabad',
    mapUrl: 'https://www.google.com/maps/search/?api=1&query=Cafe+Affogato+Ahmedabad',
  },
  {
    name: 'Monkey Cafe',
    address: 'Ahmedabad, Gujarat, India',
    imageUrl: 'https://images.unsplash.com/photo-1511920170033-f8396924c348?auto=format&fit=crop&w=1200&q=80',
    exploreUrl: 'https://www.google.com/maps/search/?api=1&query=Monkey+Cafe+Ahmedabad',
    mapUrl: 'https://www.google.com/maps/search/?api=1&query=Monkey+Cafe+Ahmedabad',
  },
  {
    name: 'Cocoa Dramma',
    address: 'Vastrapur, Ahmedabad, Gujarat, India',
    imageUrl: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=1200&q=80',
    exploreUrl: 'https://www.google.com/maps/search/?api=1&query=Cocoa+Dramma+Ahmedabad',
    mapUrl: 'https://www.google.com/maps/search/?api=1&query=Cocoa+Dramma+Ahmedabad',
  },
  {
    name: 'Amor Design Institute - Upri Manzil - The Rooftop Restro Cafe',
    address: 'Vastrapur, Ahmedabad, Gujarat, India',
    imageUrl: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=1200&q=80',
    exploreUrl: 'https://www.google.com/maps/search/?api=1&query=Amor+Design+Institute+Upri+Manzil+Ahmedabad',
    mapUrl: 'https://www.google.com/maps/search/?api=1&query=Amor+Design+Institute+Upri+Manzil+Ahmedabad',
  },
  {
    name: 'Sproute Cafe',
    address: 'Vastrapur, Ahmedabad, Gujarat, India',
    imageUrl: 'https://images.unsplash.com/photo-1511920170033-f8396924c348?auto=format&fit=crop&w=1200&q=80',
    exploreUrl: 'https://www.google.com/maps/search/?api=1&query=Sproute+Cafe+Ahmedabad',
    mapUrl: 'https://www.google.com/maps/search/?api=1&query=Sproute+Cafe+Ahmedabad',
  },
  {
    name: 'Roastery Cultür - The Coffee Company',
    address: 'Vastrapur, Ahmedabad, Gujarat, India',
    imageUrl: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=1200&q=80',
    exploreUrl: 'https://www.google.com/maps/search/?api=1&query=Roastery+Culture+The+Coffee+Company+Ahmedabad',
    mapUrl: 'https://www.google.com/maps/search/?api=1&query=Roastery+Culture+The+Coffee+Company+Ahmedabad',
  },
  {
    name: 'Kaffa Coffee Roasters',
    address: 'Ahmedabad, Gujarat, India',
    imageUrl: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=1200&q=80',
    exploreUrl: 'https://www.google.com/maps/search/?api=1&query=Kaffa+Coffee+Roasters+Ahmedabad',
    mapUrl: 'https://www.google.com/maps/search/?api=1&query=Kaffa+Coffee+Roasters+Ahmedabad',
  },
  {
    name: 'Cafe Quibble by La Quench',
    address: 'University Road, Ahmedabad, Gujarat, India',
    imageUrl: 'https://images.unsplash.com/photo-1511920170033-f8396924c348?auto=format&fit=crop&w=1200&q=80',
    exploreUrl: 'https://www.google.com/maps/search/?api=1&query=Cafe+Quibble+by+La+Quench+Ahmedabad',
    mapUrl: 'https://www.google.com/maps/search/?api=1&query=Cafe+Quibble+by+La+Quench+Ahmedabad',
  },
  {
    name: 'The Mad House',
    address: 'University Road, Ahmedabad, Gujarat, India',
    imageUrl: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=1200&q=80',
    exploreUrl: 'https://www.google.com/maps/search/?api=1&query=The+Mad+House+Ahmedabad',
    mapUrl: 'https://www.google.com/maps/search/?api=1&query=The+Mad+House+Ahmedabad',
  },
  {
    name: 'The Messy Door Cafe - HL College Road',
    address: 'HL College Road, Ahmedabad, Gujarat, India',
    imageUrl: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=1200&q=80',
    exploreUrl: 'https://www.google.com/maps/search/?api=1&query=The+Messy+Door+Cafe+Ahmedabad',
    mapUrl: 'https://www.google.com/maps/search/?api=1&query=The+Messy+Door+Cafe+Ahmedabad',
  },
  {
    name: 'Mocha CG Road',
    address: 'CG Road, Ahmedabad, Gujarat, India',
    imageUrl: 'https://images.unsplash.com/photo-1511920170033-f8396924c348?auto=format&fit=crop&w=1200&q=80',
    exploreUrl: 'https://www.google.com/maps/search/?api=1&query=Mocha+CG+Road+Ahmedabad',
    mapUrl: 'https://www.google.com/maps/search/?api=1&query=Mocha+CG+Road+Ahmedabad',
  },
  {
    name: 'Coffee By Di Bella',
    address: 'Navrangpura, Ahmedabad, Gujarat, India',
    imageUrl: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=1200&q=80',
    exploreUrl: 'https://www.google.com/maps/search/?api=1&query=Coffee+By+Di+Bella+Ahmedabad',
    mapUrl: 'https://www.google.com/maps/search/?api=1&query=Coffee+By+Di+Bella+Ahmedabad',
  },
  {
    name: 'Unlocked Cafe',
    address: 'Navrangpura, Ahmedabad, Gujarat, India',
    imageUrl: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=1200&q=80',
    exploreUrl: 'https://www.google.com/maps/search/?api=1&query=Unlocked+Cafe+Ahmedabad',
    mapUrl: 'https://www.google.com/maps/search/?api=1&query=Unlocked+Cafe+Ahmedabad',
  },
  {
    name: 'Tea Post',
    address: 'Ahmedabad, Gujarat, India',
    imageUrl: 'https://images.unsplash.com/photo-1511920170033-f8396924c348?auto=format&fit=crop&w=1200&q=80',
    exploreUrl: 'https://www.google.com/maps/search/?api=1&query=Tea+Post+Ahmedabad',
    mapUrl: 'https://www.google.com/maps/search/?api=1&query=Tea+Post+Ahmedabad',
  },
  {
    name: 'Sandoitchi',
    address: 'Ahmedabad, Gujarat, India',
    imageUrl: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=1200&q=80',
    exploreUrl: 'https://www.google.com/maps/search/?api=1&query=Sandoitchi+Ahmedabad',
    mapUrl: 'https://www.google.com/maps/search/?api=1&query=Sandoitchi+Ahmedabad',
  },
  {
    name: 'The Project Cafe',
    address: 'Ahmedabad, Gujarat, India',
    imageUrl: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=1200&q=80',
    exploreUrl: 'https://www.google.com/maps/search/?api=1&query=The+Project+Cafe+Ahmedabad',
    mapUrl: 'https://www.google.com/maps/search/?api=1&query=The+Project+Cafe+Ahmedabad',
  },
  {
    name: 'Mleko Specialty Coffee House and Bakery',
    address: 'Navrangpura, Ahmedabad, Gujarat, India',
    imageUrl: 'https://images.unsplash.com/photo-1511920170033-f8396924c348?auto=format&fit=crop&w=1200&q=80',
    exploreUrl: 'https://www.google.com/maps/search/?api=1&query=Mleko+Specialty+Coffee+House+and+Bakery+Ahmedabad',
    mapUrl: 'https://www.google.com/maps/search/?api=1&query=Mleko+Specialty+Coffee+House+and+Bakery+Ahmedabad',
  },
  {
    name: 'La\' Patron Cafe',
    address: 'South Bopal, Ahmedabad, Gujarat, India',
    imageUrl: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=1200&q=80',
    exploreUrl: 'https://www.google.com/maps/search/?api=1&query=La+Patron+Cafe+Ahmedabad',
    mapUrl: 'https://www.google.com/maps/search/?api=1&query=La+Patron+Cafe+Ahmedabad',
  },
  {
    name: 'Campanella - Rooftop Restro-Cafe',
    address: 'Ahmedabad, Gujarat, India',
    imageUrl: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=1200&q=80',
    exploreUrl: 'https://www.google.com/maps/search/?api=1&query=Campanella+Rooftop+Restro+Cafe+Ahmedabad',
    mapUrl: 'https://www.google.com/maps/search/?api=1&query=Campanella+Rooftop+Restro+Cafe+Ahmedabad',
  },
  {
    name: 'Surkhi Cafe',
    address: 'Ahmedabad, Gujarat, India',
    imageUrl: 'https://images.unsplash.com/photo-1511920170033-f8396924c348?auto=format&fit=crop&w=1200&q=80',
    exploreUrl: 'https://www.google.com/maps/search/?api=1&query=Surkhi+Cafe+Ahmedabad',
    mapUrl: 'https://www.google.com/maps/search/?api=1&query=Surkhi+Cafe+Ahmedabad',
  },
  {
    name: 'Cafe De Italiano',
    address: 'Ahmedabad, Gujarat, India',
    imageUrl: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=1200&q=80',
    exploreUrl: 'https://www.google.com/maps/search/?api=1&query=Cafe+De+Italiano+Ahmedabad',
    mapUrl: 'https://www.google.com/maps/search/?api=1&query=Cafe+De+Italiano+Ahmedabad',
  },
  {
    name: 'OOROO Cafe',
    address: 'Ahmedabad, Gujarat, India',
    imageUrl: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=1200&q=80',
    exploreUrl: 'https://www.google.com/maps/search/?api=1&query=OOROO+Cafe+Ahmedabad',
    mapUrl: 'https://www.google.com/maps/search/?api=1&query=OOROO+Cafe+Ahmedabad',
  },
  {
    name: 'Sea Salt Cafe',
    address: 'Mumatpura, Ahmedabad, Gujarat, India',
    imageUrl: 'https://images.unsplash.com/photo-1511920170033-f8396924c348?auto=format&fit=crop&w=1200&q=80',
    exploreUrl: 'https://www.google.com/maps/search/?api=1&query=Sea+Salt+Cafe+Ahmedabad',
    mapUrl: 'https://www.google.com/maps/search/?api=1&query=Sea+Salt+Cafe+Ahmedabad',
  },
  {
    name: 'Cavo Restro Cafe',
    address: 'Mumatpura, Ahmedabad, Gujarat, India',
    imageUrl: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=1200&q=80',
    exploreUrl: 'https://www.google.com/maps/search/?api=1&query=Cavo+Restro+Cafe+Ahmedabad',
    mapUrl: 'https://www.google.com/maps/search/?api=1&query=Cavo+Restro+Cafe+Ahmedabad',
  },
  {
    name: 'The Orbis Cafe',
    address: 'Ahmedabad, Gujarat, India',
    imageUrl: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=1200&q=80',
    exploreUrl: 'https://www.google.com/maps/search/?api=1&query=The+Orbis+Cafe+Ahmedabad',
    mapUrl: 'https://www.google.com/maps/search/?api=1&query=The+Orbis+Cafe+Ahmedabad',
  },
  {
    name: 'Java+',
    address: 'Ahmedabad, Gujarat, India',
    imageUrl: 'https://images.unsplash.com/photo-1511920170033-f8396924c348?auto=format&fit=crop&w=1200&q=80',
    exploreUrl: 'https://www.google.com/maps/search/?api=1&query=Java%2B+Ahmedabad',
    mapUrl: 'https://www.google.com/maps/search/?api=1&query=Java%2B+Ahmedabad',
  },
  {
    name: 'Cafe Natarani',
    address: 'Usmanpura, Ahmedabad, Gujarat, India',
    imageUrl: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=1200&q=80',
    exploreUrl: 'https://www.google.com/maps/search/?api=1&query=Cafe+Natarani+Ahmedabad',
    mapUrl: 'https://www.google.com/maps/search/?api=1&query=Cafe+Natarani+Ahmedabad',
  },
  {
    name: 'The Greenstraw House',
    address: 'Ahmedabad, Gujarat, India',
    imageUrl: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=1200&q=80',
    exploreUrl: 'https://www.google.com/maps/search/?api=1&query=The+Greenstraw+House+Ahmedabad',
    mapUrl: 'https://www.google.com/maps/search/?api=1&query=The+Greenstraw+House+Ahmedabad',
  },
  {
    name: 'Zoca Cafe & Resto',
    address: 'Ahmedabad, Gujarat, India',
    imageUrl: 'https://images.unsplash.com/photo-1511920170033-f8396924c348?auto=format&fit=crop&w=1200&q=80',
    exploreUrl: 'https://www.google.com/maps/search/?api=1&query=Zoca+Cafe+and+Resto+Ahmedabad',
    mapUrl: 'https://www.google.com/maps/search/?api=1&query=Zoca+Cafe+and+Resto+Ahmedabad',
  },
  {
    name: 'PERQ - Progressive World Cuisine',
    address: 'Ahmedabad, Gujarat, India',
    imageUrl: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=1200&q=80',
    exploreUrl: 'https://www.google.com/maps/search/?api=1&query=PERQ+Progressive+World+Cuisine+Ahmedabad',
    mapUrl: 'https://www.google.com/maps/search/?api=1&query=PERQ+Progressive+World+Cuisine+Ahmedabad',
  },
  {
    name: 'Bellasen Fine Dine Restaurant & Cafe',
    address: 'Ahmedabad, Gujarat, India',
    imageUrl: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=1200&q=80',
    exploreUrl: 'https://www.google.com/maps/search/?api=1&query=Bellasen+Fine+Dine+Restaurant+Cafe+Ahmedabad',
    mapUrl: 'https://www.google.com/maps/search/?api=1&query=Bellasen+Fine+Dine+Restaurant+Cafe+Ahmedabad',
  },
  {
    name: 'Star Coffee',
    address: 'Ahmedabad, Gujarat, India',
    imageUrl: 'https://images.unsplash.com/photo-1511920170033-f8396924c348?auto=format&fit=crop&w=1200&q=80',
    exploreUrl: 'https://www.google.com/maps/search/?api=1&query=Star+Coffee+Ahmedabad',
    mapUrl: 'https://www.google.com/maps/search/?api=1&query=Star+Coffee+Ahmedabad',
  },
];

function renderCafeGallery(searchTerm = '') {
  const gallery = document.getElementById('cafe-gallery');
  if (!gallery) return;

  const query = searchTerm.trim().toLowerCase();
  const filteredCafes = query
    ? cafeLocations.filter((cafe) => {
        const searchText = `${cafe.name} ${cafe.address}`.toLowerCase();
        return query
          .split(/\s+/)
          .filter((term) => term.length)
          .every((term) => searchText.includes(term));
      })
    : cafeLocations;

  if (filteredCafes.length === 0) {
    gallery.innerHTML = `<div class="gallery-empty">No cafes found${query ? ` for "${escapeHtml(searchTerm)}"` : ''}.</div>`;
    return;
  }

  gallery.innerHTML = filteredCafes
    .map((cafe) => `
      <a href="${cafe.exploreUrl}" target="_blank" rel="noreferrer noopener" class="explore-card-link">
        <article class="explore-card">
          <div class="explore-card-copy">
            <span class="card-eyebrow">Cafe</span>
            <h3>${escapeHtml(cafe.name)}</h3>
            <p class="cafe-vibe">${escapeHtml(cafe.vibe || 'Curated coffeehouse with premium atmosphere and calm energy.')}</p>
          </div>
          <span class="button primary card-cta">Get Directions</span>
        </article>
      </a>
    `)
    .join('');
}

// --- Custom cafe persistence and form integration ---
function loadCustomCafes() {
  if (window._customCafesLoaded) return;
  try {
    const raw = localStorage.getItem('sipspot_custom_cafes');
    if (!raw) { window._customCafesLoaded = true; return; }
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) { window._customCafesLoaded = true; return; }
    arr.forEach((c) => {
      if (!c || !c.name) return;
      const exists = cafeLocations.some((x) => x.name && x.name.trim().toLowerCase() === c.name.trim().toLowerCase());
      if (!exists) {
        cafeLocations.push({
          name: String(c.name),
          vibe: String(c.vibe || ''),
          exploreUrl: String(c.mapUrl || c.exploreUrl || c.link || ''),
          mapUrl: String(c.mapUrl || c.exploreUrl || c.link || ''),
        });
      }
    });
  } catch (e) {
    console.warn('Failed to load custom cafes', e);
  }
  window._customCafesLoaded = true;
}

function saveCustomCafe(cafe) {
  try {
    const raw = localStorage.getItem('sipspot_custom_cafes');
    const arr = raw ? JSON.parse(raw) : [];
    arr.push(cafe);
    localStorage.setItem('sipspot_custom_cafes', JSON.stringify(arr));
  } catch (e) { console.warn('Failed to save custom cafe', e); }
}

function updateCafeDatalist() {
  const dl = document.getElementById('cafes-datalist');
  if (!dl) return;
  dl.innerHTML = cafeLocations.map((c) => `<option value="${escapeHtml(c.name)}"></option>`).join('');
}

function initAddCafeForm() {
  const form = document.getElementById('add-cafe-form');
  if (!form) return;
  const nameEl = document.getElementById('add-name');
  const vibeEl = document.getElementById('add-vibe');
  const linkEl = document.getElementById('add-link');
  const msg = document.getElementById('add-cafe-msg');

  function showMessage(text, isError = false) {
    if (!msg) return;
    msg.textContent = text;
    msg.classList.toggle('error', isError);
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = (nameEl.value || '').trim();
    const vibe = (vibeEl.value || '').trim();
    const link = (linkEl.value || '').trim();
    if (!name || !vibe || !link) {
      showMessage('Please fill all fields.', true);
      return;
    }
    // simple url normalization
    const normalizedLink = link;

    // prevent duplicate names
    const exists = cafeLocations.some((c) => c.name && c.name.trim().toLowerCase() === name.toLowerCase());
    if (exists) {
      showMessage('Cafe already exists in the list.', true);
      return;
    }

    const cafe = { name, vibe, mapUrl: normalizedLink, exploreUrl: normalizedLink };
    // persist
    saveCustomCafe(cafe);
    // add to in-memory list
    cafeLocations.push(cafe);

    // update UI: gallery, datalist, and any open spin page
    try {
      const currentQuery = getSearchQuery() || document.getElementById('explore-search-input')?.value || '';
      renderCafeGallery(currentQuery);
      updateCafeDatalist();
    } catch (err) { console.warn(err); }

    showMessage('Cafe added successfully ☕', false);
    form.reset();
    setTimeout(() => { if (msg) msg.textContent = ''; }, 2500);
  });

  // wire instant validation feedback
  [nameEl, vibeEl, linkEl].forEach((el) => {
    el.addEventListener('input', () => { if (msg) msg.textContent = ''; });
  });
}

// Cinematic theme: background canvas and page transition overlay
function initCinematicTheme() {
  if (window._cinematicInited) return;
  const prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReduced) return;

  // background canvas for subtle particles and beans
  const bg = document.getElementById('cinematic-bg');
  const overlay = document.getElementById('cinematic-overlay');
  const canvas = document.getElementById('cinematic-canvas');
  if (!bg || !overlay || !canvas) { window._cinematicInited = true; return; }

  // attach canvas under overlay for particles
  const ctx = canvas.getContext('2d');
  let w=0,h=0,dpr=1;
  let particles = [];

  function resize(){ dpr = window.devicePixelRatio||1; w = canvas.width = Math.floor(window.innerWidth * dpr); h = canvas.height = Math.floor(window.innerHeight * dpr); canvas.style.width = '100%'; canvas.style.height = '100%'; ctx.setTransform(dpr,0,0,dpr,0,0); }
  resize(); window.addEventListener('resize', resize);

  // create slow-moving particles and bean shapes
  function spawnParticle(x,y,options={}){
    const p = Object.assign({ x,y, vx:(Math.random()-0.5)*0.3, vy:(Math.random()-0.6)*0.3, life: 200 + Math.random()*240, size: 1+Math.random()*3, type:'spark', rot: Math.random()*Math.PI*2 }, options);
    particles.push(p);
  }

  // prefill some drifting steam/particles
  for(let i=0;i<60;i++) spawnParticle(Math.random()*window.innerWidth, Math.random()*window.innerHeight, { life: 200+Math.random()*400, size: 0.6+Math.random()*2 });

  let tick=0;

  // lightweight leaf animation (occasional falling groups)
  const leaves = [];
  const MAX_LEAVES = 5;

  function spawnLeafGroup() {
    const count = 3 + Math.floor(Math.random()*2); // 3 or 4
    for (let i=0;i<count;i++) {
      if (leaves.length >= MAX_LEAVES) break;
      const startX = Math.random() * window.innerWidth;
      const size = 12 + Math.random()*28; // px
      const rot = (Math.random()-0.5) * 60; // degrees
      const speed = 0.6 + Math.random()*1.2;
      const drift = (Math.random()-0.5) * 0.8;
      const opacity = 0.5 + Math.random()*0.45;
      const huePick = Math.random();
      const color = huePick < 0.5 ? 'rgba(126,145,95,'+opacity+')' : 'rgba(158,175,97,'+opacity+')';
      leaves.push({ x:startX, y:-40 - Math.random()*80, vx:drift, vy:speed, rot:rot, rotSpeed:(Math.random()-0.5)*0.8, size, life: 600 + Math.random()*800, color, tilt: (Math.random()-0.5)*0.6 });
    }
  }

  // schedule occasional spawns
  (function scheduleNext(){
    const delay = 4000 + Math.random()*7000; // 4-11s
    setTimeout(()=>{ spawnLeafGroup(); scheduleNext(); }, delay);
  })();

  function drawLeaf(ctx, leaf) {
    ctx.save();
    ctx.translate(leaf.x, leaf.y);
    ctx.rotate((leaf.rot + leaf.tilt) * Math.PI/180);
    ctx.scale(1, 0.85);
    const w = leaf.size; const h = leaf.size*0.6;
    const g = ctx.createLinearGradient(-w/2,0,w/2,0);
    g.addColorStop(0, 'rgba(255,255,255,0.02)');
    g.addColorStop(0.2, leaf.color);
    g.addColorStop(1, 'rgba(0,0,0,0.02)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-w/2,0);
    ctx.quadraticCurveTo(0,-h, w/2,0);
    ctx.quadraticCurveTo(0,h*0.6, -w/2,0);
    ctx.fill();
    ctx.restore();
  }

  // integrate leaf updates into main frame loop by wrapping frame
  const originalFrame = frame;
  function frameWithLeaves(){
    tick++;
    ctx.clearRect(0,0,window.innerWidth, window.innerHeight);
    // draw particles (existing logic)
    for(let i=particles.length-1;i>=0;i--){
      const p = particles[i]; p.x += p.vx; p.y += p.vy; p.life -= 1; p.vy -= 0.0002;
      const alpha = Math.max(0, Math.min(1, p.life/300));
      ctx.globalAlpha = alpha * 0.9;
      if (p.type === 'bean'){
        ctx.fillStyle = 'rgba(49,28,15,0.8)'; ctx.beginPath(); ctx.ellipse(p.x, p.y, p.size*2, p.size, p.rot, 0, Math.PI*2); ctx.fill();
      } else {
        ctx.fillStyle = 'rgba(255,245,230,0.06)'; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI*2); ctx.fill();
      }
      if (p.life <= 0) particles.splice(i,1);
    }
    // update and draw leaves
    for (let i=leaves.length-1;i>=0;i--) {
      const l = leaves[i];
      l.x += l.vx; l.y += l.vy; l.vy += 0.002; l.rot += l.rotSpeed; l.life -= 1;
      ctx.globalAlpha = Math.max(0, Math.min(1, l.life/800));
      drawLeaf(ctx, l);
      if (l.y > window.innerHeight + 60 || l.life <= 0) leaves.splice(i,1);
    }
    // occasionally spawn particles as before
    if (tick % 40 === 0) {
      const x = Math.random()<0.5? Math.random()*120 : window.innerWidth - Math.random()*120;
      spawnParticle(x, window.innerHeight - 80, { type: Math.random()>0.85? 'bean':'steam', vx:(Math.random()-0.5)*0.6, vy:-0.6-Math.random()*0.6, size: 1+Math.random()*3, life: 160+Math.random()*200 });
    }
    requestAnimationFrame(frameWithLeaves);
  }
  requestAnimationFrame(frameWithLeaves);

  // page transition: intercept all same-origin internal link clicks
  function startTransition(toUrl){
    window.location.href = toUrl;
  }

  document.addEventListener('click', (e)=>{
    const a = e.target.closest && e.target.closest('a');
    if (!a) return; if (a.target === '_blank' || a.hasAttribute('download')) return; const href = a.getAttribute('href');
    if (!href || href.startsWith('http') && !href.includes(location.host)) return; // external
    // allow anchors and hash navigation to behave normally
    if (href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
    // do not intercept if modifier keys used
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    // preserve behavior for links that target new pages within our site
    e.preventDefault();
    try { startTransition(href); } catch (err){ window.location.href = href; }
  }, { capture:true });

  // cleanup flag
  window._cinematicInited = true;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function continueWithGoogle() {
  const googleOAuthUrl = 'https://accounts.google.com/o/oauth2/v2/auth?'
    + 'client_id=YOUR_GOOGLE_CLIENT_ID&'
    + 'redirect_uri=https%3A%2F%2Fyour-site.com%2Fauth%2Fgoogle%2Fcallback&'
    + 'response_type=token&'
    + 'scope=openid%20email%20profile&'
    + 'prompt=select_account';

  window.location.href = googleOAuthUrl;
}

window.continueWithGoogle = continueWithGoogle;

// --- Spin The Sip: interactive wheel ---
function initSpinPage() {
  if (!window.location.pathname.endsWith('spin.html')) return;

  const datalist = document.getElementById('cafes-datalist');
  const input = document.getElementById('cafe-input');
  const addBtn = document.getElementById('add-cafe');
  const selectedListEl = document.getElementById('selected-list');
  const hint = document.getElementById('selection-hint');
  const spinBtn = document.getElementById('spin-button');
  const wheelCanvas = document.getElementById('wheel-canvas');
  const celebrationCanvas = document.getElementById('celebration-canvas');
  const winnerModal = document.getElementById('winner-modal');
  const winnerName = document.getElementById('winner-name');
  const goToCafe = document.getElementById('go-to-cafe');
  const spinAgain = document.getElementById('spin-again');

  if (!datalist || !input || !addBtn || !wheelCanvas) return;

  // populate datalist with available cafes
  datalist.innerHTML = cafeLocations.map((c) => `<option value="${escapeHtml(c.name)}"></option>`).join('');

  const STORAGE_KEY = 'sipspot_spin_selected';
  let selected = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); // store cafe indices
  selected = Array.isArray(selected) ? selected : [];

  let isSpinning = false;

  const save = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(selected));

  function renderSelected() {
    selectedListEl.innerHTML = '';
    selected.forEach((idx) => {
      const cafe = cafeLocations[idx];
      const chip = document.createElement('div');
      chip.className = 'selected-chip';
      chip.innerHTML = `${escapeHtml(cafe.name)} <span class="remove">✕</span>`;
      chip.querySelector('.remove').addEventListener('click', () => {
        selected = selected.filter((i) => i !== idx);
        save();
        renderSelected();
        renderWheel();
        updateHint();
      });
      selectedListEl.appendChild(chip);
    });
    updateHint();
  }

  function updateHint(msg) {
    const count = selected.length;
    if (msg) {
      hint.textContent = msg;
    } else if (count < 2) {
      hint.textContent = 'Select at least 2 cafes to enable the spin.';
    } else {
      hint.textContent = `Ready — ${count} ${count === 1 ? 'cafe' : 'cafes'} selected.`;
    }
    spinBtn.disabled = count < 2;
  }

  function addCafeByName(name) {
    const idx = cafeLocations.findIndex((c) => c.name.toLowerCase() === String(name || '').trim().toLowerCase());
    if (idx === -1) {
      updateHint('Please choose a cafe from the list.');
      return;
    }
    if (selected.includes(idx)) {
      updateHint('Cafe already selected.');
      return;
    }
    if (selected.length >= 10) {
      updateHint('You can select up to 10 cafes only.');
      return;
    }
    selected.push(idx);
    save();
    renderSelected();
    renderWheel();
  }

  addBtn.addEventListener('click', () => {
    addCafeByName(input.value);
    input.value = '';
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addCafeByName(input.value);
      input.value = '';
    }
  });

  // canvas drawing helpers
  const ctx = wheelCanvas.getContext('2d');
  function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const rect = wheelCanvas.getBoundingClientRect();
    wheelCanvas.width = Math.round(rect.width * dpr);
    wheelCanvas.height = Math.round(rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function renderWheel() {
    resizeCanvas();
    const cw = wheelCanvas.clientWidth;
    const ch = wheelCanvas.clientHeight;
    const cx = cw / 2;
    const cy = ch / 2;
    const r = Math.min(cx, cy) - 6;
    const items = selected.map((i) => cafeLocations[i]);
    const n = items.length || 1;
    ctx.clearRect(0, 0, cw, ch);
    const palette = ['#b87941', '#c89f65', '#ffd88c', '#8c5a2b', '#f3e1c0', '#a9753a'];

    for (let i = 0; i < n; i++) {
      const start = (i / n) * Math.PI * 2 - Math.PI / 2;
      const end = ((i + 1) / n) * Math.PI * 2 - Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, start, end);
      ctx.closePath();
      ctx.fillStyle = palette[i % palette.length];
      ctx.fill();
      // sector label
      ctx.save();
      ctx.translate(cx, cy);
      const mid = (start + end) / 2;
      ctx.rotate(mid);
      ctx.fillStyle = '#1a120e';
      ctx.font = '600 14px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      const name = items[i] ? items[i].name : '';
      wrapText(ctx, name, r - 12, -6, 120);
      ctx.restore();
    }
    // inner circle
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.28, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(6,5,4,0.9)';
    ctx.fill();
  }

  function wrapText(ctx, text, radius, xOffset, maxWidth) {
    // draw short text along radial line
    const words = text.split(' ');
    let line = '';
    let lines = [];
    for (let n = 0; n < words.length; n++) {
      const testLine = line + (line ? ' ' : '') + words[n];
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && line) {
        lines.push(line);
        line = words[n];
      } else {
        line = testLine;
      }
    }
    if (line) lines.push(line);
    const step = 16;
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], radius + xOffset, (i - (lines.length - 1) / 2) * step);
    }
  }

  // spinning logic
  function spinWheel() {
    if (isSpinning) return;
    const n = selected.length;
    if (n < 2) { updateHint('Select at least 2 cafes to spin.'); return; }
    isSpinning = true;
    spinBtn.disabled = true;

    // fair random index
    let rand = Math.random();
    try { const arr = new Uint32Array(1); window.crypto.getRandomValues(arr); rand = arr[0] / 4294967295; } catch (e) {}
    const chosenIndex = Math.floor(rand * n);

    const sectorAngle = 360 / n;
    const targetSectorCenter = chosenIndex * sectorAngle + sectorAngle / 2;
    const spins = Math.floor(Math.random() * 3) + 5; // 5-7 full rotations
    const finalAngle = spins * 360 + (360 - targetSectorCenter) + (Math.random() * (sectorAngle - 8) - (sectorAngle / 2 - 4));

    // animate via CSS transform on the canvas element
    wheelCanvas.style.transition = 'transform 5.6s cubic-bezier(0.1, 0.7, 0.1, 1)';
    wheelCanvas.style.transformOrigin = '50% 50%';
    wheelCanvas.style.transform = `rotate(${finalAngle}deg)`;

    const onEnd = () => {
      wheelCanvas.removeEventListener('transitionend', onEnd);
      // show winner with cinematic celebration (preserve selection logic)
      const cafe = cafeLocations[selected[chosenIndex]];
      // small freeze for dramatic pause, then celebration
      setTimeout(() => {
        try { runCelebration(cafe); } catch (e) { console.warn(e); }
      }, 120);
      isSpinning = false;
    };

    wheelCanvas.addEventListener('transitionend', onEnd);
  }

  function runCelebration(cafe) {
    if (window._isCelebrating) return;
    window._isCelebrating = true;
    const prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // create overlay elements
    const overlay = document.createElement('div'); overlay.className = 'winner-cinematic-overlay'; overlay.setAttribute('aria-hidden','false');
    const canv = document.createElement('canvas'); canv.className = 'winner-canvas'; overlay.appendChild(canv);
    const nameWrap = document.createElement('div'); nameWrap.className = 'winner-name-wrap';
    const nameEl = document.createElement('h1'); nameEl.className = 'winner-name'; nameEl.textContent = cafe.name || '';
    const sub = document.createElement('div'); sub.className = 'winner-sub'; sub.textContent = "Let's go! ☕";
    const ctas = document.createElement('div'); ctas.className = 'winner-cta';
    const goto = document.createElement('a'); goto.className = 'button primary'; goto.textContent = 'GO TO CAFE'; goto.href = cafe.mapUrl || cafe.exploreUrl || '#'; goto.target = '_blank'; goto.rel = 'noreferrer noopener';
    const again = document.createElement('button'); again.className = 'button secondary'; again.textContent = 'SPIN AGAIN';
    ctas.appendChild(goto); ctas.appendChild(again);
    nameWrap.appendChild(nameEl); nameWrap.appendChild(sub); nameWrap.appendChild(ctas);
    overlay.appendChild(nameWrap);
    const flash = document.createElement('div'); flash.className = 'impact-flash'; document.body.appendChild(flash);
    document.body.appendChild(overlay);

    // apply entrance animation to name
    if (!prefersReduced) nameEl.classList.add('name-entrance');

    // particle canvas setup
    const ctx = canv.getContext('2d'); let w=0,h=0,dpr=1; let particles=[]; let rafId=null;
    function resizeCanvas(){ dpr = window.devicePixelRatio||1; w = canv.width = Math.floor(window.innerWidth * dpr); h = canv.height = Math.floor(window.innerHeight * dpr); canv.style.width='100%'; canv.style.height='100%'; ctx.setTransform(dpr,0,0,dpr,0,0); }
    resizeCanvas(); window.addEventListener('resize', resizeCanvas);

    // performance safe particle count
    const isMobile = window.innerWidth < 720 || navigator.userAgent.includes('Mobile');
    const baseCount = isMobile ? 80 : 260;
    const burstCount = Math.floor(baseCount/6);

    function createBurst(x,y,count,colors){
      for(let i=0;i<count;i++){
        const angle = Math.random()*Math.PI*2; const speed = (Math.random()*4 + 2) * (0.7 + Math.random()*0.8);
        const life = 50 + Math.random()*120; const size = 1 + Math.random()*5; const col = colors[Math.floor(Math.random()*colors.length)];
        particles.push({ x,y, vx: Math.cos(angle)*speed, vy: Math.sin(angle)*speed, life, size, col, grav: 0.06, type: Math.random()>0.85?'star':'dot' });
      }
    }

    function drawStar(x,y,r,ctx,fill){ ctx.save(); ctx.translate(x,y); ctx.rotate((Math.random()-0.5)*1.6); ctx.beginPath(); for(let i=0;i<5;i++){ ctx.lineTo(0, -r); ctx.rotate(Math.PI/5); ctx.lineTo(0, -r/2); ctx.rotate(Math.PI/5); } ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); ctx.restore(); }

    // schedule multi-wave bursts
    function scheduleWaves(){
      const colors = ['#ffd88c','#ffd4a3','#ffb86b','#ffdfe6','#f3e1c0','#fff1c9','#ffe08a'];
      const corner = [{x:50,y:50},{x:window.innerWidth-50,y:50},{x:50,y:window.innerHeight-50},{x:window.innerWidth-50,y:window.innerHeight-50}];
      // wave 1: impact flash
      setTimeout(()=>{ flash.classList.add('show'); setTimeout(()=>flash.classList.remove('show'),120); }, 100);
      // multiple bursts across screen
      for(let i=0;i<6;i++){
        setTimeout(()=>{
          // center near name
          const cx = window.innerWidth/2 + (Math.random()-0.5)*240; const cy = window.innerHeight/2 + (Math.random()-0.5)*120;
          createBurst(cx, cy, burstCount+Math.floor(Math.random()*30), colors);
          // side bursts
          createBurst(100 + Math.random()*120, 120 + Math.random()*200, burstCount/2, colors);
          createBurst(window.innerWidth-100 - Math.random()*120, 120 + Math.random()*200, burstCount/2, colors);
          // corners
          const c = corner[Math.floor(Math.random()*corner.length)]; createBurst(c.x + Math.random()*60, c.y + Math.random()*60, burstCount/2, colors);
        }, 120 + i*120);
      }
      // secondary confetti stream
      for(let i=0;i<20;i++) setTimeout(()=>{ createBurst(Math.random()*window.innerWidth, Math.random()*window.innerHeight, 8, ['#fff1c9','#ffd88c','#ffd4a3','#ffb86b']); }, 400 + i*80);
    }

    // animation loop
    function loop(){
      ctx.clearRect(0,0,window.innerWidth, window.innerHeight);
      for(let i=particles.length-1;i>=0;i--){ const p = particles[i]; p.x += p.vx; p.y += p.vy; p.vy += p.grav; p.vx *= 0.995; p.life -= 1; const alpha = Math.max(0, p.life/140);
        if (p.type === 'star') { ctx.globalAlpha = alpha; drawStar(p.x, p.y, p.size, ctx, p.col); }
        else { ctx.globalAlpha = alpha; ctx.fillStyle = p.col; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI*2); ctx.fill(); }
        if (p.life <= 0) particles.splice(i,1);
      }
      rafId = requestAnimationFrame(loop);
    }

    // start waves and loop
    if (!prefersReduced) scheduleWaves(); else { /* reduced: simple subtle pulse */ }
    rafId = requestAnimationFrame(loop);

    // reveal timeline: show big name then keep CTA
    setTimeout(()=>{ nameEl.classList.add('visible'); }, 80);

    // after celebration completes keep overlay visible and wire buttons
    const totalDuration = prefersReduced ? 900 : 2600;
    setTimeout(()=>{
      // stop spawning new bursts, but let particles fade
      // show small persistent actions (buttons already visible)
      // wire again button
      again.addEventListener('click', () => {
        // reset wheel and cleanup
        overlay.remove(); flash.remove(); window._isCelebrating = false;
        // reset wheel transform
        wheelCanvas.style.transition = 'transform 0.6s ease'; wheelCanvas.style.transform = 'rotate(0deg)';
        setTimeout(()=>{ wheelCanvas.style.transition = ''; },700);
      });
      // overlay already appended earlier
      // ensure go-to works (already set)
    }, 120);

    // cleanup after full duration
    setTimeout(()=>{
      // allow particles to fade and then remove canvas
      cancelAnimationFrame(rafId); try{ canv.remove(); }catch(e){}
      // keep name and buttons visible until user dismisses (or click spin again)
    }, totalDuration + 800);
  }

  spinBtn.addEventListener('click', spinWheel);

  document.getElementById('spin-again')?.addEventListener('click', () => {
    winnerModal.classList.add('hidden');
    // reset transform
    wheelCanvas.style.transition = 'transform 0.6s ease';
    wheelCanvas.style.transform = 'rotate(0deg)';
    setTimeout(()=>{ wheelCanvas.style.transition = ''; },700);
  });

  document.getElementById('go-to-cafe')?.addEventListener('click', () => {
    // modal will remain, user can click Spin Again when ready
  });

  // initial render
  renderSelected();
  renderWheel();
  window.addEventListener('resize', renderWheel);
}

window.addEventListener('DOMContentLoaded', initSpinPage);
