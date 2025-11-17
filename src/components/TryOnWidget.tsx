import { useState, useEffect, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import PhotoUpload, { DEMO_PHOTO_ID_MAP } from "./PhotoUpload";
import ClothingSelection from "./ClothingSelection";
import ResultDisplay from "./ResultDisplay";
import {
  extractShopifyProductInfo,
  extractProductImages,
  detectStoreOrigin,
  requestStoreInfoFromParent,
  getStoreOriginFromPostMessage,
  type StoreInfo,
} from "@/utils/shopifyIntegration";
import { storage } from "@/utils/storage";
import {
  generateTryOn,
  dataURLToBlob,
  getHealthStatus,
} from "@/services/tryonApi";
import { TryOnResponse, ProductImage } from "@/types/tryon";
import { Sparkles, X, RotateCcw, XCircle, Video } from "lucide-react";
import StatusBar from "./StatusBar";
import { generateVideoAd, dataURLToFile } from "@/services/videoAdApi";
import { useImageGenerations } from "@/hooks/useImageGenerations";

interface TryOnWidgetProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export default function TryOnWidget({ isOpen, onClose }: TryOnWidgetProps) {
  // Redux state for image generations
  const { fetchGenerations, records } = useImageGenerations();

  // Memoize the set of generated clothing keys to avoid recreating on every render
  const generatedClothingKeys = useMemo(() => {
    return new Set(
      records
        .filter((record) => record.clothingKey && record.status === "completed")
        .map((record) => String(record.clothingKey))
    );
  }, [records]);

  // currentStep is kept for generate/progress/result, but UI no longer shows stepper
  const [currentStep, setCurrentStep] = useState(1);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [selectedClothing, setSelectedClothing] = useState<string | null>(null);
  const [selectedClothingKey, setSelectedClothingKey] = useState<
    string | number | null
  >(null);
  const [selectedDemoPhotoUrl, setSelectedDemoPhotoUrl] = useState<
    string | null
  >(null);
  const [availableImages, setAvailableImages] = useState<string[]>([]);
  const [availableImagesWithIds, setAvailableImagesWithIds] = useState<
    Map<string, string | number>
  >(new Map());
  const [recommendedImages, setRecommendedImages] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [generatedVideo, setGeneratedVideo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [videoProgress, setVideoProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(
    "Téléchargez votre photo puis choisissez un article à essayer"
  );
  const [statusVariant, setStatusVariant] = useState<"info" | "error">("info");
  const [storeInfo, setStoreInfo] = useState<StoreInfo | null>(null);
  const INFLIGHT_KEY = "nusense_tryon_inflight";
  // Track if we've already loaded images from URL/NUSENSE_PRODUCT_DATA to prevent parent images from overriding
  const imagesLoadedRef = useRef<boolean>(false);

  // Fetch image generations on component load
  useEffect(() => {
    fetchGenerations({
      page: 1,
      limit: 1000,
      orderBy: "createdAt",
      orderDirection: "DESC",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only fetch once on mount

  // Expose store info globally for access
  useEffect(() => {
    if (storeInfo && typeof window !== "undefined") {
      (window as any).NUSENSE_STORE_INFO = storeInfo;
    }
  }, [storeInfo]);

  useEffect(() => {
    const savedImage = storage.getUploadedImage();
    const savedClothing = storage.getClothingUrl();
    const savedResult = storage.getGeneratedImage();
    if (savedImage) {
      setUploadedImage(savedImage);
      setCurrentStep(2);
      setStatusMessage("Photo chargée. Sélectionnez un vêtement.");
    }
    if (savedClothing) {
      setSelectedClothing(savedClothing);
      setStatusMessage("Prêt à générer. Cliquez sur Générer Image.");
      // Note: clothingKey will be restored when images are loaded (see useEffect below)
    }
    if (savedResult) {
      setGeneratedImage(savedResult);
      setCurrentStep(4);
      setStatusMessage("Résultat prêt. Utilisez les actions ci-dessous.");
    }

    const isInIframe = window.parent !== window;
    let imagesFound = false;

    // Detect store origin when component mounts
    const detectedStore = detectStoreOrigin();
    if (detectedStore && detectedStore.method !== "unknown") {
      setStoreInfo(detectedStore);
    }

    // If we're in an iframe, ALWAYS prioritize images from the parent window (Shopify product page)
    // Do NOT extract images from the widget's own page (/widget page)
    if (isInIframe) {
      void getHealthStatus();
      // Request store info from parent if not already detected
      if (
        !detectedStore ||
        detectedStore.method === "unknown" ||
        detectedStore.method === "postmessage"
      ) {
        requestStoreInfoFromParent((storeInfo) => {
          setStoreInfo(storeInfo);
        }).catch(() => {
          // Failed to get store info from parent
        });
      }

      const requestImages = () => {
        try {
          window.parent.postMessage({ type: "NUSENSE_REQUEST_IMAGES" }, "*");
        } catch (error) {
          // Error communicating with parent window
        }
      };

      // Request immediately - parent window will extract images from Shopify page
      requestImages();

      // DO NOT extract from widget's own page when in iframe mode
      // Wait for parent window to send images via postMessage
      return;
    }

    // If NOT in iframe (standalone mode), extract images from current page
    // Priority 1: Get product images from URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const productParam = urlParams.get("product");
    if (productParam) {
      try {
        const productData = JSON.parse(decodeURIComponent(productParam));
        if (
          productData.images &&
          Array.isArray(productData.images) &&
          productData.images.length > 0
        ) {
          setAvailableImages(productData.images);
          imagesLoadedRef.current = true;
          imagesFound = true;
        }
      } catch (error) {
        // Failed to parse product data from URL
      }
    }

    // Priority 2: Get product images from window.NUSENSE_PRODUCT_DATA
    if (
      !imagesFound &&
      typeof window !== "undefined" &&
      (window as any).NUSENSE_PRODUCT_DATA
    ) {
      const productData = (window as any).NUSENSE_PRODUCT_DATA;
      if (
        productData.images &&
        Array.isArray(productData.images) &&
        productData.images.length > 0
      ) {
        setAvailableImages(productData.images);
        imagesLoadedRef.current = true;
        imagesFound = true;
      }
    }

    // Priority 3: Extract product images from the current page (standalone mode only)
    if (!imagesFound) {
      const images = extractProductImages();
      if (images.length > 0) {
        setAvailableImages(images);
        imagesLoadedRef.current = true;
        imagesFound = true;
      }
    }
  }, []);

  // No longer needed - using fixed 185px width

  // Listen for messages from parent window (Shopify product page)
  // This is CRITICAL for iframe mode - parent window extracts images from the Shopify product page
  // and sends them to this widget iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Extract store origin from postMessage events
      const storeOrigin = getStoreOriginFromPostMessage(event);
      if (storeOrigin && storeOrigin.method === "postmessage") {
        setStoreInfo((prev) => {
          // Only update if we don't have store info or if new info is more specific
          if (
            !prev ||
            prev.method === "unknown" ||
            prev.method === "postmessage"
          ) {
            return storeOrigin;
          }
          return prev;
        });
      }

      // Only process messages from parent window
      if (event.data && event.data.type === "NUSENSE_PRODUCT_IMAGES") {
        const parentImages = event.data.images || [];
        const parentRecommendedImages = event.data.recommendedImages || [];

        if (parentImages.length > 0) {
          // Always prioritize and use parent images - they come from the actual Shopify product page
          // These are extracted using Shopify Liquid objects (product.media/product.images)
          // Handle both formats: string arrays (backward compatible) and object arrays (new format)
          const imageUrls: string[] = [];
          const imageIdMap = new Map<string, string | number>();

          parentImages.forEach((img: string | ProductImage) => {
            if (typeof img === "string") {
              // Backward compatible: plain string URL
              imageUrls.push(img);
            } else if (img && typeof img === "object" && "url" in img) {
              // New format: object with id and url
              imageUrls.push(img.url);
              if (img.id !== undefined) {
                imageIdMap.set(img.url, img.id);
              }
            }
          });

          setAvailableImages(imageUrls);
          setAvailableImagesWithIds(imageIdMap);
          imagesLoadedRef.current = true;
        }

        // Set recommended images if available (recommended images are still strings for now)
        if (parentRecommendedImages.length > 0) {
          const recommendedUrls = parentRecommendedImages
            .map((img: string | ProductImage) =>
              typeof img === "string" ? img : img?.url || ""
            )
            .filter(Boolean);
          setRecommendedImages(recommendedUrls);
        }
      }

      // Handle store info response from parent
      if (event.data && event.data.type === "NUSENSE_STORE_INFO") {
        const storeInfo: StoreInfo = {
          domain: event.data.domain || null,
          fullUrl: event.data.fullUrl || null,
          shopDomain: event.data.shopDomain || null,
          origin: event.data.origin || event.origin || null,
          method: "parent-request",
        };
        setStoreInfo(storeInfo);
        // Store info will be logged by the useEffect above
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []); // Empty dependency array - listener should persist

  const handlePhotoUpload = (
    dataURL: string,
    isDemoPhoto?: boolean,
    demoPhotoUrl?: string
  ) => {
    setUploadedImage(dataURL);
    storage.saveUploadedImage(dataURL);
    // Track if a demo photo was selected and its URL
    if (isDemoPhoto && demoPhotoUrl) {
      setSelectedDemoPhotoUrl(demoPhotoUrl);
    } else {
      setSelectedDemoPhotoUrl(null);
    }
    setStatusVariant("info");
    setStatusMessage("Photo chargée. Sélectionnez un vêtement.");
  };

  const handleClothingSelect = (imageUrl: string) => {
    setSelectedClothing(imageUrl);
    storage.saveClothingUrl(imageUrl);

    // Get the clothing ID if available (clear if imageUrl is empty)
    if (imageUrl) {
      const clothingId = availableImagesWithIds.get(imageUrl) || null;
      setSelectedClothingKey(clothingId);
      setStatusVariant("info");
      setStatusMessage("Prêt à générer. Cliquez sur Générer.");
    } else {
      setSelectedClothingKey(null);
      setStatusVariant("info");
      setStatusMessage("Photo chargée. Sélectionnez un vêtement.");
    }
  };

  const handleGenerate = async () => {
    if (!uploadedImage || !selectedClothing) {
      setStatusVariant("error");
      setStatusMessage(
        "La génération nécessite une photo et un article sélectionné."
      );
      return;
    }

    setIsGenerating(true);
    setError(null);
    setProgress(0);
    setCurrentStep(3);
    setStatusVariant("info");
    setStatusMessage(
      "Génération en cours. Cela peut prendre 15 à 20 secondes…"
    );
    try {
      localStorage.setItem(INFLIGHT_KEY, "1");
    } catch {}

    try {
      const personBlob = await dataURLToBlob(uploadedImage);
      const clothingResponse = await fetch(selectedClothing);
      const clothingBlob = await clothingResponse.blob();

      // Get store name from storeInfo
      const storeName = storeInfo?.shopDomain || storeInfo?.domain || null;

      // Get clothingKey from selected clothing ID (non-mandatory field)
      const clothingKey = selectedClothingKey
        ? String(selectedClothingKey)
        : undefined;

      // Get personKey from selected demo photo ID (non-mandatory field, only for demo pictures)
      const personKey = selectedDemoPhotoUrl
        ? DEMO_PHOTO_ID_MAP.get(selectedDemoPhotoUrl) || undefined
        : undefined;

      // Both clothingKey and personKey are sent to the API when available
      // - clothingKey: sent when product image has an ID
      // - personKey: sent when a demo picture is used (fixed IDs: demo_person_1, demo_person_2, etc.)
      const result: TryOnResponse = await generateTryOn(
        personBlob,
        clothingBlob,
        storeName,
        clothingKey, // Non-mandatory: sent when product image has ID
        personKey // Non-mandatory: sent when demo picture is used
      );

      setProgress(100);

      if (result.status === "success" && result.image) {
        setGeneratedImage(result.image);
        storage.saveGeneratedImage(result.image);
        setCurrentStep(4);
        setStatusVariant("info");
        setStatusMessage("Résultat prêt. Vous pouvez acheter ou télécharger.");
      } else {
        throw new Error(
          result.error_message?.message || "Erreur de génération"
        );
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : "Une erreur inattendue s'est produite";
      setError(errorMessage);
      setStatusVariant("error");
      setStatusMessage(errorMessage);
    } finally {
      setIsGenerating(false);
      try {
        localStorage.removeItem(INFLIGHT_KEY);
      } catch {}
    }
  };

  const handleGenerateVideo = async () => {
    if (!selectedClothing) {
      setStatusVariant("error");
      setStatusMessage(
        "La génération de vidéo nécessite au moins un article sélectionné."
      );
      return;
    }

    setIsGeneratingVideo(true);
    setError(null);
    setVideoProgress(0);
    setStatusVariant("info");
    setStatusMessage(
      "Génération de la vidéo en cours. Cela peut prendre 1 à 5 minutes…"
    );

    try {
      // Convert selected clothing image to File
      const clothingFile = await dataURLToFile(
        selectedClothing,
        "product-image.jpg"
      );

      // Get store name and user info from storeInfo
      const storeName = storeInfo?.shopDomain || storeInfo?.domain || null;

      // Prepare product images array (can include multiple images from availableImages)
      const productImages: File[] = [clothingFile];

      // Optionally add more product images if available
      if (availableImages.length > 1) {
        // Limit to 10 images total as per API documentation
        const additionalImages = availableImages
          .slice(0, 9)
          .filter((url) => url !== selectedClothing);

        for (const imageUrl of additionalImages) {
          try {
            const file = await dataURLToFile(
              imageUrl,
              `product-${Date.now()}.jpg`
            );
            productImages.push(file);
          } catch (err) {
            // Skip images that fail to convert
          }
        }
      }

      setVideoProgress(30);

      const result = await generateVideoAd(productImages, {
        storeName: storeName || undefined,
      });

      setVideoProgress(90);

      if (result.status === "success" && result.image) {
        setGeneratedVideo(result.image);
        setVideoProgress(100);
        setStatusVariant("info");
        setStatusMessage("Vidéo générée avec succès !");
      } else {
        throw new Error(
          result.error_message?.message || "Erreur de génération de vidéo"
        );
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : "Une erreur inattendue s'est produite lors de la génération de la vidéo";
      setError(errorMessage);
      setStatusVariant("error");
      setStatusMessage(errorMessage);
    } finally {
      setIsGeneratingVideo(false);
      setVideoProgress(0);
    }
  };

  const handleRefreshImages = () => {
    const isInIframe = window.parent !== window;

    // If in iframe, always request images from parent window (Shopify product page)
    if (isInIframe) {
      try {
        window.parent.postMessage({ type: "NUSENSE_REQUEST_IMAGES" }, "*");
      } catch (error) {
        // Failed to request images from parent window
      }
      return;
    }

    // If NOT in iframe (standalone mode), extract from current page
    let imagesFound = false;

    // Helper function to normalize images and extract IDs
    const normalizeImages = (
      images: (string | ProductImage)[]
    ): { urls: string[]; idMap: Map<string, string | number> } => {
      const urls: string[] = [];
      const idMap = new Map<string, string | number>();

      images.forEach((img) => {
        if (typeof img === "string") {
          urls.push(img);
        } else if (img && typeof img === "object" && "url" in img) {
          urls.push(img.url);
          if (img.id !== undefined) {
            idMap.set(img.url, img.id);
          }
        }
      });

      return { urls, idMap };
    };

    // Priority 1: Get product images from URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const productParam = urlParams.get("product");
    if (productParam) {
      try {
        const productData = JSON.parse(decodeURIComponent(productParam));
        if (
          productData.images &&
          Array.isArray(productData.images) &&
          productData.images.length > 0
        ) {
          const { urls, idMap } = normalizeImages(productData.images);
          setAvailableImages(urls);
          setAvailableImagesWithIds(idMap);
          imagesFound = true;
        }
      } catch (error) {
        // Failed to parse product data from URL
      }
    }

    // Priority 2: Get product images from window.NUSENSE_PRODUCT_DATA
    if (
      !imagesFound &&
      typeof window !== "undefined" &&
      (window as any).NUSENSE_PRODUCT_DATA
    ) {
      const productData = (window as any).NUSENSE_PRODUCT_DATA;
      if (
        productData.images &&
        Array.isArray(productData.images) &&
        productData.images.length > 0
      ) {
        const { urls, idMap } = normalizeImages(productData.images);
        setAvailableImages(urls);
        setAvailableImagesWithIds(idMap);
        imagesFound = true;
      }
    }

    // Priority 3: Extract product images from the current page
    if (!imagesFound) {
      const images = extractProductImages();
      if (images.length > 0) {
        // extractProductImages returns string array, so no IDs available
        setAvailableImages(images);
        setAvailableImagesWithIds(new Map());
        imagesFound = true;
      }
    }
  };

  const handleClearUploadedImage = () => {
    setUploadedImage(null);
    setSelectedDemoPhotoUrl(null);
    try {
      storage.clearUploadedImage();
    } catch {}
    setCurrentStep(1);
    setStatusVariant("info");
    setStatusMessage("Photo effacée. Téléchargez votre photo.");
  };

  const handleReset = () => {
    setCurrentStep(1);
    setUploadedImage(null);
    setSelectedClothing(null);
    setSelectedClothingKey(null);
    setSelectedDemoPhotoUrl(null);
    setGeneratedImage(null);
    setError(null);
    setProgress(0);
    storage.clearSession();
    setStatusVariant("info");
    setStatusMessage(
      "Téléchargez votre photo puis choisissez un article à essayer"
    );
  };

  // Restore clothingKey when images are loaded (for saved state)
  useEffect(() => {
    if (
      selectedClothing &&
      availableImagesWithIds.size > 0 &&
      !selectedClothingKey
    ) {
      const clothingId = availableImagesWithIds.get(selectedClothing);
      if (clothingId) {
        setSelectedClothingKey(clothingId);
      }
    }
  }, [selectedClothing, availableImagesWithIds, selectedClothingKey]);

  useEffect(() => {
    // Check for inflight generation after state updates are applied
    // This ensures uploadedImage and selectedClothing are set before calling handleGenerate
    const inflight = localStorage.getItem(INFLIGHT_KEY) === "1";
    const savedResult = storage.getGeneratedImage();

    // Only resume generation if:
    // 1. There's an inflight generation
    // 2. We have both uploadedImage and selectedClothing (state is set)
    // 3. We don't already have a result
    if (
      inflight &&
      uploadedImage &&
      selectedClothing &&
      !savedResult &&
      !generatedImage
    ) {
      handleGenerate();
    }
  }, [uploadedImage, selectedClothing, generatedImage]); // Depend on state to ensure it's set before resuming

  // Check if we're inside an iframe
  const isInIframe = typeof window !== "undefined" && window.parent !== window;

  // Handle close - if in iframe, notify parent window
  const handleClose = () => {
    if (isInIframe) {
      // Send message to parent window to close the modal
      try {
        window.parent.postMessage({ type: "NUSENSE_CLOSE_WIDGET" }, "*");
      } catch (error) {
        // Failed to send close message to parent
      }
    }
    if (onClose) {
      onClose();
    }
  };

  return (
    <div
      className="w-full h-full overflow-y-auto"
      style={{ backgroundColor: "#fef3f3", minHeight: "100vh" }}
      role="main"
      aria-label="Application d'essayage virtuel"
    >
      {/* ARIA Live Region for Status Updates */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        role="status"
      >
        {statusMessage}
      </div>

      {/* ARIA Live Region for Errors */}
      {error && (
        <div
          aria-live="assertive"
          aria-atomic="true"
          className="sr-only"
          role="alert"
        >
          Erreur: {error}
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-10 bg-card/80 backdrop-blur-sm px-3 py-2 sm:px-4 sm:py-3 md:px-5 md:py-4 border-b border-border shadow-sm">
        <div className="flex items-center justify-between gap-2 sm:gap-3">
          <div className="inline-flex flex-col flex-shrink-0 min-w-0">
            <h1
              className="inline-flex items-center tracking-wide leading-none whitespace-nowrap text-2xl sm:text-3xl md:text-4xl font-bold"
              aria-label="NULOOK - Essayage Virtuel Alimenté par IA"
            >
              <span style={{ color: "#ce0003" }} aria-hidden="true">
                NU
              </span>
              <span style={{ color: "#564646" }} aria-hidden="true">
                LOOK
              </span>
            </h1>
            <p className="mt-0.5 sm:mt-1 text-left leading-tight tracking-tight whitespace-nowrap text-[10px] sm:text-xs md:text-sm text-[#3D3232] font-medium">
              Essayage Virtuel Alimenté par IA
            </p>
          </div>
          <div className="flex items-center gap-2 sm:gap-2.5 md:gap-3 flex-shrink-0">
            {!isGenerating && (
              <Button
                variant="secondary"
                size="sm"
                onClick={handleReset}
                className="group text-secondary-foreground hover:bg-secondary/80 transition-all duration-200 text-xs sm:text-sm px-3 sm:px-4 h-[44px] sm:h-9 md:h-10 whitespace-nowrap shadow-sm hover:shadow-md gap-2 flex items-center focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                aria-label="Réinitialiser l'application"
              >
                <RotateCcw
                  className="h-3.5 w-3.5 sm:h-4 sm:w-4 transition-transform group-hover:rotate-[-120deg] duration-500"
                  aria-hidden="true"
                />
                <span>Réinitialiser</span>
              </Button>
            )}
            <Button
              variant="destructive"
              size="icon"
              onClick={handleClose}
              className="h-[44px] w-[44px] sm:h-9 sm:w-9 md:h-10 md:w-10 rounded-md bg-error text-error-foreground hover:bg-error/90 border-error transition-all duration-200 group shadow-sm hover:shadow-md focus-visible:ring-2 focus-visible:ring-error focus-visible:ring-offset-2"
              aria-label="Fermer l'application"
              title="Fermer"
            >
              <X
                className="h-4 w-4 sm:h-5 sm:w-5 transition-transform group-hover:rotate-90 duration-300"
                aria-hidden="true"
              />
            </Button>
          </div>
        </div>
      </header>

      {/* Status Bar */}
      <section
        className="px-3 sm:px-4 md:px-5 lg:px-6 pt-2 sm:pt-3"
        aria-label="État de l'application"
      >
        <StatusBar message={statusMessage} variant={statusVariant} />
      </section>

      {/* Content */}
      <div className="p-3 sm:p-4 md:p-5 lg:p-6 space-y-4 sm:space-y-5 md:space-y-6">
        {/* Selection sections - always visible */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5 md:gap-6">
          {/* Left Panel: Upload / Preview */}
          <section aria-labelledby="upload-heading">
            <Card className="p-3 sm:p-4 md:p-5 border-border bg-card">
              <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
                <div
                  className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-primary text-primary-foreground grid place-items-center font-semibold text-sm sm:text-base flex-shrink-0 shadow-sm"
                  aria-hidden="true"
                >
                  1
                </div>
                <div className="min-w-0 flex-1">
                  <h2
                    id="upload-heading"
                    className="text-base sm:text-lg font-semibold"
                  >
                    Téléchargez Votre Photo
                  </h2>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">
                    Choisissez une photo claire de vous-même
                  </p>
                </div>
              </div>

              {!uploadedImage && (
                <PhotoUpload onPhotoUpload={handlePhotoUpload} />
              )}

              {uploadedImage && (
                <div className="space-y-3 sm:space-y-4">
                  <div className="relative rounded-lg bg-card p-2 sm:p-3 border border-border shadow-sm">
                    <div className="flex items-center justify-between mb-2 gap-2">
                      <h3 className="font-semibold text-sm sm:text-base">
                        Votre Photo
                      </h3>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleClearUploadedImage}
                        className="group h-8 sm:h-9 px-2.5 sm:px-3 text-xs sm:text-sm flex-shrink-0 gap-1.5 border-border text-foreground hover:bg-muted hover:border-muted-foreground/20 hover:text-muted-foreground transition-all duration-200 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                        aria-label="Effacer la photo téléchargée"
                        aria-describedby="upload-heading"
                      >
                        <XCircle
                          className="h-3.5 w-3.5 sm:h-4 sm:w-4 transition-transform group-hover:scale-110 duration-200"
                          aria-hidden="true"
                        />
                        <span>Effacer</span>
                      </Button>
                    </div>
                    <div className="aspect-[3/4] rounded overflow-hidden border border-border bg-card flex items-center justify-center shadow-sm">
                      <img
                        src={uploadedImage}
                        alt="Photo téléchargée pour l'essayage virtuel"
                        className="h-full w-auto object-contain"
                      />
                    </div>
                  </div>
                </div>
              )}
            </Card>
          </section>

          {/* Right Panel: Clothing Selection */}
          <section aria-labelledby="clothing-heading">
            <Card className="p-3 sm:p-4 md:p-5 border-border bg-card">
              <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
                <div
                  className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-primary text-primary-foreground grid place-items-center font-semibold text-sm sm:text-base flex-shrink-0 shadow-sm"
                  aria-hidden="true"
                >
                  2
                </div>
                <div className="min-w-0 flex-1">
                  <h2
                    id="clothing-heading"
                    className="text-base sm:text-lg font-semibold"
                  >
                    Sélectionner un Article de Vêtement
                  </h2>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">
                    Sélectionnez un article de vêtement sur cette page
                  </p>
                </div>
              </div>

              <ClothingSelection
                images={availableImages}
                recommendedImages={recommendedImages}
                selectedImage={selectedClothing}
                onSelect={handleClothingSelect}
                onRefreshImages={handleRefreshImages}
                availableImagesWithIds={availableImagesWithIds}
                generatedClothingKeys={generatedClothingKeys}
              />
            </Card>
          </section>
        </div>

        {/* Generate buttons - show when not generating */}
        {!isGenerating && !isGeneratingVideo && (
          <div className="pt-1 sm:pt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
            <Button
              onClick={handleGenerate}
              disabled={
                !selectedClothing ||
                !uploadedImage ||
                isGenerating ||
                isGeneratingVideo
              }
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground h-11 sm:h-12 md:h-14 text-sm sm:text-base md:text-lg min-h-[44px] shadow-md hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              aria-label="Générer l'essayage virtuel"
              aria-describedby={
                !selectedClothing || !uploadedImage
                  ? "generate-help"
                  : undefined
              }
            >
              <Sparkles
                className="w-4 h-4 sm:w-5 sm:h-5 mr-2"
                aria-hidden="true"
              />
              Générer Image
            </Button>
            <Button
              onClick={handleGenerateVideo}
              disabled={!selectedClothing || isGenerating || isGeneratingVideo}
              variant="outline"
              className="group w-full border-2 border-primary text-primary hover:border-primary-dark hover:text-primary-dark hover:bg-primary/5 active:bg-primary/10 h-11 sm:h-12 md:h-14 text-sm sm:text-base md:text-lg min-h-[44px] shadow-md hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              aria-label="Générer une vidéo publicitaire"
              aria-describedby={
                !selectedClothing ? "generate-video-help" : undefined
              }
            >
              <Video
                className="w-4 h-4 sm:w-5 sm:h-5 mr-2 transition-transform duration-200 group-hover:scale-110"
                aria-hidden="true"
              />
              Générer Vidéo
            </Button>
            {(!selectedClothing || !uploadedImage) && (
              <p id="generate-help" className="sr-only">
                Veuillez télécharger une photo et sélectionner un vêtement pour
                générer l'essayage virtuel
              </p>
            )}
            {!selectedClothing && (
              <p id="generate-video-help" className="sr-only">
                Veuillez sélectionner un vêtement pour générer une vidéo
                publicitaire
              </p>
            )}
          </div>
        )}

        {/* Results section - always visible with skeleton when loading */}
        <section
          className="pt-2 sm:pt-4"
          aria-labelledby="results-heading"
          aria-live="polite"
          aria-busy={isGenerating}
        >
          <h2 id="results-heading" className="sr-only">
            Résultats de l'essayage virtuel
          </h2>
          <ResultDisplay
            generatedImage={generatedImage}
            personImage={uploadedImage}
            clothingImage={selectedClothing}
            isGenerating={isGenerating || isGeneratingVideo}
            progress={isGenerating ? progress : videoProgress}
            generatedVideo={generatedVideo}
          />
        </section>

        {error && (
          <div role="alert" aria-live="assertive">
            <Card className="p-6 bg-error/10 border-error">
              <p className="text-error font-medium" id="error-message">
                {error}
              </p>
              <Button
                variant="secondary"
                onClick={handleReset}
                className="group mt-4 gap-2 text-secondary-foreground hover:bg-secondary/80 transition-all duration-200 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                aria-label="Réessayer après une erreur"
                aria-describedby="error-message"
              >
                <RotateCcw
                  className="h-4 w-4 transition-transform group-hover:rotate-[-120deg] duration-500"
                  aria-hidden="true"
                />
                <span>Réessayer</span>
              </Button>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
