/**
 * Referral API Service
 * 
 * Centralized service for all referral API calls
 * Uses remote server as per integration.md
 */

import { logError, logApiError } from "@/utils/errorHandler";

/**
 * Get the API base URL from environment variable
 */
const getApiBaseUrl = (): string => {
  const apiUrl = import.meta.env.VITE_API_ENDPOINT;
  
  if (!apiUrl) {
    throw new Error(
      "VITE_API_ENDPOINT environment variable is required. " +
      "Please set it in your .env file or environment configuration."
    );
  }
  
  // Remove trailing slash if present
  return apiUrl.replace(/\/$/, "");
};

/**
 * Get authenticated fetch function
 */
const getAuthenticatedFetch = async (): Promise<typeof fetch> => {
  const appBridge = (window as any).__APP_BRIDGE;
  
  if (appBridge) {
    try {
      // Dynamic import - module exists at runtime
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore - Dynamic import type checking
      const appBridgeUtils = await import("@shopify/app-bridge-utils");
      const { authenticatedFetch } = appBridgeUtils as any;
      if (authenticatedFetch) {
        return authenticatedFetch(appBridge);
      }
    } catch (error) {
      // Fallback to regular fetch with token
      try {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore - Dynamic import type checking
        const appBridgeUtils = await import("@shopify/app-bridge-utils");
        const { getSessionToken } = appBridgeUtils as any;
        if (getSessionToken) {
          const token = await getSessionToken(appBridge);
          if (token) {
            return async (url: string | Request | URL, init?: RequestInit) => {
              return fetch(url, {
                ...init,
                headers: {
                  ...init?.headers,
                  Authorization: `Bearer ${token}`,
                },
              });
            };
          }
        }
      } catch (tokenError) {
        // Ignore
      }
    }
  }
  
  return fetch;
};

/**
 * Normalize shop domain
 */
