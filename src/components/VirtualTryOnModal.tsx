import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { X, Upload, CheckCircle, Check, RotateCcw, ShoppingCart, Bell, Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import TestPhotoUpload from '@/components/TestPhotoUpload';
import TestClothingSelection from '@/components/TestClothingSelection';
import { generateTryOn, dataURLToBlob, fetchUploadedImages, fetchCustomerImageHistory, type ImageGenerationHistoryItem } from '@/services/tryonApi';
import { storage } from '@/utils/storage';
import { detectStoreOrigin, extractProductImages, getStoreOriginFromPostMessage, requestStoreInfoFromParent, extractShopifyProductInfo, type StoreInfo } from '@/utils/shopifyIntegration';
import { DEMO_PHOTO_ID_MAP, DEMO_PHOTOS_ARRAY } from '@/constants/demoPhotos';
import type { ProductImage } from '@/types/tryon';

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
  
  // Recent photos from API
  const [recentPhotos, setRecentPhotos] = useState<Array<{ id: string; src: string }>>([]);
  const [isLoadingRecentPhotos, setIsLoadingRecentPhotos] = useState(false);

  // Use the same demo photos as TryOnWidget
  const demoModels = DEMO_PHOTOS_ARRAY;

  // History items from API
  const [historyItems, setHistoryItems] = useState<Array<{ id: string; image: string }>>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const sizes = ['S', 'M', 'L', 'XL'];
  const progressTimerRef = useRef<number | null>(null);
  const elapsedTimerRef = useRef<number | null>(null);
  const currentProgressRef = useRef<number>(0);
  
  // Touch handling for horizontal scroll sections
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const isScrollingRef = useRef<boolean>(false);
  
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
        
        // Auto-select first clothing image if none is selected yet
        if (images.length > 0 && !selectedClothing && !hasAutoSelectedFirstImageRef.current) {
          const firstImage = images[0];
          setSelectedClothing(firstImage);
          storage.saveClothingUrl(firstImage);
          hasAutoSelectedFirstImageRef.current = true;
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
          setStoredProductData(event.data.productData);
          setProductData(event.data.productData);
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
          
          // Auto-select first clothing image if none is selected yet
          // Use setTimeout to ensure handleClothingSelect is available
          if (imageUrls.length > 0 && !selectedClothing && !hasAutoSelectedFirstImageRef.current) {
            const firstImage = imageUrls[0];
            setTimeout(() => {
              setSelectedClothing(firstImage);
              storage.saveClothingUrl(firstImage);
              const clothingId = imageIdMap.get(firstImage) || null;
              setSelectedClothingKey(clothingId);
              hasAutoSelectedFirstImageRef.current = true;
            }, 0);
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
          toast.success('Added to cart successfully!');
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
  }, [selectedClothing, storedProductData, getProductData]);

  // Restore saved state from storage
  useEffect(() => {
    const savedImage = storage.getUploadedImage();
    const savedClothing = storage.getClothingUrl();
    const savedResult = storage.getGeneratedImage();

    if (savedImage) {
      setUploadedImage(savedImage);
    }
    if (savedClothing) {
      setSelectedClothing(savedClothing);
    }
    if (savedResult) {
      setGeneratedImage(savedResult);
      setStep('complete');
    }
  }, []);

  // Fetch recent photos from API
  useEffect(() => {
    if (!customerInfo?.email) return;

    const loadRecentPhotos = async () => {
      setIsLoadingRecentPhotos(true);
      try {
        const shopDomain = storeInfo?.shopDomain || storeInfo?.domain || null;
        const response = await fetchUploadedImages({
          email: customerInfo.email!,
          store: shopDomain || undefined,
          page: 1,
          limit: 20,
        });

        if (response.success && response.data) {
          // Map API data to match UI structure
          const photos = response.data.map((item, index) => ({
            id: item.id || `photo-${index}`,
            src: item.personImageUrl,
          }));
          setRecentPhotos(photos);
        }
      } catch (error) {
        console.error('[VirtualTryOnModal] Failed to fetch recent photos:', error);
        // Keep empty array on error - UI will show empty state
      } finally {
        setIsLoadingRecentPhotos(false);
      }
    };

    loadRecentPhotos();
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
                  createdAt: item.createdAt || item.updatedAt || '',
                };
              })
              .filter((item): item is { id: string; image: string; createdAt: string } => item !== null)
              .sort((a, b) => {
                // Sort by createdAt descending (newest first)
                if (!a.createdAt && !b.createdAt) return 0;
                if (!a.createdAt) return 1;
                if (!b.createdAt) return -1;
                return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
              })
              .map(({ id, image }) => ({ id, image })); // Remove createdAt from final structure
            
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
  }, []);

  // Handle clothing selection
  const handleClothingSelect = useCallback((imageUrl: string) => {
    setSelectedClothing(imageUrl);
    storage.saveClothingUrl(imageUrl);
    
    if (imageUrl) {
      const clothingId = productImagesWithIds.get(imageUrl) || null;
      setSelectedClothingKey(clothingId);
    } else {
      setSelectedClothingKey(null);
    }
  }, [productImagesWithIds]);
  
  // Get size availability for all sizes
  const getSizeAvailability = useCallback(() => {
    const currentProductData = storedProductData || getProductData();
    if (!currentProductData) {
      return sizes.map(size => ({ size, isAvailable: false, variantId: null, inventoryQty: null }));
    }

    const variants = (currentProductData as any)?.variants || 
                     (currentProductData as any)?.variants?.nodes || 
                     [];
    
    return sizes.map(size => {
      // Find variant matching this size
      const variant = variants.find((v: any) => {
        // Check selectedOptions for size
        const selectedOptions = v?.selectedOptions || v?.options || [];
        const sizeOption = selectedOptions.find((opt: any) => 
          opt?.name?.toLowerCase() === 'size' || opt?.name?.toLowerCase() === 'taille'
        );
        
        if (sizeOption) {
          return sizeOption.value?.toUpperCase() === size.toUpperCase();
        }
        
        // Fallback: check if title contains the size
        const title = v?.title || '';
        return title.toUpperCase().includes(size.toUpperCase());
      });

      if (!variant) {
        return { size, isAvailable: false, variantId: null, inventoryQty: null };
      }

      const isAvailable = variant.available !== false && variant.availableForSale !== false;
      const inventoryQty = variant.inventoryQuantity ?? variant.inventory_quantity ?? null;
      const variantId = variant.id || variant.variant_id || null;

      return {
        size,
        isAvailable,
        variantId,
        inventoryQty,
      };
    });
  }, [storedProductData, getProductData]);

  // Memoize size availability to avoid recalculating multiple times
  const sizeAvailability = useMemo(() => getSizeAvailability(), [getSizeAvailability]);

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
        const isAvailable = variant.available !== false && variant.availableForSale !== false;
        const inventoryQty = variant.inventoryQuantity ?? variant.inventory_quantity ?? null;
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

  // Generate try-on
  const handleGenerate = useCallback(async () => {
    if (!uploadedImage || !selectedClothing) {
      setError('Please upload a photo and select clothing');
      toast.error('Missing requirements', {
        description: 'Please upload a photo and select a clothing item.',
      });
      return;
    }

    setStep('generating');
    setProgress(0);
    currentProgressRef.current = 0;
    setElapsedTime(0);
    setError(null);
    setStatusMessage('Preparing your try-on...');

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
      if (startProgress < finalProgress) {
        const completionDuration = 500; // 500ms
        const completionStartTime = Date.now();
        const completionInterval = setInterval(() => {
          const elapsed = Date.now() - completionStartTime;
          const completionProgress = Math.min(elapsed / completionDuration, 1);
          const newProgress = Math.round(startProgress + (finalProgress - startProgress) * completionProgress);
          currentProgressRef.current = newProgress;
          setProgress(newProgress);
          
          if (completionProgress >= 1) {
            clearInterval(completionInterval);
            currentProgressRef.current = finalProgress;
            setProgress(finalProgress);
          }
        }, 16); // ~60fps
      } else {
        currentProgressRef.current = finalProgress;
        setProgress(finalProgress);
      }

      if (result.status === 'success' && result.image) {
        setGeneratedImage(result.image);
        storage.saveGeneratedImage(result.image);
        setStep('complete');
        setProgress(100);
        setStatusMessage('Try-on complete!');
        
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
                        createdAt: item.createdAt || item.updatedAt || '',
                      };
                    })
                    .filter((item): item is { id: string; image: string; createdAt: string } => item !== null)
                    .sort((a, b) => {
                      if (!a.createdAt && !b.createdAt) return 0;
                      if (!a.createdAt) return 1;
                      if (!b.createdAt) return -1;
                      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                    })
                    .map(({ id, image }) => ({ id, image }));
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

  // Handle add to cart
  const handleAddToCart = useCallback(() => {
    if (!selectedSize) {
      toast.error('Please select a size');
      return;
    }

    setIsAddToCartLoading(true);
    const isInIframe = window.parent !== window;
    const currentProductData = getProductData() || productData;

    // Get variant ID for selected size
    const selectedSizeInfo = sizeAvailability.find(s => s.size === selectedSize);
    
    if (!selectedSizeInfo || !selectedSizeInfo.isAvailable) {
      setIsAddToCartLoading(false);
      toast.error('Selected size is not available');
      return;
    }

    if (isInIframe) {
      const variantId = selectedSizeInfo.variantId || 
                        currentProductData?.variantId || 
                        currentProductData?.variants?.[0]?.id || 
                        null;
      
      if (!variantId) {
        setIsAddToCartLoading(false);
        toast.error('Product variant not available');
        return;
      }

      const message = {
        type: 'NUSENSE_ADD_TO_CART',
        ...(currentProductData && { product: currentProductData }),
        quantity: cartQuantity,
        variantId: variantId,
      };
      window.parent.postMessage(message, '*');

      // Safety timeout
      setTimeout(() => {
        setIsAddToCartLoading(false);
      }, 10000);
    } else {
      setIsAddToCartLoading(false);
      setToastMessage(`Added to cart (Size ${selectedSize})!`);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    }
  }, [selectedSize, productData, cartQuantity, getProductData, sizeAvailability]);

  // Handle buy now
  const handleBuyNow = useCallback(() => {
    if (!selectedSize) {
      toast.error('Please select a size');
      return;
    }

    setIsBuyNowLoading(true);
    const isInIframe = window.parent !== window;
    const currentProductData = storedProductData || getProductData();

    if (isInIframe) {
      const message = {
        type: 'NUSENSE_BUY_NOW',
        ...(currentProductData && { product: currentProductData }),
        quantity: cartQuantity,
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
  }, [selectedSize, storedProductData, cartQuantity, getProductData]);

  // Handle notify me
  const handleNotifyMe = useCallback(() => {
    if (!selectedSize) {
      toast.error('Please select a size');
      return;
    }

    setIsNotifyMeLoading(true);
    const isInIframe = window.parent !== window;
    const currentProductData = storedProductData || getProductData();

    // Get variant ID for selected size
    const selectedSizeInfo = sizeAvailability.find(s => s.size === selectedSize);
    const variantId = selectedSizeInfo?.variantId ?? 
                      variantStockInfo?.variantId ?? 
                      (currentProductData as any)?.selectedVariantId ?? 
                      (currentProductData as any)?.variants?.[0]?.id ?? 
                      null;

    if (isInIframe) {
      const message = {
        type: 'NUSENSE_NOTIFY_ME',
        ...(currentProductData && { product: currentProductData }),
        variantId: variantId,
      };
      window.parent.postMessage(message, '*');

      setTimeout(() => {
        setIsNotifyMeLoading(false);
      }, 10000);
    } else {
      setIsNotifyMeLoading(false);
      toast.info('You will be notified when this item is back in stock!');
    }
  }, [selectedSize, storedProductData, variantStockInfo, getProductData, sizeAvailability]);

  // Handle reset
  const handleReset = useCallback(() => {
    setStep('idle');
    setUploadedImage(null);
    setSelectedClothing(null);
    setSelectedClothingKey(null);
    setSelectedDemoPhotoUrl(null);
    setPhotoSelectionMethod(null);
    setGeneratedImage(null);
    setProgress(0);
    currentProgressRef.current = 0;
    setElapsedTime(0);
    setError(null);
    setSelectedSize(null);
    storage.clearSession();
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
        icon: <Sparkles size={16} />,
        disabled: !canGenerate,
        action: handleGenerate,
        color: canGenerate ? 'orange' : 'gray',
      };
    }
    if (step === 'generating') {
      return {
        text: `Generating... ${progress}%`,
        icon: <Loader2 size={16} className="animate-spin" />,
        disabled: true,
        action: () => {},
        color: 'gray',
      };
    }
    if (step === 'complete') {
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
  }, [step, uploadedImage, selectedClothing, progress, selectedSize, sizeAvailability, isNotifyMeLoading, isAddToCartLoading, isBuyNowLoading, currentCartQuantity, handleGenerate, handleNotifyMe, handleAddToCart]);

  const btnState = getButtonState();

  // Get product info for display
  const currentProductData = getProductData() || productData;
  const productTitle = currentProductData?.title || 'Product';
  const productImage = selectedClothing || productImages[0] || 'https://assets.adidas.com/images/h_840,f_auto,q_auto,fl_lossy,c_fill,g_auto/3bbecbdf584e40398446a8bf0117cf62_9366/Tiro_19_Jersey_Black_DW9146_01_laydown.jpg';

  // Generate stable particle positions for celebration animation
  const celebrationParticles = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => ({
      id: i,
      width: Math.random() * 20 + 10,
      height: Math.random() * 20 + 10,
      left: Math.random() * 100,
      top: Math.random() * 100,
      animationDelay: Math.random() * 2,
      animationDuration: Math.random() * 3 + 2,
    }));
  }, []);

  return (
    <div className="w-full h-screen bg-white font-sans relative overflow-hidden">
      {/* Modal container */}
      <div className="fixed inset-0 z-50 bg-white flex items-start justify-center">
        <div className="bg-white w-full max-w-[1200px] h-full flex flex-col overflow-hidden relative shadow-2xl rounded-lg">
          {showToast && (
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-gray-800 text-white px-4 sm:px-6 py-3 sm:py-4 rounded-md shadow-xl z-50 flex items-center gap-2 sm:gap-3 animate-fade-in-up max-w-[90%] sm:max-w-none">
              <CheckCircle className="text-green-400 w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
              <span className="text-xs sm:text-sm">{toastMessage}</span>
              <button
                onClick={() => setShowToast(false)}
                className="ml-2 sm:ml-4 text-gray-400 hover:text-white underline text-xs sm:text-sm flex-shrink-0"
                aria-label="Close notification"
              >
                Close
              </button>
            </div>
          )}

          <div className="flex justify-between items-center px-4 sm:px-6 md:px-8 py-3 sm:py-4 border-b border-gray-100">
            <div className="flex items-center gap-2 sm:gap-3">
              <img
                src="/assets/NUSENSE_LOGO.svg"
                alt="NUSENSE"
                className="h-4 sm:h-5 w-auto flex-shrink-0"
                aria-label="NUSENSE Logo"
              />
              <span className="font-normal text-gray-500 text-xs sm:text-sm flex items-center">Virtual Try-On</span>
            </div>

            <button
              onClick={handleClose}
              className="flex items-center justify-center w-8 h-8 min-w-8 hover:bg-gray-100 rounded-full transition-colors flex-shrink-0"
              aria-label="Close modal"
              type="button"
            >
              <X className="text-gray-400" size={20} />
            </button>
          </div>

          {selectedClothing && (
            <div className="w-full px-4 sm:px-6 md:px-8 py-3 sm:py-4 border-b border-gray-100">
              <div className="flex items-center gap-2 sm:gap-3 bg-gray-50 px-3 sm:px-4 py-2 sm:py-2.5 rounded-md">
                <img
                  src={productImage}
                  alt="Product"
                  className="h-12 sm:h-14 md:h-16 w-auto object-contain flex-shrink-0 border-2 border-white rounded-md"
                />
                <div className="flex flex-col min-w-0">
                  <div className="text-[9px] sm:text-[10px] text-gray-500 uppercase tracking-wide font-medium whitespace-nowrap mb-0.5 sm:mb-1">YOU'RE TRYING ON</div>
                  <div className="text-xs sm:text-sm font-semibold text-gray-800 leading-tight truncate">{productTitle}</div>
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-1 overflow-hidden">
            <div className="w-full overflow-y-auto smooth-scroll [&::-webkit-scrollbar]:w-[2px] [&::-webkit-scrollbar]:h-[2px] [&::-webkit-scrollbar-thumb]:bg-gray-400/15 [&::-webkit-scrollbar-thumb]:rounded-sm [&::-webkit-scrollbar-track]:bg-transparent hover:[&::-webkit-scrollbar-thumb]:bg-gray-400/30" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(156, 163, 175, 0.15) transparent' }}>
              <div className="p-4 sm:p-6 md:p-8">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-4 sm:mb-6">
                {/* Left Column - Step 1 */}
                <div className="flex flex-col">
                  {/* Step 1 Header */}
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-sm sm:text-base font-bold bg-orange-500 text-white">
                      1
                    </div>
                    <h2 className="font-semibold text-base sm:text-lg text-gray-800">Choose your photo</h2>
                  </div>
                  {/* Photo Upload Card */}
                  <div className="bg-orange-50 border-2 border-dashed border-orange-200 rounded-md p-4 sm:p-5 flex flex-col items-center text-center mb-4 sm:mb-5">
                    {!uploadedImage && (
                      <>
                        <h3 className="text-xs sm:text-sm font-bold text-orange-800 mb-3 sm:mb-4 uppercase tracking-wide">For best results</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-gray-600 mb-4 w-full">
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
                      <div className="w-full flex flex-col items-center gap-2">
                        <img
                          src={uploadedImage}
                          alt="Uploaded photo"
                          className="max-w-full max-h-[180px] sm:max-h-[200px] object-contain rounded-md border-2 border-orange-200"
                        />
                        <button
                          onClick={() => {
                            setUploadedImage(null);
                            setSelectedPhoto(null);
                            storage.saveUploadedImage(null);
                          }}
                          className="text-xs text-gray-500 hover:text-gray-700 underline"
                          type="button"
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <button
                        className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-2.5 rounded-md text-sm font-medium flex items-center gap-2 transition-colors w-full justify-center shadow-sm"
                        aria-label="Upload photo"
                        type="button"
                        onClick={() => {
                          // Trigger file input
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
                        }}
                      >
                        <Upload size={16} /> Upload Photo
                      </button>
                    )}
                  </div>

                  {/* Recent Photos Section */}
                  <div className="mb-4 sm:mb-5">
                    <label className="text-sm font-semibold text-gray-700 mb-3 block">Recent photos</label>
                    <div 
                      className="flex gap-3 overflow-x-auto pb-2 pt-1 scrollbar-hide" 
                      style={{ 
                        scrollbarWidth: 'none', 
                        msOverflowStyle: 'none',
                        WebkitOverflowScrolling: 'touch',
                        touchAction: 'pan-x',
                        overscrollBehaviorX: 'contain'
                      }}
                    >
                      {isLoadingRecentPhotos ? (
                        <div className="text-xs text-gray-500">Loading...</div>
                      ) : recentPhotos.length > 0 ? (
                        recentPhotos.map((photo) => (
                          <button
                            key={photo.id}
                            onTouchStart={handleTouchStart}
                            onTouchMove={handleTouchMove}
                            onTouchEnd={(e) => handleTouchEnd(e, () => {
                              setSelectedPhoto(photo.id);
                              // Load the photo and set it as uploaded
                              fetch(photo.src)
                                .then(res => res.blob())
                                .then(blob => {
                                  const reader = new FileReader();
                                  reader.onloadend = () => {
                                    const dataURL = reader.result as string;
                                    handlePhotoUpload(dataURL, false, undefined, photo.id);
                                  };
                                  reader.readAsDataURL(blob);
                                })
                                .catch(() => {
                                  toast.error('Failed to load photo');
                                });
                            })}
                            onClick={() => {
                              // Only handle click if not on touch device (touch events handle touch devices)
                              if (!('ontouchstart' in window)) {
                                setSelectedPhoto(photo.id);
                                // Load the photo and set it as uploaded
                                fetch(photo.src)
                                  .then(res => res.blob())
                                  .then(blob => {
                                    const reader = new FileReader();
                                    reader.onloadend = () => {
                                      const dataURL = reader.result as string;
                                      handlePhotoUpload(dataURL, false, undefined, photo.id);
                                    };
                                    reader.readAsDataURL(blob);
                                  })
                                  .catch(() => {
                                    toast.error('Failed to load photo');
                                  });
                              }
                            }}
                            className={`flex-shrink-0 h-14 rounded-md border-2 transition-all flex items-center justify-center bg-gray-50 ${
                              uploadedImage && selectedPhoto === photo.id
                                ? 'border-orange-500 ring-2 ring-orange-100 scale-105'
                                : 'border-transparent hover:border-gray-200'
                            }`}
                            aria-label={`Select photo ${photo.id}`}
                            type="button"
                          >
                            <img src={photo.src} alt="User" className="h-full w-auto object-contain border-2 border-white rounded-md" />
                          </button>
                        ))
                      ) : (
                        <div className="text-xs text-gray-500">No recent photos</div>
                      )}
                    </div>
                  </div>

                  {/* Use a Demo Model Section */}
                  <div>
                    <label className="text-sm font-semibold text-gray-700 mb-3 block">Use a demo model</label>
                    <div 
                      className="flex gap-3 overflow-x-auto pb-2 pt-1 scrollbar-hide" 
                      style={{ 
                        scrollbarWidth: 'none', 
                        msOverflowStyle: 'none',
                        WebkitOverflowScrolling: 'touch',
                        touchAction: 'pan-x',
                        overscrollBehaviorX: 'contain'
                      }}
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
                                    };
                                    reader.readAsDataURL(blob);
                                  })
                                  .catch(() => {
                                    toast.error('Failed to load demo model');
                                  });
                              }
                            }}
                            className={`flex-shrink-0 h-14 rounded-md border-2 transition-all flex items-center justify-center bg-gray-50 ${
                              uploadedImage && selectedPhoto === modelIndex
                                ? 'border-orange-500 ring-2 ring-orange-100 scale-105'
                                : 'border-transparent hover:border-gray-200'
                            }`}
                            aria-label={`Select demo model ${model.id}`}
                            type="button"
                          >
                            <img src={model.url} alt={`Demo model ${model.id}`} className="h-full w-auto object-contain border-2 border-white rounded-md" />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Right Column - Step 2 */}
                <div className="flex flex-col">
                  {/* Step 2 Header */}
                  <div className="flex items-center gap-2 mb-4">
                    <div className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-sm sm:text-base font-bold ${
                      step === 'complete' || generatedImage
                        ? 'bg-orange-500 text-white'
                        : step === 'generating'
                        ? 'bg-orange-500 text-white'
                        : 'border-2 border-gray-300 text-gray-400'
                    }`}>
                      2
                    </div>
                    <h2 className={`font-semibold text-base sm:text-lg ${
                      step === 'complete' || generatedImage || step === 'generating'
                        ? 'text-gray-800'
                        : 'text-gray-400'
                    }`}>
                      {step === 'generating' ? 'Generating...' : step === 'complete' || generatedImage ? 'Your Look' : 'Your Look'}
                    </h2>
                  </div>

                  {/* Generation Progress Card */}
                  <div className="flex-1 rounded-md border-2 border-dashed border-orange-200 bg-orange-50 relative flex items-center justify-center overflow-hidden min-h-[300px] sm:min-h-[350px]">
                    {step === 'idle' && !generatedImage && (
                      <div className="text-center px-4">
                        <div className="w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center">
                          <svg
                            className="w-16 h-16 text-gray-300"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={1.5} fill="none" />
                            <circle cx="12" cy="12" r="6" stroke="currentColor" strokeWidth={1.5} fill="none" />
                            <circle cx="12" cy="12" r="2" stroke="currentColor" strokeWidth={1.5} fill="currentColor" />
                          </svg>
                        </div>
                        <p className="text-gray-400 text-sm">
                          Your result will appear here.
                          <br />
                          Upload a photo to get started.
                        </p>
                      </div>
                    )}

                    {step === 'generating' && (
                      <div className="text-center w-full px-6 sm:px-8">
                        {/* Circular Spinner */}
                        <div className="relative w-24 h-24 sm:w-28 sm:h-28 mx-auto mb-6">
                          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                            <circle cx="50" cy="50" r="45" fill="none" stroke="#f3f4f6" strokeWidth="8" />
                            <circle
                              cx="50"
                              cy="50"
                              r="45"
                              fill="none"
                              stroke="#FF5722"
                              strokeWidth="8"
                              strokeDasharray="283"
                              strokeDashoffset={283 - (283 * progress) / 100}
                              className="transition-all duration-75 ease-linear"
                              strokeLinecap="round"
                            />
                          </svg>
                          <div className="absolute inset-0 flex items-center justify-center">
                            <Loader2 className="w-8 h-8 sm:w-10 sm:h-10 text-orange-500 animate-spin" />
                          </div>
                        </div>
                        
                        {/* Status Text */}
                        <h3 className="text-base sm:text-lg font-medium text-gray-800 mb-4">
                          {statusMessage || 'Creating your try-on...'}
                        </h3>
                        
                        {/* Progress Bar */}
                        <div className="w-full max-w-xs mx-auto mb-2">
                          <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                            <div
                              className="bg-orange-500 h-2.5 rounded-full transition-all duration-75 ease-linear"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        </div>
                        
                        {/* Percentage */}
                        <p className="text-sm sm:text-base font-medium text-gray-700">{progress}%</p>
                      </div>
                    )}

                    {step === 'complete' && generatedImage && (
                      <div className="relative w-full h-full flex flex-col items-center justify-center p-4 bg-gradient-to-b from-yellow-50 via-orange-50/30 to-yellow-50 rounded-md border-2 border-green-200/50">
                        {/* Celebration Particles/Orbs */}
                        <div className="absolute inset-0 overflow-hidden rounded-md pointer-events-none">
                          {celebrationParticles.map((particle) => (
                            <div
                              key={particle.id}
                              className="absolute rounded-full bg-yellow-400 opacity-60 animate-float"
                              style={{
                                width: `${particle.width}px`,
                                height: `${particle.height}px`,
                                left: `${particle.left}%`,
                                top: `${particle.top}%`,
                                animationDelay: `${particle.animationDelay}s`,
                                animationDuration: `${particle.animationDuration}s`,
                              }}
                            />
                          ))}
                        </div>

                        <div className="relative w-full max-w-xs h-auto shadow-2xl rounded-md mb-6 transform transition-all hover:scale-105 duration-500 z-10">
                          <img
                            src={generatedImage}
                            className="w-full h-full object-contain rounded-md"
                            alt="Try-on result"
                          />
                        </div>

                        <div className="flex items-center gap-2 text-green-600 font-semibold mb-2 z-10">
                          <CheckCircle size={18} className="text-white" fill="currentColor" />
                          <span className="text-base">Try-on complete!</span>
                        </div>
                        <p className="text-sm text-orange-500 font-medium z-10">Select your size below</p>

                        <button
                          onClick={handleReset}
                          className="mt-6 text-xs text-gray-400 hover:text-gray-600 underline flex items-center gap-1 z-10"
                          aria-label="Try again"
                          type="button"
                        >
                          <RotateCcw size={12} /> Not perfect? Try again
                        </button>
                      </div>
                    )}

                    {error && (
                      <div className="text-center p-3 sm:p-4">
                        <p className="text-red-600 text-xs sm:text-sm mb-1.5 sm:mb-2">{error}</p>
                        <button
                          onClick={handleReset}
                          className="text-[10px] sm:text-xs text-gray-600 hover:text-gray-800 underline"
                        >
                          Start over
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              </div>

              {/* Bottom Action Section */}
              <div className="border-t border-gray-100 px-4 sm:px-6 md:px-8 py-4 sm:py-5">
                <div className="flex flex-wrap justify-center items-center gap-1.5 sm:gap-2 mb-3 sm:mb-4">
                  <span className="text-xs sm:text-sm text-gray-500 mr-0.5 sm:mr-1 self-center">Size:</span>
                  {sizes.map((size) => {
                    const sizeInfo = sizeAvailability.find(s => s.size === size);
                    const isAvailable = sizeInfo?.isAvailable ?? false;
                    const isSelected = selectedSize === size;
                    
                    return (
                      <button
                        key={size}
                        onClick={() => isAvailable && setSelectedSize(size)}
                        disabled={!isAvailable}
                        className={`w-8 h-8 sm:w-10 sm:h-10 rounded-md border text-xs sm:text-sm font-medium transition-colors ${
                          !isAvailable
                            ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                            : isSelected
                            ? 'bg-black text-white border-black'
                            : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                        }`}
                        aria-label={`Select size ${size}${!isAvailable ? ' (out of stock)' : ''}`}
                        type="button"
                      >
                        {size}
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
                    } else if (outOfStockSizes.length > 0) {
                      return (
                        <span className="text-[10px] sm:text-xs text-red-400 ml-1 sm:ml-2">
                          All sizes out of stock
                        </span>
                      );
                    }
                    return null;
                  })()}
                </div>

                <button
                  onClick={btnState.action}
                  disabled={btnState.disabled}
                  className={`w-full h-12 rounded-md flex items-center justify-center gap-2 font-semibold text-base transition-all ${
                    btnState.disabled
                      ? 'bg-gray-300 cursor-not-allowed text-white'
                      : btnState.color === 'orange'
                      ? 'bg-orange-500 hover:bg-orange-600 text-white shadow-md hover:shadow-lg'
                      : 'bg-gray-500 hover:bg-gray-600 text-white shadow-md hover:shadow-lg'
                  }`}
                  aria-label={btnState.text}
                  type="button"
                >
                  {step === 'generating' ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Generating... {progress}%</span>
                    </>
                  ) : (
                    <>
                      {btnState.icon}
                      {btnState.text}
                    </>
                  )}
                </button>

                {step === 'generating' && (
                  <p className="text-center text-xs text-gray-400 mt-2">
                    Please wait while we create your try-on.
                  </p>
                )}
                
                {step !== 'generating' && step === 'complete' && (
                  <>
                    <p className="text-center text-[10px] text-gray-400 mt-2 px-2">
                      Rendered for aesthetic purposes. Does not reflect actual dimensions.
                    </p>
                    <p className="text-center text-xs text-gray-500 mt-2">
                      Free shipping on orders over $50
                    </p>
                    <button
                      onClick={handleReset}
                      className="text-center text-sm text-orange-500 hover:text-orange-600 underline mt-2 mx-auto"
                      type="button"
                    >
                      Try another photo
                    </button>
                  </>
                )}

                {step !== 'generating' && step !== 'complete' && (
                  <p className="text-center text-[10px] text-gray-400 mt-2 px-2">
                    Rendered for aesthetic purposes. Does not reflect actual dimensions.
                  </p>
                )}
              </div>

              {/* History Section */}
              <div className="bg-white border-t border-gray-100 px-4 sm:px-6 md:px-8 py-3 sm:py-4 min-h-[120px] sm:min-h-[140px] flex flex-col justify-center">
                <div className="flex justify-between items-center mb-1.5 sm:mb-2">
                  <h4 className="text-[10px] sm:text-xs font-bold text-gray-500 uppercase tracking-wide">Your try-on history</h4>
                  <button className="text-[10px] sm:text-xs text-orange-500 font-medium hover:underline" type="button">
                    View all
                  </button>
                </div>

                <div 
                  className="flex gap-3 overflow-x-auto pb-2 pt-1 scrollbar-hide"
                  style={{ 
                    scrollbarWidth: 'none', 
                    msOverflowStyle: 'none',
                    WebkitOverflowScrolling: 'touch',
                    touchAction: 'pan-x',
                    overscrollBehaviorX: 'contain'
                  }}
                >
                {isLoadingHistory ? (
                  <div className="text-xs text-gray-500">Loading...</div>
                ) : historyItems.length > 0 ? (
                  <>
                    {historyItems.map((item) => {
                      const isSelected = generatedImage === item.image;
                      return (
                        <button
                          key={item.id}
                          onTouchStart={handleTouchStart}
                          onTouchMove={handleTouchMove}
                          onTouchEnd={(e) => handleTouchEnd(e, () => {
                            // Load the history image and set it as generated
                            fetch(item.image)
                              .then(res => res.blob())
                              .then(blob => {
                                const reader = new FileReader();
                                reader.onloadend = () => {
                                  const dataURL = reader.result as string;
                                  setGeneratedImage(dataURL);
                                  storage.saveGeneratedImage(dataURL);
                                  setStep('complete');
                                };
                                reader.readAsDataURL(blob);
                              })
                              .catch(() => {
                                toast.error('Failed to load try-on result');
                              });
                          })}
                          onClick={() => {
                            // Only handle click if not on touch device (touch events handle touch devices)
                            if (!('ontouchstart' in window)) {
                              // Load the history image and set it as generated
                              fetch(item.image)
                                .then(res => res.blob())
                                .then(blob => {
                                  const reader = new FileReader();
                                  reader.onloadend = () => {
                                    const dataURL = reader.result as string;
                                    setGeneratedImage(dataURL);
                                    storage.saveGeneratedImage(dataURL);
                                    setStep('complete');
                                  };
                                  reader.readAsDataURL(blob);
                                })
                                .catch(() => {
                                  toast.error('Failed to load try-on result');
                                });
                            }
                          }}
                          className={`flex-shrink-0 h-14 rounded-md border-2 transition-all flex items-center justify-center bg-gray-50 ${
                            isSelected
                              ? 'border-orange-500 ring-2 ring-orange-100 scale-105'
                              : 'border-transparent hover:border-gray-200'
                          }`}
                          aria-label={`Select try-on result ${item.id}`}
                          type="button"
                        >
                          <img 
                            src={item.image} 
                            alt={`Try-on history ${item.id}`} 
                            className="h-full w-auto object-contain border-2 border-white rounded-md" 
                          />
                        </button>
                      );
                    })}
                    <div className="flex-shrink-0 h-14 border-2 border-dashed border-gray-200 rounded-md flex items-center justify-center bg-gray-50">
                      <span className="text-gray-300 text-[10px] sm:text-xs">+</span>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-center w-full py-1.5 sm:py-2">
                    <span className="text-xs text-gray-400 text-center px-2">No try-on history yet. Generate your first try-on to see it here.</span>
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

