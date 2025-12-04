import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useShop } from "@/providers/AppBridgeProvider";
import { useSubscription } from "@/hooks/useSubscription";
import { useCredits } from "@/hooks/useCredits";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Sparkles,
  CheckCircle2,
  Store,
  Settings,
  Zap,
  Shield,
  Link2,
  Crown,
  Check,
  Calendar,
  CreditCard,
  Sparkle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import QuickActions from "@/components/QuickActions";
import FeatureHighlights from "@/components/FeatureHighlights";
import PlanSelection from "@/components/PlanSelection";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import TrialNotificationBanner from "@/components/TrialNotificationBanner";

const Index = () => {
  const { t, i18n } = useTranslation();
  // Deep linking configuration
  const API_KEY = "f8de7972ae23d3484581d87137829385"; // From shopify.app.toml client_id
  const APP_BLOCK_HANDLE = "nusense-tryon-button";
  const APP_HANDLE = "nutryon"; // App handle for Managed Pricing (from Partner Dashboard)

  // App Bridge hooks for embedded app
  const shop = useShop();

  // Subscription state
  const [currentPlan, setCurrentPlan] = useState<string | null>(null);
  const [availablePlans, setAvailablePlans] = useState<any[]>([]);
  const [billingLoading, setBillingLoading] = useState(false);
  const [showPlanSelection, setShowPlanSelection] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  // Use subscription hook to check subscription status
  const {
    subscription,
    loading: subscriptionLoading,
    error: subscriptionError,
    refresh: refreshSubscription,
  } = useSubscription();

  // Use credits hook to get credit information
  const {
    credits,
    loading: creditsLoading,
    error: creditsError,
    refresh: refreshCredits,
  } = useCredits();

  // Sync store information to remote backend on first load
  useEffect(() => {
    const syncStoreInfo = async () => {
      try {
        // Check if we're in embedded context
        const urlParams = new URLSearchParams(window.location.search);
        const shopParam = urlParams.get("shop");
        const hostParam = urlParams.get("host");

        if (!shopParam || !hostParam) {
          // Not in embedded context, skip sync
          return;
        }

        // Wait for AppBridge to be available
        const appBridge = (window as any).__APP_BRIDGE;
        if (!appBridge) {
          // AppBridge not ready yet, skip sync
          return;
        }

        // Get JWT session token using authenticated fetch
        const { authenticatedFetch } = await import(
          "@shopify/app-bridge-utils"
        );
        const fetchFn = authenticatedFetch(appBridge);

        // Call backend API to sync store information
        const response = await fetchFn("/api/stores/sync", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          credentials: "same-origin",
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.warn("[STORES] Store sync failed:", errorData);
        } else {
          const data = await response.json();
          if (import.meta.env.DEV) {
            console.info("[STORES] Store sync initiated:", data);
          }
        }
      } catch (error) {
        // Log error but don't block app functionality
        if (import.meta.env.DEV) {
          console.warn("[STORES] Store sync error:", error);
        }
      }
    };

    // Run sync once on component mount
    syncStoreInfo();
  }, []); // Empty dependency array - run only once on mount

  const fetchAvailablePlans = async () => {
    try {
      // Use authenticated fetch with App Bridge to include JWT
      const appBridge = (window as any).__APP_BRIDGE;
      if (!appBridge) {
        throw new Error("App Bridge not available");
      }

      const { authenticatedFetch } = await import("@shopify/app-bridge-utils");
      const fetchFn = authenticatedFetch(appBridge);

      const response = await fetchFn("/api/billing/plans", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        credentials: "same-origin",
      });

      if (!response.ok) {
        throw new Error(t("index.errors.cannotFetchPlans"));
      }

      const data = await response.json();
      setAvailablePlans(Array.isArray(data.plans) ? data.plans : []);
    } catch (error: any) {
      console.error("[Billing] Failed to load plans", error);
    }
  };

  const handleRequireBilling = async () => {
    const shopDomain =
      shop || new URLSearchParams(window.location.search).get("shop");

    if (!shopDomain) {
      return;
    }

    if (!availablePlans.length) {
      await fetchAvailablePlans();
    }

    // Show plan selection UI instead of auto-selecting
    setShowPlanSelection(true);
  };

  const handleCancelSubscription = async () => {
    const shopDomain =
      shop || new URLSearchParams(window.location.search).get("shop");

    if (!shopDomain || !subscription?.subscription?.id) {
      return;
    }

    // Confirmation dialog
    const confirmed = window.confirm(t("index.errors.confirmCancel"));

    if (!confirmed) {
      return;
    }

    try {
      setCancelling(true);

      const appBridge = (window as any).__APP_BRIDGE;
      if (!appBridge) {
        throw new Error("App Bridge not available");
      }

      const { authenticatedFetch } = await import("@shopify/app-bridge-utils");
      const fetchFn = authenticatedFetch(appBridge);

      const response = await fetchFn("/api/billing/cancel", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          shop: shopDomain,
          subscriptionId: subscription.subscription.id,
          prorate: false, // Don't prorate - let subscription continue until period end
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || t("index.errors.cancelFailed"));
      }

      const data = await response.json();

      // Refresh subscription status
      await refreshSubscription();

      console.log("[Billing] Subscription cancelled successfully", data);
    } catch (error: any) {
      console.error("[Billing] Failed to cancel subscription", error);
      alert(error.message || t("index.errors.cancelError"));
    } finally {
      setCancelling(false);
    }
  };

  const handleSelectPlan = async (planHandle: string) => {
    const shopDomain =
      shop || new URLSearchParams(window.location.search).get("shop");

    if (!shopDomain) {
      return;
    }

    try {
      setBillingLoading(true);

      const appBridge = (window as any).__APP_BRIDGE;
      if (!appBridge) {
        throw new Error("App Bridge not available");
      }

      const { authenticatedFetch } = await import("@shopify/app-bridge-utils");
      const fetchFn = authenticatedFetch(appBridge);

      console.log("[Billing] Creating subscription request", {
        shop: shopDomain,
        planHandle,
      });

      const response = await fetchFn("/api/billing/subscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          shop: shopDomain,
          planHandle,
          promoCode: null,
        }),
      });

      console.log("[Billing] Subscription response received", {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        headers: Object.fromEntries(response.headers.entries()),
      });

      // Check response status before parsing
      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData?.error || errorData?.message || errorMessage;
        } catch (parseError) {
          // If JSON parsing fails, try to get text
          try {
            const errorText = await response.text();
            if (errorText) {
              errorMessage = errorText.substring(0, 200);
            }
          } catch (textError) {
            // Ignore text parsing errors
          }
        }
        throw new Error(errorMessage);
      }

      // Parse successful response
      let data: any;
      try {
        const responseText = await response.text();
        console.log("[Billing] Response text received", {
          length: responseText?.length,
          preview: responseText?.substring(0, 200),
        });

        if (!responseText || responseText.trim() === "") {
          throw new Error("Empty response from server");
        }
        data = JSON.parse(responseText);
        console.log("[Billing] Response parsed successfully", {
          hasConfirmationUrl: !!data?.confirmationUrl,
          requestId: data?.requestId,
        });
      } catch (parseError: any) {
        console.error("[Billing] Failed to parse response", {
          error: parseError,
          message: parseError?.message,
          stack: parseError?.stack,
        });
        throw new Error(
          "Invalid response format from server. Please try again."
        );
      }

      if (!data || !data.confirmationUrl) {
        console.error("[Billing] Missing confirmationUrl in response", data);
        throw new Error(t("index.errors.missingConfirmationUrl"));
      }

      console.log("[Billing] Redirecting to confirmation URL", {
        confirmationUrl: data.confirmationUrl,
      });

      // Use App Bridge Redirect action for safe navigation from embedded app
      // This properly handles cross-origin navigation without security errors
      // Per Shopify docs: https://shopify.dev/docs/api/app-bridge/previous-versions/actions/navigation/redirect-navigate
      const appBridgeInstance = (window as any).__APP_BRIDGE;
      
      if (!appBridgeInstance) {
        throw new Error("App Bridge instance not available. Ensure the app is loaded in Shopify admin.");
      }

      const { Redirect } = await import("@shopify/app-bridge/actions");
      const redirect = Redirect.create(appBridgeInstance);
      
      // Use REMOTE action to navigate to external URL (Shopify admin billing confirmation page)
      // newContext: true opens in new context/window to break out of iframe
      redirect.dispatch(Redirect.Action.REMOTE, {
        url: data.confirmationUrl as string,
        newContext: true,
      });
      
      console.log("[Billing] App Bridge Redirect dispatched successfully");
    } catch (error: any) {
      console.error("[Billing] Failed to create subscription", error);
      const errorMessage = error?.message || t("index.errors.subscriptionFailed") || "Failed to create subscription. Please try again.";
      toast.error(errorMessage);
    } finally {
      setBillingLoading(false);
    }
  };

  // Debug logging for subscription API call
  useEffect(() => {
    if (subscriptionLoading) {
      console.log("🔄 [Index] Subscription loading...", { shop });
    } else if (subscriptionError) {
      console.error("❌ [Index] Subscription error:", subscriptionError);
    } else if (subscription) {
      console.log("✅ [Index] Subscription loaded successfully", {
        shop,
        planName: subscription.plan?.name,
        hasActiveSubscription: subscription.hasActiveSubscription,
        isFree: subscription.isFree,
        subscriptionStatus: subscription.subscription?.status,
      });
    }
  }, [subscription, subscriptionLoading, subscriptionError, shop]);

  const scrollToInstallationGuide = () => {
    const guideElement = document.getElementById("installation-guide");
    if (!guideElement) {
      return;
    }
    guideElement.scrollIntoView({ behavior: "smooth" });
  };

  const handleDeepLinkClick = async (
    template: "product" | "index" = "product"
  ) => {
    // Get shop domain from App Bridge or URL params
    const shopDomain =
      shop || new URLSearchParams(window.location.search).get("shop");

    if (!shopDomain) {
      return;
    }

    // Check subscription status - gate feature if subscription is null
    if (!subscription || subscription.subscription === null) {
      await handleRequireBilling();
      return;
    }

    // Plan is selected - proceed with theme editor
    // Extract store handle from domain
    // Note: Shopify always uses myshopify.com domain internally (even for custom domain stores)
    // App Bridge and URL params will always provide the myshopify.com format
    // The deep link URLs require the store handle (part before .myshopify.com)
    let storeHandle = shopDomain;
    if (shopDomain.includes(".myshopify.com")) {
      storeHandle = shopDomain.replace(".myshopify.com", "");
    }

    // Construct deep link URL
    let deepLinkUrl = "";
    // App block deep link - opens theme editor without auto-adding the block
    // User can manually add the block from the app blocks section wherever they want
    // Correct format: https://admin.shopify.com/store/{store_handle}/themes/current/editor?context=apps&template={template}
    deepLinkUrl = `https://admin.shopify.com/store/${storeHandle}/themes/current/editor?context=apps&template=${template}`;

    // Open in a new tab to avoid X-Frame-Options issues and keep the app open
    // This works whether we're in an iframe or not
    window.open(deepLinkUrl, "_blank", "noopener,noreferrer");
  };

  // Fetch plans on mount
  useEffect(() => {
    if (availablePlans.length === 0) {
      fetchAvailablePlans();
    }
  }, []);

  // Refresh credits when subscription changes
  useEffect(() => {
    if (
      subscription &&
      subscription.subscription !== null &&
      !subscription.isFree
    ) {
      refreshCredits();
    }
  }, [subscription?.subscription?.id, refreshCredits]);

  // Track if billing flow has been triggered to prevent infinite loops
  const billingTriggeredRef = useRef(false);
  const lastSubscriptionRef = useRef<typeof subscription>(null);
  const paymentSuccessTimeRef = useRef<number | null>(null);
  const paymentSuccessRetryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // State to track payment success for reactive UI updates
  const [isWaitingForPaymentSuccess, setIsWaitingForPaymentSuccess] =
    useState(false);
  const [paymentSuccessElapsedTime, setPaymentSuccessElapsedTime] = useState(0);

  // Check subscription and redirect to pricing page if subscription is null
  useEffect(() => {
    console.log("🔍 [Redirect Debug] useEffect triggered");
    console.log(
      "🔍 [Redirect Debug] subscriptionLoading:",
      subscriptionLoading
    );
    console.log("🔍 [Redirect Debug] subscription:", subscription);

    // Check if we're returning from payment success
    const urlParams = new URLSearchParams(window.location.search);
    const isPaymentSuccess = urlParams.get("payment_success") === "true";

    if (isPaymentSuccess && paymentSuccessTimeRef.current === null) {
      paymentSuccessTimeRef.current = Date.now();
      setIsWaitingForPaymentSuccess(true); // Trigger re-render
      console.log(
        "✅ [Redirect Debug] Payment success detected - will wait for subscription to update"
      );

      // Don't remove URL parameter immediately - let useSubscription hook detect it first
      // We'll remove it after a short delay to ensure the hook processes it
      setTimeout(() => {
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.delete("payment_success");
        window.history.replaceState({}, "", newUrl.toString());
      }, 100);
    }

    // Wait for subscription to load, but don't wait forever
    // If loading takes too long (>10s), we'll show plan selection anyway (handled by timeout effect)
    if (subscriptionLoading) {
      console.log(
        "🔍 [Redirect Debug] Still loading subscription, skipping..."
      );
      // Don't return if we're waiting for payment success - let that logic handle it
      if (!isWaitingForPaymentSuccess) {
        return;
      }
    }

    // If plan selection is showing but we now have a subscription, hide it
    if (
      showPlanSelection &&
      subscription &&
      subscription.subscription !== null
    ) {
      console.log(
        "🔍 [Redirect Debug] Subscription now available, hiding plan selection"
      );
      setShowPlanSelection(false);
      billingTriggeredRef.current = false;
      // Clear payment success tracking since we have subscription
      if (paymentSuccessTimeRef.current !== null) {
        paymentSuccessTimeRef.current = null;
        setIsWaitingForPaymentSuccess(false); // Trigger re-render
        if (paymentSuccessRetryTimeoutRef.current) {
          clearTimeout(paymentSuccessRetryTimeoutRef.current);
          paymentSuccessRetryTimeoutRef.current = null;
        }
      }
    }

    // Don't redirect if plan selection is already showing (and subscription is still null)
    if (
      showPlanSelection &&
      (!subscription || subscription.subscription === null)
    ) {
      console.log(
        "🔍 [Redirect Debug] Plan selection already showing, skipping redirect"
      );
      return;
    }

    // Get shop domain
    const shopDomain =
      shop || new URLSearchParams(window.location.search).get("shop");

    console.log("🔍 [Redirect Debug] shopDomain:", shopDomain);

    if (!shopDomain) {
      console.log(
        "🔍 [Redirect Debug] No shop domain found, skipping redirect"
      );
      return;
    }

    // Check if subscription has actually changed
    const subscriptionChanged =
      lastSubscriptionRef.current !== subscription &&
      (lastSubscriptionRef.current?.subscription?.id !==
        subscription?.subscription?.id ||
        lastSubscriptionRef.current === null);

    // If we have a subscription, clear all payment success tracking immediately
    // This check happens FIRST to ensure we clear tracking as soon as subscription is found
    if (subscription && subscription.subscription !== null) {
      // We have a subscription - clear all payment success tracking
      if (paymentSuccessTimeRef.current !== null) {
        console.log(
          "[Index] Subscription found - clearing payment success tracking",
          {
            subscriptionId: subscription.subscription.id,
            status: subscription.subscription.status,
          }
        );
        paymentSuccessTimeRef.current = null;
        setIsWaitingForPaymentSuccess(false); // Trigger re-render
        if (paymentSuccessRetryTimeoutRef.current) {
          clearTimeout(paymentSuccessRetryTimeoutRef.current);
          paymentSuccessRetryTimeoutRef.current = null;
        }
      }

      // Clear billing trigger if subscription changed
      if (subscriptionChanged) {
        billingTriggeredRef.current = false;
      }

      // Continue to normal flow - update plan state, etc.
      // Don't return here - let the flow continue to update currentPlan
    } else if (paymentSuccessTimeRef.current !== null) {
      // No subscription yet, but we're waiting after payment success
      const timeSincePaymentSuccess =
        Date.now() - paymentSuccessTimeRef.current;
      const maxWaitTime = 15000; // 15 seconds max wait

      if (timeSincePaymentSuccess < maxWaitTime) {
        // Still waiting for subscription to update after payment
        console.log(
          `⏳ [Redirect Debug] Waiting for subscription after payment success (${Math.round(
            timeSincePaymentSuccess / 1000
          )}s / ${maxWaitTime / 1000}s)...`
        );

        // Schedule a refresh if not already scheduled
        if (!paymentSuccessRetryTimeoutRef.current) {
          const retryDelay = Math.min(
            2000,
            maxWaitTime - timeSincePaymentSuccess
          ); // Retry every 2 seconds
          paymentSuccessRetryTimeoutRef.current = setTimeout(() => {
            console.log(
              "🔄 [Redirect Debug] Retrying subscription fetch after payment success"
            );
            paymentSuccessRetryTimeoutRef.current = null;
            refreshSubscription();
          }, retryDelay);
        }

        lastSubscriptionRef.current = subscription;
        return; // Don't redirect to pricing yet - keep showing loading
      } else {
        // Max wait time exceeded, proceed normally
        console.log(
          "⏰ [Redirect Debug] Max wait time exceeded, proceeding normally"
        );
        paymentSuccessTimeRef.current = null;
        setIsWaitingForPaymentSuccess(false); // Trigger re-render
        if (paymentSuccessRetryTimeoutRef.current) {
          clearTimeout(paymentSuccessRetryTimeoutRef.current);
          paymentSuccessRetryTimeoutRef.current = null;
        }
        // Continue to check if subscription exists or redirect to pricing
      }
    }

    // Redirect to billing flow if no subscription is configured
    // BUT only if we're NOT waiting for payment success to process
    // AND only if loading is complete (to prevent showing plan selection while still loading)
    // Also ensure we have a valid subscription object (even if null) to avoid undefined issues
    const hasNoSubscription =
      !subscription ||
      subscription.subscription === null ||
      (typeof subscription === "object" && subscription.subscription === null);

    if (
      hasNoSubscription &&
      !subscriptionLoading &&
      !isWaitingForPaymentSuccess
    ) {
      // Only trigger billing flow once per subscription state
      if (!billingTriggeredRef.current) {
        console.log(
          "🚨 [Redirect Debug] Triggering billing flow - subscription is null and loading complete",
          {
            subscription: subscription ? "exists but null" : "does not exist",
            subscriptionLoading,
            isWaitingForPaymentSuccess,
          }
        );
        billingTriggeredRef.current = true;
        handleRequireBilling();
      } else {
        console.log(
          "🔍 [Redirect Debug] Billing flow already triggered, skipping"
        );
      }
      lastSubscriptionRef.current = subscription;
      return;
    }

    // Console log subscription status
    console.log(
      "✅ [Redirect Debug] NO REDIRECT - Subscription exists:",
      subscription.subscription?.status
    );
    console.log(
      "✅ [Redirect Debug] subscription.hasActiveSubscription:",
      subscription.hasActiveSubscription
    );
    console.log(
      "✅ [Redirect Debug] subscription.isFree:",
      subscription.isFree
    );

    // Reset billing trigger flag since we have a subscription
    billingTriggeredRef.current = false;

    // Update current plan state
    if (subscription.hasActiveSubscription && !subscription.isFree) {
      console.log(
        "✅ [Redirect Debug] Setting currentPlan to:",
        subscription.plan?.name || "active"
      );
      setCurrentPlan(subscription.plan?.name || "active");
    } else if (subscription.isFree) {
      console.log("✅ [Redirect Debug] Setting currentPlan to: free");
      setCurrentPlan("free");
    } else {
      console.log(
        "✅ [Redirect Debug] Setting currentPlan to:",
        subscription.plan?.name || "inactive"
      );
      setCurrentPlan(subscription.plan?.name || "inactive");
    }

    lastSubscriptionRef.current = subscription;
  }, [subscription, subscriptionLoading, shop, refreshSubscription]);

  // Separate effect to handle subscription updates from other tabs
  useEffect(() => {
    const shopDomain =
      shop || new URLSearchParams(window.location.search).get("shop");
    if (!shopDomain) return;

    const handleSubscriptionUpdate = (e: CustomEvent) => {
      const updatedSubscription = e.detail?.subscription;
      if (updatedSubscription && updatedSubscription.subscription !== null) {
        console.log("[Index] Subscription updated from another tab", {
          subscriptionId: updatedSubscription.subscription.id,
        });

        // Clear payment success tracking if subscription is found
        if (paymentSuccessTimeRef.current !== null) {
          paymentSuccessTimeRef.current = null;
          setIsWaitingForPaymentSuccess(false); // Trigger re-render
          if (paymentSuccessRetryTimeoutRef.current) {
            clearTimeout(paymentSuccessRetryTimeoutRef.current);
            paymentSuccessRetryTimeoutRef.current = null;
          }
        }

        // Hide plan selection if showing
        if (showPlanSelection) {
          setShowPlanSelection(false);
        }

        billingTriggeredRef.current = false;
      }
    };

    window.addEventListener(
      "subscriptionUpdated",
      handleSubscriptionUpdate as EventListener
    );

    return () => {
      window.removeEventListener(
        "subscriptionUpdated",
        handleSubscriptionUpdate as EventListener
      );
    };
  }, [shop, showPlanSelection]);

  // Clear waiting state immediately when subscription is found
  // OR if subscription fetch completes but subscription is still null (after a short delay)
  useEffect(() => {
    if (
      subscription &&
      subscription.subscription !== null &&
      isWaitingForPaymentSuccess
    ) {
      console.log("[Index] Subscription found - clearing waiting state", {
        subscriptionId: subscription.subscription.id,
        status: subscription.subscription.status,
      });
      setIsWaitingForPaymentSuccess(false);
      setPaymentSuccessElapsedTime(0);
      paymentSuccessTimeRef.current = null;
      if (paymentSuccessRetryTimeoutRef.current) {
        clearTimeout(paymentSuccessRetryTimeoutRef.current);
        paymentSuccessRetryTimeoutRef.current = null;
      }
    } else if (
      !subscriptionLoading &&
      isWaitingForPaymentSuccess &&
      (!subscription || subscription.subscription === null) &&
      paymentSuccessTimeRef.current &&
      Date.now() - paymentSuccessTimeRef.current > 3000 // Wait at least 3 seconds for webhook
    ) {
      // Subscription fetch completed but no subscription found
      // Wait at least 3 seconds for webhook, then check if we should stop waiting
      // If we've waited more than 5 seconds and still no subscription, stop waiting
      const elapsed = Date.now() - paymentSuccessTimeRef.current;
      if (elapsed > 5000) {
        console.log(
          "[Index] Subscription fetch completed but no subscription found after 5s - stopping wait"
        );
        setIsWaitingForPaymentSuccess(false);
        setPaymentSuccessElapsedTime(0);
        paymentSuccessTimeRef.current = null;
        if (paymentSuccessRetryTimeoutRef.current) {
          clearTimeout(paymentSuccessRetryTimeoutRef.current);
          paymentSuccessRetryTimeoutRef.current = null;
        }
      }
    }
  }, [subscription, subscriptionLoading, isWaitingForPaymentSuccess]);

  // Add timeout to prevent infinite loading (max 10 seconds)
  // This is a safety net in case the subscription hook gets stuck
  useEffect(() => {
    if (subscriptionLoading) {
      // Clear any existing timeout
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }

      // Set a timeout to force showing plan selection after 10 seconds
      // This handles cases where loading gets stuck
      loadingTimeoutRef.current = setTimeout(() => {
        console.warn(
          "[Index] Loading timeout after 10s - forcing plan selection display",
          {
            subscriptionLoading,
            hasSubscription: !!subscription?.subscription,
            subscription: subscription ? "exists" : "null",
          }
        );

        // If still loading after timeout, force show plan selection
        // This prevents infinite loading when subscription is null
        if (subscriptionLoading) {
          const hasNoSubscription =
            !subscription || subscription.subscription === null;

          if (hasNoSubscription) {
            console.log(
              "[Index] Timeout reached with null subscription - showing plan selection"
            );
            setShowPlanSelection(true);
            billingTriggeredRef.current = false; // Reset to allow retry
          }
        }
        loadingTimeoutRef.current = null;
      }, 10000); // 10 seconds max
    } else {
      // Clear timeout if loading is false
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = null;
      }
    }

    return () => {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = null;
      }
    };
  }, [subscriptionLoading, subscription]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (paymentSuccessRetryTimeoutRef.current) {
        clearTimeout(paymentSuccessRetryTimeoutRef.current);
        paymentSuccessRetryTimeoutRef.current = null;
      }
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = null;
      }
    };
  }, []);

  // Update elapsed time timer when waiting for payment success
  const maxWaitTime = 15000; // 15 seconds
  const hasSubscription = subscription && subscription.subscription !== null;

  useEffect(() => {
    if (!isWaitingForPaymentSuccess || !paymentSuccessTimeRef.current) {
      setPaymentSuccessElapsedTime(0);
      return;
    }

    // Update elapsed time immediately
    const updateElapsed = () => {
      if (paymentSuccessTimeRef.current) {
        const elapsed = Date.now() - paymentSuccessTimeRef.current;
        setPaymentSuccessElapsedTime(elapsed);

        if (elapsed >= maxWaitTime) {
          // Max time exceeded
          setIsWaitingForPaymentSuccess(false);
          paymentSuccessTimeRef.current = null;
          setPaymentSuccessElapsedTime(0);
        }
      }
    };

    // Update immediately
    updateElapsed();

    // Then update every second
    const interval = setInterval(updateElapsed, 1000);
    return () => clearInterval(interval);
  }, [isWaitingForPaymentSuccess, maxWaitTime]);

  const shouldShowPaymentLoading =
    isWaitingForPaymentSuccess &&
    !hasSubscription &&
    paymentSuccessElapsedTime < maxWaitTime;

  // Show loading only if:
  // 1. Subscription is actively loading, OR
  // 2. We're waiting for payment success (with valid conditions)
  // The subscription hook ensures loading is set to false when fetch completes,
  // even if subscription is null (cancelled), so we can trust subscriptionLoading
  const shouldShowLoading = subscriptionLoading || shouldShowPaymentLoading;

  if (shouldShowLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          {shouldShowPaymentLoading && (
            <div className="space-y-2">
              <p className="text-lg font-semibold text-foreground">
                {t("index.loading.processingPayment")}
              </p>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                {t("index.loading.pleaseWait")}
              </p>
              <p className="text-xs text-muted-foreground">
                {Math.round(paymentSuccessElapsedTime / 1000)}
                {t("index.loading.seconds")} / {maxWaitTime / 1000}
                {t("index.loading.seconds")}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Show plan selection UI if needed
  if (showPlanSelection) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <PlanSelection
          plans={availablePlans}
          onSelectPlan={handleSelectPlan}
          loading={billingLoading}
          subscription={subscription}
          onBack={() => setShowPlanSelection(false)}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Main Content */}
      {/* Enhanced Hero Section */}
      <header className="relative overflow-hidden bg-card border-b border-border">
        {/* Language Switcher - Fixed top right */}
        <div className="absolute top-4 right-4 z-50">
          <LanguageSwitcher />
        </div>
        <div className="container mx-auto px-4 sm:px-6 md:px-8 py-12 sm:py-16 md:py-20 relative">
          <div className="max-w-6xl mx-auto">
            {/* Trial Notification Banner */}
            <TrialNotificationBanner
              onApprovalInitiated={() => {
                // Refresh subscription status when approval is initiated
                refreshSubscription();
              }}
            />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12 items-start">
              {/* Hero Content - Left Side */}
              <div className="lg:col-span-2">
                <div className="flex flex-col items-start gap-4">
                  <div className="inline-flex flex-col items-start">
                    <h1
                      className="inline-flex items-center font-extrabold tracking-tight text-4xl sm:text-5xl md:text-6xl lg:text-7xl leading-tight"
                      aria-label="NusenseTryOn"
                    >
                      <span
                        className="text-primary"
                        style={{ color: "#ce0003" }}
                      >
                        Nusense
                      </span>
                      <span
                        className="text-foreground"
                        style={{ color: "#564646" }}
                      >
                        TryOn
                      </span>
                    </h1>
                    <p className="text-lg sm:text-xl md:text-2xl text-foreground font-medium no-orphans mt-2">
                      {t("index.hero.title")}
                    </p>
                    <p className="text-base sm:text-lg text-muted-foreground mt-3 max-w-2xl">
                      {t("index.hero.subtitle")}
                    </p>
                  </div>
                  {/* Primary CTA */}
                  <div className="flex flex-wrap gap-3 mt-4">
                    <Button
                      size="lg"
                      onClick={scrollToInstallationGuide}
                      className="px-6"
                    >
                      <Zap className="w-4 h-4 mr-2" />
                      {t("index.hero.startInstallation")}
                    </Button>
                    <Button
                      size="lg"
                      onClick={() => {
                        handleRequireBilling();
                      }}
                      className="px-6"
                    >
                      {t("index.hero.viewPricing")}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Plan Information Card - Right Side */}
              <div className="lg:col-span-1">
                {subscription && subscription.subscription !== null ? (
                  <Card className="border-2 border-border shadow-lg hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-card to-card/95">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between mb-2">
                        <CardTitle className="text-lg font-bold text-foreground">
                          {t("index.planCard.title")}
                        </CardTitle>
                        {subscription.hasActiveSubscription && (
                          <Badge
                            variant="default"
                            className="gap-1.5 bg-success/20 text-success border-success/30"
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            {t("index.planCard.active")}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-3">
                        {subscription.isFree ? (
                          <Badge
                            variant="outline"
                            className="gap-1.5 text-sm px-3 py-1"
                          >
                            <Zap className="w-3.5 h-3.5" />
                            {t("index.planCard.freePlan")}
                          </Badge>
                        ) : (
                          <Badge
                            variant="default"
                            className="gap-1.5 bg-primary text-primary-foreground text-sm px-3 py-1"
                          >
                            <Crown className="w-3.5 h-3.5" />
                            {subscription.plan?.name ||
                              t("index.planCard.premiumPlan")}
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Credits Tracking */}
                      {credits && !subscription.isFree && (
                        <div className="space-y-3 pt-2 border-t border-border">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold text-foreground flex items-center gap-2">
                              <Sparkle className="w-4 h-4 text-primary" />
                              {t("index.planCard.availableCredits")}
                            </span>
                            {creditsLoading && (
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                            )}
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">
                                {t("index.planCard.available")}
                              </span>
                              <span className="font-bold text-foreground">
                                {credits.balance || 0}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">
                                {t("index.planCard.totalIncluded")}
                              </span>
                              <span className="font-medium text-foreground">
                                {credits.included || 100}
                              </span>
                            </div>
                            {credits.used !== undefined && (
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">
                                  {t("index.planCard.used")}
                                </span>
                                <span className="font-medium text-foreground">
                                  {credits.used || 0}
                                </span>
                              </div>
                            )}
                            {credits.isOverage && (
                              <div className="mt-2 p-2 bg-warning/10 border border-warning/30 rounded text-xs text-warning">
                                {t("index.planCard.overageMode")}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Trial Days Remaining */}
                      {subscription.subscription?.isInTrial &&
                        subscription.subscription?.trialDaysRemaining !==
                          null && (
                          <div className="pt-2 border-t border-border">
                            <div className="p-3 bg-primary/10 border border-primary/30 rounded-lg">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Sparkle className="w-4 h-4 text-primary" />
                                  <span className="text-sm font-semibold text-foreground">
                                    {t("index.planCard.trialPeriod")}
                                  </span>
                                </div>
                                <span className="text-sm font-bold text-primary">
                                  {subscription.subscription.trialDaysRemaining}{" "}
                                  {subscription.subscription
                                    .trialDaysRemaining === 1
                                    ? t("index.planCard.trialDayRemaining")
                                    : t("index.planCard.trialDaysRemaining")}
                                </span>
                              </div>
                            </div>
                          </div>
                        )}

                      {/* Subscription Status */}
                      {subscription.subscription && (
                        <div className="space-y-2 pt-2 border-t border-border">
                          <div className="flex items-center gap-2 text-sm">
                            <Calendar className="w-4 h-4 text-muted-foreground" />
                            <span className="text-muted-foreground">
                              {t("index.planCard.planStart")}
                            </span>
                            <span className="font-medium text-foreground">
                              {new Date(
                                subscription.subscription.currentPeriodStart ||
                                  subscription.subscription.createdAt
                              ).toLocaleDateString(
                                i18n.language === "fr" ? "fr-FR" : "en-US",
                                {
                                  day: "numeric",
                                  month: "long",
                                  year: "numeric",
                                }
                              )}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <Calendar className="w-4 h-4 text-muted-foreground" />
                            <span className="text-muted-foreground">
                              {t("index.planCard.renewal")}
                            </span>
                            <span className="font-medium text-foreground">
                              {new Date(
                                subscription.subscription.currentPeriodEnd
                              ).toLocaleDateString(
                                i18n.language === "fr" ? "fr-FR" : "en-US",
                                {
                                  day: "numeric",
                                  month: "long",
                                  year: "numeric",
                                }
                              )}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <CheckCircle2 className="w-4 h-4 text-success" />
                            <span className="text-muted-foreground">
                              {t("index.planCard.status")}
                            </span>
                            <span className="font-medium text-foreground capitalize">
                              {subscription.subscription.status.toLowerCase()}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Plan Benefits - From Pricing Page */}
                      <div className="pt-3 border-t border-border">
                        <p className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                          <Sparkle className="w-4 h-4 text-primary" />
                          {t("index.planCard.featuresTitle")}
                        </p>
                        <ul className="space-y-2">
                          {(() => {
                            // Find the plan from availablePlans by name
                            const planName = subscription.plan?.name;
                            const matchedPlan = availablePlans.find(
                              (p) => p.name === planName
                            );
                            const planFeatures = matchedPlan?.features || [];

                            // If we have features from the pricing page, use those
                            if (planFeatures.length > 0) {
                              return planFeatures.map(
                                (feature: string, index: number) => (
                                  <li
                                    key={index}
                                    className="flex items-start gap-2 text-sm"
                                  >
                                    <Check className="w-4 h-4 text-success flex-shrink-0 mt-0.5" />
                                    <span className="text-muted-foreground">
                                      {feature}
                                    </span>
                                  </li>
                                )
                              );
                            }

                            // Fallback to default features if no plan found
                            return (
                              <>
                                <li className="flex items-start gap-2 text-sm">
                                  <Check className="w-4 h-4 text-success flex-shrink-0 mt-0.5" />
                                  <span className="text-muted-foreground">
                                    {t("index.planCard.unlimitedTryOn")}
                                  </span>
                                </li>
                                <li className="flex items-start gap-2 text-sm">
                                  <Check className="w-4 h-4 text-success flex-shrink-0 mt-0.5" />
                                  <span className="text-muted-foreground">
                                    {t("index.planCard.prioritySupport")}
                                  </span>
                                </li>
                                <li className="flex items-start gap-2 text-sm">
                                  <Check className="w-4 h-4 text-success flex-shrink-0 mt-0.5" />
                                  <span className="text-muted-foreground">
                                    {t("index.planCard.shopifyIntegration")}
                                  </span>
                                </li>
                              </>
                            );
                          })()}
                        </ul>
                      </div>

                      {/* Action Buttons */}
                      <div className="pt-3 space-y-2">
                        <Button
                          size="sm"
                          className="w-full"
                          onClick={() => {
                            handleRequireBilling();
                          }}
                        >
                          <CreditCard className="w-4 h-4 mr-2" />
                          {subscription.isFree
                            ? t("index.planCard.upgradeToPremium")
                            : t("index.planCard.manageSubscription")}
                        </Button>
                        {subscription.hasActiveSubscription &&
                          subscription.subscription?.status === "ACTIVE" && (
                            <Button
                              size="sm"
                              className="w-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              onClick={handleCancelSubscription}
                              disabled={cancelling}
                            >
                              {cancelling
                                ? t("index.planCard.cancelling")
                                : t("index.planCard.cancelSubscription")}
                            </Button>
                          )}
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="border-2 border-dashed border-border bg-muted/30">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg font-bold text-foreground">
                        {t("index.planCard.title")}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="text-center py-6">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
                          <CreditCard className="w-8 h-8 text-muted-foreground" />
                        </div>
                        <p className="text-sm text-muted-foreground mb-4">
                          {t("index.planCard.noPlanSelected")}
                        </p>
                        <Button
                          size="sm"
                          className="w-full"
                          onClick={() => {
                            handleRequireBilling();
                          }}
                        >
                          <Sparkle className="w-4 h-4 mr-2" />
                          {t("index.planCard.choosePlan")}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Quick Actions Section */}
      {subscription && subscription.subscription !== null && (
        <section className="py-8 sm:py-12 bg-background border-b border-border">
          <div className="container mx-auto px-4 sm:px-6 md:px-8">
            <div className="max-w-6xl mx-auto">
              <QuickActions
                showInstall={!currentPlan || currentPlan === "free"}
                showConfigure={currentPlan && currentPlan !== "free"}
                onInstallClick={scrollToInstallationGuide}
                onConfigureClick={scrollToInstallationGuide}
                onPricingClick={handleRequireBilling}
              />
            </div>
          </div>
        </section>
      )}

      {/* Installation Instructions - Always visible */}
      <section
        id="installation-guide"
        className="py-12 sm:py-16 md:py-20 lg:py-24 bg-background"
      >
        <div className="container mx-auto px-4 sm:px-6 md:px-8">
          <div className="max-w-6xl mx-auto">
            <div className="space-y-8 sm:space-y-10 md:space-y-12">
              {/* Installation Steps */}
              <Card className="p-6 sm:p-8 md:p-10 lg:p-12 border-2 border-border bg-card shadow-lg">
                <CardHeader className="p-0 mb-8 sm:mb-10">
                  <CardTitle className="text-2xl sm:text-3xl md:text-4xl flex items-center gap-3 sm:gap-4 text-foreground no-orphans">
                    <Zap
                      className="w-7 h-7 sm:w-8 sm:h-8 md:w-9 md:h-9 text-primary flex-shrink-0"
                      aria-hidden="true"
                    />
                    {t("index.installationGuide.title")}
                  </CardTitle>
                  <CardDescription className="text-base sm:text-lg md:text-xl mt-4 sm:mt-5 text-foreground/80 no-orphans">
                    {t("index.installationGuide.subtitle")}
                  </CardDescription>
                  <div className="mt-6 sm:mt-8 bg-info/15 border-2 border-info/30 rounded-lg p-4 sm:p-5">
                    <p className="text-sm sm:text-base text-foreground leading-relaxed no-orphans">
                      <strong className="font-bold text-foreground">
                        {t("index.installationGuide.appBlockNote")}{" "}
                      </strong>
                      {t("index.installationGuide.appBlockDescription")}
                    </p>
                  </div>
                </CardHeader>
                <CardContent className="p-0 space-y-8 sm:space-y-10 md:space-y-12">
                  {/* Step 1 */}
                  <div className="relative">
                    <div className="flex gap-5 sm:gap-6 md:gap-8">
                      <div className="flex-shrink-0">
                        <div
                          className="w-14 h-14 sm:w-16 sm:h-16 md:w-20 md:h-20 bg-primary text-primary-foreground rounded-xl flex items-center justify-center font-bold text-xl sm:text-2xl md:text-3xl shadow-lg ring-2 ring-primary/20"
                          aria-label="Étape 1"
                        >
                          1
                        </div>
                      </div>
                      <div className="flex-1 min-w-0 pt-1">
                        <div className="flex items-start gap-4 mb-3">
                          <Store
                            className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-primary flex-shrink-0 mt-1"
                            aria-hidden="true"
                          />
                          <div className="flex-1">
                            <h3 className="font-bold text-lg sm:text-xl md:text-2xl mb-3 sm:mb-4 text-foreground no-orphans">
                              {t("index.installationGuide.step1Title")}
                            </h3>
                            <p className="text-base sm:text-lg text-foreground/90 mb-4 sm:mb-5 leading-relaxed no-orphans">
                              {t("index.installationGuide.step1Description")}
                            </p>
                            <div className="bg-info/20 border-2 border-info/40 rounded-lg p-4 sm:p-5">
                              <p className="text-sm sm:text-base text-foreground leading-relaxed no-orphans">
                                <strong className="font-bold text-foreground">
                                  {t("index.installationGuide.step1Note")}{" "}
                                </strong>
                                {t("index.installationGuide.step1NoteText")}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="absolute left-7 sm:left-8 md:left-9 top-16 sm:top-20 md:top-24 bottom-0 w-1 bg-border/60 -z-10" />
                  </div>

                  {/* Step 2 - App Block (Online Store 2.0) */}
                  <div className="relative">
                    <div className="flex gap-5 sm:gap-6 md:gap-8">
                      <div className="flex-shrink-0">
                        <div
                          className="w-14 h-14 sm:w-16 sm:h-16 md:w-20 md:h-20 bg-primary text-primary-foreground rounded-xl flex items-center justify-center font-bold text-xl sm:text-2xl md:text-3xl shadow-lg ring-2 ring-primary/20"
                          aria-label="Étape 2"
                        >
                          2
                        </div>
                      </div>
                      <div className="flex-1 min-w-0 pt-1">
                        <div className="flex items-start gap-4 mb-3">
                          <Zap
                            className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-primary flex-shrink-0 mt-1"
                            aria-hidden="true"
                          />
                          <div className="flex-1">
                            <h3 className="font-bold text-lg sm:text-xl md:text-2xl mb-3 sm:mb-4 text-foreground no-orphans">
                              {t("index.installationGuide.step2Title")}
                            </h3>
                            <p className="text-base sm:text-lg text-foreground/90 mb-4 sm:mb-5 leading-relaxed no-orphans">
                              {t("index.installationGuide.step2Description")}
                            </p>
                            <div className="space-y-4 mb-4 sm:mb-5">
                              <div className="bg-muted rounded-lg p-4 sm:p-5 border-2 border-border">
                                <p className="text-sm sm:text-base font-semibold text-foreground mb-3 no-orphans">
                                  {t(
                                    "index.installationGuide.step2Instructions"
                                  )}
                                </p>
                                <ol className="list-decimal list-inside space-y-2 text-sm sm:text-base text-foreground/90">
                                  <li className="no-orphans">
                                    {t(
                                      "index.installationGuide.step2Instruction1"
                                    )}
                                  </li>
                                  <li className="no-orphans">
                                    {t(
                                      "index.installationGuide.step2Instruction2"
                                    )}
                                  </li>
                                  <li className="no-orphans">
                                    {t(
                                      "index.installationGuide.step2Instruction3"
                                    )}
                                  </li>
                                  <li className="no-orphans">
                                    {t(
                                      "index.installationGuide.step2Instruction4"
                                    )}
                                  </li>
                                  <li className="no-orphans">
                                    {t(
                                      "index.installationGuide.step2Instruction5"
                                    )}
                                  </li>
                                </ol>
                              </div>
                              <div className="bg-warning/20 border-2 border-warning/40 rounded-lg p-4 sm:p-5">
                                <p className="text-sm sm:text-base text-foreground flex items-start gap-3 leading-relaxed">
                                  <Shield
                                    className="w-5 h-5 sm:w-6 sm:h-6 text-warning flex-shrink-0 mt-0.5"
                                    aria-hidden="true"
                                  />
                                  <span className="no-orphans">
                                    <strong className="font-bold text-foreground">
                                      {t(
                                        "index.installationGuide.step2Important"
                                      )}{" "}
                                    </strong>
                                    {t(
                                      "index.installationGuide.step2ImportantText"
                                    )}
                                  </span>
                                </p>
                              </div>
                              {subscription &&
                              subscription.subscription !== null ? (
                                <div className="bg-primary/10 border-2 border-primary/30 rounded-lg p-4 sm:p-5">
                                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                    <div className="flex-1">
                                      <p className="text-sm sm:text-base font-semibold text-foreground mb-2 no-orphans">
                                        {t(
                                          "index.installationGuide.step2QuickAccess"
                                        )}
                                      </p>
                                      <p className="text-sm sm:text-base text-foreground/90 no-orphans">
                                        {t(
                                          "index.installationGuide.step2QuickAccessText"
                                        )}
                                      </p>
                                    </div>
                                    <Button
                                      onClick={() =>
                                        handleDeepLinkClick("product")
                                      }
                                      className="w-full sm:w-auto whitespace-nowrap"
                                      size="sm"
                                    >
                                      <Link2
                                        className="w-4 h-4 mr-2"
                                        aria-hidden="true"
                                      />
                                      {t("index.installationGuide.step2AddNow")}
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <div className="bg-warning/20 border-2 border-warning/40 rounded-lg p-4 sm:p-5">
                                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                    <div className="flex-1">
                                      <p className="text-sm sm:text-base font-semibold text-foreground mb-2 no-orphans">
                                        {t(
                                          "index.installationGuide.step2Restricted"
                                        )}
                                      </p>
                                      <p className="text-sm sm:text-base text-foreground/90 no-orphans">
                                        {t(
                                          "index.installationGuide.step2RestrictedText"
                                        )}
                                      </p>
                                    </div>
                                    <Button
                                      onClick={() => {
                                        handleRequireBilling();
                                      }}
                                      className="w-full sm:w-auto whitespace-nowrap border border-input bg-background hover:bg-accent hover:text-accent-foreground"
                                      size="sm"
                                    >
                                      {t(
                                        "index.installationGuide.step2ViewPricing"
                                      )}
                                    </Button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="absolute left-7 sm:left-8 md:left-9 top-16 sm:top-20 md:top-24 bottom-0 w-1 bg-border/60 -z-10" />
                  </div>

                  {/* Step 3 - Banner App Embed */}
                  <div className="relative">
                    <div className="flex gap-5 sm:gap-6 md:gap-8">
                      <div className="flex-shrink-0">
                        <div
                          className="w-14 h-14 sm:w-16 sm:h-16 md:w-20 md:h-20 bg-primary text-primary-foreground rounded-xl flex items-center justify-center font-bold text-xl sm:text-2xl md:text-3xl shadow-lg ring-2 ring-primary/20"
                          aria-label="Étape 3"
                        >
                          3
                        </div>
                      </div>
                      <div className="flex-1 min-w-0 pt-1">
                        <div className="flex items-start gap-4 mb-3">
                          <Sparkles
                            className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-primary flex-shrink-0 mt-1"
                            aria-hidden="true"
                          />
                          <div className="flex-1">
                            <h3 className="font-bold text-lg sm:text-xl md:text-2xl mb-3 sm:mb-4 text-foreground no-orphans">
                              {t("index.installationGuide.step3Title")}
                            </h3>
                            <p className="text-base sm:text-lg text-foreground/90 mb-4 sm:mb-5 leading-relaxed no-orphans">
                              {t("index.installationGuide.step3Description")}
                            </p>
                            <div className="space-y-4 mb-4 sm:mb-5">
                              <div className="bg-muted rounded-lg p-4 sm:p-5 border-2 border-border">
                                <p className="text-sm sm:text-base font-semibold text-foreground mb-3 no-orphans">
                                  {t(
                                    "index.installationGuide.step3Instructions"
                                  )}
                                </p>
                                <ol className="list-decimal list-inside space-y-2 text-sm sm:text-base text-foreground/90">
                                  <li className="no-orphans">
                                    {t(
                                      "index.installationGuide.step3Instruction1"
                                    )}
                                  </li>
                                  <li className="no-orphans">
                                    {t(
                                      "index.installationGuide.step3Instruction2"
                                    )}
                                  </li>
                                  <li className="no-orphans">
                                    {t(
                                      "index.installationGuide.step3Instruction3"
                                    )}
                                  </li>
                                  <li className="no-orphans">
                                    {t(
                                      "index.installationGuide.step3Instruction4"
                                    )}
                                  </li>
                                  <li className="no-orphans">
                                    {t(
                                      "index.installationGuide.step3Instruction5"
                                    )}
                                  </li>
                                </ol>
                              </div>
                              <div className="bg-info/20 border-2 border-info/40 rounded-lg p-4 sm:p-5">
                                <p className="text-sm sm:text-base text-foreground flex items-start gap-3 leading-relaxed">
                                  <Sparkles
                                    className="w-5 h-5 sm:w-6 sm:h-6 text-info flex-shrink-0 mt-0.5"
                                    aria-hidden="true"
                                  />
                                  <span className="no-orphans">
                                    <strong className="font-bold text-foreground">
                                      {t("index.installationGuide.step3Tip")}{" "}
                                    </strong>
                                    {t("index.installationGuide.step3TipText")}
                                  </span>
                                </p>
                              </div>
                              {subscription &&
                              subscription.subscription !== null ? (
                                <div className="bg-primary/10 border-2 border-primary/30 rounded-lg p-4 sm:p-5">
                                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                    <div className="flex-1">
                                      <p className="text-sm sm:text-base font-semibold text-foreground mb-2 no-orphans">
                                        {t(
                                          "index.installationGuide.step3QuickAccess"
                                        )}
                                      </p>
                                      <p className="text-sm sm:text-base text-foreground/90 no-orphans">
                                        {t(
                                          "index.installationGuide.step3QuickAccessText"
                                        )}
                                      </p>
                                    </div>
                                    <Button
                                      onClick={() =>
                                        handleDeepLinkClick("index")
                                      }
                                      className="w-full sm:w-auto whitespace-nowrap"
                                      size="sm"
                                    >
                                      <Link2
                                        className="w-4 h-4 mr-2"
                                        aria-hidden="true"
                                      />
                                      {t("index.installationGuide.step3AddNow")}
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <div className="bg-warning/20 border-2 border-warning/40 rounded-lg p-4 sm:p-5">
                                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                    <div className="flex-1">
                                      <p className="text-sm sm:text-base font-semibold text-foreground mb-2 no-orphans">
                                        {t(
                                          "index.installationGuide.step3Restricted"
                                        )}
                                      </p>
                                      <p className="text-sm sm:text-base text-foreground/90 no-orphans">
                                        {t(
                                          "index.installationGuide.step3RestrictedText"
                                        )}
                                      </p>
                                    </div>
                                    <Button
                                      onClick={() => {
                                        handleRequireBilling();
                                      }}
                                      className="w-full sm:w-auto whitespace-nowrap border border-input bg-background hover:bg-accent hover:text-accent-foreground"
                                      size="sm"
                                    >
                                      {t(
                                        "index.installationGuide.step3ViewPricing"
                                      )}
                                    </Button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="absolute left-7 sm:left-8 md:left-9 top-16 sm:top-20 md:top-24 bottom-0 w-1 bg-border/60 -z-10" />
                  </div>

                  {/* Step 4 */}
                  <div className="relative">
                    <div className="flex gap-5 sm:gap-6 md:gap-8">
                      <div className="flex-shrink-0">
                        <div
                          className="w-14 h-14 sm:w-16 sm:h-16 md:w-20 md:h-20 bg-primary text-primary-foreground rounded-xl flex items-center justify-center font-bold text-xl sm:text-2xl md:text-3xl shadow-lg ring-2 ring-primary/20"
                          aria-label="Étape 4"
                        >
                          4
                        </div>
                      </div>
                      <div className="flex-1 min-w-0 pt-1">
                        <div className="flex items-start gap-4 mb-3">
                          <CheckCircle2
                            className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-success flex-shrink-0 mt-1"
                            aria-hidden="true"
                          />
                          <div className="flex-1">
                            <h3 className="font-bold text-lg sm:text-xl md:text-2xl mb-3 sm:mb-4 text-foreground no-orphans">
                              {t("index.installationGuide.step4Title")}
                            </h3>
                            <p className="text-base sm:text-lg text-foreground/90 mb-4 sm:mb-5 leading-relaxed no-orphans">
                              {t("index.installationGuide.step4Description")}
                            </p>
                            <div className="bg-success/25 border-2 border-success/50 rounded-lg p-4 sm:p-5">
                              <p className="text-sm sm:text-base text-foreground flex items-start gap-3 leading-relaxed">
                                <CheckCircle2
                                  className="w-5 h-5 sm:w-6 sm:h-6 text-success flex-shrink-0 mt-0.5"
                                  aria-hidden="true"
                                />
                                <span className="no-orphans">
                                  <strong className="font-bold text-foreground">
                                    {t(
                                      "index.installationGuide.step4Congratulations"
                                    )}{" "}
                                  </strong>
                                  {t(
                                    "index.installationGuide.step4CongratulationsText"
                                  )}
                                </span>
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Highlights Section */}
      <section className="py-12 sm:py-16 bg-muted/30">
        <div className="container mx-auto px-4 sm:px-6 md:px-8">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4 text-foreground">
                {t("index.features.title")}
              </h2>
              <p className="text-lg text-muted-foreground">
                {t("index.features.subtitle")}
              </p>
            </div>
            <FeatureHighlights />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-card border-t-2 border-border py-10 sm:py-12 md:py-16">
        <div className="container mx-auto px-4 sm:px-6 md:px-8 text-center">
          <div className="flex items-center justify-center gap-3 sm:gap-4 mb-4 sm:mb-6">
            <Sparkles
              className="w-7 h-7 sm:w-8 sm:h-8 md:w-9 md:h-9 flex-shrink-0 text-primary"
              aria-hidden="true"
            />
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground">
              NusenseTryOn
            </h2>
          </div>
          <p className="text-sm sm:text-base md:text-lg text-foreground/80 no-orphans">
            {t("index.footer.copyright", { year: new Date().getFullYear() })}
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
