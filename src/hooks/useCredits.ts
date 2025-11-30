import { useState, useEffect, useCallback } from "react";
import { useShop } from "@/providers/AppBridgeProvider";

interface CreditBalance {
  balance: number;
  included: number;
  used: number;
  isOverage: boolean;
  periodEnd: string | null;
  subscriptionLineItemId: string | null;
  canPurchase: boolean;
}

interface UseCreditsReturn {
  credits: CreditBalance | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Custom hook to manage credit balance
 */
export const useCredits = (): UseCreditsReturn => {
  const shop = useShop();

  const [credits, setCredits] = useState<CreditBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCredits = useCallback(async () => {
    if (!shop) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const appBridge = (window as any).__APP_BRIDGE;
      let fetchFn = fetch;
      let headers: HeadersInit = {
        "Content-Type": "application/json",
        Accept: "application/json",
      };

      if (appBridge) {
        try {
          const { authenticatedFetch } = await import("@shopify/app-bridge-utils");
          fetchFn = authenticatedFetch(appBridge);
        } catch (error) {
          try {
            const { getSessionToken } = await import("@shopify/app-bridge-utils");
            const token = await getSessionToken(appBridge);
            if (token) {
              headers = {
                ...headers,
                Authorization: `Bearer ${token}`,
              };
            }
          } catch (tokenError) {
            // Ignore
          }
        }
      }

      const response = await fetchFn(`/api/credits/balance?shop=${encodeURIComponent(shop)}`, {
        method: "GET",
        headers,
        credentials: "same-origin",
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch credits: ${response.statusText}`);
      }

      const data = await response.json();
      setCredits(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to fetch credits";
      setError(errorMessage);
      console.error("[useCredits] Error fetching credits:", err);
    } finally {
      setLoading(false);
    }
  }, [shop]);

  useEffect(() => {
    fetchCredits();
  }, [fetchCredits]);

  const refresh = useCallback(async () => {
    await fetchCredits();
  }, [fetchCredits]);

  return {
    credits,
    loading,
    error,
    refresh,
  };
};

