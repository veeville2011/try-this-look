/**
 * Utility functions for managing app-data metafield for subscription status
 * This metafield is used to conditionally show/hide app blocks and banners
 */

import * as logger from "./logger.js";
import * as creditManager from "./creditManager.js";

/**
 * Determine if app blocks should be available
 * Blocks are available if:
 * 1. Subscription is active (ACTIVE, PENDING, or TRIAL), OR
 * 2. Total credits (trial + plan + coupon + promotion) > 0
 * @param {Object} client - GraphQL client with authenticated session
 * @param {string} appInstallationId - App installation ID
 * @param {string|null} subscriptionStatus - Subscription status (ACTIVE, PENDING, TRIAL, etc.)
 * @returns {Promise<boolean>} True if blocks should be available
 */
export const shouldBlocksBeAvailable = async (
  client,
  appInstallationId,
  subscriptionStatus
) => {
  try {
    // Check if subscription is active (ACTIVE, PENDING, or TRIAL)
    const hasActiveSubscription = 
      subscriptionStatus === "ACTIVE" || 
      subscriptionStatus === "PENDING" ||
      subscriptionStatus === "TRIAL";
    
    if (hasActiveSubscription) {
      logger.info("[METAFIELD] Blocks available - active subscription", {
        appInstallationId,
        subscriptionStatus,
      });
      return true;
    }
    
    // Check if total credits > 0 (trial + plan + coupon + promotion credits)
    try {
      const creditData = await creditManager.getTotalCreditsAvailable(
        client,
        appInstallationId
      );
      
      const totalCredits = creditData?.balance ?? 0;
      const hasCredits = totalCredits > 0;
      
      logger.info("[METAFIELD] Credit check for block availability", {
        appInstallationId,
        subscriptionStatus,
        totalCredits,
        hasCredits,
        blocksAvailable: hasCredits,
      });
      
      return hasCredits;
    } catch (creditError) {
      // If we can't check credits, log and return false (safer default)
      logger.warn("[METAFIELD] Failed to check credits for block availability", creditError, null, {
        appInstallationId,
        subscriptionStatus,
        errorMessage: creditError.message,
      });
      return false;
    }
  } catch (error) {
    logger.error("[METAFIELD] Error determining block availability", error, null, {
      appInstallationId,
      subscriptionStatus,
      errorMessage: error.message,
    });
    // On error, default to false (blocks not available) for safety
    return false;
  }
};

/**
 * Update app-data metafield to reflect subscription status
 * This metafield controls visibility of app blocks and banners via available_if
 * @param {Object} client - GraphQL client with authenticated session
 * @param {string} appInstallationId - App installation ID (gid://shopify/AppInstallation/...)
 * @param {boolean} hasActiveSubscription - Whether subscription is active
 * @returns {Promise<Object>} Result of metafield update
 */
