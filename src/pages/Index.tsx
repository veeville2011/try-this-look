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
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <header className="relative overflow-hidden bg-card border-b border-border">
        <div className="container mx-auto px-4 sm:px-6 md:px-8 py-16 sm:py-20 md:py-24 relative">
          <div className="max-w-4xl mx-auto text-center space-y-6 sm:space-y-8">
            <div className="flex items-center justify-center">
              <h1
                className="inline-flex items-center font-extrabold tracking-tight text-4xl sm:text-5xl md:text-6xl lg:text-7xl leading-tight"
                aria-label="NusenseTryOn"
              >
                <span className="text-primary" style={{ color: "#ce0003" }}>
                  Nusense
                </span>
                <span className="text-foreground" style={{ color: "#564646" }}>
                  TryOn
                </span>
              </h1>
            </div>
            <p className="text-lg sm:text-xl md:text-2xl text-foreground font-medium max-w-2xl mx-auto">
              Application d'essayage virtuel pour votre boutique Shopify
            </p>
          </div>
        </div>
      </header>

      {/* Installation Instructions */}
      <section className="py-12 sm:py-16 md:py-20 lg:py-24 bg-background">
        <div className="container mx-auto px-4 sm:px-6 md:px-8 lg:px-12 max-w-6xl">
          <div className="text-center mb-12 sm:mb-16 md:mb-20">
            <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 bg-primary/15 rounded-full mb-6 sm:mb-8 border-2 border-primary/20">
              <Settings
                className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 text-primary"
                aria-hidden="true"
              />
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-4 sm:mb-6 text-foreground">
              Installation pour les boutiques Shopify
            </h2>
            <p className="text-lg sm:text-xl md:text-2xl text-foreground/90 max-w-3xl mx-auto font-normal leading-relaxed">
              Suivez ces étapes simples pour installer et activer NusenseTryOn
              dans votre boutique Shopify
            </p>
          </div>

          <div className="space-y-8 sm:space-y-10 md:space-y-12">
            {/* Installation Steps */}
            <Card className="p-6 sm:p-8 md:p-10 lg:p-12 border-2 border-border bg-card shadow-lg">
              <CardHeader className="p-0 mb-8 sm:mb-10">
                <CardTitle className="text-2xl sm:text-3xl md:text-4xl flex items-center gap-3 sm:gap-4 text-foreground">
                  <Zap
                    className="w-7 h-7 sm:w-8 sm:h-8 md:w-9 md:h-9 text-primary flex-shrink-0"
                    aria-hidden="true"
                  />
                  Guide d'installation étape par étape
                </CardTitle>
                <CardDescription className="text-base sm:text-lg md:text-xl mt-4 sm:mt-5 text-foreground/80">
                  Installation rapide en quelques minutes
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0 space-y-8 sm:space-y-10 md:space-y-12">
                {/* Step 1 */}
                <div className="relative">
                  <div className="flex gap-5 sm:gap-6 md:gap-8">
                    <div className="flex-shrink-0">
                      <div
                        className="w-14 h-14 sm:w-16 sm:h-16 md:w-20 md:h-20 bg-primary text-primary-foreground rounded-xl flex items-center justify-center font-bold text-xl sm:text-2xl md:text-3xl shadow-lg ring-2 ring-primary/20"
                        aria-label="Étape 1"
                      >
                        1
                      </div>
                    </div>
                    <div className="flex-1 min-w-0 pt-1">
                      <div className="flex items-start gap-4 mb-3">
                        <Store
                          className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-primary flex-shrink-0 mt-1"
                          aria-hidden="true"
                        />
                        <div className="flex-1">
                          <h3 className="font-bold text-lg sm:text-xl md:text-2xl mb-3 sm:mb-4 text-foreground">
                            Accédez à votre Admin Shopify
                          </h3>
                          <p className="text-base sm:text-lg text-foreground/90 mb-4 sm:mb-5 leading-relaxed">
                            Connectez-vous à votre compte Shopify et accédez à
                            votre tableau de bord d'administration.
                          </p>
                          <div className="bg-muted rounded-lg p-4 sm:p-5 border-2 border-border">
                            <p className="text-sm sm:text-base font-mono text-foreground break-all">
                              https://votre-boutique.myshopify.com/admin
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="absolute left-7 sm:left-8 md:left-9 top-16 sm:top-20 md:top-24 bottom-0 w-1 bg-border/60 -z-10" />
                </div>

                {/* Step 2 */}
                <div className="relative">
                  <div className="flex gap-5 sm:gap-6 md:gap-8">
                    <div className="flex-shrink-0">
                      <div
                        className="w-14 h-14 sm:w-16 sm:h-16 md:w-20 md:h-20 bg-primary text-primary-foreground rounded-xl flex items-center justify-center font-bold text-xl sm:text-2xl md:text-3xl shadow-lg ring-2 ring-primary/20"
                        aria-label="Étape 2"
                      >
                        2
                      </div>
                    </div>
                    <div className="flex-1 min-w-0 pt-1">
                      <div className="flex items-start gap-4 mb-3">
                        <ShoppingBag
                          className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-primary flex-shrink-0 mt-1"
                          aria-hidden="true"
                        />
                        <div className="flex-1">
                          <h3 className="font-bold text-lg sm:text-xl md:text-2xl mb-3 sm:mb-4 text-foreground">
                            Naviguez vers Apps
                          </h3>
                          <p className="text-base sm:text-lg text-foreground/90 mb-4 sm:mb-5 leading-relaxed">
                            Dans le menu latéral de votre admin, cliquez sur{" "}
                            <strong className="font-bold text-foreground">
                              "Apps"
                            </strong>{" "}
                            ou{" "}
                            <strong className="font-bold text-foreground">
                              "Applications"
                            </strong>
                            .
                          </p>
                          <div className="flex flex-wrap gap-3">
                            <span className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary/15 text-primary rounded-lg text-sm sm:text-base font-semibold border border-primary/20">
                              <ArrowRight
                                className="w-4 h-4"
                                aria-hidden="true"
                              />
                              Apps → Recommandations
                            </span>
                            <span className="inline-flex items-center px-4 py-2.5 bg-muted text-foreground/80 rounded-lg text-sm sm:text-base font-medium">
                              OU
                            </span>
                            <span className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary/15 text-primary rounded-lg text-sm sm:text-base font-semibold border border-primary/20">
                              Apps → Boutique d'applications
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="absolute left-7 sm:left-8 md:left-9 top-16 sm:top-20 md:top-24 bottom-0 w-1 bg-border/60 -z-10" />
                </div>

                {/* Step 3 */}
                <div className="relative">
                  <div className="flex gap-5 sm:gap-6 md:gap-8">
                    <div className="flex-shrink-0">
                      <div
                        className="w-14 h-14 sm:w-16 sm:h-16 md:w-20 md:h-20 bg-primary text-primary-foreground rounded-xl flex items-center justify-center font-bold text-xl sm:text-2xl md:text-3xl shadow-lg ring-2 ring-primary/20"
                        aria-label="Étape 3"
                      >
                        3
                      </div>
                    </div>
                    <div className="flex-1 min-w-0 pt-1">
                      <div className="flex items-start gap-4 mb-3">
                        <Zap
                          className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-primary flex-shrink-0 mt-1"
                          aria-hidden="true"
                        />
                        <div className="flex-1">
                          <h3 className="font-bold text-lg sm:text-xl md:text-2xl mb-3 sm:mb-4 text-foreground">
                            Installez NusenseTryOn
                          </h3>
                          <p className="text-base sm:text-lg text-foreground/90 mb-4 sm:mb-5 leading-relaxed">
                            Recherchez{" "}
                            <strong className="font-bold text-foreground">
                              "NusenseTryOn"
                            </strong>{" "}
                            dans la boutique d'applications Shopify, puis
                            cliquez sur{" "}
                            <strong className="font-bold text-foreground">
                              "Ajouter l'application"
                            </strong>
                            .
                          </p>
                          <div className="bg-success/20 border-2 border-success/40 rounded-lg p-4 sm:p-5">
                            <p className="text-sm sm:text-base text-foreground flex items-start gap-3 leading-relaxed">
                              <CheckCircle2
                                className="w-5 h-5 sm:w-6 sm:h-6 text-success flex-shrink-0 mt-0.5"
                                aria-hidden="true"
                              />
                              <span>
                                <strong className="font-bold text-foreground">
                                  Alternative :
                                </strong>{" "}
                                Si l'application vous a été partagée via le
                                Partner Dashboard, utilisez le lien
                                d'installation fourni par votre développeur.
                              </span>
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="absolute left-7 sm:left-8 md:left-9 top-16 sm:top-20 md:top-24 bottom-0 w-1 bg-border/60 -z-10" />
                </div>

                {/* Step 4 */}
                <div className="relative">
                  <div className="flex gap-5 sm:gap-6 md:gap-8">
                    <div className="flex-shrink-0">
                      <div
                        className="w-14 h-14 sm:w-16 sm:h-16 md:w-20 md:h-20 bg-primary text-primary-foreground rounded-xl flex items-center justify-center font-bold text-xl sm:text-2xl md:text-3xl shadow-lg ring-2 ring-primary/20"
                        aria-label="Étape 4"
                      >
                        4
                      </div>
                    </div>
                    <div className="flex-1 min-w-0 pt-1">
                      <div className="flex items-start gap-4 mb-3">
                        <Shield
                          className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-primary flex-shrink-0 mt-1"
                          aria-hidden="true"
                        />
                        <div className="flex-1">
                          <h3 className="font-bold text-lg sm:text-xl md:text-2xl mb-3 sm:mb-4 text-foreground">
                            Autorisez les permissions
                          </h3>
                          <p className="text-base sm:text-lg text-foreground/90 mb-4 sm:mb-5 leading-relaxed">
                            Shopify vous demandera d'autoriser les permissions
                            suivantes. Cliquez sur{" "}
                            <strong className="font-bold text-foreground">
                              "Installer"
                            </strong>{" "}
                            pour continuer.
                          </p>
                          <div className="space-y-3 mb-4 sm:mb-5">
                            {[
                              "Lire les produits",
                              "Modifier les produits",
                              "Lire les thèmes",
                              "Modifier les thèmes",
                            ].map((permission, idx) => (
                              <div
                                key={idx}
                                className="flex items-center gap-3 text-base sm:text-lg text-foreground"
                              >
                                <CheckCircle2
                                  className="w-5 h-5 sm:w-6 sm:h-6 text-success flex-shrink-0"
                                  aria-hidden="true"
                                />
                                <span className="font-medium">
                                  {permission}
                                </span>
                              </div>
                            ))}
                          </div>
                          <div className="bg-info/20 border-2 border-info/40 rounded-lg p-4 sm:p-5">
                            <p className="text-sm sm:text-base text-foreground leading-relaxed">
                              <strong className="font-bold text-foreground">
                                ℹ️ Pourquoi ces permissions ?
                              </strong>{" "}
                              Ces permissions sont nécessaires pour intégrer le
                              widget d'essayage virtuel dans vos pages produits
                              et personnaliser l'apparence selon votre thème.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="absolute left-7 sm:left-8 md:left-9 top-16 sm:top-20 md:top-24 bottom-0 w-1 bg-border/60 -z-10" />
                </div>

                {/* Step 5 */}
                <div className="relative">
                  <div className="flex gap-5 sm:gap-6 md:gap-8">
                    <div className="flex-shrink-0">
                      <div
                        className="w-14 h-14 sm:w-16 sm:h-16 md:w-20 md:h-20 bg-primary text-primary-foreground rounded-xl flex items-center justify-center font-bold text-xl sm:text-2xl md:text-3xl shadow-lg ring-2 ring-primary/20"
                        aria-label="Étape 5"
                      >
                        5
                      </div>
                    </div>
                    <div className="flex-1 min-w-0 pt-1">
                      <div className="flex items-start gap-4 mb-3">
                        <CheckCircle2
                          className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-success flex-shrink-0 mt-1"
                          aria-hidden="true"
                        />
                        <div className="flex-1">
                          <h3 className="font-bold text-lg sm:text-xl md:text-2xl mb-3 sm:mb-4 text-foreground">
                            Configuration terminée
                          </h3>
                          <p className="text-base sm:text-lg text-foreground/90 mb-4 sm:mb-5 leading-relaxed">
                            Une fois l'installation terminée, vous serez
                            redirigé vers le tableau de bord de l'application.
                            L'extension de thème sera automatiquement déployée
                            dans votre boutique.
                          </p>
                          <div className="bg-success/25 border-2 border-success/50 rounded-lg p-4 sm:p-5">
                            <p className="text-sm sm:text-base text-foreground flex items-start gap-3 leading-relaxed">
                              <CheckCircle2
                                className="w-5 h-5 sm:w-6 sm:h-6 text-success flex-shrink-0 mt-0.5"
                                aria-hidden="true"
                              />
                              <span>
                                <strong className="font-bold text-foreground">
                                  Félicitations !
                                </strong>{" "}
                                NusenseTryOn est maintenant installé. Vous
                                pouvez commencer à utiliser la fonctionnalité
                                d'essayage virtuel sur vos pages produits.
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
            <Card className="p-6 sm:p-8 md:p-10 bg-primary/10 border-2 border-primary/30 shadow-lg">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-6 sm:gap-8">
                <div className="flex-1 text-center sm:text-left">
                  <h3 className="text-xl sm:text-2xl md:text-3xl font-bold mb-3 sm:mb-4 text-foreground">
                    Installation directe
                  </h3>
                  <p className="text-base sm:text-lg text-foreground/90 leading-relaxed">
                    Vous avez déjà un compte Shopify ? Installez directement
                    depuis votre admin.
                  </p>
                </div>
                <Button
                  size="lg"
                  className="w-full sm:w-auto min-w-[200px] text-base sm:text-lg px-6 sm:px-8 py-6 sm:py-7 focus-visible:ring-4 focus-visible:ring-primary/50"
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
                  aria-label="Installer NusenseTryOn maintenant"
                >
                  <ExternalLink
                    className="w-5 h-5 sm:w-6 sm:h-6"
                    aria-hidden="true"
                  />
                  Installer maintenant
                </Button>
              </div>
            </Card>

            {/* Additional Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
              <Card className="p-6 sm:p-8 border-l-4 border-l-info bg-card shadow-md">
                <div className="flex items-start gap-4 sm:gap-5">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 bg-info/20 rounded-xl flex items-center justify-center flex-shrink-0 border-2 border-info/30">
                    <Settings
                      className="w-6 h-6 sm:w-7 sm:h-7 text-info"
                      aria-hidden="true"
                    />
                  </div>
                  <div>
                    <h4 className="font-bold text-lg sm:text-xl mb-3 sm:mb-4 text-foreground">
                      Configuration du thème
                    </h4>
                    <p className="text-base sm:text-lg text-foreground/90 leading-relaxed">
                      L'extension de thème sera automatiquement ajoutée. Vous
                      pouvez personnaliser l'apparence du widget depuis
                      l'éditeur de thème Shopify.
                    </p>
                  </div>
                </div>
              </Card>

              <Card className="p-6 sm:p-8 border-l-4 border-l-success bg-card shadow-md">
                <div className="flex items-start gap-4 sm:gap-5">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 bg-success/20 rounded-xl flex items-center justify-center flex-shrink-0 border-2 border-success/30">
                    <Shield
                      className="w-6 h-6 sm:w-7 sm:h-7 text-success"
                      aria-hidden="true"
                    />
                  </div>
                  <div>
                    <h4 className="font-bold text-lg sm:text-xl mb-3 sm:mb-4 text-foreground">
                      Sécurité et confidentialité
                    </h4>
                    <p className="text-base sm:text-lg text-foreground/90 leading-relaxed">
                      Toutes les données sont stockées localement dans le
                      navigateur. Aucune information client n'est transmise à
                      nos serveurs.
                    </p>
                  </div>
                </div>
              </Card>
            </div>

            {/* Support Note */}
            <Card className="p-6 sm:p-8 md:p-10 bg-info/15 border-2 border-info/30 shadow-md">
              <div className="flex items-start gap-4 sm:gap-5 md:gap-6">
                <div className="w-12 h-12 sm:w-14 sm:h-14 bg-info/25 rounded-xl flex items-center justify-center flex-shrink-0 border-2 border-info/40">
                  <Sparkles
                    className="w-6 h-6 sm:w-7 sm:h-7 text-info"
                    aria-hidden="true"
                  />
                </div>
                <div>
                  <h4 className="font-bold text-lg sm:text-xl md:text-2xl mb-3 sm:mb-4 text-foreground">
                    Besoin d'aide ?
                  </h4>
                  <p className="text-base sm:text-lg text-foreground/90 leading-relaxed">
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
      <footer className="bg-card border-t-2 border-border py-10 sm:py-12 md:py-16">
        <div className="container mx-auto px-4 sm:px-6 md:px-8 text-center">
          <div className="flex items-center justify-center gap-3 sm:gap-4 mb-4 sm:mb-6">
            <Sparkles
              className="w-7 h-7 sm:w-8 sm:h-8 md:w-9 md:h-9 flex-shrink-0 text-primary"
              aria-hidden="true"
            />
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground">
              NusenseTryOn
            </h2>
          </div>
          <p className="text-sm sm:text-base md:text-lg text-foreground/80">
            © {new Date().getFullYear()} NusenseTryOn. Tous droits réservés.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
