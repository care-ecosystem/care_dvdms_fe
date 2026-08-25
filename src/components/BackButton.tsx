import { ComponentProps, MouseEvent, ReactNode } from "react";
import type { VariantProps } from "class-variance-authority";

import { Button, ButtonVariant, buttonVariants } from "@/components/ui/button";

type BackButtonProps = {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: VariantProps<typeof buttonVariants>["size"];
  className?: string;
  disabled?: boolean;
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
} & Omit<ComponentProps<"button">, "onClick" | "children">;

export default function BackButton({
  children,
  variant = "outline",
  size = "default",
  className,
  disabled = false,
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
      onClick={onClick ?? (() => history.back())}
    >
      {children}
    </Button>
  );
}
