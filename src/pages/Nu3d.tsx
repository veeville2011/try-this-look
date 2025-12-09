import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useShop } from "@/providers/AppBridgeProvider";
import { useNu3dProducts } from "@/hooks/useNu3dProducts";
import NavigationBar from "@/components/NavigationBar";
import { Sparkles, Package, Store, ChevronDown, ChevronLeft, ChevronRight, CheckCircle2, XCircle, Loader2, Image as ImageIcon, Eye, Download, Info, Box, Zap, RefreshCw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { approveRejectBulk, approveRejectProduct, approveRejectImage, Nu3dProduct } from "@/services/nu3dApi";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface VariantRowData {
  product: Nu3dProduct;
  variant: Nu3dProduct["variants"]["nodes"][0];
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

      const successKey = action === "approve" ? "nu3d.product.approveSuccess" : "nu3d.product.rejectSuccess";
      toast.success(
        t(successKey) ||
          `Product ${action === "approve" ? "approved" : "rejected"} successfully`
      );
      onUpdate();
    } catch (error) {
      console.error(`[VariantTableRow] Failed to ${action} product:`, error);
      const errorKey = action === "approve" ? "nu3d.product.approveError" : "nu3d.product.rejectError";
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
    const hasCompleted3dImages = variantImages.some((img) => img.status === "completed" && (img.model_glb_url || img.gaussian_splat_url));

    if (hasApprovedImages && !hasPendingImages) {
      return (
        <Badge className="bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20 text-xs">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          {t("nu3d.dialog.approved") || "Approved"}
        </Badge>
      );
    }
    if (hasRejectedImages && !hasPendingImages) {
      return (
        <Badge className="bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20 text-xs">
          <XCircle className="w-3 h-3 mr-1" />
          {t("nu3d.dialog.rejected") || "Rejected"}
        </Badge>
      );
    }
    if (variantImages.length === 0) {
      return (
        <Badge className="bg-gray-500/10 text-gray-700 dark:text-gray-400 border-gray-500/20 text-xs">
          {t("nu3d.dialog.noImages") || "No Images"}
        </Badge>
      );
    }
    if (!hasCompleted3dImages) {
      return (
        <Badge className="bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20 text-xs">
          {t("nu3d.dialog.processing3d") || "Processing 3D"}
        </Badge>
      );
    }
    return (
      <Badge className="bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20 text-xs">
        {t("nu3d.dialog.pending") || "Pending"}
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
  product: Nu3dProduct;
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
  const completed3dImages = variantImages.filter(
    (img) => img.status === "completed" && (img.model_glb_url || img.gaussian_splat_url)
  );
  const displayImages = completed3dImages.length > 0 ? completed3dImages : variantImages;
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
        transformedImageUrl: transformedImageUrl || currentImage.model_glb_url || currentImage.gaussian_splat_url,
      });

      const successKey = action === "approve" ? "nu3d.image.approveSuccess" : "nu3d.image.rejectSuccess";
      toast.success(
        t(successKey) ||
          `Image ${action === "approve" ? "approved" : "rejected"} successfully`
      );
      onUpdate();
    } catch (error) {
      console.error(`[ProductDetailsDialog] Failed to ${action} image:`, error);
      const errorKey = action === "approve" ? "nu3d.image.approveError" : "nu3d.image.rejectError";
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

      const successKey = action === "approve" ? "nu3d.product.approveSuccess" : "nu3d.product.rejectSuccess";
      toast.success(
        t(successKey) ||
          `Product ${action === "approve" ? "approved" : "rejected"} successfully`
      );
      onUpdate();
    } catch (error) {
      console.error(`[ProductDetailsDialog] Failed to ${action} product:`, error);
      const errorKey = action === "approve" ? "nu3d.product.approveError" : "nu3d.product.rejectError";
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
            {t("nu3d.dialog.approved") || "Approved"}
          </Badge>
        );
      case "rejected":
        return (
          <Badge className="bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20">
            <XCircle className="w-3 h-3 mr-1" />
            {t("nu3d.dialog.rejected") || "Rejected"}
          </Badge>
        );
      default:
        return (
          <Badge className="bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20">
            {t("nu3d.dialog.pending") || "Pending"}
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
                <span className="text-muted-foreground">{t("nu3d.dialog.price") || "Price"}:</span>
                <span className="ml-2 font-medium">
                  {product.priceRangeV2.minVariantPrice.currencyCode} {product.priceRangeV2.minVariantPrice.amount}
                </span>
              </div>
              {product.vendor && (
                <div>
                  <span className="text-muted-foreground">{t("nu3d.dialog.vendor") || "Vendor"}:</span>
                  <span className="ml-2">{product.vendor}</span>
                </div>
              )}
              <div>
                <span className="text-muted-foreground">{t("nu3d.dialog.status") || "Status"}:</span>
                <span className="ml-2">{product.status}</span>
              </div>
              <div>
                <span className="text-muted-foreground">{t("nu3d.dialog.variants") || "Variants"}:</span>
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
                  <div className="flex items-center gap-3">
                    <ImageIcon className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium">
                      {t("nu3d.image.imageOf", { current: selectedImageIndex + 1, total: displayImages.length }) || `Image ${selectedImageIndex + 1} of ${displayImages.length}`}
                    </span>
                    {currentImage.cached && (
                      <Badge variant="outline" className="text-xs">
                        <Zap className="w-3 h-3 mr-1" />
                        {t("nu3d.image.cached") || "Cached"}
                      </Badge>
                    )}
                    {currentImage.status && (
                      <Badge 
                        className={`text-xs ${
                          currentImage.status === "completed" 
                            ? "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20"
                            : currentImage.status === "processing"
                            ? "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20"
                            : "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20"
                        }`}
                      >
                        {currentImage.status === "completed" && <CheckCircle2 className="w-3 h-3 mr-1" />}
                        {currentImage.status === "processing" && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                        {currentImage.status === "failed" && <XCircle className="w-3 h-3 mr-1" />}
                        {currentImage.status.toUpperCase()}
                      </Badge>
                    )}
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
                        aria-label={t("nu3d.image.previous") || "Previous image"}
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
                        aria-label={t("nu3d.image.next") || "Next image"}
                      >
                        <ChevronRight className="w-3 h-3" />
                      </Button>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Original Image */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">{t("nu3d.image.original") || "Original Image"}</span>
                      {currentImage.image_id && (
                        <span className="text-xs text-muted-foreground">ID: {currentImage.image_id}</span>
                      )}
                    </div>
                    <div className="relative aspect-square bg-muted rounded-lg overflow-hidden border border-border">
                      <img
                        src={currentImage.originalImageUrl}
                        alt={t("nu3d.image.original") || "Original"}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </div>
                    {currentImage.job_id && (
                      <div className="text-xs text-muted-foreground truncate">
                        <span className="font-medium">Job ID:</span> {currentImage.job_id}
                      </div>
                    )}
                  </div>

                  {/* 3D Model */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">{t("nu3d.image.model3d") || "3D Model"}</span>
                      {currentImage.approvalStatus && getApprovalStatusBadge(currentImage.approvalStatus)}
                    </div>
                    {currentImage.status === "completed" && (currentImage.model_glb_url || currentImage.gaussian_splat_url) ? (
                      <div className="space-y-3">
                        <div className="relative aspect-square bg-gradient-to-br from-primary/5 to-primary/10 rounded-lg overflow-hidden border-2 border-primary/20 flex flex-col items-center justify-center p-6 gap-3">
                          <Box className="w-12 h-12 text-primary" />
                          <div className="text-center space-y-1">
                            <span className="text-sm font-semibold text-foreground block">
                              {t("nu3d.image.model3dReady") || "3D Model Ready"}
                            </span>
                            <span className="text-xs text-muted-foreground block">
                              {t("nu3d.image.downloadFormats") || "Download available formats"}
                            </span>
                          </div>
                          <div className="flex flex-col gap-2 w-full">
                            {currentImage.model_glb_url && (
                              <a
                                href={currentImage.model_glb_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                download
                                className="flex items-center justify-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors text-xs font-medium"
                              >
                                <Download className="w-3 h-3" />
                                {t("nu3d.image.downloadGlb") || "Download GLB"}
                              </a>
                            )}
                            {currentImage.gaussian_splat_url && (
                              <a
                                href={currentImage.gaussian_splat_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                download
                                className="flex items-center justify-center gap-2 px-3 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/90 transition-colors text-xs font-medium"
                              >
                                <Download className="w-3 h-3" />
                                {t("nu3d.image.downloadSplat") || "Download Gaussian Splat"}
                              </a>
                            )}
                          </div>
                        </div>
                        
                        {/* Metadata Display */}
                        {/* Metadata Display */}
                        {currentImage.metadata && currentImage.metadata.length > 0 && currentImage.metadata[0] && (
                          <div className="space-y-2">
                            <button
                              onClick={() => setZoomImage(JSON.stringify(currentImage.metadata, null, 2))}
                              className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors w-full p-2 rounded-md hover:bg-muted"
                            >
                              <Info className="w-3 h-3" />
                              <span>{t("nu3d.image.viewMetadata") || "View Full Metadata"}</span>
                            </button>
                            <div className="text-xs space-y-1 p-2 bg-muted rounded-md">
                              {currentImage.metadata[0].scale && currentImage.metadata[0].scale[0] && (
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Scale:</span>
                                  <span className="font-mono">[{currentImage.metadata[0].scale[0].map((v: number) => v.toFixed(2)).join(", ")}]</span>
                                </div>
                              )}
                              {currentImage.metadata[0].translation && currentImage.metadata[0].translation[0] && (
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Position:</span>
                                  <span className="font-mono">[{currentImage.metadata[0].translation[0].map((v: number) => v.toFixed(2)).join(", ")}]</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : currentImage.status === "processing" ? (
                      <div className="aspect-square bg-muted rounded-lg flex flex-col items-center justify-center border-2 border-dashed border-blue-500/20 gap-2">
                        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                        <span className="text-sm font-medium text-foreground">
                          {t("nu3d.image.processing3d") || "Processing 3D Model..."}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {t("nu3d.image.pleaseWait") || "This may take 60-120 seconds"}
                        </span>
                      </div>
                    ) : currentImage.status === "failed" ? (
                      <div className="aspect-square bg-muted rounded-lg flex flex-col items-center justify-center border-2 border-dashed border-red-500/20 gap-2">
                        <XCircle className="w-8 h-8 text-red-500" />
                        <span className="text-sm font-medium text-red-600 dark:text-red-400">
                          {t("nu3d.image.failed") || "3D Generation Failed"}
                        </span>
                        {currentImage.message && (
                          <span className="text-xs text-muted-foreground text-center px-4">
                            {currentImage.message}
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="aspect-square bg-muted rounded-lg flex items-center justify-center border-2 border-dashed">
                        <span className="text-xs text-muted-foreground">
                          {t("nu3d.image.notAvailable") || "3D Model Not Available"}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Image Actions */}
                {currentImage.status === "completed" &&
                  currentImage.approvalStatus === "pending" &&
                  (currentImage.model_glb_url || currentImage.gaussian_splat_url) && (
                    <div className="flex gap-2 justify-end">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          handleImageAction(
                            "reject",
                            currentImage.id,
                            currentImage.image_id,
                            currentImage.model_glb_url || currentImage.gaussian_splat_url
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
                        <span className="text-red-700 dark:text-red-300">{t("nu3d.dialog.reject") || "Reject"}</span>
                      </Button>
                      <Button
                        size="sm"
                        onClick={() =>
                          handleImageAction(
                            "approve",
                            currentImage.id,
                            currentImage.image_id,
                            currentImage.model_glb_url || currentImage.gaussian_splat_url
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
                        {t("nu3d.dialog.approve") || "Approve"}
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
                <span className="text-green-700 dark:text-green-300">{t("nu3d.dialog.approveAll") || "Approve All"}</span>
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
                <span className="text-red-700 dark:text-red-300">{t("nu3d.dialog.rejectAll") || "Reject All"}</span>
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Metadata Dialog */}
      <Dialog open={!!zoomImage} onOpenChange={() => setZoomImage(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("nu3d.image.metadata") || "3D Model Metadata"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {zoomImage && (
              <pre className="p-4 bg-muted rounded-lg overflow-x-auto text-xs font-mono max-h-96 overflow-y-auto">
                {zoomImage}
              </pre>
            )}
            {currentImage && currentImage.metadata && currentImage.metadata.length > 0 && currentImage.metadata[0] && (
              <div className="space-y-3">
                <h4 className="text-sm font-semibold">{t("nu3d.image.formattedMetadata") || "Formatted Metadata"}</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {currentImage.metadata[0].scale && currentImage.metadata[0].scale[0] && (
                    <div>
                      <span className="text-muted-foreground font-medium">Scale:</span>
                      <div className="mt-1 font-mono text-xs">
                        X: {currentImage.metadata[0].scale[0][0]?.toFixed(4)}<br />
                        Y: {currentImage.metadata[0].scale[0][1]?.toFixed(4)}<br />
                        Z: {currentImage.metadata[0].scale[0][2]?.toFixed(4)}
                      </div>
                    </div>
                  )}
                  {currentImage.metadata[0].translation && currentImage.metadata[0].translation[0] && (
                    <div>
                      <span className="text-muted-foreground font-medium">Translation:</span>
                      <div className="mt-1 font-mono text-xs">
                        X: {currentImage.metadata[0].translation[0][0]?.toFixed(4)}<br />
                        Y: {currentImage.metadata[0].translation[0][1]?.toFixed(4)}<br />
                        Z: {currentImage.metadata[0].translation[0][2]?.toFixed(4)}
                      </div>
                    </div>
                  )}
                  {currentImage.metadata[0].rotation && currentImage.metadata[0].rotation[0] && (
                    <div className="col-span-2">
                      <span className="text-muted-foreground font-medium">Rotation (Quaternion):</span>
                      <div className="mt-1 font-mono text-xs">
                        W: {currentImage.metadata[0].rotation[0][0]?.toFixed(4)}<br />
                        X: {currentImage.metadata[0].rotation[0][1]?.toFixed(4)}<br />
                        Y: {currentImage.metadata[0].rotation[0][2]?.toFixed(4)}<br />
                        Z: {currentImage.metadata[0].rotation[0][3]?.toFixed(4)}
                      </div>
                    </div>
                  )}
                  {currentImage.metadata[0].object_index !== undefined && (
                    <div>
                      <span className="text-muted-foreground font-medium">Object Index:</span>
                      <div className="mt-1 font-mono text-xs">
                        {currentImage.metadata[0].object_index}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

const Nu3d = () => {
  const { t } = useTranslation();
  const shop = useShop();

  // Get shop domain from hook or URL params
  const shopDomain =
    shop || new URLSearchParams(window.location.search).get("shop");

  // Use nu3d products hook
  const {
    products,
    loading: productsLoading,
    error: productsError,
    hasNextPage,
    total,
    fetchProducts,
    loadMore,
    refresh,
  } = useNu3dProducts(shopDomain);

  // Bulk selection state - using variant IDs (format: "productId-variantId")
  const [selectedVariants, setSelectedVariants] = useState<Set<string>>(new Set());
  const [processingBulk, setProcessingBulk] = useState(false);

  // Track if we've already fetched on mount to prevent duplicate calls

  // Flatten products into variant rows
  const variantRows: VariantRowData[] = products.flatMap((product) =>
    product.variants.nodes.map((variant, index) => ({
      product,
      variant,
      variantIndex: index,
    }))
  );

  // Fetch products immediately on mount or when shopDomain becomes available
  // Removed automatic fetch on mount - products will only be fetched when user clicks refresh button

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
      console.warn("[Nu3d] Failed to fetch products:", error);
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
        t("nu3d.loadMoreSuccess") || 
        "More products loaded successfully"
      );
    } catch (error) {
      console.warn("[Nu3d] Failed to load more products:", error);
      toast.error(
        t("nu3d.loadMoreError") || 
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
        t("nu3d.bulk.noSelection") || 
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

      const successKey = action === "approve" ? "nu3d.bulk.approveSuccess" : "nu3d.bulk.rejectSuccess";
      toast.success(
        t(successKey, { count: result.processed }) ||
          `Successfully ${action === "approve" ? "approved" : "rejected"} ${result.processed} product${result.processed !== 1 ? "s" : ""}`
      );
      
      setSelectedVariants(new Set());
      await refresh();
    } catch (error) {
      console.error(`[Nu3d] Failed to bulk ${action}:`, error);
      const errorKey = action === "approve" ? "nu3d.bulk.approveError" : "nu3d.bulk.rejectError";
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
      {/* Navigation Bar */}
      <NavigationBar />

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
                    {t("nu3d.title") || "Nu3d Products"}
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    {t("nu3d.description") || "Manage products created today"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {variantRows.length > 0 && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Package className="w-4 h-4" />
                    <span>{variantRows.length} {t("nu3d.variants") || "variants"}</span>
                    <span className="text-muted-foreground/70">•</span>
                    <span>{total} {t("nu3d.products") || "products"}</span>
                  </div>
                )}
                <Button
                  onClick={handleFetchProducts}
                  disabled={productsLoading}
                  size="icon"
                  variant="outline"
                  className="h-9 w-9 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                  aria-label={t("nu3d.refresh") || "Refresh products"}
                >
                  {productsLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
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
            {productsLoading && products.length === 0 ? (
              <Card className="border border-border shadow-sm bg-card">
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[50px]"><Skeleton className="h-4 w-4" /></TableHead>
                        <TableHead className="w-[80px]"><Skeleton className="h-4 w-12" /></TableHead>
                        <TableHead><Skeleton className="h-4 w-32" /></TableHead>
                        <TableHead><Skeleton className="h-4 w-24" /></TableHead>
                        <TableHead className="text-right"><Skeleton className="h-4 w-20" /></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[...Array(5)].map((_, i) => (
                        <TableRow key={i}>
                          <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                          <TableCell><Skeleton className="h-16 w-16" /></TableCell>
                          <TableCell>
                            <Skeleton className="h-4 w-48 mb-1" />
                            <Skeleton className="h-3 w-32" />
                          </TableCell>
                          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                          <TableCell className="text-right">
                            <Skeleton className="h-8 w-24 ml-auto" />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ) : products.length > 0 ? (
              <div className="space-y-4">
                {/* Bulk Actions Bar */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-muted/30 rounded-lg border border-border">
                  <div className="flex items-center gap-3">
                        <Checkbox
                          id="select-all"
                      checked={selectedVariants.size === variantRows.length && variantRows.length > 0}
                          onCheckedChange={handleSelectAll}
                      aria-label={t("nu3d.selectAll") || "Select all variants"}
                        />
                        <label
                          htmlFor="select-all"
                      className="text-sm font-medium text-foreground cursor-pointer"
                        >
                          {t("nu3d.selectAll") || "Select All"}
                        </label>
                    {selectedVariants.size > 0 && (
                      <span className="text-sm text-muted-foreground">
                        ({selectedVariants.size} {t("nu3d.selected") || "selected"})
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
                        aria-label={t("nu3d.bulk.approve") || "Approve Selected"}
                      >
                        {processingBulk ? (
                          <Loader2 className="w-3 h-3 animate-spin mr-1 text-green-600 dark:text-green-400" />
                        ) : (
                          <CheckCircle2 className="w-3 h-3 mr-1 text-green-600 dark:text-green-400" />
                        )}
                        <span className="text-green-700 dark:text-green-300">{t("nu3d.bulk.approve") || "Approve"}</span>
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleBulkAction("reject")}
                        disabled={processingBulk}
                        className="h-8 text-xs border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-950 hover:border-red-300 dark:hover:border-red-700"
                        aria-label={t("nu3d.bulk.reject") || "Reject Selected"}
                      >
                        {processingBulk ? (
                          <Loader2 className="w-3 h-3 animate-spin mr-1 text-red-600 dark:text-red-400" />
                        ) : (
                          <XCircle className="w-3 h-3 mr-1 text-red-600 dark:text-red-400" />
                        )}
                        <span className="text-red-700 dark:text-red-300">{t("nu3d.bulk.reject") || "Reject"}</span>
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
                            <span className="sr-only">{t("nu3d.select") || "Select"}</span>
                          </TableHead>
                          <TableHead className="w-20">{t("nu3d.imageLabel") || "Image"}</TableHead>
                          <TableHead className="min-w-[200px]">{t("nu3d.productLabel") || "Product / Variant"}</TableHead>
                          <TableHead className="w-24">{t("nu3d.status") || "Status"}</TableHead>
                          <TableHead className="w-32">{t("nu3d.price") || "Price"}</TableHead>
                          <TableHead className="w-32">{t("nu3d.sku") || "SKU / Inventory"}</TableHead>
                          <TableHead className="w-32">{t("nu3d.approval") || "Approval"}</TableHead>
                          <TableHead className="w-40 text-right">{t("nu3d.actions") || "Actions"}</TableHead>
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
                      aria-label={t("nu3d.loadMore") || "Load More Products"}
                    >
                      <ChevronDown className="w-4 h-4 mr-2" aria-hidden="true" />
                      {productsLoading
                        ? (t("nu3d.loading") || "Loading...")
                        : (t("nu3d.loadMore") || "Load More")}
                    </Button>
                  </div>
                )}
              </div>
            ) : null}

            {/* Empty State */}
            {!productsLoading && products.length === 0 && !productsError && (
              <Card className="p-12 text-center border-border bg-card">
                <Package className="w-12 h-12 mx-auto mb-4 text-muted-foreground" aria-hidden="true" />
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  {t("nu3d.empty.title") || "No products found"}
                </h3>
                <p className="text-sm text-muted-foreground mb-6">
                  {t("nu3d.empty.description") || "Click 'Fetch Products' to load products created today with ACTIVE status."}
                </p>
                <Button
                  onClick={handleFetchProducts}
                  disabled={productsLoading}
                  size="icon"
                  variant="outline"
                  className="h-9 w-9 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                  aria-label={t("nu3d.refresh") || "Refresh products"}
                >
                  {productsLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                </Button>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Nu3d;

