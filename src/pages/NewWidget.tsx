import { useEffect, useState } from "react";
import VirtualTryOnModal from "@/components/VirtualTryOnModal";
import { initializeTestProductData, isWidgetTestRoute, isLocalhost } from "@/config/testProductData";

interface CustomerInfo {
  id?: string | null;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}

export default function NewWidget() {
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const isTestRoute = isWidgetTestRoute();

  useEffect(() => {
    // Extract customer information from URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const customerId = urlParams.get("customerId");
    const customerEmail = urlParams.get("customerEmail");
    const customerFirstName = urlParams.get("customerFirstName");
    const customerLastName = urlParams.get("customerLastName");

    if (customerId || customerEmail) {
      setCustomerInfo({
        id: customerId || null,
        email: customerEmail ? decodeURIComponent(customerEmail) : null,
        firstName: customerFirstName ? decodeURIComponent(customerFirstName) : null,
        lastName: customerLastName ? decodeURIComponent(customerLastName) : null,
      });
    } else if (isTestRoute) {
      // For /widget-test route, provide default test customer info so history works
      // This allows testing the complete flow including history without URL params
      setCustomerInfo({
        id: 'test-customer-123',
        email: 'avisihks@gmail.com',
        firstName: 'Test',
        lastName: 'Customer',
      });
    }
  }, [isTestRoute]);

  useEffect(() => {
    // Override primary color to International Orange #FF4F00 for widget-test route only
    // HSL Conversion: #FF4F00 (RGB: 255, 79, 0) = hsl(19, 100%, 50%)
    // International Orange color palette with related shades
    const styleId = 'widget-test-primary-color-override';
    
    // Check if style already exists to prevent duplicates
    if (document.getElementById(styleId)) {
      return;
    }

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      :root {
        /* International Orange Primary Colors */
        --primary: 19 100% 50%; /* #FF4F00 - Main primary color */
        --primary-foreground: 0 0% 100%; /* White text on primary */
        --ring: 19 100% 50%; /* #FF4F00 - Focus ring color */
        
        /* Related Shades - Lighter variants */
        --primary-light: 19 100% 60%; /* #FF7F33 - Lighter for hover states */
        --primary-lighter: 19 100% 70%; /* #FF9F66 - Even lighter for subtle backgrounds */
        --primary-lightest: 19 50% 90%; /* #FFE5D9 - Very light tint for backgrounds */
        
        /* Related Shades - Darker variants */
        --primary-dark: 19 100% 40%; /* #CC3F00 - Darker for active/pressed states */
        --primary-darker: 19 100% 30%; /* #992F00 - Even darker for emphasis */
        
        /* Muted/Saturated variants */
        --primary-muted: 19 80% 50%; /* Less saturated variant */
        --primary-saturated: 19 100% 50%; /* Fully saturated (same as primary) */
      }
      
      .dark {
        /* International Orange Primary Colors for Dark Theme */
        --primary: 19 100% 55%; /* Slightly lighter for dark theme visibility */
        --primary-foreground: 0 0% 100%; /* White text on primary */
        --ring: 19 100% 55%; /* Focus ring color */
        
        /* Related Shades - Lighter variants for dark theme */
        --primary-light: 19 100% 65%; /* Lighter for hover states */
        --primary-lighter: 19 100% 75%; /* Even lighter */
        --primary-lightest: 19 30% 20%; /* Dark theme background tint */
        
        /* Related Shades - Darker variants for dark theme */
        --primary-dark: 19 100% 45%; /* Darker for active states */
        --primary-darker: 19 100% 35%; /* Even darker */
        
        /* Muted/Saturated variants */
        --primary-muted: 19 80% 55%; /* Less saturated variant */
        --primary-saturated: 19 100% 55%; /* Fully saturated */
      }
      
      /* Widget-specific color utilities */
      .widget-primary {
        color: hsl(var(--primary));
      }
      
      .widget-primary-bg {
        background-color: hsl(var(--primary));
      }
      
      .widget-primary-border {
        border-color: hsl(var(--primary));
      }
      
      .widget-primary-hover:hover {
        background-color: hsl(var(--primary-dark));
      }
      
      .widget-primary-text {
        color: hsl(var(--primary));
      }
      
      .widget-primary-text-light {
        color: hsl(var(--primary-light));
      }
      
      .widget-primary-text-muted {
        color: hsl(var(--primary-muted));
      }
    `;
    document.head.appendChild(style);

    // Cleanup on unmount to prevent style leakage to other routes
    return () => {
      const existingStyle = document.getElementById(styleId);
      if (existingStyle) {
        existingStyle.remove();
      }
    };
  }, []);

  useEffect(() => {
    // Disable default scrolling on body and html for widget-test route
    const originalBodyOverflow = document.body.style.overflow;
    const originalHtmlOverflow = document.documentElement.style.overflow;
    
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    // Cleanup on unmount to restore scrolling
    return () => {
      document.body.style.overflow = originalBodyOverflow;
      document.documentElement.style.overflow = originalHtmlOverflow;
    };
  }, []);

  // Initialize test product data for /widget-test route (only on localhost)
  useEffect(() => {
    if (isTestRoute && isLocalhost() && typeof window !== 'undefined') {
      const testData = initializeTestProductData();
      
      // Set product data in window for VirtualTryOnModal to access
      (window as any).NUSENSE_PRODUCT_DATA = testData.productData;
      
      // Set product images in window for postMessage simulation
      (window as any).NUSENSE_TEST_PRODUCT_IMAGES = testData.productImages;
      
      // Set store info in window for VirtualTryOnModal to access
      (window as any).NUSENSE_TEST_STORE_INFO = testData.storeInfo;
      
      // Simulate postMessage event to inject product data
      // This mimics how the widget receives data from parent Shopify page
      setTimeout(() => {
        // Simulate product data message
        window.dispatchEvent(new MessageEvent('message', {
          data: {
            type: 'NUSENSE_PRODUCT_DATA',
            productData: testData.productData
          },
          origin: window.location.origin
        }));
        
        // Simulate product images message
        window.dispatchEvent(new MessageEvent('message', {
          data: {
            type: 'NUSENSE_PRODUCT_IMAGES',
            images: testData.productImages
          },
          origin: window.location.origin
        }));
        
        // Simulate store info message
        window.dispatchEvent(new MessageEvent('message', {
          data: {
            type: 'NUSENSE_STORE_INFO',
            domain: testData.storeInfo.domain,
            fullUrl: `https://${testData.storeInfo.domain}`,
            shopDomain: testData.storeInfo.shop,
            origin: window.location.origin
          },
          origin: window.location.origin
        }));
      }, 100);
    }
  }, [isTestRoute]);

  return (
    <div className="w-full h-full min-h-screen overflow-hidden">
      <VirtualTryOnModal customerInfo={customerInfo} />
    </div>
  );
}

