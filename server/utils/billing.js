/**
 * Billing utility for Shopify app subscriptions
 * Handles subscription creation, checking, and management
 */

import * as logger from "./logger.js";

/**
 * Plan handles configuration
 * These should match the plan handles created in Shopify Partners Dashboard
 */
export const PLAN_HANDLES = {
  FREE: "free",
  PRO: "pro",
  PRO_ANNUAL: "pro-annual",
};

/**
 * Plan configuration
 * Define your pricing plans here
 */
export const PLANS = {
  [PLAN_HANDLES.FREE]: {
    name: "Plan Gratuit",
    handle: PLAN_HANDLES.FREE,
    price: 0,
    currencyCode: "EUR",
    interval: "EVERY_30_DAYS",
    description: "Parfait pour tester notre technologie",
    features: ["Essayage virtuel par IA", "Widget intégré facilement"],
    limits: {
      monthlyTryOns: 10,
      processingPriority: "standard",
    },
  },
  [PLAN_HANDLES.PRO]: {
    name: "Plan Pro (Mensuel)",
    handle: PLAN_HANDLES.PRO,
    price: 20.0,
    currencyCode: "EUR",
    interval: "EVERY_30_DAYS",
    description: "Solution complète pour booster vos ventes",
    features: [
      "Essayages illimités",
      "10 vidéos publicitaires/mois",
      "Personnalisation complète du widget",
    ],
    limits: {
      monthlyVideoGenerations: 10,
      processingPriority: "priority",
    },
  },
  [PLAN_HANDLES.PRO_ANNUAL]: {
    name: "Plan Pro (Annuel)",
    handle: PLAN_HANDLES.PRO_ANNUAL,
    price: 180.0, // 15 €/mois × 12 mois
    currencyCode: "EUR",
    interval: "ANNUAL",
    description: "Solution complète avec économie de 25%",
    monthlyEquivalent: 15.0, // Pour l'affichage
    features: [
      "Essayages illimités",
      "10 vidéos publicitaires/mois",
      "Personnalisation complète du widget",
      "Économisez 25%",
    ],
    limits: {
      monthlyVideoGenerations: 10,
      processingPriority: "priority",
    },
  },
};

/**
 * Create a subscription for a merchant
 * @param {Object} shopify - Shopify API instance
 * @param {Object} session - Shopify session object
 * @param {string} planHandle - Plan handle (e.g., 'free', 'pro', 'premium')
 * @param {string} returnUrl - URL to redirect after subscription approval
 * @param {number} trialDays - Optional trial days (default: 0)
 * @returns {Promise<Object>} Subscription creation result with confirmationUrl
 */
