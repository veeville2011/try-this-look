import { useState } from "react";
import { useShop } from "@/providers/AppBridgeProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Gift, Check, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface CouponRedemptionProps {
  onRedeemed?: () => void;
}

export const CouponRedemption = ({ onRedeemed }: CouponRedemptionProps) => {
  const shop = useShop();
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
    if (!code.trim() || !shop) {
      toast.error("Please enter a coupon code");
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
        toast.error("Invalid coupon code");
      } else if (data.alreadyUsed) {
        toast.warning("This coupon has already been used");
      }
    } catch (error) {
      console.error("[CouponRedemption] Validation error:", error);
      toast.error("Failed to validate coupon code");
    } finally {
      setValidating(false);
    }
  };

  const redeemCoupon = async () => {
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
        toast.success(`${data.creditsAdded} credits added successfully!`);
        setCode("");
        setCouponStatus(null);
        onRedeemed?.();
      } else {
        toast.error(data.message || "Failed to redeem coupon");
      }
    } catch (error) {
      console.error("[CouponRedemption] Redemption error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to redeem coupon");
    } finally {
      setRedeeming(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      if (couponStatus?.valid && !couponStatus.alreadyUsed) {
        redeemCoupon();
      } else {
        validateCoupon();
      }
    }
  };

  return (
    <div className="space-y-3">
      <Label>Redeem Coupon Code</Label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Gift className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Enter coupon code"
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
                Redeeming...
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                Redeem
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
                Validating...
              </>
            ) : (
              "Validate"
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
                    Valid coupon! {couponStatus.credits} credits will be added.
                  </span>
                  <Badge variant="default">
                    <Check className="h-3 w-3 mr-1" />
                    Valid
                  </Badge>
                </div>
              </AlertDescription>
            </Alert>
          ) : couponStatus.alreadyUsed ? (
            <Alert variant="destructive">
              <X className="h-4 w-4" />
              <AlertDescription>
                This coupon has already been used.
              </AlertDescription>
            </Alert>
          ) : (
            <Alert variant="destructive">
              <X className="h-4 w-4" />
              <AlertDescription>
                Invalid or expired coupon code.
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}
    </div>
  );
};

