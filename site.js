// ============================================
// Mustree Network - Shared Site Layout
// - Injects Navbar/Footer into #site-nav/#site-footer
// - Adds active state based on current pathname
// ============================================

function getCurrentRoute() {
  const path = window.location.pathname || '';
  const last = path.split('/').filter(Boolean).pop();
  return {
    page: last || 'index.html',
    hash: window.location.hash || ''
  };
}

function isActiveHref(href, currentRoute) {
  if (!href) return false;
  const [rawPage, rawHash] = href.split('#');
  const targetPage = rawPage || currentRoute.page;
  if (targetPage !== currentRoute.page) return false;

  if (!rawHash) return true;
  return currentRoute.hash === `#${rawHash}`;
}

function isOverviewHrefActive(href, currentRoute) {
  if (!href) return false;
  const [rawPage, rawHash] = href.split('#');
  const targetPage = rawPage || currentRoute.page;
  if (targetPage !== 'index.html') return false;
  if (currentRoute.page !== 'index.html') return false;

  if (!rawHash) return currentRoute.hash === '';
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
    <svg viewBox="0 0 32 32" fill="none" aria-hidden="true" focusable="false">
      <circle cx="16" cy="16" r="14" stroke="url(#${id})" stroke-width="2"/>
      <path d="M10 16L14 20L22 12" stroke="url(#${id})" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <defs>
        <linearGradient id="${id}" x1="0" y1="0" x2="32" y2="32">
          <stop offset="0%" stop-color="#00D09C"/>
          <stop offset="100%" stop-color="#00B4D8"/>
        </linearGradient>
      </defs>
    </svg>
  `.trim();
}

function renderNavbar() {
  const currentRoute = getCurrentRoute();

  const overviewLinks = [
    { href: 'index.html', label: '홈' },
    { href: 'index.html#features', label: '특징' },
    { href: 'index.html#benefits', label: '장점' },
    { href: 'index.html#services', label: '서비스' },
    { href: 'index.html#pricing', label: '요금제' },
    { href: 'index.html#faq', label: 'FAQ' },
    { href: 'index.html#contact', label: '문의' }
  ];

  const platformLinks = [
    { href: 'network.html', label: '네트워크' },
    { href: 'bridge.html', label: '브릿지' },
    { href: 'staking.html', label: '스테이킹' },
    { href: 'nft.html', label: 'NFT' },
    { href: 'sbt.html', label: 'SBT' },
    { href: 'rwa.html', label: 'RWA' }
  ];

  const developerLinks = [
    { href: 'api.html', label: 'API 카탈로그' },
    { href: 'api-guide.html', label: 'API 가이드' }
  ];

  const overviewActive = currentRoute.page === 'index.html';
  const platformActive = platformLinks.some((l) => isActiveHref(l.href, currentRoute));
  const devActive = developerLinks.some((l) => isActiveHref(l.href, currentRoute));
  const securityActive = isActiveHref('security.html', currentRoute);

  const dropdownMenu = (links, isActive = isActiveHref) =>
    links
      .map((l) => {
        const active = isActive(l.href, currentRoute);
        return `<a href="${escapeHtml(l.href)}" class="dropdown-link ${active ? 'active' : ''}" ${active ? 'aria-current="page"' : ''}>${escapeHtml(l.label)}</a>`;
      })
      .join('');

  return `
    <nav class="navbar">
      <div class="nav-container">
        <a href="index.html" class="logo" aria-label="Mustree Home">
          <div class="logo-icon">
            ${renderLogoSvg('logoGrad')}
          </div>
          <span>Mustree</span>
        </a>

        <div class="nav-links">
          <div class="nav-dropdown ${overviewActive ? 'active' : ''}">
            <button class="nav-dropdown-btn" type="button" aria-haspopup="true" aria-label="소개 메뉴">
              소개
              <svg class="chevron" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
                <path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
            <div class="nav-dropdown-menu" role="menu" aria-label="소개">
              ${dropdownMenu(overviewLinks, isOverviewHrefActive)}
            </div>
          </div>

          <div class="nav-dropdown ${platformActive ? 'active' : ''}">
            <button class="nav-dropdown-btn" type="button" aria-haspopup="true" aria-label="플랫폼 메뉴">
              플랫폼
              <svg class="chevron" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
                <path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
            <div class="nav-dropdown-menu" role="menu" aria-label="플랫폼">
              ${dropdownMenu(platformLinks)}
            </div>
          </div>

          <div class="nav-dropdown ${devActive ? 'active' : ''}">
            <button class="nav-dropdown-btn" type="button" aria-haspopup="true" aria-label="개발자 메뉴">
              개발자
              <svg class="chevron" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
                <path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
            <div class="nav-dropdown-menu" role="menu" aria-label="개발자">
              ${dropdownMenu(developerLinks)}
            </div>
          </div>

          <a href="security.html" class="${securityActive ? 'active' : ''}" ${securityActive ? 'aria-current="page"' : ''}>보안</a>
        </div>

        <div class="nav-actions">
          <a href="dashboard.html" class="btn-nav">대시보드</a>
          <a href="network.html#apply" class="btn-primary-nav">시작하기</a>
        </div>

        <button class="mobile-menu-btn" aria-label="Menu" type="button">
          <span></span>
          <span></span>
          <span></span>
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
              <span>Mustree</span>
            </a>
            <p>기업을 위한 블록체인 인프라와 토큰화 API를 제공합니다. 보안을 타협하지 않으면서 빠르게 구축하세요.</p>
            <div class="social-links">
              <a href="#" aria-label="Twitter">
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
                  <path d="M23 3a10.9 10.9 0 01-3.14 1.53 4.48 4.48 0 00-7.86 3v1A10.66 10.66 0 013 4s-4 9 5 13a11.64 11.64 0 01-7 2c9 5 20 0 20-11.5a4.5 4.5 0 00-.08-.83A7.72 7.72 0 0023 3z"/>
                </svg>
              </a>
              <a href="#" aria-label="GitHub">
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
                </svg>
              </a>
              <a href="#" aria-label="Discord">
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
                  <path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                </svg>
              </a>
            </div>
          </div>

          <div class="footer-links">
            <h4>플랫폼</h4>
            <a href="network.html">네트워크</a>
            <a href="bridge.html">브릿지</a>
            <a href="staking.html">스테이킹</a>
            <a href="nft.html">NFT</a>
            <a href="sbt.html">SBT</a>
            <a href="rwa.html">RWA</a>
          </div>

          <div class="footer-links">
            <h4>개발자</h4>
            <a href="api.html">API 카탈로그</a>
            <a href="api-guide.html">API 가이드</a>
            <a href="index.html#faq">FAQ</a>
          </div>

          <div class="footer-links">
            <h4>회사</h4>
            <a href="security.html">보안</a>
            <a href="index.html#pricing">요금제</a>
            <a href="network.html#apply">문의하기</a>
          </div>
        </div>

        <div class="footer-bottom">
          <p>&copy; 2025 머스트리 네트워크. All rights reserved.</p>
          <a href="index.html" class="made-with">Powered by Mustree</a>
        </div>
      </div>
    </footer>
  `.trim();
}

function injectLayout() {
  const navMount = document.getElementById('site-nav');
  if (navMount) navMount.innerHTML = renderNavbar();

  const footerMount = document.getElementById('site-footer');
  if (footerMount) footerMount.innerHTML = renderFooter();
}

injectLayout();
