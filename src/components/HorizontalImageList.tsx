import { useState, useRef, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, Image as ImageIcon, Loader2, Maximize2, X, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface ImageItem {
  id: string;
  imageUrl: string;
  alt?: string;
  metadata?: {
    createdAt?: string;
    uploadedAt?: string;
    [key: string]: any;
  };
}

interface HorizontalImageListProps {
  title: string;
  images: ImageItem[];
  loading?: boolean;
  emptyMessage?: string;
  emptyActionLabel?: string;
  onImageClick?: (image: ImageItem) => void;
  onEmptyAction?: () => void;
  className?: string;
  imageSize?: "sm" | "md" | "lg" | "xl";
  showMetadata?: boolean;
  enableLightbox?: boolean;
}

const IMAGE_SIZES = {
  sm: "w-32 h-32",
  md: "w-48 h-48",
  lg: "w-64 h-64",
  xl: "w-80 h-80",
};

const HorizontalImageList = ({
  title,
  images,
  loading = false,
  emptyMessage = "No images available",
  emptyActionLabel,
  onImageClick,
  onEmptyAction,
  className,
  imageSize = "md",
  showMetadata = false,
  enableLightbox = true,
}: HorizontalImageListProps) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [isScrolling, setIsScrolling] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<ImageItem | null>(null);
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());

  // Check scroll position with debouncing
  const checkScrollPosition = useCallback(() => {
    if (!scrollContainerRef.current) return;

    const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
    const threshold = 5; // Small threshold to account for rounding
    setCanScrollLeft(scrollLeft > threshold);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - threshold);
  }, []);

  useEffect(() => {
    checkScrollPosition();
    const container = scrollContainerRef.current;
    if (!container) return;

    // Use passive listener for better performance
    container.addEventListener("scroll", checkScrollPosition, { passive: true });
    
    // Use ResizeObserver for better resize handling
    const resizeObserver = new ResizeObserver(checkScrollPosition);
    resizeObserver.observe(container);

    return () => {
      container.removeEventListener("scroll", checkScrollPosition);
      resizeObserver.disconnect();
    };
  }, [images, loading, checkScrollPosition]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!scrollContainerRef.current) return;
      
      // Only handle if container is focused or contains focused element
      const container = scrollContainerRef.current;
      if (!container.contains(document.activeElement)) return;

      if (e.key === "ArrowLeft" && canScrollLeft) {
        e.preventDefault();
        handleScroll("left");
      } else if (e.key === "ArrowRight" && canScrollRight) {
        e.preventDefault();
        handleScroll("right");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [canScrollLeft, canScrollRight]);

  // Scroll handlers
  const handleScroll = (direction: "left" | "right") => {
    if (!scrollContainerRef.current || isScrolling) return;

    const container = scrollContainerRef.current;
    const scrollAmount = container.clientWidth * 0.75; // Scroll 75% of container width
    const targetScroll = direction === "left" 
      ? Math.max(0, container.scrollLeft - scrollAmount)
      : Math.min(container.scrollWidth - container.clientWidth, container.scrollLeft + scrollAmount);

    setIsScrolling(true);
    container.scrollTo({
      left: targetScroll,
      behavior: "smooth",
    });

    setTimeout(() => {
      setIsScrolling(false);
      checkScrollPosition();
    }, 300);
  };

  const handleImageClick = (image: ImageItem) => {
    if (enableLightbox) {
      setLightboxImage(image);
    }
    
    if (onImageClick) {
      onImageClick(image);
    }
  };

  const handleImageError = (imageId: string) => {
    setImageErrors((prev) => new Set(prev).add(imageId));
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "";
    try {
      return new Date(dateString).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return "";
    }
  };

  const sizeClass = IMAGE_SIZES[imageSize];

  return (
    <>
      <div className={cn("w-full", className)}>
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h3 className="text-lg sm:text-xl font-semibold text-slate-800">{title}</h3>
            {!loading && images.length > 0 && (
              <span className="text-sm text-slate-500 font-normal">
                ({images.length})
              </span>
            )}
          </div>
          {images.length > 0 && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 rounded-full shadow-sm hover:shadow-md transition-all disabled:opacity-30"
                onClick={() => handleScroll("left")}
                disabled={!canScrollLeft || isScrolling || loading}
                aria-label="Scroll left"
                aria-disabled={!canScrollLeft || isScrolling || loading}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 rounded-full shadow-sm hover:shadow-md transition-all disabled:opacity-30"
                onClick={() => handleScroll("right")}
                disabled={!canScrollRight || isScrolling || loading}
                aria-label="Scroll right"
                aria-disabled={!canScrollRight || isScrolling || loading}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Scrollable Container */}
        <div className="relative">
          {/* Scroll Container */}
          <div
            ref={scrollContainerRef}
            className="flex gap-4 overflow-x-auto overflow-y-hidden pb-4 scroll-smooth [scrollbar-width:none] [-ms-overflow-style:none] [-webkit-overflow-scrolling:touch] [&::-webkit-scrollbar]:hidden focus-within:outline-none focus-within:ring-2 focus-within:ring-primary/20 focus-within:ring-offset-2 rounded-lg"
            role="region"
            aria-label={`${title} gallery`}
            tabIndex={0}
          >
            {loading ? (
              // Loading skeleton
              Array.from({ length: 5 }).map((_, index) => (
                <div
                  key={`skeleton-${index}`}
                  className={cn("flex-shrink-0 rounded-lg overflow-hidden", sizeClass)}
                >
                  <Skeleton className="w-full h-full" />
                </div>
              ))
            ) : images.length === 0 ? (
              // Empty state
              <div className="flex items-center justify-center w-full py-16 px-4">
                <div className="text-center max-w-md">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 mb-4">
                    <ImageIcon className="w-8 h-8 text-slate-400" />
                  </div>
                  <p className="text-sm sm:text-base text-slate-600 mb-2 font-medium">{emptyMessage}</p>
                  {onEmptyAction && emptyActionLabel && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={onEmptyAction}
                      className="mt-4"
                    >
                      {emptyActionLabel}
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              // Image items
              images.map((image) => {
                const hasError = imageErrors.has(image.id);
                
                return (
                  <div
                    key={image.id}
                    className={cn(
                      "flex-shrink-0 group relative rounded-xl overflow-hidden",
                      "border-2 border-slate-200 bg-slate-50",
                      "hover:border-slate-300 hover:shadow-lg",
                      "transition-all duration-200 cursor-pointer",
                      "focus-within:outline-none focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2",
                      sizeClass
                    )}
                    onClick={() => handleImageClick(image)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleImageClick(image);
                      }
                    }}
                    tabIndex={0}
                    role="button"
                    aria-label={image.alt || `View image ${image.id}`}
                  >
                    {hasError ? (
                      // Error state
                      <div className="w-full h-full flex flex-col items-center justify-center p-4 bg-slate-100">
                        <ImageIcon className="w-8 h-8 text-slate-400 mb-2" />
                        <p className="text-xs text-slate-500 text-center">Image unavailable</p>
                      </div>
                    ) : (
                      <>
                        {/* Image */}
                        <img
                          src={image.imageUrl}
                          alt={image.alt || "Image"}
                          className="w-full h-full object-contain bg-white transition-transform duration-300 group-hover:scale-105"
                          loading="lazy"
                          onError={() => handleImageError(image.id)}
                          decoding="async"
                        />

                        {/* Hover Overlay */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-black/0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col items-center justify-end p-3">
                          <div className="flex items-center gap-2 text-white text-xs">
                            <Maximize2 className="w-4 h-4" />
                            <span className="font-medium">View</span>
                          </div>
                          {showMetadata && image.metadata?.createdAt && (
                            <div className="flex items-center gap-1.5 text-white/90 text-xs mt-2">
                              <Calendar className="w-3 h-3" />
                              <span>{formatDate(image.metadata.createdAt || image.metadata.uploadedAt)}</span>
                            </div>
                          )}
                        </div>

                        {/* Focus indicator */}
                        <div className="absolute inset-0 ring-2 ring-primary/0 group-focus-within:ring-primary/50 transition-all rounded-xl pointer-events-none" />
                      </>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Gradient fade effects - only show when scrollable */}
          {canScrollLeft && images.length > 0 && (
            <div className="absolute left-0 top-0 bottom-4 w-16 bg-gradient-to-r from-white via-white/80 to-transparent pointer-events-none z-10" />
          )}
          {canScrollRight && images.length > 0 && (
            <div className="absolute right-0 top-0 bottom-4 w-16 bg-gradient-to-l from-white via-white/80 to-transparent pointer-events-none z-10" />
          )}
        </div>
      </div>

      {/* Lightbox Dialog */}
      {enableLightbox && (
        <Dialog open={!!lightboxImage} onOpenChange={(open) => !open && setLightboxImage(null)}>
          <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 bg-black/95 border-0 [&>button]:text-white [&>button]:hover:bg-white/10">
            <DialogHeader className="sr-only">
              <DialogTitle>{lightboxImage?.alt || "Image Preview"}</DialogTitle>
            </DialogHeader>
            <div className="relative w-full h-full flex items-center justify-center p-4 sm:p-8">
              {lightboxImage && (
                <>
                  <img
                    src={lightboxImage.imageUrl}
                    alt={lightboxImage.alt || "Preview"}
                    className="max-h-[90vh] max-w-full w-auto h-auto object-contain rounded-lg"
                    onError={() => {
                      setImageErrors((prev) => new Set(prev).add(lightboxImage.id));
                    }}
                  />
                  {/* Metadata overlay */}
                  {showMetadata && lightboxImage.metadata && (
                    <div className="absolute bottom-4 left-4 right-4 bg-black/70 backdrop-blur-sm rounded-lg p-3 text-white text-sm">
                      {lightboxImage.metadata.createdAt && (
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          <span>{formatDate(lightboxImage.metadata.createdAt || lightboxImage.metadata.uploadedAt)}</span>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};

export default HorizontalImageList;
