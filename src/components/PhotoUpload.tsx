import { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, Image as ImageIcon, Camera, CheckCircle } from "lucide-react";

interface PhotoUploadProps {
  onPhotoUpload: (
    dataURL: string,
    isDemoPhoto?: boolean,
    demoPhotoUrl?: string
  ) => void;
  generatedPersonKeys?: Set<string>;
  matchingPersonKeys?: string[];
}

// Fixed IDs for demo pictures - these will be sent as personKey to the fashion API
const DEMO_PHOTOS = [
  { url: "/assets/demo_pics/p1.jpg", id: "new_demo_person_1" },
  { url: "/assets/demo_pics/p2.jpg", id: "new_demo_person_2" },
  { url: "/assets/demo_pics/p3.jpg", id: "new_demo_person_3" },
  { url: "/assets/demo_pics/p4.jpg", id: "new_demo_person_4" },
] as const;

// Map demo photo URLs to their fixed IDs
export const DEMO_PHOTO_ID_MAP = new Map<string, string>(
  DEMO_PHOTOS.map((photo) => [photo.url, photo.id])
);

export default function PhotoUpload({
  onPhotoUpload,
  generatedPersonKeys = new Set(),
  matchingPersonKeys = [],
}: PhotoUploadProps) {
  const { t } = useTranslation();
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check if a demo photo has been generated before
  const isGenerated = (photoUrl: string): boolean => {
    const personKey = DEMO_PHOTO_ID_MAP.get(photoUrl);
    if (!personKey) return false;
    return generatedPersonKeys.has(String(personKey));
  };

  // Check if a demo photo matches the selected clothing (from key mappings API)
  const isMatching = (photoUrl: string): boolean => {
    const personKey = DEMO_PHOTO_ID_MAP.get(photoUrl);
    if (!personKey || matchingPersonKeys.length === 0) return false;
    return matchingPersonKeys.includes(String(personKey));
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataURL = reader.result as string;
        setPreview(dataURL);
        onPhotoUpload(dataURL, false, undefined);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDemoPhotoSelect = async (url: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataURL = reader.result as string;
        setPreview(dataURL);
        onPhotoUpload(dataURL, true, url);
      };
      reader.readAsDataURL(blob);
    } catch (error) {
      // Error loading demo photo
    }
  };

  return (
    <div className="space-y-4 sm:space-y-5 md:space-y-6">
      <div className="sr-only">
        {t("tryOnWidget.photoUpload.srOnlyText") || "Téléchargez votre photo ou utilisez une photo de démonstration"}
      </div>

      {/* Upload Area */}
      <Card className="p-4 sm:p-5 md:p-6 lg:p-8 border-2 border-dashed border-primary/30 bg-card hover:border-primary/50 hover:bg-accent/30 transition-all duration-200 cursor-pointer flex items-center group focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2">
        <div
          className="text-center w-full"
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          aria-label={t("tryOnWidget.photoUpload.uploadAreaAriaLabel") || "Télécharger votre photo - Cliquez ou appuyez sur Entrée pour sélectionner une image"}
          aria-describedby="upload-instructions"
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
        >
          <div
            className="w-12 h-12 sm:w-16 sm:h-16 md:w-20 md:h-20 mx-auto mb-3 sm:mb-4 rounded bg-primary/10 group-hover:bg-primary/15 flex items-center justify-center transition-colors duration-200"
            aria-hidden="true"
          >
            <Camera className="w-6 h-6 sm:w-8 sm:h-8 md:w-10 md:h-10 text-primary transition-transform duration-200 group-hover:scale-110" />
          </div>
          <p className="text-sm sm:text-base md:text-lg font-semibold mb-1 sm:mb-2 px-2">
            {t("tryOnWidget.photoUpload.clickToUpload") || "Cliquez pour télécharger votre photo"}
          </p>
          <p
            id="upload-instructions"
            className="text-[10px] sm:text-xs text-muted-foreground px-2"
          >
            {t("tryOnWidget.photoUpload.acceptedFormats") || "Formats acceptés : JPG, PNG (max 10 Mo)"}
          </p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
          aria-label={t("tryOnWidget.photoUpload.selectFileAriaLabel") || "Sélectionner un fichier image"}
          aria-describedby="upload-instructions"
        />
      </Card>

      {/* Separator OU */}
      <div className="flex items-center gap-2 sm:gap-3 md:gap-4 my-1 sm:my-2">
        <div className="h-px flex-1 bg-border" />
        <span className="px-3 sm:px-4 py-1 sm:py-2 rounded-md bg-card border border-border text-muted-foreground font-semibold text-xs sm:text-sm whitespace-nowrap">
          {t("tryOnWidget.photoUpload.or") || "ou"}
        </span>
        <div className="h-px flex-1 bg-border" />
      </div>

      {/* Demo Photos */}
      <div>
        <h4 className="font-semibold mb-2 sm:mb-3 text-sm sm:text-base md:text-lg flex items-center gap-2">
          <ImageIcon className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
          <span>{t("tryOnWidget.photoUpload.selectDemoPhoto") || "Sélectionner une photo de démonstration"}</span>
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 md:gap-4">
          {DEMO_PHOTOS.map((photo, index) => (
            <Card
              key={photo.id}
              className="overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary transition-all transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              onClick={() => handleDemoPhotoSelect(photo.url)}
              role="button"
              tabIndex={0}
              aria-label={`${t("tryOnWidget.photoUpload.selectDemoPhotoAriaLabel", { index: index + 1 }) || `Sélectionner la photo de démonstration ${index + 1}`}${isGenerated(photo.url) ? ` - ${t("tryOnWidget.photoUpload.alreadyGenerated") || "Déjà généré"}` : ""}`}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleDemoPhotoSelect(photo.url);
                }
              }}
            >
              <div className="relative w-full bg-muted/30 flex items-center justify-center overflow-hidden">
                <img
                  src={photo.url}
                  alt={t("tryOnWidget.photoUpload.demoPhotoAlt", { index: index + 1 }) || `Photo de démonstration ${index + 1} pour l'essayage virtuel`}
                  className="w-full h-auto object-contain"
                  loading="lazy"
                />
                {/* Tick indicators: show only when the API returned a matching person */}
                {isMatching(photo.url) && (
                  <div className="absolute top-2 right-2">
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
      </div>

      {preview && (
        <div role="status" aria-live="polite">
          <Card className="p-3 sm:p-4 bg-success/10 border-success">
            <div className="flex items-center gap-2 sm:gap-3 md:gap-4">
              <div className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 bg-muted/30 rounded border border-border flex items-center justify-center overflow-hidden flex-shrink-0 shadow-sm">
                <img
                  src={preview}
                  alt={t("tryOnWidget.photoUpload.previewAlt") || "Aperçu de la photo téléchargée"}
                  className="h-full w-auto object-contain"
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-success text-sm sm:text-base">
                  {t("tryOnWidget.photoUpload.uploadSuccess") || "Photo téléchargée avec succès !"}
                </p>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  {t("tryOnWidget.photoUpload.nextStepHint") || "Passez à l'étape suivante pour sélectionner un vêtement"}
                </p>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
