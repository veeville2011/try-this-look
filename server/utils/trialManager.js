/**
 * Trial Management Service
 * 
 * Handles trial period logic:
 * - 100 free trial credits (separate from plan credits)
 * - Trial credits NEVER EXPIRE and carry forward indefinitely
 * - Trial ends when: 30 days pass OR 100 credits exhausted (whichever comes first)
 * - When trial ends, replace subscription with paid version and add 100 plan credits (credits carry forward)
 * - Trial credits remain usable even after trial period ends
 */

import * as logger from "./logger.js";
import * as creditMetafield from "./creditMetafield.js";

const TRIAL_CREDITS = 100;
const TRIAL_DAYS = 30;

/**
 * Check if subscription is currently in trial period
 */
export const isInTrialPeriod = async (client, appInstallationId) => {
  try {
    const metafields = await creditMetafield.getCreditMetafields(client, appInstallationId);
    const isTrial = metafields.is_trial_period === true || metafields.is_trial_period === "true";
    
    // Also check if trial start date exists and is within 30 days
    if (metafields.trial_start_date) {
      const trialStart = new Date(metafields.trial_start_date);
      const now = new Date();
      const daysSinceTrialStart = Math.floor((now - trialStart) / (1000 * 60 * 60 * 24));
      
      if (daysSinceTrialStart >= TRIAL_DAYS) {
        // Trial period expired by time
        return false;
      }
      
      // Check if trial credits are exhausted
      const trialCreditsUsed = metafields.trial_credits_used || 0;
      if (trialCreditsUsed >= TRIAL_CREDITS) {
        // Trial credits exhausted
        return false;
      }
      
      return true;
    }
    
    return isTrial;
  } catch (error) {
    logger.error("[TRIAL_MANAGER] Failed to check trial period status", error);
    return false;
  }
};

/**
 * Check if trial should end (either condition met)
 * Returns: { shouldEnd: boolean, reason: string }
 */
export const shouldEndTrial = async (client, appInstallationId) => {
  try {
    const metafields = await creditMetafield.getCreditMetafields(client, appInstallationId);
    
    // Check if already marked as not in trial
    if (!metafields.is_trial_period) {
      return { shouldEnd: false, reason: "Not in trial period" };
    }
    
    const trialStartDate = metafields.trial_start_date;
    if (!trialStartDate) {
      // No trial start date means not properly initialized, treat as not in trial
      return { shouldEnd: false, reason: "No trial start date found" };
    }
    
    const trialStart = new Date(trialStartDate);
    const now = new Date();
    const daysSinceTrialStart = Math.floor((now - trialStart) / (1000 * 60 * 60 * 24));
    
    const trialCreditsUsed = metafields.trial_credits_used || 0;
    const trialCreditsBalance = metafields.trial_credits_balance || TRIAL_CREDITS;
    
    // Check condition 1: 30 days passed
    if (daysSinceTrialStart >= TRIAL_DAYS) {
      return {
        shouldEnd: true,
        reason: "Trial period expired (30 days)",
        daysSinceStart: daysSinceTrialStart,
      };
    }
    
    // Check condition 2: 100 trial credits exhausted
    if (trialCreditsUsed >= TRIAL_CREDITS || trialCreditsBalance <= 0) {
      return {
        shouldEnd: true,
        reason: "Trial credits exhausted",
        trialCreditsUsed,
        trialCreditsBalance,
      };
    }
    
    return {
      shouldEnd: false,
      reason: "Trial still active",
      daysRemaining: TRIAL_DAYS - daysSinceTrialStart,
      trialCreditsRemaining: TRIAL_CREDITS - trialCreditsUsed,
    };
  } catch (error) {
    logger.error("[TRIAL_MANAGER] Failed to check if trial should end", error);
    return { shouldEnd: false, reason: "Error checking trial status" };
  }
};

/**
 * Initialize trial credits for new subscription
 * Preserves existing plan credits if they exist (credits never expire)
 */
