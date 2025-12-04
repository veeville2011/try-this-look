# NUSENSE TryON API Documentation

## Base URL
```
Production: https://try-this-look.vercel.app
Local: http://localhost:3000
```

---

## 1. Get Available Plans

Retrieves all available subscription plans.

### Endpoint
```
GET /api/billing/plans
```

### Authentication
No authentication required (public endpoint)

### Query Parameters
None

### Request Body
None

### Response Structure

#### Success Response (200 OK)
```json
{
  "plans": [
    {
      "name": "Plan Standard",
      "handle": "pro-monthly",
      "price": 23,
      "currencyCode": "USD",
      "interval": "EVERY_30_DAYS",
      "trialDays": 30,
      "description": "Monthly subscription plan",
      "features": ["Feature 1", "Feature 2"],
      "limits": {
        "includedCredits": 100
      }
    },
    {
      "name": "Plan Annual",
      "handle": "pro-annual",
      "price": 230,
      "currencyCode": "USD",
      "interval": "ANNUAL",
      "trialDays": 30,
      "description": "Annual subscription plan",
      "features": ["Feature 1", "Feature 2"],
      "limits": {
        "includedCredits": 1200
      }
    }
  ]
}
```

### Status Codes

| Code | Description |
|------|-------------|
| 200 | Success - Plans retrieved successfully |
| 500 | Internal Server Error - Server error occurred |

### Error Responses

#### 500 Internal Server Error
```json
{
  "error": {
    "code": "500",
    "message": "A server error has occurred"
  }
}
```

---

## 2. Get Subscription Status

Retrieves the current subscription status for a shop.

### Endpoint
```
GET /api/billing/subscription
```

### Authentication
Requires shop access token (retrieved from database using shop parameter)

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| shop | string | Yes | Shop domain (e.g., `vto-demo` or `vto-demo.myshopify.com`) |

### Request Body
None

### Response Structure

#### Success Response (200 OK)
```json
{
  "requestId": "req-1764875996084-93018mii2",
  "hasActiveSubscription": true,
  "isFree": false,
  "plan": {
    "name": "Plan Standard",
    "handle": "pro-monthly",
    "price": 23,
    "currencyCode": "USD",
    "interval": "EVERY_30_DAYS",
    "trialDays": 30,
    "description": "Monthly subscription plan",
    "features": ["Feature 1", "Feature 2"],
    "limits": {
      "includedCredits": 100
    }
  },
  "subscription": {
    "id": "gid://shopify/AppSubscription/27270053932",
    "status": "ACTIVE",
    "currentPeriodEnd": "2026-02-02T13:39:55Z",
    "currentPeriodStart": "2025-12-04T13:39:00Z",
    "createdAt": "2025-12-04T13:39:00Z",
    "name": "Plan Standard",
    "trialDays": 30,
    "trialDaysRemaining": 30,
    "isInTrial": true
  }
}
```

#### No Active Subscription (200 OK)
```json
{
  "requestId": "req-1764875996084-93018mii2",
  "hasActiveSubscription": false,
  "isFree": true,
  "plan": null,
  "subscription": null
}
```

### Status Codes

| Code | Description |
|------|-------------|
| 200 | Success - Subscription status retrieved |
| 400 | Bad Request - Missing or invalid shop parameter |
| 401 | Unauthorized - Failed to get access token |
| 500 | Internal Server Error - Server error occurred |

### Error Responses

#### 400 Bad Request - Missing Shop Parameter
```json
{
  "error": "Missing shop parameter",
  "message": "Shop parameter is required in query string",
  "requestId": "req-1764875996084-93018mii2"
}
```

#### 400 Bad Request - Invalid Shop Parameter
```json
{
  "error": "Invalid shop parameter",
  "message": "Provide a valid .myshopify.com domain or shop handle",
  "requestId": "req-1764875996084-93018mii2"
}
```

#### 401 Unauthorized
```json
{
  "error": "Unauthorized",
  "message": "Failed to get access token for shop",
  "requestId": "req-1764875996084-93018mii2"
}
```

#### 500 Internal Server Error
```json
{
  "error": "Internal server error",
  "message": "An unexpected error occurred",
  "requestId": "req-1764875996084-93018mii2"
}
```

---

## 3. Get Credits Balance

Retrieves the current credit balance for a shop.

### Endpoint
```
GET /api/credits/balance
```

### Authentication
Requires shop access token (retrieved from database using shop parameter)

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| shop | string | Yes | Shop domain (e.g., `vto-demo` or `vto-demo.myshopify.com`) |

### Request Body
None

### Response Structure

#### Success Response (200 OK)
```json
{
  "balance": 75,
  "included": 100,
  "used": 25,
  "isOverage": false,
  "periodEnd": "2026-02-02T13:39:55Z",
  "subscriptionLineItemId": "gid://shopify/AppSubscriptionLineItem/27270053932?v=1&index=0",
  "canPurchase": true
}
```

