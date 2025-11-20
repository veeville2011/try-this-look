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
  PRO_ANNUAL: "pro_annual",
};

/**
 * Plan configuration
 * Define your pricing plans here
 */
export const PLANS = {
  [PLAN_HANDLES.FREE]: {
    name: "Free Plan",
    handle: PLAN_HANDLES.FREE,
    price: 0,
    currencyCode: "USD",
    interval: "EVERY_30_DAYS",
    description: "Free plan with basic features",
    features: [
      "10 try-ons per month",
      "Standard processing",
      "Basic widget",
      "Community support",
    ],
    limits: {
      monthlyTryOns: 10,
      processingPriority: "standard",
    },
  },
  [PLAN_HANDLES.PRO]: {
    name: "Pro Plan (Monthly)",
    handle: PLAN_HANDLES.PRO,
    price: 20.0,
    currencyCode: "USD",
    interval: "EVERY_30_DAYS",
    description: "For serious e-commerce stores",
    features: [
      "Unlimited try-ons",
      "Priority processing",
      "Customizable widget",
      "API access",
      "Custom branding",
      "Priority support",
      "Advanced analytics",
    ],
  },
  [PLAN_HANDLES.PRO_ANNUAL]: {
    name: "Pro Plan (Annual)",
    handle: PLAN_HANDLES.PRO_ANNUAL,
    price: 180.0, // $15/month × 12 months
    currencyCode: "USD",
    interval: "ANNUAL",
    description: "For serious e-commerce stores - Save 25% with annual billing",
    monthlyEquivalent: 15.0, // For display purposes
    features: [
      "Unlimited try-ons",
      "Priority processing",
      "Customizable widget",
      "API access",
      "Custom branding",
      "Priority support",
      "Advanced analytics",
      "Save 25% compared to monthly billing",
    ],
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
  try {
    const plan = PLANS[planHandle];
    if (!plan) {
      throw new Error(`Invalid plan handle: ${planHandle}`);
    }

    // For free plan, we don't need to create a subscription
    if (planHandle === PLAN_HANDLES.FREE) {
      logger.info("[BILLING] Free plan - no subscription needed", {
        shop: session.shop,
        planHandle,
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

    const variables = {
      name: plan.name,
      lineItems: [
        {
          plan: {
            appRecurringPricingDetails: {
              price: {
                amount: plan.price,
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

    // Use shopify instance to make GraphQL request
    const client = new shopify.clients.Graphql({ session });

    const response = await client.query({
      data: {
        query: mutation,
        variables: variables,
      },
    });

    // Response structure: { body: { data: {...}, extensions: {...} } }
    const responseData = response.body?.data || response.data;

    if (responseData?.appSubscriptionCreate?.userErrors?.length > 0) {
      const errors = responseData.appSubscriptionCreate.userErrors;
      logger.error("[BILLING] Subscription creation errors", null, null, {
        shop: session.shop,
        planHandle,
        errors,
      });
      throw new Error(
        `Subscription creation failed: ${errors
          .map((e) => e.message)
          .join(", ")}`
      );
    }

    const subscription = responseData?.appSubscriptionCreate?.appSubscription;
    const confirmationUrl =
      responseData?.appSubscriptionCreate?.confirmationUrl;

    logger.info("[BILLING] Subscription created successfully", {
      shop: session.shop,
      planHandle,
      subscriptionId: subscription?.id,
    });

    return {
      success: true,
      subscription,
      confirmationUrl,
      plan: plan,
    };
  } catch (error) {
    logger.error("[BILLING] Failed to create subscription", error, null, {
      shop: session?.shop,
      planHandle,
    });
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

      // Match price and interval to plan (use tolerance for floating point comparison)
      for (const [handle, plan] of Object.entries(PLANS)) {
        // Compare prices with small tolerance for floating point precision
        // Also match interval to distinguish monthly vs annual
        if (
          Math.abs(plan.price - subscriptionPrice) < 0.01 &&
          plan.interval === subscriptionInterval
        ) {
          planHandle = handle;
          break;
        }
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