export const createSubscription = async (
  shopify,
  session,
  planHandle,
  returnUrl,
  trialDays = 0,
  replacementBehavior = "STANDARD"
) => {
  const startTime = Date.now();
  const operationId = `billing-${Date.now()}-${Math.random()
    .toString(36)
    .substr(2, 9)}`;

  try {
    logger.info("[BILLING] [CREATE] Starting subscription creation", {
      operationId,
      shop: session.shop,
      planHandle,
      returnUrl,
      trialDays,
      replacementBehavior,
      timestamp: new Date().toISOString(),
    });

    const plan = PLANS[planHandle];

    logger.info("[BILLING] [CREATE] Plan lookup", {
      operationId,
      planHandle,
      planFound: !!plan,
      planName: plan?.name || "N/A",
      planPrice: plan?.price || "N/A",
    });

    if (!plan) {
      logger.error("[BILLING] [CREATE] Invalid plan handle", {
        operationId,
        planHandle,
        availablePlans: Object.keys(PLANS),
      });
      throw new Error(`Invalid plan handle: ${planHandle}`);
    }

    // For free plan, we don't need to create a subscription
    if (planHandle === PLAN_HANDLES.FREE) {
      logger.info("[BILLING] [CREATE] Free plan - no subscription needed", {
        operationId,
        shop: session.shop,
        planHandle,
        planName: plan.name,
      });
      return {
        success: true,
        isFree: true,
        plan: plan,
      };
    }

    // Get GraphQL client from shopify instance
    // Note: session needs to be passed with shopify instance
    // For now, we'll use the shopify instance directly
    // This requires the shopify instance to be passed or imported

    logger.info("[BILLING] [CREATE] Preparing GraphQL mutation", {
      operationId,
      shop: session.shop,
      planHandle,
      planName: plan.name,
      planPrice: plan.price,
      planCurrency: plan.currencyCode,
      planInterval: plan.interval,
    });

    // GraphQL mutation for creating subscription
    const mutation = `
      mutation appSubscriptionCreate($name: String!, $lineItems: [AppSubscriptionLineItemInput!]!, $returnUrl: URL!, $trialDays: Int, $replacementBehavior: AppSubscriptionReplacementBehavior) {
        appSubscriptionCreate(
          name: $name
          lineItems: $lineItems
          returnUrl: $returnUrl
          trialDays: $trialDays
          replacementBehavior: $replacementBehavior
        ) {
          appSubscription {
            id
            name
            status
            currentPeriodEnd
          }
          confirmationUrl
          userErrors {
            field
            message
          }
        }
      }
    `;

    // Validate interval enum value
    const validIntervals = ["EVERY_30_DAYS", "ANNUAL"];
    if (!validIntervals.includes(plan.interval)) {
      logger.error("[BILLING] [CREATE] Invalid interval value", {
        operationId,
        planHandle,
        interval: plan.interval,
        validIntervals,
      });
      throw new Error(
        `Invalid interval: ${
          plan.interval
        }. Valid values: ${validIntervals.join(", ")}`
      );
    }

    // Ensure price is a number (Decimal type accepts both, but examples show numbers)
    // Shopify GraphQL Decimal type accepts both number and string, but examples use numbers
    let priceAmount;
    if (typeof plan.price === "number") {
      priceAmount = parseFloat(plan.price.toFixed(2));
    } else {
      priceAmount = parseFloat(plan.price);
    }

    // Validate price is a valid number
    if (isNaN(priceAmount) || priceAmount < 0) {
      logger.error("[BILLING] [CREATE] Invalid price value", {
        operationId,
        planHandle,
        originalPrice: plan.price,
        priceType: typeof plan.price,
        parsedPrice: priceAmount,
      });
      throw new Error(
        `Invalid price value: ${plan.price}. Price must be a valid positive number.`
      );
    }

    // Validate returnUrl is a valid URL
    try {
      new URL(returnUrl);
    } catch (urlError) {
      logger.error("[BILLING] [CREATE] Invalid returnUrl", {
        operationId,
        returnUrl,
        error: urlError.message,
      });
      throw new Error(`Invalid returnUrl: ${returnUrl}`);
    }

    const variables = {
      name: plan.name,
      lineItems: [
        {
          plan: {
            appRecurringPricingDetails: {
              price: {
                amount: priceAmount,
                currencyCode: plan.currencyCode,
              },
              interval: plan.interval,
            },
          },
        },
      ],
      returnUrl: returnUrl,
      ...(trialDays > 0 && { trialDays }),
      replacementBehavior: replacementBehavior,
    };

    logger.info("[BILLING] [CREATE] Variables prepared with price conversion", {
      operationId,
      originalPrice: plan.price,
      priceType: typeof plan.price,
      convertedPrice: priceAmount,
      priceCurrency: plan.currencyCode,
      interval: plan.interval,
    });

    logger.info("[BILLING] [CREATE] GraphQL variables prepared", {
      operationId,
      variables: {
        name: variables.name,
        returnUrl: variables.returnUrl,
        trialDays: variables.trialDays || 0,
        replacementBehavior: variables.replacementBehavior,
        lineItemsCount: variables.lineItems.length,
        price:
          variables.lineItems[0].plan.appRecurringPricingDetails.price.amount,
        priceType:
          typeof variables.lineItems[0].plan.appRecurringPricingDetails.price
            .amount,
        currency:
          variables.lineItems[0].plan.appRecurringPricingDetails.price
            .currencyCode,
        interval:
          variables.lineItems[0].plan.appRecurringPricingDetails.interval,
      },
      fullVariablesJSON: JSON.stringify(variables, null, 2),
    });

    // Validate session before creating GraphQL client
    if (!session || !session.shop) {
      logger.error(
        "[BILLING] [CREATE] Invalid session - missing shop",
        null,
        null,
        {
          operationId,
          hasSession: !!session,
          sessionShop: session?.shop || "missing",
        }
      );
      throw new Error("Invalid session: shop is required");
    }

    if (!session.accessToken) {
      logger.error(
        "[BILLING] [CREATE] Invalid session - missing access token",
        null,
        null,
        {
          operationId,
          shop: session.shop,
          hasAccessToken: !!session.accessToken,
          sessionId: session.id || "N/A",
        }
      );
      throw new Error(
        "Invalid session: access token is required. Please re-authenticate the app."
      );
    }

    // Use shopify instance to make GraphQL request
    logger.info("[BILLING] [CREATE] Creating GraphQL client", {
      operationId,
      shop: session.shop,
      hasSession: !!session,
      sessionId: session.id || "N/A",
      accessToken: session.accessToken ? "present" : "missing",
      accessTokenLength: session.accessToken?.length || 0,
    });

    const clientTimer = logger.createTimer(
      `[BILLING] [CREATE] GraphQL Client Creation`
    );
    let client;
    try {
      // Create GraphQL client with session
      // Note: The Shopify client doesn't support timeout in constructor,
      // so we'll handle timeout via Promise.race
      client = new shopify.clients.Graphql({ session });
      clientTimer.log("GraphQL client created", {
        operationId,
        shop: session.shop,
      });
    } catch (clientError) {
      clientTimer.log("GraphQL client creation failed", {
        operationId,
        shop: session.shop,
        error: clientError.message,
      });
      logger.error(
        "[BILLING] [CREATE] Failed to create GraphQL client",
        clientError,
        null,
        {
          operationId,
          shop: session.shop,
        }
      );
      throw new Error(
        `Failed to create GraphQL client: ${clientError.message}`
      );
    }

    // Add timeout handling for GraphQL request (15 seconds max to fail faster)
    // Reduced from 20s to 15s to fail faster and identify issues sooner
    // Vercel has 60s max, but we want to fail fast and leave time for error handling
    const timeoutMs = 15000;
    let timeoutId = null;
    let isTimedOut = false;

    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        isTimedOut = true;
        logger.error("[BILLING] [CREATE] GraphQL request timeout", {
          operationId,
          shop: session.shop,
          timeoutMs,
          elapsed: `${Date.now() - startTime}ms`,
          note: "Request is taking too long - this may indicate Shopify API issues or network problems",
        });
        reject(new Error("GraphQL request timed out after 15 seconds"));
      }, timeoutMs);
    });

    logger.info("[BILLING] [CREATE] Initiating GraphQL request", {
      operationId,
      shop: session.shop,
      timeoutMs,
      mutation: "appSubscriptionCreate",
      variablesPreview: {
        name: variables.name,
        returnUrl: variables.returnUrl?.substring(0, 100),
        trialDays: variables.trialDays,
        replacementBehavior: variables.replacementBehavior,
        price:
          variables.lineItems[0]?.plan?.appRecurringPricingDetails?.price
            ?.amount,
        currency:
          variables.lineItems[0]?.plan?.appRecurringPricingDetails?.price
            ?.currencyCode,
        interval:
          variables.lineItems[0]?.plan?.appRecurringPricingDetails?.interval,
      },
    });

    const graphqlTimer = logger.createTimer(
      `[BILLING] [CREATE] GraphQL Request`
    );
    let queryPromise;

    try {
      logger.info("[BILLING] [CREATE] Preparing GraphQL query", {
        operationId,
        shop: session.shop,
        mutationLength: mutation.length,
        variablesKeys: Object.keys(variables),
      });

      // Create the query promise with error handling
      queryPromise = client
        .query({
          data: {
            query: mutation,
            variables: variables,
          },
        })
        .catch((error) => {
          // If timeout already occurred, don't log this error
          if (isTimedOut) {
            throw new Error("GraphQL request timed out after 15 seconds");
          }
          throw error;
        });

      logger.info("[BILLING] [CREATE] GraphQL query promise created", {
        operationId,
        shop: session.shop,
        promiseType: typeof queryPromise,
        hasThen: typeof queryPromise?.then === "function",
        isPromise: queryPromise instanceof Promise,
      });
    } catch (queryError) {
      if (timeoutId) clearTimeout(timeoutId);
      logger.error(
        "[BILLING] [CREATE] Failed to create GraphQL query promise",
        queryError,
        null,
        {
          operationId,
          shop: session.shop,
          errorType: queryError.constructor.name,
          errorCode: queryError.code,
          errorMessage: queryError.message,
        }
      );
      throw new Error(`Failed to create GraphQL query: ${queryError.message}`);
    }

    let response;
    try {
      logger.info(
        "[BILLING] [CREATE] Waiting for GraphQL response (Promise.race with 15s timeout)",
        {
          operationId,
          shop: session.shop,
          timeoutMs,
        }
      );

      // Use Promise.race to enforce timeout
      // Note: The underlying HTTP request may continue, but we'll reject the promise
      response = await Promise.race([queryPromise, timeoutPromise]);

      // Clear timeout if request completed
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }

      const graphqlDuration = graphqlTimer.elapsed();
      graphqlTimer.log("GraphQL request completed", {
        operationId,
        shop: session.shop,
        hasResponse: !!response,
        responseType: typeof response,
      });

      // Log GraphQL operation details
      logger.logGraphQL(
        "appSubscriptionCreate",
        variables,
        response,
        graphqlDuration,
        {
          operationId,
          shop: session.shop,
        }
      );
    } catch (raceError) {
      // Clear timeout if it was the timeout that won
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }

      const graphqlDuration = graphqlTimer.elapsed();
      logger.error(
        "[BILLING] [CREATE] GraphQL request failed",
        raceError,
        null,
        {
          operationId,
          shop: session.shop,
          duration: `${graphqlDuration}ms`,
          isTimeout:
            raceError.message.includes("timeout") ||
            raceError.message.includes("timed out"),
          errorCode: raceError.code,
        }
      );
      throw raceError;
    }

    const graphqlDuration = graphqlTimer.elapsed();

    // Response parsing is already logged above, continue with extraction

    // Response structure: { body: { data: {...}, extensions: {...} } }
    const parseTimer = logger.createTimer(
      `[BILLING] [CREATE] Response Parsing`
    );

    logger.info("[BILLING] [CREATE] Parsing GraphQL response structure", {
      operationId,
      shop: session.shop,
      hasResponse: !!response,
      hasResponseBody: !!response.body,
      hasResponseData: !!response.data,
      responseKeys: response ? Object.keys(response) : [],
      bodyKeys: response?.body ? Object.keys(response.body) : [],
    });

    const responseData = response.body?.data || response.data;

    parseTimer.log("Response data extracted", {
      operationId,
      shop: session.shop,
      hasResponseData: !!responseData,
      hasAppSubscriptionCreate: !!responseData?.appSubscriptionCreate,
      hasUserErrors: !!responseData?.appSubscriptionCreate?.userErrors,
      userErrorsCount:
        responseData?.appSubscriptionCreate?.userErrors?.length || 0,
      responseDataKeys: responseData ? Object.keys(responseData) : [],
    });

    // Log full response structure for debugging (truncated)
    if (responseData) {
      try {
        const responseStr = JSON.stringify(responseData);
        logger.debug("[BILLING] [CREATE] Full response data", {
          operationId,
          shop: session.shop,
          responsePreview: responseStr.substring(0, 1000),
          responseLength: responseStr.length,
        });
      } catch (e) {
        logger.warn(
          "[BILLING] [CREATE] Could not serialize response for logging",
          {
            operationId,
            shop: session.shop,
            error: e.message,
          }
        );
      }
    }

    if (responseData?.appSubscriptionCreate?.userErrors?.length > 0) {
      const errors = responseData.appSubscriptionCreate.userErrors;
      logger.error(
        "[BILLING] [CREATE] GraphQL user errors returned",
        null,
        null,
        {
          operationId,
          shop: session.shop,
          planHandle,
          errors: errors.map((e) => ({ field: e.field, message: e.message })),
          errorsCount: errors.length,
          fullErrors: errors,
        }
      );
      throw new Error(
        `Subscription creation failed: ${errors
          .map((e) => `${e.field ? `${e.field}: ` : ""}${e.message}`)
          .join(", ")}`
      );
    }

    // Check for GraphQL errors (different from userErrors)
    if (response.body?.errors || response.errors) {
      const graphqlErrors = response.body?.errors || response.errors;
      logger.error(
        "[BILLING] [CREATE] GraphQL API errors returned",
        null,
        null,
        {
          operationId,
          shop: session.shop,
          planHandle,
          errors: graphqlErrors,
          errorsCount: graphqlErrors.length,
        }
      );
      throw new Error(
        `GraphQL API error: ${graphqlErrors
          .map((e) => e.message || JSON.stringify(e))
          .join(", ")}`
      );
    }

    const subscription = responseData?.appSubscriptionCreate?.appSubscription;
    const confirmationUrl =
      responseData?.appSubscriptionCreate?.confirmationUrl;

    logger.info("[BILLING] [CREATE] Subscription data extracted", {
      operationId,
      shop: session.shop,
      hasSubscription: !!subscription,
      subscriptionId: subscription?.id || "N/A",
      subscriptionName: subscription?.name || "N/A",
      subscriptionStatus: subscription?.status || "N/A",
      hasConfirmationUrl: !!confirmationUrl,
      confirmationUrlLength: confirmationUrl?.length || 0,
    });

    // Validate that confirmationUrl exists for paid plans
    if (!confirmationUrl) {
      logger.error(
        "[BILLING] [CREATE] Missing confirmationUrl in response",
        null,
        null,
        {
          operationId,
          shop: session.shop,
          planHandle,
          responseData: JSON.stringify(responseData).substring(0, 500),
          hasSubscription: !!subscription,
          subscriptionId: subscription?.id || "N/A",
        }
      );
      throw new Error(
        "Subscription creation succeeded but no confirmation URL was returned. Please try again."
      );
    }

    const totalDuration = Date.now() - startTime;
    logger.info("[BILLING] [CREATE] Subscription created successfully", {
      operationId,
      shop: session.shop,
      planHandle,
      subscriptionId: subscription?.id,
      subscriptionName: subscription?.name,
      subscriptionStatus: subscription?.status,
      hasConfirmationUrl: !!confirmationUrl,
      confirmationUrlPreview: confirmationUrl.substring(0, 100) + "...",
      totalDuration: `${totalDuration}ms`,
    });

    return {
      success: true,
      subscription,
      confirmationUrl,
      plan: plan,
    };
  } catch (error) {
    const totalDuration = Date.now() - startTime;

    logger.error(
      "[BILLING] [CREATE] Subscription creation failed",
      error,
      null,
      {
        operationId: operationId || "unknown",
        shop: session?.shop || "unknown",
        planHandle: planHandle || "unknown",
        errorMessage: error.message,
        errorType: error.constructor.name,
        errorCode: error.code,
        errorStack: error.stack,
        totalDuration: `${totalDuration}ms`,
        isTimeout:
          error.message.includes("timeout") ||
          error.message.includes("timed out"),
      }
    );

    // Provide more specific error messages
    if (
      error.message.includes("timeout") ||
      error.message.includes("timed out")
    ) {
      logger.error("[BILLING] [CREATE] Timeout error detected", null, null, {
        operationId,
        shop: session?.shop,
        planHandle,
        duration: `${totalDuration}ms`,
      });
      throw new Error(
        "The subscription request took too long to process. Please try again. If the issue persists, check your Shopify connection."
      );
    }

    throw error;
  }
};

