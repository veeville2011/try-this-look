# Nu3D API Specification

## Overview
The Nu3D API endpoint processes Shopify product images through a 3D Model Generation service, generating 3D models (GLB and Gaussian Splat formats) from product images.

**Base URL:** `/api/nu3d`  
**Method:** `GET`  
**Authentication:** Requires Shopify shop parameter

---

## Endpoint

```
GET /api/nu3d
```

---

## Request Parameters

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `shop` | string | Yes | Shopify shop domain (e.g., `example.myshopify.com` or `example`) |
| `after` | string | No | Cursor for pagination (from previous response) |

### Example Request

```bash
GET /api/nu3d?shop=vto-demo
GET /api/nu3d?shop=vto-demo&after=eyJsYXN0X2lkIjo4MTEwMzAwNDMwMz...
```

---

## Response Structure

### Success Response (200 OK)

```json
{
  "success": true,
  "message": "Nu3d products retrieved and processed successfully",
  "data": {
    "products": [
      {
        "id": "gid://shopify/Product/8110300430380",
        "title": "Product Name",
        "handle": "product-handle",
        "description": "Product description",
        "vendor": "Vendor Name",
        "productType": "Product Type",
        "status": "ACTIVE",
        "tags": ["tag1", "tag2"],
        "createdAt": "2025-12-08T00:00:00Z",
        "updatedAt": "2025-12-08T00:00:00Z",
        "variants": {
          "nodes": [
            {
              "id": "gid://shopify/ProductVariant/45108004945964",
              "title": "Black / Free Size",
              "sku": "SKU123",
              "price": "29.99",
              "availableForSale": true,
              "images": [
                {
                  "id": "gid://shopify/ProductImage/44859273773100",
                  "originalImageUrl": "https://cdn.shopify.com/...",
                  "altText": "Product image",
                  "width": 1024,
                  "height": 1024,
                  
                  // Complete 3D Model Generation API Response
                  "image_id": 328,
                  "status": "completed",
                  "job_id": "06dc3ebe-1122-464c-a407-3a41486d8b31",
                  "gaussian_splat_url": "https://nusense.s3.us-east-1.amazonaws.com/nu3d/gaussian_models/8069185c-abf5-40aa-a4e4-dadbe460310d.ply",
                  "model_glb_url": "https://nusense.s3.us-east-1.amazonaws.com/nu3d/models/134a8615-8792-451d-b754-70e0868573d3.glb",
                  "original_url": "https://nusense.s3.us-east-1.amazonaws.com/nu3d/images/9450e49e-de38-4da0-a274-2a7a38ca6bfe.jpg",
                  "metadata": [
                    {
                      "scale": [[1.99914813041687, 1.99914813041687, 1.99914813041687]],
                      "rotation": [[0.000768176163546741, 0.008042610250413418, 0.674330472946167, 0.7383854985237122]],
                      "camera_pose": null,
                      "translation": [[-0.028243213891983032, 0.18093276023864743, 2.9366958141326904]],
                      "object_index": 0
                    }
                  ],
                  "message": "3D generation completed successfully",
                  
                  // Backward compatibility fields
                  "model3dUrl": "https://nusense.s3.us-east-1.amazonaws.com/nu3d/models/134a8615-8792-451d-b754-70e0868573d3.glb",
                  "model3dStatus": "completed",
                  "model3dImageId": 328,
                  
                  // Additional fields
                  "cached": false,
                  "approvalStatus": "pending",
                  "approvedModel3dUrl": null,
                  "processedAt": "2025-12-08T13:51:47.000Z"
                }
              ]
            }
          ]
        }
      }
    ],
    "total": 1,
    "pageInfo": {
      "hasNextPage": false,
      "endCursor": "eyJsYXN0X2lkIjo4MTEwMzAwNDMwMz..."
    },
    "filters": {
      "createdToday": "2025-12-08T00:00:00.000Z",
      "status": "ACTIVE",
      "limit": 5
    }
  }
}
```

### Error Responses

#### 400 Bad Request - Missing Shop Parameter
```json
{
  "success": false,
  "error": "Validation Error",
  "message": "Missing required query parameter: shop"
}
```

#### 400 Bad Request - Invalid Shop Domain
```json
{
  "success": false,
  "error": "Validation Error",
  "message": "Invalid shop domain"
}
```

#### 404 Not Found - Store Not Found
```json
{
  "success": false,
  "error": "Not Found",
  "message": "Store not found or app not installed"
}
```