export const updateSubscriptionMetafield = async (
  client,
  appInstallationId,
  hasActiveSubscription
) => {
  try {
    const mutation = `
      mutation UpdateSubscriptionMetafield($metafields: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $metafields) {
          metafields {
            id
            namespace
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

    // CRITICAL: Boolean metafields require lowercase "true"/"false" strings
    const booleanValue = hasActiveSubscription ? "true" : "false";
    
    const variables = {
      metafields: [
        {
          ownerId: appInstallationId,
          namespace: "subscription",
          key: "active",
          type: "boolean",
          value: booleanValue,
        },
      ],
    };

    logger.info("[METAFIELD] Updating subscription metafield", {
      appInstallationId,
      hasActiveSubscription,
    });

    const response = await client.request(mutation, {
      variables,
    });

    if (response.data?.metafieldsSet?.userErrors?.length > 0) {
      const errors = response.data.metafieldsSet.userErrors;
      logger.error("[METAFIELD] Error updating subscription metafield", null, null, {
        errors,
        appInstallationId,
        hasActiveSubscription,
      });
      throw new Error(
        `Failed to update subscription metafield: ${errors.map((e) => e.message).join(", ")}`
      );
    }

    const updatedMetafield = response.data?.metafieldsSet?.metafields?.[0];
    
    if (!updatedMetafield) {
      throw new Error("Metafield update succeeded but no metafield returned in response");
    }

    logger.info("[METAFIELD] Successfully updated subscription metafield", {
      appInstallationId,
      hasActiveSubscription,
      metafieldId: updatedMetafield.id,
      metafieldValue: updatedMetafield.value,
      namespace: updatedMetafield.namespace,
      key: updatedMetafield.key,
    });

    // Verify the metafield was actually set correctly
    try {
      const verified = await verifySubscriptionMetafield(
        client,
        appInstallationId,
        hasActiveSubscription
      );
      if (!verified) {
        logger.warn("[METAFIELD] Metafield update succeeded but verification failed", {
          appInstallationId,
          expectedValue: booleanValue,
        });
      } else {
        logger.info("[METAFIELD] Metafield verified successfully after update", {
          appInstallationId,
        });
      }
    } catch (verifyError) {
      // Don't fail the update if verification fails - log and continue
      logger.warn("[METAFIELD] Failed to verify metafield after update", verifyError, null, {
        appInstallationId,
        errorMessage: verifyError.message,
      });
    }

    return updatedMetafield;
  } catch (error) {
    logger.error("[METAFIELD] Exception updating subscription metafield", error, null, {
      appInstallationId,
      hasActiveSubscription,
      errorMessage: error.message,
    });
    throw error;
  }
};

/**
 * Verify that the subscription metafield exists and has the correct value
 * @param {Object} client - GraphQL client with authenticated session
 * @param {string} appInstallationId - App installation ID
 * @param {boolean} expectedValue - Expected boolean value
 * @returns {Promise<boolean>} True if metafield exists and matches expected value
 */
export const verifySubscriptionMetafield = async (
  client,
  appInstallationId,
  expectedValue
) => {
  try {
    const query = `
      query VerifySubscriptionMetafield($ownerId: ID!, $namespace: String!, $key: String!) {
        appInstallation(id: $ownerId) {
          metafield(namespace: $namespace, key: $key) {
            id
            namespace
            key
            value
            type
          }
        }
      }
    `;

    const variables = {
      ownerId: appInstallationId,
      namespace: "subscription",
      key: "active",
    };

    const response = await client.request(query, { variables });

    const metafield = response.data?.appInstallation?.metafield;

    if (!metafield) {
      logger.warn("[METAFIELD] Verification: Metafield does not exist", {
        appInstallationId,
        namespace: variables.namespace,
        key: variables.key,
      });
      return false;
    }

    // Boolean values are returned as strings "true" or "false"
    const actualValue = metafield.value === "true" || metafield.value === true;
    const matches = actualValue === expectedValue;

    logger.info("[METAFIELD] Verification result", {
      appInstallationId,
      expectedValue,
      actualValue: metafield.value,
      matches,
      metafieldId: metafield.id,
    });

    return matches;
  } catch (error) {
    logger.error("[METAFIELD] Error verifying subscription metafield", error, null, {
      appInstallationId,
      expectedValue,
      errorMessage: error.message,
    });
    throw error;
  }
};

/**
 * Ensure the subscription metafield exists, creating it if missing
 * This is critical for app blocks to be visible - if the metafield doesn't exist,
 * Liquid's available_if condition will fail
 * @param {Object} client - GraphQL client with authenticated session
 * @param {string} appInstallationId - App installation ID
 * @param {string|null} subscriptionStatus - Current subscription status (ACTIVE, PENDING, TRIAL, etc.)
 * @returns {Promise<Object>} The metafield object (created or existing)
 */
export const ensureSubscriptionMetafieldExists = async (
  client,
  appInstallationId,
  subscriptionStatus = null
) => {
  try {
    // First, check if metafield exists
    const query = `
      query CheckSubscriptionMetafield($ownerId: ID!, $namespace: String!, $key: String!) {
        appInstallation(id: $ownerId) {
          metafield(namespace: $namespace, key: $key) {
            id
            namespace
            key
            value
            type
          }
        }
      }
    `;

    const variables = {
      ownerId: appInstallationId,
      namespace: "subscription",
      key: "active",
    };

    const response = await client.request(query, { variables });
    const existingMetafield = response.data?.appInstallation?.metafield;

    // If metafield exists, return it
    if (existingMetafield) {
      logger.info("[METAFIELD] Metafield already exists", {
        appInstallationId,
        metafieldId: existingMetafield.id,
        currentValue: existingMetafield.value,
      });
      return existingMetafield;
    }

    // Metafield doesn't exist - determine initial value based on subscription status or credits
    logger.info("[METAFIELD] Metafield does not exist, creating it", {
      appInstallationId,
      subscriptionStatus,
    });

    // Determine initial value: check if blocks should be available
    const shouldBeAvailable = await shouldBlocksBeAvailable(
      client,
      appInstallationId,
      subscriptionStatus
    );

    // Create the metafield with the determined value
    const createdMetafield = await updateSubscriptionMetafield(
      client,
      appInstallationId,
      shouldBeAvailable
    );

    logger.info("[METAFIELD] Metafield created successfully", {
      appInstallationId,
      metafieldId: createdMetafield.id,
      initialValue: createdMetafield.value,
    });

    return createdMetafield;
  } catch (error) {
    logger.error("[METAFIELD] Error ensuring subscription metafield exists", error, null, {
      appInstallationId,
      subscriptionStatus,
      errorMessage: error.message,
      stack: error.stack,
    });
    throw error;
  }
};

/**
 * Get current app installation ID for a shop
 * @param {Object} client - GraphQL client with authenticated session
 * @returns {Promise<string>} App installation ID
 */
export const getAppInstallationId = async (client) => {
  try {
    const query = `
      query GetAppInstallation {
        currentAppInstallation {
          id
        }
      }
    `;

    const response = await client.request(query);

    if (!response.data?.currentAppInstallation?.id) {
      throw new Error("App installation ID not found");
    }

    return response.data.currentAppInstallation.id;
  } catch (error) {
    logger.error("[METAFIELD] Error getting app installation ID", error, null, {
      errorMessage: error.message,
    });
    throw error;
  }
};

