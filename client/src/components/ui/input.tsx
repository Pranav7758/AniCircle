import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-12 w-full rounded-none border-0 border-b-2 border-[#D4AF37] bg-transparent px-3 py-2 text-base text-[#F2F0E4] ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-[#888888] focus-visible:outline-none focus-visible:ring-0 focus-visible:border-[#F2E8C4] focus-visible:shadow-[0_4px_10px_rgba(212,175,55,0.2)] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
