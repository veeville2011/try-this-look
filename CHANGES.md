# Frontend API Integration Changes - Latest Pricing Plans

This document outlines all the frontend changes required to integrate with the updated backend APIs following the latest pricing plan structure.

## Table of Contents
1. [Overview](#overview)
2. [Plan Structure Changes](#plan-structure-changes)
3. [API Endpoints Changes](#api-endpoints-changes)
4. [Request/Response Format Updates](#requestresponse-format-updates)
5. [Breaking Changes](#breaking-changes)
6. [Migration Guide](#migration-guide)

---

## Overview

### What Changed?
- **Plan Structure**: Updated from 2-tier to 4-tier pricing (Free, Starter, Growth, Pro)
- **Trial Period**: Removed completely - all plans start billing immediately
- **Overage Billing**: Now enabled for ALL plans including Free plan
- **Payment Collection**: Required for ALL plans (including Free $0 plan)
- **Plan Handles**: Updated to new naming convention

### New Plan Structure
| Plan | Monthly Price | Annual Price | Credits | Overage Rate |
|------|---------------|--------------|---------|--------------|
| Free | $0 | N/A | 10 | $0.50 |
| Starter | $30 | $300 | 75 | $0.40 |
| Growth | $79 | $799 | 200 | $0.40 |
| Pro | $149 | $1,499 | 500 | $0.30 |

---

## Plan Structure Changes

### Plan Handles (Updated)

**Old Plan Handles** (if existed):
- May have been: `basic`, `pro`, `basic-annual`, `pro-annual`

**New Plan Handles** (Required):
```typescript
const PLAN_HANDLES = {
  FREE_MONTHLY: 'free-monthly',
  STARTER_MONTHLY: 'starter-monthly',
  STARTER_ANNUAL: 'starter-annual',
  GROWTH_MONTHLY: 'growth-monthly',
  GROWTH_ANNUAL: 'growth-annual',
  PRO_MONTHLY: 'pro-monthly',
  PRO_ANNUAL: 'pro-annual',
} as const;

type PlanHandle = typeof PLAN_HANDLES[keyof typeof PLAN_HANDLES];
```

### Plan Configuration

**All plans now have:**
- `trialDays: 0` (no trial period)
- `hasOverage: true` for monthly plans
- `yearlySavings` calculated for annual plans
- `isFree: boolean` flag

---

## API Endpoints Changes

### 1. GET `/api/billing/plans`

**Endpoint:** `GET /api/billing/plans`

**Changes:**
- Returns 7 plans instead of previous count
- Added computed fields: `isFree`, `hasOverage`, `yearlySavings`
- Added `planTiers` grouping

**New Response Structure:**
```typescript
interface PlansResponse {
  plans: Plan[];
  totalPlans: number;
  planTiers: {
    free: Plan[];
    starter: Plan[];
    growth: Plan[];
    pro: Plan[];
  };
}

interface Plan {
  name: string;
  handle: string;
  price: number;
  currencyCode: string;
  interval: 'EVERY_30_DAYS' | 'ANNUAL';
  trialDays: 0;  // ⚠️ Always 0 now
  description: string;
  features: string[];
  limits: {
    includedCredits: number;
    costPerGeneration: number;
    imageQuality: 'watermarked' | 'full-hd';
    supportLevel: string;
    analyticsLevel: string;
    apiAccess: boolean;
    processingPriority: string;
  };
  monthlyEquivalent?: number;  // Only for annual plans
  // ⚠️ NEW computed fields:
  isFree: boolean;
  hasOverage: boolean;  // true for all monthly plans
  yearlySavings: number | null;  // Only for annual plans
}
```

**Example Response:**
```json
{
  "plans": [
    {
      "name": "Free",
      "handle": "free-monthly",
      "price": 0.0,
      "currencyCode": "USD",
      "interval": "EVERY_30_DAYS",
      "trialDays": 0,
      "description": "10 credits per month with watermarked images...",
      "features": [
        "10 monthly credits included",
        "Watermarked image quality",
        "Community support",
        "Basic analytics",
        "Overage billing: $0.50 per credit after 10 free credits",
        "Payment method required for overage billing"
      ],
      "limits": {
        "includedCredits": 10,
        "costPerGeneration": 0.50,
        "imageQuality": "watermarked",
        "supportLevel": "community",
        "analyticsLevel": "basic",
        "apiAccess": false,
        "processingPriority": "standard"
      },
      "isFree": true,
      "hasOverage": true,
      "yearlySavings": null
    },
    {
      "name": "Starter",
      "handle": "starter-annual",
      "price": 300.0,
      "currencyCode": "USD",
      "interval": "ANNUAL",
      "trialDays": 0,
      "monthlyEquivalent": 25.0,
      "limits": {
        "includedCredits": 75,
        "costPerGeneration": 0.40,
        "imageQuality": "full-hd",
        "supportLevel": "email-24h",
        "analyticsLevel": "basic",
        "apiAccess": false,
        "processingPriority": "standard"
      },
      "isFree": false,
      "hasOverage": false,
      "yearlySavings": 60
    }
  ],
  "totalPlans": 7,
  "planTiers": {
    "free": [...],
    "starter": [...],
    "growth": [...],
    "pro": [...]
  }
}
```

**Frontend Changes Required:**
```typescript
// ❌ OLD - Remove trial period checks
if (plan.trialDays > 0) {
  showTrialBadge(plan.trialDays);
}

// ✅ NEW - No trial period
// Remove all trial-related UI

// ✅ NEW - Use computed fields
if (plan.isFree) {
  showFreePlanBadge();
}

if (plan.yearlySavings) {
  showSavingsBadge(`Save $${plan.yearlySavings}/year`);
}
```

---

### 2. GET `/api/billing/subscription`

**Endpoint:** `GET /api/billing/subscription?shop={shopDomain}`

**Changes:**
- `isFree` flag now correctly identifies Free plan
- `trialDays`, `trialDaysRemaining`, `isInTrial` always return 0/false
- Plan object includes full `limits` object

**Response Structure:**
```typescript
interface SubscriptionResponse {
  requestId: string;
  hasActiveSubscription: boolean;
  isFree: boolean;  // ⚠️ Updated logic
  plan: Plan | null;
  subscription: Subscription | null;
}

interface Subscription {
  id: string;
  status: 'ACTIVE' | 'CANCELLED' | 'EXPIRED' | 'FROZEN';
  currentPeriodEnd: string;
  approvedAt: string | null;
  planStartDate: string | null;
  currentPeriodStart: string | null;
  createdAt: string;
  name: string;
  trialDays: 0;  // ⚠️ Always 0
  trialDaysRemaining: 0;  // ⚠️ Always 0
  isInTrial: false;  // ⚠️ Always false
}
```

**Example Response:**
```json
{
  "requestId": "req-1234567890-abc123",
  "hasActiveSubscription": true,
  "isFree": true,
  "plan": {
    "name": "Free",
    "handle": "free-monthly",
    "price": 0.0,
    "currencyCode": "USD",
    "interval": "EVERY_30_DAYS",
    "trialDays": 0,
    "description": "...",
    "features": [...],
    "limits": {
      "includedCredits": 10,
      "costPerGeneration": 0.50,
      "imageQuality": "watermarked",
      "supportLevel": "community",
      "analyticsLevel": "basic",
      "apiAccess": false
    }
  },
  "subscription": {
    "id": "gid://shopify/AppSubscription/123",
    "status": "ACTIVE",
    "currentPeriodEnd": "2024-02-01T00:00:00Z",
    "approvedAt": "2024-01-01T00:00:00Z",
    "planStartDate": "2024-01-01T00:00:00Z",
    "currentPeriodStart": "2024-01-01T00:00:00Z",
    "createdAt": "2024-01-01T00:00:00Z",
    "name": "Free",
    "trialDays": 0,
    "trialDaysRemaining": 0,
    "isInTrial": false
  }
}
```

**Frontend Changes Required:**
```typescript
// ❌ OLD - Remove trial checks
if (subscription.isInTrial) {
  showTrialCountdown(subscription.trialDaysRemaining);
}

// ✅ NEW - Use isFree flag
if (response.isFree) {
  showFreePlanUI();
}

// ✅ NEW - Credits available immediately
// No need to check trial status - credits are always available
```

---

### 3. POST `/api/billing/subscribe`

**Endpoint:** `POST /api/billing/subscribe?shop={shopDomain}`

**Request Body:**
```typescript
interface SubscribeRequest {
  planHandle: PlanHandle;  // ⚠️ Updated plan handles
  promoCode?: string;  // Optional
}
```

**Valid Plan Handles:**
- `free-monthly`
- `starter-monthly`
- `starter-annual`
- `growth-monthly`
- `growth-annual`
- `pro-monthly`
- `pro-annual`

**Response Structure:**
```typescript
interface SubscribeResponse {
  confirmationUrl: string;  // ⚠️ Required for ALL plans (including Free)
  appSubscription: {
    id: string;
    status: string;
    name: string;
    currentPeriodEnd: string;
    lineItems: Array<{
      id: string;
      plan: {
        pricingDetails: {
          __typename: 'AppRecurringPricing' | 'AppUsagePricing';
          // Recurring pricing fields
          interval?: string;
          price?: {
            amount: string;
            currencyCode: string;
          };
          // Usage pricing fields
          terms?: string;
          cappedAmount?: {
            amount: string;
            currencyCode: string;
          };
        };
      };
    }>;
  };
  plan: {
    name: string;
    handle: string;
    price: number;
    currencyCode: string;
    interval: string;
  };
  requestId: string;
}
```

**Example Request:**
```typescript
// Subscribe to Free plan
const response = await fetch('/api/billing/subscribe?shop=example.myshopify.com', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    planHandle: 'free-monthly'
  })
});

const data = await response.json();
// ⚠️ IMPORTANT: Redirect to confirmationUrl for ALL plans
window.location.href = data.confirmationUrl;
```

**Frontend Changes Required:**
```typescript
// ❌ OLD - Skip payment for free plans
if (plan.price === 0) {
  // Skip payment collection
  return;
}

// ✅ NEW - ALWAYS redirect to confirmationUrl
// Payment method collection required for ALL plans
window.location.href = response.confirmationUrl;
```

---

### 4. GET `/api/credits/balance`

**Endpoint:** `GET /api/credits/balance?shop={shopDomain}`

**Changes:**
- Trial credits always 0 (removed from response)
- Credits available immediately (no trial delay)
- Overage info includes plan-specific rates

**Response Structure:**
```typescript
interface CreditsBalanceResponse {
  requestId: string;
  creditBalance: {
    total: number;
    breakdown: {
      trial: 0;  // ⚠️ Always 0
      coupon: number;
      plan: number;
      purchased: number;
    };
    overageInfo: {
      type: 'usage_record' | 'tracked' | 'not_available';
      available: boolean;
      balanceUsed?: number;
      cappedAmount?: number;
      remaining?: number;
      currentOverage?: number;
      reason?: string;
    } | null;
  };
  subscription: SubscriptionStatus | null;
}
```

**Example Response:**
```json
{
  "requestId": "req-1234567890-abc123",
  "creditBalance": {
    "total": 10,
    "breakdown": {
      "trial": 0,
      "coupon": 0,
      "plan": 10,
      "purchased": 0
    },
    "overageInfo": {
      "type": "usage_record",
      "available": true,
      "balanceUsed": 0.0,
      "cappedAmount": 50.0,
      "remaining": 50.0
    }
  },
  "subscription": {
    "hasActiveSubscription": true,
    "isFree": true,
    "plan": {
      "name": "Free",
      "handle": "free-monthly",
      "limits": {
        "includedCredits": 10,
        "costPerGeneration": 0.50
      }
    }
  }
}
```

**Frontend Changes Required:**
```typescript
// ❌ OLD - Remove trial credits display
<div>Trial Credits: {balance.breakdown.trial}</div>

// ✅ NEW - Show only active credit types
<div>Plan Credits: {balance.breakdown.plan}</div>
<div>Coupon Credits: {balance.breakdown.coupon}</div>
<div>Purchased Credits: {balance.breakdown.purchased}</div>

// ✅ NEW - Show overage info
{balance.overageInfo && (
  <div>
    Overage Available: ${balance.overageInfo.remaining}
    (Rate: ${subscription.plan.limits.costPerGeneration}/credit)
  </div>
)}
```

---

### 5. Error Responses

**New Error Messages:**

**Free Plan Credits Exhausted:**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Free plan credits exhausted and overage limit reached ($50/month). Please wait for next billing period or upgrade to a paid plan for higher limits."
  },
  "reason": "Free plan credits exhausted and overage limit reached...",
  "creditBalance": 0,
  "creditBreakdown": {
    "trial": 0,
    "coupon": 0,
    "plan": 0,
    "purchased": 0
  },
  "overageInfo": {
    "type": "usage_record",
    "available": false,
    "balanceUsed": 50.0,
    "cappedAmount": 50.0,
    "remaining": 0
  },
  "isFreePlan": true
}
```

**Overage Limit Reached:**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Credit limit exceeded. Please increase your capped amount or wait for next billing period."
  },
  "reason": "Credit limit exceeded...",
  "creditBalance": 0,
  "overageInfo": {
    "type": "usage_record",
    "available": false,
    "balanceUsed": 50.0,
    "cappedAmount": 50.0,
    "remaining": 0
  }
}
```

**Frontend Error Handling:**
```typescript
// ✅ NEW - Handle Free plan specific errors
if (error.isFreePlan && error.creditBalance === 0) {
  showUpgradePrompt('Free plan credits exhausted. Upgrade for more credits.');
}

// ✅ NEW - Handle overage limit
if (error.overageInfo && !error.overageInfo.available) {
  showMessage('Overage limit reached. Please wait for next billing period.');
}
```

---

## Request/Response Format Updates

### TypeScript Interfaces

**Complete Type Definitions:**
```typescript
// Plan Types
type PlanInterval = 'EVERY_30_DAYS' | 'ANNUAL';
type PlanHandle = 
  | 'free-monthly'
  | 'starter-monthly'
  | 'starter-annual'
  | 'growth-monthly'
  | 'growth-annual'
  | 'pro-monthly'
  | 'pro-annual';

interface Plan {
  name: string;
  handle: PlanHandle;
  price: number;
  currencyCode: string;
  interval: PlanInterval;
  trialDays: 0;  // Always 0
  description: string;
  features: string[];
  limits: {
    includedCredits: number;
    costPerGeneration: number;
    imageQuality: 'watermarked' | 'full-hd';
    supportLevel: string;
    analyticsLevel: string;
    apiAccess: boolean;
    processingPriority: string;
  };
  monthlyEquivalent?: number;
  // Computed fields
  isFree: boolean;
  hasOverage: boolean;
  yearlySavings: number | null;
}

interface Subscription {
  id: string;
  status: 'ACTIVE' | 'CANCELLED' | 'EXPIRED' | 'FROZEN';
  currentPeriodEnd: string;
  approvedAt: string | null;
  planStartDate: string | null;
  currentPeriodStart: string | null;
  createdAt: string;
  name: string;
  trialDays: 0;  // Always 0
  trialDaysRemaining: 0;  // Always 0
  isInTrial: false;  // Always false
}

interface SubscriptionStatus {
  hasActiveSubscription: boolean;
  isFree: boolean;
  plan: Plan | null;
  subscription: Subscription | null;
}

interface CreditBalance {
  total: number;
  breakdown: {
    trial: 0;  // Always 0
    coupon: number;
    plan: number;
    purchased: number;
  };
  overageInfo: {
    type: 'usage_record' | 'tracked' | 'not_available';
    available: boolean;
    balanceUsed?: number;
    cappedAmount?: number;
    remaining?: number;
    currentOverage?: number;
    reason?: string;
  } | null;
}
```

---

## Breaking Changes

### 1. Trial Period Removed
- ❌ **REMOVED**: `trialDays`, `trialDaysRemaining`, `isInTrial` fields (always 0/false)
- ❌ **REMOVED**: Trial credits from credit balance
- ✅ **NEW**: Credits available immediately upon subscription

### 2. Plan Handles Changed
- ❌ **OLD**: May have been `basic`, `pro`, etc.
- ✅ **NEW**: `free-monthly`, `starter-monthly`, `starter-annual`, etc.

### 3. Payment Collection Required
- ❌ **OLD**: Free plans may have skipped payment collection
- ✅ **NEW**: ALL plans require payment method collection (including Free)

### 4. Overage Billing Enabled
- ❌ **OLD**: Free plan may not have had overage billing
- ✅ **NEW**: ALL plans support overage billing (including Free)

### 5. API Response Structure
- ✅ **NEW**: `isFree` flag in subscription response
- ✅ **NEW**: `planTiers` grouping in plans response
- ✅ **NEW**: `yearlySavings` computed field
- ✅ **NEW**: `hasOverage` computed field

---

## Migration Guide

### Step 1: Update Plan Constants

```typescript
// ❌ OLD
const PLANS = {
  BASIC: 'basic',
  PRO: 'pro',
};

// ✅ NEW
const PLAN_HANDLES = {
  FREE_MONTHLY: 'free-monthly',
  STARTER_MONTHLY: 'starter-monthly',
  STARTER_ANNUAL: 'starter-annual',
  GROWTH_MONTHLY: 'growth-monthly',
  GROWTH_ANNUAL: 'growth-annual',
  PRO_MONTHLY: 'pro-monthly',
  PRO_ANNUAL: 'pro-annual',
} as const;
```

### Step 2: Remove Trial Period Logic

```typescript
// ❌ OLD - Remove all trial-related code
if (subscription.isInTrial) {
  showTrialUI(subscription.trialDaysRemaining);
}

// ✅ NEW - No trial period
// Remove all trial-related UI components
```

### Step 3: Update Subscription Flow

```typescript
// ❌ OLD
async function subscribe(planHandle: string) {
  if (plan.price === 0) {
    // Skip payment for free plans
    return;
  }
  const response = await createSubscription(planHandle);
  window.location.href = response.confirmationUrl;
}

// ✅ NEW
async function subscribe(planHandle: PlanHandle) {
  const response = await createSubscription(planHandle);
  // ALWAYS redirect - payment required for ALL plans
  window.location.href = response.confirmationUrl;
}
```

### Step 4: Update Credit Display

```typescript
// ❌ OLD
function CreditDisplay({ balance }) {
  return (
    <div>
      {balance.trial > 0 && <div>Trial: {balance.trial}</div>}
      {balance.plan > 0 && <div>Plan: {balance.plan}</div>}
      {subscription.isInTrial && <div>Waiting for trial to end...</div>}
    </div>
  );
}

// ✅ NEW
function CreditDisplay({ balance, subscription }) {
  return (
    <div>
      <div>Plan Credits: {balance.plan}</div>
      {balance.coupon > 0 && <div>Coupon: {balance.coupon}</div>}
      {balance.purchased > 0 && <div>Purchased: {balance.purchased}</div>}
      {balance.overageInfo?.available && (
        <div>
          Overage Available: ${balance.overageInfo.remaining}
          (${subscription.plan.limits.costPerGeneration}/credit)
        </div>
      )}
    </div>
  );
}
```

### Step 5: Update Plan Selection UI

```typescript
// ✅ NEW - Show all 7 plans
function PlanSelector({ plans }) {
  return (
    <div>
      {plans.planTiers.free.map(plan => (
        <PlanCard key={plan.handle} plan={plan} />
      ))}
      {plans.planTiers.starter.map(plan => (
        <PlanCard key={plan.handle} plan={plan} />
      ))}
      {plans.planTiers.growth.map(plan => (
        <PlanCard key={plan.handle} plan={plan} />
      ))}
      {plans.planTiers.pro.map(plan => (
        <PlanCard key={plan.handle} plan={plan} />
      ))}
    </div>
  );
}

function PlanCard({ plan }) {
  return (
    <div>
      <h3>{plan.name}</h3>
      <div>${plan.price}/{plan.interval === 'ANNUAL' ? 'year' : 'month'}</div>
      <div>{plan.limits.includedCredits} credits</div>
      {plan.yearlySavings && (
        <div>Save ${plan.yearlySavings}/year</div>
      )}
      {plan.hasOverage && (
        <div>Overage: ${plan.limits.costPerGeneration}/credit</div>
      )}
      {plan.isFree && (
        <div>Payment method required for overage billing</div>
      )}
    </div>
  );
}
```

### Step 6: Update Error Handling

```typescript
// ✅ NEW - Handle new error messages
function handleGenerationError(error) {
  if (error.isFreePlan && error.creditBalance === 0) {
    return {
      message: 'Free plan credits exhausted. Upgrade for more credits.',
      action: 'upgrade',
      actionLabel: 'Upgrade Plan'
    };
  }
  
  if (error.overageInfo && !error.overageInfo.available) {
    return {
      message: 'Overage limit reached. Please wait for next billing period.',
      action: 'wait',
      actionLabel: 'View Credits'
    };
  }
  
  return {
    message: error.message || 'An error occurred',
    action: 'retry',
    actionLabel: 'Try Again'
  };
}
```

---

## Testing Checklist

### API Integration Tests

- [ ] Test GET `/api/billing/plans` returns 7 plans
- [ ] Test all plan handles are valid
- [ ] Test `isFree`, `hasOverage`, `yearlySavings` fields present
- [ ] Test GET `/api/billing/subscription` returns correct `isFree` flag
- [ ] Test POST `/api/billing/subscribe` with all plan handles
- [ ] Test `confirmationUrl` redirect for ALL plans (including Free)
- [ ] Test GET `/api/credits/balance` returns credits immediately
- [ ] Test error responses for Free plan credit exhaustion
- [ ] Test error responses for overage limit reached

### UI Tests

- [ ] Remove all trial period UI elements
- [ ] Display all 7 plans correctly
- [ ] Show correct pricing for all plans
- [ ] Show yearly savings for annual plans
- [ ] Show overage information for all plans
- [ ] Show payment collection message for Free plan
- [ ] Handle credit balance display (no trial credits)
- [ ] Handle error messages correctly
- [ ] Test subscription flow for all plans

---

## Summary

### Key Changes
1. ✅ **7 Plans**: Free, Starter, Growth, Pro (monthly + annual)
2. ✅ **No Trial**: All plans start immediately
3. ✅ **Payment Required**: ALL plans require payment method
4. ✅ **Overage Enabled**: ALL plans support overage billing
5. ✅ **New Fields**: `isFree`, `hasOverage`, `yearlySavings`
6. ✅ **Updated Handles**: New plan handle naming convention

### Required Actions
1. Update plan handles throughout frontend
2. Remove all trial period logic and UI
3. Update API calls to handle new response structures
4. Add payment collection flow for Free plan
5. Update credit display (remove trial credits)
6. Update error handling for new error messages
7. Test all subscription flows

---

## Support

For questions or issues with API integration, please refer to:
- Backend API documentation
- Plan configuration: `server/utils/billing.js`
- API routes: `server/routes/billing.js`

---

**Last Updated:** 2024-01-XX
**API Version:** Latest Pricing Plans Update

