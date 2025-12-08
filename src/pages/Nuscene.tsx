import { useState, useEffect } from "react";
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

interface VariantRowData {
  product: NulightProduct;
  variant: NulightProduct["variants"]["nodes"][0];
  variantIndex: number;
}

interface VariantTableRowProps {
  variantRow: VariantRowData;
  shop: string;
  isSelected: boolean;
  onToggleSelect: () => void;
  onUpdate: () => void;
}

const VariantTableRow = ({
  variantRow,
  shop,
  isSelected,
  onToggleSelect,
  onUpdate,
}: VariantTableRowProps) => {
  const { t } = useTranslation();
  const { product, variant } = variantRow;
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

      const successKey = action === "approve" ? "nuscene.product.approveSuccess" : "nuscene.product.rejectSuccess";
      toast.success(
        t(successKey) ||
          `Product ${action === "approve" ? "approved" : "rejected"} successfully`
      );
      onUpdate();
    } catch (error) {
      console.error(`[VariantTableRow] Failed to ${action} product:`, error);
      const errorKey = action === "approve" ? "nuscene.product.approveError" : "nuscene.product.rejectError";
      toast.error(
        error instanceof Error
          ? error.message
          : t(errorKey) ||
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

  const getVariantApprovalStatusBadge = () => {
    const variantImages = variant.images || [];
    const hasApprovedImages = variantImages.some((img) => img.approvalStatus === "approved");
    const hasRejectedImages = variantImages.some((img) => img.approvalStatus === "rejected");
    const hasPendingImages = variantImages.some((img) => img.approvalStatus === "pending");

    if (hasApprovedImages && !hasPendingImages) {
      return (
        <Badge className="bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20 text-xs">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          {t("nuscene.dialog.approved") || "Approved"}
        </Badge>
      );
    }
    if (hasRejectedImages && !hasPendingImages) {
      return (
        <Badge className="bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20 text-xs">
          <XCircle className="w-3 h-3 mr-1" />
          {t("nuscene.dialog.rejected") || "Rejected"}
        </Badge>
      );
    }
    if (variantImages.length === 0) {
      return (
        <Badge className="bg-gray-500/10 text-gray-700 dark:text-gray-400 border-gray-500/20 text-xs">
          {t("nuscene.dialog.noImages") || "No Images"}
        </Badge>
      );
    }
    return (
      <Badge className="bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20 text-xs">
        {t("nuscene.dialog.pending") || "Pending"}
      </Badge>
    );
  };

  // Get variant image or fallback to product image
  const variantImage = variant.image?.url || product.images.nodes[0]?.url || "";
  const variantPrice = `${variant.price ? parseFloat(variant.price).toFixed(2) : "0.00"}`;
  const currencyCode = product.priceRangeV2.minVariantPrice.currencyCode;
  
  // Get variant options display
  const variantOptions = variant.selectedOptions
    .map((opt) => `${opt.name}: ${opt.value}`)
    .join(", ") || variant.title;

  return (
    <>
      <TableRow className="hover:bg-muted/50">
        <TableCell>
          <Checkbox
            checked={isSelected}
            onCheckedChange={onToggleSelect}
            aria-label={`Select ${product.title} - ${variant.title}`}
          />
        </TableCell>
        <TableCell>
          {variantImage ? (
            <div className="relative w-16 h-16 rounded-md overflow-hidden bg-muted border border-border">
              <img
                src={variantImage}
                alt={variant.title}
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
            <span className="font-medium text-foreground line-clamp-1">
              {product.title}
            </span>
            <span className="text-xs text-muted-foreground line-clamp-1">
              {variantOptions}
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
          <span className="font-medium text-foreground">
            {currencyCode} {variantPrice}
          </span>
        </TableCell>
        <TableCell>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-foreground font-medium">
              {variant.sku || "N/A"}
            </span>
            {variant.inventoryQuantity !== null && (
              <span className="text-xs text-muted-foreground">
                Qty: {variant.inventoryQuantity}
              </span>
            )}
          </div>
        </TableCell>
        <TableCell>{getVariantApprovalStatusBadge()}</TableCell>
        <TableCell>
          <div className="flex items-center justify-end gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowDetails(true)}
              className="h-8 w-8 p-0 hover:bg-muted"
              aria-label={`View details for ${product.title} - ${variant.title}`}
            >
              <Eye className="w-4 h-4 text-muted-foreground" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleProductAction("approve")}
              disabled={processingProduct}
              className="h-8 w-8 p-0 hover:bg-green-500/10 hover:text-green-600 dark:hover:text-green-400"
              aria-label={`Approve ${product.title}`}
            >
              {processingProduct ? (
                <Loader2 className="w-4 h-4 animate-spin text-green-600 dark:text-green-400" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
              )}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleProductAction("reject")}
              disabled={processingProduct}
              className="h-8 w-8 p-0 hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400"
              aria-label={`Reject ${product.title}`}
            >
              {processingProduct ? (
                <Loader2 className="w-4 h-4 animate-spin text-red-600 dark:text-red-400" />
              ) : (
                <XCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
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
        initialVariantIndex={variantRow.variantIndex}
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
  initialVariantIndex?: number;
}

const ProductDetailsDialog = ({
  product,
  shop,
  open,
  onOpenChange,
  onUpdate,
  initialVariantIndex = 0,
}: ProductDetailsDialogProps) => {
  const { t } = useTranslation();
  const [selectedVariantIndex, setSelectedVariantIndex] = useState(initialVariantIndex);

  // Sync variant index when dialog opens with a different initial variant
  useEffect(() => {
    if (open) {
      setSelectedVariantIndex(initialVariantIndex);
    }
  }, [open, initialVariantIndex]);
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

      const successKey = action === "approve" ? "nuscene.image.approveSuccess" : "nuscene.image.rejectSuccess";
      toast.success(
        t(successKey) ||
          `Image ${action === "approve" ? "approved" : "rejected"} successfully`
      );
      onUpdate();
    } catch (error) {
      console.error(`[ProductDetailsDialog] Failed to ${action} image:`, error);
      const errorKey = action === "approve" ? "nuscene.image.approveError" : "nuscene.image.rejectError";
      toast.error(
        error instanceof Error
          ? error.message
          : t(errorKey) ||
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

      const successKey = action === "approve" ? "nuscene.product.approveSuccess" : "nuscene.product.rejectSuccess";
      toast.success(
        t(successKey) ||
          `Product ${action === "approve" ? "approved" : "rejected"} successfully`
      );
      onUpdate();
    } catch (error) {
      console.error(`[ProductDetailsDialog] Failed to ${action} product:`, error);
      const errorKey = action === "approve" ? "nuscene.product.approveError" : "nuscene.product.rejectError";
      toast.error(
        error instanceof Error
          ? error.message
          : t(errorKey) ||
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
            {t("nuscene.dialog.approved") || "Approved"}
          </Badge>
        );
      case "rejected":
        return (
          <Badge className="bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20">
            <XCircle className="w-3 h-3 mr-1" />
            {t("nuscene.dialog.rejected") || "Rejected"}
          </Badge>
        );
      default:
        return (
          <Badge className="bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20">
            {t("nuscene.dialog.pending") || "Pending"}
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
                <span className="text-muted-foreground">{t("nuscene.dialog.price") || "Price"}:</span>
                <span className="ml-2 font-medium">
                  {product.priceRangeV2.minVariantPrice.currencyCode} {product.priceRangeV2.minVariantPrice.amount}
                </span>
              </div>
              {product.vendor && (
                <div>
                  <span className="text-muted-foreground">{t("nuscene.dialog.vendor") || "Vendor"}:</span>
                  <span className="ml-2">{product.vendor}</span>
                </div>
              )}
              <div>
                <span className="text-muted-foreground">{t("nuscene.dialog.status") || "Status"}:</span>
                <span className="ml-2">{product.status}</span>
              </div>
              <div>
                <span className="text-muted-foreground">{t("nuscene.dialog.variants") || "Variants"}:</span>
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
                      {t("nuscene.image.imageOf", { current: selectedImageIndex + 1, total: displayImages.length }) || `Image ${selectedImageIndex + 1} of ${displayImages.length}`}
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
                        aria-label={t("nuscene.image.previous") || "Previous image"}
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
                        aria-label={t("nuscene.image.next") || "Next image"}
                      >
                        <ChevronRight className="w-3 h-3" />
                      </Button>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <span className="text-xs font-medium text-muted-foreground">{t("nuscene.image.original") || "Original"}</span>
                    <div className="relative aspect-square bg-muted rounded-lg overflow-hidden">
                      <img
                        src={currentImage.originalImageUrl}
                        alt={t("nuscene.image.original") || "Original"}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">{t("nuscene.image.relighted") || "Relighted"}</span>
                      {currentImage.approvalStatus && getApprovalStatusBadge(currentImage.approvalStatus)}
                    </div>
                    {currentImage.transformedImageUrls.length > 0 ? (
                      <div className="relative aspect-square bg-muted rounded-lg overflow-hidden">
                        <img
                          src={currentImage.transformedImageUrls[0]}
                          alt={t("nuscene.image.relighted") || "Relighted"}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="aspect-square bg-muted rounded-lg flex items-center justify-center border-2 border-dashed">
                        <span className="text-xs text-muted-foreground">{t("nuscene.image.processing") || "Processing..."}</span>
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
                        className="border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-950 hover:border-red-300 dark:hover:border-red-700"
                      >
                        {processingImageId === currentImage.id ? (
                          <Loader2 className="w-3 h-3 animate-spin mr-1 text-red-600 dark:text-red-400" />
                        ) : (
                          <XCircle className="w-3 h-3 mr-1 text-red-600 dark:text-red-400" />
                        )}
                        <span className="text-red-700 dark:text-red-300">{t("nuscene.dialog.reject") || "Reject"}</span>
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
                        className="bg-green-600 hover:bg-green-700 text-white border-green-600 hover:border-green-700"
                      >
                        {processingImageId === currentImage.id ? (
                          <Loader2 className="w-3 h-3 animate-spin mr-1" />
                        ) : (
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                        )}
                        {t("nuscene.dialog.approve") || "Approve"}
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
                className="border-green-200 dark:border-green-800 hover:bg-green-50 dark:hover:bg-green-950 hover:border-green-300 dark:hover:border-green-700"
              >
                {processingProduct ? (
                  <Loader2 className="w-3 h-3 animate-spin mr-1 text-green-600 dark:text-green-400" />
                ) : (
                  <CheckCircle2 className="w-3 h-3 mr-1 text-green-600 dark:text-green-400" />
                )}
                <span className="text-green-700 dark:text-green-300">{t("nuscene.dialog.approveAll") || "Approve All"}</span>
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleProductAction("reject")}
                disabled={processingProduct}
                className="border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-950 hover:border-red-300 dark:hover:border-red-700"
              >
                {processingProduct ? (
                  <Loader2 className="w-3 h-3 animate-spin mr-1 text-red-600 dark:text-red-400" />
                ) : (
                  <XCircle className="w-3 h-3 mr-1 text-red-600 dark:text-red-400" />
                )}
                <span className="text-red-700 dark:text-red-300">{t("nuscene.dialog.rejectAll") || "Reject All"}</span>
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Zoom Dialog */}
      <Dialog open={!!zoomImage} onOpenChange={() => setZoomImage(null)}>
        <DialogContent className="max-w-4xl p-0">
          <DialogHeader className="p-6 pb-0">
            <DialogTitle>{t("nuscene.image.preview") || "Image Preview"}</DialogTitle>
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

const Nuscene = () => {
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

  // Bulk selection state - using variant IDs (format: "productId-variantId")
  const [selectedVariants, setSelectedVariants] = useState<Set<string>>(new Set());
  const [processingBulk, setProcessingBulk] = useState(false);

  // Flatten products into variant rows
  const variantRows: VariantRowData[] = products.flatMap((product) =>
    product.variants.nodes.map((variant, index) => ({
      product,
      variant,
      variantIndex: index,
    }))
  );

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
      console.warn("[Nuscene] Failed to fetch products:", error);
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
        t("nuscene.loadMoreSuccess") || 
        "More products loaded successfully"
      );
    } catch (error) {
      console.warn("[Nuscene] Failed to load more products:", error);
      toast.error(
        t("nuscene.loadMoreError") || 
        "Failed to load more products. Please try again."
      );
    }
  };

  // Handle variant selection
  const handleToggleVariant = (productId: string, variantId: string) => {
    const variantKey = `${productId}-${variantId}`;
    setSelectedVariants((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(variantKey)) {
        newSet.delete(variantKey);
      } else {
        newSet.add(variantKey);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedVariants.size === variantRows.length && variantRows.length > 0) {
      setSelectedVariants(new Set());
    } else {
      const allVariantKeys = variantRows.map(
        (row) => `${row.product.id}-${row.variant.id}`
      );
      setSelectedVariants(new Set(allVariantKeys));
    }
  };

  // Handle bulk actions
  const handleBulkAction = async (action: "approve" | "reject") => {
    if (!shopDomain || selectedVariants.size === 0) {
      toast.error(
        t("nuscene.bulk.noSelection") || 
        "Please select at least one variant"
      );
      return;
    }

    setProcessingBulk(true);
    try {
      const normalizedShop = shopDomain.replace(".myshopify.com", "");
      
      // Extract unique product IDs from selected variants
      const selectedProductIds = Array.from(selectedVariants).map((key) => {
        const [productId] = key.split("-");
        return productId;
      });
      const uniqueProductIds = Array.from(new Set(selectedProductIds));
      
      const result = await approveRejectBulk({
        shop: normalizedShop,
        productIds: uniqueProductIds,
        action,
      });

      const successKey = action === "approve" ? "nuscene.bulk.approveSuccess" : "nuscene.bulk.rejectSuccess";
      toast.success(
        t(successKey, { count: result.processed }) ||
          `Successfully ${action === "approve" ? "approved" : "rejected"} ${result.processed} product${result.processed !== 1 ? "s" : ""}`
      );
      
      setSelectedVariants(new Set());
      await refresh();
    } catch (error) {
      console.error(`[Nuscene] Failed to bulk ${action}:`, error);
      const errorKey = action === "approve" ? "nuscene.bulk.approveError" : "nuscene.bulk.rejectError";
      toast.error(
        error instanceof Error
          ? error.message
          : t(errorKey) ||
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
                    {t("nuscene.title") || "Nuscene Products"}
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    {t("nuscene.description") || "Manage products created today"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {variantRows.length > 0 && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Package className="w-4 h-4" />
                    <span>{variantRows.length} {t("nuscene.variants") || "variants"}</span>
                    <span className="text-muted-foreground/70">•</span>
                    <span>{total} {t("nuscene.products") || "products"}</span>
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
                      checked={selectedVariants.size === variantRows.length && variantRows.length > 0}
                          onCheckedChange={handleSelectAll}
                      aria-label={t("nuscene.selectAll") || "Select all variants"}
                        />
                        <label
                          htmlFor="select-all"
                      className="text-sm font-medium text-foreground cursor-pointer"
                        >
                          {t("nuscene.selectAll") || "Select All"}
                        </label>
                    {selectedVariants.size > 0 && (
                      <span className="text-sm text-muted-foreground">
                        ({selectedVariants.size} {t("nuscene.selected") || "selected"})
                  </span>
                    )}
                  </div>
                  
                  {selectedVariants.size > 0 && (
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleBulkAction("approve")}
                        disabled={processingBulk}
                        className="h-8 text-xs border-green-200 dark:border-green-800 hover:bg-green-50 dark:hover:bg-green-950 hover:border-green-300 dark:hover:border-green-700"
                        aria-label={t("nuscene.bulk.approve") || "Approve Selected"}
                      >
                        {processingBulk ? (
                          <Loader2 className="w-3 h-3 animate-spin mr-1 text-green-600 dark:text-green-400" />
                        ) : (
                          <CheckCircle2 className="w-3 h-3 mr-1 text-green-600 dark:text-green-400" />
                        )}
                        <span className="text-green-700 dark:text-green-300">{t("nuscene.bulk.approve") || "Approve"}</span>
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleBulkAction("reject")}
                        disabled={processingBulk}
                        className="h-8 text-xs border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-950 hover:border-red-300 dark:hover:border-red-700"
                        aria-label={t("nuscene.bulk.reject") || "Reject Selected"}
                      >
                        {processingBulk ? (
                          <Loader2 className="w-3 h-3 animate-spin mr-1 text-red-600 dark:text-red-400" />
                        ) : (
                          <XCircle className="w-3 h-3 mr-1 text-red-600 dark:text-red-400" />
                        )}
                        <span className="text-red-700 dark:text-red-300">{t("nuscene.bulk.reject") || "Reject"}</span>
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
                            <span className="sr-only">{t("nuscene.select") || "Select"}</span>
                          </TableHead>
                          <TableHead className="w-20">{t("nuscene.imageLabel") || "Image"}</TableHead>
                          <TableHead className="min-w-[200px]">{t("nuscene.productLabel") || "Product / Variant"}</TableHead>
                          <TableHead className="w-24">{t("nuscene.status") || "Status"}</TableHead>
                          <TableHead className="w-32">{t("nuscene.price") || "Price"}</TableHead>
                          <TableHead className="w-32">{t("nuscene.sku") || "SKU / Inventory"}</TableHead>
                          <TableHead className="w-32">{t("nuscene.approval") || "Approval"}</TableHead>
                          <TableHead className="w-40 text-right">{t("nuscene.actions") || "Actions"}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {variantRows.map((variantRow) => {
                          const variantKey = `${variantRow.product.id}-${variantRow.variant.id}`;
                          return (
                            <VariantTableRow
                              key={variantKey}
                              variantRow={variantRow}
                      shop={shopDomain || ""}
                              isSelected={selectedVariants.has(variantKey)}
                              onToggleSelect={() => handleToggleVariant(variantRow.product.id, variantRow.variant.id)}
                      onUpdate={handleProductUpdate}
                    />
                          );
                        })}
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
                      aria-label={t("nuscene.loadMore") || "Load More Products"}
                    >
                      <ChevronDown className="w-4 h-4 mr-2" aria-hidden="true" />
                      {productsLoading
                        ? (t("nuscene.loading") || "Loading...")
                        : (t("nuscene.loadMore") || "Load More")}
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
                  {t("nuscene.empty.title") || "No products found"}
                </h3>
                <p className="text-sm text-muted-foreground mb-6">
                  {t("nuscene.empty.description") || "Click 'Fetch Products' to load products created today with ACTIVE status."}
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

export default Nuscene;

