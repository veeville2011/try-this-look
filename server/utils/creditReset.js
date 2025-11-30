/**
 * Credit Reset Service
 * 
 * Handles credit reset on billing cycle renewal
 */

import * as logger from "./logger.js";
import * as creditMetafield from "./creditMetafield.js";

/**
 * Check if billing period has renewed
 */
export const checkPeriodRenewal = async (client, appInstallationId, newPeriodEnd) => {
  try {
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
 */
export const resetCreditsForNewPeriod = async (client, appInstallationId, periodEnd, includedCredits = 100) => {
  try {
    await creditMetafield.resetCreditsForPeriod(
      client,
      appInstallationId,
      periodEnd,
      includedCredits
    );

    logger.info("[CREDIT_RESET] Credits reset for new period", {
      appInstallationId,
      periodEnd,
      includedCredits,
    });

    return {
      success: true,
      balance: includedCredits,
      periodEnd,
    };
  } catch (error) {
    logger.error("[CREDIT_RESET] Failed to reset credits", error);
    throw error;
  }
};

/**
 * Sync subscription data with metafields
 */
export const syncWithSubscription = async (client, appInstallationId, subscription) => {
  try {
    const updates = {};

    // Update period end if changed
    if (subscription.currentPeriodEnd) {
      const periodCheck = await checkPeriodRenewal(
        client,
        appInstallationId,
        subscription.currentPeriodEnd
      );

      if (periodCheck.isNewPeriod) {
        // Reset credits for new period
        const metafields = await creditMetafield.getCreditMetafields(client, appInstallationId);
        const includedCredits = metafields.credits_included || 100;
        
        await resetCreditsForNewPeriod(
          client,
          appInstallationId,
          subscription.currentPeriodEnd,
          includedCredits
        );
      } else {
        updates.current_period_end = subscription.currentPeriodEnd;
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

