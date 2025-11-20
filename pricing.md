# Pricing Plans, Subscription & Payment Integration Plan

## Executive Summary

This document outlines a comprehensive plan for implementing pricing plans, subscription management, and payment integration for the NUSENSE TryON Shopify app. The implementation leverages Shopify's native Billing API for seamless subscription management and payment processing.

---

## 1. Current Implementation Analysis

### 1.1 Existing Backend Implementation

**Location:** `server/utils/billing.js`

**Current Features:**
- ✅ Basic subscription creation using `appSubscriptionCreate` mutation
- ✅ Subscription status checking via `currentAppInstallation` query
- ✅ Plan configuration (Free, Pro - Monthly & Annual)
- ✅ Plan validation and matching logic
- ✅ Error handling and logging

**Current Plans:**
```javascript
- FREE: $0/month (basic features)
- PRO: $20/month (monthly billing)
- PRO_ANNUAL: $180/year ($15/month equivalent - annual billing)
```

**API Endpoints:**
- `GET /api/billing/subscription` - Check subscription status
- `POST /api/billing/subscribe` - Create new subscription
- `GET /api/billing/plans` - Get available plans

### 1.2 Missing Components

**Backend:**
- ❌ Webhook handler for `APP_SUBSCRIPTIONS_UPDATE`
- ❌ Subscription cancellation functionality
- ❌ Plan upgrade/downgrade handling
- ❌ Trial period management
- ❌ Usage-based billing (if needed)
- ❌ Subscription renewal tracking
- ❌ Proration handling

**Frontend:**
- ❌ Pricing page/component
- ❌ Subscription management UI
- ❌ Plan comparison view
- ❌ Billing history
- ❌ Payment confirmation flow
- ❌ Subscription status indicator

**Configuration:**
- ❌ Webhook registration in `shopify.app.toml`
- ❌ Plan handles in Shopify Partners Dashboard

---

## 2. Pricing Strategy

### 2.1 Recommended Pricing Plans

Based on Shopify best practices and the app's value proposition:

| Plan | Price | Billing Interval | Features | Target Audience |
|------|-------|------------------|----------|-----------------|
| **Free** | $0 | N/A | • Basic try-on widget<br>• 10 try-ons/month<br>• Standard processing time<br>• Community support | Small stores testing the feature |
| **Pro** | $20/month<br>or<br>$15/month* | Every 30 days<br>or<br>Every 365 days | • Unlimited try-ons<br>• Priority processing<br>• API access<br>• Custom branding<br>• Priority support<br>• Advanced analytics | Growing stores |

*Annual billing: $15/month billed annually ($180/year) - Save 25% compared to monthly billing

### 2.2 Feature Gating Strategy

**Free Plan Limits:**
- Maximum 10 try-on generations per month
- Standard processing queue (slower)
- Basic widget (no customization)
- Watermark on results (optional)

**Pro Plan:**
- Unlimited try-ons
- Priority processing queue
- Customizable widget colors
- No watermark
- API access for custom integrations
- Advanced analytics dashboard
- Custom domain support
- Priority support
- Monthly: $20/month
- Annual: $15/month (billed $180/year) - Save 25%

### 2.3 Usage-Based Add-Ons (Optional)

Available as separate charges for Pro plan:
- Additional API calls: $0.10 per 100 calls
- Custom model training: $500 one-time
- Priority processing: $0.05 per generation

---

## 3. Technical Implementation Plan

### 3.1 Backend Enhancements

#### 3.1.1 Update Plan Configuration

**File:** `server/utils/billing.js`

