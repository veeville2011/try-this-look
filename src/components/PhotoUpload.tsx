import { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { X, Camera, Info, User, ArrowLeft } from "lucide-react";
import { DEMO_PHOTO_ID_MAP, DEMO_PHOTOS_ARRAY } from "@/constants/demoPhotos";

interface PhotoUploadProps {
  onPhotoUpload: (
    dataURL: string,
    isDemoPhoto?: boolean,
    demoPhotoUrl?: string
  ) => void;
  generatedPersonKeys?: Set<string>;
  matchingPersonKeys?: string[];
  initialView?: "file" | "demo" | null; // Control which view to show initially
}

export default function PhotoUpload({
  onPhotoUpload,
  generatedPersonKeys = new Set(),
  matchingPersonKeys = [],
  initialView = null,
}: PhotoUploadProps) {
  const { t } = useTranslation();
  const [preview, setPreview] = useState<string | null>(null);
  const [showFilePicker, setShowFilePicker] = useState(initialView === "file");
  const [showDemoModel, setShowDemoModel] = useState(initialView === "demo");
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
        setShowFilePicker(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleFilePickerClick = () => {
    setShowFilePicker(true);
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
        setShowDemoModel(false);
      };
      reader.readAsDataURL(blob);
    } catch (error) {
      // Error loading demo photo
    }
  };

  const handleDemoModelClick = () => {
    setShowDemoModel(true);
  };

  return (
    <>
      <div className="flex flex-col bg-white w-full h-full min-h-[456px] rounded-2xl">
        <div className="sr-only">
          {t("tryOnWidget.photoUpload.srOnlyText") || "Téléchargez votre photo ou utilisez une photo de démonstration"}
        </div>

        {!showFilePicker && !showDemoModel ? (
          <div className="flex flex-col bg-white w-full py-3.5 px-4 gap-4 rounded-2xl">
            {/* "Choisir une photo" Section - File Picker */}
            <div
              className="flex flex-col items-center self-stretch bg-slate-50 py-[63px] rounded-2xl border border-solid border-slate-200 cursor-pointer hover:bg-slate-100 transition-colors"
              onClick={handleFilePickerClick}
              role="button"
              tabIndex={0}
              aria-label={t("tryOnWidget.photoUpload.uploadAreaAriaLabel") || "Choisir une photo - Cliquez ou appuyez sur Entrée pour sélectionner une image"}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleFilePickerClick();
                }
              }}
            >
              <Camera className="w-12 h-12 text-slate-700 mb-4" strokeWidth={1.5} aria-hidden="true" />
              <div className="flex items-center gap-2">
                <span className="text-black text-base font-medium">
                  {t("tryOnWidget.photoUpload.choosePhoto") || "Choisir une photo"}
                </span>
                <Info className="w-4 h-4 text-slate-600" strokeWidth={2} aria-hidden="true" />
              </div>
            </div>

            {/* Separator OU */}
            <div className="flex items-center self-stretch">
              <div className="bg-slate-200 w-[164px] h-[1px] mr-2.5"></div>
              <span className="text-slate-800 text-base font-bold mr-[13px]">
                {t("tryOnWidget.photoUpload.or") || "OU"}
              </span>
              <div className="bg-slate-200 w-[164px] h-[1px] flex-1"></div>
            </div>

            {/* "Choisir un modèle de démonstration" Section - Demo Photo Selection */}
            <div
              className="flex flex-col items-center self-stretch bg-white rounded-2xl border border-solid border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors relative overflow-hidden"
              onClick={handleDemoModelClick}
              role="button"
              tabIndex={0}
              aria-label={t("tryOnWidget.photoUpload.chooseDemoModel") || "Choisir un modèle de démonstration"}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleDemoModelClick();
                }
              }}
            >
              <div className="flex flex-col items-center self-stretch py-[11px] mt-[61px] mb-[7px] mx-[34px] gap-2 rounded-lg">
                <User className="w-5 h-5 text-[#303030]" strokeWidth={1.5} aria-hidden="true" />
                <span className="text-[#303030] text-base font-medium">
                  {t("tryOnWidget.photoUpload.chooseDemoModel") || "Choisir un modèle de démonstration"}
                </span>
              </div>
              <div className="flex items-center">
                <div className="flex flex-col items-start w-[73px] relative mr-[1px]">
                  <img
                    src="https://storage.googleapis.com/tagjs-prod.appspot.com/v1/S4uA0usHIb/bibq0aat_expires_30_days.png"
                    className="w-[73px] h-[49px] object-contain"
                    alt=""
                    aria-hidden="true"
                  />
                  <img
                    src="https://storage.googleapis.com/tagjs-prod.appspot.com/v1/S4uA0usHIb/op2kgj0f_expires_30_days.png"
                    className="w-[88px] h-[26px] absolute bottom-0 right-[51px] object-contain"
                    alt=""
                    aria-hidden="true"
                  />
                </div>
                <img
                  src="https://storage.googleapis.com/tagjs-prod.appspot.com/v1/S4uA0usHIb/h6ofmzgz_expires_30_days.png"
                  className="w-[53px] h-[52px] object-contain"
                  alt=""
                  aria-hidden="true"
                />
                <div className="flex flex-col items-start w-[73px] relative">
                  <img
                    src="https://storage.googleapis.com/tagjs-prod.appspot.com/v1/S4uA0usHIb/nueaxiav_expires_30_days.png"
                    className="w-[73px] h-[49px] object-contain"
                    alt=""
                    aria-hidden="true"
                  />
                  <img
                    src="https://storage.googleapis.com/tagjs-prod.appspot.com/v1/S4uA0usHIb/hz00w8ly_expires_30_days.png"
                    className="w-[88px] h-[26px] absolute bottom-0 left-[52px] object-contain"
                    alt=""
                    aria-hidden="true"
                  />
                </div>
              </div>
            </div>
          </div>
        ) : showFilePicker ? (
          /* Expanded File Picker View */
          <div className="flex flex-col bg-white w-full h-full py-3.5 px-4 rounded-2xl">
            {/* Header with back button and title */}
            <div className="flex items-center gap-3 mb-3">
              <button
                onClick={() => setShowFilePicker(false)}
                className="flex items-center justify-center w-8 h-8 rounded-md hover:bg-slate-100 transition-colors flex-shrink-0"
                aria-label={t("common.back") || t("tryOnWidget.buttons.back") || "Retour"}
              >
                <ArrowLeft className="w-5 h-5 text-slate-600" aria-hidden="true" />
              </button>
              <h2 className="text-lg font-semibold text-slate-800">
                {t("tryOnWidget.photoUpload.takePhoto") || "Prenez une photo de vous"}
              </h2>
            </div>

            {/* Subtitle */}
            <div className="flex items-center gap-2 mb-4">
              <span className="text-sm text-slate-600">
                {t("tryOnWidget.photoUpload.chooseClearPhoto") || "Choisissez une photo claire de vous"}
              </span>
              <Info className="w-4 h-4 text-slate-600 flex-shrink-0" strokeWidth={2} aria-hidden="true" />
            </div>

            {/* Upload Area - Takes full remaining space */}
            <div
              className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-blue-300 bg-blue-50/30 rounded-2xl cursor-pointer hover:bg-blue-50/50 transition-colors min-h-[400px] py-8 px-4"
              onClick={() => fileInputRef.current?.click()}
              role="button"
              tabIndex={0}
              aria-label={t("tryOnWidget.photoUpload.clickToUpload") || "Cliquez pour télécharger votre photo"}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
            >
              <Camera className="w-16 h-16 text-blue-600 mb-4" strokeWidth={1.5} aria-hidden="true" />
              <div className="flex items-center gap-2">
                <span className="text-slate-700 text-base font-medium">
                  {t("tryOnWidget.photoUpload.clickToUpload") || "Cliquez pour télécharger votre photo"}
                </span>
                <Info className="w-4 h-4 text-slate-600 flex-shrink-0" strokeWidth={2} aria-hidden="true" />
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
                aria-label={t("tryOnWidget.photoUpload.selectFileAriaLabel") || "Sélectionner un fichier image"}
              />
            </div>
          </div>
        ) : showDemoModel ? (
          /* Expanded Demo Model Selection View */
          <div className="flex flex-col bg-white w-full h-full py-3.5 px-4 rounded-2xl">
            {/* Header with back button and title */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowDemoModel(false)}
                  className="flex items-center justify-center w-8 h-8 rounded-md hover:bg-slate-100 transition-colors flex-shrink-0"
                  aria-label={t("common.back") || t("tryOnWidget.buttons.back") || "Retour"}
                >
                  <ArrowLeft className="w-5 h-5 text-slate-600" aria-hidden="true" />
                </button>
                <h2 className="text-lg font-semibold text-slate-800">
                  {t("tryOnWidget.photoUpload.selectDemoModel") || "Sélectionner un modèle de démonstration"}
                </h2>
              </div>
            </div>

            {/* Demo Photos Grid - 3 rows, 4 columns */}
            <div className="flex-1 overflow-y-auto pr-1 -mr-1 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:bg-primary/30 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent hover:[&::-webkit-scrollbar-thumb]:bg-primary/50">
              <div className="grid grid-cols-4 gap-3">
                {DEMO_PHOTOS_ARRAY.map((photo) => (
                  <div
                    key={photo.id}
                    className="relative group cursor-pointer"
                    onClick={() => handleDemoPhotoSelect(photo.url)}
                    role="button"
                    tabIndex={0}
                    aria-label={t("tryOnWidget.photoUpload.selectDemoPhoto", { id: photo.id }) || `Sélectionner le modèle ${photo.id}`}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleDemoPhotoSelect(photo.url);
                      }
                    }}
                  >
                    <div className="relative rounded-md overflow-hidden border border-slate-200 group-hover:border-slate-400 transition-colors bg-white flex items-center justify-center h-[120px]">
                      <img
                        src={photo.url}
                        alt={t("tryOnWidget.photoUpload.demoPhotoAlt", { id: photo.id }) || `Modèle de démonstration ${photo.id}`}
                        className="h-full w-auto object-contain rounded-md"
                        loading="lazy"
                        onError={(e) => {
                          // Handle image load error
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                        }}
                      />
                      {(isGenerated(photo.url) || isMatching(photo.url)) && (
                        <div className="absolute top-2 right-2">
                          <div className="w-5 h-5 rounded-full bg-white/90 flex items-center justify-center shadow-sm">
                            <div className={`w-3 h-3 rounded-full ${
                              isGenerated(photo.url) ? "bg-green-500" : "bg-primary"
                            }`} aria-hidden="true" />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </div>

    </>
  );
}
