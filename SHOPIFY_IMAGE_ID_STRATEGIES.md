# Strategies to Get Unique Identifiers (clothingKey) for Shopify Images

This document outlines multiple approaches to extract unique identifiers for each product image from Shopify, which can be used as the `clothingKey` parameter.

## Overview

Each Shopify product image has a unique identifier that can be used to track which images have already been generated. Here are the available methods, ordered by reliability:

---

## Method 1: Extract from Shopify Product JSON (Script Tags) ⭐ **RECOMMENDED**

**Location**: `script[type="application/json"]` tags in the page

**Shopify 2.0 Themes** include product data with media IDs:

```javascript
// Example structure in script tag:
{
  "product": {
    "id": 632910392,
    "media": [
      {
        "id": 850703190,  // ← Unique media ID
        "media_type": "image",
        "preview": {
          "image": {
            "src": "https://cdn.shopify.com/.../image1.jpg"
          }
        }
      },
      {
        "id": 850703191,  // ← Another unique media ID
        "media_type": "image",
        "src": "https://cdn.shopify.com/.../image2.jpg"
      }
    ]
  }
}
```

**Implementation Steps**:
1. Parse `script[type="application/json"]` tags
2. Look for `data.product.media` array
3. Extract `media[i].id` for each image
4. Map image URL to media ID

**Code Location**: `src/utils/shopifyIntegration.ts` - `extractShopifyProductJSON()` function already exists but doesn't extract IDs yet.

---

## Method 2: Extract from window.Shopify.product (Legacy Themes)

**Location**: Global `window.Shopify.product` object

**Structure**:
```javascript
window.Shopify.product = {
  id: 632910392,
  media: [
    {
      id: 850703190,  // ← Unique media ID
      media_type: "image",
      src: "https://cdn.shopify.com/.../image1.jpg"
    }
  ],
  // OR legacy format:
  images: [
    {
      id: 850703190,  // ← May or may not be present
      src: "https://cdn.shopify.com/.../image1.jpg"
    }
  ]
}
```

**Implementation**: Check `window.Shopify.product.media` or `window.Shopify.product.images` for ID fields.

---

## Method 3: Extract from NUSENSE_PRODUCT_DATA (Liquid Template) ⭐ **EASIEST TO IMPLEMENT**

**Current State**: The Liquid template in `extensions/theme-app-extension/snippets/nusense-tryon-script.liquid` currently only extracts image URLs.

**Enhancement Needed**: Modify the Liquid template to include media IDs:

```liquid
window.NUSENSE_PRODUCT_DATA = {
  id: {{ product.id }},
  images: [
    {% for media_item in product_images_from_media limit: 20 %}
      {
        id: {{ media_item.id }},  // ← Add this
        url: "{{ media_item | image_url: width: 1200 }}"
      }{% unless forloop.last %},{% endunless %}
    {% endfor %}
  ]
}
```

**Benefits**:
- Most reliable (server-side rendered)
- Already being used by the widget
- Easy to implement
- Works across all Shopify themes

---

## Method 4: Extract from DOM Data Attributes

**Location**: Image elements or their parent containers

**Common Data Attributes**:
- `data-product-id` - Product ID
- `data-variant-id` - Variant ID (if image is variant-specific)
- `data-media-id` - Media ID (Shopify 2.0 themes)
- `data-image-id` - Image ID (legacy themes)

**Example HTML**:
```html
<img 
  src="https://cdn.shopify.com/.../image.jpg"
  data-media-id="850703190"
  data-product-id="632910392"
/>
```

**Implementation**: Query image elements and check for these data attributes.

---

## Method 5: Extract from Image URL Pattern

**Shopify CDN URLs** sometimes contain identifiers in the path:

```
https://cdn.shopify.com/s/files/1/1234/5678/products/image_850703190.jpg
                                                      ^^^^^^^^^^
                                                      Potential ID
```

**Note**: This is unreliable as URL patterns vary and IDs may not always be present.

---

## Method 6: Use Shopify Admin API (Server-Side)

**Endpoint**: `GET /admin/api/2024-07/products/{product_id}/images.json`

**Response**:
```json
{
  "images": [
    {
      "id": 850703190,  // ← Unique image ID
      "product_id": 632910392,
      "src": "https://cdn.shopify.com/.../image1.jpg",
      "admin_graphql_api_id": "gid://shopify/ProductImage/850703190"
    }
  ]
}
```

**Limitations**:
- Requires server-side implementation
- Needs OAuth authentication
- Not available in client-side widget context

---

## ✅ **RECOMMENDED FOR YOUR APP: Method 3 (Liquid Template)**

**Why This Is The Best Method For Your Implementation:**

1. ✅ **Already Your Priority 1** - Your code already uses `NUSENSE_PRODUCT_DATA` from Liquid as the primary source (line 582-592)
2. ✅ **Works With ALL Shopify Themes** - Uses Shopify's standard Liquid objects:
   - `product.media` for Shopify 2.0 themes (Dawn, etc.)
   - `product.images` for legacy themes (fallback)
