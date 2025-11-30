/**
 * Usage Record Service
 * 
 * Handles creation of usage records for overage billing
 * Uses Shopify's AppUsageRecord API
 */

import * as logger from "./logger.js";

/**
 * Create a usage record for overage billing
 */
export const createUsageRecord = async (client, subscriptionLineItemId, description, price, idempotencyKey) => {
  const mutation = `
    mutation CreateUsageRecord(
      $subscriptionLineItemId: ID!
      $description: String!
      $price: MoneyInput!
      $idempotencyKey: String!
    ) {
      appUsageRecordCreate(
        subscriptionLineItemId: $subscriptionLineItemId
        description: $description
        price: $price
        idempotencyKey: $idempotencyKey
      ) {
        appUsageRecord {
          id
          description
          price {
            amount
            currencyCode
          }
          subscriptionLineItem {
            id
          }
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const variables = {
    subscriptionLineItemId,
    description,
    price: {
      amount: price,
      currencyCode: "USD",
    },
    idempotencyKey,
  };

  try {
    const response = await client.query({
      data: { query: mutation, variables },
    });

    const result = response?.body?.data?.appUsageRecordCreate;
    const userErrors = result?.userErrors || [];

    if (userErrors.length > 0) {
      const errorMessages = userErrors.map(e => e.message).join(", ");
      
      // Check for specific error types
      if (errorMessages.includes("capped amount") || errorMessages.includes("exceeded")) {
        throw new Error("CAPPED_AMOUNT_EXCEEDED");
      }
      
      throw new Error(`Usage record creation failed: ${errorMessages}`);
    }

    logger.info("[USAGE_RECORD] Usage record created", {
      subscriptionLineItemId,
      description,
      price,
      idempotencyKey,
      recordId: result?.appUsageRecord?.id,
    });

    return result?.appUsageRecord;
  } catch (error) {
    logger.error("[USAGE_RECORD] Failed to create usage record", error, null, {
      subscriptionLineItemId,
      description,
      price,
      idempotencyKey,
      errorMessage: error.message,
    });
    throw error;
  }
};

/**
 * Get current usage for a subscription line item
 */
export const getCurrentUsage = async (client, subscriptionLineItemId) => {
  // Extract subscription ID from line item ID
  // Line item ID format: gid://shopify/AppSubscriptionLineItem/{id}?v=1&index={index}
  // We need to get the subscription ID to query usage records
  // For now, we'll query through currentAppInstallation to find the subscription
  const query = `
    query GetCurrentUsage {
      currentAppInstallation {
        activeSubscriptions {
          id
          lineItems {
            id
            usageRecords(first: 250) {
              edges {
                node {
                  id
                  description
                  price {
                    amount
                    currencyCode
                  }
                  createdAt
                }
              }
            }
            plan {
              pricingDetails {
                ... on AppUsagePricing {
                  cappedAmount {
                    amount
                    currencyCode
                  }
                  balanceUsed {
                    amount
                    currencyCode
                  }
                }
              }
            }
          }
        }
      }
    }
  `;

  try {
    const response = await client.query({
      data: { query },
    });

    const installation = response?.body?.data?.currentAppInstallation;
    const subscriptions = installation?.activeSubscriptions || [];
    
    // Find the line item that matches our subscriptionLineItemId
    let targetLineItem = null;
    for (const subscription of subscriptions) {
      for (const lineItem of subscription.lineItems || []) {
        if (lineItem.id === subscriptionLineItemId) {
          targetLineItem = lineItem;
          break;
        }
      }
      if (targetLineItem) break;
    }
    
    if (!targetLineItem) {
      return {
        totalUsage: 0,
        usageCount: 0,
        cappedAmount: null,
        records: [],
      };
    }

    const records = targetLineItem.usageRecords?.edges || [];
    const totalUsage = records.reduce((sum, { node }) => {
      return sum + parseFloat(node.price?.amount || 0);
    }, 0);

    const pricingDetails = targetLineItem.plan?.pricingDetails;
    const cappedAmount = pricingDetails?.__typename === "AppUsagePricing" && pricingDetails.cappedAmount?.amount
      ? parseFloat(pricingDetails.cappedAmount.amount)
      : null;

    const currencyCode = pricingDetails?.__typename === "AppUsagePricing" && pricingDetails.cappedAmount?.currencyCode
      ? pricingDetails.cappedAmount.currencyCode
      : "USD";

    return {
      totalUsage,
      usageCount: records.length,
      cappedAmount,
      currencyCode,
      records: records.map(({ node }) => ({
        id: node.id,
        description: node.description,
        price: parseFloat(node.price?.amount || 0),
        createdAt: node.createdAt,
      })),
    };
  } catch (error) {
    logger.error("[USAGE_RECORD] Failed to get current usage", error);
    throw error;
  }
};

/**
 * Check if usage is approaching capped amount
 */
export const checkCappedAmountStatus = async (client, subscriptionLineItemId, thresholdPercent = 90) => {
  try {
    const usage = await getCurrentUsage(client, subscriptionLineItemId);
    
    if (!usage.cappedAmount) {
      return {
        approaching: false,
        percentage: 0,
        usage,
      };
    }

    const percentage = (usage.totalUsage / usage.cappedAmount) * 100;
    const approaching = percentage >= thresholdPercent;

    return {
      approaching,
      percentage: Math.round(percentage * 100) / 100,
      usage,
    };
  } catch (error) {
    logger.error("[USAGE_RECORD] Failed to check capped amount status", error);
    throw error;
  }
};

/**
 * Generate idempotency key for usage record
 */
export const generateIdempotencyKey = (shopDomain, tryonId) => {
  const timestamp = Date.now();
  const key = `${shopDomain}-${tryonId}-${timestamp}`;
  return Buffer.from(key).toString("base64").substring(0, 128);
};

