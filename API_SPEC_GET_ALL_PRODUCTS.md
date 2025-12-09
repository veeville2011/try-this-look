# API Specification: Get All Products

## Endpoint
```
GET /api/products
```

## Description
Retrieves all products from a Shopify store that were created today. Supports filtering, searching, sorting, and pagination. Returns only products created on the current date (today).

---

## Authentication
No authentication token required. Uses shop domain to retrieve access token from database.

---

## Request

### Method
```
GET
```

### URL
```
{{baseUrl}}/api/products
```

### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `shop` | string | ✅ Yes | - | Shopify store domain (e.g., `your-store.myshopify.com` or `your-store`) |
| `limit` | number | ❌ No | `50` | Number of products to return per page (min: 1, max: 250) |
| `after` | string | ❌ No | `null` | Cursor for pagination (returned in `pageInfo.endCursor` from previous response) |
| `query` | string | ❌ No | - | Search query for filtering products (Shopify search syntax) |
| `status` | string | ❌ No | - | Filter by product status. Valid values: `ACTIVE`, `DRAFT`, `ARCHIVED` |
| `productType` | string | ❌ No | - | Filter by product type (e.g., `Shirt`, `Pants`, `Shoes`) |
| `vendor` | string | ❌ No | - | Filter by vendor name |
| `sortKey` | string | ❌ No | - | Sort products by key. Valid values: `TITLE`, `CREATED_AT`, `UPDATED_AT`, `PRICE`, `PRODUCT_TYPE`, `VENDOR`, `RELEVANCE` |

### Query Parameter Details

#### `shop` (Required)
- **Format**: `your-store.myshopify.com` or `your-store`
- **Normalization**: Automatically normalized to `your-store.myshopify.com` format
- **Example**: `shop=my-store.myshopify.com` or `shop=my-store`

#### `limit` (Optional)
- **Type**: Integer
- **Range**: 1-250
- **Default**: 50
- **Behavior**: If value exceeds 250, it's automatically capped at 250
- **Example**: `limit=100`

#### `after` (Optional - Pagination)
- **Type**: String (cursor)
- **Description**: Cursor from previous response's `pageInfo.endCursor`
- **Usage**: Use this to fetch the next page of results
- **Example**: `after=eyJsYXN0X2lkIjo...`

#### `query` (Optional - Search)
- **Type**: String
- **Description**: Shopify search query syntax for filtering products
- **Example**: `query=red shirt` or `query=title:shirt`

#### `status` (Optional - Filter)
- **Type**: String
- **Valid Values**: 
  - `ACTIVE` - Active products
  - `DRAFT` - Draft products
  - `ARCHIVED` - Archived products
- **Example**: `status=ACTIVE`

#### `productType` (Optional - Filter)
- **Type**: String
- **Description**: Filter by product type
- **Example**: `productType=Shirt`

#### `vendor` (Optional - Filter)
- **Type**: String
- **Description**: Filter by vendor name
- **Example**: `vendor=Nike`

#### `sortKey` (Optional - Sorting)
- **Type**: String
- **Valid Values**:
  - `TITLE` - Sort by product title (A-Z)
  - `CREATED_AT` - Sort by creation date (newest first)
  - `UPDATED_AT` - Sort by last update date (newest first)
  - `PRICE` - Sort by price (low to high)
  - `PRODUCT_TYPE` - Sort by product type
  - `VENDOR` - Sort by vendor name
  - `RELEVANCE` - Sort by relevance (when using search query)
- **Example**: `sortKey=CREATED_AT`

---

## Special Behavior

### Automatic Date Filtering
**IMPORTANT**: This endpoint automatically filters products to only return those created **today** (current date). This filter is applied automatically and cannot be disabled.

- Products are filtered by `created_at` date
- Only products created on the current date are returned
- Filter is applied at both Shopify API query level and client-side for precision
- Date range: `created_at >= today 00:00:00 AND created_at < tomorrow 00:00:00`

