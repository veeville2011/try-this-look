/**
 * Quick Status Card Component
 * Shows at-a-glance overview of subscription and setup status
 */

import { useShop } from "@/providers/AppBridgeProvider";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, AlertCircle, Crown, Zap } from "lucide-react";
import { useEffect, useState } from "react";

interface SubscriptionStatus {
  hasActiveSubscription: boolean;
  isFree: boolean;
  plan: {
    handle: string;
    name: string;
  };
}

interface QuickStatusCardProps {
  currentPlan: string | null;
  onViewDetails?: () => void;
}

const QuickStatusCard = ({ currentPlan, onViewDetails }: QuickStatusCardProps) => {
  const shop = useShop();
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStatus();
  }, [shop, currentPlan]);

  const fetchStatus = async () => {
    try {
      const shopDomain =
        shop || new URLSearchParams(window.location.search).get("shop");

      if (!shopDomain) {
        setLoading(false);
        return;
      }

      const response = await fetch(`/api/billing/subscription?shop=${shopDomain}`);
      if (response.ok) {
        const data = await response.json();
        setSubscriptionStatus(data);
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error("[QuickStatusCard] Failed to fetch status:", error);
      }
    } finally {
      setLoading(false);
    }
  };

  const getPlanBadge = () => {
    if (!currentPlan || currentPlan === "free") {
      return (
        <Badge variant="outline" className="gap-1.5">
          <Zap className="w-3 h-3" />
          Free Plan
        </Badge>
      );
    }

    if (currentPlan === "pro") {
      return (
        <Badge className="gap-1.5 bg-primary">
          <Crown className="w-3 h-3" />
          Pro Monthly
        </Badge>
      );
    }

    if (currentPlan === "pro-annual") {
      return (
        <Badge className="gap-1.5 bg-primary">
          <Crown className="w-3 h-3" />
          Pro Annual
        </Badge>
      );
    }

    return null;
  };

  const getSetupStatus = () => {
    // TODO: Implement actual setup status check
    // For now, return a default status
    return {
      completed: false,
      stepsCompleted: 0,
      totalSteps: 4,
    };
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

  const setupStatus = getSetupStatus();

  return (
    <Card className="border-2 border-border shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="p-4 sm:p-6">
        <div className="space-y-4">
          {/* Subscription Status */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">
                Subscription:
              </span>
              {getPlanBadge()}
            </div>
            {onViewDetails && (
              <button
                onClick={onViewDetails}
                className="text-sm text-primary hover:underline"
                aria-label="View subscription details"
              >
                View Details
              </button>
            )}
          </div>

          {/* Setup Progress */}
          <div className="space-y-2 pt-2 border-t border-border">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">
                Setup Progress:
              </span>
              <span className="text-sm font-semibold text-foreground">
                {setupStatus.stepsCompleted}/{setupStatus.totalSteps} steps
              </span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div
                className="bg-primary h-2 rounded-full transition-all duration-300"
                style={{
                  width: `${(setupStatus.stepsCompleted / setupStatus.totalSteps) * 100}%`,
                }}
              />
            </div>
            {setupStatus.completed ? (
              <div className="flex items-center gap-2 text-sm text-success">
                <CheckCircle2 className="w-4 h-4" />
                <span>Setup Complete!</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="w-4 h-4" />
                <span>Continue setup below</span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default QuickStatusCard;

