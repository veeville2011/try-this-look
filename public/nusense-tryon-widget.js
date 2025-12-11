/**
 * NUSENSE TryON Widget Loader
 * This script loads and initializes the try-on widget on product pages
 */

(function() {
  'use strict';

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

    // Add fade-in animation
    const style = document.createElement('style');
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
    `;
    document.head.appendChild(style);

    // Create container
    const container = document.createElement('div');
    container.id = 'nusense-widget-container';
    container.style.cssText = `
      width: 95vw;
      max-width: 1200px;
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
    }
  }

  // Auto-initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWidget);
  } else {
    initWidget();
  }

  // Re-initialize on dynamic content changes (for AJAX themes)
  // IMPORTANT: Only watch for NUSENSE-specific elements to avoid interfering with other apps
  // This prevents conflicts with stock alert apps and other dynamic content
  if (typeof MutationObserver !== 'undefined') {
    let reinitTimeout = null;
    const observer = new MutationObserver(function(mutations) {
      // Debounce re-initialization to avoid excessive calls
      if (reinitTimeout) {
        clearTimeout(reinitTimeout);
      }
      
      // Only re-initialize if NUSENSE buttons are added, not for any DOM change
      let shouldReinit = false;
      mutations.forEach(function(mutation) {
        if (mutation.addedNodes.length) {
          for (let i = 0; i < mutation.addedNodes.length; i++) {
            const node = mutation.addedNodes[i];
            // Only re-init if a NUSENSE button or container is added
            if (node.nodeType === 1) { // Element node
              if (node.id && node.id.startsWith('nusense-tryon-btn')) {
                shouldReinit = true;
                break;
              }
              if (node.classList && node.classList.contains('nusense-tryon-button')) {
                shouldReinit = true;
                break;
              }
              // Check if any NUSENSE buttons are inside the added node
              if (node.querySelectorAll && (
                node.querySelectorAll('[id^="nusense-tryon-btn"]').length > 0 ||
                node.querySelectorAll('.nusense-tryon-button').length > 0
              )) {
                shouldReinit = true;
                break;
              }
            }
          }
        }
      });
      
      // Debounce re-init to avoid interfering with rapid DOM changes from other apps
      if (shouldReinit) {
        reinitTimeout = setTimeout(function() {
          initWidget();
        }, 100); // Small delay to batch multiple rapid changes
      }
    });

    // Only observe document.body, but be more selective about what triggers re-init
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
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
