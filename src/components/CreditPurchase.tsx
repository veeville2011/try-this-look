import { useState, useEffect } from "react";
import { useShop } from "@/providers/AppBridgeProvider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CreditCard, Sparkles, Check } from "lucide-react";
import { toast } from "sonner";
import { CouponRedemption } from "./CouponRedemption";

interface CreditPackage {
  id: string;
  name: string;
  credits: number;
  price: number;
  currencyCode: string;
  valuePerCredit: number;
  recommended: boolean;
  description: string;
}

export const CreditPurchase = () => {
  const shop = useShop();
  const [packages, setPackages] = useState<CreditPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null);
  const [couponCode, setCouponCode] = useState("");
  const [purchasing, setPurchasing] = useState(false);

  useEffect(() => {
    const fetchPackages = async () => {
      try {
        const response = await fetch("/api/credits/packages");
        if (!response.ok) throw new Error("Failed to fetch packages");
        
        const data = await response.json();
        setPackages(data.packages || []);
        
        // Select recommended package by default
        const recommended = data.packages?.find((pkg: CreditPackage) => pkg.recommended);
        if (recommended) {
          setSelectedPackage(recommended.id);
        }
      } catch (error) {
        console.error("[CreditPurchase] Error fetching packages:", error);
        toast.error("Failed to load credit packages");
      } finally {
        setLoading(false);
      }
    };

    fetchPackages();
  }, []);

  const handlePurchase = async () => {
    if (!selectedPackage || !shop) {
      toast.error("Please select a package");
      return;
    }

    setPurchasing(true);

    try {
      const response = await fetch("/api/credits/purchase", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          shop,
          packageId: selectedPackage,
          couponCode: couponCode || null,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create purchase");
      }

      const data = await response.json();
      
      // Redirect to Shopify confirmation page
      if (data.confirmationUrl) {
        window.location.href = data.confirmationUrl;
      } else {
        toast.success("Purchase initiated successfully");
      }
    } catch (error) {
      console.error("[CreditPurchase] Purchase error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to initiate purchase");
    } finally {
      setPurchasing(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Purchase Credits</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">Loading packages...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Purchase Credits
        </CardTitle>
        <CardDescription>
          Buy additional credits to continue using try-on generation
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <CouponRedemption onRedeemed={() => {}} />

        <div className="space-y-3">
          <Label>Select Package</Label>
          <div className="grid gap-3">
            {packages.map((pkg) => (
              <div
                key={pkg.id}
                className={`relative border rounded-lg p-4 cursor-pointer transition-all ${
                  selectedPackage === pkg.id
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                }`}
                onClick={() => setSelectedPackage(pkg.id)}
              >
                {pkg.recommended && (
                  <Badge className="absolute top-2 right-2" variant="default">
                    <Sparkles className="h-3 w-3 mr-1" />
                    Best Value
                  </Badge>
                )}
                
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{pkg.name}</h3>
                      {selectedPackage === pkg.id && (
                        <Check className="h-4 w-4 text-primary" />
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{pkg.description}</p>
                    <p className="text-xs text-muted-foreground">
                      ${pkg.valuePerCredit.toFixed(2)} per credit
                    </p>
                  </div>
                  
                  <div className="text-right">
                    <div className="text-2xl font-bold">
                      ${pkg.price.toFixed(2)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {pkg.credits} credits
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <Button
          onClick={handlePurchase}
          disabled={!selectedPackage || purchasing}
          className="w-full"
          size="lg"
        >
          {purchasing ? "Processing..." : "Purchase Credits"}
        </Button>
      </CardContent>
    </Card>
  );
};

