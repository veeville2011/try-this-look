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
        headers: { 'Content-Type': 'application/json' },
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

      // IMMEDIATE SYNCHRONOUS REFRESH - Trigger events immediately with response data
      // This ensures themes that listen to events get notified right away
      const triggerImmediateRefresh = (cartData) => {
        try {
          // Dispatch events immediately (synchronous)
          if (typeof window.dispatchEvent === 'function') {
            window.dispatchEvent(new CustomEvent('cart:updated', { detail: cartData }));
            window.dispatchEvent(new CustomEvent('cart:add', { detail: cartData }));
            window.dispatchEvent(new CustomEvent('cart:refresh', { detail: cartData }));
            window.dispatchEvent(new CustomEvent('cart:change', { detail: cartData }));
            window.dispatchEvent(new CustomEvent('ajaxCart:updated', { detail: cartData }));
            window.dispatchEvent(new CustomEvent('theme:cart:change', { detail: cartData }));
            window.dispatchEvent(new CustomEvent('shopify:cart:updated', { detail: cartData }));
            window.dispatchEvent(new CustomEvent('cart:reload', { detail: cartData }));
            window.dispatchEvent(new CustomEvent('cart:update', { detail: cartData }));
          }

          // jQuery events (synchronous)
          if (typeof window.jQuery !== 'undefined' && window.jQuery) {
            try {
              window.jQuery(window).trigger('cart:updated', [cartData]);
              window.jQuery(window).trigger('cart:refresh', [cartData]);
              window.jQuery(window).trigger('ajaxCart:updated', [cartData]);
              window.jQuery(document).trigger('cart:updated', [cartData]);
              window.jQuery(document).trigger('shopify:cart:updated', [cartData]);
              if (document.body) {
                window.jQuery(document.body).trigger('cart:updated', [cartData]);
              }
            } catch {
              // ignore jQuery errors
            }
          }

          // Update Shopify.cart object immediately
          try {
            if (window.Shopify && window.Shopify.cart) {
              window.Shopify.cart.items = cartData.items || [];
              window.Shopify.cart.item_count = cartData.item_count || 0;
              window.Shopify.cart.total_price = cartData.total_price || 0;
            }
          } catch {
            // ignore
          }

          // Try theme cart API immediately
          try {
            const cart = window?.theme?.cart;
            if (cart) {
              if (typeof cart.update === 'function') cart.update();
              if (typeof cart.refresh === 'function') cart.refresh();
            }
          } catch {
            // ignore
          }
        } catch (e) {
          warn('[NUSENSE] Immediate refresh error:', e);
        }
      };

      // Update cart count badges IMMEDIATELY (synchronous, before everything else)
      // Works on both mobile and desktop
      // This is the PRIMARY mechanism for updating cart count - it always works
      const itemCount = data?.item_count ?? 0;
      
      log('[NUSENSE] Updating cart count badges:', {
        itemCount,
        itemsLength: data?.items?.length,
        cartData: data,
      });
      try {
        const cartCountSelectors = [
          // Common cart count selectors (mobile & desktop)
          '[data-cart-count]',
          '.cart-count',
          '#cart-count',
          '[data-cart-item-count]',
          '.cart-item-count',
          '.cart__count',
          '[aria-label*="cart"] [data-count]',
          '[data-cart-counter]',
          '.cart-counter',
          // Mobile-specific cart count badges
          '[data-mobile-cart-count]',
          '.mobile-cart-count',
          '[data-header-cart-count]',
          '.header-cart-count',
          // Icon badges
          '.cart-icon-badge',
          '[data-cart-badge]',
          '.cart-badge',
          // Text content selectors
          '[data-cart-count-text]',
          '.cart-count-text',
          // Additional common patterns
          '[id*="cart-count"]',
          '[class*="cart-count"]',
          '[data-count]',
        ];
        
        cartCountSelectors.forEach((selector) => {
          try {
            const elements = document.querySelectorAll(selector);
            elements.forEach((el) => {
              // Update text content
              if (el.textContent !== undefined) {
                el.textContent = String(itemCount);
              }
              // Update innerText as well (some themes use this)
              if (el.innerText !== undefined) {
                el.innerText = String(itemCount);
              }
              // Update data attributes
              if (el.dataset) {
                el.dataset.cartCount = String(itemCount);
                el.dataset.count = String(itemCount);
                el.dataset.itemCount = String(itemCount);
              }
              // Update aria-label if it contains cart count
              if (el.getAttribute && el.getAttribute('aria-label')) {
                const ariaLabel = el.getAttribute('aria-label');
                if (ariaLabel && /\d+/.test(ariaLabel)) {
                  el.setAttribute('aria-label', ariaLabel.replace(/\d+/, String(itemCount)));
                }
              }
              // Trigger events for reactive frameworks
              if (typeof el.dispatchEvent === 'function') {
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
                el.dispatchEvent(new Event('update', { bubbles: true }));
              }
            });
          } catch {
            // ignore selector errors
          }
        });
      } catch {
        // ignore DOM update errors
      }

      // Trigger immediate refresh with response data (synchronous)
      triggerImmediateRefresh(data);

      // Fetch fresh cart state and update theme UI (async - more comprehensive)
      const refreshCartUI = async () => {
        try {
          // First, fetch the latest cart state from Shopify
          const cartUrl = getCartUrl();
          const cartResponse = await fetch(cartUrl, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
          });
          
          if (cartResponse.ok) {
            const freshCartData = await cartResponse.json().catch(() => null);
            if (freshCartData) {
              // Use fresh cart data for all refresh operations
              const cartDataToUse = freshCartData;
              
              // Trigger comprehensive cart refresh for Shopify themes
              // Dispatch multiple cart events that different themes listen to
              if (typeof window.dispatchEvent === 'function') {
                // Standard cart events (most themes listen to these)
                window.dispatchEvent(new CustomEvent('cart:updated', { detail: cartDataToUse }));
                window.dispatchEvent(new CustomEvent('cart:add', { detail: cartDataToUse }));
                window.dispatchEvent(new CustomEvent('cart:refresh', { detail: cartDataToUse }));
                window.dispatchEvent(new CustomEvent('cart:change', { detail: cartDataToUse }));
                window.dispatchEvent(new CustomEvent('ajaxCart:updated', { detail: cartDataToUse }));
                window.dispatchEvent(new CustomEvent('theme:cart:change', { detail: cartDataToUse }));
                
                // Additional common event patterns
                window.dispatchEvent(new CustomEvent('shopify:cart:updated', { detail: cartDataToUse }));
                window.dispatchEvent(new CustomEvent('cart:reload', { detail: cartDataToUse }));
                window.dispatchEvent(new CustomEvent('cart:update', { detail: cartDataToUse }));
                
                // Some themes listen to jQuery events
                if (typeof window.jQuery !== 'undefined' && window.jQuery) {
                  try {
                    window.jQuery(window).trigger('cart:updated', [cartDataToUse]);
                    window.jQuery(window).trigger('cart:refresh', [cartDataToUse]);
                    window.jQuery(window).trigger('ajaxCart:updated', [cartDataToUse]);
                    window.jQuery(document).trigger('cart:updated', [cartDataToUse]);
                    window.jQuery(document).trigger('shopify:cart:updated', [cartDataToUse]);
                    // Trigger on body as well (some themes listen there)
                    if (document.body) {
                      window.jQuery(document.body).trigger('cart:updated', [cartDataToUse]);
                    }
                  } catch {
                    // ignore jQuery errors
                  }
                }
              }

              // Method 1: Shopify theme cart API (covers most official themes)
              try {
                const cart = window?.theme?.cart;
                if (cart) {
                  if (typeof cart.getCart === 'function') cart.getCart();
                  if (typeof cart.refresh === 'function') cart.refresh();
                  if (typeof cart.update === 'function') cart.update();
                  if (typeof cart.render === 'function') cart.render(cartDataToUse);
                  if (typeof cart.buildCart === 'function') cart.buildCart(cartDataToUse);
                  if (typeof cart.rebuild === 'function') cart.rebuild();
                  if (typeof cart.load === 'function') cart.load();
                }
                
                // Also check for theme-specific cart objects
                if (window?.theme?.CartDrawer) {
                  try {
                    if (typeof window.theme.CartDrawer.open === 'function') {
                      // Some themes need drawer to be opened to refresh
                    }
                    if (typeof window.theme.CartDrawer.refresh === 'function') {
                      window.theme.CartDrawer.refresh();
                    }
                  } catch {
                    // ignore
                  }
                }
              } catch (e) {
                warn('[NUSENSE] Theme cart API error:', e);
              }

              // Method 2: Shopify AJAX Cart API (common in many themes)
              try {
                if (window.Shopify && window.Shopify.cart) {
                  if (typeof window.Shopify.cart.getCart === 'function') {
                    window.Shopify.cart.getCart();
                  }
                  // Update cart object directly
                  if (window.Shopify.cart) {
                    window.Shopify.cart.items = cartDataToUse.items || [];
                    window.Shopify.cart.item_count = cartDataToUse.item_count || 0;
                    window.Shopify.cart.total_price = cartDataToUse.total_price || 0;
                  }
                }
              } catch (e) {
                warn('[NUSENSE] Shopify cart API error:', e);
              }

              // Method 3: Update cart drawer content directly (mobile & desktop)
              try {
                const cartDrawerSelectors = [
                  // Desktop cart drawer selectors
                  '[data-cart-drawer]',
                  '.cart-drawer',
                  '#cart-drawer',
                  '[id*="cart-drawer"]',
                  '[class*="cart-drawer"]',
                  '[data-ajax-cart-container]',
                  '.ajax-cart-container',
                  // Mobile cart drawer/panel selectors
                  '[data-cart-panel]',
                  '.cart-panel',
                  '#cart-panel',
                  '[data-mobile-cart]',
                  '.mobile-cart',
                  '[data-cart-sidebar]',
                  '.cart-sidebar',
                  '[data-cart-modal]',
                  '.cart-modal',
                  '[id*="cart-modal"]',
                  '[class*="cart-modal"]',
                  // Bottom sheet patterns (common on mobile)
                  '[data-bottom-sheet]',
                  '.bottom-sheet',
                  '[data-sheet*="cart"]',
                  '[class*="sheet"][class*="cart"]',
                  // Slide-in panels
                  '[data-slide-panel]',
                  '.slide-panel',
                  '[data-off-canvas]',
                  '.off-canvas',
                ];
                
                cartDrawerSelectors.forEach((selector) => {
                  try {
                    const drawer = document.querySelector(selector);
                    if (drawer) {
                      // Trigger refresh event on drawer
                      if (typeof drawer.dispatchEvent === 'function') {
                        drawer.dispatchEvent(new CustomEvent('refresh', { detail: cartDataToUse }));
                        drawer.dispatchEvent(new CustomEvent('cart:updated', { detail: cartDataToUse }));
                      }
                      // Some themes use data attributes to trigger refresh
                      if (drawer.dataset) {
                        drawer.dataset.refresh = 'true';
                        drawer.dataset.cartUpdated = 'true';
                        setTimeout(() => {
                          if (drawer.dataset) {
                            delete drawer.dataset.refresh;
                            delete drawer.dataset.cartUpdated;
                          }
                        }, 100);
                      }
                      // Try to find and update cart content
                      const cartContent = drawer.querySelector('[data-cart-items]') || 
                                         drawer.querySelector('.cart-items') ||
                                         drawer.querySelector('[id*="cart-items"]');
                      if (cartContent && typeof cartContent.dispatchEvent === 'function') {
                        cartContent.dispatchEvent(new CustomEvent('refresh', { detail: cartDataToUse }));
                      }
                    }
                  } catch {
                    // ignore drawer errors
                  }
                });
              } catch (e) {
                warn('[NUSENSE] Cart drawer update error:', e);
              }
            }
          }
        } catch (e) {
          warn('[NUSENSE] Failed to fetch fresh cart state:', e);
        }
      };

      // Trigger comprehensive async refresh (fetches fresh cart and updates UI)
      // This runs in parallel and doesn't block the success message
      void refreshCartUI();

      // Small delay to ensure immediate refresh events have propagated
      // Then send success message to widget
      setTimeout(() => {
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
      }, 50);
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


