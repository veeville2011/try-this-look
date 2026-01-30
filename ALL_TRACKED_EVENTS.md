# All Tracked Events - Complete List

## Overview
This document lists **all events** that are tracked in the system, including:
- Standard Shopify events (automatically tracked by Shopify)
- Custom try-on events (published by widget)
- Privacy consent events
- Native cart events

**Backend Endpoint**: `https://ai.nusense.ddns.net/api/tracking/pixel`

---

## Standard Shopify Events (4 events)

### 1. `product_added_to_cart`
- **Shopify Event**: `product_added_to_cart`
- **Backend Event**: `product_added_to_cart`
- **Triggered By**: 
  - Shopify automatically (native cart additions)
  - Widget add to cart actions
  - Native cart form submissions
- **Data Tracked**:
  ```json
  {
    "product": {
      "id": "Product ID",
      "title": "Product Title",
      "price": "Price amount",
      "quantity": "Quantity added",
      "variant": {
        "id": "Variant ID",
        "price": "Variant price",
        "title": "Variant title"
      }
    }
  }
  ```
- **Subscribed In**: `extensions/nusense-pixel/src/index.js:97`
- **Published In**: 
  - `extensions/theme-app-extension/assets/nusense-parent-bridge.js:1134, 1440`
  - `src/utils/tracking.ts:189`
  - `src/components/TryOnWidget.tsx:840, 939`
  - `src/components/ResultDisplay.tsx:274, 384`

### 2. `product_viewed`
- **Shopify Event**: `product_viewed`
- **Backend Event**: `product_viewed`
- **Triggered By**: 
  - Shopify automatically (product page views)
  - Parent bridge script (when NUSENSE_PRODUCT_DATA available)
- **Data Tracked**:
  ```json
  {
    "product": {
      "id": "Product ID",
      "title": "Product Title",
      "vendor": "Shop name",
      "url": "Product URL",
      "image_url": "First product image",
      "price": "Product price",
      "variant": "First variant data"
    }
  }
  ```
- **Subscribed In**: `extensions/nusense-pixel/src/index.js:115`
- **Published In**: 
  - `extensions/theme-app-extension/assets/nusense-parent-bridge.js:1128, 1278`
  - `src/utils/tracking.ts:174`

### 3. `page_viewed`
- **Shopify Event**: `page_viewed`
- **Backend Event**: `page_viewed`
- **Triggered By**: Shopify automatically (all page views)
- **Data Tracked**: `{}` (empty - base payload only)
- **Subscribed In**: `extensions/nusense-pixel/src/index.js:121`
- **Published In**: None (automatic Shopify event)

### 4. `checkout_completed`
- **Shopify Event**: `checkout_completed`
- **Backend Event**: `checkout_completed`
- **Triggered By**: Shopify automatically (checkout completion)
- **Data Tracked**:
  ```json
  {
    "checkout": {
      "order_id": "Order ID",
      "total_price": "Total price amount",
      "currency_code": "Currency code",
      "line_items": "Array of line items"
    }
  }
  ```
- **Subscribed In**: `extensions/nusense-pixel/src/index.js:125`
- **Published In**: None (automatic Shopify event)

---

## Custom Try-On Events (10 events)

### 5. `tryon:widget_opened`
- **Shopify Event**: `tryon:widget_opened`
- **Backend Event**: `tryon_widget_opened`
- **Triggered By**: 
  - Widget opens
  - DOM observer detects iframe visibility
- **Data Tracked**:
  ```json
  {
    "tryon": {}
  }
  ```
- **Subscribed In**: `extensions/nusense-pixel/src/index.js:140`
- **Published In**: 
  - `extensions/theme-app-extension/assets/nusense-parent-bridge.js:1056, 1168`
  - `src/utils/tracking.ts:60`

### 6. `tryon:widget_closed`
- **Shopify Event**: `tryon:widget_closed`
- **Backend Event**: `tryon_widget_closed`
- **Triggered By**: 
  - Widget closes
  - DOM observer detects iframe hidden
- **Data Tracked**:
  ```json
  {
    "tryon": {}
  }
  ```
- **Subscribed In**: `extensions/nusense-pixel/src/index.js:147`
- **Published In**: 
  - `extensions/theme-app-extension/assets/nusense-parent-bridge.js:1059, 1180`
  - `src/utils/tracking.ts:65`

### 7. `tryon:photo_uploaded`
- **Shopify Event**: `tryon:photo_uploaded`
- **Backend Event**: `tryon_photo_uploaded`
- **Triggered By**: User uploads a photo in widget
- **Data Tracked**:
  ```json
  {
    "tryon": {
      "product_id": "Product ID",
      "product_title": "Product Title"
    }
  }
  ```
