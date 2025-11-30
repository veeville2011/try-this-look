/**
 * Coupon Code Service
 * 
 * Handles validation and redemption of coupon codes
 * Manages coupon configuration and usage tracking
 */

import * as logger from "./logger.js";
import { COUPON_CODES } from "./billing.js";
import * as creditMetafield from "./creditMetafield.js";

/**
 * Get coupon configuration
 */
export const getCouponConfig = (code) => {
  if (!code) return null;
  
  const normalizedCode = code.toUpperCase().trim();
  return COUPON_CODES[normalizedCode] || null;
};

/**
 * Get all available coupons
 */
export const getAvailableCoupons = () => {
  return Object.values(COUPON_CODES).filter(coupon => coupon.active);
};

/**
 * Check if coupon has been used by shop
 */
export const checkCouponUsage = async (client, appInstallationId, code) => {
  try {
    const redemptions = await creditMetafield.getCouponRedemptions(client, appInstallationId);
    const normalizedCode = code.toUpperCase().trim();
    
    return redemptions.some(redemption => redemption.code.toUpperCase() === normalizedCode);
  } catch (error) {
    logger.error("[COUPON_SERVICE] Failed to check coupon usage", error);
    throw error;
  }
};

/**
 * Validate coupon code
 */
export const validateCouponCode = async (client, appInstallationId, code) => {
  if (!code) {
    return {
      valid: false,
      error: "INVALID_CODE",
      message: "Coupon code is required",
    };
  }

  const normalizedCode = code.toUpperCase().trim();
  const couponConfig = getCouponConfig(normalizedCode);

  // Check if code exists
  if (!couponConfig) {
    return {
      valid: false,
      error: "INVALID_CODE",
      message: "Coupon code is invalid",
    };
  }

  // Check if active
  if (!couponConfig.active) {
    return {
      valid: false,
      error: "INACTIVE_CODE",
      message: "Coupon code is not active",
    };
  }

  // Check expiration
  if (couponConfig.expiresAt) {
    const expiresAt = new Date(couponConfig.expiresAt);
    const now = new Date();
    
    if (now > expiresAt) {
      return {
        valid: false,
        error: "EXPIRED_CODE",
        message: "Coupon code has expired",
      };
    }
  }

  // Check per-shop usage limit
  if (couponConfig.usageLimit?.perShop) {
    const alreadyUsed = await checkCouponUsage(client, appInstallationId, normalizedCode);
    
    if (alreadyUsed) {
      // Check if multiple uses allowed
      const redemptions = await creditMetafield.getCouponRedemptions(client, appInstallationId);
      const shopRedemptions = redemptions.filter(
        r => r.code.toUpperCase() === normalizedCode
      );
      
      if (shopRedemptions.length >= couponConfig.usageLimit.perShop) {
        return {
          valid: false,
          error: "USAGE_LIMIT_EXCEEDED",
          message: `This coupon code can only be used ${couponConfig.usageLimit.perShop} time(s)`,
        };
      }
    }
  }

  // Global usage limit check (would require tracking across all shops - simplified for now)
  // In production, you might want to track global usage in a separate metafield or database

  return {
    valid: true,
    code: normalizedCode,
    credits: couponConfig.credits,
    config: couponConfig,
  };
};

/**
 * Redeem coupon code and add credits
 */
export const redeemCouponCode = async (client, appInstallationId, code) => {
  // Validate coupon
  const validation = await validateCouponCode(client, appInstallationId, code);
  
  if (!validation.valid) {
    return validation;
  }

  try {
    // Get current credit balance
    const metafields = await creditMetafield.getCreditMetafields(client, appInstallationId);
    const currentBalance = metafields.credit_balance || 0;
    const creditsToAdd = validation.credits;

    // Add credits to balance
    await creditMetafield.updateCreditBalance(
      client,
      appInstallationId,
      currentBalance + creditsToAdd
    );

    // Track redemption
    await creditMetafield.addCouponRedemption(client, appInstallationId, {
      code: validation.code,
      credits: creditsToAdd,
    });

    logger.info("[COUPON_SERVICE] Coupon redeemed successfully", {
      code: validation.code,
      creditsAdded: creditsToAdd,
      newBalance: currentBalance + creditsToAdd,
    });

    return {
      success: true,
      code: validation.code,
      creditsAdded: creditsToAdd,
      newBalance: currentBalance + creditsToAdd,
      message: `${creditsToAdd} credits added successfully`,
    };
  } catch (error) {
    logger.error("[COUPON_SERVICE] Failed to redeem coupon", error);
    return {
      success: false,
      error: "REDEMPTION_FAILED",
      message: "Failed to redeem coupon code. Please try again.",
    };
  }
};

