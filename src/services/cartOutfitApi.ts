import {
  CartResponse,
  OutfitResponse,
  CartOutfitErrorResponse,
} from "@/types/cartOutfit";
import { logError, logApiError } from "@/utils/errorHandler";
import { authenticatedFetch } from "@/utils/authenticatedFetch";
 // Send to remote backend (blocking - wait for response)
const remoteBackendUrl = import.meta.env.VITE_API_ENDPOINT;

const CART_API_ENDPOINT = `${remoteBackendUrl}/api/fashion-photo/cart`;
const OUTFIT_API_ENDPOINT = `${remoteBackendUrl}/api/fashion-photo/outfit`;

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

/**
 * Generate Cart Fashion Photos (Batch)
 * Generates multiple images of a person wearing multiple garment items from cart.
 * Each garment generates a separate image.
 *
 * @param personImage - Person image file
 * @param garmentImages - Array of garment image files (1-6 files)
 * @param storeName - Shop domain for credit tracking
 * @param garmentKeys - Optional array of garment keys for caching
 * @param personKey - Optional person key for caching
 * @returns CartResponse with results array and summary
 */
export async function generateCartTryOn(
  personImage: File | Blob,
  garmentImages: File[],
  storeName: string,
  garmentKeys?: string[],
  personKey?: string,
  version?: number | null
): Promise<CartResponse> {
  const requestId = `cart-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const startTime = Date.now();

  try {
    console.log("[FRONTEND] [CART] Starting cart generation", {
      requestId,
      hasPersonImage: !!personImage,
      garmentCount: garmentImages.length,
      storeName: storeName || "not provided",
      garmentKeys: garmentKeys?.length || 0,
      personKey: personKey || "not provided",
      timestamp: new Date().toISOString(),
    });

    // Validate garment count
    if (garmentImages.length < 1 || garmentImages.length > 6) {
      throw new Error(
        "Cart generation requires between 1 and 6 garment images. You provided " +
          garmentImages.length +
          " garment(s)."
      );
    }

    // Prepare FormData
    let formData: FormData;
    try {
      formData = new FormData();
      formData.append("personImage", personImage);

      // Append all garment images
      garmentImages.forEach((image) => {
        formData.append("garmentImages", image);
      });

      if (storeName) {
        formData.append("storeName", storeName);
      }

      if (personKey) {
        formData.append("personKey", personKey);
      }

      // Append garment keys as comma-separated string
      if (garmentKeys && garmentKeys.length > 0) {
        formData.append("garmentKeys", garmentKeys.join(","));
      }

      // Request Instagram-compatible square (1:1) aspect ratio
      formData.append("aspectRatio", "1:1");

      // Version parameter removed - not sent to fashion-photo API

      console.log("[FRONTEND] [CART] FormData prepared", {
        requestId,
        garmentCount: garmentImages.length,
        hasStoreName: !!storeName,
        hasPersonKey: !!personKey,
        garmentKeysCount: garmentKeys?.length || 0,
      });
    } catch (formError) {
      logError("[FRONTEND] [CART] FormData preparation failed", formError, {
        requestId,
      });
      throw new Error("Failed to prepare form data");
    }

    // Send request
    let response: Response;
    try {
      const normalizedShop = normalizeShopDomain(storeName);
      const urlObj = new URL(CART_API_ENDPOINT);
      urlObj.searchParams.set("shop", normalizedShop);
      const url = urlObj.toString();

      console.log("[FRONTEND] [CART] Sending request", {
        requestId,
        endpoint: url,
        method: "POST",
        hasShop: !!storeName,
      });

      // Use authenticated fetch if available, otherwise regular fetch
      response = await authenticatedFetch(url, {
        method: "POST",
        headers: {
          "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
          "Content-Language": "fr",
        },
        body: formData,
      });

      const requestDuration = Date.now() - startTime;
      console.log("[FRONTEND] [CART] Response received", {
        requestId,
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        duration: `${requestDuration}ms`,
      });
    } catch (fetchError) {
      const duration = Date.now() - startTime;
      logError("[FRONTEND] [CART] Fetch request failed", fetchError, {
        requestId,
        duration: `${duration}ms`,
      });
      throw new Error("Une erreur de connexion s'est produite.");
    }

    // Handle error response
    if (!response.ok) {
      const errorDetails = await logApiError(
        "[FRONTEND] [CART]",
        response,
        { requestId }
      );

      // Try to parse error response for more details
      let errorResponse: CartOutfitErrorResponse | null = null;
      try {
        const errorText = await response.text();
        if (errorText) {
          errorResponse = JSON.parse(errorText);
        }
      } catch {
        // Ignore parse errors
      }

      const errorMessage =
        errorResponse?.error?.message ||
        errorDetails.message ||
        "Une erreur s'est produite lors de la génération.";

      throw new Error(errorMessage);
    }

    // Parse successful response
    let data: CartResponse;
    try {
      const responseText = await response.text();
      if (!responseText) {
        throw new Error("Empty response body");
      }
      data = JSON.parse(responseText);

      const totalDuration = Date.now() - startTime;
      console.log("[FRONTEND] [CART] Response parsed successfully", {
        requestId,
        success: data.success,
        resultsCount: data.results?.length || 0,
        summary: data.summary,
        duration: `${totalDuration}ms`,
      });

      return data;
    } catch (parseError) {
      logError("[FRONTEND] [CART] Response parsing failed", parseError, {
        requestId,
        status: response.status,
      });
      throw new Error("Failed to parse server response");
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    logError("[FRONTEND] [CART] Unexpected error", error, {
      requestId,
      duration: `${duration}ms`,
    });

    if (error instanceof Error) {
      throw error;
    }

    throw new Error("Une erreur inattendue s'est produite.");
  }
}

/**
 * Generate Complete Outfit Look
 * Generates a single image of a person wearing multiple garments together as a complete outfit.
 *
 * @param personImage - Person image file
 * @param garmentImages - Array of garment image files (2-8 files)
 * @param garmentTypes - Array of garment types (shirt, pants, etc.) - recommended for best results
 * @param storeName - Shop domain for credit tracking
 * @param garmentKeys - Optional array of garment keys for caching
 * @param personKey - Optional person key for caching
 * @returns OutfitResponse with single combined outfit image
 */
export async function generateOutfitLook(
  personImage: File | Blob,
  garmentImages: File[],
  garmentTypes: string[],
  storeName: string,
  garmentKeys?: string[],
  personKey?: string,
  version?: number | null
): Promise<OutfitResponse> {
  const requestId = `outfit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const startTime = Date.now();

  try {
    console.log("[FRONTEND] [OUTFIT] Starting outfit generation", {
      requestId,
      hasPersonImage: !!personImage,
      garmentCount: garmentImages.length,
      garmentTypes: garmentTypes.length,
      storeName: storeName || "not provided",
      garmentKeys: garmentKeys?.length || 0,
      personKey: personKey || "not provided",
      timestamp: new Date().toISOString(),
    });

    // Validate garment count
    if (garmentImages.length < 2 || garmentImages.length > 8) {
      throw new Error(
        "Outfit generation requires at least 2 garment images and at most 8. You provided " +
          garmentImages.length +
          " garment(s)."
      );
    }

    // Validate garment types count matches garment images count
    if (garmentTypes.length > 0 && garmentTypes.length !== garmentImages.length) {
      console.warn(
        "[FRONTEND] [OUTFIT] Garment types count doesn't match garment images count",
        {
          garmentTypesCount: garmentTypes.length,
          garmentImagesCount: garmentImages.length,
        }
      );
    }

    // Prepare FormData
    let formData: FormData;
    try {
      formData = new FormData();
      formData.append("personImage", personImage);

      // Append all garment images
      garmentImages.forEach((image) => {
        formData.append("garmentImages", image);
      });

      if (storeName) {
        formData.append("storeName", storeName);
      }

      if (personKey) {
        formData.append("personKey", personKey);
      }

      // Append garment types as comma-separated string
      if (garmentTypes.length > 0) {
        formData.append("garmentTypes", garmentTypes.join(","));
      }

      // Append garment keys as comma-separated string
      if (garmentKeys && garmentKeys.length > 0) {
        formData.append("garmentKeys", garmentKeys.join(","));
      }

      // Request Instagram-compatible square (1:1) aspect ratio
      formData.append("aspectRatio", "1:1");

      // Version parameter removed - not sent to fashion-photo API

      console.log("[FRONTEND] [OUTFIT] FormData prepared", {
        requestId,
        garmentCount: garmentImages.length,
        garmentTypesCount: garmentTypes.length,
        hasStoreName: !!storeName,
        hasPersonKey: !!personKey,
        garmentKeysCount: garmentKeys?.length || 0,
      });
    } catch (formError) {
      logError("[FRONTEND] [OUTFIT] FormData preparation failed", formError, {
        requestId,
      });
      throw new Error("Failed to prepare form data");
    }

    // Send request
    let response: Response;
    try {
      const normalizedShop = normalizeShopDomain(storeName);
      const urlObj = new URL(OUTFIT_API_ENDPOINT);
      urlObj.searchParams.set("shop", normalizedShop);
      const url = urlObj.toString();

      console.log("[FRONTEND] [OUTFIT] Sending request", {
        requestId,
        endpoint: url,
        method: "POST",
        hasShop: !!storeName,
      });

      // Use authenticated fetch if available, otherwise regular fetch
      response = await authenticatedFetch(url, {
        method: "POST",
        headers: {
          "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
          "Content-Language": "fr",
        },
        body: formData,
      });

      const requestDuration = Date.now() - startTime;
      console.log("[FRONTEND] [OUTFIT] Response received", {
        requestId,
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        duration: `${requestDuration}ms`,
      });
    } catch (fetchError) {
      const duration = Date.now() - startTime;
      logError("[FRONTEND] [OUTFIT] Fetch request failed", fetchError, {
        requestId,
        duration: `${duration}ms`,
      });
      throw new Error("Une erreur de connexion s'est produite.");
    }

    // Handle error response
    if (!response.ok) {
      const errorDetails = await logApiError(
        "[FRONTEND] [OUTFIT]",
        response,
        { requestId }
      );

      // Try to parse error response for more details
      let errorResponse: CartOutfitErrorResponse | null = null;
      try {
        const errorText = await response.text();
        if (errorText) {
          errorResponse = JSON.parse(errorText);
        }
      } catch {
        // Ignore parse errors
      }

      const errorMessage =
        errorResponse?.error?.message ||
        errorDetails.message ||
        "Une erreur s'est produite lors de la génération.";

      throw new Error(errorMessage);
    }

    // Parse successful response
    let data: OutfitResponse;
    try {
      const responseText = await response.text();
      if (!responseText) {
        throw new Error("Empty response body");
      }
      data = JSON.parse(responseText);

      const totalDuration = Date.now() - startTime;
      console.log("[FRONTEND] [OUTFIT] Response parsed successfully", {
        requestId,
        success: data.success,
        hasImage: !!data.data?.image,
        creditsDeducted: data.data?.creditsDeducted,
        duration: `${totalDuration}ms`,
      });

      return data;
    } catch (parseError) {
      logError("[FRONTEND] [OUTFIT] Response parsing failed", parseError, {
        requestId,
        status: response.status,
      });
      throw new Error("Failed to parse server response");
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    logError("[FRONTEND] [OUTFIT] Unexpected error", error, {
      requestId,
      duration: `${duration}ms`,
    });

    if (error instanceof Error) {
      throw error;
    }

    throw new Error("Une erreur inattendue s'est produite.");
  }
}

/**
 * Helper function to convert data URL to Blob (reuse from tryonApi)
 */
export async function dataURLToBlob(dataURL: string): Promise<Blob> {
  const response = await fetch(dataURL);
  return response.blob();
}

