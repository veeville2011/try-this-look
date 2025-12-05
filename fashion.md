# Fashion Try-On API Documentation

This document provides complete API documentation for all fashion try-on endpoints. Use this guide to integrate the fashion try-on features into your frontend application.

---

## Base URL

```
Production: https://try-this-look.vercel.app
Local: http://localhost:3000
```

---

## Table of Contents

1. [Single Fashion Photo Generation](#1-single-fashion-photo-generation)
2. [Cart Fashion Photos Generation (Batch)](#2-cart-fashion-photos-generation-batch)
3. [Complete Outfit Look Generation](#3-complete-outfit-look-generation)

---

## 1. Single Fashion Photo Generation

Generates a single image of a person wearing one garment item.

### Endpoint

```
POST /api/fashion-photo
```

### Content-Type

```
multipart/form-data
```

### Authentication

Requires shop access token (retrieved automatically using shop parameter)

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `shop` | string | Yes | Shop domain (e.g., `vto-demo` or `vto-demo.myshopify.com`). Required for credit tracking. |

### Request Body (Form Data)

| Parameter | Type | Required | Description | Constraints |
|-----------|------|----------|-------------|-------------|
| `personImage` | File | ✅ Yes | Person image file | Max 10MB, JPEG/PNG/WebP/AVIF |
| `clothingImage` | File | ❌ No | Clothing/garment image file | Max 10MB, JPEG/PNG/WebP/AVIF |
| `personKey` | string | ❌ No | Unique key for person image (for caching) | - |
| `clothingKey` | string | ❌ No | Unique key for clothing image (for caching) | - |
| `name` | string | ❌ No | Name for tracking | - |
| `email` | string | ❌ No | Email for tracking | - |
| `storeName` | string | ❌ No | Shop domain (fallback if shop query param not provided) | - |

### Example Request

```javascript
const formData = new FormData();
formData.append('personImage', personImageFile);
formData.append('clothingImage', clothingImageFile);
formData.append('personKey', 'person-123');
formData.append('clothingKey', 'shirt-456');
formData.append('shop', 'vto-demo.myshopify.com');

const response = await fetch('https://try-this-look.vercel.app/api/fashion-photo?shop=vto-demo.myshopify.com', {
  method: 'POST',
  body: formData
});
```

### Success Response (200 OK)

```json
{
  "success": true,
  "data": {
    "image": "data:image/png;base64,iVBORw0KG...",
    "imageUrl": "https://s3.amazonaws.com/.../generated-123.png",
    "personImageUrl": "https://s3.amazonaws.com/.../person-123.png",
    "clothingImageUrl": "https://s3.amazonaws.com/.../clothing-456.png",
    "cached": false,
    "creditsDeducted": 1,
    "requestId": "req-abc123",
    "processingTime": 8500
  }
}
```

### Error Response (400 Bad Request)

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Missing required file: personImage",
    "details": {
      "missingFields": ["personImage"]
    }
  }
}
```

### Error Response (403 Forbidden - Insufficient Credits)

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Insufficient credits. Please purchase credits or wait for your next billing period.",
    "details": {
      "reason": "Insufficient credits",
      "creditBalance": 0,
      "creditBreakdown": {
        "trial": 0,
        "coupon": 0,
        "plan": 0,
        "purchased": 0,
        "total": 0
      }
    }
  }
}
```

### Status Codes

| Code | Description |
|------|-------------|
| 200 | Success - Image generated successfully |
| 400 | Bad Request - Validation error or missing files |
| 403 | Forbidden - Insufficient credits or no active subscription |
| 500 | Internal Server Error - Server error occurred |

### Credit Deduction

- **1 credit per generation** (for non-cached images)
- **0 credits** for cached images
- Credits are deducted in priority order: Trial → Coupon → Plan → Purchased → Overage ($0.15/credit, capped at $50/period)
- Credits are automatically refunded if generation fails

---

## 2. Cart Fashion Photos Generation (Batch)

Generates multiple images of a person wearing multiple garment items from cart. Each garment generates a separate image. Processes items in parallel for efficiency (up to 5 concurrent).

### Endpoint

```
POST /api/fashion-photo/cart
```

### Content-Type

```
multipart/form-data
```

### Authentication

Requires shop access token (retrieved automatically using shop parameter)

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `shop` | string | Yes | Shop domain (e.g., `vto-demo` or `vto-demo.myshopify.com`). Required for credit tracking. |

### Request Body (Form Data)

| Parameter | Type | Required | Description | Constraints |
|-----------|------|----------|-------------|-------------|
| `personImage` | File | ✅ Yes | Person image file | 1 file, Max 10MB, JPEG/PNG/WebP/AVIF |
| `garmentImages` | File[] | ✅ Yes | Multiple garment image files | 1-6 files, Max 10MB each |
| `personKey` | string | ❌ No | Unique key for person image (for caching) | - |
| `garmentKeys` | string | ❌ No | Comma-separated keys for each garment (for caching) | Must match number of garmentImages (e.g., `key1,key2,key3`) |
| `name` | string | ❌ No | Name for tracking | - |
| `email` | string | ❌ No | Email for tracking | - |
| `storeName` | string | ❌ No | Shop domain (fallback if shop query param not provided) | - |

**Note:** `garmentKeys` should be comma-separated string when using form-data (e.g., `"key1,key2,key3"`).

### Example Request

```javascript
const formData = new FormData();
formData.append('personImage', personImageFile);
formData.append('garmentImages', shirtFile);
formData.append('garmentImages', pantsFile);
formData.append('garmentImages', capFile);
formData.append('personKey', 'person-123');
formData.append('garmentKeys', 'shirt-456,pants-789,cap-101');

const response = await fetch('https://try-this-look.vercel.app/api/fashion-photo/cart?shop=vto-demo.myshopify.com', {
  method: 'POST',
  body: formData
});
```

### Success Response (200 OK)

```json
{
  "success": true,
  "results": [
    {
      "index": 0,
      "garmentKey": "shirt-456",
      "status": "success",
      "image": "data:image/png;base64,iVBORw0KG...",
      "imageUrl": "https://s3.amazonaws.com/.../generated-123.png",
      "garmentImageUrl": "https://s3.amazonaws.com/.../shirt-456.png",
      "cached": false,
      "creditsDeducted": 1,
      "processingTime": 8500
    },
    {
      "index": 1,
      "garmentKey": "pants-789",
      "status": "success",
      "image": "data:image/png;base64,iVBORw0KG...",
      "imageUrl": "https://s3.amazonaws.com/.../generated-124.png",
      "garmentImageUrl": "https://s3.amazonaws.com/.../pants-789.png",
      "cached": true,
      "creditsDeducted": 0,
      "processingTime": 0
    },
    {
      "index": 2,
      "garmentKey": "cap-101",
      "status": "error",
      "error": {
        "code": "PROCESSING_ERROR",
        "message": "Failed to generate image"
      },
      "creditsDeducted": 0,
      "processingTime": 0
    }
  ],
  "summary": {
    "totalGarments": 3,
    "successful": 2,
    "failed": 1,
    "cached": 1,
    "generated": 1,
    "totalCreditsDeducted": 1,
    "processingTime": 8500
  },
  "requestId": "req-cart-123456"
}
```

### Response Fields

#### Results Array

Each item in the `results` array represents one garment:

| Field | Type | Description |
|-------|------|-------------|
| `index` | number | Original index of the garment (0-based) |
| `garmentKey` | string \| null | Garment cache key (if provided) |
| `status` | string | `"success"` or `"error"` |
| `image` | string \| null | Base64-encoded image data URL (if successful) |
| `imageUrl` | string \| null | S3 URL of generated image (if successful) |
| `garmentImageUrl` | string \| null | S3 URL of input garment image |
| `cached` | boolean | Whether the result was retrieved from cache |
| `creditsDeducted` | number | Credits deducted for this item (0 or 1) |
| `processingTime` | number | Processing time in milliseconds |
| `error` | object \| null | Error details (if status is "error") |

#### Summary Object

| Field | Type | Description |
|-------|------|-------------|
| `totalGarments` | number | Total number of garments processed |
| `successful` | number | Number of successful generations |
| `failed` | number | Number of failed generations |
| `cached` | number | Number of items retrieved from cache |
| `generated` | number | Number of newly generated items |
| `totalCreditsDeducted` | number | Total credits deducted (sum of all items) |
| `processingTime` | number | Total processing time in milliseconds |

### Error Response (400 Bad Request)

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Cart generation requires between 1 and 6 garment images. You provided 0 garment(s).",
    "details": {
      "receivedCount": 0,
      "minGarments": 1,
      "maxGarments": 6
    }
  }
}
```

### Error Response (403 Forbidden - Insufficient Credits)

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Insufficient credits. Please purchase credits or wait for your next billing period.",
    "details": {
      "reason": "Insufficient credits",
      "creditBalance": 0,
      "creditBreakdown": {
        "trial": 0,
        "coupon": 0,
        "plan": 0,
        "purchased": 0,
        "total": 0
      }
    }
  }
}
```

