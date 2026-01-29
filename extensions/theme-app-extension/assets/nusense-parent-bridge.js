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

  const getCheckoutUrl = () => {
    const root = window?.Shopify?.routes?.root;
    return root ? `${root}checkout` : '/checkout';
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
        // Mark as widget-initiated to prevent double tracking
        const eventData = { ...data, _nusenseWidget: true };
        window.dispatchEvent(new CustomEvent('cart:updated'));
        window.dispatchEvent(new CustomEvent('cart:add', { detail: eventData }));
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
          event.source.postMessage(
            {
              type: 'NUSENSE_PRODUCT_DATA',
              productData: {
                id: productData.id || null,
                title: productData.title || null,
                url: productData.url || null,
                variants: productData.variants || null,
              },
            },
            event.origin,
          );
          log('[NUSENSE] Sent product data to iframe:', {
            id: productData.id,
            title: productData.title,
            hasUrl: !!productData.url,
            variantsCount: Array.isArray(productData.variants) ? productData.variants.length : 0,
          });
        } else {
          warn('[NUSENSE] NUSENSE_PRODUCT_DATA not available');
        }
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

      // Handle tracking initialization from widget
      if (type === 'NUSENSE_INIT_TRACKING') {
        // Add origin check for security
        if (!isAllowedOrigin(event.origin)) return;
        if (!event.source || event.source === window) return;
        
        try {
          if (window.NulightTracking && !window.NULIGHT_TRACKING_INITIALIZED) {
            const config = event.data.config || {};
            // API key is optional - backend doesn't require it
            window.NulightTracking.init({
              apiKey: config.apiKey || null, // Optional
              apiUrl: config.apiUrl || 'https://ai.nusense.ddns.net/api',
              debug: config.debug || false
            });
            window.NULIGHT_TRACKING_INITIALIZED = true;
            log('[NUSENSE] Tracking SDK initialized from widget');
          }
        } catch (error) {
          // Silently fail - tracking is optional
          warn('[NUSENSE] Failed to initialize tracking:', error);
        }
        return;
      }

      // Handle tracking events from widget
      if (type === 'NUSENSE_TRACK_EVENT') {
        // Add origin check for security
        if (!isAllowedOrigin(event.origin)) return;
        if (!event.source || event.source === window) return;
        
        try {
          if (window.NulightTracking && window.NULIGHT_TRACKING_INITIALIZED) {
            const { eventType, eventData } = event.data;
            const tracking = window.NulightTracking;
            
            // Map event types to tracking methods
            switch (eventType) {
              case 'widget_open':
                tracking.trackWidgetOpen();
                break;
              case 'widget_close':
                tracking.trackWidgetClose();
                break;
              case 'photo_upload':
                tracking.trackPhotoUpload(eventData);
                break;
              case 'garment_select':
                tracking.trackGarmentSelect(eventData.productId, eventData.productTitle, eventData.productImageUrl);
                break;
              case 'tryon_start':
                tracking.trackTryonStart(eventData.productId, eventData.productTitle);
                break;
              case 'tryon_complete':
                tracking.trackTryonComplete(eventData.tryonId, eventData.productId, eventData.productTitle, eventData.processingTimeMs);
                break;
              case 'result_view':
                tracking.trackResultView(eventData.tryonId);
                break;
              case 'share':
                tracking.trackShare(eventData.tryonId, eventData.platform);
                break;
              case 'download':
                tracking.trackDownload(eventData.tryonId);
                break;
              case 'feedback':
                tracking.trackFeedback(eventData.tryonId, eventData.liked, eventData.text);
                break;
              case 'product_view':
                tracking.trackProductView(eventData.product);
                break;
              case 'add_to_cart':
                // Track via Pixel for analytics (Cart Tracking API handled separately in widget)
                tracking.trackAddToCart(eventData.product);
                break;
              default:
                // Unknown event type - ignore
                break;
            }
          }
        } catch (error) {
          // Silently fail - tracking is optional
          warn('[NUSENSE] Failed to track event:', error);
        }
        return;
      }
    } catch (e) {
      error('[NUSENSE] Message handling error', e);
    }
  };

  window.addEventListener('message', handleMessage);
  log('[NUSENSE] Parent bridge initialized');

  // =============================
  // Tracking: DOM Observer for Widget Open/Close
  // =============================
  
  // Track widget open/close by observing iframe visibility
  let widgetIframe = null;
  let widgetOpenTracked = false;
  
  const trackWidgetOpen = () => {
    try {
      if (window.NulightTracking && window.NULIGHT_TRACKING_INITIALIZED && !widgetOpenTracked) {
        window.NulightTracking.trackWidgetOpen();
        widgetOpenTracked = true;
        log('[NUSENSE] Tracked widget open');
      }
    } catch (error) {
      // Silently fail - tracking is optional
    }
  };
  
  const trackWidgetClose = () => {
    try {
      if (window.NulightTracking && window.NULIGHT_TRACKING_INITIALIZED && widgetOpenTracked) {
        window.NulightTracking.trackWidgetClose();
        widgetOpenTracked = false;
        log('[NUSENSE] Tracked widget close');
      }
    } catch (error) {
      // Silently fail - tracking is optional
    }
  };
  
  // Observe DOM for widget iframe
  const observeWidgetIframe = () => {
    try {
      // Find widget iframe
      const iframes = document.querySelectorAll('iframe');
      for (const iframe of iframes) {
        try {
          const src = iframe.src || iframe.getAttribute('src') || '';
          const widgetUrl = window?.NUSENSE_CONFIG?.widgetUrl || '';
          if (widgetUrl && src.includes(widgetUrl)) {
            widgetIframe = iframe;
            
            // Track widget open when iframe is added/visible
            const observer = new MutationObserver((mutations) => {
              if (iframe.offsetParent !== null && !widgetOpenTracked) {
                trackWidgetOpen();
              }
            });
            
            observer.observe(iframe, {
              attributes: true,
              attributeFilter: ['style', 'class'],
              childList: false,
              subtree: false
            });
            
            // Also check visibility on load
            if (iframe.offsetParent !== null) {
              trackWidgetOpen();
            }
            
            // Track close when iframe is removed or hidden
            const visibilityObserver = new MutationObserver(() => {
              if (iframe.offsetParent === null && widgetOpenTracked) {
                trackWidgetClose();
              }
            });
            
            visibilityObserver.observe(iframe, {
              attributes: true,
              attributeFilter: ['style', 'class'],
              childList: false,
              subtree: false
            });
            
            break;
          }
        } catch (e) {
          // Cross-origin iframe - continue
        }
      }
    } catch (error) {
      // Silently fail - tracking is optional
    }
  };
  
  // Initialize observer when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', observeWidgetIframe);
  } else {
    observeWidgetIframe();
  }
  
  // Also observe for dynamically added iframes
  const iframeObserver = new MutationObserver(() => {
    if (!widgetIframe) {
      observeWidgetIframe();
    }
  });
  
  iframeObserver.observe(document.body || document.documentElement, {
    childList: true,
    subtree: true
  });

  // =============================
  // Tracking: Product View
  // =============================
  
  const trackProductView = () => {
    try {
      if (window.NulightTracking && window.NULIGHT_TRACKING_INITIALIZED) {
        const productData = window?.NUSENSE_PRODUCT_DATA;
        if (productData) {
          // Retry logic: wait for SDK to be ready
          const retryTrack = (attempts = 0) => {
            if (attempts > 10) return; // Max 10 retries (5 seconds)
            
            if (window.NulightTracking && window.NULIGHT_TRACKING_INITIALIZED) {
              window.NulightTracking.trackProductView({
                id: productData.id,
                title: productData.title,
                vendor: productData.shop?.name,
                type: null,
                url: productData.url,
                image_url: productData.images?.[0]?.url,
                price: productData.priceRaw,
                variant: productData.variants?.[0]
              });
              log('[NUSENSE] Tracked product view');
            } else {
              setTimeout(() => retryTrack(attempts + 1), 500);
            }
          };
          
          retryTrack();
        }
      }
    } catch (error) {
      // Silently fail - tracking is optional
    }
  };
  
  // Track product view on product pages (when NUSENSE_PRODUCT_DATA is available)
  if (window?.NUSENSE_PRODUCT_DATA) {
    // Wait for tracking SDK to load
    const checkTrackingReady = () => {
      if (window.NulightTracking) {
        trackProductView();
      } else {
        setTimeout(checkTrackingReady, 100);
      }
    };
    checkTrackingReady();
  }

  // =============================
  // Tracking: Native Add to Cart
  // =============================

  /**
   * Extract product data from cart response or form
   */
  const extractProductDataFromCart = (cartData) => {
    try {
      const firstItem = Array.isArray(cartData?.items) && cartData.items.length > 0 
        ? cartData.items[0] 
        : null;
      
      if (!firstItem) return null;

      const productData = window?.NUSENSE_PRODUCT_DATA ?? {};
      
      // Normalize product URL - cart API may return relative URL
      const normalizeProductUrl = (url) => {
        if (!url || typeof url !== 'string') return null;
        if (url.startsWith('http://') || url.startsWith('https://')) return url;
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
      const cartPrice = firstItem?.price ?? null;
      const cartQuantity = firstItem?.quantity ?? 1;

      // Get variant details from NUSENSE_PRODUCT_DATA if available
      let variant = null;
      if (cartVariantId && productData?.variants && Array.isArray(productData.variants)) {
        variant = productData.variants.find(v => String(v?.id) === String(cartVariantId)) || null;
      }

      return {
        id: cartProductId ?? productData?.id ?? null,
        title: cartProductTitle ?? productData?.title ?? null,
        url: cartProductUrl ?? productData?.url ?? null,
        price: cartPrice ?? productData?.priceRaw ?? null,
        quantity: cartQuantity,
        variant: variant || {
          id: cartVariantId ?? null,
          price: cartPrice ?? null
        }
      };
    } catch (error) {
      warn('[NUSENSE] Error extracting product data from cart:', error);
      return null;
    }
  };

  /**
   * Get customer info from script tag (injected by Liquid)
   */
  const getCustomerInfo = () => {
    try {
      const customerInfoScript = document.getElementById('nusense-customer-info');
      if (customerInfoScript && customerInfoScript.textContent) {
        try {
          const customerInfo = JSON.parse(customerInfoScript.textContent);
          if (customerInfo && (customerInfo.id || customerInfo.email)) {
            return {
              id: customerInfo.id ? customerInfo.id.toString() : null,
              email: customerInfo.email || null,
              firstName: customerInfo.firstName || null,
              lastName: customerInfo.lastName || null,
            };
          }
        } catch (parseError) {
          // Error parsing customer info JSON
        }
      }
      return null;
    } catch (error) {
      return null;
    }
  };

  /**
   * Get API base URL from config or use default
   */
  const getApiBaseUrl = () => {
    try {
      return window?.NUSENSE_CONFIG?.apiUrl || 'https://ai.nusense.ddns.net/api';
    } catch {
      return 'https://ai.nusense.ddns.net/api';
    }
  };

  /**
   * Normalize shop domain
   */
  const normalizeShopDomain = (shop) => {
    if (!shop) return null;
    let normalized = shop.trim().toLowerCase();
    normalized = normalized.replace(/^https?:\/\//, '');
    if (!normalized.includes('.myshopify.com')) {
      normalized = normalized + '.myshopify.com';
    }
    return normalized;
  };

  /**
   * Track native add to cart event using both Pixel and Cart Tracking API
   */
  const trackNativeAddToCart = (cartData, actionType = 'add_to_cart') => {
    try {
      const productData = extractProductDataFromCart(cartData);
      if (!productData || !productData.id) {
        log('[NUSENSE] Cannot track add to cart - missing product data');
        return;
      }

      // ============================================
      // 1. Pixel Tracking (Analytics/Attribution)
      // ============================================
      // Always track via Pixel for analytics - works even without customer login
      if (window.NulightTracking && window.NULIGHT_TRACKING_INITIALIZED) {
        try {
          window.NulightTracking.trackAddToCart({
            id: productData.id,
            title: productData.title,
            price: productData.price,
            quantity: productData.quantity || 1,
            variant: productData.variant
          });
          log('[NUSENSE] Tracked native cart event via Pixel:', {
            productId: productData.id,
            actionType: actionType
          });
        } catch (pixelError) {
          warn('[NUSENSE] Failed to track via Pixel:', pixelError);
        }
      }

      // ============================================
      // 2. Cart Tracking API (Business Logic)
      // ============================================
      // Only track via Cart API if customer is logged in (required for business logic)
      const customerInfo = getCustomerInfo();
      if (!customerInfo || !customerInfo.id) {
        log('[NUSENSE] Skipping Cart Tracking API - customer not logged in (Pixel tracking already sent)');
        return;
      }

      const shopDomain = window?.NUSENSE_CONFIG?.shopDomain || window.location.hostname;
      if (!shopDomain) {
        warn('[NUSENSE] Cannot track via Cart API - missing shop domain');
        return;
      }

      const normalizedStoreName = normalizeShopDomain(shopDomain);
      const apiBaseUrl = getApiBaseUrl();
      const url = `${apiBaseUrl}/api/cart-tracking/track`;

      const payload = {
        storeName: normalizedStoreName,
        actionType: actionType,
        productId: productData.id,
        productTitle: productData.title,
        productUrl: productData.url,
        variantId: productData.variant?.id || null,
        customerId: customerInfo.id,
      };

      // Use regular fetch (authenticatedFetch is just a wrapper)
      fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })
        .then(response => {
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          return response.json();
        })
        .then(data => {
          log('[NUSENSE] Tracked native cart event via Cart Tracking API:', {
            productId: productData.id,
            productTitle: productData.title,
            variantId: productData.variant?.id,
            actionType: actionType
          });
        })
        .catch(error => {
          warn('[NUSENSE] Failed to track via Cart Tracking API:', error);
        });
    } catch (error) {
      warn('[NUSENSE] Failed to track native add to cart:', error);
    }
  };

  /**
   * Check if an element is a "Buy Now" button
   */
  const isBuyNowButton = (element) => {
    if (!element) return false;
    
    // Check button text/content
    const text = (element.textContent || element.value || '').toLowerCase();
    const buyNowKeywords = ['buy now', 'buynow', 'checkout now', 'purchase now'];
    if (buyNowKeywords.some(keyword => text.includes(keyword))) {
      return true;
    }
    
    // Check classes and IDs
    const className = (element.className || '').toLowerCase();
    const id = (element.id || '').toLowerCase();
    if (className.includes('buy-now') || className.includes('buynow') || 
        id.includes('buy-now') || id.includes('buynow') ||
        className.includes('checkout-now') || id.includes('checkout-now')) {
      return true;
    }
    
    // Check data attributes
    if (element.dataset?.checkout === 'true' || 
        element.dataset?.buyNow === 'true' ||
        element.getAttribute('data-checkout') === 'true') {
      return true;
    }
    
    // Check if link goes directly to checkout
    if (element.tagName === 'A' || element.tagName === 'a') {
      const href = (element.getAttribute('href') || '').toLowerCase();
      if (href.includes('/checkout') && !href.includes('/cart')) {
        return true;
      }
    }
    
    return false;
  };

  /**
   * Extract product data from form or button context
   */
  const extractProductDataFromForm = (form) => {
    try {
      const productData = window?.NUSENSE_PRODUCT_DATA ?? {};
      if (!productData || !productData.id) return null;
      
      // Get variant ID from form
      let variantId = null;
      const variantInput = form.querySelector('input[name="id"], select[name="id"]');
      if (variantInput) {
        variantId = variantInput.value || variantInput.selectedOptions?.[0]?.value;
      }
      
      // Get quantity
      const quantityInput = form.querySelector('input[name="quantity"]');
      const quantity = quantityInput ? parseInt(quantityInput.value || '1', 10) : 1;
      
      // Find variant in product data
      let variant = null;
      if (variantId && productData.variants && Array.isArray(productData.variants)) {
        variant = productData.variants.find(v => String(v?.id) === String(variantId)) || null;
      }
      
      return {
        id: productData.id,
        title: productData.title,
        url: productData.url,
        price: variant?.priceRaw || productData.priceRaw,
        quantity: quantity,
        variant: variant || {
          id: variantId || productData.variants?.[0]?.id || null,
          price: variant?.priceRaw || productData.priceRaw || null
        }
      };
    } catch (error) {
      warn('[NUSENSE] Error extracting product data from form:', error);
      return null;
    }
  };

  /**
   * Intercept native form submissions
   */
  const setupNativeCartTracking = () => {
    // Listen for Shopify's cart:add and cart:updated events
    // These are dispatched by Shopify themes after successful cart additions
    if (typeof window.addEventListener === 'function') {
      const handleCartEvent = (event) => {
        // Only track if this is a native cart event (not from widget)
        if (event.detail && !event.detail._nusenseWidget) {
          // Wait a bit for cart data to be available
          setTimeout(() => {
            try {
              // Try to get cart data from event detail
              const cartData = event.detail?.items ? { items: event.detail.items } : event.detail;
              
              // If event detail doesn't have items, try to fetch cart
              if (!cartData?.items || cartData.items.length === 0) {
                // Try to get cart from Shopify's cart API
                const cartAddUrl = getCartAddUrl();
                const cartUrl = cartAddUrl.replace('/add.js', '.js');
                
                fetch(cartUrl)
                  .then(response => response.json())
                  .then(cart => {
                    if (cart && cart.items && cart.items.length > 0) {
                      trackNativeAddToCart(cart, 'add_to_cart');
                    }
                  })
                  .catch(() => {
                    // If fetch fails, try with event detail anyway
                    if (cartData) {
                      trackNativeAddToCart(cartData, 'add_to_cart');
                    }
                  });
              } else {
                trackNativeAddToCart(cartData, 'add_to_cart');
              }
            } catch (error) {
              warn('[NUSENSE] Error handling cart event:', error);
            }
          }, 100);
        }
      };

      window.addEventListener('cart:add', handleCartEvent);
      window.addEventListener('cart:updated', handleCartEvent);

      // Also intercept form submissions as a fallback
      // Use MutationObserver to catch dynamically added forms
      const observeForms = () => {
        // Track both /cart/add and /cart forms (Buy Now often uses /cart with checkout param)
        const productForms = document.querySelectorAll('form[action*="/cart/add"], form[action*="/cart"]');
        productForms.forEach(form => {
          // Skip if already observed
          if (form.dataset._nusenseObserved) return;
          form.dataset._nusenseObserved = 'true';

          const handleFormSubmit = (event) => {
            // Check if this form submission is from widget (check for widget button)
            const submitButton = event.submitter || form.querySelector('button[type="submit"], input[type="submit"]');
            const isWidgetButton = submitButton && (
              submitButton.id?.startsWith('nusense-') ||
              submitButton.classList.contains('nusense-tryon-button')
            );

            if (isWidgetButton) {
              return; // Skip widget-initiated submissions
            }

            // Check if this is a Buy Now action
            const formAction = (form.getAttribute('action') || '').toLowerCase();
            const isBuyNow = isBuyNowButton(submitButton) || 
                            formAction.includes('/checkout') ||
                            form.querySelector('input[name="checkout"]') ||
                            form.querySelector('input[value*="checkout"]');

            // Extract product data before form submits (for Buy Now)
            const productData = isBuyNow ? extractProductDataFromForm(form) : null;

            // Let the form submit normally, then track after a delay
            setTimeout(() => {
              try {
                if (isBuyNow && productData) {
                  // Track Buy Now immediately with extracted data
                  const customerInfo = getCustomerInfo();
                  if (customerInfo && customerInfo.id) {
                    const shopDomain = window?.NUSENSE_CONFIG?.shopDomain || window.location.hostname;
                    const normalizedStoreName = normalizeShopDomain(shopDomain);
                    const apiBaseUrl = getApiBaseUrl();
                    const url = `${apiBaseUrl}/api/cart-tracking/track`;

                    const payload = {
                      storeName: normalizedStoreName,
                      actionType: 'buy_now',
                      productId: productData.id,
                      productTitle: productData.title,
                      productUrl: productData.url,
                      variantId: productData.variant?.id || null,
                      customerId: customerInfo.id,
                    };

                    // Send tracking request (fire and forget - don't wait for response)
                    fetch(url, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(payload),
                    }).catch(() => {
                      // Silently fail - tracking is optional
                    });
                  }
                } else {
                  // Regular add to cart - fetch cart data
                  const cartAddUrl = getCartAddUrl();
                  const cartUrl = cartAddUrl.replace('/add.js', '.js');
                  
                  fetch(cartUrl)
                    .then(response => response.json())
                    .then(cart => {
                      if (cart && cart.items && cart.items.length > 0) {
                        // Get the last added item (most recent)
                        const lastItem = cart.items[cart.items.length - 1];
                        trackNativeAddToCart({ items: [lastItem] }, 'add_to_cart');
                      }
                    })
                    .catch(() => {
                      // Silently fail - tracking is optional
                    });
                }
              } catch (error) {
                // Silently fail - tracking is optional
              }
            }, isBuyNow ? 50 : 300); // Faster for Buy Now since redirect happens quickly
          };

          // Listen for form submit events
          form.addEventListener('submit', handleFormSubmit, true);
        });

        // Also observe Buy Now links/buttons
        const buyNowSelectors = [
          'a[href*="/checkout"]',
          'a[data-checkout]',
          'button[data-checkout]',
          '.buy-now',
          '.buynow',
          '#buy-now',
          '#buynow'
        ];

        buyNowSelectors.forEach(selector => {
          document.querySelectorAll(selector).forEach(element => {
            if (element.dataset._nusenseObserved) return;
            element.dataset._nusenseObserved = 'true';

            const handleBuyNowClick = (event) => {
              // Skip if widget-initiated
              if (element.id?.startsWith('nusense-') || 
                  element.classList.contains('nusense-tryon-button')) {
                return;
              }

              // Extract product data
              const productForm = element.closest('form[action*="/cart"]') || 
                                 document.querySelector('form[action*="/cart/add"]');
              const productData = productForm ? extractProductDataFromForm(productForm) : null;

              if (productData) {
                const customerInfo = getCustomerInfo();
                if (customerInfo && customerInfo.id) {
                  const shopDomain = window?.NUSENSE_CONFIG?.shopDomain || window.location.hostname;
                  const normalizedStoreName = normalizeShopDomain(shopDomain);
                  const apiBaseUrl = getApiBaseUrl();
                  const url = `${apiBaseUrl}/api/cart-tracking/track`;

                  const payload = {
                    storeName: normalizedStoreName,
                    actionType: 'buy_now',
                    productId: productData.id,
                    productTitle: productData.title,
                    productUrl: productData.url,
                    variantId: productData.variant?.id || null,
                    customerId: customerInfo.id,
                  };

                  // Send tracking request (fire and forget)
                  fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                  }).catch(() => {
                    // Silently fail
                  });
                }
              }
            };

            element.addEventListener('click', handleBuyNowClick, true);
          });
        });
      };

      // Observe existing forms
      observeForms();

      // Watch for dynamically added forms
      const formObserver = new MutationObserver(() => {
        observeForms();
      });

      formObserver.observe(document.body || document.documentElement, {
        childList: true,
        subtree: true
      });

      // Also listen for AJAX cart additions (common in modern themes)
      // Intercept fetch calls to /cart/add.js
      // Only intercept if fetch hasn't been wrapped already
      if (!window.__NUSENSE_FETCH_WRAPPED) {
        const originalFetch = window.fetch;
        window.fetch = function(...args) {
          const url = args[0];
          const isCartAdd = typeof url === 'string' && url.includes('/cart/add.js');
          
          if (isCartAdd && args[1] && args[1].method === 'POST') {
            // Check if this is a widget-initiated request (has _nusenseWidget flag in body)
            const body = args[1].body;
            let isWidgetRequest = false;
            let isBuyNowRequest = false;
            
            if (body) {
              try {
                // Try to parse body to check for widget flag or checkout parameter
                if (typeof body === 'string') {
                  const parsed = JSON.parse(body);
                  isWidgetRequest = parsed._nusenseWidget === true;
                  // Check if this is a Buy Now request (might have checkout parameter)
                  isBuyNowRequest = parsed.checkout === true || parsed.checkout === 'true';
                } else if (body instanceof FormData) {
                  // FormData - check for checkout parameter
                  isBuyNowRequest = body.has('checkout') && body.get('checkout') === 'true';
                }
              } catch {
                // Body might not be JSON, that's okay
              }
            }
            
            // Only track if this is NOT a widget-initiated request
            if (!isWidgetRequest) {
              // This is a native cart add request
              return originalFetch.apply(this, args)
                .then(response => {
                  // Clone response so we can read it without consuming it
                  const clonedResponse = response.clone();
                  
                  // Track after successful addition
                  if (response.ok) {
                    clonedResponse.json()
                      .then(data => {
                        if (data && data.items && !data._nusenseWidget) {
                          // Determine action type based on request
                          const actionType = isBuyNowRequest ? 'buy_now' : 'add_to_cart';
                          trackNativeAddToCart(data, actionType);
                        }
                      })
                      .catch(() => {
                        // Silently fail
                      });
                  }
                  
                  return response;
                });
            }
          }
          
          return originalFetch.apply(this, args);
        };
        
        window.__NUSENSE_FETCH_WRAPPED = true;
      }

    }
  };

  // Initialize native cart tracking when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      // Wait for tracking SDK to be ready
      const checkTrackingReady = () => {
        if (window.NulightTracking) {
          setupNativeCartTracking();
        } else {
          setTimeout(checkTrackingReady, 100);
        }
      };
      checkTrackingReady();
    });
  } else {
    // DOM already ready
    const checkTrackingReady = () => {
      if (window.NulightTracking) {
        setupNativeCartTracking();
      } else {
        setTimeout(checkTrackingReady, 100);
      }
    };
    checkTrackingReady();
  }
})();


