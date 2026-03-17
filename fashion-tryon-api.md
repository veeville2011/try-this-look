### Fashion Try‑On API

#### Overview

- **Name**: Fashion Try‑On  
- **Method**: `POST`  
- **Path**: `/api/fashion-tryon`  
- **Purpose**: Submit an **asynchronous job** that generates a virtual try‑on image for a specific **Shopify product variant** and **person** (demo or uploaded).  
- **Pattern**: Fire‑and‑forget job → **poll status** via `GET /api/fashion-tryon/status/:jobId`.  
- **Auth**: Public with optional customer authentication (`optionalAuth()` middleware).

---

### Request

#### URL

`POST /api/fashion-tryon`

#### Headers

- **Required**
  - `Content-Type: multipart/form-data; boundary=...`
- **Used internally (optional but recommended)**
  - `User-Agent: <any>` – logged, stored in DB.
  - `Accept-Language: <locale>` – used for localized error messages.

#### Body (multipart/form-data)

##### Required text fields

- **`variantId`** (string, required)  
  Shopify GraphQL ID (GID) of the product variant (or product).  
  **Format (validated)**:
  - Regex: `^gid:\/\/shopify\/(ProductVariant|Product)\/\d+$`  
  **Examples**:
  - `gid://shopify/ProductVariant/1234567890`  
  - `gid://shopify/Product/9876543210`

- **`shop`** (string, required)  
  Shopify shop domain; normalized internally.  
  Accepts forms like:
  - `my-store`
  - `my-store.myshopify.com`
  - `https://my-store.myshopify.com`

##### Person selection (mutually exclusive)

Exactly **one** of the following must be provided:

- **Option A: Demo person**

  - **`demoPersonId`** (string, optional)  
    Valid values:  
    `demo_01`, `demo_02`, `demo_03`, `demo_04`,  
    `demo_05`, `demo_06`, `demo_07`, `demo_08`,  
    `demo_09`, `demo_10`, `demo_11`, `demo_12`,  
    `demo_13`, `demo_14`, `demo_15`, `demo_16`

- **Option B: Uploaded person image**

  - **`personImage`** (file, optional)
    - Field name: `personImage`
    - Count: max `1` file
    - Max size: `10 MB`
    - Allowed MIME types:
      - `image/jpeg`
      - `image/jpg`
      - `image/png`
      - `image/webp`
      - `image/avif`

**Rules:**

- If **neither** `demoPersonId` nor `personImage` is provided → `400`.  
- If **both** are provided → `400`.

##### Clothing / product images

- **No clothing image fields** are accepted.  
- Product / clothing imagery is resolved **server-side** from Shopify using:
  - `variantId` → `fetchVariantData(shopDomain, variantId)`  
  This yields:
  - A main try‑on product image.
  - Optional reference images (used as extra context for the AI model).

---

### Behavior & Processing

1. **Input validation**
   - `variantId` present and matches GID regex.
   - `shop` present and normalizable to a valid Shopify domain.
   - Exactly one of `demoPersonId` / `personImage`.
   - If `demoPersonId` provided, must be in `demo_01..demo_16`.

2. **Credit / subscription pre‑check**
   - Uses normalized `shopDomain` to call `checkSubscriptionAndCredits(shopDomain)`.  
   - If the shop **cannot generate**:
     - Request is rejected with `403` and detailed reason.
   - No credits are deducted at this stage.

3. **Database record creation**
   - A row is created in `image_generations` with:
     - `requestId` (the `jobId` returned to client)
     - `status: "pending"`
     - `statusDescription`:  
       `"Your try-on request has been received and will be processed shortly..."`
     - `storeName: shopDomain`
     - `variantId`
     - `productId`, `productTitle`, `productUrl`: `null` (filled later)
     - `userAgent`, `ipAddress`
   - If this fails, the request returns `500` and no job is created.

4. **Background processing (non-blocking for client)**
   - Triggered after DB insert; does **not** affect initial response.
   - Steps (simplified):
     - Fetch product/variant data and images from Shopify.
     - Resolve person image:
       - Demo: from internal S3 / assets.
       - Uploaded: from `personImage` file.
     - Deduplicate + upload person & product images to S3 (DB‑first + S3 check).
     - Build AI prompt from product data.
     - Call Gemini with:
       - Prompt.
       - Person image + product image.
       - Up to 4 reference images (if available, non‑critical).
       - For non‑demo shops, force output size to `2K`.
     - Extract generated image (data URL → buffer).
     - Upload generated image to S3 (no compression).
     - Deduct **1 credit** from the shop: `deductCredits(shopDomain, 1)`.
     - Update DB record to:
       - `status: "completed"` or `status: "failed"`,
       - With `generatedImageUrl`, `processingTime`, product metadata, and stored image URLs/keys.