/**
 * Check if merchant has an active subscription
 * @param {Object} shopify - Shopify API instance
 * @param {Object} session - Shopify session object
 * @param {string[]} allowedPlans - Array of plan handles that are allowed (optional)
 * @returns {Promise<Object>} Subscription status and details
 */
export const checkSubscription = async (
  shopify,
  session,
  allowedPlans = null
) => {
  try {
    // GraphQL query to get current subscription
    const query = `
      query {
        currentAppInstallation {
          activeSubscriptions {
            id
            name
            status
            currentPeriodEnd
            lineItems {
              id
              plan {
                pricingDetails {
                  ... on AppRecurringPricing {
                    interval
                    price {
                      amount
                      currencyCode
                    }
                  }
                  ... on AppUsagePricing {
                    cappedAmount {
                      amount
                      currencyCode
                    }
                    terms
                  }
                }
              }
            }
          }
        }
      }
    `;

    const client = new shopify.clients.Graphql({ session });
    const response = await client.query({
      data: {
        query: query,
      },
    });

    // Response structure: { body: { data: {...}, extensions: {...} } }
    const responseData = response.body?.data || response.data;

    const activeSubscriptions =
      responseData?.currentAppInstallation?.activeSubscriptions || [];

    // If no active subscriptions, merchant is on free plan
    if (activeSubscriptions.length === 0) {
      logger.info("[BILLING] No active subscription - free plan", {
        shop: session.shop,
      });
      return {
        hasActiveSubscription: false,
        isFree: true,
        plan: PLANS[PLAN_HANDLES.FREE],
        subscription: null,
      };
    }

    // Get the first active subscription (apps typically have one subscription)
    const subscription = activeSubscriptions[0];

    // Determine plan handle based on subscription price
    let planHandle = PLAN_HANDLES.FREE;
    const pricingDetails = subscription.lineItems?.[0]?.plan?.pricingDetails;

    // Check if it's recurring pricing (not usage-based)
    if (pricingDetails?.price?.amount) {
      const subscriptionPrice = parseFloat(pricingDetails.price.amount);
      const subscriptionInterval = pricingDetails.interval;

      // Match price, interval, and currency to plan (use tolerance for floating point comparison)
      for (const [handle, plan] of Object.entries(PLANS)) {
        // Compare prices with small tolerance for floating point precision
        // Also match interval to distinguish monthly vs annual
        // Match currency to ensure correct plan identification
        const priceMatches = Math.abs(plan.price - subscriptionPrice) < 0.01;
        const intervalMatches = plan.interval === subscriptionInterval;
        const currencyMatches =
          plan.currencyCode === pricingDetails.price?.currencyCode;

        if (priceMatches && intervalMatches && currencyMatches) {
          planHandle = handle;
          break;
        }
      }

      // Log if plan wasn't matched (for debugging)
      if (planHandle === PLAN_HANDLES.FREE && subscriptionPrice > 0) {
        logger.warn("[BILLING] [CHECK] Subscription plan not matched", {
          operationId,
          shop: session.shop,
          subscriptionPrice,
          subscriptionInterval,
          subscriptionCurrency: pricingDetails.price?.currencyCode,
          availablePlans: Object.keys(PLANS),
        });
      }
    }

    // Check if plan is allowed
    if (allowedPlans && !allowedPlans.includes(planHandle)) {
      logger.warn("[BILLING] Plan not allowed", {
        shop: session.shop,
        planHandle,
        allowedPlans,
      });
      return {
        hasActiveSubscription: true,
        isFree: false,
        plan: PLANS[planHandle],
        subscription,
        allowed: false,
      };
    }

    logger.info("[BILLING] Active subscription found", {
      shop: session.shop,
      planHandle,
      subscriptionId: subscription.id,
      status: subscription.status,
    });

    return {
      hasActiveSubscription: true,
      isFree: false,
      plan: PLANS[planHandle] || PLANS[PLAN_HANDLES.FREE],
      subscription,
      allowed: true,
    };
  } catch (error) {
    logger.error("[BILLING] Failed to check subscription", error, null, {
      shop: session?.shop,
    });
    // On error, default to free plan
    return {
      hasActiveSubscription: false,
      isFree: true,
      plan: PLANS[PLAN_HANDLES.FREE],
      subscription: null,
      error: error.message,
    };
  }
};

