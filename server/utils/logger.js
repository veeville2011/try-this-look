/**
 * Logger utility for server-side logging
 * Provides structured logging with different log levels
 */

const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
};

const LOG_LEVEL_NAMES = {
  0: "ERROR",
  1: "WARN",
  2: "INFO",
  3: "DEBUG",
};

// Get log level from environment or default to INFO
const getLogLevel = () => {
  const envLevel = process.env.LOG_LEVEL?.toUpperCase();
  return LOG_LEVELS[envLevel] !== undefined ? LOG_LEVELS[envLevel] : LOG_LEVELS.INFO;
};

const currentLogLevel = getLogLevel();

/**
 * Safe JSON stringify that handles circular references and other problematic values
 */
const safeStringify = (obj, space = null, maxDepth = 10) => {
  const seen = new WeakSet();
  const replacer = (key, value) => {
    // Handle circular references
    if (typeof value === "object" && value !== null) {
      if (seen.has(value)) {
        return "[Circular Reference]";
      }
      seen.add(value);
    }
    
    // Handle functions
    if (typeof value === "function") {
      return `[Function: ${value.name || "anonymous"}]`;
    }
    
    // Handle undefined
    if (value === undefined) {
      return "[undefined]";
    }
    
    // Handle Error objects
    if (value instanceof Error) {
      return {
        name: value.name,
        message: value.message,
        stack: value.stack,
        code: value.code,
      };
    }
    
    // Handle Date objects
    if (value instanceof Date) {
      return value.toISOString();
    }
    
    // Handle Buffer objects
    if (Buffer.isBuffer(value)) {
      return `[Buffer: ${value.length} bytes]`;
    }
    
    // Handle objects with too much nesting
    if (maxDepth <= 0) {
      return "[Max Depth Reached]";
    }
    
    return value;
  };
  
  try {
    return JSON.stringify(obj, replacer, space);
  } catch (error) {
    // If stringify still fails, return a safe representation
    try {
      return JSON.stringify({
        error: "Failed to stringify object",
        errorMessage: error.message,
        type: typeof obj,
        constructor: obj?.constructor?.name,
      }, null, space);
    } catch {
      return "[Unable to serialize object]";
    }
  }
};

/**
 * Safely extract serializable data from an object, handling circular references
 * Uses WeakSet to track visited objects and prevent infinite loops
 */
const sanitizeObject = (obj, maxDepth = 5, currentDepth = 0, seen = new WeakSet()) => {
  if (currentDepth >= maxDepth) {
    return "[Max Depth Reached]";
  }
  
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  // Handle primitives
  if (typeof obj !== "object") {
    return obj;
  }
  
  // Check for circular references using WeakSet
  if (seen.has(obj)) {
    return "[Circular Reference]";
  }
  seen.add(obj);
  
  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item, maxDepth, currentDepth + 1, seen));
  }
  
  // Handle Date
  if (obj instanceof Date) {
    return obj.toISOString();
  }
  
  // Handle Error
  if (obj instanceof Error) {
    return {
      name: obj.name,
      message: obj.message,
      stack: obj.stack?.substring(0, 500),
      code: obj.code,
    };
  }
  
  // Handle Buffer
  if (Buffer.isBuffer(obj)) {
    return `[Buffer: ${obj.length} bytes]`;
  }
  
  // Handle functions
  if (typeof obj === "function") {
    return `[Function: ${obj.name || "anonymous"}]`;
  }
  
  // Handle plain objects
  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    // Skip known problematic properties that cause circular references
    if (key === "socket" || key === "connection" || key === "parser" || 
        key === "_httpMessage" || key === "client" || key === "server" ||
        key === "req" || key === "res" || key === "next") {
      sanitized[key] = "[Skipped: Circular Reference Risk]";
      continue;
    }
    
    try {
      sanitized[key] = sanitizeObject(value, maxDepth, currentDepth + 1, seen);
    } catch (e) {
      sanitized[key] = `[Error serializing: ${e.message}]`;
    }
  }
  
  return sanitized;
};

/**
 * Format log message with timestamp and log level
 * Enhanced with better formatting for readability and circular reference handling
 */
const formatLogMessage = (level, message, metadata = {}) => {
  const timestamp = new Date().toISOString();
  const levelName = LOG_LEVEL_NAMES[level];
  
  // Format metadata for better readability
  let metadataStr = "";
  if (Object.keys(metadata).length > 0) {
    try {
      // Sanitize metadata to remove circular references
      const sanitizedMetadata = sanitizeObject(metadata);
      
      // Truncate very long values for readability
      const truncatedMetadata = {};
      for (const [key, value] of Object.entries(sanitizedMetadata)) {
        if (typeof value === "string" && value.length > 500) {
          truncatedMetadata[key] = value.substring(0, 500) + "... [truncated]";
        } else {
          truncatedMetadata[key] = value;
        }
      }
      
      // Use safe stringify
      metadataStr = safeStringify(truncatedMetadata, 2);
    } catch (e) {
      metadataStr = `[Metadata serialization failed: ${e.message}]`;
    }
  }
  
  return `[${timestamp}] [${levelName}] ${message}${metadataStr ? `\n${metadataStr}` : ""}`;
};

