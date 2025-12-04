/**
 * Subscription Replacement Service
 * 
 * Handles replacing trial subscriptions with paid subscriptions
 * Called when trial ends (30 days OR 100 credits exhausted)
 */

import * as logger from "./logger.js";
import * as billing from "./billing.js";
import * as trialManager from "./trialManager.js";
import * as creditMetafield from "./creditMetafield.js";

/**
 * Replace trial subscription with paid subscription
 * This creates a new subscription without trial days and replaces the existing one
 * 
 * @param {Object} client - GraphQL client
 * @param {string} shopDomain - Shop domain
 * @param {string} currentSubscriptionId - Current trial subscription ID
 * @param {string} planHandle - Plan handle (pro-monthly or pro-annual)
 * @param {string} returnUrl - URL to redirect after approval
 * @param {boolean} isDemo - Whether this is a demo store
 * @returns {Object} { confirmationUrl, appSubscription }
 */
export const replaceTrialWithPaidSubscription = async (
  client,
  shopDomain,
  currentSubscriptionId,
  planHandle,
  returnUrl,
  isDemo = false
) => {
  try {
    const planConfig = billing.getPlan ? billing.getPlan(planHandle) : null;

    if (!planConfig) {
      throw new Error(`Invalid plan handle: ${planHandle}`);
    }

    logger.info("[SUBSCRIPTION_REPLACEMENT] Replacing trial subscription with paid", {
      shop: shopDomain,
      currentSubscriptionId,
      planHandle,
      planPrice: planConfig.price,
      planInterval: planConfig.interval,
    });

    const mutation = `
      mutation AppSubscriptionCreate(
        $name: String!
        $returnUrl: URL!
        $lineItems: [AppSubscriptionLineItemInput!]!
        $replacementBehavior: AppSubscriptionReplacementBehavior
        $test: Boolean
      ) {
        appSubscriptionCreate(
          name: $name
          returnUrl: $returnUrl
          lineItems: $lineItems
          replacementBehavior: $replacementBehavior
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

    // Build line items array
    const lineItems = [
      {
        plan: {
          appRecurringPricingDetails: lineItemPlan,
        },
      },
    ];

    // Only add usage pricing for monthly plans (EVERY_30_DAYS)
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
    }

    const variables = {
      name: planConfig.name,
      returnUrl,
      lineItems,
      replacementBehavior: "APPLY_IMMEDIATELY", // Immediately replace trial subscription
      // NO trialDays - this is a paid subscription
      test: isDemo,
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
      const errorMessages = userErrors.map(e => e.message).join(", ");
      throw new Error(`Failed to replace subscription: ${errorMessages}`);
    }

    if (!payload.confirmationUrl) {
      throw new Error("Missing confirmationUrl in subscription response");
    }

    logger.info("[SUBSCRIPTION_REPLACEMENT] Trial replacement subscription created", {
      shop: shopDomain,
      newSubscriptionId: payload.appSubscription?.id,
      confirmationUrl: payload.confirmationUrl,
      status: payload.appSubscription?.status,
      note: "Merchant must approve the new subscription",
    });

    return {
      confirmationUrl: payload.confirmationUrl,
      appSubscription: payload.appSubscription,
      plan: planConfig,
    };
  } catch (error) {
    logger.error("[SUBSCRIPTION_REPLACEMENT] Failed to replace trial subscription", error, null, {
      shop: shopDomain,
      currentSubscriptionId,
      planHandle,
    });
    throw error;
  }
};

/**
 * Check if trial should end and trigger replacement if needed
 * This should be called before credit deduction or periodically
 * 
 * @param {Object} client - GraphQL client
 * @param {string} shopDomain - Shop domain
 * @param {string} appInstallationId - App installation ID
 * @param {string} currentSubscriptionId - Current subscription ID
 * @param {string} planHandle - Plan handle
 * @param {string} returnUrl - URL to redirect after approval
 * @param {boolean} isDemo - Whether this is a demo store
 * @returns {Object|null} Replacement result or null if not needed
 */
export const checkAndReplaceTrialIfNeeded = async (
  client,
  shopDomain,
  appInstallationId,
  currentSubscriptionId,
  planHandle,
  returnUrl,
  isDemo = false
) => {
  try {
    // Check if subscription is in trial
    const isInTrial = await trialManager.isInTrialPeriod(client, appInstallationId);
    
    if (!isInTrial) {
      // Not in trial, no replacement needed
      return null;
    }

    // Check if trial should end
    const trialCheck = await trialManager.shouldEndTrial(client, appInstallationId);
    
    if (!trialCheck.shouldEnd) {
      // Trial still active, no replacement needed
      return null;
    }

    logger.info("[SUBSCRIPTION_REPLACEMENT] Trial should end, replacing subscription", {
      shop: shopDomain,
      reason: trialCheck.reason,
      currentSubscriptionId,
      planHandle,
    });

    // Replace trial subscription with paid subscription
    const replacementResult = await replaceTrialWithPaidSubscription(
      client,
      shopDomain,
      currentSubscriptionId,
      planHandle,
      returnUrl,
      isDemo
    );

    // Mark trial as ended in metafields (but don't add plan credits yet - wait for approval)
    // Plan credits will be added when subscription becomes ACTIVE (via webhook)
    await creditMetafield.batchUpdateMetafields(client, appInstallationId, {
      is_trial_period: false,
      // Note: Plan credits will be added to existing balance when subscription is approved (credits carry forward)
    });

    logger.info("[SUBSCRIPTION_REPLACEMENT] Trial replacement initiated", {
      shop: shopDomain,
      confirmationUrl: replacementResult.confirmationUrl,
      note: "Merchant must approve the new subscription",
    });

    return {
      replacementNeeded: true,
      confirmationUrl: replacementResult.confirmationUrl,
      reason: trialCheck.reason,
    };
  } catch (error) {
    logger.error("[SUBSCRIPTION_REPLACEMENT] Failed to check and replace trial", error, null, {
      shop: shopDomain,
      appInstallationId,
      currentSubscriptionId,
    });
    throw error;
  }
};

