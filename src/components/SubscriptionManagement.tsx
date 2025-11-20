import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Loader2, Calendar, CreditCard, X } from "lucide-react";
import { toast } from "sonner";
import { useShop, useSessionToken } from "@/providers/AppBridgeProvider";

interface SubscriptionStatus {
  hasActiveSubscription: boolean;
  isFree: boolean;
  plan: {
    handle: string;
    name: string;
    price: number;
    interval: string;
    features: string[];
    monthlyEquivalent?: number;
  };
  subscription: {
    id: string;
    status: string;
    currentPeriodEnd: string;
  } | null;
}

interface SubscriptionManagementProps {
  onSubscriptionUpdate?: () => void;
}

const SubscriptionManagement = ({ onSubscriptionUpdate }: SubscriptionManagementProps) => {
  // App Bridge hooks for embedded app
  const shop = useShop();
  const { token: sessionToken } = useSessionToken();

  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [changingPlan, setChangingPlan] = useState(false);

  useEffect(() => {
    fetchSubscription();
  }, [shop, sessionToken]);

  const fetchSubscription = async () => {
    try {
      // Get shop from App Bridge hook or URL params (fallback)
      const shopDomain = shop || new URLSearchParams(window.location.search).get("shop");
      if (!shopDomain) {
        setLoading(false);
        return;
      }

      // Prepare headers with session token if available
      const headers: HeadersInit = {};
      if (sessionToken) {
        headers["Authorization"] = `Bearer ${sessionToken}`;
      }

      const response = await fetch(`/api/billing/subscription?shop=${shopDomain}`, {
        headers,
      });
      const data = await response.json();
      setSubscription(data);
      
      // Notify parent component of subscription update
      if (onSubscriptionUpdate) {
        onSubscriptionUpdate();
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error("Failed to fetch subscription:", error);
      }
      toast.error("Failed to load subscription information");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (prorate: boolean = false) => {
    try {
      setCancelling(true);
      
      // Get shop from App Bridge hook or URL params (fallback)
      const shopDomain = shop || new URLSearchParams(window.location.search).get("shop");
      if (!shopDomain) {
        toast.error("Shop parameter is required");
        return;
      }

      // Prepare headers with session token if available
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (sessionToken) {
        headers["Authorization"] = `Bearer ${sessionToken}`;
      }

      const response = await fetch("/api/billing/cancel", {
        method: "POST",
        headers,
        body: JSON.stringify({
          shop: shopDomain,
          prorate,
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success("Subscription cancelled successfully");
        setTimeout(() => {
          fetchSubscription();
          if (onSubscriptionUpdate) {
            onSubscriptionUpdate();
          }
        }, 1000);
      } else {
        toast.error("Failed to cancel subscription");
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error("Failed to cancel subscription:", error);
      }
      toast.error("Failed to cancel subscription. Please try again.");
    } finally {
      setCancelling(false);
    }
  };

  const handleChangePlan = async (newPlanHandle: string) => {
    try {
      setChangingPlan(true);
      
      // Get shop from App Bridge hook or URL params (fallback)
      const shopDomain = shop || new URLSearchParams(window.location.search).get("shop");
      if (!shopDomain) {
        toast.error("Shop parameter is required");
        return;
      }

      // Prepare headers with session token if available
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (sessionToken) {
        headers["Authorization"] = `Bearer ${sessionToken}`;
      }

      const response = await fetch("/api/billing/change-plan", {
        method: "POST",
        headers,
        body: JSON.stringify({
          planHandle: newPlanHandle,
          returnUrl: window.location.href,
        }),
      });

      const data = await response.json();

      if (data.confirmationUrl) {
        // Redirect to Shopify's confirmation page
        window.location.href = data.confirmationUrl;
      } else {
        toast.error("Failed to change plan", error);
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error("Failed to change plan:", error);
      }
      toast.error("Failed to change plan. Please try again.");
    } finally {
      setChangingPlan(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!subscription) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-muted-foreground">Unable to load subscription information</p>
        </CardContent>
      </Card>
    );
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("fr-FR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      ACTIVE: { label: "Active", variant: "default" },
      PENDING: { label: "Pending", variant: "secondary" },
      DECLINED: { label: "Declined", variant: "destructive" },
      CANCELLED: { label: "Cancelled", variant: "outline" },
      EXPIRED: { label: "Expired", variant: "destructive" },
      FROZEN: { label: "Frozen", variant: "secondary" },
    };

    const statusInfo = statusMap[status] || { label: status, variant: "outline" };
    return (
      <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Current Subscription</CardTitle>
          <CardDescription>Manage your subscription and billing</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Current Plan Info */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">{subscription.plan.name}</h3>
                <p className="text-sm text-muted-foreground">
                  {subscription.plan.description}
                </p>
              </div>
              {subscription.subscription && getStatusBadge(subscription.subscription.status)}
            </div>

            {subscription.subscription && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Next Billing Date</p>
                    <p className="text-sm text-muted-foreground">
                      {formatDate(subscription.subscription.currentPeriodEnd)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Price</p>
                    <p className="text-sm text-muted-foreground">
                      {subscription.plan.interval === "ANNUAL" && (subscription.plan as any).monthlyEquivalent
                        ? `${(subscription.plan as any).monthlyEquivalent} €/mois`
                        : `${subscription.plan.price} €${subscription.plan.interval === "EVERY_30_DAYS" ? "/mois" : subscription.plan.interval === "ANNUAL" ? "/an" : ""}`}
                      {subscription.plan.interval === "ANNUAL" && (
                        <span className="block text-xs text-muted-foreground mt-1">
                          (Facturé {subscription.plan.price} €/an)
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Features */}
            {subscription.plan.features && subscription.plan.features.length > 0 && (
              <div className="pt-4 border-t">
                <h4 className="text-sm font-semibold mb-2">Plan Features</h4>
                <ul className="space-y-2">
                  {subscription.plan.features.map((feature, index) => (
                    <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                      <span className="text-success">✓</span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
            {subscription.hasActiveSubscription && !subscription.isFree && (
              <>
                {/* Change Plan Button */}
                {subscription.plan.handle === "pro" && (
                  <Button
                    variant="outline"
                    onClick={() => handleChangePlan("pro-annual")}
                    disabled={changingPlan}
                  >
                    {changingPlan ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      "Switch to Annual (Save 25%)"
                    )}
                  </Button>
                )}
                {subscription.plan.handle === "pro-annual" && (
                  <Button
                    variant="outline"
                    onClick={() => handleChangePlan("pro")}
                    disabled={changingPlan}
                  >
                    {changingPlan ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      "Switch to Monthly"
                    )}
                  </Button>
                )}

                {/* Cancel Subscription */}
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" disabled={cancelling}>
                      <X className="w-4 h-4 mr-2" />
                      Cancel Subscription
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Cancel Subscription</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to cancel your subscription? You will lose access to Pro features at the end of your billing period.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Keep Subscription</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleCancel(true)}
                        className="bg-destructive text-destructive-foreground"
                        disabled={cancelling}
                      >
                        {cancelling ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Cancelling...
                          </>
                        ) : (
                          "Cancel Subscription"
                        )}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            )}

            {subscription.isFree && (
              <Button
                onClick={() => (window.location.href = "/?shop=" + new URLSearchParams(window.location.search).get("shop"))}
              >
                Upgrade to Pro
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SubscriptionManagement;

