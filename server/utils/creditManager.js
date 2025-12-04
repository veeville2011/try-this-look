/**
 * Hybrid Credit Manager
 * 
 * Main service for managing credits using hybrid approach
 * Coordinates between metafield and usage record systems
 */

import * as logger from "./logger.js";
import * as creditMetafield from "./creditMetafield.js";
import * as usageRecordService from "./usageRecordService.js";
import * as trialManager from "./trialManager.js";

/**
 * Get current credit balance
 */
export const getCreditBalance = async (client, appInstallationId) => {
  try {
    logger.info("[CREDIT_MANAGER] Getting credit balance from metafields", {
      appInstallationId,
    });

    const metafields = await creditMetafield.getCreditMetafields(client, appInstallationId);
    
    // Check if in trial period
    const isInTrial = await trialManager.isInTrialPeriod(client, appInstallationId);
    
    // Trial credits never expire - include them in total balance
    const trialCredits = metafields.trial_credits_balance ?? 0;
    const planCredits = metafields.plan_credits_balance ?? 0;
    const purchasedCredits = metafields.purchased_credits_balance ?? 0;
    const couponCredits = metafields.coupon_credits_balance ?? 0;
    
    // Total balance includes all credit types (trial credits never expire)
    const totalBalance = trialCredits + planCredits + purchasedCredits + couponCredits;
    
    let balance, included, used;
    
    if (isInTrial) {
      // During trial: show trial credits as primary, but total includes all credits
      balance = totalBalance; // Total available (trial + plan + purchased + coupon)
      included = 100; // Trial includes 100 credits
      used = metafields.trial_credits_used ?? 0;
    } else {
      // After trial: show plan credits, but trial credits still available (never expire)
      balance = totalBalance; // Total available (trial + plan + purchased + coupon)
      included = metafields.credits_included ?? 100;
      used = metafields.credits_used_this_period ?? 0;
    }

    logger.info("[CREDIT_MANAGER] Credit balance retrieved from metafields", {
      appInstallationId,
      isInTrial,
      balance,
      included,
      used,
      periodEnd: metafields.current_period_end,
      hasLastReset: !!metafields.last_credit_reset,
      hasSubscriptionLineItemId: !!metafields.subscription_line_item_id,
      metafieldKeysFound: Object.keys(metafields),
    });
    
    return {
      balance,
      included,
      used,
      periodEnd: metafields.current_period_end,
      lastReset: metafields.last_credit_reset,
      subscriptionLineItemId: metafields.subscription_line_item_id,
      isInTrial,
    };
  } catch (error) {
    logger.error("[CREDIT_MANAGER] Failed to get credit balance", error, null, {
      appInstallationId,
    });
    throw error;
  }
};

/**
 * Get total credits available (including usage capacity)
 */
export const getTotalCreditsAvailable = async (client, appInstallationId) => {
  try {
    logger.info("[CREDIT_MANAGER] Getting total credits available", {
      appInstallationId,
    });

    const balance = await getCreditBalance(client, appInstallationId);
    
    // If we have metafield balance, that's what's available
    if (balance.balance > 0) {
      logger.info("[CREDIT_MANAGER] Credits available from metafield balance", {
        appInstallationId,
        balance: balance.balance,
        included: balance.included,
        used: balance.used,
        isOverage: false,
      });

      return {
        ...balance,
        isOverage: false,
        totalAvailable: balance.balance,
      };
    }

    // If metafield is 0, check usage records capacity
    if (balance.subscriptionLineItemId) {
      logger.info("[CREDIT_MANAGER] Metafield balance is 0, checking usage records capacity", {
        appInstallationId,
        subscriptionLineItemId: balance.subscriptionLineItemId,
      });

      const usage = await usageRecordService.getCurrentUsage(
        client,
        balance.subscriptionLineItemId
      );

      const remainingCapacity = usage.cappedAmount 
        ? Math.max(0, usage.cappedAmount - usage.totalUsage)
        : null;

      logger.info("[CREDIT_MANAGER] Usage records capacity retrieved", {
        appInstallationId,
        isOverage: true,
        totalAvailable: 0,
        usageCapacity: remainingCapacity,
        currentUsage: usage.totalUsage,
        cappedAmount: usage.cappedAmount,
      });

      return {
        ...balance,
        isOverage: true,
        totalAvailable: 0, // No metafield credits left
        usageCapacity: remainingCapacity,
        currentUsage: usage.totalUsage,
        cappedAmount: usage.cappedAmount,
      };
    }

    logger.info("[CREDIT_MANAGER] No usage records available, returning metafield balance", {
      appInstallationId,
      balance: balance.balance,
      included: balance.included,
      used: balance.used,
      isOverage: false,
      note: balance.balance === 0 ? "Balance is 0 and no usage records found" : "Using metafield balance",
    });

    return {
      ...balance,
      isOverage: false,
      totalAvailable: balance.balance,
    };
  } catch (error) {
    logger.error("[CREDIT_MANAGER] Failed to get total credits available", error, null, {
      appInstallationId,
    });
    throw error;
  }
};

