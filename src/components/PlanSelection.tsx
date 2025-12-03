import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Sparkle, CheckCircle2, ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";

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
}

interface SubscriptionStatus {
  subscription: {
    id: string;
    status: string;
  } | null;
  plan: {
    name: string;
    price: number;
    currencyCode: string;
    interval: string;
  } | null;
  hasActiveSubscription: boolean;
  isFree: boolean;
}

interface PlanSelectionProps {
  plans: Plan[];
  onSelectPlan: (planHandle: string) => void;
  loading?: boolean;
  subscription?: SubscriptionStatus | null;
  onBack?: () => void;
}

const PlanSelection = ({ plans, onSelectPlan, loading = false, subscription, onBack }: PlanSelectionProps) => {
  const { t } = useTranslation();
  const [selectedInterval, setSelectedInterval] = useState<"monthly" | "annual">("annual");

  // Check if user has an active subscription (for showing back button)
  const hasActiveSubscription = 
    subscription?.subscription !== null &&
    subscription?.hasActiveSubscription &&
    !subscription?.isFree;

  // Separate plans by interval
  const monthlyPlan = plans.find((p) => p.interval === "EVERY_30_DAYS");
  const annualPlan = plans.find((p) => p.interval === "ANNUAL");

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

  const currentPlan = selectedInterval === "monthly" ? monthlyPlan : annualPlan;

  // Check if user is subscribed and if this plan matches their subscription
  // Match by plan name and interval (since subscription doesn't have handle)
  const isSubscribedToThisPlan = 
    subscription?.subscription !== null &&
    subscription?.hasActiveSubscription &&
    !subscription?.isFree &&
    subscription?.plan?.name === currentPlan?.name &&
    subscription?.plan?.interval === currentPlan?.interval;

  const handleSelectPlan = () => {
    if (currentPlan) {
      onSelectPlan(currentPlan.handle);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto px-4 sm:px-6 pt-4 pb-6">
      {/* Back Button - Only show for subscribed users */}
      {hasActiveSubscription && onBack && (
        <div className="mb-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t("planSelection.back")}
          </Button>
        </div>
      )}

      <div className="text-center mb-4">
        <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-1">
          {t("planSelection.title")}
        </h2>
        <p className="text-sm sm:text-base text-muted-foreground">
          {t("planSelection.subtitle")}
        </p>
      </div>

      {/* Interval Tabs - Similar to Shopify Managed Pricing */}
      <div className="flex justify-center mb-4">
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
              {t("planSelection.monthly")}
            </TabsTrigger>
            <TabsTrigger
              value="annual"
              className="data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm text-sm font-medium transition-all"
            >
              {t("planSelection.annual")}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Plan Card */}
      {currentPlan && (
        <Card className="border-2 border-border shadow-xl bg-card max-w-md mx-auto">
          <CardHeader className="text-center pb-3 pt-4">
            <div className="flex items-center justify-center gap-2 mb-2">
              <CardTitle className="text-xl sm:text-2xl font-bold text-foreground">
                {currentPlan.name}
              </CardTitle>
              {selectedInterval === "annual" && annualPlan?.monthlyEquivalent && (
                <Badge
                  variant="default"
                  className="bg-primary/20 text-primary border-primary/30 px-2 py-0.5 text-xs font-semibold"
                >
                  {t("planSelection.save25")}
                </Badge>
              )}
            </div>
            {currentPlan.description && (
              <CardDescription className="text-sm text-muted-foreground">
                {currentPlan.description}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-4 px-5 pb-5">
            {/* Pricing */}
            <div className="text-center border-b border-border pb-4">
              <div className="flex items-baseline justify-center gap-2 mb-1">
                <span className="text-4xl sm:text-5xl font-bold text-foreground">
                  ${selectedInterval === "monthly" ? currentPlan.price : currentPlan.price}
                </span>
                <span className="text-lg text-muted-foreground">
                  /{selectedInterval === "monthly" ? t("planSelection.monthlyPeriod") : t("planSelection.annualPeriod")}
                </span>
              </div>
              {selectedInterval === "annual" && annualPlan?.monthlyEquivalent && (
                <p className="text-xs text-muted-foreground mt-1">
                  {t("planSelection.billedAnnually", { price: `$${annualPlan.monthlyEquivalent}` })}
                </p>
              )}
              {currentPlan.trialDays && (
                <p className="text-xs text-primary font-semibold mt-2 inline-flex items-center gap-1 px-2 py-1 bg-primary/10 rounded border border-primary/20">
                  <Sparkle className="w-3 h-3" />
                  {t("planSelection.trialDays", { days: currentPlan.trialDays })}
                </p>
              )}
            </div>

            {/* Features */}
            <div className="space-y-2">
              <p className="text-sm font-semibold text-foreground mb-2 flex items-center justify-center gap-1.5">
                <Sparkle className="w-4 h-4 text-primary" />
                {t("planSelection.featuresTitle")}
              </p>
              <ul className="space-y-1.5">
                {currentPlan.features.map((feature, index) => (
                  <li
                    key={index}
                    className="flex items-start gap-2 text-xs sm:text-sm"
                  >
                    <Check className="w-4 h-4 text-success flex-shrink-0 mt-0.5" />
                    <span className="text-muted-foreground leading-snug">
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* CTA Button or Current Plan Badge */}
            <div className="pt-2">
              {isSubscribedToThisPlan ? (
                <div className="flex items-center justify-center w-full h-11 px-4 rounded-md bg-success/10 border border-success/30">
                  <CheckCircle2 className="w-5 h-5 text-success mr-2" />
                  <span className="text-sm font-semibold text-success">
                    {t("planSelection.currentPlan")}
                  </span>
                </div>
              ) : (
                <Button
                  onClick={handleSelectPlan}
                  disabled={loading}
                  className="w-full h-11 text-sm font-semibold"
                  size="lg"
                >
                  {loading ? t("planSelection.processing") : t("planSelection.selectPlan")}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Info Note */}
      <div className="mt-4 text-center">
        <p className="text-xs text-muted-foreground">
          {t("planSelection.infoNote")}
        </p>
      </div>
    </div>
  );
};

export default PlanSelection;

