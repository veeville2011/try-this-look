import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { X, LogIn, Loader2, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RadialProgress } from "@/components/ui/radial-progress";
import { cn } from "@/lib/utils";
import { detectStoreOrigin } from "@/utils/shopifyIntegration";
import HorizontalImageList from "@/components/HorizontalImageList";
import {
  fetchCustomerImageGenerations,
  fetchUploadedImages,
  type CustomerImageGeneration,
  type UploadedImage,
} from "@/services/tryonApi";
import "@/styles/fonts.css";

interface CustomerInfo {
  id?: string | null;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}

interface TryOnWidgetProps {
  isOpen?: boolean;
  onClose?: () => void;
  customerInfo?: CustomerInfo | null;
}

export default function NewTryon({ isOpen, onClose, customerInfo }: TryOnWidgetProps) {
  const { t } = useTranslation();
  
  // Check if we're inside an iframe
  const isInIframe = typeof window !== "undefined" && window.parent !== window;
  
  // Redirect state
  const [isRedirecting, setIsRedirecting] = useState(false);
  
  // Tutorial demo animation state - 4 steps
  const [tutorialStep, setTutorialStep] = useState<1 | 2 | 3 | 4>(1);
  const [progress, setProgress] = useState(0);

  // Image data state
  const [generatedImages, setGeneratedImages] = useState<CustomerImageGeneration[]>([]);
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const [loadingGeneratedImages, setLoadingGeneratedImages] = useState(false);
  const [loadingUploadedImages, setLoadingUploadedImages] = useState(false);
  const [generatedImagesError, setGeneratedImagesError] = useState<string | null>(null);
  const [uploadedImagesError, setUploadedImagesError] = useState<string | null>(null);
  
  // Infinite loop tutorial animation
  useEffect(() => {
    if (!customerInfo?.id) {
      // Simulate progress for step 3 (generating)
      const progressInterval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 100) return 0;
          return prev + 2;
        });
      }, 100);
      
      const stepInterval = setInterval(() => {
        setTutorialStep((prev) => {
          if (prev === 1) return 2; // Upload → Select clothing
          if (prev === 2) return 3; // Select → Generating
          if (prev === 3) return 4; // Generating → Result
          return 1; // Result → Loop back to Upload
        });
      }, 3000); // Change step every 3 seconds

      return () => {
        clearInterval(stepInterval);
        clearInterval(progressInterval);
      };
    }
  }, [customerInfo?.id]);

  // Fetch customer images when authenticated
  useEffect(() => {
    if (!customerInfo?.email) return;

    const loadImages = async () => {
      // Detect store origin
      const storeInfo = detectStoreOrigin();
      const store = storeInfo?.shopDomain || storeInfo?.domain || null;

      if (!store) {
        console.warn("[NewTryon] Store information not available for fetching images");
        return;
      }

      // Fetch generated images (API 1)
      setLoadingGeneratedImages(true);
      setGeneratedImagesError(null);
      try {
        const generatedResponse = await fetchCustomerImageGenerations({
          email: customerInfo.email,
          store: store,
          page: 1,
          limit: 20,
          status: "completed",
          orderBy: "created_at",
          orderDirection: "DESC",
        });

        if (generatedResponse.success && generatedResponse.data) {
          setGeneratedImages(generatedResponse.data);
        } else {
          setGeneratedImagesError("Failed to load generated images");
        }
      } catch (error) {
        console.error("[NewTryon] Error fetching generated images:", error);
        setGeneratedImagesError(
          error instanceof Error ? error.message : "Failed to load generated images"
        );
      } finally {
        setLoadingGeneratedImages(false);
      }

      // Fetch uploaded images (API 2)
      setLoadingUploadedImages(true);
      setUploadedImagesError(null);
      try {
        const uploadedResponse = await fetchUploadedImages({
          email: customerInfo.email,
          store: store,
          page: 1,
          limit: 20,
        });

        if (uploadedResponse.success && uploadedResponse.data) {
          setUploadedImages(uploadedResponse.data);
        } else {
          setUploadedImagesError("Failed to load uploaded images");
        }
      } catch (error) {
        console.error("[NewTryon] Error fetching uploaded images:", error);
        setUploadedImagesError(
          error instanceof Error ? error.message : "Failed to load uploaded images"
        );
      } finally {
        setLoadingUploadedImages(false);
      }
    };

    loadImages();
  }, [customerInfo?.email]);
  
  // Get login URL - Universal compatibility for ALL stores
  const getLoginUrl = (): string => {
    try {
      // First, try to get the universal login URL from Liquid-injected JSON script tag
      try {
        const loginUrlScript = document.getElementById('nusense-login-url-info');
        if (loginUrlScript && loginUrlScript.textContent) {
          const loginUrlData = JSON.parse(loginUrlScript.textContent);
          if (loginUrlData?.storefrontLoginUrl) {
            return loginUrlData.storefrontLoginUrl;
          }
          if (loginUrlData?.accountLoginUrl) {
            return loginUrlData.accountLoginUrl;
          }
        }
      } catch (parseError) {
        console.warn('[NewTryon] Error parsing login URL from Liquid:', parseError);
      }
      
      // Fallback: Construct login URL manually
      const storeOriginInfo = detectStoreOrigin();
      const storeOrigin = storeOriginInfo.origin || storeOriginInfo.fullUrl;
      
      let returnPagePath = window.location.pathname;
      
      if (window.parent !== window) {
        try {
          const referrer = document.referrer;
          if (referrer) {
            try {
              const referrerUrl = new URL(referrer);
              returnPagePath = referrerUrl.pathname + referrerUrl.search;
            } catch {
              // Invalid referrer URL
            }
          }
        } catch {
          // Cannot access parent
        }
      }
      
      const returnTo = returnPagePath.startsWith('/') ? returnPagePath : `/${returnPagePath}`;
      
      if (storeOrigin) {
        const loginUrl = new URL("/customer_authentication/login", storeOrigin);
        loginUrl.searchParams.set("return_to", returnTo);
        return loginUrl.toString();
      }
      
      if (window.parent !== window) {
        try {
          const referrer = document.referrer;
          if (referrer) {
            const referrerUrl = new URL(referrer);
            const loginUrl = new URL("/customer_authentication/login", referrerUrl.origin);
            loginUrl.searchParams.set("return_to", returnTo);
            return loginUrl.toString();
          }
        } catch {
          // Cannot access parent
        }
      }
      
      const loginUrl = new URL("/customer_authentication/login", window.location.origin);
      loginUrl.searchParams.set("return_to", returnTo);
      return loginUrl.toString();
    } catch (error) {
      console.error("[NewTryon] Error constructing login URL:", error);
      return "/customer_authentication/login";
    }
  };
  
  const handleLoginClick = () => {
    setIsRedirecting(true);
    const loginUrl = getLoginUrl();
    if (isInIframe && window.parent !== window) {
      try {
        window.parent.location.href = loginUrl;
      } catch (error) {
        window.open(loginUrl, "_blank");
      }
    } else {
      window.location.href = loginUrl;
    }
  };

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
      <div className="flex-1 pt-20 sm:pt-24 overflow-y-auto px-4 sm:px-6">
        {/* Authentication Gate - Image Collage Design */}
        {!customerInfo?.id && (
          <div className="w-full flex-1 flex items-center justify-center min-h-0 overflow-y-auto overflow-x-hidden">
            <div className="w-full max-w-[980px] h-full max-h-full sm:max-h-[620px] flex flex-col md:flex-row items-stretch gap-6 bg-transparent rounded overflow-hidden">
              {/* Animated Tutorial Demo Panel - Left Side (Desktop only, hidden on mobile) */}
              <section
                aria-label={t("tryOnWidget.authGate.demoAriaLabel") || "Virtual try-on tutorial demonstration"}
                className="hidden md:flex flex-col flex-1 w-full min-h-0 max-w-full md:max-w-sm pt-3"
              >
                <div className="flex flex-col items-start bg-white w-full py-4 px-4 rounded-xl border border-border min-h-0 flex-1 relative overflow-hidden">
                  {/* Tutorial Demo - Step-by-Step Animated Flow */}
                  <div className="w-full flex-1 flex flex-col gap-4 relative" style={{ minHeight: "450px" }}>
                    {/* Step Indicator */}
                    <div className="flex items-center justify-center gap-2 mb-2">
                      {[1, 2, 3, 4].map((step) => (
                        <div
                          key={step}
                          className={cn(
                            "h-2 rounded-full transition-all duration-500",
                            tutorialStep === step
                              ? "w-8 bg-[#564646]"
                              : tutorialStep > step
                              ? "w-2 bg-[#564646]/40"
                              : "w-2 bg-slate-200"
                          )}
                          aria-hidden="true"
                        />
                      ))}
                    </div>

                    {/* Step Text Explanation */}
                    <div className="text-center mb-6 min-h-[72px] flex flex-col items-center justify-center gap-2">
                      <p
                        className={cn(
                          "text-xs sm:text-sm font-medium text-[#564646]/70 uppercase tracking-wider transition-opacity duration-500",
                          "opacity-100"
                        )}
                        key={`step-number-${tutorialStep}`}
                      >
                        {tutorialStep === 1 && (t("tryOnWidget.authGate.step1Number") || "Step 1")}
                        {tutorialStep === 2 && (t("tryOnWidget.authGate.step2Number") || "Step 2")}
                        {tutorialStep === 3 && (t("tryOnWidget.authGate.step3Number") || "Step 3")}
                        {tutorialStep === 4 && (t("tryOnWidget.authGate.step4Number") || "Step 4")}
                      </p>
                      <p
                        className={cn(
                          "text-lg sm:text-xl font-bold text-[#564646] leading-tight transition-opacity duration-500",
                          "opacity-100"
                        )}
                        key={`step-text-${tutorialStep}`}
                      >
                        {tutorialStep === 1 && (t("tryOnWidget.authGate.step1Text") || "Upload Your Photo")}
                        {tutorialStep === 2 && (t("tryOnWidget.authGate.step2Text") || "Select Your Clothing")}
                        {tutorialStep === 3 && (t("tryOnWidget.authGate.step3Text") || "Generating Try-On Result")}
                        {tutorialStep === 4 && (t("tryOnWidget.authGate.step4Text") || "View Your Result")}
                      </p>
                    </div>

                    {/* Single Image Display Area - Shows in steps 1, 2, 3, 4 */}
                    <div
                      className={cn(
                        "w-full rounded-lg bg-white border border-border overflow-hidden flex items-center justify-center transition-all duration-700 ease-in-out relative"
                      )}
                      style={{ aspectRatio: "1 / 1", minHeight: "300px" }}
                    >
                      {/* Person Image - Step 1 */}
                      {tutorialStep === 1 && (
                        <div className="w-full h-full relative">
                          <img
                            src="https://gooddeals.s3.eu-west-3.amazonaws.com/promod_demo/person/1766486097276_7ccdb71b41929e63_blob.jpeg"
                            alt={t("tryOnWidget.authGate.personImageAlt") || "Example person photo"}
                            className="w-full h-full object-contain"
                          />
                          <div className="absolute inset-0 bg-[#564646]/10 border-2 border-[#564646] rounded-lg animate-pulse" />
                        </div>
                      )}

                      {/* Clothing Image - Step 2 */}
                      {tutorialStep === 2 && (
                        <div className="w-full h-full relative">
                          <img
                            src="https://gooddeals.s3.eu-west-3.amazonaws.com/promod_demo/clothing/1766486098288_f4f3ba85d9bffba7_clothing-item.jpg.jpeg"
                            alt={t("tryOnWidget.authGate.clothingImageAlt") || "Example clothing item"}
                            className="w-full h-full object-contain"
                          />
                          <div className="absolute inset-0 bg-[#564646]/10 border-2 border-[#564646] rounded-lg animate-pulse" />
                        </div>
                      )}

                      {/* Generation Loading - Step 3 */}
                      {tutorialStep === 3 && (
                        <div className="w-full h-full relative overflow-hidden bg-gradient-to-br from-muted/40 via-muted/60 to-muted/40 border border-border rounded-lg">
                          <Skeleton className="absolute inset-0 rounded-lg bg-gradient-to-br from-muted/45 via-muted/70 to-muted/45" />
                          <div
                            className="absolute inset-0 pointer-events-none"
                            style={{
                              background:
                                "linear-gradient(90deg, transparent 30%, rgba(255, 255, 255, 0.5) 50%, transparent 70%)",
                              width: "100%",
                              height: "100%",
                              animation: "shimmer 2s infinite",
                            }}
                          />
                          <div className="absolute inset-0 flex items-center justify-center z-10">
                            <RadialProgress
                              value={progress}
                              size="md"
                              color="muted"
                              showLabel={true}
                            />
                          </div>
                        </div>
                      )}

                      {/* Generated Result - Step 4 */}
                      {tutorialStep === 4 && (
                        <div className="w-full h-full relative">
                          <img
                            src="https://gooddeals.s3.eu-west-3.amazonaws.com/promod_demo/generated/1766486128492_c34538c6d298c0db_generated_iqw81yvt6.jpeg"
                            alt={t("tryOnWidget.authGate.generatedImageAlt") || "Example of generated virtual try-on result"}
                            className="w-full h-full object-contain"
                          />
                          <div className="absolute inset-0 bg-[#564646]/10 border-2 border-[#564646] rounded-lg animate-pulse" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </section>

              {/* Vertical Divider - Desktop only */}
              <div
                className="hidden md:block w-px self-stretch flex-none bg-slate-200 mt-3"
                aria-hidden="true"
              />

              {/* Login Panel - Right Side (Desktop) / Full Width (Mobile) */}
              <section
                aria-labelledby="auth-heading"
                className="flex flex-col flex-1 w-full min-h-0 max-w-full md:max-w-sm pt-3"
              >
                <div className="flex flex-col items-start bg-white w-full py-6 px-5 md:px-8 rounded-xl border border-border min-h-0 flex-1 md:justify-between">
                  {/* Top Section: Title and Content */}
                  <div className="w-full space-y-6 flex-shrink-0">
                    {/* Title Section */}
                    <div className="space-y-4 text-left">
                      <h2 id="auth-heading" className="text-2xl sm:text-3xl md:text-3xl font-bold text-[#564646] leading-tight tracking-tight">
                        {t("tryOnWidget.authGate.title") || "Continue to Virtual Try-On"}
                      </h2>
                      <p className="text-sm sm:text-base text-[#564646]/75 leading-relaxed max-w-md">
                        {t("tryOnWidget.authGate.subtitle") || "Sign in to save your try-on results and access them anytime"}
                      </p>
                      
                      {/* Virtual Try-On Benefits */}
                      <div className="space-y-2.5 pt-3">
                        <div className="flex items-center justify-start gap-2">
                          <CheckCircle className="w-4 h-4 text-[#564646] flex-shrink-0" aria-hidden="true" />
                          <span className="text-xs text-[#564646]/60">
                            {t("tryOnWidget.authGate.benefit1") || "See how it looks"}
                          </span>
                        </div>
                        <div className="flex items-center justify-start gap-2">
                          <CheckCircle className="w-4 h-4 text-[#564646] flex-shrink-0" aria-hidden="true" />
                          <span className="text-xs text-[#564646]/60">
                            {t("tryOnWidget.authGate.benefit2") || "Before you buy"}
                          </span>
                        </div>
                        <div className="flex items-center justify-start gap-2">
                          <CheckCircle className="w-4 h-4 text-[#564646] flex-shrink-0" aria-hidden="true" />
                          <span className="text-xs text-[#564646]/60">
                            {t("tryOnWidget.authGate.benefit3") || "Save time"}
                          </span>
                        </div>
                        <div className="flex items-center justify-start gap-2">
                          <CheckCircle className="w-4 h-4 text-[#564646] flex-shrink-0" aria-hidden="true" />
                          <span className="text-xs text-[#564646]/60">
                            {t("tryOnWidget.authGate.benefit4") || "Try multiple styles"}
                          </span>
                        </div>
                        <div className="flex items-center justify-start gap-2">
                          <CheckCircle className="w-4 h-4 text-[#564646] flex-shrink-0" aria-hidden="true" />
                          <span className="text-xs text-[#564646]/60">
                            {t("tryOnWidget.authGate.benefit5") || "AI-powered"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Bottom Section: Actions - Pushed to bottom on desktop, normal spacing on mobile */}
                  <div className="w-full space-y-3 flex-shrink-0 mt-6 md:mt-auto">
                    <Button
                      onClick={handleLoginClick}
                      disabled={isRedirecting}
                      className="w-full h-12 sm:h-13 bg-[#564646] hover:bg-[#453939] text-white text-sm sm:text-base font-semibold shadow-sm hover:shadow-md transition-all duration-200 rounded-lg disabled:opacity-60 disabled:cursor-not-allowed"
                      aria-label={t("tryOnWidget.authGate.loginButtonAriaLabel") || "Sign in to continue using virtual try-on"}
                    >
                      {isRedirecting ? (
                        <>
                          <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 mr-2 animate-spin" aria-hidden="true" />
                          {t("tryOnWidget.authGate.loginButtonLoading") || "Redirecting..."}
                        </>
                      ) : (
                        <>
                          <LogIn className="w-4 h-4 sm:w-5 sm:h-5 mr-2" aria-hidden="true" />
                          {t("tryOnWidget.authGate.loginButton") || "Sign In"}
                        </>
                      )}
                    </Button>

                    {/* Redirect Notice */}
                    <p className="text-xs text-left text-[#564646]/55 leading-relaxed">
                      {t("tryOnWidget.authGate.redirectNotice") || "We'll redirect you to secure sign-in"}
                    </p>

                    {/* Sign Up Link */}
                    <div className="text-left text-xs sm:text-sm text-[#564646]/75 space-y-1.5">
                      <p className="leading-relaxed">{t("tryOnWidget.authGate.accountLink") || "Don't have an account?"}</p>
                      <a
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          try {
                            const loginUrlScript = document.getElementById('nusense-login-url-info');
                            if (loginUrlScript && loginUrlScript.textContent) {
                              const loginUrlData = JSON.parse(loginUrlScript.textContent);
                              if (loginUrlData?.accountRegisterUrl) {
                                const signUpUrl = loginUrlData.accountRegisterUrl;
                                if (isInIframe && window.parent !== window) {
                                  try {
                                    window.parent.location.href = signUpUrl;
                                  } catch {
                                    window.open(signUpUrl, "_blank");
                                  }
                                } else {
                                  window.location.href = signUpUrl;
                                }
                                return;
                              }
                            }
                          } catch (error) {
                            console.warn('[NewTryon] Error getting register URL:', error);
                          }
                          const storeOriginInfo = detectStoreOrigin();
                          const storeOrigin = storeOriginInfo.origin || storeOriginInfo.fullUrl || window.location.origin;
                          const signUpUrl = `${storeOrigin}/account/register`;
                          if (isInIframe && window.parent !== window) {
                            try {
                              window.parent.location.href = signUpUrl;
                            } catch {
                              window.open(signUpUrl, "_blank");
                            }
                          } else {
                            window.location.href = signUpUrl;
                          }
                        }}
                        className="inline-block text-[#564646] hover:text-[#453939] font-semibold underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#564646] focus-visible:ring-offset-2 rounded-sm transition-colors"
                        aria-label={t("tryOnWidget.authGate.signUpLinkAriaLabel") || "Create a new account"}
                      >
                        {t("tryOnWidget.authGate.signUpLink") || "Create one"}
                      </a>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </div>
        )}

        {/* Image Galleries - Only show if authenticated */}
        {customerInfo?.id && (
          <div className="w-full max-w-[980px] mx-auto space-y-10 py-8 px-4 sm:px-6">
            {/* Generated Images Section */}
            <section aria-labelledby="generated-images-title">
              <HorizontalImageList
                title={t("tryOnWidget.generatedImages.title") || "Your Try-On Results"}
                images={generatedImages.map((img) => ({
                  id: img.id,
                  imageUrl: img.generatedImageUrl,
                  alt: `Generated try-on result from ${new Date(img.createdAt).toLocaleDateString()}`,
                  metadata: {
                    createdAt: img.createdAt,
                    personImageUrl: img.personImageUrl,
                    clothingImageUrl: img.clothingImageUrl,
                  },
                }))}
                loading={loadingGeneratedImages}
                emptyMessage={
                  t("tryOnWidget.generatedImages.empty") ||
                  "No try-on results yet. Create your first virtual try-on!"
                }
                emptyActionLabel={t("tryOnWidget.generatedImages.action") || "Start Try-On"}
                imageSize="lg"
                showMetadata={true}
                enableLightbox={true}
                onImageClick={(image) => {
                  // Optional: can add analytics or other actions here
                }}
              />
              {generatedImagesError && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-700 flex items-center gap-2">
                    <span className="font-medium">Error:</span>
                    <span>{generatedImagesError}</span>
                  </p>
                </div>
              )}
            </section>

            {/* Uploaded Person Images Section */}
            <section aria-labelledby="uploaded-images-title">
              <HorizontalImageList
                title={t("tryOnWidget.uploadedImages.title") || "Your Uploaded Photos"}
                images={uploadedImages.map((img) => ({
                  id: img.id,
                  imageUrl: img.personImageUrl,
                  alt: `Uploaded photo from ${new Date(img.uploadedAt).toLocaleDateString()}`,
                  metadata: {
                    uploadedAt: img.uploadedAt,
                    storeName: img.storeName,
                  },
                }))}
                loading={loadingUploadedImages}
                emptyMessage={
                  t("tryOnWidget.uploadedImages.empty") ||
                  "No uploaded photos yet. Upload your first photo to get started!"
                }
                emptyActionLabel={t("tryOnWidget.uploadedImages.action") || "Upload Photo"}
                imageSize="lg"
                showMetadata={true}
                enableLightbox={true}
                onImageClick={(image) => {
                  // Optional: can add analytics or other actions here
                }}
              />
              {uploadedImagesError && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-700 flex items-center gap-2">
                    <span className="font-medium">Error:</span>
                    <span>{uploadedImagesError}</span>
                  </p>
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
