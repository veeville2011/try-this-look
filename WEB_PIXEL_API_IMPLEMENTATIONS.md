# Web Pixel API Implementation Locations

## Overview
The Web Pixel API is implemented in **5 main locations** across the codebase:

1. **Web Pixel Extension** (Event Subscriber) - Listens to all events
2. **Parent Bridge Script** (Event Publisher) - Publishes events from widget
3. **Tracking Utility** (Event Publisher) - Safe wrapper functions
4. **Widget Components** (Event Trigger) - Calls tracking functions
5. **Native Cart Tracking** (Event Publisher) - Tracks native Shopify cart events

---

## 1. Web Pixel Extension (Event Subscriber)

**Location**: `extensions/nusense-pixel/src/index.js`

**Purpose**: Main event subscriber that listens to all Shopify Analytics events and sends them to backend

**API Used**: `analytics.subscribe()`, `customerPrivacy.subscribe()`

**Events Subscribed**:

| Event Type | Line | Description |
|------------|------|-------------|
| `product_added_to_cart` | 97 | Standard Shopify event |
| `product_viewed` | 115 | Standard Shopify event |
| `page_viewed` | 121 | Standard Shopify event |
| `checkout_completed` | 125 | Standard Shopify event |
| `tryon:widget_opened` | 140 | Custom try-on event |
| `tryon:widget_closed` | 147 | Custom try-on event |
| `tryon:photo_uploaded` | 153 | Custom try-on event |
| `tryon:garment_selected` | 162 | Custom try-on event |
| `tryon:started` | 172 | Custom try-on event |
| `tryon:completed` | 181 | Custom try-on event |
| `tryon:result_viewed` | 192 | Custom try-on event |
| `tryon:result_shared` | 200 | Custom try-on event |
| `tryon:result_downloaded` | 209 | Custom try-on event |
| `tryon:feedback_submitted` | 217 | Custom try-on event |
| `visitorConsentCollected` | 86 | Privacy consent event |

**Backend Endpoint**: `https://ai.nusense.ddns.net/api/tracking/pixel`

**Key Functions**:
- `register()` - Registers the pixel extension
- `sendToBackend()` - Sends events to backend API
- `getSessionId()` - Manages session ID in cookies

---

## 2. Parent Bridge Script (Event Publisher)

**Location**: `extensions/theme-app-extension/assets/nusense-parent-bridge.js`

**Purpose**: Receives tracking events from widget via postMessage and publishes them to Shopify Analytics

**API Used**: `window.Shopify.analytics.publish()`

**Implementation Sections**:

### A. NUSENSE_TRACK_EVENT Handler (Lines 1043-1147)

Handles tracking events from widget iframe:

| Event Type | Line | Published Event |
|------------|------|-----------------|
| `widget_opened` | 1056 | `tryon:widget_opened` |
| `widget_closed` | 1059 | `tryon:widget_closed` |
| `photo_uploaded` | 1062 | `tryon:photo_uploaded` |
| `garment_selected` | 1070 | `tryon:garment_selected` |
| `tryon_started` | 1079 | `tryon:started` |
| `tryon_completed` | 1087 | `tryon:completed` |
| `result_viewed` | 1097 | `tryon:result_viewed` |
| `result_shared` | 1104 | `tryon:result_shared` |
| `result_downloaded` | 1112 | `tryon:result_downloaded` |
| `feedback_submitted` | 1119 | `tryon:feedback_submitted` |
| `product_viewed` | 1128 | `product_viewed` |
| `add_to_cart` | 1134 | `product_added_to_cart` |

### B. Widget Open/Close Tracking (Lines 1165-1187)

Tracks widget visibility using DOM observers:

| Function | Line | Published Event |
|----------|------|-----------------|
| `trackWidgetOpen()` | 1168 | `tryon:widget_opened` |
| `trackWidgetClose()` | 1180 | `tryon:widget_closed` |

**Trigger**: MutationObserver detects iframe visibility changes

