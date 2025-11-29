import "@shopify/shopify-api/adapters/node";
import express from "express";
import {
  shopifyApi,
  LATEST_API_VERSION,
  RequestedTokenType,
} from "@shopify/shopify-api";
import { restResources } from "@shopify/shopify-api/rest/admin/2024-01";
import { join } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import dotenv from "dotenv";
import crypto from "crypto";
import * as logger from "./utils/logger.js";
import * as billing from "./utils/billing.js";
import * as subscriptionMetafield from "./utils/subscriptionMetafield.js";
// No database - using no-op session storage (sessions not persisted)

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
// In Vercel, environment variables are automatically available
// Only load .env file in local development
if (process.env.VERCEL !== "1" && !process.env.VERCEL_ENV) {
  try {
    dotenv.config({ path: join(__dirname, "../.env") });
  } catch (error) {
    // Could not load .env file
  }
}

const portInput = process.env.VITE_PORT || process.env.PORT || "3000";
const PORT = Number.parseInt(portInput, 10);
const isDev =
  (process.env.VITE_NODE_ENV || process.env.NODE_ENV) !== "production";

// Initialize Shopify API
// Validate required environment variables
const apiKey = process.env.VITE_SHOPIFY_API_KEY;
const apiSecret = process.env.VITE_SHOPIFY_API_SECRET;
const appUrl = process.env.VITE_SHOPIFY_APP_URL;

if (!apiKey || !apiSecret) {
  // Missing required environment variables
}

