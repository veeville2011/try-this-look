import { useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router-dom";
import { useShop } from "@/providers/AppBridgeProvider";
import { useProducts } from "@/hooks/useProducts";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Sparkles, Package, Store } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const Nulight = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const shop = useShop();

  // Use products hook to get products from Redux state
  const {
    products: reduxProducts,
    loading: productsLoading,
    error: productsError,
    lastFetchedShop: reduxLastFetchedShop,
    fetchProducts: fetchProductsFromRedux,
  } = useProducts();

  // Handle manual product fetch
  const handleFetchProducts = async () => {
    const shopDomain =
      shop || new URLSearchParams(window.location.search).get("shop");

    if (!shopDomain) {
      toast.error(t("index.errors.shopNotFound") || "Shop domain not found");
      return;
    }

    // Normalize shop domain (remove .myshopify.com if present, API will handle it)
    const normalizedShop = shopDomain.replace(".myshopify.com", "");

    try {
      const result = await fetchProductsFromRedux({
        shop: normalizedShop,
        options: {
          status: "ACTIVE",
          // productType: "Flats",
          // limit: 50,
        },
      });
      
      // Get the product count from the result payload
      const productCount = 
        (result.payload as any)?.products?.length || 
        (result.payload as any)?.count || 
        reduxProducts.length || 
        0;
      
      toast.success(
        t("index.products.fetchSuccess", { count: productCount }) || 
        `Successfully fetched ${productCount} product${productCount !== 1 ? "s" : ""}`
      );
    } catch (error) {
      console.warn("[Nulight] Failed to fetch products:", error);
      toast.error(
        t("index.errors.fetchProductsError") || 
        "Failed to fetch products. Please try again."
      );
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation Bar - Horizontal Layout */}
      <nav className="bg-card border-b border-border" role="navigation" aria-label={t("navigation.mainNavigation") || "Main navigation"}>
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between h-14">
              {/* Navigation Links */}
              <div className="flex items-center gap-1 sm:gap-2 flex-1 min-w-0">
                <Link
                  to="/"
                  className={`px-3 sm:px-4 py-2 text-sm font-medium transition-colors rounded-md hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 whitespace-nowrap ${
                    location.pathname === "/"
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  aria-label={t("navigation.dashboard") || "Dashboard"}
                >
                  {t("navigation.dashboard") || "Dashboard"}
                </Link>
                <Link
                  to="/nucopy"
                  className={`px-3 sm:px-4 py-2 text-sm font-medium transition-colors rounded-md hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 whitespace-nowrap ${
                    location.pathname === "/nucopy"
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  aria-label={t("navigation.nuCopy") || "NU Copy"}
                >
                  {t("navigation.nuCopy") || "NU Copy"}
                </Link>
                <Link
                  to="/nulight"
                  className={`px-3 sm:px-4 py-2 text-sm font-medium transition-colors rounded-md hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 whitespace-nowrap ${
                    location.pathname === "/nulight"
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  aria-label={t("navigation.nuLight") || "NU Light"}
                >
                  {t("navigation.nuLight") || "NU Light"}
                </Link>
                <Link
                  to="/nu3d"
                  className={`px-3 sm:px-4 py-2 text-sm font-medium transition-colors rounded-md hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 whitespace-nowrap ${
                    location.pathname === "/nu3d"
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  aria-label={t("navigation.nu3d") || "Nu3d"}
                >
                  {t("navigation.nu3d") || "Nu3d"}
                </Link>
                <Link
                  to="/nuscene"
                  className={`px-3 sm:px-4 py-2 text-sm font-medium transition-colors rounded-md hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 whitespace-nowrap ${
                    location.pathname === "/nuscene"
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  aria-label={t("navigation.nuScene") || "Nu Scene"}
                >
                  {t("navigation.nuScene") || "Nu Scene"}
                </Link>
              </div>

              {/* Language Switcher */}
              <div className="flex items-center ml-4 flex-shrink-0">
                <LanguageSwitcher />
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="min-h-[calc(100vh-56px)] py-8 sm:py-12 lg:py-16" role="main">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            {/* Header Section */}
            <div className="mb-8 sm:mb-12">
              <div className="flex items-center gap-3 mb-4">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 border border-primary/20">
                  <Sparkles className="w-6 h-6 text-primary" aria-hidden="true" />
                </div>
                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground">
                  Nulight
                </h1>
              </div>
              <p className="text-base sm:text-lg text-muted-foreground">
                {t("nulight.description") || "Browse all products from your store"}
              </p>
            </div>

            {/* Fetch Products Section */}
            <Card className="p-8 sm:p-12 border-border bg-card">
              <div className="text-center space-y-6">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted">
                  <Package className="w-8 h-8 text-muted-foreground" aria-hidden="true" />
                </div>
                <div>
                  <h2 className="text-lg sm:text-xl font-semibold text-foreground mb-2">
                    {t("nulight.info.title") || "Products Management"}
                  </h2>
                  <p className="text-sm sm:text-base text-muted-foreground mb-6">
                    {t("nulight.info.description") || "Fetch products from your store to view and manage them here."}
                  </p>
                </div>
                <Button
                  size="lg"
                  onClick={handleFetchProducts}
                  disabled={productsLoading}
                  className="h-11 min-h-[44px] px-6 font-medium focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                  aria-label={t("index.hero.fetchProducts") || "Fetch Products"}
                >
                  <Store className="w-4 h-4 mr-2" aria-hidden="true" />
                  {productsLoading 
                    ? (t("index.hero.fetchingProducts") || "Fetching...") 
                    : (t("index.hero.fetchProducts") || "Fetch Products")}
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Nulight;

