/**
 * Shopify Managed Pricing UI Component
 * Embeds Shopify's native pricing interface directly in the dashboard
 * This provides a trusted, native Shopify experience for plan selection
 */

import { useEffect, useState, useRef } from "react";
import { useShop } from "@/providers/AppBridgeProvider";
import { getPlanSelectionUrl, redirectToPlanSelection } from "@/utils/managedPricing";
import { Loader2, AlertCircle, ExternalLink, CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface ShopifyManagedPricingProps {
  className?: string;
}

const ShopifyManagedPricing = ({ className = "" }: ShopifyManagedPricingProps) => {
  const shop = useShop();
  const [pricingUrl, setPricingUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [iframeBlocked, setIframeBlocked] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Debug: Log component render
  useEffect(() => {
    console.log("[ShopifyManagedPricing] Component rendered - Shopify Managed Pricing UI");
  }, []);

  useEffect(() => {
    console.log("[ShopifyManagedPricing] Component mounted/updated", { shop });
    
    // Get shop from App Bridge hook or URL params (fallback)
    const shopDomain =
      shop || new URLSearchParams(window.location.search).get("shop");

    console.log("[ShopifyManagedPricing] Shop domain extracted", { shopDomain, shop });

    if (!shopDomain) {
      console.warn("[ShopifyManagedPricing] No shop domain found");
      setError("Shop parameter is required to load pricing");
      setLoading(false);
      return;
    }

    try {
      // Get the Shopify managed pricing URL
      const url = getPlanSelectionUrl(shopDomain);
      console.log("[ShopifyManagedPricing] Pricing URL generated", { url });
      setPricingUrl(url);
      setLoading(false);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to load pricing";
      console.error("[ShopifyManagedPricing] Error generating URL:", err);
      setError(errorMessage);
      setLoading(false);
    }
  }, [shop]);

  // Handle messages from the iframe (for potential future communication)
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Only accept messages from Shopify domains
      if (
        event.origin.includes("admin.shopify.com") ||
        event.origin.includes("myshopify.com")
      ) {
        // Handle messages from Shopify pricing page if needed
        if (import.meta.env.DEV) {
          console.log("[ShopifyManagedPricing] Message from iframe:", event.data);
        }
      }
    };

    window.addEventListener("message", handleMessage);
    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, []);

  if (loading) {
    return (
      <div className={`flex flex-col items-center justify-center py-16 ${className}`}>
        <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Loading pricing plans...</p>
      </div>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="flex items-center gap-3 text-destructive">
            <AlertCircle className="w-5 h-5" />
            <div>
              <p className="font-semibold">Failed to load pricing</p>
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!pricingUrl) {
    return null;
  }

  // Get shop domain for the button
  const shopDomain =
    shop || new URLSearchParams(window.location.search).get("shop");

  // Always show the button-based UI since Shopify admin pages block iframe embedding
  // This provides a better, more reliable user experience
  return (
    <div className={`w-full ${className}`}>
      <div className="mb-6 text-center">
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4 text-foreground">
          Choose Your Plan
        </h2>
        <p className="text-lg sm:text-xl text-muted-foreground">
          Select the perfect plan for your store
        </p>
      </div>

      <Card className="border-2 border-border shadow-lg">
        <CardContent className="p-8 sm:p-12 text-center">
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="space-y-4">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
                <ExternalLink className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-2xl sm:text-3xl font-bold text-foreground">
                Shopify Managed Pricing
              </h3>
              <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto">
                Access Shopify's secure, native pricing interface to view and
                select your plan. All billing is handled securely by Shopify's
                trusted payment system.
              </p>
            </div>

            <div className="pt-4">
              <Button
                size="lg"
                onClick={() => {
                  if (shopDomain) {
                    console.log("[ShopifyManagedPricing] Redirecting to Shopify pricing", {
                      shopDomain,
                    });
                    redirectToPlanSelection(shopDomain);
                  } else {
                    console.error("[ShopifyManagedPricing] No shop domain available");
                    setError("Shop parameter is required");
                  }
                }}
                className="px-8 py-6 text-lg font-semibold"
                disabled={!shopDomain}
              >
                <ExternalLink className="w-5 h-5 mr-2" />
                View Pricing Plans
              </Button>
            </div>

            <div className="pt-6 border-t border-border">
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-success" />
                  <span>Secure billing by Shopify</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-success" />
                  <span>Native Shopify interface</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-success" />
                  <span>Trusted payment processing</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ShopifyManagedPricing;

