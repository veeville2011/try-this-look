(() => {
  'use strict';

  if (typeof window === 'undefined') return;

  const bannerId = 'nusense-tryon-availability-banner';
  const bannerStyleId = 'nusense-tryon-availability-banner-styles';
  const storageKey = 'nusenseTryOnBannerDismissed';

  if (document.getElementById(bannerId)) return;

  const isDismissed = (() => {
    try {
      return window.sessionStorage && window.sessionStorage.getItem(storageKey) === 'true';
    } catch {
      return false;
    }
  })();

  if (isDismissed) return;

  const isHomePath = (() => {
    try {
      const currentPath = (window.location.pathname || '/').trim();
      const normalizedPath = (currentPath.replace(/\/+$/, '') || '/').trim();
      if (normalizedPath === '/' || normalizedPath === '') return true;

      const shopifyRoot = window?.Shopify?.routes?.root;
      if (shopifyRoot) {
        const normalizedRoot = (String(shopifyRoot).replace(/\/+$/, '') || '/').trim();
        if (normalizedPath === normalizedRoot) return true;
      }

      const homePatterns = ['/index', '/home', '/pages/home'];
      if (homePatterns.some((pattern) => normalizedPath === pattern || normalizedPath.startsWith(`${pattern}/`))) return true;

      const pathParts = normalizedPath.split('/').filter(Boolean);
      return pathParts.length === 0;
    } catch {
      return (window.location.pathname || '/').trim() === '/';
    }
  })();

  if (!isHomePath) return;

  const ensureStyles = () => {
    if (document.getElementById(bannerStyleId)) return;

    const style = document.createElement('style');
    style.id = bannerStyleId;
    style.textContent = `
#${bannerId} {
  position: fixed;
  top: 1.25rem;
  right: 1rem;
  z-index: 99999;
  width: calc(100% - 2rem);
  max-width: 20rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1rem 1.25rem 1rem 1rem;
  border-radius: 1rem;
  border: 1px solid rgba(255, 255, 255, 0.18);
  background: linear-gradient(135deg, #101010, #1f1f1f);
  color: #ffffff;
  box-shadow: 0 15px 45px rgba(0, 0, 0, 0.35);
  opacity: 0;
  transform: translateY(-12px);
  transition: opacity 250ms ease, transform 250ms ease;
}
#${bannerId}.is-visible {
  opacity: 1;
  transform: translateY(0);
}
#${bannerId}.is-leaving {
  opacity: 0;
  transform: translateY(-10px);
}
#${bannerId} .nusense-banner-title {
  font-size: 1rem;
  font-weight: 700;
  margin: 0;
}
#${bannerId} .nusense-banner-subtitle {
  margin: 0.35rem 0 0;
  font-size: 0.9rem;
  color: rgba(255, 255, 255, 0.85);
  line-height: 1.4;
}
@media (min-width: 640px) {
  #${bannerId} {
    right: 1.75rem;
    width: auto;
    max-width: 22rem;
  }
}
@media (prefers-reduced-motion: reduce) {
  #${bannerId} {
    transition: opacity 200ms ease;
    transform: none !important;
  }
}
`;

    document.head.appendChild(style);
  };

  const handleDismiss = (bannerEl) => {
    if (!bannerEl) return;

    try {
      if (bannerEl.__nusenseAutoCloseTimeout) {
        clearTimeout(bannerEl.__nusenseAutoCloseTimeout);
        bannerEl.__nusenseAutoCloseTimeout = null;
      }
    } catch {
      // ignore
    }

    bannerEl.classList.add('is-leaving');

    try {
      window.sessionStorage && window.sessionStorage.setItem(storageKey, 'true');
    } catch {
      // ignore
    }

    window.setTimeout(() => {
      try {
        bannerEl.remove();
      } catch {
        // ignore
      }
    }, 220);
  };

  const createBanner = () => {
    if (!document.body) {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', createBanner, { once: true });
        return;
      }
      setTimeout(createBanner, 100);
      return;
    }

    if (document.getElementById(bannerId)) return;

    ensureStyles();

    const banner = document.createElement('div');
    banner.id = bannerId;
    banner.setAttribute('role', 'status');
    banner.setAttribute('aria-live', 'polite');
    banner.setAttribute('tabindex', '0');
    banner.innerHTML = `
<div class="nusense-banner-content">
  <div class="nusense-banner-header">
    <div class="nusense-banner-copy">
      <p class="nusense-banner-title">Essayage virtuel disponible</p>
      <p class="nusense-banner-subtitle">Découvrez notre nouvelle expérience Try-On immersive directement sur la page d'accueil.</p>
    </div>
  </div>
</div>
`;

    banner.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') handleDismiss(banner);
    });

    document.body.appendChild(banner);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!banner.parentNode) return;
        banner.classList.add('is-visible');
        banner.__nusenseAutoCloseTimeout = window.setTimeout(() => handleDismiss(banner), 10000);
      });
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createBanner, { once: true });
    return;
  }

  createBanner();
})();


