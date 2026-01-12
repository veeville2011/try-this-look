/**
 * Trial Notification Banner Component
 * 
 * Displays notifications when trial credits reach thresholds (80, 90, 95, 100)
 * Allows users to proactively approve subscription replacement
 */

import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useShop } from "@/providers/AppBridgeProvider";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { RadialProgress } from "@/components/ui/radial-progress";
import { AlertTriangle, X, CreditCard, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface TrialNotification {
  type: "urgent" | "warning" | "info";
  title: string;
  message: string;
  action: {
    label: string;
    url: string;
  };
  creditsUsed: number;
  creditsRemaining: number;
  threshold: number;
}

interface TrialNotificationBannerProps {
  onApprovalInitiated?: () => void;
}

const TrialNotificationBanner = ({ onApprovalInitiated }: TrialNotificationBannerProps) => {
  const { t } = useTranslation();
  const shop = useShop();
  const [notification, setNotification] = useState<TrialNotification | null>(null);
  const [loading, setLoading] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const fetchNotification = useCallback(async () => {
    if (!shop || dismissed) return;

    try {
      const appBridge = (window as any).__APP_BRIDGE;
      let fetchFn = fetch;
      let headers: HeadersInit = {
        "Content-Type": "application/json",
        Accept: "application/json",
      };

      if (appBridge) {
        try {
          const { authenticatedFetch } = await import("@shopify/app-bridge-utils");
          fetchFn = authenticatedFetch(appBridge);
        } catch (error) {
          try {
            const { getSessionToken } = await import("@shopify/app-bridge-utils");
            const token = await getSessionToken(appBridge);
            if (token) {
              headers = {
                ...headers,
                Authorization: `Bearer ${token}`,
              };
            }
          } catch (tokenError) {
            // Ignore
          }
        }
      }

      const response = await fetchFn(
        `/api/trial/notifications?shop=${encodeURIComponent(shop)}`,
        {
          method: "GET",
          headers,
          credentials: "same-origin",
        }
      );

      if (!response.ok) {
        return;
      }

      const data = await response.json();
      if (data.hasNotification && data.notification) {
        setNotification(data.notification);
      } else {
        setNotification(null);
      }
    } catch (error) {
      console.error("[TrialNotificationBanner] Failed to fetch notification", error);
    }
  }, [shop, dismissed]);

  useEffect(() => {
    fetchNotification();
    // Poll every 30 seconds for updates
    const interval = setInterval(fetchNotification, 30000);
    return () => clearInterval(interval);
  }, [fetchNotification]);

  const handleApprove = async () => {
    if (!shop) return;

    setLoading(true);
    try {
      const appBridge = (window as any).__APP_BRIDGE;
      let fetchFn = fetch;
      let headers: HeadersInit = {
        "Content-Type": "application/json",
        Accept: "application/json",
      };

      if (appBridge) {
        try {
          const { authenticatedFetch } = await import("@shopify/app-bridge-utils");
          fetchFn = authenticatedFetch(appBridge);
        } catch (error) {
          try {
            const { getSessionToken } = await import("@shopify/app-bridge-utils");
            const token = await getSessionToken(appBridge);
            if (token) {
              headers = {
                ...headers,
                Authorization: `Bearer ${token}`,
              };
            }
          } catch (tokenError) {
            // Ignore
          }
        }
      }

      const response = await fetchFn(
        `/api/billing/approve-trial-replacement`,
        {
          method: "POST",
          headers,
          credentials: "same-origin",
          body: JSON.stringify({ shop }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to approve subscription");
      }

      const data = await response.json();
      
      if (data.confirmationUrl) {
        // Redirect to Shopify approval page
        window.location.href = data.confirmationUrl;
        if (onApprovalInitiated) {
          onApprovalInitiated();
        }
      } else {
        toast.success(t("trialNotification.approvalInitiated") || "Approval initiated successfully");
        // Refresh notification status
        setTimeout(fetchNotification, 2000);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to approve subscription";
      toast.error(errorMessage);
      console.error("[TrialNotificationBanner] Failed to approve", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    setNotification(null);
  };

  if (!notification || dismissed) {
    return null;
  }

  const isUrgent = notification.type === "urgent";
  const isWarning = notification.type === "warning";

  // Calculate utilization percentage (trial credits: 100 total)
  const utilizationPercentage = Math.min((notification.creditsUsed / 100) * 100, 100);

  const borderColor = isUrgent 
    ? "border-l-red-500 bg-red-50 dark:bg-red-950/20 shadow-md" 
    : isWarning 
    ? "border-l-yellow-500 bg-yellow-50 dark:bg-yellow-950/20 shadow-md"
    : "border-l-blue-500 bg-blue-50 dark:bg-blue-950/20 shadow-md";
  
  const iconColor = isUrgent 
    ? "text-red-600 dark:text-red-400" 
    : isWarning 
    ? "text-yellow-600 dark:text-yellow-400"
    : "text-blue-600 dark:text-blue-400";

  return (
    <Alert
      className={cn(
        "mb-4 border-l-4 rounded-lg",
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
              {notification.title}
            </AlertTitle>
            <AlertDescription className="text-sm mb-4 leading-relaxed">
              {notification.message}
            </AlertDescription>
            
            {/* Radial Progress Indicator */}
            <div className="mb-4 flex items-center gap-4">
              <div className="flex-shrink-0">
                <RadialProgress
                  value={notification.creditsUsed}
                  max={100}
                  size="md"
                  color={isUrgent ? "destructive" : isWarning ? "warning" : "primary"}
                  showLabel={true}
                  aria-label={`${utilizationPercentage}% trial credit utilization`}
                />
              </div>
              <div className="flex-1 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <TrendingUp className="h-3.5 w-3.5" />
                    {t("trialNotification.banner.utilization") || "Trial Credit Utilization"}
                  </span>
                  <span className={cn(
                    "font-bold",
                    iconColor
                  )}>
                    {utilizationPercentage}%
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                    <span className="text-muted-foreground">{t("trialNotification.banner.creditsUsed") || "Credits Used"}</span>
                    <span className="font-semibold text-foreground">{notification.creditsUsed.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                    <span className="text-muted-foreground">{t("trialNotification.banner.creditsRemaining") || "Credits Remaining"}</span>
                    <span className={cn(
                      "font-semibold",
                      notification.creditsRemaining === 0 ? "text-destructive" : notification.creditsRemaining <= 10 ? "text-yellow-600 dark:text-yellow-400" : "text-success"
                    )}>
                      {notification.creditsRemaining.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                onClick={handleApprove}
                disabled={loading}
                size="sm"
                className={cn(
                  "text-white font-medium",
                  isUrgent
                    ? "bg-red-600 hover:bg-red-700 focus-visible:ring-red-500"
                    : isWarning
                    ? "bg-yellow-600 hover:bg-yellow-700 focus-visible:ring-yellow-500"
                    : "bg-blue-600 hover:bg-blue-700 focus-visible:ring-blue-500"
                )}
                aria-label={notification.action.label}
              >
                <CreditCard className="h-4 w-4 mr-2" aria-hidden="true" />
                {loading
                  ? t("trialNotification.approving") || "Approving..."
                  : notification.action.label}
              </Button>
              <Button
                onClick={handleDismiss}
                size="sm"
                className="bg-transparent hover:bg-accent text-muted-foreground hover:text-foreground border-0 shadow-none"
                aria-label={t("trialNotification.banner.dismiss") || t("common.close") || "Dismiss banner"}
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

export default TrialNotificationBanner;

