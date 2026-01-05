import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Gift, Check, X, Loader2, Sparkles, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { validateReferralCode } from "@/services/referralsApi";

interface PlanLimits {
  includedCredits: number;
  processingPriority: string;
  imageQuality: string;
  supportLevel: string;
  analyticsLevel: string;
  apiAccess: boolean;
  costPerGeneration: number;
}

interface Plan {
  name: string;
  handle: string;
  price: number;
  currencyCode: string;
  interval: string;
  trialDays?: number;
  monthlyEquivalent?: number;
  description?: string;
  features: string[];
  isFree?: boolean;
  hasOverage?: boolean;
  yearlySavings?: number | null;
  limits?: PlanLimits;
}

interface PlanConfirmationProps {
  selectedPlan: Plan;
  onConfirm: (referralCode: string | null) => void;
  onBack: () => void;
  loading?: boolean;
  shop: string;
}

export const PlanConfirmation = ({
  selectedPlan,
  onConfirm,
  onBack,
  loading = false,
  shop,
}: PlanConfirmationProps) => {
  const { t, i18n } = useTranslation();
  const [referralCodeInput, setReferralCodeInput] = useState("");
  const [validationStatus, setValidationStatus] = useState<{
    validating: boolean;
    valid: boolean;
    error: string | null;
    referralId?: number;
  }>({
    validating: false,
    valid: false,
    error: null,
  });

  // Check for referral code in URL parameter
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const referralCodeFromUrl = urlParams.get("referralCode");
    if (referralCodeFromUrl) {
      setReferralCodeInput(referralCodeFromUrl.toUpperCase());
    }
  }, []);

  const handleValidateReferralCode = async () => {
    if (!referralCodeInput.trim() || !shop) {
      setValidationStatus({
        validating: false,
        valid: false,
        error: t("planConfirmation.error.enterCode") || "Please enter a referral code",
      });
      return;
    }

    setValidationStatus({
      validating: true,
      valid: false,
      error: null,
    });

    try {
      const response = await validateReferralCode(referralCodeInput.trim(), shop);

      if (response.success) {
        setValidationStatus({
          validating: false,
          valid: true,
          error: null,
          referralId: response.referralId,
        });
        toast.success(
          t("planConfirmation.validCode", { credits: 20 }) ||
            "Valid code! You'll receive 20 credits after signup."
        );
      } else {
        setValidationStatus({
          validating: false,
          valid: false,
          error: response.message || t("planConfirmation.invalidCode") || "Invalid referral code",
        });
      }
    } catch (error) {
      console.error("[PlanConfirmation] Validation error:", error);
      setValidationStatus({
        validating: false,
        valid: false,
        error: t("planConfirmation.validationError") || "Failed to validate referral code. Please try again.",
      });
    }
  };

  const handleConfirm = () => {
    // If user entered a referral code, it must be validated before confirming
    if (referralCodeInput.trim() && !validationStatus.valid) {
      toast.error(
        t("planConfirmation.error.validationRequired") ||
        "Please validate your referral code before confirming, or remove it to continue without a referral code."
      );
      return;
    }

    // Only pass referral code if it was successfully validated
    const referralCode = validationStatus.valid && referralCodeInput.trim()
      ? referralCodeInput.trim().toUpperCase()
      : null;
    onConfirm(referralCode);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !validationStatus.validating) {
      if (validationStatus.valid) {
        handleConfirm();
      } else {
        handleValidateReferralCode();
      }
    }
  };

  const formatPrice = (price: number, currency: string) => {
    const locale = i18n.language === "fr" ? "fr-FR" : "en-US";
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: currency || "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(price);
  };

  const isMonthly = selectedPlan.interval === "EVERY_30_DAYS";
  const billingInterval = isMonthly
    ? t("planConfirmation.monthly") || "Monthly"
    : t("planConfirmation.annual") || "Annual";

  return (
    <div className="h-screen bg-background overflow-hidden flex flex-col">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 flex-1 flex flex-col min-h-0">
        <div className="max-w-3xl mx-auto w-full flex flex-col flex-1 min-h-0 space-y-4">
          {/* Back Button */}
          <div className="flex-shrink-0">
            <Button
              variant="ghost"
              onClick={onBack}
              disabled={loading}
              className="h-10 px-3"
              aria-label={t("planConfirmation.backToPlans") || "Back to Plans"}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              {t("planConfirmation.backToPlans") || "Back to Plans"}
            </Button>
          </div>

          {/* Header - Compact */}
          <div className="flex-shrink-0">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-primary/10">
                <CheckCircle2 className="h-5 w-5 text-primary" />
              </div>
              <h1 className="text-2xl font-bold text-foreground">
                {t("planConfirmation.title") || "Review Your Subscription"}
              </h1>
            </div>
          </div>

          {/* Scrollable Content Area */}
          <div className="flex-1 overflow-y-auto min-h-0 space-y-4 pr-1">
            {/* Plan Summary Card */}
            <Card className="border-2 border-border shadow-lg">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Sparkles className="h-4 w-4 text-primary" />
                  {t("planConfirmation.selectedPlan") || "Selected Plan"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Plan Name and Price */}
                <div className="border-b border-border pb-3">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-xl font-bold text-foreground">{selectedPlan.name}</h3>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {formatPrice(selectedPlan.price, selectedPlan.currencyCode)}
                        {isMonthly
                          ? `/${t("planConfirmation.perMonth") || "month"}`
                          : `/${t("planConfirmation.perYear") || "year"}`}
                      </p>
                    </div>
                    <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20 h-6">
                      {billingInterval}
                    </Badge>
                  </div>

                  {/* Trial Days */}
                  {selectedPlan.trialDays && selectedPlan.trialDays > 0 && (
                    <div>
                      <Badge variant="outline" className="bg-success/5 text-success border-success/20 h-5 text-xs">
                        {t("planConfirmation.trialDays", { days: selectedPlan.trialDays }) ||
                          `${selectedPlan.trialDays} day trial`}
                      </Badge>
                    </div>
                  )}
                </div>

                {/* Plan Details */}
                <div className="space-y-3">
                  {/* Credits */}
                  {selectedPlan.limits?.includedCredits !== undefined && (
                    <div className="flex items-center justify-between py-1">
                      <span className="text-sm text-muted-foreground">
                        {t("planConfirmation.includedCredits") || "Included Credits"}
                      </span>
                      <span className="text-sm font-semibold text-foreground">
                        {selectedPlan.limits.includedCredits}{" "}
                        {isMonthly
                          ? t("planConfirmation.perMonth") || "per month"
                          : t("planConfirmation.perYear") || "per year"}
                      </span>
                    </div>
                  )}

                  {/* Cost per Credit */}
                  {selectedPlan.limits?.costPerGeneration && (
                    <div className="flex items-center justify-between py-1">
                      <span className="text-sm text-muted-foreground">
                        {t("planConfirmation.costPerCredit") || "Cost per additional credit"}
                      </span>
                      <span className="text-sm font-semibold text-foreground">
                        {formatPrice(selectedPlan.limits.costPerGeneration, selectedPlan.currencyCode)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Features */}
                {selectedPlan.features && selectedPlan.features.length > 0 && (
                  <div className="border-t border-border pt-3">
                    <h4 className="text-sm font-semibold text-foreground mb-2">
                      {t("planConfirmation.features") || "Features"}
                    </h4>
                    <ul className="space-y-1.5">
                      {selectedPlan.features.map((feature, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <Check className="w-3.5 h-3.5 text-success flex-shrink-0 mt-0.5" />
                          <span className="text-xs text-muted-foreground leading-relaxed">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Referral Code Section */}
            <Card className="border-2 border-border shadow-lg">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Gift className="h-4 w-4 text-primary" />
                  {t("planConfirmation.referralCodeLabel") || "Referral Code (Optional)"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Gift className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder={t("planConfirmation.referralCodePlaceholder") || "Enter referral code"}
                      value={referralCodeInput}
                      onChange={(e) => {
                        setReferralCodeInput(e.target.value.toUpperCase());
                        setValidationStatus({
                          validating: false,
                          valid: false,
                          error: null,
                        });
                      }}
                      onKeyPress={handleKeyPress}
                      className="pl-9 h-10"
                      disabled={validationStatus.validating || loading}
                      aria-label={t("planConfirmation.referralCodePlaceholder") || "Enter referral code"}
                    />
                  </div>
                  <Button
                    onClick={handleValidateReferralCode}
                    disabled={validationStatus.validating || loading || !referralCodeInput.trim()}
                    variant="outline"
                    className="h-10 px-4"
                  >
                    {validationStatus.validating ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        {t("planConfirmation.validating") || "Validating..."}
                      </>
                    ) : validationStatus.valid ? (
                      <>
                        <Check className="h-4 w-4 mr-2" />
                        {t("planConfirmation.validate") || "Validate"}
                      </>
                    ) : (
                      t("planConfirmation.validate") || "Validate"
                    )}
                  </Button>
                </div>

                {/* Validation Feedback */}
                {validationStatus.error && (
                  <Alert variant="destructive" className="py-2">
                    <X className="h-4 w-4" />
                    <AlertDescription className="text-xs">{validationStatus.error}</AlertDescription>
                  </Alert>
                )}

                {validationStatus.valid && !validationStatus.error && (
                  <Alert className="bg-success/5 border-success/20 py-2">
                    <Check className="h-4 w-4 text-success" />
                    <AlertDescription className="text-success text-xs">
                      <div className="flex items-center justify-between">
                        <span>
                          {t("planConfirmation.validCode", { credits: 20 }) ||
                            "Valid code! You'll receive 20 credits after signup."}
                        </span>
                        <Badge variant="default" className="bg-success text-success-foreground h-5 text-xs">
                          <Check className="h-3 w-3 mr-1" />
                          {t("common.success") || "Valid"}
                        </Badge>
                      </div>
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Action Buttons - Fixed at bottom */}
          <div className="flex-shrink-0 flex flex-col sm:flex-row gap-3 pt-2 border-t border-border">
            <Button
              variant="outline"
              onClick={onBack}
              disabled={loading}
              className="h-10 sm:w-auto w-full"
              aria-label={t("planConfirmation.cancelButton") || "Cancel"}
            >
              {t("planConfirmation.cancelButton") || "Cancel"}
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={loading || validationStatus.validating}
              className="h-10 flex-1 sm:flex-initial"
              aria-label={t("planConfirmation.confirmButton") || "Confirm & Continue to Payment"}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t("planConfirmation.confirmButtonLoading") || "Processing..."}
                </>
              ) : validationStatus.validating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t("planConfirmation.validating") || "Validating..."}
                </>
              ) : (
                t("planConfirmation.confirmButton") || "Confirm & Continue to Payment"
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

