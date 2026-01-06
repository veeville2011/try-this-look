import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useShop } from "@/providers/AppBridgeProvider";
import { useNusceneProducts } from "@/hooks/useNusceneProducts";
import { fetchAllStoreProducts } from "@/services/productsApi";
import NavigationBar from "@/components/NavigationBar";
import { Sparkles, Package, Store, ChevronDown, ChevronLeft, ChevronRight, CheckCircle2, XCircle, Loader2, Image as ImageIcon, Eye, Play, Video, RefreshCw, Maximize2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { approveRejectBulk, approveRejectProduct, approveRejectVideo, NusceneProduct } from "@/services/nusceneApi";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface VariantRowData {
  product: NusceneProduct;
  variant: NusceneProduct["variants"]["nodes"][0];
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
    const variantVideos = variant.images || [];
    const hasApprovedVideos = variantVideos.some((vid) => vid.approvalStatus === "approved");
    const hasRejectedVideos = variantVideos.some((vid) => vid.approvalStatus === "rejected");
    const hasPendingVideos = variantVideos.some((vid) => vid.approvalStatus === "pending");

    if (hasApprovedVideos && !hasPendingVideos) {
      return (
        <Badge className="bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20 text-xs">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          {t("nuscene.dialog.approved") || "Approved"}
        </Badge>
      );
    }
    if (hasRejectedVideos && !hasPendingVideos) {
      return (
        <Badge className="bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20 text-xs">
          <XCircle className="w-3 h-3 mr-1" />
          {t("nuscene.dialog.rejected") || "Rejected"}
        </Badge>
      );
    }
    if (variantVideos.length === 0) {
      return (
        <Badge className="bg-gray-500/10 text-gray-700 dark:text-gray-400 border-gray-500/20 text-xs">
          {t("nuscene.dialog.noVideos") || "No Videos"}
        </Badge>
      );
    }
    return (
      <Badge className="bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20 text-xs">
        {t("nuscene.dialog.pending") || "Pending"}
      </Badge>
    );
  };

  // Get variant image from media or fallback to product image
  const variantImage = variant.media?.nodes[0]?.image?.url || product.media?.nodes[0]?.image?.url || "";
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
            aria-label={t("nuscene.ariaLabels.selectVariant", { product: product.title, variant: variant.title }) || `Select ${product.title} - ${variant.title}`}
          />
        </TableCell>
        <TableCell>
          {variantImage ? (
            <div className="relative w-16 h-16 rounded-md overflow-hidden bg-muted border border-border">
              <img
                src={variantImage}
                alt={variant.title || t("nuscene.imageLabel") || "Image"}
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
              {variant.sku || t("nuscene.notAvailable") || "N/A"}
            </span>
            {variant.inventoryQuantity !== null && (
              <span className="text-xs text-muted-foreground">
                {t("nuscene.quantityLabel") || "Qty:"} {variant.inventoryQuantity}
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
              aria-label={t("nuscene.ariaLabels.viewDetails", { product: product.title, variant: variant.title }) || `View details for ${product.title} - ${variant.title}`}
            >
              <Eye className="w-4 h-4 text-muted-foreground" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleProductAction("approve")}
              disabled={processingProduct}
              className="h-8 w-8 p-0 hover:bg-green-500/10 hover:text-green-600 dark:hover:text-green-400"
              aria-label={t("nuscene.ariaLabels.approveProduct", { product: product.title }) || `Approve ${product.title}`}
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
              aria-label={t("nuscene.ariaLabels.rejectProduct", { product: product.title }) || `Reject ${product.title}`}
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
  product: NusceneProduct;
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
  
  const [selectedVideoIndex, setSelectedVideoIndex] = useState(0);
  const [processingVideoId, setProcessingVideoId] = useState<string | null>(null);
  const [processingProduct, setProcessingProduct] = useState(false);
  const [zoomVideo, setZoomVideo] = useState<string | null>(null);

  const variant = product.variants.nodes[selectedVariantIndex] || product.variants.nodes[0] || null;
  const variantVideos = variant?.images || [];
  const completedVideos = variantVideos.filter(
    (vid) => vid.videoStatus === "completed" && vid.video_url
  );
  const displayVideos = completedVideos.length > 0 ? completedVideos : variantVideos;
  const currentVideo = displayVideos[selectedVideoIndex] || displayVideos[0];

  const handleVideoAction = async (
    action: "approve" | "reject",
    imageId: string,
    videoId: number,
    videoUrl?: string
  ) => {
    if (!variant) return;

    setProcessingVideoId(imageId);
    try {
      await approveRejectVideo({
        shop,
        productId: product.id,
        variantId: variant.id,
        imageId,
        videoId,
        videoUrl,
      });

      const successKey = action === "approve" ? "nuscene.video.approveSuccess" : "nuscene.video.rejectSuccess";
      toast.success(
        t(successKey) ||
          `Video ${action === "approve" ? "approved" : "rejected"} successfully`
      );
      onUpdate();
    } catch (error) {
      console.error(`[ProductDetailsDialog] Failed to ${action} video:`, error);
      const errorKey = action === "approve" ? "nuscene.video.approveError" : "nuscene.video.rejectError";
      toast.error(
        error instanceof Error
          ? error.message
          : t(errorKey) ||
              `Failed to ${action} video. Please try again.`
      );
    } finally {
      setProcessingVideoId(null);
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

  const getVideoStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return (
          <Badge className="bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20 text-xs">
            {t("nuscene.video.completed")}
          </Badge>
        );
      case "processing":
        return (
          <Badge className="bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20 text-xs">
            {t("nuscene.video.processing")}
          </Badge>
        );
      case "failed":
        return (
          <Badge className="bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20 text-xs">
            {t("nuscene.video.failed")}
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
                    setSelectedVideoIndex(0);
                  }}
                  className="h-8 text-xs"
                >
                  {v.title}
                </Button>
              ))}
            </div>
          )}

          {/* Video Display */}
          {currentVideo && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Video className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">
                    {t("nuscene.video.videoOf", { current: selectedVideoIndex + 1, total: displayVideos.length })}
                  </span>
                  {currentVideo.videoStatus && getVideoStatusBadge(currentVideo.videoStatus)}
                </div>
                {displayVideos.length > 1 && (
                  <div className="flex gap-1">
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-8 w-8"
                      onClick={() =>
                        setSelectedVideoIndex((prev) =>
                          prev > 0 ? prev - 1 : displayVideos.length - 1
                        )
                      }
                      aria-label={t("nuscene.video.previous")}
                    >
                      <ChevronLeft className="w-3 h-3" />
                    </Button>
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-8 w-8"
                      onClick={() =>
                        setSelectedVideoIndex((prev) =>
                          prev < displayVideos.length - 1 ? prev + 1 : 0
                        )
                      }
                      aria-label={t("nuscene.video.next")}
                    >
                      <ChevronRight className="w-3 h-3" />
                    </Button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <span className="text-xs font-medium text-muted-foreground">
                    {t("nuscene.video.original")}
                  </span>
                  <div className="relative aspect-square bg-muted rounded-lg overflow-hidden">
                    <img
                      src={currentVideo.originalImageUrl || currentVideo.original_url}
                      alt={t("nuscene.video.original")}
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">
                      {t("nuscene.video.generated")}
                    </span>
                    {currentVideo.approvalStatus && getApprovalStatusBadge(currentVideo.approvalStatus)}
                  </div>
                  {currentVideo.videoStatus === "completed" && currentVideo.video_url ? (
                    <div className="relative aspect-square bg-muted rounded-lg overflow-hidden group">
                      <video
                        src={currentVideo.video_url}
                        controls
                        className="w-full h-full object-cover"
                        preload="metadata"
                      >
                        {t("nuscene.video.notSupported")}
                      </video>
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="bg-black/20 rounded-full p-2">
                          <Play className="w-6 h-6 text-white" />
                        </div>
                      </div>
                      <Button
                        onClick={() => setZoomVideo(currentVideo.video_url)}
                        size="sm"
                        variant="secondary"
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-auto shadow-lg"
                        aria-label={t("nuscene.video.zoom") || "Zoom video"}
                      >
                        <Maximize2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : currentVideo.videoStatus === "processing" ? (
                    <div className="aspect-square bg-muted rounded-lg flex flex-col items-center justify-center border-2 border-dashed">
                      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground mb-2" />
                      <span className="text-xs text-muted-foreground">
                        {t("nuscene.video.processing")}
                      </span>
                    </div>
                  ) : (
                    <div className="aspect-square bg-muted rounded-lg flex items-center justify-center border-2 border-dashed">
                      <span className="text-xs text-muted-foreground">
                        {t("nuscene.video.notAvailable")}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Video Info */}
              {currentVideo.videoStatus === "completed" && currentVideo.video_url && (
                <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground">
                  {currentVideo.duration && (
                    <div>
                      <span className="font-medium">{t("nuscene.video.duration")}:</span>
                      <span className="ml-2">{currentVideo.duration}s</span>
                    </div>
                  )}
                  {currentVideo.resolution && (
                    <div>
                      <span className="font-medium">{t("nuscene.video.resolution")}:</span>
                      <span className="ml-2">{currentVideo.resolution}</span>
                    </div>
                  )}
                  {currentVideo.aspect_ratio && (
                    <div>
                      <span className="font-medium">{t("nuscene.video.aspectRatio")}:</span>
                      <span className="ml-2">{currentVideo.aspect_ratio}</span>
                    </div>
                  )}
                  {currentVideo.prompt && (
                    <div className="col-span-2">
                      <span className="font-medium">{t("nuscene.video.prompt")}:</span>
                      <p className="mt-1 text-xs line-clamp-2">{currentVideo.prompt}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Video Actions */}
              {currentVideo.videoStatus === "completed" &&
                currentVideo.approvalStatus === "pending" &&
                currentVideo.video_url && (
                  <div className="flex gap-2 justify-end">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        handleVideoAction(
                          "reject",
                          currentVideo.id,
                          currentVideo.videoId || currentVideo.video_id,
                          currentVideo.video_url || undefined
                        )
                      }
                      disabled={processingVideoId === currentVideo.id}
                      className="border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-950 hover:border-red-300 dark:hover:border-red-700"
                    >
                      {processingVideoId === currentVideo.id ? (
                        <Loader2 className="w-3 h-3 animate-spin mr-1 text-red-600 dark:text-red-400" />
                      ) : (
                        <XCircle className="w-3 h-3 mr-1 text-red-600 dark:text-red-400" />
                      )}
                      <span className="text-red-700 dark:text-red-300">{t("nuscene.dialog.reject") || "Reject"}</span>
                    </Button>
                    <Button
                      size="sm"
                      onClick={() =>
                        handleVideoAction(
                          "approve",
                          currentVideo.id,
                          currentVideo.videoId || currentVideo.video_id,
                          currentVideo.video_url || undefined
                        )
                      }
                      disabled={processingVideoId === currentVideo.id}
                      className="bg-green-600 hover:bg-green-700 text-white border-green-600 hover:border-green-700"
                    >
                      {processingVideoId === currentVideo.id ? (
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

    {/* Zoom Video Dialog */}
    <Dialog open={!!zoomVideo} onOpenChange={() => setZoomVideo(null)}>
      <DialogContent className="max-w-4xl p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle>{t("nuscene.video.preview") || "Video Preview"}</DialogTitle>
        </DialogHeader>
        <div className="p-6">
          {zoomVideo && (
            <video
              src={zoomVideo}
              controls
              className="w-full h-auto rounded-lg max-h-[80vh]"
              preload="metadata"
              autoPlay
            >
              {t("nuscene.video.notSupported")}
            </video>
          )}
        </div>
      </DialogContent>
    </Dialog>
  </>
  );
};

const Nuscene = () => {
  const { t } = useTranslation();
  const shop = useShop();

  // Get shop domain from hook or URL params
  const shopDomain =
    shop || new URLSearchParams(window.location.search).get("shop");

  // Use nuscene products hook
  const {
    products,
    loading: productsLoading,
    error: productsError,
    hasNextPage,
    total,
    fetchProducts,
    loadMore,
    refresh,
  } = useNusceneProducts(shopDomain);

  // Bulk selection state - using variant IDs (format: "productId-variantId")
  const [selectedVariants, setSelectedVariants] = useState<Set<string>>(new Set());
  const [processingBulk, setProcessingBulk] = useState(false);
  
  // Track if this is the first load and store initial products
  const isFirstLoadRef = useRef(true);
  const [initialProducts, setInitialProducts] = useState<NusceneProduct[]>([]);
  const [initialLoading, setInitialLoading] = useState(false);
  const [hasRefreshed, setHasRefreshed] = useState(false);

  // Fetch products from /api/products on first load
  useEffect(() => {
    if (!shopDomain || !isFirstLoadRef.current || hasRefreshed) {
      return;
    }

    const fetchInitialProducts = async () => {
      isFirstLoadRef.current = false;
      setInitialLoading(true);
      const normalizedShop = shopDomain.replace(".myshopify.com", "");
      
      try {
        const response = await fetchAllStoreProducts(normalizedShop, {
          status: "ACTIVE",
          limit: 50,
        });

        if (response.success && response.products && response.products.length > 0) {
          // Transform the simple product structure to match NusceneProduct format
          const transformedProducts: NusceneProduct[] = response.products.map((productImage) => {
            const productId = productImage.productId.replace("gid://shopify/Product/", "");
            
            return {
              id: productImage.productId,
              title: productImage.productTitle,
              handle: productImage.productHandle,
              description: "",
              descriptionHtml: "",
              vendor: "",
              productType: "",
              status: "ACTIVE",
              tags: [],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              publishedAt: new Date().toISOString(),
              onlineStoreUrl: null,
              onlineStorePreviewUrl: null,
              totalInventory: 0,
              hasOnlyDefaultVariant: true,
              hasOutOfStockVariants: false,
              priceRangeV2: {
                minVariantPrice: { amount: "0.00", currencyCode: "USD" },
                maxVariantPrice: { amount: "0.00", currencyCode: "USD" },
              },
              media: {
                nodes: [{
                  id: productImage.imageId,
                  image: {
                    id: productImage.imageId,
                    url: productImage.imageUrl,
                    altText: productImage.altText || null,
                    width: 1024,
                    height: 1024,
                  },
                }],
              },
              variants: {
                nodes: [{
                  id: `gid://shopify/ProductVariant/${productId}`,
                  title: "Default",
                  sku: null,
                  barcode: null,
                  price: "0.00",
                  compareAtPrice: null,
                  availableForSale: true,
                  inventoryQuantity: null,
                  inventoryPolicy: "DENY",
                  media: {
                    nodes: [{
                      id: productImage.imageId,
                      image: {
                        id: productImage.imageId,
                        url: productImage.imageUrl,
                        altText: productImage.altText || null,
                        width: 1024,
                        height: 1024,
                      },
                    }],
                  },
                  selectedOptions: [],
                  images: [],
                }],
              },
            };
          });

          setInitialProducts(transformedProducts);
        }
      } catch (error) {
        console.warn("[Nuscene] Failed to fetch initial products from /api/products:", error);
      } finally {
        setInitialLoading(false);
      }
    };

    fetchInitialProducts();
  }, [shopDomain, hasRefreshed]);

  // Use initial products if available and not refreshed, otherwise use hook products
  const displayProducts = hasRefreshed || initialProducts.length === 0 ? products : initialProducts;
  const displayLoading = hasRefreshed ? productsLoading : initialLoading;
  const displayError = hasRefreshed ? productsError : null;
  const displayTotal = hasRefreshed ? total : initialProducts.length;

  // Flatten products into variant rows
  const variantRows: VariantRowData[] = displayProducts.flatMap((product) =>
    product.variants.nodes.map((variant, index) => ({
      product,
      variant,
      variantIndex: index,
    }))
  );

  // Handle manual product fetch (refresh button) - uses specific API
  const handleFetchProducts = async () => {
    if (!shopDomain) {
      toast.error(t("index.errors.shopNotFound") || "Shop domain not found");
      return;
    }

    // Mark as refreshed so we use the specific API
    setHasRefreshed(true);

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
      <NavigationBar />

      <main className="min-h-[calc(100vh-56px)] py-6" role="main">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
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
                    {t("nuscene.description") || "Manage products with generated videos"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {variantRows.length > 0 && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Package className="w-4 h-4" />
                    <span>{variantRows.length} {t("nuscene.variants") || "variants"}</span>
                    <span className="text-muted-foreground/70">•</span>
                    <span>{displayTotal} {t("nuscene.products") || "products"}</span>
                  </div>
                )}
                <Button
                  onClick={handleFetchProducts}
                  disabled={displayLoading}
                  size="icon"
                  variant="outline"
                  className="h-9 w-9 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                  aria-label={t("nuscene.refresh") || "Refresh products"}
                >
                  {displayLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>

            {displayError && (
              <Card className="mb-6 p-4 border-destructive/50 bg-destructive/10">
                <p className="text-sm text-destructive">
                  {displayError}
                </p>
              </Card>
            )}

            {displayLoading && displayProducts.length === 0 ? (
              <Card className="border border-border shadow-sm bg-card">
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12"><Skeleton className="h-4 w-4" /></TableHead>
                        <TableHead className="w-20"><Skeleton className="h-4 w-12" /></TableHead>
                        <TableHead><Skeleton className="h-4 w-32" /></TableHead>
                        <TableHead><Skeleton className="h-4 w-24" /></TableHead>
                        <TableHead><Skeleton className="h-4 w-20" /></TableHead>
                        <TableHead><Skeleton className="h-4 w-24" /></TableHead>
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
                          <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
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
            ) : displayProducts.length > 0 ? (
              <div className="space-y-4">
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

                {hasNextPage && (
                  <div className="flex justify-center pt-4">
                    <Button
                      onClick={handleLoadMore}
                      disabled={displayLoading || !hasRefreshed}
                      variant="outline"
                      className="h-10 px-6 font-medium focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                      aria-label={t("nuscene.loadMore") || "Load More Products"}
                    >
                      <ChevronDown className="w-4 h-4 mr-2" aria-hidden="true" />
                      {displayLoading
                        ? (t("nuscene.loading") || "Loading...")
                        : (t("nuscene.loadMore") || "Load More")}
                    </Button>
                  </div>
                )}
              </div>
            ) : null}

            {!displayLoading && displayProducts.length === 0 && !displayError && (
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
                  disabled={displayLoading}
                  size="icon"
                  variant="outline"
                  className="h-9 w-9 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                  aria-label={t("nuscene.refresh") || "Refresh products"}
                >
                  {displayLoading ? (
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

export default Nuscene;
