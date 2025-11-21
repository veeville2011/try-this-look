/**
 * Utility functions for Managed App Pricing
 * Shopify hosts the plan selection page for managed pricing
 */

/**
 * Get the Shopify plan selection page URL for managed pricing
 * @param shopDomain - The shop domain (e.g., "cool-shop.myshopify.com")
 * @param appHandle - The app handle configured in Partner Dashboard (defaults to app name)
 * @returns The plan selection page URL
 */
export const getPlanSelectionUrl = (
  shopDomain: string,
  appHandle?: string
): string => {
  // Extract store handle from shop domain
  // e.g., "vto-demo" from "vto-demo.myshopify.com"
  const storeHandle = shopDomain.replace(".myshopify.com", "");

  // Use provided app handle or default to "nutryon" from config
  // The app handle is configured in Partner Dashboard when setting up managed pricing
  // Format: https://admin.shopify.com/store/{store_handle}/charges/{app_handle}/pricing_plans
  const handle = appHandle || import.meta.env.VITE_APP_HANDLE || "nutryon";

  // Construct the plan selection page URL
  // Correct format for Managed App Pricing: https://admin.shopify.com/store/{store_handle}/charges/{app_handle}/pricing_plans
  return `https://admin.shopify.com/store/${storeHandle}/charges/${handle}/pricing_plans`;
};

/**
 * Redirect to Shopify's plan selection page
 * For embedded apps, this redirects to the top-level window
 * @param shopDomain - The shop domain
 * @param appHandle - Optional app handle (defaults to configured value)
 */
export const redirectToPlanSelection = (
  shopDomain: string,
  appHandle?: string
): void => {
  const url = getPlanSelectionUrl(shopDomain, appHandle);
  
  // For embedded apps, redirect to top-level window
  // This breaks out of the iframe and navigates to Shopify's plan selection page
  if (window.top && window.top !== window.self) {
    // We're in an iframe (embedded app)
    window.top.location.href = url;
  } else {
    // Not in iframe, direct redirect
    window.location.href = url;
  }
};

