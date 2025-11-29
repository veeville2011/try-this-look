# Promotional Code Implementation Plan

## Overview
This document outlines the plan to implement promotional code functionality that allows store owners to enter discount codes when subscribing to a plan. The discount will be applied to the subscription price using Shopify's `appSubscriptionCreate` mutation discount feature.

## Key Findings from Shopify Documentation

### 1. Shopify's Discount Support
- **Shopify's `appSubscriptionCreate` mutation supports discounts directly** in `appRecurringPricingDetails`
- Two discount types supported:
  - **Fixed Amount**: `discount: { value: { amount: 5 }, durationLimitInIntervals: 2 }`
  - **Percentage**: `discount: { value: { percentage: 0.2 }, durationLimitInIntervals: 10 }`
- `durationLimitInIntervals`: Number of billing intervals the discount applies (null = indefinite)

### 2. No Built-in Promotional Code System
- Shopify does NOT provide a built-in promotional code system for app subscriptions
- Discounts must be calculated and applied programmatically when creating subscriptions
- We need to implement our own code validation and discount calculation

### 3. Storage Strategy (No Database)
Since the requirement is "without using any database", we'll use:
- **Hardcoded promotional codes** in `server/utils/billing.js` as a configuration object
- This allows easy management of codes without database infrastructure

## Implementation Plan

### Phase 1: Backend Configuration (`server/utils/billing.js`)

#### 1.1 Add Promotional Codes Configuration
```javascript
/**
 * Promotional codes configuration
 * Format: {
 *   "CODE": {
 *     type: "percentage" | "fixed",
 *     value: number, // percentage (0.1 = 10%) or fixed amount
 *     currencyCode: "USD", // only for fixed type
 *     durationLimitInIntervals: number | null, // null = indefinite
 *     validForIntervals: ["EVERY_30_DAYS", "ANNUAL"] | null, // null = all intervals
 *     active: boolean,
 *     description: string
 *   }
 * }
 */
export const PROMO_CODES = {
  "WELCOME10": {
    type: "percentage",
    value: 0.1, // 10% off
    durationLimitInIntervals: 3, // First 3 billing cycles
    validForIntervals: null, // Valid for all intervals
    active: true,
    description: "10% off for first 3 months"
  },
  "SAVE20": {
    type: "percentage",
    value: 0.2, // 20% off
    durationLimitInIntervals: null, // Indefinite
    validForIntervals: ["ANNUAL"], // Only for annual plans
    active: true,
    description: "20% off annual plans"
  },
  "FLAT5": {
    type: "fixed",
    value: 5.0, // $5 off
    currencyCode: "USD",
    durationLimitInIntervals: 1, // First billing cycle only
    validForIntervals: null, // Valid for all intervals
    active: true,
    description: "$5 off first month"
  }
};

/**
 * Validate and get promotional code
 * @param {string} code - Promotional code
 * @param {string} interval - Plan interval (EVERY_30_DAYS or ANNUAL)
 * @returns {Object|null} Promo code config or null if invalid
 */
export const validatePromoCode = (code, interval) => {
  if (!code) return null;
  
  const promoCode = PROMO_CODES[code.toUpperCase()];
  if (!promoCode || !promoCode.active) return null;
  
  // Check if valid for this interval
  if (promoCode.validForIntervals && !promoCode.validForIntervals.includes(interval)) {
    return null;
  }
  
  return promoCode;
};

/**
 * Calculate discounted price
 * @param {number} originalPrice - Original plan price
 * @param {string} currencyCode - Currency code
 * @param {Object} promoCode - Promo code config from validatePromoCode
 * @returns {Object} { discountedPrice, discountValue, discountType }
 */
export const calculateDiscount = (originalPrice, currencyCode, promoCode) => {
  if (!promoCode) {
    return {
      discountedPrice: originalPrice,
      discountValue: null,
      discountType: null
    };
  }
  
  if (promoCode.type === "percentage") {
    const discountAmount = originalPrice * promoCode.value;
    const discountedPrice = originalPrice - discountAmount;
    return {
      discountedPrice: Math.max(0, discountedPrice), // Ensure non-negative
      discountValue: promoCode.value, // percentage as decimal
      discountType: "percentage"
    };
  } else if (promoCode.type === "fixed") {
    const discountedPrice = originalPrice - promoCode.value;
    return {
      discountedPrice: Math.max(0, discountedPrice), // Ensure non-negative
      discountValue: promoCode.value, // fixed amount
      discountType: "fixed"
    };
  }
  
  return {
    discountedPrice: originalPrice,
    discountValue: null,
    discountType: null
  };
};
```

