import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-px text-sm font-medium whitespace-nowrap text-gray-950",
  {
    variants: {
      variant: {
        secondary: "border-gray-300 bg-gray-100 text-gray-900",
        yellow: "border-yellow-300 bg-yellow-100 text-yellow-900",
        green: "border-green-300 bg-green-100 text-green-900",
        destructive: "border-red-300 bg-red-100 text-red-900",
        indigo: "border-indigo-300 bg-indigo-100 text-indigo-900",
      },
    },
    defaultVariants: {
      variant: "secondary",
    },
  },
);

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return (
    <span
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
