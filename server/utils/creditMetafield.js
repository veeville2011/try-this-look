/**
 * Credit Metafield Service
 * 
 * Handles all metafield operations for credit management
 * Stores credit data on AppInstallation object
 */

import * as logger from "./logger.js";

const METAFIELD_NAMESPACE = "nusense";
const METAFIELD_KEYS = {
  CREDIT_BALANCE: "credit_balance", // Total balance (sum of all credit types)
  CREDITS_INCLUDED: "credits_included",
  CREDITS_USED_THIS_PERIOD: "credits_used_this_period",
  LAST_CREDIT_RESET: "last_credit_reset",
  CURRENT_PERIOD_END: "current_period_end",
  MONTHLY_PERIOD_END: "monthly_period_end", // For annual subscriptions that reset monthly
  SUBSCRIPTION_LINE_ITEM_ID: "subscription_line_item_id",
  COUPON_REDEMPTIONS: "coupon_redemptions",
  CREDIT_TRANSACTIONS: "credit_transactions",
  // Credit type tracking (for usage order)
  PLAN_CREDITS_BALANCE: "plan_credits_balance", // Credits from subscription plan (included credits)
  PURCHASED_CREDITS_BALANCE: "purchased_credits_balance", // Credits from credit package purchases
  COUPON_CREDITS_BALANCE: "coupon_credits_balance", // Credits from coupon redemptions
  // Overage tracking for annual subscriptions
  OVERAGE_COUNT: "overage_count", // Number of overage credits used this month
  OVERAGE_AMOUNT: "overage_amount", // Total amount accumulated for overage this month (in cents/dollars)
  LAST_OVERAGE_BILLED: "last_overage_billed", // Date when last overage was billed
  // Trial credits tracking
  TRIAL_CREDITS_BALANCE: "trial_credits_balance", // Free trial credits (100 credits)
  TRIAL_CREDITS_USED: "trial_credits_used", // Number of trial credits used
  TRIAL_START_DATE: "trial_start_date", // When trial period started
  IS_TRIAL_PERIOD: "is_trial_period", // Boolean flag: true if currently in trial period
  TRIAL_NOTIFICATIONS_SENT: "trial_notifications_sent", // JSON array of thresholds already notified
};

/**
 * Get AppInstallation ID for a shop
 */
const getAppInstallationId = async (client) => {
  const query = `
    query GetAppInstallation {
      currentAppInstallation {
        id
      }
    }
  `;

  try {
    const response = await client.query({ data: { query } });
    const appInstallation = response?.body?.data?.currentAppInstallation;
    
    if (!appInstallation?.id) {
      throw new Error("App installation not found");
    }
    
    return appInstallation.id;
  } catch (error) {
    logger.error("[CREDIT_METAFIELD] Failed to get app installation ID", error);
    throw error;
  }
};

/**
 * Get all credit metafields for a shop
 */
export const getCreditMetafields = async (client, appInstallationId) => {
  if (!appInstallationId) {
    appInstallationId = await getAppInstallationId(client);
  }

  const query = `
    query GetCreditMetafields($ownerId: ID!) {
      appInstallation(id: $ownerId) {
        metafields(namespace: "${METAFIELD_NAMESPACE}", first: 50) {
          edges {
            node {
              id
              key
              value
              type
            }
          }
        }
      }
    }
  `;

  try {
    logger.info("[CREDIT_METAFIELD] Fetching credit metafields from Shopify", {
      appInstallationId,
      namespace: METAFIELD_NAMESPACE,
    });

    const response = await client.query({
      data: {
        query,
        variables: { ownerId: appInstallationId },
      },
    });

    const metafields = response?.body?.data?.appInstallation?.metafields?.edges || [];
    const result = {};

    metafields.forEach(({ node }) => {
      if (Object.values(METAFIELD_KEYS).includes(node.key)) {
        // Parse JSON values
        if (node.type === "json" || node.type === "list.single_line_text_field") {
          try {
            result[node.key] = JSON.parse(node.value);
          } catch {
            result[node.key] = node.value;
          }
        } else if (node.key === METAFIELD_KEYS.TRIAL_NOTIFICATIONS_SENT && node.type === "single_line_text_field") {
          // Handle notification sent field stored as JSON string
          try {
            result[node.key] = JSON.parse(node.value);
          } catch {
            result[node.key] = node.value;
          }
        } else if (node.type === "number_integer") {
          result[node.key] = parseInt(node.value, 10);
        } else if (node.type === "number_decimal") {
          result[node.key] = parseFloat(node.value);
        } else if (node.type === "single_line_text_field" && node.key === METAFIELD_KEYS.IS_TRIAL_PERIOD) {
          // Parse boolean string to boolean
          result[node.key] = node.value === "true" || node.value === true;
        } else {
          result[node.key] = node.value;
        }
      }
    });

    logger.info("[CREDIT_METAFIELD] Credit metafields retrieved", {
      appInstallationId,
      totalMetafieldsFound: metafields.length,
      creditMetafieldsFound: Object.keys(result).length,
      creditMetafieldKeys: Object.keys(result),
      creditBalance: result.credit_balance,
      creditsIncluded: result.credits_included,
      creditsUsed: result.credits_used_this_period,
      hasPeriodEnd: !!result.current_period_end || !!result.monthly_period_end,
    });

    return result;
  } catch (error) {
    logger.error("[CREDIT_METAFIELD] Failed to get credit metafields", error, null, {
      appInstallationId,
    });
    throw error;
  }
};

