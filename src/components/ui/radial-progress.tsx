import * as React from "react";
import { cn } from "@/lib/utils";

interface RadialProgressProps {
  value: number;
  max?: number;
  size?: "sm" | "md" | "lg" | "xl";
  strokeWidth?: number;
  className?: string;
  showLabel?: boolean;
  label?: string;
  labelPosition?: "center" | "bottom";
  color?: "primary" | "success" | "warning" | "destructive" | "muted";
  children?: React.ReactNode;
}

const sizeMap = {
  sm: { diameter: 64, strokeWidth: 5, fontSize: "text-[10px]", labelSize: "text-[9px]", containerPadding: "p-0" },
  md: { diameter: 80, strokeWidth: 6, fontSize: "text-xs", labelSize: "text-[10px]", containerPadding: "p-0" },
  lg: { diameter: 120, strokeWidth: 8, fontSize: "text-sm", labelSize: "text-xs", containerPadding: "p-0" },
  xl: { diameter: 180, strokeWidth: 10, fontSize: "text-lg", labelSize: "text-sm", containerPadding: "p-2" },
};

const colorMap = {
  primary: { stroke: "stroke-primary", bg: "stroke-primary/20", text: "text-primary" },
  success: { stroke: "stroke-success", bg: "stroke-success/20", text: "text-success" },
  warning: { stroke: "stroke-warning", bg: "stroke-warning/20", text: "text-warning" },
  destructive: { stroke: "stroke-destructive", bg: "stroke-destructive/20", text: "text-destructive" },
  muted: { stroke: "stroke-muted-foreground", bg: "stroke-muted-foreground/20", text: "text-muted-foreground" },
};

const RadialProgress = React.forwardRef<HTMLDivElement, RadialProgressProps>(
  (
    {
      value,
      max = 100,
      size = "md",
      strokeWidth,
      className,
      showLabel = true,
      label,
      labelPosition = "center",
      color = "primary",
      children,
      ...props
    },
    ref
  ) => {
    const sizeConfig = sizeMap[size];
    const colorConfig = colorMap[color];
    const actualStrokeWidth = strokeWidth || sizeConfig.strokeWidth;
    const diameter = sizeConfig.diameter;
    const radius = (diameter - actualStrokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const percentage = Math.min(Math.max((value / max) * 100, 0), 100);
    const offset = circumference - (percentage / 100) * circumference;

    // Determine color based on percentage if not explicitly set
    let effectiveColor = color;
    if (color === "primary") {
      if (percentage >= 90) effectiveColor = "destructive";
      else if (percentage >= 70) effectiveColor = "warning";
      else if (percentage >= 50) effectiveColor = "primary";
      else effectiveColor = "success";
    }

    const effectiveColorConfig = colorMap[effectiveColor];

    return (
      <div
        ref={ref}
        className={cn("relative inline-flex items-center justify-center", sizeConfig.containerPadding, className)}
        {...props}
      >
        <div className="relative">
          <svg
            width={diameter}
            height={diameter}
            className="transform -rotate-90"
            aria-label={`Progress: ${Math.round(percentage)}%`}
            style={{ minWidth: diameter, minHeight: diameter }}
          >
            {/* Background circle */}
            <circle
              cx={diameter / 2}
              cy={diameter / 2}
              r={radius}
              fill="none"
              strokeWidth={actualStrokeWidth}
              className={cn("stroke-current", effectiveColorConfig.bg)}
            />
            {/* Progress circle */}
            <circle
              cx={diameter / 2}
              cy={diameter / 2}
              r={radius}
              fill="none"
              strokeWidth={actualStrokeWidth}
              className={cn("stroke-current transition-all duration-700 ease-out", effectiveColorConfig.stroke)}
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              strokeLinecap="round"
            />
          </svg>
          {/* Center content */}
          {labelPosition === "center" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              {children || (
                <>
                  {showLabel && (
                    <span className={cn("font-bold leading-none", sizeConfig.fontSize, effectiveColorConfig.text)}>
                      {Math.round(percentage)}%
                    </span>
                  )}
                  {label && (
                    <span className={cn("mt-1 font-medium text-muted-foreground leading-tight text-center px-1", sizeConfig.labelSize)}>
                      {label}
                    </span>
                  )}
                </>
              )}
            </div>
          )}
        </div>
        {/* Bottom label - positioned outside the SVG container to prevent overlap */}
        {labelPosition === "bottom" && (
          <div className={cn(
            "absolute left-1/2 transform -translate-x-1/2 w-full text-center whitespace-nowrap",
            size === "xl" ? "-bottom-10" : size === "lg" ? "-bottom-8" : size === "md" ? "-bottom-7" : "-bottom-6"
          )}>
            {label && (
              <span className={cn("font-medium text-muted-foreground block leading-tight", sizeConfig.labelSize)}>
                {label}
              </span>
            )}
            {showLabel && labelPosition === "bottom" && !children && (
              <span className={cn("font-bold block leading-tight mt-0.5", sizeConfig.fontSize, effectiveColorConfig.text)}>
                {Math.round(percentage)}%
              </span>
            )}
          </div>
        )}
      </div>
    );
  }
);

RadialProgress.displayName = "RadialProgress";

export { RadialProgress };

