import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Sparkle, CheckCircle2, ArrowLeft, Crown, Zap, TrendingUp } from "lucide-react";

interface PlanLimits {
  includedCredits: number;
  processingPriority: string;
  imageQuality: string;
  supportLevel: string;
  analyticsLevel: string;
  apiAccess: boolean;
  costPerGeneration: number;
}

interface Plan {
  name: string;
  handle: string;
  price: number;
  currencyCode: string;
  interval: string;
  trialDays?: number;
  monthlyEquivalent?: number;
  description?: string;
  features: string[];
  isFree?: boolean;
  hasOverage?: boolean;
  yearlySavings?: number | null;
  limits?: PlanLimits;
}

interface PlanTiers {
  free?: Plan[];
  starter?: Plan[];
  growth?: Plan[];
  pro?: Plan[];
}

interface PlansResponse {
  plans: Plan[];
  planTiers?: PlanTiers;
  totalPlans?: number;
}

interface PlanLimits {
  includedCredits: number;
  processingPriority: string;
  imageQuality: string;
  supportLevel: string;
  analyticsLevel: string;
  apiAccess: boolean;
  costPerGeneration: number;
}

interface SubscriptionPlan {
  name: string;
  handle: string;
  price: number;
  currencyCode: string;
  interval: string;
  trialDays?: number;
  description?: string;
  features?: string[];
  limits?: PlanLimits;
}

interface SubscriptionDetails {
  id: string;
  status: string;
  currentPeriodEnd: string;
  approvedAt?: string;
  planStartDate?: string;
  currentPeriodStart: string;
  createdAt: string;
  name: string;
  trialDays: number;
  trialDaysRemaining: number;
  isInTrial: boolean;
}

interface SubscriptionStatus {
  requestId?: string;
  hasActiveSubscription: boolean;
  isFree: boolean;
  plan: SubscriptionPlan | null;
  subscription: SubscriptionDetails | null;
}

interface PlanSelectionProps {
  plans: Plan[] | PlansResponse;
  onSelectPlan: (planHandle: string) => void;
  loading?: boolean;
  subscription?: SubscriptionStatus | null;
  onBack?: () => void;
}

