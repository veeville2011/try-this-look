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
import * as creditManager from "./utils/creditManager.js";
import * as creditMetafield from "./utils/creditMetafield.js";
import * as creditDeduction from "./utils/creditDeduction.js";
import * as creditReset from "./utils/creditReset.js";
import * as couponService from "./utils/couponService.js";
import * as creditPurchase from "./utils/creditPurchase.js";
import * as trialManager from "./utils/trialManager.js";
import * as subscriptionReplacement from "./utils/subscriptionReplacement.js";
import * as trialNotificationService from "./utils/trialNotificationService.js";
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

const mapSubscriptionToPlan = (appSubscription, customTrialStatus = null) => {
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

  // CRITICAL: ALWAYS use custom trial status from metafields or calculated from subscription data
  // NO FALLBACKS - customTrialStatus is ALWAYS provided and calculated correctly
  let trialDays = null;
  let trialDaysRemaining = null;
  let isInTrial = false;

  if (!customTrialStatus) {
    // This should never happen - customTrialStatus should always be calculated
    logger.error("[BILLING] customTrialStatus is null - this should not happen", null, null, {
      shop: appSubscription?.id,
      hasActiveSubscription: !!appSubscription,
    });
    // Default to no trial if customTrialStatus is missing
    isInTrial = false;
    trialDaysRemaining = 0;
    trialDays = matchedPlan?.trialDays || appSubscription?.trialDays || null;
  } else {
    // ALWAYS use customTrialStatus - it's calculated from metafields or subscription data
    isInTrial = customTrialStatus.isTrial;
    trialDaysRemaining = customTrialStatus.daysRemaining || 0;
    trialDays = matchedPlan?.trialDays || 30; // Use config value (30 days) for display
  }

  return {
    hasActiveSubscription,
    isFree: !hasActiveSubscription,
    plan,
    subscription: {
      id: appSubscription.id,
      status: appSubscription.status,
      currentPeriodEnd: appSubscription.currentPeriodEnd,
      currentPeriodStart: appSubscription.createdAt, // Use createdAt as plan start date (currentPeriodStart is not available in GraphQL schema)
      createdAt: appSubscription.createdAt,
      name: appSubscription.name || null,
      trialDays: trialDays,
      trialDaysRemaining,
      isInTrial,
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
        id
        activeSubscriptions {
          id
          name
          status
          currentPeriodEnd
          createdAt
          trialDays
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

  const currentAppInstallation = response.body?.data?.currentAppInstallation;
  const subscriptions = currentAppInstallation?.activeSubscriptions || [];

  logger.info("[BILLING] GraphQL subscription query completed", {
    shop: normalizedShop,
    subscriptionsFound: subscriptions.length,
    statuses: subscriptions.map((sub) => sub.status),
  });

  const activeSubscription =
    subscriptions.find((subscription) => subscription.status === "ACTIVE") ||
    subscriptions[0] ||
    null;

  // CRITICAL: Get trial status from metafields or calculate from subscription data
  // This ALWAYS uses our custom 30-day trial logic - no fallbacks
  let customTrialStatus = null;
  if (currentAppInstallation?.id && activeSubscription) {
    try {
      // Extract AppInstallation ID from GraphQL response
      const appInstallationId = currentAppInstallation.id;
      
      // Pass subscription data so getTrialStatus can calculate if metafields don't exist yet
      customTrialStatus = await trialManager.getTrialStatus(
        client,
        appInstallationId,
        {
          createdAt: activeSubscription.createdAt,
          trialDays: activeSubscription.trialDays,
        }
      );
      
      logger.info("[BILLING] Fetched custom trial status", {
        shop: normalizedShop,
        isTrial: customTrialStatus.isTrial,
        daysRemaining: customTrialStatus.daysRemaining,
        trialCreditsRemaining: customTrialStatus.trialCreditsRemaining,
        note: customTrialStatus.note || "Using custom trial logic from metafields (30 days OR 100 credits)",
      });
    } catch (trialStatusError) {
      logger.error("[BILLING] Failed to fetch custom trial status", trialStatusError, null, {
        shop: normalizedShop,
        error: trialStatusError.message,
      });
      // Throw error - no fallbacks allowed
      throw new Error(`Failed to get trial status: ${trialStatusError.message}`);
    }
  }

  const subscriptionStatus = mapSubscriptionToPlan(activeSubscription, customTrialStatus);

  // Sync metafield to control app block/banner visibility
  // Blocks available if: subscription active (ACTIVE/PENDING/TRIAL) OR total credits > 0
  // This happens asynchronously to not block the response
  // CRITICAL: Ensure metafield exists first (creates it if missing), then update with current value
  (async () => {
    try {
      const appInstallationId =
        await subscriptionMetafield.getAppInstallationId(client);
      
      // Get current subscription status
      const subscriptionStatusValue = subscriptionStatus.subscription?.status || null;
      
      // First, ensure the metafield exists (creates it if missing)
      // This is critical - if the metafield doesn't exist, app blocks won't be visible
      await subscriptionMetafield.ensureSubscriptionMetafieldExists(
        client,
        appInstallationId,
        subscriptionStatusValue
      );
      
      // Then, check if blocks should be available and update the metafield
      // This ensures the metafield always reflects the current state
      const blocksShouldBeAvailable = await subscriptionMetafield.shouldBlocksBeAvailable(
        client,
        appInstallationId,
        subscriptionStatusValue
      );
      
      await subscriptionMetafield.updateSubscriptionMetafield(
        client,
        appInstallationId,
        blocksShouldBeAvailable
      );
      
      logger.info("[BILLING] Subscription metafield synced successfully", {
        shop: normalizedShop,
        subscriptionStatus: subscriptionStatusValue,
        blocksShouldBeAvailable,
      });
    } catch (metafieldError) {
      // Log error but don't fail the request
      logger.error(
        "[BILLING] Failed to sync subscription metafield",
        metafieldError,
        null,
        {
          shop: normalizedShop,
          errorMessage: metafieldError.message,
          stack: metafieldError.stack,
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
      // Build discount config - only include durationLimitInIntervals if it's a valid number > 0
      // For indefinite discounts (null), omit the field entirely per Shopify API requirements
      discountConfig = {
        value:
          validatedPromo.type === "percentage"
            ? { percentage: validatedPromo.value }
            : { amount: validatedPromo.value },
      };

      // Only add durationLimitInIntervals if it's a valid number > 0
      // Shopify API: "Must be greater than 0. The discount will be applied to an indefinite number of billing intervals if this value is left blank."
      if (
        validatedPromo.durationLimitInIntervals != null &&
        typeof validatedPromo.durationLimitInIntervals === "number" &&
        validatedPromo.durationLimitInIntervals > 0
      ) {
        discountConfig.durationLimitInIntervals =
          validatedPromo.durationLimitInIntervals;
      }
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
            currentPeriodEnd
            lineItems {
              id
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
                  ... on AppUsagePricing {
                    terms
                    cappedAmount {
                      amount
                      currencyCode
                    }
                    interval
                  }
                }
              }
            }
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

    // Build line items array
    // Note: Shopify doesn't allow usage-based pricing with annual subscriptions
    // For annual plans, we'll create a separate usage subscription after the recurring one
    const lineItems = [
      {
        plan: {
          appRecurringPricingDetails: lineItemPlan,
        },
      },
    ];

    // Only add usage pricing for monthly plans (EVERY_30_DAYS)
    // Annual plans cannot have usage pricing in the same subscription
    if (planConfig.interval === "EVERY_30_DAYS") {
      const usagePricing = {
        terms: billing.USAGE_PRICING.terms,
        cappedAmount: {
          amount: billing.USAGE_PRICING.cappedAmount,
          currencyCode: billing.USAGE_PRICING.currencyCode,
        },
      };

      lineItems.push({
        plan: {
          appUsagePricingDetails: usagePricing,
        },
      });

      logger.info("[BILLING] Adding usage pricing for monthly plan", {
        shop: normalizedShop,
        planHandle,
        interval: planConfig.interval,
      });
    } else {
      logger.info("[BILLING] Skipping usage pricing for annual plan", {
        shop: normalizedShop,
        planHandle,
        interval: planConfig.interval,
        note: "Annual subscriptions don't support usage billing. Overage must be handled through alternative billing methods (one-time charges, manual billing, etc.)",
      });
    }

    const variables = {
      name: planConfig.name,
      returnUrl,
      lineItems,
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

    // Initialize credits after subscription creation
    // Note: This will be done after merchant approves the subscription
    // We'll initialize credits in the webhook handler when subscription becomes ACTIVE

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

/**
 * Create a separate usage-based subscription for annual plans
 * This is needed because Shopify doesn't allow usage pricing in annual subscriptions
 * @param {Object} client - GraphQL client with authenticated session
 * @param {string} shopDomain - Shop domain
 * @param {string} returnUrl - Return URL after subscription approval
 * @returns {Promise<Object>} Subscription creation result
 */
const createUsageSubscription = async (client, shopDomain, returnUrl) => {
  try {
    const usagePricing = {
      terms: billing.USAGE_PRICING.terms,
      cappedAmount: {
        amount: billing.USAGE_PRICING.cappedAmount,
        currencyCode: billing.USAGE_PRICING.currencyCode,
      },
    };

    const mutation = `
      mutation AppSubscriptionCreate(
        $name: String!
        $returnUrl: URL!
        $lineItems: [AppSubscriptionLineItemInput!]!
        $test: Boolean
      ) {
        appSubscriptionCreate(
          name: $name
          returnUrl: $returnUrl
          lineItems: $lineItems
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
            lineItems {
              id
              plan {
                pricingDetails {
                  __typename
                  ... on AppUsagePricing {
                    terms
                    cappedAmount {
                      amount
                      currencyCode
                    }
                    interval
                  }
                }
              }
            }
          }
        }
      }
    `;

    const variables = {
      name: "Usage-based Overage Billing",
      returnUrl,
      lineItems: [
        {
          plan: {
            appUsagePricingDetails: usagePricing,
          },
        },
      ],
      test: isDemoStore(shopDomain),
    };

    const response = await client.query({
      data: {
        query: mutation,
        variables,
      },
    });

    const payload = response?.body?.data?.appSubscriptionCreate;

    if (!payload) {
      throw new Error("Unexpected response from appSubscriptionCreate");
    }

    const userErrors = payload.userErrors || [];
    if (userErrors.length > 0) {
      logger.error(
        "[BILLING] Failed to create usage subscription",
        null,
        null,
        {
          shop: shopDomain,
          userErrors,
        }
      );
      throw new Error(
        `Failed to create usage subscription: ${userErrors
          .map((e) => e.message)
          .join(", ")}`
      );
    }

    logger.info("[BILLING] Usage subscription created successfully", {
      shop: shopDomain,
      subscriptionId: payload.appSubscription?.id,
      confirmationUrl: payload.confirmationUrl,
    });

    return {
      confirmationUrl: payload.confirmationUrl,
      appSubscription: payload.appSubscription,
    };
  } catch (error) {
    logger.error("[BILLING] Failed to create usage subscription", error, null, {
      shop: shopDomain,
    });
    throw error;
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
    // Skip verification for webhooks, app proxy, billing return, and public routes
    // /api/billing/return is a public endpoint called by Shopify after payment approval
    // It doesn't have a JWT session token because it's a redirect from Shopify, not from the embedded app
    if (
      req.path.startsWith("/webhooks/") ||
      req.path.startsWith("/apps/apps/a/") ||
      req.path.startsWith("/auth") ||
      req.path === "/" ||
      req.path.startsWith("/widget") ||
      req.path.startsWith("/demo") ||
      req.path === "/api/billing/return" ||
      req.path.startsWith("/payment-success")
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
        // Extract shop from dest field (decoded session token has dest, not shop)
        if (session.dest) {
          try {
            const dest = new URL(session.dest);
            req.shop = dest.hostname;
          } catch (error) {
            // Invalid dest URL format
          }
        }
        logger.info("[AUTH] Session token verified", {
          shop: req.shop,
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
// Debug endpoint to check subscription metafield status
app.get("/api/debug/metafield", async (req, res) => {
  try {
    const shop = req.query.shop;
    if (!shop) {
      return res.status(400).json({ error: "Shop parameter required" });
    }

    const normalizedShop = shopify.utils.sanitizeShop(shop);
    if (!normalizedShop) {
      return res.status(400).json({ error: "Invalid shop domain" });
    }

    const session = await shopify.config.sessionStorage.findSessionsByShop(
      normalizedShop
    );

    if (!session || session.length === 0) {
      return res.status(404).json({ error: "No session found for shop" });
    }

    const offlineSession = session.find((s) => !s.isOnline);
    if (!offlineSession) {
      return res.status(404).json({ error: "No offline session found" });
    }

    const client = new shopify.clients.Graphql({
      session: offlineSession,
    });

    const appInstallationId =
      await subscriptionMetafield.getAppInstallationId(client);

    // Query the metafield directly
    const query = `
      query GetSubscriptionMetafield($ownerId: ID!, $namespace: String!, $key: String!) {
        appInstallation(id: $ownerId) {
          id
          metafield(namespace: $namespace, key: $key) {
            id
            namespace
            key
            value
            type
          }
          metafields(first: 10, namespace: $namespace) {
            edges {
              node {
                id
                namespace
                key
                value
                type
              }
            }
          }
        }
      }
    `;

    const variables = {
      ownerId: appInstallationId,
      namespace: "subscription",
      key: "active",
    };

    const response = await client.request(query, { variables });
    const metafield = response.data?.appInstallation?.metafield;
    const allMetafields = response.data?.appInstallation?.metafields?.edges?.map(
      (e) => e.node
    );

    // Also check subscription status
    const subscriptionQuery = `
      query GetAppSubscription {
        currentAppInstallation {
          activeSubscriptions {
            id
            status
            name
          }
        }
      }
    `;

    const subscriptionResponse = await client.request(subscriptionQuery);
    const activeSubscriptions =
      subscriptionResponse.data?.currentAppInstallation?.activeSubscriptions ||
      [];

    // Check credits
    let creditInfo = null;
    try {
      const creditData = await creditManager.getTotalCreditsAvailable(
        client,
        appInstallationId
      );
      creditInfo = {
        balance: creditData?.balance || 0,
        breakdown: creditData || {},
      };
    } catch (creditError) {
      creditInfo = { error: creditError.message };
    }

    // Check what shouldBlocksBeAvailable would return
    let shouldBeAvailable = null;
    let blocksAvailabilityReason = null;
    try {
      const subscriptionStatus =
        activeSubscriptions.length > 0
          ? activeSubscriptions[0].status
          : null;
      shouldBeAvailable = await subscriptionMetafield.shouldBlocksBeAvailable(
        client,
        appInstallationId,
        subscriptionStatus
      );

      // Determine reason
      const hasActiveSubscription =
        subscriptionStatus === "ACTIVE" ||
        subscriptionStatus === "PENDING" ||
        subscriptionStatus === "TRIAL";
      const hasCredits = creditInfo?.balance > 0;

      if (hasActiveSubscription) {
        blocksAvailabilityReason = `Subscription is active (status: ${subscriptionStatus})`;
      } else if (hasCredits) {
        blocksAvailabilityReason = `Credits available (balance: ${creditInfo.balance})`;
      } else {
        blocksAvailabilityReason =
          "No active subscription and no credits available";
      }
    } catch (availabilityError) {
      shouldBeAvailable = null;
      blocksAvailabilityReason = `Error checking: ${availabilityError.message}`;
    }

    // Determine if there's a mismatch
    const metafieldValue = metafield?.value;
    const metafieldBoolValue = metafieldValue === "true";
    const hasMismatch =
      shouldBeAvailable !== null && metafieldBoolValue !== shouldBeAvailable;

    res.json({
      shop: normalizedShop,
      appInstallationId,
      metafield: metafield || null,
      allMetafieldsInNamespace: allMetafields || [],
      activeSubscriptions,
      creditInfo,
      liquidAccessPath: "app.metafields.subscription.active.value",
      currentMetafieldValue: metafieldValue || "not set",
      currentMetafieldBoolValue: metafield ? metafieldBoolValue : null,
      shouldBlocksBeAvailable,
      blocksAvailabilityReason,
      hasMismatch,
      recommendation:
        hasMismatch && shouldBeAvailable !== null
          ? `⚠️ MISMATCH DETECTED: Metafield value is "${metafieldValue}" but should be "${
              shouldBeAvailable ? "true" : "false"
            }". Run GET /api/billing/subscription?shop=${normalizedShop} to sync.`
          : !metafield
          ? "⚠️ Metafield doesn't exist. Run GET /api/billing/subscription to create it."
          : metafieldBoolValue === shouldBeAvailable
          ? "✅ Metafield is correctly set"
          : "✅ Status OK",
      note:
        "Blocks are available if: subscription is ACTIVE/PENDING/TRIAL OR total credits > 0. Access in Liquid: {{ app.metafields.subscription.active.value }}",
    });
  } catch (error) {
    logger.error("[DEBUG] Error checking metafield", error, req, {
      errorMessage: error.message,
      stack: error.stack,
    });
    res.status(500).json({
      error: "Failed to check metafield",
      message: error.message,
      stack: error.stack,
    });
  }
});

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

    // CRITICAL: Initialize subscription metafield immediately after app installation
    // This ensures app blocks are visible in theme editor (even if initially false)
    // The metafield will be updated to true when subscription is active or credits exist
    (async () => {
      try {
        const client = new shopify.clients.Graphql({
          session: callbackResponse.session,
        });

        const appInstallationId =
          await subscriptionMetafield.getAppInstallationId(client);

        // Initialize metafield with false (blocks not available yet)
        // It will be updated to true when subscription is active or credits > 0
        await subscriptionMetafield.updateSubscriptionMetafield(
          client,
          appInstallationId,
          false // Start with false, will update on first subscription check
        );

        logger.info("[OAUTH] Subscription metafield initialized after app installation", {
          shop,
          appInstallationId,
          initialValue: false,
        });
      } catch (metafieldError) {
        // Log error but don't fail OAuth - metafield will be created on first subscription check
        logger.error(
          "[OAUTH] Failed to initialize subscription metafield after installation",
          metafieldError,
          null,
          {
            shop,
            errorMessage: metafieldError.message,
            note: "Metafield will be created on first GET /api/billing/subscription request",
          }
        );
      }
    })();

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

        // Process and store subscription data for immediate availability
        try {
          const { processWebhookSubscription, setSubscription } = await import(
            "./utils/subscriptionStorage.js"
          );
          const processedData = processWebhookSubscription(
            app_subscription,
            shop
          );

          if (processedData) {
            setSubscription(shop, processedData);
            logger.info("[WEBHOOK] Subscription data stored successfully", {
              shop,
              status: processedData.subscription?.status,
              hasActiveSubscription: processedData.hasActiveSubscription,
            });

            // Handle credit reset on billing cycle renewal
            // CRITICAL: Only process ACTIVE subscriptions to ensure credits are initialized
            // Also initialize client and appInstallationId for metafield updates
            let webhookClient = null;
            let webhookAppInstallationId = null;
            
            if (app_subscription.status === "ACTIVE") {
              try {
                // Get offline access token for the shop
                // Note: In production, you'd get this from your session storage
                // For now, we'll use the webhook shop domain
                let client = null;
                let appInstallationId = null;
                
                try {
                  const tokenResult = await shopify.auth.tokenExchange({
                    shop,
                    sessionToken: null, // Webhooks don't have session tokens
                    requestedTokenType: RequestedTokenType.OfflineAccessToken,
                  });

                  const session = tokenResult?.session;
                  const accessToken =
                    session?.accessToken || session?.access_token;

                  if (!session || !accessToken) {
                    throw new Error("Failed to get access token from token exchange");
                  }
                  
                  client = new shopify.clients.Graphql({
                    session: {
                      shop: session.shop || shop,
                      accessToken,
                      scope: session.scope,
                      isOnline: session.isOnline || false,
                    },
                  });
                  
                  // CRITICAL: Get app installation ID immediately to validate access
                  // Use the utility function for consistency
                  appInstallationId = await subscriptionMetafield.getAppInstallationId(client);
                } catch (authError) {
                  logger.error(
                    "[WEBHOOK] CRITICAL: Failed to authenticate for credit initialization",
                    authError,
                    null,
                    {
                      shop,
                      subscriptionId: app_subscription.id,
                      status: app_subscription.status,
                      note: "Credit initialization will be retried via fallback API",
                    }
                  );
                  // Don't throw - let fallback API handle initialization
                  // But log as critical error for monitoring
                  throw authError; // Re-throw to skip credit processing
                }

                if (client && appInstallationId) {

                  // Check if this is an annual subscription
                  // Note: Shopify doesn't allow usage billing with annual subscriptions
                  // and only allows one active subscription per merchant
                  // For annual plans, overage billing must be handled through alternative means
                  // (e.g., one-time charges, manual billing, or tracking for next billing cycle)
                  const recurringLineItem = app_subscription.lineItems?.find(
                    (item) =>
                      item.plan?.pricingDetails?.__typename ===
                      "AppRecurringPricing"
                  );
                  const usageLineItem = app_subscription.lineItems?.find(
                    (item) =>
                      item.plan?.pricingDetails?.__typename ===
                      "AppUsagePricing"
                  );
                  const isAnnual =
                    recurringLineItem?.plan?.pricingDetails?.interval ===
                    "ANNUAL";

                  if (isAnnual && !usageLineItem) {
                    logger.info(
                      "[WEBHOOK] Annual subscription detected without usage pricing",
                      {
                        shop,
                        recurringSubscriptionId: app_subscription.id,
                        note: "Overage billing for annual plans must be handled through alternative billing methods (one-time charges, manual billing, etc.)",
                      }
                    );
                  }

                  // appInstallationId already retrieved above during authentication (line ~1971)
                  // No need to query again - use the one we already have

                  if (appInstallationId) {
                    // Check if period has renewed
                    // For annual subscriptions, use monthly period checking
                    const periodCheck = await creditReset.checkPeriodRenewal(
                      client,
                      appInstallationId,
                      app_subscription.currentPeriodEnd,
                      isAnnual
                    );

                    if (periodCheck.isNewPeriod) {
                      // For annual subscriptions, bill accumulated overage before resetting credits
                      if (isAnnual) {
                        try {
                          const { billAccumulatedOverage } = await import(
                            "./utils/annualOverageBilling.js"
                          );
                          const isDemo = isDemoStore(shop);
                          const overageResult = await billAccumulatedOverage(
                            client,
                            shop,
                            appInstallationId,
                            isDemo
                          );

                          if (overageResult.billed) {
                            logger.info(
                              "[WEBHOOK] Overage billed for annual subscription",
                              {
                                shop,
                                amount: overageResult.amount,
                                overageCount: overageResult.overageCount,
                                purchaseId: overageResult.purchaseId,
                                note: "Merchant will need to approve the one-time charge",
                              }
                            );
                          }
                        } catch (overageError) {
                          // Log error but don't fail credit reset
                          logger.error(
                            "[WEBHOOK] Failed to bill overage for annual subscription",
                            overageError,
                            null,
                            {
                              shop,
                              appInstallationId,
                            }
                          );
                        }
                      }

                      // Add credits for new period (credits never expire, they carry forward)
                      const plan = processedData.plan;
                      const includedCredits =
                        plan?.limits?.includedCredits || 100;

                      const addResult = await creditReset.resetCreditsForNewPeriod(
                        client,
                        appInstallationId,
                        app_subscription.currentPeriodEnd,
                        includedCredits,
                        isAnnual
                      );

                      logger.info(
                        "[WEBHOOK] Credits added for new billing period (carry forward)",
                        {
                          shop,
                          periodEnd: periodCheck.newPeriodEnd,
                          creditsAdded: includedCredits,
                          previousBalance: addResult.previousBalance,
                          newBalance: addResult.balance,
                          isAnnual,
                          note: isAnnual
                            ? "Monthly credits added for annual subscription (100 credits per month, carry forward)"
                            : "Billing cycle credits added (carry forward)",
                        }
                      );
                    }

                    // Check if this is a transition from trial to paid subscription
                    const metafields =
                      await creditMetafield.getCreditMetafields(
                        client,
                        appInstallationId
                      );
                    
                    // Check if subscription was in trial and is now becoming ACTIVE (paid)
                    const wasInTrial = metafields.is_trial_period === true || metafields.is_trial_period === "true";
                    const isNowActive = app_subscription.status === "ACTIVE";
                    const hasNoTrialDays = !app_subscription.trialDays || app_subscription.trialDays === 0;
                    
                    // Track if we just ended the trial period to prevent double initialization
                    let trialJustEnded = false;
                    
                    if (wasInTrial && isNowActive && hasNoTrialDays) {
                      // This is a transition from trial to paid - end trial and add plan credits
                      logger.info("[WEBHOOK] Transitioning from trial to paid subscription", {
                        shop,
                        subscriptionId: app_subscription.id,
                        note: "Ending trial period and adding plan credits",
                      });
                      
                      const plan = processedData.plan;
                      const includedCredits = plan?.limits?.includedCredits || 100;
                      
                      // End trial period and add plan credits (credits carry forward)
                      const trialEndResult = await trialManager.endTrialPeriod(
                        client,
                        appInstallationId,
                        includedCredits
                      );
                      
                      logger.info("[WEBHOOK] Trial ended, plan credits added (carry forward)", {
                        shop,
                        planCreditsAdded: includedCredits,
                        previousBalance: trialEndResult.previousBalance,
                        newBalance: trialEndResult.newBalance,
                        note: "Plan credits added to existing balance (credits never expire)",
                      });
                      
                      // Mark that trial just ended - credits already added by endTrialPeriod()
                      trialJustEnded = true;
                      
                      // CRITICAL: Refresh metafields after endTrialPeriod() to get updated values
                      // This ensures the initialization check below uses fresh data
                      // According to Shopify docs, metafieldsSet is atomic, so we need to fetch fresh values
                      const refreshedMetafields = await creditMetafield.getCreditMetafields(
                        client,
                        appInstallationId
                      );
                      // Update the metafields variable to use refreshed values for subsequent checks
                      Object.assign(metafields, refreshedMetafields);
                    }
                    
                    // Initialize credits if this is a new subscription
                    // Check if credit_balance metafield exists (null/undefined means not initialized)
                    // Note: credit_balance can be 0 (used up), so we check for null/undefined specifically
                    // CRITICAL: Skip initialization if we just ended the trial period (credits already added by endTrialPeriod)
                    // The refreshed metafields will have the updated credit_balance, so this check will correctly evaluate
                    const hasTrialMetafields = metafields.trial_start_date != null;
                    const needsInitialization = !trialJustEnded && (metafields.credit_balance == null || (hasTrialMetafields && wasInTrial && isNowActive));
                    
                    if (needsInitialization) {
                      // New subscription or transitioning from trial - initialize credits
                      // CRITICAL: Ensure all required data is validated before initialization
                      const plan = processedData.plan;
                      
                      // Validate plan handle - use fallback if mapping failed
                      let planHandle = plan?.handle;
                      if (!planHandle) {
                        // Fallback: Try to determine plan handle from subscription data
                        const recurringLineItem = app_subscription.lineItems?.find(
                          (item) =>
                            item.plan?.pricingDetails?.__typename === "AppRecurringPricing"
                        );
                        const recurringInterval = recurringLineItem?.plan?.pricingDetails?.interval;
                        
                        if (recurringInterval === "ANNUAL") {
                          planHandle = "pro-annual";
                        } else if (recurringInterval === "EVERY_30_DAYS") {
                          planHandle = "pro-monthly";
                        } else {
                          // Default to monthly if cannot determine
                          planHandle = "pro-monthly";
                          logger.warn("[WEBHOOK] Could not determine plan handle, defaulting to pro-monthly", {
                            shop,
                            subscriptionId: app_subscription.id,
                            lineItems: app_subscription.lineItems,
                          });
                        }
                      }
                      
                      // Validate included credits - always default to 100 if not found
                      const includedCredits = plan?.limits?.includedCredits || 100;
                      
                      // Validate period end - calculate fallback if null
                      let periodEnd = app_subscription.currentPeriodEnd;
                      if (!periodEnd) {
                        // Calculate period end: 30 days from now for monthly, 1 year for annual
                        const fallbackPeriodEnd = new Date();
                        if (isAnnual) {
                          fallbackPeriodEnd.setFullYear(fallbackPeriodEnd.getFullYear() + 1);
                        } else {
                          fallbackPeriodEnd.setDate(fallbackPeriodEnd.getDate() + 30);
                        }
                        periodEnd = fallbackPeriodEnd.toISOString();
                        logger.warn("[WEBHOOK] Subscription currentPeriodEnd is null, using calculated fallback", {
                          shop,
                          subscriptionId: app_subscription.id,
                          calculatedPeriodEnd: periodEnd,
                          isAnnual,
                        });
                      }

                      logger.info(
                        "[WEBHOOK] Initializing credits for new subscription",
                        {
                          shop,
                          appInstallationId,
                          planHandle,
                          includedCredits,
                          isAnnual,
                          currentCreditBalance: metafields.credit_balance,
                          periodEnd,
                          note: "credit_balance metafield is null/undefined - initializing",
                        }
                      );

                      // Find usage pricing line item
                      const usageLineItem = app_subscription.lineItems?.find(
                        (item) =>
                          item.plan?.pricingDetails?.__typename === "AppUsagePricing"
                      );

                      // CRITICAL: Determine if subscription is in trial period using getTrialStatus
                      // This ensures consistent trial calculation logic (no fallbacks)
                      // For new subscriptions, calculate from subscription data if metafields don't exist yet
                      let isTrialActive = false;
                      if (!wasInTrial && app_subscription.trialDays && app_subscription.trialDays > 0) {
                        try {
                          // Use getTrialStatus to calculate trial status consistently
                          // Pass subscription data so it can calculate if metafields don't exist yet
                          const trialStatus = await trialManager.getTrialStatus(
                            client,
                            appInstallationId,
                            {
                              createdAt: app_subscription.createdAt,
                              trialDays: app_subscription.trialDays,
                            }
                          );
                          isTrialActive = trialStatus.isTrial;
                          
                          logger.info("[WEBHOOK] Calculated trial status for credit initialization", {
                            shop,
                            subscriptionId: app_subscription.id,
                            isTrialActive,
                            daysRemaining: trialStatus.daysRemaining,
                            note: trialStatus.note || "Using getTrialStatus for consistent calculation",
                          });
                        } catch (trialStatusError) {
                          logger.error("[WEBHOOK] Failed to calculate trial status", trialStatusError, null, {
                            shop,
                            subscriptionId: app_subscription.id,
                            error: trialStatusError.message,
                          });
                          // If we can't determine trial status, default to false (no trial)
                          // This ensures we don't initialize trial credits incorrectly
                          isTrialActive = false;
                        }
                      }
                      // If transitioning from trial (wasInTrial = true), isTrialActive should be false (already ended above)

                      // CRITICAL: Retry logic for credit initialization with exponential backoff
                      let initializationSuccess = false;
                      let lastError = null;
                      const maxRetries = 3;
                      
                      for (let attempt = 1; attempt <= maxRetries; attempt++) {
                        try {
                          await creditMetafield.initializeCredits(
                            client,
                            appInstallationId,
                            planHandle,
                            includedCredits,
                            periodEnd,
                            usageLineItem?.id || null,
                            isAnnual,
                            isTrialActive
                          );
                          
                          // Verify initialization succeeded by checking metafields
                          const verificationMetafields = await creditMetafield.getCreditMetafields(
                            client,
                            appInstallationId
                          );
                          
                          if (verificationMetafields.credit_balance != null) {
                            initializationSuccess = true;
                            logger.info(
                              "[WEBHOOK] Credits initialized and verified successfully",
                              {
                                shop,
                                appInstallationId,
                                attempt,
                                includedCredits,
                                verifiedBalance: verificationMetafields.credit_balance,
                                periodEnd: isAnnual
                                  ? "Monthly period (30 days from now)"
                                  : periodEnd,
                                isAnnual,
                                note: isAnnual
                                  ? "Annual subscription: 100 credits per month"
                                  : "Monthly subscription: 100 credits per billing cycle",
                              }
                            );
                            break;
                          } else {
                            throw new Error("Credit initialization verification failed - credit_balance is still null");
                          }
                        } catch (initError) {
                          lastError = initError;
                          logger.error(
                            `[WEBHOOK] Credit initialization attempt ${attempt}/${maxRetries} failed`,
                            initError,
                            null,
                            {
                              shop,
                              appInstallationId,
                              planHandle,
                              includedCredits,
                              attempt,
                              maxRetries,
                            }
                          );
                          
                          // Wait before retry (exponential backoff: 1s, 2s, 4s)
                          if (attempt < maxRetries) {
                            const waitTime = Math.pow(2, attempt - 1) * 1000;
                            logger.info(`[WEBHOOK] Retrying credit initialization in ${waitTime}ms`, {
                              shop,
                              appInstallationId,
                              attempt,
                              nextAttempt: attempt + 1,
                            });
                            await new Promise(resolve => setTimeout(resolve, waitTime));
                          }
                        }
                      }
                      
                      if (!initializationSuccess) {
                        // Log critical error but don't fail webhook (fallback API will handle it)
                        logger.error(
                          "[WEBHOOK] CRITICAL: Credit initialization failed after all retries",
                          lastError,
                          null,
                          {
                            shop,
                            appInstallationId,
                            planHandle,
                            includedCredits,
                            maxRetries,
                            note: "Fallback API (/api/credits/balance) will attempt initialization on next request",
                          }
                        );
                        // Don't throw - let fallback API handle it
                      }
                    } else {
                      logger.info(
                        "[WEBHOOK] Credits already initialized, skipping initialization",
                        {
                          shop,
                          appInstallationId,
                          currentCreditBalance: metafields.credit_balance,
                          creditsIncluded: metafields.credits_included,
                          note: "credit_balance metafield exists - subscription already has credits",
                        }
                      );
                      // Existing subscription - sync data
                      // For annual subscriptions, check monthly period renewal
                      if (isAnnual) {
                        const monthlyCheck =
                          await creditReset.checkMonthlyPeriodRenewal(
                            client,
                            appInstallationId
                          );
                        if (monthlyCheck.isNewPeriod) {
                          // Bill accumulated overage before resetting credits
                          try {
                            const { billAccumulatedOverage } = await import(
                              "./utils/annualOverageBilling.js"
                            );
                            const isDemo = isDemoStore(shop);
                            const overageResult = await billAccumulatedOverage(
                              client,
                              shop,
                              appInstallationId,
                              isDemo
                            );

                            if (overageResult.billed) {
                              logger.info(
                                "[WEBHOOK] Overage billed for annual subscription",
                                {
                                  shop,
                                  amount: overageResult.amount,
                                  overageCount: overageResult.overageCount,
                                  purchaseId: overageResult.purchaseId,
                                  note: "Merchant will need to approve the one-time charge",
                                }
                              );
                            }
                          } catch (overageError) {
                            // Log error but don't fail credit reset
                            logger.error(
                              "[WEBHOOK] Failed to bill overage for annual subscription",
                              overageError,
                              null,
                              {
                                shop,
                                appInstallationId,
                              }
                            );
                          }

                          const plan = processedData.plan;
                          const includedCredits =
                            plan?.limits?.includedCredits || 100;
                          const addResult = await creditReset.resetCreditsForNewPeriod(
                            client,
                            appInstallationId,
                            monthlyCheck.newPeriodEnd,
                            includedCredits,
                            true
                          );
                          logger.info(
                            "[WEBHOOK] Monthly credits added for annual subscription (carry forward)",
                            {
                              shop,
                              creditsAdded: includedCredits,
                              previousBalance: addResult.previousBalance,
                              newBalance: addResult.balance,
                              periodEnd: monthlyCheck.newPeriodEnd,
                            }
                          );
                        }
                      } else {
                        // Monthly subscription - sync with billing period
                        await creditReset.syncWithSubscription(
                          client,
                          appInstallationId,
                          {
                            id: app_subscription.id,
                            currentPeriodEnd: app_subscription.currentPeriodEnd,
                            lineItems: app_subscription.lineItems,
                          },
                          false
                        ); // Explicitly pass isAnnual = false
                      }

                      // Store subscription line item ID for usage pricing if available
                      if (app_subscription.lineItems) {
                        const usageLineItem = app_subscription.lineItems.find(
                          (item) =>
                            item.plan?.pricingDetails?.__typename ===
                            "AppUsagePricing"
                        );

                        if (usageLineItem?.id) {
                          if (!metafields.subscription_line_item_id) {
                            await creditMetafield.batchUpdateMetafields(
                              client,
                              appInstallationId,
                              {
                                subscription_line_item_id: usageLineItem.id,
                              }
                            );
                          }
                        }
                      }
                    }
                  }
                  
                  // Store client and appInstallationId for metafield update below
                  webhookClient = client;
                  webhookAppInstallationId = appInstallationId;
                }
              } catch (creditError) {
                logger.error(
                  "[WEBHOOK] Failed to handle credit reset",
                  creditError,
                  null,
                  {
                    shop,
                    subscriptionId: app_subscription?.id,
                  }
                );
                // Don't fail webhook - log error and continue
                // Try to get client for metafield update even if credit processing failed
                try {
                  const tokenResult = await shopify.auth.tokenExchange({
                    shop,
                    sessionToken: null,
                    requestedTokenType: RequestedTokenType.OfflineAccessToken,
                  });
                  const session = tokenResult?.session;
                  const accessToken = session?.accessToken || session?.access_token;
                  if (session && accessToken) {
                    webhookClient = new shopify.clients.Graphql({
                      session: {
                        shop: session.shop || shop,
                        accessToken,
                        scope: session.scope,
                        isOnline: session.isOnline || false,
                      },
                    });
                    webhookAppInstallationId = await subscriptionMetafield.getAppInstallationId(webhookClient);
                  }
                } catch (authError) {
                  // Log but continue - metafield update will be skipped
                  logger.error("[WEBHOOK] Failed to get client for metafield update", authError, null, {
                    shop,
                    subscriptionId: app_subscription?.id,
                  });
                }
              }
            }
          } else {
            logger.warn("[WEBHOOK] Failed to process subscription data", {
              shop,
              subscriptionId: app_subscription?.id,
            });
          }
        } catch (storageError) {
          // Log error but don't fail webhook - Shopify will retry if we return error
          logger.error(
            "[WEBHOOK] Failed to store subscription data",
            storageError,
            null,
            {
              shop,
              subscriptionId: app_subscription?.id,
              errorMessage: storageError.message,
            }
          );
        }
      } else {
        logger.warn(
          "[WEBHOOK] app/subscriptions/update - payload missing subscription data",
          {
            shop,
            webhookDataKeys: Object.keys(req.webhookData || {}),
          }
        );
      }

      // CRITICAL: Update subscription metafield to control app block/banner visibility
      // This must happen after subscription processing to ensure blocks appear in theme editor
      // Reuse client from credit processing if available, otherwise create new one
      if (app_subscription) {
        try {
          let client = webhookClient;
          let appInstallationId = webhookAppInstallationId;
          
          // If client wasn't created during ACTIVE subscription processing, create it now
          if (!client || !appInstallationId) {
            try {
              const tokenResult = await shopify.auth.tokenExchange({
                shop,
                sessionToken: null,
                requestedTokenType: RequestedTokenType.OfflineAccessToken,
              });

              const session = tokenResult?.session;
              const accessToken =
                session?.accessToken || session?.access_token;

              if (session && accessToken) {
                client = new shopify.clients.Graphql({
                  session: {
                    shop: session.shop || shop,
                    accessToken,
                    scope: session.scope,
                    isOnline: session.isOnline || false,
                  },
                });
                
                appInstallationId = await subscriptionMetafield.getAppInstallationId(client);
              }
            } catch (authError) {
              logger.error(
                "[WEBHOOK] Failed to authenticate for metafield update",
                authError,
                null,
                {
                  shop,
                  subscriptionId: app_subscription?.id,
                  errorMessage: authError.message,
                }
              );
            }
          }
          
          // CRITICAL: Update metafield to control app block/banner visibility
          // Blocks available if: subscription active (ACTIVE/PENDING/TRIAL) OR total credits > 0
          // This must happen for ALL subscription statuses to ensure blocks appear/disappear correctly
          try {
            // Use existing client if available, otherwise create new one
            let metafieldClient = client || webhookClient;
            let metafieldAppInstallationId = appInstallationId || webhookAppInstallationId;
            
            // If we don't have a client or appInstallationId, try to get them
            if (!metafieldClient || !metafieldAppInstallationId) {
              try {
                const tokenResult = await shopify.auth.tokenExchange({
                  shop,
                  sessionToken: null,
                  requestedTokenType: RequestedTokenType.OfflineAccessToken,
                });

                const session = tokenResult?.session;
                const accessToken =
                  session?.accessToken || session?.access_token;

                if (session && accessToken) {
                  metafieldClient = new shopify.clients.Graphql({
                    session: {
                      shop: session.shop || shop,
                      accessToken,
                      scope: session.scope,
                      isOnline: session.isOnline || false,
                    },
                  });

                  if (!metafieldAppInstallationId) {
                    metafieldAppInstallationId = await subscriptionMetafield.getAppInstallationId(
                      metafieldClient
                    );
                  }
                }
              } catch (tokenError) {
                logger.error(
                  "[WEBHOOK] Failed to create client for metafield update",
                  tokenError,
                  null,
                  {
                    shop,
                    subscriptionId: app_subscription?.id,
                    errorMessage: tokenError.message,
                    stack: tokenError.stack,
                  }
                );
              }
            }
            
            // Update metafield if we have client and appInstallationId
            if (metafieldClient && metafieldAppInstallationId) {
              try {
                const subscriptionStatusValue = app_subscription?.status || null;
                
                // CRITICAL: First ensure the metafield exists (creates it if missing)
                // This is essential - if the metafield doesn't exist, app blocks won't be visible
                await subscriptionMetafield.ensureSubscriptionMetafieldExists(
                  metafieldClient,
                  metafieldAppInstallationId,
                  subscriptionStatusValue
                );
                
                // Then check if blocks should be available and update the metafield
                const blocksShouldBeAvailable = await subscriptionMetafield.shouldBlocksBeAvailable(
                  metafieldClient,
                  metafieldAppInstallationId,
                  subscriptionStatusValue
                );
                
                await subscriptionMetafield.updateSubscriptionMetafield(
                  metafieldClient,
                  metafieldAppInstallationId,
                  blocksShouldBeAvailable
                );
                
                logger.info("[WEBHOOK] Subscription metafield updated successfully", {
                  shop,
                  subscriptionId: app_subscription?.id,
                  status: app_subscription?.status,
                  blocksAvailable: blocksShouldBeAvailable,
                  reusedClient: !!client || !!webhookClient,
                });
              } catch (metafieldError) {
                // Log error but don't fail webhook - metafield will be updated on next GET request
                logger.error(
                  "[WEBHOOK] Failed to update subscription metafield",
                  metafieldError,
                  null,
                  {
                    shop,
                    subscriptionId: app_subscription?.id,
                    status: app_subscription?.status,
                    errorMessage: metafieldError.message,
                    stack: metafieldError.stack,
                  }
                );
              }
            } else {
              logger.warn("[WEBHOOK] Cannot update subscription metafield - missing client or appInstallationId after retry", {
                shop,
                subscriptionId: app_subscription?.id,
                hasClient: !!metafieldClient,
                hasAppInstallationId: !!metafieldAppInstallationId,
                status: app_subscription?.status,
                note: "Metafield will be updated on next GET /api/billing/subscription request",
              });
            }
          } catch (error) {
            // Catch-all for any unexpected errors in metafield update flow
            logger.error(
              "[WEBHOOK] Unexpected error in metafield update flow",
              error,
              null,
              {
                shop,
                subscriptionId: app_subscription?.id,
                status: app_subscription?.status,
                errorMessage: error.message,
                stack: error.stack,
              }
            );
            // Don't fail webhook - continue processing
          }
        } catch (error) {
          // Log error but don't fail webhook
          logger.error(
            "[WEBHOOK] Error in metafield update process",
            error,
            null,
            {
              shop,
              subscriptionId: app_subscription?.id,
              errorMessage: error.message,
            }
          );
        }
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

// One-time purchase update webhook - for credit purchases
app.post(
  "/webhooks/app/purchases/one_time/update",
  verifyWebhookSignature,
  async (req, res) => {
    try {
      logger.info(
        "[WEBHOOK] app/purchases/one_time/update - raw payload received",
        {
          shop: req.webhookShop,
          topic: req.webhookTopic,
          payloadKeys: Object.keys(req.webhookData || {}),
        }
      );

      let app_purchase_one_time = null;

      if (req.webhookData) {
        if (req.webhookData.app_purchase_one_time) {
          app_purchase_one_time = req.webhookData.app_purchase_one_time;
        } else if (req.webhookData.id && req.webhookData.status) {
          app_purchase_one_time = req.webhookData;
        }
      }

      const shop = req.webhookShop;

      if (!shop) {
        logger.error(
          "[WEBHOOK] app/purchases/one_time/update - missing shop domain"
        );
        return res.status(400).json({
          error: "Missing shop domain",
          received: true,
        });
      }

      logger.info("[WEBHOOK] app/purchases/one_time/update received", {
        shop,
        purchaseId: app_purchase_one_time?.id,
        status: app_purchase_one_time?.status,
      });

      // Handle one-time purchase completion
      if (app_purchase_one_time && app_purchase_one_time.status === "ACTIVE") {
        try {
          const purchaseName = app_purchase_one_time.name || "";

          // Check if this is an overage billing charge
          const isOverageBilling = purchaseName.includes(
            "Monthly Overage Billing"
          );

          if (isOverageBilling) {
            // Overage billing charge was approved - tracking was already reset when charge was created
            logger.info("[WEBHOOK] Overage billing charge approved", {
              shop,
              purchaseId: app_purchase_one_time.id,
              purchaseName,
              note: "Overage tracking was reset when charge was created",
            });
          } else {
            // Handle credit package purchase
            const packageIdMatch = purchaseName.match(/Credit Package - (\w+)/);
            const packageId = packageIdMatch
              ? packageIdMatch[1].toLowerCase()
              : null;

            if (packageId) {
              // Get offline access token
              const tokenResult = await shopify.auth.tokenExchange({
                shop,
                sessionToken: null,
                requestedTokenType: RequestedTokenType.OfflineAccessToken,
              });

              const session = tokenResult?.session;
              const accessToken = session?.accessToken || session?.access_token;

              if (session && accessToken) {
                const client = new shopify.clients.Graphql({
                  session: {
                    shop: session.shop || shop,
                    accessToken,
                    scope: session.scope,
                    isOnline: session.isOnline || false,
                  },
                });

                const appInstallationQuery = `
                query GetAppInstallation {
                  appInstallation {
                    id
                  }
                }
              `;
                const appInstallationResponse = await client.query({
                  data: { query: appInstallationQuery },
                });
                const appInstallationId =
                  appInstallationResponse?.body?.data?.appInstallation?.id;

                if (appInstallationId) {
                  // Add credits to balance
                  await creditPurchase.handlePurchaseSuccess(
                    client,
                    appInstallationId,
                    app_purchase_one_time.id,
                    packageId
                  );

                  logger.info("[WEBHOOK] Credits added after purchase", {
                    shop,
                    purchaseId: app_purchase_one_time.id,
                    packageId,
                  });
                }
              }
            }
          }
        } catch (creditError) {
          logger.error(
            "[WEBHOOK] Failed to handle credit purchase",
            creditError,
            null,
            {
              shop,
              purchaseId: app_purchase_one_time?.id,
            }
          );
          // Don't fail webhook
        }
      } else if (
        app_purchase_one_time &&
        app_purchase_one_time.status === "DECLINED"
      ) {
        // Handle declined charges
        const purchaseName = app_purchase_one_time.name || "";
        const isOverageBilling = purchaseName.includes(
          "Monthly Overage Billing"
        );

        if (isOverageBilling) {
          // If overage charge was declined, we should restore the overage tracking
          // so it can be billed again later
          logger.warn("[WEBHOOK] Overage billing charge declined", {
            shop,
            purchaseId: app_purchase_one_time.id,
            purchaseName,
            note: "Overage tracking was already reset. Manual intervention may be required if merchant wants to pay later.",
          });
          // Note: We don't restore tracking here because it was already reset when the charge was created.
          // If the merchant wants to pay later, they can contact support or we can implement a retry mechanism.
        }
      }

      res.status(200).json({ received: true });
    } catch (error) {
      logger.error(
        "[WEBHOOK ERROR] app/purchases/one_time/update failed",
        error,
        req,
        {
          shop: req.webhookShop,
          errorMessage: error.message,
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
// IMPORTANT: Must redirect to embedded app URL format to ensure proper authentication
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

    // Redirect to payment success page first to show congratulations message
    // The success page will then redirect to the embedded app URL after showing the message
    const appBaseUrl = appUrl || `https://${shopDomain}`;
    const successPageUrl = `${appBaseUrl}/payment-success?shop=${encodeURIComponent(
      shopDomain
    )}`;

    logger.info("[BILLING] [RETURN] Redirecting to payment success page", {
      requestId,
      shop: shopDomain,
      successPageUrl,
    });

    return res.redirect(302, successPageUrl);
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
    // Get shop from query string
    const shop = req.query.shop;
    const { planHandle, promoCode } = req.body || {};

    logger.info("[API] [SUBSCRIBE] Request received", {
      requestId,
      shop,
      planHandle,
    });

    if (!shop) {
      return res.status(400).json({
        error: "Missing shop parameter",
        message: "Shop parameter is required in query string",
        requestId,
      });
    }

    if (!planHandle) {
      return res.status(400).json({
        error: "Missing required parameters",
        message: "planHandle is required in request body.",
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

// Replace trial subscription with paid subscription
app.post("/api/billing/replace-trial", async (req, res) => {
  const requestId = `req-${Date.now()}-${Math.random()
    .toString(36)
    .substr(2, 9)}`;

  try {
    const { shop } = req.body || {};

    logger.info("[API] [REPLACE_TRIAL] Request received", {
      requestId,
      shop,
    });

    if (!shop) {
      return res.status(400).json({
        error: "Missing required parameters",
        message: "Shop parameter is required.",
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

    if (!req.sessionToken) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "Session token required for billing API",
        requestId,
      });
    }

    try {
      // Exchange JWT session token for an offline access token for billing
      const tokenResult = await shopify.auth.tokenExchange({
        shop: shopDomain,
        sessionToken: req.sessionToken,
        requestedTokenType: RequestedTokenType.OfflineAccessToken,
      });

      const session = tokenResult?.session;
      const accessToken = session?.accessToken || session?.access_token;

      if (!session || !accessToken) {
        return res.status(401).json({
          error: "Unauthorized",
          message: "Token exchange failed",
          requestId,
        });
      }

      const client = new shopify.clients.Graphql({
        session: {
          shop: session.shop || shopDomain,
          accessToken,
          scope: session.scope,
          isOnline: session.isOnline || false,
        },
      });

      // Get app installation ID and active subscription
      const appInstallationQuery = `
        query GetAppInstallation {
          currentAppInstallation {
            id
            activeSubscriptions {
              id
              status
              createdAt
              trialDays
              lineItems {
                id
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

      const appInstallationResponse = await client.query({
        data: { query: appInstallationQuery },
      });

      const appInstallationId =
        appInstallationResponse?.body?.data?.currentAppInstallation?.id;
      const activeSubscriptions =
        appInstallationResponse?.body?.data?.currentAppInstallation
          ?.activeSubscriptions || [];
      const activeSubscription = activeSubscriptions.find(
        (sub) => sub.status === "ACTIVE"
      );

      if (!appInstallationId) {
        return res.status(404).json({
          error: "App installation not found",
          requestId,
        });
      }

      if (!activeSubscription) {
        return res.status(404).json({
          error: "No active subscription found",
          message: "Cannot replace trial - no active subscription exists",
          requestId,
        });
      }

      // Map subscription to plan to get plan handle
      const subscriptionStatus = mapSubscriptionToPlan(activeSubscription);
      const planHandle = subscriptionStatus.plan?.handle;

      if (!planHandle) {
        return res.status(400).json({
          error: "Invalid subscription",
          message: "Could not determine plan handle from subscription",
          requestId,
        });
      }

      // Check if subscription is in trial
      const isInTrial = await trialManager.isInTrialPeriod(
        client,
        appInstallationId
      );

      if (!isInTrial) {
        return res.status(400).json({
          error: "Not in trial period",
          message: "Subscription is not in trial period",
          requestId,
        });
      }

      // Check if trial should end
      const trialCheck = await trialManager.shouldEndTrial(
        client,
        appInstallationId
      );

      if (!trialCheck.shouldEnd) {
        return res.status(400).json({
          error: "Trial not ready to end",
          message: "Trial period has not ended yet",
          trialStatus: trialCheck,
          requestId,
        });
      }

      // Get return URL
      const appBaseUrl = appUrl || `https://${shopDomain}`;
      const returnUrl = `${appBaseUrl}/api/billing/return?shop=${encodeURIComponent(
        shopDomain
      )}`;

      const isDemo = isDemoStore(shopDomain);

      // Replace trial subscription with paid subscription
      const replacementResult = await subscriptionReplacement.replaceTrialWithPaidSubscription(
        client,
        shopDomain,
        activeSubscription.id,
        planHandle,
        returnUrl,
        isDemo
      );

      logger.info("[API] [REPLACE_TRIAL] Trial replacement initiated", {
        requestId,
        shop: shopDomain,
        confirmationUrl: replacementResult.confirmationUrl,
        newSubscriptionId: replacementResult.appSubscription?.id,
      });

      res.json({
        success: true,
        confirmationUrl: replacementResult.confirmationUrl,
        appSubscription: replacementResult.appSubscription,
        requestId,
      });
    } catch (error) {
      logger.error("[API] [REPLACE_TRIAL] Failed", error, req, {
        requestId,
        shop: shopDomain,
      });

      if (error instanceof SubscriptionStatusError) {
        return res.status(error.statusCode || 500).json({
          error: error.message,
          details: error.details,
          requestId,
        });
      }

      return res.status(500).json({
        error: "Failed to replace trial subscription",
        message: error.message,
        requestId,
      });
    }
  } catch (error) {
    logger.error("[API] [REPLACE_TRIAL] Unexpected error", error, req, {
      requestId,
    });

    return res.status(500).json({
      error: "Internal server error",
      message: error.message,
      requestId,
    });
  }
});

// Proactive trial replacement approval (user-initiated before reaching 100 credits)
app.post("/api/billing/approve-trial-replacement", async (req, res) => {
  const requestId = `req-${Date.now()}-${Math.random()
    .toString(36)
    .substr(2, 9)}`;

  try {
    const { shop } = req.body || req.query || {};

    if (!shop) {
      return res.status(400).json({
        error: "Missing shop parameter",
        message: "Shop parameter is required.",
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

    const sessionToken = req.sessionToken;

    if (!sessionToken) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "Session token required",
        requestId,
      });
    }

    const tokenResult = await shopify.auth.tokenExchange({
      shop: shopDomain,
      sessionToken,
      requestedTokenType: RequestedTokenType.OfflineAccessToken,
    });

    const session = tokenResult?.session;
    const accessToken = session?.accessToken || session?.access_token;

    if (!session || !accessToken) {
      return res.status(401).json({
        error: "Unauthorized",
        requestId,
      });
    }

    const client = new shopify.clients.Graphql({
      session: {
        shop: session.shop || shopDomain,
        accessToken,
        scope: session.scope,
        isOnline: session.isOnline || false,
      },
    });

    // Get app installation and active subscription
    const appInstallationQuery = `
      query GetAppInstallation {
        currentAppInstallation {
          id
          activeSubscriptions {
            id
            status
            createdAt
            trialDays
            lineItems {
              id
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

    const appInstallationResponse = await client.query({
      data: { query: appInstallationQuery },
    });

    const appInstallationId =
      appInstallationResponse?.body?.data?.currentAppInstallation?.id;
    const activeSubscriptions =
      appInstallationResponse?.body?.data?.currentAppInstallation
        ?.activeSubscriptions || [];
    const activeSubscription = activeSubscriptions.find(
      (sub) => sub.status === "ACTIVE"
    );

    if (!appInstallationId) {
      return res.status(404).json({
        error: "App installation not found",
        requestId,
      });
    }

    if (!activeSubscription) {
      return res.status(404).json({
        error: "No active subscription found",
        message: "Cannot approve trial replacement - no active subscription exists",
        requestId,
      });
    }

    // Check if subscription is in trial
    const isInTrial = await trialManager.isInTrialPeriod(
      client,
      appInstallationId
    );

    if (!isInTrial) {
      return res.status(400).json({
        error: "Not in trial period",
        message: "Subscription is not in trial period",
        requestId,
      });
    }

    // Map subscription to plan to get plan handle
    const subscriptionStatus = mapSubscriptionToPlan(activeSubscription);
    const planHandle = subscriptionStatus.plan?.handle;

    if (!planHandle) {
      return res.status(400).json({
        error: "Invalid subscription",
        message: "Could not determine plan handle from subscription",
        requestId,
      });
    }

    // Get return URL
    const appBaseUrl = appUrl || `https://${shopDomain}`;
    const returnUrl = `${appBaseUrl}/api/billing/return?shop=${encodeURIComponent(
      shopDomain
    )}`;

    const isDemo = isDemoStore(shopDomain);

    // Create replacement subscription (proactive approval)
    const replacementResult = await subscriptionReplacement.replaceTrialWithPaidSubscription(
      client,
      shopDomain,
      activeSubscription.id,
      planHandle,
      returnUrl,
      isDemo
    );

    logger.info("[API] [APPROVE_TRIAL_REPLACEMENT] Proactive trial replacement initiated", {
      requestId,
      shop: shopDomain,
      confirmationUrl: replacementResult.confirmationUrl,
      newSubscriptionId: replacementResult.appSubscription?.id,
      note: "User proactively approved before reaching 100 credits",
    });

    res.json({
      success: true,
      confirmationUrl: replacementResult.confirmationUrl,
      appSubscription: replacementResult.appSubscription,
      requestId,
      message: "Please approve the subscription replacement to continue",
    });
  } catch (error) {
    logger.error("[API] [APPROVE_TRIAL_REPLACEMENT] Failed", error, req, {
      requestId,
      shop: shopDomain,
    });

    if (error instanceof SubscriptionStatusError) {
      return res.status(error.statusCode || 500).json({
        error: error.message,
        details: error.details,
        requestId,
      });
    }

    return res.status(500).json({
      error: "Failed to approve trial replacement",
      message: error.message,
      requestId,
    });
  }
});

// Get trial notification status (for in-app display)
app.get("/api/trial/notifications", async (req, res) => {
  try {
    const { shop } = req.query;

    if (!shop) {
      return res.status(400).json({
        error: "Missing shop parameter",
      });
    }

    const shopDomain = normalizeShopDomain(shop);
    const sessionToken = req.sessionToken;

    if (!sessionToken) {
      return res.status(401).json({
        error: "Unauthorized",
      });
    }

    const tokenResult = await shopify.auth.tokenExchange({
      shop: shopDomain,
      sessionToken,
      requestedTokenType: RequestedTokenType.OfflineAccessToken,
    });

    const session = tokenResult?.session;
    const accessToken = session?.accessToken || session?.access_token;

    if (!session || !accessToken) {
      return res.status(401).json({
        error: "Unauthorized",
      });
    }

    const client = new shopify.clients.Graphql({
      session: {
        shop: session.shop || shopDomain,
        accessToken,
        scope: session.scope,
        isOnline: session.isOnline || false,
      },
    });

    const appInstallationQuery = `
      query GetAppInstallation {
        currentAppInstallation {
          id
        }
      }
    `;
    const appInstallationResponse = await client.query({
      data: { query: appInstallationQuery },
    });
    const appInstallationId =
      appInstallationResponse?.body?.data?.currentAppInstallation?.id;

    if (!appInstallationId) {
      return res.status(404).json({
        error: "App installation not found",
      });
    }

    // Check notification status
    const notificationCheck = await trialNotificationService.checkNotificationThreshold(
      client,
      appInstallationId
    );

    if (notificationCheck.shouldNotify) {
      const inAppNotification = trialNotificationService.getInAppNotification(
        notificationCheck.threshold,
        notificationCheck.creditsUsed,
        notificationCheck.creditsRemaining
      );

      return res.json({
        hasNotification: true,
        notification: inAppNotification,
      });
    }

    // Get trial status
    const trialStatus = await trialManager.getTrialStatus(client, appInstallationId);

    return res.json({
      hasNotification: false,
      trialStatus,
    });
  } catch (error) {
    logger.error("[API] [TRIAL_NOTIFICATIONS] Failed", error, req);
    return res.status(500).json({
      error: "Failed to get trial notifications",
      message: error.message,
    });
  }
});

// Cancel subscription
app.post("/api/billing/cancel", async (req, res) => {
  const requestId = `req-${Date.now()}-${Math.random()
    .toString(36)
    .substr(2, 9)}`;

  try {
    // Get shop from query string
    const shop = req.query.shop;
    const { subscriptionId, prorate } = req.body || {};

    logger.info("[API] [CANCEL] Request received", {
      requestId,
      shop,
      subscriptionId,
      prorate: prorate || false,
    });

    if (!shop) {
      return res.status(400).json({
        error: "Missing shop parameter",
        message: "Shop parameter is required in query string",
        requestId,
      });
    }

    if (!subscriptionId) {
      return res.status(400).json({
        error: "Missing required parameters",
        message: "subscriptionId is required in request body.",
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

    if (!req.sessionToken) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "Session token required for billing API",
        requestId,
      });
    }

    try {
      // Exchange JWT session token for an offline access token for billing
      const tokenResult = await shopify.auth.tokenExchange({
        shop: shopDomain,
        sessionToken: req.sessionToken,
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
          shop: session.shop || shopDomain,
          accessToken,
          scope: session.scope,
          isOnline: session.isOnline || false,
        },
      });

      const mutation = `
        mutation AppSubscriptionCancel($id: ID!, $prorate: Boolean) {
          appSubscriptionCancel(id: $id, prorate: $prorate) {
            userErrors {
              field
              message
            }
            appSubscription {
              id
              status
              name
              currentPeriodEnd
            }
          }
        }
      `;

      const variables = {
        id: subscriptionId,
        prorate: prorate === true,
      };

      const response = await client.query({
        data: {
          query: mutation,
          variables,
        },
      });

      const payload = response?.body?.data?.appSubscriptionCancel;

      if (!payload) {
        throw new SubscriptionStatusError(
          "Unexpected response from appSubscriptionCancel",
          500,
          {
            resolution:
              "Please try again. If the issue persists, contact support.",
          }
        );
      }

      const userErrors = payload.userErrors || [];
      if (userErrors.length > 0) {
        throw new SubscriptionStatusError(
          "Failed to cancel subscription",
          400,
          {
            resolution: "Review the error details and try again.",
            userErrors,
          }
        );
      }

      logger.info("[API] [CANCEL] Subscription cancelled", {
        requestId,
        shop: shopDomain,
        subscriptionId,
        appSubscriptionStatus: payload.appSubscription?.status,
      });

      res.setHeader("Content-Type", "application/json");
      return res.status(200).json({
        requestId,
        appSubscription: payload.appSubscription,
        success: true,
      });
    } catch (error) {
      if (error instanceof SubscriptionStatusError) {
        throw error;
      }

      logger.error("[BILLING] Failed to cancel app subscription", error, null, {
        shop: shopDomain,
        subscriptionId,
      });

      throw new SubscriptionStatusError("Failed to cancel subscription", 500, {
        resolution: "Please try again. If the issue persists, contact support.",
        error: error.message,
      });
    }
  } catch (error) {
    if (error instanceof SubscriptionStatusError) {
      logger.warn("[API] [CANCEL] Subscription error", {
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

    logger.error("[API] [CANCEL] Unexpected error", error, req, {
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
    // Validate shop parameter from query string
    const shop = req.query.shop;
    if (!shop) {
      return res.status(400).json({
        error: "Missing shop parameter",
        message: "Shop parameter is required in query string",
      });
    }

    const shopDomain = normalizeShopDomain(shop);
    if (!shopDomain) {
      return res.status(400).json({
        error: "Invalid shop parameter",
        message: "Provide a valid .myshopify.com domain or shop handle",
      });
    }

    // Validate billing module exists
    if (!billing || typeof billing.getAvailablePlans !== "function") {
      const errorMsg = !billing
        ? "Billing module not loaded"
        : "getAvailablePlans function not available";
      console.error("[BILLING]", errorMsg, {
        billingExists: !!billing,
        billingKeys: billing ? Object.keys(billing) : [],
      });
      return res.status(500).json({
        error: {
          code: "500",
          message: errorMsg,
        },
      });
    }

    // Get plans
    const plans = billing.getAvailablePlans();

    // Validate and return
    if (!Array.isArray(plans)) {
      console.error("[BILLING] getAvailablePlans did not return an array", {
        type: typeof plans,
        value: plans,
      });
      return res.status(500).json({
        error: {
          code: "500",
          message: "Invalid plans data format",
        },
      });
    }

    return res.json({ plans });
  } catch (error) {
    console.error("[BILLING] Unexpected error:", {
      message: error?.message,
      stack: error?.stack?.split("\n").slice(0, 5).join("\n"),
      name: error?.name,
    });

    if (!res.headersSent) {
      return res.status(500).json({
        error: {
          code: "500",
          message: error?.message || "A server error has occurred",
        },
      });
    }
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

// Credit API Routes
// Get credit balance
app.get("/api/credits/balance", async (req, res) => {
  try {
    const shop = req.query.shop;
    if (!shop) {
      return res.status(400).json({
        error: "Missing shop parameter",
        message: "Shop parameter is required",
      });
    }

    const shopDomain = normalizeShopDomain(shop);
    if (!shopDomain) {
      return res.status(400).json({
        error: "Invalid shop parameter",
        message: "Provide a valid .myshopify.com domain",
      });
    }

    // Get session token from request
    const sessionToken = req.sessionToken;
    if (!sessionToken) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "Session token required",
      });
    }

    // Exchange token for access token
    const tokenResult = await shopify.auth.tokenExchange({
      shop: shopDomain,
      sessionToken,
      requestedTokenType: RequestedTokenType.OfflineAccessToken,
    });

    const session = tokenResult?.session;
    const accessToken = session?.accessToken || session?.access_token;

    if (!session || !accessToken) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "Failed to get access token",
      });
    }

    const client = new shopify.clients.Graphql({
      session: {
        shop: session.shop || shopDomain,
        accessToken,
        scope: session.scope,
        isOnline: session.isOnline || false,
      },
    });

    // Get app installation ID
    const appInstallationQuery = `
      query GetAppInstallation {
        appInstallation {
          id
        }
      }
    `;
    const appInstallationResponse = await client.query({
      data: { query: appInstallationQuery },
    });
    const appInstallationId =
      appInstallationResponse?.body?.data?.appInstallation?.id;

    if (!appInstallationId) {
      return res.status(404).json({
        error: "App installation not found",
      });
    }

    // Get credit balance
    logger.info("[CREDITS] Fetching credit balance", {
      shop: shopDomain,
      appInstallationId,
    });

    // First, check if credits exist
    const metafields = await creditMetafield.getCreditMetafields(
      client,
      appInstallationId
    );

    // If credits don't exist but subscription is active, initialize them
    if (metafields.credit_balance == null) {
      logger.info(
        "[CREDITS] Credits not initialized, checking for active subscription",
        {
          shop: shopDomain,
          appInstallationId,
        }
      );

      // Query subscription directly (no need for full subscription status check)
      const subscriptionQuery = `
        query GetActiveSubscription {
          currentAppInstallation {
            activeSubscriptions {
              id
              status
              currentPeriodEnd
              createdAt
              trialDays
              lineItems {
                id
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
                    ... on AppUsagePricing {
                      terms
                      cappedAmount {
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

      const subscriptionResponse = await client.query({
        data: { query: subscriptionQuery },
      });

      const subscriptions =
        subscriptionResponse?.body?.data?.currentAppInstallation
          ?.activeSubscriptions || [];
      const activeSubscription =
        subscriptions.find((sub) => sub.status === "ACTIVE") || null;

      if (activeSubscription) {
        // CRITICAL: Get trial status from metafields or calculate from subscription data
        // NO FALLBACKS - always calculate correctly
        let customTrialStatus = null;
        try {
          customTrialStatus = await trialManager.getTrialStatus(
            client,
            appInstallationId,
            {
              createdAt: activeSubscription.createdAt,
              trialDays: activeSubscription.trialDays,
            }
          );
          logger.info("[CREDITS] Fetched custom trial status", {
            shop: shopDomain,
            isTrial: customTrialStatus.isTrial,
            daysRemaining: customTrialStatus.daysRemaining,
            note: customTrialStatus.note || "Using custom trial logic from metafields (30 days OR 100 credits)",
          });
        } catch (trialStatusError) {
          logger.error("[CREDITS] Failed to fetch custom trial status", trialStatusError, null, {
            shop: shopDomain,
            error: trialStatusError.message,
          });
          // Throw error - no fallbacks allowed
          throw new Error(`Failed to get trial status for credit initialization: ${trialStatusError.message}`);
        }

        // Map subscription to plan to get plan handle and credits
        const subscriptionStatus = mapSubscriptionToPlan(activeSubscription, customTrialStatus);
        const planHandle = subscriptionStatus.plan?.handle;
        const planConfig = planHandle ? billing?.PLANS?.[planHandle] : null;
        const includedCredits = planConfig?.limits?.includedCredits || 100;
        const isAnnual = subscriptionStatus.plan?.interval === "ANNUAL";
        const isInTrial = subscriptionStatus.subscription?.isInTrial || false;

        logger.info(
          "[CREDITS] Active subscription found, initializing credits",
          {
            shop: shopDomain,
            appInstallationId,
            subscriptionId: activeSubscription.id,
            planHandle,
            includedCredits,
            isAnnual,
            isInTrial,
          }
        );

        // Find usage pricing line item
        const usageLineItem = activeSubscription.lineItems?.find(
          (item) => item.plan?.pricingDetails?.__typename === "AppUsagePricing"
        );

        // Initialize credits (with trial handling)
        await creditMetafield.initializeCredits(
          client,
          appInstallationId,
          planHandle,
          includedCredits,
          activeSubscription.currentPeriodEnd,
          usageLineItem?.id || null,
          isAnnual,
          isInTrial
        );

        logger.info("[CREDITS] Credits initialized successfully", {
          shop: shopDomain,
          appInstallationId,
          includedCredits,
          isAnnual,
          planHandle,
        });
      } else {
        logger.info(
          "[CREDITS] No active subscription found, skipping credit initialization",
          {
            shop: shopDomain,
            appInstallationId,
            subscriptionsFound: subscriptions.length,
          }
        );
      }
    }

    // Get credit balance (after potential initialization)
    const creditData = await creditManager.getTotalCreditsAvailable(
      client,
      appInstallationId
    );

    logger.info("[CREDITS] Credit balance retrieved successfully", {
      shop: shopDomain,
      appInstallationId,
      balance: creditData.balance,
      included: creditData.included,
      used: creditData.used,
      isOverage: creditData.isOverage || false,
      periodEnd: creditData.periodEnd,
      hasSubscriptionLineItemId: !!creditData.subscriptionLineItemId,
    });

    res.json({
      balance: creditData.balance,
      included: creditData.included,
      used: creditData.used,
      isOverage: creditData.isOverage || false,
      periodEnd: creditData.periodEnd,
      subscriptionLineItemId: creditData.subscriptionLineItemId,
      canPurchase: true,
    });
  } catch (error) {
    logger.error("[CREDITS] Failed to get credit balance", error, req);
    res.status(500).json({
      error: "Failed to get credit balance",
      message: error.message,
    });
  }
});

// Deduct credit (internal endpoint)
app.post("/api/credits/deduct", async (req, res) => {
  try {
    const { shop, amount = 1, tryonId, description } = req.body;

    if (!shop) {
      return res.status(400).json({
        error: "Missing shop parameter",
      });
    }

    const shopDomain = normalizeShopDomain(shop);
    const sessionToken = req.sessionToken;

    if (!sessionToken) {
      return res.status(401).json({
        error: "Unauthorized",
      });
    }

    const tokenResult = await shopify.auth.tokenExchange({
      shop: shopDomain,
      sessionToken,
      requestedTokenType: RequestedTokenType.OfflineAccessToken,
    });

    const session = tokenResult?.session;
    const accessToken = session?.accessToken || session?.access_token;

    if (!session || !accessToken) {
      return res.status(401).json({
        error: "Unauthorized",
      });
    }

    const client = new shopify.clients.Graphql({
      session: {
        shop: session.shop || shopDomain,
        accessToken,
        scope: session.scope,
        isOnline: session.isOnline || false,
      },
    });

    // Get app installation ID and active subscription to check trial status
    const appInstallationQuery = `
      query GetAppInstallation {
        currentAppInstallation {
          id
          activeSubscriptions {
            id
            status
            createdAt
            trialDays
            lineItems {
              id
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
    const appInstallationResponse = await client.query({
      data: { query: appInstallationQuery },
    });
    const appInstallationId =
      appInstallationResponse?.body?.data?.currentAppInstallation?.id;
    const activeSubscriptions =
      appInstallationResponse?.body?.data?.currentAppInstallation
        ?.activeSubscriptions || [];
    const activeSubscription = activeSubscriptions.find(
      (sub) => sub.status === "ACTIVE"
    );

    if (!appInstallationId) {
      return res.status(404).json({
        error: "App installation not found",
      });
    }

    // Check if trial should end BEFORE deducting credits
    // Only trigger replacement for EARLY trial ending (credits exhausted)
    // If trial ends after 30 days, Shopify handles it automatically via webhook (no replacement needed)
    const isInTrial = await trialManager.isInTrialPeriod(client, appInstallationId);
    if (isInTrial && activeSubscription) {
      const trialCheck = await trialManager.shouldEndTrial(client, appInstallationId);
      
      if (trialCheck.shouldEnd) {
        // Only trigger replacement if trial ended EARLY (credits exhausted before 30 days)
        // If trial ended after 30 days, Shopify will automatically transition (handled via webhook)
        const isEarlyEnding = trialCheck.reason === "Trial credits exhausted";
        
        if (isEarlyEnding) {
          // Trial ended EARLY - need to replace subscription for immediate charging
          logger.info("[CREDITS] Trial ended early (credits exhausted), triggering replacement", {
            shop: shopDomain,
            reason: trialCheck.reason,
            note: "Charging will start immediately after merchant approval",
          });

          // Map subscription to plan to get plan handle
          const subscriptionStatus = mapSubscriptionToPlan(activeSubscription);
          const planHandle = subscriptionStatus.plan?.handle;

          if (planHandle) {
            // Get return URL
            const appBaseUrl = appUrl || `https://${shopDomain}`;
            const returnUrl = `${appBaseUrl}/api/billing/return?shop=${shopDomain}`;
            const isDemo = isDemoStore(shopDomain);

            try {
              // Automatically trigger replacement - this creates a paid subscription with NO trial days
              // Once merchant approves, charging starts IMMEDIATELY
              const replacementResult = await subscriptionReplacement.replaceTrialWithPaidSubscription(
                client,
                shopDomain,
                activeSubscription.id,
                planHandle,
                returnUrl,
                isDemo
              );

              // Mark trial as ended in metafields
              await creditMetafield.batchUpdateMetafields(client, appInstallationId, {
                is_trial_period: false,
              });

              logger.info("[CREDITS] Trial replacement automatically triggered (early ending)", {
                shop: shopDomain,
                confirmationUrl: replacementResult.confirmationUrl,
                note: "Merchant must approve to start immediate charging",
              });

              // Return confirmation URL so frontend can redirect merchant to approve
              return res.status(402).json({
                success: false,
                error: "TRIAL_REPLACEMENT_NEEDED",
                message: `Trial period ended early: ${trialCheck.reason}. Subscription replacement required for immediate charging.`,
                trialEndReason: trialCheck.reason,
                requiresReplacement: true,
                confirmationUrl: replacementResult.confirmationUrl,
                appSubscription: replacementResult.appSubscription,
                statusCode: 402, // Payment Required
                note: "Trial credits will remain available after subscription activation. Charging starts immediately after approval.",
              });
            } catch (replacementError) {
              logger.error("[CREDITS] Failed to automatically trigger trial replacement", replacementError, req, {
                shop: shopDomain,
              });
              // Fall through to return TRIAL_REPLACEMENT_NEEDED error
              return res.status(402).json({
                success: false,
                error: "TRIAL_REPLACEMENT_NEEDED",
                message: `Trial period ended early: ${trialCheck.reason}. Subscription replacement required.`,
                trialEndReason: trialCheck.reason,
                requiresReplacement: true,
                statusCode: 402,
                note: "Please call /api/billing/replace-trial to complete replacement",
              });
            }
          }
        } else {
          // Trial ended after 30 days - Shopify will handle automatically
          // Just mark trial as ended in metafields, webhook will handle the rest
          logger.info("[CREDITS] Trial ended after 30 days - Shopify will handle automatic transition", {
            shop: shopDomain,
            reason: trialCheck.reason,
            note: "No replacement needed - Shopify handles automatic transition to paid subscription",
          });
          
          // Mark trial as ended in metafields (Shopify webhook will handle subscription transition)
          await creditMetafield.batchUpdateMetafields(client, appInstallationId, {
            is_trial_period: false,
          });
        }
      }
    }

    const result = await creditDeduction.deductCreditForTryOn(
      client,
      appInstallationId,
      shopDomain,
      tryonId || `tryon-${Date.now()}`
    );

    if (!result.success) {
      // Check if trial replacement is needed (fallback check)
      if (result.error === "TRIAL_REPLACEMENT_NEEDED") {
        return res.status(402).json({
          ...result,
          statusCode: 402, // Payment Required
        });
      }
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error) {
    logger.error("[CREDITS] Failed to deduct credit", error, req);
    res.status(500).json({
      error: "Failed to deduct credit",
      message: error.message,
    });
  }
});

// Add credits for new billing period (credits never expire, they carry forward)
app.post("/api/credits/reset", async (req, res) => {
  try {
    const { shop, periodEnd } = req.body;

    if (!shop || !periodEnd) {
      return res.status(400).json({
        error: "Missing required parameters",
      });
    }

    const shopDomain = normalizeShopDomain(shop);
    const sessionToken = req.sessionToken;

    // For webhook calls, sessionToken might not be available
    // In that case, we need to use the shop's offline access token
    let client;
    if (sessionToken) {
      const tokenResult = await shopify.auth.tokenExchange({
        shop: shopDomain,
        sessionToken,
        requestedTokenType: RequestedTokenType.OfflineAccessToken,
      });
      const session = tokenResult?.session;
      const accessToken = session?.accessToken || session?.access_token;
      client = new shopify.clients.Graphql({
        session: {
          shop: session.shop || shopDomain,
          accessToken,
          scope: session.scope,
          isOnline: session.isOnline || false,
        },
      });
    } else {
      // For webhook calls, we'd need to get the offline token from storage
      // This is a simplified version - in production, you'd get it from your session storage
      return res.status(401).json({
        error: "Authentication required",
      });
    }

    const appInstallationQuery = `
      query GetAppInstallation {
        appInstallation {
          id
        }
      }
    `;
    const appInstallationResponse = await client.query({
      data: { query: appInstallationQuery },
    });
    const appInstallationId =
      appInstallationResponse?.body?.data?.appInstallation?.id;

    if (!appInstallationId) {
      return res.status(404).json({
        error: "App installation not found",
      });
    }

    // Add credits instead of resetting (credits carry forward)
    const result = await creditReset.resetCreditsForNewPeriod(
      client,
      appInstallationId,
      periodEnd
    );

    res.json(result);
  } catch (error) {
    logger.error("[CREDITS] Failed to add credits", error, req);
    res.status(500).json({
      error: "Failed to add credits",
      message: error.message,
    });
  }
});

// Get credit packages
app.get("/api/credits/packages", (req, res) => {
  try {
    const packages = creditPurchase.getCreditPackages();
    res.json({ packages });
  } catch (error) {
    logger.error("[CREDITS] Failed to get credit packages", error, req);
    res.status(500).json({
      error: "Failed to get credit packages",
      message: error.message,
    });
  }
});

// Purchase credits
app.post("/api/credits/purchase", async (req, res) => {
  try {
    const { shop, packageId, couponCode } = req.body;

    if (!shop || !packageId) {
      return res.status(400).json({
        error: "Missing required parameters",
      });
    }

    const shopDomain = normalizeShopDomain(shop);
    const sessionToken = req.sessionToken;

    if (!sessionToken) {
      return res.status(401).json({
        error: "Unauthorized",
      });
    }

    const tokenResult = await shopify.auth.tokenExchange({
      shop: shopDomain,
      sessionToken,
      requestedTokenType: RequestedTokenType.OfflineAccessToken,
    });

    const session = tokenResult?.session;
    const accessToken = session?.accessToken || session?.access_token;

    if (!session || !accessToken) {
      return res.status(401).json({
        error: "Unauthorized",
      });
    }

    const client = new shopify.clients.Graphql({
      session: {
        shop: session.shop || shopDomain,
        accessToken,
        scope: session.scope,
        isOnline: session.isOnline || false,
      },
    });

    const result = await creditPurchase.createCreditPurchase(
      client,
      shopDomain,
      packageId,
      couponCode
    );

    res.json(result);
  } catch (error) {
    logger.error("[CREDITS] Failed to create credit purchase", error, req);
    res.status(500).json({
      error: "Failed to create credit purchase",
      message: error.message,
    });
  }
});

// Redeem coupon code
app.post("/api/credits/redeem-coupon", async (req, res) => {
  try {
    // Get shop from query parameter or body (prefer query parameter)
    const shop = req.query.shop || req.body?.shop;
    // Get couponCode from body (can also accept 'code' for backwards compatibility)
    const couponCode = req.body?.couponCode || req.body?.code;

    if (!shop || !couponCode) {
      return res.status(400).json({
        error: "Missing required parameters",
        details: !shop ? "shop parameter is required (query or body)" : "couponCode is required in request body",
      });
    }

    const shopDomain = normalizeShopDomain(shop);
    const sessionToken = req.sessionToken;

    if (!sessionToken) {
      return res.status(401).json({
        error: "Unauthorized",
      });
    }

    const tokenResult = await shopify.auth.tokenExchange({
      shop: shopDomain,
      sessionToken,
      requestedTokenType: RequestedTokenType.OfflineAccessToken,
    });

    const session = tokenResult?.session;
    const accessToken = session?.accessToken || session?.access_token;

    if (!session || !accessToken) {
      return res.status(401).json({
        error: "Unauthorized",
      });
    }

    const client = new shopify.clients.Graphql({
      session: {
        shop: session.shop || shopDomain,
        accessToken,
        scope: session.scope,
        isOnline: session.isOnline || false,
      },
    });

    const appInstallationQuery = `
      query GetAppInstallation {
        appInstallation {
          id
        }
      }
    `;
    const appInstallationResponse = await client.query({
      data: { query: appInstallationQuery },
    });
    const appInstallationId =
      appInstallationResponse?.body?.data?.appInstallation?.id;

    if (!appInstallationId) {
      return res.status(404).json({
        error: "App installation not found",
      });
    }

    const result = await couponService.redeemCouponCode(
      client,
      appInstallationId,
      couponCode
    );

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error) {
    logger.error("[CREDITS] Failed to redeem coupon", error, req);
    res.status(500).json({
      error: "Failed to redeem coupon",
      message: error.message,
    });
  }
});

// Get coupon status
app.get("/api/credits/coupon-status", async (req, res) => {
  try {
    const { shop, code } = req.query;

    if (!shop || !code) {
      return res.status(400).json({
        error: "Missing required parameters",
      });
    }

    const shopDomain = normalizeShopDomain(shop);
    const sessionToken = req.sessionToken;

    if (!sessionToken) {
      return res.status(401).json({
        error: "Unauthorized",
      });
    }

    const tokenResult = await shopify.auth.tokenExchange({
      shop: shopDomain,
      sessionToken,
      requestedTokenType: RequestedTokenType.OfflineAccessToken,
    });

    const session = tokenResult?.session;
    const accessToken = session?.accessToken || session?.access_token;

    if (!session || !accessToken) {
      return res.status(401).json({
        error: "Unauthorized",
      });
    }

    const client = new shopify.clients.Graphql({
      session: {
        shop: session.shop || shopDomain,
        accessToken,
        scope: session.scope,
        isOnline: session.isOnline || false,
      },
    });

    const appInstallationQuery = `
      query GetAppInstallation {
        appInstallation {
          id
        }
      }
    `;
    const appInstallationResponse = await client.query({
      data: { query: appInstallationQuery },
    });
    const appInstallationId =
      appInstallationResponse?.body?.data?.appInstallation?.id;

    if (!appInstallationId) {
      return res.status(404).json({
        error: "App installation not found",
      });
    }

    const validation = await couponService.validateCouponCode(
      client,
      appInstallationId,
      code
    );
    const alreadyUsed = await couponService.checkCouponUsage(
      client,
      appInstallationId,
      code
    );
    const config = couponService.getCouponConfig(code);

    res.json({
      valid: validation.valid,
      code: code.toUpperCase(),
      credits: config?.credits || null,
      alreadyUsed,
      expiresAt: config?.expiresAt || null,
      usageLimit: config?.usageLimit?.perShop || null,
    });
  } catch (error) {
    logger.error("[CREDITS] Failed to get coupon status", error, req);
    res.status(500).json({
      error: "Failed to get coupon status",
      message: error.message,
    });
  }
});

// Store information sync endpoint
// Syncs store information to remote backend when app loads in embedded context
app.post("/api/stores/sync", async (req, res) => {
  try {
    // Get shop from request (from middleware or query param, same pattern as other endpoints)
    const shop = req.shop || req.query.shop;
    if (!shop) {
      return res.status(400).json({
        error: "Missing shop parameter",
        message: "Shop parameter is required",
      });
    }

    const shopDomain = normalizeShopDomain(shop);
    if (!shopDomain) {
      return res.status(400).json({
        error: "Invalid shop parameter",
        message: "Provide a valid .myshopify.com domain",
      });
    }

    // Get session token from request (already extracted by verifySessionToken middleware)
    const sessionToken = req.sessionToken;
    if (!sessionToken) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "Session token required",
      });
    }

    logger.info("[STORES] Starting store information sync", {
      shop: shopDomain,
    });

    // Exchange JWT session token for offline access token
    // CRITICAL: We MUST exchange the JWT session token for an offline access token
    // Session tokens (JWTs) are temporary and should NEVER be stored in the database
    // Offline access tokens (shpat_xxxxx) are long-lived and safe for database storage
    const tokenResult = await shopify.auth.tokenExchange({
      shop: shopDomain,
      sessionToken,
      requestedTokenType: RequestedTokenType.OfflineAccessToken,
    });

    const session = tokenResult?.session;
    const accessToken = session?.accessToken || session?.access_token;

    if (!session || !accessToken) {
      logger.error("[STORES] Token exchange failed", null, req, {
        shop: shopDomain,
      });
      return res.status(401).json({
        error: "Unauthorized",
        message: "Failed to get access token",
      });
    }

    // SECURITY VALIDATION: Ensure we're NOT accidentally sending a JWT session token
    // Offline access tokens start with "shpat_" (admin API) or "shpca_" (customer API)
    // JWT tokens contain dots and can be decoded - we must reject them
    const isJWT = accessToken.includes(".") && accessToken.split(".").length === 3;
    const isOfflineToken = accessToken.startsWith("shpat_") || accessToken.startsWith("shpca_");
    
    if (isJWT || !isOfflineToken) {
      logger.error("[STORES] SECURITY ERROR: Attempted to store JWT session token instead of offline access token", null, req, {
        shop: shopDomain,
        tokenType: isJWT ? "JWT" : "UNKNOWN",
        tokenPrefix: accessToken.substring(0, 10),
        isOnline: session.isOnline,
      });
      return res.status(500).json({
        error: "Security validation failed",
        message: "Invalid token type - cannot store session token in database",
      });
    }

    // Ensure isOnline is false for offline tokens (should already be false, but enforce it)
    const isOnline = false; // Offline tokens are always false

    logger.info("[STORES] Token exchange successful - offline access token obtained", {
      shop: shopDomain,
      tokenType: "offline",
      tokenPrefix: accessToken.substring(0, 10) + "...",
      isOnline: false,
      scope: session.scope,
    });

    // Create GraphQL client with offline access token
    // Note: isOnline is always false for offline tokens
    const client = new shopify.clients.Graphql({
      session: {
        shop: session.shop || shopDomain,
        accessToken,
        scope: session.scope,
        isOnline: false, // Offline tokens are always false
      },
    });

    // Query shop information
    const shopInfoQuery = `
      query GetShopInfo {
        shop {
          id
          name
          email
          currencyCode
          timezoneAbbreviation
          ianaTimezone
          myshopifyDomain
          primaryDomain {
            host
            url
          }
          plan {
            publicDisplayName
            partnerDevelopment
          }
          contactEmail
          shopOwnerName
        }
      }
    `;

    const shopInfoResponse = await client.query({
      data: { query: shopInfoQuery },
    });
    const shopData = shopInfoResponse?.body?.data?.shop;

    if (!shopData) {
      logger.error("[STORES] Failed to fetch shop information", null, req, {
        shop: shopDomain,
      });
      return res.status(500).json({
        error: "Failed to fetch shop information",
        message: "Shop data not available",
      });
    }

    // Prepare payload for remote backend
    // Note: Field names must match API_STORES_INSTALL.md specification
    // CRITICAL: We're sending an OFFLINE access token (shpat_xxxxx), NOT a JWT session token
    // Offline tokens are safe for database storage and server-side use
    const payload = {
      shop: shopDomain, // Required: shop domain (normalized)
      accessToken: accessToken, // Required: Shopify OAuth OFFLINE access token (shpat_xxxxx)
      scope: session.scope, // Optional: OAuth scopes
      isOnline: false, // Required: MUST be false for offline tokens (validated above)
      installedAt: new Date().toISOString(), // Optional: Installation timestamp
      shopInfo: {
        id: shopData.id,
        name: shopData.name,
        email: shopData.email || shopData.contactEmail,
        currencyCode: shopData.currencyCode,
        timezone: shopData.ianaTimezone || shopData.timezoneAbbreviation,
        myshopifyDomain: shopData.myshopifyDomain,
        primaryDomain: shopData.primaryDomain?.host,
        planName: shopData.plan?.publicDisplayName,
        ownerName: shopData.shopOwnerName,
      },
      host: req.query.host || null,
    };

    // Send to remote backend (blocking - wait for response)
    const remoteBackendUrl = process.env.VITE_API_ENDPOINT;
    // const remoteBackendUrl = "http://localhost:3000";
    if (!remoteBackendUrl) {
      logger.warn(
        "[STORES] VITE_API_ENDPOINT not configured, skipping store info sync",
        {
          shop: shopDomain,
        }
      );
      return res.status(200).json({
        success: true,
        message: "Store information sync skipped",
        shop: shopDomain,
        status: "skipped",
        reason: "VITE_API_ENDPOINT not configured",
      });
    }

    // Generate unique request ID for tracking
    const syncRequestId = `sync-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 9)}`;
    const remoteBackendEndpoint = `${remoteBackendUrl}/api/stores/install`;

    // Log request initiation
    logger.info("[STORES] Initiating store info sync to remote backend", {
      shop: shopDomain,
      backendUrl: remoteBackendUrl,
      endpoint: remoteBackendEndpoint,
      requestId: syncRequestId,
      timestamp: new Date().toISOString(),
    });

    try {
      // Send request and wait for response (with timeout)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

      let response;
      try {
        response = await fetch(remoteBackendEndpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
      } catch (fetchError) {
        clearTimeout(timeoutId);
        const isTimeout = fetchError.name === "AbortError";
        logger.error(
          "[STORES] Failed to send request to remote backend",
          fetchError,
          req,
          {
            shop: shopDomain,
            requestId: syncRequestId,
            endpoint: remoteBackendEndpoint,
            errorMessage: fetchError.message,
            errorName: fetchError.name,
            errorCode: fetchError.code,
            errorStack: fetchError.stack,
            isTimeout,
            timestamp: new Date().toISOString(),
          }
        );

        return res.status(502).json({
          success: false,
          error: isTimeout ? "Request timeout" : "Network error",
          message: isTimeout
            ? "Remote backend did not respond within 30 seconds"
            : `Failed to connect to remote backend: ${fetchError.message}`,
          shop: shopDomain,
          syncRequestId: syncRequestId,
          remoteBackendUrl: remoteBackendUrl,
          endpoint: remoteBackendEndpoint,
          status: "failed",
          errorType: fetchError.name,
        });
      }

      // Parse response text
      let responseText = "";
      try {
        responseText = await response.text();
      } catch (textError) {
        logger.error(
          "[STORES] Failed to parse response text from remote backend",
          textError,
          req,
          {
            shop: shopDomain,
            requestId: syncRequestId,
            endpoint: remoteBackendEndpoint,
            status: response.status,
            statusText: response.statusText,
            errorMessage: textError.message,
            timestamp: new Date().toISOString(),
          }
        );
        // Continue with empty responseText
      }

      if (!response.ok) {
        // Remote backend returned error status
        logger.error("[STORES] Remote backend returned error", null, req, {
          shop: shopDomain,
          requestId: syncRequestId,
          status: response.status,
          statusText: response.statusText,
          error: responseText,
          endpoint: remoteBackendEndpoint,
          timestamp: new Date().toISOString(),
        });

        return res.status(502).json({
          success: false,
          error: "Remote backend error",
          message: `Remote backend returned ${response.status}: ${response.statusText}`,
          shop: shopDomain,
          syncRequestId: syncRequestId,
          remoteBackendUrl: remoteBackendUrl,
          endpoint: remoteBackendEndpoint,
          status: "failed",
          remoteError: responseText.substring(0, 500),
        });
      }

      // Success - remote backend received and processed the request
      logger.info("[STORES] Store info sent to remote backend successfully", {
        shop: shopDomain,
        requestId: syncRequestId,
        backendUrl: remoteBackendUrl,
        endpoint: remoteBackendEndpoint,
        status: response.status,
        responsePreview: responseText.substring(0, 200),
        timestamp: new Date().toISOString(),
      });

      // Return success response only after remote backend confirms
      return res.status(200).json({
        success: true,
        message: "Store information synced successfully",
        shop: shopDomain,
        syncRequestId: syncRequestId,
        remoteBackendUrl: remoteBackendUrl,
        endpoint: remoteBackendEndpoint,
        status: "completed",
        remoteResponse: responseText.substring(0, 500),
      });
    } catch (error) {
      // Handle any unexpected errors
      logger.error(
        "[STORES] Unexpected error during store info sync",
        error,
        req,
        {
          shop: shopDomain,
          requestId: syncRequestId,
          endpoint: remoteBackendEndpoint,
          errorMessage: error.message,
          errorName: error.name,
          errorStack: error.stack,
          timestamp: new Date().toISOString(),
        }
      );

      return res.status(500).json({
        success: false,
        error: "Internal server error",
        message: `An unexpected error occurred: ${error.message}`,
        shop: shopDomain,
        syncRequestId: syncRequestId,
        remoteBackendUrl: remoteBackendUrl,
        endpoint: remoteBackendEndpoint,
        status: "failed",
      });
    }
  } catch (error) {
    logger.error("[STORES] Store information sync failed", error, req);
    res.status(500).json({
      error: "Failed to sync store information",
      message: error.message,
    });
  }
});

// API Routes
app.post("/api/tryon/generate", async (req, res) => {
  const startTime = Date.now();
  let tryonId = null;
  let creditDeductionResult = null;
  let shopDomain = null;

  try {
    const { personImage, clothingImage, storeName, clothingKey, personKey } =
      req.body;

    // Get shop from query parameter first, then fall back to storeName in body
    const shop = req.query.shop || storeName;
    shopDomain = shop ? normalizeShopDomain(shop) : null;
    tryonId = `tryon-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    logger.info("[API] Try-on generation request received", {
      shop: req.query.shop,
      storeName,
      shopDomain,
      tryonId,
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

    // Check subscription and credits if shop is provided
    if (shopDomain) {
      const sessionToken = req.sessionToken;

      if (sessionToken) {
        try {
          // Exchange token for access token
          const tokenResult = await shopify.auth.tokenExchange({
            shop: shopDomain,
            sessionToken,
            requestedTokenType: RequestedTokenType.OfflineAccessToken,
          });

          const session = tokenResult?.session;
          const accessToken = session?.accessToken || session?.access_token;

          if (session && accessToken) {
            const client = new shopify.clients.Graphql({
              session: {
                shop: session.shop || shopDomain,
                accessToken,
                scope: session.scope,
                isOnline: session.isOnline || false,
              },
            });

            // Get app installation ID
            const appInstallationQuery = `
              query GetAppInstallation {
                currentAppInstallation {
                  id
                }
              }
            `;
            const appInstallationResponse = await client.query({
              data: { query: appInstallationQuery },
            });
            const appInstallationId =
              appInstallationResponse?.body?.data?.appInstallation?.id;

            if (appInstallationId) {
              // Check subscription status
              const subscriptionStatus = await fetchManagedSubscriptionStatus(
                shopDomain,
                session,
                sessionToken
              );

              if (!subscriptionStatus.hasActiveSubscription) {
                return res.status(403).json({
                  error: "No active subscription",
                  message:
                    "Please subscribe to a plan to use try-on generation",
                });
              }

              // Check credit availability
              const creditAvailability =
                await creditManager.checkCreditAvailability(
                  client,
                  appInstallationId,
                  1
                );

              if (!creditAvailability.available) {
                return res.status(403).json({
                  error: "Insufficient credits",
                  message:
                    "You have no credits remaining. Please purchase more credits.",
                  creditsRemaining: creditAvailability.remaining,
                });
              }

              // Deduct credit
              creditDeductionResult =
                await creditDeduction.deductCreditForTryOn(
                  client,
                  appInstallationId,
                  shopDomain,
                  tryonId
                );

              if (!creditDeductionResult.success) {
                if (creditDeductionResult.error === "CAPPED_AMOUNT_EXCEEDED") {
                  return res.status(403).json({
                    error: "Credit limit exceeded",
                    message: creditDeductionResult.message,
                  });
                }
                return res.status(400).json({
                  error: "Credit deduction failed",
                  message:
                    creditDeductionResult.message || "Failed to deduct credit",
                });
              }

              logger.info("[API] Credit deducted for try-on", {
                shopDomain,
                tryonId,
                source: creditDeductionResult.source,
                creditsRemaining: creditDeductionResult.creditsRemaining,
              });
            }
          }
        } catch (creditError) {
          logger.error(
            "[API] Credit check/deduction failed",
            creditError,
            req,
            {
              shopDomain,
              tryonId,
            }
          );
          // Continue with generation but log the error
          // In production, you might want to block generation if credit check fails
        }
      }
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
      storeName: shopDomain || storeName,
      tryonId,
      duration: `${duration}ms`,
      hasResult: !!data,
      creditDeducted: !!creditDeductionResult,
    });

    // Return result with credit information
    res.json({
      ...data,
      creditInfo: creditDeductionResult
        ? {
            source: creditDeductionResult.source,
            creditsRemaining: creditDeductionResult.creditsRemaining,
          }
        : null,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error("[API] Try-on generation failed", error, req, {
      storeName: shopDomain || storeName,
      tryonId,
      duration: `${duration}ms`,
    });

    // Refund credit if deduction was successful but generation failed
    if (creditDeductionResult && creditDeductionResult.success && shopDomain) {
      try {
        const sessionToken = req.sessionToken;
        if (sessionToken) {
          const tokenResult = await shopify.auth.tokenExchange({
            shop: shopDomain,
            sessionToken,
            requestedTokenType: RequestedTokenType.OfflineAccessToken,
          });

          const session = tokenResult?.session;
          const accessToken = session?.accessToken || session?.access_token;

          if (session && accessToken) {
            const client = new shopify.clients.Graphql({
              session: {
                shop: session.shop || shopDomain,
                accessToken,
                scope: session.scope,
                isOnline: session.isOnline || false,
              },
            });

            const appInstallationQuery = `
              query GetAppInstallation {
                currentAppInstallation {
                  id
                }
              }
            `;
            const appInstallationResponse = await client.query({
              data: { query: appInstallationQuery },
            });
            const appInstallationId =
              appInstallationResponse?.body?.data?.appInstallation?.id;

            if (appInstallationId) {
              await creditDeduction.refundCredit(
                client,
                appInstallationId,
                shopDomain,
                tryonId,
                "Generation failed",
                creditDeductionResult.source
              );

              logger.info("[API] Credit refunded due to generation failure", {
                shopDomain,
                tryonId,
                source: creditDeductionResult.source,
              });
            }
          }
        }
      } catch (refundError) {
        logger.error("[API] Failed to refund credit", refundError, req, {
          shopDomain,
          tryonId,
        });
      }
    }

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