### Phase 2: Backend API Endpoints (`server/index.js`)

#### 2.1 Add Promo Code Validation Endpoint
```javascript
/**
 * POST /api/billing/validate-promo
 * Validates a promotional code and returns discount information
 */
app.post("/api/billing/validate-promo", verifySessionToken, async (req, res) => {
  const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    const { code, planHandle } = req.body || {};
    
    if (!code || !planHandle) {
      return res.status(400).json({
        error: "Missing required parameters",
        message: "Both code and planHandle are required.",
        requestId,
      });
    }
    
    const planConfig = billing.getPlan ? billing.getPlan(planHandle) : null;
    if (!planConfig) {
      return res.status(400).json({
        error: "Invalid plan handle",
        message: "Provide a valid planHandle.",
        requestId,
      });
    }
    
    const promoCode = billing.validatePromoCode 
      ? billing.validatePromoCode(code, planConfig.interval)
      : null;
    
    if (!promoCode) {
      return res.status(200).json({
        valid: false,
        message: "Code promotionnel invalide ou expiré",
        requestId,
      });
    }
    
    const discount = billing.calculateDiscount
      ? billing.calculateDiscount(planConfig.price, planConfig.currencyCode, promoCode)
      : null;
    
    return res.status(200).json({
      valid: true,
      code: code.toUpperCase(),
      discount: {
        type: promoCode.type,
        value: discount.discountValue,
        durationLimitInIntervals: promoCode.durationLimitInIntervals,
        description: promoCode.description,
      },
      pricing: {
        original: planConfig.price,
        discounted: discount.discountedPrice,
        savings: planConfig.price - discount.discountedPrice,
      },
      requestId,
    });
  } catch (error) {
    logger.error("[API] [VALIDATE-PROMO] Unexpected error", error, req, { requestId });
    return res.status(500).json({
      error: "Internal server error",
      message: error.message || "An unexpected error occurred",
      requestId,
    });
  }
});
```

#### 2.2 Modify `createAppSubscription` Function
Update the function to accept and apply promotional code discount:

```javascript
const createAppSubscription = async (
  shopDomain,
  planHandle,
  encodedSessionToken,
  promoCode = null // NEW: Optional promo code
) => {
  // ... existing validation code ...
  
  // Validate promo code if provided
  let discountConfig = null;
  if (promoCode) {
    const validatedPromo = billing.validatePromoCode 
      ? billing.validatePromoCode(promoCode, planConfig.interval)
      : null;
    
    if (validatedPromo) {
      discountConfig = {
        value: validatedPromo.type === "percentage"
          ? { percentage: validatedPromo.value }
          : { amount: validatedPromo.value },
        durationLimitInIntervals: validatedPromo.durationLimitInIntervals || null,
      };
    }
  }
  
  // ... existing mutation setup ...
  
  const lineItems = [
    {
      plan: {
        appRecurringPricingDetails: {
          interval: planConfig.interval,
          price: {
            amount: planConfig.price,
            currencyCode: planConfig.currencyCode,
          },
          // NEW: Add discount if promo code is valid
          ...(discountConfig ? { discount: discountConfig } : {}),
        },
      },
    },
  ];
  
  // ... rest of the function ...
};
```

#### 2.3 Update `/api/billing/subscribe` Endpoint
```javascript
app.post("/api/billing/subscribe", verifySessionToken, async (req, res) => {
  // ... existing code ...
  
  const { shop, planHandle, promoCode } = req.body || {}; // NEW: Add promoCode
  
  // ... existing validation ...
  
  const result = await createAppSubscription(
    shopDomain,
    planHandle,
    req.sessionToken,
    promoCode // NEW: Pass promo code
  );
  
  // ... rest of the function ...
});
```

