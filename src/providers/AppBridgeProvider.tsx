import { useEffect, useState, useRef } from "react";
import { AppProvider, useAppBridge } from "@shopify/app-bridge-react";
import { getSessionToken } from "@shopify/app-bridge-utils";
import type { AppBridgeConfig } from "@shopify/app-bridge";

interface AppBridgeProviderProps {
  children: React.ReactNode;
}

/**
 * App Bridge Provider for embedded Shopify apps
 * Handles authentication and provides App Bridge context
 */
export const AppBridgeProvider = ({ children }: AppBridgeProviderProps) => {
  const [config, setConfig] = useState<AppBridgeConfig | null>(null);
  const [loading, setLoading] = useState(true);

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
      setConfig({
        apiKey,
        host,
        forceRedirect: true,
      });
    } else {
      // If not in embedded context, try to get from localStorage or use defaults
      const storedShop = localStorage.getItem("shop");
      const storedHost = localStorage.getItem("host");

      if (storedShop && storedHost) {
        setConfig({
          apiKey,
          host: storedHost,
          forceRedirect: true,
        });
      } else {
        // Fallback for development or standalone mode
        // Only log in development
        if (import.meta.env.DEV) {
          console.warn(
            "[AppBridge] Missing shop or host parameters. App may not work correctly in embedded mode."
          );
        }
      }
    }

    setLoading(false);
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

  if (!config) {
    // If no config, render children without App Bridge (for development/standalone)
    // This should only happen in development or if shop/host params are missing
    return <>{children}</>;
  }

  return (
    <AppProvider config={config}>
      {children}
    </AppProvider>
  );
};

/**
 * Internal component to handle session token retrieval
 * Must be inside AppProvider context
 */
const SessionTokenProvider = ({
  onTokenReady,
}: {
  onTokenReady: (token: string | null) => void;
}) => {
  const app = useAppBridge();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const fetchToken = async () => {
      try {
        const token = await getSessionToken(app);
        onTokenReady(token);
      } catch (error) {
        // Token might not be available yet, try again
        if (import.meta.env.DEV) {
          console.warn("[AppBridge] Session token not available yet:", error);
        }
        onTokenReady(null);
      }
    };

    // Initial fetch
    fetchToken();

    // Set up interval to refresh token periodically (every 5 minutes)
    intervalRef.current = setInterval(fetchToken, 5 * 60 * 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [app, onTokenReady]);

  return null;
};

/**
 * Hook to get session token for authenticated API requests
 * Note: This must be used inside AppBridgeProvider (which provides AppProvider context)
 */
export const useSessionToken = () => {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  
  // useAppBridge must be called unconditionally (React hooks rule)
  // It will throw if not in AppProvider context, which is expected
  let app: ReturnType<typeof useAppBridge> | null = null;
  try {
    app = useAppBridge();
  } catch (error) {
    // Not in AppProvider context - this is okay for non-embedded mode
    app = null;
  }

  useEffect(() => {
    const fetchToken = async () => {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const host = urlParams.get("host");

        if (!host) {
          // Not in embedded context
          setLoading(false);
          return;
        }

        if (!app) {
          // App Bridge not initialized yet, wait and try again
          await new Promise((resolve) => setTimeout(resolve, 500));
          setLoading(false);
          return;
        }

        // App Bridge is ready, get token
        try {
          const sessionToken = await getSessionToken(app);
          setToken(sessionToken);
        } catch (error) {
          // Token might not be available yet
          if (import.meta.env.DEV) {
            console.warn("[AppBridge] Session token not available yet:", error);
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

    // Set up interval to refresh token periodically (only if app is available)
    if (app) {
      const interval = setInterval(async () => {
        try {
          const sessionToken = await getSessionToken(app!);
          setToken(sessionToken);
        } catch (error) {
          // Ignore errors during refresh
        }
      }, 5 * 60 * 1000); // Refresh every 5 minutes

      return () => clearInterval(interval);
    }
  }, [app]);

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

