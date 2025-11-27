import { useState, useEffect } from "react";
import { useShop } from "@/providers/AppBridgeProvider";
import { useSubscription } from "@/hooks/useSubscription";
import { redirectToPlanSelection } from "@/utils/managedPricing";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import SubscriptionManagement from "@/components/SubscriptionManagement";
import ShopifyManagedPricing from "@/components/ShopifyManagedPricing";
import QuickActions from "@/components/QuickActions";
import FeatureHighlights from "@/components/FeatureHighlights";

const Index = () => {
  // Deep linking configuration
  const API_KEY = "f8de7972ae23d3484581d87137829385"; // From shopify.app.toml client_id
  const APP_BLOCK_HANDLE = "nusense-tryon-button";
  const APP_HANDLE = "nutryon"; // App handle for Managed Pricing (from Partner Dashboard)

  // App Bridge hooks for embedded app
  const shop = useShop();

  // Subscription state
  const [currentPlan, setCurrentPlan] = useState<string | null>(null);

  // Use subscription hook to check subscription status
  const { subscription, loading: subscriptionLoading, refresh: refreshSubscription } = useSubscription();

  const handleDeepLinkClick = (template: "product" | "index" = "product") => {
    // Get shop domain from App Bridge or URL params
    const shopDomain =
      shop || new URLSearchParams(window.location.search).get("shop");

    if (!shopDomain) {
      toast.error("Impossible de détecter votre boutique", {
        description:
          "Veuillez vous assurer que vous accédez à cette application depuis votre admin Shopify.",
      });
      return;
    }

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

    window.open(deepLinkUrl, "_blank");
  };

  // Check subscription and redirect to pricing page if no active subscription
  useEffect(() => {
    // Wait for subscription to load
    if (subscriptionLoading) return;

    // Get shop domain
    const shopDomain =
      shop || new URLSearchParams(window.location.search).get("shop");

    if (!shopDomain) return;

    // Check if user has active paid subscription
    // Redirect to pricing page if no active subscription or only free plan
    if (subscription) {
      const hasActivePaidSubscription =
        subscription.hasActiveSubscription && !subscription.isFree;

      if (!hasActivePaidSubscription) {
        // Redirect to pricing page
        redirectToPlanSelection(shopDomain, APP_HANDLE);
        return;
      }

      // Update current plan state
      if (subscription.hasActiveSubscription && !subscription.isFree) {
        setCurrentPlan(subscription.plan.handle);
      } else if (subscription.isFree) {
        setCurrentPlan("free");
      } else {
        setCurrentPlan(null);
      }
    } else {
      // No subscription data - redirect to pricing page
      redirectToPlanSelection(shopDomain, APP_HANDLE);
    }
  }, [subscription, subscriptionLoading, shop]);

  // Show loading state while checking subscription
  if (subscriptionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
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
            <div className="flex flex-col items-start gap-6">
              {/* Hero Content */}
              <div className="w-full">
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
                      onClick={() => {
                        const shopDomain =
                          shop ||
                          new URLSearchParams(window.location.search).get(
                            "shop"
                          );
                        if (
                          !subscription ||
                          !subscription.hasActiveSubscription ||
                          subscription.isFree
                        ) {
                          if (shopDomain) {
                            redirectToPlanSelection(shopDomain, APP_HANDLE);
                          }
                        } else {
                          // Scroll to installation guide
                          document
                            .getElementById("installation-guide")
                            ?.scrollIntoView({ behavior: "smooth" });
                        }
                      }}
                      className="px-6"
                    >
                      <Zap className="w-4 h-4 mr-2" />
                      Commencer l'installation
                    </Button>
                    <Button
                      size="lg"
                      variant="outline"
                      onClick={() => {
                        const shopDomain =
                          shop ||
                          new URLSearchParams(window.location.search).get(
                            "shop"
                          );
                        if (shopDomain) {
                          redirectToPlanSelection(shopDomain);
                        }
                      }}
                      className="px-6"
                    >
                      Voir les tarifs
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Quick Actions Section */}
      <section className="py-8 sm:py-12 bg-background border-b border-border">
        <div className="container mx-auto px-4 sm:px-6 md:px-8">
          <div className="max-w-6xl mx-auto">
            <QuickActions
              showInstall={!currentPlan || currentPlan === "free"}
              showConfigure={currentPlan && currentPlan !== "free"}
              onInstallClick={() => {
                const shopDomain =
                  shop ||
                  new URLSearchParams(window.location.search).get("shop");
                if (
                  !subscription ||
                  !subscription.hasActiveSubscription ||
                  subscription.isFree
                ) {
                  if (shopDomain) {
                    redirectToPlanSelection(shopDomain, APP_HANDLE);
                  }
                } else {
                  document
                    .getElementById("installation-guide")
                    ?.scrollIntoView({ behavior: "smooth" });
                }
              }}
              onConfigureClick={() => {
                const shopDomain =
                  shop ||
                  new URLSearchParams(window.location.search).get("shop");
                if (
                  !subscription ||
                  !subscription.hasActiveSubscription ||
                  subscription.isFree
                ) {
                  if (shopDomain) {
                    redirectToPlanSelection(shopDomain, APP_HANDLE);
                  }
                } else {
                  document
                    .getElementById("installation-guide")
                    ?.scrollIntoView({ behavior: "smooth" });
                }
              }}
            />
          </div>
        </div>
      </section>

      {/* Installation Instructions - Only show if user has active subscription */}
      {subscription &&
        subscription.hasActiveSubscription &&
        !subscription.isFree && (
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
                              Le bloc d'application se place directement dans vos
                              sections de page produit. Il est compatible avec
                              tous les thèmes{" "}
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
                              <div className="bg-primary/10 border-2 border-primary/30 rounded-lg p-4 sm:p-5">
                                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                  <div className="flex-1">
                                    <p className="text-sm sm:text-base font-semibold text-foreground mb-2 no-orphans">
                                      🚀 Accès&nbsp;rapide&nbsp;:
                                    </p>
                                    <p className="text-sm sm:text-base text-foreground/90 no-orphans">
                                      Cliquez sur le bouton ci-dessous pour
                                      ouvrir l'éditeur de thème directement sur
                                      une page produit.
                                    </p>
                                  </div>
                                  <Button
                                    onClick={() => {
                                      const shopDomain =
                                        shop ||
                                        new URLSearchParams(
                                          window.location.search
                                        ).get("shop");
                                      if (
                                        !subscription ||
                                        !subscription.hasActiveSubscription ||
                                        subscription.isFree
                                      ) {
                                        if (shopDomain) {
                                          redirectToPlanSelection(
                                            shopDomain,
                                            APP_HANDLE
                                          );
                                        }
                                      } else {
                                        handleDeepLinkClick("product");
                                      }
                                    }}
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
                              La bannière d'application s'affiche automatiquement
                              sur votre page d'accueil pour promouvoir la
                              fonctionnalité d'essayage virtuel. Elle est
                              compatible avec tous les thèmes{" "}
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
                              <div className="bg-primary/10 border-2 border-primary/30 rounded-lg p-4 sm:p-5">
                                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                  <div className="flex-1">
                                    <p className="text-sm sm:text-base font-semibold text-foreground mb-2 no-orphans">
                                      🚀 Accès&nbsp;rapide&nbsp;:
                                    </p>
                                    <p className="text-sm sm:text-base text-foreground/90 no-orphans">
                                      Cliquez sur le bouton ci-dessous pour
                                      ouvrir l'éditeur de thème directement sur
                                      la page d'accueil.
                                    </p>
                                  </div>
                                  <Button
                                    onClick={() => {
                                      const shopDomain =
                                        shop ||
                                        new URLSearchParams(
                                          window.location.search
                                        ).get("shop");
                                      if (
                                        !subscription ||
                                        !subscription.hasActiveSubscription ||
                                        subscription.isFree
                                      ) {
                                        if (shopDomain) {
                                          redirectToPlanSelection(
                                            shopDomain,
                                            APP_HANDLE
                                          );
                                        }
                                      } else {
                                        handleDeepLinkClick("index");
                                      }
                                    }}
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
                                  pages&nbsp;produits et découvrir la fonctionnalité
                                  via la bannière sur votre page&nbsp;d'accueil.
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
      )}

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

      {/* Subscription Management Section */}
      {currentPlan && currentPlan !== "free" && (
        <section
          id="subscription-section"
          className="py-12 sm:py-16 bg-background border-b border-border"
        >
          <div className="container mx-auto px-4 sm:px-6 md:px-8">
            <div className="max-w-6xl mx-auto">
              <SubscriptionManagement
                onSubscriptionUpdate={refreshSubscription}
              />
            </div>
          </div>
        </section>
      )}

      {/* Shopify Managed Pricing Section */}
      <section className="py-12 sm:py-16 md:py-20 lg:py-24 bg-gradient-to-br from-background via-background to-muted">
        <div className="container mx-auto px-4 sm:px-6 md:px-8">
          <div className="max-w-6xl mx-auto">
            <ShopifyManagedPricing />
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
