import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";

const Index = () => {
  // Deep linking configuration
  const API_KEY = "f8de7972ae23d3484581d87137829385"; // From shopify.app.toml client_id
  const APP_EMBED_HANDLE = "nusense-tryon-embed";
  const APP_BLOCK_HANDLE = "nusense-tryon-button";

  const handleDeepLink = (
    type: "embed" | "block",
    template: "product" | "index" = "product"
  ) => {
    const shopDomain = prompt(
      "Enter your Shopify store name (e.g., your-store)"
    );
    if (!shopDomain || !shopDomain.trim()) return;

    // Clean and format shop domain
    const cleanedDomain = shopDomain.trim().toLowerCase();
    const myshopifyDomain = cleanedDomain.includes(".myshopify.com")
      ? cleanedDomain
      : `${cleanedDomain}.myshopify.com`;

    let deepLinkUrl = "";
    if (type === "embed") {
      // App embed block deep link - template is optional for embed blocks
      // Using index template as default since embed blocks work globally
      deepLinkUrl = `https://${myshopifyDomain}/admin/themes/current/editor?context=apps&template=index&activateAppId=${API_KEY}/${APP_EMBED_HANDLE}`;
    } else {
      // App block deep link - template specifies which page to add block to
      deepLinkUrl = `https://${myshopifyDomain}/admin/themes/current/editor?context=apps&template=${template}&addAppBlockId=${API_KEY}/${APP_BLOCK_HANDLE}`;
    }

    window.open(deepLinkUrl, "_blank");
  };

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
            <p className="text-lg sm:text-xl md:text-2xl text-foreground font-medium max-w-2xl mx-auto no-orphans">
              Virtual try-on application for your&nbsp;Shopify&nbsp;store
            </p>
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
                  Step-by-Step Installation Guide
                </CardTitle>
                <CardDescription className="text-base sm:text-lg md:text-xl mt-4 sm:mt-5 text-foreground/80 no-orphans">
                  Quick installation in&nbsp;a&nbsp;few&nbsp;minutes
                </CardDescription>
                <div className="mt-6 sm:mt-8 bg-info/15 border-2 border-info/30 rounded-lg p-4 sm:p-5">
                  <p className="text-sm sm:text-base text-foreground leading-relaxed no-orphans">
                    <strong className="font-bold text-foreground">
                      📦
                      Two&nbsp;types&nbsp;of&nbsp;blocks&nbsp;available&nbsp;:
                    </strong>{" "}
                    This guide covers the installation of{" "}
                    <strong className="font-bold text-foreground">
                      app&nbsp;embed&nbsp;blocks
                    </strong>{" "}
                    (all themes) and{" "}
                    <strong className="font-bold text-foreground">
                      app&nbsp;blocks
                    </strong>{" "}
                    (Online Store 2.0 themes only). You can use one or the
                    other, or both depending on your theme.
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
                        aria-label="Step 1"
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
                            Install&nbsp;NusenseTryOn
                          </h3>
                          <p className="text-base sm:text-lg text-foreground/90 mb-4 sm:mb-5 leading-relaxed no-orphans">
                            In your Shopify admin, navigate to{" "}
                            <strong className="font-bold text-foreground">
                              Apps
                            </strong>{" "}
                            in the sidebar menu, then click on{" "}
                            <strong className="font-bold text-foreground">
                              App&nbsp;Store
                            </strong>
                            . Search for{" "}
                            <strong className="font-bold text-foreground">
                              "NusenseTryOn"
                            </strong>{" "}
                            and click{" "}
                            <strong className="font-bold text-foreground">
                              "Add&nbsp;app"
                            </strong>
                            .
                          </p>
                          <div className="bg-info/20 border-2 border-info/40 rounded-lg p-4 sm:p-5">
                            <p className="text-sm sm:text-base text-foreground leading-relaxed no-orphans">
                              <strong className="font-bold text-foreground">
                                ℹ️ Note&nbsp;:
                              </strong>{" "}
                              Authorize the requested permissions (read and
                              modify products and themes) so the app can
                              function correctly.
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
                        aria-label="Step 2"
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
                            Activate App&nbsp;Embed&nbsp;Block (All&nbsp;Themes)
                          </h3>
                          <p className="text-base sm:text-lg text-foreground/90 mb-4 sm:mb-5 leading-relaxed no-orphans">
                            The app embed block works with{" "}
                            <strong className="font-bold text-foreground">
                              all&nbsp;Shopify&nbsp;themes
                            </strong>
                            , including vintage themes.
                          </p>
                          <div className="space-y-4 mb-4 sm:mb-5">
                            <div className="bg-muted rounded-lg p-4 sm:p-5 border-2 border-border">
                              <p className="text-sm sm:text-base font-semibold text-foreground mb-3 no-orphans">
                                Instructions&nbsp;:
                              </p>
                              <ol className="list-decimal list-inside space-y-2 text-sm sm:text-base text-foreground/90">
                                <li className="no-orphans">
                                  Go to{" "}
                                  <strong className="font-bold text-foreground">
                                    Online&nbsp;Store
                                  </strong>{" "}
                                  →{" "}
                                  <strong className="font-bold text-foreground">
                                    Themes
                                  </strong>
                                </li>
                                <li className="no-orphans">
                                  Click{" "}
                                  <strong className="font-bold text-foreground">
                                    Customize
                                  </strong>{" "}
                                  on your active theme
                                </li>
                                <li className="no-orphans">
                                  In the left panel, open{" "}
                                  <strong className="font-bold text-foreground">
                                    Theme&nbsp;settings
                                  </strong>
                                </li>
                                <li className="no-orphans">
                                  Scroll down to{" "}
                                  <strong className="font-bold text-foreground">
                                    App&nbsp;embeds
                                  </strong>
                                </li>
                                <li className="no-orphans">
                                  Activate{" "}
                                  <strong className="font-bold text-foreground">
                                    "NUSENSE&nbsp;Try-On&nbsp;Widget"
                                  </strong>
                                </li>
                                <li className="no-orphans">
                                  Configure the settings according to your
                                  preferences (header button, style, etc.)
                                </li>
                                <li className="no-orphans">
                                  Click{" "}
                                  <strong className="font-bold text-foreground">
                                    Save
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
                                    Compatibility&nbsp;:
                                  </strong>{" "}
                                  This block works on all pages of your store
                                  (home, products, collections, etc.) and
                                  displays automatically.
                                </span>
                              </p>
                            </div>
                            <div className="bg-primary/10 border-2 border-primary/30 rounded-lg p-4 sm:p-5">
                              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                <div className="flex-1">
                                  <p className="text-sm sm:text-base font-semibold text-foreground mb-2 no-orphans">
                                    🚀 Quick&nbsp;Access&nbsp;:
                                  </p>
                                  <p className="text-sm sm:text-base text-foreground/90 no-orphans">
                                    Click the button below to access the theme
                                    editor directly with this block activated.
                                  </p>
                                </div>
                                <Button
                                  onClick={() =>
                                    handleDeepLink("embed", "product")
                                  }
                                  className="w-full sm:w-auto whitespace-nowrap"
                                  size="sm"
                                >
                                  <Link2
                                    className="w-4 h-4 mr-2"
                                    aria-hidden="true"
                                  />
                                  Activate&nbsp;Now
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
                        aria-label="Step 3"
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
                            Add App&nbsp;Block
                            (Online&nbsp;Store&nbsp;2.0&nbsp;Themes)
                          </h3>
                          <p className="text-base sm:text-lg text-foreground/90 mb-4 sm:mb-5 leading-relaxed no-orphans">
                            If you're using an{" "}
                            <strong className="font-bold text-foreground">
                              Online&nbsp;Store&nbsp;2.0&nbsp;theme
                            </strong>{" "}
                            (Dawn, Debut, etc.), you can add a customizable app
                            block to your product pages.
                          </p>
                          <div className="space-y-4 mb-4 sm:mb-5">
                            <div className="bg-muted rounded-lg p-4 sm:p-5 border-2 border-border">
                              <p className="text-sm sm:text-base font-semibold text-foreground mb-3 no-orphans">
                                Instructions&nbsp;:
                              </p>
                              <ol className="list-decimal list-inside space-y-2 text-sm sm:text-base text-foreground/90">
                                <li className="no-orphans">
                                  In the theme editor, open a{" "}
                                  <strong className="font-bold text-foreground">
                                    product&nbsp;page
                                  </strong>
                                </li>
                                <li className="no-orphans">
                                  Click{" "}
                                  <strong className="font-bold text-foreground">
                                    Add&nbsp;block
                                  </strong>{" "}
                                  in the desired section
                                </li>
                                <li className="no-orphans">
                                  In the{" "}
                                  <strong className="font-bold text-foreground">
                                    Apps
                                  </strong>{" "}
                                  category, select{" "}
                                  <strong className="font-bold text-foreground">
                                    "NUSENSE&nbsp;Try-On&nbsp;Button"
                                  </strong>
                                </li>
                                <li className="no-orphans">
                                  Customize the button text, style, and other
                                  settings
                                </li>
                                <li className="no-orphans">
                                  Reorder the block by dragging if necessary
                                </li>
                                <li className="no-orphans">
                                  Click{" "}
                                  <strong className="font-bold text-foreground">
                                    Save
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
                                  App blocks are only available in Online Store
                                  2.0 themes (themes with JSON templates). If
                                  you're using a vintage theme, use only the app
                                  embed block (step 2).
                                </span>
                              </p>
                            </div>
                            <div className="bg-primary/10 border-2 border-primary/30 rounded-lg p-4 sm:p-5">
                              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                <div className="flex-1">
                                  <p className="text-sm sm:text-base font-semibold text-foreground mb-2 no-orphans">
                                    🚀 Quick&nbsp;Access&nbsp;:
                                  </p>
                                  <p className="text-sm sm:text-base text-foreground/90 no-orphans">
                                    Click the button below to access the theme
                                    editor directly and add this block to a
                                    product page.
                                  </p>
                                </div>
                                <Button
                                  onClick={() =>
                                    handleDeepLink("block", "product")
                                  }
                                  className="w-full sm:w-auto whitespace-nowrap"
                                  size="sm"
                                >
                                  <Link2
                                    className="w-4 h-4 mr-2"
                                    aria-hidden="true"
                                  />
                                  Add&nbsp;Now
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
                        aria-label="Step 4"
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
                            Test Your&nbsp;Configuration
                          </h3>
                          <p className="text-base sm:text-lg text-foreground/90 mb-4 sm:mb-5 leading-relaxed no-orphans">
                            Visit a product page on your store and verify that
                            the virtual try-on button appears correctly. Click
                            the button to test the functionality.
                          </p>
                          <div className="bg-success/25 border-2 border-success/50 rounded-lg p-4 sm:p-5">
                            <p className="text-sm sm:text-base text-foreground flex items-start gap-3 leading-relaxed">
                              <CheckCircle2
                                className="w-5 h-5 sm:w-6 sm:h-6 text-success flex-shrink-0 mt-0.5"
                                aria-hidden="true"
                              />
                              <span className="no-orphans">
                                <strong className="font-bold text-foreground">
                                  Congratulations&nbsp;!
                                </strong>{" "}
                                NusenseTryOn is now configured. Your customers
                                can use the virtual try-on feature directly on
                                your&nbsp;product&nbsp;pages.
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
            All&nbsp;rights&nbsp;reserved.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
