# Pixel Tracking Events Table

## Overview
All events are sent to: `https://ai.nusense.ddns.net/api/tracking/pixel`

**Base Payload Structure** (included in all events):
```json
{
  "event_type": "event_name",
  "event_id": "uuid",
  "timestamp": "ISO 8601",
  "session_id": "uuid",
  "shopify_client_id": "string | null",
  "customer_id": "string | null",
  "shopify_customer_id": "string | null",
  "seq": "number | null",
  "client": {
    "user_agent": "string | null",
    "language": "string | null",
    "screen_width": "number | null",
    "screen_height": "number | null",
    "viewport_width": "number | null",
    "viewport_height": "number | null"
  },
  "document": {
    "location": "string | null",
    "referrer": "string | null",
    "title": "string | null"
  },
  "privacy_consent": {
    "analytics_allowed": "boolean",
    "marketing_allowed": "boolean",
    "preferences_allowed": "boolean",
    "sale_of_data_allowed": "boolean"
  }
}
```

---

## Standard Shopify Events

| Shopify Event | Backend Event Name | Custom Data Tracked | Source |
|---------------|-------------------|---------------------|--------|
| `product_added_to_cart` | `product_added_to_cart` | ```json<br>{<br>  "product": {<br>    "id": "cartLine.merchandise.product.id",<br>    "title": "cartLine.merchandise.product.title",<br>    "price": "cartLine.cost.totalAmount.amount",<br>    "quantity": "cartLine.quantity",<br>    "variant": {<br>      "id": "cartLine.merchandise.id",<br>      "price": "cartLine.merchandise.price.amount",<br>      "title": "cartLine.merchandise.title"<br>    }<br>  }<br>}``` | `event.data.cartLine` |
| `product_viewed` | `product_viewed` | ```json<br>{<br>  "product": "event.data.product"<br>}``` | `event.data.product` |
| `page_viewed` | `page_viewed` | `{}` (empty object) | No custom data |
| `checkout_completed` | `checkout_completed` | ```json<br>{<br>  "checkout": {<br>    "order_id": "event.data.order.id",<br>    "total_price": "event.data.order.totalPrice.amount",<br>    "currency_code": "event.data.order.currencyCode",<br>    "line_items": "event.data.order.lineItems"<br>  }<br>}``` | `event.data.checkout` or `event.data.order` |

---

## Custom Try-On Events

| Shopify Event | Backend Event Name | Custom Data Tracked | Source |
|---------------|-------------------|---------------------|--------|
| `tryon:widget_opened` | `tryon_widget_opened` | ```json<br>{<br>  "tryon": "event.customData.tryon"<br>}``` | `event.customData.tryon` |
| `tryon:widget_closed` | `tryon_widget_closed` | ```json<br>{<br>  "tryon": "event.customData.tryon"<br>}``` | `event.customData.tryon` |
| `tryon:photo_uploaded` | `tryon_photo_uploaded` | ```json<br>{<br>  "tryon": {<br>    "product_id": "event.customData.productId",<br>    "product_title": "event.customData.productTitle"<br>  }<br>}``` | `event.customData` |
| `tryon:garment_selected` | `tryon_garment_selected` | ```json<br>{<br>  "product": {<br>    "id": "event.customData.productId",<br>    "title": "event.customData.productTitle",<br>    "image_url": "event.customData.productImageUrl"<br>  }<br>}``` | `event.customData.product` or `event.customData` |
| `tryon:started` | `tryon_started` | ```json<br>{<br>  "product": {<br>    "id": "event.customData.productId",<br>    "title": "event.customData.productTitle"<br>  }<br>}``` | `event.customData.product` or `event.customData` |
| `tryon:completed` | `tryon_completed` | ```json<br>{<br>  "tryon": {<br>    "tryon_id": "event.customData.tryonId",<br>    "product_id": "event.customData.productId",<br>    "product_title": "event.customData.productTitle",<br>    "processing_time_ms": "event.customData.processingTimeMs"<br>  }<br>}``` | `event.customData.tryon` or `event.customData` |
| `tryon:result_viewed` | `tryon_result_viewed` | ```json<br>{<br>  "tryon": {<br>    "tryon_id": "event.customData.tryonId"<br>  }<br>}``` | `event.customData.tryon` or `event.customData` |
| `tryon:result_shared` | `tryon_result_shared` | ```json<br>{<br>  "tryon": {<br>    "tryon_id": "event.customData.tryonId",<br>    "share_platform": "event.customData.platform"<br>  }<br>}``` | `event.customData.tryon` or `event.customData` |
| `tryon:result_downloaded` | `tryon_result_downloaded` | ```json<br>{<br>  "tryon": {<br>    "tryon_id": "event.customData.tryonId"<br>  }<br>}``` | `event.customData.tryon` or `event.customData` |
| `tryon:feedback_submitted` | `tryon_feedback_submitted` | ```json<br>{<br>  "tryon": {<br>    "tryon_id": "event.customData.tryonId",<br>    "feedback_liked": "event.customData.liked",<br>    "feedback_text": "event.customData.text"<br>  }<br>}``` | `event.customData.tryon` or `event.customData` |

---

## Privacy Consent Events

| Shopify Event | Backend Event Name | Custom Data Tracked | Description |
|---------------|-------------------|---------------------|-------------|
| `visitorConsentCollected` | N/A (updates state only) | Updates `customerPrivacyStatus` | Updates privacy consent state when user changes consent. Does not send event to backend, but updates consent status for future events. |

---

## Event Flow

### Standard Shopify Events
```
Shopify Store → Shopify Analytics → Pixel Extension → Backend API
```

### Custom Try-On Events
```
Widget → postMessage → Parent Bridge → Shopify.analytics.publish() → Pixel Extension → Backend API
```

---

## Data Mapping Summary

### Product Data Fields
- `id` - Product ID
- `title` - Product title
- `price` - Product price
- `quantity` - Quantity
- `variant.id` - Variant ID
- `variant.price` - Variant price
- `variant.title` - Variant title
- `image_url` - Product image URL

### Try-On Data Fields
- `tryon_id` - Try-on session ID
- `product_id` - Product ID
- `product_title` - Product title
- `processing_time_ms` - Generation time in milliseconds
- `share_platform` - Platform where result was shared
- `feedback_liked` - Boolean if user liked result
- `feedback_text` - User feedback text

---

## Session Management

- **Session ID**: Stored in cookie `nulight_session_id`
- **Session Creation**: Generated UUID v4 if not exists
- **Session Persistence**: Cookie-based (persists across page loads)

---

## Privacy Compliance

All events include privacy consent status:
- `analytics_allowed` - Analytics processing consent
- `marketing_allowed` - Marketing consent
- `preferences_allowed` - Preferences processing consent
- `sale_of_data_allowed` - Sale of data consent

Events respect user privacy preferences and only track when consent is given.

---

## Total Events Tracked

- **Standard Shopify Events**: 4
- **Custom Try-On Events**: 10
- **Privacy Events**: 1 (state update only)
- **Total**: 15 event types

