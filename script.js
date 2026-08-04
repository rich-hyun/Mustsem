// ============================================
// Mustsem Network - Premium JavaScript
// ============================================

const reducedMotionMedia = window.matchMedia('(prefers-reduced-motion: reduce)');
const mobileNavigationMedia = window.matchMedia('(max-width: 992px)');
const heroVideoMedia = window.matchMedia('(min-width: 768px)');

function onMediaChange(mediaQuery, handler) {
  if (typeof mediaQuery.addEventListener === 'function') {
    mediaQuery.addEventListener('change', handler);
  } else if (typeof mediaQuery.addListener === 'function') {
    mediaQuery.addListener(handler);
  }
}

function getFocusableElements(container) {
  if (!container) return [];

  const selector = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])'
  ].join(',');

  return Array.from(container.querySelectorAll(selector)).filter((element) => {
    if (element.getAttribute('aria-hidden') === 'true') return false;
    return element.getClientRects().length > 0;
  });
}

function trapFocus(container, event) {
  if (event.key !== 'Tab') return;

  const focusable = getFocusableElements(container);
  if (!focusable.length) {
    event.preventDefault();
    container.focus({ preventScroll: true });
    return;
  }

  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  if (!container.contains(document.activeElement)) {
    event.preventDefault();
    (event.shiftKey ? last : first).focus();
  } else if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function syncBodyScrollLock() {
  const drawerOpen = Boolean(document.querySelector('.mobile-menu.active'));
  const dialogOpen = Boolean(document.querySelector('.modal-overlay.active'));
  document.body.classList.toggle('is-scroll-locked', drawerOpen || dialogOpen);
}

document.addEventListener('DOMContentLoaded', function() {
  // Initialize all components
  // (navbar 스크롤 효과는 site.js의 initNavbarScroll이 클래스 기반으로 처리)
  initDialogAccessibility();
  initFAQ();
  initScrollAnimations();
  initMobileMenu();
  initSmoothScroll();
  initCounterAnimation();
  initLiveTicker();
  initHeroVideo();
  initParallax();
  initFloatingCards();
  initScrollProgress();
});

// ============================================
// Hero Video Background
// ============================================
function initHeroVideo() {
  const video = document.querySelector('.hero-video');
  if (!video) return;

  const source = video.querySelector('source');
  if (!source) return;

  video.setAttribute('aria-hidden', 'true');
  video.setAttribute('tabindex', '-1');

  // The home hero intentionally uses its original full-bleed video treatment.
  // Keep this path separate from the deferred decorative-video behavior below.
  if (video.hasAttribute('data-full-bleed')) {
    const markLoaded = () => video.classList.add('loaded');
    const play = () => {
      if (reducedMotionMedia.matches) return;
      const playPromise = video.play();
      if (playPromise && typeof playPromise.catch === 'function') playPromise.catch(() => {});
    };

    video.addEventListener('loadeddata', markLoaded, { once: true });
    video.addEventListener('canplaythrough', markLoaded, { once: true });
    if (video.readyState >= 2) markLoaded();
    onMediaChange(reducedMotionMedia, play);
    play();
    return;
  }

  // Backward-compatible migration: index.html should provide data-src so the
  // browser does not start downloading before this eligibility check.
  if (!source.dataset.src && source.getAttribute('src')) {
    source.dataset.src = source.getAttribute('src');
    source.removeAttribute('src');
    video.load();
  }

  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  let sourceLoaded = false;

  const markLoaded = () => {
    video.classList.add('loaded');
  };

  const shouldLoad = () => {
    const saveData = Boolean(connection && connection.saveData);
    return heroVideoMedia.matches && !reducedMotionMedia.matches && !saveData;
  };

  const unload = () => {
    video.pause();
    video.classList.remove('loaded');
    video.preload = 'none';
    source.removeAttribute('src');
    video.load();
    sourceLoaded = false;
  };

  const reconcile = () => {
    if (!shouldLoad()) {
      unload();
      return;
    }

    const deferredSource = source.dataset.src;
    if (!deferredSource || sourceLoaded) return;

    video.preload = 'auto';
    source.setAttribute('src', deferredSource);
    sourceLoaded = true;
    video.load();

    const playPromise = video.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => {
        // Autoplay can be denied by the browser. The static hero treatment
        // remains usable, so no disruptive error UI is needed.
      });
    }
  };

  video.addEventListener('canplaythrough', markLoaded);
  video.addEventListener('loadeddata', markLoaded);
  onMediaChange(heroVideoMedia, reconcile);
  onMediaChange(reducedMotionMedia, reconcile);
  if (connection && typeof connection.addEventListener === 'function') {
    connection.addEventListener('change', reconcile);
  }

  reconcile();
}

