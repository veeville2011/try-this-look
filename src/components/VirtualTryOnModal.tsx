import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { X, Upload, CheckCircle, Check, RotateCcw, ShoppingCart, Loader2, AlertCircle, Clock, Zap, Eye, RefreshCw, Pencil, Trash2, LogIn } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import i18n from '@/i18n/config';
import { Button } from '@/components/ui/button';
import TestPhotoUpload from '@/components/TestPhotoUpload';
import TestClothingSelection from '@/components/TestClothingSelection';
import { generateTryOn, dataURLToBlob, fetchUploadedImages, fetchCustomerImageHistory, type ImageGenerationHistoryItem, type PersonBbox } from '@/services/tryonApi';
import { storage } from '@/utils/storage';
import { detectStoreOrigin, extractProductImages, getStoreOriginFromPostMessage, requestStoreInfoFromParent, extractShopifyProductInfo, type StoreInfo } from '@/utils/shopifyIntegration';
import { DEMO_PHOTO_ID_MAP, DEMO_PHOTOS_ARRAY } from '@/constants/demoPhotos';
import type { ProductImage } from '@/types/tryon';
import { usePersonDetection } from '@/components/PersonDetector';
import { isWidgetTestRoute, isWidgetTestPath, isLocalhost } from '@/config/testProductData';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { GlowingBubblesReveal } from '@/components/ui/glowing-bubbles-reveal';
import { 
  generateImageId, 
  validateImageReady, 
  waitForImageReady,
  clearCachedDimensions,
  calculateImageScale
} from '@/utils/imageValidation';

interface VirtualTryOnModalProps {
  customerInfo?: {
    id?: string | null;
    email?: string | null;
    firstName?: string | null;
    lastName?: string | null;
  } | null;
}

