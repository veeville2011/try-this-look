/**
 * Billing redirect utility for Shopify embedded apps.
 * Uses App Bridge Redirect to open confirmation URLs in the same tab (or new tab when requested),
 * with fallback to window.location when not in embedded context.
 */

const isValidConfirmationUrl = (url: string): boolean => {
  if (!url || typeof url !== "string") return false;
  const trimmed = url.trim();
  return trimmed.length > 0 && (trimmed.startsWith("http://") || trimmed.startsWith("https://"));
};

/**
 * Redirects to a Shopify billing/charge confirmation URL.
 * In embedded context uses App Bridge so the flow stays in the same browser tab.
 * Validates URL and falls back to window.location if App Bridge is unavailable or fails.
 *
 * @param url - The confirmation URL from Shopify (e.g. from appSubscriptionCreate or appPurchaseOneTimeCreate).
 * @param newContext - If true, opens in a new tab. If false (default), navigates in the same tab.
 * @throws Error if url is invalid (empty or not http(s)) so callers can show an error message.
 */
export const redirectToConfirmationUrl = async (
  url: string,
  newContext: boolean = false
): Promise<void> => {
  if (typeof window === "undefined") return;
  if (!isValidConfirmationUrl(url)) {
    console.warn("[billingRedirect] Invalid or missing confirmation URL");
    throw new Error("Invalid confirmation URL");
  }

  const appBridge = (window as any).__APP_BRIDGE ?? null;

  if (!appBridge) {
    window.location.href = url.trim();
    return;
  }

  try {
    const { Redirect } = await import("@shopify/app-bridge/actions");
    const redirect = Redirect.create(appBridge);
    redirect.dispatch(Redirect.Action.REMOTE, {
      url: url.trim(),
      newContext,
    });
  } catch (error) {
    console.warn("[billingRedirect] App Bridge redirect failed, falling back to window.location", error);
    window.location.href = url.trim();
  }
};
