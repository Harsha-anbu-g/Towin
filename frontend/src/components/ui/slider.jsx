"use client";

import * as SliderPrimitive from "@radix-ui/react-slider";
import * as React from "react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const Slider = React.forwardRef(
  ({ className, trackClassName, rangeClassName, thumbClassName, showTooltip = false, tooltipContent, ...props }, ref) => {
    const [showTooltipState, setShowTooltipState] = React.useState(false);
    const [internalValue, setInternalValue] = React.useState(
      props.defaultValue ?? props.value ?? [0],
    );

    React.useEffect(() => {
      if (props.value !== undefined) {
        setInternalValue(props.value);
      }
    }, [props.value]);

    const handleValueChange = (newValue) => {
      setInternalValue(newValue);
      props.onValueChange?.(newValue);
    };

    const handlePointerDown = () => {
      if (showTooltip) setShowTooltipState(true);
    };

    const handlePointerUp = React.useCallback(() => {
      if (showTooltip) setShowTooltipState(false);
    }, [showTooltip]);

    React.useEffect(() => {
      if (showTooltip) {
        document.addEventListener("pointerup", handlePointerUp);
        return () => document.removeEventListener("pointerup", handlePointerUp);
      }
    }, [showTooltip, handlePointerUp]);

    const renderThumb = (value) => {
      const thumb = (
        <SliderPrimitive.Thumb
          className={cn(
            "block h-5 w-5 rounded-full border-2 border-primary bg-background transition-colors focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-ring/40 data-[disabled]:cursor-not-allowed",
            thumbClassName,
          )}
          onPointerDown={handlePointerDown}
        />
      );

      if (!showTooltip) return thumb;

      return (
        <TooltipProvider>
          <Tooltip open={showTooltipState}>
            <TooltipTrigger asChild>{thumb}</TooltipTrigger>
            <TooltipContent
              className="px-2 py-1 text-xs"
              sideOffset={8}
              side={props.orientation === "vertical" ? "right" : "top"}
            >
              <p>{tooltipContent ? tooltipContent(value) : value}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    };

    return (
      <SliderPrimitive.Root
        ref={ref}
        className={cn(
          "relative flex w-full touch-none select-none items-center data-[orientation=vertical]:h-full data-[orientation=vertical]:w-auto data-[orientation=vertical]:flex-col data-[disabled]:opacity-50",
          className,
        )}
        onValueChange={handleValueChange}
        {...props}
      >
        <SliderPrimitive.Track className={cn(
          "relative grow overflow-hidden rounded-full bg-secondary data-[orientation=horizontal]:h-2 data-[orientation=vertical]:h-full data-[orientation=horizontal]:w-full data-[orientation=vertical]:w-2",
          trackClassName,
        )}>
          <SliderPrimitive.Range className={cn(
            "absolute bg-primary data-[orientation=horizontal]:h-full data-[orientation=vertical]:w-full",
            rangeClassName,
          )} />
        </SliderPrimitive.Track>
        {internalValue?.map((value, index) => (
          <React.Fragment key={index}>{renderThumb(value)}</React.Fragment>
        ))}
      </SliderPrimitive.Root>
    );
  },
);
Slider.displayName = SliderPrimitive.Root.displayName;

export { Slider };
