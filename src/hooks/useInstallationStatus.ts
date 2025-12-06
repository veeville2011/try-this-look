import { useState, useEffect, useCallback } from "react";
import { useShop, useAppBridge } from "@/providers/AppBridgeProvider";

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
  const appBridge = useAppBridge();

  const checkInstallation = useCallback(async () => {
    if (!shop) {
      setStatus({ isInstalled: false, loading: false, error: "Shop not available" });
      return;
    }

    setStatus(prev => ({ ...prev, loading: true, error: null }));

    try {
      let fetchFn: typeof fetch;
      
      if (appBridge) {
        // Use authenticated fetch if App Bridge is available
        const { authenticatedFetch } = await import("@shopify/app-bridge-utils");
        fetchFn = authenticatedFetch(appBridge);
      } else {
        // Fallback to regular fetch
        fetchFn = fetch;
      }

      const response = await fetchFn(`/api/installation/check?shop=${encodeURIComponent(shop)}`);
      
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
  }, [shop, appBridge]);

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

