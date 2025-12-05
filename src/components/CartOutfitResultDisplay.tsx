import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Download,
  ShoppingCart,
  CreditCard,
  CheckCircle,
  XCircle,
  Loader2,
  Image as ImageIcon,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import {
  CartOutfitMode,
  CartResponse,
  OutfitResponse,
} from "@/types/cartOutfit";

interface CartOutfitResultDisplayProps {
  mode: CartOutfitMode;
  cartResults?: CartResponse | null;
  outfitResult?: OutfitResponse | null;
  isGenerating: boolean;
  personImage: string | null;
}

export default function CartOutfitResultDisplay({
  mode,
  cartResults,
  outfitResult,
  isGenerating,
  personImage,
}: CartOutfitResultDisplayProps) {
  const [downloadingIndex, setDownloadingIndex] = useState<number | null>(
    null
  );

  const handleDownload = async (imageUrl: string, index?: number) => {
    if (downloadingIndex !== null) return;

    if (index !== undefined) {
      setDownloadingIndex(index);
    }

    try {
      // Convert data URL or blob URL to blob for proper download
      let blob: Blob | null = null;

      if (imageUrl.startsWith("data:")) {
        const response = await fetch(imageUrl);
        blob = await response.blob();
      } else if (imageUrl.startsWith("blob:")) {
        const response = await fetch(imageUrl);
        blob = await response.blob();
      } else {
        try {
          const response = await fetch(imageUrl, {
            mode: "cors",
            credentials: "omit",
          });
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }
          blob = await response.blob();
        } catch (fetchError) {
          // Fallback: try canvas approach
          const img = new Image();
          img.crossOrigin = "anonymous";

          blob = await new Promise<Blob>((resolve, reject) => {
            img.onload = () => {
              try {
                const canvas = document.createElement("canvas");
                canvas.width = img.naturalWidth;
                canvas.height = img.naturalHeight;
                const ctx = canvas.getContext("2d");
                if (!ctx) {
                  reject(new Error("Could not get canvas context"));
                  return;
                }
                ctx.drawImage(img, 0, 0);
                canvas.toBlob((blobResult) => {
                  if (blobResult) {
                    resolve(blobResult);
                  } else {
                    reject(new Error("Failed to convert canvas to blob"));
                  }
                }, "image/png");
              } catch (error) {
                reject(error);
              }
            };
            img.onerror = () => reject(new Error("Failed to load image"));
            img.src = imageUrl;
          });
        }
      }

      if (!blob) {
        throw new Error("Failed to create blob");
      }

      // Create download link
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const extension = "png";
      const filename =
        index !== undefined
          ? `essayage-virtuel-${index + 1}-${Date.now()}.${extension}`
          : `essayage-virtuel-outfit-${Date.now()}.${extension}`;
      link.download = filename;
      link.style.display = "none";

      document.body.appendChild(link);
      link.click();

      // Cleanup
      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, 100);

      if (index !== undefined) {
        setDownloadingIndex(null);
      }
      toast.success("Téléchargement réussi", {
        description: "L'image a été téléchargée avec succès.",
      });
    } catch (error) {
      if (index !== undefined) {
        setDownloadingIndex(null);
      }

      // Fallback: try to open in new tab
      try {
        window.open(imageUrl, "_blank");
        toast.info("Ouverture dans un nouvel onglet", {
          description:
            "L'image s'ouvre dans un nouvel onglet. Vous pouvez l'enregistrer depuis là.",
        });
      } catch (openError) {
        toast.error("Erreur de téléchargement", {
          description:
            "Impossible de télécharger l'image. Veuillez réessayer ou prendre une capture d'écran.",
        });
      }
    }
  };

  const handleAddToCart = async (productId?: string | number) => {
    // TODO: Implement add to cart functionality
    toast.info("Fonctionnalité à venir", {
      description: "L'ajout au panier sera disponible prochainement.",
    });
  };

  const handleBuyNow = async (productId?: string | number) => {
    // TODO: Implement buy now functionality
    toast.info("Fonctionnalité à venir", {
      description: "L'achat immédiat sera disponible prochainement.",
    });
  };

  // Loading State
  if (isGenerating) {
    return (
      <Card className="p-4 sm:p-6 border-border bg-card">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            <h2 className="text-base sm:text-lg font-semibold">
              Génération en cours...
            </h2>
          </div>
          <Skeleton className="w-full h-[400px] sm:h-[500px] md:h-[600px] rounded-lg" />
        </div>
      </Card>
    );
  }

  // Cart Mode Results
  if (mode === "cart" && cartResults) {
    const { results, summary } = cartResults;
    const successfulResults = results.filter((r) => r.status === "success");

    if (successfulResults.length === 0) {
      return (
        <Card className="p-6 text-center bg-error/10 border-error">
          <XCircle className="h-12 w-12 mx-auto mb-4 text-error" />
          <p className="text-error font-semibold">
            Aucune génération réussie
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            {summary.failed > 0 &&
              `${summary.failed} article${summary.failed > 1 ? "s" : ""} ont échoué`}
          </p>
        </Card>
      );
    }

    return (
      <Card className="p-4 sm:p-6 border-border bg-card">
        <div className="space-y-4">
          {/* Summary */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
              <h2 className="text-base sm:text-lg font-semibold">
                Résultats Générés
              </h2>
            </div>
            <div className="text-xs sm:text-sm text-muted-foreground">
              {summary.successful} / {summary.totalGarments} réussis
              {summary.cached > 0 && ` • ${summary.cached} en cache`}
            </div>
          </div>

          {/* Results Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {successfulResults.map((result, index) => {
              const imageUrl = result.image || result.imageUrl;
              if (!imageUrl) return null;

              return (
                <Card
                  key={result.index}
                  className="p-3 sm:p-4 border-border bg-card"
                >
                  <div className="space-y-3">
                    {/* Image */}
                    <div className="relative rounded-lg overflow-hidden border border-border bg-muted/30 aspect-[3/4] flex items-center justify-center">
                      <img
                        src={imageUrl}
                        alt={`Résultat de l'essayage virtuel ${index + 1}`}
                        className="w-full h-full object-contain"
                        loading="lazy"
                      />
                      {result.cached && (
                        <div className="absolute top-2 right-2 bg-primary/90 text-primary-foreground text-[10px] px-2 py-1 rounded">
                          Cache
                        </div>
                      )}
                      {result.status === "success" && (
                        <div className="absolute top-2 left-2">
                          <CheckCircle
                            className="h-5 w-5 text-green-500 bg-background rounded-full"
                            aria-hidden="true"
                          />
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="grid grid-cols-1 gap-2">
                      <Button
                        onClick={() => handleDownload(imageUrl, index)}
                        disabled={downloadingIndex === index}
                        variant="outline"
                        size="sm"
                        className="w-full"
                        aria-label={`Télécharger l'image ${index + 1}`}
                      >
                        {downloadingIndex === index ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <Download className="h-4 w-4 mr-2" />
                        )}
                        Télécharger
                      </Button>
                    </div>

                    {/* Processing Info */}
                    {result.processingTime > 0 && (
                      <p className="text-[10px] text-muted-foreground text-center">
                        {(result.processingTime / 1000).toFixed(1)}s
                      </p>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Failed Items */}
          {summary.failed > 0 && (
            <div className="mt-4 p-3 bg-warning/10 border border-warning rounded">
              <p className="text-sm text-warning font-semibold">
                {summary.failed} article{summary.failed > 1 ? "s" : ""} n'ont
                pas pu être généré{summary.failed > 1 ? "s" : ""}
              </p>
            </div>
          )}
        </div>
      </Card>
    );
  }

  // Outfit Mode Results
  if (mode === "outfit" && outfitResult) {
    const { data } = outfitResult;
    const imageUrl = data.image || data.imageUrl;

    if (!imageUrl) {
      return (
        <Card className="p-6 text-center bg-error/10 border-error">
          <XCircle className="h-12 w-12 mx-auto mb-4 text-error" />
          <p className="text-error font-semibold">
            Erreur lors de la génération
          </p>
        </Card>
      );
    }

    return (
      <Card className="p-4 sm:p-6 border-border bg-card ring-2 ring-primary/20 shadow-lg">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            <h2 className="text-base sm:text-lg font-semibold">
              Tenue Complète Générée
            </h2>
          </div>

          {/* Main Image */}
          <div className="relative rounded-lg border border-border/50 bg-gradient-to-br from-muted/20 to-muted/5 overflow-hidden flex items-center justify-center shadow-sm hover:shadow-md transition-shadow duration-300">
            <img
              src={imageUrl}
              alt="Tenue complète générée par intelligence artificielle"
              className="w-full max-h-[80vh] object-contain"
              loading="lazy"
            />
            {data.cached && (
              <div className="absolute top-4 right-4 bg-primary/90 text-primary-foreground text-xs px-3 py-1.5 rounded">
                En cache
              </div>
            )}
          </div>

          {/* Garment Types */}
          {data.garmentTypes && data.garmentTypes.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {data.garmentTypes.map((type, index) => (
                <span
                  key={index}
                  className="text-xs px-2 py-1 bg-muted rounded text-muted-foreground"
                >
                  {type}
                </span>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <Button
              onClick={() => handleDownload(imageUrl)}
              disabled={downloadingIndex !== null}
              variant="outline"
              size="sm"
              className="w-full"
              aria-label="Télécharger l'image de la tenue"
            >
              {downloadingIndex !== null ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              Télécharger
            </Button>
            <Button
              onClick={() => handleAddToCart()}
              variant="outline"
              size="sm"
              className="w-full border-green-500/80 text-green-600 hover:bg-green-50"
              aria-label="Ajouter tous les articles au panier"
            >
              <ShoppingCart className="h-4 w-4 mr-2" />
              Ajouter au Panier
            </Button>
            <Button
              onClick={() => handleBuyNow()}
              variant="outline"
              size="sm"
              className="w-full border-red-500/80 text-red-600 hover:bg-red-50"
              aria-label="Acheter tous les articles maintenant"
            >
              <CreditCard className="h-4 w-4 mr-2" />
              Acheter Maintenant
            </Button>
          </div>

          {/* Processing Info */}
          {data.processingTime > 0 && (
            <p className="text-xs text-muted-foreground text-center">
              Temps de traitement: {(data.processingTime / 1000).toFixed(1)}s
              {data.creditsDeducted > 0 && ` • ${data.creditsDeducted} crédit${data.creditsDeducted > 1 ? "s" : ""} utilisé${data.creditsDeducted > 1 ? "s" : ""}`}
            </p>
          )}
        </div>
      </Card>
    );
  }

  // Empty State
  return (
    <Card className="p-6 text-center">
      <div
        className="w-full min-h-[400px] flex flex-col items-center justify-center gap-3 text-muted-foreground"
        role="status"
        aria-live="polite"
      >
        <div
          className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-muted/50 flex items-center justify-center"
          aria-hidden="true"
        >
          <ImageIcon className="w-8 h-8 sm:w-10 sm:h-10 text-muted-foreground/60" />
        </div>
        <p className="text-xs sm:text-sm text-muted-foreground/80 text-center px-4">
          Aucun résultat généré
        </p>
      </div>
    </Card>
  );
}

