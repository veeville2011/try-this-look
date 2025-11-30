import { useCredits } from "@/hooks/useCredits";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { CreditCard, Zap, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export const CreditBalance = () => {
  const { credits, loading, error } = useCredits();

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Credit Balance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  if (error || !credits) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Credit Balance</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {error || "Failed to load credit balance"}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const usagePercentage = credits.included > 0 
    ? (credits.used / credits.included) * 100 
    : 0;
  
  const remainingCredits = credits.balance;
  const isLow = remainingCredits <= 20;
  const isExhausted = remainingCredits === 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Credit Balance
        </CardTitle>
        <CardDescription>
          {credits.periodEnd 
            ? `Period ends: ${new Date(credits.periodEnd).toLocaleDateString()}`
            : "Current billing period"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Remaining Credits</span>
            <div className="flex items-center gap-2">
              <span className={`text-2xl font-bold ${isExhausted ? 'text-destructive' : isLow ? 'text-yellow-600' : 'text-primary'}`}>
                {remainingCredits}
              </span>
              {credits.isOverage && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  <Zap className="h-3 w-3" />
                  Overage
                </Badge>
              )}
            </div>
          </div>
          
          {credits.included > 0 && (
            <>
              <Progress 
                value={usagePercentage} 
                className="h-2"
              />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{credits.used} of {credits.included} used</span>
                <span>{Math.round(usagePercentage)}%</span>
              </div>
            </>
          )}
        </div>

        {isExhausted && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              You have no credits remaining. {credits.isOverage 
                ? "Overage billing is active." 
                : "Please purchase more credits to continue."}
            </AlertDescription>
          </Alert>
        )}

        {isLow && !isExhausted && (
          <Alert variant="default">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Low credits remaining. Consider purchasing more credits.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};

