import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle } from "lucide-react";
import { useEffect, useState } from "react";

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
}: ClothingSelectionProps) {
  const [validImages, setValidImages] = useState<string[]>([]);
  const [validRecommendedImages, setValidRecommendedImages] = useState<string[]>([]);

  // Check if an image has been generated before
  const isGenerated = (imageUrl: string): boolean => {
    const clothingKey = availableImagesWithIds.get(imageUrl);
    if (!clothingKey) return false;
    return generatedClothingKeys.has(String(clothingKey));
  };

  // Check if both person and clothing keys exist in the same generation record
  // Green color only shows when BOTH are selected AND they exist together
  const areBothKeysGenerated = (imageUrl: string): boolean => {
    // Only check if this clothing item is currently selected
    if (imageUrl !== selectedImage) return false;
    
    const clothingKey = availableImagesWithIds.get(imageUrl);
    const personKey = selectedDemoPhotoUrl ? demoPhotoIdMap.get(selectedDemoPhotoUrl) : null;
    
    if (!clothingKey || !personKey) return false;
    
    // Check if this specific combination exists in the same record
    return generatedKeyCombinations.has(`${String(personKey)}-${String(clothingKey)}`);
  };

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
            Aucune image de vêtement détectée sur cette page
          </p>
          <p className="text-xs sm:text-sm text-muted-foreground mt-2">
            Assurez-vous d'être sur une page produit Shopify
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Heading intentionally removed per design */}

      {!selectedImage && (
        <>
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
                  aria-label={`Sélectionner le vêtement ${index + 1}${selectedImage === image ? " - Sélectionné" : ""}${isGenerated(image) ? " - Déjà généré" : ""}`}
                  aria-pressed={selectedImage === image}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelect(image);
                    }
                  }}
                >
                  <div className="relative bg-muted/30 flex items-center justify-center overflow-hidden">
                    <img
                      src={image}
                      alt={`Image du vêtement ${index + 1}${selectedImage === image ? " - Actuellement sélectionné" : ""}`}
                      className="w-full h-auto object-contain"
                      loading="lazy"
                      onError={() => {
                        setValidImages((prev) => prev.filter((u) => u !== image));
                      }}
                    />
                    {/* Single tick indicator with outlined circle for generated items */}
                    {isGenerated(image) && (
                      <div className="absolute top-2 right-2">
                        <CheckCircle 
                          className={`h-4 w-4 sm:h-5 sm:w-5 fill-background ${areBothKeysGenerated(image) ? 'text-green-500' : 'text-primary'}`} 
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
                Produits Recommandés
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
                        aria-label={`Sélectionner le produit recommandé ${index + 1}${selectedImage === image ? " - Sélectionné" : ""}${isGenerated(image) ? " - Déjà généré" : ""}`}
                        aria-pressed={selectedImage === image}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            onSelect(image);
                          }
                        }}
                      >
                        <div className="relative bg-muted/30 flex items-center justify-center overflow-hidden aspect-[3/4]">
                          <img
                            src={image}
                            alt={`Produit recommandé ${index + 1}${selectedImage === image ? " - Actuellement sélectionné" : ""}`}
                            className="w-full h-full object-contain"
                            loading="lazy"
                            onError={() => {
                              setValidRecommendedImages((prev) => prev.filter((u) => u !== image));
                            }}
                          />
                          {/* Single tick indicator with outlined circle for generated items */}
                          {isGenerated(image) && (
                            <div className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2">
                              <CheckCircle 
                                className={`h-3.5 w-3.5 sm:h-4 sm:w-4 fill-background ${areBothKeysGenerated(image) ? 'text-green-500' : 'text-primary'}`} 
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
        </>
      )}

      {selectedImage && (
        <div role="status" aria-live="polite">
          <Card className="p-3 sm:p-4">
            <div className="flex items-center justify-between mb-2 sm:mb-3 gap-2">
              <p className="font-semibold text-sm sm:text-base md:text-lg">Article Sélectionné</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onSelect("")}
                className="group h-8 sm:h-9 px-2.5 sm:px-3 text-xs sm:text-sm flex-shrink-0 gap-1.5 border-border text-foreground hover:bg-muted hover:border-muted-foreground/20 hover:text-muted-foreground transition-all duration-200 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                aria-label="Effacer la sélection du vêtement"
              >
                <XCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 transition-transform group-hover:scale-110 duration-200" aria-hidden="true" />
                <span>Effacer</span>
              </Button>
            </div>
            <div className="aspect-[3/4] rounded overflow-hidden border border-border bg-card flex items-center justify-center shadow-sm relative">
              <img
                src={selectedImage}
                alt="Vêtement actuellement sélectionné pour l'essayage virtuel"
                className="h-full w-auto object-contain"
              />
              {/* Single tick indicator with outlined circle for generated items */}
              {isGenerated(selectedImage) && (
                <div className="absolute top-2 right-2">
                  <CheckCircle 
                    className={`h-5 w-5 sm:h-6 sm:w-6 fill-background ${areBothKeysGenerated(selectedImage) ? 'text-green-500' : 'text-primary'}`} 
                    aria-hidden="true" 
                  />
                  <span className="sr-only">Cet article a déjà été généré</span>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