/**
 * Require subscription - checks if merchant has active subscription
 * Returns subscription info or throws error if not allowed
 * @param {Object} shopify - Shopify API instance
 * @param {Object} session - Shopify session object
 * @param {string[]} allowedPlans - Array of plan handles that are allowed
 * @returns {Promise<Object>} Subscription details
 */
export const requireSubscription = async (shopify, session, allowedPlans) => {
  const subscriptionStatus = await checkSubscription(
    shopify,
    session,
    allowedPlans
  );

  if (
    !subscriptionStatus.hasActiveSubscription ||
    !subscriptionStatus.allowed
  ) {
    throw new Error(
      `Subscription required. Allowed plans: ${allowedPlans.join(", ")}`
    );
  }

  return subscriptionStatus;
};

/**
 * Get all available plans
 * @returns {Object} All available plans
 */
export const getAvailablePlans = () => {
  return Object.values(PLANS);
};

/**
 * Get plan by handle
 * @param {string} planHandle - Plan handle
 * @returns {Object|null} Plan configuration or null
 */
export const getPlan = (planHandle) => {
  return PLANS[planHandle] || null;
};

/**
 * Cancel an active subscription
 * @param {Object} shopify - Shopify API instance
 * @param {Object} session - Shopify session object
 * @param {boolean} prorate - Whether to issue prorated credits
 * @returns {Promise<Object>} Cancellation result
 */
