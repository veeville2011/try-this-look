# Events Summary Table

## PostMessage Events (iframe Communication)

| Event Type | Direction | Description | Handled In |
|------------|-----------|-------------|------------|
| `NUSENSE_PRODUCT_DATA` | Incoming | Product data from Shopify page | `TryOnWidget.tsx`, `ResultDisplay.tsx` |
| `NUSENSE_PRODUCT_IMAGES` | Incoming | Product images extracted from page | `TryOnWidget.tsx` |
| `NUSENSE_STORE_INFO` | Incoming | Store information (domain, shopDomain, origin) | `TryOnWidget.tsx` |
| `NUSENSE_CART_STATE` | Incoming | Current cart state/items | `TryOnWidget.tsx` |
| `NUSENSE_CART_ITEMS` | Incoming | Cart items for Try Multiple/Look tabs | `TryOnWidget.tsx` |
| `NUSENSE_ACTION_SUCCESS` | Incoming | Success response for cart actions | `TryOnWidget.tsx`, `ResultDisplay.tsx` |
| `NUSENSE_ACTION_ERROR` | Incoming | Error response for cart actions | `TryOnWidget.tsx`, `ResultDisplay.tsx` |
| `NUSENSE_ACTION_INFO` | Incoming | Info messages | `TryOnWidget.tsx` |
| `NUSENSE_REQUEST_STORE_INFO` | Outgoing | Request store information | `TryOnWidget.tsx`, `shopifyIntegration.ts` |
| `NUSENSE_REQUEST_PRODUCT_DATA` | Outgoing | Request product data | `TryOnWidget.tsx` |
| `NUSENSE_REQUEST_CART_STATE` | Outgoing | Request current cart state | `TryOnWidget.tsx` |
| `NUSENSE_REQUEST_IMAGES` | Outgoing | Request product images | `TryOnWidget.tsx` |
| `NUSENSE_ADD_TO_CART` | Outgoing | Add product to cart | `TryOnWidget.tsx`, `ResultDisplay.tsx` |
| `NUSENSE_BUY_NOW` | Outgoing | Buy now (redirect to checkout) | `TryOnWidget.tsx`, `ResultDisplay.tsx` |
| `NUSENSE_NOTIFY_ME` | Outgoing | Request back-in-stock notification | `TryOnWidget.tsx` |
| `NUSENSE_TRY_IN_STORE` | Outgoing | Try in store (not implemented) | `nusense-parent-bridge.js` |
| `NUSENSE_CLOSE_WIDGET` | Outgoing | Close widget modal | `nusense-tryon-button.js`, `nusense-test-button.js` |
| `NUSENSE_TRACK_EVENT` | Outgoing | Tracking events | `nusense-parent-bridge.js`, `tracking.ts` |

## Shopify Analytics Events (Web Pixel Extension)

| Event Type | Category | Description | Handled In |
|------------|----------|-------------|------------|
| `product_added_to_cart` | Standard | Product added to cart | `nusense-pixel/src/index.js` |
| `product_viewed` | Standard | Product page viewed | `nusense-pixel/src/index.js` |
| `page_viewed` | Standard | Any page viewed | `nusense-pixel/src/index.js` |
| `checkout_completed` | Standard | Checkout completed | `nusense-pixel/src/index.js` |
| `tryon:widget_opened` | Custom | Widget opened | `nusense-pixel/src/index.js` |
| `tryon:widget_closed` | Custom | Widget closed | `nusense-pixel/src/index.js` |
| `tryon:photo_uploaded` | Custom | Photo uploaded | `nusense-pixel/src/index.js` |
| `tryon:garment_selected` | Custom | Garment selected | `nusense-pixel/src/index.js` |
| `tryon:started` | Custom | Try-on generation started | `nusense-pixel/src/index.js` |
| `tryon:completed` | Custom | Try-on generation completed | `nusense-pixel/src/index.js` |
| `tryon:result_viewed` | Custom | Result viewed | `nusense-pixel/src/index.js` |
| `tryon:result_shared` | Custom | Result shared | `nusense-pixel/src/index.js` |
| `tryon:result_downloaded` | Custom | Result downloaded | `nusense-pixel/src/index.js` |
| `tryon:feedback_submitted` | Custom | Feedback submitted | `nusense-pixel/src/index.js` |
| `visitorConsentCollected` | Privacy | Customer privacy consent updated | `nusense-pixel/src/index.js` |

