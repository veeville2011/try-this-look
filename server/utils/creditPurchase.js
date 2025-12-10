/**
 * Credit Purchase Service
 * 
 * Handles credit package purchases via one-time charges
 */

import * as logger from "./logger.js";
import { CREDIT_PACKAGES } from "./billing.js";
import * as creditMetafield from "./creditMetafield.js";
import * as couponService from "./couponService.js";

/**
 * Check if a shop is a Shopify partner development store
 * @param {Object} client - GraphQL client with authenticated session
 * @returns {Promise<boolean>} True if it's a development store
 */
const checkIsDevelopmentStore = async (client) => {
  try {
    const shopInfoQuery = `
      query GetShopPlan {
        shop {
          plan {
            partnerDevelopment
          }
        }
      }
    `;

    const response = await client.query({
      data: { query: shopInfoQuery },
    });

    const shopData = response?.body?.data?.shop;
    return shopData?.plan?.partnerDevelopment === true;
  } catch (error) {
    logger.error("[CREDIT_PURCHASE] Failed to check if store is development store", error);
    return false;
  }
};

/**
 * Get available credit packages
 */
export const getCreditPackages = () => {
  return Object.values(CREDIT_PACKAGES);
};

/**
 * Get credit package by ID
 */
export const getCreditPackage = (packageId) => {
  return CREDIT_PACKAGES[packageId.toUpperCase()] || null;
};

/**
 * Calculate package price with coupon discount
 */
export const calculatePackagePrice = (packageId, couponCode = null) => {
  const package_ = getCreditPackage(packageId);
  
  if (!package_) {
    return null;
  }

  let finalPrice = package_.price;
  let discount = null;

  if (couponCode) {
    const couponConfig = couponService.getCouponConfig(couponCode);
    
    if (couponConfig && couponConfig.active) {
      // Apply discount to package price
      if (couponConfig.type === "percentage") {
        discount = finalPrice * couponConfig.value;
        finalPrice = finalPrice - discount;
      } else if (couponConfig.type === "fixed") {
        discount = couponConfig.value;
        finalPrice = Math.max(0, finalPrice - discount);
      }
    }
  }

  return {
    originalPrice: package_.price,
    finalPrice: Math.max(0, finalPrice),
    discount,
    currencyCode: package_.currencyCode,
    package: package_,
  };
};

/**
 * Create one-time charge for credit purchase
 */
export const createCreditPurchase = async (client, shop, packageId, couponCode = null) => {
  const package_ = getCreditPackage(packageId);
  
  if (!package_) {
    throw new Error(`Credit package not found: ${packageId}`);
  }

  const priceCalculation = calculatePackagePrice(packageId, couponCode);
  
  if (!priceCalculation) {
    throw new Error("Failed to calculate package price");
  }

  const appBaseUrl = process.env.VITE_SHOPIFY_APP_URL || `https://${shop}`;
  const returnUrl = `${appBaseUrl}/api/billing/return?shop=${encodeURIComponent(shop)}&type=credit_purchase&packageId=${packageId}`;

  const mutation = `
    mutation CreateCreditPurchase($name: String!, $price: MoneyInput!, $returnUrl: URL!, $test: Boolean) {
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
        }
      }
    }
  `;

  // Check if store is a development store (by Shopify plan)
  const useTestMode = await checkIsDevelopmentStore(client);

  const variables = {
    name: `Credit Package - ${package_.name}`,
    price: {
      amount: priceCalculation.finalPrice,
      currencyCode: priceCalculation.currencyCode,
    },
    returnUrl,
    test: useTestMode,
  };

  try {
    const response = await client.query({
      data: { query: mutation, variables },
    });

    const result = response?.body?.data?.appPurchaseOneTimeCreate;
    const userErrors = result?.userErrors || [];

    if (userErrors.length > 0) {
      throw new Error(`Purchase creation failed: ${userErrors.map(e => e.message).join(", ")}`);
    }

    logger.info("[CREDIT_PURCHASE] Credit purchase created", {
      shop,
      packageId,
      packageName: package_.name,
      credits: package_.credits,
      price: priceCalculation.finalPrice,
      purchaseId: result?.appPurchaseOneTime?.id,
    });

    return {
      confirmationUrl: result.confirmationUrl,
      purchaseId: result.appPurchaseOneTime.id,
      package: package_,
      price: priceCalculation,
    };
  } catch (error) {
    logger.error("[CREDIT_PURCHASE] Failed to create credit purchase", error);
    throw error;
  }
};

/**
 * Handle purchase success - add credits to balance
 */
export const handlePurchaseSuccess = async (client, appInstallationId, purchaseId, packageId) => {
  const package_ = getCreditPackage(packageId);
  
  if (!package_) {
    throw new Error(`Credit package not found: ${packageId}`);
  }

  try {
    // Get current credit balance and credit type balances
    const metafields = await creditMetafield.getCreditMetafields(client, appInstallationId);
    const currentBalance = metafields.credit_balance || 0;
    const currentPurchasedCredits = metafields.purchased_credits_balance ?? 0;
    const currentPlanCredits = metafields.plan_credits_balance ?? 0;
    const currentCouponCredits = metafields.coupon_credits_balance ?? 0;

    // Add purchased credits to purchased credits balance
    const newBalance = currentBalance + package_.credits;
    const newPurchasedCredits = currentPurchasedCredits + package_.credits;
    
    await creditMetafield.updateCreditBalance(client, appInstallationId, newBalance, {
      planCredits: currentPlanCredits,
      purchasedCredits: newPurchasedCredits,
      couponCredits: currentCouponCredits,
    });

    logger.info("[CREDIT_PURCHASE] Purchased credits added after purchase", {
      appInstallationId,
      purchaseId,
      packageId,
      creditsAdded: package_.credits,
      previousBalance: currentBalance,
      newBalance,
      previousPurchasedCredits: currentPurchasedCredits,
      newPurchasedCredits,
    });

    return {
      success: true,
      creditsAdded: package_.credits,
      creditType: "purchased",
      newBalance,
      purchasedCreditsRemaining: newPurchasedCredits,
    };
  } catch (error) {
    logger.error("[CREDIT_PURCHASE] Failed to add credits after purchase", error);
    throw error;
  }
};