#### 500 Internal Server Error
```json
{
  "success": false,
  "error": "Internal Server Error",
  "message": "Failed to retrieve nu3d products",
  "details": "Error details (only in development mode)"
}
```

---

## Processing Flow

### 1. Request Validation
- Validates `shop` parameter is provided
- Normalizes shop domain format
- Gets Shopify access token for the shop

### 2. Product Fetching
- Queries Shopify GraphQL API for products created today
- Filters for ACTIVE products
- Limits to 5 products per request
- Supports pagination via `after` cursor

### 3. Caching Check
- Checks product-level cache in database
- If cached → returns immediately (no API calls)
- If not cached → proceeds to image processing

### 4. Image Processing (Per Image)
For each product image:

**Step 1: Prepare Prompt**
- Uses `product.title` as prompt (no prompt generation API call)
- Validates product title is not empty

**Step 2: Auto-Login**
- Checks if Nu3D API token exists and is valid
- If expired/missing → automatically calls login API
- Gets Bearer token for authentication

**Step 3: Submit 3D Generation Job**
- POST to `/generate3d_webhook`
- Parameters:
  - `image_url`: Shopify CDN image URL
  - `prompt`: Product title
- No timeout configured
- Returns `image_id` from response

**Step 4: Poll for Completion**
- Polls `GET /generate3d/status/{imageId}` every 3 seconds
- Maximum 60 attempts (180 seconds total)
- No timeout on individual requests
- Status values:
  - `"processing"` → continue polling
  - `"completed"` → extract results
  - `"failed"` → throw error

**Step 5: Return Complete Response**
- Returns all fields from API response:
  - `image_id`, `status`, `job_id`
  - `gaussian_splat_url`, `model_glb_url`, `original_url`
  - `metadata` (scale, rotation, translation, camera_pose, object_index)
  - `message`

### 5. Result Storage
- Stores complete result in global in-memory cache (per image URL)
- Stores complete product in database cache (after all images processed)

### 6. Response Building
- Combines all processed images with product data
- Returns pagination information
- Includes processing statistics

---

## Key Features

### ✅ No Prompt Generation API
- Uses `product.title` directly as prompt
- Saves ~10-20 seconds per image
- More predictable results

### ✅ No Retry Logic
- Failed API calls are not retried
- Errors are immediately propagated
- Only login is retried automatically (if token expired)

### ✅ Auto-Login
- Token is automatically refreshed when expired
- Login happens transparently before each API call
- No manual token management needed

### ✅ No Timeouts
- All HTTP requests have no timeout configuration
- Requests wait indefinitely for server responses
- Polling continues until completion or max attempts

### ✅ Complete Data Storage
- All API response fields are stored and returned
- Includes metadata for 3D model display
- Supports both GLB and Gaussian Splat formats

### ✅ Product-Level Caching
- Entire products are cached in database
- Prevents redundant API calls
- Cache persists across requests

### ✅ Image Deduplication
- Same image URL processed only once globally
- Results reused across variants/products
- Reduces processing time and costs

---

## Processing Times

| Step | Estimated Time |
|------|----------------|
| Prompt Preparation | ~0ms (instant) |
| Job Submission | ~1-3 seconds |
| 3D Processing | 60-120 seconds |
| Polling Interval | Every 3 seconds |
| **Total per Image** | **~60-120 seconds** |

---

## Error Handling

### Token Expiration (401)
- Token is automatically cleared
- Error is thrown immediately
- Next API call will trigger auto-login
- **No retry** of the failed API call

### Validation Errors (422)
- Detailed error logging
- Error message includes validation details
- Request is not retried

### Processing Failures
- Status `"failed"` from API
- Error message from API response
- Failed images are marked but don't block other images

### Network Errors
- Errors are logged with full details
- Failed images are tracked
- Other images continue processing

---

## Caching Behavior

### Product-Level Cache
- **Key:** `shopDomain + productId`
- **Storage:** Database (Model3dGenerationCache table)
- **TTL:** No expiration (manual invalidation)
- **When:** After all images in product are processed
- **Condition:** Only caches if at least one image succeeded

### Global Image Cache (In-Memory)
- **Key:** Image URL
- **Storage:** In-memory Map (per request)
- **TTL:** Request duration
- **When:** Immediately after image processing
- **Purpose:** Deduplicate processing within same request

---

