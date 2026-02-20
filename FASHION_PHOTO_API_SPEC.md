# Fashion Photo API - Complete Specification

**Version:** 2.0 (Optimized)  
**Base URL:** `/api/fashion-photo`  
**Content-Type:** `multipart/form-data`  
**Method:** `POST`

---

## Table of Contents

1. [Overview](#overview)
2. [Endpoint Details](#endpoint-details)
3. [Request Specification](#request-specification)
4. [Response Specification](#response-specification)
5. [Error Responses](#error-responses)
6. [Status Codes](#status-codes)
7. [Examples](#examples)
8. [Database Schema](#database-schema)
9. [Optimizations](#optimizations)
10. [Migration Guide](#migration-guide)

---

## Overview

The Fashion Photo API generates AI-powered fashion try-on images using Gemini AI. It supports:
- **Uploaded person images** or **pre-configured demo person models**
- **Clothing images** via file upload or URL
- **Parallel processing** for optimal performance
- **Database-first deduplication** to avoid redundant processing
- **Credit tracking** for Shopify stores

### Key Features

- ✅ **Demo Person Support**: Use pre-configured models (`demo_01` through `demo_16`)
- ✅ **Parallel Processing**: Gemini API and S3 uploads run simultaneously
- ✅ **No Compression**: Uses original images for maximum quality
- ✅ **Smart Deduplication**: Checks database before S3 for existing images
- ✅ **Credit Management**: Automatic credit deduction after successful generation
- ✅ **Aspect Ratio Preservation**: Maintains person image aspect ratio in output

---

## Endpoint Details

### Main Endpoint

```
POST /api/fashion-photo
```

### Status Check Endpoint

```
GET /api/fashion-photo/status/:jobId
```

**Note:** The API uses async job submission - it returns immediately with a job ID, and you can check status using the status endpoint.

---

## Request Specification

### Content-Type

```
multipart/form-data
```

### File Upload Limits

- **Maximum file size:** 10 MB per file
- **Maximum files:** 2 files (personImage + optional clothingImage)
- **Allowed formats:** JPEG, PNG, WebP, AVIF
- **AVIF handling:** Automatically converted to PNG (Gemini requirement)

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `shop` | string | Conditional | Shopify shop domain (e.g., `your-store.myshopify.com`). Required for credit tracking. Preferred over `storeName` in body. |

### Form Data Fields

#### Required Fields

**One of the following is REQUIRED:**

1. **Option A: Upload Person Image**
   - `personImage` (file) - Person/model image file
   - **OR**
2. **Option B: Use Demo Person**
   - `demoPersonId` (string) - Demo person ID (`demo_01` through `demo_16`)

**One of the following is REQUIRED:**

1. **Option A: Upload Clothing Image**
   - `clothingImage` (file) - Clothing/garment image file
   - **OR**
2. **Option B: Provide Clothing URL**
   - `clothingImageUrl` (string) - Valid image URL

**Note:** If both `clothingImage` file and `clothingImageUrl` are provided, `clothingImageUrl` takes priority.

#### Optional Fields

All other fields are optional and used for tracking/metadata:

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `name` | string | User's name | `"John Doe"` |
| `email` | string | User's email | `"john@example.com"` |
| `storeName` | string | Shopify store name (alternative to `shop` query param) | `"your-store.myshopify.com"` |
| `customerId` | string | Shopify customer ID | `"12345"` |
| `customerEmail` | string | Customer email | `"customer@example.com"` |
| `customerFirstName` | string | Customer first name | `"John"` |
| `customerLastName` | string | Customer last name | `"Doe"` |
| `productId` | string | Shopify product GID | `"gid://shopify/Product/123"` |
| `productTitle` | string | Product title | `"T-Shirt"` |
| `productUrl` | string | Product URL | `"https://store.com/products/tshirt"` |
| `variantId` | string | Shopify variant GID | `"gid://shopify/ProductVariant/456"` |
| `personBbox` | object/string | Person bounding box (JSON) for targeted try-on | `{"x": 100, "y": 200, "width": 300, "height": 400}` |
| `language` | string | Override language detection | `"fr"` or `"en"` |
| `demoPersonId` | string | Demo person ID (if not uploading personImage) | `"demo_01"` through `"demo_16"` |

### Person Bounding Box Format

If `personBbox` is provided, it must be a valid JSON object or JSON string:

```json
{
  "x": 100,
  "y": 200,
  "width": 300,
  "height": 400
}
```

**Validation Rules:**
- All values must be positive numbers
- `x` and `y` must be >= 0
- `width` and `height` must be > 0
- Bounding box should be within image bounds (warning logged if not)

**Purpose:** Targets try-on to a specific person area while preserving the full image.

### Demo Person IDs

Available demo person IDs:
- `demo_01` through `demo_16` (16 pre-configured models)

**Note:** Demo persons are stored in S3/CDN and fetched automatically.

---

## Response Specification

### Success Response (200 OK)

```json
{
  "image": "data:image/png;base64,iVBORw0KGgoAAAANS...",
  "imageUrl": "https://s3.amazonaws.com/bucket/generated/abc123.jpg",
  "generatedImageKey": "generated/abc123.jpg"
}
```

#### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `image` | string | Base64-encoded image data URL (always present) |
| `imageUrl` | string | S3 URL of generated image (present if upload successful) |
| `generatedImageKey` | string | S3 key of generated image (present if upload successful) |

**Note:** The `compression` object has been **removed** from responses. Images are no longer compressed - original quality is preserved.

### Error Response (400/403/500)

```json
{
  "error": "ERROR_CODE",
  "message": "Human-readable error message",
  "details": {
    // Additional error context
  }
}
```

### Status Check Response

```
GET /api/fashion-photo/status/:jobId
```

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `jobId` | string | Request/job ID |
| `status` | string | Job status: `pending`, `processing`, `completed`, `failed` |
| `createdAt` | string | ISO timestamp of job creation |
| `updatedAt` | string | ISO timestamp of last update |
| `statusDescription` | string | Human-readable status description |
| `imageUrl` | string | (Only if `status === "completed"`) Generated image URL |
| `processingTime` | string | (Only if `status === "completed"` or `failed`) Processing time |
| `error` | object | (Only if `status === "failed"`) Error details |

**Status Values:**
- `pending`: Job is queued and waiting to be processed
- `processing`: Job is currently being processed
- `completed`: Job completed successfully
- `failed`: Job failed with an error

---

## Error Responses

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Request validation failed |
| `MISSING_FILES_ERROR` | 400 | Required files missing |
| `FILE_PROCESSING_ERROR` | 400 | File processing/validation error |
| `PROCESSING_FAILURE` | 400 | AI generation failed |
| `GEMINI_API_ERROR` | 502 | Gemini API error |
| `GEMINI_QUOTA_EXCEEDED` | 429 | API quota exceeded |
| `GEMINI_PERMISSION_DENIED` | 403 | API permission denied |
| `SERVER_ERROR` | 500 | Internal server error |

### Common Error Scenarios

#### 1. Missing Required Fields

```json
{
  "error": "VALIDATION_ERROR",
  "message": "Either demoPersonId or personImage must be provided",
  "details": {
    "provided": {
      "demoPersonId": false,
      "personImage": false
    }
  }
}
```

#### 2. Invalid Demo Person ID

```json
{
  "error": "VALIDATION_ERROR",
  "message": "Invalid demoPersonId: demo_99. Use demo_01 through demo_16.",
  "details": {
    "field": "demoPersonId",
    "provided": "demo_99",
    "availableIds": ["demo_01", "demo_02", ..., "demo_16"]
  }
}
```

#### 3. Both demoPersonId and personImage Provided

```json
{
  "error": "VALIDATION_ERROR",
  "message": "Cannot provide both demoPersonId and personImage. Provide only one.",
  "details": {
    "provided": {
      "demoPersonId": true,
      "personImage": true
    }
  }
}
```

#### 4. Invalid File Type

```json
{
  "error": "FILE_PROCESSING_ERROR",
  "message": "personImage doit être un fichier image valide (JPEG, PNG, WebP ou AVIF)",
  "details": {
    "field": "personImage",
    "receivedType": "application/pdf",
    "allowedTypes": ["image/jpeg", "image/png", "image/webp", "image/avif"]
  }
}
```

#### 5. File Too Large

```json
{
  "error": "FILE_PROCESSING_ERROR",
  "message": "Taille de fichier trop grande. La taille maximale est de 10 Mo.",
  "details": {
    "multerError": "LIMIT_FILE_SIZE",
    "field": "personImage"
  }
}
```

#### 6. Invalid Shop Domain

```json
{
  "error": "VALIDATION_ERROR",
  "message": "Invalid shop domain or access token not found. Please ensure the shop is installed.",
  "details": {
    "shop": "invalid-shop.myshopify.com",
    "shopDomain": null
  }
}
```

#### 7. Insufficient Credits

```json
{
  "error": "VALIDATION_ERROR",
  "message": "Insufficient credits. Please purchase credits or wait for your next billing period.",
  "details": {
    "reason": "insufficient_credits",
    "creditBalance": 0,
    "creditBreakdown": {
      "subscription": 0,
      "purchased": 0,
      "total": 0
    },
    "overageInfo": {
      "available": false
    }
  }
}
```

#### 8. Gemini API Error

```json
{
  "error": "GEMINI_API_ERROR",
  "message": "AI service temporarily unavailable. Please try again later.",
  "details": {
    "originalError": "Google API error: ..."
  }
}
```

#### 9. Safety/Policy Block

```json
{
  "error": "PROCESSING_FAILURE",
  "message": "Content was blocked due to safety concerns. The AI model detected potentially inappropriate content in your images.",
  "details": {
    "originalError": "SAFETY"
  }
}
```

---

## Status Codes

| Code | Meaning | When Returned |
|------|---------|---------------|
| `200` | Success | Image generated successfully |
| `400` | Bad Request | Validation error, missing files, invalid input |
| `403` | Forbidden | Insufficient credits, permission denied |
| `429` | Too Many Requests | Rate limit exceeded |
| `500` | Internal Server Error | Server-side error |
| `502` | Bad Gateway | Gemini API error |
| `503` | Service Unavailable | Database or S3 service unavailable |

---

## Examples

### Example 1: Minimal Request (Uploaded Images)

**Request:**
```bash
curl -X POST "https://api.example.com/api/fashion-photo" \
  -F "personImage=@person.jpg" \
  -F "clothingImage=@shirt.jpg"
```

**Response:**
```json
{
  "image": "data:image/png;base64,iVBORw0KGgoAAAANS...",
  "imageUrl": "https://s3.amazonaws.com/bucket/generated/abc123.jpg",
  "generatedImageKey": "generated/abc123.jpg"
}
```

### Example 2: Using Demo Person + Clothing URL

**Request:**
```bash
curl -X POST "https://api.example.com/api/fashion-photo?shop=your-store.myshopify.com" \
  -F "demoPersonId=demo_05" \
  -F "clothingImageUrl=https://example.com/product.jpg" \
  -F "productId=gid://shopify/Product/123" \
  -F "variantId=gid://shopify/ProductVariant/456"
```

**Response:**
```json
{
  "image": "data:image/png;base64,iVBORw0KGgoAAAANS...",
  "imageUrl": "https://s3.amazonaws.com/bucket/generated/xyz789.jpg",
  "generatedImageKey": "generated/xyz789.jpg"
}
```

### Example 3: Full Request with All Optional Fields

**Request:**
```bash
curl -X POST "https://api.example.com/api/fashion-photo?shop=your-store.myshopify.com" \
  -F "personImage=@person.jpg" \
  -F "clothingImageUrl=https://example.com/product.jpg" \
  -F "name=John Doe" \
  -F "email=john@example.com" \
  -F "customerId=12345" \
  -F "customerEmail=customer@example.com" \
  -F "customerFirstName=John" \
  -F "customerLastName=Doe" \
  -F "productId=gid://shopify/Product/123" \
  -F "productTitle=T-Shirt" \
  -F "productUrl=https://store.com/products/tshirt" \
  -F "variantId=gid://shopify/ProductVariant/456" \
  -F 'personBbox={"x": 100, "y": 200, "width": 300, "height": 400}' \
  -F "language=en"
```

**Response:**
```json
{
  "image": "data:image/png;base64,iVBORw0KGgoAAAANS...",
  "imageUrl": "https://s3.amazonaws.com/bucket/generated/def456.jpg",
  "generatedImageKey": "generated/def456.jpg"
}
```

### Example 4: JavaScript/Fetch API

```javascript
const formData = new FormData();
formData.append('demoPersonId', 'demo_01');
formData.append('clothingImageUrl', 'https://example.com/product.jpg');
formData.append('productId', 'gid://shopify/Product/123');

const response = await fetch('https://api.example.com/api/fashion-photo?shop=your-store.myshopify.com', {
  method: 'POST',
  body: formData
});

const result = await response.json();
console.log(result.imageUrl); // S3 URL
console.log(result.image); // Base64 data URL
```

### Example 5: Status Check

**Request:**
```bash
curl "https://api.example.com/api/fashion-photo/status/abc123xyz"
```

**Response (Pending):**
```json
{
  "jobId": "abc123xyz",
  "status": "pending",
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-15T10:30:00.000Z",
  "statusDescription": "Votre demande a été reçue et sera traitée sous peu...",
  "message": "Job is queued and waiting to be processed"
}
```

**Response (Completed):**
```json
{
  "jobId": "abc123xyz",
  "status": "completed",
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-15T10:30:15.000Z",
  "statusDescription": "Génération terminée !",
  "imageUrl": "https://s3.amazonaws.com/bucket/generated/abc123.jpg",
  "processingTime": "15000ms"
}
```

---

## Database Schema

### Image Generation Record

The API stores records in the database with the following fields:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `requestId` | string | ✅ | Unique request/job ID |
| `personImageUrl` | string | ❌ | S3 URL of person image (null initially, updated after upload) |
| `clothingImageUrl` | string | ❌ | S3 URL of clothing image (null initially, updated after upload) |
| `generatedImageUrl` | string | ❌ | S3 URL of generated image (set on completion) |
| `generatedImageKey` | string | ❌ | S3 key of generated image |
| `status` | string | ✅ | Status: `pending`, `processing`, `completed`, `failed` |
| `statusDescription` | string | ❌ | Human-readable status description |
| `personKey` | string | ✅ | Auto-generated deduplication key for person image |
| `clothingKey` | string | ✅ | Auto-generated deduplication key for clothing image |
| `demoPersonId` | string | ❌ | Demo person ID if used (null otherwise) |
| `aspectRatio` | string | ❌ | Person image aspect ratio (e.g., `"16:9"`) |
| `name` | string | ❌ | User's name |
| `email` | string | ❌ | User's email |
| `storeName` | string | ❌ | Shopify store name |
| `customerId` | string | ❌ | Shopify customer ID |
| `customerEmail` | string | ❌ | Customer email |
| `customerFirstName` | string | ❌ | Customer first name |
| `customerLastName` | string | ❌ | Customer last name |
| `productId` | string | ❌ | Shopify product GID |
| `productTitle` | string | ❌ | Product title |
| `productUrl` | string | ❌ | Product URL |
| `variantId` | string | ❌ | Shopify variant GID |
| `userAgent` | string | ❌ | User agent string |
| `ipAddress` | string | ❌ | Client IP address |
| `processingTime` | string | ❌ | Processing time in milliseconds |
| `fileSize` | number | ❌ | Generated image file size in bytes |
| `mimeType` | string | ❌ | Generated image MIME type |
| `errorMessage` | string | ❌ | Error message if status is `failed` |
| `createdAt` | timestamp | ✅ | Record creation timestamp |
| `updatedAt` | timestamp | ✅ | Record last update timestamp |

### Key Generation Logic

- **personKey**: SHA256 hash of `personImageIdentifier`
  - If demo person: `personImageIdentifier = "demo_${demoPersonId}"`
  - If uploaded: `personImageIdentifier = SHA256(personImageBuffer)`
  - Then: `personKey = SHA256(personImageIdentifier)`

- **clothingKey**: SHA256 hash of `clothingImageIdentifier`
  - If URL: `clothingImageIdentifier = clothingImageUrl`
  - If uploaded: `clothingImageIdentifier = SHA256(clothingImageBuffer)`
  - Then: `clothingKey = SHA256(clothingImageIdentifier)`

---

## Optimizations

### 1. Parallel Processing

- **Gemini API call** and **S3 uploads** run simultaneously using `Promise.allSettled`
- Reduces total processing time by ~30-40%

### 2. Database-First Deduplication

- Checks database **before** S3 for existing images
- Falls back to S3 check if database check fails
- Only uploads if image doesn't exist in either location
- Saves ~50-100ms per check

### 3. No Image Compression

- Uses **original images** directly (no compression)
- Preserves maximum quality
- Saves ~200-500ms processing time
- Only handles AVIF conversion (required by Gemini)

### 4. Credit Deduction After Success

- Credits are deducted **after** successful generation
- No refund logic needed (simpler error handling)
- Failed requests don't consume credits

### 5. Deterministic Keys

- Image keys are generated deterministically from image identifiers
- Same image always produces same key
- Enables efficient deduplication

---

## Migration Guide

### Breaking Changes

#### 1. Removed: `compression` Object from Response

**Before:**
```json
{
  "image": "data:image/...",
  "compression": {
    "personImage": {
      "compressed": true,
      "originalSize": "2.5 MB",
      "compressedSize": "1.2 MB",
      "compressionRatio": "52%"
    },
    "clothingImage": { ... },
    "totalCompressionRatio": "50%"
  }
}
```

**After:**
```json
{
  "image": "data:image/...",
  "imageUrl": "https://...",
  "generatedImageKey": "..."
}
```

**Action Required:** Remove any code that reads `response.compression` fields.

#### 2. Removed: `personKey` and `clothingKey` from Request Body

**Before:**
```javascript
formData.append('personKey', 'custom_key');
formData.append('clothingKey', 'custom_key');
```

**After:**
```javascript
// Remove these fields - they are now auto-generated
```

**Action Required:** Remove `personKey` and `clothingKey` from request body. They are now auto-generated from image identifiers.

### New Features

#### 1. Added: `demoPersonId` Support

**New:**
```javascript
formData.append('demoPersonId', 'demo_01');
// No need to upload personImage file
```

**Action Required:** Optional - can use demo persons instead of uploading person images.

---

## Rate Limits

- **File size limit:** 10 MB per file
- **File count limit:** 2 files maximum
- **Rate limiting:** Handled by Gemini API (429 responses if exceeded)

---

## Authentication

- **Optional authentication** via `optionalAuth()` middleware
- **Shop domain** required for credit tracking (via `shop` query param or `storeName` body field)
- **Access token** must exist in database for shop domain

---

## Language Support

- **Auto-detection:** From `Accept-Language` header
- **Manual override:** Via `language` field in request body
- **Supported languages:** English (`en`), French (`fr`)
- **Error messages:** Localized based on detected/requested language

---

## Image Format Support

### Input Formats
- JPEG (`image/jpeg`, `image/jpg`)
- PNG (`image/png`)
- WebP (`image/webp`)
- AVIF (`image/avif`) - Automatically converted to PNG

### Output Format
- PNG (`image/png`) - Base64 data URL

### Size Limits
- **Minimum:** 1 KB per file
- **Maximum:** 10 MB per file

---

## Performance Characteristics

### Typical Processing Times

- **Image upload + validation:** ~100-200ms
- **Database record creation:** ~50-100ms
- **Gemini API call:** ~5-15 seconds (varies by image size/complexity)
- **S3 uploads:** ~200-500ms (runs in parallel with Gemini)
- **Total time:** ~5-16 seconds (mostly Gemini API)

### Deduplication Benefits

- **Database hit:** ~50ms (vs ~200-500ms for upload)
- **S3 hit:** ~100ms (vs ~200-500ms for upload)
- **New upload:** ~200-500ms

---

## Best Practices

1. **Use Demo Persons for Testing**
   - Faster testing without uploading person images
   - Consistent results for same demo person

2. **Provide Shop Domain for Credit Tracking**
   - Use `shop` query parameter (preferred)
   - Or `storeName` in request body

3. **Handle Async Responses**
   - API returns immediately with job ID
   - Use status endpoint to check progress
   - Poll status endpoint every 1-2 seconds

4. **Error Handling**
   - Check response status codes
   - Handle rate limit errors (429) with retry logic
   - Handle safety blocks with user-friendly messages

5. **Image Quality**
   - Use high-quality images (but under 10MB)
   - Ensure good lighting and clear visibility
   - Avoid explicit or inappropriate content

---

## Changelog

### Version 2.0 (Current)

**Added:**
- ✅ Demo person support (`demoPersonId`)
- ✅ Database-first deduplication
- ✅ Parallel Gemini API + S3 uploads
- ✅ Auto-generated `personKey` and `clothingKey`
- ✅ `demoPersonId` field in database records

**Removed:**
- ❌ `compression` object from responses
- ❌ Image compression (using original images)
- ❌ `personKey` and `clothingKey` from request body
- ❌ Credit refund logic (deduct after success instead)

**Changed:**
- 🔄 Credit deduction moved to after successful generation
- 🔄 Image processing uses original images (no compression)
- 🔄 Improved error messages and validation

---

## Support

For issues or questions:
- Check error responses for detailed error information
- Review logs using `requestId` from responses
- Contact support with `requestId` and error details

---

**Last Updated:** 2024-01-15  
**API Version:** 2.0

