import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router-dom";
import { useShop } from "@/providers/AppBridgeProvider";
import { useSubscription } from "@/hooks/useSubscription";
import { useCredits } from "@/hooks/useCredits";
import { useProducts } from "@/hooks/useProducts";
import { getAvailablePlans, subscribeToPlan, cancelSubscription, redeemCouponCode } from "@/services/billingApi";
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
  Calendar,
  CreditCard,
  Sparkle,
  Tag,
  Coins,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import FeatureHighlights from "@/components/FeatureHighlights";
import PlanSelection from "@/components/PlanSelection";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import TrialNotificationBanner from "@/components/TrialNotificationBanner";
import CreditBalance from "@/components/CreditBalance";

const Index = () => {
  const { t, i18n } = useTranslation();
  const location = useLocation();
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
  const [couponCode, setCouponCode] = useState("");
  const [redeemingCoupon, setRedeemingCoupon] = useState(false);

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
      // Get shop domain
      const shopDomain =
        shop || new URLSearchParams(window.location.search).get("shop");

      if (!shopDomain) {
        throw new Error("Shop parameter is required");
      }

      // Use remote API service
      const data = await getAvailablePlans(shopDomain);
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

      // Use remote API service
      const data = await cancelSubscription(
        shopDomain,
        subscription.subscription.id,
        false // Don't prorate - let subscription continue until period end
      );

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

  const handleRedeemCoupon = async () => {
    const shopDomain =
      shop || new URLSearchParams(window.location.search).get("shop");

    if (!shopDomain) {
      toast.error(t("index.errors.shopNotFound") || "Shop domain not found");
      return;
    }

    if (!couponCode || couponCode.trim() === "") {
      toast.error(t("index.errors.couponCodeRequired") || "Please enter a coupon code");
      return;
    }

    try {
      setRedeemingCoupon(true);

      const data = await redeemCouponCode(shopDomain, couponCode.trim().toUpperCase());

      if (data.success) {
        toast.success(
          data.message || 
          t("index.coupon.success") || 
          `Successfully redeemed ${couponCode}! ${data.credits || 0} credits added.`
        );
        setCouponCode("");
        // Refresh credits to show updated balance
        await refreshCredits();
      } else {
        toast.error(data.message || t("index.errors.couponError") || "Failed to redeem coupon code");
      }
    } catch (error: any) {
      console.error("[Coupon] Failed to redeem coupon", error);
      toast.error(error.message || t("index.errors.couponError") || "Failed to redeem coupon code");
    } finally {
      setRedeemingCoupon(false);
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

      console.log("[Billing] Creating subscription request", {
        shop: shopDomain,
        planHandle,
      });

      // Use remote API service
      const data = await subscribeToPlan(shopDomain, planHandle, null);

      console.log("[Billing] Subscription response received", {
        confirmationUrl: data.confirmationUrl,
        subscriptionId: data.appSubscription?.id,
        requestId: data.requestId,
      });

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

  // Fetch products on mount and store in Redux
  useEffect(() => {
    const shopDomain =
      shop || new URLSearchParams(window.location.search).get("shop");

    if (!shopDomain) {
      return;
    }

    // Normalize shop domain (remove .myshopify.com if present, API will handle it)
    const normalizedShop = shopDomain.replace(".myshopify.com", "");

    // Only fetch if we haven't fetched for this shop yet, or if products are empty
    if (
      reduxLastFetchedShop !== normalizedShop ||
      (reduxProducts.length === 0 && !productsLoading)
    ) {
      fetchProductsFromRedux({
        shop: normalizedShop,
        options: {
          status: "ACTIVE",
          productType: "Apparel",
        },
      }).catch((error) => {
        console.warn("[Index] Failed to fetch products:", error);
      });
    }
  }, [shop, reduxLastFetchedShop, reduxProducts.length, productsLoading, fetchProductsFromRedux]);

  // Fetch products on mount and store in Redux
  useEffect(() => {
    const shopDomain =
      shop || new URLSearchParams(window.location.search).get("shop");

    if (!shopDomain) {
      return;
    }

    // Normalize shop domain (remove .myshopify.com if present, API will handle it)
    const normalizedShop = shopDomain.replace(".myshopify.com", "");

    // Only fetch if we haven't fetched for this shop yet, or if products are empty
    if (
      reduxLastFetchedShop !== normalizedShop ||
      (reduxProducts.length === 0 && !productsLoading)
    ) {
      fetchProductsFromRedux({
        shop: normalizedShop,
        options: {
          status: "ACTIVE",
          productType: "Apparel",
        },
      }).catch((error) => {
        console.warn("[Index] Failed to fetch products:", error);
      });
    }
  }, [shop, reduxLastFetchedShop, reduxProducts.length, productsLoading, fetchProductsFromRedux]);

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
  const paymentSuccessRetryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const scrollToFeatures = () => {
    const featuresElement = document.getElementById("features-heading");
    if (!featuresElement) {
      return;
    }
    featuresElement.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Skip Link for Accessibility - Shopify Best Practice */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:font-medium focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
        tabIndex={0}
      >
        {t("common.skipToContent") || "Skip to main content"}
      </a>

      {/* Navigation Bar - Horizontal Layout */}
      <nav className="bg-card border-b border-border" role="navigation" aria-label="Main navigation">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between h-14">
              {/* Navigation Links */}
              <div className="flex items-center gap-1 sm:gap-2 flex-1 min-w-0">
                <Link
                  to="/"
                  className={`px-3 sm:px-4 py-2 text-sm font-medium transition-colors rounded-md hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 whitespace-nowrap ${
                    location.pathname === "/"
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  aria-label="Dashboard"
                >
                  Dashboard
                </Link>
                <Link
                  to="/nucopy"
                  className={`px-3 sm:px-4 py-2 text-sm font-medium transition-colors rounded-md hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 whitespace-nowrap ${
                    location.pathname === "/nucopy"
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  aria-label="NU Copy"
                >
                  NU Copy
                </Link>
                <Link
                  to="/nulight"
                  className={`px-3 sm:px-4 py-2 text-sm font-medium transition-colors rounded-md hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 whitespace-nowrap ${
                    location.pathname === "/nulight"
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  aria-label="NU Light"
                >
                  NU Light
                </Link>
                <Link
                  to="/nu3d"
                  className={`px-3 sm:px-4 py-2 text-sm font-medium transition-colors rounded-md hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 whitespace-nowrap ${
                    location.pathname === "/nu3d"
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  aria-label="Nu3d"
                >
                  Nu3d
                </Link>
                <Link
                  to="/nuscene"
                  className={`px-3 sm:px-4 py-2 text-sm font-medium transition-colors rounded-md hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 whitespace-nowrap ${
                    location.pathname === "/nuscene"
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  aria-label="Nu Scene"
                >
                  Nu Scene
                </Link>
              </div>

              {/* Language Switcher */}
              <div className="flex items-center ml-4 flex-shrink-0">
                <LanguageSwitcher />
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content - Always visible */}
      <>
          {/* Hero Section - Shopify Style */}
          <header className="relative bg-card border-b border-border min-h-[calc(100vh-56px)] flex items-center" role="banner">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 lg:py-16 w-full">
          <div className="max-w-7xl mx-auto" id="main-content" tabIndex={-1}>
            {/* Trial Notification Banner */}
            <div className="mb-6">
              <TrialNotificationBanner
                onApprovalInitiated={() => {
                  refreshSubscription();
                }}
              />
            </div>

            {/* Main Hero Content - Grid Layout with Plan Info on Right */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-center">
              {/* Left Section - Hero Content */}
              <div className="lg:col-span-8 space-y-8">
                {/* Brand & Title */}
                <div className="space-y-6">
                  <h1
                    className="inline-flex items-center font-bold tracking-tight text-3xl sm:text-4xl md:text-5xl lg:text-6xl leading-tight"
                    aria-label="NusenseTryOn"
                  >
                    <span className="text-primary" style={{ color: "#ce0003" }}>
                      Nusense
                    </span>
                    <span className="text-foreground" style={{ color: "#564646" }}>
                      TryOn
                    </span>
                  </h1>
                  <p className="text-xl sm:text-2xl text-foreground font-semibold leading-relaxed">
                    {t("index.hero.title")}
                  </p>
                  <p className="text-base sm:text-lg text-muted-foreground leading-relaxed max-w-2xl">
                    {t("index.hero.subtitle")}
                  </p>
                </div>

                {/* Primary CTAs - Shopify button group style */}
                <div className="flex flex-wrap gap-4 mt-8" role="group" aria-label={t("index.hero.primaryActions") || "Primary actions"}>
                  <Button
                    size="lg"
                    onClick={scrollToInstallationGuide}
                    className="h-11 min-h-[44px] px-6 font-medium focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                    aria-label={t("index.hero.startInstallation")}
                  >
                    <Zap className="w-4 h-4 mr-2" aria-hidden="true" />
                    {t("index.hero.startInstallation")}
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    onClick={() => {
                      handleRequireBilling();
                    }}
                    className="h-11 min-h-[44px] px-6 font-medium focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                    aria-label={t("index.hero.viewPricing")}
                  >
                    {t("index.hero.viewPricing")}
                  </Button>
                </div>
              </div>

              {/* Right Section - Plan Info */}
              <div className="lg:col-span-4">
                {subscription && subscription.subscription !== null ? (
                  <Card className="border border-border shadow-sm bg-card max-w-sm mx-auto lg:mx-0">
                    <CardContent className="p-4">
                      <div className="space-y-3">
                        {/* Plan Badges - Always visible */}
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {subscription.isFree ? (
                              <Badge
                                variant="outline"
                                className="gap-1.5 text-xs px-2.5 py-1 font-medium"
                                aria-label={t("index.planCard.freePlan")}
                              >
                                <Zap className="w-3 h-3" aria-hidden="true" />
                                <span>{t("index.planCard.freePlan")}</span>
                              </Badge>
                            ) : (
                              <Badge
                                variant="default"
                                className="gap-1.5 bg-primary text-primary-foreground text-xs px-2.5 py-1 font-medium"
                                aria-label={subscription.plan?.name || t("index.planCard.premiumPlan")}
                              >
                                <Crown className="w-3 h-3" aria-hidden="true" />
                                <span>{subscription.plan?.name || t("index.planCard.premiumPlan")}</span>
                              </Badge>
                            )}
                            {subscription.hasActiveSubscription && !subscription.isFree && (
                              <Badge
                                variant="secondary"
                                className="gap-1.5 bg-success/10 text-success border-success/20 text-xs px-2.5 py-1 font-medium"
                                aria-label={t("index.planCard.active")}
                              >
                                <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
                                <span>{t("index.planCard.active")}</span>
                              </Badge>
                            )}
                          </div>
                          {/* Plan Price & Interval - Show when plan exists */}
                          {subscription.plan && !subscription.isFree && (
                            <div className="pt-1">
                              <p className="text-sm font-semibold text-foreground">
                                {subscription.plan.currencyCode} {subscription.plan.price.toFixed(2)}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {subscription.plan.interval === "EVERY_30_DAYS" 
                                  ? t("planSelection.monthly") || "Monthly"
                                  : subscription.plan.interval === "ANNUAL"
                                  ? t("planSelection.annual") || "Annual"
                                  : subscription.plan.interval}
                              </p>
                            </div>
                          )}
                        </div>

                        {/* Trial Days Remaining - Single line display */}
                        <div className="min-h-[36px] flex items-center">
                          {subscription.subscription?.isInTrial &&
                          subscription.subscription?.trialDaysRemaining !== null ? (
                            <div className="w-full px-2.5 py-1.5 bg-primary/5 border border-primary/20 rounded-lg">
                              <div className="flex items-center gap-2">
                                <Sparkle className="w-3.5 h-3.5 text-primary flex-shrink-0" aria-hidden="true" />
                                <p className="text-xs font-medium text-foreground">
                                  <span className="text-muted-foreground">{t("index.planCard.trialPeriod")}</span>
                                  {" "}
                                  <span className="font-bold text-primary">
                                    {subscription.subscription.trialDaysRemaining}{" "}
                                    {subscription.subscription.trialDaysRemaining === 1
                                      ? t("index.planCard.trialDayRemaining")
                                      : t("index.planCard.trialDaysRemaining")}
                                  </span>
                                </p>
                              </div>
                            </div>
                          ) : (
                            <div className="w-full" aria-hidden="true" />
                          )}
                        </div>

                        {/* Action Buttons - Consistent spacing */}
                        <div className="space-y-1.5" role="group" aria-label={t("index.planCard.planActions") || "Plan actions"}>
                          <Button
                            size="sm"
                            className="w-full h-9 min-h-[36px] font-medium text-xs focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                            onClick={() => {
                              handleRequireBilling();
                            }}
                            aria-label={subscription.isFree
                              ? t("index.planCard.upgradeToPremium")
                              : t("index.planCard.manageSubscription")}
                          >
                            <CreditCard className="w-3.5 h-3.5 mr-1.5" aria-hidden="true" />
                            {subscription.isFree
                              ? t("index.planCard.upgradeToPremium")
                              : t("index.planCard.manageSubscription")}
                          </Button>
                          {/* Cancel Button - Consistent spacing whether shown or not */}
                          <div className="min-h-[36px]">
                            {subscription && 
                             subscription.subscription !== null && 
                             !subscription.isFree && 
                             subscription.subscription?.id ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="w-full h-9 min-h-[36px] font-medium text-xs text-destructive border-destructive/20 hover:bg-destructive/10 hover:text-destructive focus-visible:ring-2 focus-visible:ring-destructive focus-visible:ring-offset-2"
                                  onClick={handleCancelSubscription}
                                  disabled={cancelling}
                                  aria-label={cancelling
                                    ? t("index.planCard.cancelling")
                                    : t("index.planCard.cancelSubscription")}
                                >
                                  <X className="w-3.5 h-3.5 mr-1.5" aria-hidden="true" />
                                  {cancelling
                                    ? t("index.planCard.cancelling")
                                    : t("index.planCard.cancelSubscription")}
                                </Button>
                              ) : (
                                <div className="w-full" aria-hidden="true" />
                              )}
                          </div>
                        </div>

                        {/* Subscription Period Info - Show when available */}
                        {subscription.subscription && !subscription.isFree && (
                          <div className="pt-1.5 border-t border-border">
                            <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                              <div className="p-1.5 rounded bg-muted/30">
                                <p className="text-muted-foreground mb-0.5 leading-tight">{t("index.planCard.periodStart") || "Period Start"}</p>
                                <p className="font-medium text-foreground leading-tight">
                                  {subscription.subscription.currentPeriodStart
                                    ? new Date(subscription.subscription.currentPeriodStart).toLocaleDateString(
                                        i18n.language === "fr" ? "fr-FR" : "en-US",
                                        { year: 'numeric', month: 'short', day: 'numeric' }
                                      )
                                    : "—"}
                                </p>
                              </div>
                              <div className="p-1.5 rounded bg-muted/30">
                                <p className="text-muted-foreground mb-0.5 leading-tight">{t("index.planCard.periodEnd") || "Period End"}</p>
                                <p className="font-medium text-foreground leading-tight">
                                  {subscription.subscription.currentPeriodEnd
                                    ? new Date(subscription.subscription.currentPeriodEnd).toLocaleDateString(
                                        i18n.language === "fr" ? "fr-FR" : "en-US",
                                        { year: 'numeric', month: 'short', day: 'numeric' }
                                      )
                                    : "—"}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Promo Code Section - Always visible for consistent layout */}
                        <div className="pt-2 border-t border-border">
                          <label htmlFor="coupon-code" className="flex items-center gap-1.5 text-[10px] font-medium text-foreground mb-1.5">
                            <Tag className="w-3 h-3" aria-hidden="true" />
                            {t("index.coupon.label") || "Promo Code"}
                          </label>
                          <div className="flex gap-1.5">
                            <Input
                              id="coupon-code"
                              type="text"
                              placeholder={t("index.coupon.placeholder") || "Enter promo code"}
                              value={couponCode}
                              onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && !redeemingCoupon) {
                                  handleRedeemCoupon();
                                }
                              }}
                              disabled={redeemingCoupon}
                              className="flex-1 h-8 text-xs"
                              aria-label={t("index.coupon.inputLabel") || "Promo code input"}
                            />
                            <Button
                              type="button"
                              size="sm"
                              onClick={handleRedeemCoupon}
                              disabled={redeemingCoupon || !couponCode.trim()}
                              className="h-8 px-3 font-medium text-xs whitespace-nowrap"
                              aria-label={redeemingCoupon ? (t("index.coupon.applying") || "Applying...") : (t("index.coupon.apply") || "Apply")}
                            >
                              {redeemingCoupon ? (t("index.coupon.applying") || "Applying...") : (t("index.coupon.apply") || "Apply")}
                            </Button>
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-1">
                            {t("index.coupon.hint") || "Enter a promo code to redeem credits"}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="border border-border shadow-sm bg-card max-w-sm mx-auto lg:mx-0">
                    <CardContent className="p-4">
                      <div className="space-y-3">
                        <h2 id="plan-card-heading" className="text-xs sm:text-sm font-semibold text-foreground">
                          {t("index.planCard.title")}
                        </h2>
                        <div className="flex flex-col items-center gap-3 text-center">
                          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/5 border border-primary/10">
                            <CreditCard className="w-6 h-6 text-primary" aria-hidden="true" />
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground mb-1.5">
                              {t("index.planCard.noPlanSelected")}
                            </p>
                            <p className="text-[10px] text-muted-foreground mb-3">
                              {t("index.planCard.selectPlanToContinue") || "Select a plan to get started"}
                            </p>
                            <Button
                              size="sm"
                              className="w-full h-9 min-h-[36px] font-medium text-xs focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                              onClick={() => {
                                handleRequireBilling();
                              }}
                              aria-label={t("index.planCard.choosePlan")}
                            >
                              <Sparkle className="w-3.5 h-3.5 mr-1.5" aria-hidden="true" />
                              {t("index.planCard.choosePlan")}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Credits Section - Below Hero */}
      <section className="bg-muted/30 border-b border-border py-12 sm:py-16 lg:py-20" aria-labelledby="credits-heading">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            {subscription && subscription.subscription !== null ? (
              <Card className="border border-border shadow-sm bg-card">
                <CardContent className="p-6 sm:p-8">
                  <div className="space-y-6">
                    <div className="flex items-center gap-2 mb-4">
                      <Coins className="h-5 w-5 text-primary" aria-hidden="true" />
                      <h2 id="credits-heading" className="text-lg font-semibold text-foreground">
                        {t("credits.balanceCard.title") || "Credit Balance"}
                      </h2>
                    </div>
                    {/* Credits Table - Clean tabular UI */}
                    {credits && !subscription.isFree ? (
                      <CreditBalance variant="embedded" />
                    ) : (
                      <div className="p-8 rounded-lg bg-muted/20 border border-border/40 flex items-center justify-center min-h-[200px]">
                        <div className="text-center space-y-2">
                          <Coins className="w-8 h-8 text-muted-foreground mx-auto opacity-50" aria-hidden="true" />
                          <p className="text-sm text-muted-foreground">
                            {subscription.isFree 
                              ? t("index.planCard.creditsAvailableAfterUpgrade") || "Credits available after upgrade"
                              : t("index.planCard.loadingCredits") || "Loading credits..."}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="border border-border shadow-sm bg-card">
                <CardContent className="p-6 sm:p-8">
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-6 text-center sm:text-left">
                    <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-5">
                      <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/5 border border-primary/10">
                        <CreditCard className="w-7 h-7 text-primary" aria-hidden="true" />
                      </div>
                      <div>
                        <h2 id="plan-card-heading" className="text-base sm:text-lg font-semibold text-foreground mb-1.5">
                          {t("index.planCard.title")}
                        </h2>
                        <p className="text-sm text-muted-foreground max-w-md">
                          {t("index.planCard.noPlanSelected")}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {t("index.planCard.selectPlanToContinue") || "Select a plan to get started"}
                        </p>
                      </div>
                    </div>
                    <Button
                      size="lg"
                      className="h-11 min-h-[44px] px-6 font-medium focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                      onClick={() => {
                        handleRequireBilling();
                      }}
                      aria-label={t("index.planCard.choosePlan")}
                    >
                      <Sparkle className="w-4 h-4 mr-2" aria-hidden="true" />
                      {t("index.planCard.choosePlan")}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </section>

      {/* Installation Instructions - Shopify Section Style */}
      <section
        id="installation-guide"
        className="py-12 sm:py-16 lg:py-20 bg-background"
        aria-labelledby="installation-guide-heading"
      >
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="space-y-6">
              {/* Section Header */}
              <header className="mb-12">
                <h2 id="installation-guide-heading" className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground mb-2">
                  {t("index.installationGuide.title")}
                </h2>
                <p className="text-base text-muted-foreground">
                  {t("index.installationGuide.subtitle")}
                </p>
              </header>

              {/* Installation Steps Card - Shopify Card Style */}
              <Card className="border border-border shadow-sm bg-card">
                <CardContent className="p-6 sm:p-8 lg:p-10">
                  {/* Info Banner - Shopify Alert Style */}
                  <div className="mb-8 p-4 bg-info/10 border border-info/20 rounded-lg">
                    <p className="text-sm text-foreground leading-relaxed">
                      <strong className="font-semibold text-foreground">
                        {t("index.installationGuide.appBlockNote")}{" "}
                      </strong>
                      {t("index.installationGuide.appBlockDescription")}
                    </p>
                  </div>

                  {/* Steps Container */}
                  <div className="space-y-10 sm:space-y-12">
                    {/* Step 1 - Shopify Step Style */}
                    <div className="relative">
                      <div className="flex gap-4 sm:gap-6">
                        <div className="flex-shrink-0">
                          <div
                            className="w-10 h-10 sm:w-12 sm:h-12 bg-primary text-primary-foreground rounded-lg flex items-center justify-center font-semibold text-lg sm:text-xl shadow-sm"
                            aria-label="Step 1"
                          >
                            1
                          </div>
                        </div>
                        <div className="flex-1 min-w-0 pt-0.5">
                          <div className="space-y-3">
                            <div className="flex items-start gap-3">
                              <Store
                                className="w-5 h-5 text-primary flex-shrink-0 mt-0.5"
                                aria-hidden="true"
                              />
                              <div className="flex-1">
                                <h4 className="font-semibold text-lg sm:text-xl mb-2 text-foreground">
                                  {t("index.installationGuide.step1Title")}
                                </h4>
                                <p className="text-sm sm:text-base text-muted-foreground mb-4 leading-relaxed">
                                  {t("index.installationGuide.step1Description")}
                                </p>
                                <div className="p-3 bg-info/10 border border-info/20 rounded-lg">
                                  <p className="text-xs sm:text-sm text-foreground leading-relaxed">
                                    <strong className="font-semibold text-foreground">
                                      {t("index.installationGuide.step1Note")}{" "}
                                    </strong>
                                    {t("index.installationGuide.step1NoteText")}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="absolute left-5 sm:left-6 top-12 bottom-0 w-0.5 bg-border/40 -z-10" />
                    </div>

                    {/* Step 2 - Shopify Step Style */}
                    <div className="relative">
                      <div className="flex gap-4 sm:gap-6">
                        <div className="flex-shrink-0">
                          <div
                            className="w-10 h-10 sm:w-12 sm:h-12 bg-primary text-primary-foreground rounded-lg flex items-center justify-center font-semibold text-lg sm:text-xl shadow-sm"
                            aria-label="Step 2"
                          >
                            2
                          </div>
                        </div>
                        <div className="flex-1 min-w-0 pt-0.5">
                          <div className="space-y-3">
                            <div className="flex items-start gap-3">
                              <Zap
                                className="w-5 h-5 text-primary flex-shrink-0 mt-0.5"
                                aria-hidden="true"
                              />
                              <div className="flex-1">
                                <h4 className="font-semibold text-lg sm:text-xl mb-2 text-foreground">
                                  {t("index.installationGuide.step2Title")}
                                </h4>
                                <p className="text-sm sm:text-base text-muted-foreground mb-4 leading-relaxed">
                                  {t("index.installationGuide.step2Description")}
                                </p>
                                <div className="space-y-3">
                                  <div className="p-4 bg-muted/50 rounded-lg border border-border">
                                    <p className="text-sm font-semibold text-foreground mb-3">
                                      {t("index.installationGuide.step2Instructions")}
                                    </p>
                                    <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                                      <li>{t("index.installationGuide.step2Instruction1")}</li>
                                      <li>{t("index.installationGuide.step2Instruction2")}</li>
                                      <li>{t("index.installationGuide.step2Instruction3")}</li>
                                      <li>{t("index.installationGuide.step2Instruction4")}</li>
                                      <li>{t("index.installationGuide.step2Instruction5")}</li>
                                    </ol>
                                  </div>
                                  <div className="p-3 bg-warning/10 border border-warning/20 rounded-lg">
                                    <p className="text-xs sm:text-sm text-foreground flex items-start gap-2 leading-relaxed">
                                      <Shield
                                        className="w-4 h-4 text-warning flex-shrink-0 mt-0.5"
                                        aria-hidden="true"
                                      />
                                      <span>
                                        <strong className="font-semibold text-foreground">
                                          {t("index.installationGuide.step2Important")}{" "}
                                        </strong>
                                        {t("index.installationGuide.step2ImportantText")}
                                      </span>
                                    </p>
                                  </div>
                                  {subscription && subscription.subscription !== null ? (
                                    <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
                                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                                        <div className="flex-1">
                                          <p className="text-sm font-semibold text-foreground mb-1">
                                            {t("index.installationGuide.step2QuickAccess")}
                                          </p>
                                          <p className="text-xs sm:text-sm text-muted-foreground">
                                            {t("index.installationGuide.step2QuickAccessText")}
                                          </p>
                                        </div>
                                        <Button
                                          onClick={() => handleDeepLinkClick("product")}
                                          className="w-full sm:w-auto whitespace-nowrap mt-2 sm:mt-0 min-h-[44px] focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                                          size="sm"
                                          aria-label={t("index.installationGuide.step2AddNow")}
                                        >
                                          <Link2 className="w-4 h-4 mr-2" aria-hidden="true" />
                                          {t("index.installationGuide.step2AddNow")}
                                        </Button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="p-4 bg-warning/10 border border-warning/20 rounded-lg">
                                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                                        <div className="flex-1">
                                          <p className="text-sm font-semibold text-foreground mb-1">
                                            {t("index.installationGuide.step2Restricted")}
                                          </p>
                                          <p className="text-xs sm:text-sm text-muted-foreground">
                                            {t("index.installationGuide.step2RestrictedText")}
                                          </p>
                                        </div>
                                        <Button
                                          onClick={() => handleRequireBilling()}
                                          variant="outline"
                                          className="w-full sm:w-auto whitespace-nowrap mt-2 sm:mt-0 min-h-[44px] focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                                          size="sm"
                                          aria-label={t("index.installationGuide.step2ViewPricing")}
                                        >
                                          {t("index.installationGuide.step2ViewPricing")}
                                        </Button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="absolute left-5 sm:left-6 top-12 bottom-0 w-0.5 bg-border/40 -z-10" />
                    </div>

                    {/* Step 3 - Shopify Step Style */}
                    <div className="relative">
                      <div className="flex gap-4 sm:gap-6">
                        <div className="flex-shrink-0">
                          <div
                            className="w-10 h-10 sm:w-12 sm:h-12 bg-primary text-primary-foreground rounded-lg flex items-center justify-center font-semibold text-lg sm:text-xl shadow-sm"
                            aria-label="Step 3"
                          >
                            3
                          </div>
                        </div>
                        <div className="flex-1 min-w-0 pt-0.5">
                          <div className="space-y-3">
                            <div className="flex items-start gap-3">
                              <Sparkles
                                className="w-5 h-5 text-primary flex-shrink-0 mt-0.5"
                                aria-hidden="true"
                              />
                              <div className="flex-1">
                                <h4 className="font-semibold text-lg sm:text-xl mb-2 text-foreground">
                                  {t("index.installationGuide.step3Title")}
                                </h4>
                                <p className="text-sm sm:text-base text-muted-foreground mb-4 leading-relaxed">
                                  {t("index.installationGuide.step3Description")}
                                </p>
                                <div className="space-y-3">
                                  <div className="p-4 bg-muted/50 rounded-lg border border-border">
                                    <p className="text-sm font-semibold text-foreground mb-3">
                                      {t("index.installationGuide.step3Instructions")}
                                    </p>
                                    <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                                      <li>{t("index.installationGuide.step3Instruction1")}</li>
                                      <li>{t("index.installationGuide.step3Instruction2")}</li>
                                      <li>{t("index.installationGuide.step3Instruction3")}</li>
                                      <li>{t("index.installationGuide.step3Instruction4")}</li>
                                      <li>{t("index.installationGuide.step3Instruction5")}</li>
                                    </ol>
                                  </div>
                                  <div className="p-3 bg-info/10 border border-info/20 rounded-lg">
                                    <p className="text-xs sm:text-sm text-foreground flex items-start gap-2 leading-relaxed">
                                      <Sparkles
                                        className="w-4 h-4 text-info flex-shrink-0 mt-0.5"
                                        aria-hidden="true"
                                      />
                                      <span>
                                        <strong className="font-semibold text-foreground">
                                          {t("index.installationGuide.step3Tip")}{" "}
                                        </strong>
                                        {t("index.installationGuide.step3TipText")}
                                      </span>
                                    </p>
                                  </div>
                                  {subscription && subscription.subscription !== null ? (
                                    <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
                                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                                        <div className="flex-1">
                                          <p className="text-sm font-semibold text-foreground mb-1">
                                            {t("index.installationGuide.step3QuickAccess")}
                                          </p>
                                          <p className="text-xs sm:text-sm text-muted-foreground">
                                            {t("index.installationGuide.step3QuickAccessText")}
                                          </p>
                                        </div>
                                        <Button
                                          onClick={() => handleDeepLinkClick("index")}
                                          className="w-full sm:w-auto whitespace-nowrap mt-2 sm:mt-0 min-h-[44px] focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                                          size="sm"
                                          aria-label={t("index.installationGuide.step3AddNow")}
                                        >
                                          <Link2 className="w-4 h-4 mr-2" aria-hidden="true" />
                                          {t("index.installationGuide.step3AddNow")}
                                        </Button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="p-4 bg-warning/10 border border-warning/20 rounded-lg">
                                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                                        <div className="flex-1">
                                          <p className="text-sm font-semibold text-foreground mb-1">
                                            {t("index.installationGuide.step3Restricted")}
                                          </p>
                                          <p className="text-xs sm:text-sm text-muted-foreground">
                                            {t("index.installationGuide.step3RestrictedText")}
                                          </p>
                                        </div>
                                        <Button
                                          onClick={() => handleRequireBilling()}
                                          variant="outline"
                                          className="w-full sm:w-auto whitespace-nowrap mt-2 sm:mt-0 min-h-[44px] focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                                          size="sm"
                                          aria-label={t("index.installationGuide.step3ViewPricing")}
                                        >
                                          {t("index.installationGuide.step3ViewPricing")}
                                        </Button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="absolute left-5 sm:left-6 top-12 bottom-0 w-0.5 bg-border/40 -z-10" />
                    </div>

                    {/* Step 4 - Shopify Step Style */}
                    <div className="relative">
                      <div className="flex gap-4 sm:gap-6">
                        <div className="flex-shrink-0">
                          <div
                            className="w-10 h-10 sm:w-12 sm:h-12 bg-success text-success-foreground rounded-lg flex items-center justify-center font-semibold text-lg sm:text-xl shadow-sm"
                            aria-label="Step 4"
                          >
                            4
                          </div>
                        </div>
                        <div className="flex-1 min-w-0 pt-0.5">
                          <div className="space-y-3">
                            <div className="flex items-start gap-3">
                              <CheckCircle2
                                className="w-5 h-5 text-success flex-shrink-0 mt-0.5"
                                aria-hidden="true"
                              />
                              <div className="flex-1">
                                <h4 className="font-semibold text-lg sm:text-xl mb-2 text-foreground">
                                  {t("index.installationGuide.step4Title")}
                                </h4>
                                <p className="text-sm sm:text-base text-muted-foreground mb-4 leading-relaxed">
                                  {t("index.installationGuide.step4Description")}
                                </p>
                                <div className="p-4 bg-success/10 border border-success/20 rounded-lg">
                                  <p className="text-xs sm:text-sm text-foreground flex items-start gap-2 leading-relaxed">
                                    <CheckCircle2
                                      className="w-4 h-4 text-success flex-shrink-0 mt-0.5"
                                      aria-hidden="true"
                                    />
                                    <span>
                                      <strong className="font-semibold text-foreground">
                                        {t("index.installationGuide.step4Congratulations")}{" "}
                                      </strong>
                                      {t("index.installationGuide.step4CongratulationsText")}
                                    </span>
                                  </p>
                                </div>
                              </div>
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

      {/* Feature Highlights Section - Shopify Section Style */}
      <section className="py-12 sm:py-16 lg:py-20 bg-muted/30" aria-labelledby="features-heading">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <header className="text-center mb-12">
              <h2 id="features-heading" className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-2 text-foreground">
                {t("index.features.title")}
              </h2>
              <p className="text-base text-muted-foreground">
                {t("index.features.subtitle")}
              </p>
            </header>
            <FeatureHighlights />
          </div>
        </div>
      </section>

        {/* Footer - Shopify Footer Style */}
        <footer className="bg-card border-t border-border py-12 sm:py-16" role="contentinfo">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-7xl mx-auto text-center">
              <div className="flex items-center justify-center gap-3 mb-6">
                <Sparkles
                  className="w-6 h-6 text-primary flex-shrink-0"
                  aria-hidden="true"
                />
                <h2 className="text-xl sm:text-2xl font-bold text-foreground">
                  NusenseTryOn
                </h2>
              </div>
              <p className="text-sm text-muted-foreground">
                {t("index.footer.copyright", { year: new Date().getFullYear() })}
              </p>
            </div>
          </div>
        </footer>
      </>

      {/* Plan Selection UI - Modal Overlay */}
      {showPlanSelection && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-lg shadow-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <PlanSelection
              plans={availablePlans}
              onSelectPlan={handleSelectPlan}
              loading={billingLoading}
              subscription={subscription}
              onBack={() => setShowPlanSelection(false)}
            />
          </div>
        </div>
      )}

      {/* Loading Overlay - Show on top of content when loading */}
      {shouldShowLoading && (
        <div className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm flex items-center justify-center">
          <div className="text-center space-y-4 bg-card border border-border rounded-lg p-8 shadow-lg">
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
      )}
    </div>
  );
};

export default Index;
