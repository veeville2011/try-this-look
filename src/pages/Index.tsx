import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
  CheckCircle2,
  Store,
  ShoppingBag,
  Settings,
  Zap,
  ExternalLink,
  ArrowRight,
  Shield,
} from "lucide-react";

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
                aria-label="NusenseTryOn"
              >
                <span style={{ color: "#ce0003" }}>Nusense</span>
                <span style={{ color: "#564646" }}>TryOn</span>
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
      <section className="py-12 sm:py-16 md:py-20 bg-gradient-to-br from-card via-background to-muted/30">
        <div className="container mx-auto px-4 sm:px-6 md:px-8 max-w-5xl">
          <div className="text-center mb-10 sm:mb-12 md:mb-16">
            <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 bg-primary/10 rounded-full mb-4 sm:mb-6">
              <Settings className="w-8 h-8 sm:w-10 sm:h-10 text-primary" />
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-2 sm:mb-3 md:mb-4 text-foreground">
              Installation pour les boutiques Shopify
            </h2>
            <p className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
              Suivez ces étapes simples pour installer et activer NusenseTryOn
              dans votre boutique Shopify
            </p>
          </div>

          <div className="space-y-6 sm:space-y-8">
            {/* Installation Steps */}
            <Card className="p-6 sm:p-8 md:p-10 border-2 shadow-lg">
              <CardHeader className="p-0 mb-6 sm:mb-8">
                <CardTitle className="text-xl sm:text-2xl md:text-3xl flex items-center gap-3">
                  <Zap className="w-6 h-6 sm:w-7 sm:h-7 text-primary" />
                  Guide d'installation étape par étape
                </CardTitle>
                <CardDescription className="text-sm sm:text-base mt-2 sm:mt-3">
                  Installation rapide en quelques minutes
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0 space-y-6 sm:space-y-8">
                {/* Step 1 */}
                <div className="relative">
                  <div className="flex gap-4 sm:gap-6">
                    <div className="flex-shrink-0">
                      <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-primary to-primary-light text-primary-foreground rounded-lg flex items-center justify-center font-bold text-lg sm:text-xl shadow-md">
                        1
                      </div>
                    </div>
                    <div className="flex-1 min-w-0 pt-1">
                      <div className="flex items-start gap-3 mb-2">
                        <Store className="w-5 h-5 sm:w-6 sm:h-6 text-primary flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <h4 className="font-bold text-base sm:text-lg md:text-xl mb-2 text-foreground">
                            Accédez à votre Admin Shopify
                          </h4>
                          <p className="text-sm sm:text-base text-muted-foreground mb-3">
                            Connectez-vous à votre compte Shopify et accédez à
                            votre tableau de bord d'administration.
                          </p>
                          <div className="bg-muted/50 rounded-lg p-3 sm:p-4 border border-border">
                            <p className="text-xs sm:text-sm font-mono text-foreground">
                              https://votre-boutique.myshopify.com/admin
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="absolute left-6 sm:left-7 top-14 sm:top-16 bottom-0 w-0.5 bg-border -z-10" />
                </div>

                {/* Step 2 */}
                <div className="relative">
                  <div className="flex gap-4 sm:gap-6">
                    <div className="flex-shrink-0">
                      <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-primary to-primary-light text-primary-foreground rounded-lg flex items-center justify-center font-bold text-lg sm:text-xl shadow-md">
                        2
                      </div>
                    </div>
                    <div className="flex-1 min-w-0 pt-1">
                      <div className="flex items-start gap-3 mb-2">
                        <ShoppingBag className="w-5 h-5 sm:w-6 sm:h-6 text-primary flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <h4 className="font-bold text-base sm:text-lg md:text-xl mb-2 text-foreground">
                            Naviguez vers Apps
                          </h4>
                          <p className="text-sm sm:text-base text-muted-foreground mb-3">
                            Dans le menu latéral de votre admin, cliquez sur{" "}
                            <strong>"Apps"</strong> ou{" "}
                            <strong>"Applications"</strong>.
                          </p>
                          <div className="flex flex-wrap gap-2">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary rounded-md text-xs sm:text-sm font-medium">
                              <ArrowRight className="w-3 h-3" />
                              Apps → Recommandations
                            </span>
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary rounded-md text-xs sm:text-sm font-medium">
                              OU
                            </span>
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary rounded-md text-xs sm:text-sm font-medium">
                              Apps → Boutique d'applications
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="absolute left-6 sm:left-7 top-14 sm:top-16 bottom-0 w-0.5 bg-border -z-10" />
                </div>

                {/* Step 3 */}
                <div className="relative">
                  <div className="flex gap-4 sm:gap-6">
                    <div className="flex-shrink-0">
                      <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-primary to-primary-light text-primary-foreground rounded-lg flex items-center justify-center font-bold text-lg sm:text-xl shadow-md">
                        3
                      </div>
                    </div>
                    <div className="flex-1 min-w-0 pt-1">
                      <div className="flex items-start gap-3 mb-2">
                        <Zap className="w-5 h-5 sm:w-6 sm:h-6 text-primary flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <h4 className="font-bold text-base sm:text-lg md:text-xl mb-2 text-foreground">
                            Installez NusenseTryOn
                          </h4>
                          <p className="text-sm sm:text-base text-muted-foreground mb-3">
                            Recherchez <strong>"NusenseTryOn"</strong> dans la
                            boutique d'applications Shopify, puis cliquez sur{" "}
                            <strong>"Ajouter l'application"</strong>.
                          </p>
                          <div className="bg-success/10 border border-success/20 rounded-lg p-3 sm:p-4">
                            <p className="text-xs sm:text-sm text-success-foreground flex items-start gap-2">
                              <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0 mt-0.5" />
                              <span>
                                <strong>Alternative :</strong> Si l'application
                                vous a été partagée via le Partner Dashboard,
                                utilisez le lien d'installation fourni par votre
                                développeur.
                              </span>
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="absolute left-6 sm:left-7 top-14 sm:top-16 bottom-0 w-0.5 bg-border -z-10" />
                </div>

                {/* Step 4 */}
                <div className="relative">
                  <div className="flex gap-4 sm:gap-6">
                    <div className="flex-shrink-0">
                      <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-primary to-primary-light text-primary-foreground rounded-lg flex items-center justify-center font-bold text-lg sm:text-xl shadow-md">
                        4
                      </div>
                    </div>
                    <div className="flex-1 min-w-0 pt-1">
                      <div className="flex items-start gap-3 mb-2">
                        <Shield className="w-5 h-5 sm:w-6 sm:h-6 text-primary flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <h4 className="font-bold text-base sm:text-lg md:text-xl mb-2 text-foreground">
                            Autorisez les permissions
                          </h4>
                          <p className="text-sm sm:text-base text-muted-foreground mb-3">
                            Shopify vous demandera d'autoriser les permissions
                            suivantes. Cliquez sur <strong>"Installer"</strong>{" "}
                            pour continuer.
                          </p>
                          <div className="space-y-2">
                            {[
                              "Lire les produits",
                              "Modifier les produits",
                              "Lire les thèmes",
                              "Modifier les thèmes",
                            ].map((permission, idx) => (
                              <div
                                key={idx}
                                className="flex items-center gap-2 text-sm sm:text-base text-muted-foreground"
                              >
                                <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" />
                                <span>{permission}</span>
                              </div>
                            ))}
                          </div>
                          <div className="mt-3 bg-info/10 border border-info/20 rounded-lg p-3 sm:p-4">
                            <p className="text-xs sm:text-sm text-info-foreground">
                              <strong>ℹ️ Pourquoi ces permissions ?</strong> Ces
                              permissions sont nécessaires pour intégrer le
                              widget d'essayage virtuel dans vos pages produits
                              et personnaliser l'apparence selon votre thème.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="absolute left-6 sm:left-7 top-14 sm:top-16 bottom-0 w-0.5 bg-border -z-10" />
                </div>

                {/* Step 5 */}
                <div className="relative">
                  <div className="flex gap-4 sm:gap-6">
                    <div className="flex-shrink-0">
                      <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-primary to-primary-light text-primary-foreground rounded-lg flex items-center justify-center font-bold text-lg sm:text-xl shadow-md">
                        5
                      </div>
                    </div>
                    <div className="flex-1 min-w-0 pt-1">
                      <div className="flex items-start gap-3 mb-2">
                        <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6 text-success flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <h4 className="font-bold text-base sm:text-lg md:text-xl mb-2 text-foreground">
                            Configuration terminée
                          </h4>
                          <p className="text-sm sm:text-base text-muted-foreground mb-3">
                            Une fois l'installation terminée, vous serez
                            redirigé vers le tableau de bord de l'application.
                            L'extension de thème sera automatiquement déployée
                            dans votre boutique.
                          </p>
                          <div className="bg-success/10 border border-success/20 rounded-lg p-3 sm:p-4">
                            <p className="text-xs sm:text-sm text-success-foreground flex items-start gap-2">
                              <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0 mt-0.5" />
                              <span>
                                <strong>Félicitations !</strong> NusenseTryOn
                                est maintenant installé. Vous pouvez commencer à
                                utiliser la fonctionnalité d'essayage virtuel
                                sur vos pages produits.
                              </span>
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quick Install Button */}
            <Card className="p-6 sm:p-8 bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 border-2 border-primary/20">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-6">
                <div className="flex-1 text-center sm:text-left">
                  <h3 className="text-lg sm:text-xl font-bold mb-2 text-foreground">
                    Installation directe
                  </h3>
                  <p className="text-sm sm:text-base text-muted-foreground">
                    Vous avez déjà un compte Shopify ? Installez directement
                    depuis votre admin.
                  </p>
                </div>
                <Button
                  size="lg"
                  className="w-full sm:w-auto"
                  onClick={() => {
                    const shop = prompt(
                      "Entrez le nom de votre boutique (ex: votre-boutique)"
                    );
                    if (shop) {
                      const shopDomain = shop.includes(".myshopify.com")
                        ? shop
                        : `${shop}.myshopify.com`;
                      // Use the app's auth endpoint which handles OAuth flow
                      const authUrl = `${
                        window.location.origin
                      }/auth?shop=${encodeURIComponent(shopDomain)}`;
                      window.open(authUrl, "_blank");
                    }
                  }}
                >
                  <ExternalLink className="w-4 h-4 sm:w-5 sm:h-5" />
                  Installer maintenant
                </Button>
              </div>
            </Card>

            {/* Additional Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              <Card className="p-4 sm:p-6 border-l-4 border-l-info">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-info/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Settings className="w-5 h-5 sm:w-6 sm:h-6 text-info" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm sm:text-base mb-1 sm:mb-2 text-foreground">
                      Configuration du thème
                    </h4>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      L'extension de thème sera automatiquement ajoutée. Vous
                      pouvez personnaliser l'apparence du widget depuis
                      l'éditeur de thème Shopify.
                    </p>
                  </div>
                </div>
              </Card>

              <Card className="p-4 sm:p-6 border-l-4 border-l-success">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-success/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Shield className="w-5 h-5 sm:w-6 sm:h-6 text-success" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm sm:text-base mb-1 sm:mb-2 text-foreground">
                      Sécurité et confidentialité
                    </h4>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      Toutes les données sont stockées localement dans le
                      navigateur. Aucune information client n'est transmise à
                      nos serveurs.
                    </p>
                  </div>
                </div>
              </Card>
            </div>

            {/* Support Note */}
            <Card className="p-4 sm:p-6 bg-info/5 border-info/20">
              <div className="flex items-start gap-3 sm:gap-4">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-info/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-info" />
                </div>
                <div>
                  <h4 className="font-semibold text-sm sm:text-base mb-1 sm:mb-2 text-foreground">
                    Besoin d'aide ?
                  </h4>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    Si vous rencontrez des difficultés lors de l'installation ou
                    si vous avez des questions, n'hésitez pas à contacter notre
                    équipe de support. Nous sommes là pour vous aider à
                    configurer l'application dans votre boutique Shopify.
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-card border-t border-border py-8 sm:py-10 md:py-12">
        <div className="container mx-auto px-4 sm:px-6 md:px-8 text-center">
          <div className="flex items-center justify-center gap-2 sm:gap-3 mb-3 sm:mb-4">
            <Sparkles className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 flex-shrink-0 text-primary" />
            <h3 className="text-xl sm:text-2xl font-bold text-foreground">
              NusenseTryOn
            </h3>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground/70">
            © {new Date().getFullYear()} NusenseTryOn. Tous droits réservés.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
