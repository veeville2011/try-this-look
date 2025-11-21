/**
 * Quick Status Card Component
 * Shows at-a-glance overview of subscription and plan features
 */

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Crown, Zap, CreditCard } from "lucide-react";
import { useSubscription } from "@/hooks/useSubscription";
import { useShop } from "@/providers/AppBridgeProvider";
import { redirectToPlanSelection } from "@/utils/managedPricing";

interface QuickStatusCardProps {
  currentPlan: string | null;
  onViewDetails?: () => void;
}

const QuickStatusCard = ({ currentPlan, onViewDetails }: QuickStatusCardProps) => {
  const { subscription: subscriptionStatus, loading } = useSubscription();
  const shop = useShop();

  const handleChangePlan = () => {
    const shopDomain =
      shop || new URLSearchParams(window.location.search).get("shop");
    if (shopDomain) {
      redirectToPlanSelection(shopDomain);
    }
  };

  const getPlanBadge = () => {
    // Use plan from subscriptionStatus if available, otherwise fall back to currentPlan prop
    const planHandle = subscriptionStatus?.plan?.handle || currentPlan;
    
    if (!planHandle || planHandle === "free") {
      return (
        <Badge variant="outline" className="gap-1.5 whitespace-nowrap">
          <Zap className="w-3 h-3" />
          Free Plan
        </Badge>
      );
    }

    if (planHandle === "pro-annual") {
      return (
        <Badge className="gap-1.5 bg-primary whitespace-nowrap">
          <Crown className="w-3 h-3" />
          Pro Annual
        </Badge>
      );
    }

    // Fallback for any other plan handle
    return (
      <Badge className="gap-1.5 bg-primary whitespace-nowrap">
        <Crown className="w-3 h-3" />
        {subscriptionStatus?.plan?.name || "Pro Plan"}
      </Badge>
    );
  };

  if (loading) {
    return (
      <Card className="border-2 border-border">
        <CardContent className="p-4">
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-muted rounded w-1/3"></div>
            <div className="h-4 bg-muted rounded w-2/3"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const planFeatures = subscriptionStatus?.plan?.features || [];
  const planHandle = subscriptionStatus?.plan?.handle || currentPlan;
  const isFreePlan = !planHandle || planHandle === "free";

  return (
    <Card className="border-2 border-border shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="p-4 sm:p-6">
        <div className="space-y-4">
          {/* Plan Name */}
          <div className="flex items-center justify-between">
            {getPlanBadge()}
          </div>

          {/* Plan Features */}
          {planFeatures.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-border">
              <h4 className="text-sm font-semibold text-foreground mb-2">
                Plan Features
              </h4>
              <ul className="space-y-2">
                {planFeatures.map((feature, index) => (
                  <li
                    key={index}
                    className="text-sm text-muted-foreground flex items-start gap-2"
                  >
                    <span className="text-green-600 dark:text-green-400 mt-0.5">✓</span>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Change Plan Button */}
          <div className="pt-2 border-t border-border">
            <Button
              onClick={handleChangePlan}
              variant={isFreePlan ? "default" : "outline"}
              className="w-full"
              size="sm"
            >
              <CreditCard className="w-4 h-4 mr-2" />
              {isFreePlan ? "Upgrade Plan" : "Change Plan"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default QuickStatusCard;

