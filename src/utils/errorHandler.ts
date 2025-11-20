/**
 * Centralized error handling utilities for frontend
 * Provides clean, exact error logging and user-friendly error messages
 */

export interface ErrorDetails {
  message: string;
  code?: string;
  status?: number;
  requestId?: string;
  timestamp?: string;
  originalError?: unknown;
}

/**
 * Extract clean error information from various error types
 */
export const extractErrorDetails = (error: unknown): ErrorDetails => {
  const timestamp = new Date().toISOString();
  
  // Handle Error objects
  if (error instanceof Error) {
    return {
      message: error.message || "An unknown error occurred",
      code: (error as any).code,
      timestamp,
      originalError: error,
    };
  }
  
  // Handle Response objects (fetch errors)
  if (error && typeof error === "object" && "status" in error) {
    const response = error as Response;
    return {
      message: `HTTP ${response.status}: ${response.statusText || "Unknown error"}`,
      code: `HTTP_${response.status}`,
      status: response.status,
      timestamp,
      originalError: error,
    };
  }
  
  // Handle string errors
  if (typeof error === "string") {
    return {
      message: error,
      timestamp,
      originalError: error,
    };
  }
  
  // Fallback for unknown error types
  return {
    message: "An unexpected error occurred",
    timestamp,
    originalError: error,
  };
};

/**
 * Log error with detailed information
 */
export const logError = (
  context: string,
  error: unknown,
  additionalInfo?: Record<string, unknown>
): ErrorDetails => {
  const errorDetails = extractErrorDetails(error);
  const timestamp = new Date().toISOString();
  
  // Build comprehensive log object
  const logData = {
    timestamp,
    context,
    error: {
      message: errorDetails.message,
      code: errorDetails.code,
      status: errorDetails.status,
      requestId: errorDetails.requestId,
    },
    ...(additionalInfo && { additionalInfo }),
    ...(error instanceof Error && {
      stack: error.stack?.split('\n').slice(0, 5).join('\n'), // First 5 lines
      errorType: error.constructor.name,
    }),
  };
  
  // Log to console with clean formatting
  console.error(`[${timestamp}] [ERROR] [${context}]`, logData);
  
  // Also log a one-line summary
  const summary = `${errorDetails.code ? `[${errorDetails.code}] ` : ''}${errorDetails.message}`;
  console.error(`[${timestamp}] [ERROR SUMMARY] [${context}] ${summary}`);
  
  return errorDetails;
};

/**
 * Log API error response with detailed information
 */
export const logApiError = async (
  context: string,
  response: Response,
  additionalInfo?: Record<string, unknown>
): Promise<ErrorDetails> => {
  const timestamp = new Date().toISOString();
  
  // Try to extract error data from response
  let errorData: any = {};
  try {
    const text = await response.text();
    if (text) {
      try {
        errorData = JSON.parse(text);
      } catch {
        errorData = { rawResponse: text.substring(0, 500) };
      }
    }
  } catch (e) {
    errorData = { parseError: "Failed to parse error response" };
  }
  
  const errorDetails: ErrorDetails = {
    message: errorData.message || errorData.error || `HTTP ${response.status}: ${response.statusText}`,
    code: errorData.code || errorData.error || `HTTP_${response.status}`,
    status: response.status,
    requestId: errorData.requestId,
    timestamp,
  };
  
  // Log comprehensive error information
  const logData = {
    timestamp,
    context,
    response: {
      status: response.status,
      statusText: response.statusText,
      url: response.url,
      headers: Object.fromEntries(response.headers.entries()),
    },
    error: errorDetails,
    errorData,
    ...(additionalInfo && { additionalInfo }),
  };
  
  console.error(`[${timestamp}] [API ERROR] [${context}]`, logData);
  
  // Log summary
  const summary = `HTTP ${response.status}: ${errorDetails.message}`;
  console.error(`[${timestamp}] [API ERROR SUMMARY] [${context}] ${summary}`);
  
  return errorDetails;
};

/**
 * Create user-friendly error message from error details
 */
export const getUserFriendlyMessage = (errorDetails: ErrorDetails): string => {
  // Map common error codes to user-friendly messages
  const errorMessages: Record<string, string> = {
    NETWORK_ERROR: "Network connection failed. Please check your internet connection and try again.",
    HTTP_401: "Authentication failed. Please refresh the page and try again.",
    HTTP_403: "You don't have permission to perform this action.",
    HTTP_404: "The requested resource was not found.",
    HTTP_500: "Server error occurred. Please try again later.",
    HTTP_502: "Service temporarily unavailable. Please try again in a moment.",
    HTTP_503: "Service is currently unavailable. Please try again later.",
    HTTP_504: "Request timed out. Please try again.",
    TIMEOUT: "The request took too long. Please try again.",
    VALIDATION_ERROR: "Invalid input. Please check your data and try again.",
  };
  
  // Return user-friendly message if available, otherwise use the error message
  if (errorDetails.code && errorMessages[errorDetails.code]) {
    return errorMessages[errorDetails.code];
  }
  
  return errorDetails.message || "An unexpected error occurred. Please try again.";
};

/**
 * Safe async error handler wrapper
 */
export const withErrorHandling = async <T>(
  context: string,
  fn: () => Promise<T>,
  onError?: (error: ErrorDetails) => void
): Promise<T | null> => {
  try {
    return await fn();
  } catch (error) {
    const errorDetails = logError(context, error);
    if (onError) {
      onError(errorDetails);
    }
    return null;
  }
};

