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

  const normalizeUrlForComparison = (url: string): string => {
    if (!url) return "";
    try {
      const u = new URL(url, window.location.origin);
      u.search = "";
      u.hash = "";
      return u.href.toLowerCase();
    } catch {
      return String(url).trim().toLowerCase();
    }
  };

  const getBaseImagePath = (url: string): string => {
    if (!url) return "";
    try {
      const u = new URL(url, window.location.origin);
      const parts = u.pathname.split("/").filter(Boolean);
      if (parts.length >= 2) return `${parts[parts.length - 2]}/${parts[parts.length - 1]}`.toLowerCase();
      if (parts.length === 1) return parts[0].toLowerCase();
      return "";
    } catch {
      return "";
    }
  };

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

  // Only show "no clothing detected" if we have no images AND no selected image AND images prop is empty (not loading)
  // This prevents showing the error message while images are being loaded
  if (validImages.length === 0 && !selectedImage && images.length === 0) {
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

  // Filter out main product images from recommended products (robust to CDN query params / size variants).
  const mainImageNormalizedSet = new Set(validImages.map(normalizeUrlForComparison).filter(Boolean));
  const mainImageBasePathSet = new Set(validImages.map(getBaseImagePath).filter(Boolean));

  const filteredRecommendedImages = validRecommendedImages.filter((recImage) => {
    const normalized = normalizeUrlForComparison(recImage);
    if (normalized && mainImageNormalizedSet.has(normalized)) return false;

    const basePath = getBaseImagePath(recImage);
    if (basePath && mainImageBasePathSet.has(basePath)) return false;

    return true;
  });

  return (
    <div className="flex flex-col h-full min-h-0">
      {showFinalLayout ? (
        /* Final Layout - Show 2+2 grid when both photo and clothing are selected */
        <div className="flex-1 min-h-0 overflow-y-auto pr-1 px-4 pt-3 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:bg-primary/30 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent hover:[&::-webkit-scrollbar-thumb]:bg-primary/50">
          <div className="space-y-4 pb-2">
            {/* Main Product Images - Mobile: Full-width stacked, Desktop: Side by side with horizontal scroll fallback */}
            {validImages.length > 0 && (
              <div className="overflow-x-auto scrollbar-hide smooth-scroll pb-1 px-4 lg:px-4 pt-1">
                <div className="flex flex-col lg:flex-row items-start self-stretch mb-3 lg:mb-3 gap-0 lg:gap-3 min-w-max">
                  {validImages.slice(0, 2).map((image, index) => (
                    <Card
                      key={index}
                      className={`p-2 border border-border cursor-pointer transition-all hover:opacity-90 ${index === 0 ? 'mb-2 lg:mb-0' : 'mb-4 lg:mb-0'} ${
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
                        className={`w-full lg:w-[173px] h-[135px] lg:h-[164px] object-contain bg-white rounded-md ${
                          selectedImage === image ? "" : ""
                        }`}
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
              </div>
            )}

            {/* Recommended Products Section */}
            {filteredRecommendedImages.length > 0 && (
              <>
                <span className="text-slate-800 text-sm font-bold mb-2 block ml-8 lg:ml-0 whitespace-nowrap">
                  {t("tryOnWidget.clothingSelection.recommendedProducts") || "Produits recommandés"}
                </span>
                <div className="overflow-x-auto scrollbar-hide smooth-scroll pb-2 px-4 lg:px-4 pt-1">
                  <div className="flex items-start gap-3 min-w-max">
                    {filteredRecommendedImages.map((image, index) => (
                      <Card
                        key={`recommended-${index}`}
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
                          className={`w-[140px] h-[169px] object-contain bg-white rounded-md ${
                            selectedImage === image ? "" : ""
                          }`}
                          alt={t("tryOnWidget.clothingSelection.recommendedProductAlt", { 
                            index: index + 1,
                            suffix: selectedImage === image ? ` - ${t("tryOnWidget.clothingSelection.currentlySelected") || "Actuellement sélectionné"}` : ""
                          }) || `Produit recommandé ${index + 1}${selectedImage === image ? ` - ${t("tryOnWidget.clothingSelection.currentlySelected") || "Actuellement sélectionné"}` : ""}`}
                          aria-label={t("tryOnWidget.clothingSelection.selectRecommendedProductAriaLabel", { 
                            index: index + 1,
                            suffix: `${selectedImage === image ? ` - ${t("tryOnWidget.clothingSelection.selected") || "Sélectionné"}` : ""}`
                          }) || `Sélectionner le produit recommandé ${index + 1}${selectedImage === image ? ` - ${t("tryOnWidget.clothingSelection.selected") || "Sélectionné"}` : ""}`}
                          loading="lazy"
                          onError={() => {
                            setValidRecommendedImages((prev) =>
                              prev.filter((u) => u !== image)
                            );
                          }}
                        />
                      </Card>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      ) : (
        /* Original Layout - Horizontal scrollable when not both selected */
        <>
          {/* Always show images - removed !selectedImage condition */}
        <div className="flex-1 min-h-0 overflow-y-auto pr-1 px-4 pt-3 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:bg-primary/30 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent hover:[&::-webkit-scrollbar-thumb]:bg-primary/50">
          <div className="space-y-4 pb-2">
              {/* Main Product Images - Horizontal Scroll */}
              {validImages.length > 0 && (
                <div className="overflow-x-auto scrollbar-hide smooth-scroll pb-2 px-4 pt-1 snap-x snap-mandatory">
                  <div className="flex items-start min-w-max gap-3">
                    {validImages.map((image, index) => (
                      <Card
                        key={index}
                        className={`p-2 border border-border cursor-pointer transition-all hover:opacity-90 snap-start ${
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
                          className={`w-[173px] h-[164px] object-contain bg-white rounded-md ${
                            selectedImage === image ? "" : ""
                          }`}
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
                </div>
              )}

              {/* Recommended Products Section - Horizontal Scroll */}
              {filteredRecommendedImages.length > 0 ? (
                <div className="mt-4">
                  <span className="text-slate-800 text-sm font-bold mb-3 mr-56 block whitespace-nowrap">
                    {t("tryOnWidget.clothingSelection.recommendedProducts") || "Produits recommandés"}
                  </span>
                  <div className="overflow-x-auto scrollbar-hide smooth-scroll pb-2 px-4 pt-1 snap-x snap-mandatory">
                    <div className="flex items-start min-w-max gap-3">
                      {filteredRecommendedImages.map((image, index) => (
                        <Card
                          key={`recommended-${index}`}
                          className={`p-2 border border-border cursor-pointer transition-all hover:opacity-90 snap-start overflow-hidden ${
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
                            className={`w-[140px] h-[165px] object-contain bg-white rounded-md ${
                              selectedImage === image ? "" : ""
                            }`}
                            alt={t("tryOnWidget.clothingSelection.recommendedProductAlt", {
                              index: index + 1,
                              suffix: selectedImage === image ? ` - ${t("tryOnWidget.clothingSelection.currentlySelected") || "Actuellement sélectionné"}` : ""
                            }) || `Produit recommandé ${index + 1}${selectedImage === image ? ` - ${t("tryOnWidget.clothingSelection.currentlySelected") || "Actuellement sélectionné"}` : ""}`}
                            aria-label={t("tryOnWidget.clothingSelection.selectRecommendedProductAriaLabel", {
                              index: index + 1,
                              suffix: `${selectedImage === image ? ` - ${t("tryOnWidget.clothingSelection.selected") || "Sélectionné"}` : ""}`
                            }) || `Sélectionner le produit recommandé ${index + 1}${selectedImage === image ? ` - ${t("tryOnWidget.clothingSelection.selected") || "Sélectionné"}` : ""}`}
                            loading="lazy"
                            onError={() => {
                              setValidRecommendedImages((prev) =>
                                prev.filter((u) => u !== image)
                              );
                            }}
                          />
                        </Card>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-4 px-4" role="status" aria-live="polite">
                  <Card className="p-3 bg-muted/30 border-muted">
                    <p className="text-xs text-muted-foreground">
                      {t("tryOnWidget.clothingSelection.noRecommendedProducts") ||
                        "No other product images found on this page."}
                    </p>
                  </Card>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
