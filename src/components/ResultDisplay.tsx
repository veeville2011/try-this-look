import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sparkles,
  CreditCard,
  ShoppingCart,
  Download,
  Loader2,
  Image as ImageIcon,
  Share2,
} from "lucide-react";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import { addWatermarkToImage } from "@/utils/imageWatermark";
import { useStoreInfo } from "@/hooks/useStoreInfo";
import {
  detectStoreOrigin,
  type StoreInfo,
} from "@/utils/shopifyIntegration";

interface ResultDisplayProps {
  generatedImage?: string | null;
  personImage?: string | null;
  clothingImage?: string | null;
  isGenerating?: boolean;
  progress?: number;
}

interface ProductData {
  id?: number;
  title?: string;
  price?: string;
  url?: string;
}

export default function ResultDisplay({
  generatedImage,
  isGenerating = false,
}: ResultDisplayProps) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [isBuyNowLoading, setIsBuyNowLoading] = useState(false);
  const [isAddToCartLoading, setIsAddToCartLoading] = useState(false);
  const [isDownloadLoading, setIsDownloadLoading] = useState(false);
  const [isInstagramShareLoading, setIsInstagramShareLoading] = useState(false);
  const buyNowTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const addToCartTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // Cache for watermarked blob to avoid re-processing on every share click
  const watermarkedBlobCacheRef = useRef<{ imageUrl: string; blob: Blob; timestamp: number } | null>(null);
  const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  
  // Get store info for watermark
  const { storeInfo: reduxStoreInfo } = useStoreInfo();
  const [storeInfo, setStoreInfo] = useState<StoreInfo | null>(null);
  
  // Detect store origin on mount
  useEffect(() => {
    const detectedStore = detectStoreOrigin();
    if (detectedStore) {
      setStoreInfo(detectedStore);
    }
    
    // Also check window.NUSENSE_STORE_INFO if available
    if (typeof window !== "undefined" && (window as any).NUSENSE_STORE_INFO) {
      setStoreInfo((window as any).NUSENSE_STORE_INFO);
    }
  }, []);

  // Pre-process image with watermark when generatedImage changes
  // This ensures the blob is ready synchronously when user clicks share
  useEffect(() => {
    if (!generatedImage) {
      watermarkedBlobCacheRef.current = null;
      return;
    }

    // Prepare store info for watermark
    const storeName = storeInfo?.shopDomain || storeInfo?.domain || reduxStoreInfo?.shop || null;
    const storeWatermarkInfo = storeName ? {
      name: storeName,
      domain: storeName,
      logoUrl: null,
    } : null;

    const cacheKey = `${generatedImage}_${storeName || 'default'}`;
    
    // Check if we already have a cached blob for this image
    const cached = watermarkedBlobCacheRef.current;
    if (cached && cached.imageUrl === cacheKey && (Date.now() - cached.timestamp) < CACHE_DURATION) {
      return; // Already cached, no need to reprocess
    }

    // Pre-process the image in the background
    addWatermarkToImage(generatedImage, storeWatermarkInfo)
      .then((blob) => {
        watermarkedBlobCacheRef.current = {
          imageUrl: cacheKey,
          blob: blob,
          timestamp: Date.now(),
        };
      })
      .catch((error) => {
        console.warn("Failed to pre-process image for sharing:", error);
        // Don't set cache on error - will retry on share click
      });
  }, [generatedImage, storeInfo, reduxStoreInfo]);

  // Get product data if available (from Shopify parent window)
  const getProductData = (): ProductData | null => {
    if (typeof window === "undefined") return null;

    // Try to get product data from parent window's NUSENSE_PRODUCT_DATA
    try {
      if (
        window.parent !== window &&
        (window.parent as any).NUSENSE_PRODUCT_DATA
      ) {
        return (window.parent as any).NUSENSE_PRODUCT_DATA;
      }
      // Fallback: check current window
      if ((window as any).NUSENSE_PRODUCT_DATA) {
        return (window as any).NUSENSE_PRODUCT_DATA;
      }
    } catch (error) {
      // Cross-origin access might fail, that's okay
    }
    return null;
  };

  // Listen for success/error messages from parent window
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Get product data helper
      const getProductDataLocal = (): ProductData | null => {
        if (typeof window === "undefined") return null;
        try {
          if (
            window.parent !== window &&
            (window.parent as any).NUSENSE_PRODUCT_DATA
          ) {
            return (window.parent as any).NUSENSE_PRODUCT_DATA;
          }
          if ((window as any).NUSENSE_PRODUCT_DATA) {
            return (window as any).NUSENSE_PRODUCT_DATA;
          }
        } catch (error) {
          // Could not access product data
        }
        return null;
      };

      if (event.data && event.data.type === "NUSENSE_ACTION_SUCCESS") {
        if (event.data.action === "NUSENSE_ADD_TO_CART") {
          // Clear timeout if it exists
          if (addToCartTimeoutRef.current) {
            clearTimeout(addToCartTimeoutRef.current);
            addToCartTimeoutRef.current = null;
          }
          setIsAddToCartLoading(false);
          const productData = getProductDataLocal();
          toast.success(t("tryOnWidget.resultDisplay.addToCartToast") || "Article ajouté au panier", {
            description: productData?.title
              ? t("tryOnWidget.resultDisplay.addToCartToastDescription", { title: productData.title }) || `${productData.title} a été ajouté à votre panier.`
              : t("tryOnWidget.resultDisplay.addToCartToastDescriptionFallback") || "L'article a été ajouté à votre panier.",
          });
        } else if (event.data.action === "NUSENSE_BUY_NOW") {
          // Clear timeout if it exists
          if (buyNowTimeoutRef.current) {
            clearTimeout(buyNowTimeoutRef.current);
            buyNowTimeoutRef.current = null;
          }
          setIsBuyNowLoading(false);
          // Buy now will redirect, so we don't need to show a toast
        }
      } else if (event.data && event.data.type === "NUSENSE_ACTION_ERROR") {
        if (event.data.action === "NUSENSE_ADD_TO_CART") {
          // Clear timeout if it exists
          if (addToCartTimeoutRef.current) {
            clearTimeout(addToCartTimeoutRef.current);
            addToCartTimeoutRef.current = null;
          }
          setIsAddToCartLoading(false);
          toast.error(t("tryOnWidget.resultDisplay.error") || "Erreur", {
            description:
              event.data.error ||
              t("tryOnWidget.resultDisplay.addToCartError") || "Impossible d'ajouter l'article au panier. Veuillez réessayer.",
          });
        } else if (event.data.action === "NUSENSE_BUY_NOW") {
          // Clear timeout if it exists
          if (buyNowTimeoutRef.current) {
            clearTimeout(buyNowTimeoutRef.current);
            buyNowTimeoutRef.current = null;
          }
          setIsBuyNowLoading(false);
          toast.error(t("tryOnWidget.resultDisplay.error") || "Erreur", {
            description:
              event.data.error ||
              t("tryOnWidget.resultDisplay.buyNowError") || "Impossible de procéder à l'achat. Veuillez réessayer.",
          });
        }
      }
    };

    window.addEventListener("message", handleMessage);
    return () => {
      window.removeEventListener("message", handleMessage);
      // Clean up any pending timeouts
      if (buyNowTimeoutRef.current) {
        clearTimeout(buyNowTimeoutRef.current);
        buyNowTimeoutRef.current = null;
      }
      if (addToCartTimeoutRef.current) {
        clearTimeout(addToCartTimeoutRef.current);
        addToCartTimeoutRef.current = null;
      }
    };
  }, []);

  const handleBuyNow = async () => {
    if (isBuyNowLoading) return;

    setIsBuyNowLoading(true);

    try {
      const isInIframe = window.parent !== window;
      const productData = getProductData();

      if (isInIframe) {
        // Send message to parent window (Shopify page) to trigger buy now
        const message = {
          type: "NUSENSE_BUY_NOW",
          ...(productData && { product: productData }),
        };

        window.parent.postMessage(message, "*");

        // Show loading message - parent will handle redirect or error
        toast.info(t("tryOnWidget.resultDisplay.addingToCart") || "Ajout au panier...", {
          description: t("tryOnWidget.resultDisplay.redirectingToCheckout") || "Redirection vers la page de paiement en cours.",
        });

        // Set a timeout to reset loading state if no response received (10 seconds)
        if (buyNowTimeoutRef.current) {
          clearTimeout(buyNowTimeoutRef.current);
        }
        buyNowTimeoutRef.current = setTimeout(() => {
          setIsBuyNowLoading(false);
          toast.error(t("tryOnWidget.resultDisplay.timeout") || "Timeout", {
            description: t("tryOnWidget.resultDisplay.timeoutDescription") || "La requête a pris trop de temps. Veuillez réessayer.",
          });
          buyNowTimeoutRef.current = null;
        }, 10000);
      } else {
        // Standalone mode - show message that this feature requires Shopify integration
        setIsBuyNowLoading(false);
        toast.error(t("tryOnWidget.resultDisplay.featureUnavailable") || "Fonctionnalité non disponible", {
          description:
            t("tryOnWidget.resultDisplay.featureUnavailableDescription") || "Cette fonctionnalité nécessite une intégration Shopify. Veuillez utiliser cette application depuis une page produit Shopify.",
        });
      }
    } catch (error) {
      setIsBuyNowLoading(false);
      toast.error(t("tryOnWidget.resultDisplay.error") || "Erreur", {
        description: t("tryOnWidget.resultDisplay.buyNowError") || "Impossible de procéder à l'achat. Veuillez réessayer.",
      });
    }
  };

  const handleAddToCart = async () => {
    if (isAddToCartLoading) return;

    setIsAddToCartLoading(true);

    try {
      const isInIframe = window.parent !== window;
      const productData = getProductData();

      if (isInIframe) {
        // Send message to parent window (Shopify page) to trigger add to cart
        const message = {
          type: "NUSENSE_ADD_TO_CART",
          ...(productData && { product: productData }),
        };

        window.parent.postMessage(message, "*");

        // Loading state will be updated when we receive success/error message from parent
        // Set a timeout to reset loading state if no response received (10 seconds)
        if (addToCartTimeoutRef.current) {
          clearTimeout(addToCartTimeoutRef.current);
        }
        addToCartTimeoutRef.current = setTimeout(() => {
          setIsAddToCartLoading(false);
          toast.error(t("tryOnWidget.resultDisplay.timeout") || "Timeout", {
            description: t("tryOnWidget.resultDisplay.timeoutDescription") || "La requête a pris trop de temps. Veuillez réessayer.",
          });
          addToCartTimeoutRef.current = null;
        }, 10000);
      } else {
        // Standalone mode - show message that this feature requires Shopify integration
        setIsAddToCartLoading(false);
        toast.error(t("tryOnWidget.resultDisplay.featureUnavailable") || "Fonctionnalité non disponible", {
          description:
            t("tryOnWidget.resultDisplay.featureUnavailableDescription") || "Cette fonctionnalité nécessite une intégration Shopify. Veuillez utiliser cette application depuis une page produit Shopify.",
        });
      }
    } catch (error) {
      setIsAddToCartLoading(false);
      toast.error(t("tryOnWidget.resultDisplay.error") || "Erreur", {
        description:
          t("tryOnWidget.resultDisplay.addToCartError") || "Impossible d'ajouter l'article au panier. Veuillez réessayer.",
      });
    }
  };

  const handleDownload = async () => {
    const downloadUrl = generatedImage;
    if (isDownloadLoading || !downloadUrl) return;

    setIsDownloadLoading(true);

    try {
      // Prepare store info for watermark
      const storeName = storeInfo?.shopDomain || storeInfo?.domain || reduxStoreInfo?.shop || null;
      const storeWatermarkInfo = storeName ? {
        name: storeName,
        domain: storeName,
        logoUrl: null, // TODO: Add store logo URL if available
      } : null;
      
      // Add watermark (footer with copyright) to the image
      const blob = await addWatermarkToImage(downloadUrl, storeWatermarkInfo);

      // Create download link
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const extension = "png";
      const filename = `essayage-virtuel-${Date.now()}.${extension}`;
      link.download = filename;
      link.style.display = "none";

      document.body.appendChild(link);
      link.click();

      // Cleanup
      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, 100);

      setIsDownloadLoading(false);
      toast.success(t("tryOnWidget.resultDisplay.downloadSuccess") || "Téléchargement réussi", {
        description: t("tryOnWidget.resultDisplay.downloadSuccessDescription") || "L'image a été téléchargée avec succès.",
      });
    } catch (error) {
      setIsDownloadLoading(false);

      // Fallback: try to open in new tab
      try {
        window.open(downloadUrl, "_blank");
        toast.info(t("tryOnWidget.resultDisplay.openingInNewTab") || "Ouverture dans un nouvel onglet", {
          description:
            t("tryOnWidget.resultDisplay.openingInNewTabDescription") || "L'image s'ouvre dans un nouvel onglet. Vous pouvez l'enregistrer depuis là.",
        });
      } catch (openError) {
        toast.error(t("tryOnWidget.resultDisplay.downloadError") || "Erreur de téléchargement", {
          description:
            t("tryOnWidget.resultDisplay.downloadErrorDescription") || "Impossible de télécharger l'image. Veuillez réessayer ou prendre une capture d'écran.",
        });
      }
    }
  };

  const handleInstagramShare = async (event?: React.MouseEvent | React.KeyboardEvent) => {
    const imageUrl = generatedImage;
    if (isInstagramShareLoading || !imageUrl) return;

    // Prevent default to maintain user gesture context
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    setIsInstagramShareLoading(true);

    try {
      // Check if Web Share API is available BEFORE async operations
      if (!navigator.share) {
        setIsInstagramShareLoading(false);
        const isSecureContext = window.isSecureContext || location.protocol === "https:";
        const errorMessage = isSecureContext
          ? "Web Share API is not supported in this browser. Please use Chrome/Edge on desktop or any modern mobile browser."
          : "Web Share API requires HTTPS. Please access this page over HTTPS.";
        
        toast.error(t("tryOnWidget.resultDisplay.instagramShareError") || "Error sharing to Instagram", {
          description: errorMessage,
        });
        return;
      }

      // Prepare store info for watermark
      const storeName = storeInfo?.shopDomain || storeInfo?.domain || reduxStoreInfo?.shop || null;
      const storeWatermarkInfo = storeName ? {
        name: storeName,
        domain: storeName,
        logoUrl: null,
      } : null;
      
      // Check cache first - if blob is ready, use it synchronously (maintains user gesture)
      let blob: Blob;
      const cacheKey = `${imageUrl}_${storeName || 'default'}`;
      const cached = watermarkedBlobCacheRef.current;
      
      if (cached && cached.imageUrl === cacheKey && (Date.now() - cached.timestamp) < CACHE_DURATION) {
        // Use cached blob - this is synchronous! User gesture is maintained
        blob = cached.blob;
      } else {
        // Blob not ready yet - process it now (this will break user gesture, but we'll handle it)
        // Show a message that processing is needed
        toast.info("Preparing image for sharing...", {
          description: "Please wait a moment, then try again.",
        });
        blob = await addWatermarkToImage(imageUrl, storeWatermarkInfo);
        // Cache the blob for future use
        watermarkedBlobCacheRef.current = {
          imageUrl: cacheKey,
          blob: blob,
          timestamp: Date.now(),
        };
        // After processing, show message to click again
        setIsInstagramShareLoading(false);
        toast.success("Image ready!", {
          description: "Please click the share button again to share.",
        });
        return; // Exit - user needs to click again
      }

      // Build comprehensive caption with product info, store name, hashtags, and purchase link
      const productData = getProductData();
      const storeDisplayName = storeName?.replace(".myshopify.com", "") || "Store";
      const productTitle = productData?.title || "Product";
      const productUrl = productData?.url || window.location.href;
      
      // Generate caption with product info, store name, hashtags, and purchase link
      const caption = [
        `✨ Virtual Try-On by NUSENSE`,
        ``,
        `Check out this ${productTitle} from ${storeDisplayName}!`,
        ``,
        `🔗 Shop now: ${productUrl}`,
        ``,
        `#VirtualTryOn #AIFashion #FashionTech #VirtualStyling #TryBeforeYouBuy #FashionAI #DigitalFashion #VirtualReality #FashionTech #Shopify #Ecommerce #Fashion #Style #Outfit #Clothing #Fashionista #InstaFashion #FashionBlogger #StyleInspo #OOTD #FashionLover #FashionAddict #FashionStyle #FashionDesign #FashionWeek #FashionTrends #FashionForward #Fashionable #FashionableStyle #FashionableLife`,
      ].join("\n");

      // Create file immediately after blob is ready
      const file = new File([blob], `virtual-tryon-${Date.now()}.png`, { type: "image/png" });
      
      // Try to share with file (best option - includes image)
      // Check if file sharing is supported
      let canShareFile = false;
      if (navigator.canShare) {
        try {
          canShareFile = navigator.canShare({ files: [file] });
        } catch (canShareError) {
          // canShare might throw if file sharing is not supported
          canShareFile = false;
        }
      }
      
      try {
        if (canShareFile) {
          // Share with file (image + caption) - call immediately
          await navigator.share({
            files: [file],
            title: productTitle,
            text: caption,
          });
          
          setIsInstagramShareLoading(false);
          toast.success(t("tryOnWidget.resultDisplay.instagramOpened") || "Share sheet opened!", {
            description: t("tryOnWidget.resultDisplay.shareSheetOpenedDescription") || "Select Instagram from the share options. Image and caption are ready!",
          });
          return; // Success - exit early
        } else {
          // File sharing not supported, try sharing text/URL only
          const imageDataUrl = URL.createObjectURL(blob);
          
          try {
            // Share with text and URL - call immediately
            await navigator.share({
              title: productTitle,
              text: `${caption}\n\nImage: ${imageDataUrl}`,
              url: productUrl,
            });
            
            setIsInstagramShareLoading(false);
            toast.success(t("tryOnWidget.resultDisplay.instagramOpened") || "Share sheet opened!", {
              description: t("tryOnWidget.resultDisplay.shareSheetOpenedDescription") || "Select Instagram from the share options. Image link and caption are ready!",
            });
            
            // Clean up the object URL after a delay
            setTimeout(() => {
              URL.revokeObjectURL(imageDataUrl);
            }, 1000);
            
            return; // Success - exit early
          } catch (textShareError: any) {
            // Text sharing also failed
            URL.revokeObjectURL(imageDataUrl);
            
            if (textShareError.name === "AbortError") {
              setIsInstagramShareLoading(false);
              return; // User cancelled
            }
            throw textShareError; // Re-throw to show error below
          }
        }
      } catch (shareError: any) {
        // Handle specific error types
        if (shareError.name === "AbortError") {
          // User cancelled - this is not an error
          setIsInstagramShareLoading(false);
          return;
        }
        
        if (shareError.name === "NotAllowedError") {
          // Permission denied - usually means not called from user gesture
          setIsInstagramShareLoading(false);
          console.error("Web Share API NotAllowedError:", shareError);
          toast.error(t("tryOnWidget.resultDisplay.instagramShareError") || "Permission denied", {
            description: "Please click the share button again. The share must be triggered directly by your click.",
          });
          return;
        }
        
        // Other share errors
        setIsInstagramShareLoading(false);
        console.error("Web Share API error:", shareError);
        toast.error(t("tryOnWidget.resultDisplay.instagramShareError") || "Error sharing to Instagram", {
          description: t("tryOnWidget.resultDisplay.instagramShareErrorDescription") || `Sharing failed: ${shareError.message || "Unknown error"}. Please ensure you're using HTTPS and a supported browser.`,
        });
        return;
      }
    } catch (error: any) {
      setIsInstagramShareLoading(false);
      console.error("Error in handleInstagramShare:", error);
      toast.error(t("tryOnWidget.resultDisplay.instagramShareError") || "Error sharing to Instagram", {
        description: t("tryOnWidget.resultDisplay.instagramShareErrorDescription") || "Unable to share to Instagram. Please try again.",
      });
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent, handler: () => void) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handler();
    }
  };

  return (
    <div className="space-y-4 sm:space-y-5 md:space-y-6">
      <Card className="p-3 sm:p-4 md:p-5 border-border bg-card ring-2 ring-primary/20 shadow-lg">
        <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-primary text-primary-foreground grid place-items-center font-semibold text-sm sm:text-base flex-shrink-0 shadow-sm">
            <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base sm:text-lg font-semibold">
              {t("tryOnWidget.resultDisplay.generatedResult") || "Résultat Généré"}
            </h2>
            <p className="text-[10px] sm:text-xs text-muted-foreground">
              {t("tryOnWidget.resultDisplay.virtualTryOnWithAI") || "Essayage virtuel avec IA"}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:gap-6 md:gap-8 lg:grid-cols-2">
          <div className="relative rounded-lg border border-border/50 bg-gradient-to-br from-muted/20 to-muted/5 overflow-hidden flex items-center justify-center shadow-sm hover:shadow-md transition-shadow duration-300 w-full">
            {isGenerating ? (
              <div className="w-full relative overflow-hidden min-h-[400px] sm:min-h-[500px] md:min-h-[600px]">
                <Skeleton className="w-full rounded-lg bg-gradient-to-br from-muted/40 via-muted/60 to-muted/40 min-h-[400px] sm:min-h-[500px] md:min-h-[600px]" />
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
                  <div className="relative">
                    <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-primary/10 backdrop-blur-sm flex items-center justify-center border border-primary/20">
                      <Sparkles className="w-6 h-6 sm:w-8 sm:h-8 text-primary animate-pulse" />
                    </div>
                    <div className="absolute inset-0 w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-primary/20 animate-ping opacity-75" />
                  </div>
                </div>
              </div>
            ) : generatedImage ? (
              <img
                src={generatedImage}
                alt={t("tryOnWidget.resultDisplay.resultAlt") || "Résultat de l'essayage virtuel généré par intelligence artificielle"}
                className="w-full max-h-[80vh] object-contain"
                loading="lazy"
              />
            ) : (
              <div
                className="w-full min-h-[400px] sm:min-h-[500px] md:min-h-[600px] flex flex-col items-center justify-center gap-3 sm:gap-4 text-muted-foreground"
                role="status"
                aria-live="polite"
              >
                <div
                  className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-muted/50 flex items-center justify-center"
                  aria-hidden="true"
                >
                  <ImageIcon className="w-8 h-8 sm:w-10 sm:h-10 text-muted-foreground/60" />
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground/80 text-center px-4">
                  {t("tryOnWidget.resultDisplay.noResultsGenerated") || "Aucun résultat généré"}
                </p>
              </div>
            )}
          </div>

          <div className="grid gap-1.5 sm:gap-2 auto-rows-min grid-cols-1 sm:grid-cols-2 lg:grid-cols-2">
            <Button
              onClick={handleBuyNow}
              onKeyDown={(e) => handleKeyDown(e, handleBuyNow)}
              disabled={
                isBuyNowLoading ||
                isAddToCartLoading ||
                isDownloadLoading ||
                isInstagramShareLoading ||
                isGenerating ||
                !generatedImage
              }
              size="sm"
              className="group relative w-full inline-flex items-center justify-center min-h-[40px] sm:min-h-[44px] h-auto py-1.5 sm:py-2 px-2.5 sm:px-3 md:px-4 text-[10px] sm:text-xs md:text-sm font-semibold border-2 border-red-500/80 bg-white hover:bg-red-50 hover:border-red-600 text-red-600 hover:text-red-700 active:bg-red-100 active:scale-[0.98] transition-all duration-200 ease-out shadow-sm hover:shadow-md hover:shadow-red-500/10 focus-visible:ring-2 focus-visible:ring-red-500/50 focus-visible:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
              aria-label={t("tryOnWidget.resultDisplay.buyNowAriaLabel") || "Acheter Maintenant"}
              aria-busy={isBuyNowLoading}
            >
              {isBuyNowLoading ? (
                <Loader2
                  className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4 animate-spin flex-shrink-0 mr-1.5 sm:mr-2"
                  aria-hidden="true"
                />
              ) : (
                <CreditCard
                  className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4 transition-transform duration-200 group-hover:scale-110 flex-shrink-0 mr-1.5 sm:mr-2"
                  aria-hidden="true"
                />
              )}
              <span className="leading-tight whitespace-nowrap">
                {isBuyNowLoading ? t("tryOnWidget.resultDisplay.processing") || "Traitement..." : t("tryOnWidget.resultDisplay.buyNow") || "Acheter Maintenant"}
              </span>
            </Button>

            <Button
              onClick={handleAddToCart}
              onKeyDown={(e) => handleKeyDown(e, handleAddToCart)}
              disabled={
                isBuyNowLoading ||
                isAddToCartLoading ||
                isDownloadLoading ||
                isInstagramShareLoading ||
                isGenerating ||
                !generatedImage
              }
              size="sm"
              className="group relative w-full inline-flex items-center justify-center min-h-[40px] sm:min-h-[44px] h-auto py-1.5 sm:py-2 px-2.5 sm:px-3 md:px-4 text-[10px] sm:text-xs md:text-sm font-semibold border-2 border-green-500/80 bg-white hover:bg-green-50 hover:border-green-600 text-green-600 hover:text-green-700 active:bg-green-100 active:scale-[0.98] transition-all duration-200 ease-out shadow-sm hover:shadow-md hover:shadow-green-500/10 focus-visible:ring-2 focus-visible:ring-green-500/50 focus-visible:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
              aria-label={t("tryOnWidget.resultDisplay.addToCartAriaLabel") || "Ajouter au Panier"}
              aria-busy={isAddToCartLoading}
            >
              {isAddToCartLoading ? (
                <Loader2
                  className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4 animate-spin flex-shrink-0 mr-1.5 sm:mr-2"
                  aria-hidden="true"
                />
              ) : (
                <ShoppingCart
                  className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4 transition-transform duration-200 group-hover:scale-110 flex-shrink-0 mr-1.5 sm:mr-2"
                  aria-hidden="true"
                />
              )}
              <span className="leading-tight whitespace-nowrap">
                {isAddToCartLoading ? t("tryOnWidget.resultDisplay.adding") || "Ajout..." : t("tryOnWidget.resultDisplay.addToCart") || "Ajouter au Panier"}
              </span>
            </Button>

            <Button
              onClick={handleDownload}
              onKeyDown={(e) => handleKeyDown(e, handleDownload)}
              disabled={
                isBuyNowLoading ||
                isAddToCartLoading ||
                isDownloadLoading ||
                isInstagramShareLoading ||
                isGenerating ||
                !generatedImage
              }
              size="sm"
              className="group relative w-full inline-flex items-center justify-center min-h-[40px] sm:min-h-[44px] h-auto py-1.5 sm:py-2 px-2.5 sm:px-3 md:px-4 text-[10px] sm:text-xs md:text-sm font-semibold border-2 border-blue-500/80 bg-white hover:bg-blue-50 hover:border-blue-600 text-blue-600 hover:text-blue-700 active:bg-blue-100 active:scale-[0.98] transition-all duration-200 ease-out shadow-sm hover:shadow-md hover:shadow-blue-500/10 focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
              aria-label={t("tryOnWidget.resultDisplay.downloadAriaLabel") || "Télécharger l'image"}
              aria-busy={isDownloadLoading}
            >
              {isDownloadLoading ? (
                <Loader2
                  className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4 animate-spin flex-shrink-0 mr-1.5 sm:mr-2"
                  aria-hidden="true"
                />
              ) : (
                <Download
                  className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4 transition-transform duration-200 group-hover:scale-110 flex-shrink-0 mr-1.5 sm:mr-2"
                  aria-hidden="true"
                />
              )}
              <span className="leading-tight whitespace-nowrap">
                {isDownloadLoading ? t("tryOnWidget.resultDisplay.downloading") || "Téléchargement..." : t("tryOnWidget.resultDisplay.download") || "Télécharger"}
              </span>
            </Button>

            <Button
              onClick={(e) => handleInstagramShare(e)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleInstagramShare(e);
                }
              }}
              disabled={
                isBuyNowLoading ||
                isAddToCartLoading ||
                isDownloadLoading ||
                isInstagramShareLoading ||
                isGenerating ||
                !generatedImage
              }
              size="sm"
              className="group relative w-full inline-flex items-center justify-center min-h-[40px] sm:min-h-[44px] h-auto py-1.5 sm:py-2 px-2.5 sm:px-3 md:px-4 text-[10px] sm:text-xs md:text-sm font-semibold border-2 border-purple-500/80 bg-white hover:bg-purple-50 hover:border-purple-600 text-purple-600 hover:text-purple-700 active:bg-purple-100 active:scale-[0.98] transition-all duration-200 ease-out shadow-sm hover:shadow-md hover:shadow-purple-500/10 focus-visible:ring-2 focus-visible:ring-purple-500/50 focus-visible:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
              aria-label={t("tryOnWidget.resultDisplay.shareToInstagramAriaLabel") || "Share to Instagram"}
              aria-busy={isInstagramShareLoading}
            >
              {isInstagramShareLoading ? (
                <Loader2
                  className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4 animate-spin flex-shrink-0 mr-1.5 sm:mr-2"
                  aria-hidden="true"
                />
              ) : (
                <Share2
                  className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4 transition-transform duration-200 group-hover:scale-110 flex-shrink-0 mr-1.5 sm:mr-2"
                  aria-hidden="true"
                />
              )}
              <span className="leading-tight whitespace-nowrap">
                {isInstagramShareLoading ? t("tryOnWidget.resultDisplay.sharing") || "Sharing..." : t("tryOnWidget.resultDisplay.shareToInstagram") || "Share to Instagram"}
              </span>
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
