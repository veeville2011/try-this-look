import { TryOnResponse, JobSubmissionResponse, JobStatusResponse } from "@/types/tryon";
import { logError, logApiError } from "@/utils/errorHandler";
import { authenticatedFetch } from "@/utils/authenticatedFetch";
import { getSessionId } from "@/utils/tracking";

const API_ENDPOINT = "https://ai.nusense.ddns.net/api/fashion-photo";

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

export interface PersonBbox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export async function generateTryOn(
  personImage?: File | Blob | null,
  clothingImage?: Blob | null,
  storeName?: string | null,
  clothingKey?: string | null, // Deprecated: kept for backward compatibility but not sent to API
  personKey?: string | null, // Deprecated: kept for backward compatibility but not sent to API
  version?: number | null, // Deprecated: not used
  customerInfo?: CustomerInfo | null,
  productInfo?: ProductInfo | null,
  onStatusUpdate?: (statusDescription: string | null) => void,
  personBbox?: PersonBbox | null, // Optional: bounding box of selected person [x, y, width, height]
  demoPersonId?: string | null, // Optional: demo person ID (demo_01 through demo_16)
  clothingImageUrl?: string | null, // Optional: clothing image URL instead of file
  personImageUrl?: string | null, // Optional: person image URL instead of file
  language?: string | null // Optional: language override (en, fr)
): Promise<TryOnResponse> {
  const requestId = `tryon-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const startTime = Date.now();
  
  try {
    // Validate required fields according to API spec
    // Either personImage OR personImageUrl OR demoPersonId must be provided
    if (!personImage && !personImageUrl && !demoPersonId) {
      return {
        status: "error",
        error_message: {
          code: "VALIDATION_ERROR",
          message: "Either personImage, personImageUrl, or demoPersonId must be provided",
        },
      };
    }

    // Either clothingImage OR clothingImageUrl must be provided
    if (!clothingImage && !clothingImageUrl) {
      return {
        status: "error",
        error_message: {
          code: "VALIDATION_ERROR",
          message: "Either clothingImage or clothingImageUrl must be provided",
        },
      };
    }

    // Cannot provide both personImage and personImageUrl
    if (personImage && personImageUrl) {
      return {
        status: "error",
        error_message: {
          code: "VALIDATION_ERROR",
          message: "Cannot provide both personImage and personImageUrl. Provide only one.",
        },
      };
    }

    // Cannot provide both personImage and demoPersonId
    if (personImage && demoPersonId) {
      return {
        status: "error",
        error_message: {
          code: "VALIDATION_ERROR",
          message: "Cannot provide both personImage and demoPersonId. Provide only one.",
        },
      };
    }

    // Cannot provide both personImageUrl and demoPersonId
    if (personImageUrl && demoPersonId) {
      return {
        status: "error",
        error_message: {
          code: "VALIDATION_ERROR",
          message: "Cannot provide both personImageUrl and demoPersonId. Provide only one.",
        },
      };
    }

    // Validate demoPersonId format if provided
    if (demoPersonId) {
      // Must match pattern demo_XX where XX is 01-16
      const demoIdMatch = demoPersonId.match(/^demo_(\d{2})$/);
      if (!demoIdMatch) {
        return {
          status: "error",
          error_message: {
            code: "VALIDATION_ERROR",
            message: `Invalid demoPersonId: ${demoPersonId}. Use demo_01 through demo_16.`,
          },
        };
      }
      const demoNumber = parseInt(demoIdMatch[1], 10);
      if (demoNumber < 1 || demoNumber > 16) {
        return {
          status: "error",
          error_message: {
            code: "VALIDATION_ERROR",
            message: `Invalid demoPersonId: ${demoPersonId}. Use demo_01 through demo_16.`,
          },
        };
      }
    }

    console.log("[FRONTEND] [TRYON] Starting generation", {
      requestId,
      hasPersonImage: !!personImage,
      hasPersonImageUrl: !!personImageUrl,
      hasClothingImage: !!clothingImage,
      hasClothingImageUrl: !!clothingImageUrl,
      demoPersonId: demoPersonId || "not provided",
      storeName: storeName || "not provided",
      hasCustomerInfo: !!customerInfo,
      customerId: customerInfo?.id || "not provided",
      hasProductInfo: !!productInfo,
      productInfo: productInfo || "not provided",
      hasPersonBbox: !!personBbox,
      personBbox: personBbox || null,
      language: language || "not provided",
      timestamp: new Date().toISOString(),
    });

    // Prepare FormData
    let formData: FormData;
    try {
      formData = new FormData();

      // Add person image OR person image URL OR demo person ID (required - one of them)
      if (personImageUrl) {
        // If personImageUrl is provided, it takes priority per spec
        formData.append("personImageUrl", personImageUrl);
      } else if (personImage) {
        formData.append("personImage", personImage);
      } else if (demoPersonId) {
        formData.append("demoPersonId", demoPersonId);
      }

      // Add clothing image OR clothing image URL (required - one of them)
      if (clothingImageUrl) {
        // If both are provided, clothingImageUrl takes priority per spec
        formData.append("clothingImageUrl", clothingImageUrl);
      } else if (clothingImage) {
        formData.append("clothingImage", clothingImage, "clothing-item.jpg");
      }

      // Note: personKey and clothingKey are NOT sent - they are auto-generated by the API per spec

      if (storeName) {
        formData.append("storeName", storeName);
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

      // Add person bounding box if provided (for group photo selection)
      if (personBbox) {
        // Send as JSON string: {"x": number, "y": number, "width": number, "height": number}
        formData.append("personBbox", JSON.stringify(personBbox));
        console.log("[FRONTEND] [TRYON] Added personBbox to FormData:", personBbox);
      }

      // Add language override if provided
      if (language) {
        formData.append("language", language);
        console.log("[FRONTEND] [TRYON] Added language to FormData:", language);
      }
      
      // Log all FormData entries for debugging
      const formDataEntries: Record<string, string> = {};
      try {
        // Note: FormData.entries() is not available in all environments, so we log what we know
        if (personImage) formDataEntries.personImage = "[File/Blob]";
        if (personImageUrl) formDataEntries.personImageUrl = personImageUrl;
        if (demoPersonId) formDataEntries.demoPersonId = demoPersonId;
        if (clothingImage) formDataEntries.clothingImage = "[File/Blob]";
        if (clothingImageUrl) formDataEntries.clothingImageUrl = clothingImageUrl;
        if (storeName) formDataEntries.storeName = storeName;
        if (customerInfo?.id) formDataEntries.customerId = String(customerInfo.id);
        if (customerInfo?.email) formDataEntries.customerEmail = customerInfo.email;
        if (customerInfo?.firstName) formDataEntries.customerFirstName = customerInfo.firstName;
        if (customerInfo?.lastName) formDataEntries.customerLastName = customerInfo.lastName;
        if (productInfo?.productId) formDataEntries.productId = String(productInfo.productId);
        if (productInfo?.productTitle) formDataEntries.productTitle = productInfo.productTitle;
        if (productInfo?.productUrl) formDataEntries.productUrl = productInfo.productUrl;
        if (productInfo?.variantId) formDataEntries.variantId = String(productInfo.variantId);
        if (personBbox) formDataEntries.personBbox = JSON.stringify(personBbox);
        if (language) formDataEntries.language = language;
      } catch (e) {
        // Ignore
      }

      console.log("[FRONTEND] [TRYON] FormData prepared", {
        requestId,
        hasStoreName: !!storeName,
        hasPersonImage: !!personImage,
        hasPersonImageUrl: !!personImageUrl,
        hasDemoPersonId: !!demoPersonId,
        hasClothingImage: !!clothingImage,
        hasClothingImageUrl: !!clothingImageUrl,
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

      // For FormData requests, do NOT set Content-Type header
      // The browser will automatically set it with the correct boundary
      // Also, minimize custom headers to avoid CORS preflight issues
      // Only include headers that are safe and commonly allowed
      const headers: HeadersInit = {
        // Accept header is safe and commonly allowed
        "Accept": "application/json",
      };
      
      // Note: Removed custom headers (X-Session-ID, Accept-Language, Content-Language)
      // to avoid CORS preflight issues. Session ID is still sent in FormData if needed.
      
      response = await authenticatedFetch(url, {
        method: "POST",
        headers,
        body: formData,
        // Ensure CORS mode is set correctly
        mode: "cors",
        credentials: "omit", // Don't send cookies to avoid CORS issues
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
      const statusResponse = await pollJobStatus(jobId, requestId, undefined, undefined, onStatusUpdate);
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
  pollInterval: number = 3000, // 3 seconds
  onStatusUpdate?: (statusDescription: string | null) => void
): Promise<TryOnResponse> {
  const statusEndpoint = `${API_ENDPOINT}/status/${jobId}`;
  let attempts = 0;

  while (attempts < maxAttempts) {
    try {
      const response = await authenticatedFetch(statusEndpoint, {
        method: "GET",
        headers: {
          "Accept": "application/json",
        },
        mode: "cors",
        credentials: "omit",
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("Job not found");
        }
        const errorText = await response.text().catch(() => "Unknown error");
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const statusData: JobStatusResponse = await response.json();
      
      // Update UI with status description if available
      if (onStatusUpdate && statusData.statusDescription) {
        onStatusUpdate(statusData.statusDescription);
      } else if (onStatusUpdate && statusData.message) {
        // Fallback to message if statusDescription is not available
        onStatusUpdate(statusData.message);
      }
      
      console.log("[FRONTEND] [TRYON] Job status check", {
        requestId,
        jobId,
        status: statusData.status,
        statusDescription: statusData.statusDescription || statusData.message,
        attempt: attempts + 1,
      });

      if (statusData.status === 'completed') {
        // Job is completed - return image URL directly
        // The VirtualTryOnModal component will handle displaying it using getProxiedImageUrl
        if (!statusData.imageUrl) {
          return {
            status: "error",
            error_message: {
              code: "MISSING_IMAGE_URL",
              message: "Job completed but imageUrl is missing",
            },
          };
        }

        // Return the image URL directly - the component will handle proxying if needed
        return {
          status: "success",
          image: statusData.imageUrl,
        };
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

export interface ImageGenerationHistoryItem {
  id: string;
  requestId: string;
  personImageUrl: string;
  clothingImageUrl: string;
  generatedImageUrl: string;
  personBbox?: {
    x: number;
    y: number;
    width: number;
    height: number;
    imageWidth: number;
    imageHeight: number;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface ImageGenerationHistoryResponse {
  success: boolean;
  data: ImageGenerationHistoryItem[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

/**
 * Fetch customer image generation history
 */
export async function fetchCustomerImageHistory(
  email: string,
  page: number = 1,
  limit: number = 10,
  store?: string | null
): Promise<ImageGenerationHistoryResponse> {
  try {
    const baseUrl = "https://ai.nusense.ddns.net";
    const queryParams = new URLSearchParams({
      email: email,
      page: page.toString(),
      limit: limit.toString(),
    });
    
    if (store) {
      const normalizedStore = normalizeShopDomain(store);
      if (normalizedStore) {
        queryParams.append("store", normalizedStore);
      }
    }
    
    const url = `${baseUrl}/api/image-generations/customer?${queryParams.toString()}`;
    
    const response = await authenticatedFetch(url, {
      method: "GET",
      headers: {
        "Accept": "application/json",
      },
      mode: "cors",
      credentials: "omit",
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data: ImageGenerationHistoryResponse = await response.json();
    return data;
  } catch (error) {
    console.error("[FRONTEND] [HISTORY] Failed to fetch customer history:", error);
    throw error;
  }
}

export function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Get proxied image URL to avoid CORS issues
 */
function getProxiedImageUrl(imageUrl: string): string {
  // If URL is already from our domain or relative, return as-is
  try {
    // Check if it's already a proxy URL
    if (imageUrl.includes('/api/proxy-image?')) {
      return imageUrl;
    }
    
    // For browser environment, check hostname
    if (typeof window !== 'undefined') {
      const url = new URL(imageUrl, window.location.href);
      // If it's from S3 or external domain, use proxy
      if (url.hostname.includes('s3') || url.hostname !== window.location.hostname) {
        return `/api/proxy-image?url=${encodeURIComponent(imageUrl)}`;
      }
    } else {
      // For server-side, check if it's an external URL
      const url = new URL(imageUrl);
      // If it's from S3 or not localhost, use proxy (assuming server is on same domain)
      if (url.hostname.includes('s3') || (url.hostname !== 'localhost' && !url.hostname.startsWith('127.0.0.1'))) {
        return `/api/proxy-image?url=${encodeURIComponent(imageUrl)}`;
      }
    }
  } catch {
    // If URL parsing fails, assume it's external and use proxy
    return `/api/proxy-image?url=${encodeURIComponent(imageUrl)}`;
  }
  return imageUrl;
}

export async function dataURLToBlob(dataURL: string): Promise<Blob> {
  // If it's a data URL, fetch directly
  if (dataURL.startsWith('data:')) {
    const response = await fetch(dataURL);
    return response.blob();
  }
  
  // If it's a regular URL (like S3), use proxy to avoid CORS errors
  const proxiedUrl = getProxiedImageUrl(dataURL);
  try {
    const response = await fetch(proxiedUrl);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return response.blob();
  } catch (error) {
    // Fallback to CORS handling if proxy fails
    console.warn('[tryonApi] Proxy fetch failed, falling back to CORS handling:', error);
    return await fetchImageWithCorsHandling(dataURL);
  }
}

/**
 * Check health status of the API
 */
export async function getHealthStatus(): Promise<{ status: string; timestamp: string }> {
  try {
    const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
    const url = `${baseUrl}/health`;
    
    const response = await authenticatedFetch(url, {
      method: "GET",
      headers: {
        "Accept": "application/json",
      },
      mode: "cors",
      credentials: "omit",
    });

    if (!response.ok) {
      throw new Error(`Health check failed: HTTP ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("[FRONTEND] [HEALTH] Health check failed:", error);
    // Return a default response even if health check fails
    return {
      status: "error",
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Customer Image Generation Record (from API 1)
 */
export interface CustomerImageGeneration {
  id: string;
  requestId: string;
  personImageUrl: string;
  clothingImageUrl: string;
  generatedImageUrl: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Uploaded Image Record (from API 2)
 */
export interface UploadedImage {
  id: string;
  requestId: string;
  personImageUrl: string;
  personKey: string;
  storeName: string;
  uploadedAt: string;
  updatedAt: string;
}

/**
 * Pagination metadata
 */
export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/**
 * Response for customer image generations (API 1)
 */
export interface CustomerImageGenerationsResponse {
  success: boolean;
  data: CustomerImageGeneration[];
  pagination: PaginationMeta;
  error?: {
    code: string;
    message: string;
    details?: Record<string, any>;
  };
}

/**
 * Response for uploaded images (API 2)
 */
export interface UploadedImagesResponse {
  success: boolean;
  data: UploadedImage[];
  pagination: PaginationMeta;
  error?: {
    code: string;
    message: string;
    details?: Record<string, any>;
  };
}

/**
 * Parameters for fetching customer image generations
 */
export interface FetchCustomerImageGenerationsParams {
  email: string;
  store: string;
  page?: number;
  limit?: number;
  status?: "pending" | "processing" | "completed" | "failed";
  orderBy?: "created_at" | "createdAt" | "updated_at" | "updatedAt" | "status";
  orderDirection?: "ASC" | "DESC";
  startDate?: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
}

/**
 * Parameters for fetching uploaded images
 */
export interface FetchUploadedImagesParams {
  email: string;
  store?: string;
  page?: number;
  limit?: number;
  startDate?: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
}

/**
 * Fetch customer image generations (API 1: /api/image-generations/customer)
 */
export async function fetchCustomerImageGenerations(
  params: FetchCustomerImageGenerationsParams
): Promise<CustomerImageGenerationsResponse> {
  try {
    const baseUrl = "https://ai.nusense.ddns.net";
    const queryParams = new URLSearchParams({
      email: params.email,
      store: params.store,
      page: (params.page || 1).toString(),
      limit: (params.limit || 10).toString(),
    });

    if (params.status) {
      queryParams.append("status", params.status);
    }
    if (params.orderBy) {
      queryParams.append("orderBy", params.orderBy);
    }
    if (params.orderDirection) {
      queryParams.append("orderDirection", params.orderDirection);
    }
    if (params.startDate) {
      queryParams.append("startDate", params.startDate);
    }
    if (params.endDate) {
      queryParams.append("endDate", params.endDate);
    }

    const url = `${baseUrl}/api/image-generations/customer?${queryParams.toString()}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Accept": "application/json",
      },
      mode: "cors",
      credentials: "omit",
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`
      );
    }

    const data: CustomerImageGenerationsResponse = await response.json();
    return data;
  } catch (error) {
    console.error("[FRONTEND] [CUSTOMER_IMAGES] Failed to fetch customer image generations:", error);
    throw error;
  }
}

/**
 * Fetch uploaded images (API 2: /api/image-generations/uploaded-images)
 */
export async function fetchUploadedImages(
  params: FetchUploadedImagesParams
): Promise<UploadedImagesResponse> {
  try {
    const baseUrl = "https://ai.nusense.ddns.net";
    const queryParams = new URLSearchParams({
      email: params.email,
      page: (params.page || 1).toString(),
      limit: (params.limit || 10).toString(),
    });

    if (params.store) {
      queryParams.append("store", params.store);
    }
    if (params.startDate) {
      queryParams.append("startDate", params.startDate);
    }
    if (params.endDate) {
      queryParams.append("endDate", params.endDate);
    }

    const url = `${baseUrl}/api/image-generations/uploaded-images?${queryParams.toString()}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Accept": "application/json",
      },
      mode: "cors",
      credentials: "omit",
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`
      );
    }

    const data: UploadedImagesResponse = await response.json();
    return data;
  } catch (error) {
    console.error("[FRONTEND] [UPLOADED_IMAGES] Failed to fetch uploaded images:", error);
    throw error;
  }
}