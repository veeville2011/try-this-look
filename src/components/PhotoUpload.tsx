import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { X, Camera, User, ArrowLeft, CheckCircle, Check, ChevronLeft, ChevronRight } from "lucide-react";
import { DEMO_PHOTO_ID_MAP, DEMO_PHOTOS_ARRAY } from "@/constants/demoPhotos";
import { cn } from "@/lib/utils";

interface PhotoUploadProps {
  onPhotoUpload: (
    dataURL: string,
    isDemoPhoto?: boolean,
    demoPhotoUrl?: string
  ) => void;
  generatedPersonKeys?: Set<string>;
  matchingPersonKeys?: string[];
  initialView?: "file" | "demo" | null; // Control which view to show initially
  showDemoPhotoStatusIndicator?: boolean; // Controls the small top-right dot overlay on demo photos
  isMobile?: boolean; // Used for mobile-specific styling only
}

export default function PhotoUpload({
  onPhotoUpload,
  generatedPersonKeys = new Set(),
  matchingPersonKeys = [],
  initialView = null,
  showDemoPhotoStatusIndicator = true,
  isMobile = false,
}: PhotoUploadProps) {
  const { t } = useTranslation();
  const [showFilePicker, setShowFilePicker] = useState(initialView === "file");
  const [showDemoModel, setShowDemoModel] = useState(initialView === "demo");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // Carousel state - use only first 2 demo photos for examples
  const examplePhotos = DEMO_PHOTOS_ARRAY.slice(0, 2);
  const [currentExampleIndex, setCurrentExampleIndex] = useState(0);

  const MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024; // 8MB

  const resetError = () => setErrorMessage(null);

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
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setErrorMessage(
        t("tryOnWidget.photoUpload.invalidType") ||
          "Please upload an image file (jpg, jpeg, png, webp)."
      );
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setErrorMessage(
        t("tryOnWidget.photoUpload.fileTooLarge", { maxMB: 8 }) ||
          "The selected file is too large. Please choose an image under 8MB."
      );
      return;
    }

    resetError();
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataURL = reader.result as string;
      // Immediately upload and close (same behavior for mobile and desktop)
      onPhotoUpload(dataURL, false, undefined);
      setShowFilePicker(false);
    };
    reader.readAsDataURL(file);
  };

  const handleFilePickerClick = () => {
    setShowFilePicker(true);
    resetError();
    // Reset carousel to first image when opening file picker
    setCurrentExampleIndex(0);
  };

  const handleDemoPhotoSelect = async (url: string) => {
    try {
      resetError();
      const response = await fetch(url);
      const blob = await response.blob();
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataURL = reader.result as string;
        // Immediately upload and close (same behavior for mobile and desktop)
        onPhotoUpload(dataURL, true, url);
        setShowDemoModel(false);
      };
      reader.readAsDataURL(blob);
    } catch (error) {
      // Error loading demo photo
      setErrorMessage(
        t("tryOnWidget.photoUpload.failedToLoadDemo") ||
          "Unable to load this demo photo. Please try another."
      );
    }
  };

  const handleDemoModelClick = () => {
    setShowDemoModel(true);
  };

  // Carousel navigation functions
  const handlePreviousExample = () => {
    setCurrentExampleIndex((prev) => (prev > 0 ? prev - 1 : examplePhotos.length - 1));
  };

  const handleNextExample = () => {
    setCurrentExampleIndex((prev) => (prev < examplePhotos.length - 1 ? prev + 1 : 0));
  };

  const handleDotClick = (index: number) => {
    setCurrentExampleIndex(index);
  };

  // Auto-advance carousel every 5 seconds
  useEffect(() => {
    // Only auto-advance if there's more than one slide
    if (examplePhotos.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentExampleIndex((prev) => (prev < examplePhotos.length - 1 ? prev + 1 : 0));
    }, 5000); // 5 seconds

    // Cleanup interval on unmount
    return () => clearInterval(interval);
  }, [examplePhotos.length]);

  return (
    <>
      <div className="flex flex-col bg-white w-full h-full min-h-[456px] rounded-2xl max-w-full overflow-x-hidden">
        <div className="sr-only">
          {t("tryOnWidget.photoUpload.srOnlyText") || "Téléchargez votre photo ou utilisez une photo de démonstration"}
        </div>

        {errorMessage && (
          <div
            role="alert"
            aria-live="assertive"
            className="mx-4 mb-3 rounded-lg border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-sm"
          >
            {errorMessage}
          </div>
        )}

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
              <span className="text-black text-base font-medium">
                {t("tryOnWidget.photoUpload.choosePhoto") || "Choisir une photo"}
              </span>
            </div>

            {/* Separator OU */}
            <div className="flex items-center self-stretch">
              <div className="bg-slate-200 flex-1 h-[1px] mr-2.5"></div>
              <span className="text-slate-800 text-base font-bold mr-[13px]">
                {t("tryOnWidget.photoUpload.or") || "OU"}
              </span>
              <div className="bg-slate-200 flex-1 h-[1px]"></div>
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
              <div className="flex flex-col items-center justify-center text-center w-full py-[11px] mt-[61px] mb-[7px] px-4 gap-2 rounded-lg">
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
          /* Expanded File Picker View - New Design Matching Screenshot */
          <div className="flex flex-col bg-white w-full h-full px-4 pb-4 rounded-2xl overflow-hidden">
            {/* Header with back button and title side-by-side */}
            <div className="flex items-center gap-2 mb-1 flex-shrink-0">
              <button
                onClick={() => setShowFilePicker(false)}
                className="flex items-center justify-center w-8 h-8 rounded-md hover:bg-slate-100 transition-colors flex-shrink-0"
                aria-label={t("common.back") || t("tryOnWidget.buttons.back") || "Retour"}
              >
                <ArrowLeft className="w-5 h-5 text-slate-800" aria-hidden="true" />
              </button>
              <h2 className="text-xl font-semibold text-slate-800">
                {t("tryOnWidget.photoUpload.takePhoto") || "Prenez une photo de vous"}
              </h2>
            </div>

            {/* Subtitle */}
            <div className="mb-3 flex-shrink-0">
              <p className="text-sm text-slate-800">
                {t("tryOnWidget.photoUpload.chooseClearPhoto") || "Choisissez une photo claire de vous"}
              </p>
            </div>

            {/* Example Correct Box */}
            <div className="relative mb-4 p-3 border border-slate-200 rounded-xl bg-white flex-shrink-0 min-h-[200px] sm:min-h-[240px]">
              <div className="flex flex-col h-full">
                {/* Heading - shown for both slides */}
                <div className="mb-2 sm:mb-3 flex-shrink-0">
                  <span className="text-sm font-semibold text-slate-800">
                    {t("tryOnWidget.photoUpload.correctExample") || "Correct example"}
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 items-start flex-1">
                  {/* Left Image - Always shown */}
                  <div className="relative flex-shrink-0 flex flex-col">
                    <div className="relative w-[140px]">
                      {examplePhotos.length > 0 && (
                        <div className="relative w-full">
                          <img
                            src={examplePhotos[0].url}
                            alt={t("tryOnWidget.photoUpload.examplePhotoAlt") || "Exemple de photo correcte"}
                            className="w-full h-auto object-contain rounded-lg border border-slate-200 bg-white max-h-[140px] sm:max-h-[170px]"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              // Try fallback to first demo photo if current fails
                              if (DEMO_PHOTOS_ARRAY.length > 0 && target.src !== DEMO_PHOTOS_ARRAY[0].url) {
                                target.src = DEMO_PHOTOS_ARRAY[0].url;
                              } else {
                                target.style.display = 'none';
                              }
                            }}
                          />
                          {/* Green checkmark overlay on top-left corner */}
                          <div className="absolute top-0 left-0 bg-green-600 rounded-full p-1 shadow-sm">
                            <Check className="w-4 h-4 text-white" strokeWidth={3} aria-hidden="true" />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right side content - Conditionally render checklist or second image */}
                  {currentExampleIndex === 0 ? (
                    /* First slide: Show checklist with "Make sure" heading and pointers */
                    <div className="flex flex-col min-w-0 flex-1 justify-start">
                      {/* Heading for checklist */}
                      <div className="mb-2 sm:mb-3 flex-shrink-0">
                        <span className="text-sm font-semibold text-slate-800">
                          {t("tryOnWidget.photoUpload.makeSure") || "Make sure your photo has:"}
                        </span>
                      </div>
                      
                      {/* Checklist items */}
                      <div className="flex flex-col gap-2 sm:gap-2.5 flex-shrink-0">
                        <div className="flex items-center gap-2.5">
                          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" aria-hidden="true" />
                          <span className="text-sm text-slate-800">
                            {t("tryOnWidget.photoUpload.checklist.visibleFace") || "Face visible"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2.5">
                          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" aria-hidden="true" />
                          <span className="text-sm text-slate-800">
                            {t("tryOnWidget.photoUpload.checklist.fullBody") || "Full body"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2.5">
                          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" aria-hidden="true" />
                          <span className="text-sm text-slate-800">
                            {t("tryOnWidget.photoUpload.checklist.simpleBackground") || "Simple background"}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Second slide: Show second image side by side with first image */
                    examplePhotos.length > 1 && (
                      <div className="relative flex-shrink-0 flex flex-col">
                        <div className="relative w-[140px]">
                          <div className="relative w-full">
                            <img
                              src={examplePhotos[1].url}
                              alt={t("tryOnWidget.photoUpload.examplePhotoAlt") || "Exemple de photo correcte"}
                              className="w-full h-auto max-h-[140px] sm:max-h-[170px] object-contain rounded-lg border border-slate-200 bg-white"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                // Try fallback to second demo photo if current fails
                                if (DEMO_PHOTOS_ARRAY.length > 1 && target.src !== DEMO_PHOTOS_ARRAY[1].url) {
                                  target.src = DEMO_PHOTOS_ARRAY[1].url;
                                } else {
                                  target.style.display = 'none';
                                }
                              }}
                            />
                            {/* Green checkmark overlay on top-left corner */}
                            <div className="absolute top-0 left-0 bg-green-600 rounded-full p-1 shadow-sm">
                              <Check className="w-4 h-4 text-white" strokeWidth={3} aria-hidden="true" />
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  )}
                </div>

                {/* Carousel navigation - dots with arrows on sides */}
                {examplePhotos.length > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-3">
                    {/* Left arrow */}
                    <button
                      onClick={handlePreviousExample}
                      className="p-1.5 rounded-full bg-white border border-slate-200 shadow-sm hover:bg-slate-50 hover:border-slate-300 hover:shadow-md active:bg-slate-100 active:shadow-sm transition-all duration-200 flex-shrink-0"
                      aria-label={t("tryOnWidget.photoUpload.previousExample") || "Exemple précédent"}
                      type="button"
                    >
                      <ChevronLeft className="w-4 h-4 text-slate-800" aria-hidden="true" />
                    </button>
                    
                    {/* Carousel dots */}
                    <div className="flex items-center gap-1.5">
                      {examplePhotos.map((_, index) => (
                        <button
                          key={index}
                          onClick={() => handleDotClick(index)}
                          className={`w-2 h-2 rounded-full transition-colors ${
                            index === currentExampleIndex ? 'bg-primary' : 'bg-slate-300'
                          }`}
                          aria-label={`${t("tryOnWidget.photoUpload.examplePhotoAlt") || "Exemple"} ${index + 1}`}
                          type="button"
                        />
                      ))}
                    </div>
                    
                    {/* Right arrow */}
                    <button
                      onClick={handleNextExample}
                      className="p-1.5 rounded-full bg-white border border-slate-200 shadow-sm hover:bg-slate-50 hover:border-slate-300 hover:shadow-md active:bg-slate-100 active:shadow-sm transition-all duration-200 flex-shrink-0"
                      aria-label={t("tryOnWidget.photoUpload.nextExample") || "Exemple suivant"}
                      type="button"
                    >
                      <ChevronRight className="w-4 h-4 text-slate-800" aria-hidden="true" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Upload Area - Dashed blue rectangle */}
            <div
              className="flex flex-col items-center justify-center text-center border-2 border-dashed border-blue-500 bg-blue-50/30 rounded-xl cursor-pointer hover:bg-blue-50/50 hover:border-blue-600 transition-all py-4 sm:py-6 px-4 mb-0 flex-shrink-0 min-h-[80px] sm:min-h-[100px]"
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
              <Camera className="w-10 h-10 sm:w-12 sm:h-12 text-blue-600 mb-2 sm:mb-3" strokeWidth={1.5} aria-hidden="true" />
              <span className="text-slate-800 text-sm sm:text-base font-medium mb-1 sm:mb-1.5 block">
                {t("tryOnWidget.photoUpload.clickToUpload") || "Cliquez pour télécharger votre photo"}
              </span>
              <span className="text-xs text-slate-600 block">
                {t("tryOnWidget.photoUpload.fileFormat") || "JPG / PNG • Photo entière du corps"}
              </span>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png"
                onChange={handleFileSelect}
                className="hidden"
                aria-label={t("tryOnWidget.photoUpload.selectFileAriaLabel") || "Sélectionner un fichier image"}
              />
            </div>
          </div>
        ) : showDemoModel ? (
          /* Expanded Demo Model Selection View */
          <div className="flex flex-col bg-white w-full h-full py-3.5 px-4 rounded-2xl overflow-hidden">
            {/* Header with back button and title */}
            <div className="flex items-start justify-between mb-4 flex-shrink-0">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <button
                  onClick={() => setShowDemoModel(false)}
                  className="flex items-center justify-center w-8 h-8 rounded-md hover:bg-slate-100 transition-colors flex-shrink-0 mt-0.5"
                  aria-label={t("common.back") || t("tryOnWidget.buttons.back") || "Retour"}
                >
                  <ArrowLeft className="w-5 h-5 text-slate-600" aria-hidden="true" />
                </button>
                <h2 className={`text-lg font-semibold text-slate-800 ${isMobile ? 'line-clamp-2 flex-1' : ''}`}>
                  {t("tryOnWidget.photoUpload.selectDemoModel") || "Sélectionner un modèle de démonstration"}
                </h2>
              </div>
            </div>

            {/* Demo Photos Grid - Mobile: 3 columns (3x4), Desktop: 4 columns */}
            {/* Mobile: Fixed height for 3.5 rows (3 full + 1 half) with scrollbar */}
            {/* Desktop: Flexible height with scrollbar (unchanged) */}
            <div className={cn(
              isMobile 
                ? "flex-shrink-0 h-[456px] overflow-y-auto pr-1 -mr-1 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:bg-primary/30 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent hover:[&::-webkit-scrollbar-thumb]:bg-primary/50"
                : "flex-1 overflow-y-auto pr-1 -mr-1 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:bg-primary/30 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent hover:[&::-webkit-scrollbar-thumb]:bg-primary/50"
            )}>
              <div className={`grid ${isMobile ? 'grid-cols-3' : 'grid-cols-2'} sm:grid-cols-3 md:grid-cols-4 gap-3`}>
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
                      {showDemoPhotoStatusIndicator && (isGenerated(photo.url) || isMatching(photo.url)) && (
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
