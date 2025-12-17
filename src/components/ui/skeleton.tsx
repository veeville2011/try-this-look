import * as React from "react";

import { cn } from "@/lib/utils";

const Skeleton = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "relative overflow-hidden rounded-md bg-muted",
          // Shimmer overlay (keyframes are defined in `src/index.css`)
          "before:absolute before:inset-0 before:-translate-x-full before:bg-gradient-to-r before:from-transparent before:via-background/45 before:to-transparent before:content-[''] before:animate-[shimmer-wave_1.8s_infinite]",
          // Respect reduced motion
          "motion-reduce:before:hidden",
          className
        )}
        {...props}
      />
    );
  }
);

Skeleton.displayName = "Skeleton";

export { Skeleton };
