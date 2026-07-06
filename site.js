// ============================================
// Mustsem Network - Shared Site Layout
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
        <a href="index.html" class="logo" aria-label="MUSTSEM Home">
          <div class="logo-icon">
            ${renderLogoSvg('logoGrad')}
          </div>
          <span>MUSTSEM</span>
        </a>

        <div class="nav-links">
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
          <span class="nav-divider"></span>
          <a href="login.html" class="btn-nav nav-login">로그인</a>
          <a href="signup.html" class="btn-primary-nav">회원가입</a>
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

function injectLayout() {
  const navMount = document.getElementById('site-nav');
  if (navMount) navMount.innerHTML = renderNavbar();

  const footerMount = document.getElementById('site-footer');
  if (footerMount) footerMount.innerHTML = renderFooter();
}

// IMS Style: Navbar scroll effect
// 배경(.scrolled)과 숨김(.nav-hidden)을 클래스로만 제어한다.
// 인라인 스타일을 쓰면 테마 색상(style.css)과 어긋나므로 금지.
function initNavbarScroll() {
  const navbar = document.querySelector('.navbar');
  if (!navbar) return;

  let lastY = window.scrollY;

  const handleScroll = () => {
    const y = window.scrollY;
    navbar.classList.toggle('scrolled', y > 50);
    // 아래로 스크롤하면 숨기고, 위로 스크롤하면 다시 표시
    navbar.classList.toggle('nav-hidden', y > lastY && y > 100);
    lastY = y;
  };

  window.addEventListener('scroll', handleScroll, { passive: true });
  handleScroll(); // Initial check
}

injectLayout();
initNavbarScroll();

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