**Changes:**
```javascript
export const PLAN_HANDLES = {
  FREE: "free",
  PRO: "pro",
  PRO_ANNUAL: "pro_annual",
};

export const PLANS = {
  [PLAN_HANDLES.FREE]: {
    name: "Free Plan",
    handle: PLAN_HANDLES.FREE,
    price: 0,
    currencyCode: "USD",
    interval: "EVERY_30_DAYS",
    description: "Free plan with basic features",
    features: [
      "10 try-ons per month",
      "Standard processing",
      "Basic widget",
      "Community support"
    ],
    limits: {
      monthlyTryOns: 10,
      processingPriority: "standard"
    }
  },
  [PLAN_HANDLES.PRO]: {
    name: "Pro Plan (Monthly)",
    handle: PLAN_HANDLES.PRO,
    price: 20.00,
    currencyCode: "USD",
    interval: "EVERY_30_DAYS",
    description: "For serious e-commerce stores",
    features: [
      "Unlimited try-ons",
      "Priority processing",
      "Customizable widget",
      "API access",
      "Custom branding",
      "Priority support",
      "Advanced analytics"
    ]
  },
  [PLAN_HANDLES.PRO_ANNUAL]: {
    name: "Pro Plan (Annual)",
    handle: PLAN_HANDLES.PRO_ANNUAL,
    price: 180.00, // $15/month × 12 months
    currencyCode: "USD",
    interval: "ANNUAL",
    description: "For serious e-commerce stores - Save 25% with annual billing",
    monthlyEquivalent: 15.00, // For display purposes
    features: [
      "Unlimited try-ons",
      "Priority processing",
      "Customizable widget",
      "API access",
      "Custom branding",
      "Priority support",
      "Advanced analytics",
      "Save 25% compared to monthly billing"
    ]
  }
};
```

#### 3.1.2 Add Subscription Cancellation

