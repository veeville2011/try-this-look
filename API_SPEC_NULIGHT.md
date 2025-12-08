# Nulight Products API Specification

## Overview
The Nulight API endpoint fetches products that were created today and are active, with a fixed limit of 5 products per page and full pagination support.

**Base URL:** `/api/nulight`

---

## Endpoint

### GET `/api/nulight`

Retrieves products created today that have an `ACTIVE` status.

---

## Request

### Method
`GET`

### Headers
```
Content-Type: application/json
```

### Query Parameters

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| `shop` | string | ✅ Yes | Shop domain (can be full domain or handle) | `example.myshopify.com` or `example` |
| `after` | string | ❌ No | Cursor for pagination (returned in previous response) | `eyJsYXN0X2lkIjoxMjM0NTY3ODkw...` |

### Example Request

```bash
# First page
GET /api/nulight?shop=example.myshopify.com

# Next page (with pagination cursor)
GET /api/nulight?shop=example.myshopify.com&after=eyJsYXN0X2lkIjoxMjM0NTY3ODkw...
```

---

## Response

### Success Response (200 OK)

```json
{
  "success": true,
  "message": "Nulight products retrieved successfully",
  "data": {
    "products": [
      {
        "id": "gid://shopify/Product/123456789",
        "title": "Product Title",
        "handle": "product-handle",
        "description": "Product description",
        "descriptionHtml": "<p>Product description</p>",
        "vendor": "Vendor Name",
        "productType": "Product Type",
        "status": "ACTIVE",
        "tags": ["tag1", "tag2"],
        "createdAt": "2025-01-XXT00:00:00Z",
        "updatedAt": "2025-01-XXT00:00:00Z",
        "publishedAt": "2025-01-XXT00:00:00Z",
        "onlineStoreUrl": "https://example.myshopify.com/products/product-handle",
        "onlineStorePreviewUrl": "https://example.myshopify.com/products/product-handle?preview_theme_id=123",
        "totalInventory": 100,
        "hasOnlyDefaultVariant": false,
        "hasOutOfStockVariants": false,
        "priceRangeV2": {
          "minVariantPrice": {
            "amount": "29.99",
            "currencyCode": "USD"
          },
          "maxVariantPrice": {
            "amount": "49.99",
            "currencyCode": "USD"
          }
        },
        "compareAtPriceRange": {
          "minVariantCompareAtPrice": {
            "amount": "39.99",
            "currencyCode": "USD"
          },
          "maxVariantCompareAtPrice": {
            "amount": "59.99",
            "currencyCode": "USD"
          }
        },
        "images": {
          "nodes": [
            {
              "id": "gid://shopify/MediaImage/123456",
              "url": "https://cdn.shopify.com/...",
              "altText": "Product image",
              "width": 1024,
              "height": 1024
            }
          ]
        },
        "variants": {
          "nodes": [
            {
              "id": "gid://shopify/ProductVariant/123456",
              "title": "Default Title",
              "sku": "SKU-123",
              "barcode": "1234567890123",
              "price": "29.99",
              "compareAtPrice": "39.99",
              "availableForSale": true,
              "inventoryQuantity": 50,
              "inventoryPolicy": "DENY",
              "image": {
                "id": "gid://shopify/MediaImage/123456",
                "url": "https://cdn.shopify.com/...",
                "altText": "Variant image"
              },
              "selectedOptions": [
                {
                  "name": "Size",
                  "value": "Large"
                }
              ]
            }
          ]
        },
        "options": {
          "id": "gid://shopify/ProductOption/123",
          "name": "Size",
          "values": ["Small", "Medium", "Large"]
        },
        "media": {
          "nodes": [
            {
              "id": "gid://shopify/MediaImage/123456",
              "image": {
                "id": "gid://shopify/MediaImage/123456",
                "url": "https://cdn.shopify.com/...",
                "altText": "Product image",
                "width": 1024,
                "height": 1024
              }
            }
          ]
        },
        "seo": {
          "title": "SEO Title",
          "description": "SEO Description"
        },
        "collections": {
          "nodes": [
            {
              "id": "gid://shopify/Collection/123456",
              "title": "Collection Name",
              "handle": "collection-handle"
            }
          ]
        }
      }
    ],
    "total": 5,
    "pageInfo": {
      "hasNextPage": true,
      "endCursor": "eyJsYXN0X2lkIjoxMjM0NTY3ODkw..."
    },
    "filters": {
      "createdToday": "2025-01-XX",
      "status": "ACTIVE",
      "limit": 5
    }
  }
}
```