export const initializeTrialCredits = async (client, appInstallationId) => {
  try {
    const now = new Date().toISOString();
    
    // Preserve existing plan credits if they exist (credits never expire)
    const metafields = await creditMetafield.getCreditMetafields(client, appInstallationId);
    const existingPlanCredits = metafields.credit_balance ?? 0;
    
    await creditMetafield.batchUpdateMetafields(client, appInstallationId, {
      trial_credits_balance: TRIAL_CREDITS,
      trial_credits_used: 0,
      trial_start_date: now,
      is_trial_period: true,
      // Preserve existing plan credits (they carry forward, never expire)
      credit_balance: existingPlanCredits,
      credits_included: 100, // Plan includes 100 credits, but not active during trial
    });
    
    logger.info("[TRIAL_MANAGER] Trial credits initialized", {
      appInstallationId,
      trialCredits: TRIAL_CREDITS,
      existingPlanCredits,
      trialStartDate: now,
      note: "Existing plan credits preserved (credits never expire)",
    });
    
    return {
      success: true,
      trialCredits: TRIAL_CREDITS,
      existingPlanCredits,
      trialStartDate: now,
    };
  } catch (error) {
    logger.error("[TRIAL_MANAGER] Failed to initialize trial credits", error);
    throw error;
  }
};

/**
 * Deduct trial credit
 */
export const deductTrialCredit = async (client, appInstallationId) => {
  try {
    const metafields = await creditMetafield.getCreditMetafields(client, appInstallationId);
    const currentTrialBalance = metafields.trial_credits_balance || TRIAL_CREDITS;
    const currentTrialUsed = metafields.trial_credits_used || 0;
    
    if (currentTrialBalance <= 0) {
      throw new Error("No trial credits remaining");
    }
    
    const newTrialBalance = currentTrialBalance - 1;
    const newTrialUsed = currentTrialUsed + 1;
    
    await creditMetafield.batchUpdateMetafields(client, appInstallationId, {
      trial_credits_balance: newTrialBalance,
      trial_credits_used: newTrialUsed,
    });
    
    logger.info("[TRIAL_MANAGER] Trial credit deducted", {
      appInstallationId,
      previousBalance: currentTrialBalance,
      newBalance: newTrialBalance,
      previousUsed: currentTrialUsed,
      newUsed: newTrialUsed,
    });
    
    return {
      success: true,
      trialCreditsRemaining: newTrialBalance,
      trialCreditsUsed: newTrialUsed,
    };
  } catch (error) {
    logger.error("[TRIAL_MANAGER] Failed to deduct trial credit", error);
    throw error;
  }
};

/**
 * Refund trial credit (on generation failure)
 */
export const refundTrialCredit = async (client, appInstallationId) => {
  try {
    const metafields = await creditMetafield.getCreditMetafields(client, appInstallationId);
    const currentTrialBalance = metafields.trial_credits_balance || 0;
    const currentTrialUsed = Math.max(0, (metafields.trial_credits_used || 0) - 1);
    
    // Trial credits never expire - can refund beyond original 100 limit
    const newTrialBalance = currentTrialBalance + 1;
    
    await creditMetafield.batchUpdateMetafields(client, appInstallationId, {
      trial_credits_balance: newTrialBalance,
      trial_credits_used: currentTrialUsed,
    });
    
    logger.info("[TRIAL_MANAGER] Trial credit refunded (trial credits never expire)", {
      appInstallationId,
      previousBalance: currentTrialBalance,
      newBalance: newTrialBalance,
      previousUsed: metafields.trial_credits_used || 0,
      newUsed: currentTrialUsed,
      note: "Trial credits carry forward and never expire",
    });
    
    return {
      success: true,
      trialCreditsRemaining: newTrialBalance,
      trialCreditsUsed: currentTrialUsed,
    };
  } catch (error) {
    logger.error("[TRIAL_MANAGER] Failed to refund trial credit", error);
    throw error;
  }
};

