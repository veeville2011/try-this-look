import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Loader2, Calendar, CreditCard, X, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useShop } from "@/providers/AppBridgeProvider";
import { redirectToPlanSelection } from "@/utils/managedPricing";
import { useSubscription } from "@/hooks/useSubscription";

interface SubscriptionManagementProps {
  onSubscriptionUpdate?: () => void;
}

const SubscriptionManagement = ({
  onSubscriptionUpdate,
}: SubscriptionManagementProps) => {
  const shop = useShop();
  const { subscription, loading, refresh } = useSubscription();
  const [cancelling, setCancelling] = useState(false);
  const [changingPlan, setChangingPlan] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refresh();
      if (onSubscriptionUpdate) {
        onSubscriptionUpdate();
      }
      toast.success("Statut de l'abonnement mis à jour");
    } catch (error) {
      toast.error("Échec de la mise à jour du statut de l'abonnement");
    } finally {
      setRefreshing(false);
    }
  };

  const handleCancel = async () => {
    try {
      setCancelling(true);

      // Get shop from App Bridge hook or URL params (fallback)
      const shopDomain =
        shop || new URLSearchParams(window.location.search).get("shop");
      if (!shopDomain) {
        toast.error("Le paramètre shop est requis");
        setCancelling(false);
        return;
      }

      // With Managed App Pricing, cancellations are handled through Shopify's admin interface
      // Redirect to the plan selection page where users can cancel their subscription
      console.log("[MANAGED_PRICING] Redirecting to plan selection for cancellation", {
        shopDomain,
      });

      redirectToPlanSelection(shopDomain);
      
      // Note: User will be redirected to Shopify, so we don't need to update state here
      // The webhook will update the subscription status when cancellation is processed
    } catch (error) {
      console.error("[MANAGED_PRICING] Error redirecting to plan selection", {
        error: error instanceof Error ? error.message : String(error),
      });
      toast.error("Échec de la redirection vers la sélection de plan. Veuillez réessayer.");
    } finally {
      setCancelling(false);
    }
  };

  const handleChangePlan = async (newPlanHandle: string) => {
    try {
      setChangingPlan(true);

      // Get shop from App Bridge hook or URL params (fallback)
      const shopDomain =
        shop || new URLSearchParams(window.location.search).get("shop");
      if (!shopDomain) {
        toast.error("Le paramètre shop est requis");
        setChangingPlan(false);
        return;
      }

      // With Managed App Pricing, Shopify hosts the plan selection page
      // We redirect directly to Shopify's plan selection page
      // The merchant can change their plan there, and Shopify handles the billing
      console.log("[MANAGED_PRICING] Redirecting to plan selection for plan change", {
        shopDomain,
        newPlanHandle,
      });

      redirectToPlanSelection(shopDomain);
    } catch (error) {
      console.error("[MANAGED_PRICING] Error redirecting to plan selection", {
        error: error instanceof Error ? error.message : String(error),
      });
      toast.error("Échec de la redirection vers la sélection de plan. Veuillez réessayer.");
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
          <p className="text-muted-foreground">
            Impossible de charger les informations d'abonnement
          </p>
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
    const statusMap: Record<
      string,
      {
        label: string;
        variant: "default" | "secondary" | "destructive" | "outline";
      }
    > = {
      ACTIVE: { label: "Actif", variant: "default" },
      PENDING: { label: "En attente", variant: "secondary" },
      DECLINED: { label: "Refusé", variant: "destructive" },
      CANCELLED: { label: "Annulé", variant: "outline" },
      EXPIRED: { label: "Expiré", variant: "destructive" },
      FROZEN: { label: "Gelé", variant: "secondary" },
    };

    const statusInfo = statusMap[status] || {
      label: status,
      variant: "outline",
    };
    return <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Abonnement actuel</CardTitle>
              <CardDescription>
                Gérez votre abonnement et la facturation
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing || loading}
              aria-label="Actualiser le statut de l'abonnement"
            >
              <RefreshCw
                className={`w-4 h-4 mr-2 ${refreshing || loading ? "animate-spin" : ""}`}
              />
              Actualiser
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Current Plan Info */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">
                  {subscription.plan.name}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {subscription.plan.description}
                </p>
              </div>
              {subscription.subscription &&
                getStatusBadge(subscription.subscription.status)}
            </div>

            {subscription.subscription && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Prochaine date de facturation</p>
                    <p className="text-sm text-muted-foreground">
                      {formatDate(subscription.subscription.currentPeriodEnd)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Prix</p>
                    <p className="text-sm text-muted-foreground">
                      {subscription.plan.interval === "ANNUAL" &&
                      (subscription.plan as any).monthlyEquivalent
                        ? `${
                            (subscription.plan as any).monthlyEquivalent
                          } €/mois`
                        : `${subscription.plan.price} €${
                            subscription.plan.interval === "EVERY_30_DAYS"
                              ? "/mois"
                              : subscription.plan.interval === "ANNUAL"
                              ? "/an"
                              : ""
                          }`}
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
            {subscription.plan.features &&
              subscription.plan.features.length > 0 && (
                <div className="pt-4 border-t">
                  <h4 className="text-sm font-semibold mb-2">Fonctionnalités du plan</h4>
                  <ul className="space-y-2">
                    {subscription.plan.features.map((feature, index) => (
                      <li
                        key={index}
                        className="text-sm text-muted-foreground flex items-start gap-2"
                      >
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
                {/* Cancel Subscription */}
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" disabled={cancelling}>
                      <X className="w-4 h-4 mr-2" />
                      Annuler l'abonnement
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Annuler l'abonnement</AlertDialogTitle>
                      <AlertDialogDescription>
                        Vous serez redirigé vers l'administration Shopify pour annuler votre abonnement.
                        Vous perdrez l'accès aux fonctionnalités Pro à la fin de votre période de facturation.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Conserver l'abonnement</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleCancel}
                        className="bg-destructive text-destructive-foreground"
                        disabled={cancelling}
                      >
                        {cancelling ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Redirection en cours...
                          </>
                        ) : (
                          "Annuler l'abonnement"
                        )}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            )}

            {subscription.isFree && (
              <Button
                onClick={() =>
                  (window.location.href =
                    "/?shop=" +
                    new URLSearchParams(window.location.search).get("shop"))
                }
              >
                Passer à Pro
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SubscriptionManagement;
