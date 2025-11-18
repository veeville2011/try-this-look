import type {
  VideoGenerationsResponse,
  FetchVideoGenerationsParams,
} from "@/types/videoGenerations";

const API_BASE_URL = "https://try-on-server-v1.onrender.com/api";

export const fetchVideoGenerations = async (
  params: FetchVideoGenerationsParams = {}
): Promise<VideoGenerationsResponse> => {
  const {
    page = 1,
    limit = 50,
    status,
    orderBy = "created_at",
    orderDirection = "DESC",
    user,
  } = params;

  const queryParams = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
    orderBy,
    orderDirection,
  });

  // Add optional parameters only if provided
  if (status) {
    queryParams.append("status", status);
  }
  if (user) {
    queryParams.append("user", user);
  }

  const url = `${API_BASE_URL}/video-generations/all?${queryParams.toString()}`;

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

    const data: VideoGenerationsResponse = await response.json();
    return data;
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? error.message
        : "Failed to fetch video generations"
    );
  }
};

