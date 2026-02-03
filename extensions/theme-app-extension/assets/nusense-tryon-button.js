(() => {
  'use strict';

  const BUTTON_ID_PREFIX = 'nusense-tryon-btn-';
  const CUSTOM_CSS_STYLE_ID_PREFIX = 'nusense-custom-css-';

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
  const INIT_FLAG = 'nusenseInitialized';

  // Performance and reliability constants
  const CONSTANTS = {
    SCAN_THROTTLE_MS: 250,
    CREDIT_CHECK_TIMEOUT_MS: 5000,
    CREDIT_CHECK_CACHE_TTL_MS: 60000, // 1 minute cache
    MIN_CLICK_TARGET_PX: 44,
    OVERLAY_Z_INDEX: 9999,
    DEFAULT_MODAL_WIDTH: 900,
    DEFAULT_MODAL_HEIGHT: 650,
  };

  // Credit check cache and shared promise to prevent race conditions
  const creditCheckCache = new Map();
  const creditCheckPromises = new Map();

  // Safety mechanism: Check and restore any stuck styles on page load
  // This ensures the page is never left in a broken state from previous sessions
  (function checkAndRestoreStuckStyles() {
    try {
      // Check if body has overflow hidden but no overlay (stuck state)
      const bodyOverflow = window.getComputedStyle(document.body).overflow;
      const hasOverlay = !!document.querySelector('.nusense-widget-overlay');
      
      if (bodyOverflow === 'hidden' && !hasOverlay) {
        // Styles are stuck - restore them
        document.body.style.overflow = '';
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.left = '';
        document.body.style.right = '';
        document.body.style.width = '';
        if (document.body.dataset.nusenseScrollY) {
          const scrollY = parseInt(document.body.dataset.nusenseScrollY, 10);
          window.scrollTo(0, scrollY);
          delete document.body.dataset.nusenseScrollY;
        }
      }
    } catch (error) {
      // Silently fail
    }
  })();

  // Safety mechanism: Always restore body overflow on page unload
  window.addEventListener('beforeunload', function() {
    try {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.style.right = '';
      document.body.style.width = '';
      delete window.__NUSENSE_PREVIOUS_OVERFLOW__;
      delete window.__NUSENSE_PREVIOUS_POSITION__;
      delete window.__NUSENSE_PREVIOUS_TOP__;
    } catch (error) {
      // Silently fail
    }
  });

  const normalizeUrl = (url) => {
    if (!url) return '';
    return String(url).trim().replace(/\/+$/, '');
  };

  const validateWidgetUrl = (url) => {
    if (!url) return false;
    try {
      const parsed = new URL(url);
      // Only allow HTTPS URLs for security
      return parsed.protocol === 'https:' && parsed.hostname;
    } catch {
      return false;
    }
  };

  const getWidgetUrl = (buttonEl) => {
    const fromDataset = buttonEl?.dataset?.widgetUrl;
    const fromGlobal = window?.NUSENSE_CONFIG?.widgetUrl;
    const fallback = 'https://try-this-look.vercel.app';

    const url = normalizeUrl(fromDataset || fromGlobal || fallback);
    
    // Validate URL and fallback to default if invalid
    if (!validateWidgetUrl(url)) {
      console.warn('[NUSENSE] Invalid widget URL, using fallback');
      return normalizeUrl(fallback);
    }
    
    return url;
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
    const container = buttonEl.closest('.nusense-tryon-button-app-block');
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
    buttonEl.style.minHeight = buttonEl.style.minHeight || `${CONSTANTS.MIN_CLICK_TARGET_PX}px`;

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
    if (buttonEl.dataset.nusenseVariantInline !== 'true') return;

    buttonEl.style.removeProperty('background-color');
    buttonEl.style.removeProperty('color');
    buttonEl.style.removeProperty('border-color');
    buttonEl.style.removeProperty('border-width');
    buttonEl.style.removeProperty('border-style');
    buttonEl.style.removeProperty('box-shadow');
    buttonEl.style.removeProperty('text-decoration');
    buttonEl.dataset.nusenseVariantInline = 'false';
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
      buttonEl.dataset.nusenseVariantInline = 'true';
      return;
    }

    if (variant === 'outline') {
      buttonEl.style.setProperty('background-color', 'transparent', 'important');
      buttonEl.style.setProperty('border-style', 'solid', 'important');
      buttonEl.style.setProperty('border-width', '1px', 'important');
      if (accent) buttonEl.style.setProperty('border-color', accent, 'important');
      if (text) buttonEl.style.setProperty('color', text, 'important');
      buttonEl.dataset.nusenseVariantInline = 'true';
      return;
    }

    if (variant === 'minimal') {
      buttonEl.style.setProperty('background-color', 'transparent', 'important');
      buttonEl.style.setProperty('border-width', '0px', 'important');
      buttonEl.style.setProperty('border-style', 'solid', 'important');
      if (accent) buttonEl.style.setProperty('color', accent, 'important');
      buttonEl.style.setProperty('box-shadow', 'none', 'important');
      buttonEl.dataset.nusenseVariantInline = 'true';
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

  /**
   * Detect customer information from Shopify storefront using JSON script tag
   * This is the recommended Shopify approach - customer info is injected via Liquid in the app block
   * 
   * Works universally across:
   * - All Shopify stores (uses standard Shopify Liquid customer object)
   * - All themes (uses standard HTML script tags and DOM APIs)
   * - All browsers (uses standard getElementById and JSON.parse)
   * 
   * @returns {Object|null} Customer info object with id, email, firstName, lastName or null
   */
  const getCustomerInfo = () => {
    try {
      // Read customer information from JSON script tag injected by Liquid in the app block
      // Note: If multiple blocks exist on the same page, getElementById returns the first one
      // This is fine because all instances contain the same customer info (global to the page)
      const customerInfoScript = document.getElementById('nusense-customer-info');
      
      if (customerInfoScript && customerInfoScript.textContent) {
        try {
          const customerInfo = JSON.parse(customerInfoScript.textContent);
          
          // Only return customer info if at least ID or email is present
          if (customerInfo && (customerInfo.id || customerInfo.email)) {
            return {
              id: customerInfo.id ? customerInfo.id.toString() : null,
              email: customerInfo.email || null,
              firstName: customerInfo.firstName || null,
              lastName: customerInfo.lastName || null,
            };
          }
        } catch (parseError) {
          // Error parsing customer info JSON - silently fail (graceful degradation)
          // This ensures the widget still works even if customer info parsing fails
          console.warn('[NUSENSE] Error parsing customer info JSON:', parseError);
        }
      }
      
      // Return null if customer is not logged in or script tag not found
      // This is expected behavior - widget works with or without customer info
      return null;
    } catch (error) {
      // Error detecting customer info - silently fail (graceful degradation)
      // This ensures the widget still works even if there's an unexpected error
      console.warn('[NUSENSE] Error detecting customer info:', error);
      return null;
    }
  };

  /**
   * Check if credits are available for the shop
   * Returns true if credits > 0, false otherwise
   * On error, returns false to hide button (fail-safe)
   * 
   * Features:
   * - Request timeout to prevent hanging requests
   * - Caching to prevent duplicate API calls
   * - Shared promise to handle concurrent requests
   */
  const checkCreditsAvailable = async (shopDomain) => {
    if (!shopDomain) {
      console.warn('[NUSENSE] No shop domain provided for credit check');
      return false;
    }

    // Normalize shop domain for cache key
    let normalizedShop = shopDomain.trim().toLowerCase();
    if (!normalizedShop.includes('.myshopify.com')) {
      normalizedShop = `${normalizedShop}.myshopify.com`;
    }

    // Check cache first
    const cached = creditCheckCache.get(normalizedShop);
    if (cached && (Date.now() - cached.timestamp) < CONSTANTS.CREDIT_CHECK_CACHE_TTL_MS) {
      return cached.hasCredits;
    }

    // Check if there's already a pending request for this shop
    const existingPromise = creditCheckPromises.get(normalizedShop);
    if (existingPromise) {
      try {
        return await existingPromise;
      } catch {
        return false;
      }
    }

    // Create new request with timeout and shared promise
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONSTANTS.CREDIT_CHECK_TIMEOUT_MS);

    const creditCheckPromise = (async () => {
      try {
        const url = `https://ai.nusense.ddns.net/api/credits/balance?shop=${encodeURIComponent(normalizedShop)}`;
        
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          signal: controller.signal, // Add abort signal for timeout
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          console.warn('[NUSENSE] Failed to check credits:', response.status, response.statusText);
          return false;
        }

        const data = await response.json();
        
        // Check if credits are available
        // Credits can be in total_balance or balance field (for backward compatibility)
        const credits = data.total_balance ?? data.balance ?? 0;
        
        // Also check if in overage mode (usage records available)
        const hasOverageCapacity = data.isOverage && data.overage && data.overage.remaining > 0;
        
        const hasCredits = credits > 0 || hasOverageCapacity;
        
        // Cache the result
        creditCheckCache.set(normalizedShop, {
          hasCredits,
          timestamp: Date.now(),
        });

        if (!hasCredits) {
          console.log('[NUSENSE] No credits available, hiding try-on button');
        }
        
        return hasCredits;
      } catch (error) {
        clearTimeout(timeoutId);
        
        // Handle timeout specifically
        if (error.name === 'AbortError') {
          console.warn('[NUSENSE] Credit check timeout after', CONSTANTS.CREDIT_CHECK_TIMEOUT_MS, 'ms');
        } else {
          console.warn('[NUSENSE] Error checking credits:', error);
        }
        
        // On error, hide button (fail-safe approach)
        return false;
      } finally {
        // Remove promise from map after completion
        creditCheckPromises.delete(normalizedShop);
      }
    })();

    // Store promise for concurrent requests
    creditCheckPromises.set(normalizedShop, creditCheckPromise);

    return creditCheckPromise;
  };

  /**
   * Trap focus within a modal container for accessibility
   * Returns cleanup function to remove event listeners
   */
  const trapFocus = (container) => {
    if (!container) return () => {};

    const getFocusableElements = () => {
      const selector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
      return Array.from(container.querySelectorAll(selector)).filter((el) => {
        if (!(el instanceof HTMLElement)) return false;
        if (el.disabled) return false;
        const style = window.getComputedStyle(el);
        return style.display !== 'none' && style.visibility !== 'hidden' && parseFloat(style.opacity) >= 0.1;
      });
    };

    const handleTab = (e) => {
      if (e.key !== 'Tab') return;

      const focusableElements = getFocusableElements();
      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (e.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstElement || !container.contains(document.activeElement)) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        // Tab
        if (document.activeElement === lastElement || !container.contains(document.activeElement)) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    container.addEventListener('keydown', handleTab);

    // Focus first element
    const focusableElements = getFocusableElements();
    if (focusableElements.length > 0) {
      // Use setTimeout to ensure iframe is ready
      setTimeout(() => {
        const firstElement = focusableElements[0];
        if (firstElement && container.contains(firstElement)) {
          firstElement.focus();
        }
      }, 100);
    }

    return () => {
      container.removeEventListener('keydown', handleTab);
    };
  };

  const buildWidgetUrl = ({ widgetUrl, productId, shopDomain, customerInfo }) => {
    const base = normalizeUrl(widgetUrl);
    if (!base) return null;

    try {
      const url = new URL(`${base}/widget`);
      if (productId && productId !== 'undefined' && productId !== 'null') url.searchParams.set('product_id', productId);
      if (shopDomain) url.searchParams.set('shop_domain', shopDomain);
      
      // Add customer information if available
      if (customerInfo) {
        if (customerInfo.id) {
          url.searchParams.set('customerId', customerInfo.id);
        }
        if (customerInfo.email) {
          url.searchParams.set('customerEmail', customerInfo.email);
        }
        if (customerInfo.firstName) {
          url.searchParams.set('customerFirstName', customerInfo.firstName);
        }
        if (customerInfo.lastName) {
          url.searchParams.set('customerLastName', customerInfo.lastName);
        }
      }
      
      return url.toString();
    } catch {
      // Fallback: naive concatenation
      const params = new URLSearchParams();
      if (productId && productId !== 'undefined' && productId !== 'null') params.set('product_id', productId);
      if (shopDomain) params.set('shop_domain', shopDomain);
      
      // Add customer information if available
      if (customerInfo) {
        if (customerInfo.id) params.set('customerId', customerInfo.id);
        if (customerInfo.email) params.set('customerEmail', customerInfo.email);
        if (customerInfo.firstName) params.set('customerFirstName', customerInfo.firstName);
        if (customerInfo.lastName) params.set('customerLastName', customerInfo.lastName);
      }
      
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
    
    // Detect and pass customer information if available
    const customerInfo = getCustomerInfo();
    
    const widgetHref = buildWidgetUrl({ widgetUrl, productId, shopDomain, customerInfo });
    if (!widgetHref) return;

    const overlayId = `nusense-widget-overlay-${buttonEl.id}`;
    const titleId = `nusense-widget-title-${buttonEl.id}`;
    const iframeId = `nusense-widget-iframe-${buttonEl.id}`;

    // Prevent duplicates.
    const existing = document.getElementById(overlayId);
    if (existing) existing.remove();

    // Safety: Check and restore any stuck styles from previous sessions
    const bodyOverflow = window.getComputedStyle(document.body).overflow;
    if (bodyOverflow === 'hidden' && !document.querySelector('.nusense-widget-overlay')) {
      // Styles are stuck - restore them
      document.body.style.overflow = '';
    }

    // Store original overflow value (use computed style to get actual value)
    const computedStyle = window.getComputedStyle(document.body);
    const previousOverflow = document.body.style.overflow || computedStyle.overflow || '';
    
    // Store globally for safety restoration
    window.__NUSENSE_PREVIOUS_OVERFLOW__ = previousOverflow;
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
      `z-index: ${CONSTANTS.OVERLAY_Z_INDEX}`,
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
      // Maintain the original desktop modal width while staying responsive on mobile.
      // - Mobile: width is capped by 95vw
      // - Desktop: max-width keeps the modal at consistent size for UI/UX
      'width: 95vw',
      `max-width: ${CONSTANTS.DEFAULT_MODAL_WIDTH}px`,
      'height: 94vh',
      `max-height: ${CONSTANTS.DEFAULT_MODAL_HEIGHT}px`,
      'background: #fff',
      'border-radius: 0.5rem',
      'overflow: hidden',
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
    const spinnerStyleId = 'nusense-tryon-spinner-style';
    if (!document.getElementById(spinnerStyleId)) {
      const spinnerStyle = document.createElement('style');
      spinnerStyle.id = spinnerStyleId;
      spinnerStyle.textContent = `@keyframes nusenseSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`;
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
      'animation: nusenseSpin 0.8s linear infinite',
    ].join(';');
    loading.appendChild(loadingSpinner);

    let cleanedUp = false;
    let focusTrapCleanup = null;

    const handleCleanup = () => {
      if (cleanedUp) return;
      cleanedUp = true;

      try {
        window.removeEventListener('message', handleMessage);
        document.removeEventListener('keydown', handleKeyDown);
        if (focusTrapCleanup) {
          focusTrapCleanup();
          focusTrapCleanup = null;
        }
      } catch {
        // ignore
      }

      try {
        overlay.remove();
      } catch {
        // ignore
      }

      try {
        // Restore scroll position first
        const scrollY = document.body.dataset.nusenseScrollY;
        if (scrollY) {
          delete document.body.dataset.nusenseScrollY;
        }
        
        // Restore body styles
        const restoredOverflow = previousOverflow || window.__NUSENSE_PREVIOUS_OVERFLOW__ || '';
        document.body.style.overflow = restoredOverflow;
        
        const restoredPosition = window.__NUSENSE_PREVIOUS_POSITION__ || '';
        const restoredTop = window.__NUSENSE_PREVIOUS_TOP__ || '';
        if (restoredPosition) {
          document.body.style.position = restoredPosition;
        } else {
          document.body.style.position = '';
          document.body.style.top = restoredTop || '';
          document.body.style.left = '';
          document.body.style.right = '';
          document.body.style.width = '';
        }
        
        // Restore scroll position
        if (scrollY) {
          window.scrollTo(0, parseInt(scrollY, 10));
        }
        
        // Clear global variables
        delete window.__NUSENSE_PREVIOUS_OVERFLOW__;
        delete window.__NUSENSE_PREVIOUS_POSITION__;
        delete window.__NUSENSE_PREVIOUS_TOP__;
      } catch {
        // Fallback: try to restore manually
        try {
          document.body.style.overflow = '';
          document.body.style.position = '';
          document.body.style.top = '';
          document.body.style.left = '';
          document.body.style.right = '';
          document.body.style.width = '';
          if (document.body.dataset.nusenseScrollY) {
            const scrollY = parseInt(document.body.dataset.nusenseScrollY, 10);
            window.scrollTo(0, scrollY);
            delete document.body.dataset.nusenseScrollY;
          }
        } catch {
          // ignore
        }
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

    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) handleCleanup();
    });

    iframe.addEventListener('load', () => {
      loading.remove();
      
      // Announce to screen readers that widget has loaded
      const announcement = document.createElement('div');
      announcement.setAttribute('role', 'status');
      announcement.setAttribute('aria-live', 'polite');
      announcement.setAttribute('aria-atomic', 'true');
      announcement.className = 'sr-only';
      announcement.style.cssText = 'position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden;';
      announcement.textContent = 'NUSENSE Try-On widget loaded';
      container.appendChild(announcement);
      
      // Remove announcement after screen readers have time to read it
      setTimeout(() => {
        try {
          announcement.remove();
        } catch {
          // ignore
        }
      }, 1000);

      // Initialize focus trap after iframe loads
      focusTrapCleanup = trapFocus(container);
    });

    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('message', handleMessage);

    container.appendChild(iframe);
    container.appendChild(loading);
    overlay.appendChild(title);
    overlay.appendChild(container);

    document.body.appendChild(overlay);
    
    // Prevent body scroll using safer method
    // Store scroll position before applying fixed position
    const scrollY = window.scrollY || window.pageYOffset || 0;
    document.body.dataset.nusenseScrollY = scrollY.toString();
    
    // Use position: fixed method to prevent scroll without breaking layout
    const originalPosition = document.body.style.position || '';
    const originalTop = document.body.style.top || '';
    window.__NUSENSE_PREVIOUS_POSITION__ = originalPosition;
    window.__NUSENSE_PREVIOUS_TOP__ = originalTop;
    
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.width = '100%';
    document.body.style.overflow = 'hidden';

    // Initialize focus trap immediately (will focus iframe when it loads)
    focusTrapCleanup = trapFocus(container);
  };

  const initButton = async (buttonEl) => {
    if (!(buttonEl instanceof HTMLButtonElement)) return;
    if (!buttonEl.id || !buttonEl.id.startsWith(BUTTON_ID_PREFIX)) return;
    if (buttonEl.dataset[INIT_FLAG] === 'true') return;

    // Get shop domain from button data attribute
    const shopDomain = buttonEl.dataset.shopDomain || '';
    
    // Check credits before initializing button
    // Hide button container if no credits available
    // Support both app block and app embed block containers
    const container = buttonEl.closest('.nusense-tryon-button-app-block') || 
                      buttonEl.closest('.nusense-tryon-button-embed-container');
    
    if (shopDomain) {
      const hasCredits = await checkCreditsAvailable(shopDomain);
      
      if (!hasCredits) {
        // Hide the button container if no credits
        if (container) {
          container.style.display = 'none';
        } else {
          buttonEl.style.display = 'none';
        }
        return; // Don't initialize button if no credits
      }
    }

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
    buttons.forEach((btn) => {
      // initButton is now async, but we don't need to await it
      // The button will be hidden if no credits are available
      initButton(btn).catch((error) => {
        console.warn('[NUSENSE] Error initializing button:', error);
        // On error, hide the button as a fail-safe
        // Support both app block and app embed block containers
        const container = btn.closest('.nusense-tryon-button-app-block') || 
                          btn.closest('.nusense-tryon-button-embed-container');
        if (container) {
          container.style.display = 'none';
        } else {
          btn.style.display = 'none';
        }
      });
    });
  };

  let scanScheduled = false;
  let lastScanAt = 0;
  const scheduleScanButtons = () => {
    if (scanScheduled) return;
    scanScheduled = true;

    const now = Date.now();
    const delay = Math.max(0, CONSTANTS.SCAN_THROTTLE_MS - (now - lastScanAt));

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

  // Optimized MutationObserver that scopes to product form area when possible
  let domObserver = null;
  const setupDOMObserver = () => {
    // Disconnect existing observer if any
    if (domObserver) {
      try {
        domObserver.disconnect();
      } catch {
        // ignore
      }
    }

    // Try to scope observer to product form area for better performance
    const productForm = document.querySelector('form[action*="/cart/add"]');
    const observeTarget = productForm && productForm.parentElement && productForm.parentElement !== document.body
      ? productForm.parentElement
      : document.documentElement;

    // Only observe childList changes to reduce overhead
    domObserver = new MutationObserver((mutations) => {
      // Only trigger scan if relevant nodes were added/removed
      const hasRelevantChanges = mutations.some((mutation) => {
        if (mutation.type !== 'childList') return false;
        
        // Check if any added/removed nodes are buttons or containers
        const nodes = [...(mutation.addedNodes || []), ...(mutation.removedNodes || [])];
        return nodes.some((node) => {
          if (!(node instanceof HTMLElement)) return false;
          return (
            node.id?.startsWith(BUTTON_ID_PREFIX) ||
            node.classList?.contains('nusense-tryon-button-app-block') ||
            node.classList?.contains('nusense-tryon-button-embed-container') ||
            node.querySelector?.(`button[id^="${BUTTON_ID_PREFIX}"]`)
          );
        });
      });

      if (hasRelevantChanges) {
        scheduleScanButtons();
      }
    });

    // Observe with minimal options for better performance
    domObserver.observe(observeTarget, {
      childList: true,
      subtree: observeTarget === document.documentElement, // Only subtree if observing entire document
    });
  };

  // Initial scan.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      scanButtons();
      setupDOMObserver();
    }, { once: true });
  } else {
    scanButtons();
    setupDOMObserver();
  }

  // Handle Shopify theme editor section events
  document.addEventListener('shopify:section:load', (event) => {
    // Re-scan buttons when sections load in theme editor
    scheduleScanButtons();
    // Re-setup observer in case DOM structure changed
    setTimeout(setupDOMObserver, 100);
  });

  document.addEventListener('shopify:section:unload', () => {
    // Cleanup and re-setup observer
    if (domObserver) {
      try {
        domObserver.disconnect();
      } catch {
        // ignore
      }
    }
    setTimeout(setupDOMObserver, 100);
  });

  document.addEventListener('shopify:section:reorder', () => {
    scheduleScanButtons();
    setTimeout(setupDOMObserver, 100);
  });

  // Cleanup on page unload
  window.addEventListener(
    'beforeunload',
    () => {
      try {
        if (domObserver) domObserver.disconnect();
        // Clear credit check cache and promises
        creditCheckCache.clear();
        creditCheckPromises.clear();
      } catch {
        // ignore
      }
    },
    { once: true },
  );
})();


