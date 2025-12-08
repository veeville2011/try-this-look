# Categorized Products API Specification

## Overview

The Categorized Products API retrieves all products from a Shopify store and categorizes them properly, grouping products that belong to the same category together. It supports multiple categorization methods: collections, productType, vendor, tags, and Shopify's Standard Product Taxonomy.

**Base URL**: `/api/categorized-products`  
**Authentication**: Requires shop parameter (Shopify store domain)  
**Processing**: Fetches all products from the store (with pagination support)

---

## Table of Contents

1. [Main Endpoint](#main-endpoint)
2. [Categorization Methods](#categorization-methods)
3. [Request Parameters](#request-parameters)
4. [Response Structure](#response-structure)
5. [Data Structures](#data-structures)
6. [Error Handling](#error-handling)
7. [Examples](#examples)
8. [Performance Considerations](#performance-considerations)

---

## Main Endpoint

### GET `/api/categorized-products`

Retrieves all products from a Shopify store and categorizes them by the selected method. Products are grouped into categories, with uncategorized products placed in a separate group.

#### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `shop` | string | ✅ Yes | - | Shopify store domain (e.g., `mystore.myshopify.com` or `mystore`) |
| `categoryBy` | string | ❌ No | `collections` | Categorization method: `collections`, `productType`, `vendor`, `tags`, `category` |
| `after` | string | ❌ No | - | Cursor for pagination (from previous response) |
| `limit` | number | ❌ No | `250` | Number of products per batch (max 250). Note: API fetches ALL products regardless of limit. |

#### Request Example

```bash
# By collections (default)
GET /api/categorized-products?shop=mystore.myshopify.com

# By product type
GET /api/categorized-products?shop=mystore.myshopify.com&categoryBy=productType

# By vendor
GET /api/categorized-products?shop=mystore.myshopify.com&categoryBy=vendor

# By tags
GET /api/categorized-products?shop=mystore.myshopify.com&categoryBy=tags

# By category (Shopify Taxonomy)
GET /api/categorized-products?shop=mystore.myshopify.com&categoryBy=category

# With custom limit
GET /api/categorized-products?shop=mystore.myshopify.com&categoryBy=collections&limit=100
```

---

## Categorization Methods

### 1. Collections (Default)

Groups products by their collections. A product can belong to multiple collections and will appear in each collection category.

- **Field Used**: `product.collections.nodes[]`
- **Multiple Categories**: ✅ Yes (product can appear in multiple categories)
- **Use Case**: Organize products by store collections/manual groupings

### 2. Product Type

Groups products by their product type. Each product has one product type (or empty string).

- **Field Used**: `product.productType`
- **Multiple Categories**: ❌ No (each product appears in one category)
- **Use Case**: Organize products by merchant-defined product types

### 3. Vendor

Groups products by vendor name. Each product has one vendor (or empty string).

- **Field Used**: `product.vendor`
- **Multiple Categories**: ❌ No (each product appears in one category)
- **Use Case**: Organize products by brand/vendor

### 4. Tags

Groups products by their tags. A product can have multiple tags and will appear in each tag category.

- **Field Used**: `product.tags[]`
- **Multiple Categories**: ✅ Yes (product can appear in multiple categories)
- **Use Case**: Organize products by searchable keywords/tags

### 5. Category (Shopify Taxonomy)

Groups products by Shopify's Standard Product Taxonomy category. Each product can have one category (or null).

- **Field Used**: `product.category` (TaxonomyCategory)
- **Multiple Categories**: ❌ No (each product appears in one category)
- **Use Case**: Organize products by Shopify's standardized taxonomy

---

## Response Structure

### Success Response (200 OK)

```json
{
  "success": true,
  "message": "Products categorized successfully",
  "data": {
    "categoryMethod": "collections",
    "categories": [
      {
        "categoryId": "gid://shopify/Collection/123456789",
        "categoryName": "Electronics",
        "categoryHandle": "electronics",
        "productCount": 45,
        "products": [
          {
            "id": "gid://shopify/Product/987654321",
            "title": "Wireless Headphones",
            "handle": "wireless-headphones",
            "vendor": "TechBrand",
            "productType": "Audio",
            "tags": ["wireless", "audio", "electronics"],
            "status": "ACTIVE",
            "priceRangeV2": {
              "minVariantPrice": {
                "amount": "29.99",
                "currencyCode": "USD"
              },
              "maxVariantPrice": {
                "amount": "199.99",
                "currencyCode": "USD"
              }
            },
            "media": {
              "nodes": [
                {
                  "image": {
                    "url": "https://cdn.shopify.com/...",
                    "altText": "Wireless Headphones"
                  }
                }
              ]
            },
            "onlineStoreUrl": "https://store.com/products/wireless-headphones",
            "collections": {
              "nodes": [
                {
                  "id": "gid://shopify/Collection/123456789",
                  "title": "Electronics",
                  "handle": "electronics"
                }
              ]
            },
            "category": {
              "id": "gid://shopify/TaxonomyCategory/aa-8",
              "fullName": "Electronics > Audio > Headphones",
              "name": "Headphones"
            }
          }
        ]
      }
    ],
    "uncategorized": {
      "categoryName": "Uncategorized",
      "productCount": 12,
      "products": [
        {
          "id": "gid://shopify/Product/111111111",
          "title": "Product Without Category",
          "handle": "product-without-category",
          "vendor": "Brand",
          "productType": "",
          "tags": [],
          "status": "ACTIVE",
          "priceRangeV2": {
            "minVariantPrice": {
              "amount": "19.99",
              "currencyCode": "USD"
            },
            "maxVariantPrice": {
              "amount": "19.99",
              "currencyCode": "USD"
            }
          },
          "media": {
            "nodes": []
          },
          "onlineStoreUrl": "https://store.com/products/product-without-category",
          "collections": {
            "nodes": []
          },
          "category": null
        }
      ]
    },
    "pagination": {
      "hasNextPage": false,
      "endCursor": null,
      "totalProducts": 500
    },
    "statistics": {
      "totalCategories": 15,
      "totalProducts": 500,
      "categorizedProducts": 488,
      "uncategorizedProducts": 12
    }
  }
}
```

---

## Data Structures

### Category Object

| Field | Type | Description |
|-------|------|-------------|
| `categoryId` | string \| null | The ID of the category (collection ID, taxonomy category ID, etc.) |
| `categoryName` | string | The name of the category |
| `categoryHandle` | string \| null | The handle/slug of the category (for collections) |
| `productCount` | number | Number of products in this category |
| `products` | array | Array of product objects in this category |

### Product Object (Simplified)

Each product in the response includes:

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Shopify product ID (GID format) |
| `title` | string | Product title |
| `handle` | string | Product handle (URL slug) |
| `vendor` | string | Product vendor name |
| `productType` | string | Product type |
| `tags` | array | Array of product tags |
| `status` | string | Product status (ACTIVE, DRAFT, ARCHIVED) |
| `priceRangeV2` | object | Price range with min/max variant prices |
| `media` | object | Featured media (first image) |
| `onlineStoreUrl` | string \| null | URL to product on online store |
| `collections` | object | Collections the product belongs to |
| `category` | object \| null | Shopify taxonomy category |

### Statistics Object

| Field | Type | Description |
|-------|------|-------------|
| `totalCategories` | number | Total number of categories (excluding uncategorized) |
| `totalProducts` | number | Total number of products in the store |
| `categorizedProducts` | number | Number of products that are categorized |
| `uncategorizedProducts` | number | Number of products without a category |

### Pagination Object

| Field | Type | Description |
|-------|------|-------------|
| `hasNextPage` | boolean | Always `false` (all products are fetched) |
| `endCursor` | string \| null | Cursor for pagination (null when all products fetched) |
| `totalProducts` | number | Total number of products fetched |

---

## Error Handling

### 400 Bad Request - Missing Shop Parameter

```json
{
  "success": false,
  "error": "Validation Error",
  "message": "Missing required query parameter: shop"
}
```

### 400 Bad Request - Invalid Category Method

```json
{
  "success": false,
  "error": "Validation Error",
  "message": "Invalid categoryBy value. Must be one of: collections, productType, vendor, tags, category"
}
```

### 400 Bad Request - Invalid Shop Domain Format

```json
{
  "success": false,
  "error": "Validation Error",
  "message": "Invalid shop domain format"
}
```

### 400 Bad Request - Invalid Limit Value

```json
{
  "success": false,
  "error": "Validation Error",
  "message": "Invalid limit value. Must be between 1 and 250"
}
```

### 404 Not Found - Store Not Found

```json
{
  "success": false,
  "error": "Not Found",
  "message": "Store not found or not installed: mystore.myshopify.com"
}
```

### 500 Internal Server Error - Shopify API Error

```json
{
  "success": false,
  "error": "Shopify API Error",
  "message": "Failed to fetch products",
  "details": "Rate limit exceeded" // Only in development mode
}
```

### 500 Internal Server Error - Categorization Error

```json
{
  "success": false,
  "error": "Categorization Error",
  "message": "Failed to categorize products",
  "details": "Error details" // Only in development mode
}
```

---

## Examples

### Example 1: Get Products Categorized by Collections

**Request:**
```bash
GET /api/categorized-products?shop=mystore.myshopify.com&categoryBy=collections
```

**Response:**
```json
{
  "success": true,
  "message": "Products categorized successfully",
  "data": {
    "categoryMethod": "collections",
    "categories": [
      {
        "categoryId": "gid://shopify/Collection/123",
        "categoryName": "Electronics",
        "categoryHandle": "electronics",
        "productCount": 25,
        "products": [...]
      },
      {
        "categoryId": "gid://shopify/Collection/456",
        "categoryName": "Clothing",
        "categoryHandle": "clothing",
        "productCount": 30,
        "products": [...]
      }
    ],
    "uncategorized": {
      "categoryName": "Uncategorized",
      "productCount": 5,
      "products": [...]
    },
    "statistics": {
      "totalCategories": 2,
      "totalProducts": 60,
      "categorizedProducts": 55,
      "uncategorizedProducts": 5
    }
  }
}
```

### Example 2: Get Products Categorized by Product Type

**Request:**
```bash
GET /api/categorized-products?shop=mystore.myshopify.com&categoryBy=productType
```

**Response:**
```json
{
  "success": true,
  "message": "Products categorized successfully",
  "data": {
    "categoryMethod": "productType",
    "categories": [
      {
        "categoryId": null,
        "categoryName": "T-Shirts",
        "categoryHandle": null,
        "productCount": 20,
        "products": [...]
      },
      {
        "categoryId": null,
        "categoryName": "Jeans",
        "categoryHandle": null,
        "productCount": 15,
        "products": [...]
      }
    ],
    "uncategorized": {
      "categoryName": "Uncategorized",
      "productCount": 3,
      "products": [...]
    },
    "statistics": {
      "totalCategories": 2,
      "totalProducts": 38,
      "categorizedProducts": 35,
      "uncategorizedProducts": 3
    }
  }
}
```

### Example 3: Get Products Categorized by Vendor

**Request:**
```bash
GET /api/categorized-products?shop=mystore.myshopify.com&categoryBy=vendor
```

**Response:**
```json
{
  "success": true,
  "message": "Products categorized successfully",
  "data": {
    "categoryMethod": "vendor",
    "categories": [
      {
        "categoryId": null,
        "categoryName": "Nike",
        "categoryHandle": null,
        "productCount": 50,
        "products": [...]
      },
      {
        "categoryId": null,
        "categoryName": "Adidas",
        "categoryHandle": null,
        "productCount": 40,
        "products": [...]
      }
    ],
    "uncategorized": {
      "categoryName": "Uncategorized",
      "productCount": 10,
      "products": [...]
    },
    "statistics": {
      "totalCategories": 2,
      "totalProducts": 100,
      "categorizedProducts": 90,
      "uncategorizedProducts": 10
    }
  }
}
```

### Example 4: Get Products Categorized by Tags

**Request:**
```bash
GET /api/categorized-products?shop=mystore.myshopify.com&categoryBy=tags
```

**Response:**
```json
{
  "success": true,
  "message": "Products categorized successfully",
  "data": {
    "categoryMethod": "tags",
    "categories": [
      {
        "categoryId": null,
        "categoryName": "sale",
        "categoryHandle": null,
        "productCount": 25,
        "products": [...]
      },
      {
        "categoryId": null,
        "categoryName": "new",
        "categoryHandle": null,
        "productCount": 15,
        "products": [...]
      }
    ],
    "uncategorized": {
      "categoryName": "Uncategorized",
      "productCount": 5,
      "products": [...]
    },
    "statistics": {
      "totalCategories": 2,
      "totalProducts": 45,
      "categorizedProducts": 40,
      "uncategorizedProducts": 5
    }
  }
}
```

### Example 5: Get Products Categorized by Shopify Taxonomy

**Request:**
```bash
GET /api/categorized-products?shop=mystore.myshopify.com&categoryBy=category
```

**Response:**
```json
{
  "success": true,
  "message": "Products categorized successfully",
  "data": {
    "categoryMethod": "category",
    "categories": [
      {
        "categoryId": "gid://shopify/TaxonomyCategory/aa-8",
        "categoryName": "Apparel & Accessories > Clothing > Shirts",
        "categoryHandle": null,
        "productCount": 30,
        "products": [...]
      },
      {
        "categoryId": "gid://shopify/TaxonomyCategory/hb-1-9-6",
        "categoryName": "Electronics > Audio > Headphones",
        "categoryHandle": null,
        "productCount": 20,
        "products": [...]
      }
    ],
    "uncategorized": {
      "categoryName": "Uncategorized",
      "productCount": 10,
      "products": [...]
    },
    "statistics": {
      "totalCategories": 2,
      "totalProducts": 60,
      "categorizedProducts": 50,
      "uncategorizedProducts": 10
    }
  }
}
```

---

## Performance Considerations

### Fetching Strategy

- **Batch Size**: Products are fetched in batches of 250 (max allowed by Shopify)
- **Complete Fetch**: The API fetches ALL products from the store, not just a subset
- **Memory Usage**: For stores with 10,000+ products, consider the memory impact
- **Processing Time**: Categorization happens after all products are fetched

### Optimization Tips

1. **For Large Stores (>1000 products)**:
   - Consider implementing pagination at the category level (future enhancement)
   - Monitor response time and memory usage
   - Consider caching categorized results

2. **Rate Limiting**:
   - Shopify has rate limits (2 requests/second for REST, varies for GraphQL)
   - The API implements automatic pagination to respect rate limits
   - Large stores may take longer to fetch all products

3. **Caching**:
   - Consider caching categorized results per shop
   - Cache key: `{shopDomain}:categorized:{categoryBy}`
   - Invalidate cache on product updates (optional)

### Response Size

- **Small Stores (<100 products)**: Response size ~50-100 KB
- **Medium Stores (100-1000 products)**: Response size ~500 KB - 5 MB
- **Large Stores (1000+ products)**: Response size 5+ MB

**Note**: For very large stores, consider implementing streaming or chunked responses (future enhancement).

---

## GraphQL Query Details

The API uses the following GraphQL query to fetch products:

```graphql
query GetCategorizedProducts(
  $first: Int!
  $after: String
  $query: String
) {
  products(first: $first, after: $after, query: $query) {
    pageInfo {
      hasNextPage
      endCursor
    }
    nodes {
      id
      title
      handle
      vendor
      productType
      tags
      status
      category {
        id
        fullName
        name
      }
      collections(first: 50) {
        nodes {
          id
          title
          handle
        }
      }
      priceRangeV2 {
        minVariantPrice {
          amount
          currencyCode
        }
        maxVariantPrice {
          amount
          currencyCode
        }
      }
      media(first: 1, sortKey: POSITION) {
        nodes {
          ... on MediaImage {
            image {
              url
              altText
            }
          }
        }
      }
      onlineStoreUrl
    }
  }
}
```

**Required Scopes**: `read_products`

---

## Special Cases

### Uncategorized Products

Products without the selected category field are grouped under `uncategorized`:
- **Collections**: Products with no collections
- **Product Type**: Products with empty/null productType
- **Vendor**: Products with empty/null vendor
- **Tags**: Products with no tags
- **Category**: Products with null category

### Multiple Categories

When using `collections` or `tags`, products can appear in multiple categories:
- A product in both "Electronics" and "Accessories" collections will appear in both categories
- A product with tags ["sale", "new"] will appear in both tag categories
- Statistics reflect unique products, not total appearances

### Empty Categories

Categories with 0 products are excluded from the response. Only categories with at least 1 product are returned.

---

## Notes

1. **Product Count Accuracy**: When using `collections` or `tags`, the `productCount` in statistics reflects unique products, not total appearances across categories.

2. **Category Sorting**: Categories are sorted alphabetically by name.

3. **Case Sensitivity**: Category names are preserved as-is from Shopify (collections, productType, vendor, tags). For taxonomy categories, the full name path is used.

4. **Pagination**: The API fetches ALL products from the store. The `after` and `limit` parameters control batch size but don't limit total results.

5. **Response Time**: For stores with many products, the initial response may take 10-30 seconds as all products are fetched and categorized.

---

## End of Specification

This specification covers all aspects of the Categorized Products API. For questions or issues, refer to the implementation in:
- Service: `services/categorizedProductsService.js`
- Controller: `controllers/categorizedProductsController.js`
- Route: `routes/categorizedProducts.js`

