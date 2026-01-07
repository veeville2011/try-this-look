import { logError, logApiError } from "@/utils/errorHandler";
import { authenticatedFetch } from "@/utils/authenticatedFetch";

const API_BASE_URL = "https://try-on-server-v1.onrender.com/api";

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

export interface SyncCreditsResponse {
  success: boolean;
  action: "initialized" | "plan_changed" | "renewed" | "cancellation" | "no_action";
  message: string;
  requestId: string;
  planHandle?: string;
  includedCredits?: number;
  oldPlanHandle?: string;
  newPlanHandle?: string;
  error?: string;
}

export interface CancelCreditsResponse {
  success: boolean;
  message: string;
  requestId: string;
  error?: string;
}

/**
 * Sync credits from subscription
 * Main endpoint for credit allocation. Fetches subscription from Shopify and syncs credits
 * based on the current subscription state. Handles initialization, plan changes, renewals, and cancellation detection automatically.
 * 
 * @param shop - Shop domain (e.g., "example.myshopify.com") or shop handle
 * @returns SyncCreditsResponse with action performed and details
 */
export async function syncCredits(
  shop: string
): Promise<SyncCreditsResponse> {
  const requestId = `credits-sync-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const startTime = Date.now();

  try {
    console.log("[FRONTEND] [CREDITS_SYNC] Starting credit sync", {
      requestId,
      shop: shop || "not provided",
      timestamp: new Date().toISOString(),
    });

    if (!shop) {
      return {
        success: false,
        action: "no_action",
        message: "Shop parameter is required",
        requestId,
        error: "Missing shop parameter",
      };
    }

    const normalizedShop = normalizeShopDomain(shop);
    const url = `${API_BASE_URL}/credits/sync?shop=${encodeURIComponent(normalizedShop)}`;

    console.log("[FRONTEND] [CREDITS_SYNC] Sending request", {
      requestId,
      endpoint: url,
      method: "POST",
      shop: normalizedShop,
    });

    // Send request
    let response: Response;
    try {
      response = await authenticatedFetch(url, {
        method: "POST",
        headers: {
          "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
        },
      });

      const requestDuration = Date.now() - startTime;
      console.log("[FRONTEND] [CREDITS_SYNC] Response received", {
        requestId,
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        duration: `${requestDuration}ms`,
      });
    } catch (fetchError) {
      const duration = Date.now() - startTime;
      logError("[FRONTEND] [CREDITS_SYNC] Fetch request failed", fetchError, {
        requestId,
        duration: `${duration}ms`,
      });
      return {
        success: false,
        action: "no_action",
        message: "Une erreur de connexion s'est produite.",
        requestId,
        error: "NETWORK_ERROR",
      };
    }

    // Handle error response
    if (!response.ok) {
      const errorDetails = await logApiError(
        "[FRONTEND] [CREDITS_SYNC]",
        response,
        { requestId }
      );

      return {
        success: false,
        action: "no_action",
        message: errorDetails.message || "Une erreur s'est produite lors de la synchronisation des crédits.",
        requestId,
        error: errorDetails.code || `HTTP_${response.status}`,
      };
    }

    // Parse successful response
    let data: SyncCreditsResponse;
    try {
      const responseText = await response.text();
      if (!responseText) {
        throw new Error("Empty response body");
      }
      data = JSON.parse(responseText);

      const totalDuration = Date.now() - startTime;
      console.log("[FRONTEND] [CREDITS_SYNC] Response parsed successfully", {
        requestId,
        success: data.success,
        action: data.action,
        duration: `${totalDuration}ms`,
      });

      return data;
    } catch (parseError) {
      logError("[FRONTEND] [CREDITS_SYNC] Response parsing failed", parseError, {
        requestId,
        status: response.status,
      });
      return {
        success: false,
        action: "no_action",
        message: "Failed to parse server response",
        requestId,
        error: "PARSE_ERROR",
      };
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    logError("[FRONTEND] [CREDITS_SYNC] Unexpected error", error, {
      requestId,
      duration: `${duration}ms`,
    });

    return {
      success: false,
      action: "no_action",
      message: "Une erreur inattendue s'est produite.",
      requestId,
      error: "UNKNOWN_ERROR",
    };
  }
}

/**
 * Cancel subscription credits
 * Explicitly handles subscription cancellation. Clears plan credits while preserving coupon and purchased credits.
 * 
 * @param shop - Shop domain (e.g., "example.myshopify.com") or shop handle
 * @returns CancelCreditsResponse with success status and message
 */
export async function cancelCredits(
  shop: string
): Promise<CancelCreditsResponse> {
  const requestId = `credits-cancel-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const startTime = Date.now();

  try {
    console.log("[FRONTEND] [CREDITS_CANCEL] Starting credit cancellation", {
      requestId,
      shop: shop || "not provided",
      timestamp: new Date().toISOString(),
    });

    if (!shop) {
      return {
        success: false,
        message: "Shop parameter is required",
        requestId,
        error: "Missing shop parameter",
      };
    }

    const normalizedShop = normalizeShopDomain(shop);
    const url = `${API_BASE_URL}/credits/cancel?shop=${encodeURIComponent(normalizedShop)}`;

    console.log("[FRONTEND] [CREDITS_CANCEL] Sending request", {
      requestId,
      endpoint: url,
      method: "POST",
      shop: normalizedShop,
    });

    // Send request
    let response: Response;
    try {
      response = await authenticatedFetch(url, {
        method: "POST",
        headers: {
          "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
        },
      });

      const requestDuration = Date.now() - startTime;
      console.log("[FRONTEND] [CREDITS_CANCEL] Response received", {
        requestId,
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        duration: `${requestDuration}ms`,
      });
    } catch (fetchError) {
      const duration = Date.now() - startTime;
      logError("[FRONTEND] [CREDITS_CANCEL] Fetch request failed", fetchError, {
        requestId,
        duration: `${duration}ms`,
      });
      return {
        success: false,
        message: "Une erreur de connexion s'est produite.",
        requestId,
        error: "NETWORK_ERROR",
      };
    }

    // Handle error response
    if (!response.ok) {
      const errorDetails = await logApiError(
        "[FRONTEND] [CREDITS_CANCEL]",
        response,
        { requestId }
      );

      return {
        success: false,
        message: errorDetails.message || "Une erreur s'est produite lors de l'annulation des crédits.",
        requestId,
        error: errorDetails.code || `HTTP_${response.status}`,
      };
    }

    // Parse successful response
    let data: CancelCreditsResponse;
    try {
      const responseText = await response.text();
      if (!responseText) {
        throw new Error("Empty response body");
      }
      data = JSON.parse(responseText);

      const totalDuration = Date.now() - startTime;
      console.log("[FRONTEND] [CREDITS_CANCEL] Response parsed successfully", {
        requestId,
        success: data.success,
        duration: `${totalDuration}ms`,
      });

      return data;
    } catch (parseError) {
      logError("[FRONTEND] [CREDITS_CANCEL] Response parsing failed", parseError, {
        requestId,
        status: response.status,
      });
      return {
        success: false,
        message: "Failed to parse server response",
        requestId,
        error: "PARSE_ERROR",
      };
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    logError("[FRONTEND] [CREDITS_CANCEL] Unexpected error", error, {
      requestId,
      duration: `${duration}ms`,
    });

    return {
      success: false,
      message: "Une erreur inattendue s'est produite.",
      requestId,
      error: "UNKNOWN_ERROR",
    };
  }
}

