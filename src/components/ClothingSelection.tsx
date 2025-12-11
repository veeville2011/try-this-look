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
  matchingClothingKeys?: string[];
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
  matchingClothingKeys = [],
}: ClothingSelectionProps) {
  const { t } = useTranslation();
  const [validImages, setValidImages] = useState<string[]>([]);
  const [validRecommendedImages, setValidRecommendedImages] = useState<
    string[]
  >([]);

  // Check if an image has been generated before (image generation)
  const isGenerated = (imageUrl: string): boolean => {
    const clothingKey = availableImagesWithIds.get(imageUrl);
    if (!clothingKey) return false;
    const normalizedKey = String(clothingKey).trim();
    return generatedClothingKeys.has(normalizedKey);
  };

  // Check if a clothing item matches the selected person (from key mappings API)
  const isMatching = (imageUrl: string): boolean => {
    const clothingKey = availableImagesWithIds.get(imageUrl);
    if (!clothingKey || matchingClothingKeys.length === 0) return false;
    const normalizedKey = String(clothingKey).trim();
    return matchingClothingKeys.includes(normalizedKey);
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
  }, [images]);

  // Initialize recommended images
  useEffect(() => {
    const unique = Array.from(new Set(recommendedImages.filter(Boolean)));
    setValidRecommendedImages(unique);
  }, [recommendedImages]);
  if (validImages.length === 0 && !selectedImage) {
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
    <div className="flex flex-col h-full min-h-0">
      {/* Heading intentionally removed per design */}

      {!selectedImage && (
        <div className="flex-1 min-h-0 overflow-y-auto pr-1 -mr-1 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:bg-primary/30 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent hover:[&::-webkit-scrollbar-thumb]:bg-primary/50">
          <div className="space-y-3 sm:space-y-4 pb-2">
            {/* Main Product Images */}
            {validImages.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-2 sm:gap-3 md:gap-4">
                {validImages.slice(0, 9).map((image, index) => (
                <Card
                  key={index}
                  className={`overflow-hidden cursor-pointer transition-all transform hover:scale-105 relative focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
                    selectedImage === image
                      ? "ring-4 ring-primary shadow-lg scale-105"
                      : "hover:ring-2 hover:ring-primary/50"
                  }`}
                  onClick={() => onSelect(image)}
                  role="button"
                  tabIndex={0}
                  aria-label={t("tryOnWidget.clothingSelection.selectGarmentAriaLabel", { 
                    index: index + 1,
                    suffix: `${selectedImage === image ? ` - ${t("tryOnWidget.clothingSelection.selected") || "Sélectionné"}` : ""}${isGenerated(image) ? ` - ${t("tryOnWidget.clothingSelection.alreadyGenerated") || "Déjà généré"}` : ""}`
                  }) || `Sélectionner le vêtement ${index + 1}${selectedImage === image ? ` - ${t("tryOnWidget.clothingSelection.selected") || "Sélectionné"}` : ""}${isGenerated(image) ? ` - ${t("tryOnWidget.clothingSelection.alreadyGenerated") || "Déjà généré"}` : ""}`}
                  aria-pressed={selectedImage === image}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelect(image);
                    }
                  }}
                >
                  <div className="relative bg-muted/30 flex items-center justify-center overflow-hidden h-48 sm:h-56 md:h-64">
                    <img
                      src={image}
                      alt={t("tryOnWidget.clothingSelection.clothingImageAlt", { 
                        index: index + 1,
                        suffix: selectedImage === image ? ` - ${t("tryOnWidget.clothingSelection.currentlySelected") || "Actuellement sélectionné"}` : ""
                      }) || `Image du vêtement ${index + 1}${selectedImage === image ? ` - ${t("tryOnWidget.clothingSelection.currentlySelected") || "Actuellement sélectionné"}` : ""}`}
                      className="h-full w-auto object-contain"
                      loading="lazy"
                      onError={() => {
                        setValidImages((prev) =>
                          prev.filter((u) => u !== image)
                        );
                      }}
                    />
                    {/* Indicators: show only when the API returned a matching clothing item */}
                    {isMatching(image) && (
                      <div className="absolute top-2 right-2 flex flex-col gap-1">
                        <CheckCircle
                          className="h-4 w-4 sm:h-5 sm:w-5 fill-background text-primary"
                          aria-hidden="true"
                        />
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* Recommended Products Section */}
          {validRecommendedImages.length > 0 && (
            <div className="space-y-2 sm:space-y-3">
              <h3 className="text-sm sm:text-base font-semibold text-foreground">
                {t("tryOnWidget.clothingSelection.recommendedProducts") || "Produits Recommandés"}
              </h3>
              <div className="relative">
                <div className="overflow-x-auto overflow-y-hidden scrollbar-hide smooth-scroll pb-2 -mx-1 px-1 snap-x snap-mandatory">
                  <div className="flex gap-2 sm:gap-3 md:gap-4 min-w-max">
                    {validRecommendedImages.map((image, index) => (
                      <Card
                        key={`recommended-${index}`}
                        className={`flex-shrink-0 w-24 sm:w-28 md:w-32 lg:w-36 overflow-hidden cursor-pointer transition-all transform hover:scale-105 relative snap-start focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
                          selectedImage === image
                            ? "ring-4 ring-primary shadow-lg scale-105"
                            : "hover:ring-2 hover:ring-primary/50"
                        }`}
                        onClick={() => onSelect(image)}
                        role="button"
                        tabIndex={0}
                        aria-label={t("tryOnWidget.clothingSelection.selectRecommendedProductAriaLabel", { 
                          index: index + 1,
                          suffix: `${selectedImage === image ? ` - ${t("tryOnWidget.clothingSelection.selected") || "Sélectionné"}` : ""}${isGenerated(image) ? ` - ${t("tryOnWidget.clothingSelection.alreadyGenerated") || "Déjà généré"}` : ""}`
                        }) || `Sélectionner le produit recommandé ${index + 1}${selectedImage === image ? ` - ${t("tryOnWidget.clothingSelection.selected") || "Sélectionné"}` : ""}${isGenerated(image) ? ` - ${t("tryOnWidget.clothingSelection.alreadyGenerated") || "Déjà généré"}` : ""}`}
                        aria-pressed={selectedImage === image}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            onSelect(image);
                          }
                        }}
                      >
                        <div className="relative bg-muted/30 flex items-center justify-center overflow-hidden h-32 sm:h-36 md:h-40 lg:h-44">
                          <img
                            src={image}
                            alt={t("tryOnWidget.clothingSelection.recommendedProductAlt", { 
                              index: index + 1,
                              suffix: selectedImage === image ? ` - ${t("tryOnWidget.clothingSelection.currentlySelected") || "Actuellement sélectionné"}` : ""
                            }) || `Produit recommandé ${index + 1}${selectedImage === image ? ` - ${t("tryOnWidget.clothingSelection.currentlySelected") || "Actuellement sélectionné"}` : ""}`}
                            className="h-full w-auto object-contain"
                            loading="lazy"
                            onError={() => {
                              setValidRecommendedImages((prev) =>
                                prev.filter((u) => u !== image)
                              );
                            }}
                          />
                          {/* Indicators: show only when the API returned a matching clothing item */}
                          {isMatching(image) && (
                            <div className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 flex flex-col gap-1">
                              <CheckCircle
                                className="h-3.5 w-3.5 sm:h-4 sm:w-4 fill-background text-primary"
                                aria-hidden="true"
                              />
                            </div>
                          )}
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
          </div>
        </div>
      )}

      {selectedImage && (
        <div role="status" aria-live="polite">
          <Card className="p-3 sm:p-4">
            <div className="flex items-center justify-between mb-2 sm:mb-3 gap-2">
              <p className="font-semibold text-sm sm:text-base md:text-lg">
                {t("tryOnWidget.clothingSelection.selectedItem") || "Article Sélectionné"}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onSelect("")}
                className="group h-8 sm:h-9 px-2.5 sm:px-3 text-xs sm:text-sm flex-shrink-0 gap-1.5 border-border text-foreground hover:bg-muted hover:border-muted-foreground/20 hover:text-muted-foreground transition-all duration-200 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                aria-label={t("tryOnWidget.clothingSelection.clearSelectionAriaLabel") || "Effacer la sélection du vêtement"}
              >
                <XCircle
                  className="h-3.5 w-3.5 sm:h-4 sm:w-4 transition-transform group-hover:scale-110 duration-200"
                  aria-hidden="true"
                />
                <span>{t("tryOnWidget.clothingSelection.clear") || "Effacer"}</span>
              </Button>
            </div>
            <div className="aspect-[3/4] rounded overflow-hidden border border-border bg-card flex items-center justify-center shadow-sm relative">
              <img
                src={selectedImage}
                alt={t("tryOnWidget.clothingSelection.selectedClothingAlt") || "Vêtement actuellement sélectionné pour l'essayage virtuel"}
                className="h-full w-auto object-contain"
              />
              {/* Indicators: show tick when API returned matching clothing item */}
              {isMatching(selectedImage) && (
                <div className="absolute top-2 right-2">
                  <CheckCircle
                    className={`h-5 w-5 sm:h-6 sm:w-6 fill-background ${
                      showCachedCombination ? "text-green-500" : "text-primary"
                    }`}
                    aria-hidden="true"
                  />
                  <span className="sr-only">
                    {isGenerated(selectedImage) && "Image générée."}
                  </span>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