// ============================================
// FAQ Accordion
// ============================================
function initFAQ() {
  const faqItems = Array.from(document.querySelectorAll('.faq-item'));
  if (!faqItems.length) return;

  const questions = [];

  const setExpanded = (item, expanded) => {
    const question = item.querySelector('.faq-question');
    const answer = item.querySelector('.faq-answer');
    if (!question || !answer) return;

    item.classList.toggle('active', expanded);
    question.setAttribute('aria-expanded', String(expanded));
    answer.setAttribute('aria-hidden', String(!expanded));
    answer.style.maxHeight = expanded ? answer.scrollHeight + 'px' : '0px';
  };

  faqItems.forEach((item, index) => {
    const question = item.querySelector('.faq-question');
    const answer = item.querySelector('.faq-answer');
    if (!question || !answer) return;

    const questionId = question.id || 'faq-question-' + (index + 1);
    const answerId = answer.id || 'faq-answer-' + (index + 1);

    question.id = questionId;
    question.type = 'button';
    question.setAttribute('aria-controls', answerId);
    answer.id = answerId;
    answer.setAttribute('role', 'region');
    answer.setAttribute('aria-labelledby', questionId);
    questions.push(question);

    setExpanded(item, item.classList.contains('active'));

    question.addEventListener('click', () => {
      const willExpand = !item.classList.contains('active');
      faqItems.forEach((otherItem) => setExpanded(otherItem, otherItem === item && willExpand));
    });

    question.addEventListener('keydown', (event) => {
      const currentIndex = questions.indexOf(question);
      let targetIndex = null;

      if (event.key === 'ArrowDown') targetIndex = (currentIndex + 1) % questions.length;
      if (event.key === 'ArrowUp') targetIndex = (currentIndex - 1 + questions.length) % questions.length;
      if (event.key === 'Home') targetIndex = 0;
      if (event.key === 'End') targetIndex = questions.length - 1;

      if (targetIndex !== null) {
        event.preventDefault();
        questions[targetIndex].focus();
      }
    });
  });

  let resizeFrame = 0;
  window.addEventListener('resize', () => {
    if (resizeFrame) cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => {
      faqItems.forEach((item) => {
        if (item.classList.contains('active')) setExpanded(item, true);
      });
    });
  }, { passive: true });
}

// ============================================
// Scroll Animations (Intersection Observer)
// ============================================
function initScrollAnimations() {
  const selector = [
    '.section-header',
    '.crypto-card',
    '.feature-item',
    '.stat-card',
    '.solution-item',
    '.solution-phone',
    '.cta-card',
    '.faq-item',
    '.service-card-item',
    '.chart-card',
    '.banner-card'
  ].join(',');

  const animateElements = Array.from(document.querySelectorAll(selector))
    .filter((element) => element.getClientRects().length > 0);

  if (!animateElements.length) return;

  const revealImmediately = () => {
    animateElements.forEach((element) => {
      element.classList.add('animate-in');
      element.classList.remove('reveal-ready');
      element.style.removeProperty('--reveal-delay');
    });
  };

  if (reducedMotionMedia.matches || !('IntersectionObserver' in window)) {
    revealImmediately();
    return;
  }

  const observerOptions = {
    root: null,
    rootMargin: '50px',
    threshold: 0.05
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('animate-in');
        observer.unobserve(entry.target);
      }
    });
  }, observerOptions);

  animateElements.forEach((element) => {
    const siblings = Array.from(element.parentElement ? element.parentElement.children : [])
      .filter((sibling) => sibling.matches && sibling.matches(selector));
    const localIndex = Math.max(0, siblings.indexOf(element));
    const delay = Math.min(localIndex * 45, 135);

    element.style.setProperty('--reveal-delay', delay + 'ms');
    element.classList.add('reveal-ready');
    observer.observe(element);
  });

  onMediaChange(reducedMotionMedia, (event) => {
    if (event.matches) {
      observer.disconnect();
      revealImmediately();
    }
  });
}