/**
 * Create a performance timer for tracking operation duration
 */
const createTimer = (operationName) => {
  const startTime = Date.now();
  return {
    start: startTime,
    elapsed: () => Date.now() - startTime,
    elapsedMs: () => `${Date.now() - startTime}ms`,
    log: (message, metadata = {}) => {
      info(`${operationName}: ${message}`, {
        ...metadata,
        elapsed: `${Date.now() - startTime}ms`,
      });
    },
  };
};

/**
 * Log error message
 * Handles cases where req object might be passed as metadata
 */
const error = (message, error = null, metadata = {}) => {
  if (currentLogLevel >= LOG_LEVELS.ERROR) {
    let safeMetadata = {};
    
    // Always sanitize metadata to handle circular references
    try {
      // Check if metadata itself is a req object (Express request)
      if (metadata && typeof metadata === "object") {
        // If metadata has properties that suggest it's a req object, extract safe info
        if (metadata.method !== undefined || metadata.path !== undefined || metadata.url !== undefined) {
          // This is likely a req object, extract safe info
          const requestInfo = extractRequestInfo(metadata);
          safeMetadata = { request: requestInfo };
        } else {
          // Sanitize all metadata values to handle circular references
          safeMetadata = sanitizeObject(metadata);
        }
      } else {
        safeMetadata = metadata;
      }
    } catch (e) {
      // If sanitization fails, create a minimal safe representation
      safeMetadata = {
        error: "Failed to sanitize metadata",
        errorMessage: e.message,
      };
    }
    
    const errorMetadata = {
      ...safeMetadata,
      ...(error && {
        error: {
          message: error.message,
          stack: error.stack?.substring(0, 1000), // Truncate stack
          name: error.name,
          code: error.code,
        },
      }),
    };
    
    // Use safeStringify directly instead of formatLogMessage to avoid double processing
    try {
      const timestamp = new Date().toISOString();
      const levelName = LOG_LEVEL_NAMES[LOG_LEVELS.ERROR];
      const metadataStr = Object.keys(errorMetadata).length > 0 
        ? "\n" + safeStringify(errorMetadata, 2)
        : "";
      console.error(`[${timestamp}] [${levelName}] ${message}${metadataStr}`);
    } catch (e) {
      // Ultimate fallback - just log the message
      console.error(`[${new Date().toISOString()}] [ERROR] ${message} [Metadata serialization failed: ${e.message}]`);
    }
  }
};

/**
 * Log warning message
 */
const warn = (message, metadata = {}) => {
  if (currentLogLevel >= LOG_LEVELS.WARN) {
    console.warn(formatLogMessage(LOG_LEVELS.WARN, message, metadata));
  }
};

/**
 * Log info message
 */
const info = (message, metadata = {}) => {
  if (currentLogLevel >= LOG_LEVELS.INFO) {
    console.log(formatLogMessage(LOG_LEVELS.INFO, message, metadata));
  }
};

/**
 * Log debug message
 */
const debug = (message, metadata = {}) => {
  if (currentLogLevel >= LOG_LEVELS.DEBUG) {
    console.debug(formatLogMessage(LOG_LEVELS.DEBUG, message, metadata));
  }
};

/**
 * Log HTTP request
 */
const logRequest = (req, metadata = {}) => {
  try {
    const requestMetadata = {
      method: req?.method,
      path: req?.path,
      query: req?.query ? sanitizeObject(req.query) : undefined,
      ip: req?.ip || req?.connection?.remoteAddress || req?.socket?.remoteAddress,
      userAgent: req?.get ? req.get("user-agent") : undefined,
      ...metadata,
    };
    info(`${req?.method || "UNKNOWN"} ${req?.path || "UNKNOWN"}`, requestMetadata);
  } catch (e) {
    // Fallback if request logging fails
    info("Request received", { error: "Failed to log request details", errorMessage: e.message });
  }
};

/**
 * Log HTTP response
 */
const logResponse = (req, res, metadata = {}) => {
  try {
    const responseMetadata = {
      method: req?.method,
      path: req?.path,
      statusCode: res?.statusCode,
      ...metadata,
    };
    info(`${req?.method || "UNKNOWN"} ${req?.path || "UNKNOWN"} ${res?.statusCode || "UNKNOWN"}`, responseMetadata);
  } catch (e) {
    // Fallback if response logging fails
    info("Response sent", { error: "Failed to log response details", errorMessage: e.message });
  }
};

