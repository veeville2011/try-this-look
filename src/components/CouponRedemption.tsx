import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useShop } from "@/providers/AppBridgeProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Gift, Check, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface SubscriptionStatus {
  subscription: {
    id: string;
    status: string;
  } | null;
  plan: {
    name: string;
    price: number;
    currencyCode: string;
    interval: string;
  } | null;
  hasActiveSubscription: boolean;
  isFree: boolean;
}

interface CouponRedemptionProps {
  onRedeemed?: () => void;
  subscription?: SubscriptionStatus | null;
}

export const CouponRedemption = ({ onRedeemed, subscription }: CouponRedemptionProps) => {
  const { t } = useTranslation();
  const shop = useShop();

  // Only allow coupon redemption for subscribed users
  const isSubscribed = subscription?.subscription !== null && 
                      subscription?.hasActiveSubscription && 
                      !subscription?.isFree;
  const [code, setCode] = useState("");
  const [validating, setValidating] = useState(false);
  const [redeeming, setRedeeming] = useState(false);
  const [couponStatus, setCouponStatus] = useState<{
    valid: boolean;
    credits: number | null;
    alreadyUsed: boolean;
    expiresAt: string | null;
  } | null>(null);

  const validateCoupon = async () => {
    if (!isSubscribed) {
      toast.error(t("coupon.subscriptionRequired"));
      return;
    }
    if (!code.trim() || !shop) {
      toast.error(t("coupon.enterCodeError"));
      return;
    }

    setValidating(true);
    setCouponStatus(null);

    try {
      const response = await fetch(
        `/api/credits/coupon-status?shop=${encodeURIComponent(shop)}&code=${encodeURIComponent(code.trim())}`
      );

      if (!response.ok) {
        throw new Error("Failed to validate coupon");
      }

      const data = await response.json();
      setCouponStatus(data);

      if (!data.valid) {
        toast.error(t("coupon.invalid"));
      } else if (data.alreadyUsed) {
        toast.warning(t("coupon.alreadyUsed"));
      }
    } catch (error) {
      console.error("[CouponRedemption] Validation error:", error);
      toast.error(t("coupon.validateError"));
    } finally {
      setValidating(false);
    }
  };

  const redeemCoupon = async () => {
    if (!isSubscribed) {
      toast.error(t("coupon.subscriptionRequired"));
      return;
    }
    if (!code.trim() || !shop || !couponStatus?.valid || couponStatus.alreadyUsed) {
      return;
    }

    setRedeeming(true);

    try {
      const response = await fetch("/api/credits/redeem-coupon", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          shop,
          code: code.trim(),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to redeem coupon");
      }

      const data = await response.json();

      if (data.success) {
        toast.success(t("coupon.success", { credits: data.creditsAdded }));
        setCode("");
        setCouponStatus(null);
        onRedeemed?.();
      } else {
        toast.error(data.message || t("coupon.redeemError"));
      }
    } catch (error) {
      console.error("[CouponRedemption] Redemption error:", error);
      toast.error(error instanceof Error ? error.message : t("coupon.redeemError"));
    } finally {
      setRedeeming(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && isSubscribed) {
      if (couponStatus?.valid && !couponStatus.alreadyUsed) {
        redeemCoupon();
      } else {
        validateCoupon();
      }
    }
  };

  // Don't render coupon redemption for non-subscribed users
  if (!isSubscribed) {
    return null;
  }

  return (
    <div className="space-y-3">
      <Label>{t("coupon.redeemTitle")}</Label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Gift className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder={t("coupon.enterCode")}
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase());
              setCouponStatus(null);
            }}
            onKeyPress={handleKeyPress}
            className="pl-9"
            disabled={validating || redeeming}
          />
        </div>
        {couponStatus?.valid && !couponStatus.alreadyUsed ? (
          <Button
            onClick={redeemCoupon}
            disabled={redeeming}
            variant="default"
          >
            {redeeming ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {t("coupon.redeeming")}
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                {t("coupon.redeem")}
              </>
            )}
          </Button>
        ) : (
          <Button
            onClick={validateCoupon}
            disabled={validating || !code.trim()}
            variant="outline"
          >
            {validating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {t("coupon.validating")}
              </>
            ) : (
              t("coupon.validate")
            )}
          </Button>
        )}
      </div>

      {couponStatus && (
        <div className="space-y-2">
          {couponStatus.valid && !couponStatus.alreadyUsed ? (
            <Alert>
              <Gift className="h-4 w-4" />
              <AlertDescription>
                <div className="flex items-center justify-between">
                  <span>
                    {t("coupon.valid", { credits: couponStatus.credits })}
                  </span>
                  <Badge variant="default">
                    <Check className="h-3 w-3 mr-1" />
                    {t("common.success")}
                  </Badge>
                </div>
              </AlertDescription>
            </Alert>
          ) : couponStatus.alreadyUsed ? (
            <Alert variant="destructive">
              <X className="h-4 w-4" />
              <AlertDescription>
                {t("coupon.alreadyUsed")}
              </AlertDescription>
            </Alert>
          ) : (
            <Alert variant="destructive">
              <X className="h-4 w-4" />
              <AlertDescription>
                {t("coupon.invalid")}
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}
    </div>
  );
};

