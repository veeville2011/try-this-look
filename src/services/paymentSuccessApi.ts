import { logError, logApiError } from "@/utils/errorHandler";
import { authenticatedFetch } from "@/utils/authenticatedFetch";

const API_ENDPOINT = "https://try-on-server-v1-aqjt.onrender.com/api/payment-success";

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

export interface PaymentSuccessResponse {
  status: "success" | "error";
  message?: string;
  error_message?: {
    code: string;
    message: string;
  };
}

/**
 * Call payment success API when user lands on payment success page
 */
export async function notifyPaymentSuccess(
  storeName?: string | null
): Promise<PaymentSuccessResponse> {
  const requestId = `payment-success-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const startTime = Date.now();

  try {
    console.log("[FRONTEND] [PAYMENT_SUCCESS] Starting notification", {
      requestId,
      storeName: storeName || "not provided",
      timestamp: new Date().toISOString(),
    });

    // Build URL with shop query parameter if storeName is provided
    let url = API_ENDPOINT;
    if (storeName) {
      const normalizedShop = normalizeShopDomain(storeName);
      const urlObj = new URL(API_ENDPOINT);
      urlObj.searchParams.set("shop", normalizedShop);
      url = urlObj.toString();
    }

    console.log("[FRONTEND] [PAYMENT_SUCCESS] Sending request", {
      requestId,
      endpoint: url,
      method: "POST",
      hasShop: !!storeName,
    });

    // Send request
    let response: Response;
    try {
      response = await authenticatedFetch(url, {
        method: "POST",
        headers: {
          "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
          "Content-Language": "fr",
        },
      });

      const requestDuration = Date.now() - startTime;
      console.log("[FRONTEND] [PAYMENT_SUCCESS] Response received", {
        requestId,
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        duration: `${requestDuration}ms`,
      });
    } catch (fetchError) {
      const duration = Date.now() - startTime;
      logError("[FRONTEND] [PAYMENT_SUCCESS] Fetch request failed", fetchError, {
        requestId,
        duration: `${duration}ms`,
      });
      return {
        status: "error",
        error_message: {
          code: "NETWORK_ERROR",
          message: "Une erreur de connexion s'est produite.",
        },
      };
    }

    // Handle error response
    if (!response.ok) {
      const errorDetails = await logApiError(
        "[FRONTEND] [PAYMENT_SUCCESS]",
        response,
        { requestId }
      );

      return {
        status: "error",
        error_message: {
          code: errorDetails.code || `HTTP_${response.status}`,
          message: errorDetails.message || "Une erreur s'est produite lors de la notification.",
        },
      };
    }

    // Parse successful response
    let data: PaymentSuccessResponse;
    try {
      const responseText = await response.text();
      if (!responseText) {
        // Empty response is acceptable for payment success notification
        const totalDuration = Date.now() - startTime;
        console.log("[FRONTEND] [PAYMENT_SUCCESS] Empty response (acceptable)", {
          requestId,
          duration: `${totalDuration}ms`,
        });
        return {
          status: "success",
        };
      }
      data = JSON.parse(responseText);

      const totalDuration = Date.now() - startTime;
      console.log("[FRONTEND] [PAYMENT_SUCCESS] Response parsed successfully", {
        requestId,
        status: data.status,
        hasError: !!data.error_message,
        duration: `${totalDuration}ms`,
      });

      return data;
    } catch (parseError) {
      logError("[FRONTEND] [PAYMENT_SUCCESS] Response parsing failed", parseError, {
        requestId,
        status: response.status,
      });
      return {
        status: "error",
        error_message: {
          code: "PARSE_ERROR",
          message: "Failed to parse server response",
        },
      };
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    logError("[FRONTEND] [PAYMENT_SUCCESS] Unexpected error", error, {
      requestId,
      duration: `${duration}ms`,
    });

    return {
      status: "error",
      error_message: {
        code: "UNKNOWN_ERROR",
        message: "Une erreur inattendue s'est produite.",
      },
    };
  }
}

