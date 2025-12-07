import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router-dom";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Sparkles, Image as ImageIcon, Package } from "lucide-react";
import { useProducts } from "@/hooks/useProducts";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const Nulight = () => {
  const { t } = useTranslation();
  const location = useLocation();

  // Use products hook to get products from Redux state
  const {
    products,
    loading,
    error,
    fetchProducts,
    lastFetchedShop,
  } = useProducts();

  // Fetch products only when needed (if shop changes or no products available)
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const shopParam = urlParams.get("shop");

    if (!shopParam) {
      return;
    }

    const normalizedShop = shopParam.replace(".myshopify.com", "");

    // Check if we already have products for this shop
    const hasProductsForShop =
      lastFetchedShop === normalizedShop &&
      products &&
      products.length > 0;

    // Only fetch if we don't have products for this shop
    if (!hasProductsForShop) {
      fetchProducts({
        shop: normalizedShop,
        options: {
          status: "ACTIVE",
          limit: 50,
        },
      }).catch((error) => {
        console.warn("[Nulight] Failed to fetch products:", error);
      });
    }
  }, [location.search, lastFetchedShop, products?.length, fetchProducts]);

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation Bar - Horizontal Layout */}
      <nav className="bg-card border-b border-border" role="navigation" aria-label="Main navigation">
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
                  aria-label="Dashboard"
                >
                  Dashboard
                </Link>
                <Link
                  to="/nucopy"
                  className={`px-3 sm:px-4 py-2 text-sm font-medium transition-colors rounded-md hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 whitespace-nowrap ${
                    location.pathname === "/nucopy"
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  aria-label="NU Copy"
                >
                  NU Copy
                </Link>
                <Link
                  to="/nulight"
                  className={`px-3 sm:px-4 py-2 text-sm font-medium transition-colors rounded-md hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 whitespace-nowrap ${
                    location.pathname === "/nulight"
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  aria-label="NU Light"
                >
                  NU Light
                </Link>
                <Link
                  to="/nu3d"
                  className={`px-3 sm:px-4 py-2 text-sm font-medium transition-colors rounded-md hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 whitespace-nowrap ${
                    location.pathname === "/nu3d"
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  aria-label="Nu3d"
                >
                  Nu3d
                </Link>
                <Link
                  to="/nuscene"
                  className={`px-3 sm:px-4 py-2 text-sm font-medium transition-colors rounded-md hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 whitespace-nowrap ${
                    location.pathname === "/nuscene"
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  aria-label="Nu Scene"
                >
                  Nu Scene
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

            {/* Loading State */}
            {loading && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
                  {[...Array(8)].map((_, index) => (
                    <Card key={index} className="border-border bg-card overflow-hidden">
                      <CardContent className="p-0">
                        <Skeleton className="w-full aspect-[3/4]" />
                        <div className="p-4 space-y-2">
                          <Skeleton className="h-4 w-3/4" />
                          <Skeleton className="h-3 w-1/2" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Error State */}
            {error && !loading && (
              <Card className="p-6 sm:p-8 border-error bg-error/10">
                <div className="text-center space-y-4">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-error/20">
                    <ImageIcon className="w-8 h-8 text-error" aria-hidden="true" />
                  </div>
                  <div>
                    <h2 className="text-lg sm:text-xl font-semibold text-error mb-2">
                      {t("nulight.error.title") || "Failed to load products"}
                    </h2>
                    <p className="text-sm sm:text-base text-muted-foreground">
                      {error}
                    </p>
                  </div>
                </div>
              </Card>
            )}

            {/* No Shop Parameter Error */}
            {!loading && !error && (products?.length ?? 0) === 0 && (
              <Card className="p-6 sm:p-8 border-warning bg-warning/10">
                <div className="text-center space-y-4">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-warning/20">
                    <Package className="w-8 h-8 text-warning" aria-hidden="true" />
                  </div>
                  <div>
                    <h2 className="text-lg sm:text-xl font-semibold text-warning mb-2">
                      {t("nulight.error.noShop") || "Shop parameter required"}
                    </h2>
                    <p className="text-sm sm:text-base text-muted-foreground">
                      {t("nulight.error.noShopDescription") || "Please access this page from Shopify admin to view products."}
                    </p>
                  </div>
                </div>
              </Card>
            )}

            {/* Products Grid */}
            {!loading && !error && (
              <>
                {(products?.length ?? 0) === 0 ? (
                  <Card className="p-8 sm:p-12 border-border bg-card">
                    <div className="text-center space-y-4">
                      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted">
                        <Package className="w-8 h-8 text-muted-foreground" aria-hidden="true" />
                      </div>
                      <div>
                        <h2 className="text-lg sm:text-xl font-semibold text-foreground mb-2">
                          {t("nulight.noProducts.title") || "No products found"}
                        </h2>
                        <p className="text-sm sm:text-base text-muted-foreground">
                          {t("nulight.noProducts.description") || "No products are available in your store at the moment."}
                        </p>
                      </div>
                    </div>
                  </Card>
                ) : (
                  <div className="space-y-6">
                    {/* Products Count */}
                    <div className="flex items-center justify-between">
                      <p className="text-sm sm:text-base text-muted-foreground">
                        {t("nulight.productsCount", { count: products?.length ?? 0 }) || `${products?.length ?? 0} product${(products?.length ?? 0) !== 1 ? "s" : ""} found`}
                      </p>
                    </div>

                    {/* Products Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
                      {(products ?? []).map((product) => (
                        <Card
                          key={product?.productId ?? `product-${Math.random()}`}
                          className="group border-border bg-card overflow-hidden hover:shadow-lg transition-all duration-200 hover:border-primary/50"
                        >
                          <CardContent className="p-0">
                            {/* Product Image */}
                            <div className="relative aspect-[3/4] bg-muted/30 overflow-hidden">
                              {product?.imageUrl ? (
                                <img
                                  src={product.imageUrl}
                                  alt={product?.altText ?? product?.productTitle ?? "Product image"}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                  loading="lazy"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center bg-muted/50">
                                  <ImageIcon className="w-12 h-12 text-muted-foreground/50" aria-hidden="true" />
                                </div>
                              )}
                            </div>

                            {/* Product Info */}
                            <div className="p-4 space-y-2">
                              <h3 className="font-semibold text-sm sm:text-base text-foreground line-clamp-2 min-h-[2.5rem]">
                                {product?.productTitle ?? "Untitled Product"}
                              </h3>
                              {product?.productHandle && (
                                <p className="text-xs sm:text-sm text-muted-foreground line-clamp-1">
                                  {product.productHandle}
                                </p>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Nulight;