// Extract hostname from app URL safely
let hostName = "localhost";
if (appUrl) {
  try {
    const url = new URL(appUrl);
    hostName = url.hostname;
  } catch (error) {
    // If URL parsing fails, try to extract hostname manually
    hostName = appUrl
      .replace(/^https?:\/\//, "")
      .split("/")[0]
      .split(":")[0];
  }
}

// No-op session storage - required by Shopify API but does nothing
// Sessions are not stored. Billing API uses JWT tokens from embedded UI.
class NoOpSessionStorage {
  async storeSession(session) {
    // No-op - sessions not persisted
  }

  async loadSession(sessionId) {
    return undefined;
  }

  async deleteSession(sessionId) {
    // No-op
  }

  async deleteSessionsByShop(shop) {
    // No-op
  }

  async findSessionsByShop(shop) {
    return [];
  }
}

logger.info("[INIT] Using no-op session storage", {
  storageType: "NoOpSessionStorage",
  note: "Sessions not stored. Billing API uses JWT from embedded UI.",
});

const sessionStorage = new NoOpSessionStorage();

const shopify = shopifyApi({
  apiKey: apiKey || "",
  apiSecretKey: apiSecret || "",
  scopes: (process.env.VITE_SCOPES || "")
    .split(",")
    .map((scope) => scope.trim())
    .filter(Boolean),
  hostName: hostName,
  apiVersion: LATEST_API_VERSION,
  isEmbeddedApp: true,
  restResources,
});

// Set session storage on the shopify instance
if (shopify.session) {
  shopify.session.storage = sessionStorage;
  logger.info("[INIT] Session storage configured on shopify instance", {
    storageType: "NoOpSessionStorage",
  });
} else {
  logger.warn(
    "[INIT] shopify.session not available, session storage may not work"
  );
}

class SubscriptionStatusError extends Error {
  constructor(message, status = 500, details = {}) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

// Removed DEFAULT_SETUP_PROGRESS - no longer returning hardcoded setup progress

const normalizeShopDomain = (shopDomain) => {
  if (!shopDomain) {
    return null;
  }
  let normalized = shopDomain.trim().toLowerCase();
  normalized = normalized.replace(/^https?:\/\//, "");
  if (!normalized.includes(".myshopify.com")) {
    normalized = `${normalized}.myshopify.com`;
  }
  return normalized;
};

/**
 * Check if a shop is the specific demo store that should use test mode
 * @param {string} shopDomain - The shop domain
 * @returns {boolean} True if it's the demo store
 */
const isDemoStore = (shopDomain) => {
  if (!shopDomain) {
    return false;
  }

  const normalized = normalizeShopDomain(shopDomain);
  if (!normalized) {
    return false;
  }

  // Only enable test mode for this specific demo store
  const demoStore = "vto-demo.myshopify.com";
  return normalized === demoStore;
};

// Removed findPlanByPricing and normalizeIntervalValue - no longer using hardcoded plan matching

const mapSubscriptionToPlan = (appSubscription) => {
  if (!appSubscription) {
    return {
      hasActiveSubscription: false,
      isFree: true,
      plan: null,
      subscription: null,
    };
  }

  const lineItem = appSubscription.lineItems?.[0];
  const pricingDetails = lineItem?.plan?.pricingDetails;
  const hasActiveSubscription = appSubscription.status === "ACTIVE";

  // Map pricing details to a configured plan using local billing configuration.
  // This does not use any database; it simply matches by price, currency, and interval.
  let matchedPlanHandle = null;
  let matchedPlan = null;
  if (
    pricingDetails &&
    pricingDetails.price?.amount &&
    pricingDetails.price.currencyCode
  ) {
    const amountNumber = Number.parseFloat(pricingDetails.price.amount);
    const currencyCode = pricingDetails.price.currencyCode;
    const interval = pricingDetails.interval || null;

    try {
      const availablePlans = billing ? billing.PLANS || {} : {};
      for (const planKey of Object.keys(availablePlans)) {
        const candidate = availablePlans[planKey];
        if (
          typeof candidate.price === "number" &&
          candidate.price === amountNumber &&
          candidate.currencyCode === currencyCode &&
          candidate.interval === interval
        ) {
          matchedPlanHandle = candidate.handle || planKey;
          matchedPlan = candidate;
          break;
        }
      }
    } catch (planMatchError) {
      logger.error(
        "[BILLING] Failed to match subscription pricing to local plan config",
        planMatchError,
        null
      );
    }
  }

  const plan = pricingDetails
    ? {
        name: appSubscription.name || matchedPlan?.name || null,
        handle: matchedPlanHandle || null,
        price: pricingDetails.price?.amount
          ? Number.parseFloat(pricingDetails.price.amount)
          : null,
        currencyCode: pricingDetails.price?.currencyCode || null,
        interval: pricingDetails.interval || null,
      }
    : null;

  return {
    hasActiveSubscription,
    isFree: !hasActiveSubscription,
    plan,
    subscription: {
      id: appSubscription.id,
      status: appSubscription.status,
      currentPeriodEnd: appSubscription.currentPeriodEnd,
      createdAt: appSubscription.createdAt,
      name: appSubscription.name || null,
    },
  };
};

const fetchManagedSubscriptionStatus = async (
  shopDomain,
  requestSession,
  encodedSessionToken
) => {
  const normalizedShop = normalizeShopDomain(shopDomain);

  if (!requestSession || !encodedSessionToken) {
    throw new SubscriptionStatusError(
      "JWT session token required for billing API",
      401,
      {
        resolution:
          "This endpoint requires authentication from the embedded Shopify admin. Please access it through the app interface.",
      }
    );
  }

  logger.info("[BILLING] Using JWT session from request", {
    shop: normalizedShop,
    sessionShop: requestSession.shop,
  });

  // Exchange JWT session token for an access token
  // JWT session tokens don't contain access tokens - we need to exchange them
  let sessionWithAccessToken;
  try {
    logger.info("[BILLING] Exchanging session token for access token", {
      shop: normalizedShop,
      hasEncodedToken: !!encodedSessionToken,
      tokenLength: encodedSessionToken?.length,
    });

    const tokenResult = await shopify.auth.tokenExchange({
      shop: normalizedShop,
      sessionToken: encodedSessionToken,
      requestedTokenType: RequestedTokenType.OfflineAccessToken, // Use offline token for billing API
    });

    // Log the token result structure for debugging
    logger.info("[BILLING] Token exchange result received", {
      shop: normalizedShop,
      hasSession: !!tokenResult?.session,
      tokenResultKeys: tokenResult ? Object.keys(tokenResult) : [],
      sessionKeys: tokenResult?.session ? Object.keys(tokenResult.session) : [],
    });

    // Token exchange returns an object with a 'session' property
    // The session object contains the accessToken
    const session = tokenResult?.session;

    if (!tokenResult || !session) {
      logger.error(
        "[BILLING] Token exchange returned invalid result - missing session",
        null,
        null,
        {
          shop: normalizedShop,
          tokenResult: tokenResult,
        }
      );
      throw new SubscriptionStatusError(
        "Token exchange did not return a valid session",
        500,
        {
          resolution:
            "Please try again. If the issue persists, contact support.",
          error: "Invalid token exchange response - missing session",
        }
      );
    }

    // Extract accessToken from session (can be accessToken or access_token)
    const accessToken = session.accessToken || session.access_token;

    if (!accessToken) {
      logger.error("[BILLING] Session missing access token", null, null, {
        shop: normalizedShop,
        sessionKeys: Object.keys(session),
      });
      throw new SubscriptionStatusError(
        "Session from token exchange missing access token",
        500,
        {
          resolution:
            "Please try again. If the issue persists, contact support.",
          error: "Session object missing accessToken",
        }
      );
    }

    // Use the session object directly (it already has the correct structure)
    sessionWithAccessToken = {
      shop: session.shop || normalizedShop,
      accessToken: accessToken,
      scope: session.scope,
      isOnline: session.isOnline || false, // Offline token
    };

    logger.info("[BILLING] Token exchange successful", {
      shop: normalizedShop,
      hasAccessToken: !!sessionWithAccessToken.accessToken,
      accessTokenLength: sessionWithAccessToken.accessToken?.length,
      scope: sessionWithAccessToken.scope,
    });
  } catch (tokenError) {
    logger.error("[BILLING] Token exchange failed", tokenError, null, {
      shop: normalizedShop,
      errorMessage: tokenError.message,
      errorStack: tokenError.stack,
      errorName: tokenError.name,
    });
    throw new SubscriptionStatusError(
      "Failed to exchange session token for access token",
      500,
      {
        resolution: "Please try again. If the issue persists, contact support.",
        error: tokenError.message,
      }
    );
  }

  // Verify session has accessToken before creating GraphQL client
  if (!sessionWithAccessToken || !sessionWithAccessToken.accessToken) {
    logger.error(
      "[BILLING] Session missing access token before GraphQL client creation",
      null,
      null,
      {
        shop: normalizedShop,
        hasSession: !!sessionWithAccessToken,
        sessionKeys: sessionWithAccessToken
          ? Object.keys(sessionWithAccessToken)
          : [],
      }
    );
    throw new SubscriptionStatusError(
      "Missing access token when creating GraphQL client",
      500,
      {
        resolution: "Please try again. If the issue persists, contact support.",
        error: "Session object missing accessToken",
      }
    );
  }

  logger.info("[BILLING] Creating GraphQL client", {
    shop: normalizedShop,
    hasAccessToken: !!sessionWithAccessToken.accessToken,
  });

  const client = new shopify.clients.Graphql({
    session: sessionWithAccessToken,
  });
  const query = `
    query ManagedPricingSubscription {
      currentAppInstallation {
        activeSubscriptions {
          id
          name
          status
          currentPeriodEnd
          createdAt
          lineItems {
            plan {
              pricingDetails {
                __typename
                ... on AppRecurringPricing {
                  interval
                  price {
                    amount
                    currencyCode
                  }
                }
              }
            }
          }
        }
      }
    }
  `;

  const response = await client.query({ data: query });

  const subscriptions =
    response.body?.data?.currentAppInstallation?.activeSubscriptions || [];

  logger.info("[BILLING] GraphQL subscription query completed", {
    shop: normalizedShop,
    subscriptionsFound: subscriptions.length,
    statuses: subscriptions.map((sub) => sub.status),
  });

  const activeSubscription =
    subscriptions.find((subscription) => subscription.status === "ACTIVE") ||
    subscriptions[0] ||
    null;

  const subscriptionStatus = mapSubscriptionToPlan(activeSubscription);

  // Sync metafield to control app block/banner visibility
  // This happens asynchronously to not block the response
  (async () => {
    try {
      const appInstallationId =
        await subscriptionMetafield.getAppInstallationId(client);
      await subscriptionMetafield.updateSubscriptionMetafield(
        client,
        appInstallationId,
        subscriptionStatus.hasActiveSubscription &&
          subscriptionStatus.subscription !== null
      );
    } catch (metafieldError) {
      // Log error but don't fail the request
      logger.error(
        "[BILLING] Failed to sync subscription metafield",
        metafieldError,
        null,
        {
          shop: normalizedShop,
          errorMessage: metafieldError.message,
        }
      );
    }
  })();

  return subscriptionStatus;
};

// Create a new app subscription using the GraphQL Admin API and JWT token exchange.
// This uses the billing resources (appSubscriptionCreate) without any database storage.
const createAppSubscription = async (
  shopDomain,
  planHandle,
  encodedSessionToken,
  promoCode = null
) => {
  const normalizedShop = normalizeShopDomain(shopDomain);

  if (!normalizedShop) {
    throw new SubscriptionStatusError("Invalid shop domain", 400, {
      resolution: "Provide a valid .myshopify.com domain or shop handle.",
    });
  }

  if (!encodedSessionToken) {
    throw new SubscriptionStatusError(
      "JWT session token required for billing API",
      401,
      {
        resolution:
          "This endpoint requires authentication from the embedded Shopify admin. Please access it through the app interface.",
      }
    );
  }

  const planConfig = billing.getPlan ? billing.getPlan(planHandle) : null;

  if (!planConfig) {
    throw new SubscriptionStatusError("Invalid plan handle", 400, {
      resolution:
        "Provide a valid planHandle defined in server/utils/billing.js.",
    });
  }

  // Validate promo code if provided
  let discountConfig = null;
  if (promoCode) {
    const validatedPromo = billing.validatePromoCode
      ? billing.validatePromoCode(promoCode, planConfig.interval)
      : null;

    if (validatedPromo) {
      discountConfig = {
        value:
          validatedPromo.type === "percentage"
            ? { percentage: validatedPromo.value }
            : { amount: validatedPromo.value },
        durationLimitInIntervals:
          validatedPromo.durationLimitInIntervals || null,
      };
      logger.info("[BILLING] Promo code applied", {
        shop: normalizedShop,
        planHandle,
        promoCode: promoCode.toUpperCase(),
        discountType: validatedPromo.type,
        discountValue: validatedPromo.value,
        durationLimitInIntervals: validatedPromo.durationLimitInIntervals,
      });
    } else {
      logger.warn("[BILLING] Invalid promo code provided", {
        shop: normalizedShop,
        planHandle,
        promoCode: promoCode.toUpperCase(),
      });
    }
  }

  try {
    // Exchange JWT session token for an offline access token for billing
    const tokenResult = await shopify.auth.tokenExchange({
      shop: normalizedShop,
      sessionToken: encodedSessionToken,
      requestedTokenType: RequestedTokenType.OfflineAccessToken,
    });

    const session = tokenResult?.session;
    const accessToken = session?.accessToken || session?.access_token;

    if (!session || !accessToken) {
      throw new SubscriptionStatusError(
        "Token exchange did not return a valid session with access token",
        500,
        {
          resolution:
            "Please try again. If the issue persists, contact support.",
        }
      );
    }

    const client = new shopify.clients.Graphql({
      session: {
        shop: session.shop || normalizedShop,
        accessToken,
        scope: session.scope,
        isOnline: session.isOnline || false,
      },
    });

    const appBaseUrl = appUrl || `https://${normalizedShop}`;
    const returnUrl = `${appBaseUrl}/api/billing/return?shop=${encodeURIComponent(
      normalizedShop
    )}`;

    const mutation = `
      mutation AppSubscriptionCreate(
        $name: String!
        $returnUrl: URL!
        $lineItems: [AppSubscriptionLineItemInput!]!
        $trialDays: Int
        $test: Boolean
      ) {
        appSubscriptionCreate(
          name: $name
          returnUrl: $returnUrl
          lineItems: $lineItems
          trialDays: $trialDays
          test: $test
        ) {
          userErrors {
            field
            message
          }
          confirmationUrl
          appSubscription {
            id
            status
            name
          }
        }
      }
    `;

    const lineItemPlan = {
      interval: planConfig.interval,
      price: {
        amount: planConfig.price,
        currencyCode: planConfig.currencyCode,
      },
    };

    // Add discount if promo code is valid
    if (discountConfig) {
      lineItemPlan.discount = discountConfig;
    }

    const variables = {
      name: planConfig.name,
      returnUrl,
      lineItems: [
        {
          plan: {
            appRecurringPricingDetails: lineItemPlan,
          },
        },
      ],
      trialDays: planConfig.trialDays || null,
      // Enable test mode only for vto-demo.myshopify.com
      // Test charges don't require actual payment and can be approved without payment method
      // All other stores will use real billing (test: false)
      test: (() => {
        const isDemo = isDemoStore(normalizedShop);
        logger.info("[BILLING] Store billing mode", {
          shop: normalizedShop,
          isDemoStore: isDemo,
          testMode: isDemo,
          note: isDemo
            ? "Test mode enabled for demo store"
            : "Real billing mode for production store",
        });
        return isDemo;
      })(),
    };

    const response = await client.query({
      data: {
        query: mutation,
        variables,
      },
    });

    const payload = response?.body?.data?.appSubscriptionCreate;

    if (!payload) {
      throw new SubscriptionStatusError(
        "Unexpected response from appSubscriptionCreate",
        500,
        {
          resolution:
            "Please try again. If the issue persists, contact support.",
        }
      );
    }

    const userErrors = payload.userErrors || [];
    if (userErrors.length > 0) {
      throw new SubscriptionStatusError("Failed to create subscription", 400, {
        resolution:
          "Review the error details and plan configuration, then try again.",
        userErrors,
      });
    }

    if (!payload.confirmationUrl) {
      throw new SubscriptionStatusError(
        "Missing confirmationUrl in subscription response",
        500,
        {
          resolution:
            "Please try again. If the issue persists, contact support.",
        }
      );
    }

    return {
      confirmationUrl: payload.confirmationUrl,
      appSubscription: payload.appSubscription,
      plan: planConfig,
    };
  } catch (error) {
    if (error instanceof SubscriptionStatusError) {
      throw error;
    }

    logger.error("[BILLING] Failed to create app subscription", error, null, {
      shop: normalizedShop,
      planHandle,
    });

    throw new SubscriptionStatusError("Failed to create subscription", 500, {
      resolution: "Please try again. If the issue persists, contact support.",
      error: error.message,
    });
  }
};

const app = express();

// Middleware
// Request logging middleware (before other middleware)
app.use(logger.requestLogger);

// For webhooks, we need raw body for HMAC verification
app.use((req, res, next) => {
  if (req.path.startsWith("/webhooks/")) {
    express.raw({ type: "application/json" })(req, res, next);
  } else {
    express.json()(req, res, next);
  }
});

// HMAC signature verification middleware for webhooks
// This middleware MUST return HTTP 401 for invalid signatures to comply with Shopify requirements
const verifyWebhookSignature = (req, res, next) => {
  try {
    const hmacHeader = req.get("X-Shopify-Hmac-Sha256");
    const topicHeader = req.get("X-Shopify-Topic");
    const shopHeader = req.get("X-Shopify-Shop-Domain");

    // Missing required headers - return 401
    if (!hmacHeader || !topicHeader || !shopHeader) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "Missing required webhook headers",
      });
    }

    // Missing API secret - return 500 (server error, not auth error)
    if (!apiSecret) {
      return res.status(500).json({
        error: "Server configuration error",
        message: "API secret not configured",
      });
    }

    // Ensure body is a Buffer for HMAC calculation
    const rawBody = Buffer.isBuffer(req.body)
      ? req.body
      : Buffer.from(req.body || "");

    // Calculate HMAC from raw body
    // Shopify sends HMAC as base64-encoded string in X-Shopify-Hmac-Sha256 header
    const calculatedHmacDigest = crypto
      .createHmac("sha256", apiSecret)
      .update(rawBody)
      .digest("base64");

    // Compare base64 strings using timing-safe comparison
    // Convert both base64 strings to buffers for constant-time comparison
    const providedHmacBuffer = Buffer.from(hmacHeader, "utf8");
    const calculatedHmacBuffer = Buffer.from(calculatedHmacDigest, "utf8");

    // Length mismatch - return 401
    if (providedHmacBuffer.length !== calculatedHmacBuffer.length) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "Invalid webhook signature",
      });
    }

    // Use crypto.timingSafeEqual for constant-time comparison to prevent timing attacks
    if (!crypto.timingSafeEqual(providedHmacBuffer, calculatedHmacBuffer)) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "Invalid webhook signature",
      });
    }

    // HMAC is valid - parse body and attach metadata
    try {
      req.webhookData = JSON.parse(rawBody.toString());
      req.webhookTopic = topicHeader;
      req.webhookShop = shopHeader;
    } catch (error) {
      return res.status(400).json({
        error: "Bad Request",
        message: "Invalid JSON in webhook body",
      });
    }

    next();
  } catch (error) {
    // Any unexpected error during validation - return 401 for security
    return res.status(401).json({
      error: "Unauthorized",
      message: "Webhook signature verification failed",
    });
  }
};

