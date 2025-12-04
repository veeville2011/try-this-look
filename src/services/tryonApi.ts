import { TryOnResponse } from "@/types/tryon";
import { logError, logApiError } from "@/utils/errorHandler";

const API_ENDPOINT = "https://try-on-server-v1.onrender.com/api/fashion-photo";
const HEALTH_ENDPOINT = "https://try-on-server-v1.onrender.com/api/health";

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

export async function generateTryOn(
  personImage: File | Blob,
  clothingImage: Blob,
  storeName?: string | null,
  clothingKey?: string | null,
  personKey?: string | null
): Promise<TryOnResponse> {
  const requestId = `tryon-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const startTime = Date.now();
  
  try {
    console.log("[FRONTEND] [TRYON] Starting generation", {
      requestId,
      hasPersonImage: !!personImage,
      hasClothingImage: !!clothingImage,
      storeName: storeName || "not provided",
      clothingKey: clothingKey || "not provided",
      personKey: personKey || "not provided",
      timestamp: new Date().toISOString(),
    });

    // Prepare FormData
    let formData: FormData;
    try {
      formData = new FormData();
      formData.append("personImage", personImage);
      formData.append("clothingImage", clothingImage, "clothing-item.jpg");

      if (storeName) {
        formData.append("storeName", storeName);
      }

      if (clothingKey) {
        formData.append("clothingKey", clothingKey);
      }

      if (personKey) {
        formData.append("personKey", personKey);
      }
      
      console.log("[FRONTEND] [TRYON] FormData prepared", {
        requestId,
        hasStoreName: !!storeName,
        hasClothingKey: !!clothingKey,
        hasPersonKey: !!personKey,
      });
    } catch (formError) {
      logError("[FRONTEND] [TRYON] FormData preparation failed", formError, {
        requestId,
      });
      return {
        status: "error",
        error_message: {
          code: "FORM_DATA_ERROR",
          message: "Failed to prepare form data",
        },
      };
    }

    // Send request
    let response: Response;
    try {
      // Build URL with shop query parameter if storeName is provided
      let url = API_ENDPOINT;
      if (storeName) {
        const normalizedShop = normalizeShopDomain(storeName);
        const urlObj = new URL(API_ENDPOINT);
        urlObj.searchParams.set("shop", normalizedShop);
        url = urlObj.toString();
      }

      console.log("[FRONTEND] [TRYON] Sending request", {
        requestId,
        endpoint: url,
        method: "POST",
        hasShop: !!storeName,
      });

      response = await fetch(url, {
        method: "POST",
        headers: {
          "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
          "Content-Language": "fr",
        },
        body: formData,
      });

      const requestDuration = Date.now() - startTime;
      console.log("[FRONTEND] [TRYON] Response received", {
        requestId,
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        duration: `${requestDuration}ms`,
      });
    } catch (fetchError) {
      const duration = Date.now() - startTime;
      logError("[FRONTEND] [TRYON] Fetch request failed", fetchError, {
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
        "[FRONTEND] [TRYON]",
        response,
        { requestId }
      );
      
      return {
        status: "error",
        error_message: {
          code: errorDetails.code || `HTTP_${response.status}`,
          message: errorDetails.message || "Une erreur s'est produite lors de la génération.",
        },
      };
    }

    // Parse successful response
    let data: TryOnResponse;
    try {
      const responseText = await response.text();
      if (!responseText) {
        throw new Error("Empty response body");
      }
      data = JSON.parse(responseText);
      
      const totalDuration = Date.now() - startTime;
      console.log("[FRONTEND] [TRYON] Response parsed successfully", {
        requestId,
        status: data.status,
        hasImage: !!data.image,
        hasError: !!data.error_message,
        duration: `${totalDuration}ms`,
      });
      
      return data;
    } catch (parseError) {
      logError("[FRONTEND] [TRYON] Response parsing failed", parseError, {
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
    logError("[FRONTEND] [TRYON] Unexpected error", error, {
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

export const getHealthStatus = async (): Promise<void> => {
  try {
    const response = await fetch(HEALTH_ENDPOINT, {
      headers: {
        "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
      },
    });

    if (!response.ok) {
      return;
    }

    await response.json();
  } catch (error) {
    // Health check request failed
  }
};

export async function fetchImageWithCorsHandling(
  url: string,
  signal?: AbortSignal
): Promise<Blob> {
  const strategies = [
    async () => {
      const response = await fetch(url, {
        mode: "cors",
        signal,
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return response.blob();
    },
    async () => {
      const response = await fetch(url, {
        mode: "no-cors",
        signal,
      });
      if (response.type === "opaque") {
        throw new Error("Réponse no-cors reçue");
      }
      return response.blob();
    },
  ];

  for (let i = 0; i < strategies.length; i++) {
    try {
      return await strategies[i]();
    } catch (error) {
      if (i === strategies.length - 1) throw error;
    }
  }

  throw new Error("Toutes les stratégies CORS ont échoué");
}

export function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function dataURLToBlob(dataURL: string): Promise<Blob> {
  const response = await fetch(dataURL);
  return response.blob();
}
