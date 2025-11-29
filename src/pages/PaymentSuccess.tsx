import { useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, Sparkles, ArrowRight, PartyPopper } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const PaymentSuccess = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const shop = searchParams.get("shop");

  const handleRedirectToApp = () => {
    if (shop) {
      // Redirect to embedded app URL format
      const storeHandle = shop.replace(".myshopify.com", "");
      const appId = "f8de7972ae23d3484581d87137829385";
      const embeddedAppUrl = `https://admin.shopify.com/store/${storeHandle}/apps/${appId}?payment_success=true`;
      window.location.href = embeddedAppUrl;
    } else {
      // Fallback to home with payment_success parameter to trigger subscription refresh
      navigate("/?payment_success=true");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-primary/5 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="w-full max-w-2xl relative z-10">
        {/* Success Card */}
        <Card className="border-2 border-success/20 shadow-2xl bg-card/95 backdrop-blur-sm">
          <CardContent className="p-8 sm:p-12">
            {/* Animated Success Icon */}
            <div className="flex justify-center mb-6">
              <div className="relative">
                <div className="absolute inset-0 bg-success/20 rounded-full animate-ping" />
                <div className="relative bg-success/10 rounded-full p-4">
                  <CheckCircle2 className="w-16 h-16 sm:w-20 sm:h-20 text-success" />
                </div>
              </div>
            </div>

            {/* Success Message */}
            <div className="text-center space-y-4 mb-8">
              <div className="flex items-center justify-center gap-2 mb-2">
                <PartyPopper className="w-6 h-6 text-primary animate-bounce" />
                <h1 className="text-3xl sm:text-4xl font-bold text-foreground">
                  Félicitations !
                </h1>
                <Sparkles className="w-6 h-6 text-primary animate-pulse" />
              </div>

              <p className="text-xl sm:text-2xl font-semibold text-success">
                Paiement réussi
              </p>

              <p className="text-base sm:text-lg text-muted-foreground max-w-md mx-auto leading-relaxed">
                Votre abonnement a été activé avec succès. Vous pouvez
                maintenant profiter de toutes les fonctionnalités premium de
                l'application.
              </p>
            </div>

            {/* Features Highlight */}
            <div className="bg-primary/5 rounded-lg p-6 mb-8 border border-primary/10">
              <h2 className="text-lg font-semibold text-foreground mb-4 text-center">
                Ce qui vous attend maintenant :
              </h2>
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-muted-foreground">
                    Accès complet à toutes les fonctionnalités premium
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-muted-foreground">
                    Support prioritaire pour toutes vos questions
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-muted-foreground">
                    Mises à jour régulières et nouvelles fonctionnalités
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-muted-foreground">
                    Gestion de votre abonnement depuis votre admin Shopify
                  </span>
                </li>
              </ul>
            </div>

            {/* Action Button */}
            <div className="flex flex-col items-center gap-4">
              <Button
                onClick={handleRedirectToApp}
                size="lg"
                className="w-full sm:w-auto min-w-[200px] h-12 text-base font-semibold shadow-lg hover:shadow-xl transition-all"
              >
                <span>Continuer vers l'application</span>
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Decorative Elements */}
        <div className="absolute top-10 left-10 w-20 h-20 bg-primary/5 rounded-full blur-2xl -z-10" />
        <div className="absolute bottom-10 right-10 w-32 h-32 bg-success/5 rounded-full blur-3xl -z-10" />
      </div>
    </div>
  );
};

export default PaymentSuccess;
