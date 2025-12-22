(() => {
  'use strict';

  if (typeof window === 'undefined') return;
  if (window.__NUSENSE_PARENT_BRIDGE_INITIALIZED__) return;
  window.__NUSENSE_PARENT_BRIDGE_INITIALIZED__ = true;

  const getWidgetOrigin = () => {
    const widgetUrl = window?.NUSENSE_CONFIG?.widgetUrl;
    if (!widgetUrl) return null;
    try {
      return new URL(String(widgetUrl)).origin;
    } catch {
      return null;
    }
  };

  const isAllowedOrigin = (origin) => {
    const allowedOrigin = getWidgetOrigin();
    if (!allowedOrigin) return false;
    return origin === allowedOrigin;
  };

  const debug = Boolean(window?.NUSENSE_CONFIG?.debug);
  const log = (...args) => {
    if (!debug) return;
    // eslint-disable-next-line no-console
    console.log(...args);
  };
  const warn = (...args) => {
    if (!debug) return;
    // eslint-disable-next-line no-console
    console.warn(...args);
  };
  const error = (...args) => {
    if (!debug) return;
    // eslint-disable-next-line no-console
    console.error(...args);
  };

  const ensureAbsoluteUrl = (value) => {
    if (!value || typeof value !== 'string') return null;
    const raw = value.trim();
    if (!raw) return null;
    if (/^https?:\/\//i.test(raw)) return raw;
    if (/^\/\//.test(raw)) return `https:${raw}`;
    try {
      return new URL(raw, window.location.origin).href;
    } catch {
      return raw;
    }
  };

  const normalizeImageList = (images) => {
    if (!Array.isArray(images)) return [];
    const out = [];
    const seen = new Set();

    for (const entry of images) {
      const url = typeof entry === 'string' ? entry : entry?.url;
      const abs = ensureAbsoluteUrl(url);
      if (!abs) continue;
      const key = abs.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const maybeId = typeof entry === 'object' && entry ? entry.id : undefined;
      if (maybeId !== undefined && maybeId !== null && String(maybeId).trim() !== '') {
        out.push({ url: abs, id: maybeId });
        continue;
      }
      out.push({ url: abs });
    }

    return out;
  };

  const parseSrcset = (srcset) => {
    if (!srcset || typeof srcset !== 'string') return [];
    return srcset
      .split(',')
      .map((part) => String(part).trim().split(/\s+/)[0])
      .filter(Boolean);
  };

  const getCanonicalImageKey = (url) => {
    if (!url || typeof url !== 'string') return '';
    const abs = ensureAbsoluteUrl(url);
    if (!abs) return '';

    // Strip query/hash to normalize away cache-busters and width params.
    const base = abs.split('#')[0].split('?')[0];

    // Normalize Shopify CDN size suffixes (e.g. _600x, _600x600) before file extension.
    // This helps dedupe the same image served at different sizes.
    return base
      .replace(/_(\d+x\d+|\d+x|x\d+)(?=\.[a-z0-9]{2,5}$)/i, '')
      .toLowerCase();
  };

  const looksLikeShopifyProductImageUrl = (url) => {
    if (!url || typeof url !== 'string') return false;
    const lower = url.toLowerCase();
    return (
      lower.includes('cdn.shopify.com') ||
      lower.includes('shopifycdn') ||
      lower.includes('/cdn/') ||
      lower.includes('/s/files/')
    );
  };

  const getOtherProductImagesOnPage = (mainProductImageUrls) => {
    const seen = new Set(
      (Array.isArray(mainProductImageUrls) ? mainProductImageUrls : [])
        .map((u) => getCanonicalImageKey(u))
        .filter(Boolean),
    );
    const out = [];

    const addUrl = (candidate) => {
      const abs = ensureAbsoluteUrl(candidate);
      if (!abs) return;
      if (!looksLikeShopifyProductImageUrl(abs)) return;
      const key = getCanonicalImageKey(abs);
      if (!key) return;
      if (seen.has(key)) return;
      seen.add(key);
      out.push({ url: abs });
    };

    try {
      const productLinkImages = document.querySelectorAll('a[href*="/products/"] img');
      for (const img of productLinkImages) {
        const sources = [
          img.currentSrc,
          img.src,
          img.getAttribute && img.getAttribute('src'),
          img.dataset && img.dataset.src,
          img.dataset && img.dataset.lazySrc,
          img.dataset && img.dataset.originalSrc,
        ].filter(Boolean);

        if (img.srcset) {
          sources.push(...parseSrcset(img.srcset));
        }

        for (const src of sources) addUrl(src);
      }
    } catch (e) {
      error('[NUSENSE] Failed extracting other product images from DOM', e);
    }

    return out;
  };

  const getProductImages = () => {
    try {
      const fromLiquid = window?.NUSENSE_PRODUCT_DATA?.images;
      const normalized = normalizeImageList(fromLiquid);
      if (normalized.length > 0) return normalized;
    } catch (e) {
      error('[NUSENSE] Failed reading NUSENSE_PRODUCT_DATA.images', e);
    }

    try {
      const scripts = document.querySelectorAll('script[type="application/json"]');
      for (const script of scripts) {
        const text = script?.textContent;
        if (!text) continue;
        let json;
        try {
          json = JSON.parse(text);
        } catch {
          continue;
        }

        const product = json?.product;
        if (!product) continue;

        if (Array.isArray(product?.media)) {
          const mediaUrls = product.media
            .map((m) => m?.preview?.image?.src || m?.preview_image?.src || m?.src || m?.url)
            .filter(Boolean);
          const normalized = normalizeImageList(mediaUrls);
          if (normalized.length > 0) return normalized;
        }

        if (Array.isArray(product?.images)) {
          const imageUrls = product.images
            .map((img) => (typeof img === 'string' ? img : img?.src || img?.url || img?.originalSrc))
            .filter(Boolean);
          const normalized = normalizeImageList(imageUrls);
          if (normalized.length > 0) return normalized;
        }
      }
    } catch (e) {
      error('[NUSENSE] Failed extracting images from JSON scripts', e);
    }

    return [];
  };

  const getSelectedVariantId = () => {
    try {
      const variantSelector =
        document.querySelector('[name="id"]') ||
        document.querySelector('input[name="id"]') ||
        document.querySelector('select[name="id"]');
      const value = variantSelector?.value;
      if (value) return value;
    } catch {
      // ignore
    }

    try {
      const variants = window?.NUSENSE_PRODUCT_DATA?.variants;
      if (Array.isArray(variants) && variants.length > 0) {
        const availableVariant = variants.find((v) => v?.available !== false);
        return String((availableVariant || variants[0])?.id || '');
      }
    } catch {
      // ignore
    }

    return '';
  };

  const getCartAddUrl = () => {
    const root = window?.Shopify?.routes?.root;
    if (root) return `${root}cart/add.js`;
    return '/cart/add.js';
  };

  const getCheckoutUrl = () => {
    const root = window?.Shopify?.routes?.root;
    if (root) return `${root}checkout`;
    return '/checkout';
  };

  const handleCartAction = async ({ actionType, event }) => {
    const variantIdRaw = getSelectedVariantId();
    const variantId = Number.parseInt(String(variantIdRaw), 10);
    if (!Number.isFinite(variantId)) {
      if (event?.source && event.source !== window) {
        event.source.postMessage(
          {
            type: 'NUSENSE_ACTION_ERROR',
            action: actionType,
            error: 'No variant selected. Please select a product variant.',
          },
          event.origin,
        );
      }
      return;
    }

    const productForm = document.querySelector('form[action*="/cart/add"]');
    const quantity = (() => {
      try {
        if (!productForm) return 1;
        const q = new FormData(productForm).get('quantity');
        const parsed = Number.parseInt(String(q || 1), 10);
        return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
      } catch {
        return 1;
      }
    })();

    const cartData = {
      items: [
        {
          id: variantId,
          quantity,
        },
      ],
    };

    try {
      const cartAddUrl = getCartAddUrl();
      const response = await fetch(cartAddUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cartData),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const errorMessage = data?.description || data?.message || 'Failed to add product to cart';
        if (event?.source && event.source !== window) {
          event.source.postMessage(
            { type: 'NUSENSE_ACTION_ERROR', action: actionType, error: errorMessage },
            event.origin,
          );
        }
        return;
      }

      if (actionType === 'NUSENSE_BUY_NOW') {
        window.location.href = getCheckoutUrl();
        return;
      }

      if (typeof window.dispatchEvent === 'function') {
        window.dispatchEvent(new CustomEvent('cart:updated'));
        window.dispatchEvent(new CustomEvent('cart:add', { detail: data }));
      }

      try {
        const cart = window?.theme?.cart;
        if (cart && typeof cart.getCart === 'function') cart.getCart();
      } catch {
        // ignore
      }

      if (event?.source && event.source !== window) {
        event.source.postMessage(
          { type: 'NUSENSE_ACTION_SUCCESS', action: actionType, cart: data },
          event.origin,
        );
      }
    } catch (e) {
      if (event?.source && event.source !== window) {
        event.source.postMessage(
          { type: 'NUSENSE_ACTION_ERROR', action: actionType, error: 'Network error. Please try again.' },
          event.origin,
        );
      }
      warn('[NUSENSE] Cart action failed', e);
    }
  };

  const handleMessage = (event) => {
    try {
      const type = event?.data?.type;
      if (!type || typeof type !== 'string') return;
      if (!type.startsWith('NUSENSE_')) return;
      if (!isAllowedOrigin(event.origin)) return;
      if (!event.source || event.source === window) return;

      if (type === 'NUSENSE_REQUEST_STORE_INFO') {
        event.source.postMessage(
          {
            type: 'NUSENSE_STORE_INFO',
            domain: window.location.hostname,
            shopDomain: window?.NUSENSE_CONFIG?.shopDomain || '',
            origin: window.location.origin,
            fullUrl: window.location.href,
          },
          event.origin,
        );
        return;
      }

      if (type === 'NUSENSE_REQUEST_IMAGES') {
        const images = getProductImages();
        const mainUrls = images.map((img) => img?.url).filter(Boolean);
        // "Recommended" rail should be populated ONLY from the parent page DOM:
        // all other product-card images on the page, excluding the current product images.
        let recommendedImages = getOtherProductImagesOnPage(mainUrls);
        // Fallback: if no other product images exist on the page, use the main product images.
        if (!Array.isArray(recommendedImages) || recommendedImages.length === 0) {
          recommendedImages = images;
        }

        event.source.postMessage(
          { type: 'NUSENSE_PRODUCT_IMAGES', images, recommendedImages },
          event.origin,
        );
        return;
      }

      if (type === 'NUSENSE_ADD_TO_CART' || type === 'NUSENSE_BUY_NOW') {
        void handleCartAction({ actionType: type, event });
        return;
      }

      if (type === 'NUSENSE_TRY_IN_STORE') {
        event.source.postMessage(
          { type: 'NUSENSE_ACTION_INFO', action: type, message: 'Try in store functionality is not configured.' },
          event.origin,
        );
        return;
      }
    } catch (e) {
      error('[NUSENSE] Message handling error', e);
    }
  };

  window.addEventListener('message', handleMessage);
  log('[NUSENSE] Parent bridge initialized');
})();