#### No Credits Initialized (200 OK)
```json
{
  "balance": 0,
  "included": 0,
  "used": 0,
  "isOverage": false,
  "periodEnd": null,
  "subscriptionLineItemId": null,
  "canPurchase": true
}
```

### Status Codes

| Code | Description |
|------|-------------|
| 200 | Success - Credit balance retrieved |
| 400 | Bad Request - Missing or invalid shop parameter |
| 404 | Not Found - App installation not found |
| 500 | Internal Server Error - Server error occurred |

### Error Responses

#### 400 Bad Request - Missing Shop Parameter
```json
{
  "error": "Missing shop parameter",
  "message": "Shop parameter is required"
}
```

#### 400 Bad Request - Invalid Shop Parameter
```json
{
  "error": "Invalid shop parameter",
  "message": "Provide a valid .myshopify.com domain"
}
```

#### 404 Not Found
```json
{
  "error": "App installation not found"
}
```

#### 500 Internal Server Error
```json
{
  "error": "Failed to get credit balance",
  "message": "An unexpected error occurred"
}
```

---

## 4. Subscribe to Plan

Creates a new subscription for a shop. Returns a confirmation URL that must be used to redirect the merchant for approval.

### Endpoint
```
POST /api/billing/subscribe
```

### Authentication
Requires shop access token (retrieved from database using shop parameter)

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| shop | string | Yes | Shop domain (e.g., `vto-demo` or `vto-demo.myshopify.com`) |

### Request Body

