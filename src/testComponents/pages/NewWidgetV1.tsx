import { useEffect, useState } from "react";
import VirtualTryOnModalV1 from "@/testComponents/components/VirtualTryOnModalV1";
import { initializeTestProductData, isWidgetTestRoute, isLocalhost } from "@/testComponents/config/testProductDataV1";

interface CustomerInfo {
  id?: string | null;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}

export default function NewWidgetV1() {
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const isTestRoute = isWidgetTestRoute();

  useEffect(() => {
    // Extract customer information from URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const customerId = urlParams.get("customerId");
    const customerEmail = urlParams.get("customerEmail");
    const customerFirstName = urlParams.get("customerFirstName");
    const customerLastName = urlParams.get("customerLastName");
    const forceAuthGate = urlParams.get("forceAuthGate") === "true";

    // If forceAuthGate is true, don't set customerInfo (shows auth gate)
    if (forceAuthGate) {
      setCustomerInfo(null);
      return;
    }

    if (customerId || customerEmail) {
      setCustomerInfo({
        id: customerId || null,
        email: customerEmail ? decodeURIComponent(customerEmail) : null,
        firstName: customerFirstName ? decodeURIComponent(customerFirstName) : null,
        lastName: customerLastName ? decodeURIComponent(customerLastName) : null,
      });
    } else if (isTestRoute && !forceAuthGate) {
      // For /widget-test-v1 route, provide default test customer info so history works
      // This allows testing the complete flow including history without URL params
      // To test auth gate, add ?forceAuthGate=true to the URL (or omit customerId)
      // By default, auth gate shows unless customerId is provided
      const testCustomerId = urlParams.get("testCustomerId");
      if (testCustomerId) {
        setCustomerInfo({
          id: testCustomerId,
          email: 'avisihks@gmail.com',
          firstName: 'Test',
          lastName: 'Customer',
        });
      }
      // If no testCustomerId, customerInfo stays null and auth gate shows
    }
  }, [isTestRoute]);

  // Note: International Orange (#FF4F00) is now the default primary color in the design system
  // No manual override needed - the color is defined in src/index.css

  useEffect(() => {
    // Disable default scrolling on body and html for widget-test-v1 route
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

  // Initialize test product data for /widget-test-v1 route (only on localhost)
  useEffect(() => {
    if (isTestRoute && isLocalhost() && typeof window !== 'undefined') {
      const testData = initializeTestProductData();
      
      // Set product data in window for VirtualTryOnModalV1 to access
      (window as any).NUSENSE_PRODUCT_DATA = testData.productData;
      
      // Set product images in window for postMessage simulation
      (window as any).NUSENSE_TEST_PRODUCT_IMAGES = testData.productImages;
      
      // Set store info in window for VirtualTryOnModalV1 to access
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
      <VirtualTryOnModalV1 customerInfo={customerInfo} />
    </div>
  );
}