export const cancelSubscription = async (shopify, session, prorate = false) => {
  try {
    // First, get current subscription
    const subscriptionStatus = await checkSubscription(shopify, session);

    if (!subscriptionStatus.hasActiveSubscription) {
      throw new Error("No active subscription to cancel");
    }

    const subscriptionId = subscriptionStatus.subscription.id;

    // GraphQL mutation for canceling subscription
    const mutation = `
      mutation appSubscriptionCancel($id: ID!, $prorate: Boolean!) {
        appSubscriptionCancel(id: $id, prorate: $prorate) {
          appSubscription {
            id
            status
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const client = new shopify.clients.Graphql({ session });
    const response = await client.query({
      data: {
        query: mutation,
        variables: {
          id: subscriptionId,
          prorate: prorate,
        },
      },
    });

    const responseData = response.body?.data || response.data;

    if (responseData?.appSubscriptionCancel?.userErrors?.length > 0) {
      const errors = responseData.appSubscriptionCancel.userErrors;
      logger.error("[BILLING] Subscription cancellation errors", null, null, {
        shop: session.shop,
        errors,
      });
      throw new Error(
        `Subscription cancellation failed: ${errors
          .map((e) => e.message)
          .join(", ")}`
      );
    }

    logger.info("[BILLING] Subscription cancelled successfully", {
      shop: session.shop,
      subscriptionId,
      prorate,
    });

    return {
      success: true,
      subscription: responseData?.appSubscriptionCancel?.appSubscription,
    };
  } catch (error) {
    logger.error("[BILLING] Failed to cancel subscription", error, null, {
      shop: session?.shop,
    });
    throw error;
  }
};

/**
 * Change subscription plan (upgrade or downgrade)
 * @param {Object} shopify - Shopify API instance
 * @param {Object} session - Shopify session object
 * @param {string} newPlanHandle - New plan handle
 * @param {string} returnUrl - URL to redirect after approval
 * @param {string} replacementBehavior - How to handle existing subscription
 *   Valid values: "STANDARD" (default), "APPLY_IMMEDIATELY", "APPLY_ON_NEXT_BILLING_CYCLE"
 * @returns {Promise<Object>} New subscription creation result
 */
/**
 * Change subscription plan
 * @deprecated This function is deprecated. The app now uses Shopify Managed App Pricing.
 * Merchants are redirected to Shopify's plan selection page to change plans.
 * This function is kept for backward compatibility but should not be used in new code.
 */
export const changePlan = async (
  shopify,
  session,
  newPlanHandle,
  returnUrl,
  replacementBehavior = "STANDARD"
) => {
  try {
    // Check if merchant has active subscription
    const currentStatus = await checkSubscription(shopify, session);

    // Shopify automatically handles subscription replacement when creating a new one
    // The replacementBehavior parameter controls when the new subscription takes effect:
    // - STANDARD: Default behavior with automatic proration and deferral logic
    // - APPLY_IMMEDIATELY: Cancel current subscription immediately and apply new one
    // - APPLY_ON_NEXT_BILLING_CYCLE: Defer until current billing cycle ends

    // Create new subscription with replacement behavior
    const result = await createSubscription(
      shopify,
      session,
      newPlanHandle,
      returnUrl,
      0, // No trial for plan changes
      replacementBehavior
    );

    return result;
  } catch (error) {
    logger.error("[BILLING] Failed to change plan", error, null, {
      shop: session?.shop,
      newPlanHandle,
    });
    throw error;
  }
};
