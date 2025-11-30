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
    trialDays: 15,
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
 */
export const PROMO_CODES = {
  WELCOME10: {
    type: "percentage",
    value: 0.1, // 10% off
    durationLimitInIntervals: 3, // First 3 billing cycles
    validForIntervals: null, // Valid for all intervals
    active: true,
    description: "10% off for first 3 months",
  },
  SAVE20: {
    type: "percentage",
    value: 0.2, // 20% off
    durationLimitInIntervals: null, // Indefinite
    validForIntervals: ["ANNUAL"], // Only for annual plans
    active: true,
    description: "20% off annual plans",
  },
  FLAT5: {
    type: "fixed",
    value: 5.0, // $5 off
    currencyCode: "USD",
    durationLimitInIntervals: 1, // First billing cycle only
    validForIntervals: null, // Valid for all intervals
    active: true,
    description: "$5 off first month",
  },
};

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
    price: 10.0,
    currencyCode: "USD",
    valuePerCredit: 0.2,
    recommended: false,
    description: "Perfect for testing",
  },
  MEDIUM: {
    id: "medium",
    name: "100 Credits",
    credits: 100,
    price: 18.0,
    currencyCode: "USD",
    valuePerCredit: 0.18,
    recommended: true,
    description: "Best value",
  },
  LARGE: {
    id: "large",
    name: "200 Credits",
    credits: 200,
    price: 32.0,
    currencyCode: "USD",
    valuePerCredit: 0.16,
    recommended: false,
    description: "For high-volume users",
  },
};

/**
 * Coupon Codes Configuration for Promotional Credits
 * These are different from subscription promo codes - they add credits directly
 */
export const COUPON_CODES = {
  WELCOME50: {
    code: "WELCOME50",
    credits: 50,
    type: "fixed",
    usageLimit: {
      perShop: 1,
      global: 1000,
    },
    expiresAt: "2024-12-31T23:59:59Z",
    active: true,
    description: "Welcome bonus - 50 free credits",
  },
  REFERRAL100: {
    code: "REFERRAL100",
    credits: 100,
    type: "fixed",
    usageLimit: {
      perShop: 1,
      global: null, // Unlimited
    },
    expiresAt: null, // No expiration
    active: true,
    description: "Referral bonus - 100 free credits",
  },
  HOLIDAY25: {
    code: "HOLIDAY25",
    credits: 25,
    type: "fixed",
    usageLimit: {
      perShop: 3,
      global: 5000,
    },
    expiresAt: "2024-12-25T23:59:59Z",
    active: true,
    description: "Holiday special - 25 credits (3 uses per shop)",
  },
};

/**
 * Usage Pricing Configuration
 * For overage billing after included credits
 */
export const USAGE_PRICING = {
  pricePerCredit: 0.2,
  currencyCode: "USD",
  cappedAmount: 50.0, // $50 per billing period
  terms: "$0.20 per try-on after included 100 credits",
  description: "Overage billing for try-on generations",
};
