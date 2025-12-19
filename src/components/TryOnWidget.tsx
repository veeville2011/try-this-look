import { useState, useEffect, useLayoutEffect, useRef, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import "@/styles/fonts.css";
import { cn } from "@/lib/utils";
import PhotoUpload from "./PhotoUpload";
import { DEMO_PHOTO_ID_MAP } from "@/constants/demoPhotos";
import ClothingSelection from "./ClothingSelection";
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
import {
  CartOutfitMode,
  SelectedGarment,
  CartResponse,
  OutfitResponse,
  BatchProgress,
} from "@/types/cartOutfit";
import {
  generateCartTryOn,
  generateOutfitLook,
  dataURLToBlob as cartDataURLToBlob,
} from "@/services/cartOutfitApi";
import { fetchAllStoreProducts, type Category, type CategorizedProduct } from "@/services/productsApi";
import { fetchCategorizedProductsThunk } from "@/store/slices/categorizedProductsSlice";
import { Sparkles, X, RotateCcw, XCircle, CheckCircle, Loader2, Download, ShoppingCart, CreditCard, Image as ImageIcon, Check, Filter, Grid3x3, Package, ArrowLeft, Info, Share2 } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useImageGenerations } from "@/hooks/useImageGenerations";
import { useKeyMappings } from "@/hooks/useKeyMappings";
import { useStoreInfo } from "@/hooks/useStoreInfo";
import { useCategorizedProducts } from "@/hooks/useCategorizedProducts";
import { useIsMobile } from "@/hooks/use-mobile";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { addWatermarkToImage } from "@/utils/imageWatermark";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface TryOnWidgetProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export default function TryOnWidget({ isOpen, onClose }: TryOnWidgetProps) {
  type LayoutMode = "compact" | "wide";
  // Popover/container width breakpoint (popover is ~889px in your embed).
  // Use a container-based threshold so the widget shows the "desktop/wide" layout inside the popover.
  const WIDE_LAYOUT_MIN_WIDTH_PX = 880;

  // i18next translation hook
  const { t } = useTranslation();
  
  // Mobile detection
  const isMobile = useIsMobile();

  // Redux state for image generations
  const { fetchGenerations, records } = useImageGenerations();

  // Redux state for key mappings
  const {
    setSelectedClothingKey: setReduxClothingKey,
    setSelectedPersonKey: setReduxPersonKey,
    resetSelections: resetKeyMappings,
    clothingKeys,
    personKeys,
  } = useKeyMappings();

  // Redux state for store info
  const { fetchStoreInfo: fetchStoreInfoFromRedux, storeInfo: reduxStoreInfo } =
    useStoreInfo();

  // Redux state for categorized products
  const {
    categories: reduxCategories,
    uncategorized: reduxUncategorized,
    categoryMethod: reduxCategoryMethod,
    statistics: reduxStatistics,
    loading: isLoadingCategoriesRedux,
    error: categorizedProductsError,
    lastFetchedShop: reduxLastFetchedShop,
    fetchCategorizedProducts: fetchCategorizedProductsFromRedux,
  } = useCategorizedProducts();


  // Memoize the set of generated clothing keys to avoid recreating on every render
  const generatedClothingKeys = useMemo(() => {
    return new Set(
      records
        .filter((record) => {
          const hasClothingKey =
            record.clothingKey && String(record.clothingKey).trim() !== "";
          const isCompleted = record.status === "completed";
          return hasClothingKey && isCompleted;
        })
        .map((record) => String(record.clothingKey).trim())
    );
  }, [records]);

  // Memoize the set of generated person keys to avoid recreating on every render
  const generatedPersonKeys = useMemo(() => {
    return new Set(
      records
        .filter((record) => {
          const hasPersonKey =
            record.personKey && String(record.personKey).trim() !== "";
          const isCompleted = record.status === "completed";
          return hasPersonKey && isCompleted;
        })
        .map((record) => String(record.personKey).trim())
    );
  }, [records]);

  // Memoize the set of person-clothing key combinations that exist together in the same record
  const generatedKeyCombinations = useMemo(() => {
    return new Set(
      records
        .filter((record) => {
          const hasPersonKey =
            record.personKey && String(record.personKey).trim() !== "";
          const hasClothingKey =
            record.clothingKey && String(record.clothingKey).trim() !== "";
          const isCompleted = record.status === "completed";
          return hasPersonKey && hasClothingKey && isCompleted;
        })
        .map(
          (record) =>
            `${String(record.personKey).trim()}-${String(
              record.clothingKey
            ).trim()}`
        )
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
  const [photoSelectionMethod, setPhotoSelectionMethod] = useState<"file" | "demo" | null>(null);
  // Try Single Tab - Independent image state (from parent window or page extraction)
  const [singleTabImages, setSingleTabImages] = useState<string[]>([]);
  const [singleTabImagesWithIds, setSingleTabImagesWithIds] = useState<
    Map<string, string | number>
  >(new Map());
  
  // Try Multiple Tab - Independent image state (from categorized products)
  const [multipleTabImages, setMultipleTabImages] = useState<string[]>([]);
  const [multipleTabImagesWithIds, setMultipleTabImagesWithIds] = useState<
    Map<string, string | number>
  >(new Map());
  
  // Try Look Tab - Independent image state (from categorized products)
  const [lookTabImages, setLookTabImages] = useState<string[]>([]);
  const [lookTabImagesWithIds, setLookTabImagesWithIds] = useState<
    Map<string, string | number>
  >(new Map());
  const [recommendedImages, setRecommendedImages] = useState<string[]>([]);
  const [recommendedImagesWithIds, setRecommendedImagesWithIds] = useState<
    Map<string, string | number>
  >(new Map());
  
  const singleTabAvailableImagesWithIds = useMemo(() => {
    // Ensure selecting a "recommended" product can resolve an ID (used for key mappings/cache).
    return new Map<string, string | number>([
      ...singleTabImagesWithIds.entries(),
      ...recommendedImagesWithIds.entries(),
    ]);
  }, [singleTabImagesWithIds, recommendedImagesWithIds]);
  
  // Helper functions to get tab-specific images
  const getCurrentTabImages = (): string[] => {
    switch (activeTab) {
      case "single":
        return singleTabImages;
      case "multiple":
        return multipleTabImages;
      case "look":
        return lookTabImages;
      default:
        return singleTabImages;
    }
  };
  
  const getCurrentTabImagesWithIds = (): Map<string, string | number> => {
    switch (activeTab) {
      case "single":
        return singleTabAvailableImagesWithIds;
      case "multiple":
        return multipleTabImagesWithIds;
      case "look":
        return lookTabImagesWithIds;
      default:
        return singleTabAvailableImagesWithIds;
    }
  };
  
  const setCurrentTabImages = (images: string[]) => {
    switch (activeTab) {
      case "single":
        setSingleTabImages(images);
        break;
      case "multiple":
        setMultipleTabImages(images);
        break;
      case "look":
        setLookTabImages(images);
        break;
    }
  };
  
  const setCurrentTabImagesWithIds = (idMap: Map<string, string | number>) => {
    switch (activeTab) {
      case "single":
        setSingleTabImagesWithIds(idMap);
        break;
      case "multiple":
        setMultipleTabImagesWithIds(idMap);
        break;
      case "look":
        setLookTabImagesWithIds(idMap);
        break;
    }
  };
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isBuyNowLoading, setIsBuyNowLoading] = useState(false);
  const [isAddToCartLoading, setIsAddToCartLoading] = useState(false);
  const [isDownloadLoading, setIsDownloadLoading] = useState(false);
  const [isInstagramShareLoading, setIsInstagramShareLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const widgetContainerRef = useRef<HTMLDivElement | null>(null);
  const [layoutMode, setLayoutMode] = useState<LayoutMode>("compact");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusVariant, setStatusVariant] = useState<"info" | "error">("info");
  const [storeInfo, setStoreInfo] = useState<StoreInfo | null>(null);
  const [activeTab, setActiveTab] = useState<"single" | "multiple" | "look">("single");
  
  // Mobile step state: "photo" (show photo upload) or "clothing" (show clothing selection)
  const [mobileStep, setMobileStep] = useState<"photo" | "clothing">("photo");
  
  // Cart/Outfit state (for Try Multiple and Try Look tabs)
  const [cartMultipleImage, setCartMultipleImage] = useState<string | null>(null);
  const [cartMultipleDemoPhotoUrl, setCartMultipleDemoPhotoUrl] = useState<string | null>(null);
  const [selectedGarments, setSelectedGarments] = useState<SelectedGarment[]>([]);
  const [isGeneratingMultiple, setIsGeneratingMultiple] = useState(false);
  const [cartResults, setCartResults] = useState<CartResponse | null>(null);
  const [outfitResult, setOutfitResult] = useState<OutfitResponse | null>(null);
  const [errorMultiple, setErrorMultiple] = useState<string | null>(null);
  const [progressMultiple, setProgressMultiple] = useState(0);
  const [batchProgress, setBatchProgress] = useState<BatchProgress | null>(null);
  const [downloadingIndex, setDownloadingIndex] = useState<number | null>(null);
  const [cartItems, setCartItems] = useState<ProductImage[]>([]);
  
  // Selected category for filtering (local state for UI)
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  
  // Version selection (1 or 2, default: 1)
  const [selectedVersion, setSelectedVersion] = useState<number | null>(1);
  
  // Confirmation dialog states
  const [showClearAllConfirm, setShowClearAllConfirm] = useState(false);
  const [showTabSwitchConfirm, setShowTabSwitchConfirm] = useState(false);
  const [pendingTab, setPendingTab] = useState<"single" | "multiple" | "look" | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  // Derive store_products from Redux state for backward compatibility
  const store_products = reduxCategories.length > 0 || reduxUncategorized
    ? {
        categories: reduxCategories,
        uncategorized: reduxUncategorized || {
          categoryName: t("tryOnWidget.filters.uncategorized") || "Non catégorisé",
          productCount: 0,
          products: [],
        },
        categoryMethod: reduxCategoryMethod || "category",
        statistics: reduxStatistics,
      }
    : null;
  
  // Use Redux loading state
  const isLoadingCategories = isLoadingCategoriesRedux;
  
  const INFLIGHT_KEY = "nusense_tryon_inflight";
  // Track if we've already loaded images from URL/NUSENSE_PRODUCT_DATA to prevent parent images from overriding
  const imagesLoadedRef = useRef<boolean>(false);
  // Track if we're currently closing to prevent double-close
  const isClosingRef = useRef<boolean>(false);
  const storeRecommendedLoadedForShopRef = useRef<string | null>(null);
  console.log({ storeInfo });

  // Set initial status message
  useEffect(() => {
    if (!statusMessage) {
      setStatusMessage(t("tryOnWidget.status.initial") || "Téléchargez votre photo puis choisissez un article à essayer");
    }
  }, [t, statusMessage]);

  // Container-width based responsiveness - useLayoutEffect prevents flickering
  useLayoutEffect(() => {
    const containerNode = widgetContainerRef.current;
    if (!containerNode) return;

    const width = containerNode.getBoundingClientRect().width;
    const nextMode: LayoutMode = width >= WIDE_LAYOUT_MIN_WIDTH_PX ? "wide" : "compact";
    setLayoutMode(nextMode);
  }, []);

  // Watch for resize changes
  useEffect(() => {
    const containerNode = widgetContainerRef.current;
    if (!containerNode) return;

    const resizeObserver = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width !== undefined) {
        const nextMode: LayoutMode = width >= WIDE_LAYOUT_MIN_WIDTH_PX ? "wide" : "compact";
        setLayoutMode((prev) => prev !== nextMode ? nextMode : prev);
      }
    });

    resizeObserver.observe(containerNode);
    return () => resizeObserver.disconnect();
  }, []);

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

  // Fetch products with ACTIVE status and Apparel productType when component opens
  useEffect(() => {
    const shopDomain = storeInfo?.shopDomain || storeInfo?.domain || reduxStoreInfo?.shop;
    
    if (shopDomain) {
      // Normalize shop domain (remove .myshopify.com if present, API will handle it)
      const normalizedShop = shopDomain.replace(".myshopify.com", "");
      
      fetchAllStoreProducts(normalizedShop, {
        status: "ACTIVE",
        productType: "Apparel",
      })
        .then((response) => {
          if (response.success) {
            console.log("[TryOnWidget] Products loaded on mount:", {
              count: response.count,
              shop: normalizedShop,
            });
          } else {
            console.warn("[TryOnWidget] Failed to load products on mount:", {
              shop: normalizedShop,
            });
          }
        })
        .catch((error) => {
          console.error("[TryOnWidget] Error loading products on mount:", error);
        });
    }
  }, [storeInfo, reduxStoreInfo]); // Call when store info is available

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
      setStatusMessage(t("tryOnWidget.status.photoUploaded") || "Photo chargée. Sélectionnez un vêtement.");
      // Move to clothing selection step on mobile when image is restored
      setMobileStep("clothing");
    }
    if (savedClothing) {
      setSelectedClothing(savedClothing);
      setStatusMessage(t("tryOnWidget.status.readyToGenerate") || "Prêt à générer. Cliquez sur Générer.");
      // Note: clothingKey will be restored when images are loaded (see useEffect below)
    }
    if (savedResult) {
      setGeneratedImage(savedResult);
      setCurrentStep(4);
      setStatusMessage(t("tryOnWidget.status.resultReady") || "Résultat prêt. Utilisez les actions ci-dessous.");
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

      // Fetch store info from API when in iframe mode
      // Get shop domain from detectedStore or storeInfo state
      const shopDomain =
        detectedStore?.shopDomain ||
        detectedStore?.domain ||
        storeInfo?.shopDomain ||
        storeInfo?.domain;

      if (shopDomain) {
        // Normalize shop domain (remove .myshopify.com if present, API will handle it)
        const normalizedShop = shopDomain.replace(".myshopify.com", "");
        fetchStoreInfoFromRedux({ shop: normalizedShop }).catch((error) => {
          console.warn(
            "[TryOnWidget] Failed to fetch store info from API:",
            error
          );
        });
      }

      // DO NOT extract from widget's own page when in iframe mode
      // Images will be requested in a separate useEffect that handles activeTab changes
      // This ensures images are requested at the right time and only when needed
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
          // Store only for Try Single tab (from URL params)
          setSingleTabImages(productData.images);
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
        // Store only for Try Single tab (from window.NUSENSE_PRODUCT_DATA)
        setSingleTabImages(productData.images);
        imagesLoadedRef.current = true;
        imagesFound = true;
      }
    }

    // Priority 3: Extract product images from the current page (standalone mode only)
    if (!imagesFound) {
      const images = extractProductImages();
      if (images.length > 0) {
        // Store only for Try Single tab (from page extraction)
        setSingleTabImages(images);
        setSingleTabImagesWithIds(new Map());
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

        console.log(
          "[TryOnWidget] Received NUSENSE_PRODUCT_IMAGES:",
          parentImages.length,
          "images,",
          parentRecommendedImages.length,
          "recommended"
        );

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

          // Store only for Try Single tab (from parent window postMessage)
          // Always update images even if they were previously loaded (parent might send updated images)
          setSingleTabImages(imageUrls);
          setSingleTabImagesWithIds(imageIdMap);
          imagesLoadedRef.current = true;

          // Debug logging
          console.log(
            "[TryOnWidget] Product images loaded:",
            imageUrls.length,
            "images,",
            imageIdMap.size,
            "with IDs"
          );
        } else {
          // If parent sends empty array, log it for debugging
          console.log("[TryOnWidget] Parent sent empty images array");
        }

        // Recommended rail (iframe): use parent-provided recommended images.
        // If parent can't find other product images on the page, fall back to main product images.
        const recommendedSource =
          parentRecommendedImages.length > 0 ? parentRecommendedImages : parentImages;

        if (recommendedSource.length > 0) {
          const recommendedUrls: string[] = [];
          const recommendedIdMap = new Map<string, string | number>();

          recommendedSource.forEach((img: string | ProductImage) => {
            if (typeof img === "string") {
              recommendedUrls.push(img);
              return;
            }
            if (img && typeof img === "object" && "url" in img && img.url) {
              recommendedUrls.push(img.url);
              if (img.id !== undefined) {
                recommendedIdMap.set(img.url, img.id);
              }
            }
          });

          const uniqueUrls = Array.from(new Set(recommendedUrls.filter(Boolean)));
          setRecommendedImages(uniqueUrls);
          setRecommendedImagesWithIds(recommendedIdMap);

          console.log("[TryOnWidget] Recommended images loaded:", uniqueUrls.length);
        } else {
          // If none are available, clear the rail so it doesn't repeat main images.
          setRecommendedImages([]);
          setRecommendedImagesWithIds(new Map());
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

        // Fetch store info from API when store info is received via postMessage
        const shopDomain = storeInfo.shopDomain || storeInfo.domain;
        if (shopDomain) {
          // Normalize shop domain (remove .myshopify.com if present, API will handle it)
          const normalizedShop = shopDomain.replace(".myshopify.com", "");
          fetchStoreInfoFromRedux({ shop: normalizedShop }).catch((error) => {
            console.warn(
              "[TryOnWidget] Failed to fetch store info from API:",
              error
            );
          });
        }
        // Store info will be logged by the useEffect above
      }

      // Handle cart items from parent window (for Try Multiple and Try Look tabs)
      if (event.data && event.data.type === "NUSENSE_CART_ITEMS") {
        const items = event.data.items || [];
        const productImages: ProductImage[] = items.map((item: any) => ({
          url: item.url,
          id: item.id || item.variantId,
        }));
        setCartItems(productImages);
        
        // If we're in multiple/look tab and no images loaded yet, use cart items
        if (activeTab === "multiple" && multipleTabImages.length === 0) {
          const imageUrls = productImages.map(img => img.url);
          const idMap = new Map<string, string | number>();
          productImages.forEach((item) => {
            if (item.id) {
              idMap.set(item.url, item.id);
            }
          });
          setMultipleTabImages(imageUrls);
          setMultipleTabImagesWithIds(idMap);
        } else if (activeTab === "look" && lookTabImages.length === 0) {
          const imageUrls = productImages.map(img => img.url);
          const idMap = new Map<string, string | number>();
          productImages.forEach((item) => {
            if (item.id) {
              idMap.set(item.url, item.id);
            }
          });
          setLookTabImages(imageUrls);
          setLookTabImagesWithIds(idMap);
        }
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [fetchStoreInfoFromRedux, activeTab, multipleTabImages.length, lookTabImages.length]); // Include fetchStoreInfoFromRedux in dependencies

  // Request images from parent window when in iframe mode and on single tab
  // This runs:
  // 1. On initial mount when activeTab is "single"
  // 2. When activeTab changes to "single"
  // 3. When switching to clothing step on mobile (to ensure images are loaded)
  useEffect(() => {
    const isInIframe = window.parent !== window;
    
    // Only request images if we're in iframe mode, on single tab, and don't have images yet
    if (isInIframe && activeTab === "single" && singleTabImages.length === 0) {
      console.log("[TryOnWidget] Requesting images from parent", {
        activeTab,
        mobileStep,
        currentImages: singleTabImages.length,
        isInIframe: true
      });
      try {
        window.parent.postMessage({ type: "NUSENSE_REQUEST_IMAGES" }, "*");
        console.log("[TryOnWidget] Image request message sent to parent");
      } catch (error) {
        console.error("[TryOnWidget] Failed to send image request to parent", error);
      }
    }
  }, [activeTab, mobileStep, singleTabImages.length]); // Include singleTabImages.length to prevent duplicate requests

  // Fetch store info from API when storeInfo state changes (from detectStoreOrigin)
  useEffect(() => {
    const isInIframe = window.parent !== window;
    if (!isInIframe) {
      return; // Only fetch in iframe mode
    }

    const shopDomain = storeInfo?.shopDomain || storeInfo?.domain;
    if (shopDomain && shopDomain !== reduxStoreInfo?.shop) {
      // Normalize shop domain (remove .myshopify.com if present, API will handle it)
      const normalizedShop = shopDomain.replace(".myshopify.com", "");
      fetchStoreInfoFromRedux({ shop: normalizedShop }).catch((error) => {
        console.warn(
          "[TryOnWidget] Failed to fetch store info from API:",
          error
        );
      });
    }
  }, [storeInfo, reduxStoreInfo, fetchStoreInfoFromRedux]);

  // Fetch categorized products when component loads (for Try Multiple and Try Look tabs)
  useEffect(() => {
    const shopDomain = storeInfo?.shopDomain || storeInfo?.domain || reduxStoreInfo?.shop;
    
    if (shopDomain && !store_products && reduxLastFetchedShop !== shopDomain.replace(".myshopify.com", "")) {
      // Normalize shop domain
      const normalizedShop = shopDomain.replace(".myshopify.com", "");
      
      // Fetch categorized products using Redux (default: by category)
      fetchCategorizedProductsFromRedux(normalizedShop, {
        categoryBy: "title",
      })
        .then((result) => {
          if (fetchCategorizedProductsThunk.fulfilled.match(result)) {
            console.log("[TryOnWidget] Loaded categorized products via Redux", {
              totalCategories: result.payload?.statistics?.totalCategories || 0,
              totalProducts: result.payload?.statistics?.totalProducts || 0,
              categoryMethod: result.payload?.categoryMethod || "category",
            });
          } else {
            console.warn("[TryOnWidget] Failed to fetch categorized products:", result.payload);
          }
        })
        .catch((error) => {
          console.error("[TryOnWidget] Error fetching categorized products:", error);
        });
    }
  }, [storeInfo, reduxStoreInfo, store_products, reduxLastFetchedShop, fetchCategorizedProductsFromRedux]);

  // Populate "Recommended products" with ALL store products (Try Single tab)
  useEffect(() => {
    if (activeTab !== "single") return;

    // In iframe mode, the parent page is the source of truth (no API).
    // If parent images are available, they already populate recommendedImages via postMessage.
    const isInIframe = typeof window !== "undefined" && window.parent !== window;
    if (isInIframe) return;

    const shopDomain = storeInfo?.shopDomain || storeInfo?.domain || reduxStoreInfo?.shop;
    if (!shopDomain) return;

    const normalizedShop = shopDomain.replace(".myshopify.com", "");

    const toNumericId = (gid: string): string => {
      const match = gid.match(/\/(\d+)$/);
      return match?.[1] || gid;
    };

    if (store_products) {
      const productsToShow: CategorizedProduct[] = [];
      store_products.categories.forEach((category) => {
        productsToShow.push(...category.products);
      });
      if (store_products.uncategorized.products.length > 0) {
        productsToShow.push(...store_products.uncategorized.products);
      }

      const imageUrls: string[] = [];
      const idMap = new Map<string, string | number>();

      productsToShow.forEach((product) => {
        const firstImage = product.media?.nodes?.[0]?.image;
        if (!firstImage?.url) return;

        imageUrls.push(firstImage.url);
        if (product.id) {
          idMap.set(firstImage.url, toNumericId(product.id));
        }
      });

      setRecommendedImages(imageUrls);
      setRecommendedImagesWithIds(idMap);
      storeRecommendedLoadedForShopRef.current = normalizedShop;
      return;
    }

    // If categorized products aren't available yet, fetch all store products as the source of truth.
    if (isLoadingCategories) return;
    if (storeRecommendedLoadedForShopRef.current === normalizedShop) return;

    storeRecommendedLoadedForShopRef.current = normalizedShop;
    fetchAllStoreProducts(normalizedShop)
      .then((response) => {
        if (!response.success || response.products.length === 0) return;

        const imageUrls = response.products.map((p) => p.imageUrl).filter(Boolean);
        const idMap = new Map<string, string | number>();

        response.products.forEach((p) => {
          if (!p.imageUrl) return;
          idMap.set(p.imageUrl, p.imageId || p.productId);
        });

        setRecommendedImages(imageUrls);
        setRecommendedImagesWithIds(idMap);
      })
      .catch((error) => {
        console.error("[TryOnWidget] Failed to load store products for recommended rail:", error);
      });
  }, [activeTab, storeInfo, reduxStoreInfo, store_products, isLoadingCategories]);

  // Update images based on selected category for Try Multiple tab
  useEffect(() => {
    if (activeTab === "multiple" && store_products) {
      let productsToShow: CategorizedProduct[] = [];
      let categoryName = "";
      
      if (selectedCategory === "all") {
        // Show all products from all categories
        store_products.categories.forEach((category) => {
          productsToShow = [...productsToShow, ...category.products];
        });
        // Also include uncategorized products
        if (store_products.uncategorized.products.length > 0) {
          productsToShow = [...productsToShow, ...store_products.uncategorized.products];
        }
        categoryName = t("tryOnWidget.filters.allCategories") || "Toutes les catégories";
      } else if (selectedCategory === "uncategorized") {
        // Show only uncategorized products
        productsToShow = store_products.uncategorized.products;
        categoryName = store_products.uncategorized.categoryName;
      } else {
        // Show products from selected category
        const category = store_products.categories.find(
          (cat) => cat.categoryId === selectedCategory || cat.categoryName === selectedCategory
        );
        if (category) {
          productsToShow = category.products;
          categoryName = category.categoryName;
        }
      }
      
      // Extract image URLs and create ID map from categorized products
      const imageUrls: string[] = [];
      const idMap = new Map<string, string | number>();
      
      productsToShow.forEach((product) => {
        // Get the first media image
        const firstImage = product.media?.nodes?.[0]?.image;
        if (firstImage?.url) {
          imageUrls.push(firstImage.url);
          // Use product ID as the key
          if (product.id) {
            // Extract numeric ID from GID format (gid://shopify/Product/123456789)
            const idMatch = product.id.match(/\/(\d+)$/);
            if (idMatch) {
              idMap.set(firstImage.url, idMatch[1]);
            } else {
              idMap.set(firstImage.url, product.id);
            }
          }
        }
      });
      
      // Update only Try Multiple tab images
      setMultipleTabImages(imageUrls);
      setMultipleTabImagesWithIds(idMap);
      
      console.log("[TryOnWidget] Updated Try Multiple tab images for category", {
        category: categoryName,
        categoryId: selectedCategory,
        imageCount: imageUrls.length,
      });
    }
  }, [activeTab, selectedCategory, store_products, t]);

  // Update images based on selected category for Try Look tab
  useEffect(() => {
    if (activeTab === "look" && store_products) {
      let productsToShow: CategorizedProduct[] = [];
      let categoryName = "";
      
      if (selectedCategory === "all") {
        // Show all products from all categories
        store_products.categories.forEach((category) => {
          productsToShow = [...productsToShow, ...category.products];
        });
        // Also include uncategorized products
        if (store_products.uncategorized.products.length > 0) {
          productsToShow = [...productsToShow, ...store_products.uncategorized.products];
        }
        categoryName = t("tryOnWidget.filters.allCategories") || "Toutes les catégories";
      } else if (selectedCategory === "uncategorized") {
        // Show only uncategorized products
        productsToShow = store_products.uncategorized.products;
        categoryName = store_products.uncategorized.categoryName;
      } else {
        // Show products from selected category
        const category = store_products.categories.find(
          (cat) => cat.categoryId === selectedCategory || cat.categoryName === selectedCategory
        );
        if (category) {
          productsToShow = category.products;
          categoryName = category.categoryName;
        }
      }
      
      // Extract image URLs and create ID map from categorized products
      const imageUrls: string[] = [];
      const idMap = new Map<string, string | number>();
      
      productsToShow.forEach((product) => {
        // Get the first media image
        const firstImage = product.media?.nodes?.[0]?.image;
        if (firstImage?.url) {
          imageUrls.push(firstImage.url);
          // Use product ID as the key
          if (product.id) {
            // Extract numeric ID from GID format (gid://shopify/Product/123456789)
            const idMatch = product.id.match(/\/(\d+)$/);
            if (idMatch) {
              idMap.set(firstImage.url, idMatch[1]);
            } else {
              idMap.set(firstImage.url, product.id);
            }
          }
        }
      });
      
      // Update only Try Look tab images
      setLookTabImages(imageUrls);
      setLookTabImagesWithIds(idMap);
      
      console.log("[TryOnWidget] Updated Try Look tab images for category", {
        category: categoryName,
        categoryId: selectedCategory,
        imageCount: imageUrls.length,
      });
    }
  }, [activeTab, selectedCategory, store_products, t]);

  // Fallback: Fetch all store products when in "Try Multiple" or "Try Look" tabs if categorized products not available
  useEffect(() => {
    if ((activeTab === "multiple" || activeTab === "look") && !store_products && !isLoadingCategories) {
      const shopDomain = storeInfo?.shopDomain || storeInfo?.domain || reduxStoreInfo?.shop;
      
      if (shopDomain) {
        // Normalize shop domain
        const normalizedShop = shopDomain.replace(".myshopify.com", "");
        
        // Fetch all products from the store as fallback
        fetchAllStoreProducts(normalizedShop)
          .then((response) => {
            if (response.success && response.products.length > 0) {
              // Extract image URLs and create ID map
              const imageUrls = response.products.map((product) => product.imageUrl);
              const idMap = new Map<string, string | number>();
              
              response.products.forEach((product) => {
                // Use imageId as the key, fallback to productId
                const id = product.imageId || product.productId;
                if (id) {
                  idMap.set(product.imageUrl, id);
                }
              });
              
              // Update images for the active tab (fallback when categorized products not available)
              if (activeTab === "multiple") {
                setMultipleTabImages(imageUrls);
                setMultipleTabImagesWithIds(idMap);
              } else if (activeTab === "look") {
                setLookTabImages(imageUrls);
                setLookTabImagesWithIds(idMap);
              }
              
              console.log("[TryOnWidget] Loaded all store products (fallback)", {
                count: response.count,
                imagesCount: imageUrls.length,
              });
            } else {
              console.warn("[TryOnWidget] No products found or fetch failed", {
                success: response.success,
                count: response.count,
              });
              
              // Fallback: Request cart items from parent window
              const isInIframe = window.parent !== window;
              if (isInIframe) {
                try {
                  window.parent.postMessage(
                    { type: "NUSENSE_REQUEST_CART_ITEMS" },
                    "*"
                  );
                  window.parent.postMessage({ type: "NUSENSE_REQUEST_IMAGES" }, "*");
                } catch (error) {
                  // Error communicating with parent window
                }
              }
            }
          })
          .catch((error) => {
            console.error("[TryOnWidget] Failed to fetch store products:", error);
            
            // Fallback: Request cart items from parent window
            const isInIframe = window.parent !== window;
            if (isInIframe) {
              try {
                window.parent.postMessage(
                  { type: "NUSENSE_REQUEST_CART_ITEMS" },
                  "*"
                );
                window.parent.postMessage({ type: "NUSENSE_REQUEST_IMAGES" }, "*");
              } catch (err) {
                // Error communicating with parent window
              }
            }
          });
      } else {
        // No shop domain available, request from parent window
        const isInIframe = window.parent !== window;
        if (isInIframe) {
          try {
            window.parent.postMessage(
              { type: "NUSENSE_REQUEST_CART_ITEMS" },
              "*"
            );
            window.parent.postMessage({ type: "NUSENSE_REQUEST_IMAGES" }, "*");
          } catch (error) {
            // Error communicating with parent window
          }
        }
      }
    }
  }, [activeTab, storeInfo, reduxStoreInfo, store_products, isLoadingCategories]);

  const handlePhotoUpload = (
    dataURL: string,
    isDemoPhoto?: boolean,
    demoPhotoUrl?: string
  ) => {
    setUploadedImage(dataURL);
    storage.saveUploadedImage(dataURL);
    setHasUnsavedChanges(true);
    // Track which selection method was used
    if (isDemoPhoto && demoPhotoUrl) {
      setPhotoSelectionMethod("demo");
      setSelectedDemoPhotoUrl(demoPhotoUrl);
      // Set personKey in Redux for key mappings
      const personKey = DEMO_PHOTO_ID_MAP.get(demoPhotoUrl);
      setReduxPersonKey(personKey || null);
    } else {
      setPhotoSelectionMethod("file");
      setSelectedDemoPhotoUrl(null);
      // Clear personKey in Redux when custom photo is uploaded
      setReduxPersonKey(null);
    }
    setStatusVariant("info");
    setStatusMessage(t("tryOnWidget.status.photoUploaded") || "Photo chargée. Sélectionnez un vêtement.");
    // Don't auto-advance to clothing step - let the continue button handle it
    // On desktop, layout is side-by-side so no step change needed
    // On mobile, the continue button in TryOnWidget will advance to clothing step
  };

  const handleClothingSelect = (imageUrl: string) => {
    setSelectedClothing(imageUrl);
    storage.saveClothingUrl(imageUrl);
    setHasUnsavedChanges(true);

    // Get the clothing ID if available (clear if imageUrl is empty)
    if (imageUrl) {
      const clothingId = singleTabAvailableImagesWithIds.get(imageUrl) || null;
      setSelectedClothingKey(clothingId);

      // Set clothingKey in Redux for key mappings
      const clothingKey = clothingId ? String(clothingId).trim() : null;
      setReduxClothingKey(clothingKey);

      setStatusVariant("info");
      setStatusMessage(t("tryOnWidget.status.readyToGenerate") || "Prêt à générer. Cliquez sur Générer.");
    } else {
      setSelectedClothingKey(null);
      // Clear clothingKey in Redux
      setReduxClothingKey(null);
      setStatusVariant("info");
      setStatusMessage(t("tryOnWidget.status.photoUploaded") || "Photo chargée. Sélectionnez un vêtement.");
    }
  };

  const runImageGeneration = async () => {
    if (!uploadedImage || !selectedClothing) {
      setStatusVariant("error");
      setStatusMessage(
        t("tryOnWidget.errors.missingPhotoOrClothing") || "La génération nécessite une photo et un article sélectionné."
      );
      return;
    }

    // Show a high-quality loading state immediately (and avoid “stale result” confusion)
    setIsGenerating(true);
    setError(null);
    setProgress(0);
    setCurrentStep(3);
    setStatusVariant("info");
    setStatusMessage(
      t("tryOnWidget.status.generating") || "Génération en cours. Cela peut prendre 15 à 20 secondes…"
    );
    try {
      localStorage.setItem(INFLIGHT_KEY, "1");
    } catch {}

    // Perceived-performance: smooth, non-blocking progress ramp while the API works.
    // We cap at 92% and finish at 100% on success.
    let progressTimer: number | null = null;
    try {
      progressTimer = window.setInterval(() => {
        setProgress((current) => {
          if (current >= 92) return 92;
          const next = current + Math.max(1, Math.round((92 - current) * 0.08));
          return Math.min(92, next);
        });
      }, 450);
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
      // - version: optional version parameter (1 or 2)
      const result: TryOnResponse = await generateTryOn(
        personBlob,
        clothingBlob,
        storeName,
        clothingKey, // Non-mandatory: sent when product image has ID
        personKey, // Non-mandatory: sent when demo picture is used
        selectedVersion // Non-mandatory: sent when version is selected
      );

      setProgress(100);

      if (result.status === "success" && result.image) {
        setGeneratedImage(result.image);
        storage.saveGeneratedImage(result.image);
        setHasUnsavedChanges(false);
        setCurrentStep(4);
        setStatusVariant("info");
        setStatusMessage(t("tryOnWidget.status.resultReadyActions") || "Résultat prêt. Vous pouvez acheter ou télécharger.");

        // Fetch all generations to update Redux state with the new generation
        fetchGenerations({
          page: 1,
          limit: 1000,
          orderBy: "createdAt",
          orderDirection: "DESC",
        });
      } else {
        throw new Error(
          result.error_message?.message || t("tryOnWidget.errors.generationError") || "Erreur de génération"
        );
      }
    } catch (err) {
      // Check if error requires authentication
      const requiresLogin = err && typeof err === "object" && "requiresLogin" in err && (err as any).requiresLogin;
      
      let errorMessage =
        err instanceof Error
          ? err.message
          : t("tryOnWidget.errors.unexpectedError") || "Une erreur inattendue s'est produite";
      
      // Handle authentication required error
      if (requiresLogin) {
        errorMessage = t("tryOnWidget.errors.authenticationRequired") || "Veuillez vous connecter pour utiliser ce service.";
        // Optionally trigger login flow - user can click login button
        // Don't auto-trigger to avoid interrupting user flow
      }
      
      setError(errorMessage);
      setStatusVariant("error");
      setStatusMessage(errorMessage);
    } finally {
      if (progressTimer != null) {
        try {
          window.clearInterval(progressTimer);
        } catch {}
      }
      setIsGenerating(false);
      try {
        localStorage.removeItem(INFLIGHT_KEY);
      } catch {}
    }
  };

  const handleGenerate = () => {
    void runImageGeneration();
  };

  const handleRetryGeneration = () => {
    if (isGenerating) return;
    if (!selectedClothing || !uploadedImage) return;
    void runImageGeneration();
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
          // Store only for Try Single tab (from URL params)
          setSingleTabImages(urls);
          setSingleTabImagesWithIds(idMap);
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
        // Store only for Try Single tab (from window.NUSENSE_PRODUCT_DATA)
        setSingleTabImages(urls);
        setSingleTabImagesWithIds(idMap);
        imagesFound = true;
      }
    }

    // Priority 3: Extract product images from the current page
    if (!imagesFound) {
      const images = extractProductImages();
      if (images.length > 0) {
        // extractProductImages returns string array, so no IDs available
        // Store only for Try Single tab (from page extraction)
        setSingleTabImages(images);
        setSingleTabImagesWithIds(new Map());
        imagesFound = true;
      }
    }
  };

  const handleClearUploadedImage = () => {
    setUploadedImage(null);
    setSelectedDemoPhotoUrl(null);
    setPhotoSelectionMethod(null); // Clear selection method to reset to default view
    // Clear personKey in Redux
    setReduxPersonKey(null);
    try {
      storage.clearUploadedImage();
    } catch {}
    setCurrentStep(1);
    setStatusVariant("info");
    setStatusMessage(t("tryOnWidget.status.photoCleared") || "Photo effacée. Téléchargez votre photo.");
    // Reset to photo selection step on mobile
    setMobileStep("photo");
  };

  // Get product data if available (from Shopify parent window)
  const getProductData = (): { id?: number; title?: string; url?: string } | null => {
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
      // Cross-origin access might fail, that's okay
    }
    return null;
  };

  const handleBuyNow = async () => {
    if (isBuyNowLoading) return;

    setIsBuyNowLoading(true);

    try {
      const isInIframe = window.parent !== window;
      const productData = getProductData();

      if (isInIframe) {
        const message = {
          type: "NUSENSE_BUY_NOW",
          ...(productData && { product: productData }),
        };
        window.parent.postMessage(message, "*");

        toast.info(t("tryOnWidget.resultDisplay.addingToCart") || "Ajout au panier...", {
          description: t("tryOnWidget.resultDisplay.redirectingToCheckout") || "Redirection vers la page de paiement en cours.",
        });

        setTimeout(() => {
          setIsBuyNowLoading(false);
        }, 10000);
      } else {
        setIsBuyNowLoading(false);
        toast.error(t("tryOnWidget.resultDisplay.featureUnavailable") || "Fonctionnalité non disponible", {
          description: t("tryOnWidget.resultDisplay.featureUnavailableDescription") || "Cette fonctionnalité nécessite une intégration Shopify. Veuillez utiliser cette application depuis une page produit Shopify.",
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
        const message = {
          type: "NUSENSE_ADD_TO_CART",
          ...(productData && { product: productData }),
        };
        window.parent.postMessage(message, "*");

        setTimeout(() => {
          setIsAddToCartLoading(false);
        }, 10000);
      } else {
        setIsAddToCartLoading(false);
        toast.error(t("tryOnWidget.resultDisplay.featureUnavailable") || "Fonctionnalité non disponible", {
          description: t("tryOnWidget.resultDisplay.featureUnavailableDescription") || "Cette fonctionnalité nécessite une intégration Shopify. Veuillez utiliser cette application depuis une page produit Shopify.",
        });
      }
    } catch (error) {
      setIsAddToCartLoading(false);
      toast.error(t("tryOnWidget.resultDisplay.error") || "Erreur", {
        description: t("tryOnWidget.resultDisplay.addToCartError") || "Impossible d'ajouter l'article au panier. Veuillez réessayer.",
      });
    }
  };

  const handleReset = () => {
    setCurrentStep(1);
    setUploadedImage(null);
    setSelectedClothing(null);
    setSelectedClothingKey(null);
    setSelectedDemoPhotoUrl(null);
    setPhotoSelectionMethod(null);
    setGeneratedImage(null);
    setError(null);
    setProgress(0);
    setSelectedVersion(1); // Reset version selection to default
    setHasUnsavedChanges(false);
    // Reset key mappings in Redux
    resetKeyMappings();
    storage.clearSession();
    setStatusVariant("info");
    setStatusMessage(
      t("tryOnWidget.status.initial") || "Téléchargez votre photo puis choisissez un article à essayer"
    );
    // Reset mobile step to photo selection
    setMobileStep("photo");
    
    // Reset cart/outfit state
    setCartMultipleImage(null);
    setCartMultipleDemoPhotoUrl(null);
    setSelectedGarments([]);
    setCartResults(null);
    setOutfitResult(null);
    setErrorMultiple(null);
    setProgressMultiple(0);
    setBatchProgress(null);
  };
  
  const handleResetClick = () => {
    handleReset();
  };

  // Cart/Outfit handlers
  const handleCartMultiplePhotoUpload = (
    dataURL: string,
    isDemoPhoto?: boolean,
    demoPhotoUrl?: string
  ) => {
    setCartMultipleImage(dataURL);
    if (isDemoPhoto && demoPhotoUrl) {
      setCartMultipleDemoPhotoUrl(demoPhotoUrl);
    } else {
      setCartMultipleDemoPhotoUrl(null);
    }
  };

  const handleGarmentSelect = (garment: ProductImage) => {
    const maxItems = activeTab === "multiple" ? 6 : 8;
    if (selectedGarments.length >= maxItems) return;

    const newGarment: SelectedGarment = {
      ...garment,
    };

    setSelectedGarments([...selectedGarments, newGarment]);
    setHasUnsavedChanges(true);
  };

  const handleGarmentDeselect = (index: number) => {
    const newGarments = selectedGarments.filter((_, i) => i !== index);
    setSelectedGarments(newGarments);
    setHasUnsavedChanges(newGarments.length > 0 || cartMultipleImage !== null);
  };
  
  const handleClearAllGarments = () => {
    if (selectedGarments.length > 0) {
      setShowClearAllConfirm(true);
    }
  };
  
  const confirmClearAllGarments = () => {
    setShowClearAllConfirm(false);
    setSelectedGarments([]);
    setHasUnsavedChanges(cartMultipleImage !== null);
  };

  const runCartMultipleGeneration = async () => {
    const minItems = activeTab === "multiple" ? 1 : 2;
    const maxItems = activeTab === "multiple" ? 6 : 8;

    if (!cartMultipleImage || selectedGarments.length < minItems) {
      setErrorMultiple(
        t("tryOnWidget.errors.missingPhotoOrGarments", { count: minItems }) || 
        `La génération nécessite une photo et au moins ${minItems} article${minItems > 1 ? "s" : ""} sélectionné${minItems > 1 ? "s" : ""}.`
      );
      return;
    }

    setIsGeneratingMultiple(true);
    setErrorMultiple(null);
    setProgressMultiple(0);
    setCartResults(null);
    setOutfitResult(null);
    setBatchProgress(null);

    let progressInterval: NodeJS.Timeout | null = null;

    try {
      const personBlob = await cartDataURLToBlob(cartMultipleImage);
      const storeName = storeInfo?.shopDomain || storeInfo?.domain || "";

      if (!storeName) {
        throw new Error(t("tryOnWidget.errors.storeInfoUnavailable") || "Informations de magasin non disponibles");
      }

      // Get personKey from demo photo if available
      const personKey = cartMultipleDemoPhotoUrl
        ? DEMO_PHOTO_ID_MAP.get(cartMultipleDemoPhotoUrl) || undefined
        : undefined;

      // Fetch all garment images and convert to Files
      const garmentFiles: File[] = [];
      const garmentKeys: string[] = [];

      for (const garment of selectedGarments) {
        try {
          const response = await fetch(garment.url);
          const blob = await response.blob();
          // Convert Blob to File for API compatibility
          const file = new File([blob], `garment-${garment.id || Date.now()}.jpg`, { type: blob.type || 'image/jpeg' });
          garmentFiles.push(file);

          // Get garment key if available
          const garmentId = activeTab === "multiple" 
            ? multipleTabImagesWithIds.get(garment.url)
            : lookTabImagesWithIds.get(garment.url);
          if (garmentId) {
            garmentKeys.push(String(garmentId));
          }
        } catch (fetchError) {
          console.error("Failed to fetch garment image:", garment.url, fetchError);
          throw new Error(t("tryOnWidget.errors.failedToLoadGarmentImage", { url: garment.url }) || `Impossible de charger l'image de l'article: ${garment.url}`);
        }
      }

      if (activeTab === "multiple") {
        // Cart mode: Generate individual images
        setBatchProgress({
          total: selectedGarments.length,
          completed: 0,
          failed: 0,
        });
        setProgressMultiple(0);

        const result = await generateCartTryOn(
          personBlob as File | Blob,
          garmentFiles as File[],
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
        setProgressMultiple(100);
      } else {
        // Outfit mode: Generate combined outfit
        setProgressMultiple(0);
        setBatchProgress(null);

        // Extract garment types if available
        const garmentTypes = selectedGarments
          .map((g) => g.type)
          .filter((t): t is string => !!t);

        // Simulate progress for outfit mode
        progressInterval = setInterval(() => {
          setProgressMultiple((prev) => {
            if (prev >= 90) return prev;
            return prev + 10;
          });
        }, 1000);

        const result = await generateOutfitLook(
          personBlob as File | Blob,
          garmentFiles as File[],
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
        setProgressMultiple(100);
      }
    } catch (err) {
      if (progressInterval) {
        clearInterval(progressInterval);
        progressInterval = null;
      }

      // Check if error requires authentication
      const requiresLogin = err && typeof err === "object" && "requiresLogin" in err && (err as any).requiresLogin;
      
      let errorMessage =
        err instanceof Error
          ? err.message
          : t("tryOnWidget.errors.unexpectedError") || "Une erreur inattendue s'est produite";
      
      // Handle authentication required error
      if (requiresLogin) {
        errorMessage = t("tryOnWidget.errors.authenticationRequired") || "Veuillez vous connecter pour utiliser ce service.";
        // Optionally trigger login flow - user can click login button
        // Don't auto-trigger to avoid interrupting user flow
      }
      
      setErrorMultiple(errorMessage);
      setProgressMultiple(0);
      setBatchProgress(null);
    } finally {
      setIsGeneratingMultiple(false);
    }
  };

  const handleCartMultipleGenerate = () => {
    void runCartMultipleGeneration();
  };

  const handleDownload = async (imageUrl: string) => {
    if (isDownloadLoading) return;
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
      const blob = await addWatermarkToImage(imageUrl, storeWatermarkInfo);

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const extension = "png";
      const filename = `essayage-virtuel-${Date.now()}.${extension}`;
      link.download = filename;
      link.style.display = "none";

      document.body.appendChild(link);
      link.click();

      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, 100);

      setIsDownloadLoading(false);
      toast.success(t("tryOnWidget.download.success") || "Téléchargement réussi", {
        description: t("tryOnWidget.download.successDescription") || "L'image a été téléchargée avec succès.",
      });
    } catch (error) {
      setIsDownloadLoading(false);
      try {
        window.open(imageUrl, "_blank");
        toast.info(t("tryOnWidget.download.openingInNewTab") || "Ouverture dans un nouvel onglet", {
          description: t("tryOnWidget.download.openingInNewTabDescription") || "L'image s'ouvre dans un nouvel onglet. Vous pouvez l'enregistrer depuis là.",
        });
      } catch (openError) {
        toast.error(t("tryOnWidget.download.error") || "Erreur de téléchargement", {
          description: t("tryOnWidget.download.errorDescription") || "Impossible de télécharger l'image. Veuillez réessayer ou prendre une capture d'écran.",
        });
      }
    }
  };

  const handleInstagramShare = async () => {
    const imageUrl = generatedImage;
    if (isInstagramShareLoading || !imageUrl) return;

    setIsInstagramShareLoading(true);

    try {
      // Prepare store info for watermark
      const storeName = storeInfo?.shopDomain || storeInfo?.domain || reduxStoreInfo?.shop || null;
      const storeWatermarkInfo = storeName ? {
        name: storeName,
        domain: storeName,
        logoUrl: null,
      } : null;
      
      // Add watermark to the image
      const blob = await addWatermarkToImage(imageUrl, storeWatermarkInfo);

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

      // Use Web Share API to share image file directly
      if (navigator.share) {
        try {
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
          
          if (canShareFile) {
            // Share with file (image + caption)
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
            // Create a data URL for the image that can be shared via text
            const imageDataUrl = URL.createObjectURL(blob);
            
            // Try sharing with text and URL (some browsers support this)
            try {
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
          // User cancelled
          if (shareError.name === "AbortError") {
            setIsInstagramShareLoading(false);
            return;
          }
          
          // Share failed - show error with more details
          setIsInstagramShareLoading(false);
          console.error("Web Share API error:", shareError);
          toast.error(t("tryOnWidget.resultDisplay.instagramShareError") || "Error sharing to Instagram", {
            description: t("tryOnWidget.resultDisplay.instagramShareErrorDescription") || `Sharing failed: ${shareError.message || "Unknown error"}. Please ensure you're using HTTPS and a supported browser.`,
          });
          return;
        }
      }

      // Web Share API not available - show helpful error message
      setIsInstagramShareLoading(false);
      const isSecureContext = window.isSecureContext || location.protocol === "https:";
      const errorMessage = isSecureContext
        ? "Web Share API is not supported in this browser. Please use Chrome/Edge on desktop or any modern mobile browser."
        : "Web Share API requires HTTPS. Please access this page over HTTPS.";
      
      toast.error(t("tryOnWidget.resultDisplay.instagramShareError") || "Error sharing to Instagram", {
        description: errorMessage,
      });
    } catch (error) {
      setIsInstagramShareLoading(false);
      toast.error(t("tryOnWidget.resultDisplay.instagramShareError") || "Error sharing to Instagram", {
        description: t("tryOnWidget.resultDisplay.instagramShareErrorDescription") || "Unable to share to Instagram. Please try again.",
      });
    }
  };


  const handleCartMultipleDownload = async (imageUrl: string, index?: number) => {
    if (downloadingIndex !== null) return;

    if (index !== undefined) {
      setDownloadingIndex(index);
    }

    try {
      let blob: Blob | null = null;

      if (imageUrl.startsWith("data:")) {
        const response = await fetch(imageUrl);
        blob = await response.blob();
      } else if (imageUrl.startsWith("blob:")) {
        const response = await fetch(imageUrl);
        blob = await response.blob();
      } else {
        try {
          const response = await fetch(imageUrl, {
            mode: "cors",
            credentials: "omit",
          });
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }
          blob = await response.blob();
        } catch (fetchError) {
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
                  reject(new Error(t("tryOnWidget.errors.couldNotGetCanvasContext") || "Impossible d'obtenir le contexte du canvas"));
                  return;
                }
                ctx.drawImage(img, 0, 0);
                canvas.toBlob((blobResult) => {
                  if (blobResult) {
                    resolve(blobResult);
                  } else {
                    reject(new Error(t("tryOnWidget.errors.failedToConvertCanvas") || "Failed to convert canvas to blob"));
                  }
                }, "image/png");
              } catch (error) {
                reject(error);
              }
            };
            img.onerror = () => reject(new Error(t("tryOnWidget.errors.failedToLoadImage") || "Failed to load image"));
            img.src = imageUrl;
          });
        }
      }

      if (!blob) {
        throw new Error(t("tryOnWidget.errors.failedToCreateBlob") || "Failed to create blob");
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const extension = "png";
      const filename =
        index !== undefined
          ? `essayage-virtuel-${index + 1}-${Date.now()}.${extension}`
          : `essayage-virtuel-outfit-${Date.now()}.${extension}`;
      link.download = filename;
      link.style.display = "none";

      document.body.appendChild(link);
      link.click();

      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, 100);

      if (index !== undefined) {
        setDownloadingIndex(null);
      }
      toast.success(t("tryOnWidget.download.success") || "Téléchargement réussi", {
        description: t("tryOnWidget.download.successDescription") || "L'image a été téléchargée avec succès.",
      });
    } catch (error) {
      if (index !== undefined) {
        setDownloadingIndex(null);
      }

      try {
        window.open(imageUrl, "_blank");
        toast.info(t("tryOnWidget.download.openingInNewTab") || "Ouverture dans un nouvel onglet", {
          description: t("tryOnWidget.download.openingInNewTabDescription") || "L'image s'ouvre dans un nouvel onglet. Vous pouvez l'enregistrer depuis là.",
        });
      } catch (openError) {
        toast.error(t("tryOnWidget.download.error") || "Erreur de téléchargement", {
          description: t("tryOnWidget.download.errorDescription") || "Impossible de télécharger l'image. Veuillez réessayer ou prendre une capture d'écran.",
        });
      }
    }
  };

  // Restore clothingKey when images are loaded (for saved state) - Try Single tab only
  useEffect(() => {
    if (
      activeTab === "single" &&
      selectedClothing &&
      singleTabAvailableImagesWithIds.size > 0 &&
      !selectedClothingKey
    ) {
      const clothingId = singleTabAvailableImagesWithIds.get(selectedClothing);
      if (clothingId) {
        setSelectedClothingKey(clothingId);
      }
    }
  }, [activeTab, selectedClothing, singleTabAvailableImagesWithIds, selectedClothingKey]);

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
      void runImageGeneration();
    }
  }, [uploadedImage, selectedClothing, generatedImage]); // Depend on state to ensure it's set before resuming
  console.log("inflight");
  // Check if we're inside an iframe
  const isInIframe = typeof window !== "undefined" && window.parent !== window;

  // Check if store is vto-demo (only show tabs for vto-demo store)
  const shopDomain = storeInfo?.shopDomain || storeInfo?.domain || reduxStoreInfo?.shop;
  const isVtoDemoStore = shopDomain && shopDomain.includes("vto-demo-store");
  const normalizedShopDomain = shopDomain ? shopDomain.replace(".myshopify.com", "") : null;

  const isSingleTabImagesLoading =
    isInIframe && activeTab === "single" && singleTabImages.length === 0;

  const isSingleTabRecommendedLoading = (() => {
    if (activeTab !== "single") return false;
    if (!normalizedShopDomain) return false;

    // In iframe mode, recommended images come from the parent page (no API).
    if (isInIframe) return false;

    if (recommendedImages.length > 0) return false;

    return (
      isLoadingCategories ||
      !store_products ||
      storeRecommendedLoadedForShopRef.current === normalizedShopDomain
    );
  })();

  const isMultipleLookProductsLoading =
    (activeTab === "multiple" || activeTab === "look") &&
    (isLoadingCategories || (!!shopDomain && !store_products));

  // Force activeTab to "single" for non-vto-demo stores
  useEffect(() => {
    if (!isVtoDemoStore && activeTab !== "single") {
      setActiveTab("single");
    }
  }, [isVtoDemoStore, activeTab]);

  // Handle close - if in iframe, notify parent window
  const performTabSwitch = (newTab: "single" | "multiple" | "look") => {
    setActiveTab(newTab);
    setHasUnsavedChanges(false);
    
    // Reset cart/outfit state when switching away from multiple/look tabs
    if (newTab === "single") {
      setCartMultipleImage(null);
      setCartMultipleDemoPhotoUrl(null);
      setSelectedGarments([]);
      setCartResults(null);
      setOutfitResult(null);
      setErrorMultiple(null);
      setProgressMultiple(0);
      setBatchProgress(null);
      setSelectedCategory("all"); // Reset category filter
      // Try Single tab images are already independent, no need to restore
    }
    
    // Clear selected garments when switching between multiple and look tabs
    if ((activeTab === "multiple" || activeTab === "look") && (newTab === "multiple" || newTab === "look")) {
      setSelectedGarments([]);
      setCartResults(null);
      setOutfitResult(null);
      setErrorMultiple(null);
      setProgressMultiple(0);
      setBatchProgress(null);
      // Keep category filter when switching between multiple and look tabs
    }
  };
  
  const confirmTabSwitch = () => {
    if (pendingTab) {
      performTabSwitch(pendingTab);
      setPendingTab(null);
    }
    setShowTabSwitchConfirm(false);
    setHasUnsavedChanges(false);
  };
  
  const cancelTabSwitch = () => {
    setPendingTab(null);
    setShowTabSwitchConfirm(false);
  };

  const handleClose = (e?: React.MouseEvent) => {
    // Prevent event propagation to avoid double-triggering or step navigation
    if (e) {
      e.preventDefault();
      e.stopPropagation();
      // Stop immediate propagation on native event if available
      const nativeEvent = e.nativeEvent as any;
      if (nativeEvent && typeof nativeEvent.stopImmediatePropagation === 'function') {
        nativeEvent.stopImmediatePropagation();
      }
    }
    
    // Prevent multiple rapid clicks within 100ms (reduced from 200ms for faster response)
    const now = Date.now();
    const lastCloseTime = (window as any).__nusenseLastCloseTime || 0;
    if (now - lastCloseTime < 100) {
      return;
    }
    (window as any).__nusenseLastCloseTime = now;
    
    if (isInIframe) {
      // Send message to parent window to close the modal immediately
      // The parent listener is set up when overlay is created, so it should receive this
      try {
        window.parent.postMessage({ type: "NUSENSE_CLOSE_WIDGET" }, "*");
      } catch (error) {
        // Failed to send close message to parent
        console.error("[TryOnWidget] Failed to send close message:", error);
        // Reset the debounce timer so user can try again
        (window as any).__nusenseLastCloseTime = 0;
      }
      // In iframe mode, parent handles the close
      // Widget will unmount when parent closes the overlay
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
      ref={widgetContainerRef}
      className="w-full h-full flex flex-col bg-white max-w-full overflow-x-hidden"
      style={{ fontFamily: "'Montserrat', 'Inter', 'system-ui', sans-serif" }}
      role="main"
      aria-label={t("tryOnWidget.ariaLabels.mainApplication") || "Application d'essayage virtuel"}
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
          {t("tryOnWidget.errors.errorPrefix") || "Erreur"}: {error}
        </div>
      )}

    
        {/* Content Container - Fit content */}
        <div className="bg-white w-full max-w-full py-6 px-6 rounded-xl overflow-x-hidden">
          {/* Header - Aligned with content container */}
          <header className="sticky top-0 z-10 bg-white">
            <div className="flex justify-between items-center py-3 mb-3">
              <div className="flex flex-col items-start gap-1">
                <img
                  src="https://storage.googleapis.com/tagjs-prod.appspot.com/v1/S4uA0usHIb/k7k24vtq_expires_30_days.png"
                  className="w-32 h-5 sm:w-40 sm:h-6 object-contain"
                  alt={t("tryOnWidget.brand.name") || "NUSENSE"}
                  aria-label={t("tryOnWidget.brand.nameAlt") || "NUSENSE - Essayage Virtuel Alimenté par IA"}
                />
                <span className="text-slate-800 text-xs sm:text-sm whitespace-nowrap">
                  {t("tryOnWidget.brand.subtitle") || "Essayage Virtuel Alimenté par IA"}
                </span>
              </div>
              <button
                onClick={handleClose}
                className="flex items-center justify-center w-10 h-10 rounded-md hover:bg-slate-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                aria-label={t("tryOnWidget.buttons.close") || "Fermer l'application"}
                title={t("tryOnWidget.buttons.close") || "Fermer"}
                type="button"
              >
                <X className="w-5 h-5 text-slate-600" aria-hidden="true" />
              </button>
            </div>
          </header>
          {/* Tabs Navigation and Content */}
          <Tabs
        value={activeTab}
        onValueChange={(value) => {
          // Only allow tab switching for vto-demo store
          if (!isVtoDemoStore) {
            return;
          }
          
          const newTab = value as "single" | "multiple" | "look";
          
          // Check for unsaved changes before switching tabs
          if (hasUnsavedChanges && activeTab !== newTab) {
            setPendingTab(newTab);
            setShowTabSwitchConfirm(true);
            return;
          }
          
          performTabSwitch(newTab);
        }}
        className="w-full"
      >
        {/* Tabs Navigation - Only show for vto-demo store */}
        {isVtoDemoStore && (
          <section
            className="pt-3 pb-0"
            aria-label={t("tryOnWidget.tabs.ariaLabel") || "Mode d'essayage"}
          >
            <TabsList className="w-full grid grid-cols-3 bg-muted/50 h-auto p-1 gap-1">
              <TabsTrigger
                value="single"
                className="px-4 py-2.5 text-sm font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm transition-all duration-200 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                aria-label={t("tryOnWidget.tabs.single.ariaLabel") || "Try on a single item"}
              >
                {t("tryOnWidget.tabs.single.label") || "TryOn"}
              </TabsTrigger>
              <TabsTrigger
                value="multiple"
                className="px-4 py-2.5 text-sm font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm transition-all duration-200 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                aria-label={t("tryOnWidget.tabs.multiple.ariaLabel") || "Try multiple items from cart"}
              >
                {t("tryOnWidget.tabs.multiple.label") || "TryCart"}
              </TabsTrigger>
              <TabsTrigger
                value="look"
                className="px-4 py-2.5 text-sm font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm transition-all duration-200 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                aria-label={t("tryOnWidget.tabs.look.ariaLabel") || "Try a complete outfit"}
              >
                {t("tryOnWidget.tabs.look.label") || "TryOutfit"}
              </TabsTrigger>
            </TabsList>
          </section>
        )}

        {/* Try Single Tab - Current UI */}
        <TabsContent value="single" className="mt-0 flex-1 flex flex-col min-h-0">
          {/* Content */}
          {(isGenerating || generatedImage) ? (
            /* Result Layout: Container-responsive (popover-safe) */
            layoutMode === "wide" ? (
              <div className="grid items-stretch justify-center flex-1 min-h-0 gap-6 [grid-template-columns:minmax(0,520px)_1px_minmax(0,420px)]">
                {/* Left Panel: Generated Image */}
                <section
                  aria-labelledby="result-heading"
                  className="flex flex-col flex-1 w-full min-h-0 max-w-sm pt-3"
                >
                  <div className="flex flex-col items-start bg-white w-full py-4 px-4 rounded-xl border border-border min-h-0 flex-1">
                    <div className="flex items-center mb-2 px-0 gap-2 w-full flex-shrink-0">
                      <h2 className="text-slate-800 text-xl font-semibold">
                        {t("tryOnWidget.resultDisplay.generatedResult") || "Résultat Généré"}
                      </h2>
                    </div>
                    <div className="flex items-center mb-4 px-0 gap-2 w-full flex-shrink-0">
                      <p className="text-slate-800 text-sm">
                        {t("tryOnWidget.resultDisplay.virtualTryOnWithAI") || "Essayage virtuel avec IA"}
                      </p>
                      <Info className="w-4 h-4 text-slate-800 flex-shrink-0" aria-hidden="true" />
                    </div>
                    <div className="w-full flex-1 min-h-0 flex items-center justify-center">
                      {isGenerating ? (
                        <div
                          className="relative w-full max-w-full max-h-full rounded-lg overflow-hidden border border-border bg-white flex items-center justify-center"
                          role="status"
                          aria-live="polite"
                          aria-label={t("tryOnWidget.status.generating") || "Génération en cours"}
                          aria-busy="true"
                          style={{ aspectRatio: "1 / 1" }}
                        >
                          {/* ChatGPT/Gemini-like: pure shimmer placeholder (no visible copy) */}
                          <Skeleton className="absolute inset-0 rounded-lg bg-gradient-to-br from-muted/45 via-muted/70 to-muted/45" />
                          <span className="sr-only">
                            {t("tryOnWidget.status.generating") || "Génération en cours…"}
                          </span>
                        </div>
                      ) : generatedImage ? (
                        <div className="relative w-full max-w-full max-h-full rounded-lg bg-white overflow-hidden border border-border flex items-center justify-center" style={{ aspectRatio: "1 / 1" }}>
                          <img
                            src={generatedImage}
                            alt={
                              t("tryOnWidget.resultDisplay.resultAlt") ||
                              "Résultat de l'essayage virtuel généré par intelligence artificielle"
                            }
                            className="max-h-full max-w-full w-auto h-auto object-contain"
                          />
                          {/* Floating action buttons */}
                          <div className="absolute top-3 right-3 flex gap-2 z-10">
                            <Button
                              onClick={() => handleDownload(generatedImage)}
                              disabled={isGenerating || isBuyNowLoading || isAddToCartLoading || isDownloadLoading || isInstagramShareLoading || !generatedImage}
                              size="icon"
                              className="h-10 w-10 bg-white hover:bg-gray-50 border border-gray-200 shadow-md hover:shadow-lg transition-all duration-200"
                              aria-label={t("tryOnWidget.resultDisplay.downloadAriaLabel") || "Télécharger l'image"}
                              aria-busy={isDownloadLoading}
                            >
                              {isDownloadLoading ? (
                                <Loader2 className="w-5 h-5 animate-spin text-slate-700" aria-hidden="true" />
                              ) : (
                                <Download className="w-5 h-5 text-slate-700" aria-hidden="true" />
                              )}
                            </Button>
                            <Button
                              onClick={handleInstagramShare}
                              disabled={isGenerating || isBuyNowLoading || isAddToCartLoading || isDownloadLoading || isInstagramShareLoading || !generatedImage}
                              size="icon"
                              className="h-10 w-10 bg-white hover:bg-gray-50 border border-gray-200 shadow-md hover:shadow-lg transition-all duration-200"
                              aria-label={t("tryOnWidget.resultDisplay.shareToInstagramAriaLabel") || "Share to Instagram"}
                              aria-busy={isInstagramShareLoading}
                            >
                              {isInstagramShareLoading ? (
                                <Loader2 className="w-5 h-5 animate-spin text-slate-700" aria-hidden="true" />
                              ) : (
                                <Share2 className="w-5 h-5 text-slate-700" aria-hidden="true" />
                              )}
                            </Button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </section>

                <div
                  className="w-px self-stretch flex-none bg-slate-200 mt-3"
                  aria-hidden="true"
                />

                {/* Right Panel: Person Image + Clothing Image (side-by-side, matches desktop screenshots) */}
                <section
                  aria-labelledby="inputs-heading"
                  className="flex flex-col items-start w-full min-h-0 max-w-sm pt-3 flex-1"
                >
                  <h2 className="text-slate-800 text-xl font-semibold mb-1 w-full flex-shrink-0">
                    {t("tryOnWidget.sections.selectClothing.title") || "Sélectionner un article"}
                  </h2>
                  <p className="text-slate-800 text-sm w-full flex-shrink-0 mb-3">
                    {t("tryOnWidget.sections.selectClothing.description") || "Sélectionnez un article de vêtement sur cette page"}
                  </p>
                  <div className="flex-1 flex flex-col min-h-0 w-full overflow-hidden">
                    <div className="flex items-stretch gap-4 w-full flex-1 min-h-0">
                      {selectedClothing && (
                        <div className="flex-1 rounded-xl bg-white border border-border overflow-hidden p-4 flex items-center justify-center min-h-0 max-h-[532px]">
                          <img
                            src={selectedClothing}
                            alt={
                              t("tryOnWidget.clothingSelection.selectedClothingAlt") ||
                              "Vêtement actuellement sélectionné pour l'essayage virtuel"
                            }
                            className="max-h-full max-w-full w-auto h-auto object-contain"
                          />
                        </div>
                      )}
                      {uploadedImage && (
                        <div className="flex-1 rounded-xl bg-white border border-border overflow-hidden p-4 flex items-center justify-center min-h-0 max-h-[532px]">
                          <img
                            src={uploadedImage}
                            alt={t("tryOnWidget.ariaLabels.uploadedPhoto") || "Photo téléchargée pour l'essayage virtuel"}
                            className="max-h-full max-w-full w-auto h-auto object-contain"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Action buttons - Positioned at bottom, consistent with first step */}
                  <div className="flex flex-col items-end w-full flex-shrink-0 gap-3 mt-4">
                    <div className="flex items-start gap-4 w-full justify-end flex-wrap">
                      <Button
                        onClick={handleResetClick}
                        variant={"outline" as const}
                        disabled={isGenerating}
                        className="min-w-[160px] h-11"
                        aria-label={t("tryOnWidget.buttons.reset") || "Réinitialiser l'application"}
                        aria-busy={isGenerating}
                      >
                        <RotateCcw className="w-5 h-5 mr-2" aria-hidden="true" />
                        {t("tryOnWidget.buttons.reset") || "Réinitialiser"}
                      </Button>

                      <Button
                        onClick={handleRetryGeneration}
                        variant={"outline" as const}
                        disabled={!selectedClothing || !uploadedImage || isGenerating}
                        className="min-w-[160px] h-11"
                        aria-label={t("tryOnWidget.buttons.retry") || "Réessayer"}
                        aria-busy={isGenerating}
                      >
                        <Sparkles className="w-5 h-5 mr-2" aria-hidden="true" />
                        {t("tryOnWidget.buttons.retry") || "Réessayer"}
                      </Button>

                      <Button
                        onClick={handleBuyNow}
                        disabled={isGenerating || isBuyNowLoading || isAddToCartLoading || isDownloadLoading || isInstagramShareLoading}
                        variant={"outline" as const}
                        className="min-w-[220px] h-11"
                        aria-label={t("tryOnWidget.buttons.buyNow") || "Acheter Maintenant"}
                        aria-busy={isBuyNowLoading}
                      >
                        {isBuyNowLoading ? (
                          <Loader2 className="w-5 h-5 mr-2 animate-spin" aria-hidden="true" />
                        ) : (
                          <CreditCard className="w-5 h-5 mr-2" aria-hidden="true" />
                        )}
                        {t("tryOnWidget.buttons.buyNow") || "Acheter maintenant"}
                      </Button>

                      <Button
                        onClick={handleAddToCart}
                        disabled={isGenerating || isBuyNowLoading || isAddToCartLoading || isDownloadLoading || isInstagramShareLoading}
                        className="min-w-[220px] h-11 bg-primary hover:bg-primary/90"
                        aria-label={t("tryOnWidget.buttons.addToCart") || "Ajouter au Panier"}
                        aria-busy={isAddToCartLoading}
                      >
                        {isAddToCartLoading ? (
                          <Loader2 className="w-5 h-5 mr-2 animate-spin" aria-hidden="true" />
                        ) : (
                          <ShoppingCart className="w-5 h-5 mr-2" aria-hidden="true" />
                        )}
                        {t("tryOnWidget.buttons.addToCart") || "Ajouter au panier"}
                      </Button>

                    </div>
                  </div>
                </section>
              </div>
            ) : (
              <div className="flex flex-col w-full mb-6">
                {/* Header */}
                <div className="flex justify-between items-start self-stretch mb-4">
                  <div className="flex flex-col shrink-0 items-start gap-1">
                    <h2 className="text-slate-800 text-xl sm:text-2xl font-semibold">
                      {t("tryOnWidget.resultDisplay.generatedResult") || "Résultat Généré"}
                    </h2>
                    <p className="text-slate-800 text-sm">
                      {t("tryOnWidget.resultDisplay.virtualTryOnWithAI") || "Essayage virtuel avec IA"}
                    </p>
                  </div>
                  <Info className="w-5 h-5 sm:w-6 sm:h-6 text-slate-800 flex-shrink-0" aria-hidden="true" />
                </div>

                {/* Generated Image */}
                {isGenerating ? (
                  <div
                    className="relative self-stretch min-h-[400px] max-h-[600px] mb-8 rounded-xl overflow-hidden border border-border bg-white"
                    role="status"
                    aria-live="polite"
                    aria-label={t("tryOnWidget.status.generating") || "Génération en cours"}
                    aria-busy="true"
                  >
                    {/* ChatGPT/Gemini-like: pure shimmer placeholder (no visible copy) */}
                    <Skeleton className="absolute inset-0 rounded-xl bg-gradient-to-br from-muted/45 via-muted/70 to-muted/45" />
                    <span className="sr-only">
                      {t("tryOnWidget.status.generating") || "Génération en cours…"}
                    </span>
                  </div>
                ) : generatedImage ? (
                  <div className="relative self-stretch min-h-[400px] max-h-[600px] mb-8 rounded-xl bg-white overflow-hidden border border-border flex items-center justify-center">
                    <img
                      src={generatedImage}
                      alt={
                        t("tryOnWidget.resultDisplay.resultAlt") ||
                        "Résultat de l'essayage virtuel généré par intelligence artificielle"
                      }
                      className="w-full h-auto max-h-[600px] object-contain"
                    />
                    {/* Floating action buttons */}
                    <div className="absolute top-3 right-3 flex gap-2 z-10">
                      <Button
                        onClick={() => handleDownload(generatedImage)}
                        disabled={isGenerating || isBuyNowLoading || isAddToCartLoading || isDownloadLoading || isInstagramShareLoading || !generatedImage}
                        size="icon"
                        className="h-10 w-10 bg-white hover:bg-gray-50 border border-gray-200 shadow-md hover:shadow-lg transition-all duration-200"
                        aria-label={t("tryOnWidget.resultDisplay.downloadAriaLabel") || "Télécharger l'image"}
                        aria-busy={isDownloadLoading}
                      >
                        {isDownloadLoading ? (
                          <Loader2 className="w-5 h-5 animate-spin text-slate-700" aria-hidden="true" />
                        ) : (
                          <Download className="w-5 h-5 text-slate-700" aria-hidden="true" />
                        )}
                      </Button>
                      <Button
                        onClick={handleInstagramShare}
                        disabled={isGenerating || isBuyNowLoading || isAddToCartLoading || isDownloadLoading || isInstagramShareLoading || !generatedImage}
                        size="icon"
                        className="h-10 w-10 bg-white hover:bg-gray-50 border border-gray-200 shadow-md hover:shadow-lg transition-all duration-200"
                        aria-label={t("tryOnWidget.resultDisplay.shareToInstagramAriaLabel") || "Share to Instagram"}
                        aria-busy={isInstagramShareLoading}
                      >
                        {isInstagramShareLoading ? (
                          <Loader2 className="w-5 h-5 animate-spin text-slate-700" aria-hidden="true" />
                        ) : (
                          <Share2 className="w-5 h-5 text-slate-700" aria-hidden="true" />
                        )}
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            )
          ) : (
            /* Default Layout: Upload on left, Clothing selection on right */
            <div
              className={cn(
                "flex flex-1 min-h-0 max-w-full",
                layoutMode === "wide" ? "flex-row items-stretch gap-6" : "flex-col items-center gap-4"
              )}
            >
              {/* Left Panel: Upload / Preview */}
              {/* Mobile: Show only when mobileStep === "photo" */}
              {/* Desktop: Always show */}
              {(layoutMode === "wide" || mobileStep === "photo") && (
              <section
                aria-labelledby="upload-heading" 
                className={cn(
                  "flex flex-col flex-1 w-full min-h-0 max-w-full",
                  layoutMode === "wide" ? "max-w-sm pt-3" : ""
                )}
              >
                {!uploadedImage && (
                  <PhotoUpload
                    onPhotoUpload={handlePhotoUpload}
                    generatedPersonKeys={generatedPersonKeys}
                    matchingPersonKeys={personKeys}
                    initialView={photoSelectionMethod}
                    showDemoPhotoStatusIndicator={false}
                    isMobile={layoutMode !== "wide"}
                  />
                )}

                {uploadedImage && (
                  <div className="flex flex-col items-start bg-white w-full py-4 px-4 rounded-xl border border-border min-h-0 flex-1">
                    <div className="flex items-center mb-2 px-0 gap-2 w-full flex-shrink-0">
                      <button
                        onClick={handleClearUploadedImage}
                        className="flex items-center justify-center w-10 h-10 rounded-md hover:bg-slate-100 transition-colors flex-shrink-0"
                        aria-label={t("common.back") || t("tryOnWidget.buttons.back") || "Retour"}
                      >
                        <ArrowLeft className="w-5 h-5 text-slate-800" aria-hidden="true" />
                      </button>
                      <h2 className="text-slate-800 text-xl font-semibold">
                        {t("tryOnWidget.photoUpload.takePhoto") || "Prenez une photo de vous"}
                      </h2>
                    </div>
                    <div className="flex items-center mb-4 px-0 gap-2 w-full flex-shrink-0">
                      <p className="text-slate-800 text-sm">
                        {t("tryOnWidget.photoUpload.chooseClearPhoto") || "Choisissez une photo claire de vous"}
                      </p>
                      <Info className="w-4 h-4 text-slate-800 flex-shrink-0" aria-hidden="true" />
                    </div>
                    <div className="w-full flex-1 max-h-[24rem] min-h-[24rem] flex items-center justify-center">
                      <img
                        src={uploadedImage}
                        alt={t("tryOnWidget.ariaLabels.uploadedPhoto") || "Photo téléchargée pour l'essayage virtuel"}
                        className="max-h-[24rem] min-h-[24rem] max-w-full w-auto h-auto rounded-lg object-contain bg-white"
                      />
                    </div>
                  </div>
                )}
              </section>
              )}

              {/* Mobile Continue Button - Show after photo selection */}
              {layoutMode !== "wide" && uploadedImage && mobileStep === "photo" && (
                <div className="flex flex-col self-stretch mb-6 mt-0 gap-4">
                  <Button
                    onClick={handleResetClick}
                    variant={"outline" as const}
                    className="w-full h-11"
                    aria-label={t("tryOnWidget.buttons.reset") || "Réinitialiser l'application"}
                  >
                    <RotateCcw className="w-5 h-5 mr-2" aria-hidden="true" />
                    {t("tryOnWidget.buttons.reset") || "Réinitialiser"}
                  </Button>
                  <Button
                    onClick={() => {
                      // Always request images when switching to clothing step to ensure we have the latest images
                      const isInIframe = window.parent !== window;
                      if (isInIframe) {
                        try {
                          window.parent.postMessage({ type: "NUSENSE_REQUEST_IMAGES" }, "*");
                        } catch (error) {
                          console.error("[TryOnWidget] Failed to request images from parent window:", error);
                        }
                      }
                      setMobileStep("clothing");
                    }}
                    className="w-full h-11 bg-primary hover:bg-primary/90"
                    aria-label={t("tryOnWidget.buttons.continue") || "Continuer"}
                  >
                    {t("tryOnWidget.buttons.continue") || "Continuer"}
                  </Button>
                </div>
              )}

              {/* Vertical Divider - Wide layout only */}
              {layoutMode === "wide" && (
                <div
                  className="w-px self-stretch flex-none bg-slate-200 mt-3"
                  aria-hidden="true"
                />
              )}

              {/* Right Panel: Clothing Selection */}
              {/* Mobile: Show only when mobileStep === "clothing" */}
              {/* Desktop: Always show */}
              {(layoutMode === "wide" || mobileStep === "clothing") && (
              <section
                aria-labelledby="clothing-heading"
                className={cn(
                  "flex flex-col items-start w-full min-h-0 max-w-full",
                  layoutMode === "wide" ? "max-w-sm pt-3 flex-1" : "flex-1"
                )}
              >
                {/* Header with back button and title side-by-side */}
                {layoutMode !== "wide" && mobileStep === "clothing" ? (
                  <div className="flex items-start gap-3 mb-3 w-full flex-shrink-0">
                    <button
                      onClick={() => setMobileStep("photo")}
                      className="flex items-center justify-center w-10 h-10 rounded-md hover:bg-slate-100 transition-colors flex-shrink-0 mt-0.5"
                      aria-label={t("common.back") || t("tryOnWidget.buttons.back") || "Retour"}
                    >
                      <ArrowLeft className="w-5 h-5 text-slate-800" aria-hidden="true" />
                    </button>
                    <div className="flex-1 min-w-0">
                      <h2 className="text-slate-800 text-xl font-semibold mb-1 line-clamp-2">
                        {t("tryOnWidget.sections.selectClothing.title") || "Sélectionner un article"}
                      </h2>
                      <p className="text-slate-800 text-sm line-clamp-2">
                        {t("tryOnWidget.sections.selectClothing.description") || "Sélectionnez un article de vêtement sur cette page"}
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    <h2 className="text-slate-800 text-xl font-semibold mb-1 w-full flex-shrink-0">
                      {t("tryOnWidget.sections.selectClothing.title") || "Sélectionner un article"}
                    </h2>
                    <p className="text-slate-800 text-sm w-full flex-shrink-0 mb-3">
                      {t("tryOnWidget.sections.selectClothing.description") || "Sélectionnez un article de vêtement sur cette page"}
                    </p>
                  </>
                )}
                
                {/* Clothing Selection Container - Minimum height for 2x2 grid, scrollable */}
                <div className={cn(
                  "flex flex-col min-h-0 w-full",
                  layoutMode !== "wide" ? "flex-1 min-h-[400px]" : "flex-1"
                )}>
                  <ClothingSelection
                    images={singleTabImages}
                    recommendedImages={[]}
                    selectedImage={selectedClothing}
                    onSelect={handleClothingSelect}
                    onRefreshImages={handleRefreshImages}
                    availableImagesWithIds={singleTabAvailableImagesWithIds}
                    generatedClothingKeys={generatedClothingKeys}
                    generatedKeyCombinations={generatedKeyCombinations}
                    selectedDemoPhotoUrl={selectedDemoPhotoUrl}
                    demoPhotoIdMap={DEMO_PHOTO_ID_MAP}
                    matchingClothingKeys={clothingKeys}
                    showFinalLayout={!!uploadedImage && !!selectedClothing}
                    isLoadingImages={isSingleTabImagesLoading}
                    isLoadingRecommended={false}
                  />
                </div>
                
                {/* Action buttons - Positioned at bottom with minimal gap */}
                {!isGenerating && !generatedImage && (
                  <div
                    className={cn(
                      "flex flex-col items-end w-full flex-shrink-0 gap-3",
                      layoutMode !== "wide" ? "mt-auto pb-0" : "mt-4",
                      layoutMode !== "wide" && mobileStep === "photo" ? "hidden" : ""
                    )}
                  >
                    <div className="flex items-start gap-4 w-full justify-end flex-wrap">
                      <Button
                        onClick={handleResetClick}
                        variant={"outline" as const}
                        className="min-w-[160px] h-11"
                        aria-label={t("tryOnWidget.buttons.reset") || "Réinitialiser l'application"}
                      >
                        <RotateCcw className="w-5 h-5 mr-2" aria-hidden="true" />
                        {t("tryOnWidget.buttons.reset") || "Réinitialiser"}
                      </Button>
                      <Button
                        onClick={handleGenerate}
                        disabled={!selectedClothing || !uploadedImage || isGenerating}
                        className="min-w-[160px] h-11"
                        aria-label={t("tryOnWidget.buttons.generate") || "Générer l'essayage virtuel"}
                        aria-describedby={
                          !selectedClothing || !uploadedImage
                            ? "generate-help"
                            : undefined
                        }
                        aria-busy={isGenerating}
                      >
                        <Sparkles className="w-5 h-5 mr-2" aria-hidden="true" />
                        {t("tryOnWidget.buttons.generate") || "Générer"}
                      </Button>
                      {(!selectedClothing || !uploadedImage) && (
                        <p id="generate-help" className="sr-only">
                          {t("tryOnWidget.buttons.generateHelp") || "Veuillez télécharger une photo et sélectionner un vêtement pour générer l'essayage virtuel"}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </section>
              )}
            </div>
          )}

          {(isGenerating || generatedImage) && layoutMode !== "wide" && (
            /* Result buttons: Mobile - Stacked vertically */
            <div className="flex flex-col self-stretch mb-8 gap-4">
              <Button
                onClick={handleRetryGeneration}
                variant={"outline" as const}
                disabled={!selectedClothing || !uploadedImage || isGenerating}
                className="w-full h-11"
                aria-label={t("tryOnWidget.buttons.retry") || "Réessayer"}
                aria-busy={isGenerating}
              >
                <Sparkles className="w-5 h-5 mr-2" aria-hidden="true" />
                {t("tryOnWidget.buttons.retry") || "Réessayer"}
              </Button>

              <Button
                onClick={handleResetClick}
                variant={"outline" as const}
                disabled={isGenerating}
                className="w-full h-11"
                aria-label={t("tryOnWidget.buttons.reset") || "Réinitialiser l'application"}
                aria-busy={isGenerating}
              >
                <RotateCcw className="w-5 h-5 mr-2" aria-hidden="true" />
                {t("tryOnWidget.buttons.reset") || "Réinitialiser"}
              </Button>

              <Button
                onClick={handleBuyNow}
                disabled={isGenerating || isBuyNowLoading || isAddToCartLoading || isDownloadLoading || isInstagramShareLoading}
                variant={"outline" as const}
                className="w-full h-11"
                aria-label={t("tryOnWidget.buttons.buyNow") || "Acheter Maintenant"}
                aria-busy={isBuyNowLoading}
              >
                {isBuyNowLoading ? (
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" aria-hidden="true" />
                ) : (
                  <CreditCard className="w-5 h-5 mr-2" aria-hidden="true" />
                )}
                {isBuyNowLoading
                  ? (t("tryOnWidget.resultDisplay.processing") || "Traitement...")
                  : (t("tryOnWidget.buttons.buyNow") || "Acheter maintenant")}
              </Button>
              <Button
                onClick={handleAddToCart}
                disabled={isGenerating || isBuyNowLoading || isAddToCartLoading || isDownloadLoading || isInstagramShareLoading}
                className="w-full h-11 bg-primary hover:bg-primary/90"
                aria-label={t("tryOnWidget.buttons.addToCart") || "Ajouter au Panier"}
                aria-busy={isAddToCartLoading}
              >
                {isAddToCartLoading ? (
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" aria-hidden="true" />
                ) : (
                  <ShoppingCart className="w-5 h-5 mr-2" aria-hidden="true" />
                )}
                {isAddToCartLoading
                  ? (t("tryOnWidget.resultDisplay.adding") || "Ajout...")
                  : (t("tryOnWidget.buttons.addToCart") || "Ajouter au panier")}
              </Button>

            </div>
          )}

          {error && (
            <div role="alert" aria-live="assertive" className="mb-6">
              <Card className="p-6 bg-destructive/10 border-destructive">
                <p className="text-destructive font-medium mb-4" id="error-message">
                  {error}
                </p>
                <Button
                  onClick={handleRetryGeneration}
                  variant={"outline" as const}
                  className="w-full sm:w-auto"
                  aria-label={t("tryOnWidget.buttons.retry") || "Réessayer après une erreur"}
                  aria-describedby="error-message"
                >
                  <RotateCcw className="h-4 w-4 mr-2" aria-hidden="true" />
                  {t("tryOnWidget.buttons.retry") || "Réessayer"}
                </Button>
              </Card>
            </div>
          )}
          
          {/* Confirmation Dialogs */}
          <AlertDialog open={showClearAllConfirm} onOpenChange={setShowClearAllConfirm}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {t("tryOnWidget.confirm.clearAll.title") || "Effacer toutes les sélections ?"}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {t("tryOnWidget.confirm.clearAll.description") || "Tous les articles sélectionnés seront retirés. Cette action ne peut pas être annulée."}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>
                  {t("tryOnWidget.confirm.cancel") || "Annuler"}
                </AlertDialogCancel>
                <AlertDialogAction onClick={confirmClearAllGarments}>
                  {t("tryOnWidget.confirm.clearAll.action") || "Effacer tout"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          
          <AlertDialog open={showTabSwitchConfirm} onOpenChange={setShowTabSwitchConfirm}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {t("tryOnWidget.confirm.tabSwitch.title") || "Changer d'onglet ?"}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {t("tryOnWidget.confirm.tabSwitch.description") || "Vous avez des modifications non enregistrées. Changer d'onglet réinitialisera vos sélections. Voulez-vous continuer ?"}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={cancelTabSwitch}>
                  {t("tryOnWidget.confirm.cancel") || "Annuler"}
                </AlertDialogCancel>
                <AlertDialogAction onClick={confirmTabSwitch}>
                  {t("tryOnWidget.confirm.tabSwitch.action") || "Continuer"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </TabsContent>

        {/* Try Multiple Tab - Cart Mode */}
        <TabsContent value="multiple" className="mt-0 space-y-6">
            {/* Selection sections (container-responsive) */}
            <div
              className={cn(
                "grid gap-6",
                layoutMode === "wide" ? "grid-cols-2 gap-8" : "grid-cols-1"
              )}
            >
              {/* Left Panel: Upload */}
              <section aria-labelledby="upload-multiple-heading" className="flex flex-col">
                <Card className="p-4 sm:p-6 border-border bg-card flex flex-col min-h-[500px] max-h-[800px]">
                  <div className="flex items-center gap-3 mb-4 flex-shrink-0">
                    <div
                      className="w-8 h-8 rounded-full bg-primary text-primary-foreground grid place-items-center font-semibold text-sm flex-shrink-0 shadow-sm"
                      aria-hidden="true"
                    >
                      1
                    </div>
                    <div className="min-w-0 flex-1">
                      <h2
                        id="upload-multiple-heading"
                        className="text-lg font-semibold"
                      >
                        {t("tryOnWidget.sections.uploadPhoto.title") || "Téléchargez Votre Photo"}
                      </h2>
                      <p className="text-xs text-muted-foreground">
                        {t("tryOnWidget.sections.uploadPhoto.description") || "Choisissez une photo claire de vous-même"}
                      </p>
                    </div>
                  </div>

                  <div className="flex-1 flex flex-col min-h-0">
                    {!cartMultipleImage && (
                      <div className="flex-1 flex items-center justify-center">
                        <PhotoUpload
                          onPhotoUpload={handleCartMultiplePhotoUpload}
                          generatedPersonKeys={new Set()}
                          matchingPersonKeys={[]}
                          showDemoPhotoStatusIndicator={false}
                          isMobile={layoutMode !== "wide"}
                        />
                      </div>
                    )}

                    {cartMultipleImage && (
                      <div className="relative rounded-lg bg-card p-3 sm:p-4 border border-border shadow-sm flex-1 flex flex-col min-h-0 gap-3">
                        <div className="flex items-center justify-between gap-2 flex-shrink-0">
                          <h3 className="font-semibold text-sm sm:text-base">
                            {t("tryOnWidget.sections.yourPhoto.title") || "Votre Photo"}
                          </h3>
                          <Button
                            variant={"outline" as const}
                            size="sm"
                            onClick={() => {
                              setCartMultipleImage(null);
                              setCartMultipleDemoPhotoUrl(null);
                            }}
                            className="group h-8 sm:h-9 px-2.5 sm:px-3 text-xs sm:text-sm flex-shrink-0 gap-1.5 border-border text-foreground hover:bg-muted hover:border-muted-foreground/20 hover:text-muted-foreground transition-all duration-200 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                            aria-label={t("tryOnWidget.buttons.clearPhoto") || "Effacer la photo téléchargée"}
                          >
                            <XCircle
                              className="h-3.5 w-3.5 sm:h-4 sm:w-4 transition-transform group-hover:scale-110 duration-200"
                              aria-hidden="true"
                            />
                            <span>{t("tryOnWidget.buttons.clear") || "Effacer"}</span>
                          </Button>
                        </div>
                        <div className="relative flex-1 rounded-lg overflow-hidden border border-border bg-card flex items-center justify-center shadow-sm min-h-0 p-2">
                          <img
                            src={cartMultipleImage}
                            alt={t("tryOnWidget.ariaLabels.uploadedPhoto") || "Photo téléchargée pour l'essayage virtuel"}
                            className="h-full w-full object-contain max-h-full"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
              </section>

              {/* Right Panel: Garment Selection */}
              <section aria-labelledby="garments-multiple-heading" className="flex flex-col">
                <Card className="p-4 sm:p-6 border-border bg-card flex flex-col min-h-[500px] max-h-[800px]">
                  <div className="flex items-center gap-3 mb-4">
                    <div
                      className="w-8 h-8 rounded-full bg-primary text-primary-foreground grid place-items-center font-semibold text-sm flex-shrink-0 shadow-sm"
                      aria-hidden="true"
                    >
                      2
                    </div>
                    <div className="min-w-0 flex-1">
                      <h2
                        id="garments-multiple-heading"
                        className="text-lg font-semibold"
                      >
                        {t("tryOnWidget.sections.selectGarments.title") || "Sélectionner les Articles"}
                      </h2>
                      <p className="text-xs text-muted-foreground">
                        {t("tryOnWidget.sections.selectGarments.multiple.description") || "Sélectionnez 1-6 articles"}
                      </p>
                    </div>
                  </div>

                  {/* Category Filter Dropdown - Enhanced UI/UX */}
                  {isLoadingCategories && (
                    <div className="mb-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Filter className="h-4 w-4 text-muted-foreground" />
                        <label className="text-sm font-semibold">
                          {t("tryOnWidget.filters.category") || "Filtrer par catégorie"}
                        </label>
                      </div>
                      <div className="flex items-center gap-2 px-4 py-3 rounded-lg border border-border bg-muted/30">
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        <span className="text-sm text-muted-foreground">
                          {t("tryOnWidget.filters.loadingCategories") || "Chargement des catégories..."}
                        </span>
                      </div>
                    </div>
                  )}
                  {!isLoadingCategories && store_products && store_products.categories.length > 0 && (
                    <div className="mb-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Filter className="h-4 w-4 text-primary" />
                        <label
                          htmlFor="category-filter-multiple"
                          className="text-sm font-semibold"
                        >
                          {t("tryOnWidget.filters.category") || "Filtrer par catégorie"}
                        </label>
                        {selectedCategory !== "all" && (
                          <span className="ml-auto text-xs text-muted-foreground">
                            {(() => {
                              if (selectedCategory === "uncategorized") {
                                return `${store_products.uncategorized.productCount} ${t("tryOnWidget.filters.products") || "produits"}`;
                              }
                              const selectedCat = store_products.categories.find(
                                (cat) => cat.categoryId === selectedCategory || cat.categoryName === selectedCategory
                              );
                              return selectedCat ? `${selectedCat.productCount} ${t("tryOnWidget.filters.products") || "produits"}` : "";
                            })()}
                          </span>
                        )}
                      </div>
                      <Select
                        value={selectedCategory}
                        onValueChange={setSelectedCategory}
                      >
                        <SelectTrigger
                          id="category-filter-multiple"
                          className="w-full h-11 bg-background hover:bg-muted/50 transition-colors border-2 data-[state=open]:border-primary shadow-sm"
                          aria-label={t("tryOnWidget.filters.categoryAriaLabel") || "Sélectionner une catégorie"}
                        >
                          <div className="flex items-center gap-2 flex-1">
                            <Package className="h-4 w-4 text-muted-foreground" />
                            <SelectValue placeholder={t("tryOnWidget.filters.selectCategory") || "Toutes les catégories"} />
                          </div>
                        </SelectTrigger>
                        <SelectContent className="max-h-[300px]">
                          <SelectItem 
                            value="all"
                            className="font-medium cursor-pointer focus:bg-primary/10"
                          >
                            <div className="flex items-center justify-between w-full">
                              <div className="flex items-center gap-2">
                                <Grid3x3 className="h-4 w-4" />
                                <span>{t("tryOnWidget.filters.allCategories") || "Toutes les catégories"}</span>
                              </div>
                              <span className="ml-4 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
                                {store_products.statistics?.totalProducts || 0}
                              </span>
                            </div>
                          </SelectItem>
                          {store_products.categories.map((category) => (
                            <SelectItem
                              key={category.categoryId || category.categoryName}
                              value={category.categoryId || category.categoryName}
                              className="cursor-pointer focus:bg-primary/10"
                            >
                              <div className="flex items-center justify-between w-full">
                                <span className="truncate flex-1">{category.categoryName}</span>
                                <span className="ml-4 px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-xs font-medium flex-shrink-0">
                                  {category.productCount}
                                </span>
                              </div>
                            </SelectItem>
                          ))}
                          {store_products.uncategorized.productCount > 0 && (
                            <SelectItem 
                              value="uncategorized"
                              className="cursor-pointer focus:bg-primary/10 border-t border-border mt-1 pt-1"
                            >
                              <div className="flex items-center justify-between w-full">
                                <span className="text-muted-foreground">{store_products.uncategorized.categoryName}</span>
                                <span className="ml-4 px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-xs font-medium flex-shrink-0">
                                  {store_products.uncategorized.productCount}
                                </span>
                              </div>
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {!isLoadingCategories && store_products && store_products.categories.length === 0 && (
                    <div className="mb-4 p-4 rounded-lg border border-border bg-muted/30">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Package className="h-4 w-4" />
                        <span>{t("tryOnWidget.filters.noCategories") || "Aucune catégorie disponible"}</span>
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col flex-1 min-h-0 space-y-4">
                    {/* Products Count & Selection Counter - Fixed Header */}
                    <div className="flex-shrink-0 space-y-2">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold">
                              {t("tryOnWidget.sections.selectedGarments.title") || "Articles Sélectionnés"}
                            </span>
                            <span
                              className={`text-xs px-2 py-1 rounded-full ${
                                selectedGarments.length >= 1 && selectedGarments.length < 6
                                  ? "bg-primary/10 text-primary"
                                  : selectedGarments.length >= 6
                                    ? "bg-warning/10 text-warning"
                                    : "bg-muted text-muted-foreground"
                              }`}
                            >
                              {selectedGarments.length} / 6
                            </span>
                          </div>
                          {multipleTabImages.length > 0 && (
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Grid3x3 className="h-3.5 w-3.5" />
                              <span>
                                {multipleTabImages.length} {t("tryOnWidget.filters.availableProducts") || "produits disponibles"}
                              </span>
                            </div>
                          )}
                        </div>
                        {selectedGarments.length > 0 && (
                          <Button
                            variant={"outline" as const}
                            size="sm"
                            onClick={handleClearAllGarments}
                            className="h-9 px-3 text-sm gap-1.5"
                            aria-label={t("tryOnWidget.buttons.clearAll") || "Effacer toutes les sélections"}
                          >
                            <XCircle className="h-4 w-4" aria-hidden="true" />
                            <span>{t("tryOnWidget.buttons.clearAll") || "Effacer tout"}</span>
                          </Button>
                        )}
                      </div>

                      {/* Validation Message */}
                      {selectedGarments.length < 1 && (
                        <div
                          role="alert"
                          className="text-sm text-warning bg-warning/10 p-3 rounded-lg"
                        >
                          {t("tryOnWidget.validation.minGarmentsMultiple") || "Sélectionnez au moins 1 article pour continuer"}
                        </div>
                      )}

                      {selectedGarments.length >= 6 && (
                        <div
                          role="alert"
                          className="text-sm text-warning bg-warning/10 p-3 rounded-lg"
                        >
                          {t("tryOnWidget.validation.maxGarmentsMultiple") || "Maximum 6 articles sélectionnés"}
                        </div>
                      )}
                    </div>

                    {/* Garment Grid - Scrollable */}
                    <div className="flex-1 min-h-0 overflow-y-auto pr-1 -mr-1 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:bg-primary/30 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent hover:[&::-webkit-scrollbar-thumb]:bg-primary/50">
                      {multipleTabImages.length === 0 ? (
                        isMultipleLookProductsLoading ? (
                          <div
                            role="status"
                            aria-live="polite"
                            aria-busy="true"
                            className={cn(
                              "grid animate-in fade-in-0 duration-300 pb-2",
                              layoutMode === "wide" ? "grid-cols-3 gap-4" : "grid-cols-2 gap-3"
                            )}
                          >
                            {Array.from({ length: layoutMode === "wide" ? 9 : 6 }).map((_, index) => (
                              <Card
                                // eslint-disable-next-line react/no-array-index-key
                                key={`multiple-skeleton-${index}`}
                                className="overflow-hidden border-border"
                                aria-hidden="true"
                              >
                                <Skeleton className="h-48 sm:h-56 md:h-64 w-full" />
                              </Card>
                            ))}
                          </div>
                        ) : (
                        <div role="alert" aria-live="polite" className="h-full flex items-center justify-center">
                          <Card className="p-8 text-center bg-muted/30 border-border">
                            <div className="flex flex-col items-center gap-4">
                              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                                <Package className="h-8 w-8 text-muted-foreground" />
                              </div>
                              <div>
                                <p className="font-semibold text-foreground text-base mb-2">
                                  {selectedCategory === "all"
                                    ? t("tryOnWidget.errors.noProducts") || "Aucun produit disponible"
                                    : t("tryOnWidget.errors.noProductsInCategory") || "Aucun produit dans cette catégorie"}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  {selectedCategory === "all"
                                    ? t("tryOnWidget.errors.noProductsDescription") || "Les produits seront disponibles une fois chargés"
                                    : t("tryOnWidget.errors.noProductsInCategoryDescription") || "Essayez de sélectionner une autre catégorie"}
                                </p>
                              </div>
                            </div>
                          </Card>
                        </div>
                        )
                      ) : (
                        <div
                          className={cn(
                            "grid animate-in fade-in-0 duration-300 pb-2",
                            layoutMode === "wide" ? "grid-cols-3 gap-4" : "grid-cols-2 gap-3"
                          )}
                        >
                          {multipleTabImages.map((imageUrl, index) => {
                            const garment: ProductImage = {
                              url: imageUrl,
                              id: multipleTabImagesWithIds.get(imageUrl),
                            };
                            const selected = selectedGarments.some((g) => g.url === imageUrl);
                            const canSelectMore = selectedGarments.length < 6;
                            const selectedIndex = selectedGarments.findIndex((g) => g.url === imageUrl);

                            return (
                              <Card
                                key={`${imageUrl}-${index}`}
                                className={`overflow-hidden cursor-pointer transition-all transform hover:scale-105 relative focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 isolate ${
                                  selected
                                    ? "ring-4 ring-primary shadow-lg scale-105 z-10"
                                    : canSelectMore
                                      ? "hover:ring-2 hover:ring-primary/50"
                                      : "opacity-60 cursor-not-allowed"
                                }`}
                                onClick={() => {
                                  if (selected) {
                                    handleGarmentDeselect(selectedIndex);
                                  } else if (canSelectMore) {
                                    handleGarmentSelect(garment);
                                  }
                                }}
                                role="button"
                                tabIndex={canSelectMore ? 0 : -1}
                                aria-label={selected ? t("tryOnWidget.ariaLabels.deselectGarment", { index: index + 1 }) || `Désélectionner l'article ${index + 1}` : t("tryOnWidget.ariaLabels.selectGarment", { index: index + 1 }) || `Sélectionner l'article ${index + 1}`}
                                aria-pressed={selected}
                                onKeyDown={(e) => {
                                  if (canSelectMore && (e.key === "Enter" || e.key === " ")) {
                                    e.preventDefault();
                                    if (selected) {
                                      handleGarmentDeselect(selectedIndex);
                                    } else {
                                      handleGarmentSelect(garment);
                                    }
                                  }
                                }}
                              >
                                <div className="relative bg-muted/30 flex items-center justify-center overflow-hidden h-48 sm:h-56 md:h-64">
                                  <img
                                    src={imageUrl}
                                    alt={selected ? t("tryOnWidget.ariaLabels.selectedGarment", { index: index + 1 }) || `Article ${index + 1} - Sélectionné` : t("tryOnWidget.ariaLabels.garment", { index: index + 1 }) || `Article ${index + 1}`}
                                    className="h-full w-auto object-contain"
                                    loading="lazy"
                                  />
                                  {selected && (
                                    <>
                                      <div className="absolute inset-0 bg-primary/10 flex items-center justify-center">
                                        <div className="absolute top-2 right-2 bg-primary text-primary-foreground rounded-full p-1.5 shadow-lg">
                                          <Check className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" />
                                        </div>
                                      </div>
                                      <div className="absolute top-2 left-2 bg-primary text-primary-foreground rounded-full w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center text-xs sm:text-sm font-bold shadow-lg">
                                        {selectedIndex + 1}
                                      </div>
                                    </>
                                  )}
                                </div>
                              </Card>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Selected Garments Summary - Fixed at bottom when garments are selected */}
                    {selectedGarments.length > 0 && (
                      <div className="flex-shrink-0 mt-3 sm:mt-4">
                        <Card className="p-3 sm:p-4 border-2 border-primary/20 bg-primary/5 shadow-sm">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                              <h3 className="text-sm sm:text-base font-semibold">
                                {t("tryOnWidget.sections.selectedGarments.title") || "Articles Sélectionnés"}
                              </h3>
                              <span className="px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-xs font-bold">
                                {selectedGarments.length} / {activeTab === "multiple" ? 6 : 8}
                              </span>
                            </div>
                            <Button
                              variant={"outline" as const}
                              size="sm"
                              onClick={() => {
                                for (let i = selectedGarments.length - 1; i >= 0; i--) {
                                  handleGarmentDeselect(i);
                                }
                              }}
                              className="h-8 sm:h-9 px-2.5 sm:px-3 text-xs sm:text-sm gap-1.5"
                              aria-label={t("tryOnWidget.buttons.clearAll") || "Effacer toutes les sélections"}
                            >
                              <XCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden="true" />
                              <span>{t("tryOnWidget.buttons.clearAll") || "Effacer tout"}</span>
                            </Button>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {selectedGarments.map((garment, index) => (
                              <div key={`selected-${index}`} className="relative group">
                                <div className="relative w-16 h-20 sm:w-20 sm:h-24 rounded overflow-hidden border-2 border-primary bg-muted/30 shadow-md">
                                  <img
                                    src={garment.url}
                                    alt={t("tryOnWidget.ariaLabels.selectedGarment", { index: index + 1 }) || `Article sélectionné ${index + 1}`}
                                    className="w-full h-full object-contain"
                                  />
                                  <div className="absolute top-0 left-0 bg-primary text-primary-foreground text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-br z-10">
                                    {index + 1}
                                  </div>
                                  <Button
                                    variant={"destructive" as const}
                                    size="icon"
                                    onClick={() => handleGarmentDeselect(index)}
                                    className="absolute top-0 right-0 h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity rounded-bl z-20"
                                    aria-label={t("tryOnWidget.ariaLabels.removeGarment", { index: index + 1 }) || `Retirer l'article ${index + 1}`}
                                  >
                                    <XCircle className="h-3 w-3" aria-hidden="true" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                          <p className="mt-3 text-xs text-muted-foreground">
                            {t("tryOnWidget.sections.selectedGarments.hint") || "💡 Astuce: Vous pouvez changer de catégorie pour ajouter des articles de différentes catégories à votre sélection"}
                          </p>
                        </Card>
                      </div>
                    )}
                  </div>
                </Card>
              </section>
            </div>

            {/* Generate button */}
            {!isGeneratingMultiple && (
              <div className="pt-2 flex justify-center">
                <div className="w-full max-w-2xl">
                  <Button
                    onClick={handleCartMultipleGenerate}
                    disabled={!cartMultipleImage || selectedGarments.length < 1 || isGeneratingMultiple}
                    className="w-full h-12 text-base min-h-[44px]"
                    aria-label={t("tryOnWidget.buttons.generate") || "Générer l'essayage virtuel"}
                    aria-busy={isGeneratingMultiple}
                  >
                    <Sparkles className="w-5 h-5 mr-2" aria-hidden="true" />
                    {t("tryOnWidget.buttons.generateMultiple", { count: selectedGarments.length }) || `Générer ${selectedGarments.length} Image${selectedGarments.length > 1 ? "s" : ""}`}
                  </Button>
                </div>
              </div>
            )}

            {/* Progress Tracker */}
            {isGeneratingMultiple && (
              <Card className="p-6 border-border bg-card">
                <div className="space-y-4" aria-busy="true">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Loader2
                          className="h-5 w-5 animate-spin text-primary"
                          aria-hidden="true"
                        />
                        <span className="text-base font-semibold">
                          {t("tryOnWidget.status.generating") || "Génération en cours..."}
                        </span>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {batchProgress
                          ? Math.round((batchProgress.completed / batchProgress.total) * 100)
                          : progressMultiple}%
                      </span>
                    </div>
                    <Progress
                      value={
                        batchProgress
                          ? Math.round((batchProgress.completed / batchProgress.total) * 100)
                          : progressMultiple
                      }
                      className="h-2"
                      aria-label={t("tryOnWidget.progress.label") || "Progression de la génération"}
                    />
                  </div>

                  {batchProgress && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          {t("tryOnWidget.progress.garmentsProcessed") || "Articles traités"}: {batchProgress.completed} / {batchProgress.total}
                        </span>
                        {batchProgress.failed > 0 && (
                          <span className="text-warning">
                            {t("tryOnWidget.progress.failed") || "Échecs"}: {batchProgress.failed}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            )}

            {/* Error Display */}
            {errorMultiple && (
              <div role="alert" aria-live="assertive" className="mb-6">
                <Card className="p-6 bg-destructive/10 border-destructive">
                  <p className="text-destructive font-medium mb-4" id="error-multiple-message">
                    {errorMultiple}
                  </p>
                  <Button
                    variant={"outline" as const}
                    onClick={() => {
                      setErrorMultiple(null);
                      setCartMultipleImage(null);
                      setCartMultipleDemoPhotoUrl(null);
                      setSelectedGarments([]);
                      setCartResults(null);
                      setProgressMultiple(0);
                      setBatchProgress(null);
                      setHasUnsavedChanges(false);
                    }}
                    className="w-full sm:w-auto"
                    aria-label={t("tryOnWidget.buttons.retry") || "Réessayer après une erreur"}
                    aria-describedby="error-multiple-message"
                  >
                    <RotateCcw className="h-4 w-4 mr-2" aria-hidden="true" />
                    {t("tryOnWidget.buttons.retry") || "Réessayer"}
                  </Button>
                </Card>
              </div>
            )}
          </TabsContent>

          {/* Try Look Tab - Outfit Mode */}
          <TabsContent value="look" className="mt-0 space-y-6">
            {/* Selection sections (container-responsive) */}
            <div
              className={cn(
                "grid gap-6",
                layoutMode === "wide" ? "grid-cols-2 gap-8" : "grid-cols-1"
              )}
            >
              {/* Left Panel: Upload */}
              <section aria-labelledby="upload-look-heading" className="flex flex-col">
                <Card className="p-4 sm:p-6 border-border bg-card flex flex-col min-h-[500px] max-h-[800px]">
                  <div className="flex items-center gap-3 mb-4 flex-shrink-0">
                    <div
                      className="w-8 h-8 rounded-full bg-primary text-primary-foreground grid place-items-center font-semibold text-sm flex-shrink-0 shadow-sm"
                      aria-hidden="true"
                    >
                      1
                    </div>
                    <div className="min-w-0 flex-1">
                      <h2
                        id="upload-look-heading"
                        className="text-lg font-semibold"
                      >
                        {t("tryOnWidget.sections.uploadPhoto.title") || "Téléchargez Votre Photo"}
                      </h2>
                      <p className="text-xs text-muted-foreground">
                        {t("tryOnWidget.sections.uploadPhoto.description") || "Choisissez une photo claire de vous-même"}
                      </p>
                    </div>
                  </div>

                  <div className="flex-1 flex flex-col min-h-0">
                    {!cartMultipleImage && (
                      <div className="flex-1 flex items-center justify-center">
                        <PhotoUpload
                          onPhotoUpload={handleCartMultiplePhotoUpload}
                          generatedPersonKeys={new Set()}
                          matchingPersonKeys={[]}
                          showDemoPhotoStatusIndicator={false}
                          isMobile={layoutMode !== "wide"}
                        />
                      </div>
                    )}

                    {cartMultipleImage && (
                      <div className="relative rounded-lg bg-card p-3 sm:p-4 border border-border shadow-sm flex-1 flex flex-col min-h-0 gap-3">
                        <div className="flex items-center justify-between gap-2 flex-shrink-0">
                          <h3 className="font-semibold text-sm sm:text-base">
                            {t("tryOnWidget.sections.yourPhoto.title") || "Votre Photo"}
                          </h3>
                          <Button
                            variant={"outline" as const}
                            size="sm"
                            onClick={() => {
                              setCartMultipleImage(null);
                              setCartMultipleDemoPhotoUrl(null);
                            }}
                            className="group h-8 sm:h-9 px-2.5 sm:px-3 text-xs sm:text-sm flex-shrink-0 gap-1.5 border-border text-foreground hover:bg-muted hover:border-muted-foreground/20 hover:text-muted-foreground transition-all duration-200 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                            aria-label={t("tryOnWidget.buttons.clearPhoto") || "Effacer la photo téléchargée"}
                          >
                            <XCircle
                              className="h-3.5 w-3.5 sm:h-4 sm:w-4 transition-transform group-hover:scale-110 duration-200"
                              aria-hidden="true"
                            />
                            <span>{t("tryOnWidget.buttons.clear") || "Effacer"}</span>
                          </Button>
                        </div>
                        <div className="relative flex-1 rounded-lg overflow-hidden border border-border bg-card flex items-center justify-center shadow-sm min-h-0 p-2">
                          <img
                            src={cartMultipleImage}
                            alt={t("tryOnWidget.ariaLabels.uploadedPhoto") || "Photo téléchargée pour l'essayage virtuel"}
                            className="h-full w-full object-contain max-h-full"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
              </section>

              {/* Right Panel: Garment Selection */}
              <section aria-labelledby="garments-look-heading" className="flex flex-col">
                <Card className="p-4 sm:p-6 border-border bg-card flex flex-col min-h-[500px] max-h-[800px]">
                  <div className="flex items-center gap-3 mb-4">
                    <div
                      className="w-8 h-8 rounded-full bg-primary text-primary-foreground grid place-items-center font-semibold text-sm flex-shrink-0 shadow-sm"
                      aria-hidden="true"
                    >
                      2
                    </div>
                    <div className="min-w-0 flex-1">
                      <h2
                        id="garments-look-heading"
                        className="text-lg font-semibold"
                      >
                        {t("tryOnWidget.sections.selectGarments.title") || "Sélectionner les Articles"}
                      </h2>
                      <p className="text-xs text-muted-foreground">
                        {t("tryOnWidget.sections.selectGarments.look.description") || "Sélectionnez 2-8 articles pour une tenue complète"}
                      </p>
                    </div>
                  </div>

                  {/* Category Filter Dropdown - Enhanced UI/UX */}
                  {isLoadingCategories && (
                    <div className="mb-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Filter className="h-4 w-4 text-muted-foreground" />
                        <label className="text-sm font-semibold">
                          {t("tryOnWidget.filters.category") || "Filtrer par catégorie"}
                        </label>
                      </div>
                      <div className="flex items-center gap-2 px-4 py-3 rounded-lg border border-border bg-muted/30">
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        <span className="text-sm text-muted-foreground">
                          {t("tryOnWidget.filters.loadingCategories") || "Chargement des catégories..."}
                        </span>
                      </div>
                    </div>
                  )}
                  {!isLoadingCategories && store_products && store_products.categories.length > 0 && (
                    <div className="mb-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Filter className="h-4 w-4 text-primary" />
                        <label
                          htmlFor="category-filter-look"
                          className="text-sm font-semibold"
                        >
                          {t("tryOnWidget.filters.category") || "Filtrer par catégorie"}
                        </label>
                        {selectedCategory !== "all" && (
                          <span className="ml-auto text-xs text-muted-foreground">
                            {(() => {
                              if (selectedCategory === "uncategorized") {
                                return `${store_products.uncategorized.productCount} ${t("tryOnWidget.filters.products") || "produits"}`;
                              }
                              const selectedCat = store_products.categories.find(
                                (cat) => cat.categoryId === selectedCategory || cat.categoryName === selectedCategory
                              );
                              return selectedCat ? `${selectedCat.productCount} ${t("tryOnWidget.filters.products") || "produits"}` : "";
                            })()}
                          </span>
                        )}
                      </div>
                      <Select
                        value={selectedCategory}
                        onValueChange={setSelectedCategory}
                      >
                        <SelectTrigger
                          id="category-filter-look"
                          className="w-full h-11 bg-background hover:bg-muted/50 transition-colors border-2 data-[state=open]:border-primary shadow-sm"
                          aria-label={t("tryOnWidget.filters.categoryAriaLabel") || "Sélectionner une catégorie"}
                        >
                          <div className="flex items-center gap-2 flex-1">
                            <Package className="h-4 w-4 text-muted-foreground" />
                            <SelectValue placeholder={t("tryOnWidget.filters.selectCategory") || "Toutes les catégories"} />
                          </div>
                        </SelectTrigger>
                        <SelectContent className="max-h-[300px]">
                          <SelectItem 
                            value="all"
                            className="font-medium cursor-pointer focus:bg-primary/10"
                          >
                            <div className="flex items-center justify-between w-full">
                              <div className="flex items-center gap-2">
                                <Grid3x3 className="h-4 w-4" />
                                <span>{t("tryOnWidget.filters.allCategories") || "Toutes les catégories"}</span>
                              </div>
                              <span className="ml-4 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
                                {store_products.statistics?.totalProducts || 0}
                              </span>
                            </div>
                          </SelectItem>
                          {store_products.categories.map((category) => (
                            <SelectItem
                              key={category.categoryId || category.categoryName}
                              value={category.categoryId || category.categoryName}
                              className="cursor-pointer focus:bg-primary/10"
                            >
                              <div className="flex items-center justify-between w-full">
                                <span className="truncate flex-1">{category.categoryName}</span>
                                <span className="ml-4 px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-xs font-medium flex-shrink-0">
                                  {category.productCount}
                                </span>
                              </div>
                            </SelectItem>
                          ))}
                          {store_products.uncategorized.productCount > 0 && (
                            <SelectItem 
                              value="uncategorized"
                              className="cursor-pointer focus:bg-primary/10 border-t border-border mt-1 pt-1"
                            >
                              <div className="flex items-center justify-between w-full">
                                <span className="text-muted-foreground">{store_products.uncategorized.categoryName}</span>
                                <span className="ml-4 px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-xs font-medium flex-shrink-0">
                                  {store_products.uncategorized.productCount}
                                </span>
                              </div>
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {!isLoadingCategories && store_products && store_products.categories.length === 0 && (
                    <div className="mb-4 p-4 rounded-lg border border-border bg-muted/30">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Package className="h-4 w-4" />
                        <span>{t("tryOnWidget.filters.noCategories") || "Aucune catégorie disponible"}</span>
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col flex-1 min-h-0 space-y-4">
                    {/* Products Count & Selection Counter - Fixed Header */}
                    <div className="flex-shrink-0 space-y-2">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold">
                              {t("tryOnWidget.sections.selectedGarments.title") || "Articles Sélectionnés"}
                            </span>
                            <span
                              className={`text-xs px-2 py-1 rounded-full ${
                                selectedGarments.length >= 2 && selectedGarments.length < 8
                                  ? "bg-primary/10 text-primary"
                                  : selectedGarments.length >= 8
                                    ? "bg-warning/10 text-warning"
                                    : "bg-muted text-muted-foreground"
                              }`}
                            >
                              {selectedGarments.length} / 8
                            </span>
                          </div>
                          {lookTabImages.length > 0 && (
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Grid3x3 className="h-3.5 w-3.5" />
                              <span>
                                {lookTabImages.length} {t("tryOnWidget.filters.availableProducts") || "produits disponibles"}
                              </span>
                            </div>
                          )}
                        </div>
                        {selectedGarments.length > 0 && (
                          <Button
                            variant={"outline" as const}
                            size="sm"
                            onClick={handleClearAllGarments}
                            className="h-9 px-3 text-sm gap-1.5"
                            aria-label={t("tryOnWidget.buttons.clearAll") || "Effacer toutes les sélections"}
                          >
                            <XCircle className="h-4 w-4" aria-hidden="true" />
                            <span>{t("tryOnWidget.buttons.clearAll") || "Effacer tout"}</span>
                          </Button>
                        )}
                      </div>

                      {/* Validation Message */}
                      {selectedGarments.length < 2 && (
                        <div
                          role="alert"
                          className="text-sm text-warning bg-warning/10 p-3 rounded-lg"
                        >
                          {t("tryOnWidget.validation.minGarmentsLook") || "Sélectionnez au moins 2 articles pour continuer"}
                        </div>
                      )}

                      {selectedGarments.length >= 8 && (
                        <div
                          role="alert"
                          className="text-sm text-warning bg-warning/10 p-3 rounded-lg"
                        >
                          {t("tryOnWidget.validation.maxGarmentsLook") || "Maximum 8 articles sélectionnés"}
                        </div>
                      )}
                    </div>

                    {/* Garment Grid - Scrollable */}
                    <div className="flex-1 min-h-0 overflow-y-auto pr-1 -mr-1 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:bg-primary/30 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent hover:[&::-webkit-scrollbar-thumb]:bg-primary/50">
                      {lookTabImages.length === 0 ? (
                        isMultipleLookProductsLoading ? (
                          <div
                            role="status"
                            aria-live="polite"
                            aria-busy="true"
                            className={cn(
                              "grid animate-in fade-in-0 duration-300 pb-2",
                              layoutMode === "wide" ? "grid-cols-3 gap-4" : "grid-cols-2 gap-3"
                            )}
                          >
                            {Array.from({ length: layoutMode === "wide" ? 9 : 6 }).map((_, index) => (
                              <Card
                                // eslint-disable-next-line react/no-array-index-key
                                key={`look-skeleton-${index}`}
                                className="overflow-hidden border-border"
                                aria-hidden="true"
                              >
                                <Skeleton className="h-48 sm:h-56 md:h-64 w-full" />
                              </Card>
                            ))}
                          </div>
                        ) : (
                        <div role="alert" aria-live="polite" className="h-full flex items-center justify-center">
                          <Card className="p-8 text-center bg-muted/30 border-border">
                            <div className="flex flex-col items-center gap-4">
                              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                                <Package className="h-8 w-8 text-muted-foreground" />
                              </div>
                              <div>
                                <p className="font-semibold text-foreground text-base mb-2">
                                  {selectedCategory === "all"
                                    ? t("tryOnWidget.errors.noProducts") || "Aucun produit disponible"
                                    : t("tryOnWidget.errors.noProductsInCategory") || "Aucun produit dans cette catégorie"}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  {selectedCategory === "all"
                                    ? t("tryOnWidget.errors.noProductsDescription") || "Les produits seront disponibles une fois chargés"
                                    : t("tryOnWidget.errors.noProductsInCategoryDescription") || "Essayez de sélectionner une autre catégorie"}
                                </p>
                              </div>
                            </div>
                          </Card>
                        </div>
                        )
                      ) : (
                        <div
                          className={cn(
                            "grid animate-in fade-in-0 duration-300 pb-2",
                            layoutMode === "wide" ? "grid-cols-3 gap-4" : "grid-cols-2 gap-3"
                          )}
                        >
                          {lookTabImages.map((imageUrl, index) => {
                            const garment: ProductImage = {
                              url: imageUrl,
                              id: lookTabImagesWithIds.get(imageUrl),
                            };
                            const selected = selectedGarments.some((g) => g.url === imageUrl);
                            const canSelectMore = selectedGarments.length < 8;
                            const selectedIndex = selectedGarments.findIndex((g) => g.url === imageUrl);

                            return (
                              <Card
                                key={`${imageUrl}-${index}`}
                                className={`overflow-hidden cursor-pointer transition-all transform hover:scale-105 relative focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 isolate ${
                                  selected
                                    ? "ring-4 ring-primary shadow-lg scale-105 z-10"
                                    : canSelectMore
                                      ? "hover:ring-2 hover:ring-primary/50"
                                      : "opacity-60 cursor-not-allowed"
                                }`}
                                onClick={() => {
                                  if (selected) {
                                    handleGarmentDeselect(selectedIndex);
                                  } else if (canSelectMore) {
                                    handleGarmentSelect(garment);
                                  }
                                }}
                                role="button"
                                tabIndex={canSelectMore ? 0 : -1}
                                aria-label={selected ? t("tryOnWidget.ariaLabels.deselectGarment", { index: index + 1 }) || `Désélectionner l'article ${index + 1}` : t("tryOnWidget.ariaLabels.selectGarment", { index: index + 1 }) || `Sélectionner l'article ${index + 1}`}
                                aria-pressed={selected}
                                onKeyDown={(e) => {
                                  if (canSelectMore && (e.key === "Enter" || e.key === " ")) {
                                    e.preventDefault();
                                    if (selected) {
                                      handleGarmentDeselect(selectedIndex);
                                    } else {
                                      handleGarmentSelect(garment);
                                    }
                                  }
                                }}
                              >
                                <div className="relative bg-muted/30 flex items-center justify-center overflow-hidden h-48 sm:h-56 md:h-64">
                                  <img
                                    src={imageUrl}
                                    alt={selected ? t("tryOnWidget.ariaLabels.selectedGarment", { index: index + 1 }) || `Article ${index + 1} - Sélectionné` : t("tryOnWidget.ariaLabels.garment", { index: index + 1 }) || `Article ${index + 1}`}
                                    className="h-full w-auto object-contain"
                                    loading="lazy"
                                  />
                                  {selected && (
                                    <>
                                      <div className="absolute inset-0 bg-primary/10 flex items-center justify-center">
                                        <div className="absolute top-2 right-2 bg-primary text-primary-foreground rounded-full p-1.5 shadow-lg">
                                          <Check className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" />
                                        </div>
                                      </div>
                                      <div className="absolute top-2 left-2 bg-primary text-primary-foreground rounded-full w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center text-xs sm:text-sm font-bold shadow-lg">
                                        {selectedIndex + 1}
                                      </div>
                                    </>
                                  )}
                                </div>
                              </Card>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Selected Garments Summary - Fixed at bottom when garments are selected */}
                    {selectedGarments.length > 0 && (
                      <div className="flex-shrink-0 mt-3 sm:mt-4">
                        <Card className="p-3 sm:p-4 border-2 border-primary/20 bg-primary/5 shadow-sm">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                              <h3 className="text-sm sm:text-base font-semibold">
                                {t("tryOnWidget.sections.selectedGarments.title") || "Articles Sélectionnés"}
                              </h3>
                              <span className="px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-xs font-bold">
                                {selectedGarments.length} / {activeTab === "multiple" ? 6 : 8}
                              </span>
                            </div>
                            <Button
                              variant={"outline" as const}
                              size="sm"
                              onClick={() => {
                                for (let i = selectedGarments.length - 1; i >= 0; i--) {
                                  handleGarmentDeselect(i);
                                }
                              }}
                              className="h-8 sm:h-9 px-2.5 sm:px-3 text-xs sm:text-sm gap-1.5"
                              aria-label={t("tryOnWidget.buttons.clearAll") || "Effacer toutes les sélections"}
                            >
                              <XCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden="true" />
                              <span>{t("tryOnWidget.buttons.clearAll") || "Effacer tout"}</span>
                            </Button>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {selectedGarments.map((garment, index) => (
                              <div key={`selected-${index}`} className="relative group">
                                <div className="relative w-16 h-20 sm:w-20 sm:h-24 rounded overflow-hidden border-2 border-primary bg-muted/30 shadow-md">
                                  <img
                                    src={garment.url}
                                    alt={t("tryOnWidget.ariaLabels.selectedGarment", { index: index + 1 }) || `Article sélectionné ${index + 1}`}
                                    className="w-full h-full object-contain"
                                  />
                                  <div className="absolute top-0 left-0 bg-primary text-primary-foreground text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-br z-10">
                                    {index + 1}
                                  </div>
                                  <Button
                                    variant={"destructive" as const}
                                    size="icon"
                                    onClick={() => handleGarmentDeselect(index)}
                                    className="absolute top-0 right-0 h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity rounded-bl z-20"
                                    aria-label={t("tryOnWidget.ariaLabels.removeGarment", { index: index + 1 }) || `Retirer l'article ${index + 1}`}
                                  >
                                    <XCircle className="h-3 w-3" aria-hidden="true" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                          <p className="mt-3 text-xs text-muted-foreground">
                            {t("tryOnWidget.sections.selectedGarments.hint") || "💡 Astuce: Vous pouvez changer de catégorie pour ajouter des articles de différentes catégories à votre sélection"}
                          </p>
                        </Card>
                      </div>
                    )}
                  </div>
                </Card>
              </section>
            </div>

            {/* Generate button */}
            {!isGeneratingMultiple && (
              <div className="pt-2 flex justify-center">
                <div className="w-full max-w-2xl">
                  <Button
                    onClick={handleCartMultipleGenerate}
                    disabled={!cartMultipleImage || selectedGarments.length < 2 || isGeneratingMultiple}
                    className="w-full h-12 text-base min-h-[44px]"
                    aria-label={t("tryOnWidget.buttons.generateOutfit") || "Générer la Tenue Complète"}
                    aria-busy={isGeneratingMultiple}
                  >
                    <Sparkles className="w-5 h-5 mr-2" aria-hidden="true" />
                    {t("tryOnWidget.buttons.generateOutfit") || "Générer la Tenue Complète"}
                  </Button>
                </div>
              </div>
            )}

            {/* Progress Tracker */}
            {isGeneratingMultiple && (
              <Card className="p-6 border-border bg-card">
                <div className="space-y-4" aria-busy="true">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Loader2
                          className="h-5 w-5 animate-spin text-primary"
                          aria-hidden="true"
                        />
                        <span className="text-base font-semibold">
                          {t("tryOnWidget.status.generatingOutfit") || "Génération de la tenue complète..."}
                        </span>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {progressMultiple}%
                      </span>
                    </div>
                    <Progress 
                      value={progressMultiple} 
                      className="h-2"
                      aria-label={t("tryOnWidget.progress.label") || "Progression de la génération"}
                    />
                  </div>

                  <div className="text-sm text-muted-foreground">
                    {t("tryOnWidget.status.generatingOutfitTime") || "La génération d'une tenue complète peut prendre 10 à 15 secondes..."}
                  </div>
                </div>
              </Card>
            )}

            {/* Error Display */}
            {errorMultiple && (
              <div role="alert" aria-live="assertive" className="mb-6">
                <Card className="p-6 bg-destructive/10 border-destructive">
                  <p className="text-destructive font-medium mb-4" id="error-look-message">
                    {errorMultiple}
                  </p>
                  <Button
                    variant={"outline" as const}
                    onClick={() => {
                      setErrorMultiple(null);
                      setCartMultipleImage(null);
                      setCartMultipleDemoPhotoUrl(null);
                      setSelectedGarments([]);
                      setOutfitResult(null);
                      setProgressMultiple(0);
                      setBatchProgress(null);
                      setHasUnsavedChanges(false);
                    }}
                    className="w-full sm:w-auto"
                    aria-label={t("tryOnWidget.buttons.retry") || "Réessayer après une erreur"}
                    aria-describedby="error-look-message"
                  >
                    <RotateCcw className="h-4 w-4 mr-2" aria-hidden="true" />
                    {t("tryOnWidget.buttons.retry") || "Réessayer"}
                  </Button>
                </Card>
              </div>
            )}
          </TabsContent>
        </Tabs>
        </div>
      
    </div>
  );
}

