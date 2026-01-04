import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useShop } from "@/providers/AppBridgeProvider";
import { useSubscription } from "@/hooks/useSubscription";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Users,
  Gift,
  Copy,
  Share2,
  TrendingUp,
  AlertCircle,
  Sparkles,
  Crown,
  CheckCircle2,
  Loader2,
  ArrowLeft,
  Coins,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import {
  getReferralCode,
  getReferralStats,
  type ReferralCodeResponse,
  type ReferralStatsResponse,
} from "@/services/referralsApi";
import { useNavigate } from "react-router-dom";

const Referrals = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const shop = useShop();
  const { subscription, loading: subscriptionLoading } = useSubscription();

  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [stats, setStats] = useState<ReferralStatsResponse["stats"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copyingCode, setCopyingCode] = useState(false);

  const shopDomain = shop || new URLSearchParams(window.location.search).get("shop");

  const isPaidPlan = subscription && !subscription.isFree && subscription.hasActiveSubscription;

  useEffect(() => {
    const fetchReferralData = async () => {
      if (!shopDomain) {
        setError("Shop domain not found");
        setLoading(false);
        return;
      }

      if (subscriptionLoading) {
        return; // Wait for subscription to load
      }

      // Only fetch if user is on paid plan
      if (!isPaidPlan) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Fetch referral code and stats in parallel
        const [codeResponse, statsResponse] = await Promise.all([
          getReferralCode(shopDomain),
          getReferralStats(shopDomain),
        ]);

        if (codeResponse.success && codeResponse.referralCode) {
          setReferralCode(codeResponse.referralCode);
        }

        if (statsResponse.success && statsResponse.stats) {
          setStats(statsResponse.stats);
        } else if (statsResponse.error) {
          setError(statsResponse.message || t("referral.error.message"));
        }
      } catch (err: any) {
        console.error("[Referrals] Failed to fetch referral data", err);
        setError(err.message || t("referral.error.message"));
      } finally {
        setLoading(false);
      }
    };

    fetchReferralData();
  }, [shopDomain, isPaidPlan, subscriptionLoading]);

  const handleCopyCode = async () => {
    if (!referralCode) return;

    try {
      setCopyingCode(true);
      await navigator.clipboard.writeText(referralCode);
      toast.success(t("referral.toast.codeCopied"), {
        description: t("referral.toast.codeCopiedDescription"),
      });
    } catch (err) {
      console.error("[Referrals] Failed to copy code", err);
      toast.error(t("referral.toast.copyFailed"), {
        description: t("referral.toast.copyFailedDescription"),
      });
    } finally {
      setCopyingCode(false);
    }
  };

  const handleShareCode = async () => {
    if (!referralCode) return;

    const shareText = `Join me and get rewards! Use my referral code: ${referralCode}`;
    const shareUrl = window.location.origin;

    if (navigator.share) {
      try {
        await navigator.share({
          title: t("referral.code.label"),
          text: shareText,
          url: shareUrl,
        });
        toast.success(t("referral.toast.sharedSuccess"), {
          description: t("referral.toast.sharedSuccessDescription"),
        });
      } catch (err: any) {
        if (err.name !== "AbortError") {
          console.error("[Referrals] Failed to share", err);
          toast.error(t("referral.toast.shareFailed"), {
            description: t("referral.toast.shareFailedDescription"),
          });
        }
      }
    } else {
      // Fallback to copy
      try {
        await navigator.clipboard.writeText(`${shareText} - ${shareUrl}`);
        toast.success(t("referral.toast.linkCopied"), {
          description: t("referral.toast.linkCopiedDescription"),
        });
      } catch (copyErr) {
        console.error("[Referrals] Failed to copy", copyErr);
        toast.error(t("referral.toast.copyFailedGeneric"), {
          description: t("referral.toast.copyFailedDescription"),
        });
      }
    }
  };

  const handleBackToDashboard = () => {
    navigate("/");
  };

  // Show loading state
  if (subscriptionLoading || loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
          <div className="max-w-4xl mx-auto">
            <Skeleton className="h-10 w-48 mb-8" />
            <Card className="border border-border shadow-sm bg-card">
              <CardHeader>
                <Skeleton className="h-8 w-64 mb-2" />
                <Skeleton className="h-4 w-96" />
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <Skeleton className="h-32 w-full" />
                  <Skeleton className="h-64 w-full" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // Show error if not on paid plan
  if (!isPaidPlan) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
          <div className="max-w-4xl mx-auto">
            <Button
              variant="ghost"
              onClick={handleBackToDashboard}
              className="mb-6"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              {t("referral.backToDashboard")}
            </Button>

            <Card className="border-2 border-border shadow-lg bg-card">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Users className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-2xl font-bold text-foreground">
                      {t("referral.title")}
                    </CardTitle>
                    <CardDescription className="mt-1">
                      {t("referral.description")}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Alert className="bg-muted/50 border-border">
                  <AlertCircle className="h-5 w-5 text-muted-foreground" />
                  <AlertDescription className="mt-2">
                    <div className="space-y-3">
                      <p className="text-base font-semibold text-foreground">
                        {t("referral.upgradeRequired.title")}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {t("referral.upgradeRequired.description")}
                      </p>
                      <Button
                        onClick={handleBackToDashboard}
                        className="mt-4"
                      >
                        <Crown className="w-4 h-4 mr-2" />
                        {t("referral.upgradeRequired.viewPlans")}
                      </Button>
                    </div>
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // Show error state
  if (error && !referralCode) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
          <div className="max-w-4xl mx-auto">
            <Button
              variant="ghost"
              onClick={handleBackToDashboard}
              className="mb-6"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              {t("referral.backToDashboard")}
            </Button>

            <Card className="border-2 border-destructive/20 shadow-lg bg-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-destructive">
                  <AlertCircle className="h-5 w-5" />
                  {t("referral.error.title")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    {error}
                  </AlertDescription>
                </Alert>
                <Button
                  onClick={handleBackToDashboard}
                  className="mt-4"
                  variant="outline"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  {t("referral.backToDashboard")}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="max-w-4xl mx-auto">
          {/* Back Button */}
          <Button
            variant="ghost"
            onClick={handleBackToDashboard}
            className="mb-6"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t("referral.backToDashboard")}
          </Button>

          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-primary/10">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <h1 className="text-3xl font-bold text-foreground">
                {t("referral.title")}
              </h1>
            </div>
            <p className="text-muted-foreground">
              {t("referral.description")}
            </p>
          </div>

          {/* Referral Code Card */}
          <Card className="border-2 border-border shadow-lg bg-gradient-to-br from-card to-card/95 mb-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl font-bold text-foreground flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    {t("referral.code.title")}
                  </CardTitle>
                  <CardDescription className="mt-1">
                    {t("referral.code.description")}
                  </CardDescription>
                </div>
                {referralCode && (
                  <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    {t("referral.code.active")}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {referralCode ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 px-4 py-3 bg-muted/50 border border-border rounded-lg">
                      <code className="text-2xl font-bold text-foreground tracking-wider">
                        {referralCode}
                      </code>
                    </div>
                    <Button
                      onClick={handleCopyCode}
                      disabled={copyingCode}
                      variant="outline"
                      size="lg"
                      className="h-12 px-6"
                      aria-label={copyingCode ? t("referral.code.copying") : t("referral.code.copyAriaLabel")}
                    >
                      {copyingCode ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Copy className="w-4 h-4 mr-2" />
                      )}
                      {t("referral.code.copy")}
                    </Button>
                    <Button
                      onClick={handleShareCode}
                      size="lg"
                      className="h-12 px-6"
                    >
                      <Share2 className="w-4 h-4 mr-2" />
                      {t("referral.code.share")}
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {t("referral.code.rewardMessage")}
                  </p>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground mx-auto mb-4" />
                  <p className="text-sm text-muted-foreground">
                    {t("referral.code.loading")}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Statistics Card */}
          {stats && (
            <Card className="border border-border shadow-sm bg-card">
              <CardHeader>
                <CardTitle className="text-xl font-bold text-foreground flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  {t("referral.statistics.title")}
                </CardTitle>
                <CardDescription>
                  {t("referral.statistics.description")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="p-4 bg-muted/30 rounded-lg border border-border">
                    <div className="flex items-center gap-2 mb-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        {t("referral.statistics.totalReferrals")}
                      </p>
                    </div>
                    <p className="text-3xl font-bold text-foreground">
                      {stats.totalReferrals}
                    </p>
                  </div>

                  <div className="p-4 bg-success/5 rounded-lg border border-success/20">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle2 className="h-4 w-4 text-success" />
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        {t("referral.statistics.completed")}
                      </p>
                    </div>
                    <p className="text-3xl font-bold text-success">
                      {stats.completedReferrals}
                    </p>
                  </div>

                  <div className="p-4 bg-warning/5 rounded-lg border border-warning/20">
                    <div className="flex items-center gap-2 mb-2">
                      <Loader2 className="h-4 w-4 text-warning" />
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        {t("referral.statistics.pending")}
                      </p>
                    </div>
                    <p className="text-3xl font-bold text-warning">
                      {stats.pendingReferrals}
                    </p>
                  </div>

                  <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
                    <div className="flex items-center gap-2 mb-2">
                      <Coins className="h-4 w-4 text-primary" />
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        {t("referral.statistics.creditsEarned")}
                      </p>
                    </div>
                    <p className="text-3xl font-bold text-primary">
                      {stats.totalCreditsEarned}
                    </p>
                  </div>
                </div>

                {/* Additional Info */}
                <div className="mt-6 p-4 bg-muted/30 rounded-lg border border-border">
                  <div className="flex items-start gap-3">
                    <Gift className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-foreground mb-1">
                        {t("referral.howItWorks.title")}
                      </p>
                      <ul className="text-sm text-muted-foreground space-y-1">
                        <li className="flex items-start gap-2">
                          <span className="text-primary mt-0.5">•</span>
                          <span>{t("referral.howItWorks.step1")}</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-primary mt-0.5">•</span>
                          <span>{t("referral.howItWorks.step2")}</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-primary mt-0.5">•</span>
                          <span>{t("referral.howItWorks.step3")}</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-primary mt-0.5">•</span>
                          <span>{t("referral.howItWorks.step4")}</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Empty State (if no stats but has code) */}
          {referralCode && !stats && (
            <Card className="border border-border shadow-sm bg-card">
              <CardContent className="p-8 text-center">
                <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                <p className="text-base font-semibold text-foreground mb-2">
                  {t("referral.empty.title")}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t("referral.empty.description")}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default Referrals;

