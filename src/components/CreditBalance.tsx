import { useCredits, CreditBalance as CreditBalanceType } from "@/hooks/useCredits";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  CreditCard, 
  Zap, 
  AlertCircle, 
  Calendar,
  Sparkles,
  Gift,
  ShoppingBag,
  Coins,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Wallet,
  BarChart3
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RadialProgress } from "@/components/ui/radial-progress";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

interface CreditBalanceProps {
  variant?: "standalone" | "embedded";
}

const CreditBalance = ({ variant = "standalone" }: CreditBalanceProps) => {
  const { t, i18n } = useTranslation();
  const { credits, loading, error, refresh } = useCredits();

  if (loading) {
    return (
      <div
        className={cn(
          "w-full",
          variant === "standalone" ? "border-2 border-border shadow-lg rounded-lg bg-card" : "space-y-2"
        )}
        role="status"
        aria-live="polite"
        aria-label={t("credits.balanceCard.loading") || "Loading credits"}
      >
        {variant === "standalone" && (
          <div className="p-6 border-b border-border">
            <div className="flex items-center justify-between gap-3">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-6 w-24" />
            </div>
            <div className="mt-2">
              <Skeleton className="h-4 w-64" />
            </div>
          </div>
        )}
        <div className={cn(variant === "standalone" ? "p-6" : "")}>
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <Skeleton className="h-5 w-44" />
              <Skeleton className="h-5 w-20" />
            </div>
            <div className="rounded-lg border border-border overflow-hidden">
              <div className="bg-muted/40 border-b border-border px-4 py-3 flex items-center justify-between gap-4">
                <Skeleton className="h-4 w-32" />
                <div className="flex items-center gap-3">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-16" />
                </div>
              </div>
              <div className="divide-y divide-border">
                {[1, 2, 3, 4, 5].map((row) => (
                  <div key={row} className="px-4 py-3 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-8 w-8 rounded-md" />
                      <Skeleton className="h-4 w-28" />
                    </div>
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-4 w-16" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
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

  // Always show the UI for consistency, even if credits is null/undefined
  // This ensures UI consistency regardless of plan type or credit amount
  if (!credits) {
    // Return skeleton/loading state instead of empty message
    return (
      <div className="space-y-6">
        <div className="rounded-lg border border-border bg-card p-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-1">
                {t("credits.balanceCard.totalCredited") || "Total Credited"}
              </p>
              <p className="text-2xl font-bold text-muted-foreground">0</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-1">
                {t("credits.balanceCard.totalUsed") || "Total Used"}
              </p>
              <p className="text-2xl font-bold text-muted-foreground">0</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-1">
                {t("credits.balanceCard.totalBalance") || "Total Balance"}
              </p>
              <p className="text-2xl font-bold text-muted-foreground">0</p>
            </div>
          </div>
        </div>
        {credits?.creditTypes && Object.keys(credits.creditTypes).length > 0 && (
          <div className="rounded-lg border border-border overflow-hidden">
            <div className="bg-muted/40 border-b border-border px-4 py-3">
              <h3 className="text-sm font-semibold text-foreground">
                {t("credits.balanceCard.breakdown") || "Credit Breakdown"}
              </h3>
            </div>
            <div className="p-8 text-center text-sm text-muted-foreground">
              {t("credits.balanceCard.noCreditData") || "No credit data available"}
            </div>
          </div>
        )}
      </div>
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

  // Credit type configuration
  const creditTypeConfig = {
    trial: { 
      icon: Gift, 
      label: t("credits.balanceCard.trial") || "Trial", 
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      borderColor: "border-blue-200"
    },
    coupon: { 
      icon: Sparkles, 
      label: t("credits.balanceCard.coupon") || "Coupon", 
      color: "text-purple-600",
      bgColor: "bg-purple-50",
      borderColor: "border-purple-200"
    },
    plan: { 
      icon: Coins, 
      label: t("credits.balanceCard.plan") || "Plan", 
      color: "text-primary",
      bgColor: "bg-primary/5",
      borderColor: "border-primary/30"
    },
    purchased: { 
      icon: ShoppingBag, 
      label: t("credits.balanceCard.purchased") || "Purchased", 
      color: "text-green-600",
      bgColor: "bg-green-50",
      borderColor: "border-green-200"
    },
  };

  // Filter out empty credit types for display (but still show if at least one has data)
  const hasCreditData = credits.creditTypes && Object.keys(credits.creditTypes).length > 0 && 
    Object.values(credits.creditTypes).some((type: any) => 
      type.credited > 0 || type.balance > 0 || type.used > 0
    );

  // Ensure we always show something if credits exist
  const hasCreditTypes = credits.creditTypes && Object.keys(credits.creditTypes).length > 0;
  const hasOverage = credits.overage && credits.overage.cappedAmount !== undefined;
  
  const content = (
    <div className="space-y-6">
      {/* Summary Card - Always show for UI consistency */}
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-1">
              {t("credits.balanceCard.totalCredited") || "Total Credited"}
            </p>
            <p className={cn(
              "text-2xl font-bold",
              totalCredited === 0 ? "text-muted-foreground" : "text-foreground"
            )}>
              {totalCredited.toLocaleString()}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-1">
              {t("credits.balanceCard.totalUsed") || "Total Used"}
            </p>
            <p className={cn(
              "text-2xl font-bold",
              totalUsed === 0 ? "text-muted-foreground" : "text-foreground"
            )}>
              {totalUsed.toLocaleString()}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-1">
              {t("credits.balanceCard.totalBalance") || "Total Balance"}
            </p>
            <p className={cn(
              "text-2xl font-bold",
              isExhausted ? "text-destructive" : isLow ? "text-warning" : totalBalance === 0 ? "text-muted-foreground" : "text-success"
            )}>
              {totalBalance.toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* Credit Types Table and Overage Table - Side by Side */}
      {/* Always show credit types table if creditTypes exists, even if all values are 0 */}
      {hasCreditTypes && (
        <div className={cn(
          "grid gap-6 items-stretch",
          hasOverage ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1"
        )}>
          {/* Credit Types Table */}
          <div className="space-y-3 flex flex-col h-full">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">
                {t("credits.balanceCard.breakdown") || "Credit Breakdown"}
              </h3>
            </div>
            <div className="rounded-lg border border-border overflow-hidden flex-1 flex flex-col min-h-[400px]">
              <Table className="flex-1">
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-[200px] font-semibold text-xs uppercase tracking-wide">
                      {t("credits.balanceCard.type") || "Type"}
                    </TableHead>
                    <TableHead className="text-center font-semibold text-xs uppercase tracking-wide">
                      {t("credits.balanceCard.credited") || "Credited"}
                    </TableHead>
                    <TableHead className="text-center font-semibold text-xs uppercase tracking-wide">
                      {t("credits.balanceCard.used") || "Used"}
                    </TableHead>
                    <TableHead className="text-center font-semibold text-xs uppercase tracking-wide">
                      {t("credits.balanceCard.balance") || "Balance"}
                    </TableHead>
                    <TableHead className="text-right font-semibold text-xs uppercase tracking-wide">
                      {t("credits.balanceCard.usage") || "Usage"}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(credits.creditTypes).map(([type, data]) => {
                    const config = creditTypeConfig[type as keyof typeof creditTypeConfig] || {
                      icon: Coins,
                      label: type.charAt(0).toUpperCase() + type.slice(1),
                      color: "text-muted-foreground",
                      bgColor: "bg-muted/30",
                      borderColor: "border-border"
                    };
                    const Icon = config.icon;
                    const typeUsagePercentage = data.credited > 0 
                      ? Math.min((data.used / data.credited) * 100, 100) 
                      : 0;
                    const isEmpty = data.credited === 0 && data.balance === 0 && data.used === 0;
                    
                    return (
                      <TableRow 
                        key={type}
                        className={cn(
                          "hover:bg-muted/30 transition-colors",
                          isEmpty && "opacity-60"
                        )}
                      >
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className={cn(
                              "p-1.5 rounded border",
                              config.bgColor,
                              config.borderColor
                            )}>
                              <Icon className={cn("h-3.5 w-3.5", config.color)} />
                            </div>
                            <span className="text-sm font-medium text-foreground">
                              {config.label}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={cn(
                            "text-sm font-semibold",
                            isEmpty ? "text-muted-foreground" : "text-foreground"
                          )}>
                            {data.credited.toLocaleString()}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={cn(
                            "text-sm font-medium",
                            isEmpty ? "text-muted-foreground" : "text-foreground"
                          )}>
                            {data.used.toLocaleString()}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={cn(
                            "text-sm font-semibold",
                            isEmpty 
                              ? "text-muted-foreground" 
                              : data.balance === 0 
                                ? "text-destructive" 
                                : data.balance <= 20 
                                  ? "text-warning" 
                                  : "text-success"
                          )}>
                            {data.balance.toLocaleString()}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end">
                            <RadialProgress
                              value={data.used}
                              max={data.credited > 0 ? data.credited : 1}
                              size="sm"
                              color={
                                isEmpty 
                                  ? "muted" 
                                  : typeUsagePercentage >= 90 
                                    ? "destructive" 
                                    : typeUsagePercentage >= 70 
                                      ? "warning" 
                                      : "primary"
                              }
                              showLabel={true}
                              labelPosition="center"
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {/* Total Row */}
                  <TableRow className="bg-muted/50 border-t-2 border-border font-semibold">
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Coins className="h-4 w-4 text-primary" />
                        <span className="text-sm font-bold text-foreground">
                          {t("credits.balanceCard.totalCredits") || "Total"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={cn(
                        "text-sm font-bold",
                        isExhausted ? "text-destructive" : isLow ? "text-warning" : "text-primary"
                      )}>
                        {totalCredited.toLocaleString()}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="text-sm font-bold text-foreground">
                        {totalUsed.toLocaleString()}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={cn(
                        "text-sm font-bold",
                        isExhausted ? "text-destructive" : isLow ? "text-warning" : "text-success"
                      )}>
                        {totalBalance.toLocaleString()}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end">
                        <RadialProgress
                          value={totalUsed}
                          max={totalCredited > 0 ? totalCredited : 1}
                          size="sm"
                          color={
                            isExhausted 
                              ? "destructive" 
                              : isLow 
                                ? "warning" 
                                : "primary"
                          }
                          showLabel={true}
                          labelPosition="center"
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Overage Information Table */}
          {hasOverage && (
            <div className="space-y-3 flex flex-col h-full">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-warning" />
              <h3 className="text-sm font-semibold text-foreground">
                {t("credits.balanceCard.overageDetails") || "Overage Details"}
              </h3>
              {isOverage && (
                <Badge variant="secondary" className="bg-warning/20 text-warning border-warning/30 text-xs">
                  <Zap className="h-3 w-3 mr-1" />
                  {t("subscription.active") || "Active"}
                </Badge>
              )}
            </div>
            <div className="rounded-lg border border-warning/20 bg-warning/5 overflow-hidden flex-1 flex flex-col min-h-[400px]">
              <Table className="flex-1">
                <TableHeader>
                  <TableRow className="bg-warning/10">
                    <TableHead className="font-semibold text-xs uppercase tracking-wide">
                      {t("credits.balanceCard.metric") || "Metric"}
                    </TableHead>
                    <TableHead className="text-right font-semibold text-xs uppercase tracking-wide">
                      {t("credits.balanceCard.value") || "Value"}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
                        {t("credits.balanceCard.overageType") || "Overage Type"}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-sm font-semibold text-foreground capitalize">
                        {credits.overage.type.replace('_', ' ')}
                      </span>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                        {t("credits.balanceCard.currency") || "Currency"}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-sm font-semibold text-foreground">
                        {credits.overage.currencyCode}
                      </span>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
                        {t("credits.balanceCard.overageUsed") || "Overage Used"}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={cn(
                        "text-sm font-bold",
                        isOverage ? "text-warning" : "text-foreground"
                      )}>
                        {credits.overage.balanceUsed.toFixed(2)} {credits.overage.currencyCode}
                      </span>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Wallet className="h-3.5 w-3.5 text-muted-foreground" />
                        {t("credits.balanceCard.cappedAmount") || "Capped Amount"}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-sm font-semibold text-foreground">
                        {credits.overage.cappedAmount.toFixed(2)} {credits.overage.currencyCode}
                      </span>
                    </TableCell>
                  </TableRow>
                  <TableRow className="bg-muted/30">
                    <TableCell className="font-semibold">
                      <div className="flex items-center gap-2">
                        <Coins className="h-3.5 w-3.5 text-muted-foreground" />
                        {t("credits.balanceCard.remainingBudget") || "Remaining Budget"}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={cn(
                        "text-base font-bold",
                        credits.overage.remaining > 0 ? "text-success" : "text-destructive"
                      )}>
                        {credits.overage.remaining.toFixed(2)} {credits.overage.currencyCode}
                      </span>
                      {credits.overage.remaining > 0 && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {((credits.overage.remaining / credits.overage.cappedAmount) * 100).toFixed(1)}% {t("credits.balanceCard.ofCappedRemaining") || "remaining"}
                        </p>
                      )}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>
        )}
        </div>
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
