import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { CheckCircle2, Sparkles, PartyPopper } from "lucide-react";
import { Button } from "@/components/ui/button";
import { syncCredits } from "@/services/creditsApi";
import { awardReferralCredits } from "@/services/referralsApi";

const REDIRECT_COUNTDOWN_SECONDS = 5;

const PaymentSuccess = () => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const shop = searchParams.get("shop");
  const [countdown, setCountdown] = useState(REDIRECT_COUNTDOWN_SECONDS);

  // Sync credits and award referral credits when component mounts (after subscription approval)
  useEffect(() => {
    const processAfterApproval = async () => {
      if (!shop) {
        console.warn("[PaymentSuccess] No shop parameter, skipping credit sync and referral award");
        return;
      }

      try {
        console.log("[PaymentSuccess] Syncing credits after subscription approval", {
          shop,
        });
        const result = await syncCredits(shop);
        
        if (result.success) {
          console.log("[PaymentSuccess] Credits synced successfully", {
            action: result.action,
            planHandle: result.planHandle,
            includedCredits: result.includedCredits,
            requestId: result.requestId,
          });
        } else {
          console.error("[PaymentSuccess] Credit sync failed", {
            error: result.error,
            message: result.message,
            requestId: result.requestId,
          });
        }

        // Award referral credits (non-blocking - errors don't disrupt user flow)
        try {
          console.log("[PaymentSuccess] Awarding referral credits", {
            shop,
          });
          const awardResult = await awardReferralCredits(shop);
          
          if (awardResult.success && awardResult.creditsAwarded) {
            console.log("[PaymentSuccess] Referral credits awarded successfully", {
              referrerCredits: awardResult.referrerCredits,
              referredCredits: awardResult.referredCredits,
              requestId: awardResult.requestId,
            });
          } else if (awardResult.success && !awardResult.creditsAwarded) {
            console.log("[PaymentSuccess] No referral to process", {
              requestId: awardResult.requestId,
            });
          } else {
            console.warn("[PaymentSuccess] Referral credit award failed (non-blocking)", {
              error: awardResult.error,
              message: awardResult.message,
              requestId: awardResult.requestId,
            });
          }
        } catch (referralError) {
          // Silently handle referral errors - don't disrupt user experience
          console.warn("[PaymentSuccess] Failed to award referral credits (non-blocking)", referralError);
        }
      } catch (error) {
        // Silently handle errors - don't disrupt user experience
        console.error("[PaymentSuccess] Failed to sync credits", error);
      }
    };

    processAfterApproval();
  }, [shop]);

  const getEmbeddedAppUrl = (): string | null => {
    const shopParam = shop?.trim();
    if (!shopParam) return null;
    const storeHandle = shopParam.replace(".myshopify.com", "");
    if (!storeHandle) return null;
    const appId = "f8de7972ae23d3484581d87137829385";
    return `https://admin.shopify.com/store/${encodeURIComponent(storeHandle)}/apps/${appId}?payment_success=true`;
  };

  const embeddedAppUrl = getEmbeddedAppUrl();
  const willAutoRedirect = Boolean(embeddedAppUrl);

  const handleRedirectToApp = () => {
    console.log("[PaymentSuccess] handleRedirectToApp invoked", {
      embeddedAppUrl,
      shop,
    });

    if (!embeddedAppUrl) {
      console.error(
        "[PaymentSuccess] No embedded app URL available. Skipping redirect to avoid incorrect fallback.",
        { shop }
      );
      return;
    }

    console.log("[PaymentSuccess] Redirecting to embedded app URL", {
      embeddedAppUrl,
    });
    window.location.href = embeddedAppUrl;
  };

  useEffect(() => {
    // Reset countdown whenever the shop or redirect target changes
    setCountdown(REDIRECT_COUNTDOWN_SECONDS);

    // Avoid running during SSR and ensure we have at least a shop param
    if (typeof window === "undefined") {
      console.warn(
        "[PaymentSuccess] Window is undefined (SSR?), skipping auto redirect with countdown"
      );
      return;
    }

    if (!shop) {
      console.warn("[PaymentSuccess] No shop parameter, skipping auto redirect with countdown");
      return;
    }

    if (!willAutoRedirect) {
      console.log(
        "[PaymentSuccess] No embedded app URL, skipping auto redirect with countdown (button fallback only)"
      );
      return;
    }

    console.log("[PaymentSuccess] Starting auto redirect countdown", {
      shop,
      embeddedAppUrl,
      countdownSeconds: REDIRECT_COUNTDOWN_SECONDS,
    });

    const countdownInterval = window.setInterval(() => {
      setCountdown((previousCount) => {
        if (previousCount <= 1) {
          window.clearInterval(countdownInterval);
          console.log("[PaymentSuccess] Countdown finished, redirecting to app");
          handleRedirectToApp();
          return 0;
        }

        return previousCount - 1;
      });
    }, 1000);

    return () => {
      window.clearInterval(countdownInterval);
    };
  }, [shop, embeddedAppUrl, willAutoRedirect]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-primary/5 flex items-center justify-center p-3">
      <div className="w-full max-w-xl relative z-10 flex flex-col items-center text-center gap-6">
        {/* Success Icon */}
        <div className="flex justify-center">
          <div className="relative">
            <div className="relative bg-success/10 rounded-full p-3">
              <CheckCircle2 className="w-12 h-12 sm:w-14 sm:h-14 text-success" />
            </div>
          </div>
        </div>

        {/* Success Message */}
        <div className="space-y-3">
              <div className="flex items-center justify-center gap-2 mb-2">
                <PartyPopper className="w-6 h-6 text-primary animate-bounce" />
                <h1 className="text-3xl sm:text-4xl font-bold text-foreground">
                  {t("paymentSuccess.title")}
                </h1>
                <Sparkles className="w-6 h-6 text-primary animate-pulse" />
              </div>

              <p className="text-lg sm:text-xl font-semibold text-success">
                {t("paymentSuccess.successMessage")}
              </p>

              <p className="text-sm sm:text-base text-muted-foreground max-w-md mx-auto leading-relaxed">
                {t("paymentSuccess.description")}
              </p>
        </div>

        {/* Redirect countdown and primary action */}
        <div className="flex flex-col items-center gap-4">
          {willAutoRedirect && (
            <p
              className="text-3xl sm:text-4xl font-bold text-primary tabular-nums"
              aria-live="polite"
            >
              {countdown}
            </p>
          )}

          <Button
            onClick={handleRedirectToApp}
            size="lg"
            className="w-full sm:w-auto min-w-[200px] h-11 text-sm sm:text-base font-semibold shadow-lg hover:shadow-xl transition-all"
          >
            <span>{t("paymentSuccess.continueButton")}</span>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default PaymentSuccess;
