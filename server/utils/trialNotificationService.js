/**
 * Trial Notification Service
 * 
 * Handles notifications for trial credit usage thresholds
 * Sends notifications at 80, 90, 95, and 100 credits
 * Supports both email and in-app notifications
 */

import * as logger from "./logger.js";
import * as creditMetafield from "./creditMetafield.js";
import * as trialManager from "./trialManager.js";

const NOTIFICATION_THRESHOLDS = [80, 90, 95, 100];
const METAFIELD_NAMESPACE = "nusense";
const NOTIFICATION_SENT_KEY = "trial_notifications_sent"; // JSON array of thresholds already notified

/**
 * Check if notification should be sent for current credit usage
 * Returns: { shouldNotify: boolean, threshold: number | null, creditsUsed: number }
 */
export const checkNotificationThreshold = async (client, appInstallationId) => {
  try {
    const metafields = await creditMetafield.getCreditMetafields(client, appInstallationId);
    
    // Check if in trial period
    const isInTrial = await trialManager.isInTrialPeriod(client, appInstallationId);
    if (!isInTrial) {
      return { shouldNotify: false, threshold: null, creditsUsed: 0 };
    }

    const trialCreditsUsed = metafields.trial_credits_used || 0;
    
    // Get list of thresholds already notified
    const notificationsSent = getNotificationsSent(metafields);
    
    // Find the highest threshold that should be notified
    for (const threshold of NOTIFICATION_THRESHOLDS) {
      if (trialCreditsUsed >= threshold && !notificationsSent.includes(threshold)) {
        return {
          shouldNotify: true,
          threshold,
          creditsUsed: trialCreditsUsed,
          creditsRemaining: 100 - trialCreditsUsed,
        };
      }
    }

    return { shouldNotify: false, threshold: null, creditsUsed: trialCreditsUsed };
  } catch (error) {
    logger.error("[TRIAL_NOTIFICATION] Failed to check notification threshold", error);
    return { shouldNotify: false, threshold: null, creditsUsed: 0 };
  }
};

/**
 * Mark notification as sent for a threshold
 */
export const markNotificationSent = async (client, appInstallationId, threshold) => {
  try {
    const metafields = await creditMetafield.getCreditMetafields(client, appInstallationId);
    const notificationsSent = getNotificationsSent(metafields);
    
    if (!notificationsSent.includes(threshold)) {
      notificationsSent.push(threshold);
      
      // Store in metafield
      await creditMetafield.batchUpdateMetafields(client, appInstallationId, {
        trial_notifications_sent: JSON.stringify(notificationsSent),
      });
      
      logger.info("[TRIAL_NOTIFICATION] Marked notification as sent", {
        appInstallationId,
        threshold,
        allSent: notificationsSent,
      });
    }
  } catch (error) {
    logger.error("[TRIAL_NOTIFICATION] Failed to mark notification as sent", error);
  }
};

/**
 * Get list of thresholds that have been notified
 */
const getNotificationsSent = (metafields) => {
  try {
    const sentData = metafields[NOTIFICATION_SENT_KEY];
    if (!sentData) return [];
    
    // Handle both JSON string and already parsed array
    if (typeof sentData === "string") {
      try {
        return JSON.parse(sentData);
      } catch {
        return [];
      }
    }
    return Array.isArray(sentData) ? sentData : [];
  } catch (error) {
    logger.error("[TRIAL_NOTIFICATION] Failed to parse notifications sent", error);
    return [];
  }
};

/**
 * Send email notification
 */
export const sendEmailNotification = async (client, shopDomain, threshold, creditsUsed, creditsRemaining) => {
  try {
    // Get shop email from Shopify API
    const shopQuery = `
      query GetShop {
        shop {
          email
          name
        }
      }
    `;
    
    const shopResponse = await client.query({ data: { query: shopQuery } });
    const shopEmail = shopResponse?.body?.data?.shop?.email;
    const shopName = shopResponse?.body?.data?.shop?.name || shopDomain;

    if (!shopEmail) {
      logger.warn("[TRIAL_NOTIFICATION] No shop email found, skipping email notification", {
        shopDomain,
        threshold,
      });
      return { success: false, reason: "No shop email found" };
    }

    // Email subject and body
    const subject = `Trial Credits Alert: ${creditsUsed}/100 credits used`;
    const emailBody = getEmailTemplate(shopName, threshold, creditsUsed, creditsRemaining, shopDomain);

    // TODO: Implement actual email sending
    // For now, we'll log it. You can integrate with:
    // - SendGrid
    // - AWS SES
    // - Nodemailer
    // - Shopify's email API (if available)
    
    logger.info("[TRIAL_NOTIFICATION] Email notification prepared", {
      shopDomain,
      shopEmail,
      threshold,
      creditsUsed,
      creditsRemaining,
      subject,
      note: "Email sending not yet implemented - integrate with email service",
    });

    // Placeholder for email sending
    // await sendEmailViaService(shopEmail, subject, emailBody);

    return { success: true, emailSent: false, note: "Email service not configured" };
  } catch (error) {
    logger.error("[TRIAL_NOTIFICATION] Failed to send email notification", error, null, {
      shopDomain,
      threshold,
    });
    return { success: false, error: error.message };
  }
};

/**
 * Get email template
 */
const getEmailTemplate = (shopName, threshold, creditsUsed, creditsRemaining, shopDomain) => {
  const appBaseUrl = process.env.VITE_SHOPIFY_APP_URL || `https://${shopDomain}`;
  const approvalUrl = `${appBaseUrl}/api/billing/approve-trial-replacement?shop=${shopDomain}`;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Trial Credits Alert</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
    <h1 style="color: #2c3e50; margin-top: 0;">Trial Credits Alert</h1>
    <p>Hello ${shopName},</p>
    <p>You've used <strong>${creditsUsed} out of 100</strong> free trial credits.</p>
    
    <div style="background-color: #fff; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #${threshold >= 95 ? 'e74c3c' : threshold >= 90 ? 'f39c12' : '3498db'};">
      <p style="margin: 0;"><strong>${creditsRemaining} credits remaining</strong></p>
    </div>

    <p>To ensure uninterrupted service, please approve your subscription now. Once you reach 100 credits or 30 days pass, your trial will end and billing will begin.</p>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${approvalUrl}" style="background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
        Approve Subscription Now
      </a>
    </div>

    <p style="font-size: 14px; color: #666;">
      <strong>What happens next?</strong><br>
      • Approve now: Billing starts immediately after approval<br>
      • Wait: Trial ends at 100 credits or 30 days (whichever comes first)<br>
      • Your unused trial credits will remain available after trial ends
    </p>

    <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">

    <p style="font-size: 12px; color: #999; text-align: center;">
      This is an automated notification from your Try-This-Look app.<br>
      If you have questions, please contact support.
    </p>
  </div>
</body>
</html>
  `.trim();
};

/**
 * Get in-app notification data
 */
export const getInAppNotification = (threshold, creditsUsed, creditsRemaining) => {
  const isUrgent = threshold >= 95;
  const isWarning = threshold >= 90;
  
  return {
    type: isUrgent ? "urgent" : isWarning ? "warning" : "info",
    title: isUrgent 
      ? "⚠️ Trial Credits Almost Exhausted"
      : isWarning
      ? "Trial Credits Running Low"
      : "Trial Credits Update",
    message: `You've used ${creditsUsed} out of 100 free trial credits. ${creditsRemaining} credits remaining.`,
    action: {
      label: "Approve Subscription Now",
      url: "/api/billing/approve-trial-replacement",
    },
    creditsUsed,
    creditsRemaining,
    threshold,
  };
};

