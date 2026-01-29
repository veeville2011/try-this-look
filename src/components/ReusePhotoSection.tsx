import { useTranslation } from "react-i18next";
import { Camera } from "lucide-react";
import { cn } from "@/lib/utils";

interface ReusePhotoSectionProps {
  uploadedImages: Array<{ id: string; personImageUrl: string }>;
  onSelectImage: (imageUrl: string) => void;
}

export default function ReusePhotoSection({
  uploadedImages,
  onSelectImage,
}: ReusePhotoSectionProps) {
  const { t } = useTranslation();
  
  // Show up to 5 slots, fill with uploaded images
  const slots = Array.from({ length: 5 }).map((_, index) => {
    return uploadedImages[index] || null;
  });

  return (
    <div className="flex flex-col bg-white rounded-xl border border-slate-200 p-4 sm:p-6 h-full">
      <div className="flex items-center gap-2 mb-4 sm:mb-5">
        <Camera className="w-5 h-5 text-slate-700 flex-shrink-0" aria-hidden="true" />
        <h3 className="text-base sm:text-lg font-semibold text-slate-800">
          {t("tryOnWidget.reusePhoto.title") || "Reuse a photo"}
        </h3>
      </div>
      
      <div className="grid grid-cols-5 gap-2 sm:gap-3 flex-1">
        {slots.map((image, index) => (
          <div
            key={index}
            className={cn(
              "aspect-square rounded-lg border-2 overflow-hidden transition-all",
              image
                ? "border-slate-300 hover:border-slate-400 hover:shadow-md cursor-pointer"
                : "border-slate-200 bg-slate-50"
            )}
            onClick={() => image && onSelectImage(image.personImageUrl)}
            role={image ? "button" : undefined}
            tabIndex={image ? 0 : undefined}
            aria-label={
              image
                ? t("tryOnWidget.reusePhoto.selectPhoto", { index: index + 1 }) ||
                  `Select photo ${index + 1}`
                : undefined
            }
            onKeyDown={(e) => {
              if (image && (e.key === "Enter" || e.key === " ")) {
                e.preventDefault();
                onSelectImage(image.personImageUrl);
              }
            }}
          >
            {image ? (
              <img
                src={image.personImageUrl}
                alt={t("tryOnWidget.reusePhoto.photoAlt", { index: index + 1 }) || `Photo ${index + 1}`}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-slate-50">
                <div className="w-6 h-6 sm:w-8 sm:h-8 border-2 border-dashed border-slate-300 rounded" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

