/**
 * Safe Tracking Wrapper Utility
 * 
 * Provides safe wrappers for NULIGHT Tracking SDK calls.
 * All tracking calls are wrapped in try-catch to prevent errors from breaking functionality.
 * Uses PostMessage API to communicate with parent storefront when running in iframe.
 */

// Type definitions for tracking SDK
interface NulightTracking {
  init: (config?: { apiKey?: string | null; apiUrl?: string; debug?: boolean }) => NulightTracking;
  setCustomerId: (customerId: number) => NulightTracking;
  setShopifyCustomerId: (shopifyCustomerId: string) => NulightTracking;
  getSessionId: () => string;
  trackWidgetOpen: () => NulightTracking;
  trackWidgetClose: () => NulightTracking;
  trackPhotoUpload: (options?: { productId?: string; productTitle?: string }) => NulightTracking;
  trackGarmentSelect: (productId: string, productTitle: string, productImageUrl: string) => NulightTracking;
  trackTryonStart: (productId: string, productTitle: string) => NulightTracking;
  trackTryonComplete: (tryonId: number, productId: string, productTitle: string, processingTimeMs: number) => NulightTracking;
  trackResultView: (tryonId: number) => NulightTracking;
  trackShare: (tryonId: number, platform: string) => NulightTracking;
  trackDownload: (tryonId: number) => NulightTracking;
  trackFeedback: (tryonId: number, liked: boolean, text?: string) => NulightTracking;
  trackPageView: () => NulightTracking;
  trackProductView: (product: any) => NulightTracking;
  trackAddToCart: (product: any) => NulightTracking;
  trackCheckoutComplete: (checkout: any) => NulightTracking;
}

declare global {
  interface Window {
    NulightTracking?: NulightTracking;
  }
}

/**
 * Initialize tracking SDK safely
 * @param config Optional configuration (API key is optional - backend doesn't require it)
 */
export const safeInitTracking = (config?: { apiKey?: string | null; apiUrl?: string; debug?: boolean }): void => {
  try {
    if (typeof window === 'undefined') return;
    
    // Wait for SDK to load if not available yet
    if (!window.NulightTracking) {
      // Retry after a short delay
      setTimeout(() => {
        safeInitTracking(config);
      }, 100);
      return;
    }

    if (!window.NULIGHT_TRACKING_INITIALIZED) {
      window.NulightTracking.init({
        apiKey: config?.apiKey || null, // Optional - backend doesn't require API key
        apiUrl: config?.apiUrl || 'https://ai.nusense.ddns.net/api',
        debug: config?.debug || false
      });
      window.NULIGHT_TRACKING_INITIALIZED = true;
    }
  } catch (error) {
    // Silently fail - tracking is optional
    if (config?.debug) {
      console.warn('[Tracking] Failed to initialize:', error);
    }
  }
};

/**
 * Get tracking SDK instance safely
 */
export const getTracking = (): NulightTracking | null => {
  try {
    if (typeof window === 'undefined') return null;
    return window.NulightTracking || null;
  } catch (error) {
    return null;
  }
};

/**
 * Safe wrapper for any tracking call
 */
export const safeTrack = (method: string, ...args: any[]): void => {
  try {
    const tracking = getTracking();
    if (tracking && typeof tracking[method as keyof NulightTracking] === 'function') {
      (tracking[method as keyof NulightTracking] as Function)(...args);
    }
  } catch (error) {
    // Silently fail - tracking is optional
  }
};

/**
 * Send tracking event to parent via PostMessage (for iframe communication)
 */
export const sendTrackingToParent = (eventType: string, eventData?: any): void => {
  try {
    if (window.parent !== window) {
      window.parent.postMessage({
        type: 'NUSENSE_TRACK_EVENT',
        eventType,
        eventData
      }, '*');
    } else {
      // Not in iframe - track directly (fallback)
      const tracking = getTracking();
      if (tracking) {
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
            tracking.trackAddToCart(eventData.product);
            break;
          default:
            // Unknown event type - ignore
            break;
        }
      }
    }
  } catch (error) {
    // Silently fail - tracking is optional
  }
};

// =============================
// Widget Events
// =============================

export const safeTrackWidgetOpen = (): void => {
  sendTrackingToParent('widget_open');
  safeTrack('trackWidgetOpen');
};

export const safeTrackWidgetClose = (): void => {
  sendTrackingToParent('widget_close');
  safeTrack('trackWidgetClose');
};

// =============================
// Try-On Events
// =============================

export const safeTrackPhotoUpload = (options?: { productId?: string; productTitle?: string }): void => {
  sendTrackingToParent('photo_upload', options);
  safeTrack('trackPhotoUpload', options);
};

export const safeTrackGarmentSelect = (productId: string, productTitle: string, productImageUrl: string): void => {
  sendTrackingToParent('garment_select', { productId, productTitle, productImageUrl });
  safeTrack('trackGarmentSelect', productId, productTitle, productImageUrl);
};

export const safeTrackTryonStart = (productId: string, productTitle: string): void => {
  sendTrackingToParent('tryon_start', { productId, productTitle });
  safeTrack('trackTryonStart', productId, productTitle);
};

export const safeTrackTryonComplete = (
  tryonId: number,
  productId: string,
  productTitle: string,
  processingTimeMs: number
): void => {
  sendTrackingToParent('tryon_complete', { tryonId, productId, productTitle, processingTimeMs });
  safeTrack('trackTryonComplete', tryonId, productId, productTitle, processingTimeMs);
};

// =============================
// Engagement Events
// =============================

export const safeTrackResultView = (tryonId: number): void => {
  sendTrackingToParent('result_view', { tryonId });
  safeTrack('trackResultView', tryonId);
};

export const safeTrackShare = (tryonId: number, platform: string): void => {
  sendTrackingToParent('share', { tryonId, platform });
  safeTrack('trackShare', tryonId, platform);
};

export const safeTrackDownload = (tryonId: number): void => {
  sendTrackingToParent('download', { tryonId });
  safeTrack('trackDownload', tryonId);
};

export const safeTrackFeedback = (tryonId: number, liked: boolean, text?: string): void => {
  sendTrackingToParent('feedback', { tryonId, liked, text });
  safeTrack('trackFeedback', tryonId, liked, text);
};

// =============================
// Shopify Standard Events
// =============================

export const safeTrackProductView = (product: any): void => {
  sendTrackingToParent('product_view', { product });
  safeTrack('trackProductView', product);
};

/**
 * Track add to cart via Pixel (analytics/attribution)
 * Note: This is used alongside Cart Tracking API for business logic
 * - Pixel tracking: Works without customer login, includes session/client info
 * - Cart Tracking API: Requires customer login, used for business logic
 */
export const safeTrackAddToCart = (product: any): void => {
  sendTrackingToParent('add_to_cart', { product });
  safeTrack('trackAddToCart', product);
};