### C. Product View Tracking (Lines 1268-1315)

Tracks product views on product pages:

| Function | Line | Published Event |
|----------|------|-----------------|
| `trackProductView()` | 1278 | `product_viewed` |

**Trigger**: When `NUSENSE_PRODUCT_DATA` is available on page load

### D. Native Add to Cart Tracking (Lines 1426-1456)

Tracks native Shopify cart additions:

| Function | Line | Published Event |
|----------|------|-----------------|
| `trackNativeAddToCart()` | 1440 | `product_added_to_cart` |

**Trigger**: Listens to `cart:add` and `cart:updated` events (lines 1645-1646)

---

## 3. Tracking Utility (Event Publisher)

**Location**: `src/utils/tracking.ts`

**Purpose**: Provides safe wrapper functions for publishing events

**API Used**: `window.Shopify.analytics.publish()`, `window.parent.postMessage()`

**Functions**:

| Function | Line | Published Event | Description |
|----------|------|-----------------|-------------|
| `safePublish()` | 22 | Any event | Generic safe publish wrapper |
| `sendTrackingToParent()` | 36 | Via postMessage | Sends to parent if in iframe |
| `safeTrackWidgetOpen()` | 58 | `tryon:widget_opened` | Widget opened |
| `safeTrackWidgetClose()` | 63 | `tryon:widget_closed` | Widget closed |
| `safeTrackPhotoUpload()` | 72 | `tryon:photo_uploaded` | Photo uploaded |
| `safeTrackGarmentSelect()` | 82 | `tryon:garment_selected` | Garment selected |
| `safeTrackTryonStart()` | 93 | `tryon:started` | Try-on started |
| `safeTrackTryonComplete()` | 103 | `tryon:completed` | Try-on completed |
| `safeTrackResultView()` | 124 | `tryon:result_viewed` | Result viewed |
| `safeTrackShare()` | 133 | `tryon:result_shared` | Result shared |
| `safeTrackDownload()` | 143 | `tryon:result_downloaded` | Result downloaded |
| `safeTrackFeedback()` | 152 | `tryon:feedback_submitted` | Feedback submitted |
| `safeTrackProductView()` | 171 | `product_viewed` | Product viewed |
| `safeTrackAddToCart()` | 186 | `product_added_to_cart` | Add to cart |

**Key Features**:
- Checks if `Shopify.analytics.publish` is available before calling
- Falls back to postMessage when in iframe
- Silently fails if API unavailable (tracking is optional)

---

## 4. Widget Components (Event Trigger)

**Location**: `src/components/TryOnWidget.tsx`, `src/components/ResultDisplay.tsx`

**Purpose**: Calls tracking functions when user actions occur

### TryOnWidget.tsx

| Tracking Call | Line | Trigger Event |
|----------------|------|---------------|
| `safeTrackAddToCart()` | 840 | Add to cart button clicked |
| `safeTrackAddToCart()` | 939 | Buy now button clicked |
| `safeTrackPhotoUpload()` | 1096 | Photo uploaded |
| `safeTrackGarmentSelect()` | 1123 | Garment selected |
| `safeTrackTryonStart()` | 1406 | Try-on generation started |
| `safeTrackTryonComplete()` | 1489 | Try-on generation completed |
| `safeTrackDownload()` | 2157 | Download button clicked |
| `safeTrackShare()` | 2305, 2342 | Share button clicked |
| `safeTrackResultView()` | 2423 | Result displayed |

### ResultDisplay.tsx

| Tracking Call | Line | Trigger Event |
|----------------|------|---------------|
| `safeTrackAddToCart()` | 274 | Add to cart from result |
| `safeTrackAddToCart()` | 384 | Buy now from result |

---

## 5. Native Cart Tracking (Event Publisher)

**Location**: `extensions/theme-app-extension/assets/nusense-parent-bridge.js`

**Purpose**: Tracks native Shopify cart events (not from widget)

**API Used**: `window.Shopify.analytics.publish()`

**Event Listeners**:

