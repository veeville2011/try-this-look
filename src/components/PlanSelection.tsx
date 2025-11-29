import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Sparkle, ArrowLeft } from "lucide-react";
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
  onSelectPlan: (planHandle: string) => void;
  onBack?: () => void;
  loading?: boolean;
}

const PlanSelection = ({ plans, onSelectPlan, onBack, loading = false }: PlanSelectionProps) => {
  const [selectedInterval, setSelectedInterval] = useState<"monthly" | "annual">("annual");

  // Separate plans by interval
  const monthlyPlan = plans.find((p) => p.interval === "EVERY_30_DAYS");
  const annualPlan = plans.find((p) => p.interval === "ANNUAL");

  const currentPlan = selectedInterval === "monthly" ? monthlyPlan : annualPlan;

  const handleSelectPlan = () => {
    if (currentPlan) {
      onSelectPlan(currentPlan.handle);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-6">
      {/* Back Button */}
      {onBack && (
        <div className="mb-4">
          <Button
            variant="ghost"
            onClick={onBack}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour
          </Button>
        </div>
      )}

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
          className="w-full max-w-sm"
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
        <Card className="border-2 border-border shadow-xl bg-card">
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
              <CardDescription className="text-sm text-muted-foreground max-w-xl mx-auto">
                {currentPlan.description}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-4 px-6 pb-6">
            {/* Pricing */}
            <div className="text-center border-b border-border pb-4">
              <div className="flex items-baseline justify-center gap-2 mb-1">
                <span className="text-4xl sm:text-5xl font-bold text-foreground">
                  ${selectedInterval === "monthly" ? currentPlan.price : currentPlan.price}
                </span>
                <span className="text-lg text-muted-foreground">
                  /{selectedInterval === "monthly" ? "mois" : "an"}
                </span>
              </div>
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
              <ul className="space-y-1.5 max-w-md mx-auto">
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

