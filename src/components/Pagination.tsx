import { FC, ReactNode } from "react";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type PaginationProps = {
  totalCount: number;
  page: number;
  perPage: number;
  onPageChange: (page: number) => void;
  className?: string;
};

const getPageNumbers = (page: number, totalPages: number) => {
  if (page === 1 && page === totalPages) return [page];

  const pageNumbers: number[] = [];
  if (page === totalPages) {
    let temp = page;
    let limit = 3;
    while (temp >= 1 && limit > 0) {
      pageNumbers.push(temp);
      temp--;
      limit--;
    }
  } else {
    pageNumbers.push(page);
    if (page > 1) {
      pageNumbers.push(page - 1);
      if (page + 1 <= totalPages) pageNumbers.push(page + 1);
    } else {
      pageNumbers.push(page + 1);
      if (page + 2 <= totalPages) pageNumbers.push(page + 2);
    }
  }
  return pageNumbers.sort((a, b) => a - b);
};

const Pagination: FC<PaginationProps> = ({
  totalCount,
  page,
  perPage,
  onPageChange,
  className,
}) => {
  if (totalCount <= perPage) return null;

  const totalPages = Math.ceil(totalCount / perPage);
  const pageNumbers = getPageNumbers(page, totalPages);

  return (
    <div className={cn("mx-auto my-4", className)}>
      <div className="flex flex-1 justify-between sm:hidden">
        <NavButton onClick={() => onPageChange(page - 1)} disabled={page <= 1}>
          <ChevronLeftIcon className="size-4" />
        </NavButton>
        <NavButton
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
        >
          <ChevronRightIcon className="size-4" />
        </NavButton>
      </div>

      <nav className="relative hidden overflow-hidden rounded-lg border border-gray-300 bg-white sm:inline-flex sm:flex-1 sm:items-center sm:justify-between">
        <NavButton onClick={() => onPageChange(1)} disabled={page === 1}>
          <ChevronsLeftIcon className="size-4" />
        </NavButton>
        <NavButton onClick={() => onPageChange(page - 1)} disabled={page <= 1}>
          <ChevronLeftIcon className="size-4" />
        </NavButton>
        {pageNumbers.map((p) => (
          <NavButton
            key={p}
            onClick={() => onPageChange(p)}
            selected={page === p}
          >
            {p}
          </NavButton>
        ))}
        <NavButton
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
        >
          <ChevronRightIcon className="size-4" />
        </NavButton>
        <NavButton
          onClick={() => onPageChange(totalPages)}
          disabled={page === totalPages}
        >
          <ChevronsRightIcon className="size-4" />
        </NavButton>
      </nav>
    </div>
  );
};

export default Pagination;

type NavButtonProps = {
  onClick: () => void;
  children: ReactNode;
  disabled?: boolean;
  selected?: boolean;
};

const NavButton: FC<NavButtonProps> = ({
  onClick,
  children,
  disabled,
  selected,
}) => (
  <Button
    type="button"
    disabled={disabled}
    onClick={onClick}
    variant={selected ? "primary" : "secondary"}
    className="rounded-none text-sm font-bold"
  >
    {children}
  </Button>
);
