import { TryOnResponse, JobSubmissionResponse, JobStatusResponse } from "@/types/tryon";
import { logError, logApiError } from "@/utils/errorHandler";
import { authenticatedFetch } from "@/utils/authenticatedFetch";

const API_ENDPOINT = "https://ai.nusense.ddns.net/api/fashion-tryon";

/** Shopify GID format (variant or product): gid://shopify/ProductVariant/123 or gid://shopify/Product/123 */
const GID_REGEX = /^gid:\/\/shopify\/(ProductVariant|Product)\/\d+$/;

/** API expects demo_01..demo_16; app may send demo_person_1..demo_person_16. Normalize to API format. */
const normalizeDemoPersonId = (id: string | null | undefined): string | null => {
  if (!id || typeof id !== "string") return null;
  const s = id.trim();
  const apiMatch = s.match(/^demo_(\d{2})$/);
  if (apiMatch) return s;
  const legacyMatch = s.match(/^demo_person_(\d+)$/);
  if (legacyMatch) {
    const n = parseInt(legacyMatch[1], 10);
    if (n >= 1 && n <= 16) return `demo_${String(n).padStart(2, "0")}`;
  }
  return null;
};

/**
 * Normalize shop domain per fashion-tryon-api.md
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
 * Normalize variantId to Shopify GID format.
 * Accepts numeric ID or full GID; returns GID string.
 */
export const normalizeVariantIdToGid = (variantId: string | number | null | undefined): string | null => {
  if (variantId == null || variantId === "") return null;
  const s = String(variantId).trim();
  if (!s) return null;
  if (GID_REGEX.test(s)) return s;
  const num = /^\d+$/.test(s) ? s : null;
  if (num) return `gid://shopify/ProductVariant/${num}`;
  return null;
};

export interface GenerateTryOnParams {
  /** Shopify variant (or product) GID, or numeric ID (will be normalized to GID). Required. */
  variantId: string | number | null | undefined;
  /** Shopify shop domain. Required. */
  shop: string | null | undefined;
  /** Person image file (use exactly one of personImage, personImageUrl, or demoPersonId). */
  personImage?: File | Blob | null;
  /** Person image URL for demo or recent photos; backend fetches (avoids CORS). */
  personImageUrl?: string | null;
  /** Demo person ID demo_01..demo_16 (use when no personImage/personImageUrl). */
  demoPersonId?: string | null;
  /** Optional status updates during polling. */
  onStatusUpdate?: (statusDescription: string | null) => void;
  /** Optional customer info (if API supports). */
  customerInfo?: {
    id?: string | null;
    email?: string | null;
    firstName?: string | null;
    lastName?: string | null;
  } | null;
  /** Optional person bounding box for group photos (if API supports). */
  personBbox?: { x: number; y: number; width: number; height: number } | null;
  /** Optional language override en/fr (if API supports). */
  language?: string | null;
}

export interface PersonBbox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Generate try-on using Fashion Try-On API per fashion-tryon-api.md.
 * Requires variantId + shop; person is exactly one of personImage (file), personImageUrl (URL), or demoPersonId.
 * No clothing fields — product imagery is resolved server-side from Shopify.
 * No proxy: calls API directly. personImageUrl avoids CORS (backend fetches).
 */
