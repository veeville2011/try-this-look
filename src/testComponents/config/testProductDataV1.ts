/**
 * Test Product Data Configuration for /widget-test-v1 route
 * This file contains sample product data from:
 * https://vto-demo.myshopify.com/products/fila-women-s-color-block-logo-t-shirt?variant=45120949977132
 * 
 * This allows testing the Virtual Try-On widget UI locally without requiring
 * actual Shopify product page integration.
 */

import type { ProductInfo, ProductImage } from '@/types/tryon';

/**
 * Sample product images from Fila Women's Color Block Logo T-Shirt
 * 
 * NOTE: Replace these placeholder URLs with actual product image URLs from:
 * https://vto-demo.myshopify.com/products/fila-women-s-color-block-logo-t-shirt?variant=45120949977132
 * 
 * To get actual image URLs:
 * 1. Open the product page in browser
 * 2. Right-click on product images → Inspect Element
 * 3. Find the <img> tag and copy the src URL
 * 4. Replace the URLs below with actual image URLs
 * 
 * For testing, you can also use placeholder image services like:
 * - https://via.placeholder.com/800x1000 (for product images)
 * - Or any valid image URL
 */
/**
 * Sample product images from Fila Women's Color Block Logo T-Shirt
 * Using actual product image URLs from the Shopify store
 */
export const TEST_PRODUCT_IMAGES: ProductImage[] = [
  {
    id: '45120949977132',
    url: 'https://vto-demo.myshopify.com/cdn/shop/files/00076_00_90371a80-d70c-4eb4-9c70-3694707fee40.jpg?v=1765799997&width=1200'
  },
  {
    id: '45120949977133',
    url: 'https://vto-demo.myshopify.com/cdn/shop/files/00076_00_90371a80-d70c-4eb4-9c70-3694707fee40.jpg?v=1765799997&width=1200'
  },
  {
    id: '45120949977134',
    url: 'https://vto-demo.myshopify.com/cdn/shop/files/00076_00_90371a80-d70c-4eb4-9c70-3694707fee40.jpg?v=1765799997&width=1200'
  }
];

/**
 * Sample product data matching Shopify product structure
 * Based on Fila Women's Color Block Logo T-Shirt
 * 
 * NOTE: This includes variants structure so sizes can be extracted correctly
 */
export const TEST_PRODUCT_DATA: ProductInfo & {
  variants?: {
    nodes?: Array<{
      id: string;
      title: string;
      price: string;
      availableForSale: boolean;
      selectedOptions?: Array<{
        name: string;
        value: string;
      }>;
      options?: Array<{
        name: string;
        value: string;
      }>;
    }>;
  };
} = {
  id: 'gid://shopify/Product/123456789',
  name: "Fila Women's Color Block Logo T-Shirt",
  price: 29.99,
  image: TEST_PRODUCT_IMAGES[0]?.url || 'https://vto-demo.myshopify.com/cdn/shop/files/00076_00_90371a80-d70c-4eb4-9c70-3694707fee40.jpg?v=1765799997&width=1200',
  url: 'https://vto-demo.myshopify.com/products/fila-women-s-color-block-logo-t-shirt?variant=45120949977132',
  description: 'Classic comfort meets modern style in this Fila color block logo t-shirt. Made from soft, breathable cotton blend fabric, this tee features the iconic Fila logo in a bold color block design. Perfect for casual wear or layering.',
  brand: 'Fila',
  category: 'T-Shirts',
  availability: 'InStock',
  rating: 4.5,
  material: 'Cotton Blend',
  sizes: 'XS, S, M, L, XL, XXL',
  colors: 'White/Blue, Black/Red',
  // Include variants structure for size extraction
  variants: {
    nodes: [
      {
        id: 'gid://shopify/ProductVariant/45120949977132',
        title: 'XS / White/Blue',
        price: '29.99',
        availableForSale: true,
        selectedOptions: [
          { name: 'Size', value: 'XS' },
          { name: 'Color', value: 'White/Blue' }
        ]
      },
      {
        id: 'gid://shopify/ProductVariant/45120949977133',
        title: 'S / White/Blue',
        price: '29.99',
        availableForSale: true,
        selectedOptions: [
          { name: 'Size', value: 'S' },
          { name: 'Color', value: 'White/Blue' }
        ]
      },
      {
        id: 'gid://shopify/ProductVariant/45120949977134',
        title: 'M / White/Blue',
        price: '29.99',
        availableForSale: true,
        selectedOptions: [
          { name: 'Size', value: 'M' },
          { name: 'Color', value: 'White/Blue' }
        ]
      },
      {
        id: 'gid://shopify/ProductVariant/45120949977135',
        title: 'L / White/Blue',
        price: '29.99',
        availableForSale: true,
        selectedOptions: [
          { name: 'Size', value: 'L' },
          { name: 'Color', value: 'White/Blue' }
        ]
      },
      {
        id: 'gid://shopify/ProductVariant/45120949977136',
        title: 'XL / White/Blue',
        price: '29.99',
        availableForSale: true,
        selectedOptions: [
          { name: 'Size', value: 'XL' },
          { name: 'Color', value: 'White/Blue' }
        ]
      },
      {
        id: 'gid://shopify/ProductVariant/45120949977137',
        title: 'XXL / White/Blue',
        price: '29.99',
        availableForSale: false,
        selectedOptions: [
          { name: 'Size', value: 'XXL' },
          { name: 'Color', value: 'White/Blue' }
        ]
      }
    ]
  }
};

