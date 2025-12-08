import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  XCircle,
  Image as ImageIcon,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
} from "lucide-react";
import { toast } from "sonner";
import { NulightProduct } from "@/services/nulightApi";
import { approveRejectImage, approveRejectProduct } from "@/services/nulightApi";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface NulightProductCardProps {
  product: NulightProduct;
  shop: string;
  onUpdate: () => void;
}

const NulightProductCard = ({
  product,
  shop,
  onUpdate,
}: NulightProductCardProps) => {
  const { t } = useTranslation();
  const [processingImageId, setProcessingImageId] = useState<string | null>(null);
  const [processingProduct, setProcessingProduct] = useState(false);
  const [selectedVariantIndex, setSelectedVariantIndex] = useState(0);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [zoomImage, setZoomImage] = useState<string | null>(null);

  const variant = product.variants.nodes[selectedVariantIndex];
  const variantImages = variant?.images || [];

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
      console.error(`[NulightProductCard] Failed to ${action} image:`, error);
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
      console.error(`[NulightProductCard] Failed to ${action} product:`, error);
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

  const getRelightingStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return (
          <Badge variant="outline" className="text-xs">
            Completed
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="destructive" className="text-xs">
            Failed
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="text-xs">
            Processing
          </Badge>
        );
    }
  };

  if (!variant) {
    return (
      <Card className="overflow-hidden border-border bg-card">
        <CardContent className="p-6 text-center">
          <p className="text-sm text-muted-foreground">
            No variants available for this product
          </p>
        </CardContent>
      </Card>
    );
  }

  // Filter images that have relighting data
  const relightedImages = variantImages.filter(
    (img) => img.relightingStatus === "completed" && img.transformedImageUrls.length > 0
  );

  if (relightedImages.length === 0 && variantImages.length === 0) {
    return (
      <Card className="overflow-hidden border-border bg-card">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-foreground line-clamp-2">
            {product.title}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 text-center">
          <p className="text-sm text-muted-foreground">
            No relighted images available for review
          </p>
        </CardContent>
      </Card>
    );
  }

  // Use relighted images if available, otherwise use all images
  const displayImages = relightedImages.length > 0 ? relightedImages : variantImages;
  const currentImage = displayImages[selectedImageIndex] || displayImages[0];

  const currentImage = variantImages[selectedImageIndex];
  const hasMultipleImages = variantImages.length > 1;
  const hasMultipleVariants = product.variants.nodes.length > 1;

  return (
    <>
      <Card className="overflow-hidden border-border bg-card hover:shadow-lg transition-shadow">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <CardTitle className="text-lg font-semibold text-foreground line-clamp-2 mb-2">
                {product.title}
              </CardTitle>
              <div className="flex flex-wrap items-center gap-2">
                {product.status && (
                  <Badge
                    className={
                      product.status === "ACTIVE"
                        ? "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20"
                        : "bg-gray-500/10 text-gray-700 dark:text-gray-400 border-gray-500/20"
                    }
                  >
                    {product.status}
                  </Badge>
                )}
                {hasMultipleVariants && (
                  <Badge variant="outline" className="text-xs">
                    {product.variants.nodes.length} Variants
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleProductAction("approve")}
                disabled={processingProduct}
                className="h-8 text-xs"
                aria-label={t("nulight.product.approve") || "Approve Product"}
              >
                {processingProduct ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <>
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Approve All
                  </>
                )}
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => handleProductAction("reject")}
                disabled={processingProduct}
                className="h-8 text-xs"
                aria-label={t("nulight.product.reject") || "Reject Product"}
              >
                {processingProduct ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <>
                    <XCircle className="w-3 h-3 mr-1" />
                    Reject All
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Variant Selector */}
          {hasMultipleVariants && (
            <div className="mt-3 flex flex-wrap gap-2">
              {product.variants.nodes.map((v, index) => (
                <Button
                  key={v.id}
                  size="sm"
                  variant={selectedVariantIndex === index ? "default" : "outline"}
                  onClick={() => {
                    setSelectedVariantIndex(index);
                    setSelectedImageIndex(0);
                  }}
                  className="h-7 text-xs"
                >
                  {v.title}
                </Button>
              ))}
            </div>
          )}
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Image Comparison */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">
                  Image {selectedImageIndex + 1} of {displayImages.length}
                </span>
                {currentImage && getRelightingStatusBadge(currentImage.relightingStatus)}
              </div>
              {hasMultipleImages && (
                <div className="flex gap-1">
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-7 w-7"
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
                    className="h-7 w-7"
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

            {/* Original vs Transformed Comparison */}
            {currentImage && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Original Image */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">
                      Original
                    </span>
                  </div>
                  <div className="relative aspect-square bg-muted rounded-lg overflow-hidden group">
                    <img
                      src={currentImage.originalImageUrl}
                      alt={currentImage.altText || "Original image"}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    <button
                      onClick={() => setZoomImage(currentImage.originalImageUrl)}
                      className="absolute inset-0 bg-black/0 hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100"
                      aria-label="Zoom image"
                    >
                      <ZoomIn className="w-6 h-6 text-white" />
                    </button>
                  </div>
                </div>

                {/* Transformed Images */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">
                      Relighted
                    </span>
                    {getApprovalStatusBadge(currentImage.approvalStatus)}
                  </div>
                  {currentImage.transformedImageUrls.length > 0 ? (
                    <div className="relative aspect-square bg-muted rounded-lg overflow-hidden group">
                      <img
                        src={currentImage.transformedImageUrls[0]}
                        alt="Relighted image"
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                      <button
                        onClick={() =>
                          setZoomImage(currentImage.transformedImageUrls[0])
                        }
                        className="absolute inset-0 bg-black/0 hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100"
                        aria-label="Zoom image"
                      >
                        <ZoomIn className="w-6 h-6 text-white" />
                      </button>
                    </div>
                  ) : (
                    <div className="aspect-square bg-muted rounded-lg flex items-center justify-center">
                      <span className="text-xs text-muted-foreground">
                        No transformed image
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Image Actions */}
            {currentImage &&
              currentImage.relightingStatus === "completed" &&
              currentImage.approvalStatus === "pending" && (
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
                    className="h-8 text-xs"
                    aria-label={t("nulight.image.reject") || "Reject Image"}
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
                    className="h-8 text-xs"
                    aria-label={t("nulight.image.approve") || "Approve Image"}
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

          {/* Product Info */}
          <div className="pt-3 border-t border-border">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Price</span>
              <span className="font-semibold text-foreground">
                {product.priceRangeV2.minVariantPrice.currencyCode}{" "}
                {product.priceRangeV2.minVariantPrice.amount}
              </span>
            </div>
            {product.vendor && (
              <div className="flex items-center justify-between text-sm mt-1">
                <span className="text-muted-foreground">Vendor</span>
                <span className="text-foreground">{product.vendor}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

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

export default NulightProductCard;