- **Subscribed In**: `extensions/nusense-pixel/src/index.js:153`
- **Published In**: 
  - `extensions/theme-app-extension/assets/nusense-parent-bridge.js:1062`
  - `src/utils/tracking.ts:74`
  - `src/components/TryOnWidget.tsx:1096`

### 8. `tryon:garment_selected`
- **Shopify Event**: `tryon:garment_selected`
- **Backend Event**: `tryon_garment_selected`
- **Triggered By**: User selects a garment/clothing item
- **Data Tracked**:
  ```json
  {
    "product": {
      "id": "Product ID",
      "title": "Product Title",
      "image_url": "Product Image URL"
    }
  }
  ```
- **Subscribed In**: `extensions/nusense-pixel/src/index.js:162`
- **Published In**: 
  - `extensions/theme-app-extension/assets/nusense-parent-bridge.js:1070`
  - `src/utils/tracking.ts:84`
  - `src/components/TryOnWidget.tsx:1123`

### 9. `tryon:started`
- **Shopify Event**: `tryon:started`
- **Backend Event**: `tryon_started`
- **Triggered By**: Try-on generation starts
- **Data Tracked**:
  ```json
  {
    "product": {
      "id": "Product ID",
      "title": "Product Title"
    }
  }
  ```
- **Subscribed In**: `extensions/nusense-pixel/src/index.js:172`
- **Published In**: 
  - `extensions/theme-app-extension/assets/nusense-parent-bridge.js:1079`
  - `src/utils/tracking.ts:95`
  - `src/components/TryOnWidget.tsx:1406`

### 10. `tryon:completed`
- **Shopify Event**: `tryon:completed`
- **Backend Event**: `tryon_completed`
- **Triggered By**: Try-on generation completes successfully
- **Data Tracked**:
  ```json
  {
    "tryon": {
      "tryon_id": "Try-on ID",
      "product_id": "Product ID",
      "product_title": "Product Title",
      "processing_time_ms": "Processing time in milliseconds"
    }
  }
  ```
- **Subscribed In**: `extensions/nusense-pixel/src/index.js:181`
- **Published In**: 
  - `extensions/theme-app-extension/assets/nusense-parent-bridge.js:1087`
  - `src/utils/tracking.ts:110`
  - `src/components/TryOnWidget.tsx:1489`

### 11. `tryon:result_viewed`
- **Shopify Event**: `tryon:result_viewed`
- **Backend Event**: `tryon_result_viewed`
- **Triggered By**: User views the try-on result
- **Data Tracked**:
  ```json
  {
    "tryon": {
      "tryon_id": "Try-on ID"
    }
  }
  ```
- **Subscribed In**: `extensions/nusense-pixel/src/index.js:192`
- **Published In**: 
  - `extensions/theme-app-extension/assets/nusense-parent-bridge.js:1097`
  - `src/utils/tracking.ts:126`
  - `src/components/TryOnWidget.tsx:2423`

### 12. `tryon:result_shared`
- **Shopify Event**: `tryon:result_shared`
- **Backend Event**: `tryon_result_shared`
- **Triggered By**: User shares the try-on result
- **Data Tracked**:
  ```json
  {
    "tryon": {
      "tryon_id": "Try-on ID",
      "share_platform": "Platform name (e.g., 'instagram')"
    }
  }
  ```
- **Subscribed In**: `extensions/nusense-pixel/src/index.js:200`
- **Published In**: 
  - `extensions/theme-app-extension/assets/nusense-parent-bridge.js:1104`
  - `src/utils/tracking.ts:135`
  - `src/components/TryOnWidget.tsx:2305, 2342`

### 13. `tryon:result_downloaded`
- **Shopify Event**: `tryon:result_downloaded`
- **Backend Event**: `tryon_result_downloaded`
- **Triggered By**: User downloads the try-on result
- **Data Tracked**:
  ```json
  {
    "tryon": {
      "tryon_id": "Try-on ID"
    }
  }
  ```
- **Subscribed In**: `extensions/nusense-pixel/src/index.js:209`
- **Published In**: 
  - `extensions/theme-app-extension/assets/nusense-parent-bridge.js:1112`
  - `src/utils/tracking.ts:145`
  - `src/components/TryOnWidget.tsx:2157`

### 14. `tryon:feedback_submitted`
- **Shopify Event**: `tryon:feedback_submitted`
- **Backend Event**: `tryon_feedback_submitted`
- **Triggered By**: User submits feedback on try-on result
- **Data Tracked**:
  ```json
  {
    "tryon": {
      "tryon_id": "Try-on ID",
      "feedback_liked": "Boolean (true/false)",
      "feedback_text": "Feedback text (optional)"
    }
  }
  ```