### Status Codes

| Code | Description |
|------|-------------|
| 200 | Success - Batch processing completed (may have partial failures) |
| 400 | Bad Request - Validation error or missing files |
| 403 | Forbidden - Insufficient credits or no active subscription |
| 500 | Internal Server Error - Server error occurred |

### Credit Deduction

- **1 credit per generated image** (non-cached items only)
- **0 credits** for cached images
- Credits are deducted only for successfully generated items
- Credits are automatically refunded if generation fails
- Credits are deducted in priority order: Trial → Coupon → Plan → Purchased → Overage ($0.15/credit, capped at $50/period)

### Caching

- Uses `personKey + garmentKey` combination for caching
- Cached results are returned immediately (0 credits)
- Cache check is performed before credit deduction

### Processing Notes

- Items are processed in parallel (up to 5 concurrent) for efficiency
- Results are returned in the same order as input garments (using `index` field)
- Individual item failures do not stop the entire batch
- Each item is processed independently

---

## 3. Complete Outfit Look Generation

Generates a single image of a person wearing multiple garments together as a complete, coordinated outfit. All garments are combined into one cohesive look.

### Endpoint

```
POST /api/fashion-photo/outfit
```

### Content-Type

```
multipart/form-data
```

### Authentication

Requires shop access token (retrieved automatically using shop parameter)

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `shop` | string | Yes | Shop domain (e.g., `vto-demo` or `vto-demo.myshopify.com`). Required for credit tracking. |

