// ============================================
// Mustsem Network - Shared Site Layout
// - Injects Navbar/Footer into #site-nav/#site-footer
// - Adds active state based on the current route
// ============================================

function normalizeRoutePage(value) {
  const cleanPath = String(value || '')
    .split(/[?#]/, 1)[0]
    .replace(/\\/g, '/')
    .replace(/\/+$/, '');
  const lastSegment = cleanPath.split('/').filter(Boolean).pop() || 'index';
  return lastSegment.replace(/\.html$/i, '') || 'index';
}

function getCurrentRoute() {
  const path = window.location.pathname || '';
  const last = path.split('/').filter(Boolean).pop();
  return {
    page: normalizeRoutePage(last || 'index'),
    hash: window.location.hash || ''
  };
}

function isActiveHref(href, currentRoute) {
  if (!href) return false;
  const [rawPage, rawHash] = href.split('#', 2);
  const targetPage = normalizeRoutePage(rawPage || currentRoute.page);
  if (targetPage !== currentRoute.page) return false;

  if (!rawHash) return true;
  return currentRoute.hash === `#${rawHash}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function renderLogoSvg(gradientId) {
  const id = escapeHtml(gradientId);
  return `
    <svg viewBox="0 0 512 512" fill="none" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="${id}" x1="70" y1="40" x2="442" y2="472" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#00D09C"/>
          <stop offset="100%" stop-color="#00B4D8"/>
        </linearGradient>
      </defs>
      <path d="M256 40L442 148V364L256 472L70 364V148L256 40Z" 
            stroke="url(#${id})" 
            stroke-width="40" 
            stroke-linecap="round" 
            stroke-linejoin="round"/>
      <path d="M166 340V170L256 260L346 170V340" 
            stroke="url(#${id})" 
            stroke-width="40" 
            stroke-linecap="round" 
            stroke-linejoin="round"/>
    </svg>
  `.trim();
}

function renderNavbar() {
  const currentRoute = getCurrentRoute();

  const platformLinks = [
    { href: 'network.html', label: '네트워크' },
    { href: 'bridge.html', label: '브릿지' },
    { href: 'staking.html', label: '스테이킹' },
    { href: 'nft.html', label: 'NFT' },
    { href: 'sbt.html', label: 'SBT' },
    { href: 'rwa.html', label: 'RWA' },
    { href: 'ipfs.html', label: 'IPFS' }
  ];

  const developerLinks = [
    { href: 'api.html', label: 'API 카탈로그' },
    { href: 'api-guide.html', label: 'API 가이드' }
  ];

  const platformActive = platformLinks.some((l) => isActiveHref(l.href, currentRoute));
  const devActive = developerLinks.some((l) => isActiveHref(l.href, currentRoute));
  const securityActive = isActiveHref('security.html', currentRoute);

  const dropdownMenu = (links) =>
    links
      .map((l) => {
        const active = isActiveHref(l.href, currentRoute);
        return `<a href="${escapeHtml(l.href)}" class="dropdown-link ${active ? 'active' : ''}" role="menuitem" ${active ? 'aria-current="page"' : ''}>${escapeHtml(l.label)}</a>`;
      })
      .join('');

  return `
    <nav class="navbar" aria-label="주요 탐색">
      <div class="nav-container">
        <a href="index.html" class="logo" aria-label="MUSTSEM 홈">
          <div class="logo-icon">
            ${renderLogoSvg('logoGrad')}
          </div>
          <span>MUSTSEM</span>
        </a>

        <div class="nav-links">
          <div class="nav-dropdown ${platformActive ? 'active' : ''}">
            <button id="nav-platform-button" class="nav-dropdown-btn" type="button"
                    aria-haspopup="menu" aria-controls="nav-platform-menu" aria-expanded="false">
              플랫폼
              <svg class="chevron" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
                <path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
            <div id="nav-platform-menu" class="nav-dropdown-menu" role="menu" aria-labelledby="nav-platform-button">
              ${dropdownMenu(platformLinks)}
            </div>
          </div>

          <div class="nav-dropdown ${devActive ? 'active' : ''}">
            <button id="nav-developer-button" class="nav-dropdown-btn" type="button"
                    aria-haspopup="menu" aria-controls="nav-developer-menu" aria-expanded="false">
              개발자
              <svg class="chevron" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
                <path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
            <div id="nav-developer-menu" class="nav-dropdown-menu" role="menu" aria-labelledby="nav-developer-button">
              ${dropdownMenu(developerLinks)}
            </div>
          </div>

          <a href="security.html" class="${securityActive ? 'active' : ''}" ${securityActive ? 'aria-current="page"' : ''}>보안</a>
        </div>

        <div class="nav-actions">
          <a href="dashboard.html" class="btn-nav">대시보드</a>
          <span class="nav-divider"></span>
          <a href="login.html" class="btn-nav nav-login">로그인</a>
          <a href="signup.html" class="btn-primary-nav">회원가입</a>
        </div>

        <button id="mobile-menu-toggle" class="mobile-menu-btn" type="button"
                aria-label="모바일 메뉴 열기" aria-controls="mobile-navigation" aria-expanded="false">
          <span aria-hidden="true"></span>
          <span aria-hidden="true"></span>
          <span aria-hidden="true"></span>
        </button>
      </div>
    </nav>
  `.trim();
}

function renderFooter() {
  return `
    <footer class="footer">
      <div class="container">
        <div class="footer-grid">
          <div class="footer-brand">
            <a href="index.html" class="logo">
              <div class="logo-icon">
                ${renderLogoSvg('footerLogoGrad')}
              </div>
              <span>MUSTSEM</span>
            </a>
            <p>기업을 위한 블록체인 인프라와 토큰화 API를 제공합니다. 보안을 타협하지 않으면서 빠르게 구축하세요.</p>
          </div>

          <div class="footer-links">
            <h4>플랫폼</h4>
            <a href="network.html">네트워크</a>
            <a href="bridge.html">브릿지</a>
            <a href="staking.html">스테이킹</a>
            <a href="nft.html">NFT</a>
            <a href="sbt.html">SBT</a>
            <a href="rwa.html">RWA</a>
            <a href="ipfs.html">IPFS</a>
          </div>

          <div class="footer-links">
            <h4>개발자</h4>
            <a href="api.html">API 카탈로그</a>
            <a href="api-guide.html">API 가이드</a>
          </div>

          <div class="footer-links">
            <h4>회사</h4>
            <a href="security.html">보안</a>
            <a href="network.html#apply">문의하기</a>
            <a href="privacy.html">개인정보처리방침</a>
            <a href="terms.html">이용약관</a>
          </div>
        </div>

        <div class="footer-bottom">
          <p>&copy; ${new Date().getFullYear()} 머스트셈 네트워크. All rights reserved.</p>
          <a href="index.html" class="made-with">Powered by MUSTSEM</a>
        </div>
      </div>
    </footer>
  `.trim();
}

function ensureMainContentTarget(navMount, footerMount) {
  let main = document.querySelector('main');

  // The home page historically placed its sections directly under <body>.
  // Wrap only the nodes between the shared shell mounts so the skip target is
  // semantic without touching page-owned scripts or the footer.
  if (!main && navMount && footerMount) {
    const contentNodes = [];
    let node = navMount.nextSibling;
    while (node && node !== footerMount) {
      contentNodes.push(node);
      node = node.nextSibling;
    }

    if (contentNodes.some((contentNode) => contentNode.nodeType === Node.ELEMENT_NODE)) {
      main = document.createElement('main');
      navMount.insertAdjacentElement('afterend', main);
      contentNodes.forEach((contentNode) => main.appendChild(contentNode));
    }
  }

  main = main || document.querySelector('section');
  if (!main) return null;

  if (!main.id) main.id = 'main-content';
  if (!main.hasAttribute('tabindex')) main.setAttribute('tabindex', '-1');
  return main;
}

function ensureSkipLink(navMount, mainTarget) {
  if (!navMount || !mainTarget) return;

  let skipLink = document.querySelector('.skip-link');
  if (!skipLink) {
    skipLink = document.createElement('a');
    skipLink.className = 'skip-link';
    skipLink.textContent = '본문 바로가기';
    navMount.insertAdjacentElement('beforebegin', skipLink);
  }

  skipLink.href = '#' + mainTarget.id;
  skipLink.addEventListener('click', () => {
    // Let the native fragment jump happen, then move the accessibility focus
    // without triggering a second scroll.
    window.requestAnimationFrame(() => mainTarget.focus({ preventScroll: true }));
  });
}

function injectLayout() {
  const navMount = document.getElementById('site-nav');
  if (navMount) navMount.innerHTML = renderNavbar();

  const footerMount = document.getElementById('site-footer');
  if (footerMount) footerMount.innerHTML = renderFooter();

  const mainTarget = ensureMainContentTarget(navMount, footerMount);
  ensureSkipLink(navMount, mainTarget);
}

function initNavbarDropdowns() {
  const dropdowns = Array.from(document.querySelectorAll('.navbar .nav-dropdown'));
  if (!dropdowns.length) return;

  let suppressFocusOpen = false;

  const getParts = (dropdown) => ({
    button: dropdown.querySelector('.nav-dropdown-btn'),
    menu: dropdown.querySelector('.nav-dropdown-menu'),
    items: Array.from(dropdown.querySelectorAll('.dropdown-link'))
  });

  const closeDropdown = (dropdown) => {
    const { button, menu } = getParts(dropdown);
    if (!button || !menu) return;
    dropdown.dataset.pinned = 'false';
    dropdown.classList.remove('open');
    button.setAttribute('aria-expanded', 'false');
    menu.hidden = true;
  };

  const closeOthers = (exception) => {
    dropdowns.forEach((dropdown) => {
      if (dropdown !== exception) closeDropdown(dropdown);
    });
  };

  const openDropdown = (dropdown, { pinned = false } = {}) => {
    const { button, menu } = getParts(dropdown);
    if (!button || !menu) return;
    closeOthers(dropdown);
    dropdown.dataset.pinned = String(pinned);
    dropdown.classList.add('open');
    menu.hidden = false;
    button.setAttribute('aria-expanded', 'true');
  };

  const closeAndFocusTrigger = (dropdown) => {
    const { button } = getParts(dropdown);
    suppressFocusOpen = true;
    closeDropdown(dropdown);
    if (button) button.focus();
    Promise.resolve().then(() => { suppressFocusOpen = false; });
  };

  dropdowns.forEach((dropdown) => {
    const { button, menu, items } = getParts(dropdown);
    if (!button || !menu) return;

    closeDropdown(dropdown);

    dropdown.addEventListener('mouseenter', () => {
      openDropdown(dropdown, { pinned: dropdown.dataset.pinned === 'true' });
    });

    dropdown.addEventListener('mouseleave', () => {
      if (!dropdown.contains(document.activeElement)) closeDropdown(dropdown);
    });

    dropdown.addEventListener('focusin', () => {
      if (!suppressFocusOpen) {
        openDropdown(dropdown, { pinned: dropdown.dataset.pinned === 'true' });
      }
    });

    dropdown.addEventListener('focusout', () => {
      window.requestAnimationFrame(() => {
        if (!dropdown.contains(document.activeElement) && !dropdown.matches(':hover')) {
          closeDropdown(dropdown);
        }
      });
    });

    button.addEventListener('click', (event) => {
      event.preventDefault();
      const isPinnedOpen =
        dropdown.dataset.pinned === 'true' &&
        button.getAttribute('aria-expanded') === 'true';
      if (isPinnedOpen) {
        closeDropdown(dropdown);
      } else {
        openDropdown(dropdown, { pinned: true });
      }
    });

    button.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        openDropdown(dropdown);
        const item = event.key === 'ArrowDown' ? items[0] : items[items.length - 1];
        if (item) item.focus();
      } else if (event.key === 'Escape' && button.getAttribute('aria-expanded') === 'true') {
        event.preventDefault();
        closeAndFocusTrigger(dropdown);
      }
    });

    menu.addEventListener('keydown', (event) => {
      const currentIndex = items.indexOf(document.activeElement);
      let nextIndex = null;

      if (event.key === 'ArrowDown') {
        nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % items.length;
      } else if (event.key === 'ArrowUp') {
        nextIndex = currentIndex < 0 ? items.length - 1 : (currentIndex - 1 + items.length) % items.length;
      } else if (event.key === 'Home') {
        nextIndex = 0;
      } else if (event.key === 'End') {
        nextIndex = items.length - 1;
      }

      if (nextIndex !== null && items[nextIndex]) {
        event.preventDefault();
        items[nextIndex].focus();
      }
    });

    menu.addEventListener('click', (event) => {
      if (event.target.closest('a')) closeDropdown(dropdown);
    });
  });

  document.addEventListener('pointerdown', (event) => {
    dropdowns.forEach((dropdown) => {
      if (!dropdown.contains(event.target)) closeDropdown(dropdown);
    });
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    const openDropdownElement = dropdowns.find((dropdown) => {
      const { button } = getParts(dropdown);
      return button && button.getAttribute('aria-expanded') === 'true';
    });
    if (!openDropdownElement) return;

    event.preventDefault();
    closeAndFocusTrigger(openDropdownElement);
  });
}

function initMobileMenuButtonA11y() {
  const button = document.querySelector('.mobile-menu-btn');
  if (!button) return;

  const syncLabel = () => {
    const expanded =
      button.getAttribute('aria-expanded') === 'true' ||
      button.classList.contains('active');
    const expandedValue = String(expanded);
    const label = expanded ? '모바일 메뉴 닫기' : '모바일 메뉴 열기';
    if (button.getAttribute('aria-expanded') !== expandedValue) {
      button.setAttribute('aria-expanded', expandedValue);
    }
    if (button.getAttribute('aria-label') !== label) {
      button.setAttribute('aria-label', label);
    }
  };

  const observer = new MutationObserver(syncLabel);
  observer.observe(button, {
    attributes: true,
    attributeFilter: ['aria-expanded', 'class']
  });
  syncLabel();
}

// 배경(.scrolled)과 숨김(.nav-hidden)을 클래스로만 제어한다.
// rAF throttling + direction hysteresis prevents noisy scroll toggles.
function initNavbarScroll() {
  const navbar = document.querySelector('.navbar');
  if (!navbar) return;

  const mobileMenuButton = document.querySelector('.mobile-menu-btn');
  const reducedMotion = window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : null;
  const hysteresis = 10;
  let lastY = Math.max(window.scrollY, 0);
  let direction = 0;
  let directionOriginY = lastY;
  let frame = 0;

  const isMobileMenuOpen = () =>
    (mobileMenuButton && mobileMenuButton.getAttribute('aria-expanded') === 'true') ||
    Boolean(document.querySelector('.mobile-menu.active'));

  const revealAndReset = () => {
    const y = Math.max(window.scrollY, 0);
    navbar.classList.remove('nav-hidden');
    lastY = y;
    direction = 0;
    directionOriginY = y;
  };

  const updateNavbar = () => {
    frame = 0;
    const y = Math.max(window.scrollY, 0);
    navbar.classList.toggle('scrolled', y > 50);

    const interactionLocked =
      Boolean(reducedMotion && reducedMotion.matches) ||
      navbar.matches(':focus-within') ||
      isMobileMenuOpen();

    if (interactionLocked || y <= 120) {
      revealAndReset();
      return;
    }

    const delta = y - lastY;
    const nextDirection = delta > 0 ? 1 : delta < 0 ? -1 : direction;
    if (nextDirection !== direction) {
      direction = nextDirection;
      directionOriginY = lastY;
    }

    const directionDistance = Math.abs(y - directionOriginY);
    if (directionDistance >= hysteresis) {
      navbar.classList.toggle('nav-hidden', direction > 0);
    }

    lastY = y;
  };

  const requestNavbarUpdate = () => {
    if (!frame) frame = window.requestAnimationFrame(updateNavbar);
  };

  window.addEventListener('scroll', requestNavbarUpdate, { passive: true });
  navbar.addEventListener('focusin', revealAndReset);

  if (mobileMenuButton) {
    const menuStateObserver = new MutationObserver(() => {
      if (isMobileMenuOpen()) revealAndReset();
      requestNavbarUpdate();
    });
    menuStateObserver.observe(mobileMenuButton, {
      attributes: true,
      attributeFilter: ['aria-expanded', 'class']
    });
  }

  if (reducedMotion) {
    const handleMotionPreference = () => {
      if (reducedMotion.matches) revealAndReset();
      requestNavbarUpdate();
    };
    if (typeof reducedMotion.addEventListener === 'function') {
      reducedMotion.addEventListener('change', handleMotionPreference);
    } else if (typeof reducedMotion.addListener === 'function') {
      reducedMotion.addListener(handleMotionPreference);
    }
  }

  updateNavbar();
}

injectLayout();
initMobileMenuButtonA11y();
initNavbarScroll();

// script.js builds the mobile clone on DOMContentLoaded. Initialize only the
// desktop dropdowns in the next task so hidden state is not copied to mobile.
const initDropdownsAfterMobileClone = () => window.setTimeout(initNavbarDropdowns, 0);
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initDropdownsAfterMobileClone, { once: true });
} else {
  initDropdownsAfterMobileClone();
}

// ============================================
// Supabase (인증) 공통 설정
// URL/키 교체 시 여기만 수정 — login/signup/confirm 페이지가 함께 사용
// ============================================
window.MST_SUPABASE = {
  url: 'https://qkqhpzyazsvpggtyhuft.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFrcWhwenlhenN2cGdndHlodWZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4MTU1ODUsImV4cCI6MjA4OTM5MTU4NX0.p1RJDLt4v3O_3PvGhfsFiKnu54OMDD0YJ7WvBpfv3TE'
};

// supabase-js SDK를 필요할 때만 로드하고 클라이언트는 1개만 생성해 공유한다.
// (페이지별로 createClient를 중복 호출하면 GoTrue 인스턴스 중복 경고 발생)
let _mstSbClient = null;
window.mstSupabase = function () {
  if (_mstSbClient) return Promise.resolve(_mstSbClient);
  const create = () => {
    _mstSbClient = window.supabase.createClient(window.MST_SUPABASE.url, window.MST_SUPABASE.anonKey);
    return _mstSbClient;
  };
  if (window.supabase) return Promise.resolve(create());
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
    script.onload = () => resolve(create());
    script.onerror = () => reject(new Error('supabase-js load failed'));
    document.head.appendChild(script);
  });
};

// Supabase Auth UI — 로그인 상태면 네비 버튼을 로그아웃으로 전환
async function initAuthUI() {
  try {
    const sb = await window.mstSupabase();
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return;

    const loginLink = document.querySelector('.nav-login');
    const signupLink = document.querySelector('.btn-primary-nav[href="signup.html"]');
    if (loginLink) {
      loginLink.textContent = '로그아웃';
      loginLink.href = '#';
      loginLink.addEventListener('click', async function(e) {
        e.preventDefault();
        await sb.auth.signOut();
        location.reload();
      });
    }
    if (signupLink) signupLink.style.display = 'none';
  } catch(e) { console.error('Auth UI error:', e); }
}
initAuthUI();
