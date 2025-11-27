# Local Webhook Testing Guide

## Quick Start

### 1. Start Local Development Server

**Option A: Using Shopify CLI (Recommended - Auto-tunnel)**
```bash
npm run shopify:dev
```
This will:
- Create an ngrok tunnel automatically
- Update webhook URLs in Shopify
- Start both frontend and backend

**Option B: Manual Start**
```bash
# Terminal 1: Start backend server
npm run server:dev

# Terminal 2: Start frontend
npm run dev
```

### 2. Test Webhook Endpoint

#### Test 1: Health Check
```bash
curl http://localhost:3000/health
```
Expected: `{"status":"ok","timestamp":"..."}`

#### Test 2: Webhook Endpoint (Signature will fail, but confirms route works)
```bash
curl -X POST http://localhost:3000/webhooks/app/subscriptions/update `
  -H "Content-Type: application/json" `
  -d "{\"test\": \"data\"}"
```
Expected: `401 Unauthorized` (endpoint is reachable, signature verification working)

#### Test 3: Simulate Real Webhook (With Valid Signature)
```bash
npm run test:webhook
```

This script will:
- Generate a valid HMAC signature
- Send a test subscription payload
- Show the response

### 3. Monitor Server Logs

Watch for these log messages:
- ✅ `[WEBHOOK] app/subscriptions/update received`
- ✅ `[WEBHOOK] app/subscriptions/update - raw payload received`
- ✅ `[WEBHOOK] app/subscriptions/update stored in cache`

### 4. Test with Shopify CLI

Shopify CLI can help test webhooks:
```bash
# Check webhook configuration
shopify app info

# View webhook subscriptions
shopify app generate webhook
```

## Environment Setup

Make sure your `.env` file has:
```env
VITE_SHOPIFY_API_KEY=your_api_key
VITE_SHOPIFY_API_SECRET=your_api_secret
VITE_SHOPIFY_APP_URL=http://localhost:3000
```

## Troubleshooting

### Webhook Not Receiving
1. ✅ Check server is running: `curl http://localhost:3000/health`
2. ✅ Verify webhook URL is accessible
3. ✅ Check server logs for errors
4. ✅ Verify HMAC signature verification

### Signature Verification Failing
- Ensure `VITE_SHOPIFY_API_SECRET` matches your app's secret
- Check that webhook payload is not being modified
- Verify raw body parsing is working (check server logs)

### Local URL Not Working
- If using `shopify app dev`, it will provide an ngrok URL
- Use that URL instead of `localhost:3000` for webhook testing
- The ngrok URL will be shown in the CLI output

## Next Steps

1. Run `npm run shopify:dev` to start local development
2. Note the ngrok URL provided
3. Run `npm run test:webhook` to test the webhook
4. Check server logs to verify webhook processing
5. Test subscription flow in your Shopify app