## Authentication

### Shopify Authentication
- Uses Shopify access token from database
- Token retrieved via `getShopAccessToken(shopDomain)`
- Validates store installation before processing

### Nu3D API Authentication
- Bearer token authentication
- Auto-login when token expired/missing
- Token stored in service instance
- Token expiry tracked and validated

---

## Pagination

Pagination is supported via the `after` cursor:

```bash
# First page
GET /api/nu3d?shop=vto-demo

# Next page
GET /api/nu3d?shop=vto-demo&after=eyJsYXN0X2lkIjo4MTEwMzAwNDMwMz...
```

Response includes:
```json
{
  "pageInfo": {
    "hasNextPage": true,
    "endCursor": "eyJsYXN0X2lkIjo4MTEwMzAwNDMwMz..."
  }
}
```

---

## Environment Variables

```env
# Nu3D API Configuration
MODEL3D_API_URL=https://dev.karthikramesh.com
MODEL3D_EMAIL=h@v.com
MODEL3D_PASSWORD=pass123

# Falls back to Image Relighting credentials if not set
IMAGE_RELIGHTING_API_URL=https://dev.karthikramesh.com
IMAGE_RELIGHTING_EMAIL=h@v.com
IMAGE_RELIGHTING_PASSWORD=pass123
```

---

## Example Usage

### cURL
```bash
curl -X GET "http://localhost:3000/api/nu3d?shop=vto-demo"
```

### JavaScript (Fetch)
```javascript
const response = await fetch('/api/nu3d?shop=vto-demo');
const data = await response.json();

if (data.success) {
  data.data.products.forEach(product => {
    product.variants.nodes.forEach(variant => {
      variant.images.forEach(image => {
        console.log('3D Model:', image.model_glb_url);
        console.log('Gaussian Splat:', image.gaussian_splat_url);
        console.log('Metadata:', image.metadata);
      });
    });
  });
}
```

### JavaScript (Axios)
```javascript
const axios = require('axios');

const response = await axios.get('/api/nu3d', {
  params: {
    shop: 'vto-demo',
    after: 'eyJsYXN0X2lkIjo4MTEwMzAwNDMwMz...' // Optional
  }
});

console.log(response.data);
```

---

## Response Fields Reference

### Image Object Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Shopify image ID |
| `originalImageUrl` | string | Original Shopify image URL |
| `image_id` | number | Nu3D API image ID |
| `status` | string | Processing status: "completed", "processing", "failed" |
| `job_id` | string | Job identifier from Nu3D API |
| `gaussian_splat_url` | string | Gaussian Splat model URL (.ply file) |
| `model_glb_url` | string | GLB model URL (.glb file) |
| `original_url` | string | Original image URL from Nu3D API |
| `metadata` | array | 3D model metadata (scale, rotation, translation, camera_pose, object_index) |
| `message` | string | API message |
| `model3dUrl` | string | Backward compatibility: GLB URL |
| `model3dStatus` | string | Backward compatibility: status |
| `model3dImageId` | number | Backward compatibility: image_id |
| `cached` | boolean | Whether result was from cache |
| `approvalStatus` | string | Approval workflow status |
| `processedAt` | string | ISO timestamp of processing |

### Metadata Object Structure

```json
{
  "scale": [[x, y, z]],
  "rotation": [[w, x, y, z]],  // Quaternion
  "translation": [[x, y, z]],
  "camera_pose": null,
  "object_index": 0
}
```

---

## Notes

1. **Processing Time:** Each image takes 60-120 seconds to process. The API polls every 3 seconds until completion.

2. **Concurrent Processing:** Multiple images are processed concurrently (limited by concurrency settings).

3. **Cache Strategy:** Products are cached after all images are processed. Individual images are cached in-memory during request processing.

4. **Error Tolerance:** Failed images don't block successful ones. Each image is processed independently.

5. **No Retries:** Failed API calls are not retried. Only login is retried automatically when token expires.

6. **Complete Data:** All fields from the Nu3D API response are stored and returned, including metadata needed for 3D model display.

---

## Version History

- **v1.0** - Initial implementation with prompt generation
- **v2.0** - Removed prompt generation, uses product title directly
- **v2.1** - Removed all retry logic
- **v2.2** - Removed all timeouts
- **v2.3** - Complete API response storage (all fields)

---

## Support

For issues or questions, check the logs for detailed error information. All requests include a `requestId` for tracking.

