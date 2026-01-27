import { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Camera, User } from "lucide-react";
import { DEMO_PHOTOS_ARRAY } from "@/constants/demoPhotos";
import { cn } from "@/lib/utils";

interface TestPhotoUploadProps {
  onPhotoUpload: (
    dataURL: string,
    isDemoPhoto?: boolean,
    demoPhotoUrl?: string
  ) => void;
  uploadedImage?: string | null;
}

export default function TestPhotoUpload({
  onPhotoUpload,
  uploadedImage,
}: TestPhotoUploadProps) {
  const { t } = useTranslation();
  const [showFilePicker, setShowFilePicker] = useState(false);
  const [showDemoModel, setShowDemoModel] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024; // 8MB

  const resetError = () => setErrorMessage(null);

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
      onPhotoUpload(dataURL, false, undefined);
      setShowFilePicker(false);
    };
    reader.readAsDataURL(file);
  };

  const handleFilePickerClick = () => {
    setShowFilePicker(true);
    resetError();
    fileInputRef.current?.click();
  };

  const handleDemoPhotoSelect = async (url: string) => {
    try {
      resetError();
      const response = await fetch(url);
      const blob = await response.blob();
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataURL = reader.result as string;
        onPhotoUpload(dataURL, true, url);
        setShowDemoModel(false);
      };
      reader.readAsDataURL(blob);
    } catch (error) {
      setErrorMessage(
        t("tryOnWidget.photoUpload.failedToLoadDemo") ||
          "Unable to load this demo photo. Please try another."
      );
    }
  };

  const handleDemoModelClick = () => {
    setShowDemoModel(true);
  };

  // If image is uploaded, show preview
  if (uploadedImage) {
    return (
      <div className="flex flex-col bg-white w-full h-full rounded-xl border border-slate-200 overflow-hidden min-h-0">
        <div className="flex-1 flex items-center justify-center p-3 sm:p-4 min-h-0 w-full h-full">
          <img
            src={uploadedImage}
            alt={t("tryOnWidget.ariaLabels.uploadedPhoto") || "Uploaded photo"}
            className="max-w-full max-h-full w-auto h-auto object-contain rounded-lg"
            style={{ maxWidth: '100%', maxHeight: '100%' }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col bg-white w-full h-full rounded-xl border border-slate-200 min-h-0">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
        aria-label={t("tryOnWidget.photoUpload.selectFile") || "Select image file"}
      />

      {errorMessage && (
        <div
          role="alert"
          aria-live="assertive"
          className="mx-4 mt-4 rounded-lg border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-sm"
        >
          {errorMessage}
        </div>
      )}

      {!showFilePicker && !showDemoModel ? (
        <div className="flex flex-col bg-white w-full h-full py-4 sm:py-6 px-3 sm:px-4 gap-3 sm:gap-4 min-h-0">
          {/* Demo Model Selection */}
          <div
            className="flex flex-col items-center justify-center bg-white rounded-lg sm:rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors py-6 sm:py-8 flex-1 min-h-0"
            onClick={handleDemoModelClick}
            role="button"
            tabIndex={0}
            aria-label={t("tryOnWidget.photoUpload.chooseDemoModel") || "Choose a demo model"}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleDemoModelClick();
              }
            }}
          >
            <User className="w-6 h-6 sm:w-8 sm:h-8 text-slate-600 mb-2" aria-hidden="true" />
            <span className="text-slate-700 text-sm sm:text-base font-medium text-center px-2">
              {t("tryOnWidget.photoUpload.chooseDemoModel") || "Choose a demo model"}
            </span>
          </div>

          {/* Separator */}
          <div className="flex items-center flex-shrink-0">
            <div className="bg-slate-200 flex-1 h-[1px] mr-2 sm:mr-2.5"></div>
            <span className="text-slate-500 text-xs sm:text-sm font-medium">OR</span>
            <div className="bg-slate-200 flex-1 h-[1px] ml-2 sm:ml-2.5"></div>
          </div>

          {/* File Upload */}
          <div
            className="flex flex-col items-center justify-center bg-white rounded-lg sm:rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors py-6 sm:py-8 flex-1 min-h-0"
            onClick={handleFilePickerClick}
            role="button"
            tabIndex={0}
            aria-label={t("tryOnWidget.photoUpload.uploadPhoto") || "Upload your photo"}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleFilePickerClick();
              }
            }}
          >
            <Camera className="w-6 h-6 sm:w-8 sm:h-8 text-slate-600 mb-2" aria-hidden="true" />
            <span className="text-slate-700 text-sm sm:text-base font-medium text-center px-2">
              {t("tryOnWidget.photoUpload.uploadPhoto") || "Upload your photo"}
            </span>
          </div>
        </div>
      ) : showDemoModel ? (
        <div className="flex flex-col bg-white w-full h-full p-3 sm:p-4 min-h-0">
          <div className="flex items-center justify-between mb-3 sm:mb-4 flex-shrink-0">
            <h3 className="text-base sm:text-lg font-semibold text-slate-800">
              {t("tryOnWidget.photoUpload.selectDemoModel") || "Select a demo model"}
            </h3>
            <button
              onClick={() => setShowDemoModel(false)}
              className="text-slate-600 hover:text-slate-800 text-xl sm:text-2xl leading-none w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center rounded hover:bg-slate-100 transition-colors"
              aria-label="Close demo model selection"
            >
              ×
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:gap-3 overflow-y-auto flex-1 min-h-0 pb-2">
            {DEMO_PHOTOS_ARRAY.map((url, index) => (
              <div
                key={index}
                className="relative aspect-square rounded-lg overflow-hidden border border-slate-200 cursor-pointer hover:border-primary transition-colors"
                onClick={() => handleDemoPhotoSelect(url)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleDemoPhotoSelect(url);
                  }
                }}
              >
                <img
                  src={url}
                  alt={`Demo model ${index + 1}`}
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