const normalizeShopDomain = (shop: string): string => {
  if (!shop) return "";
  let normalized = shop.trim().toLowerCase();
  normalized = normalized.replace(/^https?:\/\//, "");
  if (!normalized.includes(".myshopify.com")) {
    normalized = `${normalized}.myshopify.com`;
  }
  return normalized;
};

export interface ReferralCodeResponse {
  success: boolean;
  referralCode: string;
  isActive: boolean;
  createdAt: string;
  requestId: string;
  error?: string;
  message?: string;
}

export interface ValidateReferralResponse {
  success: boolean;
  message: string;
  referralId: number;
  status: string;
  requestId: string;
  error?: string;
}

export interface AwardReferralResponse {
  success: boolean;
  message: string;
  creditsAwarded: boolean;
  referrerCredits?: number;
  referredCredits?: number;
  requestId: string;
  error?: string;
}

export interface ReferralStatsResponse {
  success: boolean;
  stats: {
    hasReferralCode: boolean;
    referralCode: string | null;
    isActive?: boolean;
    totalReferrals: number;
    completedReferrals: number;
    pendingReferrals: number;
    totalCreditsEarned: number;
  };
  requestId: string;
  error?: string;
  message?: string;
}

/**
 * Get or Create Referral Code
 * GET /api/referrals/code?shop={shop}
 */
export const getReferralCode = async (
  shop: string
): Promise<ReferralCodeResponse> => {
  const requestId = `referral-code-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const startTime = Date.now();

  try {
    console.log("[FRONTEND] [REFERRAL_CODE] Starting referral code fetch", {
      requestId,
      shop: shop || "not provided",
      timestamp: new Date().toISOString(),
    });

    if (!shop) {
      return {
        success: false,
        referralCode: "",
        isActive: false,
        createdAt: "",
        requestId,
        error: "Missing shop parameter",
        message: "Shop parameter is required",
      };
    }

    const normalizedShop = normalizeShopDomain(shop);
    const baseUrl = getApiBaseUrl();
    const url = `${baseUrl}/api/referrals/code?shop=${encodeURIComponent(normalizedShop)}`;

    console.log("[FRONTEND] [REFERRAL_CODE] Sending request", {
      requestId,
      endpoint: url,
      method: "GET",
      shop: normalizedShop,
    });

    const fetchFn = await getAuthenticatedFetch();

    let response: Response;
    try {
      response = await fetchFn(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        credentials: "same-origin",
      });

      const requestDuration = Date.now() - startTime;
      console.log("[FRONTEND] [REFERRAL_CODE] Response received", {
        requestId,
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        duration: `${requestDuration}ms`,
      });
    } catch (fetchError) {
      const duration = Date.now() - startTime;
      logError("[FRONTEND] [REFERRAL_CODE] Fetch request failed", fetchError, {
        requestId,
        duration: `${duration}ms`,
      });
      return {
        success: false,
        referralCode: "",
        isActive: false,
        createdAt: "",
        requestId,
        error: "NETWORK_ERROR",
        message: "Network error occurred",
      };
    }

    if (!response.ok) {
      const errorDetails = await logApiError(
        "[FRONTEND] [REFERRAL_CODE]",
        response,
        { requestId }
      );

      return {
        success: false,
        referralCode: "",
        isActive: false,
        createdAt: "",
        requestId,
        error: errorDetails.code || `HTTP_${response.status}`,
        message: errorDetails.message || "Failed to get referral code",
      };
    }

    let data: ReferralCodeResponse;
    try {
      data = await response.json();

      const totalDuration = Date.now() - startTime;
      console.log("[FRONTEND] [REFERRAL_CODE] Response parsed successfully", {
        requestId,
        success: data.success,
        referralCode: data.referralCode,
        duration: `${totalDuration}ms`,
      });

      return data;
    } catch (parseError) {
      logError("[FRONTEND] [REFERRAL_CODE] Response parsing failed", parseError, {
        requestId,
        status: response.status,
      });
      return {
        success: false,
        referralCode: "",
        isActive: false,
        createdAt: "",
        requestId,
        error: "PARSE_ERROR",
        message: "Failed to parse server response",
      };
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    logError("[FRONTEND] [REFERRAL_CODE] Unexpected error", error, {
      requestId,
      duration: `${duration}ms`,
    });

    return {
      success: false,
      referralCode: "",
      isActive: false,
      createdAt: "",
      requestId,
      error: "UNKNOWN_ERROR",
      message: "An unexpected error occurred",
    };
  }
};

/**
 * Validate Referral Code
 * POST /api/referrals/validate
 */
export const validateReferralCode = async (
  referralCode: string,
  shopDomain: string
): Promise<ValidateReferralResponse> => {
  const requestId = `referral-validate-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const startTime = Date.now();

  try {
    console.log("[FRONTEND] [REFERRAL_VALIDATE] Starting referral code validation", {
      requestId,
      referralCode: referralCode || "not provided",
      shopDomain: shopDomain || "not provided",
      timestamp: new Date().toISOString(),
    });

    if (!referralCode) {
      return {
        success: false,
        message: "Referral code is required",
        referralId: 0,
        status: "error",
        requestId,
        error: "Missing referral code",
      };
    }

    if (!shopDomain) {
      return {
        success: false,
        message: "Shop domain is required",
        referralId: 0,
        status: "error",
        requestId,
        error: "Missing shop domain",
      };
    }

    const normalizedShopDomain = normalizeShopDomain(shopDomain);
    const baseUrl = getApiBaseUrl();
    const url = `${baseUrl}/api/referrals/validate`;

    console.log("[FRONTEND] [REFERRAL_VALIDATE] Sending request", {
      requestId,
      endpoint: url,
      method: "POST",
      referralCode: referralCode.trim().toUpperCase(),
      shopDomain: normalizedShopDomain,
    });

    const fetchFn = await getAuthenticatedFetch();

    let response: Response;
    try {
      response = await fetchFn(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          referralCode: referralCode.trim().toUpperCase(),
          shopDomain: normalizedShopDomain,
        }),
        credentials: "same-origin",
      });

      const requestDuration = Date.now() - startTime;
      console.log("[FRONTEND] [REFERRAL_VALIDATE] Response received", {
        requestId,
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        duration: `${requestDuration}ms`,
      });
    } catch (fetchError) {
      const duration = Date.now() - startTime;
      logError("[FRONTEND] [REFERRAL_VALIDATE] Fetch request failed", fetchError, {
        requestId,
        duration: `${duration}ms`,
      });
      return {
        success: false,
        message: "Network error occurred",
        referralId: 0,
        status: "error",
        requestId,
        error: "NETWORK_ERROR",
      };
    }

    if (!response.ok) {
      const errorDetails = await logApiError(
        "[FRONTEND] [REFERRAL_VALIDATE]",
        response,
        { requestId }
      );

      return {
        success: false,
        message: errorDetails.message || "Failed to validate referral code",
        referralId: 0,
        status: "error",
        requestId,
        error: errorDetails.code || `HTTP_${response.status}`,
      };
    }

    let data: ValidateReferralResponse;
    try {
      data = await response.json();

      const totalDuration = Date.now() - startTime;
      console.log("[FRONTEND] [REFERRAL_VALIDATE] Response parsed successfully", {
        requestId,
        success: data.success,
        referralId: data.referralId,
        status: data.status,
        duration: `${totalDuration}ms`,
      });

      return data;
    } catch (parseError) {
      logError("[FRONTEND] [REFERRAL_VALIDATE] Response parsing failed", parseError, {
        requestId,
        status: response.status,
      });
      return {
        success: false,
        message: "Failed to parse server response",
        referralId: 0,
        status: "error",
        requestId,
        error: "PARSE_ERROR",
      };
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    logError("[FRONTEND] [REFERRAL_VALIDATE] Unexpected error", error, {
      requestId,
      duration: `${duration}ms`,
    });

    return {
      success: false,
      message: "An unexpected error occurred",
      referralId: 0,
      status: "error",
      requestId,
      error: "UNKNOWN_ERROR",
    };
  }
};

