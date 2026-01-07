import type {
  ImageGenerationsResponse,
  FetchImageGenerationsParams,
} from "@/types/imageGenerations";
import { authenticatedFetch } from "@/utils/authenticatedFetch";
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

export const fetchImageGenerations = async (
  params: FetchImageGenerationsParams = {}
): Promise<ImageGenerationsResponse> => {
  const {
    page = 1,
    limit = 50,
    status,
    orderBy = "created_at",
    orderDirection = "DESC",
    user,
    storeName,
  } = params;

  const queryParams = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
    orderBy,
    orderDirection,
  });

  // Add optional parameters only if they are provided
  if (status) {
    queryParams.append("status", status);
  }
  if (user) {
    queryParams.append("user", user);
  }
  if (storeName) {
    queryParams.append("storeName", storeName);
  }

  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}/api/image-generations/all?${queryParams.toString()}`;

  try {
    const response = await authenticatedFetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      await logApiError("[IMAGE_GENERATIONS]", response, { url });
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data: ImageGenerationsResponse = await response.json();
    return data;
  } catch (error) {
    logError("[IMAGE_GENERATIONS] Failed to fetch image generations", error, { url });
    throw new Error(
      error instanceof Error
        ? error.message
        : "Failed to fetch image generations"
    );
  }
};