---

## Response

### Success Response (200 OK)

#### Response Structure
```json
{
  "success": true,
  "message": "Products retrieved successfully",
  "data": {
    "products": [
      {
        "id": "gid://shopify/Product/123456789",
        "title": "Product Title",
        "images": {
          "nodes": [
            {
              "id": "gid://shopify/ProductImage/987654321",
              "url": "https://cdn.shopify.com/...",
              "altText": "Product image alt text",
              "width": 1024,
              "height": 1024
            }
          ]
        }
      }
    ],
    "total": 25,
    "pageInfo": {
      "hasNextPage": false,
      "endCursor": "eyJsYXN0X2lkIjo..."
    },
    "filters": {
      "query": "created_at:>=2025-01-15 created_at:<2025-01-16",
      "limit": 50
    }
  }
}
```

#### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `success` | boolean | Indicates if the request was successful |
| `message` | string | Human-readable message |
| `data` | object | Response data container |
| `data.products` | array | Array of product objects |
| `data.products[].id` | string | Product GraphQL GID (e.g., `gid://shopify/Product/123456789`) |
| `data.products[].title` | string | Product title |
| `data.products[].images` | object | Product images container |
| `data.products[].images.nodes` | array | Array of product image objects |
| `data.products[].images.nodes[].id` | string | Image GraphQL GID |
| `data.products[].images.nodes[].url` | string | Image URL |
| `data.products[].images.nodes[].altText` | string | Image alt text |
| `data.products[].images.nodes[].width` | number | Image width in pixels |
| `data.products[].images.nodes[].height` | number | Image height in pixels |
| `data.total` | number | Total number of products returned in this response |
| `data.pageInfo` | object | Pagination information |
| `data.pageInfo.hasNextPage` | boolean | Indicates if there are more products available |
| `data.pageInfo.endCursor` | string\|null | Cursor to use for fetching next page (use in `after` parameter) |
| `data.filters` | object | Applied filters and parameters |
| `data.filters.query` | string | Combined query string used for filtering |
| `data.filters.limit` | number | Limit used for this request |

---

## Error Responses

### 400 Bad Request - Missing Shop Parameter
```json
{
  "success": false,
  "error": "Validation Error",
  "message": "Missing required query parameter: shop"
}
```

### 400 Bad Request - Invalid Shop Domain
```json
{
  "success": false,
  "error": "Validation Error",
  "message": "Invalid shop domain format"
}
```

### 404 Not Found - Store Not Found
```json
{
  "success": false,
  "error": "Not Found",
  "message": "Store not found or not installed: your-store.myshopify.com"
}
```

### 200 OK - No Products Found
```json
{
  "success": true,
  "message": "No products found",
  "data": {
    "products": [],
    "total": 0,
    "pageInfo": {
      "hasNextPage": false,
      "endCursor": null
    },
    "filters": {
      "query": "created_at:>=2025-01-15 created_at:<2025-01-16",
      "limit": 50
    }
  }
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "error": "Internal Server Error",
  "message": "An unexpected error occurred"
}
```

---

## Examples

### Example 1: Basic Request
**Request:**
```http
GET /api/products?shop=my-store.myshopify.com
```

**Response:**
```json
{
  "success": true,
  "message": "Products retrieved successfully",
  "data": {
    "products": [
      {
        "id": "gid://shopify/Product/123456789",
        "title": "Blue T-Shirt",
        "images": {
          "nodes": [
            {
              "id": "gid://shopify/ProductImage/987654321",
              "url": "https://cdn.shopify.com/s/files/1/0123/4567/products/blue-tshirt.jpg",
              "altText": "Blue T-Shirt",
              "width": 1024,
              "height": 1024
            }
          ]
        }
      }
    ],
    "total": 1,
    "pageInfo": {
      "hasNextPage": false,
      "endCursor": null
    },
    "filters": {
      "query": "created_at:>=2025-01-15 created_at:<2025-01-16",
      "limit": 50
    }
  }
}
```

