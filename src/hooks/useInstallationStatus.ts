import { useState, useEffect, useCallback } from "react";
import { useShop } from "@/providers/AppBridgeProvider";

interface InstallationStatus {
  isInstalled: boolean;
  loading: boolean;
  error: string | null;
}

/**
 * Hook to check if app blocks are installed in the theme
 */
export const useInstallationStatus = () => {
  const [status, setStatus] = useState<InstallationStatus>({
    isInstalled: false,
    loading: true,
    error: null,
  });
  const shop = useShop();

  const checkInstallation = useCallback(async () => {
    if (!shop) {
      setStatus({ isInstalled: false, loading: false, error: "Shop not available" });
      return;
    }

    setStatus(prev => ({ ...prev, loading: true, error: null }));

    try {
      const { authenticatedFetch } = await import("@shopify/app-bridge");
      const fetch = authenticatedFetch();

      const response = await fetch(`/api/installation/check?shop=${encodeURIComponent(shop)}`);
      
      if (!response.ok) {
        throw new Error(`Failed to check installation: ${response.statusText}`);
      }

      const data = await response.json();
      setStatus({
        isInstalled: data.isInstalled || false,
        loading: false,
        error: null,
      });
    } catch (error) {
      console.error("[useInstallationStatus] Error checking installation:", error);
      setStatus({
        isInstalled: false,
        loading: false,
        error: error instanceof Error ? error.message : "Failed to check installation",
      });
    }
  }, [shop]);

  useEffect(() => {
    checkInstallation();
    
    // Poll every 30 seconds to check for updates
    const interval = setInterval(checkInstallation, 30000);
    
    return () => clearInterval(interval);
  }, [checkInstallation]);

  return {
    ...status,
    refresh: checkInstallation,
  };
};

