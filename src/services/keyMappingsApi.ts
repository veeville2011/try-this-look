const API_BASE_URL = "https://ai.nusense.ddns.net/api";

export interface KeyMappingsParams {
  clothingKey?: string;
  personKey?: string;
}

export interface KeyMappingsResponse {
  status: "success" | "error";
  data?: {
    clothingKey?: string;
    personKeys?: string[];
    personKey?: string;
    clothingKeys?: string[];
  };
  metadata?: {
    personKeysCount: number;
    clothingKeysCount: number;
  };
  error_message?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  timestamp?: string;
}

export const fetchKeyMappings = async (
  params: KeyMappingsParams
): Promise<KeyMappingsResponse> => {
  const { clothingKey, personKey } = params;

  // Validate that at least one parameter is provided
  if (!clothingKey && !personKey) {
    return {
      status: "error",
      error_message: {
        code: "VALIDATION_ERROR",
        message: "At least one of 'clothingKey' or 'personKey' query parameter is required",
        details: { provided: { clothingKey: false, personKey: false } },
      },
    };
  }

  const queryParams = new URLSearchParams();

  if (clothingKey) {
    queryParams.append("clothingKey", clothingKey.trim());
  }

  if (personKey) {
    queryParams.append("personKey", personKey.trim());
  }

  const url = `${API_BASE_URL}/key-mappings?${queryParams.toString()}`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        status: "error",
        error_message: {
          code: errorData.error_message?.code || `HTTP_${response.status}`,
          message:
            errorData.error_message?.message ||
            `HTTP ${response.status}: ${response.statusText}`,
          details: errorData.error_message?.details,
        },
        timestamp: errorData.timestamp,
      };
    }

    const data: KeyMappingsResponse = await response.json();
    return data;
  } catch (error) {
    return {
      status: "error",
      error_message: {
        code: "NETWORK_ERROR",
        message:
          error instanceof Error
            ? error.message
            : "Failed to fetch key mappings",
      },
    };
  }
};

