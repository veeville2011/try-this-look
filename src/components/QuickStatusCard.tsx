/**
 * Quick Status Card Component
 * Shows at-a-glance overview of subscription and setup status
 */

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Clock, Crown, Zap } from "lucide-react";
import { useSubscription } from "@/hooks/useSubscription";

interface QuickStatusCardProps {
  currentPlan: string | null;
  onViewDetails?: () => void;
  setupProgress?: {
    stepsCompleted: number;
    totalSteps: number;
    completed: boolean;
  };
}

const QuickStatusCard = ({ currentPlan, onViewDetails, setupProgress: propSetupProgress }: QuickStatusCardProps) => {
  const { subscription: subscriptionStatus, loading } = useSubscription();

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

  const getSetupStatus = () => {
    // Use prop if provided, otherwise check subscriptionStatus, otherwise default
    if (propSetupProgress) {
      return propSetupProgress;
    }
    
    if (subscriptionStatus?.setupProgress) {
      return subscriptionStatus.setupProgress;
    }
    
    // If subscriptionStatus exists, we can infer some progress
    // App is installed (step 1) if we have subscription data
    const hasSubscriptionData = !!subscriptionStatus;
    const stepsCompleted = hasSubscriptionData ? 1 : 0;
    const totalSteps = 4;
    
    return {
      completed: stepsCompleted === totalSteps,
      stepsCompleted,
      totalSteps,
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

  const progressPercentage = Math.min(
    (setupStatus.stepsCompleted / setupStatus.totalSteps) * 100,
    100
  );

  return (
    <Card className="border-2 border-border shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="p-4 sm:p-6">
        <div className="space-y-4">
          {/* Plan Name */}
          <div className="flex items-center">
            {getPlanBadge()}
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
            <Progress 
              value={progressPercentage} 
              className="h-2"
            />
            {setupStatus.completed ? (
              <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
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

