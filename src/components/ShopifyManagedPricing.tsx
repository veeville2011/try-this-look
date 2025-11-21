/**
 * Shopify Managed Pricing UI Component
 * Embeds Shopify's native pricing interface directly in the dashboard
 * This provides a trusted, native Shopify experience for plan selection
 */

import { useEffect, useState, useRef } from "react";
import { useShop } from "@/providers/AppBridgeProvider";
import { getPlanSelectionUrl, redirectToPlanSelection } from "@/utils/managedPricing";
import { Loader2, AlertCircle, ExternalLink } from "lucide-react";
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

  useEffect(() => {
    // Get shop from App Bridge hook or URL params (fallback)
    const shopDomain =
      shop || new URLSearchParams(window.location.search).get("shop");

    if (!shopDomain) {
      setError("Shop parameter is required to load pricing");
      setLoading(false);
      return;
    }

    try {
      // Get the Shopify managed pricing URL
      const url = getPlanSelectionUrl(shopDomain);
      setPricingUrl(url);
      setLoading(false);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to load pricing";
      setError(errorMessage);
      setLoading(false);
      if (import.meta.env.DEV) {
        console.error("[ShopifyManagedPricing] Error:", err);
      }
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

  // If iframe is blocked, show fallback button
  if (iframeBlocked) {
    const shopDomain =
      shop || new URLSearchParams(window.location.search).get("shop");

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

        <Card className="border-2 border-border">
          <CardContent className="p-12 text-center">
            <div className="max-w-2xl mx-auto space-y-6">
              <div className="space-y-4">
                <h3 className="text-2xl font-bold text-foreground">
                  Shopify Managed Pricing
                </h3>
                <p className="text-muted-foreground">
                  Access Shopify's secure, native pricing interface to view and
                  select your plan. All billing is handled securely by Shopify.
                </p>
              </div>

              <Button
                size="lg"
                onClick={() => {
                  if (shopDomain) {
                    redirectToPlanSelection(shopDomain);
                  }
                }}
                className="mt-6"
              >
                <ExternalLink className="w-5 h-5 mr-2" />
                View Pricing Plans
              </Button>

              <p className="text-sm text-muted-foreground mt-4">
                Powered by Shopify's secure billing system
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

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

      {/* Embed Shopify's managed pricing UI */}
      <div className="w-full rounded-lg border-2 border-border overflow-hidden bg-card shadow-lg">
        <iframe
          ref={iframeRef}
          src={pricingUrl}
          className="w-full min-h-[800px] border-0"
          title="Shopify Pricing Plans"
          allow="payment"
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-top-navigation-by-user-activation"
          style={{
            minHeight: "800px",
            width: "100%",
          }}
          onLoad={() => {
            setLoading(false);
            // Check if iframe content loaded successfully
            try {
              // Try to access iframe content to detect X-Frame-Options blocking
              const iframe = iframeRef.current;
              if (iframe && iframe.contentWindow) {
                // If we can access contentWindow, the iframe loaded
                if (import.meta.env.DEV) {
                  console.log("[ShopifyManagedPricing] Iframe loaded successfully");
                }
              }
            } catch (e) {
              // Cross-origin restrictions - this is expected for Shopify admin pages
              // The iframe might still be loading, so we'll wait a bit
              setTimeout(() => {
                setLoading(false);
              }, 2000);
            }
          }}
          onError={() => {
            // Iframe failed to load - likely blocked by X-Frame-Options
            setIframeBlocked(true);
            setLoading(false);
            if (import.meta.env.DEV) {
              console.warn("[ShopifyManagedPricing] Iframe blocked, using fallback");
            }
          }}
        />
      </div>

      {/* Note about Shopify's native pricing */}
      <div className="mt-4 text-center">
        <p className="text-sm text-muted-foreground">
          Powered by Shopify's secure billing system
        </p>
      </div>
    </div>
  );
};

export default ShopifyManagedPricing;

