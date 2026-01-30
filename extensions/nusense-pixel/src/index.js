// NUSENSE Web Pixel Extension
// Handles all tracking events (standard Shopify events + custom try-on events)

import {register} from '@shopify/web-pixels-extension';

// Helper to generate UUID v4
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Helper to get or create session ID
async function getSessionId(browser) {
  try {
    let sessionId = await browser.cookie.get('nulight_session_id');
    if (!sessionId) {
      sessionId = generateUUID();
      await browser.cookie.set('nulight_session_id', sessionId);
    }
    return sessionId;
  } catch (error) {
    // Fallback to generating a new session ID if cookie access fails
    return generateUUID();
  }
}

// Helper function to send events to backend
async function sendToBackend(eventName, eventData, customData = {}, browser, init, customerPrivacyStatus, sessionId) {
  try {
    const payload = {
      event_type: eventName,
      event_id: eventData.id || generateUUID(),
      timestamp: eventData.timestamp || new Date().toISOString(),
      session_id: sessionId,
      shopify_client_id: eventData.clientId || null,
      customer_id: init.data.customer?.id || null,
      shopify_customer_id: init.data.customer?.id || null,
      seq: eventData.seq || null,
      client: {
        user_agent: eventData.context?.navigator?.userAgent || null,
        language: eventData.context?.navigator?.language || null,
        screen_width: eventData.context?.window?.screen?.width || null,
        screen_height: eventData.context?.window?.screen?.height || null,
        viewport_width: eventData.context?.window?.innerWidth || null,
        viewport_height: eventData.context?.window?.innerHeight || null
      },
      document: {
        location: eventData.context?.document?.location?.href || null,
        referrer: eventData.context?.document?.referrer || null,
        title: eventData.context?.document?.title || null
      },
      ...customData,
      privacy_consent: {
        analytics_allowed: customerPrivacyStatus?.analyticsProcessingAllowed || false,
        marketing_allowed: customerPrivacyStatus?.marketingAllowed || false,
        preferences_allowed: customerPrivacyStatus?.preferencesProcessingAllowed || false,
        sale_of_data_allowed: customerPrivacyStatus?.saleOfDataAllowed || false
      }
    };

    await fetch('https://ai.nusense.ddns.net/api/tracking/pixel', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(payload),
      keepalive: true
    });
  } catch (error) {
    // Silent fail - tracking is optional and shouldn't break user experience
  }
}