5. **Client-facing pattern**
   - Frontend **never** gets the generated image in the POST response.
   - Use provided `jobId` to poll the status endpoint.

---

### Responses

#### 1. Success: job accepted

- **Status**: `202 Accepted`

```json
{
  "status": "accepted",
  "jobId": "<string>",
  "message": "Job submitted successfully. Use the status endpoint to check progress.",
  "statusUrl": "/api/fashion-tryon/status/<jobId>"
}
```

- **Notes for frontend**:
  - Store `jobId`.
  - Construct full status URL if needed, e.g. `https://your-server.com/api/fashion-tryon/status/<jobId>`.

---

#### 2. Validation / business errors (4xx)

All 4xx responses follow this logical shape:

```json
{
  "success": false,
  "error": {
    "code": "<ERROR_CODE>",
    "message": "<Human readable message>",
    "details": { }
  }
}
```

Key scenarios:

- **Missing `variantId`**
  - `400 Bad Request`
  - `message`: `"variantId is required"`
  - `details.field`: `"variantId"`

- **Invalid `variantId` format**
  - `400 Bad Request`
  - `message`: `"variantId must be a valid Shopify GraphQL ID (GID) format: gid://shopify/ProductVariant/123456789"`
  - `details.field`: `"variantId"`
  - `details.provided`: `"<your value>"`

- **Missing `shop`**
  - `400 Bad Request`
  - `message`: `"shop is required"`
  - `details.field`: `"shop"`

- **Invalid shop domain**
  - `400 Bad Request`
  - `message`: `"Invalid shop domain format"` or a more specific parsing error.
  - `details.shop`: `"<your value>"`

- **No person option (demo or file)**
  - `400 Bad Request`
  - `message`: `"Either demoPersonId or personImage must be provided"`

- **Both `demoPersonId` and `personImage` present**
  - `400 Bad Request`
  - `message`: `"Cannot provide both demoPersonId and personImage. Provide only one."`

- **Invalid `demoPersonId`**
  - `400 Bad Request`
  - `message`: `"Invalid demoPersonId: <value>. Use demo_01 through demo_16."`
  - `details.availableIds`: list of valid demo IDs.

- **Credit / subscription check fails (business)**
  - `403 Forbidden`
  - `code`: `VALIDATION_ERROR`
  - `message`: `creditCheck.reason` or `"Insufficient credits. Please purchase credits or wait for your next billing period."`
  - `details` includes `reason`, `creditBalance`, `creditBreakdown`, `overageInfo`.

- **Credit check throws (technical)**
  - `403 Forbidden`
  - `message`: `"Failed to process credit check. Please try again."` or underlying error message.
  - `details.shopDomain` and `details.error`.

---

#### 3. Infrastructure / server errors (5xx)

- **Database unavailable (before creating job)**
  - `503 Service Unavailable`
  - `code`: `SERVER_ERROR`
  - `message`: `"Database service unavailable"`
  - `details.service`: `"database"`

- **Failure to create job record**
  - `500 Internal Server Error`
  - `code`: `SERVER_ERROR`
  - `message`: `"Failed to create job record"`
  - `details.originalError`: DB error message.

- **Unexpected submission error**
  - `500 Internal Server Error`
  - `code`: `SERVER_ERROR`
  - `message`: `"Failed to submit job"`
  - `details.originalError`: error message.

> Failures during AI/S3 processing after job creation are reflected in the **status** endpoint, not in the POST response.

---

### Status Endpoint (for frontend polling)

Although not part of the POST itself, this is required to use the API end‑to‑end.

#### URL

`GET /api/fashion-tryon/status/:jobId`

#### Response (simplified)

```json
{
  "jobId": "<jobId>",
  "status": "pending" | "processing" | "completed" | "failed",
  "createdAt": "<ISO timestamp>",
  "updatedAt": "<ISO timestamp>",
  "statusDescription": "<string | null>",
  "imageUrl": "<string | null>",
  "processingTime": "<string | null>",
  "error": {
    "code": "PROCESSING_FAILURE",
    "message": "<reason>"
  }
}
```

#### Recommended client flow

1. `POST /api/fashion-tryon` with required fields and file.  
2. On `202 Accepted`, extract `jobId` and `statusUrl`.  
3. Poll `GET /api/fashion-tryon/status/:jobId` every few seconds until:
   - `status === "completed"` → use `imageUrl`.
   - `status === "failed"` → show error.

