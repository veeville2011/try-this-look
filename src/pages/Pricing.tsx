import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Plan {
  handle: string;
  name: string;
  price: number;
  interval: string;
  description: string;
  features: string[];
  monthlyEquivalent?: number;
  isPopular?: boolean;
}

const Pricing = () => {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [currentPlan, setCurrentPlan] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState<string | null>(null);

  useEffect(() => {
    // Fetch plans and current subscription
    fetchPlans();
    fetchCurrentSubscription();
  }, []);

  const fetchPlans = async () => {
    try {
      const response = await fetch("/api/billing/plans");
      const data = await response.json();
      // Mark Pro Annual as popular
      const plansWithPopular = data.plans.map((plan: Plan) => ({
        ...plan,
        isPopular: plan.handle === "pro-annual",
      }));
      setPlans(plansWithPopular);
    } catch (error) {
      console.error("Failed to fetch plans:", error);
      toast.error("Failed to load pricing plans");
    } finally {
      setLoading(false);
    }
  };

  const fetchCurrentSubscription = async () => {
    try {
      const shop = new URLSearchParams(window.location.search).get("shop");
      if (!shop) return;

      const response = await fetch(`/api/billing/subscription?shop=${shop}`);
      const data = await response.json();
      if (data.hasActiveSubscription && !data.isFree) {
        setCurrentPlan(data.plan.handle);
      } else if (data.isFree) {
        setCurrentPlan("free");
      }
    } catch (error) {
      console.error("Failed to fetch subscription:", error);
    }
  };

  const handleSelectPlan = async (planHandle: string) => {
    try {
      setSubscribing(planHandle);
      const shop = new URLSearchParams(window.location.search).get("shop");
      if (!shop) {
        toast.error("Shop parameter is required");
        return;
      }

      const response = await fetch("/api/billing/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shop,
          planHandle,
          returnUrl: window.location.href,
        }),
      });

      const data = await response.json();

      if (data.confirmationUrl) {
        // Redirect to Shopify's confirmation page
        window.location.href = data.confirmationUrl;
      } else if (data.isFree) {
        // Free plan - no confirmation needed
        toast.success("Free plan activated!");
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      } else {
        toast.error("Failed to create subscription");
      }
    } catch (error) {
      console.error("Failed to subscribe:", error);
      toast.error("Failed to subscribe. Please try again.");
    } finally {
      setSubscribing(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted py-12">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">Choose Your Plan</h1>
          <p className="text-xl text-muted-foreground">
            Select the perfect plan for your store
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {plans.map((plan) => {
            const isCurrentPlan = currentPlan === plan.handle;
            const displayPrice = plan.monthlyEquivalent 
              ? plan.monthlyEquivalent 
              : plan.price;
            const displayInterval = plan.interval === "ANNUAL" 
              ? "month" 
              : plan.interval === "EVERY_30_DAYS" 
              ? "month" 
              : "year";
            const annualNote = plan.interval === "ANNUAL" 
              ? `Billed $${plan.price}/year` 
              : null;

            return (
              <Card
                key={plan.handle}
                className={`relative ${
                  plan.isPopular ? "border-primary shadow-lg scale-105" : ""
                }`}
              >
                {plan.isPopular && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
                    Most Popular
                  </Badge>
                )}
                {isCurrentPlan && (
                  <Badge className="absolute -top-3 right-4 bg-success">
                    Current Plan
                  </Badge>
                )}
                <CardHeader>
                  <CardTitle>{plan.name}</CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                  <div className="mt-4">
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-bold">
                        ${displayPrice}
                      </span>
                      <span className="text-muted-foreground">/{displayInterval}</span>
                    </div>
                    {annualNote && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {annualNote}
                      </p>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3 mb-6">
                    {plan.features.map((feature, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <Check className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    className="w-full"
                    variant={plan.isPopular ? "default" : "outline"}
                    onClick={() => handleSelectPlan(plan.handle)}
                    disabled={isCurrentPlan || subscribing === plan.handle}
                  >
                    {subscribing === plan.handle ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : isCurrentPlan ? (
                      "Current Plan"
                    ) : plan.price === 0 ? (
                      "Get Started"
                    ) : (
                      "Select Plan"
                    )}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Pricing;

