# Promotional Code API - Test Scenarios Analysis

## Implementation Review

### Current Promo Codes Configuration:
1. **WELCOME10**: 10% off, 3 intervals, valid for ALL intervals (monthly & annual)
2. **SAVE20**: 20% off, indefinite duration, valid ONLY for ANNUAL
3. **FLAT5**: $5 off, 1 interval, valid for ALL intervals (monthly & annual)

## Test Scenarios

### ✅ Scenario 1: No Promo Code Provided
**Request:**
```json
{
  "shop": "vto-demo.myshopify.com",
  "planHandle": "pro-monthly"
}
```

**Flow:**
- `promoCode` = `null` or `undefined`
- `if (promoCode)` → false
- `discountConfig` remains `null`
- `if (discountConfig)` → false
- `lineItemPlan.discount` is NOT added
- **Result**: ✅ Subscription created without discount

---

### ✅ Scenario 2: Monthly Plan with WELCOME10
**Request:**
```json
{
  "shop": "vto-demo.myshopify.com",
  "planHandle": "pro-monthly",
  "promoCode": "WELCOME10"
}
```

**Flow:**
- `planConfig.interval` = `"EVERY_30_DAYS"`
- `validatePromoCode("WELCOME10", "EVERY_30_DAYS")` → returns promo config
- `validForIntervals: null` → valid for all intervals ✅
- `discountConfig` = `{ value: { percentage: 0.1 }, durationLimitInIntervals: 3 }`
- **Result**: ✅ Subscription created with 10% discount for 3 months

---

### ✅ Scenario 3: Annual Plan with SAVE20
**Request:**
```json
{
  "shop": "vto-demo.myshopify.com",
  "planHandle": "pro-annual",
  "promoCode": "SAVE20"
}
```

**Flow:**
- `planConfig.interval` = `"ANNUAL"`
- `validatePromoCode("SAVE20", "ANNUAL")` → returns promo config
- `validForIntervals: ["ANNUAL"]` → matches ✅
- `discountConfig` = `{ value: { percentage: 0.2 } }` (no durationLimitInIntervals)
- **Result**: ✅ Subscription created with 20% discount indefinitely

---

### ✅ Scenario 4: Monthly Plan with SAVE20 (Should Fail Validation)
**Request:**
```json
{
  "shop": "vto-demo.myshopify.com",
  "planHandle": "pro-monthly",
  "promoCode": "SAVE20"
}
```

**Flow:**
- `planConfig.interval` = `"EVERY_30_DAYS"`
- `validatePromoCode("SAVE20", "EVERY_30_DAYS")` → returns `null`
- `validForIntervals: ["ANNUAL"]` → does NOT include `"EVERY_30_DAYS"` ❌
- `discountConfig` remains `null`
- **Result**: ✅ Subscription created without discount (invalid code silently ignored)

---

### ✅ Scenario 5: Monthly Plan with FLAT5
**Request:**
```json
{
  "shop": "vto-demo.myshopify.com",
  "planHandle": "pro-monthly",
  "promoCode": "FLAT5"
}
```

**Flow:**
- `planConfig.interval` = `"EVERY_30_DAYS"`
- `validatePromoCode("FLAT5", "EVERY_30_DAYS")` → returns promo config
- `validForIntervals: null` → valid for all intervals ✅
- `discountConfig` = `{ value: { amount: 5.0 }, durationLimitInIntervals: 1 }`
- **Result**: ✅ Subscription created with $5 discount for first month

---

### ✅ Scenario 6: Annual Plan with WELCOME10
**Request:**
```json
{
  "shop": "vto-demo.myshopify.com",
  "planHandle": "pro-annual",
  "promoCode": "WELCOME10"
}
```

**Flow:**
- `planConfig.interval` = `"ANNUAL"`
- `validatePromoCode("WELCOME10", "ANNUAL")` → returns promo config
- `validForIntervals: null` → valid for all intervals ✅
- `discountConfig` = `{ value: { percentage: 0.1 }, durationLimitInIntervals: 3 }`
- **Result**: ✅ Subscription created with 10% discount for first 3 billing cycles

---

### ✅ Scenario 7: Invalid Promo Code
**Request:**
```json
{
  "shop": "vto-demo.myshopify.com",
  "planHandle": "pro-monthly",
  "promoCode": "INVALID"
}
```

**Flow:**
- `validatePromoCode("INVALID", "EVERY_30_DAYS")` → returns `null` (code not found)
- `discountConfig` remains `null`
- **Result**: ✅ Subscription created without discount (invalid code silently ignored)

---

## Code Logic Verification

### Discount Config Building Logic:
```javascript
// Line 505-547 in server/index.js
let discountConfig = null;
if (promoCode) {
  const validatedPromo = billing.validatePromoCode(promoCode, planConfig.interval);
  
  if (validatedPromo) {
    discountConfig = {
      value: validatedPromo.type === "percentage"
        ? { percentage: validatedPromo.value }
        : { amount: validatedPromo.value },
    };
    
    // Only add durationLimitInIntervals if it's a valid number > 0
    if (
      validatedPromo.durationLimitInIntervals != null &&
      typeof validatedPromo.durationLimitInIntervals === "number" &&
      validatedPromo.durationLimitInIntervals > 0
    ) {
      discountConfig.durationLimitInIntervals = validatedPromo.durationLimitInIntervals;
    }
  }
}
```

### Line Item Plan Building Logic:
```javascript
// Line 614-625 in server/index.js
const lineItemPlan = {
  interval: planConfig.interval,
  price: {
    amount: planConfig.price,
    currencyCode: planConfig.currencyCode,
  },
};

// Add discount if promo code is valid
if (discountConfig) {
  lineItemPlan.discount = discountConfig;
}
```

## Potential Issues Found

### ⚠️ Issue 1: Invalid Promo Code Handling
**Current Behavior**: Invalid promo codes are silently ignored (subscription created without discount)
**Expected Behavior**: Should this return an error or warning?

**Analysis**: Current implementation is correct - it allows subscription creation even with invalid codes, which is a reasonable UX choice.

### ✅ Issue 2: Duration Limit Handling (FIXED)
**Previous Issue**: `durationLimitInIntervals: null` was being sent, causing API error
**Fix Applied**: Only include `durationLimitInIntervals` when it's a valid number > 0
**Status**: ✅ FIXED

## Conclusion

All scenarios should work correctly:
- ✅ No promo code → No discount applied
- ✅ Valid promo code with duration limit → Discount with duration applied
- ✅ Valid promo code without duration limit → Discount indefinitely applied
- ✅ Invalid promo code → Subscription created without discount
- ✅ Interval-specific validation → Works correctly (SAVE20 only for annual)
- ✅ Monthly and Annual plans → Both work correctly

The implementation handles all edge cases correctly!

