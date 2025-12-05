import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, Check } from "lucide-react";
import { CartOutfitMode, SelectedGarment } from "@/types/cartOutfit";
import { ProductImage } from "@/types/tryon";

interface CartOutfitGarmentSelectionProps {
  images: ProductImage[];
  selectedGarments: SelectedGarment[];
  onSelect: (garment: ProductImage) => void;
  onDeselect: (index: number) => void;
  mode: CartOutfitMode;
  maxItems: number;
  minItems: number;
  availableImagesWithIds?: Map<string, string | number>;
}

export default function CartOutfitGarmentSelection({
  images,
  selectedGarments,
  onSelect,
  onDeselect,
  mode,
  maxItems,
  minItems,
  availableImagesWithIds = new Map(),
}: CartOutfitGarmentSelectionProps) {
  const [validImages, setValidImages] = useState<ProductImage[]>([]);

  // Initialize with provided images
  useEffect(() => {
    const unique = Array.from(
      new Map(images.map((img) => [img.url, img])).values()
    );
    setValidImages(unique);
  }, [images]);

  // Check if garment is selected
  const isSelected = (imageUrl: string): boolean => {
    return selectedGarments.some((g) => g.url === imageUrl);
  };

  // Get selected index for removal
  const getSelectedIndex = (imageUrl: string): number => {
    return selectedGarments.findIndex((g) => g.url === imageUrl);
  };

  // Handle garment click
  const handleGarmentClick = (garment: ProductImage) => {
    if (isSelected(garment.url)) {
      // Deselect
      const index = getSelectedIndex(garment.url);
      if (index !== -1) {
        onDeselect(index);
      }
    } else {
      // Check if we can select more
      if (selectedGarments.length >= maxItems) {
        return; // Cannot select more
      }
      onSelect(garment);
    }
  };

  // Check if we can select more items
  const canSelectMore = selectedGarments.length < maxItems;
  const hasMinimumItems = selectedGarments.length >= minItems;

  if (validImages.length === 0) {
    return (
      <div role="alert" aria-live="polite">
        <Card className="p-4 sm:p-6 md:p-8 text-center bg-warning/10 border-warning">
          <p className="font-semibold text-warning text-sm sm:text-base md:text-lg">
            Aucune image de vêtement détectée
          </p>
          <p className="text-xs sm:text-sm text-muted-foreground mt-2">
            Assurez-vous d'avoir des articles dans votre panier ou sur la page
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Selection Counter */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm sm:text-base font-semibold">
            Articles Sélectionnés
          </span>
          <span
            className={`text-xs sm:text-sm px-2 py-1 rounded-full ${
              hasMinimumItems && canSelectMore
                ? "bg-primary/10 text-primary"
                : selectedGarments.length >= maxItems
                  ? "bg-warning/10 text-warning"
                  : "bg-muted text-muted-foreground"
            }`}
          >
            {selectedGarments.length} / {maxItems}
          </span>
        </div>
        {selectedGarments.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              // Deselect all
              for (let i = selectedGarments.length - 1; i >= 0; i--) {
                onDeselect(i);
              }
            }}
            className="h-8 sm:h-9 px-2.5 sm:px-3 text-xs sm:text-sm gap-1.5"
            aria-label="Effacer toutes les sélections"
          >
            <XCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden="true" />
            <span>Effacer tout</span>
          </Button>
        )}
      </div>

      {/* Validation Message */}
      {selectedGarments.length < minItems && (
        <div
          role="alert"
          className="text-xs sm:text-sm text-warning bg-warning/10 p-2 rounded"
        >
          Sélectionnez au moins {minItems} article{minItems > 1 ? "s" : ""} pour
          continuer
        </div>
      )}

      {selectedGarments.length >= maxItems && (
        <div
          role="alert"
          className="text-xs sm:text-sm text-warning bg-warning/10 p-2 rounded"
        >
          Maximum {maxItems} article{maxItems > 1 ? "s" : ""} sélectionné
          {maxItems > 1 ? "s" : ""}
        </div>
      )}

      {/* Garment Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-2 sm:gap-3 md:gap-4">
        {validImages.map((garment, index) => {
          const selected = isSelected(garment.url);
          const garmentId = availableImagesWithIds.get(garment.url);

          return (
            <Card
              key={`${garment.url}-${index}`}
              className={`overflow-hidden cursor-pointer transition-all transform hover:scale-105 relative focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
                selected
                  ? "ring-4 ring-primary shadow-lg scale-105"
                  : canSelectMore
                    ? "hover:ring-2 hover:ring-primary/50"
                    : "opacity-60 cursor-not-allowed"
              }`}
              onClick={() => canSelectMore && handleGarmentClick(garment)}
              role="button"
              tabIndex={canSelectMore ? 0 : -1}
              aria-label={`${selected ? "Désélectionner" : "Sélectionner"} l'article ${index + 1}${
                selected ? " - Sélectionné" : ""
              }`}
              aria-pressed={selected}
              onKeyDown={(e) => {
                if (canSelectMore && (e.key === "Enter" || e.key === " ")) {
                  e.preventDefault();
                  handleGarmentClick(garment);
                }
              }}
            >
              <div className="relative bg-muted/30 flex items-center justify-center overflow-hidden aspect-[3/4]">
                <img
                  src={garment.url}
                  alt={`Article ${index + 1}${selected ? " - Sélectionné" : ""}`}
                  className="w-full h-full object-contain"
                  loading="lazy"
                  onError={() => {
                    setValidImages((prev) =>
                      prev.filter((img) => img.url !== garment.url)
                    );
                  }}
                />
                {/* Selection Indicator */}
                {selected && (
                  <div className="absolute inset-0 bg-primary/10 flex items-center justify-center">
                    <div className="absolute top-2 right-2 bg-primary text-primary-foreground rounded-full p-1.5 shadow-lg">
                      <Check className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" />
                    </div>
                  </div>
                )}
                {/* Selection Number Badge */}
                {selected && (
                  <div className="absolute top-2 left-2 bg-primary text-primary-foreground rounded-full w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center text-xs sm:text-sm font-bold shadow-lg">
                    {getSelectedIndex(garment.url) + 1}
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {/* Selected Garments Summary */}
      {selectedGarments.length > 0 && (
        <Card className="p-3 sm:p-4 border-border bg-card">
          <h3 className="text-sm sm:text-base font-semibold mb-3">
            Articles Sélectionnés ({selectedGarments.length})
          </h3>
          <div className="flex flex-wrap gap-2">
            {selectedGarments.map((garment, index) => (
              <div
                key={`selected-${index}`}
                className="relative group"
              >
                <div className="relative w-16 h-20 sm:w-20 sm:h-24 rounded overflow-hidden border-2 border-primary bg-muted/30">
                  <img
                    src={garment.url}
                    alt={`Article sélectionné ${index + 1}`}
                    className="w-full h-full object-contain"
                  />
                  <div className="absolute top-0 left-0 bg-primary text-primary-foreground text-[10px] font-bold w-5 h-5 flex items-center justify-center">
                    {index + 1}
                  </div>
                  <Button
                    variant="destructive"
                    size="icon"
                    onClick={() => onDeselect(index)}
                    className="absolute top-0 right-0 h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label={`Retirer l'article ${index + 1}`}
                  >
                    <XCircle className="h-3 w-3" aria-hidden="true" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

