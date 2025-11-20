import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Sparkles, CheckCircle2 } from "lucide-react";

const Index = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted">
      {/* Hero Section */}
      <header className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent" />
        <div className="container mx-auto px-4 sm:px-6 md:px-8 py-12 sm:py-16 md:py-20 relative">
          <div className="max-w-4xl mx-auto text-center space-y-6 sm:space-y-7 md:space-y-8">
            <div className="flex items-center justify-center">
              <span
                className="inline-flex items-center font-extrabold tracking-wide text-3xl sm:text-4xl md:text-5xl leading-none"
                aria-label="NULOOK"
              >
                <span style={{ color: "#ce0003" }}>NU</span>
                <span style={{ color: "#564646" }}>LOOK</span>
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Benefits Section */}
      <section className="py-12 sm:py-16 md:py-20 bg-gradient-to-br from-muted/50 to-background">
        <div className="container mx-auto px-4 sm:px-6 md:px-8">
          <div className="text-center mb-10 sm:mb-12 md:mb-16">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-2 sm:mb-3 md:mb-4 text-foreground">
              Avantages pour votre boutique
            </h2>
            <p className="text-base sm:text-lg md:text-xl text-muted-foreground">
              Augmentez les ventes et réduisez les retours
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 gap-6 sm:gap-7 md:gap-8 max-w-4xl mx-auto">
            {[
              {
                icon: CheckCircle2,
                title: "Augmenter les conversions",
                description:
                  "Les clients qui voient comment les vêtements leur vont sont plus susceptibles d'acheter",
              },
              {
                icon: CheckCircle2,
                title: "Réduire les retours",
                description:
                  "Les clients savent exactement à quoi s'attendre, réduisant les retours",
              },
              {
                icon: CheckCircle2,
                title: "Expérience innovante",
                description:
                  "Offrez une expérience d'achat moderne qui distingue votre boutique",
              },
              {
                icon: CheckCircle2,
                title: "Installation facile",
                description:
                  "Intégration simple dans votre boutique Shopify existante",
              },
            ].map((benefit, index) => (
              <Card
                key={index}
                className="p-4 sm:p-5 md:p-6 hover:shadow-lg transition-shadow"
              >
                <div className="flex gap-3 sm:gap-4">
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-success/10 rounded flex items-center justify-center">
                      <benefit.icon className="w-5 h-5 sm:w-6 sm:h-6 text-success" />
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-lg sm:text-xl font-bold mb-1 sm:mb-2 text-foreground">
                      {benefit.title}
                    </h3>
                    <p className="text-sm sm:text-base text-muted-foreground">
                      {benefit.description}
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Installation Instructions */}
      <section className="py-12 sm:py-16 md:py-20 bg-card">
        <div className="container mx-auto px-4 sm:px-6 md:px-8 max-w-4xl">
          <div className="text-center mb-8 sm:mb-10 md:mb-12">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-2 sm:mb-3 md:mb-4">
              Installation pour les boutiques Shopify
            </h2>
            <p className="text-base sm:text-lg md:text-xl text-muted-foreground">
              Intégration facile dans votre boutique
            </p>
          </div>

          <Card className="p-4 sm:p-6 md:p-8">
            <CardHeader className="p-0 mb-4 sm:mb-5 md:mb-6">
              <CardTitle className="text-xl sm:text-2xl">
                Guide d'installation
              </CardTitle>
              <CardDescription className="text-sm sm:text-base mt-1 sm:mt-2">
                Suivez ces étapes simples pour intégrer l'application dans votre
                boutique
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 sm:space-y-5 md:space-y-6 p-0">
              <div className="space-y-3 sm:space-y-4">
                <div className="flex gap-3 sm:gap-4">
                  <div className="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 bg-primary text-primary-foreground rounded flex items-center justify-center font-bold text-sm sm:text-base shadow-sm">
                    1
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="font-semibold mb-1 sm:mb-2 text-sm sm:text-base text-foreground">
                      Intégrez le widget
                    </h4>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      Cette application peut être hébergée et intégrée via
                      iframe ou comme widget intégré dans votre boutique.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 sm:gap-4">
                  <div className="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 bg-primary text-primary-foreground rounded flex items-center justify-center font-bold text-sm sm:text-base shadow-sm">
                    2
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="font-semibold mb-1 sm:mb-2 text-sm sm:text-base text-foreground">
                      Mode développement
                    </h4>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      Pour tester en mode dev, utilisez les outils de
                      développement Shopify et pointez vers votre URL locale ou
                      de staging.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-info/10 border border-info rounded p-3 sm:p-4">
                <p className="text-xs sm:text-sm">
                  <strong>💡 Note :</strong> Pour une intégration complète,
                  contactez notre équipe de support qui vous aidera à configurer
                  l'application dans votre boutique Shopify.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-card border-t border-border py-8 sm:py-10 md:py-12">
        <div className="container mx-auto px-4 sm:px-6 md:px-8 text-center">
          <div className="flex items-center justify-center gap-2 sm:gap-3 mb-3 sm:mb-4">
            <Sparkles className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 flex-shrink-0 text-primary" />
            <h3 className="text-xl sm:text-2xl font-bold text-foreground">
              NULOOK
            </h3>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground/70">
            © {new Date().getFullYear()} NULOOK. Tous droits réservés.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