### Request Body (Form Data)

| Parameter | Type | Required | Description | Constraints |
|-----------|------|----------|-------------|-------------|
| `personImage` | File | ✅ Yes | Person image file | 1 file, Max 10MB, JPEG/PNG/WebP/AVIF |
| `garmentImages` | File[] | ✅ Yes | Multiple garment image files | 2-8 files, Max 10MB each |
| `garmentTypes` | string | ❌ No | Comma-separated garment types | Must match number of garmentImages (e.g., `"shirt,pants,cap,shoes"`) |
| `personKey` | string | ❌ No | Unique key for person image (for caching) | - |
| `garmentKeys` | string | ❌ No | Comma-separated keys for each garment (for caching) | Must match number of garmentImages (e.g., `"shirt-456,pants-789,cap-101"`) |
| `name` | string | ❌ No | Name for tracking | - |
| `email` | string | ❌ No | Email for tracking | - |
| `storeName` | string | ❌ No | Shop domain (fallback if shop query param not provided) | - |

**Notes:**
- `garmentTypes` and `garmentKeys` should be comma-separated strings when using form-data
- `garmentTypes` helps AI understand garment placement (recommended for best results)
- Valid garment types: `shirt`, `pants`, `shorts`, `dress`, `jacket`, `sweater`, `cap`, `hat`, `shoes`, `boots`, `accessories`, `belt`, `bag`, `scarf`, etc.

### Example Request

```javascript
const formData = new FormData();
formData.append('personImage', personImageFile);
formData.append('garmentImages', shirtFile);
formData.append('garmentImages', pantsFile);
formData.append('garmentImages', capFile);
formData.append('garmentImages', shoesFile);
formData.append('garmentTypes', 'shirt,pants,cap,shoes');
formData.append('personKey', 'person-123');
formData.append('garmentKeys', 'shirt-456,pants-789,cap-101,shoes-202');

const response = await fetch('https://try-this-look.vercel.app/api/fashion-photo/outfit?shop=vto-demo.myshopify.com', {
  method: 'POST',
  body: formData
});
```

### Success Response (200 OK)

```json
{
  "success": true,
  "data": {
    "image": "data:image/png;base64,iVBORw0KG...",
    "imageUrl": "https://s3.amazonaws.com/.../outfit-123.png",
    "personImageUrl": "https://s3.amazonaws.com/.../person-123.png",
    "garmentImageUrls": [
      "https://s3.amazonaws.com/.../shirt-456.png",
      "https://s3.amazonaws.com/.../pants-789.png",
      "https://s3.amazonaws.com/.../cap-101.png",
      "https://s3.amazonaws.com/.../shoes-202.png"
    ],
    "garmentTypes": ["shirt", "pants", "cap", "shoes"],
    "cached": false,
    "creditsDeducted": 1,
    "requestId": "req-outfit-123456",
    "processingTime": 12000
  }
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `image` | string | Base64-encoded image data URL of the complete outfit |
| `imageUrl` | string \| null | S3 URL of the generated outfit image |
| `personImageUrl` | string \| null | S3 URL of the input person image |
| `garmentImageUrls` | string[] | Array of S3 URLs for all input garment images |
| `garmentTypes` | string[] \| null | Array of garment types (if provided) |
| `cached` | boolean | Whether the result was retrieved from cache (currently always `false`) |
| `creditsDeducted` | number | Credits deducted for this outfit (1 credit regardless of number of garments) |
| `requestId` | string | Unique request identifier for tracking |
| `processingTime` | number | Total processing time in milliseconds |

### Error Response (400 Bad Request - Validation Error)

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Outfit generation requires at least 2 garment images. You provided 1 garment(s).",
    "details": {
      "receivedCount": 1,
      "minGarments": 2,
      "maxGarments": 8
    }
  }
}
```