3. ✅ **Server-Side Rendered** - Always available, no dependency on client-side JavaScript
4. ✅ **Direct Access to IDs** - `product.media[].id` is available in Liquid
5. ✅ **Theme-Independent** - Doesn't rely on theme-specific script tags or DOM structure

**Your Current Implementation Priority:**
```
Priority 1: NUSENSE_PRODUCT_DATA (Liquid) ← BEST (Method 3)
Priority 2: Theme script tags (Method 1) ← Fallback
Priority 3: DOM extraction ← Last resort
```

## Recommended Implementation Strategy

### Phase 1: Enhance Liquid Template (Easiest & Most Reliable) ⭐ **DO THIS FIRST**

**File**: `extensions/theme-app-extension/snippets/nusense-tryon-script.liquid`

**Current Code (lines 32-53)**: Only extracts image URLs
**Enhancement Needed**: Include media IDs

**Changes**:
1. Modify `NUSENSE_PRODUCT_DATA` to include image objects with IDs:
   ```liquid
   images: [
     {% comment %} Shopify 2.0 themes - product.media {% endcomment %}
     {% if product_images_from_media.size > 0 %}
       {% for media_item in product_images_from_media limit: 20 %}
         {% assign image_url_full = media_item | image_url: width: 1200 %}
         {% unless image_url_full contains '://' %}
           {% assign image_url_full = 'https:' | append: image_url_full %}
         {% endunless %}
         {
           id: {{ media_item.id }},
           url: "{{ image_url_full }}"
         }{% unless forloop.last %},{% endunless %}
       {% endfor %}
     {% else %}
       {% comment %} Legacy themes - product.images {% endcomment %}
       {% for image in product.images limit: 20 %}
         {% assign image_url_full = image | image_url: width: 1200 %}
         {% unless image_url_full contains '://' %}
           {% assign image_url_full = 'https:' | append: image_url_full %}
         {% endunless %}
         {
           id: {{ image.id }},
           url: "{{ image_url_full }}"
         }{% unless forloop.last %},{% endunless %}
       {% endfor %}
     {% endif %}
   ],
   ```

2. Update TypeScript types to handle image objects:
   ```typescript
   interface ImageWithId {
     id: number;
     url: string;
   }
   ```

### Phase 2: Fallback to Script Tag Parsing

**File**: `src/utils/shopifyIntegration.ts`

**Enhancement**: Modify `extractShopifyProductJSON()` to return image-to-ID mapping:
```typescript
interface ImageWithId {
  url: string;
  id?: number;
}

function extractShopifyProductJSON(): {
  productId?: number;
  images: ImageWithId[];
} | null {
  // Parse script tags and extract media IDs
  // Map image URLs to their IDs
}
```

### Phase 3: Update ClothingSelection Component

**File**: `src/components/ClothingSelection.tsx`

**Changes**:
1. Accept image objects with IDs instead of just URLs
2. Pass both URL and ID when selecting an image
3. Store ID mapping for later use

### Phase 4: Update TryOnWidget to Use clothingKey

**File**: `src/components/TryOnWidget.tsx`

**Changes**:
1. Maintain a mapping of image URL → image ID
2. When generating, look up the ID for the selected clothing image
3. Pass `clothingKey` to `generateTryOn()` function

---

## Implementation Priority (For Your App)

1. **✅ HIGHEST**: Enhance Liquid template (Method 3) 
   - **Already your Priority 1 implementation**
   - Works with ALL Shopify themes (2.0 and legacy)
   - Server-side rendered, always reliable
   - Direct access to media IDs from Shopify
   - **This is the method you should use**

2. **MEDIUM**: Keep existing fallbacks (Method 1 & DOM extraction)
   - Already implemented in your code
   - Good for edge cases where Liquid data might not be available
   - No changes needed here

3. **NOT NEEDED**: DOM data attributes (Method 4) - Too theme-dependent
4. **NOT NEEDED**: URL pattern extraction (Method 5) - Unreliable

---

## Example Code Structure

After implementation, the data flow should be:

```
Liquid Template
  ↓
NUSENSE_PRODUCT_DATA = {
  images: [
    { id: 850703190, url: "https://..." },
    { id: 850703191, url: "https://..." }
  ]
}
  ↓
TryOnWidget receives images with IDs
  ↓
User selects image → Get ID from mapping
  ↓
generateTryOn(personBlob, clothingBlob, storeName, clothingKey: "850703190")
```

---

## Notes

- **Product ID vs Image ID**: 
  - Product ID identifies the product (e.g., `632910392`)
  - Image/Media ID identifies the specific image (e.g., `850703190`)
  - Use **Image ID** as `clothingKey` for unique image tracking

- **Variant-Specific Images**: Some images may be associated with specific variants. The media ID is still unique per image.

- **Backward Compatibility**: Ensure the implementation works even when IDs are not available (fallback to URL-based tracking if needed).

