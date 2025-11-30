/**
 * Credit Reset Service
 * 
 * Handles credit reset on billing cycle renewal
 * For annual subscriptions, credits reset on the first day of each month
 * For monthly subscriptions, credits reset with the billing cycle
 */

import * as logger from "./logger.js";
import * as creditMetafield from "./creditMetafield.js";

/**
 * Calculate next monthly period end (first day of next month)
 * Used for annual subscriptions that reset credits monthly
 */
export const calculateNextMonthlyPeriodEnd = (fromDate = new Date()) => {
  const nextMonth = new Date(fromDate);
  // Set to first day of next month
  nextMonth.setMonth(nextMonth.getMonth() + 1, 1);
  nextMonth.setHours(0, 0, 0, 0); // Start of day
  return nextMonth.toISOString();
};

/**
 * Calculate first day of current month
 */
export const getFirstDayOfCurrentMonth = (fromDate = new Date()) => {
  const firstDay = new Date(fromDate);
  firstDay.setDate(1);
  firstDay.setHours(0, 0, 0, 0);
  return firstDay;
};

/**
 * Check if monthly period has renewed (for annual subscriptions)
 * Resets on the first day of each month
 */
export const checkMonthlyPeriodRenewal = async (client, appInstallationId) => {
  try {
    const metafields = await creditMetafield.getCreditMetafields(client, appInstallationId);
    const storedMonthlyPeriodEnd = metafields.monthly_period_end;
    const now = new Date();
    const firstDayOfCurrentMonth = getFirstDayOfCurrentMonth(now);
    const firstDayOfNextMonth = calculateNextMonthlyPeriodEnd(now);

    if (!storedMonthlyPeriodEnd) {
      // No stored monthly period end - calculate first one (first day of next month)
      return {
        isNewPeriod: true,
        storedPeriodEnd: null,
        newPeriodEnd: firstDayOfNextMonth,
      };
    }

    // Check if we've passed the stored period end (which should be first day of a month)
    const storedDate = new Date(storedMonthlyPeriodEnd);
    const storedMonth = storedDate.getMonth();
    const storedYear = storedDate.getFullYear();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // Check if we're in a new month compared to the stored period end
    // The stored period end should be the first day of a month
    // We're in a new period if:
    // 1. We're in a later year, OR
    // 2. We're in the same year but a later month, OR
    // 3. The stored date has passed (edge case: stored date is in the past)
    const isNewPeriod = 
      currentYear > storedYear || 
      (currentYear === storedYear && currentMonth > storedMonth) ||
      (now >= storedDate && (currentMonth !== storedMonth || currentYear !== storedYear));

    if (isNewPeriod) {
      // Calculate next monthly period (first day of next month)
      return {
        isNewPeriod: true,
        storedPeriodEnd: storedMonthlyPeriodEnd,
        newPeriodEnd: firstDayOfNextMonth,
      };
    }

    return {
      isNewPeriod: false,
      storedPeriodEnd: storedMonthlyPeriodEnd,
      newPeriodEnd: storedMonthlyPeriodEnd,
    };
  } catch (error) {
    logger.error("[CREDIT_RESET] Failed to check monthly period renewal", error);
    throw error;
  }
};

/**
 * Check if billing period has renewed
 * For annual subscriptions, checks monthly renewal instead
 */
export const checkPeriodRenewal = async (client, appInstallationId, newPeriodEnd, isAnnual = false) => {
  try {
    // For annual subscriptions, use monthly period checking
    if (isAnnual) {
      return await checkMonthlyPeriodRenewal(client, appInstallationId);
    }

    // For monthly subscriptions, use the billing period end
    const metafields = await creditMetafield.getCreditMetafields(client, appInstallationId);
    const storedPeriodEnd = metafields.current_period_end;

    if (!storedPeriodEnd) {
      // No stored period end - likely first time
      return {
        isNewPeriod: true,
        storedPeriodEnd: null,
        newPeriodEnd,
      };
    }

    // Compare period ends
    const storedDate = new Date(storedPeriodEnd);
    const newDate = new Date(newPeriodEnd);

    const isNewPeriod = storedDate.getTime() !== newDate.getTime();

    return {
      isNewPeriod,
      storedPeriodEnd,
      newPeriodEnd,
    };
  } catch (error) {
    logger.error("[CREDIT_RESET] Failed to check period renewal", error);
    throw error;
  }
};

