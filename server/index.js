import "@shopify/shopify-api/adapters/node";
import express from "express";
import { shopifyApi, LATEST_API_VERSION } from "@shopify/shopify-api";
import { restResources } from "@shopify/shopify-api/rest/admin/2024-01";
import { join } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import dotenv from "dotenv";
import crypto from "crypto";
import * as logger from "./utils/logger.js";
import * as billing from "./utils/billing.js";

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

    // Get session token from Authorization header (optional for now)
    // App Bridge will send this for authenticated requests
    const authHeader = req.get("Authorization");

    if (authHeader && authHeader.startsWith("Bearer ")) {
      const sessionToken = authHeader.replace("Bearer ", "");

      // Verify session token using Shopify API
      try {
        const session = await shopify.session.decodeSessionToken(sessionToken);
        // Attach session info to request
        req.session = session;
        req.shop = session.shop;
        logger.info("[AUTH] Session token verified", {
          shop: session.shop,
          path: req.path,
        });
      } catch (error) {
        logger.warn("[AUTH] Invalid session token", {
          path: req.path,
          error: error.message,
        });
        // Don't fail the request, but log the warning
        // This allows backward compatibility while transitioning to embedded app
      }
    } else {
      // No session token provided - try to get shop from query params or body
      // This maintains backward compatibility
      const shopParam = req.query.shop || req.body?.shop;
      if (shopParam) {
        req.shop = shopParam.includes(".myshopify.com")
          ? shopParam
          : `${shopParam}.myshopify.com`;
      }
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

    const authRoute = await shopify.auth.begin({
      shop: shopDomain,
      callbackPath: "/auth/callback",
      isOnline: false,
      rawRequest: req,
      rawResponse: res,
    });

    res.redirect(authRoute);
  } catch (error) {
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
    logger.info("[OAUTH] OAuth callback received");

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
        }
      );
      return res.status(500).json({
        error: "Authentication failed",
        message: "Missing shop or API key information",
      });
    }

    logger.info("[OAUTH] OAuth callback completed successfully", {
      shop,
    });

    // For embedded apps, redirect with host parameter
    // Get host from query params (provided by Shopify during OAuth)
    const host = req.query.host;

    if (host) {
      // Embedded app redirect - include host parameter
      const redirectUrl = `${
        process.env.VITE_SHOPIFY_APP_URL || appUrl
      }/?shop=${shop}&host=${encodeURIComponent(host)}`;
      res.redirect(redirectUrl);
    } else {
      // Fallback for non-embedded or legacy redirect
      const redirectUrl = `https://${shop}/admin/apps/${apiKey}`;
      res.redirect(redirectUrl);
    }
  } catch (error) {
    logger.error("[OAUTH] OAuth callback failed", error, req);

    if (!res.headersSent) {
      res.status(500).json({
        error: "OAuth callback failed",
        message: error.message || "An error occurred during the OAuth callback",
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

      // NOTE: This app stores data client-side only (localStorage)
      // No server-side database or storage system exists
      // Shopify API library handles session cleanup automatically
      // If server-side storage is added in the future, implement cleanup logic here

      // Example cleanup logic (for future server-side storage):
      // - Delete shop sessions from database
      // - Remove shop configuration data
      // - Clean up shop-specific resources
      // - Revoke access tokens (handled by Shopify API library)

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
app.post(
  "/webhooks/app/subscriptions/update",
  verifyWebhookSignature,
  async (req, res) => {
    try {
      const { app_subscription } = req.webhookData;
      const shop = req.webhookShop;

      logger.info("[WEBHOOK] app/subscriptions/update received", {
        shop,
        subscriptionId: app_subscription?.id,
        status: app_subscription?.status,
        webhookTopic: req.webhookTopic,
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

      // Update your database/cache with new subscription status
      // Send notifications if needed
      // Handle feature access based on status

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
        }
      );

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
// Get current subscription status
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

    // Normalize shop domain
    const shopDomain = shop.includes(".myshopify.com")
      ? shop
      : `${shop}.myshopify.com`;

    logger.info("[BILLING] [GET_SUBSCRIPTION] Shop domain normalized", {
      requestId,
      originalShop: shop,
      normalizedShop: shopDomain,
    });

    // Get session for the shop
    let session;
    try {
      const sessionId = shopify.session.getOfflineId(shopDomain);
      logger.info("[BILLING] [GET_SUBSCRIPTION] Retrieving session", {
        requestId,
        sessionId,
        shopDomain,
      });

      session = await shopify.session.getSessionById(sessionId);

      logger.info("[BILLING] [GET_SUBSCRIPTION] Session retrieved", {
        requestId,
        hasSession: !!session,
        sessionId: session?.id || "N/A",
      });
    } catch (sessionError) {
      logger.error(
        "[BILLING] [GET_SUBSCRIPTION] Session retrieval failed",
        sessionError,
        req,
        {
          requestId,
          shopDomain,
          errorType: sessionError.constructor.name,
          errorCode: sessionError.code,
        }
      );
      return res.status(500).json({
        error: "Session retrieval failed",
        message: sessionError.message || "Failed to retrieve session",
        requestId,
      });
    }

    if (!session) {
      logger.warn("[BILLING] [GET_SUBSCRIPTION] Session not found", {
        requestId,
        shopDomain,
      });
      return res.status(401).json({
        error: "Session not found",
        message: "Please install the app first",
        requestId,
      });
    }

    let subscriptionStatus;
    try {
      logger.info("[BILLING] [GET_SUBSCRIPTION] Checking subscription status", {
        requestId,
        shopDomain,
      });

      subscriptionStatus = await billing.checkSubscription(shopify, session);

      logger.info(
        "[BILLING] [GET_SUBSCRIPTION] Subscription status retrieved",
        {
          requestId,
          shop: shopDomain,
          hasActiveSubscription: subscriptionStatus.hasActiveSubscription,
          planHandle: subscriptionStatus.plan?.handle,
          isFree: subscriptionStatus.isFree,
        }
      );
    } catch (checkError) {
      logger.error(
        "[BILLING] [GET_SUBSCRIPTION] Subscription check failed",
        checkError,
        req,
        {
          requestId,
          shopDomain,
          errorType: checkError.constructor.name,
          errorCode: checkError.code,
        }
      );
      return res.status(500).json({
        error: "Subscription check failed",
        message: checkError.message || "Failed to check subscription status",
        requestId,
      });
    }

    const duration = Date.now() - startTime;
    logger.info("[BILLING] [GET_SUBSCRIPTION] Request completed successfully", {
      requestId,
      shop: shopDomain,
      duration: `${duration}ms`,
    });

    res.json({
      ...subscriptionStatus,
      requestId, // Include for debugging
    });
  } catch (error) {
    const duration = Date.now() - startTime;
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

// Create subscription
app.post("/api/billing/subscribe", async (req, res) => {
  const startTime = Date.now();
  const requestId = `req-${Date.now()}-${Math.random()
    .toString(36)
    .substr(2, 9)}`;
  const apiTimer = logger.createTimer(`[API] [SUBSCRIBE] Total Request Time`);

  try {
    logger.info("[API] [SUBSCRIBE] ===== REQUEST START =====", {
      requestId,
      method: req.method,
      path: req.path,
      url: req.url,
      ip: req.ip || req.connection?.remoteAddress,
      userAgent: req.get("user-agent"),
      timestamp: new Date().toISOString(),
      headers: {
        authorization: req.get("authorization") ? "present" : "missing",
        contentType: req.get("content-type"),
        accept: req.get("accept"),
      },
    });

    const bodyParseTimer = logger.createTimer(`[API] [SUBSCRIBE] Body Parsing`);
    const { planHandle, returnUrl, trialDays } = req.body;
    bodyParseTimer.log("Request body parsed", {
      requestId,
      planHandle: planHandle || "missing",
      returnUrl: returnUrl || "not provided",
      trialDays: trialDays || 0,
      hasBody: !!req.body,
      bodyKeys: req.body ? Object.keys(req.body) : [],
    });

    if (!planHandle) {
      logger.warn("[API] [SUBSCRIBE] Missing planHandle parameter", {
        requestId,
        body: req.body,
      });
      return res.status(400).json({
        error: "Missing required parameters",
        message: "planHandle is required",
      });
    }

    // Get shop from authenticated session (more secure than request body)
    let shopDomain = req.shop || req.session?.shop;

    logger.info("[API] [SUBSCRIBE] Shop domain extraction - step 1", {
      requestId,
      shopFromReq: req.shop || "not available",
      shopFromSession: req.session?.shop || "not available",
      shopFromQuery: req.query.shop || "not available",
      shopFromBody: req.body.shop || "not available",
    });

    // Fallback: try to get from query params or request body (for backward compatibility)
    if (!shopDomain) {
      const shopParam = req.query.shop || req.body.shop;
      if (shopParam) {
        shopDomain = shopParam.includes(".myshopify.com")
          ? shopParam
          : `${shopParam}.myshopify.com`;
        logger.info("[API] [SUBSCRIBE] Shop domain extracted from fallback", {
          requestId,
          shopParam,
          normalizedShopDomain: shopDomain,
        });
      }
    }

    if (!shopDomain) {
      logger.error("[API] [SUBSCRIBE] Shop domain not found", {
        requestId,
        reqShop: req.shop,
        reqSessionShop: req.session?.shop,
        queryShop: req.query.shop,
        bodyShop: req.body.shop,
        headers: {
          authorization: req.get("authorization") ? "present" : "missing",
        },
      });
      return res.status(401).json({
        error: "Unauthorized",
        message:
          "Shop information not found. Please ensure you're authenticated.",
      });
    }

    // Normalize shop domain
    const originalShopDomain = shopDomain;
    shopDomain = shopDomain.includes(".myshopify.com")
      ? shopDomain
      : `${shopDomain}.myshopify.com`;

    logger.info("[API] [SUBSCRIBE] Shop domain normalized", {
      requestId,
      originalShopDomain,
      normalizedShopDomain: shopDomain,
    });

    // Get session for the shop
    const sessionIdTimer = logger.createTimer(
      `[API] [SUBSCRIBE] Session ID Generation`
    );
    const sessionId = shopify.session.getOfflineId(shopDomain);
    sessionIdTimer.log("Session ID generated", {
      requestId,
      shopDomain,
      sessionId,
    });

    const sessionRetrieveTimer = logger.createTimer(
      `[API] [SUBSCRIBE] Session Retrieval`
    );
    logger.info("[API] [SUBSCRIBE] Attempting to retrieve session", {
      requestId,
      sessionId,
      shopDomain,
    });

    // Add timeout for session retrieval (5 seconds max)
    const sessionTimeoutMs = 5000;
    let sessionTimeoutId = null;
    const sessionTimeoutPromise = new Promise((_, reject) => {
      sessionTimeoutId = setTimeout(() => {
        logger.error("[API] [SUBSCRIBE] Session retrieval timeout", null, req, {
          requestId,
          sessionId,
          shopDomain,
          timeoutMs: sessionTimeoutMs,
        });
        reject(new Error("Session retrieval timed out after 5 seconds"));
      }, sessionTimeoutMs);
    });

    let session;
    try {
      const sessionPromise = shopify.session.getSessionById(sessionId);
      session = await Promise.race([sessionPromise, sessionTimeoutPromise]);

      // Clear timeout if successful
      if (sessionTimeoutId) {
        clearTimeout(sessionTimeoutId);
        sessionTimeoutId = null;
      }

      const sessionRetrieveDuration = sessionRetrieveTimer.elapsed();

      logger.info("[API] [SUBSCRIBE] Session retrieved", {
        requestId,
        sessionId,
        hasSession: !!session,
        sessionShop: session?.shop || "N/A",
        sessionId: session?.id || "N/A",
        hasAccessToken: !!session?.accessToken,
        accessTokenLength: session?.accessToken?.length || 0,
        duration: `${sessionRetrieveDuration}ms`,
      });
    } catch (sessionError) {
      // Clear timeout if error occurred
      if (sessionTimeoutId) {
        clearTimeout(sessionTimeoutId);
        sessionTimeoutId = null;
      }

      const sessionRetrieveDuration = sessionRetrieveTimer.elapsed();
      logger.error(
        "[API] [SUBSCRIBE] Session retrieval failed",
        sessionError,
        req,
        {
          requestId,
          sessionId,
          shopDomain,
          duration: `${sessionRetrieveDuration}ms`,
          isTimeout:
            sessionError.message?.includes("timeout") ||
            sessionError.message?.includes("timed out"),
          errorCode: sessionError.code,
        }
      );
      throw sessionError;
    }

    if (!session) {
      logger.error("[API] [SUBSCRIBE] Session not found", {
        requestId,
        shopDomain,
        sessionId,
      });
      return res.status(401).json({
        error: "Session not found",
        message: "Please install the app first",
      });
    }

    // Default return URL if not provided
    const defaultReturnUrl = `${
      process.env.VITE_SHOPIFY_APP_URL || appUrl
    }/auth/callback?shop=${shopDomain}`;
    const finalReturnUrl = returnUrl || defaultReturnUrl;

    logger.info("[API] [SUBSCRIBE] Return URL determined", {
      requestId,
      providedReturnUrl: returnUrl || "not provided",
      defaultReturnUrl,
      finalReturnUrl,
    });

    logger.info("[API] [SUBSCRIBE] Calling billing.createSubscription", {
      requestId,
      shopDomain,
      planHandle,
      finalReturnUrl,
      trialDays: trialDays || 0,
      replacementBehavior: "STANDARD",
      sessionId: session.id || "N/A",
    });

    const billingTimer = logger.createTimer(
      `[API] [SUBSCRIBE] Billing.createSubscription`
    );
    let result;

    try {
      result = await billing.createSubscription(
        shopify,
        session,
        planHandle,
        finalReturnUrl,
        trialDays || 0,
        "STANDARD" // Default replacement behavior
      );

      const billingDuration = billingTimer.elapsed();
      billingTimer.log("Billing subscription created", {
        requestId,
        shop: shopDomain,
        planHandle,
        isFree: result.isFree,
        hasConfirmationUrl: !!result.confirmationUrl,
        hasSubscription: !!result.subscription,
        subscriptionId: result.subscription?.id || "N/A",
        subscriptionStatus: result.subscription?.status || "N/A",
      });

      const totalDuration = apiTimer.elapsed();
      logger.info("[API] [SUBSCRIBE] ===== REQUEST SUCCESS =====", {
        requestId,
        shop: shopDomain,
        planHandle,
        isFree: result.isFree,
        hasConfirmationUrl: !!result.confirmationUrl,
        totalDuration: `${totalDuration}ms`,
        breakdown: {
          bodyParsing: bodyParseTimer.elapsedMs(),
          shopExtraction: "N/A", // Could add timer if needed
          sessionIdGeneration: sessionIdTimer.elapsedMs(),
          sessionRetrieval: sessionRetrieveTimer.elapsedMs(),
          billingCreation: billingDuration,
          total: totalDuration,
        },
      });

      res.json(result);
    } catch (billingError) {
      const billingDuration = billingTimer.elapsed();
      logger.error(
        "[API] [SUBSCRIBE] billing.createSubscription failed",
        billingError,
        req,
        {
          requestId,
          shop: shopDomain,
          planHandle,
          duration: `${billingDuration}ms`,
          isTimeout:
            billingError.message?.includes("timeout") ||
            billingError.message?.includes("timed out"),
        }
      );
      throw billingError;
    }
  } catch (error) {
    const totalDuration = apiTimer.elapsed();

    // Handle timeout errors specifically
    const isTimeout =
      error.message?.includes("timeout") ||
      error.message?.includes("timed out") ||
      error.code === "ETIMEDOUT" ||
      error.code === "ECONNRESET";

    logger.error("[API] [SUBSCRIBE] ===== REQUEST FAILED =====", {
      requestId,
      error: error.message,
      errorType: error.constructor.name,
      errorCode: error.code,
      errorStack: error.stack?.substring(0, 1000), // Truncate stack trace
      totalDuration: `${totalDuration}ms`,
      shop: req.shop || req.query.shop || req.body?.shop || "unknown",
      isTimeout,
      errorDetails: {
        name: error.name,
        message: error.message,
        code: error.code,
        cause: error.cause,
      },
    });

    // Log additional context if available
    if (error.response) {
      logger.error("[API] [SUBSCRIBE] Error response details", {
        requestId,
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data,
      });
    }

    const statusCode = isTimeout ? 504 : 500;
    const errorMessage = isTimeout
      ? "The subscription request timed out. Please try again. If this persists, check your Shopify connection."
      : error.message || "Failed to create subscription";

    if (!res.headersSent) {
      res.status(statusCode).json({
        error: isTimeout ? "Gateway Timeout" : "Failed to create subscription",
        message: errorMessage,
        requestId, // Include requestId for debugging
      });
    } else {
      logger.warn(
        "[API] [SUBSCRIBE] Response already sent, cannot send error response",
        {
          requestId,
        }
      );
    }
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

// Cancel subscription
app.post("/api/billing/cancel", async (req, res) => {
  try {
    const { shop, prorate } = req.body;

    if (!shop) {
      return res.status(400).json({
        error: "Missing shop parameter",
      });
    }

    const shopDomain = shop.includes(".myshopify.com")
      ? shop
      : `${shop}.myshopify.com`;

    const sessionId = shopify.session.getOfflineId(shopDomain);
    const session = await shopify.session.getSessionById(sessionId);

    if (!session) {
      return res.status(401).json({
        error: "Session not found",
        message: "Please install the app first",
      });
    }

    const result = await billing.cancelSubscription(
      shopify,
      session,
      prorate || false
    );

    res.json(result);
  } catch (error) {
    logger.error("[BILLING] Failed to cancel subscription", error, req);
    res.status(500).json({
      error: "Failed to cancel subscription",
      message: error.message,
    });
  }
});

// Change plan
app.post("/api/billing/change-plan", async (req, res) => {
  try {
    const { shop, planHandle, returnUrl, replacementBehavior } = req.body;

    if (!shop || !planHandle) {
      return res.status(400).json({
        error: "Missing required parameters",
        message: "shop and planHandle are required",
      });
    }

    const shopDomain = shop.includes(".myshopify.com")
      ? shop
      : `${shop}.myshopify.com`;

    const sessionId = shopify.session.getOfflineId(shopDomain);
    const session = await shopify.session.getSessionById(sessionId);

    if (!session) {
      return res.status(401).json({
        error: "Session not found",
        message: "Please install the app first",
      });
    }

    const defaultReturnUrl = `${
      process.env.VITE_SHOPIFY_APP_URL || appUrl
    }/auth/callback?shop=${shopDomain}`;
    const finalReturnUrl = returnUrl || defaultReturnUrl;

    const result = await billing.changePlan(
      shopify,
      session,
      planHandle,
      finalReturnUrl,
      replacementBehavior || "STANDARD"
    );

    res.json(result);
  } catch (error) {
    logger.error("[BILLING] Failed to change plan", error, req);
    res.status(500).json({
      error: "Failed to change plan",
      message: error.message,
    });
  }
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
