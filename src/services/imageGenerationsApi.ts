import type {
  ImageGenerationsResponse,
  FetchImageGenerationsParams,
} from "@/types/imageGenerations";

const API_BASE_URL = "https://try-on-server-v1.onrender.com/api";

export const fetchImageGenerations = async (
  params: FetchImageGenerationsParams = {}
): Promise<ImageGenerationsResponse> => {
  const {
    page = 1,
    limit = 10,
    orderBy = "createdAt",
    orderDirection = "DESC",
  } = params;

  const queryParams = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
    orderBy,
    orderDirection,
  });

  const url = `${API_BASE_URL}/image-generations/all?${queryParams.toString()}`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data: ImageGenerationsResponse = await response.json();
    return data;
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? error.message
        : "Failed to fetch image generations"
    );
  }
};

