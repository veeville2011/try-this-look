import { ProductInfo } from '@/types/tryon';

/**
 * Extract product information from Shopify product page
 * This works by looking for common Shopify selectors and data attributes
 */
export function extractShopifyProductInfo(): ProductInfo | null {
  try {
    // Try to get product data from Shopify's product JSON (most reliable)
    const productJsonScript = document.querySelector('script[type="application/ld+json"]');
    if (productJsonScript) {
      const productData = JSON.parse(productJsonScript.textContent || '{}');
      if (productData['@type'] === 'Product') {
        return {
          id: productData.sku || productData.productID || generateProductId(),
          name: productData.name || 'Produit',
          price: parseFloat(productData.offers?.price || '0'),
          image: productData.image || extractFirstProductImage() || '',
          url: window.location.href,
          description: productData.description || '',
          brand: productData.brand?.name || '',
          availability: productData.offers?.availability || 'InStock',
          rating: productData.aggregateRating?.ratingValue || 0,
        };
      }
    }

    // Fallback: Manual extraction from DOM
    const name = extractProductName();
    const price = extractProductPrice();
    const image = extractFirstProductImage();

    return {
      id: generateProductId(),
      name: name || 'Produit',
      price: price || 0,
      image: image || '',
      url: window.location.href,
      description: extractProductDescription() || '',
      sizes: extractProductSizes(),
      colors: extractProductColors(),
      brand: extractBrand(),
      category: extractCategory(),
      availability: 'InStock',
    };
  } catch (error) {
    return null;
  }
}

function extractProductName(): string {
  const selectors = [
    'h1[data-testid*="product"]',
    '.product-title',
    '.product-name',
    '.product__title',
    'h1.title',
    'h1',
  ];

  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element?.textContent) {
      return element.textContent.trim();
    }
  }

  return '';
}

function extractProductPrice(): number {
  const selectors = [
    '.price',
    '.product-price',
    '.current-price',
    '.price__current',
    '[class*="price"]',
    '[itemprop="price"]',
    '.money',
  ];

  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element?.textContent) {
      const priceText = element.textContent.trim();
      const price = parsePrice(priceText);
      if (price > 0) return price;
    }
  }

  return 0;
}

function parsePrice(priceText: string): number {
  const patterns = [
    /€\s*([\d,]+\.?\d*)/,
    /\$\s*([\d,]+\.?\d*)/,
    /£\s*([\d,]+\.?\d*)/,
    /([\d,]+\.?\d*)\s*€/,
    /([\d,]+\.?\d*)\s*\$/,
    /([\d,]+\.?\d*)/,
  ];

  for (const pattern of patterns) {
    const match = priceText.match(pattern);
    if (match) {
      const priceStr = match[1].replace(',', '.');
      const price = parseFloat(priceStr);
      if (!isNaN(price)) return price;
    }
  }

  return 0;
}

function extractFirstProductImage(): string {
  const selectors = [
    '.product-image img',
    '.product__media img',
    '.product-gallery img',
    '[data-testid*="product-image"] img',
    '.main-image img',
    'img[alt*="product"]',
  ];

  for (const selector of selectors) {
    const img = document.querySelector(selector) as HTMLImageElement;
    if (img?.src) {
      return img.src;
    }
  }

  return '';
}

function extractProductDescription(): string {
  const selectors = [
    '.product-description',
    '.product__description',
    '[itemprop="description"]',
    '.description',
  ];

  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element?.textContent) {
      return element.textContent.trim().substring(0, 500);
    }
  }

  return '';
}

function extractProductSizes(): string {
  const sizeSelectors = [
    '.product-form__input--size',
    '[name*="Size"]',
    '[data-option-name*="size"]',
  ];

  for (const selector of sizeSelectors) {
    const elements = document.querySelectorAll(selector);
    if (elements.length > 0) {
      const sizes = Array.from(elements)
        .map(el => el.textContent?.trim())
        .filter(Boolean)
        .join(', ');
      if (sizes) return sizes;
    }
  }

  return '';
}

function extractProductColors(): string {
  const colorSelectors = [
    '.product-form__input--color',
    '[name*="Color"]',
    '[name*="Colour"]',
    '[data-option-name*="color"]',
  ];

  for (const selector of colorSelectors) {
    const elements = document.querySelectorAll(selector);
    if (elements.length > 0) {
      const colors = Array.from(elements)
        .map(el => el.textContent?.trim())
        .filter(Boolean)
        .join(', ');
      if (colors) return colors;
    }
  }

  return '';
}

