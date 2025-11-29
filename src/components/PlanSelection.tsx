import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Sparkle, X } from "lucide-react";
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

interface PlanSelectionProps {
  plans: Plan[];
  onSelectPlan: (planHandle: string, promoCode?: string | null) => void;
  loading?: boolean;
}

const PlanSelection = ({ plans, onSelectPlan, loading = false }: PlanSelectionProps) => {
  const [selectedInterval, setSelectedInterval] = useState<"monthly" | "annual">("annual");
  const [promoCode, setPromoCode] = useState<string>("");
  const [appliedPromo, setAppliedPromo] = useState<{
    code: string;
    discount: any;
    pricing: any;
  } | null>(null);
  const [validatingPromo, setValidatingPromo] = useState<boolean>(false);
  const [promoError, setPromoError] = useState<string | null>(null);

  // Separate plans by interval
  const monthlyPlan = plans.find((p) => p.interval === "EVERY_30_DAYS");
  const annualPlan = plans.find((p) => p.interval === "ANNUAL");

  const currentPlan = selectedInterval === "monthly" ? monthlyPlan : annualPlan;

  const handleValidatePromo = async () => {
    if (!promoCode.trim() || !currentPlan) return;

    setValidatingPromo(true);
    setPromoError(null);

    try {
      const appBridge = (window as any).__APP_BRIDGE;
      if (!appBridge) {
        throw new Error("App Bridge not available");
      }

      const { authenticatedFetch } = await import("@shopify/app-bridge-utils");
      const fetchFn = authenticatedFetch(appBridge);

      const response = await fetchFn("/api/billing/validate-promo", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          code: promoCode.trim(),
          planHandle: currentPlan.handle,
        }),
      });

      if (!response.ok) {
        throw new Error("Erreur lors de la validation du code");
      }

      const data = await response.json();

      if (data.valid) {
        setAppliedPromo({
          code: data.code,
          discount: data.discount,
          pricing: data.pricing,
        });
        setPromoError(null);
      } else {
        setAppliedPromo(null);
        setPromoError(data.message || "Code promotionnel invalide");
      }
    } catch (error) {
      setAppliedPromo(null);
      setPromoError("Erreur lors de la validation du code");
    } finally {
      setValidatingPromo(false);
    }
  };

  const handleRemovePromo = () => {
    setPromoCode("");
    setAppliedPromo(null);
    setPromoError(null);
  };

  const handleSelectPlan = () => {
    if (currentPlan) {
      onSelectPlan(currentPlan.handle, appliedPromo?.code || null);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto px-4 sm:px-6 pt-4 pb-6">
      <div className="text-center mb-4">
        <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-1">
          Choisissez votre plan
        </h2>
        <p className="text-sm sm:text-base text-muted-foreground">
          Sélectionnez le plan qui correspond le mieux à vos besoins
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
              Mensuel
            </TabsTrigger>
            <TabsTrigger
              value="annual"
              className="data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm text-sm font-medium transition-all"
            >
              Annuel
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
                  Économisez 25%
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
              {appliedPromo ? (
                <div className="space-y-2">
                  <div className="flex items-baseline justify-center gap-2">
                    <span className="text-2xl sm:text-3xl line-through text-muted-foreground">
                      ${appliedPromo.pricing.original.toFixed(2)}
                    </span>
                    <span className="text-4xl sm:text-5xl font-bold text-foreground">
                      ${appliedPromo.pricing.discounted.toFixed(2)}
                    </span>
                    <span className="text-lg text-muted-foreground">
                      /{selectedInterval === "monthly" ? "mois" : "an"}
                    </span>
                  </div>
                  <div className="text-xs text-success font-semibold">
                    Économisez ${appliedPromo.pricing.savings.toFixed(2)}
                  </div>
                </div>
              ) : (
                <div className="flex items-baseline justify-center gap-2 mb-1">
                  <span className="text-4xl sm:text-5xl font-bold text-foreground">
                    ${selectedInterval === "monthly" ? currentPlan.price : currentPlan.price}
                  </span>
                  <span className="text-lg text-muted-foreground">
                    /{selectedInterval === "monthly" ? "mois" : "an"}
                  </span>
                </div>
              )}
              {selectedInterval === "annual" && annualPlan?.monthlyEquivalent && (
                <p className="text-xs text-muted-foreground mt-1">
                  ${annualPlan.monthlyEquivalent}/mois, facturé annuellement
                </p>
              )}
              {currentPlan.trialDays && (
                <p className="text-xs text-primary font-semibold mt-2 inline-flex items-center gap-1 px-2 py-1 bg-primary/10 rounded border border-primary/20">
                  <Sparkle className="w-3 h-3" />
                  {currentPlan.trialDays} jours d'essai gratuit
                </p>
              )}
            </div>

            {/* Features */}
            <div className="space-y-2">
              <p className="text-sm font-semibold text-foreground mb-2 flex items-center justify-center gap-1.5">
                <Sparkle className="w-4 h-4 text-primary" />
                Avantages inclus
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

            {/* Promo Code Section */}
            <div className="border-t border-border pt-4 space-y-2">
              <label className="text-sm font-medium text-foreground block">
                Code promotionnel (optionnel)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={promoCode}
                  onChange={(e) => {
                    setPromoCode(e.target.value.toUpperCase());
                    setAppliedPromo(null);
                    setPromoError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && promoCode.trim()) {
                      handleValidatePromo();
                    }
                  }}
                  placeholder="Entrez votre code"
                  className="flex-1 px-3 py-2 text-sm border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={validatingPromo || loading}
                />
                {appliedPromo ? (
                  <Button
                    onClick={handleRemovePromo}
                    variant="outline"
                    size="sm"
                    className="whitespace-nowrap"
                    disabled={loading}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                ) : (
                  <Button
                    onClick={handleValidatePromo}
                    disabled={validatingPromo || !promoCode.trim() || loading}
                    variant="outline"
                    size="sm"
                    className="whitespace-nowrap"
                  >
                    {validatingPromo ? "..." : "Appliquer"}
                  </Button>
                )}
              </div>

              {/* Show applied promo */}
              {appliedPromo && (
                <div className="p-2 bg-success/10 border border-success/30 rounded text-xs text-success flex items-center justify-between">
                  <span>
                    ✓ Code {appliedPromo.code} appliqué:{" "}
                    {appliedPromo.discount.type === "percentage"
                      ? `${(appliedPromo.discount.value * 100).toFixed(0)}% de réduction`
                      : `$${appliedPromo.discount.value.toFixed(2)} de réduction`}
                    {appliedPromo.discount.durationLimitInIntervals &&
                      ` (${appliedPromo.discount.durationLimitInIntervals} cycles)`}
                  </span>
                </div>
              )}

              {/* Show error */}
              {promoError && (
                <div className="p-2 bg-destructive/10 border border-destructive/30 rounded text-xs text-destructive">
                  {promoError}
                </div>
              )}
            </div>

            {/* CTA Button */}
            <div className="pt-2">
              <Button
                onClick={handleSelectPlan}
                disabled={loading}
                className="w-full h-11 text-sm font-semibold"
                size="lg"
              >
                {loading ? "Traitement..." : "Sélectionner ce plan"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Info Note */}
      <div className="mt-4 text-center">
        <p className="text-xs text-muted-foreground">
          Vous pouvez modifier ou annuler votre plan à tout moment depuis votre
          admin Shopify.
        </p>
      </div>
    </div>
  );
};

export default PlanSelection;

