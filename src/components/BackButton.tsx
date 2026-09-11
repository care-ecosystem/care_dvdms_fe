import { ComponentProps, MouseEvent, ReactNode } from "react";
import type { VariantProps } from "class-variance-authority";

import { Button, ButtonVariant, buttonVariants } from "@/components/ui/button";
import { goBack } from "@/lib/navigation";

type BackButtonProps = {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: VariantProps<typeof buttonVariants>["size"];
  className?: string;
  disabled?: boolean;
  /** Where to land when this page was opened cold and there is nothing to pop. */
  fallback?: string;
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
} & Omit<ComponentProps<"button">, "onClick" | "children">;

export default function BackButton({
  children,
  variant = "outline",
  size = "default",
  className,
  disabled = false,
  fallback,
  onClick,
  ...props
}: BackButtonProps) {
  return (
    <Button
      {...props}
      type="button"
      variant={variant}
      size={size}
      className={className}
      disabled={disabled}
      onClick={onClick ?? (() => goBack(fallback))}
    >
      {children}
    </Button>
  );
}