function extractBrand(): string {
  const selectors = [
    '[itemprop="brand"]',
    '.product-brand',
    '.vendor',
    '.product__vendor',
  ];

  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element?.textContent) {
      return element.textContent.trim();
    }
  }

  return '';
}

function extractCategory(): string {
  const selectors = [
    '.breadcrumb li:last-child',
    '[itemprop="category"]',
    '.product-type',
  ];

  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element?.textContent) {
      return element.textContent.trim();
    }
  }

  return '';
}

function generateProductId(): string {
  return `product_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Initialize image extraction listener for iframe communication
 * This should be called on the parent window to listen for image requests
 */
/**
 * Extract all images from the page that are NOT main product images
 * This finds any images on the page and filters out the main product images
 */
function extractRecommendedProductsImages(mainProductImages: string[]): string[] {
  const allImages: string[] = [];
  const seenUrls = new Set<string>();
  const seenNormalizedUrls = new Set<string>(); // Track normalized URLs (without query params) for better deduplication
  const mainProductImageSet = new Set<string>();
  const mainProductImageBasePaths = new Set<string>(); // Track base image paths for better matching

  // Helper to extract base image path (filename without query params or CDN variations)
  const getBaseImagePath = (url: string): string | null => {
    try {
      const urlObj = new URL(url, window.location.origin);
      // Remove all query params
      urlObj.search = '';
      urlObj.hash = '';
      const path = urlObj.pathname;
      
      // Extract just the filename or last part of path
      // For Shopify CDN URLs like: /cdn/shop/files/image.jpg or /files/image.jpg
      const pathParts = path.split('/');
      const filename = pathParts[pathParts.length - 1];
      
      // Also get a shorter path (last 2 parts) for better matching
      if (pathParts.length >= 2) {
        const shortPath = pathParts.slice(-2).join('/');
        return shortPath.toLowerCase();
      }
      
      return filename.toLowerCase();
    } catch {
      return null;
    }
  };

  // Helper to normalize URL for comparison (remove query params)
  const normalizeUrlForComparison = (url: string): string | null => {
    try {
      const urlObj = new URL(url, window.location.origin);
      urlObj.search = ''; // Remove query params
      urlObj.hash = ''; // Remove hash
      return urlObj.href.toLowerCase();
    } catch {
      return null;
    }
  };

  // Normalize main product images for comparison - add all variations
  mainProductImages.forEach(img => {
    try {
      const normalized = cleanImageUrl(img);
      if (normalized) {
        // Add the cleaned URL
        mainProductImageSet.add(normalized.toLowerCase());
        
        // Add normalized URL (without query params)
        const normalizedForComparison = normalizeUrlForComparison(normalized);
        if (normalizedForComparison) {
          mainProductImageSet.add(normalizedForComparison);
        }
        
        // Add base image path
        const basePath = getBaseImagePath(normalized);
        if (basePath) {
          mainProductImageBasePaths.add(basePath);
        }
        
        // Also add the original URL if different
        try {
          const originalNormalized = normalizeUrlForComparison(img);
          if (originalNormalized && originalNormalized !== normalizedForComparison) {
            mainProductImageSet.add(originalNormalized);
          }
        } catch {}
      } else {
        // Even if cleanImageUrl fails, try to normalize the original
        try {
          const normalizedForComparison = normalizeUrlForComparison(img);
          if (normalizedForComparison) {
            mainProductImageSet.add(normalizedForComparison);
          }
          const basePath = getBaseImagePath(img);
          if (basePath) {
            mainProductImageBasePaths.add(basePath);
          }
        } catch {}
      }
    } catch {
      // Try to normalize the original URL anyway
      try {
        const normalizedForComparison = normalizeUrlForComparison(img);
        if (normalizedForComparison) {
          mainProductImageSet.add(normalizedForComparison);
        }
        const basePath = getBaseImagePath(img);
        if (basePath) {
          mainProductImageBasePaths.add(basePath);
        }
      } catch {}
    }
  });

  // Helper to add image if valid and not duplicate
  const addImage = (url: string) => {
    if (!url) return;
    
    try {
      const cleanUrl = cleanImageUrl(url);
      const urlToCheck = cleanUrl || url;
      
      // Normalize URL for comparison (without query params)
      const normalizedForComparison = normalizeUrlForComparison(urlToCheck);
      if (!normalizedForComparison) return;
      
      // Check if we've already seen this normalized URL (deduplication)
      if (seenNormalizedUrls.has(normalizedForComparison)) {
        return; // Already added this image (duplicate)
      }
      
      // Also check the full URL
      if (seenUrls.has(urlToCheck.toLowerCase())) {
        return;
      }
      
      // Check if this is a main product image - check multiple variations
      let isMainProductImage = false;
      
      // Check full URL (both cleaned and original)
      if (mainProductImageSet.has(urlToCheck.toLowerCase()) || 
          mainProductImageSet.has(normalizedForComparison) ||
          mainProductImageSet.has(url.toLowerCase())) {
        isMainProductImage = true;
      }
      
      // Check base image path (filename)
      if (!isMainProductImage) {
        const basePath = getBaseImagePath(urlToCheck);
        if (basePath && mainProductImageBasePaths.has(basePath)) {
          isMainProductImage = true;
        }
      }
      
      // Double-check by comparing with all main product images using base path
      if (!isMainProductImage && mainProductImages.length > 0) {
        const currentBasePath = getBaseImagePath(urlToCheck);
        if (currentBasePath) {
          for (const mainImg of mainProductImages) {
            const mainBasePath = getBaseImagePath(mainImg);
            if (mainBasePath && mainBasePath === currentBasePath) {
              isMainProductImage = true;
              break;
            }
          }
        }
      }

      // Skip if it's a main product image
      if (isMainProductImage) {
        return;
      }

      // Basic validation: must be a valid image URL
      if (urlToCheck.match(/\.(jpg|jpeg|png|webp|gif|avif)(\?|$)/i)) {
        // Exclude common non-product images
        const lowerUrl = urlToCheck.toLowerCase();
        const excludePatterns = [
          'logo', 'icon', 'badge', 'payment', 'trust', 'review', 'star',
          'avatar', 'user', 'profile', 'social', 'facebook', 'twitter',
          'instagram', 'pinterest', 'google', 'analytics', 'tracking',
          'pixel', 'spacer', 'blank', 'placeholder', '1x1', 'pixel.gif',
          'transparent', '.svg'
        ];

        const shouldExclude = excludePatterns.some(pattern => lowerUrl.includes(pattern));
        if (shouldExclude) return;

        // Ensure absolute URL
        try {
          const absUrl = new URL(urlToCheck, window.location.origin).href;
          if (absUrl) {
            allImages.push(absUrl);
            seenUrls.add(absUrl.toLowerCase());
            seenUrls.add(urlToCheck.toLowerCase());
            seenNormalizedUrls.add(normalizedForComparison);
          }
        } catch {
          // Invalid URL, skip
        }
      }
    } catch {
      // Skip invalid URLs
    }
  };

  try {
    // Extract ALL images from the page
    const allImgElements = document.querySelectorAll('img');
    allImgElements.forEach((img) => {
      if (img instanceof HTMLImageElement) {
        const sources = [
          img.src,
          img.dataset.src,
          img.dataset.lazySrc,
          img.dataset.originalSrc,
          img.dataset.productImage,
          img.currentSrc,
          img.getAttribute('data-original'),
          img.getAttribute('data-lazy'),
        ].filter(Boolean) as string[];

        // Extract from srcset
        if (img.srcset) {
          const srcsetUrls = parseSrcset(img.srcset);
          sources.push(...srcsetUrls);
        }

        sources.forEach(src => addImage(src));
      }
    });

    // Also check background images
    const bgImageElements = document.querySelectorAll('[style*="background-image"]');
    bgImageElements.forEach(el => {
      const style = window.getComputedStyle(el);
      const bgImage = style.backgroundImage;
      if (bgImage && bgImage !== 'none') {
        const urlMatch = bgImage.match(/url\(['"]?([^'"]+)['"]?\)/);
        if (urlMatch && urlMatch[1]) {
          addImage(urlMatch[1]);
        }
      }
    });

  } catch (e) {
    // Error extracting recommended products images
  }

  return allImages;
}

export function initializeImageExtractionListener(): void {
  window.addEventListener("message", (event) => {
    if (event.data && event.data.type === "NUSENSE_REQUEST_IMAGES") {
      type ParentProductImage = string | { id?: string | number; url?: string };

      const toImageUrl = (img: ParentProductImage): string => {
        if (!img) return "";
        if (typeof img === "string") return img;
        return typeof img.url === "string" ? img.url : "";
      };

      let images: ParentProductImage[] = [];
      let recommendedImages: string[] = [];
      let mainProductImageUrls: string[] = [];
      
      // Priority 1: Use NUSENSE_PRODUCT_DATA if available (most reliable)
      if (typeof window !== "undefined" && (window as any).NUSENSE_PRODUCT_DATA) {
        const productData = (window as any).NUSENSE_PRODUCT_DATA;
        if (productData.images && Array.isArray(productData.images) && productData.images.length > 0) {
          images = productData.images;
        }
      }
      
      // Priority 2: Extract from page if NUSENSE_PRODUCT_DATA not available or empty
      if (images.length === 0) {
        const extracted = extractProductImages();
        images = extracted;
      }

      // Normalize main product images to a list of URLs for correct filtering/deduping.
      // (NUSENSE_PRODUCT_DATA.images can be [{id,url}] objects; extractRecommendedProductsImages expects strings.)
      mainProductImageUrls = images.map(toImageUrl).filter(Boolean);

      // Extract all other images from the page that are NOT main product images
      // This will find any images on the page and filter out the main product images
      recommendedImages = extractRecommendedProductsImages(mainProductImageUrls);
      
      // Send images back to the iframe
      if (event.source && event.source !== window) {
        (event.source as Window).postMessage({
          type: "NUSENSE_PRODUCT_IMAGES",
          images: images,
          recommendedImages: recommendedImages
        }, "*");
      }
    }
  });
}

/**
 * Extract all product images from the page
 * This comprehensive function detects images from multiple sources:
 * - Regular img tags (src, data-src, data-lazy-src, srcset)
 * - Background images in CSS
 * - Shopify product JSON data
 * - Shopify-specific gallery/carousel elements
 * - JSON-LD structured data
 */

/**
 * Store information extracted from iframe context
 */
export interface StoreInfo {
  domain: string | null;
  fullUrl: string | null;
  shopDomain: string | null; // Shopify store domain (e.g., "mystore.myshopify.com")
  origin: string | null; // Full origin (e.g., "https://mystore.myshopify.com")
  method: 'referrer' | 'url-param' | 'postmessage' | 'parent-request' | 'unknown';
}

/**
 * Detect Shopify store information from iframe context
 * Uses multiple methods to determine which store the iframe was opened from
 * 
 * Methods (in order of reliability per Shopify documentation):
 * 1. URL parameter 'shop' (automatically added by Shopify app proxy - most reliable)
 * 2. URL parameter 'shop_domain' or 'shopDomain' (manually passed)
 * 3. document.referrer (parent page URL)
 * 4. postMessage event origin (when receiving messages from parent)
 * 5. Request from parent window (via postMessage)
 * 
 * Reference: https://shopify.dev/docs/apps/build/online-store/app-proxies/authenticate-app-proxies
 * 
 * @returns StoreInfo object with store details and detection method
 */
export function detectStoreOrigin(): StoreInfo {
  const result: StoreInfo = {
    domain: null,
    fullUrl: null,
    shopDomain: null,
    origin: null,
    method: 'unknown'
  };

  // Method 1: Check URL parameters
  // Priority order (per Shopify docs):
  // 1. 'shop' parameter (automatically added by Shopify app proxy)
  // 2. 'shop_domain' or 'shopDomain' (manually passed)
  const urlParams = new URLSearchParams(window.location.search);
  const shopDomainParam = urlParams.get('shop') || urlParams.get('shop_domain') || urlParams.get('shopDomain');
  
  if (shopDomainParam) {
    try {
      const domain = shopDomainParam.trim();
      // Shopify app proxy always provides shop in format: "{shop}.myshopify.com"
      // Extract shop domain from various formats
      let shopDomain = domain;
      let origin = domain;
      
      if (domain.includes('http://') || domain.includes('https://')) {
        const url = new URL(domain);
        origin = url.origin;
        shopDomain = url.hostname;
      } else if (!domain.includes('.')) {
        // If just store name, assume myshopify.com
        shopDomain = `${domain}.myshopify.com`;
        origin = `https://${shopDomain}`;
      } else {
        // Shopify format: "mystore.myshopify.com"
        origin = `https://${domain}`;
        shopDomain = domain;
      }
      
      result.domain = shopDomain;
      result.shopDomain = shopDomain;
      result.origin = origin;
      result.fullUrl = origin;
      // If it's the 'shop' parameter, it's from app proxy (most reliable)
      result.method = urlParams.get('shop') ? 'url-param' : 'url-param';
      
      return result;
    } catch (error) {
      // Error parsing shop domain from URL parameter
    }
  }

  // Method 2: Extract from document.referrer (parent page URL)
  const referrer = document.referrer;
  if (referrer) {
    try {
      const referrerUrl = new URL(referrer);
      const hostname = referrerUrl.hostname;
      
      // Check if it's a Shopify store
      if (hostname.includes('.myshopify.com') || 
          hostname.includes('myshopify.io') ||
          hostname.match(/^[a-z0-9-]+\.myshopify\.com$/)) {
        result.domain = hostname;
        result.shopDomain = hostname;
        result.origin = referrerUrl.origin;
        result.fullUrl = referrer;
        result.method = 'referrer';
        return result;
      }
      
      // For custom domains, extract the main domain
      // Shopify stores on custom domains might have the shop in subdomain or path
      result.domain = hostname;
      result.fullUrl = referrer;
      result.origin = referrerUrl.origin;
      result.method = 'referrer';
      return result;
    } catch (error) {
      // Error parsing referrer
    }
  }

  // If we're in an iframe but don't have referrer or URL param,
  // we can request it from parent (Method 4 will handle this)
  const isInIframe = typeof window !== 'undefined' && window.parent !== window;
  if (isInIframe) {
    // Store info will be available when receiving messages from parent
    result.method = 'postmessage';
  }

  return result;
}