## DOM Events

| Event Type | Trigger | Description | Handled In |
|------------|---------|-------------|------------|
| `keydown` | Escape key | Close widget modal | `nusense-tryon-button.js`, `nusense-test-button.js`, `nusense-tryon-widget.js` |
| `click` | Button click | Open widget (delegated) | `nusense-tryon-widget.js` |
| `click` | Overlay click | Close widget | `nusense-tryon-button.js`, `nusense-test-button.js` |
| `load` | Iframe loaded | Iframe load complete | `nusense-tryon-button.js`, `nusense-test-button.js` |
| `message` | PostMessage | Cross-origin communication | Multiple files |

## Custom Window Events

| Event Type | Description | Handled In |
|------------|-------------|------------|
| `subscriptionUpdated` | Subscription updated (cross-tab communication) | `Index.tsx` |
| `openPricingModal` | Open pricing/plan selection modal | `Index.tsx` |

## Shopify Native Cart Events

| Event Type | Description | Handled In |
|------------|-------------|------------|
| `cart:add` | Native Shopify cart add event | `nusense-parent-bridge.js` |
| `cart:updated` | Native Shopify cart updated event | `nusense-parent-bridge.js` |

## NUSENSE_TRACK_EVENT Sub-Events

| Event Type | Description | Published Via |
|------------|-------------|---------------|
| `widget_opened` | Widget opened | `Shopify.analytics.publish('tryon:widget_opened')` |
| `widget_closed` | Widget closed | `Shopify.analytics.publish('tryon:widget_closed')` |
| `photo_uploaded` | Photo uploaded | `Shopify.analytics.publish('tryon:photo_uploaded')` |
| `garment_selected` | Garment selected | `Shopify.analytics.publish('tryon:garment_selected')` |
| `tryon_started` | Try-on started | `Shopify.analytics.publish('tryon:started')` |
| `tryon_completed` | Try-on completed | `Shopify.analytics.publish('tryon:completed')` |
| `result_viewed` | Result viewed | `Shopify.analytics.publish('tryon:result_viewed')` |
| `result_shared` | Result shared | `Shopify.analytics.publish('tryon:result_shared')` |
| `result_downloaded` | Result downloaded | `Shopify.analytics.publish('tryon:result_downloaded')` |
| `feedback_submitted` | Feedback submitted | `Shopify.analytics.publish('tryon:feedback_submitted')` |
| `product_viewed` | Product viewed | `Shopify.analytics.publish('product_viewed')` |
| `add_to_cart` | Add to cart | `Shopify.analytics.publish('product_added_to_cart')` |

## NUSENSE_ACTION_SUCCESS/ERROR Actions

| Action Type | Description | Handled In |
|-------------|-------------|------------|
| `NUSENSE_ADD_TO_CART` | Add to cart action | `TryOnWidget.tsx`, `ResultDisplay.tsx` |
| `NUSENSE_BUY_NOW` | Buy now action | `TryOnWidget.tsx`, `ResultDisplay.tsx` |
| `NUSENSE_NOTIFY_ME` | Notify me action | `TryOnWidget.tsx` |

---

## Summary Statistics

- **Total PostMessage Events**: 18
- **Total Shopify Analytics Events**: 15
- **Total DOM Events**: 5
- **Total Custom Window Events**: 2
- **Total Shopify Native Events**: 2
- **Total NUSENSE_TRACK_EVENT Sub-Events**: 12
- **Total Action Types**: 3

**Grand Total: 50+ distinct event types**

