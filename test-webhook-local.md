# Local Webhook Testing Guide

## Prerequisites
- Shopify CLI installed (`shopify version` should work)
- Node.js and npm installed
- Environment variables configured in `.env` file

## Step 1: Start Local Development Server

### Option A: Using Shopify CLI (Recommended)
```bash
npm run shopify:dev
```

This will:
- Start a local tunnel (ngrok)
- Update webhook URLs automatically
- Provide a local URL for testing

### Option B: Manual Server Start
```bash
# Terminal 1: Start the server
npm run server:dev

# Terminal 2: Start the frontend
npm run dev
```

## Step 2: Test Webhook Endpoint

### Get the Local URL
When you run `shopify app dev`, it will show you a URL like:
```
https://abc123.ngrok.io
```

### Test Health Endpoint First
```bash
curl http://localhost:3000/health
# or
curl https://your-ngrok-url.ngrok.io/health
```

### Test Webhook Endpoint (Will Fail Signature, But Confirms Route Works)
```bash
curl -X POST http://localhost:3000/webhooks/app/subscriptions/update \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}'
```

Expected: `401 Unauthorized` (signature verification failed, but endpoint is reachable)

## Step 3: Simulate Real Webhook (With Valid Signature)

Use the test script provided: `test-webhook.js`

```bash
node test-webhook.js
```

## Step 4: Monitor Logs

Watch your server logs for:
- `[WEBHOOK] app/subscriptions/update received`
- `[WEBHOOK] app/subscriptions/update stored in cache`

## Step 5: Test with Shopify CLI Webhook Trigger

Shopify CLI can trigger test webhooks:
```bash
shopify app generate webhook
```

Or manually trigger from Shopify Partners Dashboard:
1. Go to your app in Partners Dashboard
2. Navigate to "Webhooks" section
3. Find "app/subscriptions/update"
4. Click "Send test webhook"

## Troubleshooting

### Webhook Not Receiving
1. Check if server is running
2. Verify webhook URL is accessible
3. Check server logs for errors
4. Verify HMAC signature verification

### Signature Verification Failing
- Ensure `VITE_SHOPIFY_API_SECRET` is set correctly
- Check that webhook payload is not being modified
- Verify raw body parsing is working

