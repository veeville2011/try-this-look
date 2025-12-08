# NUSCENE API Specification

## Overview

The NUSCENE API generates fast-paced 4-second product showcase videos using Veo 3.1 Fast with AI-powered cinematography. It processes Shopify products and generates videos for product images using an external video generation service.

**Base URL**: `/api/nuscene`  
**Authentication**: Requires shop parameter (Shopify store domain)  
**Processing Time**: 60-180 seconds per video

---

## Table of Contents

1. [Main Endpoint](#main-endpoint)
2. [Video Generation API](#video-generation-api)
3. [Status Polling](#status-polling)
4. [Data Structures](#data-structures)
5. [Error Handling](#error-handling)
6. [Examples](#examples)
7. [Caching](#caching)

---

## Main Endpoint

### GET /api/nuscene

Retrieves products created today that are active, processes their images through video generation, and returns products with generated video URLs.

#### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `shop` | string | Yes | Shopify store domain (e.g., `mystore.myshopify.com` or `mystore`) |
| `after` | string | No | Cursor for pagination (from previous response) |

#### Request Example

```bash
GET /api/nuscene?shop=mystore.myshopify.com
GET /api/nuscene?shop=mystore.myshopify.com&after=eyJsaW1pdCI6NSwib3JkZXIiOiJpZCBhc2MifQ
```

#### Response Structure

```json
{
  "success": true,
  "message": "Nuscene products retrieved and processed successfully",
  "data": {
    "products": [
      {
        "id": "gid://shopify/Product/123456789",
        "title": "Product Name",
        "handle": "product-name",
        "description": "Product description",
        "vendor": "Vendor Name",
        "productType": "Type",
        "status": "ACTIVE",
        "tags": ["tag1", "tag2"],
        "createdAt": "2025-12-08T10:00:00Z",
        "updatedAt": "2025-12-08T10:00:00Z",
        "publishedAt": "2025-12-08T10:00:00Z",
        "onlineStoreUrl": "https://mystore.com/products/product-name",
        "priceRangeV2": {
          "minVariantPrice": {
            "amount": "29.99",
            "currencyCode": "USD"
          },
          "maxVariantPrice": {
            "amount": "39.99",
            "currencyCode": "USD"
          }
        },
        "media": {
          "nodes": [
            {
              "id": "gid://shopify/MediaImage/123",
              "image": {
                "id": "gid://shopify/Image/123",
                "url": "https://cdn.shopify.com/...",
                "altText": "Product image",
                "width": 1200,
                "height": 1600
              }
            }
          ]
        },
        "variants": {
          "nodes": [
            {
              "id": "gid://shopify/ProductVariant/123",
              "title": "Default Title",
              "sku": "SKU-123",
              "barcode": "1234567890123",
              "price": "29.99",
              "compareAtPrice": null,
              "availableForSale": true,
              "inventoryQuantity": 10,
              "inventoryPolicy": "DENY",
              "selectedOptions": [
                {
                  "name": "Size",
                  "value": "Large"
                }
              ],
              "images": [
                {
                  "id": "gid://shopify/MediaImage/123",
                  "originalImageUrl": "https://cdn.shopify.com/...",
                  "altText": "Product image",
                  "width": 1200,
                  "height": 1600,
                  "video_id": 123,
                  "status": "completed",
                  "external_job_id": "abc123",
                  "video_url": "https://s3.amazonaws.com/.../video.mp4",
                  "thumbnail_url": "https://s3.amazonaws.com/.../thumbnail.jpg",
                  "duration": 4.0,
                  "aspect_ratio": "16:9",
                  "resolution": "720p",
                  "prompt": "Product centered in frame, quick push-in...",
                  "created_at": "2025-12-08T10:30:00Z",
                  "completed_at": "2025-12-08T10:32:45Z",
                  "message": "Video generation completed successfully",
                  "status_url": "/nuvideo/status/123",
                  "estimated_time": "60-180 seconds",
                  "original_url": "https://cdn.shopify.com/...",
                  "job_id": "abc123",
                  "videoUrl": "https://s3.amazonaws.com/.../video.mp4",
                  "videoStatus": "completed",
                  "videoId": 123,
                  "cached": false,
                  "approvalStatus": "pending",
                  "approvedVideoUrl": null,
                  "processedAt": "2025-12-08T10:32:45Z"
                }
              ]
            }
          ]
        },
        "options": [
          {
            "id": "gid://shopify/ProductOption/123",
            "name": "Size",
            "values": ["Small", "Medium", "Large"]
          }
        ],
        "seo": {
          "title": "SEO Title",
          "description": "SEO Description"
        },
        "collections": {
          "nodes": [
            {
              "id": "gid://shopify/Collection/123",
              "title": "Collection Name",
              "handle": "collection-name"
            }
          ]
        }
      }
    ],
    "total": 5,
    "pageInfo": {
      "hasNextPage": true,
      "endCursor": "eyJsaW1pdCI6NSwib3JkZXIiOiJpZCBhc2MifQ"
    },
    "filters": {
      "createdToday": "2025-12-08",
      "status": "ACTIVE",
      "limit": 5
    }
  }
}
```

#### Response Codes

| Status Code | Description |
|-------------|-------------|
| 200 | Success - Products retrieved and processed |
| 400 | Bad Request - Missing or invalid shop parameter |
| 404 | Not Found - Store not found or not installed |
| 500 | Internal Server Error - Processing failed |

---

## Video Generation API

The NUSCENE API uses an external video generation service to create product videos.

### External API Endpoints

**Base URL**: `https://dev.karthikramesh.com` (configurable via `NUVIDEO_API_URL`)

#### 1. POST /nuvideo_webhook

Submits an image for video generation.

##### Request (multipart/form-data)

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `image_url` | string | Yes | URL of the image to process |
| `user_prompt` | string | No | Optional context for video generation (e.g., "Showcase the premium texture"). If omitted, AI auto-generates optimized video prompt |
| `aspect_ratio` | string | No | Default: `"16:9"`. Options: `"16:9"` (landscape), `"9:16"` (portrait/mobile) |
| `duration` | string | No | Default: `"4s"`. Options: `"4s"`, `"6s"`, `"8s"` |
| `resolution` | string | No | Default: `"720p"`. Options: `"720p"`, `"1080p"` |
| `generate_audio` | boolean | No | Default: `false`. Set to `true` to generate audio for video |
| `source_image_id` | integer | No | Optional, link to source image in database |

##### Request Example

```javascript
const formData = new FormData();
formData.append('image_url', 'https://cdn.shopify.com/.../image.jpg');
formData.append('user_prompt', 'Showcase the premium texture');
formData.append('aspect_ratio', '16:9');
formData.append('duration', '4s');
formData.append('resolution', '720p');
formData.append('generate_audio', 'false');

const response = await fetch('https://dev.karthikramesh.com/nuvideo_webhook', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN'
  },
  body: formData
});
```

##### Response

```json
{
  "message": "Video generation job submitted successfully",
  "video_id": 123,
  "external_job_id": "abc123",
  "status": "processing",
  "status_url": "/nuvideo/status/123",
  "estimated_time": "60-180 seconds"
}
```

#### 2. GET /nuvideo/status/{video_id}

Checks the status of a video generation job.

##### Request

```bash
GET /nuvideo/status/123
Authorization: Bearer YOUR_TOKEN
```

##### Response (Processing)

```json
{
  "video_id": 123,
  "status": "processing",
  "external_job_id": "abc123",
  "message": "Video generation in progress"
}
```

##### Response (Completed)

```json
{
  "video_id": 123,
  "status": "completed",
  "external_job_id": "abc123",
  "video_url": "https://s3.amazonaws.com/.../video.mp4",
  "thumbnail_url": "https://s3.amazonaws.com/.../thumbnail.jpg",
  "duration": 4.0,
  "aspect_ratio": "16:9",
  "resolution": "720p",
  "prompt": "Product centered in frame, quick push-in with dynamic camera movements showcasing premium texture",
  "created_at": "2025-12-08T10:30:00Z",
  "completed_at": "2025-12-08T10:32:45Z",
  "message": "Video generation completed successfully"
}
```

##### Response (Failed)

```json
{
  "video_id": 123,
  "status": "failed",
  "external_job_id": "abc123",
  "message": "Video generation failed",
  "error": "Error details"
}
```

---

## Status Polling

The API automatically polls the status endpoint until completion.

### Polling Configuration

- **Poll Interval**: 3 seconds
- **Max Attempts**: 60 attempts
- **Max Polling Time**: 180 seconds (3 minutes)
- **Processing Time**: 60-180 seconds (as per API documentation)

### Polling Flow

1. Submit job via `/nuvideo_webhook`
2. Receive `video_id` from submission response
3. Poll `/nuvideo/status/{video_id}` every 3 seconds
4. Continue until status is `"completed"` or `"failed"`
5. Return complete response with all fields

### Status Values

| Status | Description |
|--------|-------------|
| `processing` | Video generation in progress |
| `completed` | Video generation completed successfully |
| `failed` | Video generation failed |

---

## Data Structures

### Image Object

```typescript
interface Image {
  // Original image data
  id: string;                          // Shopify image ID
  originalImageUrl: string;            // Original image URL
  altText: string | null;              // Image alt text
  width: number | null;                // Image width
  height: number | null;               // Image height
  
  // Video Generation API Response Fields
  video_id: number;                    // Video ID from API
  status: "processing" | "completed" | "failed";
  external_job_id: string | null;      // External job ID
  video_url: string | null;            // Generated video URL
  thumbnail_url: string | null;        // Video thumbnail URL
  duration: number | null;             // Video duration in seconds
  aspect_ratio: "16:9" | "9:16" | null;
  resolution: "720p" | "1080p" | null;
  prompt: string | null;               // Generated prompt used
  created_at: string | null;           // ISO 8601 timestamp
  completed_at: string | null;         // ISO 8601 timestamp
  message: string | null;              // Status message
  status_url: string | null;           // Status check URL
  estimated_time: string | null;       // Estimated processing time
  original_url: string | null;         // Original image URL (duplicate)
  job_id: string | null;               // Job ID (duplicate of external_job_id)
  
  // Backward Compatibility Fields
  videoUrl: string | null;             // Alias for video_url
  videoStatus: string;                 // Alias for status
  videoId: number;                     // Alias for video_id
  
  // Cache Information
  cached: boolean;                      // Whether result was from cache
  
  // Approval Workflow
  approvalStatus: "pending" | "approved" | "rejected";
  approvedVideoUrl: string | null;     // Approved video URL
  
  // Metadata
  processedAt: string;                  // ISO 8601 timestamp
  error?: string;                       // Error message (if failed)
}
```

### Product Object

```typescript
interface Product {
  id: string;
  title: string;
  handle: string;
  description: string;
  descriptionHtml: string;
  vendor: string;
  productType: string;
  status: "ACTIVE" | "ARCHIVED" | "DRAFT";
  tags: string[];
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  onlineStoreUrl: string | null;
  priceRangeV2: {
    minVariantPrice: {
      amount: string;
      currencyCode: string;
    };
    maxVariantPrice: {
      amount: string;
      currencyCode: string;
    };
  };
  media: {
    nodes: MediaNode[];
  };
  variants: {
    nodes: Variant[];
  };
  options: ProductOption[];
  seo: {
    title: string;
    description: string;
  };
  collections: {
    nodes: Collection[];
  };
}
```

### Variant Object

```typescript
interface Variant {
  id: string;
  title: string;
  sku: string | null;
  barcode: string | null;
  price: string;
  compareAtPrice: string | null;
  availableForSale: boolean;
  inventoryQuantity: number | null;
  inventoryPolicy: "DENY" | "CONTINUE";
  selectedOptions: {
    name: string;
    value: string;
  }[];
  images: Image[];  // Array of images with video generation data
}
```

---

## Error Handling

### Error Response Format

```json
{
  "success": false,
  "error": "Error Type",
  "message": "Detailed error message",
  "details": "Additional error details (development only)"
}
```

### Error Types

#### 1. Validation Error (400)

```json
{
  "success": false,
  "error": "Validation Error",
  "message": "Missing required query parameter: shop"
}
```

**Causes**:
- Missing `shop` parameter
- Invalid shop domain format

#### 2. Not Found (404)

```json
{
  "success": false,
  "error": "Not Found",
  "message": "Store not found or not installed: mystore.myshopify.com"
}
```

**Causes**:
- Store not found in database
- Store not installed/configured

#### 3. Internal Server Error (500)

```json
{
  "success": false,
  "error": "Internal Server Error",
  "message": "Failed to retrieve nuscene products",
  "details": "Error details (development only)"
}
```

**Causes**:
- Shopify API errors
- Video generation API errors
- Database errors
- Network errors

### Video Generation Errors

#### Submission Errors

- **401 Unauthorized**: Token expired or invalid
- **422 Unprocessable Entity**: Validation error (invalid parameters)
- **500 Internal Server Error**: API server error

#### Status Check Errors

- **401 Unauthorized**: Token expired or invalid
- **404 Not Found**: Video ID not found
- **500 Internal Server Error**: API server error

#### Processing Errors

- **Timeout**: Video generation took longer than 180 seconds
- **Failed Status**: Video generation failed (check `error` field)
- **No Video URL**: Status is "completed" but no `video_url` returned

---

## Examples

### Example 1: Basic Request

```bash
curl -X GET "http://localhost:3000/api/nuscene?shop=mystore.myshopify.com" \
  -H "Content-Type: application/json"
```

### Example 2: With Pagination

```bash
curl -X GET "http://localhost:3000/api/nuscene?shop=mystore.myshopify.com&after=eyJsaW1pdCI6NSwib3JkZXIiOiJpZCBhc2MifQ" \
  -H "Content-Type: application/json"
```

### Example 3: JavaScript/Node.js

```javascript
const axios = require('axios');

async function getNusceneProducts(shop, after = null) {
  try {
    const params = { shop };
    if (after) params.after = after;
    
    const response = await axios.get('http://localhost:3000/api/nuscene', {
      params
    });
    
    console.log('Products:', response.data.data.products);
    console.log('Total:', response.data.data.total);
    console.log('Has Next Page:', response.data.data.pageInfo.hasNextPage);
    
    return response.data;
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
    throw error;
  }
}

// Usage
getNusceneProducts('mystore.myshopify.com')
  .then(data => {
    // Process products with video URLs
    data.data.products.forEach(product => {
      product.variants.nodes.forEach(variant => {
        variant.images.forEach(image => {
          if (image.videoStatus === 'completed') {
            console.log('Video URL:', image.video_url);
          }
        });
      });
    });
  });
```

### Example 4: Processing Video Status

```javascript
// The API automatically handles polling, but here's how it works internally:

async function pollVideoStatus(videoId) {
  const maxAttempts = 60;
  const pollInterval = 3000; // 3 seconds
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) {
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
    
    const status = await checkVideoStatus(videoId);
    
    if (status.status === 'completed') {
      return status;
    } else if (status.status === 'failed') {
      throw new Error(`Video generation failed: ${status.error}`);
    }
    
    // Continue polling...
  }
  
  throw new Error('Video generation timeout');
}
```

---

## Caching

### Product-Level Caching

The API implements product-level caching to avoid regenerating videos for the same products.

#### Cache Key

```
{shopDomain}:{productId}
```

#### Cache Behavior

- **Cache Hit**: Returns cached product data immediately (no API calls)
- **Cache Miss**: Processes images through video generation API
- **Cache Storage**: Only stores products with at least one successful video generation

#### Cache Invalidation

- Cache is stored per shop domain and product ID
- Cache persists until manually cleared or product data changes
- Failed video generations are not cached

#### Cache Response Fields

Cached responses include the `_cached` and `_cachedAt` fields:

```json
{
  "id": "gid://shopify/Product/123",
  "_cached": true,
  "_cachedAt": "2025-12-08T10:00:00Z",
  "variants": {
    "nodes": [
      {
        "images": [
          {
            "cached": true,
            "video_url": "https://...",
            ...
          }
        ]
      }
    ]
  }
}
```

---

## Image Processing Logic

### Image Selection

1. **Variant-Specific Images**: Uses `variant.media.nodes[0]` (first variant image)
2. **Product Fallback**: If variant has no specific image, uses `product.media.nodes[0]` (first product image)
3. **Only Main Images**: Only processes the main/featured image per variant (not all images)

### Video Generation Flow

1. Extract product title for use as `user_prompt`
2. Submit image to `/nuvideo_webhook` with:
   - `image_url`: Product image URL
   - `user_prompt`: Product title
   - `aspect_ratio`: "16:9" (default)
   - `duration`: "4s" (default)
   - `resolution`: "720p" (default)
   - `generate_audio`: false (default)
3. Poll `/nuvideo/status/{video_id}` every 3 seconds
4. Return complete response with all fields

---

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NUVIDEO_API_URL` | Video generation API base URL | `https://dev.karthikramesh.com` |
| `NUVIDEO_EMAIL` | API login email | Falls back to `IMAGE_RELIGHTING_EMAIL` |
| `NUVIDEO_PASSWORD` | API login password | Falls back to `IMAGE_RELIGHTING_PASSWORD` |

### Default Values

- **Aspect Ratio**: `"16:9"`
- **Duration**: `"4s"`
- **Resolution**: `"720p"`
- **Generate Audio**: `false`
- **Poll Interval**: `3000ms` (3 seconds)
- **Max Poll Attempts**: `60` (180 seconds total)

---

## Rate Limits

- **Shopify API**: Subject to Shopify's rate limits
- **Video Generation API**: Subject to external API rate limits
- **Processing Time**: 60-180 seconds per video
- **Concurrent Processing**: Multiple images processed in parallel per product

---

## Notes

1. **Processing Time**: Videos take 60-180 seconds to generate. The API polls automatically until completion.

2. **Image Filtering**: Only the main/featured image per variant is processed to reduce unnecessary video generations.

3. **Product Title as Prompt**: The product title is automatically used as the `user_prompt` for video generation. If not provided, the API auto-generates an optimized prompt.

4. **Complete JSON Storage**: All fields from both submission and status responses are stored and returned.

5. **Backward Compatibility**: The API maintains backward compatibility with `videoUrl`, `videoStatus`, and `videoId` fields.

6. **Error Recovery**: Failed video generations are logged but don't block the entire request. Products with failed videos are still returned.

---

## Support

For issues or questions:
- Check logs for detailed error messages
- Verify shop domain format
- Ensure video generation API credentials are configured
- Check network connectivity to video generation API