// ============================================
// Mobile Menu
// ============================================
function initMobileMenu() {
  const menuBtn = document.querySelector('.mobile-menu-btn');
  const navLinks = document.querySelector('.nav-links');
  const navActions = document.querySelector('.nav-actions');
  if (!menuBtn || document.getElementById('mobile-navigation')) return;

  let isMenuOpen = false;
  let returnFocus = null;

  const mobileMenu = document.createElement('div');
  mobileMenu.className = 'mobile-menu';
  mobileMenu.id = 'mobile-navigation';
  mobileMenu.tabIndex = -1;
  mobileMenu.setAttribute('role', 'dialog');
  mobileMenu.setAttribute('aria-modal', 'true');
  mobileMenu.setAttribute('aria-label', '모바일 전체 메뉴');
  mobileMenu.setAttribute('aria-hidden', 'true');
  mobileMenu.setAttribute('inert', '');
  mobileMenu.innerHTML =
    '<div class="mobile-menu-inner mobile-menu-scroll">' +
      '<button class="mobile-menu-close" type="button" aria-label="모바일 메뉴 닫기">' +
        '<span aria-hidden="true">&times;</span>' +
      '</button>' +
      '<div class="mobile-nav-links"></div>' +
      '<div class="mobile-nav-actions"></div>' +
    '</div>';

  const mobileLinks = mobileMenu.querySelector('.mobile-nav-links');
  const mobileActions = mobileMenu.querySelector('.mobile-nav-actions');

  const toMobileId = (id) => 'mobile-' + id.replace(/^nav-/, '');

  const normalizeClone = (container) => {
    container.querySelectorAll('[id]').forEach((element) => {
      element.id = toMobileId(element.id);
    });

    container.querySelectorAll('[aria-controls]').forEach((element) => {
      const controlledId = element.getAttribute('aria-controls');
      if (controlledId) element.setAttribute('aria-controls', toMobileId(controlledId));
    });

    container.querySelectorAll('.nav-dropdown-btn').forEach((button) => {
      const label = document.createElement('p');
      label.className = button.className + ' mobile-nav-group-label';
      label.textContent = button.textContent.trim();
      button.replaceWith(label);
    });

    container.querySelectorAll('.nav-dropdown-menu').forEach((menu) => {
      menu.hidden = false;
      menu.removeAttribute('role');
      menu.removeAttribute('aria-labelledby');
    });

    container.querySelectorAll('[role="menuitem"]').forEach((link) => {
      link.removeAttribute('role');
    });

    container.querySelectorAll('.nav-divider').forEach((divider) => divider.remove());
  };

  const syncMobileContent = () => {
    mobileLinks.innerHTML = navLinks ? navLinks.innerHTML : '';
    mobileActions.innerHTML = navActions ? navActions.innerHTML : '';
    normalizeClone(mobileLinks);
    normalizeClone(mobileActions);
  };

  syncMobileContent();
  document.body.appendChild(mobileMenu);

  const closeMenu = (restore = true) => {
    if (!isMenuOpen) {
      syncBodyScrollLock();
      return;
    }

    const desktopFallback = document.querySelector('.navbar .logo, #site-nav .logo');
    const focusTarget = restore && returnFocus && returnFocus.isConnected
      ? returnFocus
      : (mobileNavigationMedia.matches ? menuBtn : desktopFallback || menuBtn);
    if (mobileMenu.contains(document.activeElement)) {
      focusTarget.focus({ preventScroll: true });
    }

    isMenuOpen = false;
    menuBtn.classList.remove('active');
    mobileMenu.classList.remove('active');
    menuBtn.setAttribute('aria-expanded', 'false');
    menuBtn.setAttribute('aria-label', '모바일 메뉴 열기');
    mobileMenu.setAttribute('aria-hidden', 'true');
    mobileMenu.setAttribute('inert', '');
    syncBodyScrollLock();
  };

  const openMenu = () => {
    if (isMenuOpen || !mobileNavigationMedia.matches) return;

    syncMobileContent();
    returnFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : menuBtn;
    isMenuOpen = true;
    mobileMenu.removeAttribute('inert');
    mobileMenu.setAttribute('aria-hidden', 'false');
    mobileMenu.classList.add('active');
    menuBtn.classList.add('active');
    menuBtn.setAttribute('aria-expanded', 'true');
    menuBtn.setAttribute('aria-label', '모바일 메뉴 닫기');
    syncBodyScrollLock();

    requestAnimationFrame(() => {
      const firstFocusable = getFocusableElements(mobileMenu)[0];
      (firstFocusable || mobileMenu).focus({ preventScroll: true });
    });
  };

  menuBtn.id = menuBtn.id || 'mobile-menu-toggle';
  menuBtn.setAttribute('aria-controls', mobileMenu.id);
  menuBtn.setAttribute('aria-expanded', 'false');
  menuBtn.setAttribute('aria-label', '모바일 메뉴 열기');
  menuBtn.addEventListener('click', () => {
    if (isMenuOpen) closeMenu();
    else openMenu();
  });

  mobileMenu.addEventListener('click', (event) => {
    if (event.target === mobileMenu) {
      closeMenu();
      return;
    }

    if (event.target.closest('.mobile-menu-close')) {
      closeMenu();
      return;
    }

    const link = event.target.closest('a');
    if (!link) return;

    const sourceLogin = navActions && navActions.querySelector('.nav-login');
    if (
      link.classList.contains('nav-login') &&
      link.getAttribute('href') === '#' &&
      sourceLogin &&
      sourceLogin.getAttribute('href') === '#'
    ) {
      event.preventDefault();
      closeMenu(false);
      sourceLogin.click();
      return;
    }

    closeMenu(false);
  });

  mobileMenu.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeMenu();
      return;
    }
    trapFocus(mobileMenu, event);
  });

  onMediaChange(mobileNavigationMedia, (event) => {
    if (!event.matches) closeMenu(false);
  });

  if (navLinks || navActions) {
    const authObserver = new MutationObserver(() => {
      if (!isMenuOpen) syncMobileContent();
    });
    if (navLinks) authObserver.observe(navLinks, {
      attributes: true,
      childList: true,
      characterData: true,
      subtree: true
    });
    if (navActions) authObserver.observe(navActions, {
      attributes: true,
      childList: true,
      characterData: true,
      subtree: true
    });
  }
}