/**
 * Update credit balance metafield and sync total balance
 */
export const updateCreditBalance = async (client, appInstallationId, newBalance, creditTypeBalances = null) => {
  if (!appInstallationId) {
    appInstallationId = await getAppInstallationId(client);
  }

  const metafields = [
    {
      ownerId: appInstallationId,
      namespace: METAFIELD_NAMESPACE,
      key: METAFIELD_KEYS.CREDIT_BALANCE,
      type: "number_integer",
      value: String(newBalance),
    },
  ];

  // Update individual credit type balances if provided
  if (creditTypeBalances) {
    if (creditTypeBalances.planCredits !== undefined) {
      metafields.push({
        ownerId: appInstallationId,
        namespace: METAFIELD_NAMESPACE,
        key: METAFIELD_KEYS.PLAN_CREDITS_BALANCE,
        type: "number_integer",
        value: String(creditTypeBalances.planCredits),
      });
    }
    if (creditTypeBalances.purchasedCredits !== undefined) {
      metafields.push({
        ownerId: appInstallationId,
        namespace: METAFIELD_NAMESPACE,
        key: METAFIELD_KEYS.PURCHASED_CREDITS_BALANCE,
        type: "number_integer",
        value: String(creditTypeBalances.purchasedCredits),
      });
    }
    if (creditTypeBalances.couponCredits !== undefined) {
      metafields.push({
        ownerId: appInstallationId,
        namespace: METAFIELD_NAMESPACE,
        key: METAFIELD_KEYS.COUPON_CREDITS_BALANCE,
        type: "number_integer",
        value: String(creditTypeBalances.couponCredits),
      });
    }
  }

  const mutation = `
    mutation UpdateCreditBalance($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) {
        metafields {
          id
          key
          value
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const variables = { metafields };

  try {
    const response = await client.query({
      data: { query: mutation, variables },
    });

    const result = response?.body?.data?.metafieldsSet;
    const userErrors = result?.userErrors || [];

    if (userErrors.length > 0) {
      throw new Error(`Metafield update failed: ${userErrors.map(e => e.message).join(", ")}`);
    }

    logger.info("[CREDIT_METAFIELD] Credit balance updated", {
      newBalance,
      creditTypeBalances,
      appInstallationId,
    });

    return result;
  } catch (error) {
    logger.error("[CREDIT_METAFIELD] Failed to update credit balance", error);
    throw error;
  }
};

/**
 * Add credits by type (plan, purchased, or coupon)
 * Updates both the specific credit type balance and total balance
 */
export const addCreditsByType = async (client, appInstallationId, amount, creditType = "plan") => {
  if (!appInstallationId) {
    appInstallationId = await getAppInstallationId(client);
  }

  const metafields = await getCreditMetafields(client, appInstallationId);
  const currentTotal = metafields.credit_balance || 0;
  const newTotal = currentTotal + amount;

  const creditTypeBalances = {
    planCredits: metafields.plan_credits_balance ?? 0,
    purchasedCredits: metafields.purchased_credits_balance ?? 0,
    couponCredits: metafields.coupon_credits_balance ?? 0,
  };

  // Add to the appropriate credit type
  if (creditType === "plan") {
    creditTypeBalances.planCredits += amount;
  } else if (creditType === "purchased") {
    creditTypeBalances.purchasedCredits += amount;
  } else if (creditType === "coupon") {
    creditTypeBalances.couponCredits += amount;
  }

  await updateCreditBalance(client, appInstallationId, newTotal, creditTypeBalances);

  return {
    success: true,
    amount,
    creditType,
    newTotal,
    creditTypeBalances,
  };
};

/**
 * Initialize credits for new subscription
 * If credits already exist, they are added to the existing balance (credits never expire)
 * @param {boolean} isTrial - Whether subscription is in trial period
 */
export const initializeCredits = async (client, appInstallationId, planHandle, includedCredits = 100, periodEnd, subscriptionLineItemId = null, isAnnual = false, isTrial = false) => {
  // CRITICAL: Validate all required parameters
  if (!client) {
    throw new Error("GraphQL client is required for credit initialization");
  }
  
  if (!appInstallationId) {
    appInstallationId = await getAppInstallationId(client);
  }
  
  if (!appInstallationId) {
    throw new Error("App installation ID is required for credit initialization");
  }
  
  // Validate planHandle - use default if not provided
  if (!planHandle) {
    planHandle = isAnnual ? "pro-annual" : "pro-monthly";
    logger.warn("[CREDIT_METAFIELD] Plan handle not provided, using default", {
      appInstallationId,
      defaultPlanHandle: planHandle,
      isAnnual,
    });
  }
  
  // Validate includedCredits - ensure it's a positive number
  const validatedIncludedCredits = Math.max(0, Number(includedCredits) || 100);
  if (validatedIncludedCredits !== includedCredits) {
    logger.warn("[CREDIT_METAFIELD] Invalid includedCredits, using default", {
      appInstallationId,
      provided: includedCredits,
      validated: validatedIncludedCredits,
    });
  }

  const now = new Date().toISOString();
  
  // Check if credits already exist - if so, add to existing balance instead of resetting
  const existingMetafields = await getCreditMetafields(client, appInstallationId);
  const existingBalance = existingMetafields.credit_balance ?? null;
  
  // For annual subscriptions, calculate first monthly period end (first day of next month)
  // For monthly subscriptions, use the billing period end
  // CRITICAL: Validate and calculate periodEnd if not provided or invalid
  let actualPeriodEnd = periodEnd;
  if (!actualPeriodEnd || isNaN(new Date(actualPeriodEnd).getTime())) {
    // Calculate fallback period end
    const fallbackDate = new Date();
    if (isAnnual) {
      // For annual: first day of next month
      fallbackDate.setMonth(fallbackDate.getMonth() + 1, 1);
      fallbackDate.setHours(0, 0, 0, 0);
    } else {
      // For monthly: 30 days from now
      fallbackDate.setDate(fallbackDate.getDate() + 30);
      fallbackDate.setHours(0, 0, 0, 0);
    }
    actualPeriodEnd = fallbackDate.toISOString();
    
    if (!periodEnd) {
      logger.warn("[CREDIT_METAFIELD] Period end not provided, using calculated fallback", {
        appInstallationId,
        calculatedPeriodEnd: actualPeriodEnd,
        isAnnual,
      });
    } else {
      logger.warn("[CREDIT_METAFIELD] Invalid period end provided, using calculated fallback", {
        appInstallationId,
        providedPeriodEnd: periodEnd,
        calculatedPeriodEnd: actualPeriodEnd,
        isAnnual,
      });
    }
  } else if (isAnnual) {
    // For annual subscriptions, ensure we use monthly period end (first day of next month)
    const providedDate = new Date(actualPeriodEnd);
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1, 1);
    nextMonth.setHours(0, 0, 0, 0);
    actualPeriodEnd = nextMonth.toISOString();
  }

  // During trial: trial credits = 100, plan credits = 0
  // After trial: add plan credits to existing balance (credits carry forward)
  // If credits already exist, add to them instead of resetting
  const planCreditBalance = isTrial 
    ? (existingBalance ?? 0) 
    : (existingBalance != null ? existingBalance + includedCredits : includedCredits);
  
  // Initialize credit type balances
  const existingPlanCredits = existingMetafields.plan_credits_balance ?? 0;
  const existingPurchasedCredits = existingMetafields.purchased_credits_balance ?? 0;
  const existingCouponCredits = existingMetafields.coupon_credits_balance ?? 0;
  const existingTrialCredits = existingMetafields.trial_credits_balance ?? 0;
  
  // Add plan credits to existing plan credits (for new billing periods)
  const newPlanCredits = isTrial ? existingPlanCredits : (existingPlanCredits + includedCredits);
  
  // CRITICAL: Calculate total balance including all credit types
  // During trial: include trial credits (100) + existing credits
  // After trial: include plan credits + existing credits
  const totalCreditBalance = isTrial
    ? (existingTrialCredits || 100) + existingPlanCredits + existingPurchasedCredits + existingCouponCredits
    : planCreditBalance + existingPurchasedCredits + existingCouponCredits + existingTrialCredits;

  const metafields = [
    {
      ownerId: appInstallationId,
      namespace: METAFIELD_NAMESPACE,
      key: METAFIELD_KEYS.CREDIT_BALANCE,
      type: "number_integer",
      value: String(totalCreditBalance),
    },
    {
      ownerId: appInstallationId,
      namespace: METAFIELD_NAMESPACE,
      key: METAFIELD_KEYS.PLAN_CREDITS_BALANCE,
      type: "number_integer",
      value: String(newPlanCredits),
    },
    {
      ownerId: appInstallationId,
      namespace: METAFIELD_NAMESPACE,
      key: METAFIELD_KEYS.PURCHASED_CREDITS_BALANCE,
      type: "number_integer",
      value: String(existingPurchasedCredits),
    },
    {
      ownerId: appInstallationId,
      namespace: METAFIELD_NAMESPACE,
      key: METAFIELD_KEYS.COUPON_CREDITS_BALANCE,
      type: "number_integer",
      value: String(existingCouponCredits),
    },
    {
      ownerId: appInstallationId,
      namespace: METAFIELD_NAMESPACE,
      key: METAFIELD_KEYS.CREDITS_INCLUDED,
      type: "number_integer",
      value: String(includedCredits),
    },
    {
      ownerId: appInstallationId,
      namespace: METAFIELD_NAMESPACE,
      key: METAFIELD_KEYS.CREDITS_USED_THIS_PERIOD,
      type: "number_integer",
      value: "0",
    },
    {
      ownerId: appInstallationId,
      namespace: METAFIELD_NAMESPACE,
      key: METAFIELD_KEYS.LAST_CREDIT_RESET,
      type: "date_time",
      value: now,
    },
    {
      ownerId: appInstallationId,
      namespace: METAFIELD_NAMESPACE,
      key: METAFIELD_KEYS.COUPON_REDEMPTIONS,
      type: "json",
      value: JSON.stringify([]),
    },
  ];

  // Add trial credits tracking if in trial period
  if (isTrial) {
    metafields.push(
      {
        ownerId: appInstallationId,
        namespace: METAFIELD_NAMESPACE,
        key: METAFIELD_KEYS.TRIAL_CREDITS_BALANCE,
        type: "number_integer",
        value: "100", // 100 free trial credits
      },
      {
        ownerId: appInstallationId,
        namespace: METAFIELD_NAMESPACE,
        key: METAFIELD_KEYS.TRIAL_CREDITS_USED,
        type: "number_integer",
        value: "0",
      },
      {
        ownerId: appInstallationId,
        namespace: METAFIELD_NAMESPACE,
        key: METAFIELD_KEYS.TRIAL_START_DATE,
        type: "date_time",
        value: now,
      },
      {
        ownerId: appInstallationId,
        namespace: METAFIELD_NAMESPACE,
        key: METAFIELD_KEYS.IS_TRIAL_PERIOD,
        type: "single_line_text_field",
        value: "true",
      }
    );
  }

  // For annual subscriptions, store monthly period end
  // For monthly subscriptions, store billing period end
  if (isAnnual) {
    metafields.push({
      ownerId: appInstallationId,
      namespace: METAFIELD_NAMESPACE,
      key: METAFIELD_KEYS.MONTHLY_PERIOD_END,
      type: "date_time",
      value: actualPeriodEnd,
    });
  } else {
    metafields.push({
      ownerId: appInstallationId,
      namespace: METAFIELD_NAMESPACE,
      key: METAFIELD_KEYS.CURRENT_PERIOD_END,
      type: "date_time",
      value: actualPeriodEnd,
    });
  }

  if (subscriptionLineItemId) {
    metafields.push({
      ownerId: appInstallationId,
      namespace: METAFIELD_NAMESPACE,
      key: METAFIELD_KEYS.SUBSCRIPTION_LINE_ITEM_ID,
      type: "single_line_text_field",
      value: subscriptionLineItemId,
    });
  }

  const mutation = `
    mutation InitializeCredits($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) {
        metafields {
          id
          key
          value
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  try {
    // Validate metafields array before sending
    if (!metafields || metafields.length === 0) {
      throw new Error("No metafields to initialize - metafields array is empty");
    }
    
    // Validate each metafield has required fields
    for (const metafield of metafields) {
      if (!metafield.ownerId || !metafield.namespace || !metafield.key || !metafield.type || metafield.value === undefined) {
        throw new Error(`Invalid metafield structure: ${JSON.stringify(metafield)}`);
      }
    }
    
    const response = await client.query({
      data: { query: mutation, variables: { metafields } },
    });

    // CRITICAL: Validate response structure
    if (!response || !response.body || !response.body.data) {
      throw new Error("Invalid response structure from metafieldsSet mutation");
    }

    const result = response.body.data.metafieldsSet;
    
    if (!result) {
      throw new Error("metafieldsSet mutation returned null result");
    }
    
    const userErrors = result.userErrors || [];

    if (userErrors.length > 0) {
      const errorMessages = userErrors.map(e => `${e.field || 'unknown'}: ${e.message}`).join(", ");
      throw new Error(`Credit initialization failed: ${errorMessages}`);
    }
    
    // CRITICAL: Verify that metafields were actually created
    const createdMetafields = result.metafields || [];
    if (createdMetafields.length === 0) {
      throw new Error("Credit initialization returned no created metafields");
    }
    
    // Verify critical metafields were created
    const createdKeys = createdMetafields.map(m => m.key);
    const requiredKeys = [METAFIELD_KEYS.CREDIT_BALANCE, METAFIELD_KEYS.PLAN_CREDITS_BALANCE];
    const missingKeys = requiredKeys.filter(key => !createdKeys.includes(key));
    
    if (missingKeys.length > 0) {
      logger.warn("[CREDIT_METAFIELD] Some required metafields were not created", {
        appInstallationId,
        missingKeys,
        createdKeys,
      });
      // Don't throw - partial success is better than complete failure
    }

    logger.info("[CREDIT_METAFIELD] Credits initialized successfully", {
      appInstallationId,
      planHandle,
      includedCredits: validatedIncludedCredits,
      periodEnd: actualPeriodEnd,
      metafieldsCreated: createdMetafields.length,
      createdKeys,
    });

    return result;
  } catch (error) {
    logger.error("[CREDIT_METAFIELD] Failed to initialize credits", error, null, {
      appInstallationId,
      planHandle,
      includedCredits: validatedIncludedCredits,
      periodEnd: actualPeriodEnd,
      isAnnual,
      isTrial,
      errorMessage: error.message,
      errorStack: error.stack,
    });
    throw error;
  }
};

/**
 * Reset credits for new billing period (DEPRECATED - kept for backward compatibility)
 * This function now calls addCreditsForPeriod to ensure credits carry forward
 * @param {boolean} isAnnual - If true, stores monthly_period_end instead of current_period_end
 */
export const resetCreditsForPeriod = async (client, appInstallationId, periodEnd, includedCredits = 100, isAnnual = false) => {
  // Get current balance to add credits instead of resetting
  const metafields = await getCreditMetafields(client, appInstallationId);
  const currentBalance = metafields.credit_balance || 0;
  const newBalance = currentBalance + includedCredits;
  
  return await addCreditsForPeriod(client, appInstallationId, periodEnd, includedCredits, newBalance, isAnnual);
};

/**
 * Add credits for new billing period (credits never expire, they carry forward)
 * @param {number} creditsToAdd - Credits to add to the current balance
 * @param {number} newBalance - The new total balance after adding credits
 * @param {boolean} isAnnual - If true, stores monthly_period_end instead of current_period_end
 */
export const addCreditsForPeriod = async (client, appInstallationId, periodEnd, creditsToAdd = 100, newBalance, isAnnual = false) => {
  if (!appInstallationId) {
    appInstallationId = await getAppInstallationId(client);
  }

  // Get existing credit type balances to preserve them
  const existingMetafields = await getCreditMetafields(client, appInstallationId);
  const existingPlanCredits = existingMetafields.plan_credits_balance ?? 0;
  const existingPurchasedCredits = existingMetafields.purchased_credits_balance ?? 0;
  const existingCouponCredits = existingMetafields.coupon_credits_balance ?? 0;
  
  // Add plan credits (these are from subscription billing period)
  const newPlanCredits = existingPlanCredits + creditsToAdd;

  const now = new Date().toISOString();
  const metafields = [
    {
      ownerId: appInstallationId,
      namespace: METAFIELD_NAMESPACE,
      key: METAFIELD_KEYS.CREDIT_BALANCE,
      type: "number_integer",
      value: String(newBalance),
    },
    {
      ownerId: appInstallationId,
      namespace: METAFIELD_NAMESPACE,
      key: METAFIELD_KEYS.PLAN_CREDITS_BALANCE,
      type: "number_integer",
      value: String(newPlanCredits),
    },
    {
      ownerId: appInstallationId,
      namespace: METAFIELD_NAMESPACE,
      key: METAFIELD_KEYS.PURCHASED_CREDITS_BALANCE,
      type: "number_integer",
      value: String(existingPurchasedCredits),
    },
    {
      ownerId: appInstallationId,
      namespace: METAFIELD_NAMESPACE,
      key: METAFIELD_KEYS.COUPON_CREDITS_BALANCE,
      type: "number_integer",
      value: String(existingCouponCredits),
    },
    {
      ownerId: appInstallationId,
      namespace: METAFIELD_NAMESPACE,
      key: METAFIELD_KEYS.CREDITS_USED_THIS_PERIOD,
      type: "number_integer",
      value: "0",
    },
    {
      ownerId: appInstallationId,
      namespace: METAFIELD_NAMESPACE,
      key: METAFIELD_KEYS.LAST_CREDIT_RESET,
      type: "date_time",
      value: now,
    },
  ];

  // For annual subscriptions, store monthly period end
  // For monthly subscriptions, store billing period end
  if (isAnnual) {
    metafields.push({
      ownerId: appInstallationId,
      namespace: METAFIELD_NAMESPACE,
      key: METAFIELD_KEYS.MONTHLY_PERIOD_END,
      type: "date_time",
      value: periodEnd,
    });
  } else {
    metafields.push({
      ownerId: appInstallationId,
      namespace: METAFIELD_NAMESPACE,
      key: METAFIELD_KEYS.CURRENT_PERIOD_END,
      type: "date_time",
      value: periodEnd,
    });
  }

  const mutation = `
    mutation AddCreditsForPeriod($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) {
        metafields {
          id
          key
          value
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  try {
    const response = await client.query({
      data: { query: mutation, variables: { metafields } },
    });

    const result = response?.body?.data?.metafieldsSet;
    const userErrors = result?.userErrors || [];

    if (userErrors.length > 0) {
      throw new Error(`Credit addition failed: ${userErrors.map(e => e.message).join(", ")}`);
    }

    logger.info("[CREDIT_METAFIELD] Credits added for new period (carry forward)", {
      appInstallationId,
      periodEnd,
      creditsAdded: creditsToAdd,
      newBalance,
    });

    return result;
  } catch (error) {
    logger.error("[CREDIT_METAFIELD] Failed to add credits", error);
    throw error;
  }
};

/**
 * Add coupon redemption to history
 */
export const addCouponRedemption = async (client, appInstallationId, couponData) => {
  if (!appInstallationId) {
    appInstallationId = await getAppInstallationId(client);
  }

  // Get existing redemptions
  const existing = await getCreditMetafields(client, appInstallationId);
  const redemptions = existing[METAFIELD_KEYS.COUPON_REDEMPTIONS] || [];
  
  // Add new redemption
  const newRedemption = {
    code: couponData.code,
    redeemedAt: new Date().toISOString(),
    credits: couponData.credits,
  };
  
  redemptions.push(newRedemption);

  const mutation = `
    mutation AddCouponRedemption($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) {
        metafields {
          id
          key
          value
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const variables = {
    metafields: [
      {
        ownerId: appInstallationId,
        namespace: METAFIELD_NAMESPACE,
        key: METAFIELD_KEYS.COUPON_REDEMPTIONS,
        type: "json",
        value: JSON.stringify(redemptions),
      },
    ],
  };

  try {
    const response = await client.query({
      data: { query: mutation, variables },
    });

    const result = response?.body?.data?.metafieldsSet;
    const userErrors = result?.userErrors || [];

    if (userErrors.length > 0) {
      throw new Error(`Coupon redemption tracking failed: ${userErrors.map(e => e.message).join(", ")}`);
    }

    logger.info("[CREDIT_METAFIELD] Coupon redemption added", {
      appInstallationId,
      code: couponData.code,
      credits: couponData.credits,
    });

    return result;
  } catch (error) {
    logger.error("[CREDIT_METAFIELD] Failed to add coupon redemption", error);
    throw error;
  }
};

/**
 * Get coupon redemption history
 */
export const getCouponRedemptions = async (client, appInstallationId) => {
  if (!appInstallationId) {
    appInstallationId = await getAppInstallationId(client);
  }

  const metafields = await getCreditMetafields(client, appInstallationId);
  return metafields[METAFIELD_KEYS.COUPON_REDEMPTIONS] || [];
};

/**
 * Batch update multiple credit metafields
 */
export const batchUpdateMetafields = async (client, appInstallationId, updates) => {
  if (!appInstallationId) {
    appInstallationId = await getAppInstallationId(client);
  }

  const metafields = Object.entries(updates).map(([key, value]) => {
    // Map key to metafield key (handle both snake_case and UPPER_CASE)
    const upperKey = key.toUpperCase();
    const metafieldKey = METAFIELD_KEYS[upperKey] || key;
    let type = "single_line_text_field";
    let stringValue = String(value);
    
    logger.info("[CREDIT_METAFIELD] Mapping update key to metafield key", {
      originalKey: key,
      upperKey,
      metafieldKey,
      value,
    });

    // Determine type based on key
    if (metafieldKey === METAFIELD_KEYS.CREDIT_BALANCE || 
        metafieldKey === METAFIELD_KEYS.CREDITS_INCLUDED ||
        metafieldKey === METAFIELD_KEYS.CREDITS_USED_THIS_PERIOD ||
        metafieldKey === METAFIELD_KEYS.OVERAGE_COUNT ||
        metafieldKey === METAFIELD_KEYS.TRIAL_CREDITS_BALANCE ||
        metafieldKey === METAFIELD_KEYS.TRIAL_CREDITS_USED) {
      type = "number_integer";
      stringValue = String(value);
    } else if (metafieldKey === METAFIELD_KEYS.OVERAGE_AMOUNT) {
      type = "number_decimal";
      stringValue = String(value);
    } else if (metafieldKey === METAFIELD_KEYS.LAST_CREDIT_RESET ||
               metafieldKey === METAFIELD_KEYS.CURRENT_PERIOD_END ||
               metafieldKey === METAFIELD_KEYS.MONTHLY_PERIOD_END ||
               metafieldKey === METAFIELD_KEYS.LAST_OVERAGE_BILLED ||
               metafieldKey === METAFIELD_KEYS.TRIAL_START_DATE) {
      type = "date_time";
      stringValue = value instanceof Date ? value.toISOString() : value;
    } else if (metafieldKey === METAFIELD_KEYS.COUPON_REDEMPTIONS ||
               metafieldKey === METAFIELD_KEYS.CREDIT_TRANSACTIONS ||
               metafieldKey === METAFIELD_KEYS.TRIAL_NOTIFICATIONS_SENT) {
      type = "json";
      stringValue = typeof value === "string" ? value : JSON.stringify(value);
    } else if (metafieldKey === METAFIELD_KEYS.IS_TRIAL_PERIOD) {
      // Store as single_line_text_field: "true" or "false"
      type = "single_line_text_field";
      stringValue = (value === true || value === "true" || value === 1) ? "true" : "false";
    }

    return {
      ownerId: appInstallationId,
      namespace: METAFIELD_NAMESPACE,
      key: metafieldKey,
      type,
      value: stringValue,
    };
  });

  const mutation = `
    mutation BatchUpdateMetafields($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) {
        metafields {
          id
          key
          value
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  try {
    const response = await client.query({
      data: { query: mutation, variables: { metafields } },
    });

    const result = response?.body?.data?.metafieldsSet;
    const userErrors = result?.userErrors || [];

    if (userErrors.length > 0) {
      throw new Error(`Batch update failed: ${userErrors.map(e => e.message).join(", ")}`);
    }

    logger.info("[CREDIT_METAFIELD] Batch update completed", {
      appInstallationId,
      updatedKeys: Object.keys(updates),
      updates: updates,
      metafieldsUpdated: result?.metafields?.length || 0,
    });

    return result;
  } catch (error) {
    logger.error("[CREDIT_METAFIELD] Failed to batch update metafields", error);
    throw error;
  }
};