export async function generateTryOn(params: GenerateTryOnParams): Promise<TryOnResponse> {
  const {
    variantId: rawVariantId,
    shop,
    personImage,
    personImageUrl,
    demoPersonId,
    onStatusUpdate,
    customerInfo,
    personBbox,
    language,
  } = params;

  const requestId = `tryon-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const startTime = Date.now();

  try {
    const variantIdGid = normalizeVariantIdToGid(rawVariantId);
    if (!variantIdGid) {
      return {
        status: "error",
        error_message: {
          code: "VALIDATION_ERROR",
          message: "variantId is required and must be a valid Shopify GraphQL ID (GID) or numeric variant ID",
        },
      };
    }

    if (!shop || !normalizeShopDomain(shop)) {
      return {
        status: "error",
        error_message: {
          code: "VALIDATION_ERROR",
          message: "shop is required",
        },
      };
    }

    const hasFile = !!personImage;
    const hasUrl = personImageUrl && typeof personImageUrl === "string" && personImageUrl.trim().length > 0;
    const hasDemo = !!demoPersonId;

    const personCount = [hasFile, hasUrl, hasDemo].filter(Boolean).length;
    if (personCount === 0) {
      return {
        status: "error",
        error_message: {
          code: "VALIDATION_ERROR",
          message: "Provide exactly one of personImage (file), personImageUrl (URL), or demoPersonId.",
        },
      };
    }
    if (personCount > 1) {
      return {
        status: "error",
        error_message: {
          code: "VALIDATION_ERROR",
          message: "Provide only one of personImage, personImageUrl, or demoPersonId.",
        },
      };
    }

    const normalizedDemoId = demoPersonId ? normalizeDemoPersonId(demoPersonId) : null;
    if (demoPersonId && !normalizedDemoId) {
      return {
        status: "error",
        error_message: {
          code: "VALIDATION_ERROR",
          message: `Invalid demoPersonId: ${demoPersonId}. Use demo_01 through demo_16 (or demo_person_1 through demo_person_16).`,
        },
      };
    }

    const normalizedShop = normalizeShopDomain(shop);

    console.log("[FRONTEND] [TRYON] Starting generation (fashion-tryon)", {
      requestId,
      variantId: variantIdGid,
      shop: normalizedShop,
      hasPersonImage: hasFile,
      hasPersonImageUrl: hasUrl,
      demoPersonId: normalizedDemoId || null,
      timestamp: new Date().toISOString(),
    });

    const formData = new FormData();
    formData.append("variantId", variantIdGid);
    formData.append("shop", normalizedShop);

    if (normalizedDemoId) {
      formData.append("demoPersonId", normalizedDemoId);
    } else if (hasUrl) {
      formData.append("personImageUrl", personImageUrl!.trim());
    } else if (hasFile) {
      const fileName = personImage instanceof File ? personImage.name : "person.jpg";
      formData.append("personImage", personImage, fileName);
    }

    if (customerInfo) {
      if (customerInfo.id) formData.append("customerId", String(customerInfo.id));
      if (customerInfo.email) formData.append("customerEmail", customerInfo.email);
      if (customerInfo.firstName) formData.append("customerFirstName", customerInfo.firstName);
      if (customerInfo.lastName) formData.append("customerLastName", customerInfo.lastName);
    }
    if (personBbox) {
      formData.append("personBbox", JSON.stringify(personBbox));
    }
    if (language) {
      formData.append("language", language);
    }

    let response: Response;
    let jobId: string;

    try {
      // Do not set Content-Type: fetch will set multipart/form-data with boundary so FormData is sent correctly (visible in DevTools as Form Data / Request payload)
      response = await authenticatedFetch(API_ENDPOINT, {
        method: "POST",
        headers: { Accept: "application/json" },
        body: formData,
        mode: "cors",
        credentials: "omit",
      });

      console.log("[FRONTEND] [TRYON] Job submission response", {
        requestId,
        status: response.status,
        ok: response.ok,
        duration: `${Date.now() - startTime}ms`,
      });
    } catch (fetchError) {
      logError("[FRONTEND] [TRYON] Job submission failed", fetchError, { requestId });
      return {
        status: "error",
        error_message: {
          code: "NETWORK_ERROR",
          message: "Une erreur de connexion s'est produite.",
        },
      };
    }

    if (!response.ok) {
      const errorDetails = await logApiError("[FRONTEND] [TRYON]", response, { requestId });
      return {
        status: "error",
        error_message: {
          code: errorDetails.code || `HTTP_${response.status}`,
          message: errorDetails.message || "Une erreur s'est produite lors de la soumission du job.",
        },
      };
    }

    const responseText = await response.text();
    if (!responseText) {
      return {
        status: "error",
        error_message: { code: "PARSE_ERROR", message: "Empty response body" },
      };
    }

    if (response.status !== 202) {
      const data = JSON.parse(responseText);
      if (data.status === "success" && data.image) {
        return data;
      }
      return {
        status: "error",
        error_message: {
          code: "PARSE_ERROR",
          message: `Unexpected status code: ${response.status}`,
        },
      };
    }

    let jobSubmissionData: JobSubmissionResponse;
    try {
      jobSubmissionData = JSON.parse(responseText);
      jobId = jobSubmissionData.jobId;
      if (!jobId) {
        throw new Error("Job ID not found in response");
      }
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

    try {
      const statusResponse = await pollJobStatus(jobId, requestId, undefined, undefined, onStatusUpdate);
      console.log("[FRONTEND] [TRYON] Job completed", {
        requestId,
        jobId,
        status: statusResponse.status,
        hasImage: !!statusResponse.image,
        duration: `${Date.now() - startTime}ms`,
      });
      return statusResponse;
    } catch (pollError) {
      logError("[FRONTEND] [TRYON] Job polling failed", pollError, { requestId, jobId });
      return {
        status: "error",
        error_message: {
          code: "POLLING_ERROR",
          message:
            pollError instanceof Error
              ? pollError.message
              : "Une erreur s'est produite lors de la vérification du statut du job.",
        },
      };
    }
  } catch (error) {
    logError("[FRONTEND] [TRYON] Unexpected error", error, { requestId });
    return {
      status: "error",
      error_message: {
        code: "UNKNOWN_ERROR",
        message: "Une erreur inattendue s'est produite.",
      },
    };
  }
}

async function pollJobStatus(
  jobId: string,
  requestId: string,
  maxAttempts: number = 200,
  pollInterval: number = 3000,
  onStatusUpdate?: (statusDescription: string | null) => void
): Promise<TryOnResponse> {
  const statusEndpoint = `${API_ENDPOINT}/status/${jobId}`;
  let attempts = 0;

  while (attempts < maxAttempts) {
    try {
      const response = await authenticatedFetch(statusEndpoint, {
        method: "GET",
        headers: { Accept: "application/json" },
        mode: "cors",
        credentials: "omit",
      });

      if (!response.ok) {
        if (response.status === 404) throw new Error("Job not found");
        const errorText = await response.text().catch(() => "Unknown error");
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const statusData: JobStatusResponse = await response.json();

      if (onStatusUpdate && statusData.statusDescription) {
        onStatusUpdate(statusData.statusDescription);
      } else if (onStatusUpdate && statusData.message) {
        onStatusUpdate(statusData.message);
      }

      if (statusData.status === "completed") {
        if (!statusData.imageUrl) {
          return {
            status: "error",
            error_message: {
              code: "MISSING_IMAGE_URL",
              message: "Job completed but imageUrl is missing",
            },
          };
        }
        return { status: "success", image: statusData.imageUrl };
      }

      if (statusData.status === "failed") {
        return {
          status: "error",
          error_message: {
            code: statusData.error?.code || "PROCESSING_FAILURE",
            message: statusData.error?.message || "Job processing failed",
          },
        };
      }

      if (statusData.status === "pending" || statusData.status === "processing") {
        attempts++;
        if (attempts < maxAttempts) {
          await new Promise((r) => setTimeout(r, pollInterval));
        } else {
          throw new Error("Job is taking longer than expected. Please check back later.");
        }
      } else {
        throw new Error(`Unknown job status: ${statusData.status}`);
      }
    } catch (pollError) {
      attempts++;
      if (attempts >= maxAttempts) {
        throw new Error(
          `Job status polling failed after ${maxAttempts} attempts: ${pollError instanceof Error ? pollError.message : String(pollError)}`
        );
      }
      await new Promise((r) => setTimeout(r, pollInterval));
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
      const response = await fetch(url, { mode: "cors", signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      return response.blob();
    },
    async () => {
      const response = await fetch(url, { mode: "no-cors", signal });
      if (response.type === "opaque") throw new Error("Réponse no-cors reçue");
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
  personBbox?: { x: number; y: number; width: number; height: number; imageWidth: number; imageHeight: number } | null;
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

export async function fetchCustomerImageHistory(
  email: string,
  page: number = 1,
  limit: number = 10,
  store?: string | null
): Promise<ImageGenerationHistoryResponse> {
  const baseUrl = "https://ai.nusense.ddns.net";
  const queryParams = new URLSearchParams({
    email,
    page: page.toString(),
    limit: limit.toString(),
  });
  if (store) {
    const normalizedStore = normalizeShopDomain(store);
    if (normalizedStore) queryParams.append("store", normalizedStore);
  }
  const url = `${baseUrl}/api/image-generations/customer?${queryParams.toString()}`;
  const response = await authenticatedFetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
    mode: "cors",
    credentials: "omit",
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  return response.json();
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
  if (dataURL.startsWith("data:")) {
    const response = await fetch(dataURL);
    return response.blob();
  }
  return fetchImageWithCorsHandling(dataURL);
}

export async function getHealthStatus(): Promise<{ status: string; timestamp: string }> {
  try {
    const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
    const response = await authenticatedFetch(`${baseUrl}/health`, {
      method: "GET",
      headers: { Accept: "application/json" },
      mode: "cors",
      credentials: "omit",
    });
    if (!response.ok) throw new Error(`Health check failed: HTTP ${response.status}`);
    return response.json();
  } catch (error) {
    console.error("[FRONTEND] [HEALTH] Health check failed:", error);
    return { status: "error", timestamp: new Date().toISOString() };
  }
}

export interface CustomerImageGeneration {
  id: string;
  requestId: string;
  personImageUrl: string;
  clothingImageUrl: string;
  generatedImageUrl: string;
  createdAt: string;
  updatedAt: string;
}

export interface UploadedImage {
  id: string;
  requestId: string;
  personImageUrl: string;
  personKey: string;
  storeName: string;
  uploadedAt: string;
  updatedAt: string;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface CustomerImageGenerationsResponse {
  success: boolean;
  data: CustomerImageGeneration[];
  pagination: PaginationMeta;
  error?: { code: string; message: string; details?: Record<string, unknown> };
}

export interface UploadedImagesResponse {
  success: boolean;
  data: UploadedImage[];
  pagination: PaginationMeta;
  error?: { code: string; message: string; details?: Record<string, unknown> };
}

export interface FetchCustomerImageGenerationsParams {
  email: string;
  store: string;
  page?: number;
  limit?: number;
  status?: "pending" | "processing" | "completed" | "failed";
  orderBy?: string;
  orderDirection?: "ASC" | "DESC";
  startDate?: string;
  endDate?: string;
}

export interface FetchUploadedImagesParams {
  email: string;
  store?: string;
  page?: number;
  limit?: number;
  startDate?: string;
  endDate?: string;
}

export async function fetchCustomerImageGenerations(
  params: FetchCustomerImageGenerationsParams
): Promise<CustomerImageGenerationsResponse> {
  const baseUrl = "https://ai.nusense.ddns.net";
  const queryParams = new URLSearchParams({
    email: params.email,
    store: params.store,
    page: (params.page || 1).toString(),
    limit: (params.limit || 10).toString(),
  });
  if (params.status) queryParams.append("status", params.status);
  if (params.orderBy) queryParams.append("orderBy", params.orderBy);
  if (params.orderDirection) queryParams.append("orderDirection", params.orderDirection);
  if (params.startDate) queryParams.append("startDate", params.startDate);
  if (params.endDate) queryParams.append("endDate", params.endDate);
  const url = `${baseUrl}/api/image-generations/customer?${queryParams.toString()}`;
  const response = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
    mode: "cors",
    credentials: "omit",
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`);
  }
  return response.json();
}

export async function fetchUploadedImages(
  params: FetchUploadedImagesParams
): Promise<UploadedImagesResponse> {
  const baseUrl = "https://ai.nusense.ddns.net";
  const queryParams = new URLSearchParams({
    email: params.email,
    page: (params.page || 1).toString(),
    limit: (params.limit || 10).toString(),
  });
  if (params.store) queryParams.append("store", params.store);
  if (params.startDate) queryParams.append("startDate", params.startDate);
  if (params.endDate) queryParams.append("endDate", params.endDate);
  const url = `${baseUrl}/api/image-generations/uploaded-images?${queryParams.toString()}`;
  const response = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
    mode: "cors",
    credentials: "omit",
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`);
  }
  return response.json();
}
