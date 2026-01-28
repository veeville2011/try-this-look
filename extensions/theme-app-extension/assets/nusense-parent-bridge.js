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
        document.querySelector('[name="id"]') ??
        document.querySelector('input[name="id"]') ??
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
        return String((availableVariant ?? variants[0])?.id ?? '');
      }
    } catch {
      // ignore
    }

    return '';
  };

  const getCartAddUrl = () => {
    const root = window?.Shopify?.routes?.root;
    return root ? `${root}cart/add.js` : '/cart/add.js';
  };

  const getCartUrl = () => {
    const root = window?.Shopify?.routes?.root;
    return root ? `${root}cart.js` : '/cart.js';
  };

  const getCheckoutUrl = () => {
    const root = window?.Shopify?.routes?.root;
    return root ? `${root}checkout` : '/checkout';
  };

  const handleCartAction = async ({ actionType, event, quantityOverride }) => {
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

    const parsePositiveInt = (value, fallback = 1) => {
      const parsed = Number.parseInt(String(value ?? ''), 10);
      if (!Number.isFinite(parsed)) return fallback;
      if (parsed <= 0) return fallback;
      return parsed;
    };

    const productForm = document.querySelector('form[action*="/cart/add"]');
    const formQuantity = (() => {
      try {
        if (!productForm) return 1;
        const q = new FormData(productForm).get('quantity');
        return parsePositiveInt(q, 1);
      } catch {
        return 1;
      }
    })();

    const safeQuantityOverride = parsePositiveInt(quantityOverride, 0);
    const quantity = safeQuantityOverride > 0 ? safeQuantityOverride : formQuantity;

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

      // Extract product and variant data from cart response
      // Cart API returns items array with variant_id, product_id, product_title, url
      const firstItem = Array.isArray(data?.items) && data.items.length > 0 ? data.items[0] : null;
      const productData = window?.NUSENSE_PRODUCT_DATA ?? {};
      
      // Debug logging to understand response structure
      if (typeof console !== 'undefined' && console?.log) {
        console.log('[NUSENSE] Cart API Response:', {
          hasItems: Array.isArray(data?.items),
          itemsLength: data?.items?.length,
          firstItem: firstItem,
          variantId: variantId,
          productData: productData,
        });
      }
      
      // Normalize product URL - cart API may return relative URL, convert to absolute
      const normalizeProductUrl = (url) => {
        if (!url || typeof url !== 'string') return null;
        // If already absolute URL, return as is
        if (url.startsWith('http://') || url.startsWith('https://')) return url;
        // If relative URL, make it absolute
        if (url.startsWith('/')) {
          const origin = window?.location?.origin;
          return origin ? origin + url : url;
        }
        return url;
      };
      
      // Extract from cart response - use snake_case fields from Shopify API
      const cartProductId = firstItem?.product_id ?? null;
      const cartVariantId = firstItem?.variant_id ?? null;
      const cartProductTitle = firstItem?.product_title ?? null;
      const cartProductUrl = normalizeProductUrl(firstItem?.url) ?? null;
      
      // Get variant ID from NUSENSE_PRODUCT_DATA if cart response doesn't have it
      let fallbackVariantId = variantId; // Use the variant ID we sent in the request
      if (!cartVariantId && variantId && productData?.variants) {
        // Try to find the variant in NUSENSE_PRODUCT_DATA.variants array
        const variant = Array.isArray(productData.variants) 
          ? productData.variants.find(v => String(v?.id) === String(variantId))
          : null;
        if (variant) {
          fallbackVariantId = variant?.id ?? variantId;
        }
      }
      
      // Build product info with priority: cart response > NUSENSE_PRODUCT_DATA > variantId from request
      const productInfo = {
        productId: cartProductId ?? productData?.id ?? null,
        productTitle: cartProductTitle ?? productData?.title ?? null,
        productUrl: cartProductUrl ?? productData?.url ?? null,
        variantId: cartVariantId ?? fallbackVariantId ?? null,
      };
      
      // Debug logging for final product info
      if (typeof console !== 'undefined' && console.log) {
        console.log('[NUSENSE] Final Product Info for Tracking:', productInfo);
      }

      if (actionType === 'NUSENSE_BUY_NOW') {
        // Send success message before redirect so tracking can happen
        // Use setTimeout to ensure message is sent before page redirects
        if (event?.source && event.source !== window) {
          event.source.postMessage(
            { 
              type: 'NUSENSE_ACTION_SUCCESS', 
              action: actionType, 
              cart: data,
              product: productInfo
            },
            event.origin,
          );
        }
        // Small delay to ensure message is sent before redirect
        setTimeout(() => {
          window.location.href = getCheckoutUrl();
        }, 50);
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
          { 
            type: 'NUSENSE_ACTION_SUCCESS', 
            action: actionType, 
            cart: data,
            product: productInfo
          },
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

      if (type === 'NUSENSE_REQUEST_PRODUCT_DATA') {
        const productData = window?.NUSENSE_PRODUCT_DATA || null;
        if (productData) {
          const selectedVariantId = getSelectedVariantId() || null;
          event.source.postMessage(
            {
              type: 'NUSENSE_PRODUCT_DATA',
              productData: {
                id: productData.id || null,
                title: productData.title || null,
                url: productData.url || null,
                variants: productData.variants || null,
                selectedVariantId,
              },
            },
            event.origin,
          );
          log('[NUSENSE] Sent product data to iframe:', {
            id: productData.id,
            title: productData.title,
            hasUrl: !!productData.url,
            variantsCount: Array.isArray(productData.variants) ? productData.variants.length : 0,
            hasSelectedVariantId: !!selectedVariantId,
          });
        } else {
          warn('[NUSENSE] NUSENSE_PRODUCT_DATA not available');
        }
        return;
      }

      if (type === 'NUSENSE_REQUEST_CART_STATE') {
        // Get current cart state from Shopify
        const getCartState = async () => {
          try {
            const cartUrl = getCartUrl();
            if (!cartUrl) {
              // No cart URL available, send empty cart
              if (event?.source && event.source !== window) {
                event.source.postMessage(
                  { type: 'NUSENSE_CART_STATE', items: [] },
                  event.origin,
                );
              }
              return;
            }

            const response = await fetch(cartUrl, {
              method: 'GET',
              headers: { 'Content-Type': 'application/json' },
            });

            if (!response.ok) {
              throw new Error('Failed to fetch cart state');
            }

            const data = await response.json().catch(() => ({}));
            const cartItems = Array.isArray(data?.items) ? data.items : [];

            if (event?.source && event.source !== window) {
              event.source.postMessage(
                { type: 'NUSENSE_CART_STATE', items: cartItems },
                event.origin,
              );
            }

            log('[NUSENSE] Sent cart state to iframe:', {
              itemsCount: cartItems.length,
            });
          } catch (e) {
            warn('[NUSENSE] Failed to get cart state', e);
            // Send empty cart on error
            if (event?.source && event.source !== window) {
              event.source.postMessage(
                { type: 'NUSENSE_CART_STATE', items: [] },
                event.origin,
              );
            }
          }
        };

        void getCartState();
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
        const quantityOverride = event?.data?.quantity;
        void handleCartAction({ actionType: type, event, quantityOverride });
        return;
      }

      if (type === 'NUSENSE_NOTIFY_ME') {
        // Handle notify me (back in stock notification)
        // Try to find the notify me form on the page or trigger Shopify's notify me functionality
        try {
          const variantId = event?.data?.variantId;
          const productData = event?.data?.product || window?.NUSENSE_PRODUCT_DATA || {};
          
          // Look for Shopify's notify me form or button
          // Common selectors for notify me functionality in Shopify themes
          const notifyMeSelectors = [
            'form[action*="/contact"]',
            'button[data-notify-me]',
            '.notify-me-form',
            '[data-back-in-stock]',
            'form[action*="/notify"]',
          ];
          
          let notifyForm = null;
          for (const selector of notifyMeSelectors) {
            notifyForm = document.querySelector(selector);
            if (notifyForm) break;
          }
          
          if (notifyForm) {
            // If form found, try to submit it or trigger it
            if (notifyForm.tagName === 'FORM') {
              // Fill variant ID if there's an input for it
              const variantInput = notifyForm.querySelector('input[name*="variant"], input[name*="id"]');
              if (variantInput && variantId) {
                variantInput.value = String(variantId);
              }
              // Trigger form submission (prefer requestSubmit when available)
              try {
                if (typeof notifyForm.requestSubmit === 'function') {
                  notifyForm.requestSubmit();
                } else {
                  notifyForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
                  if (typeof notifyForm.submit === 'function') notifyForm.submit();
                }
              } catch {
                // ignore
              }
            } else if (notifyForm.tagName === 'BUTTON') {
              // If it's a button, click it
              if (typeof notifyForm.click === 'function') notifyForm.click();
            }
            
            // Send success message
            if (event?.source && event.source !== window) {
              event.source.postMessage(
                { 
                  type: 'NUSENSE_ACTION_SUCCESS', 
                  action: 'NUSENSE_NOTIFY_ME',
                  message: 'Notification request submitted'
                },
                event.origin,
              );
            }
          } else {
            // No notify me form found - send info message
            if (event?.source && event.source !== window) {
              event.source.postMessage(
                { 
                  type: 'NUSENSE_ACTION_INFO', 
                  action: 'NUSENSE_NOTIFY_ME',
                  message: 'Notify me functionality not available on this page. Please use the store\'s notify me form if available.'
                },
                event.origin,
              );
            }
            log('[NUSENSE] Notify me requested but no form found on page');
          }
        } catch (e) {
          warn('[NUSENSE] Notify me handling failed', e);
          if (event?.source && event.source !== window) {
            event.source.postMessage(
              { 
                type: 'NUSENSE_ACTION_ERROR', 
                action: 'NUSENSE_NOTIFY_ME',
                error: 'Failed to process notify me request'
              },
              event.origin,
            );
          }
        }
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