/**
 * Extract Shopify store domain from a URL string
 * Handles various formats: full URLs, myshopify.com domains, custom domains
 */
export function extractShopDomainFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;
    
    // Check for myshopify.com domain
    if (hostname.includes('.myshopify.com')) {
      return hostname;
    }
    
    // For custom domains, return the hostname
    // Note: This won't give you the myshopify.com domain, just the custom domain
    return hostname;
  } catch {
    // If URL parsing fails, try to extract domain from string
    const myshopifyMatch = url.match(/([a-z0-9-]+\.myshopify\.com)/i);
    if (myshopifyMatch) {
      return myshopifyMatch[1];
    }
    return null;
  }
}

/**
 * Request store information from parent window via postMessage
 * This should be called when the iframe needs store info from the parent
 * 
 * @param callback Optional callback to handle the store info response
 * @returns Promise that resolves with store info or null
 */
export function requestStoreInfoFromParent(
  callback?: (storeInfo: StoreInfo) => void
): Promise<StoreInfo | null> {
  return new Promise((resolve) => {
    const isInIframe = typeof window !== 'undefined' && window.parent !== window;
    
    if (!isInIframe) {
      resolve(null);
      return;
    }

    const messageHandler = (event: MessageEvent) => {
      // Security: Validate origin if possible
      // Note: Using '*' in postMessage is less secure, but necessary for cross-origin
      
      if (event.data?.type === 'NUSENSE_STORE_INFO') {
        window.removeEventListener('message', messageHandler);
        
        const storeInfo: StoreInfo = {
          domain: event.data.domain || null,
          fullUrl: event.data.fullUrl || null,
          shopDomain: event.data.shopDomain || null,
          origin: event.data.origin || event.origin || null,
          method: 'parent-request'
        };
        
        if (callback) {
          callback(storeInfo);
        }
        
        resolve(storeInfo);
      }
    };

    window.addEventListener('message', messageHandler);
    
    // Request store info from parent
    try {
      window.parent.postMessage({ type: 'NUSENSE_REQUEST_STORE_INFO' }, '*');
    } catch (error) {
      window.removeEventListener('message', messageHandler);
      resolve(null);
    }
  });
}

