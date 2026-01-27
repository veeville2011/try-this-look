import { useEffect, useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface TestClothingSelectionProps {
  images: string[];
  selectedImage: string | null;
  onSelect: (imageUrl: string) => void;
  isLoadingImages?: boolean;
}

export default function TestClothingSelection({
  images,
  selectedImage,
  onSelect,
  isLoadingImages = false,
}: TestClothingSelectionProps) {
  const { t } = useTranslation();
  const [validImages, setValidImages] = useState<string[]>([]);
  const hasAutoSelectedRef = useRef(false);

  // Initialize with provided images and auto-select first image if none selected
  useEffect(() => {
    const unique = Array.from(new Set(images.filter(Boolean)));
    setValidImages(unique);

    // Auto-select first image if no image is selected and images are available
    // Only do this once when images are first loaded
    if (unique.length > 0 && !selectedImage && !hasAutoSelectedRef.current) {
      onSelect(unique[0]);
      hasAutoSelectedRef.current = true;
    }

    // Reset auto-select flag if images change significantly (new set of images)
    if (unique.length > 0 && selectedImage && !unique.includes(selectedImage)) {
      hasAutoSelectedRef.current = false;
    }
  }, [images, selectedImage, onSelect]);

  if (isLoadingImages) {
    return (
      <div className="flex flex-col bg-white w-full h-full rounded-xl border border-slate-200 p-3 sm:p-4 min-h-0">
        <Skeleton className="w-full h-full rounded-lg" />
      </div>
    );
  }

  if (validImages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center bg-white w-full h-full rounded-xl border border-slate-200 p-6 sm:p-8 min-h-0">
        <p className="text-slate-500 text-xs sm:text-sm text-center">
          {t("tryOnWidget.clothingSelection.noImages") || "No clothing images available"}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col bg-white w-full h-full rounded-xl border border-slate-200 overflow-hidden min-h-0">
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 min-h-0">
        <div className="grid grid-cols-2 gap-2 sm:gap-3">
          {validImages.map((image, index) => {
            const isSelected = selectedImage === image;
            return (
              <div
                key={index}
                className={cn(
                  "relative aspect-square rounded-md sm:rounded-lg overflow-hidden border-2 cursor-pointer transition-all",
                  isSelected
                    ? "border-primary shadow-md sm:shadow-lg ring-1 sm:ring-2 ring-primary/20"
                    : "border-slate-200 hover:border-slate-300"
                )}
                onClick={() => onSelect(image)}
                role="button"
                tabIndex={0}
                aria-label={`Select clothing image ${index + 1}${isSelected ? " - Currently selected" : ""}`}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelect(image);
                  }
                }}
              >
                <img
                  src={image}
                  alt={`Clothing item ${index + 1}`}
                  className="w-full h-full object-contain bg-white"
                  loading="lazy"
                  onError={() => {
                    setValidImages((prev) => prev.filter((u) => u !== image));
                  }}
                />
                {isSelected && (
                  <div className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 w-5 h-5 sm:w-6 sm:h-6 bg-primary rounded-full flex items-center justify-center shadow-sm">
                    <svg
                      className="w-3 h-3 sm:w-4 sm:h-4 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

