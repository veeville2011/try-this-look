import { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sparkles,
  CreditCard,
  ShoppingCart,
  Download,
  Loader2,
  Image as ImageIcon,
  Video,
} from "lucide-react";
import { toast } from "sonner";

interface ResultDisplayProps {
  generatedImage?: string | null;
  generatedVideo?: string | null;
  personImage?: string | null;
  clothingImage?: string | null;
  isGenerating?: boolean;
  progress?: number;
  generationType?: "image" | "video" | null;
}

interface ProductData {
  id?: number;
  title?: string;
  price?: string;
  url?: string;
}

export default function ResultDisplay({
  generatedImage,
  generatedVideo,
  personImage,
  clothingImage,
  isGenerating = false,
  progress = 0,
  generationType = null,
}: ResultDisplayProps) {
  // Determine default tab based on what's currently generated or being generated
  const defaultTab =
    generatedVideo || generationType === "video" ? "video" : "image";
  const [activeTab, setActiveTab] = useState(defaultTab);

  const [isBuyNowLoading, setIsBuyNowLoading] = useState(false);
  const [isAddToCartLoading, setIsAddToCartLoading] = useState(false);
  const [isDownloadLoading, setIsDownloadLoading] = useState(false);
  const buyNowTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const addToCartTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Immediately switch to the respective tab when generation starts or completes
  useEffect(() => {
    if (isGenerating && generationType) {
      // Switch to the tab being generated
      setActiveTab(generationType);
    } else if (!isGenerating) {
      // After generation completes, switch to the tab with results
      if (generatedVideo) {
        setActiveTab("video");
      } else if (generatedImage) {
        setActiveTab("image");
      }
    }
  }, [isGenerating, generationType, generatedVideo, generatedImage]);

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
          toast.success("Article ajouté au panier", {
            description: productData?.title
              ? `${productData.title} a été ajouté à votre panier.`
              : "L'article a été ajouté à votre panier.",
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
          toast.error("Erreur", {
            description:
              event.data.error ||
              "Impossible d'ajouter l'article au panier. Veuillez réessayer.",
          });
        } else if (event.data.action === "NUSENSE_BUY_NOW") {
          // Clear timeout if it exists
          if (buyNowTimeoutRef.current) {
            clearTimeout(buyNowTimeoutRef.current);
            buyNowTimeoutRef.current = null;
          }
          setIsBuyNowLoading(false);
          toast.error("Erreur", {
            description:
              event.data.error ||
              "Impossible de procéder à l'achat. Veuillez réessayer.",
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
        toast.info("Ajout au panier...", {
          description: "Redirection vers la page de paiement en cours.",
        });

        // Set a timeout to reset loading state if no response received (10 seconds)
        if (buyNowTimeoutRef.current) {
          clearTimeout(buyNowTimeoutRef.current);
        }
        buyNowTimeoutRef.current = setTimeout(() => {
          setIsBuyNowLoading(false);
          toast.error("Timeout", {
            description: "La requête a pris trop de temps. Veuillez réessayer.",
          });
          buyNowTimeoutRef.current = null;
        }, 10000);
      } else {
        // Standalone mode - show message that this feature requires Shopify integration
        setIsBuyNowLoading(false);
        toast.error("Fonctionnalité non disponible", {
          description:
            "Cette fonctionnalité nécessite une intégration Shopify. Veuillez utiliser cette application depuis une page produit Shopify.",
        });
      }
    } catch (error) {
      setIsBuyNowLoading(false);
      toast.error("Erreur", {
        description: "Impossible de procéder à l'achat. Veuillez réessayer.",
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
          toast.error("Timeout", {
            description: "La requête a pris trop de temps. Veuillez réessayer.",
          });
          addToCartTimeoutRef.current = null;
        }, 10000);
      } else {
        // Standalone mode - show message that this feature requires Shopify integration
        setIsAddToCartLoading(false);
        toast.error("Fonctionnalité non disponible", {
          description:
            "Cette fonctionnalité nécessite une intégration Shopify. Veuillez utiliser cette application depuis une page produit Shopify.",
        });
      }
    } catch (error) {
      setIsAddToCartLoading(false);
      toast.error("Erreur", {
        description:
          "Impossible d'ajouter l'article au panier. Veuillez réessayer.",
      });
    }
  };

  const handleDownload = async () => {
    const downloadUrl = generatedVideo || generatedImage;
    if (isDownloadLoading || !downloadUrl) return;

    setIsDownloadLoading(true);

    try {
      // Convert data URL or blob URL to blob for proper download
      let blob: Blob | null = null;

      if (downloadUrl.startsWith("data:")) {
        // Data URL - convert to blob
        const response = await fetch(downloadUrl);
        blob = await response.blob();
      } else if (downloadUrl.startsWith("blob:")) {
        // Blob URL - fetch it
        const response = await fetch(downloadUrl);
        blob = await response.blob();
      } else {
        // Regular URL - try to fetch with CORS handling
        try {
          const response = await fetch(downloadUrl, {
            mode: "cors",
            credentials: "omit",
          });
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }
          blob = await response.blob();
        } catch (fetchError) {
          // For video URLs, try direct download
          if (generatedVideo) {
            // Fallback: try to open in new tab
            window.open(downloadUrl, "_blank");
            setIsDownloadLoading(false);
            toast.info("Ouverture dans un nouvel onglet", {
              description:
                "La vidéo s'ouvre dans un nouvel onglet. Vous pouvez l'enregistrer depuis là.",
            });
            return;
          }

          // For images, try canvas approach
          const img = new Image();
          img.crossOrigin = "anonymous";

          blob = await new Promise<Blob>((resolve, reject) => {
            img.onload = () => {
              try {
                const canvas = document.createElement("canvas");
                canvas.width = img.naturalWidth;
                canvas.height = img.naturalHeight;
                const ctx = canvas.getContext("2d");
                if (!ctx) {
                  reject(new Error("Could not get canvas context"));
                  return;
                }
                ctx.drawImage(img, 0, 0);
                canvas.toBlob((blobResult) => {
                  if (blobResult) {
                    resolve(blobResult);
                  } else {
                    reject(new Error("Failed to convert canvas to blob"));
                  }
                }, "image/png");
              } catch (error) {
                reject(error);
              }
            };
            img.onerror = () => reject(new Error("Failed to load image"));
            img.src = downloadUrl;
          });
        }
      }

      if (!blob) {
        throw new Error("Failed to create blob");
      }

      // Create download link
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const extension = generatedVideo ? "mp4" : "png";
      const filename = generatedVideo
        ? `video-publicitaire-${Date.now()}.${extension}`
        : `essayage-virtuel-${Date.now()}.${extension}`;
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
      toast.success("Téléchargement réussi", {
        description: generatedVideo
          ? "La vidéo a été téléchargée avec succès."
          : "L'image a été téléchargée avec succès.",
      });
    } catch (error) {
      setIsDownloadLoading(false);

      // Fallback: try to open in new tab
      try {
        window.open(downloadUrl, "_blank");
        toast.info("Ouverture dans un nouvel onglet", {
          description: generatedVideo
            ? "La vidéo s'ouvre dans un nouvel onglet. Vous pouvez l'enregistrer depuis là."
            : "L'image s'ouvre dans un nouvel onglet. Vous pouvez l'enregistrer depuis là.",
        });
      } catch (openError) {
        toast.error("Erreur de téléchargement", {
          description: generatedVideo
            ? "Impossible de télécharger la vidéo. Veuillez réessayer."
            : "Impossible de télécharger l'image. Veuillez réessayer ou prendre une capture d'écran.",
        });
      }
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
        <Tabs
          value={activeTab}
          onValueChange={isGenerating ? undefined : setActiveTab}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-2 mb-4 sm:mb-5">
            <TabsTrigger
              value="image"
              className="flex items-center gap-2"
              disabled={isGenerating}
            >
              <ImageIcon className="w-4 h-4" />
              <span>Génération d'images</span>
            </TabsTrigger>
            <TabsTrigger
              value="video"
              className="flex items-center gap-2"
              disabled={isGenerating}
            >
              <Video className="w-4 h-4" />
              <span>Génération de vidéo</span>
            </TabsTrigger>
          </TabsList>

          {/* Image Generation Tab */}
          <TabsContent value="image" className="mt-0">
            <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-primary text-primary-foreground grid place-items-center font-semibold text-sm sm:text-base flex-shrink-0 shadow-sm">
                <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-base sm:text-lg font-semibold">
                  Résultat Généré
                </h2>
                <p className="text-[10px] sm:text-xs text-muted-foreground">
                  Essayage virtuel avec IA
                </p>
              </div>
            </div>

            {/* Split layout: 50% image / 50% buttons */}
            <div className="grid grid-cols-1 gap-5 sm:gap-6 md:gap-8 lg:grid-cols-2">
              {/* Left side: Generated image, loading skeleton, or placeholder */}
              <div className="relative rounded-lg border border-border/50 bg-gradient-to-br from-muted/20 to-muted/5 overflow-hidden flex items-center justify-center shadow-sm hover:shadow-md transition-shadow duration-300 w-full">
                {isGenerating && activeTab === "image" ? (
                  // Loading state - skeleton with shimmer and loading indicator
                  <div className="w-full relative overflow-hidden min-h-[400px] sm:min-h-[500px] md:min-h-[600px]">
                    {/* Skeleton placeholder with shimmer effect */}
                    <Skeleton className="w-full rounded-lg bg-gradient-to-br from-muted/40 via-muted/60 to-muted/40 min-h-[400px] sm:min-h-[500px] md:min-h-[600px]" />
                    {/* Shimmer overlay animation */}
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
                    {/* Loading indicator overlay - subtle icon only */}
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
                  // Generated image available - show it
                  <img
                    src={generatedImage}
                    alt="Résultat de l'essayage virtuel généré par intelligence artificielle"
                    className="w-full max-h-[80vh] object-contain"
                    loading="lazy"
                  />
                ) : (
                  // No image and not loading - show static placeholder
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
                      Aucun résultat généré
                    </p>
                  </div>
                )}
              </div>

              {/* Right side: Action buttons - 1 column mobile / 2 columns desktop for image */}
              <div className="grid gap-1.5 sm:gap-2 auto-rows-min grid-cols-1 sm:grid-cols-2">
                {/* Buy Now - Red border */}
                <Button
                  onClick={handleBuyNow}
                  onKeyDown={(e) => handleKeyDown(e, handleBuyNow)}
                  disabled={
                    isBuyNowLoading ||
                    isAddToCartLoading ||
                    isDownloadLoading ||
                    (isGenerating && activeTab === "image") ||
                    !generatedImage
                  }
                  variant="outline"
                  size="sm"
                  className="group relative w-full inline-flex items-center justify-center min-h-[40px] sm:min-h-[44px] h-auto py-1.5 sm:py-2 px-2.5 sm:px-3 md:px-4 text-[10px] sm:text-xs md:text-sm font-semibold border-2 border-red-500/80 bg-white hover:bg-red-50 hover:border-red-600 text-red-600 hover:text-red-700 active:bg-red-100 active:scale-[0.98] transition-all duration-200 ease-out shadow-sm hover:shadow-md hover:shadow-red-500/10 focus-visible:ring-2 focus-visible:ring-red-500/50 focus-visible:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
                  aria-label="Acheter Maintenant"
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
                    {isBuyNowLoading ? "Traitement..." : "Acheter Maintenant"}
                  </span>
                </Button>

                {/* Add to Cart - Green border */}
                <Button
                  onClick={handleAddToCart}
                  onKeyDown={(e) => handleKeyDown(e, handleAddToCart)}
                  disabled={
                    isBuyNowLoading ||
                    isAddToCartLoading ||
                    isDownloadLoading ||
                    (isGenerating && activeTab === "image") ||
                    !generatedImage
                  }
                  variant="outline"
                  size="sm"
                  className="group relative w-full inline-flex items-center justify-center min-h-[40px] sm:min-h-[44px] h-auto py-1.5 sm:py-2 px-2.5 sm:px-3 md:px-4 text-[10px] sm:text-xs md:text-sm font-semibold border-2 border-green-500/80 bg-white hover:bg-green-50 hover:border-green-600 text-green-600 hover:text-green-700 active:bg-green-100 active:scale-[0.98] transition-all duration-200 ease-out shadow-sm hover:shadow-md hover:shadow-green-500/10 focus-visible:ring-2 focus-visible:ring-green-500/50 focus-visible:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
                  aria-label="Ajouter au Panier"
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
                    {isAddToCartLoading ? "Ajout..." : "Ajouter au Panier"}
                  </span>
                </Button>

                {/* Download - Blue border */}
                <Button
                  onClick={handleDownload}
                  onKeyDown={(e) => handleKeyDown(e, handleDownload)}
                  disabled={
                    isBuyNowLoading ||
                    isAddToCartLoading ||
                    isDownloadLoading ||
                    (isGenerating && activeTab === "image") ||
                    !generatedImage
                  }
                  variant="outline"
                  size="sm"
                  className="group relative w-full inline-flex items-center justify-center min-h-[40px] sm:min-h-[44px] h-auto py-1.5 sm:py-2 px-2.5 sm:px-3 md:px-4 text-[10px] sm:text-xs md:text-sm font-semibold border-2 border-blue-500/80 bg-white hover:bg-blue-50 hover:border-blue-600 text-blue-600 hover:text-blue-700 active:bg-blue-100 active:scale-[0.98] transition-all duration-200 ease-out shadow-sm hover:shadow-md hover:shadow-blue-500/10 focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
                  aria-label="Télécharger"
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
                    {isDownloadLoading ? "Téléchargement..." : "Télécharger"}
                  </span>
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* Video Generation Tab */}
          <TabsContent value="video" className="mt-0">
            <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-primary text-primary-foreground grid place-items-center font-semibold text-sm sm:text-base flex-shrink-0 shadow-sm">
                <Video className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-base sm:text-lg font-semibold">
                  Vidéo Générée
                </h2>
                <p className="text-[10px] sm:text-xs text-muted-foreground">
                  Vidéo publicitaire avec IA
                </p>
              </div>
            </div>

            {/* Split layout: 50% video / 50% buttons */}
            <div className="grid grid-cols-1 gap-5 sm:gap-6 md:gap-8 lg:grid-cols-2">
              {/* Left side: Generated video, loading skeleton, or placeholder */}
              <div className="relative rounded-lg border border-border/50 bg-gradient-to-br from-muted/20 to-muted/5 overflow-hidden flex items-center justify-center shadow-sm hover:shadow-md transition-shadow duration-300 w-full">
                {isGenerating && activeTab === "video" ? (
                  // Loading state - skeleton with shimmer and loading indicator
                  <div className="w-full relative overflow-hidden min-h-[400px] sm:min-h-[500px] md:min-h-[600px]">
                    {/* Skeleton placeholder with shimmer effect */}
                    <Skeleton className="w-full rounded-lg bg-gradient-to-br from-muted/40 via-muted/60 to-muted/40 min-h-[400px] sm:min-h-[500px] md:min-h-[600px]" />
                    {/* Shimmer overlay animation */}
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
                    {/* Loading indicator overlay - subtle icon only */}
                    <div className="absolute inset-0 flex items-center justify-center z-10">
                      <div className="relative">
                        <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-primary/10 backdrop-blur-sm flex items-center justify-center border border-primary/20">
                          <Video className="w-6 h-6 sm:w-8 sm:h-8 text-primary animate-pulse" />
                        </div>
                        <div className="absolute inset-0 w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-primary/20 animate-ping opacity-75" />
                      </div>
                    </div>
                  </div>
                ) : generatedVideo ? (
                  // Generated video available - show video player
                  <video
                    src={generatedVideo}
                    controls
                    className="w-full max-h-[80vh] object-contain"
                    aria-label="Vidéo publicitaire générée par intelligence artificielle"
                  >
                    Votre navigateur ne supporte pas la lecture de vidéos.
                  </video>
                ) : (
                  // No video and not loading - show static placeholder
                  <div
                    className="w-full min-h-[400px] sm:min-h-[500px] md:min-h-[600px] flex flex-col items-center justify-center gap-3 sm:gap-4 text-muted-foreground"
                    role="status"
                    aria-live="polite"
                  >
                    <div
                      className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-muted/50 flex items-center justify-center"
                      aria-hidden="true"
                    >
                      <Video className="w-8 h-8 sm:w-10 sm:h-10 text-muted-foreground/60" />
                    </div>
                    <p className="text-xs sm:text-sm text-muted-foreground/80 text-center px-4">
                      Aucune vidéo générée
                    </p>
                  </div>
                )}
              </div>

              {/* Right side: Action buttons - 1 column mobile / 2 columns desktop for video */}
              <div className="grid gap-1.5 sm:gap-2 auto-rows-min grid-cols-1 sm:grid-cols-2">
                {/* Buy Now - Red border */}
                <Button
                  onClick={handleBuyNow}
                  onKeyDown={(e) => handleKeyDown(e, handleBuyNow)}
                  disabled={
                    isBuyNowLoading ||
                    isAddToCartLoading ||
                    isDownloadLoading ||
                    (isGenerating && activeTab === "video") ||
                    !generatedVideo
                  }
                  variant="outline"
                  size="sm"
                  className="group relative w-full inline-flex items-center justify-center min-h-[40px] sm:min-h-[44px] h-auto py-1.5 sm:py-2 px-2.5 sm:px-3 md:px-4 text-[10px] sm:text-xs md:text-sm font-semibold border-2 border-red-500/80 bg-white hover:bg-red-50 hover:border-red-600 text-red-600 hover:text-red-700 active:bg-red-100 active:scale-[0.98] transition-all duration-200 ease-out shadow-sm hover:shadow-md hover:shadow-red-500/10 focus-visible:ring-2 focus-visible:ring-red-500/50 focus-visible:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
                  aria-label="Acheter Maintenant"
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
                    {isBuyNowLoading ? "Traitement..." : "Acheter Maintenant"}
                  </span>
                </Button>

                {/* Add to Cart - Green border */}
                <Button
                  onClick={handleAddToCart}
                  onKeyDown={(e) => handleKeyDown(e, handleAddToCart)}
                  disabled={
                    isBuyNowLoading ||
                    isAddToCartLoading ||
                    isDownloadLoading ||
                    (isGenerating && activeTab === "video") ||
                    !generatedVideo
                  }
                  variant="outline"
                  size="sm"
                  className="group relative w-full inline-flex items-center justify-center min-h-[40px] sm:min-h-[44px] h-auto py-1.5 sm:py-2 px-2.5 sm:px-3 md:px-4 text-[10px] sm:text-xs md:text-sm font-semibold border-2 border-green-500/80 bg-white hover:bg-green-50 hover:border-green-600 text-green-600 hover:text-green-700 active:bg-green-100 active:scale-[0.98] transition-all duration-200 ease-out shadow-sm hover:shadow-md hover:shadow-green-500/10 focus-visible:ring-2 focus-visible:ring-green-500/50 focus-visible:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
                  aria-label="Ajouter au Panier"
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
                    {isAddToCartLoading ? "Ajout..." : "Ajouter au Panier"}
                  </span>
                </Button>

                {/* Download - Blue border */}
                <Button
                  onClick={handleDownload}
                  onKeyDown={(e) => handleKeyDown(e, handleDownload)}
                  disabled={
                    isBuyNowLoading ||
                    isAddToCartLoading ||
                    isDownloadLoading ||
                    (isGenerating && activeTab === "video") ||
                    !generatedVideo
                  }
                  variant="outline"
                  size="sm"
                  className="group relative w-full inline-flex items-center justify-center min-h-[40px] sm:min-h-[44px] h-auto py-1.5 sm:py-2 px-2.5 sm:px-3 md:px-4 text-[10px] sm:text-xs md:text-sm font-semibold border-2 border-blue-500/80 bg-white hover:bg-blue-50 hover:border-blue-600 text-blue-600 hover:text-blue-700 active:bg-blue-100 active:scale-[0.98] transition-all duration-200 ease-out shadow-sm hover:shadow-md hover:shadow-blue-500/10 focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
                  aria-label="Télécharger la vidéo"
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
                    {isDownloadLoading
                      ? "Téléchargement..."
                      : "Télécharger Vidéo"}
                  </span>
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
}
