/**
 * Subscription Storage Utility
 * 
 * Stores subscription data in memory (in-memory cache)
 * For production, consider using a database (PostgreSQL, MongoDB, etc.)
 * 
 * This storage is populated by webhooks and used by the subscription status endpoint
 */

import * as logger from "./logger.js";
import { PLAN_HANDLES, getAvailablePlans, getPlan } from "./billing.js";

/**
 * In-memory subscription storage
 * Key: shop domain (e.g., "shop.myshopify.com")
 * Value: Subscription data object
 */
const subscriptionCache = new Map();

/**
 * Get subscription data from cache
 * @param {string} shopDomain - Shop domain
 * @returns {Object|null} Subscription data or null if not found
 */
export const getSubscription = (shopDomain) => {
  const normalizedShop = normalizeShopDomain(shopDomain);
  const cached = subscriptionCache.get(normalizedShop);
  
  if (cached) {
    logger.debug("[SUBSCRIPTION_STORAGE] Cache hit", {
      shop: normalizedShop,
      hasData: !!cached,
    });
    return cached;
  }
  
  logger.debug("[SUBSCRIPTION_STORAGE] Cache miss", {
    shop: normalizedShop,
  });
  return null;
};

/**
 * Store subscription data in cache
 * @param {string} shopDomain - Shop domain
 * @param {Object} subscriptionData - Subscription data from webhook or GraphQL
 */
export const setSubscription = (shopDomain, subscriptionData) => {
  const normalizedShop = normalizeShopDomain(shopDomain);
  
  logger.info("[SUBSCRIPTION_STORAGE] Storing subscription", {
    shop: normalizedShop,
    subscriptionId: subscriptionData?.subscription?.id,
    status: subscriptionData?.subscription?.status,
    planHandle: subscriptionData?.plan?.handle,
  });
  
  subscriptionCache.set(normalizedShop, {
    ...subscriptionData,
    updatedAt: new Date().toISOString(),
  });
};

/**
 * Remove subscription data from cache
 * @param {string} shopDomain - Shop domain
 */
export const removeSubscription = (shopDomain) => {
  const normalizedShop = normalizeShopDomain(shopDomain);
  
  logger.info("[SUBSCRIPTION_STORAGE] Removing subscription", {
    shop: normalizedShop,
  });
  
  subscriptionCache.delete(normalizedShop);
};

/**
 * Normalize shop domain to consistent format
 * @param {string} shopDomain - Shop domain (with or without .myshopify.com)
 * @returns {string} Normalized shop domain
 */