```json
{
  "planHandle": "pro-monthly",
  "promoCode": null
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| planHandle | string | Yes | Plan handle (e.g., `pro-monthly`, `pro-annual`) |
| promoCode | string | No | Optional promo code for discount |

### Response Structure

#### Success Response (200 OK)
```json
{
  "requestId": "req-1764877707677-eq6ouisi1",
  "confirmationUrl": "https://billingshop.myshopify.com/admin/charges/166357/27270053932/RecurringApplicationCharge/confirm_recurring_application_charge?signature=...",
  "appSubscription": {
    "id": "gid://shopify/AppSubscription/27270053932",
    "status": "PENDING",
    "name": "Plan Standard",
    "createdAt": "2025-12-04T13:39:00Z",
    "currentPeriodEnd": null,
    "lineItems": [
      {
        "id": "gid://shopify/AppSubscriptionLineItem/27270053932?v=1&index=0",
        "plan": {
          "pricingDetails": {
            "__typename": "AppRecurringPricing",
            "interval": "EVERY_30_DAYS",
            "price": {
              "amount": 23,
              "currencyCode": "USD"
            }
          }
        }
      }
    ]
  },
  "plan": {
    "name": "Plan Standard",
    "handle": "pro-monthly",
    "price": 23,
    "currencyCode": "USD",
    "interval": "EVERY_30_DAYS"
  }
}
```

**Important:** The `confirmationUrl` must be used to redirect the merchant to Shopify's approval page. After approval, Shopify will redirect back to the `returnUrl` specified during subscription creation (`/payment-success?shop={shopDomain}`).

### Status Codes

| Code | Description |
|------|-------------|
| 200 | Success - Subscription created, confirmation URL returned |
| 400 | Bad Request - Missing or invalid parameters |
| 401 | Unauthorized - Failed to get access token |
| 500 | Internal Server Error - Failed to create subscription |

### Error Responses

#### 400 Bad Request - Missing Required Parameters
```json
{
  "error": "Missing required parameters",
  "message": "Both shop and planHandle are required.",
  "requestId": "req-1764877707677-eq6ouisi1"
}
```

#### 400 Bad Request - Invalid Shop Parameter
```json
{
  "error": "Invalid shop parameter",
  "message": "Provide a valid .myshopify.com domain or shop handle",
  "requestId": "req-1764877707677-eq6ouisi1"
}
```

#### 400 Bad Request - Invalid Plan Handle
```json
{
  "error": "Invalid plan handle",
  "details": {
    "resolution": "Provide a valid planHandle defined in server/utils/billing.js."
  },
  "requestId": "req-1764877707677-eq6ouisi1"
}
```

#### 401 Unauthorized
```json
{
  "error": "Unauthorized",
  "message": "Failed to get access token for shop",
  "requestId": "req-1764877707677-eq6ouisi1"
}
```

#### 500 Internal Server Error - GraphQL Errors
```json
{
  "error": "Internal server error",
  "message": "GraphQL errors: Variable $returnUrl of type URL! was provided invalid value",
  "requestId": "req-1764877707677-eq6ouisi1"
}
```

#### 500 Internal Server Error - Subscription Creation Failed
```json
{
  "error": "Failed to create subscription",
  "details": {
    "userErrors": [
      {
        "field": ["lineItems"],
        "message": "Invalid pricing details"
      }
    ],
    "resolution": "Please check the plan configuration and try again."
  },
  "requestId": "req-1764877707677-eq6ouisi1"
}
```

#### 500 Internal Server Error - Generic
```json
{
  "error": "Internal server error",
  "message": "An unexpected error occurred",
  "requestId": "req-1764877707677-eq6ouisi1"
}
```

---

## 5. Cancel Subscription

Cancels an active subscription for a shop.

### Endpoint
```
POST /api/billing/cancel
```

### Authentication
Requires shop access token (retrieved from database using shop parameter)

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| shop | string | Yes | Shop domain (e.g., `vto-demo` or `vto-demo.myshopify.com`) |

### Request Body

```json
{
  "subscriptionId": "gid://shopify/AppSubscription/27270053932",
  "prorate": false
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| subscriptionId | string | Yes | Subscription ID in GID format |
| prorate | boolean | No | Whether to prorate cancellation (default: `false`) |

### Response Structure

#### Success Response (200 OK)
```json
{
  "requestId": "req-1764877707677-eq6ouisi1",
  "appSubscription": {
    "id": "gid://shopify/AppSubscription/27270053932",
    "status": "CANCELLED",
    "name": "Plan Standard",
    "currentPeriodEnd": "2026-02-02T13:39:55Z"
  }
}
```

### Status Codes

| Code | Description |
|------|-------------|
| 200 | Success - Subscription cancelled successfully |
| 400 | Bad Request - Missing or invalid parameters |
| 401 | Unauthorized - Failed to get access token |
| 500 | Internal Server Error - Failed to cancel subscription |

### Error Responses

#### 400 Bad Request - Missing Required Parameters
```json
{
  "error": "Missing required parameters",
  "message": "Both shop and subscriptionId are required.",
  "requestId": "req-1764877707677-eq6ouisi1"
}
```

#### 400 Bad Request - Invalid Shop Parameter
```json
{
  "error": "Invalid shop parameter",
  "message": "Provide a valid .myshopify.com domain or shop handle",
  "requestId": "req-1764877707677-eq6ouisi1"
}
```

#### 401 Unauthorized
```json
{
  "error": "Unauthorized",
  "message": "Failed to get access token for shop",
  "requestId": "req-1764877707677-eq6ouisi1"
}
```

#### 500 Internal Server Error - Cancellation Failed
```json
{
  "error": "Failed to cancel subscription",
  "details": {
    "userErrors": [
      {
        "field": ["id"],
        "message": "Subscription not found"
      }
    ],
    "resolution": "Please verify the subscription ID and try again."
  },
  "requestId": "req-1764877707677-eq6ouisi1"
}
```

#### 500 Internal Server Error - Generic
```json
{
  "error": "Internal server error",
  "message": "An unexpected error occurred",
  "requestId": "req-1764877707677-eq6ouisi1"
}
```

---

## Common Response Fields

### Request ID
All responses include a `requestId` field (except for the Get Available Plans endpoint) which is a unique identifier for the request. This can be used for debugging and support purposes.

Format: `req-{timestamp}-{randomString}`

Example: `req-1764875996084-93018mii2`

---

## Shop Domain Format

The `shop` parameter accepts two formats:
- Shop handle: `vto-demo`
- Full domain: `vto-demo.myshopify.com`

Both formats are automatically normalized to the full domain format internally.

---

## Subscription Status Values

| Status | Description |
|--------|-------------|
| `PENDING` | Subscription created but not yet approved by merchant |
| `ACTIVE` | Subscription is active and billing |
| `CANCELLED` | Subscription has been cancelled |
| `DECLINED` | Merchant declined the subscription |
| `EXPIRED` | Subscription has expired |

---

## Plan Intervals

| Interval | Description |
|----------|-------------|
| `EVERY_30_DAYS` | Monthly billing cycle |
| `ANNUAL` | Annual billing cycle |

---

## Notes

1. **Access Token Retrieval**: All authenticated endpoints automatically retrieve the access token from the database using the `shop` parameter. The shop must be installed in the system for this to work.

2. **Confirmation URL**: When subscribing to a plan, the API returns a `confirmationUrl`. The client application must redirect the merchant to this URL for approval. After approval, Shopify redirects back to the `returnUrl` (`/payment-success?shop={shopDomain}`).

3. **Credit Initialization**: Credits are automatically initialized when:
   - A subscription is active
   - For monthly plans: Credits are available immediately (even during trial)
   - For annual plans: Credits are available after trial ends

4. **Error Handling**: All errors include descriptive messages and, where applicable, resolution steps. The `requestId` can be used to track specific errors in server logs.

5. **Test Mode**: Subscriptions for the demo store (`vto-demo.myshopify.com`) are automatically created in test mode.

