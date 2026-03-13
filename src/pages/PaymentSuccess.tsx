import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { CheckCircle2, Sparkles, PartyPopper } from "lucide-react";
import { Button } from "@/components/ui/button";
import { syncCredits } from "@/services/creditsApi";
import { awardReferralCredits } from "@/services/referralsApi";

import { createApp } from "@shopify/app-bridge";
import { Redirect } from "@shopify/app-bridge/actions";

const REDIRECT_COUNTDOWN_SECONDS = 5;

const PaymentSuccess = () => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();

  const shop = searchParams.get("shop");
  const host = searchParams.get("host");

  const [countdown, setCountdown] = useState(REDIRECT_COUNTDOWN_SECONDS);

  const processedRef = useRef(false);
  const redirectedRef = useRef(false);

  const isValidShop = shop?.endsWith(".myshopify.com");

  /*
  --------------------------------
  Shopify App Bridge initialization
  --------------------------------
  */

  const getAppBridge = () => {
    if (!host) return null;

    return createApp({
      apiKey: import.meta.env.VITE_SHOPIFY_API_KEY,
      host: host,
      forceRedirect: true,
    });
  };

  /*
  --------------------------------
  Redirect to App Root
  --------------------------------
  */

  const redirectToAppRoot = () => {
    if (redirectedRef.current) return;
    redirectedRef.current = true;

    const app = getAppBridge();

    if (!app) {
      console.warn("App Bridge not initialized");
      return;
    }

    const redirect = Redirect.create(app);

    redirect.dispatch(
      Redirect.Action.APP,
      "/"
    );
  };

  /*
  --------------------------------
  Process subscription approval
  --------------------------------
  */

  useEffect(() => {
    if (!shop || !isValidShop) return;

    if (processedRef.current) return;
    processedRef.current = true;

    const processAfterApproval = async () => {
      try {
        console.log("[PaymentSuccess] Syncing credits", { shop });

        const result = await syncCredits(shop);

        if (!result?.success) {
          console.error("Credit sync failed", result);
        }

        try {
          const referral = await awardReferralCredits(shop);

          if (referral?.creditsAwarded) {
            console.log("Referral credits awarded");
          }
        } catch (err) {
          console.warn("Referral award failed (non-blocking)");
        }

      } catch (error) {
        console.error("Failed to sync credits", error);
      }
    };

    processAfterApproval();
  }, [shop]);

  /*
  --------------------------------
  Countdown redirect
  --------------------------------
  */

  useEffect(() => {
    if (!shop || !host) return;

    const interval = window.setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          window.clearInterval(interval);
          redirectToAppRoot();
          // Keep showing "1" while we redirect, never show "0"
          return 1;
        }

        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [shop, host]);

  /*
  --------------------------------
  UI
  --------------------------------
  */

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-primary/5 flex items-center justify-center p-3">
      <div className="w-full max-w-xl flex flex-col items-center text-center gap-6">

        {/* Success Icon */}
        <div className="relative bg-success/10 rounded-full p-4">
          <CheckCircle2 className="w-14 h-14 text-success" />
        </div>

        {/* Title */}
        <div className="space-y-3">

          <div className="flex items-center justify-center gap-2">
            <PartyPopper className="w-6 h-6 text-primary animate-bounce" />

            <h1 className="text-3xl sm:text-4xl font-bold">
              {t("paymentSuccess.title")}
            </h1>

            <Sparkles className="w-6 h-6 text-primary animate-pulse" />
          </div>

          <p className="text-lg font-semibold text-success">
            {t("paymentSuccess.successMessage")}
          </p>

          <p className="text-muted-foreground max-w-md mx-auto">
            {t("paymentSuccess.description")}
          </p>
        </div>

        {/* Countdown */}
        <div className="flex flex-col items-center gap-4">

          <p
            className="text-4xl font-bold text-primary tabular-nums"
            aria-live="polite"
          >
            {countdown}
          </p>

          <Button
            size="lg"
            className="min-w-[200px]"
            onClick={redirectToAppRoot}
          >
            {t("paymentSuccess.continueButton")}
          </Button>

        </div>
      </div>
    </div>
  );
};

export default PaymentSuccess;