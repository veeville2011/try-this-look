import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router-dom";
import { useShop } from "@/providers/AppBridgeProvider";
import { useNulightProducts } from "@/hooks/useNulightProducts";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Sparkles, Package, Store, ChevronDown, ChevronLeft, ChevronRight, CheckCircle2, XCircle, Loader2, Image as ImageIcon, Eye } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { approveRejectBulk, approveRejectProduct, approveRejectImage, NulightProduct } from "@/services/nulightApi";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ProductTableRowProps {
  product: NulightProduct;
  shop: string;
  isSelected: boolean;
  onToggleSelect: () => void;
  onUpdate: () => void;
}

const ProductTableRow = ({
  product,
  shop,
  isSelected,
  onToggleSelect,
  onUpdate,
}: ProductTableRowProps) => {
  const { t } = useTranslation();
  const [processingProduct, setProcessingProduct] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const handleProductAction = async (action: "approve" | "reject") => {
    setProcessingProduct(true);
    try {
      await approveRejectProduct({
        shop,
        productId: product.id,
        action,
      });

      toast.success(
        t(`nulight.product.${action}Success`) ||
          `Product ${action === "approve" ? "approved" : "rejected"} successfully`
      );
      onUpdate();
    } catch (error) {
      console.error(`[ProductTableRow] Failed to ${action} product:`, error);
      toast.error(
        error instanceof Error
          ? error.message
          : t(`nulight.product.${action}Error`) ||
              `Failed to ${action} product. Please try again.`
      );
    } finally {
      setProcessingProduct(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return (
          <Badge className="bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20 text-xs">
            {status}
          </Badge>
        );
      default:
        return (
          <Badge className="bg-gray-500/10 text-gray-700 dark:text-gray-400 border-gray-500/20 text-xs">
            {status}
          </Badge>
        );
    }
  };

  const getApprovalStatusBadge = () => {
    // Check if all variants have approved images
    const allVariants = product.variants.nodes;
    const hasApprovedImages = allVariants.some((variant) =>
      variant.images.some((img) => img.approvalStatus === "approved")
    );
    const hasRejectedImages = allVariants.some((variant) =>
      variant.images.some((img) => img.approvalStatus === "rejected")
    );
    const hasPendingImages = allVariants.some((variant) =>
      variant.images.some((img) => img.approvalStatus === "pending")
    );

    if (hasApprovedImages && !hasPendingImages) {
      return (
        <Badge className="bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20 text-xs">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          Approved
        </Badge>
      );
    }
    if (hasRejectedImages && !hasPendingImages) {
      return (
        <Badge className="bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20 text-xs">
          <XCircle className="w-3 h-3 mr-1" />
          Rejected
        </Badge>
      );
    }
    return (
      <Badge className="bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20 text-xs">
        Pending
      </Badge>
    );
  };

  const mainImage = product.images.nodes[0]?.url || "";
  const variantCount = product.variants.nodes.length;
  const price = `${product.priceRangeV2.minVariantPrice.currencyCode} ${product.priceRangeV2.minVariantPrice.amount}`;

  return (
    <>
      <TableRow className="hover:bg-muted/50">
        <TableCell>
          <Checkbox
            checked={isSelected}
            onCheckedChange={onToggleSelect}
            aria-label={`Select ${product.title}`}
          />
        </TableCell>
        <TableCell>
          {mainImage ? (
            <div className="relative w-16 h-16 rounded-md overflow-hidden bg-muted border border-border">
              <img
                src={mainImage}
                alt={product.title}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </div>
          ) : (
            <div className="w-16 h-16 rounded-md bg-muted border border-border flex items-center justify-center">
              <ImageIcon className="w-5 h-5 text-muted-foreground" />
            </div>
          )}
        </TableCell>
        <TableCell>
          <div className="flex flex-col gap-1">
            <span className="font-medium text-foreground line-clamp-2">
              {product.title}
            </span>
            {product.vendor && (
              <span className="text-xs text-muted-foreground">
                {product.vendor}
              </span>
            )}
          </div>
        </TableCell>
        <TableCell>{getStatusBadge(product.status)}</TableCell>
        <TableCell>
          <span className="font-medium text-foreground">{price}</span>
        </TableCell>
        <TableCell>
          <Badge variant="outline" className="text-xs">
            {variantCount} {variantCount === 1 ? "variant" : "variants"}
          </Badge>
        </TableCell>
        <TableCell>{getApprovalStatusBadge()}</TableCell>
        <TableCell>
          <div className="flex items-center justify-end gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowDetails(true)}
              className="h-8 w-8 p-0"
              aria-label={`View details for ${product.title}`}
            >
              <Eye className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleProductAction("approve")}
              disabled={processingProduct}
              className="h-8 text-xs"
              aria-label={`Approve ${product.title}`}
            >
              {processingProduct ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <CheckCircle2 className="w-3 h-3" />
              )}
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => handleProductAction("reject")}
              disabled={processingProduct}
              className="h-8 text-xs"
              aria-label={`Reject ${product.title}`}
            >
              {processingProduct ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <XCircle className="w-3 h-3" />
              )}
            </Button>
          </div>
        </TableCell>
      </TableRow>

      {/* Product Details Dialog */}
      <ProductDetailsDialog
        product={product}
        shop={shop}
        open={showDetails}
        onOpenChange={setShowDetails}
        onUpdate={onUpdate}
      />
    </>
  );
};

