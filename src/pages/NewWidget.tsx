import { useEffect, useState } from "react";
import VirtualTryOnModal from "@/components/VirtualTryOnModal";

interface CustomerInfo {
  id?: string | null;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}

export default function NewWidget() {
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);

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
    }
  }, []);

  useEffect(() => {
    // Override primary color to #FF4F00 for widget-test route only
    // HSL Conversion: #FF4F00 (RGB: 255, 79, 0) = hsl(19, 100%, 50%)
    // Calculation: H=19° (orange-red), S=100% (fully saturated), L=50% (medium lightness)
    const styleId = 'widget-test-primary-color-override';
    
    // Check if style already exists to prevent duplicates
    if (document.getElementById(styleId)) {
      return;
    }

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      :root {
        --primary: 19 100% 50%; /* #FF4F00 - Main primary color */
        --primary-foreground: 0 0% 100%; /* White text on primary */
        --ring: 19 100% 50%; /* #FF4F00 - Focus ring color */
        --primary-light: 19 100% 60%; /* Lighter variant for hover states */
        --primary-dark: 19 100% 40%; /* Darker variant for active states */
      }
      
      .dark {
        --primary: 19 100% 50%; /* #FF4F00 - Same primary color in dark theme */
        --primary-foreground: 0 0% 100%; /* White text on primary */
        --ring: 19 100% 50%; /* #FF4F00 - Focus ring color */
        --primary-light: 19 100% 60%; /* Lighter variant for dark theme */
        --primary-dark: 19 100% 40%; /* Darker variant for dark theme */
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

  return (
    <div className="w-full h-full min-h-screen overflow-hidden">
      <VirtualTryOnModal customerInfo={customerInfo} />
    </div>
  );
}

