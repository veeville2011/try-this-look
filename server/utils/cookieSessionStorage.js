/**
 * Cookie-Based Session Storage for Shopify OAuth
 * 
 * This implementation stores OAuth state in signed HTTP cookies to work
 * reliably across Vercel serverless function invocations.
 * 
 * The OAuth state parameter is stored in a cookie when /auth begins,
 * and retrieved from the cookie when /auth/callback validates.
 * This avoids the serverless instance memory isolation issue.
 */

import crypto from "crypto";
import * as logger from "./logger.js";

// Cookie configuration
const OAUTH_STATE_COOKIE_NAME = "__nusense_oauth_state";
const COOKIE_MAX_AGE_SECONDS = 600; // 10 minutes (OAuth state expiry)

/**
 * Create a signed value to prevent tampering
 * @param {string} value - Value to sign
 * @param {string} secret - Secret key for signing
 * @returns {string} - Signed value (value.signature)
 */
const signValue = (value, secret) => {
  const signature = crypto
    .createHmac("sha256", secret)
    .update(value)
    .digest("base64url");
  return `${value}.${signature}`;
};

/**
 * Verify and extract the original value from a signed value
 * @param {string} signedValue - The signed value (value.signature)
 * @param {string} secret - Secret key for verification
 * @returns {string|null} - Original value if valid, null if invalid
 */
const unsignValue = (signedValue, secret) => {
  if (!signedValue || typeof signedValue !== "string") {
    return null;
  }

  const lastDotIndex = signedValue.lastIndexOf(".");
  if (lastDotIndex === -1) {
    return null;
  }

  const value = signedValue.slice(0, lastDotIndex);
  const signature = signedValue.slice(lastDotIndex + 1);

  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(value)
    .digest("base64url");

  // Constant-time comparison to prevent timing attacks
  if (signature.length !== expectedSignature.length) {
    return null;
  }

  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (!crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
    return null;
  }

  return value;
};

/**
 * Parse cookies from the Cookie header
 * @param {string} cookieHeader - The Cookie header value
 * @returns {Object} - Parsed cookies as key-value pairs
 */
const parseCookies = (cookieHeader) => {
  const cookies = {};
  if (!cookieHeader) {
    return cookies;
  }

  cookieHeader.split(";").forEach((cookie) => {
    const [name, ...valueParts] = cookie.split("=");
    const trimmedName = name?.trim();
    if (trimmedName) {
      cookies[trimmedName] = decodeURIComponent(valueParts.join("=").trim());
    }
  });

  return cookies;
};

/**
 * Cookie-Based Session Storage Class
 * 
 * Implements Shopify's session storage interface using HTTP cookies.
 * This is specifically designed for OAuth state storage in serverless environments.
 */
export class CookieSessionStorage {
  constructor(secret) {
    if (!secret) {
      throw new Error("CookieSessionStorage requires a secret for signing cookies");
    }
    this.secret = secret;
    // In-memory cache for the current request lifecycle
    // This is NOT for persistence - it's for same-request access
    this.requestCache = new Map();
    // Reference to response object for setting cookies
    this.currentRes = null;
    this.currentReq = null;
  }

  /**
   * Set the current request/response objects
   * Must be called before each OAuth operation
   */
  setRequestContext(req, res) {
    this.currentReq = req;
    this.currentRes = res;
  }

  /**
   * Store a session (OAuth state)
   * Sets a signed cookie with the session data
   */
  async storeSession(session) {
    if (!session || !session.id) {
      logger.warn("[COOKIE_SESSION] Attempted to store invalid session", {
        hasSession: !!session,
        hasId: !!session?.id,
      });
      return false;
    }

    try {
      // Serialize session to JSON
      const sessionData = JSON.stringify({
        id: session.id,
        shop: session.shop,
        state: session.state,
        isOnline: session.isOnline,
        scope: session.scope,
        accessToken: session.accessToken,
        expires: session.expires,
        // Store timestamp for debugging
        createdAt: Date.now(),
      });

      // Sign the session data
      const signedData = signValue(sessionData, this.secret);

      // Store in request cache for same-request access
      this.requestCache.set(session.id, session);

      // Set the cookie if we have a response object
      if (this.currentRes && !this.currentRes.headersSent) {
        const cookieValue = encodeURIComponent(signedData);
        const cookieName = `${OAUTH_STATE_COOKIE_NAME}_${session.id.replace(/[^a-zA-Z0-9]/g, "_")}`;
        
        // Set cookie with security attributes
        const cookieOptions = [
          `${cookieName}=${cookieValue}`,
          `Max-Age=${COOKIE_MAX_AGE_SECONDS}`,
          "Path=/",
          "HttpOnly",
          "SameSite=Lax", // Allow top-level navigation (OAuth redirects)
        ];

        // Add Secure flag in production
        if (process.env.NODE_ENV === "production" || process.env.VERCEL) {
          cookieOptions.push("Secure");
        }

        this.currentRes.setHeader("Set-Cookie", cookieOptions.join("; "));

        logger.info("[COOKIE_SESSION] Session stored in cookie", {
          sessionId: session.id,
          shop: session.shop,
          hasState: !!session.state,
          cookieName,
        });
      } else {
        // Fallback: just use in-memory cache
        logger.warn("[COOKIE_SESSION] No response object available, using in-memory cache only", {
          sessionId: session.id,
          hasRes: !!this.currentRes,
          headersSent: this.currentRes?.headersSent,
        });
      }

      return true;
    } catch (error) {
      logger.error("[COOKIE_SESSION] Failed to store session", error, null, {
        sessionId: session?.id,
      });
      return false;
    }
  }

