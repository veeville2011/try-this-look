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

  const getCartChangeUrl = () => {
    const root = window?.Shopify?.routes?.root;
    return root ? `${root}cart/change` : '/cart/change';
  };

  const getCheckoutUrl = () => {
    const root = window?.Shopify?.routes?.root;
    return root ? `${root}checkout` : '/checkout';
  };

  const handleCartAction = async ({ actionType, event, quantityOverride }) => {
    // Priority: variantId from message > DOM selector > NUSENSE_PRODUCT_DATA
    let variantIdRaw = event?.data?.variantId ?? null;
    
    // If not provided in message, try to get from DOM
    if (!variantIdRaw) {
      variantIdRaw = getSelectedVariantId();
    }
    
    // If still not found, try to get from NUSENSE_PRODUCT_DATA
    if (!variantIdRaw) {
      try {
        const productData = window?.NUSENSE_PRODUCT_DATA;
        if (productData?.variants && Array.isArray(productData.variants) && productData.variants.length > 0) {
          // Try to find selected variant or use first available variant
          const selectedVariant = productData.variants.find((v) => v?.selected === true) ||
                                   productData.variants.find((v) => v?.available !== false) ||
                                   productData.variants[0];
          variantIdRaw = selectedVariant?.id ?? null;
        }
      } catch {
        // ignore
      }
    }
    
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
      warn('[NUSENSE] No variant ID found. Tried:', {
        fromMessage: event?.data?.variantId,
        fromDOM: getSelectedVariantId(),
        fromProductData: window?.NUSENSE_PRODUCT_DATA?.variants?.[0]?.id,
      });
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
      
      // Debug logging
      log('[NUSENSE] Adding to cart:', {
        url: cartAddUrl,
        variantId,
        quantity,
        cartData,
      });
      
      const response = await fetch(cartAddUrl, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          // Use custom header to mark widget-initiated requests (more reliable than body property)
          'X-Nusense-Widget': 'true'
        },
        body: JSON.stringify(cartData),
      });

      const data = await response.json().catch(() => ({}));

      // Debug logging for response
      log('[NUSENSE] Cart API response:', {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        data,
      });

      if (!response.ok) {
        const errorMessage = data?.description || data?.message || `Failed to add product to cart (${response.status})`;
        error('[NUSENSE] Cart API error:', {
          status: response.status,
          statusText: response.statusText,
          errorMessage,
          data,
          cartData,
        });
        if (event?.source && event.source !== window) {
          event.source.postMessage(
            { type: 'NUSENSE_ACTION_ERROR', action: actionType, error: errorMessage },
            event.origin,
          );
        }
        return;
      }

      // Verify that items were actually added
      if (!Array.isArray(data?.items) || data.items.length === 0) {
        const errorMessage = 'Cart API returned success but no items were added';
        warn('[NUSENSE] Cart API warning:', {
          data,
          cartData,
        });
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
      
      // Call /cart/change to trigger cart update and section refresh
      // This ensures the cart state is properly synchronized and triggers theme refresh listeners
      // Shopify's /cart/change endpoint expects:
      // - line: 1-based line item index in cart
      // - quantity: new quantity
      // - sections: section ID to refresh (e.g., header section)
      // - sections_url: product URL for section rendering
      if (firstItem) {
        try {
          const cartChangeUrl = getCartChangeUrl();
          
          // Find the line item index (1-based) - the item we just added should be the last one
          // or we can find it by matching variant_id
          const lineItemIndex = (() => {
            if (!Array.isArray(data?.items)) return 1;
            // Find the index of the item we just added (match by variant_id)
            const index = data.items.findIndex(item => 
              String(item?.variant_id) === String(variantId) || 
              String(item?.id) === String(variantId)
            );
            // Return 1-based index (if found) or use the last item index
            return index >= 0 ? index + 1 : data.items.length;
          })();
          
          const lineItemQuantity = firstItem.quantity || quantity;
          
          // Get product URL for sections_url (must be relative path, not absolute)
          const getProductUrl = () => {
            // Try to get relative URL from cart response
            if (firstItem?.url && typeof firstItem.url === 'string') {
              // If it's already relative, use it
              if (firstItem.url.startsWith('/')) {
                return firstItem.url;
              }
              // If it's absolute, extract the pathname
              try {
                const urlObj = new URL(firstItem.url);
                return urlObj.pathname;
              } catch {
                // If URL parsing fails, try to extract path manually
                const match = firstItem.url.match(/\/products\/[^?#]+/);
                if (match) return match[0];
              }
            }
            
            // Try from NUSENSE_PRODUCT_DATA
            const productDataUrl = window?.NUSENSE_PRODUCT_DATA?.url;
            if (productDataUrl && typeof productDataUrl === 'string') {
              if (productDataUrl.startsWith('/')) {
                return productDataUrl;
              }
              try {
                const urlObj = new URL(productDataUrl);
                return urlObj.pathname;
              } catch {
                const match = productDataUrl.match(/\/products\/[^?#]+/);
                if (match) return match[0];
              }
            }
            
            // Fallback to current page pathname
            return window?.location?.pathname || '/';
          };
          
          const productUrl = getProductUrl();
          
          // Extract section ID from DOM or use default pattern
          // Shopify themes typically use data-section-id or id attributes
          // Format: sections--{section_id}__header_section (e.g., "sections--18940114960428__header_section")
          const getSectionId = () => {
            try {
              // Method 1: Try to find header section ID from DOM attributes
              const headerSection = document.querySelector('[data-section-id*="header"]') ||
                                   document.querySelector('[id*="header"]') ||
                                   document.querySelector('[data-section-type="header"]') ||
                                   document.querySelector('header[data-section-id]') ||
                                   document.querySelector('[class*="header"][data-section-id]');
              
              if (headerSection) {
                let sectionId = headerSection.getAttribute('data-section-id') ||
                               headerSection.getAttribute('id') ||
                               headerSection.getAttribute('data-section-type');
                
                if (sectionId) {
                  // If already in correct format, return as is
                  if (/^sections--\d+__header_section$/i.test(sectionId)) {
                    return sectionId;
                  }
                  // Extract numeric ID and format it
                  const numericId = sectionId.replace(/^sections--/, '').replace(/__.*$/, '').replace(/\D/g, '');
                  if (numericId) {
                    return `sections--${numericId}__header_section`;
                  }
                }
              }
              
              // Method 2: Try to extract from Shopify theme object
              if (window?.theme?.sections?.header?.id) {
                const themeSectionId = String(window.theme.sections.header.id);
                return `sections--${themeSectionId}__header_section`;
              }
              
              // Method 3: Search for section ID pattern in the page HTML
              try {
                const sectionPattern = /sections--(\d+)__header_section/gi;
                const pageContent = document.documentElement.innerHTML;
                const matches = [...pageContent.matchAll(sectionPattern)];
                if (matches.length > 0) {
                  // Use the first match
                  return matches[0][0];
                }
              } catch (e) {
                // ignore HTML parsing errors
              }
              
              // Method 4: Try to find section ID in script tags or data attributes
              const scriptTags = document.querySelectorAll('script[type="application/json"][data-section-id]');
              for (const script of scriptTags) {
                const sectionId = script.getAttribute('data-section-id');
                if (sectionId && /^\d+$/.test(sectionId)) {
                  return `sections--${sectionId}__header_section`;
                }
              }
            } catch (e) {
              warn('[NUSENSE] Error extracting section ID:', e);
            }
            return null;
          };
          
          const sectionId = getSectionId();
          
          // Build payload - only include sections if we found a valid section ID
          const changePayload = {
            line: lineItemIndex,
            quantity: lineItemQuantity,
            sections_url: productUrl,
          };
          
          // Only add sections parameter if we have a valid section ID
          if (sectionId) {
            changePayload.sections = sectionId;
          } else {
            warn('[NUSENSE] Cannot determine section ID for cart change API. Calling without sections parameter.');
          }
          
          log('[NUSENSE] Calling cart change API:', {
            url: cartChangeUrl,
            payload: changePayload,
            lineItemIndex,
            quantity: lineItemQuantity,
            sectionId: sectionId || 'NOT_FOUND',
            productUrl,
          });
          
          // Call cart change API to ensure cart is updated and triggers refresh
          const changeResponse = await fetch(cartChangeUrl, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            body: JSON.stringify(changePayload),
          });
          
          if (changeResponse.ok) {
            // Try to parse as JSON first (for sections response)
            let changeData = null;
            const contentType = changeResponse.headers.get('content-type');
            
            if (contentType && contentType.includes('application/json')) {
              changeData = await changeResponse.json().catch(() => null);
            } else {
              // If not JSON, try to parse as HTML/text
              const textResponse = await changeResponse.text().catch(() => null);
              if (textResponse) {
                log('[NUSENSE] Cart change API returned non-JSON response:', {
                  contentType,
                  textLength: textResponse.length,
                });
              }
            }
            
            if (changeData) {
              log('[NUSENSE] Cart change API success:', changeData);
              
              // Handle section HTML updates if sections parameter was included
              // Shopify returns section HTML in the response when sections parameter is provided
              if (sectionId && changeData?.sections && typeof changeData.sections === 'object') {
                try {
                  // Update the DOM with the new section HTML
                  const sectionHtml = changeData.sections[sectionId];
                  if (sectionHtml && typeof sectionHtml === 'string') {
                    // Extract numeric section ID for DOM query
                    const numericSectionId = sectionId.replace(/^sections--/, '').replace(/__.*$/, '');
                    
                    // Try multiple selectors to find the section element
                    const sectionElement = document.querySelector(`[data-section-id="${numericSectionId}"]`) ||
                                         document.querySelector(`[id*="${numericSectionId}"]`) ||
                                         document.querySelector(`section[data-section-id="${numericSectionId}"]`) ||
                                         document.querySelector('header[data-section-id]') ||
                                         document.querySelector('[data-section-type="header"]') ||
                                         document.querySelector('header');
                    
                    if (sectionElement) {
                      // Parse the HTML response
                      const tempDiv = document.createElement('div');
                      tempDiv.innerHTML = sectionHtml.trim();
                      
                      // Get the first element (should be the section wrapper)
                      const newSectionContent = tempDiv.firstElementChild || tempDiv;
                      
                      if (newSectionContent) {
                        // Replace the entire section content
                        sectionElement.innerHTML = newSectionContent.innerHTML;
                        
                        // Also update outerHTML if it's a direct match
                        if (sectionElement.tagName === newSectionContent.tagName) {
                          // Preserve the original element but update its content
                          while (sectionElement.firstChild) {
                            sectionElement.removeChild(sectionElement.firstChild);
                          }
                          while (newSectionContent.firstChild) {
                            sectionElement.appendChild(newSectionContent.firstChild);
                          }
                        }
                        
                        // Trigger custom events for theme compatibility
                        sectionElement.dispatchEvent(new CustomEvent('section:updated', { 
                          detail: { sectionId, html: sectionHtml },
                          bubbles: true
                        }));
                        
                        // Also trigger on document for broader compatibility
                        document.dispatchEvent(new CustomEvent('shopify:section:load', {
                          detail: { sectionId },
                          bubbles: true
                        }));
                        
                        log('[NUSENSE] Section HTML updated successfully:', {
                          sectionId,
                          elementFound: true,
                          htmlLength: sectionHtml.length,
                        });
                      } else {
                        warn('[NUSENSE] Could not parse section HTML:', {
                          sectionId,
                          htmlLength: sectionHtml.length,
                        });
                      }
                    } else {
                      warn('[NUSENSE] Could not find section element in DOM:', {
                        sectionId,
                        numericSectionId,
                        triedSelectors: [
                          `[data-section-id="${numericSectionId}"]`,
                          `[id*="${numericSectionId}"]`,
                          'header[data-section-id]',
                          '[data-section-type="header"]',
                        ],
                      });
                    }
                  }
                } catch (e) {
                  warn('[NUSENSE] Error updating section HTML:', {
                    error: e,
                    sectionId,
                    message: e?.message,
                  });
                }
              } else if (sectionId) {
                // Section ID was provided but no sections in response
                warn('[NUSENSE] Section ID provided but no sections in response:', {
                  sectionId,
                  responseKeys: changeData ? Object.keys(changeData) : [],
                  hasSections: !!changeData?.sections,
                });
              }
              
              // Use the updated cart data from change response if available
              if (Array.isArray(changeData?.items) && changeData.items.length > 0) {
                // Update data with change response for consistency
                data = changeData;
                log('[NUSENSE] Updated cart data from change response');
              }
            }
          } else {
            const errorText = await changeResponse.text().catch(() => '');
            let errorData = null;
            try {
              errorData = errorText ? JSON.parse(errorText) : null;
            } catch {
              // Not JSON, use text as error
            }
            
            warn('[NUSENSE] Cart change API returned non-ok status:', {
              status: changeResponse.status,
              statusText: changeResponse.statusText,
              error: errorData || errorText,
              payload: changePayload,
              contentType: changeResponse.headers.get('content-type'),
            });
          }
        } catch (e) {
          // Don't fail the whole operation if change API fails
          // The item is already added via /cart/add.js
          warn('[NUSENSE] Cart change API error (non-critical):', {
            error: e,
            message: e?.message,
            stack: e?.stack,
          });
        }
      }
      
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

      // ============================================
      // Track widget-initiated cart action (Pixel + Cart API)
      // This happens on shop domain to prevent duplicate tracking
      // ============================================
      if (productInfo.productId && productInfo.variantId) {
        try {
          // 1. Pixel Tracking (Analytics/Attribution) - works even without customer login
          if (window.Shopify?.analytics?.publish) {
            try {
              // Get price and quantity from cart data if available
              const cartItem = data?.items?.[0] || null;
              const productPrice = cartItem?.price || cartItem?.final_price || null;
              const productQuantity = cartItem?.quantity || 1;

              window.Shopify.analytics.publish('product_added_to_cart', {
                product: {
                  id: productInfo.productId,
                  title: productInfo.productTitle,
                  price: productPrice,
                  quantity: productQuantity,
                  variant: {
                    id: productInfo.variantId,
                    price: productPrice
                  }
                }
              });
              log('[NUSENSE] Tracked widget cart event via Pixel:', {
                productId: productInfo.productId,
                actionType: actionType
              });
            } catch (pixelError) {
              warn('[NUSENSE] Failed to track widget cart event via Pixel:', pixelError);
            }
          }

          // 2. Cart Tracking API (Business Logic) - requires customer login
          const customerInfo = getCustomerInfo();
          if (customerInfo && customerInfo.id) {
            const shopDomain = window?.NUSENSE_CONFIG?.shopDomain || window.location.hostname;
            if (shopDomain) {
              const normalizedStoreName = normalizeShopDomain(shopDomain);
              const apiBaseUrl = getApiBaseUrl();
              const url = `${apiBaseUrl}/cart-tracking/track`;

              const payload = {
                storeName: normalizedStoreName,
                actionType: actionType === 'NUSENSE_BUY_NOW' ? 'buy_now' : 'add_to_cart',
                productId: productInfo.productId,
                productTitle: productInfo.productTitle,
                productUrl: productInfo.productUrl,
                variantId: productInfo.variantId,
                customerId: customerInfo.id,
              };

              // Fire and forget - don't block cart action
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
                .then(trackingData => {
                  log('[NUSENSE] Tracked widget cart event via Cart Tracking API:', {
                    productId: productInfo.productId,
                    productTitle: productInfo.productTitle,
                    variantId: productInfo.variantId,
                    actionType: actionType === 'NUSENSE_BUY_NOW' ? 'buy_now' : 'add_to_cart'
                  });
                })
                .catch(error => {
                  warn('[NUSENSE] Failed to track widget cart event via Cart Tracking API:', error);
                });
            }
          } else {
            log('[NUSENSE] Skipping Cart Tracking API for widget event - customer not logged in (Pixel tracking already sent)');
          }
        } catch (trackingError) {
          warn('[NUSENSE] Error tracking widget cart event:', trackingError);
        }
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

      // Note: NUSENSE_INIT_TRACKING is no longer needed - Web Pixel Extension handles initialization automatically

      // Handle tracking events from widget
      if (type === 'NUSENSE_TRACK_EVENT') {
        // Add origin check for security
        if (!isAllowedOrigin(event.origin)) return;
        if (!event.source || event.source === window) return;
        
        try {
          // Use Shopify.analytics.publish() instead of NulightTracking
          if (window.Shopify?.analytics?.publish) {
            const { eventType, eventData } = event.data;
            
            // Map event types to Shopify analytics publish calls
            switch (eventType) {
              case 'widget_opened':
                window.Shopify.analytics.publish('tryon:widget_opened', {});
                break;
              case 'widget_closed':
                window.Shopify.analytics.publish('tryon:widget_closed', {});
                break;
              case 'photo_uploaded':
                window.Shopify.analytics.publish('tryon:photo_uploaded', {
                  tryon: {
                    product_id: eventData?.productId,
                    product_title: eventData?.productTitle
                  }
                });
                break;
              case 'garment_selected':
                window.Shopify.analytics.publish('tryon:garment_selected', {
                  product: {
                    id: eventData?.productId,
                    title: eventData?.productTitle,
                    image_url: eventData?.productImageUrl
                  }
                });
                break;
              case 'tryon_started':
                window.Shopify.analytics.publish('tryon:started', {
                  product: {
                    id: eventData?.productId,
                    title: eventData?.productTitle
                  }
                });
                break;
              case 'tryon_completed':
                window.Shopify.analytics.publish('tryon:completed', {
                  tryon: {
                    tryon_id: eventData?.tryonId,
                    product_id: eventData?.productId,
                    product_title: eventData?.productTitle,
                    processing_time_ms: eventData?.processingTimeMs
                  }
                });
                break;
              case 'result_viewed':
                window.Shopify.analytics.publish('tryon:result_viewed', {
                  tryon: {
                    tryon_id: eventData?.tryonId
                  }
                });
                break;
              case 'result_shared':
                window.Shopify.analytics.publish('tryon:result_shared', {
                  tryon: {
                    tryon_id: eventData?.tryonId,
                    share_platform: eventData?.platform
                  }
                });
                break;
              case 'result_downloaded':
                window.Shopify.analytics.publish('tryon:result_downloaded', {
                  tryon: {
                    tryon_id: eventData?.tryonId
                  }
                });
                break;
              case 'feedback_submitted':
                window.Shopify.analytics.publish('tryon:feedback_submitted', {
                  tryon: {
                    tryon_id: eventData?.tryonId,
                    feedback_liked: eventData?.liked,
                    feedback_text: eventData?.text
                  }
                });
                break;
              case 'product_viewed':
                window.Shopify.analytics.publish('product_viewed', {
                  product: eventData?.product || {}
                });
                break;
              case 'add_to_cart':
                // Skip tracking here - widget-initiated cart actions are tracked in handleCartAction
                // when NUSENSE_ACTION_SUCCESS is sent. This prevents duplicate tracking.
                // Only track if this is a standalone event (not from widget cart action).
                // For widget cart actions, tracking happens in handleCartAction after successful cart operation.
                log('[NUSENSE] Received add_to_cart tracking event - skipping (handled in handleCartAction)');
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
      if (window.Shopify?.analytics?.publish && !widgetOpenTracked) {
        window.Shopify.analytics.publish('tryon:widget_opened', {});
        widgetOpenTracked = true;
        log('[NUSENSE] Tracked widget open');
      }
    } catch (error) {
      // Silently fail - tracking is optional
    }
  };
  
  const trackWidgetClose = () => {
    try {
      if (window.Shopify?.analytics?.publish && widgetOpenTracked) {
        window.Shopify.analytics.publish('tryon:widget_closed', {});
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
      if (window.Shopify?.analytics?.publish) {
        const productData = window?.NUSENSE_PRODUCT_DATA;
        if (productData) {
          // Retry logic: wait for Shopify analytics to be ready
          const retryTrack = (attempts = 0) => {
            if (attempts > 10) return; // Max 10 retries (5 seconds)
            
            if (window.Shopify?.analytics?.publish) {
              window.Shopify.analytics.publish('product_viewed', {
                product: {
                  id: productData.id,
                  title: productData.title,
                  vendor: productData.shop?.name,
                  type: null,
                  url: productData.url,
                  image_url: productData.images?.[0]?.url,
                  price: productData.priceRaw,
                  variant: productData.variants?.[0]
                }
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
    // Wait for Shopify analytics to be ready
    const checkTrackingReady = () => {
      if (window.Shopify?.analytics?.publish) {
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
   return 'https://ai.nusense.ddns.net/api';
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
      if (window.Shopify?.analytics?.publish) {
        try {
          window.Shopify.analytics.publish('product_added_to_cart', {
            product: {
              id: productData.id,
              title: productData.title,
              price: productData.price,
              quantity: productData.quantity || 1,
              variant: productData.variant
            }
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
      const url = `${apiBaseUrl}/cart-tracking/track`;

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
                    const url = `${apiBaseUrl}/cart-tracking/track`;

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
                  const url = `${apiBaseUrl}/cart-tracking/track`;

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
            // Check if this is a widget-initiated request (check custom header first, then body)
            const headers = args[1].headers || {};
            const body = args[1].body;
            let isWidgetRequest = false;
            let isBuyNowRequest = false;
            
            // Check custom header (preferred method - more reliable)
            if (headers['X-Nusense-Widget'] === 'true' || headers['x-nusense-widget'] === 'true') {
              isWidgetRequest = true;
            }
            
            // Also check body for backward compatibility and Buy Now detection
            if (body && !isWidgetRequest) {
              try {
                // Try to parse body to check for widget flag or checkout parameter
                if (typeof body === 'string') {
                  const parsed = JSON.parse(body);
                  // Check for widget flag in body (fallback for older code)
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
                        if (data && data.items) {
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
      // Wait for Shopify analytics to be ready
      const checkTrackingReady = () => {
        if (window.Shopify?.analytics?.publish) {
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
      if (window.Shopify?.analytics?.publish) {
        setupNativeCartTracking();
      } else {
        setTimeout(checkTrackingReady, 100);
      }
    };
    checkTrackingReady();
  }
})();


