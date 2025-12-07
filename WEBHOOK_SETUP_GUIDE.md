# Webhook Setup Guide - APP_SUBSCRIPTIONS_UPDATE

This guide explains how to automatically register the subscription webhook using Shopify CLI.

## Overview

The webhook endpoint `/api/webhooks/subscriptions` has been implemented in your server and configured in `shopify.app.toml`. This webhook will:

- ✅ Automatically allocate plan credits when trial ends
- ✅ Handle subscription updates in real-time
- ✅ Log all activities for debugging

## ✅ Webhook Configuration Complete

The webhook is **already configured** in `shopify.app.toml`:

```toml
[[webhooks.subscriptions]]
topics = [ "APP_SUBSCRIPTIONS_UPDATE" ]
uri = "/api/webhooks/subscriptions"
```

## Step 1: Deploy the Webhook Configuration

The webhook will be **automatically registered** when you deploy your app using Shopify CLI:

```bash
shopify app deploy
```

This command will:
1. Register all webhooks defined in `shopify.app.toml`
2. Set up the `APP_SUBSCRIPTIONS_UPDATE` webhook at `/api/webhooks/subscriptions`
3. Configure it for all stores where your app is installed

**No manual registration needed!** The webhook is configured in the TOML file and will be registered automatically.

## Step 2: Verify Webhook Registration

After deploying your app, you can verify the webhook is working:

1. **Check Webhook Delivery**
   - In your Partner Dashboard, go to your app's **Webhooks** section
   - You should see the newly created webhook listed
   - Click on it to see delivery logs

2. **Test Webhook (Optional)**
   - Create a test subscription or update an existing one
   - Check your server logs to confirm the webhook was received
   - Look for log entries with `[WEBHOOK] /api/webhooks/subscriptions`

## Alternative: Manual Verification (If Needed)

If you need to verify the webhook in Partner Dashboard:

1. **Go to Shopify Partner Dashboard**
   - Navigate to: https://partners.shopify.com
   - Log in with your Partner account

2. **Navigate to Your App**
   - Click on **Apps** in the left sidebar
   - Select your app: **nusense-tryon**

3. **Check Webhooks Section**
   - Click on **App setup** or **Configuration** tab
   - Scroll to the **Webhooks** section
   - You should see `APP_SUBSCRIPTIONS_UPDATE` webhook listed
   - Verify the URL is: `https://try-this-look.vercel.app/api/webhooks/subscriptions`

## Step 3: Update Your Domain (If Needed)

If your production domain is different from `try-this-look.vercel.app`, make sure to:

1. Update the webhook URL in Partner Dashboard to match your actual domain
2. Ensure your `vercel.json` is configured correctly (already done)
3. Verify the webhook endpoint is accessible at your domain

## Technical Details

### Endpoint Implementation

The webhook endpoint is implemented at:
- **Route**: `/api/webhooks/subscriptions`
- **Method**: `POST`
- **Authentication**: HMAC signature verification (automatic)
- **Format**: JSON

### Webhook Handler Features

The handler automatically:

1. **Verifies webhook signature** - Ensures the request is from Shopify
2. **Extracts subscription data** - Handles multiple payload formats
3. **Stores subscription data** - Updates local cache for fast retrieval
4. **Allocates credits** - Automatically adds plan credits when trial ends
5. **Updates metafields** - Controls app block/banner visibility
6. **Logs activities** - Comprehensive logging for debugging

### Webhook Payload Format

Shopify sends subscription data in one of these formats:

```json
// Format 1: Nested
{
  "app_subscription": {
    "id": "...",
    "status": "ACTIVE",
    ...
  }
}

// Format 2: Array
{
  "app_subscriptions": [{
    "id": "...",
    "status": "ACTIVE",
    ...
  }]
}

// Format 3: Direct
{
  "id": "...",
  "status": "ACTIVE",
  ...
}
```

The handler automatically detects and processes all formats.

## Troubleshooting

### Webhook Not Receiving Events

1. **Check Webhook Status**
   - In Partner Dashboard, verify the webhook status is "Active"
   - Check for any error messages

2. **Verify URL Accessibility**
   - Ensure your domain is publicly accessible
   - Test the endpoint: `curl https://your-domain.com/api/webhooks/subscriptions`

3. **Check Server Logs**
   - Look for webhook-related logs in your server
   - Check for authentication errors

### Webhook Signature Verification Fails

- Ensure `VITE_SHOPIFY_API_SECRET` is set correctly in your environment variables
- Verify the secret matches your app's API secret in Partner Dashboard

### Credits Not Allocating

- Check server logs for error messages during credit allocation
- Verify the subscription status is `ACTIVE`
- Ensure trial period has ended (trialDays = 0)

## Additional Notes

- ✅ The webhook endpoint is **already implemented** and ready to use
- ✅ The webhook is **configured in shopify.app.toml** for automatic registration
- ✅ Run `shopify app deploy` to register the webhook automatically
- ✅ Both `/webhooks/app/subscriptions/update` and `/api/webhooks/subscriptions` are available
- ✅ The `/api/webhooks/subscriptions` endpoint handles the `APP_SUBSCRIPTIONS_UPDATE` topic
- ✅ All webhook activities are logged for debugging purposes

## Support

If you encounter any issues:

1. Check server logs for detailed error messages
2. Verify webhook configuration in Partner Dashboard
3. Test webhook delivery using Shopify's webhook testing tools
4. Review the webhook delivery logs in Partner Dashboard

---

**Status**: ✅ Webhook endpoint implemented and configured in `shopify.app.toml`
**Next Step**: Run `shopify app deploy` to automatically register the webhook
**Last Updated**: Webhook configuration complete

