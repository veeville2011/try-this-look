import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import "@/styles/fonts.css";

interface TryOnWidgetProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export default function NewTryon({ isOpen, onClose }: TryOnWidgetProps) {
  const { t } = useTranslation();
  
  // Check if we're inside an iframe
  const isInIframe = typeof window !== "undefined" && window.parent !== window;

  const handleClose = (e?: React.MouseEvent) => {
    // Prevent event propagation to avoid double-triggering
    if (e) {
      e.preventDefault();
      e.stopPropagation();
      const nativeEvent = e.nativeEvent as any;
      if (nativeEvent && typeof nativeEvent.stopImmediatePropagation === 'function') {
        nativeEvent.stopImmediatePropagation();
      }
    }
    
    // Prevent multiple rapid clicks within 100ms
    const now = Date.now();
    const lastCloseTime = (window as any).__nusenseLastCloseTime || 0;
    if (now - lastCloseTime < 100) {
      return;
    }
    (window as any).__nusenseLastCloseTime = now;
    
    if (isInIframe) {
      // Send message to parent window to close the modal
      try {
        window.parent.postMessage({ type: "NUSENSE_CLOSE_WIDGET" }, "*");
      } catch (error) {
        console.error("[NewTryon] Failed to send close message:", error);
        (window as any).__nusenseLastCloseTime = 0;
      }
      return;
    }
    
    // Only call onClose if not in iframe mode
    if (onClose) {
      onClose();
    }
  };

  return (
    <div
      data-nusense-widget="true"
      className="w-full h-full flex flex-col bg-white max-w-full overflow-hidden overscroll-contain"
      style={{ fontFamily: "'Montserrat', 'Inter', 'system-ui', sans-serif" }}
      role="main"
      aria-label={t("tryOnWidget.ariaLabels.mainApplication") || "Application d'essayage virtuel"}
    >
      {/* Fixed Header - Always visible at the top, never scrolls */}
      <header className="fixed top-0 left-0 right-0 w-full z-50 bg-white px-4 sm:px-6 pt-3 sm:pt-4 pb-2 border-b border-slate-100/80 shadow-sm">
        <div className="flex justify-between items-center py-2 sm:py-2.5">
          <div className="flex items-center gap-4 flex-1">
            <div className="flex flex-col items-start gap-0.5 sm:gap-1">
              <img
                src="/assets/NUSENSE_LOGO_v1.png"
                className="object-contain h-auto transition-all duration-200"
                alt={t("tryOnWidget.brand.name") || "NUSENSE"}
                aria-label={t("tryOnWidget.brand.nameAlt") || "NUSENSE - Essayage Virtuel Alimenté par IA"}
              />
            </div>
          </div>
          <button
            onClick={handleClose}
            className="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-md hover:bg-slate-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 flex-shrink-0"
            aria-label={t("tryOnWidget.buttons.close") || "Fermer l'application"}
            title={t("tryOnWidget.buttons.close") || "Fermer"}
            type="button"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5 text-slate-600" aria-hidden="true" />
          </button>
        </div>
      </header>

      {/* Content Container - Below fixed header */}
      <div className="flex-1 pt-20 sm:pt-24 overflow-y-auto">
        <div className="flex items-center justify-center h-full min-h-[400px] px-4 sm:px-6">
          <div className="text-center">
            <h1 className="text-2xl sm:text-3xl font-semibold text-slate-800 mb-2">
              Coming Soon
            </h1>
            <p className="text-slate-600 text-base sm:text-lg">
              This feature is under development.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
