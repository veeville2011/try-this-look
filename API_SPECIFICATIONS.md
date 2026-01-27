# API Specifications - Image Generations

This document provides comprehensive API specifications for customer image-related endpoints.

---

## API 1: Get Image Generations by Customer

**Endpoint:** `GET /api/image-generations/customer`

**Description:** Returns all image generation records (try-on results) for a customer, filtered by email and store. Defaults to completed generations only.

### Request

**Method:** `GET`

**URL:** `/api/image-generations/customer`

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `email` | string | Yes | - | Customer email address (max 320 chars, RFC 5321 compliant) |
| `store` | string | Yes | - | Store name (e.g., `myshop.myshopify.com`) |
| `page` | number | No | `1` | Page number (must be ≥ 1) |
| `limit` | number | No | `10` | Items per page (1-100) |
| `status` | string | No | `completed` | Filter by status: `pending`, `processing`, `completed`, `failed` |
| `orderBy` | string | No | `created_at` | Order field: `created_at`, `createdAt`, `updated_at`, `updatedAt`, `status` |
| `orderDirection` | string | No | `DESC` | Order direction: `ASC` or `DESC` |
| `startDate` | string | No | - | Start date filter (`YYYY-MM-DD`) |
| `endDate` | string | No | - | End date filter (`YYYY-MM-DD`) |

### Request Examples

**Basic Request:**
```bash
GET /api/image-generations/customer?email=customer@example.com&store=myshop.myshopify.com&page=1&limit=10&status=completed
```

**With Date Range:**
```bash
GET /api/image-generations/customer?email=customer@example.com&store=myshop.myshopify.com&startDate=2024-01-01&endDate=2024-01-31&orderBy=created_at&orderDirection=DESC
```

**Get All Statuses:**
```bash
GET /api/image-generations/customer?email=customer@example.com&store=myshop.myshopify.com&status=pending&page=1&limit=20
```

### Response

**Success Response (200 OK):**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid-here",
      "requestId": "req_1234567890_abc123",
      "personImageUrl": "https://s3.amazonaws.com/bucket/person/image.jpg",
      "clothingImageUrl": "https://s3.amazonaws.com/bucket/clothing/image.jpg",
      "generatedImageUrl": "https://s3.amazonaws.com/bucket/generated/image.jpg",
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T10:35:00.000Z"
    }
  ],
  "pagination": {
    "total": 50,
    "page": 1,
    "limit": 10,
    "totalPages": 5,
    "hasNext": true,
    "hasPrev": false
  }
}
```

**Error Responses:**

**400 Bad Request - Missing email:**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Missing required query parameter: email",
    "details": {
      "parameter": "email"
    }
  }
}
```

**400 Bad Request - Missing store:**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Missing required query parameter: store",
    "details": {
      "parameter": "store"
    }
  }
}
```

**400 Bad Request - Invalid email format:**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid email format",
    "details": {
      "email": "invalid-email"
    }
  }
}
```

**400 Bad Request - Invalid pagination:**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid limit parameter. Must be between 1 and 100.",
    "details": {
      "limit": "150"
    }
  }
}
```

**400 Bad Request - Invalid status:**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid status parameter. Must be one of: pending, processing, completed, failed",
    "details": {
      "status": "invalid_status"
    }
  }
}
```

**400 Bad Request - Invalid date format:**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid startDate format. Expected YYYY-MM-DD.",
    "details": {
      "startDate": "01-01-2024"
    }
  }
}
```

**503 Service Unavailable:**
```json
{
  "success": false,
  "error": {
    "code": "SERVER_ERROR",
    "message": "Database service unavailable",
    "details": {
      "service": "database"
    }
  }
}
```

**500 Internal Server Error:**
```json
{
  "success": false,
  "error": {
    "code": "SERVER_ERROR",
    "message": "An error occurred while fetching image generations",
    "details": {
      "originalError": "Error message here"
    }
  }
}
```

---

## API 2: Get Uploaded Images by Customer

**Endpoint:** `GET /api/image-generations/uploaded-images`

**Description:** Returns all distinct person images uploaded by a customer. Returns unique images only (deduplicated by URL). Useful for displaying a customer's uploaded image library.

### Request

**Method:** `GET`

**URL:** `/api/image-generations/uploaded-images`

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `email` | string | Yes | - | Customer email address (max 320 chars, RFC 5321 compliant) |
| `store` | string | No | - | Store name filter (optional) |
| `page` | number | No | `1` | Page number (must be ≥ 1) |
| `limit` | number | No | `10` | Items per page (1-100) |
| `startDate` | string | No | - | Start date filter (`YYYY-MM-DD`) |
| `endDate` | string | No | - | End date filter (`YYYY-MM-DD`) |

### Request Examples

**Basic Request:**
```bash
GET /api/image-generations/uploaded-images?email=customer@example.com&page=1&limit=10
```

**With Store Filter:**
```bash
GET /api/image-generations/uploaded-images?email=customer@example.com&store=myshop.myshopify.com&page=1&limit=20
```

**With Date Range:**
```bash
GET /api/image-generations/uploaded-images?email=customer@example.com&startDate=2024-01-01&endDate=2024-01-31
```

### Response

**Success Response (200 OK):**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid-here",
      "requestId": "req_1234567890_abc123",
      "personImageUrl": "https://s3.amazonaws.com/bucket/person/image.jpg",
      "personKey": "abc123def456",
      "storeName": "myshop.myshopify.com",
      "uploadedAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z"
    }
  ],
  "pagination": {
    "total": 25,
    "page": 1,
    "limit": 10,
    "totalPages": 3,
    "hasNext": true,
    "hasPrev": false
  }
}
```

**Error Responses:**

