# Pricing Documentation

Complete information about subscription plans, free credits, trial periods, credit deduction priority, and all pricing details.

---

## Table of Contents

1. [Subscription Plans](#subscription-plans)
2. [Free Trial Details](#free-trial-details)
3. [Free Credits](#free-credits)
4. [Credit Deduction Priority](#credit-deduction-priority)
5. [Overage Billing](#overage-billing)
6. [Credit Packages](#credit-packages)
7. [Coupon Codes](#coupon-codes)
8. [Credit Expiration Policy](#credit-expiration-policy)
9. [Billing Intervals](#billing-intervals)

---

## Subscription Plans

### Monthly Plan (pro-monthly)

- **Plan Name**: Plan Standard
- **Plan Handle**: `pro-monthly`
- **Price**: $23.00 USD per month
- **Billing Interval**: Every 30 days (`EVERY_30_DAYS`)
- **Trial Days**: 30 days
- **Included Credits**: 100 credits per billing period
- **Description**: "100 crédits inclus avec possibilité de recharge après dépassement."
- **Features**:
  - 100 credits included per month
  - 1 usage = 1 credit
  - Recharge possible after exceeding included credits

### Annual Plan (pro-annual)

- **Plan Name**: Plan Standard
- **Plan Handle**: `pro-annual`
- **Price**: $180.00 USD per year
- **Monthly Equivalent**: $20.00 USD per month (savings of $3/month or $36/year)
- **Billing Interval**: Annual (`ANNUAL`)
- **Trial Days**: 30 days
- **Included Credits**: 100 credits per month (reset monthly, not annually)
- **Description**: "100 crédits inclus avec possibilité de recharge après dépassement."
- **Features**:
  - 100 credits included per month
  - 1 usage = 1 credit
  - Recharge possible after exceeding included credits
- **Note**: Credits reset monthly for annual subscriptions (not at the end of the year)

---

## Free Trial Details

### Trial Period

- **Duration**: 30 days
- **Trial Credits**: 100 free credits (separate from plan credits)
- **Trial Start**: Automatically starts when subscription is created
- **Trial End Conditions**: Trial ends when **either** condition is met:
  1. **30 days pass** from trial start date
  2. **100 trial credits are exhausted**

### Trial Credits Behavior

- **Never Expire**: Trial credits **NEVER EXPIRE** and carry forward indefinitely
- **Usable After Trial**: Trial credits remain usable even after the trial period ends
- **Separate from Plan Credits**: Trial credits are tracked separately from plan credits
- **Priority**: Trial credits are used first (Priority 1) when deducting credits

### Trial Period Transition

- When trial ends, the subscription is automatically replaced with a paid version
- **100 plan credits are added** to the existing balance (credits carry forward, never expire)
- Trial credits are preserved and remain usable after trial ends
- No credits are lost during the transition

---

## Free Credits

### Included Credits

Both monthly and annual plans include:
- **100 credits** per billing period
- Credits are added at the start of each billing period
- Credits **never expire** and carry forward to the next period

### Credit Types

The system tracks credits by type:

1. **Trial Credits** (`trial_credits_balance`)
   - 100 free credits during trial period
   - Never expire, carry forward indefinitely
   - Used first (Priority 1)

2. **Plan Credits** (`plan_credits_balance`)
   - Credits included with subscription (100 per period)
   - Added at the start of each billing period
   - Never expire, carry forward

3. **Coupon Credits** (`coupon_credits_balance`)
   - Promotional credits from coupon redemptions
   - Used after trial credits (Priority 2)

4. **Purchased Credits** (`purchased_credits_balance`)
   - Credits purchased from credit packages
   - Used last (Priority 4)

### Credit Carry Forward Policy

- **All credits never expire** and carry forward to the next billing period
- When a new billing period starts, new plan credits are **added** to the existing balance
- Credits are not reset or lost at period end
- This applies to all credit types: trial, plan, coupon, and purchased credits

---

## Credit Deduction Priority

When a try-on is generated, credits are deducted in the following priority order:

### Priority Order

1. **Priority 1: Trial Credits** (`trial_credits`)
   - Deducted first if available
   - Never expire, can be used anytime (even after trial ends)
   - Separate from plan credits
   - **Note**: If in trial period and trial should end, deduction may be blocked to trigger subscription replacement

2. **Priority 2: Coupon Credits** (`coupon_credits`)
   - Promotional credits from coupon redemptions
   - Used after trial credits are exhausted
   - Example: WELCOME50 coupon adds 50 coupon credits

3. **Priority 3: Plan Credits** (`plan_credits`)
   - Included credits from subscription plan
   - 100 credits per billing period
   - Used after trial and coupon credits

4. **Priority 4: Purchased Credits** (`purchased_credits`)
   - Credits purchased from credit packages
   - Used last, after all other credit types

### Overage Handling

When all credit types are exhausted (balance = 0):

- **Monthly Plans**: Uses Shopify usage records for overage billing
  - $0.15 per credit
  - Capped at $50 per billing period
  - Billed automatically via usage records

- **Annual Plans**: Tracks overage usage
  - $0.15 per credit
  - Capped at $50 per month
  - Billed via one-time charge at month end

---

## Overage Billing

### Overage Pricing

- **Price per Credit**: $0.15 USD
- **Capped Amount**: $50.00 USD per billing period
- **Terms**: "$0.15 per try-on after included 100 credits"

### Overage Billing Methods

#### Monthly Plans
- Uses Shopify **usage records** for overage billing
- Automatically billed when credits are used
- Capped at $50 per 30-day billing period
- If capped amount is exceeded, generation is blocked until next period

#### Annual Plans
- Overage usage is **tracked** during the month
- Billed via **one-time charge** at month end
- Capped at $50 per month
- Monthly period resets on the first day of each month

### Capped Amount Exceeded

If the capped amount ($50) is exceeded:
- Try-on generation is blocked
- Error message: "Credit limit exceeded. Please increase your capped amount or wait for next billing period."
- User must wait for the next billing period or purchase additional credits

---

## Credit Packages

Additional credits can be purchased in packages:

### Small Package
- **Name**: 50 Credits
- **ID**: `small`
- **Credits**: 50
- **Price**: $7.50 USD
- **Price per Credit**: $0.15
- **Recommended**: No
- **Description**: "Perfect for testing"

### Medium Package (Recommended)
- **Name**: 100 Credits
- **ID**: `medium`
- **Credits**: 100
- **Price**: $15.00 USD
- **Price per Credit**: $0.15
- **Recommended**: Yes
- **Description**: "Best value"

### Large Package
- **Name**: 200 Credits
- **ID**: `large`
- **Credits**: 200
- **Price**: $30.00 USD
- **Price per Credit**: $0.15
- **Recommended**: No
- **Description**: "For high-volume users"

### Credit Package Notes

- All packages have the same price per credit: **$0.15**
- Purchased credits are added to `purchased_credits_balance`
- Purchased credits never expire and carry forward
- Used last in the deduction priority (Priority 4)

---

## Coupon Codes

### Available Coupon Codes

#### WELCOME50

- **Code**: `WELCOME50`
- **Type**: Fixed credits (not percentage discount)
- **Credits**: 50 free credits
- **Usage Limit**: 
  - Per shop: 1 redemption
  - Global: Unlimited
- **Expiration**: None (works indefinitely)
- **Active**: Yes
- **Description**: "Welcome bonus - 50 free credits in addition to plan credits"
- **Works For**: Both monthly and annual plans
- **Note**: Adds credits in addition to plan credits, not a subscription discount

### Coupon Redemption

- Coupon credits are added to `coupon_credits_balance`
- Coupon credits never expire and carry forward
- Used in Priority 2 (after trial credits, before plan credits)
- Redemption history is tracked in metafields

---

## Credit Expiration Policy

### Key Policy: Credits Never Expire

**All credits never expire and carry forward indefinitely.**

This applies to:
- ✅ Trial credits
- ✅ Plan credits (included credits)
- ✅ Coupon credits
- ✅ Purchased credits

### Credit Reset Behavior

- **Credits are NOT reset** at the end of billing periods
- New plan credits are **added** to the existing balance
- All credit types carry forward to the next period
- Example: If you have 50 credits remaining and a new period starts, you'll have 150 credits (50 + 100 new)

### Period Renewal

- **Monthly Plans**: Credits reset/add every 30 days
- **Annual Plans**: Credits reset/add monthly (first day of each month), not annually
- Credits are added at the start of each period, not replaced

---

## Billing Intervals

### Monthly Billing (`EVERY_30_DAYS`)

- **Billing Cycle**: Every 30 days
- **Credit Reset**: Monthly (adds 100 credits)
- **Overage Billing**: Via usage records (real-time)
- **Period End**: Stored in `current_period_end` metafield

### Annual Billing (`ANNUAL`)

- **Billing Cycle**: Once per year ($180/year)
- **Credit Reset**: Monthly (adds 100 credits each month)
- **Overage Billing**: Tracked monthly, billed at month end via one-time charge
- **Period End**: Stored in `monthly_period_end` metafield (resets monthly)

### Important Notes

- Annual subscriptions receive credits **monthly**, not annually
- Annual subscriptions have monthly credit resets
- Overage is tracked and billed monthly for annual plans
- The annual price is paid upfront, but credits are distributed monthly

---

## Summary

### Quick Reference

| Feature | Monthly Plan | Annual Plan |
|---------|-------------|-------------|
| **Price** | $23/month | $180/year ($20/month) |
| **Trial Days** | 30 days | 30 days |
| **Trial Credits** | 100 credits | 100 credits |
| **Included Credits** | 100/month | 100/month |
| **Credit Reset** | Every 30 days | Monthly (first of month) |
| **Overage Price** | $0.15/credit | $0.15/credit |
| **Overage Cap** | $50/period | $50/month |
| **Overage Billing** | Usage records | One-time charge (month end) |

### Credit Deduction Priority (Order)

1. **Trial Credits** (never expire, carry forward)
2. **Coupon Credits** (promotional credits)
3. **Plan Credits** (included credits)
4. **Purchased Credits** (from packages)
5. **Overage Billing** (if all credits exhausted)

### Key Policies

- ✅ All credits never expire
- ✅ Credits carry forward to next period
- ✅ New credits are added, not replacing existing balance
- ✅ Trial credits remain usable after trial ends
- ✅ Overage billing: $0.15/credit, capped at $50/period

---

## Additional Notes

### Credit Refunds

- If try-on generation fails, credits are automatically refunded
- Refunds restore credits to the same type they were deducted from
- Usage records cannot be refunded automatically (manual processing required)

### Credit Initialization

- Credits are automatically initialized when:
  - Subscription is created (trial credits: 100)
  - Trial period ends (plan credits: 100 added)
  - New billing period starts (plan credits: 100 added)
  - Coupon is redeemed (coupon credits added)
  - Credit package is purchased (purchased credits added)

### Credit Tracking

All credits are tracked via Shopify metafields:
- `credit_balance`: Total balance (sum of all types)
- `trial_credits_balance`: Trial credits
- `plan_credits_balance`: Plan credits
- `purchased_credits_balance`: Purchased credits
- `coupon_credits_balance`: Coupon credits
- `credits_used_this_period`: Usage counter
- `credits_included`: Included credits per period

---

*Last Updated: Based on codebase analysis*
*Document Version: 1.0*