**New Function:**
```javascript
/**
 * Cancel an active subscription
 * @param {Object} shopify - Shopify API instance
 * @param {Object} session - Shopify session object
 * @param {boolean} prorate - Whether to issue prorated credits
 * @returns {Promise<Object>} Cancellation result
 */
export const cancelSubscription = async (
  shopify,
  session,
  prorate = false
) => {
  try {
    // First, get current subscription
    const subscriptionStatus = await checkSubscription(shopify, session);
    
    if (!subscriptionStatus.hasActiveSubscription) {
      throw new Error("No active subscription to cancel");
    }

    const subscriptionId = subscriptionStatus.subscription.id;

    // GraphQL mutation for canceling subscription
    const mutation = `
      mutation appSubscriptionCancel($id: ID!, $prorate: Boolean!) {
        appSubscriptionCancel(id: $id, prorate: $prorate) {
          appSubscription {
            id
            status
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const client = new shopify.clients.Graphql({ session });
    const response = await client.query({
      data: {
        query: mutation,
        variables: {
          id: subscriptionId,
          prorate: prorate,
        },
      },
    });

    const responseData = response.body?.data || response.data;

    if (responseData?.appSubscriptionCancel?.userErrors?.length > 0) {
      const errors = responseData.appSubscriptionCancel.userErrors;
      throw new Error(
        `Subscription cancellation failed: ${errors
          .map((e) => e.message)
          .join(", ")}`
      );
    }

    logger.info("[BILLING] Subscription cancelled successfully", {
      shop: session.shop,
      subscriptionId,
      prorate,
    });

    return {
      success: true,
      subscription: responseData?.appSubscriptionCancel?.appSubscription,
    };
  } catch (error) {
    logger.error("[BILLING] Failed to cancel subscription", error, null, {
      shop: session?.shop,
    });
    throw error;
  }
};
```

#### 3.1.3 Add Plan Upgrade/Downgrade

**New Function:**
```javascript
/**
 * Change subscription plan (upgrade or downgrade)
 * @param {Object} shopify - Shopify API instance
 * @param {Object} session - Shopify session object
 * @param {string} newPlanHandle - New plan handle
 * @param {string} returnUrl - URL to redirect after approval
 * @param {string} replacementBehavior - How to handle existing subscription
 *   Valid values: "STANDARD" (default), "APPLY_IMMEDIATELY", "APPLY_ON_NEXT_BILLING_CYCLE"
 * @returns {Promise<Object>} New subscription creation result
 */
export const changePlan = async (
  shopify,
  session,
  newPlanHandle,
  returnUrl,
  replacementBehavior = "STANDARD"
) => {
  try {
    // Check if merchant has active subscription
    const currentStatus = await checkSubscription(shopify, session);
    
    // Shopify automatically handles subscription replacement when creating a new one
    // The replacementBehavior parameter controls when the new subscription takes effect:
    // - STANDARD: Default behavior with automatic proration and deferral logic
    // - APPLY_IMMEDIATELY: Cancel current subscription immediately and apply new one
    // - APPLY_ON_NEXT_BILLING_CYCLE: Defer until current billing cycle ends

    // Create new subscription with replacement behavior
    // Note: We need to update createSubscription to accept replacementBehavior parameter
    const result = await createSubscription(
      shopify,
      session,
      newPlanHandle,
      returnUrl,
      0, // No trial for plan changes
      replacementBehavior
    );

    return result;
  } catch (error) {
    logger.error("[BILLING] Failed to change plan", error, null, {
      shop: session?.shop,
      newPlanHandle,
    });
    throw error;
  }
};
```

**Important:** The `createSubscription` function needs to be updated to accept and pass the `replacementBehavior` parameter to the `appSubscriptionCreate` mutation. The valid enum values are:
- `STANDARD` (default) - Automatic proration and deferral based on plan changes
- `APPLY_IMMEDIATELY` - Cancel current subscription immediately
- `APPLY_ON_NEXT_BILLING_CYCLE` - Defer until current billing cycle ends

#### 3.1.4 Add Webhook Handler

**File:** `server/index.js`

**Add Webhook Route:**
```javascript
// App subscriptions update webhook - for billing status changes
app.post(
  "/webhooks/app/subscriptions/update",
  verifyWebhookSignature,
  async (req, res) => {
    try {
      const { app_subscription } = req.webhookData;
      const shop = req.webhookShop;

      logger.info("[WEBHOOK] app/subscriptions/update received", {
        shop,
        subscriptionId: app_subscription?.id,
        status: app_subscription?.status,
        webhookTopic: req.webhookTopic,
      });

      // Handle subscription status changes:
      // The webhook payload contains the updated AppSubscription object
      // Common status values (AppSubscriptionStatus enum):
      // - ACTIVE: Subscription is active and billing
      // - PENDING: Waiting for merchant approval
      // - DECLINED: Merchant declined the charge
      // - EXPIRED: Subscription has expired
      // - CANCELLED: Subscription was cancelled
      // - FROZEN: Store billing account is frozen
      
      // The webhook also fires when:
      // - Subscription status changes (approval, cancellation, etc.)
      // - Capped amount is changed (for usage-based subscriptions)
      // - Subscription is created, updated, or cancelled

      // Update your database/cache with new subscription status
      // Send notifications if needed
      // Handle feature access based on status

      logger.info("[WEBHOOK] app/subscriptions/update processed successfully", {
        shop,
        subscriptionId: app_subscription?.id,
        status: app_subscription?.status,
      });

      res.status(200).json({ received: true });
    } catch (error) {
      logger.error("[WEBHOOK ERROR] app/subscriptions/update failed", error, req, {
        shop: req.webhookShop,
        webhookTopic: req.webhookTopic,
      });
      
      res.status(200).json({ 
        received: true,
        error: "Webhook processed but encountered an error",
      });
    }
  }
);
```

#### 3.1.5 Update API Endpoints

**Add New Endpoints:**
```javascript
// Cancel subscription
app.post("/api/billing/cancel", async (req, res) => {
  try {
    const { shop, prorate } = req.body;

    if (!shop) {
      return res.status(400).json({
        error: "Missing shop parameter",
      });
    }

    const shopDomain = shop.includes(".myshopify.com")
      ? shop
      : `${shop}.myshopify.com`;

    const sessionId = shopify.session.getOfflineId(shopDomain);
    const session = await shopify.session.getSessionById(sessionId);

    if (!session) {
      return res.status(401).json({
        error: "Session not found",
        message: "Please install the app first",
      });
    }

    const result = await billing.cancelSubscription(
      shopify,
      session,
      prorate || false
    );

    res.json(result);
  } catch (error) {
    logger.error("[BILLING] Failed to cancel subscription", error, req);
    res.status(500).json({
      error: "Failed to cancel subscription",
      message: error.message,
    });
  }
});

// Change plan
app.post("/api/billing/change-plan", async (req, res) => {
  try {
    const { shop, planHandle, returnUrl } = req.body;

    if (!shop || !planHandle) {
      return res.status(400).json({
        error: "Missing required parameters",
        message: "shop and planHandle are required",
      });
    }

    const shopDomain = shop.includes(".myshopify.com")
      ? shop
      : `${shop}.myshopify.com`;

    const sessionId = shopify.session.getOfflineId(shopDomain);
    const session = await shopify.session.getSessionById(sessionId);

    if (!session) {
      return res.status(401).json({
        error: "Session not found",
        message: "Please install the app first",
      });
    }

    const defaultReturnUrl = `${process.env.VITE_SHOPIFY_APP_URL || appUrl}/auth/callback?shop=${shopDomain}`;
    const finalReturnUrl = returnUrl || defaultReturnUrl;

    const result = await billing.changePlan(
      shopify,
      session,
      planHandle,
      finalReturnUrl
    );

    res.json(result);
  } catch (error) {
    logger.error("[BILLING] Failed to change plan", error, req);
    res.status(500).json({
      error: "Failed to change plan",
      message: error.message,
    });
  }
});
```

### 3.2 Frontend Implementation

#### 3.2.1 Create Pricing Page Component

**File:** `src/pages/Pricing.tsx`

**Features:**
- Display all available plans
- Plan comparison table
- Feature lists for each plan
- "Select Plan" buttons
- Current plan indicator
- Upgrade/downgrade options

**Implementation:**
```typescript
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X, Zap } from "lucide-react";