const VirtualTryOnModal: React.FC<VirtualTryOnModalProps> = ({ customerInfo }) => {
  const { t } = useTranslation();
  
  // Detect Shopify store language and set i18n language accordingly
  const detectStoreLanguage = useCallback((): string => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return 'fr'; // Default fallback
    }

    // Method 1: Check HTML lang attribute (most reliable for Shopify stores)
    const htmlLang = document.documentElement.lang || document.documentElement.getAttribute('lang');
    if (htmlLang) {
      // Extract language code (e.g., "fr-FR" -> "fr", "en-US" -> "en")
      const langCode = htmlLang.split('-')[0].toLowerCase();
      if (langCode === 'fr' || langCode === 'en') {
        return langCode;
      }
    }

    // Method 2: Check URL path for language prefix (e.g., /fr/products, /en/products)
    try {
      const urlPath = window.location.pathname;
      const pathMatch = urlPath.match(/^\/(fr|en)(\/|$)/i);
      if (pathMatch) {
        const langCode = pathMatch[1].toLowerCase();
        if (langCode === 'fr' || langCode === 'en') {
          return langCode;
        }
      }
    } catch (e) {
      // URL parsing failed, continue to next method
    }

    // Method 3: Check Shopify locale if available
    try {
      const shopify = (window as any).Shopify;
      if (shopify && shopify.locale) {
        const locale = shopify.locale.toLowerCase();
        if (locale.startsWith('fr')) {
          return 'fr';
        }
        if (locale.startsWith('en')) {
          return 'en';
        }
      }
    } catch (e) {
      // Shopify object not available
    }

    // Method 4: Check parent window if in iframe
    try {
      if (window.parent !== window) {
        const parentLang = window.parent.document.documentElement.lang || 
                          window.parent.document.documentElement.getAttribute('lang');
        if (parentLang) {
          const langCode = parentLang.split('-')[0].toLowerCase();
          if (langCode === 'fr' || langCode === 'en') {
            return langCode;
          }
        }
      }
    } catch (e) {
      // Cross-origin access might fail
    }

    // Default fallback to French
    return 'fr';
  }, []);

  const [step, setStep] = useState<'idle' | 'generating' | 'complete'>('idle');
  const [progress, setProgress] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<string | number | null>(null);
  const [selectedHistoryItemId, setSelectedHistoryItemId] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  // Auth gate states
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [tutorialStep, setTutorialStep] = useState<1 | 2 | 3 | 4>(1); // 1: upload, 2: select, 3: generating, 4: result
  
  // Image states
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [uploadedImageForDetection, setUploadedImageForDetection] = useState<string | null>(null); // Base64 version for detection
  const [selectedClothing, setSelectedClothing] = useState<string | null>(null);
  const [selectedClothingKey, setSelectedClothingKey] = useState<string | number | null>(null);
  const [selectedDemoPhotoUrl, setSelectedDemoPhotoUrl] = useState<string | null>(null);
  const [photoSelectionMethod, setPhotoSelectionMethod] = useState<'file' | 'demo' | null>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [generatedImageError, setGeneratedImageError] = useState<boolean>(false);
  
  // Product images
  const [productImages, setProductImages] = useState<string[]>([]);
  const [productImagesWithIds, setProductImagesWithIds] = useState<Map<string, string | number>>(new Map());
  const [isLoadingImages, setIsLoadingImages] = useState(false);
  
  // Product data
  const [productData, setProductData] = useState<any>(null);
  const [storedProductData, setStoredProductData] = useState<any>(null);
  const [storeInfo, setStoreInfo] = useState<StoreInfo | null>(null);

  // Set i18n language based on Shopify store language
  useEffect(() => {
    const detectedLanguage = detectStoreLanguage();
    if (i18n.language !== detectedLanguage) {
      i18n.changeLanguage(detectedLanguage);
    }
  }, [detectStoreLanguage, storeInfo]); // Re-run when storeInfo changes
  
  // Cart states
  const [isAddToCartLoading, setIsAddToCartLoading] = useState(false);
  const [isBuyNowLoading, setIsBuyNowLoading] = useState(false);
  const [cartQuantity, setCartQuantity] = useState(1);
  const [currentCartQuantity, setCurrentCartQuantity] = useState(0);
  const [cartStateCache, setCartStateCache] = useState<{ items: any[]; timestamp: number } | null>(null);
  const [variantStockInfo, setVariantStockInfo] = useState<{
    isAvailable: boolean;
    availableQuantity: number | null;
    variantId: string | number | null;
  } | null>(null);
  
  // Track if first image has been auto-selected
  const hasAutoSelectedFirstImageRef = useRef(false);
  
  // Track previous uploadedImage to detect changes
  const prevUploadedImageRef = useRef<string | null>(null);
  
  // Clear cached dimensions and reset person selection when image changes
  useEffect(() => {
    if (prevUploadedImageRef.current && prevUploadedImageRef.current !== uploadedImage) {
      // Clear cached dimensions for previous image
      const prevImageId = generateImageId(prevUploadedImageRef.current);
      clearCachedDimensions(prevImageId);
      
      // Reset person selection when image changes to prevent using stale selection
      setSelectedPersonIndex(null);
      setSelectedPersonBbox(null);
    }
    prevUploadedImageRef.current = uploadedImage;
  }, [uploadedImage]);
  
  // Recent photos from API (using person images from history)
  const [recentPhotos, setRecentPhotos] = useState<Array<{ id: string; src: string }>>([]);
  const [isLoadingRecentPhotos, setIsLoadingRecentPhotos] = useState(false);
  const [loadingRecentPhotoIds, setLoadingRecentPhotoIds] = useState<Set<string>>(new Set());

  // Use the same demo photos as TryOnWidget
  const demoModels = DEMO_PHOTOS_ARRAY;
  const [loadingDemoModelIds, setLoadingDemoModelIds] = useState<Set<string>>(new Set());

  // Initialize loading state for demo models
  useEffect(() => {
    if (demoModels.length > 0) {
      setLoadingDemoModelIds(new Set(demoModels.map(m => m.id)));
    }
  }, []);

  // History items from API
  const [historyItems, setHistoryItems] = useState<Array<{ 
    id: string; 
    image: string; 
    personImageUrl?: string; 
    clothingImageUrl?: string;
    createdAt?: string;
  }>>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [loadingHistoryItemIds, setLoadingHistoryItemIds] = useState<Set<string>>(new Set());
  
  // Viewing past try-on state
  const [viewingPastTryOn, setViewingPastTryOn] = useState(false);
  const [viewingHistoryItem, setViewingHistoryItem] = useState<{
    id: string;
    image: string;
    personImageUrl?: string;
    clothingImageUrl?: string;
    createdAt?: string;
  } | null>(null);

  // Person selection state (for group photos in test app)
  const [selectedPersonBbox, setSelectedPersonBbox] = useState<PersonBbox | null>(null);
  const [selectedPersonIndex, setSelectedPersonIndex] = useState<number | null>(null);
  const [showChangePhotoOptions, setShowChangePhotoOptions] = useState(false);
  
  // Modal preload state - tracks when everything is ready to show UI
  const [isModalPreloaded, setIsModalPreloaded] = useState(false);
  const [boundingBoxesDrawn, setBoundingBoxesDrawn] = useState(false);
  const boundingBoxesDrawnRef = useRef(false);
  
  // Following CANVAS_POSITIONING_GUIDE.md: Track visibility changes to trigger canvas redraw
  const [visibilityChangeCounter, setVisibilityChangeCounter] = useState(0);
  
  // Person detection hook - active on /widget-test path (both localhost and production) when image is uploaded
  // Use uploadedImageForDetection (Base64) if available, otherwise use uploadedImage (for demo photos)
  const shouldDetectPeople = isWidgetTestPath() && (uploadedImageForDetection || uploadedImage) && !showChangePhotoOptions;
  const imageForDetection = uploadedImageForDetection || uploadedImage;
  const { imageRef: detectionImageRef, isLoading: isLoadingModels, isProcessing: isDetecting, detectionResult, error: detectionError } = usePersonDetection(
    shouldDetectPeople ? imageForDetection : '',
    0.5
  );

  // Extract sizes from product variants dynamically
  const extractSizesFromProduct = useCallback(() => {
    // Access product data directly from state to avoid circular dependency
    const currentProductData = storedProductData || productData || (() => {
      if (typeof window === 'undefined') return null;
      // Only use test data on localhost
      if (!isLocalhost()) return null;
      try {
        if (window.parent !== window && (window.parent as any).NUSENSE_PRODUCT_DATA) {
          return (window.parent as any).NUSENSE_PRODUCT_DATA;
        }
        if ((window as any).NUSENSE_PRODUCT_DATA) {
          return (window as any).NUSENSE_PRODUCT_DATA;
        }
      } catch (error) {
        // Cross-origin access might fail
      }
      return null;
    })();
    
    if (!currentProductData) {
      return []; // No fallback - return empty array if no product data
    }

    const variants = (currentProductData as any)?.variants?.nodes || 
                     (currentProductData as any)?.variants || 
                     [];
    
    if (variants.length === 0) {
      return []; // No fallback - return empty array if no variants
    }

    // Find the size option from variants
    const sizeValues = new Set<string>();
    variants.forEach((variant: any) => {
      const selectedOptions = variant?.selectedOptions || variant?.options || [];
      const sizeOption = selectedOptions.find((opt: any) => 
        opt?.name?.toLowerCase() === 'size' || 
        opt?.name?.toLowerCase() === 'taille' ||
        opt?.name?.toLowerCase() === 'sizes'
      );
      
      if (sizeOption?.value) {
        sizeValues.add(sizeOption.value.toUpperCase());
      } else {
        // Fallback: try to extract from variant title
        const title = variant?.title || '';
        const sizeMatch = title.match(/\b([XS|S|M|L|XL|XXL|XXXL|2XL|3XL|4XL|5XL]+)\b/i);
        if (sizeMatch) {
          sizeValues.add(sizeMatch[1].toUpperCase());
        }
      }
    });

    if (sizeValues.size > 0) {
      // Sort sizes in a logical order
      const sizeOrder = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', '2XL', '3XL', '4XL', '5XL'];
      return Array.from(sizeValues).sort((a, b) => {
        const indexA = sizeOrder.findIndex(s => s === a);
        const indexB = sizeOrder.findIndex(s => s === b);
        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
        if (indexA !== -1) return -1;
        if (indexB !== -1) return 1;
        return a.localeCompare(b);
      });
    }

    return []; // No fallback - return empty array if no sizes found
  }, [storedProductData, productData]);

  const sizes = useMemo(() => extractSizesFromProduct(), [extractSizesFromProduct]);
  const progressTimerRef = useRef<number | null>(null);
  const elapsedTimerRef = useRef<number | null>(null);
  const currentProgressRef = useRef<number>(0);
  
  // Touch handling for horizontal scroll sections
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const isScrollingRef = useRef<boolean>(false);
  
  // Track scroll direction to prevent reverse scrolling
  const lastScrollPositionRef = useRef<number>(0);
  const lastScrollTargetRef = useRef<string | null>(null);
  
  // Refs for auto-scrolling and focusing (defined early to avoid initialization errors)
  const mainContentRef = useRef<HTMLDivElement>(null);
  const generatedImageRef = useRef<HTMLDivElement>(null);
  const currentGenerationRef = useRef<string | null>(null); // Track current generation before viewing history
  const isLoadingHistoryRef = useRef<boolean>(false); // Flag to prevent reset useEffect during history loading
  const currentUploadedImageRef = useRef<string | null>(null); // Track current uploaded image before viewing history
  const currentSelectedClothingRef = useRef<string | null>(null); // Track current selected clothing before viewing history
  const rightColumnRef = useRef<HTMLDivElement>(null);
  const clothingSelectionRef = useRef<HTMLDivElement>(null);
  const generateButtonRef = useRef<HTMLButtonElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null); // Ref for the fixed-height container
  const sizeSelectionRef = useRef<HTMLDivElement>(null);
  const addToCartButtonRef = useRef<HTMLButtonElement>(null);
  const photoUploadRef = useRef<HTMLDivElement>(null);

  // Detect mobile device (defined early to avoid initialization errors)
  const isMobileDevice = useCallback(() => {
    if (typeof window === 'undefined') return false;
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
           (window.innerWidth < 768) ||
           ('ontouchstart' in window);
  }, []);

  // Helper function for smooth scrolling to an element - optimized for desktop and mobile (defined early)
  // Prevents reverse scrolling - only allows forward progression
  const scrollToElement = useCallback((elementRef: React.RefObject<HTMLElement>, offset: number = 20, behavior?: ScrollBehavior, targetId?: string) => {
    if (!elementRef.current || !mainContentRef.current) return;
    
    const element = elementRef.current;
    const container = mainContentRef.current;
    const isMobile = isMobileDevice();
    
    // Get current scroll position
    const currentScrollPosition = container.scrollTop;
    
    // Calculate target scroll position
    const scrollPosition = 
      element.offsetTop - 
      container.offsetTop - 
      (isMobile ? 10 : offset);
    
    // Prevent reverse scrolling - only allow forward progression
    if (lastScrollPositionRef.current > 0 && scrollPosition < lastScrollPositionRef.current) {
      // If scrolling backwards and we have a last target, check if it's the same target
      if (targetId && lastScrollTargetRef.current === targetId) {
        // Same target, allow it (user might be re-selecting)
        // But only if it's significantly different position
        const scrollDiff = Math.abs(scrollPosition - lastScrollPositionRef.current);
        if (scrollDiff < 50) {
          return; // Too close to last position, skip
        }
      } else if (scrollPosition < lastScrollPositionRef.current - 20) {
        // Different target and scrolling backwards significantly, prevent it
        return;
      }
    }
    
    // Check if element is already visible
    const containerRect = container.getBoundingClientRect();
    const elementRect = element.getBoundingClientRect();
    
    const isElementVisible = 
      elementRect.top >= containerRect.top &&
      elementRect.bottom <= containerRect.bottom &&
      elementRect.left >= containerRect.left &&
      elementRect.right <= containerRect.right;
    
    if (!isElementVisible) {
      // Use smooth scroll for both mobile and desktop - immediate but smooth
      const scrollOffset = isMobile ? 10 : offset;
      const scrollBehavior = behavior || 'smooth'; // Always use smooth for better UX
      
      // Update last scroll position and target
      lastScrollPositionRef.current = scrollPosition;
      if (targetId) {
        lastScrollTargetRef.current = targetId;
      }
      
      // Use requestAnimationFrame for immediate smooth scroll
      requestAnimationFrame(() => {
        container.scrollTo({
          top: Math.max(0, scrollPosition),
          behavior: scrollBehavior
        });
      });
    }
  }, [isMobileDevice]);

  // Helper function to focus an element - optimized for desktop and mobile (defined early)
  const focusElement = useCallback((elementRef: React.RefObject<HTMLElement>, delay: number = 100) => {
    const isMobile = isMobileDevice();
    
    // On mobile, skip focus to avoid keyboard popup (unless it's an input field)
    // Focus is more important for keyboard navigation on desktop
    setTimeout(() => {
      if (elementRef.current && typeof elementRef.current.focus === 'function') {
        const element = elementRef.current;
        const isInputElement = element.tagName === 'INPUT' || 
                              element.tagName === 'TEXTAREA' || 
                              element.tagName === 'SELECT' ||
                              element.getAttribute('contenteditable') === 'true';
        
        // Only focus on mobile if it's an input element (user expects keyboard)
        // Always focus on desktop for keyboard navigation
        if (!isMobile || isInputElement) {
          element.focus();
          
          // On mobile, scroll element into view after focus (handles keyboard popup)
          if (isMobile && isInputElement && element.scrollIntoView) {
            setTimeout(() => {
              element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 300);
          }
        }
      }
    }, delay);
  }, [isMobileDevice]);
  
  // Helper to handle touch events and prevent accidental clicks during scroll
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
    touchStartYRef.current = e.touches[0].clientY;
    isScrollingRef.current = false;
  };
  
  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null || touchStartYRef.current === null) return;
    
    const deltaX = Math.abs(e.touches[0].clientX - touchStartXRef.current);
    const deltaY = Math.abs(e.touches[0].clientY - touchStartYRef.current);
    
    // If horizontal movement is greater than vertical, user is scrolling
    if (deltaX > deltaY && deltaX > 10) {
      isScrollingRef.current = true;
    }
  };
  
  const handleTouchEnd = (e: React.TouchEvent, onClick: () => void) => {
    // Only trigger click if user wasn't scrolling
    if (!isScrollingRef.current && touchStartXRef.current !== null) {
      const deltaX = Math.abs((e.changedTouches[0]?.clientX || 0) - touchStartXRef.current);
      if (deltaX < 10) {
        onClick();
      }
    }
    
    touchStartXRef.current = null;
    touchStartYRef.current = null;
    isScrollingRef.current = false;
  };

  // Check if we're inside an iframe
  const isInIframe = typeof window !== 'undefined' && window.parent !== window;

  // Tutorial demo animation - only when not authenticated
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


  // Helper function to get the return URL (product page URL)
  // Priority: 1. Parent window URL (if same-origin), 2. document.referrer, 3. Current pathname
  // This ensures users return to the product page after authentication, not the home page
  const getReturnToUrl = useCallback((): string => {
    // CRITICAL: return_to must be a relative URL (starts with /) per Shopify docs
    // It should include pathname and search params, but NOT hash or absolute URLs
    
    // Helper function to append open_tryon parameter to URL
    const appendOpenTryOnParam = (path: string): string => {
      try {
        // Parse the path to handle existing query parameters
        const url = new URL(path, window.location.origin);
        // Add open_tryon=true parameter to auto-open widget after login
        url.searchParams.set('open_tryon', 'true');
        // Return only the pathname + search (relative URL)
        return url.pathname + url.search;
      } catch (e) {
        // If URL parsing fails, append parameter manually
        const separator = path.includes('?') ? '&' : '?';
        return `${path}${separator}open_tryon=true`;
      }
    };
    
    // If in iframe, try to get parent window URL first (most reliable)
    if (window.parent !== window) {
      try {
        // Try direct access to parent window location (works if same-origin)
        const parentUrl = window.parent.location.href;
        const parentUrlObj = new URL(parentUrl);
        // Only use parent URL if it's a product page (not the widget URL)
        if (!parentUrlObj.pathname.includes('/widget') && !parentUrlObj.pathname.includes('/demo')) {
          // Build relative path: pathname + search (query params)
          // Exclude hash as it's not needed for return_to
          const returnPath = parentUrlObj.pathname + parentUrlObj.search;
          // Ensure it starts with / (relative URL requirement)
          const relativePath = returnPath.startsWith('/') ? returnPath : `/${returnPath}`;
          // Append open_tryon parameter to auto-open widget after login
          return appendOpenTryOnParam(relativePath);
        }
      } catch (e) {
        // Cross-origin access failed, try referrer instead
      }
      
      // Fallback: Use document.referrer (should be the product page)
      try {
        const referrer = document.referrer;
        if (referrer) {
          const referrerUrl = new URL(referrer);
          // Only use referrer if it's a product page (not the widget URL)
          if (!referrerUrl.pathname.includes('/widget') && !referrerUrl.pathname.includes('/demo')) {
            // Build relative path: pathname + search (query params)
            const returnPath = referrerUrl.pathname + referrerUrl.search;
            // Ensure it starts with / (relative URL requirement)
            const relativePath = returnPath.startsWith('/') ? returnPath : `/${returnPath}`;
            // Append open_tryon parameter to auto-open widget after login
            return appendOpenTryOnParam(relativePath);
          }
        }
      } catch (e) {
        // Invalid referrer URL
      }
    }
    
    // Final fallback: Use current pathname (but exclude widget/demo paths)
    const currentPath = window.location.pathname;
    if (!currentPath.includes('/widget') && !currentPath.includes('/demo')) {
      // Include search params if present
      const returnPath = currentPath + window.location.search;
      const relativePath = returnPath.startsWith('/') ? returnPath : `/${returnPath}`;
      // Append open_tryon parameter to auto-open widget after login
      return appendOpenTryOnParam(relativePath);
    }
    
    // If all else fails, return empty string (Shopify will redirect to home)
    // Empty string is safer than invalid URL to prevent broken redirects
    return '';
  }, []);

  // Get login URL - improved to return to product page after authentication
  // CRITICAL: According to Shopify docs, routes.storefront_login_url automatically handles return_to
  // Adding return_to to storefrontLoginUrl can cause conflicts and broken redirects
  const getLoginUrl = useCallback((): string => {
    try {
      // Helper function to validate and encode return_to parameter
      // Shopify requires return_to to be a relative URL (starts with /)
      const getValidReturnTo = (): string | null => {
        const returnTo = getReturnToUrl();
        if (!returnTo || returnTo.trim() === '') {
          return null;
        }
        // Ensure it's a relative URL (starts with /)
        const relativePath = returnTo.startsWith('/') ? returnTo : `/${returnTo}`;
        // Validate it's not an absolute URL (no protocol)
        if (relativePath.includes('://') || relativePath.includes('//')) {
          console.warn('[VirtualTryOnModal] Invalid return_to URL (must be relative):', returnTo);
          return null;
        }
        return relativePath;
      };

      // First, try to get the universal login URL from Liquid-injected JSON script tag
      try {
        const loginUrlScript = document.getElementById('nusense-login-url-info');
        if (loginUrlScript && loginUrlScript.textContent) {
          const loginUrlData = JSON.parse(loginUrlScript.textContent);
          
          // CRITICAL FIX: storefrontLoginUrl automatically handles return_to
          // According to Shopify docs: "Once signed in, the customer will be taken back to the page where the sign-in originated"
          // DO NOT add return_to parameter to storefrontLoginUrl as it causes conflicts
          if (loginUrlData?.storefrontLoginUrl) {
            // Use storefrontLoginUrl as-is - it automatically returns to originating page
            return loginUrlData.storefrontLoginUrl;
          }
          
          // For accountLoginUrl, we can add return_to if needed (for legacy customer accounts)
          if (loginUrlData?.accountLoginUrl) {
            const accountUrl = new URL(loginUrlData.accountLoginUrl);
            const returnTo = getValidReturnTo();
            if (returnTo) {
              // Only add return_to if it doesn't already exist
              if (!accountUrl.searchParams.has('return_to')) {
                accountUrl.searchParams.set("return_to", returnTo);
              }
            }
            return accountUrl.toString();
          }
        }
      } catch (parseError) {
        console.warn('[VirtualTryOnModal] Error parsing login URL from Liquid:', parseError);
      }
      
      // Fallback: Construct login URL manually using /customer_authentication/login
      // This works for both legacy and new Customer Account API stores
      const storeOriginInfo = detectStoreOrigin();
      const storeOrigin = storeOriginInfo?.origin || storeOriginInfo?.fullUrl;
      const returnTo = getValidReturnTo();
      
      if (storeOrigin) {
        try {
          const loginUrl = new URL("/customer_authentication/login", storeOrigin);
          if (returnTo) {
            loginUrl.searchParams.set("return_to", returnTo);
          }
          return loginUrl.toString();
        } catch (urlError) {
          console.error('[VirtualTryOnModal] Error constructing login URL with storeOrigin:', urlError);
        }
      }
      
      // Fallback: try to detect from parent window or referrer
      if (window.parent !== window) {
        try {
          const referrer = document.referrer;
          if (referrer) {
            const referrerUrl = new URL(referrer);
            const loginUrl = new URL("/customer_authentication/login", referrerUrl.origin);
            if (returnTo) {
              loginUrl.searchParams.set("return_to", returnTo);
            }
            return loginUrl.toString();
          }
        } catch (referrerError) {
          console.warn('[VirtualTryOnModal] Error using referrer for login URL:', referrerError);
        }
      }
      
      // Final fallback: relative path (will work if on same domain)
      const loginUrl = new URL("/customer_authentication/login", window.location.origin);
      if (returnTo) {
        loginUrl.searchParams.set("return_to", returnTo);
      }
      return loginUrl.toString();
    } catch (error) {
      console.error("[VirtualTryOnModal] Error constructing login URL:", error);
      // Return safe fallback - no return_to to avoid redirect loops
      return "/customer_authentication/login";
    }
  }, [getReturnToUrl]);

  const handleLoginClick = useCallback(() => {
    setIsRedirecting(true);
    
    try {
      const loginUrl = getLoginUrl();
      
      // Validate URL before redirecting to prevent broken redirects
      if (!loginUrl || loginUrl.trim() === '') {
        console.error('[VirtualTryOnModal] Invalid login URL:', loginUrl);
        setIsRedirecting(false);
        toast.error('Unable to redirect to login page. Please try again.');
        return;
      }
      
      // Validate URL format
      try {
        new URL(loginUrl);
      } catch (urlError) {
        // If it's a relative URL, that's fine (Shopify accepts relative URLs)
        if (!loginUrl.startsWith('/')) {
          console.error('[VirtualTryOnModal] Invalid login URL format:', loginUrl);
          setIsRedirecting(false);
          toast.error('Invalid login URL format. Please try again.');
          return;
        }
      }
      
      // Set a timeout to detect if redirect is taking too long
      const redirectTimeout = setTimeout(() => {
        console.warn('[VirtualTryOnModal] Redirect taking longer than expected');
        // Don't reset isRedirecting here - let it continue
      }, 5000); // 5 second warning
      
      // If in iframe, redirect parent window to login
      if (isInIframe && window.parent !== window) {
        try {
          window.parent.location.href = loginUrl;
          clearTimeout(redirectTimeout);
        } catch (error) {
          clearTimeout(redirectTimeout);
          // Cross-origin issue, open in new tab
          console.warn('[VirtualTryOnModal] Cross-origin redirect failed, opening in new tab:', error);
          window.open(loginUrl, "_blank");
        }
      } else {
        // Redirect current window
        window.location.href = loginUrl;
        clearTimeout(redirectTimeout);
      }
    } catch (error) {
      console.error('[VirtualTryOnModal] Error during login redirect:', error);
      setIsRedirecting(false);
      toast.error('An error occurred while redirecting. Please try again.');
    }
  }, [getLoginUrl, isInIframe]);

  // Helper function to get proxied image URL to avoid CORS issues
  const getProxiedImageUrl = useCallback((imageUrl: string): string => {
    // If URL is already from our domain or relative, return as-is
    try {
      const url = new URL(imageUrl, window.location.href);
      // If it's from S3 or external domain, use proxy
      if (url.hostname.includes('s3') || url.hostname !== window.location.hostname) {
        return `/api/proxy-image?url=${encodeURIComponent(imageUrl)}`;
      }
    } catch {
      // If URL parsing fails, assume it's external and use proxy
      return `/api/proxy-image?url=${encodeURIComponent(imageUrl)}`;
    }
    return imageUrl;
  }, []);

  // Helper function to convert S3/HTTP image URL to Base64 (for person detection to avoid tainted canvas errors)
  // Uses the same proxy approach as display to ensure it works (since display works everywhere)
  const convertImageUrlToBase64 = useCallback(async (imageUrl: string | null | undefined): Promise<string | null> => {
    if (!imageUrl) return null;
    
    // If already a data URL, return it directly
    if (imageUrl.startsWith('data:image/')) {
      return imageUrl;
    }
    
    // For blob URLs, return as-is (they're already local)
    if (imageUrl.startsWith('blob:')) {
      return imageUrl;
    }
    
    // For HTTP/HTTPS URLs (including S3), fetch via proxy (same as display) and convert to Base64
    // This ensures it works the same way as displaying images everywhere else
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
      try {
        // Use proxy URL (same approach as getProxiedImageUrl used for display)
        // This ensures consistency with how images are displayed everywhere
        const proxiedUrl = getProxiedImageUrl(imageUrl);
        console.log('[VirtualTryOnModal] Converting to Base64 - Original URL:', imageUrl.substring(0, 100));
        console.log('[VirtualTryOnModal] Converting to Base64 - Proxied URL:', proxiedUrl);
        
        const response = await fetch(proxiedUrl);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const blob = await response.blob();
        
        // Convert blob to Base64 data URL
        const reader = new FileReader();
        const dataURL = await new Promise<string>((resolve, reject) => {
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        
        // Validate data URL
        if (dataURL && typeof dataURL === 'string' && dataURL.trim().length > 0 && dataURL.startsWith('data:image/')) {
          console.log('[VirtualTryOnModal] Successfully converted to Base64, length:', dataURL.length);
          return dataURL;
        }
        console.warn('[VirtualTryOnModal] Base64 conversion failed - invalid data URL format');
        return null;
      } catch (error) {
        console.error('[VirtualTryOnModal] Failed to convert image URL to Base64:', error);
        console.error('[VirtualTryOnModal] Original URL was:', imageUrl);
        return null;
      }
    }
    
    return null;
  }, [getProxiedImageUrl]);

  // Helper function to load an image from URL and convert to data URL (to avoid tainted canvas errors)
  const loadImageAsDataURL = useCallback(async (imageUrl: string | null | undefined): Promise<string | null> => {
    if (!imageUrl) return null;
    
    // If already a data URL, return it directly
    if (imageUrl.startsWith('data:image/')) {
      return imageUrl;
    }
    
    // Otherwise, fetch and convert to data URL
    try {
      const proxiedUrl = getProxiedImageUrl(imageUrl);
      const blob = await fetch(proxiedUrl).then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        return res.blob();
      });
      
      const reader = new FileReader();
      const dataURL = await new Promise<string>((resolve, reject) => {
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      
      // Validate data URL
      if (dataURL && typeof dataURL === 'string' && dataURL.trim().length > 0 && dataURL.startsWith('data:image/')) {
        return dataURL;
      }
      return null;
    } catch (error) {
      console.warn('[VirtualTryOnModal] Failed to load image as data URL:', error);
      return null;
    }
  }, [getProxiedImageUrl]);

  // Format countdown timer
  const formatCountdownTimer = (elapsedSeconds: number): string => {
    const totalSeconds = 50;
    const remaining = Math.max(0, totalSeconds - elapsedSeconds);
    if (remaining < 60) {
      return `${remaining}s`;
    }
    const minutes = Math.floor(remaining / 60);
    const remainingSeconds = remaining % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Get product data helper - defined early so it can be used in useEffect
  const getProductData = useCallback((): any => {
    if (typeof window === 'undefined') return null;
    
    // Priority 1: Use stored product data (from postMessage) - most reliable
    if (storedProductData) {
      return storedProductData;
    }
    
    // Priority 2: Try direct access from parent window (only on localhost)
    if (isLocalhost()) {
      try {
        if (window.parent !== window && (window.parent as any).NUSENSE_PRODUCT_DATA) {
          return (window.parent as any).NUSENSE_PRODUCT_DATA;
        }
        if ((window as any).NUSENSE_PRODUCT_DATA) {
          return (window as any).NUSENSE_PRODUCT_DATA;
        }
      } catch (error) {
        // Cross-origin access might fail
      }
    }
    
    // Priority 3: Use local productData state
    if (productData) {
      return productData;
    }
    
    // Priority 4: Try to extract from page
    try {
      const extracted = extractShopifyProductInfo();
      if (extracted) {
        return extracted;
      }
    } catch (error) {
      // Extraction failed
    }
    
    return null;
  }, [storedProductData, productData]);

  // Detect store origin on mount
  useEffect(() => {
    const isInIframe = window.parent !== window;
    
    // Check for test store info first (for /widget-test route, only on localhost)
    if (typeof window !== 'undefined' && isLocalhost() && (window as any).NUSENSE_TEST_STORE_INFO) {
      const testStoreInfo = (window as any).NUSENSE_TEST_STORE_INFO;
      setStoreInfo({
        domain: testStoreInfo.domain || 'vto-demo.myshopify.com',
        shopDomain: testStoreInfo.shop || 'vto-demo',
        fullUrl: testStoreInfo.domain ? `https://${testStoreInfo.domain}` : 'https://vto-demo.myshopify.com',
        origin: testStoreInfo.origin || window.location.origin,
        method: 'unknown' as const // Use 'unknown' for test data
      });
      return; // Don't proceed with normal detection for test route
    }
    
    const detectedStore = detectStoreOrigin();
    if (detectedStore && detectedStore.method !== 'unknown') {
      setStoreInfo(detectedStore);
    }
    
    // Request store info from parent if in iframe
    if (isInIframe) {
      if (!detectedStore || detectedStore.method === 'unknown' || detectedStore.method === 'postmessage') {
        requestStoreInfoFromParent((storeInfo) => {
          setStoreInfo(storeInfo);
        }).catch(() => {
          // Failed to get store info from parent
        });
      }
    }
  }, []);

  // Request product images and data from parent window when in iframe
  useEffect(() => {
    if (isInIframe) {
      if (productImages.length === 0) {
        setIsLoadingImages(true);
        try {
          window.parent.postMessage({ type: 'NUSENSE_REQUEST_IMAGES' }, '*');
        } catch (error) {
          console.error('[VirtualTryOnModal] Failed to request images:', error);
          setIsLoadingImages(false);
        }
      }
      
      // Request product data
      if (!productData) {
        try {
          window.parent.postMessage({ type: 'NUSENSE_REQUEST_PRODUCT_DATA' }, '*');
        } catch (error) {
          console.error('[VirtualTryOnModal] Failed to request product data:', error);
        }
      }
    } else {
      // Check for test product data first (for /widget-test route, only on localhost)
      if (typeof window !== 'undefined' && isLocalhost() && (window as any).NUSENSE_PRODUCT_DATA) {
        const testProductData = (window as any).NUSENSE_PRODUCT_DATA;
        if (testProductData && !productData) {
          setProductData(testProductData);
          setStoredProductData(testProductData);
        }
      }
      
      // Check for test product images (for /widget-test route, only on localhost)
      if (typeof window !== 'undefined' && isLocalhost() && (window as any).NUSENSE_TEST_PRODUCT_IMAGES) {
        const testImages = (window as any).NUSENSE_TEST_PRODUCT_IMAGES;
        if (Array.isArray(testImages) && testImages.length > 0 && productImages.length === 0) {
          const imageUrls: string[] = [];
          const imageIdMap = new Map<string, string | number>();
          
          testImages.forEach((img: string | ProductImage) => {
            if (typeof img === 'string') {
              imageUrls.push(img);
            } else if (img && typeof img === 'object' && 'url' in img) {
              imageUrls.push(img.url);
              if (img.id !== undefined) {
                imageIdMap.set(img.url, img.id);
              }
            }
          });
          
          if (imageUrls.length > 0) {
            setProductImages(imageUrls);
            setProductImagesWithIds(imageIdMap);
            setIsLoadingImages(false);
            
            // Auto-select first image
            if (!selectedClothing || !hasAutoSelectedFirstImageRef.current) {
              const firstImage = imageUrls[0];
              setSelectedClothing(firstImage);
              storage.saveClothingUrl(firstImage);
              const clothingId = imageIdMap.get(firstImage) || null;
              setSelectedClothingKey(clothingId);
              hasAutoSelectedFirstImageRef.current = true;
            }
          }
        }
      } else {
        // Extract from current page (fallback)
        const images = extractProductImages();
        if (images.length > 0) {
          setProductImages(images);
          setProductImagesWithIds(new Map());
          
          // Always auto-select first clothing image (main product image) when extracted from page
          // First image is the main/featured product image in Shopify
          if (images.length > 0) {
            const firstImage = images[0];
            // Always select first image if none selected or if ref hasn't been set
            if (!selectedClothing || !hasAutoSelectedFirstImageRef.current) {
              setSelectedClothing(firstImage);
              storage.saveClothingUrl(firstImage);
              hasAutoSelectedFirstImageRef.current = true;
            }
          }
        }
      }
    }
  }, [isInIframe, productImages.length, productData, selectedClothing]);

  // Listen for product images from parent window
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Extract store origin from postMessage events
      const storeOrigin = getStoreOriginFromPostMessage(event);
      if (storeOrigin && storeOrigin.method === 'postmessage') {
        setStoreInfo((prev) => {
          if (!prev || prev.method === 'unknown' || prev.method === 'postmessage') {
            return storeOrigin;
          }
          return prev;
        });
      }

      // Handle product data messages from parent window
      // postMessage is how real Shopify data arrives, so always accept it
      // Only direct window.NUSENSE_PRODUCT_DATA access is restricted to localhost
      if (event.data && event.data.type === 'NUSENSE_PRODUCT_DATA') {
        console.log('[VirtualTryOnModal] Received NUSENSE_PRODUCT_DATA:', event.data.productData);
        if (event.data.productData) {
          const newProductData = event.data.productData;
          setStoredProductData(newProductData);
          setProductData(newProductData);
          
          // Reset selected clothing when product changes to ensure we show the correct product image
          // Only reset if the product ID actually changed
          const currentProductId = storedProductData?.id || productData?.id;
          const newProductId = newProductData?.id;
          
          if (currentProductId && newProductId && currentProductId !== newProductId) {
            // Product changed - reset clothing selection so new product's first image will be selected
            setSelectedClothing(null);
            setSelectedClothingKey(null);
            hasAutoSelectedFirstImageRef.current = false;
            // Clear saved clothing from storage to ensure fresh product image is used
            storage.saveClothingUrl(null);
          } else if (!currentProductId && newProductId) {
            // First time receiving product data - reset to ensure first image is selected
            hasAutoSelectedFirstImageRef.current = false;
          }
        }
      }

      // Handle product images from parent window
      if (event.data && event.data.type === 'NUSENSE_PRODUCT_IMAGES') {
        const parentImages = event.data.images || [];
        if (parentImages.length > 0) {
          const imageUrls: string[] = [];
          const imageIdMap = new Map<string, string | number>();

          parentImages.forEach((img: string | ProductImage) => {
            if (typeof img === 'string') {
              imageUrls.push(img);
            } else if (img && typeof img === 'object' && 'url' in img) {
              imageUrls.push(img.url);
              if (img.id !== undefined) {
                imageIdMap.set(img.url, img.id);
              }
            }
          });

          setProductImages(imageUrls);
          setProductImagesWithIds(imageIdMap);
          setIsLoadingImages(false);
          
          // Always auto-select the first image (main/featured product image) when images are received from parent
          // The first image in Shopify is typically the main/featured product image (position 1)
          if (imageUrls.length > 0) {
            const firstImage = imageUrls[0]; // First image is the main product image
            const currentSelected = selectedClothing;
            const isCurrentSelectionValid = currentSelected && imageUrls.includes(currentSelected);
            
            // Always select first image if:
            // 1. No image is currently selected, OR
            // 2. Current selection is not in the new images list (product changed), OR
            // 3. This is the first time images are received (hasAutoSelectedFirstImageRef is false)
            if (!isCurrentSelectionValid || !hasAutoSelectedFirstImageRef.current) {
              setSelectedClothing(firstImage);
              storage.saveClothingUrl(firstImage);
              const clothingId = imageIdMap.get(firstImage) || null;
              setSelectedClothingKey(clothingId);
              hasAutoSelectedFirstImageRef.current = true;
            }
          }
        } else {
          setIsLoadingImages(false);
        }
      }

      // Handle store info response from parent
      if (event.data && event.data.type === 'NUSENSE_STORE_INFO') {
        const storeInfo: StoreInfo = {
          domain: event.data.domain || null,
          fullUrl: event.data.fullUrl || null,
          shopDomain: event.data.shopDomain || null,
          origin: event.data.origin || event.origin || null,
          method: 'parent-request',
        };
        setStoreInfo(storeInfo);
      }

      // Handle cart state response from parent window
      if (event.data && event.data.type === 'NUSENSE_CART_STATE') {
        const currentProductData = storedProductData || getProductData();
        if (currentProductData?.id && Array.isArray(event.data.items)) {
          // Update cache with fresh cart state
          setCartStateCache({
            items: event.data.items,
            timestamp: Date.now(),
          });

          // Update cart quantity
          const productId = String(currentProductData.id);
          const matchingItems = event.data.items.filter((item: any) => 
            String(item.product_id) === productId || String(item.productId) === productId
          );
          const totalQuantity = matchingItems.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0);
          setCurrentCartQuantity(totalQuantity);
        }
      }

      // Handle cart actions
      if (event.data && event.data.type === 'NUSENSE_ACTION_SUCCESS') {
        if (event.data.action === 'NUSENSE_ADD_TO_CART') {
          setIsAddToCartLoading(false);
          
          // Update cache and cart quantity from cart response
          try {
            if (Array.isArray(event.data?.cart?.items) && event.data.cart.items.length > 0) {
              setCartStateCache({
                items: event.data.cart.items,
                timestamp: Date.now(),
              });
              
              const currentProductData = storedProductData || getProductData();
              if (currentProductData?.id) {
                const productId = String(currentProductData.id);
                const matchingItems = event.data.cart.items.filter((item: any) => 
                  String(item.product_id) === productId || String(item.productId) === productId
                );
                const totalQuantity = matchingItems.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0);
                setCurrentCartQuantity(totalQuantity);
              }
            }
          } catch (error) {
            console.warn('[VirtualTryOnModal] Failed to update cart quantity:', error);
          }
          
          setCartQuantity(1); // Reset local quantity selector
          
          // Show toast with product name and size
          const currentProductData = storedProductData || getProductData();
          const productTitle = currentProductData?.title || currentProductData?.name || t('virtualTryOnModal.product');
          const sizeText = selectedSize ? ` (${t('virtualTryOnModal.size')} ${selectedSize})` : '';
          setToastMessage(t('virtualTryOnModal.addedToCart', { productTitle, sizeText }));
          setShowToast(true);
          setTimeout(() => setShowToast(false), 3000);
        } else if (event.data.action === 'NUSENSE_BUY_NOW') {
          setIsBuyNowLoading(false);
        }
      } else if (event.data && event.data.type === 'NUSENSE_ACTION_ERROR') {
        if (event.data.action === 'NUSENSE_ADD_TO_CART') {
          setIsAddToCartLoading(false);
          toast.error(t('virtualTryOnModal.errorAddingToCart'), {
            description: event.data.error || t('virtualTryOnModal.pleaseTryAgain'),
          });
        } else if (event.data.action === 'NUSENSE_BUY_NOW') {
          setIsBuyNowLoading(false);
          toast.error(t('virtualTryOnModal.errorBuyingNow'), {
            description: event.data.error || t('virtualTryOnModal.pleaseTryAgain'),
          });
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [selectedClothing, storedProductData, getProductData, productData, selectedSize, t]);

  // Restore saved state from storage (but prioritize fresh product images from parent)
  // IMPORTANT: We don't restore step to 'complete' on mount to ensure first step UI shows by default
  // Users can see their previous work in history, but start with a fresh upload experience
  useEffect(() => {
    // CRITICAL: Ensure step is 'idle' and viewingPastTryOn is false on mount
    // This guarantees the first step UI (with demo photos, recent photos) shows by default
    setStep('idle');
    setViewingPastTryOn(false);
    setViewingHistoryItem(null);
    setSelectedHistoryItemId(null);
    
    const savedImage = storage.getUploadedImage();
    const savedResult = storage.getGeneratedImage();

    // Validate that savedImage is a valid non-empty string and looks like a data URL
    // Restore uploaded image so user can see their previous photo, but keep step as 'idle'
    if (savedImage && typeof savedImage === 'string' && savedImage.trim().length > 0 && savedImage.startsWith('data:image/')) {
      setUploadedImage(savedImage);
    }
    
    // Don't restore savedClothing from storage - always use fresh product images from parent
    // The first product image will be auto-selected when images are received
    
    // Don't restore generated image or step to 'complete' on mount
    // This ensures the first step UI (with demo photos, recent photos) always shows by default
    // Clear any saved generated image so it doesn't interfere
    if (savedResult) {
      storage.saveGeneratedImage(null);
      setGeneratedImage(null);
      setGeneratedImageError(false);
    }
  }, []);

  // Fetch recent photos from API (using person images from history, same way as history)
  useEffect(() => {
    if (!customerInfo?.email) {
      setRecentPhotos([]);
      setIsLoadingRecentPhotos(false);
      return;
    }

    let isMounted = true;

    const loadRecentPhotos = async () => {
      if (!isMounted) return;
      
      setIsLoadingRecentPhotos(true);
      try {
        const shopDomain = storeInfo?.shopDomain || storeInfo?.domain || null;
        const response = await fetchCustomerImageHistory(
          customerInfo.email,
          1,
          20, // Fetch more to ensure we get 5 unique person images
          shopDomain || undefined
        );

        if (response.success && Array.isArray(response.data)) {
          if (response.data.length > 0) {
            // Extract unique person images from history (same way as history is accessed)
            // Use a Set to track seen image URLs for efficient deduplication
            const seenUrls = new Set<string>();
            const photos = response.data
              .map((item) => {
                if (!item || !item.id || !item.personImageUrl) {
                  return null;
                }
                return {
                  id: item.id,
                  src: item.personImageUrl, // Use person image instead of generated image
                };
              })
              .filter((item): item is { id: string; src: string } => {
                if (!item) return false;
                // Check if we've already seen this image URL
                if (seenUrls.has(item.src)) {
                  return false; // Skip duplicate
                }
                seenUrls.add(item.src); // Mark as seen
                return true;
              })
              .slice(0, 5); // Limit to 5 unique recent photos
            
            if (isMounted) {
              setRecentPhotos(photos);
              // Initialize loading state for all photos
              setLoadingRecentPhotoIds(new Set(photos.map(p => p.id)));
            }
          } else {
            if (isMounted) {
              setRecentPhotos([]);
            }
          }
        } else {
          if (isMounted) {
            setRecentPhotos([]);
          }
        }
      } catch (error) {
        console.error('[VirtualTryOnModal] Failed to fetch recent photos:', error);
        if (isMounted) {
          setRecentPhotos([]);
        }
      } finally {
        if (isMounted) {
          setIsLoadingRecentPhotos(false);
        }
      }
    };

    // Small delay to avoid race conditions
    const timeoutId = setTimeout(() => {
      loadRecentPhotos();
    }, 100);

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, [customerInfo?.email, storeInfo]);

  // Fetch try-on history from API
  useEffect(() => {
    if (!customerInfo?.email) {
      setHistoryItems([]);
      setIsLoadingHistory(false);
      return;
    }

    let isMounted = true;

    const loadHistory = async () => {
      if (!isMounted) return;
      
      setIsLoadingHistory(true);
      try {
        const shopDomain = storeInfo?.shopDomain || storeInfo?.domain || null;
        console.log('[VirtualTryOnModal] Fetching history:', {
          email: customerInfo.email,
          shopDomain,
          hasStoreInfo: !!storeInfo,
        });
        
        const response = await fetchCustomerImageHistory(
          customerInfo.email!,
          1,
          10,
          shopDomain || undefined
        );

        if (!isMounted) return;

        console.log('[VirtualTryOnModal] History response:', {
          success: response.success,
          dataLength: response.data?.length || 0,
          pagination: response.pagination,
          firstItem: response.data?.[0],
        });

        if (response.success && Array.isArray(response.data)) {
          if (response.data.length > 0) {
            // Map API data to match UI structure and sort by createdAt (newest first)
            const history = response.data
              .map((item) => {
                if (!item || !item.id || !item.generatedImageUrl) {
                  console.warn('[VirtualTryOnModal] Invalid history item:', item);
                  return null;
                }

                return {
                  id: item.id,
                  image: item.generatedImageUrl, // Use generated image for history display
                  personImageUrl: item.personImageUrl, // Preserve person image URL
                  clothingImageUrl: item.clothingImageUrl, // Preserve clothing image URL
                  createdAt: item.createdAt || item.updatedAt || '',
                };
              })
              .filter((item) => item !== null)
              .sort((a, b) => {
                // Sort by createdAt descending (newest first)
                if (!a.createdAt && !b.createdAt) return 0;
                if (!a.createdAt) return 1;
                if (!b.createdAt) return -1;
                return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
              })
              .map(({ id, image, personImageUrl, clothingImageUrl, createdAt }) => ({ 
                id, 
                image, 
                personImageUrl, 
                clothingImageUrl,
                createdAt
              })); // Preserve all image URLs and timestamps
            
            console.log('[VirtualTryOnModal] Setting history items:', history.length);
            if (isMounted) {
              setHistoryItems(history);
              // Initialize loading state for all history items
              setLoadingHistoryItemIds(new Set(history.map(h => h.id)));
            }
          } else {
            console.log('[VirtualTryOnModal] History data is empty array');
            if (isMounted) {
              setHistoryItems([]);
            }
          }
        } else {
          console.warn('[VirtualTryOnModal] Invalid response structure:', {
            success: response.success,
            hasData: !!response.data,
            isArray: Array.isArray(response.data),
          });
          if (isMounted) {
            setHistoryItems([]);
          }
        }
      } catch (error) {
        console.error('[VirtualTryOnModal] Failed to fetch history:', error);
        if (isMounted) {
          setHistoryItems([]);
        }
      } finally {
        if (isMounted) {
          setIsLoadingHistory(false);
        }
      }
    };

    // Add a small delay to ensure storeInfo is loaded if it's being fetched
    // But don't wait too long - try immediately if storeInfo is already available
    const delay = storeInfo ? 0 : 500;
    const timeoutId = setTimeout(() => {
      loadHistory();
    }, delay);

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, [customerInfo?.email, storeInfo]);

  // Handle photo upload
  const handlePhotoUpload = useCallback((
    dataURL: string,
    isDemoPhoto?: boolean,
    demoPhotoUrl?: string,
    photoId?: string | number
  ) => {
    // Validate that dataURL is a valid non-empty string and looks like a data URL
    if (!dataURL || typeof dataURL !== 'string' || dataURL.trim().length === 0 || !dataURL.startsWith('data:image/')) {
      console.warn('[VirtualTryOnModal] Invalid image data URL provided to handlePhotoUpload');
      return;
    }
    setUploadedImage(dataURL);
    setUploadedImageForDetection(dataURL); // File uploads are already Base64, use for detection
    storage.saveUploadedImage(dataURL);
    setError(null);
    setShowChangePhotoOptions(false); // Close expanded options to show "Change photo" button
    if (photoId !== undefined) {
      setSelectedPhoto(photoId);
    }
    
    if (isDemoPhoto && demoPhotoUrl) {
      setPhotoSelectionMethod('demo');
      setSelectedDemoPhotoUrl(demoPhotoUrl);
    } else {
      setPhotoSelectionMethod('file');
      setSelectedDemoPhotoUrl(null);
    }
    // Auto-scroll removed - no scrolling on image selection
  }, []);

  // Trigger file input for photo upload (reusable function)
  const triggerPhotoUpload = useCallback(() => {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      
      // Validate file type
      if (!file.type.startsWith('image/')) {
      toast.error(t('tryOnWidget.photoUpload.invalidType'), {
        description: t('tryOnWidget.photoUpload.invalidType'),
      });
        return;
      }
      
      // Validate file size (8MB max)
      const MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024; // 8MB
      if (file.size > MAX_FILE_SIZE_BYTES) {
        toast.error(t('tryOnWidget.photoUpload.fileTooLarge', { maxMB: 8 }), {
          description: t('tryOnWidget.photoUpload.fileTooLarge', { maxMB: 8 }),
        });
        return;
      }
      
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataURL = reader.result as string;
        
        // Validate data URL
        if (!dataURL || typeof dataURL !== 'string' || !dataURL.startsWith('data:image/')) {
          toast.error('Failed to read image file');
          return;
        }
        
               // Check if we're on /widget-test path - if so, detection will happen automatically
               if (isWidgetTestPath()) {
                 // Set uploaded image immediately so preview shows
                 setUploadedImage(dataURL);
                 setUploadedImageForDetection(dataURL); // File uploads are already Base64, use for detection
                 storage.saveUploadedImage(dataURL);
                 setError(null);
                 setSelectedPhoto(null);
                 setPhotoSelectionMethod('file');
                 setSelectedDemoPhotoUrl(null);
                 setShowChangePhotoOptions(false); // Close expanded options
                 // Reset person selection when new image is uploaded
                 setSelectedPersonBbox(null);
                 setSelectedPersonIndex(null);
               } else {
          // Normal flow - directly upload
          setShowChangePhotoOptions(false); // Close expanded options
          handlePhotoUpload(dataURL, false, undefined);
        }
      };
      reader.onerror = () => {
        toast.error('Failed to read image file');
      };
      reader.readAsDataURL(file);
    };
    fileInput.click();
  }, [handlePhotoUpload]);

  // Handle clothing selection
  // Handle selecting a history item - prefill all images (user, clothing, and generated)
  const handleHistoryItemSelect = useCallback(async (item: { 
    id: string; 
    image: string; 
    personImageUrl?: string; 
    clothingImageUrl?: string;
    createdAt?: string;
  }) => {
    try {
      // CRITICAL: Set flag to prevent reset useEffect from interfering
      // This must be set BEFORE any state updates to prevent the useEffect from resetting state
      isLoadingHistoryRef.current = true;
      
      // CRITICAL: Set selection state IMMEDIATELY for instant visual feedback
      // This makes the red radio indicator appear instantly when user clicks
      setSelectedHistoryItemId(item.id);
      setViewingPastTryOn(true);
      setViewingHistoryItem(item);
      
      // Save current generation and images before switching to history (if not already viewing history)
      if (!viewingPastTryOn) {
        if (generatedImage) {
          currentGenerationRef.current = generatedImage;
        }
        if (uploadedImage) {
          currentUploadedImageRef.current = uploadedImage;
        }
        if (selectedClothing) {
          currentSelectedClothingRef.current = selectedClothing;
        }
      }
      
      // Load all images in parallel (happens in background after selection is shown)
      // Use convertImageUrlToBase64 for person image to avoid tainted canvas errors for detection
      // Use loadImageAsDataURL for other images (display only)
      const [generatedDataURL, personDataURL, clothingDataURL] = await Promise.allSettled([
        loadImageAsDataURL(item.image),
        convertImageUrlToBase64(item.personImageUrl),
        loadImageAsDataURL(item.clothingImageUrl),
      ]);
      
      // Extract results from Promise.allSettled
      const generatedImageResult = generatedDataURL.status === 'fulfilled' ? generatedDataURL.value : null;
      const personImageResult = personDataURL.status === 'fulfilled' ? personDataURL.value : null;
      const clothingImageResult = clothingDataURL.status === 'fulfilled' ? clothingDataURL.value : null;
      
      // Update all image states atomically after all images are loaded
      // CRITICAL: Set generatedImage FIRST, then other states, then step LAST
      // This ensures generatedImage is available when step changes to 'complete'
      
      // Update generated image state FIRST
      if (generatedImageResult) {
        setGeneratedImage(generatedImageResult);
        storage.saveGeneratedImage(generatedImageResult);
        setGeneratedImageError(false);
      } else if (item.image) {
        // If loading failed but URL exists, try using the URL directly (might work with CORS)
        console.warn('[VirtualTryOnModal] Failed to load generated image as data URL, trying direct URL:', item.image);
        setGeneratedImage(item.image); // Use URL directly as fallback
        setGeneratedImageError(false); // Don't show error yet, let onError handler deal with it
      } else {
        setGeneratedImageError(true);
        setGeneratedImage(null);
      }
      
      // Update person image state
      if (personImageResult) {
        setUploadedImage(personImageResult);
        setUploadedImageForDetection(personImageResult); // History items converted to Base64, use for detection
        storage.saveUploadedImage(personImageResult);
        setSelectedDemoPhotoUrl(null);
        setPhotoSelectionMethod('file');
        setShowChangePhotoOptions(false); // Close expanded options to show "Change photo" button
      } else {
        // Base64 conversion failed - cannot use S3 URL directly as it causes CORS errors in PersonDetector
        console.error('[VirtualTryOnModal] Failed to convert person image to Base64 for history item:', item.personImageUrl);
        setUploadedImage(null);
        setUploadedImageForDetection(null);
        storage.saveUploadedImage(null);
        setSelectedDemoPhotoUrl(null);
        setPhotoSelectionMethod(null);
        setShowChangePhotoOptions(false); // Close expanded options
        // Show error to user
        if (item.personImageUrl) {
          toast.error('Failed to load person image from history. Please try uploading a new photo.');
        }
      }
      
      // Update clothing image state
      if (clothingImageResult) {
        setSelectedClothing(clothingImageResult);
        storage.saveClothingUrl(clothingImageResult);
      } else if (item.clothingImageUrl) {
        // If loading failed but URL exists, try using the URL directly
        console.warn('[VirtualTryOnModal] Failed to load clothing image as data URL, trying direct URL:', item.clothingImageUrl);
        setSelectedClothing(item.clothingImageUrl); // Use URL directly as fallback
        storage.saveClothingUrl(item.clothingImageUrl);
      } else {
        setSelectedClothing(null);
        storage.saveClothingUrl(null);
      }
      
      // CRITICAL: Set step to 'complete' LAST - React batches all updates together
      // But by setting generatedImage first, it will be available when step changes
      setStep('complete');
      setSelectedSize(null);
      
      // CRITICAL: Reset flag AFTER all states are updated
      // This allows the reset useEffect to work normally for user uploads
      isLoadingHistoryRef.current = false;
      
      // Note: Auto-scroll is handled by useEffect watching selectedHistoryItemId
      // This ensures scroll happens after the selection indicator (red radio) is visible
    } catch (error) {
      console.error('[VirtualTryOnModal] Failed to load history item:', error);
      toast.error('Failed to load try-on result');
      // Reset selection on error
      setSelectedHistoryItemId(null);
      setViewingPastTryOn(false);
      setViewingHistoryItem(null);
      // Reset flag on error
      isLoadingHistoryRef.current = false;
    }
  }, [generatedImage, uploadedImage, selectedClothing, viewingPastTryOn, getProxiedImageUrl, loadImageAsDataURL, convertImageUrlToBase64]);
  
  // Get formatted time ago string
  const getTimeAgo = useCallback((dateString?: string): string => {
    if (!dateString) return '';
    
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      
      if (diffDays === 0) return t('virtualTryOnModal.today');
      if (diffDays === 1) return t('virtualTryOnModal.dayAgo', { count: 1 });
      if (diffDays < 7) return t('virtualTryOnModal.daysAgo', { count: diffDays });
      if (diffDays < 14) return t('virtualTryOnModal.weekAgo');
      if (diffDays < 21) return t('virtualTryOnModal.weeksAgo', { count: 2 });
      if (diffDays < 30) return t('virtualTryOnModal.weeksAgo', { count: 3 });
      const diffMonths = Math.floor(diffDays / 30);
      if (diffMonths === 1) return t('virtualTryOnModal.monthAgo');
      return t('virtualTryOnModal.monthsAgo', { count: diffMonths });
    } catch {
      return '';
    }
  }, [t]);

  const handleClothingSelect = useCallback((imageUrl: string) => {
    setSelectedClothing(imageUrl);
    storage.saveClothingUrl(imageUrl);
    
    if (imageUrl) {
      const clothingId = productImagesWithIds.get(imageUrl) || null;
      setSelectedClothingKey(clothingId);
      
      // Update product data if we have variant-specific image
      if (clothingId) {
        // Get current product data
        const currentProductData = storedProductData || productData || (() => {
          if (typeof window === 'undefined') return null;
          // Only use test data on localhost
          if (!isLocalhost()) return null;
          try {
            if (window.parent !== window && (window.parent as any).NUSENSE_PRODUCT_DATA) {
              return (window.parent as any).NUSENSE_PRODUCT_DATA;
            }
            if ((window as any).NUSENSE_PRODUCT_DATA) {
              return (window as any).NUSENSE_PRODUCT_DATA;
            }
          } catch (error) {
            // Cross-origin access might fail
          }
          return null;
        })();
        
        if (currentProductData) {
          const variants = (currentProductData as any)?.variants?.nodes || 
                           (currentProductData as any)?.variants || 
                           [];
          const matchingVariant = variants.find((v: any) => 
            String(v?.id) === String(clothingId) || 
            String(v?.variant_id) === String(clothingId)
          );
          
          if (matchingVariant) {
            // Update selected variant in product data
            setProductData((prev: any) => ({
              ...prev,
              selectedVariantId: matchingVariant.id || matchingVariant.variant_id,
              variantId: matchingVariant.id || matchingVariant.variant_id,
            }));
          }
        }
      }
    } else {
      setSelectedClothingKey(null);
    }
    // Auto-scroll removed - no scrolling on clothing selection
  }, [productImagesWithIds, storedProductData, productData, uploadedImage]);
  
  // Get size availability for all sizes
  const getSizeAvailability = useCallback(() => {
    const currentProductData = storedProductData || getProductData();
    if (!currentProductData) {
      return sizes.map(size => ({ size, isAvailable: false, variantId: null, inventoryQty: null }));
    }

    const variants = (currentProductData as any)?.variants?.nodes || 
                     (currentProductData as any)?.variants || 
                     [];
    
    return sizes.map(size => {
      // Find variant matching this size
      const variant = variants.find((v: any) => {
        // Check selectedOptions for size
        const selectedOptions = v?.selectedOptions || v?.options || [];
        const sizeOption = selectedOptions.find((opt: any) => 
          opt?.name?.toLowerCase() === 'size' || 
          opt?.name?.toLowerCase() === 'taille' ||
          opt?.name?.toLowerCase() === 'sizes'
        );
        
        if (sizeOption) {
          return sizeOption.value?.toUpperCase() === size.toUpperCase();
        }
        
        // Fallback: check if title contains the size
        const title = v?.title || '';
        // Match exact size or size in title (e.g., "M" or "Size M")
        const sizeRegex = new RegExp(`\\b${size}\\b`, 'i');
        return sizeRegex.test(title);
      });

      if (!variant) {
        return { size, isAvailable: false, variantId: null, inventoryQty: null };
      }

      // Use availableForSale as the primary check (correct Shopify field)
      // availableForSale is true when variant can be purchased, false otherwise
      // It considers inventory quantity, inventory policy, and sales channel availability
      const isAvailable = variant.availableForSale === true;
      const inventoryQty = variant.inventoryQuantity ?? variant.inventory_quantity ?? variant.quantityAvailable ?? null;
      const variantId = variant.id || variant.variant_id || null;

      return {
        size,
        isAvailable,
        variantId,
        inventoryQty,
      };
    });
  }, [storedProductData, getProductData, sizes]);

  // Memoize size availability to avoid recalculating multiple times
  const sizeAvailability = useMemo(() => getSizeAvailability(), [getSizeAvailability, sizes]);

  // Check variant stock availability
  const checkVariantStock = useCallback(() => {
    const currentProductData = storedProductData || getProductData();
    if (!currentProductData) {
      setVariantStockInfo(null);
      return;
    }

    // Get selected variant ID from multiple sources
    let selectedVariantId: string | number | null = null;
    selectedVariantId = (currentProductData as any)?.selectedVariantId ?? 
                        (currentProductData as any)?.selected_variant_id ??
                        (currentProductData as any)?.variantId ??
                        (currentProductData as any)?.variant_id ??
                        null;

    // Check URL for variant parameter
    if (!selectedVariantId) {
      try {
        if (typeof window !== 'undefined' && window.location) {
          const urlParams = new URLSearchParams(window.location.search);
          const variantParam = urlParams.get('variant');
          if (variantParam) selectedVariantId = variantParam;
        }
      } catch {}
    }

    // If we have variants array, find the selected variant
    if ((currentProductData as any).variants && Array.isArray((currentProductData as any).variants) && selectedVariantId) {
      const variant = (currentProductData as any).variants.find((v: any) =>
        String(v?.id) === String(selectedVariantId) || String(v?.variant_id) === String(selectedVariantId)
      );

      if (variant) {
        // Use availableForSale as the primary check (correct Shopify field)
        // availableForSale considers inventory quantity, inventory policy, and sales channel availability
        const isAvailable = variant.availableForSale === true;
        const inventoryQty = variant.inventoryQuantity ?? variant.inventory_quantity ?? variant.quantityAvailable ?? null;
        // Check if there's enough stock for the requested quantity
        // If inventoryQty is null, it means inventory tracking is disabled or unlimited
        const hasEnoughStock = inventoryQty === null || inventoryQty >= cartQuantity;

        setVariantStockInfo({
          isAvailable: isAvailable && hasEnoughStock,
          availableQuantity: inventoryQty,
          variantId: selectedVariantId,
        });
        return;
      }
    }

    // If we can't find a matching variant, treat as "unknown/assume available"
    setVariantStockInfo({
      isAvailable: true,
      availableQuantity: null,
      variantId: selectedVariantId,
    });
  }, [storedProductData, cartQuantity, getProductData]);

  // Check stock when product data, variant, or cart quantity changes
  useEffect(() => {
    if (generatedImage) {
      checkVariantStock();
    }
  }, [generatedImage, storedProductData, cartQuantity, checkVariantStock]);
  
  // Request cart state from parent
  const requestCartState = useCallback(() => {
    const isInIframe = typeof window !== 'undefined' && window.parent !== window;
    if (!isInIframe) return;

    // Check cache first (5 second cache validity)
    const cacheValid = cartStateCache && (Date.now() - cartStateCache.timestamp < 5000);
    if (!cacheValid) {
      window.parent.postMessage({ type: 'NUSENSE_REQUEST_CART_STATE' }, '*');
    } else {
      // Use cached data
      const currentProductData = storedProductData || getProductData();
      if (currentProductData?.id) {
        const productId = String(currentProductData.id);
        const matchingItems = cartStateCache.items.filter((item: any) => 
          String(item.product_id) === productId || String(item.productId) === productId
        );
        const totalQuantity = matchingItems.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0);
        setCurrentCartQuantity(totalQuantity);
      }
    }
  }, [cartStateCache, storedProductData, getProductData]);

  // Get current cart quantity for the product
  useEffect(() => {
    const currentProductData = storedProductData || getProductData();
    if (currentProductData?.id) {
      const isInIframe = typeof window !== 'undefined' && window.parent !== window;
      if (isInIframe) {
        requestCartState();
      }
    } else {
      setCurrentCartQuantity(0);
    }
  }, [storedProductData, generatedImage, requestCartState, getProductData]);

  // Validate if uploadedImage is a valid image
  const isValidImage = useCallback((image: string | null): boolean => {
    if (!image || typeof image !== 'string' || image.trim().length === 0) {
      return false;
    }
    // Check if it's a valid data URL
    if (image.startsWith('data:image/')) {
      return true;
    }
    // Check if it's a valid URL
    if (image.startsWith('http://') || image.startsWith('https://') || image.startsWith('/')) {
      return true;
    }
    return false;
  }, []);

  // Generate try-on (moved before handleRegeneratePastTryOn to avoid initialization error)
  const handleGenerate = useCallback(async () => {
    const hasValidImage = isValidImage(uploadedImage);
    if (!hasValidImage || !selectedClothing) {
      setError(t('virtualTryOnModal.pleaseUploadPhotoAndSelectClothing'));
      toast.error(t('virtualTryOnModal.missingRequirements'), {
        description: t('virtualTryOnModal.pleaseUploadPhotoAndSelectClothing'),
      });
      // Scroll to missing requirement (forward only) - immediate smooth scroll
      // Auto-scroll removed - no scrolling on image selection
      return;
    }

    setStep('generating');
    setProgress(0);
    currentProgressRef.current = 0;
    setElapsedTime(0);
    setError(null);
    setStatusMessage(t('virtualTryOnModal.preparingTryOn'));
    
    // Auto-scroll to generating section - ONLY for mobile
    const isMobile = isMobileDevice();
    if (isMobile) {
      // Use requestAnimationFrame for smooth, immediate scroll
      requestAnimationFrame(() => {
        if (rightColumnRef.current && mainContentRef.current) {
          const element = rightColumnRef.current;
          const container = mainContentRef.current;
          const scrollOffset = 10;
          const scrollPosition = Math.max(0, element.offsetTop - container.offsetTop - scrollOffset);
          
          // Update last scroll position and target
          lastScrollPositionRef.current = scrollPosition;
          lastScrollTargetRef.current = 'generating-section';
          
          // Scroll immediately with smooth behavior (mobile only)
          container.scrollTo({
            top: scrollPosition,
            behavior: 'smooth'
          });
        }
      });
    }

    // Clear old timers
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
    }
    if (elapsedTimerRef.current) {
      clearInterval(elapsedTimerRef.current);
    }

    const startTime = Date.now();
    
    // Progress timer
    progressTimerRef.current = window.setInterval(() => {
      const elapsed = Date.now() - startTime;
      const elapsedSeconds = Math.floor(elapsed / 1000);
      setElapsedTime(elapsedSeconds);
      
      const duration = 50000; // 50 seconds
      const targetProgress = 95;
      const normalizedTime = Math.min(elapsed / duration, 1);
      const easedProgress = normalizedTime * (2 - normalizedTime) * targetProgress; // easeOutQuad
      const newProgress = Math.round(easedProgress);
      currentProgressRef.current = newProgress;
      setProgress(newProgress);
    }, 100);

    // Elapsed timer
    elapsedTimerRef.current = window.setInterval(() => {
      const elapsed = Date.now() - startTime;
      const elapsedSeconds = Math.floor(elapsed / 1000);
      setElapsedTime(elapsedSeconds);
    }, 1000);

    try {
      const personBlob = await dataURLToBlob(uploadedImage);
      const clothingResponse = await fetch(selectedClothing);
      const clothingBlob = await clothingResponse.blob();

      const shopDomain = storeInfo?.shopDomain || storeInfo?.domain || null;
      const clothingKey = selectedClothingKey ? String(selectedClothingKey) : undefined;
      const personKey = selectedDemoPhotoUrl ? DEMO_PHOTO_ID_MAP.get(selectedDemoPhotoUrl) || undefined : undefined;

      const currentProductData = storedProductData || getProductData();
      
      // Try to get selected variant ID from multiple sources
      let selectedVariantId: number | string | null = null;
      try {
        if (typeof window !== 'undefined' && window.location) {
          const urlParams = new URLSearchParams(window.location.search);
          const variantParam = urlParams.get('variant');
          if (variantParam) selectedVariantId = variantParam;
        }
      } catch {}
      
      if (!selectedVariantId && currentProductData) {
        selectedVariantId = (currentProductData as any)?.selectedVariantId ?? 
                            (currentProductData as any)?.variantId ?? 
                            (currentProductData as any)?.variants?.[0]?.id ?? 
                            null;
      }
      
      const productInfo = currentProductData ? {
        productId: currentProductData.id ?? currentProductData.productId ?? null,
        productTitle: currentProductData.title ?? currentProductData.name ?? null,
        productUrl: currentProductData.url ?? null,
        variantId: selectedVariantId,
      } : null;
      
      // Convert bbox from [x, y, width, height] to PersonBbox format if available
      // CRITICAL: Clamp all values to ensure they are positive (server validation requirement)
      const personBbox: PersonBbox | null = selectedPersonBbox ? {
        x: Math.max(0, selectedPersonBbox.x),
        y: Math.max(0, selectedPersonBbox.y),
        width: Math.max(0, selectedPersonBbox.width),
        height: Math.max(0, selectedPersonBbox.height),
      } : null;
      
      // Log bbox for debugging
      if (personBbox) {
        console.log('[VirtualTryOnModal] Sending personBbox to API:', personBbox);
        if (selectedPersonBbox && (
          selectedPersonBbox.x !== personBbox.x ||
          selectedPersonBbox.y !== personBbox.y ||
          selectedPersonBbox.width !== personBbox.width ||
          selectedPersonBbox.height !== personBbox.height
        )) {
          console.warn('[VirtualTryOnModal] PersonBbox was clamped:', {
            original: selectedPersonBbox,
            clamped: personBbox
          });
        }
      }

      const result = await generateTryOn(
        personBlob,
        clothingBlob,
        shopDomain,
        clothingKey,
        personKey,
        1, // version
        customerInfo,
        productInfo,
        (statusDescription) => {
          if (statusDescription && statusDescription.trim()) {
            setStatusMessage(statusDescription);
          }
        },
        personBbox // Pass selected person bounding box
      );

      // Clear timers
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
        progressTimerRef.current = null;
      }
      if (elapsedTimerRef.current) {
        clearInterval(elapsedTimerRef.current);
        elapsedTimerRef.current = null;
      }

      // Smoothly animate to 100%
      const finalProgress = 100;
      const startProgress = currentProgressRef.current;
      let completionIntervalRef: number | null = null;
      
      if (startProgress < finalProgress) {
        const completionDuration = 500; // 500ms
        const completionStartTime = Date.now();
        completionIntervalRef = window.setInterval(() => {
          const elapsed = Date.now() - completionStartTime;
          const completionProgress = Math.min(elapsed / completionDuration, 1);
          const newProgress = Math.round(startProgress + (finalProgress - startProgress) * completionProgress);
          currentProgressRef.current = newProgress;
          setProgress(newProgress);
          
          if (completionProgress >= 1) {
            if (completionIntervalRef) {
              clearInterval(completionIntervalRef);
              completionIntervalRef = null;
            }
            currentProgressRef.current = finalProgress;
            setProgress(finalProgress);
          }
        }, 16); // ~60fps
      } else {
        currentProgressRef.current = finalProgress;
        setProgress(finalProgress);
      }

      if (result.status === 'success' && result.image) {
          // Validate the generated image before setting
          // Accept both data URLs (data:image/...) and regular URLs (http://... or https://...)
          const isValidImage = result.image && 
            typeof result.image === 'string' && 
            result.image.trim().length > 0 && 
            (result.image.startsWith('data:image/') || 
             result.image.startsWith('http://') || 
             result.image.startsWith('https://') ||
             result.image.startsWith('/'));
          
          if (isValidImage) {
            setGeneratedImage(result.image);
            // Only save data URLs to storage (regular URLs are already stored on server)
            if (result.image.startsWith('data:image/')) {
              storage.saveGeneratedImage(result.image);
            }
            currentGenerationRef.current = result.image; // Save as current generation
            // Also update the current images refs so they're always in sync
            if (uploadedImage) {
              currentUploadedImageRef.current = uploadedImage;
            }
            if (selectedClothing) {
              currentSelectedClothingRef.current = selectedClothing;
            }
            setGeneratedImageError(false);
          } else {
            console.error('[VirtualTryOnModal] Invalid generated image from API:', result.image);
            setGeneratedImageError(true);
            setGeneratedImage(null);
            // Don't set general error state - generatedImageError handles this
            toast.error(t('virtualTryOnModal.generatedImageError'));
          }
        
        // When API completes, ensure progress is 100% and show finalizing state
        // Clear any running completion interval and set progress immediately
        if (completionIntervalRef) {
          clearInterval(completionIntervalRef);
        }
        currentProgressRef.current = 100;
        setProgress(100);
        setStatusMessage(t('virtualTryOnModal.finalizingTryOn'));
        
        // Show finalizing state for 600ms (reduced for better UX) before transitioning to complete
        // This gives time for the checkmark animation while keeping the reveal smooth
        setTimeout(() => {
          setStep('complete');
          setStatusMessage('');
        }, 600);
        
        // Refetch history to show the latest image first
        if (customerInfo?.email) {
          const shopDomain = storeInfo?.shopDomain || storeInfo?.domain || null;
          fetchCustomerImageHistory(
            customerInfo.email,
            1,
            10,
            shopDomain || undefined
          )
            .then((response) => {
              if (response.success && Array.isArray(response.data)) {
                if (response.data.length > 0) {
                  const history = response.data
                    .map((item) => {
                      if (!item || !item.id || !item.generatedImageUrl) {
                        console.warn('[VirtualTryOnModal] Invalid history item after generation:', item);
                        return null;
                      }
                      return {
                        id: item.id,
                        image: item.generatedImageUrl,
                        personImageUrl: item.personImageUrl, // Preserve person image URL
                        clothingImageUrl: item.clothingImageUrl, // Preserve clothing image URL
                        createdAt: item.createdAt || item.updatedAt || '',
                      };
                    })
                    .filter((item) => item !== null)
                    .sort((a, b) => {
                      if (!a.createdAt && !b.createdAt) return 0;
                      if (!a.createdAt) return 1;
                      if (!b.createdAt) return -1;
                      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                    })
                    .map(({ id, image, personImageUrl, clothingImageUrl, createdAt }) => ({ 
                      id, 
                      image, 
                      personImageUrl, 
                      clothingImageUrl,
                      createdAt
                    }));
                  console.log('[VirtualTryOnModal] Refetched history after generation:', history.length, history);
                  setHistoryItems(history);
                  
                  // Preload images and clear loading state once they're loaded
                  // This prevents skeleton loading from showing for cached/quick-loading images
                  const imageIds = history.map(h => h.id);
                  const immediatelyLoadedIds = new Set<string>();
                  
                  // Preload all images and track which ones load immediately (from cache)
                  history.forEach((item) => {
                    const img = new Image();
                    const proxiedUrl = getProxiedImageUrl(item.image);
                    
                    const handleLoad = () => {
                      setLoadingHistoryItemIds((prev) => {
                        const next = new Set(prev);
                        next.delete(item.id);
                        return next;
                      });
                    };
                    
                    img.onload = handleLoad;
                    img.onerror = handleLoad; // Clear loading state even on error
                    
                    img.src = proxiedUrl;
                    
                    // Check if image loaded synchronously (from cache)
                    if (img.complete && img.naturalWidth > 0) {
                      immediatelyLoadedIds.add(item.id);
                    }
                  });
                  
                  // Set loading state only for images that didn't load immediately
                  // Images that loaded immediately will have their onload fire before this,
                  // but we check anyway to avoid showing skeleton for cached images
                  const loadingIds = imageIds.filter(id => !immediatelyLoadedIds.has(id));
                  setLoadingHistoryItemIds(new Set(loadingIds));
                }
              }
            })
            .catch((error) => {
              console.error('[VirtualTryOnModal] Failed to refetch history after generation:', error);
            });
        }
      } else {
        throw new Error(result.error_message?.message || 'Generation failed');
      }
    } catch (err) {
      // Clear timers on error
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
        progressTimerRef.current = null;
      }
      if (elapsedTimerRef.current) {
        clearInterval(elapsedTimerRef.current);
        elapsedTimerRef.current = null;
      }

      const errorMessage = err instanceof Error ? err.message : t('virtualTryOnModal.somethingWentWrong');
      setError(errorMessage);
      setStep('idle');
      setProgress(0);
      toast.error(t('virtualTryOnModal.generationFailed'), {
        description: errorMessage,
      });
    }
  }, [uploadedImage, selectedClothing, selectedClothingKey, selectedDemoPhotoUrl, storeInfo, customerInfo, storedProductData, getProductData, selectedPersonBbox, isValidImage, t]);

  // Reset complete state when person image changes - works for both mobile and desktop
  useEffect(() => {
    // CRITICAL: Skip reset when loading history items
    // This prevents the reset from interfering with history loading
    if (isLoadingHistoryRef.current) {
      // Update ref but don't reset state when loading history
      prevUploadedImageRef.current = uploadedImage;
      return;
    }
    
    // CRITICAL: Skip reset when generating or when step is complete
    // This prevents the reset from interfering with generation or completed state
    if (step === 'generating' || step === 'complete') {
      // Update ref but don't reset state during generation or after completion
      prevUploadedImageRef.current = uploadedImage;
      return;
    }
    
    // Skip on initial mount (when prevUploadedImageRef.current is null and uploadedImage is also null)
    if (prevUploadedImageRef.current === null && uploadedImage === null) {
      prevUploadedImageRef.current = uploadedImage;
      return;
    }
    
    // Reset if the image changed (from one image to another, or from image to null, or from null to image)
    // This only happens for user uploads, not history loading, and only when step is idle
    if (prevUploadedImageRef.current !== uploadedImage && step === 'idle') {
      // Clear any running timers
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
        progressTimerRef.current = null;
      }
      if (elapsedTimerRef.current) {
        clearInterval(elapsedTimerRef.current);
        elapsedTimerRef.current = null;
      }
      
      // Reset all complete state
      setStep('idle');
      setGeneratedImage(null);
      setGeneratedImageError(false);
      setProgress(0);
      currentProgressRef.current = 0;
      setElapsedTime(0);
      setStatusMessage(null);
      setError(null);
      setSelectedSize(null); // Reset size selection since it's a new person
      setViewingPastTryOn(false);
      setViewingHistoryItem(null);
      setSelectedHistoryItemId(null);
    }
    
    // Update the ref for next comparison
    prevUploadedImageRef.current = uploadedImage;
  }, [uploadedImage, step]);

  // Handle going back to current try-on
  const handleBackToCurrent = useCallback(() => {
    // Clear viewing past try-on state
    setViewingPastTryOn(false);
    setViewingHistoryItem(null);
    setSelectedHistoryItemId(null);
    
    // Check if we have a current generation saved before viewing history
    const currentGen = currentGenerationRef.current;
    const storedGeneratedImage = storage.getGeneratedImage();
    
    // Priority: use ref (saved before viewing history), then storage, then check if we have images ready
    if (currentGen && currentGen.startsWith('data:image/')) {
      // Restore the current generation that was saved before viewing history
      setGeneratedImage(currentGen);
      setGeneratedImageError(false);
      
      // Also restore the images that were used for this generation
      // CRITICAL: Always restore from refs first, they were saved before viewing history
      if (currentUploadedImageRef.current) {
        setUploadedImage(currentUploadedImageRef.current);
        storage.saveUploadedImage(currentUploadedImageRef.current);
      }
      if (currentSelectedClothingRef.current) {
        setSelectedClothing(currentSelectedClothingRef.current);
        storage.saveClothingUrl(currentSelectedClothingRef.current);
      }
      
      setStep('complete');
    } else if (storedGeneratedImage && storedGeneratedImage.startsWith('data:image/')) {
      // Check if stored image is different from the history item we were viewing
      const wasHistoryImage = viewingHistoryItem?.image && 
                              (storedGeneratedImage === viewingHistoryItem.image || 
                               storedGeneratedImage.includes(viewingHistoryItem.image.split(',')[1]?.substring(0, 50) || ''));
      
      if (!wasHistoryImage) {
        // Stored image is current generation, restore it
        setGeneratedImage(storedGeneratedImage);
        setGeneratedImageError(false);
        
        // CRITICAL: Restore images from refs first (saved before viewing history)
        // Only fall back to storage if refs are null
        if (currentUploadedImageRef.current) {
          setUploadedImage(currentUploadedImageRef.current);
          storage.saveUploadedImage(currentUploadedImageRef.current);
        } else {
          const storedUploadedImage = storage.getUploadedImage();
          if (storedUploadedImage && storedUploadedImage.startsWith('data:image/')) {
            setUploadedImage(storedUploadedImage);
          }
        }
        
        if (currentSelectedClothingRef.current) {
          setSelectedClothing(currentSelectedClothingRef.current);
          storage.saveClothingUrl(currentSelectedClothingRef.current);
        } else {
          const storedClothingUrl = storage.getClothingUrl();
          if (storedClothingUrl && storedClothingUrl.startsWith('data:image/')) {
            setSelectedClothing(storedClothingUrl);
          }
        }
        
        setStep('complete');
      } else {
        // Stored image is the history one, restore from refs if available
        if (currentUploadedImageRef.current) {
          setUploadedImage(currentUploadedImageRef.current);
          storage.saveUploadedImage(currentUploadedImageRef.current);
        }
        if (currentSelectedClothingRef.current) {
          setSelectedClothing(currentSelectedClothingRef.current);
          storage.saveClothingUrl(currentSelectedClothingRef.current);
        }
        
        // Check if we have images ready to generate
        const hasUploadedImage = currentUploadedImageRef.current || uploadedImage;
        const hasSelectedClothing = currentSelectedClothingRef.current || selectedClothing;
        
        if (hasUploadedImage && hasSelectedClothing) {
          setStep('idle');
          setGeneratedImage(null);
          setGeneratedImageError(false);
        } else {
          // No images, reset to first step
          setStep('idle');
          setGeneratedImage(null);
          setGeneratedImageError(false);
          setProgress(0);
        }
      }
    } else if (uploadedImage && selectedClothing) {
      // We have images ready but no current generation, go to idle state to allow generation
      setStep('idle');
      setGeneratedImage(null);
      setGeneratedImageError(false);
    } else {
      // No current generation and no images ready, reset to first step
      setStep('idle');
      setGeneratedImage(null);
      setGeneratedImageError(false);
      setProgress(0);
    }
  }, [uploadedImage, selectedClothing, viewingHistoryItem]);
  
  // Handle regenerating past try-on
  const handleRegeneratePastTryOn = useCallback(async () => {
    if (!viewingHistoryItem) return;
    
    try {
      // Reset viewing state
      setViewingPastTryOn(false);
      setViewingHistoryItem(null);
      setSelectedHistoryItemId(null);
      setStep('idle');
      setGeneratedImage(null);
      setGeneratedImageError(false);
      setProgress(0);
      setError(null);
      
      // Load the images from the history item
      let personImageDataURL: string | null = null;
      let clothingImageDataURL: string | null = null;
      
      // Load person image from history item
      if (viewingHistoryItem.personImageUrl) {
        try {
          const proxiedPersonUrl = getProxiedImageUrl(viewingHistoryItem.personImageUrl);
          const personBlob = await fetch(proxiedPersonUrl).then(res => {
            if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
            return res.blob();
          });
          
          const personReader = new FileReader();
          personImageDataURL = await new Promise<string>((resolve, reject) => {
            personReader.onloadend = () => resolve(personReader.result as string);
            personReader.onerror = reject;
            personReader.readAsDataURL(personBlob);
          });
          
          if (personImageDataURL && personImageDataURL.startsWith('data:image/')) {
            setUploadedImage(personImageDataURL);
            storage.saveUploadedImage(personImageDataURL);
            setSelectedDemoPhotoUrl(null);
            setPhotoSelectionMethod('file');
          }
        } catch (error) {
          console.warn('[VirtualTryOnModal] Failed to load person image for regenerate:', error);
        }
      }
      
      // Load clothing image from history item
      if (viewingHistoryItem.clothingImageUrl) {
        try {
          const proxiedClothingUrl = getProxiedImageUrl(viewingHistoryItem.clothingImageUrl);
          const clothingBlob = await fetch(proxiedClothingUrl).then(res => {
            if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
            return res.blob();
          });
          
          const clothingReader = new FileReader();
          clothingImageDataURL = await new Promise<string>((resolve, reject) => {
            clothingReader.onloadend = () => resolve(clothingReader.result as string);
            clothingReader.onerror = reject;
            clothingReader.readAsDataURL(clothingBlob);
          });
          
          if (clothingImageDataURL && clothingImageDataURL.startsWith('data:image/')) {
            setSelectedClothing(clothingImageDataURL);
            storage.saveClothingUrl(clothingImageDataURL);
            
            // Try to find the clothing key/id
            const clothingId = productImagesWithIds.get(clothingImageDataURL) || null;
            setSelectedClothingKey(clothingId);
          }
        } catch (error) {
          console.warn('[VirtualTryOnModal] Failed to load clothing image for regenerate:', error);
        }
      }
      
      // Wait a bit for state to update, then trigger generation
      // Use the loaded images or fallback to current state
      setTimeout(() => {
        const finalPersonImage = personImageDataURL || uploadedImage;
        const finalClothingImage = clothingImageDataURL || selectedClothing;
        
        if (finalPersonImage && finalClothingImage) {
          void handleGenerate();
        } else {
          toast.error(t('virtualTryOnModal.imageCouldNotBeLoaded'));
        }
      }, 200);
    } catch (error) {
      console.error('[VirtualTryOnModal] Failed to regenerate past try-on:', error);
      toast.error(t('virtualTryOnModal.generationFailed'));
    }
  }, [viewingHistoryItem, uploadedImage, selectedClothing, handleGenerate, getProxiedImageUrl, productImagesWithIds]);

  // Handle change photo button click - clear current photo and show upload options
  const handleChangePhoto = useCallback(() => {
    // Reset to step 1 (idle) to show file picker and photo selection UI
    setStep('idle');
    setProgress(0);
    setError(null);
    setGeneratedImage(null);
    setGeneratedImageError(false);
    
    // Clear uploaded image and related state
    setUploadedImage(null);
    setUploadedImageForDetection(null);
    setSelectedPhoto(null);
    setSelectedDemoPhotoUrl(null);
    setPhotoSelectionMethod(null);
    
    // Reset person selection (for /widget-test path)
    if (isWidgetTestPath()) {
      setSelectedPersonBbox(null);
      setSelectedPersonIndex(null);
    }
    
    // Clear storage
    storage.saveUploadedImage(null);
    storage.saveGeneratedImage(null);
    
    // Show change photo options to display upload/selection UI
    setShowChangePhotoOptions(true);
    
    console.log('[VirtualTryOnModal] Change photo - reset to step 1, ready for photo selection');
  }, []);

  // Handle regenerate with new photo when step is complete (not viewing history)
  const handleRegenerateWithNewPhoto = useCallback(() => {
    // CRITICAL: Ensure we're not viewing a past try-on
    setViewingPastTryOn(false);
    setViewingHistoryItem(null);
    setSelectedHistoryItemId(null);
    
    // Reset generation state
    setStep('idle');
    setProgress(0);
    setError(null);
    setGeneratedImage(null);
    setGeneratedImageError(false);
    
    // Reset photo selection (but keep clothing)
    setUploadedImage(null);
    setUploadedImageForDetection(null);
    setSelectedPhoto(null);
    setSelectedDemoPhotoUrl(null);
    setPhotoSelectionMethod(null);
    
    // Reset person selection (for /widget-test path)
    if (isWidgetTestPath()) {
      setSelectedPersonBbox(null);
      setSelectedPersonIndex(null);
    }
    
    // Show change photo options to display upload/selection UI
    setShowChangePhotoOptions(true);
    
    // Clear storage
    storage.saveUploadedImage(null);
    storage.saveGeneratedImage(null);
    
    console.log('[VirtualTryOnModal] Regenerate with new photo - reset complete, ready for photo selection');
  }, []);

  // Handle add to cart
  const handleAddToCart = useCallback(() => {
    // Only require size selection if sizes are available
    if (sizes.length > 0 && !selectedSize) {
      toast.error(t('virtualTryOnModal.selectSizeToContinue'));
      return;
    }

    setIsAddToCartLoading(true);
    const isInIframe = window.parent !== window;
    const currentProductData = getProductData() || productData;

    // Get variant ID for selected size (if sizes are available)
    let variantId: string | number | null = null;
    if (sizes.length > 0 && selectedSize) {
      const selectedSizeInfo = sizeAvailability.find(s => s.size === selectedSize);
      
      if (!selectedSizeInfo || !selectedSizeInfo.isAvailable) {
        setIsAddToCartLoading(false);
        toast.error(t('virtualTryOnModal.selectSizeToContinue'));
        return;
      }
      
      variantId = selectedSizeInfo.variantId;
    }

    // Fallback to default variant if no size selection needed
    if (!variantId) {
      variantId = currentProductData?.variantId || 
                  currentProductData?.variants?.[0]?.id || 
                  currentProductData?.selectedVariantId ||
                  null;
    }

    if (isInIframe) {
      if (!variantId && sizes.length > 0) {
        setIsAddToCartLoading(false);
        toast.error(t('virtualTryOnModal.selectSizeToContinue'));
        return;
      }

      const message = {
        type: 'NUSENSE_ADD_TO_CART',
        ...(currentProductData && { product: currentProductData }),
        quantity: cartQuantity,
        ...(variantId && { variantId: variantId }),
      };
      window.parent.postMessage(message, '*');

      // Safety timeout
      setTimeout(() => {
        setIsAddToCartLoading(false);
      }, 10000);
    } else {
      setIsAddToCartLoading(false);
      const productTitle = currentProductData?.title || currentProductData?.name || t('virtualTryOnModal.product');
      const sizeText = selectedSize ? ` (${t('virtualTryOnModal.size')} ${selectedSize})` : '';
      setToastMessage(t('virtualTryOnModal.addedToCart', { productTitle, sizeText }));
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    }
  }, [selectedSize, sizes, productData, cartQuantity, getProductData, sizeAvailability, t]);

  // Handle buy now
  const handleBuyNow = useCallback(() => {
    // Only require size selection if sizes are available
    if (sizes.length > 0 && !selectedSize) {
      toast.error(t('virtualTryOnModal.selectSizeToContinue'));
      return;
    }

    setIsBuyNowLoading(true);
    const isInIframe = window.parent !== window;
    const currentProductData = storedProductData || getProductData();

    // Get variant ID for selected size (if sizes are available)
    let variantId: string | number | null = null;
    if (sizes.length > 0 && selectedSize) {
      const selectedSizeInfo = sizeAvailability.find(s => s.size === selectedSize);
      variantId = selectedSizeInfo?.variantId || null;
    }

    // Fallback to default variant if no size selection needed
    if (!variantId) {
      variantId = currentProductData?.variantId || 
                  currentProductData?.variants?.[0]?.id || 
                  currentProductData?.selectedVariantId ||
                  null;
    }

    if (isInIframe) {
      const message = {
        type: 'NUSENSE_BUY_NOW',
        ...(currentProductData && { product: currentProductData }),
        quantity: cartQuantity,
        ...(variantId && { variantId: variantId }),
      };
      window.parent.postMessage(message, '*');

      toast.info('Redirecting to checkout...');
      setTimeout(() => {
        setIsBuyNowLoading(false);
      }, 10000);
    } else {
      setIsBuyNowLoading(false);
      toast.info('Buy now feature requires Shopify integration');
    }
  }, [selectedSize, sizes, storedProductData, cartQuantity, getProductData, sizeAvailability, t]);

  // Handle reset
  const handleReset = useCallback(() => {
    setStep('idle');
    setUploadedImage(null);
    setUploadedImageForDetection(null);
    currentGenerationRef.current = null; // Clear current generation ref
    currentUploadedImageRef.current = null; // Clear current uploaded image ref
    currentSelectedClothingRef.current = null; // Clear current selected clothing ref
    // Don't clear selectedClothing and selectedClothingKey - keep the product image visible in "YOU'RE TRYING ON" section
    setSelectedDemoPhotoUrl(null);
    setPhotoSelectionMethod(null);
    setGeneratedImage(null);
    setGeneratedImageError(false);
    setProgress(0);
    currentProgressRef.current = 0;
    setElapsedTime(0);
    setError(null);
    setSelectedSize(null);
    setSelectedHistoryItemId(null); // Clear history selection
    setViewingPastTryOn(false);
    setViewingHistoryItem(null);
    // Only clear uploaded image and generated result from storage, keep clothing selection
    storage.saveUploadedImage(null);
    storage.saveGeneratedImage(null);
  }, []);

  // Handle close
  const handleClose = useCallback(() => {
    if (isInIframe) {
      try {
        window.parent.postMessage({ type: 'NUSENSE_CLOSE_WIDGET' }, '*');
      } catch (error) {
        console.error('[VirtualTryOnModal] Failed to send close message:', error);
      }
    }
  }, [isInIframe]);

  // Cleanup timers
  useEffect(() => {
    return () => {
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
      }
      if (elapsedTimerRef.current) {
        clearInterval(elapsedTimerRef.current);
      }
    };
  }, []);

  // Lock body scroll when modal is open
  useEffect(() => {
    // Save current overflow style
    const originalOverflow = document.body.style.overflow;
    const originalPaddingRight = document.body.style.paddingRight;
    
    // Calculate scrollbar width to prevent layout shift
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    
    // Lock scroll
    document.body.style.overflow = 'hidden';
    document.body.style.paddingRight = scrollbarWidth > 0 ? `${scrollbarWidth}px` : '0px';
    
    // Cleanup: restore original styles
    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.paddingRight = originalPaddingRight;
    };
  }, []);

  // Listen for ESC key to close
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleClose]);

  // Get product info for display
  const currentProductData = getProductData() || productData;
  const productTitle = currentProductData?.title || currentProductData?.name || t('virtualTryOnModal.product');
  
  // Always use the currently selected clothing image, or first product image
  // Use useMemo to ensure it updates when selectedClothing or productImages change
  const productImage = useMemo(() => {
    return selectedClothing || productImages[0] || null;
  }, [selectedClothing, productImages]);
  
  // Get variant information for display
  const getVariantInfo = useCallback(() => {
    if (!currentProductData) return null;
    
    // Try to get selected variant
    let selectedVariant: any = null;
    const variants = (currentProductData as any)?.variants?.nodes || 
                     (currentProductData as any)?.variants || 
                     [];
    
    // Check for selected variant ID
    let selectedVariantId: string | number | null = null;
    try {
      if (typeof window !== 'undefined' && window.location) {
        const urlParams = new URLSearchParams(window.location.search);
        const variantParam = urlParams.get('variant');
        if (variantParam) selectedVariantId = variantParam;
      }
    } catch {}
    
    if (!selectedVariantId) {
      selectedVariantId = (currentProductData as any)?.selectedVariantId ?? 
                          (currentProductData as any)?.variantId ?? 
                          null;
    }
    
    if (selectedVariantId && variants.length > 0) {
      selectedVariant = variants.find((v: any) =>
        String(v?.id) === String(selectedVariantId) || 
        String(v?.variant_id) === String(selectedVariantId)
      );
    }
    
    // If no selected variant, use first variant
    if (!selectedVariant && variants.length > 0) {
      selectedVariant = variants[0];
    }
    
    if (!selectedVariant) return null;
    
    // Extract variant options (excluding size)
    const selectedOptions = selectedVariant?.selectedOptions || selectedVariant?.options || [];
    const variantInfo: string[] = [];
    
    selectedOptions.forEach((opt: any) => {
      const optionName = opt?.name?.toLowerCase() || '';
      const optionValue = opt?.value || '';
      
      // Skip size option as it's shown separately
      if (optionName !== 'size' && optionName !== 'taille' && optionName !== 'sizes' && optionValue) {
        variantInfo.push(optionValue);
      }
    });
    
    return variantInfo.length > 0 ? variantInfo.join(' • ') : null;
  }, [currentProductData]);
  
  const variantInfo = useMemo(() => getVariantInfo(), [getVariantInfo]);

  // Ensure step is 'complete' when viewing history and generatedImage is set
  // CRITICAL FIX: This ensures that whenever generatedImage changes while viewing history,
  // step is set to 'complete' so the image renders immediately
  useEffect(() => {
    if (viewingPastTryOn && generatedImage && !generatedImageError && step !== 'complete') {
      // If we're viewing history and have a generated image, ensure step is 'complete'
      setStep('complete');
    }
  }, [viewingPastTryOn, generatedImage, generatedImageError, step]);

  // Auto-scroll to top when a history item is selected
  // This happens AFTER the selection indicator (red radio with white border) is visible
  // The indicator has a 200ms animation, so we wait for that + React rendering time
  useEffect(() => {
    if (selectedHistoryItemId && viewingPastTryOn && mainContentRef.current) {
      // Wait for selection indicator animation to complete (200ms) + React rendering buffer
      const scrollTimeout = setTimeout(() => {
        if (mainContentRef.current) {
          mainContentRef.current.scrollTo({
            top: 0,
            behavior: 'smooth',
          });
        }
      }, 250); // 200ms animation + 50ms buffer for React rendering

      return () => clearTimeout(scrollTimeout);
    }
  }, [selectedHistoryItemId, viewingPastTryOn]);

  // Auto-scroll to generated image when it appears - ONLY for mobile, disabled for desktop
  useEffect(() => {
    if (step === 'complete' && generatedImage && !generatedImageError && generatedImageRef.current && mainContentRef.current) {
      const isMobile = isMobileDevice();
      
      // Disable auto-scroll completely for desktop layout
      if (!isMobile) {
        return;
      }
      
      // Delay scroll to allow glow animation to start (mobile only)
      const delay = 600;
      
      const scrollTimeout = setTimeout(() => {
        const imageElement = generatedImageRef.current;
        const container = mainContentRef.current;
        
        if (imageElement && container) {
          // Calculate position relative to scroll container
          const containerRect = container.getBoundingClientRect();
          const imageRect = imageElement.getBoundingClientRect();
          
          // Only scroll if image is not already visible in viewport
          const isImageVisible = 
            imageRect.top >= containerRect.top &&
            imageRect.bottom <= containerRect.bottom;
          
          if (!isImageVisible) {
            // Mobile: Scroll to top of image
            const scrollOffset = 10;
            
            const scrollPosition = 
              imageElement.offsetTop - 
              container.offsetTop - 
              scrollOffset;
            
            requestAnimationFrame(() => {
              container.scrollTo({
                top: Math.max(0, scrollPosition),
                behavior: 'auto'
              });
            });
          }
        }
      }, delay);

      return () => clearTimeout(scrollTimeout);
    }
  }, [step, generatedImage, isMobileDevice]);

  // Note: Auto-scroll to generating section is handled directly in handleGenerate
  // for immediate, reliable scrolling on both mobile and desktop

  // Auto-scroll removed - no scrolling on photo selection

  // Auto-scroll removed - no scrolling on clothing selection

  // Auto-scroll/focus after size selection - ONLY for mobile
  useEffect(() => {
    if (selectedSize && step === 'complete' && addToCartButtonRef.current) {
      const isMobile = isMobileDevice();
      if (isMobile) {
        // Use requestAnimationFrame for immediate but smooth scroll
        requestAnimationFrame(() => {
          scrollToElement(addToCartButtonRef, 10, 'smooth', 'add-to-cart');
        });
      } else {
        // Desktop: Only focus (no scrolling)
        requestAnimationFrame(() => {
          if (addToCartButtonRef.current) {
            addToCartButtonRef.current.focus();
          }
        });
      }
    }
  }, [selectedSize, step, scrollToElement, isMobileDevice]);

  // Helper function to clamp and validate bounding box values
  const clampBoundingBox = useCallback((bbox: [number, number, number, number], imageWidth?: number, imageHeight?: number): PersonBbox => {
    let [x, y, width, height] = bbox;
    
    // Clamp x and y to be at least 0 (prevent negative coordinates)
    x = Math.max(0, x);
    y = Math.max(0, y);
    
    // Ensure width and height are positive
    width = Math.max(0, width);
    height = Math.max(0, height);
    
    // If image dimensions are available, ensure bbox doesn't exceed image boundaries
    if (imageWidth && imageHeight) {
      // Adjust width if it extends beyond image width
      if (x + width > imageWidth) {
        width = Math.max(0, imageWidth - x);
      }
      // Adjust height if it extends beyond image height
      if (y + height > imageHeight) {
        height = Math.max(0, imageHeight - y);
      }
    }
    
    return { x, y, width, height };
  }, []);

  // Handle person selection inline
  const handlePersonSelect = useCallback((personIndex: number) => {
    if (!detectionResult || !detectionResult.people || personIndex < 0 || personIndex >= detectionResult.people.length) return;
    
    const selectedPerson = detectionResult.people[personIndex];
    if (!selectedPerson) return;
    
    setSelectedPersonIndex(personIndex);
    
    // Convert bbox to PersonBbox format with clamping to ensure all values are positive
    const clampedBbox = clampBoundingBox(
      selectedPerson.bbox,
      detectionResult.imageWidth,
      detectionResult.imageHeight
    );
    
    console.log('[VirtualTryOnModal] Person selected:', {
      originalBbox: selectedPerson.bbox,
      clampedBbox,
      imageDimensions: {
        width: detectionResult.imageWidth,
        height: detectionResult.imageHeight
      }
    });
    
    setSelectedPersonBbox(clampedBbox);
  }, [detectionResult, clampBoundingBox]);
  
  // Auto-select if only one person detected
  useEffect(() => {
    if (detectionResult && detectionResult.people && detectionResult.people.length === 1 && selectedPersonIndex === null) {
      handlePersonSelect(0);
    }
  }, [detectionResult, selectedPersonIndex, handlePersonSelect]);
  
  // Following CANVAS_POSITIONING_GUIDE.md: State Persistence for Refresh Recovery
  // Save detection results to localStorage
  useEffect(() => {
    if (detectionResult && uploadedImage) {
      try {
        // Store detection results (without image data)
        const dataToStore = {
          people: detectionResult.people,
          inferenceTime: detectionResult.inferenceTime,
          imageId: detectionResult.imageId,
          imageWidth: detectionResult.imageWidth,
          imageHeight: detectionResult.imageHeight,
          imageUrl: uploadedImage, // Store URL for recovery
          timestamp: Date.now()
        };
        localStorage.setItem('personDetectionResult', JSON.stringify(dataToStore));
      } catch (error) {
        console.warn('[PersonSelection] Failed to save detection results:', error);
      }
    }
  }, [detectionResult, uploadedImage]);
  
  // Restore detection results on mount (following guide)
  useEffect(() => {
    if (detectionResult) {
      // Already have detection result, skip restoration
      return;
    }
    
    try {
      const stored = localStorage.getItem('personDetectionResult');
      if (stored) {
        const data = JSON.parse(stored);
        // Check if data is recent (less than 1 hour old)
        if (Date.now() - data.timestamp < 3600000) {
          // Only restore if we have the same image URL
          if (data.imageUrl && uploadedImage && (
            data.imageUrl === uploadedImage || 
            (data.imageUrl.startsWith('data:') && uploadedImage.startsWith('data:') && data.imageUrl === uploadedImage) ||
            (data.imageUrl.split('?')[0] === uploadedImage.split('?')[0])
          )) {
            // Note: We can't directly set detectionResult as it comes from usePersonDetection hook
            // The hook will handle detection automatically when imageUrl is set
            // This restoration is mainly for reference - actual detection will happen via hook
            console.log('[PersonSelection] Found stored detection result for current image');
          } else {
            // Data is for different image, clear it
            localStorage.removeItem('personDetectionResult');
          }
        } else {
          // Data is too old, clear it
          localStorage.removeItem('personDetectionResult');
        }
      }
    } catch (error) {
      console.warn('[PersonSelection] Failed to restore detection results:', error);
      localStorage.removeItem('personDetectionResult');
    }
  }, []); // Only run on mount
  
  // Following CANVAS_POSITIONING_GUIDE.md: Redraw canvas when detection result changes
  useEffect(() => {
    if (detectionResult && uploadedImage && detectionImageRef.current && canvasRef.current) {
      // Small delay to ensure DOM is ready
      const timer = setTimeout(() => {
        if (detectionImageRef.current && detectionResult && canvasRef.current) {
          // Trigger redraw by calling drawBoundingBoxes if canvas drawing useEffect is active
          // The canvas drawing useEffect will handle the actual redraw
          // We just need to ensure it runs when detectionResult changes
          console.log('[PersonSelection] Detection result changed, canvas will redraw');
        }
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [detectionResult, uploadedImage]);
  
  // Following CANVAS_POSITIONING_GUIDE.md: Redraw canvas when component becomes visible (popup reopen)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && detectionResult && detectionImageRef.current && canvasRef.current && uploadedImage) {
        // Component is visible again, increment counter to trigger canvas redraw
        setVisibilityChangeCounter(prev => prev + 1);
        console.log('[PersonSelection] Component visible again, triggering canvas redraw');
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [detectionResult, uploadedImage]);
  
  // Check if we should show the person selection UI (more than 1 person detected - keep visible even after selection)
  const showPersonSelection = useMemo(() => {
    const isTestPath = isWidgetTestPath();
    
    // Ensure we return a boolean explicitly
    // Keep UI visible even after selection so users can change their selection
    // NOTE: This indicates "person selection MODE", not necessarily that canvas is visible
    const result = Boolean(
      isTestPath && 
      shouldDetectPeople && 
      !isLoadingModels && 
      !isDetecting && 
      !detectionError && 
      detectionResult?.people && 
      detectionResult.people.length > 1
    );
    
    // Debug logging
    if (isTestPath && shouldDetectPeople) {
      console.log('[PersonSelection] showPersonSelection check:', {
        isTestPath,
        shouldDetectPeople,
        isLoadingModels,
        isDetecting,
        detectionError,
        hasDetectionResult: !!detectionResult,
        peopleCount: detectionResult?.people?.length || 0,
        boundingBoxesDrawn,
        selectedPersonIndex,
        result,
        uploadedImage: !!uploadedImage,
        showChangePhotoOptions
      });
    }
    
    // Log when result changes to true
    if (result) {
      console.log('[PersonSelection] ✅ Person selection MODE enabled!', {
        peopleCount: detectionResult?.people?.length,
        boundingBoxesDrawn,
        detectionResult
      });
    }
    
    return result;
  }, [shouldDetectPeople, isLoadingModels, isDetecting, detectionError, detectionResult, selectedPersonIndex, uploadedImage, showChangePhotoOptions, boundingBoxesDrawn]);
  
  // Debug: Log when showPersonSelection changes
  useEffect(() => {
    console.log('[PersonSelection] showPersonSelection changed:', showPersonSelection);
    if (showPersonSelection) {
      console.log('[PersonSelection] ✅ UI should be visible now!');
    }
  }, [showPersonSelection]);
  
  // Get button state - MUST be defined after showPersonSelection
  const getButtonState = useCallback(() => {
    if (step === 'idle') {
      const hasValidImage = isValidImage(uploadedImage);
      const canGenerate = hasValidImage && selectedClothing;
      
      // CRITICAL: If person selection is required (multiple people detected), 
      // disable button until a person is selected
      const needsPersonSelection = showPersonSelection && selectedPersonIndex === null;
      
      // If person selection is needed but not completed
      if (needsPersonSelection) {
        return {
          text: t('virtualTryOnModal.selectPersonFirst'),
          icon: <Zap size={16} />,
          disabled: true,
          action: () => {},
          color: 'gray',
        };
      }
      
      return {
        text: !canGenerate ? t('virtualTryOnModal.chooseAPhoto') : t('virtualTryOnModal.generate'),
        icon: <Zap size={16} />,
        disabled: !canGenerate,
        action: handleGenerate,
        color: canGenerate ? 'orange' : 'gray',
      };
    }
    if (step === 'generating') {
      return {
        text: t('virtualTryOnModal.generatingButton'),
        icon: <Loader2 size={16} className="animate-spin" />,
        disabled: true,
        action: () => {},
        color: 'gray',
      };
    }
    if (step === 'complete') {
      // If sizes are available, require size selection
      if (sizes.length > 0) {
        if (!selectedSize) {
          return {
            text: t('virtualTryOnModal.selectSizeToContinue'),
            icon: <Zap size={16} />,
            disabled: true,
            action: () => {},
            color: 'gray',
          };
        }
        
      }
      
      // Always show add to cart regardless of availability
      return {
        text: currentCartQuantity > 0 ? t('virtualTryOnModal.addToCartWithQuantity', { quantity: currentCartQuantity }) : t('virtualTryOnModal.addToCart'),
        icon: <ShoppingCart size={16} />,
        disabled: isAddToCartLoading || isBuyNowLoading,
        action: handleAddToCart,
        color: 'orange',
      };
    }
    return {
      text: t('virtualTryOnModal.generate'),
      icon: null,
      disabled: false,
      action: handleGenerate,
      color: 'gray',
    };
  }, [step, uploadedImage, selectedClothing, progress, selectedSize, sizes, sizeAvailability, isAddToCartLoading, isBuyNowLoading, currentCartQuantity, variantStockInfo, handleGenerate, handleAddToCart, isValidImage, t, showPersonSelection, selectedPersonIndex]);

  const btnState = getButtonState();
  
  // CRITICAL: Check if modal is fully preloaded and ready to show UI
  useEffect(() => {
    // Determine what needs to be ready based on current state
    const needsPersonDetection = isWidgetTestPath() && uploadedImage && !showChangePhotoOptions;
    const needsBoundingBoxes = showPersonSelection && detectionResult?.people && detectionResult.people.length > 0;
    
    // Check if everything is ready:
    // 1. If person detection is needed, wait for detection to complete
    // 2. If bounding boxes are needed, wait for them to be drawn
    // 3. Image should be loaded (handled by detection/boxes)
    
    let isReady = true;
    
    if (needsPersonDetection) {
      // Only wait for model to load (instant with caching), not for detection
      // This allows showing the image immediately while detection runs in background
      if (isLoadingModels) {
        isReady = false;
      }
      // Note: We no longer block on isDetecting - image shows immediately with skeleton overlay
    }
    
    if (needsBoundingBoxes) {
      // CRITICAL: Wait for either:
      // 1. Bounding boxes successfully drawn, OR
      // 2. Detection finished (even if drawing failed due to validation errors)
      // This prevents infinite loading when canDraw() returns false
      const detectionFinished = !isDetecting && detectionResult !== null;
      const boxesDrawn = boundingBoxesDrawnRef.current;
      
      if (!detectionFinished && !boxesDrawn) {
        // Still waiting for detection to complete
        isReady = false;
      }
      // If detection finished but boxes not drawn, still show UI (validation may have failed)
      // User will see error in console and can try again
    }
    
    // If image is uploaded but not yet validated, wait
    if (uploadedImage && detectionImageRef.current) {
      const img = detectionImageRef.current;
      const imageId = generateImageId(uploadedImage);
      const validation = validateImageReady(img, imageId);
      if (!validation.ready) {
        isReady = false;
      }
    }
    
    // If no uploaded image yet, modal is ready (will show upload UI)
    if (!uploadedImage) {
      isReady = true;
    }
    
    // Set preloaded state
    setIsModalPreloaded(isReady);
    
    if (isReady) {
      console.log('[ModalPreload] ✅ Modal is fully preloaded and ready to show UI');
    } else {
      console.log('[ModalPreload] ⏳ Modal still preloading...', {
        needsPersonDetection,
        needsBoundingBoxes,
        isLoadingModels,
        isDetecting,
        boundingBoxesDrawn: boundingBoxesDrawnRef.current,
        hasDetectionResult: !!detectionResult,
        hasUploadedImage: !!uploadedImage
      });
    }
  }, [
    uploadedImage,
    showPersonSelection,
    showChangePhotoOptions,
    isLoadingModels,
    isDetecting,
    detectionResult,
    detectionError,
    boundingBoxesDrawn,
    detectionImageRef
  ]);
  
  // Canvas drawing for person selection (only when showPersonSelection is true)
  // CRITICAL: This is now purely event-driven with NO setTimeout delays
  useEffect(() => {
    // Reset bounding boxes drawn state when conditions change
    setBoundingBoxesDrawn(false);
    boundingBoxesDrawnRef.current = false;
    
    if (!showPersonSelection || !detectionResult?.people || detectionResult.people.length === 0 || !detectionImageRef.current || !canvasRef.current || !uploadedImage) {
      console.log('[PersonSelection] Canvas drawing skipped - conditions not met:', {
        showPersonSelection,
        hasPeople: !!detectionResult?.people && detectionResult.people.length > 0,
        hasImageRef: !!detectionImageRef.current,
        hasCanvasRef: !!canvasRef.current,
        hasUploadedImage: !!uploadedImage
      });
      return;
    }
    
    const canvas = canvasRef.current;
    const img = detectionImageRef.current;
    const container = canvasContainerRef.current;
    
    if (!img || !container) {
      console.warn('[PersonSelection] Required refs not available');
      return;
    }
    
    // Store the current uploadedImage to track if it changes
    const currentUploadedImage = uploadedImage;
    const currentImageId = generateImageId(uploadedImage);
    
    // CRITICAL: Ensure image src is set correctly
    const needsSrcUpdate = uploadedImage.startsWith('data:') 
      ? img.src !== uploadedImage 
      : uploadedImage && (!img.src.includes(uploadedImage.split('?')[0]) && !uploadedImage.includes(img.src.split('?')[0]));
    
    if (needsSrcUpdate && uploadedImage) {
      const oldImageId = generateImageId(img.src);
      clearCachedDimensions(oldImageId);
      img.src = uploadedImage;
      console.log('[PersonSelection] Updated image src:', uploadedImage.substring(0, 50) + '...');
      
      // Clear canvas while image loads
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width || 1, canvas.height || 1);
      }
      // Image load event will trigger drawing when ready
      return;
    }
    
    // Verify image src matches
    const imgSrc = img.src;
    const expectedSrc = currentUploadedImage.startsWith('data:image/')
      ? currentUploadedImage
      : currentUploadedImage.split('?')[0];
    const actualSrc = imgSrc.startsWith('data:image/')
      ? imgSrc
      : imgSrc.split('?')[0];
    
    if (!actualSrc.includes(expectedSrc) && !expectedSrc.includes(actualSrc)) {
      console.warn('[PersonSelection] Image src mismatch:', {
        expectedSrc: expectedSrc.substring(0, 50),
        actualSrc: actualSrc.substring(0, 50)
      });
      return;
    }
    
    // CRITICAL: Function to check if ALL conditions are met for drawing
    // This is synchronous and returns true/false immediately
    const canDraw = (): boolean => {
      // Check image src matches
      const currentSrc = currentUploadedImage.startsWith('data:image/') 
        ? img.src 
        : img.src.split('?')[0];
      const expectedSrc = currentUploadedImage.startsWith('data:image/')
        ? currentUploadedImage
        : currentUploadedImage.split('?')[0];
      
      if (!currentSrc.includes(expectedSrc) && !expectedSrc.includes(currentSrc)) {
        console.log('[PersonSelection] Cannot draw - image src mismatch');
        return false;
      }
      
      // Check detection result exists
      if (!detectionResult) {
        console.log('[PersonSelection] Cannot draw - no detection result');
        return false;
      }
      
      // Check detection matches current image
      if (detectionResult.imageId && detectionResult.imageId !== currentImageId) {
        console.log('[PersonSelection] Cannot draw - detection ID mismatch');
        return false;
      }
      
      // Check image is fully loaded and ready
      const validation = validateImageReady(img, currentImageId);
      if (!validation.ready) {
        console.log('[PersonSelection] Cannot draw - image not ready');
        return false;
      }
      
      // Check detection dimensions match image dimensions
      if (detectionResult.imageWidth !== undefined && detectionResult.imageHeight !== undefined) {
        const widthDiff = Math.abs(detectionResult.imageWidth - validation.width);
        const heightDiff = Math.abs(detectionResult.imageHeight - validation.height);
        if (widthDiff > 1 || heightDiff > 1) {
          console.log('[PersonSelection] Cannot draw - dimension mismatch:', {
            detectionDims: `${detectionResult.imageWidth}x${detectionResult.imageHeight}`,
            imageDims: `${validation.width}x${validation.height}`
          });
          return false;
        }
      }
      
      // Check container is available and has valid dimensions
      const containerRect = container?.getBoundingClientRect();
      if (!containerRect || containerRect.width < 50 || !isFinite(containerRect.width)) {
        console.log('[PersonSelection] Cannot draw - container not ready:', {
          width: containerRect?.width
        });
        return false;
      }
      
      return true;
    };
    
    const drawBoundingBoxes = () => {
      // CRITICAL: Check if we can draw - NO setTimeout retries!
      if (!canDraw()) {
        console.log('[PersonSelection] Skipping draw - conditions not met');
        
        // CRITICAL: If detection is complete but we can't draw (validation failed),
        // set a flag so UI doesn't wait forever
        if (!isDetecting && detectionResult !== null) {
          console.warn('[PersonSelection] Detection complete but cannot draw - validation failed. Marking as done to prevent infinite loading.');
          // Don't set boundingBoxesDrawn to true - this signals drawing actually failed
          // The isModalPreloaded logic will handle showing UI anyway
        }
        return;
      }
      
      // All conditions met - proceed with drawing
      const validation = validateImageReady(img, currentImageId);
      
      const naturalWidth = validation.width;
      const naturalHeight = validation.height;
      
      // Verify image ID matches (prevents using detection from wrong image)
      if (validation.imageId !== currentImageId) {
        console.warn('[PersonSelection] Image ID mismatch - image may have changed:', {
          expectedId: currentImageId,
          actualId: validation.imageId
        });
        return;
      }
      
      // CRITICAL: Verify detection dimensions match current image dimensions
      // This is the most important check - if dimensions don't match, coordinates will be wrong
      // We allow a small tolerance (1px) for rounding errors
      console.log('[PersonSelection] DIMENSION VALIDATION:', {
        detectionHasDimensions: detectionResult.imageWidth !== undefined && detectionResult.imageHeight !== undefined,
        detectionDimensions: detectionResult.imageWidth && detectionResult.imageHeight 
          ? `${detectionResult.imageWidth}x${detectionResult.imageHeight}` 
          : 'MISSING',
        currentImageDimensions: `${naturalWidth}x${naturalHeight}`,
        detectionImageId: detectionResult.imageId || 'MISSING',
        currentImageId,
        detectionResultKeys: Object.keys(detectionResult),
        peopleCount: detectionResult.people?.length || 0
      });
      
      if (detectionResult.imageWidth !== undefined && detectionResult.imageHeight !== undefined) {
        const widthDiff = Math.abs(detectionResult.imageWidth - naturalWidth);
        const heightDiff = Math.abs(detectionResult.imageHeight - naturalHeight);
        const tolerance = 1; // Allow 1px difference for rounding
        
        if (widthDiff > tolerance || heightDiff > tolerance) {
          console.error('[PersonSelection] ❌ DIMENSION MISMATCH - ABORTING DRAW:', {
            detectionDimensions: `${detectionResult.imageWidth}x${detectionResult.imageHeight}`,
            currentDimensions: `${naturalWidth}x${naturalHeight}`,
            widthDiff,
            heightDiff,
            tolerance,
            imageId: currentImageId,
            detectionImageId: detectionResult.imageId || 'unknown',
            reason: 'Detection ran on different image size - coordinates will be wrong!'
          });
          // CRITICAL: Don't draw if dimensions don't match - coordinates will be completely wrong!
          return;
        }
        console.log('[PersonSelection] ✅ Dimensions match - safe to draw');
      } else {
        // CRITICAL: If detection doesn't have dimension metadata, we CANNOT safely draw
        // The coordinates might be from a different sized image
        console.error('[PersonSelection] ❌ MISSING DIMENSION METADATA - ABORTING DRAW:', {
          hasImageId: !!detectionResult.imageId,
          hasImageWidth: detectionResult.imageWidth !== undefined,
          hasImageHeight: detectionResult.imageHeight !== undefined,
          currentDimensions: `${naturalWidth}x${naturalHeight}`,
          imageId: currentImageId,
          reason: 'Cannot validate if detection coordinates match current image!',
          detectionResultKeys: Object.keys(detectionResult)
        });
        // DON'T proceed - coordinates might be completely wrong!
        return;
      }
      
      const imageAspectRatio = naturalWidth / naturalHeight;
      
      // Validate aspect ratio
      if (!isFinite(imageAspectRatio) || imageAspectRatio <= 0) {
        console.error('[PersonSelection] Invalid aspect ratio:', imageAspectRatio);
        return;
      }
      
      // Get container dimensions (already validated in canDraw())
      const containerRect = container.getBoundingClientRect();
      
      // Use fixed height values from CSS
      const isMobile = window.matchMedia('(max-width: 640px)').matches;
      const maxDisplayHeight = isMobile ? 180 : 200;
      const maxDisplayWidth = containerRect.width;
      
      // Validate container width is positive
      if (maxDisplayWidth <= 0 || !isFinite(maxDisplayWidth)) {
        console.error('[PersonSelection] Invalid container width:', maxDisplayWidth);
        return;
      }
      
      // CRITICAL: Calculate scale factor following CANVAS_POSITIONING_GUIDE.md
      // Use shared function to ensure consistency between draw and click handlers
      const scaleResult = calculateImageScale(naturalWidth, naturalHeight, maxDisplayWidth, maxDisplayHeight);
      const { scale, displayWidth, displayHeight } = scaleResult;
      
      // Validate scale result
      if (scale <= 0 || !isFinite(scale) || displayWidth <= 0 || displayHeight <= 0 || !isFinite(displayWidth) || !isFinite(displayHeight)) {
        console.error('[PersonSelection] ❌ Invalid scale calculated:', {
          scale,
          displayWidth,
          displayHeight,
          naturalWidth,
          naturalHeight,
          maxDisplayWidth,
          maxDisplayHeight
        });
        return;
      }
      
      // CRITICAL: Comprehensive debug logging
      console.log('[PersonSelection] 📐 SCALE CALCULATION:', {
        step1_naturalSize: `${naturalWidth}x${naturalHeight}`,
        step2_containerSize: `${maxDisplayWidth}x${maxDisplayHeight}`,
        step3_calculatedScale: scale.toFixed(4),
        step4_displaySize: `${displayWidth.toFixed(2)}x${displayHeight.toFixed(2)}`,
        step5_imageAspectRatio: imageAspectRatio.toFixed(4),
        detectionDimensions: `${detectionResult.imageWidth}x${detectionResult.imageHeight}`,
        isMobile,
        dpr: window.devicePixelRatio || 1
      });
      
      // Use device pixel ratio for crisp rendering on high-DPI screens
      const dpr = window.devicePixelRatio || 1;
      
      // CRITICAL: Calculate canvas dimensions as integers (canvas dimensions must be integers)
      // Round to nearest integer to avoid fractional pixel issues
      const canvasWidth = Math.round(displayWidth * dpr);
      const canvasHeight = Math.round(displayHeight * dpr);
      
      // CRITICAL: Set canvas internal resolution FIRST (high resolution for quality)
      // This must be done before getting the context to ensure proper sizing
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
      
      // CRITICAL: Set CSS display size (actual size on screen)
      // This ensures the canvas displays at the correct size
      canvas.style.width = `${displayWidth}px`;
      canvas.style.height = `${displayHeight}px`;
      canvas.style.pointerEvents = 'auto';
      
      // CRITICAL: Force browser to apply CSS styles before proceeding
      // This is especially important on first load when DOM might not be stable
      // Accessing offsetWidth/offsetHeight forces a layout recalculation
      const forcedLayoutWidth = canvas.offsetWidth;
      const forcedLayoutHeight = canvas.offsetHeight;
      
      // CRITICAL: Verify canvas dimensions are set correctly AFTER CSS is applied
      // Re-read actual canvas dimensions to account for any browser rounding
      const actualCanvasWidth = canvas.width;
      const actualCanvasHeight = canvas.height;
      
      // CRITICAL: Calculate effective DPR based on ACTUAL canvas dimensions after CSS is applied
      // This accounts for any browser rounding or adjustments
      const effectiveDprX = actualCanvasWidth / displayWidth;
      const effectiveDprY = actualCanvasHeight / displayHeight;
      
      // CRITICAL: Verify canvas dimensions are valid BEFORE drawing
      if (actualCanvasWidth === 0 || actualCanvasHeight === 0 || !isFinite(actualCanvasWidth) || !isFinite(actualCanvasHeight)) {
        console.error('[PersonSelection] Canvas dimensions invalid - ABORTING DRAW:', {
          canvasWidth: actualCanvasWidth,
          canvasHeight: actualCanvasHeight,
          displayWidth,
          displayHeight,
          dpr
        });
        return;
      }
      
      // Verify canvas dimensions match expected values (with tolerance for rounding)
      const expectedCanvasWidth = Math.round(displayWidth * dpr);
      const expectedCanvasHeight = Math.round(displayHeight * dpr);
      const widthMismatch = Math.abs(actualCanvasWidth - expectedCanvasWidth);
      const heightMismatch = Math.abs(actualCanvasHeight - expectedCanvasHeight);
      
      if (widthMismatch > 2 || heightMismatch > 2) {
        console.error('[PersonSelection] Canvas dimensions mismatch - ABORTING DRAW:', {
          expectedWidth: expectedCanvasWidth,
          expectedHeight: expectedCanvasHeight,
          actualWidth: actualCanvasWidth,
          actualHeight: actualCanvasHeight
        });
        return;
      }
      
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        console.error('[PersonSelection] Failed to get canvas context - ABORTING DRAW');
        return;
      }
      
      // CRITICAL: Reset transform and scale context using effective DPR
      // This ensures coordinates are correct for high-DPI displays and accounts for rounding
      ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform to identity
      ctx.scale(effectiveDprX, effectiveDprY); // Scale by effective device pixel ratio
      
      // Verify transform is correct
      const transform = ctx.getTransform();
      if (Math.abs(transform.a - effectiveDprX) > 0.01 || Math.abs(transform.d - effectiveDprY) > 0.01 || 
          transform.e !== 0 || transform.f !== 0) {
        console.error('[PersonSelection] Canvas transform is incorrect:', {
          transform,
          expectedScaleX: effectiveDprX,
          expectedScaleY: effectiveDprY,
          actualScaleX: transform.a,
          actualScaleY: transform.d
        });
        // Fix transform
        ctx.setTransform(effectiveDprX, 0, 0, effectiveDprY, 0, 0);
      }
      
      // Log dimension info for debugging (only if there's a significant difference)
      if (Math.abs(effectiveDprX - dpr) > 0.001 || Math.abs(effectiveDprY - dpr) > 0.001) {
        console.log('[PersonSelection] Using effective DPR due to rounding:', {
          originalDpr: dpr,
          effectiveDprX,
          effectiveDprY,
          displayWidth,
          displayHeight,
          actualCanvasWidth,
          actualCanvasHeight,
          expectedWidth: displayWidth * dpr,
          expectedHeight: displayHeight * dpr
        });
      }
      
      // CRITICAL: Clear the ENTIRE canvas
      // We need to clear in the scaled coordinate system (display dimensions)
      // After scaling by dpr, clearing at displayWidth x displayHeight clears the full canvas
      ctx.clearRect(0, 0, displayWidth, displayHeight);
      
      // CRITICAL: Verify image is ready before drawing
      if (!img.complete || img.naturalWidth === 0 || img.naturalHeight === 0) {
        console.error('[PersonSelection] Image not ready for canvas drawing:', {
          complete: img.complete,
          naturalWidth: img.naturalWidth,
          naturalHeight: img.naturalHeight
        });
        return;
      }
      
      // CRITICAL: Draw image following CANVAS_POSITIONING_GUIDE.md
      // Draw scaled image at (0, 0) filling entire canvas
      // Since context is scaled by dpr, drawing at (0, 0, displayWidth, displayHeight)
      // fills the canvas internal size correctly
      // This matches the guide: "Draw scaled image at (0, 0) filling entire canvas"
      ctx.drawImage(img, 0, 0, displayWidth, displayHeight);
      
      // CRITICAL: Verify image fills the canvas correctly
      // Check if image was drawn by sampling pixels at corners and center
      try {
        const checkPoints = [
          { x: 0, y: 0, name: 'top-left' },
          { x: displayWidth - 1, y: 0, name: 'top-right' },
          { x: displayWidth / 2, y: displayHeight / 2, name: 'center' },
          { x: 0, y: displayHeight - 1, name: 'bottom-left' },
          { x: displayWidth - 1, y: displayHeight - 1, name: 'bottom-right' }
        ];
        
        const imageCheckResults = checkPoints.map(point => {
          try {
            const pixelData = ctx.getImageData(point.x, point.y, 1, 1);
            const hasImage = pixelData.data[3] > 0; // Check alpha channel
            return { ...point, hasImage, alpha: pixelData.data[3] };
          } catch (e) {
            return { ...point, hasImage: false, error: e.message };
          }
        });
        
        const allPointsHaveImage = imageCheckResults.every(p => p.hasImage);
        console.log('[PersonSelection] Image fill verification:', {
          allPointsHaveImage,
          checkPoints: imageCheckResults,
          imageNaturalSize: `${img.naturalWidth}x${img.naturalHeight}`,
          displaySize: `${displayWidth}x${displayHeight}`,
          canvasInternalSize: `${canvas.width}x${canvas.height}`
        });
        
        if (!allPointsHaveImage) {
          console.warn('[PersonSelection] Image may not be filling canvas correctly!');
        }
      } catch (e) {
        console.warn('[PersonSelection] Could not verify image fill:', e);
      }
      
      // Debug: Verify image was drawn correctly by checking a sample pixel
      try {
        const testX = Math.floor(displayWidth / 2);
        const testY = Math.floor(displayHeight / 2);
        const pixelData = ctx.getImageData(testX, testY, 1, 1);
        const hasImage = pixelData.data[3] > 0; // Check alpha channel
        console.log('[PersonSelection] Image draw verification:', {
          testPixel: `(${testX}, ${testY})`,
          hasImage: hasImage,
          pixelAlpha: pixelData.data[3]
        });
      } catch (e) {
        console.warn('[PersonSelection] Could not verify image draw:', e);
      }
      
      // Debug: Log image drawing details with verification
      const imageData = ctx.getImageData(0, 0, Math.min(10, displayWidth), Math.min(10, displayHeight));
      const hasImageData = imageData.data.some((val, idx) => idx % 4 !== 3 && val !== 0); // Check if any non-transparent pixels
      console.log('[PersonSelection] Image drawn on canvas:', {
        imageSrc: img.src.substring(0, 50),
        imageNaturalSize: `${img.naturalWidth}x${img.naturalHeight}`,
        canvasDisplaySize: `${displayWidth}x${displayHeight}`,
        canvasInternalSize: `${canvas.width}x${canvas.height}`,
        dpr,
        transform: ctx.getTransform(),
        imageDrawnAt: `(0, 0, ${displayWidth}, ${displayHeight})`,
        imageDrawnInCanvasPixels: `(0, 0, ${displayWidth * dpr}, ${displayHeight * dpr})`,
        hasImageData: hasImageData
      });
      
      // CRITICAL: Scale factor already calculated above following CANVAS_POSITIONING_GUIDE.md
      // scale = Math.min(maxDisplayWidth / naturalWidth, maxDisplayHeight / naturalHeight)
      // This scale is used for both image display and bounding box coordinates
      // No need to recalculate - use the scale variable from above
      
      // Validate detection result and people array
      if (!detectionResult?.people || !Array.isArray(detectionResult.people) || detectionResult.people.length === 0) {
        console.warn('[PersonSelection] No people detected or invalid detection result');
        return;
      }
      
      // CRITICAL: Verify that detection was run on the current image with current dimensions
      // This prevents drawing boxes from a previous detection that was run on different image dimensions
      // On refresh, detection might have run before image loaded, giving wrong coordinates
      
      // First check: Verify detection result has image metadata and it matches
      if (detectionResult.imageId && detectionResult.imageId !== currentImageId) {
        console.warn('[PersonSelection] Detection result image ID does not match current image ID - skipping draw:', {
          detectionImageId: detectionResult.imageId,
          currentImageId
        });
        return;
      }
      
      // Second check: Verify detection was run on same image dimensions
      // CRITICAL: If detection dimensions don't match, we MUST skip drawing
      // Otherwise bounding boxes will be positioned incorrectly
      if (detectionResult.imageWidth !== undefined && detectionResult.imageHeight !== undefined) {
        const widthMatch = Math.abs(detectionResult.imageWidth - naturalWidth) < 1; // Allow 1px tolerance
        const heightMatch = Math.abs(detectionResult.imageHeight - naturalHeight) < 1;
        
        if (!widthMatch || !heightMatch) {
          console.error('[PersonSelection] Detection result dimensions do not match current image dimensions - ABORTING DRAW:', {
            detectionDimensions: `${detectionResult.imageWidth}x${detectionResult.imageHeight}`,
            currentDimensions: `${naturalWidth}x${naturalHeight}`,
            widthDiff: Math.abs(detectionResult.imageWidth - naturalWidth),
            heightDiff: Math.abs(detectionResult.imageHeight - naturalHeight),
            imageId: currentImageId
          });
          // CRITICAL: Don't draw if dimensions don't match - coordinates will be wrong!
          return;
        }
      } else {
        // If detection doesn't have dimension metadata, log a warning but still try to draw
        // This handles legacy detection results that don't have metadata
        console.warn('[PersonSelection] Detection result missing dimension metadata - proceeding with caution:', {
          hasImageId: !!detectionResult.imageId,
          currentDimensions: `${naturalWidth}x${naturalHeight}`
        });
      }
      
      // Third check: Verify detection image ref matches (fallback validation)
      const detectionImage = detectionImageRef.current;
      if (detectionImage) {
        const detectionImageSrc = detectionImage.src;
        const drawingImageSrc = img.src;
        if (detectionImageSrc !== drawingImageSrc && 
            !(detectionImageSrc.includes(drawingImageSrc.split('?')[0]) || drawingImageSrc.includes(detectionImageSrc.split('?')[0]))) {
          console.warn('[PersonSelection] Detection image src does not match drawing image src - skipping draw:', {
            detectionImageSrc: detectionImageSrc.substring(0, 100),
            drawingImageSrc: drawingImageSrc.substring(0, 100)
          });
          return;
        }
        
        // Verify detection image has same dimensions as drawing image
        if (detectionImage.naturalWidth !== naturalWidth || detectionImage.naturalHeight !== naturalHeight) {
          console.warn('[PersonSelection] Detection image dimensions do not match drawing image dimensions - skipping draw:', {
            detectionDimensions: `${detectionImage.naturalWidth}x${detectionImage.naturalHeight}`,
            drawingDimensions: `${naturalWidth}x${naturalHeight}`
          });
          return;
        }
      }
      
      // Draw bounding boxes - Transform from natural image coordinates to display coordinates
      console.log('[PersonSelection] 🎯 DRAWING BOUNDING BOXES:', {
        totalPeople: detectionResult.people.length,
        scale: scale.toFixed(4),
        naturalDimensions: `${naturalWidth}x${naturalHeight}`,
        displayDimensions: `${displayWidth.toFixed(2)}x${displayHeight.toFixed(2)}`
      });
      
      detectionResult.people.forEach((person, index) => {
        // Validate person bbox exists and is an array
        if (!person?.bbox || !Array.isArray(person.bbox) || person.bbox.length !== 4) {
          console.warn(`[PersonSelection] ❌ Invalid bbox for person ${index}:`, person.bbox);
          return;
        }
        
        const [x, y, width, height] = person.bbox;
        
        console.log(`[PersonSelection] 📦 Person ${index} ORIGINAL bbox:`, {
          x: x.toFixed(2),
          y: y.toFixed(2),
          width: width.toFixed(2),
          height: height.toFixed(2),
          score: person.score?.toFixed(3),
          bounds: `(${x.toFixed(1)}, ${y.toFixed(1)}) to (${(x + width).toFixed(1)}, ${(y + height).toFixed(1)})`
        });
        
        // Validate bbox coordinates are valid numbers
        if (!isFinite(x) || !isFinite(y) || !isFinite(width) || !isFinite(height)) {
          console.error(`[PersonSelection] ❌ Invalid bbox coordinates for person ${index}:`, { x, y, width, height });
          return;
        }
        
        // Validate bbox dimensions are positive
        if (width <= 0 || height <= 0) {
          console.error(`[PersonSelection] ❌ Invalid bbox dimensions for person ${index}:`, { width, height });
          return;
        }
        
        // Validate bbox is within natural image bounds (with small tolerance for rounding)
        const outOfBounds = x < 0 || y < 0 || x + width > naturalWidth + 1 || y + height > naturalHeight + 1;
        if (outOfBounds) {
          console.error(`[PersonSelection] ❌ Bbox OUT OF BOUNDS for person ${index}:`, {
            bbox: `[${x.toFixed(1)}, ${y.toFixed(1)}, ${width.toFixed(1)}, ${height.toFixed(1)}]`,
            naturalSize: `${naturalWidth}x${naturalHeight}`,
            xRange: `${x.toFixed(1)} to ${(x + width).toFixed(1)} (max: ${naturalWidth})`,
            yRange: `${y.toFixed(1)} to ${(y + height).toFixed(1)} (max: ${naturalHeight})`
          });
          // Don't return - still draw it, but log the error
        }
        
        const isSelected = selectedPersonIndex === index;
        
        // Scale coordinates from natural image size to display size
        const scaledX = x * scale;
        const scaledY = y * scale;
        const scaledWidth = width * scale;
        const scaledHeight = height * scale;
        
        console.log(`[PersonSelection] 📏 Person ${index} SCALED bbox:`, {
          originalX: x.toFixed(2),
          originalY: y.toFixed(2),
          originalWidth: width.toFixed(2),
          originalHeight: height.toFixed(2),
          scale: scale.toFixed(4),
          scaledX: scaledX.toFixed(2),
          scaledY: scaledY.toFixed(2),
          scaledWidth: scaledWidth.toFixed(2),
          scaledHeight: scaledHeight.toFixed(2),
          displayBounds: `(${scaledX.toFixed(1)}, ${scaledY.toFixed(1)}) to (${(scaledX + scaledWidth).toFixed(1)}, ${(scaledY + scaledHeight).toFixed(1)})`,
          canvasBounds: `0,0 to ${displayWidth.toFixed(1)},${displayHeight.toFixed(1)}`
        });
        
        // CRITICAL: Validate scaled coordinates are valid and NOT at origin (0,0) unless person is actually there
        // This prevents boxes from appearing at top-left corner due to invalid calculations
        if (!isFinite(scaledX) || !isFinite(scaledY) || !isFinite(scaledWidth) || !isFinite(scaledHeight)) {
          console.error(`[PersonSelection] Invalid scaled coordinates for person ${index}:`, {
            scaledX,
            scaledY,
            scaledWidth,
            scaledHeight,
            scale,
            originalBbox: [x, y, width, height],
            naturalSize: `${naturalWidth}x${naturalHeight}`,
            displaySize: `${displayWidth}x${displayHeight}`
          });
          return;
        }
        
        // Validate scaled dimensions are positive
        if (scaledWidth <= 0 || scaledHeight <= 0) {
          console.error(`[PersonSelection] Invalid scaled dimensions for person ${index}:`, {
            scaledWidth,
            scaledHeight,
            scale,
            originalWidth: width,
            originalHeight: height
          });
          return;
        }
        
        // CRITICAL SAFEGUARD: If ALL coordinates are exactly 0, something is wrong - don't draw
        // This prevents boxes from appearing at top-left corner
        if (scaledX === 0 && scaledY === 0 && scaledWidth === 0 && scaledHeight === 0) {
          console.error(`[PersonSelection] All scaled coordinates are zero for person ${index} - skipping draw:`, {
            originalBbox: [x, y, width, height],
            scaledBbox: [scaledX, scaledY, scaledWidth, scaledHeight],
            scale,
            naturalSize: `${naturalWidth}x${naturalHeight}`,
            displaySize: `${displayWidth}x${displayHeight}`
          });
          return;
        }
        
        // Additional safeguard: If scale is suspiciously small (< 0.001), don't draw
        if (scale < 0.001) {
          console.error(`[PersonSelection] Scale is suspiciously small for person ${index} - skipping draw:`, {
            scale,
            displayWidth,
            naturalWidth,
            originalBbox: [x, y, width, height]
          });
          return;
        }
        
        // Validate scaled coordinates are within canvas bounds (with small tolerance)
        if (scaledX < -displayWidth * 0.1 || scaledY < -displayHeight * 0.1 || 
            scaledX + scaledWidth > displayWidth * 1.1 || scaledY + scaledHeight > displayHeight * 1.1) {
          console.warn(`[PersonSelection] Scaled bbox significantly out of canvas bounds for person ${index}:`, {
            scaledBbox: [scaledX, scaledY, scaledWidth, scaledHeight],
            canvasSize: `${displayWidth}x${displayHeight}`
          });
          // Still draw it, but log the warning
        }
        
        // Debug logging for first person with detailed info
        if (index === 0) {
          console.log('[PersonSelection] Drawing first bounding box:', {
            originalBbox: [x, y, width, height],
            scaledBbox: [scaledX, scaledY, scaledWidth, scaledHeight],
            scale,
            displaySize: `${displayWidth}x${displayHeight}`,
            naturalSize: `${naturalWidth}x${naturalHeight}`,
            detectionDimensions: detectionResult.imageWidth && detectionResult.imageHeight 
              ? `${detectionResult.imageWidth}x${detectionResult.imageHeight}` 
              : 'unknown',
            imageId: currentImageId,
            detectionImageId: detectionResult.imageId || 'unknown',
            canvasSize: `${canvas.width}x${canvas.height}`,
            canvasStyleSize: `${canvas.style.width}x${canvas.style.height}`,
            dpr: window.devicePixelRatio || 1
          });
        }
        
        // CRITICAL: Save context state before drawing
        ctx.save();
        
        // CRITICAL: Ensure we're using the same coordinate system as the image
        // The image was drawn at (0, 0, displayWidth, displayHeight) in scaled coordinates
        // So bounding boxes should also be drawn in the same scaled coordinate system
        // scaledX, scaledY, scaledWidth, scaledHeight are in display coordinates
        // Since context is scaled by dpr, these will be correctly positioned
        
        // Draw the bounding box
        ctx.strokeStyle = isSelected ? '#FF4F00' : '#10B981';
        ctx.lineWidth = isSelected ? 4 : 3;
        
        // CRITICAL: Verify coordinates are within canvas bounds before drawing
        if (scaledX < 0 || scaledY < 0 || scaledX + scaledWidth > displayWidth || scaledY + scaledHeight > displayHeight) {
          console.warn(`[PersonSelection] Bounding box ${index} extends outside canvas bounds:`, {
            scaledBbox: [scaledX, scaledY, scaledWidth, scaledHeight],
            canvasBounds: `0,0 to ${displayWidth},${displayHeight}`
          });
        }
        
        // Draw the rectangle - coordinates are in display space (scaled by dpr via context transform)
        ctx.strokeRect(scaledX, scaledY, scaledWidth, scaledHeight);
        
        // Restore context state
        ctx.restore();
        
        // Debug: Log actual drawn coordinates for first person
        if (index === 0) {
          console.log('[PersonSelection] Bounding box drawn at:', {
            x: scaledX,
            y: scaledY,
            width: scaledWidth,
            height: scaledHeight,
            canvasBounds: `0,0 to ${displayWidth},${displayHeight}`
          });
        }
      });
      
      console.log('[PersonSelection] Canvas drawn successfully:', {
        naturalSize: `${naturalWidth}x${naturalHeight}`,
        canvasSize: `${displayWidth}x${displayHeight}`,
        scale,
        peopleCount: detectionResult.people.length
      });
      
      // CRITICAL: Mark bounding boxes as drawn
      // This signals that the modal is ready to be displayed
      setBoundingBoxesDrawn(true);
      boundingBoxesDrawnRef.current = true;
    };
    
    // CRITICAL: Image load event handler - NO setTimeout delays!
    // Simply try to draw when image loads - canDraw() validates everything
    const handleImageLoad = () => {
      console.log('[PersonSelection] Image load event fired');
      // Use requestAnimationFrame to ensure DOM is ready
      requestAnimationFrame(() => {
        drawBoundingBoxes();
      });
    };
    
    // Clear canvas initially
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width || 1, canvas.height || 1);
    }
    
    // Set up image load listener
    img.addEventListener('load', handleImageLoad);
    
    // CRITICAL: Try to draw immediately if image is already loaded (cached)
    if (img.complete && img.naturalWidth > 0) {
      console.log('[PersonSelection] Image already loaded (cached)');
      requestAnimationFrame(() => {
        drawBoundingBoxes();
      });
    }
    
    // Set up resize observers to redraw when dimensions change
    const handleResize = () => {
      drawBoundingBoxes();
    };
    
    window.addEventListener('resize', handleResize);
    
    // ResizeObserver for container dimension changes
    const observer = new ResizeObserver(() => {
      drawBoundingBoxes();
    });
    
    if (canvasContainerRef.current) {
      observer.observe(canvasContainerRef.current);
    }
    
    return () => {
      window.removeEventListener('resize', handleResize);
      img.removeEventListener('load', handleImageLoad);
      observer.disconnect();
    };
  }, [showPersonSelection, detectionResult, selectedPersonIndex, detectionImageRef, uploadedImage, visibilityChangeCounter]);
  
  // Handle canvas clicks for person selection
  useEffect(() => {
    if (!showPersonSelection || !detectionResult?.people || detectionResult.people.length === 0 || !detectionImageRef.current || !canvasRef.current || !uploadedImage) return;
    
    const canvas = canvasRef.current;
    const img = detectionImageRef.current;
    
    // Use new validation utility for click handler
    const imageId = generateImageId(uploadedImage);
    
    const handleCanvasClick = (e: MouseEvent) => {
      // Validate image is ready using new utility
      const validation = validateImageReady(img, imageId);
      if (!validation.ready) {
        console.warn('[PersonSelection] Image not ready for click handling');
        return;
      }
      
      // Get canvas display dimensions
      const canvasRect = canvas.getBoundingClientRect();
      const naturalWidth = validation.width;
      const naturalHeight = validation.height;
      
      // Use the same calculation as drawBoundingBoxes
      const container = canvasContainerRef.current;
      if (!container) return;
      
      const containerRect = container.getBoundingClientRect();
      if (!containerRect || containerRect.width === 0) return;
      
      // CRITICAL: Use the EXACT same scale calculation as drawBoundingBoxes
      // Following CANVAS_POSITIONING_GUIDE.md: Use shared function for consistency
      const isMobile = window.matchMedia('(max-width: 640px)').matches;
      const maxDisplayHeight = isMobile ? 180 : 200;
      const maxDisplayWidth = containerRect.width;
      
      // Calculate scale using the SAME shared function as drawBoundingBoxes
      const scaleResult = calculateImageScale(naturalWidth, naturalHeight, maxDisplayWidth, maxDisplayHeight);
      const { scale, displayWidth, displayHeight } = scaleResult;
      
      // CRITICAL: Verify canvas dimensions are valid before calculating coordinates
      // This ensures we're using the same dimensions that were used during drawing
      if (canvas.width === 0 || canvas.height === 0 || !isFinite(canvas.width) || !isFinite(canvas.height)) {
        console.warn('[PersonSelection] Canvas dimensions invalid in click handler:', {
          canvasWidth: canvas.width,
          canvasHeight: canvas.height
        });
        return;
      }
      
      // CRITICAL: Verify canvas rect dimensions are valid
      if (canvasRect.width === 0 || canvasRect.height === 0 || !isFinite(canvasRect.width) || !isFinite(canvasRect.height)) {
        console.warn('[PersonSelection] Canvas rect dimensions invalid in click handler:', {
          rectWidth: canvasRect.width,
          rectHeight: canvasRect.height
        });
        return;
      }
      
      // CRITICAL: Convert screen click coordinates to canvas display coordinates
      // Following CANVAS_POSITIONING_GUIDE.md: Account for CSS scaling using getBoundingClientRect
      // Since canvas internal size = displayWidth * effectiveDpr, but CSS size = displayWidth
      // We need to convert screen coordinates to display coordinates
      const scaleX = canvas.width / canvasRect.width; // Canvas internal / CSS display width
      const scaleY = canvas.height / canvasRect.height; // Canvas internal / CSS display height
      
      // Convert screen click to canvas internal coordinates
      const canvasX = (e.clientX - canvasRect.left) * scaleX;
      const canvasY = (e.clientY - canvasRect.top) * scaleY;
      
      // CRITICAL: Calculate effective DPR to match what was used in drawBoundingBoxes
      // This accounts for rounding differences in canvas dimensions
      // Use actual canvas dimensions (which are integers) to calculate effective DPR
      const effectiveDprX = canvas.width / displayWidth;
      const effectiveDprY = canvas.height / displayHeight;
      
      // CRITICAL: Verify effective DPR is valid
      if (!isFinite(effectiveDprX) || !isFinite(effectiveDprY) || effectiveDprX <= 0 || effectiveDprY <= 0) {
        console.warn('[PersonSelection] Invalid effective DPR in click handler:', {
          effectiveDprX,
          effectiveDprY,
          canvasWidth: canvas.width,
          canvasHeight: canvas.height,
          displayWidth,
          displayHeight
        });
        return;
      }
      
      // Convert canvas internal coordinates to display coordinates (divide by effective DPR)
      // Since context is scaled by effective DPR, we need display coordinates to match bounding boxes
      const x = canvasX / effectiveDprX;
      const y = canvasY / effectiveDprY;
      
      // Check if click is within the image display area
      if (x < 0 || x > displayWidth || y < 0 || y > displayHeight) {
        return; // Click outside image area
      }
      
      // CRITICAL: Compare click coordinates with scaled bounding boxes
      // Use the SAME scale calculation as drawBoundingBoxes
      for (let i = detectionResult.people.length - 1; i >= 0; i--) {
        const [px, py, pwidth, pheight] = detectionResult.people[i].bbox;
        // Scale using the SAME scale factor as drawBoundingBoxes
        const scaledX = px * scale;
        const scaledY = py * scale;
        const scaledWidth = pwidth * scale;
        const scaledHeight = pheight * scale;
        
        // Check if click is within scaled bounding box (in display coordinates)
        if (
          x >= scaledX &&
          x <= scaledX + scaledWidth &&
          y >= scaledY &&
          y <= scaledY + scaledHeight
        ) {
          handlePersonSelect(i);
          break;
        }
      }
    };
    
    // Wait for image to load before setting up click handler using new validation utility
    const cleanupClickWait = waitForImageReady(
      img,
      () => {
        // Verify image ID matches current image
        const validation = validateImageReady(img, imageId);
        if (validation.ready && validation.imageId === imageId) {
          canvas.style.pointerEvents = 'auto';
          canvas.addEventListener('click', handleCanvasClick);
        }
      },
      100, // maxAttempts
      imageId
    );
    
    return () => {
      // Cleanup image wait
      cleanupClickWait();
      // Always try to remove listener (safe even if not added)
      canvas.removeEventListener('click', handleCanvasClick);
    };
  }, [showPersonSelection, detectionResult, detectionImageRef, handlePersonSelect, uploadedImage]);

  return (
    <div className="w-full h-[100dvh] bg-white font-sans relative overflow-hidden">
      {/* Skip to main content link for keyboard navigation */}
      <a
        href="#main-content"
        className="sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:w-auto focus:h-auto focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-lg focus:font-medium focus:shadow-lg focus:m-0"
      >
        {t('virtualTryOnModal.skipToContent')}
      </a>

      {/* ARIA Live Region for Status Updates */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        role="status"
      >
        {statusMessage || (step === 'idle' ? t('virtualTryOnModal.readyToGenerateTryOn') : step === 'generating' ? t('virtualTryOnModal.generatingTryOnProgress', { progress }) : '')}
      </div>

      {/* ARIA Live Region for Errors */}
      {error && !generatedImageError && (
        <div
          aria-live="assertive"
          aria-atomic="true"
          className="sr-only"
          role="alert"
        >
          {t('virtualTryOnModal.errorPrefix')} {error}
        </div>
      )}
      {/* ARIA Live Region for Generated Image Errors */}
      {generatedImageError && (
        <div
          aria-live="assertive"
          aria-atomic="true"
          className="sr-only"
          role="alert"
        >
          {t('virtualTryOnModal.generatedImageError')}
        </div>
      )}

      {/* Modal container */}
      <div className="fixed inset-0 z-50 bg-white flex items-stretch justify-center p-2 md:p-0">
        {/* Shared Header with logo and close button - Enhanced with magic */}
        <div className="absolute top-2 left-2 right-2 md:top-0 md:left-0 md:right-0 z-[60] flex justify-between items-center px-4 sm:px-5 md:px-6 py-3 sm:py-3.5 border-b border-border/40 bg-gradient-to-r from-white via-white to-primary/3 backdrop-blur-sm flex-shrink-0 shadow-sm animate-in slide-in-from-top duration-500 rounded-t-lg md:rounded-t-none">
          <div className="flex items-center gap-2 sm:gap-3 group/logo">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/10 rounded-lg blur-sm opacity-0 group-hover/logo:opacity-100 transition-opacity duration-300" />
              <img
                src="/assets/NUSENSE_LOGO.svg"
                alt="NUSENSE"
                className="h-4 sm:h-5 w-auto flex-shrink-0 relative z-10 transition-transform duration-300 group-hover/logo:scale-110"
                aria-label="NUSENSE Logo"
              />
            </div>
            <span className="font-medium text-muted-foreground text-xs sm:text-sm flex items-center tracking-normal" id="modal-title">{t('virtualTryOnModal.title')}</span>
          </div>

          <button
            onClick={handleClose}
            className="group/close flex items-center justify-center w-9 h-9 sm:w-8 sm:h-8 min-w-9 sm:min-w-8 hover:bg-primary/10 rounded-lg transition-all duration-200 ease-in-out flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 relative"
            aria-label={t('virtualTryOnModal.closeModal')}
            type="button"
          >
            <div className="absolute inset-0 bg-primary/5 rounded-lg scale-0 group-hover/close:scale-100 transition-transform duration-200" />
            <X className="text-muted-foreground group-hover/close:text-primary transition-all duration-200 w-4 h-4 sm:w-4 sm:h-4 relative z-10 group-hover/close:rotate-90" />
          </button>
        </div>

        {/* Authentication Gate - Show if not authenticated */}
        {!customerInfo?.id && (
          <div className="w-full flex-1 flex flex-col min-h-0 overflow-hidden relative animate-in fade-in duration-500">
            {/* Auth Gate Content - Scrollable area between header and footer */}
            <div className="w-full flex-1 min-h-0 overflow-y-auto overflow-x-hidden scroll-smooth" style={{ paddingTop: '52px', paddingBottom: '48px' }}>
              <div className="w-full flex items-start justify-center px-3 sm:px-4 md:px-6 pt-4 sm:pt-5 md:pt-6 pb-3 sm:pb-4">
                <div className="w-full max-w-[980px] flex flex-col md:flex-row items-stretch gap-3 sm:gap-4 md:gap-5 bg-transparent rounded overflow-hidden animate-in slide-in-from-bottom-4 duration-700 delay-100">
              {/* Animated Tutorial Demo Panel - Left Side (Desktop only) */}
              <section
                aria-label={t("virtualTryOnModal.authGate.demoAriaLabel") || "Virtual try-on tutorial demonstration"}
                className="hidden md:flex flex-col flex-1 w-full min-h-0"
              >
                <div className="flex flex-col items-start bg-gradient-to-br from-white via-white to-primary/5 w-full py-5 px-5 rounded-xl border border-border/60 min-h-0 flex-1 relative overflow-hidden shadow-md hover:shadow-lg transition-shadow duration-300 group">
                  {/* Subtle animated background gradient */}
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/0 via-primary/0 to-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-xl pointer-events-none" />
                  
                  <div className="w-full flex-1 flex flex-col gap-4 relative min-h-[320px] max-h-full z-10">
                    {/* Step Indicator - Enhanced with pulse effect and smooth transitions */}
                    <div className="flex items-center justify-center gap-2.5 mb-2">
                      {[1, 2, 3, 4].map((stp) => (
                        <div
                          key={stp}
                          className={cn(
                            "h-2.5 rounded-full transition-all duration-700 ease-out relative group/indicator",
                            tutorialStep === stp
                              ? "w-10 bg-primary shadow-lg shadow-primary/30"
                              : tutorialStep > stp
                              ? "w-2.5 bg-primary/50 shadow-sm"
                              : "w-2.5 bg-muted/60"
                          )}
                          aria-hidden="true"
                        >
                          {tutorialStep === stp && (
                            <>
                              <div className="absolute inset-0 bg-primary rounded-full animate-ping opacity-20" />
                              <div className="absolute inset-0 bg-primary/40 rounded-full blur-sm" />
                            </>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Step Text - Enhanced with scale animation */}
                    <div className="text-center mb-4 min-h-[60px] flex flex-col items-center justify-center gap-1.5 relative overflow-hidden">
                      {/* Step Numbers - All rendered, positioned absolutely, slide horizontally */}
                      <div className="relative w-full h-5 flex items-center justify-center">
                        {[1, 2, 3, 4].map((step) => (
                          <p
                            key={`step-number-${step}`}
                            className="absolute inset-0 text-xs font-bold text-primary/80 uppercase tracking-[0.15em] transition-all duration-500 ease-in-out flex items-center justify-center"
                            style={{
                              transform: `translateX(${(step - tutorialStep) * 100}%) scale(${step === tutorialStep ? 1 : 0.8})`,
                              opacity: step === tutorialStep ? 1 : 0,
                              pointerEvents: step === tutorialStep ? 'auto' : 'none'
                            }}
                          >
                            {step === 1 && (t("virtualTryOnModal.authGate.step1Number") || "Step 1")}
                            {step === 2 && (t("virtualTryOnModal.authGate.step2Number") || "Step 2")}
                            {step === 3 && (t("virtualTryOnModal.authGate.step3Number") || "Step 3")}
                            {step === 4 && (t("virtualTryOnModal.authGate.step4Number") || "Step 4")}
                          </p>
                        ))}
                      </div>
                      {/* Step Text - All rendered, positioned absolutely, slide horizontally */}
                      <div className="relative w-full h-7 flex items-center justify-center">
                        {[1, 2, 3, 4].map((step) => (
                          <p
                            key={`step-text-${step}`}
                            className="absolute inset-0 text-base font-bold text-foreground leading-tight transition-all duration-500 ease-in-out flex items-center justify-center"
                            style={{
                              transform: `translateX(${(step - tutorialStep) * 100}%) scale(${step === tutorialStep ? 1 : 0.9})`,
                              opacity: step === tutorialStep ? 1 : 0,
                              pointerEvents: step === tutorialStep ? 'auto' : 'none'
                            }}
                          >
                            {step === 1 && (t("virtualTryOnModal.authGate.step1Text") || "Upload Your Photo")}
                            {step === 2 && (t("virtualTryOnModal.authGate.step2Text") || "Select Your Clothing")}
                            {step === 3 && (t("virtualTryOnModal.authGate.step3Text") || "Generating Try-On Result")}
                            {step === 4 && (t("virtualTryOnModal.authGate.step4Text") || "View Your Result")}
                          </p>
                        ))}
                      </div>
                    </div>

                    {/* Image Display - Enhanced with glow effect */}
                    <div className="w-full rounded-xl bg-gradient-to-br from-white to-muted/20 border-2 border-border/60 overflow-hidden relative flex-1 min-h-[200px] max-h-[300px] shadow-inner group/image-container">
                      {/* Glow effect on active step - animated */}
                      <div 
                        className="absolute -inset-0.5 bg-gradient-to-r from-primary/20 via-primary/30 to-primary/20 rounded-xl blur-sm transition-all duration-700 z-0"
                        style={{ 
                          opacity: tutorialStep === 1 || tutorialStep === 2 || tutorialStep === 4 ? 0.6 : 0,
                          transform: tutorialStep === 1 || tutorialStep === 2 || tutorialStep === 4 ? 'scale(1)' : 'scale(0.95)'
                        }}
                      />
                      {/* Secondary glow ring */}
                      <div 
                        className="absolute -inset-1 bg-primary/10 rounded-xl blur-md transition-opacity duration-700 z-0"
                        style={{ opacity: tutorialStep === 1 || tutorialStep === 2 || tutorialStep === 4 ? 0.4 : 0 }}
                      />
                      
                      {/* Container for all images - slides horizontally */}
                      <div 
                        className="absolute inset-0 flex transition-transform duration-700 ease-in-out z-10"
                        style={{
                          width: '400%',
                          transform: `translateX(-${(tutorialStep - 1) * 25}%)`
                        }}
                      >
                        {/* Step 1 - Person Photo */}
                        <div className="w-1/4 h-full flex-shrink-0 flex items-center justify-center relative p-3">
                          <img 
                            src="https://gooddeals.s3.eu-west-3.amazonaws.com/promod_demo/person/1766486097276_7ccdb71b41929e63_blob.jpeg" 
                            alt={t("virtualTryOnModal.authGate.personImageAlt") || "Example person photo"} 
                            className="max-w-full max-h-full w-auto h-auto object-contain rounded-lg border-4 border-white shadow-md md:shadow-lg transition-transform duration-500"
                            style={{ transform: tutorialStep === 1 ? 'scale(1)' : 'scale(0.95)' }}
                            loading="eager"
                          />
                          <div 
                            className="absolute inset-0 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent border-2 border-primary/40 rounded-xl transition-all duration-500 pointer-events-none"
                            style={{ 
                              opacity: tutorialStep === 1 ? 1 : 0,
                              boxShadow: tutorialStep === 1 ? '0 0 20px rgba(255, 79, 0, 0.2)' : 'none'
                            }}
                          />
                        </div>
                        
                        {/* Step 2 - Clothing Item */}
                        <div className="w-1/4 h-full flex-shrink-0 flex items-center justify-center relative p-3">
                          <img 
                            src="https://gooddeals.s3.eu-west-3.amazonaws.com/promod_demo/clothing/1766486098288_f4f3ba85d9bffba7_clothing-item.jpg.jpeg" 
                            alt={t("virtualTryOnModal.authGate.clothingImageAlt") || "Example clothing item"} 
                            className="max-w-full max-h-full w-auto h-auto object-contain rounded-lg border-4 border-white shadow-md md:shadow-lg transition-transform duration-500"
                            style={{ transform: tutorialStep === 2 ? 'scale(1)' : 'scale(0.95)' }}
                            loading="eager"
                          />
                          <div 
                            className="absolute inset-0 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent border-2 border-primary/40 rounded-xl transition-all duration-500 pointer-events-none"
                            style={{ 
                              opacity: tutorialStep === 2 ? 1 : 0,
                              boxShadow: tutorialStep === 2 ? '0 0 20px rgba(255, 79, 0, 0.2)' : 'none'
                            }}
                          />
                        </div>
                        
                        {/* Step 3 - Generating */}
                        <div className="w-1/4 h-full flex-shrink-0 flex items-center justify-center relative overflow-hidden bg-gradient-to-br from-primary/5 via-muted/50 to-primary/5 border-2 border-primary/20 rounded-xl p-2">
                          <Skeleton className="absolute inset-0 rounded-xl bg-gradient-to-br from-muted/30 via-muted/60 to-muted/30" />
                          {/* Animated shimmer effect */}
                          <div 
                            className="absolute inset-0 pointer-events-none transition-opacity duration-500"
                            style={{ 
                              background: "linear-gradient(90deg, transparent 30%, rgba(255, 79, 0, 0.15) 50%, transparent 70%)", 
                              width: "100%", 
                              height: "100%", 
                              animation: tutorialStep === 3 ? "shimmer 2s infinite" : "none",
                              opacity: tutorialStep === 3 ? 1 : 0
                            }} 
                          />
                          {/* Pulsing border glow */}
                          {tutorialStep === 3 && (
                            <div className="absolute -inset-0.5 bg-primary/30 rounded-xl blur-sm animate-pulse" />
                          )}
                          <div className="absolute inset-0 flex items-center justify-center z-10">
                            <div className="text-center">
                              <p className="text-xs font-bold text-primary/80 uppercase tracking-wider animate-pulse">{t("virtualTryOnModal.generating") || "Generating"}</p>
                            </div>
                          </div>
                        </div>
                        
                        {/* Step 4 - Generated Result */}
                        <div className="w-1/4 h-full flex-shrink-0 flex items-center justify-center relative p-3">
                          <img 
                            src="https://gooddeals.s3.eu-west-3.amazonaws.com/promod_demo/generated/1766486128492_c34538c6d298c0db_generated_iqw81yvt6.jpeg" 
                            alt={t("virtualTryOnModal.authGate.generatedImageAlt") || "Example of generated virtual try-on result"} 
                            className="max-w-full max-h-full w-auto h-auto object-contain rounded-lg border-4 border-white shadow-md md:shadow-lg transition-transform duration-500"
                            style={{ transform: tutorialStep === 4 ? 'scale(1)' : 'scale(0.95)' }}
                            loading="eager"
                          />
                          <div 
                            className="absolute inset-0 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent border-2 border-primary/40 rounded-xl transition-all duration-500 pointer-events-none"
                            style={{ 
                              opacity: tutorialStep === 4 ? 1 : 0,
                              boxShadow: tutorialStep === 4 ? '0 0 20px rgba(255, 79, 0, 0.2)' : 'none'
                            }}
                          />
                          {/* Success checkmark overlay - Enhanced */}
                          {tutorialStep === 4 && (
                            <div className="absolute top-2 right-2 bg-gradient-to-br from-primary to-primary-dark backdrop-blur-sm text-primary-foreground rounded-full p-1.5 shadow-xl animate-in zoom-in duration-300 ring-2 ring-primary/50 z-20">
                              <CheckCircle className="w-3.5 h-3.5 animate-in zoom-in duration-300 delay-150" />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* Login Panel */}
              <section aria-labelledby="auth-heading" className="flex flex-col flex-1 w-full min-h-0 animate-in slide-in-from-right-4 duration-700 delay-200">
                <div className="flex flex-col items-start bg-gradient-to-br from-white via-white to-primary/5 w-full py-4 px-4 sm:py-5 sm:px-5 md:px-6 rounded-xl border border-border/60 min-h-0 flex-1 shadow-md hover:shadow-lg transition-all duration-300 group/panel">
                  {/* Subtle animated background */}
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/0 via-primary/0 to-primary/5 opacity-0 group-hover/panel:opacity-100 transition-opacity duration-500 rounded-xl pointer-events-none" />
                  
                  <div className="w-full space-y-3 sm:space-y-4 flex-shrink-0 relative z-10">
                    <div className="space-y-2.5 sm:space-y-3 text-left">
                      {/* Title - Enhanced with gradient accent and animation */}
                      <div className="space-y-1.5 sm:space-y-2 animate-in fade-in slide-in-from-left-4 duration-500 delay-300">
                        <h2 id="auth-heading" className="text-lg sm:text-xl md:text-2xl font-bold text-foreground leading-tight tracking-tight bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text">
                          {t("virtualTryOnModal.authGate.title") || "Continue to Virtual Try-On"}
                        </h2>
                        <div className="h-0.5 w-10 sm:w-12 bg-gradient-to-r from-primary to-primary-light rounded-full animate-in slide-in-from-left-2 duration-500 delay-400" />
                      </div>
                      
                      <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed font-medium animate-in fade-in slide-in-from-left-4 duration-500 delay-400">
                        {t("virtualTryOnModal.authGate.subtitle") || "Sign in to save your try-on results and access them anytime"}
                      </p>
                      
                      {/* Benefits - Enhanced with staggered fade-in and hover effects */}
                      <div className="space-y-2 pt-2">
                        {[1, 2, 3, 4, 5].map((num, index) => (
                          <div 
                            key={num} 
                            className="group/benefit flex items-center justify-start gap-2.5 p-1.5 rounded-lg hover:bg-primary/5 transition-all duration-200 cursor-default"
                            style={{ 
                              animation: `fadeInSlideLeft 0.5s ease-out ${300 + index * 80}ms forwards`,
                              opacity: 0
                            }}
                          >
                            <div className="relative">
                              <div className="absolute inset-0 bg-primary/20 rounded-full blur-sm opacity-0 group-hover/benefit:opacity-100 transition-opacity duration-200" />
                              <CheckCircle className="w-4 h-4 text-primary flex-shrink-0 relative z-10 group-hover/benefit:scale-110 group-hover/benefit:rotate-12 transition-all duration-200" aria-hidden="true" strokeWidth={2.5} />
                            </div>
                            <span className="text-xs text-muted-foreground leading-relaxed group-hover/benefit:text-foreground transition-colors duration-200 font-medium">
                              {t(`virtualTryOnModal.authGate.benefit${num}`) || ["See how it looks", "Try before you buy", "Save time", "Try multiple styles", "AI-powered"][num - 1]}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Actions - Enhanced with magic */}
                  <div className="w-full space-y-2.5 sm:space-y-3 flex-shrink-0 mt-4 sm:mt-5 pt-3 sm:pt-4 border-t border-border/60 relative z-10">
                    <Button 
                      onClick={handleLoginClick} 
                      disabled={isRedirecting} 
                      className="group/btn w-full min-h-[44px] h-11 sm:h-12 bg-gradient-to-r from-primary via-primary to-primary-dark hover:from-primary-dark hover:via-primary-dark hover:to-primary text-primary-foreground text-xs sm:text-sm font-bold shadow-lg hover:shadow-xl transition-all duration-300 rounded-xl disabled:opacity-60 disabled:cursor-not-allowed relative overflow-hidden transform hover:scale-[1.02] active:scale-[0.98] touch-manipulation" 
                      aria-label={t("virtualTryOnModal.authGate.loginButtonAriaLabel") || "Sign in to continue using virtual try-on"}
                    >
                      {/* Shimmer effect */}
                      <span className="absolute inset-0 -translate-x-full group-hover/btn:translate-x-full transition-transform duration-700 ease-in-out bg-gradient-to-r from-transparent via-white/30 to-transparent" />
                      
                      <span className="relative z-10 flex items-center justify-center gap-2">
                        {isRedirecting ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                            {t("virtualTryOnModal.authGate.loginButtonLoading") || "Redirecting..."}
                          </>
                        ) : (
                          <>
                            <LogIn className="w-4 h-4 group-hover/btn:translate-x-0.5 transition-transform duration-300" aria-hidden="true" />
                            {t("virtualTryOnModal.authGate.loginButton") || "Sign In"}
                          </>
                        )}
                      </span>
                    </Button>
                    
                    <p className="text-[10px] sm:text-xs text-center text-muted-foreground leading-tight px-1 flex items-start justify-center gap-1 sm:gap-1.5 max-w-[240px] min-[375px]:max-w-[260px] sm:max-w-[280px] mx-auto">
                      <svg className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-primary/60 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                      <span className="text-left inline-block" style={{ wordBreak: 'normal', lineHeight: '1.4' }}>
                        {t("virtualTryOnModal.authGate.redirectNotice") || "We'll redirect you to secure sign-in"}
                      </span>
                    </p>
                    
                    <div className="text-center text-xs text-muted-foreground">
                      <span>{t("virtualTryOnModal.authGate.accountLink") || "Don't have an account?"} </span>
                      <a 
                        href="#" 
                        onClick={(e) => {
                          e.preventDefault();
                          try {
                            // First, try to get register URL from Liquid-injected JSON script tag
                            const loginUrlScript = document.getElementById('nusense-login-url-info');
                            if (loginUrlScript?.textContent) {
                              const loginUrlData = JSON.parse(loginUrlScript.textContent);
                              if (loginUrlData?.accountRegisterUrl) {
                                const signUpUrl = loginUrlData.accountRegisterUrl;
                                // Validate URL before redirecting
                                try {
                                  new URL(signUpUrl);
                                  if (isInIframe && window.parent !== window) {
                                    try { 
                                      window.parent.location.href = signUpUrl; 
                                    } catch (crossOriginError) { 
                                      window.open(signUpUrl, "_blank"); 
                                    }
                                  } else {
                                    window.location.href = signUpUrl;
                                  }
                                  return;
                                } catch (urlError) {
                                  console.error('[VirtualTryOnModal] Invalid register URL from Liquid:', signUpUrl, urlError);
                                  // Fall through to fallback
                                }
                              }
                            }
                          } catch (error) {
                            console.warn('[VirtualTryOnModal] Error getting register URL:', error);
                          }
                          
                          // Fallback: Construct register URL manually
                          const storeOriginInfo = detectStoreOrigin();
                          const storeOrigin = storeOriginInfo?.origin || storeOriginInfo?.fullUrl || window.location.origin;
                          
                          try {
                            const signUpUrl = new URL("/account/register", storeOrigin).toString();
                            if (isInIframe && window.parent !== window) {
                              try { 
                                window.parent.location.href = signUpUrl; 
                              } catch (crossOriginError) { 
                                window.open(signUpUrl, "_blank"); 
                              }
                            } else {
                              window.location.href = signUpUrl;
                            }
                          } catch (urlError) {
                            console.error('[VirtualTryOnModal] Error constructing register URL:', urlError);
                            // Final fallback: relative path
                            const fallbackUrl = "/account/register";
                            if (isInIframe && window.parent !== window) {
                              try { 
                                window.parent.location.href = fallbackUrl; 
                              } catch { 
                                window.open(fallbackUrl, "_blank"); 
                              }
                            } else {
                              window.location.href = fallbackUrl;
                            }
                          }
                        }} 
                        className="group/link inline-flex items-center gap-1 text-primary hover:text-primary-dark font-bold underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 rounded-sm transition-all duration-200 hover:gap-1.5" 
                        aria-label={t("virtualTryOnModal.authGate.signUpLinkAriaLabel") || "Create a new account"}
                      >
                        <span>{t("virtualTryOnModal.authGate.signUpLink") || "Create one"}</span>
                        <svg className="w-3.5 h-3.5 group-hover/link:translate-x-0.5 transition-transform duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                      </a>
                    </div>
                  </div>
                </div>
              </section>
              </div>
              </div>
            </div>

            {/* Footer - Fixed at bottom - Enhanced with magic */}
            <div className="absolute bottom-2 left-2 right-2 md:bottom-0 md:left-0 md:right-0 border-t border-border/40 bg-gradient-to-r from-white via-white to-primary/3 backdrop-blur-sm px-4 sm:px-6 py-2.5 sm:py-3 flex-shrink-0 z-10 shadow-sm animate-in slide-in-from-bottom duration-500 rounded-b-lg md:rounded-b-none">
              <div className="max-w-[980px] mx-auto">
                <p className="text-xs sm:text-sm text-muted-foreground text-center font-medium tracking-normal">
                  © {new Date().getFullYear()} <span className="font-bold"><span style={{ color: '#ce0003' }}>NU</span><span style={{ color: '#564646' }}>SENSE</span></span>. {t("virtualTryOnModal.authGate.allRightsReserved") || "All rights reserved."}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Main Content - Only show if authenticated */}
        {customerInfo?.id && (
          <>
        {/* Preload Loader - Show until everything is ready */}
        {!isModalPreloaded && (
          <div className="absolute inset-0 bg-white flex items-center justify-center z-[60]">
            <div className="flex flex-col items-center gap-4">
              {/* Continuous Circular Rotation Loader */}
              <div className="relative w-24 h-24 sm:w-28 sm:h-28">
                <svg className="w-full h-full animate-spin" viewBox="0 0 100 100" style={{ animationDuration: '1.4s' }}>
                  {/* Background circle - light gray */}
                  <circle 
                    cx="50" 
                    cy="50" 
                    r="45" 
                    fill="none" 
                    stroke="#e5e7eb" 
                    strokeWidth="8" 
                  />
                  {/* Animated arc - orange with gradient effect */}
                  <circle
                    cx="50"
                    cy="50"
                    r="45"
                    fill="none"
                    stroke="url(#preload-spinner-gradient)"
                    strokeWidth="8"
                    strokeDasharray="70 282"
                    strokeDashoffset="0"
                    strokeLinecap="round"
                    className="origin-center"
                  />
                  {/* Gradient definition for spinner */}
                  <defs>
                    <linearGradient id="preload-spinner-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#FF4F00" stopOpacity="1" />
                      <stop offset="100%" stopColor="#FF7F33" stopOpacity="0.3" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>
              {/* Loading text */}
              <p className="text-sm sm:text-base text-gray-600 font-medium">
                {isLoadingModels ? t('virtualTryOnModal.loadingAiModel') : 
                 showPersonSelection && !boundingBoxesDrawnRef.current ? t('virtualTryOnModal.preparingSelection') :
                 t('virtualTryOnModal.loading')}
              </p>
            </div>
          </div>
        )}
        
        <div className={cn(
          "bg-white w-full max-w-[1200px] md:max-w-[1400px] h-full max-h-[calc(100dvh-1rem)] md:max-h-full flex flex-col overflow-hidden relative shadow-xl md:shadow-2xl rounded-lg pt-[56px] sm:pt-[60px]",
          !isModalPreloaded && "opacity-0 pointer-events-none"
        )} role="dialog" aria-modal="true" aria-labelledby="modal-title" style={{
          transition: 'opacity 0.3s ease-in-out'
        }}>
          {showToast && (
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-gray-800 text-white px-4 sm:px-6 py-3 sm:py-4 rounded-lg shadow-lg md:shadow-xl z-50 flex items-center gap-2 sm:gap-3 animate-fade-in-up max-w-[90%] sm:max-w-none">
              <CheckCircle className="text-green-400 w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                <span className="text-xs sm:text-sm">{toastMessage}</span>
              <button
                onClick={() => setShowToast(false)}
                className="ml-2 sm:ml-4 text-gray-400 hover:text-white underline text-xs sm:text-sm flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-gray-800 rounded-lg"
                aria-label={t('virtualTryOnModal.closeNotification')}
                type="button"
              >
                {t('virtualTryOnModal.closeNotification')}
              </button>
            </div>
          )}

          {/* Viewing Past Try-On Banner */}
          {viewingPastTryOn && viewingHistoryItem && (
            <div className="w-full px-4 sm:px-5 md:px-6 py-2 sm:py-2.5 border-b border-gray-100 transition-all duration-300 ease-in-out">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 sm:gap-3 bg-[#fef9e7] px-1.5 sm:px-2 py-1.5 sm:py-2 rounded-lg border border-yellow-200/60 shadow-sm">
                <div className="flex items-center gap-2 sm:gap-2.5">
                  {/* Circular icon background */}
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-[#fef3c7] flex items-center justify-center flex-shrink-0">
                    <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-[#d97706]" strokeWidth={2} />
                  </div>
                  <div className="flex flex-col">
                    <span className="font-medium text-[#78350f] text-sm sm:text-base">{t('virtualTryOnModal.viewingPastTryOn')}</span>
                    <span className="text-[#92400e] text-xs sm:text-sm">{getTimeAgo(viewingHistoryItem.createdAt)}</span>
                  </div>
                </div>
                <div className="flex gap-2 sm:gap-2.5 md:flex-shrink-0">
                  <button
                    onClick={handleBackToCurrent}
                    className="group relative px-3 sm:px-4 py-1.5 sm:py-2 bg-[#ea580c] hover:bg-[#c2410c] text-white rounded-lg text-sm font-medium transition-all duration-300 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2 hover:scale-105 active:scale-95 hover:shadow-md overflow-hidden"
                    type="button"
                    aria-label={t('virtualTryOnModal.backToCurrent')}
                  >
                    <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out bg-gradient-to-r from-transparent via-white/20 to-transparent"></span>
                    <span className="relative z-10">{t('virtualTryOnModal.backToCurrent')}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {(selectedClothing || productImage) && (
            <div 
              className="w-full px-4 sm:px-5 md:px-6 py-2 sm:py-2.5 border-b border-gray-100 transition-all duration-300 ease-in-out animate-in fade-in slide-in-from-top-2" 
              ref={clothingSelectionRef}
              role="region"
              aria-label="Selected clothing preview"
            >
              <div className="flex items-center gap-2 sm:gap-3 px-1.5 sm:px-2 py-1.5 sm:py-2 rounded-lg border border-gray-200 shadow-sm" style={{ backgroundColor: '#f6f8fa' }}>
                <div className="relative flex-shrink-0">
                  <img
                    key={selectedClothing || productImage} // Force re-render when selectedClothing changes
                    src={selectedClothing || productImage || ''}
                    alt={productTitle}
                    className="h-12 sm:h-14 md:h-16 w-auto object-contain border-4 border-white rounded-lg shadow-md md:shadow-lg"
                    loading="eager"
                    onError={(e) => {
                      const imgElement = e.target as HTMLImageElement;
                      const currentSrc = selectedClothing || productImage || '';
                      console.warn('[VirtualTryOnModal] Failed to load clothing image:', imgElement.src);
                      
                      // Try using proxied URL if it's a direct URL
                      if (currentSrc && !currentSrc.startsWith('data:image/')) {
                        const proxiedUrl = getProxiedImageUrl(currentSrc);
                        if (proxiedUrl !== imgElement.src) {
                          console.log('[VirtualTryOnModal] Retrying clothing image with proxied URL:', proxiedUrl);
                          imgElement.src = proxiedUrl;
                          return; // Don't fallback yet, wait for retry
                        }
                      }
                      
                      // Fallback to first product image if selected clothing fails to load
                      if (productImages.length > 0 && imgElement.src !== productImages[0]) {
                        console.log('[VirtualTryOnModal] Falling back to first product image:', productImages[0]);
                        imgElement.src = productImages[0];
                      } else {
                        // If no fallback available, hide the image
                        console.error('[VirtualTryOnModal] No fallback image available');
                        imgElement.style.display = 'none';
                      }
                    }}
                    onLoad={() => {
                      console.log('[VirtualTryOnModal] Clothing image loaded successfully:', selectedClothing || productImage);
                    }}
                  />
                </div>
                <div className="flex flex-col min-w-0 flex-1">
                  <div className="text-[9px] sm:text-[10px] text-muted-foreground uppercase tracking-wide font-medium whitespace-nowrap mb-0.5 sm:mb-1 transition-colors duration-200">
                    {viewingPastTryOn ? t('virtualTryOnModal.previouslyTriedOn') : t('virtualTryOnModal.youreTryingOn')}
                  </div>
                  <div className="text-base sm:text-lg font-semibold text-foreground leading-tight truncate transition-colors duration-200">{productTitle}</div>
                  {variantInfo && (
                    <div className="text-[10px] sm:text-xs text-muted-foreground leading-tight truncate mt-0.5 transition-colors duration-200">{variantInfo}</div>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-1 overflow-hidden" style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box', minWidth: 0 }}>
            <div 
              id="main-content" 
              ref={mainContentRef}
              className="w-full overflow-y-auto smooth-scroll scrollbar-gutter-stable [&::-webkit-scrollbar]:w-[2px] [&::-webkit-scrollbar]:h-[2px] [&::-webkit-scrollbar-thumb]:bg-gray-400/15 [&::-webkit-scrollbar-thumb]:rounded-sm [&::-webkit-scrollbar-track]:bg-transparent hover:[&::-webkit-scrollbar-thumb]:bg-gray-400/30" 
              style={{ 
                scrollbarWidth: 'thin', 
                scrollbarColor: 'rgba(156, 163, 175, 0.15) transparent',
                scrollbarGutter: 'stable',
                boxSizing: 'border-box',
                width: '100%',
                minWidth: 0,
                maxWidth: '100%'
              }}
            >
              <div className="px-4 sm:px-5 md:px-6 pt-2 sm:pt-2.5 pb-0" style={{ width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box', marginLeft: 0, marginRight: 0 }}>
                <div className="flex flex-col md:grid md:grid-cols-2 gap-2 sm:gap-3 mb-2 md:items-stretch">
                {/* Left Column - Step 1 / Past try-on details / Person Selection */}
                <div className="flex flex-col w-full min-h-0">
                  {/* Person Selection UI - Show in left column when multiple people detected */}
                  {showPersonSelection ? (
                    <>
                      {/* Step 1 Header */}
                      <div className="flex items-center gap-2 sm:gap-2.5 mb-2 sm:mb-2.5">
                        <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center bg-primary text-primary-foreground shadow-sm">
                          <span className="text-xs sm:text-sm font-semibold">1</span>
                        </div>
                        <h2 className="font-semibold text-sm sm:text-base text-gray-800">{t('virtualTryOnModal.chooseYourPhoto')}</h2>
                      </div>
                      
                      {/* Photo Upload Card - Same structure as regular photo upload */}
                      <div ref={photoUploadRef} className={`bg-primary/5 border-2 border-dashed border-primary/20 rounded-lg p-2 sm:p-2.5 flex flex-col items-center text-center mb-2 ${uploadedImage && !showChangePhotoOptions ? 'min-h-[180px] sm:min-h-[200px]' : ''}`}>
                        {(!uploadedImage || showChangePhotoOptions) && (
                          <>
                            <h3 className="text-[10px] sm:text-xs font-semibold text-primary mb-1.5 uppercase tracking-wide">{t('virtualTryOnModal.forBestResults')}</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs text-gray-600 mb-2 w-full">
                              <span className="flex items-center gap-1.5 justify-start">
                                <Check size={14} className="text-green-500 flex-shrink-0" strokeWidth={3} /> {t('virtualTryOnModal.frontFacingPose')}
                              </span>
                              <span className="flex items-center gap-1.5 justify-start">
                                <Check size={14} className="text-green-500 flex-shrink-0" strokeWidth={3} /> {t('virtualTryOnModal.armsVisible')}
                              </span>
                              <span className="flex items-center gap-1.5 justify-start">
                                <Check size={14} className="text-green-500 flex-shrink-0" strokeWidth={3} /> {t('virtualTryOnModal.goodLighting')}
                              </span>
                              <span className="flex items-center gap-1.5 justify-start">
                                <Check size={14} className="text-green-500 flex-shrink-0" strokeWidth={3} /> {t('virtualTryOnModal.plainBackground')}
                              </span>
                            </div>
                          </>
                        )}
                        {uploadedImage && !showChangePhotoOptions ? (
                          <div className="w-full flex flex-col items-center justify-center relative">
                            {/* Hidden image for detection - CRITICAL: Must be present for canvas drawing */}
                            <img
                              ref={detectionImageRef}
                              src={uploadedImage}
                              alt="Detection source"
                              className="hidden"
                              crossOrigin="anonymous"
                              onError={(e) => console.error('[PersonSelection] Detection image failed to load:', e)}
                            />
                            
                            {/* Instructions for user */}
                            {showPersonSelection && detectionResult?.people && detectionResult.people.length > 1 && (
                              <div className="mb-2 sm:mb-2.5 px-2 text-center">
                                <p className="text-xs sm:text-sm text-gray-700 font-medium">
                                  {t('virtualTryOnModal.clickPersonToSelect')}
                                </p>
                                <p className="text-xs text-gray-500 mt-0.5">
                                  {t('virtualTryOnModal.peopleDetected', { count: detectionResult.people.length })}
                                </p>
                              </div>
                            )}
                            {/* Canvas with bounding boxes OR regular image - fixed height for consistency */}
                            <div ref={canvasContainerRef} className="relative w-full h-[180px] sm:h-[200px] flex items-center justify-center">
                              {/* Canvas wrapper - ALWAYS rendered so ref exists, visibility controlled by CSS */}
                              <div 
                                className="relative inline-flex items-center justify-center max-w-full max-h-full h-full"
                                style={{ display: boundingBoxesDrawn ? 'flex' : 'none' }}
                              >
                                <canvas
                                  ref={canvasRef}
                                  className="rounded-lg border-4 border-white shadow-md md:shadow-lg cursor-pointer"
                                  style={{ 
                                    pointerEvents: 'auto',
                                    backgroundColor: 'transparent',
                                    display: 'block'
                                  }}
                                  aria-label={t('virtualTryOnModal.selectPersonForTryOn')}
                                />
                              </div>
                              
                              {/* Regular image - shows while waiting, hidden when canvas ready */}
                              {!boundingBoxesDrawn && (
                                <img
                                  src={uploadedImage}
                                  alt={t('virtualTryOnModal.uploadedPhoto')}
                                  className="max-w-full max-h-full h-full object-contain rounded-lg border-4 border-white shadow-md md:shadow-lg"
                                />
                              )}
                            </div>
                          </div>
                        ) : (
                          <button
                            className="group relative bg-primary hover:bg-primary-dark text-primary-foreground px-6 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2 transition-all duration-300 ease-in-out w-full justify-center shadow-md md:shadow-lg hover:shadow-lg md:hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 overflow-hidden"
                            aria-label={t('virtualTryOnModal.uploadPhoto')}
                            type="button"
                            onClick={triggerPhotoUpload}
                          >
                            <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out bg-gradient-to-r from-transparent via-white/20 to-transparent"></span>
                            <Upload size={16} className="relative z-10 transition-transform duration-300 group-hover:scale-110" /> 
                            <span className="relative z-10">{t('virtualTryOnModal.uploadPhoto')}</span>
                          </button>
                        )}
                      </div>

                      {/* Recent Photos Section - Show when change photo options are expanded */}
                      {!viewingPastTryOn && step !== 'generating' && step !== 'complete' && showChangePhotoOptions && (
                        <div className="mb-2">
                          <div className="bg-white border border-gray-200 rounded-lg p-1.5 sm:p-2 shadow-sm">
                            <label className="text-xs sm:text-sm font-semibold text-gray-800 mb-1.5 sm:mb-2 block">{t('virtualTryOnModal.yourRecentPhotos')}</label>
                            <div 
                              className="flex gap-2 sm:gap-3 overflow-x-hidden overflow-y-visible py-1" 
                            >
                            {isLoadingRecentPhotos ? (
                              <div className="flex gap-2 sm:gap-3">
                                {[1, 2, 3].map((i) => (
                                  <div key={i} className="flex-shrink-0 h-14 w-14 rounded-lg border-2 border-transparent bg-gray-50 overflow-hidden">
                                    <Skeleton className="w-full h-full rounded-lg" />
                                  </div>
                                ))}
                              </div>
                            ) : recentPhotos.length > 0 ? (
                              recentPhotos.map((photo) => {
                                const isLoading = loadingRecentPhotoIds.has(photo.id);
                                return (
                                  <button
                                    key={photo.id}
                                    onTouchStart={handleTouchStart}
                                    onTouchMove={handleTouchMove}
                                    onTouchEnd={(e) => handleTouchEnd(e, async () => {
                                      setSelectedPhoto(photo.id);
                                      // Use proxy URL for display (same as history images)
                                      const proxiedUrl = getProxiedImageUrl(photo.src);
                                      setUploadedImage(proxiedUrl);
                                      storage.saveUploadedImage(proxiedUrl);
                                      setPhotoSelectionMethod('file');
                                      setError(null);
                                      setShowChangePhotoOptions(false);
                                      if (isWidgetTestPath()) {
                                        setSelectedPersonBbox(null);
                                        setSelectedPersonIndex(null);
                                      }
                                      
                                      // Try Base64 conversion for detection in background (non-blocking)
                                      if (isWidgetTestPath()) {
                                        try {
                                          const base64Image = await convertImageUrlToBase64(photo.src);
                                          if (base64Image) {
                                            setUploadedImageForDetection(base64Image);
                                            console.log('[VirtualTryOnModal] Base64 conversion successful for detection');
                                          } else {
                                            console.warn('[VirtualTryOnModal] Base64 conversion failed, detection may not work');
                                            setUploadedImageForDetection(null);
                                          }
                                        } catch (error) {
                                          console.warn('[VirtualTryOnModal] Base64 conversion error:', error);
                                          setUploadedImageForDetection(null);
                                        }
                                      }
                                    })}
                                    onClick={async () => {
                                      if (!('ontouchstart' in window)) {
                                        setSelectedPhoto(photo.id);
                                        // Use proxy URL for display (same as history images)
                                        const proxiedUrl = getProxiedImageUrl(photo.src);
                                        setUploadedImage(proxiedUrl);
                                        storage.saveUploadedImage(proxiedUrl);
                                        setPhotoSelectionMethod('file');
                                        setError(null);
                                        setShowChangePhotoOptions(false);
                                        if (isWidgetTestPath()) {
                                          setSelectedPersonBbox(null);
                                          setSelectedPersonIndex(null);
                                        }
                                        
                                        // Try Base64 conversion for detection in background (non-blocking)
                                        if (isWidgetTestPath()) {
                                          try {
                                            const base64Image = await convertImageUrlToBase64(photo.src);
                                            if (base64Image) {
                                              setUploadedImageForDetection(base64Image);
                                              console.log('[VirtualTryOnModal] Base64 conversion successful for detection');
                                            } else {
                                              console.warn('[VirtualTryOnModal] Base64 conversion failed, detection may not work');
                                              setUploadedImageForDetection(null);
                                            }
                                          } catch (error) {
                                            console.warn('[VirtualTryOnModal] Base64 conversion error:', error);
                                            setUploadedImageForDetection(null);
                                          }
                                        }
                                      }
                                    }}
                                    className={`group relative flex-shrink-0 h-14 rounded-lg border-2 transition-all duration-300 ease-in-out flex items-center justify-center bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 overflow-hidden ${
                                      selectedPhoto === photo.id
                                        ? 'border-primary ring-2 ring-primary/20 scale-105 shadow-md md:shadow-lg'
                                        : 'border-transparent hover:border-primary/30 shadow-sm md:shadow-md hover:shadow-md md:hover:shadow-lg hover:scale-105 active:scale-95'
                                    }`}
                                    aria-label={t('virtualTryOnModal.selectPhoto', { id: photo.id })}
                                    type="button"
                                  >
                                    {selectedPhoto !== photo.id && (
                                      <div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/5 transition-colors duration-300 rounded-lg z-10 border-4 border-white shadow-md md:shadow-lg"></div>
                                    )}
                                    {isLoading && (
                                      <div className="absolute inset-0 z-20 flex items-center justify-center">
                                        <Skeleton className="w-full h-full rounded-lg" />
                                      </div>
                                    )}
                                    <img 
                                      src={getProxiedImageUrl(photo.src)} 
                                      alt={t('virtualTryOnModal.user')} 
                                      className={`h-full w-auto object-contain border-2 border-white rounded-lg shadow-sm transition-all duration-300 relative z-0 ${
                                        isLoading ? 'opacity-0' : 'opacity-100'
                                      } ${
                                        selectedPhoto === photo.id 
                                          ? 'ring-2 ring-primary/20' 
                                          : 'group-hover:scale-105 group-hover:shadow-md'
                                      }`}
                                      onLoad={() => {
                                        setLoadingRecentPhotoIds((prev) => {
                                          const next = new Set(prev);
                                          next.delete(photo.id);
                                          return next;
                                        });
                                      }}
                                      onError={(e) => {
                                        setLoadingRecentPhotoIds((prev) => {
                                          const next = new Set(prev);
                                          next.delete(photo.id);
                                          return next;
                                        });
                                        if ((e.target as HTMLImageElement).src !== photo.src) {
                                          (e.target as HTMLImageElement).src = photo.src;
                                        }
                                      }}
                                    />
                                    {selectedPhoto === photo.id && (
                                      <div className="absolute top-1 right-1 w-3 h-3 bg-primary rounded-full border-2 border-white shadow-sm z-30 animate-in zoom-in duration-200"></div>
                                    )}
                                  </button>
                                );
                              })
                            ) : (
                              <div className="text-xs text-gray-500">{t('virtualTryOnModal.noRecentPhotos')}</div>
                            )}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Use a Demo Model Section - Show when change photo options are expanded */}
                      {!viewingPastTryOn && step !== 'generating' && step !== 'complete' && showChangePhotoOptions && (
                        <div>
                          <div className="bg-white border border-gray-200 rounded-lg p-1.5 sm:p-2 shadow-sm">
                            <label className="text-xs sm:text-sm font-semibold text-gray-800 mb-1.5 sm:mb-2 block">{t('virtualTryOnModal.useDemoModel')}</label>
                            <div 
                              className="flex gap-2 sm:gap-3 overflow-x-hidden overflow-y-visible py-1" 
                            >
                            {demoModels.map((model) => {
                              const modelIndex = DEMO_PHOTOS_ARRAY.findIndex(p => p.url === model.url);
                              const isLoading = loadingDemoModelIds.has(model.id);
                              return (
                                <button
                                  key={model.id}
                                  onTouchStart={handleTouchStart}
                                  onTouchMove={handleTouchMove}
                                  onTouchEnd={(e) => handleTouchEnd(e, () => {
                                    setSelectedPhoto(modelIndex);
                                    setUploadedImage(model.url);
                                    setUploadedImageForDetection(null); // Demo photos are local URLs, no Base64 needed
                                    storage.saveUploadedImage(model.url);
                                    setPhotoSelectionMethod('demo');
                                    setSelectedDemoPhotoUrl(model.url);
                                    setError(null);
                                    setShowChangePhotoOptions(false);
                                    if (isWidgetTestPath()) {
                                      setSelectedPersonBbox(null);
                                      setSelectedPersonIndex(null);
                                    }
                                  })}
                                  onClick={() => {
                                    if (!('ontouchstart' in window)) {
                                      setSelectedPhoto(modelIndex);
                                      setUploadedImage(model.url);
                                      setUploadedImageForDetection(null); // Demo photos are local URLs, no Base64 needed
                                      storage.saveUploadedImage(model.url);
                                      setPhotoSelectionMethod('demo');
                                      setSelectedDemoPhotoUrl(model.url);
                                      setError(null);
                                      setShowChangePhotoOptions(false);
                                      if (isWidgetTestPath()) {
                                        setSelectedPersonBbox(null);
                                        setSelectedPersonIndex(null);
                                      }
                                    }
                                  }}
                                  className={`group relative flex-shrink-0 h-14 rounded-lg border-2 transition-all duration-300 ease-in-out flex items-center justify-center bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 overflow-hidden ${
                                    selectedPhoto === modelIndex
                                      ? 'border-primary ring-2 ring-primary/20 scale-105 shadow-md md:shadow-lg'
                                      : 'border-transparent hover:border-primary/30 shadow-sm md:shadow-md hover:shadow-md md:hover:shadow-lg hover:scale-105 active:scale-95'
                                  }`}
                                  aria-label={t('virtualTryOnModal.selectDemoModel', { id: model.id })}
                                  type="button"
                                >
                                  {selectedPhoto !== modelIndex && (
                                    <div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/5 transition-colors duration-300 rounded-lg z-10 border-4 border-white shadow-md md:shadow-lg"></div>
                                  )}
                                  {isLoading && (
                                    <div className="absolute inset-0 z-20 flex items-center justify-center">
                                      <Skeleton className="w-full h-full rounded-lg" />
                                    </div>
                                  )}
                                  <img 
                                    src={model.url} 
                                    alt={t('virtualTryOnModal.demoModel', { id: model.id })} 
                                    className={`h-full w-auto object-contain border-2 border-white rounded-lg shadow-sm transition-all duration-300 relative z-0 ${
                                      isLoading ? 'opacity-0' : 'opacity-100'
                                    } ${
                                      selectedPhoto === modelIndex 
                                        ? 'ring-2 ring-primary/20' 
                                        : 'group-hover:scale-105 group-hover:shadow-md'
                                    }`}
                                    onLoad={() => {
                                      setLoadingDemoModelIds((prev) => {
                                        const next = new Set(prev);
                                        next.delete(model.id);
                                        return next;
                                      });
                                    }}
                                    onError={() => {
                                      setLoadingDemoModelIds((prev) => {
                                        const next = new Set(prev);
                                        next.delete(model.id);
                                        return next;
                                      });
                                    }}
                                  />
                                  {selectedPhoto === modelIndex && (
                                    <div className="absolute top-1 right-1 w-3 h-3 bg-primary rounded-full border-2 border-white shadow-sm z-30 animate-in zoom-in duration-200"></div>
                                  )}
                                </button>
                              );
                            })}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Change Photo Section - Show consistently before, during, and after generation */}
                      {!viewingPastTryOn && uploadedImage && !showChangePhotoOptions && (
                        <div className="bg-white border border-gray-200 rounded-lg p-3 sm:p-4 shadow-sm">
                          <button
                            onClick={handleChangePhoto}
                            disabled={step === 'generating'}
                            className="w-full flex items-center gap-2 sm:gap-3 text-left hover:bg-gray-50 rounded-lg p-2 -m-2 transition-colors duration-200 group disabled:opacity-50 disabled:cursor-not-allowed"
                            type="button"
                          >
                            <RefreshCw className="w-4 h-4 sm:w-5 sm:h-5 text-primary flex-shrink-0 group-hover:rotate-180 transition-transform duration-500" />
                            <div className="flex flex-col min-w-0 flex-1">
                              <span className="text-xs sm:text-sm font-semibold text-gray-800 group-hover:text-primary transition-colors">
                                {t('virtualTryOnModal.changePhoto')}
                              </span>
                              <span className="text-[10px] sm:text-xs text-gray-600 mt-0.5">
                                {t('virtualTryOnModal.uploadDifferentPhoto')}
                              </span>
                            </div>
                          </button>
                        </div>
                      )}
                    </>
                  ) : (
                  <>
                  {/* Conditional Header - Past try-on details when viewing history, generating, or step is complete, otherwise Choose your photo */}
                  {(viewingPastTryOn || step === 'generating' || step === 'complete') ? (
                    <>
                      {/* Past try-on details Header */}
                      <div className="flex items-center gap-2 sm:gap-2.5 mb-2 sm:mb-2.5">
                        <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center bg-primary text-primary-foreground shadow-sm">
                          <Check size={14} strokeWidth={3} className="sm:w-4 sm:h-4" />
                        </div>
                        <h2 className="font-semibold text-sm sm:text-base text-gray-800">{t('virtualTryOnModal.pastTryOnDetails')}</h2>
                      </div>

                      {/* Photo used subsection */}
                      <div className="border border-gray-200 rounded-lg p-3 sm:p-4 mb-3 shadow-sm" style={{ backgroundColor: '#f6f8fa' }}>
                        <h3 className="text-xs sm:text-sm font-semibold text-gray-800 mb-2 sm:mb-3">{t('virtualTryOnModal.photoUsed')}</h3>
                        {uploadedImage ? (
                          <div className="flex items-center gap-3">
                            <div className="relative flex-shrink-0">
                              <img
                                src={uploadedImage}
                                alt="Original photo"
                                className="h-12 sm:h-14 md:h-16 w-auto object-contain border-4 border-white rounded-lg shadow-md md:shadow-lg"
                                loading="eager"
                                onError={(e) => {
                                  const imgElement = e.target as HTMLImageElement;
                                  console.error('[VirtualTryOnModal] Failed to load original photo:', imgElement.src);
                                  // Try using proxied URL if it's a direct URL
                                  if (uploadedImage && !uploadedImage.startsWith('data:image/')) {
                                    const proxiedUrl = getProxiedImageUrl(uploadedImage);
                                    if (proxiedUrl !== imgElement.src) {
                                      console.log('[VirtualTryOnModal] Retrying original photo with proxied URL:', proxiedUrl);
                                      imgElement.src = proxiedUrl;
                                      return; // Don't hide yet, wait for retry
                                    }
                                  }
                                  // If still fails, show fallback
                                  console.warn('[VirtualTryOnModal] Original photo failed to load, showing fallback');
                                  imgElement.style.display = 'none';
                                }}
                                onLoad={() => {
                                  console.log('[VirtualTryOnModal] Original photo loaded successfully');
                                }}
                              />
                            </div>
                            <div className="flex flex-col">
                              <p className="text-xs sm:text-sm text-gray-800 font-normal">
                                {t('virtualTryOnModal.originalPhoto')}
                              </p>
                              <p className="text-xs sm:text-sm text-gray-800 font-semibold">
                                {viewingHistoryItem ? getTimeAgo(viewingHistoryItem.createdAt) : (step === 'generating' || step === 'complete') ? t('virtualTryOnModal.justNow') : t('virtualTryOnModal.currentSession')}
                              </p>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-3">
                            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                              <Eye className="w-6 h-6 sm:w-8 sm:h-8 text-gray-400" />
                            </div>
                            <div className="flex flex-col">
                              <p className="text-xs sm:text-sm text-gray-800 font-normal">{t('virtualTryOnModal.originalPhoto')}</p>
                              <p className="text-xs sm:text-sm text-gray-500">{t('virtualTryOnModal.noPhotoAvailable')}</p>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Regenerate with new photo subsection */}
                      <div className="bg-white border border-gray-200 rounded-lg p-3 sm:p-4 shadow-sm">
                        <button
                          onClick={() => {
                            // Always show photo selection UI when regenerating with new photo
                            // This allows user to upload/select a different person photo
                            console.log('[VirtualTryOnModal] Starting fresh try-on with new photo');
                            handleRegenerateWithNewPhoto();
                          }}
                          disabled={step === 'generating'}
                          className="w-full flex items-center gap-2 sm:gap-3 text-left hover:bg-gray-50 rounded-lg p-2 -m-2 transition-colors duration-200 group disabled:opacity-50 disabled:cursor-not-allowed"
                          type="button"
                        >
                          <RefreshCw className="w-4 h-4 sm:w-5 sm:h-5 text-primary flex-shrink-0 group-hover:rotate-180 transition-transform duration-500" />
                          <div className="flex flex-col min-w-0 flex-1">
                            <span className="text-xs sm:text-sm font-semibold text-gray-800 group-hover:text-primary transition-colors">
                              {t('virtualTryOnModal.regenerateWithNewPhoto')}
                            </span>
                            <span className="text-[10px] sm:text-xs text-gray-600 mt-0.5">
                              {t('virtualTryOnModal.createFreshTryOn')}
                            </span>
                          </div>
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Step 1 Header */}
                      <div className="flex items-center gap-2 sm:gap-2.5 mb-2 sm:mb-2.5">
                        <div className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center transition-all duration-300 ${
                          uploadedImage 
                            ? 'bg-primary text-primary-foreground shadow-sm' // Step 1 completed - primary background with checkmark
                            : 'bg-gray-300 text-gray-500' // Incomplete - grey background with number
                        }`}>
                          {uploadedImage ? (
                            <Check size={14} strokeWidth={3} className="sm:w-4 sm:h-4" />
                          ) : (
                            <span className="text-xs sm:text-sm font-semibold">1</span>
                          )}
                        </div>
                        <h2 className={`font-semibold text-sm sm:text-base text-gray-800 transition-colors duration-300 ${
                          uploadedImage ? 'text-gray-900' : 'text-gray-500'
                        }`}>{t('virtualTryOnModal.chooseYourPhoto')}</h2>
                      </div>
                  {/* Photo Upload Card */}
                  <div ref={photoUploadRef} className={`bg-primary/5 border-2 border-dashed border-primary/20 rounded-lg p-2 sm:p-2.5 flex flex-col items-center text-center mb-2 ${uploadedImage && !showChangePhotoOptions ? 'min-h-[180px] sm:min-h-[200px]' : ''}`}>
                    {(!uploadedImage || showChangePhotoOptions) && (
                      <>
                        <h3 className="text-[10px] sm:text-xs font-semibold text-primary mb-1.5 uppercase tracking-wide">{t('virtualTryOnModal.forBestResults')}</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs text-gray-600 mb-2 w-full">
                          <span className="flex items-center gap-1.5 justify-start">
                            <Check size={14} className="text-green-500 flex-shrink-0" strokeWidth={3} /> {t('virtualTryOnModal.frontFacingPose')}
                          </span>
                          <span className="flex items-center gap-1.5 justify-start">
                            <Check size={14} className="text-green-500 flex-shrink-0" strokeWidth={3} /> {t('virtualTryOnModal.armsVisible')}
                          </span>
                          <span className="flex items-center gap-1.5 justify-start">
                            <Check size={14} className="text-green-500 flex-shrink-0" strokeWidth={3} /> {t('virtualTryOnModal.goodLighting')}
                          </span>
                          <span className="flex items-center gap-1.5 justify-start">
                            <Check size={14} className="text-green-500 flex-shrink-0" strokeWidth={3} /> {t('virtualTryOnModal.plainBackground')}
                          </span>
                        </div>
                      </>
                    )}
                    {uploadedImage && !showChangePhotoOptions ? (
                      <div className="w-full flex flex-col items-center justify-center relative">
                        {/* Hidden image for detection - ALWAYS present to maintain consistent ref */}
                        {isWidgetTestPath() && shouldDetectPeople && (
                          <img
                            ref={detectionImageRef}
                            src={uploadedImage}
                            alt="Detection source"
                            className="hidden"
                            crossOrigin="anonymous"
                            onError={(e) => console.error('[PersonSelection] Detection image failed to load:', e)}
                          />
                        )}
                        
                        {/* Always show the image first - fixed height for consistency */}
                        <div className="relative w-full h-[180px] sm:h-[200px] flex items-center justify-center">
                          <img
                            src={uploadedImage}
                            alt={t('virtualTryOnModal.uploadedPhoto')}
                            className="max-w-full max-h-full h-full object-contain rounded-lg border-4 border-white shadow-md md:shadow-lg"
                          />
                          
                          {/* Skeleton loading overlay while detection is processing */}
                          {/* Only show when modal is preloaded to avoid duplicate loaders with preload loader */}
                          {/* Also hide during generation to prevent overlap with generating loader */}
                          {isWidgetTestPath() && shouldDetectPeople && isModalPreloaded && step !== 'generating' && (isLoadingModels || isDetecting) && (
                            <div className="absolute inset-0 bg-white/40 backdrop-blur-[1px] rounded-lg border-4 border-white flex items-center justify-center animate-pulse">
                              <div className="flex flex-col items-center gap-2 bg-white/90 px-4 py-3 rounded-lg shadow-lg">
                                <div className="flex items-center gap-2">
                                  <svg className="animate-spin h-4 w-4 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                  </svg>
                                  <span className="text-xs font-medium text-gray-700">
                                    {isLoadingModels ? t('virtualTryOnModal.loadingAiModel') : t('virtualTryOnModal.detectingPeople')}
                                  </span>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                        
                        {/* Person detection UI for /widget-test path - shown below image */}
                        {/* Only show detection states after modal is preloaded to avoid duplicate loaders */}
                        {isWidgetTestPath() && shouldDetectPeople && isModalPreloaded && (
                          <div className="mt-2">
                            {/* Error state - only show after preload */}
                            {detectionError && !isLoadingModels && !isDetecting && (
                              <div className="flex flex-col items-center gap-2 py-2">
                                <AlertCircle className="w-5 h-5 text-red-500" />
                                <p className="text-xs text-red-600">{detectionError}</p>
                              </div>
                            )}
                            
                            {/* Detection results - minimal feedback */}
                            {!isLoadingModels && !isDetecting && !detectionError && detectionResult && (
                              <>
                                {detectionResult.people && detectionResult.people.length === 0 && (
                                  <div className="text-center py-2">
                                    <p className="text-xs text-gray-600">{t('virtualTryOnModal.noPeopleDetected')}</p>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <button
                        className="group relative bg-primary hover:bg-primary-dark text-primary-foreground px-6 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2 transition-all duration-300 ease-in-out w-full justify-center shadow-md md:shadow-lg hover:shadow-lg md:hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 overflow-hidden"
                        aria-label={t('virtualTryOnModal.uploadPhoto')}
                        type="button"
                        onClick={triggerPhotoUpload}
                      >
                        {/* Shimmer effect on hover */}
                        <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out bg-gradient-to-r from-transparent via-white/20 to-transparent"></span>
                        <Upload size={16} className="relative z-10 transition-transform duration-300 group-hover:scale-110" /> 
                        <span className="relative z-10">{t('virtualTryOnModal.uploadPhoto')}</span>
                      </button>
                    )}
                  </div>

                  {/* Recent Photos Section - Hidden when viewing past try-on, generating, step is complete, or when photo is uploaded and change photo options are not shown */}
                  {!viewingPastTryOn && (step === 'idle') && (!uploadedImage || showChangePhotoOptions) && (
                  <div className="mb-2">
                    <div className="bg-white border border-gray-200 rounded-lg p-1.5 sm:p-2 shadow-sm">
                      <label className="text-xs sm:text-sm font-semibold text-gray-800 mb-1.5 sm:mb-2 block">{t('virtualTryOnModal.yourRecentPhotos')}</label>
                      <div 
                        className="flex gap-2 sm:gap-3 overflow-x-hidden overflow-y-visible py-1" 
                      >
                      {isLoadingRecentPhotos ? (
                        <div className="flex gap-2 sm:gap-3">
                          {[1, 2, 3].map((i) => (
                            <div key={i} className="flex-shrink-0 h-14 w-14 rounded-lg border-2 border-transparent bg-gray-50 overflow-hidden">
                              <Skeleton className="w-full h-full rounded-lg" />
                            </div>
                          ))}
                        </div>
                      ) : recentPhotos.length > 0 ? (
                        recentPhotos.map((photo) => {
                          const isLoading = loadingRecentPhotoIds.has(photo.id);
                          return (
                            <button
                              key={photo.id}
                              onTouchStart={handleTouchStart}
                              onTouchMove={handleTouchMove}
                              onTouchEnd={(e) => handleTouchEnd(e, async () => {
                                setSelectedPhoto(photo.id);
                                // Use proxy URL for display (same as history images)
                                const proxiedUrl = getProxiedImageUrl(photo.src);
                                setUploadedImage(proxiedUrl);
                                storage.saveUploadedImage(proxiedUrl);
                                setPhotoSelectionMethod('file');
                                setError(null);
                                setShowChangePhotoOptions(false); // Close expanded options
                                // Reset person selection when new photo is selected (for /widget-test path)
                                if (isWidgetTestPath()) {
                                  setSelectedPersonBbox(null);
                                  setSelectedPersonIndex(null);
                                }
                                
                                // Try Base64 conversion for detection in background (non-blocking)
                                if (isWidgetTestPath()) {
                                  try {
                                    const base64Image = await convertImageUrlToBase64(photo.src);
                                    if (base64Image) {
                                      setUploadedImageForDetection(base64Image);
                                      console.log('[VirtualTryOnModal] Base64 conversion successful for detection');
                                    } else {
                                      console.warn('[VirtualTryOnModal] Base64 conversion failed, detection may not work');
                                      setUploadedImageForDetection(null);
                                    }
                                  } catch (error) {
                                    console.warn('[VirtualTryOnModal] Base64 conversion error:', error);
                                    setUploadedImageForDetection(null);
                                  }
                                }
                              })}
                              onClick={async () => {
                                // Only handle click if not on touch device (touch events handle touch devices)
                                if (!('ontouchstart' in window)) {
                                  setSelectedPhoto(photo.id);
                                  // Use proxy URL for display (same as history images)
                                  const proxiedUrl = getProxiedImageUrl(photo.src);
                                  setUploadedImage(proxiedUrl);
                                  storage.saveUploadedImage(proxiedUrl);
                                  setPhotoSelectionMethod('file');
                                  setError(null);
                                  setShowChangePhotoOptions(false); // Close expanded options
                                  // Reset person selection when new photo is selected (for /widget-test path)
                                  if (isWidgetTestPath()) {
                                    setSelectedPersonBbox(null);
                                    setSelectedPersonIndex(null);
                                  }
                                  
                                  // Try Base64 conversion for detection in background (non-blocking)
                                  if (isWidgetTestPath()) {
                                    try {
                                      const base64Image = await convertImageUrlToBase64(photo.src);
                                      if (base64Image) {
                                        setUploadedImageForDetection(base64Image);
                                        console.log('[VirtualTryOnModal] Base64 conversion successful for detection');
                                      } else {
                                        console.warn('[VirtualTryOnModal] Base64 conversion failed, detection may not work');
                                        setUploadedImageForDetection(null);
                                      }
                                    } catch (error) {
                                      console.warn('[VirtualTryOnModal] Base64 conversion error:', error);
                                      setUploadedImageForDetection(null);
                                    }
                                  }
                                }
                              }}
                              className={`group relative flex-shrink-0 h-14 rounded-lg border-2 transition-all duration-300 ease-in-out flex items-center justify-center bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 overflow-hidden ${
                                selectedPhoto === photo.id
                                  ? 'border-primary ring-2 ring-primary/20 scale-105 shadow-md md:shadow-lg'
                                  : 'border-transparent hover:border-primary/30 shadow-sm md:shadow-md hover:shadow-md md:hover:shadow-lg hover:scale-105 active:scale-95'
                              }`}
                              aria-label={t('virtualTryOnModal.selectPhoto', { id: photo.id })}
                              type="button"
                            >
                              {/* Hover overlay effect */}
                              {selectedPhoto !== photo.id && (
                                <div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/5 transition-colors duration-300 rounded-lg z-10 border-4 border-white shadow-md md:shadow-lg"></div>
                              )}
                              {isLoading && (
                                <div className="absolute inset-0 z-20 flex items-center justify-center">
                                  <Skeleton className="w-full h-full rounded-lg" />
                                </div>
                              )}
                              <img 
                                src={getProxiedImageUrl(photo.src)} 
                                alt={t('virtualTryOnModal.user')} 
                                className={`h-full w-auto object-contain border-2 border-white rounded-lg shadow-sm transition-all duration-300 relative z-0 ${
                                  isLoading ? 'opacity-0' : 'opacity-100'
                                } ${
                                  selectedPhoto === photo.id 
                                    ? 'ring-2 ring-primary/20' 
                                    : 'group-hover:scale-105 group-hover:shadow-md'
                                }`}
                                onLoad={() => {
                                  setLoadingRecentPhotoIds((prev) => {
                                    const next = new Set(prev);
                                    next.delete(photo.id);
                                    return next;
                                  });
                                }}
                                onError={(e) => {
                                  setLoadingRecentPhotoIds((prev) => {
                                    const next = new Set(prev);
                                    next.delete(photo.id);
                                    return next;
                                  });
                                  // Fallback to direct URL if proxy fails
                                  if ((e.target as HTMLImageElement).src !== photo.src) {
                                    (e.target as HTMLImageElement).src = photo.src;
                                  }
                                }}
                              />
                              {/* Selection indicator */}
                              {selectedPhoto === photo.id && (
                                <div className="absolute top-1 right-1 w-3 h-3 bg-primary rounded-full border-2 border-white shadow-sm z-30 animate-in zoom-in duration-200"></div>
                              )}
                            </button>
                          );
                        })
                      ) : (
                        <div className="text-xs text-gray-500">{t('virtualTryOnModal.noRecentPhotos')}</div>
                      )}
                      </div>
                    </div>
                  </div>
                  )}

                  {/* Use a Demo Model Section - Hidden when viewing past try-on, generating, step is complete, or when photo is uploaded and change photo options are not shown */}
                  {!viewingPastTryOn && (step === 'idle') && (!uploadedImage || showChangePhotoOptions) && (
                  <div>
                    <div className="bg-white border border-gray-200 rounded-lg p-1.5 sm:p-2 shadow-sm">
                      <label className="text-xs sm:text-sm font-semibold text-gray-800 mb-1.5 sm:mb-2 block">{t('virtualTryOnModal.useDemoModel')}</label>
                      <div 
                        className="flex gap-2 sm:gap-3 overflow-x-hidden overflow-y-visible py-1" 
                      >
                      {demoModels.map((model) => {
                        // Use a unique identifier for selection tracking
                        const modelIndex = DEMO_PHOTOS_ARRAY.findIndex(p => p.url === model.url);
                        const isLoading = loadingDemoModelIds.has(model.id);
                        return (
                          <button
                            key={model.id}
                            onTouchStart={handleTouchStart}
                            onTouchMove={handleTouchMove}
                            onTouchEnd={(e) => handleTouchEnd(e, () => {
                              setSelectedPhoto(modelIndex);
                              // Set URL directly - same simple approach
                              setUploadedImage(model.url);
                              setUploadedImageForDetection(null); // Demo photos are local URLs, no Base64 needed
                              storage.saveUploadedImage(model.url);
                              setPhotoSelectionMethod('demo');
                              setSelectedDemoPhotoUrl(model.url);
                              setError(null);
                              setShowChangePhotoOptions(false); // Close expanded options
                              // Reset person selection when new photo is selected (for /widget-test path)
                              if (isWidgetTestPath()) {
                                setSelectedPersonBbox(null);
                                setSelectedPersonIndex(null);
                              }
                            })}
                            onClick={() => {
                              // Only handle click if not on touch device (touch events handle touch devices)
                              if (!('ontouchstart' in window)) {
                                setSelectedPhoto(modelIndex);
                                // Set URL directly - same simple approach
                                setUploadedImage(model.url);
                                setUploadedImageForDetection(null); // Demo photos are local URLs, no Base64 needed
                                storage.saveUploadedImage(model.url);
                                setPhotoSelectionMethod('demo');
                                setSelectedDemoPhotoUrl(model.url);
                                setError(null);
                                setShowChangePhotoOptions(false); // Close expanded options
                                // Reset person selection when new photo is selected (for /widget-test path)
                                if (isWidgetTestPath()) {
                                  setSelectedPersonBbox(null);
                                  setSelectedPersonIndex(null);
                                }
                              }
                            }}
                            className={`group relative flex-shrink-0 h-14 rounded-lg border-2 transition-all duration-300 ease-in-out flex items-center justify-center bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 overflow-hidden ${
                              selectedPhoto === modelIndex
                                ? 'border-primary ring-2 ring-primary/20 scale-105 shadow-md md:shadow-lg'
                                : 'border-transparent hover:border-primary/30 shadow-sm md:shadow-md hover:shadow-md md:hover:shadow-lg hover:scale-105 active:scale-95'
                            }`}
                            aria-label={t('virtualTryOnModal.selectDemoModel', { id: model.id })}
                            type="button"
                          >
                            {/* Hover overlay effect */}
                            {selectedPhoto !== modelIndex && (
                              <div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/5 transition-colors duration-300 rounded-lg z-10 border-4 border-white shadow-md md:shadow-lg"></div>
                            )}
                            {isLoading && (
                              <div className="absolute inset-0 z-20 flex items-center justify-center">
                                <Skeleton className="w-full h-full rounded-lg" />
                              </div>
                            )}
                            <img 
                              src={model.url} 
                              alt={t('virtualTryOnModal.demoModel', { id: model.id })} 
                              className={`h-full w-auto object-contain border-2 border-white rounded-lg shadow-sm transition-all duration-300 relative z-0 ${
                                isLoading ? 'opacity-0' : 'opacity-100'
                              } ${
                                selectedPhoto === modelIndex 
                                  ? 'ring-2 ring-primary/20' 
                                  : 'group-hover:scale-105 group-hover:shadow-md'
                              }`}
                              onLoad={() => {
                                setLoadingDemoModelIds((prev) => {
                                  const next = new Set(prev);
                                  next.delete(model.id);
                                  return next;
                                });
                              }}
                              onError={() => {
                                setLoadingDemoModelIds((prev) => {
                                  const next = new Set(prev);
                                  next.delete(model.id);
                                  return next;
                                });
                              }}
                            />
                            {/* Selection indicator */}
                            {selectedPhoto === modelIndex && (
                              <div className="absolute top-1 right-1 w-3 h-3 bg-primary rounded-full border-2 border-white shadow-sm z-30 animate-in zoom-in duration-200"></div>
                            )}
                          </button>
                        );
                      })}
                      </div>
                    </div>
                  </div>
                  )}

                  {/* Change Photo Section - Show consistently before, during, and after generation */}
                  {!viewingPastTryOn && uploadedImage && !showChangePhotoOptions && (
                    <div className="bg-white border border-gray-200 rounded-lg p-3 sm:p-4 shadow-sm">
                      <button
                        onClick={handleChangePhoto}
                        disabled={step !== 'idle' && step !== 'complete'}
                        className="w-full flex items-center gap-2 sm:gap-3 text-left hover:bg-gray-50 rounded-lg p-2 -m-2 transition-colors duration-200 group disabled:opacity-50 disabled:cursor-not-allowed"
                        type="button"
                      >
                        <RefreshCw className="w-4 h-4 sm:w-5 sm:h-5 text-primary flex-shrink-0 group-hover:rotate-180 transition-transform duration-500" />
                        <div className="flex flex-col min-w-0 flex-1">
                          <span className="text-xs sm:text-sm font-semibold text-gray-800 group-hover:text-primary transition-colors">
                            {t('virtualTryOnModal.changePhoto')}
                          </span>
                          <span className="text-[10px] sm:text-xs text-gray-600 mt-0.5">
                            {t('virtualTryOnModal.uploadDifferentPhoto')}
                          </span>
                        </div>
                      </button>
                    </div>
                  )}
                    </>
                  )}
                    </>
                  )}
                </div>

                {/* Right Column - Step 2 */}
                <div className="flex flex-col w-full min-h-0" ref={rightColumnRef}>
                  {/* Step 2 Header */}
                  <div className="flex items-center gap-2 sm:gap-2.5 mb-2 sm:mb-2.5">
                    <div className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center transition-all duration-300 ${
                      (step === 'complete' || generatedImage) && !generatedImageError
                        ? 'bg-primary text-primary-foreground shadow-sm' // Completed - orange background with checkmark (matching reference)
                        : step === 'generating'
                        ? 'bg-primary text-primary-foreground shadow-sm' // Current/Active - primary color (generation started)
                        : 'bg-gray-300 text-gray-500' // Grey until generation starts
                    }`}>
                      {(step === 'complete' || generatedImage) && !generatedImageError ? (
                        <Check size={14} strokeWidth={3} className="sm:w-4 sm:h-4" />
                      ) : (
                        <span className="text-xs sm:text-sm font-semibold">2</span>
                      )}
                    </div>
                    <h2 className={`font-semibold text-sm sm:text-base text-gray-800 transition-colors duration-300 ${
                      ((step === 'complete' || generatedImage) && !generatedImageError) || step === 'generating'
                        ? 'text-gray-900'
                        : 'text-gray-500'
                    }`}>
                      {step === 'generating' ? t('virtualTryOnModal.generating') : t('virtualTryOnModal.yourLook')}
                    </h2>
                  </div>

                  {/* Generation Progress Card */}
                  <div className={`flex-1 rounded-lg relative flex flex-col items-center justify-center overflow-hidden min-h-0 max-h-full ${
                    ((step === 'complete' && generatedImage) || (viewingPastTryOn && generatedImage)) && !generatedImageError
                      ? 'bg-card'
                      : step === 'idle' && uploadedImage && !generatedImage && !error
                      ? 'bg-primary/5 border-2 border-dashed border-primary/20'
                      : 'border-2 border-dashed border-border bg-card'
                  }`}>
                    {step === 'idle' && !uploadedImage && !generatedImage && !error && (
                      <div className="text-center px-4 sm:px-6 py-6 sm:py-8 animate-fade-in flex flex-col items-center justify-center h-full">
                        {/* Eye icon with circular background */}
                        <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full mx-auto mb-3 sm:mb-4 flex items-center justify-center bg-gray-100 relative">
                          <Eye className="w-10 h-10 sm:w-12 sm:h-12 text-gray-400" strokeWidth={2} />
                        </div>
                        {/* Primary message */}
                        <p className="text-gray-600 text-xs sm:text-sm font-medium mb-2 transition-colors duration-200">
                          {t('virtualTryOnModal.resultWillAppear')}
                        </p>
                        {/* Secondary instruction */}
                        <p className="text-gray-500 text-xs sm:text-sm max-w-xs mx-auto leading-relaxed">
                          {t('virtualTryOnModal.uploadPhotoToStart')}
                        </p>
                      </div>
                    )}

                    {step === 'idle' && uploadedImage && !generatedImage && !error && (
                      <div className="text-center px-4 sm:px-6 py-6 sm:py-8 animate-fade-in flex flex-col items-center justify-center h-full">
                        {/* Circular icon with refresh/generate arrows */}
                        <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full mx-auto mb-3 sm:mb-4 flex items-center justify-center bg-primary/10 relative">
                          <RefreshCw className="w-10 h-10 sm:w-12 sm:h-12 text-primary" strokeWidth={2.5} />
                        </div>
                        {/* Primary message */}
                        <p className="text-primary text-xs sm:text-sm font-semibold mb-2 transition-colors duration-200">
                          {t('virtualTryOnModal.readyToGenerate')}
                        </p>
                        {/* Secondary instruction */}
                        <p className="text-primary/80 text-xs sm:text-sm max-w-xs mx-auto leading-relaxed">
                          {selectedClothing ? t('virtualTryOnModal.clickGenerateToCreate') : t('virtualTryOnModal.selectClothingAndGenerate')}
                        </p>
                      </div>
                    )}

                    {/* Only show generating loader when modal is preloaded to avoid duplicate loaders */}
                    {isModalPreloaded && step === 'generating' && progress < 100 && (
                      <div className="text-center w-full px-4 sm:px-6 py-6 animate-fade-in">
                        {/* Continuous Circular Rotation Loader */}
                        <div className="relative w-24 h-24 sm:w-28 sm:h-28 mx-auto mb-4">
                          <svg className="w-full h-full animate-spin" viewBox="0 0 100 100" style={{ animationDuration: '1.4s' }}>
                            {/* Background circle - light gray */}
                            <circle 
                              cx="50" 
                              cy="50" 
                              r="45" 
                              fill="none" 
                              stroke="#e5e7eb" 
                              strokeWidth="8" 
                            />
                            {/* Animated arc - orange with gradient effect */}
                            <circle
                              cx="50"
                              cy="50"
                              r="45"
                              fill="none"
                              stroke="url(#spinner-gradient)"
                              strokeWidth="8"
                              strokeDasharray="70 282"
                              strokeDashoffset="0"
                              strokeLinecap="round"
                              className="origin-center"
                            />
                            {/* Gradient definition for spinner */}
                            <defs>
                              <linearGradient id="spinner-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stopColor="#FF4F00" stopOpacity="1" />
                                <stop offset="100%" stopColor="#FF7F33" stopOpacity="0.3" />
                              </linearGradient>
                            </defs>
                          </svg>
                        </div>
                        
                        {/* Status Text - Below Circular Loader */}
                        <h3 className="text-xs sm:text-sm font-semibold text-gray-800 mb-3">
                          {statusMessage || t('virtualTryOnModal.creatingTryOn')}
                        </h3>
                        
                        {/* Linear Progress Bar - Shows actual progress */}
                        <div className="w-full max-w-xs mx-auto mb-3">
                            <div className="w-full bg-gray-200 rounded-full h-2.5 sm:h-3 overflow-hidden shadow-sm">
                            <div
                              className="bg-primary h-full rounded-full transition-all duration-75 ease-linear shadow-sm"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        </div>
                        
                        {/* Progress Percentage */}
                        <p className="text-xs sm:text-sm font-medium text-primary">
                          {progress}%
                        </p>
                      </div>
                    )}

                    {/* Checkmark removed - go straight to glowing bulbs animation */}

                    {/* Show generated image when: step is complete OR (viewing history AND we have generated image) */}
                    {((step === 'complete' && generatedImage) || (viewingPastTryOn && generatedImage)) && !generatedImageError && (
                      <GlowingBubblesReveal 
                        show={!viewingPastTryOn && step === 'complete'}
                        className="w-full min-h-[400px]"
                      >
                        <div className={`relative w-full min-h-[400px] flex flex-col items-center justify-center p-4 sm:p-5 ${viewingPastTryOn ? 'border-2 border-dashed border-yellow-300 rounded-lg' : 'border-2 border-dashed border-yellow-200 rounded-lg'}`}>
                          {/* Light yellow/orange gradient background matching reference design */}
                          {/* Improved background with better contrast for white border visibility */}
                          <div className="absolute top-0 left-0 right-0 bottom-0 bg-gradient-to-br from-yellow-100/80 via-orange-50/60 to-yellow-50/70 rounded-lg" />
                          
                          {/* Content wrapper for better spacing and alignment */}
                          <div className="relative z-10 flex flex-col items-center justify-center w-full h-auto gap-3">
                            {/* Result Image - revealed by glowing bubbles animation */}
                            <div 
                              ref={generatedImageRef}
                              className="flex items-center justify-center"
                            >
                              {/* Image - Fixed height (400px), auto width, object-contain to prevent cut/stretch and maintain aspect ratio */}
                              {/* CRITICAL: max-w-full ensures image doesn't overflow, w-auto allows natural width based on aspect ratio */}
                              <img
                                src={generatedImage}
                                className="h-[400px] w-auto max-w-full object-contain border-4 border-white rounded-lg shadow-md md:shadow-lg"
                                alt="Try-on result"
                                loading="eager"
                                onError={(e) => {
                                  const imgElement = e.target as HTMLImageElement;
                                  console.error('[VirtualTryOnModal] Failed to load generated image:', imgElement.src);
                                  setGeneratedImageError(true);
                                  setGeneratedImage(null);
                                  setStep('idle');
                                  toast.error('Failed to load try-on result');
                                }}
                                onLoad={() => {
                                  console.log('[VirtualTryOnModal] Generated image loaded successfully');
                                  // Reset error state when image loads successfully
                                  setGeneratedImageError(false);
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      </GlowingBubblesReveal>
                    )}

                    {/* Error State - Show when generated image fails to load (only if we've attempted to generate/load) */}
                    {generatedImageError && (step === 'generating' || step === 'complete' || uploadedImage) && (
                      <div className="relative w-full h-full flex flex-col items-center justify-center p-4 sm:p-6">
                        <div className="text-center px-4 sm:px-6 py-6 sm:py-8 animate-fade-in flex flex-col items-center justify-center h-full">
                          {/* Error icon */}
                          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full mx-auto mb-3 sm:mb-4 flex items-center justify-center bg-red-100 relative">
                            <AlertCircle className="w-10 h-10 sm:w-12 sm:h-12 text-red-600" strokeWidth={2} />
                          </div>
                          {/* Error message */}
                          <p className="text-red-600 text-xs sm:text-sm font-semibold mb-2 transition-colors duration-200">
                            {t('virtualTryOnModal.failedToLoadResult')}
                          </p>
                          {/* Secondary instruction */}
                          <p className="text-gray-600 text-xs sm:text-sm max-w-xs mx-auto leading-relaxed mb-4">
                            {t('virtualTryOnModal.imageCouldNotBeLoaded')}
                          </p>
                          {/* Retry button */}
                          <button
                            onClick={handleReset}
                            className="group relative bg-primary hover:bg-primary-dark text-primary-foreground px-6 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2 transition-all duration-300 ease-in-out shadow-md hover:shadow-lg hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 overflow-hidden"
                            aria-label={t('virtualTryOnModal.tryAgain')}
                            type="button"
                          >
                            <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out bg-gradient-to-r from-transparent via-white/20 to-transparent"></span>
                            <RotateCcw size={16} className="relative z-10 group-hover:rotate-180 transition-transform duration-500 ease-in-out" />
                            <span className="relative z-10">{t('virtualTryOnModal.tryAgain')}</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {error && !generatedImageError && (
                      <div className="w-full h-full flex flex-col items-center justify-center p-6 sm:p-8 text-center" role="alert">
                        <div className="bg-red-50 border-2 border-red-200 rounded-lg p-6 sm:p-8 max-w-md w-full">
                          <div className="flex flex-col items-center gap-4">
                            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-red-100 flex items-center justify-center" aria-hidden="true">
                              <AlertCircle className="w-8 h-8 sm:w-10 sm:h-10 text-red-600" strokeWidth={2} />
                            </div>
                            <div className="space-y-2">
                              <h3 className="text-xs sm:text-sm font-semibold text-red-900">
                                {t('virtualTryOnModal.somethingWentWrong')}
                              </h3>
                              <p className="text-xs sm:text-sm text-red-800 leading-relaxed">
                                {error}
                              </p>
                              <p className="text-xs sm:text-sm text-red-700 mt-2">
                                {t('virtualTryOnModal.tryDifferentPhotoOrCheckConnection')}
                              </p>
                            </div>
                            <button
                              onClick={handleReset}
                              className="group relative mt-2 px-6 py-2.5 sm:px-8 sm:py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm sm:text-base font-medium transition-all duration-300 ease-in-out flex items-center gap-2 shadow-sm hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 hover:scale-105 active:scale-95 overflow-hidden"
                              aria-label={t('virtualTryOnModal.startOver')}
                              type="button"
                            >
                              <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out bg-gradient-to-r from-transparent via-white/20 to-transparent"></span>
                              <RotateCcw size={16} className="relative z-10 group-hover:rotate-180 transition-transform duration-500 ease-in-out" />
                              <span className="relative z-10">{t('virtualTryOnModal.startOver')}</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                </div>

              {/* Bottom Action Section */}
              <div className="border-t border-gray-100 px-4 sm:px-5 md:px-6 py-2 sm:py-2.5">
                {/* Only show size selection if sizes are available and generation is complete */}
                {sizes.length > 0 && (step === 'complete' || generatedImage) && !generatedImageError && (
                  <div ref={sizeSelectionRef} className="flex flex-wrap justify-center items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
                    <span className="text-xs sm:text-sm text-gray-700 mr-0.5 sm:mr-1 self-center">{t('virtualTryOnModal.size')}</span>
                    {sizes.map((size) => {
                      const sizeInfo = sizeAvailability.find(s => s.size === size);
                      const isAvailable = sizeInfo?.isAvailable ?? false;
                      const isSelected = selectedSize === size;
                      const isMobile = isMobileDevice();
                      
                      return (
                        <button
                          key={size}
                            onClick={() => {
                            setSelectedSize(size);
                            // Auto-scroll to button after size selection - ONLY for mobile
                            const currentIsMobile = isMobileDevice();
                            if (currentIsMobile) {
                              requestAnimationFrame(() => {
                                scrollToElement(addToCartButtonRef, 10, 'smooth', 'add-to-cart');
                              });
                            } else {
                              // Desktop: Only focus (no scrolling)
                              requestAnimationFrame(() => {
                                if (addToCartButtonRef.current) {
                                  addToCartButtonRef.current.focus();
                                }
                              });
                            }
                          }}
                          className={`group relative w-9 h-9 sm:w-10 sm:h-10 md:w-11 md:h-11 rounded-lg border text-xs sm:text-sm font-medium transition-all duration-300 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 overflow-hidden ${
                            isSelected
                              ? isAvailable
                                ? 'bg-foreground text-background border-foreground shadow-md md:shadow-lg scale-105'
                                : 'bg-gray-600 text-white border-gray-600 shadow-md md:shadow-lg scale-105'
                              : !isAvailable
                              ? 'bg-white text-gray-500 border-gray-300 shadow-sm hover:border-gray-400 hover:bg-gray-50 hover:shadow-md hover:scale-105 active:scale-95 cursor-pointer'
                              : 'bg-white text-gray-700 border-border hover:border-primary/50 shadow-sm md:shadow-md hover:shadow-md md:hover:shadow-lg hover:scale-110 active:scale-95 hover:bg-primary/5'
                          }`}
                          aria-label={t('virtualTryOnModal.selectSizeLabel', { size }) + (!isAvailable ? t('virtualTryOnModal.outOfStock') : '')}
                          type="button"
                        >
                          {/* Hover shimmer effect for available sizes */}
                          {!isSelected && isAvailable && (
                            <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out bg-gradient-to-r from-transparent via-primary/10 to-transparent"></span>
                          )}
                          {/* Hover effect for out of stock sizes */}
                          {!isSelected && !isAvailable && (
                            <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out bg-gradient-to-r from-transparent via-gray-200/30 to-transparent"></span>
                          )}
                          <span className="relative z-10 flex items-center justify-center h-full">{size}</span>
                          {/* Out of stock indicator */}
                          {!isAvailable && !isSelected && (
                            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 sm:w-2.5 sm:h-2.5 bg-gray-400 rounded-full border border-white"></span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}

                <button
                  ref={step === 'idle' ? generateButtonRef : step === 'complete' ? addToCartButtonRef : undefined}
                  onClick={btnState.action}
                  disabled={btnState.disabled}
                  className={`group relative w-full h-10 sm:h-11 rounded-lg flex items-center justify-center gap-2 font-semibold text-sm sm:text-base transition-all duration-300 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 overflow-hidden ${
                    btnState.disabled
                      ? 'bg-gray-300 cursor-not-allowed text-white shadow-sm'
                      : btnState.color === 'orange'
                      ? 'bg-primary hover:bg-primary/90 active:bg-primary/95 text-primary-foreground shadow-md md:shadow-lg hover:shadow-lg md:hover:shadow-xl hover:scale-[1.01] active:scale-[0.99]'
                      : 'bg-gray-500 hover:bg-gray-600 active:bg-gray-700 text-white shadow-md md:shadow-lg hover:shadow-lg md:hover:shadow-xl hover:scale-[1.01] active:scale-[0.99]'
                  }`}
                  aria-label={btnState.text}
                  type="button"
                >
                  {/* Shimmer effect on hover for enabled buttons */}
                  {!btnState.disabled && (
                    <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out bg-gradient-to-r from-transparent via-white/20 to-transparent"></span>
                  )}
                  {/* Ripple effect on click */}
                  {!btnState.disabled && (
                    <span className="absolute inset-0 rounded-lg opacity-0 group-active:opacity-30 group-active:bg-white transition-opacity duration-200"></span>
                  )}
                  {step === 'generating' ? (
                    <>
                      <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin relative z-10" />
                      <span className="relative z-10">{t('virtualTryOnModal.generatingButton')}</span>
                    </>
                  ) : (
                    <>
                      {btnState.icon && (
                        <span className="relative z-10 transition-transform duration-300 group-hover:scale-110 group-active:scale-95">
                          {btnState.icon}
                        </span>
                      )}
                      <span className="relative z-10 transition-transform duration-300 group-hover:scale-105 group-active:scale-95">
                        {btnState.text}
                      </span>
                    </>
                  )}
                </button>

                {step === 'generating' && (
                  <p className="text-center text-xs text-gray-400 mt-2">
                    {t('virtualTryOnModal.pleaseWaitCreating')}
                  </p>
                )}
                
                {((step === 'complete' && generatedImage) || viewingPastTryOn) && !generatedImageError && (
                  <p className="text-center text-[10px] sm:text-xs text-gray-600 mt-2 px-2">
                    {t('virtualTryOnModal.renderedForAesthetic')}
                  </p>
                )}
              </div>

              {/* History Section */}
              <div className="border-t border-gray-100 px-4 sm:px-5 md:px-6 py-3 sm:py-3.5 min-h-[104px] sm:min-h-[116px] flex flex-col justify-center" style={{ backgroundColor: '#f6f8fa' }}>
                <div className="mb-1 sm:mb-1.5">
                  <h4 className="text-[10px] sm:text-xs font-bold text-gray-500 uppercase tracking-wide">{t('virtualTryOnModal.yourTryOnHistory')}</h4>
                </div>

                <div 
                  className="flex gap-2 sm:gap-3 overflow-x-hidden overflow-y-visible py-1"
                >
                {isLoadingHistory ? (
                  <div className="flex gap-2 sm:gap-3">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="flex-shrink-0 h-14 w-14 rounded-lg border-2 border-transparent bg-gray-50 overflow-hidden" style={{ backgroundColor: '#f6f8fa' }}>
                        <Skeleton className="w-full h-full rounded-lg" />
                      </div>
                    ))}
                  </div>
                ) : historyItems.length > 0 ? (
                  <>
                    {historyItems.map((item) => {
                      const isSelected = selectedHistoryItemId === item.id;
                      const isLoading = loadingHistoryItemIds.has(item.id);
                      return (
                        <button
                          key={item.id}
                          onTouchStart={handleTouchStart}
                          onTouchMove={handleTouchMove}
                          onTouchEnd={(e) => handleTouchEnd(e, () => {
                            handleHistoryItemSelect(item);
                          })}
                          onClick={() => {
                            // Only handle click if not on touch device (touch events handle touch devices)
                            if (!('ontouchstart' in window)) {
                              handleHistoryItemSelect(item);
                            }
                          }}
                          className={`group relative flex-shrink-0 h-14 rounded-lg border-2 transition-all duration-300 ease-in-out flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 overflow-hidden ${
                            isSelected
                              ? 'border-primary ring-2 ring-primary/20 scale-105 shadow-md md:shadow-lg'
                              : 'border-transparent hover:border-primary/30 shadow-sm md:shadow-md hover:shadow-md md:hover:shadow-lg hover:scale-105 active:scale-95'
                          }`}
                          style={{ backgroundColor: '#f6f8fa' }}
                          aria-label={t('virtualTryOnModal.selectTryOnResult', { id: item.id })}
                          type="button"
                        >
                          {/* Hover overlay effect */}
                          {!isSelected && (
                            <div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/5 transition-colors duration-300 rounded-lg z-10 border-4 border-white shadow-md md:shadow-lg"></div>
                          )}
                          {isLoading && (
                            <div className="absolute inset-0 z-20 flex items-center justify-center">
                              <Skeleton className="w-full h-full rounded-lg" />
                            </div>
                          )}
                          <img 
                            src={getProxiedImageUrl(item.image)} 
                            alt={t('virtualTryOnModal.tryOnHistory', { id: item.id })} 
                            className={`h-full w-auto object-contain border-2 border-white rounded-lg shadow-sm md:shadow-md transition-all duration-300 relative z-0 ${
                              isLoading ? 'opacity-0' : 'opacity-100'
                            } ${
                              isSelected 
                                ? 'ring-2 ring-primary/20' 
                                : 'group-hover:scale-105 group-hover:shadow-md'
                            }`}
                            onLoad={() => {
                              setLoadingHistoryItemIds((prev) => {
                                const next = new Set(prev);
                                next.delete(item.id);
                                return next;
                              });
                            }}
                            onError={(e) => {
                              setLoadingHistoryItemIds((prev) => {
                                const next = new Set(prev);
                                next.delete(item.id);
                                return next;
                              });
                              // Fallback to direct URL if proxy fails
                              if ((e.target as HTMLImageElement).src !== item.image) {
                                (e.target as HTMLImageElement).src = item.image;
                              }
                            }}
                          />
                          {/* Selection indicator */}
                          {isSelected && (
                            <div className="absolute top-1 right-1 w-3 h-3 bg-primary rounded-full border-2 border-white shadow-sm z-30 animate-in zoom-in duration-200"></div>
                          )}
                        </button>
                      );
                    })}
                    <button
                      onTouchStart={handleTouchStart}
                      onTouchMove={handleTouchMove}
                      onTouchEnd={(e) => handleTouchEnd(e, () => {
                        triggerPhotoUpload();
                      })}
                      onClick={() => {
                        // Only handle click if not on touch device (touch events handle touch devices)
                        if (!('ontouchstart' in window)) {
                          triggerPhotoUpload();
                        }
                      }}
                      className="group relative flex-shrink-0 h-14 w-14 border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center bg-card hover:bg-primary/5 hover:border-primary transition-all duration-300 ease-in-out cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 shadow-sm md:shadow-md hover:shadow-md md:hover:shadow-lg hover:scale-110 active:scale-95 overflow-hidden"
                      aria-label={t('virtualTryOnModal.uploadNewPhotoForTryOn')}
                      type="button"
                    >
                      {/* Shimmer effect */}
                      <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out bg-gradient-to-r from-transparent via-primary/10 to-transparent"></span>
                      <Upload 
                        size={18} 
                        className="text-muted-foreground group-hover:text-primary relative z-10 transition-all duration-300 group-hover:scale-110" 
                        strokeWidth={2}
                      />
                      <span className="text-[9px] text-muted-foreground group-hover:text-primary font-medium mt-0.5 relative z-10 transition-all duration-300">
                        {t('virtualTryOnModal.new')}
                      </span>
                    </button>
                  </>
                ) : (
                  <div className="flex items-center justify-center w-full py-1.5 sm:py-2">
                    <button
                      onTouchStart={handleTouchStart}
                      onTouchMove={handleTouchMove}
                      onTouchEnd={(e) => handleTouchEnd(e, () => {
                        triggerPhotoUpload();
                      })}
                      onClick={() => {
                        if (!('ontouchstart' in window)) {
                          triggerPhotoUpload();
                        }
                      }}
                      className="group relative flex flex-col items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-border rounded-lg bg-card hover:bg-primary/5 hover:border-primary transition-all duration-300 ease-in-out cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 shadow-sm md:shadow-md hover:shadow-md md:hover:shadow-lg hover:scale-105 active:scale-95 overflow-hidden"
                      aria-label={t('virtualTryOnModal.uploadPhotoToStartTryOnAction')}
                      type="button"
                    >
                      {/* Shimmer effect */}
                      <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out bg-gradient-to-r from-transparent via-primary/10 to-transparent"></span>
                      <Upload 
                        size={20} 
                        className="text-muted-foreground group-hover:text-primary relative z-10 transition-all duration-300 group-hover:scale-110" 
                        strokeWidth={2}
                      />
                      <span className="text-xs text-muted-foreground group-hover:text-primary font-medium relative z-10 transition-all duration-300">
                        {t('virtualTryOnModal.uploadPhotoToStartTryOn')}
                      </span>
                    </button>
                  </div>
                )}
                </div>
              </div>
              </div>
            </div>

          </div>
        </div>
        </>
        )}
      </div>
    </div>
  );
};

export default VirtualTryOnModal;



