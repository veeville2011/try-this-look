import { TryOnResponse, JobSubmissionResponse, JobStatusResponse } from "@/types/tryon";
import { logError, logApiError } from "@/utils/errorHandler";
import { authenticatedFetch } from "@/utils/authenticatedFetch";

const API_ENDPOINT = "https://ai.nusense.ddns.net/api/fashion-photo";
const HEALTH_ENDPOINT = "https://ai.nusense.ddns.net/api/health";

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

interface CustomerInfo {
  id?: string | null;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}

interface ProductInfo {
  productId?: number | string | null;
  productTitle?: string | null;
  productUrl?: string | null;
  variantId?: number | string | null;
}

export async function generateTryOn(
  personImage: File | Blob,
  clothingImage: Blob,
  storeName?: string | null,
  clothingKey?: string | null,
  personKey?: string | null,
  version?: number | null,
  customerInfo?: CustomerInfo | null,
  productInfo?: ProductInfo | null
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
      hasCustomerInfo: !!customerInfo,
      customerId: customerInfo?.id || "not provided",
      hasProductInfo: !!productInfo,
      productInfo: productInfo || "not provided",
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

      // Add customer information if available (non-mandatory)
      if (customerInfo) {
        if (customerInfo.id) {
          formData.append("customerId", customerInfo.id);
        }
        if (customerInfo.email) {
          formData.append("customerEmail", customerInfo.email);
        }
        if (customerInfo.firstName) {
          formData.append("customerFirstName", customerInfo.firstName);
        }
        if (customerInfo.lastName) {
          formData.append("customerLastName", customerInfo.lastName);
        }
      }

      // Add product information if available (non-mandatory)
      if (productInfo) {
        if (productInfo.productId != null && productInfo.productId !== "") {
          formData.append("productId", String(productInfo.productId));
          console.log("[FRONTEND] [TRYON] Added productId to FormData:", productInfo.productId);
        }
        if (productInfo.productTitle != null && productInfo.productTitle !== "") {
          formData.append("productTitle", productInfo.productTitle);
          console.log("[FRONTEND] [TRYON] Added productTitle to FormData:", productInfo.productTitle);
        }
        if (productInfo.productUrl != null && productInfo.productUrl !== "") {
          formData.append("productUrl", productInfo.productUrl);
          console.log("[FRONTEND] [TRYON] Added productUrl to FormData:", productInfo.productUrl);
        }
        if (productInfo.variantId != null && productInfo.variantId !== "") {
          formData.append("variantId", String(productInfo.variantId));
          console.log("[FRONTEND] [TRYON] Added variantId to FormData:", productInfo.variantId);
        }
      } else {
        console.log("[FRONTEND] [TRYON] No productInfo provided");
      }

      // Request Instagram-compatible square (1:1) aspect ratio
      formData.append("aspectRatio", "1:1");
      
      // Version parameter removed - not sent to fashion-photo API
      
      // Log all FormData entries for debugging
      const formDataEntries: Record<string, string> = {};
      try {
        // Note: FormData.entries() is not available in all environments, so we log what we know
        formDataEntries.personImage = "[File/Blob]";
        formDataEntries.clothingImage = "[File/Blob]";
        if (storeName) formDataEntries.storeName = storeName;
        if (clothingKey) formDataEntries.clothingKey = clothingKey;
        if (personKey) formDataEntries.personKey = personKey;
        if (customerInfo?.id) formDataEntries.customerId = String(customerInfo.id);
        if (customerInfo?.email) formDataEntries.customerEmail = customerInfo.email;
        if (customerInfo?.firstName) formDataEntries.customerFirstName = customerInfo.firstName;
        if (customerInfo?.lastName) formDataEntries.customerLastName = customerInfo.lastName;
        if (productInfo?.productId) formDataEntries.productId = String(productInfo.productId);
        if (productInfo?.productTitle) formDataEntries.productTitle = productInfo.productTitle;
        if (productInfo?.productUrl) formDataEntries.productUrl = productInfo.productUrl;
        if (productInfo?.variantId) formDataEntries.variantId = String(productInfo.variantId);
        formDataEntries.aspectRatio = "1:1";
      } catch (e) {
        // Ignore
      }

      console.log("[FRONTEND] [TRYON] FormData prepared", {
        requestId,
        hasStoreName: !!storeName,
        hasClothingKey: !!clothingKey,
        hasPersonKey: !!personKey,
        hasCustomerInfo: !!customerInfo,
        hasProductInfo: !!productInfo,
        productInfo: productInfo || null,
        formDataEntries,
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

    // Step 1: Submit job
    let response: Response;
    let jobId: string;
    try {
      // Build URL with shop query parameter if storeName is provided
      let url = API_ENDPOINT;
      if (storeName) {
        const normalizedShop = normalizeShopDomain(storeName);
        const urlObj = new URL(API_ENDPOINT);
        urlObj.searchParams.set("shop", normalizedShop);
        url = urlObj.toString();
      }

      console.log("[FRONTEND] [TRYON] Submitting job", {
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
      console.log("[FRONTEND] [TRYON] Job submission response", {
        requestId,
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        duration: `${requestDuration}ms`,
      });
    } catch (fetchError) {
      const duration = Date.now() - startTime;
      logError("[FRONTEND] [TRYON] Job submission failed", fetchError, {
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

    // Handle error response for job submission
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
          message: errorDetails.message || "Une erreur s'est produite lors de la soumission du job.",
        },
      };
    }

    // Parse job submission response (202 Accepted)
    let jobSubmissionData: JobSubmissionResponse;
    try {
      const responseText = await response.text();
      if (!responseText) {
        throw new Error("Empty response body");
      }

      if (response.status !== 202) {
        // Handle non-202 success responses (backward compatibility)
        const data = JSON.parse(responseText);
        
        // If response already contains image, return directly (backward compatibility)
        if (data.status === 'success' && data.image) {
          return data;
        }
        
        throw new Error(`Unexpected status code: ${response.status}`);
      }

      // Handle 202 Accepted response
      jobSubmissionData = JSON.parse(responseText);
      
      if (!jobSubmissionData.jobId) {
        throw new Error("Job ID not found in response");
      }
      
      jobId = jobSubmissionData.jobId;
      console.log("[FRONTEND] [TRYON] Job submitted successfully", {
        requestId,
        jobId,
      });
    } catch (parseError) {
      logError("[FRONTEND] [TRYON] Job submission response parsing failed", parseError, {
        requestId,
        status: response.status,
      });
      return {
        status: "error",
        error_message: {
          code: "PARSE_ERROR",
          message: "Failed to parse job submission response",
        },
      };
    }

    // Step 2: Poll job status until completion
    try {
      const statusResponse = await pollJobStatus(jobId, requestId);
      const totalDuration = Date.now() - startTime;
      
      console.log("[FRONTEND] [TRYON] Job completed", {
        requestId,
        jobId,
        status: statusResponse.status,
        hasImage: !!statusResponse.image,
        hasError: !!statusResponse.error_message,
        duration: `${totalDuration}ms`,
      });
      
      return statusResponse;
    } catch (pollError) {
      logError("[FRONTEND] [TRYON] Job polling failed", pollError, {
        requestId,
        jobId,
      });
      return {
        status: "error",
        error_message: {
          code: "POLLING_ERROR",
          message: pollError instanceof Error ? pollError.message : "Une erreur s'est produite lors de la vérification du statut du job.",
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

/**
 * Poll job status until completion or failure
 */
async function pollJobStatus(
  jobId: string,
  requestId: string,
  maxAttempts: number = 200, // 10 minutes max (3s interval)
  pollInterval: number = 3000 // 3 seconds
): Promise<TryOnResponse> {
  const statusEndpoint = `${API_ENDPOINT}/status/${jobId}`;
  let attempts = 0;

  while (attempts < maxAttempts) {
    try {
      const response = await authenticatedFetch(statusEndpoint, {
        method: "GET",
        headers: {
          "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("Job not found");
        }
        const errorText = await response.text().catch(() => "Unknown error");
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const statusData: JobStatusResponse = await response.json();
      
      console.log("[FRONTEND] [TRYON] Job status check", {
        requestId,
        jobId,
        status: statusData.status,
        attempt: attempts + 1,
      });

      if (statusData.status === 'completed') {
        // Job is completed - stop polling regardless of image download result
        if (!statusData.imageUrl) {
          return {
            status: "error",
            error_message: {
              code: "MISSING_IMAGE_URL",
              message: "Job completed but imageUrl is missing",
            },
          };
        }

        // Download image using proxy endpoint to avoid CORS issues
        try {
          // Use proxy endpoint to fetch image
          const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(statusData.imageUrl)}`;
          const imageResponse = await authenticatedFetch(proxyUrl, {
            method: "GET",
            headers: {
              "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
            },
          });

          if (!imageResponse.ok) {
            throw new Error(`Failed to fetch image via proxy: HTTP ${imageResponse.status}`);
          }

          const imageBlob = await imageResponse.blob();
          const imageDataUrl = await blobToDataURL(imageBlob);
          
          return {
            status: "success",
            image: imageDataUrl,
          };
        } catch (imageError) {
          logError("[FRONTEND] [TRYON] Failed to download image", imageError, {
            requestId,
            jobId,
            imageUrl: statusData.imageUrl,
          });
          // Return error response instead of throwing to stop polling
          return {
            status: "error",
            error_message: {
              code: "IMAGE_DOWNLOAD_FAILED",
              message: "Job completed but failed to download image. Please try again.",
            },
          };
        }
      } else if (statusData.status === 'failed') {
        return {
          status: "error",
          error_message: {
            code: statusData.error?.code || "PROCESSING_FAILURE",
            message: statusData.error?.message || "Job processing failed",
          },
        };
      } else if (statusData.status === 'pending' || statusData.status === 'processing') {
        // Continue polling
        attempts++;
        if (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, pollInterval));
        } else {
          throw new Error("Job is taking longer than expected. Please check back later.");
        }
      } else {
        throw new Error(`Unknown job status: ${statusData.status}`);
      }
    } catch (pollError) {
      // If status is completed or failed, we should have returned already
      // This catch is only for network/parsing errors during status checks
      
      // For network errors, retry after delay
      attempts++;
      if (attempts >= maxAttempts) {
        throw new Error(`Job status polling failed after ${maxAttempts} attempts: ${pollError instanceof Error ? pollError.message : String(pollError)}`);
      }
      
      console.warn("[FRONTEND] [TRYON] Status check failed, retrying", {
        requestId,
        jobId,
        attempt: attempts,
        error: pollError instanceof Error ? pollError.message : String(pollError),
      });
      
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
  }

  throw new Error("Job processing timeout");
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
