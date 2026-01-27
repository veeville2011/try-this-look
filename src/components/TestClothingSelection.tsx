import { useEffect, useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Skeleton } from "@/components/ui/skeleton";

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
  const [firstImage, setFirstImage] = useState<string | null>(null);
  const hasAutoSelectedRef = useRef(false);

  // Get the first valid image
  useEffect(() => {
    const unique = Array.from(new Set(images.filter(Boolean)));
    if (unique.length > 0) {
      const first = unique[0];
      setFirstImage(first);
      
      // Auto-select first image if no image is selected and images are available
      // Only do this once when images are first loaded
      if (!selectedImage && !hasAutoSelectedRef.current) {
        onSelect(first);
        hasAutoSelectedRef.current = true;
      }
    } else {
      setFirstImage(null);
    }
  }, [images, selectedImage, onSelect]);

  if (isLoadingImages) {
    return (
      <div className="flex flex-col bg-white w-full h-full rounded-xl border border-slate-200 overflow-hidden min-h-0">
        <div className="flex-1 flex items-center justify-center p-3 sm:p-4 min-h-0">
          <Skeleton className="w-full h-full rounded-lg" />
        </div>
      </div>
    );
  }

  if (!firstImage) {
    return (
      <div className="flex flex-col items-center justify-center bg-white w-full h-full rounded-xl border border-slate-200 p-6 sm:p-8 min-h-0">
        <p className="text-slate-500 text-xs sm:text-sm text-center">
          {t("tryOnWidget.clothingSelection.noImages") || "No clothing images available"}
        </p>
      </div>
    );
  }

  // Show the first image in preview style, similar to photo upload
  return (
    <div className="flex flex-col bg-white w-full h-full rounded-xl border border-slate-200 overflow-hidden min-h-0">
      <div className="flex-1 flex items-center justify-center p-3 sm:p-4 min-h-0 w-full h-full">
        <img
          src={firstImage}
          alt={t("tryOnWidget.clothingSelection.selectedClothing") || "Selected clothing item"}
          className="max-w-full max-h-full w-auto h-auto object-contain rounded-lg"
          style={{ maxWidth: '100%', maxHeight: '100%' }}
          loading="lazy"
        />
      </div>
    </div>
  );
}

