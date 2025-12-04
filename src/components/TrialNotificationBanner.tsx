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
import { AlertTriangle, X, CreditCard } from "lucide-react";
import { toast } from "sonner";

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

  return (
    <Alert
      className={`mb-4 border-l-4 ${
        isUrgent
          ? "border-red-500 bg-red-50 dark:bg-red-950"
          : isWarning
          ? "border-yellow-500 bg-yellow-50 dark:bg-yellow-950"
          : "border-blue-500 bg-blue-50 dark:bg-blue-950"
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3 flex-1">
          <AlertTriangle
            className={`h-5 w-5 mt-0.5 ${
              isUrgent ? "text-red-600" : isWarning ? "text-yellow-600" : "text-blue-600"
            }`}
          />
          <div className="flex-1">
            <AlertTitle className="font-semibold mb-1">{notification.title}</AlertTitle>
            <AlertDescription className="text-sm mb-3">
              {notification.message}
            </AlertDescription>
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                onClick={handleApprove}
                disabled={loading}
                size="sm"
                className={`${
                  isUrgent
                    ? "bg-red-600 hover:bg-red-700"
                    : isWarning
                    ? "bg-yellow-600 hover:bg-yellow-700"
                    : "bg-blue-600 hover:bg-blue-700"
                } text-white`}
              >
                <CreditCard className="h-4 w-4 mr-2" />
                {loading
                  ? t("trialNotification.approving") || "Approving..."
                  : notification.action.label}
              </Button>
              <Button
                onClick={handleDismiss}
                variant="ghost"
                size="sm"
                className="text-gray-600 hover:text-gray-800"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Alert>
  );
};

export default TrialNotificationBanner;

