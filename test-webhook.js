/**
 * Test script to simulate app/subscriptions/update webhook
 * This helps test the webhook endpoint locally
 *
 * Usage: node test-webhook.js
 */

import crypto from "crypto";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, ".env") });

const API_SECRET = process.env.VITE_SHOPIFY_API_SECRET;
const WEBHOOK_URL =
  process.env.WEBHOOK_URL ||
  "http://localhost:3000/webhooks/app/subscriptions/update";
const SHOP_DOMAIN = process.env.TEST_SHOP || "test-shop.myshopify.com";

if (!API_SECRET) {
  console.error("❌ Errors: VITE_SHOPIFY_API_SECRET not found in .env file");
  process.exit(1);
}

// Sample subscription payload (matches Shopify's format)
const webhookPayload = {
  app_subscription: {
    id: "gid://shopify/AppSubscription/123456789",
    status: "ACTIVE",
    currentPeriodEnd: new Date(
      Date.now() + 30 * 24 * 60 * 60 * 1000
    ).toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lineItems: [
      {
        id: "gid://shopify/AppSubscriptionLineItem/987654321",
        plan: {
          id: "gid://shopify/AppPlan/111222333",
          name: "Pro Plan",
          pricingDetails: {
            __typename: "AppRecurringPricing",
            price: {
              amount: "180.00",
              currencyCode: "EUR",
            },
            interval: "ANNUAL",
          },
        },
      },
    ],
  },
};

// Convert payload to JSON string
const payloadString = JSON.stringify(webhookPayload);

// Calculate HMAC signature
const hmac = crypto
  .createHmac("sha256", API_SECRET)
  .update(payloadString, "utf8")
  .digest("base64");

// Make webhook request
async function testWebhook() {
  console.log("🧪 Testing webhook endpoint...");
  console.log(`📍 URL: ${WEBHOOK_URL}`);
  console.log(`🏪 Shop: ${SHOP_DOMAIN}`);
  console.log(`🔐 HMAC: ${hmac.substring(0, 20)}...`);
  console.log("");

  try {
    const response = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Hmac-Sha256": hmac,
        "X-Shopify-Topic": "app/subscriptions/update",
        "X-Shopify-Shop-Domain": SHOP_DOMAIN,
      },
      body: payloadString,
    });

    const responseText = await response.text();
    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = responseText;
    }

    console.log(`📊 Status: ${response.status} ${response.statusText}`);
    console.log("📦 Response:", JSON.stringify(responseData, null, 2));

    if (response.ok) {
      console.log("");
      console.log("✅ Webhook test successful!");
      console.log("Check your server logs for:");
      console.log("  - [WEBHOOK] app/subscriptions/update received");
      console.log("  - [WEBHOOK] app/subscriptions/update stored in cache");
    } else {
      console.log("");
      console.log("❌ Webhook test failed");
      console.log("Check the error message above");
    }
  } catch (error) {
    console.error("❌ Error testing webhook:", error.message);
    console.error("");
    console.error("Make sure:");
    console.error("  1. Server is running (npm run server:dev)");
    console.error("  2. WEBHOOK_URL is correct");
    console.error("  3. VITE_SHOPIFY_API_SECRET is set in .env");
  }
}

testWebhook();