- **Subscribed In**: `extensions/nusense-pixel/src/index.js:217`
- **Published In**: 
  - `extensions/theme-app-extension/assets/nusense-parent-bridge.js:1119`
  - `src/utils/tracking.ts:154`

---

## Privacy Consent Events (1 event)

### 15. `visitorConsentCollected`
- **Shopify Event**: `visitorConsentCollected`
- **Backend Event**: N/A (state update only, doesn't send event)
- **Triggered By**: User changes privacy consent preferences
- **Data Tracked**: Updates `customerPrivacyStatus` state
  ```json
  {
    "analyticsProcessingAllowed": "boolean",
    "marketingAllowed": "boolean",
    "preferencesProcessingAllowed": "boolean",
    "saleOfDataAllowed": "boolean"
  }
  ```
- **Subscribed In**: `extensions/nusense-pixel/src/index.js:86`
- **Published In**: None (Shopify internal event)

---

## Base Payload (Included in All Events)

Every event sent to the backend includes this base payload:

```json
{
  "event_type": "event_name",
  "event_id": "UUID v4",
  "timestamp": "ISO 8601 timestamp",
  "session_id": "Session UUID",
  "shopify_client_id": "Shopify client ID",
  "customer_id": "Customer ID (if logged in)",
  "shopify_customer_id": "Shopify customer ID (if logged in)",
  "seq": "Sequence number",
  "client": {
    "user_agent": "User agent string",
    "language": "Browser language",
    "screen_width": "Screen width in pixels",
    "screen_height": "Screen height in pixels",
    "viewport_width": "Viewport width in pixels",
    "viewport_height": "Viewport height in pixels"
  },
  "document": {
    "location": "Current page URL",
    "referrer": "Referrer URL",
    "title": "Page title"
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

## Event Categories Summary

| Category | Count | Events |
|----------|-------|--------|
| **Standard Shopify Events** | 4 | `product_added_to_cart`, `product_viewed`, `page_viewed`, `checkout_completed` |
| **Custom Try-On Events** | 10 | `widget_opened`, `widget_closed`, `photo_uploaded`, `garment_selected`, `started`, `completed`, `result_viewed`, `result_shared`, `result_downloaded`, `feedback_submitted` |
| **Privacy Events** | 1 | `visitorConsentCollected` |
| **Total** | **15** | All events tracked |

---

## Event Flow by Category

### Standard Shopify Events
```
Shopify Store → Shopify Analytics → Pixel Extension → Backend API
```

### Custom Try-On Events
```
Widget Component → Tracking Function → PostMessage (if iframe) → Parent Bridge → Shopify Analytics → Pixel Extension → Backend API
OR
Widget Component → Tracking Function → Direct Publish → Shopify Analytics → Pixel Extension → Backend API
```

### Privacy Events
```
User Action → Shopify Privacy API → Pixel Extension (state update only)
```

---

## Tracking Function Reference

| Function | Event Published | Called From |
|----------|----------------|-------------|
| `safeTrackWidgetOpen()` | `tryon:widget_opened` | Widget lifecycle |
| `safeTrackWidgetClose()` | `tryon:widget_closed` | Widget lifecycle |
| `safeTrackPhotoUpload()` | `tryon:photo_uploaded` | `TryOnWidget.tsx:1096` |
| `safeTrackGarmentSelect()` | `tryon:garment_selected` | `TryOnWidget.tsx:1123` |
| `safeTrackTryonStart()` | `tryon:started` | `TryOnWidget.tsx:1406` |
| `safeTrackTryonComplete()` | `tryon:completed` | `TryOnWidget.tsx:1489` |
| `safeTrackResultView()` | `tryon:result_viewed` | `TryOnWidget.tsx:2423` |
| `safeTrackShare()` | `tryon:result_shared` | `TryOnWidget.tsx:2305, 2342` |
| `safeTrackDownload()` | `tryon:result_downloaded` | `TryOnWidget.tsx:2157` |
| `safeTrackFeedback()` | `tryon:feedback_submitted` | Feedback submission |
| `safeTrackProductView()` | `product_viewed` | Product page views |
| `safeTrackAddToCart()` | `product_added_to_cart` | `TryOnWidget.tsx:840, 939`, `ResultDisplay.tsx:274, 384` |

---

## Notes

1. **Automatic Events**: `page_viewed` and `checkout_completed` are automatically tracked by Shopify - no manual publishing needed.

2. **Dual Tracking**: `product_added_to_cart` is tracked both:
   - Via Pixel (analytics/attribution) - works without customer login
   - Via Cart Tracking API (business logic) - requires customer login

3. **Iframe Support**: All widget events support both iframe and standalone modes via postMessage fallback.

4. **Privacy Compliance**: All events include privacy consent status and respect user preferences.

5. **Session Management**: Session ID is managed in cookies (Pixel Extension) and localStorage (Tracking Utility).