const normalizeShopDomain = (shopDomain) => {
  if (!shopDomain) return null;
  
  // Remove protocol if present
  let normalized = shopDomain.replace(/^https?:\/\//, "");
  
  // Add .myshopify.com if not present
  if (!normalized.includes(".myshopify.com")) {
    normalized = `${normalized}.myshopify.com`;
  }
  
  return normalized.toLowerCase();
};

/**
 * Get subscription status from cache only (Managed App Pricing approach)
 * Returns subscription data if found in cache, or null if not found
 * Subscription data is populated by webhooks (app/subscriptions/update)
 * 
 * @param {string} shopDomain - Shop domain
 * @returns {Object|null} Subscription status or null if not in cache
 */
export const getSubscriptionStatus = (shopDomain) => {
  if (!shopDomain) {
    throw new Error("Shop domain is required");
  }
  
  const cached = getSubscription(shopDomain);
  
  if (cached) {
    logger.info("[SUBSCRIPTION_STORAGE] Using cached subscription", {
      shop: shopDomain,
    });
    return cached;
  }
  
  // Cache miss - subscription data not yet received via webhook
  // This is expected for new installations or if webhook hasn't fired yet
  logger.warn("[SUBSCRIPTION_STORAGE] Cache miss - subscription data not available", {
    shop: shopDomain,
    note: "Subscription data will be available after webhook is received or GraphQL query",
  });
  
  // Return null to indicate no subscription data found
  // The API endpoint should query Shopify GraphQL API when this happens
  return null;
};

/**
 * Process webhook subscription data and store it
 * @param {Object} appSubscription - AppSubscription object from webhook
 * @param {string} shopDomain - Shop domain
 * @returns {Object} Processed subscription data
 */
export const processWebhookSubscription = (appSubscription, shopDomain) => {
  const normalizedShop = normalizeShopDomain(shopDomain);
  
  if (!appSubscription) {
    logger.warn("[SUBSCRIPTION_STORAGE] No subscription data in webhook", {
      shop: normalizedShop,
    });
    return null;
  }
  
  // Extract subscription details
  const subscriptionId = appSubscription.id;
  const status = appSubscription.status;
  const currentPeriodEnd = appSubscription.currentPeriodEnd;
  
  // Extract pricing details from line items
  const lineItem = appSubscription.lineItems?.[0];
  const pricingDetails = lineItem?.plan?.pricingDetails;
  
  let planHandle = null;
  let price = 0;
  let currencyCode = "EUR";
  let interval = "EVERY_30_DAYS";
  
  // Try to get plan handle from lineItem.plan if available
  // Note: Managed App Pricing webhooks may not include plan handle directly
  // We'll match by price and interval as fallback
  if (lineItem?.plan?.id || lineItem?.plan?.name) {
    // Log available plan identifiers for debugging
    logger.debug("[SUBSCRIPTION_STORAGE] Plan identifiers from webhook", {
      shop: normalizedShop,
      planId: lineItem?.plan?.id,
      planName: lineItem?.plan?.name,
    });
  }
  
  if (pricingDetails) {
    // Handle recurring pricing
    if (pricingDetails.price) {
      price = parseFloat(pricingDetails.price.amount);
      currencyCode = pricingDetails.price.currencyCode;
      interval = pricingDetails.interval;
      
      logger.debug("[SUBSCRIPTION_STORAGE] Matching plan by pricing", {
        shop: normalizedShop,
        price,
        currencyCode,
        interval,
      });
      
      // Match to plan by price and interval
      // This is the recommended approach for Managed App Pricing
      // since plan handles aren't directly provided in webhooks
      const plans = getAvailablePlans();
      let matchedPlan = null;
      
      // Normalize interval values for comparison
      // Shopify may send different interval formats
      const normalizeInterval = (int) => {
        if (!int) return int;
        const upper = int.toUpperCase();
        // Map various interval formats to standard ones
        if (upper === "ANNUAL" || upper === "YEAR" || upper === "EVERY_365_DAYS" || upper === "365_DAYS") {
          return "ANNUAL";
        }
        if (upper === "MONTHLY" || upper === "EVERY_30_DAYS" || upper === "30_DAYS") {
          return "EVERY_30_DAYS";
        }
        return int;
      };
      
      const normalizedInterval = normalizeInterval(interval);
      
      logger.debug("[SUBSCRIPTION_STORAGE] Attempting plan match", {
        shop: normalizedShop,
        price,
        currencyCode,
        originalInterval: interval,
        normalizedInterval,
        availablePlans: plans.map(p => ({ 
          handle: p.handle, 
          name: p.name,
          price: p.price, 
          interval: p.interval,
          currencyCode: p.currencyCode 
        })),
      });
      
      // First pass: exact match
      for (const plan of plans) {
        const priceMatches = Math.abs(plan.price - price) < 0.01;
        const planIntervalNormalized = normalizeInterval(plan.interval);
        const intervalMatches = planIntervalNormalized === normalizedInterval;
        const currencyMatches = plan.currencyCode === currencyCode;
        
        if (priceMatches && intervalMatches && currencyMatches) {
          planHandle = plan.handle;
          matchedPlan = plan;
          break;
        }
      }
      
      // Second pass: try with flexible interval matching
      if (!matchedPlan) {
        for (const plan of plans) {
          const priceMatches = Math.abs(plan.price - price) < 0.01;
          const planIntervalNormalized = normalizeInterval(plan.interval);
          const currencyMatches = plan.currencyCode === currencyCode;
          
          // Flexible interval matching for annual plans
          const isAnnual = normalizedInterval === "ANNUAL" || planIntervalNormalized === "ANNUAL";
          const intervalMatches = planIntervalNormalized === normalizedInterval || 
                                 (isAnnual && (normalizedInterval === "ANNUAL" || planIntervalNormalized === "ANNUAL"));
          
          if (priceMatches && intervalMatches && currencyMatches) {
            planHandle = plan.handle;
            matchedPlan = plan;
            logger.info("[SUBSCRIPTION_STORAGE] Plan matched with flexible interval matching", {
              shop: normalizedShop,
              planHandle,
              originalInterval: interval,
              planInterval: plan.interval,
            });
            break;
          }
        }
      }
      
      if (matchedPlan) {
        logger.info("[SUBSCRIPTION_STORAGE] Plan matched successfully", {
          shop: normalizedShop,
          planHandle,
          planName: matchedPlan.name,
          matchedPrice: price,
          matchedInterval: interval,
          planInterval: matchedPlan.interval,
        });
      } else {
        logger.warn("[SUBSCRIPTION_STORAGE] No plan match found", {
          shop: normalizedShop,
          price,
          currencyCode,
          interval,
          normalizedInterval,
          availablePlans: plans.map(p => ({ 
            handle: p.handle, 
            name: p.name,
            price: p.price, 
            interval: p.interval,
            currencyCode: p.currencyCode 
          })),
        });
      }
    }
  }
  
  // Determine if subscription is active
  const hasActiveSubscription = status === "ACTIVE";
  const isFree = planHandle === PLAN_HANDLES.FREE || !hasActiveSubscription;
  
  const plan = getPlan(planHandle) || getPlan(PLAN_HANDLES.FREE);
  
  const subscriptionData = {
    hasActiveSubscription,
    isFree,
    plan,
    subscription: hasActiveSubscription ? {
      id: subscriptionId,
      status,
      currentPeriodEnd,
    } : null,
  };
  
  // Store in cache
  setSubscription(normalizedShop, subscriptionData);
  
  logger.info("[SUBSCRIPTION_STORAGE] Processed webhook subscription", {
    shop: normalizedShop,
    subscriptionId,
    status,
    planHandle,
    hasActiveSubscription,
  });
  
  return subscriptionData;
};

/**
 * Clear all cached subscriptions (for testing/debugging)
 */
export const clearCache = () => {
  subscriptionCache.clear();
  logger.info("[SUBSCRIPTION_STORAGE] Cache cleared");
};

/**
 * Get cache statistics (for monitoring)
 */
export const getCacheStats = () => {
  return {
    size: subscriptionCache.size,
    keys: Array.from(subscriptionCache.keys()),
  };
};

