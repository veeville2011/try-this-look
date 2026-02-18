import { useEffect, useState } from "react";
import VirtualTryOnModalV1 from "@/testComponents/components/VirtualTryOnModalV1";
import { initializeTestProductData, isWidgetTestRoute, isLocalhost } from "@/testComponents/config/testProductDataV1";
import { 
  getSessionId, 
  startSession, 
  identifySession, 
  setVendorApiKey,
  initializeSessionId 
} from "@/testComponents/services/tryonApiV1";

interface CustomerInfo {
  id?: string | null;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}

export default function NewWidgetV1() {
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const isTestRoute = isWidgetTestRoute();

  // Initialize session management on mount
  useEffect(() => {
    const initializeSession = async () => {
      try {
        // Initialize session ID from storage if available
        initializeSessionId();

        // Get or generate session ID
        const sessionId = await getSessionId();

        // Set vendor API key (should be configured from server-side or environment)
        // For now, try to get from window config or use a default
        const vendorKey = 
          (typeof window !== 'undefined' && (window as any).NUSENSE_CONFIG?.vendorApiKey) ||
          import.meta.env.VITE_VENDOR_API_KEY ||
          null;
        
        if (vendorKey) {
          setVendorApiKey(vendorKey);
        }

        // Start session with referrer and landing page info
        await startSession({
          session_id: sessionId,
          referrer: document.referrer || undefined,
          landing_page: window.location.href,
        });

        console.log('[NewWidgetV1] Session initialized:', sessionId);
      } catch (error) {
        console.error('[NewWidgetV1] Failed to initialize session:', error);
        // Continue even if session initialization fails (graceful degradation)
      }
    };

    initializeSession();
  }, []);

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

    const handleCustomerInfo = async () => {
      if (customerId || customerEmail) {
        const info = {
          id: customerId || null,
          email: customerEmail ? decodeURIComponent(customerEmail) : null,
          firstName: customerFirstName ? decodeURIComponent(customerFirstName) : null,
          lastName: customerLastName ? decodeURIComponent(customerLastName) : null,
        };
        
        setCustomerInfo(info);

        // Link session to authenticated customer if email is available
        if (info.email) {
          try {
            const sessionId = await getSessionId();
            await identifySession({
              session_id: sessionId,
              email: info.email,
              auth_provider: 'shopify_email', // Default to shopify_email, can be customized
              first_name: info.firstName || undefined,
              last_name: info.lastName || undefined,
            });
            console.log('[NewWidgetV1] Session identified for customer:', info.email);
          } catch (error) {
            console.error('[NewWidgetV1] Failed to identify session:', error);
            // Continue even if identification fails
          }
        }
      } else if (isTestRoute && !forceAuthGate) {
        // For /widget-test-v1 route, provide default test customer info so history works
        // This allows testing the complete flow including history without URL params
        // To test auth gate, add ?forceAuthGate=true to the URL (or omit customerId)
        // By default, auth gate shows unless customerId is provided
        const testCustomerId = urlParams.get("testCustomerId");
        if (testCustomerId) {
          const testInfo = {
            id: testCustomerId,
            email: 'avisihks@gmail.com',
            firstName: 'Test',
            lastName: 'Customer',
          };
          
          setCustomerInfo(testInfo);

          // Link session to test customer
          try {
            const sessionId = await getSessionId();
            await identifySession({
              session_id: sessionId,
              email: testInfo.email,
              auth_provider: 'shopify_email',
              first_name: testInfo.firstName,
              last_name: testInfo.lastName,
            });
            console.log('[NewWidgetV1] Session identified for test customer');
          } catch (error) {
            console.error('[NewWidgetV1] Failed to identify test session:', error);
            // Continue even if identification fails
          }
        }
        // If no testCustomerId, customerInfo stays null and auth gate shows
      }
    };

    handleCustomerInfo();
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

