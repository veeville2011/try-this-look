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
  const hasTriggeredConfettiRef = useRef(false);

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
  Celebration / confetti
  --------------------------------
  */

  useEffect(() => {
    if (hasTriggeredConfettiRef.current) return;
    hasTriggeredConfettiRef.current = true;

    const triggerConfetti = async () => {
      try {
        const prefersReducedMotion = window.matchMedia?.(
          "(prefers-reduced-motion: reduce)"
        )?.matches;

        if (prefersReducedMotion) return;

        const { default: confetti } = await import("canvas-confetti");

        confetti({
          particleCount: 90,
          spread: 65,
          origin: { y: 0.3 },
        });

        window.setTimeout(() => {
          confetti({
            particleCount: 60,
            spread: 55,
            origin: { x: 0.15, y: 0.3 },
          });
          confetti({
            particleCount: 60,
            spread: 55,
            origin: { x: 0.85, y: 0.3 },
          });
        }, 400);
      } catch (error) {
        console.warn("Confetti animation failed (non-blocking)", error);
      }
    };

    if (typeof window !== "undefined") {
      triggerConfetti();
    }
  }, []);

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
    <div className="min-h-screen bg-gradient-to-b from-background via-primary/5 to-background flex items-center justify-center px-4 py-8">
      <section
        className="relative w-full max-w-xl rounded-3xl bg-background/95 shadow-lg shadow-primary/10 border border-primary/10 px-8 py-10 flex flex-col items-center text-center gap-8"
        aria-label={t("paymentSuccess.title")}
      >
        {/* Decorative glow */}
        <div className="pointer-events-none absolute inset-x-16 -top-10 h-24 bg-gradient-to-b from-primary/30 to-transparent blur-3xl opacity-60" />

        {/* Success Icon */}
        <div className="relative flex items-center justify-center">
          <div className="absolute -inset-3 rounded-full bg-success/15 blur-md" />
          <div className="relative bg-success/10 rounded-full p-5">
            <CheckCircle2 className="w-16 h-16 text-success animate-pulse" />
          </div>
        </div>

        {/* Title & description */}
        <div className="space-y-4">
          <div className="flex items-center justify-center gap-2 text-primary">
            <PartyPopper className="w-5 h-5 animate-bounce" />
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
              {t("paymentSuccess.title")}
            </h1>
            <Sparkles className="w-5 h-5 animate-pulse" />
          </div>

          <p className="text-lg font-semibold text-success">
            {t("paymentSuccess.successMessage")}
          </p>

          <p className="text-muted-foreground max-w-md mx-auto">
            {t("paymentSuccess.description")}
          </p>
        </div>

        {/* Countdown */}
        <div className="space-y-3">
          <p className="text-sm font-medium text-muted-foreground">
            {t("paymentSuccess.redirectLabel")}
          </p>

          <div className="flex flex-col items-center gap-1">
            <p
              className="text-5xl font-extrabold text-primary tabular-nums leading-none"
              aria-live="polite"
            >
              {countdown}
            </p>
            <p className="text-sm text-muted-foreground">
              {t("paymentSuccess.redirectSecondsSuffix")}
            </p>
          </div>
        </div>

        <Button
          size="lg"
          className="mt-4 min-w-[240px]"
          onClick={redirectToAppRoot}
        >
          {t("paymentSuccess.continueButton")}
        </Button>
      </section>
    </div>
  );
};

export default PaymentSuccess;