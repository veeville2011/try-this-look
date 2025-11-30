/**
 * Annual Overage Billing Service
 * 
 * Handles overage billing for annual subscriptions
 * Since annual subscriptions don't support usage billing, we accumulate
 * overage charges throughout the month and bill via one-time charge at month end
 */

import * as logger from "./logger.js";
import * as creditMetafield from "./creditMetafield.js";

const USAGE_PRICE_PER_CREDIT = 0.20; // $0.20 per try-on after included credits

/**
 * Track overage usage for annual subscriptions
 * @param {Object} client - GraphQL client
 * @param {string} appInstallationId - App installation ID
 * @param {number} count - Number of overage credits to add
 * @returns {Promise<Object>} Updated overage tracking
 */
export const trackOverageUsage = async (client, appInstallationId, count = 1) => {
  try {
    const metafields = await creditMetafield.getCreditMetafields(client, appInstallationId);
    
    const currentOverageCount = metafields.overage_count || 0;
    const currentOverageAmount = metafields.overage_amount || 0;
    
    const newOverageCount = currentOverageCount + count;
    const additionalAmount = count * USAGE_PRICE_PER_CREDIT;
    const newOverageAmount = currentOverageAmount + additionalAmount;
    
    await creditMetafield.batchUpdateMetafields(client, appInstallationId, {
      overage_count: newOverageCount,
      overage_amount: newOverageAmount,
    });
    
    logger.info("[ANNUAL_OVERAGE] Overage usage tracked", {
      appInstallationId,
      count,
      totalOverageCount: newOverageCount,
      totalOverageAmount: newOverageAmount,
      additionalAmount,
    });
    
    return {
      overageCount: newOverageCount,
      overageAmount: newOverageAmount,
      additionalAmount,
    };
  } catch (error) {
    logger.error("[ANNUAL_OVERAGE] Failed to track overage usage", error);
    throw error;
  }
};

/**
 * Get current overage tracking
 * @param {Object} client - GraphQL client
 * @param {string} appInstallationId - App installation ID
 * @returns {Promise<Object>} Current overage tracking
 */
export const getOverageTracking = async (client, appInstallationId) => {
  try {
    const metafields = await creditMetafield.getCreditMetafields(client, appInstallationId);
    
    return {
      overageCount: metafields.overage_count || 0,
      overageAmount: metafields.overage_amount || 0,
      lastOverageBilled: metafields.last_overage_billed || null,
    };
  } catch (error) {
    logger.error("[ANNUAL_OVERAGE] Failed to get overage tracking", error);
    throw error;
  }
};

/**
 * Create one-time charge for accumulated overage
 * @param {Object} client - GraphQL client
 * @param {string} shopDomain - Shop domain
 * @param {number} amount - Amount to charge (in dollars)
 * @param {number} overageCount - Number of overage credits
 * @param {boolean} isTest - Whether this is a test charge
 * @returns {Promise<Object>} One-time charge creation result
 */
export const createOverageCharge = async (client, shopDomain, amount, overageCount, isTest = false) => {
  try {
    const appBaseUrl = process.env.VITE_SHOPIFY_APP_URL || `https://${shopDomain}`;
    const returnUrl = `${appBaseUrl}/api/billing/return?shop=${encodeURIComponent(shopDomain)}&type=overage_billing`;
    
    const mutation = `
      mutation CreateOverageCharge($name: String!, $price: MoneyInput!, $returnUrl: URL!, $test: Boolean) {
        appPurchaseOneTimeCreate(
          name: $name
          price: $price
          returnUrl: $returnUrl
          test: $test
        ) {
          userErrors {
            field
            message
          }
          confirmationUrl
          appPurchaseOneTime {
            id
            name
            price {
              amount
              currencyCode
            }
            status
          }
        }
      }
    `;
    
    const variables = {
      name: `Monthly Overage Billing - ${overageCount} try-on${overageCount !== 1 ? 's' : ''} (${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })})`,
      price: {
        amount: amount,
        currencyCode: "USD",
      },
      returnUrl,
      test: isTest,
    };
    
    const response = await client.query({
      data: { query: mutation, variables },
    });
    
    const result = response?.body?.data?.appPurchaseOneTimeCreate;
    
    if (!result) {
      throw new Error("Unexpected response from appPurchaseOneTimeCreate - no data returned");
    }
    
    const userErrors = result.userErrors || [];
    
    if (userErrors.length > 0) {
      throw new Error(`Overage charge creation failed: ${userErrors.map(e => e.message).join(", ")}`);
    }
    
    // Validate that we have the required response data
    if (!result.appPurchaseOneTime || !result.appPurchaseOneTime.id) {
      throw new Error("Unexpected response from appPurchaseOneTimeCreate - missing appPurchaseOneTime or id");
    }
    
    logger.info("[ANNUAL_OVERAGE] Overage charge created", {
      shop: shopDomain,
      amount,
      overageCount,
      purchaseId: result.appPurchaseOneTime.id,
      confirmationUrl: result.confirmationUrl || null,
      note: result.confirmationUrl ? "Merchant approval required" : "No confirmation URL returned",
    });
    
    return {
      confirmationUrl: result.confirmationUrl || null,
      purchaseId: result.appPurchaseOneTime.id,
      amount,
      overageCount,
    };
  } catch (error) {
    logger.error("[ANNUAL_OVERAGE] Failed to create overage charge", error);
    throw error;
  }
};