// App proxy signature verification middleware
// This middleware MUST verify app proxy requests using the signature parameter
// Reference: https://shopify.dev/docs/apps/build/online-store/app-proxies/authenticate-app-proxies
const verifyAppProxySignature = (req, res, next) => {
  try {
    // Missing API secret - return 500 (server error, not auth error)
    if (!apiSecret) {
      return res.status(500).json({
        error: "Server configuration error",
        message: "API secret not configured",
      });
    }

    // Get query parameters from request
    const queryParams = req.query;
    const providedSignature = queryParams.signature;

    // Missing signature parameter - return 401
    if (!providedSignature) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "Missing signature parameter",
      });
    }

    // Create a copy of query parameters and remove signature
    const paramsForVerification = { ...queryParams };
    delete paramsForVerification.signature;

    // Sort parameters alphabetically and format as "key=value"
    // Arrays should be joined with commas
    const sortedParams = Object.keys(paramsForVerification)
      .sort()
      .map((key) => {
        const value = paramsForVerification[key];
        // Handle arrays by joining with commas
        const formattedValue = Array.isArray(value) ? value.join(",") : value;
        return `${key}=${formattedValue}`;
      })
      .join(""); // Concatenate without separators

    // Calculate HMAC-SHA256 hexdigest using shared secret
    const calculatedSignature = crypto
      .createHmac("sha256", apiSecret)
      .update(sortedParams)
      .digest("hex");

    // Compare signatures using timing-safe comparison
    // Convert both hex strings to buffers for constant-time comparison
    const providedSignatureBuffer = Buffer.from(providedSignature, "hex");
    const calculatedSignatureBuffer = Buffer.from(calculatedSignature, "hex");

    // Length mismatch - return 401
    if (providedSignatureBuffer.length !== calculatedSignatureBuffer.length) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "Invalid app proxy signature",
      });
    }

    // Use crypto.timingSafeEqual for constant-time comparison to prevent timing attacks
    if (
      !crypto.timingSafeEqual(
        providedSignatureBuffer,
        calculatedSignatureBuffer
      )
    ) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "Invalid app proxy signature",
      });
    }

    // Signature is valid - attach proxy metadata to request
    req.proxyShop = paramsForVerification.shop;
    req.proxyLoggedInCustomerId = paramsForVerification.logged_in_customer_id;
    req.proxyPathPrefix = paramsForVerification.path_prefix;
    req.proxyTimestamp = paramsForVerification.timestamp;

    // Verify timestamp is recent (optional but recommended for security)
    // Prevent replay attacks by checking if timestamp is within acceptable range
    const timestamp = parseInt(paramsForVerification.timestamp, 10);
    const currentTime = Math.floor(Date.now() / 1000);
    const timeDifference = Math.abs(currentTime - timestamp);

    // Allow timestamp difference of up to 5 minutes (300 seconds)
    if (timeDifference > 300) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "Request timestamp is too old or too far in the future",
      });
    }

    next();
  } catch (error) {
    // Any unexpected error during validation - return 401 for security
    return res.status(401).json({
      error: "Unauthorized",
      message: "App proxy signature verification failed",
    });
  }
};

// Middleware to verify App Bridge session token for embedded apps
// This validates requests from the embedded app frontend
const verifySessionToken = async (req, res, next) => {
  try {
    // Skip verification for webhooks, app proxy, and public routes
    if (
      req.path.startsWith("/webhooks/") ||
      req.path.startsWith("/apps/apps/a/") ||
      req.path.startsWith("/auth") ||
      req.path === "/" ||
      req.path.startsWith("/widget") ||
      req.path.startsWith("/demo")
    ) {
      return next();
    }

    // Get session token from Authorization header
    // App Bridge automatically sends this for authenticated requests
    const authHeader = req.get("Authorization");

    if (authHeader && authHeader.startsWith("Bearer ")) {
      const sessionToken = authHeader.replace("Bearer ", "");

      try {
        // Verify and decode session token using Shopify API
        // This validates signature, expiry, and other claims
        const session = await shopify.session.decodeSessionToken(sessionToken);
        // Attach session info to request
        req.session = session;
        req.sessionToken = sessionToken; // Store original encoded token for token exchange
        req.shop = session.shop;
        logger.info("[AUTH] Session token verified", {
          shop: session.shop,
          path: req.path,
        });
      } catch (error) {
        // Invalid session token - reject API requests
        logger.warn("[AUTH] Invalid session token", {
          path: req.path,
          error: error.message,
        });

        // For API routes, return 401 with retry header
        if (req.path.startsWith("/api/")) {
          return res.status(401).json({
            error: "Unauthorized",
            message: "Invalid or expired session token",
          });
        }

        // For document requests, allow through (frontend will handle)
        // This allows initial page load before App Bridge loads
      }
    } else {
      // No session token provided
      // For API routes, require authentication
      if (req.path.startsWith("/api/")) {
        return res.status(401).json({
          error: "Unauthorized",
          message: "Session token required",
        });
      }
      // For document requests, allow through
    }

    next();
  } catch (error) {
    logger.error("[AUTH] Session token verification failed", error, req);
    if (req.path.startsWith("/api/")) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "Session verification failed",
      });
    }
    next();
  }
};

