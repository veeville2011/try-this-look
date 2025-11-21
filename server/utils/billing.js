/**
 * Billing utility for Shopify app subscriptions
 *
 * This module now only contains plan configuration.
 * All subscription management is handled through Shopify Managed App Pricing:
 * - Plan selection: Redirects to Shopify's hosted pricing page
 * - Status checks: Uses subscriptionStorage (populated by webhooks)
 * - Cancellations: Redirects to Shopify admin UI
 *
 * GraphQL Billing API functions have been removed in favor of Managed App Pricing.
 */

/**
 * Plan handles configuration
 * These should match the plan handles created in Shopify Partners Dashboard
 */
export const PLAN_HANDLES = {
  FREE: "free",
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