### Error Response (400 Bad Request - Too Many Garments)

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Outfit generation allows at most 8 garment images. You provided 9 garments.",
    "details": {
      "receivedCount": 9,
      "minGarments": 2,
      "maxGarments": 8
    }
  }
}
```

### Error Response (403 Forbidden - Insufficient Credits)

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Insufficient credits. Please purchase credits or wait for your next billing period.",
    "details": {
      "reason": "Insufficient credits",
      "creditBalance": 0,
      "creditBreakdown": {
        "trial": 0,
        "coupon": 0,
        "plan": 0,
        "purchased": 0,
        "total": 0
      }
    }
  }
}
```

### Error Response (500 Internal Server Error)

```json
{
  "error": {
    "code": "PROCESSING_ERROR",
    "message": "Failed to generate outfit",
    "details": {
      "requestId": "req-outfit-123456",
      "originalError": "AI model processing failed"
    }
  }
}
```

### Status Codes

| Code | Description |
|------|-------------|
| 200 | Success - Outfit generated successfully |
| 400 | Bad Request - Validation error or missing/invalid files |
| 403 | Forbidden - Insufficient credits or no active subscription |
| 500 | Internal Server Error - Generation processing failed |

### Credit Deduction

- **1 credit per outfit generation** (regardless of number of garments)
- **0 credits** for cached outfits (caching not yet implemented)
- Credits are deducted upfront before generation
- Credits are automatically refunded if generation fails
- Credits are deducted in priority order: Trial → Coupon → Plan → Purchased → Overage ($0.15/credit, capped at $50/period)

### Key Differences from Cart API

| Feature | Cart API | Outfit API |
|---------|----------|------------|
| **Output** | Multiple separate images (one per garment) | Single combined outfit image |
| **Garment Range** | 1-6 garments | 2-8 garments |
| **Processing** | Parallel (up to 5 concurrent) | Single combined generation |
| **Credits** | 1 credit per generated image | 1 credit per outfit (regardless of garment count) |
| **Use Case** | Try-on multiple items individually | Create complete styled look |

### Best Practices

1. **Provide garment types** when possible for better AI understanding:
   ```javascript
   formData.append('garmentTypes', 'shirt,pants,cap,shoes');
   ```

2. **Use appropriate garment combinations**:
   - Mix different garment types (shirt + pants + accessories)
   - Avoid duplicate garment types (e.g., two shirts)
   - Consider seasonal/style consistency

3. **Provide cache keys** for faster subsequent requests:
   ```javascript
   formData.append('personKey', 'person-123');
   formData.append('garmentKeys', 'shirt-456,pants-789,cap-101');
   ```

4. **Handle errors gracefully**: The API may return partial results or errors for individual items in cart API

---

## Common Error Codes

| Error Code | Description | HTTP Status |
|------------|-------------|-------------|
| `VALIDATION_ERROR` | Request validation failed (missing files, invalid format, etc.) | 400 |
| `MISSING_FILES_ERROR` | Required files are missing | 400 |
| `FILE_PROCESSING_ERROR` | File upload or processing error | 400 |
| `PROCESSING_ERROR` | AI generation processing failed | 500 |
| `SERVER_ERROR` | Internal server error | 500 |

---

## Credit System

### Credit Types

Credits are deducted in the following priority order:

1. **Trial Credits** - Free credits from trial period
2. **Coupon Credits** - Credits from promotional coupons
3. **Plan Credits** - Monthly/annual subscription credits
4. **Purchased Credits** - Additional purchased credits
5. **Overage Billing** - Pay-per-use when credits exhausted ($0.15/credit)

### Credit Limits

- **Monthly Plan**: Overage capped at $50 per month
- **Annual Plan**: Overage capped at $50 per month (tracked via metafields)