/**
 * Award Referral Credits
 * POST /api/referrals/award?shop={shop}
 */
export const awardReferralCredits = async (
  shop: string
): Promise<AwardReferralResponse> => {
  const requestId = `referral-award-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const startTime = Date.now();

  try {
    console.log("[FRONTEND] [REFERRAL_AWARD] Starting referral credit award", {
      requestId,
      shop: shop || "not provided",
      timestamp: new Date().toISOString(),
    });

    if (!shop) {
      return {
        success: false,
        message: "Shop parameter is required",
        creditsAwarded: false,
        requestId,
        error: "Missing shop parameter",
      };
    }

    const normalizedShop = normalizeShopDomain(shop);
    const baseUrl = getApiBaseUrl();
    const url = `${baseUrl}/api/referrals/award?shop=${encodeURIComponent(normalizedShop)}`;

    console.log("[FRONTEND] [REFERRAL_AWARD] Sending request", {
      requestId,
      endpoint: url,
      method: "POST",
      shop: normalizedShop,
    });

    const fetchFn = await getAuthenticatedFetch();

    let response: Response;
    try {
      response = await fetchFn(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        credentials: "same-origin",
      });

      const requestDuration = Date.now() - startTime;
      console.log("[FRONTEND] [REFERRAL_AWARD] Response received", {
        requestId,
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        duration: `${requestDuration}ms`,
      });
    } catch (fetchError) {
      const duration = Date.now() - startTime;
      logError("[FRONTEND] [REFERRAL_AWARD] Fetch request failed", fetchError, {
        requestId,
        duration: `${duration}ms`,
      });
      return {
        success: false,
        message: "Network error occurred",
        creditsAwarded: false,
        requestId,
        error: "NETWORK_ERROR",
      };
    }

    if (!response.ok) {
      const errorDetails = await logApiError(
        "[FRONTEND] [REFERRAL_AWARD]",
        response,
        { requestId }
      );

      return {
        success: false,
        message: errorDetails.message || "Failed to award referral credits",
        creditsAwarded: false,
        requestId,
        error: errorDetails.code || `HTTP_${response.status}`,
      };
    }

    let data: AwardReferralResponse;
    try {
      data = await response.json();

      const totalDuration = Date.now() - startTime;
      console.log("[FRONTEND] [REFERRAL_AWARD] Response parsed successfully", {
        requestId,
        success: data.success,
        creditsAwarded: data.creditsAwarded,
        duration: `${totalDuration}ms`,
      });

      return data;
    } catch (parseError) {
      logError("[FRONTEND] [REFERRAL_AWARD] Response parsing failed", parseError, {
        requestId,
        status: response.status,
      });
      return {
        success: false,
        message: "Failed to parse server response",
        creditsAwarded: false,
        requestId,
        error: "PARSE_ERROR",
      };
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    logError("[FRONTEND] [REFERRAL_AWARD] Unexpected error", error, {
      requestId,
      duration: `${duration}ms`,
    });

    return {
      success: false,
      message: "An unexpected error occurred",
      creditsAwarded: false,
      requestId,
      error: "UNKNOWN_ERROR",
    };
  }
};

/**
 * Get Referral Statistics
 * GET /api/referrals/stats?shop={shop}
 */
export const getReferralStats = async (
  shop: string
): Promise<ReferralStatsResponse> => {
  const requestId = `referral-stats-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const startTime = Date.now();

  try {
    console.log("[FRONTEND] [REFERRAL_STATS] Starting referral stats fetch", {
      requestId,
      shop: shop || "not provided",
      timestamp: new Date().toISOString(),
    });

    if (!shop) {
      return {
        success: false,
        stats: {
          hasReferralCode: false,
          referralCode: null,
          totalReferrals: 0,
          completedReferrals: 0,
          pendingReferrals: 0,
          totalCreditsEarned: 0,
        },
        requestId,
        error: "Missing shop parameter",
        message: "Shop parameter is required",
      };
    }

    const normalizedShop = normalizeShopDomain(shop);
    const baseUrl = getApiBaseUrl();
    const url = `${baseUrl}/api/referrals/stats?shop=${encodeURIComponent(normalizedShop)}`;

    console.log("[FRONTEND] [REFERRAL_STATS] Sending request", {
      requestId,
      endpoint: url,
      method: "GET",
      shop: normalizedShop,
    });

    const fetchFn = await getAuthenticatedFetch();

    let response: Response;
    try {
      response = await fetchFn(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        credentials: "same-origin",
      });

      const requestDuration = Date.now() - startTime;
      console.log("[FRONTEND] [REFERRAL_STATS] Response received", {
        requestId,
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        duration: `${requestDuration}ms`,
      });
    } catch (fetchError) {
      const duration = Date.now() - startTime;
      logError("[FRONTEND] [REFERRAL_STATS] Fetch request failed", fetchError, {
        requestId,
        duration: `${duration}ms`,
      });
      return {
        success: false,
        stats: {
          hasReferralCode: false,
          referralCode: null,
          totalReferrals: 0,
          completedReferrals: 0,
          pendingReferrals: 0,
          totalCreditsEarned: 0,
        },
        requestId,
        error: "NETWORK_ERROR",
        message: "Network error occurred",
      };
    }

    if (!response.ok) {
      const errorDetails = await logApiError(
        "[FRONTEND] [REFERRAL_STATS]",
        response,
        { requestId }
      );

      return {
        success: false,
        stats: {
          hasReferralCode: false,
          referralCode: null,
          totalReferrals: 0,
          completedReferrals: 0,
          pendingReferrals: 0,
          totalCreditsEarned: 0,
        },
        requestId,
        error: errorDetails.code || `HTTP_${response.status}`,
        message: errorDetails.message || "Failed to get referral statistics",
      };
    }

    let data: ReferralStatsResponse;
    try {
      data = await response.json();

      const totalDuration = Date.now() - startTime;
      console.log("[FRONTEND] [REFERRAL_STATS] Response parsed successfully", {
        requestId,
        success: data.success,
        hasReferralCode: data.stats?.hasReferralCode,
        totalReferrals: data.stats?.totalReferrals,
        duration: `${totalDuration}ms`,
      });

      return data;
    } catch (parseError) {
      logError("[FRONTEND] [REFERRAL_STATS] Response parsing failed", parseError, {
        requestId,
        status: response.status,
      });
      return {
        success: false,
        stats: {
          hasReferralCode: false,
          referralCode: null,
          totalReferrals: 0,
          completedReferrals: 0,
          pendingReferrals: 0,
          totalCreditsEarned: 0,
        },
        requestId,
        error: "PARSE_ERROR",
        message: "Failed to parse server response",
      };
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    logError("[FRONTEND] [REFERRAL_STATS] Unexpected error", error, {
      requestId,
      duration: `${duration}ms`,
    });

    return {
      success: false,
      stats: {
        hasReferralCode: false,
        referralCode: null,
        totalReferrals: 0,
        completedReferrals: 0,
        pendingReferrals: 0,
        totalCreditsEarned: 0,
      },
      requestId,
      error: "UNKNOWN_ERROR",
      message: "An unexpected error occurred",
    };
  }
};

