import * as React from "react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

interface ImageSkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Aspect ratio of the skeleton (e.g., "1/1" for square, "4/3" for landscape)
   * @default "1/1"
   */
  aspectRatio?: string;
  /**
   * Whether to show rounded corners
   * @default true
   */
  rounded?: boolean;
  /**
   * Size variant: "sm" | "md" | "lg"
   * @default "md"
   */
  size?: "sm" | "md" | "lg";
}

const ImageSkeleton = React.forwardRef<HTMLDivElement, ImageSkeletonProps>(
  ({ className, aspectRatio = "1/1", rounded = true, size = "md", ...props }, ref) => {
    const sizeClasses = {
      sm: "h-14 w-14",
      md: "h-16 w-16",
      lg: "h-20 w-20",
    };

    return (
      <div
        ref={ref}
        className={cn(
          "relative overflow-hidden",
          rounded ? "rounded-lg" : "",
          sizeClasses[size],
          className
        )}
        style={{ aspectRatio }}
        {...props}
      >
        <Skeleton className="absolute inset-0 w-full h-full" />
      </div>
    );
  }
);

ImageSkeleton.displayName = "ImageSkeleton";

export { ImageSkeleton };