| Event Listener | Line | Published Event |
|----------------|------|-----------------|
| `cart:add` | 1645 | `product_added_to_cart` |
| `cart:updated` | 1646 | `product_added_to_cart` |

**Function**: `trackNativeAddToCart()` (Line 1426)

**Trigger**: Native Shopify cart form submissions or cart API calls

---

## Event Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Widget Components                         │
│  (TryOnWidget.tsx, ResultDisplay.tsx)                        │
│                                                               │
│  User Action → safeTrack*() functions                        │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│              Tracking Utility (tracking.ts)                 │
│                                                               │
│  - Checks if in iframe                                       │
│  - If iframe: postMessage to parent                         │
│  - If not iframe: direct publish                             │
└───────────────────────┬─────────────────────────────────────┘
                        │
        ┌───────────────┴───────────────┐
        │                               │
        ▼                               ▼
┌───────────────────┐         ┌──────────────────────┐
│  Parent Bridge    │         │  Direct Publish      │
│  (nusense-parent- │         │  (if not in iframe)  │
│   bridge.js)      │         │                      │
│                   │         │  Shopify.analytics   │
│  Receives         │         │  .publish()          │
│  postMessage      │         └──────────┬───────────┘
│  → Publishes      │                    │
└─────────┬─────────┘                    │
          │                              │
          └──────────────┬───────────────┘
                         │
                         ▼
          ┌──────────────────────────────┐
          │   Shopify Analytics System   │
          │   (Shopify.analytics)         │
          └──────────────┬───────────────┘
                         │
                         ▼
          ┌──────────────────────────────┐
          │   Web Pixel Extension        │
          │   (nusense-pixel/index.js)   │
          │                              │
          │   analytics.subscribe()       │
          └──────────────┬───────────────┘
                         │
                         ▼
          ┌──────────────────────────────┐
          │   Backend API                │
          │   /api/tracking/pixel        │
          └──────────────────────────────┘
```

---

## Summary Table

| Location | Type | API Method | Events Handled | Lines |
|----------|------|------------|----------------|-------|
| `extensions/nusense-pixel/src/index.js` | Subscriber | `analytics.subscribe()` | 15 events | 1-228 |
| `extensions/theme-app-extension/assets/nusense-parent-bridge.js` | Publisher | `Shopify.analytics.publish()` | 12+ events | 1050-1456, 1168-1440 |
| `src/utils/tracking.ts` | Publisher | `Shopify.analytics.publish()` | 13 functions | 22-192 |
| `src/components/TryOnWidget.tsx` | Trigger | Calls `safeTrack*()` | 9 tracking calls | Multiple |
| `src/components/ResultDisplay.tsx` | Trigger | Calls `safeTrack*()` | 2 tracking calls | 274, 384 |

---

## Key Implementation Details

### 1. Safety Checks
- All implementations check if `window.Shopify?.analytics?.publish` exists
- Silent failures (tracking is optional, shouldn't break UX)

### 2. Iframe Support
- Widget can run in iframe or standalone
- Uses postMessage when in iframe
- Direct publish when not in iframe

### 3. Event Routing
- Widget → postMessage → Parent Bridge → Shopify Analytics
- OR Widget → Direct publish → Shopify Analytics
- Shopify Analytics → Pixel Extension → Backend API

### 4. Session Management
- Pixel Extension manages session ID in cookies (`nulight_session_id`)
- Tracking utility manages session ID in localStorage
- Both generate UUID v4 if not exists

### 5. Privacy Compliance
- All events include privacy consent status
- Respects user privacy preferences
- Only tracks when consent is given

---

## Total Implementation Count

- **Files with Web Pixel API**: 5
- **Event Subscribers**: 1 (Pixel Extension)
- **Event Publishers**: 2 (Parent Bridge, Tracking Utility)
- **Event Triggers**: 2 (Widget Components)
- **Total Event Types**: 15
- **Total Tracking Functions**: 13
- **Total Publish Calls**: 20+

