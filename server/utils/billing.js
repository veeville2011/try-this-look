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
  PRO_MONTHLY: "pro-monthly",
  PRO_ANNUAL: "pro-annual",
};

/**
 * Plan configuration
 * Define your pricing plans here
 */
export const PLANS = {
  [PLAN_HANDLES.PRO_MONTHLY]: {
    name: "Plan Standard",
    handle: PLAN_HANDLES.PRO_MONTHLY,
    price: 23.0,
    currencyCode: "USD",
    interval: "EVERY_30_DAYS",
    trialDays: 30,
    description:
      "100 crédits inclus avec possibilité de recharge après dépassement.",
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
  [PLAN_HANDLES.PRO_ANNUAL]: {
    name: "Plan Standard",
    handle: PLAN_HANDLES.PRO_ANNUAL,
    // $20/month or $180/year, 30-day trial
    price: 180.0,
    currencyCode: "USD",
    interval: "ANNUAL",
    trialDays: 30,
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

/**
 * Promotional codes configuration
 * Format: {
 *   "CODE": {
 *     type: "percentage" | "fixed",
 *     value: number, // percentage (0.1 = 10%) or fixed amount
 *     currencyCode: "USD", // only for fixed type
 *     durationLimitInIntervals: number | null, // null = indefinite
 *     validForIntervals: ["EVERY_30_DAYS", "ANNUAL"] | null, // null = all intervals
 *     active: boolean,
 *     description: string
 *   }
 * }
 * Note: All promo codes have been removed. Only coupon code WELCOME50 is available for credits.
 */
export const PROMO_CODES = {};

/**
 * Validate and get promotional code
 * @param {string} code - Promotional code
 * @param {string} interval - Plan interval (EVERY_30_DAYS or ANNUAL)
 * @returns {Object|null} Promo code config or null if invalid
 */
export const validatePromoCode = (code, interval) => {
  if (!code) return null;

  const promoCode = PROMO_CODES[code.toUpperCase()];
  if (!promoCode || !promoCode.active) return null;

  // Check if valid for this interval
  if (
    promoCode.validForIntervals &&
    !promoCode.validForIntervals.includes(interval)
  ) {
    return null;
  }

  return promoCode;
};

/**
 * Calculate discounted price
 * @param {number} originalPrice - Original plan price
 * @param {string} currencyCode - Currency code
 * @param {Object} promoCode - Promo code config from validatePromoCode
 * @returns {Object} { discountedPrice, discountValue, discountType }
 */
export const calculateDiscount = (originalPrice, currencyCode, promoCode) => {
  if (!promoCode) {
    return {
      discountedPrice: originalPrice,
      discountValue: null,
      discountType: null,
    };
  }

  if (promoCode.type === "percentage") {
    const discountAmount = originalPrice * promoCode.value;
    const discountedPrice = originalPrice - discountAmount;
    return {
      discountedPrice: Math.max(0, discountedPrice), // Ensure non-negative
      discountValue: promoCode.value, // percentage as decimal
      discountType: "percentage",
    };
  } else if (promoCode.type === "fixed") {
    const discountedPrice = originalPrice - promoCode.value;
    return {
      discountedPrice: Math.max(0, discountedPrice), // Ensure non-negative
      discountValue: promoCode.value, // fixed amount
      discountType: "fixed",
    };
  }

  return {
    discountedPrice: originalPrice,
    discountValue: null,
    discountType: null,
  };
};

/**
 * Credit Packages Configuration
 * Available credit packages for purchase
 */
export const CREDIT_PACKAGES = {
  SMALL: {
    id: "small",
    name: "50 Credits",
    credits: 50,
    price: 7.5,
    currencyCode: "USD",
    valuePerCredit: 0.15,
    recommended: false,
    description: "Perfect for testing",
  },
  MEDIUM: {
    id: "medium",
    name: "100 Credits",
    credits: 100,
    price: 15.0,
    currencyCode: "USD",
    valuePerCredit: 0.15,
    recommended: true,
    description: "Best value",
  },
  LARGE: {
    id: "large",
    name: "200 Credits",
    credits: 200,
    price: 30.0,
    currencyCode: "USD",
    valuePerCredit: 0.15,
    recommended: false,
    description: "For high-volume users",
  },
};

/**
 * Coupon Codes Configuration for Promotional Credits
 * These are different from subscription promo codes - they add credits directly
 * Works for both monthly and annual plans - adds credits in addition to plan credits
 */
export const COUPON_CODES = {
  WELCOME50: {
    code: "WELCOME50",
    credits: 50,
    type: "fixed",
    usageLimit: {
      perShop: 1,
      global: null, // Unlimited
    },
    expiresAt: null, // No expiration - works indefinitely
    active: true,
    description: "Welcome bonus - 50 free credits in addition to plan credits",
  },
};

/**
 * Usage Pricing Configuration
 * For overage billing after included credits
 */
export const USAGE_PRICING = {
  pricePerCredit: 0.15,
  currencyCode: "USD",
  cappedAmount: 50.0, // $50 per billing period
  terms: "$0.15 per try-on after included 100 credits",
  description: "Overage billing for try-on generations",
};