/**
 * Reset credits for new billing period
 * For annual subscriptions, uses monthly period end instead of annual period end
 * Note: Overage billing should be handled BEFORE calling this function for annual subscriptions
 */
export const resetCreditsForNewPeriod = async (
  client,
  appInstallationId,
  periodEnd,
  includedCredits = 100,
  isAnnual = false
) => {
  try {
    // For annual subscriptions, use monthly period end
    const actualPeriodEnd = isAnnual
      ? calculateNextMonthlyPeriodEnd()
      : periodEnd;

    await creditMetafield.resetCreditsForPeriod(
      client,
      appInstallationId,
      actualPeriodEnd,
      includedCredits,
      isAnnual
    );

    logger.info("[CREDIT_RESET] Credits reset for new period", {
      appInstallationId,
      periodEnd: actualPeriodEnd,
      includedCredits,
      isAnnual,
      note: isAnnual ? "Monthly reset for annual subscription" : "Billing cycle reset",
    });

    return {
      success: true,
      balance: includedCredits,
      periodEnd: actualPeriodEnd,
    };
  } catch (error) {
    logger.error("[CREDIT_RESET] Failed to reset credits", error);
    throw error;
  }
};

/**
 * Sync subscription data with metafields
 * @param {Object} client - GraphQL client
 * @param {string} appInstallationId - App installation ID
 * @param {Object} subscription - Subscription object with id, currentPeriodEnd, lineItems
 * @param {boolean} isAnnual - Whether this is an annual subscription (default: false)
 */
export const syncWithSubscription = async (client, appInstallationId, subscription, isAnnual = false) => {
  try {
    const updates = {};

    // Update period end if changed
    if (subscription.currentPeriodEnd) {
      const periodCheck = await checkPeriodRenewal(
        client,
        appInstallationId,
        subscription.currentPeriodEnd,
        isAnnual // Pass isAnnual flag
      );

      if (periodCheck.isNewPeriod) {
        // Reset credits for new period
        const metafields = await creditMetafield.getCreditMetafields(client, appInstallationId);
        const includedCredits = metafields.credits_included || 100;
        
        await resetCreditsForNewPeriod(
          client,
          appInstallationId,
          periodCheck.newPeriodEnd, // Use calculated newPeriodEnd
          includedCredits,
          isAnnual // Pass isAnnual flag
        );
      } else {
        // Only update current_period_end for monthly plans, annual plans use monthly_period_end
        if (!isAnnual) {
          updates.current_period_end = subscription.currentPeriodEnd;
        }
      }
    }

    // Update subscription line item ID if available
    if (subscription.lineItems) {
      const usageLineItem = subscription.lineItems.find(
        item => item.plan?.pricingDetails?.__typename === "AppUsagePricing"
      );
      
      if (usageLineItem?.id) {
        updates.subscription_line_item_id = usageLineItem.id;
      }
    }

    // Apply updates if any
    if (Object.keys(updates).length > 0) {
      await creditMetafield.batchUpdateMetafields(client, appInstallationId, updates);
    }

    logger.info("[CREDIT_RESET] Subscription synced with metafields", {
      appInstallationId,
      subscriptionId: subscription.id,
      updates: Object.keys(updates),
    });

    return {
      success: true,
      updates: Object.keys(updates),
    };
  } catch (error) {
    logger.error("[CREDIT_RESET] Failed to sync subscription", error);
    throw error;
  }
};