/**
 * Track store origin from postMessage events
 * Call this in a message event listener to capture store info from parent messages
 */
export function getStoreOriginFromPostMessage(event: MessageEvent): StoreInfo | null {
  // Extract origin from the postMessage event
  if (event.origin) {
    try {
      const url = new URL(event.origin);
      const hostname = url.hostname;
      
      const storeInfo: StoreInfo = {
        domain: hostname,
        shopDomain: hostname.includes('.myshopify.com') ? hostname : null,
        origin: event.origin,
        fullUrl: event.origin,
        method: 'postmessage'
      };
      
      return storeInfo;
    } catch (error) {
      // Error parsing origin from postMessage
    }
  }
  
  return null;
}

/**
 * Get the current store info from the window object (if available)
 * This is set by the TryOnWidget component when store info is detected
 * 
 * @returns StoreInfo or null if not available
 */
export function getCurrentStoreInfo(): StoreInfo | null {
  if (typeof window !== 'undefined' && (window as any).NUSENSE_STORE_INFO) {
    return (window as any).NUSENSE_STORE_INFO;
  }
  return null;
}

export function extractProductImages(): string[] {
  const images: string[] = [];
  const seenUrls = new Set<string>();

  // Helper to add image if valid and not duplicate
  const addImage = (url: string, metadata?: { width?: number; height?: number; alt?: string }) => {
    if (!url || seenUrls.has(url)) return;
    
    const cleanUrl = cleanImageUrl(url);
    if (!cleanUrl || seenUrls.has(cleanUrl)) return;
    
    if (isValidProductImageUrl(cleanUrl, metadata)) {
      images.push(cleanUrl);
      seenUrls.add(cleanUrl);
    }
  };

  // 1. Extract from Shopify Product JSON (most reliable)
  const shopifyProductData = extractShopifyProductJSON();
  if (shopifyProductData?.images) {
    if (Array.isArray(shopifyProductData.images)) {
      shopifyProductData.images.forEach((img: any) => {
        if (typeof img === 'string') {
          addImage(img);
        } else if (img.src || img.url || img.original) {
          addImage(img.src || img.url || img.original);
        }
      });
    }
  }

  // 2. Extract from JSON-LD structured data
  const jsonLdImages = extractJSONLDImages();
  jsonLdImages.forEach(img => addImage(img));

  // 3. Extract from all img elements (including lazy-loaded)
  // But exclude images from related/recommended product sections
  const imgElements = document.querySelectorAll('img');
  imgElements.forEach(img => {
    // Skip images from related/recommended product sections
    if (isInRelatedOrRecommendedSection(img)) {
      return;
    }

    // Check multiple source attributes
    const sources = [
      img.src,
      img.dataset.src,
      img.dataset.lazySrc,
      img.dataset.originalSrc,
      img.dataset.productImage,
      img.currentSrc, // For srcset
      img.getAttribute('data-original'),
      img.getAttribute('data-lazy'),
    ].filter(Boolean) as string[];

    // Extract from srcset
    if (img.srcset) {
      const srcsetUrls = parseSrcset(img.srcset);
      sources.push(...srcsetUrls);
    }

    sources.forEach(src => {
      addImage(src, {
        width: img.naturalWidth || img.width,
        height: img.naturalHeight || img.height,
        alt: img.alt,
      });
    });
  });

  // 4. Extract from Shopify-specific selectors (main product images only)
  // Focus on main product gallery/thumbnails, exclude related/recommended sections
  const shopifySelectors = [
    '.product__media img',
    '.product-image img',
    '.product-gallery img',
    '.product-photos img',
    '.product__media-wrapper img',
    '.product-single__media img',
    '[data-product-image] img',
    '[data-product-single-media-group] img',
    '.product-images img',
    '.product-media img',
    '.product-thumbnails img',
    '.thumbnail img',
    // Carousel/slider selectors for main product galleries
    // These are checked against isInRelatedOrRecommendedSection to ensure they're main product carousels
    '.flickity-slider img',
    '.swiper-slide img',
    '.carousel img',
  ];

  shopifySelectors.forEach(selector => {
    document.querySelectorAll(selector).forEach((img: Element) => {
      // Skip if in related/recommended section
      if (isInRelatedOrRecommendedSection(img)) {
        return;
      }

      if (img instanceof HTMLImageElement) {
        const sources = [
          img.src,
          img.dataset.src,
          img.dataset.lazySrc,
          img.currentSrc,
        ].filter(Boolean) as string[];
        
        sources.forEach(src => {
          addImage(src, {
            width: img.naturalWidth || img.width,
            height: img.naturalHeight || img.height,
            alt: img.alt,
          });
        });
      }
    });
  });

  // 5. Extract background images from CSS
  const bgImageElements = document.querySelectorAll('[style*="background-image"], [class*="product"], [class*="gallery"]');
  bgImageElements.forEach(el => {
    const style = window.getComputedStyle(el);
    const bgImage = style.backgroundImage;
    if (bgImage && bgImage !== 'none') {
      const urlMatch = bgImage.match(/url\(['"]?([^'"]+)['"]?\)/);
      if (urlMatch && urlMatch[1]) {
        addImage(urlMatch[1], {
          width: el instanceof HTMLElement ? el.offsetWidth : 0,
          height: el instanceof HTMLElement ? el.offsetHeight : 0,
        });
      }
    }

    // Also check data attributes for background images
    ['data-bg', 'data-background', 'data-src', 'data-image'].forEach(attr => {
      const bgUrl = el.getAttribute(attr);
      if (bgUrl) {
        addImage(bgUrl);
      }
    });
  });

  // 6. Extract from picture elements and source tags
  document.querySelectorAll('picture source').forEach(source => {
    if (source instanceof HTMLSourceElement) {
      if (source.srcset) {
        const srcsetUrls = parseSrcset(source.srcset);
        srcsetUrls.forEach(url => addImage(url));
      }
      if (source.src) {
        addImage(source.src);
      }
    }
  });

  // 7. Extract from link tags with rel="image_src" or product image relationships
  document.querySelectorAll('link[rel*="image"], link[rel*="product"]').forEach(link => {
    const href = link.getAttribute('href');
    if (href) {
      addImage(href);
    }
  });

  // 8. Extract from meta tags
  document.querySelectorAll('meta[property*="image"], meta[name*="image"]').forEach(meta => {
    const content = meta.getAttribute('content');
    if (content) {
      addImage(content);
    }
  });

  // 9. Look for images in data attributes of containers
  document.querySelectorAll('[data-images], [data-product-images], [data-gallery]').forEach(el => {
    const imagesAttr = el.getAttribute('data-images') || 
                      el.getAttribute('data-product-images') || 
                      el.getAttribute('data-gallery');
    if (imagesAttr) {
      try {
        const parsed = JSON.parse(imagesAttr);
        if (Array.isArray(parsed)) {
          parsed.forEach((img: any) => {
            if (typeof img === 'string') {
              addImage(img);
            } else if (img.src || img.url) {
              addImage(img.src || img.url);
            }
          });
        }
      } catch (e) {
        // Not JSON, treat as comma-separated
        imagesAttr.split(',').forEach(url => addImage(url.trim()));
      }
    }
  });

  // Debug: Log detected images
  
  return images;
}

