import { useCredits, CreditBalance as CreditBalanceType } from "@/hooks/useCredits";
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

const CreditBalance = () => {
  const { credits, loading, error, refresh } = useCredits();

  if (loading) {
    return (
      <Card className="border-2 border-border shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
            <span>Loading Credit Balance...</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">Fetching your credit information...</div>
        </CardContent>
      </Card>
    );
  }

  if (error || !credits) {
    return (
      <Card className="border-2 border-destructive/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            Credit Balance Error
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {error || "Failed to load credit balance. Please try again."}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
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

  // Format period end date
  const periodEndDate = credits.periodEnd 
    ? new Date(credits.periodEnd).toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      })
    : null;

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
                Credit Balance
              </CardTitle>
              <CardDescription className="mt-1">
                {periodEndDate ? (
                  <span className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" />
                    Period ends: {periodEndDate}
                  </span>
                ) : (
                  "Current billing period"
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
            {credits.subscription?.status === "ACTIVE" && (
              <Badge variant="default" className="bg-success/20 text-success border-success/30">
                <Sparkles className="h-3 w-3 mr-1" />
                Active
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Main Balance Display */}
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50 border border-border">
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">
                Available Credits
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
                Total Used
              </p>
              <p className="text-2xl font-semibold text-foreground">
                {totalUsed.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                of {totalCredited.toLocaleString()}
              </p>
            </div>
          </div>

          {/* Usage Progress Bar */}
          {totalCredited > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground font-medium">Usage</span>
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
                <span>{totalUsed.toLocaleString()} credits used</span>
                <span>{totalCredited.toLocaleString()} total credited</span>
              </div>
            </div>
          )}
        </div>

        {/* Credit Type Breakdown */}
        {credits.creditTypes && (
          <>
            <Separator />
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                Credit Breakdown
              </h4>
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(credits.creditTypes).map(([type, data]) => {
                  if (data.credited === 0 && data.balance === 0) return null;
                  
                  const typeConfig = {
                    trial: { icon: Gift, label: "Trial", color: "text-blue-600", bg: "bg-blue-50" },
                    coupon: { icon: Sparkles, label: "Coupon", color: "text-purple-600", bg: "bg-purple-50" },
                    plan: { icon: Coins, label: "Plan", color: "text-primary", bg: "bg-primary/10" },
                    purchased: { icon: ShoppingBag, label: "Purchased", color: "text-green-600", bg: "bg-green-50" },
                  }[type] || { icon: Coins, label: type, color: "text-muted-foreground", bg: "bg-muted" };

                  const Icon = typeConfig.icon;
                  
                  return (
                    <div 
                      key={type}
                      className={cn(
                        "p-3 rounded-lg border border-border",
                        typeConfig.bg
                      )}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Icon className={cn("h-4 w-4", typeConfig.color)} />
                        <span className="text-xs font-medium text-foreground">
                          {typeConfig.label}
                        </span>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Balance</span>
                          <span className={cn("font-semibold", typeConfig.color)}>
                            {data.balance.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Used</span>
                          <span className="font-medium text-foreground">
                            {data.used.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* Overage Information */}
        {isOverage && credits.overage && (
          <>
            <Separator />
            <Alert className="bg-warning/10 border-warning/30">
              <Info className="h-4 w-4 text-warning" />
              <AlertDescription className="text-sm">
                <div className="space-y-2">
                  <p className="font-semibold text-foreground">
                    Overage Billing Active
                  </p>
                  <div className="space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Overage Used:</span>
                      <span className="font-medium text-foreground">
                        {credits.overage.balanceUsed.toFixed(1)} {credits.overage.currencyCode}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Capped Amount:</span>
                      <span className="font-medium text-foreground">
                        {credits.overage.cappedAmount.toFixed(2)} {credits.overage.currencyCode}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Remaining:</span>
                      <span className="font-semibold text-warning">
                        {credits.overage.remaining.toFixed(2)} {credits.overage.currencyCode}
                      </span>
                    </div>
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          </>
        )}

        {/* Subscription Info */}
        {credits.subscription && (
          <>
            <Separator />
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                Subscription Details
              </h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="p-2 rounded bg-muted/50">
                  <p className="text-xs text-muted-foreground mb-1">Interval</p>
                  <p className="font-medium text-foreground">
                    {credits.subscription.isMonthly ? "Monthly" : credits.subscription.isAnnual ? "Annual" : credits.subscription.interval}
                  </p>
                </div>
                <div className="p-2 rounded bg-muted/50">
                  <p className="text-xs text-muted-foreground mb-1">Status</p>
                  <p className="font-medium text-foreground capitalize">
                    {credits.subscription.status.toLowerCase()}
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
              <p className="font-semibold mb-1">No credits remaining</p>
              <p className="text-sm">
                {isOverage 
                  ? "Overage billing is active. Additional usage will be charged." 
                  : credits.canPurchase
                  ? "Please purchase more credits to continue using the service."
                  : "Please contact support to add credits."}
              </p>
            </AlertDescription>
          </Alert>
        )}

        {isLow && !isExhausted && (
          <Alert className="bg-warning/10 border-warning/30">
            <AlertCircle className="h-4 w-4 text-warning" />
            <AlertDescription>
              <p className="font-semibold text-foreground mb-1">Low credits remaining</p>
              <p className="text-sm text-muted-foreground">
                You have {totalBalance} credits left. Consider purchasing more credits to avoid interruption.
              </p>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};

export default CreditBalance;
