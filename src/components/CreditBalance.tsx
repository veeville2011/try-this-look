import { useCredits, CreditBalance as CreditBalanceType } from "@/hooks/useCredits";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { 
  CreditCard, 
  Zap, 
  AlertCircle, 
  TrendingUp, 
  Calendar,
  Sparkles,
  Gift,
  ShoppingBag,
  Coins,
  Info
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

interface CreditBalanceProps {
  variant?: "standalone" | "embedded";
}

const CreditBalance = ({ variant = "standalone" }: CreditBalanceProps) => {
  const { t, i18n } = useTranslation();
  const { credits, loading, error, refresh } = useCredits();

  if (loading) {
    const LoadingWrapper = variant === "embedded" ? "div" : Card;
    const loadingWrapperProps = variant === "embedded" 
      ? { className: "space-y-2" }
      : { className: "border-2 border-border shadow-lg" };
    
    return (
      <LoadingWrapper {...loadingWrapperProps}>
        {variant === "standalone" && (
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
              <span>{t("credits.balanceCard.loading")}</span>
            </CardTitle>
          </CardHeader>
        )}
        {variant === "standalone" ? (
          <CardContent>
            <div className="text-sm text-muted-foreground">{t("credits.balanceCard.fetching")}</div>
          </CardContent>
        ) : (
          <div className="text-sm text-muted-foreground">{t("credits.balanceCard.fetching")}</div>
        )}
      </LoadingWrapper>
    );
  }

  if (error || !credits) {
    const ErrorWrapper = variant === "embedded" ? "div" : Card;
    const errorWrapperProps = variant === "embedded" 
      ? { className: "space-y-2" }
      : { className: "border-2 border-destructive/20" };
    
    return (
      <ErrorWrapper {...errorWrapperProps}>
        {variant === "standalone" && (
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              {t("credits.balanceCard.error")}
            </CardTitle>
          </CardHeader>
        )}
        {variant === "standalone" ? (
          <CardContent>
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {error || t("credits.balanceCard.errorMessage")}
              </AlertDescription>
            </Alert>
          </CardContent>
        ) : (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {error || t("credits.balanceCard.errorMessage")}
            </AlertDescription>
          </Alert>
        )}
      </ErrorWrapper>
    );
  }

  // Use new structure if available, fallback to legacy
  const totalBalance = credits.total_balance ?? credits.balance ?? 0;
  const totalCredited = credits.total_credited ?? credits.included ?? 0;
  const totalUsed = credits.total_used ?? credits.used ?? 0;
  
  const usagePercentage = totalCredited > 0 
    ? Math.min((totalUsed / totalCredited) * 100, 100)
    : 0;
  
  const isLow = totalBalance <= 20 && totalBalance > 0;
  const isExhausted = totalBalance === 0;
  const isOverage = credits.isOverage;
  
  // Check if in trial period - don't show Active badge during trial
  const subscriptionStatus = credits.subscription?.status?.toUpperCase();
  const isInTrial = subscriptionStatus === "TRIAL" || 
                    (subscriptionStatus === "ACTIVE" && credits.creditTypes?.trial?.balance > 0);

  // Format period end date using current language
  const periodEndDate = credits.periodEnd 
    ? new Date(credits.periodEnd).toLocaleDateString(
        i18n.language === "fr" ? "fr-FR" : "en-US", 
        { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        }
      )
    : null;

  const content = (
    <div className="space-y-6">
        {/* Main Balance Display */}
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50 border border-border">
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">
                {t("credits.balanceCard.availableCredits")}
              </p>
              <p className={cn(
                "text-4xl font-bold transition-colors",
                isExhausted ? "text-destructive" : isLow ? "text-warning" : "text-primary"
              )}>
                {totalBalance.toLocaleString()}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-muted-foreground mb-1">
                {t("credits.balanceCard.totalUsed")}
              </p>
              <p className="text-2xl font-semibold text-foreground">
                {totalUsed.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {t("credits.balanceCard.of")} {totalCredited.toLocaleString()}
              </p>
            </div>
          </div>

          {/* Usage Progress Bar */}
          {totalCredited > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground font-medium">{t("credits.balanceCard.usage")}</span>
                <span className="font-semibold text-foreground">
                  {Math.round(usagePercentage)}%
                </span>
              </div>
              <Progress 
                value={usagePercentage} 
                className={cn(
                  "h-3",
                  usagePercentage >= 90 ? "bg-destructive/20" : usagePercentage >= 70 ? "bg-warning/20" : ""
                )}
              />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{totalUsed.toLocaleString()} {t("credits.balanceCard.creditsUsed")}</span>
                <span>{totalCredited.toLocaleString()} {t("credits.balanceCard.totalCredited")}</span>
              </div>
            </div>
          )}
        </div>

        {/* Credit Type Breakdown - Show ALL types */}
        {credits.creditTypes && (
          <>
            <Separator />
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                {t("credits.balanceCard.breakdown")}
              </h4>
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(credits.creditTypes).map(([type, data]) => {
                  const typeConfig = {
                    trial: { icon: Gift, label: t("credits.balanceCard.trial"), color: "text-blue-600", bg: "bg-blue-50", borderColor: "border-blue-200" },
                    coupon: { icon: Sparkles, label: t("credits.balanceCard.coupon"), color: "text-purple-600", bg: "bg-purple-50", borderColor: "border-purple-200" },
                    plan: { icon: Coins, label: t("credits.balanceCard.plan"), color: "text-primary", bg: "bg-primary/10", borderColor: "border-primary/30" },
                    purchased: { icon: ShoppingBag, label: t("credits.balanceCard.purchased"), color: "text-green-600", bg: "bg-green-50", borderColor: "border-green-200" },
                  }[type] || { icon: Coins, label: type, color: "text-muted-foreground", bg: "bg-muted", borderColor: "border-border" };

                  const Icon = typeConfig.icon;
                  const isEmpty = data.credited === 0 && data.balance === 0 && data.used === 0;
                  
                  return (
                    <div 
                      key={type}
                      className={cn(
                        "p-3 rounded-lg border",
                        isEmpty ? "bg-muted/30 border-border/50 opacity-75" : typeConfig.bg,
                        isEmpty ? "" : typeConfig.borderColor
                      )}
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <Icon className={cn("h-4 w-4", typeConfig.color)} />
                        <span className="text-xs font-semibold text-foreground">
                          {typeConfig.label}
                        </span>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">{t("credits.balanceCard.credited")}</span>
                          <span className={cn("font-bold", isEmpty ? "text-muted-foreground" : typeConfig.color)}>
                            {data.credited.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">{t("credits.balanceCard.balance")}</span>
                          <span className={cn("font-semibold", isEmpty ? "text-muted-foreground" : typeConfig.color)}>
                            {data.balance.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">{t("credits.balanceCard.used")}</span>
                          <span className={cn("font-medium", isEmpty ? "text-muted-foreground" : "text-foreground")}>
                            {data.used.toLocaleString()}
                          </span>
                        </div>
                        {data.credited > 0 && (
                          <div className="pt-1 border-t border-border/50">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">{t("credits.balanceCard.usagePercent")}</span>
                              <span className="font-semibold text-foreground">
                                {Math.round((data.used / data.credited) * 100)}%
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* Overage Information - Always show if overage data exists */}
        {credits.overage && (
          <>
            <Separator />
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Zap className="h-4 w-4 text-warning" />
                {t("credits.balanceCard.overageDetails")}
              </h4>
              <div className={cn(
                "p-4 rounded-lg border",
                isOverage ? "bg-warning/10 border-warning/30" : "bg-muted/50 border-border"
              )}>
                <div className="space-y-3">
                  {isOverage && (
                    <div className="flex items-center gap-2 mb-3">
                      <Badge variant="secondary" className="bg-warning/20 text-warning border-warning/30">
                        <Zap className="h-3 w-3 mr-1" />
                        {t("subscription.active")}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {t("credits.balanceCard.overageActive")}
                      </span>
                    </div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-3 rounded bg-background/50 border border-border">
                      <p className="text-xs text-muted-foreground mb-1">{t("credits.balanceCard.overageType")}</p>
                      <p className="text-sm font-semibold text-foreground capitalize">
                        {credits.overage.type.replace('_', ' ')}
                      </p>
                    </div>
                    <div className="p-3 rounded bg-background/50 border border-border">
                      <p className="text-xs text-muted-foreground mb-1">{t("credits.balanceCard.currency")}</p>
                      <p className="text-sm font-semibold text-foreground">
                        {credits.overage.currencyCode}
                      </p>
                    </div>
                    <div className="p-3 rounded bg-background/50 border border-border">
                      <p className="text-xs text-muted-foreground mb-1">{t("credits.balanceCard.overageUsed")}</p>
                      <p className={cn(
                        "text-sm font-bold",
                        isOverage ? "text-warning" : "text-foreground"
                      )}>
                        {credits.overage.balanceUsed.toFixed(2)} {credits.overage.currencyCode}
                      </p>
                    </div>
                    <div className="p-3 rounded bg-background/50 border border-border">
                      <p className="text-xs text-muted-foreground mb-1">{t("credits.balanceCard.cappedAmount")}</p>
                      <p className="text-sm font-semibold text-foreground">
                        {credits.overage.cappedAmount.toFixed(2)} {credits.overage.currencyCode}
                      </p>
                    </div>
                    <div className="p-3 rounded bg-background/50 border border-border sm:col-span-2">
                      <p className="text-xs text-muted-foreground mb-1">{t("credits.balanceCard.remainingBudget")}</p>
                      <p className={cn(
                        "text-lg font-bold",
                        credits.overage.remaining > 0 ? "text-success" : "text-destructive"
                      )}>
                        {credits.overage.remaining.toFixed(2)} {credits.overage.currencyCode}
                      </p>
                      {credits.overage.remaining > 0 && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {((credits.overage.remaining / credits.overage.cappedAmount) * 100).toFixed(1)}% {t("credits.balanceCard.ofCappedRemaining")}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Subscription Info */}
        {credits.subscription && (
          <>
            <Separator />
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                {t("credits.balanceCard.subscriptionDetails")}
              </h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="p-2 rounded bg-muted/50">
                  <p className="text-xs text-muted-foreground mb-1">{t("credits.balanceCard.interval")}</p>
                  <p className="font-medium text-foreground">
                    {credits.subscription.isMonthly ? t("planSelection.monthly") : credits.subscription.isAnnual ? t("planSelection.annual") : credits.subscription.interval}
                  </p>
                </div>
                <div className="p-2 rounded bg-muted/50">
                  <p className="text-xs text-muted-foreground mb-1">{t("credits.balanceCard.status")}</p>
                  <p className="font-medium text-foreground capitalize">
                    {credits.subscription.status.toLowerCase() === "active" ? t("subscription.active") : 
                     credits.subscription.status.toLowerCase() === "trial" ? t("subscription.trial") :
                     credits.subscription.status.toLowerCase()}
                  </p>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Alerts */}
        {isExhausted && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <p className="font-semibold mb-1">{t("credits.balanceCard.noCreditsRemaining")}</p>
              <p className="text-sm">
                {isOverage 
                  ? t("credits.balanceCard.overageActiveMessage")
                  : credits.canPurchase
                  ? t("credits.balanceCard.purchaseCreditsMessage")
                  : t("credits.balanceCard.contactSupportMessage")}
              </p>
            </AlertDescription>
          </Alert>
        )}

        {isLow && !isExhausted && (
          <Alert className="bg-warning/10 border-warning/30">
            <AlertCircle className="h-4 w-4 text-warning" />
            <AlertDescription>
              <p className="font-semibold text-foreground mb-1">{t("credits.balanceCard.lowCreditsRemaining")}</p>
              <p className="text-sm text-muted-foreground">
                {t("credits.balanceCard.lowCreditsMessage", { count: totalBalance })}
              </p>
            </AlertDescription>
          </Alert>
        )}
    </div>
  );

  if (variant === "embedded") {
    return content;
  }

  return (
    <Card className="border-2 border-border shadow-lg bg-gradient-to-br from-card to-card/95">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <CreditCard className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-xl font-bold text-foreground">
                {t("credits.balanceCard.title")}
              </CardTitle>
              <CardDescription className="mt-1">
                {periodEndDate ? (
                  <span className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" />
                    {t("credits.balanceCard.periodEnds")} {periodEndDate}
                  </span>
                ) : (
                  t("credits.balanceCard.currentPeriod")
                )}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isOverage && (
              <Badge variant="secondary" className="bg-warning/20 text-warning border-warning/30">
                <Zap className="h-3 w-3 mr-1" />
                Overage
              </Badge>
            )}
            {/* Only show Active badge if subscription is ACTIVE and NOT in trial */}
            {credits.subscription?.status === "ACTIVE" && !isInTrial && (
              <Badge variant="default" className="bg-success/20 text-success border-success/30">
                <Sparkles className="h-3 w-3 mr-1" />
                {t("subscription.active")}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {content}
      </CardContent>
    </Card>
  );
};

export default CreditBalance;
