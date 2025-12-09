import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import PhotoUpload, { DEMO_PHOTO_ID_MAP } from "./PhotoUpload";
import CartOutfitModeSelector from "./CartOutfitModeSelector";
import CartOutfitGarmentSelection from "./CartOutfitGarmentSelection";
import CartOutfitResultDisplay from "./CartOutfitResultDisplay";
import CartOutfitProgressTracker from "./CartOutfitProgressTracker";
import StatusBar from "./StatusBar";
import {
  extractShopifyProductInfo,
  extractProductImages,
  detectStoreOrigin,
  requestStoreInfoFromParent,
  getStoreOriginFromPostMessage,
  type StoreInfo,
} from "@/utils/shopifyIntegration";
import {
  generateCartTryOn,
  generateOutfitLook,
  dataURLToBlob,
} from "@/services/cartOutfitApi";
import {
  CartOutfitMode,
  SelectedGarment,
  CartResponse,
  OutfitResponse,
  BatchProgress,
} from "@/types/cartOutfit";
import { ProductImage } from "@/types/tryon";
import { Sparkles, X, RotateCcw, XCircle } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface CartOutfitWidgetProps {
  isOpen?: boolean;
  onClose?: () => void;
  initialMode?: CartOutfitMode;
  cartItems?: ProductImage[]; // Optional: pre-populate from cart
}