/**
 * Store info for test environment
 */
export const TEST_STORE_INFO = {
  shop: 'vto-demo',
  domain: 'vto-demo.myshopify.com',
  method: 'test' as const,
  origin: typeof window !== 'undefined' ? window.location.origin : ''
};

/**
 * Variant information for testing
 */
export const TEST_VARIANTS = [
  {
    id: '45120949977132',
    title: 'XS / White/Blue',
    price: '29.99',
    available: true,
    inventory_quantity: 10
  },
  {
    id: '45120949977133',
    title: 'S / White/Blue',
    price: '29.99',
    available: true,
    inventory_quantity: 15
  },
  {
    id: '45120949977134',
    title: 'M / White/Blue',
    price: '29.99',
    available: true,
    inventory_quantity: 20
  },
  {
    id: '45120949977135',
    title: 'L / White/Blue',
    price: '29.99',
    available: true,
    inventory_quantity: 12
  },
  {
    id: '45120949977136',
    title: 'XL / White/Blue',
    price: '29.99',
    available: true,
    inventory_quantity: 8
  },
  {
    id: '45120949977137',
    title: 'XXL / White/Blue',
    price: '29.99',
    available: false,
    inventory_quantity: 0
  }
];

/**
 * Check if we're running on localhost
 */
export const isLocalhost = (): boolean => {
  if (typeof window === 'undefined') return false;
  const hostname = window.location.hostname;
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]' || hostname.endsWith('.local');
};

/**
 * Check if we're on the /widget-test-v1 path (regardless of environment)
 * Used for enabling features like person detection in both localhost and production
 */
export const isWidgetTestPath = (): boolean => {
  if (typeof window === 'undefined') return false;
  return window.location.pathname === '/widget-test-v1' || window.location.pathname.includes('/widget-test-v1');
};

/**
 * Check if we're on the /widget-test-v1 route AND running on localhost
 * Test data should only be used in localhost environment
 */
export const isWidgetTestRoute = (): boolean => {
  if (typeof window === 'undefined') return false;
  return isWidgetTestPath() && isLocalhost();
};

/**
 * Initialize test product data for /widget-test-v1 route
 * This sets up the product data in a way that VirtualTryOnModal can use it
 */
export const initializeTestProductData = (): {
  productData: ProductInfo;
  productImages: ProductImage[];
  storeInfo: typeof TEST_STORE_INFO;
} => {
  return {
    productData: TEST_PRODUCT_DATA,
    productImages: TEST_PRODUCT_IMAGES,
    storeInfo: TEST_STORE_INFO
  };
};

