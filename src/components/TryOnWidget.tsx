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
  extractShopName,
  type StoreInfo,
} from "@/utils/shopifyIntegration";
import { storage } from "@/utils/storage";
import {
  generateTryOn,
  dataURLToBlob,
} from "@/services/tryonApi";
import { TryOnResponse, ProductImage } from "@/types/tryon";
import { Sparkles, X, RotateCcw, Loader2, Download, ShoppingCart, CreditCard, Image as ImageIcon, Check, ArrowLeft, Info, Share2, LogIn, Shield, WifiOff, CheckCircle } from "lucide-react";
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
import { useStoreInfo } from "@/hooks/useStoreInfo";
import { useIsMobile } from "@/hooks/use-mobile";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { addWatermarkToImage } from "@/utils/imageWatermark";
import { trackAddToCartEvent } from "@/services/cartTrackingApi";

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

export default function TryOnWidget({ isOpen, onClose, customerInfo }: TryOnWidgetProps) {
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

  // Redux state for store info
  const { fetchStoreInfo: fetchStoreInfoFromRedux, storeInfo: reduxStoreInfo } =
    useStoreInfo();

  // State to store product data (received via postMessage or accessed directly)
  const [storedProductData, setStoredProductData] = useState<any>(null);


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
  
  const singleTabAvailableImagesWithIds = useMemo(() => {
    return new Map<string, string | number>([
      ...singleTabImagesWithIds.entries(),
    ]);
  }, [singleTabImagesWithIds]);
  
  // Helper functions for single tab images
  const getCurrentTabImages = (): string[] => singleTabImages;
  
  const getCurrentTabImagesWithIds = (): Map<string, string | number> => singleTabAvailableImagesWithIds;
  
  const setCurrentTabImages = (images: string[]) => {
    setSingleTabImages(images);
  };
  
  const setCurrentTabImagesWithIds = (idMap: Map<string, string | number>) => {
    setSingleTabImagesWithIds(idMap);
  };
  const [isInitializing, setIsInitializing] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isBuyNowLoading, setIsBuyNowLoading] = useState(false);
  const [isAddToCartLoading, setIsAddToCartLoading] = useState(false);
  const [isDownloadLoading, setIsDownloadLoading] = useState(false);
  const [isInstagramShareLoading, setIsInstagramShareLoading] = useState(false);
  const [isWatermarkReady, setIsWatermarkReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const widgetContainerRef = useRef<HTMLDivElement | null>(null);
  // Cache for watermarked blob and share data to avoid re-processing on every share click
  const watermarkedBlobCacheRef = useRef<{ 
    imageUrl: string; 
    blob: Blob; 
    timestamp: number;
    shareData?: {
      title: string;
      text: string;
      url: string;
    };
  } | null>(null);
  const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  const [layoutMode, setLayoutMode] = useState<LayoutMode>("compact");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusVariant, setStatusVariant] = useState<"info" | "error">("info");
  const [storeInfo, setStoreInfo] = useState<StoreInfo | null>(null);
  
  // Mobile step state: "photo" (show photo upload) or "clothing" (show clothing selection)
  const [mobileStep, setMobileStep] = useState<"photo" | "clothing">("photo");
  
  // Version selection (1 or 2, default: 1)
  const [selectedVersion, setSelectedVersion] = useState<number | null>(1);
  
  
  const INFLIGHT_KEY = "nusense_tryon_inflight";
  // Track if we've already loaded images from URL/NUSENSE_PRODUCT_DATA to prevent parent images from overriding
  const imagesLoadedRef = useRef<boolean>(false);
  // Track if we're currently closing to prevent double-close
  const isClosingRef = useRef<boolean>(false);
  console.log({ storeInfo });

  // Helper function to get shop name with fallbacks
  const getShopName = useMemo(() => {
    // 1. Try from Redux store info (from API) - This is the actual business name from Shopify

    
     
    if (reduxStoreInfo?.name) {
      return reduxStoreInfo.name;
    }

    if (reduxStoreInfo?.shopName) {
      return reduxStoreInfo.shopName;
    }
    // 2. Try from storeInfo state (from page extraction) - Business name extracted from page
    if (storeInfo?.shopName) {
      return storeInfo.shopName;
    }
    // 3. Try to extract business name from page (JSON-LD, meta tags, etc.)
    const extractedName = extractShopName();
    console.log({ extractedName });
    if (extractedName) {
      // Validate it's not a domain - check for .myshopify.com specifically
      // Allow dots in business names (e.g., "Dr. Martens", "A.B.C. Store")
      if (!extractedName.toLowerCase().includes('.myshopify.com')) {
        return extractedName;
      }
    }
    // 4. LAST RESORT: Fall back to cleaned domain only if no business name is available
    // This should rarely happen, but provides a fallback for edge cases
    const shopDomain = storeInfo?.shopDomain || storeInfo?.domain || reduxStoreInfo?.shop;
    if (shopDomain) {
      return shopDomain.replace(".myshopify.com", "");
    }
    return null;
  }, [storeInfo, reduxStoreInfo]);

  // Debug: Log customer info on component load
  useEffect(() => {
    console.log("[TryOnWidget] Customer info:", customerInfo);
    if (customerInfo?.id) {
      console.log("[TryOnWidget] Customer ID:", customerInfo.id);
    }
    if (customerInfo?.email) {
      console.log("[TryOnWidget] Customer Email:", customerInfo.email);
    }
  }, [customerInfo]);

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

  // Expose store info globally for access
  useEffect(() => {
    if (storeInfo && typeof window !== "undefined") {
      (window as any).NUSENSE_STORE_INFO = storeInfo;
    }
  }, [storeInfo]);

  // Pre-process image with watermark when generatedImage changes
  // This ensures the blob is ready synchronously when user clicks share
  useEffect(() => {
    if (!generatedImage) {
      watermarkedBlobCacheRef.current = null;
      return;
    }

    // Prepare store info for watermark
    const shopDomain = storeInfo?.shopDomain || storeInfo?.domain || reduxStoreInfo?.shop || null;
    // getShopName is the business name (for display), shopDomain is the actual domain (for API/domain field)
    const storeName = getShopName || (shopDomain ? shopDomain.replace(".myshopify.com", "") : null);
    console.log({ storeName, shopDomain });
    const storeWatermarkInfo = storeName ? {
      name: storeName,
      domain: shopDomain || null, // Use shopDomain only, don't fallback to storeName (business name)
      logoUrl: null,
    } : null;

    const cacheKey = `${generatedImage}_${storeName || 'default'}`;
    
    // Check if we already have a cached blob for this image
    const cached = watermarkedBlobCacheRef.current;
    if (cached && cached.imageUrl === cacheKey && (Date.now() - cached.timestamp) < CACHE_DURATION) {
      return; // Already cached, no need to reprocess
    }

    // Pre-process the image in the background and prepare share data
    setIsWatermarkReady(false); // Reset ready state
    addWatermarkToImage(generatedImage, storeWatermarkInfo)
      .then((blob) => {
        // Pre-compute share data to minimize work on click
        const productData = getProductData();
        // getShopName already handles all fallbacks including domain cleanup
        const storeDisplayName = getShopName || "Store";
        const productTitle = productData?.title || "Product";
        const productUrl = productData?.url || window.location.href;
        
        const caption = [
          `✨ Virtual Try-On by NUSENSE`,
          ``,
          `Check out this ${productTitle} from ${storeDisplayName}!`,
          ``,
          `🔗 Shop now: ${productUrl}`,
          ``,
          `#VirtualTryOn #AIFashion #FashionTech #VirtualStyling #TryBeforeYouBuy #FashionAI #DigitalFashion #VirtualReality #FashionTech #Shopify #Ecommerce #Fashion #Style #Outfit #Clothing #Fashionista #InstaFashion #FashionBlogger #StyleInspo #OOTD #FashionLover #FashionAddict #FashionStyle #FashionDesign #FashionWeek #FashionTrends #FashionForward #Fashionable #FashionableStyle #FashionableLife`,
        ].join("\n");

        watermarkedBlobCacheRef.current = {
          imageUrl: cacheKey,
          blob: blob,
          timestamp: Date.now(),
          shareData: {
            title: productTitle,
            text: caption,
            url: productUrl,
          },
        };
        setIsWatermarkReady(true); // Mark as ready
      })
      .catch((error) => {
        console.warn("Failed to pre-process image for sharing:", error);
        setIsWatermarkReady(false);
        // Don't set cache on error - will retry on share click
      });
  }, [generatedImage, storeInfo, reduxStoreInfo, getShopName]);

  // Set initializing to false after component has mounted and initial setup is done
  useEffect(() => {
    // Wait for initial mount and setup to complete
    const initTimer = setTimeout(() => {
      setIsInitializing(false);
    }, 300); // Short delay to ensure skeleton shows briefly during opening

    return () => clearTimeout(initTimer);
  }, []);

  // Track if we've restored state from storage on this mount to prevent multiple restorations
  const hasRestoredOnMountRef = useRef(false);

  // Restore saved data from storage when component mounts or when widget opens
  // This ensures complete state persistence when widget is closed/reopened, page refresh, or browser restart
  useEffect(() => {
    // Only restore if widget is open (or undefined, meaning always visible)
    if (isOpen !== false) {
      const savedImage = storage.getUploadedImage();
      const savedClothing = storage.getClothingUrl();
      const savedResult = storage.getGeneratedImage();
      
      // Check if we have anything to restore from storage
      const hasDataToRestore = savedImage || savedClothing || savedResult;
      
      // Only restore once per mount to prevent unnecessary updates
      // But always restore if we have data and haven't restored yet on this mount
      if (hasDataToRestore && !hasRestoredOnMountRef.current) {
        hasRestoredOnMountRef.current = true;

        // Restore all state from storage unconditionally to ensure complete state consistency
        // This handles: widget close/reopen, page refresh, browser restart, navigation
        if (savedImage) {
          setUploadedImage(savedImage);
        }
        
        if (savedClothing) {
          setSelectedClothing(savedClothing);
        }
        
        if (savedResult) {
          setGeneratedImage(savedResult);
        }

        // Set the appropriate step and status based on what exists in storage
        // Use requestAnimationFrame to ensure all state updates are coordinated
        // Priority: Result (step 4) > Ready to generate (step 3) > Photo uploaded (step 2)
        requestAnimationFrame(() => {
          // Double-check storage values in case they changed (handle race conditions)
          const finalSavedResult = storage.getGeneratedImage();
          const finalSavedClothing = storage.getClothingUrl();
          const finalSavedImage = storage.getUploadedImage();

          if (finalSavedResult) {
            // Step 4: Result page - highest priority (has generated result)
            setCurrentStep(4);
            setStatusMessage(t("tryOnWidget.status.resultReady") || "Résultat prêt. Utilisez les actions ci-dessous.");
            setStatusVariant("info");
            setProgress(100); // Ensure progress shows complete
            // mobileStep doesn't need to be set for result - UI shows result based on generatedImage
          } else if (finalSavedClothing && finalSavedImage) {
            // Step 3: Ready to generate (has photo + clothing, but no result yet)
            setCurrentStep(3);
            setStatusMessage(t("tryOnWidget.status.readyToGenerate") || "Prêt à générer. Cliquez sur Générer.");
            setStatusVariant("info");
            setMobileStep("clothing");
          } else if (finalSavedImage) {
            // Step 2: Photo uploaded (has photo but no clothing selected)
            setCurrentStep(2);
            setStatusMessage(t("tryOnWidget.status.photoUploaded") || "Photo chargée. Sélectionnez un vêtement.");
            setStatusVariant("info");
            setMobileStep("clothing");
          }
        });
      }
    }
  }, [isOpen, t]); // Only depend on isOpen and t - restore when widget opens

  // Reset restoration flag when widget closes to allow restoration on next open
  // This ensures state is restored every time the widget opens, not just on first mount
  useEffect(() => {
    if (isOpen === false) {
      hasRestoredOnMountRef.current = false;
    }
  }, [isOpen]);

  useEffect(() => {

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
      // Images will be requested in a separate useEffect when needed
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
  }, [isOpen, uploadedImage, selectedClothing, generatedImage, t]);

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

      // Handle product data messages
      if (event.data && event.data.type === "NUSENSE_PRODUCT_DATA") {
        console.log("[TryOnWidget] Received NUSENSE_PRODUCT_DATA:", event.data.productData);
        if (event.data.productData) {
          setStoredProductData(event.data.productData);
        }
      }

      // Only process messages from parent window
      if (event.data && event.data.type === "NUSENSE_PRODUCT_IMAGES") {
        const parentImages = event.data.images || [];

        console.log(
          "[TryOnWidget] Received NUSENSE_PRODUCT_IMAGES:",
          parentImages.length,
          "images"
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
        // Store cart items for reference (cart data tracking)
        void productImages;
      }

      // Handle cart action success/error messages from parent window
      if (event.data && event.data.type === "NUSENSE_ACTION_SUCCESS") {
        if (event.data.action === "NUSENSE_ADD_TO_CART") {
          setIsAddToCartLoading(false);
          const productData = getProductData();
          
          // Track add to cart event ONLY after successful cart addition
          const shopDomain = storeInfo?.shopDomain ?? storeInfo?.domain ?? reduxStoreInfo?.shop;
          if (shopDomain) {
            // Extract product data from multiple sources with priority:
            // 1. event.data.product (from bridge script extraction)
            // 2. event.data.cart.items[0] (direct from cart API response)
            // 3. localProductData (from NUSENSE_PRODUCT_DATA)
            const successProductData = event.data?.product ?? {};
            const cartItem = Array.isArray(event.data?.cart?.items) && (event.data.cart.items.length ?? 0) > 0 
              ? event.data.cart.items[0] 
              : null;
            
            // Normalize product URL from cart response (may be relative)
            const normalizeProductUrl = (url: string | null | undefined): string | null => {
              if (!url || typeof url !== 'string') return null;
              if (url.startsWith('http://') || url.startsWith('https://')) return url;
              if (url.startsWith('/')) {
                try {
                  return window?.location?.origin ? window.location.origin + url : url;
                } catch {
                  return url;
                }
              }
              return url;
            };
            
            // Build final product data with priority: successProductData > cartItem > localProductData
            const finalProductData = {
              id: successProductData?.productId 
                ?? cartItem?.product_id 
                ?? productData?.id 
                ?? null,
              title: successProductData?.productTitle 
                ?? cartItem?.product_title 
                ?? productData?.title 
                ?? null,
              url: normalizeProductUrl(successProductData?.productUrl) 
                ?? normalizeProductUrl(cartItem?.url) 
                ?? productData?.url 
                ?? null,
              variantId: successProductData?.variantId 
                ?? cartItem?.variant_id 
                ?? null,
            };

            // Debug logging
            console.log("[CART_TRACKING] Tracking Add to Cart Event:", {
              successProductData,
              cartItem,
              localProductData: productData,
              finalProductData,
            });

            // Validate that we have required product and variant IDs
            if (!finalProductData.id || !finalProductData.variantId) {
              console.error("[CART_TRACKING] Missing required product or variant ID", {
                productId: finalProductData.id,
                variantId: finalProductData.variantId,
                successProductData,
                cartItem,
                localProductData: productData,
              });
            }

            if (customerInfo?.id) {
              trackAddToCartEvent({
                storeName: shopDomain,
                actionType: "add_to_cart",
                productId: finalProductData.id,
                productTitle: finalProductData.title,
                productUrl: finalProductData.url,
                variantId: finalProductData.variantId,
                customerId: customerInfo.id,
              }).catch((trackingError) => {
                // Show error toast if tracking fails
                console.error("[CART_TRACKING] Failed to track add to cart event:", trackingError);
                toast.error(t("tryOnWidget.resultDisplay.trackingError") || "Erreur de suivi", {
                  description: t("tryOnWidget.resultDisplay.trackingErrorDescription") || "Impossible d'enregistrer l'événement. L'article a été ajouté au panier.",
                });
              });
            }
          }
        } else if (event.data.action === "NUSENSE_BUY_NOW") {
          setIsBuyNowLoading(false);
          
          // Track buy now event ONLY after successful checkout initiation
          const shopDomain = storeInfo?.shopDomain ?? storeInfo?.domain ?? reduxStoreInfo?.shop;
          if (shopDomain) {
            // Extract product data from multiple sources with priority:
            // 1. event.data.product (from bridge script extraction)
            // 2. event.data.cart.items[0] (direct from cart API response)
            // 3. localProductData (from NUSENSE_PRODUCT_DATA)
            const successProductData = event.data?.product ?? {};
            const cartItem = Array.isArray(event.data?.cart?.items) && (event.data.cart.items.length ?? 0) > 0 
              ? event.data.cart.items[0] 
              : null;
            const localProductData = getProductData();
            
            // Normalize product URL from cart response (may be relative)
            const normalizeProductUrl = (url: string | null | undefined): string | null => {
              if (!url || typeof url !== 'string') return null;
              if (url.startsWith('http://') || url.startsWith('https://')) return url;
              if (url.startsWith('/')) {
                try {
                  return window?.location?.origin ? window.location.origin + url : url;
                } catch {
                  return url;
                }
              }
              return url;
            };
            
            // Build final product data with priority: successProductData > cartItem > localProductData
            const finalProductData = {
              id: successProductData?.productId 
                ?? cartItem?.product_id 
                ?? localProductData?.id 
                ?? null,
              title: successProductData?.productTitle 
                ?? cartItem?.product_title 
                ?? localProductData?.title 
                ?? null,
              url: normalizeProductUrl(successProductData?.productUrl) 
                ?? normalizeProductUrl(cartItem?.url) 
                ?? localProductData?.url 
                ?? null,
              variantId: successProductData?.variantId 
                ?? cartItem?.variant_id 
                ?? null,
            };

            // Debug logging
            console.log("[CART_TRACKING] Tracking Buy Now Event:", {
              successProductData,
              cartItem,
              localProductData,
              finalProductData,
            });

            // Validate that we have required product and variant IDs
            if (!finalProductData.id || !finalProductData.variantId) {
              console.error("[CART_TRACKING] Missing required product or variant ID", {
                productId: finalProductData.id,
                variantId: finalProductData.variantId,
                successProductData,
                cartItem,
                localProductData,
              });
            }

            // Fire tracking request without awaiting - don't block checkout redirect
            if (customerInfo?.id) {
              trackAddToCartEvent({
                storeName: shopDomain,
                actionType: "buy_now",
                productId: finalProductData.id,
                productTitle: finalProductData.title,
                productUrl: finalProductData.url,
                variantId: finalProductData.variantId,
                customerId: customerInfo.id,
              }).catch((trackingError) => {
                // Silently handle tracking errors - don't affect checkout flow
                console.error("[CART_TRACKING] Failed to track buy now event:", trackingError);
              });
            }
          }
        }
      } else if (event.data && event.data.type === "NUSENSE_ACTION_ERROR") {
        if (event.data.action === "NUSENSE_ADD_TO_CART") {
          setIsAddToCartLoading(false);
          toast.error(t("tryOnWidget.resultDisplay.error") || "Erreur", {
            description:
              event.data.error ||
              t("tryOnWidget.resultDisplay.addToCartError") || "Impossible d'ajouter l'article au panier. Veuillez réessayer.",
          });
        } else if (event.data.action === "NUSENSE_BUY_NOW") {
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
    return () => window.removeEventListener("message", handleMessage);
  }, [fetchStoreInfoFromRedux, storeInfo, reduxStoreInfo, generatedImage, uploadedImage, selectedClothing, customerInfo, t, storedProductData]); // Include all dependencies

  // Request product data on mount if in iframe and we don't have it
  useEffect(() => {
    const isInIframe = typeof window !== "undefined" && window.parent !== window;
    if (isInIframe && !storedProductData) {
      // Try direct access first
      try {
        const productData = (window.parent as any)?.NUSENSE_PRODUCT_DATA;
        if (productData) {
          console.log("[TRYON_WIDGET] Found product data on mount:", productData);
          setStoredProductData(productData);
          return;
        }
      } catch (e) {
        // Cross-origin, will request via postMessage
      }
      
      // Request via postMessage
      try {
        window.parent.postMessage({ type: "NUSENSE_REQUEST_PRODUCT_DATA" }, "*");
        console.log("[TRYON_WIDGET] Requested product data via postMessage on mount");
      } catch (error) {
        console.warn("[TRYON_WIDGET] Failed to request product data on mount:", error);
      }
    }
  }, [storedProductData]);

  // Request images from parent window when in iframe mode
  // This runs on initial mount when we don't have images yet
  useEffect(() => {
    const isInIframe = window.parent !== window;
    
    // Only request images if we're in iframe mode and don't have images yet
    if (isInIframe && singleTabImages.length === 0) {
      console.log("[TryOnWidget] Requesting images from parent", {
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
  }, [mobileStep, singleTabImages.length]); // Include singleTabImages.length to prevent duplicate requests

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

  const handlePhotoUpload = (
    dataURL: string,
    isDemoPhoto?: boolean,
    demoPhotoUrl?: string
  ) => {
    setUploadedImage(dataURL);
    storage.saveUploadedImage(dataURL);
    // Track which selection method was used
    if (isDemoPhoto && demoPhotoUrl) {
      setPhotoSelectionMethod("demo");
      setSelectedDemoPhotoUrl(demoPhotoUrl);
    } else {
      setPhotoSelectionMethod("file");
      setSelectedDemoPhotoUrl(null);
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

    // Get the clothing ID if available (clear if imageUrl is empty)
    if (imageUrl) {
      const clothingId = singleTabAvailableImagesWithIds.get(imageUrl) || null;
      setSelectedClothingKey(clothingId);

      setStatusVariant("info");
      setStatusMessage(t("tryOnWidget.status.readyToGenerate") || "Prêt à générer. Cliquez sur Générer.");
    } else {
      setSelectedClothingKey(null);
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
      t("tryOnWidget.status.generating") || "Génération…"
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

      // Get shop domain (prioritize domain over business name for API calls)
      const shopDomain = storeInfo?.shopDomain || storeInfo?.domain || reduxStoreInfo?.shop || null;
      // Use shopDomain for API calls, not storeName (business name)
      const storeDomainForApi = shopDomain || null;

      // Get clothingKey from selected clothing ID (non-mandatory field)
      const clothingKey = selectedClothingKey
        ? String(selectedClothingKey)
        : undefined;

      // Get personKey from selected demo photo ID (non-mandatory field, only for demo pictures)
      const personKey = selectedDemoPhotoUrl
        ? DEMO_PHOTO_ID_MAP.get(selectedDemoPhotoUrl) || undefined
        : undefined;

      // Get product information if available (non-mandatory)
      // Priority 1: Use stored product data (from postMessage) - most reliable
      // Priority 2: Use getProductData() function - tries direct access
      let productData: any = null;
      
      if (storedProductData) {
        productData = storedProductData;
        console.log("[TRYON_WIDGET] [GENERATION] Using stored product data:", {
          id: productData.id,
          title: productData.title,
          url: productData.url,
          hasVariants: !!productData.variants,
        });
      } else {
        // Try the existing getProductData function
        productData = getProductData();
        if (productData) {
          console.log("[TRYON_WIDGET] [GENERATION] Got product data from getProductData():", {
            id: productData.id,
            title: productData.title,
            url: productData.url,
            hasVariants: !!productData.variants,
          });
          // Cache it for future use
          setStoredProductData(productData);
        } else {
          console.warn("[TRYON_WIDGET] [GENERATION] No product data available from any source");
          // Request via postMessage as fallback (async, won't block generation)
          try {
            if (typeof window !== "undefined" && window.parent !== window) {
              window.parent.postMessage({ type: "NUSENSE_REQUEST_PRODUCT_DATA" }, "*");
              console.log("[TRYON_WIDGET] [GENERATION] Requested product data via postMessage");
            }
          } catch (postError) {
            console.warn("[TRYON_WIDGET] [GENERATION] Failed to request product data:", postError);
          }
        }
      }

      // Try to get selected variant ID from URL or other sources
      let selectedVariantId: number | string | null = null;
      try {
        // First check current window URL
        if (typeof window !== "undefined" && window.location) {
          const urlParams = new URLSearchParams(window.location.search);
          const variantParam = urlParams.get("variant");
          if (variantParam) {
            selectedVariantId = variantParam;
            console.log("[TRYON_WIDGET] Found variantId from current URL:", selectedVariantId);
          }
        }
        // If in iframe, also check parent window URL (via postMessage request)
        if (!selectedVariantId && typeof window !== "undefined" && window.parent !== window) {
          try {
            // Try direct access first
            const parentUrl = window.parent.location.href;
            const parentUrlObj = new URL(parentUrl);
            const parentVariantParam = parentUrlObj.searchParams.get("variant");
            if (parentVariantParam) {
              selectedVariantId = parentVariantParam;
              console.log("[TRYON_WIDGET] Found variantId from parent URL (direct):", selectedVariantId);
            }
          } catch (e) {
            // Cross-origin access failed, that's okay - we'll check productData
          }
        }
        // Also check if variantId is directly in productData
        if (!selectedVariantId && productData) {
          selectedVariantId = productData.variantId ?? productData.variant_id ?? productData.selectedVariantId ?? null;
          if (selectedVariantId) {
            console.log("[TRYON_WIDGET] Found variantId in productData:", selectedVariantId);
          }
        }
        // Check if there's a selected variant in productData.variants array
        if (!selectedVariantId && productData?.variants && Array.isArray(productData.variants)) {
          // Try to find the first available variant, or the first one if all are available
          const availableVariant = productData.variants.find((v: any) => v?.available !== false);
          if (availableVariant?.id) {
            selectedVariantId = availableVariant.id;
            console.log("[TRYON_WIDGET] Using first available variant from productData:", selectedVariantId);
          } else if (productData.variants.length > 0 && productData.variants[0]?.id) {
            selectedVariantId = productData.variants[0].id;
            console.log("[TRYON_WIDGET] Using first variant from productData:", selectedVariantId);
          }
        }
      } catch (error) {
        // Ignore errors
        console.warn("[TRYON_WIDGET] Error extracting variantId:", error);
      }

      // Only create productInfo if we have at least one valid field
      const productId = productData?.id ?? null;
      const productTitle = productData?.title ?? null;
      const productUrl = productData?.url ?? null;
      
      const productInfo = (productId != null || productTitle != null || productUrl != null || selectedVariantId != null) ? {
        productId: productId != null ? productId : null,
        productTitle: productTitle != null ? productTitle : null,
        productUrl: productUrl != null ? productUrl : null,
        variantId: selectedVariantId,
      } : null;

      // Debug logging for product info - COMPREHENSIVE
      console.log("[TRYON_WIDGET] [GENERATION] ===== PRODUCT DATA EXTRACTION DEBUG =====");
      console.log("[TRYON_WIDGET] [GENERATION] storedProductData:", storedProductData);
      console.log("[TRYON_WIDGET] [GENERATION] productData (final):", productData);
      console.log("[TRYON_WIDGET] [GENERATION] productData type:", typeof productData);
      console.log("[TRYON_WIDGET] [GENERATION] productData keys:", productData ? Object.keys(productData) : "null");
      console.log("[TRYON_WIDGET] [GENERATION] productId:", productId, "type:", typeof productId);
      console.log("[TRYON_WIDGET] [GENERATION] productTitle:", productTitle, "type:", typeof productTitle);
      console.log("[TRYON_WIDGET] [GENERATION] productUrl:", productUrl, "type:", typeof productUrl);
      console.log("[TRYON_WIDGET] [GENERATION] selectedVariantId:", selectedVariantId, "type:", typeof selectedVariantId);
      console.log("[TRYON_WIDGET] [GENERATION] productInfo:", productInfo);
      console.log("[TRYON_WIDGET] [GENERATION] willSendProductInfo:", !!productInfo);
      
      // Also check window objects directly
      try {
        if (typeof window !== "undefined") {
          console.log("[TRYON_WIDGET] [GENERATION] window.NUSENSE_PRODUCT_DATA:", (window as any)?.NUSENSE_PRODUCT_DATA);
          if (window.parent !== window) {
            try {
              console.log("[TRYON_WIDGET] [GENERATION] window.parent.NUSENSE_PRODUCT_DATA:", (window.parent as any)?.NUSENSE_PRODUCT_DATA);
            } catch (e) {
              console.log("[TRYON_WIDGET] [GENERATION] Cannot access window.parent (cross-origin):", e);
            }
          }
        }
      } catch (e) {
        console.warn("[TRYON_WIDGET] [GENERATION] Error checking window objects:", e);
      }
      console.log("[TRYON_WIDGET] [GENERATION] ==========================================");

      // Both clothingKey and personKey are sent to the API when available
      // - clothingKey: sent when product image has an ID
      // - personKey: sent when a demo picture is used (fixed IDs: demo_person_1, demo_person_2, etc.)
      // - version: optional version parameter (1 or 2)
      // - customerInfo: optional customer information if customer is logged in
      // - productInfo: optional product information (productId, productTitle, productUrl, variantId)
      const result: TryOnResponse = await generateTryOn(
        personBlob,
        clothingBlob,
        storeDomainForApi,
        clothingKey, // Non-mandatory: sent when product image has ID
        personKey, // Non-mandatory: sent when demo picture is used
        selectedVersion, // Non-mandatory: sent when version is selected
        customerInfo, // Non-mandatory: sent when customer is logged in
        productInfo // Non-mandatory: sent when product data is available
      );

      setProgress(100);

      if (result.status === "success" && result.image) {
        setGeneratedImage(result.image);
        storage.saveGeneratedImage(result.image);
        setCurrentStep(4);
        setStatusVariant("info");
        setStatusMessage(t("tryOnWidget.status.resultReadyActions") || "Résultat prêt. Vous pouvez acheter ou télécharger.");
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
        // Send message to parent window (Shopify page) to trigger buy now
        // This will immediately redirect to checkout - navigation happens here
        const message = {
          type: "NUSENSE_BUY_NOW",
          ...(productData && { product: productData }),
        };
        window.parent.postMessage(message, "*");

        toast.info(t("tryOnWidget.resultDisplay.addingToCart") || "Ajout au panier...", {
          description: t("tryOnWidget.resultDisplay.redirectingToCheckout") || "Redirection vers la page de paiement en cours.",
        });

        // Note: For buy now, redirect happens immediately, so this timeout is just a safety
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
    storage.clearSession();
    setStatusVariant("info");
    setStatusMessage(
      t("tryOnWidget.status.initial") || "Téléchargez votre photo puis choisissez un article à essayer"
    );
    // Reset mobile step to photo selection
    setMobileStep("photo");
  };
  
  const handleResetClick = () => {
    handleReset();
  };


  const handleDownload = async (imageUrl: string) => {
    if (isDownloadLoading) return;
    setIsDownloadLoading(true);
    
    try {
      // Prepare store info for watermark
      const shopDomain = storeInfo?.shopDomain || storeInfo?.domain || reduxStoreInfo?.shop || null;
      // getShopName is the business name (for display), shopDomain is the actual domain (for API/domain field)
      const storeName = getShopName || (shopDomain ? shopDomain.replace(".myshopify.com", "") : null);
      const storeWatermarkInfo = storeName ? {
        name: storeName,
        domain: shopDomain || null, // Use shopDomain only, don't fallback to storeName (business name)
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

  const handleInstagramShare = async (event?: React.MouseEvent | React.KeyboardEvent) => {
    const imageUrl = generatedImage;
    if (isInstagramShareLoading || !imageUrl) return;

    // Prevent default to maintain user gesture context
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    // Check if Web Share API is available FIRST (synchronously)
    if (!navigator.share) {
      const isSecureContext = window.isSecureContext || location.protocol === "https:";
      const errorMessage = isSecureContext
        ? "Web Share API is not supported in this browser. Please use Chrome/Edge on desktop or any modern mobile browser."
        : "Web Share API requires HTTPS. Please access this page over HTTPS.";
      
      toast.error(t("tryOnWidget.resultDisplay.instagramShareError") || "Error sharing to Instagram", {
        description: errorMessage,
      });
      return;
    }

    // Prepare store info for watermark (synchronously)
    const shopDomain = storeInfo?.shopDomain || storeInfo?.domain || reduxStoreInfo?.shop || null;
    // getShopName is the business name (for display), shopDomain is the actual domain (for API/domain field)
    const storeName = getShopName || (shopDomain ? shopDomain.replace(".myshopify.com", "") : null);
    const cacheKey = `${imageUrl}_${storeName || 'default'}`;
    const cached = watermarkedBlobCacheRef.current;
    
    // Check if blob is ready (must be synchronous check)
    if (!cached || cached.imageUrl !== cacheKey || (Date.now() - cached.timestamp) >= CACHE_DURATION) {
      // Blob not ready - show message and process
      setIsInstagramShareLoading(true);
      toast.info("Preparing image for sharing...", {
        description: "Please wait a moment, then try again.",
      });
      
      const storeWatermarkInfo = storeName ? {
        name: storeName,
        domain: shopDomain || null, // Use shopDomain only, don't fallback to storeName (business name)
        logoUrl: null,
      } : null;
      
      try {
        const blob = await addWatermarkToImage(imageUrl, storeWatermarkInfo);
        // Pre-compute share data
        const productData = getProductData();
        // getShopName already handles all fallbacks including domain cleanup
        const storeDisplayName = getShopName || "Store";
        const productTitle = productData?.title || "Product";
        const productUrl = productData?.url || window.location.href;
        
        const caption = [
          `✨ Virtual Try-On by NUSENSE`,
          ``,
          `Check out this ${productTitle} from ${storeDisplayName}!`,
          ``,
          `🔗 Shop now: ${productUrl}`,
          ``,
          `#VirtualTryOn #AIFashion #FashionTech #VirtualStyling #TryBeforeYouBuy #FashionAI #DigitalFashion #VirtualReality #FashionTech #Shopify #Ecommerce #Fashion #Style #Outfit #Clothing #Fashionista #InstaFashion #FashionBlogger #StyleInspo #OOTD #FashionLover #FashionAddict #FashionStyle #FashionDesign #FashionWeek #FashionTrends #FashionForward #Fashionable #FashionableStyle #FashionableLife`,
        ].join("\n");

        watermarkedBlobCacheRef.current = {
          imageUrl: cacheKey,
          blob: blob,
          timestamp: Date.now(),
          shareData: {
            title: productTitle,
            text: caption,
            url: productUrl,
          },
        };
        setIsWatermarkReady(true);
        setIsInstagramShareLoading(false);
        toast.success("Image ready!", {
          description: "Please click the share button again to share.",
        });
      } catch (error) {
        setIsInstagramShareLoading(false);
        toast.error("Failed to prepare image", {
          description: "Please try again.",
        });
      }
      return; // Exit - user needs to click again
    }

    // Blob is ready - proceed with share IMMEDIATELY (synchronously)
    // Use pre-computed share data to minimize work on click
    const blob = cached.blob;
    const shareData = cached.shareData || {
      title: "Product",
      text: "✨ Virtual Try-On by NUSENSE",
      url: window.location.href,
    };

    // Create file IMMEDIATELY (synchronously) - minimal work before share call
    const file = new File([blob], `virtual-tryon-${Date.now()}.png`, { type: "image/png" });
    
    // Check if file sharing is supported (synchronously)
    let canShareFile = false;
    if (navigator.canShare) {
      try {
        canShareFile = navigator.canShare({ files: [file] });
      } catch (canShareError) {
        canShareFile = false;
      }
    }
    
    // Call navigator.share IMMEDIATELY (within user gesture context)
    // BEFORE any state updates to maintain gesture context
    // No await - use .then() to maintain gesture context
    if (canShareFile) {
      // Share with file - call immediately
      setIsInstagramShareLoading(true);
      navigator.share({
        files: [file],
        title: shareData.title,
        text: shareData.text,
      }).then(() => {
        setIsInstagramShareLoading(false);
        toast.success(t("tryOnWidget.resultDisplay.instagramOpened") || "Share sheet opened!", {
          description: t("tryOnWidget.resultDisplay.shareSheetOpenedDescription") || "Select Instagram from the share options. Image and caption are ready!",
        });
      }).catch((shareError: any) => {
        setIsInstagramShareLoading(false);
        if (shareError.name === "AbortError") {
          return; // User cancelled
        }
        if (shareError.name === "NotAllowedError") {
          toast.error("Permission denied", {
            description: "The share must be triggered directly by your click. Please try clicking the share button again.",
          });
          return;
        }
        toast.error(t("tryOnWidget.resultDisplay.instagramShareError") || "Error sharing to Instagram", {
          description: `Sharing failed: ${shareError.message || "Unknown error"}.`,
        });
      });
    } else {
      // File sharing not supported - try text/URL only
      const imageDataUrl = URL.createObjectURL(blob);
      setIsInstagramShareLoading(true);
      navigator.share({
        title: shareData.title,
        text: `${shareData.text}\n\nImage: ${imageDataUrl}`,
        url: shareData.url,
      }).then(() => {
        setIsInstagramShareLoading(false);
        toast.success(t("tryOnWidget.resultDisplay.instagramOpened") || "Share sheet opened!", {
          description: t("tryOnWidget.resultDisplay.shareSheetOpenedDescription") || "Select Instagram from the share options. Image link and caption are ready!",
        });
        setTimeout(() => URL.revokeObjectURL(imageDataUrl), 1000);
      }).catch((shareError: any) => {
        setIsInstagramShareLoading(false);
        URL.revokeObjectURL(imageDataUrl);
        if (shareError.name === "AbortError") {
          return; // User cancelled
        }
        if (shareError.name === "NotAllowedError") {
          toast.error("Permission denied", {
            description: "The share must be triggered directly by your click. Please try clicking the share button again.",
          });
          return;
        }
        toast.error(t("tryOnWidget.resultDisplay.instagramShareError") || "Error sharing to Instagram", {
          description: `Sharing failed: ${shareError.message || "Unknown error"}.`,
        });
      });
    }
  };

  // Restore clothingKey when images are loaded (for saved state)
  useEffect(() => {
    if (
      selectedClothing &&
      singleTabAvailableImagesWithIds.size > 0 &&
      !selectedClothingKey
    ) {
      const clothingId = singleTabAvailableImagesWithIds.get(selectedClothing);
      if (clothingId) {
        setSelectedClothingKey(clothingId);
      }
    }
  }, [selectedClothing, singleTabAvailableImagesWithIds, selectedClothingKey]);

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
  // Check if we're inside an iframe
  const isInIframe = typeof window !== "undefined" && window.parent !== window;

  // Check if store is vto-demo (only show tabs for vto-demo store)
  const shopDomain = storeInfo?.shopDomain || storeInfo?.domain || reduxStoreInfo?.shop;
  const normalizedShopDomain = shopDomain ? shopDomain.replace(".myshopify.com", "") : null;

  const isSingleTabImagesLoading =
    isInIframe && singleTabImages.length === 0;

  // Get login URL - Universal compatibility for ALL stores
  // Uses Shopify's routes.storefront_login_url (injected via Liquid) when available
  // Falls back to /customer_authentication/login for legacy stores
  // This works for: legacy customer accounts, new Customer Account API, all themes
  const getLoginUrl = (): string => {
    try {
      // First, try to get the universal login URL from Liquid-injected JSON script tag
      // This works for ALL stores regardless of customer account type
      try {
        const loginUrlScript = document.getElementById('nusense-login-url-info');
        if (loginUrlScript && loginUrlScript.textContent) {
          const loginUrlData = JSON.parse(loginUrlScript.textContent);
          // routes.storefront_login_url automatically returns to the page where login originated
          // This is the recommended Shopify approach for universal compatibility
          if (loginUrlData?.storefrontLoginUrl) {
            return loginUrlData.storefrontLoginUrl;
          }
          // Fallback to account_login_url if storefront_login_url not available
          if (loginUrlData?.accountLoginUrl) {
            return loginUrlData.accountLoginUrl;
          }
        }
      } catch (parseError) {
        console.warn('[TryOnWidget] Error parsing login URL from Liquid:', parseError);
      }
      
      // Fallback: Construct login URL manually using storefront login path
      // This works for legacy customer accounts (most common scenario)
      const storeOriginInfo = detectStoreOrigin();
      const storeOrigin = storeOriginInfo.origin || storeOriginInfo.fullUrl;
      
      // Get the page where widget is embedded (parent if in iframe, current if not)
      let returnPagePath = window.location.pathname;
      
      if (window.parent !== window) {
        // In iframe: try to get parent page path
        try {
          const referrer = document.referrer;
          if (referrer) {
            try {
              const referrerUrl = new URL(referrer);
              returnPagePath = referrerUrl.pathname + referrerUrl.search;
            } catch {
              // Invalid referrer URL, use current path
            }
          }
        } catch {
          // Cannot access parent, use current path
        }
      }
      
      // Ensure return_to is relative (starts with /) as required by Shopify
      const returnTo = returnPagePath.startsWith('/') ? returnPagePath : `/${returnPagePath}`;
      
      if (storeOrigin) {
        // Use /customer_authentication/login for storefront login (works for legacy accounts)
        // This path works on ALL Shopify stores with customer accounts enabled
        const loginUrl = new URL("/customer_authentication/login", storeOrigin);
        loginUrl.searchParams.set("return_to", returnTo);
        return loginUrl.toString();
      }
      
      // Fallback: try to detect from parent window or referrer
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
      
      // Final fallback: relative path (will work if on same domain)
      const loginUrl = new URL("/customer_authentication/login", window.location.origin);
      loginUrl.searchParams.set("return_to", returnTo);
      return loginUrl.toString();
    } catch (error) {
      console.error("[TryOnWidget] Error constructing login URL:", error);
      // Final fallback to relative path
      return "/customer_authentication/login";
    }
  };

  const [isRedirecting, setIsRedirecting] = useState(false);

  // Tutorial demo animation state - 4 steps
  const [tutorialStep, setTutorialStep] = useState<1 | 2 | 3 | 4>(1); // 1: upload, 2: select, 3: generating, 4: result

  // Infinite loop tutorial animation
  useEffect(() => {
    if (!customerInfo?.id) {
      const interval = setInterval(() => {
        setTutorialStep((prev) => {
          if (prev === 1) return 2; // Upload → Select clothing
          if (prev === 2) return 3; // Select → Generating
          if (prev === 3) return 4; // Generating → Result
          return 1; // Result → Loop back to Upload
        });
      }, 3000); // Change step every 3 seconds

      return () => clearInterval(interval);
    }
  }, [customerInfo?.id]);

  const handleLoginClick = () => {
    setIsRedirecting(true);
    const loginUrl = getLoginUrl();
    // If in iframe, redirect parent window to login
    if (isInIframe && window.parent !== window) {
      try {
        window.parent.location.href = loginUrl;
      } catch (error) {
        // Cross-origin issue, open in new tab
        window.open(loginUrl, "_blank");
      }
    } else {
      // Redirect current window
      window.location.href = loginUrl;
    }
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
      className="w-full h-full flex flex-col bg-white max-w-full overflow-hidden overscroll-contain"
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

      {/* Fixed Header - Always visible at the top, never scrolls */}
      <header className="flex-shrink-0 z-50 bg-white px-4 sm:px-6 pt-3 sm:pt-4 pb-2 border-b border-slate-100/80 shadow-sm">
        <div className="flex justify-between items-center py-2 sm:py-2.5">
          <div className="flex flex-col items-start gap-0.5 sm:gap-1">
            <img
              src="/assets/NUSENSE_LOGO_v1.png"
              className="object-contain h-auto transition-all duration-200"
              alt={t("tryOnWidget.brand.name") || "NUSENSE"}
              aria-label={t("tryOnWidget.brand.nameAlt") || "NUSENSE - Essayage Virtuel Alimenté par IA"}
            />
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

      {/* Content Container - Below fixed header, inner sections handle their own scrolling */}
      <div className="bg-white w-full max-w-full flex-1 flex flex-col min-h-0 py-3 sm:py-4 px-4 sm:px-6 overflow-hidden">
        {/* Initial Loading Skeleton - Show only during widget opening */}
        {isInitializing ? (
          <div className="w-full flex-1 flex flex-col items-center justify-center min-h-0 overflow-hidden">
            <div className="w-full max-w-[980px] flex flex-col gap-6">
              {/* Skeleton for main content area */}
              <div className="flex flex-col md:flex-row gap-6">
                {/* Left panel skeleton */}
                <div className="flex-1 space-y-4">
                  <Skeleton className="h-8 w-48" />
                  <Skeleton className="h-4 w-64" />
                  <Skeleton className="h-[400px] w-full rounded-xl" />
                </div>
                {/* Right panel skeleton */}
                <div className="flex-1 space-y-4">
                  <Skeleton className="h-8 w-48" />
                  <Skeleton className="h-4 w-64" />
                  <div className="grid grid-cols-2 gap-4">
                    <Skeleton className="h-[200px] w-full rounded-xl" />
                    <Skeleton className="h-[200px] w-full rounded-xl" />
                    <Skeleton className="h-[200px] w-full rounded-xl" />
                    <Skeleton className="h-[200px] w-full rounded-xl" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
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
                              <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-[#564646]/10 backdrop-blur-sm flex items-center justify-center border border-[#564646]/20">
                                <Sparkles className="w-6 h-6 sm:w-8 sm:h-8 text-[#564646] animate-pulse" />
                              </div>
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
                              console.warn('[TryOnWidget] Error getting register URL:', error);
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

          {/* TryOn Content - Only show if customer is authenticated */}
          {customerInfo?.id && (
          <div className="w-full flex-1 flex flex-col min-h-0 overflow-y-auto overflow-x-hidden [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:bg-slate-300/60 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent hover:[&::-webkit-scrollbar-thumb]:bg-slate-400/60">
          {/* Content */}
          {(isGenerating || generatedImage || error) ? (
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
                          className="relative w-full max-w-full max-h-full rounded-lg overflow-hidden border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-slate-50 flex items-center justify-center shadow-sm"
                          role="status"
                          aria-live="polite"
                          aria-label={t("tryOnWidget.status.generating") || "Génération…"}
                          aria-busy="true"
                          style={{ aspectRatio: "1 / 1" }}
                        >
                          {/* Animated Skeleton with shimmer effect */}
                          <div className="absolute inset-0 rounded-lg overflow-hidden">
                            <Skeleton className="absolute inset-0 rounded-lg" />
                            {/* Subtle animated shimmer overlay */}
                            <div 
                              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                              style={{
                                transform: 'translateX(-100%)',
                                animation: 'shimmer 2s ease-in-out infinite',
                              }}
                            />
                          </div>
                          {/* Loading indicator with subtle animation */}
                          <div className="relative z-10 flex flex-col items-center justify-center space-y-4 px-6 py-4">
                            <div className="relative">
                              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-primary/10 backdrop-blur-sm flex items-center justify-center border border-primary/20 shadow-sm">
                                <Sparkles className="w-6 h-6 sm:w-7 sm:h-7 text-primary animate-pulse" aria-hidden="true" />
                              </div>
                              <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping opacity-75" />
                            </div>
                            <div className="text-center space-y-2 w-full max-w-xs">
                              <p className="text-sm sm:text-base font-semibold text-slate-700 leading-tight">
                                {t("tryOnWidget.status.generating") || "Génération…"}
                              </p>
                              <p className="text-xs sm:text-sm text-slate-500 font-normal leading-relaxed">
                                {t("tryOnWidget.status.generatingTime") || "Please wait, this usually takes 15 to 20 seconds"}
                              </p>
                            </div>
                          </div>
                          <span className="sr-only">
                            {t("tryOnWidget.status.generating") || "Génération…"}
                          </span>
                        </div>
                      ) : error ? (
                        /* Error State - Clean UI in place of generated image */
                        <div 
                          className="relative w-full max-w-full max-h-full rounded-lg overflow-hidden border border-amber-200 bg-gradient-to-br from-amber-50 via-orange-50 to-amber-50 flex flex-col items-center justify-center p-8"
                          style={{ aspectRatio: "1 / 1" }}
                          role="alert"
                          aria-live="assertive"
                        >
                          <div className="flex flex-col items-center justify-center text-center space-y-4">
                            <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center">
                              <WifiOff className="w-8 h-8 text-amber-600" aria-hidden="true" />
                            </div>
                            <div className="space-y-2">
                              <h3 className="text-lg font-semibold text-slate-800">
                                {t("tryOnWidget.errors.connectionErrorTitle") || "Oups ! Un problème est survenu"}
                              </h3>
                              <p className="text-sm text-slate-600 max-w-[280px] leading-relaxed">
                                {t("tryOnWidget.errors.connectionErrorDescription") || "La génération n'a pas pu aboutir. Veuillez vérifier votre connexion et réessayer."}
                              </p>
                            </div>
                            <Button
                              onClick={handleRetryGeneration}
                              className="mt-2 bg-amber-600 hover:bg-amber-700 text-white px-6 h-11 rounded-lg shadow-sm hover:shadow-md transition-all duration-200"
                              aria-label={t("tryOnWidget.buttons.retry") || "Réessayer"}
                            >
                              <RotateCcw className="w-4 h-4 mr-2" aria-hidden="true" />
                              {t("tryOnWidget.buttons.retry") || "Réessayer"}
                            </Button>
                          </div>
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
                          {/* Floating action buttons - Temporarily hidden */}
                          {/* <div className="absolute top-3 right-3 flex gap-2 z-10">
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
                              onClick={(e) => handleInstagramShare(e)}
                              disabled={isGenerating || isBuyNowLoading || isAddToCartLoading || isDownloadLoading || isInstagramShareLoading || !generatedImage || !isWatermarkReady}
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
                          </div> */}
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
                      {uploadedImage && (
                        <div className="flex-1 rounded-xl bg-white border border-border overflow-hidden p-4 flex items-center justify-center min-h-0 max-h-[17rem]">
                          <img
                            src={uploadedImage}
                            alt={t("tryOnWidget.ariaLabels.uploadedPhoto") || "Photo téléchargée pour l'essayage virtuel"}
                            className="max-h-full max-w-full w-auto h-auto object-contain"
                          />
                        </div>
                      )}
                      {selectedClothing && (
                        <div className="flex-1 rounded-xl bg-white border border-border overflow-hidden p-4 flex items-center justify-center min-h-0 max-h-[17rem]">
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
                    </div>
                  </div>
                  
                  {/* Action buttons - Positioned at bottom, consistent with first step */}
                  <div className="flex flex-col items-end w-full flex-shrink-0 gap-3 mt-4">
                    <div className="flex items-start gap-4 w-full justify-end flex-wrap">
                      <Button
                        onClick={handleResetClick}
                        variant="outline"
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
                        variant="outline"
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
                        variant="outline"
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

                {/* Context Section: Person Image + Clothing Image (Mobile only) - Show during generation, after result, and during error */}
                {(isGenerating || generatedImage || error) && uploadedImage && selectedClothing && (
                  <div className="flex flex-col gap-2 mb-4">
                    {/* Context Images - Side by side, fit within mobile width */}
                    <div className="flex items-stretch gap-2 sm:gap-3 self-stretch w-full">
                      {/* Person Image */}
                      <div className="relative flex-1 rounded-xl bg-white border border-border overflow-hidden p-2 sm:p-3 flex items-center justify-center">
                        <img
                          src={uploadedImage}
                          alt={t("tryOnWidget.ariaLabels.uploadedPhoto") || "Photo téléchargée pour l'essayage virtuel"}
                          className="w-full h-auto object-contain"
                        />
                        {/* Subtle loading overlay during generation */}
                        {isGenerating && (
                          <div className="absolute inset-0 bg-primary/5 flex items-center justify-center pointer-events-none" aria-hidden="true">
                            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin opacity-60" />
                          </div>
                        )}
                      </div>
                      {/* Clothing Image */}
                      <div className="relative flex-1 rounded-xl bg-white border border-border overflow-hidden p-2 sm:p-3 flex items-center justify-center">
                        <img
                          src={selectedClothing}
                          alt={
                            t("tryOnWidget.clothingSelection.selectedClothingAlt") ||
                            "Vêtement actuellement sélectionné pour l'essayage virtuel"
                          }
                          className="w-full h-auto object-contain"
                        />
                        {/* Subtle loading overlay during generation */}
                        {isGenerating && (
                          <div className="absolute inset-0 bg-primary/5 flex items-center justify-center pointer-events-none" aria-hidden="true">
                            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin opacity-60" />
                          </div>
                        )}
                      </div>
                    </div>
                    {/* Visual Connector - Only show when generating or showing result (not error) */}
                    {(isGenerating || generatedImage) && !error && (
                      <div className="flex items-center justify-center py-1.5" aria-hidden="true">
                        <div className="w-px h-4 bg-slate-300" />
                        <Sparkles className="w-3.5 h-3.5 text-primary mx-2 animate-pulse" />
                        <div className="w-px h-4 bg-slate-300" />
                      </div>
                    )}
                  </div>
                )}

                {/* Generated Image or Error State */}
                {isGenerating ? (
                  <div
                    className="relative self-stretch min-h-[400px] max-h-[600px] mb-8 rounded-xl overflow-hidden border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-slate-50 shadow-sm"
                    role="status"
                    aria-live="polite"
                    aria-label={t("tryOnWidget.status.generating") || "Génération…"}
                    aria-busy="true"
                  >
                    {/* Animated Skeleton with shimmer effect */}
                    <div className="absolute inset-0 rounded-xl overflow-hidden">
                      <Skeleton className="absolute inset-0 rounded-xl" />
                      {/* Subtle animated shimmer overlay */}
                      <div 
                        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                        style={{
                          transform: 'translateX(-100%)',
                          animation: 'shimmer 2s ease-in-out infinite',
                        }}
                      />
                    </div>
                    {/* Loading indicator with subtle animation */}
                    <div className="relative z-10 flex flex-col items-center justify-center h-full min-h-[400px] space-y-6 px-6 py-8">
                      <div className="relative">
                        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-primary/10 backdrop-blur-sm flex items-center justify-center border border-primary/20 shadow-sm">
                          <Sparkles className="w-7 h-7 sm:w-8 sm:h-8 text-primary animate-pulse" aria-hidden="true" />
                        </div>
                        <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping opacity-75" />
                      </div>
                      <div className="text-center px-6 space-y-2 w-full max-w-sm">
                        <p className="text-base sm:text-lg font-semibold text-slate-700 leading-tight">
                          {t("tryOnWidget.status.generating") || "Génération…"}
                        </p>
                        <p className="text-xs sm:text-sm text-slate-500 font-normal leading-relaxed">
                          {t("tryOnWidget.status.generatingTime") || "Please wait, this usually takes 15 to 20 seconds"}
                        </p>
                      </div>
                    </div>
                    <span className="sr-only">
                      {t("tryOnWidget.status.generating") || "Génération…"}
                    </span>
                  </div>
                ) : error ? (
                  /* Error State - Clean UI in place of generated image (Mobile/Compact) */
                  <div 
                    className="relative self-stretch min-h-[320px] mb-8 rounded-xl overflow-hidden border border-amber-200 bg-gradient-to-br from-amber-50 via-orange-50 to-amber-50 flex flex-col items-center justify-center p-6"
                    role="alert"
                    aria-live="assertive"
                  >
                    <div className="flex flex-col items-center justify-center text-center space-y-4">
                      <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center">
                        <WifiOff className="w-7 h-7 text-amber-600" aria-hidden="true" />
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-base font-semibold text-slate-800">
                          {t("tryOnWidget.errors.connectionErrorTitle") || "Oups ! Un problème est survenu"}
                        </h3>
                        <p className="text-sm text-slate-600 max-w-[260px] leading-relaxed">
                          {t("tryOnWidget.errors.connectionErrorDescription") || "La génération n'a pas pu aboutir. Veuillez vérifier votre connexion et réessayer."}
                        </p>
                      </div>
                      <Button
                        onClick={handleRetryGeneration}
                        className="mt-2 bg-amber-600 hover:bg-amber-700 text-white px-6 h-10 rounded-lg shadow-sm hover:shadow-md transition-all duration-200"
                        aria-label={t("tryOnWidget.buttons.retry") || "Réessayer"}
                      >
                        <RotateCcw className="w-4 h-4 mr-2" aria-hidden="true" />
                        {t("tryOnWidget.buttons.retry") || "Réessayer"}
                      </Button>
                    </div>
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
                    {/* Floating action buttons - Temporarily hidden */}
                    {/* <div className="absolute top-3 right-3 flex gap-2 z-10">
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
                        onClick={(e) => handleInstagramShare(e)}
                        disabled={isGenerating || isBuyNowLoading || isAddToCartLoading || isDownloadLoading || isInstagramShareLoading || !generatedImage || !isWatermarkReady}
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
                    </div> */}
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
                    variant="outline"
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
                  layoutMode === "wide" ? "max-w-full px-2 pt-3 flex-1" : "flex-1"
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
                  layoutMode !== "wide" ? "flex-1 min-h-[360px]" : "flex-1"
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
                        variant="outline"
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
            /* Result buttons: Mobile - Stacked vertically, ordered by priority */
            <div className="flex flex-col self-stretch mb-8 gap-4">
              {/* Primary Action: Add to Cart - Only show when result is ready */}
              {generatedImage && (
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
              )}

              {/* Secondary Action: Buy Now - Only show when result is ready */}
              {generatedImage && (
                <Button
                  onClick={handleBuyNow}
                  disabled={isGenerating || isBuyNowLoading || isAddToCartLoading || isDownloadLoading || isInstagramShareLoading}
                  variant="outline"
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
              )}

              {/* Tertiary Action: Retry - Show during generation or after result */}
              <Button
                onClick={handleRetryGeneration}
                variant="outline"
                disabled={!selectedClothing || !uploadedImage || isGenerating}
                className="w-full h-11"
                aria-label={t("tryOnWidget.buttons.retry") || "Réessayer"}
                aria-busy={isGenerating}
              >
                <Sparkles className="w-5 h-5 mr-2" aria-hidden="true" />
                {t("tryOnWidget.buttons.retry") || "Réessayer"}
              </Button>

              {/* Last Action: Reset - Destructive action, always available */}
              <Button
                onClick={handleResetClick}
                variant="outline"
                disabled={isGenerating}
                className="w-full h-11"
                aria-label={t("tryOnWidget.buttons.reset") || "Réinitialiser l'application"}
                aria-busy={isGenerating}
              >
                <RotateCcw className="w-5 h-5 mr-2" aria-hidden="true" />
                {t("tryOnWidget.buttons.reset") || "Réinitialiser"}
              </Button>
            </div>
          )}

        </div>
        )}
        </>
        )}
        </div>
      
    </div>
  );
}
