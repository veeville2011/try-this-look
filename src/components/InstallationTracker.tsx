import { useTranslation } from "react-i18next";
import { useInstallationStatus } from "@/hooks/useInstallationStatus";
import { useSubscription } from "@/hooks/useSubscription";
import { CheckCircle2, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface InstallationTrackerProps {
  onAddClick?: () => void;
}

const InstallationTracker = ({ onAddClick }: InstallationTrackerProps) => {
  const { t } = useTranslation();
  const { isInstalled, loading, error, refresh } = useInstallationStatus();
  const { subscription } = useSubscription();

  const handleAddClick = () => {
    if (onAddClick) {
      onAddClick();
    }
  };

  const hasSubscription = subscription && subscription.subscription !== null;

  return (
    <Card className="border border-border shadow-sm bg-card">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={cn(
              "flex items-center justify-center w-12 h-12 rounded-lg border-2 transition-colors",
              isInstalled 
                ? "bg-success/10 border-success/30" 
                : loading
                  ? "bg-muted/50 border-border"
                  : "bg-warning/10 border-warning/30"
            )}>
              {loading ? (
                <Loader2 className="h-6 w-6 text-muted-foreground animate-spin" />
              ) : isInstalled ? (
                <CheckCircle2 className="h-6 w-6 text-success" />
              ) : (
                <Plus className="h-6 w-6 text-warning" />
              )}
            </div>
            <div className="flex-1">
              <h3 className="text-base font-semibold text-foreground mb-1">
                {t("installationTracker.title") || "App Block Installation"}
              </h3>
              <p className="text-sm text-muted-foreground">
                {loading 
                  ? (t("installationTracker.checking") || "Checking installation status...")
                  : isInstalled
                    ? (t("installationTracker.installed") || "App block is installed and active")
                    : (t("installationTracker.notInstalled") || "App block is not installed")
                }
              </p>
              {error && (
                <p className="text-xs text-destructive mt-1">
                  {error}
                </p>
              )}
            </div>
          </div>
          {!loading && !isInstalled && hasSubscription && (
            <Button
              onClick={handleAddClick}
              size="sm"
              className="min-h-[44px] px-4 font-medium focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              aria-label={t("installationTracker.addButton") || "Add App Block"}
            >
              <Plus className="w-4 h-4 mr-2" aria-hidden="true" />
              {t("installationTracker.addButton") || "Add App Block"}
            </Button>
          )}
          {!loading && !isInstalled && !hasSubscription && (
            <Button
              onClick={() => {
                // This will be handled by parent component
                if (onAddClick) {
                  onAddClick();
                }
              }}
              variant="outline"
              size="sm"
              className="min-h-[44px] px-4 font-medium focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              aria-label={t("installationTracker.selectPlan") || "Select Plan"}
            >
              {t("installationTracker.selectPlan") || "Select Plan"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default InstallationTracker;