### Credit Refunds

Credits are automatically refunded if:
- Generation fails after credit deduction
- Cached results are returned (no generation needed)

---

## File Format Requirements

### Supported Image Formats

- JPEG / JPG
- PNG
- WebP
- AVIF

### File Size Limits

- Maximum file size: **10MB per file**
- Recommended resolution: 512x512 to 2048x2048 pixels

### Image Quality Recommendations

- Use clear, well-lit images
- Ensure person is fully visible (preferably full-body)
- Use high-quality product images for garments
- Avoid heavily edited or filtered images

---

## Caching

### Cache Keys

Cache keys are used to avoid regenerating the same images:

- **Single Fashion Photo**: `personKey + clothingKey`
- **Cart Fashion Photos**: `personKey + garmentKey` (per item)
- **Outfit Look**: `personKey + sorted(garmentKeys)` (future enhancement)

### Cache Benefits

- **0 credits** for cached results
- **Instant response** (no AI processing time)
- **Consistent results** for same inputs

### When to Use Cache Keys

- User profile images (use consistent `personKey`)
- Product images (use product ID as `clothingKey` or `garmentKey`)
- Saved outfit combinations

---

## Rate Limiting

Currently, no explicit rate limiting is implemented. However, consider:

- Processing time varies (typically 5-15 seconds per generation)
- Cart API processes items in parallel (up to 5 concurrent)
- Outfit API processes sequentially (single generation)

---

## Response Times

Typical processing times:

- **Single Fashion Photo**: 5-10 seconds
- **Cart Fashion Photos**: 8-20 seconds (depending on number of items)
- **Outfit Look**: 10-15 seconds

**Note**: Cached results return instantly (typically < 100ms).

---

## Integration Examples

### React/Next.js Example

```javascript
// Single Fashion Photo
const generateFashionPhoto = async (personImage, clothingImage, shop) => {
  const formData = new FormData();
  formData.append('personImage', personImage);
  formData.append('clothingImage', clothingImage);
  
  const response = await fetch(
    `${API_BASE_URL}/api/fashion-photo?shop=${shop}`,
    {
      method: 'POST',
      body: formData,
    }
  );
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Generation failed');
  }
  
  return await response.json();
};

// Cart Fashion Photos
const generateCartPhotos = async (personImage, garmentImages, shop) => {
  const formData = new FormData();
  formData.append('personImage', personImage);
  
  garmentImages.forEach((image) => {
    formData.append('garmentImages', image);
  });
  
  const response = await fetch(
    `${API_BASE_URL}/api/fashion-photo/cart?shop=${shop}`,
    {
      method: 'POST',
      body: formData,
    }
  );
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Generation failed');
  }
  
  return await response.json();
};

// Complete Outfit Look
const generateOutfitLook = async (personImage, garmentImages, garmentTypes, shop) => {
  const formData = new FormData();
  formData.append('personImage', personImage);
  
  garmentImages.forEach((image) => {
    formData.append('garmentImages', image);
  });
  
  if (garmentTypes) {
    formData.append('garmentTypes', garmentTypes.join(','));
  }
  
  const response = await fetch(
    `${API_BASE_URL}/api/fashion-photo/outfit?shop=${shop}`,
    {
      method: 'POST',
      body: formData,
    }
  );
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Generation failed');
  }
  
  return await response.json();
};
```

### Error Handling Example

```javascript
try {
  const result = await generateFashionPhoto(personImage, clothingImage, shop);
  
  if (result.success) {
    // Display the generated image
    const imageUrl = result.data.imageUrl || result.data.image;
    console.log('Credits deducted:', result.data.creditsDeducted);
    console.log('Processing time:', result.data.processingTime);
  }
} catch (error) {
  if (error.message.includes('Insufficient credits')) {
    // Show credit purchase UI
    showCreditPurchaseDialog();
  } else if (error.message.includes('Missing required')) {
    // Show validation error
    showError('Please provide all required images');
  } else {
    // Show generic error
    showError('Generation failed. Please try again.');
  }
}
```

---

## Support

For issues or questions:

1. Check error messages in API responses
2. Verify shop domain and access token
3. Check credit balance using `/api/credits/balance?shop={shop}`
4. Review request format and file constraints

---

## Changelog

### Version 1.0.0 (Current)
- Single fashion photo generation
- Cart fashion photos batch generation (1-6 garments)
- Complete outfit look generation (2-8 garments)
- Credit system with priority deduction
- Caching support (single and cart APIs)
- S3 image storage
- Google Sheets logging

---

**Last Updated**: December 2025

