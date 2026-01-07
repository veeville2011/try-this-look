import { useEffect, useState } from "react";
import TryOnWidget from "@/components/TryOnWidget";

interface CustomerInfo {
  id?: string | null;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}

export default function Widget() {
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);

  useEffect(() => {
    // Check if parent window told us it's desktop (for iframe scenarios)
    const urlParams = new URLSearchParams(window.location.search);
    const parentIsDesktop = urlParams.get("parentIsDesktop");
    
    if (parentIsDesktop === "true") {
      // Add class to document element to force desktop layout
      document.documentElement.classList.add("parent-desktop-mode");
      
      // Set CSS custom property to indicate desktop mode
      document.documentElement.style.setProperty("--parent-desktop", "1");
      
      // Inject CSS that forces desktop layout styles
      // This uses a media query at 900px (iframe width) instead of 1024px (Tailwind's lg breakpoint)
      const styleId = "parent-desktop-css-override";
      if (!document.getElementById(styleId)) {
        const style = document.createElement("style");
        style.id = styleId;
        style.textContent = `
          /* Force desktop layout styles when parent is desktop (iframe is 900px but parent says desktop) */
          /* Override Tailwind's lg: breakpoint by applying desktop styles unconditionally when parent-desktop-mode class is present */
          
          /* Force flex-row layout for elements with lg:flex-row */
          .parent-desktop-mode div[class*="flex-col"][class*="lg:flex-row"],
          .parent-desktop-mode div[class*="lg:flex-row"],
          .parent-desktop-mode section[class*="flex-col"][class*="lg:flex-row"],
          .parent-desktop-mode section[class*="lg:flex-row"] {
            flex-direction: row !important;
          }
          
          /* Force flex display for elements with lg:flex or lg:!flex (that are hidden on mobile) */
          .parent-desktop-mode div[class*="hidden"][class*="lg:flex"],
          .parent-desktop-mode div[class*="hidden"][class*="lg:!flex"],
          .parent-desktop-mode section[class*="hidden"][class*="lg:flex"],
          .parent-desktop-mode section[class*="hidden"][class*="lg:!flex"] {
            display: flex !important;
          }
          
          /* Force max-width for elements with lg:max-w-sm */
          .parent-desktop-mode div[class*="lg:max-w-sm"],
          .parent-desktop-mode [class*="w-full"][class*="lg:max-w-sm"] {
            max-width: 24rem !important;
          }
          
          /* Force padding/gap overrides */
          .parent-desktop-mode [class*="lg:py-0"] {
            padding-top: 0 !important;
            padding-bottom: 0 !important;
          }
          .parent-desktop-mode [class*="lg:gap-4"] {
            gap: 1rem !important;
          }
        `;
        document.head.appendChild(style);
      }
    } else {
      document.documentElement.classList.remove("parent-desktop-mode");
      document.documentElement.style.removeProperty("--parent-desktop");
    }

    // Extract customer information from URL parameters
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

  return (
    <div className="w-full h-auto mx-auto max-w-[900px]">
      <TryOnWidget customerInfo={customerInfo} />
    </div>
  );
}
