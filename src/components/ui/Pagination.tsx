"use client";

import { useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  showingText?: string;
}

/** Page navigation control with numbered buttons and prev/next arrows. */
export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  showingText,
}: PaginationProps) {
  const pageItems = useMemo(() => {
    if (totalPages <= 7) {
      const pages: (number | "ellipsis")[] = [];
      for (let i = 1; i <= totalPages; i++) pages.push(i);
      return pages;
    }

    const items: (number | "ellipsis")[] = [1];
    const left = Math.max(2, currentPage - 1);
    const right = Math.min(totalPages - 1, currentPage + 1);

    if (left > 2) items.push("ellipsis");
    for (let i = left; i <= right; i++) items.push(i);
    if (right < totalPages - 1) items.push("ellipsis");
    items.push(totalPages);

    return items;
  }, [totalPages, currentPage]);

  return (
    <div className="flex items-center justify-between h-12 px-4 border-t border-[#333333]">
      {showingText && (
        <span className="hidden lg:inline text-[13px] text-[#666666]">
          {showingText}
        </span>
      )}
      <div className="flex items-center gap-2 ml-auto">
        <button
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          className="w-8 h-8 flex items-center justify-center rounded-md bg-[#2A2A2A] text-[#666666] disabled:opacity-40 hover:text-white transition-colors cursor-pointer disabled:cursor-not-allowed"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
        {pageItems.map((item, idx) =>
          item === "ellipsis" ? (
            <span
              key={`ellipsis-${idx}`}
              className="w-8 h-8 flex items-center justify-center text-sm text-[#666666]"
            >
              &hellip;
            </span>
          ) : (
            <button
              key={item}
              onClick={() => onPageChange(item)}
              className={`w-8 h-8 flex items-center justify-center rounded-md text-sm transition-colors cursor-pointer ${
                item === currentPage
                  ? "bg-[#F5C518] text-[#0D0D0D] font-semibold"
                  : "bg-[#2A2A2A] text-[#A0A0A0] hover:text-white"
              }`}
            >
              {item}
            </button>
          )
        )}
        <button
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
          className="w-8 h-8 flex items-center justify-center rounded-md bg-[#2A2A2A] text-[#666666] disabled:opacity-40 hover:text-white transition-colors cursor-pointer disabled:cursor-not-allowed"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
