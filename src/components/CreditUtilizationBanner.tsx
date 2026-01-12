/**
 * Credit Utilization Banner Component
 * 
 * Displays a banner when credit utilization reaches 80%, 90%, or 100%
 * Uses the same logic as email notifications for credit utilization warnings
 */

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useCredits } from "@/hooks/useCredits";
import { useSubscription } from "@/hooks/useSubscription";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { RadialProgress } from "@/components/ui/radial-progress";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

const UTILIZATION_THRESHOLDS = [80, 90, 100];

const CreditUtilizationBanner = () => {
  const { t } = useTranslation();
  const { credits, loading } = useCredits();
  const { subscription } = useSubscription();

  const utilizationInfo = useMemo(() => {
    if (!credits || loading) return null;

    const totalCredited = credits.total_credited ?? credits.included ?? 0;
    const totalUsed = credits.total_used ?? credits.used ?? 0;
    const totalBalance = credits.total_balance ?? credits.balance ?? 0;

    // Calculate utilization percentage
    const utilizationPercentage = totalCredited > 0 
      ? Math.min((totalUsed / totalCredited) * 100, 100)
      : 0;

    // Find the highest threshold that has been reached
    let reachedThreshold: number | null = null;
    for (const threshold of UTILIZATION_THRESHOLDS) {
      if (utilizationPercentage >= threshold) {
        reachedThreshold = threshold;
      }
    }

    // Only show banner if we've reached at least 80% utilization
    if (!reachedThreshold || reachedThreshold < 80) {
      return null;
    }

    const isUrgent = reachedThreshold >= 100;
    const isWarning = reachedThreshold >= 90;

    return {
      threshold: reachedThreshold,
      utilizationPercentage: Math.round(utilizationPercentage),
      creditsUsed: totalUsed,
      creditsTotal: totalCredited,
      creditsRemaining: totalBalance,
      isUrgent,
      isWarning,
    };
  }, [credits, loading]);

  // Don't show if loading, no credits, or no utilization info
  if (loading || !credits || !utilizationInfo) {
    return null;
  }

  const { threshold, utilizationPercentage, creditsUsed, creditsTotal, creditsRemaining, isUrgent, isWarning } = utilizationInfo;

  // Determine banner styling based on urgency
  const borderColor = isUrgent 
    ? "border-l-red-500 bg-red-50 dark:bg-red-950/20" 
    : isWarning 
    ? "border-l-yellow-500 bg-yellow-50 dark:bg-yellow-950/20"
    : "border-l-blue-500 bg-blue-50 dark:bg-blue-950/20";
  
  const iconColor = isUrgent 
    ? "text-red-600 dark:text-red-400" 
    : isWarning 
    ? "text-yellow-600 dark:text-yellow-400"
    : "text-blue-600 dark:text-blue-400";

  // Get overage price from subscription plan (varies by plan: Free $0.50, Starter $0.40, Growth $0.35, Pro $0.30)
  const getOveragePrice = () => {
    if (!subscription?.plan?.limits?.costPerGeneration) {
      return "$0.50"; // Default to Free plan price
    }
    return `$${subscription.plan.limits.costPerGeneration.toFixed(2)}`;
  };
  const overagePrice = getOveragePrice();

  const title = isUrgent
    ? t("credits.utilizationBanner.title100", "Overage Billing Activated")
    : isWarning
    ? t("credits.utilizationBanner.title90", "Credit Usage Alert")
    : t("credits.utilizationBanner.title80", "Credit Usage Warning");

  const message = isUrgent
    ? creditsRemaining > 0
      ? t("credits.utilizationBanner.message100WithRemaining", { 
          remaining: creditsRemaining,
          defaultValue: "All your allocated credits have been used for this billing period. Overage billing has been automatically activated to ensure uninterrupted service. You have {{remaining}} credits remaining from other sources."
        })
      : t("credits.utilizationBanner.message100", { 
          defaultValue: "All your allocated credits have been used for this billing period. Overage billing has been automatically activated to ensure uninterrupted service."
        })
    : isWarning
    ? t("credits.utilizationBanner.message90", { 
        remaining: creditsRemaining,
        percentage: utilizationPercentage,
        defaultValue: "IMPORTANT: You have used {{percentage}}% of your allocated credits. You only have {{remaining}} credits remaining for this billing period."
      })
    : t("credits.utilizationBanner.message80", { 
        percentage: utilizationPercentage,
        defaultValue: "This is a friendly reminder that you have used {{percentage}}% of your allocated credits for this billing period."
      });

  // Overage note for 80% and 90% thresholds
  const overageNote = isUrgent
    ? null
    : isWarning
    ? t("credits.utilizationBanner.overageNote90", {
        overagePrice,
        defaultValue: "When you reach 100% of your credits, overage billing will be automatically activated at {{overagePrice}} per credit. This ensures uninterrupted service."
      })
    : t("credits.utilizationBanner.overageNote80", {
        overagePrice,
        defaultValue: "If you reach 100% of your credits, overage billing will be automatically activated at {{overagePrice}} per credit."
      });

  return (
    <Alert
      className={cn(
        "mb-6 border-l-4 shadow-md rounded-lg",
        borderColor
      )}
      role="alert"
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4 flex-1 min-w-0">
          <div className="flex-shrink-0 mt-0.5">
            <div className={cn(
              "rounded-full p-2",
              isUrgent ? "bg-red-100 dark:bg-red-950/30" : isWarning ? "bg-yellow-100 dark:bg-yellow-950/30" : "bg-blue-100 dark:bg-blue-950/30"
            )}>
              <AlertTriangle
                className={cn("h-5 w-5", iconColor)}
                aria-hidden="true"
              />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <AlertTitle className="font-semibold mb-2 text-base">
              {title}
            </AlertTitle>
            <AlertDescription className="text-sm mb-3 leading-relaxed">
              <p>{message}</p>
              {overageNote && (
                <p className="mt-2 text-xs text-muted-foreground">
                  {overageNote}
                </p>
              )}
            </AlertDescription>
            
            {/* Simplified Progress and Stats */}
            <div className="mb-3 flex items-center gap-3">
              <RadialProgress
                value={utilizationPercentage}
                max={100}
                size="sm"
                color={isUrgent ? "destructive" : isWarning ? "warning" : "primary"}
                showLabel={true}
                aria-label={`${utilizationPercentage}% utilisation`}
              />
              <div className="flex-1 flex items-center gap-3 text-xs">
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground">{t("credits.balanceCard.used", "Utilisé")}</span>
                  <span className="font-semibold">{creditsUsed.toLocaleString()}</span>
                </div>
                <span className="text-muted-foreground">/</span>
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground">{t("credits.balanceCard.totalCredited", "Crédité")}</span>
                  <span className="font-semibold">{creditsTotal.toLocaleString()}</span>
                </div>
                <span className="text-muted-foreground">•</span>
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground">{t("credits.balanceCard.balance", "Restant")}</span>
                  <span className={cn(
                    "font-semibold",
                    creditsRemaining === 0 ? "text-destructive" : creditsRemaining <= 20 ? "text-yellow-600 dark:text-yellow-400" : "text-success"
                  )}>
                    {creditsRemaining.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </Alert>
  );
};

export default CreditUtilizationBanner;

