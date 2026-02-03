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

  return (
    <div className="w-full h-full min-h-screen">
      <VirtualTryOnModal customerInfo={customerInfo} />
    </div>
  );
}

