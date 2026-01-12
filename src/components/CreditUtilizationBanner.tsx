/**
 * Credit Utilization Banner Component
 * 
 * Displays a banner when credit utilization reaches 80%, 90%, or 100%
 * Uses the same logic as email notifications for credit utilization warnings
 */

import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useCredits } from "@/hooks/useCredits";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { RadialProgress } from "@/components/ui/radial-progress";
import { AlertTriangle, X, CreditCard, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface CreditUtilizationBannerProps {
  onDismiss?: () => void;
}

const UTILIZATION_THRESHOLDS = [80, 90, 100];

const CreditUtilizationBanner = ({ onDismiss }: CreditUtilizationBannerProps) => {
  const { t } = useTranslation();
  const { credits, loading } = useCredits();
  const [dismissed, setDismissed] = useState(false);

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

  const handleDismiss = () => {
    setDismissed(true);
    if (onDismiss) {
      onDismiss();
    }
  };

  // Don't show if loading, no credits, no utilization info, or dismissed
  if (loading || !credits || !utilizationInfo || dismissed) {
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

  const title = isUrgent
    ? t("credits.utilizationBanner.title100", "⚠️ Credits Fully Utilized")
    : isWarning
    ? t("credits.utilizationBanner.title90", "⚠️ Credits Running Low")
    : t("credits.utilizationBanner.title80", "Credits Utilization Alert");

  const message = isUrgent
    ? creditsRemaining > 0
      ? t("credits.utilizationBanner.message100WithRemaining", { 
          used: creditsUsed, 
          total: creditsTotal,
          remaining: creditsRemaining,
          defaultValue: `You've used all ${creditsUsed} of your ${creditsTotal} credits. You have ${creditsRemaining} credits remaining from other sources.`
        })
      : t("credits.utilizationBanner.message100", { 
          used: creditsUsed, 
          total: creditsTotal,
          defaultValue: `You've used all ${creditsUsed} of your ${creditsTotal} credits. Please purchase more credits to continue.`
        })
    : isWarning
    ? t("credits.utilizationBanner.message90", { 
        used: creditsUsed, 
        total: creditsTotal,
        remaining: creditsRemaining,
        percentage: utilizationPercentage,
        defaultValue: `You've used ${creditsUsed} of ${creditsTotal} credits (${utilizationPercentage}%). Only ${creditsRemaining} credits remaining. Consider purchasing more credits soon.`
      })
    : t("credits.utilizationBanner.message80", { 
        used: creditsUsed, 
        total: creditsTotal,
        remaining: creditsRemaining,
        percentage: utilizationPercentage,
        defaultValue: `You've used ${creditsUsed} of ${creditsTotal} credits (${utilizationPercentage}%). ${creditsRemaining} credits remaining.`
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
            <AlertDescription className="text-sm mb-4 leading-relaxed">
              {message}
            </AlertDescription>
            
            {/* Radial Progress Indicator */}
            <div className="mb-4 flex items-center gap-4">
              <div className="flex-shrink-0">
                <RadialProgress
                  value={utilizationPercentage}
                  max={100}
                  size="md"
                  color={isUrgent ? "destructive" : isWarning ? "warning" : "primary"}
                  showLabel={true}
                  aria-label={`${utilizationPercentage}% credit utilization`}
                />
              </div>
              <div className="flex-1 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <TrendingUp className="h-3.5 w-3.5" />
                    {t("credits.utilizationBanner.utilization", "Credit Utilization")}
                  </span>
                  <span className={cn(
                    "font-bold",
                    isUrgent ? "text-red-600 dark:text-red-400" : isWarning ? "text-yellow-600 dark:text-yellow-400" : "text-blue-600 dark:text-blue-400"
                  )}>
                    {utilizationPercentage}%
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="flex flex-col items-center justify-center p-2 rounded-md bg-muted/50">
                    <span className="text-muted-foreground mb-1">{t("credits.balanceCard.totalCredited", "Credited")}</span>
                    <span className="font-semibold text-foreground">{creditsTotal.toLocaleString()}</span>
                  </div>
                  <div className="flex flex-col items-center justify-center p-2 rounded-md bg-muted/50">
                    <span className="text-muted-foreground mb-1">{t("credits.balanceCard.used", "Used")}</span>
                    <span className="font-semibold text-foreground">{creditsUsed.toLocaleString()}</span>
                  </div>
                  <div className="flex flex-col items-center justify-center p-2 rounded-md bg-muted/50">
                    <span className="text-muted-foreground mb-1">{t("credits.balanceCard.balance", "Remaining")}</span>
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

            {/* Action buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                onClick={() => {
                  // Trigger pricing modal by dispatching a custom event
                  // The Index component will listen for this event
                  window.dispatchEvent(new CustomEvent('openPricingModal'));
                }}
                size="sm"
                className={cn(
                  "text-white font-medium",
                  isUrgent
                    ? "bg-red-600 hover:bg-red-700 focus-visible:ring-red-500"
                    : isWarning
                    ? "bg-yellow-600 hover:bg-yellow-700 focus-visible:ring-yellow-500"
                    : "bg-blue-600 hover:bg-blue-700 focus-visible:ring-blue-500"
                )}
                aria-label={t("credits.utilizationBanner.viewPricing", "View pricing options")}
              >
                <CreditCard className="h-4 w-4 mr-2" aria-hidden="true" />
                {t("credits.utilizationBanner.viewPricing", "View Pricing")}
              </Button>
              <Button
                onClick={handleDismiss}
                size="sm"
                className="bg-transparent hover:bg-accent text-muted-foreground hover:text-foreground border-0 shadow-none"
                aria-label={t("common.close", "Dismiss banner")}
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Alert>
  );
};

export default CreditUtilizationBanner;