/**
 * Clean and normalize image URL
 */
function cleanImageUrl(url: string): string | null {
  if (!url || typeof url !== 'string') return null;
  
  try {
    // Remove query parameters that resize images (keep quality if present)
    const urlObj = new URL(url, window.location.href);
    
    // Keep only important query params
    const keepParams = ['quality', 'format'];
    const params = new URLSearchParams();
    
    for (const [key, value] of urlObj.searchParams.entries()) {
      if (keepParams.includes(key.toLowerCase())) {
        params.set(key, value);
      }
    }
    
    urlObj.search = params.toString();
    
    // Convert to absolute URL
    return urlObj.href;
  } catch {
    return url;
  }
}

/**
 * Parse srcset attribute to extract URLs
 */
function parseSrcset(srcset: string): string[] {
  const urls: string[] = [];
  const entries = srcset.split(',');
  
  entries.forEach(entry => {
    const parts = entry.trim().split(/\s+/);
    if (parts[0]) {
      urls.push(parts[0]);
    }
  });

  return urls;
}

/**
 * Extract images from Shopify product JSON in script tags
 */
function extractShopifyProductJSON(): any {
  try {
    // Shopify often includes product data in script tags
    const scripts = document.querySelectorAll('script[type="application/json"]');
    for (const script of scripts) {
      try {
        const data = JSON.parse(script.textContent || '{}');
        if (data.product && data.product.images) {
          return data.product;
        }
        if (data.product?.media) {
          return data.product;
        }
      } catch (e) {
        // Continue to next script
      }
    }

    // Check for Shopify.product or window.product
    if (typeof (window as any).Shopify !== 'undefined' && (window as any).Shopify.product) {
      return (window as any).Shopify.product;
    }
    if ((window as any).product) {
      return (window as any).product;
    }
  } catch (e) {
    // Error extracting Shopify product JSON
  }
  
  return null;
}