### Phase 3: Frontend UI (`src/components/PlanSelection.tsx`)

#### 3.1 Add Promo Code Input Section
Add before the CTA button:

```typescript
// Add state
const [promoCode, setPromoCode] = useState<string>("");
const [appliedPromo, setAppliedPromo] = useState<{
  code: string;
  discount: any;
  pricing: any;
} | null>(null);
const [validatingPromo, setValidatingPromo] = useState<boolean>(false);
const [promoError, setPromoError] = useState<string | null>(null);

// Add validation function
const handleValidatePromo = async () => {
  if (!promoCode.trim() || !currentPlan) return;
  
  setValidatingPromo(true);
  setPromoError(null);
  
  try {
    const response = await authenticatedFetch("/api/billing/validate-promo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: promoCode.trim(),
        planHandle: currentPlan.handle,
      }),
    });
    
    const data = await response.json();
    
    if (data.valid) {
      setAppliedPromo({
        code: data.code,
        discount: data.discount,
        pricing: data.pricing,
      });
      setPromoError(null);
    } else {
      setAppliedPromo(null);
      setPromoError(data.message || "Code promotionnel invalide");
    }
  } catch (error) {
    setAppliedPromo(null);
    setPromoError("Erreur lors de la validation du code");
  } finally {
    setValidatingPromo(false);
  }
};

// Add UI component before CTA button
<div className="border-t border-border pt-4">
  <div className="space-y-2">
    <label className="text-sm font-medium text-foreground">
      Code promotionnel (optionnel)
    </label>
    <div className="flex gap-2">
      <input
        type="text"
        value={promoCode}
        onChange={(e) => {
          setPromoCode(e.target.value.toUpperCase());
          setAppliedPromo(null);
          setPromoError(null);
        }}
        placeholder="Entrez votre code"
        className="flex-1 px-3 py-2 text-sm border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        disabled={validatingPromo}
      />
      <Button
        onClick={handleValidatePromo}
        disabled={validatingPromo || !promoCode.trim()}
        variant="outline"
        size="sm"
        className="whitespace-nowrap"
      >
        {validatingPromo ? "..." : "Appliquer"}
      </Button>
    </div>
    
    {/* Show applied promo */}
    {appliedPromo && (
      <div className="p-2 bg-success/10 border border-success/30 rounded text-xs text-success">
        ✓ Code {appliedPromo.code} appliqué: {appliedPromo.discount.type === "percentage" 
          ? `${(appliedPromo.discount.value * 100).toFixed(0)}% de réduction`
          : `$${appliedPromo.discount.value} de réduction`}
        {appliedPromo.discount.durationLimitInIntervals && 
          ` (${appliedPromo.discount.durationLimitInIntervals} cycles)`}
      </div>
    )}
    
    {/* Show error */}
    {promoError && (
      <div className="p-2 bg-destructive/10 border border-destructive/30 rounded text-xs text-destructive">
        {promoError}
      </div>
    )}
    
    {/* Show pricing with discount */}
    {appliedPromo && (
      <div className="pt-2 space-y-1 text-xs">
        <div className="flex justify-between text-muted-foreground">
          <span>Prix original:</span>
          <span>${appliedPromo.pricing.original.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-success font-semibold">
          <span>Économie:</span>
          <span>-${appliedPromo.pricing.savings.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-foreground font-bold border-t border-border pt-1">
          <span>Prix final:</span>
          <span>${appliedPromo.pricing.discounted.toFixed(2)}</span>
        </div>
      </div>
    )}
  </div>
</div>
```

#### 3.2 Update `handleSelectPlan` to Pass Promo Code
```typescript
const handleSelectPlan = () => {
  if (currentPlan) {
    onSelectPlan(currentPlan.handle, appliedPromo?.code || null); // Pass promo code
  }
};
```

