import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useShop } from "@/providers/AppBridgeProvider";
import { useSubscription } from "@/hooks/useSubscription";
import { useCredits } from "@/hooks/useCredits";
import { getAvailablePlans, subscribeToPlan, cancelSubscription, redeemCouponCode } from "@/services/billingApi";
import { getReferralCode } from "@/services/referralsApi";
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
  Coins,
  X,
  AlertTriangle,
  Copy,
  Users,
  Gift,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import FeatureHighlights from "@/components/FeatureHighlights";
import PlanSelection from "@/components/PlanSelection";
import { PlanConfirmation } from "@/components/PlanConfirmation";
import NavigationBar from "@/components/NavigationBar";
import CreditBalance from "@/components/CreditBalance";
import CreditUtilizationBanner from "@/components/CreditUtilizationBanner";

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
  const [availablePlans, setAvailablePlans] = useState<any[] | any>([]);
  const [billingLoading, setBillingLoading] = useState(false);
  const [showPlanSelection, setShowPlanSelection] = useState(false);
  const [showPlanConfirmation, setShowPlanConfirmation] = useState(false);
  const [selectedPlanForConfirmation, setSelectedPlanForConfirmation] = useState<any | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [redeemingCoupon, setRedeemingCoupon] = useState(false);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [loadingReferralCode, setLoadingReferralCode] = useState(false);
  const [copyingReferralCode, setCopyingReferralCode] = useState(false);

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

  // Lock body scroll when plan selection modal is open
  useEffect(() => {
    if (showPlanSelection) {
      // Save current scroll position
      const scrollY = window.scrollY;
      // Lock body scroll
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
      document.body.style.overflow = 'hidden';
      
      return () => {
        // Restore scroll position when modal closes
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        document.body.style.overflow = '';
        window.scrollTo(0, scrollY);
      };
    }
  }, [showPlanSelection]);

  const CreditsBalanceSkeleton = () => (
    <div
      className="p-6 sm:p-8 rounded-lg bg-muted/20 border border-border/40 min-h-[200px]"
      role="status"
      aria-live="polite"
      aria-label={t("credits.balanceCard.loading") || "Loading credits"}
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-5 w-44" />
          <Skeleton className="h-5 w-20" />
        </div>
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="bg-muted/40 border-b border-border px-4 py-3 flex items-center justify-between gap-4">
            <Skeleton className="h-4 w-32" />
            <div className="flex items-center gap-3">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-16" />
            </div>
          </div>
          <div className="divide-y divide-border">
            {[1, 2, 3, 4, 5].map((row) => (
              <div key={row} className="px-4 py-3 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-8 w-8 rounded-md" />
                  <Skeleton className="h-4 w-28" />
                </div>
                <div className="flex items-center gap-3">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-16" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );


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
      
      // Handle new API structure: can be array of plans or object with plans and planTiers
      if (Array.isArray(data)) {
        setAvailablePlans(data);
      } else if (data.plans) {
        // New structure with plans and planTiers
        setAvailablePlans(data);
      } else {
        setAvailablePlans([]);
      }
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

    const hasPlans = Array.isArray(availablePlans) 
      ? availablePlans.length > 0 
      : (availablePlans?.plans?.length > 0 || availablePlans?.planTiers);
    if (!hasPlans) {
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

    try {
      setCancelling(true);
      setShowCancelDialog(false); // Close dialog

      // Use remote API service
      const data = await cancelSubscription(
        shopDomain,
        subscription.subscription.id,
        false // Don't prorate - let subscription continue until period end
      );

      // Refresh subscription status
      await refreshSubscription();

      // Sync credits after cancellation to clear plan credits
      try {
        const { syncCredits } = await import("@/services/creditsApi");
        const syncResult = await syncCredits(shopDomain);
        if (syncResult.success) {
          console.log("[Billing] Credits synced after cancellation", {
            action: syncResult.action,
            requestId: syncResult.requestId,
          });
        } else {
          console.warn("[Billing] Credit sync failed after cancellation", {
            error: syncResult.error,
            message: syncResult.message,
            requestId: syncResult.requestId,
          });
        }
      } catch (syncError) {
        // Don't block cancellation flow if credit sync fails
        console.error("[Billing] Failed to sync credits after cancellation", syncError);
      }

      toast.success(t("index.planCard.subscriptionCancelled") || "Subscription cancelled successfully");
      console.log("[Billing] Subscription cancelled successfully", data);
    } catch (error: any) {
      console.error("[Billing] Failed to cancel subscription", error);
      toast.error(error.message || t("index.errors.cancelError") || "Failed to cancel subscription");
    } finally {
      setCancelling(false);
    }
  };

  const handleCopyReferralCode = async () => {
    if (!referralCode) return;

    try {
      setCopyingReferralCode(true);
      await navigator.clipboard.writeText(referralCode);
      toast.success(t("referral.toast.codeCopied"), {
        description: t("referral.toast.codeCopiedDescription"),
      });
    } catch (err) {
      console.error("[Index] Failed to copy referral code", err);
      toast.error(t("referral.toast.copyFailed"), {
        description: t("referral.toast.copyFailedDescription"),
      });
    } finally {
      setCopyingReferralCode(false);
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

  // Helper function to find plan by handle
  const findPlanByHandle = (planHandle: string): any | null => {
    if (Array.isArray(availablePlans)) {
      return availablePlans.find((p: any) => p.handle === planHandle) || null;
    } else if (availablePlans?.plans) {
      return availablePlans.plans.find((p: any) => p.handle === planHandle) || null;
    } else if (availablePlans?.planTiers) {
      // Search through all tiers
      const tiers = availablePlans.planTiers;
      for (const tierKey in tiers) {
        const tierPlans = tiers[tierKey];
        if (Array.isArray(tierPlans)) {
          const found = tierPlans.find((p: any) => p.handle === planHandle);
          if (found) return found;
        }
      }
    }
    return null;
  };

  const handleSelectPlan = (planHandle: string) => {
    const plan = findPlanByHandle(planHandle);
    
    if (plan) {
      setSelectedPlanForConfirmation(plan);
      setShowPlanSelection(false);
      setShowPlanConfirmation(true);
    } else {
      console.error("[Billing] Plan not found for handle:", planHandle);
      toast.error(t("planConfirmation.error.planNotFound") || "Selected plan not found");
    }
  };

  const handleConfirmPlan = async (referralCode: string | null) => {
    if (!selectedPlanForConfirmation) {
      toast.error(t("planConfirmation.error.planNotFound") || "Selected plan not found");
      return;
    }

    const shopDomain =
      shop || new URLSearchParams(window.location.search).get("shop");

    if (!shopDomain) {
      toast.error("Shop domain not found");
      return;
    }

    try {
      setBillingLoading(true);

      console.log("[Billing] Creating subscription request", {
        shop: shopDomain,
        planHandle: selectedPlanForConfirmation.handle,
        referralCode: referralCode || "none",
      });

      // Note: Referral code is validated separately via /api/referrals/validate
      // The backend will handle referral code validation during subscription creation
      // We pass null as promoCode (promoCode is different from referral code)
      const data = await subscribeToPlan(shopDomain, selectedPlanForConfirmation.handle, null);

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

      // Reset confirmation state before redirecting
      // This prevents showing confirmation step if user returns/cancels payment
      setShowPlanConfirmation(false);
      setSelectedPlanForConfirmation(null);

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
      // Reset confirmation state on error so user can try again
      setShowPlanConfirmation(false);
      setSelectedPlanForConfirmation(null);
    } finally {
      setBillingLoading(false);
    }
  };

  const handleBackToPlanSelection = () => {
    setShowPlanConfirmation(false);
    setSelectedPlanForConfirmation(null);
    setShowPlanSelection(true);
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

  // Handle deep link to add app embed blocks to theme layout
  const handleAddAppEmbed = async (
    embedType: "button" | "banner"
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

    // Extract myshopifyDomain from shop domain
    // Note: Shopify always uses myshopify.com domain internally (even for custom domain stores)
    // App Bridge and URL params will always provide the myshopify.com format
    // The deep link URLs require the full myshopify.com domain
    let myshopifyDomain = shopDomain;
    if (!shopDomain.includes(".myshopify.com")) {
      // If shopDomain is just the store handle, construct the full domain
      myshopifyDomain = `${shopDomain}.myshopify.com`;
    }

    // App API key (client_id from shopify.app.toml)
    const apiKey = "f8de7972ae23d3484581d87137829385";
    
    // Determine the app embed block handle and template
    let blockHandle: string;
    let template: string;
    
    if (embedType === "button") {
      blockHandle = "nusense-tryon-button-embed";
      template = "product"; // Button appears on product pages
    } else {
      blockHandle = "nusense-tryon-banner";
      template = "index"; // Banner appears on home page
    }

    // Deep link format for app embed blocks (per Shopify documentation):
    // https://<myshopifyDomain>/admin/themes/current/editor?context=apps&template={template}&activateAppId={api_key}/{handle}
    // This automatically activates the app embed block in the theme editor
    // Note: <myshopifyDomain> should be the shop's myshopify.com domain (e.g., store-name.myshopify.com)
    const deepLinkUrl = `https://${myshopifyDomain}/admin/themes/current/editor?context=apps&template=${template}&activateAppId=${apiKey}/${blockHandle}`;

    // Open in a new tab to avoid X-Frame-Options issues and keep the app open
    // This works whether we're in an iframe or not
    window.open(deepLinkUrl, "_blank", "noopener,noreferrer");
  };

  // Fetch plans on mount
  useEffect(() => {
    const hasPlans = Array.isArray(availablePlans) 
      ? availablePlans.length > 0 
      : (availablePlans?.plans?.length > 0 || availablePlans?.planTiers);
    if (!hasPlans) {
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

  // Fetch referral code for all users (free and paid plans)
  useEffect(() => {
    const fetchReferralCode = async () => {
      const shopDomain = shop || new URLSearchParams(window.location.search).get("shop");
      
      if (!shopDomain) {
        return;
      }

      // Wait for subscription to finish loading
      if (subscriptionLoading) {
        return;
      }

      // Fetch referral code for all users (no longer restricted to paid plans)
      try {
        setLoadingReferralCode(true);
        const response = await getReferralCode(shopDomain);
        
        if (response.success && response.referralCode) {
          setReferralCode(response.referralCode);
        } else {
          setReferralCode(null);
        }
      } catch (error) {
        console.error("[Index] Failed to fetch referral code", error);
        setReferralCode(null);
      } finally {
        setLoadingReferralCode(false);
      }
    };

    fetchReferralCode();
  }, [shop, subscriptionLoading]);

  // Track if billing flow has been triggered to prevent infinite loops
  // Use sessionStorage to persist across remounts (navigation between routes)
  const getBillingTriggeredState = (): boolean => {
    try {
      const shopDomain = shop || new URLSearchParams(window.location.search).get("shop");
      if (!shopDomain) return false;
      const normalizedShop = shopDomain.includes(".myshopify.com")
        ? shopDomain.toLowerCase()
        : `${shopDomain.toLowerCase()}.myshopify.com`;
      const stored = sessionStorage.getItem(`billingTriggered_${normalizedShop}`);
      return stored === "true";
    } catch {
      return false;
    }
  };

  const setBillingTriggeredState = (value: boolean): void => {
    try {
      const shopDomain = shop || new URLSearchParams(window.location.search).get("shop");
      if (!shopDomain) return;
      const normalizedShop = shopDomain.includes(".myshopify.com")
        ? shopDomain.toLowerCase()
        : `${shopDomain.toLowerCase()}.myshopify.com`;
      if (value) {
        sessionStorage.setItem(`billingTriggered_${normalizedShop}`, "true");
      } else {
        sessionStorage.removeItem(`billingTriggered_${normalizedShop}`);
      }
    } catch {
      // Ignore storage errors
    }
  };

  const billingTriggeredRef = useRef(getBillingTriggeredState());
  const lastSubscriptionRef = useRef<typeof subscription>(null);
  const paymentSuccessTimeRef = useRef<number | null>(null);
  const paymentSuccessRetryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const componentMountTimeRef = useRef<number>(Date.now());
  const initialLoadGracePeriodRef = useRef<boolean>(true);

  // State to track payment success for reactive UI updates
  const [isWaitingForPaymentSuccess, setIsWaitingForPaymentSuccess] =
    useState(false);
  const [paymentSuccessElapsedTime, setPaymentSuccessElapsedTime] = useState(0);

  // Initialize component mount time and grace period on mount
  useEffect(() => {
    try {
      componentMountTimeRef.current = Date.now();
      initialLoadGracePeriodRef.current = true;
      
      // Clear grace period after a short delay (300ms) to allow subscription hook to initialize
      const gracePeriodTimeout = setTimeout(() => {
        initialLoadGracePeriodRef.current = false;
      }, 300);

      return () => {
        clearTimeout(gracePeriodTimeout);
      };
    } catch (error) {
      console.error("[Index] Error in grace period initialization:", error);
      // Ensure grace period is cleared even on error
      initialLoadGracePeriodRef.current = false;
    }
  }, []);

  // Check subscription and redirect to pricing page if subscription is null
  useEffect(() => {
    console.log("🔍 [Redirect Debug] useEffect triggered");
    console.log(
      "🔍 [Redirect Debug] subscriptionLoading:",
      subscriptionLoading
    );
    console.log("🔍 [Redirect Debug] subscription:", subscription);
    
    // Apply grace period: don't trigger billing flow immediately after mount
    // This prevents race conditions when component remounts and subscription hook is still initializing
    const timeSinceMount = Date.now() - componentMountTimeRef.current;
    const isInGracePeriod = initialLoadGracePeriodRef.current || timeSinceMount < 300;
    
    if (isInGracePeriod) {
      console.log("🔍 [Redirect Debug] In grace period after mount, waiting...", {
        timeSinceMount,
        inGracePeriod: initialLoadGracePeriodRef.current,
      });
      // Don't trigger billing flow during grace period
      // But allow other logic to run (like hiding plan selection if subscription exists)
    }

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
      setBillingTriggeredState(false);
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
        setBillingTriggeredState(false);
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
    // AND only if grace period has passed (to prevent race conditions on remount)
    // Also ensure we have a valid subscription object (even if null) to avoid undefined issues
    const hasNoSubscription =
      !subscription ||
      subscription.subscription === null ||
      (typeof subscription === "object" && subscription.subscription === null);

    if (
      hasNoSubscription &&
      !subscriptionLoading &&
      !isWaitingForPaymentSuccess &&
      !isInGracePeriod
    ) {
      // Only trigger billing flow once per subscription state (check both ref and sessionStorage)
      const billingAlreadyTriggered = billingTriggeredRef.current || getBillingTriggeredState();
      
      if (!billingAlreadyTriggered) {
        console.log(
          "🚨 [Redirect Debug] Triggering billing flow - subscription is null and loading complete",
          {
            subscription: subscription ? "exists but null" : "does not exist",
            subscriptionLoading,
            isWaitingForPaymentSuccess,
            timeSinceMount,
            inGracePeriod: isInGracePeriod,
          }
        );
        billingTriggeredRef.current = true;
        setBillingTriggeredState(true);
        handleRequireBilling();
      } else {
        console.log(
          "🔍 [Redirect Debug] Billing flow already triggered, skipping",
          {
            refValue: billingTriggeredRef.current,
            storageValue: getBillingTriggeredState(),
          }
        );
      }
      lastSubscriptionRef.current = subscription;
      return;
    }

    // Console log subscription status (with safe property access)
    if (subscription) {
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
    }

    // Reset billing trigger flag since we have a subscription
    billingTriggeredRef.current = false;
    setBillingTriggeredState(false);

    // Update current plan state (with safe property access)
    if (subscription) {
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

        // Hide plan selection and confirmation if showing
        if (showPlanSelection) {
          setShowPlanSelection(false);
        }
        if (showPlanConfirmation) {
          setShowPlanConfirmation(false);
          setSelectedPlanForConfirmation(null);
        }

        billingTriggeredRef.current = false;
        setBillingTriggeredState(false);
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

  // Listen for pricing modal open event from CreditUtilizationBanner
  useEffect(() => {
    const handleOpenPricingModal = () => {
      setShowPlanSelection(true);
    };

    window.addEventListener("openPricingModal", handleOpenPricingModal);

    return () => {
      window.removeEventListener("openPricingModal", handleOpenPricingModal);
    };
  }, []);

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
            setBillingTriggeredState(false);
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

  // Early return if showing plan confirmation - render only confirmation step
  if (showPlanConfirmation && selectedPlanForConfirmation && shop) {
    return (
      <div className="min-h-screen bg-background">
        <PlanConfirmation
          selectedPlan={selectedPlanForConfirmation}
          onConfirm={handleConfirmPlan}
          onBack={handleBackToPlanSelection}
          loading={billingLoading}
          shop={shop}
        />
      </div>
    );
  }

  // Show skeleton loading when subscription is loading
  if (subscriptionLoading && !isWaitingForPaymentSuccess) {
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

        {/* Navigation Bar */}
        <NavigationBar />

        {/* Skeleton Loading State */}
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 lg:py-16 w-full">
          <div className="max-w-7xl mx-auto" id="main-content" tabIndex={-1}>
            {/* Hero Section Skeleton */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-center mb-12">
              {/* Left Section Skeleton */}
              <div className="lg:col-span-8 space-y-8">
                <div className="space-y-6">
                  <Skeleton className="h-12 sm:h-16 md:h-20 lg:h-24 w-64" />
                  <Skeleton className="h-8 sm:h-10 w-full max-w-2xl" />
                  <Skeleton className="h-6 sm:h-8 w-full max-w-xl" />
                </div>
                <div className="flex flex-wrap gap-4 mt-8">
                  <Skeleton className="h-11 w-48" />
                  <Skeleton className="h-11 w-40" />
                </div>
              </div>

              {/* Right Section - Plan Info Skeleton */}
              <div className="lg:col-span-4">
                <Card className="border border-border shadow-sm bg-card max-w-sm mx-auto lg:mx-0">
                  <CardContent className="p-4">
                    <div className="space-y-3">
                      <Skeleton className="h-6 w-32" />
                      <Skeleton className="h-20 w-full" />
                      <Skeleton className="h-9 w-full" />
                      <Skeleton className="h-9 w-full" />
                      <Skeleton className="h-16 w-full" />
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Credits Section Skeleton */}
            <div className="bg-muted/30 border-b border-border py-12 sm:py-16 lg:py-20 mb-12">
              <Card className="border border-border shadow-sm bg-card">
                <CardContent className="p-6 sm:p-8">
                  <Skeleton className="h-6 w-40 mb-4" />
                  <Skeleton className="h-64 w-full" />
                </CardContent>
              </Card>
            </div>

            {/* Installation Guide Skeleton */}
            <div className="py-12 sm:py-16 lg:py-20 bg-background mb-12">
              <div className="space-y-6">
                <Skeleton className="h-10 w-64 mb-4" />
                <Card className="border border-border shadow-sm bg-card">
                  <CardContent className="p-6 sm:p-8 lg:p-10">
                    <div className="space-y-10">
                      {[1, 2, 3, 4].map((step) => (
                        <div key={step} className="flex gap-4 sm:gap-6">
                          <Skeleton className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg flex-shrink-0" />
                          <div className="flex-1 space-y-3">
                            <Skeleton className="h-6 w-48" />
                            <Skeleton className="h-4 w-full" />
                            <Skeleton className="h-4 w-3/4" />
                            <Skeleton className="h-32 w-full" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Features Section Skeleton */}
            <div className="py-12 sm:py-16 lg:py-20 bg-muted/30">
              <div className="text-center mb-12">
                <Skeleton className="h-10 w-64 mx-auto mb-2" />
                <Skeleton className="h-6 w-96 mx-auto" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3, 4, 5, 6].map((item) => (
                  <Card key={item} className="border border-border shadow-sm bg-card">
                    <CardContent className="p-6">
                      <Skeleton className="h-12 w-12 rounded-lg mb-4" />
                      <Skeleton className="h-6 w-32 mb-2" />
                      <Skeleton className="h-4 w-full mb-2" />
                      <Skeleton className="h-4 w-3/4" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

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

      {/* Navigation Bar */}
      <NavigationBar />

      {/* Credit Utilization Banner - Shows at 80%, 90%, 100% utilization */}
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <CreditUtilizationBanner />
      </div>

      {/* Main Content - Always visible */}
      {/* Hero Section - Shopify Style */}
          <header className="relative bg-card border-b border-border min-h-[calc(100vh-56px)] flex items-center" role="banner">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 lg:py-16 w-full">
          <div className="max-w-7xl mx-auto" id="main-content" tabIndex={-1}>
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
                  <Card className="border border-border shadow-sm bg-card max-w-sm mx-auto lg:mx-0 h-full flex flex-col">
                    <CardContent className="p-4 flex flex-col flex-1">
                      <div className="space-y-3 flex flex-col flex-1">
                        {/* Plan Badges - Always visible */}
                        <div className="space-y-2 flex-shrink-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {subscription.isFree ? (
                              <Badge
                                variant="outline"
                                className="gap-1.5 text-xs px-2.5 py-1 font-medium"
                                aria-label={subscription.plan?.name || t("index.planCard.freePlan")}
                              >
                                <Zap className="w-3 h-3" aria-hidden="true" />
                                <span>{subscription.plan?.name || t("index.planCard.freePlan")}</span>
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
                            {subscription.hasActiveSubscription && (
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
                          {/* Plan Price & Interval - Show when plan exists - Fixed height container */}
                          <div className="min-h-[48px] flex items-start">
                            <div className="pt-1 w-full">
                              <div className={`flex items-baseline gap-2 flex-wrap ${subscription.plan && !subscription.isFree ? 'justify-between' : 'justify-start'}`}>
                                {/* Price section - only show for paid plans */}
                                {subscription.plan && !subscription.isFree ? (
                                  <div className="flex items-baseline gap-2">
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
                                ) : null}
                                {/* Credits button - show for all plans (including free) */}
                                {credits && !creditsLoading && (() => {
                                  const creditBalance = credits.total_balance ?? credits.balance ?? 0;
                                  const totalCredited = credits.total_credited ?? credits.included ?? 0;
                                  const isOverage = credits.isOverage;
                                  
                                  // Calculate percentage of credits remaining
                                  // If totalCredited is 0, default to success color (no credits used yet)
                                  const creditPercentage = totalCredited > 0 
                                    ? (creditBalance / totalCredited) * 100 
                                    : 100;
                                  
                                  // Determine color scheme based on percentage thresholds
                                  let colorClasses = "";
                                  let focusRingColor = "";
                                  
                                  if (isOverage) {
                                    // Overage mode - use warning color from design system
                                    colorClasses = "bg-warning/10 hover:bg-warning/20 text-warning border-warning/20 hover:border-warning/30";
                                    focusRingColor = "focus-visible:ring-warning";
                                  } else if (creditPercentage < 10) {
                                    // Less than 10% - error color from design system (red)
                                    colorClasses = "bg-error/10 hover:bg-error/20 text-error border-error/20 hover:border-error/30";
                                    focusRingColor = "focus-visible:ring-error";
                                  } else if (creditPercentage < 20) {
                                    // Less than 20% - warning color from design system (amber)
                                    colorClasses = "bg-warning/10 hover:bg-warning/20 text-warning border-warning/20 hover:border-warning/30";
                                    focusRingColor = "focus-visible:ring-warning";
                                  } else {
                                    // 20% or more - success color from design system (green)
                                    colorClasses = "bg-success/10 hover:bg-success/20 text-success border-success/20 hover:border-success/30";
                                    focusRingColor = "focus-visible:ring-success";
                                  }
                                  
                                  return (
                                    <button
                                      onClick={() => {
                                        const creditsSection = document.getElementById("credits-heading");
                                        if (creditsSection) {
                                          creditsSection.scrollIntoView({ behavior: "smooth", block: "start" });
                                        }
                                      }}
                                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 ${focusRingColor} focus-visible:ring-offset-2 focus-visible:ring-offset-background hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${colorClasses}`}
                                      aria-label={t("index.planCard.viewCredits") || "View credits"}
                                    >
                                      <Coins className="w-3 h-3" aria-hidden="true" />
                                      <span>
                                        {isOverage 
                                          ? t("index.planCard.overageActive") || "Overage active"
                                          : creditBalance !== null && creditBalance !== undefined
                                          ? t("index.planCard.creditsAvailable", { count: creditBalance }) || `${creditBalance} credits available`
                                          : t("index.planCard.viewCredits") || "View credits"}
                                      </span>
                                      <ChevronRight className="w-3 h-3 opacity-60" aria-hidden="true" />
                                    </button>
                                  );
                                })()}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Action Buttons - Consistent spacing - Fixed height */}
                        <div className="space-y-1.5 flex-shrink-0 min-h-[72px]" role="group" aria-label={t("index.planCard.planActions") || "Plan actions"}>
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
                          {/* Cancel Button - Show for all plans (user has right to cancel anytime) */}
                          {subscription && 
                           subscription.subscription !== null && 
                           subscription.subscription?.id ? (
                              <>
                                <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
                                  <AlertDialogContent className="bg-card border-border shadow-lg max-w-md">
                                    <AlertDialogHeader className="space-y-4">
                                      {/* Warning Icon Section */}
                                      <div className="flex items-center gap-3">
                                        <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-destructive/10 border border-destructive/20 flex-shrink-0">
                                          <AlertTriangle className="w-5 h-5 text-destructive" aria-hidden="true" />
                                        </div>
                                        <AlertDialogTitle className="text-lg font-semibold text-foreground leading-tight">
                                          {t("index.planCard.confirmCancelTitle") || "Cancel Subscription"}
                                        </AlertDialogTitle>
                                      </div>
                                      <AlertDialogDescription className="text-sm text-muted-foreground leading-relaxed pt-2">
                                        {t("index.errors.confirmCancel") || "Are you sure you want to cancel your subscription? Your subscription will remain active until the end of the current billing period."}
                                      </AlertDialogDescription>
                                      {/* Warning Info Box */}
                                      <div className="p-3 bg-warning/10 border border-warning/20 rounded-lg mt-2">
                                        <p className="text-xs sm:text-sm text-foreground flex items-start gap-2 leading-relaxed">
                                          <Shield
                                            className="w-4 h-4 text-warning flex-shrink-0 mt-0.5"
                                            aria-hidden="true"
                                          />
                                          <span>
                                            <strong className="font-semibold text-foreground">
                                              {t("index.planCard.important") || "Important:"}{" "}
                                            </strong>
                                            {t("index.planCard.cancelWarning") || "You'll continue to have access to all features until your current billing period ends."}
                                          </span>
                                        </p>
                                      </div>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter className="flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 gap-2 mt-6">
                                      <AlertDialogCancel 
                                        className="w-full sm:w-auto h-9 min-h-[36px] font-medium text-xs focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 mt-0"
                                      >
                                        {t("index.planCard.keepSubscription") || t("common.cancel") || "Keep Subscription"}
                                      </AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={handleCancelSubscription}
                                        disabled={cancelling}
                                        className="w-full sm:w-auto h-9 min-h-[36px] font-medium text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90 border-destructive/20 focus-visible:ring-2 focus-visible:ring-destructive focus-visible:ring-offset-2"
                                      >
                                        {cancelling ? (
                                          <>
                                            <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-destructive-foreground mr-1.5" aria-hidden="true" />
                                            {t("index.planCard.cancelling") || "Cancelling..."}
                                          </>
                                        ) : (
                                          <>
                                            <X className="w-3.5 h-3.5 mr-1.5" aria-hidden="true" />
                                            {t("index.planCard.confirmCancel") || "Yes, Cancel Subscription"}
                                          </>
                                        )}
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="w-full h-9 min-h-[36px] font-medium text-xs text-destructive border-destructive/20 hover:bg-destructive/10 hover:text-destructive focus-visible:ring-2 focus-visible:ring-destructive focus-visible:ring-offset-2"
                                  onClick={() => setShowCancelDialog(true)}
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
                              </>
                            ) : null}
                        </div>

                        {/* Subscription Period Info - Show when available - Fixed height container */}
                        <div className="flex-shrink-0 min-h-[60px] flex items-start">
                          {subscription.subscription && !subscription.isFree ? (
                            <div className="pt-1.5 border-t border-border w-full">
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
                          ) : null}
                        </div>

                        {/* Referral Code Section - Available for all users (free and paid plans) */}
                        {subscription && (
                          <div className="pt-2 border-t border-border flex-shrink-0">
                            <label className="flex items-center gap-1.5 text-[10px] font-medium text-foreground mb-1.5">
                              <Users className="w-3 h-3" aria-hidden="true" />
                              {t("referral.code.label")}
                            </label>
                            {loadingReferralCode ? (
                              <div className="flex items-center gap-2 py-2">
                                <div className="h-8 flex-1 bg-muted/50 rounded border border-border animate-pulse" />
                              </div>
                            ) : referralCode ? (
                              <div className="space-y-1.5">
                                <div className="flex items-center gap-1.5">
                                  <div className="flex-1 px-3 py-2 bg-muted/50 border border-border rounded text-sm font-mono font-bold text-foreground">
                                    {referralCode}
                                  </div>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={handleCopyReferralCode}
                                    disabled={copyingReferralCode}
                                    className="h-8 px-3 font-medium text-xs whitespace-nowrap"
                                    aria-label={copyingReferralCode ? t("referral.code.copying") : t("referral.code.copyAriaLabel")}
                                  >
                                    {copyingReferralCode ? (
                                      <div className="w-3 h-3 mr-1 border-2 border-border border-t-primary rounded-full animate-spin" />
                                    ) : (
                                      <Copy className="w-3 h-3 mr-1" />
                                    )}
                                    {t("referral.code.copy")}
                                  </Button>
                                </div>
                                <p className="text-[10px] text-muted-foreground">
                                  {t("referral.code.shareHint")}
                                </p>
                              </div>
                            ) : (
                              <div className="py-2">
                                <p className="text-[10px] text-muted-foreground">
                                  {t("referral.code.willAppear")}
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="border border-border shadow-sm bg-card max-w-sm mx-auto lg:mx-0 h-full flex flex-col">
                    <CardContent className="p-4 flex flex-col flex-1">
                      <div className="space-y-3 flex flex-col flex-1">
                        <h2 id="plan-card-heading" className="text-xs sm:text-sm font-semibold text-foreground flex-shrink-0">
                          {t("index.planCard.title")}
                        </h2>
                        <div className="flex flex-col items-center gap-3 text-center flex-shrink-0 min-h-[180px]">
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
                    {/* Credits Table - Clean tabular UI - Always show for UI consistency */}
                    {creditsLoading ? (
                      <CreditsBalanceSkeleton />
                    ) : creditsError ? (
                      <div
                        className="p-8 rounded-lg bg-destructive/5 border border-destructive/20 flex items-center justify-center min-h-[200px]"
                        role="alert"
                        aria-label={t("credits.balanceCard.error") || "Credits error"}
                      >
                        <div className="text-center space-y-2">
                          <Coins
                            className="w-8 h-8 text-destructive mx-auto opacity-80"
                            aria-hidden="true"
                          />
                          <p className="text-sm text-foreground">
                            {t("credits.balanceCard.errorMessage") ||
                              "We couldn't load your credits. Please try again."}
                          </p>
                        </div>
                      </div>
                    ) : credits ? (
                      <CreditBalance variant="embedded" />
                    ) : (
                      <CreditsBalanceSkeleton />
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
                        {t("index.installationGuide.appEmbedNote") || "App Embed Blocks: "}
                      </strong>
                      {t("index.installationGuide.appEmbedDescription") || "These are app embed blocks that you add to your theme layout. They automatically appear on all relevant pages (product pages for the button, home page for the banner) without needing to add them to individual templates."}
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
                                  {t("index.installationGuide.step1Title") || "Access Theme Editor"}
                                </h4>
                                <p className="text-sm sm:text-base text-muted-foreground mb-4 leading-relaxed">
                                  {t("index.installationGuide.step1Description") || "Go to your Shopify admin and navigate to Online Store > Themes. Click 'Customize' on your current theme to open the theme editor."}
                                </p>
                                <div className="p-3 bg-info/10 border border-info/20 rounded-lg">
                                  <p className="text-xs sm:text-sm text-foreground leading-relaxed">
                                    <strong className="font-semibold text-foreground">
                                      {t("index.installationGuide.step1Note") || "Note: "}
                                    </strong>
                                    {t("index.installationGuide.step1NoteText") || "App embed blocks are added to your theme layout, which means they work across all pages automatically. You don't need to add them to individual templates."}
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
                                  {t("index.installationGuide.step2Title") || "Add Try-On Button App Embed"}
                                </h4>
                                <p className="text-sm sm:text-base text-muted-foreground mb-4 leading-relaxed">
                                  {t("index.installationGuide.step2Description") || "Add the Try-On button app embed to your theme layout. The button will automatically appear on all product pages above the Add to Cart button."}
                                </p>
                                <div className="space-y-3">
                                  <div className="p-4 bg-muted/50 rounded-lg border border-border">
                                    <p className="text-sm font-semibold text-foreground mb-3">
                                      {t("index.installationGuide.step2Instructions") || "How to add the button:"}
                                    </p>
                                    <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                                      <li>{t("index.installationGuide.step2Instruction1") || "Click the 'Add Button' button below - it will automatically open your theme editor and activate the button app embed"}</li>
                                      <li>{t("index.installationGuide.step2Instruction2") || "The app embed block will be automatically activated and ready to use"}</li>
                                      <li>{t("index.installationGuide.step2Instruction3") || "The button will automatically appear on all product pages above the Add to Cart button"}</li>
                                      <li>{t("index.installationGuide.step2Instruction4") || "Customize the button style, text, and settings in the theme editor if needed"}</li>
                                      <li>{t("index.installationGuide.step2Instruction5") || "Click 'Save' in the theme editor to publish your changes"}</li>
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
                                          {t("index.installationGuide.step2Tip") || "Tip: "}
                                        </strong>
                                        {t("index.installationGuide.step2TipText") || "App embed blocks are added to your theme layout, so they work across all pages automatically. The button will only show on product pages."}
                                      </span>
                                    </p>
                                  </div>
                                  {subscription && subscription.subscription !== null ? (
                                    <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
                                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                                        <div className="flex-1">
                                          <p className="text-sm font-semibold text-foreground mb-1">
                                            {t("index.installationGuide.step2QuickAccess") || "Quick Installation"}
                                          </p>
                                          <p className="text-xs sm:text-sm text-muted-foreground">
                                            {t("index.installationGuide.step2QuickAccessText") || "One-click installation: Click below to automatically activate the button app embed in your theme"}
                                          </p>
                                        </div>
                                        <Button
                                          onClick={() => handleAddAppEmbed("button")}
                                          className="w-full sm:w-auto whitespace-nowrap mt-2 sm:mt-0 min-h-[44px] focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                                          size="sm"
                                          aria-label={t("index.installationGuide.step2AddNow") || "Add Button"}
                                        >
                                          <Link2 className="w-4 h-4 mr-2" aria-hidden="true" />
                                          {t("index.installationGuide.step2AddNow") || "Add Button"}
                                        </Button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="p-4 bg-warning/10 border border-warning/20 rounded-lg">
                                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                                        <div className="flex-1">
                                          <p className="text-sm font-semibold text-foreground mb-1">
                                            {t("index.installationGuide.step2Restricted") || "Subscription Required"}
                                          </p>
                                          <p className="text-xs sm:text-sm text-muted-foreground">
                                            {t("index.installationGuide.step2RestrictedText") || "Please select a plan to access installation features"}
                                          </p>
                                        </div>
                                        <Button
                                          onClick={() => handleRequireBilling()}
                                          variant="outline"
                                          className="w-full sm:w-auto whitespace-nowrap mt-2 sm:mt-0 min-h-[44px] focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                                          size="sm"
                                          aria-label={t("index.installationGuide.step2ViewPricing") || "View Pricing"}
                                        >
                                          {t("index.installationGuide.step2ViewPricing") || "View Pricing"}
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
                                  {t("index.installationGuide.step3Title") || "Add Home Page Banner App Embed"}
                                </h4>
                                <p className="text-sm sm:text-base text-muted-foreground mb-4 leading-relaxed">
                                  {t("index.installationGuide.step3Description") || "Add the promotional banner app embed to your theme layout. The banner will automatically appear on your home page to promote the virtual try-on feature."}
                                </p>
                                <div className="space-y-3">
                                  <div className="p-4 bg-muted/50 rounded-lg border border-border">
                                    <p className="text-sm font-semibold text-foreground mb-3">
                                      {t("index.installationGuide.step3Instructions") || "How to add the banner:"}
                                    </p>
                                    <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                                      <li>{t("index.installationGuide.step3Instruction1") || "Click the 'Add Banner' button below - it will automatically open your theme editor and activate the banner app embed"}</li>
                                      <li>{t("index.installationGuide.step3Instruction2") || "The app embed block will be automatically activated and ready to use"}</li>
                                      <li>{t("index.installationGuide.step3Instruction3") || "The banner will automatically appear on your home page"}</li>
                                      <li>{t("index.installationGuide.step3Instruction4") || "You can enable/disable the banner anytime in the app embed settings"}</li>
                                      <li>{t("index.installationGuide.step3Instruction5") || "Click 'Save' in the theme editor to publish your changes"}</li>
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
                                          {t("index.installationGuide.step3Tip") || "Tip: "}
                                        </strong>
                                        {t("index.installationGuide.step3TipText") || "The banner only appears on your home page. Visitors can dismiss it, and it will remember their preference for the session."}
                                      </span>
                                    </p>
                                  </div>
                                  {subscription && subscription.subscription !== null ? (
                                    <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
                                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                                        <div className="flex-1">
                                          <p className="text-sm font-semibold text-foreground mb-1">
                                            {t("index.installationGuide.step3QuickAccess") || "Quick Installation"}
                                          </p>
                                          <p className="text-xs sm:text-sm text-muted-foreground">
                                            {t("index.installationGuide.step3QuickAccessText") || "One-click installation: Click below to automatically activate the banner app embed in your theme"}
                                          </p>
                                        </div>
                                        <Button
                                          onClick={() => handleAddAppEmbed("banner")}
                                          className="w-full sm:w-auto whitespace-nowrap mt-2 sm:mt-0 min-h-[44px] focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                                          size="sm"
                                          aria-label={t("index.installationGuide.step3AddNow") || "Add Banner"}
                                        >
                                          <Link2 className="w-4 h-4 mr-2" aria-hidden="true" />
                                          {t("index.installationGuide.step3AddNow") || "Add Banner"}
                                        </Button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="p-4 bg-warning/10 border border-warning/20 rounded-lg">
                                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                                        <div className="flex-1">
                                          <p className="text-sm font-semibold text-foreground mb-1">
                                            {t("index.installationGuide.step3Restricted") || "Subscription Required"}
                                          </p>
                                          <p className="text-xs sm:text-sm text-muted-foreground">
                                            {t("index.installationGuide.step3RestrictedText") || "Please select a plan to access installation features"}
                                          </p>
                                        </div>
                                        <Button
                                          onClick={() => handleRequireBilling()}
                                          variant="outline"
                                          className="w-full sm:w-auto whitespace-nowrap mt-2 sm:mt-0 min-h-[44px] focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                                          size="sm"
                                          aria-label={t("index.installationGuide.step3ViewPricing") || "View Pricing"}
                                        >
                                          {t("index.installationGuide.step3ViewPricing") || "View Pricing"}
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
                                  {t("index.installationGuide.step4Title") || "You're All Set!"}
                                </h4>
                                <p className="text-sm sm:text-base text-muted-foreground mb-4 leading-relaxed">
                                  {t("index.installationGuide.step4Description") || "Once you've added both app embed blocks, your virtual try-on feature is ready to use. The button will appear on all product pages, and the banner will show on your home page."}
                                </p>
                                <div className="p-4 bg-success/10 border border-success/20 rounded-lg">
                                  <p className="text-xs sm:text-sm text-foreground flex items-start gap-2 leading-relaxed">
                                    <CheckCircle2
                                      className="w-4 h-4 text-success flex-shrink-0 mt-0.5"
                                      aria-hidden="true"
                                    />
                                    <span>
                                      <strong className="font-semibold text-foreground">
                                        {t("index.installationGuide.step4Congratulations") || "Congratulations! "}
                                      </strong>
                                      {t("index.installationGuide.step4CongratulationsText") || "Your virtual try-on feature is now live. Customers can try on products directly from your product pages!"}
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

      {/* Plan Selection UI - Modal Overlay */}
      {showPlanSelection && (
        <div 
          className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={(e) => {
            // Prevent closing on backdrop click - only allow closing via back button
            e.stopPropagation();
          }}
          onKeyDown={(e) => {
            // Prevent keyboard interaction with parent page
            if (e.key === 'Escape') {
              e.stopPropagation();
            }
          }}
        >
          <div 
            className="bg-card border border-border rounded-lg shadow-lg w-full max-w-[95vw] max-h-[95vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="plan-selection-title"
          >
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


      {/* Loading Indicator - Non-blocking, shows in top-right corner */}
      {shouldShowLoading && (
        <div
          className="fixed top-20 right-4 z-40 bg-card border border-border rounded-lg p-4 shadow-lg"
          role="status"
          aria-live="polite"
          aria-label={t("index.loading.loading") || "Loading"}
        >
          <div className="flex items-center gap-3">
            <div
              className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"
              aria-hidden="true"
            />
            {shouldShowPaymentLoading ? (
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">
                  {t("index.loading.processingPayment")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {Math.round(paymentSuccessElapsedTime / 1000)}s / {maxWaitTime / 1000}s
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <span className="sr-only">
                  {t("index.loading.loading") || "Loading"}
                </span>
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-16" />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Index;
