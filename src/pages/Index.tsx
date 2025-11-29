import { useState, useEffect, useRef } from "react";
import { useShop } from "@/providers/AppBridgeProvider";
import { useSubscription } from "@/hooks/useSubscription";
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

const Index = () => {
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
        throw new Error("Impossible de récupérer les plans disponibles");
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
    const confirmed = window.confirm(
      "Êtes-vous sûr de vouloir annuler votre abonnement ? Votre accès continuera jusqu'à la fin de la période de facturation actuelle."
    );

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
        throw new Error(
          errorData.message || "Échec de l'annulation de l'abonnement"
        );
      }

      const data = await response.json();

      // Refresh subscription status
      await refreshSubscription();

      console.log("[Billing] Subscription cancelled successfully", data);
    } catch (error: any) {
      console.error("[Billing] Failed to cancel subscription", error);
      alert(
        error.message ||
          "Une erreur s'est produite lors de l'annulation. Veuillez réessayer."
      );
    } finally {
      setCancelling(false);
    }
  };

  const handleSelectPlan = async (
    planHandle: string,
    promoCode?: string | null
  ) => {
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
        promoCode: promoCode || null,
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
          promoCode: promoCode || null,
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
        throw new Error(
          "URL de confirmation manquante. Veuillez réessayer plus tard."
        );
      }

      console.log("[Billing] Redirecting to confirmation URL", {
        confirmationUrl: data.confirmationUrl,
      });

      // Use App Bridge Redirect action for safe navigation from embedded app
      // This properly handles cross-origin navigation without security errors
      if (!appBridge) {
        throw new Error("App Bridge not available");
      }

      const { Redirect } = await import("@shopify/app-bridge/actions");
      const redirect = Redirect.create(appBridge);
      // Use REMOTE action to navigate to external URL (Shopify admin billing page)
      // This breaks out of the iframe safely
      redirect.dispatch(Redirect.Action.REMOTE, {
        url: data.confirmationUrl as string,
        newContext: true, // Open in new context/window to break out of iframe
      });
      console.log("[Billing] App Bridge Redirect dispatched successfully");
    } catch (error: any) {
      console.error("[Billing] Failed to create subscription", error);
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

  // Track if billing flow has been triggered to prevent infinite loops
  const billingTriggeredRef = useRef(false);
  const lastSubscriptionRef = useRef<typeof subscription>(null);

  // Check subscription and redirect to pricing page if subscription is null
  useEffect(() => {
    console.log("🔍 [Redirect Debug] useEffect triggered");
    console.log(
      "🔍 [Redirect Debug] subscriptionLoading:",
      subscriptionLoading
    );
    console.log("🔍 [Redirect Debug] subscription:", subscription);

    // Wait for subscription to load
    if (subscriptionLoading) {
      console.log(
        "🔍 [Redirect Debug] Still loading subscription, skipping..."
      );
      return;
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

    // Reset billing trigger flag if subscription changed from null to non-null
    if (
      subscriptionChanged &&
      subscription &&
      subscription.subscription !== null
    ) {
      billingTriggeredRef.current = false;
    }

    // Redirect to billing flow if no subscription is configured
    if (!subscription || subscription.subscription === null) {
      // Only trigger billing flow once per subscription state
      if (!billingTriggeredRef.current) {
        console.log(
          "🚨 [Redirect Debug] Triggering billing flow - subscription is null"
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
  }, [subscription, subscriptionLoading, shop]); // Removed showPlanSelection from dependencies

  // Show loading state while checking subscription
  if (subscriptionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
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
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Main Content */}
      {/* Enhanced Hero Section */}
      <header className="relative overflow-hidden bg-card border-b border-border">
        <div className="container mx-auto px-4 sm:px-6 md:px-8 py-12 sm:py-16 md:py-20 relative">
          <div className="max-w-6xl mx-auto">
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
                      Essayage virtuel pour&nbsp;Shopify
                    </p>
                    <p className="text-base sm:text-lg text-muted-foreground mt-3 max-w-2xl">
                      Transformez l'expérience d'achat de vos clients avec notre
                      technologie d'essayage virtuel alimentée par l'IA
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
                      Commencer l'installation
                    </Button>
                    <Button
                      size="lg"
                      onClick={() => {
                        handleRequireBilling();
                      }}
                      className="px-6"
                    >
                      Voir les tarifs
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
                          Votre plan
                        </CardTitle>
                        {subscription.hasActiveSubscription && (
                          <Badge
                            variant="default"
                            className="gap-1.5 bg-success/20 text-success border-success/30"
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            Actif
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
                            Plan Gratuit
                          </Badge>
                        ) : (
                          <Badge
                            variant="default"
                            className="gap-1.5 bg-primary text-primary-foreground text-sm px-3 py-1"
                          >
                            <Crown className="w-3.5 h-3.5" />
                            {subscription.plan?.name || "Plan Premium"}
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Plan Pricing */}
                      {subscription.plan && !subscription.isFree && (
                        <div className="flex items-baseline gap-2">
                          <span className="text-3xl font-bold text-foreground">
                            ${subscription.plan.price}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            /
                            {subscription.plan.interval === "ANNUAL"
                              ? "an"
                              : "mois"}
                          </span>
                          <span className="text-xs text-muted-foreground ml-auto">
                            {subscription.plan.currencyCode}
                          </span>
                        </div>
                      )}

                      {/* Subscription Status */}
                      {subscription.subscription && (
                        <div className="space-y-2 pt-2 border-t border-border">
                          <div className="flex items-center gap-2 text-sm">
                            <Calendar className="w-4 h-4 text-muted-foreground" />
                            <span className="text-muted-foreground">
                              Renouvellement:
                            </span>
                            <span className="font-medium text-foreground">
                              {new Date(
                                subscription.subscription.currentPeriodEnd
                              ).toLocaleDateString("fr-FR", {
                                day: "numeric",
                                month: "long",
                                year: "numeric",
                              })}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <CheckCircle2 className="w-4 h-4 text-success" />
                            <span className="text-muted-foreground">
                              Statut:
                            </span>
                            <span className="font-medium text-foreground capitalize">
                              {subscription.subscription.status.toLowerCase()}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Plan Benefits */}
                      <div className="pt-3 border-t border-border">
                        <p className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                          <Sparkle className="w-4 h-4 text-primary" />
                          Avantages inclus
                        </p>
                        <ul className="space-y-2">
                          <li className="flex items-start gap-2 text-sm">
                            <Check className="w-4 h-4 text-success flex-shrink-0 mt-0.5" />
                            <span className="text-muted-foreground">
                              Essayage virtuel illimité
                            </span>
                          </li>
                          <li className="flex items-start gap-2 text-sm">
                            <Check className="w-4 h-4 text-success flex-shrink-0 mt-0.5" />
                            <span className="text-muted-foreground">
                              Support technique prioritaire
                            </span>
                          </li>
                          <li className="flex items-start gap-2 text-sm">
                            <Check className="w-4 h-4 text-success flex-shrink-0 mt-0.5" />
                            <span className="text-muted-foreground">
                              Intégration Shopify complète
                            </span>
                          </li>
                          {!subscription.isFree && (
                            <>
                              <li className="flex items-start gap-2 text-sm">
                                <Check className="w-4 h-4 text-success flex-shrink-0 mt-0.5" />
                                <span className="text-muted-foreground">
                                  Personnalisation avancée
                                </span>
                              </li>
                              <li className="flex items-start gap-2 text-sm">
                                <Check className="w-4 h-4 text-success flex-shrink-0 mt-0.5" />
                                <span className="text-muted-foreground">
                                  Analytics et rapports détaillés
                                </span>
                              </li>
                            </>
                          )}
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
                            ? "Passer à un plan premium"
                            : "Gérer mon abonnement"}
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
                                ? "Annulation..."
                                : "Annuler l'abonnement"}
                            </Button>
                          )}
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="border-2 border-dashed border-border bg-muted/30">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg font-bold text-foreground">
                        Votre plan
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="text-center py-6">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
                          <CreditCard className="w-8 h-8 text-muted-foreground" />
                        </div>
                        <p className="text-sm text-muted-foreground mb-4">
                          Aucun plan sélectionné
                        </p>
                        <Button
                          size="sm"
                          className="w-full"
                          onClick={() => {
                            handleRequireBilling();
                          }}
                        >
                          <Sparkle className="w-4 h-4 mr-2" />
                          Choisir un plan
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
                    Guide d'installation étape&nbsp;par&nbsp;étape
                  </CardTitle>
                  <CardDescription className="text-base sm:text-lg md:text-xl mt-4 sm:mt-5 text-foreground/80 no-orphans">
                    Installation rapide en&nbsp;quelques&nbsp;minutes
                  </CardDescription>
                  <div className="mt-6 sm:mt-8 bg-info/15 border-2 border-info/30 rounded-lg p-4 sm:p-5">
                    <p className="text-sm sm:text-base text-foreground leading-relaxed no-orphans">
                      <strong className="font-bold text-foreground">
                        📦 Bloc&nbsp;d'application&nbsp;unique&nbsp;:
                      </strong>{" "}
                      NusenseTryOn utilise désormais uniquement un bloc
                      d'application compatible avec les thèmes{" "}
                      <strong className="font-bold text-foreground">
                        Online&nbsp;Store&nbsp;2.0
                      </strong>
                      . Les thèmes vintage doivent être mis à jour vers un thème
                      OS&nbsp;2.0 pour profiter de l'expérience complète.
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
                              Installez&nbsp;NusenseTryOn
                            </h3>
                            <p className="text-base sm:text-lg text-foreground/90 mb-4 sm:mb-5 leading-relaxed no-orphans">
                              Dans votre admin Shopify, accédez à{" "}
                              <strong className="font-bold text-foreground">
                                Apps
                              </strong>{" "}
                              dans le menu latéral, puis cliquez sur{" "}
                              <strong className="font-bold text-foreground">
                                Boutique&nbsp;d'applications
                              </strong>
                              . Recherchez{" "}
                              <strong className="font-bold text-foreground">
                                "NusenseTryOn"
                              </strong>{" "}
                              et cliquez sur{" "}
                              <strong className="font-bold text-foreground">
                                "Ajouter&nbsp;l'application"
                              </strong>
                              .
                            </p>
                            <div className="bg-info/20 border-2 border-info/40 rounded-lg p-4 sm:p-5">
                              <p className="text-sm sm:text-base text-foreground leading-relaxed no-orphans">
                                <strong className="font-bold text-foreground">
                                  ℹ️ Note&nbsp;:
                                </strong>{" "}
                                Autorisez les permissions demandées (lecture et
                                modification des produits et thèmes) pour que
                                l'application puisse fonctionner correctement.
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
                              Ajoutez le bloc&nbsp;d'application
                              (Thèmes&nbsp;Online&nbsp;Store&nbsp;2.0)
                            </h3>
                            <p className="text-base sm:text-lg text-foreground/90 mb-4 sm:mb-5 leading-relaxed no-orphans">
                              Le bloc d'application se place directement dans
                              vos sections de page produit. Il est compatible
                              avec tous les thèmes{" "}
                              <strong className="font-bold text-foreground">
                                Online&nbsp;Store&nbsp;2.0
                              </strong>
                              .
                            </p>
                            <div className="space-y-4 mb-4 sm:mb-5">
                              <div className="bg-muted rounded-lg p-4 sm:p-5 border-2 border-border">
                                <p className="text-sm sm:text-base font-semibold text-foreground mb-3 no-orphans">
                                  Instructions&nbsp;produit&nbsp;:
                                </p>
                                <ol className="list-decimal list-inside space-y-2 text-sm sm:text-base text-foreground/90">
                                  <li className="no-orphans">
                                    Dans l'éditeur de thème, ouvrez une{" "}
                                    <strong className="font-bold text-foreground">
                                      page&nbsp;produit
                                    </strong>
                                  </li>
                                  <li className="no-orphans">
                                    Cliquez sur{" "}
                                    <strong className="font-bold text-foreground">
                                      Ajouter&nbsp;un&nbsp;bloc
                                    </strong>{" "}
                                    dans la section souhaitée
                                  </li>
                                  <li className="no-orphans">
                                    Dans la catégorie{" "}
                                    <strong className="font-bold text-foreground">
                                      Applications
                                    </strong>
                                    , sélectionnez{" "}
                                    <strong className="font-bold text-foreground">
                                      "NUSENSE&nbsp;Try-On&nbsp;Button"
                                    </strong>
                                  </li>
                                  <li className="no-orphans">
                                    Personnalisez le texte du bouton, le style
                                    et les autres paramètres
                                  </li>
                                  <li className="no-orphans">
                                    Réorganisez le bloc en le faisant glisser si
                                    nécessaire puis cliquez sur{" "}
                                    <strong className="font-bold text-foreground">
                                      Enregistrer
                                    </strong>
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
                                      Important&nbsp;:
                                    </strong>{" "}
                                    Les blocs d'application sont disponibles
                                    uniquement sur les thèmes Online Store 2.0
                                    (modèles JSON). Mettez à jour votre thème si
                                    nécessaire.
                                  </span>
                                </p>
                              </div>
                              {subscription &&
                              subscription.subscription !== null ? (
                                <div className="bg-primary/10 border-2 border-primary/30 rounded-lg p-4 sm:p-5">
                                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                    <div className="flex-1">
                                      <p className="text-sm sm:text-base font-semibold text-foreground mb-2 no-orphans">
                                        🚀 Accès&nbsp;rapide&nbsp;:
                                      </p>
                                      <p className="text-sm sm:text-base text-foreground/90 no-orphans">
                                        Cliquez sur le bouton ci-dessous pour
                                        ouvrir l'éditeur de thème directement
                                        sur une page produit.
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
                                      Ajouter&nbsp;maintenant
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <div className="bg-warning/20 border-2 border-warning/40 rounded-lg p-4 sm:p-5">
                                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                    <div className="flex-1">
                                      <p className="text-sm sm:text-base font-semibold text-foreground mb-2 no-orphans">
                                        🔒 Accès&nbsp;restreint&nbsp;:
                                      </p>
                                      <p className="text-sm sm:text-base text-foreground/90 no-orphans">
                                        Veuillez sélectionner un plan tarifaire
                                        pour accéder à cette fonctionnalité.
                                      </p>
                                    </div>
                                    <Button
                                      onClick={() => {
                                        handleRequireBilling();
                                      }}
                                      className="w-full sm:w-auto whitespace-nowrap border border-input bg-background hover:bg-accent hover:text-accent-foreground"
                                      size="sm"
                                    >
                                      Voir&nbsp;les&nbsp;tarifs
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
                              Ajoutez la bannière&nbsp;d'application
                              (Page&nbsp;d'accueil)
                            </h3>
                            <p className="text-base sm:text-lg text-foreground/90 mb-4 sm:mb-5 leading-relaxed no-orphans">
                              La bannière d'application s'affiche
                              automatiquement sur votre page d'accueil pour
                              promouvoir la fonctionnalité d'essayage virtuel.
                              Elle est compatible avec tous les thèmes{" "}
                              <strong className="font-bold text-foreground">
                                Online&nbsp;Store&nbsp;2.0
                              </strong>
                              .
                            </p>
                            <div className="space-y-4 mb-4 sm:mb-5">
                              <div className="bg-muted rounded-lg p-4 sm:p-5 border-2 border-border">
                                <p className="text-sm sm:text-base font-semibold text-foreground mb-3 no-orphans">
                                  Instructions&nbsp;bannière&nbsp;:
                                </p>
                                <ol className="list-decimal list-inside space-y-2 text-sm sm:text-base text-foreground/90">
                                  <li className="no-orphans">
                                    Dans l'éditeur de thème, ouvrez la{" "}
                                    <strong className="font-bold text-foreground">
                                      page&nbsp;d'accueil
                                    </strong>{" "}
                                    (template index)
                                  </li>
                                  <li className="no-orphans">
                                    Cliquez sur{" "}
                                    <strong className="font-bold text-foreground">
                                      Paramètres&nbsp;du&nbsp;thème
                                    </strong>{" "}
                                    (icône d'engrenage) en bas à gauche
                                  </li>
                                  <li className="no-orphans">
                                    Dans la section{" "}
                                    <strong className="font-bold text-foreground">
                                      Intégrations&nbsp;d'applications
                                    </strong>
                                    , recherchez{" "}
                                    <strong className="font-bold text-foreground">
                                      "NUSENSE&nbsp;Try-On&nbsp;Banner"
                                    </strong>
                                  </li>
                                  <li className="no-orphans">
                                    Activez la bannière en cochant la case
                                    correspondante
                                  </li>
                                  <li className="no-orphans">
                                    La bannière apparaîtra automatiquement sur
                                    votre page d'accueil. Cliquez sur{" "}
                                    <strong className="font-bold text-foreground">
                                      Enregistrer
                                    </strong>
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
                                      Astuce&nbsp;:
                                    </strong>{" "}
                                    La bannière peut être désactivée à tout
                                    moment via les paramètres du thème sans
                                    supprimer l'intégration. Les visiteurs
                                    peuvent également la fermer, et leur
                                    préférence sera mémorisée pour la session.
                                  </span>
                                </p>
                              </div>
                              {subscription &&
                              subscription.subscription !== null ? (
                                <div className="bg-primary/10 border-2 border-primary/30 rounded-lg p-4 sm:p-5">
                                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                    <div className="flex-1">
                                      <p className="text-sm sm:text-base font-semibold text-foreground mb-2 no-orphans">
                                        🚀 Accès&nbsp;rapide&nbsp;:
                                      </p>
                                      <p className="text-sm sm:text-base text-foreground/90 no-orphans">
                                        Cliquez sur le bouton ci-dessous pour
                                        ouvrir l'éditeur de thème directement
                                        sur la page d'accueil.
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
                                      Ajouter&nbsp;maintenant
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <div className="bg-warning/20 border-2 border-warning/40 rounded-lg p-4 sm:p-5">
                                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                    <div className="flex-1">
                                      <p className="text-sm sm:text-base font-semibold text-foreground mb-2 no-orphans">
                                        🔒 Accès&nbsp;restreint&nbsp;:
                                      </p>
                                      <p className="text-sm sm:text-base text-foreground/90 no-orphans">
                                        Veuillez sélectionner un plan tarifaire
                                        pour accéder à cette fonctionnalité.
                                      </p>
                                    </div>
                                    <Button
                                      onClick={() => {
                                        handleRequireBilling();
                                      }}
                                      className="w-full sm:w-auto whitespace-nowrap border border-input bg-background hover:bg-accent hover:text-accent-foreground"
                                      size="sm"
                                    >
                                      Voir&nbsp;les&nbsp;tarifs
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
                              Testez votre&nbsp;configuration
                            </h3>
                            <p className="text-base sm:text-lg text-foreground/90 mb-4 sm:mb-5 leading-relaxed no-orphans">
                              Visitez votre page d'accueil et une page produit
                              de votre boutique pour vérifier que la bannière et
                              le bouton d'essayage virtuel apparaissent
                              correctement. Cliquez sur les éléments pour tester
                              la fonctionnalité.
                            </p>
                            <div className="bg-success/25 border-2 border-success/50 rounded-lg p-4 sm:p-5">
                              <p className="text-sm sm:text-base text-foreground flex items-start gap-3 leading-relaxed">
                                <CheckCircle2
                                  className="w-5 h-5 sm:w-6 sm:h-6 text-success flex-shrink-0 mt-0.5"
                                  aria-hidden="true"
                                />
                                <span className="no-orphans">
                                  <strong className="font-bold text-foreground">
                                    Félicitations&nbsp;!
                                  </strong>{" "}
                                  NusenseTryOn est maintenant configuré. Vos
                                  clients peuvent utiliser la fonctionnalité
                                  d'essayage virtuel directement sur vos
                                  pages&nbsp;produits et découvrir la
                                  fonctionnalité via la bannière sur votre
                                  page&nbsp;d'accueil.
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
                Pourquoi choisir NusenseTryOn?
              </h2>
              <p className="text-lg text-muted-foreground">
                Des fonctionnalités puissantes pour améliorer l'expérience
                d'achat
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
            © {new Date().getFullYear()} NusenseTryOn.
            Tous&nbsp;droits&nbsp;réservés.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