// Apply session token verification middleware to API routes
app.use(verifySessionToken);

// Serve static files only in non-Vercel environment
// In Vercel, static files are served directly by the platform
// Check for Vercel environment
const isVercel = process.env.VERCEL === "1" || process.env.VERCEL_ENV;
if (!isVercel) {
  app.use(express.static(join(__dirname, "../dist")));
}

// CORS middleware
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

app.use((req, res, next) => {
  // CSP headers for embedded Shopify apps
  // Allow App Bridge and Shopify domains
  res.setHeader(
    "Content-Security-Policy",
    [
      "default-src 'self';",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.shopify.com;",
      "connect-src 'self' https://*.shopify.com https://*.myshopify.com wss://*.shopify.com;",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.shopify.com;",
      "font-src 'self' https://fonts.gstatic.com https://cdn.shopify.com;",
      "img-src 'self' data: https:;",
      "frame-src https://*.shopify.com https://*.myshopify.com;",
      "frame-ancestors https://admin.shopify.com https://*.myshopify.com;",
    ].join(" ")
  );

  // Required headers for embedded apps
  // Note: X-Frame-Options should NOT be set to ALLOWALL for security
  // Instead, we use frame-ancestors in CSP which is the modern approach
  // X-Frame-Options is removed to allow iframe embedding (required for embedded apps)
  res.removeHeader("X-Frame-Options");
  res.setHeader("X-Content-Type-Options", "nosniff");

  next();
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Logs endpoint - view recent logs
app.get("/api/logs", (req, res) => {
  try {
    const limit = parseInt(req.query.limit || "100", 10);
    const level = req.query.level || null;
    const search = req.query.search || null;

    const logs = logger.getRecentLogs(limit, level, search);
    const stats = logger.getLogStats();

    res.json({
      logs,
      stats,
      filters: {
        limit,
        level,
        search,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("[API] Failed to get logs", error, req);
    res.status(500).json({
      error: "Failed to get logs",
      message: error.message,
    });
  }
});

// Session storage status endpoint
app.get("/api/session-storage/status", async (req, res) => {
  try {
    res.json({
      storageType: "NoOpSessionStorage",
      sessionCount: 0,
      timestamp: new Date().toISOString(),
      note: "Sessions are not stored. Billing API uses JWT from embedded UI.",
    });
  } catch (error) {
    logger.error("[API] Failed to get session storage status", error, req);
    res.status(500).json({
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Detailed health check endpoint for debugging
app.get("/health/detailed", async (req, res) => {
  const healthCheck = {
    status: "ok",
    timestamp: new Date().toISOString(),
    environment: {
      nodeEnv: process.env.NODE_ENV || process.env.VITE_NODE_ENV,
      vercel: process.env.VERCEL === "1",
      hasApiKey: !!process.env.VITE_SHOPIFY_API_KEY,
      hasApiSecret: !!process.env.VITE_SHOPIFY_API_SECRET,
      hasAppUrl: !!process.env.VITE_SHOPIFY_APP_URL,
    },
    system: {
      nodeVersion: process.version,
      uptime: process.uptime(),
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + "MB",
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + "MB",
        rss: Math.round(process.memoryUsage().rss / 1024 / 1024) + "MB",
      },
    },
    sessionStorage: {
      type: "NoOpSessionStorage",
      sessionCount: 0,
      note: "Sessions are not stored. Billing API uses JWT from embedded UI.",
    },
  };

  res.json(healthCheck);
});

// OAuth routes
app.get("/auth", async (req, res) => {
  try {
    const shop = req.query.shop;

    // Validate shop parameter
    if (!shop) {
      return res.status(400).json({
        error: "Missing shop parameter",
        message: "Please provide a shop parameter in the query string",
      });
    }

    // Validate shop format (should be a .myshopify.com domain or just the shop name)
    const shopDomain = shop.includes(".myshopify.com")
      ? shop
      : `${shop}.myshopify.com`;

    // No-op storage doesn't need initialization

    logger.info("[OAUTH] Initiating OAuth flow", {
      shop: shopDomain,
      hasSessionStorage: !!shopify.session?.storage,
    });

    const authRoute = await shopify.auth.begin({
      shop: shopDomain,
      callbackPath: "/auth/callback",
      isOnline: false,
      rawRequest: req,
      rawResponse: res,
    });

    logger.info("[OAUTH] OAuth flow initiated successfully", {
      shop: shopDomain,
      authRoute,
    });

    res.redirect(authRoute);
  } catch (error) {
    logger.error("[OAUTH] Failed to initiate OAuth", error, req, {
      shop: req.query.shop,
      errorMessage: error.message,
      errorStack: error.stack,
      hasSessionStorage: !!shopify.session?.storage,
    });

    if (!res.headersSent) {
      res.status(500).json({
        error: "Failed to initiate OAuth",
        message: error.message || "An error occurred during authentication",
      });
    }
  }
});

app.get("/auth/callback", async (req, res) => {
  try {
    // Log callback details for debugging
    logger.info("[OAUTH] OAuth callback received", {
      query: req.query,
      hasCode: !!req.query.code,
      hasHmac: !!req.query.hmac,
      hasState: !!req.query.state,
      hasShop: !!req.query.shop,
      hasHost: !!req.query.host,
      timestamp: new Date().toISOString(),
    });

    // Validate required query parameters
    if (!req.query.code) {
      logger.error("[OAUTH] Missing code parameter", null, req, {
        query: req.query,
      });
      return res.status(400).json({
        error: "Invalid OAuth callback",
        message: "Missing authorization code",
      });
    }

    if (!req.query.shop) {
      logger.error("[OAUTH] Missing shop parameter", null, req, {
        query: req.query,
      });
      return res.status(400).json({
        error: "Invalid OAuth callback",
        message: "Missing shop parameter",
      });
    }

    // No-op storage doesn't need initialization

    // Validate API secret is configured
    if (!apiSecret) {
      logger.error("[OAUTH] API secret not configured", null, req);
      return res.status(500).json({
        error: "Server configuration error",
        message: "API secret not configured",
      });
    }

    // Call Shopify auth callback
    // This validates HMAC, state, and exchanges code for access token
    const callbackResponse = await shopify.auth.callback({
      rawRequest: req,
      rawResponse: res,
    });

    const shop = callbackResponse.session?.shop;
    const apiKey = process.env.VITE_SHOPIFY_API_KEY;

    if (!shop || !apiKey) {
      logger.error(
        "[OAUTH] OAuth callback failed - missing shop or API key",
        null,
        req,
        {
          shop: shop || "unknown",
          hasApiKey: !!apiKey,
          hasSession: !!callbackResponse.session,
        }
      );
      return res.status(500).json({
        error: "Authentication failed",
        message: "Missing shop or API key information",
      });
    }

    // Store session (no-op storage - sessions not persisted)
    if (callbackResponse.session && shopify.session?.storage) {
      await shopify.session.storage.storeSession(callbackResponse.session);
    }

    logger.info("[OAUTH] OAuth callback completed successfully", {
      shop,
      hasSession: !!callbackResponse.session,
      sessionId: callbackResponse.session?.id,
    });

    // For embedded apps, redirect with host parameter
    // Get host from query params (provided by Shopify during OAuth)
    const host = req.query.host;

    if (host) {
      // Embedded app redirect - include host parameter
      const redirectUrl = `${
        process.env.VITE_SHOPIFY_APP_URL || appUrl
      }/?shop=${shop}&host=${encodeURIComponent(host)}`;
      logger.info("[OAUTH] Redirecting to embedded app", {
        shop,
        redirectUrl,
      });
      res.redirect(redirectUrl);
    } else {
      // Fallback for non-embedded or legacy redirect
      // Correct format: https://admin.shopify.com/store/{store_handle}/apps/{app_id}
      const storeHandle = shop.replace(".myshopify.com", "");
      const redirectUrl = `https://admin.shopify.com/store/${storeHandle}/apps/${apiKey}`;
      logger.info("[OAUTH] Redirecting to admin (fallback)", {
        shop,
        redirectUrl,
      });
      res.redirect(redirectUrl);
    }
  } catch (error) {
    // Enhanced error logging with full details
    logger.error("[OAUTH] OAuth callback failed", error, req, {
      errorMessage: error.message,
      errorStack: error.stack,
      errorName: error.constructor.name,
      query: req.query,
      hasCode: !!req.query.code,
      hasHmac: !!req.query.hmac,
      hasState: !!req.query.state,
      hasShop: !!req.query.shop,
      hasSessionStorage: !!shopify.session?.storage,
      hasApiSecret: !!apiSecret,
    });

    if (!res.headersSent) {
      // Provide more specific error message based on error type
      let errorMessage = "An error occurred during the OAuth callback";

      if (error.message?.includes("Invalid OAuth callback")) {
        errorMessage =
          "OAuth callback validation failed. This may be due to: state mismatch, expired callback, or invalid HMAC signature.";
      } else if (error.message?.includes("state")) {
        errorMessage =
          "OAuth state validation failed. Please try installing the app again.";
      } else if (
        error.message?.includes("HMAC") ||
        error.message?.includes("signature")
      ) {
        errorMessage =
          "OAuth signature validation failed. Please check your API secret configuration.";
      } else {
        errorMessage = error.message || errorMessage;
      }

      res.status(500).json({
        error: "OAuth callback failed",
        message: errorMessage,
      });
    }
  }
});

// Webhook Routes - Mandatory Compliance Webhooks
// All webhooks must be registered in shopify.app.toml and verified with HMAC

// App uninstalled webhook - mandatory for app lifecycle
// Reference: https://shopify.dev/docs/apps/build/webhooks
app.post(
  "/webhooks/app/uninstalled",
  verifyWebhookSignature,
  async (req, res) => {
    try {
      const { shop_domain } = req.webhookData;
      const shop = req.webhookShop || shop_domain;

      // Log webhook received for audit purposes
      logger.info(`[WEBHOOK] app/uninstalled received for shop: ${shop}`, {
        shop,
        webhookTopic: req.webhookTopic,
      });

      // Handle app uninstallation
      // Clean up any app-specific data, sessions, or resources
      // This is a mandatory webhook for compliance

      // IMPORTANT: Shopify automatically removes all app blocks and app embeds when an app is uninstalled
      // Reference: https://shopify.dev/docs/apps/build/online-store/theme-app-extensions/ux#uninstalling-apps
      // "When merchants uninstall apps, blocks associated with the apps are automatically and entirely removed from online store themes."

      // NOTE: This app stores data client-side only (localStorage)
      // No server-side database or storage system exists
      // Shopify API library handles session cleanup automatically

      // App blocks and banners are automatically removed by Shopify on uninstall
      // No manual cleanup needed for theme app extensions

      // If server-side storage is added in the future, implement cleanup logic here:
      // - Delete shop sessions from database
      // - Remove shop configuration data
      // - Clean up shop-specific resources
      // - Revoke access tokens (handled by Shopify API library)
      // - Delete app-data metafields (if needed)

      // Log successful processing
      logger.info(
        `[WEBHOOK] app/uninstalled processed successfully for shop: ${shop}`,
        {
          shop,
          webhookTopic: req.webhookTopic,
        }
      );

      res.status(200).json({ received: true });
    } catch (error) {
      // Log error for debugging
      logger.error(`[WEBHOOK ERROR] app/uninstalled failed`, error, req, {
        shop: req.webhookShop || req.webhookData?.shop_domain,
        webhookTopic: req.webhookTopic,
      });

      // Return 200 to acknowledge receipt (Shopify requirement)
      // But log the error for investigation
      res.status(200).json({
        received: true,
        error: "Webhook processed but encountered an error",
      });
    }
  }
);

// Customer data request webhook - mandatory for GDPR compliance
// Reference: https://shopify.dev/docs/apps/build/compliance/privacy-law-compliance
// Must respond within 30 days of receiving this webhook
app.post(
  "/webhooks/customers/data_request",
  verifyWebhookSignature,
  async (req, res) => {
    try {
      const { shop_id, shop_domain, customer, orders_requested } =
        req.webhookData;
      const shop = req.webhookShop || shop_domain;
      const customerId = customer?.id || customer;

      // Log webhook received for audit purposes
      logger.info(
        `[WEBHOOK] customers/data_request received for shop: ${shop}, customer: ${customerId}`,
        {
          shop,
          customerId,
          webhookTopic: req.webhookTopic,
        }
      );

      // Handle GDPR data request
      // Must provide customer data within 30 days
      // This is a mandatory webhook for GDPR compliance

      // NOTE: This app stores data client-side only (localStorage in user's browser)
      // No server-side database or storage system exists
      // Customer photos and try-on images are stored locally in the user's browser
      // No server-side customer data is stored or processed

      // Data Storage Approach:
      // - Customer photos: Stored in browser localStorage (client-side only)
      // - Generated try-on images: Stored in browser localStorage (client-side only)
      // - Product information: Retrieved from Shopify product pages (not stored)
      // - No server-side database or storage system

      // GDPR Compliance:
      // Since no server-side customer data is stored, this webhook returns success
      // Customer data is stored client-side only and is managed by the user's browser
      // If server-side storage is added in the future, implement data export here

      // Example data export logic (for future server-side storage):
      // - Query database for customer data
      // - Collect all stored information about the customer
      // - Prepare data export file (JSON, CSV, etc.)
      // - Send data export to customer via email or Shopify admin
      // - Log data export for audit purposes

      // Log successful processing
      logger.info(
        `[WEBHOOK] customers/data_request processed successfully for shop: ${shop}, customer: ${customerId}`,
        {
          shop,
          customerId,
          webhookTopic: req.webhookTopic,
        }
      );

      // Return 200 to acknowledge receipt
      // Note: Actual data export (if needed) should be handled asynchronously
      res.status(200).json({ received: true });
    } catch (error) {
      // Log error for debugging
      logger.error(
        `[WEBHOOK ERROR] customers/data_request failed`,
        error,
        req,
        {
          shop: req.webhookShop || req.webhookData?.shop_domain,
          customerId:
            req.webhookData?.customer?.id || req.webhookData?.customer,
          webhookTopic: req.webhookTopic,
        }
      );

      // Return 200 to acknowledge receipt (Shopify requirement)
      // But log the error for investigation
      res.status(200).json({
        received: true,
        error: "Webhook processed but encountered an error",
      });
    }
  }
);

// Customer redact webhook - mandatory for GDPR compliance
// Reference: https://shopify.dev/docs/apps/build/compliance/privacy-law-compliance
// Must delete all customer data within 10 days of receiving this webhook
app.post(
  "/webhooks/customers/redact",
  verifyWebhookSignature,
  async (req, res) => {
    try {
      const { shop_id, shop_domain, customer, orders_to_redact } =
        req.webhookData;
      const shop = req.webhookShop || shop_domain;
      const customerId = customer?.id || customer;

      // Log webhook received for audit purposes
      logger.info(
        `[WEBHOOK] customers/redact received for shop: ${shop}, customer: ${customerId}`,
        {
          shop,
          customerId,
          webhookTopic: req.webhookTopic,
        }
      );

      // Handle GDPR customer data deletion
      // Must delete all customer data within 10 days
      // This is a mandatory webhook for GDPR compliance

      // NOTE: This app stores data client-side only (localStorage in user's browser)
      // No server-side database or storage system exists
      // Customer photos and try-on images are stored locally in the user's browser
      // No server-side customer data is stored or processed

      // Data Storage Approach:
      // - Customer photos: Stored in browser localStorage (client-side only)
      // - Generated try-on images: Stored in browser localStorage (client-side only)
      // - Product information: Retrieved from Shopify product pages (not stored)
      // - No server-side database or storage system

      // GDPR Compliance:
      // Since no server-side customer data is stored, this webhook returns success
      // Customer data is stored client-side only and is managed by the user's browser
      // Client-side data is automatically cleared when user clears browser data
      // If server-side storage is added in the future, implement data deletion here

      // Example data deletion logic (for future server-side storage):
      // - Delete customer photos from storage
      // - Delete generated try-on images from storage
      // - Delete customer preferences from database
      // - Delete customer session data
      // - Log data deletion for audit purposes
      // - Verify data deletion was successful

      // Log successful processing
      logger.info(
        `[WEBHOOK] customers/redact processed successfully for shop: ${shop}, customer: ${customerId}`,
        {
          shop,
          customerId,
          webhookTopic: req.webhookTopic,
        }
      );

      // Return 200 to acknowledge receipt
      // Note: Actual data deletion (if needed) should be handled asynchronously
      res.status(200).json({ received: true });
    } catch (error) {
      // Log error for debugging
      logger.error(`[WEBHOOK ERROR] customers/redact failed`, error, req, {
        shop: req.webhookShop || req.webhookData?.shop_domain,
        customerId: req.webhookData?.customer?.id || req.webhookData?.customer,
        webhookTopic: req.webhookTopic,
      });

      // Return 200 to acknowledge receipt (Shopify requirement)
      // But log the error for investigation
      res.status(200).json({
        received: true,
        error: "Webhook processed but encountered an error",
      });
    }
  }
);

// App subscriptions update webhook - for billing status changes
// Reference: https://shopify.dev/docs/apps/launch/billing/subscription-billing
// This webhook is used with Managed App Pricing to keep subscription status in sync
// Note: This webhook is automatically registered by Shopify for Managed App Pricing
// and cannot be configured in shopify.app.toml
app.post(
  "/webhooks/app/subscriptions/update",
  verifyWebhookSignature,
  async (req, res) => {
    try {
      // Log raw webhook data for debugging
      logger.info("[WEBHOOK] app/subscriptions/update - raw payload received", {
        shop: req.webhookShop,
        topic: req.webhookTopic,
        payloadKeys: Object.keys(req.webhookData || {}),
        fullPayload: JSON.stringify(req.webhookData),
      });

      // Extract subscription data - Shopify may send it in different formats:
      // 1. Direct: { id, status, ... } (root level)
      // 2. Nested: { app_subscription: { id, status, ... } }
      // 3. Array: { app_subscriptions: [{ id, status, ... }] }
      let app_subscription = null;

      if (req.webhookData) {
        // Try nested format first (most common)
        if (req.webhookData.app_subscription) {
          app_subscription = req.webhookData.app_subscription;
        }
        // Try array format
        else if (
          req.webhookData.app_subscriptions &&
          Array.isArray(req.webhookData.app_subscriptions) &&
          req.webhookData.app_subscriptions.length > 0
        ) {
          app_subscription = req.webhookData.app_subscriptions[0];
        }
        // Try direct format (if payload IS the subscription object)
        else if (req.webhookData.id && req.webhookData.status) {
          app_subscription = req.webhookData;
        }
      }

      const shop = req.webhookShop;

      if (!shop) {
        logger.error(
          "[WEBHOOK] app/subscriptions/update - missing shop domain",
          {
            headers: req.headers,
            webhookData: req.webhookData,
          }
        );
        return res.status(400).json({
          error: "Missing shop domain",
          received: true,
        });
      }

      logger.info("[WEBHOOK] app/subscriptions/update received", {
        shop,
        subscriptionId: app_subscription?.id,
        status: app_subscription?.status,
        webhookTopic: req.webhookTopic,
        hasSubscription: !!app_subscription,
      });

      // Handle subscription status changes:
      // The webhook payload contains the updated AppSubscription object
      // Common status values (AppSubscriptionStatus enum):
      // - ACTIVE: Subscription is active and billing
      // - PENDING: Waiting for merchant approval
      // - DECLINED: Merchant declined the charge
      // - EXPIRED: Subscription has expired
      // - CANCELLED: Subscription was cancelled
      // - FROZEN: Store billing account is frozen

      // The webhook also fires when:
      // - Subscription status changes (approval, cancellation, etc.)
      // - Capped amount is changed (for usage-based subscriptions)
      // - Subscription is created, updated, or cancelled

      if (app_subscription) {
        logger.info(
          "[WEBHOOK] app/subscriptions/update - subscription payload logged",
          {
            shop,
            subscriptionId: app_subscription?.id,
            status: app_subscription?.status,
            currentPeriodEnd: app_subscription?.currentPeriodEnd,
            createdAt: app_subscription?.createdAt,
            updatedAt: app_subscription?.updatedAt,
            lineItemsCount: app_subscription?.lineItems?.length || 0,
            lineItems: app_subscription?.lineItems?.map((item) => ({
              id: item?.id,
              planId: item?.plan?.id,
              planName: item?.plan?.name,
              hasPricingDetails: !!item?.plan?.pricingDetails,
            })),
          }
        );
      } else {
        logger.warn(
          "[WEBHOOK] app/subscriptions/update - payload missing subscription data",
          {
            shop,
            webhookDataKeys: Object.keys(req.webhookData || {}),
          }
        );
      }

      logger.info("[WEBHOOK] app/subscriptions/update processed successfully", {
        shop,
        subscriptionId: app_subscription?.id,
        status: app_subscription?.status,
      });

      res.status(200).json({ received: true });
    } catch (error) {
      logger.error(
        "[WEBHOOK ERROR] app/subscriptions/update failed",
        error,
        req,
        {
          shop: req.webhookShop,
          webhookTopic: req.webhookTopic,
          errorMessage: error.message,
          errorStack: error.stack,
        }
      );

      // Always return 200 to Shopify to prevent retries for processing errors
      // But log the error for debugging
      res.status(200).json({
        received: true,
        error: "Webhook processed but encountered an error",
      });
    }
  }
);

// Shop redact webhook - mandatory for GDPR compliance
// Reference: https://shopify.dev/docs/apps/build/compliance/privacy-law-compliance
// Must delete all shop data within 10 days of receiving this webhook
app.post("/webhooks/shop/redact", verifyWebhookSignature, async (req, res) => {
  try {
    const { shop_id, shop_domain } = req.webhookData;
    const shop = req.webhookShop || shop_domain;

    // Log webhook received for audit purposes
    logger.info(`[WEBHOOK] shop/redact received for shop: ${shop}`, {
      shop,
      webhookTopic: req.webhookTopic,
    });

    // Handle GDPR shop data deletion
    // Must delete all shop data within 10 days
    // This is a mandatory webhook for GDPR compliance

    // NOTE: This app stores data client-side only (localStorage in user's browser)
    // No server-side database or storage system exists
    // Shop configuration and data are stored client-side only
    // No server-side shop data is stored or processed

    // Data Storage Approach:
    // - Shop configuration: Stored in browser localStorage (client-side only)
    // - Product information: Retrieved from Shopify product pages (not stored)
    // - No server-side database or storage system

    // GDPR Compliance:
    // Since no server-side shop data is stored, this webhook returns success
    // Shop data is stored client-side only and is managed by the user's browser
    // Client-side data is automatically cleared when user clears browser data
    // If server-side storage is added in the future, implement data deletion here

    // Example data deletion logic (for future server-side storage):
    // - Delete shop configuration from database
    // - Delete shop-specific resources
    // - Delete shop session data
    // - Delete shop-related files from storage
    // - Log data deletion for audit purposes
    // - Verify data deletion was successful

    // Log successful processing
    logger.info(
      `[WEBHOOK] shop/redact processed successfully for shop: ${shop}`,
      {
        shop,
        webhookTopic: req.webhookTopic,
      }
    );

    // Return 200 to acknowledge receipt
    // Note: Actual data deletion (if needed) should be handled asynchronously
    res.status(200).json({ received: true });
  } catch (error) {
    // Log error for debugging
    logger.error(`[WEBHOOK ERROR] shop/redact failed`, error, req, {
      shop: req.webhookShop || req.webhookData?.shop_domain,
      webhookTopic: req.webhookTopic,
    });

    // Return 200 to acknowledge receipt (Shopify requirement)
    // But log the error for investigation
    res.status(200).json({
      received: true,
      error: "Webhook processed but encountered an error",
    });
  }
});

// Billing API Routes
// Get current subscription status using JWT from embedded UI
app.get("/api/billing/subscription", async (req, res) => {
  const requestId = `req-${Date.now()}-${Math.random()
    .toString(36)
    .substr(2, 9)}`;
  const startTime = Date.now();

  try {
    logger.info("[BILLING] [GET_SUBSCRIPTION] Request received", {
      requestId,
      method: req.method,
      path: req.path,
      query: req.query,
      timestamp: new Date().toISOString(),
    });

    const shop = req.query.shop;
    if (!shop) {
      logger.warn("[BILLING] [GET_SUBSCRIPTION] Missing shop parameter", {
        requestId,
        query: req.query,
      });
      return res.status(400).json({
        error: "Missing shop parameter",
        message: "Shop parameter is required in query string",
        requestId,
      });
    }

    const shopDomain = normalizeShopDomain(shop);
    if (!shopDomain) {
      logger.warn("[BILLING] [GET_SUBSCRIPTION] Invalid shop parameter", {
        requestId,
        originalShop: shop,
      });
      return res.status(400).json({
        error: "Invalid shop parameter",
        message: "Provide a valid .myshopify.com domain or shop handle",
        requestId,
      });
    }

    logger.info(
      "[BILLING] [GET_SUBSCRIPTION] Fetching subscription via GraphQL",
      {
        requestId,
        shop: shopDomain,
        hasRequestSession: !!req.session,
      }
    );

    // Use JWT session from request for GraphQL API call
    // Pass both decoded session and encoded token for token exchange
    const subscriptionStatus = await fetchManagedSubscriptionStatus(
      shopDomain,
      req.session,
      req.sessionToken
    );
    const duration = Date.now() - startTime;

    logger.info("[BILLING] [GET_SUBSCRIPTION] GraphQL subscription resolved", {
      requestId,
      shop: shopDomain,
      hasActiveSubscription: subscriptionStatus.hasActiveSubscription,
      planHandle: subscriptionStatus.plan?.handle,
      duration: `${duration}ms`,
    });

    res.json({
      ...subscriptionStatus,
      requestId,
    });
  } catch (error) {
    const duration = Date.now() - startTime;

    if (error instanceof SubscriptionStatusError) {
      logger.warn("[BILLING] [GET_SUBSCRIPTION] Subscription error", {
        requestId,
        duration: `${duration}ms`,
        error: error.message,
        details: error.details,
      });

      return res.status(error.status).json({
        error: error.message,
        details: error.details,
        requestId,
      });
    }

    logger.error("[BILLING] [GET_SUBSCRIPTION] Unexpected error", error, req, {
      requestId,
      duration: `${duration}ms`,
      errorType: error.constructor.name,
      errorCode: error.code,
    });

    if (!res.headersSent) {
      res.status(500).json({
        error: "Internal server error",
        message: error.message || "An unexpected error occurred",
        requestId,
      });
    }
  }
});

// Check if installation can proceed (plan selected check)
// This endpoint verifies from Shopify's side if a plan is selected before allowing theme editor access
app.get("/api/billing/check-installation", async (req, res) => {
  const requestId = `req-${Date.now()}-${Math.random()
    .toString(36)
    .substr(2, 9)}`;
  const startTime = Date.now();

  try {
    logger.info("[BILLING] [CHECK_INSTALLATION] Request received", {
      requestId,
      method: req.method,
      path: req.path,
      query: req.query,
      timestamp: new Date().toISOString(),
    });

    const shop = req.query.shop;
    if (!shop) {
      logger.warn("[BILLING] [CHECK_INSTALLATION] Missing shop parameter", {
        requestId,
        query: req.query,
      });
      return res.status(400).json({
        error: "Missing shop parameter",
        message: "Shop parameter is required in query string",
        requestId,
        canProceed: false,
      });
    }

    const shopDomain = normalizeShopDomain(shop);
    if (!shopDomain) {
      logger.warn("[BILLING] [CHECK_INSTALLATION] Invalid shop parameter", {
        requestId,
        originalShop: shop,
      });
      return res.status(400).json({
        error: "Invalid shop parameter",
        message: "Provide a valid .myshopify.com domain or shop handle",
        requestId,
        canProceed: false,
      });
    }

    logger.info(
      "[BILLING] [CHECK_INSTALLATION] Checking subscription via GraphQL",
      {
        requestId,
        shop: shopDomain,
        hasRequestSession: !!req.session,
      }
    );

    // Use JWT session from request for GraphQL API call
    // Pass both decoded session and encoded token for token exchange
    const subscriptionStatus = await fetchManagedSubscriptionStatus(
      shopDomain,
      req.session,
      req.sessionToken
    );
    const duration = Date.now() - startTime;

    // Check if a plan is selected (has plan handle)
    const hasPlanSelected =
      subscriptionStatus &&
      subscriptionStatus.plan &&
      subscriptionStatus.plan.handle;

    logger.info("[BILLING] [CHECK_INSTALLATION] Installation check completed", {
      requestId,
      shop: shopDomain,
      hasPlanSelected,
      planHandle: subscriptionStatus?.plan?.handle,
      duration: `${duration}ms`,
    });

    res.json({
      canProceed: hasPlanSelected,
      hasPlanSelected,
      planHandle: subscriptionStatus?.plan?.handle,
      planName: subscriptionStatus?.plan?.name,
      requestId,
    });
  } catch (error) {
    const duration = Date.now() - startTime;

    if (error instanceof SubscriptionStatusError) {
      logger.warn("[BILLING] [CHECK_INSTALLATION] Subscription error", {
        requestId,
        duration: `${duration}ms`,
        error: error.message,
        details: error.details,
      });

      return res.status(error.status).json({
        error: error.message,
        details: error.details,
        canProceed: false,
        hasPlanSelected: false,
        requestId,
      });
    }

    logger.error(
      "[BILLING] [CHECK_INSTALLATION] Unexpected error",
      error,
      req,
      {
        requestId,
        duration: `${duration}ms`,
        errorType: error.constructor.name,
        errorCode: error.code,
      }
    );

    if (!res.headersSent) {
      res.status(500).json({
        error: "Internal server error",
        message: error.message || "An unexpected error occurred",
        canProceed: false,
        hasPlanSelected: false,
        requestId,
      });
    }
  }
});

// Billing return URL - called by Shopify after merchant approves or declines the charge
// This endpoint does not use any database; it simply redirects back to the app,
// and the frontend can call /api/billing/subscription to get the latest status.
app.get("/api/billing/return", async (req, res) => {
  const requestId = `req-${Date.now()}-${Math.random()
    .toString(36)
    .substr(2, 9)}`;

  try {
    const shop = req.query.shop;

    logger.info("[BILLING] [RETURN] Request received", {
      requestId,
      shop,
      query: req.query,
    });

    const shopDomain = normalizeShopDomain(shop);
    if (!shopDomain) {
      return res.status(400).send("Invalid shop parameter");
    }

    const redirectBase = appUrl || `https://${shopDomain}`;
    const redirectUrl = `${redirectBase}/?shop=${encodeURIComponent(
      shopDomain
    )}`;

    return res.redirect(302, redirectUrl);
  } catch (error) {
    logger.error("[BILLING] [RETURN] Unexpected error", error, req, {
      requestId,
    });

    if (!res.headersSent) {
      res.status(500).send("An unexpected error occurred.");
    }
  }
});

app.post("/api/billing/subscribe", async (req, res) => {
  const requestId = `req-${Date.now()}-${Math.random()
    .toString(36)
    .substr(2, 9)}`;

  try {
    const { shop, planHandle, promoCode } = req.body || {};

    logger.info("[API] [SUBSCRIBE] Request received", {
      requestId,
      shop,
      planHandle,
    });

    if (!shop || !planHandle) {
      return res.status(400).json({
        error: "Missing required parameters",
        message: "Both shop and planHandle are required.",
        requestId,
      });
    }

    const shopDomain = normalizeShopDomain(shop);
    if (!shopDomain) {
      return res.status(400).json({
        error: "Invalid shop parameter",
        message: "Provide a valid .myshopify.com domain or shop handle",
        requestId,
      });
    }

    const result = await createAppSubscription(
      shopDomain,
      planHandle,
      req.sessionToken,
      promoCode || null
    );

    logger.info("[API] [SUBSCRIBE] Subscription created", {
      requestId,
      shop: shopDomain,
      planHandle,
      appSubscriptionId: result.appSubscription?.id,
      appSubscriptionStatus: result.appSubscription?.status,
      hasConfirmationUrl: !!result.confirmationUrl,
    });

    // Ensure Content-Type is set explicitly
    res.setHeader("Content-Type", "application/json");
    return res.status(200).json({
      requestId,
      confirmationUrl: result.confirmationUrl,
      appSubscription: result.appSubscription,
      plan: result.plan,
    });
  } catch (error) {
    if (error instanceof SubscriptionStatusError) {
      logger.warn("[API] [SUBSCRIBE] Subscription error", {
        requestId,
        error: error.message,
        details: error.details,
      });

      return res.status(error.status).json({
        error: error.message,
        details: error.details,
        requestId,
      });
    }

    logger.error("[API] [SUBSCRIBE] Unexpected error", error, req, {
      requestId,
    });

    return res.status(500).json({
      error: "Internal server error",
      message: error.message || "An unexpected error occurred",
      requestId,
    });
  }
});

// Validate promotional code
app.post("/api/billing/validate-promo", async (req, res) => {
  const requestId = `req-${Date.now()}-${Math.random()
    .toString(36)
    .substr(2, 9)}`;

  try {
    const { code, planHandle } = req.body || {};

    logger.info("[API] [VALIDATE-PROMO] Request received", {
      requestId,
      code: code ? code.toUpperCase() : null,
      planHandle,
    });

    if (!code || !planHandle) {
      return res.status(400).json({
        error: "Missing required parameters",
        message: "Both code and planHandle are required.",
        requestId,
      });
    }

    const planConfig = billing.getPlan ? billing.getPlan(planHandle) : null;
    if (!planConfig) {
      return res.status(400).json({
        error: "Invalid plan handle",
        message: "Provide a valid planHandle.",
        requestId,
      });
    }

    const promoCode = billing.validatePromoCode
      ? billing.validatePromoCode(code, planConfig.interval)
      : null;

    if (!promoCode) {
      logger.info("[API] [VALIDATE-PROMO] Invalid code", {
        requestId,
        code: code.toUpperCase(),
        planHandle,
        interval: planConfig.interval,
      });
      return res.status(200).json({
        valid: false,
        message: "Code promotionnel invalide ou expiré",
        requestId,
      });
    }

    const discount = billing.calculateDiscount
      ? billing.calculateDiscount(
          planConfig.price,
          planConfig.currencyCode,
          promoCode
        )
      : null;

    logger.info("[API] [VALIDATE-PROMO] Valid code", {
      requestId,
      code: code.toUpperCase(),
      planHandle,
      discountType: promoCode.type,
      discountValue: promoCode.value,
      originalPrice: planConfig.price,
      discountedPrice: discount?.discountedPrice,
    });

    return res.status(200).json({
      valid: true,
      code: code.toUpperCase(),
      discount: {
        type: promoCode.type,
        value: discount.discountValue,
        durationLimitInIntervals: promoCode.durationLimitInIntervals,
        description: promoCode.description,
      },
      pricing: {
        original: planConfig.price,
        discounted: discount.discountedPrice,
        savings: planConfig.price - discount.discountedPrice,
      },
      requestId,
    });
  } catch (error) {
    logger.error("[API] [VALIDATE-PROMO] Unexpected error", error, req, {
      requestId,
    });
    return res.status(500).json({
      error: "Internal server error",
      message: error.message || "An unexpected error occurred",
      requestId,
    });
  }
});

// Get available plans
app.get("/api/billing/plans", (req, res) => {
  try {
    const plans = billing.getAvailablePlans();
    res.json({ plans });
  } catch (error) {
    logger.error("[BILLING] Failed to get plans", error, req);
    res.status(500).json({
      error: "Failed to get plans",
      message: error.message,
    });
  }
});

// Cancel subscription - DEPRECATED: Using Managed App Pricing
// With Managed App Pricing, cancellations are handled through Shopify's admin interface
// This endpoint redirects users to the plan selection page where they can cancel
app.post("/api/billing/cancel", async (req, res) => {
  const { shop } = req.body;

  if (!shop) {
    return res.status(400).json({
      error: "Missing shop parameter",
    });
  }

  const shopDomain = shop.includes(".myshopify.com")
    ? shop
    : `${shop}.myshopify.com`;

  logger.warn(
    "[API] [CANCEL] Deprecated endpoint called - using Managed App Pricing",
    {
      shop: shopDomain,
    }
  );

  // Extract store handle and app handle
  const storeHandle = shopDomain.replace(".myshopify.com", "");
  const appHandle = process.env.VITE_APP_HANDLE || "nutryon";

  // Redirect to Shopify's plan selection page where users can cancel
  // Correct format for Managed App Pricing: https://admin.shopify.com/store/{store_handle}/charges/{app_handle}/pricing_plans
  const planSelectionUrl = `https://admin.shopify.com/store/${storeHandle}/charges/${appHandle}/pricing_plans`;

  return res.status(200).json({
    message:
      "This app uses Shopify Managed App Pricing. Please cancel your subscription through the Shopify admin.",
    managedPricing: true,
    redirectUrl: planSelectionUrl,
    instructions:
      "Visit the plan selection page in Shopify admin to cancel your subscription",
  });
});

// Change plan - DEPRECATED: Using Managed App Pricing
// This endpoint is no longer used. The app now redirects to Shopify's plan selection page.
app.post("/api/billing/change-plan", async (req, res) => {
  logger.warn(
    "[API] [CHANGE_PLAN] Deprecated endpoint called - using Managed App Pricing",
    {
      shop: req.body?.shop || req.query?.shop,
      planHandle: req.body?.planHandle,
    }
  );

  return res.status(410).json({
    error: "Deprecated",
    message:
      "This app now uses Shopify Managed App Pricing. Please use the plan selection page in the Shopify admin to change your plan.",
    managedPricing: true,
  });
});

// API Routes
app.post("/api/tryon/generate", async (req, res) => {
  try {
    const { personImage, clothingImage, storeName, clothingKey, personKey } =
      req.body;

    logger.info("[API] Try-on generation request received", {
      storeName,
      hasPersonImage: !!personImage,
      hasClothingImage: !!clothingImage,
      hasClothingKey: !!clothingKey,
      hasPersonKey: !!personKey,
    });

    if (!personImage || !clothingImage) {
      logger.warn("[API] Try-on generation request missing required images", {
        hasPersonImage: !!personImage,
        hasClothingImage: !!clothingImage,
      });
      return res.status(400).json({ error: "Missing required images" });
    }

    // Convert base64 to Blob for FormData
    const personBlob = await fetch(personImage).then((r) => r.blob());
    const clothingBlob = await fetch(clothingImage).then((r) => r.blob());

    // Create FormData for multipart/form-data request
    const formData = new FormData();
    formData.append("personImage", personBlob, "person.jpg");
    formData.append("clothingImage", clothingBlob, "clothing.jpg");

    // Add storeName if provided
    if (storeName) {
      formData.append("storeName", storeName);
    }

    // Add clothingKey if provided
    if (clothingKey) {
      formData.append("clothingKey", clothingKey);
    }

    // Add personKey if provided
    if (personKey) {
      formData.append("personKey", personKey);
    }

    const startTime = Date.now();
    logger.info("[API] Sending try-on generation request to external API", {
      storeName,
    });

    // Forward to your existing API
    const response = await fetch(
      "https://try-on-server-v1.onrender.com/api/fashion-photo",
      {
        method: "POST",
        headers: {
          "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
          "Content-Language": "fr",
        },
        body: formData,
      }
    );

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      logger.error("[API] External API returned error", null, req, {
        status: response.status,
        statusText: response.statusText,
        errorText: errorText.substring(0, 500), // Limit error text length
        storeName,
      });
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    const duration = Date.now() - startTime;

    logger.info("[API] Try-on generation completed successfully", {
      storeName,
      duration: `${duration}ms`,
      hasResult: !!data,
    });

    res.json(data);
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error("[API] Try-on generation failed", error, req, {
      storeName,
      duration: `${duration}ms`,
    });

    res.status(500).json({
      error: "Failed to generate try-on image",
      message: error.message,
    });
  }
});

// Product data endpoint (public - for widget use)
app.get("/api/products/:productId", async (req, res) => {
  try {
    const productId = req.params.productId;
    logger.info("[API] Product data request received", {
      productId,
    });

    // Public request - return basic product info from query
    // Widget will get product data from page context
    res.json({
      id: productId,
      message: "Product data available from page context",
    });
  } catch (error) {
    logger.error("[API] Product data request failed", error, req, {
      productId: req.params.productId,
    });

    res
      .status(500)
      .json({ error: "Failed to fetch product", message: error.message });
  }
});

// Widget route - serves the widget page
app.get("/widget", (req, res) => {
  // In Vercel, static files are handled by the platform
  // This route is mainly for API proxy scenarios
  if (isVercel) {
    // In Vercel, redirect to the static file
    res.redirect("/index.html");
  } else {
    res.sendFile(join(__dirname, "../dist/index.html"));
  }
});

// App proxy route for Shopify app proxy
// Shopify app proxy format: /apps/{prefix}/{subpath}/{path}
// With prefix="apps" and subpath="a", the URL becomes: /apps/apps/a/{path}
// MUST verify signature for security - reference: https://shopify.dev/docs/apps/build/online-store/app-proxies/authenticate-app-proxies
app.get("/apps/apps/a/*", verifyAppProxySignature, (req, res) => {
  try {
    // Handle app proxy requests
    // Extract path after /apps/apps/a/
    const proxyPath = req.path.replace("/apps/apps/a", "");

    // Verify shop parameter is present and valid
    if (!req.proxyShop) {
      logger.warn("[APP PROXY] Missing shop parameter", {
        proxyPath,
      });
      return res.status(400).json({
        error: "Bad Request",
        message: "Missing shop parameter",
      });
    }

    // Verify shop format (should be a .myshopify.com domain)
    if (!req.proxyShop.endsWith(".myshopify.com")) {
      logger.warn("[APP PROXY] Invalid shop domain format", {
        shop: req.proxyShop,
        proxyPath,
      });
      return res.status(400).json({
        error: "Bad Request",
        message: "Invalid shop domain format",
      });
    }

    logger.info("[APP PROXY] App proxy request processed", {
      shop: req.proxyShop,
      proxyPath,
      loggedInCustomerId: req.proxyLoggedInCustomerId,
    });

    if (proxyPath === "/widget" || proxyPath.startsWith("/widget")) {
      // Serve widget page
      if (isVercel) {
        res.redirect("/index.html");
      } else {
        res.sendFile(join(__dirname, "../dist/index.html"));
      }
    } else {
      res.status(404).json({ error: "Not found" });
    }
  } catch (error) {
    logger.error("[APP PROXY] App proxy request failed", error, req, {
      proxyPath: req.path.replace("/apps/apps/a", ""),
      shop: req.proxyShop,
    });

    if (!res.headersSent) {
      res.status(500).json({
        error: "Internal server error",
        message:
          error.message || "An error occurred processing the app proxy request",
      });
    }
  }
});

// Serve frontend (only in non-Vercel environment)
// In Vercel, static files and SPA routing are handled by vercel.json
if (!isVercel) {
  app.get("*", (req, res) => {
    res.sendFile(join(__dirname, "../dist/index.html"));
  });
}

// Error handling middleware (must be last)
app.use((err, req, res, next) => {
  // Log error using logger
  logger.error("Unhandled error in request", err, req, {
    status: err.status || 500,
  });

  if (!res.headersSent) {
    res.status(err.status || 500).json({
      error: err.message || "Internal server error",
    });
  }
});

// Only start server if not in Vercel environment
if (!isVercel) {
  app.listen(PORT, () => {
    // Server running
  });
}

// Export app for Vercel serverless functions
export default app;