/**
 * Extract images from JSON-LD structured data
 */
function extractJSONLDImages(): string[] {
  const images: string[] = [];
  
  try {
    const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
    jsonLdScripts.forEach(script => {
      try {
        const data = JSON.parse(script.textContent || '{}');
        
        // Handle different JSON-LD structures
        if (data['@type'] === 'Product') {
          if (data.image) {
            if (Array.isArray(data.image)) {
              images.push(...data.image.filter((img: any) => typeof img === 'string'));
            } else if (typeof data.image === 'string') {
              images.push(data.image);
            } else if (data.image.url) {
              images.push(data.image.url);
            }
          }
          
          // Check for offers with images
          if (data.offers && Array.isArray(data.offers)) {
            data.offers.forEach((offer: any) => {
              if (offer.image) images.push(offer.image);
            });
          }
        }
        
        // Handle GraphQL responses
        if (data.product && data.product.images) {
          const productImages = data.product.images;
          if (Array.isArray(productImages)) {
            productImages.forEach((img: any) => {
              if (typeof img === 'string') {
                images.push(img);
              } else if (img.url || img.src || img.originalSrc) {
                images.push(img.url || img.src || img.originalSrc);
              }
            });
          }
        }
      } catch (e) {
        // Continue to next script
      }
    });
  } catch (e) {
    // Error extracting JSON-LD images
  }

  return images;
}

