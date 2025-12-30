import { useRef, useEffect, useCallback, useState } from "react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

interface WheelPickerOption {
  value: string;
  label: string;
}

interface WheelPickerProps {
  options: WheelPickerOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
  itemHeight?: number;
  visibleItems?: number;
}

export function WheelPicker({
  options,
  value,
  onChange,
  className,
  itemHeight = 40,
  visibleItems = 5,
}: WheelPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout>();

  const selectedIndex = options.findIndex((opt) => opt.value === value);
  const containerHeight = itemHeight * visibleItems;
  const paddingItems = Math.floor(visibleItems / 2);

  const scrollToIndex = useCallback(
    (index: number, smooth = true) => {
      if (containerRef.current) {
        const scrollTop = index * itemHeight;
        containerRef.current.scrollTo({
          top: scrollTop,
          behavior: smooth ? "smooth" : "auto",
        });
      }
    },
    [itemHeight]
  );

  useEffect(() => {
    if (selectedIndex >= 0 && !isScrolling) {
      scrollToIndex(selectedIndex, false);
    }
  }, [selectedIndex, scrollToIndex, isScrolling]);

  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;

    setIsScrolling(true);

    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    scrollTimeoutRef.current = setTimeout(() => {
      if (!containerRef.current) return;

      const scrollTop = containerRef.current.scrollTop;
      const newIndex = Math.round(scrollTop / itemHeight);
      const clampedIndex = Math.max(0, Math.min(newIndex, options.length - 1));

      if (options[clampedIndex] && options[clampedIndex].value !== value) {
        onChange(options[clampedIndex].value);
      }

      scrollToIndex(clampedIndex);
      setIsScrolling(false);
    }, 100);
  }, [itemHeight, options, value, onChange, scrollToIndex]);

  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  const getItemTransform = (index: number) => {
    const distance = index - selectedIndex;
    const absDistance = Math.abs(distance);
    const rotateX = distance * 18;
    const translateZ = absDistance * -5;
    const scale = Math.max(0.85, 1 - absDistance * 0.05);
    const opacity = Math.max(0.3, 1 - absDistance * 0.25);

    return {
      transform: `perspective(300px) rotateX(${rotateX}deg) translateZ(${translateZ}px) scale(${scale})`,
      opacity,
    };
  };

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg bg-muted/50",
        className
      )}
      style={{ height: containerHeight }}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-10"
        style={{
          height: paddingItems * itemHeight,
          background:
            "linear-gradient(to bottom, hsl(var(--background)) 0%, hsl(var(--background) / 0.8) 50%, transparent 100%)",
        }}
      />

      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-10"
        style={{
          height: paddingItems * itemHeight,
          background:
            "linear-gradient(to top, hsl(var(--background)) 0%, hsl(var(--background) / 0.8) 50%, transparent 100%)",
        }}
      />

      <div
        className="pointer-events-none absolute inset-x-2 z-20 rounded-md border border-primary/30 bg-primary/5"
        style={{
          top: paddingItems * itemHeight,
          height: itemHeight,
        }}
      />

      <div
        ref={containerRef}
        className="h-full overflow-y-auto scrollbar-hide"
        onScroll={handleScroll}
        style={{
          scrollSnapType: "y mandatory",
          WebkitOverflowScrolling: "touch",
        }}
      >
        <div style={{ height: paddingItems * itemHeight }} />

        {options.map((option, index) => {
          const isSelected = option.value === value;
          const transforms = getItemTransform(index);

          return (
            <div
              key={option.value}
              className={cn(
                "flex cursor-pointer items-center justify-center transition-all duration-150",
                isSelected
                  ? "font-semibold text-foreground"
                  : "text-muted-foreground"
              )}
              style={{
                height: itemHeight,
                scrollSnapAlign: "center",
                ...transforms,
              }}
              onClick={() => {
                onChange(option.value);
                scrollToIndex(index);
              }}
              data-testid={`wheel-option-${option.value}`}
            >
              {option.label}
            </div>
          );
        })}

        <div style={{ height: paddingItems * itemHeight }} />
      </div>
    </div>
  );
}

interface WheelPickerDialogProps {
  options: WheelPickerOption[];
  value: string;
  onChange: (value: string) => void;
  trigger: React.ReactNode;
  title?: string;
}

export function WheelPickerPopover({
  options,
  value,
  onChange,
  trigger,
  title,
}: WheelPickerDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [tempValue, setTempValue] = useState(value);

  useEffect(() => {
    if (isOpen) {
      setTempValue(value);
    }
  }, [isOpen, value]);

  const handleConfirm = () => {
    onChange(tempValue);
    setIsOpen(false);
  };

  const handleCancel = () => {
    setTempValue(value);
    setIsOpen(false);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        {trigger}
      </PopoverTrigger>
      <PopoverContent className="w-64 p-4" align="start">
        {title && (
          <div className="mb-3 text-center text-sm font-medium text-muted-foreground">
            {title}
          </div>
        )}

        <WheelPicker
          options={options}
          value={tempValue}
          onChange={setTempValue}
          className="mb-4"
        />

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCancel}
            className="flex-1"
            data-testid="wheel-picker-cancel"
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleConfirm}
            className="flex-1"
            data-testid="wheel-picker-confirm"
          >
            Done
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