const PlanSelection = ({ plans, onSelectPlan, loading = false, subscription, onBack }: PlanSelectionProps) => {
  const { t } = useTranslation();
  const [selectedInterval, setSelectedInterval] = useState<"monthly" | "annual">("annual");
  const [loadingPlanHandle, setLoadingPlanHandle] = useState<string | null>(null);

  // Normalize plans data - handle both array and object response
  const plansData = useMemo(() => {
    if (Array.isArray(plans)) {
      return { plans, planTiers: undefined };
    }
    return plans as PlansResponse;
  }, [plans]);

  const allPlans = plansData.plans || [];
  const planTiers = plansData.planTiers;

  // Check if user has an active subscription (for showing back button)
  // Show back button if user has any active subscription (including free plan)
  const hasActiveSubscription = 
    subscription?.subscription !== null &&
    subscription?.hasActiveSubscription === true;

  // Auto-select the interval tab based on subscription if available
  useEffect(() => {
    if (subscription?.plan?.interval) {
      if (subscription.plan.interval === "EVERY_30_DAYS") {
        setSelectedInterval("monthly");
      } else if (subscription.plan.interval === "ANNUAL") {
        setSelectedInterval("annual");
      }
    }
  }, [subscription?.plan?.interval]);

  // Get plans filtered by interval
  const filteredPlans = useMemo(() => {
    const interval = selectedInterval === "monthly" ? "EVERY_30_DAYS" : "ANNUAL";
    return allPlans.filter((p) => p.interval === interval);
  }, [allPlans, selectedInterval]);

  // Organize plans by tier if planTiers exists, otherwise group by name
  const organizedPlans = useMemo(() => {
    if (planTiers) {
      // Use planTiers structure
      const tiers: { tier: string; plans: Plan[] }[] = [];
      const targetInterval = selectedInterval === "monthly" ? "EVERY_30_DAYS" : "ANNUAL";
      
      // Free plan: Show monthly plan in annual view for UI consistency
      if (planTiers.free) {
        let freePlan = planTiers.free.find((p) => p.interval === targetInterval);
        // If annual is selected and no annual free plan exists, use monthly free plan
        if (!freePlan && selectedInterval === "annual") {
          freePlan = planTiers.free.find((p) => p.interval === "EVERY_30_DAYS");
        }
        if (freePlan) tiers.push({ tier: "free", plans: [freePlan] });
      }
      if (planTiers.starter) {
        const starterPlan = planTiers.starter.find((p) => p.interval === targetInterval);
        if (starterPlan) tiers.push({ tier: "starter", plans: [starterPlan] });
      }
      if (planTiers.growth) {
        const growthPlan = planTiers.growth.find((p) => p.interval === targetInterval);
        if (growthPlan) tiers.push({ tier: "growth", plans: [growthPlan] });
      }
      if (planTiers.pro) {
        const proPlan = planTiers.pro.find((p) => p.interval === targetInterval);
        if (proPlan) tiers.push({ tier: "pro", plans: [proPlan] });
      }
      
      return tiers;
    } else {
      // Group by plan name
      const grouped = new Map<string, Plan[]>();
      filteredPlans.forEach((plan) => {
        const existing = grouped.get(plan.name) || [];
        grouped.set(plan.name, [...existing, plan]);
      });
      
      // For free plan in annual view, add monthly free plan if it exists
      if (selectedInterval === "annual") {
        const monthlyFreePlan = allPlans.find(
          (p) => p.name.toLowerCase() === "free" && p.interval === "EVERY_30_DAYS"
        );
        if (monthlyFreePlan && !grouped.has("Free")) {
          grouped.set("Free", [monthlyFreePlan]);
        }
      }
      
      return Array.from(grouped.entries()).map(([name, plans]) => ({
        tier: name.toLowerCase(),
        plans,
      }));
    }
  }, [planTiers, filteredPlans, selectedInterval, allPlans]);

  // Check if user is subscribed to a specific plan
  // This includes free plans - if user has free plan active, show as subscribed
  const isSubscribedToPlan = (plan: Plan) => {
    if (!subscription || !subscription.subscription || !subscription.plan) {
      return false;
    }
    
    // Check if subscription is active
    if (!subscription.hasActiveSubscription) {
      return false;
    }
    
    // Match by plan name and interval (handle is more specific but name+interval is reliable)
    const planMatches = 
      subscription.plan.name === plan.name &&
      subscription.plan.interval === plan.interval;
    
    // Also check by handle if available (more specific match)
    const handleMatches = subscription.plan.handle === plan.handle;
    
    return planMatches || handleMatches;
  };

  const handleSelectPlan = (planHandle: string) => {
    setLoadingPlanHandle(planHandle);
    onSelectPlan(planHandle);
  };

  // Clear loading state when global loading becomes false
  useEffect(() => {
    if (!loading) {
      setLoadingPlanHandle(null);
    }
  }, [loading]);

  // Get tier icon
  const getTierIcon = (tier: string) => {
    switch (tier) {
      case "free":
        return <Sparkle className="w-5 h-5" />;
      case "starter":
        return <Zap className="w-5 h-5" />;
      case "growth":
        return <TrendingUp className="w-5 h-5" />;
      case "pro":
        return <Crown className="w-5 h-5" />;
      default:
        return <Sparkle className="w-5 h-5" />;
    }
  };

  // Get tier color classes
  const getTierColorClasses = (tier: string) => {
    switch (tier) {
      case "free":
        return {
          border: "border-border",
          badge: "bg-muted text-muted-foreground",
          button: "bg-primary hover:bg-primary/90",
        };
      case "starter":
        return {
          border: "border-border",
          badge: "bg-muted text-muted-foreground",
          button: "bg-primary hover:bg-primary/90",
        };
      case "growth":
        return {
          border: "border-primary",
          badge: "bg-primary/10 text-primary",
          button: "bg-primary hover:bg-primary/90",
        };
      case "pro":
        return {
          border: "border-border",
          badge: "bg-muted text-muted-foreground",
          button: "bg-primary hover:bg-primary/90",
        };
      default:
        return {
          border: "border-border",
          badge: "bg-muted text-muted-foreground",
          button: "bg-primary hover:bg-primary/90",
        };
    }
  };

  // Translate plan feature strings
  const translateFeature = (feature: string): string => {
    if (!feature) return feature;

    const lowerFeature = feature.toLowerCase().trim();
    const originalFeature = feature.trim();

    // Credits included patterns - English: "X monthly credits included"
    const creditsMatch = lowerFeature.match(/(\d+)\s*(monthly\s*)?credits?\s*(included|mensuel|mensuels)?/i);
    if (creditsMatch) {
      const count = parseInt(creditsMatch[1], 10);
      const translated = t("planSelection.features.creditsIncluded", { count });
      // Only use translation if it's different from the key (translation exists)
      if (translated && !translated.startsWith("planSelection.features")) {
        return translated;
      }
    }

    // Simple credits included - French format: "X crédits inclus"
    const simpleCreditsMatch = lowerFeature.match(/(\d+)\s*crédits?\s*inclus/i);
    if (simpleCreditsMatch) {
      const count = parseInt(simpleCreditsMatch[1], 10);
      const translated = t("planSelection.features.creditsIncludedSimple", { count });
      if (translated && !translated.startsWith("planSelection.features")) {
        return translated;
      }
    }

    // Watermarked images (specific for free plan)
    if (lowerFeature === "watermarked images" || lowerFeature.includes("watermarked images")) {
      const translated = t("planSelection.features.watermarkedImages");
      if (translated && !translated.startsWith("planSelection.features")) {
        return translated;
      }
    }

    // Full HD images (specific for paid plans)
    if (lowerFeature === "full hd images" || lowerFeature.includes("full hd images")) {
      const translated = t("planSelection.features.fullHdImages");
      if (translated && !translated.startsWith("planSelection.features")) {
        return translated;
      }
    }

    // Standard definition image quality (watermarked) - legacy support
    if (lowerFeature.includes("watermarked") || lowerFeature.includes("filigrane") || 
        lowerFeature.includes("standard definition") || lowerFeature.includes("définition standard") ||
        lowerFeature.includes("standard quality") || lowerFeature.includes("qualité standard")) {
      const translated = t("planSelection.features.watermarkedImageQuality");
      if (translated && !translated.startsWith("planSelection.features")) {
        return translated;
      }
    }

    // Full HD image quality - legacy support
    if (lowerFeature.includes("full hd") || lowerFeature.includes("fullhd") || lowerFeature.includes("full-hd") || lowerFeature.includes("qualité d'image full hd")) {
      const translated = t("planSelection.features.fullHdImageQuality");
      if (translated && !translated.startsWith("planSelection.features")) {
        return translated;
      }
    }

    // Community support
    if (lowerFeature.includes("community support") || lowerFeature.includes("support communautaire")) {
      const translated = t("planSelection.features.communitySupport");
      if (translated && !translated.startsWith("planSelection.features")) {
        return translated;
      }
    }

    // Email support 24h
    if ((lowerFeature.includes("email support") || lowerFeature.includes("support par email")) && (lowerFeature.includes("24h") || lowerFeature.includes("24 h") || lowerFeature.includes("24h response") || lowerFeature.includes("réponse sous 24h"))) {
      const translated = t("planSelection.features.emailSupport24h");
      if (translated && !translated.startsWith("planSelection.features")) {
        return translated;
      }
    }

    // Priority support 12h
    if ((lowerFeature.includes("priority support") || lowerFeature.includes("support prioritaire")) && (lowerFeature.includes("12h") || lowerFeature.includes("12 h") || lowerFeature.includes("12h response") || lowerFeature.includes("réponse sous 12h"))) {
      const translated = t("planSelection.features.prioritySupport12h");
      if (translated && !translated.startsWith("planSelection.features")) {
        return translated;
      }
    }

    // Dedicated support 4h
    if ((lowerFeature.includes("dedicated support") || lowerFeature.includes("support dédié")) && (lowerFeature.includes("4h") || lowerFeature.includes("4 h") || lowerFeature.includes("4h response") || lowerFeature.includes("réponse sous 4h"))) {
      const translated = t("planSelection.features.dedicatedSupport4h");
      if (translated && !translated.startsWith("planSelection.features")) {
        return translated;
      }
    }

    // Basic analytics
    if (lowerFeature.includes("basic analytics") || lowerFeature.includes("analyses de base")) {
      const translated = t("planSelection.features.basicAnalytics");
      if (translated && !translated.startsWith("planSelection.features")) {
        return translated;
      }
    }

    // Advanced analytics + API
    if ((lowerFeature.includes("advanced analytics") || lowerFeature.includes("analyses avancées")) && (lowerFeature.includes("api") || lowerFeature.includes("+ api"))) {
      const translated = t("planSelection.features.advancedAnalyticsApi");
      if (translated && !translated.startsWith("planSelection.features")) {
        return translated;
      }
    }

    // Advanced analytics (without API)
    if (lowerFeature.includes("advanced analytics") || lowerFeature.includes("analyses avancées")) {
      const translated = t("planSelection.features.advancedAnalytics");
      if (translated && !translated.startsWith("planSelection.features")) {
        return translated;
      }
    }

    // API access included
    if ((lowerFeature.includes("api access") || lowerFeature.includes("accès api")) && (lowerFeature.includes("included") || lowerFeature.includes("inclus"))) {
      const translated = t("planSelection.features.apiAccessIncluded");
      if (translated && !translated.startsWith("planSelection.features")) {
        return translated;
      }
    }

    // Overage billing with rate and free credits
    const overageMatch = lowerFeature.match(/overage\s*billing[:\s]*\$?(\d+\.?\d*)\s*per\s*credit\s*after\s*(\d+)\s*free/i) ||
                         lowerFeature.match(/facturation\s*du\s*dépassement[:\s]*(\d+\.?\d*)\s*\$?\s*par\s*crédit\s*après\s*(\d+)\s*(free|gratuits?)/i);
    if (overageMatch) {
      const rate = overageMatch[1];
      const freeCredits = overageMatch[2];
      const translated = t("planSelection.features.overageBilling", { rate, freeCredits });
      if (translated && !translated.startsWith("planSelection.features")) {
        return translated;
      }
    }

    // Payment method required
    if (lowerFeature.includes("payment method required") || lowerFeature.includes("méthode de paiement requise")) {
      const translated = t("planSelection.features.paymentMethodRequired");
      if (translated && !translated.startsWith("planSelection.features")) {
        return translated;
      }
    }

    // Cost per generation
    const costMatch = lowerFeature.match(/cost[:\s]*\$?(\d+\.?\d*)\s*per\s*generation/i) ||
                      lowerFeature.match(/coût[:\s]*(\d+\.?\d*)\s*\$?\s*par\s*génération/i);
    if (costMatch) {
      const rate = costMatch[1];
      const translated = t("planSelection.features.costPerGeneration", { rate });
      if (translated && !translated.startsWith("planSelection.features")) {
        return translated;
      }
    }

    // Save per year
    const saveMatch = lowerFeature.match(/save\s*\$?(\d+)\s*per\s*year/i) ||
                      lowerFeature.match(/économisez\s*\$?(\d+)\s*par\s*an/i);
    if (saveMatch) {
      const amount = saveMatch[1];
      const translated = t("planSelection.features.savePerYear", { amount });
      if (translated && !translated.startsWith("planSelection.features")) {
        return translated;
      }
    }

    // One usage one credit (French format)
    if (lowerFeature.includes("1 utilisation = 1 crédit") || lowerFeature.includes("(1 utilisation = 1 crédit)")) {
      const translated = t("planSelection.features.oneUsageOneCredit");
      if (translated && !translated.startsWith("planSelection.features")) {
        return translated;
      }
    }

    // Recharge possible (French format)
    if (lowerFeature.includes("recharge possible après dépassement")) {
      const translated = t("planSelection.features.rechargePossible");
      if (translated && !translated.startsWith("planSelection.features")) {
        return translated;
      }
    }

    // If no translation found, return original feature
    return originalFeature;
  };

  return (
    <div className="w-full mx-auto px-4 sm:px-6 pt-4 pb-6">
      {/* Back Button - Only show for subscribed users */}
      {hasActiveSubscription && onBack && (
        <div className="mb-4">
          <Button
            variant="primary"
            size="sm"
            onClick={onBack}
            className="text-muted-foreground hover:text-foreground bg-transparent hover:bg-transparent"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t("planSelection.back")}
          </Button>
        </div>
      )}

      {/* Heading and Description - Left aligned above cards */}
      <div className="mb-6">
        <h2 id="plan-selection-title" className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
          {t("planSelection.title")}
        </h2>
        <p className="text-sm sm:text-base text-muted-foreground">
          {t("planSelection.subtitle")}
        </p>
      </div>

      {/* Interval Tabs */}
      <div className="flex justify-center mb-6">
        <Tabs
          value={selectedInterval}
          onValueChange={(value) =>
            setSelectedInterval(value as "monthly" | "annual")
          }
          className="w-full max-w-xs"
        >
          <TabsList className="grid w-full grid-cols-2 bg-muted p-1.5 h-12">
            <TabsTrigger
              value="monthly"
              className="data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm text-sm font-medium transition-all"
            >
              {t("planSelection.monthly") || "Monthly"}
            </TabsTrigger>
            <TabsTrigger
              value="annual"
              className="data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm text-sm font-medium transition-all"
            >
              {t("planSelection.annual") || "Annual"}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Plans Grid - Using flexbox for equal heights and alignment */}
      {organizedPlans.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {organizedPlans.map(({ tier, plans }) => {
            const plan = plans[0]; // Get the plan for current interval
            if (!plan) return null;

            const isSubscribed = isSubscribedToPlan(plan);
            const colors = getTierColorClasses(tier);
            const isPopular = tier === "growth";

            return (
              <Card
                key={`${tier}-${selectedInterval}`}
                className={`relative border-2 ${colors.border} shadow-lg bg-card transition-all hover:shadow-xl flex flex-col`}
              >
                {/* Header - Fixed height */}
                <CardHeader className="text-center pb-3 pt-6 flex-shrink-0">
                  <div className="flex items-center justify-center gap-2 mb-2 min-h-[2rem]">
                    <div className="flex items-center gap-2">
                      {getTierIcon(tier)}
                      <CardTitle className="text-xl font-bold text-foreground">
                        {plan.name}
                      </CardTitle>
                    </div>
                  </div>
                  {/* Badges section */}
                  <div className="flex flex-col items-center gap-2 mt-2">
                    {/* Popular badge for growth plan */}
                    {isPopular && (
                      <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
                        {t("planSelection.popular")}
                      </Badge>
                    )}
                    {/* Savings badge for annual plans */}
                    {selectedInterval === "annual" && 
                     plan.interval === "ANNUAL" && 
                     plan.yearlySavings && 
                     plan.yearlySavings > 0 && (
                      <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
                        {t("planSelection.yearlySavings", { amount: plan.yearlySavings })}
                      </Badge>
                    )}
                  </div>
                </CardHeader>

                {/* Content - Flex grow to push button to bottom */}
                <CardContent className="flex flex-col flex-grow px-4 pb-5">
                  {/* Pricing - Fixed height */}
                  <div className="text-center border-b border-border pb-4 flex-shrink-0">
                    <div className="flex items-baseline justify-center gap-2 mb-1">
                      <span className="text-3xl sm:text-4xl font-bold text-foreground">
                        ${plan.price}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        /{plan.interval === "EVERY_30_DAYS" 
                          ? (t("planSelection.monthlyPeriod") || "month")
                          : (t("planSelection.annualPeriod") || "year")}
                      </span>
                    </div>
                    {/* Monthly equivalent for annual plans */}
                    {selectedInterval === "annual" && plan.monthlyEquivalent && plan.monthlyEquivalent > 0 && plan.interval === "ANNUAL" && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {t("planSelection.billedAnnually", { price: `$${plan.monthlyEquivalent}` }) || 
                         `$${plan.monthlyEquivalent}/month billed annually`}
                      </p>
                    )}
                    {/* Overage information */}
                    {plan.hasOverage && plan.limits?.costPerGeneration && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {t("planSelection.overageRate", { rate: plan.limits.costPerGeneration })}
                      </p>
                    )}
                  </div>

                  {/* Features - Flex grow to fill space */}
                  <div className="flex-grow py-4">
                    <ul className="space-y-2">
                      {(() => {
                        // Process features: filter out existing image quality mentions and payment method requirement for free plans
                        const processedFeatures = plan.features.filter((feature) => {
                          const lowerFeature = feature.toLowerCase().trim();
                          
                          // Filter out existing image quality mentions (we'll add our own)
                          if (
                            lowerFeature.includes("watermarked") ||
                            lowerFeature.includes("filigrane") ||
                            lowerFeature.includes("standard definition") ||
                            lowerFeature.includes("définition standard") ||
                            lowerFeature.includes("standard quality") ||
                            lowerFeature.includes("qualité standard") ||
                            lowerFeature.includes("full hd") ||
                            lowerFeature.includes("fullhd") ||
                            lowerFeature.includes("full-hd") ||
                            lowerFeature.includes("image quality") ||
                            lowerFeature.includes("qualité d'image") ||
                            lowerFeature.includes("images")
                          ) {
                            return false;
                          }
                          
                          // Filter out "Payment method required for overage billing" for free plans only
                          if (plan.isFree) {
                            return !(
                              lowerFeature.includes("payment method required") ||
                              lowerFeature.includes("méthode de paiement requise")
                            );
                          }
                          
                          return true;
                        });

                        // Add image quality feature based on plan tier
                        if (tier === "free") {
                          processedFeatures.unshift("Watermarked images");
                        } else if (tier === "starter" || tier === "growth" || tier === "pro") {
                          processedFeatures.unshift("Full HD images");
                        }

                        return processedFeatures;
                      })().map((feature, index) => (
                        <li
                          key={index}
                          className="flex items-start gap-2 text-xs"
                        >
                          <Check className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                          <span className="text-muted-foreground leading-snug">
                            {translateFeature(feature)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* CTA Button - Fixed at bottom */}
                  <div className="mt-auto pt-4 flex-shrink-0">
                    {isSubscribed ? (
                      <div className="flex items-center justify-center w-full h-11 px-4 rounded-md bg-primary/10 border border-primary/20">
                        <CheckCircle2 className="w-4 h-4 text-primary mr-2" />
                        <span className="text-xs font-semibold text-primary">
                          {t("planSelection.currentPlan") || "Current Plan"}
                        </span>
                      </div>
                    ) : (
                      <Button
                        onClick={() => handleSelectPlan(plan.handle)}
                        disabled={loadingPlanHandle === plan.handle}
                        className={`w-full h-11 text-xs font-semibold ${colors.button} text-primary-foreground`}
                        size="lg"
                      >
                        {loadingPlanHandle === plan.handle
                          ? (t("planSelection.processing") || "Processing...")
                          : plan.isFree
                          ? (t("planSelection.getStarted") || "Get Started")
                          : (t("planSelection.selectPlan") || "Select Plan")}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-8">
          <p className="text-muted-foreground">
            {t("planSelection.noPlans") || "No plans available at this time."}
          </p>
        </div>
      )}

      {/* Info Note */}
      <div className="mt-6 text-center">
        <p className="text-xs text-muted-foreground">
          {t("planSelection.infoNote") || "All plans include our core features. Upgrade or downgrade at any time."}
        </p>
      </div>
    </div>
  );
};

export default PlanSelection;

