// Authored by Karthik Ramesh 2026
// Attribution: NUSENSE AI

/**
 * NULIGHT Tracking SDK
 *
 * Lightweight tracking library for NULIGHT Try-On widget.
 * Sends events to the NULIGHT tracking API for analytics and attribution.
 *
 * Usage:
 *   // Initialize (API key is optional)
 *   NulightTracking.init({
 *     apiKey: 'your-vendor-api-key',  // optional
 *     apiUrl: 'https://ai.nusense.ddns.net/api'  // optional, defaults to ai.nusense.ddns.net/api
 *   });
 *
 *   // Track events
 *   NulightTracking.trackWidgetOpen();
 *   NulightTracking.trackTryonComplete(tryonId, productId, productTitle);
 *   NulightTracking.trackResultView(tryonId);
 *   NulightTracking.trackShare(tryonId, 'facebook');
 */

(function(window) {
  'use strict';

  // Default configuration
  const DEFAULT_CONFIG = {
    apiUrl: 'https://ai.nusense.ddns.net/api',
    apiKey: null,
    sessionId: null,
    customerId: null,
    shopifyCustomerId: null,
    debug: false,
    batchEvents: false,
    batchInterval: 5000,  // 5 seconds
    maxBatchSize: 10
  };

  // Event queue for batching
  let eventQueue = [];
  let batchTimer = null;

  // Configuration
  let config = { ...DEFAULT_CONFIG };

  /**
   * Generate a UUID v4
   */
  function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  /**
   * Get or create session ID from localStorage
   */
  function getSessionId() {
    if (config.sessionId) {
      return config.sessionId;
    }

    const storageKey = 'nulight_session_id';
    let sessionId = null;
    
    try {
      sessionId = localStorage.getItem(storageKey);
    } catch (error) {
      // localStorage may not be available (private browsing, etc.)
    }

    if (!sessionId) {
      sessionId = generateUUID();
      try {
        localStorage.setItem(storageKey, sessionId);
      } catch (error) {
        // localStorage may not be available - continue without persistence
      }
    }

    return sessionId;
  }

  /**
   * Get client info
   */
  function getClientInfo() {
    return {
      user_agent: navigator.userAgent,
      language: navigator.language,
      screen_width: screen.width,
      screen_height: screen.height,
      viewport_width: window.innerWidth,
      viewport_height: window.innerHeight
    };
  }

  /**
   * Get document info
   */
  function getDocumentInfo() {
    return {
      location: window.location.href,
      referrer: document.referrer,
      title: document.title
    };
  }

  /**
   * Log debug message
   */
  function debug(message, data) {
    if (config.debug) {
      console.log('[NulightTracking]', message, data || '');
    }
  }

  /**
   * Send event to API
   */
  async function sendEvent(event) {
    const payload = {
      event_type: event.type,
      event_id: generateUUID(),
      timestamp: new Date().toISOString(),
      session_id: getSessionId(),
      customer_id: config.customerId,
      shopify_customer_id: config.shopifyCustomerId,
      client: getClientInfo(),
      document: getDocumentInfo(),
      ...event.data
    };

    debug('Sending event:', payload);

    try {
      const headers = {
        'Content-Type': 'application/json'
      };
      
      // Add API key header only if provided (optional)
      if (config.apiKey) {
        headers['X-Vendor-Key'] = config.apiKey;
      }

      const response = await fetch(`${config.apiUrl}/tracking/pixel`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      debug('Event sent successfully:', result);
      return result;

    } catch (error) {
      console.error('[NulightTracking] Error sending event:', error);
      return null;
    }
  }

  /**
   * Send batch of events
   */
  async function sendBatch() {
    if (eventQueue.length === 0) return;

    const events = eventQueue.splice(0, config.maxBatchSize);

    const payload = {
      events: events.map(event => ({
        event_type: event.type,
        event_id: generateUUID(),
        timestamp: event.timestamp || new Date().toISOString(),
        session_id: getSessionId(),
        customer_id: config.customerId,
        shopify_customer_id: config.shopifyCustomerId,
        client: getClientInfo(),
        document: getDocumentInfo(),
        ...event.data
      }))
    };

    debug('Sending batch:', payload);

    try {
      const headers = {
        'Content-Type': 'application/json'
      };
      
      // Add API key header only if provided (optional)
      if (config.apiKey) {
        headers['X-Vendor-Key'] = config.apiKey;
      }

      const response = await fetch(`${config.apiUrl}/tracking/pixel/batch`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      debug('Batch sent successfully:', result);
      return result;

    } catch (error) {
      console.error('[NulightTracking] Error sending batch:', error);
      // Re-queue failed events
      eventQueue.unshift(...events);
      return null;
    }
  }

  /**
   * Queue event for batch sending
   */
  function queueEvent(event) {
    event.timestamp = new Date().toISOString();
    eventQueue.push(event);

    if (eventQueue.length >= config.maxBatchSize) {
      sendBatch();
    }
  }

  /**
   * Track an event (either immediately or batched)
   */
  function trackEvent(type, data = {}) {
    const event = { type, data };

    if (config.batchEvents) {
      queueEvent(event);
    } else {
      sendEvent(event);
    }
  }

  // Public API
  const NulightTracking = {
    /**
     * Initialize the tracking SDK
     * @param {Object} options Configuration options
     */
    init: function(options = {}) {
      config = { ...DEFAULT_CONFIG, ...options };

      debug('Initialized with config:', config);

      // Start batch timer if batching enabled
      if (config.batchEvents && !batchTimer) {
        batchTimer = setInterval(sendBatch, config.batchInterval);
      }

      // Send any queued events before page unload
      window.addEventListener('beforeunload', () => {
        if (eventQueue.length > 0) {
          sendBatch();
        }
      });

      return this;
    },

    /**
     * Set customer ID after identification
     * @param {number} customerId NULIGHT customer ID
     */
    setCustomerId: function(customerId) {
      config.customerId = customerId;
      return this;
    },

    /**
     * Set Shopify customer ID after login
     * @param {string} shopifyCustomerId Shopify customer ID
     */
    setShopifyCustomerId: function(shopifyCustomerId) {
      config.shopifyCustomerId = shopifyCustomerId;
      return this;
    },

    /**
     * Get current session ID
     * @returns {string} Session ID
     */
    getSessionId: function() {
      return getSessionId();
    },

    // =============================
    // Widget Events
    // =============================

    /**
     * Track widget opened
     */
    trackWidgetOpen: function() {
      trackEvent('tryon_widget_opened');
      return this;
    },

    /**
     * Track widget closed
     */
    trackWidgetClose: function() {
      trackEvent('tryon_widget_closed');
      return this;
    },

    // =============================
    // Try-On Events
    // =============================

    /**
     * Track photo uploaded
     * @param {Object} options Photo details
     */
    trackPhotoUpload: function(options = {}) {
      trackEvent('tryon_photo_uploaded', {
        tryon: {
          product_id: options.productId,
          product_title: options.productTitle
        }
      });
      return this;
    },

    /**
     * Track garment selected
     * @param {string} productId Shopify product ID
     * @param {string} productTitle Product title
     * @param {string} productImageUrl Product image URL
     */
    trackGarmentSelect: function(productId, productTitle, productImageUrl) {
      trackEvent('tryon_garment_selected', {
        product: {
          id: productId,
          title: productTitle,
          image_url: productImageUrl
        }
      });
      return this;
    },

    /**
     * Track try-on started
     * @param {string} productId Shopify product ID
     * @param {string} productTitle Product title
     */
    trackTryonStart: function(productId, productTitle) {
      trackEvent('tryon_started', {
        product: {
          id: productId,
          title: productTitle
        }
      });
      return this;
    },

    /**
     * Track try-on completed
     * @param {number} tryonId NULIGHT try-on result ID
     * @param {string} productId Shopify product ID
     * @param {string} productTitle Product title
     * @param {number} processingTimeMs Processing time in milliseconds
     */
    trackTryonComplete: function(tryonId, productId, productTitle, processingTimeMs) {
      trackEvent('tryon_completed', {
        tryon: {
          tryon_id: tryonId,
          product_id: productId,
          product_title: productTitle,
          processing_time_ms: processingTimeMs
        }
      });
      return this;
    },

    // =============================
    // Engagement Events
    // =============================

    /**
     * Track result viewed
     * @param {number} tryonId NULIGHT try-on result ID
     */
    trackResultView: function(tryonId) {
      trackEvent('tryon_result_viewed', {
        tryon: {
          tryon_id: tryonId
        }
      });
      return this;
    },

    /**
     * Track result shared
     * @param {number} tryonId NULIGHT try-on result ID
     * @param {string} platform Share platform (facebook, twitter, copy_link, etc.)
     */
    trackShare: function(tryonId, platform) {
      trackEvent('tryon_result_shared', {
        tryon: {
          tryon_id: tryonId,
          share_platform: platform
        }
      });
      return this;
    },

    /**
     * Track result downloaded
     * @param {number} tryonId NULIGHT try-on result ID
     */
    trackDownload: function(tryonId) {
      trackEvent('tryon_result_downloaded', {
        tryon: {
          tryon_id: tryonId
        }
      });
      return this;
    },

    /**
     * Track feedback submitted
     * @param {number} tryonId NULIGHT try-on result ID
     * @param {boolean} liked Whether the user liked the result
     * @param {string} text Optional feedback text
     */
    trackFeedback: function(tryonId, liked, text) {
      trackEvent('tryon_feedback_submitted', {
        tryon: {
          tryon_id: tryonId,
          feedback_liked: liked,
          feedback_text: text
        }
      });
      return this;
    },

    // =============================
    // Shopify Standard Events
    // =============================

    /**
     * Track page viewed
     */
    trackPageView: function() {
      trackEvent('page_viewed');
      return this;
    },

    /**
     * Track product viewed
     * @param {Object} product Product details
     */
    trackProductView: function(product) {
      trackEvent('product_viewed', {
        product: {
          id: product.id,
          title: product.title,
          vendor: product.vendor,
          type: product.type,
          url: product.url,
          image_url: product.image_url,
          price: product.price,
          variant: product.variant
        }
      });
      return this;
    },

    /**
     * Track product added to cart
     * @param {Object} product Product details
     */
    trackAddToCart: function(product) {
      trackEvent('product_added_to_cart', {
        product: {
          id: product.id,
          title: product.title,
          price: product.price,
          quantity: product.quantity || 1,
          variant: product.variant
        }
      });
      return this;
    },

    /**
     * Track checkout completed
     * @param {Object} checkout Checkout details
     */
    trackCheckoutComplete: function(checkout) {
      trackEvent('checkout_completed', {
        checkout: {
          order_id: checkout.orderId,
          total_price: checkout.totalPrice,
          currency_code: checkout.currencyCode,
          line_items: checkout.lineItems
        }
      });
      return this;
    },

    // =============================
    // Utility Methods
    // =============================

    /**
     * Track a custom event
     * @param {string} eventType Event type
     * @param {Object} data Event data
     */
    trackCustom: function(eventType, data = {}) {
      trackEvent(eventType, { extra_data: data });
      return this;
    },

    /**
     * Flush any queued events immediately
     */
    flush: function() {
      if (eventQueue.length > 0) {
        sendBatch();
      }
      return this;
    },

    /**
     * Enable/disable debug mode
     * @param {boolean} enabled
     */
    setDebug: function(enabled) {
      config.debug = enabled;
      return this;
    }
  };

  // Expose to global scope
  window.NulightTracking = NulightTracking;

})(window);