#### 3.3 Update Props Interface
```typescript
interface PlanSelectionProps {
  plans: Plan[];
  onSelectPlan: (planHandle: string, promoCode?: string | null) => void; // Add promoCode param
  loading?: boolean;
}
```

### Phase 4: Frontend Integration (`src/pages/Index.tsx`)

#### 4.1 Update `handleSelectPlan` Function
```typescript
const handleSelectPlan = async (planHandle: string, promoCode?: string | null) => {
  setBillingLoading(true);
  
  try {
    const response = await authenticatedFetch("/api/billing/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        shop: shopDomain,
        planHandle,
        promoCode: promoCode || null, // NEW: Pass promo code
      }),
    });
    
    // ... existing response handling ...
  } catch (error) {
    // ... existing error handling ...
  } finally {
    setBillingLoading(false);
  }
};
```

#### 4.2 Update `PlanSelection` Component Call
```typescript
<PlanSelection
  plans={availablePlans}
  onSelectPlan={handleSelectPlan} // Already compatible
  loading={billingLoading}
/>
```

## Implementation Checklist

### Backend
- [ ] Add `PROMO_CODES` configuration to `server/utils/billing.js`
- [ ] Add `validatePromoCode` function to `server/utils/billing.js`
- [ ] Add `calculateDiscount` function to `server/utils/billing.js`
- [ ] Export new functions from `server/utils/billing.js`
- [ ] Add `POST /api/billing/validate-promo` endpoint
- [ ] Modify `createAppSubscription` to accept and apply promo code
- [ ] Update `POST /api/billing/subscribe` to accept promo code parameter

### Frontend
- [ ] Add promo code input UI to `PlanSelection.tsx`
- [ ] Add promo code validation state management
- [ ] Add `handleValidatePromo` function
- [ ] Add discount display UI (applied promo, pricing breakdown)
- [ ] Update `handleSelectPlan` to pass promo code
- [ ] Update `PlanSelection` props interface
- [ ] Update `Index.tsx` `handleSelectPlan` to accept and pass promo code

### Testing
- [ ] Test promo code validation with valid codes
- [ ] Test promo code validation with invalid codes
- [ ] Test percentage discounts
- [ ] Test fixed amount discounts
- [ ] Test interval-specific codes (monthly vs annual)
- [ ] Test duration limits (limited vs indefinite)
- [ ] Test subscription creation with promo codes
- [ ] Test subscription creation without promo codes
- [ ] Verify discount appears correctly in Shopify admin

## Example Promo Code Configurations

```javascript
// 10% off first 3 months (all plans)
"WELCOME10": {
  type: "percentage",
  value: 0.1,
  durationLimitInIntervals: 3,
  validForIntervals: null,
  active: true,
  description: "10% off for first 3 months"
}

// 20% off annual plans (indefinite)
"ANNUAL20": {
  type: "percentage",
  value: 0.2,
  durationLimitInIntervals: null,
  validForIntervals: ["ANNUAL"],
  active: true,
  description: "20% off annual plans forever"
}

// $5 off first month (all plans)
"FIRST5": {
  type: "fixed",
  value: 5.0,
  currencyCode: "USD",
  durationLimitInIntervals: 1,
  validForIntervals: null,
  active: true,
  description: "$5 off first month"
}
```

## Notes

1. **No Database Required**: All promo codes are hardcoded in `billing.js` configuration
2. **Easy Management**: To add/remove codes, simply update the `PROMO_CODES` object
3. **Case Insensitive**: Code validation converts to uppercase for matching
4. **Interval Validation**: Codes can be restricted to specific billing intervals
5. **Duration Limits**: Discounts can apply for limited cycles or indefinitely
6. **Real-time Validation**: Codes are validated before subscription creation
7. **Visual Feedback**: Users see discount amount and final price before subscribing

## Future Enhancements (Optional)

1. **Usage Tracking**: Track code usage (would require database)
2. **Expiration Dates**: Add `expiresAt` field to promo codes
3. **Usage Limits**: Add `maxUses` field to limit code usage
4. **Shop-specific Codes**: Allow different codes per shop
5. **Admin UI**: Build admin interface to manage codes (would require database)

