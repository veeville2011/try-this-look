import { useState, useEffect, useCallback } from "react";
import { useShop } from "@/providers/AppBridgeProvider";
import { getCreditsBalance } from "@/services/billingApi";

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

      // Use remote API service
      const data = await getCreditsBalance(shop);
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

