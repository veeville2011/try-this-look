/**
 * Credit Deduction Service
 * 
 * Handles credit deduction logic for try-on generation
 * Coordinates between metafield and usage record systems
 */

import * as logger from "./logger.js";
import * as creditMetafield from "./creditMetafield.js";
import * as usageRecordService from "./usageRecordService.js";
import * as creditReset from "./creditReset.js";
import * as annualOverageBilling from "./annualOverageBilling.js";

/**
 * Deduct credit for try-on generation
 */
export const deductCreditForTryOn = async (client, appInstallationId, shopDomain, tryonId) => {
  try {
    // Get current credit metafields
    const metafields = await creditMetafield.getCreditMetafields(client, appInstallationId);
    
    // Check if this is an annual subscription (has monthly_period_end)
    const isAnnual = !!metafields.monthly_period_end;
    
    // For annual subscriptions, check if monthly period has renewed
    if (isAnnual) {
      const monthlyCheck = await creditReset.checkMonthlyPeriodRenewal(client, appInstallationId);
      if (monthlyCheck.isNewPeriod) {
        // Bill accumulated overage before resetting credits
        try {
          const isDemo = shopDomain.includes("demo") || shopDomain.includes("test");
          await annualOverageBilling.billAccumulatedOverage(
            client,
            shopDomain,
            appInstallationId,
            isDemo
          );
        } catch (overageError) {
          // Log error but don't fail credit deduction
          logger.error("[CREDIT_DEDUCTION] Failed to bill overage during credit check", overageError, null, {
            shopDomain,
            appInstallationId,
          });
        }
        
        // Reset credits for new monthly period
        const includedCredits = metafields.credits_included || 100;
        await creditReset.resetCreditsForNewPeriod(
          client,
          appInstallationId,
          monthlyCheck.newPeriodEnd,
          includedCredits,
          true
        );
        logger.info("[CREDIT_DEDUCTION] Monthly credits reset for annual subscription", {
          shopDomain,
          includedCredits,
          periodEnd: monthlyCheck.newPeriodEnd,
        });
        // Refresh metafields after reset
        const updatedMetafields = await creditMetafield.getCreditMetafields(client, appInstallationId);
        metafields.credit_balance = updatedMetafields.credit_balance || includedCredits;
      }
    }
    
    const currentBalance = metafields.credit_balance || 0;
    const subscriptionLineItemId = metafields.subscription_line_item_id;

    // Scenario A: Metafield balance > 0
    if (currentBalance > 0) {
      const newBalance = currentBalance - 1;
      const previousUsed = metafields.credits_used_this_period || 0;
      const usedThisPeriod = previousUsed + 1;

      logger.info("[CREDIT_DEDUCTION] Deducting credit from metafield", {
        shopDomain,
        tryonId,
        previousBalance: currentBalance,
        newBalance,
        previousUsed,
        usedThisPeriod,
        source: "metafield",
      });

      // Update metafield balance
      await creditMetafield.batchUpdateMetafields(client, appInstallationId, {
        credit_balance: newBalance,
        credits_used_this_period: usedThisPeriod,
      });

      logger.info("[CREDIT_DEDUCTION] Credit deducted from metafield successfully", {
        shopDomain,
        tryonId,
        previousBalance: currentBalance,
        newBalance,
        previousUsed,
        usedThisPeriod,
        source: "metafield",
      });

      return {
        success: true,
        source: "metafield",
        newBalance,
        creditsRemaining: newBalance,
      };
    }

    // Scenario B: Metafield balance = 0, handle overage billing
    if (isAnnual) {
      // For annual subscriptions, track overage usage (will be billed at month end)
      try {
        const overageTracking = await annualOverageBilling.trackOverageUsage(
          client,
          appInstallationId,
          1
        );

        logger.info("[CREDIT_DEDUCTION] Overage tracked for annual subscription", {
          shopDomain,
          tryonId,
          overageCount: overageTracking.overageCount,
          overageAmount: overageTracking.overageAmount,
          source: "overage_tracking",
          note: "Overage will be billed via one-time charge at month end",
        });

        return {
          success: true,
          source: "overage_tracking",
          newBalance: 0,
          creditsRemaining: 0,
          overageCount: overageTracking.overageCount,
          overageAmount: overageTracking.overageAmount,
          note: "Overage tracked - will be billed at month end",
        };
      } catch (error) {
        logger.error("[CREDIT_DEDUCTION] Failed to track overage for annual subscription", error);
        throw error;
      }
    }

    // For monthly subscriptions, use usage records
    if (!subscriptionLineItemId) {
      throw new Error("No subscription line item ID found for usage records");
    }

    // Create usage record (only for monthly subscriptions with usage line item)
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
    } else if (source === "overage_tracking") {
      // For annual subscriptions, reduce overage count and amount
      const metafields = await creditMetafield.getCreditMetafields(client, appInstallationId);
      const currentOverageCount = metafields.overage_count || 0;
      const currentOverageAmount = metafields.overage_amount || 0;
      
      if (currentOverageCount > 0) {
        const refundAmount = 0.20; // $0.20 per credit
        const newOverageCount = Math.max(0, currentOverageCount - 1);
        const newOverageAmount = Math.max(0, currentOverageAmount - refundAmount);
        
        await creditMetafield.batchUpdateMetafields(client, appInstallationId, {
          overage_count: newOverageCount,
          overage_amount: newOverageAmount,
        });
        
        logger.info("[CREDIT_DEDUCTION] Overage refunded for annual subscription", {
          shopDomain,
          tryonId,
          reason,
          previousOverageCount: currentOverageCount,
          newOverageCount,
          previousOverageAmount: currentOverageAmount,
          newOverageAmount,
        });
      }
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

