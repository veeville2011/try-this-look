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
    widgetUrl: 'https://try-this-look.vercel.app',
    debug: false,
    autoDetect: true
  };

  // Product data from window.NUSENSE_PRODUCT_DATA
  const productData = window.NUSENSE_PRODUCT_DATA || null;

  // Store original body overflow to restore it properly
  let originalBodyOverflow = null;
  let currentResizeHandler = null;
  let isOpeningWidget = false; // Flag to prevent concurrent modal opens

  // Initialize widget
  function initWidget() {
    // Find all try-on buttons
    const buttons = document.querySelectorAll('[id^="nusense-tryon-btn"], .nusense-tryon-button');
    
    buttons.forEach(function(button) {
      // Skip if already initialized
      if (button.dataset.nusenseInitialized === 'true') {
        return;
      }
      
      button.dataset.nusenseInitialized = 'true';
      
      button.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        openWidget();
      });
    });
  }

  // Open widget in modal
  function openWidget() {
    // Prevent concurrent modal opens
    if (isOpeningWidget) {
      return; // Already opening, ignore this call
    }
    
    // Check if widget is already open - prevent duplicate modals
    const existingOverlay = document.getElementById('nusense-widget-overlay');
    if (existingOverlay) {
      return; // Widget is already open, don't create another one
    }
    
    // Set flag to prevent concurrent opens
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
      animation: fadeIn 0.2s ease;
    `;

    // Add fade-in animation and styles (only once)
    const styleId = 'nusense-widget-styles';
    let style = document.getElementById(styleId);
    if (!style) {
      style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      @keyframes slideUp {
        from { transform: translateY(20px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
      #nusense-widget-container {
        animation: slideUp 0.3s ease;
      }
      @media (min-width: 768px) {
        #nusense-widget-container {
          width: 900px !important;
          max-width: 900px !important;
          min-width: 900px !important;
        }
      }
      @media (max-width: 767px) {
        #nusense-widget-container {
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
    const containerWidth = isDesktop ? '900px' : '95vw';
    const containerMaxWidth = isDesktop ? '900px' : '1200px';
    
    container.style.cssText = `
      width: ${containerWidth};
      max-width: ${containerMaxWidth};
      height: 90vh;
      max-height: 900px;
      position: relative;
      background: white;
      border-radius: 0.25rem;
      overflow: hidden;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    `;

    // Create iframe
    const iframe = document.createElement('iframe');
    iframe.id = 'nusense-widget-iframe';
    
    // Pass product data via URL query parameter
    const productDataStr = productData ? encodeURIComponent(JSON.stringify(productData)) : '';
    iframe.src = config.widgetUrl + '/widget' + (productDataStr ? '?product=' + productDataStr : '');
    
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
    
    // Reset opening flag once overlay is in DOM
    isOpeningWidget = false;

    // Handle window resize to maintain correct width
    currentResizeHandler = function() {
      const isDesktopNow = window.innerWidth >= 768;
      if (isDesktopNow) {
        container.style.width = '900px';
        container.style.maxWidth = '900px';
        container.style.minWidth = '900px';
      } else {
        container.style.width = '95vw';
        container.style.maxWidth = '1200px';
        container.style.minWidth = '';
      }
    };
    window.addEventListener('resize', currentResizeHandler);

    // Prevent body scroll - store original value to restore later
    originalBodyOverflow = document.body.style.overflow || '';
    document.body.style.overflow = 'hidden';

    // Close on escape key
    const escapeHandler = function(e) {
      if (e.key === 'Escape') {
        closeWidget();
        document.removeEventListener('keydown', escapeHandler);
      }
    };
    document.addEventListener('keydown', escapeHandler);

    // Listen for close messages from iframe
    // Use a namespaced handler to avoid conflicts with other apps
    const closeMessageHandler = function(e) {
      // Only handle NUSENSE messages to avoid interfering with stock alerts and other apps
      if (e.data && e.data.type === 'NUSENSE_CLOSE_WIDGET') {
        closeWidget();
        window.removeEventListener('message', closeMessageHandler);
      }
    };
    window.addEventListener('message', closeMessageHandler);

    // Widget opened
  }

  // Close widget
  function closeWidget() {
    const overlay = document.getElementById('nusense-widget-overlay');
    if (overlay) {
      // Reset opening flag
      isOpeningWidget = false;
      
      // Remove resize handler
      if (currentResizeHandler) {
        window.removeEventListener('resize', currentResizeHandler);
        currentResizeHandler = null;
      }
      
      overlay.style.animation = 'fadeOut 0.2s ease';
      setTimeout(function() {
        if (overlay.parentNode) {
          overlay.parentNode.removeChild(overlay);
        }
        // Restore original overflow value instead of clearing it
        if (originalBodyOverflow !== null) {
          document.body.style.overflow = originalBodyOverflow;
        } else {
          document.body.style.overflow = '';
        }
        originalBodyOverflow = null;
      }, 200);
    } else {
      // Reset flag even if overlay not found
      isOpeningWidget = false;
    }
  }

  // Auto-initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWidget);
  } else {
    initWidget();
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
