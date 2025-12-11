/**
 * NUSENSE Try-On Button - Optimized JavaScript
 * Handles button styling, positioning, and widget interaction
 */
(function() {
  'use strict';

  // Debounce utility function
  const debounce = function(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  };

  // Initialize button instance
  const initButton = function(buttonId, config) {
    const button = document.getElementById(buttonId);
    if (!button) return null;

    // Cache DOM queries
    const cached = {
      button: button,
      iconSpan: null,
      targetButton: null,
      primaryButton: null
    };

    // Initialize cached elements
    const updateCache = function() {
      cached.iconSpan = button.querySelector('.button__icon');
    };
    updateCache();

    // Function to detect theme primary colors from CSS variables or computed styles
    const detectThemeColors = function() {
      const themeColors = {
        primaryBg: null,
        primaryText: null,
        primaryBorder: null,
        primaryHoverBg: null
      };
      
      try {
        // Method 1: Check Shopify CSS custom properties
        const rootStyles = window.getComputedStyle(document.documentElement);
        const cssVarNames = [
          '--color-primary', '--color-button', '--color-button-text', '--color-button-hover',
          '--color-accent', '--color-accent-text', '--button-primary-background',
          '--button-primary-text', '--button-primary-hover', '--color-base-solid-button-labels',
          '--color-base-text', '--color-button-background', '--color-button-text-color'
        ];
        
        for (let varName of cssVarNames) {
          const value = rootStyles.getPropertyValue(varName);
          if (value && value.trim() && !value.includes('initial')) {
            if (varName.includes('background') || varName.includes('button') || varName.includes('primary') || varName.includes('accent')) {
              if (!themeColors.primaryBg) themeColors.primaryBg = value.trim();
            }
            if (varName.includes('text') || varName.includes('label')) {
              if (!themeColors.primaryText) themeColors.primaryText = value.trim();
            }
          }
        }
        
        // Method 2: Check button-like elements
        if (!themeColors.primaryBg || !themeColors.primaryText) {
          const buttonSelectors = [
            'button[type="submit"]', 'button.btn', 'button.button', '.btn-primary',
            '.button--primary', 'input[type="submit"]', '.product-form__submit', '[data-add-to-cart]'
          ];
          
          for (let selector of buttonSelectors) {
            try {
              const candidate = document.querySelector(selector);
              if (candidate && candidate !== button && !candidate.classList.contains('nusense-tryon-button')) {
                const computed = window.getComputedStyle(candidate);
                const bgColor = computed.getPropertyValue('background-color');
                const textColor = computed.getPropertyValue('color');
                const borderColor = computed.getPropertyValue('border-color');
                
                if (bgColor && bgColor !== 'rgba(0, 0, 0, 0)' && bgColor !== 'transparent' && bgColor !== 'initial') {
                  if (!themeColors.primaryBg) themeColors.primaryBg = bgColor.trim();
                }
                if (textColor && textColor !== 'rgba(0, 0, 0, 0)' && textColor !== 'transparent' && textColor !== 'initial') {
                  if (!themeColors.primaryText) themeColors.primaryText = textColor.trim();
                }
                if (borderColor && borderColor !== 'rgba(0, 0, 0, 0)' && borderColor !== 'transparent' && borderColor !== 'initial') {
                  if (!themeColors.primaryBorder) themeColors.primaryBorder = borderColor.trim();
                }
                break;
              }
            } catch (e) {
              continue;
            }
          }
        }
        
        // Method 3: Check body for accent colors
        if (!themeColors.primaryBg) {
          try {
            const bodyStyles = window.getComputedStyle(document.body);
            const linkColor = bodyStyles.getPropertyValue('--color-link') || bodyStyles.getPropertyValue('--color-accent');
            if (linkColor && linkColor.trim()) {
              themeColors.primaryBg = linkColor.trim();
            }
          } catch (e) {
            // Ignore
          }
        }
      } catch (e) {
        console.warn('NUSENSE: Error detecting theme colors:', e);
      }
      
      return themeColors;
    };

    // Validation function for primary buttons
    const validatePrimaryButton = function(candidateButton) {
      if (!candidateButton) return false;
      if (candidateButton.tagName !== 'BUTTON' && candidateButton.tagName !== 'INPUT') return false;
      if (candidateButton.id === button.id || candidateButton.classList.contains('nusense-tryon-button')) return false;
      
      const computedStyle = window.getComputedStyle(candidateButton);
      if (computedStyle.display === 'none' || computedStyle.visibility === 'hidden' || computedStyle.opacity === '0') return false;
      
      const productForm = candidateButton.closest('form[action*="/cart/add"]');
      const productSection = candidateButton.closest('.product-form, .product-single, [class*="product"]');
      if (!productForm && !productSection) return false;
      
      const buttonText = (candidateButton.textContent || candidateButton.value || candidateButton.getAttribute('aria-label') || '').toLowerCase().trim();
      return buttonText.length > 0;
    };

    // Function to find primary button (Add to Cart OR Buy Now)
    const findPrimaryButton = function() {
      const addToCartSelectors = [
        'form[action*="/cart/add"] button[name="add"]',
        'form[action*="/cart/add"] input[type="submit"][name="add"]',
        'button[name="add"]',
        'input[type="submit"][name="add"]',
        'form[action*="/cart/add"] button[type="submit"]',
        '[data-add-to-cart]',
        '.product-form__submit',
        '.product-form__cart-submit',
        '#AddToCart'
      ];
      
      const buyNowSelectors = [
        'button[data-buy-now]',
        'button[data-checkout]',
        '.buy-now',
        '.buynow',
        '.checkout-button',
        '#BuyNow',
        'button:not([name="add"])[type="submit"]'
      ];
      
      // Try Add to Cart buttons first
      for (let selector of addToCartSelectors) {
        try {
          const candidates = document.querySelectorAll(selector);
          for (let candidate of candidates) {
            if (validatePrimaryButton(candidate)) {
              cached.primaryButton = candidate;
              return {
                element: candidate,
                type: 'add-to-cart',
                classes: candidate.className,
                computedStyles: window.getComputedStyle(candidate)
              };
            }
          }
        } catch (e) {
          continue;
        }
      }
      
      // Try Buy Now buttons as fallback
      for (let selector of buyNowSelectors) {
        try {
          const candidates = document.querySelectorAll(selector);
          for (let candidate of candidates) {
            if (validatePrimaryButton(candidate)) {
              cached.primaryButton = candidate;
              return {
                element: candidate,
                type: 'buy-now',
                classes: candidate.className,
                computedStyles: window.getComputedStyle(candidate)
              };
            }
          }
        } catch (e) {
          continue;
        }
      }
      
      return null;
    };

    // Function to find target button for positioning
    const findTargetButtonForPositioning = function() {
      if (cached.targetButton) return cached.targetButton;
      const primaryButton = findPrimaryButton();
      if (primaryButton && primaryButton.element) {
        cached.targetButton = primaryButton.element;
        return primaryButton.element;
      }
      return null;
    };

    // Function to apply positioning and spacing
    const applyPositioning = function(alignment, top, bottom, left, right) {
      if (!button) return;
      
      // Apply margins
      if (top && top !== config.marginTop && top !== '0') {
        button.style.marginTop = `${top}rem`;
      } else if (top === '0' || top === config.marginTop) {
        button.style.marginTop = top === '0' ? '0' : '';
      }
      
      if (bottom && bottom !== config.marginBottom && bottom !== '0') {
        button.style.marginBottom = `${bottom}rem`;
      } else if (bottom === '0' || bottom === config.marginBottom) {
        button.style.marginBottom = bottom === '0' ? '0' : '';
      }
      
      if (left && left !== config.marginLeft && left !== '0') {
        button.style.marginLeft = `${left}rem`;
      } else if (left === '0' || left === config.marginLeft) {
        button.style.marginLeft = left === '0' ? '0' : '';
      }
      
      if (right && right !== config.marginRight && right !== '0') {
        button.style.marginRight = `${right}rem`;
      } else if (right === '0' || right === config.marginRight) {
        button.style.marginRight = right === '0' ? '0' : '';
      }
      
      // Apply alignment
      if (alignment && alignment !== 'auto' && alignment !== config.buttonAlignment) {
        const parent = button.parentElement;
        if (parent) {
          if (alignment === 'left') {
            button.style.marginLeft = '0';
            button.style.marginRight = 'auto';
            parent.style.textAlign = 'left';
          } else if (alignment === 'center') {
            button.style.marginLeft = 'auto';
            button.style.marginRight = 'auto';
            parent.style.textAlign = 'center';
          } else if (alignment === 'right') {
            button.style.marginLeft = 'auto';
            button.style.marginRight = '0';
            parent.style.textAlign = 'right';
          }
        }
      } else if (alignment === 'auto' || !alignment || alignment === config.buttonAlignment) {
        const targetButton = findTargetButtonForPositioning();
        if (targetButton) {
          const targetParent = targetButton.parentElement;
          if (targetParent) {
            const parentComputed = window.getComputedStyle(targetParent);
            const parentTextAlign = parentComputed.textAlign;
            if (parentTextAlign && parentTextAlign !== 'initial' && parentTextAlign !== 'start') {
              button.parentElement.style.textAlign = parentTextAlign;
            }
          }
        }
      }
    };

    // Function to apply all button configurations
    const applyButtonConfig = function() {
      if (!button) return;
      
      try {
        // Get settings from data attributes
        const buttonStyle = button.dataset.buttonStyle || config.buttonStyle || 'primary';
        const showIcon = button.dataset.showIcon === 'true' || button.dataset.showIcon === true;
        const buttonWidthFull = button.dataset.buttonWidthFull === 'true' || button.dataset.buttonWidthFull === true;
        
        // Get custom color/size settings
        const customBgColor = button.dataset.backgroundColor || config.buttonBackgroundColor || '';
        const customTextColor = button.dataset.textColor || config.buttonTextColor || '';
        const customBorderColor = button.dataset.borderColor || config.buttonBorderColor || '';
        const customFontSize = button.dataset.fontSize || config.buttonFontSize || '';
        const customPadding = button.dataset.padding || config.buttonPadding || '';
        const customBorderRadius = button.dataset.borderRadius || config.buttonBorderRadius || '';
        const customCss = config.customCss || '';
        
        // Find primary button
        const primaryButtonStyles = findPrimaryButton();
        
        // Build class list
        let classes = 'nusense-tryon-button';
        
        // For PRIMARY style, copy styling from found primary button
        if (buttonStyle === 'primary' && primaryButtonStyles) {
          const primaryBtn = primaryButtonStyles.element;
          const primaryAllClasses = primaryBtn.className.split(' ').filter(cls => cls.trim() && cls.length > 0);
          
          const classesToCopy = primaryAllClasses.filter(cls => {
            return !cls.includes('disabled') && 
                   !cls.includes('loading') &&
                   !cls.includes('nusense') &&
                   cls !== 'nusense-tryon-button';
          });
          
          if (classesToCopy.length > 0) {
            classes += ' ' + classesToCopy.join(' ');
          }
          
          // Copy computed styles
          const computed = primaryButtonStyles.computedStyles;
          const stylesToCopy = [
            'background-color', 'background', 'color', 'border', 'border-color', 'border-width',
            'border-style', 'border-radius', 'font-weight', 'font-size', 'font-family',
            'text-transform', 'letter-spacing', 'padding', 'padding-top', 'padding-right',
            'padding-bottom', 'padding-left', 'min-height', 'height', 'line-height',
            'box-shadow', 'transition'
          ];
          
          stylesToCopy.forEach(prop => {
            const value = computed.getPropertyValue(prop);
            if (value && value !== 'initial' && value !== 'normal' && value !== 'none' && value.trim() !== '') {
              button.style.setProperty(prop, value);
            }
          });
          
          // Apply custom colors if provided (override copied styles)
          if (customBgColor && customBgColor.trim() && customBgColor !== config.buttonBackgroundColor) {
            button.style.backgroundColor = customBgColor;
          }
          if (customTextColor && customTextColor.trim() && customTextColor !== config.buttonTextColor) {
            button.style.color = customTextColor;
          }
          if (customBorderColor && customBorderColor.trim() && customBorderColor !== config.buttonBorderColor) {
            button.style.borderColor = customBorderColor;
            button.style.border = `1px solid ${customBorderColor}`;
          }
          
          // Apply custom sizes if provided
          if (customFontSize && customFontSize !== config.buttonFontSize) {
            button.style.fontSize = `${customFontSize}px`;
          }
          if (customPadding && customPadding !== config.buttonPadding) {
            button.style.padding = `${customPadding}rem 1.5rem`;
          }
          if (customBorderRadius && customBorderRadius !== config.buttonBorderRadius) {
            button.style.borderRadius = `${customBorderRadius}px`;
          }
          
        } else if (buttonStyle === 'primary') {
          // Primary style but no primary button found - detect and apply theme colors
          classes += ' button button--primary btn btn-primary';
          
          const themeColors = detectThemeColors();
          const primaryBg = customBgColor && customBgColor.trim() ? customBgColor : 
                           (themeColors.primaryBg || '#000000');
          const primaryText = customTextColor && customTextColor.trim() ? customTextColor : 
                             (themeColors.primaryText || '#ffffff');
          const primaryBorder = customBorderColor && customBorderColor.trim() ? customBorderColor : 
                              (themeColors.primaryBorder || primaryBg);
          
          const fontSize = customFontSize && customFontSize !== config.buttonFontSize ? `${customFontSize}px` : '1rem';
          const padding = customPadding && customPadding !== config.buttonPadding ? `${customPadding}rem 1.5rem` : '0.75rem 1.5rem';
          const borderRadius = customBorderRadius && customBorderRadius !== config.buttonBorderRadius ? `${customBorderRadius}px` : '4px';
          
          button.style.backgroundColor = primaryBg;
          button.style.color = primaryText;
          button.style.border = `1px solid ${primaryBorder}`;
          button.style.borderRadius = borderRadius;
          button.style.padding = padding;
          button.style.fontSize = fontSize;
          button.style.fontWeight = '600';
          button.style.cursor = 'pointer';
          button.style.minHeight = '44px';
          button.style.display = 'inline-flex';
          button.style.alignItems = 'center';
          button.style.justifyContent = 'center';
          button.style.transition = 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)';
          button.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06)';
          button.style.letterSpacing = '0.01em';
          button.style.userSelect = 'none';
          button.style.willChange = 'transform, box-shadow';
          
          // Smart hover effect
          const originalBg = primaryBg;
          const originalBorder = primaryBorder;
          let hoverBg = themeColors.primaryHoverBg;
          
          if (!hoverBg) {
            try {
              if (primaryBg.startsWith('#')) {
                const rgb = parseInt(primaryBg.slice(1), 16);
                const r = Math.max(0, ((rgb >> 16) & 0xff) * 0.85);
                const g = Math.max(0, ((rgb >> 8) & 0xff) * 0.85);
                const b = Math.max(0, (rgb & 0xff) * 0.85);
                hoverBg = `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
              } else if (primaryBg.startsWith('rgb')) {
                const matches = primaryBg.match(/\d+/g);
                if (matches && matches.length >= 3) {
                  const r = Math.max(0, parseInt(matches[0]) * 0.85);
                  const g = Math.max(0, parseInt(matches[1]) * 0.85);
                  const b = Math.max(0, parseInt(matches[2]) * 0.85);
                  hoverBg = `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
                } else {
                  hoverBg = primaryBg;
                }
              } else {
                hoverBg = primaryBg;
              }
            } catch (e) {
              hoverBg = primaryBg;
            }
          }
          
          // Professional hover effect with elevation
          button.addEventListener('mouseenter', function() {
            this.style.backgroundColor = hoverBg;
            this.style.borderColor = hoverBg;
            this.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.15), 0 2px 4px rgba(0, 0, 0, 0.1)';
            this.style.transform = 'translateY(-1px)';
            this.style.opacity = '1';
          });
          button.addEventListener('mouseleave', function() {
            this.style.backgroundColor = originalBg;
            this.style.borderColor = originalBorder;
            this.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06)';
            this.style.transform = 'translateY(0)';
            this.style.opacity = '1';
          });
          
          // Focus state for accessibility
          button.addEventListener('focus', function() {
            this.style.outline = '2px solid ' + primaryText;
            this.style.outlineOffset = '2px';
            this.style.boxShadow = '0 0 0 3px rgba(0, 0, 0, 0.2), 0 4px 6px rgba(0, 0, 0, 0.15)';
          });
          button.addEventListener('blur', function() {
            this.style.outline = '';
            this.style.outlineOffset = '';
            this.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06)';
          });
          
          // Active/pressed state
          button.addEventListener('mousedown', function() {
            this.style.backgroundColor = originalBg;
            this.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.2)';
            this.style.transform = 'translateY(0)';
          });
          button.addEventListener('mouseup', function() {
            this.style.backgroundColor = hoverBg;
            this.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.15), 0 2px 4px rgba(0, 0, 0, 0.1)';
            this.style.transform = 'translateY(-1px)';
          });
          
        } else if (buttonStyle === 'secondary') {
          classes += ' button button--secondary btn btn-secondary';
        } else if (buttonStyle === 'outline') {
          classes += ' button button--outline btn btn-outline';
        } else if (buttonStyle === 'minimal') {
          classes += ' button button--tertiary btn btn-link';
        }
        
        // Apply full width
        if (buttonWidthFull) {
          classes += ' button--full-width btn-block';
          button.style.width = '100%';
        } else {
          button.style.width = '';
        }
        
        button.className = classes.trim();
        
        // Handle icon visibility
        if (cached.iconSpan) {
          cached.iconSpan.style.display = showIcon ? 'inline' : 'none';
          const iconText = cached.iconSpan.dataset.icon || config.buttonIcon || '✨';
          if (iconText && cached.iconSpan.textContent !== iconText) {
            cached.iconSpan.textContent = iconText;
          }
        }
        
        // Apply custom CSS if provided
        if (customCss && customCss.trim() && customCss !== config.customCss) {
          let existingStyle = document.getElementById('nusense-custom-css-' + buttonId);
          if (existingStyle) {
            existingStyle.remove();
          }
          
          const styleTag = document.createElement('style');
          styleTag.id = 'nusense-custom-css-' + buttonId;
          styleTag.textContent = customCss;
          document.head.appendChild(styleTag);
        }
        
        // Apply positioning
        applyPositioning(
          button.dataset.alignment || config.buttonAlignment || 'auto',
          button.dataset.marginTop || config.marginTop || '0',
          button.dataset.marginBottom || config.marginBottom || '0.75',
          button.dataset.marginLeft || config.marginLeft || '0',
          button.dataset.marginRight || config.marginRight || '0'
        );
        
        button.dataset.styled = 'true';
        button.dataset.loading = 'false';
      } catch (e) {
        console.error('NUSENSE: Error applying button config:', e);
        button.dataset.loading = 'false';
      }
    };

    // Function to scroll to button and highlight it
    const scrollToAndHighlightButton = function() {
      if (!button || !button.offsetParent || button.dataset.highlighted === 'true') return;
      
      try {
        button.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
        
        const originalOutline = button.style.outline;
        const originalBoxShadow = button.style.boxShadow;
        const originalTransition = button.style.transition;
        const originalZIndex = button.style.zIndex;
        
        button.style.outline = '3px solid #007bff';
        button.style.outlineOffset = '2px';
        button.style.boxShadow = '0 0 0 4px rgba(0, 123, 255, 0.3)';
        button.style.transition = 'all 0.3s ease';
        button.style.zIndex = '9999';
        
        setTimeout(function() {
          button.style.outline = originalOutline;
          button.style.outlineOffset = '';
          button.style.boxShadow = originalBoxShadow;
          button.style.transition = originalTransition;
          button.style.zIndex = originalZIndex;
          button.dataset.highlighted = 'true';
        }, 3000);
      } catch (e) {
        console.warn('NUSENSE: Could not scroll/highlight button:', e);
      }
    };

    // Debounced apply config function
    const debouncedApplyConfig = debounce(applyButtonConfig, 100);

    // Auto-position function
    const positionButton = function() {
      if (button.dataset.positioningDisabled === 'true' || button.dataset.manualPosition === 'true') return;
      
      const targetButton = findTargetButtonForPositioning();
      if (!targetButton) {
        if (!button.dataset.positionCheckAttempted) {
          button.dataset.positionCheckAttempted = 'true';
        }
        return;
      }
      
      if (targetButton && button.parentNode && !button.dataset.positioned) {
        const targetParent = targetButton.parentElement;
        const buttonParent = button.parentElement;
        
        if (buttonParent !== targetParent || 
            !targetParent.contains(button) ||
            (targetParent.contains(button) && button.nextSibling !== targetButton && 
             !Array.from(targetParent.children).some((child, index, arr) => 
               child === button && arr[index + 1] === targetButton))) {
          
          const form = targetButton.closest('form') || targetParent;
          if (form && form.contains(targetButton)) {
            try {
              form.insertBefore(button, targetButton);
              button.dataset.positioned = 'true';
              button.dataset.validatedPosition = 'true';
              button.classList.add('nusense-positioned');
              
              const customMarginBottom = button.dataset.marginBottom || config.marginBottom || '0.75';
              if (customMarginBottom && customMarginBottom !== config.marginBottom) {
                button.style.marginBottom = `${customMarginBottom}rem`;
              } else if (!button.style.marginBottom) {
                button.style.marginBottom = '0.75rem';
              }
              
              applyPositioning(
                button.dataset.alignment || config.buttonAlignment || 'auto',
                button.dataset.marginTop || config.marginTop || '0',
                customMarginBottom,
                button.dataset.marginLeft || config.marginLeft || '0',
                button.dataset.marginRight || config.marginRight || '0'
              );
              
              if (!button.dataset.highlighted) {
                setTimeout(scrollToAndHighlightButton, 300);
              }
            } catch (e) {
              console.warn('NUSENSE: Could not auto-position button:', e);
              button.dataset.positioningDisabled = 'true';
            }
          }
        }
      } else if (targetParent && targetParent.contains(button)) {
        button.dataset.positioned = 'true';
        button.dataset.validatedPosition = 'true';
        if (!button.dataset.highlighted) {
          setTimeout(scrollToAndHighlightButton, 300);
        }
      }
    };

    // Debounced position function
    const debouncedPosition = debounce(positionButton, 200);

    // Initialize
    // Note: Button starts with data-loading="true" from Liquid template
    // applyButtonConfig() will set it to 'false' when complete
    applyButtonConfig();

    // Apply on DOM ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function() {
        setTimeout(applyButtonConfig, 100);
        if (!button.dataset.highlighted) {
          setTimeout(scrollToAndHighlightButton, 500);
        }
      });
    } else {
      setTimeout(applyButtonConfig, 100);
      if (!button.dataset.highlighted) {
        setTimeout(scrollToAndHighlightButton, 500);
      }
    }

    // Retry application for dynamic content
    setTimeout(applyButtonConfig, 500);
    setTimeout(applyButtonConfig, 1000);

    // Auto-position if enabled
    const autoPosition = button.dataset.autoPosition === 'true' || button.dataset.autoPosition === true;
    if (autoPosition) {
      positionButton();
      
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
          setTimeout(positionButton, 100);
        });
      } else {
        setTimeout(positionButton, 100);
      }

      // Consolidated MutationObserver for positioning
      // Scope to product form area only to avoid interfering with stock alerts and other forms
      const positionObserver = new MutationObserver(function(mutations) {
        // Ignore mutations from stock alert forms or other unrelated forms
        let shouldProcess = false;
        mutations.forEach(function(mutation) {
          if (mutation.addedNodes.length > 0) {
            for (let node of mutation.addedNodes) {
              if (node.nodeType === 1) {
                // Skip if it's a stock alert form or notification
                if (node.matches && (
                  node.matches('[class*="stock"], [class*="alert"], [class*="notify"], [id*="stock"], [id*="alert"], [id*="notify"]') ||
                  node.querySelector('[class*="stock"], [class*="alert"], [class*="notify"], [id*="stock"], [id*="alert"], [id*="notify"]')
                )) {
                  return; // Skip this mutation
                }
                // Only process if it's related to product form or button area
                const productForm = node.closest ? node.closest('form[action*="/cart/add"], .product-form, .product-single, [class*="product"]') : null;
                if (productForm || node === button || button.contains(node) || node.contains(button)) {
                  shouldProcess = true;
                  break;
                }
              }
            }
          } else {
            shouldProcess = true; // Process attribute changes
          }
        });
        if (shouldProcess) {
          debouncedPosition();
        }
      });
      
      // Only observe product form area, not entire body
      const productForm = button.closest('form[action*="/cart/add"], .product-form, .product-single, [class*="product"]') || document.body;
      const observeTarget = productForm !== document.body ? productForm : button.parentElement || document.body;
      
      positionObserver.observe(observeTarget, {
        childList: true,
        subtree: observeTarget !== document.body, // Only use subtree if scoped to form area
        attributeFilter: ['class', 'id']
      });

      // Limited retry attempts
      let retryCount = 0;
      const maxRetries = 3;
      const positionChecker = setInterval(function() {
        retryCount++;
        if (button.dataset.positioningDisabled === 'true' || 
            button.dataset.manualPosition === 'true' ||
            retryCount > maxRetries ||
            button.dataset.validatedPosition === 'true') {
          clearInterval(positionChecker);
          positionObserver.disconnect();
          return;
        }
        if (!button.dataset.positioned || button.dataset.positioned !== 'true') {
          positionButton();
        } else {
          clearInterval(positionChecker);
          positionObserver.disconnect();
        }
      }, 1000);

      // Manual position detection
      const manualPositionObserver = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
          if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
            if (button.style.position || button.style.top || button.style.left) {
              button.dataset.manualPosition = 'true';
              button.dataset.positioningDisabled = 'true';
              positionObserver.disconnect();
              clearInterval(positionChecker);
            }
          }
        });
      });
      manualPositionObserver.observe(button, {
        attributes: true,
        attributeFilter: ['style', 'class']
      });

      // Cleanup
      window.addEventListener('beforeunload', function() {
        positionObserver.disconnect();
        manualPositionObserver.disconnect();
        clearInterval(positionChecker);
      });
    }

    // Consolidated MutationObserver for config changes
    const configObserver = new MutationObserver(function(mutations) {
      let shouldUpdate = false;
      mutations.forEach(function(mutation) {
        if (mutation.type === 'attributes') {
          const attrName = mutation.attributeName;
          if (attrName === 'data-button-style' || 
              attrName === 'data-show-icon' || 
              attrName === 'data-button-width-full' ||
              attrName === 'data-background-color' ||
              attrName === 'data-text-color' ||
              attrName === 'data-border-color' ||
              attrName === 'data-font-size' ||
              attrName === 'data-padding' ||
              attrName === 'data-border-radius' ||
              attrName === 'data-alignment' ||
              attrName === 'data-margin-top' ||
              attrName === 'data-margin-bottom' ||
              attrName === 'data-margin-left' ||
              attrName === 'data-margin-right' ||
              attrName === 'class') {
            shouldUpdate = true;
          }
        }
      });
      if (shouldUpdate) {
        debouncedApplyConfig();
      }
    });

    configObserver.observe(button, {
      attributes: true,
      attributeFilter: [
        'data-button-style', 'data-show-icon', 'data-button-width-full',
        'data-background-color', 'data-text-color', 'data-border-color',
        'data-font-size', 'data-padding', 'data-border-radius',
        'data-alignment', 'data-margin-top', 'data-margin-bottom',
        'data-margin-left', 'data-margin-right', 'class'
      ],
      subtree: true
    });

    // Cleanup
    window.addEventListener('beforeunload', function() {
      configObserver.disconnect();
    });

    // Widget interaction
    const productId = button.dataset.productId;
    const shopDomain = button.dataset.shopDomain || config.shopDomain || '';
    
    button.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      
      // Store original overflow state BEFORE try block to ensure it's accessible in catch
      let originalOverflow = '';
      let overlay = null;
      let closeHandler = null;
      let messageHandler = null;
      let unloadHandler = null;
      
      try {
        // Pre-flight checks before creating overlay
        if (!document.body) {
          throw new Error('Document body is not available. Page may still be loading.');
        }
        
        // Capture original overflow state before modifying
        originalOverflow = document.body.style.overflow || '';
        
        // Validate widget URL
        const baseWidgetUrl = config.widgetUrl || 'https://try-this-look.vercel.app';
        if (!baseWidgetUrl || typeof baseWidgetUrl !== 'string') {
          throw new Error('Invalid widget URL configuration');
        }
        
        // Validate product ID
        if (!productId || productId === 'undefined' || productId === 'null') {
          console.warn('NUSENSE: Product ID is missing or invalid:', productId);
          // Continue anyway - widget can work without product ID
        }
        
        // Build widget URL with query parameters
        const queryParams = new URLSearchParams();
        if (productId && productId !== 'undefined' && productId !== 'null') {
          queryParams.append('product_id', productId);
        }
        if (shopDomain) {
          queryParams.append('shop_domain', shopDomain);
        }
        const widgetUrl = baseWidgetUrl + '/widget' + (queryParams.toString() ? '?' + queryParams.toString() : '');
        
        // Log widget URL for debugging
        console.log('NUSENSE: Opening widget with URL:', widgetUrl);
        console.log('NUSENSE: Base widget URL:', baseWidgetUrl);
        console.log('NUSENSE: Product ID:', productId);
        console.log('NUSENSE: Shop domain:', shopDomain);
        
        // Test if widget URL is accessible (optional pre-flight check)
        // This helps catch CORS or network issues early
        try {
          fetch(widgetUrl, { method: 'HEAD', mode: 'no-cors' })
            .then(() => {
              console.log('NUSENSE: Widget URL is accessible');
            })
            .catch((fetchError) => {
              console.warn('NUSENSE: Widget URL pre-flight check failed (non-blocking):', fetchError);
              // Don't block - continue with iframe load attempt
            });
        } catch (fetchError) {
          // Ignore fetch errors - continue with iframe load
          console.warn('NUSENSE: Pre-flight check error (non-blocking):', fetchError);
        }
        
        // Create modal overlay with ARIA attributes
        overlay = document.createElement('div');
        overlay.id = 'nusense-widget-overlay-' + buttonId;
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-labelledby', 'nusense-widget-title-' + buttonId);
        overlay.className = 'nusense-widget-overlay';
        overlay.style.cssText = `
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.5);
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
        `;
        
        // Create container
        const container = document.createElement('div');
        container.className = 'nusense-widget-container';
        container.setAttribute('role', 'document');
        container.style.cssText = `
          position: relative;
          width: 95vw;
          max-width: 1200px;
          height: 90vh;
        `;
        
        // Store original body class (for potential theme compatibility)
        const originalBodyClass = document.body.className || '';
        
        // Close function with robust error handling
        const closeWidget = function() {
          // Clear load timeout if it exists
          if (loadTimeout) {
            clearTimeout(loadTimeout);
            loadTimeout = null;
          }
          
          try {
            // Remove overlay if it exists
            if (overlay && overlay.parentNode) {
              document.body.removeChild(overlay);
            }
          } catch (e) {
            // Silently handle removal errors
          }
          
          // Always restore overflow state, even if overlay removal failed
          try {
            // Restore original overflow state
            if (originalOverflow) {
              document.body.style.overflow = originalOverflow;
            } else {
              // Remove inline style to restore CSS default
              document.body.style.removeProperty('overflow');
            }
          } catch (e) {
            // Fallback: try to restore overflow even if there's an error
            try {
              document.body.style.overflow = '';
            } catch (e2) {
              // Last resort: remove overflow style attribute
              document.body.removeAttribute('style');
            }
          }
          
          // Clean up event listeners
          try {
            if (closeHandler) {
              document.removeEventListener('keydown', closeHandler);
            }
            if (messageHandler) {
              window.removeEventListener('message', messageHandler);
            }
            if (unloadHandler) {
              window.removeEventListener('beforeunload', unloadHandler);
            }
          } catch (e) {
            // Silently handle cleanup errors
          }
          
          // Return focus to button
          try {
            if (button && typeof button.focus === 'function') {
              button.focus();
            }
          } catch (e) {
            // Silently handle focus errors
          }
        };
        
        // Create iframe with ARIA
        const iframe = document.createElement('iframe');
        iframe.id = 'nusense-widget-iframe-' + buttonId;
        iframe.src = widgetUrl;
        iframe.setAttribute('title', 'NUSENSE Try-On Widget');
        iframe.setAttribute('aria-label', 'Virtual try-on widget');
        iframe.allow = 'camera; microphone';
        iframe.setAttribute('allowfullscreen', 'true');
        iframe.style.cssText = `
          width: 100%;
          height: 100%;
          border: none;
          border-radius: 0.25rem;
          background: white;
        `;
        
        // Add loading state indicator
        const loadingIndicator = document.createElement('div');
        loadingIndicator.id = 'nusense-loading-' + buttonId;
        loadingIndicator.style.cssText = `
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          text-align: center;
          color: #666;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          z-index: 1;
        `;
        loadingIndicator.innerHTML = `
          <div style="margin-bottom: 1rem; font-size: 1.1rem;">Loading widget...</div>
          <div style="width: 40px; height: 40px; border: 3px solid #f3f3f3; border-top: 3px solid #3498db; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto;"></div>
          <style>
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          </style>
        `;
        
        // Track iframe load state
        let iframeLoaded = false;
        let loadTimeout = null;
        const LOAD_TIMEOUT_MS = 30000; // 30 seconds timeout
        
        // Handle iframe load success
        iframe.onload = function() {
          iframeLoaded = true;
          if (loadTimeout) {
            clearTimeout(loadTimeout);
            loadTimeout = null;
          }
          // Remove loading indicator
          if (loadingIndicator.parentNode) {
            loadingIndicator.remove();
          }
          console.log('NUSENSE: Widget iframe loaded successfully');
        };
        
        // Handle iframe load error
        // Note: iframe.onerror doesn't always fire for network errors
        // We rely on the timeout mechanism as a fallback
        iframe.onerror = function(error) {
          console.error('NUSENSE: Widget iframe failed to load:', error);
          console.error('NUSENSE: Widget URL was:', widgetUrl);
          if (loadTimeout) {
            clearTimeout(loadTimeout);
            loadTimeout = null;
          }
          closeWidget();
          alert('Unable to open try-on widget. Please check your internet connection and try again.');
        };
        
        // Set timeout for iframe loading
        loadTimeout = setTimeout(function() {
          if (!iframeLoaded) {
            console.error('NUSENSE: Widget iframe load timeout after ' + LOAD_TIMEOUT_MS + 'ms');
            closeWidget();
            alert('Unable to open try-on widget. The widget took too long to load. Please try again.');
          }
        }, LOAD_TIMEOUT_MS);
        
        // Assemble modal
        container.appendChild(iframe);
        container.appendChild(loadingIndicator);
        overlay.appendChild(container);
        
        // Safely append overlay and set overflow
        try {
          // Ensure document.body exists
          if (!document.body) {
            throw new Error('Document body not available');
          }
          
          // Append overlay first
          document.body.appendChild(overlay);
          
          // Only set overflow if body doesn't already have overflow:hidden from another source
          // This prevents interfering with other modals/apps
          const currentOverflow = window.getComputedStyle(document.body).overflow;
          if (currentOverflow !== 'hidden') {
            document.body.style.overflow = 'hidden';
          }
          
          // Verify iframe was added successfully
          if (!iframe.parentNode) {
            throw new Error('Iframe was not added to container');
          }
          
          console.log('NUSENSE: Widget overlay created successfully, iframe loading...');
        } catch (e) {
          // If overlay can't be added, clean up and show error
          console.error('NUSENSE: Error creating widget overlay:', e);
          console.error('NUSENSE: Error details:', {
            hasBody: !!document.body,
            hasOverlay: !!overlay,
            hasIframe: !!iframe,
            widgetUrl: widgetUrl
          });
          
          // Clean up any partial DOM changes
          try {
            if (overlay && overlay.parentNode) {
              document.body.removeChild(overlay);
            }
          } catch (cleanupError) {
            // Ignore cleanup errors
          }
          
          // Restore overflow
          try {
            if (originalOverflow) {
              document.body.style.overflow = originalOverflow;
            } else {
              document.body.style.removeProperty('overflow');
            }
          } catch (restoreError) {
            // Ignore restore errors
          }
          
          alert('Unable to open try-on widget. Please try again later.');
          return;
        }
        
        // Close on escape key
        closeHandler = function(e) {
          if (e.key === 'Escape') {
            closeWidget();
            document.removeEventListener('keydown', closeHandler);
          }
        };
        document.addEventListener('keydown', closeHandler);
        
        // Close on overlay click
        overlay.addEventListener('click', function(e) {
          if (e.target === overlay) {
            closeWidget();
          }
        });
        
        // Listen for messages from iframe
        // Use scoped handler that only processes messages from this widget's iframe
        messageHandler = function(e) {
          // Only process NUSENSE messages to avoid interfering with other apps
          if (!e.data || !e.data.type || !e.data.type.startsWith('NUSENSE_')) {
            return; // Let other message handlers process this
          }
          
          // Verify message is from our iframe (security + scoping)
          try {
            if (e.source && e.source !== window && iframe && iframe.contentWindow === e.source) {
              if (e.data.type === 'NUSENSE_CLOSE_WIDGET') {
                closeWidget();
                // Cleanup is handled in closeWidget
                return;
              }
              
              if (e.data.type === 'NUSENSE_REQUEST_STORE_INFO') {
                const storeInfo = {
                  type: 'NUSENSE_STORE_INFO',
                  domain: window.location.hostname,
                  shopDomain: shopDomain,
                  origin: window.location.origin,
                  fullUrl: window.location.href
                };
                iframe.contentWindow.postMessage(storeInfo, '*');
                return;
              }
            }
          } catch (e) {
            // Silently handle errors (e.g., iframe closed, cross-origin issues)
            // Don't interfere with other apps' message handlers
          }
        };
        window.addEventListener('message', messageHandler);
        
        // Ensure cleanup on page unload (safety net)
        unloadHandler = function() {
          closeWidget();
        };
        window.addEventListener('beforeunload', unloadHandler);
        
        // Store cleanup function on overlay for potential external cleanup
        overlay._nusenseCleanup = closeWidget;
        
      } catch (e) {
        console.error('NUSENSE: Error opening widget:', e);
        // Ensure overflow is restored even if widget creation fails
        try {
          if (typeof originalOverflow !== 'undefined') {
            if (originalOverflow) {
              document.body.style.overflow = originalOverflow;
            } else {
              document.body.style.removeProperty('overflow');
            }
          }
        } catch (restoreError) {
          // Last resort cleanup
          try {
            document.body.style.overflow = '';
          } catch (e2) {
            // Silently fail - page will still function
          }
        }
        // Show user-friendly error
        alert('Unable to open try-on widget. Please try again later.');
      }
    });

    return {
      button: button,
      applyConfig: applyButtonConfig,
      position: positionButton
    };
  };

  // Initialize all buttons on page
  const initAllButtons = function() {
    const buttons = document.querySelectorAll('[id^="nusense-tryon-btn-"]');
    buttons.forEach(function(btn) {
      const buttonId = btn.id;
      const config = {
        buttonStyle: btn.dataset.buttonStyle || 'primary',
        buttonIcon: btn.dataset.buttonIcon || '✨',
        buttonBackgroundColor: btn.dataset.backgroundColor || '',
        buttonTextColor: btn.dataset.textColor || '',
        buttonBorderColor: btn.dataset.borderColor || '',
        buttonFontSize: btn.dataset.fontSize || '',
        buttonPadding: btn.dataset.padding || '',
        buttonBorderRadius: btn.dataset.borderRadius || '',
        buttonAlignment: btn.dataset.alignment || 'auto',
        marginTop: btn.dataset.marginTop || '0',
        marginBottom: btn.dataset.marginBottom || '0.75',
        marginLeft: btn.dataset.marginLeft || '0',
        marginRight: btn.dataset.marginRight || '0',
        customCss: '',
        widgetUrl: btn.dataset.widgetUrl || '',
        shopDomain: btn.dataset.shopDomain || ''
      };
      initButton(buttonId, config);
    });
  };

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAllButtons);
  } else {
    initAllButtons();
  }

  // Also initialize for dynamically added buttons
  // Scope observer to avoid interfering with stock alerts and other forms
  const globalObserver = new MutationObserver(function(mutations) {
    mutations.forEach(function(mutation) {
      if (mutation.addedNodes.length > 0) {
        mutation.addedNodes.forEach(function(node) {
          if (node.nodeType === 1) {
            // Skip stock alert forms and notifications to avoid interference
            if (node.matches && (
              node.matches('[class*="stock"], [class*="alert"], [class*="notify"], [id*="stock"], [id*="alert"], [id*="notify"]') ||
              node.querySelector('[class*="stock"], [class*="alert"], [class*="notify"], [id*="stock"], [id*="alert"], [id*="notify"]')
            )) {
              return; // Skip stock alert related nodes
            }
            
            if (node.id && node.id.startsWith('nusense-tryon-btn-')) {
              const config = {
                buttonStyle: node.dataset.buttonStyle || 'primary',
                buttonIcon: node.dataset.buttonIcon || '✨',
                buttonBackgroundColor: node.dataset.backgroundColor || '',
                buttonTextColor: node.dataset.textColor || '',
                buttonBorderColor: node.dataset.borderColor || '',
                buttonFontSize: node.dataset.fontSize || '',
                buttonPadding: node.dataset.padding || '',
                buttonBorderRadius: node.dataset.borderRadius || '',
                buttonAlignment: node.dataset.alignment || 'auto',
                marginTop: node.dataset.marginTop || '0',
                marginBottom: node.dataset.marginBottom || '0.75',
                marginLeft: node.dataset.marginLeft || '0',
                marginRight: node.dataset.marginRight || '0',
                customCss: '',
                widgetUrl: node.dataset.widgetUrl || '',
                shopDomain: node.dataset.shopDomain || ''
              };
              initButton(node.id, config);
            }
            // Check for nested buttons
            const nestedButtons = node.querySelectorAll && node.querySelectorAll('[id^="nusense-tryon-btn-"]');
            if (nestedButtons && nestedButtons.length > 0) {
              nestedButtons.forEach(function(nestedBtn) {
                const config = {
                  buttonStyle: nestedBtn.dataset.buttonStyle || 'primary',
                  buttonIcon: nestedBtn.dataset.buttonIcon || '✨',
                  buttonBackgroundColor: nestedBtn.dataset.backgroundColor || '',
                  buttonTextColor: nestedBtn.dataset.textColor || '',
                  buttonBorderColor: nestedBtn.dataset.borderColor || '',
                  buttonFontSize: nestedBtn.dataset.fontSize || '',
                  buttonPadding: nestedBtn.dataset.padding || '',
                  buttonBorderRadius: nestedBtn.dataset.borderRadius || '',
                  buttonAlignment: nestedBtn.dataset.alignment || 'auto',
                  marginTop: nestedBtn.dataset.marginTop || '0',
                  marginBottom: nestedBtn.dataset.marginBottom || '0.75',
                  marginLeft: nestedBtn.dataset.marginLeft || '0',
                  marginRight: nestedBtn.dataset.marginRight || '0',
                  customCss: '',
                  widgetUrl: nestedBtn.dataset.widgetUrl || '',
                  shopDomain: nestedBtn.dataset.shopDomain || ''
                };
                initButton(nestedBtn.id, config);
              });
            }
          }
        });
      }
    });
  });

  // Scope observer to product-related areas only
  // This prevents interference with stock alerts, checkout forms, and other apps
  const observeTarget = document.querySelector('form[action*="/cart/add"], .product-form, .product-single, [class*="product"], main, [role="main"]') || document.body;
  
  globalObserver.observe(observeTarget, {
    childList: true,
    subtree: observeTarget !== document.body // Only use subtree if not observing entire body
  });

})();