### Empty Response (200 OK - No Products Found)

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
      "createdToday": "2025-01-XX",
      "status": "ACTIVE",
      "limit": 5
    }
  }
}
```

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
  "message": "Store not found or not installed: example.myshopify.com"
}
```

### 500 Internal Server Error

```json
{
  "success": false,
  "error": "Internal Server Error",
  "message": "Failed to retrieve nulight products",
  "details": "Error details (only in development mode)"
}
```

---

## Response Fields

### Product Object

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Product GraphQL ID (GID) |
| `title` | string | Product title |
| `handle` | string | Product URL handle |
| `description` | string | Plain text description |
| `descriptionHtml` | string | HTML description |
| `vendor` | string | Product vendor |
| `productType` | string | Product type |
| `status` | string | Product status (ACTIVE, DRAFT, ARCHIVED) |
| `tags` | array[string] | Product tags |
| `createdAt` | string (ISO 8601) | Creation timestamp |
| `updatedAt` | string (ISO 8601) | Last update timestamp |
| `publishedAt` | string (ISO 8601) | Publication timestamp |
| `onlineStoreUrl` | string | Online store URL |
| `onlineStorePreviewUrl` | string | Preview URL |
| `totalInventory` | number | Total inventory count |
| `hasOnlyDefaultVariant` | boolean | Whether product has only default variant |
| `hasOutOfStockVariants` | boolean | Whether any variants are out of stock |
| `priceRangeV2` | object | Price range information |
| `compareAtPriceRange` | object | Compare at price range |
| `images` | object | Product images (nodes array) |
| `variants` | object | Product variants (nodes array) |
| `options` | object | Product options |
| `media` | object | Product media (images, videos, 3D models) |
| `seo` | object | SEO metadata |
| `collections` | object | Collections this product belongs to |

### PageInfo Object

| Field | Type | Description |
|-------|------|-------------|
| `hasNextPage` | boolean | Whether there are more products available |
| `endCursor` | string \| null | Cursor to use for next page (null if no next page) |

### Filters Object

| Field | Type | Description |
|-------|------|-------------|
| `createdToday` | string | Today's date in YYYY-MM-DD format |
| `status` | string | Filter status (always "ACTIVE") |
| `limit` | number | Products per page (always 5) |

---

## Frontend Integration Examples

### JavaScript/TypeScript (Fetch API)

```typescript
interface NulightResponse {
  success: boolean;
  message: string;
  data: {
    products: Product[];
    total: number;
    pageInfo: {
      hasNextPage: boolean;
      endCursor: string | null;
    };
    filters: {
      createdToday: string;
      status: string;
      limit: number;
    };
  };
}

interface Product {
  id: string;
  title: string;
  handle: string;
  description: string;
  images: {
    nodes: Array<{
      id: string;
      url: string;
      altText: string | null;
      width: number;
      height: number;
    }>;
  };
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
  // ... other fields
}

// Fetch first page
async function fetchNulightProducts(shop: string, cursor?: string): Promise<NulightResponse> {
  const url = new URL('/api/nulight', window.location.origin);
  url.searchParams.set('shop', shop);
  
  if (cursor) {
    url.searchParams.set('after', cursor);
  }

  const response = await fetch(url.toString());
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch products');
  }

  return response.json();
}

// Usage
const shop = 'example.myshopify.com';
const result = await fetchNulightProducts(shop);

console.log('Products:', result.data.products);
console.log('Has next page:', result.data.pageInfo.hasNextPage);

// Fetch next page
if (result.data.pageInfo.hasNextPage && result.data.pageInfo.endCursor) {
  const nextPage = await fetchNulightProducts(shop, result.data.pageInfo.endCursor);
  console.log('Next page products:', nextPage.data.products);
}
```

### React Hook Example