/**
 * Validate if an image URL is likely a product image
 */
function isValidProductImageUrl(url: string, metadata?: { width?: number; height?: number; alt?: string }): boolean {
  if (!url) return false;
  
  const lowerUrl = url.toLowerCase();
  const lowerAlt = (metadata?.alt || '').toLowerCase();
  
  // Filter out common non-product image patterns
  const excludePatterns = [
    'logo',
    'icon',
    'badge',
    'payment',
    'trust',
    'review',
    'star',
    'avatar',
    'user',
    'profile',
    'social',
    'facebook',
    'twitter',
    'instagram',
    'pinterest',
    'google',
    'analytics',
    'tracking',
    'pixel',
    'spacer',
    'blank',
    'placeholder',
    '1x1',
    'pixel.gif',
    'transparent',
    '.svg', // Exclude SVG for product images (usually icons/logos)
    'unsplash', // Exclude Unsplash demo images
    'demo', // Exclude demo images
    'demo_pics', // Exclude demo pictures
    'demo-pics', // Exclude demo pictures
    'assets/demo', // Exclude demo assets
  ];

  for (const pattern of excludePatterns) {
    if (lowerUrl.includes(pattern) || lowerAlt.includes(pattern)) {
      return false;
    }
  }

  // Must be a valid URL
  try {
    new URL(url, window.location.href);
  } catch {
    return false;
  }

  // Accept common image formats
  const validExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif'];
  const hasValidExtension = validExtensions.some(ext => lowerUrl.includes(ext));
  
  // Require valid image file extension
  if (!hasValidExtension) {
    return false;
  }
  
  // Check size if metadata available
  if (metadata) {
    const { width, height } = metadata;
    // Skip very small images (likely icons) - be more lenient for better detection
    if (width && height && width < 50 && height < 50) {
      return false;
    }
  }

  return true;
}