interface Plan {
  handle: string;
  name: string;
  price: number;
  interval: string;
  description: string;
  features: string[];
  isPopular?: boolean;
}

const Pricing = () => {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [currentPlan, setCurrentPlan] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch plans and current subscription
    fetchPlans();
    fetchCurrentSubscription();
  }, []);

  const fetchPlans = async () => {
    try {
      const response = await fetch("/api/billing/plans");
      const data = await response.json();
      setPlans(data.plans);
    } catch (error) {
      console.error("Failed to fetch plans:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCurrentSubscription = async () => {
    try {
      const shop = new URLSearchParams(window.location.search).get("shop");
      if (!shop) return;

      const response = await fetch(`/api/billing/subscription?shop=${shop}`);
      const data = await response.json();
      if (data.hasActiveSubscription && !data.isFree) {
        setCurrentPlan(data.plan.handle);
      }
    } catch (error) {
      console.error("Failed to fetch subscription:", error);
    }
  };

  const handleSelectPlan = async (planHandle: string) => {
    try {
      const shop = new URLSearchParams(window.location.search).get("shop");
      if (!shop) {
        alert("Shop parameter is required");
        return;
      }

      const response = await fetch("/api/billing/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shop,
          planHandle,
          returnUrl: window.location.href,
        }),
      });

      const data = await response.json();

      if (data.confirmationUrl) {
        // Redirect to Shopify's confirmation page
        window.location.href = data.confirmationUrl;
      } else if (data.isFree) {
        // Free plan - no confirmation needed
        alert("Free plan activated!");
        window.location.reload();
      }
    } catch (error) {
      console.error("Failed to subscribe:", error);
      alert("Failed to subscribe. Please try again.");
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted py-12">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">Choose Your Plan</h1>
          <p className="text-xl text-muted-foreground">
            Select the perfect plan for your store
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
          {plans.map((plan) => (
            <Card
              key={plan.handle}
              className={`relative ${
                plan.isPopular ? "border-primary shadow-lg scale-105" : ""
              }`}
            >
              {plan.isPopular && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
                  Most Popular
                </Badge>
              )}
              {currentPlan === plan.handle && (
                <Badge className="absolute -top-3 right-4 bg-success">
                  Current Plan
                </Badge>
              )}
              <CardHeader>
                <CardTitle>{plan.name}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
                <div className="mt-4">
                  <span className="text-4xl font-bold">
                    ${plan.price}
                  </span>
                  <span className="text-muted-foreground">/month</span>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 mb-6">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <Check className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  className="w-full"
                  variant={plan.isPopular ? "default" : "outline"}
                  onClick={() => handleSelectPlan(plan.handle)}
                  disabled={currentPlan === plan.handle}
                >
                  {currentPlan === plan.handle
                    ? "Current Plan"
                    : plan.price === 0
                    ? "Get Started"
                    : "Select Plan"}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Pricing;
```

#### 3.2.2 Create Subscription Management Component

**File:** `src/components/SubscriptionManagement.tsx`

**Features:**
- Current subscription status
- Billing information
- Plan details
- Cancel subscription option
- Upgrade/downgrade buttons
- Billing history (if available)

#### 3.2.3 Add Route for Pricing Page

**File:** `src/App.tsx`

```typescript
import Pricing from "./pages/Pricing";

// Add route:
<Route path="/pricing" element={<Pricing />} />
```

### 3.3 Configuration Updates

#### 3.3.1 Update shopify.app.toml

**Add Webhook:**
```toml
[[webhooks.subscriptions]]
topics = [ "app/subscriptions/update" ]
uri = "/webhooks/app/subscriptions/update"
```

**Note:** The topic name in `shopify.app.toml` uses lowercase with slashes (`app/subscriptions/update`), which corresponds to the `APP_SUBSCRIPTIONS_UPDATE` enum value in the GraphQL API. The webhook handler route path must match the URI specified here.

#### 3.3.2 Shopify Partners Dashboard

**Required Actions:**
1. Create plan handles in Partners Dashboard:
   - `free`
   - `pro` (monthly - $20/month)
   - `pro_annual` (annual - $180/year, equivalent to $15/month)

2. Configure plan details:
   - Prices
   - Billing intervals
   - Descriptions
   - Feature lists

3. Set up test mode for development

#### 3.3.3 Access Scope Requirement

**Important:** The `applications_billing` access scope is required for all billing operations. Ensure this scope is included in your `shopify.app.toml`:

```toml
[access_scopes]
scopes = "read_products,read_themes,write_products,write_themes,applications_billing"
```

**Note:** The `applications_billing` scope is automatically included when you use the Shopify CLI, but verify it's present in your configuration.

---

## 4. Payment Flow

### 4.1 Subscription Creation Flow

```
1. Merchant clicks "Select Plan" on pricing page
   ↓
2. Frontend calls POST /api/billing/subscribe
   ↓
3. Backend creates subscription via appSubscriptionCreate mutation
   ↓
4. Shopify returns confirmationUrl
   ↓
5. Frontend redirects merchant to confirmationUrl
   ↓
6. Merchant approves/declines on Shopify's page
   ↓
7. Shopify redirects to returnUrl (with status)
   ↓
8. App handles subscription status
   ↓
9. Webhook APP_SUBSCRIPTIONS_UPDATE fires
   ↓
10. Backend updates subscription status
```

### 4.2 Plan Change Flow

```
1. Merchant clicks "Upgrade" or "Downgrade"
   ↓
2. Frontend calls POST /api/billing/change-plan
   ↓
3. Backend creates new subscription (replaces old one)
   ↓
4. Shopify handles proration automatically
   ↓
5. Merchant approves new subscription
   ↓
6. Old subscription cancelled, new one activated
   ↓
7. Webhook fires with updated status
```

### 4.3 Cancellation Flow

```
1. Merchant clicks "Cancel Subscription"
   ↓
2. Frontend shows confirmation dialog
   ↓
3. Frontend calls POST /api/billing/cancel
   ↓
4. Backend cancels subscription via appSubscriptionCancel
   ↓
5. Shopify handles prorated credits (if prorate=true)
   ↓
6. Webhook fires with CANCELLED status
   ↓
7. App restricts access to paid features
```

---

## 5. Feature Gating Implementation

### 5.1 Backend Middleware

**File:** `server/middleware/subscriptionGate.js`

```javascript
/**
 * Middleware to gate routes based on subscription plan
 * @param {string[]} allowedPlans - Array of plan handles that can access
 */
export const requirePlan = (allowedPlans) => {
  return async (req, res, next) => {
    try {
      const shop = req.query.shop || req.body.shop;
      if (!shop) {
        return res.status(400).json({
          error: "Missing shop parameter",
        });
      }

      const shopDomain = shop.includes(".myshopify.com")
        ? shop
        : `${shop}.myshopify.com`;

      const sessionId = shopify.session.getOfflineId(shopDomain);
      const session = await shopify.session.getSessionById(sessionId);

      if (!session) {
        return res.status(401).json({
          error: "Session not found",
        });
      }

      const subscriptionStatus = await billing.checkSubscription(
        shopify,
        session,
        allowedPlans
      );

      if (!subscriptionStatus.allowed) {
        return res.status(403).json({
          error: "Subscription required",
          message: `This feature requires one of the following plans: ${allowedPlans.join(", ")}`,
          currentPlan: subscriptionStatus.plan?.handle,
          requiredPlans: allowedPlans,
        });
      }

      // Attach subscription info to request
      req.subscription = subscriptionStatus;
      next();
    } catch (error) {
      logger.error("[MIDDLEWARE] Subscription gate failed", error, req);
      res.status(500).json({
        error: "Failed to verify subscription",
        message: error.message,
      });
    }
  };
};
```

### 5.2 Usage Limits

**File:** `server/utils/usageLimits.js`

```javascript
/**
 * Check if merchant has exceeded usage limits
 * @param {Object} subscriptionStatus - Current subscription status
 * @param {string} action - Action type (e.g., 'tryon')
 * @returns {Promise<Object>} Usage limit check result
 */
export const checkUsageLimit = async (subscriptionStatus, action) => {
  const plan = subscriptionStatus.plan;
  const limits = plan.limits || {};

  // For free plan, check monthly usage
  if (plan.handle === "free") {
    const monthlyUsage = await getMonthlyUsage(subscriptionStatus.shop, action);
    const limit = limits.monthlyTryOns || 10;

    if (monthlyUsage >= limit) {
      return {
        allowed: false,
        limit: limit,
        used: monthlyUsage,
        message: `You've reached your monthly limit of ${limit} try-ons. Upgrade to continue.`,
      };
    }
  }

  return {
    allowed: true,
    limit: limits.monthlyTryOns || null,
    used: await getMonthlyUsage(subscriptionStatus.shop, action),
  };
};
```

---

## 6. Testing Strategy

### 6.1 Test Scenarios

1. **Subscription Creation:**
   - Create free plan (should succeed without confirmation)
   - Create paid plan (should redirect to confirmation)
   - Create plan with invalid handle (should fail)

2. **Subscription Status:**
   - Check status for shop with active subscription
   - Check status for shop without subscription
   - Check status for shop with cancelled subscription

3. **Plan Changes:**
   - Upgrade from Free to Pro
   - Switch between Pro Monthly and Pro Annual
   - Verify proration handling

4. **Cancellation:**
   - Cancel with proration
   - Cancel without proration
   - Verify access restrictions after cancellation

5. **Webhooks:**
   - Test APP_SUBSCRIPTIONS_UPDATE webhook
   - Verify status updates
   - Test error handling

6. **Feature Gating:**
   - Test access with valid plan
   - Test access with invalid plan
   - Test usage limits

### 6.2 Test Environment Setup

1. Create test app in Partners Dashboard
2. Set up test shop
3. Configure test plans
4. Use Shopify CLI for local testing
5. Use ngrok for webhook testing

---

## 7. Security Considerations

### 7.1 Authentication

- ✅ All API endpoints require shop parameter
- ✅ Session validation for all billing operations
- ✅ Webhook signature verification (already implemented)

### 7.2 Authorization

- ✅ Verify shop owns the subscription before cancellation
- ✅ Validate plan handles before creation
- ✅ Check subscription status before feature access

### 7.3 Data Protection

- ✅ No sensitive payment data stored (handled by Shopify)
- ✅ Log subscription events for audit
- ✅ Handle webhook failures gracefully

---

## 8. Monitoring & Analytics

### 8.1 Key Metrics to Track

- Subscription creation rate
- Plan distribution (Free vs Paid)
- Upgrade/downgrade rates
- Cancellation rate
- Average revenue per user (ARPU)
- Churn rate
- Trial conversion rate

### 8.2 Logging

**Already Implemented:**
- ✅ Subscription creation logs
- ✅ Subscription status check logs
- ✅ Error logging

**To Add:**
- Plan change logs
- Cancellation logs
- Webhook processing logs
- Usage limit checks

---

## 9. Implementation Timeline

### Phase 1: Backend Foundation (Week 1)
- [ ] Update plan configuration
- [ ] Add cancellation function
- [ ] Add plan change function
- [ ] Add webhook handler
- [ ] Update API endpoints
- [ ] Add subscription gate middleware

### Phase 2: Frontend UI (Week 2)
- [ ] Create pricing page component
- [ ] Create subscription management component
- [ ] Add routing
- [ ] Implement payment flow
- [ ] Add loading states and error handling

### Phase 3: Feature Gating (Week 3)
- [ ] Implement usage limits
- [ ] Add feature restrictions
- [ ] Create upgrade prompts
- [ ] Add usage tracking

### Phase 4: Testing & Polish (Week 4)
- [ ] Write tests
- [ ] Test all flows
- [ ] Fix bugs
- [ ] Performance optimization
- [ ] Documentation

### Phase 5: Deployment (Week 5)
- [ ] Configure webhooks in Partners Dashboard
- [ ] Set up production plans
- [ ] Deploy to production
- [ ] Monitor and iterate

---

## 10. Best Practices

### 10.1 Shopify Recommendations

1. **Simple Pricing:** Limit to 3-4 plans maximum
2. **Clear Value:** Make feature differences obvious
3. **Free Trials:** Offer trials to increase conversion
4. **Local Currency:** Match merchant's billing currency
5. **Transparent Billing:** Clear pricing and billing cycles

### 10.2 Code Quality

1. **Error Handling:** Comprehensive error handling at all levels
2. **Logging:** Detailed logging for debugging and monitoring
3. **Validation:** Validate all inputs
4. **Type Safety:** Use TypeScript where possible
5. **Documentation:** Document all functions and APIs

### 10.3 User Experience

1. **Clear CTAs:** Obvious "Select Plan" buttons
2. **Status Indicators:** Show current plan clearly
3. **Smooth Transitions:** Handle redirects gracefully
4. **Error Messages:** Clear, actionable error messages
5. **Loading States:** Show loading indicators during async operations

---

## 11. Resources & Documentation

### 11.1 Shopify Documentation

- [Subscription Billing Overview](https://shopify.dev/docs/apps/launch/billing/subscription-billing)
- [Create Time-Based Subscriptions](https://shopify.dev/docs/apps/launch/billing/subscription-billing/create-time-based-subscriptions)
- [GraphQL Admin API - App Subscriptions](https://shopify.dev/docs/api/admin-graphql/latest/objects/AppSubscription)
- [Billing Best Practices](https://shopify.dev/docs/apps/launch/billing#best-practices)

### 11.2 GraphQL Mutations & Queries

**Mutations:**
- `appSubscriptionCreate` - Create subscription (supports `replacementBehavior` parameter)
- `appSubscriptionCancel` - Cancel subscription (supports `prorate` parameter for prorated credits)
- `appSubscriptionTrialExtend` - Extend trial period
- `appSubscriptionLineItemUpdate` - Update capped amount for usage-based subscriptions

**Queries:**
- `currentAppInstallation` - Get active subscriptions (returns `activeSubscriptions` array)
- `shopBillingPreferences` - Get merchant's billing currency and preferences

**Important Notes:**
- An app can have only **one active subscription** per merchant at a time
- When creating a new subscription for a merchant with an existing subscription, use `replacementBehavior` to control how the replacement is handled
- Shopify automatically handles proration for upgrades/downgrades when using `STANDARD` replacement behavior
- Cancellation with `prorate=true` issues prorated credits but also deducts from Partner account based on revenue share

**Webhooks:**
- `APP_SUBSCRIPTIONS_UPDATE` (topic: `app/subscriptions/update`) - Subscription status changes, capped amount changes
- `APP_SUBSCRIPTIONS_APPROACHING_CAPPED_AMOUNT` (topic: `app/subscriptions/approaching_capped_amount`) - Usage approaching 90% of capped amount

**Note:** When configuring webhooks in `shopify.app.toml`, use the lowercase topic format (e.g., `"app/subscriptions/update"`). The GraphQL enum values use uppercase with underscores (e.g., `APP_SUBSCRIPTIONS_UPDATE`).

---

## 12. Next Steps

1. **Review this plan** with the team
2. **Prioritize features** based on business needs
3. **Set up development environment** with test plans
4. **Start with Phase 1** (Backend Foundation)
5. **Iterate based on feedback** and testing

---

## 13. Questions & Considerations

### Open Questions:
1. Do we need usage-based billing for try-on generations?
2. Should we offer annual plans with discounts?
3. What's the trial period strategy? (7 days? 14 days? 30 days?)
4. How do we handle plan changes mid-cycle?
5. What happens to data when subscription is cancelled?

### Future Enhancements:
1. Usage analytics dashboard
2. Automated upgrade prompts
3. Referral program integration
4. Enterprise custom pricing
5. Multi-currency support
6. Subscription pause/resume
7. Family/bulk plans

---

**Document Version:** 1.0  
**Last Updated:** 2024  
**Author:** AI Assistant  
**Status:** Draft - Ready for Review

