import { useEffect, useState } from "react";
import { useShop } from "@/providers/AppBridgeProvider";

interface UseStoreInstallReturn {
  installing: boolean;
  installed: boolean;
  error: string | null;
  install: () => Promise<void>;
}

/**
 * Hook to install/store shop information on remote server
 * Called from frontend after app loads
 * Backend retrieves access token from session storage and calls remote API
 */
export const useStoreInstall = (): UseStoreInstallReturn => {
  const shop = useShop();
  const [installing, setInstalling] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const install = async () => {
    // Get shop domain from App Bridge hook or URL params (fallback)
    const shopDomain =
      shop || new URLSearchParams(window.location.search).get("shop");

    if (!shopDomain) {
      const errorMsg = "Shop parameter is required";
      setError(errorMsg);
      console.error("[STORE_INSTALL] Missing shop parameter");
      return;
    }

    // Normalize shop domain
    const normalizedShop = shopDomain.includes(".myshopify.com")
      ? shopDomain.toLowerCase()
      : `${shopDomain.toLowerCase()}.myshopify.com`;

    // Check if already installed (stored in localStorage)
    const storageKey = `store_installed_${normalizedShop}`;
    const alreadyInstalled = localStorage.getItem(storageKey) === "true";

    if (alreadyInstalled) {
      setInstalled(true);
      console.log("[STORE_INSTALL] Store already marked as installed", {
        shop: normalizedShop,
      });
      return;
    }

    setInstalling(true);
    setError(null);

    try {
      console.log("[STORE_INSTALL] Calling backend API to install store", {
        shop: normalizedShop,
      });

      // Call backend endpoint which will retrieve access token and call remote API
      const response = await fetch("/api/stores/install-from-frontend", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          shop: normalizedShop,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setInstalled(true);
        // Mark as installed in localStorage
        localStorage.setItem(storageKey, "true");
        console.log("[STORE_INSTALL] Store installation successful", {
          shop: normalizedShop,
          savedAt: data.savedAt,
        });
      } else {
        const errorMsg = data.message || "Failed to install store";
        setError(errorMsg);
        console.error("[STORE_INSTALL] Store installation failed", {
          shop: normalizedShop,
          error: errorMsg,
          response: data,
        });
      }
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : "Failed to install store";
      setError(errorMsg);
      console.error("[STORE_INSTALL] Store installation error", {
        shop: normalizedShop,
        error: err,
      });
    } finally {
      setInstalling(false);
    }
  };

  // Auto-install when shop is available (only once)
  useEffect(() => {
    if (shop && !installed && !installing) {
      // Small delay to ensure app is fully loaded
      const timer = setTimeout(() => {
        install();
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [shop]); // Only depend on shop, not installed/installing to avoid loops

  return {
    installing,
    installed,
    error,
    install,
  };
};