/**
 * Check if an image element is inside a related/recommended product section
 */
function isInRelatedOrRecommendedSection(img: Element): boolean {
  let parent: Element | null = img.parentElement;
  let depth = 0;
  const maxDepth = 10; // Limit search depth

  while (parent && depth < maxDepth) {
    const className = parent.className?.toLowerCase() || '';
    const id = parent.id?.toLowerCase() || '';
    const tagName = parent.tagName?.toLowerCase() || '';
    
    // Check for related/recommended product section patterns
    const relatedPatterns = [
      'related',
      'recommended',
      'you-may-also-like',
      'you-may-like',
      'similar',
      'also-bought',
      'frequently-bought',
      'complementary',
      'upsell',
      'cross-sell',
      'product-recommendations',
      'product-suggestions',
      'recently-viewed',
      'trending',
      'featured-collection',
      'collection-grid',
      'product-grid',
      'product-list',
      'product-carousel',
      'product-slider',
    ];

    // Check class names and IDs
    for (const pattern of relatedPatterns) {
      if (className.includes(pattern) || id.includes(pattern)) {
        // But allow if it's the main product section
        if (!isMainProductSection(parent)) {
          return true;
        }
      }
    }

    // Check for specific Shopify sections
    if (parent.hasAttribute('data-section-type')) {
      const sectionType = parent.getAttribute('data-section-type')?.toLowerCase() || '';
      if (sectionType.includes('related') || 
          sectionType.includes('recommendation') ||
          sectionType.includes('complementary')) {
        return true;
      }
    }

    parent = parent.parentElement;
    depth++;
  }

  return false;
}

/**
 * Check if an element is in the main product section (not related/recommended)
 */
function isMainProductSection(element: Element): boolean {
  const className = element.className?.toLowerCase() || '';
  const id = element.id?.toLowerCase() || '';
  
  const mainProductPatterns = [
    'product-single',
    'product-main',
    'product-detail',
    'product-form',
    'product-gallery',
    'product-media',
    'product-photos',
    'main-product',
    'product__media',
    'product-image',
    'product-images',
    'product-thumbnails',
  ];

  for (const pattern of mainProductPatterns) {
    if (className.includes(pattern) || id.includes(pattern)) {
      return true;
    }
  }

  // Check if carousel/slider is within a main product container
  // Look up the DOM tree to find main product indicators
  let current: Element | null = element;
  let depth = 0;
  const maxDepth = 5; // Limit search depth for performance

  while (current && depth < maxDepth) {
    const currentClassName = current.className?.toLowerCase() || '';
    const currentId = current.id?.toLowerCase() || '';
    
    // If we find a main product pattern in parent, this is a main product carousel
    for (const pattern of mainProductPatterns) {
      if (currentClassName.includes(pattern) || currentId.includes(pattern)) {
        return true;
      }
    }
    
    // Check for data attributes that indicate main product
    if (current.hasAttribute('data-product-image') || 
        current.hasAttribute('data-product-single-media-group')) {
      return true;
    }

    current = current.parentElement;
    depth++;
  }

  return false;
}
