# Billing Flow - Complete Implementation

## 📋 Overview
This document describes the complete billing flow implementation with plan selection UI.

## 🔄 Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    MERCHANT OPENS APP                           │
│              (Embedded in Shopify Admin)                        │
└───────────────────────────┬───────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  Index.tsx - useEffect Hook                                      │
│  • Checks subscription status via useSubscription hook          │
│  • Calls GET /api/billing/subscription?shop=xxx                  │
└───────────────────────────┬───────────────────────────────────┘
                            │
                            ▼
                    ┌───────────────┐
                    │ Has Active     │
                    │ Subscription? │
                    └───────┬───────┘
                            │
            ┌───────────────┴───────────────┐
            │                               │
            NO                              YES
            │                               │
            ▼                               ▼
┌───────────────────────┐      ┌──────────────────────────┐
│ handleRequireBilling() │      │ Show Main Dashboard       │
│ is called             │      │ (All features available)   │
└───────────┬───────────┘      └──────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────────┐
│  Step 1: Fetch Available Plans                                  │
│  • Calls GET /api/billing/plans                                  │
│  • Uses authenticatedFetch (includes JWT token)                 │
│  • Backend returns:                                             │
│    {                                                             │
│      plans: [                                                    │
│        {                                                         │
│          name: "Plan Standard",                                 │
│          handle: "pro-monthly",                                 │
│          price: 20.0,                                           │
│          interval: "EVERY_30_DAYS",                             │
│          trialDays: 15,                                         │
│          features: [...]                                         │
│        },                                                        │
│        {                                                         │
│          name: "Plan Standard",                                 │
│          handle: "pro-annual",                                  │
│          price: 180.0,                                          │
│          interval: "ANNUAL",                                    │
│          monthlyEquivalent: 20.0,                              │
│          trialDays: 15,                                         │
│          features: [...]                                         │
│        }                                                         │
│      ]                                                           │
│    }                                                             │
└───────────────────────────┬───────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  Step 2: Show Plan Selection UI                                  │
│  • setShowPlanSelection(true)                                   │
│  • Renders PlanSelection component                             │
│  • Displays tabs: "Mensuel" / "Annuel"                         │
│  • Shows plan card with:                                        │
│    - Plan name                                                  │
│    - Price (dynamic based on selected tab)                      │
│    - Trial days badge                                           │
│    - Features list                                              │
│    - "Sélectionner ce plan" button                             │
└───────────────────────────┬───────────────────────────────────┘
                            │
                            ▼
                    ┌───────────────┐
                    │ Merchant      │
                    │ Selects Plan  │
                    │ (Clicks Tab)  │
                    └───────┬───────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  PlanSelection Component                                         │
│  • Updates selectedInterval state                               │
│  • Shows corresponding plan (monthly or annual)                 │
│  • Updates price display                                        │
│  • Shows "Économisez 25%" badge for annual                     │
└───────────────────────────┬───────────────────────────────────┘
                            │
                            ▼
                    ┌───────────────┐
                    │ Merchant      │
                    │ Clicks        │
                    │ "Sélectionner │
                    │ ce plan"      │
                    └───────┬───────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  Step 3: Create Subscription                                     │
│  • handleSelectPlan(planHandle) is called                       │
│  • Calls POST /api/billing/subscribe                            │
│  • Request body:                                                │
│    {                                                             │
│      shop: "vto-demo.myshopify.com",                           │
│      planHandle: "pro-monthly" or "pro-annual"                 │
│    }                                                             │
│  • Uses authenticatedFetch (includes JWT token)                 │
└───────────────────────────┬───────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  Backend: POST /api/billing/subscribe                           │
│  • Validates shop and planHandle                                │
│  • Calls createAppSubscription()                                │
│  • Exchanges JWT session token for offline access token         │
│  • Creates GraphQL client                                       │
│  • Executes appSubscriptionCreate mutation                      │
│  • Returns confirmationUrl                                      │
└───────────────────────────┬───────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  GraphQL Mutation: appSubscriptionCreate                        │
│  • Variables:                                                    │
│    - name: "Plan Standard"                                      │
│    - returnUrl: "https://app.com/api/billing/return?shop=xxx"  │
│    - lineItems: [{                                              │
│        plan: {                                                   │
│          appRecurringPricingDetails: {                          │
│            interval: "EVERY_30_DAYS" or "ANNUAL",              │
│            price: {                                              │
│              amount: 20.0 or 180.0,                            │
│              currencyCode: "USD"                                │
│            }                                                     │
│          }                                                       │
│        }                                                         │
│      }]                                                          │
│    - trialDays: 15                                               │
│    - test: false (or true if SHOPIFY_BILLING_TEST=true)         │
│  • Response:                                                     │
│    {                                                             │
│      confirmationUrl: "https://admin.shopify.com/...",         │
│      appSubscription: { id, status, name }                      │
│    }                                                             │
└───────────────────────────┬───────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  Step 4: Redirect to Shopify Billing Page                        │
│  • Frontend receives confirmationUrl                           │
│  • Uses App Bridge Redirect action                             │
│  • redirect.dispatch(Redirect.Action.REMOTE, {                 │
│      url: confirmationUrl,                                      │
│      newContext: true  // Breaks out of iframe                  │
│    })                                                            │
│  • Opens in new window/tab                                      │
└───────────────────────────┬───────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  Shopify Admin - Billing Approval Page                           │
│  • Merchant reviews plan details                               │
│  • Sees trial period information                                │
│  • Clicks "Approve" or "Decline"                                │
└───────────────────────────┬───────────────────────────────────┘
                            │
                            ▼
                    ┌───────────────┐
                    │ Merchant      │
                    │ Approves      │
                    │ Charge        │
                    └───────┬───────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  Step 5: Return to App                                           │
