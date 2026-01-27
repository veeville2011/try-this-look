(() => {
  'use strict';

  const BUTTON_ID_PREFIX = 'test-extension-btn-';
  const CUSTOM_CSS_STYLE_ID_PREFIX = 'test-extension-css-';

  // When merchants don't intentionally change these, we should not override theme styles.
  // These match the schema defaults in both app block + app embed block.
  const DEFAULT_VISUAL_SETTINGS = {
    fontSize: 16,
    padding: 0.8,
    borderRadius: 4,
  };

  /**
   * We want to avoid double-initializing buttons across theme partial reloads,
   * section rendering, and DOM mutations.
   */
  const INIT_FLAG = 'testExtensionInitialized';

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

    const scopedSelector = `#${CSS.escape(buttonId)}.test-extension-button`;

    // If the merchant already used the class selector, scope it to this button instance.
    const scopedCss = raw.includes('.test-extension-button')
      ? raw.replace(/\.test-extension-button/g, scopedSelector)
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

  const parseNumber = (value) => {
    if (value == null) return null;
    const num = Number.parseFloat(String(value).trim());
    return Number.isFinite(num) ? num : null;
  };

  const isEffectivelyDefaultNumber = (value, defaultNumber) => {
    const num = parseNumber(value);
    if (num == null) return true;
    return Math.abs(num - defaultNumber) < 0.0001;
  };

  const applyLayoutConfig = (buttonEl) => {
    if (!buttonEl) return;

    // Ensure container takes full width
    const container = buttonEl.closest('.test-extension-button-app-block');
    if (container) {
      container.style.width = '100%';
      container.style.display = 'flex';
    }

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

    // Button width customization
    if (isFullWidth) {
      // Force full width when enabled
      buttonEl.style.display = 'flex';
      buttonEl.style.width = '100%';
      buttonEl.style.maxWidth = '100%';
      buttonEl.style.flex = '1 1 100%';
      if (container) {
        container.style.alignItems = 'stretch';
        container.style.width = '100%';
      }
    } else if (Number.isFinite(widthPercent) && widthPercent > 0 && widthPercent <= 100) {
      // Width percentage is relative to the full container width
      buttonEl.style.width = `${widthPercent}%`;
      buttonEl.style.maxWidth = '100%';
    }

    // Handle alignment - apply to container for proper flex behavior
    if (container && alignment !== 'auto') {
      if (alignment === 'left') {
        container.style.justifyContent = 'flex-start';
      } else if (alignment === 'center') {
        container.style.justifyContent = 'center';
      } else if (alignment === 'right') {
        container.style.justifyContent = 'flex-end';
      }
    }

    if (alignment === 'auto') return;

    // For non-full-width buttons, also handle alignment on button itself
    if (!isFullWidth) {
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

    const fontSize =
      isEffectivelyDefaultNumber(buttonEl.dataset.fontSize, DEFAULT_VISUAL_SETTINGS.fontSize)
        ? null
        : coerceCssNumber(buttonEl.dataset.fontSize, 'px');

    const padding =
      isEffectivelyDefaultNumber(buttonEl.dataset.padding, DEFAULT_VISUAL_SETTINGS.padding)
        ? null
        : coerceCssNumber(buttonEl.dataset.padding, 'rem');

    const borderRadius =
      isEffectivelyDefaultNumber(buttonEl.dataset.borderRadius, DEFAULT_VISUAL_SETTINGS.borderRadius)
        ? null
        : coerceCssNumber(buttonEl.dataset.borderRadius, 'px');

    if (backgroundColor) buttonEl.style.setProperty('background-color', backgroundColor, 'important');
    else buttonEl.style.removeProperty('background-color');

    if (textColor) buttonEl.style.setProperty('color', textColor, 'important');
    else buttonEl.style.removeProperty('color');

    if (borderColor) buttonEl.style.setProperty('border-color', borderColor, 'important');
    else buttonEl.style.removeProperty('border-color');

    if (fontSize) buttonEl.style.setProperty('font-size', fontSize, 'important');
    else buttonEl.style.removeProperty('font-size');

    // Only override padding when merchant intentionally changes it.
    if (padding) buttonEl.style.setProperty('padding', `${padding} 1.5rem`, 'important');
    else buttonEl.style.removeProperty('padding');

    // Only override border radius when merchant intentionally changes it.
    if (borderRadius) buttonEl.style.setProperty('border-radius', borderRadius, 'important');
    else buttonEl.style.removeProperty('border-radius');

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
        (fontSize && String(fontSize).trim() && !isEffectivelyDefaultNumber(fontSize, DEFAULT_VISUAL_SETTINGS.fontSize)) ||
        (padding && String(padding).trim() && !isEffectivelyDefaultNumber(padding, DEFAULT_VISUAL_SETTINGS.padding)) ||
        (borderRadius && String(borderRadius).trim() && !isEffectivelyDefaultNumber(borderRadius, DEFAULT_VISUAL_SETTINGS.borderRadius)) ||
        (customCss && String(customCss).trim()),
    );
  };

  const adoptThemePrimaryButtonClasses = (buttonEl, themeButton) => {
    if (!buttonEl || !themeButton) return;

    const preserved = new Set();
    preserved.add('test-extension-button');

    // Preserve any width/layout helper classes already present on our button.
    if (buttonEl.classList.contains('button--full-width')) preserved.add('button--full-width');
    if (buttonEl.classList.contains('btn-block')) preserved.add('btn-block');
    if (buttonEl.classList.contains('btn--full-width')) preserved.add('btn--full-width');

    // Copy the theme’s primary purchase button classes verbatim (except our own marker classes).
    const themeClasses = Array.from(themeButton.classList).filter((cls) => {
      if (!cls) return false;
      if (cls.startsWith('test-extension-')) return false;
      if (cls === 'test-extension-button') return false;
      return true;
    });

    const nextClasses = Array.from(new Set([...themeClasses, ...Array.from(preserved)]));
    buttonEl.className = nextClasses.join(' ').trim();
  };

  const inheritTypographyFromButton = (buttonEl, themeButton) => {
    if (!buttonEl || !themeButton) return;
    if (!(themeButton instanceof HTMLElement)) return;
    if (buttonEl.dataset.fontSize) return;

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
  };

  const inheritBorderRadiusFromButton = (buttonEl, themeButton) => {
    if (!buttonEl || !themeButton) return;
    if (!(themeButton instanceof HTMLElement)) return;

    // If merchant intentionally overrides border radius, respect it.
    const hasRadiusOverride =
      !!buttonEl.dataset.borderRadius && !isEffectivelyDefaultNumber(buttonEl.dataset.borderRadius, DEFAULT_VISUAL_SETTINGS.borderRadius);

    if (hasRadiusOverride) return;

    const themeStyle = window.getComputedStyle(themeButton);
    const radius = themeStyle.getPropertyValue('border-radius');
    if (!radius || radius.trim() === '' || radius.trim() === 'initial' || radius.trim() === 'inherit') return;

    buttonEl.style.setProperty('border-radius', radius.trim(), 'important');
  };

  const resetVariantInlineStyles = (buttonEl) => {
    if (!buttonEl) return;
    if (buttonEl.dataset.testExtensionVariantInline !== 'true') return;

    buttonEl.style.removeProperty('background-color');
    buttonEl.style.removeProperty('color');
    buttonEl.style.removeProperty('border-color');
    buttonEl.style.removeProperty('border-width');
    buttonEl.style.removeProperty('border-style');
    buttonEl.style.removeProperty('box-shadow');
    buttonEl.style.removeProperty('text-decoration');
    buttonEl.dataset.testExtensionVariantInline = 'false';
  };

  const applyInlineVariantFallback = (buttonEl, variant, themeButton) => {
    if (!buttonEl) return;

    // If merchant explicitly overrides colors, let that win.
    if (hasExplicitStyleOverrides(buttonEl)) return;

    const ref = themeButton instanceof HTMLElement ? themeButton : null;
    const refStyle = ref ? window.getComputedStyle(ref) : null;
    const refBg = refStyle ? refStyle.getPropertyValue('background-color').trim() : '';
    const refColor = refStyle ? refStyle.getPropertyValue('color').trim() : '';
    const refBorder = refStyle ? refStyle.getPropertyValue('border-color').trim() : '';

    const accent = refBg && refBg !== 'transparent' ? refBg : refBorder || refColor;
    const text = refColor || 'currentColor';

    // Clear any previous inline variant styling first.
    resetVariantInlineStyles(buttonEl);

    if (variant === 'secondary') {
      buttonEl.style.setProperty('background-color', 'transparent', 'important');
      buttonEl.style.setProperty('border-style', 'solid', 'important');
      buttonEl.style.setProperty('border-width', '1px', 'important');
      if (accent) buttonEl.style.setProperty('border-color', accent, 'important');
      if (accent) buttonEl.style.setProperty('color', accent, 'important');
      buttonEl.dataset.testExtensionVariantInline = 'true';
      return;
    }

    if (variant === 'outline') {
      buttonEl.style.setProperty('background-color', 'transparent', 'important');
      buttonEl.style.setProperty('border-style', 'solid', 'important');
      buttonEl.style.setProperty('border-width', '1px', 'important');
      if (accent) buttonEl.style.setProperty('border-color', accent, 'important');
      if (text) buttonEl.style.setProperty('color', text, 'important');
      buttonEl.dataset.testExtensionVariantInline = 'true';
      return;
    }

    if (variant === 'minimal') {
      buttonEl.style.setProperty('background-color', 'transparent', 'important');
      buttonEl.style.setProperty('border-width', '0px', 'important');
      buttonEl.style.setProperty('border-style', 'solid', 'important');
      if (accent) buttonEl.style.setProperty('color', accent, 'important');
      buttonEl.style.setProperty('box-shadow', 'none', 'important');
      buttonEl.dataset.testExtensionVariantInline = 'true';
      return;
    }

    // primary => no inline fallback here (handled by theme adoption).
  };

  const getClosestThemeVariantButton = (buttonEl, variant) => {
    if (!buttonEl) return null;

    const productForm = buttonEl.closest('form[action*="/cart/add"]') || document.querySelector('form[action*="/cart/add"]');
    const root = productForm || document;

    const candidates = Array.from(root.querySelectorAll('button, input[type="submit"], input[type="button"]')).filter((el) => {
      if (!(el instanceof HTMLElement)) return false;
      if (el === buttonEl) return false;
      if (String(el.id || '').startsWith(BUTTON_ID_PREFIX)) return false;
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') return false;
      if (parseFloat(style.opacity) < 0.1) return false;
      return true;
    });

    const rankForVariant = (el) => {
      const cls = String(el.className || '').toLowerCase();
      let score = 0;
      if (variant === 'secondary') {
        if (cls.includes('secondary')) score += 5;
        if (cls.includes('alt') || cls.includes('subtle')) score += 2;
      }
      if (variant === 'outline') {
        if (cls.includes('outline')) score += 5;
        if (cls.includes('ghost')) score += 3;
      }
      if (variant === 'minimal') {
        if (cls.includes('tertiary')) score += 5;
        if (cls.includes('link') || cls.includes('text') || cls.includes('plain')) score += 3;
      }
      // Prefer buttons near the primary purchase button area.
      if (el.closest && el.closest('form[action*="/cart/add"]')) score += 1;
      return score;
    };

    let best = null;
    let bestScore = 0;
    for (const el of candidates) {
      const score = rankForVariant(el);
      if (score > bestScore) {
        best = el;
        bestScore = score;
      }
    }

    return bestScore > 0 ? best : null;
  };

  const buildWidgetUrl = ({ widgetUrl, productId, shopDomain }) => {
    const base = normalizeUrl(widgetUrl);
    if (!base) return null;

    try {
      const url = new URL(`${base}/widget-test`);
      if (productId && productId !== 'undefined' && productId !== 'null') url.searchParams.set('product_id', productId);
      if (shopDomain) url.searchParams.set('shop_domain', shopDomain);
      return url.toString();
    } catch {
      // Fallback: naive concatenation
      const params = new URLSearchParams();
      if (productId && productId !== 'undefined' && productId !== 'null') params.set('product_id', productId);
      if (shopDomain) params.set('shop_domain', shopDomain);
      const suffix = params.toString() ? `?${params.toString()}` : '';
      return `${base}/widget-test${suffix}`;
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

    const overlayId = `test-extension-widget-overlay-${buttonEl.id}`;
    const titleId = `test-extension-widget-title-${buttonEl.id}`;
    const iframeId = `test-extension-widget-iframe-${buttonEl.id}`;

    // Prevent duplicates.
    const existing = document.getElementById(overlayId);
    if (existing) existing.remove();

    const previousOverflow = document.body.style.overflow || '';
    const overlay = document.createElement('div');
    overlay.id = overlayId;
    overlay.className = 'test-extension-widget-overlay';
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
    title.textContent = 'Test Extension Virtual Try-On';
    title.style.cssText = 'position:absolute;left:-9999px;top:auto;width:1px;height:1px;overflow:hidden;';

    const container = document.createElement('div');
    container.className = 'test-extension-widget-container';
    container.setAttribute('role', 'document');
    container.style.cssText = [
      'position: relative',
      // Maintain the original desktop modal width (900px) while staying responsive on mobile.
      // - Mobile: width is capped by 95vw
      // - Desktop: max-width keeps the modal at 900px for consistent UI/UX
      'width: 95vw',
      'max-width: 900px',
      'height: 94vh',
      'max-height: 650px',
      'background: #fff',
      'border-radius: 0.5rem',
      'overflow: hidden',
    ].join(';');

    const iframe = document.createElement('iframe');
    iframe.id = iframeId;
    iframe.src = widgetHref;
    iframe.setAttribute('title', 'Test Extension Try-On Widget');
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
    // Avoid rendering visible "Loading..." text; show a simple spinner instead.
    loading.setAttribute('role', 'status');
    loading.setAttribute('aria-live', 'polite');
    loading.setAttribute('aria-label', 'Loading');
    loading.style.cssText = [
      'position: absolute',
      'inset: 0',
      'display: flex',
      'align-items: center',
      'justify-content: center',
      'background: rgba(255,255,255,0.8)',
      'z-index: 1',
    ].join(';');

    // Inject keyframes once for the spinner.
    const spinnerStyleId = 'test-extension-spinner-style';
    if (!document.getElementById(spinnerStyleId)) {
      const spinnerStyle = document.createElement('style');
      spinnerStyle.id = spinnerStyleId;
      spinnerStyle.textContent = `@keyframes testExtensionSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`;
      document.head.appendChild(spinnerStyle);
    }

    const loadingSpinner = document.createElement('div');
    loadingSpinner.setAttribute('aria-hidden', 'true');
    loadingSpinner.style.cssText = [
      'width: 40px',
      'height: 40px',
      'border-radius: 9999px',
      'border: 3px solid rgba(0,0,0,0.15)',
      'border-top-color: rgba(0,0,0,0.55)',
      'animation: testExtensionSpin 0.8s linear infinite',
    ].join(';');
    loading.appendChild(loadingSpinner);

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
      if (!event.data.type.startsWith('NUSENSE_')) return; // Keep NUSENSE_ prefix for compatibility
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

    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) handleCleanup();
    });

    iframe.addEventListener('load', () => {
      loading.remove();
    });

    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('message', handleMessage);

    container.appendChild(iframe);
    container.appendChild(loading);
    overlay.appendChild(title);
    overlay.appendChild(container);

    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';
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

      // Always restore "base" classes before applying a style variant.
      const baseClasses = (buttonEl.dataset.baseClasses || '').trim() || buttonEl.className;
      if (!buttonEl.dataset.baseClasses) buttonEl.dataset.baseClasses = baseClasses;
      buttonEl.className = baseClasses;
      resetVariantInlineStyles(buttonEl);

      let typographySource = themeButton;

      if (selectedStyle === 'primary') {
        if (themeButton && shouldUseThemePrimaryDefault) {
          adoptThemePrimaryButtonClasses(buttonEl, themeButton);
        }
      } else {
        // Attempt to adopt theme classes for non-primary variants when possible.
        const variantButton = getClosestThemeVariantButton(buttonEl, selectedStyle);
        if (variantButton) {
          adoptThemePrimaryButtonClasses(buttonEl, variantButton);
          typographySource = variantButton;
        } else {
          // Fallback: apply a lightweight inline variant derived from theme primary styles.
          applyInlineVariantFallback(buttonEl, selectedStyle, themeButton);
        }
      }

      if (typographySource) {
        inheritTypographyFromButton(buttonEl, typographySource);
        inheritBorderRadiusFromButton(buttonEl, typographySource);
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


