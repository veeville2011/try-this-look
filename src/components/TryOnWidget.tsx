import { useState, useEffect, useRef, useMemo } from "react";
import { useTranslation } from "react-i18next";
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
import { Sparkles, X, RotateCcw, XCircle, CheckCircle, Loader2, Download, ShoppingCart, CreditCard, Image as ImageIcon, Check, Filter, Grid3x3, Package, LogIn, LogOut, User } from "lucide-react";
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
import { useCustomerAuth } from "@/hooks/useCustomerAuth";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

interface TryOnWidgetProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export default function TryOnWidget({ isOpen, onClose }: TryOnWidgetProps) {
  // i18next translation hook
  const { t } = useTranslation();

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

  // Customer authentication state
  const {
    isAuthenticated,
    customer,
    loginWithShopifyCustomerPopup: handleShopifyCustomerLogin,
  } = useCustomerAuth();

  // Simple logout function for app proxy approach (clears localStorage)
  const handleLogout = () => {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        localStorage.removeItem("shopify_customer_data");
      }
      // Reload to clear state
      window.location.reload();
    } catch (error) {
      console.error("[TryOnWidget] Logout failed:", error);
    }
  };

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
        return singleTabImagesWithIds;
      case "multiple":
        return multipleTabImagesWithIds;
      case "look":
        return lookTabImagesWithIds;
      default:
        return singleTabImagesWithIds;
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
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusVariant, setStatusVariant] = useState<"info" | "error">("info");
  const [storeInfo, setStoreInfo] = useState<StoreInfo | null>(null);
  const [activeTab, setActiveTab] = useState<"single" | "multiple" | "look">("single");
  
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
  
  // Derive store_products from Redux state for backward compatibility
  const store_products = reduxCategories.length > 0 || reduxUncategorized
    ? {
        categories: reduxCategories,
        uncategorized: reduxUncategorized || {
          categoryName: "Uncategorized",
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
  console.log({ storeInfo });
  // Set initial status message
  useEffect(() => {
    if (!statusMessage) {
      setStatusMessage(t("tryOnWidget.status.initial") || "Téléchargez votre photo puis choisissez un article à essayer");
    }
  }, [t, statusMessage]);

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

  // Listen for postMessage events from popup authentication
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      // Handle Shopify customer login messages (from storefront domain via app proxy)
      if (event.data?.type === "SHOPIFY_CUSTOMER_LOGIN_SUCCESS") {
        // Accept messages from storefront domains (shopify.com, myshopify.com, or custom domains)
        // Also accept from app proxy backend (try-this-look.vercel.app or localhost)
        const isStorefrontOrigin = event.origin.includes("myshopify.com") || 
                                   event.origin.includes("shopify.com") ||
                                   event.origin.includes("shopifycdn.com") ||
                                   event.origin.includes("try-this-look.vercel.app") ||
                                   event.origin.includes("localhost") ||
                                   event.origin.includes("127.0.0.1") ||
                                   // Allow custom domains (check if it's a valid URL)
                                   (event.origin.startsWith("http://") || event.origin.startsWith("https://"));
        
        if (!isStorefrontOrigin) {
          console.warn("[TryOnWidget] Ignoring SHOPIFY_CUSTOMER_LOGIN_SUCCESS from unexpected origin:", event.origin);
          return;
        }

        try {
          const customerData = event.data.customer;
          
          // Handle both cases: after login and already logged in
          // For password-protected stores, customerData.id might be null, but authenticated will be true
          // For proxied requests, we'll have customerData.id from Shopify
          if (customerData && customerData.authenticated) {
            // Store customer info in localStorage for persistence
            // Even if ID is missing (password-protected stores), we store the authenticated state
            try {
              if (typeof window !== "undefined" && window.localStorage) {
                localStorage.setItem("shopify_customer_data", JSON.stringify({
                  ...customerData,
                  loginMethod: "shopify_customer",
                  loginTime: new Date().toISOString(),
                  // For password-protected stores, we might not have customer ID
                  // but we know they're authenticated since they reached the callback
                  authenticated: true
                }));
                // Dispatch custom event to notify useCustomerAuth hook
                window.dispatchEvent(new Event("shopify_customer_data_updated"));
              }
            } catch (e) {
              console.warn("[TryOnWidget] Could not store customer data:", e);
            }

            // Show success message
            toast.success(t("tryOnWidget.messages.loginSuccess") || "Connexion réussie!");
            
            // Log for debugging
            console.log("[TryOnWidget] Shopify customer login successful:", {
              customerId: customerData.id || "unknown (password-protected store)",
              email: customerData.email || "unknown",
              origin: event.origin,
              hasCustomerId: !!customerData.id
            });

            // Refresh the page after successful login to update the UI state
            // This ensures the widget reflects the logged-in state and any customer-specific data
            // Works for both "after login" and "already logged in" cases
            // Use a small delay to allow the toast message to be visible
            setTimeout(() => {
              window.location.reload();
            }, 1000); // 1 second delay to show success message

            // Note: Since we're using Shopify customer login (not Customer Account API OAuth),
            // we don't have a session token. The widget can use the customer ID/email
            // to identify the customer for API calls. For password-protected stores,
            // customer ID might not be available, but the customer is authenticated.
          } else {
            toast.error(t("tryOnWidget.errors.authenticationFailed") || "Échec de l'authentification");
            console.warn("[TryOnWidget] Customer login failed - not authenticated:", customerData);
          }
        } catch (error) {
          console.error("[TryOnWidget] Failed to handle Shopify customer login:", error);
          toast.error(t("tryOnWidget.errors.authenticationFailed") || "Échec de l'authentification");
        }
        return;
      }
    };

    // Add event listener
    window.addEventListener("message", handleMessage);

    // Cleanup
    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, [t]);

  useEffect(() => {
    const savedImage = storage.getUploadedImage();
    const savedClothing = storage.getClothingUrl();
    const savedResult = storage.getGeneratedImage();
    if (savedImage) {
      setUploadedImage(savedImage);
      setCurrentStep(2);
      setStatusMessage(t("tryOnWidget.status.photoUploaded") || "Photo chargée. Sélectionnez un vêtement.");
    }
    if (savedClothing) {
      setSelectedClothing(savedClothing);
      setStatusMessage(t("tryOnWidget.status.readyToGenerate") || "Prêt à générer. Cliquez sur Générer Image.");
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
          setSingleTabImages(imageUrls);
          setSingleTabImagesWithIds(imageIdMap);
          imagesLoadedRef.current = true;

          // Debug logging
          if (imageIdMap.size > 0) {
            console.log(
              "[TryOnWidget] Product images loaded:",
              imageUrls.length,
              "images,",
              imageIdMap.size,
              "with IDs"
            );
          }
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
    // Track if a demo photo was selected and its URL
    if (isDemoPhoto && demoPhotoUrl) {
      setSelectedDemoPhotoUrl(demoPhotoUrl);
      // Set personKey in Redux for key mappings
      const personKey = DEMO_PHOTO_ID_MAP.get(demoPhotoUrl);
      setReduxPersonKey(personKey || null);
    } else {
      setSelectedDemoPhotoUrl(null);
      // Clear personKey in Redux when custom photo is uploaded
      setReduxPersonKey(null);
    }
    setStatusVariant("info");
    setStatusMessage(t("tryOnWidget.status.photoUploaded") || "Photo chargée. Sélectionnez un vêtement.");
  };

  const handleClothingSelect = (imageUrl: string) => {
    setSelectedClothing(imageUrl);
    storage.saveClothingUrl(imageUrl);

    // Get the clothing ID if available (clear if imageUrl is empty)
    if (imageUrl) {
      const clothingId = singleTabImagesWithIds.get(imageUrl) || null;
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
      setIsGenerating(false);
      try {
        localStorage.removeItem(INFLIGHT_KEY);
      } catch {}
    }
  };

  const handleGenerate = () => {
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
    // Clear personKey in Redux
    setReduxPersonKey(null);
    try {
      storage.clearUploadedImage();
    } catch {}
    setCurrentStep(1);
    setStatusVariant("info");
    setStatusMessage(t("tryOnWidget.status.photoCleared") || "Photo effacée. Téléchargez votre photo.");
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
    setSelectedVersion(1); // Reset version selection to default
    // Reset key mappings in Redux
    resetKeyMappings();
    storage.clearSession();
    setStatusVariant("info");
    setStatusMessage(
      t("tryOnWidget.status.initial") || "Téléchargez votre photo puis choisissez un article à essayer"
    );
    
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
  };

  const handleGarmentDeselect = (index: number) => {
    const newGarments = selectedGarments.filter((_, i) => i !== index);
    setSelectedGarments(newGarments);
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

      // Fetch all garment images
      const garmentBlobs: Blob[] = [];
      const garmentKeys: string[] = [];

      for (const garment of selectedGarments) {
        try {
          const response = await fetch(garment.url);
          const blob = await response.blob();
          garmentBlobs.push(blob);

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
                  reject(new Error("Could not get canvas context"));
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
      singleTabImagesWithIds.size > 0 &&
      !selectedClothingKey
    ) {
      const clothingId = singleTabImagesWithIds.get(selectedClothing);
      if (clothingId) {
        setSelectedClothingKey(clothingId);
      }
    }
  }, [activeTab, selectedClothing, singleTabImagesWithIds, selectedClothingKey]);

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
  const isVtoDemoStore = shopDomain && shopDomain.includes("vto-demo-store");

  // Force activeTab to "single" for non-vto-demo stores
  useEffect(() => {
    if (!isVtoDemoStore && activeTab !== "single") {
      setActiveTab("single");
    }
  }, [isVtoDemoStore, activeTab]);

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

      {/* Header */}
      <header className="sticky top-0 z-10 bg-card/80 backdrop-blur-sm px-3 py-2 sm:px-4 sm:py-3 md:px-5 md:py-4 border-b border-border shadow-sm">
        <div className="flex items-center justify-between gap-2 sm:gap-3">
          <div className="inline-flex flex-col flex-shrink-0 min-w-0">
            <h1
              className="inline-flex items-center tracking-wide leading-none whitespace-nowrap text-2xl sm:text-3xl md:text-4xl font-bold"
              aria-label={t("tryOnWidget.brand.ariaLabel") || "NULOOK - Essayage Virtuel Alimenté par IA"}
            >
              <span style={{ color: "#ce0003" }} aria-hidden="true">
                NU
              </span>
              <span style={{ color: "#564646" }} aria-hidden="true">
                LOOK
              </span>
            </h1>
            <p className="mt-0.5 sm:mt-1 text-left leading-tight tracking-tight whitespace-nowrap text-[10px] sm:text-xs md:text-sm text-[#3D3232] font-medium">
              {t("tryOnWidget.brand.subtitle") || "Essayage Virtuel Alimenté par IA"}
            </p>
          </div>
          <div className="flex items-center gap-2 sm:gap-2.5 md:gap-3 flex-shrink-0">
            {!isGenerating && (
              <Button
                variant="secondary"
                size="sm"
                onClick={handleReset}
                className="group text-secondary-foreground hover:bg-secondary/80 transition-all duration-200 text-xs sm:text-sm px-3 sm:px-4 h-[44px] sm:h-9 md:h-10 whitespace-nowrap shadow-sm hover:shadow-md gap-2 flex items-center focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                aria-label={t("tryOnWidget.buttons.reset") || "Réinitialiser l'application"}
              >
                <RotateCcw
                  className="h-3.5 w-3.5 sm:h-4 sm:w-4 transition-transform group-hover:rotate-[-120deg] duration-500"
                  aria-hidden="true"
                />
                <span>{t("tryOnWidget.buttons.reset") || "Réinitialiser"}</span>
              </Button>
            )}
            <LanguageSwitcher />
            <Button
              variant="destructive"
              size="icon"
              onClick={handleClose}
              className="h-[44px] w-[44px] sm:h-9 sm:w-9 md:h-10 md:w-10 rounded-md bg-error text-error-foreground hover:bg-error/90 border-error transition-all duration-200 group shadow-sm hover:shadow-md focus-visible:ring-2 focus-visible:ring-error focus-visible:ring-offset-2"
              aria-label={t("tryOnWidget.buttons.close") || "Fermer l'application"}
              title={t("tryOnWidget.buttons.close") || "Fermer"}
            >
              <X
                className="h-4 w-4 sm:h-5 sm:w-5 transition-transform group-hover:rotate-90 duration-300"
                aria-hidden="true"
              />
            </Button>
          </div>
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
          setActiveTab(newTab);
          
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
        }}
        className="w-full"
      >
        {/* Tabs Navigation - Only show for vto-demo store */}
        {isVtoDemoStore && (
          <section
            className="px-3 sm:px-4 md:px-5 lg:px-6 pt-2 sm:pt-3"
            aria-label={t("tryOnWidget.tabs.ariaLabel") || "Mode d'essayage"}
          >
            <TabsList className="w-full grid grid-cols-3 bg-muted/50 h-auto p-1">
              <TabsTrigger
                value="single"
                className="px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm transition-all duration-200 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                aria-label={t("tryOnWidget.tabs.single.ariaLabel") || "Try on a single item"}
              >
                {t("tryOnWidget.tabs.single.label") || "TryOn"}
              </TabsTrigger>
              <TabsTrigger
                value="multiple"
                className="px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm transition-all duration-200 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                aria-label={t("tryOnWidget.tabs.multiple.ariaLabel") || "Try multiple items from cart"}
              >
                {t("tryOnWidget.tabs.multiple.label") || "TryCart"}
              </TabsTrigger>
              <TabsTrigger
                value="look"
                className="px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm transition-all duration-200 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                aria-label={t("tryOnWidget.tabs.look.ariaLabel") || "Try a complete outfit"}
              >
                {t("tryOnWidget.tabs.look.label") || "TryOutfit"}
              </TabsTrigger>
            </TabsList>
          </section>
        )}

      {/* Content */}
      <div className="p-3 sm:p-4 md:p-5 lg:p-6 space-y-4 sm:space-y-5 md:space-y-6">
        {/* Try Single Tab - Current UI */}
        <TabsContent value="single" className="mt-0 space-y-4 sm:space-y-5 md:space-y-6">
        {/* Selection sections - always visible */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5 md:gap-6">
          {/* Left Panel: Upload / Preview */}
          <section aria-labelledby="upload-heading" className="flex flex-col">
            <Card className="p-3 sm:p-4 md:p-5 border-border bg-card flex flex-col h-[600px] sm:h-[700px] md:h-[800px]">
              <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4 flex-shrink-0">
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
                    {t("tryOnWidget.sections.uploadPhoto.title") || "Téléchargez Votre Photo"}
                  </h2>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">
                    {t("tryOnWidget.sections.uploadPhoto.description") || "Choisissez une photo claire de vous-même"}
                  </p>
                </div>
              </div>

              <div className="flex-1 flex flex-col min-h-0">
                {!uploadedImage && (
                  <div className="flex-1 flex items-center justify-center">
                    <PhotoUpload
                      onPhotoUpload={handlePhotoUpload}
                      generatedPersonKeys={generatedPersonKeys}
                      matchingPersonKeys={personKeys}
                    />
                  </div>
                )}

                {uploadedImage && (
                  <div className="relative rounded-lg bg-card p-2 sm:p-3 border border-border shadow-sm flex-1 flex flex-col min-h-0">
                    <div className="flex items-center justify-between mb-2 gap-2 flex-shrink-0">
                      <h3 className="font-semibold text-sm sm:text-base">
                        {t("tryOnWidget.sections.yourPhoto.title") || "Votre Photo"}
                      </h3>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleClearUploadedImage}
                        className="group h-8 sm:h-9 px-2.5 sm:px-3 text-xs sm:text-sm flex-shrink-0 gap-1.5 border-border text-foreground hover:bg-muted hover:border-muted-foreground/20 hover:text-muted-foreground transition-all duration-200 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                        aria-label={t("tryOnWidget.buttons.clearPhoto") || "Effacer la photo téléchargée"}
                        aria-describedby="upload-heading"
                      >
                        <XCircle
                          className="h-3.5 w-3.5 sm:h-4 sm:w-4 transition-transform group-hover:scale-110 duration-200"
                          aria-hidden="true"
                        />
                        <span>{t("tryOnWidget.buttons.clear") || "Effacer"}</span>
                      </Button>
                    </div>
                    <div className="relative flex-1 rounded overflow-hidden border border-border bg-card flex items-center justify-center shadow-sm min-h-0">
                      <img
                        src={uploadedImage}
                        alt={t("tryOnWidget.ariaLabels.uploadedPhoto") || "Photo téléchargée pour l'essayage virtuel"}
                        className="h-full w-auto object-contain max-h-full"
                      />
                      {/* Single tick indicator with outlined circle for generated demo photos */}
                      {selectedDemoPhotoUrl &&
                        (() => {
                          const personKey =
                            DEMO_PHOTO_ID_MAP.get(selectedDemoPhotoUrl);
                          const isPersonGenerated =
                            personKey &&
                            generatedPersonKeys.has(String(personKey));

                          // Check if both person and clothing keys exist in the same record
                          const clothingKey = selectedClothing
                            ? singleTabImagesWithIds.get(selectedClothing)
                            : null;
                          const areBothGenerated =
                            personKey &&
                            clothingKey &&
                            generatedKeyCombinations.has(
                              `${String(personKey)}-${String(clothingKey)}`
                            );

                          return (
                            isPersonGenerated && (
                              <div className="absolute top-2 right-2">
                                <CheckCircle
                                  className={`h-5 w-5 sm:h-6 sm:w-6 fill-background ${
                                    areBothGenerated
                                      ? "text-green-500"
                                      : "text-primary"
                                  }`}
                                  aria-hidden="true"
                                />
                                <span className="sr-only">
                                  {t("tryOnWidget.ariaLabels.photoAlreadyGenerated") || "Cette photo a déjà été générée"}
                                </span>
                              </div>
                            )
                          );
                        })()}
                    </div>
                  </div>
                )}
              </div>
            </Card>
          </section>

          {/* Right Panel: Clothing Selection */}
          <section aria-labelledby="clothing-heading" className="flex flex-col">
            <Card className="p-3 sm:p-4 md:p-5 border-border bg-card flex flex-col h-[600px] sm:h-[700px] md:h-[800px]">
              <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4 flex-shrink-0">
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
                    {t("tryOnWidget.sections.selectClothing.title") || "Sélectionner un Article de Vêtement"}
                  </h2>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">
                    {t("tryOnWidget.sections.selectClothing.description") || "Sélectionnez un article de vêtement sur cette page"}
                  </p>
                </div>
              </div>

              <div className="flex-1 flex flex-col min-h-0">
                <ClothingSelection
                  images={singleTabImages}
                  recommendedImages={recommendedImages}
                  selectedImage={selectedClothing}
                  onSelect={handleClothingSelect}
                  onRefreshImages={handleRefreshImages}
                  availableImagesWithIds={singleTabImagesWithIds}
                  generatedClothingKeys={generatedClothingKeys}
                  generatedKeyCombinations={generatedKeyCombinations}
                  selectedDemoPhotoUrl={selectedDemoPhotoUrl}
                  demoPhotoIdMap={DEMO_PHOTO_ID_MAP}
                  matchingClothingKeys={clothingKeys}
                />
              </div>
            </Card>
          </section>
        </div>

        {/* Generate button - show when not generating */}
        {!isGenerating && (
          <div className="pt-1 sm:pt-2 flex justify-center">
            <div className="w-full max-w-md sm:max-w-lg md:max-w-xl lg:max-w-2xl">
              <Button
                onClick={handleGenerate}
                disabled={!selectedClothing || !uploadedImage || isGenerating}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground h-11 sm:h-12 md:h-14 text-sm sm:text-base md:text-lg min-h-[44px] shadow-md hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                aria-label={t("tryOnWidget.buttons.generate") || "Générer l'essayage virtuel"}
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
                {t("tryOnWidget.buttons.generateImage") || "Générer Image"}
              </Button>
              {(!selectedClothing || !uploadedImage) && (
                <p id="generate-help" className="sr-only">
                  {t("tryOnWidget.buttons.generateHelp") || "Veuillez télécharger une photo et sélectionner un vêtement pour générer l'essayage virtuel"}
                </p>
              )}
            </div>
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
            {t("tryOnWidget.sections.results.title") || "Résultats de l'essayage virtuel"}
          </h2>
          <ResultDisplay
            generatedImage={generatedImage}
            personImage={uploadedImage}
            clothingImage={selectedClothing}
            isGenerating={isGenerating}
            progress={progress}
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
                aria-label={t("tryOnWidget.buttons.retry") || "Réessayer après une erreur"}
                aria-describedby="error-message"
              >
                <RotateCcw
                  className="h-4 w-4 transition-transform group-hover:rotate-[-120deg] duration-500"
                  aria-hidden="true"
                />
                <span>{t("tryOnWidget.buttons.retry") || "Réessayer"}</span>
              </Button>
            </Card>
          </div>
        )}
        </TabsContent>

        {/* Try Multiple Tab - Cart Mode */}
        <TabsContent value="multiple" className="mt-0 space-y-4 sm:space-y-5 md:space-y-6">
            {/* Selection sections */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5 md:gap-6">
              {/* Left Panel: Upload */}
              <section aria-labelledby="upload-multiple-heading" className="flex flex-col">
                <Card className="p-3 sm:p-4 md:p-5 border-border bg-card flex flex-col h-[600px] sm:h-[700px] md:h-[800px]">
                  <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4 flex-shrink-0">
                    <div
                      className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-primary text-primary-foreground grid place-items-center font-semibold text-sm sm:text-base flex-shrink-0 shadow-sm"
                      aria-hidden="true"
                    >
                      1
      </div>
                    <div className="min-w-0 flex-1">
                      <h2
                        id="upload-multiple-heading"
                        className="text-base sm:text-lg font-semibold"
                      >
                        {t("tryOnWidget.sections.uploadPhoto.title") || "Téléchargez Votre Photo"}
                      </h2>
                      <p className="text-[10px] sm:text-xs text-muted-foreground">
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
                        />
                      </div>
                    )}

                    {cartMultipleImage && (
                      <div className="relative rounded-lg bg-card p-2 sm:p-3 border border-border shadow-sm flex-1 flex flex-col min-h-0">
                        <div className="flex items-center justify-between mb-2 gap-2 flex-shrink-0">
                          <h3 className="font-semibold text-sm sm:text-base">
                            {t("tryOnWidget.sections.yourPhoto.title") || "Votre Photo"}
                          </h3>
                          <Button
                            variant="outline"
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
                        <div className="relative flex-1 rounded overflow-hidden border border-border bg-card flex items-center justify-center shadow-sm min-h-0">
                          <img
                            src={cartMultipleImage}
                            alt={t("tryOnWidget.ariaLabels.uploadedPhoto") || "Photo téléchargée pour l'essayage virtuel"}
                            className="h-full w-auto object-contain max-h-full"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
              </section>

              {/* Right Panel: Garment Selection */}
              <section aria-labelledby="garments-multiple-heading" className="flex flex-col">
                <Card className="p-3 sm:p-4 md:p-5 border-border bg-card flex flex-col h-[600px] sm:h-[700px] md:h-[800px]">
                  <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
                    <div
                      className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-primary text-primary-foreground grid place-items-center font-semibold text-sm sm:text-base flex-shrink-0 shadow-sm"
                      aria-hidden="true"
                    >
                      2
                    </div>
                    <div className="min-w-0 flex-1">
                      <h2
                        id="garments-multiple-heading"
                        className="text-base sm:text-lg font-semibold"
                      >
                        {t("tryOnWidget.sections.selectGarments.title") || "Sélectionner les Articles"}
                      </h2>
                      <p className="text-[10px] sm:text-xs text-muted-foreground">
                        {t("tryOnWidget.sections.selectGarments.multiple.description") || "Sélectionnez 1-6 articles"}
                      </p>
                    </div>
                  </div>

                  {/* Category Filter Dropdown - Enhanced UI/UX */}
                  {isLoadingCategories && (
                    <div className="mb-4 sm:mb-5">
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
                    <div className="mb-4 sm:mb-5">
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
                    <div className="mb-4 sm:mb-5 p-4 rounded-lg border border-border bg-muted/30">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Package className="h-4 w-4" />
                        <span>{t("tryOnWidget.filters.noCategories") || "Aucune catégorie disponible"}</span>
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col flex-1 min-h-0 space-y-3 sm:space-y-4">
                    {/* Products Count & Selection Counter - Fixed Header */}
                    <div className="flex-shrink-0 space-y-2">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2">
                            <span className="text-sm sm:text-base font-semibold">
                              {t("tryOnWidget.sections.selectedGarments.title") || "Articles Sélectionnés"}
                            </span>
                            <span
                              className={`text-xs sm:text-sm px-2 py-1 rounded-full ${
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
                            <div className="flex items-center gap-1.5 text-xs sm:text-sm text-muted-foreground">
                              <Grid3x3 className="h-3.5 w-3.5" />
                              <span>
                                {multipleTabImages.length} {t("tryOnWidget.filters.availableProducts") || "produits disponibles"}
                              </span>
                            </div>
                          )}
                        </div>
                        {selectedGarments.length > 0 && (
                          <Button
                            variant="outline"
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
                        )}
                      </div>

                      {/* Validation Message */}
                      {selectedGarments.length < 1 && (
                        <div
                          role="alert"
                          className="text-xs sm:text-sm text-warning bg-warning/10 p-2 rounded"
                        >
                          {t("tryOnWidget.validation.minGarmentsMultiple") || "Sélectionnez au moins 1 article pour continuer"}
                        </div>
                      )}

                      {selectedGarments.length >= 6 && (
                        <div
                          role="alert"
                          className="text-xs sm:text-sm text-warning bg-warning/10 p-2 rounded"
                        >
                          {t("tryOnWidget.validation.maxGarmentsMultiple") || "Maximum 6 articles sélectionnés"}
                        </div>
                      )}
                    </div>

                    {/* Garment Grid - Scrollable */}
                    <div className="flex-1 min-h-0 overflow-y-auto pr-1 -mr-1 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:bg-primary/30 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent hover:[&::-webkit-scrollbar-thumb]:bg-primary/50">
                      {multipleTabImages.length === 0 ? (
                        <div role="alert" aria-live="polite" className="h-full flex items-center justify-center">
                          <Card className="p-6 sm:p-8 md:p-10 text-center bg-muted/30 border-border">
                            <div className="flex flex-col items-center gap-3">
                              <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-muted flex items-center justify-center">
                                <Package className="h-6 w-6 sm:h-8 sm:w-8 text-muted-foreground" />
                              </div>
                              <div>
                                <p className="font-semibold text-foreground text-sm sm:text-base md:text-lg mb-1">
                                  {selectedCategory === "all"
                                    ? t("tryOnWidget.errors.noProducts") || "Aucun produit disponible"
                                    : t("tryOnWidget.errors.noProductsInCategory") || "Aucun produit dans cette catégorie"}
                                </p>
                                <p className="text-xs sm:text-sm text-muted-foreground">
                                  {selectedCategory === "all"
                                    ? t("tryOnWidget.errors.noProductsDescription") || "Les produits seront disponibles une fois chargés"
                                    : t("tryOnWidget.errors.noProductsInCategoryDescription") || "Essayez de sélectionner une autre catégorie"}
                                </p>
                              </div>
                            </div>
                          </Card>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-2 sm:gap-3 md:gap-4 animate-in fade-in-0 duration-300 pb-2">
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
                                className={`overflow-hidden cursor-pointer transition-all transform hover:scale-105 relative focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
                                  selected
                                    ? "ring-4 ring-primary shadow-lg scale-105"
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
                                <div className="relative bg-muted/30 flex items-center justify-center overflow-hidden aspect-[3/4]">
                                  <img
                                    src={imageUrl}
                                    alt={selected ? t("tryOnWidget.ariaLabels.selectedGarment", { index: index + 1 }) || `Article ${index + 1} - Sélectionné` : t("tryOnWidget.ariaLabels.garment", { index: index + 1 }) || `Article ${index + 1}`}
                                    className="w-full h-full object-contain"
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
                              variant="outline"
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
                                  <div className="absolute top-0 left-0 bg-primary text-primary-foreground text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-br">
                                    {index + 1}
                                  </div>
                                  <Button
                                    variant="destructive"
                                    size="icon"
                                    onClick={() => handleGarmentDeselect(index)}
                                    className="absolute top-0 right-0 h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity rounded-bl"
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
              <div className="pt-1 sm:pt-2 flex justify-center">
                <div className="w-full max-w-md sm:max-w-lg md:max-w-xl lg:max-w-2xl">
                  <Button
                    onClick={handleCartMultipleGenerate}
                    disabled={!cartMultipleImage || selectedGarments.length < 1 || isGeneratingMultiple}
                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground h-11 sm:h-12 md:h-14 text-sm sm:text-base md:text-lg min-h-[44px] shadow-md hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                    aria-label={t("tryOnWidget.buttons.generate") || "Générer l'essayage virtuel"}
                  >
                    <Sparkles
                      className="w-4 h-4 sm:w-5 sm:h-5 mr-2"
                      aria-hidden="true"
                    />
                    {t("tryOnWidget.buttons.generateMultiple", { count: selectedGarments.length }) || `Générer ${selectedGarments.length} Image${selectedGarments.length > 1 ? "s" : ""}`}
                  </Button>
                </div>
              </div>
            )}

            {/* Progress Tracker */}
            {isGeneratingMultiple && (
              <Card className="p-4 sm:p-6 border-border bg-card">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Loader2
                          className="h-4 w-4 sm:h-5 sm:w-5 animate-spin text-primary"
                          aria-hidden="true"
                        />
                        <span className="text-sm sm:text-base font-semibold">
                          {t("tryOnWidget.status.generating") || "Génération en cours..."}
                        </span>
                      </div>
                      <span className="text-xs sm:text-sm text-muted-foreground">
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
                    />
                  </div>

                  {batchProgress && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-xs sm:text-sm">
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

            {/* Results section */}
            <section
              className="pt-2 sm:pt-4"
              aria-labelledby="results-multiple-heading"
              aria-live="polite"
              aria-busy={isGeneratingMultiple}
            >
              <h2 id="results-multiple-heading" className="sr-only">
                {t("tryOnWidget.sections.results.multiple.title") || "Résultats de l'essayage virtuel - Mode Multiple"}
              </h2>
              {isGeneratingMultiple ? (
                <Card className="p-4 sm:p-6 border-border bg-card">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                      <h2 className="text-base sm:text-lg font-semibold">
                        {t("tryOnWidget.status.generating") || "Génération en cours..."}
                      </h2>
                    </div>
                    <Skeleton className="w-full h-[400px] sm:h-[500px] md:h-[600px] rounded-lg" />
                  </div>
                </Card>
              ) : cartResults ? (
                <Card className="p-4 sm:p-6 border-border bg-card">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                        <h2 className="text-base sm:text-lg font-semibold">
                          {t("tryOnWidget.sections.results.generated") || "Résultats Générés"}
                        </h2>
                      </div>
                      <div className="text-xs sm:text-sm text-muted-foreground">
                        {t("tryOnWidget.results.successful", { successful: cartResults.summary.successful, total: cartResults.summary.totalGarments }) || `${cartResults.summary.successful} / ${cartResults.summary.totalGarments} réussis`}
                        {cartResults.summary.cached > 0 && ` • ${t("tryOnWidget.results.cachedCount", { count: cartResults.summary.cached }) || `${cartResults.summary.cached} en cache`}`}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                      {cartResults.results
                        .filter((r) => r.status === "success")
                        .map((result, index) => {
                          const imageUrl = result.image || result.imageUrl;
                          if (!imageUrl) return null;

                          return (
                            <Card
                              key={result.index}
                              className="p-3 sm:p-4 border-border bg-card"
                            >
                              <div className="space-y-3">
                                <div className="relative rounded-lg overflow-hidden border border-border bg-muted/30 aspect-[3/4] flex items-center justify-center">
                                  <img
                                    src={imageUrl}
                                    alt={t("tryOnWidget.ariaLabels.tryOnResult", { index: index + 1 }) || `Résultat de l'essayage virtuel ${index + 1}`}
                                    className="w-full h-full object-contain"
                                    loading="lazy"
                                  />
                                  {result.cached && (
                                    <div className="absolute top-2 right-2 bg-primary/90 text-primary-foreground text-[10px] px-2 py-1 rounded">
                                      {t("tryOnWidget.results.cached") || "Cache"}
                                    </div>
                                  )}
                                  {result.status === "success" && (
                                    <div className="absolute top-2 left-2">
                                      <CheckCircle
                                        className="h-5 w-5 text-green-500 bg-background rounded-full"
                                        aria-hidden="true"
                                      />
                                    </div>
                                  )}
                                </div>

                                <Button
                                  onClick={() => handleCartMultipleDownload(imageUrl, index)}
                                  disabled={downloadingIndex === index}
                                  variant="outline"
                                  size="sm"
                                  className="w-full"
                                  aria-label={t("tryOnWidget.ariaLabels.downloadImage", { index: index + 1 }) || `Télécharger l'image ${index + 1}`}
                                >
                                  {downloadingIndex === index ? (
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                  ) : (
                                    <Download className="h-4 w-4 mr-2" />
                                  )}
                                  {t("tryOnWidget.buttons.download") || "Télécharger"}
                                </Button>

                                {result.processingTime > 0 && (
                                  <p className="text-[10px] text-muted-foreground text-center">
                                    {(result.processingTime / 1000).toFixed(1)}s
                                  </p>
                                )}
                              </div>
                            </Card>
                          );
                        })}
                    </div>

                    {cartResults.summary.failed > 0 && (
                      <div className="mt-4 p-3 bg-warning/10 border border-warning rounded">
                        <p className="text-sm text-warning font-semibold">
                          {t("tryOnWidget.errors.failedGenerations", { count: cartResults.summary.failed }) || `${cartResults.summary.failed} article${cartResults.summary.failed > 1 ? "s" : ""} n'ont pas pu être généré${cartResults.summary.failed > 1 ? "s" : ""}`}
                        </p>
                      </div>
                    )}
                  </div>
                </Card>
              ) : (
                <Card className="p-6 text-center">
                  <div
                    className="w-full min-h-[400px] flex flex-col items-center justify-center gap-3 text-muted-foreground"
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
                      {t("tryOnWidget.sections.results.noResults") || "Aucun résultat généré"}
                    </p>
                  </div>
                </Card>
              )}
            </section>

            {/* Error Display */}
            {errorMultiple && (
              <div role="alert" aria-live="assertive">
                <Card className="p-6 bg-error/10 border-error">
                  <p className="text-error font-medium" id="error-multiple-message">
                    {errorMultiple}
                  </p>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setErrorMultiple(null);
                      setCartMultipleImage(null);
                      setCartMultipleDemoPhotoUrl(null);
                      setSelectedGarments([]);
                      setCartResults(null);
                      setProgressMultiple(0);
                      setBatchProgress(null);
                    }}
                    className="group mt-4 gap-2 text-secondary-foreground hover:bg-secondary/80 transition-all duration-200 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                    aria-label={t("tryOnWidget.buttons.retry") || "Réessayer après une erreur"}
                    aria-describedby="error-multiple-message"
                  >
                    <RotateCcw
                      className="h-4 w-4 transition-transform group-hover:rotate-[-120deg] duration-500"
                      aria-hidden="true"
                    />
                    <span>{t("tryOnWidget.buttons.retry") || "Réessayer"}</span>
                  </Button>
                </Card>
              </div>
            )}
          </TabsContent>

          {/* Try Look Tab - Outfit Mode */}
          <TabsContent value="look" className="mt-0 space-y-4 sm:space-y-5 md:space-y-6">
            {/* Selection sections */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5 md:gap-6">
              {/* Left Panel: Upload */}
              <section aria-labelledby="upload-look-heading" className="flex flex-col">
                <Card className="p-3 sm:p-4 md:p-5 border-border bg-card flex flex-col h-[600px] sm:h-[700px] md:h-[800px]">
                  <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4 flex-shrink-0">
                    <div
                      className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-primary text-primary-foreground grid place-items-center font-semibold text-sm sm:text-base flex-shrink-0 shadow-sm"
                      aria-hidden="true"
                    >
                      1
                    </div>
                    <div className="min-w-0 flex-1">
                      <h2
                        id="upload-look-heading"
                        className="text-base sm:text-lg font-semibold"
                      >
                        {t("tryOnWidget.sections.uploadPhoto.title") || "Téléchargez Votre Photo"}
                      </h2>
                      <p className="text-[10px] sm:text-xs text-muted-foreground">
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
                        />
                      </div>
                    )}

                    {cartMultipleImage && (
                      <div className="relative rounded-lg bg-card p-2 sm:p-3 border border-border shadow-sm flex-1 flex flex-col min-h-0">
                        <div className="flex items-center justify-between mb-2 gap-2 flex-shrink-0">
                          <h3 className="font-semibold text-sm sm:text-base">
                            {t("tryOnWidget.sections.yourPhoto.title") || "Votre Photo"}
                          </h3>
                          <Button
                            variant="outline"
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
                        <div className="relative flex-1 rounded overflow-hidden border border-border bg-card flex items-center justify-center shadow-sm min-h-0">
                          <img
                            src={cartMultipleImage}
                            alt={t("tryOnWidget.ariaLabels.uploadedPhoto") || "Photo téléchargée pour l'essayage virtuel"}
                            className="h-full w-auto object-contain max-h-full"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
              </section>

              {/* Right Panel: Garment Selection */}
              <section aria-labelledby="garments-look-heading" className="flex flex-col">
                <Card className="p-3 sm:p-4 md:p-5 border-border bg-card flex flex-col h-[600px] sm:h-[700px] md:h-[800px]">
                  <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
                    <div
                      className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-primary text-primary-foreground grid place-items-center font-semibold text-sm sm:text-base flex-shrink-0 shadow-sm"
                      aria-hidden="true"
                    >
                      2
                    </div>
                    <div className="min-w-0 flex-1">
                      <h2
                        id="garments-look-heading"
                        className="text-base sm:text-lg font-semibold"
                      >
                        {t("tryOnWidget.sections.selectGarments.title") || "Sélectionner les Articles"}
                      </h2>
                      <p className="text-[10px] sm:text-xs text-muted-foreground">
                        {t("tryOnWidget.sections.selectGarments.look.description") || "Sélectionnez 2-8 articles pour une tenue complète"}
                      </p>
                    </div>
                  </div>

                  {/* Category Filter Dropdown - Enhanced UI/UX */}
                  {isLoadingCategories && (
                    <div className="mb-4 sm:mb-5">
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
                    <div className="mb-4 sm:mb-5">
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
                    <div className="mb-4 sm:mb-5 p-4 rounded-lg border border-border bg-muted/30">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Package className="h-4 w-4" />
                        <span>{t("tryOnWidget.filters.noCategories") || "Aucune catégorie disponible"}</span>
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col flex-1 min-h-0 space-y-3 sm:space-y-4">
                    {/* Products Count & Selection Counter - Fixed Header */}
                    <div className="flex-shrink-0 space-y-2">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2">
                            <span className="text-sm sm:text-base font-semibold">
                              {t("tryOnWidget.sections.selectedGarments.title") || "Articles Sélectionnés"}
                            </span>
                            <span
                              className={`text-xs sm:text-sm px-2 py-1 rounded-full ${
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
                            <div className="flex items-center gap-1.5 text-xs sm:text-sm text-muted-foreground">
                              <Grid3x3 className="h-3.5 w-3.5" />
                              <span>
                                {lookTabImages.length} {t("tryOnWidget.filters.availableProducts") || "produits disponibles"}
                              </span>
                            </div>
                          )}
                        </div>
                        {selectedGarments.length > 0 && (
                          <Button
                            variant="outline"
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
                        )}
                      </div>

                      {/* Validation Message */}
                      {selectedGarments.length < 2 && (
                        <div
                          role="alert"
                          className="text-xs sm:text-sm text-warning bg-warning/10 p-2 rounded"
                        >
                          {t("tryOnWidget.validation.minGarmentsLook") || "Sélectionnez au moins 2 articles pour continuer"}
                        </div>
                      )}

                      {selectedGarments.length >= 8 && (
                        <div
                          role="alert"
                          className="text-xs sm:text-sm text-warning bg-warning/10 p-2 rounded"
                        >
                          {t("tryOnWidget.validation.maxGarmentsLook") || "Maximum 8 articles sélectionnés"}
                        </div>
                      )}
                    </div>

                    {/* Garment Grid - Scrollable */}
                    <div className="flex-1 min-h-0 overflow-y-auto pr-1 -mr-1 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:bg-primary/30 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent hover:[&::-webkit-scrollbar-thumb]:bg-primary/50">
                      {lookTabImages.length === 0 ? (
                        <div role="alert" aria-live="polite" className="h-full flex items-center justify-center">
                          <Card className="p-6 sm:p-8 md:p-10 text-center bg-muted/30 border-border">
                            <div className="flex flex-col items-center gap-3">
                              <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-muted flex items-center justify-center">
                                <Package className="h-6 w-6 sm:h-8 sm:w-8 text-muted-foreground" />
                              </div>
                              <div>
                                <p className="font-semibold text-foreground text-sm sm:text-base md:text-lg mb-1">
                                  {selectedCategory === "all"
                                    ? t("tryOnWidget.errors.noProducts") || "Aucun produit disponible"
                                    : t("tryOnWidget.errors.noProductsInCategory") || "Aucun produit dans cette catégorie"}
                                </p>
                                <p className="text-xs sm:text-sm text-muted-foreground">
                                  {selectedCategory === "all"
                                    ? t("tryOnWidget.errors.noProductsDescription") || "Les produits seront disponibles une fois chargés"
                                    : t("tryOnWidget.errors.noProductsInCategoryDescription") || "Essayez de sélectionner une autre catégorie"}
                                </p>
                              </div>
                            </div>
                          </Card>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-2 sm:gap-3 md:gap-4 animate-in fade-in-0 duration-300 pb-2">
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
                                className={`overflow-hidden cursor-pointer transition-all transform hover:scale-105 relative focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
                                  selected
                                    ? "ring-4 ring-primary shadow-lg scale-105"
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
                                <div className="relative bg-muted/30 flex items-center justify-center overflow-hidden aspect-[3/4]">
                                  <img
                                    src={imageUrl}
                                    alt={selected ? t("tryOnWidget.ariaLabels.selectedGarment", { index: index + 1 }) || `Article ${index + 1} - Sélectionné` : t("tryOnWidget.ariaLabels.garment", { index: index + 1 }) || `Article ${index + 1}`}
                                    className="w-full h-full object-contain"
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
                              variant="outline"
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
                                  <div className="absolute top-0 left-0 bg-primary text-primary-foreground text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-br">
                                    {index + 1}
                                  </div>
                                  <Button
                                    variant="destructive"
                                    size="icon"
                                    onClick={() => handleGarmentDeselect(index)}
                                    className="absolute top-0 right-0 h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity rounded-bl"
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
              <div className="pt-1 sm:pt-2 flex justify-center">
                <div className="w-full max-w-md sm:max-w-lg md:max-w-xl lg:max-w-2xl">
                  <Button
                    onClick={handleCartMultipleGenerate}
                    disabled={!cartMultipleImage || selectedGarments.length < 2 || isGeneratingMultiple}
                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground h-11 sm:h-12 md:h-14 text-sm sm:text-base md:text-lg min-h-[44px] shadow-md hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                    aria-label="Générer la tenue complète"
                  >
                    <Sparkles
                      className="w-4 h-4 sm:w-5 sm:h-5 mr-2"
                      aria-hidden="true"
                    />
                    {t("tryOnWidget.buttons.generateOutfit") || "Générer la Tenue Complète"}
                  </Button>
                </div>
              </div>
            )}

            {/* Progress Tracker */}
            {isGeneratingMultiple && (
              <Card className="p-4 sm:p-6 border-border bg-card">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Loader2
                          className="h-4 w-4 sm:h-5 sm:w-5 animate-spin text-primary"
                          aria-hidden="true"
                        />
                        <span className="text-sm sm:text-base font-semibold">
                          {t("tryOnWidget.status.generatingOutfit") || "Génération de la tenue complète..."}
                        </span>
                      </div>
                      <span className="text-xs sm:text-sm text-muted-foreground">
                        {progressMultiple}%
                      </span>
                    </div>
                    <Progress value={progressMultiple} className="h-2" />
                  </div>

                  <div className="text-xs sm:text-sm text-muted-foreground">
                    {t("tryOnWidget.status.generatingOutfitTime") || "La génération d'une tenue complète peut prendre 10 à 15 secondes..."}
                  </div>
                </div>
              </Card>
            )}

            {/* Results section */}
            <section
              className="pt-2 sm:pt-4"
              aria-labelledby="results-look-heading"
              aria-live="polite"
              aria-busy={isGeneratingMultiple}
            >
              <h2 id="results-look-heading" className="sr-only">
                {t("tryOnWidget.sections.results.look.title") || "Résultats de l'essayage virtuel - Mode Tenue"}
              </h2>
              {isGeneratingMultiple ? (
                <Card className="p-4 sm:p-6 border-border bg-card">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                      <h2 className="text-base sm:text-lg font-semibold">
                        {t("tryOnWidget.status.generating") || "Génération en cours..."}
                      </h2>
                    </div>
                    <Skeleton className="w-full h-[400px] sm:h-[500px] md:h-[600px] rounded-lg" />
                  </div>
                </Card>
              ) : outfitResult ? (
                <Card className="p-4 sm:p-6 border-border bg-card ring-2 ring-primary/20 shadow-lg">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                      <h2 className="text-base sm:text-lg font-semibold">
                        {t("tryOnWidget.sections.results.outfitGenerated") || "Tenue Complète Générée"}
                      </h2>
                    </div>

                    {(() => {
                      const imageUrl = outfitResult.data.image || outfitResult.data.imageUrl;
                      if (!imageUrl) {
                        return (
                          <Card className="p-6 text-center bg-error/10 border-error">
                            <XCircle className="h-12 w-12 mx-auto mb-4 text-error" />
                            <p className="text-error font-semibold">
                              {t("tryOnWidget.errors.generationError") || "Erreur lors de la génération"}
                            </p>
                          </Card>
                        );
                      }

                      return (
                        <>
                          <div className="relative rounded-lg border border-border/50 bg-gradient-to-br from-muted/20 to-muted/5 overflow-hidden flex items-center justify-center shadow-sm hover:shadow-md transition-shadow duration-300">
                            <img
                              src={imageUrl}
                              alt={t("tryOnWidget.ariaLabels.outfitGenerated") || "Tenue complète générée par intelligence artificielle"}
                              className="w-full max-h-[80vh] object-contain"
                              loading="lazy"
                            />
                            {outfitResult.data.cached && (
                              <div className="absolute top-4 right-4 bg-primary/90 text-primary-foreground text-xs px-3 py-1.5 rounded">
                                {t("tryOnWidget.results.cached") || "En cache"}
                              </div>
                            )}
                          </div>

                          {outfitResult.data.garmentTypes && outfitResult.data.garmentTypes.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {outfitResult.data.garmentTypes.map((type, index) => (
                                <span
                                  key={index}
                                  className="text-xs px-2 py-1 bg-muted rounded text-muted-foreground"
                                >
                                  {type}
                                </span>
                              ))}
                            </div>
                          )}

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <Button
                              onClick={() => handleCartMultipleDownload(imageUrl)}
                              disabled={downloadingIndex !== null}
                              variant="outline"
                              size="sm"
                              className="w-full"
                              aria-label={t("tryOnWidget.ariaLabels.downloadOutfit") || "Télécharger l'image de la tenue"}
                            >
                              {downloadingIndex !== null ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                              ) : (
                                <Download className="h-4 w-4 mr-2" />
                              )}
                              {t("tryOnWidget.buttons.download") || "Télécharger"}
                            </Button>
                            <Button
                              onClick={() => {
                                toast.info(t("tryOnWidget.toast.comingSoon") || "Fonctionnalité à venir", {
                                  description: t("tryOnWidget.toast.addToCartComingSoon") || "L'ajout au panier sera disponible prochainement.",
                                });
                              }}
                              variant="outline"
                              size="sm"
                              className="w-full border-green-500/80 text-green-600 hover:bg-green-50"
                              aria-label={t("tryOnWidget.ariaLabels.addAllToCart") || "Ajouter tous les articles au panier"}
                            >
                              <ShoppingCart className="h-4 w-4 mr-2" />
                              {t("tryOnWidget.buttons.addToCart") || "Ajouter au Panier"}
                            </Button>
                            <Button
                              onClick={() => {
                                toast.info(t("tryOnWidget.toast.comingSoon") || "Fonctionnalité à venir", {
                                  description: t("tryOnWidget.toast.buyNowComingSoon") || "L'achat immédiat sera disponible prochainement.",
                                });
                              }}
                              variant="outline"
                              size="sm"
                              className="w-full border-red-500/80 text-red-600 hover:bg-red-50"
                              aria-label={t("tryOnWidget.ariaLabels.buyAllNow") || "Acheter tous les articles maintenant"}
                            >
                              <CreditCard className="h-4 w-4 mr-2" />
                              {t("tryOnWidget.buttons.buyNow") || "Acheter Maintenant"}
                            </Button>
                          </div>

                          {outfitResult.data.processingTime > 0 && (
                            <p className="text-xs text-muted-foreground text-center">
                              {t("tryOnWidget.results.processingTime") || "Temps de traitement:"} {(outfitResult.data.processingTime / 1000).toFixed(1)}s
                              {outfitResult.data.creditsDeducted > 0 && ` • ${t("tryOnWidget.results.creditsUsed", { count: outfitResult.data.creditsDeducted }) || `${outfitResult.data.creditsDeducted} crédit${outfitResult.data.creditsDeducted > 1 ? "s" : ""} utilisé${outfitResult.data.creditsDeducted > 1 ? "s" : ""}`}`}
                            </p>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </Card>
              ) : (
                <Card className="p-6 text-center">
                  <div
                    className="w-full min-h-[400px] flex flex-col items-center justify-center gap-3 text-muted-foreground"
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
                      {t("tryOnWidget.sections.results.noResults") || "Aucun résultat généré"}
                    </p>
                  </div>
                </Card>
              )}
            </section>

            {/* Error Display */}
            {errorMultiple && (
              <div role="alert" aria-live="assertive">
                <Card className="p-6 bg-error/10 border-error">
                  <p className="text-error font-medium" id="error-look-message">
                    {errorMultiple}
                  </p>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setErrorMultiple(null);
                      setCartMultipleImage(null);
                      setCartMultipleDemoPhotoUrl(null);
                      setSelectedGarments([]);
                      setOutfitResult(null);
                      setProgressMultiple(0);
                      setBatchProgress(null);
                    }}
                    className="group mt-4 gap-2 text-secondary-foreground hover:bg-secondary/80 transition-all duration-200 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                    aria-label={t("tryOnWidget.buttons.retry") || "Réessayer après une erreur"}
                    aria-describedby="error-look-message"
                  >
                    <RotateCcw
                      className="h-4 w-4 transition-transform group-hover:rotate-[-120deg] duration-500"
                      aria-hidden="true"
                    />
                    <span>{t("tryOnWidget.buttons.retry") || "Réessayer"}</span>
                  </Button>
                </Card>
              </div>
            )}
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