export default function CartOutfitWidget({
  isOpen = true,
  onClose,
  initialMode = "cart",
  cartItems = [],
}: CartOutfitWidgetProps) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<CartOutfitMode>(initialMode);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [selectedDemoPhotoUrl, setSelectedDemoPhotoUrl] = useState<
    string | null
  >(null);
  const [selectedGarments, setSelectedGarments] = useState<SelectedGarment[]>(
    []
  );
  const [availableImages, setAvailableImages] = useState<ProductImage[]>([]);
  const [availableImagesWithIds, setAvailableImagesWithIds] = useState<
    Map<string, string | number>
  >(new Map());
  const [isGenerating, setIsGenerating] = useState(false);
  const [cartResults, setCartResults] = useState<CartResponse | null>(null);
  const [outfitResult, setOutfitResult] = useState<OutfitResponse | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [batchProgress, setBatchProgress] = useState<BatchProgress | null>(
    null
  );
  const [statusMessage, setStatusMessage] = useState<string>(
    "Téléchargez votre photo puis sélectionnez les articles à essayer"
  );
  const [statusVariant, setStatusVariant] = useState<"info" | "error">("info");
  const [storeInfo, setStoreInfo] = useState<StoreInfo | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<number | null>(1); // Version selection (1 or 2, default: 1)
  const imagesLoadedRef = useRef<boolean>(false);

  // Mode-specific constraints
  const maxItems = mode === "cart" ? 6 : 8;
  const minItems = mode === "cart" ? 1 : 2;

  // Initialize with cart items if provided
  useEffect(() => {
    if (cartItems.length > 0 && availableImages.length === 0) {
      setAvailableImages(cartItems);
      const idMap = new Map<string, string | number>();
      cartItems.forEach((item) => {
        if (item.id) {
          idMap.set(item.url, item.id);
        }
      });
      setAvailableImagesWithIds(idMap);
      imagesLoadedRef.current = true;
    }
  }, [cartItems, availableImages.length]);

  // Detect store origin when component mounts
  useEffect(() => {
    const detectedStore = detectStoreOrigin();
    if (detectedStore && detectedStore.method !== "unknown") {
      setStoreInfo(detectedStore);
    }

    const isInIframe = window.parent !== window;

    if (isInIframe) {
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

      // Request images from parent window
      const requestImages = () => {
        try {
          window.parent.postMessage({ type: "NUSENSE_REQUEST_IMAGES" }, "*");
        } catch (error) {
          // Error communicating with parent window
        }
      };

      requestImages();
    } else {
      // Standalone mode: extract images from current page
      const images = extractProductImages();
      if (images.length > 0) {
        const productImages: ProductImage[] = images.map((url) => ({
          url,
        }));
        setAvailableImages(productImages);
        imagesLoadedRef.current = true;
      }
    }
  }, []);

  // Listen for messages from parent window
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Extract store origin from postMessage events
      const storeOrigin = getStoreOriginFromPostMessage(event);
      if (storeOrigin && storeOrigin.method === "postmessage") {
        setStoreInfo((prev) => {
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

      // Handle product images from parent
      if (event.data && event.data.type === "NUSENSE_PRODUCT_IMAGES") {
        const parentImages = event.data.images || [];

        if (parentImages.length > 0) {
          const imageUrls: string[] = [];
          const imageIdMap = new Map<string, string | number>();

          parentImages.forEach((img: string | ProductImage) => {
            if (typeof img === "string") {
              imageUrls.push(img);
            } else if (img && typeof img === "object" && "url" in img) {
              imageUrls.push(img.url);
              if (img.id !== undefined) {
                imageIdMap.set(img.url, img.id);
              }
            }
          });

          const productImages: ProductImage[] = imageUrls.map((url) => ({
            url,
            id: imageIdMap.get(url),
          }));

          setAvailableImages(productImages);
          setAvailableImagesWithIds(imageIdMap);
          imagesLoadedRef.current = true;
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
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  // Handle mode change
  const handleModeChange = (newMode: CartOutfitMode) => {
    if (isGenerating) return;
    setMode(newMode);
    // Clear selections when switching modes (they have different constraints)
    setSelectedGarments([]);
    setCartResults(null);
    setOutfitResult(null);
    setError(null);
    setStatusMessage(
      newMode === "cart"
        ? "Mode Panier sélectionné. Sélectionnez 1-6 articles."
        : "Mode Tenue sélectionné. Sélectionnez 2-8 articles."
    );
  };

  // Handle photo upload
  const handlePhotoUpload = (
    dataURL: string,
    isDemoPhoto?: boolean,
    demoPhotoUrl?: string
  ) => {
    setUploadedImage(dataURL);
    if (isDemoPhoto && demoPhotoUrl) {
      setSelectedDemoPhotoUrl(demoPhotoUrl);
    } else {
      setSelectedDemoPhotoUrl(null);
    }
    setStatusVariant("info");
    setStatusMessage("Photo chargée. Sélectionnez les articles.");
  };

  // Handle garment selection
  const handleGarmentSelect = (garment: ProductImage) => {
    if (selectedGarments.length >= maxItems) return;

    const newGarment: SelectedGarment = {
      ...garment,
    };

    setSelectedGarments([...selectedGarments, newGarment]);
    setStatusVariant("info");
    setStatusMessage(
      `${selectedGarments.length + 1} article${selectedGarments.length + 1 > 1 ? "s" : ""} sélectionné${selectedGarments.length + 1 > 1 ? "s" : ""}.`
    );
  };

  // Handle garment deselection
  const handleGarmentDeselect = (index: number) => {
    const newGarments = selectedGarments.filter((_, i) => i !== index);
    setSelectedGarments(newGarments);
    setStatusVariant("info");
    setStatusMessage(
      newGarments.length > 0
        ? `${newGarments.length} article${newGarments.length > 1 ? "s" : ""} sélectionné${newGarments.length > 1 ? "s" : ""}.`
        : "Aucun article sélectionné."
    );
  };

  // Run generation
  const runGeneration = async () => {
    if (!uploadedImage || selectedGarments.length < minItems) {
      setStatusVariant("error");
      setStatusMessage(
        `La génération nécessite une photo et au moins ${minItems} article${minItems > 1 ? "s" : ""} sélectionné${minItems > 1 ? "s" : ""}.`
      );
      return;
    }

    setIsGenerating(true);
    setError(null);
    setProgress(0);
    setCartResults(null);
    setOutfitResult(null);
    setBatchProgress(null);
    setStatusVariant("info");

    let progressInterval: NodeJS.Timeout | null = null;

    try {
      const personBlob = await dataURLToBlob(uploadedImage);
      const storeName = storeInfo?.shopDomain || storeInfo?.domain || "";

      if (!storeName) {
        throw new Error("Informations de magasin non disponibles");
      }

      // Get personKey from demo photo if available
      const personKey = selectedDemoPhotoUrl
        ? DEMO_PHOTO_ID_MAP.get(selectedDemoPhotoUrl) || undefined
        : undefined;

      // Fetch all garment images
      const garmentBlobs: Blob[] = [];
      const garmentKeys: string[] = [];

      for (const garment of selectedGarments) {
        try {
          const response = await fetch(garment.url);
          const blob = await response.blob();
          garmentBlobs.push(blob);

          // Get garment key if available
          const garmentId = availableImagesWithIds.get(garment.url);
          if (garmentId) {
            garmentKeys.push(String(garmentId));
          }
        } catch (fetchError) {
          console.error("Failed to fetch garment image:", garment.url, fetchError);
          throw new Error(`Impossible de charger l'image de l'article: ${garment.url}`);
        }
      }

      if (mode === "cart") {
        // Cart mode: Generate individual images
        setStatusMessage(
          `Génération de ${selectedGarments.length} image${selectedGarments.length > 1 ? "s" : ""}...`
        );

        // Initialize batch progress
        setBatchProgress({
          total: selectedGarments.length,
          completed: 0,
          failed: 0,
        });
        setProgress(0);

        const result = await generateCartTryOn(
          personBlob,
          garmentBlobs,
          storeName,
          garmentKeys.length > 0 ? garmentKeys : undefined,
          personKey,
          selectedVersion
        );

        // Update batch progress with final results
        setBatchProgress({
          total: result.summary.totalGarments,
          completed: result.summary.successful,
          failed: result.summary.failed,
        });

        setCartResults(result);
        setProgress(100);
        setStatusVariant("info");
        setStatusMessage(
          `${result.summary.successful} image${result.summary.successful > 1 ? "s" : ""} générée${result.summary.successful > 1 ? "s" : ""} avec succès.`
        );
      } else {
        // Outfit mode: Generate combined outfit
        setStatusMessage("Génération de la tenue complète...");
        setProgress(0);
        setBatchProgress(null); // Clear batch progress for outfit mode

        // Extract garment types if available (for better AI understanding)
        const garmentTypes = selectedGarments
          .map((g) => g.type)
          .filter((t): t is string => !!t);

        // Simulate progress for outfit mode (since API doesn't provide real-time updates)
        progressInterval = setInterval(() => {
          setProgress((prev) => {
            if (prev >= 90) return prev; // Don't go to 100 until done
            return prev + 10;
          });
        }, 1000);

        const result = await generateOutfitLook(
          personBlob,
          garmentBlobs,
          garmentTypes,
          storeName,
          garmentKeys.length > 0 ? garmentKeys : undefined,
          personKey,
          selectedVersion
        );

        if (progressInterval) {
          clearInterval(progressInterval);
          progressInterval = null;
        }

        setOutfitResult(result);
        setProgress(100);
        setStatusVariant("info");
        setStatusMessage("Tenue complète générée avec succès.");
      }
    } catch (err) {
      // Clear progress interval if it exists
      if (progressInterval) {
        clearInterval(progressInterval);
        progressInterval = null;
      }

      const errorMessage =
        err instanceof Error
          ? err.message
          : "Une erreur inattendue s'est produite";
      setError(errorMessage);
      setStatusVariant("error");
      setStatusMessage(errorMessage);
      setProgress(0);
      setBatchProgress(null);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerate = () => {
    void runGeneration();
  };

  const handleReset = () => {
    setUploadedImage(null);
    setSelectedDemoPhotoUrl(null);
    setSelectedGarments([]);
    setCartResults(null);
    setOutfitResult(null);
    setError(null);
    setProgress(0);
    setBatchProgress(null);
    setSelectedVersion(1); // Reset version selection to default
    setStatusVariant("info");
    setStatusMessage(
      "Téléchargez votre photo puis sélectionnez les articles à essayer"
    );
  };

  // Handle close
  const handleClose = () => {
    const isInIframe = typeof window !== "undefined" && window.parent !== window;
    if (isInIframe) {
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

  const canGenerate =
    uploadedImage && selectedGarments.length >= minItems && !isGenerating;

  return (
    <div
      className="w-full h-full overflow-y-auto"
      style={{ backgroundColor: "#fef3f3", minHeight: "100vh" }}
      role="main"
      aria-label="Application d'essayage virtuel - Panier et Tenue"
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
              aria-label="NULOOK - Essayage Virtuel Panier et Tenue"
            >
              <span style={{ color: "#ce0003" }} aria-hidden="true">
                NU
              </span>
              <span style={{ color: "#564646" }} aria-hidden="true">
                LOOK
              </span>
            </h1>
            <p className="mt-0.5 sm:mt-1 text-left leading-tight tracking-tight whitespace-nowrap text-[10px] sm:text-xs md:text-sm text-[#3D3232] font-medium">
              Essayage Virtuel - Panier & Tenue
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
        {/* Mode Selector */}
        <CartOutfitModeSelector
          mode={mode}
          onModeChange={handleModeChange}
          disabled={isGenerating}
        />

        {/* Selection sections */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5 md:gap-6">
          {/* Left Panel: Upload */}
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
                <PhotoUpload
                  onPhotoUpload={handlePhotoUpload}
                  generatedPersonKeys={new Set()}
                  matchingPersonKeys={[]}
                />
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
                        onClick={() => {
                          setUploadedImage(null);
                          setSelectedDemoPhotoUrl(null);
                        }}
                        className="group h-8 sm:h-9 px-2.5 sm:px-3 text-xs sm:text-sm flex-shrink-0 gap-1.5"
                        aria-label="Effacer la photo téléchargée"
                      >
                        <XCircle
                          className="h-3.5 w-3.5 sm:h-4 sm:w-4"
                          aria-hidden="true"
                        />
                        <span>Effacer</span>
                      </Button>
                    </div>
                    <div className="relative aspect-[3/4] rounded overflow-hidden border border-border bg-card flex items-center justify-center shadow-sm">
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

          {/* Right Panel: Garment Selection */}
          <section aria-labelledby="garments-heading">
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
                    id="garments-heading"
                    className="text-base sm:text-lg font-semibold"
                  >
                    Sélectionner les Articles
                  </h2>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">
                    Sélectionnez {minItems}-{maxItems} article
                    {maxItems > 1 ? "s" : ""}
                  </p>
                </div>
              </div>

              <CartOutfitGarmentSelection
                images={availableImages}
                selectedGarments={selectedGarments}
                onSelect={handleGarmentSelect}
                onDeselect={handleGarmentDeselect}
                mode={mode}
                maxItems={maxItems}
                minItems={minItems}
                availableImagesWithIds={availableImagesWithIds}
              />
            </Card>
          </section>
        </div>

        {/* Version Selection and Generate button */}
        {!isGenerating && (
          <div className="pt-1 sm:pt-2 flex flex-col sm:flex-row gap-3 sm:gap-4">
            {/* Version Dropdown */}
            <div className="flex flex-col gap-2 flex-shrink-0 sm:w-auto">
              <label
                htmlFor="version-select-cart-outfit"
                className="text-sm font-semibold text-foreground"
              >
                {t("tryOnWidget.version.label") || "Version (Optional)"}
              </label>
              <Select
                value={selectedVersion ? String(selectedVersion) : "1"}
                onValueChange={(value) => {
                  setSelectedVersion(value ? Number(value) : 1);
                }}
              >
                <SelectTrigger
                  id="version-select-cart-outfit"
                  className="w-full sm:w-[140px] h-11 bg-background hover:bg-muted/50 transition-colors border-2 data-[state=open]:border-primary shadow-sm"
                  aria-label={t("tryOnWidget.version.ariaLabel") || "Select version"}
                >
                  <SelectValue placeholder={t("tryOnWidget.version.placeholder") || "Select a version (optional)"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1" className="cursor-pointer focus:bg-primary/10">
                    Version 1
                  </SelectItem>
                  <SelectItem value="2" className="cursor-pointer focus:bg-primary/10">
                    Version 2
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={handleGenerate}
              disabled={!canGenerate}
              className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground h-11 sm:h-12 md:h-14 text-sm sm:text-base md:text-lg min-h-[44px] shadow-md hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              aria-label="Générer l'essayage virtuel"
            >
              <Sparkles
                className="w-4 h-4 sm:w-5 sm:h-5 mr-2"
                aria-hidden="true"
              />
              {mode === "cart"
                ? `Générer ${selectedGarments.length} Image${selectedGarments.length > 1 ? "s" : ""}`
                : "Générer la Tenue Complète"}
            </Button>
          </div>
        )}

        {/* Progress Tracker */}
        {isGenerating && (
          <CartOutfitProgressTracker
            mode={mode}
            isGenerating={isGenerating}
            progress={progress}
            batchProgress={batchProgress || undefined}
            cartResults={cartResults?.results || []}
          />
        )}

        {/* Results section */}
        <section
          className="pt-2 sm:pt-4"
          aria-labelledby="results-heading"
          aria-live="polite"
          aria-busy={isGenerating}
        >
          <h2 id="results-heading" className="sr-only">
            Résultats de l'essayage virtuel
          </h2>
          <CartOutfitResultDisplay
            mode={mode}
            cartResults={cartResults}
            outfitResult={outfitResult}
            isGenerating={isGenerating}
            personImage={uploadedImage}
          />
        </section>

        {/* Error Display */}
        {error && (
          <div role="alert" aria-live="assertive">
            <Card className="p-6 bg-error/10 border-error">
              <p className="text-error font-medium" id="error-message">
                {error}
              </p>
              <Button
                variant="secondary"
                onClick={handleReset}
                className="group mt-4 gap-2"
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