/**
 * Deduct credits (delegates to credit deduction service)
 */
export const deductCredit = async (client, appInstallationId, shopDomain, amount = 1, tryonId = null) => {
  const { deductCreditForTryOn } = await import("./creditDeduction.js");
  
  if (!tryonId) {
    tryonId = `tryon-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  }

  return await deductCreditForTryOn(client, appInstallationId, shopDomain, tryonId);
};

/**
 * Add credits to balance
 */
export const addCredits = async (client, appInstallationId, amount, source = "manual") => {
  try {
    // Determine credit type based on source
    let creditType = "plan"; // Default to plan credits
    if (source === "purchase" || source === "credit_package") {
      creditType = "purchased";
    } else if (source === "coupon" || source === "promo") {
      creditType = "coupon";
    }
    
    // Use the new addCreditsByType function
    const result = await creditMetafield.addCreditsByType(client, appInstallationId, amount, creditType);

    logger.info("[CREDIT_MANAGER] Credits added by type", {
      appInstallationId,
      amount,
      source,
      creditType,
      previousBalance: result.newTotal - amount,
      newBalance: result.newTotal,
      creditTypeBalances: result.creditTypeBalances,
    });

    return {
      success: true,
      amount,
      creditType,
      previousBalance: result.newTotal - amount,
      newBalance: result.newTotal,
      creditTypeBalances: result.creditTypeBalances,
    };
  } catch (error) {
    logger.error("[CREDIT_MANAGER] Failed to add credits", error);
    throw error;
  }
};

/**
 * Check if credits are available
 */
export const checkCreditAvailability = async (client, appInstallationId, required = 1) => {
  try {
    const total = await getTotalCreditsAvailable(client, appInstallationId);
    
    if (total.balance > 0) {
      return {
        available: total.balance >= required,
        remaining: total.balance,
        source: "metafield",
      };
    }

    // Check usage capacity if in overage
    if (total.isOverage && total.usageCapacity !== null) {
      // For usage records, we can create records up to capped amount
      // Each try-on costs $0.15, so we can calculate how many credits available
      const pricePerCredit = 0.15;
      const creditsAvailable = Math.floor(total.usageCapacity / pricePerCredit);
      
      return {
        available: creditsAvailable >= required,
        remaining: creditsAvailable,
        source: "usage_record",
        cappedAmount: total.cappedAmount,
      };
    }

    return {
      available: false,
      remaining: 0,
      source: "none",
    };
  } catch (error) {
    logger.error("[CREDIT_MANAGER] Failed to check credit availability", error);
    throw error;
  }
};

/**
 * Get credit source (metafield or usage records)
 */
export const getCreditSource = async (client, appInstallationId) => {
  try {
    const balance = await getCreditBalance(client, appInstallationId);
    
    if (balance.balance > 0) {
      return "metafield";
    }

    if (balance.subscriptionLineItemId) {
      return "usage_record";
    }

    return "none";
  } catch (error) {
    logger.error("[CREDIT_MANAGER] Failed to get credit source", error);
    throw error;
  }
};

