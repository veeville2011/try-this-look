# Test Product Data Configuration

This directory contains test product data for local testing of the Virtual Try-On widget at `/widget-test` route.

## Overview

The test product data is configured to simulate a real Shopify product page integration, allowing you to test all UI functionality without requiring an actual Shopify store connection.

## Product Used

**Product:** Fila Women's Color Block Logo T-Shirt  
**Store:** vto-demo.myshopify.com  
**Product URL:** https://vto-demo.myshopify.com/products/fila-women-s-color-block-logo-t-shirt?variant=45120949977132

## Configuration Files

- `testProductData.ts` - Contains test product data, images, variants, and initialization functions

## How It Works

1. When you navigate to `/widget-test`, the `NewWidget.tsx` component detects the route
2. It initializes test product data using `initializeTestProductData()`
3. The test data is injected into `window.NUSENSE_PRODUCT_DATA` and `window.NUSENSE_TEST_PRODUCT_IMAGES`
4. `VirtualTryOnModal` detects and uses this test data when not in an iframe
5. All product images, sizes, and product information are loaded from the test data

## Updating Product Images

To use actual product images from the Shopify store:

1. Open the product page: https://vto-demo.myshopify.com/products/fila-women-s-color-block-logo-t-shirt?variant=45120949977132
2. Right-click on each product image → Inspect Element
3. Find the `<img>` tag and copy the `src` URL
4. Replace the placeholder URLs in `testProductData.ts`:
   ```typescript
   export const TEST_PRODUCT_IMAGES: ProductImage[] = [
     {
       id: '45120949977132',
       url: 'PASTE_ACTUAL_IMAGE_URL_HERE'
     },
     // ... more images
   ];
   ```

## Testing Features

With this test configuration, you can test:

- ✅ Product image display and selection
- ✅ Size selection (XS, S, M, L, XL, XXL)
- ✅ Product information display
- ✅ Image generation flow
- ✅ History viewing
- ✅ All UI components and interactions
- ✅ Cart functionality (if integrated)
- ✅ Responsive design

## API Integration

The test data simulates the following API responses:

- **Product Data:** `NUSENSE_PRODUCT_DATA` message
- **Product Images:** `NUSENSE_PRODUCT_IMAGES` message
- **Store Info:** Test store information

## Notes

- This configuration only works on `/widget-test` route
- In production, product data comes from the actual Shopify product page
- Test images use placeholder URLs by default - replace with actual URLs for realistic testing
- All variant information is included for proper size extraction

## Troubleshooting

If product images don't load:
1. Check browser console for CORS errors
2. Verify image URLs are accessible
3. Ensure placeholder URLs are replaced with actual Shopify CDN URLs

If sizes don't appear:
1. Verify `variants.nodes` structure in `TEST_PRODUCT_DATA`
2. Check that `selectedOptions` includes `{ name: 'Size', value: '...' }`