/**
 * Bill accumulated overage and reset tracking
 * Called at month end when credits reset for annual subscriptions
 * @param {Object} client - GraphQL client
 * @param {string} shopDomain - Shop domain
 * @param {string} appInstallationId - App installation ID
 * @param {boolean} isTest - Whether this is a test charge
 * @returns {Promise<Object>} Billing result
 */
export const billAccumulatedOverage = async (client, shopDomain, appInstallationId, isTest = false) => {
  try {
    const tracking = await getOverageTracking(client, appInstallationId);
    
    // If no overage, nothing to bill
    if (tracking.overageCount === 0 || tracking.overageAmount === 0) {
      logger.info("[ANNUAL_OVERAGE] No overage to bill", {
        shop: shopDomain,
        appInstallationId,
      });
      
      // Reset overage tracking
      await creditMetafield.batchUpdateMetafields(client, appInstallationId, {
        overage_count: 0,
        overage_amount: 0,
        last_overage_billed: new Date().toISOString(),
      });
      
      return {
        billed: false,
        amount: 0,
        overageCount: 0,
      };
    }
    
    // Round amount to 2 decimal places
    const amount = Math.round(tracking.overageAmount * 100) / 100;
    
    // Shopify requires minimum price of 0.50 and maximum of 10,000
    // If amount is less than 0.50, don't bill yet - accumulate more
    if (amount < 0.50) {
      logger.info("[ANNUAL_OVERAGE] Amount below minimum, skipping billing", {
        shop: shopDomain,
        appInstallationId,
        amount,
        overageCount: tracking.overageCount,
        note: "Will bill when amount reaches $0.50 minimum",
      });
      
      return {
        billed: false,
        amount,
        overageCount: tracking.overageCount,
        reason: "BELOW_MINIMUM",
        note: "Amount below $0.50 minimum. Will bill when threshold is reached.",
      };
    }
    
    // Shopify maximum price is 10,000
    // If amount exceeds maximum, cap it and log a warning
    let finalAmount = amount;
    let isCapped = false;
    
    if (amount > 10000) {
      logger.warn("[ANNUAL_OVERAGE] Amount exceeds maximum, capping at $10,000", {
        shop: shopDomain,
        appInstallationId,
        originalAmount: amount,
        cappedAmount: 10000,
        overageCount: tracking.overageCount,
        note: "Shopify maximum charge limit is $10,000. Amount has been capped.",
      });
      
      finalAmount = 10000;
      isCapped = true;
    }
    
    // Create one-time charge
    const chargeResult = await createOverageCharge(
      client,
      shopDomain,
      finalAmount,
      tracking.overageCount,
      isTest
    );
    
    // Reset overage tracking after successful charge creation
    await creditMetafield.batchUpdateMetafields(client, appInstallationId, {
      overage_count: 0,
      overage_amount: 0,
      last_overage_billed: new Date().toISOString(),
    });
    
    logger.info("[ANNUAL_OVERAGE] Overage billed and tracking reset", {
      shop: shopDomain,
      appInstallationId,
      amount: finalAmount,
      originalAmount: isCapped ? amount : finalAmount,
      overageCount: tracking.overageCount,
      purchaseId: chargeResult.purchaseId,
      capped: isCapped,
    });
    
    return {
      billed: true,
      amount: finalAmount,
      originalAmount: isCapped ? amount : undefined,
      overageCount: tracking.overageCount,
      purchaseId: chargeResult.purchaseId,
      confirmationUrl: chargeResult.confirmationUrl,
      capped: isCapped,
    };
  } catch (error) {
    logger.error("[ANNUAL_OVERAGE] Failed to bill accumulated overage", error);
    throw error;
  }
};