interface ProductDetailsDialogProps {
  product: NulightProduct;
  shop: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
}

const ProductDetailsDialog = ({
  product,
  shop,
  open,
  onOpenChange,
  onUpdate,
}: ProductDetailsDialogProps) => {
  const { t } = useTranslation();
  const [selectedVariantIndex, setSelectedVariantIndex] = useState(0);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [processingImageId, setProcessingImageId] = useState<string | null>(null);
  const [processingProduct, setProcessingProduct] = useState(false);
  const [zoomImage, setZoomImage] = useState<string | null>(null);

  const variant = product.variants.nodes[selectedVariantIndex] || product.variants.nodes[0] || null;
  const variantImages = variant?.images || [];
  const relightedImages = variantImages.filter(
    (img) => img.relightingStatus === "completed" && img.transformedImageUrls.length > 0
  );
  const displayImages = relightedImages.length > 0 ? relightedImages : variantImages;
  const currentImage = displayImages[selectedImageIndex] || displayImages[0];

  const handleImageAction = async (
    action: "approve" | "reject",
    imageId: string,
    relightingImageId: number,
    transformedImageUrl?: string
  ) => {
    if (!variant) return;

    setProcessingImageId(imageId);
    try {
      await approveRejectImage({
        shop,
        productId: product.id,
        variantId: variant.id,
        imageId,
        relightingImageId,
        action,
        transformedImageUrl,
      });

      toast.success(
        t(`nulight.image.${action}Success`) ||
          `Image ${action === "approve" ? "approved" : "rejected"} successfully`
      );
      onUpdate();
    } catch (error) {
      console.error(`[ProductDetailsDialog] Failed to ${action} image:`, error);
      toast.error(
        error instanceof Error
          ? error.message
          : t(`nulight.image.${action}Error`) ||
              `Failed to ${action} image. Please try again.`
      );
    } finally {
      setProcessingImageId(null);
    }
  };

  const handleProductAction = async (action: "approve" | "reject") => {
    setProcessingProduct(true);
    try {
      await approveRejectProduct({
        shop,
        productId: product.id,
        action,
      });

      toast.success(
        t(`nulight.product.${action}Success`) ||
          `Product ${action === "approve" ? "approved" : "rejected"} successfully`
      );
      onUpdate();
    } catch (error) {
      console.error(`[ProductDetailsDialog] Failed to ${action} product:`, error);
      toast.error(
        error instanceof Error
          ? error.message
          : t(`nulight.product.${action}Error`) ||
              `Failed to ${action} product. Please try again.`
      );
    } finally {
      setProcessingProduct(false);
    }
  };

  const getApprovalStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return (
          <Badge className="bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Approved
          </Badge>
        );
      case "rejected":
        return (
          <Badge className="bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20">
            <XCircle className="w-3 h-3 mr-1" />
            Rejected
          </Badge>
        );
      default:
        return (
          <Badge className="bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20">
            Pending
          </Badge>
        );
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{product.title}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Product Info */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Price:</span>
                <span className="ml-2 font-medium">
                  {product.priceRangeV2.minVariantPrice.currencyCode} {product.priceRangeV2.minVariantPrice.amount}
                </span>
              </div>
              {product.vendor && (
                <div>
                  <span className="text-muted-foreground">Vendor:</span>
                  <span className="ml-2">{product.vendor}</span>
                </div>
              )}
              <div>
                <span className="text-muted-foreground">Status:</span>
                <span className="ml-2">{product.status}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Variants:</span>
                <span className="ml-2">{product.variants.nodes.length}</span>
              </div>
            </div>

            {/* Variant Selector */}
            {product.variants.nodes.length > 1 && (
              <div className="flex flex-wrap gap-2">
                {product.variants.nodes.map((v, index) => (
                  <Button
                    key={v.id}
                    size="sm"
                    variant={selectedVariantIndex === index ? "default" : "outline"}
                    onClick={() => {
                      setSelectedVariantIndex(index);
                      setSelectedImageIndex(0);
                    }}
                    className="h-8 text-xs"
                  >
                    {v.title}
                  </Button>
                ))}
              </div>
            )}

            {/* Image Comparison */}
            {currentImage && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium">
                      Image {selectedImageIndex + 1} of {displayImages.length}
                    </span>
                  </div>
                  {displayImages.length > 1 && (
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-8 w-8"
                        onClick={() =>
                          setSelectedImageIndex((prev) =>
                            prev > 0 ? prev - 1 : displayImages.length - 1
                          )
                        }
                        aria-label="Previous image"
                      >
                        <ChevronLeft className="w-3 h-3" />
                      </Button>
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-8 w-8"
                        onClick={() =>
                          setSelectedImageIndex((prev) =>
                            prev < displayImages.length - 1 ? prev + 1 : 0
                          )
                        }
                        aria-label="Next image"
                      >
                        <ChevronRight className="w-3 h-3" />
                      </Button>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <span className="text-xs font-medium text-muted-foreground">Original</span>
                    <div className="relative aspect-square bg-muted rounded-lg overflow-hidden">
                      <img
                        src={currentImage.originalImageUrl}
                        alt="Original"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">Relighted</span>
                      {currentImage.approvalStatus && getApprovalStatusBadge(currentImage.approvalStatus)}
                    </div>
                    {currentImage.transformedImageUrls.length > 0 ? (
                      <div className="relative aspect-square bg-muted rounded-lg overflow-hidden">
                        <img
                          src={currentImage.transformedImageUrls[0]}
                          alt="Relighted"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="aspect-square bg-muted rounded-lg flex items-center justify-center border-2 border-dashed">
                        <span className="text-xs text-muted-foreground">Processing...</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Image Actions */}
                {currentImage.relightingStatus === "completed" &&
                  currentImage.approvalStatus === "pending" &&
                  currentImage.transformedImageUrls.length > 0 && (
                    <div className="flex gap-2 justify-end">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          handleImageAction(
                            "reject",
                            currentImage.id,
                            currentImage.relightingImageId,
                            currentImage.transformedImageUrls[0]
                          )
                        }
                        disabled={processingImageId === currentImage.id}
                      >
                        {processingImageId === currentImage.id ? (
                          <Loader2 className="w-3 h-3 animate-spin mr-1" />
                        ) : (
                          <XCircle className="w-3 h-3 mr-1" />
                        )}
                        Reject
                      </Button>
                      <Button
                        size="sm"
                        onClick={() =>
                          handleImageAction(
                            "approve",
                            currentImage.id,
                            currentImage.relightingImageId,
                            currentImage.transformedImageUrls[0]
                          )
                        }
                        disabled={processingImageId === currentImage.id}
                      >
                        {processingImageId === currentImage.id ? (
                          <Loader2 className="w-3 h-3 animate-spin mr-1" />
                        ) : (
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                        )}
                        Approve
                      </Button>
                    </div>
                  )}
              </div>
            )}

            {/* Product Actions */}
            <div className="flex gap-2 justify-end pt-4 border-t">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleProductAction("approve")}
                disabled={processingProduct}
              >
                {processingProduct ? (
                  <Loader2 className="w-3 h-3 animate-spin mr-1" />
                ) : (
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                )}
                Approve All
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => handleProductAction("reject")}
                disabled={processingProduct}
              >
                {processingProduct ? (
                  <Loader2 className="w-3 h-3 animate-spin mr-1" />
                ) : (
                  <XCircle className="w-3 h-3 mr-1" />
                )}
                Reject All
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Zoom Dialog */}
      <Dialog open={!!zoomImage} onOpenChange={() => setZoomImage(null)}>
        <DialogContent className="max-w-4xl p-0">
          <DialogHeader className="p-6 pb-0">
            <DialogTitle>Image Preview</DialogTitle>
          </DialogHeader>
          <div className="p-6">
            {zoomImage && (
              <img
                src={zoomImage}
                alt="Zoomed image"
                className="w-full h-auto rounded-lg"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

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
      <main className="min-h-[calc(100vh-56px)] py-6" role="main">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            {/* Compact Header with Actions */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 border border-primary/20">
                  <Sparkles className="w-5 h-5 text-primary" aria-hidden="true" />
                </div>
                <div>
                  <h1 className="text-xl font-semibold text-foreground">
                    {t("nulight.title") || "Nulight Products"}
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    {t("nulight.description") || "Manage products created today"}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                {products.length > 0 && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Package className="w-4 h-4" />
                    <span>{total} {t("nulight.products") || "products"}</span>
                  </div>
                )}
                <Button
                  onClick={handleFetchProducts}
                  disabled={productsLoading}
                  size="sm"
                  className="h-9 px-4 font-medium focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                  aria-label={t("index.hero.fetchProducts") || "Fetch Products"}
                >
                  <Store className="w-4 h-4 mr-2" aria-hidden="true" />
                  {productsLoading 
                    ? (t("index.hero.fetchingProducts") || "Fetching...") 
                    : (t("index.hero.fetchProducts") || "Fetch Products")}
                </Button>
              </div>
            </div>

            {/* Error Display */}
            {productsError && (
              <Card className="mb-6 p-4 border-destructive/50 bg-destructive/10">
                <p className="text-sm text-destructive">
                  {productsError}
                </p>
              </Card>
            )}

            {/* Products Table */}
            {products.length > 0 && (
              <div className="space-y-4">
                {/* Bulk Actions Bar */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-muted/30 rounded-lg border border-border">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      id="select-all"
                      checked={selectedProducts.size === products.length && products.length > 0}
                      onCheckedChange={handleSelectAll}
                      aria-label={t("nulight.selectAll") || "Select all products"}
                    />
                    <label
                      htmlFor="select-all"
                      className="text-sm font-medium text-foreground cursor-pointer"
                    >
                      {t("nulight.selectAll") || "Select All"}
                    </label>
                    {selectedProducts.size > 0 && (
                      <span className="text-sm text-muted-foreground">
                        ({selectedProducts.size} {t("nulight.selected") || "selected"})
                      </span>
                    )}
                  </div>
                  
                  {selectedProducts.size > 0 && (
                    <div className="flex items-center gap-2">
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
                        {t("nulight.bulk.approve") || "Approve"}
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
                        {t("nulight.bulk.reject") || "Reject"}
                      </Button>
                    </div>
                  )}
                </div>

                {/* Table */}
                <Card className="border-border">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">
                            <span className="sr-only">{t("nulight.select") || "Select"}</span>
                          </TableHead>
                          <TableHead className="w-20">{t("nulight.image") || "Image"}</TableHead>
                          <TableHead className="min-w-[200px]">{t("nulight.product") || "Product"}</TableHead>
                          <TableHead className="w-24">{t("nulight.status") || "Status"}</TableHead>
                          <TableHead className="w-32">{t("nulight.price") || "Price"}</TableHead>
                          <TableHead className="w-24">{t("nulight.variants") || "Variants"}</TableHead>
                          <TableHead className="w-32">{t("nulight.approval") || "Approval"}</TableHead>
                          <TableHead className="w-40 text-right">{t("nulight.actions") || "Actions"}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {products.map((product) => (
                          <ProductTableRow
                            key={product.id}
                            product={product}
                            shop={shopDomain || ""}
                            isSelected={selectedProducts.has(product.id)}
                            onToggleSelect={() => handleToggleProduct(product.id)}
                            onUpdate={handleProductUpdate}
                          />
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </Card>

                {/* Load More Button */}
                {hasNextPage && (
                  <div className="flex justify-center pt-4">
                    <Button
                      onClick={handleLoadMore}
                      disabled={productsLoading}
                      variant="outline"
                      className="h-10 px-6 font-medium focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
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
              <Card className="p-12 text-center border-border bg-card">
                <Package className="w-12 h-12 mx-auto mb-4 text-muted-foreground" aria-hidden="true" />
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  {t("nulight.empty.title") || "No products found"}
                </h3>
                <p className="text-sm text-muted-foreground mb-6">
                  {t("nulight.empty.description") || "Click 'Fetch Products' to load products created today with ACTIVE status."}
                </p>
                <Button
                  onClick={handleFetchProducts}
                  disabled={productsLoading}
                  className="h-10 px-6 font-medium"
                  aria-label={t("index.hero.fetchProducts") || "Fetch Products"}
                >
                  <Store className="w-4 h-4 mr-2" aria-hidden="true" />
                  {t("index.hero.fetchProducts") || "Fetch Products"}
                </Button>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Nulight;