### Example 2: With Filters and Pagination
**Request:**
```http
GET /api/products?shop=my-store.myshopify.com&limit=25&status=ACTIVE&productType=Shirt&sortKey=CREATED_AT
```

**Response:**
```json
{
  "success": true,
  "message": "Products retrieved successfully",
  "data": {
    "products": [
      {
        "id": "gid://shopify/Product/123456789",
        "title": "Red Shirt",
        "images": {
          "nodes": [
            {
              "id": "gid://shopify/ProductImage/987654321",
              "url": "https://cdn.shopify.com/...",
              "altText": "Red Shirt",
              "width": 1024,
              "height": 1024
            }
          ]
        }
      }
    ],
    "total": 25,
    "pageInfo": {
      "hasNextPage": true,
      "endCursor": "eyJsYXN0X2lkIjo..."
    },
    "filters": {
      "query": "status:ACTIVE product_type:Shirt created_at:>=2025-01-15 created_at:<2025-01-16",
      "limit": 25,
      "sortKey": "CREATED_AT"
    }
  }
}
```

### Example 3: Pagination (Next Page)
**Request:**
```http
GET /api/products?shop=my-store.myshopify.com&limit=25&after=eyJsYXN0X2lkIjo...
```

**Response:**
```json
{
  "success": true,
  "message": "Products retrieved successfully",
  "data": {
    "products": [
      {
        "id": "gid://shopify/Product/123456790",
        "title": "Green Shirt",
        "images": {
          "nodes": []
        }
      }
    ],
    "total": 10,
    "pageInfo": {
      "hasNextPage": false,
      "endCursor": null
    },
    "filters": {
      "query": "created_at:>=2025-01-15 created_at:<2025-01-16",
      "limit": 25
    }
  }
}
```

### Example 4: Search Query
**Request:**
```http
GET /api/products?shop=my-store.myshopify.com&query=red&limit=10
```

**Response:**
```json
{
  "success": true,
  "message": "Products retrieved successfully",
  "data": {
    "products": [
      {
        "id": "gid://shopify/Product/123456789",
        "title": "Red T-Shirt",
        "images": {
          "nodes": [
            {
              "id": "gid://shopify/ProductImage/987654321",
              "url": "https://cdn.shopify.com/...",
              "altText": "Red T-Shirt",
              "width": 1024,
              "height": 1024
            }
          ]
        }
      }
    ],
    "total": 1,
    "pageInfo": {
      "hasNextPage": false,
      "endCursor": null
    },
    "filters": {
      "query": "red created_at:>=2025-01-15 created_at:<2025-01-16",
      "limit": 10
    }
  }
}
```

---

## Notes

1. **Date Filtering**: Products are automatically filtered to only include those created today. This is a built-in feature and cannot be disabled.

2. **Pagination**: Use `pageInfo.endCursor` from the response as the `after` parameter to fetch the next page.

3. **Limit**: Maximum limit is 250 products per request. If a higher value is provided, it's automatically capped at 250.

4. **Shop Domain**: The `shop` parameter accepts both formats:
   - `your-store.myshopify.com` (full domain)
   - `your-store` (short format, automatically normalized)

5. **Product Fields**: The response only includes:
   - `id` - Product GraphQL GID
   - `title` - Product title
   - `images` - Product images with full details

6. **Filter Combination**: Multiple filters can be combined. They are automatically merged into a single query string.

7. **Client-Side Filtering**: In addition to Shopify API filtering, products are also filtered client-side to ensure only products created today are returned (for precision).

8. **Empty Images**: If a product has no images, the `images.nodes` array will be empty `[]`.

---

## Rate Limiting
No specific rate limiting is implemented at the API level. However, Shopify API rate limits apply.

---

## Related Endpoints
- `GET /api/products/:productId` - Get a single product by ID