/**
 * Safely extract request information without circular references
 * Uses only safe property access, never accesses nested objects that might be circular
 */
const extractRequestInfo = (req) => {
  if (!req) return null;
  
  try {
    // Safely extract body - use try-catch for each access
    let bodyInfo = undefined;
    try {
      if (req.body !== undefined && req.body !== null) {
        if (typeof req.body === "string") {
          bodyInfo = req.body.substring(0, 500);
        } else if (typeof req.body === "object") {
          // Use safeStringify which handles circular references
          const bodyStr = safeStringify(req.body);
          bodyInfo = bodyStr.length > 500 ? bodyStr.substring(0, 500) + "... [truncated]" : bodyStr;
        } else {
          bodyInfo = String(req.body).substring(0, 500);
        }
      }
    } catch (e) {
      bodyInfo = "[Unable to serialize body]";
    }
    
    // Extract query safely
    let queryInfo = undefined;
    try {
      if (req.query) {
        queryInfo = sanitizeObject(req.query);
      }
    } catch (e) {
      queryInfo = "[Unable to serialize query]";
    }
    
    // Extract IP safely - avoid accessing nested objects
    let ipInfo = undefined;
    try {
      ipInfo = req.ip;
      if (!ipInfo && req.connection) {
        ipInfo = req.connection.remoteAddress;
      }
      if (!ipInfo && req.socket) {
        ipInfo = req.socket.remoteAddress;
      }
    } catch (e) {
      ipInfo = "[Unable to extract IP]";
    }
    
    // Extract headers safely
    let headersInfo = {};
    try {
      if (req.get && typeof req.get === "function") {
        headersInfo = {
          authorization: req.get("authorization") ? "present" : "missing",
          contentType: req.get("content-type") || undefined,
          accept: req.get("accept") || undefined,
        };
      }
    } catch (e) {
      headersInfo = { error: "Unable to extract headers" };
    }
    
    return {
      method: req.method,
      path: req.path,
      url: req.url,
      query: queryInfo,
      body: bodyInfo,
      ip: ipInfo,
      userAgent: (req.get && typeof req.get === "function") ? req.get("user-agent") : undefined,
      headers: headersInfo,
    };
  } catch (e) {
    return {
      error: "Failed to extract request info",
      errorMessage: e.message,
    };
  }
};

/**
 * Log error with request context
 */
const logError = (message, error, req = null, metadata = {}) => {
  const errorMetadata = {
    ...metadata,
    ...(req && {
      request: extractRequestInfo(req),
    }),
    ...(error && {
      error: {
        message: error.message,
        stack: error.stack?.substring(0, 1000), // Truncate stack trace
        name: error.name,
        code: error.code,
        cause: error.cause ? String(error.cause).substring(0, 200) : undefined,
      },
    }),
  };
  error(message, error, errorMetadata);
};

/**
 * Log GraphQL operation with detailed request/response info
 */
const logGraphQL = (operation, variables, response, duration, metadata = {}) => {
  let variablesStr = undefined;
  if (variables) {
    try {
      if (typeof variables === "object") {
        variablesStr = safeStringify(variables);
        if (variablesStr.length > 1000) {
          variablesStr = variablesStr.substring(0, 1000) + "... [truncated]";
        }
      } else {
        variablesStr = String(variables).substring(0, 1000);
      }
    } catch (e) {
      variablesStr = "[Unable to serialize variables]";
    }
  }
  
  const graphqlMetadata = {
    ...metadata,
    operation,
    variables: variablesStr,
    duration: `${duration}ms`,
    hasResponse: !!response,
    responseType: typeof response,
    hasErrors: !!(response?.body?.errors || response?.body?.data?.userErrors || response?.errors),
    errors: response?.body?.errors || response?.body?.data?.userErrors || response?.errors,
  };
  info(`[GRAPHQL] ${operation}`, graphqlMetadata);
};

/**
 * Express middleware for request logging
 */
const requestLogger = (req, res, next) => {
  // Log request
  logRequest(req);

  // Log response when finished
  res.on("finish", () => {
    logResponse(req, res);
  });

  next();
};

/**
 * Express middleware for error logging
 */
const errorLogger = (err, req, res, next) => {
  logError("Request error", err, req);
  next(err);
};

export {
  error,
  warn,
  info,
  debug,
  logRequest,
  logResponse,
  logError,
  logGraphQL,
  requestLogger,
  errorLogger,
  createTimer,
  LOG_LEVELS,
};

