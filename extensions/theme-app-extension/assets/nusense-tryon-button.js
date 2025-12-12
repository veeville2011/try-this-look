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

  // Color manipulation utilities
  const lightenColor = function(color, amount) {
    try {
      if (color.startsWith('#')) {
        const rgb = parseInt(color.slice(1), 16);
        const r = Math.min(255, ((rgb >> 16) & 0xff) + Math.round(255 * amount));
        const g = Math.min(255, ((rgb >> 8) & 0xff) + Math.round(255 * amount));
        const b = Math.min(255, (rgb & 0xff) + Math.round(255 * amount));
        return `rgb(${r}, ${g}, ${b})`;
      } else if (color.startsWith('rgb')) {
        const matches = color.match(/\d+/g);
        if (matches && matches.length >= 3) {
          const r = Math.min(255, parseInt(matches[0]) + Math.round(255 * amount));
          const g = Math.min(255, parseInt(matches[1]) + Math.round(255 * amount));
          const b = Math.min(255, parseInt(matches[2]) + Math.round(255 * amount));
          return `rgb(${r}, ${g}, ${b})`;
        }
      }
    } catch (e) {
      // Ignore errors
    }
    return color;
  };

  const darkenColor = function(color, amount) {
    try {
      if (color.startsWith('#')) {
        const rgb = parseInt(color.slice(1), 16);
        const r = Math.max(0, ((rgb >> 16) & 0xff) * (1 - amount));
        const g = Math.max(0, ((rgb >> 8) & 0xff) * (1 - amount));
        const b = Math.max(0, (rgb & 0xff) * (1 - amount));
        return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
      } else if (color.startsWith('rgb')) {
        const matches = color.match(/\d+/g);
        if (matches && matches.length >= 3) {
          const r = Math.max(0, parseInt(matches[0]) * (1 - amount));
          const g = Math.max(0, parseInt(matches[1]) * (1 - amount));
          const b = Math.max(0, parseInt(matches[2]) * (1 - amount));
          return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
        }
      }
    } catch (e) {
      // Ignore errors
    }
    return color;
  };

  // Initialize button instance
  const initButton = function(buttonId, config) {
    const button = document.getElementById(buttonId);
    if (!button) return null;

    // Cache DOM queries
    const cached = {
      button: button,
      iconSpan: null
    };

    // Initialize cached elements
    const updateCache = function() {
      cached.iconSpan = button.querySelector('.button__icon');
    };
    updateCache();

    // Helper function to validate a button candidate
    const validateButton = function(candidate) {
      if (!candidate) return false;
      if (candidate === button || candidate.classList.contains('nusense-tryon-button')) {
        return false;
      }
      if (candidate.tagName !== 'BUTTON' && candidate.tagName !== 'INPUT') {
        return false;
      }
      
      const computed = window.getComputedStyle(candidate);
      if (computed.display === 'none' || computed.visibility === 'hidden' || computed.opacity === '0') {
        return false;
      }
      
      return true;
    };

    // Function to find and get styling from Add to Cart button
    const findAddToCartButton = function() {
      const addToCartSelectors = [
        'form[action*="/cart/add"] button[name="add"]',
        'form[action*="/cart/add"] input[type="submit"][name="add"]',
        'form[action*="/cart/add"] button[type="submit"]',
        'button[name="add"]',
        'input[type="submit"][name="add"]',
        '[data-add-to-cart]',
        '.product-form__submit',
        '.product-form__cart-submit',
        '#AddToCart'
      ];
      
      for (let selector of addToCartSelectors) {
        try {
          const candidates = document.querySelectorAll(selector);
          for (let candidate of candidates) {
            if (!validateButton(candidate)) continue;
            
            // Verify it's in a product context
            const productForm = candidate.closest('form[action*="/cart/add"]');
            const productSection = candidate.closest('.product-form, .product-single, [class*="product"]');
            if (!productForm && !productSection) continue;
            
            return {
              element: candidate,
              computed: window.getComputedStyle(candidate),
              classes: candidate.className,
              type: 'add-to-cart'
            };
          }
        } catch (e) {
          continue;
        }
      }
      
      return null;
    };

    // Function to find Buy Now button
    const findBuyNowButton = function() {
      const buyNowSelectors = [
        'button[data-buy-now]',
        'button[data-checkout]',
        '.buy-now',
        '.buynow',
        '.checkout-button',
        '#BuyNow',
        'button[data-shopify="payment-button"]',
        '.shopify-payment-button button'
      ];
      
      for (let selector of buyNowSelectors) {
        try {
          const candidates = document.querySelectorAll(selector);
          for (let candidate of candidates) {
            if (!validateButton(candidate)) continue;
            
            // Verify it's in a product context
            const productForm = candidate.closest('form[action*="/cart/add"]');
            const productSection = candidate.closest('.product-form, .product-single, [class*="product"]');
            if (!productForm && !productSection) continue;
            
            return {
              element: candidate,
              computed: window.getComputedStyle(candidate),
              classes: candidate.className,
              type: 'buy-now'
            };
          }
        } catch (e) {
          continue;
        }
      }
      
      return null;
    };

    // Function to find any primary button in the theme
    const findPrimaryButton = function() {
      const primaryButtonSelectors = [
        '.button--primary',
        '.btn-primary',
        '.btn--primary',
        'button.button--primary',
        'button.btn-primary',
        '.product-form__submit',
        'button[type="submit"].button',
        'button[type="submit"].btn'
      ];
      
      for (let selector of primaryButtonSelectors) {
        try {
          const candidates = document.querySelectorAll(selector);
          for (let candidate of candidates) {
            if (!validateButton(candidate)) continue;
            
            // Check if it looks like a primary action button
            const computed = window.getComputedStyle(candidate);
            const bgColor = computed.getPropertyValue('background-color');
            const textColor = computed.getPropertyValue('color');
            
            // Must have visible background and text colors
            if (bgColor && bgColor !== 'rgba(0, 0, 0, 0)' && bgColor !== 'transparent' &&
                textColor && textColor !== 'rgba(0, 0, 0, 0)' && textColor !== 'transparent') {
              return {
                element: candidate,
                computed: computed,
                classes: candidate.className,
                type: 'primary'
              };
            }
          }
        } catch (e) {
          continue;
        }
      }
      
      return null;
    };

    // Function to find the best matching button (cascading fallback)
    const findBestMatchingButton = function() {
      // Priority 1: Add to Cart button
      const addToCartBtn = findAddToCartButton();
      if (addToCartBtn) return addToCartBtn;
      
      // Priority 2: Buy Now button
      const buyNowBtn = findBuyNowButton();
      if (buyNowBtn) return buyNowBtn;
      
      // Priority 3: Any primary button in theme
      const primaryBtn = findPrimaryButton();
      if (primaryBtn) return primaryBtn;
      
      // Priority 4: No button found - return null
      return null;
    };

    // Function to detect theme primary colors from CSS variables or matching buttons
    const detectThemeColors = function() {
      const themeColors = {
        primaryBg: null,
        primaryText: null,
        primaryBorder: null,
        primaryHoverBg: null,
        matchingButton: null
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
        
        // Method 2: Find best matching button (Add to Cart → Buy Now → Primary)
        const matchingBtn = findBestMatchingButton();
        if (matchingBtn) {
          themeColors.matchingButton = matchingBtn;
          const computed = matchingBtn.computed;
          
          // Get colors from the matching button (most accurate)
          const bgColor = computed.getPropertyValue('background-color');
          const textColor = computed.getPropertyValue('color');
          const borderColor = computed.getPropertyValue('border-color');
          
          if (bgColor && bgColor !== 'rgba(0, 0, 0, 0)' && bgColor !== 'transparent' && bgColor !== 'initial') {
            themeColors.primaryBg = bgColor.trim();
          }
          if (textColor && textColor !== 'rgba(0, 0, 0, 0)' && textColor !== 'transparent' && textColor !== 'initial') {
            themeColors.primaryText = textColor.trim();
          }
          if (borderColor && borderColor !== 'rgba(0, 0, 0, 0)' && borderColor !== 'transparent' && borderColor !== 'initial') {
            themeColors.primaryBorder = borderColor.trim();
          }
          
          // Get hover color from CSS variables or computed styles
          try {
            const hoverBg = computed.getPropertyValue('--button-hover-background') || 
                           computed.getPropertyValue('--color-button-hover') ||
                           rootStyles.getPropertyValue('--button-primary-hover');
            if (hoverBg && hoverBg.trim()) {
              themeColors.primaryHoverBg = hoverBg.trim();
            }
          } catch (e) {
            // Ignore
          }
        }
        
        // Method 3: Check body for accent colors (fallback)
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


    // Function to apply positioning and spacing (CSS only - no DOM manipulation)
    // Positioning is handled by the theme editor (admin side)
    const applyPositioning = function(alignment, top, bottom, left, right) {
      if (!button) return;
      
      // Apply margins (configured in admin)
      if (top && top !== '0') {
        button.style.marginTop = `${top}rem`;
      } else if (top === '0') {
        button.style.marginTop = '0';
      }
      
      if (bottom && bottom !== '0') {
        button.style.marginBottom = `${bottom}rem`;
      } else if (bottom === '0') {
        button.style.marginBottom = '0';
      }
      
      if (left && left !== '0') {
        button.style.marginLeft = `${left}rem`;
      } else if (left === '0') {
        button.style.marginLeft = '0';
      }
      
      if (right && right !== '0') {
        button.style.marginRight = `${right}rem`;
      } else if (right === '0') {
        button.style.marginRight = '0';
      }
      
      // Apply alignment (configured in admin)
      if (alignment && alignment !== 'auto') {
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
      }
      // Note: 'auto' alignment means no specific alignment - let theme handle it
    };

    // Function to apply all button configurations
    const applyButtonConfig = function() {
      if (!button) return;
      
      try {
        // Get settings from data attributes
        const buttonStyle = button.dataset.buttonStyle || config.buttonStyle || 'primary';
        const showIcon = button.dataset.showIcon === 'true' || button.dataset.showIcon === true;
        const buttonWidthFull = button.dataset.buttonWidthFull === 'true' || button.dataset.buttonWidthFull === true;
        
        // Get custom color/size settings - properly handle empty strings from Liquid
        // Use getAttribute to check if attribute exists, then check if it has a value
        const getDataAttribute = function(attrName, configKey, defaultValue) {
          const attrValue = button.getAttribute('data-' + attrName);
          if (attrValue !== null && attrValue !== undefined && attrValue.trim() !== '') {
            return attrValue.trim();
          }
          if (config && config[configKey] && config[configKey].toString().trim() !== '') {
            return config[configKey].toString().trim();
          }
          return defaultValue || '';
        };
        
        const customBgColor = getDataAttribute('background-color', 'buttonBackgroundColor', '');
        const customTextColor = getDataAttribute('text-color', 'buttonTextColor', '');
        const customBorderColor = getDataAttribute('border-color', 'buttonBorderColor', '');
        const customFontSize = getDataAttribute('font-size', 'buttonFontSize', '');
        const customPadding = getDataAttribute('padding', 'buttonPadding', '');
        const customBorderRadius = getDataAttribute('border-radius', 'buttonBorderRadius', '');
        const customCss = getDataAttribute('custom-css', 'customCss', '');
        
        // Build class list
        let classes = 'nusense-tryon-button';
        
        // ============================================
        // PRIORITY ORDER FOR BUTTON STYLING:
        // ============================================
        // 1. CUSTOM SETTINGS (HIGHEST PRIORITY)
        //    - Custom Background Color
        //    - Custom Text Color
        //    - Custom Border Color
        //    - Custom Font Size
        //    - Custom Padding
        //    - Custom Border Radius
        //    - Custom CSS
        //
        // 2. THEME-DETECTED VALUES (MEDIUM PRIORITY)
        //    - Colors/styles from matching theme buttons (Add to Cart, Buy Now, Primary)
        //    - Theme colors from CSS variables
        //
        // 3. DEFAULT VALUES (LOWEST PRIORITY)
        //    - Hardcoded defaults (#000000, #ffffff, etc.)
        // ============================================
        
        // Apply primary button styling
        if (buttonStyle === 'primary') {
          classes += ' button button--primary btn btn-primary';
          
          const themeColors = detectThemeColors();
          
          // Declare color variables in outer scope for hover effects
          let primaryBg, primaryText, primaryBorder;
          
          // STEP 1: Copy styles from matching theme button (if found)
          // Priority: Add to Cart → Buy Now → Primary Button
          // NOTE: Custom settings will override these copied styles below
          if (themeColors.matchingButton) {
            const matchingBtn = themeColors.matchingButton;
            const computed = matchingBtn.computed;
            
            // Copy all relevant styles from matching button (Add to Cart, Buy Now, or Primary)
            const stylesToCopy = [
              'font-family', 'font-size', 'font-weight', 'letter-spacing', 'text-transform',
              'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
              'border-radius', 'border', 'border-color', 'border-width', 'border-style',
              'box-shadow', 'transition', 'line-height', 'min-height', 'height'
            ];
            
            stylesToCopy.forEach(prop => {
              const value = computed.getPropertyValue(prop);
              if (value && value !== 'initial' && value !== 'normal' && value !== 'none' && value.trim() !== '') {
                button.style.setProperty(prop, value);
              }
            });
            
            // Copy classes from matching button (for theme compatibility)
            const matchingClasses = matchingBtn.classes.split(' ').filter(cls => 
              cls.trim() && 
              cls.length > 0 && 
              !cls.includes('disabled') && 
              !cls.includes('loading') &&
              !cls.includes('nusense') &&
              cls !== 'nusense-tryon-button'
            );
            
            if (matchingClasses.length > 0) {
              classes += ' ' + matchingClasses.join(' ');
            }
            
            // STEP 2: Apply colors with PRIORITY ORDER
            // Priority 1: Custom colors (HIGHEST)
            // Priority 2: Theme-detected colors from matching button
            // Priority 3: Theme colors from CSS variables
            // Priority 4: Defaults
            if (customBgColor) {
              primaryBg = customBgColor; // CUSTOM SETTING - HIGHEST PRIORITY
            } else {
              primaryBg = themeColors.primaryBg || computed.getPropertyValue('background-color') || '#000000';
            }
            
            if (customTextColor) {
              primaryText = customTextColor; // CUSTOM SETTING - HIGHEST PRIORITY
            } else {
              primaryText = themeColors.primaryText || computed.getPropertyValue('color') || '#ffffff';
            }
            
            if (customBorderColor) {
              primaryBorder = customBorderColor; // CUSTOM SETTING - HIGHEST PRIORITY
            } else {
              primaryBorder = themeColors.primaryBorder || computed.getPropertyValue('border-color') || primaryBg;
            }
            
            button.style.backgroundColor = primaryBg;
            button.style.color = primaryText;
            button.style.borderColor = primaryBorder;
            
            // STEP 3: Apply custom sizes (OVERRIDE copied styles)
            // Custom sizes ALWAYS override theme-detected sizes
            if (customFontSize) {
              button.style.fontSize = `${customFontSize}px`; // CUSTOM SETTING - HIGHEST PRIORITY
            }
            if (customPadding) {
              button.style.padding = `${customPadding}rem 1.5rem`; // CUSTOM SETTING - HIGHEST PRIORITY
            }
            if (customBorderRadius) {
              button.style.borderRadius = `${customBorderRadius}px`; // CUSTOM SETTING - HIGHEST PRIORITY
            }
          } else {
            // No matching button found (Add to Cart, Buy Now, or Primary)
            // Fallback to theme color palette from CSS variables, then defaults
            // This happens when:
            // 1. Page is not a product page
            // 2. Buttons haven't loaded yet
            // 3. Theme uses non-standard button structure
            // 4. Buttons are hidden or in a different context
            
            // Apply colors with PRIORITY ORDER
            // Priority 1: Custom colors (HIGHEST)
            // Priority 2: Theme colors from CSS variables
            // Priority 3: Defaults
            if (customBgColor) {
              primaryBg = customBgColor; // CUSTOM SETTING - HIGHEST PRIORITY
            } else {
              primaryBg = themeColors.primaryBg || '#000000';
            }
            
            if (customTextColor) {
              primaryText = customTextColor; // CUSTOM SETTING - HIGHEST PRIORITY
            } else {
              primaryText = themeColors.primaryText || '#ffffff';
            }
            
            if (customBorderColor) {
              primaryBorder = customBorderColor; // CUSTOM SETTING - HIGHEST PRIORITY
            } else {
              primaryBorder = themeColors.primaryBorder || primaryBg;
            }
            
            // Apply sizes with PRIORITY ORDER
            // Priority 1: Custom sizes (HIGHEST)
            // Priority 2: Defaults
            const fontSize = customFontSize ? `${customFontSize}px` : '1rem'; // CUSTOM SETTING - HIGHEST PRIORITY
            const padding = customPadding ? `${customPadding}rem 1.5rem` : '0.75rem 1.5rem'; // CUSTOM SETTING - HIGHEST PRIORITY
            const borderRadius = customBorderRadius ? `${customBorderRadius}px` : '4px'; // CUSTOM SETTING - HIGHEST PRIORITY
            
            button.style.backgroundColor = primaryBg;
            button.style.color = primaryText;
            button.style.border = `1px solid ${primaryBorder}`;
            button.style.borderRadius = borderRadius;
            button.style.padding = padding;
            button.style.fontSize = fontSize;
            button.style.fontWeight = '600';
            button.style.minHeight = '44px';
            button.style.transition = 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)';
            button.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06)';
            button.style.letterSpacing = '0.01em';
          }
          
          // Common styles for all primary buttons
          button.style.cursor = 'pointer';
          button.style.display = 'inline-flex';
          button.style.alignItems = 'center';
          button.style.justifyContent = 'center';
          button.style.userSelect = 'none';
          button.style.willChange = 'transform, box-shadow';
          
          // Smart hover effect (works for both Add to Cart found and not found cases)
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
          
          // Apply secondary button styling
          const themeColors = detectThemeColors();
          
          // Apply colors with PRIORITY ORDER
          // Priority 1: Custom colors (HIGHEST)
          // Priority 2: Theme colors (lightened primary)
          // Priority 3: Defaults
          let secondaryBg, secondaryText, secondaryBorder;
          
          if (customBgColor) {
            secondaryBg = customBgColor; // CUSTOM SETTING - HIGHEST PRIORITY
          } else {
            secondaryBg = themeColors.primaryBg ? lightenColor(themeColors.primaryBg, 0.2) : '#f5f5f5';
          }
          
          if (customTextColor) {
            secondaryText = customTextColor; // CUSTOM SETTING - HIGHEST PRIORITY
          } else {
            secondaryText = themeColors.primaryBg || '#000000';
          }
          
          if (customBorderColor) {
            secondaryBorder = customBorderColor; // CUSTOM SETTING - HIGHEST PRIORITY
          } else {
            secondaryBorder = themeColors.primaryBg || '#e0e0e0';
          }
          
          // Apply sizes with PRIORITY ORDER
          // Priority 1: Custom sizes (HIGHEST)
          // Priority 2: Defaults
          const fontSize = customFontSize ? `${customFontSize}px` : '1rem'; // CUSTOM SETTING - HIGHEST PRIORITY
          const padding = customPadding ? `${customPadding}rem 1.5rem` : '0.75rem 1.5rem'; // CUSTOM SETTING - HIGHEST PRIORITY
          const borderRadius = customBorderRadius ? `${customBorderRadius}px` : '4px'; // CUSTOM SETTING - HIGHEST PRIORITY
          
          button.style.backgroundColor = secondaryBg;
          button.style.color = secondaryText;
          button.style.border = `1px solid ${secondaryBorder}`;
          button.style.borderRadius = borderRadius;
          button.style.padding = padding;
          button.style.fontSize = fontSize;
          button.style.fontWeight = '600';
          button.style.minHeight = '44px';
          button.style.transition = 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)';
          button.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.05)';
          button.style.cursor = 'pointer';
          button.style.display = 'inline-flex';
          button.style.alignItems = 'center';
          button.style.justifyContent = 'center';
          button.style.userSelect = 'none';
          
          // Hover effect for secondary
          const originalSecondaryBg = secondaryBg;
          const hoverSecondaryBg = darkenColor(secondaryBg, 0.1);
          button.addEventListener('mouseenter', function() {
            this.style.backgroundColor = hoverSecondaryBg;
            this.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)';
          });
          button.addEventListener('mouseleave', function() {
            this.style.backgroundColor = originalSecondaryBg;
            this.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.05)';
          });
          
        } else if (buttonStyle === 'outline') {
          classes += ' button button--outline btn btn-outline';
          
          // Apply outline button styling
          const themeColors = detectThemeColors();
          
          // Apply colors with PRIORITY ORDER
          // Priority 1: Custom colors (HIGHEST)
          // Priority 2: Theme colors
          // Priority 3: Defaults
          let outlineBg = 'transparent';
          let outlineText, outlineBorder;
          
          if (customTextColor) {
            outlineText = customTextColor; // CUSTOM SETTING - HIGHEST PRIORITY
          } else {
            outlineText = themeColors.primaryBg || '#000000';
          }
          
          if (customBorderColor) {
            outlineBorder = customBorderColor; // CUSTOM SETTING - HIGHEST PRIORITY
          } else {
            outlineBorder = themeColors.primaryBg || '#000000';
          }
          
          // Apply sizes with PRIORITY ORDER
          // Priority 1: Custom sizes (HIGHEST)
          // Priority 2: Defaults
          const fontSize = customFontSize ? `${customFontSize}px` : '1rem'; // CUSTOM SETTING - HIGHEST PRIORITY
          const padding = customPadding ? `${customPadding}rem 1.5rem` : '0.75rem 1.5rem'; // CUSTOM SETTING - HIGHEST PRIORITY
          const borderRadius = customBorderRadius ? `${customBorderRadius}px` : '4px'; // CUSTOM SETTING - HIGHEST PRIORITY
          
          button.style.backgroundColor = outlineBg;
          button.style.color = outlineText;
          button.style.border = `2px solid ${outlineBorder}`;
          button.style.borderRadius = borderRadius;
          button.style.padding = padding;
          button.style.fontSize = fontSize;
          button.style.fontWeight = '600';
          button.style.minHeight = '44px';
          button.style.transition = 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)';
          button.style.boxShadow = 'none';
          button.style.cursor = 'pointer';
          button.style.display = 'inline-flex';
          button.style.alignItems = 'center';
          button.style.justifyContent = 'center';
          button.style.userSelect = 'none';
          
          // Hover effect for outline
          const hoverOutlineBg = outlineBorder;
          const hoverOutlineText = customTextColor ? customTextColor : '#ffffff';
          button.addEventListener('mouseenter', function() {
            this.style.backgroundColor = hoverOutlineBg;
            this.style.color = hoverOutlineText;
            this.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)';
          });
          button.addEventListener('mouseleave', function() {
            this.style.backgroundColor = outlineBg;
            this.style.color = outlineText;
            this.style.boxShadow = 'none';
          });
          
        } else if (buttonStyle === 'minimal') {
          classes += ' button button--tertiary btn btn-link';
          
          // Apply minimal button styling
          const themeColors = detectThemeColors();
          
          // Apply colors with PRIORITY ORDER
          // Priority 1: Custom colors (HIGHEST)
          // Priority 2: Theme colors
          // Priority 3: Defaults
          let minimalBg = 'transparent';
          let minimalText, minimalBorder = 'transparent';
          
          if (customTextColor) {
            minimalText = customTextColor; // CUSTOM SETTING - HIGHEST PRIORITY
          } else {
            minimalText = themeColors.primaryBg || '#000000';
          }
          
          // Apply sizes with PRIORITY ORDER
          // Priority 1: Custom sizes (HIGHEST)
          // Priority 2: Defaults
          const fontSize = customFontSize ? `${customFontSize}px` : '1rem'; // CUSTOM SETTING - HIGHEST PRIORITY
          const padding = customPadding ? `${customPadding}rem 1rem` : '0.5rem 1rem'; // CUSTOM SETTING - HIGHEST PRIORITY
          const borderRadius = customBorderRadius ? `${customBorderRadius}px` : '4px'; // CUSTOM SETTING - HIGHEST PRIORITY
          
          button.style.backgroundColor = minimalBg;
          button.style.color = minimalText;
          button.style.border = `1px solid ${minimalBorder}`;
          button.style.borderRadius = borderRadius;
          button.style.padding = padding;
          button.style.fontSize = fontSize;
          button.style.fontWeight = '500';
          button.style.minHeight = '44px';
          button.style.transition = 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)';
          button.style.boxShadow = 'none';
          button.style.textDecoration = 'none';
          button.style.cursor = 'pointer';
          button.style.display = 'inline-flex';
          button.style.alignItems = 'center';
          button.style.justifyContent = 'center';
          button.style.userSelect = 'none';
          
          // Hover effect for minimal
          const hoverMinimalBg = customBgColor ? lightenColor(customBgColor, 0.9) : 'rgba(0, 0, 0, 0.05)';
          button.addEventListener('mouseenter', function() {
            this.style.backgroundColor = hoverMinimalBg;
            this.style.textDecoration = 'underline';
          });
          button.addEventListener('mouseleave', function() {
            this.style.backgroundColor = minimalBg;
            this.style.textDecoration = 'none';
          });
        }
        
        // Apply custom sizes to ALL button styles (if not already applied above)
        if (buttonStyle !== 'primary' && buttonStyle !== 'secondary' && buttonStyle !== 'outline' && buttonStyle !== 'minimal') {
          if (customFontSize) {
            button.style.fontSize = `${customFontSize}px`;
          }
          if (customPadding) {
            button.style.padding = `${customPadding}rem 1.5rem`;
          }
          if (customBorderRadius) {
            button.style.borderRadius = `${customBorderRadius}px`;
          }
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
        
        // Apply custom CSS if provided - use scoped selector for better specificity
        if (customCss) {
          let existingStyle = document.getElementById('nusense-custom-css-' + buttonId);
          if (existingStyle) {
            existingStyle.remove();
          }
          
          const styleTag = document.createElement('style');
          styleTag.id = 'nusense-custom-css-' + buttonId;
          // Scope the CSS to this specific button for better specificity
          let scopedCss = customCss;
          // If CSS contains .nusense-tryon-button, scope it to this button ID
          if (scopedCss.includes('.nusense-tryon-button')) {
            scopedCss = scopedCss.replace(/\.nusense-tryon-button/g, `#${buttonId}.nusense-tryon-button`);
          } else {
            // If no selector is provided, wrap the CSS with the button ID selector
            scopedCss = `#${buttonId}.nusense-tryon-button { ${scopedCss} }`;
          }
          styleTag.textContent = scopedCss;
          document.head.appendChild(styleTag);
        }
        
        // Apply positioning
        applyPositioning(
          button.dataset.alignment || config.buttonAlignment || 'auto',
          button.dataset.marginTop || config.marginTop || '0',
          button.dataset.marginBottom || config.marginBottom || '0',
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

    // Debounced apply config function
    const debouncedApplyConfig = debounce(applyButtonConfig, 100);

    // Initialize with guard to prevent duplicate initialization
    let isInitialized = false;
    let initTimeout = null;
    
    const safeApplyConfig = function() {
      if (isInitialized && button.dataset.styled === 'true') {
        return; // Already initialized and styled
      }
      applyButtonConfig();
      isInitialized = true;
    };

    // Note: Button starts with data-loading="true" from Liquid template
    // applyButtonConfig() will set it to 'false' when complete
    
    // Apply immediately if DOM is ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function() {
        clearTimeout(initTimeout);
        initTimeout = setTimeout(safeApplyConfig, 100);
      }, { once: true });
    } else {
      initTimeout = setTimeout(safeApplyConfig, 100);
    }

    // Single retry for dynamic content (reduced from multiple timeouts)
    const retryTimeout = setTimeout(function() {
      if (!isInitialized || button.dataset.styled !== 'true') {
        safeApplyConfig();
      }
    }, 500);
    
    // Cleanup timeout on beforeunload
    window.addEventListener('beforeunload', function() {
      if (initTimeout) clearTimeout(initTimeout);
      if (retryTimeout) clearTimeout(retryTimeout);
    }, { once: true });

    // Note: Auto-positioning is handled by the theme editor (admin side)
    // The button position is determined by where the merchant places the app block in the theme editor

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
      
      // Store original overflow state BEFORE try block to ensure it's accessible in catch and closeWidget
      let originalOverflow = '';
      let wasAlreadyHidden = false;
      let overlay = null;
      let closeHandler = null;
      let messageHandler = null;
      let unloadHandler = null;
      
      try {
        // Pre-flight checks before creating overlay
        if (!document.body) {
          throw new Error('Document body is not available. Page may still be loading.');
        }
        
        // Capture original overflow state BEFORE any modifications
        // Check both inline style and computed style to handle CSS-based overflow:hidden
        const inlineOverflow = document.body.style.overflow || '';
        const computedOverflow = window.getComputedStyle(document.body).overflow;
        
        // Store the actual inline style value (empty string means no inline style)
        // This allows us to restore correctly: if there was no inline style, we remove it
        originalOverflow = inlineOverflow;
        
        // Track if overflow was already hidden (via CSS or inline style)
        wasAlreadyHidden = computedOverflow === 'hidden';
        
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
          // Only restore if WE set it (wasn't already hidden)
          try {
            if (!wasAlreadyHidden) {
              // We set overflow:hidden, so restore to original state
              if (originalOverflow) {
                document.body.style.overflow = originalOverflow;
              } else {
                // Remove inline style to restore CSS default (no inline style was set before)
                document.body.style.removeProperty('overflow');
              }
            }
            // If overflow was already hidden, don't touch it - let the other modal/app handle it
          } catch (e) {
            // Fallback: try to restore overflow even if there's an error
            // Only if we were the ones who set it
            if (!wasAlreadyHidden) {
              try {
                document.body.style.overflow = originalOverflow || '';
              } catch (e2) {
                // Last resort: only remove overflow if we set it
                try {
                  document.body.style.removeProperty('overflow');
                } catch (e3) {
                  // Silently fail - page will still function
                }
              }
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
          
          // Only set overflow:hidden if it's not already hidden
          // This prevents interfering with other modals/apps that may have already set it
          if (!wasAlreadyHidden) {
            document.body.style.overflow = 'hidden';
          }
          // If overflow was already hidden, we don't modify it - other modal will handle cleanup
          
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
      applyConfig: applyButtonConfig
    };
  };

  // Track initialized buttons to prevent duplicate initialization
  const initializedButtons = new Set();
  
  // Initialize all buttons on page
  const initAllButtons = function() {
    const buttons = document.querySelectorAll('[id^="nusense-tryon-btn-"]');
    buttons.forEach(function(btn) {
      const buttonId = btn.id;
      
      // Skip if already initialized
      if (initializedButtons.has(buttonId)) {
        return;
      }
      
      initializedButtons.add(buttonId);
      
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
        customCss: btn.dataset.customCss || '',
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
  // CRITICAL: Following Shopify best practices - ONLY watch for NUSENSE buttons
  // Completely avoid watching product forms or stock alerts to prevent interference
  let buttonObserver = null;
  
  function createButtonObserver() {
    if (buttonObserver) {
      return; // Already created
    }
    
    buttonObserver = new MutationObserver(function(mutations) {
      mutations.forEach(function(mutation) {
        if (mutation.addedNodes.length > 0) {
          mutation.addedNodes.forEach(function(node) {
            if (node.nodeType === 1) {
              // ONLY check for NUSENSE buttons - ignore everything else including stock alerts
              if (node.id && node.id.startsWith('nusense-tryon-btn-') && !initializedButtons.has(node.id)) {
                initializedButtons.add(node.id);
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
              // Check for nested NUSENSE buttons ONLY
              const nestedButtons = node.querySelectorAll && node.querySelectorAll('[id^="nusense-tryon-btn-"]');
              if (nestedButtons && nestedButtons.length > 0) {
                nestedButtons.forEach(function(nestedBtn) {
                  // Skip if already initialized
                  if (initializedButtons.has(nestedBtn.id)) {
                    return;
                  }
                  initializedButtons.add(nestedBtn.id);
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
  }

  // Setup observer ONLY on containers that have NUSENSE buttons
  // This completely avoids watching product forms or stock alerts
  function setupButtonObserver() {
    if (!document.body) {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setupButtonObserver, { once: true });
        return;
      } else {
        setTimeout(setupButtonObserver, 100);
        return;
      }
    }
    
    // Create observer if not already created
    createButtonObserver();
    
    // Find ONLY containers that already have NUSENSE buttons
    const nusenseButtons = document.querySelectorAll('[id^="nusense-tryon-btn-"]');
    
    if (nusenseButtons.length === 0) {
      // No NUSENSE buttons found - don't set up observer
      // This prevents watching the entire page and interfering with stock alerts
      return;
    }
    
    // Only observe the direct parent containers of NUSENSE buttons
    const containersToWatch = new Set();
    nusenseButtons.forEach(function(button) {
      const parent = button.parentElement;
      if (parent && parent !== document.body && parent !== document.documentElement) {
        containersToWatch.add(parent);
      }
    });
    
    // Observe only the specific containers that have our buttons
    containersToWatch.forEach(function(container) {
      try {
        buttonObserver.observe(container, {
          childList: true,
          subtree: false // Don't watch subtree - only direct children
        });
      } catch (error) {
        // Silently fail if observer setup fails
      }
    });
  }
  
  // Initialize observer when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupButtonObserver, { once: true });
  } else {
    setupButtonObserver();
  }

})();

