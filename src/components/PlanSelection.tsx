import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
                      {plan.features.map((feature, index) => (
                        <li
                          key={index}
                          className="flex items-start gap-2 text-xs"
                        >
                          <Check className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                          <span className="text-muted-foreground leading-snug">
                            {feature}
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

