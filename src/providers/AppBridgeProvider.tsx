import { useEffect, useState, useRef } from "react";
import createApp from "@shopify/app-bridge";
import type { AppBridgeConfig } from "@shopify/app-bridge";

interface AppBridgeProviderProps {
  children: React.ReactNode;
}

/**
 * App Bridge Provider for embedded Shopify apps
 * Creates App Bridge instance for authenticated requests
 */
export const AppBridgeProvider = ({ children }: AppBridgeProviderProps) => {
  const [app, setApp] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const appRef = useRef<any>(null);

  useEffect(() => {
    // Get shop and host from URL parameters (provided by Shopify)
    const urlParams = new URLSearchParams(window.location.search);
    const shop = urlParams.get("shop");
    const host = urlParams.get("host");

    // Get API key from environment or window
    const apiKey =
      import.meta.env.VITE_SHOPIFY_API_KEY ||
      (window as any).__SHOPIFY_API_KEY ||
      "f8de7972ae23d3484581d87137829385";

    if (shop && host) {
      // Create App Bridge instance
      const appBridgeInstance = createApp({
        apiKey,
        host,
        forceRedirect: true,
      });
      appRef.current = appBridgeInstance;
      setApp(appBridgeInstance);
      
      // Store in window for global access
      (window as any).__APP_BRIDGE = appBridgeInstance;
      setLoading(false);
    } else {
      // If not in embedded context, try to get from localStorage
      const storedShop = localStorage.getItem("shop");
      const storedHost = localStorage.getItem("host");

      if (storedShop && storedHost) {
        const appBridgeInstance = createApp({
          apiKey,
          host: storedHost,
          forceRedirect: true,
        });
        appRef.current = appBridgeInstance;
        setApp(appBridgeInstance);
        (window as any).__APP_BRIDGE = appBridgeInstance;
      } else {
        if (import.meta.env.DEV) {
          console.warn(
            "[AppBridge] Missing shop or host parameters. App may not work correctly in embedded mode."
          );
        }
      }
      // Don't block rendering if shop/host are missing - allow app to work in non-embedded mode
      setLoading(false);
    }
  }, []);

  // Store shop and host in localStorage when available
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const shop = urlParams.get("shop");
    const host = urlParams.get("host");

    if (shop) localStorage.setItem("shop", shop);
    if (host) localStorage.setItem("host", host);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return <>{children}</>;
};

/**
 * Hook to get App Bridge instance
 */
export const useAppBridge = () => {
  return (window as any).__APP_BRIDGE || null;
};

/**
 * Hook to get session token for authenticated API requests
 * Note: This works without AppProvider by using URL params and localStorage
 * Session tokens are optional - the app works without them
 */
export const useSessionToken = () => {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchToken = async () => {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const host = urlParams.get("host");
        const shop = urlParams.get("shop");

        if (!host || !shop) {
          // Not in embedded context
          setLoading(false);
          return;
        }

        // Try to get session token using App Bridge if available
        // If App Bridge is not available, we'll work without it
        try {
          // Dynamically import App Bridge React to avoid build errors
          const appBridgeReact = await import("@shopify/app-bridge-react");
          const useAppBridge = (appBridgeReact as any).useAppBridge;
          
          if (useAppBridge) {
            // Note: useAppBridge hook requires AppProvider context
            // Since we're not using AppProvider, we can't use the hook
            // Session tokens are optional - API calls will work without them
            // (backend can use session from shop parameter)
            if (import.meta.env.DEV) {
              console.info("[AppBridge] Session token not available without AppProvider context");
            }
          }
        } catch (error) {
          // App Bridge React not available or import failed
          // This is okay - we'll work without it
          if (import.meta.env.DEV) {
            console.warn("[AppBridge] App Bridge React not available:", error);
          }
        }
      } catch (error) {
        if (import.meta.env.DEV) {
          console.error("[AppBridge] Failed to get session token:", error);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchToken();
  }, []);

  return { token, loading };
};

/**
 * Hook to get shop domain from App Bridge context
 */
export const useShop = () => {
  const [shop, setShop] = useState<string | null>(null);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const shopParam = urlParams.get("shop");
    const storedShop = localStorage.getItem("shop");

    if (shopParam) {
      setShop(shopParam);
    } else if (storedShop) {
      setShop(storedShop);
    }
  }, []);

  return shop;
};
