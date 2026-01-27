import { useTranslation } from "react-i18next";
import { Lightbulb, Check } from "lucide-react";

export default function OptimalResultsSection() {
  const { t } = useTranslation();
  
  const guidelines = [
    t("tryOnWidget.optimalResults.visibleFace") || "Visible face",
    t("tryOnWidget.optimalResults.wellFramedBody") || "Well-framed body",
    t("tryOnWidget.optimalResults.frontPose") || "Front pose",
    t("tryOnWidget.optimalResults.visibleArms") || "Visible arms",
    t("tryOnWidget.optimalResults.goodLighting") || "Good lighting",
    t("tryOnWidget.optimalResults.simpleBackground") || "Simple background",
  ];

  // Example image URL - you can replace this with an actual example image
  const exampleImageUrl = "/assets/example-photo.jpg"; // Update with actual path

  return (
    <div className="flex flex-col bg-white rounded-xl border border-slate-200 p-4 sm:p-6 h-full relative overflow-hidden">
      {/* Dotted background pattern */}
      <div 
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage: `radial-gradient(circle, #000 1px, transparent 1px)`,
          backgroundSize: '12px 12px',
        }}
        aria-hidden="true"
      />
      
      <div className="relative z-10 flex flex-col h-full">
        <div className="flex items-center gap-2 mb-4 sm:mb-5">
          <Lightbulb className="w-5 h-5 text-slate-700 flex-shrink-0" aria-hidden="true" />
          <h3 className="text-base sm:text-lg font-semibold text-slate-800">
            {t("tryOnWidget.optimalResults.title") || "For optimal results"}
          </h3>
        </div>

        <div className="flex-1 flex flex-row items-start gap-3 sm:gap-4">
          {/* Example Image - Left side */}
          <div className="flex-shrink-0">
            <div className="w-20 h-20 sm:w-28 sm:h-28 rounded-lg overflow-hidden border-2 border-slate-200 bg-white shadow-sm">
              <img
                src={exampleImageUrl}
                alt={t("tryOnWidget.optimalResults.exampleAlt") || "Example photo"}
                className="w-full h-full object-cover"
                onError={(e) => {
                  // Hide image if it fails to load
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>
          </div>

          {/* Guidelines List - Right side */}
          <div className="flex-1 min-w-0">
            <ul className="space-y-1.5 sm:space-y-2">
              {guidelines.map((guideline, index) => (
                <li key={index} className="flex items-start gap-2 text-xs sm:text-sm text-slate-700 leading-relaxed">
                  <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-green-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
                  <span className="flex-1">{guideline}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

