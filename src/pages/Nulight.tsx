import { useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router-dom";
import { useShop } from "@/providers/AppBridgeProvider";
import { useNulightProducts } from "@/hooks/useNulightProducts";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Sparkles, Package, Store, ChevronDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const Nulight = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const shop = useShop();

  // Get shop domain from hook or URL params
  const shopDomain =
    shop || new URLSearchParams(window.location.search).get("shop");

  // Use nulight products hook
  const {
    products,
    loading: productsLoading,
    error: productsError,
    hasNextPage,
    total,
    fetchProducts,
    loadMore,
  } = useNulightProducts(shopDomain);

  // Handle manual product fetch
  const handleFetchProducts = async () => {
    if (!shopDomain) {
      toast.error(t("index.errors.shopNotFound") || "Shop domain not found");
      return;
    }

    // Normalize shop domain (remove .myshopify.com if present, API will handle it)
    const normalizedShop = shopDomain.replace(".myshopify.com", "");

    try {
      const result = await fetchProducts({
        shop: normalizedShop,
      });
      
      const productCount = result.data.total || result.data.products.length || 0;
      
      toast.success(
        t("index.products.fetchSuccess", { count: productCount }) || 
        `Successfully fetched ${productCount} product${productCount !== 1 ? "s" : ""}`
      );
    } catch (error) {
      console.warn("[Nulight] Failed to fetch products:", error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : t("index.errors.fetchProductsError") || "Failed to fetch products. Please try again.";
      toast.error(errorMessage);
    }
  };

  // Handle load more
  const handleLoadMore = async () => {
    try {
      await loadMore();
      toast.success(
        t("nulight.loadMoreSuccess") || 
        "More products loaded successfully"
      );
    } catch (error) {
      console.warn("[Nulight] Failed to load more products:", error);
      toast.error(
        t("nulight.loadMoreError") || 
        "Failed to load more products. Please try again."
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
                    {t("nulight.info.description") || "Fetch products created today with ACTIVE status from your store."}
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

            {/* Error Display */}
            {productsError && (
              <Card className="mt-6 p-4 border-destructive/50 bg-destructive/10">
                <p className="text-sm text-destructive text-center">
                  {productsError}
                </p>
              </Card>
            )}

            {/* Products Display */}
            {products.length > 0 && (
              <div className="mt-8 space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl sm:text-2xl font-semibold text-foreground">
                    {t("nulight.products.title") || "Products"} ({total})
                  </h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                  {products.map((product) => (
                    <Card
                      key={product.id}
                      className="overflow-hidden border-border bg-card hover:shadow-md transition-shadow"
                    >
                      <div className="aspect-square bg-muted relative overflow-hidden">
                        {product.images.nodes[0] ? (
                          <img
                            src={product.images.nodes[0].url}
                            alt={product.images.nodes[0].altText || product.title}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Package className="w-12 h-12 text-muted-foreground" aria-hidden="true" />
                          </div>
                        )}
                      </div>
                      <CardContent className="p-4">
                        <h3 className="font-semibold text-foreground mb-2 line-clamp-2">
                          {product.title}
                        </h3>
                        <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                          {product.description || product.vendor}
                        </p>
                        <div className="flex items-center justify-between">
                          <span className="text-lg font-semibold text-foreground">
                            {product.priceRangeV2.minVariantPrice.currencyCode}{" "}
                            {product.priceRangeV2.minVariantPrice.amount}
                            {product.priceRangeV2.minVariantPrice.amount !==
                              product.priceRangeV2.maxVariantPrice.amount && (
                              <span className="text-sm text-muted-foreground">
                                {" "}
                                - {product.priceRangeV2.maxVariantPrice.amount}
                              </span>
                            )}
                          </span>
                          {product.status && (
                            <span
                              className={`text-xs px-2 py-1 rounded ${
                                product.status === "ACTIVE"
                                  ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                                  : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
                              }`}
                            >
                              {product.status}
                            </span>
                          )}
                        </div>
                        {product.tags.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {product.tags.slice(0, 3).map((tag, index) => (
                              <span
                                key={index}
                                className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Load More Button */}
                {hasNextPage && (
                  <div className="flex justify-center mt-6">
                    <Button
                      onClick={handleLoadMore}
                      disabled={productsLoading}
                      variant="outline"
                      className="h-11 min-h-[44px] px-6 font-medium focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                      aria-label={t("nulight.loadMore") || "Load More Products"}
                    >
                      <ChevronDown className="w-4 h-4 mr-2" aria-hidden="true" />
                      {productsLoading
                        ? (t("nulight.loading") || "Loading...")
                        : (t("nulight.loadMore") || "Load More")}
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Empty State */}
            {!productsLoading && products.length === 0 && !productsError && (
              <Card className="mt-6 p-8 text-center border-border bg-card">
                <Package className="w-12 h-12 mx-auto mb-4 text-muted-foreground" aria-hidden="true" />
                <p className="text-muted-foreground">
                  {t("nulight.empty") || "No products found. Click 'Fetch Products' to load products created today."}
                </p>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Nulight;

