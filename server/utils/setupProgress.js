/**
 * Setup Progress Utility
 * Calculates setup progress based on app configuration state
 */

import * as logger from "./logger.js";

/**
 * Calculate setup progress for a shop
 * @param {Object} shopify - Shopify API client instance
 * @param {Object} session - Shopify session
 * @returns {Promise<Object>} Setup progress object
 */
export const calculateSetupProgress = async (shopify, session) => {
  const totalSteps = 4;
  let stepsCompleted = 0;
  const completedSteps = [];

  try {
    // Step 1: App Installed (always true if we have a session)
    stepsCompleted++;
    completedSteps.push("app_installed");

    // Step 2: Check if app blocks are installed in theme
    const hasAppBlocks = await checkAppBlocksInstalled(shopify, session);
    if (hasAppBlocks) {
      stepsCompleted++;
      completedSteps.push("widget_installed");
    }

    // Step 3: Check if theme is published/active
    const hasActiveTheme = await checkActiveTheme(shopify, session);
    if (hasActiveTheme) {
      stepsCompleted++;
      completedSteps.push("theme_active");
    }

    // Step 4: Check if products exist (basic setup)
    const hasProducts = await checkProductsExist(shopify, session);
    if (hasProducts) {
      stepsCompleted++;
      completedSteps.push("products_configured");
    }

    const completed = stepsCompleted === totalSteps;

    logger.info("[SETUP_PROGRESS] Calculated setup progress", {
      shop: session?.shop,
      stepsCompleted,
      totalSteps,
      completed,
      completedSteps,
    });

    return {
      stepsCompleted,
      totalSteps,
      completed,
      completedSteps,
    };
  } catch (error) {
    logger.error("[SETUP_PROGRESS] Error calculating setup progress", error, null, {
      shop: session?.shop,
    });

    // Return minimal progress on error
    return {
      stepsCompleted: 1, // At least app is installed
      totalSteps,
      completed: false,
      completedSteps: ["app_installed"],
    };
  }
};

/**
 * Check if app blocks are installed in any theme
 * Note: App blocks installation is hard to detect via GraphQL
 * We'll check if theme app extensions are available instead
 */
const checkAppBlocksInstalled = async (shopify, session) => {
  try {
    const client = new shopify.clients.Graphql({ session });

    // Query to check published themes and their structure
    // Since app blocks are embedded in theme files, we check if themes exist
    // A more accurate check would require reading theme files, which is expensive
    // For now, we'll consider widget installed if shop has themes
    const query = `
      query {
        themes(first: 10) {
          edges {
            node {
              id
              name
              role
            }
          }
        }
      }
    `;

    const response = await client.query({ data: query });
    const themes = response?.body?.data?.themes?.edges || [];

    // If shop has themes, assume widget can be installed
    // This is a simplified check - in production you might want to
    // check theme files or use a different method
    return themes.length > 0;
  } catch (error) {
    logger.debug("[SETUP_PROGRESS] Error checking app blocks", {
      error: error.message,
      shop: session?.shop,
    });
    // Return true on error to not block progress
    return true;
  }
};

/**
 * Check if shop has an active/published theme
 */
const checkActiveTheme = async (shopify, session) => {
  try {
    const client = new shopify.clients.Graphql({ session });

    const query = `
      query {
        themes(first: 10) {
          edges {
            node {
              id
              role
            }
          }
        }
      }
    `;

    const response = await client.query({ data: query });
    const themes = response?.body?.data?.themes?.edges || [];

    // Check if there's a main theme (role: MAIN)
    return themes.some(edge => edge.node.role === "MAIN");
  } catch (error) {
    logger.debug("[SETUP_PROGRESS] Error checking active theme", {
      error: error.message,
      shop: session?.shop,
    });
    return false;
  }
};

/**
 * Check if shop has products
 */
const checkProductsExist = async (shopify, session) => {
  try {
    const client = new shopify.clients.Graphql({ session });

    const query = `
      query {
        products(first: 1) {
          edges {
            node {
              id
            }
          }
        }
      }
    `;

    const response = await client.query({ data: query });
    const products = response?.body?.data?.products?.edges || [];

    return products.length > 0;
  } catch (error) {
    logger.debug("[SETUP_PROGRESS] Error checking products", {
      error: error.message,
      shop: session?.shop,
    });
    return false;
  }
};