```typescript
import { useState, useEffect } from 'react';

interface UseNulightProductsReturn {
  products: Product[];
  loading: boolean;
  error: string | null;
  hasNextPage: boolean;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
}

function useNulightProducts(shop: string): UseNulightProductsReturn {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasNextPage, setHasNextPage] = useState(false);

  const fetchProducts = async (cursor?: string, append = false) => {
    try {
      setLoading(true);
      setError(null);

      const url = new URL('/api/nulight', window.location.origin);
      url.searchParams.set('shop', shop);
      if (cursor) {
        url.searchParams.set('after', cursor);
      }

      const response = await fetch(url.toString());
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch products');
      }

      if (append) {
        setProducts(prev => [...prev, ...data.data.products]);
      } else {
        setProducts(data.data.products);
      }

      setNextCursor(data.data.pageInfo.endCursor);
      setHasNextPage(data.data.pageInfo.hasNextPage);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [shop]);

  const loadMore = async () => {
    if (nextCursor && hasNextPage) {
      await fetchProducts(nextCursor, true);
    }
  };

  const refresh = async () => {
    await fetchProducts();
  };

  return {
    products,
    loading,
    error,
    hasNextPage,
    loadMore,
    refresh,
  };
}

// Usage in component
function NulightProductsList({ shop }: { shop: string }) {
  const { products, loading, error, hasNextPage, loadMore, refresh } = useNulightProducts(shop);

  if (loading && products.length === 0) {
    return <div>Loading products...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
    <div>
      <button onClick={refresh}>Refresh</button>
      <div>
        {products.map(product => (
          <div key={product.id}>
            <h3>{product.title}</h3>
            {product.images.nodes[0] && (
              <img src={product.images.nodes[0].url} alt={product.images.nodes[0].altText || product.title} />
            )}
            <p>Price: {product.priceRangeV2.minVariantPrice.amount} {product.priceRangeV2.minVariantPrice.currencyCode}</p>
          </div>
        ))}
      </div>
      {hasNextPage && (
        <button onClick={loadMore}>Load More</button>
      )}
    </div>
  );
}
```

### Axios Example

```typescript
import axios from 'axios';

const api = axios.create({
  baseURL: window.location.origin,
});

interface FetchNulightProductsParams {
  shop: string;
  after?: string;
}

async function fetchNulightProducts({ shop, after }: FetchNulightProductsParams) {
  try {
    const response = await api.get<NulightResponse>('/api/nulight', {
      params: {
        shop,
        ...(after && { after }),
      },
    });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(error.response?.data?.message || 'Failed to fetch products');
    }
    throw error;
  }
}

// Usage
const result = await fetchNulightProducts({ shop: 'example.myshopify.com' });
```

### Next.js API Route Example

```typescript
// pages/api/nulight-proxy.ts or app/api/nulight-proxy/route.ts
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { shop, after } = req.query;

  if (!shop || typeof shop !== 'string') {
    return res.status(400).json({ error: 'Shop parameter is required' });
  }

  try {
    const url = new URL('/api/nulight', process.env.API_BASE_URL || 'http://localhost:3000');
    url.searchParams.set('shop', shop);
    if (after && typeof after === 'string') {
      url.searchParams.set('after', after);
    }

    const response = await fetch(url.toString());
    const data = await response.json();

    return res.status(response.status).json(data);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch products' });
  }
}
```

---

## Important Notes

1. **Fixed Limit**: The API always returns a maximum of 5 products per page
2. **Date Filter**: Products are filtered by creation date (today's date in UTC)
3. **Status Filter**: Only products with `ACTIVE` status are returned
4. **Pagination**: Use the `endCursor` from `pageInfo` to fetch the next page
5. **Shop Domain**: Can accept either full domain (`example.myshopify.com`) or handle (`example`)
6. **Rate Limiting**: Be mindful of API rate limits when implementing pagination
7. **Error Handling**: Always handle error responses appropriately in your frontend

---

## Testing

### cURL Examples

```bash
# First page
curl -X GET "http://localhost:3000/api/nulight?shop=example.myshopify.com"

# Next page
curl -X GET "http://localhost:3000/api/nulight?shop=example.myshopify.com&after=eyJsYXN0X2lkIjoxMjM0NTY3ODkw..."
```

### Postman Collection

You can import this into Postman:

```json
{
  "info": {
    "name": "Nulight Products API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Get Nulight Products - First Page",
      "request": {
        "method": "GET",
        "header": [],
        "url": {
          "raw": "{{baseUrl}}/api/nulight?shop={{shop}}",
          "host": ["{{baseUrl}}"],
          "path": ["api", "nulight"],
          "query": [
            {
              "key": "shop",
              "value": "{{shop}}"
            }
          ]
        }
      }
    },
    {
      "name": "Get Nulight Products - Next Page",
      "request": {
        "method": "GET",
        "header": [],
        "url": {
          "raw": "{{baseUrl}}/api/nulight?shop={{shop}}&after={{cursor}}",
          "host": ["{{baseUrl}}"],
          "path": ["api", "nulight"],
          "query": [
            {
              "key": "shop",
              "value": "{{shop}}"
            },
            {
              "key": "after",
              "value": "{{cursor}}"
            }
          ]
        }
      }
    }
  ],
  "variable": [
    {
      "key": "baseUrl",
      "value": "http://localhost:3000"
    },
    {
      "key": "shop",
      "value": "example.myshopify.com"
    },
    {
      "key": "cursor",
      "value": ""
    }
  ]
}
```

---

## Support

For issues or questions, refer to the main API documentation or contact the development team.