/**
 * End trial period and transition to paid subscription
 * Adds plan credits to existing balance (credits never expire, they carry forward)
 */
export const endTrialPeriod = async (client, appInstallationId, includedCredits = 100) => {
  try {
    // Get current balance and credit type balances to add credits instead of resetting
    const metafields = await creditMetafield.getCreditMetafields(client, appInstallationId);
    const currentBalance = metafields.credit_balance || 0;
    const currentPlanCredits = metafields.plan_credits_balance ?? 0;
    const currentPurchasedCredits = metafields.purchased_credits_balance ?? 0;
    const currentCouponCredits = metafields.coupon_credits_balance ?? 0;
    
    // Add plan credits to plan credits balance (credits carry forward)
    const newBalance = currentBalance + includedCredits;
    const newPlanCredits = currentPlanCredits + includedCredits;
    
    // Preserve trial credits - they never expire and remain usable
    const currentTrialCredits = metafields.trial_credits_balance ?? 0;
    
    await creditMetafield.batchUpdateMetafields(client, appInstallationId, {
      is_trial_period: false,
      // Add plan credits to existing balance (credits carry forward)
      credit_balance: newBalance,
      plan_credits_balance: newPlanCredits,
      credits_included: includedCredits,
      credits_used_this_period: 0,
      // Preserve other credit types
      purchased_credits_balance: currentPurchasedCredits,
      coupon_credits_balance: currentCouponCredits,
      // Preserve trial credits - they never expire and remain usable after trial ends
      trial_credits_balance: currentTrialCredits,
      // trial_credits_used remains unchanged
    });
    
    logger.info("[TRIAL_MANAGER] Trial period ended, plan credits added (carry forward)", {
      appInstallationId,
      planCreditsAdded: includedCredits,
      previousBalance: currentBalance,
      newBalance,
      previousPlanCredits: currentPlanCredits,
      newPlanCredits,
      trialCreditsPreserved: currentTrialCredits,
      note: "Trial credits preserved - they never expire and remain usable",
    });
    
    return {
      success: true,
      planCreditsAdded: includedCredits,
      previousBalance: currentBalance,
      newBalance,
      planCreditsRemaining: newPlanCredits,
    };
  } catch (error) {
    logger.error("[TRIAL_MANAGER] Failed to end trial period", error);
    throw error;
  }
};

/**
 * Get trial status information
 */
export const getTrialStatus = async (client, appInstallationId) => {
  try {
    const metafields = await creditMetafield.getCreditMetafields(client, appInstallationId);
    const isTrial = await isInTrialPeriod(client, appInstallationId);
    
    if (!isTrial) {
      return {
        isTrial: false,
        trialCreditsRemaining: 0,
        trialCreditsUsed: metafields.trial_credits_used || 0,
        daysRemaining: 0,
      };
    }
    
    const trialStartDate = metafields.trial_start_date;
    const trialStart = trialStartDate ? new Date(trialStartDate) : new Date();
    const now = new Date();
    const daysSinceTrialStart = Math.floor((now - trialStart) / (1000 * 60 * 60 * 24));
    const daysRemaining = Math.max(0, TRIAL_DAYS - daysSinceTrialStart);
    
    const trialCreditsBalance = metafields.trial_credits_balance || TRIAL_CREDITS;
    const trialCreditsUsed = metafields.trial_credits_used || 0;
    
    return {
      isTrial: true,
      trialCreditsRemaining: trialCreditsBalance,
      trialCreditsUsed,
      trialCreditsTotal: TRIAL_CREDITS,
      daysRemaining,
      daysSinceStart: daysSinceTrialStart,
      trialStartDate: trialStartDate,
    };
  } catch (error) {
    logger.error("[TRIAL_MANAGER] Failed to get trial status", error);
    throw error;
  }
};

