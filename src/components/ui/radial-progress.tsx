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
  sm: { diameter: 64, strokeWidth: 6, fontSize: "text-xs", labelSize: "text-[10px]" },
  md: { diameter: 80, strokeWidth: 8, fontSize: "text-sm", labelSize: "text-xs" },
  lg: { diameter: 120, strokeWidth: 10, fontSize: "text-base", labelSize: "text-sm" },
  xl: { diameter: 160, strokeWidth: 12, fontSize: "text-xl", labelSize: "text-base" },
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
        className={cn("relative inline-flex items-center justify-center", className)}
        {...props}
      >
        <svg
          width={diameter}
          height={diameter}
          className="transform -rotate-90"
          aria-label={`Progress: ${Math.round(percentage)}%`}
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
            className={cn("stroke-current transition-all duration-500 ease-in-out", effectiveColorConfig.stroke)}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
          />
        </svg>
        {/* Center content */}
        {labelPosition === "center" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {children || (
              <>
                {showLabel && (
                  <span className={cn("font-bold", sizeConfig.fontSize, effectiveColorConfig.text)}>
                    {Math.round(percentage)}%
                  </span>
                )}
                {label && (
                  <span className={cn("mt-0.5 font-medium text-muted-foreground", sizeConfig.labelSize)}>
                    {label}
                  </span>
                )}
              </>
            )}
          </div>
        )}
        {/* Bottom label */}
        {labelPosition === "bottom" && label && (
          <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 w-full text-center">
            <span className={cn("font-medium text-muted-foreground block", sizeConfig.labelSize)}>
              {label}
            </span>
            {showLabel && (
              <span className={cn("font-bold block mt-0.5", sizeConfig.fontSize, effectiveColorConfig.text)}>
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