// ============================================
// Smooth Scroll
// ============================================
function initSmoothScroll() {
  const currentPage = (window.location.pathname.split('/').filter(Boolean).pop() || 'index.html').toLowerCase();

  document.querySelectorAll('a[href*="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      const href = this.getAttribute('href');
      if (!href || href === '#') return;

      // Ignore external protocols
      if (/^(https?:)?\/\//i.test(href) || href.startsWith('mailto:') || href.startsWith('tel:')) return;

      const [pagePart, hashPart] = href.split('#');
      if (!hashPart) return;

      const targetPage = (pagePart.split('/').filter(Boolean).pop() || currentPage).toLowerCase();
      if (targetPage !== currentPage) return;

      const targetElement = document.getElementById(hashPart);
      if (!targetElement) return;

      e.preventDefault();

      const navbar = document.querySelector('.navbar');
      const navHeight = navbar ? navbar.offsetHeight : 0;
      const targetPosition = targetElement.offsetTop - navHeight - 20;
      const behavior = reducedMotionMedia.matches ? 'auto' : 'smooth';

      window.history.pushState(null, '', '#' + hashPart);
      if (!targetElement.matches('a, button, input, select, textarea, [tabindex]')) {
        targetElement.setAttribute('tabindex', '-1');
      }
      targetElement.focus({ preventScroll: true });
      window.scrollTo({ top: targetPosition, behavior });
    });
  });
}

// ============================================
// Counter Animation
// ============================================
const counterAnimationFrames = new Map();

function initCounterAnimation() {
  const counters = Array.from(document.querySelectorAll('.stat-value'));
  if (!counters.length) return;

  counters.forEach((counter) => {
    const original = counter.textContent.trim();
    counter.dataset.counterOriginal = original;
    counter.setAttribute('aria-label', original);
    counter.setAttribute('aria-live', 'off');
  });

  const finishImmediately = () => {
    counters.forEach((counter) => {
      const frame = counterAnimationFrames.get(counter);
      if (frame) cancelAnimationFrame(frame);
      counterAnimationFrames.delete(counter);
      counter.textContent = counter.dataset.counterOriginal || counter.textContent;
      counter.dataset.counterAnimated = 'true';
    });
  };

  if (reducedMotionMedia.matches || !('IntersectionObserver' in window)) {
    finishImmediately();
    return;
  }

  const observerOptions = {
    threshold: 0.5
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        animateCounter(entry.target);
        observer.unobserve(entry.target);
      }
    });
  }, observerOptions);

  counters.forEach((counter) => observer.observe(counter));

  onMediaChange(reducedMotionMedia, (event) => {
    if (event.matches) {
      observer.disconnect();
      finishImmediately();
    }
  });
}

