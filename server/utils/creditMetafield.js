/**
 * Credit Metafield Service
 * 
 * Handles all metafield operations for credit management
 * Stores credit data on AppInstallation object
 */

import * as logger from "./logger.js";

const METAFIELD_NAMESPACE = "nusense";
const METAFIELD_KEYS = {
  CREDIT_BALANCE: "credit_balance",
  CREDITS_INCLUDED: "credits_included",
  CREDITS_USED_THIS_PERIOD: "credits_used_this_period",
  LAST_CREDIT_RESET: "last_credit_reset",
  CURRENT_PERIOD_END: "current_period_end",
  MONTHLY_PERIOD_END: "monthly_period_end", // For annual subscriptions that reset monthly
  SUBSCRIPTION_LINE_ITEM_ID: "subscription_line_item_id",
  COUPON_REDEMPTIONS: "coupon_redemptions",
  CREDIT_TRANSACTIONS: "credit_transactions",
  // Overage tracking for annual subscriptions
  OVERAGE_COUNT: "overage_count", // Number of overage credits used this month
  OVERAGE_AMOUNT: "overage_amount", // Total amount accumulated for overage this month (in cents/dollars)
  LAST_OVERAGE_BILLED: "last_overage_billed", // Date when last overage was billed
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
        } else if (node.type === "number_integer") {
          result[node.key] = parseInt(node.value, 10);
        } else if (node.type === "number_decimal") {
          result[node.key] = parseFloat(node.value);
        } else {
          result[node.key] = node.value;
        }
      }
    });

    return result;
  } catch (error) {
    logger.error("[CREDIT_METAFIELD] Failed to get credit metafields", error);
    throw error;
  }
};

/**
 * Update credit balance metafield
 */
export const updateCreditBalance = async (client, appInstallationId, newBalance) => {
  if (!appInstallationId) {
    appInstallationId = await getAppInstallationId(client);
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

  const variables = {
    metafields: [
      {
        ownerId: appInstallationId,
        namespace: METAFIELD_NAMESPACE,
        key: METAFIELD_KEYS.CREDIT_BALANCE,
        type: "number_integer",
        value: String(newBalance),
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
      throw new Error(`Metafield update failed: ${userErrors.map(e => e.message).join(", ")}`);
    }

    logger.info("[CREDIT_METAFIELD] Credit balance updated", {
      newBalance,
      appInstallationId,
    });

    return result;
  } catch (error) {
    logger.error("[CREDIT_METAFIELD] Failed to update credit balance", error);
    throw error;
  }
};

/**
 * Initialize credits for new subscription
 */
export const initializeCredits = async (client, appInstallationId, planHandle, includedCredits = 100, periodEnd, subscriptionLineItemId = null, isAnnual = false) => {
  if (!appInstallationId) {
    appInstallationId = await getAppInstallationId(client);
  }

  const now = new Date().toISOString();
  
  // For annual subscriptions, calculate first monthly period end (first day of next month)
  // For monthly subscriptions, use the billing period end
  let actualPeriodEnd = periodEnd;
  if (isAnnual) {
    const nextMonth = new Date();
    // Set to first day of next month
    nextMonth.setMonth(nextMonth.getMonth() + 1, 1);
    nextMonth.setHours(0, 0, 0, 0); // Start of day
    actualPeriodEnd = nextMonth.toISOString();
  }

  const metafields = [
    {
      ownerId: appInstallationId,
      namespace: METAFIELD_NAMESPACE,
      key: METAFIELD_KEYS.CREDIT_BALANCE,
      type: "number_integer",
      value: String(includedCredits),
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
    const response = await client.query({
      data: { query: mutation, variables: { metafields } },
    });

    const result = response?.body?.data?.metafieldsSet;
    const userErrors = result?.userErrors || [];

    if (userErrors.length > 0) {
      throw new Error(`Credit initialization failed: ${userErrors.map(e => e.message).join(", ")}`);
    }

    logger.info("[CREDIT_METAFIELD] Credits initialized", {
      appInstallationId,
      planHandle,
      includedCredits,
      periodEnd,
    });

    return result;
  } catch (error) {
    logger.error("[CREDIT_METAFIELD] Failed to initialize credits", error);
    throw error;
  }
};

/**
 * Reset credits for new billing period
 * @param {boolean} isAnnual - If true, stores monthly_period_end instead of current_period_end
 */
export const resetCreditsForPeriod = async (client, appInstallationId, periodEnd, includedCredits = 100, isAnnual = false) => {
  if (!appInstallationId) {
    appInstallationId = await getAppInstallationId(client);
  }

  const now = new Date().toISOString();
  const metafields = [
    {
      ownerId: appInstallationId,
      namespace: METAFIELD_NAMESPACE,
      key: METAFIELD_KEYS.CREDIT_BALANCE,
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
    mutation ResetCreditsForPeriod($metafields: [MetafieldsSetInput!]!) {
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
      throw new Error(`Credit reset failed: ${userErrors.map(e => e.message).join(", ")}`);
    }

    logger.info("[CREDIT_METAFIELD] Credits reset for new period", {
      appInstallationId,
      periodEnd,
      includedCredits,
    });

    return result;
  } catch (error) {
    logger.error("[CREDIT_METAFIELD] Failed to reset credits", error);
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
    const metafieldKey = METAFIELD_KEYS[key.toUpperCase()] || key;
    let type = "single_line_text_field";
    let stringValue = String(value);

    // Determine type based on key
    if (metafieldKey === METAFIELD_KEYS.CREDIT_BALANCE || 
        metafieldKey === METAFIELD_KEYS.CREDITS_INCLUDED ||
        metafieldKey === METAFIELD_KEYS.CREDITS_USED_THIS_PERIOD ||
        metafieldKey === METAFIELD_KEYS.OVERAGE_COUNT) {
      type = "number_integer";
      stringValue = String(value);
    } else if (metafieldKey === METAFIELD_KEYS.OVERAGE_AMOUNT) {
      type = "number_decimal";
      stringValue = String(value);
    } else if (metafieldKey === METAFIELD_KEYS.LAST_CREDIT_RESET ||
               metafieldKey === METAFIELD_KEYS.CURRENT_PERIOD_END ||
               metafieldKey === METAFIELD_KEYS.MONTHLY_PERIOD_END ||
               metafieldKey === METAFIELD_KEYS.LAST_OVERAGE_BILLED) {
      type = "date_time";
      stringValue = value instanceof Date ? value.toISOString() : value;
    } else if (metafieldKey === METAFIELD_KEYS.COUPON_REDEMPTIONS ||
               metafieldKey === METAFIELD_KEYS.CREDIT_TRANSACTIONS) {
      type = "json";
      stringValue = JSON.stringify(value);
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
    });

    return result;
  } catch (error) {
    logger.error("[CREDIT_METAFIELD] Failed to batch update metafields", error);
    throw error;
  }
};

