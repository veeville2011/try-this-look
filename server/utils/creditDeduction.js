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
import * as trialManager from "./trialManager.js";
import * as trialNotificationService from "./trialNotificationService.js";

/**
 * Deduct credit for try-on generation
 */
export const deductCreditForTryOn = async (client, appInstallationId, shopDomain, tryonId) => {
  try {
    // Get current credit metafields
    const metafields = await creditMetafield.getCreditMetafields(client, appInstallationId);
    
    // Check if subscription is in trial period
    const isInTrial = await trialManager.isInTrialPeriod(client, appInstallationId);
    
    // PRIORITY 1: Use trial credits first (if available) - they never expire
    // Trial credits can be used even after trial period ends (they carry forward)
    const trialCreditsBalance = metafields.trial_credits_balance || 0;
    
    if (trialCreditsBalance > 0) {
      // If in trial period, check if trial should end
      if (isInTrial) {
        const trialCheck = await trialManager.shouldEndTrial(client, appInstallationId);
        
        if (trialCheck.shouldEnd) {
          logger.info("[CREDIT_DEDUCTION] Trial period should end, returning replacement needed flag", {
            shopDomain,
            tryonId,
            reason: trialCheck.reason,
            note: "Frontend should trigger trial replacement, but trial credits will remain usable",
          });
          
          // Return special response indicating replacement is needed
          // Frontend will handle triggering the replacement
          // Trial credits will remain available after trial ends
          return {
            success: false,
            error: "TRIAL_REPLACEMENT_NEEDED",
            message: `Trial period ended: ${trialCheck.reason}. Subscription replacement required.`,
            trialEndReason: trialCheck.reason,
            requiresReplacement: true,
            note: "Trial credits will remain available after subscription activation",
          };
        }
      }
      
      // Deduct from trial credits (trial credits never expire, can be used anytime)
      const result = await trialManager.deductTrialCredit(client, appInstallationId);
      
      logger.info("[CREDIT_DEDUCTION] Trial credit deducted (trial credits never expire)", {
        shopDomain,
        tryonId,
        trialCreditsRemaining: result.trialCreditsRemaining,
        trialCreditsUsed: result.trialCreditsUsed,
        isInTrial,
        source: "trial_credits",
        note: "Trial credits carry forward and never expire",
      });
      
      // Check if notification should be sent for credit threshold
      if (isInTrial) {
        const notificationCheck = await trialNotificationService.checkNotificationThreshold(client, appInstallationId);
        if (notificationCheck.shouldNotify) {
          logger.info("[CREDIT_DEDUCTION] Trial credit threshold reached, sending notifications", {
            shopDomain,
            threshold: notificationCheck.threshold,
            creditsUsed: notificationCheck.creditsUsed,
            creditsRemaining: notificationCheck.creditsRemaining,
          });
          
          // Send email notification (async, don't wait)
          trialNotificationService.sendEmailNotification(
            client,
            shopDomain,
            notificationCheck.threshold,
            notificationCheck.creditsUsed,
            notificationCheck.creditsRemaining
          ).catch(error => {
            logger.error("[CREDIT_DEDUCTION] Failed to send email notification", error);
          });
          
          // Mark notification as sent
          await trialNotificationService.markNotificationSent(client, appInstallationId, notificationCheck.threshold);
        }
      }
      
      // If in trial, check again if trial should end after this deduction
      if (isInTrial) {
        const trialCheckAfter = await trialManager.shouldEndTrial(client, appInstallationId);
        if (trialCheckAfter.shouldEnd) {
          logger.info("[CREDIT_DEDUCTION] Trial period ended after credit deduction", {
            shopDomain,
            tryonId,
            reason: trialCheckAfter.reason,
            note: "Trial replacement subscription should be triggered, but trial credits remain usable",
          });
        }
      }
      
      // Get current total balance for response
      const currentTotalBalance = metafields.credit_balance || 0;
      
      return {
        success: true,
        source: "trial_credits",
        newBalance: currentTotalBalance, // Total balance (trial credits are separate)
        creditsRemaining: currentTotalBalance + result.trialCreditsRemaining, // Total available
        trialCreditsRemaining: result.trialCreditsRemaining,
        trialCreditsUsed: result.trialCreditsUsed,
        note: "Trial credits never expire and carry forward",
      };
    }
    
    // Credits never expire and carry forward - no period renewal checks needed
    // Period renewal and credit addition is handled by webhooks, not during deduction
    
    const currentBalance = metafields.credit_balance || 0;
    const subscriptionLineItemId = metafields.subscription_line_item_id;

    // CRITICAL: Determine if subscription is annual by checking subscription data
    // Check if monthly_period_end exists (indicates annual subscription)
    // OR query subscription to determine interval
    let isAnnual = false;
    if (metafields.monthly_period_end) {
      // Annual subscription uses monthly_period_end metafield
      isAnnual = true;
    } else {
      // Query subscription to determine if annual
      try {
        const subscriptionQuery = `
          query GetSubscriptionInterval {
            currentAppInstallation {
              activeSubscriptions {
                id
                lineItems {
                  id
                  plan {
                    pricingDetails {
                      __typename
                      ... on AppRecurringPricing {
                        interval
                      }
                    }
                  }
                }
              }
            }
          }
        `;
        const subscriptionResponse = await client.query({
          data: { query: subscriptionQuery },
        });
        const activeSubscriptions = subscriptionResponse?.body?.data?.currentAppInstallation?.activeSubscriptions || [];
        if (activeSubscriptions.length > 0) {
          const subscription = activeSubscriptions[0];
          const recurringLineItem = subscription.lineItems?.find(
            (item) => item.plan?.pricingDetails?.__typename === "AppRecurringPricing"
          );
          isAnnual = recurringLineItem?.plan?.pricingDetails?.interval === "ANNUAL";
        }
      } catch (error) {
        logger.warn("[CREDIT_DEDUCTION] Failed to determine subscription interval, defaulting to monthly", {
          shopDomain,
          error: error.message,
        });
        // Default to monthly if query fails
        isAnnual = false;
      }
    }

    // Get individual credit type balances
    const planCredits = metafields.plan_credits_balance ?? 0;
    const purchasedCredits = metafields.purchased_credits_balance ?? 0;
    const couponCredits = metafields.coupon_credits_balance ?? 0;

    // Scenario A: Metafield balance > 0
    // Deduct credits in priority order:
    // 1. Trial credits (handled above - Priority 1, never expire)
    // 2. Coupon credits (promotional credits)
    // 3. Plan credits (included credits from subscription)
    // 4. Purchased credits (from credit packages)
    // Note: Trial credits are handled above (Priority 1) and never expire
    if (currentBalance > 0) {
      const previousUsed = metafields.credits_used_this_period || 0;
      const usedThisPeriod = previousUsed + 1;
      
      let deductedFrom = null;
      let newPlanCredits = planCredits;
      let newPurchasedCredits = purchasedCredits;
      let newCouponCredits = couponCredits;

      // Priority 2: Deduct from coupon credits (after trial credits)
      if (couponCredits > 0) {
        newCouponCredits = couponCredits - 1;
        deductedFrom = "coupon_credits";
      }
      // Priority 3: Deduct from plan credits
      else if (planCredits > 0) {
        newPlanCredits = planCredits - 1;
        deductedFrom = "plan_credits";
      }
      // Priority 4: Deduct from purchased credits
      else if (purchasedCredits > 0) {
        newPurchasedCredits = purchasedCredits - 1;
        deductedFrom = "purchased_credits";
      }

      const newBalance = currentBalance - 1;

      logger.info("[CREDIT_DEDUCTION] Deducting credit from metafield (priority order)", {
        shopDomain,
        tryonId,
        previousBalance: currentBalance,
        newBalance,
        deductedFrom,
        planCreditsBefore: planCredits,
        purchasedCreditsBefore: purchasedCredits,
        couponCreditsBefore: couponCredits,
        planCreditsAfter: newPlanCredits,
        purchasedCreditsAfter: newPurchasedCredits,
        couponCreditsAfter: newCouponCredits,
        previousUsed,
        usedThisPeriod,
        source: "metafield",
      });

      // Update metafield balances
      await creditMetafield.batchUpdateMetafields(client, appInstallationId, {
        credit_balance: newBalance,
        plan_credits_balance: newPlanCredits,
        purchased_credits_balance: newPurchasedCredits,
        coupon_credits_balance: newCouponCredits,
        credits_used_this_period: usedThisPeriod,
      });

      logger.info("[CREDIT_DEDUCTION] Credit deducted from metafield successfully", {
        shopDomain,
        tryonId,
        previousBalance: currentBalance,
        newBalance,
        deductedFrom,
        previousUsed,
        usedThisPeriod,
        source: "metafield",
      });

      return {
        success: true,
        source: "metafield",
        deductedFrom,
        newBalance,
        creditsRemaining: newBalance,
        planCreditsRemaining: newPlanCredits,
        purchasedCreditsRemaining: newPurchasedCredits,
        couponCreditsRemaining: newCouponCredits,
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
    const usagePrice = 0.15; // $0.15 per try-on after included credits

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
    // Check if subscription is in trial period
    const isInTrial = await trialManager.isInTrialPeriod(client, appInstallationId);
    
    if (isInTrial && source === "trial_credits") {
      // Refund trial credit
      const result = await trialManager.refundTrialCredit(client, appInstallationId);
      
      logger.info("[CREDIT_DEDUCTION] Trial credit refunded", {
        shopDomain,
        tryonId,
        reason,
        trialCreditsRemaining: result.trialCreditsRemaining,
        trialCreditsUsed: result.trialCreditsUsed,
      });
      
      return {
        success: true,
        refunded: true,
        trialCreditsRemaining: result.trialCreditsRemaining,
      };
    }
    
    if (source === "metafield") {
      // Add credit back to metafield
      // Try to restore to the same credit type it was deducted from
      const metafields = await creditMetafield.getCreditMetafields(client, appInstallationId);
      const currentBalance = metafields.credit_balance || 0;
      const usedThisPeriod = Math.max(0, (metafields.credits_used_this_period || 0) - 1);
      
      // Get current credit type balances
      let planCredits = metafields.plan_credits_balance ?? 0;
      let purchasedCredits = metafields.purchased_credits_balance ?? 0;
      let couponCredits = metafields.coupon_credits_balance ?? 0;
      
      // If we know which type was deducted from (from deduction result), restore to that type
      // Otherwise, restore to plan credits (most common source)
      // Note: In practice, we'd need to track deduction history, but for now we'll restore to plan credits
      planCredits += 1;

      await creditMetafield.batchUpdateMetafields(client, appInstallationId, {
        credit_balance: currentBalance + 1,
        plan_credits_balance: planCredits,
        credits_used_this_period: usedThisPeriod,
      });

      logger.info("[CREDIT_DEDUCTION] Credit refunded to metafield (restored to plan credits)", {
        shopDomain,
        tryonId,
        reason,
        newBalance: currentBalance + 1,
        planCreditsRestored: planCredits,
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
        const refundAmount = 0.15; // $0.15 per credit
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

