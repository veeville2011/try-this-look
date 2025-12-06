import { useCredits, CreditBalance as CreditBalanceType } from "@/hooks/useCredits";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadialProgress } from "@/components/ui/radial-progress";
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
        {/* Main Balance Display with Radial Progress - Enhanced UI */}
        <div className="space-y-4">
          {/* Total Credits Radial Progress - Large */}
          {totalCredited > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-center sm:justify-between gap-6 p-4 sm:p-6 rounded-lg bg-gradient-to-br from-muted/30 to-muted/10 border border-border">
              <div className="flex-1 space-y-2 text-center sm:text-left">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {t("credits.balanceCard.totalCredits")}
                </p>
                <div className="space-y-1">
                  <p className={cn(
                    "text-3xl sm:text-4xl font-bold transition-colors",
                    isExhausted ? "text-destructive" : isLow ? "text-warning" : "text-primary"
                  )}>
                    {totalBalance.toLocaleString()}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {t("credits.balanceCard.of")} {totalCredited.toLocaleString()} {t("credits.balanceCard.available")}
                  </p>
                </div>
                <div className="flex items-center gap-4 pt-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <span className="font-semibold text-foreground">{totalUsed.toLocaleString()}</span>
                    <span>{t("credits.balanceCard.used")}</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="font-semibold text-foreground">{totalCredited.toLocaleString()}</span>
                    <span>{t("credits.balanceCard.totalCredited")}</span>
                  </span>
                </div>
              </div>
              <div className="flex-shrink-0 pb-8">
                <RadialProgress
                  value={totalUsed}
                  max={totalCredited}
                  size="xl"
                  color={isExhausted ? "destructive" : isLow ? "warning" : "primary"}
                  showLabel={true}
                  label={t("credits.balanceCard.usage")}
                  labelPosition="bottom"
                >
                  <div className="flex flex-col items-center justify-center">
                    <span className={cn(
                      "text-2xl sm:text-3xl font-bold leading-none",
                      isExhausted ? "text-destructive" : isLow ? "text-warning" : "text-primary"
                    )}>
                      {Math.round(usagePercentage)}%
                    </span>
                  </div>
                </RadialProgress>
              </div>
            </div>
          )}

          {/* Fallback for when no credits are credited yet */}
          {totalCredited === 0 && (
            <div className="flex items-center justify-between p-4 sm:p-6 rounded-lg bg-muted/30 border border-border">
              <div className="flex-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  {t("credits.balanceCard.availableCredits")}
                </p>
                <p className={cn(
                  "text-3xl sm:text-4xl font-bold transition-colors",
                  isExhausted ? "text-destructive" : isLow ? "text-warning" : "text-primary"
                )}>
                  {totalBalance.toLocaleString()}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs font-medium text-muted-foreground mb-1">
                  {t("credits.balanceCard.totalUsed")}
                </p>
                <p className="text-xl font-semibold text-foreground">
                  {totalUsed.toLocaleString()}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Credit Type Breakdown - Show ALL types with Radial Progress */}
        {credits.creditTypes && (
          <>
            <Separator />
            <div className="space-y-4">
              <h4 className="text-xs font-semibold text-foreground flex items-center gap-2 uppercase tracking-wide">
                <TrendingUp className="h-3.5 w-3.5 text-primary" />
                {t("credits.balanceCard.breakdown")}
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                {Object.entries(credits.creditTypes).map(([type, data]) => {
                  const typeConfig = {
                    trial: { icon: Gift, label: t("credits.balanceCard.trial"), color: "primary", bg: "bg-blue-50/50", borderColor: "border-blue-200" },
                    coupon: { icon: Sparkles, label: t("credits.balanceCard.coupon"), color: "primary", bg: "bg-purple-50/50", borderColor: "border-purple-200" },
                    plan: { icon: Coins, label: t("credits.balanceCard.plan"), color: "primary", bg: "bg-primary/5", borderColor: "border-primary/30" },
                    purchased: { icon: ShoppingBag, label: t("credits.balanceCard.purchased"), color: "success", bg: "bg-green-50/50", borderColor: "border-green-200" },
                  }[type] || { icon: Coins, label: type, color: "muted", bg: "bg-muted/30", borderColor: "border-border" };

                  const Icon = typeConfig.icon;
                  const isEmpty = data.credited === 0 && data.balance === 0 && data.used === 0;
                  const variantUsagePercentage = data.credited > 0 ? Math.min((data.used / data.credited) * 100, 100) : 0;
                  
                  return (
                    <div 
                      key={type}
                      className={cn(
                        "p-4 rounded-lg border transition-all hover:shadow-sm",
                        isEmpty ? "bg-muted/20 border-border/40 opacity-60" : typeConfig.bg,
                        isEmpty ? "" : typeConfig.borderColor
                      )}
                    >
                      <div className="flex items-start gap-3">
                        {/* Small Radial Progress */}
                        <div className="flex-shrink-0">
                          {data.credited > 0 ? (
                            <RadialProgress
                              value={data.used}
                              max={data.credited}
                              size="sm"
                              color={
                                isEmpty 
                                  ? "muted" 
                                  : variantUsagePercentage >= 90 
                                    ? "destructive" 
                                    : variantUsagePercentage >= 70 
                                      ? "warning" 
                                      : type === "purchased" 
                                        ? "success" 
                                        : "primary"
                              }
                              showLabel={true}
                              labelPosition="center"
                            >
                              <span className={cn(
                                "text-[10px] font-bold leading-none",
                                isEmpty 
                                  ? "text-muted-foreground" 
                                  : variantUsagePercentage >= 90 
                                    ? "text-destructive" 
                                    : variantUsagePercentage >= 70 
                                      ? "text-warning" 
                                      : type === "purchased" 
                                        ? "text-success" 
                                        : "text-primary"
                              )}>
                                {Math.round(variantUsagePercentage)}%
                              </span>
                            </RadialProgress>
                          ) : (
                            <div className="w-16 h-16 rounded-full bg-muted/30 border border-border/40 flex items-center justify-center">
                              <Icon className={cn(
                                "h-5 w-5",
                                isEmpty 
                                  ? "text-muted-foreground" 
                                  : type === "purchased" 
                                    ? "text-green-600" 
                                    : "text-primary"
                              )} />
                            </div>
                          )}
                        </div>
                        
                        {/* Details */}
                        <div className="flex-1 min-w-0 space-y-2">
                          <div className="flex items-center gap-1.5">
                            <Icon className={cn(
                              "h-3.5 w-3.5 flex-shrink-0",
                              isEmpty 
                                ? "text-muted-foreground" 
                                : type === "trial" 
                                  ? "text-blue-600" 
                                  : type === "coupon" 
                                    ? "text-purple-600" 
                                    : type === "purchased" 
                                      ? "text-green-600" 
                                      : "text-primary"
                            )} />
                            <span className="text-xs font-semibold text-foreground truncate">
                              {typeConfig.label}
                            </span>
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-xs">
                            <div>
                              <p className="text-muted-foreground mb-0.5">{t("credits.balanceCard.credited")}</p>
                              <p className={cn("font-bold", isEmpty ? "text-muted-foreground" : "text-foreground")}>
                                {data.credited.toLocaleString()}
                              </p>
                            </div>
                            <div>
                              <p className="text-muted-foreground mb-0.5">{t("credits.balanceCard.balance")}</p>
                              <p className={cn("font-semibold", isEmpty ? "text-muted-foreground" : "text-foreground")}>
                                {data.balance.toLocaleString()}
                              </p>
                            </div>
                            <div>
                              <p className="text-muted-foreground mb-0.5">{t("credits.balanceCard.used")}</p>
                              <p className={cn("font-medium", isEmpty ? "text-muted-foreground" : "text-foreground")}>
                                {data.used.toLocaleString()}
                              </p>
                            </div>
                          </div>
                        </div>
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
            <div className="space-y-2.5">
              <h4 className="text-xs font-semibold text-foreground flex items-center gap-2 uppercase tracking-wide">
                <Zap className="h-3.5 w-3.5 text-warning" />
                {t("credits.balanceCard.overageDetails")}
              </h4>
              <div className={cn(
                "p-3 rounded-lg border",
                isOverage ? "bg-warning/10 border-warning/20" : "bg-muted/30 border-border"
              )}>
                <div className="space-y-2.5">
                  {isOverage && (
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="secondary" className="bg-warning/20 text-warning border-warning/30 text-xs px-2 py-0.5">
                        <Zap className="h-3 w-3 mr-1" />
                        {t("subscription.active")}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {t("credits.balanceCard.overageActive")}
                      </span>
                    </div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div className="p-2.5 rounded bg-background/50 border border-border">
                      <p className="text-xs text-muted-foreground mb-1">{t("credits.balanceCard.overageType")}</p>
                      <p className="text-xs font-semibold text-foreground capitalize">
                        {credits.overage.type.replace('_', ' ')}
                      </p>
                    </div>
                    <div className="p-2.5 rounded bg-background/50 border border-border">
                      <p className="text-xs text-muted-foreground mb-1">{t("credits.balanceCard.currency")}</p>
                      <p className="text-xs font-semibold text-foreground">
                        {credits.overage.currencyCode}
                      </p>
                    </div>
                    <div className="p-2.5 rounded bg-background/50 border border-border">
                      <p className="text-xs text-muted-foreground mb-1">{t("credits.balanceCard.overageUsed")}</p>
                      <p className={cn(
                        "text-xs font-bold",
                        isOverage ? "text-warning" : "text-foreground"
                      )}>
                        {credits.overage.balanceUsed.toFixed(2)} {credits.overage.currencyCode}
                      </p>
                    </div>
                    <div className="p-2.5 rounded bg-background/50 border border-border">
                      <p className="text-xs text-muted-foreground mb-1">{t("credits.balanceCard.cappedAmount")}</p>
                      <p className="text-xs font-semibold text-foreground">
                        {credits.overage.cappedAmount.toFixed(2)} {credits.overage.currencyCode}
                      </p>
                    </div>
                    <div className="p-2.5 rounded bg-background/50 border border-border sm:col-span-2">
                      <p className="text-xs text-muted-foreground mb-1">{t("credits.balanceCard.remainingBudget")}</p>
                      <p className={cn(
                        "text-base font-bold",
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

        {/* Subscription Info - Compact Style - Show ALL subscription details */}
        {credits.subscription && (
          <>
            <Separator />
            <div className="space-y-2.5">
              <h4 className="text-xs font-semibold text-foreground flex items-center gap-2 uppercase tracking-wide">
                <Calendar className="h-3.5 w-3.5 text-primary" />
                {t("credits.balanceCard.subscriptionDetails")}
              </h4>
              <div className="grid grid-cols-2 gap-2.5">
                <div className="p-2 rounded bg-muted/30">
                  <p className="text-xs text-muted-foreground mb-1">{t("credits.balanceCard.interval")}</p>
                  <p className="text-xs font-medium text-foreground">
                    {credits.subscription.isMonthly ? t("planSelection.monthly") : credits.subscription.isAnnual ? t("planSelection.annual") : credits.subscription.interval}
                  </p>
                </div>
                <div className="p-2 rounded bg-muted/30">
                  <p className="text-xs text-muted-foreground mb-1">{t("credits.balanceCard.status")}</p>
                  <p className="text-xs font-medium text-foreground capitalize">
                    {credits.subscription.status.toLowerCase() === "active" ? t("subscription.active") : 
                     credits.subscription.status.toLowerCase() === "trial" ? t("subscription.trial") :
                     credits.subscription.status.toLowerCase()}
                  </p>
                </div>
              </div>
              {/* Period Information - Show period end date */}
              {periodEndDate && (
                <div className="p-2 rounded bg-muted/30 border border-border/50">
                  <p className="text-xs text-muted-foreground mb-1">{t("credits.balanceCard.periodEnds") || "Period Ends"}</p>
                  <p className="text-xs font-medium text-foreground">
                    {periodEndDate}
                  </p>
                </div>
              )}
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
