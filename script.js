// ============================================
// Mustsem Network - Premium JavaScript
// ============================================

document.addEventListener('DOMContentLoaded', function() {
  // Initialize all components
  // (navbar 스크롤 효과는 site.js의 initNavbarScroll이 클래스 기반으로 처리)
  initFAQ();
  initScrollAnimations();
  initMobileMenu();
  initSmoothScroll();
  initCounterAnimation();
  initLiveTicker();
  initHeroVideo();
});

// ============================================
// Hero Video Background
// ============================================
function initHeroVideo() {
  const video = document.querySelector('.hero-video');
  if (!video) return;

  // Mobile: disable video to save bandwidth (under 768px)
  if (window.innerWidth < 768) {
    video.remove();
    return;
  }

  // Fade in video when loaded
  video.addEventListener('canplaythrough', () => {
    video.classList.add('loaded');
  });

  // If already loaded (from cache)
  if (video.readyState >= 3) {
    video.classList.add('loaded');
  }
}

// ============================================
// FAQ Accordion
// ============================================
function initFAQ() {
  const faqItems = document.querySelectorAll('.faq-item');

  const syncExpanded = () => {
    faqItems.forEach(item => {
      const q = item.querySelector('.faq-question');
      if (q) q.setAttribute('aria-expanded', String(item.classList.contains('active')));
    });
  };

  faqItems.forEach(item => {
    const question = item.querySelector('.faq-question');
    if (!question) return;

    question.addEventListener('click', () => {
      // Close other items
      faqItems.forEach(otherItem => {
        if (otherItem !== item && otherItem.classList.contains('active')) {
          otherItem.classList.remove('active');
        }
      });

      // Toggle current item
      item.classList.toggle('active');
      syncExpanded();
    });
  });

  syncExpanded();
}

// ============================================
// Scroll Animations (Intersection Observer)
// ============================================
function initScrollAnimations() {
  const observerOptions = {
    root: null,
    rootMargin: '50px',  // 화면 진입 전 미리 애니메이션 시작
    threshold: 0.05      // 5%만 보여도 시작
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('animate-in');
        observer.unobserve(entry.target);
      }
    });
  }, observerOptions);

  // Elements to animate
  const animateElements = document.querySelectorAll(`
    .section-header,
    .crypto-card,
    .feature-item,
    .stat-card,
    .solution-item,
    .solution-phone,
    .cta-card,
    .faq-item,
    .portfolio-card,
    .service-card-item,
    .chart-card,
    .banner-card
  `);

  animateElements.forEach((el, index) => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(20px)';  // 30px → 20px (더 빠른 느낌)
    // 지연 시간: 최대 0.15초로 제한 (기존: index * 0.05 = 무한정 증가)
    const delay = Math.min(index * 0.03, 0.15);
    el.style.transition = `all 0.4s cubic-bezier(0.4, 0, 0.2, 1) ${delay}s`;
    observer.observe(el);
  });

  // Add CSS for animated state
  const style = document.createElement('style');
  style.textContent = `
    .animate-in {
      opacity: 1 !important;
      transform: translateY(0) !important;
    }
  `;
  document.head.appendChild(style);
}