**400 Bad Request - Missing email:**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Missing required query parameter: email",
    "details": {
      "parameter": "email"
    }
  }
}
```

**400 Bad Request - Invalid email format:**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid email format",
    "details": {
      "email": "invalid-email"
    }
  }
}
```

**400 Bad Request - Email too long:**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Email address too long. Maximum 320 characters.",
    "details": {
      "emailLength": 350
    }
  }
}
```

**400 Bad Request - Invalid pagination:**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid page parameter. Must be a positive integer.",
    "details": {
      "page": "0"
    }
  }
}
```

**400 Bad Request - Invalid date format:**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid startDate format. Expected YYYY-MM-DD.",
    "details": {
      "startDate": "01-01-2024"
    }
  }
}
```

**503 Service Unavailable:**
```json
{
  "success": false,
  "error": {
    "code": "SERVER_ERROR",
    "message": "Database service unavailable",
    "details": {
      "service": "database"
    }
  }
}
```

**500 Internal Server Error:**
```json
{
  "success": false,
  "error": {
    "code": "SERVER_ERROR",
    "message": "An error occurred while fetching uploaded images",
    "details": {
      "originalError": "Error message here"
    }
  }
}
```

---

## Comparison Table

| Feature | API 1: `/customer` | API 2: `/uploaded-images` |
|---------|---------------------|---------------------------|
| **Purpose** | Get all try-on generation records | Get distinct uploaded person images |
| **Store Parameter** | Required | Optional |
| **Status Filter** | Yes (defaults to `completed`) | No (only returns records with person images) |
| **Ordering** | Configurable (`orderBy`, `orderDirection`) | Fixed (by `uploadedAt` DESC) |
| **Deduplication** | No | Yes (unique `personImageUrl` only) |
| **Returns** | Full generation records | Only person image data |
| **Use Case** | View try-on history/results | View uploaded image library |

---

## Common Notes

### Authentication
- Both endpoints are **public** (no authentication required)
- Rate limiting may apply based on server configuration

### Email Matching
- Email matching is **case-insensitive**
- Emails are normalized to lowercase before querying
- Maximum email length: 320 characters (RFC 5321 compliant)

### Date Format
- All dates must be in `YYYY-MM-DD` format
- Examples: `2024-01-15`, `2024-12-31`
- Date ranges are inclusive (includes both start and end dates)

### Pagination
- Page numbers start at **1** (not 0)
- Maximum `limit` value is **100**
- Pagination metadata includes:
  - `total`: Total number of records
  - `page`: Current page number
  - `limit`: Items per page
  - `totalPages`: Total number of pages
  - `hasNext`: Boolean indicating if there's a next page
  - `hasPrev`: Boolean indicating if there's a previous page

### Response Fields

#### Image Generation Record Fields (API 1):
- `id`: Unique database record ID (UUID)
- `requestId`: Unique request identifier
- `personImageUrl`: URL of uploaded person image (S3 URL)
- `clothingImageUrl`: URL of product/clothing image (S3 URL)
- `generatedImageUrl`: URL of generated try-on result (S3 URL)
- `createdAt`: Record creation timestamp (ISO 8601)
- `updatedAt`: Record last update timestamp (ISO 8601)

#### Uploaded Image Fields (API 2):
- `id`: Unique database record ID (UUID)
- `requestId`: Unique request identifier
- `personImageUrl`: URL of uploaded person image (S3 URL)
- `personKey`: Unique key for the person image (for deduplication)
- `storeName`: Store name where image was uploaded
- `uploadedAt`: When the image was uploaded (ISO 8601)
- `updatedAt`: When the record was last updated (ISO 8601)

### Error Codes

| Code | Description |
|------|-------------|
| `VALIDATION_ERROR` | Invalid request parameters or format |
| `SERVER_ERROR` | Internal server error or service unavailable |

### CORS
- CORS is configured per server settings
- Check server configuration for allowed origins

### Rate Limiting
- Subject to server rate limits
- Check server configuration for specific limits

---

## Use Cases

### API 1: `/customer`
- **Customer Dashboard**: Display all try-on attempts and results
- **Order History**: Show completed try-on generations
- **Status Tracking**: Monitor pending/processing generations
- **Analytics**: Track customer engagement with try-on feature

### API 2: `/uploaded-images`
- **Image Library**: Display customer's uploaded images gallery
- **Image Selection**: Allow customers to reuse previously uploaded images
- **Image Management**: Show all unique images uploaded by customer
- **Quick Access**: Fast retrieval of customer's image collection

---

## Example Integration

### JavaScript/TypeScript Example

```typescript
// Get image generations
async function getImageGenerations(email: string, store: string) {
  const response = await fetch(
    `/api/image-generations/customer?email=${encodeURIComponent(email)}&store=${encodeURIComponent(store)}&page=1&limit=10`
  );
  const data = await response.json();
  return data;
}

// Get uploaded images
async function getUploadedImages(email: string, store?: string) {
  const params = new URLSearchParams({
    email,
    page: '1',
    limit: '10',
  });
  if (store) params.append('store', store);
  
  const response = await fetch(
    `/api/image-generations/uploaded-images?${params.toString()}`
  );
  const data = await response.json();
  return data;
}
```

### cURL Examples

**Get Image Generations:**
```bash
curl -X GET "https://api.example.com/api/image-generations/customer?email=customer@example.com&store=myshop.myshopify.com&page=1&limit=10"
```

**Get Uploaded Images:**
```bash
curl -X GET "https://api.example.com/api/image-generations/uploaded-images?email=customer@example.com&page=1&limit=10"
```

---

## Version History

- **v1.0.0** (2024-01-15): Initial API specifications
  - Added `/customer` endpoint
  - Added `/uploaded-images` endpoint

---

## Support

For API support or questions, please contact the development team or refer to the main API documentation.

