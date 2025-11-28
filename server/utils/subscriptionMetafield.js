/**
 * Utility functions for managing app-data metafield for subscription status
 * This metafield is used to conditionally show/hide app blocks and banners
 */

import * as logger from "./logger.js";

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

    const variables = {
      metafields: [
        {
          ownerId: appInstallationId,
          namespace: "subscription",
          key: "active",
          type: "boolean",
          value: String(hasActiveSubscription),
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

    logger.info("[METAFIELD] Successfully updated subscription metafield", {
      appInstallationId,
      hasActiveSubscription,
      metafieldId: response.data?.metafieldsSet?.metafields?.[0]?.id,
    });

    return response.data?.metafieldsSet?.metafields?.[0];
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