function animateCounter(element) {
  if (!element || element.dataset.counterAnimated === 'true') return;

  const original = element.dataset.counterOriginal || element.textContent.trim();
  const match = original.match(/^([+-]?[\d,]+(?:\.\d+)?)(.*)$/);

  if (!match) return;

  const numberText = match[1];
  const suffix = match[2];
  const targetNum = Number(numberText.replace(/,/g, ''));
  if (!Number.isFinite(targetNum)) return;

  if (reducedMotionMedia.matches) {
    element.textContent = original;
    element.dataset.counterAnimated = 'true';
    return;
  }

  const decimalPart = numberText.split('.')[1] || '';
  const decimals = decimalPart.length;
  const useGrouping = numberText.includes(',');
  const duration = 900;
  const startTime = performance.now();

  const formatValue = (value) => {
    if (decimals === 0) {
      const rounded = Math.round(value);
      return useGrouping
        ? rounded.toLocaleString('en-US', { maximumFractionDigits: 0 })
        : String(rounded);
    }

    return value.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
      useGrouping
    });
  };

  const tick = (now) => {
    const progress = Math.min((now - startTime) / duration, 1);
    const current = easeOutQuart(progress) * targetNum;
    element.textContent = formatValue(current) + suffix;

    if (progress < 1 && !reducedMotionMedia.matches) {
      const frame = requestAnimationFrame(tick);
      counterAnimationFrames.set(element, frame);
      return;
    }

    counterAnimationFrames.delete(element);
    element.textContent = original;
    element.dataset.counterAnimated = 'true';
  };

  const frame = requestAnimationFrame(tick);
  counterAnimationFrames.set(element, frame);
}

function easeOutQuart(t) {
  return 1 - Math.pow(1 - t, 4);
}

// ============================================
// Parallax Effect for Hero
// ============================================
function initParallax() {
  const orbs = document.querySelectorAll('.gradient-orb');
  if (!orbs.length) return;

  const finePointerMedia = window.matchMedia('(min-width: 993px) and (pointer: fine)');
  let frame = 0;
  let pointerX = 0;
  let pointerY = 0;

  const reset = () => {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    orbs.forEach((orb) => orb.style.removeProperty('transform'));
  };

  window.addEventListener('mousemove', (e) => {
    if (reducedMotionMedia.matches || !finePointerMedia.matches) {
      reset();
      return;
    }

    pointerX = (e.clientX / window.innerWidth - 0.5) * 2;
    pointerY = (e.clientY / window.innerHeight - 0.5) * 2;
    if (frame) return;

    frame = requestAnimationFrame(() => {
      orbs.forEach((orb, index) => {
        const speed = (index + 1) * 20;
        orb.style.transform =
          'translate(' + (pointerX * speed) + 'px, ' + (pointerY * speed) + 'px)';
      });
      frame = 0;
    });
  }, { passive: true });

  onMediaChange(reducedMotionMedia, reset);
  onMediaChange(finePointerMedia, (event) => {
    if (!event.matches) reset();
  });
}

// ============================================
// Floating Cards Animation Enhancement
// ============================================
function initFloatingCards() {
  const floatingCards = document.querySelectorAll('.floating-card');
  floatingCards.forEach((card, index) => {
    card.style.animationDelay = (index * -3) + 's';
  });
}

