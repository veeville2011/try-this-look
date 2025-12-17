(() => {
  'use strict';

  const BUTTON_ID_PREFIX = 'nusense-tryon-btn-';
  const CUSTOM_CSS_STYLE_ID_PREFIX = 'nusense-custom-css-';

  /**
   * We want to avoid double-initializing buttons across theme partial reloads,
   * section rendering, and DOM mutations.
   */
  const INIT_FLAG = 'nusenseInitialized';

  const normalizeUrl = (url) => {
    if (!url) return '';
    return String(url).trim().replace(/\/+$/, '');
  };

  const getWidgetUrl = (buttonEl) => {
    const fromDataset = buttonEl?.dataset?.widgetUrl;
    const fromGlobal = window?.NUSENSE_CONFIG?.widgetUrl;
    const fallback = 'https://try-this-look.vercel.app';

    return normalizeUrl(fromDataset || fromGlobal || fallback);
  };

  const getWidgetOrigin = (widgetUrl) => {
    try {
      return new URL(widgetUrl).origin;
    } catch {
      return null;
    }
  };

  const getClosestThemePrimaryButton = (buttonEl) => {
    if (!buttonEl) return null;

    const productForm = buttonEl.closest('form[action*="/cart/add"]') || document.querySelector('form[action*="/cart/add"]');
    const root = productForm || document;

    const selectors = [
      'button[type="submit"]',
      'button[name="add"]',
      'input[type="submit"]',
      '.product-form__submit',
      '.product-form__cart-submit',
      '#AddToCart',
    ];

    for (const selector of selectors) {
      const elements = Array.from(root.querySelectorAll(selector));
      for (const el of elements) {
        if (!(el instanceof HTMLElement)) continue;
        if (el === buttonEl) continue;
        if (el.id?.startsWith(BUTTON_ID_PREFIX)) continue;
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden') continue;
        if (parseFloat(style.opacity) < 0.1) continue;
        return el;
      }
    }

    return null;
  };

  const applyScopedCustomCss = (buttonId, customCssRaw) => {
    if (!buttonId) return;

    const styleId = `${CUSTOM_CSS_STYLE_ID_PREFIX}${buttonId}`;
    const existing = document.getElementById(styleId);
    if (existing) existing.remove();

    const raw = (customCssRaw || '').toString().trim();
    if (!raw) return;

    const styleEl = document.createElement('style');
    styleEl.id = styleId;

    const scopedSelector = `#${CSS.escape(buttonId)}.nusense-tryon-button`;

    // If the merchant already used the class selector, scope it to this button instance.
    const scopedCss = raw.includes('.nusense-tryon-button')
      ? raw.replace(/\.nusense-tryon-button/g, scopedSelector)
      : `${scopedSelector} { ${raw} }`;

    styleEl.textContent = scopedCss;
    document.head.appendChild(styleEl);
  };

  const coerceCssNumber = (value, unit) => {
    if (value == null) return null;
    const raw = String(value).trim();
    if (!raw) return null;
    if (/^\d+(\.\d+)?(px|rem|em|%)$/.test(raw)) return raw;
    if (/^\d+(\.\d+)?$/.test(raw)) return `${raw}${unit}`;
    return null;
  };

  const applyLayoutConfig = (buttonEl) => {
    if (!buttonEl) return;

    const alignment = buttonEl.dataset.alignment || 'auto';
    const marginTop = buttonEl.dataset.marginTop || '0';
    const marginBottom = buttonEl.dataset.marginBottom || '0';
    const marginLeft = buttonEl.dataset.marginLeft || '0';
    const marginRight = buttonEl.dataset.marginRight || '0';
    const widthPercentRaw = buttonEl.dataset.widthPercent || '';
    const widthPercent = Number.parseInt(String(widthPercentRaw).trim(), 10);
    const isFullWidth = buttonEl.dataset.buttonWidthFull === 'true' || buttonEl.classList.contains('button--full-width');

    if (marginTop !== '0') buttonEl.style.marginTop = `${marginTop}rem`;
    if (marginBottom !== '0') buttonEl.style.marginBottom = `${marginBottom}rem`;
    if (marginLeft !== '0') buttonEl.style.marginLeft = `${marginLeft}rem`;
    if (marginRight !== '0') buttonEl.style.marginRight = `${marginRight}rem`;

    // Button width customization (applies only when Full Width is disabled).
    if (!isFullWidth && Number.isFinite(widthPercent) && widthPercent > 0 && widthPercent <= 100) {
      // Avoid forcing 100% unless merchant intentionally sets it.
      if (widthPercent !== 100) buttonEl.style.width = `${widthPercent}%`;
    }

    if (alignment === 'auto') return;

    // Alignment must work even when the wrapper is `display: contents` (no box),
    // so apply alignment directly on the button (and flex/grid properties when possible).
    if (isFullWidth) return;

    const parent = buttonEl.parentElement;
    const parentStyle = parent ? window.getComputedStyle(parent) : null;
    const isFlexParent = !!parentStyle && (parentStyle.display === 'flex' || parentStyle.display === 'inline-flex');
    const isGridParent = !!parentStyle && parentStyle.display === 'grid';

    if (isFlexParent) {
      if (alignment === 'left') buttonEl.style.alignSelf = 'flex-start';
      if (alignment === 'center') buttonEl.style.alignSelf = 'center';
      if (alignment === 'right') buttonEl.style.alignSelf = 'flex-end';
      return;
    }

    if (isGridParent) {
      if (alignment === 'left') buttonEl.style.justifySelf = 'start';
      if (alignment === 'center') buttonEl.style.justifySelf = 'center';
      if (alignment === 'right') buttonEl.style.justifySelf = 'end';
      return;
    }

    // Block formatting fallback.
    if (!buttonEl.style.width) buttonEl.style.width = 'fit-content';
    buttonEl.style.display = 'flex';
    if (alignment === 'left') {
      buttonEl.style.marginLeft = '0';
      buttonEl.style.marginRight = 'auto';
    }
    if (alignment === 'center') {
      buttonEl.style.marginLeft = 'auto';
      buttonEl.style.marginRight = 'auto';
    }
    if (alignment === 'right') {
      buttonEl.style.marginLeft = 'auto';
      buttonEl.style.marginRight = '0';
    }
  };

  const applyButtonVisualConfig = (buttonEl) => {
    if (!buttonEl) return;

    const iconSpan = buttonEl.querySelector('.button__icon');
    const showIcon = buttonEl.dataset.showIcon === 'true' || buttonEl.dataset.showIcon === true;
    if (iconSpan instanceof HTMLElement) {
      iconSpan.style.display = showIcon ? 'inline' : 'none';
      const icon = buttonEl.dataset.buttonIcon || iconSpan.dataset.icon || '✨';
      iconSpan.textContent = icon;
    }

    const backgroundColor = buttonEl.dataset.backgroundColor;
    const textColor = buttonEl.dataset.textColor;
    const borderColor = buttonEl.dataset.borderColor;
    const fontSize = coerceCssNumber(buttonEl.dataset.fontSize, 'px');
    const padding = coerceCssNumber(buttonEl.dataset.padding, 'rem');
    const borderRadius = coerceCssNumber(buttonEl.dataset.borderRadius, 'px');

    if (backgroundColor) buttonEl.style.setProperty('background-color', backgroundColor, 'important');
    if (textColor) buttonEl.style.setProperty('color', textColor, 'important');
    if (borderColor) buttonEl.style.setProperty('border-color', borderColor, 'important');
    if (fontSize) buttonEl.style.setProperty('font-size', fontSize, 'important');
    if (padding) buttonEl.style.setProperty('padding', `${padding} 1.5rem`, 'important');
    if (borderRadius) buttonEl.style.setProperty('border-radius', borderRadius, 'important');

    // Make sure click target is accessible.
    buttonEl.style.minHeight = buttonEl.style.minHeight || '44px';

    const customCss = buttonEl.dataset.customCss || '';
    applyScopedCustomCss(buttonEl.id, customCss);

    applyLayoutConfig(buttonEl);

    buttonEl.dataset.loading = 'false';
    buttonEl.dataset.styled = 'true';
  };

  const hasExplicitStyleOverrides = (buttonEl) => {
    if (!buttonEl) return false;

    const backgroundColor = buttonEl.dataset.backgroundColor;
    const textColor = buttonEl.dataset.textColor;
    const borderColor = buttonEl.dataset.borderColor;
    const fontSize = buttonEl.dataset.fontSize;
    const padding = buttonEl.dataset.padding;
    const borderRadius = buttonEl.dataset.borderRadius;
    const customCss = buttonEl.dataset.customCss;

    return Boolean(
      (backgroundColor && backgroundColor.trim()) ||
        (textColor && textColor.trim()) ||
        (borderColor && borderColor.trim()) ||
        (fontSize && String(fontSize).trim()) ||
        (padding && String(padding).trim()) ||
        (borderRadius && String(borderRadius).trim()) ||
        (customCss && String(customCss).trim()),
    );
  };

  const adoptThemePrimaryButtonClasses = (buttonEl, themeButton) => {
    if (!buttonEl || !themeButton) return;

    const preserved = new Set();
    preserved.add('nusense-tryon-button');

    // Preserve any width/layout helper classes already present on our button.
    if (buttonEl.classList.contains('button--full-width')) preserved.add('button--full-width');
    if (buttonEl.classList.contains('btn-block')) preserved.add('btn-block');
    if (buttonEl.classList.contains('btn--full-width')) preserved.add('btn--full-width');

    // Copy the theme’s primary purchase button classes verbatim (except our own marker classes).
    const themeClasses = Array.from(themeButton.classList).filter((cls) => {
      if (!cls) return false;
      if (cls.startsWith('nusense-')) return false;
      if (cls === 'nusense-tryon-button') return false;
      return true;
    });

    const nextClasses = Array.from(new Set([...themeClasses, ...Array.from(preserved)]));
    buttonEl.className = nextClasses.join(' ').trim();
  };

  const buildWidgetUrl = ({ widgetUrl, productId, shopDomain }) => {
    const base = normalizeUrl(widgetUrl);
    if (!base) return null;

    try {
      const url = new URL(`${base}/widget`);
      if (productId && productId !== 'undefined' && productId !== 'null') url.searchParams.set('product_id', productId);
      if (shopDomain) url.searchParams.set('shop_domain', shopDomain);
      return url.toString();
    } catch {
      // Fallback: naive concatenation
      const params = new URLSearchParams();
      if (productId && productId !== 'undefined' && productId !== 'null') params.set('product_id', productId);
      if (shopDomain) params.set('shop_domain', shopDomain);
      const suffix = params.toString() ? `?${params.toString()}` : '';
      return `${base}/widget${suffix}`;
    }
  };

  const openWidgetOverlay = (buttonEl) => {
    if (!buttonEl || !document.body) return;

    const widgetUrl = getWidgetUrl(buttonEl);
    const widgetOrigin = getWidgetOrigin(widgetUrl);
    const targetOrigin = widgetOrigin || '*';

    const productId = buttonEl.dataset.productId || '';
    const shopDomain = buttonEl.dataset.shopDomain || '';
    const widgetHref = buildWidgetUrl({ widgetUrl, productId, shopDomain });
    if (!widgetHref) return;

    const overlayId = `nusense-widget-overlay-${buttonEl.id}`;
    const titleId = `nusense-widget-title-${buttonEl.id}`;
    const iframeId = `nusense-widget-iframe-${buttonEl.id}`;

    // Prevent duplicates.
    const existing = document.getElementById(overlayId);
    if (existing) existing.remove();

    const previousOverflow = document.body.style.overflow || '';
    const overlay = document.createElement('div');
    overlay.id = overlayId;
    overlay.className = 'nusense-widget-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', titleId);
    overlay.style.cssText = [
      'position: fixed',
      'top: 0',
      'left: 0',
      'width: 100%',
      'height: 100%',
      'background: rgba(0, 0, 0, 0.5)',
      'z-index: 9999',
      'display: flex',
      'align-items: center',
      'justify-content: center',
      'padding: 1rem',
    ].join(';');

    const title = document.createElement('h2');
    title.id = titleId;
    title.textContent = 'NUSENSE Virtual Try-On';
    title.style.cssText = 'position:absolute;left:-9999px;top:auto;width:1px;height:1px;overflow:hidden;';

    const container = document.createElement('div');
    container.className = 'nusense-widget-container';
    container.setAttribute('role', 'document');
    container.style.cssText = [
      'position: relative',
      'width: 95vw',
      'max-width: 1200px',
      'height: 90vh',
      'background: #fff',
      'border-radius: 0.5rem',
      'overflow: hidden',
    ].join(';');

    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'nusense-widget-close';
    closeButton.setAttribute('aria-label', 'Close try-on widget');
    closeButton.textContent = '×';
    closeButton.style.cssText = [
      'position: absolute',
      'top: 0.75rem',
      'right: 0.75rem',
      'width: 40px',
      'height: 40px',
      'border-radius: 9999px',
      'border: 1px solid rgba(0,0,0,0.15)',
      'background: rgba(255,255,255,0.95)',
      'color: #111',
      'font-size: 26px',
      'line-height: 1',
      'display: flex',
      'align-items: center',
      'justify-content: center',
      'cursor: pointer',
      'z-index: 2',
    ].join(';');

    const iframe = document.createElement('iframe');
    iframe.id = iframeId;
    iframe.src = widgetHref;
    iframe.setAttribute('title', 'NUSENSE Try-On Widget');
    iframe.setAttribute('allow', 'camera; microphone');
    iframe.setAttribute('allowfullscreen', 'true');
    iframe.style.cssText = [
      'width: 100%',
      'height: 100%',
      'border: none',
      'display: block',
      'background: #fff',
    ].join(';');

    const loading = document.createElement('div');
    loading.textContent = 'Loading…';
    loading.style.cssText = [
      'position: absolute',
      'inset: 0',
      'display: flex',
      'align-items: center',
      'justify-content: center',
      'color: #444',
      'font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
      'background: rgba(255,255,255,0.8)',
      'z-index: 1',
    ].join(';');

    let cleanedUp = false;
    const handleCleanup = () => {
      if (cleanedUp) return;
      cleanedUp = true;

      try {
        window.removeEventListener('message', handleMessage);
        document.removeEventListener('keydown', handleKeyDown);
      } catch {
        // ignore
      }

      try {
        overlay.remove();
      } catch {
        // ignore
      }

      try {
        document.body.style.overflow = previousOverflow;
      } catch {
        // ignore
      }

      try {
        buttonEl.focus();
      } catch {
        // ignore
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') handleCleanup();
    };

    const handleMessage = (event) => {
      if (!event?.data?.type || typeof event.data.type !== 'string') return;
      if (!event.data.type.startsWith('NUSENSE_')) return;
      if (!iframe.contentWindow || event.source !== iframe.contentWindow) return;
      if (widgetOrigin && event.origin !== widgetOrigin) return;

      if (event.data.type === 'NUSENSE_CLOSE_WIDGET') {
        handleCleanup();
        return;
      }

      if (event.data.type === 'NUSENSE_REQUEST_STORE_INFO') {
        const payload = {
          type: 'NUSENSE_STORE_INFO',
          domain: window.location.hostname,
          shopDomain,
          origin: window.location.origin,
          fullUrl: window.location.href,
        };

        try {
          iframe.contentWindow.postMessage(payload, targetOrigin);
        } catch {
          // ignore
        }
      }
    };

    closeButton.addEventListener('click', handleCleanup);
    closeButton.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') handleCleanup();
    });

    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) handleCleanup();
    });

    iframe.addEventListener('load', () => {
      loading.remove();
      try {
        closeButton.focus();
      } catch {
        // ignore
      }
    });

    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('message', handleMessage);

    container.appendChild(closeButton);
    container.appendChild(iframe);
    container.appendChild(loading);
    overlay.appendChild(title);
    overlay.appendChild(container);

    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';

    try {
      closeButton.focus();
    } catch {
      // ignore
    }
  };

  const initButton = (buttonEl) => {
    if (!(buttonEl instanceof HTMLButtonElement)) return;
    if (!buttonEl.id || !buttonEl.id.startsWith(BUTTON_ID_PREFIX)) return;
    if (buttonEl.dataset[INIT_FLAG] === 'true') return;

    buttonEl.dataset[INIT_FLAG] = 'true';

    // Defensive: ensure we don't accidentally submit product forms.
    if (!buttonEl.type) buttonEl.type = 'button';

    const handleClick = (event) => {
      event.preventDefault();
      event.stopPropagation();
      openWidgetOverlay(buttonEl);
    };

    // Keep visual config in sync with data attributes.
    const applyConfig = () => {
      applyButtonVisualConfig(buttonEl);

      const themeButton = getClosestThemePrimaryButton(buttonEl);
      const selectedStyle = (buttonEl.dataset.buttonStyle || 'primary').toLowerCase();
      const shouldUseThemePrimaryDefault = selectedStyle === 'primary' && !hasExplicitStyleOverrides(buttonEl);

      if (themeButton && shouldUseThemePrimaryDefault) {
        adoptThemePrimaryButtonClasses(buttonEl, themeButton);
      }

      if (!themeButton) return;

      // Inherit typography if merchant did not override font size.
      if (!buttonEl.dataset.fontSize) {
        const themeStyle = window.getComputedStyle(themeButton);
        const fontFamily = themeStyle.getPropertyValue('font-family');
        const fontSize = themeStyle.getPropertyValue('font-size');
        const fontWeight = themeStyle.getPropertyValue('font-weight');
        const letterSpacing = themeStyle.getPropertyValue('letter-spacing');
        const textTransform = themeStyle.getPropertyValue('text-transform');
        const lineHeight = themeStyle.getPropertyValue('line-height');

        if (fontFamily) buttonEl.style.setProperty('font-family', fontFamily, 'important');
        if (fontSize) buttonEl.style.setProperty('font-size', fontSize, 'important');
        if (fontWeight) buttonEl.style.setProperty('font-weight', fontWeight, 'important');
        if (letterSpacing) buttonEl.style.setProperty('letter-spacing', letterSpacing, 'important');
        if (textTransform) buttonEl.style.setProperty('text-transform', textTransform, 'important');
        if (lineHeight) buttonEl.style.setProperty('line-height', lineHeight, 'important');
      }
    };

    applyConfig();

    buttonEl.addEventListener('click', handleClick);

    const attributeObserver = new MutationObserver(() => {
      applyConfig();
    });

    attributeObserver.observe(buttonEl, {
      attributes: true,
      attributeFilter: [
        'data-button-style',
        'data-show-icon',
        'data-button-width-full',
        'data-width-percent',
        'data-background-color',
        'data-text-color',
        'data-border-color',
        'data-font-size',
        'data-padding',
        'data-border-radius',
        'data-alignment',
        'data-margin-top',
        'data-margin-bottom',
        'data-margin-left',
        'data-margin-right',
        'data-button-icon',
        'data-custom-css',
        'class',
      ],
    });
  };

  const scanButtons = () => {
    const buttons = document.querySelectorAll(`button[id^="${BUTTON_ID_PREFIX}"]`);
    buttons.forEach((btn) => initButton(btn));
  };

  let scanScheduled = false;
  let lastScanAt = 0;
  const SCAN_THROTTLE_MS = 250;
  const scheduleScanButtons = () => {
    if (scanScheduled) return;
    scanScheduled = true;

    const now = Date.now();
    const delay = Math.max(0, SCAN_THROTTLE_MS - (now - lastScanAt));

    setTimeout(() => {
      scanScheduled = false;
      lastScanAt = Date.now();

      if (typeof window.requestIdleCallback === 'function') {
        window.requestIdleCallback(() => scanButtons(), { timeout: 500 });
        return;
      }

      requestAnimationFrame(() => scanButtons());
    }, delay);
  };

  // Initial scan.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scanButtons, { once: true });
  } else {
    scanButtons();
  }

  // Keep up with dynamic themes/sections.
  const domObserver = new MutationObserver(() => scheduleScanButtons());
  domObserver.observe(document.documentElement, { childList: true, subtree: true });

  window.addEventListener(
    'beforeunload',
    () => {
      try {
        domObserver.disconnect();
      } catch {
        // ignore
      }
    },
    { once: true },
  );
})();


