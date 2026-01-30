/**
 * Safe Tracking Wrapper Utility
 * 
 * Provides safe wrappers for Shopify Web Pixels API calls.
 * All tracking calls use Shopify.analytics.publish() to publish custom events.
 * Events are then handled by the Web Pixel Extension which sends them to the backend.
 * 
 * Uses PostMessage API to communicate with parent storefront when running in iframe.
 */

// Helper to check if Shopify.analytics is available
function isShopifyAnalyticsAvailable(): boolean {
  try {
    return typeof window !== 'undefined' && 
           window.Shopify?.analytics?.publish !== undefined;
  } catch {
    return false;
  }
}

// Helper to publish event safely
function safePublish(eventName: string, data: Record<string, any> = {}): void {
  try {
    if (isShopifyAnalyticsAvailable()) {
      window.Shopify.analytics.publish(eventName, data);
    }
  } catch (error) {
    // Silently fail - tracking is optional
  }
}

/**
 * Send tracking event to parent via PostMessage (for iframe communication)
 * This is used when the widget is in an iframe and needs to communicate with parent
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
      // Not in iframe - publish directly
      const eventName = `tryon:${eventType}`;
      safePublish(eventName, eventData || {});
    }
  } catch (error) {
    // Silently fail - tracking is optional
  }
};

// =============================
// Widget Events
// =============================

export const safeTrackWidgetOpen = (): void => {
  sendTrackingToParent('widget_opened');
  safePublish('tryon:widget_opened', {});
};

export const safeTrackWidgetClose = (): void => {
  sendTrackingToParent('widget_closed');
  safePublish('tryon:widget_closed', {});
};

// =============================
// Try-On Events
// =============================

export const safeTrackPhotoUpload = (options?: { productId?: string; productTitle?: string }): void => {
  sendTrackingToParent('photo_uploaded', options);
  safePublish('tryon:photo_uploaded', {
    tryon: {
      product_id: options?.productId,
      product_title: options?.productTitle
    }
  });
};

export const safeTrackGarmentSelect = (productId: string, productTitle: string, productImageUrl: string): void => {
  sendTrackingToParent('garment_selected', { productId, productTitle, productImageUrl });
  safePublish('tryon:garment_selected', {
    product: {
      id: productId,
      title: productTitle,
      image_url: productImageUrl
    }
  });
};

export const safeTrackTryonStart = (productId: string, productTitle: string): void => {
  sendTrackingToParent('tryon_started', { productId, productTitle });
  safePublish('tryon:started', {
    product: {
      id: productId,
      title: productTitle
    }
  });
};

export const safeTrackTryonComplete = (
  tryonId: number,
  productId: string,
  productTitle: string,
  processingTimeMs: number
): void => {
  sendTrackingToParent('tryon_completed', { tryonId, productId, productTitle, processingTimeMs });
  safePublish('tryon:completed', {
    tryon: {
      tryon_id: tryonId,
      product_id: productId,
      product_title: productTitle,
      processing_time_ms: processingTimeMs
    }
  });
};

// =============================
// Engagement Events
// =============================

export const safeTrackResultView = (tryonId: number): void => {
  sendTrackingToParent('result_viewed', { tryonId });
  safePublish('tryon:result_viewed', {
    tryon: {
      tryon_id: tryonId
    }
  });
};

export const safeTrackShare = (tryonId: number, platform: string): void => {
  sendTrackingToParent('result_shared', { tryonId, platform });
  safePublish('tryon:result_shared', {
    tryon: {
      tryon_id: tryonId,
      share_platform: platform
    }
  });
};

export const safeTrackDownload = (tryonId: number): void => {
  sendTrackingToParent('result_downloaded', { tryonId });
  safePublish('tryon:result_downloaded', {
    tryon: {
      tryon_id: tryonId
    }
  });
};

export const safeTrackFeedback = (tryonId: number, liked: boolean, text?: string): void => {
  sendTrackingToParent('feedback_submitted', { tryonId, liked, text });
  safePublish('tryon:feedback_submitted', {
    tryon: {
      tryon_id: tryonId,
      feedback_liked: liked,
      feedback_text: text
    }
  });
};

// =============================
// Shopify Standard Events
// =============================

/**
 * Track product view
 * Note: Shopify automatically tracks product_viewed events, but we can also publish custom ones if needed
 */
export const safeTrackProductView = (product: any): void => {
  sendTrackingToParent('product_viewed', { product });
  // Shopify automatically tracks product_viewed, but we can publish additional data if needed
  safePublish('product_viewed', {
    product: product || {}
  });
};

/**
 * Track add to cart via Pixel (analytics/attribution)
 * Note: Shopify automatically tracks product_added_to_cart events, but we can also publish custom ones if needed
 * This is used alongside Cart Tracking API for business logic
 * - Pixel tracking: Works without customer login, includes session/client info
 * - Cart Tracking API: Requires customer login, used for business logic
 * 
 * IMPORTANT: When in iframe, only sends to parent - parent bridge handles all tracking to prevent duplicates.
 * When not in iframe, publishes directly.
 */
export const safeTrackAddToCart = (product: any): void => {
  const isInIframe = window.parent !== window;
  if (isInIframe) {
    // In iframe: Only send to parent, parent will handle all tracking (Pixel + Cart API)
    // This prevents double-tracking from widget domain
    sendTrackingToParent('add_to_cart', { product });
  } else {
    // Not in iframe: Publish directly (standalone mode)
    safePublish('product_added_to_cart', {
      product: product || {}
    });
  }
};

// =============================
// Session Management
// =============================

/**
 * Get session ID from browser storage
 * Used by other parts of the app that need session ID (e.g., tryonApi.ts)
 */
export const getSessionId = (): string => {
  try {
    if (typeof window === 'undefined') return '';
    
    // Try to get from localStorage first
    let sessionId = localStorage.getItem('nulight_session_id');
    
    if (!sessionId) {
      // Generate new UUID v4
      sessionId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
      localStorage.setItem('nulight_session_id', sessionId);
    }
    
    return sessionId;
  } catch (error) {
    // Fallback to generating a new ID
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
};