│  • Shopify redirects to returnUrl                              │
│  • GET /api/billing/return?shop=xxx                            │
│  • Backend redirects to app base URL                            │
│  • App reloads and checks subscription status                   │
└───────────────────────────┬───────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  Step 6: Subscription Active                                     │
│  • useSubscription hook fetches subscription                    │
│  • GET /api/billing/subscription?shop=xxx                      │
│  • Backend queries Shopify GraphQL API                         │
│  • Returns active subscription status                           │
│  • Main dashboard is shown with all features                   │
└─────────────────────────────────────────────────────────────────┘
```

## 📁 File Structure

```
server/
├── index.js                    # Main Express server
│   ├── GET /api/billing/plans           # Returns available plans
│   ├── GET /api/billing/subscription    # Checks subscription status
│   ├── POST /api/billing/subscribe      # Creates subscription
│   └── GET /api/billing/return          # Handles return from Shopify
│
├── utils/
│   └── billing.js              # Plan configuration
│       ├── PLAN_HANDLES        # Plan handle constants
│       ├── PLANS               # Plan definitions (monthly & annual)
│       ├── getAvailablePlans() # Returns all plans
│       └── getPlan(handle)     # Returns plan by handle

src/
├── pages/
│   └── Index.tsx               # Main app page
│       ├── fetchAvailablePlans()      # Fetches plans from API
│       ├── handleRequireBilling()      # Shows plan selection UI
│       ├── handleSelectPlan()         # Creates subscription
│       └── showPlanSelection state     # Controls UI visibility
│
└── components/
    └── PlanSelection.tsx        # Plan selection component
        ├── Tabs (Monthly/Annual)
        ├── Plan card display
        └── onSelectPlan callback
```

## 🔑 Key Components

### 1. Plan Configuration (`server/utils/billing.js`)
- **Monthly Plan**: $20/month, `EVERY_30_DAYS` interval
- **Annual Plan**: $180/year, `ANNUAL` interval, shows 25% savings
- Both plans have same features and 15-day trial

### 2. Plan Selection UI (`src/components/PlanSelection.tsx`)
- Tabs for switching between Monthly/Annual
- Dynamic pricing display
- Features list with checkmarks
- Trial days badge
- "Sélectionner ce plan" button

### 3. Subscription Creation Flow
- Frontend: `handleSelectPlan(planHandle)`
- Backend: `createAppSubscription(shop, planHandle, sessionToken)`
- GraphQL: `appSubscriptionCreate` mutation
- Redirect: App Bridge `Redirect.Action.REMOTE`

## ✅ Implementation Checklist

- [x] Both monthly and annual plans configured
- [x] Plan selection UI with tabs
- [x] Dynamic pricing display
- [x] Trial days information
- [x] Features list
- [x] App Bridge Redirect for billing approval
- [x] Return URL handling
- [x] Subscription status checking
- [x] No auto-selection (shows UI first)
- [x] Uses design system colors
- [x] Responsive design
- [x] Error handling
- [x] JWT authentication

## 🎨 Design System Integration

- Uses color palette from `src/index.css`
- Primary color: `#c96442` (hsl(14 56% 52%))
- Follows Tailwind CSS utility classes
- Matches Shopify Managed Pricing UI style
- Responsive breakpoints (sm, md, lg)

## 🔒 Security

- All API calls use JWT session tokens
- `authenticatedFetch` from App Bridge Utils
- Backend validates session tokens
- Token exchange for offline access tokens
- No sensitive data in frontend

## 🚀 Testing Flow

1. Open app in Shopify admin
2. If no subscription → Plan selection UI appears
3. Switch between Monthly/Annual tabs
4. Click "Sélectionner ce plan"
5. Redirected to Shopify billing approval
6. Approve the charge
7. Returned to app
8. Subscription is now active
9. Main dashboard shows with all features

