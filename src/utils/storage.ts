import { CartItem, ProductInfo } from "@/types/tryon";

const STORAGE_KEYS = {
  UPLOADED_IMAGE: "nusense_tryon_uploaded_image",
  GENERATED_IMAGE: "nusense_tryon_generated_image",
  SELECTED_CLOTHING_URL: "nusense_tryon_selected_clothing_url",
  LAST_SESSION_DATA: "nusense_tryon_last_session",
  CART_ITEMS: "nusense_tryon_cart_items",
  PRODUCT_INFO: "nusense_tryon_product_info",
} as const;

const inMemoryFallback = new Map<string, string>();

function isQuotaExceeded(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const err = error as DOMException & { code?: number };
  return (
    err.name === "QuotaExceededError" ||
    err.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
    err.code === 22 ||
    err.code === 1014
  );
}

function safeSetItem(key: string, value: string) {
  if (typeof window === "undefined") {
    inMemoryFallback.set(key, value);
    return;
  }

  try {
    window.localStorage.setItem(key, value);
    inMemoryFallback.set(key, value);
    return;
  } catch (error) {
    if (isQuotaExceeded(error)) {
      // Remove the heaviest entries we store before retrying.
      // IMPORTANT: Never remove UPLOADED_IMAGE when saving GENERATED_IMAGE.
      // The uploaded image must persist so users don't lose their photo after generation.
      let heavyKeys = [
        STORAGE_KEYS.GENERATED_IMAGE,
        STORAGE_KEYS.LAST_SESSION_DATA,
        STORAGE_KEYS.CART_ITEMS,
      ];

      // Only include UPLOADED_IMAGE in removable items if we're NOT saving GENERATED_IMAGE.
      // This ensures the uploaded image persists even when saving generated results.
      if (key !== STORAGE_KEYS.GENERATED_IMAGE) {
        heavyKeys.push(STORAGE_KEYS.UPLOADED_IMAGE);
      }

      // Filter out the key we're trying to save (never remove what we're saving)
      heavyKeys = heavyKeys.filter((heavyKey) => heavyKey !== key);

      heavyKeys.forEach((heavyKey) => {
        try {
          window.localStorage.removeItem(heavyKey);
        } catch {
          // Ignore removal failures – we'll still fall back to memory storage.
        }
      });

      try {
        window.localStorage.setItem(key, value);
      } catch {
        // Persist to memory fallback so the app can continue working even without localStorage.
      }
    }

    // Always update fallback so callers can still read the latest value.
    inMemoryFallback.set(key, value);
  }
}

function safeGetItem(key: string) {
  if (typeof window === "undefined") {
    return inMemoryFallback.get(key) ?? null;
  }

  try {
    const value = window.localStorage.getItem(key);
    if (value !== null) {
      // Keep fallback in sync with the persisted value.
      inMemoryFallback.set(key, value);
      return value;
    } else {
      // Ensure fallback mirrors the absence of the key.
      inMemoryFallback.delete(key);
      return null;
    }
  } catch {
    // Ignore read errors and fall back to memory.
  }

  return inMemoryFallback.get(key) ?? null;
}

function safeRemoveItem(key: string) {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Ignore removal failures – fallback covers us.
    }
  }
  inMemoryFallback.delete(key);
}

export const storage = {
  clearSession(): void {
    safeRemoveItem(STORAGE_KEYS.LAST_SESSION_DATA);
    safeRemoveItem(STORAGE_KEYS.UPLOADED_IMAGE);
    safeRemoveItem(STORAGE_KEYS.GENERATED_IMAGE);
    safeRemoveItem(STORAGE_KEYS.SELECTED_CLOTHING_URL);
  },

  // Image storage
  saveUploadedImage(dataURL: string): void {
    safeSetItem(STORAGE_KEYS.UPLOADED_IMAGE, dataURL);
  },

  clearUploadedImage(): void {
    safeRemoveItem(STORAGE_KEYS.UPLOADED_IMAGE);
  },

  getUploadedImage(): string | null {
    return safeGetItem(STORAGE_KEYS.UPLOADED_IMAGE);
  },

  saveGeneratedImage(dataURL: string): void {
    safeSetItem(STORAGE_KEYS.GENERATED_IMAGE, dataURL);
  },

  getGeneratedImage(): string | null {
    return safeGetItem(STORAGE_KEYS.GENERATED_IMAGE);
  },

  saveClothingUrl(url: string): void {
    safeSetItem(STORAGE_KEYS.SELECTED_CLOTHING_URL, url);
  },

  clearClothingUrl(): void {
    safeRemoveItem(STORAGE_KEYS.SELECTED_CLOTHING_URL);
  },

  getClothingUrl(): string | null {
    return safeGetItem(STORAGE_KEYS.SELECTED_CLOTHING_URL);
  },

  // Cart management
  getCartItems(): CartItem[] {
    const data = safeGetItem(STORAGE_KEYS.CART_ITEMS);
    return data ? JSON.parse(data) : [];
  },

  saveCartItems(items: CartItem[]): void {
    safeSetItem(STORAGE_KEYS.CART_ITEMS, JSON.stringify(items));
  },

  addToCart(product: ProductInfo): void {
    const items = this.getCartItems();
    const existingItem = items.find(item => item.id === product.id);

    if (existingItem) {
      existingItem.quantity += 1;
    } else {
      items.push({
        ...product,
        quantity: 1,
        timestamp: Date.now(),
      });
    }

    this.saveCartItems(items);
  },

  removeFromCart(productId: string): void {
    const items = this.getCartItems().filter(item => item.id !== productId);
    this.saveCartItems(items);
  },

  updateCartItemQuantity(productId: string, quantity: number): void {
    const items = this.getCartItems();
    const item = items.find(i => i.id === productId);
    if (item) {
      item.quantity = quantity;
      this.saveCartItems(items);
    }
  },

  clearCart(): void {
    safeRemoveItem(STORAGE_KEYS.CART_ITEMS);
  },

  // Product info
  saveProductInfo(product: ProductInfo): void {
    safeSetItem(STORAGE_KEYS.PRODUCT_INFO, JSON.stringify(product));
  },

  getProductInfo(): ProductInfo | null {
    const data = safeGetItem(STORAGE_KEYS.PRODUCT_INFO);
    return data ? JSON.parse(data) : null;
  },
};