register(async ({analytics, browser, init, customerPrivacy}) => {
  // Get or create session ID
  const sessionId = await getSessionId(browser);
  
  // Get initial customer privacy status from init.customerPrivacy
  // According to Shopify docs: init.customerPrivacy contains the initial consent state
  let customerPrivacyStatus = init.customerPrivacy || {};
  
  // Subscribe to privacy consent changes (for dynamic updates when user changes consent)
  // According to Shopify docs: event.customerPrivacy contains the updated consent state
  if (customerPrivacy && customerPrivacy.subscribe) {
    customerPrivacy.subscribe('visitorConsentCollected', (event) => {
      // Update privacy status when consent changes
      // event.customerPrivacy contains: analyticsProcessingAllowed, marketingAllowed, etc.
      customerPrivacyStatus = event.customerPrivacy || {};
    });
  }

  // ============================================
  // Standard Shopify Events
  // ============================================
  
  analytics.subscribe('product_added_to_cart', (event) => {
    // According to Shopify docs, product_added_to_cart has event.data.cartLine
    const cartLine = event.data?.cartLine;
    sendToBackend('product_added_to_cart', event, {
      product: {
        id: cartLine?.merchandise?.product?.id || null,
        title: cartLine?.merchandise?.product?.title || null,
        price: cartLine?.cost?.totalAmount?.amount || null,
        quantity: cartLine?.quantity || 1,
        variant: {
          id: cartLine?.merchandise?.id || null,
          price: cartLine?.merchandise?.price?.amount || null,
          title: cartLine?.merchandise?.title || null
        }
      }
    }, browser, init, customerPrivacyStatus, sessionId);
  });

  analytics.subscribe('product_viewed', (event) => {
    sendToBackend('product_viewed', event, {
      product: event.data?.product || {}
    }, browser, init, customerPrivacyStatus, sessionId);
  });

  analytics.subscribe('page_viewed', (event) => {
    sendToBackend('page_viewed', event, {}, browser, init, customerPrivacyStatus, sessionId);
  });

  analytics.subscribe('checkout_completed', (event) => {
    sendToBackend('checkout_completed', event, {
      checkout: event.data?.checkout || {
        order_id: event.data?.order?.id,
        total_price: event.data?.order?.totalPrice?.amount,
        currency_code: event.data?.order?.currencyCode,
        line_items: event.data?.order?.lineItems || []
      }
    }, browser, init, customerPrivacyStatus, sessionId);
  });

  // ============================================
  // Custom Try-On Events (Published from Widget)
  // ============================================
  
  analytics.subscribe('tryon:widget_opened', (event) => {
    // Custom events: data is passed in event.customData directly
    sendToBackend('tryon_widget_opened', event, {
      tryon: event.customData?.tryon || {}
    }, browser, init, customerPrivacyStatus, sessionId);
  });

  analytics.subscribe('tryon:widget_closed', (event) => {
    sendToBackend('tryon_widget_closed', event, {
      tryon: event.customData?.tryon || {}
    }, browser, init, customerPrivacyStatus, sessionId);
  });

  analytics.subscribe('tryon:photo_uploaded', (event) => {
    sendToBackend('tryon_photo_uploaded', event, {
      tryon: event.customData?.tryon || {
        product_id: event.customData?.productId,
        product_title: event.customData?.productTitle
      }
    }, browser, init, customerPrivacyStatus, sessionId);
  });

  analytics.subscribe('tryon:garment_selected', (event) => {
    sendToBackend('tryon_garment_selected', event, {
      product: event.customData?.product || {
        id: event.customData?.productId,
        title: event.customData?.productTitle,
        image_url: event.customData?.productImageUrl
      }
    }, browser, init, customerPrivacyStatus, sessionId);
  });

  analytics.subscribe('tryon:started', (event) => {
    sendToBackend('tryon_started', event, {
      product: event.customData?.product || {
        id: event.customData?.productId,
        title: event.customData?.productTitle
      }
    }, browser, init, customerPrivacyStatus, sessionId);
  });

  analytics.subscribe('tryon:completed', (event) => {
    sendToBackend('tryon_completed', event, {
      tryon: event.customData?.tryon || {
        tryon_id: event.customData?.tryonId,
        product_id: event.customData?.productId,
        product_title: event.customData?.productTitle,
        processing_time_ms: event.customData?.processingTimeMs
      }
    }, browser, init, customerPrivacyStatus, sessionId);
  });

  analytics.subscribe('tryon:result_viewed', (event) => {
    sendToBackend('tryon_result_viewed', event, {
      tryon: event.customData?.tryon || {
        tryon_id: event.customData?.tryonId
      }
    }, browser, init, customerPrivacyStatus, sessionId);
  });

  analytics.subscribe('tryon:result_shared', (event) => {
    sendToBackend('tryon_result_shared', event, {
      tryon: event.customData?.tryon || {
        tryon_id: event.customData?.tryonId,
        share_platform: event.customData?.platform
      }
    }, browser, init, customerPrivacyStatus, sessionId);
  });

  analytics.subscribe('tryon:result_downloaded', (event) => {
    sendToBackend('tryon_result_downloaded', event, {
      tryon: event.customData?.tryon || {
        tryon_id: event.customData?.tryonId
      }
    }, browser, init, customerPrivacyStatus, sessionId);
  });

  analytics.subscribe('tryon:feedback_submitted', (event) => {
    sendToBackend('tryon_feedback_submitted', event, {
      tryon: event.customData?.tryon || {
        tryon_id: event.customData?.tryonId,
        feedback_liked: event.customData?.liked,
        feedback_text: event.customData?.text
      }
    }, browser, init, customerPrivacyStatus, sessionId);
  });
});

