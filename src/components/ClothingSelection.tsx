import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle } from "lucide-react";
import { useEffect, useState, useRef } from "react";
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
  showFinalLayout?: boolean; // Show 2+2 layout only when both photo and clothing are selected
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
  showFinalLayout = false,
}: ClothingSelectionProps) {
  const { t } = useTranslation();
  const [validImages, setValidImages] = useState<string[]>([]);
  const [validRecommendedImages, setValidRecommendedImages] = useState<
    string[]
  >([]);
  const mainScrollRef = useRef<HTMLDivElement>(null);
  const recommendedScrollRef = useRef<HTMLDivElement>(null);

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
    // Debug logging to help troubleshoot image loading
    if (unique.length > 0) {
      console.log("[ClothingSelection] Images loaded:", unique.length, "images");
    } else if (images.length === 0) {
      console.log("[ClothingSelection] No images received from parent");
    }
  }, [images]);

  // Initialize recommended images
  useEffect(() => {
    const unique = Array.from(new Set(recommendedImages.filter(Boolean)));
    setValidRecommendedImages(unique);
    // Debug logging to help troubleshoot recommended images loading
    if (unique.length > 0) {
      console.log("[ClothingSelection] Recommended images loaded:", unique.length, "images");
    }
  }, [recommendedImages]);

  // Touch/swipe handlers for horizontal scrolling
  const handleTouchStart = (e: React.TouchEvent, ref: React.RefObject<HTMLDivElement>) => {
    if (!ref.current) return;
    const startX = e.touches[0].clientX;
    const scrollLeft = ref.current.scrollLeft;
    ref.current.dataset.startX = startX.toString();
    ref.current.dataset.scrollLeft = scrollLeft.toString();
  };

  const handleTouchMove = (e: React.TouchEvent, ref: React.RefObject<HTMLDivElement>) => {
    if (!ref.current || !ref.current.dataset.startX) return;
    const x = e.touches[0].clientX;
    const startX = parseFloat(ref.current.dataset.startX);
    const scrollLeft = parseFloat(ref.current.dataset.scrollLeft || "0");
    const walk = (x - startX) * 1.5; // Scroll speed multiplier
    ref.current.scrollLeft = scrollLeft - walk;
  };

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
      {showFinalLayout ? (
        /* Final Layout - Show 2+2 grid when both photo and clothing are selected */
        <div className="flex-1 min-h-0 overflow-y-auto pr-1 -mr-1 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:bg-primary/30 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent hover:[&::-webkit-scrollbar-thumb]:bg-primary/50">
          <div className="space-y-3 sm:space-y-4 pb-2">
            {/* Main Product Images - Mobile: Full-width stacked, Desktop: Side by side */}
            {validImages.length > 0 && (
              <div className="flex flex-col lg:flex-row items-start self-stretch mb-2 lg:mb-2.5 lg:mr-6 gap-0 lg:gap-[9px] mx-8 lg:mx-0">
                {validImages.slice(0, 2).map((image, index) => (
                  <img
                    key={index}
                    src={image}
                    className={`w-full lg:w-[173px] h-[135px] lg:h-[164px] ${index === 0 ? 'mb-2 lg:mb-0' : 'mb-4 lg:mb-0'} object-contain bg-white rounded-md cursor-pointer transition-all hover:opacity-90 ${
                      selectedImage === image ? "ring-2 ring-slate-400 ring-offset-2" : ""
                    }`}
                    onClick={() => onSelect(image)}
                    role="button"
                    tabIndex={0}
                    alt={t("tryOnWidget.clothingSelection.clothingImageAlt", { 
                      index: index + 1,
                      suffix: selectedImage === image ? ` - ${t("tryOnWidget.clothingSelection.currentlySelected") || "Actuellement sélectionné"}` : ""
                    }) || `Image du vêtement ${index + 1}${selectedImage === image ? ` - ${t("tryOnWidget.clothingSelection.currentlySelected") || "Actuellement sélectionné"}` : ""}`}
                    aria-label={t("tryOnWidget.clothingSelection.selectGarmentAriaLabel", { 
                      index: index + 1,
                      suffix: `${selectedImage === image ? ` - ${t("tryOnWidget.clothingSelection.selected") || "Sélectionné"}` : ""}`
                    }) || `Sélectionner le vêtement ${index + 1}${selectedImage === image ? ` - ${t("tryOnWidget.clothingSelection.selected") || "Sélectionné"}` : ""}`}
                    aria-pressed={selectedImage === image}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onSelect(image);
                      }
                    }}
                    loading="lazy"
                    onError={() => {
                      setValidImages((prev) =>
                        prev.filter((u) => u !== image)
                      );
                    }}
                  />
                ))}
              </div>
            )}

            {/* Recommended Products Section */}
            {validRecommendedImages.length > 0 && (
              <>
                <span className="text-slate-800 text-sm font-bold mb-2 lg:mr-56 block ml-8 lg:ml-0">
                  {t("tryOnWidget.clothingSelection.recommendedProducts") || "Produits recommandés"}
                </span>
                <div className="flex items-start lg:mr-[91px] gap-2 mx-8 lg:mx-0">
                  {validRecommendedImages.slice(0, 2).map((image, index) => (
                    <img
                      key={`recommended-${index}`}
                      src={image}
                      className={`w-[140px] h-[169px] object-contain bg-white rounded-md cursor-pointer transition-all hover:opacity-90 ${
                        selectedImage === image ? "ring-2 ring-slate-400 ring-offset-2" : ""
                      }`}
                      onClick={() => onSelect(image)}
                      role="button"
                      tabIndex={0}
                      alt={t("tryOnWidget.clothingSelection.recommendedProductAlt", { 
                        index: index + 1,
                        suffix: selectedImage === image ? ` - ${t("tryOnWidget.clothingSelection.currentlySelected") || "Actuellement sélectionné"}` : ""
                      }) || `Produit recommandé ${index + 1}${selectedImage === image ? ` - ${t("tryOnWidget.clothingSelection.currentlySelected") || "Actuellement sélectionné"}` : ""}`}
                      aria-label={t("tryOnWidget.clothingSelection.selectRecommendedProductAriaLabel", { 
                        index: index + 1,
                        suffix: `${selectedImage === image ? ` - ${t("tryOnWidget.clothingSelection.selected") || "Sélectionné"}` : ""}`
                      }) || `Sélectionner le produit recommandé ${index + 1}${selectedImage === image ? ` - ${t("tryOnWidget.clothingSelection.selected") || "Sélectionné"}` : ""}`}
                      aria-pressed={selectedImage === image}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onSelect(image);
                        }
                      }}
                      loading="lazy"
                      onError={() => {
                        setValidRecommendedImages((prev) =>
                          prev.filter((u) => u !== image)
                        );
                      }}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      ) : (
        /* Original Layout - Horizontal scrollable when not both selected */
        <>
          {/* Always show images - removed !selectedImage condition */}
          <div className="flex-1 min-h-0 overflow-y-auto pr-1 -mr-1 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:bg-primary/30 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent hover:[&::-webkit-scrollbar-thumb]:bg-primary/50">
            <div className="space-y-3 sm:space-y-4 pb-2">
              {/* Main Product Images - Horizontal Scroll */}
              {validImages.length > 0 && (
                <div className="overflow-x-auto scrollbar-hide smooth-scroll pb-2 -mx-1 px-1 snap-x snap-mandatory">
                  <div className="flex items-start min-w-max gap-[9px]">
                    {validImages.map((image, index) => (
                      <img
                        key={index}
                        src={image}
                        className={`w-[173px] h-[164px] object-contain bg-white rounded-md cursor-pointer transition-all hover:opacity-90 snap-start ${
                          selectedImage === image ? "ring-2 ring-slate-400 ring-offset-2" : ""
                        }`}
                        onClick={() => onSelect(image)}
                        role="button"
                        tabIndex={0}
                        alt={t("tryOnWidget.clothingSelection.clothingImageAlt", {
                          index: index + 1,
                          suffix: selectedImage === image ? ` - ${t("tryOnWidget.clothingSelection.currentlySelected") || "Actuellement sélectionné"}` : ""
                        }) || `Image du vêtement ${index + 1}${selectedImage === image ? ` - ${t("tryOnWidget.clothingSelection.currentlySelected") || "Actuellement sélectionné"}` : ""}`}
                        aria-label={t("tryOnWidget.clothingSelection.selectGarmentAriaLabel", {
                          index: index + 1,
                          suffix: `${selectedImage === image ? ` - ${t("tryOnWidget.clothingSelection.selected") || "Sélectionné"}` : ""}`
                        }) || `Sélectionner le vêtement ${index + 1}${selectedImage === image ? ` - ${t("tryOnWidget.clothingSelection.selected") || "Sélectionné"}` : ""}`}
                        aria-pressed={selectedImage === image}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            onSelect(image);
                          }
                        }}
                        loading="lazy"
                        onError={() => {
                          setValidImages((prev) =>
                            prev.filter((u) => u !== image)
                          );
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Recommended Products Section - Horizontal Scroll */}
              {validRecommendedImages.length > 0 && (
                <div className="mt-4">
                  <span className="text-slate-800 text-sm font-bold mb-2 mr-56 block">
                    {t("tryOnWidget.clothingSelection.recommendedProducts") || "Produits recommandés"}
                  </span>
                  <div className="overflow-x-auto scrollbar-hide smooth-scroll pb-2 -mx-1 px-1 snap-x snap-mandatory">
                    <div className="flex items-start min-w-max gap-2">
                      {validRecommendedImages.map((image, index) => (
                        <img
                          key={`recommended-${index}`}
                          src={image}
                          className={`w-[140px] h-[165px] object-contain bg-white rounded-md cursor-pointer transition-all hover:opacity-90 snap-start ${
                            selectedImage === image ? "ring-2 ring-slate-400 ring-offset-2" : ""
                          }`}
                          onClick={() => onSelect(image)}
                          role="button"
                          tabIndex={0}
                          alt={t("tryOnWidget.clothingSelection.recommendedProductAlt", {
                            index: index + 1,
                            suffix: selectedImage === image ? ` - ${t("tryOnWidget.clothingSelection.currentlySelected") || "Actuellement sélectionné"}` : ""
                          }) || `Produit recommandé ${index + 1}${selectedImage === image ? ` - ${t("tryOnWidget.clothingSelection.currentlySelected") || "Actuellement sélectionné"}` : ""}`}
                          aria-label={t("tryOnWidget.clothingSelection.selectRecommendedProductAriaLabel", {
                            index: index + 1,
                            suffix: `${selectedImage === image ? ` - ${t("tryOnWidget.clothingSelection.selected") || "Sélectionné"}` : ""}`
                          }) || `Sélectionner le produit recommandé ${index + 1}${selectedImage === image ? ` - ${t("tryOnWidget.clothingSelection.selected") || "Sélectionné"}` : ""}`}
                          aria-pressed={selectedImage === image}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              onSelect(image);
                            }
                          }}
                          loading="lazy"
                          onError={() => {
                            setValidRecommendedImages((prev) =>
                              prev.filter((u) => u !== image)
                            );
                          }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
