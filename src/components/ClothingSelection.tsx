import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

interface ClothingSelectionProps {
  images: string[];
  recommendedImages?: string[];
  selectedImage: string | null;
  onSelect: (imageUrl: string) => void;
  onRefreshImages?: () => void;
  availableImagesWithIds?: Map<string, string | number>;
  generatedClothingKeys?: Set<string>;
  generatedKeyCombinations?: Set<string>;
  selectedDemoPhotoUrl?: string | null;
  demoPhotoIdMap?: Map<string, string>;
  showFinalLayout?: boolean; // Show 2+2 layout only when both photo and clothing are selected
  isLoadingImages?: boolean;
  isLoadingRecommended?: boolean;
}

export default function ClothingSelection({
  images,
  recommendedImages = [],
  selectedImage,
  onSelect,
  onRefreshImages,
  availableImagesWithIds = new Map(),
  generatedClothingKeys = new Set(),
  generatedKeyCombinations = new Set(),
  selectedDemoPhotoUrl = null,
  demoPhotoIdMap = new Map(),
  showFinalLayout = false,
  isLoadingImages = false,
  isLoadingRecommended = false,
}: ClothingSelectionProps) {
  const { t } = useTranslation();
  const [validImages, setValidImages] = useState<string[]>([]);

  const horizontalScrollbarClassName =
    "overflow-x-auto overflow-y-visible smooth-scroll pb-2 px-4 pt-1 scroll-pl-4 scroll-pr-4 [scrollbar-width:thin] [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-thumb]:bg-primary/30 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent hover:[&::-webkit-scrollbar-thumb]:bg-primary/50";

  const renderHorizontalSkeleton = (itemCount: number, itemClassName: string) => {
    return (
      <div className={horizontalScrollbarClassName} aria-busy="true">
        <div className="flex items-start min-w-max gap-3 py-2">
          {Array.from({ length: itemCount }).map((_, index) => (
            <div
              // eslint-disable-next-line react/no-array-index-key
              key={`skeleton-${index}`}
              className={`rounded-lg border border-border bg-muted/10 animate-pulse ${itemClassName}`}
              aria-hidden="true"
            />
          ))}
        </div>
      </div>
    );
  };

  // Check if an image has been generated before (image generation)
  const isGenerated = (imageUrl: string): boolean => {
    const clothingKey = availableImagesWithIds.get(imageUrl);
    if (!clothingKey) return false;
    const normalizedKey = String(clothingKey).trim();
    return generatedClothingKeys.has(normalizedKey);
  };

  // Check if the selected person/clothing combination already exists in cache
  const hasCachedCombination = (): boolean => {
    if (!selectedImage || !selectedDemoPhotoUrl) return false;

    const clothingKey = availableImagesWithIds.get(selectedImage);
    const personKey = demoPhotoIdMap.get(selectedDemoPhotoUrl);

    if (!clothingKey || !personKey) return false;

    const normalizedClothingKey = String(clothingKey).trim();
    const normalizedPersonKey = String(personKey).trim();

    if (!normalizedClothingKey || !normalizedPersonKey) return false;

    return generatedKeyCombinations.has(
      `${normalizedPersonKey}-${normalizedClothingKey}`
    );
  };

  const showCachedCombination = hasCachedCombination();

  // Initialize with provided images; only remove on actual load error
  useEffect(() => {
    const unique = Array.from(new Set(images.filter(Boolean)));
    setValidImages(unique);
    // Debug logging to help troubleshoot image loading
    if (unique.length > 0) {
      console.log("[ClothingSelection] Images loaded:", unique.length, "images");
    } else if (images.length === 0) {
      console.log("[ClothingSelection] No images received from parent");
    }
  }, [images]);

  // If we are still loading images (iframe / parent message), show skeleton instead of the empty-state.
  if (isLoadingImages && validImages.length === 0 && images.length === 0) {
    return (
      <div role="status" aria-live="polite" aria-busy="true">
        <Card className="p-4 sm:p-6 md:p-8 bg-muted/30 border-border">
          <div className="space-y-4">
            <div className="h-4 w-48 rounded bg-muted/60 animate-pulse" aria-hidden="true" />
            <div className="h-3 w-64 rounded bg-muted/50 animate-pulse" aria-hidden="true" />
            {renderHorizontalSkeleton(6, "w-[173px] h-[164px] p-2")}
            <div className="h-4 w-56 rounded bg-muted/60 animate-pulse" aria-hidden="true" />
            {renderHorizontalSkeleton(8, "w-[140px] h-[165px] p-2")}
          </div>
        </Card>
      </div>
    );
  }

  // Only show "no clothing detected" if we have no images AND no selected image AND images prop is empty (not loading)
  if (!isLoadingImages && validImages.length === 0 && !selectedImage && images.length === 0) {
    return (
      <div role="alert" aria-live="polite">
        <Card className="p-4 sm:p-6 md:p-8 text-center bg-warning/10 border-warning">
          <p className="font-semibold text-warning text-sm sm:text-base md:text-lg">
            {t("tryOnWidget.clothingSelection.noClothingDetected") || "Aucune image de vêtement détectée sur cette page"}
          </p>
          <p className="text-xs sm:text-sm text-muted-foreground mt-2">
            {t("tryOnWidget.clothingSelection.noClothingDetectedDescription") || "Assurez-vous d'être sur une page produit Shopify"}
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 w-full h-full max-w-full overflow-x-hidden">
      {showFinalLayout ? (
        /* Final Layout - 2x2 Grid Layout with fixed height and scroll - shows exactly 4 items at a time, scrollable for more */
        <div 
          className="h-[360px] max-h-[360px] overflow-y-auto pr-1 px-2 pt-3 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:bg-primary/30 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent hover:[&::-webkit-scrollbar-thumb]:bg-primary/50"
        >
          {/* Main Product Images - 2x2 Grid (shows 4 at a time, scrollable) */}
          {validImages.length > 0 && (
            <div className="grid grid-cols-2 gap-3 pb-2">
              {validImages.map((image, index) => (
                <Card
                  key={index}
                  className={`p-2 border border-border cursor-pointer transition-all hover:opacity-90 ${
                    selectedImage === image ? "ring-2 ring-primary/70 ring-offset-2 ring-offset-white shadow-sm" : ""
                  }`}
                  onClick={() => onSelect(image)}
                  role="button"
                  tabIndex={0}
                  aria-pressed={selectedImage === image}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelect(image);
                    }
                  }}
                >
                  <img
                    src={image}
                    className="w-full h-auto aspect-square object-contain bg-white rounded-md"
                    alt={t("tryOnWidget.clothingSelection.clothingImageAlt", { 
                      index: index + 1,
                      suffix: selectedImage === image ? ` - ${t("tryOnWidget.clothingSelection.currentlySelected") || "Actuellement sélectionné"}` : ""
                    }) || `Image du vêtement ${index + 1}${selectedImage === image ? ` - ${t("tryOnWidget.clothingSelection.currentlySelected") || "Actuellement sélectionné"}` : ""}`}
                    aria-label={t("tryOnWidget.clothingSelection.selectGarmentAriaLabel", { 
                      index: index + 1,
                      suffix: `${selectedImage === image ? ` - ${t("tryOnWidget.clothingSelection.selected") || "Sélectionné"}` : ""}`
                    }) || `Sélectionner le vêtement ${index + 1}${selectedImage === image ? ` - ${t("tryOnWidget.clothingSelection.selected") || "Sélectionné"}` : ""}`}
                    loading="lazy"
                    onError={() => {
                      setValidImages((prev) =>
                        prev.filter((u) => u !== image)
                      );
                    }}
                  />
                </Card>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Original Layout - 2x2 Grid Layout with fixed height and scroll - shows exactly 4 items at a time, scrollable for more */
        <div 
          className="h-[360px] max-h-[360px] overflow-y-auto pr-1 px-2 pt-3 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:bg-primary/30 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent hover:[&::-webkit-scrollbar-thumb]:bg-primary/50"
        >
          {/* Main Product Images - 2x2 Grid (shows 4 at a time, scrollable) */}
          {validImages.length > 0 && (
            <div className="grid grid-cols-2 gap-3 pb-2">
              {validImages.map((image, index) => (
                <Card
                  key={index}
                  className={`p-2 border border-border cursor-pointer transition-all hover:opacity-90 ${
                    selectedImage === image ? "ring-2 ring-primary/70 ring-offset-2 ring-offset-white shadow-sm" : ""
                  }`}
                  onClick={() => onSelect(image)}
                  role="button"
                  tabIndex={0}
                  aria-pressed={selectedImage === image}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelect(image);
                    }
                  }}
                >
                  <img
                    src={image}
                    className="w-full h-auto aspect-square object-contain bg-white rounded-md"
                    alt={t("tryOnWidget.clothingSelection.clothingImageAlt", {
                      index: index + 1,
                      suffix: selectedImage === image ? ` - ${t("tryOnWidget.clothingSelection.currentlySelected") || "Actuellement sélectionné"}` : ""
                    }) || `Image du vêtement ${index + 1}${selectedImage === image ? ` - ${t("tryOnWidget.clothingSelection.currentlySelected") || "Actuellement sélectionné"}` : ""}`}
                    aria-label={t("tryOnWidget.clothingSelection.selectGarmentAriaLabel", {
                      index: index + 1,
                      suffix: `${selectedImage === image ? ` - ${t("tryOnWidget.clothingSelection.selected") || "Sélectionné"}` : ""}`
                    }) || `Sélectionner le vêtement ${index + 1}${selectedImage === image ? ` - ${t("tryOnWidget.clothingSelection.selected") || "Sélectionné"}` : ""}`}
                    loading="lazy"
                    onError={() => {
                      setValidImages((prev) =>
                        prev.filter((u) => u !== image)
                      );
                    }}
                  />
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
