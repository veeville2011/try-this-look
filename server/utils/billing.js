/**
 * Billing utility for Shopify app subscriptions
 *
 * This module now only contains plan configuration.
 * All subscription management is handled through Shopify Managed App Pricing:
 * - Plan selection: Redirects to Shopify's hosted pricing page
 * - Status checks: Query Shopify's GraphQL API for active subscriptions
 * - Cancellations: Redirects to Shopify admin UI
 *
 * GraphQL Billing API functions have been removed in favor of Managed App Pricing.
 */

/**
 * Plan handles configuration
 * These should match the plan handles created in Shopify Partners Dashboard
 */
export const PLAN_HANDLES = {
  PRO_ANNUAL: "pro-annual",
};

/**
 * Plan configuration
 * Define your pricing plans here
 */
export const PLANS = {
  [PLAN_HANDLES.PRO_ANNUAL]: {
    name: "Plan Standard",
    handle: PLAN_HANDLES.PRO_ANNUAL,
    // $20/month or $180/year, 15-day trial
    price: 180.0,
    currencyCode: "USD",
    interval: "ANNUAL",
    trialDays: 15,
    description:
      "100 crédits inclus avec possibilité de recharge après dépassement.",
    monthlyEquivalent: 20.0,
    features: [
      "100 crédits inclus",
      "(1 utilisation = 1 crédit)",
      "Recharge possible après dépassement.",
    ],
    limits: {
      includedCredits: 100,
      processingPriority: "standard",
    },
  },
};

/**
 * Get all available plans
 * @returns {Array} All available plans
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