// ============================================
// Generic Dialog Accessibility
// ============================================
function initDialogAccessibility() {
  const overlays = Array.from(document.querySelectorAll('.modal-overlay'));
  if (!overlays.length) return;

  const dialogState = new WeakMap();

  overlays.forEach((overlay, index) => {
    const dialog = overlay.querySelector('.modal-box') || overlay;
    const heading = dialog.querySelector('h1, h2, h3, [data-dialog-title]');

    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.tabIndex = -1;

    if (heading) {
      heading.id = heading.id || 'dialog-title-' + (index + 1);
      dialog.setAttribute('aria-labelledby', heading.id);
    } else if (!dialog.hasAttribute('aria-label')) {
      dialog.setAttribute('aria-label', '대화상자');
    }

    const state = {
      open: false,
      returnFocus: null
    };
    dialogState.set(overlay, state);

    const syncDialogState = () => {
      const isOpen = overlay.classList.contains('active');
      if (isOpen === state.open) {
        syncBodyScrollLock();
        return;
      }

      state.open = isOpen;

      if (isOpen) {
        state.returnFocus = document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
        overlay.removeAttribute('inert');
        overlay.setAttribute('aria-hidden', 'false');
        syncBodyScrollLock();

        requestAnimationFrame(() => {
          const preferred = dialog.querySelector('.modal-close, [data-close]');
          const firstFocusable = getFocusableElements(dialog)[0];
          (preferred || firstFocusable || dialog).focus({ preventScroll: true });
        });
        return;
      }

      if (dialog.contains(document.activeElement)) {
        const focusTarget = state.returnFocus && state.returnFocus.isConnected
          ? state.returnFocus
          : document.querySelector('.navbar .logo, #site-nav .logo');
        if (focusTarget) focusTarget.focus({ preventScroll: true });
      }

      overlay.setAttribute('aria-hidden', 'true');
      overlay.setAttribute('inert', '');
      syncBodyScrollLock();
    };

    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) overlay.classList.remove('active');
    });

    new MutationObserver(syncDialogState).observe(overlay, {
      attributes: true,
      attributeFilter: ['class']
    });

    if (overlay.classList.contains('active')) {
      state.open = false;
      syncDialogState();
    } else {
      overlay.setAttribute('aria-hidden', 'true');
      overlay.setAttribute('inert', '');
    }
  });

  document.addEventListener('keydown', (event) => {
    const activeOverlay = overlays.filter((overlay) => overlay.classList.contains('active')).pop();
    if (!activeOverlay) return;

    const dialog = activeOverlay.querySelector('.modal-box') || activeOverlay;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      activeOverlay.classList.remove('active');
      return;
    }

    trapFocus(dialog, event);
  });
}

// ============================================
// Optional Scroll Progress
// ============================================
function initScrollProgress() {
  const progress = document.querySelector('.scroll-progress');
  if (!progress) return;

  progress.setAttribute('aria-hidden', 'true');
  let frame = 0;

  const update = () => {
    const maxScroll = Math.max(
      document.documentElement.scrollHeight - window.innerHeight,
      0
    );
    const ratio = maxScroll > 0 ? window.scrollY / maxScroll : 0;
    const percent = Math.min(Math.max(ratio, 0), 1) * 100;
    progress.style.width = percent.toFixed(3) + '%';
    frame = 0;
  };

  const requestUpdate = () => {
    if (frame) return;
    frame = requestAnimationFrame(update);
  };

  window.addEventListener('scroll', requestUpdate, { passive: true });
  window.addEventListener('resize', requestUpdate, { passive: true });
  requestUpdate();
}

// ============================================
// Live Ticker Simulation (Delicate Upgrade)
// ============================================
function initLiveTicker() {
  // 1. Balance Ticker (Phone Screen)
  // display:none 처리된 데모 섹션에서는 인터벌을 만들지 않는다
  const balanceElement = document.querySelector('.balance-value');

  if (balanceElement && balanceElement.offsetParent !== null) {
    const originalText = balanceElement.textContent; // "5,500.25 ETH" or similar
    // Extract number part: "5,500.25" -> 5500.25
    let currentBalance = parseFloat(originalText.replace(/[^0-9.]/g, ''));
    
    // Safety check
    if (!isNaN(currentBalance)) {
      setInterval(() => {
        // Random fluctuation: +/- 0.00 to 0.05
        const change = (Math.random() - 0.45) * 0.1;
        currentBalance += change;
        
        // Format with commas and 2 decimal places
        const formatted = currentBalance.toLocaleString('en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        });
        
        // Preserve inner HTML structure (small tag) if possible, or reconstruct
        balanceElement.innerHTML = `${formatted} <small>ETH</small>`;
      }, 3000); // Update every 3 seconds
    }
  }

  // 2. Network Value Ticker (Phone Screen)
  // Look for the specific element containing "$7,892.47"
  const statElements = document.querySelectorAll('.phone-stat strong');
  
  statElements.forEach(el => {
    if (el.offsetParent === null) return;
    if (el.textContent.includes('$')) {
      let value = parseFloat(el.textContent.replace(/[^0-9.]/g, ''));
      
      if (!isNaN(value)) {
        setInterval(() => {
           // Larger fluctuation for dollar value
           const change = (Math.random() - 0.4) * 5;
           value += change;
           
           el.textContent = '$' + value.toLocaleString('en-US', {
             minimumFractionDigits: 2,
             maximumFractionDigits: 2
           });
        }, 2000);
      }
    }
  });
}
