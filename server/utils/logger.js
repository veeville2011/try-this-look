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
 * Format log message with timestamp and log level
 * Enhanced with better formatting for readability
 */
const formatLogMessage = (level, message, metadata = {}) => {
  const timestamp = new Date().toISOString();
  const levelName = LOG_LEVEL_NAMES[level];
  
  // Format metadata for better readability
  let metadataStr = "";
  if (Object.keys(metadata).length > 0) {
    try {
      // Truncate very long values for readability
      const truncatedMetadata = {};
      for (const [key, value] of Object.entries(metadata)) {
        if (typeof value === "string" && value.length > 500) {
          truncatedMetadata[key] = value.substring(0, 500) + "... [truncated]";
        } else if (typeof value === "object" && value !== null) {
          const str = JSON.stringify(value);
          truncatedMetadata[key] = str.length > 500 ? str.substring(0, 500) + "... [truncated]" : value;
        } else {
          truncatedMetadata[key] = value;
        }
      }
      metadataStr = JSON.stringify(truncatedMetadata, null, 2);
    } catch (e) {
      metadataStr = "[Metadata serialization failed]";
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
 */
const error = (message, error = null, metadata = {}) => {
  if (currentLogLevel >= LOG_LEVELS.ERROR) {
    const errorMetadata = {
      ...metadata,
      ...(error && {
        error: {
          message: error.message,
          stack: error.stack,
          name: error.name,
        },
      }),
    };
    console.error(formatLogMessage(LOG_LEVELS.ERROR, message, errorMetadata));
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
  const requestMetadata = {
    method: req.method,
    path: req.path,
    query: req.query,
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get("user-agent"),
    ...metadata,
  };
  info(`${req.method} ${req.path}`, requestMetadata);
};

/**
 * Log HTTP response
 */
const logResponse = (req, res, metadata = {}) => {
  const responseMetadata = {
    method: req.method,
    path: req.path,
    statusCode: res.statusCode,
    ...metadata,
  };
  info(`${req.method} ${req.path} ${res.statusCode}`, responseMetadata);
};

/**
 * Log error with request context
 */
const logError = (message, error, req = null, metadata = {}) => {
  const errorMetadata = {
    ...metadata,
    ...(req && {
      request: {
        method: req.method,
        path: req.path,
        query: req.query,
        body: req.body ? (typeof req.body === "object" ? JSON.stringify(req.body).substring(0, 500) : String(req.body).substring(0, 500)) : undefined,
        ip: req.ip || req.connection?.remoteAddress,
        userAgent: req.get("user-agent"),
        headers: {
          authorization: req.get("authorization") ? "present" : "missing",
          contentType: req.get("content-type"),
        },
      },
    }),
    ...(error && {
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name,
        code: error.code,
        cause: error.cause,
      },
    }),
  };
  error(message, error, errorMetadata);
};

/**
 * Log GraphQL operation with detailed request/response info
 */
const logGraphQL = (operation, variables, response, duration, metadata = {}) => {
  const graphqlMetadata = {
    ...metadata,
    operation,
    variables: variables ? (typeof variables === "object" ? JSON.stringify(variables).substring(0, 1000) : String(variables)) : undefined,
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

