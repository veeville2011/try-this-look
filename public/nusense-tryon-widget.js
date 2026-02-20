/**
 * NUSENSE TryON Widget Loader
 * This script loads and initializes the try-on widget on product pages
 */

(function() {
  'use strict';

  // Prevent duplicate script execution
  if (window.NUSENSE_WIDGET_LOADED) {
    return; // Script already loaded, don't execute again
  }
  window.NUSENSE_WIDGET_LOADED = true;

  // Configuration from window.NUSENSE_CONFIG
  const config = window.NUSENSE_CONFIG || {
    widgetUrl: 'https://try-this-look-jet.vercel.app',
    debug: false,
    autoDetect: true
  };

  // Product data from window.NUSENSE_PRODUCT_DATA
  const productData = window.NUSENSE_PRODUCT_DATA || null;

  // Store original body overflow to restore it properly
  let originalBodyOverflow = null;
  let originalBodyPosition = null;
  let currentResizeHandler = null;
  let isOpeningWidget = false; // Flag to prevent concurrent modal opens
  let escapeHandler = null;
  let closeMessageHandler = null;
  
  // Safety mechanism: Check and restore any stuck styles on page load
  // This ensures the page is never left in a broken state from previous sessions
  function checkAndRestoreStuckStyles() {
    try {
      // Check if overlay exists but shouldn't (page reloaded with stuck overlay)
      const stuckOverlay = document.getElementById('nusense-widget-overlay');
      if (stuckOverlay && !window.NUSENSE_WIDGET_OPEN) {
        stuckOverlay.remove();
      }
      
      // Check if body/html have overflow hidden but no overlay (stuck state)
      const bodyOverflow = window.getComputedStyle(document.body).overflow;
      const htmlOverflow = window.getComputedStyle(document.documentElement).overflow;
      const hasOverlay = !!document.getElementById('nusense-widget-overlay');
      
      if ((bodyOverflow === 'hidden' || htmlOverflow === 'hidden') && !hasOverlay) {
        // Styles are stuck - restore them
        document.body.style.overflow = '';
        document.documentElement.style.overflow = '';
        document.body.style.position = '';
        if (document.documentElement.dataset.nusenseOriginalOverflow !== undefined) {
          delete document.documentElement.dataset.nusenseOriginalOverflow;
        }
        if (config.debug) {
          console.log('NUSENSE: Restored stuck styles on page load');
        }
      }
    } catch (error) {
      // Silently fail
    }
  }
  
  // Run check immediately and on DOM ready
  checkAndRestoreStuckStyles();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkAndRestoreStuckStyles);
  }
  
  // Safety mechanism: Always restore body overflow on page unload
  window.addEventListener('beforeunload', function() {
    restoreBodyScroll();
  });
  
  // Safety mechanism: Restore body overflow if widget overlay is removed externally
  function restoreBodyScroll() {
    try {
      // Always restore, even if variables are null (safety net)
      if (originalBodyOverflow !== null && originalBodyOverflow !== undefined) {
        document.body.style.overflow = originalBodyOverflow;
      } else {
        document.body.style.overflow = '';
      }
      
      if (originalBodyPosition !== null && originalBodyPosition !== undefined) {
        document.body.style.position = originalBodyPosition;
      } else {
        document.body.style.position = '';
      }
      
      // Restore html element overflow
      const htmlElement = document.documentElement;
      if (htmlElement && htmlElement.dataset.nusenseOriginalOverflow !== undefined) {
        htmlElement.style.overflow = htmlElement.dataset.nusenseOriginalOverflow;
        delete htmlElement.dataset.nusenseOriginalOverflow;
      } else {
        htmlElement.style.overflow = '';
      }
      
      // Reset variables
      originalBodyOverflow = null;
      originalBodyPosition = null;
    } catch (error) {
      // Fallback: try to restore manually
      try {
        document.body.style.overflow = '';
        document.body.style.position = '';
        document.documentElement.style.overflow = '';
      } catch (e) {
        // Silently fail if restoration fails
      }
      if (config.debug) {
        console.warn('NUSENSE: Error in restoreBodyScroll:', error);
      }
    }
  }

  // Single delegated event listener on document body (more efficient and prevents duplicates)
  function handleButtonClick(e) {
    const button = e.target.closest('[id^="nusense-tryon-btn"], .nusense-tryon-button');
    if (!button) {
      return; // Not a NUSENSE button
    }
    
    // Skip if already processing or modal is open
    if (document.getElementById('nusense-widget-overlay') || window.NUSENSE_IS_OPENING) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    
    e.preventDefault();
    e.stopPropagation();
    openWidget();
  }

  // Initialize widget
  function initWidget() {
    // Use event delegation on document body - only set up ONCE
    if (!window.NUSENSE_CLICK_LISTENER_ADDED) {
      document.body.addEventListener('click', handleButtonClick, true); // Use capture phase
      window.NUSENSE_CLICK_LISTENER_ADDED = true;
    }
  }

  // Detect customer information from Shopify storefront using JSON script tag
  // This is the recommended Shopify approach - customer info is injected via Liquid in the app block
  function getCustomerInfo() {
    try {
      // Read customer information from JSON script tag injected by Liquid in the app block
      const customerInfoScript = document.getElementById('nusense-customer-info');
      
      if (customerInfoScript && customerInfoScript.textContent) {
        try {
          const customerInfo = JSON.parse(customerInfoScript.textContent);
          
          // Only return customer info if at least ID or email is present
          if (customerInfo && (customerInfo.id || customerInfo.email)) {
            if (config.debug) {
              console.log('NUSENSE: Customer info detected from JSON script tag', {
                hasId: !!customerInfo.id,
                hasEmail: !!customerInfo.email,
                id: customerInfo.id,
                email: customerInfo.email ? customerInfo.email.substring(0, 3) + '***' : null,
              });
            }
            return {
              id: customerInfo.id ? customerInfo.id.toString() : null,
              email: customerInfo.email || null,
              firstName: customerInfo.firstName || null,
              lastName: customerInfo.lastName || null,
            };
          }
        } catch (parseError) {
          if (config.debug) {
            console.warn('NUSENSE: Error parsing customer info JSON:', parseError);
          }
        }
      }
      
      // Debug: Log when customer info is not found
      if (config.debug) {
        const scriptExists = !!customerInfoScript;
        const hasContent = customerInfoScript && customerInfoScript.textContent;
        console.log('NUSENSE: Customer info not found', {
          scriptExists,
          hasContent,
          customerLoggedIn: typeof window.Shopify !== 'undefined' && window.Shopify.customer,
        });
      }
      
      return null;
    } catch (error) {
      if (config.debug) {
        console.warn('NUSENSE: Error detecting customer info:', error);
      }
      return null;
    }
  }

  // Open widget in modal
  function openWidget() {
    // Check if widget is already open - prevent duplicate modals (check FIRST, before any other logic)
    const existingOverlay = document.getElementById('nusense-widget-overlay');
    if (existingOverlay) {
      return; // Widget is already open, don't create another one
    }
    
    // Prevent concurrent modal opens using global flag
    if (window.NUSENSE_IS_OPENING) {
      return; // Already opening, ignore this call
    }
    
    // Set global flag to prevent concurrent opens (use window property to survive script reloads)
    window.NUSENSE_IS_OPENING = true;
    isOpeningWidget = true;
    
    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.id = 'nusense-widget-overlay';
      overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.2);
      z-index: 999999;
      display: flex;
      align-items: center;
      justify-content: center;
      animation: nusense-fadeIn 0.2s ease;
    `;

      // Add fade-in animation and styles (only once)
      // Scope styles to NUSENSE-specific IDs to avoid conflicts with Shopify themes
      const styleId = 'nusense-widget-styles';
      let style = document.getElementById(styleId);
      if (!style) {
        style = document.createElement('style');
        style.id = styleId;
        // Scope all styles to NUSENSE-specific IDs to prevent conflicts
        style.textContent = `
      @keyframes nusense-fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      @keyframes nusense-slideUp {
        from { transform: translateY(20px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
      #nusense-widget-overlay {
        animation: nusense-fadeIn 0.2s ease;
      }
      #nusense-widget-container {
        animation: nusense-slideUp 0.3s ease;
      }
      @media (min-width: 768px) {
        #nusense-widget-container[id="nusense-widget-container"] {
          width: 900px !important;
          max-width: 900px !important;
          min-width: 900px !important;
        }
      }
      @media (max-width: 767px) {
        #nusense-widget-container[id="nusense-widget-container"] {
          width: 95vw !important;
          max-width: 95vw !important;
        }
      }
    `;
      document.head.appendChild(style);
    }

    // Create container
    const container = document.createElement('div');
    container.id = 'nusense-widget-container';
    
    // Determine width based on screen size
    const isDesktop = window.innerWidth >= 768;
    // Use 900px as requested, but we'll use CSS to force desktop layout
    const containerWidth = isDesktop ? '900px' : '95vw';
    const containerMaxWidth = isDesktop ? '900px' : '95vw';
    
    container.style.cssText = `
      width: ${containerWidth};
      max-width: ${containerMaxWidth};
      height: auto;
      max-height: 98vh;
      position: relative;
      background: white;
      border-radius: 0.75rem;
      overflow: hidden;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      transition: height 0.3s ease-out;
    `;

    // Create iframe
    const iframe = document.createElement('iframe');
    iframe.id = 'nusense-widget-iframe';
    
    // Build URL with query parameters
    const urlParams = new URLSearchParams();
    
    // Pass product data if available
    if (productData) {
      urlParams.set('product', encodeURIComponent(JSON.stringify(productData)));
    }
    
    // Pass parent viewport info so iframe knows if it's desktop or mobile
    // This is critical because the iframe might be 900px (less than lg:1024px breakpoint)
    // but the parent window is desktop, so we need to tell the iframe it's desktop mode
    const parentIsDesktop = window.innerWidth >= 768;
    urlParams.set('parentWidth', window.innerWidth.toString());
    urlParams.set('parentIsDesktop', parentIsDesktop.toString());
    
    // Detect and pass customer information if available
    const customerInfo = getCustomerInfo();
    if (customerInfo) {
      if (customerInfo.id) {
        urlParams.set('customerId', customerInfo.id.toString());
      }
      if (customerInfo.email) {
        urlParams.set('customerEmail', encodeURIComponent(customerInfo.email));
      }
      if (customerInfo.firstName) {
        urlParams.set('customerFirstName', encodeURIComponent(customerInfo.firstName));
      }
      if (customerInfo.lastName) {
        urlParams.set('customerLastName', encodeURIComponent(customerInfo.lastName));
      }
      
      if (config.debug) {
        console.log('NUSENSE: Customer info detected and passed to widget', {
          hasId: !!customerInfo.id,
          hasEmail: !!customerInfo.email,
        });
      }
    }
    
    const queryString = urlParams.toString();
    iframe.src = config.widgetUrl + '/widget' + (queryString ? '?' + queryString : '');
    
    iframe.style.cssText = `
      width: 100%;
      height: 100%;
      border: none;
      display: block;
    `;
    iframe.allow = 'camera; microphone';
    iframe.setAttribute('allowfullscreen', 'true');

    // Assemble modal
    container.appendChild(iframe);
    overlay.appendChild(container);
    document.body.appendChild(overlay);
    
    // Reset opening flags once overlay is in DOM
    isOpeningWidget = false;
    window.NUSENSE_IS_OPENING = false;

    // Handle window resize to maintain correct width and height
    currentResizeHandler = function() {
      const isDesktopNow = window.innerWidth >= 768;
      if (isDesktopNow) {
        container.style.width = '900px';
        container.style.maxWidth = '900px';
        container.style.minWidth = '900px';
      } else {
        container.style.width = '95vw';
        container.style.maxWidth = '95vw';
        container.style.minWidth = '';
      }
      // Update height to respect max-height on resize
      container.style.height = '94vh';
      container.style.maxHeight = '650px';
    };
    window.addEventListener('resize', currentResizeHandler);

    // Prevent body scroll using a safer method that preserves layout
    // Store original values to restore later
    const bodyComputedStyle = window.getComputedStyle(document.body);
    originalBodyOverflow = document.body.style.overflow || bodyComputedStyle.overflow || '';
    originalBodyPosition = document.body.style.position || bodyComputedStyle.position || '';
    
    // Use position: fixed method to prevent scroll without breaking layout
    // This is safer than overflow: hidden which can cause layout recalculation issues
    const scrollY = window.scrollY || window.pageYOffset || 0;
    
    // Store scroll position
    document.body.dataset.nusenseScrollY = scrollY.toString();
    
    // Apply position fixed to prevent scroll (preserves layout better than overflow: hidden)
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.width = '100%';
    
    // Only set overflow hidden on body (not html) to avoid breaking Shopify layouts
    document.body.style.overflow = 'hidden';
    
    // DO NOT modify html element overflow - this can break Shopify product page layouts
    // The body overflow hidden is sufficient to prevent scrolling

    // Close on escape key
    escapeHandler = function(e) {
      if (e.key === 'Escape') {
        closeWidget();
        if (escapeHandler) {
          document.removeEventListener('keydown', escapeHandler);
          escapeHandler = null;
        }
      }
    };
    document.addEventListener('keydown', escapeHandler);

    // Listen for close messages from iframe
    // Use a namespaced handler to avoid conflicts with other apps
    closeMessageHandler = function(e) {
      // Only handle NUSENSE messages to avoid interfering with stock alerts and other apps
      if (!e || !e.data || !e.data.type || typeof e.data.type !== 'string' || !e.data.type.startsWith('NUSENSE_')) {
        return;
      }

      // Only accept messages from our widget iframe to avoid interference with other apps.
      try {
        if (!iframe.contentWindow || e.source !== iframe.contentWindow) {
          return;
        }
      } catch (error) {
        return;
      }

      // If we can derive the widget origin, enforce it strictly.
      try {
        const widgetOrigin = new URL(String(config.widgetUrl)).origin;
        if (widgetOrigin && e.origin !== widgetOrigin) {
          return;
        }
      } catch (error) {
        // If widgetUrl isn't a valid URL, skip origin enforcement (but still require source match).
      }

      // Handle dynamic height updates from iframe content
      if (e.data.type === 'NUSENSE_WIDGET_HEIGHT') {
        const height = e.data.height;
        const maxHeight = e.data.maxHeight || window.innerHeight * 0.98;
        if (typeof height === 'number' && height > 0) {
          // Set container height to content height, but cap at maxHeight
          const finalHeight = Math.min(height, maxHeight);
          container.style.height = finalHeight + 'px';
          // Ensure iframe fills the container
          iframe.style.height = '100%';
        }
        return;
      }

      if (e.data && e.data.type === 'NUSENSE_CLOSE_WIDGET') {
        closeWidget();
        if (closeMessageHandler) {
          window.removeEventListener('message', closeMessageHandler);
          closeMessageHandler = null;
        }
      }
    };
    window.addEventListener('message', closeMessageHandler);

    // Widget opened
  }

  // Close widget
  function closeWidget() {
    const overlay = document.getElementById('nusense-widget-overlay');
    
    // Always restore body scroll FIRST, even if overlay not found
    // This ensures the page is never left in a broken state
    try {
      // Restore scroll position first
      const scrollY = document.body.dataset.nusenseScrollY;
      if (scrollY) {
        delete document.body.dataset.nusenseScrollY;
      }
      
      // Restore body styles
      if (originalBodyOverflow !== null && originalBodyOverflow !== undefined) {
        document.body.style.overflow = originalBodyOverflow;
      } else {
        document.body.style.overflow = '';
      }
      
      if (originalBodyPosition !== null && originalBodyPosition !== undefined) {
        document.body.style.position = originalBodyPosition;
      } else {
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.left = '';
        document.body.style.right = '';
        document.body.style.width = '';
      }
      
      // Restore scroll position
      if (scrollY) {
        window.scrollTo(0, parseInt(scrollY, 10));
      }
      
      // Reset variables
      originalBodyOverflow = null;
      originalBodyPosition = null;
      
    } catch (error) {
      if (config.debug) {
        console.warn('NUSENSE: Error restoring body scroll:', error);
      }
      // Fallback: try to restore manually
      try {
        document.body.style.overflow = '';
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.left = '';
        document.body.style.right = '';
        document.body.style.width = '';
        if (document.body.dataset.nusenseScrollY) {
          const scrollY = parseInt(document.body.dataset.nusenseScrollY, 10);
          window.scrollTo(0, scrollY);
          delete document.body.dataset.nusenseScrollY;
        }
      } catch (e) {
        // Silently fail if restoration fails
      }
    }
    
    // Remove event listeners
    if (escapeHandler) {
      document.removeEventListener('keydown', escapeHandler);
      escapeHandler = null;
    }
    
    if (closeMessageHandler) {
      window.removeEventListener('message', closeMessageHandler);
      closeMessageHandler = null;
    }
    
    // Remove resize handler
    if (currentResizeHandler) {
      window.removeEventListener('resize', currentResizeHandler);
      currentResizeHandler = null;
    }
    
    if (overlay) {
      // Reset opening flags
      isOpeningWidget = false;
      window.NUSENSE_IS_OPENING = false;
      
      // Add fadeOut animation if not already defined
      const fadeOutStyleId = 'nusense-widget-fadeout-styles';
      if (!document.getElementById(fadeOutStyleId)) {
        const fadeOutStyle = document.createElement('style');
        fadeOutStyle.id = fadeOutStyleId;
        fadeOutStyle.textContent = `
          @keyframes nusense-fadeOut {
            from { opacity: 1; }
            to { opacity: 0; }
          }
        `;
        document.head.appendChild(fadeOutStyle);
      }
      overlay.style.animation = 'nusense-fadeOut 0.2s ease';
      setTimeout(function() {
        try {
          if (overlay.parentNode) {
            overlay.parentNode.removeChild(overlay);
          }
        } catch (error) {
          if (config.debug) {
            console.warn('NUSENSE: Error removing overlay:', error);
          }
        }
      }, 200);
    } else {
      // Reset flags even if overlay not found
      isOpeningWidget = false;
      window.NUSENSE_IS_OPENING = false;
    }
  }

  // Auto-open widget after login if open_tryon parameter is present
  function autoOpenWidgetAfterLogin() {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const shouldOpenTryOn = urlParams.get('open_tryon') === 'true';
      
      if (shouldOpenTryOn) {
        // Remove the parameter from URL to clean it up
        urlParams.delete('open_tryon');
        const newUrl = window.location.pathname + (urlParams.toString() ? '?' + urlParams.toString() : '');
        window.history.replaceState({}, '', newUrl);
        
        // Wait a bit for page to fully load and buttons to be initialized
        setTimeout(function() {
          // Find the first try-on button on the page
          const buttons = document.querySelectorAll('[data-nusense-tryon]');
          if (buttons.length > 0) {
            // Trigger click on the first button to open widget
            const firstButton = buttons[0];
            if (typeof firstButton.click === 'function') {
              firstButton.click();
            } else {
              // Fallback: dispatch click event
              const clickEvent = new MouseEvent('click', {
                bubbles: true,
                cancelable: true,
                view: window
              });
              firstButton.dispatchEvent(clickEvent);
            }
          } else {
            // If buttons not found yet, wait a bit more and try again
            setTimeout(function() {
              const retryButtons = document.querySelectorAll('[data-nusense-tryon]');
              if (retryButtons.length > 0) {
                const firstButton = retryButtons[0];
                if (typeof firstButton.click === 'function') {
                  firstButton.click();
                } else {
                  const clickEvent = new MouseEvent('click', {
                    bubbles: true,
                    cancelable: true,
                    view: window
                  });
                  firstButton.dispatchEvent(clickEvent);
                }
              }
            }, 500);
          }
        }, 300); // Small delay to ensure buttons are initialized
      }
    } catch (error) {
      // Silently fail - don't break the page if auto-open fails
      if (config.debug) {
        console.warn('NUSENSE: Auto-open widget after login failed:', error);
      }
    }
  }

  // Auto-initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      initWidget();
      autoOpenWidgetAfterLogin();
    });
  } else {
    initWidget();
    autoOpenWidgetAfterLogin();
  }

  // Re-initialize on dynamic content changes (for AJAX themes)
  // CRITICAL: Following Shopify best practices - minimize MutationObserver usage
  // Only watch for NUSENSE-specific elements to completely avoid interfering with stock alerts
  // This prevents ANY conflicts with stock alert apps and other dynamic content
  if (typeof MutationObserver !== 'undefined') {
    let reinitTimeout = null;
    let observer = null;
    
    // Helper function to check if node is a NUSENSE button (ONLY our elements)
    function isNusenseButton(node) {
      if (!node || node.nodeType !== 1) return false;
      
      // Only check for NUSENSE-specific identifiers
      if (node.id && node.id.startsWith('nusense-tryon-btn')) {
        return true;
      }
      if (node.classList && node.classList.contains('nusense-tryon-button')) {
        return true;
      }
      // Check for NUSENSE buttons inside the node
      if (node.querySelectorAll && (
        node.querySelectorAll('[id^="nusense-tryon-btn"]').length > 0 ||
        node.querySelectorAll('.nusense-tryon-button').length > 0
      )) {
        return true;
      }
      
      return false;
    }
    
    // Ultra-selective observer - ONLY watches for NUSENSE buttons
    // Completely ignores all other DOM changes including stock alerts
    function createObserver() {
      if (observer) {
        return; // Already created
      }
      
      observer = new MutationObserver(function(mutations) {
        // Debounce re-initialization to avoid excessive calls
        if (reinitTimeout) {
          clearTimeout(reinitTimeout);
        }
        
        // ONLY check for NUSENSE buttons - ignore everything else
        let shouldReinit = false;
        for (let m = 0; m < mutations.length; m++) {
          const mutation = mutations[m];
          if (mutation.addedNodes.length) {
            for (let i = 0; i < mutation.addedNodes.length; i++) {
              const node = mutation.addedNodes[i];
              if (isNusenseButton(node)) {
                shouldReinit = true;
                break;
              }
            }
          }
          if (shouldReinit) break;
        }
        
        // Only re-init if NUSENSE buttons are detected
        if (shouldReinit) {
          reinitTimeout = setTimeout(function() {
            initWidget();
          }, 150); // Small delay to batch multiple rapid changes
        }
      });
    }

    // Setup observer ONLY on elements that contain NUSENSE buttons
    // This completely avoids watching product forms or stock alerts
    function setupObserver() {
      // Safety check: ensure document.body exists
      if (!document.body) {
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', setupObserver, { once: true });
          return;
        } else {
          setTimeout(setupObserver, 100);
          return;
        }
      }
      
      // Create observer if not already created
      createObserver();
      
      // Find ONLY containers that already have NUSENSE buttons
      // This ensures we never watch areas without our buttons (like stock alerts)
      const nusenseContainers = document.querySelectorAll('[id^="nusense-tryon-btn"], .nusense-tryon-button');
      
      if (nusenseContainers.length === 0) {
        // No NUSENSE buttons found - don't set up observer
        // This prevents watching the entire page and interfering with stock alerts
        return;
      }
      
      // Only observe the direct parent containers of NUSENSE buttons
      // This minimizes scope and completely avoids stock alerts
      const containersToWatch = new Set();
      nusenseContainers.forEach(function(button) {
        const parent = button.parentElement;
        if (parent && parent !== document.body && parent !== document.documentElement) {
          containersToWatch.add(parent);
        }
      });
      
      // Observe only the specific containers that have our buttons
      containersToWatch.forEach(function(container) {
        try {
          observer.observe(container, {
            childList: true,
            subtree: false // Don't watch subtree - only direct children
          });
        } catch (error) {
          // Silently fail if observer setup fails
          if (config.debug) {
            console.error('NUSENSE: Failed to setup MutationObserver:', error);
          }
        }
      });
    }
    
    // Initialize observer when DOM is ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', setupObserver, { once: true });
    } else {
      setupObserver();
    }
  }

  // Export for manual initialization if needed
  window.NUSENSE_WIDGET = {
    open: openWidget,
    close: closeWidget,
    init: initWidget,
    config: config,
    productData: productData
  };

  // Widget loaded
})();