  /**
   * Load a session (OAuth state)
   * Retrieves from cookie and verifies signature
   */
  async loadSession(sessionId) {
    if (!sessionId) {
      return undefined;
    }

    // Check in-memory cache first (same-request optimization)
    if (this.requestCache.has(sessionId)) {
      const cached = this.requestCache.get(sessionId);
      logger.info("[COOKIE_SESSION] Session loaded from request cache", {
        sessionId,
        shop: cached?.shop,
      });
      return cached;
    }

    // Try to load from cookie
    if (this.currentReq) {
      try {
        const cookieHeader = this.currentReq.headers.cookie || this.currentReq.headers.Cookie || "";
        const cookies = parseCookies(cookieHeader);
        
        const cookieName = `${OAUTH_STATE_COOKIE_NAME}_${sessionId.replace(/[^a-zA-Z0-9]/g, "_")}`;
        const signedData = cookies[cookieName];

        if (signedData) {
          // Verify signature and extract data
          const sessionData = unsignValue(decodeURIComponent(signedData), this.secret);
          
          if (sessionData) {
            const session = JSON.parse(sessionData);
            
            // Check if session has expired (based on createdAt + MAX_AGE)
            const age = Date.now() - (session.createdAt || 0);
            if (age > COOKIE_MAX_AGE_SECONDS * 1000) {
              logger.warn("[COOKIE_SESSION] Session expired", {
                sessionId,
                ageSeconds: Math.round(age / 1000),
                maxAgeSeconds: COOKIE_MAX_AGE_SECONDS,
              });
              return undefined;
            }

            // Cache for subsequent access in same request
            this.requestCache.set(sessionId, session);

            logger.info("[COOKIE_SESSION] Session loaded from cookie", {
              sessionId,
              shop: session.shop,
              hasState: !!session.state,
              ageSeconds: Math.round(age / 1000),
            });

            return session;
          } else {
            logger.warn("[COOKIE_SESSION] Cookie signature verification failed", {
              sessionId,
              cookieName,
            });
          }
        } else {
          logger.warn("[COOKIE_SESSION] Session cookie not found", {
            sessionId,
            cookieName,
            availableCookies: Object.keys(cookies),
          });
        }
      } catch (error) {
        logger.error("[COOKIE_SESSION] Failed to load session from cookie", error, null, {
          sessionId,
        });
      }
    } else {
      logger.warn("[COOKIE_SESSION] No request object available for loading session", {
        sessionId,
      });
    }

    return undefined;
  }

  /**
   * Delete a session
   * Clears the cookie
   */
  async deleteSession(sessionId) {
    if (!sessionId) {
      return true;
    }

    // Remove from in-memory cache
    this.requestCache.delete(sessionId);

    // Clear the cookie
    if (this.currentRes && !this.currentRes.headersSent) {
      const cookieName = `${OAUTH_STATE_COOKIE_NAME}_${sessionId.replace(/[^a-zA-Z0-9]/g, "_")}`;
      
      const cookieOptions = [
        `${cookieName}=`,
        "Max-Age=0",
        "Path=/",
        "HttpOnly",
        "SameSite=Lax",
      ];

      if (process.env.NODE_ENV === "production" || process.env.VERCEL) {
        cookieOptions.push("Secure");
      }

      this.currentRes.setHeader("Set-Cookie", cookieOptions.join("; "));

      logger.info("[COOKIE_SESSION] Session cookie deleted", {
        sessionId,
        cookieName,
      });
    }

    return true;
  }

  /**
   * Delete all sessions for a shop
   * For cookies, we can only clear cached sessions
   */
  async deleteSessionsByShop(shop) {
    // Clear from in-memory cache
    for (const [id, session] of this.requestCache.entries()) {
      if (session.shop === shop) {
        this.requestCache.delete(id);
      }
    }
    return true;
  }

  /**
   * Find sessions by shop
   * For cookies, we can only search the in-memory cache
   */
  async findSessionsByShop(shop) {
    const sessions = [];
    for (const [id, session] of this.requestCache.entries()) {
      if (session.shop === shop) {
        sessions.push(session);
      }
    }
    return sessions;
  }
}

/**
 * Create a cookie session storage middleware
 * This ensures the session storage has access to req/res for each request
 */
export const createCookieSessionMiddleware = (sessionStorage) => {
  return (req, res, next) => {
    // Set request context for session storage
    sessionStorage.setRequestContext(req, res);
    next();
  };
};

export default CookieSessionStorage;

