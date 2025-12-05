import { useState, useEffect, useCallback } from "react";
import { useShop } from "@/providers/AppBridgeProvider";
import { getCreditsBalance } from "@/services/billingApi";

export interface CreditType {
  credited: number;
  balance: number;
  used: number;
}

export interface CreditBalance {
  total_credited: number;
  total_used: number;
  total_balance: number;
  isOverage: boolean;
  periodEnd: string;
  subscriptionLineItemId: string;
  canPurchase: boolean;
  creditTypes: {
    trial: CreditType;
    coupon: CreditType;
    plan: CreditType;
    purchased: CreditType;
  };
  overage?: {
    type: string;
    balanceUsed: number;
    cappedAmount: number;
    remaining: number;
    currencyCode: string;
  };
  subscription: {
    interval: string;
    isMonthly: boolean;
    isAnnual: boolean;
    status: string;
  };
  // Legacy fields for backward compatibility
  balance?: number;
  included?: number;
  used?: number;
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

