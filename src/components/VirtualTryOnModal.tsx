import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { X, Upload, CheckCircle, Check, RotateCcw, ShoppingCart, Bell, Loader2, AlertCircle, Clock, Zap } from 'lucide-react';
import { toast } from 'sonner';
import TestPhotoUpload from '@/components/TestPhotoUpload';
import TestClothingSelection from '@/components/TestClothingSelection';
import { generateTryOn, dataURLToBlob, fetchUploadedImages, fetchCustomerImageHistory, type ImageGenerationHistoryItem } from '@/services/tryonApi';
import { storage } from '@/utils/storage';
import { detectStoreOrigin, extractProductImages, getStoreOriginFromPostMessage, requestStoreInfoFromParent, extractShopifyProductInfo, type StoreInfo } from '@/utils/shopifyIntegration';
import { DEMO_PHOTO_ID_MAP, DEMO_PHOTOS_ARRAY } from '@/constants/demoPhotos';
import type { ProductImage } from '@/types/tryon';
import { BorderBeam } from '@/components/ui/border-beam';
import { ShineBorder } from '@/components/ui/shine-border';

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

    if (savedImage) {
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
              .filter((item): item is { id: string; image: string; personImageUrl?: string; clothingImageUrl?: string; createdAt: string } => item !== null)
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
    
    // Auto-scroll to clothing selection after photo is selected
    setTimeout(() => {
      scrollToElement(clothingSelectionRef, 20);
    }, 300);
  }, [scrollToElement]);

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
      
      setGeneratedImage(generatedDataURL);
      storage.saveGeneratedImage(generatedDataURL);
      
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
          
          setUploadedImage(personDataURL);
          storage.saveUploadedImage(personDataURL);
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
      
      // Set viewing past try-on state
      setViewingPastTryOn(true);
      setViewingHistoryItem(item);
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
    
    // Auto-scroll to generate button after clothing is selected
    setTimeout(() => {
      if (uploadedImage) {
        // Only scroll if photo is already selected
        scrollToElement(generateButtonRef, 20);
        focusElement(generateButtonRef, 400);
      } else {
        // If no photo, scroll to photo upload section
        scrollToElement(photoUploadRef, 20);
      }
    }, 300);
  }, [productImagesWithIds, storedProductData, productData, uploadedImage, scrollToElement, focusElement]);
  
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
      // Scroll to missing requirement
      if (!uploadedImage) {
        scrollToElement(photoUploadRef, 20);
      } else if (!selectedClothing) {
        scrollToElement(clothingSelectionRef, 20);
      }
      return;
    }

    setStep('generating');
    setProgress(0);
    currentProgressRef.current = 0;
    setElapsedTime(0);
    setError(null);
    setStatusMessage('Preparing your try-on...');
    
    // Auto-scroll to generating section immediately
    setTimeout(() => {
      scrollToElement(rightColumnRef, 20);
    }, 100);

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
        setGeneratedImage(result.image);
        storage.saveGeneratedImage(result.image);
        
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
          setStatusMessage('Try-on complete!');
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
                    .filter((item): item is { id: string; image: string; personImageUrl?: string; clothingImageUrl?: string; createdAt: string } => item !== null)
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

  // Handle going back to current try-on
  const handleBackToCurrent = useCallback(() => {
    setViewingPastTryOn(false);
    setViewingHistoryItem(null);
    // Keep the current generated image if it exists
  }, []);
  
  // Handle regenerating past try-on
  const handleRegeneratePastTryOn = useCallback(async () => {
    if (!viewingHistoryItem) return;
    
    // Reset to idle state
    setViewingPastTryOn(false);
    setViewingHistoryItem(null);
    setStep('idle');
    setGeneratedImage(null);
    setProgress(0);
    setError(null);
    
    // Auto-trigger generation with the same images
    if (uploadedImage && selectedClothing) {
      // Small delay to ensure state is reset
      setTimeout(() => {
        void handleGenerate();
      }, 100);
    }
  }, [viewingHistoryItem, uploadedImage, selectedClothing, handleGenerate]);

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
    // Don't clear selectedClothing and selectedClothingKey - keep the product image visible in "YOU'RE TRYING ON" section
    setSelectedDemoPhotoUrl(null);
    setPhotoSelectionMethod(null);
    setGeneratedImage(null);
    setProgress(0);
    currentProgressRef.current = 0;
    setElapsedTime(0);
    setError(null);
    setSelectedSize(null);
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

  // Refs for auto-scrolling and focusing
  const mainContentRef = useRef<HTMLDivElement>(null);
  const generatedImageRef = useRef<HTMLDivElement>(null);
  const rightColumnRef = useRef<HTMLDivElement>(null);
  const clothingSelectionRef = useRef<HTMLDivElement>(null);
  const generateButtonRef = useRef<HTMLButtonElement>(null);
  const sizeSelectionRef = useRef<HTMLDivElement>(null);
  const addToCartButtonRef = useRef<HTMLButtonElement>(null);
  const photoUploadRef = useRef<HTMLDivElement>(null);

  // Detect mobile device
  const isMobileDevice = useCallback(() => {
    if (typeof window === 'undefined') return false;
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
           (window.innerWidth < 768) ||
           ('ontouchstart' in window);
  }, []);

  // Helper function for smooth scrolling to an element - optimized for desktop and mobile
  const scrollToElement = useCallback((elementRef: React.RefObject<HTMLElement>, offset: number = 20, behavior?: ScrollBehavior) => {
    if (!elementRef.current || !mainContentRef.current) return;
    
    const element = elementRef.current;
    const container = mainContentRef.current;
    const isMobile = isMobileDevice();
    
    // Check if element is already visible
    const containerRect = container.getBoundingClientRect();
    const elementRect = element.getBoundingClientRect();
    
    const isElementVisible = 
      elementRect.top >= containerRect.top &&
      elementRect.bottom <= containerRect.bottom &&
      elementRect.left >= containerRect.left &&
      elementRect.right <= containerRect.right;
    
    if (!isElementVisible) {
      // Mobile: Use smaller offset, instant scroll for better UX
      // Desktop: Use smooth scroll with offset
      const scrollOffset = isMobile ? 10 : offset;
      const scrollBehavior = behavior || (isMobile ? 'auto' : 'smooth');
      
      const scrollPosition = 
        element.offsetTop - 
        container.offsetTop - 
        scrollOffset;
      
      // Use requestAnimationFrame for better mobile performance
      if (isMobile) {
        requestAnimationFrame(() => {
          container.scrollTo({
            top: Math.max(0, scrollPosition),
            behavior: scrollBehavior
          });
        });
      } else {
        container.scrollTo({
          top: Math.max(0, scrollPosition),
          behavior: scrollBehavior
        });
      }
    }
  }, [isMobileDevice]);

  // Helper function to focus an element - optimized for desktop and mobile
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

  // Auto-scroll to generated image when it appears - optimized for mobile and desktop
  useEffect(() => {
    if (step === 'complete' && generatedImage && generatedImageRef.current && mainContentRef.current) {
      const isMobile = isMobileDevice();
      // Delay scroll to allow glow animation to start
      // Mobile: Shorter delay (600ms), Desktop: Full delay (800ms) for glow effect
      const delay = isMobile ? 600 : 800;
      
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
            // Mobile: Scroll to top of image, Desktop: Center the image
            const scrollOffset = isMobile 
              ? 10 
              : (container.clientHeight / 2) - (imageElement.clientHeight / 2);
            
            const scrollPosition = 
              imageElement.offsetTop - 
              container.offsetTop - 
              scrollOffset;
            
            const scrollBehavior = isMobile ? 'auto' : 'smooth';
            
            if (isMobile) {
              requestAnimationFrame(() => {
                container.scrollTo({
                  top: Math.max(0, scrollPosition),
                  behavior: scrollBehavior
                });
              });
            } else {
              container.scrollTo({
                top: Math.max(0, scrollPosition),
                behavior: scrollBehavior
              });
            }
          }
        }
      }, delay);

      return () => clearTimeout(scrollTimeout);
    }
  }, [step, generatedImage, isMobileDevice]);

  // Auto-scroll to right column when generating starts - optimized for mobile and desktop
  useEffect(() => {
    if (step === 'generating' && rightColumnRef.current && mainContentRef.current) {
      const isMobile = isMobileDevice();
      // Mobile: Faster scroll (200ms), Desktop: Smooth scroll (300ms)
      const delay = isMobile ? 200 : 300;
      
      const scrollTimeout = setTimeout(() => {
        scrollToElement(rightColumnRef, isMobile ? 10 : 20);
      }, delay);

      return () => clearTimeout(scrollTimeout);
    }
  }, [step, scrollToElement, isMobileDevice]);

  // Auto-scroll/focus after photo selection - optimized for mobile and desktop
  useEffect(() => {
    if (uploadedImage && !selectedClothing && clothingSelectionRef.current) {
      const isMobile = isMobileDevice();
      // Mobile: Faster scroll (200ms), Desktop: Smooth scroll (300ms)
      const delay = isMobile ? 200 : 300;
      
      const scrollTimeout = setTimeout(() => {
        scrollToElement(clothingSelectionRef, isMobile ? 10 : 20);
      }, delay);

      return () => clearTimeout(scrollTimeout);
    }
  }, [uploadedImage, selectedClothing, scrollToElement, isMobileDevice]);

  // Auto-scroll/focus after clothing selection (if photo already selected)
  useEffect(() => {
    if (selectedClothing && uploadedImage && step === 'idle' && generateButtonRef.current) {
      const isMobile = isMobileDevice();
      const delay = isMobile ? 200 : 300;
      
      const scrollTimeout = setTimeout(() => {
        scrollToElement(generateButtonRef, isMobile ? 10 : 20);
        // Only focus on desktop (mobile focus causes keyboard popup)
        if (!isMobile) {
          focusElement(generateButtonRef, 400);
        }
      }, delay);

      return () => clearTimeout(scrollTimeout);
    }
  }, [selectedClothing, uploadedImage, step, scrollToElement, focusElement, isMobileDevice]);

  // Auto-scroll/focus after size selection - optimized for mobile and desktop
  useEffect(() => {
    if (selectedSize && step === 'complete' && addToCartButtonRef.current) {
      const isMobile = isMobileDevice();
      const delay = isMobile ? 200 : 300;
      
      const scrollTimeout = setTimeout(() => {
        scrollToElement(addToCartButtonRef, isMobile ? 10 : 20);
        // Only focus on desktop (mobile focus causes keyboard popup)
        if (!isMobile) {
          focusElement(addToCartButtonRef, 400);
        }
      }, delay);

      return () => clearTimeout(scrollTimeout);
    }
  }, [selectedSize, step, scrollToElement, focusElement, isMobileDevice]);

  return (
    <div className="w-full h-screen bg-white font-sans relative overflow-hidden">
      {/* Skip to main content link for keyboard navigation */}
      <a
        href="#main-content"
        className="sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:w-auto focus:h-auto focus:px-4 focus:py-2 focus:bg-orange-500 focus:text-white focus:rounded-md focus:font-medium focus:shadow-lg focus:m-0"
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
        {statusMessage || (step === 'idle' ? 'Ready to generate try-on' : step === 'generating' ? `Generating try-on: ${progress}% complete` : 'Try-on complete')}
      </div>

      {/* ARIA Live Region for Errors */}
      {error && (
        <div
          aria-live="assertive"
          aria-atomic="true"
          className="sr-only"
          role="alert"
        >
          Error: {error}
        </div>
      )}

      {/* Modal container */}
      <div className="fixed inset-0 z-50 bg-white flex items-start justify-center">
        <div className="bg-white w-full max-w-[1200px] md:max-w-[1400px] h-full flex flex-col overflow-hidden relative shadow-xl md:shadow-2xl rounded-lg" role="dialog" aria-modal="true" aria-labelledby="modal-title">
          {showToast && (
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-gray-800 text-white px-4 sm:px-6 py-3 sm:py-4 rounded-md shadow-lg md:shadow-xl z-50 flex items-center gap-2 sm:gap-3 animate-fade-in-up max-w-[90%] sm:max-w-none">
              <CheckCircle className="text-green-400 w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
              <span className="text-xs sm:text-sm">{toastMessage}</span>
              <button
                onClick={() => setShowToast(false)}
                className="ml-2 sm:ml-4 text-gray-400 hover:text-white underline text-xs sm:text-sm flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-gray-800 rounded"
                aria-label="Close notification"
                type="button"
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
              <span className="font-normal text-gray-700 text-xs sm:text-sm flex items-center" id="modal-title">Virtual Try-On</span>
            </div>

            <button
              onClick={handleClose}
              className="flex items-center justify-center w-8 h-8 min-w-8 hover:bg-gray-100 rounded-full transition-colors flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2"
              aria-label="Close modal"
              type="button"
            >
              <X className="text-gray-400" size={20} />
            </button>
          </div>

          {/* Viewing Past Try-On Banner */}
          {viewingPastTryOn && viewingHistoryItem && (
            <div className="w-full px-4 sm:px-6 md:px-8 border-b border-yellow-200 bg-yellow-50">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 py-3 sm:py-4">
                <div className="flex items-center gap-2 text-sm sm:text-base">
                  <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-700 flex-shrink-0" />
                  <span className="font-medium text-yellow-900">Viewing past try-on</span>
                  <span className="text-yellow-700">{getTimeAgo(viewingHistoryItem.createdAt)}</span>
                </div>
                <div className="flex gap-2 sm:gap-3 md:flex-shrink-0">
                  <button
                    onClick={handleRegeneratePastTryOn}
                    className="px-4 py-2 bg-yellow-100 hover:bg-yellow-200 text-yellow-900 rounded-md text-sm font-medium transition-colors border border-yellow-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-500 focus-visible:ring-offset-2"
                    type="button"
                  >
                    Regenerate
                  </button>
                  <button
                    onClick={handleBackToCurrent}
                    className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2"
                    type="button"
                  >
                    Back to current
                  </button>
                </div>
              </div>
            </div>
          )}

          {(selectedClothing || productImage) && (
            <div className="w-full px-4 sm:px-6 md:px-8 border-b border-gray-100" ref={clothingSelectionRef}>
              <div className="flex items-center gap-2 sm:gap-3 bg-gray-50 px-3 sm:px-4 py-2 sm:py-2.5 rounded-md">
                <img
                  key={selectedClothing || productImage} // Force re-render when selectedClothing changes
                  src={selectedClothing || productImage || ''}
                  alt={productTitle}
                  className="h-12 sm:h-14 md:h-16 w-auto object-contain flex-shrink-0 border-2 border-white rounded-md shadow-sm md:shadow-md"
                  onError={(e) => {
                    // Fallback to first product image if selected clothing fails to load
                    if (productImages[0] && (e.target as HTMLImageElement).src !== productImages[0]) {
                      (e.target as HTMLImageElement).src = productImages[0];
                    }
                  }}
                />
                <div className="flex flex-col min-w-0 flex-1">
                  <div className="text-[9px] sm:text-[10px] text-gray-700 uppercase tracking-wide font-medium whitespace-nowrap mb-0.5 sm:mb-1">
                    {viewingPastTryOn ? 'PREVIOUSLY TRIED ON' : "YOU'RE TRYING ON"}
                  </div>
                  <div className="text-xs sm:text-sm font-semibold text-gray-900 leading-tight truncate">{productTitle}</div>
                  {variantInfo && (
                    <div className="text-[10px] sm:text-xs text-gray-700 leading-tight truncate mt-0.5">{variantInfo}</div>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-1 overflow-hidden">
            <div 
              id="main-content" 
              ref={mainContentRef}
              className="w-full overflow-y-auto smooth-scroll [&::-webkit-scrollbar]:w-[2px] [&::-webkit-scrollbar]:h-[2px] [&::-webkit-scrollbar-thumb]:bg-gray-400/15 [&::-webkit-scrollbar-thumb]:rounded-sm [&::-webkit-scrollbar-track]:bg-transparent hover:[&::-webkit-scrollbar-thumb]:bg-gray-400/30" 
              style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(156, 163, 175, 0.15) transparent' }}
            >
              <div className="p-4 sm:p-6 md:p-8">
                <div className="flex flex-col md:grid md:grid-cols-2 gap-4 sm:gap-6 md:gap-8 mb-4 sm:mb-6">
                {/* Left Column - Step 1 */}
                <div className="flex flex-col w-full">
                  {/* Step 1 Header */}
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center text-sm sm:text-base md:text-lg font-bold bg-orange-500 text-white">
                      1
                    </div>
                    <h2 className="font-semibold text-base sm:text-lg md:text-xl text-gray-800">Choose your photo</h2>
                  </div>
                  {/* Photo Upload Card */}
                  <div ref={photoUploadRef} className="bg-orange-50 border-2 border-dashed border-orange-200 rounded-md p-4 sm:p-5 md:p-6 flex flex-col items-center text-center mb-4 sm:mb-5 md:mb-6">
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
                          className="max-w-full max-h-[180px] sm:max-h-[200px] object-contain rounded-md border-2 border-white shadow-md md:shadow-lg"
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
                        className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-2.5 rounded-md text-sm font-medium flex items-center gap-2 transition-all w-full justify-center shadow-md md:shadow-lg hover:shadow-lg md:hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2"
                        aria-label="Upload photo"
                        type="button"
                        onClick={triggerPhotoUpload}
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
                        <div className="flex gap-3">
                          {[1, 2, 3].map((i) => (
                            <div key={i} className="flex-shrink-0 h-14 w-14 rounded-md bg-gray-200 animate-pulse" />
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
                                    // Auto-scroll to clothing selection after photo loads
                                    setTimeout(() => {
                                      scrollToElement(clothingSelectionRef, 20);
                                    }, 500);
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
                                      // Auto-scroll to clothing selection after photo loads
                                      setTimeout(() => {
                                        scrollToElement(clothingSelectionRef, 20);
                                      }, 500);
                                    };
                                    reader.readAsDataURL(blob);
                                  })
                                  .catch((error) => {
                                    console.error('[VirtualTryOnModal] Failed to load recent photo:', error);
                                    toast.error('Failed to load photo');
                                  });
                              }
                            }}
                            className={`flex-shrink-0 h-14 rounded-md border-2 transition-all flex items-center justify-center bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 ${
                              selectedPhoto === photo.id
                                ? 'border-orange-500 ring-2 ring-orange-100 scale-105 shadow-md md:shadow-lg'
                                : 'border-transparent hover:border-gray-200 shadow-sm md:shadow-md hover:shadow-md md:hover:shadow-lg'
                            }`}
                            aria-label={`Select photo ${photo.id}`}
                            type="button"
                          >
                            <img 
                              src={getProxiedImageUrl(photo.src)} 
                              alt="User" 
                              className="h-full w-auto object-contain border-2 border-white rounded-md shadow-sm"
                              onError={(e) => {
                                // Fallback to direct URL if proxy fails
                                if ((e.target as HTMLImageElement).src !== photo.src) {
                                  (e.target as HTMLImageElement).src = photo.src;
                                }
                              }}
                            />
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
                                    // Auto-scroll to clothing selection after photo loads
                                    setTimeout(() => {
                                      scrollToElement(clothingSelectionRef, 20);
                                    }, 500);
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
                                      // Auto-scroll to clothing selection after photo loads
                                      setTimeout(() => {
                                        scrollToElement(clothingSelectionRef, 20);
                                      }, 500);
                                    };
                                    reader.readAsDataURL(blob);
                                  })
                                  .catch(() => {
                                    toast.error('Failed to load demo model');
                                  });
                              }
                            }}
                            className={`flex-shrink-0 h-14 rounded-md border-2 transition-all flex items-center justify-center bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 ${
                              selectedPhoto === modelIndex
                                ? 'border-orange-500 ring-2 ring-orange-100 scale-105 shadow-md md:shadow-lg'
                                : 'border-transparent hover:border-gray-200 shadow-sm md:shadow-md hover:shadow-md md:hover:shadow-lg'
                            }`}
                            aria-label={`Select demo model ${model.id}`}
                            type="button"
                          >
                            <img src={model.url} alt={`Demo model ${model.id}`} className="h-full w-auto object-contain border-2 border-white rounded-md shadow-sm" />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Right Column - Step 2 */}
                  <div className="flex flex-col w-full" ref={rightColumnRef}>
                  {/* Step 2 Header */}
                  <div className="flex items-center gap-2 mb-4">
                    <div className={`w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center text-sm sm:text-base md:text-lg font-bold ${
                      step === 'complete' || generatedImage
                        ? 'bg-green-500 text-white'
                        : step === 'generating'
                        ? 'bg-orange-500 text-white'
                        : 'bg-gray-300 text-gray-500'
                    }`}>
                      {step === 'complete' || generatedImage ? (
                        <CheckCircle size={16} className="md:w-5 md:h-5" fill="currentColor" />
                      ) : (
                        '2'
                      )}
                    </div>
                    <h2 className={`font-semibold text-base sm:text-lg md:text-xl ${
                      step === 'complete' || generatedImage || step === 'generating'
                        ? 'text-gray-800'
                        : 'text-gray-400'
                    }`}>
                      {step === 'generating' ? 'Generating...' : step === 'complete' || generatedImage ? 'Your Look' : 'Your Look'}
                    </h2>
                  </div>

                  {/* Generation Progress Card */}
                  <div className="flex-1 rounded-md border-2 border-dashed border-orange-200 bg-[#f5f4f0] relative flex items-center justify-center overflow-hidden min-h-[300px] sm:min-h-[350px] md:min-h-[400px]">
                    {step === 'idle' && !generatedImage && !error && (
                      <div className="text-center px-4 sm:px-6 py-8 sm:py-12">
                        <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full mx-auto mb-4 sm:mb-6 flex items-center justify-center">
                          <RotateCcw className="w-16 h-16 sm:w-20 sm:h-20 text-pink-500" strokeWidth={2} />
                        </div>
                        <p className="text-red-600 text-base sm:text-lg font-semibold mb-2">
                          Ready to generate
                        </p>
                        <p className="text-gray-500 text-sm sm:text-base">
                          Click the button below
                        </p>
                      </div>
                    )}

                    {step === 'generating' && progress < 100 && (
                      <div className="text-center w-full px-6 sm:px-8 py-8 animate-fade-in">
                        {/* Continuous Circular Rotation Loader */}
                        <div className="relative w-24 h-24 sm:w-28 sm:h-28 mx-auto mb-6">
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
                                <stop offset="0%" stopColor="#FF5722" stopOpacity="1" />
                                <stop offset="100%" stopColor="#FF8A65" stopOpacity="0.3" />
                              </linearGradient>
                            </defs>
                          </svg>
                        </div>
                        
                        {/* Status Text - Below Circular Loader */}
                        <h3 className="text-base sm:text-lg font-medium text-gray-800 mb-4">
                          {statusMessage || 'Creating your try-on...'}
                        </h3>
                        
                        {/* Linear Progress Bar - Shows actual progress */}
                        <div className="w-full max-w-xs mx-auto mb-3">
                          <div className="w-full bg-gray-200 rounded-full h-2.5 sm:h-3 overflow-hidden shadow-sm">
                            <div
                              className="bg-[#FF5722] h-full rounded-full transition-all duration-75 ease-linear shadow-sm"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        </div>
                        
                        {/* Progress Percentage */}
                        <p className="text-sm sm:text-base font-semibold text-orange-500">
                          {progress}%
                        </p>
                      </div>
                    )}

                    {step === 'generating' && progress === 100 && (
                      <div className="text-center w-full px-6 sm:px-8 py-8 animate-fade-in">
                        {/* Checkmark Animation - Success indicator */}
                        <div className="relative w-24 h-24 sm:w-28 sm:h-28 mx-auto mb-6 flex items-center justify-center">
                          {/* Completed circle background */}
                          <div className="absolute inset-0 rounded-full bg-orange-100 flex items-center justify-center animate-scale-in">
                            <div className="w-full h-full rounded-full border-4 border-[#c96442]"></div>
                          </div>
                          {/* Checkmark icon - appears after circle */}
                          <CheckCircle 
                            size={56} 
                            className="text-[#c96442] relative z-10 animate-scale-in-delayed"
                            strokeWidth={2.5}
                            fill="currentColor"
                          />
                        </div>
                        
                        {/* Status Text - Finalizing */}
                        <h3 className="text-base sm:text-lg font-medium text-gray-800 mb-6">
                          {statusMessage || 'Finalizing your try-on...'}
                        </h3>
                        
                        {/* Progress Bar - Full */}
                        <div className="w-full max-w-xs mx-auto mb-2">
                          <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                            <div
                              className="bg-[#c96442] h-2.5 rounded-full transition-all duration-300 ease-out"
                              style={{ width: '100%' }}
                            />
                          </div>
                        </div>
                        
                        {/* Percentage - 100% */}
                        <p className="text-sm sm:text-base font-medium text-gray-700">100%</p>
                      </div>
                    )}

                    {step === 'complete' && generatedImage && (
                      <div className={`relative w-full h-full flex flex-col items-center justify-center p-4 sm:p-6 overflow-hidden ${viewingPastTryOn ? 'border-2 border-dashed border-yellow-400 rounded-md' : ''}`}>
                        {/* Background gradient matching screenshots - light yellow/orange to white */}
                        <div className="absolute inset-0 bg-gradient-to-br from-yellow-50/60 via-orange-50/40 to-white rounded-md" />
                        
                        {/* Celebration Bubbles - Floating particles (only show for new generations, not past try-ons) */}
                        {!viewingPastTryOn && (
                          <div className="absolute inset-0 overflow-hidden pointer-events-none">
                            {celebrationParticles.map((particle) => (
                              <div
                                key={particle.id}
                                className="absolute rounded-full bg-gradient-to-br from-orange-200/60 via-orange-100/40 to-orange-300/50 blur-sm"
                                style={{
                                  width: `${particle.width}px`,
                                  height: `${particle.height}px`,
                                  left: `${particle.left}%`,
                                  top: `${particle.top}%`,
                                  animation: `bubbleFloatUp ${particle.animationDuration}s ease-out ${particle.animationDelay + 0.5}s forwards`,
                                  opacity: 0,
                                }}
                              />
                            ))}
                          </div>
                        )}
                        
                        {/* Success Badge - Fades in slowly (only for new generations) */}
                        {!viewingPastTryOn && (
                          <div className="relative z-10 mb-4" style={{ animation: 'fadeInSlow 1.2s ease-out 0.3s forwards', opacity: 0 }}>
                            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/90 backdrop-blur-sm rounded-full shadow-lg border border-green-100">
                              <CheckCircle size={18} className="text-green-500 flex-shrink-0" fill="currentColor" />
                              <span className="text-sm font-semibold text-gray-800">Try-on complete!</span>
                            </div>
                          </div>
                        )}

                        {/* Result Image - Glowing bulb reveal animation */}
                        <div 
                          ref={generatedImageRef}
                          className={`relative z-10 w-full max-w-xs sm:max-w-sm md:max-w-md mb-4 ${viewingPastTryOn ? '' : 'glow-buildup-container'}`}
                        >
                          <div className={`relative rounded-lg overflow-hidden shadow-xl md:shadow-2xl bg-white border border-gray-100 ${!viewingPastTryOn ? 'animate-bulb-glow-pulse' : ''}`}>
                            {/* Enhanced border glow with bulb effect - Using Magic UI components */}
                            {!viewingPastTryOn && (
                              <>
                                {/* Border beam effect - Magic UI component */}
                                <BorderBeam
                                  size={60}
                                  duration={3}
                                  delay={0}
                                  colorFrom="#ff9800"
                                  colorTo="#ff5722"
                                  borderWidth={2}
                                  className="rounded-lg"
                                />
                                
                                {/* Multi-layer ring glow effects - Build up first */}
                                <div className="absolute inset-0 rounded-lg ring-2 ring-orange-300/70 pointer-events-none animate-bulb-glow z-20" style={{ willChange: 'opacity, box-shadow' }} />
                                <div className="absolute inset-0 rounded-lg ring-4 ring-orange-200/50 pointer-events-none animate-bulb-glow z-20" style={{ animationDelay: '0.3s', willChange: 'opacity, box-shadow' }} />
                                <div className="absolute inset-0 rounded-lg ring-6 ring-orange-100/30 pointer-events-none animate-bulb-glow z-20" style={{ animationDelay: '0.6s', willChange: 'opacity, box-shadow' }} />
                                
                                {/* Shine border effect - Magic UI component */}
                                <ShineBorder
                                  borderWidth={2}
                                  duration={4}
                                  shineColor={["rgba(255, 152, 0, 0.6)", "rgba(255, 87, 34, 0.4)"]}
                                  className="rounded-lg"
                                />
                              </>
                            )}
                            {viewingPastTryOn && (
                              <div className="absolute inset-0 rounded-lg ring-2 ring-orange-200/50 pointer-events-none z-20" />
                            )}
                            
                            {/* Image reveals WITHIN the glow - starts blurred and fades in */}
                            <img
                              src={generatedImage}
                              className={`w-full h-auto object-contain rounded-lg border-2 border-white shadow-inner relative z-10 ${viewingPastTryOn ? '' : 'image-reveal-animation'}`}
                              alt="Try-on result"
                              loading="eager"
                            />
                          </div>
                        </div>

                        {/* Past try-on timestamp */}
                        {viewingPastTryOn && viewingHistoryItem && (
                          <div className="relative z-10 flex items-center gap-2 text-sm text-orange-600 mb-2">
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
                            className="relative z-10 mt-4 text-xs text-gray-600 hover:text-gray-800 transition-colors duration-200 flex items-center gap-1.5 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 rounded"
                            aria-label="Try again"
                            type="button"
                            style={{ animation: 'fadeInSlow 0.8s ease-out 2s forwards', opacity: 0 }}
                          >
                            <RotateCcw size={12} className="group-hover:rotate-180 transition-transform duration-300" />
                            <span>Not perfect? Try again</span>
                          </button>
                        )}
                      </div>
                    )}

                    {error && (
                      <div className="w-full h-full flex flex-col items-center justify-center p-6 sm:p-8 text-center" role="alert">
                        <div className="bg-red-50 border-2 border-red-200 rounded-lg p-6 sm:p-8 max-w-md w-full">
                          <div className="flex flex-col items-center gap-4">
                            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-red-100 flex items-center justify-center" aria-hidden="true">
                              <AlertCircle className="w-8 h-8 sm:w-10 sm:h-10 text-red-600" strokeWidth={2} />
                            </div>
                            <div className="space-y-2">
                              <h3 className="text-base sm:text-lg font-semibold text-red-900">
                                Oops! Something went wrong
                              </h3>
                              <p className="text-sm sm:text-base text-red-800 leading-relaxed">
                                {error}
                              </p>
                              <p className="text-xs sm:text-sm text-red-700 mt-2">
                                Please try uploading a different photo or check your internet connection.
                              </p>
                            </div>
                            <button
                              onClick={handleReset}
                              className="mt-2 px-6 py-2.5 sm:px-8 sm:py-3 bg-red-600 hover:bg-red-700 text-white rounded-md text-sm sm:text-base font-medium transition-colors flex items-center gap-2 shadow-sm hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
                              aria-label="Start over and try again"
                              type="button"
                            >
                              <RotateCcw size={16} />
                              Start over
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
              <div className="border-t border-gray-100 px-4 sm:px-6 md:px-8 py-4 sm:py-5">
                {/* Only show size selection if sizes are available */}
                {sizes.length > 0 && (
                  <div ref={sizeSelectionRef} className="flex flex-wrap justify-center items-center gap-1.5 sm:gap-2 mb-3 sm:mb-4">
                    <span className="text-xs sm:text-sm text-gray-700 mr-0.5 sm:mr-1 self-center">Size:</span>
                    {sizes.map((size) => {
                      const sizeInfo = sizeAvailability.find(s => s.size === size);
                      const isAvailable = sizeInfo?.isAvailable ?? false;
                      const isSelected = selectedSize === size;
                      // Disable size selection until generation is complete
                      const isDisabled = step !== 'complete';
                      
                      return (
                        <button
                          key={size}
                          onClick={() => {
                            if (!isDisabled) {
                              setSelectedSize(size);
                              // Auto-scroll/focus to add to cart button after size selection
                              setTimeout(() => {
                                scrollToElement(addToCartButtonRef, 20);
                                focusElement(addToCartButtonRef, 400);
                              }, 300);
                            }
                          }}
                          disabled={isDisabled}
                          className={`w-8 h-8 sm:w-10 sm:h-10 rounded-md border text-xs sm:text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 ${
                            isDisabled
                              ? 'bg-gray-100 text-gray-300 border-gray-200 cursor-not-allowed opacity-50'
                              : !isAvailable
                              ? 'bg-gray-50 text-gray-700 border-gray-300 opacity-75 shadow-sm'
                              : isSelected
                              ? 'bg-black text-white border-black shadow-md md:shadow-lg'
                              : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400 shadow-sm md:shadow-md hover:shadow-md md:hover:shadow-lg'
                          }`}
                          aria-label={`Select size ${size}${!isAvailable ? ' (out of stock)' : ''}${isDisabled ? ' (disabled until generation complete)' : ''}`}
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
                      }
                      return null;
                    })()}
                  </div>
                )}

                <button
                  ref={step === 'idle' ? generateButtonRef : step === 'complete' ? addToCartButtonRef : undefined}
                  onClick={btnState.action}
                  disabled={btnState.disabled}
                  className={`w-full h-12 rounded-md flex items-center justify-center gap-2 font-semibold text-base transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 ${
                    btnState.disabled
                      ? 'bg-gray-300 cursor-not-allowed text-white'
                      : btnState.color === 'orange'
                      ? 'bg-orange-500 hover:bg-orange-600 text-white shadow-md md:shadow-lg hover:shadow-lg md:hover:shadow-xl'
                      : 'bg-gray-500 hover:bg-gray-600 text-white shadow-md md:shadow-lg hover:shadow-lg md:hover:shadow-xl'
                  }`}
                  aria-label={btnState.text}
                  type="button"
                >
                  {step === 'generating' ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Generating...</span>
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
                    {!viewingPastTryOn && (
                      <>
                        <p className="text-center text-xs text-gray-700 mt-2">
                          Free shipping on orders over €50
                        </p>
                        <button
                          onClick={handleReset}
                          className="text-center text-sm text-orange-600 hover:text-orange-700 underline mt-1 mx-auto block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 rounded"
                          type="button"
                        >
                          Try another photo
                        </button>
                      </>
                    )}
                    {viewingPastTryOn && (
                      <p className="text-center text-xs text-gray-700 mt-2">
                        This item is still available!
                      </p>
                    )}
                    <p className="text-center text-[10px] text-gray-600 mt-2 px-2">
                      Rendered for aesthetic purposes. Does not reflect actual dimensions.
                    </p>
                  </>
                )}

                {step !== 'generating' && step !== 'complete' && (
                  <p className="text-center text-[10px] text-gray-600 mt-2 px-2">
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
                  <div className="flex gap-3">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="flex-shrink-0 h-14 w-14 rounded-md bg-gray-200 animate-pulse" />
                    ))}
                  </div>
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
                            handleHistoryItemSelect(item);
                          })}
                          onClick={() => {
                            // Only handle click if not on touch device (touch events handle touch devices)
                            if (!('ontouchstart' in window)) {
                              handleHistoryItemSelect(item);
                            }
                          }}
                          className={`flex-shrink-0 h-14 rounded-md border-2 transition-all flex items-center justify-center bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 ${
                            isSelected
                              ? 'border-orange-500 ring-2 ring-orange-100 scale-105 shadow-md md:shadow-lg'
                              : 'border-transparent hover:border-gray-200 shadow-sm md:shadow-md hover:shadow-md md:hover:shadow-lg'
                          }`}
                          aria-label={`Select try-on result ${item.id}`}
                          type="button"
                        >
                          <img 
                            src={getProxiedImageUrl(item.image)} 
                            alt={`Try-on history ${item.id}`} 
                            className="h-full w-auto object-contain border-2 border-white rounded-md shadow-sm" 
                            onError={(e) => {
                              // Fallback to direct URL if proxy fails
                              if ((e.target as HTMLImageElement).src !== item.image) {
                                (e.target as HTMLImageElement).src = item.image;
                              }
                            }}
                          />
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
                      className="flex-shrink-0 h-14 w-14 border-2 border-dashed border-gray-300 rounded-md flex flex-col items-center justify-center bg-white hover:bg-orange-50 hover:border-orange-400 transition-all duration-200 group cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 shadow-sm md:shadow-md hover:shadow-md md:hover:shadow-lg"
                      aria-label="Upload new photo for try-on"
                      type="button"
                    >
                      <Upload 
                        size={18} 
                        className="text-gray-400 group-hover:text-orange-500 transition-colors duration-200" 
                        strokeWidth={2}
                      />
                      <span className="text-[9px] text-gray-400 group-hover:text-orange-500 font-medium mt-0.5 transition-colors duration-200">
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
                      className="flex flex-col items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-md bg-white hover:bg-orange-50 hover:border-orange-400 transition-all duration-200 group cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 shadow-sm md:shadow-md hover:shadow-md md:hover:shadow-lg"
                      aria-label="Upload photo to start try-on"
                      type="button"
                    >
                      <Upload 
                        size={20} 
                        className="text-gray-400 group-hover:text-orange-500 transition-colors duration-200" 
                        strokeWidth={2}
                      />
                      <span className="text-xs text-gray-500 group-hover:text-orange-600 font-medium transition-colors duration-200">
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

