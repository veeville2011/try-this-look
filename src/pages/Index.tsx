import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sparkles,
  CheckCircle2,
  Store,
  ShoppingBag,
  Settings,
  Zap,
  ArrowRight,
  Shield,
  Link2,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const Index = () => {
  // Deep linking configuration
  const API_KEY = "f8de7972ae23d3484581d87137829385"; // From shopify.app.toml client_id
  const APP_EMBED_HANDLE = "nusense-tryon-embed";
  const APP_BLOCK_HANDLE = "nusense-tryon-button";

  // Dialog state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [shopDomain, setShopDomain] = useState("");
  const [error, setError] = useState("");
  const [pendingAction, setPendingAction] = useState<{
    type: "embed" | "block";
    template: "product" | "index";
  } | null>(null);

  const handleDeepLinkClick = (
    type: "embed" | "block",
    template: "product" | "index" = "product"
  ) => {
    setPendingAction({ type, template });
    setShopDomain("");
    setError("");
    setIsDialogOpen(true);
  };

  const handleDialogSubmit = () => {
    if (!shopDomain || !shopDomain.trim()) {
      setError("Veuillez entrer le nom de votre boutique");
      return;
    }

    // Clean and format shop domain
    const cleanedDomain = shopDomain.trim().toLowerCase();

    // Basic validation
    if (cleanedDomain.length < 3) {
      setError("Le nom de la boutique doit contenir au moins 3 caractères");
      return;
    }

    // Remove invalid characters
    const sanitizedDomain = cleanedDomain.replace(/[^a-z0-9-]/g, "");
    if (sanitizedDomain !== cleanedDomain) {
      setError(
        "Le nom de la boutique ne peut contenir que des lettres, chiffres et tirets"
      );
      return;
    }

    const myshopifyDomain = cleanedDomain.includes(".myshopify.com")
      ? cleanedDomain
      : `${cleanedDomain}.myshopify.com`;

    if (!pendingAction) return;

    let deepLinkUrl = "";
    if (pendingAction.type === "embed") {
      // App embed block deep link - template is optional for embed blocks
      // Using index template as default since embed blocks work globally
      deepLinkUrl = `https://${myshopifyDomain}/admin/themes/current/editor?context=apps&template=index&activateAppId=${API_KEY}/${APP_EMBED_HANDLE}`;
    } else {
      // App block deep link - template specifies which page to add block to
      deepLinkUrl = `https://${myshopifyDomain}/admin/themes/current/editor?context=apps&template=${pendingAction.template}&addAppBlockId=${API_KEY}/${APP_BLOCK_HANDLE}`;
    }

    setIsDialogOpen(false);
    setShopDomain("");
    setError("");
    setPendingAction(null);
    window.open(deepLinkUrl, "_blank");
  };

  const handleDialogCancel = () => {
    setIsDialogOpen(false);
    setShopDomain("");
    setError("");
    setPendingAction(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleDialogSubmit();
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Custom Shop Domain Input Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px] bg-card border-2 border-border">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Store className="w-6 h-6 text-primary" aria-hidden="true" />
              Entrez votre boutique&nbsp;Shopify
            </DialogTitle>
            <DialogDescription className="text-base text-foreground/80 pt-2">
              Pour accéder directement à l'éditeur de thème, nous avons besoin
              du nom de votre boutique Shopify.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label
                htmlFor="shop-domain"
                className="text-sm font-semibold text-foreground"
              >
                Nom de la boutique
              </Label>
              <Input
                id="shop-domain"
                type="text"
                placeholder="votre-boutique"
                value={shopDomain}
                onChange={(e) => {
                  setShopDomain(e.target.value);
                  setError("");
                }}
                onKeyDown={handleKeyDown}
                className={`text-base ${
                  error
                    ? "border-error focus-visible:ring-error"
                    : "border-input focus-visible:ring-primary"
                }`}
                autoFocus
                aria-label="Nom de la boutique Shopify"
                aria-describedby={
                  error ? "shop-domain-error" : "shop-domain-help"
                }
                aria-invalid={!!error}
              />
              {error ? (
                <div
                  id="shop-domain-error"
                  className="flex items-center gap-2 text-sm text-error"
                  role="alert"
                >
                  <AlertCircle className="w-4 h-4" aria-hidden="true" />
                  <span>{error}</span>
                </div>
              ) : (
                <p id="shop-domain-help" className="text-sm text-foreground/70">
                  Exemple&nbsp;: votre-boutique (sans .myshopify.com)
                </p>
              )}
            </div>
            <div className="bg-info/15 border-2 border-info/30 rounded-lg p-3">
              <p className="text-sm text-foreground flex items-start gap-2">
                <CheckCircle2
                  className="w-4 h-4 text-info flex-shrink-0 mt-0.5"
                  aria-hidden="true"
                />
                <span>
                  Le format sera automatiquement ajusté en{" "}
                  <span className="font-mono font-semibold">
                    {shopDomain || "votre-boutique"}.myshopify.com
                  </span>
                </span>
              </p>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={handleDialogCancel}
              className="w-full sm:w-auto"
            >
              Annuler
            </Button>
            <Button
              type="button"
              onClick={handleDialogSubmit}
              className="w-full sm:w-auto"
              disabled={!shopDomain.trim()}
            >
              <Link2 className="w-4 h-4 mr-2" aria-hidden="true" />
              Continuer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Main Content */}
      {/* Hero Section */}
      <header className="relative overflow-hidden bg-card border-b border-border">
        <div className="container mx-auto px-4 sm:px-6 md:px-8 py-16 sm:py-20 md:py-24 relative">
          <div className="max-w-4xl mx-auto">
            <div className="flex flex-col items-center text-center">
              <div className="inline-flex flex-col items-center">
                <h1
                  className="inline-flex items-center font-extrabold tracking-tight text-4xl sm:text-5xl md:text-6xl lg:text-7xl leading-tight"
                  aria-label="NusenseTryOn"
                >
                  <span className="text-primary" style={{ color: "#ce0003" }}>
                    Nusense
                  </span>
                  <span
                    className="text-foreground"
                    style={{ color: "#564646" }}
                  >
                    TryOn
                  </span>
                </h1>
                <p className="text-lg sm:text-xl md:text-2xl text-foreground font-medium no-orphans text-center w-full">
                  Essayage virtuel pour&nbsp;Shopify
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Installation Instructions */}
      <section className="py-12 sm:py-16 md:py-20 lg:py-24 bg-background">
        <div className="container mx-auto px-4 sm:px-6 md:px-8 lg:px-12 max-w-6xl">
          <div className="space-y-8 sm:space-y-10 md:space-y-12">
            {/* Installation Steps */}
            <Card className="p-6 sm:p-8 md:p-10 lg:p-12 border-2 border-border bg-card shadow-lg">
              <CardHeader className="p-0 mb-8 sm:mb-10">
                <CardTitle className="text-2xl sm:text-3xl md:text-4xl flex items-center gap-3 sm:gap-4 text-foreground no-orphans">
                  <Zap
                    className="w-7 h-7 sm:w-8 sm:h-8 md:w-9 md:h-9 text-primary flex-shrink-0"
                    aria-hidden="true"
                  />
                  Guide d'installation étape&nbsp;par&nbsp;étape
                </CardTitle>
                <CardDescription className="text-base sm:text-lg md:text-xl mt-4 sm:mt-5 text-foreground/80 no-orphans">
                  Installation rapide en&nbsp;quelques&nbsp;minutes
                </CardDescription>
                <div className="mt-6 sm:mt-8 bg-info/15 border-2 border-info/30 rounded-lg p-4 sm:p-5">
                  <p className="text-sm sm:text-base text-foreground leading-relaxed no-orphans">
                    <strong className="font-bold text-foreground">
                      📦
                      Deux&nbsp;types&nbsp;de&nbsp;blocs&nbsp;disponibles&nbsp;:
                    </strong>{" "}
                    Ce guide couvre l'installation des{" "}
                    <strong className="font-bold text-foreground">
                      blocs&nbsp;d'intégration
                    </strong>{" "}
                    (tous les thèmes) et des{" "}
                    <strong className="font-bold text-foreground">
                      blocs&nbsp;d'application
                    </strong>{" "}
                    (thèmes Online Store 2.0 uniquement). Vous pouvez utiliser
                    l'un ou l'autre, ou les deux selon votre thème.
                  </p>
                </div>
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
                          <h3 className="font-bold text-lg sm:text-xl md:text-2xl mb-3 sm:mb-4 text-foreground no-orphans">
                            Installez&nbsp;NusenseTryOn
                          </h3>
                          <p className="text-base sm:text-lg text-foreground/90 mb-4 sm:mb-5 leading-relaxed no-orphans">
                            Dans votre admin Shopify, accédez à{" "}
                            <strong className="font-bold text-foreground">
                              Apps
                            </strong>{" "}
                            dans le menu latéral, puis cliquez sur{" "}
                            <strong className="font-bold text-foreground">
                              Boutique&nbsp;d'applications
                            </strong>
                            . Recherchez{" "}
                            <strong className="font-bold text-foreground">
                              "NusenseTryOn"
                            </strong>{" "}
                            et cliquez sur{" "}
                            <strong className="font-bold text-foreground">
                              "Ajouter&nbsp;l'application"
                            </strong>
                            .
                          </p>
                          <div className="bg-info/20 border-2 border-info/40 rounded-lg p-4 sm:p-5">
                            <p className="text-sm sm:text-base text-foreground leading-relaxed no-orphans">
                              <strong className="font-bold text-foreground">
                                ℹ️ Note&nbsp;:
                              </strong>{" "}
                              Autorisez les permissions demandées (lecture et
                              modification des produits et thèmes) pour que
                              l'application puisse fonctionner correctement.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="absolute left-7 sm:left-8 md:left-9 top-16 sm:top-20 md:top-24 bottom-0 w-1 bg-border/60 -z-10" />
                </div>

                {/* Step 2 - App Embed Block (All Themes) */}
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
                        <Settings
                          className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-primary flex-shrink-0 mt-1"
                          aria-hidden="true"
                        />
                        <div className="flex-1">
                          <h3 className="font-bold text-lg sm:text-xl md:text-2xl mb-3 sm:mb-4 text-foreground no-orphans">
                            Activez le bloc&nbsp;d'intégration
                            (Tous&nbsp;les&nbsp;thèmes)
                          </h3>
                          <p className="text-base sm:text-lg text-foreground/90 mb-4 sm:mb-5 leading-relaxed no-orphans">
                            Le bloc d'intégration fonctionne avec{" "}
                            <strong className="font-bold text-foreground">
                              tous&nbsp;les&nbsp;thèmes&nbsp;Shopify
                            </strong>
                            , y compris les thèmes vintage.
                          </p>
                          <div className="space-y-4 mb-4 sm:mb-5">
                            <div className="bg-muted rounded-lg p-4 sm:p-5 border-2 border-border">
                              <p className="text-sm sm:text-base font-semibold text-foreground mb-3 no-orphans">
                                Instructions&nbsp;:
                              </p>
                              <ol className="list-decimal list-inside space-y-2 text-sm sm:text-base text-foreground/90">
                                <li className="no-orphans">
                                  Accédez à{" "}
                                  <strong className="font-bold text-foreground">
                                    Boutique&nbsp;en&nbsp;ligne
                                  </strong>{" "}
                                  →{" "}
                                  <strong className="font-bold text-foreground">
                                    Thèmes
                                  </strong>
                                </li>
                                <li className="no-orphans">
                                  Cliquez sur{" "}
                                  <strong className="font-bold text-foreground">
                                    Personnaliser
                                  </strong>{" "}
                                  sur votre thème actif
                                </li>
                                <li className="no-orphans">
                                  Dans le panneau de gauche, ouvrez{" "}
                                  <strong className="font-bold text-foreground">
                                    Paramètres&nbsp;du&nbsp;thème
                                  </strong>
                                </li>
                                <li className="no-orphans">
                                  Faites défiler jusqu'à{" "}
                                  <strong className="font-bold text-foreground">
                                    Intégrations&nbsp;d'applications
                                  </strong>
                                </li>
                                <li className="no-orphans">
                                  Activez{" "}
                                  <strong className="font-bold text-foreground">
                                    "Widget&nbsp;NUSENSE&nbsp;Try-On"
                                  </strong>
                                </li>
                                <li className="no-orphans">
                                  Configurez les paramètres selon vos
                                  préférences (bouton d'en-tête, style, etc.)
                                </li>
                                <li className="no-orphans">
                                  Cliquez sur{" "}
                                  <strong className="font-bold text-foreground">
                                    Enregistrer
                                  </strong>
                                </li>
                              </ol>
                            </div>
                            <div className="bg-success/20 border-2 border-success/40 rounded-lg p-4 sm:p-5">
                              <p className="text-sm sm:text-base text-foreground flex items-start gap-3 leading-relaxed">
                                <CheckCircle2
                                  className="w-5 h-5 sm:w-6 sm:h-6 text-success flex-shrink-0 mt-0.5"
                                  aria-hidden="true"
                                />
                                <span className="no-orphans">
                                  <strong className="font-bold text-foreground">
                                    Compatibilité&nbsp;:
                                  </strong>{" "}
                                  Ce bloc fonctionne sur toutes les pages de
                                  votre boutique (accueil, produits,
                                  collections, etc.) et s'affiche
                                  automatiquement.
                                </span>
                              </p>
                            </div>
                            <div className="bg-primary/10 border-2 border-primary/30 rounded-lg p-4 sm:p-5">
                              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                <div className="flex-1">
                                  <p className="text-sm sm:text-base font-semibold text-foreground mb-2 no-orphans">
                                    🚀 Accès&nbsp;rapide&nbsp;:
                                  </p>
                                  <p className="text-sm sm:text-base text-foreground/90 no-orphans">
                                    Cliquez sur le bouton ci-dessous pour
                                    accéder directement à l'éditeur de thème
                                    avec ce bloc activé.
                                  </p>
                                </div>
                                <Button
                                  onClick={() =>
                                    handleDeepLinkClick("embed", "product")
                                  }
                                  className="w-full sm:w-auto whitespace-nowrap"
                                  size="sm"
                                >
                                  <Link2
                                    className="w-4 h-4 mr-2"
                                    aria-hidden="true"
                                  />
                                  Activer&nbsp;maintenant
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="absolute left-7 sm:left-8 md:left-9 top-16 sm:top-20 md:top-24 bottom-0 w-1 bg-border/60 -z-10" />
                </div>

                {/* Step 3 - App Block (Online Store 2.0 Only) */}
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
                          <h3 className="font-bold text-lg sm:text-xl md:text-2xl mb-3 sm:mb-4 text-foreground no-orphans">
                            Ajoutez le bloc&nbsp;d'application
                            (Thèmes&nbsp;Online&nbsp;Store&nbsp;2.0)
                          </h3>
                          <p className="text-base sm:text-lg text-foreground/90 mb-4 sm:mb-5 leading-relaxed no-orphans">
                            Si vous utilisez un{" "}
                            <strong className="font-bold text-foreground">
                              thème&nbsp;Online&nbsp;Store&nbsp;2.0
                            </strong>{" "}
                            (Dawn, Debut, etc.), vous pouvez ajouter un bloc
                            d'application personnalisable sur vos pages
                            produits.
                          </p>
                          <div className="space-y-4 mb-4 sm:mb-5">
                            <div className="bg-muted rounded-lg p-4 sm:p-5 border-2 border-border">
                              <p className="text-sm sm:text-base font-semibold text-foreground mb-3 no-orphans">
                                Instructions&nbsp;:
                              </p>
                              <ol className="list-decimal list-inside space-y-2 text-sm sm:text-base text-foreground/90">
                                <li className="no-orphans">
                                  Dans l'éditeur de thème, ouvrez une{" "}
                                  <strong className="font-bold text-foreground">
                                    page&nbsp;produit
                                  </strong>
                                </li>
                                <li className="no-orphans">
                                  Cliquez sur{" "}
                                  <strong className="font-bold text-foreground">
                                    Ajouter&nbsp;un&nbsp;bloc
                                  </strong>{" "}
                                  dans la section souhaitée
                                </li>
                                <li className="no-orphans">
                                  Dans la catégorie{" "}
                                  <strong className="font-bold text-foreground">
                                    Applications
                                  </strong>
                                  , sélectionnez{" "}
                                  <strong className="font-bold text-foreground">
                                    "NUSENSE&nbsp;Try-On&nbsp;Button"
                                  </strong>
                                </li>
                                <li className="no-orphans">
                                  Personnalisez le texte du bouton, le style et
                                  les autres paramètres
                                </li>
                                <li className="no-orphans">
                                  Réorganisez le bloc en le faisant glisser si
                                  nécessaire
                                </li>
                                <li className="no-orphans">
                                  Cliquez sur{" "}
                                  <strong className="font-bold text-foreground">
                                    Enregistrer
                                  </strong>
                                </li>
                              </ol>
                            </div>
                            <div className="bg-warning/20 border-2 border-warning/40 rounded-lg p-4 sm:p-5">
                              <p className="text-sm sm:text-base text-foreground flex items-start gap-3 leading-relaxed">
                                <Shield
                                  className="w-5 h-5 sm:w-6 sm:h-6 text-warning flex-shrink-0 mt-0.5"
                                  aria-hidden="true"
                                />
                                <span className="no-orphans">
                                  <strong className="font-bold text-foreground">
                                    Important&nbsp;:
                                  </strong>{" "}
                                  Les blocs d'application ne sont disponibles
                                  que dans les thèmes Online Store 2.0 (thèmes
                                  avec modèles JSON). Si vous utilisez un thème
                                  vintage, utilisez uniquement le bloc
                                  d'intégration (étape 2).
                                </span>
                              </p>
                            </div>
                            <div className="bg-primary/10 border-2 border-primary/30 rounded-lg p-4 sm:p-5">
                              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                <div className="flex-1">
                                  <p className="text-sm sm:text-base font-semibold text-foreground mb-2 no-orphans">
                                    🚀 Accès&nbsp;rapide&nbsp;:
                                  </p>
                                  <p className="text-sm sm:text-base text-foreground/90 no-orphans">
                                    Cliquez sur le bouton ci-dessous pour
                                    accéder directement à l'éditeur de thème et
                                    ajouter ce bloc sur une page produit.
                                  </p>
                                </div>
                                <Button
                                  onClick={() =>
                                    handleDeepLinkClick("block", "product")
                                  }
                                  className="w-full sm:w-auto whitespace-nowrap"
                                  size="sm"
                                >
                                  <Link2
                                    className="w-4 h-4 mr-2"
                                    aria-hidden="true"
                                  />
                                  Ajouter&nbsp;maintenant
                                </Button>
                              </div>
                            </div>
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
                        <CheckCircle2
                          className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-success flex-shrink-0 mt-1"
                          aria-hidden="true"
                        />
                        <div className="flex-1">
                          <h3 className="font-bold text-lg sm:text-xl md:text-2xl mb-3 sm:mb-4 text-foreground no-orphans">
                            Testez votre&nbsp;configuration
                          </h3>
                          <p className="text-base sm:text-lg text-foreground/90 mb-4 sm:mb-5 leading-relaxed no-orphans">
                            Visitez une page produit de votre boutique et
                            vérifiez que le bouton d'essayage virtuel apparaît
                            correctement. Cliquez sur le bouton pour tester la
                            fonctionnalité.
                          </p>
                          <div className="bg-success/25 border-2 border-success/50 rounded-lg p-4 sm:p-5">
                            <p className="text-sm sm:text-base text-foreground flex items-start gap-3 leading-relaxed">
                              <CheckCircle2
                                className="w-5 h-5 sm:w-6 sm:h-6 text-success flex-shrink-0 mt-0.5"
                                aria-hidden="true"
                              />
                              <span className="no-orphans">
                                <strong className="font-bold text-foreground">
                                  Félicitations&nbsp;!
                                </strong>{" "}
                                NusenseTryOn est maintenant configuré. Vos
                                clients peuvent utiliser la fonctionnalité
                                d'essayage virtuel directement sur vos
                                pages&nbsp;produits.
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
          <p className="text-sm sm:text-base md:text-lg text-foreground/80 no-orphans">
            © {new Date().getFullYear()} NusenseTryOn.
            Tous&nbsp;droits&nbsp;réservés.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