// ============================================
// Mobile Menu
// ============================================
function initMobileMenu() {
  const menuBtn = document.querySelector('.mobile-menu-btn');
  const navLinks = document.querySelector('.nav-links');
  const navActions = document.querySelector('.nav-actions');
  let isMenuOpen = false;

  // Create mobile menu container
  const mobileMenu = document.createElement('div');
  mobileMenu.className = 'mobile-menu';
  mobileMenu.innerHTML = `
    <div class="mobile-menu-inner">
      <div class="mobile-nav-links"></div>
      <div class="mobile-nav-actions"></div>
    </div>
  `;

  // Clone nav links and actions
  if (navLinks) {
    mobileMenu.querySelector('.mobile-nav-links').innerHTML = navLinks.innerHTML;
  }
  if (navActions) {
    mobileMenu.querySelector('.mobile-nav-actions').innerHTML = navActions.innerHTML;
  }

  document.body.appendChild(mobileMenu);

  // Add mobile menu styles
  const style = document.createElement('style');
  style.textContent = `
    .mobile-menu {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(10, 11, 15, 0.98);
      backdrop-filter: blur(20px);
      z-index: 999;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      visibility: hidden;
      transition: all 0.3s ease;
    }

    .mobile-menu.active {
      opacity: 1;
      visibility: visible;
    }

    .mobile-menu-inner {
      text-align: center;
    }

    .mobile-nav-links {
      display: flex;
      flex-direction: column;
      gap: 24px;
      margin-bottom: 32px;
    }

    .mobile-nav-links a {
      font-size: 24px;
      font-weight: 600;
      color: var(--text-primary);
      transition: color 0.3s ease;
    }

    .mobile-nav-links a:hover {
      color: var(--accent-primary);
    }

    .mobile-nav-actions {
      display: flex;
      flex-direction: column;
      gap: 16px;
      align-items: center;
    }

    .mobile-menu-btn.active span:nth-child(1) {
      transform: rotate(45deg) translate(5px, 5px);
    }

    .mobile-menu-btn.active span:nth-child(2) {
      opacity: 0;
    }

    .mobile-menu-btn.active span:nth-child(3) {
      transform: rotate(-45deg) translate(5px, -5px);
    }
  `;
  document.head.appendChild(style);

  // Toggle menu
  menuBtn.setAttribute('aria-expanded', 'false');
  menuBtn.addEventListener('click', () => {
    isMenuOpen = !isMenuOpen;
    menuBtn.classList.toggle('active');
    mobileMenu.classList.toggle('active');
    menuBtn.setAttribute('aria-expanded', String(isMenuOpen));
    document.body.style.overflow = isMenuOpen ? 'hidden' : '';
  });

  // Close menu on link click
  mobileMenu.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      isMenuOpen = false;
      menuBtn.classList.remove('active');
      mobileMenu.classList.remove('active');
      menuBtn.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    });
  });
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

      window.history.pushState(null, '', `#${hashPart}`);
      window.scrollTo({ top: targetPosition, behavior: 'smooth' });
    });
  });
}

// ============================================
// Counter Animation
// ============================================
function initCounterAnimation() {
  const counters = document.querySelectorAll('.stat-value');

  const observerOptions = {
    threshold: 0.5
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        animateCounter(entry.target);
        observer.unobserve(entry.target);
      }
    });
  }, observerOptions);

  counters.forEach(counter => observer.observe(counter));
}

function animateCounter(element) {
  const text = element.textContent;
  const match = text.match(/^([\d.]+)/);

  if (!match) return;

  const targetNum = parseFloat(match[1]);
  const suffix = text.replace(match[1], '');
  const duration = 1200;  // 2000ms → 1200ms (더 빠르게)
  const steps = 40;       // 60 → 40 (더 빠르게)
  let current = 0;
  let step = 0;

  const timer = setInterval(() => {
    step++;
    current = easeOutQuart(step / steps) * targetNum;

    if (step >= steps) {
      current = targetNum;
      clearInterval(timer);
    }

    // Format number
    let displayNum;
    if (targetNum >= 100) {
      displayNum = Math.round(current);
    } else if (targetNum >= 10) {
      displayNum = current.toFixed(1);
    } else {
      displayNum = current.toFixed(1);
    }

    element.textContent = displayNum + suffix;
  }, duration / steps);
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

  window.addEventListener('mousemove', (e) => {
    const x = (e.clientX / window.innerWidth - 0.5) * 2;
    const y = (e.clientY / window.innerHeight - 0.5) * 2;

    orbs.forEach((orb, index) => {
      const speed = (index + 1) * 20;
      orb.style.transform = `translate(${x * speed}px, ${y * speed}px)`;
    });
  });
}

// Initialize parallax on desktop only
if (window.innerWidth > 992) {
  initParallax();
}

// ============================================
// Loading Animation
// ============================================
window.addEventListener('load', () => {
  document.body.classList.add('loaded');

  // Add loaded styles
  const loadStyle = document.createElement('style');
  loadStyle.textContent = `
    body:not(.loaded) {
      overflow: hidden;
    }

    body.loaded .hero-content,
    body.loaded .hero-visual {
      animation: fadeInUp 0.8s ease-out forwards;
    }

    body.loaded .hero-visual {
      animation-delay: 0.2s;
    }

    @keyframes fadeInUp {
      from {
        opacity: 0;
        transform: translateY(40px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
  `;
  document.head.appendChild(loadStyle);
});

// ============================================
// Floating Cards Animation Enhancement
// ============================================
const floatingCards = document.querySelectorAll('.floating-card');

floatingCards.forEach((card, index) => {
  card.style.animationDelay = `${index * -3}s`;
});

// Add mouse movement effect to floating cards
if (floatingCards.length) {
  document.querySelector('.hero')?.addEventListener('mousemove', (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;

    floatingCards.forEach((card, index) => {
      const speed = (index + 1) * 15;
      card.style.transform = `translate(${x * speed}px, ${y * speed}px)`;
    });
  });
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