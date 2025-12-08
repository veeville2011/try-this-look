import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router-dom";
import { useShop } from "@/providers/AppBridgeProvider";
import { useNulightProducts } from "@/hooks/useNulightProducts";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import NulightProductCard from "@/components/NulightProductCard";
import { Sparkles, Package, Store, ChevronDown, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { approveRejectBulk } from "@/services/nulightApi";

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
    refresh,
  } = useNulightProducts(shopDomain);

  // Bulk selection state
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [processingBulk, setProcessingBulk] = useState(false);

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

  // Handle product selection
  const handleToggleProduct = (productId: string) => {
    setSelectedProducts((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(productId)) {
        newSet.delete(productId);
      } else {
        newSet.add(productId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedProducts.size === products.length) {
      setSelectedProducts(new Set());
    } else {
      setSelectedProducts(new Set(products.map((p) => p.id)));
    }
  };

  // Handle bulk actions
  const handleBulkAction = async (action: "approve" | "reject") => {
    if (!shopDomain || selectedProducts.size === 0) {
      toast.error(
        t("nulight.bulk.noSelection") || 
        "Please select at least one product"
      );
      return;
    }

    setProcessingBulk(true);
    try {
      const normalizedShop = shopDomain.replace(".myshopify.com", "");
      const result = await approveRejectBulk({
        shop: normalizedShop,
        productIds: Array.from(selectedProducts),
        action,
      });

      toast.success(
        t(`nulight.bulk.${action}Success`, { count: result.processed }) ||
          `Successfully ${action === "approve" ? "approved" : "rejected"} ${result.processed} product${result.processed !== 1 ? "s" : ""}`
      );
      
      setSelectedProducts(new Set());
      await refresh();
    } catch (error) {
      console.error(`[Nulight] Failed to bulk ${action}:`, error);
      toast.error(
        error instanceof Error
          ? error.message
          : t(`nulight.bulk.${action}Error`) ||
              `Failed to ${action} products. Please try again.`
      );
    } finally {
      setProcessingBulk(false);
    }
  };

  // Handle product update after approval/rejection
  const handleProductUpdate = async () => {
    await refresh();
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
                {/* Header with Bulk Actions */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <h2 className="text-xl sm:text-2xl font-semibold text-foreground">
                      {t("nulight.products.title") || "Products"} ({total})
                    </h2>
                    {products.length > 0 && (
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="select-all"
                          checked={selectedProducts.size === products.length && products.length > 0}
                          onCheckedChange={handleSelectAll}
                          aria-label={t("nulight.selectAll") || "Select all products"}
                        />
                        <label
                          htmlFor="select-all"
                          className="text-sm text-muted-foreground cursor-pointer"
                        >
                          {t("nulight.selectAll") || "Select All"}
                        </label>
                      </div>
                    )}
                  </div>
                  
                  {selectedProducts.size > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">
                        {selectedProducts.size} {t("nulight.selected") || "selected"}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleBulkAction("approve")}
                        disabled={processingBulk}
                        className="h-8 text-xs"
                        aria-label={t("nulight.bulk.approve") || "Approve Selected"}
                      >
                        {processingBulk ? (
                          <Loader2 className="w-3 h-3 animate-spin mr-1" />
                        ) : (
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                        )}
                        {t("nulight.bulk.approve") || "Approve Selected"}
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleBulkAction("reject")}
                        disabled={processingBulk}
                        className="h-8 text-xs"
                        aria-label={t("nulight.bulk.reject") || "Reject Selected"}
                      >
                        {processingBulk ? (
                          <Loader2 className="w-3 h-3 animate-spin mr-1" />
                        ) : (
                          <XCircle className="w-3 h-3 mr-1" />
                        )}
                        {t("nulight.bulk.reject") || "Reject Selected"}
                      </Button>
                    </div>
                  )}
                </div>

                {/* Products Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                  {products.map((product) => (
                    <NulightProductCard
                      key={product.id}
                      product={product}
                      shop={shopDomain || ""}
                      onUpdate={handleProductUpdate}
                    />
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

