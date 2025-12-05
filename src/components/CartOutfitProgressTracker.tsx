import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import { CartOutfitMode, BatchProgress, CartResult } from "@/types/cartOutfit";

interface CartOutfitProgressTrackerProps {
  mode: CartOutfitMode;
  isGenerating: boolean;
  progress?: number;
  batchProgress?: BatchProgress;
  cartResults?: CartResult[];
}

export default function CartOutfitProgressTracker({
  mode,
  isGenerating,
  progress = 0,
  batchProgress,
  cartResults = [],
}: CartOutfitProgressTrackerProps) {
  if (!isGenerating) {
    return null;
  }

  // Calculate overall progress
  const overallProgress =
    mode === "cart" && batchProgress
      ? Math.round(
          (batchProgress.completed / batchProgress.total) * 100
        )
      : progress;

  // Calculate estimated time remaining (rough estimate)
  const estimatedTimeRemaining =
    batchProgress?.estimatedTimeRemaining ||
    (mode === "cart" && batchProgress
      ? Math.max(
          0,
          (batchProgress.total - batchProgress.completed) * 10000
        ) // ~10 seconds per item estimate
      : null);

  const formatTime = (ms: number): string => {
    const seconds = Math.ceil(ms / 1000);
    if (seconds < 60) {
      return `${seconds}s`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  return (
    <Card className="p-4 sm:p-6 border-border bg-card">
      <div className="space-y-4">
        {/* Overall Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Loader2
                className="h-4 w-4 sm:h-5 sm:w-5 animate-spin text-primary"
                aria-hidden="true"
              />
              <span className="text-sm sm:text-base font-semibold">
                {mode === "cart"
                  ? "Génération en cours..."
                  : "Génération de la tenue complète..."}
              </span>
            </div>
            <span className="text-xs sm:text-sm text-muted-foreground">
              {overallProgress}%
            </span>
          </div>
          <Progress value={overallProgress} className="h-2" />
        </div>

        {/* Batch Progress Details (Cart Mode Only) */}
        {mode === "cart" && batchProgress && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs sm:text-sm">
              <span className="text-muted-foreground">
                Articles traités: {batchProgress.completed} / {batchProgress.total}
              </span>
              {batchProgress.failed > 0 && (
                <span className="text-warning">
                  Échecs: {batchProgress.failed}
                </span>
              )}
            </div>

            {/* Individual Item Progress */}
            {cartResults.length > 0 && (
              <div className="space-y-2">
                {cartResults.map((result, index) => (
                  <div
                    key={result.index}
                    className="flex items-center gap-2 text-xs sm:text-sm"
                  >
                    {result.status === "success" ? (
                      <CheckCircle
                        className="h-4 w-4 text-green-500 flex-shrink-0"
                        aria-hidden="true"
                      />
                    ) : result.status === "error" ? (
                      <XCircle
                        className="h-4 w-4 text-destructive flex-shrink-0"
                        aria-hidden="true"
                      />
                    ) : (
                      <Loader2
                        className="h-4 w-4 animate-spin text-primary flex-shrink-0"
                        aria-hidden="true"
                      />
                    )}
                    <span className="flex-1 truncate">
                      Article {index + 1}
                      {result.cached && (
                        <span className="text-muted-foreground ml-1">
                          (en cache)
                        </span>
                      )}
                    </span>
                    {result.status === "success" && result.processingTime > 0 && (
                      <span className="text-muted-foreground text-[10px]">
                        {(result.processingTime / 1000).toFixed(1)}s
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Estimated Time Remaining */}
            {estimatedTimeRemaining !== null &&
              estimatedTimeRemaining > 0 && (
                <div className="text-xs sm:text-sm text-muted-foreground">
                  Temps estimé restant: {formatTime(estimatedTimeRemaining)}
                </div>
              )}
          </div>
        )}

        {/* Outfit Mode Message */}
        {mode === "outfit" && (
          <div className="text-xs sm:text-sm text-muted-foreground">
            La génération d'une tenue complète peut prendre 10 à 15 secondes...
          </div>
        )}
      </div>
    </Card>
  );
}

