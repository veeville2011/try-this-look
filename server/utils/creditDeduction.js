/**
 * Credit Deduction Service
 * 
 * Handles credit deduction logic for try-on generation
 * Coordinates between metafield and usage record systems
 */

import * as logger from "./logger.js";
import * as creditMetafield from "./creditMetafield.js";
import * as usageRecordService from "./usageRecordService.js";

/**
 * Deduct credit for try-on generation
 */
export const deductCreditForTryOn = async (client, appInstallationId, shopDomain, tryonId) => {
  try {
    // Get current credit metafields
    const metafields = await creditMetafield.getCreditMetafields(client, appInstallationId);
    const currentBalance = metafields.credit_balance || 0;
    const subscriptionLineItemId = metafields.subscription_line_item_id;

    // Scenario A: Metafield balance > 0
    if (currentBalance > 0) {
      const newBalance = currentBalance - 1;
      const usedThisPeriod = (metafields.credits_used_this_period || 0) + 1;

      // Update metafield balance
      await creditMetafield.batchUpdateMetafields(client, appInstallationId, {
        credit_balance: newBalance,
        credits_used_this_period: usedThisPeriod,
      });

      logger.info("[CREDIT_DEDUCTION] Credit deducted from metafield", {
        shopDomain,
        tryonId,
        previousBalance: currentBalance,
        newBalance,
        source: "metafield",
      });

      return {
        success: true,
        source: "metafield",
        newBalance,
        creditsRemaining: newBalance,
      };
    }

    // Scenario B: Metafield balance = 0, use usage records
    if (!subscriptionLineItemId) {
      throw new Error("No subscription line item ID found for usage records");
    }

    // Create usage record
    const idempotencyKey = usageRecordService.generateIdempotencyKey(shopDomain, tryonId);
    const usagePrice = 0.20; // $0.20 per try-on after included credits

    try {
      await usageRecordService.createUsageRecord(
        client,
        subscriptionLineItemId,
        "Try-on generation - Overage credit",
        usagePrice,
        idempotencyKey
      );

      logger.info("[CREDIT_DEDUCTION] Usage record created for overage", {
        shopDomain,
        tryonId,
        subscriptionLineItemId,
        price: usagePrice,
        source: "usage_record",
      });

      return {
        success: true,
        source: "usage_record",
        newBalance: 0,
        creditsRemaining: 0,
        usagePrice,
      };
    } catch (error) {
      // Handle specific error types
      if (error.message === "CAPPED_AMOUNT_EXCEEDED") {
        logger.warn("[CREDIT_DEDUCTION] Capped amount exceeded", {
          shopDomain,
          tryonId,
        });
        
        return {
          success: false,
          error: "CAPPED_AMOUNT_EXCEEDED",
          message: "Credit limit exceeded. Please increase your capped amount or wait for next billing period.",
        };
      }

      throw error;
    }
  } catch (error) {
    logger.error("[CREDIT_DEDUCTION] Failed to deduct credit", error, null, {
      shopDomain,
      tryonId,
      appInstallationId,
    });
    throw error;
  }
};

/**
 * Refund credit on generation failure
 */
export const refundCredit = async (client, appInstallationId, shopDomain, tryonId, reason, source) => {
  try {
    if (source === "metafield") {
      // Add credit back to metafield
      const metafields = await creditMetafield.getCreditMetafields(client, appInstallationId);
      const currentBalance = metafields.credit_balance || 0;
      const usedThisPeriod = Math.max(0, (metafields.credits_used_this_period || 0) - 1);

      await creditMetafield.batchUpdateMetafields(client, appInstallationId, {
        credit_balance: currentBalance + 1,
        credits_used_this_period: usedThisPeriod,
      });

      logger.info("[CREDIT_DEDUCTION] Credit refunded to metafield", {
        shopDomain,
        tryonId,
        reason,
        newBalance: currentBalance + 1,
      });
    } else if (source === "usage_record") {
      // Note: Usage records cannot be deleted once created
      // We can only log the refund for manual processing
      logger.warn("[CREDIT_DEDUCTION] Usage record refund requested (cannot be automated)", {
        shopDomain,
        tryonId,
        reason,
        note: "Usage records cannot be deleted. Manual refund may be required.",
      });
    }

    return {
      success: true,
      refunded: source === "metafield",
    };
  } catch (error) {
    logger.error("[CREDIT_DEDUCTION] Failed to refund credit", error);
    throw error;
  }
};

