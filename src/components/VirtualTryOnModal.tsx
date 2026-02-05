import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { X, Upload, CheckCircle, Check, RotateCcw, ShoppingCart, Bell, Loader2, AlertCircle, Clock, Zap, Eye, RefreshCw, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import TestPhotoUpload from '@/components/TestPhotoUpload';
import TestClothingSelection from '@/components/TestClothingSelection';
import { generateTryOn, dataURLToBlob, fetchUploadedImages, fetchCustomerImageHistory, type ImageGenerationHistoryItem } from '@/services/tryonApi';
import { storage } from '@/utils/storage';
import { detectStoreOrigin, extractProductImages, getStoreOriginFromPostMessage, requestStoreInfoFromParent, extractShopifyProductInfo, type StoreInfo } from '@/utils/shopifyIntegration';
import { DEMO_PHOTO_ID_MAP, DEMO_PHOTOS_ARRAY } from '@/constants/demoPhotos';
import type { ProductImage } from '@/types/tryon';
import { GlowingBubblesReveal } from '@/components/ui/glowing-bubbles-reveal';

interface VirtualTryOnModalProps {
  customerInfo?: {
    id?: string | null;
    email?: string | null;
    firstName?: string | null;
    lastName?: string | null;
  } | null;
}

const VirtualTryOnModal: React.FC<VirtualTryOnModalProps> = ({ customerInfo }) => {
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
  
  // Image states
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
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
  
  // Cart states
  const [isAddToCartLoading, setIsAddToCartLoading] = useState(false);
  const [isBuyNowLoading, setIsBuyNowLoading] = useState(false);
  const [isNotifyMeLoading, setIsNotifyMeLoading] = useState(false);
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
  
  // Recent photos from API (using person images from history)
  const [recentPhotos, setRecentPhotos] = useState<Array<{ id: string; src: string }>>([]);
  const [isLoadingRecentPhotos, setIsLoadingRecentPhotos] = useState(false);

  // Use the same demo photos as TryOnWidget
  const demoModels = DEMO_PHOTOS_ARRAY;

  // History items from API
  const [historyItems, setHistoryItems] = useState<Array<{ 
    id: string; 
    image: string; 
    personImageUrl?: string; 
    clothingImageUrl?: string;
    createdAt?: string;
  }>>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  
  // Viewing past try-on state
  const [viewingPastTryOn, setViewingPastTryOn] = useState(false);
  const [viewingHistoryItem, setViewingHistoryItem] = useState<{
    id: string;
    image: string;
    personImageUrl?: string;
    clothingImageUrl?: string;
    createdAt?: string;
  } | null>(null);

  // Extract sizes from product variants dynamically
  const extractSizesFromProduct = useCallback(() => {
    // Access product data directly from state to avoid circular dependency
    const currentProductData = storedProductData || productData || (() => {
      if (typeof window === 'undefined') return null;
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
  const currentUploadedImageRef = useRef<string | null>(null); // Track current uploaded image before viewing history
  const currentSelectedClothingRef = useRef<string | null>(null); // Track current selected clothing before viewing history
  const rightColumnRef = useRef<HTMLDivElement>(null);
  const clothingSelectionRef = useRef<HTMLDivElement>(null);
  const generateButtonRef = useRef<HTMLButtonElement>(null);
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
    
    // Priority 2: Try direct access from parent window
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
      // Extract from current page
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
  }, [isInIframe, productImages.length, productData]);

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

      // Handle product data messages
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
          const productTitle = currentProductData?.title || currentProductData?.name || 'item';
          const sizeText = selectedSize ? ` (Size ${selectedSize})` : '';
          setToastMessage(`Added ${productTitle}${sizeText} to cart!`);
          setShowToast(true);
          setTimeout(() => setShowToast(false), 3000);
        } else if (event.data.action === 'NUSENSE_BUY_NOW') {
          setIsBuyNowLoading(false);
        } else if (event.data.action === 'NUSENSE_NOTIFY_ME') {
          setIsNotifyMeLoading(false);
          toast.success('You will be notified when this item is back in stock!');
        }
      } else if (event.data && event.data.type === 'NUSENSE_ACTION_ERROR') {
        if (event.data.action === 'NUSENSE_ADD_TO_CART') {
          setIsAddToCartLoading(false);
          toast.error('Failed to add to cart', {
            description: event.data.error || 'Please try again.',
          });
        } else if (event.data.action === 'NUSENSE_BUY_NOW') {
          setIsBuyNowLoading(false);
          toast.error('Failed to proceed to checkout', {
            description: event.data.error || 'Please try again.',
          });
        } else if (event.data.action === 'NUSENSE_NOTIFY_ME') {
          setIsNotifyMeLoading(false);
          toast.error('Failed to register notification', {
            description: event.data.error || 'Please try again.',
          });
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [selectedClothing, storedProductData, getProductData, productData]);

  // Restore saved state from storage (but prioritize fresh product images from parent)
  useEffect(() => {
    const savedImage = storage.getUploadedImage();
    const savedResult = storage.getGeneratedImage();

    // Validate that savedImage is a valid non-empty string and looks like a data URL
    if (savedImage && typeof savedImage === 'string' && savedImage.trim().length > 0 && savedImage.startsWith('data:image/')) {
      setUploadedImage(savedImage);
    }
    // Don't restore savedClothing from storage - always use fresh product images from parent
    // The first product image will be auto-selected when images are received
    if (savedResult) {
      setGeneratedImage(savedResult);
      setStep('complete');
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
    storage.saveUploadedImage(dataURL);
    setError(null);
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
      if (file) {
        const reader = new FileReader();
        reader.onloadend = () => {
          const dataURL = reader.result as string;
          handlePhotoUpload(dataURL, false, undefined);
        };
        reader.readAsDataURL(file);
      }
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
      // Load and set generated image
      if (item.image) {
        try {
          // Check if it's already a data URL
          if (item.image.startsWith('data:image/')) {
            // Already a data URL, use it directly
            setGeneratedImage(item.image);
            storage.saveGeneratedImage(item.image);
            setGeneratedImageError(false);
          } else {
            // It's a regular URL, fetch and convert to data URL
            const proxiedGeneratedUrl = getProxiedImageUrl(item.image);
            const generatedBlob = await fetch(proxiedGeneratedUrl).then(res => {
              if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
              return res.blob();
            });
            
            const generatedReader = new FileReader();
            const generatedDataURL = await new Promise<string>((resolve, reject) => {
              generatedReader.onloadend = () => resolve(generatedReader.result as string);
              generatedReader.onerror = reject;
              generatedReader.readAsDataURL(generatedBlob);
            });
            
            // Validate the generated image data URL before setting
            if (generatedDataURL && typeof generatedDataURL === 'string' && generatedDataURL.trim().length > 0 && generatedDataURL.startsWith('data:image/')) {
              setGeneratedImage(generatedDataURL);
              storage.saveGeneratedImage(generatedDataURL);
              setGeneratedImageError(false);
            } else {
              console.error('[VirtualTryOnModal] Invalid generated image data URL from history:', generatedDataURL);
              setGeneratedImageError(true);
              setGeneratedImage(null);
            }
          }
        } catch (error) {
          console.error('[VirtualTryOnModal] Failed to load generated image from history:', error);
          setGeneratedImageError(true);
          setGeneratedImage(null);
          // Continue loading other images even if generated image fails
        }
      } else {
        console.warn('[VirtualTryOnModal] No generated image URL in history item');
        setGeneratedImage(null);
        setGeneratedImageError(false);
      }
      
      // Load and set user image if available
      if (item.personImageUrl) {
        try {
          const proxiedPersonUrl = getProxiedImageUrl(item.personImageUrl);
          const personBlob = await fetch(proxiedPersonUrl).then(res => {
            if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
            return res.blob();
          });
          
          const personReader = new FileReader();
          const personDataURL = await new Promise<string>((resolve, reject) => {
            personReader.onloadend = () => resolve(personReader.result as string);
            personReader.onerror = reject;
            personReader.readAsDataURL(personBlob);
          });
          
          // Validate that personDataURL is a valid data URL before setting
          if (personDataURL && typeof personDataURL === 'string' && personDataURL.trim().length > 0 && personDataURL.startsWith('data:image/')) {
            setUploadedImage(personDataURL);
            storage.saveUploadedImage(personDataURL);
          } else {
            console.warn('[VirtualTryOnModal] Invalid person image data URL from history');
          }
          setSelectedDemoPhotoUrl(null);
          setPhotoSelectionMethod('file');
        } catch (error) {
          console.warn('[VirtualTryOnModal] Failed to load person image from history:', error);
          // Continue even if person image fails
        }
      }
      
      // Load and set clothing image if available
      if (item.clothingImageUrl) {
        try {
          const proxiedClothingUrl = getProxiedImageUrl(item.clothingImageUrl);
          const clothingBlob = await fetch(proxiedClothingUrl).then(res => {
            if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
            return res.blob();
          });
          
          const clothingReader = new FileReader();
          const clothingDataURL = await new Promise<string>((resolve, reject) => {
            clothingReader.onloadend = () => resolve(clothingReader.result as string);
            clothingReader.onerror = reject;
            clothingReader.readAsDataURL(clothingBlob);
          });
          
          setSelectedClothing(clothingDataURL);
          storage.saveClothingUrl(clothingDataURL);
        } catch (error) {
          console.warn('[VirtualTryOnModal] Failed to load clothing image from history:', error);
          // Continue even if clothing image fails
        }
      }
      
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
      
      // Set viewing past try-on state
      setViewingPastTryOn(true);
      setViewingHistoryItem(item);
      setSelectedHistoryItemId(item.id); // Track selected history item for highlighting
      
      // Set step to 'complete' - the rendering logic will handle error states
      // If generatedImageError is true, the error UI will show instead of the image
      setStep('complete');
      setSelectedSize(null); // Reset size selection when viewing past try-on
    } catch (error) {
      console.error('[VirtualTryOnModal] Failed to load history item:', error);
      toast.error('Failed to load try-on result');
    }
  }, [getProxiedImageUrl]);
  
  // Get formatted time ago string
  const getTimeAgo = useCallback((dateString?: string): string => {
    if (!dateString) return '';
    
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      
      if (diffDays === 0) return 'Today';
      if (diffDays === 1) return '1 day ago';
      if (diffDays < 7) return `${diffDays} days ago`;
      if (diffDays < 14) return '1 week ago';
      if (diffDays < 21) return '2 weeks ago';
      if (diffDays < 30) return '3 weeks ago';
      const diffMonths = Math.floor(diffDays / 30);
      if (diffMonths === 1) return '1 month ago';
      return `${diffMonths} months ago`;
    } catch {
      return '';
    }
  }, []);

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

  // Generate try-on (moved before handleRegeneratePastTryOn to avoid initialization error)
  const handleGenerate = useCallback(async () => {
    if (!uploadedImage || !selectedClothing) {
      setError('Please upload a photo and select clothing');
      toast.error('Missing requirements', {
        description: 'Please upload a photo and select a clothing item.',
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
    setStatusMessage('Preparing your try-on...');
    
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
        }
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
          if (result.image && typeof result.image === 'string' && result.image.trim().length > 0 && result.image.startsWith('data:image/')) {
            setGeneratedImage(result.image);
            storage.saveGeneratedImage(result.image);
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
          console.error('[VirtualTryOnModal] Invalid generated image from API');
          setGeneratedImageError(true);
          setGeneratedImage(null);
          // Don't set general error state - generatedImageError handles this
          toast.error('Failed to generate try-on result');
        }
        
        // When API completes, ensure progress is 100% and show finalizing state
        // Clear any running completion interval and set progress immediately
        if (completionIntervalRef) {
          clearInterval(completionIntervalRef);
        }
        currentProgressRef.current = 100;
        setProgress(100);
        setStatusMessage('Finalizing your try-on...');
        
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
                    .map(({ id, image, personImageUrl, clothingImageUrl }) => ({ 
                      id, 
                      image, 
                      personImageUrl, 
                      clothingImageUrl 
                    }));
                  setHistoryItems(history);
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

      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(errorMessage);
      setStep('idle');
      setProgress(0);
      toast.error('Generation failed', {
        description: errorMessage,
      });
    }
  }, [uploadedImage, selectedClothing, selectedClothingKey, selectedDemoPhotoUrl, storeInfo, customerInfo, storedProductData, getProductData]);

  // Reset complete state when person image changes - works for both mobile and desktop
  useEffect(() => {
    // Skip on initial mount (when prevUploadedImageRef.current is null and uploadedImage is also null)
    if (prevUploadedImageRef.current === null && uploadedImage === null) {
      prevUploadedImageRef.current = uploadedImage;
      return;
    }
    
    // Reset if the image changed (from one image to another, or from image to null, or from null to image)
    if (prevUploadedImageRef.current !== uploadedImage) {
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
  }, [uploadedImage]);

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
        
        // Try to restore images from storage if available
        const storedUploadedImage = storage.getUploadedImage();
        const storedClothingUrl = storage.getClothingUrl();
        if (storedUploadedImage && storedUploadedImage.startsWith('data:image/')) {
          setUploadedImage(storedUploadedImage);
        }
        if (storedClothingUrl && storedClothingUrl.startsWith('data:image/')) {
          setSelectedClothing(storedClothingUrl);
        }
        
        setStep('complete');
      } else {
        // Stored image is the history one, check if we have images ready to generate
        if (uploadedImage && selectedClothing) {
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
          toast.error('Failed to load images for regeneration. Please try again.');
        }
      }, 200);
    } catch (error) {
      console.error('[VirtualTryOnModal] Failed to regenerate past try-on:', error);
      toast.error('Failed to regenerate try-on');
    }
  }, [viewingHistoryItem, uploadedImage, selectedClothing, handleGenerate, getProxiedImageUrl, productImagesWithIds]);

  // Handle add to cart
  const handleAddToCart = useCallback(() => {
    // Only require size selection if sizes are available
    if (sizes.length > 0 && !selectedSize) {
      toast.error('Please select a size');
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
        toast.error('Selected size is not available');
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
        toast.error('Product variant not available');
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
      const productTitle = currentProductData?.title || currentProductData?.name || 'item';
      const sizeText = selectedSize ? ` (Size ${selectedSize})` : '';
      setToastMessage(`Added ${productTitle}${sizeText} to cart!`);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    }
  }, [selectedSize, sizes, productData, cartQuantity, getProductData, sizeAvailability]);

  // Handle buy now
  const handleBuyNow = useCallback(() => {
    // Only require size selection if sizes are available
    if (sizes.length > 0 && !selectedSize) {
      toast.error('Please select a size');
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
  }, [selectedSize, sizes, storedProductData, cartQuantity, getProductData, sizeAvailability]);

  // Handle notify me
  const handleNotifyMe = useCallback(() => {
    // Only require size selection if sizes are available
    if (sizes.length > 0 && !selectedSize) {
      toast.error('Please select a size');
      return;
    }

    setIsNotifyMeLoading(true);
    const isInIframe = window.parent !== window;
    const currentProductData = storedProductData || getProductData();

    // Get variant ID for selected size (if sizes are available)
    let variantId: string | number | null = null;
    if (sizes.length > 0 && selectedSize) {
      const selectedSizeInfo = sizeAvailability.find(s => s.size === selectedSize);
      variantId = selectedSizeInfo?.variantId ?? null;
    }

    // Fallback to default variant if no size selection needed
    if (!variantId) {
      variantId = variantStockInfo?.variantId ?? 
                  (currentProductData as any)?.selectedVariantId ?? 
                  (currentProductData as any)?.variants?.[0]?.id ?? 
                  null;
    }

    if (isInIframe) {
      const message = {
        type: 'NUSENSE_NOTIFY_ME',
        ...(currentProductData && { product: currentProductData }),
        ...(variantId && { variantId: variantId }),
      };
      window.parent.postMessage(message, '*');

      setTimeout(() => {
        setIsNotifyMeLoading(false);
      }, 10000);
    } else {
      setIsNotifyMeLoading(false);
      toast.info('You will be notified when this item is back in stock!');
    }
  }, [selectedSize, sizes, storedProductData, variantStockInfo, getProductData, sizeAvailability]);

  // Handle reset
  const handleReset = useCallback(() => {
    setStep('idle');
    setUploadedImage(null);
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

  // Get button state
  const getButtonState = useCallback(() => {
    if (step === 'idle') {
      const canGenerate = uploadedImage && selectedClothing;
      return {
        text: 'Generate Try-On',
        icon: <Zap size={16} />,
        disabled: !canGenerate,
        action: handleGenerate,
        color: canGenerate ? 'orange' : 'gray',
      };
    }
    if (step === 'generating') {
      return {
        text: 'Generating...',
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
            text: 'Select a Size',
            icon: null,
            disabled: true,
            action: () => {},
            color: 'gray',
          };
        }
        
        // Check if selected size is available
        const selectedSizeInfo = sizeAvailability.find(s => s.size === selectedSize);
        const isSizeAvailable = selectedSizeInfo?.isAvailable ?? false;
        
        if (!isSizeAvailable) {
          return {
            text: 'Notify Me',
            icon: <Bell size={16} />,
            disabled: isNotifyMeLoading,
            action: handleNotifyMe,
            color: 'orange',
          };
        }
      }
      
      // If no sizes available or size is selected and available, show add to cart
      return {
        text: currentCartQuantity > 0 ? `Add to Cart (${currentCartQuantity})` : 'Add to Cart',
        icon: <ShoppingCart size={16} />,
        disabled: isAddToCartLoading || isBuyNowLoading,
        action: handleAddToCart,
        color: 'orange',
      };
    }
    return {
      text: 'Generate',
      icon: null,
      disabled: false,
      action: handleGenerate,
      color: 'gray',
    };
  }, [step, uploadedImage, selectedClothing, progress, selectedSize, sizes, sizeAvailability, isNotifyMeLoading, isAddToCartLoading, isBuyNowLoading, currentCartQuantity, handleGenerate, handleNotifyMe, handleAddToCart]);

  const btnState = getButtonState();

  // Get product info for display
  const currentProductData = getProductData() || productData;
  const productTitle = currentProductData?.title || currentProductData?.name || 'Product';
  
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
        variantInfo.push(`${opt.name}: ${optionValue}`);
      }
    });
    
    return variantInfo.length > 0 ? variantInfo.join(' • ') : null;
  }, [currentProductData]);
  
  const variantInfo = useMemo(() => getVariantInfo(), [getVariantInfo]);

  // Generate stable particle positions for celebration animation
  const celebrationParticles = useMemo(() => {
    return Array.from({ length: 20 }, (_, i) => ({
      id: i,
      width: Math.random() * 25 + 12,
      height: Math.random() * 25 + 12,
      left: Math.random() * 100,
      top: 60 + Math.random() * 30, // Start from middle-bottom area
      animationDelay: Math.random() * 1.5, // Stagger bubbles over 1.5s
      animationDuration: Math.random() * 2 + 3, // 3-5 seconds duration
    }));
  }, []);

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

  return (
    <div className="w-full h-screen bg-white font-sans relative overflow-hidden">
      {/* Skip to main content link for keyboard navigation */}
      <a
        href="#main-content"
        className="sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:w-auto focus:h-auto focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-lg focus:font-medium focus:shadow-lg focus:m-0"
      >
        Skip to main content
      </a>

      {/* ARIA Live Region for Status Updates */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        role="status"
      >
        {statusMessage || (step === 'idle' ? 'Ready to generate try-on' : step === 'generating' ? `Generating try-on: ${progress}% complete` : '')}
      </div>

      {/* ARIA Live Region for Errors */}
      {error && !generatedImageError && (
        <div
          aria-live="assertive"
          aria-atomic="true"
          className="sr-only"
          role="alert"
        >
          Error: {error}
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
          Error: Failed to load try-on result. Please try generating again.
        </div>
      )}

      {/* Modal container */}
      <div className="fixed inset-0 z-50 bg-white flex items-stretch justify-center">
        <div className="bg-white w-full max-w-[1200px] md:max-w-[1400px] h-full flex flex-col overflow-hidden relative shadow-xl md:shadow-2xl rounded-lg" role="dialog" aria-modal="true" aria-labelledby="modal-title">
          {showToast && (
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-gray-800 text-white px-4 sm:px-6 py-3 sm:py-4 rounded-lg shadow-lg md:shadow-xl z-50 flex items-center gap-2 sm:gap-3 animate-fade-in-up max-w-[90%] sm:max-w-none">
              <CheckCircle className="text-green-400 w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
              <span className="text-xs sm:text-sm">{toastMessage}</span>
              <button
                onClick={() => setShowToast(false)}
                className="ml-2 sm:ml-4 text-gray-400 hover:text-white underline text-xs sm:text-sm flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-gray-800 rounded-lg"
                aria-label="Close notification"
                type="button"
              >
                Close
              </button>
            </div>
          )}

          <div className="flex justify-between items-center px-4 sm:px-5 md:px-6 py-2.5 sm:py-3 border-b border-gray-100">
            <div className="flex items-center gap-2 sm:gap-3">
              <img
                src="/assets/NUSENSE_LOGO.svg"
                alt="NUSENSE"
                className="h-4 sm:h-5 w-auto flex-shrink-0"
                aria-label="NUSENSE Logo"
              />
              <span className="font-normal text-gray-700 text-xs sm:text-sm flex items-center" id="modal-title">Virtual Try-On</span>
            </div>

            <button
              onClick={handleClose}
              className="group flex items-center justify-center w-8 h-8 min-w-8 hover:bg-gray-100 rounded-full transition-all duration-300 ease-in-out flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 hover:scale-110 active:scale-95"
              aria-label="Close modal"
              type="button"
            >
              <X className="text-muted-foreground group-hover:text-foreground transition-all duration-300 group-hover:rotate-90" size={20} />
            </button>
          </div>

          {/* Viewing Past Try-On Banner */}
          {viewingPastTryOn && viewingHistoryItem && (
            <div className="w-full px-4 sm:px-5 md:px-6 py-2 sm:py-2.5 border-b border-yellow-200 bg-yellow-50">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div className="flex items-center gap-2 text-sm sm:text-base">
                  <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-700 flex-shrink-0" />
                  <span className="font-medium text-yellow-900">Viewing past try-on</span>
                  <span className="text-yellow-700">{getTimeAgo(viewingHistoryItem.createdAt)}</span>
                </div>
                <div className="flex gap-2 sm:gap-3 md:flex-shrink-0">
                  <button
                    onClick={handleRegeneratePastTryOn}
                    className="group relative px-4 py-2 bg-yellow-100 hover:bg-yellow-200 text-yellow-900 rounded-lg text-sm font-medium transition-all duration-300 ease-in-out border border-yellow-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-500 focus-visible:ring-offset-2 hover:scale-105 active:scale-95 hover:shadow-md overflow-hidden"
                    type="button"
                  >
                    <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out bg-gradient-to-r from-transparent via-yellow-300/20 to-transparent"></span>
                    <span className="relative z-10">Regenerate</span>
                  </button>
                  <button
                    onClick={handleBackToCurrent}
                    className="group relative px-4 py-2 bg-primary hover:bg-primary-dark text-primary-foreground rounded-lg text-sm font-medium transition-all duration-300 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 hover:scale-105 active:scale-95 hover:shadow-md overflow-hidden"
                    type="button"
                  >
                    <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out bg-gradient-to-r from-transparent via-white/20 to-transparent"></span>
                    <span className="relative z-10">Back to current</span>
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
              <div className="flex items-center gap-2 sm:gap-3 bg-gradient-to-r from-gray-50 to-gray-50/80 px-1.5 sm:px-2 py-1.5 sm:py-2 rounded-lg border border-gray-100 shadow-sm">
                <div className="relative flex-shrink-0">
                  <img
                    key={selectedClothing || productImage} // Force re-render when selectedClothing changes
                    src={selectedClothing || productImage || ''}
                    alt={productTitle}
                    className="h-12 sm:h-14 md:h-16 w-auto object-contain border-2 border-white rounded-lg shadow-sm md:shadow-md"
                    loading="lazy"
                    onError={(e) => {
                      // Fallback to first product image if selected clothing fails to load
                      if (productImages[0] && (e.target as HTMLImageElement).src !== productImages[0]) {
                        (e.target as HTMLImageElement).src = productImages[0];
                      }
                    }}
                  />
                </div>
                <div className="flex flex-col min-w-0 flex-1">
                  <div className="text-[9px] sm:text-[10px] text-muted-foreground uppercase tracking-wide font-medium whitespace-nowrap mb-0.5 sm:mb-1 transition-colors duration-200">
                    {viewingPastTryOn ? 'PREVIOUSLY TRIED ON' : "YOU'RE TRYING ON"}
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
                {/* Left Column - Step 1 */}
                <div className="flex flex-col w-full h-full">
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
                    }`}>Choose your photo</h2>
                  </div>
                  {/* Photo Upload Card */}
                  <div ref={photoUploadRef} className="bg-primary/5 border-2 border-dashed border-primary/20 rounded-lg p-2 sm:p-2.5 flex flex-col items-center text-center mb-2">
                    {!uploadedImage && (
                      <>
                        <h3 className="text-[10px] sm:text-xs font-semibold text-primary mb-1.5 uppercase tracking-wide">For best results</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs text-gray-600 mb-2 w-full">
                          <span className="flex items-center gap-1.5 justify-start">
                            <Check size={14} className="text-green-500 flex-shrink-0" strokeWidth={3} /> Front-facing pose
                          </span>
                          <span className="flex items-center gap-1.5 justify-start">
                            <Check size={14} className="text-green-500 flex-shrink-0" strokeWidth={3} /> Arms visible
                          </span>
                          <span className="flex items-center gap-1.5 justify-start">
                            <Check size={14} className="text-green-500 flex-shrink-0" strokeWidth={3} /> Good lighting
                          </span>
                          <span className="flex items-center gap-1.5 justify-start">
                            <Check size={14} className="text-green-500 flex-shrink-0" strokeWidth={3} /> Plain background
                          </span>
                        </div>
                      </>
                    )}
                    {uploadedImage ? (
                      <div className="w-full flex flex-col items-center relative">
                        {/* Action buttons - positioned outside image container, top-right */}
                        <div className="absolute top-0 right-0 flex items-center gap-1.5 z-10 -translate-y-1 translate-x-1">
                          <button
                            onClick={triggerPhotoUpload}
                            className="group flex items-center justify-center h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-white hover:bg-white text-gray-600 hover:text-gray-800 border border-gray-200 hover:border-gray-300 shadow-md hover:shadow-lg backdrop-blur-sm transition-all duration-200 ease-in-out hover:scale-110 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
                            aria-label="Edit photo"
                            type="button"
                          >
                            <Pencil size={12} strokeWidth={2.5} className="sm:w-[14px] sm:h-[14px] transition-transform duration-200 group-hover:scale-110" />
                          </button>
                          <button
                            onClick={() => {
                              setUploadedImage(null);
                              setSelectedPhoto(null);
                              storage.saveUploadedImage(null);
                            }}
                            className="group flex items-center justify-center h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-white hover:bg-red-50 text-gray-600 hover:text-red-600 border border-gray-200 hover:border-red-300 shadow-md hover:shadow-lg backdrop-blur-sm transition-all duration-200 ease-in-out hover:scale-110 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
                            aria-label="Delete photo"
                            type="button"
                          >
                            <Trash2 size={12} strokeWidth={2.5} className="sm:w-[14px] sm:h-[14px] transition-transform duration-200 group-hover:scale-110" />
                          </button>
                        </div>
                        <div className="relative group/image-container inline-block mt-2">
                          <img
                            src={uploadedImage}
                            alt="Uploaded photo"
                            className="max-w-full max-h-[180px] sm:max-h-[200px] object-contain rounded-lg border-2 border-white shadow-md md:shadow-lg"
                            onError={(e) => {
                              // If image fails to load, clear it and show upload button instead
                              console.warn('[VirtualTryOnModal] Failed to load uploaded image, clearing it');
                              setUploadedImage(null);
                              setSelectedPhoto(null);
                              storage.saveUploadedImage(null);
                            }}
                          />
                        </div>
                      </div>
                    ) : (
                      <button
                        className="group relative bg-primary hover:bg-primary-dark text-primary-foreground px-6 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2 transition-all duration-300 ease-in-out w-full justify-center shadow-md md:shadow-lg hover:shadow-lg md:hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 overflow-hidden"
                        aria-label="Upload photo"
                        type="button"
                        onClick={triggerPhotoUpload}
                      >
                        {/* Shimmer effect on hover */}
                        <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out bg-gradient-to-r from-transparent via-white/20 to-transparent"></span>
                        <Upload size={16} className="relative z-10 transition-transform duration-300 group-hover:scale-110" /> 
                        <span className="relative z-10">Upload Photo</span>
                      </button>
                    )}
                  </div>

                  {/* Recent Photos Section */}
                  <div className="mb-2">
                    <div className="bg-white border border-gray-200 rounded-lg p-1.5 sm:p-2 shadow-sm">
                      <label className="text-xs sm:text-sm font-semibold text-gray-800 mb-1.5 sm:mb-2 block">Recent photos</label>
                      <div 
                        className="flex gap-2 sm:gap-3 overflow-x-hidden overflow-y-hidden" 
                      >
                      {isLoadingRecentPhotos ? (
                        <div className="flex gap-3">
                          {[1, 2, 3].map((i) => (
                            <div key={i} className="flex-shrink-0 h-14 w-14 rounded-lg bg-gray-200 animate-pulse" />
                          ))}
                        </div>
                      ) : recentPhotos.length > 0 ? (
                        recentPhotos.map((photo) => (
                          <button
                            key={photo.id}
                            onTouchStart={handleTouchStart}
                            onTouchMove={handleTouchMove}
                            onTouchEnd={(e) => handleTouchEnd(e, () => {
                              setSelectedPhoto(photo.id);
                              // Load the photo and set it as uploaded
                              const proxiedUrl = getProxiedImageUrl(photo.src);
                              fetch(proxiedUrl)
                                .then(res => {
                                  if (!res.ok) {
                                    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
                                  }
                                  return res.blob();
                                })
                                .then(blob => {
                                  const reader = new FileReader();
                                  reader.onloadend = () => {
                                    const dataURL = reader.result as string;
                                    handlePhotoUpload(dataURL, false, undefined, photo.id);
                                    // Auto-scroll removed - no scrolling on image selection
                                  };
                                  reader.readAsDataURL(blob);
                                })
                                .catch((error) => {
                                  console.error('[VirtualTryOnModal] Failed to load recent photo:', error);
                                  toast.error('Failed to load photo');
                                });
                            })}
                            onClick={() => {
                              // Only handle click if not on touch device (touch events handle touch devices)
                              if (!('ontouchstart' in window)) {
                                setSelectedPhoto(photo.id);
                                // Load the photo and set it as uploaded
                                const proxiedUrl = getProxiedImageUrl(photo.src);
                                fetch(proxiedUrl)
                                  .then(res => {
                                    if (!res.ok) {
                                      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
                                    }
                                    return res.blob();
                                  })
                                  .then(blob => {
                                    const reader = new FileReader();
                                    reader.onloadend = () => {
                                      const dataURL = reader.result as string;
                                      handlePhotoUpload(dataURL, false, undefined, photo.id);
                                      // Auto-scroll removed - no scrolling on image selection
                                    };
                                    reader.readAsDataURL(blob);
                                  })
                                  .catch((error) => {
                                    console.error('[VirtualTryOnModal] Failed to load recent photo:', error);
                                    toast.error('Failed to load photo');
                                  });
                              }
                            }}
                            className={`group relative flex-shrink-0 h-14 rounded-lg border-2 transition-all duration-300 ease-in-out flex items-center justify-center bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 overflow-hidden ${
                              selectedPhoto === photo.id
                                ? 'border-primary ring-2 ring-primary/20 scale-105 shadow-md md:shadow-lg'
                                : 'border-transparent hover:border-primary/30 shadow-sm md:shadow-md hover:shadow-md md:hover:shadow-lg hover:scale-105 active:scale-95'
                            }`}
                            aria-label={`Select photo ${photo.id}`}
                            type="button"
                          >
                            {/* Hover overlay effect */}
                            {selectedPhoto !== photo.id && (
                              <div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/5 transition-colors duration-300 rounded-lg z-10"></div>
                            )}
                            <img 
                              src={getProxiedImageUrl(photo.src)} 
                              alt="User" 
                              className={`h-full w-auto object-contain border-2 border-white rounded-lg shadow-sm transition-all duration-300 relative z-0 ${
                                selectedPhoto === photo.id 
                                  ? 'ring-2 ring-primary/20' 
                                  : 'group-hover:scale-105 group-hover:shadow-md'
                              }`}
                              onError={(e) => {
                                // Fallback to direct URL if proxy fails
                                if ((e.target as HTMLImageElement).src !== photo.src) {
                                  (e.target as HTMLImageElement).src = photo.src;
                                }
                              }}
                            />
                            {/* Selection indicator */}
                            {selectedPhoto === photo.id && (
                              <div className="absolute top-1 right-1 w-3 h-3 bg-primary rounded-full border-2 border-white shadow-sm z-20 animate-in zoom-in duration-200"></div>
                            )}
                          </button>
                        ))
                      ) : (
                        <div className="text-xs text-gray-500">No recent photos</div>
                      )}
                      </div>
                    </div>
                  </div>

                  {/* Use a Demo Model Section */}
                  <div>
                    <div className="bg-white border border-gray-200 rounded-lg p-1.5 sm:p-2 shadow-sm">
                      <label className="text-xs sm:text-sm font-semibold text-gray-800 mb-1.5 sm:mb-2 block">Use a demo model</label>
                      <div 
                        className="flex gap-2 sm:gap-3 overflow-x-hidden overflow-y-hidden" 
                      >
                      {demoModels.map((model) => {
                        // Use a unique identifier for selection tracking
                        const modelIndex = DEMO_PHOTOS_ARRAY.findIndex(p => p.url === model.url);
                        return (
                          <button
                            key={model.id}
                            onTouchStart={handleTouchStart}
                            onTouchMove={handleTouchMove}
                            onTouchEnd={(e) => handleTouchEnd(e, () => {
                              setSelectedPhoto(modelIndex);
                              // Load the demo model and set it as uploaded
                              fetch(model.url)
                                .then(res => res.blob())
                                .then(blob => {
                                  const reader = new FileReader();
                                  reader.onloadend = () => {
                                    const dataURL = reader.result as string;
                                    handlePhotoUpload(dataURL, true, model.url, modelIndex);
                                    // Auto-scroll removed - no scrolling on image selection
                                  };
                                  reader.readAsDataURL(blob);
                                })
                                .catch(() => {
                                  toast.error('Failed to load demo model');
                                });
                            })}
                            onClick={() => {
                              // Only handle click if not on touch device (touch events handle touch devices)
                              if (!('ontouchstart' in window)) {
                                setSelectedPhoto(modelIndex);
                                // Load the demo model and set it as uploaded
                                fetch(model.url)
                                  .then(res => res.blob())
                                  .then(blob => {
                                    const reader = new FileReader();
                                    reader.onloadend = () => {
                                      const dataURL = reader.result as string;
                                      handlePhotoUpload(dataURL, true, model.url, modelIndex);
                                    // Auto-scroll removed - no scrolling on image selection
                                    };
                                    reader.readAsDataURL(blob);
                                  })
                                  .catch(() => {
                                    toast.error('Failed to load demo model');
                                  });
                              }
                            }}
                            className={`group relative flex-shrink-0 h-14 rounded-lg border-2 transition-all duration-300 ease-in-out flex items-center justify-center bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 overflow-hidden ${
                              selectedPhoto === modelIndex
                                ? 'border-primary ring-2 ring-primary/20 scale-105 shadow-md md:shadow-lg'
                                : 'border-transparent hover:border-primary/30 shadow-sm md:shadow-md hover:shadow-md md:hover:shadow-lg hover:scale-105 active:scale-95'
                            }`}
                            aria-label={`Select demo model ${model.id}`}
                            type="button"
                          >
                            {/* Hover overlay effect */}
                            {selectedPhoto !== modelIndex && (
                              <div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/5 transition-colors duration-300 rounded-lg z-10"></div>
                            )}
                            <img 
                              src={model.url} 
                              alt={`Demo model ${model.id}`} 
                              className={`h-full w-auto object-contain border-2 border-white rounded-lg shadow-sm transition-all duration-300 relative z-0 ${
                                selectedPhoto === modelIndex 
                                  ? 'ring-2 ring-primary/20' 
                                  : 'group-hover:scale-105 group-hover:shadow-md'
                              }`} 
                            />
                            {/* Selection indicator */}
                            {selectedPhoto === modelIndex && (
                              <div className="absolute top-1 right-1 w-3 h-3 bg-primary rounded-full border-2 border-white shadow-sm z-20 animate-in zoom-in duration-200"></div>
                            )}
                          </button>
                        );
                      })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column - Step 2 */}
                  <div className="flex flex-col w-full h-full" ref={rightColumnRef}>
                  {/* Step 2 Header */}
                  <div className="flex items-center gap-2 sm:gap-2.5 mb-2 sm:mb-2.5">
                    <div className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center transition-all duration-300 ${
                      (step === 'complete' || generatedImage) && !generatedImageError
                        ? 'bg-green-500 text-white shadow-sm' // Completed - green background with checkmark
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
                      {step === 'generating' ? 'Generating...' : (step === 'complete' || generatedImage) && !generatedImageError ? 'Your Look' : 'Your Look'}
                    </h2>
                  </div>

                  {/* Generation Progress Card */}
                  <div className={`flex-1 rounded-lg border-2 border-dashed relative flex items-center justify-center overflow-hidden h-full ${
                    step === 'idle' && uploadedImage && !generatedImage && !error
                      ? 'bg-primary/5 border-primary/20'
                      : 'border-border bg-card'
                  }`}>
                    {step === 'idle' && !uploadedImage && !generatedImage && !error && (
                      <div className="text-center px-4 sm:px-6 py-6 sm:py-8 animate-fade-in flex flex-col items-center justify-center h-full">
                        {/* Eye icon with circular background */}
                        <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full mx-auto mb-3 sm:mb-4 flex items-center justify-center bg-gray-100 relative">
                          <Eye className="w-10 h-10 sm:w-12 sm:h-12 text-gray-400" strokeWidth={2} />
                        </div>
                        {/* Primary message */}
                        <p className="text-gray-600 text-xs sm:text-sm font-medium mb-2 transition-colors duration-200">
                          Your result will appear here
                        </p>
                        {/* Secondary instruction */}
                        <p className="text-gray-500 text-xs sm:text-sm max-w-xs mx-auto leading-relaxed">
                          Upload a photo to get started
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
                          Ready to generate
                        </p>
                        {/* Secondary instruction */}
                        <p className="text-primary/80 text-xs sm:text-sm max-w-xs mx-auto leading-relaxed">
                          Click the button below
                        </p>
                      </div>
                    )}

                    {step === 'generating' && progress < 100 && (
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
                          {statusMessage || 'Creating your try-on...'}
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

                    {step === 'generating' && progress === 100 && (
                      <div className="text-center w-full px-4 sm:px-6 py-6 animate-fade-in">
                        {/* Checkmark Animation - Success indicator */}
                        <div className="relative w-24 h-24 sm:w-28 sm:h-28 mx-auto mb-6 flex items-center justify-center">
                          {/* Completed circle background */}
                          <div className="absolute inset-0 rounded-full bg-primary/10 flex items-center justify-center animate-scale-in">
                            <div className="w-full h-full rounded-full border-4 border-primary"></div>
                          </div>
                          {/* Checkmark icon - appears after circle */}
                          <CheckCircle 
                            size={56} 
                            className="text-primary relative z-10 animate-scale-in-delayed"
                            strokeWidth={2.5}
                            fill="currentColor"
                          />
                        </div>
                        
                        {/* Status Text - Finalizing */}
                        <h3 className="text-xs sm:text-sm font-semibold text-gray-800 mb-4">
                          {statusMessage || 'Finalizing your try-on...'}
                        </h3>
                        
                        {/* Progress Bar - Full */}
                        <div className="w-full max-w-xs mx-auto mb-2">
                          <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                            <div
                              className="bg-primary h-2.5 rounded-full transition-all duration-300 ease-out"
                              style={{ width: '100%' }}
                            />
                          </div>
                        </div>
                        
                        {/* Percentage - 100% */}
                        <p className="text-xs sm:text-sm font-semibold text-gray-700">100%</p>
                      </div>
                    )}

                    {step === 'complete' && generatedImage && !generatedImageError && (
                      <div className={`relative w-full h-full flex flex-col items-center justify-center p-4 sm:p-6 overflow-auto ${viewingPastTryOn ? 'border-2 border-dashed border-yellow-400 rounded-lg' : ''}`}>
                        {/* Background gradient matching screenshots - light yellow/orange to white */}
                        <div className="absolute inset-0 bg-gradient-to-br from-yellow-50/60 via-orange-50/40 to-white rounded-lg" />
                        
                        {/* Celebration Bubbles - Real transparent bubbles with borders and highlights (only show for new generations, not past try-ons) */}
                        {!viewingPastTryOn && (
                          <div className="absolute inset-0 overflow-hidden pointer-events-none">
                            {celebrationParticles.map((particle) => (
                              <div
                                key={particle.id}
                                className="absolute rounded-full"
                                style={{
                                  width: `${particle.width}px`,
                                  height: `${particle.height}px`,
                                  left: `${particle.left}%`,
                                  top: `${particle.top}%`,
                                  animation: `bubbleFloatUp ${particle.animationDuration}s ease-out ${particle.animationDelay + 0.5}s forwards`,
                                  opacity: 0,
                                  // Real bubble effect: transparent background with border
                                  background: `radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.8) 0%, rgba(255, 255, 255, 0.4) 20%, hsl(var(--primary) / 0.1) 40%, transparent 70%)`,
                                  border: `2px solid rgba(255, 255, 255, 0.6)`,
                                  boxShadow: `
                                    inset -10px -10px 20px rgba(255, 255, 255, 0.5),
                                    inset 10px 10px 20px hsl(var(--primary) / 0.1),
                                    0 0 15px rgba(255, 255, 255, 0.3),
                                    0 0 30px hsl(var(--primary) / 0.2)
                                  `,
                                  backdropFilter: 'blur(1px)',
                                  filter: 'blur(0.5px)',
                                }}
                              >
                                {/* Bubble highlight/reflection */}
                                <div
                                  className="absolute rounded-full"
                                  style={{
                                    width: '35%',
                                    height: '35%',
                                    top: '15%',
                                    left: '15%',
                                    background: 'radial-gradient(circle, rgba(255, 255, 255, 0.9) 0%, rgba(255, 255, 255, 0.3) 50%, transparent 100%)',
                                    borderRadius: '50%',
                                    animation: `bubbleShimmer ${particle.animationDuration * 0.8}s ease-in-out ${particle.animationDelay + 0.5}s infinite`,
                                  }}
                                />
                              </div>
                            ))}
                          </div>
                        )}
                        

                        {/* Result Image - Glowing bubbles reveal animation */}
                        <div 
                          ref={generatedImageRef}
                          className="relative z-10 w-full max-w-xs sm:max-w-sm md:max-w-md mb-4"
                        >
                          <GlowingBubblesReveal
                            show={!viewingPastTryOn}
                            className="p-4 sm:p-6"
                          >
                            <div className="relative rounded-lg overflow-hidden shadow-xl md:shadow-2xl bg-white/90 backdrop-blur-sm border-2 border-white/50">
                              {/* Image reveals FROM the glowing bubbles - fades in as bubbles expand */}
                              <img
                                src={generatedImage}
                                className="w-full h-auto object-contain rounded-lg relative z-10"
                                alt="Try-on result"
                                loading="eager"
                                onError={(e) => {
                                  console.error('[VirtualTryOnModal] Failed to load generated image:', generatedImage);
                                  setGeneratedImageError(true);
                                  setGeneratedImage(null);
                                  setStep('idle');
                                  // Don't set general error state - generatedImageError handles this
                                  toast.error('Failed to load try-on result');
                                }}
                                onLoad={() => {
                                  // Reset error state when image loads successfully
                                  setGeneratedImageError(false);
                                }}
                              />
                            </div>
                          </GlowingBubblesReveal>
                        </div>

                        {/* Past try-on timestamp */}
                        {viewingPastTryOn && viewingHistoryItem && (
                          <div className="relative z-10 flex items-center gap-2 text-sm text-primary mb-2">
                            <Clock className="w-4 h-4" />
                            <span>From {getTimeAgo(viewingHistoryItem.createdAt)}</span>
                          </div>
                        )}

                        {/* Helper Text - Fades in after image */}
                        <div className="relative z-10" style={viewingPastTryOn ? {} : { animation: 'fadeInSlow 1s ease-out 1.8s forwards', opacity: 0 }}>
                          <p className="text-xs sm:text-sm text-gray-700 font-medium text-center px-4">
                            {viewingPastTryOn ? 'Select a size to add to cart' : 'Select your size below'}
                          </p>
                        </div>

                        {/* Try Again Button - Fades in last (only for new generations) */}
                        {!viewingPastTryOn && (
                          <button
                            onClick={handleReset}
                            className="group relative z-10 mt-4 text-xs text-muted-foreground hover:text-foreground transition-all duration-300 ease-in-out flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 hover:scale-105 active:scale-95 px-2 py-1 hover:bg-primary/5 rounded-lg"
                            aria-label="Try again"
                            type="button"
                            style={{ animation: 'fadeInSlow 0.8s ease-out 2s forwards', opacity: 0 }}
                          >
                            <RotateCcw size={12} className="group-hover:rotate-180 transition-transform duration-500 ease-in-out" />
                            <span className="relative z-10">Not perfect? Try again</span>
                          </button>
                        )}
                      </div>
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
                            Failed to load try-on result
                          </p>
                          {/* Secondary instruction */}
                          <p className="text-gray-600 text-xs sm:text-sm max-w-xs mx-auto leading-relaxed mb-4">
                            The image could not be loaded. Please try generating again.
                          </p>
                          {/* Retry button */}
                          <button
                            onClick={handleReset}
                            className="group relative bg-primary hover:bg-primary-dark text-primary-foreground px-6 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2 transition-all duration-300 ease-in-out shadow-md hover:shadow-lg hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 overflow-hidden"
                            aria-label="Try again"
                            type="button"
                          >
                            <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out bg-gradient-to-r from-transparent via-white/20 to-transparent"></span>
                            <RotateCcw size={16} className="relative z-10 group-hover:rotate-180 transition-transform duration-500 ease-in-out" />
                            <span className="relative z-10">Try Again</span>
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
                                Oops! Something went wrong
                              </h3>
                              <p className="text-xs sm:text-sm text-red-800 leading-relaxed">
                                {error}
                              </p>
                              <p className="text-xs sm:text-sm text-red-700 mt-2">
                                Please try uploading a different photo or check your internet connection.
                              </p>
                            </div>
                            <button
                              onClick={handleReset}
                              className="group relative mt-2 px-6 py-2.5 sm:px-8 sm:py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm sm:text-base font-medium transition-all duration-300 ease-in-out flex items-center gap-2 shadow-sm hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 hover:scale-105 active:scale-95 overflow-hidden"
                              aria-label="Start over and try again"
                              type="button"
                            >
                              <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out bg-gradient-to-r from-transparent via-white/20 to-transparent"></span>
                              <RotateCcw size={16} className="relative z-10 group-hover:rotate-180 transition-transform duration-500 ease-in-out" />
                              <span className="relative z-10">Start over</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              </div>

                {/* Bottom Action Section */}
              <div className="border-t border-gray-100 px-4 sm:px-5 md:px-6 py-2 sm:py-2.5">
                {/* Only show size selection if sizes are available and generation is complete */}
                {sizes.length > 0 && (step === 'complete' || generatedImage) && !generatedImageError && (
                  <div ref={sizeSelectionRef} className="flex flex-wrap justify-center items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
                    <span className="text-xs sm:text-sm text-gray-700 mr-0.5 sm:mr-1 self-center">Size:</span>
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
                          aria-label={`Select size ${size}${!isAvailable ? ' (out of stock)' : ''}`}
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
                    {(() => {
                      const availableSizes = sizeAvailability.filter(s => s.isAvailable).map(s => s.size);
                      const outOfStockSizes = sizeAvailability.filter(s => !s.isAvailable).map(s => s.size);
                      
                      if (availableSizes.length > 0 && outOfStockSizes.length > 0) {
                        return (
                          <span className="text-[10px] sm:text-xs text-gray-400 ml-1 sm:ml-2">
                            Available: {availableSizes.join(', ')} | Out of stock: {outOfStockSizes.join(', ')}
                          </span>
                        );
                      } else if (availableSizes.length > 0) {
                        return (
                          <span className="text-[10px] sm:text-xs text-gray-400 ml-1 sm:ml-2">
                            Available in {availableSizes.join(', ')}
                          </span>
                        );
                      }
                      return null;
                    })()}
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
                      <span className="relative z-10">Generating...</span>
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
                    Please wait while we create your try-on.
                  </p>
                )}
                
                {step !== 'generating' && step === 'complete' && (
                  <p className="text-center text-[10px] sm:text-xs text-gray-600 mt-2 px-2">
                    Rendered for aesthetic purposes. Does not reflect actual dimensions.
                  </p>
                )}

                {step !== 'generating' && step !== 'complete' && (
                  <p className="text-center text-[10px] text-gray-600 mt-2 px-2">
                    Rendered for aesthetic purposes. Does not reflect actual dimensions.
                  </p>
                )}
              </div>

              {/* History Section */}
              <div className="bg-white border-t border-gray-100 px-4 sm:px-5 md:px-6 py-2 sm:py-2.5 min-h-[80px] sm:min-h-[90px] flex flex-col justify-center">
                <div className="flex justify-between items-center mb-1 sm:mb-1.5">
                  <h4 className="text-[10px] sm:text-xs font-bold text-gray-500 uppercase tracking-wide">Your try-on history</h4>
                  <button className="group text-[10px] sm:text-xs text-primary font-medium hover:underline transition-all duration-300 hover:scale-105 active:scale-95" type="button">
                    <span className="relative">
                      View all
                      <span className="absolute bottom-0 left-0 w-0 h-[1.5px] bg-primary group-hover:w-full transition-all duration-300"></span>
                    </span>
                  </button>
                </div>

                <div 
                  className="flex gap-2 sm:gap-3 overflow-x-hidden overflow-y-hidden"
                >
                {isLoadingHistory ? (
                  <div className="flex gap-3">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="flex-shrink-0 h-14 w-14 rounded-lg bg-gray-200 animate-pulse" />
                    ))}
                  </div>
                ) : historyItems.length > 0 ? (
                  <>
                    {historyItems.map((item) => {
                      const isSelected = selectedHistoryItemId === item.id;
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
                          className={`group relative flex-shrink-0 h-14 rounded-lg border-2 transition-all duration-300 ease-in-out flex items-center justify-center bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 overflow-hidden ${
                            isSelected
                              ? 'border-primary ring-2 ring-primary/20 scale-105 shadow-md md:shadow-lg'
                              : 'border-transparent hover:border-primary/30 shadow-sm md:shadow-md hover:shadow-md md:hover:shadow-lg hover:scale-105 active:scale-95'
                          }`}
                          aria-label={`Select try-on result ${item.id}`}
                          type="button"
                        >
                          {/* Hover overlay effect */}
                          {!isSelected && (
                            <div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/5 transition-colors duration-300 rounded-lg z-10"></div>
                          )}
                          <img 
                            src={getProxiedImageUrl(item.image)} 
                            alt={`Try-on history ${item.id}`} 
                            className={`h-full w-auto object-contain border-2 border-white rounded-lg shadow-sm transition-all duration-300 relative z-0 ${
                              isSelected 
                                ? 'ring-2 ring-primary/20' 
                                : 'group-hover:scale-105 group-hover:shadow-md'
                            }`}
                            onError={(e) => {
                              // Fallback to direct URL if proxy fails
                              if ((e.target as HTMLImageElement).src !== item.image) {
                                (e.target as HTMLImageElement).src = item.image;
                              }
                            }}
                          />
                          {/* Selection indicator */}
                          {isSelected && (
                            <div className="absolute top-1 right-1 w-3 h-3 bg-primary rounded-full border-2 border-white shadow-sm z-20 animate-in zoom-in duration-200"></div>
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
                      aria-label="Upload new photo for try-on"
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
                        New
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
                      aria-label="Upload photo to start try-on"
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
                        Upload photo to start
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
    </div>
  );
};

export default VirtualTryOnModal;

